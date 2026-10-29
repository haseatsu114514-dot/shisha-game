// Real craft scoring with controlled operation histories; this is not a timed browser playthrough.
import assert from "node:assert/strict";
import fs from "node:fs";
import { MASTERY_THRESHOLDS, masteryBonus, mixMasteryProfile } from "../js/core/flavor-mastery.js";

globalThis.document = { addEventListener() {} };
globalThis.window = {};
const { DB } = await import("../js/core/data.js");
const { newGame } = await import("../js/core/state.js");
const { computeShisha, finalize, bonusOf, NAGUMO_BAR, WEIGHTS } = await import("../js/craft/score.js");
const { outcomeOf, pointTable } = await import("../js/craft/result.js");
const { evaluateMix } = await import("../js/craft/steps.js");
const { temperatureBands, temperatureFitness } = await import("../js/craft/temperature-model.js");
const { pullResult, steamTemperatureRange } = await import("../js/craft/conditions.js");
const { HEAT_GRADES } = await import("../js/craft/heat_logic.js");
const { newSession } = await import("../js/craft/session.js");

const readData = name => JSON.parse(fs.readFileSync(new URL(`../../data/${name}.json`, import.meta.url)));
DB.flavors = readData("flavors").flavors;
DB.flavorById = Object.fromEntries(DB.flavors.map(f => [f.id, f]));
DB.equipment = readData("equipment").equipment;
DB.equipById = Object.fromEntries(DB.equipment.map(e => [e.id, e]));
DB.recipes = readData("recipes").recipes;
DB.ngMixes = [];

const untrained = { flavorMastery: {} };
const mastered = { flavorMastery: { lemon: 60, mint: 60 } };
const empty = { level: 1, progress: 0, bonus: 0, aromaBonus: 0, forecastGain: 0 };
assert.deepEqual(mixMasteryProfile(null, {}), empty);
assert.deepEqual(mixMasteryProfile(untrained, { lemon: 12 }), empty);
for (const [index, xp] of MASTERY_THRESHOLDS.entries()) {
  const profile = mixMasteryProfile({ flavorMastery: { lemon: xp } }, { lemon: 12 });
  assert.equal(profile.level, index + 1);
  assert.equal(profile.progress, index / 4);
  assert.equal(profile.bonus, index * 2);
  assert.equal(profile.aromaBonus, index * 1.5);
  assert.equal(profile.forecastGain, index / 4 * .45);
}
assert.equal(masteryBonus(mastered, { lemon: 12 }), 8);
assert(Math.abs(masteryBonus(mastered, { lemon: 1, orange: 11 }) - 8 / 12) < 1e-12,
  "a small mastered ingredient cannot confer the whole mix's bonus");
assert.equal(mixMasteryProfile(mastered, { mint: 6, dobaj_mint: 6 }, DB.flavorById).progress, 1,
  "manufacturer variants use the existing shared flavor-family experience");
assert.equal(mixMasteryProfile(mastered, { lemon: Number.MAX_VALUE, orange: Number.MAX_VALUE }).bonus, 4,
  "finite weights remain proportional even if their raw total would overflow");
assert.deepEqual(mixMasteryProfile(mastered, { lemon: NaN, mint: Infinity, orange: -1 }), empty);

function heatResult(picks) {
  const grades = picks.map(pick => HEAT_GRADES[pick]);
  const average = key => grades.reduce((sum, grade) => sum + grade[key], 0) / grades.length;
  return {
    picks, score: Math.round(average("score")),
    heatPower: 50 + average("hp"), heatStability: 50 + average("hs"),
    burnRisk: 30 + average("br"), aromaRetention: 55 + average("ar"),
  };
}

// Find an actual temperature giving the requested thermal result. This keeps the fixtures
// valid when the delicious band becomes a plateau instead of rewarding only its center.
function temperatureFor(score, bands) {
  if (score === 100) return bands.center;
  let low = bands.center, high = .999;
  for (let i = 0; i < 50; i++) {
    const mid = (low + high) / 2;
    if (temperatureFitness(mid, bands) > score) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function craftHistory({ holes, picks, serving, care, steamHits = 1 }) {
  const cs = {
    mode: "tournament", chapter: 1, water: 0.5,
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    mix: { lemon: 9, mint: 3 }, pack: "normal", place: "triangle",
    holes: { score: holes, outerEven: holes / 100, innerExcess: 0, total: 22, minimumComplete: true },
    heat: heatResult(picks), steam: { score: 100 - steamHits * 14, hits: steamHits, seconds: 360 },
    environment: { rainy: false, ambientC: 23, humidityPercent: 50 },
    steamPrediction: { precision: .2, offset: 0, transfer: 1 },
    careHistory: [],
  };
  cs.mixInfo = evaluateMix(cs);
  const bands = temperatureBands(cs);
  const temp = temperatureFor(serving, bands);
  cs.pull = { temp, pulls: 3, ...pullResult(temp, 3, 0, bands, 3) };
  cs.careHistory = care.map((score, index) => {
    const temp = temperatureFor(score, bands);
    return { round: index + 1, temp, pulls: 1, ...pullResult(temp, 1, 0, bands, 2) };
  });
  return cs;
}

const scenarios = {
  precise: { holes: 98, picks: ["just", "just", "just"], serving: 100, care: [100, 100], steamHits: 0 },
  careful: { holes: 88, picks: ["just", "just", "pre"], serving: 90, care: [85, 86] },
  needsPractice: { holes: 78, picks: ["just", "pre", "pre"], serving: 82, care: [76, 75], steamHits: 2 },
  rough: { holes: 64, picks: ["pre", "pre", "early"], serving: 68, care: [62, 58], steamHits: 3 },
  unattended: { holes: 98, picks: ["just", "just", "just"], serving: 100, care: [25, 25], steamHits: 0 },
};

function scoreScenario(name, experience = {}, prepared = false) {
  const s = newGame();
  s.flavorMastery = { ...experience };
  if (prepared) { s.rehearsal = "great"; s.flags._last_night = "practice"; }
  const cs = finalize(craftHistory(scenarios[name]));
  return { cs, rank: outcomeOf(cs.total).rank };
}

assert.equal(NAGUMO_BAR, 90.8, "calibrated chapter 1 mid first-clear target");
assert.deepEqual(WEIGHTS, { holes: .2, heat: .2, shisha: .2, care1: .2, care2: .2 });
assert.equal(scoreScenario("precise").rank, 1, "starter equipment and Lv.1 can win with precise execution");
assert.equal(scoreScenario("careful").rank, 3, "calibrated bar makes this unprepared Lv.1 run close");
assert.equal(scoreScenario("careful", mastered.flavorMastery).rank, 1, "mastery lets careful operation win");
const novice = scoreScenario("needsPractice"), experienced = scoreScenario("needsPractice", mastered.flavorMastery);
assert.notEqual(novice.rank, 1, "middling execution without preparation should not clear chapter 1 automatically");
assert.equal(experienced.rank, 3, "calibrated bar keeps this middling run below a win despite mastery");
assert.equal(scoreScenario("needsPractice", mastered.flavorMastery, true).rank, 1,
  "mastery and preparation together can turn a close run into a win");
assert(experienced.cs.total - novice.cs.total >= 8, "full mastery is worth at least its disclosed eight points");
assert.notEqual(scoreScenario("rough", mastered.flavorMastery, true).rank, 1,
  "max mastery and all rehearsal bonuses cannot turn rough execution into a win");
assert.notEqual(scoreScenario("unattended", mastered.flavorMastery, true).rank, 1,
  "mastery does not replace the two after-service adjustments");
assert.equal(novice.cs.parts.care1, 76);
assert.equal(novice.cs.parts.care2, 75);
assert.equal(outcomeOf(NAGUMO_BAR - .1).rank, 3);
assert.equal(outcomeOf(NAGUMO_BAR).rank, 1);
assert.deepEqual(pointTable(1).nagumo, { hajime: 10 }, "the story's voting method stays separate from flavor preferences");

// The displayed mastery bonus, aroma and forecast all use the same selected mix's weighting.
let s = newGame();
const low = craftHistory(scenarios.rough);
low.mode = "rehearsal";
const lowAroma = computeShisha(low).aroma;
const broad = steamTemperatureRange(low, 360);
s.flavorMastery = { ...mastered.flavorMastery };
assert(computeShisha(low).aroma > lowAroma, "mastery also helps finish the aroma outside tournaments' final bonus");
const narrow = steamTemperatureRange(low, 360);
assert(narrow.high - narrow.low < broad.high - broad.low, "mastery narrows the existing forecast range");
assert(narrow.high > narrow.low, "a forecast never becomes a guaranteed exact result");
assert.equal(bonusOf(low).bonus, 0, "the direct contest bonus does not inflate practice's operation results");

// A completed cup must not become better retroactively when practice grants its experience.
s = newGame();
const savedCup = Object.assign(newSession("tournament"), craftHistory(scenarios.needsPractice));
const originalForecast = steamTemperatureRange(savedCup, 360);
const originalTotal = finalize(savedCup).total;
s.flavorMastery = { ...mastered.flavorMastery };
savedCup.stats = null;
assert.equal(finalize(savedCup).total, originalTotal);
assert.deepEqual(steamTemperatureRange(savedCup, 360), originalForecast);
const restoredCup = JSON.parse(JSON.stringify(savedCup));
restoredCup.stats = null;
assert.equal(finalize(restoredCup).total, originalTotal, "the per-cup mastery snapshot survives serialization");

console.log(JSON.stringify({
  chapter1Target: NAGUMO_BAR,
  scenarios: Object.fromEntries(Object.keys(scenarios).map(name => [name, {
    novice: scoreScenario(name).cs.total,
    mastered: scoreScenario(name, mastered.flavorMastery).cs.total,
    masteredAndPrepared: scoreScenario(name, mastered.flavorMastery, true).cs.total,
  }])),
  scope: "real scoring with supplied operation histories; not a timed browser playthrough",
}, null, 2));
console.log("PASS weighted mastery, forecasts, calibrated chapter 1 wins, preparation limits, two adjustments and unchanged story voting");

// U5雛形: 実時間操作のシミュレーターではなく、工程結果を与えて実finalizeを計測する。
// 能力から各操作結果への伝播・乱数分布・装備/配合の総当たりはU5本体で追加する。
if (process.argv.includes("--ngplus-measure")) {
  const rows = [];
  for (const ability of [10, 100]) for (const mastery of [0, 60]) {
    const value = newGame();
    for (const key of Object.keys(value.stats)) value.stats[key] = ability;
    value.flavorMastery = { lemon: mastery, mint: mastery };
    const totals = {};
    for (const [operation, history] of Object.entries({
      rough: scenarios.rough,
      perfect: { holes: 100, picks: ["just", "just", "just"], serving: 100, care: [100, 100], steamHits: 0 },
    })) {
      const cs = finalize(craftHistory(history));
      totals[operation] = cs.total;
      rows.push({ ability, masteryLevel: mastery === 60 ? 5 : 1, operation,
        ...cs.parts, total: cs.total, saturated: cs.total === 100 });
    }
    rows.push({ ability, masteryLevel: mastery === 60 ? 5 : 1, operation: "perfect - rough",
      total: Math.round((totals.perfect - totals.rough) * 10) / 10 });
  }
  console.log("U5 scaffold: fixed operation histories, starter equipment, no preparation bonuses");
  console.table(rows);
}
