// node --experimental-vm-modules remake/test/water_setup_helper.mjs
// Scoped orchestration regression: real shop callbacks / packing setup source,
// real confirmation helpers, page adapter. Does not claim native browser coverage.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { confirmAppearanceSetup } from "./browser/appearance_setup.mjs";
import { confirmWaterSetup } from "./browser/water_setup.mjs";

const tests = new Map();
const context = vm.createContext({});
function exportsModule(values) {
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
}
const homeText = fs.readFileSync(new URL("./browser/home_practice_leaves.mjs", import.meta.url), "utf8");
const home = new vm.SourceTextModule(homeText, { context });
await home.link(name => {
  if (name === "node:assert/strict") return exportsModule({ default: assert });
  if (name === "./support.mjs") return exportsModule({ suite: async (_name, register) => register(async (name, fn, opts) => tests.set(name, { fn, opts })) });
  if (name === "./appearance_setup.mjs") return exportsModule({ confirmAppearanceSetup, prepareAppearanceCatalog: () => {} });
  if (name === "./water_setup.mjs") return exportsModule({ confirmWaterSetup });
  throw new Error(`Unexpected home import: ${name}`);
});
await home.evaluate();

function fakePage({ touch, waterError = null } = {}) {
  let phase = "water", observedAuto, mixWaits = 0;
  const calls = [];
  const reachedMix = new Error("verified MIX boundary");
  const act = (selector, method) => {
    if (selector.includes("appearance-confirm")) assert.fail("appearance must not be confirmed in ordinary setup");
    if (selector.includes("water-confirm")) { assert.equal(phase, "water"); phase = "mix"; calls.push(`water:${method}`); }
  };
  return {
    async waitForSelector(selector, options) { const control = this.locator(selector); await control.waitFor(options); return { ...control, dispose: async () => {} }; },
    reachedMix, calls, get auto() { return observedAuto; }, get mixWaits() { return mixWaits; },
    evaluate: async (_fn, args) => { if (args && Object.hasOwn(args, "auto")) observedAuto = args.auto; return true; },
    reload: async () => {}, waitForTimeout: async () => {},
    locator: selector => ({
      first() { return this; },
      count: async () => 0,
      waitFor: async options => {
        assert(!/appearance-confirm/.test(selector), "appearance must not be awaited");
        if (selector.includes("water-confirm")) {
          // Also the setup-continuation wait ("water-confirm, mix-ok").
          assert.equal(phase, "water"); assert.deepEqual(options, { state: "visible" });
          if (waterError) throw waterError;
        } else if (selector.includes("mix-ok")) { mixWaits++; assert.equal(phase, "mix", "MIX wait must follow native water confirmation"); throw reachedMix; }
      },
      scrollIntoViewIfNeeded: async () => {},
      click: async () => act(selector, "click"),
      tap: async () => act(selector, "tap"),
    }),
    expected: [`water:${touch ? "tap" : "click"}`],
  };
}
let cases = 0;
async function reachesMix(label, run, touch, manualAuto = false) {
  const page = fakePage({ touch });
  await assert.rejects(run(page), error => error === page.reachedMix);
  assert.deepEqual(page.calls, page.expected, label);
  if (manualAuto) assert.equal(page.auto, null, "existing auto:null must be retained");
  assert.equal(page.mixWaits, 1);
  console.log(`PASS ${label}`); cases++;
}
for (const [name, touch] of [["hidden-menu-not-clickable-on-bench", true], ["store-leaves-without-own-stock", false], ["touch-store-leaves-without-own-stock", true], ["reload-mid-bench-keeps-save", false]]) {
  const test = tests.get(name); assert(test, name);
  assert.equal(Boolean(test.opts?.hasTouch), touch);
  await reachesMix(name, test.fn, touch, true);
}

// Execute only the original packing entry-to-MIX sequence, keeping its real
// helper calls and each configured device. Later geometry/input assertions stay
// untouched in ds_packing.mjs and belong to the actual browser suite.
const packingText = fs.readFileSync(new URL("./browser/ds_packing.mjs", import.meta.url), "utf8");
assert.match(packingText, /^import \{ confirmWaterSetup \} from "\.\/water_setup\.mjs";$/m, "packing must import the actual water helper");
const marker = '      await p.evaluate(() => { import("./js/craft/practice.js").then(m => m.runFullPractice()); });';
const start = packingText.indexOf(marker), end = packingText.indexOf('await b(p,"mix-ok").waitFor();', start);
assert(start >= 0 && end > start && packingText.indexOf(marker, start + 1) < 0, "one supported packing entry segment");
const deviceStart = packingText.indexOf("const devices = ["), deviceEnd = packingText.indexOf("\n];", deviceStart);
assert(deviceStart >= 0 && deviceEnd > deviceStart);
const deviceSource = packingText.slice(deviceStart, deviceEnd + 3);
const packing = new vm.SourceTextModule(`import { confirmAppearanceSetup } from "appearance";\nimport { confirmWaterSetup } from "water";\n${deviceSource}\nexport { devices };\nconst b = (p, id) => p.locator(\x60[data-test="\x24{id}"]\x60);\nasync function hit(p,id,touch) { const n=b(p,id); await n.scrollIntoViewIfNeeded(); if(touch) await n.tap(); else await n.click(); }\nexport async function setup(p,device) {\n${packingText.slice(start, end + 'await b(p,"mix-ok").waitFor();'.length)}\n}`, { context });
await packing.link(name => exportsModule(name === "appearance" ? { confirmAppearanceSetup } : { confirmWaterSetup }));
await packing.evaluate();
for (const device of packing.namespace.devices) await reachesMix(`packing ${device.name}`, p => packing.namespace.setup(p, device), device.touch);

for (const [name, run] of [["shop", p => tests.get("store-leaves-without-own-stock").fn(p)], ["packing", p => packing.namespace.setup(p, { touch: false })]]) {
  const error = new Error("missing water confirmation"); const page = fakePage({ waterError: error });
  await assert.rejects(run(page), actual => actual === error);
  assert.deepEqual(page.calls, []); assert.equal(page.mixWaits, 0);
  console.log(`PASS ${name} propagates water failure before MIX`); cases++;
}
console.log(`${cases} scoped callsite checks passed; old water22/VM7/helper fixtures not rerun; no native browser claim.`);
