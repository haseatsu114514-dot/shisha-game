// Issue #638: 家シーシャ（寝る前の一服）。行動の枠を使わないちょい足し・一番低い能力・台による伸び・葉12g・体力 −6。
// node remake/test/home_shisha.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};

const { DB } = await import("../js/core/data.js");
const { newGame, STAT_KEYS } = await import("../js/core/state.js");
let state;
const home = await import("../js/daily/home-shisha.js");
const rig = await import("../js/daily/home-rig.js");

const read = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), "utf8"));
const flavors = read("../../data/flavors.json").flavors;
const equipment = read("../../data/equipment.json").equipment;
DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.recipes = read("../../data/recipes.json").recipes;
DB.ngMixes = read("../../data/ng_mixes.json").ng_mixes;
DB.dialogues = {};

// データ: スミさんの卓上台（ミャア）と、くじの大会公式モデルの台。どちらも非売品・売れない
const sumiRig = DB.equipById[rig.SUMI_RIG], proRig = DB.equipById[rig.PRO_RIG];
assert.equal(sumiRig.name, "ミャア 卓上台");
assert.equal(proRig.name, "大会公式モデルの台");
for (const e of [sumiRig, proRig]) { assert.equal(e.chapter_min, 1); assert(e.unsellable && e.not_for_sale, e.id); }
assert.equal(sumiRig.home_growth, 0.5);
assert.equal(proRig.home_growth, 0.75);
const kuji = read("../../data/kuji.json").grades.g1000;
assert.equal(kuji.chapterMin, 1, "台が当たるくじは第1章から");
assert.equal(kuji.prizes.find((p) => p.rank === "S").equipId, rig.PRO_RIG);
const sumiScene = read("../../data/dialogue/ch1_sumi.json").dialogues.find((d) => d.dialogue_id === rig.RIG_SCENE);
assert(sumiScene?.lines.some((l) => l.text?.includes("ミャア")), "スミさんがミャアの卓上台を譲る場面");

// 台: 持っていなければ null、両方あれば伸びのいい大会公式モデル
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 12, insight: 25 };
assert.equal(rig.homeRig(), null);
state.owned.push(rig.SUMI_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.SUMI_RIG, 0.5]);
state.owned.push(rig.PRO_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().growth], [rig.PRO_RIG, 0.75]);
state.owned = state.owned.filter((id) => id !== rig.PRO_RIG);

// 一番低い能力（同じ値なら並び順、上限の能力は除く）
assert.equal(home.lowestStat({ technique: 20, sense: 12, guts: 30, charm: 12, insight: 25 }, 48), "sense");
assert.equal(home.lowestStat({ technique: 48, sense: 48, guts: 48, charm: 48, insight: 40 }, 48), "insight");
assert.equal(home.lowestStat({ technique: 48, sense: 48, guts: 48, charm: 48, insight: 48 }, 48), null);

// 聞くかどうか: 葉12g未満・今日もう吸った・大会前夜・台なしでは聞かない
state.flavorStock = { lemon: 6, mint: 5 };
state.stamina = 80;
assert.equal(home.homeShishaOffer(), null, "葉が12g未満");
state.flavorStock = { lemon: 9, mint: 3, double_apple: 0 };
assert.equal(home.homeShishaOffer()?.id, rig.SUMI_RIG);
assert.equal(home.homeShishaOffer(state, { eve: true }), null, "大会前夜は聞かない");

// レシピ帳から作る: 黄金比があればそれで（氷レモネード 12g → レモン8・ミント4）、なければ主役2:1
const lemonade = DB.recipes.find((r) => r.id === "ice_lemonade");
state.flavorStock = { lemon: 20, mint: 20, double_apple: 20, cinnamon: 20 };
assert.deepEqual(home.recipeMix(lemonade), { mint: 4, lemon: 8 });
assert.deepEqual(home.recipeMix(DB.recipes.find((r) => r.id === "apple_pie")), { double_apple: 8, cinnamon: 4 });
state.flavorStock = { lemon: 3, mint: 20 };
assert.equal(home.recipeMix(lemonade), null, "在庫が足りなければ作れない");

// 味の手応え: レシピどおりは美味しい、ただの組み合わせは普通、1種や噛み合わない配合はイマイチ
assert.equal(home.tasteOf({ recipe: lemonade, score: 100 }), "great");
assert.equal(home.tasteOf({ recipe: null, score: 88 }), "fine");
assert.equal(home.tasteOf({ recipe: null, score: 68 }), "meh");

// 一服: 葉12g減る・体力 −6・行動の枠は変わらない・レシピ帳へ（センスのおまけなし）・一番低い能力が卓上台で0.5P
state = newGame();
state.stats = { technique: 20, sense: 12, guts: 30, charm: 14, insight: 25 };
state.statXp = Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
state.owned.push(rig.SUMI_RIG);
state.flavorStock = { lemon: 20, mint: 20 };
state.stamina = 80;
const slotBefore = state.slot;
const r1 = home.applyHomeShisha({ lemon: 9, mint: 3 }, rig.homeRig());
assert.deepEqual(state.flavorStock, { lemon: 11, mint: 17 });
assert.equal(state.stamina, 74);
assert.equal(state.slot, slotBefore, "行動の枠は使わない");
assert.equal(r1.taste, "great");
assert.equal(r1.info.golden, "hit");
assert.equal(r1.found?.id, "ice_lemonade");
assert(state.recipes.ice_lemonade?.home);
assert.equal(r1.stat, "sense");
assert.equal(home.homeShishaOffer(), null, "同じ日に二度は聞かない");
assert.equal(home.growHomeStat(r1.stat, rig.homeRig()), 0, "0.5Pは次の1Pまでの進みとして持ち越す");
assert.equal(state.statXp.sense, 0.5);
assert.equal(home.growHomeStat("sense", rig.homeRig()), 1, "2晩で1P");
assert.equal(state.stats.sense, 13);
// 大会公式モデルの台は0.75P
state.owned.push(rig.PRO_RIG);
home.growHomeStat("charm", rig.homeRig());
assert.equal(state.statXp.charm, 0.75);

// 場面の台本: 全角48字以内・手動改行なし・心の声は（）で閉じる
const width = (t) => [...t].reduce((n, c) => n + (c.charCodeAt(0) < 128 ? .5 : 1), 0);
for (const taste of ["great", "fine", "meh"]) for (const id of [rig.SUMI_RIG, rig.PRO_RIG]) for (const pick of [0, .5, .99]) {
  const d = home.homeShishaDialogue({ taste, stat: "insight" }, { id }, () => pick);
  for (const l of d.lines) {
    assert(width(l.text) <= 48 && !l.text.includes("\n"), l.text);
    if (l.speaker === "hajime") assert(l.text.startsWith("（") && l.text.endsWith("）"), l.text);
  }
}

console.log("[home shisha] PASS: rigs, kuji from ch1, lowest stat, offer rules, recipe mix, taste, 12g/-6/no slot, 0.5P vs 0.75P, lines");
