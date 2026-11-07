// DS overlays: real daily HUD, the full-screen MENU (status/people/items/system tabs), and a three-reply LIME thread.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";
import { rotateThroughGuard } from "./rotate_guard.mjs";

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

// 縦持ちで押してみても変わってはいけない、HUD・LIME・MENUの開閉と既読・返信の状態。
const overlayState = page => () => page.evaluate(() => ({
  phone: document.querySelectorAll(".phone-overlay").length,
  replies: document.querySelectorAll(".lime-actions .lime-reply").length,
  next: document.querySelectorAll('[data-test="phone-next"]').length,
  menu: document.querySelectorAll(".dmenu").length, tab: document.querySelector(".dmenu")?.dataset.tab || null,
  toolbar: document.querySelector(".game-layout-toolbar")?.open ?? null,
  inbox: JSON.stringify(window.__remake.state.inbox),
}));

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
  // #2789: スマホの縦持ちはDS風も回転ガードで止める（#2794）。portrait・small は縦持ちで始め、地図のHUD・LIMEの会話・
  // MENUを開いた状態でガードが入力を止めることを確かめ、横持ち（small は 568×320）へ戻して同じ状態から配置を検査する。
  for (const [label, width, height, portrait] of [
    ["landscape", 844, 390], ["portrait", 844, 390, { width: 390, height: 844 }],
    ["small", 568, 320, { width: 320, height: 568 }],
  ]) {
    await check(label, async page => {
      page.setDefaultTimeout(15000);
      const press = selector => page.locator(selector).tap();
      const test = id => page.locator(`[data-test="${id}"]`);
      const guarded = async (name, targets) => {
        if (portrait) await rotateThroughGuard(page, { portrait, landscape: { width, height }, targets,
          state: overlayState(page), label: `${label}/${name}` });
      };
      await setup(page);
      await guarded("hud", [test("hud-phone"), test("hud-menu"), test("game-layout-settings")]);

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
        assert.equal(await page.locator(".dmenu").count(), 0);
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
      await guarded("lime-thread", [replies.first(), replies.last(), test("lime-back")]);
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

      // 全画面MENU（DUI03）: 4タブ。旧STATUSの画面はタブへ移り、HUDのステータスボタンは無い。
      assert.equal(await page.locator('[data-test="hud-status"]').count(), 0, "HUD status button was retired");
      await press('[data-test="hud-menu"]');
      await page.locator(".dmenu").waitFor();
      await page.locator(".dmenu .dm-sheet").evaluate(node => Promise.all(
        node.getAnimations().map(animation => animation.finished.catch(() => {}))));
      await guarded("menu", [test("menu-tab-people"), test("menu-tab-system"), test("menu-close")]);
      const menu = await rect(page, ".dmenu .dm-sheet");
      inside(menu, await rect(page, "#stage"), "MENU sheet");
      const panelHeight = await page.locator(".dmenu .dm-panel").evaluate(node => node.clientHeight);
      assert(panelHeight > 0, "MENU panel has no space");
      assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), "status");
      assert.equal(await page.locator(".dmenu :is(.radar, svg)").count(), 0, "MENU status has no radar/triangle");
      await noHorizontalOverflow(page, ".dmenu .dm-panel");
      for (const row of await page.locator(".dmenu .dm-row").all()) {
        const size = await row.evaluate(node => ({ width: node.clientWidth, scrollWidth: node.scrollWidth }));
        assert(size.scrollWidth <= size.width + 1, `MENU status row overflows: ${JSON.stringify(size)}`);
      }
      await page.screenshot({ path: path.join(out, `ds-overlay-${label}-status.png`) });
      // 心得の盤（通常プレイの既定・#2166）の MENU は才能・感覚・理論の行、旧しくみ（?growth=0）は5能力の行
      const lastRow = await page.evaluate(async () => (await import("./js/core/growth-mode.js")).growthEnabled())
        ? '[data-test="menu-board-wisdom"]' : '[data-test="menu-stat-insight"]';
      await reachable(page.locator(lastRow));
      await press(lastRow);
      for (const tab of ["people", "items", "system", "status"]) {
        const button = page.locator(`[data-test="menu-tab-${tab}"]`);
        await reachable(button);
        inside(await button.evaluate(bounds), menu, `MENU tab ${tab}`);
        await button.tap();
        assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), tab);
        await noHorizontalOverflow(page, ".dmenu .dm-panel");
        if (tab === "system") {
          for (const action of await page.locator(".dmenu .dm-sys").all()) {
            inside(await action.evaluate(bounds), menu, "MENU action");
            await reachable(action);
          }
          await page.screenshot({ path: path.join(out, `ds-overlay-${label}-menu.png`) });
        }
      }
      const menuClose = page.getByRole("button", { name: "閉じる", exact: true });
      inside(await menuClose.evaluate(bounds), menu, "MENU close");
      await reachable(menuClose);
      await menuClose.tap();
      await page.locator(".dmenu").waitFor({ state: "detached" });
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
    }, { viewport: portrait || { width, height }, isMobile: true, hasTouch: true,
      reducedMotion: "reduce" });
  }
}, { initScript: () => localStorage.setItem("suien_title_layout", "ds") });
