import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { appearanceOptions } from "../../js/appearance/model.js";

const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
const catalogPath = "asset_sources/shisha-hardware-reference/skin-candidates-issue374/candidates.json";

// Sparse CI checkouts omit asset_sources. Supply only the actual canonical JSON
// already in this checkout's HEAD; never download artwork or invent a fixture catalog.
export function prepareAppearanceCatalog(root = repositoryRoot) {
  const target = path.join(root, catalogPath);
  const git = args => execFileSync("git", ["--no-replace-objects", "-C", root, ...args], {
    encoding: "utf8", maxBuffer: 256 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: "1" },
  });
  if (fs.realpathSync(root) !== fs.realpathSync(git(["rev-parse", "--show-toplevel"]).trim())) {
    throw new Error("Appearance catalog must come from this checkout, not a parent repository");
  }
  if (fs.existsSync(target)) return; // Preserve existing source bytes, including local work.
  // An explicit Git option fails closed on older Git before object access.
  // Do not rely on GIT_NO_LAZY_FETCH, which older Git may silently ignore.
  const text = git(["--no-lazy-fetch", "show", `HEAD:${catalogPath}`]);
  appearanceOptions(JSON.parse(text)); // Missing/invalid real source is still a failure.
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text, { flag: "wx" });
}

// Setup now continues directly to water/mix. A missing next step is still an error.
export async function waitForSetupContinuation(page) {
  await page.locator('.bench [data-test="water-confirm"], .bench [data-test="mix-ok"]').first().waitFor({ state: "visible" });
  if (await page.locator('.bench [data-test="appearance-confirm"]').count()) {
    throw new Error("Appearance must not block ordinary crafting");
  }
}

// Compatibility for callers in pending craft-test PRs (#870/#886).
export const confirmAppearanceSetup = waitForSetupContinuation;

// Manual full-craft callers must also operate the real water step before mix.
export async function confirmSetupWater(page, { touch = false } = {}) {
  await waitForSetupContinuation(page);
  const confirm = page.locator('.bench [data-test="water-confirm"]');
  await confirm.waitFor({ state: "visible" });
  await confirm.scrollIntoViewIfNeeded();
  if (touch) await confirm.tap(); else await confirm.click();
}
