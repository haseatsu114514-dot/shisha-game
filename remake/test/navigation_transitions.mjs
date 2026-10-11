// 実際のマップの行き先と、背景→会話/メニューの引き継ぎを通常速度で確認する。
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";

const desktop = { width: 1280, height: 720 }, mobile = { width: 844, height: 390 };

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame(); core.state.day = 4;
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const map = await import("./js/daily/map.js");
    const spots = await import("./js/daily/spots.js");
    const engine = await import("./js/vn/engine.js");
    const transitions = await import("./js/core/transitions.js");
    window.T = { core, ui, data, map, spots, engine, transitions };
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_tonari_inside", "day"), { instant: true });
    await Promise.all(["bg_home", "bg_shop", "bg_osu_map_day"].map((id) => ui.imageReady(data.bgUrl(id), 15000)));
  });
}

async function arm(page, selector) {
  await page.evaluate((selector) => {
    window.audit = { types: [], overlap: [], frames: 0, started: null, ended: null, stop: false };
    const sample = () => {
      if (audit.stop) return;
      const curtain = document.querySelector(".scene-curtain");
      if (curtain) {
        audit.started ??= performance.now();
        audit.frames++;
        if (!audit.types.includes(curtain.dataset.transition)) audit.types.push(curtain.dataset.transition);
        if (document.querySelector(selector)) audit.overlap.push(performance.now() - audit.started);
      } else if (audit.started !== null) audit.ended ??= performance.now();
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }, selector);
}

async function verify(page, selector, expected = null) {
  await page.locator(selector).first().waitFor();
  await page.waitForFunction(() => !document.querySelector(".scene-curtain") && audit.ended !== null);
  const audit = await page.evaluate(() => { audit.stop = true; return window.audit; });
  assert.ok(audit.frames > 0, "The real transition was not observed");
  assert.deepEqual(audit.overlap, [], "New dialogue/choices appeared before the curtain finished");
  if (expected) assert.deepEqual(audit.types, [expected]);
  assert.equal(await page.locator("#screen > .map").count(), 0, "The old map remained behind the new scene");
  console.log(`  ${audit.types.join(", ")}: ${Math.round(audit.ended - audit.started)} ms; new UI waited for the ending`);
  return audit;
}

await suite("navigation-transitions", async (check) => {
  for (const [label, spot, viewport] of [
    ["home-pc", "rest", desktop], ["home-mobile", "rest", mobile],
    ["tonari-pc", "tonari", desktop], ["shop-mobile", "shop", mobile],
  ]) {
    await check(label, async (page) => {
      await prepare(page);
      await page.evaluate(() => {
        window.visit = T.map.chooseSpot().then(async (id) => {
          if (id === "rest") return T.spots.restAtHome(T.spots.spotById(id));
          if (id === "tonari") return (await import("./js/daily/tonari.js")).tonariMenu();
          if (id === "shop") return (await import("./js/daily/shop.js")).openShop();
          throw new Error(`Unexpected map choice: ${id}`);
        });
      });
      await page.locator(`[data-test="pin-${spot}"]`).click();
      await page.waitForFunction(() => !document.querySelector(".scene-curtain"));
      const selector = spot === "rest" ? "#vn.active .vn-text" : spot === "tonari" ? '[data-test="tonari-customer"]' : ".shop-tabs";
      await arm(page, selector);
      await page.locator('[data-test="map-go"]').click();
      await page.locator(".scene-curtain").waitFor();
      await page.keyboard.press("Enter");
      if (spot === "rest") assert.equal(await page.locator(".vn-text").textContent(), "");
      const audit = await verify(page, selector, spot === "rest" ? "move-door" : "move-pin");
      if (spot === "rest") {
        assert.ok(audit.ended - audit.started < 1800, "The warmed-up home transition still feels too long");
        await page.waitForFunction(() => document.querySelector(".vn-text").textContent.includes("今日は早めに家へ帰った"));
      }
    }, { viewport });
  }

  await check("slow-scene-image-immediate-choice", async (page) => {
    await prepare(page);
    // 画像が幕を閉じる時間より遅い場合。待機中も、新しい選択肢を先に出さない。
    await page.route("**/*?slow-transition-test", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await route.continue();
    });
    await arm(page, ".vn-choice");
    await page.evaluate(() => {
      const url = T.data.bgUrl("bg_home");
      T.transitions.cueTransition("place", { spotId: "rest" });
      window.backgroundDone = false;
      window.background = T.ui.setBg(url, { ready: [url + "?slow-transition-test"] }).then(() => { backgroundDone = true; });
      // 同じ背景を要求する会話も、進行中の背景タスクの「開き終わり」を待つ。
      window.dialogue = T.engine.play({ dialogue_id: "navigation_test", metadata: { bg: "bg_home" }, lines: [
        { type: "choice", choices: [{ text: "休む" }, { text: "窓を開ける" }] },
      ] });
    });
    await page.locator('.scene-curtain[data-transition="move-door"]').waitFor();
    await page.waitForTimeout(750);
    assert.equal(await page.evaluate(() => backgroundDone), false, "Background resolved before the slow image/reveal");
    assert.equal(await page.locator(".vn-choice").count(), 0);
    await verify(page, ".vn-choice", "move-door");
    await page.evaluate(() => window.background);
    await page.locator('[data-test="choice-0"]').click();
    await page.evaluate(() => window.dialogue);
  });

  await check("superseded-menu", async (page) => {
    await prepare(page);
    await arm(page, '[data-test="new-menu"]');
    await page.evaluate(() => {
      T.transitions.cueTransition("place", { spotId: "rest" });
      window.background = T.ui.setBg(T.data.bgUrl("bg_home"));
      const old = document.createElement("button"); old.dataset.test = "old-menu";
      const next = document.createElement("button"); next.dataset.test = "new-menu"; next.textContent = "休む";
      T.ui.showScreen("old-menu", old);
      T.ui.showScreen("new-menu", next);
    });
    await verify(page, '[data-test="new-menu"]', "move-door");
    assert.equal(await page.locator('[data-test="old-menu"]').count(), 0);
    assert.equal(await page.evaluate(() => document.body.dataset.screen), "new-menu");
  });

  await check("reduced-home", async (page) => {
    await prepare(page);
    await arm(page, "#vn.active .vn-text");
    await page.evaluate(() => {
      T.transitions.cueTransition("place", { spotId: "rest" });
      window.visit = T.spots.restAtHome(T.spots.spotById("rest"));
    });
    const audit = await verify(page, "#vn.active .vn-text");
    assert.ok(!audit.types.includes("move-door"), "Reduced motion played the full door");
  }, { reducedMotion: "reduce" });
});
