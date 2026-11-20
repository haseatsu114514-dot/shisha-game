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

// フロア営業と本編の境界（画面はここでは代役）。
// 店の売上を財布・私物へ混ぜない。中断・LOAD では注文の記録も進み具合も残さない。
// その日の「今日の注文」の客が受け取った一台だけを、次に同じ注文が来た時の想起（_shift_mix_）へ渡す。
import { MIXES } from "../js/daily/tonari-floor-data.js";
const text = await fs.readFile(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
const start = text.indexOf("const SHIFT_ORDERS = [");
assert(start >= 0);
async function orderBoundary(mode) {
  const account = { day: 4, chapter: 1, weatherSeed: 18, flags: {}, money: 30000, inventory: { mint: 3 } };
  const context = vm.createContext({ state: account, DB: { dialogues: {} }, tsumugiAtTonari: () => false,
    TONARI_BG: "tonari", play: async () => ({}), FLOOR_MIXES: MIXES, isRainy: () => false, timeOfDay: () => "night",
    bgUrl: () => "bg", setBg: async () => {}, toast: () => {} });
  const calls = [];
  const view = new vm.SyntheticModule(["runTonariFloor"], function () {
    this.setExport("runTonariFloor", async options => {
      calls.push(options);
      if (options.anchor) {
        assert(MIXES[`${options.anchor.family}:${options.anchor.index}`], "今日の注文は、フロアの配合にある注文");
        account.flags["_shift_mix_" + options.anchor.family] ??= 1; // 以前の提供記録
      }
      if (mode === "load") context.state = { ...account, flags: {} };
      if (mode === "abandon") return null;
      return { sales: 16800, rank: calls.length === 1 ? "A" : "B", stamp: "上々", bonus: 1000, anchorIndex: mode === "unserved" ? null : 0 };
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
  const result = await module.namespace.serveFloorOrder(account, signal);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].level, 0, "はじめての営業は level 0");
  assert.equal(calls[0].chapter, 1);
  assert.equal(calls[0].night, true);
  const family = calls[0].anchor.family;
  if (mode === "served" || mode === "unserved") {
    assert.equal(result.bonus, 1000);
    assert.equal(account.flags["_shift_order_1:4"], true);
    assert.equal(account.flags["_shift_mix_" + family], mode === "served" ? 0 : 1, "受け取らなかった一台で前の記録を書き換えない");
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":1,"best":"A"}'); // 別realmの値なので文字列で比べる
    // 同じ日にもう一度開いても、その日の注文の客は重ねて来ない。評価は良かったほうを残す。
    await module.namespace.serveFloorOrder(account, signal);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].anchor, null);
    assert.equal(calls[1].level, 1);
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":2,"best":"A"}');
    assert.equal(account.flags["_shift_mix_" + family], mode === "served" ? 0 : 1);
  } else {
    assert.equal(result, null);
    assert.equal(account.flags["_shift_order_1:4"], undefined);
    assert.equal(account.flags._tonari_floor, undefined);
    assert.equal(account.flags["_shift_mix_" + family], 1);
  }
  assert.equal(account.money, 30000); assert.deepEqual(account.inventory, { mint: 3 });
}
for (const mode of ["served", "unserved", "load", "abandon"]) await orderBoundary(mode);
// 画面を読み込めない時は、いつもの「今日の注文」へ戻す（進み具合は増やさない）。
{
  const account = { day: 4, chapter: 1, weatherSeed: 18, flags: {}, money: 30000 };
  let modals = 0;
  const context = vm.createContext({ state: account, DB: { dialogues: {} }, tsumugiAtTonari: () => false, TONARI_BG: "tonari",
    play: async () => ({}), FLOOR_MIXES: MIXES, isRainy: () => false, timeOfDay: () => "noon", bgUrl: () => "bg", setBg: async () => {},
    toast: () => {}, modal: async () => { modals++; return 0; } });
  const module = new vm.SourceTextModule(text.slice(start) + "\nexport { serveFloorOrder };", {
    context, importModuleDynamically: async () => { throw Error("offline"); },
  });
  await module.link(() => { throw Error("unexpected import"); });
  await module.evaluate();
  const result = await module.namespace.serveFloorOrder(account, new AbortController().signal);
  assert.equal(result.fallback, true);
  assert.equal(result.bonus, 0);
  assert.equal(modals, 1);
  assert.equal(account.flags["_shift_order_1:4"], true);
  assert.equal(account.flags._tonari_floor, undefined);
}
console.log("tonari floor: AUTO/manual save, owner replacement, order memory, progress and fallback OK");
