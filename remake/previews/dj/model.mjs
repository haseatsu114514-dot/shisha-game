import { TRACKS } from './tracks.mjs';
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
  if (m.guide?.to === id && m.decks[m.guide.from].playing) {
    const beat=beatAt(m.decks[m.guide.from],now);
    const errorMs=(beat-Math.round(beat))*60/m.decks[m.guide.from].bpm*1000;
    const v=Math.abs(errorMs);
    m.lastPlay={id,errorMs,grade:v<=30?'PERFECT':v<=60?'GOOD':v<=120?'OK':errorMs<0?'EARLY':'LATE'};
  }
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

export function createStageMix(stage, detuneFactor=1) {
 const m=createMix();m.decks=[stage.a,stage.b].map((key,id)=>{const nativeBpm=TRACKS[key].bpm;return {nativeBpm,bpm:Math.round(nativeBpm*(id?detuneFactor:1)*100)/100,beat:0,at:0,playing:false};});return m;
}
export const scoreFromErr=(v,s,a,b)=>v<=s+1e-10?100:v<=a+1e-10?85:v<=b+1e-10?60:30;
export const rankFromScore=total=>total>=90?'S':total>=75?'A':total>=55?'B':'C';
export function scoreMix(m,now) {
 if(!m.lastPlay)return null;
 const [a,b]=m.decks,pitchErrPct=Math.abs(b.bpm-a.bpm)/a.bpm*100,playMs=Math.abs(m.lastPlay.errorMs),driftMs=Math.abs(phaseError(a,b,now))*60/a.bpm*1000;
 const parts=[scoreFromErr(pitchErrPct,.10,.25,.50),scoreFromErr(playMs,30,60,120),scoreFromErr(driftMs,25,50,100)],total=Math.round(parts.reduce((a,b)=>a+b,0)/3);
 return {pitchErrPct,playMs,driftMs,parts,total,rank:rankFromScore(total)};
}
