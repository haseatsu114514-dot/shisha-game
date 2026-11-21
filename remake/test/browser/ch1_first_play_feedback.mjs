import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const id = (page, name) => page.locator(`[data-test="${name}"]`);
const hint = page => page.getByRole("button", { name: /スミさんのLIMEは今日中なら返信できます/ });
const touchOptions = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function startDaily(page, { scout = false, day = 1, resume = false } = {}) {
  await page.evaluate(async ({ scout, day, resume }) => {
    const core = await import("./js/core/state.js");
    const { DB } = await import("./js/core/data.js");
    const s = resume ? core.load() : core.newGame();
    if (!resume) {
      Object.assign(s, { phase: "daily", day, slot: 0 });
      s.flags[`_morning_${day}`] = true;
      if (scout) Object.assign(s.flags, { _errand_shop_done: true, _lemon_gift_read: true, _errand_scout_told: true });
      if (day > 1) Object.assign(s.flags, { _errand_scout_done: true, _c_station_registered: true, _delivery_adam_done: true,
        _delivery_minto_done: true, _delivery_report_done: true });
      const msg = DB.lime.find(m => m.id === "L21");
      s.inbox.push({ id: msg.id, msg, day: 1, chapter: 1, read: false, done: false, replyState: "waiting", log: [] });
    }
    (await import("./js/vn/engine.js")).vnTest.turbo = true;
    const calendar = await import("./js/daily/calendar.js");
    void calendar.runDaily({ untilDay: 4, nightEvents: {} });
  }, { scout, day, resume });
}
const ledgers = page => page.evaluate(() => {
  const { money, stamina, slot, day } = __remake.state;
  return { money, stamina, slot, day };
});
const replyState = page => page.evaluate(() => __remake.state.inbox.find(x => x.id === "L21").replyState);

await suite("ch1-first-play-feedback", async check => {
  // 本編経路と同じ桜井版。軽く押すだけの穴と、中央でしっかり押す穴を区別する。
  for (const hold of [false, true]) await check(hold ? "hole-aim-and-hold" : "hole-all-shallow", async page => {
    await page.evaluate(async () => {
      (await import("./js/core/state.js")).newGame();
      const session = await import("./js/craft/session.js");
      const { runHoles } = await import("./js/craft/holes.js");
      const { CRAFT_STEPS } = await import("./js/craft/practice.js");
      const cs = window.cs = session.newSession("tutorial");
      cs.holeTemplateId = "outer12-middle12";
      cs.availableHoleTemplateIds = ["outer12-middle12"];
      session.openBench(cs, { steps: CRAFT_STEPS });
      void runHoles(cs);
    });
    await id(page, "hole-start").waitFor();
    assert.equal(await page.locator(".bench-demo-sheet").count(), 0, "穴あけのお手本は廃止（#3815）");
    await id(page, "hole-start").click();
    await page.waitForFunction(() => document.querySelector(".countdown")?.textContent === "GO!");
    await page.locator(".countdown").waitFor({ state: "detached" });
    const stamp = id(page, "hole-feedback").locator(".stamp");
    const punch = (waitForAim, holdMs) => id(page, "hole-punch").evaluate(async (button, { waitForAim, holdMs }) => {
      if (waitForAim) {
        const needle = document.querySelector(".foil-cursor");
        const target = document.querySelector(".foil-marker.next");
        const stop = performance.now() + 3500;
        const distance = () => Math.hypot(parseFloat(needle.style.left) - parseFloat(target.style.left),
          parseFloat(needle.style.top) - parseFloat(target.style.top));
        while (distance() > 0.5 && performance.now() < stop) await new Promise(requestAnimationFrame);
        if (distance() > 0.5) throw new Error("needle did not cross the marker");
      }
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
      if (holdMs) await new Promise(resolve => setTimeout(resolve, holdMs));
      button.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
    }, { waitForAim, holdMs });
    await punch(true, hold ? 220 : 0);
    assert.equal(await stamp.innerText(), hold ? "EXCELLENT" : "浅い穴。大きく減点");
    for (let i = 1; i < 12; i++) await punch(false, 0);
    assert.equal(await stamp.innerText(), "RING COMPLETE");
    await id(page, "hole-next").click();
    for (let i = 0; i < 12; i++) await punch(false, 0);
    assert.equal(await stamp.innerText(), "RING COMPLETE");
    await id(page, "hole-done").click();
    if (!hold) {
      await id(page, "step-next").waitFor();
      const comment = id(page, "craft-feedback");
      const initial = await comment.evaluate(note => note.querySelector('.audience-page[data-on="true"]')?.textContent ?? note.textContent);
      assert.match(initial, /穴が浅い.*少し長く押せ/, "The first visible page gives Sumi's correction");
    }
    await id(page, "step-details").click();
    assert.match(await page.locator(".rc-lines").innerText(), new RegExp(`EXCELLENT ${hold ? 1 : 0}・GOOD 0`));
    assert.match(await page.locator(".rc-lines").innerText(), new RegExp(`浅い穴：${hold ? 23 : 24}回`));
    if (!hold) assert.match(await page.locator(".rc-lines li").first().innerText(), /短いタップで穴が浅くなった。少し長く押してから離そう/);
  }, hold ? {} : touchOptions);

  await check("touch-read-and-reply", async page => {
    await startDaily(page);
    await hint(page).waitFor();
    const before = await ledgers(page);
    await assertFits(page, '[data-test="lime-notice"]');
    await hint(page).tap();
    await id(page, "reply-0").tap();
    await id(page, "phone-next").tap();
    await id(page, "phone-close").tap();
    await id(page, "pin-shop").waitFor();
    assert.equal(await replyState(page), "replied");
    assert.deepEqual(await ledgers(page), before, "LIMEは代金・体力・行動枠を使わない");
  }, touchOptions);

  await check("scout-can-ignore-and-hint-is-saved", async page => {
    await startDaily(page, { scout: true });
    await hint(page).waitFor();
    const before = await ledgers(page);
    await id(page, "pin-naru").click();
    await id(page, "map-go").waitFor();
    assert.equal(await replyState(page), "waiting");
    assert.deepEqual(await ledgers(page), before, "返信を要求せず偵察へ進める");
    await page.reload();
    await id(page, "title-new").waitFor();
    await startDaily(page, { resume: true });
    await id(page, "pin-naru").waitFor();
    assert.equal(await hint(page).count(), 0, "旧セーブで一度表示した案内を再表示しない");
    await id(page, "hud-phone").click();
    await id(page, "lime-chat-sumi").click();
    await id(page, "reply-1").click();
    await id(page, "phone-next").click();
    await id(page, "phone-close").click();
    assert.equal(await replyState(page), "replied", "案内を無視してもその日の返信は可能");
    assert.deepEqual(await ledgers(page), before);
  });

  await check("day2-first-read-has-expired", async page => {
    await startDaily(page, { day: 2 });
    await id(page, "hud-phone").waitFor();
    const coach = id(page, "coach-lime");
    await coach.click();
    await id(page, "lime-chat-sumi").click();
    await page.getByText("返しそびれた", { exact: true }).waitFor();
    assert.equal(await id(page, "reply-0").count(), 0);
    assert.equal(await hint(page).count(), 0);
    assert.equal(await replyState(page), "expired");
  });
});
