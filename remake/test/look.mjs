// 本編の様式の移行と検査用の旧描画。
import assert from "node:assert/strict";
import { LOOKS, BASE_LOOK, PLAYER_DEFAULT_LOOK, LOOK_VERSION, LOOK_CHAPTERS, defaultLook, normalizeLook, effectiveLook, migrateLook } from "../js/core/look.js";

assert.deepEqual(LOOKS.map((look) => look.id), ["neo", "classic", "vertical"]);
assert.equal(BASE_LOOK, "classic", "何も重ねない素の様式は旧版");
assert.equal(PLAYER_DEFAULT_LOOK, "vertical", "プレイヤーの既定は縦画面（LK24。2026-11-27 オーナー「縦画面をメインにする」）");
assert.equal(LOOK_VERSION, 4);
assert.equal(LOOK_CHAPTERS.neo, null, "新版はすべての章（LK13）");
assert.equal(LOOK_CHAPTERS.vertical, null, "縦画面はすべての章（VPN17。第1章から作り、日常パートを第2章以降へ広げた）");

// 自動操作の印（navigator.webdriver）を差し替えて、両方の既定を確かめる
const withWebdriver = (value, run) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  Object.defineProperty(globalThis, "navigator", { value: { webdriver: value }, configurable: true });
  try { return run(); } finally {
    if (had) Object.defineProperty(globalThis, "navigator", had); else delete globalThis.navigator;
  }
};
const asPlayer = (run) => withWebdriver(false, run);
const asAutomation = (run) => withWebdriver(true, run);

assert.equal(asPlayer(defaultLook), "vertical", "プレイヤーの端末の既定は縦画面（LK24）");
assert.equal(asAutomation(defaultLook), "classic", "自動操作のブラウザの既定は旧版（既存の検査は旧版の画面を測る）");
assert.equal(withWebdriver(undefined, defaultLook), "vertical", "印が無い環境はプレイヤーとして扱う");

for (const bad of [undefined, null, "", "ds", "retro", "NEO", 1, {}]) {
  assert.equal(asPlayer(() => normalizeLook(bad)), "vertical", `知らない値はプレイヤーの既定: ${String(bad)}`);
  assert.equal(asAutomation(() => normalizeLook(bad)), "classic", `知らない値は自動操作の既定: ${String(bad)}`);
}
for (const { id } of LOOKS) assert.equal(normalizeLook(id), id);

// 旧版はどの章でも旧版
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("classic", chapter), "classic");
// 新版はすべての章で効く（LK13）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("neo", chapter), "neo", `新版は第${chapter ?? "?"}章でも新版`);
// 縦画面はすべての章で効く（VPN17）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("vertical", chapter), "vertical", `縦画面は第${chapter ?? "?"}章でも縦画面（VPN17）`);

// 旧設定・すでに移行済みの設定を含めて、どの版から起動しても本編は縦画面。
for (const lookVersion of [undefined, 1, 2, 3, LOOK_VERSION]) {
  for (const look of [undefined, "classic", "neo", "retro", "vertical"]) {
    const cfg = { look, lookVersion, bgmVolume: 0.2 };
    assert.equal(asPlayer(() => migrateLook(cfg)), "vertical");
    assert.deepEqual(cfg, { look: "vertical", lookVersion: LOOK_VERSION, bgmVolume: 0.2 });
    assert.equal(asAutomation(() => migrateLook({ look, lookVersion })), look === "vertical" ? "vertical" : "classic");
  }
}
console.log("look: ok");
