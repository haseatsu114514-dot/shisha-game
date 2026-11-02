import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
// a0857473: extraction-before finishStep bodies, including each chapter guard.
const legacy = {"2": "export function finishStep(value, craft) {\n  const p = tournamentProgress(value);\n  p.craft = copy(craft);\n  p.rollback = null;\n  if (craft.failed) { p.stage = \"defeat\"; p.failure = craft.failed; }\n  else p.step++;\n  return p;\n}", "3": "export function finishStep(value, craft) {\n  const p = tournamentProgress(value);\n  if (p.stage !== \"craft\" || p.step >= 11) throw new Error(\"制作工程の保存地点を確認できません\");\n  p.craft = copy(craft);\n  p.rollback = null;\n  if (craft.failed) { p.stage = \"defeat\"; p.failure = craft.failed; }\n  else p.step++;\n  return p;\n}"};
const copy = v => JSON.parse(JSON.stringify(v));
const outcome = fn => { try { return { value: fn() }; } catch(e) { return { error: e.name, message: e.message }; } };
let count = 0;
for (const chapter of [2, 3]) {
  const url = new URL(`../js/chapters/ch${chapter}-tournament-state.js`, import.meta.url);
  const actual = await import(url.href);
  const source = (await readFile(url, "utf8")).replace(/export function finishStep\(value, craft\) \{[\s\S]*?\n\}/, legacy[chapter])
    .replace(/from "(\.[^"]+)"/g, (_, path) => `from "${new URL(path, url).href}"`);
  const oracle = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
  const circular = {}; circular.self = circular;
  const crafts = [undefined, null, 0, false, "", { failed: false }, { failed: "" },
    { failed: "leaf", nested: { values: [1, 2] } }, { failed: "cold" }, { failed: true },
    { failed: 1 }, { nested: { values: [1, 2] } }, { omitted: undefined }, 1n, circular];
  const initial = (stage, step) => ({ chapter, flags: { [`_ch${chapter}_tournament`]: {
    version: 1, stage, step, attempts: 2, voted: 0, history: [], craft: { old: true },
    rollback: { stamina: 78 }, failure: "old", unrelated: { keep: [7] }
  } } });
  for (const stage of ["entry", "craft", "defeat", "complete"]) for (const step of [-1, 0, 10, 11, 12]) {
    for (const craft of crafts) {
      const a = initial(stage, step), b = copy(a);
      const before = outcome(() => copy(craft));
      const ra = outcome(() => actual.finishStep(a, craft));
      const rb = outcome(() => oracle.finishStep(b, craft));
      assert.deepEqual(ra, rb, `ch${chapter} ${stage}/${step}: return or JSON/guard error`);
      assert.deepEqual(a, b, "partial mutation and guard order match old code");
      assert.deepEqual(outcome(() => copy(craft)), before, "craft input remains unchanged");
      if (ra.value) {
        assert.equal(ra.value, a.flags[`_ch${chapter}_tournament`], "returns the original progress object");
        if (craft && typeof craft === "object") assert.notEqual(ra.value.craft, craft);
      }
      count++;
    }
  }
  // Missing progress is initialized before copying, even when the copy throws.
  for (const craft of [undefined, null, { failed: "leaf" }, { nested: [1] }]) {
    const a = { chapter, flags: {} }, b = copy(a);
    assert.deepEqual(outcome(() => actual.finishStep(a, craft)), outcome(() => oracle.finishStep(b, craft)));
    assert.deepEqual(a, b); count++;
  }
  const run = api => {
    let state = { chapter, flags: {}, stamina: 78, flavorStock: { mint: 10 }, equip: {}, recipes: [], stats: {} };
    api.startAttempt(state, { nested: [1], careHistory: [] });
    let craft = api.beginStep(state); state.stamina = 50;
    state = copy(state); api.recoverStep(state);
    assert.equal(state.stamina, 78, "interrupted consumption restores");
    craft = api.beginStep(state); state.stamina = 60;
    const result = api.finishStep(state, craft);
    craft.nested.push(2); assert.deepEqual(result.craft.nested, [1], "nested craft is copied");
    state = copy(state); api.recoverStep(state);
    assert.equal(state.stamina, 60, "committed consumption survives JSON reload/recovery");
    api.finishStep(state, { failed: "leaf" });
    return state;
  };
  assert.deepEqual(run(actual), run(oracle)); count++;
}
console.log(`PASS tournament finishStep: ${count} old-behavior comparisons, chapter guards, exceptions, copy and JSON recovery`);
