import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { mixTaste } from "../js/craft/mix-taste.js";
import { recognitionId, craftRecognition } from "../js/craft/recognition.js";

DB.flavorById = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors.map(f => [f.id, f]));
DB.dialogues = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch1_tournament.json", import.meta.url))).dialogues.map(d => [d.dialogue_id, d]));
assert.equal(mixTaste({}).tags.length, 0);
assert.match(mixTaste({ double_apple: 9, mint: 3 }).detail, /アニス.*ミント/);
assert.deepEqual(mixTaste({ double_apple: 9, mint: 3 }), mixTaste({ double_apple: 18, mint: 6 }));
assert.match(mixTaste({ double_apple: 3, mint: 9 }).detail, /清涼感が前/);
assert(mixTaste({ vanilla: 12 }).tags.includes("甘さしっかり"));
assert(mixTaste({ mint: 12 }).tags.includes("清涼感強め"));
const warm = { temp: .54, score: 90 }, cold = { temp: .2, score: 20 };
assert.equal(recognitionId(), null); assert.equal(recognitionId({}), null);
assert.equal(recognitionId({ pull: warm, careHistory: [warm, warm] }), "steady");
assert.equal(recognitionId({ pull: cold, careHistory: [warm, warm] }), "recovered");
assert.equal(recognitionId({ pull: warm, careHistory: [cold, warm] }), "recovered");
assert.equal(recognitionId({ careHistory: [warm, warm] }), "care", "A supplied bowl cannot certify the player's serving");
assert.equal(recognitionId({ careHistory: [{ score: 99 }, warm] }), "care", "Missing temperature cannot be called recovery");
assert.equal(recognitionId({ pull: warm }, { careRounds: 0 }), "serve");
assert.equal(recognitionId({ heat: { score: 95 } }, { careRounds: 0 }), "heat");
assert.equal(recognitionId({ holes: { score: 95, outerEven: .9 } }), "holes");
assert.equal(recognitionId({ holes: { score: 95 } }), null);
assert.equal(recognitionId({ steam: { score: 100, hits: 0 } }), "steam");
assert.equal(recognitionId({ pull: { ...warm, failed: "leaf" } }), null);
assert.equal(recognitionId({ mix: { mint: 12 }, pull: warm }), "serve"); // Same temperature is within this leaf's green band.
assert.equal(recognitionId({ mix: { mint: 12 }, pull: { temp: .45, score: 90 } }), null); // A high saved score does not override the actual temperature.
assert.equal(recognitionId({ pull: warm, careHistory: [warm, warm] }, { careRounds: 1 }), "care");
for (const id of ["steady", "recovered", "care", "serve", "heat", "holes", "steam"]) {
  const lines = DB.dialogues[`ch1_craft_recognition_${id}`].lines;
  assert(lines.some(line => line.speaker === "sumi")); assert(lines.some(line => line.speaker === ""));
}
assert.match(craftRecognition({ pull: warm }).comment, /提供の温度/);
console.log("PASS: ratio-based taste, actual temperature/heat/holes/focus, supplied and legacy boundaries; no scoring mutation");
