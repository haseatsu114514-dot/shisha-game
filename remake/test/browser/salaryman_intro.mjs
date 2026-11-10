// The first visit is silent: the cut-in follows his portrait before the order choice.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");

const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const vn = await import("./js/vn/engine.js");
    (await import("./js/core/ui.js")).clearScreen();
    core.newGame();
    core.config.portraitStyle = "new";
    core.config.introArtStyle = "graphic";
    core.config.textSpeed = 4;
    core.state.met.sumi = true;
    core.state.flags._intro_sumi = true;
    window.T = { core, vn };
    window.sceneDone = false;
    vn.play("ch1_salaryman_regular").then(() => { window.sceneDone = true; });
  });
  let found = false;
  for (let i = 0; i < 100; i++) {
    if (await page.locator('.cutin.in[data-char="salaryman"]').count()) { found = true; break; }
    assert.equal(await page.evaluate(() => window.sceneDone), false, "scene ended before salaryman cut-in");
    if (await page.locator(".vn-choices button").count()) {
      assert.fail("order choice appeared before silent arrival cut-in");
    }
    if (await page.locator(".vn-next.show").count()) await page.locator(".vn-box").click();
    else await page.waitForTimeout(100);
  }
  assert(found, "salaryman cut-in did not appear on first visit");
  const media = await page.evaluate(() => {
    const portrait = document.querySelector('.cutin[data-char="salaryman"] img.ci-portrait');
    const background = document.querySelector('.cutin[data-char="salaryman"] img.ci-art-background');
    return { portrait: portrait?.getAttribute("src"), portraitReady: !!portrait?.naturalWidth,
      background: background?.getAttribute("src"), backgroundReady: !!background?.naturalWidth,
      seen: !!T.core.state.flags._intro_salaryman };
  });
  assert.match(media.portrait, /character_intros\/graphic\/salaryman\.webp$/);
  assert.match(media.background, /character_intros\/graphic\/bg_salaryman\.webp$/);
  assert(media.portraitReady && media.backgroundReady && media.seen, JSON.stringify(media));
  assert.deepEqual(errors, []);
  console.log("salaryman_intro: silent first visit shows graphic cut-in before choice");
} finally {
  await browser.close();
}
