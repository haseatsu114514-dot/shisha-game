import assert from "node:assert/strict";
import { continueContext, continueOpening } from "../js/chapters/continue-context.js";

const lines = (context, legacy) => continueOpening(continueContext(context, legacy)).map(c => c.text);
for (const [reason, opening] of Object.entries({
  burnt: "……熱が入りすぎたな", cold: "……冷え切っちまったか",
  leaf: "……香りが抜けちまったな", rank: "……届かなかったか",
})) {
  assert.equal(lines({ reason })[0], opening);
  assert.deepEqual(lines(null, { reason }), lines({ reason }), "legacy reason adapter");
}
assert.equal(lines({ reason: "rank", rank: 3 })[0], "……3位か。悔しいな");
for (const rank of [null, NaN, Infinity, -1, 0, 1.5, "3", true, Number.MAX_SAFE_INTEGER]) {
  assert.equal(lines({ reason: "rank", rank })[0], "……届かなかったか");
}
const keys = ["holes", "heat", "shisha", "care1", "care2"];
const expected = ["穴を開けよう", "芯が光る瞬間", "提供時の温度", "一度目の交換数", "二度目まで葉"];
for (const [i, key] of keys.entries()) {
  const parts = Object.fromEntries(keys.map(k => [k, k === key ? 1 : 80]));
  assert(lines({ reason: "rank", parts, completedParts: keys })[1].includes(expected[i]));
}
const tied = { reason: "rank", parts: { care2: 20, heat: 20, holes: 20, shisha: 20, care1: 20 }, completedParts: keys.slice().reverse() };
assert(lines(tied)[1].includes("穴を開けよう"), "ties use canonical order, independent of object/list order");
assert(lines({ ...tied, completedParts: ["heat", "care2"] })[1].includes("芯が光る瞬間"));
for (const parts of [{}, { holes: NaN }, { holes: Infinity }, { holes: "0" }, { unknown: -999 }]) {
  assert.equal(lines({ reason: "rank", parts, completedParts: ["holes", "unknown"] })[1], lines()[1]);
}
assert.deepEqual(lines({ reason: "unknown", rank: 2, parts: { holes: 0 }, completedParts: keys }), lines());
assert.deepEqual(lines({ reason: "__proto__" }), lines());
assert.equal(lines({ reason: "cold", rank: 3, parts: { holes: 0 }, completedParts: keys })[1], lines({ reason: "cold" })[1]);
const input = { reason: "rank", rank: 2, parts: { heat: 10 }, completedParts: ["heat"] };
const snapshot = continueContext(input);
input.rank = 4; input.parts.heat = 99; input.completedParts.push("holes");
assert.equal(snapshot.rank, 2); assert.equal(snapshot.parts.heat, 10);
assert.deepEqual(snapshot.completedParts, ["heat"]);
assert.throws(() => { snapshot.parts.heat = 0; }, TypeError);
assert.throws(() => snapshot.completedParts.push("holes"), TypeError);
console.log("PASS: four reasons, legacy adapter, rank validation, completed finite parts, ties, immutable context");
