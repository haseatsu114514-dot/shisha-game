// ミニゲームの録音SE台帳と、斧投げ専用の合成SEの出力・音量制御。
// node --experimental-vm-modules remake/test/minigame_se.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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
  assert(original.repository_original.startsWith("asset_sources/music/minigame-se/"), original.file);
  // Quick CI uses sparse checkout: read the committed source blob without checking out the whole source tree.
  const committed = execFileSync("git", ["show", `HEAD:${original.repository_original}`], {
    cwd: fileURLToPath(ROOT), maxBuffer: 2 * 1024 * 1024,
  });
  assert.equal(committed.length, original.bytes, `${original.file} bytes`);
  assert.equal(createHash("sha256").update(committed).digest("hex"), original.sha256, `${original.file} hash`);
}
// 3) Legacy recorded cue calls stay registered. The axe scene plays its own set (AXE_SE, section 5),
// with the synthesized layers as the fallback until the files are loaded.
const calls = [];
async function scan(dir) {
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? "/" : ""), dir);
    if (entry.isDirectory()) await scan(url);
    else if (entry.name.endsWith(".js")) for (const m of (await fs.readFile(url, "utf8")).matchAll(/playMinigameSe\("([A-Za-z]+)"\)/g)) calls.push(m[1]);
  }
}
await scan(new URL("remake/js/", ROOT));
for (const id of calls) assert(cues[id], `unknown cue ${id}`);
const axeCode = await fs.readFile(new URL("remake/js/minigames/axe.js", ROOT), "utf8");
// 斧投げが鳴らす音（2026-11-11 作り直し）: 呼び出しの引数に出てくる id を集め、AXE_SE の全部と失敗音（miss・合成のまま）がそろうこと。
const axeIds = new Set([...audio.AXE_SE ? Object.keys(audio.AXE_SE) : [], "miss"]);
const axeCalls = [...axeCode.matchAll(/playAxeSe\(([^;]*?)\)(?:;|\s*$)/gm)].flatMap(match => [...match[1].matchAll(/"([A-Za-z]+)"/g)].map(word => word[1])).filter(id => axeIds.has(id));
assert.deepEqual([...new Set(axeCalls)].sort(), ["throw", "stop", "call", "cueDrum", "cueClear", "stick", "killshot", "bounce", "drop", "miss", "cheer", "win", "lose"].sort());

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
const synthesized = await boot();
synthesized.audio.unlockAudio();
for (const id of ["throw", "stick", "drop", "miss", "cheer", "win", "lose"]) {
  const count = synthesized.sources.length;
  synthesized.audio.playAxeSe(id);
  assert(synthesized.sources.length > count, `${id} must schedule an audible layer`);
}
const scheduled = synthesized.sources.length;
synthesized.config.muted = true;
synthesized.audio.playAxeSe("stick");
assert.equal(synthesized.sources.length, scheduled, "mute silences the synthesized axe impact");
synthesized.config.muted = false; synthesized.config.seVolume = 0;
synthesized.audio.playAxeSe("throw");
assert.equal(synthesized.sources.length, scheduled, "SE volume zero silences the synthesized axe throw");
// 5) 斧投げの音（2026-11-11 オーナー「斧投げ……なんか効果音しょぼかったり」で作り直し）。
// ファイル: モノラル 44.1kHz 16bit・長さ・台帳（asset_sources/music/axe-throw-sfx/game_files.json の SHA-256）。フォルダに登録外のファイルが無い。
const AXE = audio.AXE_SE;
const axeLedger = JSON.parse(await fs.readFile(new URL("asset_sources/music/axe-throw-sfx/game_files.json", ROOT), "utf8"));
const axeOwn = [...new Set(Object.values(AXE).flatMap(cue => cue.files))].filter(file => file.startsWith("axe_throw/"));
const axeFolder = (await fs.readdir(new URL("assets/audio/se/axe_throw/", ROOT))).filter(name => name.endsWith(".wav")).map(name => `axe_throw/${name}`);
assert.deepEqual([...axeFolder].sort(), [...axeOwn].sort(), "assets/audio/se/axe_throw holds exactly the registered axe sounds");
const axeLength = { "axe_throw/throw.wav": .62, "axe_throw/hit_1.wav": .7, "axe_throw/hit_2.wav": .7, "axe_throw/hit_3.wav": .7, "axe_throw/killshot.wav": 1.4,
  "axe_throw/bounce.wav": .35, "axe_throw/drop.wav": .9, "axe_throw/stop.wav": .12, "axe_throw/call.wav": .45, "axe_throw/cue_drum.wav": .9, "axe_throw/cue_clear.wav": 1 };
assert.deepEqual(Object.keys(axeLength).sort(), [...axeOwn].sort());
for (const file of axeOwn) {
  const b = await fs.readFile(new URL(`assets/audio/se/${file}`, ROOT));
  assert.equal(b.toString("ascii", 0, 4), "RIFF", file); assert.equal(b.readUInt16LE(22), 1, `${file} mono`);
  assert.equal(b.readUInt32LE(24), 44100, file); assert.equal(b.readUInt16LE(34), 16, file);
  assert(Math.abs((b.length - 44) / (44100 * 2) - axeLength[file]) < .01, `${file} length`);
  const entry = axeLedger.find(item => item.file === `assets/audio/se/${file}`);
  assert(entry, `${file} in the axe ledger`);
  assert.equal(createHash("sha256").update(b).digest("hex"), entry.sha256, `${file} hash`);
  assert.match(entry.source, /自作/);
}
for (const [id, cue] of Object.entries(AXE)) assert(cue.gain > 0 && cue.gain <= 2 && cue.files.length > 0, id);
// 鳴らし方: 最初の操作の前は読まない。読めば全部の音が録音で鳴り（合成音を使わない）、刺さる音の3種は続けて同じものにならない。
// 勝ちはファンファーレと歓声を一緒に。0点で刺さった時は少し小さく。ミュート・音量0では鳴らない。
const axe = await boot();
assert.equal(await axe.audio.preloadAxeSe(), false, "nothing loads before a user unlock");
axe.audio.unlockAudio();
assert.equal(await axe.audio.preloadAxeSe(), true, "all axe sounds decode");
const axeOsc = axe.oscillators(), axeStart = axe.sources.length;
for (const id of Object.keys(AXE)) axe.audio.playAxeSe(id);
assert.equal(axe.oscillators(), axeOsc, "loaded axe sounds use the files, not the synth");
assert.equal(axe.sources.length - axeStart, Object.keys(AXE).length + 1, "one file each, and two together for the win");
const winFiles = axe.sources.slice(-4).map(source => source.buffer.file);
assert(Object.values(axe.audio.axeSePlayed()).every(count => count.recorded === 1 && count.synth === 0), JSON.stringify(axe.audio.axeSePlayed()));
assert(axe.sources.some(source => source.buffer?.file === "minigame/axe_win.wav") && axe.sources.some(source => source.buffer?.file === "minigame/axe_cheer.wav"), `the win is a fanfare with a cheer (${winFiles})`);
let previousHit = null;
for (let i = 0; i < 6; i++) {
  axe.audio.playAxeSe("stick");
  const file = axe.sources.at(-1).buffer.file;
  assert.match(file, /^axe_throw\/hit_[123]\.wav$/); assert.notEqual(file, previousHit, "the three hits do not repeat back to back"); previousHit = file;
}
axe.config.muted = true; const axeMuted = axe.sources.length;
axe.audio.playAxeSe("killshot"); axe.audio.playAxeSe("throw");
assert.equal(axe.sources.length, axeMuted, "mute silences the axe sounds");
axe.config.muted = false;
// 読めない時（取得失敗）は合成音で鳴る（今までの音）
const axeMissing = await boot({ fail: true });
axeMissing.audio.unlockAudio();
await axeMissing.audio.preloadAxeSe();
for (const id of Object.keys(AXE)) {
  const count = axeMissing.sources.length;
  axeMissing.audio.playAxeSe(id);
  assert(axeMissing.sources.length > count, `${id} falls back to an audible synth layer`);
}
assert(Object.values(axeMissing.audio.axeSePlayed()).every(count => count.synth === 1 && count.recorded === 0));
console.log(`minigame SE: ${Object.keys(cues).length} recorded cues, ${files.length} files; axe: ${Object.keys(AXE).length} sounds (${axeOwn.length} new files) and ${new Set(axeCalls).size} ids played by the game OK`);
