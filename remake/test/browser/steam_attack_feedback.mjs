import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const artifacts = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)),
  process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
fs.mkdirSync(artifacts, { recursive: true });
const shot = (page, name) => page.screenshot({ path: path.join(artifacts, `attack-${name}.png`) });

await suite("steam-attack-feedback", async check => {
  for (const [name, options, legacy] of [
    ["pc", {}, false],
    ["touch-legacy", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
    ["small-touch-reduced", { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }, false],
  ]) {
    await check(name, async page => {
      await page.evaluate(async legacy => {
        const core = await import("./js/core/state.js");
        core.newGame();
        if (legacy) {
          const old = { schema: 5, chapter: 1, phase: "daily", day: 3, slot: 1,
            money: 10000, stamina: 80, stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
            flags: { _qa_preserved: true }, flavors: ["double_apple"] };
          localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
          core.load();
          if (!core.state.flags._qa_preserved) throw new Error("Legacy flag was lost");
        }
        core.state.stamina = 80; core.state.stats.guts = core.state.stats.insight = 10;
        const session = await import("./js/craft/session.js");
        const steam = await import("./js/craft/steam.js");
        const geometry = await import("./js/craft/steam-slash.js");
        __remake.craftTest.auto = null;
        window.cs = session.newSession("drill"); cs.steamSeconds = 600;
        session.openBench(cs); Math.random = () => .5;
        window.run = steam.runSteamDodge(cs);
        window.attackBullets = () => {
          const m = new DOMMatrix(document.querySelector(".dodge-heart").style.transform);
          const hx = m.e + 14, hy = m.f + 14;
          return [...document.querySelectorAll(".dodge-word,.dodge-object")].map(node => {
            const t = new DOMMatrix(node.style.transform);
            const b = { node, x: t.e, y: t.f, w: node.offsetWidth, h: node.offsetHeight };
            return { ...b, cut: geometry.slashTouchesBullet(b, hx, hy, -Math.PI / 2) };
          });
        };
      }, legacy);
      const button = page.locator('[data-test="dodge-slash"]');
      await button.waitFor();
      assert(await button.isDisabled());
      assert.equal(await button.getAttribute("data-state"), "waiting");
      assert.match(await button.getAttribute("aria-label"), /開始待ち/);
      assert.equal(await page.locator(".slash-state").textContent(), "開始待ち");
      await page.keyboard.press("z");
      assert.equal(await button.getAttribute("data-uses"), "0");
      const saved = await storageSnapshot(page);

      // Observe readiness and fire in the same task, before the first bullet spawns.
      const miss = await page.waitForFunction(() => {
        const button = document.querySelector('[data-test="dodge-slash"]');
        if (button.dataset.state !== "ready") return false;
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
        const fx = document.querySelector(".dodge-slash-fx");
        return { result: fx.dataset.result, cleared: fx.dataset.cleared,
          state: button.dataset.state, text: button.querySelector(".slash-state").textContent,
          animation: getComputedStyle(fx).animationName };
      });
      assert.deepEqual(await miss.jsonValue(), { result: "miss", cleared: "0", state: "recharging", text: "空振り",
        animation: options.reducedMotion ? "none" : "steam-slash" });
      await shot(page, `${name}-miss`);
      await page.evaluate(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", repeat: true, bubbles: true }));
        document.querySelector('[data-test="dodge-slash"]').click();
      });
      assert.equal(await button.getAttribute("data-uses"), "1", "Repeat/click consumed another attack during recharge");
      assert.match(await button.getAttribute("aria-label"), /再使用まで/);

      // The actual collision function chooses targets; observe and attack atomically.
      const hit = await page.waitForFunction(() => {
        const button = document.querySelector('[data-test="dodge-slash"]');
        const bullets = attackBullets(), near = bullets.filter(b => b.cut), far = bullets.filter(b => !b.cut);
        if (button.disabled || !near.length) return false;
        const trace = document.querySelector('[data-test="mental-trace"]');
        const temp = document.querySelector('[data-test="steam-temperature"]');
        const refresh = document.querySelector('[data-test="dodge-refresh"]');
        const before = [trace.dataset.hits, trace.dataset.level, temp.getAttribute("aria-valuenow"), refresh.dataset.remaining];
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", bubbles: true }));
        const fx = document.querySelector(".dodge-slash-fx");
        return { count: near.length, removed: near.every(b => !b.node.isConnected), kept: far.every(b => b.node.isConnected),
          same: JSON.stringify(before) === JSON.stringify([trace.dataset.hits, trace.dataset.level, temp.getAttribute("aria-valuenow"), refresh.dataset.remaining]),
          result: fx.dataset.result, cleared: Number(fx.dataset.cleared), text: button.querySelector(".slash-state").textContent };
      }, null, { timeout: 15000 });
      const cut = await hit.jsonValue();
      assert(cut.count > 0 && cut.removed && cut.kept && cut.same, JSON.stringify(cut));
      assert.equal(cut.result, "hit"); assert.equal(cut.cleared, cut.count); assert.equal(cut.text, `斬った ×${cut.count}`);
      await shot(page, `${name}-hit`);
      await page.waitForFunction(() => document.querySelector(".slash-state").textContent === "再充填中");
      await page.waitForFunction(() => document.querySelector('[data-test="dodge-slash"]').dataset.state === "ready");
      assert.equal(await page.locator(".slash-state").textContent(), "使用可能");
      await assertFits(page, ".slash-state,.slash-aim");
      const size = await button.boundingBox();
      assert(size.width >= 44 && size.height >= 44, "Attack touch target is too small");
      const viewport = page.viewportSize();
      assert(size.x >= 0 && size.y >= 0 && size.x + size.width <= viewport.width && size.y + size.height <= viewport.height,
        "Attack button is outside the viewport");
      await shot(page, `${name}-ready`);

      if (options.hasTouch) {
        const pad = await page.locator(".dodge-pad").boundingBox();
        const knob = await page.locator(".dodge-knob").boundingBox();
        const touch = await page.context().newCDPSession(page);
        const stick = { id: 1, x: knob.x + knob.width / 2 - pad.width * .34 * .8, y: knob.y + knob.height / 2 };
        const tap = { id: 2, x: size.x + size.width / 2, y: size.y + size.height / 3 };
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [stick] });
        await page.waitForFunction(() => document.querySelector(".dodge-pad").classList.contains("held"));
        assert.equal(await page.locator(".slash-aim").textContent(), "↑");
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [stick, tap] });
        assert.equal(await button.getAttribute("data-direction"), "u");
        assert.equal(await button.getAttribute("data-uses"), "3");
        assert.equal(await page.locator(".dodge-pad.held").count(), 1, "Attack interrupted the first finger's movement");
        await shot(page, `${name}-two-fingers`);
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
        await touch.detach();
      } else {
        await page.keyboard.down("ArrowRight");
        assert.equal(await page.locator(".slash-aim").textContent(), "↑");
        assert.match(await button.getAttribute("aria-label"), /前方/);
        await page.keyboard.press("z"); await page.keyboard.up("ArrowRight");
        assert.equal(await button.getAttribute("data-direction"), "u");
        assert.equal(await button.getAttribute("data-uses"), "3");
      }
      await page.waitForFunction(() => document.querySelector('[data-test="dodge-slash"]').dataset.aim === "u");
      assert.equal(await page.locator(".slash-aim").textContent(), "↑", "Released input did not restore the forward aim");
      assert.deepEqual(await storageSnapshot(page), saved, "Attack feedback changed save/config storage");
      if (name === "pc") {
        await page.waitForSelector(".result-card.show", { timeout: 35000 });
        assert(await button.isDisabled());
        assert.equal(await button.getAttribute("data-state"), "ended");
        assert.match(await button.getAttribute("aria-label"), /終了/);
        assert.equal(await page.locator(".slash-state").textContent(), "終了");
        assert.equal(await page.locator(".dodge-slash-fx").count(), 0);
      }
    }, options);
  }
});
