// 実ch4ランナーの読了・保存・通知境界をVMで検証する（ブラウザ表示の代用ではない）。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import * as progress from "../js/chapters/ch4-progress.js";
import { newState } from "../js/core/state.js";

const context = vm.createContext({ AbortController });
const node = (spec, attrs = {}, children = []) => Array.isArray(attrs)
  ? { spec, children: attrs } : { spec, ...attrs, children };
let state, owner, screen, cancel = false, saves = 0;
const notices = [], comparisons = [];
const dialogues = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch4_main.json", import.meta.url))).dialogues;
const values = {
  DB: { dialogues: Object.fromEntries(dialogues.map(d => [d.dialogue_id, d])) },
  bgUrl: id => id, el: node, save: () => saves++,
  layers: { hud: { replaceChildren() {}, classList: { remove() {} } } },
  showScreen: (_, tree) => { screen = tree; }, setBg: async () => {},
  playBgm() {}, toast: text => notices.push(text), hooks: {},
  play: async () => ({ cancelled: cancel }),
  radar: (current, baseline, size) => { comparisons.push({ current, baseline, size }); return node("svg"); },
};
let source = fs.readFileSync(new URL("../js/chapters/ch4.js", import.meta.url), "utf8");
source += '\nexport function testOwner(value) { session = value; }\nexport { readAndCommit, renderComplete };';
const modules = new Map();
const module = new vm.SourceTextModule(source, { context });
await module.link(spec => {
  if (modules.has(spec)) return modules.get(spec);
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)];
  const names = imports.filter(m => m[2] === spec).flatMap(m => m[1].split(",").map(n => n.trim()));
  const exports = spec === "./ch4-progress.js" ? progress : values;
  const stub = new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, name === "state" ? state : exports[name]);
  }, { context });
  modules.set(spec, stub); return stub;
});
// stateはlink後evaluate時に公開される。同じオブジェクトを各ケースの保存内容で置き換える。
state = newState();
await module.evaluate();
const runner = module.namespace;
function seed() {
  const fresh = newState();
  Object.assign(fresh, { chapter: 3, phase: "cleared", day: 45 });
  fresh.flags._ch3_cleared = true;
  progress.advanceToChapterFour(fresh);
  for (const scene of progress.CH4_PROLOGUE) progress.completeChapterFourScene(fresh, scene.id);
  progress.completeChapterFourScene(fresh, "ch4_stranger_first");
  progress.endChapterFourDay(fresh); progress.endChapterFourDay(fresh);
  Object.assign(state, fresh);
  owner = { state, active: true };
  runner.testOwner(owner);
  cancel = false; notices.length = 0; saves = 0;
}
seed();
const prior = JSON.stringify(state);
cancel = true;
assert.equal(await runner.readAndCommit(owner, "ch4_stranger_second"), false);
assert.equal(JSON.stringify(state), prior, "Cancelled reading must not unlock or save");
assert.equal(saves, 0); assert.equal(notices.length, 0);
cancel = false;
assert.equal(await runner.readAndCommit(owner, "ch4_stranger_second"), true);
assert.equal(saves, 1);
assert.deepEqual(notices, ["路地裏のカフェに再訪できるようになった"]);
assert.deepEqual(state.stats, JSON.parse(prior).stats, "Unlock must not award stat growth");
assert.equal(await runner.readAndCommit(owner, "ch4_stranger_second"), false);
assert.equal(notices.length, 1, "Unavailable second reading must not notify twice");
seed();
progress.endChapterFourDay(state); progress.endChapterFourDay(state);
assert.equal(state.flags._ch4.part, "eve");
assert.equal(await runner.readAndCommit(owner, "ch4_stranger_second"), true);
assert.equal(notices.length, 0, "Forced eve reading has no free revisit to advertise");
// 結果発表の承認は読み物で返し、能力加算はしない。
progress.completeChapterFourScene(state, "ch4_wang_reception_forced_in");
progress.completeChapterFourScene(state, "ch4_wang_reception");
progress.completeChapterFourScene(state, "ch4_stranger_third");
progress.finishChapterFourEve(state);
progress.completeChapterFourScene(state, "ch4_tournament_start");
progress.completeChapterFourScene(state, "ch4_final");
const beforeResult = JSON.stringify(state.stats);
assert.equal(await runner.readAndCommit(owner, "ch4_result"), true);
assert.equal(JSON.stringify(state.stats), beforeResult);
assert(dialogues.find(d => d.dialogue_id === "ch4_result").lines.some(l => l.speaker === "sumi" && /よくやった/.test(l.text)));
for (const scene of progress.CH4_RESOLUTION.slice(1)) progress.completeChapterFourScene(state, scene.id);
state.flags._ch4_preview_seen = true;
runner.renderComplete(owner);
assert.equal(comparisons.at(-1).current, state.stats);
assert.equal(comparisons.at(-1).baseline, state.statsAtChapterStart);
const walk = n => !n ? [] : [n, ...(n.children || []).flatMap(walk)];
assert(walk(screen).some(n => n.dataset?.test === "ch4-growth"));
// 章開始能力を持たない旧セーブは差分を捏造せず、同じ能力を比較する。
delete state.statsAtChapterStart;
runner.renderComplete(owner);
assert.equal(comparisons.at(-1).baseline, state.stats);
console.log("PASS: Chapter 4 rewards separate learning, revisit unlock, recognition and actual growth comparison (VM)");
