// 音。BGM は実ファイル（assets/audio/bgm）を優先し、まだ無い曲（大会など）は
// WebAudio で代用する。手元・UIのSEは録音を優先し、未読込・取得失敗時は合成で補う。
import { config } from "./state.js";
import { bgmUrl } from "./data.js";

let ctx = null;
let master = null;
let seBus = null;
let bgmBus = null;
let audioUnlocked = false;
let lastPhoneReceiveAt = -Infinity;
let rainMode = null;
let rainLoop = null;
let rainBuffer = null;
let noiseBuffer = null;
let bgmDuck = 1;
let bgmPaused = false;
const seBuffers = new Map();
const seLoads = new Map();
const seRetryAt = new Map();
const seVoices = new Set();
const activePulls = new Set();
const lastVariant = new Map();
const SE_ROOT = "../assets/audio/se/";
const RECORDED_SE = {
  click: { files: ["ui_click.wav"], gain: .3 },
  select: { files: ["ui_select.wav"], gain: .3 },
  cancel: { files: ["ui_back.wav"], gain: .3 },
  phone: { files: ["lime_glass.wav"], gain: .4 },
  doorbell: { files: ["shop_bell.wav"], gain: 1 },
  coalSnip: { files: ["coal_grab_01.wav", "coal_grab_02.wav"], gain: 1 },
  coalPlace: { files: ["hms_knock_01.wav", "hms_knock_02.wav"], gain: 1 },
  foilPunch: { files: ["foil_puncture.wav"], gain: 1 },
  bubbling: { files: ["water_draw.wav"], gain: 1 },
};
const WATER_LOOP = "water_loop.wav", WATER_END = "water_end.wav";

const seEnabled = () => audioUnlocked && ctx?.state === "running" && !document.hidden
  && !config.mute && !config.muted && Number(config.seVolume) > 0;

function loadSeBuffer(file) {
  if (seBuffers.has(file)) return Promise.resolve(seBuffers.get(file));
  if (!ctx?.decodeAudioData || typeof fetch !== "function" || Date.now() < (seRetryAt.get(file) || 0)) return Promise.resolve(null);
  if (!seLoads.has(file)) {
    const load = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(SE_ROOT + file, { signal: controller.signal });
        if (!response.ok) throw new Error(`SE HTTP ${response.status}`);
        const buffer = await ctx.decodeAudioData(await response.arrayBuffer());
        seBuffers.set(file, buffer);
        return buffer;
      } catch {
        seRetryAt.set(file, Date.now() + 30000);
        return null;
      } finally {
        clearTimeout(timer);
        seLoads.delete(file);
      }
    })();
    seLoads.set(file, load);
  }
  return seLoads.get(file);
}

/** 最初の操作で先読み。ゲーム進行は待たせず、最初の未読込SEは合成で補う。 */
export function preloadSe() {
  if (!audioUnlocked) return Promise.resolve(false);
  const files = new Set([...Object.values(RECORDED_SE).flatMap(s => s.files), WATER_LOOP, WATER_END]);
  return Promise.all([...files].map(loadSeBuffer)).then(buffers => buffers.every(Boolean));
}

function recordedVoice(file, { gain = 1, rate = 1, loop = false } = {}) {
  if (!seEnabled() || !seBuffers.has(file)) return null;
  const source = ctx.createBufferSource(), output = ctx.createGain();
  source.buffer = seBuffers.get(file);
  source.loop = loop;
  source.playbackRate.value = rate;
  output.gain.setValueAtTime(loop ? 0 : gain, ctx.currentTime);
  if (loop) output.gain.linearRampToValueAtTime(gain, ctx.currentTime + .04);
  source.connect(output).connect(seBus);
  const voice = { source, output, stop(fade = 0) {
    if (!seVoices.has(voice)) return;
    output.gain.cancelScheduledValues(ctx.currentTime);
    output.gain.setValueAtTime(fade ? output.gain.value : 0, ctx.currentTime);
    if (fade) output.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
    try { source.stop(ctx.currentTime + fade); } catch { /* 終了済み */ }
  } };
  seVoices.add(voice);
  source.onended = () => { seVoices.delete(voice); source.disconnect(); output.disconnect(); };
  source.start();
  return voice;
}

function recordedSe(id) {
  if (!seEnabled()) return true; // ミュートや非表示中に代用音へ回さない。
  const { files, gain } = RECORDED_SE[id];
  const ready = files.filter(file => seBuffers.has(file));
  if (!ready.length) { files.forEach(loadSeBuffer); return false; }
  const choices = ready.filter(file => file !== lastVariant.get(id));
  const file = (choices.length ? choices : ready)[Math.floor(Math.random() * (choices.length || ready.length))];
  lastVariant.set(id, file);
  recordedVoice(file, { gain });
  return true;
}

function syncPulls() { activePulls.forEach(pull => pull.sync()); }
function stopRecordedVoices() { seVoices.forEach(voice => voice.stop()); }
document.addEventListener?.("visibilitychange", () => {
  syncPulls();
  if (document.hidden) stopRecordedVoices();
  syncRain();
});

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  ctx.addEventListener?.("statechange", syncPulls);
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
  const ready = () => {
    if (c?.state !== "running") return;
    syncRain(); syncPulls();
    // resume() is asynchronous. Read the latest request only after it succeeds;
    // stop/scene changes during unlock must not revive an old title request.
    if (pendingBgm) { const k = pendingBgm; pendingBgm = null; playBgm(k); }
  };
  if (c && c.state === "suspended") c.resume().then(ready, () => {});
  else ready();
  preloadSe();
}

export function applyVolumes() {
  const muted = config.mute || config.muted;
  if (seBus) seBus.gain.value = muted ? 0 : config.seVolume;
  bgmBus?.gain.cancelScheduledValues?.(ctx.currentTime);
  if (bgmBus) bgmBus.gain.value = muted || bgmPaused ? 0 : config.bgmVolume * bgmDuck;
  if (currentEl) currentEl.volume = bgmLevel(currentKey);
  // 曲の切替後もフェード中の旧曲は鳴っている。無音設定を即座に反映し、
  // 予約済みのフレームが音量を戻さないようフェードごと終了する。
  if (muted || !(Number(config.bgmVolume) > 0)) {
    for (const a of retiringBgm) {
      elFades.get(a)?.(false);
      a.volume = 0;
      a.pause();
      releasePacked(a.src);
      retiringBgm.delete(a);
    }
  }
  syncPulls();
  if (muted || !(Number(config.seVolume) > 0)) stopRecordedVoices();
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

// ---------------------------------------------------------------- SE（録音未読込時・演出用の合成）

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
  let buf, offset = 0;
  if (dur <= 3) {
    if (!noiseBuffer) {
      noiseBuffer = c.createBuffer(1, Math.floor(c.sampleRate * 3), c.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    buf = noiseBuffer;
    offset = Math.random() * Math.max(0, buf.duration - dur);
  } else {
    buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }
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
  src.start(t, offset, dur);
}

/** 一口の間だけ録音ループ。止め際は最後の一泡。非表示/消音中は止め、同じ一口だけ再開。 */
export function startBubbling({ strength = 1 } = {}) {
  let stopped = false, voice = null, timer = null;
  const force = Math.max(.3, Math.min(1, Number(strength) || 1));
  const bubble = () => {
    if (stopped || !seEnabled()) return;
    const freq = 95 + Math.random() * 95;
    tone({ freq, to: Math.max(35, freq * .42), dur: .075 + Math.random() * .045, vol: .09 * force });
    noise({ dur: .055, filter: 350 + Math.random() * 300, q: 1.4, vol: .025 * force });
  };
  const silenceFallback = () => { if (timer !== null) clearInterval(timer); timer = null; };
  const pull = { sync() {
    if (stopped) return;
    if (!seEnabled()) { voice?.stop(); voice = null; silenceFallback(); return; }
    if (voice || timer !== null) return;
    if (seBuffers.has(WATER_LOOP)) {
      voice = recordedVoice(WATER_LOOP, { loop: true, gain: force, rate: .88 + .12 * force });
    } else {
      bubble(); timer = setInterval(bubble, 85);
      loadSeBuffer(WATER_LOOP).then(buffer => {
        if (!buffer || stopped) return;
        silenceFallback(); pull.sync();
      });
    }
  } };
  activePulls.add(pull);
  pull.sync();
  return () => {
    if (stopped) return;
    stopped = true; activePulls.delete(pull); silenceFallback();
    if (voice) {
      voice.stop(seEnabled() ? .06 : 0);
      if (seEnabled()) recordedVoice(WATER_END, { gain: force * .65 });
      voice = null;
    }
  };
}

// キャラ別の文字送りボイス（低い=スミさん、高い=みんと 等）
const BLIP = {
  hajime: 440, sumi: 300, naru: 420, adam: 330, minto: 1350, oneesan: 980, tsumugi: 1100, rin: 760,
  pakki: 900, nagumo: 280, maezono: 380, dr_kemuri: 520, salaryman: 360, ageha: 1200,
  mashiro: 880, samechan: 1250,
};

export const SE = {
  click: () => tone({ freq: 1200, to: 900, type: "triangle", dur: 0.05, vol: 0.12 }),
  select: () => { tone({ freq: 660, type: "triangle", dur: 0.08, vol: 0.18 }); tone({ freq: 990, type: "triangle", dur: 0.1, vol: 0.14, delay: 0.05 }); },
  cancel: () => tone({ freq: 500, to: 300, type: "triangle", dur: 0.12, vol: 0.15 }),
  error: () => { tone({ freq: 180, type: "square", dur: 0.12, vol: 0.1 }); tone({ freq: 150, type: "square", dur: 0.14, vol: 0.1, delay: 0.1 }); },
  blip: (speaker) => {
    if (!config.voiceBlip || !speaker) return tone({ freq: 1800, type: "sine", dur: 0.02, vol: 0.03 });
    const f = BLIP[speaker] || 600;
    tone({ freq: f * (0.95 + Math.random() * 0.1), type: speaker === "pakki" ? "square" : "triangle", dur: 0.045, vol: speaker === "sumi" ? 0.09 : 0.06 });
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
  // LIME専用の短いオリジナル合成音。録音phone互換IDはそのまま残す。
  phoneReceive: () => {
    if (!seEnabled() || ctx.currentTime - lastPhoneReceiveAt < .2) return;
    lastPhoneReceiveAt = ctx.currentTime; // 同時の通知・初回案内で受信音を重ねない。
    tone({ freq: 880, dur: .07, vol: .1 });
    tone({ freq: 1320, dur: .1, vol: .1, delay: .08 });
  },
  phoneSend: () => {
    if (!seEnabled()) return;
    tone({ freq: 660, to: 990, type: "triangle", dur: .09, vol: .09 });
  },
  doorbell: () => { tone({ freq: 1568, type: "sine", dur: 0.6, vol: 0.12 }); tone({ freq: 1245, type: "sine", dur: 0.8, vol: 0.1, delay: 0.25 }); },
  coalSnip: () => { noise({ dur: 0.04, vol: 0.02, filter: 4000 }); tone({ freq: 700, to: 200, type: "triangle", dur: 0.05, vol: 0.005 }); },
  coalPlace: () => tone({ freq: 280, to: 160, type: "triangle", dur: .08, vol: .025 }),
  foilPunch: () => noise({ dur: .06, vol: .02, filter: 4200, q: .6 }),
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
  // 電車（motions/train.js）: 低いうなりの上に「ガタン・ゴトン」と継ぎ目の音が2回
  train: (sec = 2.6) => {
    noise({ dur: sec, vol: 0.1, filter: 220, q: 0.7 });
    [0.15, 0.27, 1.05, 1.17].forEach((t, i) => { tone({ freq: i % 2 ? 72 : 96, to: 48, type: "sine", dur: 0.12, vol: 0.22, delay: t }); noise({ dur: 0.05, vol: 0.08, filter: 1400, delay: t }); });
  },
  // 新幹線（motions/shinkansen.js, Issue #1059）: 継ぎ目のない高速走行の連続音。在来線の「ガタン・ゴトン」は鳴らさない。
  shinkansen: (sec = 1.7) => {
    noise({ dur: sec, vol: 0.09, filter: 900, q: 0.5, sweepTo: 1500 });
    tone({ freq: 150, to: 105, type: "sine", dur: sec, vol: 0.07 });
  },
  freezeBoom: () => { tone({ freq: 60, to: 30, type: "sine", dur: 0.6, vol: 0.4 }); noise({ dur: 0.5, vol: 0.2, filter: 700, sweepTo: 3000 }); },
};

for (const id of Object.keys(RECORDED_SE)) {
  const fallback = SE[id];
  SE[id] = (...args) => { if (!recordedSe(id)) fallback(...args); };
}

export function playSe(id, ...args) {
  const key = String(id || "").replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  (SE[key] || SE[id] || (() => {}))(...args);
}

/** CONTINUE専用SE。既存AudioContext/設定を共有し、離脱時は予約済みの音も止める。 */
export function createContinueAudio({ enabled = true } = {}) {
  let alive = true, paused = false, output = null, restore = 0, holdMix = 1;
  const voices = new Set();
  const ownsMusic = () => currentKey === "bgm_continue_urgent" || pendingBgm === "bgm_continue_urgent";
  function instrument() {
    const c = ensureCtx();
    if (!alive || paused || !enabled || !c || c.state !== "running" || document.hidden
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
    if (!alive || paused || !enabled || document.hidden || config.mute || config.muted || !(config.seVolume > 0)) return;
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
      note(f, { dur: .045, vol: speaker === "sumi" ? .09 : .06, type: "triangle" });
    },
    // 通常の刻みは毎秒BGMをduckせず、他の予約SEと同じvoicesで停止する。
    tick() { note(1000, { dur: .04, vol: .045, type: "triangle" }); },
    count(remaining) {
      pulse(() => remaining === 0 ? note(70, { to: 45, dur: .2, vol: .22 })
        : note([990, 870, 780, 700, 620][remaining - 1], { dur: .07, vol: .13, type: "triangle" }));
    },
    quiet() { holdMix = Math.SQRT1_2; clearTimeout(restore); mix(holdMix, 160); },
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
      if (!alive) return;
      paused = true;
      silence(); clearTimeout(restore);
      if (!ownsMusic()) return;
      bgmPaused = true; currentEl?.pause(); mix(holdMix);
    },
    resume() {
      if (!alive) return;
      paused = false;
      if (!ownsMusic()) return;
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
const retiringBgm = new Set();
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
const BGM_GAIN = { sweets_or_sweets: 0.55, bgm_tournament_edm: 0.51, bgm_tournament_craft: 0.67, bgm_continue_urgent: 0.68, bgm_axe: 0.79 };
const bgmLevel = (key) => config.mute || config.muted || bgmPaused ? 0
  : config.bgmVolume * (BGM_GAIN[key] ?? 1) * bgmDuck;

// 単体MP3の再配布を避けるゲーム専用形式（pack_bgm.py と対応）。HTTPS/localhostで復元する。
const PACKED_MAGIC = "SUIENBGM1";
const PACKED_KEY = "ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2";
const packedSources = new Map();
// 復元済み Blob の保持は直近分だけに絞る（1曲2〜4.6MB、全10曲で約31MBが
// セッション中ずっと残り続けるのを防ぐ）。再生中・フェード中・復元したばかりの曲は破棄しない。
const PACKED_CACHE_MAX = 5;
const packedBlobs = new Map(); // url -> blobUrl（解決済みのみ。挿入順＝古い順）
const packedInUse = new Set(); // 要素へ割り当て済みの blobUrl（止まるまで解放しない）
let packedCryptoKey = null;

function evictPacked(keepUrl = null) {
  while (packedBlobs.size > PACKED_CACHE_MAX) {
    const victim = [...packedBlobs.keys()].find((u) => u !== keepUrl
      && !packedInUse.has(packedBlobs.get(u)) && packedBlobs.get(u) !== currentEl?.src);
    if (!victim) return; // 全候補が使用中なら一時的に上限を超えてよい
    const evicted = packedBlobs.get(victim);
    packedBlobs.delete(victim);
    packedSources.delete(victim); // 次に必要になったら取得・復元し直す
    if (typeof URL.revokeObjectURL === "function") URL.revokeObjectURL(evicted);
  }
}

function retainPacked(url, blobUrl) {
  packedBlobs.delete(url);
  packedBlobs.set(url, blobUrl);
  evictPacked(url);
}

// 要素が止まったら使用中を外し、たまっていた破棄を進める。
function releasePacked(blobUrl) {
  if (blobUrl && packedInUse.delete(blobUrl)) evictPacked();
}

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
    source.then((blobUrl) => {
      try { retainPacked(url, blobUrl); } catch { /* 保持管理の失敗で再生を止めない */ }
    }, () => { packedSources.delete(url); }); // 一時的な取得失敗は次回に再試行できる。
  } else if (packedBlobs.has(url)) {
    const blobUrl = packedBlobs.get(url); // 使った曲は新しい側へ寄せ、破棄順を後ろにする
    packedBlobs.delete(url);
    packedBlobs.set(url, blobUrl);
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
      releasePacked(a.src);
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
        packedInUse.add(source); // 止まるまで Blob を解放しない
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
    retiringBgm.add(a);
    fadeEl(a, 0, fadeSec * 1000).then((finished) => {
      if (finished) { a.pause(); releasePacked(a.src); }
      retiringBgm.delete(a);
    });
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
