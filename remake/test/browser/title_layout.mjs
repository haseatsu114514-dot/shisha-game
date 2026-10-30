// Title + game display prototype: real inputs, isolated storage, no player's saves.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const dir = process.env.ARTIFACT_DIR || ".codex/artifacts/title-layout";
fs.mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
const key = "suien_title_layout";
const button = (p, id) => p.locator(`[data-test="${id}"]`);
async function ready(p) {
  await button(p, "title-new").waitFor({ timeout: 35000 });
  await p.locator("#boot").waitFor({ state: "detached" });
}
async function snapshot(p) {
  return p.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k !== "suien_title_layout").sort().map(k => [k, localStorage.getItem(k)])));
}
async function seed(p) {
  await p.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newState(); Object.assign(s, { schema: 14, phase: "daily", day: 6, slot: 1, money: 45678, stamina: 73 });
    s.flags._morning_6 = true; s.flags._lime_tut = 1; s.flags._qa_preserved = "keep";
    s.lovers = ["hiyori"]; s.affinity.hiyori = 66; s.relationshipMemories = ["actually-read"];
    delete s.trpg.club;
    localStorage.setItem(core.SAVE_KEY, JSON.stringify(s));
    localStorage.setItem("suien_remake_slot1", JSON.stringify(s));
    localStorage.setItem("qa_unrelated", "keep");
  });
  await p.reload(); await ready(p);
}
async function openLayoutControls(p) {
  if (!(await p.locator(".title-layout-toolbar").evaluate(n => n.open)))
    await button(p, "title-layout-settings").click();
}
async function layout(p, mode) {
  await openLayoutControls(p);
  await button(p, `title-layout-${mode}`).click();
  assert.equal(await p.locator(".title").getAttribute("data-layout"), mode);
}
async function stageIsOriginal(p) {
  const size = await p.locator("#stage").evaluate(n => [n.offsetWidth, n.offsetHeight]);
  assert.deepEqual(size, [1280, 720], "normal/unsupported screen must retain original sizing");
}
async function stageMatchesTitleLayout(p, mode) {
  assert.equal(await p.locator("body").getAttribute("data-screen"), "title");
  assert.equal(await p.locator(".title").getAttribute("data-layout"), mode);
  if (mode === "normal") return stageIsOriginal(p);
  const viewport = p.viewportSize();
  assert(viewport, "DS title check requires a fixed browser viewport");
  const size = await p.locator("#stage").evaluate(n => [n.offsetWidth, n.offsetHeight]);
  assert.deepEqual(size, [viewport.width, viewport.height], "DS title must fill the current viewport");
}
async function gameIsDS(p) {
  await p.locator("body.game-ds").waitFor();
  const panels = await p.locator(".game-ds-panel").evaluateAll(ns => ns.map(n => {
    const r = n.getBoundingClientRect(); return { w:r.width, h:r.height, hidden:n.hidden };
  }));
  assert.equal(panels.length, 2);
  assert(panels.every(n => !n.hidden && n.w > 0 && n.h > 0));
  assert(Math.abs(panels[0].w-panels[1].w) < 1 && Math.abs(panels[0].h-panels[1].h) < 1);
  // 表示切替は「表示」から開く（DS風ではヒンジの小さなボタン）。
  assert.equal(await button(p, "game-layout-settings").isVisible(), true);
  if (!(await p.locator(".game-layout-toolbar").evaluate(n => n.open))) await button(p, "game-layout-settings").click();
  assert.equal(await button(p, "game-layout-normal").isVisible(), true);
}
async function check(name, options, run, setup = null) {
  const context = await browser.newContext(options); const p = await context.newPage();
  const errors = []; p.on("pageerror", e => errors.push(e.message));
  try {
    if (setup) await setup(p);
    await p.goto(base); await ready(p); await run(p);
    assert.deepEqual(errors, [], "Unexpected browser errors");
    await p.screenshot({ path: path.join(dir, `${name}.png`) });
    results.push({ name, status: "passed" }); console.log(`PASS: ${name}`);
  } catch (e) {
    results.push({ name, status: "failed", error: e.stack }); console.error(`FAIL: ${name}\n${e.stack}`);
    await p.screenshot({ path: path.join(dir, `${name}-failed.png`) }).catch(() => {});
  } finally { await context.close(); }
}
const sizes = { pc: { viewport: { width: 1280, height: 720 } }, phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } };
try {
  for (const [device, options] of Object.entries(sizes)) {
    for (const mode of ["normal", "ds"]) {
      await check(`${device}-${mode}-menus-and-reload`, options, async p => {
        assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal", "fresh default must remain normal");
        await seed(p); const before = await snapshot(p);
        assert.equal(await button(p, "title-layout-normal").isVisible(), false, "Display choices start folded");
        await button(p, "title-layout-settings").focus(); await p.keyboard.press("Enter");
        assert.equal(await button(p, "title-layout-normal").isVisible(), true, "Keyboard opens display settings");
        const artBefore = await p.locator(".title-art").getAttribute("data-art");
        if (mode === "ds") await p.screenshot({ path: path.join(dir, `${device}-same-art-normal.png`) });
        await layout(p, mode);
        assert.equal(await p.locator(".title-art").getAttribute("data-art"), artBefore, "switching must keep the approved original art");
        assert.equal(await p.locator(".title-item").count(), 4);
        assert.equal(await button(p, "title-load").isEnabled(), true);
        await p.screenshot({ path: path.join(dir, `${device}-${mode}-title.png`) });
        if (mode === "ds") {
          const rects = await p.locator(".title-ds-panel").evaluateAll(ns => ns.map(n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height }; }));
          assert(Math.abs(rects[0].w - rects[1].w) < 1 && Math.abs(rects[0].h - rects[1].h) < 1, "panels must have equal dimensions");
          // 縦長の画面は上下（端末を縦に持つ形）、背の低い横長だけ左右に並ぶ。
          const stacked = await p.evaluate(() => document.documentElement.dataset.dsLayout === "stacked");
          assert(stacked ? rects[1].y > rects[0].y + rects[0].h : rects[1].x > rects[0].x + rects[0].w);
          if (device === "phone") assert(stacked, "phone portrait must stack the two screens");
          for (const size of await p.locator(".title-item").evaluateAll(ns => ns.map(n => n.getBoundingClientRect().height))) assert(size >= 44);
        }
        await p.reload(); await ready(p);
        assert.equal(await p.locator(".title").getAttribute("data-layout"), mode);
        assert.deepEqual(await snapshot(p), before, "display/reload changed game data");
        // 通常版の縦持ち案内を保持する。既存メニューは従来どおり横持ちで操作。
        if (device === "phone" && mode === "normal") {
          assert.equal(await p.locator("#rotate-hint").isVisible(), true);
          await p.setViewportSize({ width: 844, height: 390 });
        }
        // Native keyboard activation remains available in both modes.
        await button(p, "title-config").focus(); await p.keyboard.press("Enter");
        await p.locator("#modal.show .cfg").waitFor();
        await p.locator("#modal.show .modal-actions button").click();
        await button(p, "title-gallery").click();
        if (device === "phone" && mode === "normal") {
          const reachable = await p.evaluate(() => {
            const hit = node => {
              const r = node.getBoundingClientRect();
              return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
            };
            return { close: hit(document.querySelector(".gal-close")),
              settingsHidden: getComputedStyle(document.querySelector(".title-layout-toolbar")).visibility === "hidden" };
          });
          assert.deepEqual(reachable, { close: true, settingsHidden: true }, "Gallery close must remain reachable without display settings overlapping");
          await p.screenshot({ path: path.join(dir, "normal-gallery-landscape-open.png") });
        }
        await button(p, "gallery-close").click();
        await button(p, "title-load").click(); await button(p, "slot-cancel").click();
        await button(p, "title-new").click(); await button(p, "cancel-new").click();
        assert.deepEqual(await snapshot(p), before, "opening/cancelling menus changed save");
        assert.equal(await button(p, "title-trpg").count(), 0);
        await stageMatchesTitleLayout(p, mode);
        await p.setViewportSize({ width: 1280, height: 720 });
        await ready(p); assert.equal(await p.locator(".title").getAttribute("data-layout"), mode);
        await layout(p, "normal"); await stageIsOriginal(p);
        await p.reload(); await ready(p); assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
        assert.deepEqual(await snapshot(p), before);
      });
      await check(`${device}-${mode}-legacy-continue`, options, async p => {
        await seed(p); await layout(p, mode);
        if (device === "phone" && mode === "normal") await p.setViewportSize({ width: 844, height: 390 });
        await button(p, "title-load").click(); await button(p, "slot-1").click();
        await p.locator("body.vn-open").waitFor();
        if (mode === "ds") await gameIsDS(p); else await stageIsOriginal(p);
        const saved = await p.evaluate(async () => {
          const { state } = await import("./js/core/state.js");
          return { money:state.money, lovers:state.lovers, memory:state.relationshipMemories, marker:state.flags._qa_preserved };
        });
        assert.deepEqual(saved, { money:45678, lovers:["hiyori"], memory:["actually-read"], marker:"keep" });
        assert.equal(await p.locator(".title-layout-toolbar").count(), 0);
      });
    }
  }
  for (const [device, options] of Object.entries({
    landscape: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true },
    portrait: sizes.phone,
    small: { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
  })) {
    await check(`ds-gallery-${device}`, options, async p => {
      await layout(p, "ds");
      await button(p, "title-gallery").tap();
      const geometry = await p.evaluate(() => {
        const box = document.querySelector(".gal").getBoundingClientRect();
        const note = document.querySelector(".gal-note").getBoundingClientRect();
        const close = document.querySelector(".gal-close").getBoundingClientRect();
        const count = document.querySelector(".gal-count");
        const hit = document.elementFromPoint(close.x + close.width / 2, close.y + close.height / 2);
        return {
          fits: [box, note, close].every(r => r.left >= 0 && r.top >= 64 && r.right <= innerWidth && r.bottom <= innerHeight),
          countFits: count.scrollWidth <= count.clientWidth + 1 && count.getBoundingClientRect().height <= 24,
          closeHit: document.querySelector(".gal-close").contains(hit),
        };
      });
      assert.deepEqual(geometry, { fits: true, countFits: true, closeHit: true });
      await p.screenshot({ path: path.join(dir, `ds-gallery-${device}-open.png`) });
      await button(p, "gallery-close").tap();
    });
  }
  await check("forced-normal-and-save-preservation", sizes.phone, async p => {
    await seed(p); await layout(p, "ds"); const before = await snapshot(p);
    await p.evaluate(() => sessionStorage.setItem("suien_remake_boot_load", "1"));
    await p.goto(new URL("?titleLayout=normal", base).href); await ready(p);
    assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
    assert.deepEqual(await snapshot(p), before);
    await layout(p, "ds"); assert.equal(new URL(p.url()).searchParams.has("titleLayout"), false);
    await openLayoutControls(p); await button(p, "title-layout-recover").click(); await ready(p);
    assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
  });
  await check("invalid-preference", sizes.pc, async p => {
    await p.evaluate(() => localStorage.setItem("suien_title_layout", "broken"));
    await p.reload(); await ready(p); assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
  });
  for (const operation of ["getItem", "setItem"]) {
    await check(`storage-${operation}-failure`, sizes.phone, async p => {
      assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
      await openLayoutControls(p); await button(p, "title-layout-ds").click();
      assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
      await p.setViewportSize({ width: 844, height: 390 });
      await button(p, "title-config").click(); await p.locator("#modal.show .cfg").waitFor();
      await p.locator("#modal.show .modal-actions button").click();
      await openLayoutControls(p); await button(p, "title-layout-recover").click(); await ready(p);
      assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
    }, p => p.addInitScript(operation => {
      // 保存済みDS設定がある端末でも、読み書き不能なら通常版へ戻す。
      localStorage.setItem("suien_title_layout", "ds");
      const original = Storage.prototype[operation];
      Storage.prototype[operation] = function(k, ...args) {
        if (k === "suien_title_layout") throw new DOMException("blocked", "SecurityError");
        return original.call(this, k, ...args);
      };
    }, operation));
  }
  for (const mode of ["normal", "ds"]) {
    await check(`${mode}-image-failure`, sizes.phone, async p => {
      await layout(p, mode); assert.equal(await p.locator(".title-item").count(), 4);
      await p.locator(".title-logo-fallback:not([hidden])").waitFor();
      if (mode === "normal") await p.setViewportSize({ width: 844, height: 390 });
      await button(p, "title-config").click(); await p.locator("#modal.show .cfg").waitFor();
      await p.locator("#modal.show .modal-actions button").click(); await layout(p, "normal");
    }, p => p.route(/(?:title_arts\/|bg_title|ui_title_logo_rich)/, route => route.fulfill({ status: 200, contentType: "image/png", body: "invalid-image" })));
  }
  await check("missing-ds-style", sizes.phone, async p => {
    await openLayoutControls(p); await button(p, "title-layout-ds").click(); assert.equal(await p.locator(".title").getAttribute("data-layout"), "normal");
    await openLayoutControls(p); await button(p, "title-layout-recover").click(); await ready(p);
  }, p => p.route("**/css/title-ds.css", r => r.fulfill({ status: 200, contentType: "text/css", body: "" })));
  for (const [name, options] of Object.entries({
    "320x480-touch": { viewport: { width: 320, height: 480 }, isMobile: true, hasTouch: true },
    "320x568-touch": { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true },
    // ページ拡大でCSS viewportが縮んだ場合の寸法。DPR変更とピンチは別に検査する。
    "320x480-mouse-dpr2": { viewport: { width: 320, height: 480 }, deviceScaleFactor: 2 },
  })) await check(`small-phone-equal-panels-and-scroll-${name}`, options, async p => {
    await seed(p);
    await layout(p, "ds");
    assert.equal(await p.locator(":root").getAttribute("data-ds-layout"), "stacked");
    const panels = await p.locator(".title-ds-panel").evaluateAll(ns => ns.map(n => n.getBoundingClientRect().toJSON()));
    const heights = panels.map(r => r.height);
    assert.equal(heights[0], heights[1]);
    assert(panels.every(r => r.width >= 290 && r.left >= 0 && r.right <= options.viewport.width && r.bottom <= options.viewport.height));
    const before = await snapshot(p);
    const activate = async id => {
      const target = button(p, id); await target.scrollIntoViewIfNeeded();
      if (options.hasTouch) await target.tap(); else await target.click();
    };
    await activate("title-new"); await activate("cancel-new");
    await activate("title-load"); await activate("slot-cancel");
    await activate("title-gallery"); await activate("gallery-close");
    // Tabでスクロール領域内の末尾項目にも到達してEnterで開ける。
    await button(p, "title-new").focus();
    for (let i = 0; i < 3; i++) await p.keyboard.press("Tab");
    assert.equal(await button(p, "title-config").evaluate(n => n === document.activeElement), true);
    await p.keyboard.press("Enter"); await p.locator("#modal.show .cfg").waitFor();
    await p.locator("#modal.show .modal-actions button").click(); await layout(p, "normal");
    assert.deepEqual(await snapshot(p), before, "small-screen inputs changed save data");
  });
  await check("ds-portrait-pinch-safe-area-and-rotation", sizes.phone, async p => {
    await layout(p, "ds");
    const cdp = await p.context().newCDPSession(p);
    const geometry = () => p.evaluate(async () => (await import("./js/scenes/ds-geometry.js")).applyDsGeometry());
    const before = await snapshot(p), original = await geometry();
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 2 });
    await p.waitForFunction(() => visualViewport.scale === 2);
    const visible = await p.evaluate(() => ({ width: visualViewport.width, height: visualViewport.height }));
    assert(visible.width < 200 && visible.height < 430, "pinch must actually shrink visual viewport");
    assert.deepEqual(await geometry(), original, "pinch reflowed the DS screens instead of magnifying them");
    await button(p, "title-config").focus(); await p.keyboard.press("Enter");
    await p.locator("#modal.show .cfg").waitFor();
    await p.locator("#modal.show .modal-actions button").focus(); await p.keyboard.press("Enter");
    await p.screenshot({ path: path.join(dir, "ds-pinch-2x.png") });
    await cdp.send("Emulation.setPageScaleFactor", { pageScaleFactor: 1 });
    await cdp.send("Emulation.setSafeAreaInsets", { insets: { top: 24, bottom: 20, left: 0, right: 0 } });
    await p.setViewportSize({ width: 320, height: 480 });
    const safe = await geometry();
    assert.equal(safe.layout, "stacked"); assert.equal(safe.vy, 32);
    assert.equal(safe.cy + safe.ch, 452, "bottom safe area was ignored");
    await button(p, "title-new").tap(); await button(p, "cancel-new").tap();
    await p.setViewportSize({ width: 844, height: 390 });
    assert.equal((await geometry()).layout, "side");
    await button(p, "title-config").tap(); await p.locator("#modal.show .cfg").waitFor();
    await p.locator("#modal.show .modal-actions button").tap();
    await p.setViewportSize({ width: 390, height: 844 });
    assert.equal((await geometry()).layout, "stacked");
    assert.deepEqual(await snapshot(p), before, "pinch/rotation changed save data");
  });
  await check("new-game-enters-game-layout", sizes.pc, async p => {
    await layout(p, "ds"); await button(p, "title-new").click();
    await p.locator("body.vn-open").waitFor(); await gameIsDS(p);
    assert.equal(await p.locator(".title-layout-toolbar").count(), 0);
  });
  await check("real-map-and-craft-enter-game-layout-and-return", sizes.pc, async p => {
    await layout(p, "ds");
    await p.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); Object.assign(core.state, { phase: "daily", day: 5, slot: 1 });
      const map = await import("./js/daily/map.js");
      window.titleScopeQA = { map, pending: map.chooseSpot() };
    });
    await p.locator('#screen[data-screen="map"]').waitFor(); await gameIsDS(p);
    assert.equal(await p.locator(".title-layout-toolbar").count(), 0);
    await p.evaluate(async () => {
      titleScopeQA.map.interruptMap(null); await titleScopeQA.pending;
      const { showTitle } = await import("./js/scenes/title.js"); showTitle();
    });
    await ready(p); await layout(p, "ds");
    await p.evaluate(async () => {
      const craft = await import("./js/craft/session.js");
      window.titleScopeQA.bench = craft.openBench(craft.newSession("rehearsal"));
    });
    await p.locator('#screen[data-screen="bench"]').waitFor(); await gameIsDS(p);
    assert.equal(await p.locator(".title-layout-toolbar").count(), 0);
    assert.equal(await p.locator(".title-ds-panel").count(), 0);
    const before = await p.evaluate(() => JSON.stringify(window.__remake.state));
    await button(p, "game-layout-normal").click();
    await p.waitForFunction(() => !document.body.classList.contains("game-ds"));
    await stageIsOriginal(p);
    assert.equal(await p.evaluate(() => JSON.stringify(window.__remake.state)), before);
  });
} finally {
  await browser.close();
  fs.writeFileSync(path.join(dir, "results.json"), JSON.stringify({ base, ref:process.env.TEST_REF || null, results }, null, 2) + "\n");
}
assert(results.length > 0); assert.equal(results.filter(r => r.status === "failed").length, 0);
