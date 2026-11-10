// TRPG の卓に着いたらテーマ別BGMへ替え、閉じたら入る前の曲へ戻す。音量は効果音の設定に従う。
// node --experimental-vm-modules remake/test/trpg_audio_bgm.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const config = { seVolume: .7, bgmVolume: .5 };
let current = "bgm_trpg";
const played = [];
const gains = [];
class AudioContext {
  state = "running"; currentTime = 0; destination = {}; sampleRate = 8000;
  createGain() { const node = { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: n => n || node, disconnect() {} }; gains.push(node); return node; }
  createOscillator() { return { type: "", frequency: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect: n => n, disconnect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect: n => n, disconnect() {} }; }
  createBuffer() { return { getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: n => n, disconnect() {}, start() {}, stop() {}, playbackRate: { value: 1 } }; }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
}
const context = vm.createContext({ AudioContext, URL, document: { hidden: false, addEventListener() {}, removeEventListener() {} }, Math, console });
context.globalThis = context;
const source = await fs.readFile(new URL("../js/trpg/audio.js", import.meta.url), "utf8");
const module = new vm.SourceTextModule(source, { context, identifier: new URL("../js/trpg/audio.js", import.meta.url).href,
  initializeImportMeta(meta) { meta.url = new URL("../js/trpg/audio.js", import.meta.url).href; } });
const cues = await import("../js/trpg/audio-cues.js");
await module.link(specifier => {
  const exports = specifier.endsWith("state.js") ? { config }
    : specifier.endsWith("core/audio.js") ? { playBgm: key => { played.push(key); current = key; }, currentBgm: () => current }
    : { ...cues };
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
});
await module.evaluate();
const { createTrpgAudio } = module.namespace;

// 卓（view.js）は自分の音を作って setTheme し、閉じると destroy する。
const table = createTrpgAudio("heist");
assert.equal(table.enabled, true, "音は既定でON");
table.setTheme("heist");
assert.deepEqual(played, ["bgm_trpg_heist"]);
table.setTheme("heist");
assert.deepEqual(played, ["bgm_trpg_heist"], "同じテーマで曲を頭から流し直さない");
assert.equal(table.snapshot().ambience, 0, "BGMのあるテーマでは合成の環境音を重ねない");
table.destroy();
assert.deepEqual(played, ["bgm_trpg_heist", "bgm_trpg"], "閉じたらボドゲカフェの曲へ戻す");

// 本棚（library.js）と卓を行き来する共用の音: 本棚は bgm_trpg、卓はテーマの曲。
played.length = 0; current = null;
const shared = createTrpgAudio();
shared.setTheme("harbor"); shared.setTheme("mansion"); shared.setTheme("harbor"); shared.setTheme("sparkle");
assert.deepEqual(played, ["bgm_trpg", "bgm_trpg_mansion", "bgm_trpg", "bgm_purikura"]);
current = "kansetsu_shomei_to_black_coffee"; // 外で別の曲に替わっていたら、閉じても上書きしない
shared.destroy();
assert.deepEqual(played, ["bgm_trpg", "bgm_trpg_mansion", "bgm_trpg", "bgm_purikura"]);

// 効果音の音量は設定に従う（既定0.7で従来の .42、ミュートで0）。
const sound = createTrpgAudio("shark");
await sound.setEnabled(true);
const master = gains[gains.length - 2];
assert.equal(master.gain.value.toFixed(2), "0.42");
config.seVolume = .35; sound.play("tap");
assert.equal(master.gain.value.toFixed(2), "0.21");
config.mute = true; sound.play("tap");
assert.equal(master.gain.value, 0);
sound.destroy();
console.log("PASS: TRPG theme BGM switch/restore, ambience off under BGM, SE volume follows settings");
