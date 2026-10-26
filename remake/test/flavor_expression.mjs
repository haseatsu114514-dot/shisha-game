// 商品の特徴 / 予測幅 / 仕上がった味と、品質評価を混同しないための契約テスト。
// node remake/test/flavor_expression.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { flavorFeatures, forecastExpression, mixExpression } from "../js/craft/flavor-profile.js";
import { temperatureBands, temperatureFitness } from "../js/craft/temperature-model.js";

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
const catalog = Object.fromEntries(flavors.map(flavor => [flavor.id, flavor]));
DB.flavorById = catalog;
const before = JSON.stringify(catalog);
const near = (actual, expected, message = "") => assert(Math.abs(actual - expected) < 1e-10, `${message}: ${actual} != ${expected}`);
const bounded = value => assert(Number.isFinite(value) && value >= 0 && value <= 10, `invalid strength: ${value}`);
const csFor = id => ({ mix: { [id]: 12 } });
const ends = id => {
  const cs = csFor(id), bands = temperatureBands(cs);
  return { cs, bands, low: mixExpression(cs, bands.ideal[0]), high: mixExpression(cs, bands.ideal[1]) };
};

const expressive = flavors.filter(flavor => flavor.thermal_expression);
assert.deepEqual(expressive.map(flavor => flavor.id).sort(), ["dobaj_mint", "double_apple", "lemon", "mint"]);
for (const flavor of expressive) {
  const profile = flavor.thermal_expression;
  assert.equal(profile.quality, "range");
  assert(profile.low_label && profile.high_label && profile.low_label !== profile.high_label);
  for (const anchor of [profile.low, profile.middle, profile.high]) Object.values(anchor).forEach(bounded);
  const cs = csFor(flavor.id), bands = temperatureBands(cs);
  near(bands.expressionWeight, 1);
  for (let i = 0; i <= 100; i++) {
    const temp = bands.ideal[0] + (bands.ideal[1] - bands.ideal[0]) * i / 100;
    near(temperatureFitness(temp, bands), 100, `${flavor.id} good band has no hidden center bonus`);
  }
  for (const sign of [-1, 1]) {
    const edge = bands.ideal[sign < 0 ? 0 : 1];
    near(temperatureFitness(edge + sign * .02, bands), 92.8);
    assert(temperatureFitness(edge + sign * .2, bands) < 30);
  }
}
const oldBands = temperatureBands(csFor("vanilla"));
assert.equal(oldBands.expressionWeight, 0);
near(temperatureFitness(oldBands.center, oldBands), 100);
near(temperatureFitness(oldBands.ideal[0], oldBands), 65);
let lastEdge = 65;
for (const fraction of [0, .000001, .01, .1, .5, .9, 1]) {
  const bands = temperatureBands({ mix: { vanilla: 12 * (1 - fraction), mint: 12 * fraction } });
  near(bands.expressionWeight, fraction);
  const edge = temperatureFitness(bands.ideal[0], bands);
  assert(edge >= lastEdge - 1e-10);
  near(edge, 65 + 35 * fraction);
  if (fraction > 0 && fraction < 1) assert(edge > 65 && edge < 100, "a trace of mint must not flatten the entire mix");
  lastEdge = edge;
}
console.log("[flavor expression] PASS: four defined products share equal-quality low/high bands; legacy and partial blends retain weighted precision");

const mint = ends("mint"), dobaj = ends("dobaj_mint"), apple = ends("double_apple"), lemon = ends("lemon");
assert(mint.high.values.cooling > mint.low.values.cooling);
assert(mint.high.values.sweetness < mint.low.values.sweetness);
assert(dobaj.high.values.sweetness > dobaj.low.values.sweetness);
assert(apple.high.values.spiciness > apple.low.values.spiciness);
assert(lemon.high.values.sourness > lemon.low.values.sourness);
for (const sample of [mint, dobaj, apple, lemon]) {
  assert.equal(sample.low.zone, "low"); assert.equal(sample.high.zone, "high");
  assert.notEqual(sample.low.label, sample.high.label);
  assert.equal(sample.low.values.naturalAroma, sample.high.values.naturalAroma);
  assert.equal(sample.low.values.confection, sample.high.values.confection);
  assert.notEqual(sample.low.values.sweetness, sample.low.values.confection);
  const cold = mixExpression(sample.cs, sample.bands.ideal[0] - .15);
  const hot = mixExpression(sample.cs, sample.bands.ideal[1] + .15);
  assert.equal(cold.zone, "cold"); assert.equal(hot.zone, "hot");
  assert(cold.values.assertiveness < sample.low.values.assertiveness);
  assert(hot.values.sweetness < sample.high.values.sweetness, "heating beyond the band must not extrapolate an ever-sweeter result");
}
const maskedCatalog = {
  sweet: { stats: { sweet_natural: 8, sweet_confection: 6, cooling: 0, sourness: 0, spiciness: 0 } },
  contrast: { stats: { sweet_natural: 8, sweet_confection: 6, cooling: 8, sourness: 8, spiciness: 8 } },
};
const plain = mixExpression(csFor("sweet"), .54, { catalog: maskedCatalog });
const contrast = mixExpression(csFor("contrast"), .54, { catalog: maskedCatalog });
assert.equal(plain.values.naturalAroma, contrast.values.naturalAroma);
assert.equal(plain.values.confection, contrast.values.confection);
assert(plain.values.sweetness > contrast.values.sweetness, "other strong sensations can change the prominence of the same sweet aroma");
const strawberryBands = temperatureBands(csFor("strawberry"));
const strawberry = mixExpression(csFor("strawberry"), strawberryBands.center);
assert(strawberry.values.naturalAroma >= 6 && strawberry.values.confection >= 5);
assert(strawberry.values.sweetness < 3, "this strawberry's strong aroma signature must not imply a sweet finish contrary to its product description");
assert.equal(strawberryBands.expressionWeight, 0, "a sweetness estimate does not grant a flat heat-quality band");
console.log("[flavor expression] PASS: heat changes character by product; sweetness, natural aroma and confection remain separate; excess heat is not sweeter");

for (const flavor of flavors) {
  const cs = csFor(flavor.id), bands = temperatureBands(cs), features = flavorFeatures(flavor);
  assert.equal(features.axes.length, 3); assert(features.tags.length <= 2);
  features.axes.forEach(axis => bounded(axis.value));
  assert.equal(Boolean(features.thermalNote), Boolean(flavor.thermal_expression));
  const loose = forecastExpression(cs, { precision: 0 }), precise = forecastExpression(cs, { precision: 1 });
  assert(loose.selected && precise.selected);
  assert.match(precise.note, /目安/);
  for (const [index, range] of precise.axes.entries()) {
    bounded(range.low); bounded(range.high);
    assert(range.low <= range.high);
    assert(range.low >= loose.axes[index].low && range.high <= loose.axes[index].high);
    for (let i = 0; i <= 20; i++) {
      const actual = mixExpression(cs, bands.ideal[0] + (bands.ideal[1] - bands.ideal[0]) * i / 20);
      Object.values(actual.values).forEach(bounded);
      assert(actual.values[range.key] >= range.low && actual.values[range.key] <= range.high);
    }
  }
}
const expertMint = forecastExpression(mint.cs, { precision: 1 });
const coolingForecast = expertMint.axes.find(axis => axis.key === "cooling");
assert(coolingForecast.high - coolingForecast.low >= mint.high.values.cooling - mint.low.values.cooling,
  "mastery narrows uncertainty but must preserve real differences between low and high heat");
assert(flavorFeatures(catalog.vanilla).tags.includes("お菓子感"));
assert(!flavorFeatures(catalog.mint).tags.includes("お菓子感"));
const vanillaWithMint = forecastExpression({ mix: { vanilla: 9, mint: 3 } });
assert.equal(vanillaWithMint.lowLabel, "甘い印象が主役", "a small mint addition must not lend the whole mix its leaf-specific label");
console.log(`[flavor expression] PASS: ${flavors.length} leaf cards and forecasts remain finite; all base features are public and mastery narrows only uncertainty`);

for (const cs of [undefined, null, {}, { mix: {} }, { mix: null }, { mix: { mint: 0, vanilla: NaN, lemon: -3 } }]) {
  const prediction = forecastExpression(cs);
  assert.equal(prediction.selected, false);
  prediction.axes.forEach(axis => assert.deepEqual([axis.low, axis.high], [0, 0]));
  assert.equal(mixExpression(cs).label, "未選択");
}
for (const catalogOverride of [{}, { unknown: { stats: { cooling: Infinity, sweet_natural: -5, sweet_confection: "8" } } }]) {
  for (const temp of [undefined, NaN, Infinity, -Infinity, -.5, .5, 2]) {
    const result = mixExpression(csFor("unknown"), temp, { catalog: catalogOverride });
    Object.values(result.values).forEach(bounded);
    assert.equal(result.expressive, false);
  }
}
for (const amount of [Number.MIN_VALUE, .001, 6, Number.MAX_VALUE]) {
  const cs = { mix: { mint: amount, vanilla: amount } };
  assert.deepEqual(mixExpression(cs, .54), mixExpression({ mix: { mint: 6, vanilla: 6 } }, .54));
}
const invalidExpression = { mystery: { heat_tolerance: 1, thermal_expression: { quality: "range", low: { sweetness: Infinity } } } };
Object.values(mixExpression(csFor("mystery"), .5, { catalog: invalidExpression }).values).forEach(bounded);
const readOnlyCs = Object.freeze({ mix: Object.freeze({ mint: 3, double_apple: 9 }) });
forecastExpression(readOnlyCs); mixExpression(readOnlyCs, .6);
assert.equal(JSON.stringify(catalog), before, "profile APIs mutated product data");
assert.equal(temperatureFitness(.54, { ...temperatureBands(), expressionWeight: undefined }), temperatureFitness(.54));
console.log("[flavor expression] PASS: empty/unknown/legacy/invalid data, extreme weights, optional catalogs and immutable inputs");
