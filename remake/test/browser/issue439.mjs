import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, turbo = true) {
  await page.evaluate(async (turbo) => {
    const core = await import("./js/core/state.js"), vn = await import("./js/vn/engine.js");
    const data = await import("./js/core/data.js"), ui = await import("./js/core/ui.js");
    const spots = await import("./js/daily/spots.js"), weather = await import("./js/daily/weather.js");
    core.newGame(); core.state.phase = "daily"; core.state.day = 8; core.state.weatherSeed = 4;
    vn.vnTest.turbo = turbo;
    window.I = { core, vn, data, ui, spots, weather };
    ui.showScreen("map", document.createElement("div"));
  }, turbo);
}

await suite("issue439", async (check) => {
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`intro-after-speech-${label}`, async (page) => {
      await setup(page, false);
      await page.evaluate(() => {
        I.core.markMet("tsumugi");
        I.talk = I.vn.play({ dialogue_id: "__439_intro", lines: [
          { speaker: "hajime", text: "つむぎちゃん？" },
          { type: "set_flag", flag: "_met_tsumugi" },
          { speaker: "tsumugi", face: "normal", text: "……あの。お店を、絵に描いてもいいですか" },
          { speaker: "hajime", text: "もちろん" },
        ] });
      });
      await page.locator(".vn-next.show").waitFor();
      assert.equal(await page.locator(".cutin").count(), 0);
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("描いてもいいですか"));
      assert.equal(await page.locator('.portrait[data-speaker="tsumugi"]:not(.enter)').count(), 1);
      assert.equal(await page.locator(".cutin").count(), 0, "紹介は本人の最初の発話を読むまで出さない");
      await page.keyboard.press("Enter");
      await page.locator('.cutin[data-char="tsumugi"]').waitFor();
      await page.locator(".cutin").waitFor({ state: "detached", timeout: 15000 });
      await page.locator(".vn-next.show").waitFor(); await page.keyboard.press("Enter"); await page.evaluate(() => I.talk);
    }, options);

    await check(`pakki-centered-${label}`, async (page) => {
      await setup(page);
      await page.evaluate(async () => { I.install = (await import("./js/daily/reel.js")).installReel(); });
      await page.locator('[data-test="reel-intro"]').waitFor();
      assert.match(await page.locator(".ri-text").innerText(), /C.STATION.*マスコット/);
      const layout = await page.evaluate(() => {
        const s = document.querySelector("#stage").getBoundingClientRect(), b = document.querySelector(".ri-panel").getBoundingClientRect();
        return { centered: Math.abs((b.top + b.bottom) / 2 - (s.top + s.bottom) / 2) < 2,
          inside: b.left >= s.left && b.right <= s.right && b.top >= s.top && b.bottom <= s.bottom,
          font: parseFloat(getComputedStyle(document.querySelector(".ri-text")).fontSize) };
      });
      assert(layout.centered && layout.inside && layout.font >= 26, JSON.stringify(layout));
      // パッキーの説明5ページのあとに、設定のシステム説明（#634）。どのページも画面内に収まる
      for (let i = 0; i < 12 && await page.locator(".reel-intro").count(); i++) {
        const fits = await page.evaluate(() => {
          const s = document.querySelector("#stage").getBoundingClientRect(), b = document.querySelector(".ri-panel").getBoundingClientRect();
          return b.top >= s.top && b.bottom <= s.bottom;
        });
        assert(fits, `intro page ${i + 1} overflows`);
        await page.locator(".reel-intro").click();
      }
      assert.equal(await page.locator(".reel-intro").count(), 0);
      await page.evaluate(() => I.install);
    }, options);

    await check(`facility-actions-${label}`, async (page) => {
      await setup(page);
      await page.evaluate(async () => {
        for (const id of Object.keys(I.data.DB.characters)) { I.core.state.met[id] = true; I.core.state.flags[`_intro_${id}`] = true; }
        Object.assign(I.core.state.flags, { _spot_guide_adam: true, _spot_guide_minto: true });
        I.core.state.flags._gym_member = true; I.core.state.flags._morning_8 = true; I.core.state.flags._lime_opened = true;
        I.core.state.reel.installed = false;
        I.run = (await import("./js/daily/calendar.js")).runDaily({ nightEvents: {}, onQuit() {} });
      });
      await page.locator('[data-test="pin-kannon"]').click();
      await page.locator('[data-test="map-go"]').click();
      await page.waitForFunction(() => I.core.state.slot === 1 && !!document.querySelector('#screen .map:not(.done)'));
      const first = await page.evaluate(() => ({ guts: I.core.state.stats.guts, slot: I.core.state.slot, count: I.core.state.reel.count, affinity: { ...I.core.state.affinity } }));
      assert.equal(first.guts, 12); assert.equal(first.slot, 1); assert.equal(first.count, 0);
      await page.locator('[data-test="pin-choizap"]').click();
      await page.locator('[data-test="map-go"]').click();
      await page.waitForFunction(() => I.core.state.stats.charm === 12);
      const second = await page.evaluate(() => ({ charm: I.core.state.stats.charm, affinity: { ...I.core.state.affinity } }));
      assert.equal(second.charm, 12); assert.deepEqual(second.affinity, first.affinity);
    }, options);

    await check(`rain-window-and-date-${label}`, async (page) => {
      await setup(page);
      const results = await page.evaluate(async () => {
        let seed = 0; while ((!I.weather.isRainy(8) || I.weather.isRainy(9)) && seed < 10000) I.core.state.weatherSeed = ++seed;
        I.core.state.day = 8; await I.ui.setBg(I.data.sceneBg("bg_cafe", "day").url, { instant: true });
        const rain = { weather: I.weather.weatherOf(), mode: document.body.dataset.weather,
          windowCount: document.querySelectorAll(".weather-sheet").length,
          preview: I.data.sceneBg("bg_cafe", "day") };
        I.core.state.day = 9; I.ui.refreshWeather();
        const dry = { weather: I.weather.weatherOf(), mode: document.body.dataset.weather, drops: document.querySelectorAll(".weather-drop").length };
        return { rain, dry, night: ["bg_kannon_day", "bg_choizap", "bg_cafe"].map(bg => I.data.sceneBg(bg, "night")) };
      });
      assert.equal(results.rain.weather, "rain"); assert.equal(results.rain.mode, "indoor"); assert(results.rain.windowCount > 0);
      assert.match(results.rain.preview.url, /bg_cafe_overcast_day/);
      assert.notEqual(results.dry.weather, "rain"); assert.equal(results.dry.mode, "none"); assert.equal(results.dry.drops, 0);
      assert(results.night.every(bg => /_night\.webp$/.test(bg.url) && bg.tint === null));
    }, options);
  }

  await check("slow-map-preview", async (page) => {
    await setup(page);
    await page.route("**/backgrounds/bg_kannon*.webp", async route => { await new Promise(resolve => setTimeout(resolve, 1200)); await route.continue(); });
    await page.evaluate(async () => {
      I.core.state.met.adam = true; I.core.state.flags._spot_guide_adam = true;
      I.map = (await import("./js/daily/map.js")).chooseSpot();
    });
    await page.locator('[data-test="pin-kannon"]').click();
    assert.match(await page.locator(".mi-preview").innerText(), /読み込んでいます/);
    await page.locator(".mi-preview:not(.loading)").waitFor();
    assert.match(await page.locator(".mi-preview").evaluate(node => getComputedStyle(node).backgroundImage), /bg_kannon/);
  });

  await check("flashback-and-return", async page => {
    await setup(page, false);
    await page.evaluate(() => {
      I.core.markMet("hiyori"); I.core.state.flags._intro_hiyori = true;
      I.talkDone = false;
      I.talk = I.vn.play({ dialogue_id: "__439_flashback", lines: [
        { type: "fx", id: "flashback" }, { speaker: "hiyori", face: "student_smile", text: "学生の頃" },
        { type: "fx", id: "flashback_off" }, { speaker: "hiyori", face: "normal", text: "今の話" },
      ] }).then(result => { I.talkDone = true; return result; });
    });
    await page.locator("#vn.flashback .vn-next.show").waitFor();
    assert.match(await page.locator(".vn-portraits").evaluate(node => getComputedStyle(node).filter), /grayscale\(1\)/);
    await page.keyboard.press("Enter"); await page.waitForSelector("#vn:not(.flashback) .vn-next.show");
    assert.equal(await page.locator(".vn-text").innerText(), "今の話", "Next must belong to the displayed line");
    assert.equal(await page.locator(".vn-portraits").evaluate(node => getComputedStyle(node).filter.includes("grayscale")), false);
    await page.keyboard.press("Enter"); await page.waitForFunction(() => I.talkDone);
  });

  await check("cheki-earned-after-photo", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      I.core.markMet("minto");
      const before = I.core.state.money, timeline = [], backgrounds = [];
      I.vn.hooks.onEnter = (_, dlg) => backgrounds.push(dlg.metadata?.bg);
      I.vn.hooks.onCg = id => timeline.push({ id, owned: I.core.state.keepsakes.includes("minto_first_cheki"), money: I.core.state.money });
      I.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(label => label.includes("チェキ（")));
      await I.vn.play("ch1_minto_first");
      I.vn.hooks.onCg = null;
      I.vn.hooks.onEnter = null;
      const bought = { before, timeline, backgrounds, after: I.core.state.money, owned: I.core.state.keepsakes.includes("minto_first_cheki") };
      await I.vn.play("ch1_minto_first");
      return { ...bought, afterReplay: I.core.state.money };
    });
    assert(result.owned); assert.equal(result.after, result.before - 1000); assert.equal(result.afterReplay, result.after);
    assert(result.timeline.some(item => item.id === "cg_minto_first_cheki" && !item.owned && item.money === result.before));
    assert.equal(result.backgrounds[0], "res://assets/backgrounds/peppermint.png", "初来店も店内で始まる");
  });

  await check("lime-exchange-once", async page => {
    await setup(page, false);
    await page.evaluate(() => {
      I.core.markMet("naru"); I.core.state.flags._intro_naru = true;
      I.dlg = { dialogue_id: "__439_lime", lines: [
        { speaker: "naru", text: "交換しよう" }, { type: "set_flag", flag: "_lime_contact_naru" },
        { speaker: "hajime", text: "よろしくお願いします" },
      ] }; I.talk = I.vn.play(I.dlg);
    });
    await page.locator(".vn-next.show").waitFor(); await page.keyboard.press("Enter");
    await page.locator(".mo-lime").waitFor();
    await page.locator(".mo-lime-toast").waitFor();
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".mo-lime-toast")).opacity === "1");
    assert.match(await page.locator(".mo-lime").innerText(), /なる.*友だちに追加しました/s);
    await page.screenshot({ path: ".codex/artifacts/remake-browser/issue439-lime.png" });
    await page.locator(".mo-lime").waitFor({ state: "detached" });
    await page.locator(".vn-next.show").waitFor(); await page.keyboard.press("Enter"); await page.evaluate(() => I.talk);
    // 交換演出の既読キーを持たない旧セーブでも、既存の連絡先を交換し直さない。
    await page.evaluate(() => { delete I.core.state.flags._lime_exchange_shown_naru; I.talk = I.vn.play(I.dlg); });
    await page.waitForFunction(() => document.querySelector("#vn.active .vn-text")?.textContent.includes("交換しよう"));
    await page.locator("#vn.active .vn-next.show").waitFor(); await page.keyboard.press("Enter");
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("よろしくお願いします"));
    assert.equal(await page.locator(".mo-lime").count(), 0);
    await page.locator(".vn-next.show").waitFor(); await page.keyboard.press("Enter"); await page.evaluate(() => I.talk);
  });
});
