import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { test } from "node:test";

const source = await readFile(new URL("../js/craft/rank-hud.js", import.meta.url), "utf8");
const utilSource = await readFile(new URL("../js/core/util.js", import.meta.url), "utf8");

async function harness({ reduced = false, hidden = false } = {}) {
  class Node extends EventTarget {
    constructor(tag = "span", text = "") {
      super(); this.tagName = tag.toUpperCase(); this.children = []; this.parentNode = null;
      this.dataset = {}; this.attributes = new Map(); this.style = { setProperty(key, value) { this[key] = value; } };
      this.className = ""; this.hidden = false; this._text = text; this.textWrites = 0;
      this.classList = { add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
        contains: name => this.className.split(" ").includes(name) };
    }
    set textContent(value) { this.textWrites++; this.replaceChildren(); this._text = String(value); }
    get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
    get isConnected() { return this === document.body || !!this.parentNode?.isConnected; }
    get firstChild() { return this.children[0] ?? null; }
    get firstElementChild() { return this.children.find(node => node.tagName !== "#TEXT") ?? null; }
    get lastElementChild() { return [...this.children].reverse().find(node => node.tagName !== "#TEXT") ?? null; }
    get nextSibling() { return this.parentNode?.children[this.parentNode.children.indexOf(this) + 1] ?? null; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); if (key === "hidden") this.hidden = true; }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    removeAttribute(key) { this.attributes.delete(key); if (key === "hidden") this.hidden = false; }
    append(...nodes) { nodes.forEach(node => { node.remove(); node.parentNode = this; this.children.push(node); }); }
    prepend(node) { this.insertBefore(node, this.firstChild); }
    insertBefore(node, next) { node.remove(); node.parentNode = this; const index = this.children.indexOf(next); this.children.splice(index < 0 ? this.children.length : index, 0, node); }
    remove() { if (this.parentNode) { this.parentNode.children.splice(this.parentNode.children.indexOf(this), 1); this.parentNode = null; } }
    replaceWith(node) { const parent = this.parentNode, next = this.nextSibling; this.remove(); if (parent) parent.insertBefore(node, next); }
    replaceChildren(...nodes) { this.children.forEach(node => { node.parentNode = null; }); this.children = []; this._text = ""; this.append(...nodes); }
    querySelector(selector) { const matches = node => selector[0] === "." ? node.classList.contains(selector.slice(1)) : node.tagName.toLowerCase() === selector; for (const child of this.children) { if (matches(child)) return child; const found = child.querySelector(selector); if (found) return found; } return null; }
  }
  const document = { baseURI: "https://game.example/remake/", hidden, createElement: tag => new Node(tag), createTextNode: text => new Node("#text", text) };
  document.body = new Node("body");
  let timerId = 0;
  const timers = new Map();
  const context = vm.createContext({ document, Node, URL, matchMedia: () => ({ matches: reduced }),
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id) });
  const util = new vm.SourceTextModule(utilSource, { context }); await util.link(() => { throw new Error("Unexpected util dependency"); }); await util.evaluate();
  const module = new vm.SourceTextModule(source, { context });
  await module.link(spec => { assert.equal(spec, "../core/util.js"); return util; }); await module.evaluate();
  const top = document.createElement("div"); top.classList.add("bench-top"); document.body.append(top);
  const mode = util.namespace.el("span.bench-mode", { text: "SMOKE CROWN CUP" });
  const phases = util.namespace.el("nav.bench-progress"), button = util.namespace.el("button", { text: "外観を選ぶ" });
  top.append(mode, phases, button);
  return { api: module.namespace, document, top, mode, phases, button, timers };
}

test("unmeasured rank has no invented grade or progress", async () => {
  const h = await harness(), rank = h.api.buildCraftRank();
  assert.equal(rank.root.dataset.grade, "unavailable");
  assert.equal(rank.root.querySelector(".craft-rank-grade").textContent, "—");
  assert.equal(rank.root.querySelector(".craft-rank-meter").hidden, true);
  assert.match(rank.root.querySelector(".craft-rank-status").textContent, /未計測/);
  rank.update({ label: "SSS", progress: .8 });
  assert.equal(rank.root.querySelector("small"), null);
  assert.equal(rank.root.querySelector(".craft-rank-meter").hidden, true);
});

test("all seven grades and unchanged caller snapshots are supported", async () => {
  const h = await harness(), rank = h.api.buildCraftRank();
  for (const grade of h.api.CRAFT_GRADES) {
    const snapshot = Object.freeze({ grade, label: grade === "A" ? "Aromatic" : "" });
    rank.update(snapshot);
    assert.equal(rank.root.dataset.grade, grade);
    assert.equal(rank.root.querySelector(".craft-rank-grade").textContent, grade);
    if (grade === "A") assert.equal(rank.root.querySelector("small").textContent, "romatic");
    assert.equal(snapshot.grade, grade);
  }
});

test("invalid grades and progress fail without partially changing the view", async () => {
  const h = await harness(), rank = h.api.buildCraftRank({ grade: "B" });
  for (const snapshot of [{ grade: "WINNER" }, { grade: "A", progress: NaN }, { grade: "A", progress: 1.1 }, { grade: "A", progress: -.1 }]) {
    assert.throws(() => rank.update(snapshot), /rank/i); assert.equal(rank.root.dataset.grade, "B");
  }
});

test("progress is optional, accepts zero, and does not replay motion or speech", async () => {
  const h = await harness(), rank = h.api.mountCraftRank(h.top, { grade: "B", progress: 0 });
  const meter = rank.root.querySelector(".craft-rank-meter"), status = rank.root.querySelector(".craft-rank-status");
  assert.equal(meter.hidden, false); assert.equal(meter.getAttribute("aria-valuenow"), "0");
  const writes = status.textWrites;
  rank.update({ grade: "B", progress: .5 });
  assert.equal(meter.getAttribute("aria-valuenow"), "50"); assert.equal(status.textWrites, writes);
  assert.equal(rank.root.dataset.change, undefined); assert.equal(h.timers.size, 0);
  rank.update({ grade: "B" }); assert.equal(meter.hidden, true); assert.equal(meter.getAttribute("aria-valuenow"), null);
});

test("ascending and descending ranks replace a single short effect", async () => {
  const h = await harness(), rank = h.api.mountCraftRank(h.top, { grade: "C" });
  rank.update({ grade: "SSS" }); assert.equal(rank.root.dataset.change, "up"); assert.equal(h.timers.size, 1);
  rank.update({ grade: "A" }); assert.equal(rank.root.dataset.change, "down"); assert.equal(h.timers.size, 1);
  const finish = [...h.timers.values()][0]; finish(); assert.equal(rank.root.dataset.change, undefined);
});

for (const options of [{ reduced: true }, { hidden: true }]) test(`motion is skipped for ${JSON.stringify(options)}`, async () => {
  const h = await harness(options), rank = h.api.mountCraftRank(h.top, { grade: "D" }); rank.update({ grade: "S" });
  assert.equal(rank.root.dataset.change, undefined); assert.equal(h.timers.size, 0);
  assert.match(rank.root.querySelector(".craft-rank-status").textContent, / S/);
});

test("labels are plain text, not HTML or outgoing resource requests", async () => {
  const h = await harness(), rank = h.api.buildCraftRank({ grade: "A", label: '<img src="https://other.example/tracker">' });
  assert.equal(rank.root.querySelector("img"), null);
  assert.match(rank.root.querySelector("small").textContent, /<img/);
  for (const url of ["https://other.example/a.webp", "data:image/png;base64,AA", "javascript:alert(1)"]) {
    assert.throws(() => rank.update({ grade: "A", artwork: { wide: url } }), /same origin/);
  }
});

test("silent updates still expose the current rank to assistive technology", async () => {
  const h = await harness(), rank = h.api.buildCraftRank();
  rank.update({ grade: "A", label: "Aromatic" }, { announce: false });
  assert.match(rank.root.getAttribute("aria-label"), /A.*Aromatic/);
  assert.equal(rank.root.querySelector(".craft-rank-status").textContent, "");
});

test("artwork load failure retains real text, stale loads cannot replace a newer rank", async () => {
  const h = await harness(), rank = h.api.buildCraftRank({ grade: "A", artwork: { wide: "img/a.webp" } });
  const host = rank.root.querySelector(".craft-rank-wide"), oldImage = host.querySelector("img");
  oldImage.dispatchEvent(new Event("error")); assert.equal(host.dataset.artReady, undefined);
  rank.update({ grade: "SSS", artwork: { wide: "img/sss.webp" } });
  oldImage.naturalWidth = 100; oldImage.dispatchEvent(new Event("load")); assert.equal(host.dataset.artReady, undefined);
  const image = host.querySelector("img"); image.naturalWidth = 200; image.dispatchEvent(new Event("load")); assert.equal(host.dataset.artReady, "true");
  image.dispatchEvent(new Event("error")); assert.equal(host.dataset.artReady, undefined);
});

test("mount replaces only the mode slot, refuses duplicates, and dispose restores it", async () => {
  const h = await harness(), rank = h.api.mountCraftRank(h.top, { grade: "D" });
  assert.equal(h.top.firstChild, rank.root); assert.equal(h.top.children[1], h.phases); assert.equal(h.top.children[2], h.button);
  assert.throws(() => h.api.mountCraftRank(h.top), /already mounted/);
  rank.update({ grade: "A" }); rank.dispose(); rank.dispose();
  assert.equal(h.top.firstChild, h.mode); assert.equal(h.top.children[1], h.phases); assert.equal(h.top.lastElementChild, h.button);
  assert.equal(h.timers.size, 0); assert.equal(rank.update({ grade: "SSS" }), false);
});

test("a detached view stays quiet and can be disposed without returning old markup", async () => {
  const h = await harness(), rank = h.api.mountCraftRank(h.top, { grade: "D" });
  h.top.remove(); rank.update({ grade: "S" }); assert.equal(h.timers.size, 0);
  rank.dispose(); assert.equal(rank.root.parentNode, null);
});

test("injected grade floors cover every boundary and clamp both ends", async () => {
  const { api } = await harness();
  const floors = Object.freeze([-10, 10, 30, 50, 70, 90, 110]);
  const expect = (score, grade, progress) => {
    const result = api.craftRankProgress(score, floors);
    assert.equal(result.grade, grade); assert.equal(result.progress, progress);
  };
  api.CRAFT_GRADES.forEach((grade, index) => {
    expect(floors[index], grade, index === 6 ? 1 : 0);
    expect(floors[index] + 10, grade, index === 6 ? 1 : .5);
    if (index < 6) {
      const result = api.craftRankProgress(floors[index + 1] - .001, floors);
      assert.equal(result.grade, grade); assert(result.progress > .999 && result.progress < 1);
    }
  });
  expect(-1e6, "D", 0); expect(1e6, "SSS", 1);
  const extreme = api.craftRankProgress(0, [-1e308, 1e308, 1.1e308, 1.2e308, 1.3e308, 1.4e308, 1.5e308]);
  assert.equal(extreme.grade, "D"); assert.equal(extreme.progress, .5);
});

test("progress rejects nonfinite scores and missing, sparse or unordered floors", async () => {
  const { api } = await harness(), floors = [0, 10, 20, 30, 40, 50, 60];
  for (const score of [undefined, null, "20", NaN, Infinity, -Infinity]) {
    assert.throws(() => api.craftRankProgress(score, floors), /score/);
  }
  for (const input of [undefined, null, {}, [], floors.slice(1), [...floors, 70],
    [0, 10, 10, 30, 40, 50, 60], [0, 20, 10, 30, 40, 50, 60],
    [0, 10, NaN, 30, 40, 50, 60], [0, 10, Infinity, 30, 40, 50, 60],
    [0, 10, "20", 30, 40, 50, 60], new Array(7)]) {
    assert.throws(() => api.craftRankProgress(20, input), /thresholds/);
  }
});

test("first measurement enters once and same-grade progress preserves the letter", async () => {
  const h = await harness(), rank = h.api.mountCraftRank(h.top);
  rank.update({ grade: "S", progress: .6 });
  assert.equal(rank.root.dataset.change, "enter");
  assert.equal(rank.root.dataset.emphasis, "s");
  const letter = rank.root.querySelector(".craft-rank-grade");
  const status = rank.root.querySelector(".craft-rank-status"), writes = status.textWrites;
  const meter = rank.root.querySelector(".craft-rank-meter");
  assert.equal(meter.firstElementChild.style.width, "60%");
  assert.equal(meter.getAttribute("aria-valuenow"), "60");
  assert.equal(meter.getAttribute("aria-valuetext"), "ランク内 60%、次はSS");
  rank.update({ grade: "S", progress: .8 });
  assert.equal(rank.root.querySelector(".craft-rank-grade"), letter);
  assert.equal(status.textWrites, writes); assert.equal(h.timers.size, 1);
  rank.update(null); assert.equal(rank.root.dataset.change, undefined);
  rank.update({ grade: "D" }, { animate: false }); assert.equal(rank.root.dataset.change, undefined);
});

test("emphasis tiers and maximum meter are independent of optional artwork", async () => {
  const h = await harness(), rank = h.api.buildCraftRank();
  for (const grade of h.api.CRAFT_GRADES) {
    rank.update({ grade, progress: .25, artwork: { compact: "img/rank.webp" } });
    assert.equal(rank.root.dataset.emphasis, grade.startsWith("S") ? grade.toLowerCase() : "base");
    assert.equal(rank.root.dataset.maxed, String(grade === "SSS"));
  }
  const meter = rank.root.querySelector(".craft-rank-meter");
  assert.equal(meter.getAttribute("aria-valuenow"), "100");
  assert.equal(meter.getAttribute("aria-valuetext"), "最高ランク");
  assert.equal(meter.firstElementChild.style.width, "100%");
  rank.update({ grade: "SSS" }); assert.equal(meter.hidden, false);
  rank.update(null); assert.equal(meter.hidden, true); assert.equal(meter.getAttribute("aria-valuetext"), null);
});

test("reduced motion also skips first measurement", async () => {
  const h = await harness({ reduced: true }), rank = h.api.mountCraftRank(h.top);
  rank.update({ grade: "S", progress: .6 });
  assert.equal(rank.root.dataset.change, undefined); assert.equal(h.timers.size, 0);
  assert.equal(rank.root.querySelector(".craft-rank-meter").getAttribute("aria-valuenow"), "60");
});

test("sibling mount preserves the mode title, note and identity through disposal", async () => {
  const h = await harness();
  const title = h.document.createTextNode("SMOKE CROWN CUP");
  h.mode.replaceChildren(title);
  const note = h.document.createElement("small"); note.textContent = "今回のみ操作補助";
  h.mode.append(note);
  const rank = h.api.mountCraftRank(h.top, { grade: "S" }, { preserveMode: true });
  assert.equal(h.top.firstChild, h.mode);
  assert.equal(h.mode.firstChild, title);
  assert.equal(h.mode.querySelector("small"), note);
  assert.equal(h.top.children[1], rank.root);
  assert.equal(h.top.children[2], h.phases);
  assert.equal(h.top.lastElementChild, h.button);
  assert.throws(() => h.api.mountCraftRank(h.top, null, { preserveMode: true }), /already mounted/);
  rank.dispose(); rank.dispose();
  assert.equal(h.top.firstChild, h.mode);
  assert.equal(h.top.children[1], h.phases);
  assert.equal(h.mode.querySelector("small"), note);
  assert.equal(h.timers.size, 0);
});
