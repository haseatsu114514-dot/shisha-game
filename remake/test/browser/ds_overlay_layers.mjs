// DS overlays: real daily HUD, MENU, STATUS, and a three-reply LIME thread.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";

const out = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
fs.mkdirSync(out, { recursive: true });

async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
    const state = core.newGame();
    Object.assign(state, { phase: "daily", chapter: 1, day: 5, slot: 0,
      money: 30000, stamina: 100, weatherSeed: 1234 });
    Object.assign(state.flags, { _morning_5: true, _errand_scout_done: true,
      _delivery_adam_done: true, _delivery_minto_done: true, _lime_tut: 1,
      _lime_opened: true, _intro_minto: true, known_name_minto: true });
    state.met.minto = true;
    state.contacts.push("minto");
    const msg = structuredClone(data.DB.lime.find(item => item.id === "lime_minto_day5"));
    state.inbox = [{ id: msg.id, originId: msg.id, day: 5, msg,
      read: false, done: false, replyState: "waiting", log: [] }];
    state.limeRead = [];
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.dsOverlayRun = (await import("./js/daily/calendar.js"))
      .runDaily({ untilDay: 14, nightEvents: {} })
      .catch(error => { window.dsOverlayError = String(error.stack || error); });
  });
  await page.locator(".map:not(.done)").waitFor();
  await page.locator("body.game-ds").waitFor();
}

function bounds(node) {
  const rect = node.getBoundingClientRect();
  return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}

async function rect(page, selector) {
  return page.locator(selector).evaluate(bounds);
}

function inside(inner, outer, label) {
  assert(inner.left >= outer.left - 1 && inner.top >= outer.top - 1
    && inner.right <= outer.right + 1 && inner.bottom <= outer.bottom + 1,
  `${label} escapes its container: ${JSON.stringify({ inner, outer })}`);
}

async function noHorizontalOverflow(page, selector) {
  const size = await page.locator(selector).evaluate(node => ({
    width: node.clientWidth, scrollWidth: node.scrollWidth,
  }));
  assert(size.scrollWidth <= size.width + 1,
    `${selector} scrolls horizontally: ${JSON.stringify(size)}`);
}

async function reachable(locator) {
  await locator.scrollIntoViewIfNeeded();
  const hit = await locator.evaluate(node => {
    const rect = node.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
    const top = document.elementFromPoint(x, y);
    return { x, y, width: innerWidth, height: innerHeight,
      hit: top === node || node.contains(top) };
  });
  assert(hit.x >= 0 && hit.x < hit.width && hit.y >= 0 && hit.y < hit.height && hit.hit,
    `Control is covered or outside the viewport: ${JSON.stringify(hit)}`);
}

await suite("ds-overlay-layers", async check => {
  for (const [label, width, height] of [
    ["landscape", 844, 390], ["portrait", 390, 844], ["small", 320, 568],
  ]) {
    await check(label, async page => {
      page.setDefaultTimeout(15000);
      const press = selector => page.locator(selector).tap();
      await setup(page);

      if (label === "landscape") {
        await page.evaluate(async () => {
          window.dsVnRun = (await import("./js/vn/engine.js")).play({
            dialogue_id: "qa_ds_hud_layer", metadata: {},
            lines: [{ speaker: "hajime", text: "今夜の予定を確認する。" }],
          }).catch(error => { window.dsVnError = String(error.stack || error); });
        });
        await page.locator("body.vn-open").waitFor();
        const hiddenHud = await page.evaluate(() => {
          const hud = document.querySelector(".hud"), right = hud.querySelector(".hud-right");
          const menu = hud.querySelector('[data-test="hud-menu"]');
          const rect = menu.getBoundingClientRect();
          const x = (rect.left + rect.right) / 2, y = (rect.top + rect.bottom) / 2;
          return { opacity: getComputedStyle(hud).opacity,
            pointer: getComputedStyle(right).pointerEvents,
            intercepted: menu.contains(document.elementFromPoint(x, y)), x, y };
        });
        assert.equal(hiddenHud.opacity, "0", "Daily HUD should disappear during dialogue");
        assert.equal(hiddenHud.pointer, "none", "Hidden HUD should not receive input");
        assert(!hiddenHud.intercepted, "Hidden MENU covers the dialogue");
        await page.touchscreen.tap(hiddenHud.x, hiddenHud.y);
        assert.equal(await page.locator(".menu-modal").count(), 0);
        // 会話中のタッチバーは会話の操作（AUTO/SKIP/LOG/用語/設定）が使う。そこが開いたら閉じて続ける。
        if (await page.locator(".glossary-modal").count()) {
          await page.locator(".glossary-modal .modal-actions button").first().tap();
          await page.locator(".glossary-modal").waitFor({ state: "detached" });
        }
        if (await page.locator("#modal.show").count()) {
          await page.locator("#modal.show").getByRole("button", { name: "閉じる", exact: true }).first().tap();
          await page.locator("#modal.show").waitFor({ state: "detached" });
        }
        for (let i = 0; i < 8 && await page.locator("body.vn-open").count(); i++) {
          await page.locator("#vn.active .vn-box").tap({ force: true });
          await page.waitForTimeout(80);
        }
        await page.locator("body.vn-open").waitFor({ state: "detached" });
        assert.equal(await page.evaluate(() => window.dsVnError || null), null);
      }

      await press('[data-test="hud-phone"]');
      await page.locator(".phone-overlay.show").waitFor();
      await page.locator(".phone").evaluate(node => Promise.all(
        node.getAnimations().map(animation => animation.finished.catch(() => {}))));
      inside(await rect(page, ".phone"), await rect(page, "#stage"), "LIME phone");
      await noHorizontalOverflow(page, ".phone");
      await reachable(page.locator('[data-test="phone-close"]'));
      await press('[data-test="lime-chat-minto"]');
      const replies = page.locator(".lime-actions .lime-reply");
      await replies.first().waitFor();
      assert.equal(await replies.count(), 3, "The real day-five thread needs three replies");
      inside(await rect(page, ".phone"), await rect(page, "#stage"), "LIME thread");
      await noHorizontalOverflow(page, ".lime-actions");
      await reachable(replies.first());
      await reachable(replies.last());
      await page.screenshot({ path: path.join(out, `ds-overlay-${label}-phone.png`) });
      await replies.last().tap();
      await page.locator('[data-test="phone-next"]').waitFor();
      await reachable(page.locator('[data-test="phone-next"]'));
      await press('[data-test="phone-next"]');
      await reachable(page.locator('[data-test="phone-close"]'));
      await press('[data-test="phone-close"]');
      await page.locator(".phone-overlay").waitFor({ state: "detached" });

      await press('[data-test="hud-menu"]');
      await page.locator(".menu-modal").waitFor();
      await page.locator(".menu-modal").evaluate(node => Promise.all(
        node.getAnimations().map(animation => animation.finished.catch(() => {}))));
      const menu = await rect(page, ".menu-modal");
      inside(menu, await rect(page, "#stage"), "MENU box");
      const menuBodyHeight = await page.locator(".menu-modal .modal-body")
        .evaluate(node => node.clientHeight);
      assert(menuBodyHeight > 0, "MENU description has no space");
      for (const action of await page.locator(".menu-modal .modal-actions button").all())
        inside(await action.evaluate(bounds), menu, "MENU action");
      const menuClose = page.getByRole("button", { name: "閉じる", exact: true });
      await reachable(menuClose);
      await page.screenshot({ path: path.join(out, `ds-overlay-${label}-menu.png`) });
      await menuClose.tap();

      await press('[data-test="hud-status"]');
      await page.locator(".status-modal").waitFor();
      await page.locator(".status-modal").evaluate(node => Promise.all(
        node.getAnimations().map(animation => animation.finished.catch(() => {}))));
      const status = await rect(page, ".status-modal");
      inside(status, await rect(page, "#stage"), "STATUS box");
      const statusBodyHeight = await page.locator(".status-modal .modal-body")
        .evaluate(node => node.clientHeight);
      assert(statusBodyHeight > 0, "STATUS body has no space");
      await noHorizontalOverflow(page, ".status-modal .modal-body");
      await noHorizontalOverflow(page, ".st-me");
      for (const row of await page.locator(".st-row").all()) {
        const size = await row.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
        assert(size.scrollWidth <= size.width + 1, `STATUS row overflows: ${JSON.stringify(size)}`);
      }
      const radar = await rect(page, ".st-radar"), body = await rect(page, ".status-modal .modal-body");
      assert(radar.top < body.bottom, "STATUS radar begins below the visible body");
      await page.screenshot({ path: path.join(out, `ds-overlay-${label}-status.png`) });
      await reachable(page.locator('[data-test="st-insight"]'));
      await press('[data-test="st-insight"]');
      for (const tab of ["people", "items", "me"]) {
        const button = page.locator(`[data-tab="${tab}"]`);
        await reachable(button);
        await button.tap();
        await noHorizontalOverflow(page, ".status-modal .modal-body");
      }
      const statusClose = page.locator('[data-test="status-close"]');
      inside(await statusClose.evaluate(bounds), status, "STATUS close");
      await reachable(statusClose);
      await statusClose.tap();
      await page.locator(".status-modal").waitFor({ state: "detached" });
      assert.equal(await page.evaluate(() => window.dsOverlayError || null), null);

      if (label === "landscape") {
        await page.evaluate(async () => {
          const core = await import("./js/core/state.js");
          Object.assign(core.state, { phase: "cleared", chapter: 1, day: 14 });
          core.state.flags._ch1_preview_seen = true;
          window.dsClearRun = (await import("./js/chapters/ch1.js")).showClear()
            .catch(error => { window.dsClearError = String(error.stack || error); });
        });
        await page.locator(".end-screen.clear").waitFor();
        await page.locator(".end-title").evaluate(node => Promise.all(
          node.getAnimations().map(animation => animation.finished.catch(() => {}))));
        const title = await rect(page, ".end-title");
        inside(title, await rect(page, "#stage"), "Chapter-clear title");
        const toolbar = await rect(page, ".game-layout-toolbar");
        const overlaps = title.left < toolbar.right && title.right > toolbar.left
          && title.top < toolbar.bottom && title.bottom > toolbar.top;
        assert(!overlaps, `Display toolbar covers chapter-clear title: ${JSON.stringify({ title, toolbar })}`);
        await reachable(page.locator(".end-title"));
        // 切替の選択肢は「表示」を開くと出る。
        await reachable(page.locator('[data-test="game-layout-settings"]'));
        if (!(await page.locator(".game-layout-toolbar").evaluate(n => n.open)))
          await page.locator('[data-test="game-layout-settings"]').tap();
        for (const control of ["game-layout-normal", "game-layout-ds", "game-layout-recover"])
          await reachable(page.locator(`[data-test="${control}"]`));
        await page.screenshot({ path: path.join(out, "ds-overlay-landscape-clear.png") });
        assert.equal(await page.evaluate(() => window.dsClearError || null), null);
      }
    }, { viewport: { width, height }, isMobile: true, hasTouch: true,
      reducedMotion: "reduce" });
  }
}, { initScript: () => localStorage.setItem("suien_title_layout", "ds") });
