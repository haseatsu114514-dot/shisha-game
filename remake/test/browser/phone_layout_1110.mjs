// 横持ち Safari の可視領域で、地図と制作の固定舞台内の衝突を確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const gap = (a, b) => Math.max(b.left - a.right, a.left - b.right, b.top - a.bottom, a.top - b.bottom);
const within = (child, parent) => child.left >= parent.left - 1 && child.right <= parent.right + 1
  && child.top >= parent.top - 1 && child.bottom <= parent.bottom + 1;

await suite("phone-layout-1110", async check => {
  for (const [device, viewport] of [
    ["iphone-852", { width: 852, height: 393 }],
    ["iphone-852-bar", { width: 852, height: 340 }],
    ["iphone-932", { width: 932, height: 430 }],
    ["iphone-932-bar", { width: 932, height: 377 }],
    ["desktop", { width: 1280, height: 720 }],
  ]) {
    const options = { viewport, isMobile: device !== "desktop", hasTouch: device !== "desktop", reducedMotion: "reduce" };
    await check(`${device}-map`, async page => {
      if (device !== "desktop") {
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { left: 59, right: 59, bottom: 21 } });
      }
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.newGame();
        const hud = await import("./js/daily/hud.js"); hud.initHud({ menu: () => {}, phone: () => {} }); hud.showHud(true);
        void (await import("./js/daily/map.js")).chooseSpot({ guide: {
          pin: "shop", title: "スミさんの頼み", text: "スミさんに頼まれた仕入れへ。Dr.fookah をタップ！",
        } });
      });
      await page.locator(".map-guide").waitFor();
      await page.waitForFunction(() => getComputedStyle(document.getElementById("backdrop")).backgroundImage !== "none");
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-map.png` });
      const geometry = await page.evaluate(() => {
        const get = s => document.querySelector(s).getBoundingClientRect().toJSON();
        return { card: get(".map-info"), guide: get(".map-guide"), hud: get(".hud-card"), badge: get(".spot-pin.guide .evt-badge") };
      });
      if (device !== "desktop") {
        assert(geometry.card.bottom + 6 <= geometry.guide.top, `Map card covers GUIDE: ${JSON.stringify(geometry)}`);
        assert(geometry.badge.left >= geometry.hud.right - 1, `Guide badge is hidden by HUD: ${JSON.stringify(geometry)}`);
      }
    }, options);

    if (device.endsWith("bar")) await check(`${device}-options`, async page => {
      await page.evaluate(async () => {
        localStorage.setItem("suien_step_intro", "off");
        const core = await import("./js/core/state.js"); const state = core.newGame();
        const { DB } = await import("./js/core/data.js");
        state.owned.push(Object.values(DB.equipById).find(item => item.type === "bowl" && !state.owned.includes(item.id)).id);
        state.flags._coal_cube_learned = true;
        const session = await import("./js/craft/session.js"), steps = await import("./js/craft/steps.js");
        const cs = session.newSession("rehearsal");
        await session.openBench(cs).ready;
        window.phoneOptions = { steps, cs };
        void steps.stepSetup(cs);
      });
      await page.locator('.bench[data-step="setup"] .opt-grid').waitFor();
      const setup = await page.evaluate(() => {
        const get = s => document.querySelector(s).getBoundingClientRect().toJSON();
        const preview = document.querySelector(".equipment-set-preview");
        return { panel: get(".bench-panel"), choices: get(".opt-grid"),
          previewScrolls: preview.scrollHeight > preview.clientHeight && getComputedStyle(preview).overflowY === "auto" };
      });
      assert(within(setup.choices, setup.panel) && setup.previewScrolls, `Setup actions cut: ${JSON.stringify(setup)}`);
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-setup.png` });
      await page.evaluate(() => { void phoneOptions.steps.stepPlace(phoneOptions.cs); });
      await page.locator('.bench[data-step="place"] .opt-grid').waitFor();
      const place = await page.evaluate(() => ({
        panel: document.querySelector(".bench-panel").getBoundingClientRect().toJSON(),
        choices: document.querySelector(".opt-grid").getBoundingClientRect().toJSON(),
      }));
      assert(within(place.choices, place.panel), `Place actions cut: ${JSON.stringify(place)}`);
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-place.png` });
    }, options);

    await check(`${device}-craft`, async page => {
      await page.evaluate(async () => {
        localStorage.setItem("suien_step_intro", "off");
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js");
        const cs = session.newSession("tutorial"); cs.preview = true; cs.mix = { double_apple: 10, mint: 2 };
        window.phoneLayout = { session, cs };
        await session.openBench(cs).ready;
        void (await import("./js/craft/steps.js")).stepPack(cs);
      });
      await page.locator(".pack-choice").first().waitFor();
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-pack.png` });
      if (device !== "desktop") {
        const pack = await page.evaluate(() => {
          const get = s => document.querySelector(s).getBoundingClientRect().toJSON();
          const choices = [...document.querySelectorAll(".pack-choice")].map(node => ({ box: node.getBoundingClientRect().toJSON(), fullText: node.scrollWidth <= node.clientWidth + 1 }));
          const caption = document.querySelector(".pack-caption");
          return { panel: get(".bench-panel"), choices, confirm: get(".pack-confirm"),
            caption: get(".pack-caption"), captionFits: caption.scrollHeight <= caption.clientHeight + 1,
            nameWraps: getComputedStyle(document.querySelector(".audience-name")).whiteSpace !== "nowrap" };
        });
        assert(pack.choices.length === 3 && pack.choices.every(c => within(c.box, pack.panel) && c.fullText), JSON.stringify(pack));
        assert(within(pack.confirm, pack.panel) && pack.choices.every(c => gap(c.box, pack.confirm) >= 0), JSON.stringify(pack));
        assert(pack.captionFits && !pack.nameWraps, `Packing text clipped: ${JSON.stringify(pack)}`);
        for (const selector of [".pack-choice", ".pack-confirm", ".bench-guide summary"]) {
          const box = await page.locator(selector).first().boundingBox();
          assert(box.width >= 38 && box.height >= 38, `${selector}: ${JSON.stringify(box)}`);
        }
      }
      await page.evaluate(async () => {
        const { cs } = window.phoneLayout;
        void (await import("./js/craft/steps.js")).stepMix(cs);
      });
      await page.locator(".mix").waitFor();
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-mix.png` });
      if (device !== "desktop") {
        const mix = await page.evaluate(() => ({
          help: document.querySelector(".bench-guide summary").getBoundingClientRect().toJSON(),
          plus: document.querySelector(".fr-btn[data-test^='mix-plus']")?.getBoundingClientRect().toJSON(),
        }));
        assert(mix.plus && gap(mix.help, mix.plus) >= 4, `Mix help covers the first plus button: ${JSON.stringify(mix)}`);
      }
      // 炭焼きは本編と同じ盤面を作り、? と炭壺の境界を比較する。
      await page.evaluate(async () => {
        const { session } = window.phoneLayout;
        const panel = session.stepPanel("heat", "炭焼き", "黒い面が消えた炭を取る");
        const view = (await import("./js/craft/heat_view.js")).buildHeatView(["flat_charcoal", "flat_charcoal", "flat_charcoal"], { count: 3 });
        panel.append(view.root);
      });
      await page.locator(".heat-info").waitFor();
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-heat.png` });
      if (device !== "desktop") {
        const heat = await page.evaluate(() => ({ help: document.querySelector(".bench-guide summary").getBoundingClientRect().toJSON(), info: document.querySelector(".heat-info").getBoundingClientRect().toJSON() }));
        assert(gap(heat.help, heat.info) >= 6, `Heat help covers coal carrier: ${JSON.stringify(heat)}`);
      }
      await page.evaluate(async () => {
        const { session, cs } = window.phoneLayout;
        session.stepPanel("steam", "蒸らし", "時間を設定する");
        void (await import("./js/craft/timer.js")).runSteamTimer(cs);
      });
      await page.locator(".steam-timer").waitFor();
      if (process.env.ARTIFACT_DIR) await page.screenshot({ path: `${process.env.ARTIFACT_DIR}/phone-layout-1110-${device}-steam.png` });
      if (device !== "desktop") {
        const steam = await page.evaluate(() => {
          const get = s => document.querySelector(s).getBoundingClientRect().toJSON();
          return { worker: get(".bench-left"), help: get(".bench-guide summary"),
            thermometer: get(".steam-temperature"), clock: get(".steam-clock"),
            forecast: get(".steam-forecast"), panel: get(".bench-panel") };
        });
        assert(steam.help.left >= steam.worker.right && steam.thermometer.left >= steam.worker.right, JSON.stringify(steam));
        assert(gap(steam.thermometer, steam.clock) >= 4 && within(steam.forecast, steam.panel), JSON.stringify(steam));
        for (const button of await page.locator(".steam-clock .timer-button").all()) {
          const box = await button.boundingBox();
          assert(box.width >= 38 && box.height >= 38, `Timer target: ${JSON.stringify(box)}`);
        }
      }
    }, options);
  }
});
