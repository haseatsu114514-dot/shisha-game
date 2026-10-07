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
    this.style = { setProperty() {} };
    this.classList = { add: (...v) => v.forEach((c) => this.classes.add(c)), remove: (...v) => v.forEach((c) => this.classes.delete(c)),
      contains: (c) => this.classes.has(c), toggle: (c, yes) => yes ? this.classes.add(c) : this.classes.delete(c) };
    if (classes.includes("dodge-word")) spawned++;
  }
  append(...nodes) { this.children.push(...nodes.flat().filter(Boolean)); }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
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
const mocks = {
  "core/util.js": { el, sleep: async () => {}, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)), rand: (lo, hi) => (lo + hi) / 2, pick: (pool) => pool[0] },
  "core/ui.js": { countdown: async () => {}, flash() {}, shake() {} },
  "core/audio.js": { SE: new Proxy({}, { get: () => () => {} }) },
  "core/stats.js": { tier01: () => 0, star: () => 1 },
  "craft/session.js": { craftTest: { auto: null }, stepPanel: () => (panel = el("div.panel")), refreshRig() {}, tickerSay() {}, benchRig: () => null },
  "craft/art.js": { artImg: () => el("img") },
};
const context = vm.createContext({ Math, Promise, console, Set, performance: { now: () => now },
  window: { addEventListener() {}, removeEventListener() {} },
  requestAnimationFrame: (fn) => { const id = ++frameId; frames.set(id, fn); return id; }, cancelAnimationFrame: (id) => frames.delete(id), setTimeout() {} });
const mods = new Map();
async function load(url) {
  if (mods.has(url.href)) return mods.get(url.href);
  const path = url.href.slice(jsRoot.href.length), values = mocks[path];
  const mod = values ? new vm.SyntheticModule(Object.keys(values), function () { for (const [key, value] of Object.entries(values)) this.setExport(key, value); }, { context, identifier: url.href })
    : new vm.SourceTextModule(await fs.readFile(url, "utf8"), { context, identifier: url.href });
  mods.set(url.href, mod); await mod.link((specifier) => load(new URL(specifier, url))); return mod;
}
const heatModule = await load(new URL("craft/heat.js", jsRoot)); await heatModule.evaluate();
const steamModule = await load(new URL("craft/steam.js", jsRoot)); await steamModule.evaluate();
const { conditionForRatio } = mods.get(new URL("core/condition.js", jsRoot).href).namespace;
for (const [ratio, health] of [[1, "green"], [.5001, "green"], [.5, "yellow"], [.2501, "yellow"], [.25, "red"], [0, "red"]]) {
  assert.equal(conditionForRatio(ratio).health, health);
}
async function heat(ratio, delay, mode = "tournament") {
  now = 1000; frames.clear();
  const cs = { mode, condition: conditionForRatio(ratio), equip: {} };
  const running = heatModule.namespace.runHeat(cs); await settle();
  // 全炭を同じ速度で焼き、芯が光り始めてから同じ秒数だけ待って取る。
  await frame(1000 + 5800 * (mode === "tutorial" ? 1.25 : 1) + delay * 1000);
  for (let i = 0; i < 3; i++) for (const fn of find(`coal-${i}`).listeners.pointerdown) fn({ preventDefault() {} });
  await settle(); nextButton().onclick(); await running; return cs.heat;
}
const yellow = await heat(.5, .4), red = await heat(.25, .4);
assert.equal(yellow.just, 3); assert.equal(yellow.score, 100);
assert.equal(red.just, 0); assert.equal(red.score, 62); assert(red.burnRisk > yellow.burnRisk);
const greenLate = await heat(.51, .55), yellowLate = await heat(.5, .55);
assert.equal(greenLate.just, 3); assert.equal(yellowLate.just, 0); assert(greenLate.aromaRetention > yellowLate.aromaRetention);
assert.equal((await heat(.25, .65, "tutorial")).just, 3, "Low stamina affected the introductory lesson");
async function steam(ratio) {
  now = 1000; frames.clear(); spawned = 0;
  const cs = { mode: "tournament", condition: conditionForRatio(ratio), steamMin: 3 };
  const running = steamModule.namespace.runSteamDodge(cs); await settle();
  for (let t = 1050; t <= 8000; t += 50) await frame(t);
  await settle(); const count = spawned; nextButton().onclick(); await running;
  return { count, hits: cs.steam.hits, score: cs.steam.score };
}
const steamGreen = await steam(.51), steamYellow = await steam(.5), steamRed = await steam(.25);
assert(steamGreen.count < steamYellow.count, "Good condition did not ease distractions");
assert(steamRed.count > steamYellow.count, "Low stamina did not increase distractions");
assert(steamRed.hits > steamGreen.hits); assert(steamRed.score < steamGreen.score);
console.log("[stamina] PASS: exact color boundaries, same heat timing changes real charcoal quality, green benefit, red penalty, lesson protection, real distraction frequency/hits");
