// 見た目の様式（core/look.js・LK01・LK09・LK23）: 既定は旧版（プレイヤー・自動操作とも）、新版は設定で選べない（コードは残す）、
// 新版・DS風はすべての章で効く（LK13・LK21）、縦画面（煙の舞台・VPN01）は第1章だけ、まだ選んでいない端末は一度だけ既定へ移す。
import assert from "node:assert/strict";
import { LOOKS, DISABLED_LOOKS, BASE_LOOK, PLAYER_DEFAULT_LOOK, LOOK_CHAPTERS, defaultLook, normalizeLook, effectiveLook, migrateLook } from "../js/core/look.js";

assert.deepEqual(LOOKS.map((look) => look.id), ["neo", "classic", "retro", "vertical"]);
assert.equal(BASE_LOOK, "classic", "何も重ねない素の様式は旧版");
assert.equal(PLAYER_DEFAULT_LOOK, "classic", "プレイヤーの既定は旧版（LK23）");
assert.deepEqual(DISABLED_LOOKS, ["neo"], "新版は設定で選べない（LK23。コードは残す）");
assert.equal(LOOK_CHAPTERS.neo, null, "新版はすべての章（LK13）");
assert.equal(LOOK_CHAPTERS.retro, null, "DS風もすべての章（LK21）");
assert.deepEqual(LOOK_CHAPTERS.vertical, [1], "縦画面は第1章から作っている（VPN01）");
assert(!DISABLED_LOOKS.includes("vertical"), "縦画面は設定で選べる");

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

assert.equal(asPlayer(defaultLook), "classic", "プレイヤーの端末の既定は旧版（LK23）");
assert.equal(asAutomation(defaultLook), "classic", "自動操作のブラウザの既定は旧版（既存の検査は旧版の画面を測る）");
assert.equal(withWebdriver(undefined, defaultLook), "classic", "印が無い環境はプレイヤーとして扱う");

for (const bad of [undefined, null, "", "ds", "NEO", 1, {}]) {
  assert.equal(asPlayer(() => normalizeLook(bad)), "classic", `知らない値はプレイヤーの既定: ${String(bad)}`);
  assert.equal(asAutomation(() => normalizeLook(bad)), "classic", `知らない値は自動操作の既定: ${String(bad)}`);
}
for (const { id } of LOOKS) assert.equal(normalizeLook(id), id);

// 旧版はどの章でも旧版
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("classic", chapter), "classic");
// 新版はすべての章で効く（LK13）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("neo", chapter), "neo", `新版は第${chapter ?? "?"}章でも新版`);
// DS風もすべての章で効く（LK21。章が分からないタイトルでも）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("retro", chapter), "retro", `DS風は第${chapter ?? "?"}章でもDS風`);
// 縦画面は第1章（章が分からないタイトルも第1章として）だけ。第2章からは旧版で表示する（VPN01）
for (const chapter of [undefined, 1]) assert.equal(effectiveLook("vertical", chapter), "vertical", `縦画面は第${chapter ?? "?"}章で縦画面`);
for (const chapter of [2, 3, 4, 5]) assert.equal(effectiveLook("vertical", chapter), "classic", `縦画面は第${chapter}章では旧版`);

// 起動時の移行（LK09→LK23）: 既定は旧版。新版を選んでいた端末は一度だけ旧版へ移す（lookVersion 2）。
const migrate = (saved) => { const config = { ...saved }; const look = migrateLook(config); return [look, config.look, config.lookVersion]; };
asPlayer(() => {
  assert.deepEqual(migrate({}), ["classic", "classic", 2], "まだ選んでいない端末は旧版");
  assert.deepEqual(migrate({ look: "classic" }), ["classic", "classic", 2]);
  assert.deepEqual(migrate({ look: "classic", lookVersion: 1 }), ["classic", "classic", 2], "選び直した旧版はそのまま");
  assert.deepEqual(migrate({ look: "retro" }), ["retro", "retro", 2], "DS風を選んでいた端末は変えない");
  assert.deepEqual(migrate({ look: "retro", lookVersion: 2 }), ["retro", "retro", 2]);
  assert.deepEqual(migrate({ look: "neo" }), ["classic", "classic", 2], "新版は選べなくなったので旧版へ移す（LK23）");
  assert.deepEqual(migrate({ look: "neo", lookVersion: 1 }), ["classic", "classic", 2], "新版を選んでいた端末も旧版へ移す（LK23）");
  assert.deepEqual(migrate({ look: "neo", lookVersion: 2 }), ["classic", "classic", 2], "?look= で一時的に選んだ新版も、次回起動では旧版へ戻る");
  assert.deepEqual(migrate({ look: "bogus", lookVersion: 1 }), ["classic", "classic", 2], "壊れた値は既定へ");
});
asAutomation(() => {
  assert.deepEqual(migrate({}), ["classic", "classic", 2], "自動操作のブラウザは旧版が既定");
  assert.deepEqual(migrate({ look: "neo" }), ["classic", "classic", 2]);
  assert.deepEqual(migrate({ look: "retro" }), ["retro", "retro", 2]);
});
console.log("look: ok");
