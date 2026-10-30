import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const pageErrors = [];
  const consoleMessages = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("console", message => consoleMessages.push({ type: message.type(), text: message.text() }));

  const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
  await page.goto(`${baseUrl}test/reel_visuals.html`);
  let waitError = "";
  try {
    await page.waitForFunction(() => document.body?.dataset.result, null, { timeout: 240000 });
  } catch (error) {
    waitError = error.message;
  }

  const result = await page.evaluate(() => document.body?.dataset.result);
  const checks = await page.locator("#checks").textContent().catch(() => "#checks unavailable");
  const warnings = consoleMessages.filter(message => message.type === "warning").map(message => message.text);
  const relevantConsole = consoleMessages.filter(message =>
    message.type === "warning" || message.type === "error" ||
    message.text.includes("[reel") || message.text.includes("reel-visuals"));
  const diagnostics = [
    `result=${result ?? "unset"}`,
    `#checks=${checks}`,
    `console.warn=${JSON.stringify(warnings)}`,
    `pageerrors=${JSON.stringify(pageErrors)}`,
    `console=${JSON.stringify(relevantConsole)}`,
    ...(waitError ? [`waitError=${waitError}`] : []),
  ].join("\n");
  assert.ok(result === "pass" && pageErrors.length === 0 && !waitError, diagnostics);
  const passLines = consoleMessages.filter(message => message.text.includes("[reel-visuals] PASS"));
  console.log(`reel-visuals: PASS\n${passLines.map(message => message.text).join("\n")}`);
} finally {
  await browser.close();
}
