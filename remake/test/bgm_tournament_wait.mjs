// 空の待機MP3を登録せず、会場入りの各再生経路で既存の tension を使う。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const manifest = JSON.parse(await fs.readFile(new URL("../data/manifest.json", import.meta.url)));
assert(!manifest.bgm.includes("bgm_tournament_wait.mp3"));
const bgmUrl = key => ["bgm", "mp3"].map(ext => `${key}.${ext}`)
  .find(name => manifest.bgm.includes(name)) || null;
assert.equal(bgmUrl("bgm_tournament_wait"), null);

const timers = [], elements = [], oscillators = [], gains = [];
const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; },
  linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } });
const node = () => ({ connect() { return this; }, disconnect() {} });
class Audio {
  constructor(src) { this.src = src; elements.push(this); }
  play() { return Promise.resolve(); }
  pause() {}
}
class AudioContext {
  state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
  constructor() { AudioContext.last = this; }
  createGain() { const gain = { ...node(), gain: param() }; gains.push(gain); return gain; }
  createOscillator() {
    const oscillator = { ...node(), frequency: param(), start() { oscillators.push(this); }, stop() {} };
    return oscillator;
  }
  createBufferSource() { return { ...node(), start() {}, stop() {} }; }
  createBiquadFilter() { return { ...node(), frequency: param(), Q: param() }; }
  createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
  resume() { this.state = "running"; return Promise.resolve(); }
}
const config = { bgmVolume: .4, seVolume: .5, mute: false, muted: false };
const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false }, console,
  setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {},
});
const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
await module.link(specifier => {
  const exports = specifier.endsWith("state.js") ? { config } : { bgmUrl };
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
});
await module.evaluate();
const audio = module.namespace;
const runTimers = () => timers.splice(0).forEach(fn => fn());

// 未先読み: MP3要素を作らず、同期的に tension の音声ノードを開始する。
audio.playBgm("bgm_tournament_wait");
assert.equal(audio.currentBgm(), "bgm_tournament_wait");
assert.equal(elements.length, 0);
assert(oscillators.length >= 4, "tension のキックとパッドが始まる");
assert.equal(gains[2].gain.value, .4, "BGM音量を合成音のバスへ反映");

// 先読み呼び出しは音源取得を試みず直ちに戻り、再生は同じ合成曲へ進む。
audio.stopBgm(0);
assert.equal(await audio.preloadBgm("bgm_tournament_wait"), false);
const beforeReplay = oscillators.length;
audio.playBgm("bgm_tournament_wait");
assert(oscillators.length > beforeReplay);
assert.equal(elements.length, 0);

// ミュート、音量変更、停止後の予約済みタイマーを確認する。
config.mute = true; audio.applyVolumes();
assert.equal(gains[2].gain.value, 0);
config.mute = false; config.bgmVolume = .2; audio.applyVolumes();
assert.equal(gains[2].gain.value, .2);
audio.stopBgm(0);
const beforeStop = oscillators.length;
runTimers();
assert.equal(oscillators.length, beforeStop, "停止した旧曲のタイマーが新しい音を作らない");

// 自動再生未許可はデコード失敗と区別し、操作後に保留曲を再開する。
AudioContext.last.state = "suspended";
audio.playBgm("bgm_tournament_wait");
assert.equal(audio.currentBgm(), null);
assert.equal(elements.length, 0);
audio.stopBgm(0);
audio.unlockAudio();
await Promise.resolve();
assert.equal(audio.currentBgm(), null, "停止した保留曲は操作後にも復活しない");
AudioContext.last.state = "suspended";
audio.playBgm("bgm_tournament_wait");
audio.unlockAudio();
await Promise.resolve();
assert.equal(audio.currentBgm(), "bgm_tournament_wait");
assert(oscillators.length > beforeStop, "操作後に合成曲を再開する");
audio.stopBgm(0);

console.log("[BGM tournament wait] PASS: manifest, direct/preload synth, volume, mute, stop and unlock");
