import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import * as game from "../js/core/state.js";

// 本物のセーブAPI: 長い勤務の途中で既存の会話がsaveしても、体力等の一部だけを保存しない。
const memory = new Map();
globalThis.localStorage = {
  getItem: k => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, String(v)),
  removeItem: k => memory.delete(k),
};
const slot = game.SAVE_SLOTS[1].key;
const owner = game.newGame();
owner.phase = "daily"; owner.day = 4; owner.slot = 0;
assert(game.saveToSlot(slot));
const before = memory.get(game.SAVE_KEY);
const outer = game.holdActionSave(owner), inner = game.holdActionSave(owner);
owner.stamina -= 24;
owner.visitedDay.tonari_baito = 4;
assert.equal(game.save(), false);
inner(); inner(); // 重複releaseで外側の保留を解かない。
assert.deepEqual(game.saveToSlotResult(slot), { autoSaved: false, manualSaved: false });
assert.equal(memory.get(slot), before);
assert.equal(memory.get(game.SAVE_KEY), before);
const restored = game.loadFromSlot(slot);
assert.notEqual(restored, owner);
assert.equal(restored.stamina, JSON.parse(before).stamina);
assert.equal(restored.visitedDay.tonari_baito, undefined);
assert(game.save(), "a replacement state is not locked by the old floor");
outer();
const release = game.holdActionSave(restored);
restored.visitedDay.tonari_baito = restored.day;
restored.stamina -= 24; restored.money += 8000; restored.slot++;
release();
assert(game.saveToSlot(slot));
assert.deepEqual([game.loadFromSlot(slot).money, game.state.slot, game.state.visitedDay.tonari_baito],
  [JSON.parse(before).money + 8000, 1, 4]);

// 実際の注文決定・主卓の記録と、画面（ここでは代役）との境界。
// 営業中の他卓の売上を財布・私物へ混ぜない。引継ぎ・LOAD時に架空のリピート記録を作らない。
const text = await fs.readFile(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
const start = text.indexOf("const SHIFT_ORDERS = [");
assert(start >= 0);
async function orderBoundary(mode) {
  const account = { day: 4, chapter: 1, weatherSeed: 18, flags: {}, money: 30000, inventory: { mint: 3 } };
  const context = vm.createContext({ state: account, DB: { dialogues: {} }, tsumugiAtTonari: () => false,
    TONARI_BG: "tonari", play: async () => ({ cancelled: mode === "cancel-reaction" }) });
  let screens = 0, anchor;
  const view = new vm.SyntheticModule(["runTonariFloor"], function () {
    this.setExport("runTonariFloor", async options => {
      screens++;
      anchor = options.anchorOrderId;
      assert(options.orders.some(o => o.id === anchor));
      account.flags["_shift_mix_" + anchor] = 1; // 以前の提供記録
      if (mode === "load") context.state = { ...account, flags: {} };
      return mode === "abandon" ? null : { sales: 16800, anchorIndex: mode === "unserved" ? null : 0 };
    });
  }, { context });
  await view.link(() => { throw Error("unexpected import"); });
  await view.evaluate();
  const module = new vm.SourceTextModule(text.slice(start) + "\nexport { serveFloorOrder };", {
    context, importModuleDynamically: async path => { assert.equal(path, "./tonari-floor-view.js"); return view; },
  });
  await module.link(() => { throw Error("unexpected import"); });
  await module.evaluate();
  const signal = new AbortController().signal;
  const success = await module.namespace.serveFloorOrder(account, signal);
  assert.equal(screens, 1);
  if (mode === "served" || mode === "unserved") {
    assert.equal(success, true);
    assert.equal(account.flags["_shift_order_1:4"], true);
    assert.equal(account.flags["_shift_mix_" + anchor], mode === "served" ? 0 : 1);
    await module.namespace.serveFloorOrder(account, signal);
    assert.equal(screens, 1, "same-day receipt cannot reopen");
  } else {
    assert.equal(success, false);
    assert.equal(account.flags["_shift_order_1:4"], undefined);
    assert.equal(account.flags["_shift_mix_" + anchor], 1);
  }
  assert.equal(account.money, 30000); assert.deepEqual(account.inventory, { mint: 3 });
}
for (const mode of ["served", "unserved", "load", "abandon", "cancel-reaction"]) await orderBoundary(mode);
console.log("tonari floor: AUTO/manual save, owner replacement, single receipt and legacy order memory OK");
