// 音。BGM は実ファイル（assets/audio/bgm）を優先し、まだ無い曲（大会など）は
// WebAudio で合成したループで代用する。SE はすべて合成（素材不要・軽い）。
import { config } from "./state.js";
import { bgmUrl } from "./data.js";

let ctx = null;
let master = null;
let seBus = null;
let bgmBus = null;
let audioUnlocked = false;
let rainMode = null;
let rainLoop = null;
let rainBuffer = null;
let bgmDuck = 1;
let bgmPaused = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.connect(ctx.destination);
  seBus = ctx.createGain();
  seBus.gain.value = config.mute || config.muted ? 0 : config.seVolume;
  seBus.connect(master);
  bgmBus = ctx.createGain();
  bgmBus.gain.value = config.mute || config.muted || bgmPaused ? 0 : config.bgmVolume * bgmDuck;
  bgmBus.connect(master);
  return ctx;
}

/** 最初のユーザー操作で音を解禁する（ブラウザの自動再生制限） */
export function unlockAudio() {
  audioUnlocked = true;
  const c = ensureCtx();
  if (c && c.state === "suspended") c.resume().then(syncRain, () => {});
  else syncRain();
  if (pendingBgm) { const k = pendingBgm; pendingBgm = null; playBgm(k); }
}

export function applyVolumes() {
  const muted = config.mute || config.muted;
  if (seBus) seBus.gain.value = muted ? 0 : config.seVolume;
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = muted || bgmPaused ? 0 : config.bgmVolume * bgmDuck;
  if (currentEl) currentEl.volume = bgmLevel(currentKey);
  syncRain();
}

// 雨はユーザー操作で解放された既存の AudioContext / 効果音バスだけを使う。
export function setRainAmbience(mode = null) {
  rainMode = mode === "outdoor" || mode === "indoor" ? mode : null;
  syncRain();
}

function stopRain() {
  if (!rainLoop) return;
  rainLoop.gain.gain.setValueAtTime(0, ctx.currentTime);
  rainLoop.source.stop();
  rainLoop.source.disconnect();
  rainLoop.filter.disconnect();
  rainLoop.gain.disconnect();
  rainLoop = null;
}

function syncRain() {
  if (!rainMode || !audioUnlocked || !ctx || ctx.state !== "running"
    || !(Number(config.seVolume) > 0) || config.mute || config.muted || document.hidden) {
    stopRain();
    return;
  }
  if (!rainLoop) {
    if (!rainBuffer) {
      rainBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 3), ctx.sampleRate);
      const samples = rainBuffer.getChannelData(0);
      let low = 0;
      for (let i = 0; i < samples.length; i++) {
        const white = Math.random() * 2 - 1;
        low = (low + white * 0.025) / 1.025;
        samples[i] = white * 0.22 + low * 2.4;
      }
    }
    const source = ctx.createBufferSource();
    source.buffer = rainBuffer;
    source.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 0.35;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(seBus);
    source.start();
    rainLoop = { source, filter, gain };
  }
  const outside = rainMode === "outdoor";
  rainLoop.filter.frequency.setTargetAtTime(outside ? 1800 : 650, ctx.currentTime, 0.18);
  rainLoop.gain.gain.setTargetAtTime(outside ? 0.055 : 0.018, ctx.currentTime, 0.2);
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

/** 吸っている間だけ、水の低いぼこぼこ音を鳴らす。戻り値で次の泡を止める。 */
export function startBubbling({ strength = 1 } = {}) {
  let stopped = false;
  const bubble = () => {
    if (stopped || !audioUnlocked || !ctx || ctx.state !== "running" || document.hidden || !(Number(config.seVolume) > 0)) return;
    const force = Math.max(.3, Math.min(1, strength));
    const freq = 95 + Math.random() * 95;
    tone({ freq, to: Math.max(35, freq * .42), dur: .075 + Math.random() * .045, vol: .09 * force });
    noise({ dur: .055, filter: 350 + Math.random() * 300, q: 1.4, vol: .025 * force });
  };
  bubble();
  const timer = setInterval(bubble, 85);
  return () => { if (stopped) return; stopped = true; clearInterval(timer); };
}

// キャラ別の文字送りボイス（低い=スミさん、高い=みんと 等）
const BLIP = {
  sumi: 250, naru: 420, adam: 330, minto: 1350, oneesan: 980, tsumugi: 1100, rin: 760,
  pakki: 900, nagumo: 280, maezono: 380, dr_kemuri: 520, salaryman: 360, ageha: 1200,
  mashiro: 880, kafuka: 1250,
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
  // 能力ボーナスの通知に合わせた短い上昇音。通常の通知音より控えめにする。
  slotBonus: () => [784, 1175, 1568].forEach((freq, i) => tone({ freq, type: "triangle", dur: i === 2 ? 0.18 : 0.1, vol: 0.08, delay: i * 0.07 })),
  puka: () => { tone({ freq: 880, to: 1760, type: "sine", dur: 0.16, vol: 0.2 }); tone({ freq: 1760, type: "sine", dur: 0.28, vol: 0.12, delay: 0.14 }); },
  pugo: () => { tone({ freq: 140, to: 70, type: "sine", dur: 0.22, vol: 0.3 }); noise({ dur: 0.08, vol: 0.12, filter: 500 }); },
  glitch: () => { for (let i = 0; i < 8; i++) tone({ freq: 200 + Math.random() * 2400, type: "square", dur: 0.03, vol: 0.05, delay: i * 0.05 }); },
  // 温度計の一番上で一台が爆発して焦げる（TH06）。低い破裂と崩れる火の粉。
  burst: () => { tone({ freq: 90, to: 26, type: "sine", dur: 1.1, vol: 0.45 }); noise({ dur: 1, vol: 0.3, filter: 1800, sweepTo: 220 }); noise({ dur: 0.22, vol: 0.2, filter: 6000, type: "highpass" }); for (let i = 0; i < 6; i++) noise({ dur: 0.04, vol: 0.12, filter: 2000 + Math.random() * 3000, delay: 0.25 + Math.random() * 0.6, q: 2 }); },
  freezeBoom: () => { tone({ freq: 60, to: 30, type: "sine", dur: 0.6, vol: 0.4 }); noise({ dur: 0.5, vol: 0.2, filter: 700, sweepTo: 3000 }); },
};

export function playSe(id, ...args) {
  const key = String(id || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  (SE[key] || SE[id] || (() => {}))(...args);
}

/** CONTINUE専用SE。既存AudioContext/設定を共有し、離脱時は予約済みの音も止める。 */
export function createContinueAudio({ enabled = true } = {}) {
  let alive = true, output = null, restore = 0, holdMix = 1;
  const voices = new Set();
  const ownsMusic = () => currentKey === "bgm_continue_urgent" || pendingBgm === "bgm_continue_urgent";
  function instrument() {
    const c = ensureCtx();
    if (!alive || !enabled || !c || c.state !== "running" || document.hidden
      || config.mute || config.muted || !(config.seVolume > 0)) return null;
    if (!output) { output = c.createGain(); output.connect(seBus); }
    return c;
  }
  function track(source, gain, filter = null) {
    voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); gain.disconnect(); filter?.disconnect(); };
  }
  function note(freq, { to = freq, dur = .09, vol = .15, delay = 0, type = "sine" } = {}) {
    const c = instrument();
    if (!c) return;
    const t = c.currentTime + delay, source = c.createOscillator(), gain = c.createGain();
    source.type = type;
    source.frequency.setValueAtTime(freq, t);
    source.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(vol, t + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, t + dur);
    source.connect(gain).connect(output); track(source, gain);
    source.start(t); source.stop(t + dur + .015);
  }
  function air(dur = .2, vol = .05, frequency = 800) {
    const c = instrument();
    if (!c) return;
    const source = c.createBufferSource(), gain = c.createGain(), filter = c.createBiquadFilter();
    const buffer = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    source.buffer = buffer; filter.type = "bandpass"; filter.frequency.value = frequency;
    gain.gain.setValueAtTime(vol, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, c.currentTime + dur);
    source.connect(filter).connect(gain).connect(output); track(source, gain, filter);
    source.start(); source.stop(c.currentTime + dur);
  }
  function mix(level, ms = 80) {
    if (!alive || !ownsMusic()) return;
    bgmDuck = level;
    if (currentEl) fadeEl(currentEl, () => bgmLevel("bgm_continue_urgent"), ms);
    if (bgmBus) {
      bgmBus.gain.cancelScheduledValues?.(ctx.currentTime);
      const target = config.mute || config.muted || bgmPaused ? 0 : config.bgmVolume * level;
      if (bgmBus.gain.setTargetAtTime) bgmBus.gain.setTargetAtTime(target, ctx.currentTime, Math.max(.01, ms / 3000));
      else bgmBus.gain.value = target;
    }
  }
  function pulse(fn) {
    if (!alive || !enabled || document.hidden || config.mute || config.muted || !(config.seVolume > 0)) return;
    if (!instrument()) return;
    fn(); mix(.8);
    clearTimeout(restore);
    restore = window.setTimeout(() => mix(holdMix, 140), 210);
  }
  function silence() {
    for (const source of voices) { try { source.stop(); } catch { /* 終了済み */ } }
    voices.clear();
  }
  return {
    start() { if (!alive) return; playBgm("bgm_continue_urgent"); pulse(() => { note(85, { to: 32, dur: .28, vol: .32 }); air(.26, .06, 650); }); },
    title() { pulse(() => { note(830, { to: 380, dur: .12, type: "triangle", vol: .09 }); note(1220, { dur: .07, vol: .035 }); }); },
    beat() { pulse(() => note(105, { to: 65, dur: .08, vol: .15 })); },
    // 日常の会話と同じ文字送りの声。BGMは下げず、離脱時は他のSEと一緒に止める。
    voice(speaker) {
      if (!instrument()) return;
      if (!config.voiceBlip) return note(1800, { dur: .02, vol: .03 });
      const f = (BLIP[speaker] || 600) * (.95 + Math.random() * .1);
      note(f, { dur: .045, vol: .06, type: "triangle" });
    },
    count(remaining) {
      pulse(() => remaining === 0 ? note(70, { to: 45, dur: .2, vol: .22 })
        : note([990, 870, 780, 700, 620][remaining - 1], { dur: .07, vol: .13, type: "triangle" }));
    },
    choose(choice, effect) {
      holdMix = .5;
      clearTimeout(restore); silence(); mix(holdMix, 120);
      if (choice === "retry") [523, 659, 784, 1047].forEach((f, i) => note(f, { dur: .15, delay: i * .075, type: "triangle", vol: .1 }));
      else { note(440, { dur: .15, vol: .08, type: "triangle" }); note(330, { dur: .2, delay: .13, vol: .07, type: "triangle" }); }
      if (effect === "pencil" || effect === "canvas") air(.18, .025, 2600);
      if (effect === "scan") note(choice === "retry" ? 600 : 800, { to: choice === "retry" ? 1500 : 250, dur: .3, vol: .025 });
      if (effect === "shark") note(220, { to: 440, dur: .12, vol: .045, delay: .2 });
    },
    expire() { holdMix = .1; clearTimeout(restore); mix(holdMix, 350); },
    setEnabled(value) { enabled = !!value; if (!enabled) { silence(); clearTimeout(restore); mix(holdMix); } },
    pause() {
      if (!alive || !ownsMusic()) return;
      silence(); clearTimeout(restore);
      bgmPaused = true; currentEl?.pause(); mix(holdMix);
    },
    resume() {
      if (!alive || !ownsMusic()) return;
      bgmPaused = false;
      if (currentEl) currentEl.play().catch(() => {});
      mix(holdMix);
    },
    cleanup() {
      if (!alive) return;
      clearTimeout(restore); silence(); output?.disconnect();
      if (ownsMusic()) stopBgm(.2);
      alive = false;
    },
  };
}

// ---------------------------------------------------------------- BGM

let currentKey = null;
let currentEl = null;
let synthStop = null;
let pendingBgm = null;

// 実ファイルが無い曲の代用: key → 合成パターン
const SYNTH_FALLBACK = {
  bgm_tournament_edm: "battle",
  bgm_tournament_craft: "battle",
  bgm_tournament_wait: "tension",
  bgm_continue_urgent: "panic", // スミさんのコンティニュー: 原曲差替えまでは専用緊迫ループ
  bgm_result_emotional: "calm",
  bgm_map: "calm",
  bgm_rival_shop: "calm",
};

/** 今鳴っている曲のキー（自動再生待ちの間は null） */
export const currentBgm = () => currentKey;

// 新規大会曲は約 -14 LUFS にそろえる。設定変更・フェード中も曲ごとの倍率を保つ。
const BGM_GAIN = { sweets_or_sweets: 0.55, bgm_tournament_edm: 0.51, bgm_tournament_craft: 0.67, bgm_continue_urgent: 0.68 };
const bgmLevel = (key) => config.mute || config.muted || bgmPaused ? 0
  : config.bgmVolume * (BGM_GAIN[key] ?? 1) * bgmDuck;

// 単体MP3の再配布を避けるゲーム専用形式（pack_bgm.py と対応）。HTTPS/localhostで復元する。
const PACKED_MAGIC = "SUIENBGM1";
const PACKED_KEY = "ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2";
const packedSources = new Map();
let packedCryptoKey = null;

function bgmSource(url) {
  if (!url.endsWith(".bgm")) return Promise.resolve(url);
  if (!packedSources.has(url)) {
    const source = (async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`BGM HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      const header = bytes.subarray(0, PACKED_MAGIC.length);
      if (bytes.length < PACKED_MAGIC.length + 12 + 16 || new TextDecoder().decode(header) !== PACKED_MAGIC) {
        throw new Error("Invalid game BGM format");
      }
      packedCryptoKey ??= crypto.subtle.importKey("raw",
        Uint8Array.from(PACKED_KEY.match(/../g), (hex) => parseInt(hex, 16)), "AES-GCM", false, ["decrypt"]);
      const audio = await crypto.subtle.decrypt({ name: "AES-GCM",
        iv: bytes.subarray(PACKED_MAGIC.length, PACKED_MAGIC.length + 12), additionalData: header },
      await packedCryptoKey, bytes.subarray(PACKED_MAGIC.length + 12));
      return URL.createObjectURL(new Blob([audio], { type: "audio/mpeg" }));
    })();
    packedSources.set(url, source);
    source.catch(() => { packedSources.delete(url); }); // 一時的な取得失敗は次回に再試行できる。
  }
  return packedSources.get(url);
}

// 外部MP3のCONTINUE曲も、URLの解決だけでなく再生可能なところまで準備する。
// 演出開始時はこの要素を受け取り、遅い回線では専用の合成曲へ切り替える。
let preparedContinue = null;
function prepareContinueBgm(url) {
  if (preparedContinue?.url === url) return preparedContinue.ready;
  const audio = new Audio(url);
  audio.preload = "auto";
  const prepared = { url, audio, ready: null };
  prepared.ready = new Promise(resolve => {
    let timer;
    const finish = loaded => {
      clearTimeout(timer);
      audio.removeEventListener("canplay", loadedTrack);
      audio.removeEventListener("error", failedTrack);
      resolve(loaded);
    };
    const loadedTrack = () => finish(true), failedTrack = () => finish(false);
    audio.addEventListener("canplay", loadedTrack, { once: true });
    audio.addEventListener("error", failedTrack, { once: true });
    timer = setTimeout(failedTrack, 2000);
    audio.load();
    if (audio.readyState >= 3) loadedTrack();
  });
  preparedContinue = prepared;
  return prepared.ready;
}

/** 大会到着中に先読み。取得失敗で進行を止めない。 */
export function preloadBgm(key) {
  const url = bgmUrl(key);
  if (key === "bgm_continue_urgent" && url && !url.endsWith(".bgm")) return prepareContinueBgm(url);
  return url ? bgmSource(url).then(() => true, () => false) : Promise.resolve(false);
}

export function playBgm(key) {
  if (key === currentKey) return;
  stopBgm(0.6);
  currentKey = key;
  if (!key) return;
  const c = ensureCtx();
  if (!c || c.state === "suspended") { pendingBgm = key; currentKey = null; return; }
  const url = bgmUrl(key);
  if (url) {
    const packed = url.endsWith(".bgm");
    const prepared = key === "bgm_continue_urgent" && preparedContinue?.url === url ? preparedContinue : null;
    if (prepared) preparedContinue = null;
    if (prepared && prepared.audio.readyState < 3) {
      prepared.audio.removeAttribute("src"); prepared.audio.load();
      synthStop = startSynth(SYNTH_FALLBACK[key]);
      return; // 外部曲を待っている間に、20秒のカウントだけ進ませない。
    }
    const a = prepared?.audio || (packed ? new Audio() : new Audio(url));
    a.loop = true;
    a.volume = 0;
    if (key === "bgm_continue_urgent") {
      a.playbackRate = 1.08; // EMGコール(BPM115)を少しだけ高速化
      a.preservesPitch = true;
    }
    currentEl = a;
    const fallBackContinue = () => {
      if (currentEl !== a || key !== "bgm_continue_urgent") return false;
      currentEl = null;
      a.pause();
      if (SYNTH_FALLBACK[key]) synthStop = startSynth(SYNTH_FALLBACK[key]);
      return true;
    };
    a.addEventListener("error", fallBackContinue, { once: true });
    const start = () => {
      if (currentEl !== a) return; // 読み込み中に別曲へ移った場合、古い曲を鳴らさない。
      a.play().catch(() => {
        if (!fallBackContinue() && currentEl === a) {
          pendingBgm = key; currentKey = null;
        }
      });
      fadeEl(a, () => bgmLevel(key), key === "bgm_continue_urgent" ? 160 : 1200);
    };
    if (packed) {
      bgmSource(url).then((source) => {
        if (currentEl !== a) return;
        a.src = source;
        start();
      }, (error) => {
        if (currentEl !== a) return;
        currentEl = null;
        a.pause();
        if (SYNTH_FALLBACK[key]) synthStop = startSynth(SYNTH_FALLBACK[key]);
        console.warn("[BGM] Could not load game audio", key, error);
      });
    } else start();
  } else if (SYNTH_FALLBACK[key]) {
    synthStop = startSynth(SYNTH_FALLBACK[key]);
  }
}

export function stopBgm(fadeSec = 0.8) {
  currentKey = null;
  pendingBgm = null;
  if (currentEl) {
    const a = currentEl;
    currentEl = null;
    fadeEl(a, 0, fadeSec * 1000).then((finished) => { if (finished) a.pause(); });
  }
  if (synthStop) { synthStop(fadeSec); synthStop = null; }
  bgmDuck = 1;
  bgmPaused = false;
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = config.mute || config.muted ? 0 : config.bgmVolume;
}

const elFades = new WeakMap();
function fadeEl(a, to, ms) {
  return new Promise((res) => {
    elFades.get(a)?.(false); // 前のフェードを止め、切替途中の音量の再上昇を防ぐ。
    const finish = (completed) => {
      if (elFades.get(a) === finish) elFades.delete(a);
      res(completed);
    };
    elFades.set(a, finish);
    const from = a.volume;
    const t0 = performance.now();
    const step = () => {
      if (elFades.get(a) !== finish) return;
      const k = ms <= 0 ? 1 : Math.min(1, (performance.now() - t0) / ms);
      const target = typeof to === "function" ? to() : to;
      a.volume = Math.max(0, Math.min(1, from + (target - from) * k));
      if (k < 1) requestAnimationFrame(step); else finish(true);
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
  const bpm = kind === "panic" ? 168 : kind === "battle" ? 124 : kind === "tension" ? 80 : 68;
  const stepDur = 60 / bpm / 4;
  const bass = kind === "battle" ? [45, 45, 57, 45, 48, 48, 60, 48, 43, 43, 55, 43, 41, 41, 53, 52] : [45, 0, 0, 0, 43, 0, 0, 0, 41, 0, 0, 0, 40, 0, 0, 0];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  let step = 0;
  let next = c.currentTime + 0.05;
  const startAt = next;
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
    if (bgmPaused) { next = c.currentTime + .05; setTimeout(schedule, 60); return; }
    while (next < c.currentTime + 0.25) {
      const s = step % 16;
      if (kind === "battle") {
        if (s % 4 === 0) kick(next, 0.5);
        if (s % 4 === 2) hat(next, 0.12);
        if (s % 2 === 1) hat(next, 0.05);
        const n = bass[s];
        if (n) voice(mtof(n), next, stepDur * 0.9, "sawtooth", 0.07);
        if (s === 0 && step % 64 === 0) [69, 72, 76].forEach((m) => voice(mtof(m), next, stepDur * 14, "triangle", 0.03));
      } else if (kind === "panic") {
        // 同期的な鼓動と追い立てる低音。短い台詞の可聴域を空けた軽い合成ループ。
        if (s === 0 || s === 7 || s === 10) kick(next, s === 0 ? 0.44 : 0.24);
        if (s % 2 === 1) hat(next, 0.035);
        if (s === 3 || s === 11) hat(next, 0.08);
        const n = [40,0,40,0,43,0,40,0,38,0,38,0,35,0,38,0][s];
        if (n) voice(mtof(n), next, stepDur * 1.6, "triangle", 0.042);
        if (s === 0 && step % 32 === 0) voice(mtof(52), next, stepDur * 26, "sine", 0.023);
      } else if (kind === "tension") {
        if (s === 0 || s === 3) kick(next, s === 0 ? 0.35 : 0.22);
        if (s === 0 && step % 32 === 0) [57, 60, 64].forEach((m) => voice(mtof(m), next, stepDur * 30, "sine", 0.025));
        if (s % 4 === 2) hat(next, 0.03);
      } else {
        if (s === 0 && step % 32 === 0) [bass[(step / 16) % 16] || 45, 57, 64, 67].forEach((m) => voice(mtof(m + 12), next, stepDur * 30, "sine", 0.02));
      }
      // コンティニュー専用: 前半168 BPM → 20秒後196 BPM。諦めさせない圧迫感。
      const panicBpm = 168 + Math.min(28, Math.max(0, next - startAt) * 1.4);
      next += kind === "panic" ? 60 / panicBpm / 4 : stepDur;
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
