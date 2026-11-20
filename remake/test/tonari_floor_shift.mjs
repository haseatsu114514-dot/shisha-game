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
// 店の売上を財布・私物へ混ぜない。中断・LOAD では進み具合を残さない。
// 店のファンの合計は flags._tonari_floor に残り、次の営業へ渡る。
// ワンオペの営業は「今日の注文」の記録（_shift_order_・_shift_mix_）に触れない。
// たまに遊びに来る本編の人物は、顔見知り・好感度1以上・その章に来られる人だけ。はじめての営業には来ない。好感度は動かさない。
const VISITORS = { tsumugi: { id: "tsumugi", chapters: [1, 2] }, naru: { id: "naru", chapters: [1] }, adam: { id: "adam", chapters: [1, 2] } };
const text = await fs.readFile(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
const start = text.indexOf("const SHIFT_ORDERS = [");
assert(start >= 0);
async function floorBoundary(mode) {
  const account = { day: 4, chapter: 1, weatherSeed: 18, flags: { _shift_mix_citrus: 1 }, money: 30000, inventory: { mint: 3 },
    met: { tsumugi: true }, affinity: { tsumugi: 9, adam: 30 } };
  const context = vm.createContext({ state: account, DB: { dialogues: {} }, tsumugiAtTonari: () => false,
    TONARI_BG: "tonari", play: async () => ({}), isRainy: () => false, timeOfDay: () => "night",
    bgUrl: () => "bg", setBg: async () => {}, toast: () => {}, affinityLevel: (id) => ((account.affinity[id] || 0) >= 9 ? 1 : 0) });
  const calls = [];
  const view = new vm.SyntheticModule(["runTonariFloor", "FLOOR_VISITORS"], function () {
    this.setExport("FLOOR_VISITORS", VISITORS);
    this.setExport("runTonariFloor", async options => {
      calls.push(options);
      if (mode === "load") context.state = { ...account, flags: {} };
      if (mode === "abandon") return null;
      return calls.length === 1
        ? { sales: 16800, rank: "A", stamp: "上々", bonus: 1000, fans: 6 }
        : { sales: 9000, rank: "B", stamp: "まずまず", bonus: 500, fans: -9 };
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
  assert.equal("presets" in calls[0], false, "定番の持ち越しは無い（ミックスは一覧から選ぶ）");
  assert.equal(calls[0].fans, 0);
  assert.equal("anchor" in calls[0], false, "今日の注文の客は、ワンオペの営業には混ぜない");
  assert.equal(calls[0].visitor, null, "はじめての営業には、本編の人物は来ない");
  if (mode === "done") {
    assert.equal(result.bonus, 1000);
    // 別realmの値なので文字列で比べる
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":1,"best":"A","fans":6}');
    // 次の営業へ、ファンの合計を渡す。評価は良かったほうを残し、ファンは0を下回らない。
    const second = await module.namespace.serveFloorOrder(account, signal);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].level, 1);
    assert.equal(calls[1].fans, 6);
    assert.equal(second.bonus, 500);
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":2,"best":"A","fans":0}');
  } else {
    assert.equal(result, null);
    assert.equal(account.flags._tonari_floor, undefined);
  }
  assert.equal(account.flags["_shift_order_1:4"], undefined, "今日の注文は済んだことにしない");
  assert.equal(account.flags._shift_mix_citrus, 1, "前に出した一台の記録を書き換えない");
  assert.equal(account.money, 30000); assert.deepEqual(account.inventory, { mint: 3 });
  assert.equal(JSON.stringify(account.affinity), '{"tsumugi":9,"adam":30}', "営業で好感度は動かない");
  if (mode !== "done") return;
  // 来る人: 顔見知り（met）で好感度1以上のつむぎだけ。アダムは好感度があっても面識が無いので来ない。なるは面識も好感度も無い。
  const seen = new Set();
  for (let day = 1; day <= 60; day++) { account.day = day; await module.namespace.serveFloorOrder(account, signal); seen.add(calls.at(-1).visitor); }
  assert.deepEqual([...seen].sort(), ["tsumugi", null].sort(), "来るのは条件を満たす人だけ。来ない日のほうが多い");
  const rate = calls.slice(-60).filter((c) => c.visitor).length;
  assert.ok(rate >= 4 && rate <= 24, `たまに来る（60日で${rate}回）`);
  // 第2章ではなるは来ない（店を休んで修行に出ている）。面識と好感度がそろえば、アダムは来る
  Object.assign(account, { chapter: 2, met: { tsumugi: true, naru: true, adam: true }, affinity: { tsumugi: 9, naru: 20, adam: 30 } });
  const later = new Set();
  for (let day = 1; day <= 80; day++) { account.day = day; await module.namespace.serveFloorOrder(account, signal); later.add(calls.at(-1).visitor); }
  assert.deepEqual([...later].sort(), ["adam", "tsumugi", null].sort());
}
for (const mode of ["done", "load", "abandon"]) await floorBoundary(mode);
// 画面を読み込めない時は、いつもの「今日の注文」へ戻す（進み具合は増やさない）。
{
  const account = { day: 4, chapter: 1, weatherSeed: 18, flags: {}, money: 30000 };
  let modals = 0;
  const context = vm.createContext({ state: account, DB: { dialogues: {} }, tsumugiAtTonari: () => false, TONARI_BG: "tonari",
    play: async () => ({}), isRainy: () => false, timeOfDay: () => "noon", bgUrl: () => "bg", setBg: async () => {},
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
console.log("tonari floor: AUTO/manual save, owner replacement, fans carry-over, progress and fallback OK");
