// Production audio module: decode/cache, missing files, mute, held draws and late loads.
// node --experimental-vm-modules remake/test/recorded_se.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const code = await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8");
async function boot({ fail = false, deferred = false } = {}) {
  const config = { seVolume: .6, bgmVolume: .5 };
  const sources = [], requests = [], intervals = new Map(), timers = new Map(), listeners = new Map(), bytes = new Map();
  let serial = 0, oscillatorCount = 0, release;
  const gate = deferred ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
  class Param {
    value = 0;
    setValueAtTime(v) { this.value = v; }
    linearRampToValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime(v) { this.value = v; }
    setTargetAtTime(v) { this.value = v; }
    cancelScheduledValues() {}
  }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); playbackRate = new Param(); stops = [];
    connect(node) { this.destination = node; return node; }
    disconnect() { this.disconnected = true; }
    start() { sources.push(this); }
    stop(t) { this.stops.push(t); if (!t) this.onended?.(); }
  }
  class AudioContext {
    state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
    createGain() { return new Node(); }
    createBiquadFilter() { return new Node(); }
    createOscillator() { oscillatorCount++; return new Node(); }
    createBufferSource() { return new Node(); }
    createBuffer(_channels, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData(buffer) { return { file: bytes.get(buffer), duration: 1.28 }; }
    addEventListener() {}
  }
  const document = { hidden: false, addEventListener: (type, fn) => listeners.set(type, fn) };
  const context = vm.createContext({ document, window: { AudioContext }, console, Math, Promise, Date, AbortController,
    setTimeout: fn => { const id = ++serial; timers.set(id, fn); return id; }, clearTimeout: id => timers.delete(id),
    setInterval: fn => { const id = ++serial; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id),
    fetch: async url => {
      requests.push(url); await gate;
      if (fail) return { ok: false, status: 404 };
      const b = await fs.readFile(new URL(url, new URL("../", import.meta.url)));
      const data = b.buffer.slice(b.byteOffset, b.byteOffset+b.byteLength); bytes.set(data, url.split("/").at(-1));
      return { ok: true, arrayBuffer: async () => data };
    },
  });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    const exports = specifier.endsWith("state.js") ? { config } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  return { audio: module.namespace, config, document, sources, requests, intervals, timers, release,
    oscillators: () => oscillatorCount,
    visibility(hidden) { document.hidden = hidden; listeners.get("visibilitychange")(); },
  };
}

const loaded = await boot();
assert.equal(await loaded.audio.preloadSe(), false);
loaded.audio.SE.click();
assert.equal(loaded.sources.length, 0, "no recorded playback before a user unlock");
assert.equal(loaded.requests.length, 0);
loaded.audio.unlockAudio();
assert.equal(await loaded.audio.preloadSe(), true);
assert.equal(loaded.requests.length, new Set(loaded.requests).size, "concurrent warmups fetch each file once");
assert.equal(loaded.timers.size, 0, "load timeout timers are cleaned up");
for (const id of ["click", "select", "cancel", "phone", "doorbell", "coalSnip", "coalPlace", "foilPunch", "bubbling"]) loaded.audio.SE[id]();
assert.equal(loaded.oscillators(), 0, "loaded effects use decoded recordings");
assert(loaded.sources.every(source => source.buffer.file), "all effect files are present");
const firstGrab = loaded.sources.find(s => s.buffer.file.startsWith("coal_grab"));
loaded.audio.SE.coalSnip();
assert.notEqual(loaded.sources.at(-1).buffer.file, firstGrab.buffer.file, "avoid immediately repeating a tong variant");
const voicesBefore = loaded.sources.length;
loaded.config.mute = true; loaded.audio.applyVolumes();
loaded.audio.SE.phone();
assert.equal(loaded.sources.length, voicesBefore);
assert(loaded.sources.every(s => s.stops.length), "muting stops already active recordings");
loaded.config.mute = false; loaded.audio.applyVolumes();

const stop = loaded.audio.startBubbling({ strength: .65 });
const loop = loaded.sources.at(-1);
assert.equal(loop.buffer.file, "water_loop.wav"); assert.equal(loop.loop, true);
assert(Math.abs(loop.playbackRate.value-(.88+.12*.65)) < 1e-9);
const bus = loop.destination.destination;
assert.equal(bus.gain.value, .6, "recorded loop shares the existing SE volume bus");
loaded.config.seVolume = .25; loaded.audio.applyVolumes(); assert.equal(bus.gain.value, .25);
loaded.visibility(true);
assert(loop.stops.length, "hidden tabs stop water immediately");
const hiddenCount = loaded.sources.length; loaded.audio.SE.click(); assert.equal(loaded.sources.length, hiddenCount);
loaded.visibility(false);
assert.equal(loaded.sources.at(-1).buffer.file, "water_loop.wav", "visible held draw resumes");
loaded.config.muted = true; loaded.audio.applyVolumes();
const mutedCount = loaded.sources.length;
loaded.config.muted = false; loaded.audio.applyVolumes(); assert.equal(loaded.sources.length, mutedCount+1);
stop();
assert.equal(loaded.sources.at(-1).buffer.file, "water_end.wav", "a normal stop has one last bubble");
const stoppedCount = loaded.sources.length; stop(); loaded.visibility(true); loaded.visibility(false);
assert.equal(loaded.sources.length, stoppedCount, "a stopped draw never resumes or emits a second tail");
assert.equal(loaded.intervals.size, 0);
const silentStop = loaded.audio.startBubbling(); loaded.config.seVolume = 0; loaded.audio.applyVolumes();
const silentCount = loaded.sources.length; silentStop(); assert.equal(loaded.sources.length, silentCount, "silent stop has no tail");

const failure = await boot({ fail: true }); failure.audio.unlockAudio();
assert.equal(await failure.audio.preloadSe(), false);
const attempts = failure.requests.length;
failure.audio.SE.click(); assert(failure.oscillators() > 0, "missing recordings keep the existing synthetic fallback");
await failure.audio.preloadSe(); assert.equal(failure.requests.length, attempts, "failed requests are backed off");
const stopFallback = failure.audio.startBubbling(); assert.equal(failure.intervals.size, 1);
failure.config.mute = true; failure.audio.applyVolumes(); assert.equal(failure.intervals.size, 0);
stopFallback(); assert.equal(failure.intervals.size, 0);

const slow = await boot({ deferred: true }); slow.audio.unlockAudio();
const stopSlow = slow.audio.startBubbling(); assert.equal(slow.intervals.size, 1);
stopSlow(); slow.release(); await slow.audio.preloadSe();
await Promise.resolve();
assert(!slow.sources.some(source => source.buffer?.file), "late decoding cannot replay a completed draw");
assert.equal(slow.intervals.size, 0);
console.log("PASS: recorded files, cache, user unlock, mute/volume, variants, water loop/tail, visibility/resume, failed-file fallback/backoff, late-load cancellation");
