// Startup help uses real session code and lesson text; DOM/observer ports are isolated.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";
import { demoFor } from "../js/craft/demo.js";

const source = await readFile(new URL("../js/craft/session.js", import.meta.url), "utf8");
const helpSource = await readFile(new URL("../js/craft/bench-ui.js", import.meta.url), "utf8");
const clockSource = await readFile(new URL("../js/craft/clock.js", import.meta.url), "utf8");

async function harness(mode = "tutorial", override = null) {
  const observers = new Set(), sleepers = [];
  const demos = [];
  let saved = 0;
  let now = 0;
  class Observer {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this); }
    disconnect() { observers.delete(this); }
  }
  const context = vm.createContext({ MutationObserver: Observer, Set, performance: { now: () => now } });
  const makeModule = async (text, imports) => {
    const mod = new vm.SourceTextModule(text, { context });
    await mod.link(spec => {
      const values = imports(spec);
      return new vm.SyntheticModule(Object.keys(values), function () {
        for (const [key, value] of Object.entries(values)) this.setExport(key, value);
      }, { context });
    });
    await mod.evaluate();
    return mod;
  };
  const help = await makeModule(helpSource, () => ({ el: () => {} }));
  const statePort = { state: { flags: {} } };
  let stateModule;
  const mod = new vm.SourceTextModule(source + "\nexport function setTestBench(value) { bench = value; }", { context });
  await mod.link(spec => {
    const declaration = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)].find(m => m[2] === spec);
    assert(declaration, `Unexpected import ${spec}`);
    const values = Object.fromEntries(declaration[1].split(",").map(x => [x.trim(), () => {}]));
    if (spec === "./bench-ui.js") Object.assign(values, help.namespace);
    if (spec === "../core/state.js") { values.state = statePort.state; values.save = () => { saved++; }; }
    if (spec === "./demo.js") { values.demoFor = demoFor; values.openDemoSheet = async (_, step) => { demos.push(step); }; }
    if (spec === "../core/util.js") values.sleep = () => new Promise(resolve => sleepers.push(resolve));
    const dep = new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context });
    if (spec === "../core/state.js") stateModule = dep;
    return dep;
  });
  await mod.evaluate();
  const clock = await makeModule(clockSource, () => ({}));
  const doc = new EventTarget(); doc.body = {}; doc.hidden = false;
  const styled = () => ({ style: { width: "", height: "", fontSize: "", lineHeight: "" } });
  const summary = styled(), title = styled(), footer = styled();
  const tip = { ...styled(), querySelector: selector => selector === "b" ? title : footer };
  const guide = new EventTarget(); guide.open = false;
  guide.querySelector = selector => selector === "summary" ? summary : tip;
  const root = { isConnected: true, classList: { contains: () => false }, ownerDocument: doc, dataset: {}, querySelector: () => guide };
  const panel = { dataset: { step: "steam" }, inert: false, closest: () => root };
  guide.addEventListener("toggle", () => { panel.inert = guide.open; root.dataset.helpPaused = String(guide.open); });
  const cs = { mode, ...(override ? { lessonHelp: { steam: override } } : {}) };
  const b = { cs, root, panel, guide: { root: guide, note: { ...styled(), textContent: "full manual help" } } };
  mod.namespace.setTestBench(b);
  const notify = () => { for (const observer of [...observers]) observer.callback(); };
  const close = () => { guide.open = false; guide.dispatchEvent(new Event("toggle")); };
  return { b, cs, guide, panel, root, observers, sleepers, notify, close, mod, demos, statePort, get saved() { return saved; },
    explain: () => mod.namespace.explainTutorialStep(cs, "steam"),
    replaceState: () => stateModule.setExport("state", {}),
    newBench: () => { const next = { ...b, explainedLessons: undefined }; mod.namespace.setTestBench(next); return next; },
    clock: () => clock.namespace.createCraftClock(panel, doc),
    tick: ms => { now += ms; },
  };
}

for (const step of ["holes", "place"]) test(`${step} demo helper appears once in lesson, including when skipped, and is saved`, async () => {
  const h = await harness();
  await h.mod.namespace.showStepDemo(h.cs, step);
  await h.mod.namespace.showStepDemo(h.cs, step);
  assert.deepEqual(h.demos, [step]);
  assert.equal(h.statePort.state.flags.seenDemo[step], true);
  assert.equal(h.saved, 1);
  const drill = await harness("drill");
  await drill.mod.namespace.showStepDemo(drill.cs, step);
  assert.equal(drill.demos.length, 0);
});

test("place cues cover the measured clip and only register existing controls", () => {
  const demo = demoFor("place");
  assert.equal(demo.src, "./media/demo-place.mp4");
  assert.deepEqual(demo.cues.map(c => c.from), [0, 3, 9.36]);
  for (const [i, cue] of demo.cues.entries()) {
    assert(cue.text && cue.to > cue.from);
    assert(cue.arrow.x >= 0 && cue.arrow.x <= 1 && cue.arrow.y >= 0 && cue.arrow.y <= 1);
    if (i) assert.equal(demo.cues[i - 1].to, cue.from);
  }
  assert.equal(demo.cues.at(-1).to, Infinity);
  assert.equal(demoFor("unknown"), null);
});

test("demo sheet pauses the craft clock during replay", async () => {
  const h = await harness();
  const clock = h.clock();
  h.tick(100); assert.equal(clock.now(), 100);
  h.root.dataset.demoPaused = "true";
  h.tick(300); assert.equal(clock.now(), 100);
  delete h.root.dataset.demoPaused;
  h.tick(200); assert.equal(clock.now(), 100);
  h.tick(50); assert.equal(clock.now(), 150);
  clock.dispose();
});

test("steam startup explains before dismissal and restores manual help", async () => {
  const h = await harness();
  const done = h.explain();
  assert.equal(h.guide.open, true);
  assert.equal(h.panel.inert, true);
  assert.equal(h.root.dataset.helpPaused, "true");
  assert.match(h.b.guide.note.textContent, /スミ「ハートは/);
  assert.match(h.b.guide.note.style.fontSize, /16px/);
  let settled = false; done.then(() => { settled = true; });
  await Promise.resolve(); assert.equal(settled, false);
  h.close(); assert.equal(await done, true);
  assert.equal(h.b.guide.note.textContent, "full manual help");
  assert.equal(h.b.guide.note.style.fontSize, "", "manual help styling is restored");
  assert.equal(h.panel.inert, false); assert.equal(h.observers.size, 0);
  assert.equal(await h.explain(), true); assert.equal(h.guide.open, false, "same-bench retry does not repeat");
  h.newBench(); const reload = h.explain();
  assert.equal(h.guide.open, true, "recreated bench explains its current step");
  h.close(); assert.equal(await reload, true);
});

for (const mode of ["drill", "rehearsal", "tournament"]) test(`${mode} starts without a tutorial gate`, async () => {
  const h = await harness(mode);
  assert.equal(await h.explain(), true); assert.equal(h.guide.open, false);
  assert.equal(h.panel.inert, false); assert.equal(h.b.guide.note.textContent, "full manual help");
});

for (const invalidation of ["remove", "state", "step", "replace-bench"]) test(`pending help rejects ${invalidation}`, async () => {
  const h = await harness(), done = h.explain();
  if (invalidation === "remove") h.root.isConnected = false;
  if (invalidation === "state") h.replaceState();
  if (invalidation === "step") h.panel.dataset.step = "pull";
  if (invalidation === "replace-bench") h.newBench();
  h.notify();
  assert.equal(await done, false); assert.equal(h.observers.size, 0);
  assert.equal(h.b.guide.note.style.fontSize, "", "temporary startup styling is removed");
  if (invalidation !== "step") assert.equal(h.panel.inert, false, "old input lock is released");
  assert.equal(h.b.explainedLessons.size, 0, "interrupted help is not recorded as read");
});

test("LOAD immediately after dismissal is rechecked before resuming", async () => {
  const h = await harness(), done = h.explain();
  h.close(); h.replaceState();
  assert.equal(await done, false);
});

test("concurrent startup waits share one guide and clean up once", async () => {
  const h = await harness(), first = h.explain(), second = h.explain();
  assert.equal(h.observers.size, 1);
  h.close(); assert.equal(await first, true); assert.equal(await second, true);
  assert.equal(h.b.guide.note.textContent, "full manual help");
  assert.equal(h.b.guide.note.style.fontSize, "");
});

test("current lesson override is reused", async () => {
  const h = await harness("tutorial", { brief: "既存の短文", detail: "スミ「既存の説明」" });
  const done = h.explain(); assert.equal(h.b.guide.note.textContent, "スミ「既存の説明」");
  h.close(); assert.equal(await done, true);
});

test("existing craft clock excludes explanation time, then resumes", async () => {
  const h = await harness();
  const done = h.explain(), clock = h.clock();
  h.tick(8000); assert.equal(clock.now(), 0); assert.equal(clock.paused, true);
  h.close(); assert.equal(await done, true);
  h.tick(1000); assert.equal(clock.now(), 1000); assert.equal(clock.paused, false);
  clock.dispose();
});

test("existing automatic craft driver acknowledges the displayed help", async () => {
  const h = await harness(); h.mod.namespace.craftTest.auto = "good";
  const done = h.explain(); assert.equal(h.guide.open, true);
  h.sleepers[0](); await Promise.resolve();
  // The native details element delivers toggle after open changes.
  h.guide.dispatchEvent(new Event("toggle"));
  assert.equal(await done, true);
});
