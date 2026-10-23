// node --experimental-vm-modules remake/test/appearance_setup_helper.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { confirmAppearanceSetup, prepareAppearanceCatalog } from "./browser/appearance_setup.mjs";

for (const touch of [false, true]) {
  const calls = [];
  let ready = false;
  const page = { locator: selector => {
    assert.equal(selector, '[data-test="appearance-confirm"]');
    return {
      waitFor: async options => { assert.deepEqual(options, { state: "visible" }); ready = true; calls.push("visible"); },
      scrollIntoViewIfNeeded: async () => { assert(ready); calls.push("scroll"); },
      click: async () => { assert(ready); calls.push("click"); },
      tap: async () => { assert(ready); calls.push("tap"); },
    };
  } };
  await confirmAppearanceSetup(page, { touch });
  assert.deepEqual(calls, ["visible", "scroll", touch ? "tap" : "click"]);
}
let clicked = false;
const missing = { locator: () => ({ waitFor: async () => { throw new Error("chooser missing"); },
  click: async () => { clicked = true; }, tap: async () => { clicked = true; } }) };
await assert.rejects(confirmAppearanceSetup(missing), /chooser missing/);
assert.equal(clicked, false, "a missing chooser/catalog must fail, not be skipped");
console.log("PASS: appearance setup helper performs ordered mouse/touch input and preserves missing-chooser failures");

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
    : { confirmAppearanceSetup, prepareAppearanceCatalog: () => {} };
  return new vm.SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await leaves.evaluate();
for (const [name, touch] of [["hidden-menu-not-clickable-on-bench", true], ["mix-capped-by-own-leaves", false], ["reload-mid-bench-keeps-save", false]]) {
  let phase = "home", observedAuto;
  const inputs = [], reachedMix = new Error("mix boundary reached");
  const page = {
    evaluate: async (_fn, args) => { if (args) observedAuto = args.auto; },
    locator: selector => ({
      waitFor: async () => {
        if (selector.includes("appearance-confirm")) assert.equal(phase, "chooser");
        if (selector.includes("mix-ok")) { assert.equal(phase, "confirmed", name); throw reachedMix; }
      },
      scrollIntoViewIfNeeded: async () => {},
      click: async () => { if (selector.includes("home-practice-full")) phase = "chooser"; else { phase = "confirmed"; inputs.push("click"); } },
      tap: async () => { assert(selector.includes("appearance-confirm")); phase = "confirmed"; inputs.push("tap"); },
    }),
  };
  await assert.rejects(tests.get(name).fn(page), error => error === reachedMix);
  assert.equal(observedAuto, null, "manual path must remain manual");
  assert.deepEqual(inputs, [touch ? "tap" : "click"]);
  assert.equal(Boolean(tests.get(name).opts?.hasTouch), touch);
}
console.log("PASS: all three actual manual browser-test callbacks confirm appearance before mix (touch/mouse/mouse)");
