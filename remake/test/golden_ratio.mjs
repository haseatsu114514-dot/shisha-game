// Issue #627: 配合の黄金比（割合・±5ポイント・境界を含む・整数で判定）
// node remake/test/golden_ratio.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};

const { DB } = await import("../js/core/data.js");
const { newGame } = await import("../js/core/state.js");
const { evaluateMix, goldenRatioOf, goldenLabel } = await import("../js/craft/steps.js");

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;
const recipes = read("../../data/recipes.json").recipes;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = read("../../data/equipment.json").equipment;
DB.equipById = Object.fromEntries(DB.equipment.map((e) => [e.id, e]));
DB.recipes = recipes;
DB.ngMixes = read("../../data/ng_mixes.json").ng_mixes;
const save = newGame();
save.chapter = 1;

// データ: golden はオーナー確定分だけ。キーは flavors と同じ系統ID、値は正の整数
const withGolden = recipes.filter((r) => r.golden);
assert.deepEqual(withGolden.map((r) => r.id), ["ice_lemonade"], "golden is only for owner-confirmed recipes");
for (const r of withGolden) {
  assert.deepEqual(Object.keys(r.golden).sort(), [...r.flavors].sort(), `${r.id}: golden keys must match flavors`);
  for (const v of Object.values(r.golden)) assert(Number.isInteger(v) && v > 0, `${r.id}: golden values are positive integers`);
}
const lemonade = recipes.find((r) => r.id === "ice_lemonade");
assert.deepEqual(lemonade.golden, { lemon: 7, mint: 3 });
assert.equal(goldenLabel(lemonade), "レモン7：ミント3");

const judge = (mix) => goldenRatioOf(lemonade, mix)?.level ?? null;
// 黄金比（境界5.0ポイントを含む）
for (const [l, m] of [[8, 4], [9, 3], [9, 4], [10, 4], [10, 5], [11, 4], [11, 5], [12, 4], [13, 7], [14, 6], [15, 5]]) {
  assert.equal(judge({ lemon: l, mint: m }), "hit", `lemon ${l} / mint ${m} is golden`);
}
// 惜しい（12ポイント以内）と、どちらでもない
for (const [l, m] of [[7, 5], [10, 3], [9, 5], [12, 8], [16, 4]]) assert.equal(judge({ lemon: l, mint: m }), "near", `lemon ${l} / mint ${m} is near`);
for (const [l, m] of [[10, 2], [6, 6], [2, 10]]) assert.equal(judge({ lemon: l, mint: m }), null, `lemon ${l} / mint ${m} is neither`);
// 一番足りない葉（惜しいときだけ）
assert.equal(goldenRatioOf(lemonade, { lemon: 7, mint: 5 }).short, "lemon");
assert.equal(goldenRatioOf(lemonade, { lemon: 12, mint: 3 }).short, "mint");
assert.equal(goldenRatioOf(lemonade, { lemon: 9, mint: 3 }).short, null);
// 同じ系統の銘柄は合算する（mint 1g＋ドバジ ミント 2g＝ミント3g）
assert.equal(judge({ lemon: 9, mint: 1, dobaj_mint: 2 }), "hit");
// golden の無いレシピは判定しない
assert.equal(goldenRatioOf(recipes.find((r) => r.id === "sumi_basic"), { double_apple: 9, mint: 3 }), null);

// 採点: 配合点は黄金比の有無で変わらない（加点の置き場所は未決定）
const mixOf = (mix, mode = "practice") => evaluateMix({ mode, mix, equip: { bowl: "silicone_bowl" } });
const hit = mixOf({ lemon: 9, mint: 3 });
assert.equal(hit.recipe?.id, "ice_lemonade");
assert.equal(hit.golden, "hit");
assert.equal(mixOf({ lemon: 10, mint: 2 }).golden, null);
// 同じ配合を golden 無しのデータで採点して、点・減点が同じことを確かめる
const withoutGolden = (fn) => {
  DB.recipes = recipes.map(({ golden, ...r }) => r);
  try { return fn(); } finally { DB.recipes = recipes; }
};
for (const [mix, mode] of [[{ lemon: 9, mint: 3 }, "practice"], [{ lemon: 7, mint: 5 }, "practice"], [{ lemon: 13, mint: 7 }, "tournament"], [{ lemon: 14, mint: 6 }, "tournament"]]) {
  const plain = withoutGolden(() => mixOf(mix, mode));
  assert.equal(plain.golden, null);
  assert.equal(mixOf(mix, mode).score, plain.score, `golden does not change the mix score: ${JSON.stringify(mix)} ${mode}`);
}
assert.equal(mixOf({ lemon: 7, mint: 5 }).golden, "near");
assert.equal(mixOf({ lemon: 7, mint: 5 }).goldenShort, "lemon");
// 別の葉が混ざればレシピ不成立なので判定しない
assert.equal(mixOf({ lemon: 8, mint: 3, vanilla: 1 }).golden, null);
// チュートリアルでは判定しない
assert.equal(mixOf({ lemon: 9, mint: 3 }, "tutorial").golden, null);

// 減点とは別判定: 1章大会の20g レモン13・ミント7 は黄金比で、ミント過多の減点も残る
const heavy = mixOf({ lemon: 13, mint: 7 }, "tournament");
assert.equal(heavy.golden, "hit");
assert(heavy.notes.some((n) => n.includes("ミントが強すぎ")), "mint penalty still applies to a golden mix");

// 台詞: なるの「ミントにレモンをひとつまみ」はレモン主体の 7対3 にそろえる
const naru = read("../../data/dialogue/ch1_naru.json");
const texts = JSON.stringify(naru) + JSON.stringify(lemonade);
assert(!texts.includes("ミントにレモン"), "old mint-first wording is gone");
assert(lemonade.hint_text.includes("7対3") && lemonade.recall[1].includes("7対3") && lemonade.memo.includes("7対ミント3"));

console.log("[golden ratio] PASS: data, 5pt boundary, near band, family sum, score unchanged, separate from mint penalty, wording");
