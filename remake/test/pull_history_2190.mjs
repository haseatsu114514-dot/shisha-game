// Real runPull/runCare and production thermal/leaf calculations; DOM, audio and clocks are controlled ports.
import assert from "node:assert/strict";
import * as craftVersion from "../js/core/craft-version.js";
import fs from "node:fs";
import vm from "node:vm";

globalThis.document = { addEventListener() {} };
globalThis.window = {};
const naru = await import("../js/core/naru-finish.js");
const attackBand = await import("../js/craft/attack-band.js");
const { craftContext } = await import("../js/craft/context.js");
const [{ DB }, conditions, life, coals, model, water, waterText, { judgeComment }, { improvementOf }, { gradeOf }] = await Promise.all([
  import("../js/core/data.js"), import("../js/craft/conditions.js"), import("../js/craft/flavor-life.js"),
  import("../js/craft/coals.js"), import("../js/craft/temperature-model.js"), import("../js/craft/water.js"),
  import("../js/craft/pull-water.js"), import("../js/craft/feedback.js"), import("../js/craft/advice.js"),
  import("../js/craft/common.js"),
]);
DB.flavorById = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/flavors.json", import.meta.url))).flavors.map(f => [f.id, f]));
DB.equipById = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/equipment.json", import.meta.url))).equipment.map(e => [e.id, e]));
const noop = () => {};
const flush = async () => { for (let i = 0; i < 24; i++) await Promise.resolve(); };

class Node {
  constructor(spec = "div", attrs = {}, children = []) {
    if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
    this.classes = new Set(spec.split(".").slice(1)); this.children = []; this.dataset = {}; this.listeners = {};
    this.style = { setProperty() {} }; this.isConnected = true; this.disabled = false; this.memo = {};
    this.classList = { add: (...names) => names.forEach(n => this.classes.add(n)), remove: (...names) => names.forEach(n => this.classes.delete(n)),
      toggle: (n, yes) => yes ? this.classes.add(n) : this.classes.delete(n) };
    Object.assign(this, attrs); this.append(...children);
  }
  append(...nodes) { this.children.push(...nodes.flat()); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  setAttribute(name, value) { this[name] = value; }
  addEventListener(type, handler) { (this.listeners[type] ??= []).push(handler); }
  remove() { this.isConnected = false; }
  emit(type) { for (const handler of this.listeners[type] || []) handler({ preventDefault() {}, detail: 0 }); }
  click() { if (!this.disabled) { this.emit("click"); this.onclick?.({ preventDefault() {}, detail: 0 }); } }
  walk(predicate) {
    for (const child of this.children) if (child instanceof Node) {
      if (predicate(child)) return child;
      const nested = child.walk(predicate); if (nested) return nested;
    }
    return null;
  }
  querySelector(selector) {
    const found = this.walk(n => n.classes.has(selector.slice(1)));
    if (found) return found;
    if (!this.memo[selector]) { this.memo[selector] = new Node(`i${selector}`); this.children.push(this.memo[selector]); }
    return this.memo[selector];
  }
  querySelectorAll(selector) {
    if ([".pg-just", ".pg-sense-extra"].includes(selector)) return this.memo[selector] ??= Array.from({ length: 3 }, () => new Node(`i${selector}`));
    if (selector === "button") {
      const all = []; const collect = node => { for (const child of node.children) if (child instanceof Node) { if (child.dataset.test?.startsWith("care-coal-")) all.push(child); collect(child); } };
      collect(this); return all;
    }
    throw Error(`Unsupported fixture selector: ${selector}`);
  }
}

async function harness({ learned = false, noWobble = false } = {}) {
  let now = 1000, frameId = 0, panel;
  const frames = new Map(), metrics = { results: 0, temperature: null, pullHeat: [] };
  const context = vm.createContext({
    document: { hidden: false, addEventListener() {}, removeEventListener() {} }, performance: { now: () => now },
    requestAnimationFrame(fn) { const id = ++frameId; frames.set(id, fn); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  });
  const imports = {
    "../core/naru-finish.js": naru,
    "../core/util.js": { el: (...args) => new Node(...args), sleep: async () => {}, clamp: (v, a, b) => Math.max(a, Math.min(b, v)), rand: (a, b) => (a + b) / 2 },
    "../core/ui.js": { countdown: async () => {}, shake: noop },
    "../core/audio.js": { SE: new Proxy({}, { get: () => noop }), startBubbling: () => noop },
    "./session.js": { stepPanel: () => (panel = new Node()), refreshBench: noop, tickerSay: noop, reactAudience: noop,
      setBenchTemperature: (_cs, temp) => { metrics.temperature = temp; }, setBenchDraw: noop, failBench: async () => {}, setBenchLeaf: noop, dockBenchLeaf: noop,
      strainBench: () => false, scoreStep: noop, waitBenchReady: async () => {}, craftTest: { auto: null, aim: null } },
    "./common.js": { gradeOf, autoSkill: () => null, skill: { slow: () => 1, window: () => 1, clarity: () => noWobble ? 1 / .7 : 1 },
      resultCard: async () => { metrics.results++; }, keys: () => noop },
    "./heat.js": { burnCoals: () => { throw Error("This fixture selects no replacement coals"); }, HEAT_GRADES: {} },
    // 一台に最初の炭焼きの記録が無いので、トングで持ってくる炭は標準の焼き炭になる（#2213）。
    "./heat_logic.js": { replacementCoals: () => ({ batch: null, picks: [] }) },
    "./conditions.js": conditions,
    "./fx.js": { impact: noop, exhale: async () => false, smokeRing: () => false },
    "./art.js": { mixColor: () => "#d9d2e6" },
    "./thermometer.js": { buildThermometer: () => ({ root: new Node(), update: noop, preview: noop, pop: noop }) },
    // 桜井式の攻めの帯（SKR04）。この一台は練習なので帯は出ないが、読み込みは本物を使う。
    "./attack-band.js": attackBand,
    // シーシャ作りの版（CRN16）は本物を使う。この一台は版を持たないのでリニューアル
    "../core/craft-version.js": { ...craftVersion },
    "./flavor-life.js": life, "./coals.js": coals, "./temperature-model.js": model,
    "./flavor-guide.js": { actualExpressionCard: () => "Recorded expression" },
    "./clock.js": { createCraftClock: () => ({ now: () => now, paused: false, dispose: noop }) },
    "./effect-visual.js": { effectVisible: () => false, effectBadge: noop, effectLine: noop, senseExtra: () => 0, effectTier: () => 0 },
    "./water.js": water, "./pull-water.js": waterText,
    // 制作の表示名と、心得の盤の効き目（盤を灯していない状態。#2166）
    "./context.js": { craftContext },
    "../core/state.js": { state: {} },
    "../core/growth-effects.js": { growthPerks: () => null, growthFeature: () => false, useGrowthInsurance: () => false,
      growthSkill: () => false, growthLesson: (_s, id) => learned && id === "M-W3", growthCritical: () => false,
      settleGrowthPhase: (s, cs, key, result) => result?.score, LESSON_TUNING: {}, SKILL_TUNING: {} },
  };
  const source = fs.readFileSync(new URL("../js/craft/pull.js", import.meta.url), "utf8");
  const mod = new vm.SourceTextModule(source, { context });
  await mod.link(spec => {
    if (spec === "./pull-draw.js") return new vm.SourceTextModule(fs.readFileSync(new URL("../js/craft/pull-draw.js", import.meta.url), "utf8"), { context });
    const exports = imports[spec]; assert(exports, `Unexpected import: ${spec}`);
    return new vm.SyntheticModule(Object.keys(exports), function () { for (const [name, value] of Object.entries(exports)) this.setExport(name, value); }, { context });
  });
  await mod.evaluate();
  const find = test => panel.walk(n => n.dataset.test === test);
  const until = async predicate => {
    for (let step = 0; step < 4000; step++) {
      await flush(); if (predicate()) return;
      now += 16; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now));
    }
    throw Error(`Native pull fixture did not reach the requested state: ${JSON.stringify({ now, frames: frames.size, button: find("pull-stop")?.disabled, pos: panel.querySelector(".pg-needle").dataset.pos, choosing: !!find("care-coal-0") })}`);
  };
  return {
    metrics,
    async run(cs, round, positions, coalCount = 2) {
      metrics.pullHeat = [];
      const running = round ? mod.namespace.runCare(cs, { round }) : mod.namespace.runPull(cs);
      // E06 案A: 調整の温度は炭で戻す。標準の置き方で2個替え、吸いは確かめの一口にする。
      if (round) { await until(() => find(`care-coal-${coalCount}`)); find(`care-coal-${coalCount}`).click(); }
      await until(() => find("pull-stop") && !find("pull-stop").disabled);
      for (const target of positions) {
        await until(() => !find("pull-stop").disabled && Math.abs(Number(panel.querySelector(".pg-needle").dataset.pos) / 100 - target) < .015);
        const before = metrics.temperature;
        find("pull-stop").emit("pointerdown");
        await until(() => !panel.querySelector(".pull-play").dataset.draw);
        metrics.pullHeat.push(metrics.temperature - before);
      }
      assert(!find("pull-serve").disabled); find("pull-serve").click(); await running;
      assert.equal(frames.size, 0, "Completed pull disposes its frame loop");
    },
  };
}

const fresh = steamSeconds => {
  const cs = { mode: "rehearsal", mix: { lemon: 12 }, pack: "normal", water: .5, steamSeconds,
    equip: { bowl: "silicone_bowl", hms: "lotos_hagal", charcoal: "flat_charcoal" },
    environment: { rainy: false }, holes: { total: 24, minimumComplete: true }, parts: { shisha: 70 } };
  life.ensureFlavorLife(cs);
  cs.steam = { score: 100, temp: model.temperatureBands(cs).ideal[0] + .0001 };
  return cs;
};

for (const [steamSeconds, extra] of [[480, false], [600, false], [480, true]]) {
  const h = await harness(), cs = fresh(steamSeconds), before = model.temperatureBands(cs);
  await h.run(cs, 0, [.5, .5]);
  await h.run(cs, 1, [.7]);
  await h.run(cs, 2, extra ? [.81, .5, .5] : [.7]);
  const restored = JSON.parse(JSON.stringify(cs)), rounds = [restored.pull, ...restored.careHistory];
  const after = model.temperatureBands(restored), snapshot = JSON.stringify(restored);
  assert.deepEqual(rounds.map(result => result.pulls), extra ? [2, 1, 3] : [2, 1, 1]);
  assert(rounds.every(result => result.inZone && !result.failed), "Every result is a recorded thermal success");
  assert.equal(h.metrics.results, 3);
  assert.match(judgeComment(restored), /提供も2回の調整も、いい温度だった/);
  if (extra) {
    assert.equal(restored.leaf.dmg, 1, "Only the real third care pull adds leaf damage");
    assert(restored.leaf.hp > 0);
    assert(model.isIdealTemperature(restored.pull.temp, before));
    assert(!model.isIdealTemperature(restored.pull.temp, after), "Later real leaf damage narrows the historical serving band");
    assert.match(improvementOf(restored), /調整2回目.*吸う回数を減らし/);
    assert.doesNotMatch(improvementOf(restored), /熱を戻して|少し下げて/, "Historical success must not become thermal blame");
    // Unknown old records retain the measured-temperature fallback and its priority.
    const legacy = JSON.parse(snapshot); delete legacy.pull.inZone;
    assert.match(improvementOf(legacy), /提供.*熱を戻して/);
    for (const [failed, expected] of [["cold", /冷え切る前に炭を交換/], ["burnt", /熱が上がり切る前/]]) {
      const ended = JSON.parse(snapshot); ended.careHistory[1].failed = failed;
      assert.match(improvementOf(ended), expected, "Known thermal failures precede excessive-pull advice");
    }
    const depleted = JSON.parse(snapshot); depleted.careHistory[1].failed = "leaf";
    assert.match(improvementOf(depleted), /調整2回目.*吸う回数を減らし/);
    depleted.careHistory[1].pulls = 1;
    assert.match(improvementOf(depleted), /調整2回目で葉が尽きた/);
  } else {
    assert.equal(restored.leaf.dmg, 0, "Safe rounds cannot create leaf wear, even after ten minutes of steaming");
    assert.deepEqual(after.ideal, before.ideal);
    assert.match(improvementOf(restored), /今回の記録を見て、次に試すことを選ぼう/);
  }
  assert.equal(JSON.stringify(restored), snapshot, "Reviewing the saved history does not change results");
  console.log(JSON.stringify({ steamSeconds, extra, counts: rounds.map(result => result.pulls), damage: restored.leaf.dmg,
    serving: restored.pull.temp, originalBand: before.ideal, finalBand: after.ideal, next: improvementOf(restored) }));
}
console.log("PASS: real pull/care safe-history negative controls and later-overpull temperature-history regression");

// Naru's lesson goes through the real initial pull and provide handler, never a helper-only award.
for (const id of ["orange", "mint"]) for (const learned of [false, true]) {
  const h = await harness({ learned }), cs = fresh(480); cs.mix = { [id]: 12 };
  const target = naru.naruFinishRange(model.temperatureBands(cs));
  cs.steam.temp = (target.low + target.high) / 2;
  await h.run(cs, 0, [.5, .5]);
  assert.equal(naru.naruFinishBonus(cs), learned ? .5 : 0, `${id}, learned=${learned}`);
  assert.equal(cs.naruFinish.learned, learned);
  if (learned) {
    assert.equal(cs.naruFinish.temp, cs.pull.temp);
    const record = JSON.stringify(cs.naruFinish);
    await h.run(cs, 1, [.5]);
    assert.equal(JSON.stringify(cs.naruFinish), record, "care must not re-evaluate first service");
    assert.equal(naru.naruFinishBonus(JSON.parse(JSON.stringify(cs))), .5);
  }
}
console.log("PASS Naru lesson: real provide for focused/expressive leaves, learned gating, care and serialized record");

// E06: 補正後の合計上げ幅を制限する。安全回数（Dobajの+1を含む）は変えない。
const { skippedFoilResult } = await import("../js/craft/holes_logic.js");
for (const flavor of ["lemon", "coconut"]) for (const foil of [false, true]) for (const rainy of [false, true]) {
  const h = await harness(), cs = fresh(480);
  cs.mix = { [flavor]: 12 };
  cs.environment.rainy = rainy;
  if (foil) {
    cs.equip.hms = "tanukish_lid";
    cs.holes = { total: 24, outer: 12, middle: 8, inner: 4, minimumComplete: true };
  } else cs.holes = skippedFoilResult();
  const previous = model.temperatureBands(cs).ideal[0] + .04;
  cs.pull = { temp: previous };
  const safe = flavor === "coconut" ? 3 : 2;
  await h.run(cs, 1, Array(safe).fill(.82), 0);
  assert.equal(cs.care.pulls, safe);
  assert.equal(cs.leaf.dmg, 0, "Existing safe pulls, including Dobaj's bonus, remain harmless");
  assert(cs.care.temp - cs.care.startTemp <= .05, "Safe upper-just pulls stay within the total care heat budget");
  assert(cs.care.temp < previous - .02, "No replacement coals: safe pulls cannot recover the previous temperature");
}
// Unsafe upper pulls cannot bypass the cap. Each care round receives a fresh budget.
for (const positions of [Array(5).fill(.82), [.82, .82, .17, .82, .82]]) {
  const h = await harness(), cs = fresh(480); cs.mix = { coconut: 12 };
  cs.holes = skippedFoilResult(); cs.pull = { temp: .60 };
  await h.run(cs, 1, positions, 0);
  assert.equal(cs.care.pulls, 5, "The existing five-pull limit is unchanged");
  assert.equal(cs.leaf.dmg, 2, "Only pulls beyond Dobaj's safe three damage the leaf");
  assert(cs.care.temp - cs.care.startTemp <= .05, "Over-pulling or lowering first cannot increase the positive heat budget");
  const previous = cs.care.temp;
  await h.run(cs, 2, [.82], 0);
  assert(cs.care.temp > cs.care.startTemp + .02, "A new care round resets the pull budget");
  assert(cs.care.temp < previous, "Even the next care cannot restore its elapsed-time drop with a pull");
}
console.log("PASS E06: no-coal cumulative safe/unsafe upper pulls, Dobaj bonus, rain, foil/skipped foil, round budget reset");

// 揺らぎのみ固定して実吸引の加算を直接計測。下げても正の予算は戻らず、補正後で上限が掛かる。
for (const charcoal of ["flat_charcoal", "cube_charcoal"]) {
  const h = await harness({ noWobble: true }), cs = fresh(480);
  cs.mix = { coconut: 12 }; cs.holes = skippedFoilResult();
  cs.equip.charcoal = charcoal; cs.pull = { temp: .60 };
  await h.run(cs, 1, [.82, .82, .17, .82, .82], 0);
  const positive = h.metrics.pullHeat.filter(heat => heat > 0).reduce((a, b) => a + b, 0);
  assert(positive > .049 && positive <= .0500000001, `Actual positive heat is capped after coal/foil response: ${positive}`);
  assert(h.metrics.pullHeat[2] < -.02, "Lowering still works after the upper budget is used");
  assert(Math.abs(h.metrics.pullHeat[3]) < 1e-10 && Math.abs(h.metrics.pullHeat[4]) < 1e-10,
    "Lowering must not replenish the budget; previewing the next pull must not consume it either");
}
console.log("PASS E06: measured positive heat cap after flat/cube response, no lower-pull refund");
