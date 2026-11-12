// Shared transition behavior, with DOM/WAAPI/clock boundaries controlled in a VM.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

const code = await fs.readFile(new URL("../js/core/transition-kit.js", import.meta.url), "utf8");
const flush = () => new Promise(setImmediate);
async function rig() {
  let now = 0, serial = 0;
  const timers = new Map(), listeners = new Set(), nodes = [];
  const context = vm.createContext({
    console,
    setTimeout(fn, ms) { const id = ++serial; timers.set(id, { at: now + ms, fn }); return id; },
    clearTimeout(id) { timers.delete(id); },
    window: {
      addEventListener(_type, fn) { listeners.add(fn); },
      removeEventListener(_type, fn) { listeners.delete(fn); },
    },
  });
  const mod = new vm.SourceTextModule(code, { context });
  await mod.link(() => new vm.SyntheticModule(["el", "nextFrame"], function () {
    this.setExport("el", () => { const node = { removed: false, remove() { this.removed = true; } }; nodes.push(node); return node; });
    this.setExport("nextFrame", async () => {});
  }, { context }));
  await mod.evaluate();
  return {
    kit: mod.namespace, timers, nodes,
    async advance(ms) {
      now += ms;
      for (const [id, timer] of timers) if (timer.at <= now) { timers.delete(id); timer.fn(); }
      await flush();
    },
    blocked(key = "Enter") {
      let blocked = false;
      const event = { key, preventDefault() { blocked = true; }, stopImmediatePropagation() {} };
      for (const listener of listeners) listener(event);
      return blocked;
    },
  };
}

function animation() {
  let resolve, reject;
  const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { node: { animate: () => ({ finished }) }, resolve, reject };
}

// A line scheduled well after its animation duration must not disappear before it starts.
{
  const r = await rig(), anim = animation();
  let done = false;
  const task = r.kit.move(anim.node, [{ opacity: 0 }, { opacity: 1 }], 200, { delay: 320 }).then(() => { done = true; });
  await r.advance(280);
  assert.equal(done, false, "delayed animation was released before its start");
  await r.advance(240);
  assert.equal(done, false, "fallback cut off the delay or the real animation");
  anim.resolve(); await task;
  assert.equal(r.timers.size, 0, "completed animation retained its fallback timer");
}

// When WAAPI does not settle (e.g. a fake clock), the complete finite timeline still has an upper bound.
{
  const r = await rig(), anim = animation();
  let done = false;
  const task = r.kit.move(anim.node, [], 50, { duration: 100, delay: 100, iterations: 3, endDelay: 40 }).then(() => { done = true; });
  await r.advance(519);
  assert.equal(done, false);
  await r.advance(1); await task;
  assert.equal(done, true);
}

// Cancellation is expected during scene changes and must not leave a rejected promise or timer.
{
  const r = await rig(), anim = animation();
  const task = r.kit.move(anim.node, [], 600);
  anim.reject(new Error("canceled")); await task;
  assert.equal(r.timers.size, 0);
}

// Infinite animation timelines cannot be passed to setTimeout (Infinity would become an immediate timer).
{
  const r = await rig(), anim = animation();
  const task = r.kit.move(anim.node, [], 600, { iterations: Infinity });
  assert.equal(r.timers.size, 0);
  anim.reject(new Error("canceled")); await task;
}

// Overlapping transitions share an input guard; finishing one must keep the other guarded.
{
  const r = await rig();
  const releaseA = r.kit.holdKeys(), releaseB = r.kit.holdKeys();
  assert.equal(r.blocked(), true); assert.equal(r.blocked(" "), true);
  assert.equal(r.blocked("ArrowLeft"), false);
  releaseA(); releaseA();
  assert.equal(r.blocked(), true, "one transition released another transition's keyboard guard");
  releaseB();
  assert.equal(r.blocked(), false);
}

// Cover/reveal failures both unwind the overlay and input guard through release().
for (const failure of ["cover", "reveal"]) {
  const r = await rig(), error = new Error(failure);
  let revealCalls = 0;
  const c = r.kit.curtain({ append() {} }, "test", async () => { if (failure === "cover") throw error; },
    async () => { revealCalls++; throw error; });
  const guard = r.kit.holdKeys();
  assert.equal(r.blocked(), true);
  await assert.rejects(c.release(), err => err === error);
  assert.equal(r.nodes[0].removed, true, `${failure} failure retained the scene overlay`);
  assert.equal(revealCalls, failure === "cover" ? 0 : 1);
  assert.equal(r.blocked(), true, "cleanup released an unrelated transition");
  await c.release(); // Idempotent even after failure.
  guard(); assert.equal(r.blocked(), false);
}

console.log("PASS: delayed/repeated animation lifetime, cancellation, nested keyboard guards and failure cleanup");
