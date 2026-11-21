// #2444 観察4（#3198 §3）: 初登場カットインの絵・書体を待つ間も、会話のほかの待ち（ch1_loading.mjs）と同じに扱う。
// - 送った後は前の行の▼を出さず、送りの入力で行を飛ばさない
// - 待ちが長いと「場面を準備しています…」を出し、絵が届いたら外す
// - 紹介の絵は、本人が話した時点で取り始める（読んでいる間に届けば、送った後に待たない）
// 本人が話した後の紹介（読み進めて出す紹介）と、台本の intro 行で出す紹介（はじめ）の両方を見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const INTRO_ART = /\/img\/ui\/character_intros\//;

/** 紹介の絵を止めておく。届いた依頼の URL を記録し、release() で通す */
async function holdIntroArt(page) {
  const asked = [];
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  await page.route(INTRO_ART, async (route) => {
    asked.push(new URL(route.request().url()).pathname);
    await held;
    await route.continue();
  });
  return { asked, release: () => release() };
}

async function start(page, lines) {
  await page.evaluate(async (lines) => {
    const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js");
    const vn = await import("./js/vn/engine.js");
    core.newGame();
    Object.assign(core.config, { textSpeed: 4, skipSeenOnly: false, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    vn.vnTest.turbo = false;
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_tonari_inside_day"), { instant: true });
    // 立ち絵は先に読んでおく（ここで見るのは紹介の絵の待ちだけ）
    await ui.imageReady(data.portraitInfo("sumi", "normal").src, 15000);
    window.W = { core, lines: [], done: false };
    vn.hooks.onLine = (id, line) => W.lines.push(line.text);
    W.play = vn.play({ dialogue_id: "intro_wait_2444", lines }).then((result) => { W.done = true; return result; });
  }, lines);
}

/** 紹介の絵を止めた間に送っても、▼が出ず・読み込みの表示が出て・行が進まないことを確かめ、通した後に紹介と次の行を見る */
async function assertPendingIntro(page, { art, char, advance, before, after }) {
  await advance();
  assert.equal(await page.locator(".vn-next.show").count(), 0, "紹介の待ちの間、前の行の▼を出さない");
  await page.locator('[data-test="vn-loading"]').waitFor();
  for (let i = 0; i < 4; i++) await advance();
  assert.deepEqual(await page.evaluate(() => W.lines), before, "紹介の待ちの間の入力で、次の行へ進まない");
  assert.equal(await page.locator(".cutin").count(), 0);
  art.release();
  await page.locator(`.cutin[data-char="${char}"]`).waitFor();
  assert.equal(await page.locator('[data-test="vn-loading"]').count(), 0, "紹介の絵が届いたら、読み込みの表示を外す");
  await page.locator(".cutin").waitFor({ state: "detached", timeout: 15000 });
  await page.locator(".vn-next.show").waitFor();
  assert.deepEqual(await page.evaluate(() => W.lines), after);
}

await suite("intro-wait-2444", async (check) => {
  for (const [device, options] of [
    ["pc", {}],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${device}-first-line-intro-art-pending`, async (page) => {
      const art = await holdIntroArt(page);
      const advance = () => (device === "touch" ? page.locator(".vn-box").tap() : page.keyboard.press("Enter"));
      try {
        await start(page, [
          { speaker: "sumi", face: "normal", text: "初めて話す行。" },
          { text: "紹介の後の行。" },
          { type: "choice", choices: [{ text: "終える" }] },
        ]);
        await page.locator(".vn-next.show").waitFor();
        assert.equal(await page.locator(".vn-text").innerText(), "初めて話す行。");
        // 送る前（本人の行を読んでいる間）に、紹介の絵を取り始めている
        for (let i = 0; i < 40 && !art.asked.length; i++) await page.waitForTimeout(50);
        assert(art.asked.length > 0, "本人が話した時点で、紹介の絵を取り始める");
        await assertPendingIntro(page, { art, char: "sumi", advance,
          before: ["初めて話す行。"], after: ["初めて話す行。", "紹介の後の行。"] });
        assert.equal(await page.locator(".vn-text").innerText(), "紹介の後の行。");
        assert.equal(await page.evaluate(() => W.core.state.flags._intro_sumi), true);
      } finally { art.release(); }
      await advance();
      await page.locator('[data-test="choice-0"]').click();
      await page.waitForFunction(() => W.done);
    }, options);
  }

  await check("pc-intro-line-art-pending", async (page) => {
    const art = await holdIntroArt(page);
    const advance = () => page.keyboard.press("Enter");
    try {
      await start(page, [
        { text: "紹介の前の行。" },
        { type: "intro", char_id: "hajime" },
        { text: "紹介の後の行。" },
        { type: "choice", choices: [{ text: "終える" }] },
      ]);
      await page.locator(".vn-next.show").waitFor();
      await assertPendingIntro(page, { art, char: "hajime", advance,
        before: ["紹介の前の行。"], after: ["紹介の前の行。", "紹介の後の行。"] });
      assert.equal(await page.evaluate(() => W.core.state.flags._intro_hajime), true);
    } finally { art.release(); }
    await advance();
    await page.locator('[data-test="choice-0"]').click();
    await page.waitForFunction(() => W.done);
  });
});
