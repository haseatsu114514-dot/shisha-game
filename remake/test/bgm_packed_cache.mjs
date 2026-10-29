// .bgm（ゲーム専用形式）復元済み Blob の保持上限と破棄を検証する。
// node --experimental-vm-modules remake/test/bgm_packed_cache.mjs
// 上限を超えたら古い曲から Blob URL を解放し、再生中・フェード中の曲は守る。
// 破棄された曲は次の再生で取得・復元し直して鳴らせる（開始が壊れない）ことを確認する。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { webcrypto } from "node:crypto";

// 実際の形式（SUIENBGM1 + IV + AES-GCM）でテスト用の小さいパックを作る。
const PACKED_KEY = "ac0152dff6217d519198cfba347e25d5dc5d853aaee8252f72da0bbdc626b8f2";
const keyBytes = Uint8Array.from(PACKED_KEY.match(/../g), (hex) => parseInt(hex, 16));
const encKey = await webcrypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
const header = new TextEncoder().encode("SUIENBGM1");
const packs = new Map(), plains = new Map();
async function makePack(key) {
  const plain = new TextEncoder().encode(`packed-audio:${key}:`.padEnd(2048, key));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await webcrypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: header }, encKey, plain));
  const pack = new Uint8Array(header.length + iv.length + cipher.length);
  pack.set(header); pack.set(iv, header.length); pack.set(cipher, header.length + iv.length);
  packs.set(`/assets/audio/bgm/${key}.bgm`, pack);
  plains.set(key, plain);
}
for (const key of ["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9", "t10", "t11",
  "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8"]) await makePack(key);

async function loadAudio() {
  const config = { bgmVolume: .5, seVolume: .5 };
  const elements = [], frames = [], blobs = new Map(), revoked = [], fetches = new Map();
  const failUrls = new Set();
  let now = 0, blobSerial = 0;
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
  const context = vm.createContext({ Audio, window: { AudioContext }, document: { hidden: false },
    crypto: webcrypto, Uint8Array, TextDecoder, Blob, console,
    URL: {
      createObjectURL(blob) { const url = `blob:${++blobSerial}`; blobs.set(url, blob); return url; },
      revokeObjectURL(url) { revoked.push(url); blobs.delete(url); },
    },
    fetch: async (url) => {
      fetches.set(url, (fetches.get(url) || 0) + 1);
      if (failUrls.has(url)) return { ok: false, status: 503 };
      const pack = packs.get(url);
      if (!pack) return { ok: false, status: 404 };
      return { ok: true, arrayBuffer: async () => pack.slice().buffer };
    },
    performance: { now: () => now }, requestAnimationFrame: (fn) => frames.push(fn),
    setTimeout, clearTimeout });
  const module = new vm.SourceTextModule(await fs.readFile(new URL("../js/core/audio.js", import.meta.url), "utf8"), { context });
  await module.link((s) => {
    const exports = s.endsWith("state.js") ? { config }
      : { bgmUrl: (key) => key === "plain" ? "/assets/audio/bgm/plain.mp3" : `/assets/audio/bgm/${key}.bgm` };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [k, v] of Object.entries(exports)) this.setExport(k, v);
    }, { context });
  });
  await module.evaluate();
  const audio = module.namespace;
  const step = (ms) => { now += ms; frames.splice(0).forEach((fn) => fn()); };
  const flush = () => new Promise(setImmediate);
  // フェードを完了させるところまで進めて再生する。
  const play = async (key) => {
    audio.playBgm(key);
    assert(await audio.preloadBgm(key), `${key} preloads`);
    await flush(); step(1500); await flush();
    return elements.at(-1);
  };
  // フェードを進めない（＝前の曲がフェード中のまま）で再生だけ始める。
  const playNoStep = async (key) => {
    audio.playBgm(key);
    assert(await audio.preloadBgm(key), `${key} preloads`);
    await flush();
    return elements.at(-1);
  };
  const blobText = async (url) => Buffer.from(await blobs.get(url).arrayBuffer()).toString();
  return { audio, elements, blobs, revoked, fetches, failUrls, step, flush, play, playNoStep, blobText };
}

// ---- Phase A: 上限・LRU・再生中保護・再取得 ----
{
  const { audio, elements, blobs, revoked, fetches, failUrls, flush, play, blobText } = await loadAudio();

  // 6曲を順に鳴らすと、保持は直近5曲だけになり最古の t1 が解放される。
  const played = {};
  for (const key of ["t1", "t2", "t3", "t4", "t5", "t6"]) {
    played[key] = await play(key);
    assert.equal(played[key].plays, 1, `${key} plays`);
    assert.equal(await blobText(played[key].src), Buffer.from(plains.get(key)).toString(), `${key} decrypts`);
  }
  assert.equal(blobs.size, 5, "retained blobs are capped at 5");
  assert.deepEqual(revoked, [played.t1.src], "only the oldest track was evicted");
  assert.equal(fetches.get("/assets/audio/bgm/t1.bgm"), 1);

  // 再生中（t6）の曲は、後から3曲先読みしても破棄されない。破棄は古い順（t2→t3→t4）。
  for (const key of ["t7", "t8", "t9"]) assert(await audio.preloadBgm(key));
  await flush();
  assert(!revoked.includes(played.t6.src), "playing track is protected");
  assert.deepEqual(revoked.slice(1), [played.t2.src, played.t3.src, played.t4.src]);
  assert.equal(blobs.size, 5);
  assert.equal(audio.currentBgm(), "t6");

  // キャッシュヒットした曲は取得し直さず、新しい側へ寄る。止まった t6 は次の破棄対象になる。
  await play("t5");
  assert.equal(fetches.get("/assets/audio/bgm/t5.bgm"), 1, "cache hit does not refetch");
  assert(await audio.preloadBgm("t10")); await flush();
  assert(revoked.includes(played.t6.src), "stopped former track becomes evictable");
  assert(!revoked.includes(played.t5.src), "replayed track was refreshed, not evicted");

  // 破棄された曲も、次に鳴らすときは取得・復元し直して再生できる。
  const replayed = await play("t6");
  assert.equal(fetches.get("/assets/audio/bgm/t6.bgm"), 2, "evicted track is refetched on demand");
  assert.equal(replayed.plays, 1);
  assert.equal(await blobText(replayed.src), Buffer.from(plains.get("t6")).toString());
  assert.equal(audio.currentBgm(), "t6");

  // 取得失敗はキャッシュせず、再試行で復元できる（従来どおり）。
  failUrls.add("/assets/audio/bgm/t11.bgm");
  assert.equal(await audio.preloadBgm("t11"), false);
  failUrls.delete("/assets/audio/bgm/t11.bgm");
  assert.equal(await audio.preloadBgm("t11"), true);

  // 非パック（mp3）は Blob を作らず URL をそのまま鳴らす（従来どおり）。
  const before = blobs.size + revoked.length;
  audio.playBgm("plain"); await flush();
  assert.equal(elements.at(-1).src, "/assets/audio/bgm/plain.mp3");
  assert.equal(blobs.size + revoked.length, before, "mp3 path creates no blob");
}

// ---- Phase B: フェード中の旧曲は、フェードが終わるまで破棄されない ----
{
  const { audio, blobs, revoked, flush, playNoStep, step } = await loadAudio();
  const first = await playNoStep("f1");
  const second = await playNoStep("f2"); // f1 はフェード中（フレームを進めていない）
  assert.equal(audio.currentBgm(), "f2");
  for (const key of ["f3", "f4", "f5", "f6", "f7"]) assert(await audio.preloadBgm(key));
  await flush();
  assert(!revoked.includes(first.src), "fading track is protected until its fade ends");
  assert(!revoked.includes(second.src), "playing track is protected");
  assert.equal(blobs.size, 5, "cap still holds while protected tracks are skipped");
  // フェードが終われば使用中が外れ、次の先読みで最古として破棄される。
  step(2000); await flush();
  assert(await audio.preloadBgm("f8")); await flush();
  assert(revoked.includes(first.src), "faded-out track becomes evictable after release");
}

console.log("[packed BGM cache] PASS: LRU cap 5, playing/fading tracks protected, evicted tracks refetch and play");
