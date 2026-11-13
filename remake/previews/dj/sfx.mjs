// DJ の効果音（2026-11-13 DJF02）。曲とは別の出口（bus）から鳴らす: メーターには乗らず、曲の音量・ミュートには従う。
// 役割を分ける: カウント＝高く短いクリック／入り＝低い衝撃＋歓声／外した＝下がる鈍い音／コンボの節目＝手拍子／ズレた＝たわむ音・直した＝はまる音／つなぎ・セットの締め＝歓声と拍手。
// 音程のある音は D と A だけ（5曲のキー A minor・C major・F major・D minor のどれにも入っている音）。
// 大きさは feel.mjs の FEEL.sfx（出来事が大きいほど大きい）。WebAudio の部品が無い環境（テストの注入コンテキスト）では何もしない。
import { FEEL } from './feel.mjs';
const SAMPLES = { cheer: 'minigame/axe_cheer.wav', applause: 'crowd_applause_01.mp3' }; // どちらも本編で使っている録音（assets/audio/se/）
const BUS = .42; // 曲（出口の音量 0.18）と並べて聞こえる大きさへ合わせる係数
export class DJSfx {
  constructor(audio) { this.audio = audio; this.context = null; this.bus = null; this.noise = null; this.samples = {}; this.count = 0; this.last = ''; }
  /** いまの音声コンテキストで鳴らせる状態にする。鳴らせなければ null。 */
  ready() {
    const c = this.audio.context;
    if (!c || c.state === 'closed' || !c.createOscillator || !c.createBiquadFilter || !c.createBuffer) return null;
    if (this.context !== c) {
      this.context = c; this.bus = c.createGain(); this.bus.connect(c.destination); this.samples = {};
      const length = Math.round(c.sampleRate * .6); this.noise = c.createBuffer(1, length, c.sampleRate);
      const data = this.noise.getChannelData?.(0); if (data) { let seed = 9; for (let i = 0; i < length; i++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; data[i] = seed / 2147483648 - 1; } }
      for (const [name, file] of Object.entries(SAMPLES)) this.samples[name] = fetch(new URL('../../../assets/audio/se/' + file, import.meta.url))
        .then(r => r.ok ? r.arrayBuffer() : Promise.reject(new Error(file))).then(b => c.decodeAudioData(b)).catch(() => null);
    }
    this.bus.gain.value = this.audio.muted ? 0 : Math.max(0, this.audio.volume / .18) * BUS * FEEL.sfx.master;
    return c;
  }
  env(gain, at, dur, attack = .004) {
    const g = this.context.createGain(), p = g.gain; p.setValueAtTime(0, at); p.linearRampToValueAtTime(gain, at + attack); p.exponentialRampToValueAtTime(.0001, at + dur); g.connect(this.bus); return g;
  }
  tone({ type = 'sine', from, to = from, at, dur, gain }) {
    if (!(gain > 0)) return;
    const o = this.context.createOscillator(); o.type = type; o.frequency.setValueAtTime(from, at); if (to !== from) o.frequency.exponentialRampToValueAtTime(to, at + dur);
    o.connect(this.env(gain, at, dur)); o.start(at); o.stop(at + dur + .02);
  }
  burst({ filter = 'bandpass', freq, q = .8, at, dur, gain }) {
    if (!(gain > 0)) return;
    const s = this.context.createBufferSource(), f = this.context.createBiquadFilter(); s.buffer = this.noise; f.type = filter; f.frequency.value = freq; f.Q.value = q;
    s.connect(f); f.connect(this.env(gain, at, dur, .002)); s.start(at, 0, dur + .02);
  }
  sample(name, { gain, at, rate = 1 }) {
    if (!(gain > 0)) return;
    const c = this.context; this.samples[name]?.then(buffer => {
      if (!buffer || this.context !== c || c.state === 'closed') return;
      const s = c.createBufferSource(), g = c.createGain(); s.buffer = buffer; s.playbackRate.value = rate; g.gain.value = gain; s.connect(g); g.connect(this.bus); s.start(Math.max(at, c.currentTime));
    });
  }
  impact(at, gain, long) { this.tone({ from: 120, to: 42, at, dur: long ? .28 : .2, gain }); this.burst({ filter: 'highpass', freq: 4500, at, dur: long ? .5 : .26, gain: gain * .45 }); }
  clap(at) { const g = FEEL.sfx.clap; this.burst({ freq: 1500, at, dur: .09, gain: g }); this.burst({ freq: 2300, at: at + .012, dur: .07, gain: g * .7 }); }
  up(at) { const g = FEEL.sfx.up; this.tone({ type: 'triangle', from: 587.33, at, dur: .09, gain: g }); this.tone({ type: 'triangle', from: 880, at: at + .09, dur: .14, gain: g }); }
  down(at) { const g = FEEL.sfx.down; this.tone({ type: 'triangle', from: 440, at, dur: .1, gain: g }); this.tone({ type: 'triangle', from: 293.66, at: at + .1, dur: .18, gain: g }); }
  /** name: tick / entry / combo / broken / nope / slip / fix / transition / pick / finish / stamp。鳴らしたら true。 */
  play(name, arg = {}) {
    const c = this.ready(); if (!c) return false;
    const S = FEEL.sfx, now = c.currentTime, at = Math.max(now, Number.isFinite(arg.at) ? arg.at : now);
    if (name === 'tick') this.tone({ from: arg.last ? 2093 : 1568, at, dur: .035, gain: arg.last ? S.tickLast : S.tick });
    else if (name === 'entry') {
      const g = arg.grade;
      if (g === 'PERFECT') { this.impact(at, S.impact, true); this.sample('cheer', { gain: S.cheer.PERFECT, at }); }
      else if (g === 'GOOD') { this.impact(at, S.impactSmall, false); this.sample('cheer', { gain: S.cheer.GOOD, at }); }
      else if (g === 'OK') this.tone({ type: 'triangle', from: 900, to: 700, at, dur: .05, gain: S.click });
      else { this.tone({ type: 'triangle', from: 260, to: 110, at, dur: .2, gain: S.stumble }); this.burst({ freq: 700, at, dur: .09, gain: S.stumble * .6 }); }
    } else if (name === 'combo') {
      const n = arg.combo, claps = n >= 32 ? 3 : n >= 16 ? 2 : 1;
      for (let i = 0; i < claps; i++) this.clap(at + i * .11);
      if (n >= 16) this.sample('cheer', { gain: S.cheer[`combo${Math.min(32, n)}`] || 0, at, rate: 1.08 });
    } else if (name === 'broken') this.tone({ from: 95, to: 60, at, dur: .12, gain: S.thud });
    // ズレ（DJG）: レコードが滑るような、たわむ音。直した瞬間は、はまる音（高いクリック2つ）
    else if (name === 'nope') this.tone({ from: 110, to: 80, at, dur: .07, gain: S.thud * .7 }); // 押せない ▶ を押した
    else if (name === 'slip') { this.tone({ type: 'triangle', from: 440, to: 392, at, dur: .16, gain: S.slip }); this.tone({ type: 'triangle', from: 392, to: 440, at: at + .16, dur: .14, gain: S.slip * .8 }); }
    else if (name === 'fix') { this.tone({ from: 1568, at, dur: .03, gain: S.fix }); this.tone({ from: 2093, at: at + .06, dur: .05, gain: S.fix }); this.clap(at + .06); }
    else if (name === 'transition') {
      const r = arg.rank;
      if (r === 'S') { this.impact(at, S.impact, true); this.sample('cheer', { gain: S.cheer.S, at }); }
      else if (r === 'A') { this.impact(at, S.impactSmall, false); this.sample('cheer', { gain: S.cheer.A, at }); }
      else if (r === 'B') this.tone({ type: 'triangle', from: 900, to: 700, at, dur: .05, gain: S.click });
      else this.down(at);
    } else if (name === 'pick') {
      if (arg.rating === '◎') { this.up(at); this.sample('cheer', { gain: S.cheer.pickGreat, at, rate: 1.12 }); }
      else if (arg.rating === '○') this.tone({ type: 'triangle', from: 900, to: 700, at, dur: .05, gain: S.click });
      else this.down(at);
    } else if (name === 'finish') {
      const r = arg.rank; this.impact(at, S.impact, true);
      this.sample('applause', { gain: S.applause[r] || 0, at }); this.sample('cheer', { gain: S.cheer[`finish${r}`] || 0, at });
    } else if (name === 'stamp') { this.tone({ from: 150, to: 50, at, dur: .18, gain: S.stamp }); this.burst({ freq: 900, at, dur: .05, gain: S.stamp * .5 }); }
    else return false;
    this.count++; this.last = name; return true;
  }
}
