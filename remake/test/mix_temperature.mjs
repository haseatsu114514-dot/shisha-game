// #401: pure model/score/effect boundaries, using the existing production flavor data.
// node remake/test/mix_temperature.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { temperatureBands, IDEAL, OPTIMAL, visualTemperature, isIdealTemperature, isOptimalTemperature,
  temperatureAfterSteam, pullResult, DANGER_TEMP, BURST_TEMP, COLD_OUT, isBurnt, isColdOut } from "../js/craft/conditions.js";
import { thermalBand, envAt } from "../js/craft/thermal.js";

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));
const near = (actual, expected, label = "") => assert(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} != ${expected}`);
const checkModel = (cs, expected, catalog) => {
  const bands = temperatureBands(cs, catalog);
  near(bands.t, expected, "t");
  bands.ideal.forEach((value, i) => near(value, IDEAL[i] * expected, "ideal"));
  bands.optimal.forEach((value, i) => near(value, OPTIMAL[i] * expected, "optimal"));
  near(bands.center, .54 * expected, "center");
  for (const band of [bands.ideal, bands.optimal]) assert(band.every(Number.isFinite) && band[1] > band[0] && band[0] > 0);
  return bands;
};

for (const flavor of flavors) checkModel({ mix: { [flavor.id]: 12 } }, flavor.heat_tolerance);
const vanilla = checkModel({ mix: { vanilla: 12 } }, .8);
const apple = checkModel({ mix: { double_apple: 12 } }, 1);
const mint = checkModel({ mix: { mint: 12 } }, 1.2);
near(vanilla.ideal[0], .336); near(vanilla.ideal[1], .528);
near(vanilla.optimal[0], .392); near(vanilla.optimal[1], .472);
near(mint.ideal[0], .504); near(mint.ideal[1], .792);
near(mint.optimal[0], .588); near(mint.optimal[1], .708);
console.log("[mix temperature] PASS: every real flavor, including vanilla / AF apple / AF mint examples");

checkModel({ mix: { vanilla: 9, mint: 3 } }, .9);
checkModel({ mix: { vanilla: 3, mint: 9 } }, 1.1);
checkModel({ mix: { double_apple: 10, mint: 2 } }, 1 + .2 / 6); // supplied mint regulation
const small = { mix: { vanilla: 9, mint: 3 }, steamSeconds: 480, pack: "normal" };
const large = { ...small, mix: { vanilla: 18, mint: 6 } };
assert.deepEqual(temperatureBands(small), temperatureBands(large));
assert(temperatureAfterSteam(large) < temperatureAfterSteam(small), "Total g stopped affecting physical warm-up");
assert.deepEqual(temperatureBands({ ...small, mixInfo: { total: 999, profile: { heat_resistance: 999 } } }), temperatureBands(small));
console.log("[mix temperature] PASS: mixtures, ratio changes, supplied mint; same ratio keeps bands while total g changes warm-up");

for (const cs of [undefined, null, {}, { mix: {} }, { mix: null }, { mixInfo: { total: 12 } },
  { mix: { unknown_legacy_flavor: 12 } }, { mix: { vanilla: 0, mint: -3, double_apple: NaN, missing: Infinity, string: "12" } }]) checkModel(cs, 1);
const legacy = JSON.parse('{"mix":{"removed_flavor":10,"mint":2},"steamMin":5}');
checkModel(legacy, 1 + .2 / 6);
for (const invalid of [undefined, null, 0, -1, NaN, Infinity, "1.2", Number.MIN_VALUE]) {
  checkModel({ mix: { legacy: 12 } }, 1, { legacy: { heat_tolerance: invalid, stats: { heat_resistance: 99 } } });
}
checkModel({ mix: { vanilla: 6, legacy: 6 } }, .9);
checkModel({ mix: { vanilla: Number.MAX_VALUE, mint: Number.MAX_VALUE } }, 1);
checkModel({ mix: { vanilla: Number.MIN_VALUE, mint: Number.MIN_VALUE } }, 1);
console.log("[mix temperature] PASS: empty/legacy saves, unknown or invalid heat_tolerance, ignored invalid g, extreme finite weights");

let boundaryCases = 0;
for (const flavor of flavors) {
  const bands = temperatureBands({ mix: { [flavor.id]: 12 } });
  for (const [name, band, check] of [["ideal", bands.ideal, isIdealTemperature], ["optimal", bands.optimal, isOptimalTemperature]]) {
    for (const [temp, expected] of [[band[0] - 1e-7, false], [band[0], true], [band[0] + 1e-7, true],
      [band[1] - 1e-7, true], [band[1], true], [band[1] + 1e-7, false]]) {
      assert.equal(check(temp, bands), expected, `${flavor.id} ${name} ${temp}`);
      assert.equal(pullResult(temp, 2, 0, bands)[name === "ideal" ? "inZone" : "optimal"], expected);
      const effect = thermalBand(temp, bands);
      if (name === "optimal") assert.equal(effect.id === "optimal", expected);
      else assert.equal(effect.id === "ready" || effect.id === "optimal", expected);
      if (isIdealTemperature(temp, bands)) {
        assert.equal(envAt(temp, bands).fire, 0); assert.equal(envAt(temp, bands).dark, 0); assert.equal(effect.haze, 0);
      }
      boundaryCases++;
    }
  }
  near(pullResult(bands.center, 2, 0, bands).score, 100);
  for (const edge of bands.optimal) assert.equal(pullResult(edge, 2, 0, bands).score, 96);
  for (const edge of bands.ideal) assert.equal(pullResult(edge, 2, 0, bands).score, 65);
  assert.equal(pullResult(bands.center, 5, 5, bands).score, 84);
  assert.equal(pullResult(bands.center, 3, 0, bands, 2).score, 92);
  assert.equal(pullResult(bands.center, 2, 0, bands).score, pullResult(bands.center, 2, 5, bands).score);
  for (let i = 0; i <= 200; i++) {
    const temp = i / 200, effect = envAt(temp, bands);
    for (const value of Object.values(effect).filter(v => typeof v === "number")) assert(Number.isFinite(value));
    assert.equal(effect.rainbow > 0, isOptimalTemperature(temp, bands), `${flavor.id} rainbow at ${temp}`);
    if (isIdealTemperature(temp, bands)) assert.equal(effect.fire + effect.dark + effect.sparks, 0);
  }
}
assert.equal(thermalBand(.76, mint).id, "ready");
assert.equal(envAt(.76, mint).fire, 0);
assert(visualTemperature(.76, mint) > mint.ideal[1] && visualTemperature(.76, mint) < DANGER_TEMP);
console.log(`[mix temperature] PASS: ${boundaryCases} inclusive green/rainbow edge cases; scoring and continuous effects agree`);

assert.deepEqual([DANGER_TEMP, BURST_TEMP, COLD_OUT], [.90, 1, .06]);
for (const bands of [vanilla, apple, mint, ...flavors.map(f => temperatureBands({ mix: { [f.id]: 12 } }))]) {
  assert.equal(thermalBand(.90, bands).id, "inferno");
  assert.equal(thermalBand(.8999, bands).id, "fire");
  assert.equal(visualTemperature(.90, bands), .90); assert.equal(visualTemperature(1, bands), 1);
  assert.deepEqual([.98, .999, 1].map(isBurnt), [false, false, true]);
  assert.deepEqual([.0599, .06, .0601].map(isColdOut), [true, true, false]);
  assert.deepEqual(envAt(.90, bands), envAt(.90));
  assert.deepEqual(envAt(1, bands), envAt(1));
}
assert.deepEqual(temperatureBands({ mix: { double_apple: 12 } }), apple);
assert.deepEqual(temperatureBands(), apple);
assert.throws(() => { mint.ideal[0] = 0; }, TypeError);
assert.throws(() => { IDEAL[0] = 0; }, TypeError);
assert.deepEqual(temperatureBands({ mix: { vanilla: 12 } }), vanilla);
console.log("[mix temperature] PASS: immutable per-shisha models, no cross-session leak; danger/burst/cold absolute thresholds unchanged");
