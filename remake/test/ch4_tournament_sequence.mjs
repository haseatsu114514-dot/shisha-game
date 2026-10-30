// Real world-tournament runner/state/scoring; controlled UI and individual mini-game input ports.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { newState, setState } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import * as match from "../js/chapters/ch4-tournament-state.js";
globalThis.document = { addEventListener() {} };
const score = await import("../js/craft/score.js");
const verdict = await import("../js/chapters/ch4-verdict.js");
delete globalThis.document;
const data = file => JSON.parse(fs.readFileSync(new URL(`../../data/${file}.json`, import.meta.url)));
DB.flavorById = Object.fromEntries(data("flavors").flavors.map(row => [row.id, row]));
DB.equipById = Object.fromEntries(data("equipment").equipment.map(row => [row.id, row]));
const source = fs.readFileSync(new URL("../js/chapters/ch4-tournament.js", import.meta.url), "utf8");

async function run({ failure = null, abandon = false, invalidate = false, resume = null, ask = true } = {}) {
  const value = resume || newState();
  if (!resume) {
    value.chapter = 4; value.phase = "tournament";
    value.flags._ch4_strategy = "sakura";
    value.flags._ch4 = { part: "tournament", read: { ch4_tournament_start: true, ch4_stranger_second: true, ch4_stranger_third: true } };
  }
  setState(value);
  const trace = [], snapshots = [];
  let current = true;
  const initial = () => ({ mode: "tournament", chapter: 4, equip: {}, mix: {}, careHistory: [],
    pack: "normal", place: "triangle", steamSeconds: 480, pullDone: false, total: 0 });
  const values = { ...match, ...score, ...verdict, state: value, CRAFT_STEPS: [],
    newSession: initial,
    save: () => snapshots.push(JSON.parse(JSON.stringify(value))),
    openBench: cs => trace.push(`bench:${match.chapterFourMatch(value).step}`),
    waitBenchReady: async () => trace.push("ready"),
    benchRoot: () => ({ querySelector: () => ({ append: () => trace.push("menu") }) }),
    retireScreen: () => trace.push("retire"), playBgm() {}, clearComments() {}, block() {},
    play: async dialogue => { trace.push(dialogue.dialogue_id); return {}; },
    modal: async options => { trace.push(options.title); return ask; },
    stepSetup: async () => trace.push("setup"), stepWater: async () => trace.push("water"),
    stepMix: async cs => { trace.push("mix"); cs.mix = { sakura: 12 }; cs.mixInfo = { total: 12, score: 96, intensity: 5 }; },
    stepPack: async cs => { trace.push("pack"); cs.pack = "normal"; },
    runHoles: async cs => { trace.push("holes"); cs.holes = { score: 96, outerEven: 1, total: 24, minimumComplete: true, innerExcess: 0 }; },
    stepPlace: async cs => { trace.push("place"); cs.place = "triangle"; },
    runHeat: async cs => { trace.push("heat"); cs.heat = { score: 96, heatPower: 85, heatStability: 100, burnRisk: 0, aromaRetention: 100 }; },
    stepSteamTime: async cs => { trace.push("steam-time"); cs.steamSeconds = 480; },
    runSteamDodge: async cs => { trace.push("steam"); cs.steam = { score: 96 }; },
    runPull: async cs => {
      trace.push("pull"); value.stamina -= 4;
      if (invalidate) { current = false; return true; }
      if (abandon) return false;
      cs.pull = { score: 96, temp: .54, pulls: 2 }; cs.pullDone = true;
      if (failure === "pull") cs.failed = "burnt";
      return true;
    },
    runCare: async (cs, { round }) => {
      trace.push(`care${round}`); cs.careHistory[round - 1] = { score: 96, temp: .54, coals: 1 };
      if (failure === `care${round}`) cs.failed = "cold";
    },
  };
  const context = vm.createContext({ console, structuredClone, DOMException });
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async spec => {
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .filter(row => row[2] === spec).flatMap(row => row[1].split(",").map(name => name.trim()));
    assert(names.every(name => name in values), `Missing controlled port for ${spec}`);
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name]);
    }, { context });
  });
  await module.evaluate();
  let result, error;
  try { result = await module.namespace.runChapterFourCraft({ isCurrent: () => current, menuButton: () => ({}) }); }
  catch (e) { error = e; }
  return { trace, snapshots, value, result, error };
}
const success = await run();
assert.equal(success.error, undefined);
assert.equal(success.result.win, true);
assert.equal(success.value.flags._ch4.match.step, 11);
assert.deepEqual(success.trace.filter(item => ["setup", "water", "mix", "pack", "holes", "place", "heat", "steam-time", "steam", "pull", "care1", "care2"].includes(item)),
  ["setup", "water", "mix", "pack", "holes", "place", "heat", "steam-time", "steam", "pull", "care1", "care2"]);
assert(success.trace.indexOf("pull") < success.trace.indexOf("ch4_customer_1"));
assert(success.trace.indexOf("ch4_customer_1") < success.trace.indexOf("care1"));
assert(success.trace.indexOf("ch4_customer_2") < success.trace.indexOf("care2"));
assert.deepEqual(success.value.flags._ch4.match.craft.customerChecks, [true, true]);
assert.equal(success.result.parts.care1, 96);
assert.equal(success.result.parts.care2, 96);
assert(success.result.parts.shisha > 0);
for (const failure of ["pull", "care1", "care2"]) {
  const failed = await run({ failure });
  assert.equal(failed.error, undefined);
  assert.equal(failed.result.win, false);
  if (failure === "pull") assert(!failed.trace.includes("care1"));
  if (failure === "care1") assert(!failed.trace.includes("care2"));
}
const abandoned = await run({ abandon: true });
assert.equal(abandoned.result, false);
assert.equal(abandoned.value.flags._ch4.match.result, null);
assert.equal(abandoned.value.flags._ch4.match.step, 8);
assert.equal(abandoned.value.stamina, 100, "Uncommitted pull consumption rolls back");
assert(!abandoned.trace.includes("care1"));
const invalidated = await run({ invalidate: true });
assert.equal(invalidated.error?.name, "AbortError");
assert.equal(invalidated.value.flags._ch4.match.result, null);
assert.equal(invalidated.value.flags._ch4.match.step, 8);
assert(!invalidated.trace.includes("care1"));
// Real serialized SAVE taken while pull is pending resumes that step only, not mix/heat or previous votes.
const pendingPull = success.snapshots.find(snapshot => snapshot.flags._ch4.match.step === 8 && snapshot.flags._ch4.match.rollback);
const resumed = await run({ resume: pendingPull });
assert.equal(resumed.error, undefined);
assert.equal(resumed.result.win, true);
assert(!resumed.trace.includes("mix"));
assert(!resumed.trace.includes("heat"));
assert.equal(resumed.value.flags._ch4.match.voted, 4);
const noAsk = await run({ ask: false });
assert.deepEqual(noAsk.value.flags._ch4.match.craft.customerChecks, [false, false]);
assert(!noAsk.trace.includes("ch4_customer_1"));
assert.equal(noAsk.result.total, success.result.total, "Asking is information, not an automatic points bonus");
console.log("PASS: real Chapter 4 runner awaits each craft step, handles failures/abandonment/owner changes and resumes serialized saves");
