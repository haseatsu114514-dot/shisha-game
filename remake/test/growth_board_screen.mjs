// Render the real board screen with a small DOM host: selection must not rebuild the board.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

class Element {
  constructor(tag = "div") {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attrs = {}; this.listeners = {};
    this.className = ""; this.style = { setProperty(k, v) { this[k] = v; } };
    this.scrollLeft = this.scrollTop = 0; this.clientWidth = 760; this.clientHeight = 488;
    this.classList = {
      contains: c => this.className.split(/\s+/).includes(c),
      add: (...cs) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...cs])].join(" "); },
      remove: (...cs) => { this.className = this.className.split(/\s+/).filter(c => !cs.includes(c)).join(" "); },
      toggle: (c, force) => { const yes = force ?? !this.classList.contains(c); this.classList[yes ? "add" : "remove"](c); return yes; },
    };
  }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  prepend(...nodes) { for (const node of nodes.reverse()) { node.parent = this; this.children.unshift(node); } }
  replaceChildren(...nodes) { for (const n of this.children) n.parent = null; this.children = []; this.append(...nodes); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = String(v); }
  addEventListener(k, fn) { this.listeners[k] = fn; }
  removeEventListener() {}
  get isConnected() { return !!this.parent || this.host; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  querySelectorAll(selector) {
    const matches = n => selector.startsWith("[data-test=") ? n.dataset.test === selector.match(/"([^"]+)"/)[1]
      : selector.startsWith(".") ? selector.slice(1).split(".").every(c => n.classList.contains(c))
      : n.tagName === selector;
    const found = []; const walk = n => { for (const c of n.children) { if (matches(c)) found.push(c); walk(c); } };
    walk(this); return found;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  focus() { document.activeElement = this; }
  click() { this.listeners.click?.({}); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(n => n !== this); this.parent = null; }
}
globalThis.Node = Element;
globalThis.document = { createElement: tag => new Element(tag), createElementNS: (_, tag) => new Element(tag),
  createTextNode: text => Object.assign(new Element("#text"), { textContent: text }), addEventListener() {}, removeEventListener() {}, querySelector() { return null; } };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: k => storage.get(k) ?? null, removeItem: k => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const util = await import("../js/core/util.js");
const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 3, slot: 1 });
const g = growth.ensureGrowth(); g.seenRing = 1; g.hidane.any = 30;
const fx = new Element(); fx.host = true;
const modules = {
  "../core/util.js": { ...util, sleep: async () => {} },
  "../core/ui.js": { layers: { fx }, modal: async () => null, gainCard() {} },
  "../core/audio.js": { SE: {} }, "../core/bus.js": { emit() {}, on: () => () => {} },
  "../core/state.js": { state: s, save() {} },
  "../core/growth-respec.js": { canRespec: () => false, prepareRespec: () => null, commitRespec: () => false },
  "../core/growth-mode.js": { growthEnabled: () => true },
  "./growth-board-tutorial.js": { grantStarterHidane() {}, tutorialPending: () => false, startBoardTutorial() {}, TUTORIAL_FLAG: "_tutorial" },
  "../core/growth-effects.js": { LESSON_TUNING: {} },
  "../core/data.js": { displayName: id => id, faceIconUrl: () => null, portraitInfo: () => null },
  "../core/stats.js": { affinityLevel: () => 0 }, "../core/growth.js": growth, "../core/growth-board.js": board,
};
const context = vm.createContext({ document, Node: Element, console, setTimeout, requestAnimationFrame: fn => fn(),
  Image: class { set src(_) { queueMicrotask(() => this.onerror()); } } });
const source = readFileSync(new URL("../js/daily/growth-board-screen.js", import.meta.url), "utf8");
const screen = new vm.SourceTextModule(source, { context });
await screen.link(async name => {
  assert(modules[name], `Unexpected import ${name}`);
  const exports = modules[name];
  return new vm.SyntheticModule(Object.keys(exports), function () { for (const [k, v] of Object.entries(exports)) this.setExport(k, v); }, { context });
});
await screen.evaluate();
const done = screen.namespace.openBoard({ place: "kannon" });
await new Promise(r => setImmediate(r));
let root = fx.children[0];
const nodes = root.querySelector(".gb-nodes"), svg = root.querySelector(".gb-svg");
const button = id => root.querySelector(`[data-test="board-node-${id}"]`);
const originalNodes = [...nodes.children], originalPaths = [...svg.children];
const wallet = root.querySelector('[data-test="board-wallet"]');
for (const n of originalNodes) n.click();
assert(nodes.children.length === originalNodes.length && originalNodes.every((n, i) => nodes.children[i] === n), "Inspecting every node preserves the node DOM");
assert(svg.children.length === originalPaths.length && originalPaths.every((n, i) => svg.children[i] === n), "Inspecting every node preserves the SVG DOM");
assert.equal(root.querySelector('[data-test="board-wallet"]'), wallet, "Selection does not replace wallet/tabs/header");
assert.equal(nodes.querySelectorAll(".selected").length, 1);
assert.equal(document.activeElement, originalNodes.at(-1));
assert.equal(svg.querySelectorAll("filter").length, 0, "No full-board SVG noise/blur filters");
assert.equal(svg.querySelectorAll("feTurbulence").length, 0);

const available = nodes.children.find(n => n.dataset.status === "available");
assert(available, "Fixture has an affordable node");
const id = available.dataset.test.replace("board-node-", "");
available.click(); root.querySelector('[data-test="board-light"]').click();
assert.equal(button(id).dataset.status, "pending");
assert.equal(button(id).querySelector(".gb-node-state").textContent, "+");
assert(button(id).classList.contains("lit-now"), "Auto-selection must not erase the light animation");
assert(svg.querySelectorAll(".gb-path.lit.pending").length > 0, "Pending paths have a separate dashed state");
button(id).click(); root.querySelector('[data-test="board-undo"]').click();
assert.equal(button(id).dataset.status, "available");
assert.equal(button(id).querySelector(".gb-node-state"), null);
button(id).click(); root.querySelector('[data-test="board-light"]').click();
root.querySelector('[data-test="board-decide"]').click();
await done;
assert(g.nodes.includes(id), "Deciding commits the node through the real board rules");
assert.equal(root.parent, null, "Closed board is detached");
const committedDone = screen.namespace.openBoard();
root = fx.children[0];
assert.equal(button(id).dataset.status, "unlocked");
assert.equal(button(id).querySelector(".gb-node-state").textContent, "✓");
fx.children[0].querySelector('[data-test="board-close"]').click();
await committedDone;
console.log(`PASS board screen: ${originalNodes.length} selections preserve DOM; pending/undo/commit/check badge; no full-board filters`);

// The board's eye coordinates were measured on classic artwork, independently of VN preferences.
const data = await import("../js/core/data.js");
data.DB.manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url)));
data.DB.characters = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/characters.json", import.meta.url))).map(c => [c.id, c]));
const panelStart = source.indexOf("  function panelPortrait(");
const panelEnd = source.indexOf("  /** 章ごとの見せ方", panelStart);
assert(panelStart > 0 && panelEnd > panelStart);
const constants = [source.match(/const PORTRAIT_EYES = \{[\s\S]*?\n\};/)[0],
  source.match(/const PANEL_FACE_W = [^;]+;/)[0], source.match(/const PANEL_FACE = \{[\s\S]*?\n\};/)[0]].join("\n");
const panelGrowth = { known: false }, cropCalls = [], panelRoot = new Element();
const panelContext = vm.createContext({ el: util.el, g: panelGrowth, root: panelRoot, ART_DIR: "img/ui/growth_board/",
  lessonKnown: () => panelGrowth.known,
  portraitInfo: (...args) => { const p = data.portraitInfo(...args); cropCalls.push({ args, p }); return p; },
});
vm.runInContext(`${constants}\n${source.slice(panelStart, panelEnd)}\nthis.panelPortrait = panelPortrait; this.eyes = PORTRAIT_EYES;`, panelContext);
const previousStyle = core.config.portraitStyle;
for (const preference of ["classic", "new"]) {
  core.config.portraitStyle = preference;
  // Prove the new setting can resolve a different source outside the dedicated crop.
  assert.equal(data.portraitInfo("tsumugi", "normal").style, preference);
  for (const [node, known] of [[{ kind: "lesson", id: "M-W1", who: "tsumugi" }, false],
    [{ kind: "lesson", id: "M-W1", who: "tsumugi" }, true], [{ kind: "skill", id: "K01" }, true]]) {
    panelGrowth.known = known;
    const image = panelContext.panelPortrait(node, "open"), { args, p } = cropCalls.at(-1);
    assert.equal(args[2], "classic", `${node.kind}/${known}: explicit style is required`);
    assert.equal(p.style, "classic"); assert.match(image.attrs.src, /sprites\/characters\//);
    const who = node.kind === "skill" ? "hajime" : node.who, [ex, ey, fw] = panelContext.eyes[who], k = 82 / fw;
    assert.equal(image.style.width, `${Math.round(896 * k)}px`);
    assert.equal(image.style.marginLeft, `${Math.round(-ex * k)}px`);
    assert.equal(image.style.top, `${Math.round(64 - ey * k)}px`);
    assert.equal(core.config.portraitStyle, preference, "Dedicated crop must not change the saved VN setting");
  }
}
core.config.portraitStyle = previousStyle;
console.log("PASS board portraits: unknown/known lesson and skill use classic source + measured eye coordinates under both preferences");
