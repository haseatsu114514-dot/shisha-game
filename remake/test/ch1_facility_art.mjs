// Set B: established asset IDs, PC/touch UI, fixed night variants and real window rain.
import assert from "node:assert/strict";
import { suite, storageSnapshot, assertFits } from "./browser/support.mjs";

const cases = [
  ["bg_c_station_day", "day", "naru", "ch1_meet_rivals"],
  ["bg_c_station_night", "night", "naru", "ch1_meet_rivals"],
  ["bg_c_station_overcast_day", "day", "naru", "ch1_meet_rivals"],
  ["bg_c_station_overcast_night", "night", "naru", "ch1_meet_rivals"],
  ["bg_c_station_lobby", "day", "pakki", "ch1_tournament_opening"],
  ["bg_fookah_showroom", "day", "rin", "ch1_rin_first"],
  ["bg_shop", "day", "rin", "ch1_rin_first"],
  ["kemurikusa", "night", "naru", "ch1_naru_first"],
  ["peppermint", "night", "minto", "ch1_minto_first"],
  ["bg_tournament_stage", "night", "pakki", "ch1_tournament_opening"],
];

await suite("ch1-facility-art", async check => {
  for (const [device, viewport] of [["pc", { width: 1920, height: 1080 }], ["touch", { width: 844, height: 390 }]]) {
    for (const [id, time, speaker, dialogue] of cases) {
      await check(`${device}-${id}`, async page => {
        const saved = await storageSnapshot(page);
        const result = await page.evaluate(async ({ id, time, speaker, dialogue }) => {
          const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
          const ui = await import("./js/core/ui.js"), engine = await import("./js/vn/engine.js");
          core.newGame(); Object.assign(core.state, { phase: "daily", day: 4, slot: time === "day" ? 0 : 1, weatherSeed: 2 });
          core.state.met[speaker] = true; core.state.flags[`_intro_${speaker}`] = true;
          core.config.textSpeed = 4; ui.clearScreen();
          const art = data.sceneBg(id, time);
          const im = new Image(); im.src = art.url; const start = performance.now(); await im.decode();
          await ui.setBg(art.url, { instant: true, tint: art.tint });
          // Only an actual spoken line is used as a rendering fixture; no event flags/rewards.
          const line = data.DB.dialogues[dialogue].lines.find(l => l.speaker === speaker && l.text);
          if (!line) throw new Error(`Missing canonical spoken line: ${dialogue}/${speaker}`);
          void engine.play({ dialogue_id: `facility-art-${id}`, metadata: { bg: id }, lines: [{ ...line, face: "normal" }] });
          return { url: art.url, tint: art.tint, size: [im.naturalWidth, im.naturalHeight], decodeMs: performance.now() - start };
        }, { id, time, speaker, dialogue });
        assert.equal(result.url, `img/backgrounds/${id}.webp`);
        assert.equal(result.tint, null);
        assert.deepEqual(result.size, [1920, 1080]);
        await page.locator(".vn-text").waitFor();
        await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.length > 0 && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99);
        assert.equal(await page.locator(`.portrait[data-speaker="${speaker}"]`).evaluate(im => im.complete && im.naturalWidth > 0), true);
        await assertFits(page, ".vn-text");
        assert.deepEqual(await storageSnapshot(page), saved);
      }, { viewport, ...(device === "touch" ? { isMobile: true, hasTouch: true } : {}) });
    }
    for (const time of ["day", "night"]) await check(`${device}-window-rain-${time}`, async page => {
      const result = await page.evaluate(async time => {
        const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
        const ui = await import("./js/core/ui.js"), engine = await import("./js/vn/engine.js"), wx = await import("./js/daily/weather.js");
        core.newGame(); Object.assign(core.state, { phase: "daily", day: 4, slot: time === "day" ? 0 : 1, weatherSeed: 1 });
        core.state.met.naru = true; core.state.flags._intro_naru = true; core.config.textSpeed = 4;
        ui.clearScreen(); const art = data.sceneBg("bg_c_station", time);
        await ui.setBg(art.url, { instant: true });
        const line = data.DB.dialogues.ch1_meet_rivals.lines.find(l => l.speaker === "naru" && l.text);
        if (!line) throw new Error("Missing canonical spoken line: ch1_meet_rivals/naru");
        void engine.play({ dialogue_id: "facility-rain", metadata: { bg: "bg_c_station" }, lines: [line] });
        return { url: art.url, rain: wx.rainScene(art.url, "vn"), text: line.text };
      }, time);
      await page.waitForFunction(text => document.querySelector(".vn-text")?.textContent === text
        && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99, result.text);
      assert.equal(result.url, `img/backgrounds/bg_c_station_overcast_${time}.webp`);
      assert.equal(result.rain.mode, "indoor");
      assert.equal(await page.locator("#weather .weather-drop").count(), result.rain.windows.length * 5);
      assert.equal(await page.locator("#weather .outdoor").count(), 0);
      await assertFits(page, ".vn-text");
    }, { viewport, ...(device === "touch" ? { isMobile: true, hasTouch: true } : {}) });
  }
});
