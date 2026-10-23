// node --experimental-vm-modules remake/test/ch1_eve_setup.mjs
// Focused adapter boundary, not a full browser/SAVE acceptance run.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { confirmAppearanceSetup } from "./browser/appearance_setup.mjs";

const source = fs.readFileSync(new URL("./browser/ch1_eve.mjs", import.meta.url), "utf8");
const callbacks = new Map();
const context = vm.createContext({ process: { env: { TEST_CASES: "save-during-practice" } }, URL });
const mod = new vm.SourceTextModule(source, { context,
  initializeImportMeta: meta => { meta.url = new URL("./browser/ch1_eve.mjs", import.meta.url).href; } });
await mod.link(name => {
  const exports = name === "node:assert/strict" ? { default: assert }
    : name === "node:fs" ? { default: { mkdirSync() {} } }
    : name === "node:path" ? { default: path }
    : name === "node:url" ? { fileURLToPath }
    : name === "./appearance_setup.mjs" ? { confirmAppearanceSetup }
    : name === "./support.mjs" ? {
      suite: async (_name, register) => register(async (name, fn) => callbacks.set(name, fn)),
      assertFits: async () => {},
    } : null;
  assert(exports, `Unexpected dependency: ${name}`);
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await mod.evaluate();
assert.equal(callbacks.size, 1);

for (const blocked of [null, "appearance", "water"]) {
  let stage = "choice", auto;
  const input = [], saveBoundary = new Error("reached actual save call after MIX");
  const page = {
    setDefaultTimeout() {},
    evaluate: async (fn, args) => {
      if (args && typeof args === "object" && "auto" in args) auto = args.auto;
      if (String(fn).includes("E.benches")) return 0;
      if (String(fn).includes("E.core.saveToSlot")) {
        assert.equal(stage, "mix"); throw saveBoundary;
      }
      if (String(fn).includes("E.error")) return null;
      if (String(fn).includes("E.vn.vnTest.turbo")) return true;
    },
    waitForTimeout: async () => { throw new Error(`blocked at ${stage}`); },
    locator: selector => ({
      isVisible: async () => selector.includes("choice-3") ? stage === "choice"
        : selector.includes("appearance-confirm") ? stage === "appearance"
        : selector.includes("water-confirm") ? stage === "water"
        : selector.includes("mix-ok") ? stage === "mix" : false,
      count: async () => 4,
      waitFor: async () => { assert.equal(stage, "appearance"); },
      scrollIntoViewIfNeeded: async () => {},
      click: async () => {
        if (selector.includes("choice-0")) stage = "appearance";
        else if (selector.includes("appearance-confirm")) {
          assert.equal(stage, "appearance"); input.push("appearance");
          if (blocked !== "appearance") stage = "water";
        } else if (selector.includes("water-confirm")) {
          assert.equal(stage, "water"); input.push("water");
          if (blocked !== "water") stage = "mix";
        } else throw new Error(`Unexpected input: ${selector}`);
      },
    }),
  };
  const run = callbacks.get("save-during-practice")(page);
  if (blocked) await assert.rejects(run, new RegExp(`blocked at ${blocked}`));
  else await assert.rejects(run, error => error === saveBoundary);
  assert.equal(auto, null, "manual SAVE path must remain manual");
  assert.deepEqual(input, blocked === "appearance" ? ["appearance"] : ["appearance", "water"]);
}
console.log("PASS: actual eve manual SAVE callback confirms appearance then water before MIX/save boundary");
console.log("PASS: pending appearance/water confirmation still blocks; manual auto:null preserved");
