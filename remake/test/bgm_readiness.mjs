// No asset download: controlled media/network events test the actual audio module.
// node --experimental-vm-modules remake/test/bgm_readiness.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const elements = [], timers = new Map(), frames = [];
let nextTimer = 0, now = 0;
class Audio {
  constructor(src = "") { this.src = src; this.readyState = 0; this.volume = 0; this.plays = 0; this.listeners = new Map(); elements.push(this); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  emit(type) { for (const fn of [...this.listeners.get(type) || []]) fn(); }
  load() { this.loads = (this.loads || 0) + 1; }
  removeAttribute(name) { if (name === "src") this.src = ""; }
  play() { this.plays++; return Promise.resolve(); }
  pause() { this.paused = true; }
}
class AudioContext {
  state = "running"; destination = {};
  createGain() { return { gain: { value: 0 }, connect() {} }; }
}
const config = { bgmVolume: .5, seVolume: .5 };
const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false }, console,
  performance: { now: () => now }, requestAnimationFrame: fn => frames.push(fn),
  setTimeout: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
  clearTimeout: id => timers.delete(id),
});
const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
await module.link(s => {
  const exports = s.endsWith("state.js") ? { config } : { bgmUrl: key => key ? `/${key}.mp3` : null };
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
});
await module.evaluate();
const audio = module.namespace, flush = () => new Promise(setImmediate);
const ready = a => { a.readyState = 3; a.emit("canplay"); };
const timeout = () => { for (const [id, t] of [...timers]) if (t.ms === 8000) { timers.delete(id); t.fn(); } };
// A normal MP3 must really reach canplay, not merely resolve its URL. No autoplay during preload.
let settled = false;
const preparation = audio.preloadBgm("title").then(value => { settled = true; return value; });
const duplicate = audio.preloadBgm("title");
await flush();
const title = elements.at(-1);
assert.equal(title.src, "/title.mp3"); assert.equal(title.preload, "auto");
assert.equal(settled, false); assert.equal(title.plays, 0); assert.equal(elements.length, 1);
ready(title); assert.equal(await preparation, true); assert.equal(await duplicate, true);
audio.playBgm("title"); await flush();
assert.equal(elements.length, 1); assert.equal(title.plays, 1); assert.equal(title.loop, true);
now = 1500; frames.splice(0).forEach(fn => fn()); assert.equal(title.volume, .5);
// Already requested, still loading: scene gate waits on the same element, no second fetch/player.
audio.playBgm("city"); const city = elements.at(-1), count = elements.length;
let citySettled = false; const cityReady = audio.preloadBgm("city").then(v => { citySettled = true; return v; });
await flush(); assert.equal(citySettled, false); assert.equal(elements.length, count);
ready(city); assert.equal(await cityReady, true);
// A foreground request that catches up with prefetch must consume the SAME pending player.
for (const outcome of ["ready", "error", "timeout", "stop", "replace"]) {
  const p = audio.preloadBgm(`race-${outcome}`); await flush();
  const waiting = elements.at(-1), before = elements.length;
  audio.playBgm(`race-${outcome}`);
  assert.equal(elements.length, before, "Pending preload must not create another player");
  if (outcome === "stop") audio.stopBgm(0);
  if (outcome === "replace") audio.playBgm("replacement");
  if (outcome === "error") waiting.emit("error");
  else if (outcome === "timeout") timeout();
  else ready(waiting);
  assert.equal(await p, !["error", "timeout"].includes(outcome)); await flush();
  assert.equal(waiting.plays, outcome === "ready" ? 1 : 0, "Only the still-current successful request may play");
  if (outcome !== "ready") assert.equal(waiting.src, "", "Obsolete/failed prepared media is released");
  if (["error", "timeout"].includes(outcome)) {
    const retry = audio.preloadBgm(`race-${outcome}`); await flush();
    const restored = elements.at(-1); ready(restored); assert.equal(await retry, true);
    audio.playBgm(`race-${outcome}`); await flush();
    assert.equal(restored.plays, 1, "Retry of the same failed key must not be skipped as already playing");
  }
}
// Invalid media and a stuck mobile preload are bounded, clean listeners/sources and can retry.
let failed = audio.preloadBgm("broken"); await flush(); const broken = elements.at(-1); broken.emit("error");
assert.equal(await failed, false); assert.equal(broken.src, ""); assert.equal(broken.paused, true);
failed = audio.preloadBgm("slow"); await flush(); const slow = elements.at(-1); timeout();
assert.equal(await failed, false); assert.equal(slow.src, ""); assert.equal(slow.listeners.get("canplay").size, 0);
const retry = audio.preloadBgm("slow"); await flush(); const retried = elements.at(-1); assert.notEqual(retried, slow);
ready(retried); assert.equal(await retry, true);
// Bounded prepared cache. Evicting pending preparation resolves false and never starts playback.
const waits = [];
for (const key of ["a", "b", "c", "d"]) { waits.push(audio.preloadBgm(key)); await flush(); }
assert.equal(await waits[0], false);
const a = elements.find(el => el.src === "/a.mp3"); assert.equal(a, undefined);
for (const el of elements.filter(el => ["/b.mp3", "/c.mp3", "/d.mp3"].includes(el.src))) ready(el);
assert.deepEqual(await Promise.all(waits.slice(1)), [true, true, true]);
assert.equal(await audio.preloadBgm(null), false);
// A media decode error after playBgm must not leave the same key permanently silent.
audio.playBgm("media-error");
const mediaError = elements.at(-1);
mediaError.emit("error");
audio.unlockAudio();
const mediaRetry = elements.at(-1);
assert.notEqual(mediaRetry, mediaError);
assert.equal(mediaRetry.plays, 1, "the next gesture retries the failed music");
assert.equal(timers.size, 0);
console.log("[BGM readiness] PASS: MP3 canplay gate, no autoplay, reuse, active request, failure/retry, timeout and bounded cache");
