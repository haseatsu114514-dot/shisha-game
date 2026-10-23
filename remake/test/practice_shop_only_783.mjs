// Issue #783: 練習は店だけ。旧セーブの家練習の痕跡を読んでも私物在庫を失わない。
// node remake/test/practice_shop_only_783.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

const { DB } = await import("../js/core/data.js");
const { newGame, save, load, loadFromSlot } = await import("../js/core/state.js");
const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const src = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const flavors = read("../../data/flavors.json").flavors;
const equipment = read("../../data/equipment.json").equipment;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.recipes = read("../../data/recipes.json").recipes;
DB.ngMixes = read("../../data/ng_mixes.json").ng_mixes;
DB.dialogues = {};

// 家で練習していた旧セーブ（家練習の訪問記録・夜に家で終える印・工程の自己ベスト・私物の葉）
const oldSave = () => {
  const s = newGame();
  s.flavorStock = { double_apple: 37, mint: 5 };
  s.flavors = [...new Set([...(s.flavors || []), "double_apple", "mint"])];
  s.visitedDay = { ...(s.visitedDay || {}), home_practice: s.day };
  s.flags = { ...(s.flags || {}), _home_tonight: true };
  s.best = { heat: 1, pull: 2 };
  return s;
};

// オートセーブから LOAD
oldSave();
save();
const loaded = load();
assert(loaded, "家練習の痕跡がある旧セーブを読み込める");
assert.deepEqual(loaded.flavorStock, { double_apple: 37, mint: 5 }, "LOADで私物の葉を失わない");
assert.deepEqual(loaded.best, { heat: 1, pull: 2 }, "工程の自己ベストは残る");

// 手動セーブ枠から LOAD
const slotData = JSON.parse(JSON.stringify(oldSave()));
localStorage.setItem("suien_remake_slot1", JSON.stringify(slotData));
const fromSlot = loadFromSlot("suien_remake_slot1");
assert(fromSlot, "手動セーブ枠の旧セーブも読み込める");
assert.deepEqual(fromSlot.flavorStock, { double_apple: 37, mint: 5 }, "枠からのLOADでも私物の葉を失わない");
assert.deepEqual(fromSlot.best, { heat: 1, pull: 2 });

// 配合で私物在庫を減らすのは大会だけ（店の練習・リハーサル・チュートリアルでは減らさない）
const steps = src("../js/craft/steps.js");
assert(steps.includes('const consumes = cs.mode === "tournament";'), "減らすのは大会だけ");
assert(steps.includes("if (consumes) for (const [id, g] of Object.entries(cs.mix)) if (!supplied(id)) addFlavorStock(id, -g);"),
  "配合確定時の減算は大会の持ち込み分だけ");

// 第1章の案内に家の練習を残さない
assert(!src("../js/chapters/ch1.js").includes("家で練習する"), "第1章の案内から「家で練習する」を外す");


assert(!fs.existsSync(new URL("../js/daily/home-practice.js", import.meta.url)));
assert(!src("../js/daily/map.js").includes("map-home-practice"));
assert(!src("../js/daily/calendar.js").includes("runHomePractice"));
assert(!steps.includes('cs.venue === "home"'));
assert(!steps.includes('ownLeavesUsed'));

console.log("practice shop only 783: ok");
