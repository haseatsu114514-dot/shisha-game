export const PHRASE = 32;
export const mod = (v, n) => ((v % n) + n) % n;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const beatAt = (d, now) => d.beat + (d.playing ? (now - d.at) * d.bpm / 60 : 0);
export function anchor(d, now, beat = beatAt(d, now)) { d.beat = beat; d.at = now; }
export function setTempo(d, bpm, now) { anchor(d, now); d.bpm = clamp(Number(bpm), 110, 140); }
export function phaseError(a, b, now) { return mod(beatAt(b, now) - beatAt(a, now) + .5, 1) - .5; }
export function phraseError(a, b, now) { return mod(beatAt(b, now) - beatAt(a, now) + 16, 32) - 16; }
export function gains(x) { x = clamp(x, 0, 1); return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)]; }
export function createMix() {
  return { decks: [128, 126].map(bpm => ({ nativeBpm: bpm, bpm, beat: 0, at: 0, playing: false })),
    running: false, resumeDecks: [], mix: 0, master: 0, visualMaster: 0, guide: null };
}
export function guideNext(m, now) {
  const from = m.master;
  if (!m.decks[from].playing) { m.guide = null; return; }
  const start = (Math.floor((beatAt(m.decks[from], now) + 1e-6) / PHRASE) + 1) * PHRASE;
  m.guide = { from, to: 1 - from, start, end: start + PHRASE };
}
export function playDeck(m, id, now) {
  const d = m.decks[id];
  if (d.playing) return false;
  const wasRunning = m.running;
  anchor(d, now); d.playing = true; m.running = true;
  m.resumeDecks = m.resumeDecks.filter(n => n !== id);
  if (!wasRunning) { m.master = id; m.visualMaster = id; }
  if (!m.guide || !m.decks[m.guide.from].playing) guideNext(m, now);
  return true;
}
export function pauseDeck(m, id, now) {
  const d = m.decks[id]; anchor(d, now); d.playing = false;
  m.resumeDecks = m.resumeDecks.filter(n => n !== id);
  m.running = m.decks.some(deck => deck.playing);
}
export function resumeMix(m, now) {
  const ids = [...m.resumeDecks]; m.resumeDecks = [];
  // Resume only decks explicitly playing before a whole-transport pause.
  for (const id of ids) { anchor(m.decks[id], now); m.decks[id].playing = true; }
  m.running = m.decks.some(d => d.playing);
  if (m.running && (!m.guide || !m.decks[m.guide.from].playing)) {
    if (!m.decks[m.master].playing) m.master = ids[0];
    guideNext(m, now);
  }
}
export function pauseMix(m, now) {
  const ids = m.decks.flatMap((d, id) => d.playing ? [id] : []);
  if (ids.length) m.resumeDecks = ids;
  for (const d of m.decks) { anchor(d, now); d.playing = false; }
  m.running = false;
}
export function nudgeDeck(m, id, beats, now) {
  const d = m.decks[id]; if (!d.playing) return false;
  anchor(d, now, beatAt(d, now) + beats); return true;
}
export function updateMix(m, now) {
  const active = m.decks.flatMap((d, id) => d.playing ? [id] : []);
  if (!active.length) return { mode: 'idle', progress: 0 };
  if (active.length === 1) m.visualMaster = active[0];
  else { if (m.mix > .6) m.visualMaster = 1; if (m.mix < .4) m.visualMaster = 0; }
  if (!m.guide || !m.decks[m.guide.from].playing) { m.master = m.visualMaster; guideNext(m, now); }
  let g = m.guide, beat = beatAt(m.decks[g.from], now);
  if (beat >= g.end) {
    // A guide never starts, seeks or changes the tempo of an incoming deck.
    if (!m.decks[g.to].playing) {
      g = m.guide = { ...g, start: Math.floor(beat / PHRASE) * PHRASE, end: (Math.floor(beat / PHRASE) + 1) * PHRASE };
    } else {
      m.master = m.visualMaster; guideNext(m, now); g = m.guide; beat = beatAt(m.decks[g.from], now);
    }
  }
  if (beat < g.start) return { mode: 'entry', remaining: g.start - beat, progress: 0 };
  if (!m.decks[g.to].playing) return { mode: 'waiting-play', elapsed: beat - g.start, remaining: g.end - beat, progress: 0 };
  return { mode: 'mix', progress: Math.min(1, (beat - g.start) / PHRASE) };
}
export function dancerPose(beat, reduced = false) {
  const phase = mod(beat, 4) / 4 * Math.PI * 2;
  return { hip: Math.sin(phase) * (reduced ? 0 : 3), bob: reduced ? 0 : (1 - Math.cos(phase * 2)) * 1.5,
    left: reduced ? 0 : Math.max(0, Math.sin(phase)) * 4, right: reduced ? 0 : Math.max(0, -Math.sin(phase)) * 4,
    arm: reduced ? 0 : Math.sin(phase) * 3 };
}
