// 登場カットインの待ちと入力の扱い。node --experimental-vm-modules remake/test/intro_pacing.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

// Node の EventTarget にブラウザと同じ boolean の capture を渡せるようにする。
class DomTarget extends EventTarget {
  addEventListener(type, listener, options) {
    super.addEventListener(type, listener, typeof options === "boolean" ? { capture: options } : options);
  }
  removeEventListener(type, listener, options) {
    super.removeEventListener(type, listener, typeof options === "boolean" ? { capture: options } : options);
  }
}

class Node extends DomTarget {
  classList = { add() {}, remove() {} };
  style = { setProperty() {} };
  dataset = {};
  clientWidth = 1280;
  clientHeight = 720;

  remove() {}
}

const waits = [];
const mounts = [];
const effects = [];
let inspectInput;
const window = new DomTarget();
const state = { cycleId: "first", flags: {} };
const context = vm.createContext({
  document: { createElement: () => new Node(), fonts: { load: async () => [] } },
  window,
  getComputedStyle: () => ({ backgroundColor: "#101820" }),
  ResizeObserver: class { observe() {} disconnect() {} },
});
const sources = {
  "../core/util.js": {
    el: () => new Node(),
    sleep: async (ms) => {
      waits.push(ms);
      if (ms !== 30) inspectInput();
    },
  },
  "../core/data.js": {
    DB: {
      characters: {
        sumi: { intro_cutin: {}, intro_cutin_unknown: {} },
        pakki: { intro_cutin: {} },
      },
      manifest: { introArt: { sumi: { background: "sumi.webp" } } },
    },
    displayName: (id) => id,
    portraitInfo: (id) => id === "sumi" ? { src: "portrait.webp" } : null,
    img: (src) => src,
  },
  "../core/state.js": { state, markMet() {}, config: { introTransition: "morph" } },
  "../core/ui.js": {
    layers: { fx: { append: (...nodes) => mounts.push(nodes) } },
    imageReady: async () => {},
  },
  "../core/audio.js": { SE: { select() {} } },
  "./intro-motifs.js": { motifs: {} },
  "./intro-art.js": {
    illustratedIntro: () => new Node(),
    layoutIntro: () => true,
    animateIntro: () => { effects.push("animate"); return []; },
    exitIntro: () => { effects.push("exit"); return 400; },
    flavorTag() {}, plainLine() {}, nameNode() {},
    plainName: (name) => name,
    motionOf: () => "soft",
    MOTIONS: { soft: { hold: 4000 } },
  },
  "./intro-flavors.js": { introFlavor() {} },
  "./intro-graphic.js": { graphicIntro: () => ({ portrait: "graphic.webp" }) },
  "./intro-transition.js": {
    measureStanding: () => null,
    createTransition: (style, { mount }) => {
      effects.push(style);
      return { enter: async () => mount(), cancel() {} };
    },
  },
};

const loadSource = async (name) => new vm.SourceTextModule(
  await readFile(new URL(`../js/vn/${name}.js`, import.meta.url), "utf8"),
  { context },
);
const intro = await loadSource("intro");
const fit = await loadSource("intro-fit");
await intro.link((specifier) => {
  if (specifier === "./intro-fit.js") return fit;
  const exports = sources[specifier];
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
  }, { context });
});
await intro.evaluate();

const { playIntro } = intro.namespace;
const pointerUp = (node) => !node.dispatchEvent(new Event("pointerup", { cancelable: true }));
const keyDown = (key) => {
  const event = new Event("keydown", { cancelable: true });
  Object.defineProperty(event, "key", { value: key });
  return !window.dispatchEvent(event);
};
// 待ちが始まった時点を調べる。初回の組版・つなぎや2行分の待ちも保護する。
async function check(id, options, brief, expectedWaits, expectedEffects) {
  waits.length = mounts.length = effects.length = 0;
  let appearances = 0;
  let input;
  inspectInput = () => {
    const [gutter, host] = mounts.at(-1);
    input = {
      canceled: [pointerUp(host), pointerUp(gutter), keyDown("Enter"), keyDown(" ")],
      pointerEvents: [host.style.pointerEvents, gutter.style.pointerEvents],
    };
  };
  await playIntro(id, { ...options, onAppear: () => { appearances++; } });
  assert.equal(appearances, 1);
  assert.deepEqual(waits.slice(), expectedWaits);
  assert.deepEqual(effects, expectedEffects);
  assert.deepEqual(input.canceled, Array(4).fill(!brief));
  if (brief) assert.deepEqual(input.pointerEvents, ["none", "none"]);
  assert.equal(keyDown("Enter"), false, "終了後にはキーを奪わない");
}

await check("sumi", {}, false, [30, 4400, 400], ["morph", "animate", "exit"]);
await check("sumi", { variant: "unknown" }, true, [600], ["none"]);
await check("pakki", {}, false, [30, 4000, 280], []);
await check("pakki", {}, true, [600], []);
state.cycleId = "second";
await check("sumi", {}, false, [30, 4400, 400], ["morph", "animate", "exit"]);
state.cycleId = "first";
await check("sumi", {}, true, [600], ["none"]);
state.cycleId = "third";
let skipping = false;
await check("sumi", {
  isSkipping: () => skipping,
  waitAssets: async (ready) => { await ready; skipping = true; },
}, true, [600], ["none"]);
await check("sumi", {}, true, [600], ["none"]);

console.log("intro_pacing: OK");
