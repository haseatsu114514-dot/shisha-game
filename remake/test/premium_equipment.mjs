// VOL08（#2273・#1904）: 第2章以降に買える高級機材と家シーシャの台。
// 売る店（品揃えの章）・実際の性能・家シーシャの経験値・SAVE/LOAD・「最大装備でも粗い操作を埋め切らない」を確かめる。
// node remake/test/premium_equipment.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const { DB } = await import("../js/core/data.js");
const core = await import("../js/core/state.js");
const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"));
DB.flavors = read("flavors").flavors;
DB.flavorById = Object.fromEntries(DB.flavors.map(f => [f.id, f]));
DB.equipment = read("equipment").equipment;
DB.equipById = Object.fromEntries(DB.equipment.map(e => [e.id, e]));
DB.recipes = read("recipes").recipes;
DB.ngMixes = [];
DB.dialogues = {};

const { forSale } = await import("../js/daily/shop.js");
const rig = await import("../js/daily/home-rig.js");
const home = await import("../js/daily/home-shisha.js");
const { EQUIP_WIDTH_FACTORS, EQUIP_THERMAL_SPECS, temperatureBands, temperatureFitness } = await import("../js/craft/temperature-model.js");
const { usesFoil } = await import("../js/craft/holes_logic.js");
const { coalWarmth, coalTypes } = await import("../js/craft/coals.js");
const { computeShisha, finalize } = await import("../js/craft/score.js");
const { outcomeOf } = await import("../js/craft/result.js");
const { evaluateMix } = await import("../js/craft/steps.js");
const { pullResult } = await import("../js/craft/conditions.js");
const { HEAT_GRADES } = await import("../js/craft/heat_logic.js");
const { equipmentUse } = await import("../js/craft/flavor-guide.js");

// 1. 品目: 価格・最初に並ぶ店の章・種類。旧パイプは廃止品のまま（旧セーブの返金処理が毎回のロードで使う）。
const ITEMS = {
  kumogama_phunnel: { type: "bowl", price: 9800, chapter: 2 },
  dense_flat_charcoal: { type: "charcoal", price: 2400, chapter: 2 },
  stand_stainless: { type: "homeware", price: 30000, chapter: 2, xp: 7 },
  lotos_plus: { type: "hms", price: 14000, chapter: 3 },
  stand_walnut: { type: "homeware", price: 100000, chapter: 3, xp: 8 },
  stand_custom: { type: "homeware", price: 300000, chapter: 3, xp: 9 },
};
for (const [id, want] of Object.entries(ITEMS)) {
  const e = DB.equipById[id];
  assert(e, `${id} がある`);
  assert.equal(e.type, want.type, `${id} の種類`);
  assert.equal(e.buy_price, want.price, `${id} の価格`);
  assert.equal(e.price, want.price);
  assert.equal(e.sell_price, want.price / 2, `${id} の買い取りは半額`);
  assert.equal(e.chapter_min, want.chapter);
  assert(!e.not_for_sale && !e.unsellable && !e.deprecated, `${id} は普通に売り買いできる`);
  // 店の品揃えの章: 地元の1階（1）には並ばず、柚ヶ谷店（2）・東京店（3）・ドバイ店（4）で並ぶ。
  for (const stock of [1, 2, 3, 4]) assert.equal(forSale(e, stock), stock >= want.chapter, `${id} @ 品揃え${stock}`);
  if (want.xp) assert.equal(e.home_xp, want.xp);
}
for (const id of ["pipe_middle", "pipe_high", "pipe_highest"]) {
  assert(DB.equipById[id].deprecated && DB.equipById[id].not_for_sale && !forSale(DB.equipById[id], 99), `${id} は廃止品のまま`);
}
for (const id of [rig.SUMI_RIG, rig.PRO_RIG]) assert(!forSale(DB.equipById[id], 99), `${id} は非売品のまま`);
// 後半の章でも新しく買える物がある（第2章3点・第3章以降さらに3点）。
const newAt = stock => DB.equipment.filter(e => forSale(e, stock) && !forSale(e, stock - 1)).map(e => e.id);
assert(newAt(2).length >= 4, `第2章の店で新しく買える機材: ${newAt(2)}`);
assert.deepEqual(newAt(3).sort(), ["lotos_plus", "stand_custom", "stand_walnut"]);

// 2. 制作の性能は表示と計算が一致し、幅は既存の機材の範囲に収まる。
assert.equal(EQUIP_WIDTH_FACTORS.bowl.kumogama_phunnel, EQUIP_THERMAL_SPECS.kumogama_phunnel.widthFactor);
assert.equal(EQUIP_THERMAL_SPECS.kumogama_phunnel.capacity, DB.equipById.kumogama_phunnel.capacity);
assert.equal(EQUIP_WIDTH_FACTORS.hms.lotos_plus, EQUIP_THERMAL_SPECS.lotos_plus.widthFactor);
assert.equal(EQUIP_WIDTH_FACTORS.charcoal.dense_flat_charcoal, EQUIP_THERMAL_SPECS.dense_flat_charcoal.widthFactor);
assert(EQUIP_WIDTH_FACTORS.bowl.kumogama_phunnel < EQUIP_WIDTH_FACTORS.bowl.nightside_premier_hagal, "くじのラストワン賞より控えめ");
assert(EQUIP_WIDTH_FACTORS.hms.lotos_plus < EQUIP_WIDTH_FACTORS.hms.tanukish_lid, "適温幅はタヌキッシュリッドに及ばない");
assert.equal(usesFoil({ equip: { hms: "lotos_plus" } }), false, "ロートスプラスはアルミを張らない");
assert.equal(usesFoil({ equip: { hms: "tanukish_lid" } }), true);
// 炭: 高密度フラットは火力・反応・焦げはフラットと同じで、適温帯だけ ×1.04 → ×1.06。
const flat = coalWarmth({ equip: { charcoal: "flat_charcoal" }, place: "triangle" });
const dense = coalWarmth({ equip: { charcoal: "dense_flat_charcoal" }, place: "triangle" });
const cube = coalWarmth({ equip: { charcoal: "cube_charcoal" }, place: "triangle" });
assert.deepEqual(coalTypes({ equip: { charcoal: "dense_flat_charcoal" }, place: "triangle" }), Array(3).fill("dense_flat_charcoal"));
assert.deepEqual({ ...dense, widthFactor: flat.widthFactor }, flat);
assert(Math.abs(dense.widthFactor - 1.06) < 1e-12 && Math.abs(flat.widthFactor - 1.04) < 1e-12);
// 既存の炭の値は変えない（表から読むようにしただけ）。
assert.deepEqual([flat.power, flat.pullResponse, flat.burnRisk, flat.smokeBonus], [.9, .94, 0, 0]);
assert(Math.abs(cube.power - 1.13) < 1e-12 && cube.burnRisk === 10.5 && cube.smokeBonus === 6 && cube.pullResponse === 1);
const mixed = coalWarmth({ equip: { charcoal: "flat_charcoal" }, place: "triangle", coalTypes: ["cube_charcoal", "flat_charcoal", "flat_charcoal"] });
assert(Math.abs(mixed.power - 3.13 / 3) < 1e-12 && mixed.burnRisk === 3.5);
assert.equal(coalTypes({ equip: { charcoal: "unknown_coal" } })[0], "flat_charcoal", "知らない炭はフラット扱い");

// 3. 一台の点: 同じ操作なら、高級機材の差は小さい。
function heatResult(picks) {
  const grades = picks.map(pick => HEAT_GRADES[pick]);
  const average = key => grades.reduce((sum, grade) => sum + grade[key], 0) / grades.length;
  return { picks, score: Math.round(average("score")), heatPower: 50 + average("hp"), heatStability: 50 + average("hs"),
    burnRisk: 30 + average("br"), aromaRetention: 55 + average("ar") };
}
function temperatureFor(score, bands) {
  if (score === 100) return bands.center;
  let low = bands.center, high = .999;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (temperatureFitness(mid, bands) > score) low = mid; else high = mid;
  }
  return (low + high) / 2;
}
const STARTER = { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" };
const PREMIUM = { bowl: "kumogama_phunnel", hms: "lotos_plus", charcoal: "dense_flat_charcoal" };
function craft({ holes, picks, serving, care, steamHits = 1 }, equip, mix) {
  const cs = {
    mode: "tournament", chapter: 1, water: .5, equip: { ...equip }, mix: { ...mix }, pack: "normal", place: "triangle",
    holes: { score: holes, outerEven: holes / 100, innerExcess: 0, total: 22, minimumComplete: true },
    heat: heatResult(picks), steam: { score: 100 - steamHits * 14, hits: steamHits, seconds: 360 },
    environment: { rainy: false, ambientC: 23, humidityPercent: 50 },
    steamPrediction: { precision: .2, offset: 0, transfer: 1 }, careHistory: [],
  };
  cs.mixInfo = evaluateMix(cs);
  const bands = temperatureBands(cs), temp = temperatureFor(serving, bands);
  cs.pull = { temp, pulls: 3, ...pullResult(temp, 3, 0, bands, 3) };
  cs.careHistory = care.map((score, index) => {
    const t = temperatureFor(score, bands);
    return { round: index + 1, temp: t, pulls: 1, ...pullResult(t, 1, 0, bands, 2) };
  });
  return cs;
}
const scenarios = {
  precise: { holes: 98, picks: ["just", "just", "just"], serving: 100, care: [100, 100], steamHits: 0 },
  careful: { holes: 88, picks: ["just", "just", "pre"], serving: 90, care: [85, 86] },
  rough: { holes: 64, picks: ["pre", "pre", "early"], serving: 68, care: [62, 58], steamHits: 3 },
  unattended: { holes: 98, picks: ["just", "just", "just"], serving: 100, care: [25, 25], steamHits: 0 },
};
const LEMON12 = { lemon: 9, mint: 3 }, LEMON16 = { lemon: 12, mint: 4 };
function score(name, equip, mix, { mastered = false, prepared = false } = {}) {
  const s = core.newGame();
  s.owned.push(...Object.values(equip));
  s.flavorMastery = mastered ? { lemon: 60, mint: 60 } : {};
  if (prepared) { s.rehearsal = "great"; s.flags._last_night = "practice"; }
  const cs = finalize(craft(scenarios[name], equip, mix));
  return { total: cs.total, rank: outcomeOf(cs.total).rank, quality: cs.stats.craftQuality };
}
const report = {};
for (const name of Object.keys(scenarios)) {
  const starter = score(name, STARTER, LEMON12), premium = score(name, PREMIUM, LEMON16);
  report[name] = { starter: starter.total, premium: premium.total, gain: Math.round((premium.total - starter.total) * 10) / 10 };
  assert(premium.total >= starter.total, `${name}: 高級機材で下がらない`);
  assert(premium.total - starter.total <= 2, `${name}: 同じ操作なら機材の差は総合2点以内（${report[name].gain}）`);
}
assert.equal(score("precise", STARTER, LEMON12).rank, 1, "初期装備・Lv.1でも丁寧な操作で勝てる");
assert.notEqual(score("careful", PREMIUM, LEMON16).rank, 1, "高級機材だけで、準備なしの惜しい一台を勝ちに変えない");
for (const name of ["rough", "unattended"]) {
  assert.notEqual(score(name, PREMIUM, LEMON16, { mastered: true, prepared: true }).rank, 1,
    `${name}: 最大装備・最大熟練・準備でも粗い操作／調整放棄は埋め切らない`);
}
// ロートスプラスの仕上がり補正は表示どおり +2（ロートス2 → 4）。
const stability = hms => computeShisha({ ...craft(scenarios.careful, { ...STARTER, hms }, LEMON12) }).heatStability;
assert.equal(stability("lotos_plus") - stability("lotos_hagal"), 2, "熱安定の差は表示の +2");

// 4. 家シーシャの台: 一番伸びる台を使い、経験値は台ごとの値。店や大会の点には効かない。
let s = core.newGame();
assert.equal(rig.homeRig(), null);
s.owned.push(rig.SUMI_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().xp, rig.homeRig().growth], [rig.SUMI_RIG, 6, .5]);
s.owned.push("stand_stainless");
assert.deepEqual([rig.homeRig().id, rig.homeRig().xp], ["stand_stainless", 7]);
s.owned.push(rig.PRO_RIG);
assert.deepEqual([rig.homeRig().id, rig.homeRig().xp, rig.homeRig().growth], [rig.PRO_RIG, 7.5, .75], "くじの大会公式モデルはステンレスより上");
s.owned.push("stand_custom", "stand_walnut");
assert.deepEqual([rig.homeRig().id, rig.homeRig().xp], ["stand_custom", 9]);
assert.equal(rig.homeRigXp("kumogama_phunnel"), 0, "台でない機材は経験値0");
assert.match(equipmentUse(DB.equipById.stand_custom).use, /経験値9/);
assert.match(equipmentUse(DB.equipById.stand_custom).caution, /点数は変わらない/);
s.stamina = 80; s.slot = 2;
s.flavorStock = { lemon: 24 };
const offered = home.homeShishaOffer();
assert.equal(offered?.id, "stand_custom");
const before = s.flavorMastery.lemon || 0;
const result = home.applyHomeShisha({ lemon: 12 }, offered);
assert(result, "家シーシャができる");
assert.equal((s.flavorMastery.lemon || 0) - before, 9, "特注台は1回で経験値9");
assert.match(home.homeShishaDialogue(result, offered, () => 0).lines[0].text, /特注の台/);
// 二重付与しない・SAVE/LOADで台と経験値を保つ。
assert.equal(home.applyHomeShisha({ lemon: 12 }, offered), null, "同じ夜に二度は付与しない");
core.save();
s = core.load();
core.setState(s);
assert.equal(s.flavorMastery.lemon, before + 9);
assert.equal(s.owned.filter(id => id === "stand_custom").length, 1, "台はSAVE/LOADで1台のまま");
assert.equal(rig.homeRig().id, "stand_custom");
// 卓上台・大会公式モデルの経験値は従来どおり（6 / 7.5）。
for (const [id, xp] of [[rig.SUMI_RIG, 6], [rig.PRO_RIG, 7.5]]) {
  const value = core.newGame();
  value.owned.push(id); value.stamina = 80; value.slot = 2; value.flavorStock = { mint: 12 };
  const gained = home.applyHomeShisha({ mint: 12 }, rig.homeRig());
  assert(gained);
  assert.equal(value.flavorMastery.mint, xp, `${id} は経験値${xp}`);
}

console.log(JSON.stringify({ sameOperationTotals: report }, null, 2));
console.log("PASS premium equipment: shop tiers, honest specs, small craft differences, home stands' mastery XP, save/load");
