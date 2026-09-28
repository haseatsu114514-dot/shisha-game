// 音。BGM は実ファイル（assets/audio/bgm）を優先し、まだ無い曲（大会など）は
// WebAudio で合成したループで代用する。SE はすべて合成（素材不要・軽い）。
import { config } from "./state.js";
import { bgmUrl } from "./data.js";

let ctx = null;
let master = null;
let seBus = null;
let bgmBus = null;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  seBus = ctx.createGain();
  seBus.gain.value = config.seVolume;
  seBus.connect(master);
  bgmBus = ctx.createGain();
  bgmBus.gain.value = config.bgmVolume;
  bgmBus.connect(master);
  return ctx;
}

/** 最初のユーザー操作で音を解禁する（ブラウザの自動再生制限） */
export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume();
  if (pendingBgm) { const k = pendingBgm; pendingBgm = null; playBgm(k); }
}

export function applyVolumes() {
  if (seBus) seBus.gain.value = config.seVolume;
  if (bgmBus) bgmBus.gain.value = config.bgmVolume;
  if (currentEl) currentEl.volume = config.bgmVolume;
}

// ---------------------------------------------------------------- SE（合成）

function tone({ freq = 440, to = null, type = "sine", dur = 0.12, vol = 0.25, delay = 0, attack = 0.005 }) {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(seBus);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise({ dur = 0.3, vol = 0.2, delay = 0, filter = 1200, q = 0.8, type = "bandpass", sweepTo = null }) {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime + delay;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(filter, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.04, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(seBus);
  src.start(t);
}

// キャラ別の文字送りボイス（低い=スミさん、高い=みんと 等）
const BLIP = {
  sumi: 250, naru: 420, adam: 330, minto: 1350, oneesan: 980, tsumugi: 1100, rin: 760,
  pakki: 900, nagumo: 280, maezono: 380, dr_kemuri: 520, salaryman: 360, ageha: 1200,
};

export const SE = {
  click: () => tone({ freq: 1200, to: 900, type: "triangle", dur: 0.05, vol: 0.12 }),
  select: () => { tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.18 }); tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.14, delay: 0.05 }); },
  cancel: () => tone({ freq: 500, to: 300, type: "triangle", dur: 0.12, vol: 0.15 }),
  error: () => { tone({ freq: 180, type: "square", dur: 0.12, vol: 0.1 }); tone({ freq: 150, type: "square", dur: 0.14, vol: 0.1, delay: 0.1 }); },
  blip: (speaker) => {
    if (!config.voiceBlip || !speaker) return tone({ freq: 1800, type: "sine", dur: 0.02, vol: 0.03 });
    const f = BLIP[speaker] || 600;
    tone({ freq: f * (0.95 + Math.random() * 0.1), type: speaker === "pakki" ? "square" : "triangle", dur: 0.045, vol: 0.06 });
  },
  pour: () => noise({ dur: 0.18, vol: 0.12, filter: 3000, q: 0.5, sweepTo: 1200 }),
  punch: () => { tone({ freq: 2400, to: 1400, type: "square", dur: 0.03, vol: 0.08 }); noise({ dur: 0.05, vol: 0.12, filter: 5000, type: "highpass" }); },
  perfect: () => { tone({ freq: 1320, type: "triangle", dur: 0.09, vol: 0.18 }); tone({ freq: 1760, type: "triangle", dur: 0.14, vol: 0.16, delay: 0.06 }); },
  good: () => tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.14 }),
  miss: () => tone({ freq: 220, to: 160, type: "sawtooth", dur: 0.16, vol: 0.08 }),
  just: () => { tone({ freq: 1568, type: "sine", dur: 0.3, vol: 0.2 }); tone({ freq: 2093, type: "sine", dur: 0.4, vol: 0.14, delay: 0.04 }); noise({ dur: 0.25, vol: 0.08, filter: 8000, type: "highpass" }); },
  crackle: () => { for (let i = 0; i < 4; i++) noise({ dur: 0.03, vol: 0.1, filter: 2500 + Math.random() * 3000, delay: Math.random() * 0.25, q: 2 }); },
  bubbling: () => { for (let i = 0; i < 6; i++) tone({ freq: 180 + Math.random() * 120, to: 90, type: "sine", dur: 0.09, vol: 0.12, delay: i * 0.09 + Math.random() * 0.04 }); },
  whoosh: () => noise({ dur: 0.7, vol: 0.14, filter: 400, q: 0.6, sweepTo: 2600 }),
  hit: () => { tone({ freq: 140, to: 60, type: "sine", dur: 0.2, vol: 0.3 }); noise({ dur: 0.12, vol: 0.12, filter: 900 }); },
  heartbeat: () => { tone({ freq: 70, to: 45, type: "sine", dur: 0.14, vol: 0.4 }); tone({ freq: 70, to: 45, type: "sine", dur: 0.12, vol: 0.3, delay: 0.2 }); },
  tick: () => tone({ freq: 2000, type: "square", dur: 0.02, vol: 0.05 }),
  count: () => { tone({ freq: 880, type: "square", dur: 0.08, vol: 0.12 }); tone({ freq: 440, type: "sine", dur: 0.25, vol: 0.12 }); },
  stamp: () => { tone({ freq: 90, to: 50, type: "sine", dur: 0.18, vol: 0.35 }); noise({ dur: 0.08, vol: 0.18, filter: 1200 }); },
  crowd: (sec = 2.2) => { noise({ dur: sec, vol: 0.16, filter: 700, q: 0.4 }); noise({ dur: sec * 0.8, vol: 0.08, filter: 1800, q: 0.6, delay: 0.2 }); },
  drumroll: (sec = 2) => { const n = Math.floor(sec * 22); for (let i = 0; i < n; i++) noise({ dur: 0.05, vol: 0.05 + (i / n) * 0.12, filter: 900, delay: i / 22 }); },
  // 1位確定の「プチュン」（ブラウン管が落ちる音）
  puchun: () => { tone({ freq: 4200, to: 60, type: "sine", dur: 0.35, vol: 0.28 }); noise({ dur: 0.1, vol: 0.2, filter: 6000, type: "highpass" }); },
  // 敗北の「パリン」
  parin: () => {
    for (let i = 0; i < 9; i++) tone({ freq: 2500 + Math.random() * 3500, type: "triangle", dur: 0.12 + Math.random() * 0.2, vol: 0.08, delay: Math.random() * 0.12 });
    noise({ dur: 0.35, vol: 0.2, filter: 6000, type: "highpass" });
  },
  crack: () => { noise({ dur: 0.08, vol: 0.25, filter: 3000 }); tone({ freq: 300, to: 80, type: "square", dur: 0.12, vol: 0.12 }); },
  jingle: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: "triangle", dur: 0.22, vol: 0.14, delay: i * 0.09 })),
  fanfare: () => {
    [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.56], [1047, 0.68]].forEach(([f, d]) => tone({ freq: f, type: "square", dur: 0.2, vol: 0.09, delay: d }));
    tone({ freq: 1047, type: "triangle", dur: 1.2, vol: 0.12, delay: 0.8 });
  },
  money: () => { tone({ freq: 1500, type: "triangle", dur: 0.06, vol: 0.1 }); tone({ freq: 2000, type: "triangle", dur: 0.12, vol: 0.1, delay: 0.06 }); },
  phone: () => { tone({ freq: 1320, type: "sine", dur: 0.08, vol: 0.14 }); tone({ freq: 1760, type: "sine", dur: 0.12, vol: 0.14, delay: 0.1 }); },
  doorbell: () => { tone({ freq: 1568, type: "sine", dur: 0.6, vol: 0.12 }); tone({ freq: 1245, type: "sine", dur: 0.8, vol: 0.1, delay: 0.25 }); },
  coalSnip: () => { noise({ dur: 0.04, vol: 0.2, filter: 4000 }); tone({ freq: 700, to: 200, type: "square", dur: 0.05, vol: 0.05 }); },
  // MOKUMOKUパッキー（日常スロット）
  reelLever: () => { noise({ dur: 0.05, vol: 0.18, filter: 1800 }); tone({ freq: 220, to: 120, type: "square", dur: 0.06, vol: 0.06 }); },
  reelStop: () => { tone({ freq: 520, to: 300, type: "square", dur: 0.04, vol: 0.07 }); noise({ dur: 0.03, vol: 0.1, filter: 2600 }); },
  reelWin: () => { tone({ freq: 1175, type: "triangle", dur: 0.08, vol: 0.12 }); tone({ freq: 1568, type: "triangle", dur: 0.12, vol: 0.1, delay: 0.07 }); },
  puka: () => { tone({ freq: 880, to: 1760, type: "sine", dur: 0.16, vol: 0.2 }); tone({ freq: 1760, type: "sine", dur: 0.28, vol: 0.12, delay: 0.14 }); },
  pugo: () => { tone({ freq: 140, to: 70, type: "sine", dur: 0.22, vol: 0.3 }); noise({ dur: 0.08, vol: 0.12, filter: 500 }); },
  glitch: () => { for (let i = 0; i < 8; i++) tone({ freq: 200 + Math.random() * 2400, type: "square", dur: 0.03, vol: 0.05, delay: i * 0.05 }); },
  freezeBoom: () => { tone({ freq: 60, to: 30, type: "sine", dur: 0.6, vol: 0.4 }); noise({ dur: 0.5, vol: 0.2, filter: 700, sweepTo: 3000 }); },
};

export function playSe(id, ...args) {
  const key = String(id || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  (SE[key] || SE[id] || (() => {}))(...args);
}

// ---------------------------------------------------------------- BGM

let currentKey = null;
let currentEl = null;
let synthStop = null;
let pendingBgm = null;

// 実ファイルが無い曲の代用: key → 合成パターン
const SYNTH_FALLBACK = {
  bgm_tournament_edm: "battle",
  bgm_tournament_wait: "tension",
  bgm_result_emotional: "calm",
  bgm_map: "calm",
  bgm_rival_shop: "calm",
};

export function playBgm(key) {
  if (key === currentKey) return;
  stopBgm(0.6);
  currentKey = key;
  if (!key) return;
  const c = ensureCtx();
  if (!c || c.state === "suspended") { pendingBgm = key; currentKey = null; return; }
  const url = bgmUrl(key);
  if (url) {
    const a = new Audio(url);
    a.loop = true;
    a.volume = 0;
    a.play().catch(() => { pendingBgm = key; currentKey = null; });
    currentEl = a;
    fadeEl(a, config.bgmVolume, 1200);
  } else if (SYNTH_FALLBACK[key]) {
    synthStop = startSynth(SYNTH_FALLBACK[key]);
  }
}

export function stopBgm(fadeSec = 0.8) {
  currentKey = null;
  if (currentEl) {
    const a = currentEl;
    currentEl = null;
    fadeEl(a, 0, fadeSec * 1000).then(() => a.pause());
  }
  if (synthStop) { synthStop(fadeSec); synthStop = null; }
}

function fadeEl(a, to, ms) {
  return new Promise((res) => {
    const from = a.volume;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    step();
  });
}

// 合成BGM: 小さなステップシーケンサ。battle=四つ打ち＋ベースのアルペジオ（大会の熱）、
// tension=心音のようなキックとパッド（控室）、calm=柔らかいパッド
function startSynth(kind) {
  const c = ensureCtx();
  const out = c.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(1, c.currentTime + 1.2);
  out.connect(bgmBus);
  const bpm = kind === "battle" ? 124 : kind === "tension" ? 80 : 68;
  const stepDur = 60 / bpm / 4;
  const bass = kind === "battle" ? [45, 45, 57, 45, 48, 48, 60, 48, 43, 43, 55, 43, 41, 41, 53, 52] : [45, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0;
  let next = c.currentTime + 0.05;
  let alive = true;

  const voice = (freq, t, dur, type, vol) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const kick = (t, vol) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.3);
  };
  const hat = (t, vol) => {
    const len = Math.floor(c.sampleRate * 0.04);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = c.createBufferSource();
    s.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = 7000;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(out);
    s.start(t);
  };

  const schedule = () => {
    if (!alive) return;
    while (next < c.currentTime + 0.25) {
      const s = step % 16;
      if (kind === "battle") {
        if (s % 4 === 0) kick(next, 0.5);
        if (s % 4 === 2) hat(next, 0.12);
        if (s % 2 === 1) hat(next, 0.05);
        const n = bass[s];
        if (n) voice(mtof(n), next, stepDur * 0.9, "sawtooth", 0.07);
        if (s === 0 && step % 64 === 0) [69, 72, 76].forEach((m) => voice(mtof(m), next, stepDur * 14, "triangle", 0.03));
      } else if (kind === "tension") {
        if (s === 0 || s === 3) kick(next, s === 0 ? 0.35 : 0.22);
        if (s === 0 && step % 32 === 0) [57, 60, 64].forEach((m) => voice(mtof(m), next, stepDur * 30, "sine", 0.025));
        if (s % 4 === 2) hat(next, 0.03);
      } else {
        if (s === 0 && step % 32 === 0) [bass[(step / 16) % 16] || 45, 57, 64, 67].forEach((m) => voice(mtof(m + 12), next, stepDur * 30, "sine", 0.02));
      }
      next += stepDur;
      step++;
    }
    setTimeout(schedule, 60);
  };
  schedule();
  return (fadeSec = 0.8) => {
    alive = false;
    out.gain.cancelScheduledValues(c.currentTime);
    out.gain.setValueAtTime(out.gain.value, c.currentTime);
    out.gain.linearRampToValueAtTime(0, c.currentTime + fadeSec);
    setTimeout(() => out.disconnect(), fadeSec * 1000 + 200);
  };
}
