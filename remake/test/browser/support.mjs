import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../", import.meta.url));
export const baseURL = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const artifacts = path.resolve(root, process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");

// Each case uses a new browser context: no existing player's storage is opened.
export async function suite(name, run) {
  fs.mkdirSync(artifacts, { recursive: true });
  const results = [];
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
  });
  async function check(label, body, options = {}) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
    const page = await context.newPage();
    const errors = [];
    const failedResources = [];
    page.setDefaultTimeout(10000);
    page.on("pageerror", error => errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400) failedResources.push(`${response.status()} ${response.url()}`);
    });
    page.on("requestfailed", request => {
      // Navigating/reloading can cancel the title's background warm-up requests.
      if (!/ERR_ABORTED/.test(request.failure()?.errorText || "")) {
        failedResources.push(`${request.failure()?.errorText} ${request.url()}`);
      }
    });
    const prefix = path.join(artifacts, `${name}-${label}`);
    try {
      await page.goto(baseURL, { waitUntil: "load" });
      // 起動時は書体と選んだタイトル画像を待つ。工程中の操作とは別の上限。
      await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
      await page.locator("#boot").waitFor({ state: "detached" });
      await body(page);
      assert.deepEqual(errors, [], "Unexpected browser errors");
      assert.deepEqual(failedResources, [], "Failed resource requests");
      await page.screenshot({ path: `${prefix}.png` });
      results.push({ label, status: "passed" });
      console.log(`[${name}] PASS: ${label}`);
    } catch (error) {
      results.push({ label, status: "failed", error: error.stack || String(error), errors, failedResources });
      await page.screenshot({ path: `${prefix}-failed.png` }).catch(() => {});
      console.error(`[${name}] FAIL: ${label}\n${error.stack || error}`);
    } finally {
      await context.close();
    }
  }
  try {
    await run(check);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(artifacts, `${name}.json`), JSON.stringify({
      name, baseURL, ref: process.env.TEST_REF || null, results,
    }, null, 2) + "\n");
  }
  assert(results.length > 0, "No browser cases were selected");
  assert.equal(results.filter(result => result.status === "failed").length, 0, `${name}: failed browser cases`);
}

export async function storageSnapshot(page) {
  return page.evaluate(() => {
    const copy = storage => Object.fromEntries(Object.keys(storage).sort().map(key => [key, storage.getItem(key)]));
    return { local: copy(localStorage), session: copy(sessionStorage) };
  });
}

export async function assertFits(page, selector) {
  const results = await page.locator(selector).evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return nodes.map(node => {
      const r = node.getBoundingClientRect();
      return { text: node.textContent.trim(),
        visible: r.width > 0 && r.height > 0,
        contained: r.left >= stage.left - 1 && r.top >= stage.top - 1
          && r.right <= stage.right + 1 && r.bottom <= stage.bottom + 1
          && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1,
        textFits: node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1 };
    });
  });
  assert(results.length > 0, `Missing layout target: ${selector}`);
  for (const result of results) {
    assert(result.visible && result.contained && result.textFits, `Clipped control: ${JSON.stringify(result)}`);
  }
}
