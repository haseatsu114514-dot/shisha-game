// Observe the existing complete chapter-one test without editing its other-worker source.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const seen = new Set();
const launch = chromium.launch.bind(chromium);
chromium.launch = async (...args) => {
  const browser = await launch(...args), newPage = browser.newPage.bind(browser);
  browser.newPage = async (...options) => {
    const page = await newPage(...options);
    await page.exposeBinding("reportCgGallery", (_source, ids) => { ids.forEach(id => seen.add(id)); });
    await page.addInitScript(() => {
      const setItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        setItem.call(this, key, value);
        if (key === "suien_remake_gallery") void window.reportCgGallery(JSON.parse(value));
      };
    });
    return page;
  };
  return browser;
};
await import("./playthrough.mjs");
const expected = ["cg_oneesan_first_smoke", "cg_ch1_sumi_training", "cg_ch1_tsumugi_heart_art",
  "cg_ch1_tournament_battle", "cg_ch1_nagumo_smile", "cg_ch1_dr_kemuri_hook"];
const missing = expected.filter(id => !seen.has(id));
const output = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/ch1-cg-art");
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, "ch1-cg-natural-progress.json"), JSON.stringify({ expected, seen: [...seen].sort(), missing }, null, 2) + "\n");
assert.deepEqual(missing, [], "Reachable chapter-one CGs not recorded during full natural playthrough");
console.log("[ch1-cg-natural-progress] PASS:", expected.length, "adopted CGs recorded in actual chapter-one progression");
