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

// #1906-2: NGは基本ID・別メーカー・同系統の複数銘柄で同じ境界を使う。
// 系統未追加の葉も、将来の銘柄を模したfixtureで既存のfamily集計を検証する。
const ngMixes = DB.ngMixes;
assert.equal(ngMixes.length, 6, "Current NG catalog has six entries");
assert.equal(new Set(ngMixes.map(ng => ng.id)).size, 6, "Every NG entry has a unique ID");
const originalFlavors = DB.flavorById;
try {
  DB.recipes = [];
  DB.flavorById = { ...originalFlavors };
  for (const family of new Set(ngMixes.flatMap(ng => ng.flavors))) {
    DB.flavorById[`test_${family}`] = { ...originalFlavors[family], id: `test_${family}`, family };
  }
  const boundaries = {
    both_over_5g: [[5, 6, false], [6, 5, false], [5.1, 5.1, true], [6, 6, true]],
    both_over_4g: [[4, 5, false], [5, 4, false], [4.1, 4.1, true], [5, 5, true]],
    combined_over_10g: [[4, 6, false], [4, 6.1, true], [6, 4.1, true]],
    ratio_close: [[5, 6, true], [6, 5, true], [5, 6.1, false], [6.1, 5, false]],
  };
  for (const ng of ngMixes) {
    const [a, b] = ng.flavors;
    for (const [ga, gb, hit] of [...boundaries[ng.condition], [0, 12, false], [12, 0, false], [0, 0, false]]) {
      for (const mix of [
        { [a]: ga, [b]: gb },
        { [`test_${a}`]: ga, [`test_${b}`]: gb },
        { [a]: ga / 2, [`test_${a}`]: ga / 2, [b]: gb / 2, [`test_${b}`]: gb / 2 },
      ]) {
        DB.ngMixes = [];
        const plain = mixOf(mix);
        DB.ngMixes = [ng];
        const result = mixOf(mix);
        assert.deepEqual(result.ngReasons, hit ? [ng.text] : [], `${ng.id}: ${JSON.stringify(mix)}`);
        assert.equal(result.score, Math.round(plain.score + (hit ? ng.penalty * 3 : 0)), "existing penalty and rounding stay unchanged");
        assert.equal(result.notes.includes(ng.text), hit, "legacy notes retain NG reasons");
      }
    }
    const actualVariantA = flavors.find(flavor => flavor.id !== a && flavor.family === a)?.id;
    const actualVariantB = flavors.find(flavor => flavor.id !== b && flavor.family === b)?.id;
    DB.ngMixes = [ng];
    const result = mixOf({ [actualVariantA || `test_${a}`]: 6, [actualVariantB || `test_${b}`]: 6 });
    assert.deepEqual(result.ngReasons, [ng.text], `${ng.id}: family variants retain the reason`);
    assert(result.notes.includes(ng.text), `${ng.id}: the reason remains available to the confirmation UI`);
  }
  DB.ngMixes = ngMixes;
  assert.deepEqual(mixOf({ mint: 6, vanilla: 6 }).ngReasons, mixOf({ dobaj_mint: 6, vanilla: 6 }).ngReasons);
  assert.deepEqual(mixOf({ mint: 2, dobaj_mint: 2, absal_mint: 2, vanilla: 6 }).ngReasons, [ngMixes[0].text]);
  const multiple = mixOf({ dobaj_mint: 6, vanilla: 6, coconut: 6 });
  assert.deepEqual(multiple.ngReasons, [ngMixes[0].text, ngMixes[2].text, ngMixes[3].text], "all penalties remain, in data order");

  // 現行データには黄金比とNGの重複がないので、黄金比だけfixtureに追加して独立性を検証。
  DB.recipes = [{ id: "test_ng_golden", name: "NG併存fixture", flavors: ["mint", "vanilla"], golden: { mint: 1, vanilla: 1 } }];
  const coexist = mixOf({ dobaj_mint: 6, vanilla: 6 });
  assert.equal(coexist.golden, "hit");
  assert.deepEqual(coexist.ngReasons, [ngMixes[0].text]);
  DB.recipes = DB.recipes.map(({ golden, ...r }) => r);
  assert.equal(mixOf({ dobaj_mint: 6, vanilla: 6 }).score, coexist.score, "golden neither erases nor changes NG penalty");
} finally {
  DB.ngMixes = ngMixes; DB.flavorById = originalFlavors; DB.recipes = recipes;
}
console.log("[NG mix] PASS: all rules, family sums, strict 4g/5g/10g boundaries, ratio ±1g, zero, penalties, golden coexistence");
