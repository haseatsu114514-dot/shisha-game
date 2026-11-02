// Real chapter entry, choice hook and drill menu; controlled VN/craft ports, no browser.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const sources = new Map(["remake/js/core/util.js", "remake/js/daily/tonari.js", "remake/js/chapters/ch1.js"].map(file => [file, read(file)]));
const scene = JSON.parse(read("data/dialogue/ch1_main.json")).dialogues.find(scene => scene.dialogue_id === "ch1_day7_last_night");
const drillSource = read("remake/js/craft/session.js").match(/export const DRILLS = (\{[\s\S]*?\n\});/)[1];
const drills = vm.runInNewContext(`(${drillSource})`);
const copy = value => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const fresh = () => ({ chapter: 1, day: 13, slot: 2, stamina: 57, money: 10000, flags: {}, best: { holes: 1 },
  flavorStock: { lemon: 50 }, stats: { sense: 10 }, growth: { xp: 30 }, reel: { count: 0 } });

async function harness(initial = fresh(), { cancelEnding = false, holdDrill = false } = {}) {
  let game = copy(initial), statePort, menu, screen, finishDrill, saves = [], choices = [], entries = [], drillRuns = [], select = 0, cancel = 0;
  class Node {
    constructor(tag) {
      this.tagName = tag; this.dataset = {}; this.children = []; this.events = new Map(); this.classes = new Set();
      this.classList = { add: (...names) => names.forEach(name => this.classes.add(name)), contains: name => this.classes.has(name) };
    }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, fn) { const list = this.events.get(name) || []; list.push(fn); this.events.set(name, list); }
    click() { for (const fn of this.events.get("click") || []) fn(); }
  }
  const hooks = {};
  const ports = {
    DB: { dialogues: { ch1_day7_last_night: scene } }, hooks, DRILLS: drills, CRAFT_STEPS: [], TOURNAMENT_DAY: 14,
    SE: { select: () => select++, cancel: () => cancel++ }, config: {},
    save: () => saves.push(copy(game)), flag: key => !!game.flags[key], setFlag: key => { game.flags[key] = true; },
    maxStamina: () => 100, addStamina: amount => { game.stamina += amount; }, recordRomanceChoice() {},
    playTsumugiStory: async () => {},
    showScreen: (name, node) => { screen = name; menu = node; return node; }, retire: node => node.classList.add("done"),
    runDrill: id => { drillRuns.push(id); return holdDrill ? new Promise(resolve => { finishDrill = resolve; }) : Promise.resolve(2); },
    play: dialogue => {
      entries.push(dialogue);
      if (dialogue.dialogue_id === scene.dialogue_id) return new Promise(resolve => choices.push({ dialogue, resolve }));
      return Promise.resolve({ id: dialogue.dialogue_id, ...(cancelEnding ? { cancelled: true } : {}) });
    },
  };
  const context = vm.createContext({ document: { createElement: tag => new Node(tag), createTextNode: text => Object.assign(new Node("#text"), { textContent: text }) }, Node, DOMException });
  const namesByFile = new Map();
  for (const [file, source] of sources) for (const match of source.matchAll(/import\s+(?:\{([^}]+)\}|\*\s+as\s+\w+)\s+from\s+["']([^"']+)["']/g)) {
    const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[2]));
    const names = namesByFile.get(dependency) || new Set();
    for (const name of (match[1] || "").split(",").filter(Boolean)) names.add(name.trim().split(/\s+as\s+/)[0]);
    namesByFile.set(dependency, names);
  }
  const modules = new Map();
  async function load(file) {
    if (modules.has(file)) return modules.get(file);
    let module;
    if (sources.has(file)) module = new vm.SourceTextModule(sources.get(file), { context, identifier: file });
    else {
      const names = [...(namesByFile.get(file) || [])];
      module = new vm.SyntheticModule(names, function () {
        for (const name of names) this.setExport(name, name === "state" ? game : Object.hasOwn(ports, name) ? ports[name]
          : () => { throw Error(`Unexpected port ${name}`); });
      }, { context, identifier: file });
      if (file === "remake/js/core/state.js") statePort = module;
    }
    modules.set(file, module);
    if (sources.has(file)) await module.link((specifier, parent) => load(path.posix.normalize(path.posix.join(path.posix.dirname(parent.identifier), specifier))));
    return module;
  }
  const chapter = await load("remake/js/chapters/ch1.js"); await chapter.evaluate(); chapter.namespace.setupHooks();
  const nodes = node => [node, ...node.children.flatMap(nodes)];
  return {
    state: () => game, saves, entries, drillRuns, choices, sounds: () => ({ select, cancel }),
    button: test => nodes(menu).find(node => node.dataset.test === test),
    chooseDrill: () => modules.get("remake/js/daily/tonari.js").namespace.chooseDrill(),
    run() { const task = chapter.namespace.NIGHT_EVENTS[13].run(); task.catch(() => {}); return task; },
    choose(branch) {
      const pending = choices.shift(); assert(pending, "Existing VN choice menu is open");
      const line = pending.dialogue.lines.find(line => line.id === "night_before_choice");
      const choice = line.choices.find(choice => choice.next === branch); assert(choice);
      hooks.onChoice(scene.dialogue_id, line.id, branch, "", choice, line);
      pending.resolve({ id: scene.dialogue_id });
    },
    replaceState(next) { game = copy(next); statePort.setExport("state", game); },
    finishDrill: () => finishDrill(2),
    assertMenuOnly() {
      assert.equal(choices.length, 1); const at = scene.lines.findIndex(line => line.id === "night_before_choice");
      assert.deepEqual(choices[0].dialogue.lines, scene.lines.slice(at - 1, at + 1));
      assert.equal(choices[0].dialogue.lines.at(-1).choices.length, 4);
    },
    assertDrillMenu(count = 5) { assert.equal(screen, "tonari"); assert.equal(nodes(menu).filter(node => node.tagName === "button").length, count); },
  };
}

{
  const h = await harness(), task = h.chooseDrill();
  h.assertDrillMenu(4);
  assert.equal(h.button("drill-back"), undefined, "The default selector retains its original required-choice contract");
  h.button("drill-heat").click();
  assert.equal(await task, "heat", "Default callers receive a real drill id");
  assert.deepEqual(h.sounds(), { select: 1, cancel: 0 });
}
{
  const h = await harness(), task = h.run(); await flush();
  assert.deepEqual(h.choices[0].dialogue.lines, scene.lines, "First entry retains the complete introduction");
  h.choose("drill"); await flush(); h.assertDrillMenu();
  const before = copy(h.state()), back = h.button("drill-back"), heat = h.button("drill-heat");
  back.click(); back.click(); heat.click(); await flush();
  const expected = copy(before); delete expected.flags._ch1_eve.choice; expected.flags._ch1_eve.menuShown = true;
  assert.deepEqual(copy(h.state()), expected, "Back rolls back only the pending choice, without charging or awarding anything");
  assert.deepEqual(h.sounds(), { select: 0, cancel: 1 });
  assert.deepEqual(h.drillRuns, []); h.assertMenuOnly();
  const saved = h.saves.at(-1); assert.deepEqual(saved, expected);
  h.choose("sleep_early"); await task;
  assert.equal(h.state().stamina, 100); assert.equal(h.state().flags._last_night, "sleep_early");
  assert.deepEqual(h.entries.filter(entry => entry.dialogue_id.endsWith("_sleep_early")).length, 1);
  const resumed = await harness(saved), resumedTask = resumed.run(); await flush(); resumed.assertMenuOnly();
  resumed.choose("sleep_early"); await resumedTask;
  assert.equal(resumed.state().flags._last_night, "sleep_early"); assert.deepEqual(resumed.drillRuns, []);
}
{
  const initial = fresh(); initial.flags._ch1_eve = { choice: "drill", checkpoint: "preserve until a real choice" };
  const h = await harness(initial), task = h.run(); await flush(); h.assertDrillMenu();
  assert.equal(h.choices.length, 0, "Saved drill choice resumes directly at the selector");
  h.button("drill-back").click(); await flush(); h.assertMenuOnly();
  assert.equal(h.state().flags._ch1_eve.checkpoint, initial.flags._ch1_eve.checkpoint);
  h.choose("drill"); await flush();
  const heat = h.button("drill-heat"), back = h.button("drill-back");
  heat.click(); heat.click(); back.click(); await task;
  assert.deepEqual(h.drillRuns, ["heat"]); assert.deepEqual(h.sounds(), { select: 1, cancel: 1 });
  assert.equal(h.state().flags._ch1_eve.practiceDone, true); assert.equal(h.state().best.heat, 2);
  assert.equal(h.state().flags._last_night, "drill");
}
for (const complete of [false, true]) {
  const initial = fresh(); initial.flags._ch1_eve = { choice: "drill", drill: "heat", staminaBefore: 57, ...(complete ? { practiceDone: true } : {}) };
  initial.best.heat = complete ? 2 : 1;
  const h = await harness(initial); await h.run();
  assert.equal(h.choices.length, 0); assert.deepEqual(h.drillRuns, complete ? [] : ["heat"]);
  assert.equal(h.state().flags._ch1_eve.staminaBefore, 57); assert.equal(h.state().flags._ch1_eve.practiceDone, true);
  const before = copy(h.state()); await h.run(); assert.deepEqual(copy(h.state()), before, "Completed eve cannot repeat its drill or ending");
}
for (const interruption of ["load", "day", "slot", "checkpoint"]) {
  const initial = fresh(); initial.flags._ch1_eve = { choice: "drill" };
  const h = await harness(initial), task = h.run(); await flush();
  const back = h.button("drill-back");
  if (interruption === "load") h.replaceState(fresh());
  else if (interruption === "checkpoint") h.state().flags._ch1_eve = { choice: "sleep_early" };
  else h.state()[interruption]++;
  const expected = copy(h.state()), saved = h.saves.length;
  back.click(); await assert.rejects(task, { name: "AbortError" });
  assert.deepEqual(copy(h.state()), expected, `${interruption}: stale back cannot mutate the current run`);
  assert.equal(h.saves.length, saved); assert.deepEqual(h.drillRuns, []);
}
{
  const h = await harness(), task = h.run(); await flush();
  h.choices[0].resolve({ cancelled: true });
  await assert.rejects(task, { name: "AbortError" });
  assert.deepEqual(copy(h.state()), fresh()); assert.equal(h.saves.length, 0);
}
{
  const initial = fresh(); initial.flags._ch1_eve = { choice: "drill", drill: "heat" };
  const h = await harness(initial, { holdDrill: true }), task = h.run(); await flush();
  assert.deepEqual(h.drillRuns, ["heat"]);
  h.replaceState(fresh()); const expected = copy(h.state()), saved = h.saves.length;
  h.finishDrill(); await assert.rejects(task, { name: "AbortError" });
  assert.deepEqual(copy(h.state()), expected); assert.equal(h.saves.length, saved);
}
{
  const initial = fresh(); initial.flags._ch1_eve = {};
  const h = await harness(initial), task = h.run(); await flush();
  assert.deepEqual(h.choices[0].dialogue.lines, scene.lines, "Unknown old empty progress must retain the complete introduction");
  h.choose("sleep_early"); await task;
}
{
  const initial = fresh(); initial.flags._ch1_eve = { menuShown: true };
  const h = await harness(initial, { cancelEnding: true }), task = h.run(); await flush(); h.assertMenuOnly();
  h.choose("sleep_early"); await assert.rejects(task, { name: "AbortError" });
  assert.equal(h.state().stamina, 57); assert.equal(h.state().flags._ev_last_night, undefined);
}
console.log("eve cancellation: actual night entry/menu/back; one-shot inputs; unchanged resources; saved selection/return; selected/completed drills; LOAD/day/slot/checkpoint guards");
