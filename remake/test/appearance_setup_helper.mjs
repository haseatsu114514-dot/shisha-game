// node remake/test/appearance_setup_helper.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
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
  fs.unlinkSync(target); prepareAppearanceCatalog(temp);
  assert.equal(fs.readFileSync(target, "utf8"), actual, "restore canonical bytes from current HEAD");
  assert.equal(git(["rev-parse", "HEAD"]), before);
  fs.writeFileSync(target, "preserve existing work"); prepareAppearanceCatalog(temp);
  assert.equal(fs.readFileSync(target, "utf8"), "preserve existing work");
  const child = path.join(temp, "child"); fs.mkdirSync(child);
  assert.throws(() => prepareAppearanceCatalog(child), /not a parent repository/);
  console.log("PASS: exact HEAD catalog staging without overwrite, remote access or parent repository fallback");
} finally { fs.rmSync(temp, { recursive: true, force: true }); }
