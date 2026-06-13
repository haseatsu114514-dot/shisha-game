// 効果音(WebAudio合成) + BGM 管理。
// 効果音はファイル不要で全てその場で合成する（マスターにリバーブを通す）。
// BGMは window.BGM_DATA (スタンドアロン版) か ../assets/audio/bgm/ から再生。
"use strict";

const SFX = (() => {
  let ctx = null;
  let muted = false;
  let bgmEl = null;
  const BGM_BASE = 0.35; // BGM音量の基準値（bgmVolume=1.0 のときの実音量）
  let bgmVolume = 1.0;
  let sfxVolume = 1.0;
  let currentBgm = "";
  let masterDry = null;
  let masterWet = null;
  let reverb = null;
  let masterLP = null;
  let masterOut = null;

  function ac() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      // ---- マスターチェイン: ドライ + リバーブ(ConvolverNode) ----
      masterOut = ctx.createGain();
      masterOut.gain.value = 1.0;
      masterLP = ctx.createBiquadFilter();
      masterLP.type = "lowpass";
      masterLP.frequency.value = 12000;
      masterLP.Q.value = 0.4;
      masterOut.connect(masterLP).connect(ctx.destination);

      masterDry = ctx.createGain();
      masterDry.gain.value = 1.0;
      masterDry.connect(masterOut);

      reverb = ctx.createConvolver();
      reverb.buffer = makeImpulse(ctx, 2.2, 2.6);
      masterWet = ctx.createGain();
      masterWet.gain.value = 0.18;
      masterDry.connect(reverb).connect(masterWet).connect(masterOut);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // 指数減衰のリバーブインパルスを合成
  function makeImpulse(c, seconds, decay) {
    const rate = c.sampleRate;
    const len = Math.floor(rate * seconds);
    const buf = c.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  // ---- ヘルパー ----
  function envADR(g, t0, a, d, r, peak) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(peak * 0.35, t0 + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d + r);
  }

  // 単音（オシレータ + ローパス + リバーブ送り量）
  function blip(opts) {
    if (muted) return;
    const {
      freq = 440, type = "sine", detune = 0, when = 0,
      a = 0.005, d = 0.06, r = 0.05, peak = 0.18,
      filterFreq = 6000, q = 1,
      wet = 0.25, pan = 0, slide = null,
    } = opts;
    try {
      const c = ac();
      const t0 = c.currentTime + when;
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      if (slide) {
        o.frequency.setValueAtTime(slide[0], t0);
        o.frequency.exponentialRampToValueAtTime(slide[1], t0 + (slide[2] || a + d));
      }
      const f = c.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.value = filterFreq;
      f.Q.value = q;
      const g = c.createGain();
      envADR(g, t0, a, d, r, peak);
      const stereoPan = c.createStereoPanner ? c.createStereoPanner() : null;
      if (stereoPan) stereoPan.pan.value = pan;
      const send = c.createGain();
      send.gain.value = wet;
      o.connect(f).connect(g);
      if (stereoPan) {
        g.connect(stereoPan);
        stereoPan.connect(masterDry);
        stereoPan.connect(send).connect(reverb);
      } else {
        g.connect(masterDry);
        g.connect(send).connect(reverb);
      }
      o.start(t0);
      o.stop(t0 + a + d + r + 0.05);
    } catch (e) { /* noop */ }
  }

  // ノイズ（フィルタ付き）
  function hiss(opts) {
    if (muted) return;
    const {
      dur = 0.2, when = 0,
      a = 0.005, peak = 0.12,
      filterType = "bandpass", filterFreq = 2000, q = 1,
      pan = 0, wet = 0.2, sweep = null,
    } = opts;
    try {
      const c = ac();
      const t0 = c.currentTime + when;
      const len = Math.max(1, Math.floor(c.sampleRate * dur));
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      // ピンクっぽいノイズ（隣接サンプルを平均化して高域を抑える）
      let last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        last = (last * 0.6 + w * 0.4);
        d[i] = last * (1 - i / len);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = filterType;
      f.frequency.value = filterFreq;
      f.Q.value = q;
      if (sweep) {
        f.frequency.setValueAtTime(sweep[0], t0);
        f.frequency.exponentialRampToValueAtTime(sweep[1], t0 + (sweep[2] || dur));
      }
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(peak, t0 + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      const stereoPan = c.createStereoPanner ? c.createStereoPanner() : null;
      if (stereoPan) stereoPan.pan.value = pan;
      const send = c.createGain();
      send.gain.value = wet;
      src.connect(f).connect(g);
      if (stereoPan) {
        g.connect(stereoPan);
        stereoPan.connect(masterDry);
        stereoPan.connect(send).connect(reverb);
      } else {
        g.connect(masterDry);
        g.connect(send).connect(reverb);
      }
      src.start(t0);
    } catch (e) { /* noop */ }
  }

  const api = {
    // ---------- UI ----------
    click: () => {
      // 上品な木のノックぽい二音
      blip({ freq: 1200, type: "sine", a: 0.001, d: 0.04, r: 0.08, peak: 0.18, filterFreq: 3500, wet: 0.25 });
      blip({ freq: 600, type: "triangle", a: 0.001, d: 0.05, r: 0.12, peak: 0.10, filterFreq: 1800, wet: 0.3, when: 0.005 });
    },
    select: () => {
      // パッキパキした選択音: ベル系の倍音
      blip({ freq: 660, type: "sine", a: 0.002, d: 0.10, r: 0.30, peak: 0.20, filterFreq: 6000, wet: 0.35 });
      blip({ freq: 990, type: "sine", a: 0.002, d: 0.12, r: 0.32, peak: 0.14, filterFreq: 5000, wet: 0.35, when: 0.02 });
      blip({ freq: 1320, type: "sine", a: 0.002, d: 0.14, r: 0.36, peak: 0.10, filterFreq: 5000, wet: 0.4, when: 0.04 });
    },
    type: () => {
      // 軽いタイプ音（リバーブ送り少なめ）
      blip({
        freq: 1800 + Math.random() * 600, type: "square",
        a: 0.001, d: 0.012, r: 0.02, peak: 0.05,
        filterFreq: 3000, q: 1.5, wet: 0.05,
      });
    },
    // ---------- 判定 ----------
    perfect: () => {
      // 上昇する3和音 + 高域のキラッ
      [880, 1318, 1760].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.005, d: 0.20, r: 0.35, peak: 0.20 - i * 0.03, filterFreq: 7000, wet: 0.45, when: i * 0.07 })
      );
      hiss({ dur: 0.35, a: 0.005, peak: 0.06, filterType: "highpass", filterFreq: 4000, wet: 0.5, when: 0.08 });
    },
    good: () => {
      [660, 990].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.004, d: 0.16, r: 0.25, peak: 0.18 - i * 0.04, filterFreq: 6000, wet: 0.4, when: i * 0.06 })
      );
    },
    miss: () => {
      // 重い下降音 + ノイズ
      blip({ freq: 180, type: "sawtooth", a: 0.005, d: 0.30, r: 0.20, peak: 0.18, filterFreq: 800, wet: 0.4,
             slide: [180, 90, 0.45] });
      hiss({ dur: 0.40, a: 0.005, peak: 0.07, filterType: "lowpass", filterFreq: 600, wet: 0.5 });
    },
    // ---------- シーシャ ----------
    pour: () => {
      // フレーバーを注ぐ音: 粒っぽい高域ノイズ + わずかな低音
      hiss({ dur: 0.35, a: 0.01, peak: 0.10, filterType: "bandpass", filterFreq: 1500, q: 1.2, wet: 0.2,
             sweep: [2200, 900, 0.35] });
      blip({ freq: 220, type: "triangle", a: 0.01, d: 0.10, r: 0.10, peak: 0.04, filterFreq: 1200, wet: 0.2 });
    },
    foil: () => {
      // アルミ穴あけ: 鋭い金属ピン + 短いノイズ
      hiss({ dur: 0.06, a: 0.001, peak: 0.18, filterType: "highpass", filterFreq: 4500, wet: 0.3 });
      blip({ freq: 4200, type: "triangle", a: 0.001, d: 0.04, r: 0.08, peak: 0.12, filterFreq: 8000, wet: 0.45 });
      blip({ freq: 5600, type: "sine", a: 0.001, d: 0.05, r: 0.10, peak: 0.06, filterFreq: 8000, wet: 0.5, when: 0.005 });
    },
    coal: () => {
      // 炭の置く音: ドスッとした低音 + バチバチ
      blip({ freq: 80, type: "sine", a: 0.005, d: 0.18, r: 0.15, peak: 0.22, filterFreq: 400, wet: 0.25,
             slide: [120, 60, 0.20] });
      hiss({ dur: 0.45, a: 0.01, peak: 0.08, filterType: "bandpass", filterFreq: 2400, q: 3, wet: 0.4,
             sweep: [3000, 1500, 0.45] });
    },
    spark: () => {
      // 炭の芯がピカッと閃く（HEAT IGNITION ジャスト窓の合図）: 鋭く短い高域スパーク
      blip({ freq: 2800, type: "triangle", a: 0.001, d: 0.05, r: 0.08, peak: 0.13, filterFreq: 9000, wet: 0.4,
             slide: [3400, 2200, 0.06] });
      hiss({ dur: 0.09, a: 0.001, peak: 0.10, filterType: "highpass", filterFreq: 5200, wet: 0.35 });
    },
    bubble: () => {
      // 水の中の泡: ピッチが上がる丸い音 × 3
      [220, 280, 340].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.005, d: 0.10, r: 0.12, peak: 0.13 - i * 0.02,
               filterFreq: 2000, wet: 0.45, when: i * 0.06,
               slide: [f * 0.7, f, 0.10] })
      );
    },
    smoke: () => {
      // 煙を吸い込む長めの空気音
      hiss({ dur: 0.7, a: 0.05, peak: 0.06, filterType: "bandpass", filterFreq: 900, q: 1.5, wet: 0.5,
             sweep: [600, 1400, 0.7] });
    },
    stamp: () => {
      // スタンプの「ドンッ」: 木のヒット + 短いノイズ
      blip({ freq: 160, type: "triangle", a: 0.002, d: 0.10, r: 0.20, peak: 0.28, filterFreq: 1200, wet: 0.4 });
      hiss({ dur: 0.10, a: 0.002, peak: 0.18, filterType: "bandpass", filterFreq: 1800, q: 2, wet: 0.4 });
      blip({ freq: 60, type: "sine", a: 0.002, d: 0.12, r: 0.15, peak: 0.18, filterFreq: 300, wet: 0.25 });
    },
    fanfare: () => {
      // 短いファンファーレ（軽くベル系）
      const notes = [523, 659, 784, 1047, 1319];
      notes.forEach((f, i) =>
        blip({ freq: f, type: "triangle", a: 0.005, d: 0.20, r: 0.45, peak: 0.18,
               filterFreq: 6500, wet: 0.55, when: i * 0.10 })
      );
      // 高域のキラキラ
      [1568, 1976, 2349].forEach((f, i) =>
        blip({ freq: f, type: "sine", a: 0.005, d: 0.30, r: 0.50, peak: 0.10,
               filterFreq: 8000, wet: 0.7, when: 0.55 + i * 0.07 })
      );
    },
    coin: () => {
      // コインのチャリン
      blip({ freq: 988, type: "square", a: 0.001, d: 0.06, r: 0.12, peak: 0.10, filterFreq: 5000, wet: 0.4 });
      blip({ freq: 1319, type: "square", a: 0.001, d: 0.10, r: 0.16, peak: 0.10, filterFreq: 5000, wet: 0.4, when: 0.06 });
      blip({ freq: 1976, type: "sine", a: 0.001, d: 0.14, r: 0.22, peak: 0.06, filterFreq: 6000, wet: 0.6, when: 0.10 });
    },
    // ---------- 新規 ----------
    open: () => {
      // 画面遷移などで使えるソフトな開閉音（マップを開く時など）
      blip({ freq: 220, type: "sine", a: 0.01, d: 0.20, r: 0.30, peak: 0.16, filterFreq: 2200, wet: 0.5,
             slide: [180, 320, 0.18] });
      blip({ freq: 440, type: "sine", a: 0.01, d: 0.20, r: 0.32, peak: 0.10, filterFreq: 4000, wet: 0.6,
             slide: [360, 640, 0.18], when: 0.03 });
    },
    close: () => {
      blip({ freq: 360, type: "sine", a: 0.01, d: 0.18, r: 0.22, peak: 0.13, filterFreq: 2200, wet: 0.45,
             slide: [400, 180, 0.20] });
    },
    pageTurn: () => {
      hiss({ dur: 0.30, a: 0.01, peak: 0.07, filterType: "bandpass", filterFreq: 3000, q: 1.5, wet: 0.3,
             sweep: [2800, 1600, 0.30] });
    },

    setMuted(m) {
      muted = m;
      if (bgmEl) bgmEl.muted = m;
    },
    isMuted: () => muted,

    // 音量（0.0〜1.0）。CONFIG画面から設定される
    setBgmVolume(v) {
      bgmVolume = Math.max(0, Math.min(1, v));
      if (bgmEl) bgmEl.volume = BGM_BASE * bgmVolume;
    },
    getBgmVolume: () => bgmVolume,
    setSfxVolume(v) {
      sfxVolume = Math.max(0, Math.min(1, v));
      if (masterOut) masterOut.gain.value = sfxVolume;
    },
    getSfxVolume: () => sfxVolume,

    // BGM: key は "tonari" | "daily" など
    bgm(key) {
      if (key === currentBgm) {
        if (bgmEl && bgmEl.paused) bgmEl.play().catch(() => {});
        return;
      }
      currentBgm = key;
      const src = (window.BGM_DATA && window.BGM_DATA[key]) || `../assets/audio/bgm/${key}.mp3`;
      if (!bgmEl) {
        bgmEl = new Audio();
        bgmEl.loop = true;
        bgmEl.volume = BGM_BASE * bgmVolume;
        // スタンドアロン版は曲の途中で切り出しているため、ループの継ぎ目を
        // フェードアウト→フェードインでなめらかにする
        bgmEl.addEventListener("timeupdate", () => {
          const d = bgmEl.duration;
          if (!isFinite(d) || d <= 0) return;
          const FADE = 2.2;
          const base = BGM_BASE * bgmVolume;
          const rem = d - bgmEl.currentTime;
          if (rem < FADE) bgmEl.volume = base * Math.max(0, rem / FADE);
          else if (bgmEl.currentTime < FADE) bgmEl.volume = base * (bgmEl.currentTime / FADE);
          else if (bgmEl.volume !== base) bgmEl.volume = base;
        });
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
