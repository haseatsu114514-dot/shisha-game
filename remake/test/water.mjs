// node --experimental-vm-modules remake/test/water.mjs
// DOM adapter checks input lifetime; actual-browser layout remains a separate check.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getEventListeners } from "node:events";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let checks = 0;
const check = (name, fn) => Promise.resolve().then(fn).then(() => { checks++; console.log(`PASS ${name}`); });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-10, `${a} != ${b}`);

class Element extends EventTarget {
  constructor(tag = "div") {
    super(); this.tagName = tag; this.children = []; this.parentNode = null; this.attributes = new Map(); this.dataset = {};
    this.classes = new Set(); this.classList = { add: (...v) => v.forEach(s => this.classes.add(s)), contains: v => this.classes.has(v) };
    this.style = { setProperty(k, v) { this[k] = v; } };
  }
  append(...nodes) { for (const node of nodes) { node.parentNode = this; this.children.push(node); } }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k); }
  get isConnected() { return this === document.body || this === document.head || !!this.parentNode?.isConnected; }
  contains(node) { return node === this || this.children.some(c => c.contains(node)); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; }
  closest(selector) {
    if ((selector.includes(".done") && this.classes.has("done")) || (selector.includes("inert") && this.attributes.has("inert"))) return this;
    return this.parentNode?.closest(selector) || null;
  }
  getBoundingClientRect() { return { left: 0, right: 100, top: 0, bottom: 50 }; }
  setPointerCapture() {}
  querySelector(selector) {
    return this.children.flatMap(c => [c, ...c.descendants()]).find(c => selector.includes(c.dataset.test) && c.dataset.test) || null;
  }
  descendants() { return this.children.flatMap(c => [c, ...c.descendants()]); }
}
const document = Object.assign(new EventTarget(), {
  body: new Element(), head: new Element("head"), hidden: false, blocked: false,
  createElement: tag => new Element(tag), createTextNode: value => Object.assign(new Element("#text"), { textContent: value }),
  querySelector(selector) { return selector.includes("#modal") && this.blocked ? new Element() : null; },
});
const window = new EventTarget();
let now = 100, frameId = 0;
const frames = new Map(), observers = new Set();
class Observer {
  constructor(fn) { this.fn = fn; }
  observe() { observers.add(this); }
  disconnect() { observers.delete(this); }
}
const storage = new Map();
const context = vm.createContext({ console, document, window, Node: Element, Event, EventTarget, DOMException, URL, queueMicrotask,
  performance: { now: () => now }, MutationObserver: Observer,
  requestAnimationFrame(fn) { frames.set(++frameId, fn); return frameId; }, cancelAnimationFrame(id) { frames.delete(id); },
  localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) }, setTimeout, clearTimeout,
});
const modules = new Map();
const order = [];
const session = new vm.SyntheticModule(["stepPanel", "benchRoot", "craftTest", "newSession", "openBench", "waitBenchReady", "setBenchWater", "explainTutorialStep", "refreshBench"], function() {
  this.setExport("stepPanel", () => { order.push("water"); const panel = new Element(); document.body.append(panel); return panel; });
  this.setExport("benchRoot", () => document.body);
  this.setExport("craftTest", { auto: null });
  this.setExport("newSession", mode => ({ mode, mix: {}, careHistory: [] }));
  this.setExport("openBench", () => {});
  this.setExport("waitBenchReady", async () => {});
  this.setExport("setBenchWater", () => {});
  this.setExport("refreshBench", () => {});
  this.setExport("explainTutorialStep", async () => true);
}, { context });
const stubs = new Map();
function stub(relative, exports) {
  stubs.set(path.join(root, relative), new vm.SyntheticModule(Object.keys(exports), function() {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context }));
}
async function moduleAt(filename) {
  if (filename.endsWith("/craft/session.js")) return session;
  if (stubs.has(filename)) return stubs.get(filename);
  if (modules.has(filename)) return modules.get(filename);
  const mod = new vm.SourceTextModule(await fs.readFile(filename, "utf8"), { context, identifier: filename,
    initializeImportMeta(meta) { meta.url = new URL(`file://${filename}`).href; } });
  modules.set(filename, mod);
  await mod.link((specifier, ref) => moduleAt(path.resolve(path.dirname(ref.identifier), specifier)));
  return mod;
}
const load = async relative => { const mod = await moduleAt(path.join(root, relative)); await mod.evaluate(); return mod.namespace; };
const notices = [];
let emptyChoice = false;
const confirmations = [];
const waterSounds = [];
stub("js/core/audio.js", { SE: { pour: () => waterSounds.push(now) } });
stub("js/core/ui.js", { modal: async options => { confirmations.push(options); return emptyChoice; }, toast: text => notices.push(text), retireScreen: () => {} });
const model = await load("js/craft/water.js"), view = await load("js/craft/water-view.js");
const state = await load("js/core/state.js"), tournament = await load("js/chapters/ch2-tournament-state.js");
const history = await load("js/craft/practice-history.js");
function fire(target, type, props = {}) { const e = new Event(type, { cancelable: true }); for (const [k, v] of Object.entries(props)) Object.defineProperty(e, k, { value: v }); target.dispatchEvent(e); }
function tick(ms) { now += ms; const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn(now)); }
function mounted(options = {}) {
  const panel = new Element(); document.body.append(panel);
  const m = view.mountWater(panel, options);
  return { ...m, get seconds() { return m.seconds; }, panel, button: name => m.root.querySelector(`[data-test="water-${name}"]`) };
}
const down = (m, which = "pour") => fire(m.button(which), "pointerdown", { button: 0, isPrimary: true, pointerId: 1 });
const quantity = m => Number.parseFloat(m.root.querySelector('[data-test="water-meter"]').getAttribute("aria-valuenow")) / 100;
async function finish(m) { m.confirm(); const q = await m.result; m.panel.remove(); return q; }

await check("water precision is worth more than speed, and confirmation records the playable time", async () => {
  for (const [quantity, seconds, score] of [[.50, 6, 100], [.48, 7, 99], [.52, 21, 85], [.44, 6, 85], [.56, 10, 81], [0, 0, 0]]) {
    assert.equal(model.evaluateWater(quantity, seconds).score, score);
  }
  const m = mounted({ quantity: .5 });
  tick(5000);
  document.hidden = true;
  fire(document, "visibilitychange");
  tick(12000);
  document.hidden = false;
  fire(document, "visibilitychange");
  tick(2000);
  assert.equal(await finish(m), .5);
  assert.equal(m.seconds, 7);
});

await check("four water bands render and confirm their messages", async () => {
  for (const [q, band, label, message] of [
    [0, "none", "ステムに届いていない", "ステムが水に届いていない。煙が冷えないぞ"],
    [model.STEM_TIP, "shallow", "浸かりが浅い", "浅め。煙が冷えきらず、喉に当たるかも"],
    [model.WATER.low, "ideal", "ちょうどよく浸かっている", "ステムがほどよく浸かった。すっきりした吸い心地になりそう"],
    [model.WATER.high + .01, "deep", "深い", "深め。吸い心地が重くなりそう"],
  ]) {
    const m = mounted({ quantity: q });
    const status = m.button("status"), tip = m.button("tip");
    assert.equal(status.textContent, label); assert.equal(status.dataset.band, band);
    assert.equal(tip.textContent, "ステムの先"); assert.equal(tip.style.bottom, `${model.STEM_TIP * 100}%`);
    assert.equal(m.button("meter").getAttribute("aria-valuetext"), label);
    assert.ok(!m.root.descendants().some(node => node.textContent?.includes("%")));
    m.cancel(); await assert.rejects(m.result, { name: "AbortError" }); m.panel.remove();
    // 「自動で失敗」は今の水量のまま確定する。各区分の確定文をここで確かめる（成功側は次の検査）。
    session.namespace.craftTest.auto = "bad";
    const cs = { water: q }; await view.stepWater(cs);
    assert.equal(cs.water, q); assert.ok(notices.at(-1).endsWith(message));
    session.namespace.craftTest.auto = null;
  }
});
await check("auto good confirms neutral water; auto bad and manual keep the current amount (#3938)", async () => {
  const ideal = "ステムがほどよく浸かった。すっきりした吸い心地になりそう";
  const none = "ステムが水に届いていない。煙が冷えないぞ";
  // 開始時（未設定＝空）でも、途中再開の実量でも、「自動で成功」は目安の真ん中で確定する。
  for (const start of [undefined, 0, model.STEM_TIP, model.WATER.high + .01, 1]) {
    session.namespace.craftTest.auto = "good";
    const cs = start === undefined ? {} : { water: start }; await view.stepWater(cs);
    assert.equal(cs.water, model.WATER.neutral, `auto good from ${start}`);
    const comfort = model.waterComfort(cs.water); // 別realmの戻り値なので項目ごとに比べる。
    assert.equal(comfort.band, "ideal"); assert.equal(comfort.drawW, 0); assert.equal(comfort.bubble, 1);
    assert.ok(notices.at(-1).endsWith(ideal));
  }
  // 「自動で失敗」は成功側と混同しない。開始時の空のまま確定する。
  session.namespace.craftTest.auto = "bad";
  const bad = {}; await view.stepWater(bad);
  assert.equal(bad.water, 0); assert.equal(model.waterComfort(bad.water).band, "none"); assert.ok(notices.at(-1).endsWith(none));
  // 手動（自動なし）は確定ボタンを押すまで待ち、空から始まる量を変えない。
  session.namespace.craftTest.auto = null;
  const manual = {}; const pending = view.stepWater(manual);
  const confirm = document.body.descendants().filter(node => node.dataset.test === "water-confirm").at(-1);
  await Promise.resolve(); assert.equal(manual.water, undefined, "manual water waits for the confirm button");
  fire(confirm, "click"); await Promise.resolve();
  assert.equal(manual.water, undefined, "returning from confirmation leaves the water uncommitted");
  assert.equal(confirmations.at(-1).title, "水が入っていません");
  assert.equal(confirmations.at(-1).options.find(option => option.primary).value, false);
  emptyChoice = true;
  fire(confirm, "click"); await pending;
  assert.equal(manual.water, 0); assert.ok(notices.at(-1).endsWith(none));
});
await check("a blocked view keeps one animation frame while the wave settles (no doubling freeze)", async () => {
  // 注いだ直後（水面がまだ揺れている）に説明や MENU を開く。予約したコマが毎回2つに増えると、数秒で画面が固まる。
  const m = mounted({ quantity: .3 });
  down(m); tick(200); fire(m.button("pour"), "pointerup", { pointerId: 1 });
  assert.equal(frames.size, 1, "the settling wave keeps animating after release");
  document.blocked = true;
  let most = 0;
  for (let i = 0; i < 40 && frames.size; i++) { tick(16); most = Math.max(most, frames.size); }
  assert.ok(most <= 1, `at most one pending frame while blocked, saw ${most}`);
  document.blocked = false;
  for (let i = 0; i < 400 && frames.size; i++) tick(16);
  assert.equal(frames.size, 0, "the wave settles and the loop stops");
  m.cancel(); await assert.rejects(m.result, { name: "AbortError" }); m.panel.remove();
  waterSounds.length = 0; // 後ろの検査は音の記録が空から始まる前提
});
await check("water sound follows hold and stops on release, cancel and bounds", async () => {
  const m = mounted({ quantity: .5 });
  down(m); assert.equal(waterSounds.length, 1);
  tick(300); assert.equal(waterSounds.length, 2);
  fire(window, "pointerup", { pointerId: 1 });
  tick(1000); assert.equal(waterSounds.length, 2);
  down(m, "drain"); assert.equal(waterSounds.length, 3);
  m.cancel(); await assert.rejects(m.result, { name: "AbortError" });
  tick(1000); assert.equal(waterSounds.length, 3);
  for (const [quantity, flow] of [[1, "pour"], [0, "drain"]]) {
    const boundary = mounted({ quantity });
    down(boundary, flow); tick(1000);
    assert.equal(waterSounds.length, 3);
    boundary.cancel(); await assert.rejects(boundary.result, { name: "AbortError" });
  }
});
await check("rates use elapsed seconds, including partitioned frames and long hold", () => {
  near(model.changeWater(.5, "pour", 1), .68); near(model.changeWater(.5, "drain", 1), .47);
  let q = .5; for (let i = 0; i < 100; i++) q = model.changeWater(q, "pour", .01); near(q, .68);
  assert.equal(model.changeWater(.99, "pour", 30), 1); assert.equal(model.changeWater(.01, "drain", 30), 0);
});
await check("clamp, finite defaults and inclusive ideal boundaries", () => {
  for (const bad of [undefined, null, NaN, Infinity, -Infinity, "0.8", {}, []]) assert.equal(model.waterQuantity(bad), .5);
  assert.equal(model.waterQuantity(-1), 0); assert.equal(model.waterQuantity(2), 1);
  assert.equal(model.waterBand(.44), "ideal"); assert.equal(model.waterBand(.56), "ideal");
  assert.equal(model.waterBand(.4399), "low"); assert.equal(model.waterBand(.5601), "high");
  for (const dt of [-1, NaN, Infinity, 0]) assert.equal(model.changeWater(.5, "pour", dt), .5);
});
await check("first entry starts empty; an in-progress real amount is not reset", async () => {
  const fresh = mounted(); near(quantity(fresh), 0); // 開始時（cs.water未設定）はガラスが空。
  fresh.cancel(); await assert.rejects(fresh.result, { name: "AbortError" });
  const resumed = mounted({ quantity: .62 }); near(quantity(resumed), .62); // 途中再開（cs.waterが実量）はその値のまま。
  resumed.cancel(); await assert.rejects(resumed.result, { name: "AbortError" });
});
await check("pour/drain operate continuously; wave never alters saved q", async () => {
  const m = mounted({ quantity: .5 }); down(m); tick(1000); near(quantity(m), .68);
  fire(window, "pointerup", { pointerId: 1 }); tick(1000); near(quantity(m), .68);
  down(m, "drain"); tick(2000); near(quantity(m), .62);
  fire(window, "pointerup", { pointerId: 1 }); tick(1000); near(await finish(m), .62);
});
for (const type of ["pointerup", "pointercancel", "lostpointercapture", "pointerleave", "pointerout"]) await check(`${type} stops until a new press`, async () => {
  const m = mounted({ quantity: .5 }); down(m); tick(500); fire(m.button("pour"), type, { pointerId: 1 }); tick(2000); near(quantity(m), .59);
  tick(500); near(quantity(m), .59); down(m); tick(500); near(await finish(m), .68);
});
await check("captured pointer moving outside stops and moving back does not resume", async () => {
  const m = mounted({ quantity: .5 }); down(m); tick(500); fire(m.button("pour"), "pointermove", { pointerId: 1, clientX: 101, clientY: 20 });
  tick(1000); fire(m.button("pour"), "pointermove", { pointerId: 1, clientX: 20, clientY: 20 }); tick(1000); near(await finish(m), .59);
});
for (const boundary of ["blur", "hidden", "menu", "load", "help"]) await check(`${boundary} stops and reopening does not resume`, async () => {
  const m = mounted({ quantity: .5 }); down(m); tick(500);
  if (boundary === "blur") fire(window, "blur");
  if (boundary === "hidden") { document.hidden = true; fire(document, "visibilitychange"); }
  if (["menu", "load"].includes(boundary)) fire(document, "click");
  if (boundary === "help") { document.blocked = true; for (const o of [...observers]) o.fn(); }
  tick(500); document.hidden = false; document.blocked = false; tick(1000); near(await finish(m), .59);
});
await check("keyboard held input, release and repeat suppression after blur", async () => {
  const m = mounted({ quantity: .5 }); const b = m.button("drain"); fire(b, "keydown", { key: "Enter", repeat: false }); tick(1000);
  fire(window, "blur"); fire(b, "keydown", { key: "Enter", repeat: true }); tick(1000); near(quantity(m), .47);
  fire(b, "keyup", { key: "Enter" }); fire(b, "keydown", { key: "Enter", repeat: false }); tick(1000);
  fire(window, "keyup", { key: "Enter" }); tick(1000); near(await finish(m), .44);
});
await check("cancel, screen leave, state replacement and reentry never commit or resume", async () => {
  for (const reason of ["cancel", "leave", "state"]) {
    let current = true; const m = mounted({ quantity: .45, isCurrent: () => current }); down(m); tick(1000);
    const rejected = assert.rejects(m.result, { name: "AbortError" });
    if (reason === "cancel") m.cancel();
    if (reason === "leave") m.panel.remove();
    if (reason === "state") current = false;
    tick(100); await rejected;
    const next = mounted({ quantity: .45 }); tick(1000); near(await finish(next), .45);
  }
  assert.equal(frames.size, 0); assert.equal(observers.size, 0);
});
await check("confirmation commits once and includes elapsed time between frames", async () => {
  const m = mounted({ quantity: .5 }); down(m); now += 1000;
  m.confirm(); m.confirm(); near(await m.result, .68); tick(2000); near(quantity(m), .68);
});
await check("view clamps repeated hold at empty/full, with exact scalar confirmation", async () => {
  const full = mounted({ quantity: .99 }); down(full); tick(10000); near(await finish(full), 1);
  const empty = mounted({ quantity: .01 }); down(empty, "drain"); tick(10000); near(await finish(empty), 0);
});
await check("pagehide and abort discard draft quantity", async () => {
  for (const type of ["pagehide", "abort"]) {
    const signal = new EventTarget(); const m = mounted({ signal }); down(m); tick(500);
    const rejected = assert.rejects(m.result, { name: "AbortError" });
    fire(type === "pagehide" ? window : signal, type); await rejected;
  }
});
await check("new SAVE/LOAD retains confirmed q; in-flight SETUP restarts from checkpoint", async () => {
  const s = state.newGame(); s.chapter = 2;
  const original = JSON.stringify({ equip: s.equip, stats: s.stats, stock: s.flavorStock });
  const cs = { equip: { ...s.equip }, mix: {}, careHistory: [] };
  tournament.startAttempt(s, cs); tournament.beginStep(s); state.saveToSlot("suien_remake_slot1");
  const m = mounted(); near(quantity(m), 0); down(m); tick(1000); cs.water = await finish(m); // 開始時は空から注ぐ
  state.loadFromSlot("suien_remake_slot1"); tournament.recoverStep(state.state);
  assert.equal(tournament.tournamentProgress(state.state).step, 0); assert.equal(tournament.tournamentProgress(state.state).craft.water, undefined);
  tournament.finishStep(state.state, cs); state.saveToSlot("suien_remake_slot2");
  state.loadFromSlot("suien_remake_slot2"); const p = tournament.tournamentProgress(state.state);
  assert.equal(p.step, 1); near(p.craft.water, .18); assert.equal(p.rollback, null);
  assert.equal(JSON.stringify({ equip: state.state.equip, stats: state.state.stats, stock: state.state.flavorStock }), original);
  assert.ok(!JSON.stringify(p.craft).match(/wave|velocity|pointer|direction/));
  tournament.beginStep(state.state); state.saveToSlot("suien_remake_slot3"); state.loadFromSlot("suien_remake_slot3"); tournament.recoverStep(state.state);
  near(tournament.tournamentProgress(state.state).craft.water, .18); // 途中再開でも確定済みの実量は保たれる
});
await check("full practice record saves only confirmed water, care-only records stay scoped", () => {
  state.newGame();
  const cs = { water: .55, pullDone: true, pull: { score: 80 }, mix: { mint: 12 }, careHistory: [] };
  assert.equal(history.recordPractice(cs), true); state.saveToSlot("suien_remake_slot1"); state.loadFromSlot("suien_remake_slot1");
  near(history.practiceRecords().at(-1).water, .55);
  history.recordPractice({ ...cs, practiceScope: "care", careHistory: [{ score: 80 }] });
  assert.equal(history.practiceRecords().at(-1).water, undefined);
  assert.equal(history.recordPractice({ ...cs, pullDone: false }), false);
});
await check("real practice orchestration puts confirmed water between SETUP and MIX", async () => {
  stub("js/craft/steps.js", {
    stepSetup: async () => order.push("setup"),
    stepMix: async cs => { assert.equal(cs.water, model.WATER.neutral); order.push("mix"); },
    stepPack: async () => {}, stepPlace: async () => {}, stepSteamTime: async () => {}, evaluateMix: () => ({}),
  });
  stub("js/craft/holes.js", { runHoles: async () => {} });
  stub("js/craft/heat.js", { runHeat: async () => {} });
  stub("js/craft/steam.js", { runSteamDodge: async () => {} });
  const tips = [];
  stub("js/craft/pull.js", {
    runPull: async (cs, { review }) => { cs.pullDone = true; tips.push(review()); },
    runCare: async (cs, { round, review }) => {
      cs.care = { score: 80 + round };
      tips.push(review());
      cs.careHistory.push(cs.care);
    },
  });
  stub("js/craft/advice.js", { improvementOf: cs => cs.careHistory.map(care => care.score).join(",") });
  stub("js/core/mastery-notice.js", { notifyMastery: () => {} });
  stub("js/craft/score.js", { finalize: () => { throw Error("legacy water practice must not record growth memo"); } });
  stub("js/craft/conditions.js", { temperatureAfterSteam: () => 0 });
  stub("js/craft/flavor-life.js", { ensureFlavorLife: () => {} });
  state.newGame(); order.length = 0; session.namespace.craftTest.auto = "good";
  const practice = await load("js/craft/practice.js");
  const cs = await practice.runFullPractice({ coached: true });
  // 「自動で成功」の確定量（目安の真ん中）が、MIXの前に入り練習記録にも残る（#3938）。
  assert.deepEqual(order, ["setup", "water", "mix"]); assert.equal(cs.water, model.WATER.neutral);
  assert.equal(history.practiceRecords().at(-1).water, model.WATER.neutral);
  assert.deepEqual(tips, ["", "", "81,82"], "Only the final result card reviews the cup, including its current adjustment");
  assert.deepEqual(cs.careHistory.map(care => care.score).join(","), "81,82", "Review does not modify recorded adjustments");
  session.namespace.craftTest.auto = null;
});
console.log(`${checks} water checks passed; browser rendering/real pointer capture not covered by DOM adapter.`);
for (const target of [window, document]) for (const type of ["pointerup", "pointercancel", "keyup", "blur", "pagehide", "visibilitychange", "pointerdown", "click", "keydown"]) {
  assert.equal(getEventListeners(target, type).length, 0, `listener cleanup: ${type}`);
}
