// A native touch can finish the VN on pointerup, then dispatch its click to the
// button now under the finger. These fixtures enter the actual chapters' last VN.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const profile = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };
const dt = id => `[data-test="${id}"]`;
const clearPrefix = chapter => chapter === 2 ? "ch2-tournament" : "ch3-aftermath";
const lastLine = { 2: "店の明かりを落とした。", 3: "客の返事を待った。" };

async function openLastScene(page, chapter, tap = (...point) => page.touchscreen.tap(...point)) {
  await page.evaluate(async chapter => {
    const core = await import("/remake/js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { chapter, day: chapter === 2 ? 28 : 47, slot: 1, phase: chapter === 2 ? "cleared" : "aftermath" });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    state.flags = {
      _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_tokyo_invitation: true,
      _ch2_tournament: { version: 1, step: 11, stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] },
    };
    if (chapter === 3) Object.assign(state.flags, {
      _ch3_tournament_won: true, _ch3_tournament: { stage: "complete", result: { rank: 1, win: true } },
      _ch3_aftermath: { version: 4, winDay: 45, stage: 6 },
    });
    for (const id of ["ageha", "sumi", "hajime"]) state.flags[`_intro_${id}`] = true;
    core.save();
    if (chapter === 2) void (await import("/remake/js/chapters/ch2-tournament.js")).runChapterTwoTournament();
    else void (await import("/remake/js/chapters/ch3-aftermath.js")).runChapterThreeAftermath();
  }, chapter);
  if (chapter === 3) await page.locator(dt("ch3-aftermath-continue")).tap();
  const vn = page.locator("#vn.active .vn-box");
  await vn.waitFor();
  const box = await vn.boundingBox();
  assert(box);
  const point = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)];
  // The existing opening guard intentionally ignores taps for the first 320ms.
  await page.waitForTimeout(375);
  // 途中のスチル（第2章は cg_ch2_ageha_white_bear）を出している間はタップで進まない。遅い CI では絵の読み込みと表示の間に
  // 何十回も空振りするので、回数ではなく時間で打ち切り、10回ごとに少し待つ（最後の行まで届くことは今までどおり確かめる）
  const deadline = Date.now() + 30000;
  for (let n = 0; Date.now() < deadline; n++) {
    if ((await vn.innerText()).includes(lastLine[chapter])) return point;
    await tap(...point);
    if (n % 10 === 9) await page.waitForTimeout(150);
  }
  assert.fail(`Chapter ${chapter} did not reach its last line`);
}

await suite("chapter-completion-input", async check => {
  for (const [chapter, method] of [[2, "touch"], [3, "touch"], [2, "keyboard"], [3, "mouse"], [3, "forced-guard-touch"]]) {
    await check(`chapter-${chapter}-native-touch-does-not-dismiss-clear-card-then-${method}-works`, async page => {
      const point = await openLastScene(page, chapter);
      assert.equal(await page.evaluate(() => Boolean(window.__suienNoZoom)), false, "Check Chromium's native compatibility path, not the iOS guard");
      const panel = page.locator(dt(`${clearPrefix(chapter)}-complete`));
      const title = panel.locator(dt(`${clearPrefix(chapter)}-complete-title`));
      // Isolate the single tap from the earlier dialogue input.
      await page.waitForTimeout(450);
      if (method === "forced-guard-touch") await page.evaluate(async ([clientX, clientY]) => {
        // Chromium doesn't install it by default; this validates the existing module's
        // synthetic detail=1 route, not iPhone's real event ordering.
        (await import("/remake/js/core/no-zoom.js")).installNoZoom(document, { force: true });
        const target = document.elementFromPoint(clientX, clientY);
        const touch = new Touch({ identifier: 1, target, clientX, clientY });
        target.dispatchEvent(new TouchEvent("touchend", { bubbles: true, cancelable: true, changedTouches: [touch] }));
        document.addEventListener("click", e => { if (!e.isTrusted) window.qaGuardClick = e.detail; }, true);
      }, point);
      await page.touchscreen.tap(...point);
      if (method === "forced-guard-touch") assert.equal(await page.evaluate(() => window.qaGuardClick), 1);
      await panel.waitFor({ timeout: 5000 });
      assert.equal(await title.isVisible(), true);
      const b = await title.boundingBox();
      assert(b && point[0] >= b.x && point[0] <= b.x + b.width && point[1] >= b.y && point[1] <= b.y + b.height,
        "The old VN target must overlap the newly mounted title button");
      // CDP's full touch sequence includes Chromium's trusted compatibility click;
      // surviving at this point does not require a delay before a new intentional gesture.
      if (method.endsWith("touch")) await title.tap();
      else if (method === "mouse") await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      else { await title.focus(); await page.keyboard.press("Enter"); }
      await page.locator(dt("title-load")).waitFor();
      assert(await page.locator(dt("title-load")).isEnabled(), "Title return still preserves the cleared autosave");
    }, profile);
  }
  for (const chapter of [3, 2]) {
    await check(`chapter-${chapter}-rapid-touch-stays-on-clear-card-and-next-works`, async page => {
      // Drive Chromium's native touch path with a fixed input cadence even if the host stalls.
      const cdp = await page.context().newCDPSession(page);
      let timestamp = Date.now() / 1000;
      const tap = async (x, y) => {
        await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }], timestamp });
        await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [], timestamp: timestamp + 0.02 });
        timestamp += 0.1;
      };
      const point = await openLastScene(page, chapter, tap);
      const prefix = clearPrefix(chapter);
      const panel = page.locator(dt(`${prefix}-complete`));
      const title = panel.locator(dt(`${prefix}-complete-title`));
      await page.evaluate(id => {
        window.qaCardTouches = 0;
        document.addEventListener("pointerdown", e => {
          if (e.isTrusted && e.pointerType === "touch" && e.target.closest("button")?.dataset.test === id)
            window.qaCardTouches++;
        }, true);
      }, `${prefix}-complete-title`);
      // Keep tapping through the transition, including chapter 2's closing CG fade.
      for (let n = 0; n < 16; n++) {
        await tap(...point);
        if (await page.evaluate(() => window.qaCardTouches >= 2)) break;
        await page.waitForTimeout(75);
      }
      assert(await title.isVisible(), "The burst must leave the clear card open");
      assert(await page.evaluate(() => window.qaCardTouches >= 2), "Fresh touches must land on the title button");
      await page.evaluate(async () => { (await import("/remake/js/vn/engine.js")).vnTest.turbo = true; });
      await panel.locator(dt(`${prefix}-chapter-${chapter === 2 ? "three" : "four"}`)).tap();
      await page.waitForFunction(next => window.__remake.state.chapter === next, chapter + 1);
    }, profile);
  }
});
