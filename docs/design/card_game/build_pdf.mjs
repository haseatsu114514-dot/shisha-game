// rulebook.html（第0.8版）を A4 の PDF にする。出力は ichidai_shobu_rulebook_v0.8.pdf。
// 使い方: node build_pdf.mjs [書体フォルダ] [出力先]
//   書体フォルダには @fontsource/noto-sans-jp と @fontsource/zen-antique を展開しておく
//   （`npm pack @fontsource/noto-sans-jp @fontsource/zen-antique` を展開したもの。リポジトリには入れない）。
//   省略すると端末にある書体で組む。
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const { chromium } = createRequire(import.meta.url)('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const fontDir = process.argv[2];
const out = process.argv[3] || path.join(here, 'ichidai_shobu_rulebook_v0.8.pdf');

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(pathToFileURL(path.join(here, 'rulebook.html')).href);
if (fontDir) {
  for (const css of ['fontsource-noto-sans-jp/package/400.css', 'fontsource-noto-sans-jp/package/700.css', 'fontsource-noto-sans-jp/package/900.css', 'fontsource-zen-antique/package/400.css']) {
    const p = path.join(fontDir, css);
    if (fs.existsSync(p)) await page.addStyleTag({ url: pathToFileURL(p).href });
    else console.warn('書体が見つからない:', p);
  }
}
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(1500);
await page.evaluate(() => document.fonts.ready);
// 1ページからはみ出した箇所を知らせる
const over = await page.evaluate(() => [...document.querySelectorAll('.page')].map((p, i) => {
  if (p.classList.contains('cover')) return null;
  const bottom = p.getBoundingClientRect().bottom - 17 * 3.7795;
  let worst = 0;
  p.querySelectorAll(':scope > :not(.pno):not(.run)').forEach((el) => { worst = Math.max(worst, el.getBoundingClientRect().bottom - bottom); });
  return worst > 1 ? `p${i + 1}: ${Math.round(worst / 3.7795)}mm はみ出し` : null;
}).filter(Boolean));
if (over.length) console.warn(over.join('\n'));
await page.pdf({ path: out, format: 'A4', printBackground: true, preferCSSPageSize: true });
await browser.close();
console.log('wrote', out);
