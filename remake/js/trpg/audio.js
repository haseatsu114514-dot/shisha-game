// 卓の音。録音（CC0・仮、js/trpg/audio-cues.js）を優先し、未読込・取得失敗の種類は合成音で補う。
// 音量は設定の効果音音量・ミュートに従う（既定0.7で等倍）。BGM はテーマ別の曲を core/audio.js の playBgm で流し、
// 卓を閉じたら入る前の曲へ戻す。BGM がある間は合成の環境音（ノイズ＋持続音）は鳴らさない。
import { config } from "../core/state.js";
import { playBgm, currentBgm } from "../core/audio.js";
import { TRPG_SE, TRPG_THEME_BGM } from "./audio-cues.js";

const SE_BASE = new URL("../../../assets/audio/se/trpg/", import.meta.url);
const seLevel = () => config.mute || config.muted ? 0 : Math.max(0, Math.min(1.5, Number(config.seVolume ?? .7) / .7));

export function createTrpgAudio(initialTheme = "harbor") {
  let context = null, master = null, sampleBus = null, bed = [], voices = new Set();
  let bedBuffer = null, samples = null;
  let enabled = true, disposed = false, theme = initialTheme, bgmBefore, bgmTheme = null;
  const buffers = new Map(), lastSample = new Map();
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  function syncLevel() {
    if (!master) return;
    master.gain.value = .42 * seLevel(); sampleBus.gain.value = .9 * seLevel();
  }
  function ensureContext() {
    if (context || disposed || !Audio) return context;
    context = new Audio();
    master = context.createGain(); master.connect(context.destination);
    sampleBus = context.createGain(); sampleBus.connect(context.destination);
    syncLevel();
    return context;
  }
  // 19本・約0.9MB の短いWAVを最初の操作で一度だけ読む。失敗した種類は合成音のまま。
  function loadSamples() {
    if (samples || !context?.decodeAudioData || typeof fetch !== "function") return samples;
    const files = [...new Set(Object.values(TRPG_SE).flat())];
    samples = Promise.all(files.map(async file => {
      try {
        const response = await fetch(new URL(file, SE_BASE));
        if (!response.ok) return;
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (!disposed) buffers.set(file, buffer);
      } catch { /* 合成音で続ける */ }
    }));
    return samples;
  }
  function sample(kind, delay = 0, gain = 1) {
    const ready = (TRPG_SE[kind] || []).filter(file => buffers.has(file));
    if (!ready.length) return false;
    const choices = ready.length > 1 ? ready.filter(file => file !== lastSample.get(kind)) : ready;
    const file = choices[Math.floor(Math.random() * choices.length)];
    lastSample.set(kind, file);
    const source = context.createBufferSource(), g = context.createGain();
    source.buffer = buffers.get(file); g.gain.value = gain;
    source.connect(g).connect(sampleBus); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); g.disconnect(); };
    source.start(context.currentTime + delay);
    return true;
  }
  function syncBgm() {
    const key = TRPG_THEME_BGM[theme];
    if (disposed || !key || bgmTheme === theme) return;
    if (bgmBefore === undefined) bgmBefore = currentBgm();
    bgmTheme = theme; playBgm(key);
  }
  function stopBed() {
    for (const n of bed) { try { n.stop(); } catch {} n.disconnect(); }
    bed = [];
  }
  function makeBed() {
    stopBed();
    if (!enabled || disposed || !context || context.state !== "running" || TRPG_THEME_BGM[theme]) return;
    if (!bedBuffer) {
      bedBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
      const data = bedBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const noise = context.createBufferSource(); noise.buffer = bedBuffer; noise.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = theme === "shark" ? "lowpass" : "highpass";
    filter.frequency.value = theme === "shark" ? 420 : 1100;
    const gain = context.createGain(); gain.gain.value = theme === "shark" ? .045 : .023;
    noise.connect(filter).connect(gain).connect(master); noise.start(); bed.push(noise);
    for (const frequency of (theme === "shark" ? [110, 164.81] : [174.61, 261.63])) {
      const oscillator = context.createOscillator(), g = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency; g.gain.value = .009;
      oscillator.connect(g).connect(master); oscillator.start(); bed.push(oscillator);
    }
  }
  async function setEnabled(value) {
    if (disposed || !Audio) return false;
    enabled = !!value;
    try {
      if (enabled) {
        ensureContext(); syncLevel();
        await context.resume();
        loadSamples();
        if (!disposed && enabled) makeBed();
      } else { stopBed(); if (context) await context.suspend(); }
    } catch { enabled = false; stopBed(); }
    return enabled;
  }
  function tone(frequency, delay, duration, volume = .10, type = "sine") {
    const o = context.createOscillator(), g = context.createGain(), now = context.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(frequency, now);
    o.frequency.exponentialRampToValueAtTime(frequency * .72, now + duration);
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume, now + .006);
    g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    o.connect(g).connect(master); voices.add(o);
    o.onended = () => { voices.delete(o); o.disconnect(); g.disconnect(); };
    o.start(now); o.stop(now + duration + .01);
  }
  let grainBuffer = null;
  // A short filtered noise burst: dice hitting wood and felt, or paper sliding across the table.
  function grain(delay, duration, volume, frequency, q = 1.4, type = "bandpass") {
    if (!grainBuffer) {
      grainBuffer = context.createBuffer(1, Math.floor(context.sampleRate * .6), context.sampleRate);
      const data = grainBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = context.createBufferSource(), filter = context.createBiquadFilter(), g = context.createGain();
    const now = context.currentTime + delay;
    source.buffer = grainBuffer; filter.type = type; filter.frequency.value = frequency; filter.Q.value = q;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(volume, now + .004);
    g.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(filter).connect(g).connect(master); voices.add(source);
    source.onended = () => { voices.delete(source); source.disconnect(); filter.disconnect(); g.disconnect(); };
    source.start(now, Math.random() * .4); source.stop(now + duration + .02);
  }
  const clack = (delay, volume) => { grain(delay, .05, volume, 2600 + Math.random() * 900, 2.2); tone(190 + Math.random() * 70, delay, .06, volume * .55, "triangle"); };
  const rattle = times => times.forEach(delay => grain(delay, .035, .045, 4200, 3));
  function play(kind = "tap") {
    if (disposed || !enabled || !Audio) return;
    // 卓の操作（クリック）の中で初めて鳴る時に、ここで音の準備をする。既定で音はON。
    if (!context) { ensureContext(); context.resume?.().catch?.(() => {}); }
    loadSamples(); syncLevel();
    if (context.state !== "running") return;
    // Shaken in the hand, then two dice land on the tray: the landing matches the throw animation (780/850ms).
    if (kind === "roll") {
      if (!sample("shake")) rattle([0, .05, .1, .16, .21]);
      if (!sample("land", .74)) [[.37, .16], [.44, .13], [.66, .1], [.73, .085], [.87, .055], [.93, .04]].forEach(([d, v]) => clack(d, v));
    }
    else if (kind === "rethrow") { if (!sample("rethrow")) { rattle([0, .06, .12]); [[.3, .14], [.5, .09], [.62, .05]].forEach(([d, v]) => clack(d, v)); } }
    else if (["open", "page", "card", "slip", "success", "mixed", "trouble", "critical", "fumble", "ending"].includes(kind) && sample(kind)) return;
    else if (kind === "critical") play("success");
    else if (kind === "fumble") play("trouble");
    else if (kind === "page") grain(0, .2, .045, 1800, .7);
    else if (kind === "card") { grain(0, .16, .07, 1500, .7, "lowpass"); tone(620, .1, .05, .04, "triangle"); }
    else if (kind === "slip") { grain(0, .22, .05, 2200, .8); grain(.5, .06, .05, 900, 1.2); }
    else if (kind === "clue") { tone(523.25, 0, .19, .06); tone(783.99, .08, .28, .04); }
    else if (kind === "success") { tone(130.81, 0, .18, .16, "triangle"); [523.25, 659.25, 783.99].forEach((f, i) => tone(f, .035 + i * .07, .35, .075)); }
    else if (kind === "mixed") { tone(174.61, 0, .16, .13, "triangle"); tone(440, .09, .24, .06); }
    else if (kind === "trouble") { tone(146.83, 0, .2, .12, "triangle"); tone(196, .08, .26, .06); }
    else if (kind === "ending") [261.63, 329.63, 392].forEach((f, i) => tone(f, i * .14, .6, .055));
    else tone(kind === "open" ? 300 : 540, 0, .045, .06, "triangle");
  }
  function visibility() {
    if (!context || disposed || !enabled) return;
    if (document.hidden) context.suspend().catch(() => {});
    else context.resume().then(() => { if (!disposed) makeBed(); }).catch(() => {});
  }
  document.addEventListener("visibilitychange", visibility);
  return {
    get enabled() { return enabled; }, get available() { return !!Audio; }, setEnabled, play,
    setTheme(value) { theme = value; syncBgm(); makeBed(); },
    silence() {
      stopBed(); for (const n of voices) { try { n.stop(); } catch {} n.disconnect(); } voices.clear();
    },
    snapshot: () => ({ enabled, theme, state: context?.state || "idle", disposed, voices: voices.size, ambience: bed.length,
      bgm: TRPG_THEME_BGM[theme] || null, samples: buffers.size }),
    destroy() {
      if (disposed) return;
      disposed = true; enabled = false; stopBed();
      if (bgmTheme !== null && currentBgm() === TRPG_THEME_BGM[bgmTheme]) playBgm(bgmBefore || null); // 入る前の曲へ戻す
      for (const n of voices) { try { n.stop(); } catch {} n.disconnect(); } voices.clear();
      document.removeEventListener("visibilitychange", visibility);
      context?.close().catch(() => {});
    },
  };
}
