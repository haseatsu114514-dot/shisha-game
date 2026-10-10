// 実audioモジュールのフェード/設定変更でも、サメちゃんの曲の音量補正が戻らない。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const config = { bgmVolume: .6, seVolume: .5 }, elements = [], frames = [];
let now = 0;
class Audio {
  constructor(url) { this.src = url; this.volume = 0; elements.push(this); }
  play() { return Promise.resolve(); } pause() { this.paused = true; }
  addEventListener() {}
}
class AudioContext {
  state = "running"; destination = {};
  createGain() { return { gain: { value: 0 }, connect() {} }; }
}
const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false }, Math, Promise,
  performance: { now: () => now }, requestAnimationFrame: (fn) => frames.push(fn) });
const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
await module.link((s) => {
  const exports = s.endsWith("state.js") ? { config } : { bgmUrl: (key) => `/${key}.mp3` };
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const [key, value] of Object.entries(exports)) this.setExport(key, value); }, { context });
});
await module.evaluate(); const audio = module.namespace;
const step = (ms) => { now += ms; const pending = frames.splice(0); pending.forEach((fn) => fn()); };
audio.playBgm("sweets_or_sweets"); step(1500);
assert.equal(elements[0].volume, .33);
config.bgmVolume = .2; audio.applyVolumes(); assert(Math.abs(elements[0].volume - .11) < 1e-9);
audio.playBgm("tonari"); step(1500); assert.equal(elements[1].volume, .2); assert.equal(elements[0].volume, 0);
audio.playBgm("sweets_or_sweets"); config.bgmVolume = .4; audio.applyVolumes(); step(1500);
assert(Math.abs(elements[2].volume - .22) < 1e-9, "Fade overwrote the new setting or track gain");
console.log("[BGM gain] PASS: shark track lowered, settings/fades retain gain, other tracks retain their setting");
