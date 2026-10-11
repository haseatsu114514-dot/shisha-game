// 初回タイトル（裏の先読み込みを含む）・開始直後・キャッシュのある再訪の実通信量。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/tools/measure_load.mjs <report.json>
// 章全体は LOAD_REPORT=<report.json> CHROME_BIN=... node remake/test/playthrough.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { recordLoad } from "./load-recorder.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const file = process.argv[2] || "/tmp/shisha-load.json";
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const load = await recordLoad(page, base);
  const openTitle = async () => {
    await page.goto(base);
    await page.waitForSelector('[data-test="title-new"]');
    await load.settle();
  };
  await openTitle();
  load.snapshot("first-title-with-prefetch");
  await page.locator('[data-test="title-new"]').click();
  await page.waitForSelector("#vn.active");
  await load.settle();
  load.snapshot("opening");
  await openTitle();
  load.snapshot("revisit-title");
  load.write(file, {
    sourceCommit: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    browser: browser.version(), viewport: "1280x720", errors,
    scope: "fresh browser context, title and all automatic prefetch; NEW GAME opening; normal return to title in the same browser context with cache enabled; snapshots are cumulative.",
  });
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(`Load report: ${file}`);
} finally { await browser.close(); }
