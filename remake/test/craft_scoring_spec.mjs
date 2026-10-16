// Issue #620: メーカー5社・天井統一採点式・炭差別化・廃止パイプ返金移行・審査員最終得点式の回帰テスト
// node remake/test/craft_scoring_spec.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};

const { DB } = await import("../js/core/data.js");
const { state, newGame, setState } = await import("../js/core/state.js");
const { MAKER_SPECS, makerMixProfile } = await import("../js/craft/temperature-model.js");
const { coalWarmth } = await import("../js/craft/coals.js");
const { flavorFamilyGrams, giftBowlEffect, computeShisha, bonusOf } = await import("../js/craft/score.js");
const { evaluateMix, isSuyakiBowl } = await import("../js/craft/steps.js");
const { BASE_PREF_SCALE, JUDGE_PROFILES, judgeMaxPrefDelta, evaluateJudgeScore } = await import("../js/chapters/ch2-tournament-state.js");

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors;
const equipment = JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url), "utf8")).equipment;
const recipes = JSON.parse(fs.readFileSync(new URL("../../data/recipes.json", import.meta.url), "utf8")).recipes;
const characters = JSON.parse(fs.readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8"));

DB.flavors = flavors;
DB.flavorById = Object.fromEntries(flavors.map((f) => [f.id, f]));
DB.equipment = equipment;
DB.equipById = Object.fromEntries(equipment.map((e) => [e.id, e]));
DB.recipes = recipes;
DB.ngMixes = [];
DB.characters = Object.fromEntries(characters.map((c) => [c.id, c]));

// 1. データ整合性: メーカー5社・表記統一・禁止語チェック
assert.equal(flavors.length, 64);
for (const f of flavors) {
  assert(f.maker in MAKER_SPECS, `Invalid maker on ${f.id}: ${f.maker}`);
  assert.equal(f.leaf, "blond");
  assert(!f.name.includes("ドバージュ") && !f.name.includes("アブサル"), `Legacy brand name in ${f.id}: ${f.name}`);
  assert(!f.description.includes("キレ"), `Forbidden word キレ in ${f.id}: ${f.description}`);
  assert(!f.description.includes("配合"), `Ununified word 配合 in ${f.id}: ${f.description}`);
}
for (const r of recipes) {
  assert(!(r.hint_text || "").includes("キレ") && !(r.memo || "").includes("キレ"), `Forbidden word キレ in recipe ${r.id}`);
}
assert.equal(DB.equipById.lotos_hagal.name, "ロートスHMD");
assert.equal(DB.equipById.winkwink_hagal.name, "ビッグタヌキッシュリッド");
assert.equal(DB.equipById.harry_the_moon.name, "ハリーザムーン");
assert.equal(DB.characters.maezono.display_name, "上園");
for (const pid of ["pipe_middle", "pipe_high", "pipe_highest"]) {
  assert.equal(DB.equipById[pid].deprecated, true);
  assert.equal(DB.equipById[pid].not_for_sale, true);
}

// 2. メーカー5社・天井統一（単社時はどの社でも craftQuality 加算天井がちょうど +2.50）
const sampleByMaker = {
  af: "double_apple",
  dobaj: "dobaj_double_apple",
  afsahr: "absal_double_apple",
  forcefect: "forcefect_mikan",
  nightside: "nightside_earlgrey",
};
for (const [maker, fid] of Object.entries(sampleByMaker)) {
  const prof = makerMixProfile({ mix: { [fid]: 12 }, equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" } });
  assert.equal(prof.makerCount, 1);
  assert.equal(prof.widthPenalty, 1.0);
  assert.equal(prof.synergyScale, 1.0);
  assert.equal(prof.qualityCeilingDelta, 2.5, `Maker ${maker} ceiling delta != 2.5`);
}

// 複数メーカー混合時のグラム重み・帯幅ペナルティ・シナジー減衰（AF 6g + Forcefect 4g + Nightside 2g）
const multi = makerMixProfile({
  mix: { double_apple: 6, forcefect_mikan: 4, nightside_earlgrey: 2 },
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
});
assert.equal(multi.makerCount, 3);
assert.equal(multi.widthPenalty, 0.88);
assert.equal(multi.synergyScale, 0.78);
assert.equal(multi.qualityCeilingDelta, 1.95); // 2.5 * 0.78 = 1.95

// 3. フラット炭 vs キューブ炭の差別化
const flat = coalWarmth({ equip: { charcoal: "flat_charcoal" }, place: "triangle" });
const cube = coalWarmth({ equip: { charcoal: "cube_charcoal" }, place: "triangle" });
assert(flat.widthFactor > cube.widthFactor, "Flat charcoal should have wider effective temperature zone");
assert.equal(flat.burnRisk, 0);
assert(cube.burnRisk > 10, "Cube charcoal should carry higher burnRisk");
assert(flat.response < cube.response, "Flat charcoal should have gentler pull temperature jump");
assert(cube.power > flat.power && cube.smokeBonus > flat.smokeBonus);

const flatShisha = computeShisha({ equip: { charcoal: "flat_charcoal" }, mix: { forcefect_mikan: 12 }, pull: { score: 92, temp: 0.351, pulls: 2 } });
const cubeShisha = computeShisha({ equip: { charcoal: "cube_charcoal" }, mix: { forcefect_mikan: 12 }, pull: { score: 92, temp: 0.351, pulls: 2 } });
assert(flatShisha.burnRisk < cubeShisha.burnRisk);
assert(flatShisha.aroma >= cubeShisha.aroma);
assert(cubeShisha.smoke > flatShisha.smoke);

// 4. 80beatハガル無条件+1ボーナスの撤廃と、別メーカー同系統フレーバーの横断判定
newGame();
state.equip.bowl = "hagal_80beat";
assert.equal(bonusOf({ equip: { bowl: "hagal_80beat" }, mix: { double_apple: 9, mint: 3 } }).bonus, 0);

state.owned.push("suyaki_minto", "suyaki_adam");
assert.equal(flavorFamilyGrams({ dobaj_mint: 3, absal_double_apple: 9 }, "mint"), 3);
assert.equal(flavorFamilyGrams({ dobaj_mint: 3, absal_double_apple: 9 }, "double_apple"), 9);
assert.equal(giftBowlEffect({ equip: { bowl: "suyaki_minto" }, mix: { dobaj_mint: 3, double_apple: 9 } })?.bonus, 1);
assert.equal(giftBowlEffect({ equip: { bowl: "suyaki_adam" }, mix: { mint: 3, absal_double_apple: 9 } })?.bonus, 1);

const crossMix = evaluateMix({ mode: "tournament", mix: { absal_double_apple: 9, dobaj_mint: 3 }, equip: { bowl: "silicone_bowl" } });
assert.equal(crossMix.regOk, true, "dobaj_mint should satisfy mint regulation");
assert.equal(crossMix.recipe?.id, "sumi_basic", "Cross-brand double_apple + mint should match sumi_basic");
assert.equal(isSuyakiBowl("suyaki_hagal"), true);
assert.equal(isSuyakiBowl("silicone_bowl"), false);

// 5. 審査員の最終得点式（1本化・同品質 Q=80 で好みだけを変えた計算例）
assert.equal(BASE_PREF_SCALE, 20);
assert.equal(judgeMaxPrefDelta("nagumo"), 2.0);
assert.equal(judgeMaxPrefDelta("dr_kemuri"), 3.0);
assert.equal(judgeMaxPrefDelta("maezono"), 4.4);

const expectedAtQ80 = {
  nagumo: [78.0, 79.0, 80.0, 81.0, 82.0],
  dr_kemuri: [77.0, 78.5, 80.0, 81.5, 83.0],
  maezono: [75.6, 77.8, 80.0, 82.2, 84.4],
};
const prefs = [-1.0, -0.5, 0.0, 0.5, 1.0];
for (const [judgeId, expected] of Object.entries(expectedAtQ80)) {
  const actual = prefs.map((p) => evaluateJudgeScore(judgeId, 80, p));
  assert.deepEqual(actual, expected, `Judge ${judgeId} mismatch at Q=80`);
}
// 将来の好み偏重審査員（qualityWeight: 0.50, prefWeight: 0.50 -> maxPrefDelta = ±10.0）
const heavyJudge = { guest_heavy: { id: "guest_heavy", qualityWeight: 0.50, prefWeight: 0.50 } };
assert.equal(judgeMaxPrefDelta("guest_heavy", heavyJudge), 10.0);
assert.deepEqual(prefs.map((p) => evaluateJudgeScore("guest_heavy", 80, p, heavyJudge)), [70.0, 75.0, 80.0, 85.0, 90.0]);

// 6. 廃止パイプの返金・移行（非所有セーブは書き換えない）
newGame();
const legacyWithPipes = JSON.parse(JSON.stringify(state));
legacyWithPipes.money = 10000;
legacyWithPipes.owned.push("pipe_middle", "pipe_high");
legacyWithPipes.equip.pipe = "pipe_high";
globalThis.localStorage = {
  _store: { suien_remake_save: JSON.stringify(legacyWithPipes) },
  getItem(k) { return this._store[k] ?? null; },
  setItem(k, v) { this._store[k] = String(v); },
};
const { load } = await import("../js/core/state.js");
const migrated = load();
assert.equal(migrated.money, 140000);
assert(!migrated.owned.includes("pipe_middle") && !migrated.owned.includes("pipe_high"));
assert.equal(migrated.equip.pipe, "harry_the_moon");
setState(migrated);

console.log("[craft scoring spec] PASS: 5 makers, +2.5 ceiling, flat vs cube charcoal, cross-brand families, canonical judge formula, and pipe refund migration verified");
