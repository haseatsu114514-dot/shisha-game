// 本番の穴開けをVM/仮想時計で操作し、円飛ばし・最低1周・少穴採点を検証。
// node --experimental-vm-modules remake/test/foil_holes.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const craftRoot = new URL("../js/craft/", import.meta.url);
let now = 1000, nextFrame = 1, frames = new Map(), keymap = null, panel = null, automated = null;
const stamps = [], delayed = [], results = [];
class Element {
  constructor(spec) { const [tag, ...classes] = spec.split("."); this.tag = tag; this.classes = new Set(classes); this.children = []; this.listeners = {}; this.style = {}; this.dataset = {}; this.disabled = false;
    this.classList = { add: (...v) => v.forEach((c) => this.classes.add(c)), toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c) };
  }
  append(...children) { for (const child of children.flat().filter(Boolean)) this.children.push(child); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  querySelector(tag) { for (const child of this.children) { if (child.tag === tag) return child; const found = child.querySelector?.(tag); if (found) return found; } return null; }
}
function el(spec, attrs = {}, children = []) { if (Array.isArray(attrs)) { children = attrs; attrs = {}; } const n = new Element(spec); Object.assign(n, attrs); n.append(children); return n; }
const find = (test, node = panel) => node?.dataset?.test === test ? node : node?.children.map((child) => find(test, child)).find(Boolean);
function fire(test, type = "click") { const node = find(test); assert(node, test); for (const fn of node.listeners[type] || []) fn({ preventDefault() {} }); }
const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
async function frame(time) { now = time; const waiting = [...frames.values()]; frames.clear(); for (const callback of waiting) callback(now); await settle(); }
const values = {
  "util.js": { el, sleep: async () => {}, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (lo) => lo },
  "ui.js": { countdown: async () => {} },
  "audio.js": { SE: Object.fromEntries(["punch", "perfect", "good", "miss", "just", "whoosh"].map((name) => [name, () => {}])) },
  "session.js": { stepPanel: () => (panel = new Element("div.panel")), refreshRig: () => {}, tickerSay: () => {} },
  "common.js": { gradeOf: (score) => score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D", autoSkill: () => automated,
    skill: { slow: () => 1, window: () => 1 }, resultCard: async (_, data) => results.push(data), keys: (map) => { keymap = map; return () => { keymap = null; }; }, popStamp: (_, text, kind) => stamps.push({ text, kind }) },
};
const context = vm.createContext({ Math, Promise, console, performance: { now: () => now },
  requestAnimationFrame: (fn) => { const id = nextFrame++; frames.set(id, fn); return id; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout: (fn) => delayed.push(fn) });
const mods = new Map();
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  const mod = values[name] ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
    : new vm.SourceTextModule(await fs.readFile(new URL(name, craftRoot), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod;
}
const holesModule = await load("holes.js"); await holesModule.evaluate();
const holes = holesModule.namespace, logic = (await load("holes_logic.js")).namespace;
function rings(counts = [12, 0, 0], error = 0) { return logic.RINGS.map((ring, i) => ({ ...ring, taken: Array.from({ length: ring.targets }, (_, k) => k < counts[i]), extra: 0,
  holes: Array.from({ length: counts[i] }, (_, k) => ({ a: k * Math.PI * 2 / counts[i], d: error })) })); }
const tally = { perfect: 0, good: 0, miss: 0, tooClose: 0, blank: 12, tooMany: 0 };
const sparse = holes.evaluate(rings(), tally, 1, 11), full = holes.evaluate(rings([12, 8, 4]), { ...tally, blank: 0 }, 1, 11);
assert.equal(sparse.score, full.score); assert(sparse.minimumComplete); assert.equal(sparse.timingTolerance, 1.35); assert.equal(full.timingTolerance, 1);
assert.equal(sparse.densityProfile.density, 0.5); assert.equal(sparse.densityProfile.sparse, 0.5); assert.equal(full.densityProfile.sparse, 0);
assert(holes.evaluate(rings([12, 0, 0], 6), tally, 1, 11).precision > holes.evaluate(rings([12, 8, 4], 6), tally, 1, 11).precision);
assert.equal(holes.evaluate(rings([0, 0, 0]), tally, 1, 11).score, 0); assert(!holes.evaluate(rings([11, 0, 0]), tally, 1, 11).minimumComplete);
const wrapped = rings(); wrapped[0].holes.forEach((hole, i) => hole.a += Math.PI * 2 * (i % 3 - 1));
assert(Math.abs(holes.evaluate(wrapped, tally, 1, 11).evenness - 1) < 1e-12);
assert(Math.abs(logic.circularAngleDistance(-0.01, Math.PI * 6 + 0.01) - 0.02) < 1e-12);
assert.equal(logic.foilDensityProfile(rings([22, 8, 4])).density, 1);

async function start(auto = null) { now = 1000; automated = auto; frames.clear(); stamps.length = 0; delayed.length = 0; results.length = 0; const cs = { mode: "drill", holes: null }; const running = holes.runHoles(cs); await settle(); return { cs, running }; }
async function punchCircle(period, targets, elapsedStart = 0) {
  for (let k = 0; k < targets; k++) { await frame(1000 + (elapsedStart + k * period / targets) * 1000); fire("hole-punch", "pointerdown"); await settle(); }
}
// 最低外周完成まではクリック、Enter、次リングの全経路を拒否。
let active = await start(); assert(find("hole-done").disabled); assert(find("hole-next").disabled);
fire("hole-done"); fire("hole-next"); keymap.Enter(); await settle(); assert.equal(active.cs.holes, null); assert.equal(results.length, 0);
await punchCircle(6.4, 12); assert(!find("hole-done").disabled); assert(!find("hole-next").disabled); assert(find("hole-punch").disabled);
// 完成後に連打しても遅延送りを増やさない。待っても外周のまま。
const stampCount = stamps.length; for (let i = 0; i < 5; i++) fire("hole-punch", "pointerdown"); assert.equal(stamps.length, stampCount); assert.equal(delayed.length, 0);
await frame(now + 400); assert(panel.children[0].children[1].children[0].textContent.startsWith("外周"));
fire("hole-next"); await frame(now + 400); assert(panel.children[0].children[1].children[0].textContent.startsWith("中周"));
await punchCircle(5.2, 8, 10.4); fire("hole-next"); await frame(now + 400); assert(panel.children[0].children[1].children[0].textContent.startsWith("内周"));
await punchCircle(3.8, 4, 15.2); assert.equal(active.cs.holes, null); keymap.Enter(); await active.running;
assert.equal(active.cs.holes.middle, 8); assert.equal(active.cs.holes.inner, 4); assert.equal(active.cs.holes.total, 24); assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.densityProfile.sparse, 0);
assert(stamps.some((stamp) => stamp.text === "EXCELLENT"));
// 一周で仕上げる選択もS評価になり、空き目印のMISS/BLANKを出さない。
active = await start(); await punchCircle(6.4, 12); fire("hole-done"); await active.running;
assert.equal(active.cs.holes.total, 12); assert.equal(active.cs.holes.middle, 0); assert.equal(active.cs.holes.grade, "S"); assert.equal(active.cs.holes.densityProfile.sparse, 0.5); assert(!stamps.some((stamp) => stamp.text === "BLANK SPACE"));
// 中周を一部開けてから仕上げても、目印の開け残し自体を減点しない。
active = await start(); await punchCircle(6.4, 12); fire("hole-next"); await punchCircle(5.2, 1, 10.4); fire("hole-done"); await active.running;
assert.equal(active.cs.holes.total, 13); assert.equal(active.cs.holes.middle, 1); assert.equal(active.cs.holes.grade, "S");
// 時間が0になっても外周未完成では終えない。最低条件達成後は時間評価0で完成。
active = await start(); await frame(35000); assert.equal(active.cs.holes, null); assert(find("hole-plan").textContent.includes("時間0"));
fire("hole-done"); fire("hole-next"); keymap.Enter(); assert.equal(active.cs.holes, null);
await punchCircle(6.4, 12, 38.4); await frame(now + 1); await active.running;
assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.total, 12); assert.equal(active.cs.holes.timeRatio, 0);
assert.equal(active.cs.holes.score, sparse.score - 5);
// 既存のgood/bad自動操作も最低外周を完成させ、次リングを明示的に進めて終了する。
const automatedScores = [];
for (const level of ["good", "bad"]) {
  active = await start(level); await active.running; assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.outer, 12);
  assert.equal(active.cs.holes.middle, level === "good" ? 8 : 5); assert.equal(active.cs.holes.inner, level === "good" ? 4 : 3); automatedScores.push(active.cs.holes.score);
}
assert(automatedScores[0] > automatedScores[1]);
console.log("[remake foil] guarded outer circle, no delayed ring skip, optional sparse finish, timeout continuation, circular angles, density and forgiving sparse timing: PASS");
