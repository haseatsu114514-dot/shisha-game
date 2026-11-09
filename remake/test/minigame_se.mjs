// ミニゲームの仮SE（grok/minigame-audio）: 表の各キューが実ファイル・出典台帳に結びつき、音量・ミュート・未読込の代用音に従うこと。
// node --experimental-vm-modules remake/test/minigame_se.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import vm from "node:vm";

const ROOT = new URL("../../", import.meta.url);
const code = await fs.readFile(new URL("remake/js/core/audio.js", ROOT), "utf8");

async function boot({ fail = false } = {}) {
  const config = { seVolume: .6, bgmVolume: .5 };
  const sources = [], requests = [], bytes = new Map();
  let oscillators = 0;
  class Param { value = 0; setValueAtTime(v) { this.value = v; } linearRampToValueAtTime(v) { this.value = v; }
    exponentialRampToValueAtTime(v) { this.value = v; } setTargetAtTime(v) { this.value = v; } cancelScheduledValues() {} }
  class Node {
    gain = new Param(); frequency = new Param(); Q = new Param(); playbackRate = new Param();
    connect(node) { return node; } disconnect() {} start() { sources.push(this); } stop() { this.onended?.(); }
  }
  class AudioContext {
    state = "running"; currentTime = 0; sampleRate = 8000; destination = {};
    createGain() { return new Node(); } createBiquadFilter() { return new Node(); }
    createOscillator() { oscillators++; return new Node(); } createBufferSource() { return new Node(); }
    createBuffer(_c, n) { return { getChannelData: () => new Float32Array(n) }; }
    async decodeAudioData(buffer) { return { file: bytes.get(buffer), duration: 1 }; }
    addEventListener() {}
  }
  const context = vm.createContext({ document: { hidden: false, addEventListener() {} }, window: { AudioContext }, console, Math, Promise, Date, AbortController,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    fetch: async url => {
      requests.push(url);
      if (fail) return { ok: false, status: 404 };
      const b = await fs.readFile(new URL(url, new URL("remake/", ROOT)));
      const data = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); bytes.set(data, url.split("/se/").at(-1));
      return { ok: true, arrayBuffer: async () => data };
    } });
  const module = new vm.SourceTextModule(code, { context });
  await module.link(specifier => {
    const exports = specifier.endsWith("state.js") ? { config } : { bgmUrl: () => null };
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
  });
  await module.evaluate();
  return { audio: module.namespace, config, sources, requests, oscillators: () => oscillators };
}

const { audio } = await boot();
const cues = audio.MINIGAME_SE;
const files = Object.values(cues).flatMap(cue => cue.files);
assert(files.length > 0);

// 1) Every cue resolves to a real mono 44.1 kHz 16-bit WAV of a sensible length, and every fallback is an existing synth SE.
for (const [id, cue] of Object.entries(cues)) {
  assert(cue.files.length > 0, id);
  assert(cue.gain > 0 && cue.gain <= 1, id);
  assert(cue.fallback === null || typeof audio.SE[cue.fallback] === "function", `${id} fallback ${cue.fallback}`);
  for (const file of cue.files) {
    const b = await fs.readFile(new URL(`assets/audio/se/${file}`, ROOT));
    assert.equal(b.toString("ascii", 0, 4), "RIFF", file); assert.equal(b.toString("ascii", 8, 12), "WAVE", file);
    assert.equal(b.readUInt16LE(22), 1, `${file} mono`); assert.equal(b.readUInt32LE(24), 44100, file); assert.equal(b.readUInt16LE(34), 16, file);
    const seconds = (b.length - 44) / (44100 * 2);
    assert(seconds > .1 && seconds < 3, `${file} ${seconds}s`);
  }
}
// 2) No orphan file in the folder, and every file is in the source ledger with the same hash.
const folder = (await fs.readdir(new URL("assets/audio/se/minigame/", ROOT))).filter(name => name.endsWith(".wav")).map(name => `minigame/${name}`);
assert.deepEqual([...folder].sort(), [...new Set(files)].sort(), "assets/audio/se/minigame holds exactly the registered cues");
const ledger = JSON.parse(await fs.readFile(new URL("asset_sources/music/minigame-se/game_files.json", ROOT), "utf8"));
for (const file of files) {
  const entry = ledger.find(item => item.file === `assets/audio/se/${file}`);
  assert(entry, `${file} in game_files.json`);
  assert.equal(createHash("sha256").update(await fs.readFile(new URL(entry.file, ROOT))).digest("hex"), entry.sha256, `${file} hash`);
}
const sources = JSON.parse(await fs.readFile(new URL("asset_sources/music/minigame-se/sources.json", ROOT), "utf8"));
assert(sources.originals.length > 0);
for (const original of sources.originals) {
  assert.equal(original.license, "CC0-1.0", original.file);
  assert.match(original.source_url, /^https:\/\//, original.file);
  await fs.access(new URL(original.repository_original, ROOT));
}
// 3) Every playMinigameSe("…") call in the game names a registered cue.
const calls = [];
async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await scan(url);
    else if (entry.name.endsWith(".js")) for (const m of (await fs.readFile(url, "utf8")).matchAll(/playMinigameSe\("([A-Za-z]+)"\)/g)) calls.push(m[1]);
  }
}
await scan(new URL("remake/js/", ROOT));
assert(calls.length >= 6, "the axe throw uses the cues");
for (const id of calls) assert(cues[id], `unknown cue ${id}`);

// 4) Behaviour: nothing before unlock; recordings after preload; mute is silent; a missing file falls back to the synth (or stays silent).
const live = await boot();
live.audio.playMinigameSe("axeThunk");
assert.equal(live.sources.length + live.oscillators(), 0, "no sound before a user unlock");
assert.equal(await live.audio.preloadMinigameSe("axe"), false);
live.audio.unlockAudio();
assert.equal(await live.audio.preloadMinigameSe("axe"), true, "all axe cues decode");
const before = live.oscillators();
for (const id of Object.keys(cues)) live.audio.playMinigameSe(id);
assert.equal(live.oscillators(), before, "loaded cues use the recordings");
assert.deepEqual(live.sources.slice(-Object.keys(cues).length).map(s => s.buffer.file.split("/")[0]), Object.keys(cues).map(() => "minigame"));
live.audio.playMinigameSe("axeThunk"); const first = live.sources.at(-1).buffer.file;
live.audio.playMinigameSe("axeThunk"); assert.notEqual(live.sources.at(-1).buffer.file, first, "thunk variants do not repeat back to back");
live.config.muted = true; const count = live.sources.length;
live.audio.playMinigameSe("axeWin"); assert.equal(live.sources.length, count, "mute silences the cues");
live.config.muted = false; live.config.seVolume = 0;
live.audio.playMinigameSe("axeWin"); assert.equal(live.sources.length, count, "SE volume 0 silences the cues");

const missing = await boot({ fail: true });
missing.audio.unlockAudio();
await missing.audio.preloadMinigameSe("axe");
missing.audio.playMinigameSe("axeThunk");
assert(missing.oscillators() > 0, "missing recording falls back to the synth hit");
const quiet = missing.oscillators();
missing.audio.playMinigameSe("axeDrop");
assert.equal(missing.oscillators(), quiet, "the drop has no synth fallback (the caller plays the miss tone)");
console.log(`minigame SE: ${Object.keys(cues).length} cues, ${files.length} files, ${calls.length} call sites OK`);
