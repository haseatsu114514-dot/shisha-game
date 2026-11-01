// DJ set model (pure functions, audio-clock seconds). A SET is a playlist mixed in order:
// the player presses ▶ on the incoming deck at the phrase head (quantized to the nearest beat, like a CDJ with
// QUANTIZE on), then moves the crossfader across 8 bars. EQ (bass swap) is automatic. Each transition is
// scored on pitch / entry / fader; the floor meter reacts to how the mix sounds.
import { TRACKS } from './tracks.mjs';
export const PHRASE = 32;      // 8 bars of 4/4
export const LEAD = 16;        // the next entry cue is at least 4 bars away
export const GRACE = 32;       // after the 8 bars the outgoing deck keeps playing up to 8 more bars if the fader has not crossed
export const PITCH_RANGE = 8;  // PITCH fader ±8 % like a CDJ
export const LOCK_PCT = .15;   // BPM within this % counts as locked (LOCK LED, quantize phase snap)
export const LOW_CUT_DB = -26;
export const mod = (v, n) => ((v % n) + n) % n;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round2 = v => Math.round(v * 100) / 100;
export const beatAt = (d, now) => d.beat + (d.playing ? (now - d.at) * d.bpm / 60 : 0);
export function anchor(d, now, beat = beatAt(d, now)) { d.beat = beat; d.at = now; }
export const bpmRange = d => [round2(d.nativeBpm * (1 - PITCH_RANGE / 100)), round2(d.nativeBpm * (1 + PITCH_RANGE / 100))];
export function setTempo(d, bpm, now) { const [lo, hi] = bpmRange(d); anchor(d, now); d.bpm = clamp(round2(Number(bpm)), lo, hi); }
export const pitchOf = d => (d.bpm / d.nativeBpm - 1) * 100;
export function setPitch(d, pct, now) { setTempo(d, d.nativeBpm * (1 + clamp(Number(pct), -PITCH_RANGE, PITCH_RANGE) / 100), now); }
export function phaseError(a, b, now) { return mod(beatAt(b, now) - beatAt(a, now) + .5, 1) - .5; }
export const bpmDiffPct = (a, b) => Math.abs(b.bpm - a.bpm) / a.bpm * 100;
/** Automatic bass swap (no player input): incoming B keeps its lows cut until the fader reaches the middle, then A's lows are cut. dB per deck. */
export function lowCutDb(x) { x = clamp(x, 0, 1); const ramp = t => (LOW_CUT_DB * clamp(t, 0, 1)) || 0; return [ramp((x - .5) / .25), ramp((.5 - x) / .25)]; }
export function gains(x) { x = clamp(x, 0, 1); return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)]; }

export function makeDeck(key, detuneFactor = 1) {
  const nativeBpm = TRACKS[key].bpm;
  return { track: key, nativeBpm, bpm: round2(nativeBpm * detuneFactor), beat: 0, at: 0, playing: false };
}
/** Detune factor for the track at queue index (index 0 is never detuned). */
export const detuneFactorFor = (set, rng = Math.random) => index =>
  set.detune === 'random' && index > 0 ? 1 + (rng() < .5 ? -1 : 1) * (.012 + rng() * .016) : 1;
export function createSet(set, detune = () => 1) {
  return { set, queue: [...set.tracks], position: 2, detune,
    decks: [makeDeck(set.tracks[0]), makeDeck(set.tracks[1], detune(1))],
    running: false, resumeDecks: [], mix: 0, master: 0, phase: 'idle', cue: null, transitions: [], floor: .5,
    lastPlay: null, lastUpdate: null, fader: null, result: null };
}
function nextCue(m, from, now) {
  const beat = beatAt(m.decks[from], now), start = (Math.floor((beat + LEAD) / PHRASE) + 1) * PHRASE;
  m.cue = { from, to: 1 - from, start, end: start + PHRASE, pressed: null, synced: false, missed: 0 };
  m.phase = 'cue'; m.fader = null;
}
export const GRADE_FLOOR = { PERFECT: .08, GOOD: .04, OK: 0, EARLY: -.05, LATE: -.05 };
export function gradeOf(errorMs) { const v = Math.abs(errorMs); return v <= 30 ? 'PERFECT' : v <= 60 ? 'GOOD' : v <= 120 ? 'OK' : errorMs < 0 ? 'EARLY' : 'LATE'; }
/** ▶ on a deck. The incoming deck of an open cue starts quantized to the master's nearest beat; anything else starts at once. */
export function playDeck(m, id, now) {
  const d = m.decks[id];
  if (d.playing || !d.track) return false;
  const c = m.cue;
  if (c && c.to === id && m.decks[c.from].playing && !c.pressed) {
    const from = m.decks[c.from], fb = beatAt(from, now), n = Math.round(fb);
    const errorMs = (fb - c.start) * 60 / from.bpm * 1000, grade = gradeOf(errorMs);
    d.beat = 0; d.at = from.at + (n - from.beat) * 60 / from.bpm; // beat 0 on the master's nearest beat (may be a few ms ahead)
    c.pressed = { errorMs, grade, beat: n, at: now }; m.lastPlay = { id, errorMs, grade };
    m.phase = 'mix'; m.fader = { samples: [], maxJump: 0, reached: null };
    m.floor = clamp(m.floor + GRADE_FLOOR[grade], 0, 1);
  } else {
    anchor(d, now);
    if (!m.running) m.master = id;
  }
  d.playing = true; m.running = true; m.resumeDecks = m.resumeDecks.filter(n => n !== id);
  const other = m.decks[1 - id];
  if (!m.cue && other.track && !other.playing) nextCue(m, id, now);
  return true;
}
/** SYNC: the incoming deck copies the master's tempo (pitch score is then capped). */
export function syncIncoming(m, now) {
  const c = m.cue; if (!c) return false;
  const [lo, hi] = bpmRange(m.decks[c.to]), target = clamp(m.decks[c.from].bpm, lo, hi);
  setTempo(m.decks[c.to], target, now); c.synced = true; return true;
}
export function pauseMix(m, now) {
  const ids = m.decks.flatMap((d, id) => d.playing ? [id] : []);
  if (ids.length) m.resumeDecks = ids;
  for (const d of m.decks) { anchor(d, now); d.playing = false; }
  m.running = false; m.lastUpdate = null;
}
export function resumeMix(m, now) {
  const ids = [...m.resumeDecks]; m.resumeDecks = [];
  for (const id of ids) { anchor(m.decks[id], now); m.decks[id].playing = true; }
  m.running = m.decks.some(d => d.playing); m.lastUpdate = null;
}
/** Crossfader position measured toward the incoming deck (0 = all on the outgoing deck, 1 = all on the incoming). */
export const toward = m => m.cue?.to === 0 ? 1 - m.mix : m.mix;
function faderSample(m, now) {
  const f = m.fader, x = toward(m);
  f.samples.push([now, x]);
  while (f.samples.length && f.samples[0][0] < now - .25) f.samples.shift();
  let lo = x, hi = x; for (const [, v] of f.samples) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  f.maxJump = Math.max(f.maxJump, hi - lo);
}
/** How the mix sounds right now, 0..1: silence or a thin signal and clashing beats bring the floor down. */
export function quality(m, now) {
  const g = gains(m.mix), live = m.decks.map(d => d.playing && beatAt(d, now) >= 0);
  let audible = 0; live.forEach((on, i) => { if (on) audible += g[i] * g[i]; });
  let q = audible < .5 ? audible : 1;
  if (live[0] && live[1]) {
    const ms = Math.abs(phaseError(m.decks[0], m.decks[1], now)) * 60 / m.decks[m.master].bpm * 1000, blend = Math.min(g[0], g[1]) * Math.SQRT2;
    q -= blend * clamp((ms - 20) / 100, 0, 1) * .8;
  } else q *= .6;
  return clamp(q, 0, 1);
}
export function floorStep(m, q, dt) { m.floor = clamp(m.floor + (q - .55) * dt * .06, 0, 1); }
export const scoreFromErr = (v, s, a, b) => v <= s + 1e-10 ? 100 : v <= a + 1e-10 ? 85 : v <= b + 1e-10 ? 60 : 30;
export const rankFromScore = total => total >= 90 ? 'S' : total >= 75 ? 'A' : total >= 55 ? 'B' : 'C';
export function scoreTransition({ pitchErrPct, synced, playMs, reached, maxJump }) {
  const pitch = Math.min(scoreFromErr(pitchErrPct, LOCK_PCT, .3, .6), synced ? 85 : 100);
  const entry = scoreFromErr(playMs, 30, 60, 120);
  const done = reached == null ? 30 : reached > 1 ? 60 : reached < .3 ? 85 : 100;
  const smooth = scoreFromErr(maxJump, .2, .4, .7);
  const fader = Math.round((done + smooth) / 2), total = Math.round((pitch + entry + fader) / 3);
  return { pitchErrPct, synced, playMs, reached, maxJump, done, smooth, parts: [pitch, entry, fader], total, rank: rankFromScore(total) };
}
export function scoreSet(m) {
  const t = m.transitions; if (!t.length) return null;
  const total = Math.round(t.reduce((s, x) => s + x.total, 0) / t.length);
  return { total, rank: rankFromScore(total), floor: Math.round(m.floor * 100), set: m.set.name, transitions: t.map(x => ({ from: x.from, to: x.to, grade: x.grade, parts: x.parts, total: x.total, rank: x.rank })) };
}
function finishTransition(m, now, view) {
  const c = m.cue, from = m.decks[c.from], to = m.decks[c.to];
  const score = scoreTransition({ pitchErrPct: bpmDiffPct(from, to), synced: c.synced, playMs: Math.abs(c.pressed.errorMs), reached: m.fader.reached, maxJump: m.fader.maxJump });
  const record = { ...score, from: from.track, to: to.track, grade: c.pressed.grade, missed: c.missed };
  m.transitions.push(record); view.transition = record;
  m.floor = clamp(m.floor + { S: .1, A: .05, B: 0, C: -.08 }[score.rank], 0, 1);
  anchor(from, now); from.playing = false; view.stopped = c.from; m.master = c.to;
  if (m.position < m.queue.length) {
    const index = m.position++, key = m.queue[index];
    Object.assign(from, makeDeck(key, m.detune(index))); view.loaded = { id: c.from, key };
    nextCue(m, c.to, now);
  } else {
    from.track = null; m.cue = null; m.phase = 'done'; m.fader = null; m.result = scoreSet(m); view.finished = m.result;
  }
}
/** Advance the set to `now`. Returns what the host must apply to audio: snapped / stopped / loaded, plus the view state. */
export function updateSet(m, now) {
  const dt = m.lastUpdate == null ? 0 : Math.max(0, now - m.lastUpdate); m.lastUpdate = now;
  const view = { mode: m.phase, progress: 0, remaining: 0, open: false, snapped: null, stopped: null, loaded: null, transition: null, finished: null };
  if (!m.running) { view.mode = 'idle'; return view; }
  const c = m.cue;
  if (c) {
    const from = m.decks[c.from], to = m.decks[c.to], fb = beatAt(from, now);
    if (m.phase === 'cue') {
      while (fb >= c.end) { c.start += PHRASE; c.end += PHRASE; c.missed++; }
      view.remaining = c.start - fb; view.open = fb >= c.start;
    } else if (m.phase === 'mix') {
      const progress = (fb - c.start) / PHRASE; view.progress = clamp(progress, 0, 1); view.remaining = c.end - fb;
      faderSample(m, now);
      if (bpmDiffPct(from, to) <= LOCK_PCT && beatAt(to, now) >= 0) {
        const e = phaseError(from, to, now);
        if (Math.abs(e) > .02) { anchor(to, now, beatAt(to, now) - e); view.snapped = c.to; }
      }
      const crossed = toward(m) >= .9;
      if (crossed && m.fader.reached == null) m.fader.reached = Math.max(0, progress);
      if (progress >= 1 && (crossed || progress >= 1 + GRACE / PHRASE)) finishTransition(m, now, view);
    }
  }
  floorStep(m, quality(m, now), dt);
  view.mode = m.phase;
  return view;
}
export function dancerPose(beat, reduced = false) {
  const phase = mod(beat, 4) / 4 * Math.PI * 2;
  return { hip: Math.sin(phase) * (reduced ? 0 : 3), bob: reduced ? 0 : (1 - Math.cos(phase * 2)) * 1.5,
    left: reduced ? 0 : Math.max(0, Math.sin(phase)) * 4, right: reduced ? 0 : Math.max(0, -Math.sin(phase)) * 4,
    arm: reduced ? 0 : Math.sin(phase) * 3 };
}
