import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import { VISITORS } from "../js/daily/tonari-floor-data.js";
import * as game from "../js/core/state.js";
import { growthPerks } from "../js/core/growth-effects.js";

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
owner.stamina -= 40;
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
restored.stamina -= 40; restored.money += 9680; restored.slot += 2; // 基本給8,000円＋売上16,800円の歩合
release();
assert(game.saveToSlot(slot));
assert.deepEqual([game.loadFromSlot(slot).money, game.state.slot, game.state.visitedDay.tonari_baito],
  [JSON.parse(before).money + 9680, 2, 4]);

// 店番（フロア営業）と本編の境界（画面はここでは代役）。店番は昼から夜まで（TFL62）で、いつものシフト・今日の注文は無い（TFL63）。
// 店の売上を財布・私物へ混ぜない。中断・LOAD では進み具合を残さない。
// 店のファンの合計は flags._tonari_floor に残り、次の営業へ渡る。
// たまに遊びに来る本編の人物は、顔見知り・好感度1以上・その章に来られる人だけ。はじめての営業には来ない。好感度は動かさない。
// 開店前の札で「遊び方（チュートリアル）」を選ぶと、チュートリアルを開いてから同じ一日を始め直す（TFL64）。

const text = await fs.readFile(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
const start = text.indexOf("// 店番の一日。");
assert(start >= 0);
const sliced = (context, importModuleDynamically) => new vm.SourceTextModule(text.slice(start) + "\nexport { serveFloor, floorTutorial };", { context, importModuleDynamically });
async function floorBoundary(mode) {
  const account = { day: 4, chapter: 1, slot: 0, weatherSeed: 18, flags: { _shift_mix_citrus: 1 }, money: 30000, inventory: { mint: 3 },
    met: { tsumugi: true }, affinity: { tsumugi: 9, adam: 30 } };
  const context = vm.createContext({ state: account, TONARI_BG: "tonari", growthPerks, isRainy: () => false,
    bgUrl: (_, time) => `bg-${time}`, toast: () => {}, affinityLevel: (id) => ((account.affinity[id] || 0) >= 9 ? 1 : 0) });
  const calls = [];
  const view = new vm.SyntheticModule(["runTonariFloor", "FLOOR_VISITORS"], function () {
    this.setExport("FLOOR_VISITORS", VISITORS);
    this.setExport("runTonariFloor", async options => {
      calls.push(options);
      if (options.tutorial) return { tutorial: true, skipped: false };
      if (mode === "load") context.state = { ...account, flags: {} };
      if (mode === "abandon") return null;
      if (mode === "again" && calls.length === 1) return { again: "tutorial" };
      return calls.filter((c) => !c.tutorial).length === (mode === "again" ? 2 : 1)
        ? { sales: 16800, rank: "A", stamp: "上々", fans: 6 }
        : { sales: 9000, rank: "B", stamp: "まずまず", fans: -9 };
    });
  }, { context });
  await view.link(() => { throw Error("unexpected import"); });
  await view.evaluate();
  const module = sliced(context, async path => { assert.equal(path, "./tonari-floor-view.js"); return view; });
  await module.link(() => { throw Error("unexpected import"); });
  await module.evaluate();
  const signal = new AbortController().signal;
  const result = await module.namespace.serveFloor(account, signal, () => 1200);
  if (mode === "again") {
    // 遊び方を選んだ: チュートリアル → 同じ一日（同じ種）をもう一度
    assert.deepEqual(calls.map((c) => !!c.tutorial), [false, true, false]);
    assert.equal(calls[2].seed, calls[0].seed);
    assert.equal(calls[2].getAllowances(), 1200);
    assert.equal(account.flags._tonari_floor_tutorial, true);
    assert.equal(result.sales, 16800);
    return;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].level, 0, "はじめての営業は level 0");
  assert.equal(calls[0].chapter, 1);
  assert.equal(calls[0].getAllowances(), 1200);
  // 昼から夜まで（2コマ・TFL62）: 昼の店内で始まり、半ばで夜の絵に替わる
  assert.deepEqual([calls[0].night, calls[0].dusk, calls[0].art, calls[0].artNight], [false, true, "bg-day", "bg-night"]);
  assert.equal(calls[0].offerTutorial, true, "開店前の札から、いつでも遊び方を見られる");
  assert.equal("presets" in calls[0], false, "定番の持ち越しは無い（ミックスは一覧から選ぶ）");
  assert.equal(calls[0].fans, 0);
  assert.equal("anchor" in calls[0], false, "今日の注文の客は、ワンオペの営業には混ぜない");
  assert.equal(calls[0].visitor, null, "はじめての営業には、本編の人物は来ない");
  if (mode === "done") {
    assert.equal(result.sales, 16800);
    // 別realmの値なので文字列で比べる
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":1,"best":"A","fans":6,"top":16800}');
    assert.equal(calls[0].topSales, 0, "はじめての営業には、売上の記録が無い");
    // 次の営業へ、ファンの合計を渡す。評価は良かったほうを残し、ファンは0を下回らない。
    const second = await module.namespace.serveFloor(account, signal);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].level, 1);
    assert.equal(calls[1].fans, 6);
    assert.equal(second.sales, 9000);
    assert.equal(calls[1].topSales, 16800, "次の営業へ、売上の最高を渡す");
    // 売上の最高は、超えた時だけ書き換える（2回目の 9,000円では変わらない）
    assert.equal(JSON.stringify(account.flags._tonari_floor), '{"nights":2,"best":"A","fans":0,"top":16800}');
    // チュートリアル: 済んだら印を残す（飛ばしても同じ）
    assert.equal(await module.namespace.floorTutorial(account, signal), true);
    assert.equal(calls.at(-1).tutorial, true);
    assert.equal(account.flags._tonari_floor_tutorial, true);
  } else {
    assert.equal(result, null);
    assert.equal(account.flags._tonari_floor, undefined);
  }
  assert.equal(account.flags._shift_mix_citrus, 1, "旧セーブの今日の注文の記録は、書き換えない（読む所も無い）");
  assert.equal(account.money, 30000); assert.deepEqual(account.inventory, { mint: 3 });
  assert.equal(JSON.stringify(account.affinity), '{"tsumugi":9,"adam":30}', "営業で好感度は動かない");
  if (mode !== "done") return;
  // 来る人: 顔見知り（met）で好感度1以上のつむぎだけ。アダムは好感度があっても面識が無いので来ない。なるは面識も好感度も無い。
  const seen = new Set();
  for (let day = 1; day <= 60; day++) { account.day = day; await module.namespace.serveFloor(account, signal); seen.add(calls.at(-1).visitor); }
  assert.deepEqual([...seen].sort(), ["tsumugi", null].sort(), "来るのは条件を満たす人だけ。来ない日のほうが多い");
  const rate = calls.slice(-60).filter((c) => c.visitor).length;
  assert.ok(rate >= 4 && rate <= 24, `たまに来る（60日で${rate}回）`);
  account.growth = { nodes: ["B8", "B22", "W7", "S9"] };
  for (let day = 1; day <= 60; day++) { account.day = day; await module.namespace.serveFloor(account, signal); }
  const trained = calls.slice(-60);
  assert.deepEqual([trained[0].floorPerks.floorMatch, trained[0].floorPerks.floorTop], [8, 4], "盤の強化が本番の店番へ渡る");
  assert.ok(trained.every(c => !c.visitor || c.visitor === "tsumugi"), "来店強化でも面識・好感度・章の条件を守る");
  assert.ok(trained.filter(c => c.visitor).length > rate, "同じ60日に盤の来店強化を加えると、来る日が増える");
  // 第2章ではなるは来ない（店を休んで修行に出ている）。面識と好感度がそろえば、アダムは来る
  Object.assign(account, { chapter: 2, met: { tsumugi: true, naru: true, adam: true }, affinity: { tsumugi: 9, naru: 20, adam: 30 } });
  const newcomers = ["ageha", "kumicho", "kuraudo", "samechan"];
  for (const id of ["minto", ...newcomers]) { account.met[id] = true; account.affinity[id] = 9; }
  for (const id of newcomers) assert(!VISITORS[id].chapters.includes(1));
  const later = new Set();
  for (let day = 1; day <= 365; day++) { account.day = day; await module.namespace.serveFloor(account, signal); later.add(calls.at(-1).visitor); }
  assert.deepEqual([...later].sort(), ["adam", "tsumugi", "minto", ...newcomers, null].sort());
}
for (const mode of ["done", "load", "abandon", "again"]) await floorBoundary(mode);
// 画面を読み込めない時は、歩合なしで勤務だけ済ませる（進み具合は増やさない。旧バイトへは戻さない）。チュートリアルも、無しで進める。
{
  const account = { day: 4, chapter: 1, slot: 0, weatherSeed: 18, flags: {}, money: 30000 };
  const toasts = [];
  const context = vm.createContext({ state: account, TONARI_BG: "tonari", growthPerks, isRainy: () => false, bgUrl: () => "bg",
    toast: (text) => toasts.push(text), affinityLevel: () => 0 });
  const module = sliced(context, async () => { throw Error("offline"); });
  await module.link(() => { throw Error("unexpected import"); });
  await module.evaluate();
  const result = await module.namespace.serveFloor(account, new AbortController().signal);
  assert.equal(result.fallback, true);
  assert.equal(result.sales, 0);
  assert.equal(toasts.length, 1);
  assert.equal(account.flags._tonari_floor, undefined);
  assert.equal(await module.namespace.floorTutorial(account, new AbortController().signal), true);
  assert.equal(account.flags._tonari_floor_tutorial, undefined, "読めなかったチュートリアルは、済んだことにしない");
}
console.log("tonari floor: AUTO/manual save, owner replacement, noon-to-night shift, tutorial replay, fans carry-over, progress and fallback OK");
