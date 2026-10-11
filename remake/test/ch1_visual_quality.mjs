// 第一章の自宅・となり: 天候別の昼夜、窓外の雨、FHDデコードとセーブ不変。
import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits } from "./browser/support.mjs";

await suite("ch1-visual-quality", async check => {
  for (const place of ["home", "tonari_inside"]) {
  for (const [device, viewport] of [["desktop", { width: 1920, height: 1080 }], ["mobile", { width: 844, height: 390 }]]) {
    for (const [weather, seed] of [["sun", 2], ["cloud", 10], ["rain", 1]]) {
      for (const time of ["day", "night"]) {
        await check(`${place === "home" ? "" : "tonari-"}${device}-${weather}-${time}`, async page => {
          const saved = await storageSnapshot(page);
          const result = await page.evaluate(async ({ place, seed, time }) => {
            const core = await import("./js/core/state.js");
            const ui = await import("./js/core/ui.js");
            const data = await import("./js/core/data.js");
            const engine = await import("./js/vn/engine.js");
            const wx = await import("./js/daily/weather.js");
            core.newGame();
            Object.assign(core.state, { phase: "daily", day: 4, slot: time === "day" ? 0 : 1, weatherSeed: seed });
            core.config.textSpeed = 4;
            ui.clearScreen();
            const art = data.sceneBg(`bg_${place}`, time);
            await ui.setBg(art.url, { instant: true, tint: art.tint });
            const image = new Image(); image.src = art.url; await image.decode();
            const dialogue = place === "home"
              ? (time === "day" ? "remake_sick_half" : "remake_homecoming_0")
              : (time === "day" ? "remake_tutorial_offer" : "remake_midcheck");
            void engine.play(dialogue);
            return { weather: wx.weatherOf(), url: art.url, tint: art.tint, dimensions: [image.naturalWidth, image.naturalHeight], rain: wx.rainScene(art.url, "vn"), windows: wx.rainScene(`img/backgrounds/bg_${place}_${time}.webp`, "vn")?.windows };
          }, { place, seed, time });
          const overcast = weather === "sun" ? "" : "overcast_";
          assert.equal(result.weather, weather);
          assert.equal(result.url, `img/backgrounds/bg_${place}_${overcast}${time}.webp`);
          assert.equal(result.tint, null);
          assert.deepEqual(result.dimensions, [1920, 1080]);
          const text = place === "home"
            ? (time === "day" ? "朝。喉の奥が痛い。" : "店明かりの落ちた商店街")
            : (time === "day" ? "はじめ、時間があるなら一台" : "大会まで、ちょうど折り返し");
          await page.locator(".vn-text").filter({ hasText: text }).waitFor();
          await page.waitForFunction(() => Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99);
          assert.equal(await page.locator("#weather .weather-drop").count(), weather === "rain" ? result.windows.length * 5 : 0);
          if (weather === "rain") {
            assert.equal(result.rain.mode, "indoor");
            assert.deepEqual(result.rain.windows, result.windows, "Overcast variant lost the established window mask");
            const windows = await page.locator("#weather .window").evaluateAll(nodes => nodes.map(n => [parseFloat(n.style.left), parseFloat(n.style.top), parseFloat(n.style.width), parseFloat(n.style.height)]));
            assert.deepEqual(windows, result.windows);
          }
          await assertFits(page, ".vn-text");
          assert.deepEqual(await storageSnapshot(page), saved, "Displaying weather art changed persisted save data");
        }, { viewport, ...(device === "mobile" ? { isMobile: true, hasTouch: true } : {}) });
      }
    }
  }
  }
  await check("unprepared-background-fallbacks", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
      core.newGame(); Object.assign(core.state, { phase: "daily", day: 4, weatherSeed: 1 });
      const street = data.sceneBg("bg_street", "night"), missing = data.sceneBg("unknown_art", "day");
      core.state.phase = "tournament";
      return { street, missing, tournament: data.sceneBg("bg_home", "day") };
    });
    assert.equal(result.street.url, "img/backgrounds/bg_street_night.webp");
    assert.equal(result.missing.url, null);
    assert.equal(result.tournament.url, "img/backgrounds/bg_home_day.webp");
  });
  await check("portrait-rotation-guide", async page => {
    assert.match(await page.locator("#rotate-hint").textContent(), /横/);
    assert.equal(await page.locator("#rotate-hint").isVisible(), true);
  }, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
});
