import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const { DB } = await import("../js/core/data.js");
const { newGame } = await import("../js/core/state.js");
const { skippedFoilResult, foilHeatProfile, usesFoil, VENT_CLOSED_FACTOR } = await import("../js/craft/holes_logic.js");
const { HEAT_GRADES } = await import("../js/craft/heat_logic.js");
const { ZONES } = await import("../js/craft/pull.js");
const { temperatureAfterSteam, heatDelta, temperatureBands, pullResult } = await import("../js/craft/conditions.js");
const { computeShisha } = await import("../js/craft/score.js");
for (const [name, key] of [["flavors", "flavor"], ["equipment", "equip"]]) {
  const rows = JSON.parse(fs.readFileSync(new URL(`../../data/${name}.json`, import.meta.url)))[name];
  DB[name] = rows;
  DB[`${key}ById`] = Object.fromEntries(rows.map(row => [row.id, row]));
}
newGame();
const legacy = { skipped: true, total: 24, outer: 12, middle: 8, inner: 4,
  evenness: .75, outerEven: .75, precision: .75, completion: 1,
  innerExcess: 0, minimumComplete: true, dots: [], score: null };
const base = {
  mode: "rehearsal", equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
  place: "triangle", pack: "normal", mix: { double_apple: 9, mint: 3 },
  mixInfo: { total: 12, score: 60, intensity: 5 }, water: .5,
  heat: { heatPower: 50 + HEAT_GRADES.just.hp, heatStability: 50 + HEAT_GRADES.just.hs, burnRisk: 30, aromaRetention: 65, score: 100 },
  steamSeconds: 600, steam: { score: 100, hits: 0 },
  environment: { rainy: false, ambientC: 23, humidityPercent: 42 },
};
const old = { ...base, holes: legacy };
const opened = { ...base, vent: "open", holes: skippedFoilResult("open") };
const missing = { ...base, holes: skippedFoilResult() };
const closed = { ...base, vent: "closed", holes: skippedFoilResult("closed") };
const up = ZONES.find(z => z.id === "up").justDelta;
const finish = (cs, seconds) => temperatureAfterSteam(cs, seconds, 0);
const score = cs => { const temp = finish(cs, 600); return computeShisha({ ...cs, pull: { ...pullResult(temp, 3, 0, temperatureBands(cs)), temp, pulls: 3 } }); };
for (const cs of [opened, missing]) {
  assert.deepEqual(cs.holes, legacy);
  assert.equal(finish(cs, 600), finish(old, 600));
  for (const zone of ZONES) for (const delta of [zone.delta, zone.justDelta]) assert.equal(heatDelta(cs, delta), heatDelta(old, delta));
  assert.deepEqual(score(cs), score(old));
}
const band = temperatureBands(base);
const c8 = finish(closed, 480), o10 = finish(opened, 600), c10 = finish(closed, 600);
const change = heatDelta(closed, up);
assert(c8 <= o10, "closed 8 <= open 10");
assert(c10 < band.optimal[0], "closed 10 < optimal lower bound");
assert(change < band.ideal[1] - band.ideal[0], "just up < ideal width");
assert.equal(foilHeatProfile(closed.holes).stability, foilHeatProfile(legacy).stability);
assert.equal(foilHeatProfile(closed.holes).warmup, foilHeatProfile(legacy).warmup * VENT_CLOSED_FACTOR);
assert.equal(foilHeatProfile(closed.holes).response, foilHeatProfile(legacy).response * VENT_CLOSED_FACTOR);
for (const mode of ["tutorial", "drill"]) assert(usesFoil({ ...base, mode }));
assert(usesFoil({ ...base, foilOptIn: true }));
assert(usesFoil({ ...base, equip: { ...base.equip, hms: "tanukish_lid" } }));
for (const mode of ["rehearsal", "tournament"]) assert(!usesFoil({ ...base, mode }));
console.log(JSON.stringify({ factor: VENT_CLOSED_FACTOR, open10: o10, closed8: c8, closed10: c10, center: band.center, widthScale: band.totalWidthScale, optimalLow: band.optimal[0], justUpOpen: heatDelta(opened, up), justUpClosed: change, idealWidth: band.ideal[1] - band.ideal[0], score: score(old) }, null, 2));
