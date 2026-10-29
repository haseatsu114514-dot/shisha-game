// Actual playFinale + native VN tournament condition; unrelated ports controlled.
// No browser, real play SAVE/LOAD or user storage is opened.
import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const root = process.env.A1044_SOURCE_ROOT ? pathToFileURL(path.resolve(process.env.A1044_SOURCE_ROOT) + "/") : new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const { tournamentFinished } = await import(new URL("remake/js/core/story-context.js", root));
const source = read("remake/js/daily/bonds.js"), engine = read("remake/js/vn/engine.js");
const DB = { dialogues: {}, equipById: { suyaki_naru: { id: "suyaki_naru", name: "なるの素焼き" } }, flavorById: {} };
for (const file of ["ch1_naru", "ch1_bonds"]) for (const d of JSON.parse(read(`data/dialogue/${file}.json`)).dialogues) DB.dialogues[d.dialogue_id] = d;
let state, mode = "normal", saves = 0, gifts = 0, signalToAbort;
const fresh = (chapter = 2, phase = "daily") => { state = { chapter, phase, day: 18, flags: {}, met: {}, stats: {}, owned: [], finales: {}, flavors: [] }; saves = gifts = 0; };
fresh();
const context = vm.createContext({});
const stateModule = new vm.SyntheticModule(["state", "save"], function () { this.setExport("state", state); this.setExport("save", () => saves++); }, { context });
let bonds;
function exactFunction(text, name) {
  const start = text.indexOf(`function ${name}(`); assert(start >= 0);
  const end = text.indexOf("\n}\n", start); assert(end > start); return text.slice(start, end + 2);
}
const handlerContext = vm.createContext({ tournamentFinished, DB, STAT_EN: {}, jumpTo: () => { throw Error("Unexpected cross-scene jump"); } });
vm.runInContext(exactFunction(engine, "handleCondition"), handlerContext);
function rows(id) {
  const d = DB.dialogues[id]; assert(d); const running = { queue: [...d.lines], branches: d.branches || {} }, out = [];
  handlerContext.state = state; handlerContext.running = running; handlerContext.hooks = { evalCondition: line => bonds.bondCondition(line) };
  while (running.queue.length) { const line = running.queue.shift(); if (line.type === "condition") handlerContext.handleCondition(line); else out.push(line); }
  return out;
}
const ports = {
  DB, state, AFFINITY_GATE_CHOICES: {}, isLover: () => false,
  giftOpen: async () => { gifts++; }, emit: () => {},
  play: async id => {
    rows(typeof id === "string" ? id : id.dialogue_id);
    if (mode === "cancel") return { cancelled: true };
    if (mode === "throw") throw Error("controlled VN exception");
    if (mode === "abort") signalToAbort.abort();
    if (mode === "replace") { state = { ...state, flags: { loaded_owner: true }, owned: [], finales: {} }; stateModule.setExport("state", state); }
    return { id: "ch1_naru_bond_finale", visited: [] };
  },
};
const mod = new vm.SourceTextModule(source, { context });
await mod.link(spec => {
  if (spec.endsWith("/state.js")) return stateModule;
  const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].filter(m => m[2] === spec).flatMap(m => m[1].split(",").map(n => n.trim()));
  assert(names.length, `Unexpected import ${spec}`);
  return new vm.SyntheticModule(names, function () { for (const n of names) this.setExport(n, n in ports ? ports[n] : () => { throw Error(`Unexpected port ${n}`); }); }, { context });
});
await mod.evaluate(); bonds = mod.namespace;
const reset = (chapter, phase = "daily") => { fresh(chapter, phase); stateModule.setExport("state", state); mode = "normal"; };
const text = id => rows(id).map(r => r.text || "").join("\n");
const beforeText = /大会前|本番、よろしく|正面から叩く|勝った方が作る/;
const results = [];
reset(1); assert.match(text("ch1_naru_fifth"), beforeText); assert.match(text("ch1_naru_bond_finale"), /大会前の最後/);
results.push("chapter1 pre-match dialogue retained");
for (const chapter of [2, 3]) {
  reset(chapter); const before = JSON.stringify(state);
  assert.doesNotMatch(text("ch1_naru_fifth"), beforeText); assert.doesNotMatch(text("ch1_naru_bond_finale"), /大会前/);
  assert.equal(JSON.stringify(state), before, "Reading chapter context cannot mutate state");
  assert(rows("ch1_naru_fifth").some(r => r.type === "remember" && r.memory_id === "naru_inherit"));
  assert(rows("ch1_naru_bond_finale").some(r => r.type === "apply" && r.stats.insight === 2));
}
results.push("later chapters with no new flags preserve memory/effects and avoid pre-match lines");
for (const phase of ["aftermath", "cleared"]) { reset(1, phase); assert.doesNotMatch(text("ch1_naru_fifth"), beforeText); }
results.push("post-promise chapter1 phases use completed-match wording");
assert(engine.includes('kind === "tournament_finished"'), "Tournament context must work natively, without chapter hooks");
reset(2); assert.equal(await bonds.playFinale("naru"), true); assert.deepEqual(state.owned, ["suyaki_naru"]); assert.equal(gifts, 1); assert.equal(saves, 1);
assert.equal(await bonds.playFinale("naru"), false); assert.equal(gifts, 1); assert.equal(saves, 1);
results.push("actual playFinale retains one-time gift and save");
for (const failure of ["cancel", "throw", "abort", "replace"]) {
  reset(2); mode = failure; signalToAbort = new AbortController();
  if (failure === "throw") await assert.rejects(bonds.playFinale("naru"), /controlled VN exception/);
  else assert.equal(await bonds.playFinale("naru", { signal: signalToAbort.signal }), false);
  assert.equal(state.owned.length, 0); assert.equal(Object.keys(state.finales).length, 0); assert.equal(gifts, 0); assert.equal(saves, 0);
}
results.push("cancel/throw/abort/replaced LOAD owner cannot grant gift or save");
// 第4章の結末: 十五年前の一台はカルダモン。スミの締めくくり（ボウル）を読んだ時だけ心の声を足す（#1346）。
for (const d of JSON.parse(read("data/dialogue/ch4_main.json")).dialogues) if (d.dialogue_id === "ch4_ending") DB.dialogues.ch4_ending = d;
const bowlVoice = /閉店後の一台と同じ/;
reset(4); assert.match(text("ch4_ending"), /カルダモンだけの/); assert.doesNotMatch(text("ch4_ending"), bowlVoice);
reset(4); state.finales.naru = { day: 10, chapter: 1, route: "friend" }; assert.doesNotMatch(text("ch4_ending"), bowlVoice);
reset(4); state.finales.sumi = { day: 10, chapter: 1, route: "friend" }; assert.match(text("ch4_ending"), bowlVoice);
results.push("ch4 ending adds the cardamom inner voice only after Sumi's bowl finale");
console.log(JSON.stringify({ groups: results.length, results, scope: "actual module/VN condition handler with explicit controlled ports; no browser or real LOAD" }, null, 2));
