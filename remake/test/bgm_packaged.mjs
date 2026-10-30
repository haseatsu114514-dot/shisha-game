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
const PACKED = new Set(["bgm_tournament_edm", "bgm_tournament_craft", "bgm_trpg", "bgm_axe", "bgm_purikura", "bgm_purikura_b", "bgm_purikura_d"]);
const urlFor = (key) => `/assets/audio/bgm/${key}.${PACKED.has(key) ? "bgm" : "mp3"}`;
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

// J03: 章を跨いだ後に大会曲の復元が完了しても、街の曲を奪わない。
gate = new Promise((r) => { release = r; });
audio.playBgm("bgm_tournament_craft");
const lateTournament = elements.at(-1);
audio.playBgm("kansetsu_shomei_to_black_coffee");
const city = elements.at(-1), count = elements.length;
release(); gate = null;
assert(await audio.preloadBgm("bgm_tournament_craft"));
await flush(); step(1500); await flush();
assert.equal(lateTournament.plays, 0);
assert.equal(lateTournament.paused, true);
assert.equal(lateTournament.volume, 0);
assert.equal(audio.currentBgm(), "kansetsu_shomei_to_black_coffee");
assert.equal(city.plays, 1);
audio.playBgm("kansetsu_shomei_to_black_coffee");
assert.equal(elements.length, count, "Repeated city requests must not add a second player");
audio.stopBgm(0); await flush();

const adopted = [
  ["bgm_purikura_b", 1, "261ef59e56d13ecb0838435f251970b7fcc605dd961ad72fd2767a4df48624ef"],
  ["bgm_purikura_d", 1, "f9723ed4ecc2218c93220bc27115115cd1a4b1ffb006040476056b28c1eb7a95"],
  ["bgm_purikura", 1, "f6324843cb2fb655f15b8fa56e0563ad0bf429f77390bb918610467aa09ca76b"],
  ["bgm_tournament_edm", .51, "20792d529ccbca2619cd7b08b53ef2ef6a234a35ad7be64a3e99ccc32a8ea179"],
  ["bgm_tournament_craft", .67, "35330cb7cc63d846183d46e304a13ff177ab604a379120fab3a1c7b79ef5389b"],
  // #788 ユーザー採用曲（TRPG: Shared Discovery）。倍率は既定1.0。
  ["bgm_trpg", 1, "802704c66066d7fa02d6f3ccdbb140ed07d05267c97692835765bb5c8853786f"],
  // #788 斧投げ（Aiming groove）。tonari と同程度の音量にそろえる倍率0.79。
  ["bgm_axe", .79, "39dbd283e0a5711a62e382d3e347e6b08612e8d60c10cda9cc12963f559f9b53"],
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
// #788 TRPG入店→同じ曲の再入場→退店でマップ曲へ戻る。二重再生せず、旧曲は止まる。ミュートは0。
{
  audio.stopBgm(0); await flush();
  audio.playBgm("kansetsu_shomei_to_black_coffee"); step(1500);
  const map = elements.at(-1);
  audio.playBgm("bgm_trpg"); await flush(); step(1500);
  const trpg = elements.at(-1);
  assert.equal(audio.currentBgm(), "bgm_trpg");
  await flush();
  assert.equal(map.volume, 0); assert.equal(map.paused, true);
  const count = elements.length;
  audio.playBgm("bgm_trpg"); await flush(); step(1500);
  assert.equal(elements.length, count, "re-entry must not start a second TRPG track");
  config.mute = true; audio.applyVolumes(); assert.equal(trpg.volume, 0);
  config.mute = false; audio.applyVolumes(); assert.equal(trpg.volume, config.bgmVolume);
  audio.playBgm("kansetsu_shomei_to_black_coffee"); await flush(); step(1500);
  assert.equal(audio.currentBgm(), "kansetsu_shomei_to_black_coffee");
  await flush();
  assert.equal(trpg.volume, 0); assert.equal(trpg.paused, true);
}
// #788 マップ→斧投げ→マップ。二重再生せず、実効音量は 0.79×設定値、ミュートは0。
{
  audio.stopBgm(0); await flush();
  audio.playBgm("kansetsu_shomei_to_black_coffee"); step(1500);
  const map = elements.at(-1);
  audio.playBgm("bgm_axe"); await flush(); step(1500); await flush();
  const axe = elements.at(-1);
  assert.equal(audio.currentBgm(), "bgm_axe");
  assert.equal(map.volume, 0); assert.equal(map.paused, true);
  assert.equal(axe.volume, config.bgmVolume * .79);
  const count = elements.length;
  audio.playBgm("bgm_axe"); await flush(); step(1500);
  assert.equal(elements.length, count, "re-entry must not start a second axe track");
  assert.equal(axe.plays, 1);
  config.bgmVolume = .8; audio.applyVolumes(); assert.equal(axe.volume, .8 * .79);
  config.mute = true; audio.applyVolumes(); assert.equal(axe.volume, 0);
  config.mute = false; audio.applyVolumes(); assert.equal(axe.volume, .8 * .79);
  config.bgmVolume = .5; audio.applyVolumes();
  audio.playBgm("kansetsu_shomei_to_black_coffee"); await flush(); step(1500); await flush();
  assert.equal(audio.currentBgm(), "kansetsu_shomei_to_black_coffee");
  assert.equal(axe.volume, 0); assert.equal(axe.paused, true);
  assert.equal(elements.at(-1).volume, config.bgmVolume, "map track returns at its own level");
}
// 入店時にTRPG曲、退店時にマップ曲（既存の退店処理）。
{
  const trpgSource = await fs.readFile(new URL("../js/daily/trpg.js", import.meta.url), "utf8");
  assert.match(trpgSource, /showScreen\("trpg", host\); playBgm\("bgm_trpg"\)/);
  assert.match(trpgSource, /playBgm\("kansetsu_shomei_to_black_coffee"\)/);
}
console.log("[packaged BGM] PASS: official audio hashes, caching, gains, cancellation and playback races");
