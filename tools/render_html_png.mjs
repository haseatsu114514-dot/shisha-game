// ローカルのHTMLをPNGに書き出す（資料シート用）。
//   node tools/render_html_png.mjs <in.html> <out.png> [--select "#id" <out2.png>]...
// --select を付けると、その要素だけを切り出したPNGも出力する。
// Playwright のChromiumを使う。見つからなければ CHROME_EXECUTABLE_PATH で指定する。
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
let chromium;
for (const p of ["playwright", "/opt/node-tools/node_modules/playwright"]) {
  try { ({ chromium } = require(p)); break; } catch { /* 次の候補へ */ }
}
if (!chromium) throw new Error("playwright が見つからない（npm i -D playwright 等）");

const [input, output, ...rest] = process.argv.slice(2);
if (!input || !output) {
  console.error("usage: node tools/render_html_png.mjs <in.html> <out.png> [--select <selector> <out.png>]...");
  process.exit(1);
}
const selects = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i] === "--select") { selects.push([rest[i + 1], rest[i + 2]]); i += 2; }
}

const browser = await chromium.launch(
  process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 2400, height: 1200 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.resolve(input)).href);
await page.evaluate(() => document.fonts.ready);
await page.waitForLoadState("networkidle");
await page.screenshot({ path: output, fullPage: true });
console.log("wrote", output);
for (const [sel, out] of selects) {
  await page.locator(sel).screenshot({ path: out });
  console.log("wrote", out, `(${sel})`);
}
await browser.close();
