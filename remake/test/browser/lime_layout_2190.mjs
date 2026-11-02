// #2190 P12/P19: production LIME at the reported desktop size and horizontal touch size.
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

async function open(page, { id, money = 30000, read = false }) {
  await page.evaluate(async ({ id, money, read }) => {
    const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
    const phone = await import("./js/daily/phone.js");
    const s = core.newGame();
    Object.assign(s, { chapter: 1, day: id === "lime_minto_day4" ? 4 : 10,
      slot: 0, phase: "daily", money });
    Object.assign(s.flags, { _lime_tut: 1, _lime_opened: true, known_name_minto: true });
    const m = structuredClone(data.DB.lime.find(m => m.id === id));
    s.met[m.sender] = true; s.contacts.push(m.sender);
    s.inbox = [{ id, originId: id, day: s.day, chapter: 1, msg: m,
      read, done: false, replyState: "waiting", log: [] }];
    s.limeRead = read ? [id] : [];
    core.save(); core.load();
    (await import("./js/core/ui.js")).showScreen("map");
    window.LayoutQA = { core, phone };
    void phone.openLime({ sender: m.sender });
  }, { id, money, read });
  await page.locator('[data-test="reply-2"]').waitFor({ state: "visible" });
  assert.equal(await page.locator("body").getAttribute("data-screen"), "map");
  assert.equal(await page.locator("body").evaluate(body => body.classList.contains("game-ds")), false, "normal landscape layout only; DS development is paused");
}

async function assertEndVisible(page, selector) {
  const result = await page.evaluate(selector => {
    const chat = document.querySelector(".lime-chat"), actions = document.querySelector(".lime-actions");
    const nodes = chat.querySelectorAll(selector), last = nodes[nodes.length - 1];
    const c = chat.getBoundingClientRect(), a = actions.getBoundingClientRect(), r = last.getBoundingClientRect();
    return { lastTop: r.top, lastBottom: r.bottom, chatTop: c.top, chatBottom: c.bottom,
      actionsTop: a.top, remaining: chat.scrollHeight - chat.clientHeight - chat.scrollTop };
  }, selector);
  assert(result.lastTop >= result.chatTop - 1, JSON.stringify(result));
  assert(result.lastBottom <= result.chatBottom + 1, JSON.stringify(result));
  assert(result.chatBottom <= result.actionsTop + 1, JSON.stringify(result));
  assert(result.remaining <= 2, "last message is visible without an extra scroll after replies appear");
}

await suite("lime-layout-2190", async check => {
  for (const [device, options] of [
    ["pc", { viewport: { width: 1180, height: 740 } }],
    ["landscape-touch", { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true }],
  ]) {
    for (const money of [30000, 0]) await check(`layout-${device}-invitation-cost-${money ? "affordable" : "shortfall"}`, async page => {
      await open(page, { id: "lime_minto_day4", money });
      const go = page.locator('[data-test="reply-0"]');
      assert.match(await go.textContent(), /3,000円必要/);
      assert.equal(await go.isDisabled(), money === 0);
      const fit = await go.evaluate(node => {
        const range = document.createRange(); range.selectNodeContents(node);
        const box = node.getBoundingClientRect(), style = getComputedStyle(node);
        return { whiteSpace: style.whiteSpace, overflow: node.scrollWidth > node.clientWidth + 1,
          clippedVertically: node.scrollHeight > node.clientHeight + 1,
          textInside: [...range.getClientRects()].every(r => r.left >= box.left && r.right <= box.right + 1
            && r.top >= box.top && r.bottom <= box.bottom + 1) };
      });
      assert.equal(fit.whiteSpace, "normal");
      assert.equal(fit.overflow, false); assert.equal(fit.clippedVertically, false); assert(fit.textInside);
      await assertEndVisible(page, ".lime-bubble");
      assert.equal(await page.evaluate(() => LayoutQA.core.state.money), money, "showing price does not charge it");
      await page.locator('[data-test="reply-2"]').click();
      await page.locator('[data-test="phone-close"]').waitFor();
      assert.equal(await page.evaluate(() => LayoutQA.core.state.pendingInvite), null);
    }, { ...options, reducedMotion: "reduce" });

    for (const read of [false, true]) await check(`layout-${device}-last-stamp-${read ? "history" : "new"}`, async page => {
      // The history path does not wait for media. Keep an actual delayed image to test reserved dimensions.
      await page.route("**/st_naru_sleep.png", async route => {
        await new Promise(resolve => setTimeout(resolve, 400));
        await route.continue();
      });
      await open(page, { id: "lime_naru_day10", read });
      const stamp = page.locator('.lime-stamp img');
      await page.waitForFunction(() => {
        const img = document.querySelector('.lime-stamp img'); return img?.complete && img.naturalWidth > 0;
      });
      assert.match(await stamp.getAttribute("alt"), /ちゃんと寝ろよ/);
      await assertEndVisible(page, ".lime-stamp");
      assert.equal(await page.evaluate(() => LayoutQA.core.state.money), 30000);
    }, { ...options, reducedMotion: "reduce" });
  }
}, { entry: new URL("?titleLayout=normal", baseURL).href });
