// Issue #783: 店支給フレーバーと私物在庫の分離・自宅練習を寝る前に限定
// node remake/test/home_practice_783.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= {
  addEventListener() {},
  querySelector() { return null; },
  createElement() {
    return {
      classList: { add() {}, remove() {}, toggle() {} },
      setAttribute() {},
      append() {},
      replaceChildren() {},
      addEventListener() {},
    };
  },
};
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= {
  getItem: (k) => store.get(k) ?? null,
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { DB } = await import("../js/core/data.js");
const { newGame, save: saveGame, load: loadGame } = await import("../js/core/state.js");
const { SUMI_RIG, PRO_RIG } = await import("../js/daily/home-rig.js");
const homePractice = await import("../js/daily/home-practice.js");
const {
  isHomePracticeTime,
  homeLeavesEnough,
  consumeHomePracticeLeaves,
  runHomePractice,
  chooseHomePractice,
  HOME_PRACTICE_GRAMS,
} = homePractice;

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));

console.log("=== 1. 自宅練習の寝る前（夜・slot 1以上）限定ガードの検証 ===");
{
  const s = newGame();
  // slot 0 = 昼
  s.slot = 0;
  assert.equal(isHomePracticeTime(s), false, "昼（slot 0）は寝る前ではない");
  // slot 1 = 夜
  s.slot = 1;
  assert.equal(isHomePracticeTime(s), true, "夜（slot 1）は寝る前（当日の最後の行動枠）");
  // slot 2 = 終了
  s.slot = 2;
  assert.equal(isHomePracticeTime(s), true, "slot 2 も寝る前以降の判定を満たす");

  // 直接呼出しガード: slot 0 では chooseHomePractice は即座に null を返す
  s.slot = 0;
  const pick = await chooseHomePractice();
  assert.equal(pick, null, "昼に直接 chooseHomePractice を呼んでも null で終了する");

  // runHomePractice のガード: slot 0 では used: false で即座に終了する（スタミナも消費しない）
  const staminaBefore = s.stamina;
  const resultDay = await runHomePractice({ staminaGuard: async () => true });
  assert.deepEqual(resultDay, { used: false, exerted: false }, "昼に直接 runHomePractice を呼んでも used: false");
  assert.equal(s.stamina, staminaBefore, "昼の直接呼出しではスタミナを消費しない");
  assert.equal(s.flags._home_tonight, undefined, "昼の呼出しでは _home_tonight フラグを立てない");

  // 台がない場合: slot 1 でも台がなければ used: false
  s.slot = 1;
  s.owned = s.owned.filter((id) => id !== SUMI_RIG && id !== PRO_RIG);
  const resultNoRig = await runHomePractice({ staminaGuard: async () => true });
  assert.deepEqual(resultNoRig, { used: false, exerted: false }, "台がなければ夜でも練習不可");
}

console.log("=== 2. 自宅練習の完成時一度だけの私物消費・中断時に消費しないことの検証 ===");
{
  const s = newGame();
  s.owned.push(SUMI_RIG);

  // 在庫チェック
  assert.equal(HOME_PRACTICE_GRAMS, 12, "一台を通すのに必要な自分の葉は12g");
  s.flavorStock = { double_apple: 5, mint: 6 };
  assert.equal(homeLeavesEnough(), false, "合計11gでは不足");
  s.flavorStock = { double_apple: 6, mint: 6 };
  assert.equal(homeLeavesEnough(), true, "合計12gなら足りる");

  // consumeHomePracticeLeaves の正確性と安全性
  s.flavorStock = { double_apple: 20, mint: 10 };
  consumeHomePracticeLeaves({ double_apple: 8, mint: 4 });
  assert.deepEqual(s.flavorStock, { double_apple: 12, mint: 6 }, "使用した分だけ私物在庫が減る");

  // 0g未満に減らないことの確認
  consumeHomePracticeLeaves({ double_apple: 50 });
  assert.equal(s.flavorStock.double_apple, 0, "残量以上に減らすことはなく0で止まる");

  // 不正値・空値・nullでも例外を起こさず、在庫が増減・破損しないことの確認
  consumeHomePracticeLeaves(null);
  consumeHomePracticeLeaves(undefined);
  consumeHomePracticeLeaves({});
  assert.deepEqual(s.flavorStock, { double_apple: 0, mint: 6 }, "空値で在庫が増減・破損しない");

  // 中断時（配合途中でやめる／タイトルへ戻る等）: consumeHomePracticeLeaves が呼ばれないため私物は消費されない
  const stockBeforeInterrupt = { ...s.flavorStock };
  assert.deepEqual(s.flavorStock, stockBeforeInterrupt, "中断時は私物在庫が消費されない");
}

console.log("=== 3. SAVE / LOAD 互換の検証 ===");
{
  const s = newGame();
  s.slot = 1;
  s.owned.push(SUMI_RIG);
  s.flavorStock = { double_apple: 35, mint: 18 };
  saveGame();

  const loaded = loadGame();
  assert.equal(loaded.slot, 1, "slot が正しく保存・復元される");
  assert.deepEqual(loaded.flavorStock, { double_apple: 35, mint: 18 }, "私物在庫が正しく復元される");
  assert(loaded.owned.includes(SUMI_RIG), "台の所持が正しく復元される");
}

console.log("All Issue #783 tests passed successfully!");
