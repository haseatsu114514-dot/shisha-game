// #401: pure model/score/effect boundaries, using the existing production flavor data.
// node remake/test/mix_temperature.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { temperatureBands, IDEAL, OPTIMAL, visualTemperature, isIdealTemperature, isOptimalTemperature,
  temperatureAfterSteam, pullResult, DANGER_TEMP, BURST_TEMP, COLD_OUT, isBurnt, isColdOut } from "../js/craft/conditions.js";
import { thermalBand, envAt } from "../js/craft/thermal.js";
import { temperatureFitness, makerMixProfile } from "../js/craft/temperature-model.js";

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));
const near = (actual, expected, label = "") => assert(Math.abs(actual - expected) < 1e-12, `${label}: ${actual} != ${expected}`);
const checkModel = (cs, expected, catalog, width = 1.04) => {
  const bands = temperatureBands(cs, catalog);
  near(bands.t, expected, "t");
  bands.ideal.forEach((value, i) => near(value, .54 * expected + (i ? 1 : -1) * .12 * width, "ideal"));
  bands.optimal.forEach((value, i) => near(value, .54 * expected + (i ? 1 : -1) * .05 * width, "optimal"));
  near(bands.center, .54 * expected, "center");
  for (const band of [bands.ideal, bands.optimal]) assert(band.every(Number.isFinite) && band[1] > band[0] && band[0] > 0);
  return bands;
};

const widths = { af: 1, dobaj: 1.25, afsahr: .92, forcefect: .72, fuwari: .72, nightside: .75 };
for (const flavor of flavors) checkModel({ mix: { [flavor.id]: 12 } }, flavor.heat_tolerance, undefined, 1.04 * widths[flavor.maker]);
const vanilla = checkModel({ mix: { vanilla: 12 } }, .8);
const apple = checkModel({ mix: { double_apple: 12 } }, 1);
const mint = checkModel({ mix: { mint: 12 } }, 1.2);
near(vanilla.ideal[0], .3072); near(vanilla.ideal[1], .5568);
near(vanilla.optimal[0], .38); near(vanilla.optimal[1], .484);
near(mint.ideal[0], .5232); near(mint.ideal[1], .7728);
near(mint.optimal[0], .596); near(mint.optimal[1], .7);
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
      if (name === "optimal") assert.equal(effect.id === "optimal", expected && bands.expressionWeight < .999);
      else assert.equal(effect.id === "ready" || effect.id === "optimal", expected);
      if (isIdealTemperature(temp, bands)) {
        assert.equal(envAt(temp, bands).fire, 0); assert.equal(envAt(temp, bands).dark, 0); assert.equal(effect.haze, 0);
      }
      boundaryCases++;
    }
  }
  near(pullResult(bands.center, 2, 0, bands).score, 100);
  for (const edge of bands.optimal) assert.equal(pullResult(edge, 2, 0, bands).score, Math.round(90 + 10 * bands.expressionWeight));
  for (const edge of bands.ideal) assert.equal(pullResult(edge, 2, 0, bands).score, Math.round(65 + 35 * bands.expressionWeight));
  assert.equal(pullResult(bands.center, 5, 5, bands).score, 84);
  assert.equal(pullResult(bands.center, 3, 0, bands, 2).score, 92);
  assert.equal(pullResult(bands.center, 2, 0, bands).score, pullResult(bands.center, 2, 5, bands).score);
  for (let i = 0; i <= 200; i++) {
    const temp = i / 200, effect = envAt(temp, bands);
    for (const value of Object.values(effect).filter(v => typeof v === "number")) assert(Number.isFinite(value));
    assert.equal(effect.rainbow > 0, isOptimalTemperature(temp, bands) && bands.expressionWeight < .999, `${flavor.id} rainbow at ${temp}`);
    if (isIdealTemperature(temp, bands)) assert.equal(effect.fire + effect.dark + effect.sparks, 0);
  }
}
assert.equal(thermalBand(.76, mint).id, "ready");
assert.equal(envAt(.76, mint).fire, 0);
assert(visualTemperature(.76, mint) > mint.ideal[1] && visualTemperature(.76, mint) < DANGER_TEMP);
console.log(`[mix temperature] PASS: ${boundaryCases} inclusive green/rainbow edges; expressive blends stay green across their tasty range`);

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
assert.deepEqual(temperatureBands().ideal, apple.ideal);
assert.equal(temperatureBands().selected, false);
assert.throws(() => { mint.ideal[0] = 0; }, TypeError);
assert.throws(() => { IDEAL[0] = 0; }, TypeError);
assert.deepEqual(temperatureBands({ mix: { vanilla: 12 } }), vanilla);
console.log("[mix temperature] PASS: immutable per-shisha models, no cross-session leak; danger/burst/cold absolute thresholds unchanged");

// #636 / #637: fixed mass and equipment, preserving the proportions of the non-Dobaj leaves.
// Includes the two-/three-company -> pure Dobaj endpoint, not just whole-gram samples.
const recipes = [
  { double_apple: 1 }, { nightside_earlgrey: 1 }, { forcefect_mikan: 1 },
  { double_apple: .5, nightside_earlgrey: .5 },
  { double_apple: .25, nightside_earlgrey: .25, forcefect_mikan: .5 },
];
const equipment = [{}, { bowl: "suyaki_hagal", hms: "amaburst_hms", charcoal: "cube_charcoal" },
  { bowl: "nightside_premier_hagal", hms: "tanukish_lid", charcoal: "flat_charcoal" }];
const fractions = [...new Set([0, 1e-14, 1e-10, .1 / 12, 1 / 12, .25, .5, .75, 1 - 1e-10, 1,
  ...Array.from({ length: 1001 }, (_, i) => i / 1000)])].sort((a, b) => a - b);
let widthCases = 0;
for (const recipe of recipes) for (const equip of equipment) {
  let previous = 0;
  const base = temperatureBands({ mix: recipe, equip });
  const end = temperatureBands({ mix: { dobaj_double_apple: 12 }, equip });
  for (const fraction of fractions) {
    const mix = Object.fromEntries(Object.entries(recipe).map(([id, w]) => [id, 12 * (1 - fraction) * w]));
    mix.dobaj_double_apple = 12 * fraction;
    const cs = { mix, equip }, bands = temperatureBands(cs), profile = makerMixProfile(cs);
    const width = bands.ideal[1] - bands.ideal[0];
    assert(width >= previous - 1e-12, `Dobaj width shrank at ${fraction}`);
    near(width, (base.ideal[1] - base.ideal[0]) * (1 - fraction) + (end.ideal[1] - end.ideal[0]) * fraction);
    near(bands.optimal[1] - bands.optimal[0], width * .05 / .12);
    assert.deepEqual(profile.ideal, bands.ideal); assert.deepEqual(profile.optimal, bands.optimal);
    // A changed center does not promise a high score at the original absolute temperature.
    previous = width; widthCases++;
  }
}
const original = temperatureBands({ mix: { nightside_earlgrey: 12 } });
assert(temperatureFitness(original.center, vanilla) < 90);
console.log(`[mix temperature] PASS: ${widthCases} Dobaj width samples, infinitesimal/0.1g/1g/25-50-75-100%, multiple makers and pure endpoint`);

const catalog = { a: { maker: "af", heat_tolerance: 1 }, b: { maker: "nightside", heat_tolerance: 1 },
  c: { maker: "af", heat_tolerance: 1.2 } };
const reference = temperatureBands({ mix: { a: 12 } }, catalog);
for (const cs of [{ mix: { b: 12 } }, { mix: { a: 12 }, equip: equipment[1] }, { mix: { a: 12 }, equip: equipment[2] }]) {
  const changed = temperatureBands(cs, catalog);
  near(changed.center, reference.center);
  assert.notEqual(changed.totalWidthScale, reference.totalWidthScale);
}
const hotter = temperatureBands({ mix: { c: 12 } }, catalog);
assert.notEqual(hotter.center, reference.center);
near(hotter.totalWidthScale, reference.totalWidthScale);
near(hotter.ideal[1] - hotter.ideal[0], reference.ideal[1] - reference.ideal[0]);
for (const flavor of flavors) {
  const bands = temperatureBands({ mix: { [flavor.id]: 12 } });
  for (const [temp, expected] of [[bands.center, 100], ...bands.optimal.map(t => [t, 90 + 10 * bands.expressionWeight]),
    ...bands.ideal.map(t => [t, 65 + 35 * bands.expressionWeight])]) {
    near(temperatureFitness(temp, bands), expected);
    assert.equal(pullResult(temp, 2, 0, bands).score, Math.round(expected));
    for (const delta of [-1e-9, 1e-9]) {
      assert(Math.abs(temperatureFitness(temp + delta, bands) - expected) < 1e-5);
      assert.equal(pullResult(temp + delta, 2, 0, bands).score, Math.round(expected));
    }
  }
  for (const sign of [-1, 1]) {
    const edge = sign < 0 ? bands.ideal[0] : bands.ideal[1];
    near(temperatureFitness(edge + sign * .01, bands), 65 + 35 * bands.expressionWeight - .01 * 360);
    assert.equal(temperatureFitness(edge + sign, bands), 0);
  }
  for (const [at, expected] of [[.42, bands.ideal[0]], [.49, bands.optimal[0]], [.54, bands.center], [.59, bands.optimal[1]], [.66, bands.ideal[1]]]) near(visualTemperature(at, bands), expected);
}
assert.equal(mint.expressionWeight, 1, "AF mint must support low/high expression");
for (const temp of [mint.ideal[0], mint.center, mint.ideal[1]]) {
  assert.equal(temperatureFitness(temp, mint), 100);
  assert.equal(thermalBand(temp, mint).id, "ready");
  assert.equal(envAt(temp, mint).rainbow, 0);
}
assert.equal(vanilla.expressionWeight, 0, "Unconfigured leaves retain their focused heat curve");
assert.equal(thermalBand(vanilla.center, vanilla).id, "optimal");
const mixedExpression = temperatureBands({ mix: { mint: 3, vanilla: 9 } });
near(mixedExpression.expressionWeight, .25);
near(temperatureFitness(mixedExpression.ideal[0], mixedExpression), 73.75);
assert.equal(thermalBand(mixedExpression.center, mixedExpression).id, "optimal");
console.log("[mix temperature] PASS: position/width independence, continuous classic/expressive curves, fixed outside slope 360 and shared visual anchors");
