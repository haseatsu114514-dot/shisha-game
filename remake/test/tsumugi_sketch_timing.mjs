import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const read = p => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const dialogue = JSON.parse(read("../../data/dialogue/ch1_main.json")).dialogues
  .find(d => d.dialogue_id === "ch1_tsumugi_sketch");
assert(dialogue);
const at = dialogue.lines.findIndex(l => l.type === "show_cg");

async function run(mode = "normal") {
  const calls = [], owner = { chapter: 1 }, loaded = { chapter: 2 };
  let stateModule, still, removed = false, sequence = false;
  const hooks = { onCg: id => calls.push(["gallery", id]) }, original = hooks.onCg;
  const play = async (d, opts) => {
    assert(sequence);
    calls.push(["play", d, opts]);
    if (calls.filter(c => c[0] === "play").length === 1) {
      if (mode === "intro-load") stateModule.setExport("state", loaded);
      return mode === "cancel" ? { cancelled: true } : {};
    }
    if (still) assert(!removed, "completed art stays until the VN CG is ready");
    if (mode === "throw") throw Error("expected");
    hooks.onCg(d.lines[0].cg_id);
    assert(!still || removed);
    return {};
  };
  const values = {
    "state.js": { state: owner, save() {} }, "stats.js": { ensureAffinityLevel() {} },
    "engine.js": { play, hooks, dialogueSequence: async fn => { sequence = true; try { return await fn(); } finally { sequence = false; } } },
    "data.js": { DB: { dialogues: { scene: dialogue } }, cgUrl: () => "art.png" },
    "util.js": { el: () => (still = { remove: () => { removed = true; } }) },
    "ui.js": { layers: { fx: { append() { calls.push(["still"]); } } }, imageReady: async () => mode !== "missing" },
    "scene-motions.js": { sketchIn: async (mid, url) => {
      calls.push(["motion", url]);
      if (mode === "motion-load") stateModule.setExport("state", loaded);
      mid();
    } },
    "spots.js": { hasContact() {} }, "tsumugi-schedule.js": { TSUMUGI_STORY: [] },
  };
  const context = vm.createContext({});
  const module = new vm.SourceTextModule(read("../js/chapters/tsumugi-story.js"), { context });
  const modules = {};
  await module.link(path => {
    const key = path.split("/").at(-1);
    return modules[key] ||= new vm.SyntheticModule(Object.keys(values[key]), function () {
      for (const [k, v] of Object.entries(values[key])) this.setExport(k, v);
      if (key === "state.js") stateModule = this;
    }, { context });
  });
  await module.evaluate();
  if (mode === "throw") await assert.rejects(module.namespace.playTsumugiSketch("scene", "store"), /expected/);
  else await module.namespace.playTsumugiSketch("scene", "store");
  assert.equal(hooks.onCg, original);
  assert(!still || removed, "still is always cleaned up");
  return calls;
}

for (const mode of ["normal", "missing", "throw", "intro-load", "motion-load", "cancel"]) {
  const calls = await run(mode), plays = calls.filter(c => c[0] === "play");
  assert.deepEqual(Array.from(plays[0][1].lines), dialogue.lines.slice(0, at));
  assert.equal(plays[0][1].growth_stats, undefined);
  if (["intro-load", "motion-load", "cancel"].includes(mode)) assert.equal(plays.length, 1);
  else {
    assert.deepEqual(Array.from(plays[1][1].lines), dialogue.lines.slice(at));
    assert.equal(plays[1][1].branches, dialogue.branches);
    if (mode !== "missing") assert(calls.findIndex(c => c[0] === "motion") > calls.indexOf(plays[0]));
  }
  console.log(`[tsumugi sketch timing] PASS: ${mode}`);
}
