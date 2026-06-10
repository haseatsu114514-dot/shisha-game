// 効果音(WebAudio合成) + BGM 管理。
// 効果音はファイル不要で全てその場で合成する。
// BGMは window.BGM_DATA (スタンドアロン版) か ../assets/audio/bgm/ から再生。
"use strict";

const SFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmEl = null;
  let currentBgm = "";

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function env(gainNode, t0, attack, decay, peak) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(peak, t0 + attack);
    g.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  }

  function tone(freq, type, attack, decay, peak, detune = 0, when = 0) {
    if (muted) return;
    try {
      const c = ac();
      const t0 = c.currentTime + when;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      env(g, t0, attack, decay, peak);
      o.connect(g).connect(c.destination);
      o.start(t0);
      o.stop(t0 + attack + decay + 0.05);
    } catch (e) { /* 音は出なくてもゲームは止めない */ }
  }

  function noise(duration, peak, filterFreq, when = 0) {
    if (muted) return;
    try {
      const c = ac();
      const t0 = c.currentTime + when;
      const len = Math.max(1, Math.floor(c.sampleRate * duration));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = filterFreq;
      const g = c.createGain();
      g.gain.value = peak;
      src.connect(f).connect(g).connect(c.destination);
      src.start(t0);
    } catch (e) { /* noop */ }
  }

  const api = {
    // UI
    click: () => tone(720, "triangle", 0.004, 0.06, 0.12),
    select: () => { tone(540, "sine", 0.005, 0.09, 0.16); tone(810, "sine", 0.005, 0.12, 0.12, 0, 0.05); },
    type: () => tone(1900 + Math.random() * 500, "square", 0.001, 0.015, 0.018),
    // 判定
    perfect: () => { tone(880, "sine", 0.01, 0.18, 0.2); tone(1318, "sine", 0.01, 0.25, 0.18, 0, 0.09); tone(1760, "sine", 0.01, 0.3, 0.13, 0, 0.18); },
    good: () => { tone(660, "sine", 0.01, 0.15, 0.18); tone(990, "sine", 0.01, 0.2, 0.13, 0, 0.08); },
    miss: () => { tone(160, "sawtooth", 0.01, 0.25, 0.16); tone(110, "sawtooth", 0.01, 0.3, 0.13, 0, 0.06); },
    // シーシャ
    pour: () => noise(0.25, 0.12, 1200),
    foil: () => noise(0.08, 0.2, 3200),
    coal: () => { noise(0.3, 0.1, 500); tone(95, "sine", 0.02, 0.25, 0.1); },
    bubble: () => { tone(240, "sine", 0.02, 0.1, 0.12); tone(180, "sine", 0.02, 0.12, 0.1, 0, 0.07); tone(300, "sine", 0.01, 0.08, 0.08, 0, 0.13); },
    smoke: () => noise(0.6, 0.06, 800),
    stamp: () => { noise(0.06, 0.3, 900); tone(220, "triangle", 0.005, 0.12, 0.2); },
    fanfare: () => {
      [523, 659, 784, 1047].forEach((f, i) => tone(f, "triangle", 0.01, 0.35, 0.18, 0, i * 0.13));
    },
    coin: () => { tone(988, "square", 0.004, 0.08, 0.08); tone(1319, "square", 0.004, 0.18, 0.08, 0, 0.07); },

    setMuted(m) {
      muted = m;
      if (bgmEl) bgmEl.muted = m;
    },
    isMuted: () => muted,

    // BGM: key は "tonari" | "daily" など
    bgm(key) {
      if (key === currentBgm) {
        // 自動再生ブロックで止まったままなら再試行（ユーザー操作後に呼び直す）
        if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {});
        return;
      }
      currentBgm = key;
      const src = (window.BGM_DATA && window.BGM_DATA[key]) || `../assets/audio/bgm/${key}.mp3`;
      if (!bgmEl) {
        bgmEl = new Audio();
        bgmEl.loop = true;
        bgmEl.volume = 0.35;
      }
      bgmEl.muted = muted;
      bgmEl.src = src;
      bgmEl.play().catch(() => { /* ユーザー操作前は失敗してよい */ });
    },
    bgmStop() {
      currentBgm = "";
      if (bgmEl) bgmEl.pause();
    },
  };
  return api;
})();

window.SFX = SFX;
