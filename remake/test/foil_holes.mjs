// 本番の穴開けをVM/仮想時計で操作し、配置の選択・完成条件・熱への接続を検証。
// node --experimental-vm-modules remake/test/foil_holes.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const craftRoot = new URL("../js/craft/", import.meta.url);
let now = 1000, nextFrame = 1, frames = new Map(), keymap = null, panel = null, automated = null;
const stamps = [], delayed = [], results = [], visualHoles = [];
const seCalls = [];
const winListeners = {};
const fakeWindow = { addEventListener: (type, fn) => (winListeners[type] ||= []).push(fn), removeEventListener: (type, fn) => { winListeners[type] = (winListeners[type] || []).filter((f) => f !== fn); } };
const winFire = (type, event) => (winListeners[type] || []).slice().forEach((fn) => fn({ preventDefault() {}, ...event }));
class Element {
  constructor(spec) { const [tag, ...classes] = spec.split("."); this.tag = tag; this.classes = new Set(classes); this.children = []; this.listeners = {}; this.style = { setProperty: (k, v) => { this.style[k] = v; } }; this.dataset = {}; this.disabled = false;
    this.classList = { add: (...v) => v.forEach((c) => this.classes.add(c)), remove: (...v) => v.forEach(c => this.classes.delete(c)), toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c) };
  }
  get childElementCount() { return this.children.length; }
  append(...children) { for (const child of children.flat().filter(Boolean)) this.children.push(child); }
  replaceChildren(...children) { this.children = []; this.append(...children); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(name, value) { this[name] = String(value); }
  click() { if (!this.disabled) for (const fn of this.listeners.click || []) fn({ preventDefault() {} }); }
  querySelector(tag) { for (const child of this.children) { if (child.tag === tag) return child; const found = child.querySelector?.(tag); if (found) return found; } return null; }
}
function el(spec, attrs = {}, children = []) { if (Array.isArray(attrs)) { children = attrs; attrs = {}; } const n = new Element(spec); Object.assign(n, attrs); n.append(children); return n; }
const find = (test, node = panel) => node?.dataset?.test === test ? node : node?.children?.map((child) => find(test, child)).find(Boolean);
function fire(test, type = "click") { const node = find(test); assert(node, test); for (const fn of node.listeners[type] || []) fn({ preventDefault() {} }); }
const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
async function frame(time) { now = time; const waiting = [...frames.values()]; frames.clear(); for (const callback of waiting) callback(now); await settle(); }
const growthSkills = new Set();
const values = {
  "growth-effects.js": { useGrowthInsurance: () => false, growthCritical: () => false, settleGrowthPhase: (_s,_cs,_key,result) => result?.score, growthPerks: () => null, growthSkill: (_s,id) => growthSkills.has(id), growthFeature: () => false, growthLesson: () => false, LESSON_TUNING: {}, growthCraftCondition: (_s,_m,c) => c, SKILL_TUNING: {holesSeconds:6} },
  "util.js": { el, sleep: async () => {}, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (lo) => lo },
  "ui.js": { countdown: async () => {} },
  "data.js": { DB: { flavorById: {} } },
  "state.js": { state: null },
  "effect-visual.js": { effectBadge: () => null, effectLine: () => null, effectVisible: () => false, senseBand: () => null, effectTier: () => 0 },
  "art.js": { artImg: () => el("div.art") },
  "steps.js": { stepVent: async () => { throw new Error("Foil drill must not enter the vent step"); } },
  "audio.js": { SE: Object.fromEntries(["foilPunch", "perfect", "good", "miss", "just", "whoosh"].map((name) => [name, () => seCalls.push(name)])) },
  "session.js": { benchRoot: () => null, waitBenchReady: async () => {}, stepPanel: () => { panel ||= new Element("div.panel"); panel.replaceChildren(); return panel; }, showStepDemo: async () => {}, refreshBench: () => {}, tickerSay: () => {}, reactAudience: () => {}, scoreStep: () => {},
    setBenchHoleAction: (cs, event) => visualHoles.push({ cs, ...event }) },
  "common.js": { gradeOf: (score) => score >= 90 ? "S" : score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D", autoSkill: () => automated,
    skill: { slow: () => 1, window: () => 1 }, resultCard: async (_, data) => results.push(data), keys: (map) => { keymap = map; return () => { keymap = null; }; }, popStamp: (_, text, kind) => stamps.push({ text, kind }) },
};
const context = vm.createContext({ Math, Promise, console, window: fakeWindow, performance: { now: () => now },
  requestAnimationFrame: (fn) => { const id = nextFrame++; frames.set(id, fn); return id; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout: (fn) => delayed.push(fn) });
const mods = new Map();
async function load(name) {
  if (mods.has(name)) return mods.get(name);
  const mod = values[name] ? new vm.SyntheticModule(Object.keys(values[name]), function () { for (const [key, value] of Object.entries(values[name])) this.setExport(key, value); }, { context, identifier: name })
    : new vm.SourceTextModule(await fs.readFile(new URL(["condition.js", "flavor-mastery.js", "smoke.js"].includes(name) ? `../core/${name}` : name, craftRoot), "utf8"), { context, identifier: name });
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
// 同じ24目印・同じ残り時間でも、浅い穴が混じるほど得点が落ちる。
const depthLayout = (shallow) => [{ ...logic.RINGS[0], targets: 24, taken: new Array(24).fill(true),
  holes: Array.from({ length: 24 }, (_, k) => ({ a: k * Math.PI * 2 / 24, d: 0,
    size: k < shallow ? logic.HOLE_SIZES.shallow : logic.HOLE_SIZES.small })) }];
assert.equal(holes.evaluate(depthLayout(0), tally, 1, 11).score, 100);
assert.equal(holes.evaluate(depthLayout(1), { ...tally, shallow: 1 }, 1, 11).score, 85);
assert.equal(holes.evaluate(depthLayout(2), { ...tally, shallow: 2 }, 1, 11).score, 74);
const wrapped = rings(); wrapped[0].holes.forEach((hole, i) => hole.a += Math.PI * 2 * (i % 3 - 1));
assert(Math.abs(holes.evaluate(wrapped, tally, 1, 11).evenness - 1) < 1e-12);
assert(Math.abs(logic.circularAngleDistance(-0.01, Math.PI * 6 + 0.01) - 0.02) < 1e-12);
assert.equal(logic.foilDensityProfile(rings([22, 8, 4])).density, 1);

// 新しい種類は定義の追加と永続フラグで解放でき、0穴のリングは生成しない。
const future = { id: "future-sparse", counts: { outer: 12, middle: 0, inner: 0 }, unlockFlag: "met_teacher" };
assert.equal(templates.availableHoleTemplates({}, [...templates.HOLE_TEMPLATES, future]).length, 1);
assert.equal(templates.availableHoleTemplates({ met_teacher: true }, [...templates.HOLE_TEMPLATES, future]).length, 2);
assert.equal(templates.availableHoleTemplates({ _hole_outer24_unlocked: true }).length, 2);
assert.equal(templates.DEFAULT_HOLE_TEMPLATE, "outer12-middle12");
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
  now = 1000; automated = auto; panel = null; keymap = null; frames.clear(); stamps.length = 0; delayed.length = 0; results.length = 0; visualHoles.length = 0;
  const cs = { mode: "drill", holes: null, holeTemplateId: templateId };
  const running = holes.runHoles(cs); await settle();
  if (!auto) {
    assert(find("hole-preview")); assert.equal(frames.size, 0); assert.equal(keymap, null);
    fire(`hole-template-${templateId}`); fire("hole-start"); await settle();
  }
  seCalls.length = 0;
  return { cs, running };
}
// #2937: 針は目印の手前の端から0.4秒で目印に重なる（弧1往復は0.8秒＋休み0.2秒）。押して hold ミリ秒で離す。
async function pierce(hold = 250, approach = 400) {
  await frame(now + approach); fire("hole-punch", "pointerdown"); now += hold; fire("hole-punch", "pointerup"); await settle();
}
// 針が動き出した直後（手前の端）にそのまま押す
function jab(hold = 250) { fire("hole-punch", "pointerdown"); now += hold; fire("hole-punch", "pointerup"); }
async function punchCircle(targets) { for (let k = 0; k < targets; k++) await pierce(); }
// CRN02: リングが埋まると、少し間を置いて次のリング（最後なら結果）へ自動で進む。その間を1つ進める。
async function advance() { const fn = delayed.shift(); assert(fn, "ring advance must be scheduled"); fn(); await settle(); }
// 押し直しも実穴として残る。ズレた穴を演出側が勝手に消さない。
let probe = await start(); jab(); jab();
assert.equal(visualHoles.length, 2); assert.equal(visualHoles.at(-1).dots.length, 2);
assert.deepEqual(visualHoles.at(-1).target, visualHoles.at(-1).dots.at(-1));
assert.equal(visualHoles.at(-1).cs, probe.cs); assert.equal(probe.cs.holes, null);
// 外周24穴: 選択前は時計が動かず、未完成ではクリック・Enterの全経路を拒否。
let active = await start(); assert.match(find("hole-depth-hint").text, /押す長さで深さが変わる/);
// CRN02: 「次のリングへ」「穴あけを終えて結果へ」のボタンと Enter の終了は無い
assert.equal(find("hole-done"), undefined); assert.equal(find("hole-next"), undefined); assert.equal(keymap.Enter, undefined);
await settle(); assert.equal(active.cs.holes, null); assert.equal(results.length, 0); assert.equal(delayed.length, 0);
await punchCircle(24); assert(find("hole-punch").disabled); assert.equal(delayed.length, 1, "the finished foil schedules one step to the result");
assert.equal(visualHoles.length, 24); assert.equal(visualHoles.at(-1).dots.length, 24);
assert.equal(seCalls.filter(id => id === "foilPunch").length, 24, "each real hole has one quiet material sound");
assert.equal(seCalls.filter(id => id === "perfect").length, 1, "a ring gets one closing sound");
assert(!seCalls.includes("good") && !seCalls.includes("miss"), "per-hole judgement sounds do not cover the material sound");
assert(Math.abs(visualHoles[0].target[0] - .8) < 1e-9); assert(Math.abs(visualHoles[0].target[1]) < 1e-9);
// 完成後の連打で余分な穴や自動送りを増やさない。
const stampCount = stamps.length; for (let i = 0; i < 5; i++) fire("hole-punch", "pointerdown"); assert.equal(stamps.length, stampCount); assert.equal(delayed.length, 1);
assert.equal(visualHoles.length, 24, "Disabled input added a visual hole");
const completedTime = panel.querySelector("b").style.width;
await frame(now + 60000);
assert.equal(panel.querySelector("b").style.width, completedTime, "completed foil timer kept running");
assert.equal(active.cs.holes, null); assert.equal(results.length, 0);
await advance(); await active.running;
assert.equal(active.cs.holes.templateId, "outer24"); assert.equal(active.cs.holes.outer, 24);
assert.equal(active.cs.holes.middle, 0); assert.equal(active.cs.holes.inner, 0); assert.equal(active.cs.holes.total, 24); assert(active.cs.holes.minimumComplete); assert.equal(active.cs.holes.densityProfile.sparse, 0);
assert(stamps.some((stamp) => stamp.text === "EXCELLENT"));
// 外周12＋中周12: 外周だけでは終わらず、リングが埋まると中周へ自動で進む（CRN02）。
active = await start(null, "outer12-middle12"); await punchCircle(12);
assert(find("hole-punch").disabled, "a finished ring takes no more punches");
await advance(); assert.equal(active.cs.holes, null); assert(!find("hole-punch").disabled);
await punchCircle(12);
const mixedTime = panel.querySelector("b").style.width;
await frame(now + 60000); assert.equal(panel.querySelector("b").style.width, mixedTime);
assert.equal(active.cs.holes, null); await advance(); await active.running;
assert.equal(active.cs.holes.templateId, "outer12-middle12"); assert.equal(active.cs.holes.outer, 12);
assert.equal(active.cs.holes.middle, 12); assert.equal(active.cs.holes.inner, 0); assert.equal(active.cs.holes.grade, "S");
// #3023: 弧の手前の端で刺してもミス（無効）にはならない。その目印の穴として成立し、
// ズレのぶんだけ精度がなだらかに落ちる。余分な穴は増えず、入力・描画・結果で同じ穴を保持する。
active = await start(null, "outer12-middle12");
for (let n = 0; n < 12; n++) jab();
assert(stamps.some((stamp) => stamp.text === "ズレたけど開いた"));
assert.equal(delayed.length, 1, "ズレた穴だけでもリングは完成する");
await advance();
for (let n = 0; n < 12; n++) jab();
assert.equal(visualHoles.length, 24);
assert.equal(visualHoles.at(-1).dots.length, 24);
await advance(); await active.running;
const roughResult = active.cs.holes;
assert.equal(roughResult.tally.perfect + roughResult.tally.good, 0);
assert.equal(roughResult.tally.rough, 24);
assert.equal(roughResult.tally.miss, 0); assert.equal(roughResult.tally.tooClose, 0);
assert.equal(roughResult.outer, 12); assert.equal(roughResult.middle, 12); assert.equal(roughResult.inner, 0);
assert.equal(roughResult.total, 24); assert.equal(roughResult.dots.length, 24);
assert.equal(roughResult.densityProfile.count, 24);
assert(roughResult.precision > 0 && roughResult.precision < .5, "ズレた穴は0点ではなく低精度として残る");
assert(roughResult.score < full.score && roughResult.score >= 60, "ズレた穴だけでも大きく減点されたうえで成立する");
const detail = results.at(-1).lines.join("\n");
assert.match(detail, /目印の達成：24\/24か所/);
assert.match(detail, /穴あけ入力：24回 ／ ズレて開いた穴：24回/);
assert.match(detail, /実際に開いた穴：外周 12・中周 12・内周 0（計 24 穴）/);
assert.match(detail, /ズレた穴も開いた穴として残り/);
// #3023: 既に開いた穴の真上で刺した場合は「近すぎたけど開いた」として、その目印の穴になる。
active = await start(null, "outer24");
await pierce(250, 800); // 弧の奥の端で刺す（ズレた穴）
jab(); // 次の目印の手前の端＝直前の穴と同じ位置
assert.equal(stamps.at(-1).text, "近すぎたけど開いた");
await punchCircle(22);
await advance(); await active.running;
const closeResult = active.cs.holes;
assert.equal(closeResult.tally.rough, 1); assert.equal(closeResult.tally.tooClose, 1);
assert.equal(closeResult.tally.miss, 0); assert.equal(closeResult.total, 24);
// 時間0の12+12: 案内は、その時点で有効な次操作に一致する。
active = await start(null, "outer12-middle12"); await frame(35000);
assert(find("hole-plan").textContent.includes("穴あけは続けられます"));
assert(!find("hole-punch").disabled);
await punchCircle(12);
assert(find("hole-plan").textContent.includes("次のリングへ"));
assert(!find("hole-plan").textContent.includes("続けられます"));
assert(find("hole-punch").disabled);
await advance();
assert(find("hole-plan").textContent.includes("穴あけは続けられます"));
assert(!find("hole-punch").disabled);
await punchCircle(12);
assert(find("hole-plan").textContent.includes("結果へ"));
assert(!find("hole-plan").textContent.includes("続けられます"));
assert(find("hole-punch").disabled);
assert.equal(active.cs.holes, null); await advance(); await active.running;
assert.equal(active.cs.holes.timeRatio, 0); assert.equal(results.at(-1).button, "確認して次の工程へ");
// 時間が0になってもテンプレート未完成では終えない。完成後は時間評価0で終了。
active = await start(); await frame(35000); assert.equal(active.cs.holes, null); assert(find("hole-plan").textContent.includes("時間評価は終了。穴あけは続けられます"));
assert.equal(delayed.length, 0, "timeout must not schedule the result before the foil is complete");
await punchCircle(24); await frame(now + 1);
assert.equal(active.cs.holes, null, "timeout must not bypass the completion");
assert(!find("hole-plan").textContent.includes("続けられます"), "Completed foil must guide to the result instead of further punching");
await advance(); await active.running;
assert.equal(results.at(-1).button, "確認して次の工程へ");
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
growthSkills.add("K01");
active=await start();await frame(35000);
assert(!find("hole-plan").textContent.includes("時間評価は終了"),"段取り八分は32秒を過ぎても時間評価を残す");
await frame(40000);assert(find("hole-plan").textContent.includes("時間評価は終了"));
await punchCircle(24);await advance();await active.running;
growthSkills.clear();
// #2937 案1: 針は狙う目印の近くの短い弧だけ。弧の半幅は目印の間隔の半分（上限15°）。
const DEG = Math.PI / 180;
assert(Math.abs(logic.needleHalfArc(24) - 7.5 * DEG) < 1e-12); assert(Math.abs(logic.needleHalfArc(12) - 15 * DEG) < 1e-12);
assert(Math.abs(logic.needleOffset(0, 1).offset + 1) < 1e-12); assert(Math.abs(logic.needleOffset(.4, 1).offset) < 1e-12);
assert(logic.needleOffset(.9, 1).resting); assert(Math.abs(logic.needleOffset(1, 1).offset + 1) < 1e-12, "the needle returns to the near end");
assert(Math.abs(logic.referenceDegrees(7.5 * DEG, logic.needleHalfArc(24)) - 15) < 1e-9);
// #2937 案5: 押し加減の判定幅と穴径、実穴径による穴サイズ安定。
assert.deepEqual(["shallow", "small", "small", "wide", "large"].map(String), [.05, .12, .49, .5, .85].map((t) => logic.pressDepth(t)));
assert.equal(logic.pressDepth(.6, 1.3), "small"); assert.equal(logic.pressDepth(.1, 1.3), "shallow");
const sized = (sizes) => [{ holes: sizes.map((size) => ({ a: 0, d: 0, size })) }];
assert.equal(logic.holeSizeStability(sized([1, 1, 1])), 1); assert.equal(logic.holeSizeStability(sized([1.7, 1.7])), .5);
assert(logic.holeSizeStability(sized([1, 1.35, 1, 1.35])) < logic.holeSizeStability(sized([1, 1, 1, 1.35])));
assert.equal(logic.holeSizeStability([{ holes: [{ a: 0, d: 0 }] }]), 1, "legacy holes without a size count as standard");
assert.equal(logic.holeSizeStability([{ holes: [] }]), 0);
const tallyMiss = { ...tally, miss: 9, tooClose: 9 };
assert.equal(holes.evaluate(rings([12, 0, 0]), tallyMiss, 1, 11).sizeStab, 1, "MISS counts no longer lower the size score by themselves");

// 浅い打ち込みも1穴として成立し、次の目印へ進む。精度とサイズに加え深さで大きく減点する。
const keyupBefore = winListeners.keyup?.length || 0;
active = await start(null, "outer24");
await frame(now + 400); fire("hole-punch", "pointerdown"); now += 50; fire("hole-punch", "pointerup"); await settle();
assert.equal(visualHoles.length, 1, "a shallow press should open one hole"); assert.equal(stamps.at(-1).text, "浅い穴。大きく減点");
assert.equal(visualHoles[0].sizes[0], logic.HOLE_SIZES.shallow);
assert.equal(seCalls.filter((id) => id === "foilPunch").length, 1);
await pierce();
assert.equal(visualHoles.length, 2); assert.notDeepEqual(visualHoles[1].target, visualHoles[0].target, "the needle should move to the next marker");
assert.equal(stamps.at(-1).text, "EXCELLENT");
// 押しすぎは少し大きい穴、さらに押すと離さなくても大きい穴で刺し抜ける。
await pierce(600); assert.equal(stamps.at(-1).text, "EXCELLENT・少し大きい"); assert.equal(visualHoles.at(-1).sizes.at(-1), 1.35);
await frame(now + 400); fire("hole-punch", "pointerdown"); await frame(now + 900);
assert.equal(visualHoles.length, 4, "holding too long pierces by itself"); assert.equal(visualHoles.at(-1).sizes.at(-1), 1.7);
fire("hole-punch", "pointerup"); await settle(); assert.equal(visualHoles.length, 4, "release after an auto pierce added a hole");
// ズレても、その目印の穴として成立して次へ進む（一周待ちなし）。
now += 100; jab(); assert.equal(stamps.at(-1).text, "ズレたけど開いた"); await pierce(); assert.equal(stamps.at(-1).text, "EXCELLENT");
assert.equal(visualHoles.length, 6);
// Space は押し始め（キーリピートは無視）、離して刺す。
await frame(now + 400); keymap[" "]({}); keymap[" "]({ repeat: true }); now += 250; winFire("keyup", { key: " " }); await settle();
assert.equal(visualHoles.length, 7); assert.equal(stamps.at(-1).text, "EXCELLENT");
for (let k = 0; k < 17; k++) await pierce();
await advance(); await active.running;
const sizedResult = active.cs.holes;
assert.equal(sizedResult.total, 24); assert.equal(sizedResult.tally.shallow, 1);
assert.deepEqual({ ...sizedResult.holeSizes }, { small: 21, wide: 1, large: 1, shallow: 1 });
assert(sizedResult.sizeStab < .5 && sizedResult.sizeStab > 0);
assert.match(results.at(-1).lines.join("\n"), /穴の大きさ：浅い 1・小 21・少し大きい 1・大きい 1/);
assert.match(results.at(-1).lines.join("\n"), /目印の達成：24\/24か所/);
assert(sizedResult.score < full.score - 8, "a shallow hole should substantially lower the score");
assert.equal(winListeners.keyup.length, keyupBefore, "finished foil left a keyup listener");

console.log("[remake foil] PASS: template selection, exact 24/0/0 and 12/12/0, guarded completion, timeout continuation, no ring skipping, unlock flags, density and shared thermal response, near-marker needle and press depth (#2937), offset holes stand as low-score holes (#3023)");
