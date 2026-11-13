// DJ set model (pure functions, audio-clock seconds). A SET opens with a fixed pair, then the player picks each next
// track from two candidates (選曲: key, energy and what the floor asks for). Each transition: press ▶ on the incoming
// deck at the entry line (quantized to the nearest beat, like a CDJ with QUANTIZE on), then ride the crossfader along
// the guide line for 8 bars (one check per beat, combo). EQ (bass swap) and the tempo are automatic.
// 2026-11-13 (DJG): no tempo faders any more. Every track arrives at the playing track's tempo; in SET 2・3 the incoming track
// slips out of time once or twice during the 8 bars (ズレ) and the player turns its platter to bring it back (nudgeDeck).
// Each transition is scored on beat (share of the 8 bars in time) / entry / fader-follow; the floor meter reacts to the
// mix, the picks and every beat of the fader.
// 2026-11-11 renewal (DJS20〜): the floor is the crowd's heat. It starts at 様子見 (50) and each thing the player does moves it by a
// visible step (entry, every beat of the fader, the transition's rank, the pick), so a clean set warms the room up to 最高潮 by the end
// instead of pinning the meter at 100 after one mix. ▶ is judged against the nearest phrase head.
import { TRACKS } from './tracks.mjs';
export const PHRASE = 32;      // 8 bars of 4/4
export const LEAD = 16;        // the next entry cue is at least 4 bars away
// 2026-11-13 DJF03 (待ち時間): the game opens entries on every 4-bar line instead of every 8-bar phrase head, so the wait before a ▶ is
// 2〜6 bars instead of 4〜12 (every set: there is no tempo to match any more, DJG). createSet's defaults keep the 8-bar grid.
export const QUICK_GRID = 16;
export const quickEntry = () => ({ grid: QUICK_GRID, lead: 8 });
export const GRACE = 32;       // after the 8 bars the outgoing deck keeps playing up to 8 more bars if the fader has not crossed
export const SYNC_BAND = .06;  // the two tracks count as in time within ±0.06 beat (30 ms at 120 BPM); past it the room hears the beats rub
export const SNAP_BAND = .035; // a turn of the platter that lands within ±0.035 beat is caught by QUANTIZE and snaps onto the beat
export const DRIFT_BEATS = 3;  // a slip builds up over 3 beats (the track runs a little fast or slow), then stays until it is fixed
export const SYNC_FLOOR = .03; // bringing the track back in time warms the room by a step
export const SLIP_FLOOR = -.008; // every beat the two tracks are out of time cools it (as much as a beat with the fader off the line)
export const FOLLOW_BAND = .14; // the fader counts as on the guide line within ±0.14 of it
export const LOW_CUT_DB = -26;
export const mod = (v, n) => ((v % n) + n) % n;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round2 = v => Math.round(v * 100) / 100;
export const beatAt = (d, now) => d.beat + (d.playing ? (now - d.at) * d.bpm / 60 : 0);
export function anchor(d, now, beat = beatAt(d, now)) { d.beat = beat; d.at = now; }
export function phaseError(a, b, now) { return mod(beatAt(b, now) - beatAt(a, now) + .5, 1) - .5; }
/** Automatic bass swap (no player input): incoming B keeps its lows cut until the fader reaches the middle, then A's lows are cut. dB per deck. */
export function lowCutDb(x) { x = clamp(x, 0, 1); const ramp = t => (LOW_CUT_DB * clamp(t, 0, 1)) || 0; return [ramp((x - .5) / .25), ramp((.5 - x) / .25)]; }
export function gains(x) { x = clamp(x, 0, 1); return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)]; }
/** The guide line over the 8 bars (0..1 toward the incoming deck): ease in, cross the middle at bar 5 (bass swap), ease out. */
export const guideAt = p => .5 - .5 * Math.cos(Math.PI * clamp(p, 0, 1));

// ---- 選曲 (track selection) ----
/** Camelot wheel: same code, ±1 on the same letter, or the same number on the other letter mix in key. */
export function keyMatch(a, b) {
  const pa = /^(\d+)([AB])$/.exec(TRACKS[a]?.camelot || ''), pb = /^(\d+)([AB])$/.exec(TRACKS[b]?.camelot || '');
  if (!pa || !pb) return false;
  const na = Number(pa[1]), nb = Number(pb[1]), step = Math.min(mod(na - nb, 12), mod(nb - na, 12));
  return pa[2] === pb[2] ? step <= 1 : step === 0;
}
export const REQUESTS = Object.freeze({ up: 'もっと上げて！', keep: 'この感じ、続けて', down: 'ちょっとひと息' });
export function energyMatch(request, from, to) {
  const d = (TRACKS[to]?.energy ?? 3) - (TRACKS[from]?.energy ?? 3);
  return request === 'up' ? d > 0 : request === 'down' ? d < 0 : Math.abs(d) <= 1;
}
/** ◎ key and request both fit, ○ one of them, △ neither. */
export function pickRating(request, from, to) {
  const n = (keyMatch(from, to) ? 1 : 0) + (energyMatch(request, from, to) ? 1 : 0);
  return n === 2 ? '◎' : n === 1 ? '○' : '△';
}
export const PICK_FLOOR = { '◎': .1, '○': .03, '△': -.05 };
/** What the guests ask for. At least one of the two candidates can answer it (DJS22: never two cards that both miss the request). */
function requestFor(m, master, options = []) {
  const e = TRACKS[master]?.energy ?? 3, roll = m.rng();
  const wish = e >= 5 ? (roll < .6 ? 'down' : 'keep') : e <= 2 ? (roll < .7 ? 'up' : 'keep') : roll < .5 ? 'up' : roll < .8 ? 'keep' : 'down';
  const fits = request => !options.length || options.some(key => energyMatch(request, master, key));
  return fits(wish) ? wish : ['keep', 'up', 'down'].find(fits) || wish;
}
function candidates(m, master) {
  const keys = Object.keys(TRACKS).filter(k => k !== master);
  const fresh = keys.filter(k => !m.played.includes(k)), pool = (fresh.length >= 2 ? fresh : keys).slice();
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(m.rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  return pool.slice(0, 2);
}

/** bpm: the tempo the deck plays at (an incoming track is set to the playing track's tempo; the default is the track's own). */
export function makeDeck(key, bpm = TRACKS[key].bpm) {
  return { track: key, nativeBpm: TRACKS[key].bpm, bpm: round2(bpm), beat: 0, at: 0, playing: false };
}
const incomingDeck = (m, key) => makeDeck(key, m.decks[m.master].bpm);
/** The slips of one transition (set.drift): where in the 8 bars each starts and how far it goes (beats; + = the incoming track runs ahead). */
function planDrifts(m) {
  const plan = m.set.drift; if (!plan) return [];
  return plan.windows.map(([from, to]) => ({ at: from + Math.floor(m.rng() * (to - from + 1)), size: (m.rng() < .5 ? -1 : 1) * (plan.size[0] + m.rng() * (plan.size[1] - plan.size[0])), started: false, ended: false }));
}
/** allowance: extra ms added to every ▶ timing window (the main game's monitor headphones, VOL07: 10). 0 = the club's house setup. */
export function createSet(set, rng = Math.random, { allowance = 0, grid = PHRASE, lead = LEAD } = {}) {
  const m = { set, count: set.count, grid: grid > 0 ? grid : PHRASE, lead: lead >= 0 ? lead : LEAD, allowance: Number.isFinite(allowance) && allowance > 0 ? Math.min(30, allowance) : 0, played: [set.tracks[0], set.tracks[1]], rng,
    decks: [makeDeck(set.tracks[0]), makeDeck(set.tracks[1], TRACKS[set.tracks[0]].bpm)],
    running: false, resumeDecks: [], mix: 0, master: 0, phase: 'idle', cue: null, select: null, transitions: [], floor: .5,
    lastPlay: null, lastUpdate: null, fader: null, result: null, pendingPick: null };
  return m;
}
function nextCue(m, from, now) {
  const beat = beatAt(m.decks[from], now), start = (Math.floor((beat + m.lead) / m.grid) + 1) * m.grid; // the next entry line at least `lead` beats away
  m.cue = { from, to: 1 - from, start, end: start + PHRASE, pressed: null, missed: 0 };
  m.phase = 'cue'; m.fader = null;
}
export const GRADE_FLOOR = { PERFECT: .06, GOOD: .03, OK: 0, EARLY: -.06, LATE: -.06 };
/** What a finished transition does to the floor, by its rank. */
export const RANK_FLOOR = { S: .06, A: .03, B: 0, C: -.06 };
/** One beat of the 8 bars on / off the guide line. Break-even is about 73 % on the line (the 85-point fader score starts at 75 %). */
export const FOLLOW_FLOOR = { hit: .003, miss: -.008 };
/** The crowd's mood from the floor meter: 0 帰りそう / 1 しらけ気味 / 2 様子見 / 3 ノってきた / 4 最高潮 (4 is also the +5 bonus line). */
export const MOODS = Object.freeze(['帰りそう', 'しらけ気味', '様子見', 'ノってきた', '最高潮']);
export const moodOf = floor => floor >= .8 ? 4 : floor >= .6 ? 3 : floor >= .4 ? 2 : floor >= .2 ? 1 : 0;
export function gradeOf(errorMs, allowance = 0) { const v = Math.abs(errorMs) - allowance; return v <= 30 ? 'PERFECT' : v <= 60 ? 'GOOD' : v <= 120 ? 'OK' : errorMs < 0 ? 'EARLY' : 'LATE'; }
/** ▶ on a deck. The incoming deck of an open cue starts quantized to the master's nearest beat; anything else starts at once. */
export function playDeck(m, id, now) {
  const d = m.decks[id];
  if (d.playing || !d.track) return false;
  const c = m.cue;
  if (c && c.to === id && m.decks[c.from].playing && !c.pressed) {
    const from = m.decks[c.from], fb = beatAt(from, now), n = Math.round(fb);
    // Judge against the nearest entry line: past the middle of the gap the player is aiming at the next one (a little early there is EARLY, not a huge LATE).
    if (fb - c.start > m.grid / 2) { c.start += m.grid; c.end += m.grid; c.missed++; }
    const errorMs = (fb - c.start) * 60 / from.bpm * 1000, grade = gradeOf(errorMs, m.allowance || 0);
    d.beat = 0; d.at = from.at + (n - from.beat) * 60 / from.bpm; // beat 0 on the master's nearest beat (may be a few ms ahead)
    c.pressed = { errorMs, grade, beat: n, at: now }; m.lastPlay = { id, errorMs, grade };
    m.phase = 'mix'; m.fader = { reached: null, checks: 0, hits: 0, combo: 0, best: 0, lastBeat: 0, last: null, inTime: 0, off: false, fixes: 0, drifts: planDrifts(m) };
    m.floor = clamp(m.floor + GRADE_FLOOR[grade], 0, 1);
  } else {
    anchor(d, now);
    if (!m.running) m.master = id;
  }
  d.playing = true; m.running = true; m.resumeDecks = m.resumeDecks.filter(n => n !== id);
  const other = m.decks[1 - id];
  if (!m.cue && !m.select && other.track && !other.playing) nextCue(m, id, now);
  return true;
}
/** 選曲: load the picked candidate on the empty deck and open the next cue. Returns { id, key, rating } or null. */
export function chooseTrack(m, index, now) {
  const s = m.select; if (!s || m.phase !== 'select') return null;
  const key = s.options[index]; if (!key) return null;
  const rating = pickRating(s.request, m.decks[m.master].track, key);
  m.decks[s.deck] = incomingDeck(m, key);
  m.played.push(key); m.pendingPick = { key, rating, request: s.request };
  m.floor = clamp(m.floor + PICK_FLOOR[rating], 0, 1);
  m.select = null; nextCue(m, m.master, now);
  return { id: s.deck, key, rating };
}
/** The platter (jog): push the incoming track along (+beats) or hold it back (−beats) while it is out of time during a mix.
 *  A turn that lands within SNAP_BAND, or passes through the beat, is caught by QUANTIZE: it snaps on and the room warms by a step.
 *  Turning the wrong way only takes it further out.
 *  In time already (nothing to fix), outside a mix, or the other deck: null and nothing moves. Returns { error, fixed }. */
export function nudgeDeck(m, id, beats, now) {
  const c = m.cue, f = m.fader;
  if (m.phase !== 'mix' || !c || !f || c.to !== id || !m.decks[id].playing || !Number.isFinite(beats) || !beats) return null;
  const from = m.decks[c.from], to = m.decks[id];
  if (beatAt(to, now) < 0 || Math.abs(phaseError(from, to, now)) <= SNAP_BAND) return null;
  const before = phaseError(from, to, now), landed = before + beats; // where the turn puts it, before wrapping to the nearest beat
  anchor(to, now, beatAt(to, now) + beats);
  const error = phaseError(from, to, now);
  // caught when it lands close, or when the turn carries it through the beat (no overshoot: the platter is forgiving, the hurry is the game)
  if (Math.abs(landed) > SNAP_BAND && before * landed > 0) return { error, fixed: false };
  anchor(to, now, beatAt(to, now) - error); f.off = false; f.fixes++; m.floor = clamp(m.floor + SYNC_FLOOR, 0, 1);
  for (const d of f.drifts) if (d.started && !d.ended) d.ended = true; // caught while it was still building: it stops there (one slip, one fix)
  to.bpm = from.bpm;
  return { error: 0, fixed: true };
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
/** One check on every beat of the 8 bars: is the fader on the guide line? Returns the newest result for the view. */
function followCheck(m, beatInMix, inTime = true) {
  const f = m.fader, upto = Math.min(PHRASE, Math.floor(beatInMix));
  let result = null;
  while (f.lastBeat < upto) {
    f.lastBeat++;
    const hit = Math.abs(toward(m) - guideAt(f.lastBeat / PHRASE)) <= FOLLOW_BAND;
    f.checks++; if (inTime) f.inTime++; else m.floor = clamp(m.floor + SLIP_FLOOR, 0, 1);
    if (hit) { f.hits++; f.combo++; f.best = Math.max(f.best, f.combo); m.floor = clamp(m.floor + FOLLOW_FLOOR.hit, 0, 1); }
    else { f.combo = 0; m.floor = clamp(m.floor + FOLLOW_FLOOR.miss, 0, 1); }
    f.last = result = { beat: f.lastBeat, hit, combo: f.combo };
  }
  return result;
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
/** The room drifts with how the mix sounds. A bad sound cools it at full speed; a good sound only warms it slowly (the steps above do the lifting). */
export const FLOOR_WARM = .15;
export function floorStep(m, q, dt) { const d = (q - .55) * dt * .06; m.floor = clamp(m.floor + (d > 0 ? d * FLOOR_WARM : d), 0, 1); }
/** Where the fader is against the guide line, for the arrows: 0 on it, 1 behind (move on toward the incoming deck), -1 ahead (come back). */
export const FOLLOW_SWEET = FOLLOW_BAND / 2;
export function followHint(m, guide) { const d = guide - toward(m); return Math.abs(d) <= FOLLOW_SWEET ? 0 : d > 0 ? 1 : -1; }
export const scoreFromErr = (v, s, a, b) => v <= s + 1e-10 ? 100 : v <= a + 1e-10 ? 85 : v <= b + 1e-10 ? 60 : 30;
export const scoreFromRatio = r => r >= .9 - 1e-10 ? 100 : r >= .75 - 1e-10 ? 85 : r >= .5 - 1e-10 ? 60 : 30;
/** The lowest total of each rank (the result card says how many points the next one is away, DJF07). */
export const RANK_LINES = Object.freeze({ S: 90, A: 75, B: 55 });
export const rankFromScore = total => total >= RANK_LINES.S ? 'S' : total >= RANK_LINES.A ? 'A' : total >= RANK_LINES.B ? 'B' : 'C';
/** Beat: how much of the 8 bars the two tracks were in time (1 when nothing slipped). Fader: how much of the 8 bars rode the guide line;
 *  never reaching the incoming deck caps it at 30, reaching it late at 60. */
export function scoreTransition({ sync = 1, playMs, reached, follow, allowance = 0 }) {
  const beat = scoreFromRatio(sync);
  const entry = scoreFromErr(playMs, 30 + allowance, 60 + allowance, 120 + allowance);
  const followScore = scoreFromRatio(follow);
  const fader = reached == null ? 30 : reached > 1 ? Math.min(60, followScore) : followScore;
  const total = Math.round((beat + entry + fader) / 3);
  return { sync, playMs, reached, follow, parts: [beat, entry, fader], total, rank: rankFromScore(total) };
}
/** The set: average of the transitions, plus a FLOOR bonus (≥80 % +5, <30 % −5). */
export function scoreSet(m) {
  const t = m.transitions; if (!t.length) return null;
  const base = Math.round(t.reduce((s, x) => s + x.total, 0) / t.length);
  const bonus = m.floor >= .8 ? 5 : m.floor < .3 ? -5 : 0, total = clamp(base + bonus, 0, 100);
  return { total, base, bonus, rank: rankFromScore(total), floor: Math.round(m.floor * 100), set: m.set.name,
    transitions: t.map(x => ({ from: x.from, to: x.to, grade: x.grade, parts: x.parts, total: x.total, rank: x.rank, pick: x.pick, combo: x.combo, drifts: x.drifts, fixes: x.fixes })) };
}
function finishTransition(m, now, view) {
  const c = m.cue, from = m.decks[c.from], to = m.decks[c.to], f = m.fader;
  const score = scoreTransition({ sync: f.checks ? f.inTime / f.checks : 1, playMs: Math.abs(c.pressed.errorMs), reached: f.reached, follow: f.checks ? f.hits / f.checks : 0, allowance: m.allowance || 0 });
  const record = { ...score, from: from.track, to: to.track, grade: c.pressed.grade, missed: c.missed, combo: f.best, pick: m.pendingPick?.rating || null, drifts: f.drifts.filter(d => d.started).length, fixes: f.fixes };
  if (to.bpm !== from.bpm) { anchor(to, now); to.bpm = from.bpm; view.retuned = c.to; } // a slip still building when the 8 bars end: the tempo goes back
  m.transitions.push(record); view.transition = record; m.pendingPick = null;
  m.floor = clamp(m.floor + RANK_FLOOR[score.rank], 0, 1);
  anchor(from, now); from.playing = false; view.stopped = c.from; m.master = c.to;
  from.track = null; m.cue = null; m.fader = null;
  if (m.played.length < m.count) {
    const options = candidates(m, to.track);
    m.phase = 'select'; m.select = { deck: c.from, options, request: requestFor(m, to.track, options) };
    view.select = { ...m.select };
  } else {
    m.phase = 'done'; m.result = scoreSet(m); view.finished = m.result;
  }
}
/** Advance the set to `now`. Returns what the host must apply to audio (snapped / stopped / select) and the view state. */
export function updateSet(m, now) {
  const dt = m.lastUpdate == null ? 0 : Math.max(0, now - m.lastUpdate); m.lastUpdate = now;
  const view = { mode: m.phase, progress: 0, remaining: 0, open: false, snapped: null, stopped: null, select: null, transition: null, finished: null, follow: null, guide: null, rolled: false, retuned: null, sync: null, slipped: false };
  if (!m.running) { view.mode = 'idle'; return view; }
  const c = m.cue;
  if (c) {
    const from = m.decks[c.from], to = m.decks[c.to], fb = beatAt(from, now);
    if (m.phase === 'cue') {
      while (fb >= c.start + m.grid) { c.start += m.grid; c.end += m.grid; c.missed++; view.rolled = true; }
      view.remaining = c.start - fb; view.open = fb >= c.start;
    } else if (m.phase === 'mix') {
      const progress = (fb - c.start) / PHRASE; view.progress = clamp(progress, 0, 1); view.remaining = c.end - fb;
      // ズレ (DJG): at its beat the incoming track runs a little fast or slow for DRIFT_BEATS beats (the host applies the rate: view.retuned),
      // then keeps its tempo but stays out of time until the player turns its platter back (nudgeDeck). QUANTIZE only catches a turn that lands close.
      const f = m.fader, into = fb - c.start;
      for (const d of f.drifts) {
        if (!d.started && into >= d.at && into < PHRASE - 2) { d.started = true; anchor(to, now); to.bpm = from.bpm * (1 + d.size / DRIFT_BEATS); view.retuned = c.to; }
        else if (d.started && !d.ended && into >= d.at + DRIFT_BEATS) { d.ended = true; anchor(to, now); to.bpm = from.bpm; view.retuned = c.to; }
      }
      const error = beatAt(to, now) >= 0 ? phaseError(from, to, now) : 0, off = Math.abs(error) > SYNC_BAND;
      if (off && !f.off) view.slipped = true;
      f.off = off; view.sync = { error, off, deck: c.to };
      view.follow = followCheck(m, into, !off);
      view.guide = guideAt(progress);
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
