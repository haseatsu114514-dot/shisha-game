// 夜明けカードをDOM/WAAPIの通常完了・中断で検証（illness.mjs の日替わり回帰から実行）。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";

async function checkDawn(info, { reduced = false, cancel = false, failMid = false } = {}) {
  const snapshots = [], keyHandlers = new Set();
  let card, midCalls = 0;
  class Element {
    constructor(spec) {
      const [tag, ...classes] = spec.split(".");
      this.tag = tag; this.classes = new Set(classes); this.children = []; this.style = {}; this.paint = {};
      this.classList = { add: name => this.classes.add(name) };
    }
    get firstChild() { return this.children[0]; }
    get lastChild() { return this.children.at(-1); }
    append(...nodes) {
      for (const node of nodes.flat()) { node.parent = this; this.children.push(node); }
      if (this.children.some(node => node.classes.has("tr-dawn-card"))) {
        card = this.children.find(node => node.classes.has("tr-dawn-card"));
        sample();
      }
    }
    replaceChildren(...nodes) { this.children.forEach(node => node.parent = null); this.children = []; this.append(...nodes); }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    setAttribute(name, value) { this[name] = value; }
    animate(frames) {
      const interrupted = cancel && this.tag === "i";
      if (!interrupted) Object.assign(this.paint, frames.at(-1));
      return { finished: interrupted ? Promise.reject(new Error("cancelled animation")) : Promise.resolve() };
    }
  }
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  function sample() {
    if (!card) return;
    const numbers = descendants(card).filter(node => node.classes.has("tr-flip"));
    snapshots.push(numbers.map(node => node.children.filter(child =>
      Number(child.paint.opacity ?? (child.style.opacity || 1)) > 0).map(child => child.text)));
  }
  function el(spec, attrs = {}, kids = []) {
    if (Array.isArray(attrs)) { kids = attrs; attrs = {}; }
    const node = new Element(spec); Object.assign(node, attrs); node.append(...kids); return node;
  }
  const context = vm.createContext({ Promise, performance, console,
    document: { createElementNS: (_, tag) => new Element(tag) },
    window: { matchMedia: () => ({ matches: reduced }), addEventListener: (_, fn) => keyHandlers.add(fn), removeEventListener: (_, fn) => keyHandlers.delete(fn) },
  });
  const mocks = {
    "util.js": { el, sleep: async () => sample(), nextFrame: async () => sample() },
    "audio.js": { SE: { tick() {} } },
    "transition-moves.js": { moveCurtain() {}, moveStyle() {} },
    "state.js": { state: {} }, "entry-sound.js": { createEntrySound() {} }, "store-arrival.js": { withStoreArrival() {} },
  };
  const modules = new Map();
  async function load(name) {
    if (modules.has(name)) return modules.get(name);
    const values = mocks[name];
    const mod = values ? new vm.SyntheticModule(Object.keys(values), function () {
      for (const [key, value] of Object.entries(values)) this.setExport(key, value);
    }, { context }) : new vm.SourceTextModule(await fs.readFile(new URL(`../js/core/${name}`, import.meta.url), "utf8"), { context });
    modules.set(name, mod); return mod;
  }
  const mod = await load("transitions.js");
  await mod.link(specifier => load(specifier.split("/").at(-1))); await mod.evaluate();
  const host = new Element("div");
  const running = mod.namespace.nightToMorning(host, async () => {
    midCalls++; if (failMid) throw new Error("wake failed"); return info;
  });
  if (failMid) await assert.rejects(running, /wake failed/); else await running;
  assert.equal(midCalls, 1); assert.equal(host.children.length, 0);
  assert.equal(mod.namespace.isCovering(), false); assert.equal(keyHandlers.size, 0);
  if (failMid) return;
  assert(snapshots.length > 0);
  for (const snapshot of snapshots) {
    assert(snapshot[0].every(value => value === String(info.day)), "朝のカードに前日のDAYが見える");
    if (info.left == null || info.sick) assert.equal(snapshot.length, 1);
    else assert(snapshot[1].every(value => value === String(info.left)), "朝のカードに前日の残り日数が見える");
  }
  assert.deepEqual(snapshots.at(-1)[0], [String(info.day)], "中断後も新しいDAYが可視状態で残る");
  if (info.left != null && !info.sick) assert.deepEqual(snapshots.at(-1)[1], [String(info.left)]);
}

for (const info of [
  { fromDay: 6, day: 7, fromLeft: 8, left: 7 },
  { fromDay: 12, day: 13, fromLeft: 2, left: 1, tournamentName: "県大会" },
  { fromDay: 2, day: 3, fromLeft: null, left: null, undatedNote: "勝負の日は未定" },
  { fromDay: 6, day: 7, fromLeft: 8, left: 7, sick: true },
]) {
  await checkDawn(info);
  await checkDawn(info, { reduced: true });
  await checkDawn(info, { cancel: true });
}
await checkDawn({}, { failMid: true });
console.log("[dawn numbers] PASS: current day/countdown from first display, reduced motion, cancelled flips, undated/sick mornings and cleanup");
