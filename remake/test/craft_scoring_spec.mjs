// Issue #620: メーカー5社・天井統一採点式・炭差別化・廃止パイプ返金移行・審査員最終得点式の回帰テスト
// node remake/test/craft_scoring_spec.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};

const { DB } = await import("../js/core/data.js");
const { state, newGame, setState } = await import("../js/core/state.js");
const { MAKER_SPECS, makerOfFlavor, makerMixProfile, compareEquipment, flavorThermalGuide } = await import("../js/craft/temperature-model.js");
const { coalWarmth } = await import("../js/craft/coals.js");
const { flavorFamilyGrams, giftBowlEffect, computeShisha, bonusOf, finalize } = await import("../js/craft/score.js");
const { skippedFoilResult } = await import("../js/craft/holes_logic.js");
const { improvementOf } = await import("../js/craft/advice.js");
const { advanceToChapterTwo } = await import("../js/chapters/ch2-progress.js");
const { advanceToChapterThree } = await import("../js/chapters/ch3-progress.js");
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

// 1. データ整合性: メーカー6社・表記統一・禁止語チェック
assert.equal(flavors.length, 77); // 人物に結びつく11種・マウンテンミスト・サメちゃんのスプリングウォーター
const expectedPrefixToMaker = {
  "アルファーヘブン": "af",
  "ドバジ": "dobaj",
  "アフサール": "afsahr",
  "ナイトサイド": "nightside",
  "フォースフェクタ": "forcefect",
  "フワリ": "fuwari",
};
for (const f of flavors) {
  assert(f.maker in MAKER_SPECS, `Invalid maker on ${f.id}: ${f.maker}`);
  assert.equal(f.leaf, ["dark_earlgrey", "siga"].includes(f.id) ? "dark" : "blond");
  assert(!f.name.includes("ドバージュ") && !f.name.includes("アブサル"), `Legacy brand name in ${f.id}: ${f.name}`);
  assert(!f.description.includes("キレ"), `Forbidden word キレ in ${f.id}: ${f.description}`);
  assert(!f.description.includes("配合"), `Ununified word 配合 in ${f.id}: ${f.description}`);

  // 全商品の表示名と所属（maker）の完全整合
  const prefix = f.name.split(" ")[0];
  const expectedMaker = expectedPrefixToMaker[prefix];
  assert(expectedMaker, `Unknown maker prefix in flavor name: ${f.name}`);
  assert.equal(f.maker, expectedMaker, `Flavor ${f.id} maker (${f.maker}) does not match display name prefix ${prefix}`);
  assert.equal(makerOfFlavor(f.id), f.maker, `makerOfFlavor(${f.id}) != ${f.maker}`);

  // ショップ案内・温度帯ガイドの整合性
  const guide = flavorThermalGuide(f);
  assert.equal(guide.makerLabel, MAKER_SPECS[f.maker].label, `guide.makerLabel for ${f.id} != ${MAKER_SPECS[f.maker].label}`);
  if (MAKER_SPECS[f.maker].widthFactor >= 1.10) {
    assert.match(guide.widthLabel, /広め/);
  } else if (MAKER_SPECS[f.maker].widthFactor <= 0.80) {
    assert.match(guide.widthLabel, /狭め/);
  } else {
    assert.match(guide.widthLabel, /標準/);
  }
}

// 修正対象12商品の所属・温度帯幅・単社加算の回帰テスト
const candidateMakers = {
  vanilla: "af",
  coconut: "dobaj",
  mango: "dobaj",
  rose: "afsahr",
  peach: "dobaj",
  melon: "dobaj",
  banana: "dobaj",
  lychee: "afsahr",
  peppermint_shake: "forcefect",
  cinnamon: "af",
  clove: "afsahr",
  basil: "afsahr",
};
for (const [fid, expected] of Object.entries(candidateMakers)) {
  assert.equal(DB.flavorById[fid].maker, expected, `Candidate ${fid} maker != ${expected}`);
  const prof = makerMixProfile({ mix: { [fid]: 12 }, equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" } });
  assert.equal(prof.makerWidth, MAKER_SPECS[expected].widthFactor, `Candidate ${fid} makerWidth != ${MAKER_SPECS[expected].widthFactor}`);
}

for (const r of recipes) {
  assert(!(r.hint_text || "").includes("キレ") && !(r.memo || "").includes("キレ"), `Forbidden word キレ in recipe ${r.id}`);
}
assert.equal(DB.equipById.lotos_hagal.name, "ロートスHMD");
assert.equal(DB.equipById.winkwink_hagal.name, "ビッグタヌキッシュリッド");
assert.equal(DB.equipById.harry_the_moon.name, "ハリーザムーン");
assert.equal(DB.characters.maezono.name, "上園 文太郎");
// #1947 R9 / #1984: guard only the withdrawn descriptions on retired pipes.
const withdrawnPipeDescriptions = {
  pipe_middle: "少し値が張るが、気密性が高く味と煙が安定する。大会では専門評価に少し補正が入る。",
  pipe_high: "美しさと実用性を兼ね備えた名機。味の輪郭と見栄えに補正が入る。",
  pipe_highest: "限られた職人しか作れない特注品。味、煙、プレゼンすべてに高い補正が入る。",
};
const revivesWithdrawnPipeCopy = ({ id, description }) =>
  Object.hasOwn(withdrawnPipeDescriptions, id) && withdrawnPipeDescriptions[id] === description;
for (const pid of ["pipe_middle", "pipe_high", "pipe_highest"]) {
  assert.equal(DB.equipById[pid].deprecated, true);
  assert.equal(DB.equipById[pid].not_for_sale, true);
  const oldCopy = withdrawnPipeDescriptions[pid];
  assert(revivesWithdrawnPipeCopy({ id: pid, description: oldCopy }));
  assert(!revivesWithdrawnPipeCopy(DB.equipById[pid]), `${pid} must not restore its old scoring claim`);
  assert(!revivesWithdrawnPipeCopy({ id: pid, description: `「${oldCopy}」は旧説明` }));
  assert(!revivesWithdrawnPipeCopy({ id: pid, description: `${oldCopy}とは言えない` }));
  assert(!revivesWithdrawnPipeCopy({ id: "harry_the_moon", description: oldCopy }));
}
assert(!revivesWithdrawnPipeCopy(DB.equipById.hagal_80beat));

// 2. メーカー6社・加算天井（単社時は主要4社が +2.50、初心者安定枠のドバジが +0.80）
const sampleByMaker = {
  af: ["double_apple", 2.5],
  dobaj: ["dobaj_double_apple", 0.8],
  afsahr: ["absal_double_apple", 2.5],
  forcefect: ["forcefect_mikan", 2.5],
  nightside: ["nightside_earlgrey", 2.5],
};
for (const [maker, [fid, expectedDelta]] of Object.entries(sampleByMaker)) {
  const prof = makerMixProfile({ mix: { [fid]: 12 }, equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" } });
  assert.equal(prof.makerCount, 1);
  assert.equal(prof.widthPenalty, 1.0);
  assert.equal(prof.synergyScale, 1.0);
  assert.equal(prof.qualityCeilingDelta, expectedDelta, `Maker ${maker} ceiling delta != ${expectedDelta}`);
}

// 複数メーカー混合時も幅は加重平均。シナジー減衰は得点側だけに残す。
// ケースA: AF 6g (+2.50) + ドバジ 6g (+0.80) -> 2社（synergyScale: 0.90）
// qualityCeilingDelta = (0.5 * 2.50 + 0.5 * 0.80) * 0.90 = 1.485
const afDobaj = makerMixProfile({
  mix: { double_apple: 6, dobaj_double_apple: 6 },
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
});
assert.equal(afDobaj.makerCount, 2);
assert.equal(afDobaj.widthPenalty, 1);
assert.equal(afDobaj.synergyScale, 0.90);
assert.equal(afDobaj.qualityCeilingDelta, 1.485);

// ケースB: AF 6g + Forcefect 4g + Nightside 2g -> 3社（synergyScale: 0.78）
const multi = makerMixProfile({
  mix: { double_apple: 6, forcefect_mikan: 4, nightside_earlgrey: 2 },
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
});
assert.equal(multi.makerCount, 3);
assert.equal(multi.widthPenalty, 1);
assert.equal(multi.synergyScale, 0.78);
assert.equal(multi.qualityCeilingDelta, 1.95); // 2.5 * 0.78 = 1.95

// 2-B. 実際の採点処理 computeShisha による加算天井・波及排除・丸めの回帰テスト
// 波及（安定性→持続力、吸いやすさ→煙量）の二重加算を排除したことで、
// 実際の得点式でも主要4社 = +2.500、ドバジ = +0.800 が正確に成立し、
// 丸め後の craftQuality も主要4社で同点、ドバジで適正な差分となることを検証する。
const baseCraftState = {
  water: 0.5,
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
  holes: { total: 22, evenness: 0.6, outerEven: 0.6, innerExcess: 0, score: 60, minimumComplete: true },
  heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
  mixInfo: { score: 60, intensity: 5, total: 12 },
  pull: { score: 60, temp: 0.432, pulls: 3 },
  steam: { min: 5, hits: 2, score: 70 },
  care: { score: 60 },
  pack: "normal",
};
const shishaResults = {};
for (const [maker, [fid]] of Object.entries(sampleByMaker)) {
  const cs = { ...baseCraftState, mix: { [fid]: 12 } };
  shishaResults[maker] = computeShisha(cs);
}
// 主要4社（af, afsahr, forcefect, nightside）は craftQualityRaw が完全に一致し、丸め後の craftQuality も同点
const majorMakers = ["af", "afsahr", "forcefect", "nightside"];
for (const m of majorMakers) {
  assert.equal(shishaResults[m].craftQualityRaw, shishaResults.nightside.craftQualityRaw,
    `Maker ${m} craftQualityRaw (${shishaResults[m].craftQualityRaw}) != nightside (${shishaResults.nightside.craftQualityRaw})`);
  assert.equal(shishaResults[m].craftQuality, shishaResults.nightside.craftQuality,
    `Maker ${m} rounded craftQuality (${shishaResults[m].craftQuality}) != nightside (${shishaResults.nightside.craftQuality})`);
}
// ドバジと主要4社の craftQualityRaw の差は仕様どおり +2.50 - +0.80 = 1.70
const rawDiff = shishaResults.af.craftQualityRaw - shishaResults.dobaj.craftQualityRaw;
assert(Math.abs(rawDiff - 1.70) < 0.005, `Raw craftQuality difference between AF and Dobaj (${rawDiff}) != 1.70`);
assert.equal(Math.round(rawDiff * 10) / 10, 1.7);

// 混合時（AF 6g + ドバジ 6g）の computeShisha 実測値検証
// 加重平均天井 delta = 1.485 なので、主要4社単独(+2.500)との差は 2.500 - 1.485 = 1.015
const shishaAfDobaj = computeShisha({ ...baseCraftState, mix: { double_apple: 6, dobaj_double_apple: 6 } });
const mixDiff = Math.round((shishaResults.af.craftQualityRaw - shishaAfDobaj.craftQualityRaw) * 1000) / 1000;
assert.equal(mixDiff, 1.015, `Mix diff between AF and AF+Dobaj (${mixDiff}) != 1.015`);

// 2-C. ドバジ特有の強み（初心者安心設計・高耐久・適温帯1.25倍）の検証
// ① MAKER_SPECS と ガイド表示（幅1.25倍、safePullsBonus: 1）
assert.equal(MAKER_SPECS.dobaj.widthFactor, 1.25);
assert.equal(MAKER_SPECS.dobaj.safePullsBonus, 1);
const dobajGuide = flavorThermalGuide(DB.flavorById.dobaj_double_apple);
assert.match(dobajGuide.widthLabel, /非常に広め/);
assert.match(dobajGuide.traitLabel, /高耐久（吸引許容4回・焦げリスク半減）/);

// ② 初心者プレイ（4回吸引 + 過熱発生時）の焦げ耐性・吸いすぎ耐性の比較
// 主要4社（AF等）: safePulls=3 なので4回目で +5、過熱で +12 の計 +17 burnRisk加算
// ドバジ: safePulls=4 なので4回目でも +0、過熱加算も半減(12 * 0.5 = 6)の計 +6 burnRisk加算（差分 11pt）
const afBeginner = computeShisha({ ...baseCraftState, mix: { double_apple: 12 }, pull: { score: 50, pulls: 4, over: true } });
const dobajBeginner = computeShisha({ ...baseCraftState, mix: { dobaj_double_apple: 12 }, pull: { score: 50, pulls: 4, over: true } });
assert.equal(afBeginner.burnRisk - dobajBeginner.burnRisk, 11, `AF beginner burnRisk (${afBeginner.burnRisk}) - Dobaj (${dobajBeginner.burnRisk}) != 11`);

// 49/50/51% keeps the existing rounded pull allowance and proportionate overheating reduction.
const { temperatureBands, temperatureFitness } = await import("../js/craft/temperature-model.js");
const { pullResult } = await import("../js/craft/conditions.js");
for (const ratio of [.49, .5, .51]) {
  const cs = { ...baseCraftState, mix: { double_apple: 12 * (1 - ratio), dobaj_double_apple: 12 * ratio } };
  const bands = temperatureBands(cs), profile = makerMixProfile(cs), safe = ratio < .5 ? 3 : 4;
  assert.equal(profile.safePullsBonus, safe - 3);
  assert.equal(pullResult(bands.center, 4, 0, bands, safe).score, ratio < .5 ? 92 : 100);
  const risk = (temp, pulls) => computeShisha({ ...cs, pull: { temp, pulls, score: 80, over: false } }).burnRisk;
  const low = risk(bands.center, 3);
  assert.equal(risk(bands.center, 4) - low, ratio < .5 ? 5 : 0);
  assert.equal(risk(bands.ideal[1], 3), low);
  assert.equal(risk(bands.ideal[1] + 1e-9, 3) - low, Math.round(12 * (1 - .5 * ratio)));
  assert.equal(profile.qualityCeilingDelta, Math.round(((1 - ratio) * 2.5 + ratio * .8) * .9 * 1000) / 1000);
}
// Saturated attributes and final integer rounding retain their original semantics; no Dobaj 85 cap.
const strong = { ...baseCraftState, mix: { dobaj_double_apple: 12 }, mixInfo: { score: 100, intensity: 10, total: 30 },
  holes: { total: 24, outerEven: 1, innerExcess: 0, inner: 0, minimumComplete: true },
  heat: { heatPower: 100, heatStability: 100, burnRisk: 0, aromaRetention: 100 },
  steam: { seconds: 540, hits: 0, score: 100 }, care: { score: 100 }, pack: "firm",
  pull: { temp: .432, pulls: 2, score: 100 } };
const saturated = computeShisha(strong);
assert.equal(saturated.duration, 100); assert.equal(saturated.taste, 100);
assert(saturated.craftQuality > 85);
assert.equal(saturated.craftQuality, Math.round(saturated.craftQualityRaw));
assert.equal(temperatureFitness(temperatureBands(strong).center, temperatureBands(strong)), 100);
assert.notEqual(saturated.craftQualityRaw, 100, "Temperature fitness is not final quality");

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
const s = newGame();
s.equip.bowl = "hagal_80beat";
assert.equal(bonusOf({ equip: { bowl: "hagal_80beat" }, mix: { double_apple: 9, mint: 3 } }).bonus, 0);

s.owned.push("suyaki_minto", "suyaki_adam");
assert.equal(flavorFamilyGrams({ dobaj_mint: 3, absal_double_apple: 9 }, "mint"), 3);
assert.equal(flavorFamilyGrams({ dobaj_mint: 3, absal_double_apple: 9 }, "double_apple"), 9);
assert.equal(giftBowlEffect({ equip: { bowl: "suyaki_minto" }, mix: { dobaj_mint: 3, double_apple: 9 } })?.bonus, 1);
assert.equal(giftBowlEffect({ equip: { bowl: "suyaki_adam" }, mix: { mint: 3, absal_double_apple: 9 } })?.bonus, 1);

// ミント課題は再開中の旧大会だけ。新規のレモン課題とは区別する。
assert.equal(evaluateMix({ mode: "tournament", mix: { absal_double_apple: 9, dobaj_mint: 3 }, equip: { bowl: "silicone_bowl" } }).regOk, false);
s.flags._legacy_mint_tournament = true;
const crossMix = evaluateMix({ mode: "tournament", mix: { absal_double_apple: 9, dobaj_mint: 3 }, equip: { bowl: "silicone_bowl" } });
assert.equal(crossMix.regOk, true, "dobaj_mint should satisfy mint regulation");
assert.equal(crossMix.recipe?.id, "sumi_basic", "Cross-brand double_apple + mint should match sumi_basic");
delete s.flags._legacy_mint_tournament;
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
const legacyWithPipes = JSON.parse(JSON.stringify(newGame()));
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

// 7. ショップ・準備画面の現在装備比較＆初心者向けリアル用語ガイド検証
const cmp80 = compareEquipment("hagal_80beat", "silicone_bowl");
assert.equal(cmp80.same, false);
assert.match(cmp80.categoryGuide, /ボウル（ハガル）/);
assert.match(cmp80.rows[0].value, /\+8%.*適温に収めやすくなる/);
assert.match(cmp80.rows[1].value, /12g → 15g/);

const cmpSuyaki = compareEquipment("suyaki_hagal", "silicone_bowl");
assert.match(cmpSuyaki.rows[0].value, /-10%.*繊細な温度合わせが必要/);
assert.equal(cmpSuyaki.rows[0].tone, "technical");

const cmpCube = compareEquipment("cube_charcoal", "flat_charcoal");
assert.match(cmpCube.rows[0].value, /-10%.*繊細な温度合わせが必要/);
assert.match(cmpCube.rows[2].value, /煙量 \+6 ／ 焦げリスク \+10\.5/);

const mintGuide = flavorThermalGuide(DB.flavorById.mint);
assert.equal(mintGuide.makerLabel, "アルファーヘブン");
assert.match(mintGuide.tempBandLabel, /高温向き/);

const vanillaGuide = flavorThermalGuide(DB.flavorById.vanilla);
assert.match(vanillaGuide.tempBandLabel, /低温・繊細/);

console.log("[craft scoring spec] PASS: 6 makers, +2.5 ceiling, flat vs cube charcoal, shop equipment comparison, canonical judge formula, and pipe refund migration verified");

// #1255: 第1章の準備記録は保持するが、後章の採点には持ち越さない。
const evenCup = chapter => ({
  mode: "tournament", ...(chapter == null ? {} : { chapter }),
  holes: { score: 70 }, heat: { score: 70 }, stats: { craftQuality: 70 },
  careHistory: [{ score: 70 }, { score: 70 }],
});
const prepared = newGame();
prepared.rehearsal = "great";
prepared.flags._last_night = "practice";
assert.equal(finalize(evenCup(1)).total, 75);
prepared.phase = "cleared";
assert.equal(advanceToChapterTwo(prepared), true);
assert.equal(finalize(evenCup(2)).total, 70, "real chapter 2 transition must stop the +5 carry-over");
prepared.phase = "cleared";
Object.assign(prepared.flags, {
  _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
  _ch2_tournament: { stage: "complete" },
});
assert.equal(advanceToChapterThree(prepared), true);
assert.equal(finalize(evenCup(3)).total, 70, "real chapter 3 transition must stop the +5 carry-over");
assert.equal(prepared.rehearsal, "great", "keep the historical preparation record");
assert.equal(prepared.flags._last_night, "practice");

for (const chapter of [1, 2, 3, 4, 5]) {
  for (const rehearsal of [null, "rough", "good", "great"]) {
    for (const choice of [undefined, "sleep_early", "talk_sumi", "practice"]) {
      const saved = newGame();
      Object.assign(saved, { chapter, rehearsal });
      if (choice !== undefined) saved.flags._last_night = choice;
      // LOAD既存セーブ経由。旧セッションはchapterを持たない場合もある。
      localStorage.setItem("suien_remake_save", JSON.stringify(saved));
      const restored = load();
      const expected = chapter === 1
        ? ({ great: 3, good: 1.5 }[rehearsal] || 0) + (choice === "practice" ? 2 : 0) : 0;
      for (const cup of [evenCup(chapter), evenCup()]) {
        assert.equal(finalize(cup).total, 70 + expected, `chapter=${chapter}, ${rehearsal}, ${choice}`);
        if (chapter > 1) assert.deepEqual(cup.bonusNotes, [], "no stale preparation notes");
      }
      assert.equal(bonusOf().bonus, expected, "chapter fallback also applies without a session");
      assert.equal(restored.rehearsal, rehearsal);
      assert.equal(restored.flags._last_night, choice);
    }
  }
  // 章制限は準備加点だけ。贈り物・熟練度は後章も有効。
  const current = newGame();
  current.chapter = chapter;
  current.rehearsal = "great"; current.flags._last_night = "practice";
  current.owned.push("suyaki_minto"); current.flavorMastery = { mint: 60 };
  const cup = { ...evenCup(chapter), equip: { bowl: "suyaki_minto" }, mix: { mint: 12 } };
  assert.equal(bonusOf(cup).bonus, 9 + (chapter === 1 ? 5 : 0));
  current.chapter = chapter === 1 ? 2 : 1;
  assert.equal(bonusOf(cup).bonus, 9 + (chapter === 1 ? 5 : 0), "session chapter takes priority");
}
console.log("[craft scoring spec] PASS: chapter-scoped preparation, real transitions, legacy LOAD, and independent gift/mastery bonuses");

// #1907: ロートスで穴あけを飛ばした一台は、採点・助言・結果の工程一覧から穴を除く。
newGame();
const lotosCup = finalize({
  ...evenCup(4),
  holes: skippedFoilResult(),
  equip: { hms: "lotos_hagal" },
  heat: { score: 40 },
});
assert.equal(lotosCup.foilSkipped, true);
assert.equal(lotosCup.holes.score, null);
assert.equal(Object.hasOwn(lotosCup.parts, "holes"), false);
assert.equal(lotosCup.total, 62.5, "four completed parts share the score when foil is skipped");
assert.equal(improvementOf(lotosCup), "次の練習：炭の全面が赤くなる頃合いを確かめよう。");

