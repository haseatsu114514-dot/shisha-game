// #1081 J08: 第2章の雨演出ブラウザ確認（駅前・柚ヶ谷マップ・窓あり室内・窓なし室内・晴れ・reduced-motion）
// /home/box/repos/logs/browser-sem.sh env BASE_URL=http://127.0.0.1:8243/remake/ CHROME_EXECUTABLE_PATH=/usr/bin/google-chrome node remake/test/browser/ch2_rain_j08.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";

const shotsDir = process.env.SHOTS_DIR || "/tmp/ch2-rain-j08";
fs.mkdirSync(shotsDir, { recursive: true });

await suite("ch2-rain-j08", async (check) => {
  await check("ch2-rain-outdoor-indoor-and-sunny", async (page) => {
    // 1. 第2章・雨の日（weatherSeed=4, day=16）の柚ヶ谷マップ
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame();
      Object.assign(s, {
        chapter: 2,
        phase: "daily",
        day: 16,
        slot: 0,
        money: 32000,
        stamina: 100,
        weatherSeed: 4, // day=16 で isRainy(16) === true
      });
      s.flags = {
        _ch1_cleared: true,
        _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
        _ch2_preparation_started: true,
        _ch2_region: "widehanga",
        _morning_16: true,
        _ch2_morning_departed: 16,
        _ch2_commute_v1: true,
        _ch2_city_visit_c_station: true,
        _ageha_aquarium_introduced: true,
        _kumicho_sento_introduced: true,
        _rei_trpg_introduced: true,
        _lime_tut: 1,
        _lime_opened: true,
        _hiyori_meeting_done: true,
        _hiyori_message_delivered: true,
      };
      s.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true, ageha: true, kumicho: true, rei: true };
      core.save();
      window.__remake.vnTest.turbo = true;
      (await import("./js/chapters/ch1.js")).setupHooks();
      void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
    });

    await page.locator('.map[data-destination-selection][data-region="widehanga"]:not(.done) [data-test="pin-ch2_ageha"]').waitFor({ timeout: 30000 });
    const day2MapRain = await page.evaluate(() => ({
      weather: document.body.dataset.weather,
      sky: document.body.dataset.weatherSky,
      mode: document.querySelector("#weather")?.dataset.mode,
      view: document.querySelector("#weather")?.dataset.view,
      drops: document.querySelectorAll("#weather .weather-drop").length,
      depths: [...new Set([...document.querySelectorAll("#weather .weather-drop")].map((d) => d.dataset.depth))].sort(),
      ripples: document.querySelectorAll("#weather .weather-ripple").length,
      mist: document.querySelectorAll("#weather .weather-mist").length,
      weatherZ: Number(getComputedStyle(document.querySelector("#weather")).zIndex),
      screenZ: Number(getComputedStyle(document.querySelector("#screen")).zIndex),
    }));
    assert.equal(day2MapRain.weather, "outdoor");
    assert.equal(day2MapRain.sky, "day");
    assert.equal(day2MapRain.mode, "outdoor");
    assert.equal(day2MapRain.view, "map");
    assert.equal(day2MapRain.drops, 36);
    assert.deepEqual(day2MapRain.depths, ["far", "mid", "near"]);
    assert.equal(day2MapRain.ripples, 8);
    assert.equal(day2MapRain.mist, 1);
    assert(day2MapRain.weatherZ < day2MapRain.screenZ, "雨レイヤーは常にUI(#screen)の背面にある");
    await page.screenshot({ path: path.join(shotsDir, "01-ch2-rain-map-day.png") });

    // 2. 柚ヶ谷駅前広場（屋外・昼の雨）と C.STATION 柚ヶ谷店（窓あり室内・5窓×5粒=25粒）と MELTY PUFF（窓なし室内・0粒）
    const sceneChecks = await page.evaluate(async () => {
      const ui = await import("./js/core/ui.js");
      const { STATION } = await import("./js/chapters/ch2-city-data.js");
      const out = {};

      await ui.setBg(STATION, { instant: true });
      out.station = {
        mode: document.querySelector("#weather")?.dataset.mode,
        view: document.querySelector("#weather")?.dataset.view,
        sky: document.querySelector("#weather")?.dataset.sky,
        drops: document.querySelectorAll("#weather .weather-drop").length,
      };
      return out;
    });
    assert.deepEqual(sceneChecks.station, { mode: "outdoor", view: "station", sky: "day", drops: 36 });
    await page.screenshot({ path: path.join(shotsDir, "02-ch2-rain-station-day.png") });

    const cStationRain = await page.evaluate(async () => {
      const ui = await import("./js/core/ui.js");
      const { CITY_BACKGROUNDS } = await import("./js/core/city-locations.js");
      await ui.setBg(CITY_BACKGROUNDS.c_station, { instant: true });
      return {
        mode: document.querySelector("#weather")?.dataset.mode,
        windows: document.querySelectorAll("#weather .weather-sheet.window").length,
        drops: document.querySelectorAll("#weather .weather-drop").length,
      };
    });
    assert.deepEqual(cStationRain, { mode: "indoor", windows: 5, drops: 25 });
    await page.screenshot({ path: path.join(shotsDir, "03-ch2-rain-indoor-c-station.png") });

    const agehaIndoor = await page.evaluate(async () => {
      const ui = await import("./js/core/ui.js");
      const { ROOMS } = await import("./js/chapters/ch2-city-data.js");
      await ui.setBg(ROOMS.ageha, { instant: true });
      return {
        mode: document.querySelector("#weather")?.dataset.mode,
        windows: document.querySelectorAll("#weather .weather-sheet.window").length,
        drops: document.querySelectorAll("#weather .weather-drop").length,
      };
    });
    assert.deepEqual(agehaIndoor, { mode: "indoor", windows: 0, drops: 0 });
    await page.screenshot({ path: path.join(shotsDir, "04-ch2-rain-indoor-windowless-ageha.png") });

    // 3. 晴れの日（weatherSeed=0, day=16）は雨が一切出ない
    const sunnyCheck = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const ui = await import("./js/core/ui.js");
      const { MAP } = await import("./js/chapters/ch2-city-data.js");
      state.weatherSeed = 0;
      await ui.setBg(MAP.day, { instant: true });
      ui.refreshWeather();
      return {
        weather: document.body.dataset.weather,
        hidden: document.querySelector("#weather")?.hidden,
        drops: document.querySelectorAll("#weather .weather-drop").length,
      };
    });
    assert.deepEqual(sunnyCheck, { weather: "none", hidden: true, drops: 0 });
    await page.screenshot({ path: path.join(shotsDir, "05-ch2-sunny-map-day.png") });

    // 4. prefers-reduced-motion: reduce では雨粒・水紋アニメが非表示になり、静かな雨天空気層だけが残る
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedCheck = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const ui = await import("./js/core/ui.js");
      state.weatherSeed = 4;
      ui.refreshWeather();
      const drop = document.querySelector("#weather .weather-drop");
      const ripple = document.querySelector("#weather .weather-ripple");
      return {
        weather: document.body.dataset.weather,
        dropDisplay: drop ? getComputedStyle(drop).display : null,
        rippleDisplay: ripple ? getComputedStyle(ripple).display : null,
      };
    });
    assert.deepEqual(reducedCheck, { weather: "outdoor", dropDisplay: "none", rippleDisplay: "none" });
    await page.screenshot({ path: path.join(shotsDir, "06-ch2-rain-reduced-motion.png") });
  });
});
