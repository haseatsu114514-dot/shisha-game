// パッキングは適温帯を動かさず、温まり速度だけを変える（表示用の前提を固定）。
// node remake/test/packing_temperature.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { temperatureBands, temperatureAfterSteam } from "../js/craft/conditions.js";

const flavors = JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));

const base = {
  mix: { double_apple: 9, mint: 3 },
  steamSeconds: 480,
  heat: { heatPower: 50 },
  holes: { total: 24, minimumComplete: true },
  place: "three",
  environment: { rainy: false, ambientC: 23, humidityPercent: 52 },
};

const packs = ["fluffy", "normal", "firm"];
const bands = packs.map(pack => temperatureBands({ ...base, pack }));
assert.deepEqual(bands[0], bands[1]);
assert.deepEqual(bands[1], bands[2]);
assert.equal(bands[0].selected, true);
console.log("[packing temperature] PASS: packing choice does not move temperature bands");

const temps = Object.fromEntries(packs.map(pack => [pack, temperatureAfterSteam({ ...base, pack }, 480)]));
assert(temps.fluffy > temps.normal, `fluffy should warm faster: ${JSON.stringify(temps)}`);
assert(temps.normal > temps.firm, `firm should warm slower: ${JSON.stringify(temps)}`);
// conditions.js の係数: fluffy 1.08 / normal 1 / firm 0.85（表示の「熱の入り」注記と一致させる）
assert(temps.fluffy / temps.normal > 1);
assert(temps.firm / temps.normal < 1);
console.log(`[packing temperature] PASS: warm-up order fluffy(${temps.fluffy.toFixed(4)}) > normal(${temps.normal.toFixed(4)}) > firm(${temps.firm.toFixed(4)})`);
