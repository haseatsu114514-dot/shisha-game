// 本番の炭焼き・雑念回避を同じ操作/仮想時計で比較。色の境界とレッスンの扱いも確認。
// node --experimental-vm-modules remake/test/stamina_condition.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
const jsRoot = new URL("../js/", import.meta.url);
let now = 1000, frameId = 0, frames = new Map(), panel, spawned = 0;
class Element {
  constructor(spec) {
    const [tag, ...classes] = spec.split(".");
    this.tag = tag; this.classes = new Set(classes); this.children = []; this.listeners = {}; this.dataset = {};
    this.style = { setProperty(name, value) { this[name] = value; }, getPropertyValue(name) { return this[name] || ""; } };
    this.classList = { add: (...v) => v.forEach((c) => this.classes.add(c)), remove: (...v) => v.forEach((c) => this.classes.delete(c)),
      contains: (c) => this.classes.has(c), toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c) };
    if (classes.includes("dodge-word") || classes.includes("dodge-object")) spawned++;
    this.offsetWidth = classes.includes("dodge-word") ? 160 : 22;
    this.offsetHeight = classes.includes("dodge-word") ? 28 : 22;
  }
  append(...nodes) { this.children.push(...nodes.flat().filter(Boolean)); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  cloneNode(deep = false) {
    const node = new Element([this.tag, ...this.classes].join("."));
    node.dataset = { ...this.dataset }; Object.assign(node.style, this.style);
    if (deep) node.append(this.children.map(child => child.cloneNode?.(true) || child));
    return node;
  }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  setAttribute(name, value) { this[name] = String(value); }
  getAttribute(name) { return this[name] ?? null; }
  querySelector(selector) {
    assert(selector.startsWith(".") && !selector.includes(" "), `Unsupported fixture selector: ${selector}`);
    const name = selector.slice(1);
    for (const child of this.children) {
      if (child.classes?.has(name)) return child;
      const descendant = child.querySelector?.(selector);
      if (descendant) return descendant;
    }
    return null;
  }
  querySelectorAll() { return []; }
  getContext() { return null; }
  remove() {}
}
function el(spec, attrs = {}, children = []) {
  if (Array.isArray(attrs)) { children = attrs; attrs = {}; }
  const node = new Element(spec), { style, ...rest } = attrs;
  Object.assign(node, rest); if (style) Object.assign(node.style, style); node.append(children); return node;
}
function find(test, node = panel) { return node?.dataset?.test === test ? node : node?.children.map((child) => find(test, child)).find(Boolean); }
function nextButton(node = panel) { return node.classes?.has("rc-next") ? node : node.children?.map(nextButton).find(Boolean); }
const settle = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
async function frame(time) { now = time; const waiting = [...frames.values()]; frames.clear(); for (const fn of waiting) fn(now); await settle(); }
const bench = el("div.bench");
const mocks = {
  "core/util.js": { el, sleep: async () => {}, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (lo, hi) => (lo + hi) / 2, pick: (pool) => pool[0] },
  "core/ui.js": { countdown: async () => {}, flash() {}, shake() {} },
  "core/state.js": { state: { flags: {} }, config: { statEffectColors: true } },
  "core/audio.js": { SE: new Proxy({}, { get: () => () => {} }) },
  "core/stats.js": { tier01: () => 0, step: () => 1 },
  "craft/session.js": { waitBenchReady: async () => {}, explainTutorialStep: async () => true, benchRoot: () => bench, scoreStep() {}, setBenchTemperature() {}, pauseBenchTemperature() {}, craftTest: { auto: null }, stepPanel: id => (panel = el("div.panel", { dataset: { step: id } })), refreshBench() {}, tickerSay() {}, reactAudience() {}, setPlayerMental() {}, presentBenchResult: () => ({ evaluation: { mark: "○", tone: "warm" }, hasAudience: false }) },
  "craft/art.js": { artImg: () => el("img"), artHeight: () => 80 },
  "craft/digital-clock.js": { buildDigitalClock: () => ({ root: el("output"), update() {} }) },
  "craft/mental.js": { buildMentalTrace: () => ({ root: el("div"), update: () => "steady", hit: () => "shaken", recoverStep: () => "unsteady" }) },
  "craft/smoke-art.js": { smokeUrl: () => "" },
};
const context = vm.createContext({ Math, Promise, console, Set, AbortController, performance: { now: () => now },
  window: { addEventListener() {}, removeEventListener() {} },
  navigator: { getGamepads: () => [] }, requestAnimationFrame: (fn) => { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout() {} });
const mods = new Map(), pending = new Map();
function load(url) {
  if (!pending.has(url.href)) pending.set(url.href, (async () => {
    const path = url.href.slice(jsRoot.href.length), values = mocks[path];
    const mod = values ? new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context, identifier: url.href })
      : new vm.SourceTextModule(await fs.readFile(url, "utf8"), { context, identifier: url.href });
    mods.set(url.href, mod); return mod;
  })());
  return pending.get(url.href);
}
// Node自身に依存グラフをリンクさせる。共有依存を途中で重複リンクしない。
const link = (specifier, ref) => load(new URL(specifier, ref.identifier));
const heatModule = await load(new URL("craft/heat.js", jsRoot)); await heatModule.link(link); await heatModule.evaluate();
const heatLogic = mods.get(new URL("craft/heat_logic.js", jsRoot).href).namespace;
const steamModule = await load(new URL("craft/steam.js", jsRoot)); await steamModule.link(link); await steamModule.evaluate();
const { conditionForRatio } = mods.get(new URL("core/condition.js", jsRoot).href).namespace;
for (const [ratio, health] of [[1, "green"], [.5001, "green"], [.5, "yellow"], [.2501, "yellow"], [.25, "red"], [0, "red"]]) {
  assert.equal(conditionForRatio(ratio).health, health);
}
async function heat(ratio, delay, mode = "tournament") {
  now = 1000; frames.clear();
  const cs = { mode, condition: conditionForRatio(ratio), equip: {} };
  const running = heatModule.namespace.runHeat(cs); await settle();
  // 全炭を同じ速度で焼き、全面が赤くなり始めてから同じ秒数だけ待って取る。
  await frame(1000 + 5800 * (mode === "tutorial" ? 1.25 : 1) + delay * 1000);
  for (let i = 0; i < 3; i++) for (const fn of find(`coal-${i}`).listeners.pointerdown) fn({ preventDefault() {} });
  await settle(); nextButton().onclick(); await running; return cs.heat;
}
const yellow = await heat(.5, .4), red = await heat(.25, .4);
assert.equal(yellow.just, 3); assert.equal(yellow.score, 100);
assert.equal(red.just, 0); assert.equal(red.score, 80); assert(red.burnRisk > yellow.burnRisk);
const greenLate = await heat(.51, .55), yellowLate = await heat(.5, .55);
assert.equal(greenLate.just, 3); assert.equal(yellowLate.just, 0); assert(greenLate.aromaRetention > yellowLate.aromaRetention);
assert.equal((await heat(.25, .65, "tutorial")).just, 3, "Low stamina affected the introductory lesson");

// 全6状態の閾値は従来どおり。新しい英字評価はその状態から派生する。
for (const [time, phase, rating, score] of [[.349, "raw", "MISS", 15], [.35, "early", "MISS", 45],
  [.7, "pre", "GOOD", 78], [1, "just", "PERFECT", 100], [1.5, "hot", "GOOD", 80], [1.8, "over", "MISS", 68]]) {
  const result = heatLogic.evaluateCoalTiming(time, 1, .5);
  assert.equal(result.phase, phase); assert.equal(result.rating, rating); assert.equal(result.score, score);
}
assert.equal(heatLogic.formatTimingError(-.08), "0.08秒早い");
assert.equal(heatLogic.formatTimingError(.35), "0.35秒遅い");
assert.equal(heatLogic.formatTimingError(-.0001), "0.00秒（ほぼ一致）");
assert.equal(heatLogic.formatTimingError(0), "0.00秒（ほぼ一致）");

// 最後の描画は適温前でも、実際の入力がジャストなら誤差・採点ともジャスト。
now = 1000; frames.clear();
const timingCs = { mode: "tournament", condition: conditionForRatio(1), equip: {} };
const timingRun = heatModule.namespace.runHeat(timingCs); await settle();
await frame(6700); // 経過5.7秒。炭のジャスト開始は5.8秒。
assert.equal(find("coal-0").dataset.phase, "pre");
const justWidth = .5 * conditionForRatio(1).window, ideal = 5.8 + justWidth / 2;
const delays = [-.08, .35, -.35];
for (let i = 0; i < 3; i++) {
  now = 1000 + (ideal + delays[i]) * 1000; // RAFを挟まず入力時刻だけ変える。
  for (const fn of find(`coal-${i}`).listeners.pointerdown) fn({ preventDefault() {} });
  assert.match(find(`coal-timing-${i}`).children[1].text, /\d+\.\d{2}秒/);
}
await settle();
assert.deepEqual(Array.from(timingCs.heat.picks), ["just", "hot", "pre"]);
assert.equal(timingCs.heat.timings[0].rating, "PERFECT");
assert(Math.abs(timingCs.heat.timings[0].errorSeconds + .08) < 1e-12);
assert.equal(timingCs.heat.score, Math.round((100 + 80 + 78) / 3));
assert.equal(timingCs.heat.timingAccuracy, timingCs.heat.score);
assert(Math.abs(timingCs.heat.meanAbsoluteError - .26) < 1e-12);
assert(find("step-summary").children.at(-1).text.includes("取り頃で取れた炭がある"));
const frozen = JSON.stringify(timingCs.heat.timings);
for (const fn of find("coal-0").listeners.pointerdown) fn({ preventDefault() {} });
await frame(now + 2000); assert.equal(JSON.stringify(timingCs.heat.timings), frozen);
nextButton().onclick(); await timingRun;

// 灰になった炭の自動取り出しにも、遅れ・MISS・最終集計を残す。
now = 1000; frames.clear();
const expiredCs = { mode: "tournament", equip: {} };
const expiredRun = heatModule.namespace.runHeat(expiredCs); await settle(); await frame(13000); await settle();
assert.equal(expiredCs.heat.over, 3);
assert(expiredCs.heat.timings.every((timing) => timing.automatic && timing.errorSeconds > 0 && timing.rating === "MISS"));
assert.equal(expiredCs.heat.timingAccuracy, 68);
nextButton().onclick(); await expiredRun;
console.log("[coal timing] PASS: unchanged thresholds, ideal window center, live two-decimal early/late errors, input-time sampling, frozen per-coal results, qualitative summary and auto removal");
async function steam(ratio) {
  now = 1000; frames.clear(); spawned = 0;
  const cs = { mode: "tournament", condition: conditionForRatio(ratio), steamMin: 3 };
  let error;
  const running = steamModule.namespace.runSteamDodge(cs); running.catch(e => { error = e; }); await settle();
  for (let t = 1050; t <= 10100; t += 50) await frame(t);
  await settle(); if (error) throw error;
  const count = spawned; nextButton().onclick(); await running;
  return { count, hits: cs.steam.hits, score: cs.steam.score };
}
const steamGreen = await steam(.51), steamYellow = await steam(.5), steamRed = await steam(.25);
assert(steamGreen.count < steamYellow.count, "Good condition did not ease distractions");
assert(steamRed.count > steamYellow.count, "Low stamina did not increase distractions");
// 扇状・横なぎの重なりは無敵時間に吸収されるため、被弾数の大小は固定しない。
// 同じ9秒の入力で体力による発生密度の差を確認し、実際の接触も起きていることを確認。
assert(steamRed.hits > 0 && steamGreen.hits > 0);
assert(steamRed.hits <= 10 && steamGreen.hits <= 10, "Invulnerability did not limit overlapping hits");
console.log("[stamina] PASS: exact color boundaries, same heat timing changes real charcoal quality, green benefit, red penalty, lesson protection, real distraction density and overlapping-hit protection");
