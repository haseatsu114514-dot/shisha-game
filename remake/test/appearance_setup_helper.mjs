// node --experimental-vm-modules remake/test/appearance_setup_helper.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { confirmAppearanceSetup, waitForSetupContinuation, prepareAppearanceCatalog } from "./browser/appearance_setup.mjs";
import { confirmWaterSetup } from "./browser/water_setup.mjs";

const calls = [];
const page = { locator: selector => ({
  first() { assert.match(selector, /water-confirm.*mix-ok/); return this; },
  waitFor: async options => { assert.deepEqual(options, { state: "visible" }); calls.push("next step visible"); },
  count: async () => { assert.match(selector, /appearance-confirm/); return 0; },
}) };
await waitForSetupContinuation(page);
assert.deepEqual(calls, ["next step visible"]);
assert.equal(confirmAppearanceSetup, waitForSetupContinuation, "old callers wait for the next real step");
const missing = { locator: () => ({ first() { return this; }, waitFor: async () => { throw new Error("next step missing"); } }) };
await assert.rejects(waitForSetupContinuation(missing), /next step missing/);
const blocked = { locator: () => ({ first() { return this; }, waitFor: async () => {}, count: async () => 1 }) };
await assert.rejects(waitForSetupContinuation(blocked), /Appearance must not block/);
console.log("PASS: setup helper requires the next real step and rejects a blocking appearance picker");

// An unrelated tiny synthetic Git repository; no clone, remote or user config edits.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "appearance-catalog-test-"));
try {
  const sourcePath = "asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json";
  const actual = fs.readFileSync(fileURLToPath(new URL("../../" + sourcePath, import.meta.url)), "utf8");
  const target = path.join(temp, sourcePath);
  const git = args => execFileSync("git", ["-C", temp, ...args], { encoding: "utf8", env: {
    ...process.env, GIT_AUTHOR_NAME: "Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  } });
  git(["init", "--quiet"]); fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, actual); git(["add", sourcePath]); git(["commit", "--quiet", "-m", "fixture source"]);
  const before = git(["rev-parse", "HEAD"]);
  fs.unlinkSync(target);
  let supportsNoLazyFetch = false;
  try { git(["--no-lazy-fetch", "--version"]); supportsNoLazyFetch = true; }
  catch (error) { assert.match(String(error.stderr), /unknown option: --no-lazy-fetch/); }
  if (supportsNoLazyFetch) {
    prepareAppearanceCatalog(temp);
    assert.equal(fs.readFileSync(target, "utf8"), actual, "restore canonical bytes from current HEAD");
    // Remove only this disposable fixture's blob: missing local content must fail.
    const blob = git(["rev-parse", `HEAD:${sourcePath}`]).trim();
    fs.unlinkSync(target);
    fs.unlinkSync(path.join(temp, ".git", "objects", blob.slice(0, 2), blob.slice(2)));
    assert.throws(() => prepareAppearanceCatalog(temp));
    assert.equal(fs.existsSync(target), false);
  } else {
    assert.throws(() => prepareAppearanceCatalog(temp), /unknown option: --no-lazy-fetch/);
    assert.equal(fs.existsSync(target), false, "unsupported Git must fail before writing source");
  }
  assert.equal(git(["rev-parse", "HEAD"]), before);
  fs.writeFileSync(target, "preserve existing work"); prepareAppearanceCatalog(temp);
  assert.equal(fs.readFileSync(target, "utf8"), "preserve existing work");
  const child = path.join(temp, "child"); fs.mkdirSync(child);
  assert.throws(() => prepareAppearanceCatalog(child), /not a parent repository/);
  const childTarget = path.join(child, sourcePath);
  fs.mkdirSync(path.dirname(childTarget), { recursive: true }); fs.writeFileSync(childTarget, actual);
  assert.throws(() => prepareAppearanceCatalog(child), /not a parent repository/);
  assert.equal(fs.readFileSync(childTarget, "utf8"), actual);
  const outside = path.join(temp, "..", path.basename(temp) + "-not-git");
  fs.mkdirSync(path.dirname(path.join(outside, sourcePath)), { recursive: true });
  try {
    assert.throws(() => prepareAppearanceCatalog(outside));
    fs.writeFileSync(path.join(outside, sourcePath), actual);
    assert.throws(() => prepareAppearanceCatalog(outside));
    assert.equal(fs.readFileSync(path.join(outside, sourcePath), "utf8"), actual);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
  console.log(`PASS: root validation with/without catalog, no overwrite; explicit no-lazy-fetch ${supportsNoLazyFetch ? "supported: local restore and missing-object refusal" : "unsupported: fail-closed refusal"}`);
} finally { fs.rmSync(temp, { recursive: true, force: true }); }

// Execute the actual three browser-test callbacks up to their mix wait. This
// checks the real manual setup wiring while leaving their later assertions intact.
const tests = new Map();
const context = vm.createContext({});
const leaves = new vm.SourceTextModule(fs.readFileSync(new URL("./browser/home_practice_leaves.mjs", import.meta.url), "utf8"), { context });
await leaves.link(name => {
  const exports = name === "node:assert/strict" ? { default: assert }
    : name === "./support.mjs" ? { suite: async (_name, register) => register(async (name, fn, opts) => tests.set(name, { fn, opts })) }
    : name === "./water_setup.mjs" ? { confirmWaterSetup }
    : { confirmAppearanceSetup, prepareAppearanceCatalog: () => {} };
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await leaves.evaluate();
for (const [name, touch] of [["hidden-menu-not-clickable-on-bench", true], ["store-leaves-without-own-stock", false], ["reload-mid-bench-keeps-save", false]]) {
  let phase = "crafting", observedAuto;
  const inputs = [], reachedMix = new Error("mix boundary reached");
  const page = {
    evaluate: async (_fn, args) => { if (args) observedAuto = args.auto; },
    async waitForSelector(selector, options) { const control = this.locator(selector); await control.waitFor(options); return { ...control, dispose: async () => {} }; },
    locator: selector => ({
      first() { return this; },
      waitFor: async () => {
        assert(!/appearance-confirm/.test(selector), "appearance must not be awaited");
        if (selector.includes("water-confirm")) assert.equal(phase, "crafting", name);
        else if (selector.includes("mix-ok")) { assert.equal(phase, "confirmed", name); throw reachedMix; }
      },
      count: async () => 0,
      scrollIntoViewIfNeeded: async () => {},
      click: async () => { assert(selector.includes("water-confirm")); phase = "confirmed"; inputs.push("click"); },
      tap: async () => { assert(selector.includes("water-confirm")); phase = "confirmed"; inputs.push("tap"); },
    }),
  };
  await assert.rejects(tests.get(name).fn(page), error => error === reachedMix);
  assert.equal(observedAuto, null, "manual path must remain manual");
  assert.deepEqual(inputs, [touch ? "tap" : "click"], "confirm real water instead of cosmetics before mix");
  assert.equal(Boolean(tests.get(name).opts?.hasTouch), touch);
}
console.log("PASS: all three actual manual browser-test callbacks confirm water and reach mix without cosmetic input (touch/mouse/mouse)");
