// node remake/test/water_comfort.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { WATER, STEM_TIP, DEEP_WATER_LIMIT, waterComfort } from "../js/craft/water.js";

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const { DB } = await import("../js/core/data.js");
const { newGame } = await import("../js/core/state.js");
const { computeShisha } = await import("../js/craft/score.js");
for (const [name, key] of [["flavors", "flavor"], ["equipment", "equip"]]) {
  const rows = JSON.parse(fs.readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"))[name];
  DB[name] = rows;
  DB[`${key}ById`] = Object.fromEntries(rows.map(row => [row.id, row]));
}
newGame();

let checks = 0;
function check(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
const near = (a, b, epsilon = 1e-10) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);

check("named thresholds", () => {
  assert.equal(STEM_TIP, .30);
  assert.equal(DEEP_WATER_LIMIT, .85);
  assert.ok(STEM_TIP < WATER.low && WATER.high < DEEP_WATER_LIMIT);
});
for (const [q, band, drawW, bubble] of [
  [0, "none", -10, 0], [.30, "shallow", -5, .75], [.375, "shallow", -2.5, .75],
  [.45, "ideal", 0, 1], [.50, "ideal", 0, 1], [.55, "ideal", 0, 1],
  [.70, "deep", -4, 1], [.85, "deep", -8, 1], [1, "deep", -8, 1],
]) check(`quantity ${q}: ${band}`, () => {
  const result = waterComfort(q);
  assert.equal(result.band, band);
  near(result.drawW, drawW);
  assert.equal(result.bubble, bubble);
});
check("legacy non-numeric/non-finite water is ideal", () => {
  for (const q of [undefined, null, NaN, Infinity, -Infinity, "0", "0.5", {}, true]) {
    assert.deepEqual(waterComfort(q), { band: "ideal", drawW: 0, bubble: 1 });
  }
});
check("continuous at both ideal edges and deep saturation", () => {
  for (const edge of [WATER.low, WATER.high, DEEP_WATER_LIMIT]) {
    near(waterComfort(edge - 1e-9).drawW, waterComfort(edge).drawW, 1e-6);
    near(waterComfort(edge + 1e-9).drawW, waterComfort(edge).drawW, 1e-6);
  }
});
check("explicit none/shallow step at stem tip (spec table)", () => {
  assert.equal(waterComfort(STEM_TIP - 1e-9).drawW, -10);
  assert.equal(waterComfort(STEM_TIP).drawW, -5);
});
check("all water penalties are non-positive and smaller than fluffy draw +12", () => {
  for (let i = 0; i <= 1000; i++) {
    const { drawW } = waterComfort(i / 1000);
    assert.ok(drawW <= 0 && Math.abs(drawW) < 12);
  }
});

// craft_scoring_spec.mjs と同じ固定構成。水以外の入力は共通。
const cs = {
  equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
  holes: { total: 22, evenness: .6, outerEven: .6, innerExcess: 0, score: 60, minimumComplete: true },
  heat: { heatPower: 50, heatStability: 50, burnRisk: 30, aromaRetention: 55, score: 60 },
  mixInfo: { score: 60, intensity: 5, total: 12 },
  mix: { double_apple: 12 },
  pull: { score: 60, temp: .432, pulls: 3 },
  steam: { min: 5, hits: 2, score: 70 },
  care: { score: 60 }, pack: "normal",
};
const before = structuredClone(cs);
const ideal = computeShisha({ ...cs, water: .5 });
const none = computeShisha({ ...cs, water: 0 });
check("G6: complete stats match pre-connection score.js at unit 1 HEAD", () => {
  // 8b843dc20 の computeShisha に同じ構成を渡した実測値。水接続で既定値を変えない。
  assert.deepEqual(ideal, { draw: 80, smoke: 56, heatStability: 58, burnRisk: 25,
    aroma: 69, taste: 42, duration: 47, craftQuality: 62, craftQualityRaw: 62.381 });
});
check("G6: missing water and whole ideal band have identical complete stats", () => {
  for (const water of [undefined, NaN, "0", WATER.low, .5, WATER.high]) {
    assert.deepEqual(computeShisha({ ...cs, water }), ideal);
  }
  assert.deepEqual(computeShisha(cs), ideal);
});
check("draw and taste order, exact extreme penalties, smoke and other stats invariant", () => {
  for (const water of [0, STEM_TIP, .375, .7, DEEP_WATER_LIMIT, 1]) {
    const stats = computeShisha({ ...cs, water });
    for (const key of ["draw", "taste"]) {
      assert.ok(ideal[key] > stats[key], `${water}: ${key} penalty`);
      if (water !== 0) assert.ok(stats[key] > none[key], `${water}: none is worst ${key}`);
    }
    for (const key of ["smoke", "heatStability", "burnRisk", "aroma", "duration"]) {
      assert.equal(stats[key], ideal[key], `${water}: invariant ${key}`);
    }
  }
  assert.equal(ideal.draw - none.draw, 10);
  assert.equal(ideal.taste - none.taste, 5);
});
check("quality impact measurement and input remains unchanged", () => {
  near(ideal.craftQualityRaw - none.craftQualityRaw, 1);
  assert.equal(ideal.craftQuality - none.craftQuality, 1);
  assert.deepEqual(cs, before);
  console.log(JSON.stringify({ ideal, none, craftQualityDifference: ideal.craftQuality - none.craftQuality,
    craftQualityRawDifference: ideal.craftQualityRaw - none.craftQualityRaw }));
});
console.log(`water comfort: ${checks} passed, 0 failed`);
