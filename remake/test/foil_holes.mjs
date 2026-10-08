// 本番の穴開けをVM/仮想時計で操作し、配置の選択・完成条件・熱への接続を検証。
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
  setAttribute(name, value) { this[name] = String(value); }
  click() { if (!this.disabled) for (const fn of this.listeners.click || []) fn({ preventDefault() {} }); }
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
  "session.js": { stepPanel: () => { panel ||= new Element("div.panel"); panel.replaceChildren(); return panel; }, refreshBench: () => {}, tickerSay: () => {}, reactAudience: () => {} },
  "common.js": { gradeOf: (score) => score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D", autoSkill: () => automated,
    skill: { slow: () => 1, window: () => 1 }, resultCard: async (_, data) => results.push(data), keys: (map) => { keymap = map; return () => { keymap = null; }; }, popStamp: (_, text, kind) => stamps.push({ text, kind }) },
};
const context = vm.createContext({ Math, Promise, console, performance: { now: () => now },
  requestAnimationFrame: (fn) => { const id = nextFrame++; frames.set(id, fn); return id; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout: (fn) => delayed.push(fn) });
const mods = new Map();
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  const mod = values[name] ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
    : new vm.SourceTextModule(await fs.readFile(new URL(name === "condition.js" ? "../core/condition.js" : name, craftRoot), "utf8"), { context, identifier: name });
  mods.set(name, mod); await mod.link((specifier) => load(specifier.split("/").at(-1))); return mod;
}
const holesModule = await load("holes.js"); await holesModule.evaluate();
const holes = holesModule.namespace, logic = (await load("holes_logic.js")).namespace;
const templates = (await load("holes_templates.js")).namespace;
const conditionsModule = await load("conditions.js"); await conditionsModule.evaluate();
const conditions = conditionsModule.namespace;
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

// 新しい種類は定義の追加と永続フラグで解放でき、0穴のリングは生成しない。
const future = { id: "future-sparse", counts: { outer: 12, middle: 0, inner: 0 }, unlockFlag: "met_teacher" };
assert.equal(templates.availableHoleTemplates({}, [...templates.HOLE_TEMPLATES, future]).length, 2);
assert.equal(templates.availableHoleTemplates({ met_teacher: true }, [...templates.HOLE_TEMPLATES, future]).length, 3);
assert.equal(templates.ringsForTemplate(future).length, 1);
const templateResults = templates.HOLE_TEMPLATES.map((template) => {
  const rs = templates.ringsForTemplate(template).map((ring) => ({ ...ring, taken: new Array(ring.targets).fill(true),
    holes: Array.from({ length: ring.targets }, (_, k) => ({ a: k * Math.PI * 2 / ring.targets, d: 0 })) }));
  const result = holes.evaluate(rs, tally, 1, 11);
  assert.equal(result.score, full.score); assert.equal(result.total, 24); assert.equal(result.inner, 0);
  assert(logic.templateComplete(rs)); return result;
});
const outerOnly = { holes: templateResults[0], steamSeconds: 480 }, mixed = { holes: templateResults[1], steamSeconds: 480 };
assert(logic.foilHeatProfile(outerOnly.holes).stability > logic.foilHeatProfile(mixed.holes).stability);
assert(Math.abs(conditions.heatDelta(outerOnly, .1)) < Math.abs(conditions.heatDelta(mixed, .1)));
assert(conditions.temperatureAfterSteam(outerOnly) < conditions.temperatureAfterSteam(mixed));
const few = { ...outerOnly, holes: sparse };
assert(conditions.temperatureAfterSteam(few) < conditions.temperatureAfterSteam(outerOnly));
assert(Math.abs(conditions.heatDelta(few, .1)) > Math.abs(conditions.heatDelta(outerOnly, .1)));
assert(conditions.heatDelta({ ...outerOnly, environment: { rainy: true } }, .1) < conditions.heatDelta(outerOnly, .1));
assert.equal(conditions.heatDelta({ ...outerOnly, environment: { rainy: true } }, -.1), conditions.heatDelta(outerOnly, -.1));

async function start(auto = null, templateId = "outer24") {
  now = 1000; automated = auto; panel = null; frames.clear(); stamps.length = 0; delayed.length = 0; results.length = 0;
  const cs = { mode: "drill", holes: null, holeTemplateId: templateId };
  const running = holes.runHoles(cs); await settle();
  if (!auto) {
    assert(find("hole-preview")); assert.equal(frames.size, 0); assert.equal(keymap, null);
    fire(`hole-template-${templateId}`); fire("hole-start"); await settle();
  }
  return { cs, running };
}
async function punchCircle(period, targets, elapsedStart = 0) {
  for (let k = 0; k < targets; k++) { await frame(1000 + (elapsedStart + k * period / targets) * 1000); fire("hole-punch", "pointerdown"); await settle(); }
}
// 外周24穴: 選択前は時計が動かず、未完成ではクリック・Enterの全経路を拒否。
let active = await start(); assert(find("hole-done").disabled); assert(find("hole-next").disabled);
fire("hole-done"); fire("hole-next"); keymap.Enter(); await settle(); assert.equal(active.cs.holes, null); assert.equal(results.length, 0);
await punchCircle(6.4, 24); assert(!find("hole-done").disabled); assert(find("hole-next").disabled); assert(find("hole-punch").disabled);
// 完成後の連打で余分な穴や自動送りを増やさない。
const stampCount = stamps.length; for (let i = 0; i < 5; i++) fire("hole-punch", "pointerdown"); assert.equal(stamps.length, stampCount); assert.equal(delayed.length, 0);
await frame(now + 400); assert.equal(active.cs.holes, null); keymap.Enter(); await active.running;
assert.equal(active.cs.holes.templateId, "outer24"); assert.equal(active.cs.holes.outer, 24);
assert.equal(active.cs.holes.middle, 0); assert.equal(active.cs.holes.inner, 0); assert.equal(active.cs.holes.total, 24); assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.densityProfile.sparse, 0);
assert(stamps.some((stamp) => stamp.text === "EXCELLENT"));
// 外周12＋中周12: 外周だけでは終了できず、リングを明示的に切り替えて完成する。
active = await start(null, "outer12-middle12"); await punchCircle(6.4, 12);
assert(find("hole-done").disabled); assert(!find("hole-next").disabled);
fire("hole-done"); keymap.Enter(); assert.equal(active.cs.holes, null);
fire("hole-next"); await punchCircle(5.2, 12, 10.4); fire("hole-done"); await active.running;
assert.equal(active.cs.holes.templateId, "outer12-middle12"); assert.equal(active.cs.holes.outer, 12);
assert.equal(active.cs.holes.middle, 12); assert.equal(active.cs.holes.inner, 0); assert.equal(active.cs.holes.grade, "S");
// 時間が0になってもテンプレート未完成では終えない。完成後は時間評価0で終了。
active = await start(); await frame(35000); assert.equal(active.cs.holes, null); assert(find("hole-plan").textContent.includes("時間0"));
fire("hole-done"); fire("hole-next"); keymap.Enter(); assert.equal(active.cs.holes, null);
await punchCircle(6.4, 24, 38.4); await frame(now + 1); await active.running;
assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.total, 24); assert.equal(active.cs.holes.timeRatio, 0);
assert.equal(active.cs.holes.score, sparse.score - 5);
// 両テンプレートの既存good/badフックを通し、少穴の品質計算も引き続き同じ尺度に保つ。
for (const template of templates.HOLE_TEMPLATES) {
  const scores = [];
  for (const level of ["good", "bad"]) {
    active = await start(level, template.id); await active.running; assert(active.cs.holes.minimumComplete);
    assert.equal(active.cs.holes.outer, template.counts.outer); assert.equal(active.cs.holes.middle, template.counts.middle);
    assert.equal(active.cs.holes.inner, 0); scores.push(active.cs.holes.score);
  }
  assert(scores[0] > scores[1]);
}
console.log("[remake foil] PASS: template selection, exact 24/0/0 and 12/12/0, guarded completion, timeout continuation, no ring skipping, unlock flags, density and shared thermal response");
