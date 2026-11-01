import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// 99cf987e（抽出前）の2関数をoracleとして固定する。
// 章別の処理は同じソースで実行し、資源処理だけを旧実装へ差し戻して比較する。
const legacy = {
  resources: `export function resources(value) {
  return JSON.parse(JSON.stringify({ flavorStock: value.flavorStock, stamina: value.stamina,
    equip: value.equip, recipes: value.recipes, stats: value.stats }));
}`,
  restoreResources: `export function restoreResources(value, snapshot) {
  for (const [key, data] of Object.entries(JSON.parse(JSON.stringify(snapshot)))) value[key] = data;
}`,
};
const jsonCopy = value => JSON.parse(JSON.stringify(value));
const freeze = value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const outcome = action => {
  try { return { result: action() }; }
  catch (e) { return { error: e.name, message: e.message }; }
};
const resourceState = chapter => ({ chapter, day: 42, weatherSeed: 7317, flags: {},
  flavorStock: { citrus: 20, mint: 10 }, stamina: 78, equip: { bowl: { id: "suyaki" } },
  recipes: [{ mix: ["citrus", "mint"] }], stats: { sense: 15 }, money: 5000,
  contacts: ["sumi"], inbox: [{ id: "existing" }] });
let comparisons = 0;
const same = (a, b, label) => { assert.deepEqual(a, b, label); comparisons++; };
for (const chapter of [2, 3]) {
  const url = new URL(`../js/chapters/ch${chapter}-tournament-state.js`, import.meta.url);
  const actual = await import(url.href);
  let source = await readFile(url, "utf8");
  for (const [name, body] of Object.entries(legacy)) {
    const pattern = new RegExp(`export function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`, "g");
    assert.equal([...source.matchAll(pattern)].length, 1, `oracle replaces only ${name}`);
    source = source.replace(pattern, body);
  }
  source = source.replace(/from "(\.[^"]+)"/g, (_, path) => `from "${new URL(path, url).href}"`);
  const oracle = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

  // 欠落／型の違いもJSONの既存契約で比較する。循環やBigIntは例外のまま。
  const circular = {}; circular.self = circular;
  const atoms = [undefined, null, 0, false, "", "tea", [], { nested: [1, null, { n: 2 }] },
    NaN, Infinity, new Date("2026-01-01T00:00:00Z"), () => 1, Symbol("missing"), 1n, circular];
  const inputs = [{}, undefined, null, 0, false];
  for (const atom of atoms) {
    for (const key of ["flavorStock", "stamina", "equip", "recipes", "stats"]) inputs.push({ [key]: atom });
  }
  for (const input of inputs) {
    freeze(input);
    same(outcome(() => actual.resources(input)), outcome(() => oracle.resources(input)), `ch${chapter} capture boundary`);
  }
  const original = freeze(resourceState(chapter));
  const captured = actual.resources(original);
  same(captured, oracle.resources(original), "five resource fields only");
  assert.deepEqual(Object.keys(captured), ["flavorStock", "stamina", "equip", "recipes", "stats"]);
  captured.equip.bowl.id = "changed"; captured.recipes[0].mix.push("tea");
  assert.equal(original.equip.bowl.id, "suyaki");
  assert.deepEqual(original.recipes[0].mix, ["citrus", "mint"]);

  for (const snapshot of [...atoms, {}, { stamina: undefined, equip: null, stats: false },
    { arbitrary: { nested: [1, 2] }, money: 0 }]) {
    freeze(snapshot);
    const a = { untouched: { keep: true }, stamina: 80 }, b = jsonCopy(a);
    same(outcome(() => actual.restoreResources(a, snapshot)), outcome(() => oracle.restoreResources(b, snapshot)), "restore result/JSON exception");
    same(a, b, "restore target matches old code, including arbitrary keys and absent keys");
    same(outcome(() => actual.restoreResources(a, snapshot)), outcome(() => oracle.restoreResources(b, snapshot)), "second restore");
    same(a, b, "second restore target");
    assert.deepEqual(a.untouched, { keep: true });
  }
  for (const target of [undefined, null, 0, false]) {
    same(outcome(() => actual.restoreResources(target, { stamina: 0 })),
      outcome(() => oracle.restoreResources(target, { stamina: 0 })), "invalid restore target");
  }
  const snapshot = freeze({ arbitrary: { nested: [1] }, recipes: [{ mix: ["tea"] }] });
  const restored = {};
  actual.restoreResources(restored, snapshot);
  restored.arbitrary.nested.push(2); restored.recipes[0].mix.push("mint");
  assert.deepEqual(snapshot.arbitrary.nested, [1]);
  assert.deepEqual(snapshot.recipes[0].mix, ["tea"]);
  actual.restoreResources(restored, snapshot);
  same(restored, snapshot, "restore does not share nested references and can repeat");

  // JSON経由の旧SAVEを含む中断/再開・工程確定・失敗後再戦を両章で比較。
  const run = (api, missingKeys = false) => {
    let state = resourceState(chapter);
    if (missingKeys) { delete state.equip; delete state.recipes; state.stats = null; state.stamina = 0; }
    const trace = [];
    const step = action => {
      const result = outcome(action);
      trace.push(jsonCopy({ result, state }));
    };
    step(() => api.startAttempt(state, { careHistory: [], total: 0 }));
    step(() => api.beginStep(state));
    state.flavorStock.citrus -= 3; state.stamina -= 4;
    step(() => api.beginStep(state)); // ch2は毎回捕捉、ch3は最初のrollbackを保持
    state.flavorStock.mint -= 2;
    state = jsonCopy(state);
    step(() => api.recoverStep(state));
    step(() => api.recoverStep(state));
    step(() => api.beginStep(state));
    state.flavorStock.citrus -= 2;
    step(() => api.finishStep(state, { careHistory: [1], total: 30 }));
    state = jsonCopy(state);
    step(() => api.recoverStep(state)); // 確定した消費を戻さない
    step(() => api.beginStep(state));
    state.stamina -= 5;
    step(() => api.finishStep(state, { careHistory: [1], failed: "test failure" }));
    state = jsonCopy(state);
    step(() => api.startAttempt(state, { careHistory: [], total: 0 }));
    step(() => api.startAttempt(state, { careHistory: [], total: 1 })); // 章別二重呼出し差を保つ
    const p = state.flags[`_ch${chapter}_tournament`];
    p.step = 11;
    step(() => api.beginStep(state)); // ch3のみ拒否する境界
    step(() => api.finishStep(state, { careHistory: [], total: 2 }));
    return trace;
  };
  same(run(actual), run(oracle), `ch${chapter} checkpoint/retry trace`);
  same(run(actual, true), run(oracle, true), `ch${chapter} old SAVE missing fields trace`);
}
console.log(`tournament_resources: ${comparisons} legacy comparisons passed (chapter 2/3)`);
