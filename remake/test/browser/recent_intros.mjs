import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const ids = ["kuze", "steve", "volk", "mashiro", "maki", "sai", "uranaishi"];
const shots = process.env.ARTIFACT_DIR || "work/recent-intros";
await mkdir(shots, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.locator('[data-test="title-new"]').waitFor();
  await page.evaluate(async () => {
    window.T = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      intro: await import("./js/vn/intro.js"), ui: await import("./js/core/ui.js") };
    T.core.newGame();
    T.core.config.bgmVolume = 0;
    T.core.config.seVolume = 0;
  });
  for (const id of ids) {
    await page.evaluate(id => {
      if (T.intro.needsIntro(id)) throw new Error(`${id}: 面識前に名前を開示した`);
      T.core.markMet(id);
      if (!T.intro.needsIntro(id)) throw new Error(`${id}: 初登場が登録されていない`);
      T.done = T.intro.playIntro(id);
    }, id);
    await page.locator(`.cutin.art-intro.in[data-char="${id}"]`).waitFor();
    await page.waitForTimeout(1400);
    const result = await page.evaluate(id => {
      const host = document.querySelector(".cutin"), outer = host.getBoundingClientRect();
      const c = T.data.DB.characters[id];
      return {
        name: host.querySelector(".ci-name").textContent,
        expectedName: T.data.realName(id),
        title: host.querySelector(".ci-title").textContent,
        quote: host.querySelector(".ci-line").textContent,
        expectedTitle: c.intro_cutin.title, expectedQuote: `「${c.intro_cutin.line}」`,
        images: [...host.querySelectorAll("img")].every(im => im.complete && im.naturalWidth > 0),
        fits: [".ci-name", ".ci-title", ".ci-line"].every(selector => {
          const box = host.querySelector(selector).getBoundingClientRect();
          return box.left >= outer.left && box.right <= outer.right - 35 && box.top >= outer.top && box.bottom <= outer.bottom;
        }),
      };
    }, id);
    assert.equal(result.name, result.expectedName);
    assert.equal(result.title, result.expectedTitle);
    assert.equal(result.quote, result.expectedQuote);
    assert(result.images && result.fits, `${id}: 画像未読込または文字のはみ出し`);
    assert(!/シガーマン|幼なじみ|偵察/.test(result.title + result.quote), "秘密を先に開示した");
    await page.locator(".cutin").screenshot({ path: `${shots}/${id}.png` });
    await page.locator(".cutin").click(); await page.keyboard.press("Enter");
    assert.equal(await page.locator(".cutin:not(.out)").count(), 1, "初登場を短縮できてしまう");
    await page.evaluate(() => T.done);
    assert.equal(await page.evaluate(id => T.intro.needsIntro(id), id), false);
  }
  // 小画面と動きを減らす設定。最も長い呼び名も画面内に収める。
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { T.done = T.intro.playIntro("uranaishi"); });
    await page.locator(".cutin.in").waitFor();
    assert(await page.evaluate(() => {
      const host = document.querySelector(".cutin");
      return host.getAnimations({ subtree: true }).length === 0 &&
        [".ci-name", ".ci-title", ".ci-line"].every(selector => {
          const b = host.querySelector(selector).getBoundingClientRect();
          return b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight;
        });
    }));
    await page.screenshot({ path: `${shots}/mobile-${viewport.width}.png` });
    await page.evaluate(() => T.done);
  }
  await page.evaluate(() => { T.core.save(); T.core.load(); });
  assert(await page.evaluate(ids => ids.every(id => T.core.state.flags[T.intro.introSeenKey(id)] && !T.intro.needsIntro(id)), ids));
  // 会話VNを通らない案内役も、本当の入店経路で一度だけ表示。無料入店の収支は維持する。
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const id of ["maki", "sai"]) {
    await page.evaluate(id => {
      const s = T.core.newGame();
      Object.assign(s, { chapter: 2, day: 16, slot: id === "maki" ? 1 : 0, phase: "daily", money: 15000, stamina: 80 });
      Object.assign(s.flags, { _axe_bar_rumor_done: true, _axe_bar_sighting_done: true, _rei_trpg_introduced: true });
      T.before = [s.money, s.stamina, s.slot, s.day];
      T.open = async () => id === "maki"
        ? (await import("./js/daily/axe-bar.js")).visitAxeBar()
        : (await import("./js/daily/trpg.js")).openTrpgBar();
      T.visit = T.open();
    }, id);
    await page.locator(`.cutin.in[data-char="${id}"]`).waitFor();
    assert.equal(await page.locator(".cutin .ci-name").textContent(), id === "maki" ? "斧崎マキ" : "六角サイ");
    await page.locator(".cutin").waitFor({ state: "detached" });
    const host = `[data-test="venue-host-${id}"]`;
    await page.locator(host).waitFor();
    assert(await page.evaluate(id => {
      const s = T.core.state;
      return s.met[id] && s.flags[T.intro.introSeenKey(id)]
        && T.data.displayName(id, s) !== "？？？"
        && JSON.stringify([s.money, s.stamina, s.slot, s.day]) === JSON.stringify(T.before);
    }, id));
    const back = id === "maki" ? '[data-test="axe-bar-back"]' : '[data-test="trpg-campaign-close"]';
    await page.locator(back).click(); await page.evaluate(() => T.visit);
    await page.evaluate(() => { T.visit = T.open(); });
    await page.locator(host).waitFor();
    assert.equal(await page.locator(".cutin").count(), 0, "再入店で紹介が繰り返された");
    await page.locator(back).click(); await page.evaluate(() => T.visit);
  }
  assert.deepEqual(errors, []);
  console.log("PASS recent_intros: 7人の実画像・正本文言・匿名維持・短縮不可・既読保存・横/縦の静止表示・店主の実入店経路");
} finally { await browser.close(); }
