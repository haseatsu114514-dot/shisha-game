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
// 会話の「BGMの息継ぎ」（#2828）: 曲の補正と音量設定を保ったまま約 −6dB へ寄せ、戻す。曲を替えると寄せは外れる
audio.duckBgm(.5, 150); step(200);
assert(Math.abs(elements[2].volume - .11) < 1e-9, "duck keeps the track gain and volume setting");
assert.equal(audio.bgmDuckLevel(), .5);
config.bgmVolume = .2; audio.applyVolumes(); assert(Math.abs(elements[2].volume - .055) < 1e-9, "settings change while ducked");
config.bgmVolume = .4; audio.applyVolumes();
audio.duckBgm(1, 400); step(450); assert(Math.abs(elements[2].volume - .22) < 1e-9, "duck released");
audio.duckBgm(.5); audio.playBgm("tonari"); step(1500);
assert.equal(audio.bgmDuckLevel(), 1); assert.equal(elements[3].volume, .4, "a new track starts unducked");
// 詩の無音は切替中の旧曲・新曲、音量変更、重複した区間をまたぐ。
const release = audio.silenceBgm();
assert.equal(elements[3].muted, true);
audio.playBgm("another");
assert.equal(elements[3].muted, true);
assert.equal(elements[4].muted, true);
config.bgmVolume = .3; audio.applyVolumes(); step(1500);
assert.equal(elements[4].muted, true);
const releaseNested = audio.silenceBgm();
release(); release();
assert.equal(elements[4].muted, true);
releaseNested();
assert.equal(elements[4].muted, false);
assert.equal(elements[4].volume, .3);
// 詩の無音テストは音量設定を .3 にする。以降の盤BGM復元検査は、直前までの .4 を前提にしている。
config.bgmVolume = .4;
audio.applyVolumes();
console.log("[BGM gain] PASS: shark track lowered, settings/fades retain gain, other tracks retain their setting, dialogue duck keeps both");

// The board borrows a real media-backed track without losing its gain/duck or reviving retiring media.
audio.playBgm("sweets_or_sweets"); step(1500); audio.duckBgm(.5, 0);
const releaseBoard = audio.createGrowthBoardAudio(); step(1500);
assert.equal(audio.currentBgm(), "bgm_growth_board");
releaseBoard(); step(1500);
assert.equal(audio.currentBgm(), "sweets_or_sweets");
assert.equal(audio.bgmDuckLevel(), .5);
assert(Math.abs(elements.at(-1).volume - .11) < 1e-9, "media restore retains track gain, current setting and prior duck");
assert(elements.slice(0, -1).every(a => a.volume === 0), "retiring board/previous media stay silent");
console.log("[BGM gain] PASS: media-backed board music restoration and retiring media");

// 本編の仮BGMは BGM_GAIN 未登録（倍率 1）。設定変更後も既定倍率が保たれること。
audio.duckBgm(1, 0);
config.bgmVolume = .4;
audio.applyVolumes();
for (const key of [
  "bgm_map", "bgm_tournament_wait", "bgm_result_emotional", "bgm_ending",
  "bgm_rival_shop", "bgm_dubai", "bgm_world_stage", "bgm_smoke_lab", "bgm_ch5_duel",
]) {
  audio.playBgm(key); step(1500);
  assert.equal(audio.currentBgm(), key, key);
  assert(Math.abs(elements.at(-1).volume - .4) < 1e-9, `${key} keeps default gain and volume setting`);
}
console.log("[BGM gain] PASS: story placeholder tracks use default gain");

