// node --experimental-vm-modules remake/test/continue_audio.mjs
// 共通音声モジュールの実コード: countdown、duck、ミュート、予約SE破棄、次のBGMへの漏れ。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const config = { bgmVolume: .6, seVolume: .5, voiceBlip: true }, media = [], sources = [], frames = [], timers = new Map();
let now = 0, serial = 0, contexts = 0;
class Param {
  value = 0;
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
  setTargetAtTime(value) { this.value = value; }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param(); stops = [];
  connect() { return this; } disconnect() { this.disconnected = true; }
  start() { sources.push(this); } stop(at) { this.stops.push(at); }
}
class AudioContext {
  constructor() { contexts++; }
  state = "running"; sampleRate = 8000; destination = {}; currentTime = 0;
  createGain() { return new Node(); } createOscillator() { return new Node(); }
  createBufferSource() { return new Node(); } createBiquadFilter() { return new Node(); }
  createBuffer(_channels, n) { return { getChannelData: () => new Float32Array(n) }; }
}
class Audio {
  constructor(url) { this.src = url; this.volume = 0; media.push(this); }
  addEventListener() {} play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; }
}
const timeout = (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; };
const clear = id => timers.delete(id);
const context = vm.createContext({ Audio, window: { AudioContext, setTimeout: timeout }, document: { hidden: false },
  Math, Promise, Float32Array, performance: { now: () => now }, requestAnimationFrame: fn => frames.push(fn),
  setTimeout: timeout, clearTimeout: clear });
const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
await module.link(s => {
  const exports = s.endsWith("state.js") ? { config } : { bgmUrl: key => `/${key}.mp3` };
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
});
await module.evaluate();
const audio = module.namespace;
const step = ms => {
  now += ms;
  for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
  frames.splice(0).forEach(fn => fn());
};
const session = audio.createContinueAudio();
session.start(); session.title();
assert.equal(contexts, 1, "SE must share the existing AudioContext");
assert.equal(media[0].playbackRate, 1.08);
assert.equal(media[0].preservesPitch, true);
const firstCount = sources.length;
for (const remaining of [5, 4, 3, 2, 1, 0]) session.count(remaining);
assert.deepEqual(sources.slice(firstCount).map(node => node.frequency.value), [620, 700, 780, 870, 990, 70]);
const voiceStart = sources.length;
session.voice("sumi");
assert.equal(sources.length, voiceStart + 1, "typing plays the daily talking blip");
assert(Math.abs(sources.at(-1).frequency.value - 250) <= 250 * .05 + 1e-9, "same per-speaker pitch as daily dialogue");
session.choose("retry", "scan"); step(150);
assert(Math.abs(media[0].volume - .6 * .68 * .5) < 1e-9, "reaction ducks the actual media element");
config.bgmVolume = .2; audio.applyVolumes();
assert(Math.abs(media[0].volume - .2 * .68 * .5) < 1e-9, "settings must retain the reaction duck");
session.pause(); assert.equal(media[0].paused, true);
step(100); assert.equal(media[0].volume, 0);
session.resume(); step(100);
assert.equal(media[0].paused, false);
assert(Math.abs(media[0].volume - .2 * .68 * .5) < 1e-9);
session.expire(); step(400);
assert(Math.abs(media[0].volume - .2 * .68 * .1) < 1e-9, "GAME OVER dims the continue music");
audio.applyVolumes();
assert(Math.abs(media[0].volume - .2 * .68 * .1) < 1e-9, "settings preserve the GAME OVER fade");
const mutedStart = sources.length;
config.seVolume = 0; session.count(2); session.choose("quit", "canvas"); session.voice("tsumugi");
assert.equal(sources.length, mutedStart, "SE volume zero creates no audible sources");
config.bgmVolume = 0; audio.applyVolumes(); step(300);
assert.equal(media[0].volume, 0, "fade never restores a muted BGM");
session.cleanup(); session.cleanup(); step(300);
await Promise.resolve();
assert.equal(media[0].paused, true);
assert(sources.every(source => source.stops.at(-1) === undefined), "cleanup stops even future scheduled SE");
const stoppedStart = sources.length;
session.beat(); session.count(5); session.choose("retry", "shark"); session.voice("sumi");
assert.equal(sources.length, stoppedStart, "destroyed session cannot schedule SE");
config.bgmVolume = .4;
audio.playBgm("tonari"); step(1500);
assert.equal(media[1].volume, .4, "continue duck/pause never leaks to the next scene");
assert.equal(contexts, 1);
console.log("PASS: shared AudioContext, countdown, talking blip, pitch/duck/settings, GAME OVER mix, pause, mute, scheduled-SE cleanup, no leaked gain");
