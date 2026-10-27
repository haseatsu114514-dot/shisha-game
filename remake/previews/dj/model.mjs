export const PHRASE = 32; // 4/4 × 8小節
export const mod = (v, n) => ((v % n) + n) % n;
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const beatAt = (deck, now) => deck.beat + (deck.playing ? (now - deck.at) * deck.bpm / 60 : 0);
export function anchor(deck, now, beat = beatAt(deck, now)) { deck.beat = beat; deck.at = now; }
export function setTempo(deck, bpm, now) { anchor(deck, now); deck.bpm = clamp(Number(bpm), 110, 140); }
export function phaseError(a, b, now) { return mod(beatAt(b, now) - beatAt(a, now) + .5, 1) - .5; }
export function gains(x) { x = clamp(x, 0, 1); return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)]; }
export function createMix() {
  return { decks: [128, 126].map(bpm => ({ nativeBpm: bpm, bpm, beat: 0, at: 0, playing: false })),
    running: false, mix: 0, master: 0, visualMaster: 0, assist: true, transition: null, last: null };
}
export function startMix(m, now) {
  for (const d of m.decks) { anchor(d, now); d.playing = true; }
  m.running = true;
  if (!m.transition) queueMix(m, now);
}
export function pauseMix(m, now) {
  for (const d of m.decks) { anchor(d, now); d.playing = false; }
  m.running = false;
}
export function syncDeck(m, target, now) {
  const source = m.decks[1 - target], deck = m.decks[target];
  deck.bpm = source.bpm; anchor(deck, now, beatAt(source, now));
}
export function nudgeDeck(m, id, beats, now) { const d = m.decks[id]; anchor(d, now, beatAt(d, now) + beats); }
export function queueMix(m, now) {
  if (m.transition) return false;
  const from = m.master, to = 1 - from;
  if (m.assist) syncDeck(m, to, now);
  const start = (Math.floor((beatAt(m.decks[from], now) + 1e-6) / PHRASE) + 1) * PHRASE;
  m.transition = { from, to, start, end: start + PHRASE };
  return true;
}
export function updateMix(m, now) {
  if (m.mix > .6) m.visualMaster = 1;
  if (m.mix < .4) m.visualMaster = 0;
  const t = m.transition;
  if (!t) return { mode: 'idle', progress: 0 };
  const beat = beatAt(m.decks[t.from], now);
  if (beat < t.start) return { mode: 'queued', remaining: t.start - beat, progress: 0 };
  if (beat < t.end) return { mode: 'mix', progress: (beat - t.start) / PHRASE };
  const reached = t.to === 1 ? m.mix >= .9 : m.mix <= .1;
  m.last = { ...t, reached };
  m.master = m.mix >= .5 ? 1 : 0;
  m.transition = null;
  if (m.running) queueMix(m, now);
  return { mode: 'finished', progress: 1, reached };
}
// 足は交互に接地し、4拍周期の両端は同じ姿勢。描画frame数に依存しない。
export function dancerPose(beat, reduced = false) {
  const phase = mod(beat, 4) / 4 * Math.PI * 2;
  return { hip: Math.sin(phase) * (reduced ? 0 : 3),
    bob: reduced ? 0 : (1 - Math.cos(phase * 2)) * 1.5,
    left: reduced ? 0 : Math.max(0, Math.sin(phase)) * 4,
    right: reduced ? 0 : Math.max(0, -Math.sin(phase)) * 4,
    arm: reduced ? 0 : Math.sin(phase) * 3 };
}
