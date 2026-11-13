// 見た目の様式（core/look.js・LK01・LK09）: プレイヤーの既定は新版、自動操作のブラウザの既定は旧版、
// 新版・DS風はすべての章で効く（LK13・LK21）、まだ選んでいない端末は一度だけ既定へ移す。
import assert from "node:assert/strict";
import { LOOKS, BASE_LOOK, PLAYER_DEFAULT_LOOK, LOOK_CHAPTERS, defaultLook, normalizeLook, effectiveLook, migrateLook } from "../js/core/look.js";

assert.deepEqual(LOOKS.map((look) => look.id), ["neo", "classic", "retro"]);
assert.equal(BASE_LOOK, "classic", "何も重ねない素の様式は旧版");
assert.equal(PLAYER_DEFAULT_LOOK, "neo", "プレイヤーの既定は新版");
assert.equal(LOOK_CHAPTERS.neo, null, "新版はすべての章（LK13）");
assert.equal(LOOK_CHAPTERS.retro, null, "DS風もすべての章（LK21）");

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

assert.equal(asPlayer(defaultLook), "neo", "プレイヤーの端末の既定は新版");
assert.equal(asAutomation(defaultLook), "classic", "自動操作のブラウザの既定は旧版（既存の検査は旧版の画面を測る）");
assert.equal(withWebdriver(undefined, defaultLook), "neo", "印が無い環境はプレイヤーとして扱う");

for (const bad of [undefined, null, "", "ds", "NEO", 1, {}]) {
  assert.equal(asPlayer(() => normalizeLook(bad)), "neo", `知らない値はプレイヤーの既定: ${String(bad)}`);
  assert.equal(asAutomation(() => normalizeLook(bad)), "classic", `知らない値は自動操作の既定: ${String(bad)}`);
}
for (const { id } of LOOKS) assert.equal(normalizeLook(id), id);

// 旧版はどの章でも旧版
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("classic", chapter), "classic");
// 新版はすべての章で効く（LK13）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("neo", chapter), "neo", `新版は第${chapter ?? "?"}章でも新版`);
// DS風もすべての章で効く（LK21。章が分からないタイトルでも）
for (const chapter of [undefined, 1, 2, 3, 4, 5]) assert.equal(effectiveLook("retro", chapter), "retro", `DS風は第${chapter ?? "?"}章でもDS風`);

// 起動時の移行（LK09）
const migrate = (saved) => { const config = { ...saved }; const look = migrateLook(config); return [look, config.look, config.lookVersion]; };
asPlayer(() => {
  assert.deepEqual(migrate({}), ["neo", "neo", 1], "まだ選んでいない端末は新版");
  assert.deepEqual(migrate({ look: "classic" }), ["neo", "neo", 1], "#3256 の頃に当時の既定として保存された旧版は、一度だけ新版へ");
  assert.deepEqual(migrate({ look: "classic", lookVersion: 1 }), ["classic", "classic", 1], "選び直した旧版はそのまま");
  assert.deepEqual(migrate({ look: "retro" }), ["retro", "retro", 1], "DS風を選んでいた端末は変えない");
  assert.deepEqual(migrate({ look: "neo" }), ["neo", "neo", 1]);
  assert.deepEqual(migrate({ look: "bogus", lookVersion: 1 }), ["neo", "neo", 1], "壊れた値は既定へ");
});
asAutomation(() => {
  assert.deepEqual(migrate({}), ["classic", "classic", 1], "自動操作のブラウザは旧版が既定");
  assert.deepEqual(migrate({ look: "neo" }), ["neo", "neo", 1], "検査が明示して選んだ様式はそのまま");
  assert.deepEqual(migrate({ look: "retro" }), ["retro", "retro", 1]);
});
console.log("look: ok");
