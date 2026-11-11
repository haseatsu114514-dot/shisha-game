// 会場入りの待機曲は実MP3（仮置き）を再生する。ミュート・音量・自動再生保留も同じ経路で確認する。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const manifest = JSON.parse(await fs.readFile(new URL("../data/manifest.json", import.meta.url)));
assert(manifest.bgm.includes("bgm_tournament_wait.mp3"), "provisional wait track is registered");
const bgmUrl = key => ["bgm", "mp3"].map(ext => `${key}.${ext}`)
  .find(name => manifest.bgm.includes(name)) || null;
assert.equal(bgmUrl("bgm_tournament_wait"), "bgm_tournament_wait.mp3");

const timers = [], elements = [], frames = [];
let now = 0;
class Audio {
  constructor(src) {
    this.src = src || "";
    this.volume = 0;
    this.loop = false;
    this.muted = false;
    this.preload = "auto";
    this.readyState = 4;
    this.paused = true;
    elements.push(this);
  }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  load() {}
  addEventListener() {}
  removeEventListener() {}
  removeAttribute(name) { if (name === "src") this.src = ""; }
}
class AudioContext {
  state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
  constructor() { AudioContext.last = this; }
  createGain() { return { gain: { value: 0, cancelScheduledValues() {}, setValueAtTime(v) { this.value = v; },
    linearRampToValueAtTime(v) { this.value = v; }, exponentialRampToValueAtTime(v) { this.value = v; } }, connect() { return this; }, disconnect() {} }; }
  resume() { this.state = "running"; return Promise.resolve(); }
}
const config = { bgmVolume: .4, seVolume: .5, mute: false, muted: false };
const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false }, console, Math, Promise,
  performance: { now: () => now },
  requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
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
const step = (ms) => { now += ms; const pending = frames.splice(0); pending.forEach(fn => fn()); };

audio.playBgm("bgm_tournament_wait");
assert.equal(audio.currentBgm(), "bgm_tournament_wait");
assert(elements.length >= 1, "plays the real wait MP3");
assert.match(elements[0].src, /bgm_tournament_wait\.mp3$/);
step(1500);
assert.equal(elements[0].volume, .4);

assert.equal(await audio.preloadBgm("bgm_tournament_wait"), true);
const beforeReplay = elements.length;
audio.playBgm("bgm_tournament_wait");
assert.equal(audio.currentBgm(), "bgm_tournament_wait");

config.mute = true; audio.applyVolumes();
assert.equal(elements.at(-1).volume, 0);
config.mute = false; config.bgmVolume = .2; audio.applyVolumes();
assert.equal(elements.at(-1).volume, .2);
audio.stopBgm(0);
step(300);
assert.equal(audio.currentBgm(), null);

AudioContext.last.state = "suspended";
audio.playBgm("bgm_tournament_wait");
assert.equal(audio.currentBgm(), null);
audio.stopBgm(0);
audio.unlockAudio();
await Promise.resolve();
assert.equal(audio.currentBgm(), null, "停止した保留曲は操作後にも復活しない");
AudioContext.last.state = "suspended";
const beforeUnlock = elements.length;
audio.playBgm("bgm_tournament_wait");
audio.unlockAudio();
await Promise.resolve();
assert.equal(audio.currentBgm(), "bgm_tournament_wait");
assert(elements.length > beforeUnlock, "操作後に実曲を再開する");
audio.stopBgm(0);

console.log("[BGM tournament wait] PASS: manifest mp3, playback, volume, mute, stop and unlock");
