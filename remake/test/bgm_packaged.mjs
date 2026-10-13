// 実際のゲーム専用音源の復元・音量・非同期切替を検証する。
// node --experimental-vm-modules remake/test/bgm_packaged.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { webcrypto, createHash } from "node:crypto";

const root = new URL("../../", import.meta.url);
const config = { bgmVolume: .5, seVolume: .7 };
const elements = [], frames = [], blobs = new Map(), requests = new Map();
let now = 0, gate = null, failNextFetch = true;
class Audio {
  constructor(src) { this.src = src || ""; this.volume = 0; this.plays = 0; elements.push(this); }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  addEventListener() {}
}
class AudioContext {
  state = "running"; destination = {};
  createGain() { return { gain: { value: 0 }, connect() {} }; }
}
const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false }, config,
  crypto: webcrypto, Uint8Array, TextDecoder, Blob, console,
  URL: { createObjectURL(blob) { const url = `blob:${blobs.size}`; blobs.set(url, blob); return url; } },
  fetch: async (url) => {
    requests.set(url, (requests.get(url) || 0) + 1);
    if (failNextFetch) { failNextFetch = false; return { ok: false, status: 503 }; }
    if (gate) await gate;
    const bytes = await fs.readFile(new URL(url.slice(1), root));
    return { ok: true, arrayBuffer: async () => Uint8Array.from(bytes).buffer };
  },
  performance: { now: () => now }, requestAnimationFrame: (fn) => frames.push(fn),
});
const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
const urlFor = (key) => `/assets/audio/bgm/${key}.${key.startsWith("bgm_tournament_") ? "bgm" : "mp3"}`;
await module.link((s) => {
  const exports = s.endsWith("state.js") ? { config } : { bgmUrl: urlFor };
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await module.evaluate();
const audio = module.namespace;
const step = (ms) => { now += ms; frames.splice(0).forEach((fn) => fn()); };
const flush = () => new Promise(setImmediate);

// 先読みの通信失敗をキャッシュせず、次回は公式音源を取得し直せる。
assert.equal(await audio.preloadBgm("bgm_tournament_edm"), false);
requests.clear();

// 読み込み中に止めた曲を、取得完了後に鳴らさない。
let release;
gate = new Promise((r) => { release = r; });
audio.playBgm("bgm_tournament_edm");
const stopped = elements.at(-1);
audio.stopBgm(0);
release(); gate = null;
assert(await audio.preloadBgm("bgm_tournament_edm"));
await flush();
assert.equal(stopped.plays, 0);
assert.equal(stopped.paused, true);
assert.equal(audio.currentBgm(), null);

const adopted = [
  ["bgm_tournament_edm", .51, "3ed10a23e30bada9814d9401371ac9643cce6825d66cb626997f4b14398920d1"],
  ["bgm_tournament_craft", .67, "fd9856eb18725aff6c91d25f90522d0e9be82ed3f9e09ea5c026e00fe577b050"],
];
for (const [key, gain, expectedHash] of adopted) {
  assert(await audio.preloadBgm(key));
  audio.playBgm(key); await flush(); step(1500);
  const a = elements.at(-1);
  assert.equal(a.plays, 1);
  assert.equal(a.loop, true);
  assert.equal(a.volume, config.bgmVolume * gain);
  const blob = blobs.get(a.src);
  assert.equal(blob.type, "audio/mpeg");
  assert.equal(createHash("sha256").update(Buffer.from(await blob.arrayBuffer())).digest("hex"), expectedHash);
  config.bgmVolume = .2; audio.applyVolumes();
  assert.equal(a.volume, .2 * gain);
  audio.stopBgm(0); await flush();
  assert.equal(a.volume, 0); assert.equal(a.paused, true);
  assert.equal(requests.get(urlFor(key)), 1, "Preloading/replaying downloaded the same track again");
  config.bgmVolume = .5;
}

// 旧曲のplay()が遅れて失敗しても、次に鳴っている曲を自動再生待ちに戻さない。
let rejectOld;
const originalPlay = Audio.prototype.play;
Audio.prototype.play = () => new Promise((_, reject) => { rejectOld = reject; });
audio.playBgm("tonari");
Audio.prototype.play = originalPlay;
audio.playBgm("bgm_tournament_craft"); await flush();
rejectOld(new Error("old playback was interrupted")); await flush();
assert.equal(audio.currentBgm(), "bgm_tournament_craft");

// フェードイン完了前に切り替えるとき、旧曲は単調に下がって停止する。
audio.stopBgm(0); await flush();
audio.playBgm("tonari"); step(300);
const fading = elements.at(-1);
const before = fading.volume;
audio.playBgm("title"); step(300);
assert(fading.volume <= before);
step(400); await flush();
assert.equal(fading.volume, 0);
assert.equal(fading.paused, true);
console.log("[packaged BGM] PASS: official audio hashes, caching, gains, cancellation and playback races");
