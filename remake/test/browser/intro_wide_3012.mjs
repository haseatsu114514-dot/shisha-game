import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  await page.setContent(`<div id="stage" data-wide style="--stage-w:1600px;--k:.5">
    <div id="fx"><div class="cutin art-intro in" data-art="graphic" data-char="hajime">
      <div class="ci-art-background"></div><div class="ci-art-veil"></div>
      <div class="ci-ribbon"></div><div class="ci-accent-line"></div>
    </div></div></div>`);
  await page.addStyleTag({ path: `${root}remake/css/base.css` });
  await page.addStyleTag({ path: `${root}remake/css/vn.css` });
  await page.addStyleTag({ path: `${root}remake/css/intro.css` });
  const geometry = await page.evaluate(() => {
    const rect = selector => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, right: r.right, width: r.width };
    };
    return { stage: rect("#stage"), background: rect(".ci-art-background"),
      veil: rect(".ci-art-veil"), ribbon: rect(".ci-ribbon"), accent: rect(".ci-accent-line"),
      overflow: getComputedStyle(document.querySelector(".cutin")).overflow };
  });
  assert.equal(geometry.overflow, "visible");
  for (const part of ["background", "veil", "ribbon", "accent"]) {
    assert(geometry[part].left <= geometry.stage.left + 1, `${part}: ${JSON.stringify(geometry)}`);
    assert(geometry[part].right >= geometry.stage.right - 1, `${part}: ${JSON.stringify(geometry)}`);
  }
  console.log("intro-wide-3012: background and graphic bands cover the full wide stage");

// #3035: 帯をガターへ延長しても、帯の中の名前欄は中央1280の組版位置から動かないこと。
// ワイド時と通常時で「カットイン左端から名前までの距離」が一致するのを、両絵柄で確認する。
async function nameOffset(page, { wide, art }) {
  await page.setContent(`<div id="stage" ${wide ? "data-wide" : ""} style="--stage-w:${wide ? 1600 : 1280}px;--k:.5">
    <div id="fx"><div class="intro-fit-surface">
      <div class="cutin art-intro intro-fitted" ${art ? `data-art="${art}"` : ""}>
        <div class="ci-ribbon"><div class="ci-art-meta">
          <div class="ci-name-line"><span class="ci-name" style="font-size:116px">炭吉丈一郎</span></div>
        </div></div>
      </div>
    </div></div></div>`);
  for (const css of ["base.css", "vn.css", "intro.css"]) await page.addStyleTag({ path: `${root}remake/css/${css}` });
  return page.evaluate(() => {
    const cutin = document.querySelector(".cutin").getBoundingClientRect();
    const name = document.querySelector(".ci-name").getBoundingClientRect();
    return name.left - cutin.left;
  });
}
{
  const page = await browser.newPage({ viewport: { width: 844, height: 390 } });
  for (const art of ["graphic", null]) {
    const normal = await nameOffset(page, { wide: false, art });
    const wide = await nameOffset(page, { wide: true, art });
    assert(Math.abs(wide - normal) <= 3, `名前欄がワイドでずれた (${art || "classic"}): 通常 ${normal} / ワイド ${wide}`);
  }
  console.log("intro-wide-3035: name block keeps its conventional position in wide mode");
  await page.close();
}
} finally {
  await browser.close();
}
