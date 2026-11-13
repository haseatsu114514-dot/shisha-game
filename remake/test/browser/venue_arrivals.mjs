// 遊び場の来店のやり取り（VAR・daily/venue-arrivals.js）を、実際の入店経路で確かめる。
// 既定のブラウザテストは来店のやり取りを止めている（suien_roamers=off）ので、ここだけ "suien_venue_arrivals"="on" で外す。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
import { flickFromHandle } from "./axe_flick_input.mjs";
const t = id => `[data-test="${id}"]`;
const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function setup(page, { chapter = 1, day = 6, slot = 1, money = 12000, rain = false } = {}) {
  await page.evaluate(async ({ chapter, day, slot, money, rain }) => {
    window.V = {
      core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"), data: await import("./js/core/data.js"),
      weather: await import("./js/daily/weather.js"), arrivals: await import("./js/daily/venue-arrivals.js"), lines: [], result: undefined,
    };
    const s = V.core.newGame();
    Object.assign(s, { chapter, phase: "daily", day, slot, money, stamina: 80 });
    // 天気は保存の種で決まる。検査したい天気になる種を選ぶ
    for (let seed = 1; seed < 2000; seed++) { s.weatherSeed = seed; if (V.weather.isRainy() === rain) break; }
    V.core.config.textSpeed = 4; V.core.config.bgmVolume = 0; V.core.config.seVolume = 0;
    V.vn.hooks.onLine = (id, line) => V.lines.push({ id, speaker: line.speaker || "", text: line.text });
    V.ids = () => [...new Set(V.lines.map(line => line.id))];
    V.flags = () => Object.fromEntries(Object.entries(V.core.state.flags).filter(([key]) => key.startsWith("_venue_arrival_")));
    V.resources = () => { const s = V.core.state; return [s.money, s.stamina, s.day, s.slot]; };
  }, { chapter, day, slot, money, rain });
}
/** 会話を最後まで読む（normal は一行ずつ、skip は SKIP ボタン）。 */
async function readScene(page, mode = "normal") {
  await page.locator("#vn.active").waitFor();
  if (mode === "skip") {
    const button = page.locator(t("vn-skip"));
    if (!await button.evaluate(node => node.classList.contains("on"))) await button.click();
    await page.waitForFunction(() => !V.vn.isPlaying(), null, { timeout: 45000 });
    return;
  }
  const deadline = Date.now() + 45000;
  while (await page.evaluate(() => V.vn.isPlaying())) {
    assert(Date.now() < deadline, "会話を読み終えられない");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(110);
  }
}
const hostLine = page => page.locator(t("venue-host-line")).first().innerText();

await suite("venue-arrivals", async check => {
  // ---- 斧投げBar: 来店のたびに一本 → メニュー。同じ夜の入り直しでは読まない。次の夜は次の一本 ----
  for (const [device, options, mode] of [["pc", {}, "normal"], ["touch", touch, "skip"]]) {
    await check(`${device}-axe-bar-talks-before-menu`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = V.core.state;
        s.met.maki = true; Object.assign(s.flags, { _axe_bar_rumor_done: true, _axe_bar_sighting_done: true, _intro_maki: true, _axe_lesson_done: true });
        s.flags._axe_bar_records = { practice: { plays: 1, last: { total: 4, throws: [{ score: 4 }, { score: 0 }, { score: 0 }] }, best: { total: 4 } } };
        V.before = V.resources();
        V.open = async () => { V.result = undefined; V.result = await (await import("./js/daily/axe-bar.js")).visitAxeBar(); };
        V.flow = V.open();
      });
      await page.locator("#vn.active").waitFor();
      assert(await page.locator(t("axe-bar-menu")).evaluate(node => node.hidden), "会話の間はメニューを出さない");
      await readScene(page, mode);
      await page.locator(t("axe-bar-practice")).waitFor();
      const first = await page.evaluate(() => ({ ids: V.ids(), flags: V.flags(), speakers: [...new Set(V.lines.map(line => line.speaker))], now: V.resources(), before: V.before }));
      assert.deepEqual(first.ids, ["axe_arrival_whetstone"]);
      assert(first.speakers.includes("maki") && first.speakers.includes("hajime"));
      assert.deepEqual(first.flags, { _venue_arrival_at_axe_bar: "1:6:1", _venue_arrival_turn_axe_bar: 1 });
      assert.deepEqual(first.now, first.before, "会話は料金・体力・時間を使わない");
      // 会話の後のメニューは、挨拶を繰り返さない
      assert.match(await hostLine(page), /決まったら声かけな/);
      await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
      assert.equal(await page.evaluate(() => V.result), false);
      // 同じ夜に入り直す: 会話なしでメニュー
      await page.evaluate(() => { V.flow = V.open(); });
      await page.locator(t("axe-bar-practice")).waitFor();
      assert.equal(await page.evaluate(() => V.vn.isPlaying()), false);
      assert.deepEqual(await page.evaluate(() => V.ids()), ["axe_arrival_whetstone"], "入り直しでは読まない");
      await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
      // 保存して読み直した次の夜: 巡回の続き
      await page.evaluate(() => {
        V.core.saveToSlot("suien_remake_slot1"); V.core.newGame(); V.core.loadFromSlot("suien_remake_slot1");
        const s = V.core.state; s.day += 1;
        for (let seed = 1; seed < 2000; seed++) { s.weatherSeed = seed; if (!V.weather.isRainy()) break; }
        V.flow = V.open();
      });
      await readScene(page, mode);
      await page.locator(t("axe-bar-practice")).waitFor();
      assert.deepEqual(await page.evaluate(() => V.ids()), ["axe_arrival_whetstone", "axe_arrival_regulars"]);
      await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
    }, options);
  }

  // ---- 斧投げBar: 雨の夜の一度きりの回・投げる余裕のない夜の回 ----
  await check("axe-bar-rain-once-and-idle-visit", async page => {
    await setup(page, { rain: true });
    await page.evaluate(() => {
      const s = V.core.state;
      s.met.maki = true; Object.assign(s.flags, { _axe_bar_rumor_done: true, _axe_bar_sighting_done: true, _intro_maki: true, _axe_lesson_done: true });
      V.open = async () => { V.result = undefined; V.result = await (await import("./js/daily/axe-bar.js")).visitAxeBar(); };
      V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("axe-bar-practice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["axe_arrival_rain"]);
    assert.equal(await page.evaluate(() => V.flags()._venue_arrival_seen_axe_arrival_rain), true);
    // まだ記録の無い人のメニューの一言
    assert.match(await hostLine(page), /的は逃げない/);
    await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
    // 次の雨の夜、お金が足りない: 見ていくだけの回。ボタンは押せない
    await page.evaluate(() => {
      const s = V.core.state; s.day += 1; s.money = 1000;
      for (let seed = 1; seed < 2000; seed++) { s.weatherSeed = seed; if (V.weather.isRainy()) break; }
      V.lines.length = 0; V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("axe-bar-practice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["axe_arrival_look"]);
    assert(await page.locator(t("axe-bar-practice")).isDisabled());
    assert.equal(await page.evaluate(() => V.flags()._venue_arrival_turn_axe_bar), undefined, "見ていくだけの夜は巡回を進めない");
    await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
  });

  // ---- 斧投げBar: 投げ終えた後は、結果に合った締めの会話。次の来店でマキがその結果に触れる ----
  await check("axe-bar-finish-conversation-and-next-visit", async page => {
    await setup(page);
    await page.evaluate(() => {
      const s = V.core.state;
      s.met.maki = true; Object.assign(s.flags, { _axe_bar_rumor_done: true, _axe_bar_sighting_done: true, _intro_maki: true, _axe_lesson_done: true });
      V.open = async () => { V.result = undefined; V.result = await (await import("./js/daily/axe-bar.js")).visitAxeBar(); };
      V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("axe-bar-practice")).click();
    // 3投。的を押して狙い、取っ手から上へ弾く（play_spots.mjs と同じ操作。点は問わない）
    const phase = name => page.waitForFunction(p => document.querySelector('[data-test="axe-game"]')?.dataset.phase === p, name, { timeout: 30000 });
    for (let i = 0; i < 3; i++) {
      await phase("choice");
      const point = await page.locator(t("axe-target")).evaluate(node => {
        const p = new DOMPoint(330, 245).matrixTransform(node.getScreenCTM());
        return { x: p.x, y: p.y };
      });
      await page.mouse.click(point.x, point.y);
      await phase("power");
      await flickFromHandle(page, { touch: false, power: .3 });
      await phase("result"); await page.locator(t("axe-action")).click();
    }
    await phase("summary");
    await page.evaluate(() => { V.lines.length = 0; });
    await page.locator(t("axe-action")).click();
    await readScene(page);
    await page.waitForFunction(() => V.result !== undefined);
    const done = await page.evaluate(() => ({ result: V.result, ids: V.ids(), flags: V.flags(), money: V.core.state.money,
      record: V.core.state.flags._axe_bar_records.practice, speakers: [...new Set(V.lines.map(line => line.speaker))] }));
    assert.equal(done.result, true, "締めの会話を読み終えて、行動を使ったと返す");
    assert.equal(done.money, 12000 - 3000);
    // 初めての完走なので自己ベスト扱いにはしない。0点なら「刺さらなかった」、それ以外はいつもの締めの一本目
    const miss = done.record.last.total === 0;
    assert.deepEqual(done.ids, [miss ? "axe_finish_miss" : "axe_finish_a"]);
    assert(done.speakers.includes("maki"));
    assert.equal(done.flags._venue_arrival_note_axe_bar, miss ? "miss" : undefined);
    assert.equal(done.flags._venue_arrival_turn_axe_bar_finish, miss ? undefined : 1);
    // 次の夜: 一本も刺さらなかった日の後は、マキがそれに触れる。そうでなければ巡回の続き
    await page.evaluate(() => {
      const s = V.core.state; s.day += 1;
      for (let seed = 1; seed < 2000; seed++) { s.weatherSeed = seed; if (!V.weather.isRainy()) break; }
      V.lines.length = 0; V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("axe-bar-practice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), [miss ? "axe_arrival_after_miss" : "axe_arrival_regulars"]);
    assert.equal(await page.evaluate(() => V.flags()._venue_arrival_note_axe_bar), undefined, "メモは受けたら消える");
    await page.locator(t("axe-bar-back")).click(); await page.evaluate(() => V.flow);
  });

  // ---- クラブSEAM: 二度目からはヨルとのやり取り → セット選び ----
  await check("club-seam-talks-before-menu", async page => {
    await setup(page, { chapter: 3, day: 35 });
    await page.evaluate(async () => {
      const dj = await import("./js/minigames/dj.js"), s = V.core.state;
      s.met.yoru = true; s.flags._intro_yoru = true; s.flags[dj.CLUB_MET_FLAG] = true;
      // 一度は回したことがある人（メニューの一言が「おかえり」になる側）
      s.dj = { sets: { 1: { plays: 1, best: { rank: "B", total: 70, floor: 60, chapter: 3, day: 34 } } }, bestRank: "B" };
      V.played = Object.values(dj.djRecords(s).sets).some(item => item.plays > 0);
      V.before = V.resources();
      V.open = async () => { V.result = undefined; V.result = await (await import("./js/daily/dj-club.js")).visitDjClub(); };
      V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("dj-club-menu")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["club_arrival_stairs"]);
    assert(await page.evaluate(() => V.played), "記録の準備");
    assert.deepEqual(await page.evaluate(() => V.resources()), await page.evaluate(() => V.before), "会話は時間もお金も使わない");
    assert.match(await hostLine(page), /どのセットにする/);
    await page.locator(t("dj-club-back")).click(); await page.evaluate(() => V.flow);
    await page.evaluate(() => { V.flow = V.open(); });
    await page.locator(t("dj-club-menu")).waitFor();
    assert.equal(await page.evaluate(() => V.vn.isPlaying()), false);
    assert.deepEqual(await page.evaluate(() => V.ids()), ["club_arrival_stairs"], "同じ夜の入り直しでは読まない");
    await page.locator(t("dj-club-back")).click(); await page.evaluate(() => V.flow);
    // 次の夜は、店内のひとこま（書かれたまま再生されていなかった場面）
    await page.evaluate(() => {
      const s = V.core.state; s.day += 1;
      for (let seed = 1; seed < 2000; seed++) { s.weatherSeed = seed; if (!V.weather.isRainy()) break; }
      V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("dj-club-menu")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["club_arrival_stairs", "ch3_club_floor_edge"]);
    await page.locator(t("dj-club-back")).click(); await page.evaluate(() => V.flow);
  });

  // ---- ボドゲカフェ: 昼と夜で別の束。夜は、卓を囲めない夜ならその話にする ----
  await check("trpg-cafe-day-night-and-busy-night", async page => {
    await setup(page, { chapter: 2, day: 18, slot: 0 });
    await page.evaluate(() => {
      const s = V.core.state;
      s.met.sai = true; Object.assign(s.flags, { _rei_trpg_introduced: true, _intro_sai: true });
      s.trpg.club = { founded: { chapter: 2, day: 16 }, members: {} };
      V.busy = false;
      V.open = async () => { V.result = undefined; V.result = await (await import("./js/daily/trpg.js")).openTrpgBar({ nightBusy: () => V.busy }); };
      V.flow = V.open();
    });
    await readScene(page);
    await page.locator(t("trpg-campaign-notice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["trpg_day_shelf"]);
    assert.match(await hostLine(page), /お決まりになったら/);
    await page.locator(t("trpg-campaign-close")).click(); await page.evaluate(() => V.flow);
    // 夜: 棚の本と顔ぶれで卓を囲める夜は、席へ案内する
    await page.evaluate(() => { V.core.state.slot = 1; V.lines.length = 0; V.flow = V.open(); });
    await readScene(page);
    await page.locator(t("trpg-campaign-notice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["trpg_night_lamp"]);
    assert.match(await hostLine(page), /今夜の一冊と顔ぶれ/);
    await page.locator(t("trpg-campaign-close")).click(); await page.evaluate(() => V.flow);
    // 先に決まった予定のある夜: 席の話はしない
    await page.evaluate(() => { const s = V.core.state; s.day += 1; V.busy = true; V.lines.length = 0; V.flow = V.open(); });
    await readScene(page);
    await page.locator(t("trpg-campaign-notice")).waitFor();
    assert.deepEqual(await page.evaluate(() => V.ids()), ["trpg_night_idle"]);
    assert.match(await page.locator(t("trpg-campaign-notice")).first().innerText(), /先に決まった予定/);
    assert.equal(await page.evaluate(() => V.flags()._venue_arrival_turn_trpg_night), 1, "卓を囲めない夜は巡回を進めない");
    await page.locator(t("trpg-campaign-close")).click(); await page.evaluate(() => V.flow);
  });

  // ---- ラクダレース場: 通いの朝のやり取りを読んでからレースへ（レースの手前で止めて確かめる） ----
  await check("camel-track-morning-exchange", async page => {
    await setup(page, { chapter: 4, day: 60, slot: 0 });
    const result = await page.evaluate(async () => {
      const [{ readDialogues }, race, { play }, { setBg }, ui] = await Promise.all([
        import("./js/core/chapter-data.js"), import("./js/chapters/ch4-camel-race.js"), import("./js/vn/engine.js"),
        import("./js/core/ui.js"), import("./js/core/data.js"),
      ]);
      const s = V.core.state;
      Object.assign(V.data.DB.dialogues, await readDialogues("ch4_camel_race", race.CH4_CAMEL_SCENE_FILES.ch4_camel_race));
      s.flags._ch2_region = "dubai";
      s.flags[race.CAMEL_FLAG] = { stage: race.CAMEL_STAGES.unlocked, watched: true, plays: 1, meetDay: 50, inviteDay: 51, lastPlayDay: 59 };
      for (const id of ["faris", "khalil"]) s.met[id] = true;
      V.bgs = [];
      const abort = new AbortController();
      // 本編と同じ読み方（背景は場面ごと）。読み終えたらレースの手前で止める
      const read = async id => {
        V.bgs.push(race.camelSceneBg(id)); await setBg(ui.bgUrl(race.camelSceneBg(id)));
        const done = await play(V.data.DB.dialogues[id]); abort.abort();
        return !!done && !done.cancelled;
      };
      V.vnTurbo = V.vn.vnTest.turbo; V.vn.vnTest.turbo = true;
      const visit = await race.visitCamelRace({ read, signal: abort.signal, beforeRace: () => { V.raced = true; } });
      V.vn.vnTest.turbo = V.vnTurbo;
      return { visit, ids: V.ids(), bgs: V.bgs, raced: !!V.raced, flags: V.flags(), slot: s.slot };
    });
    assert.deepEqual(result.ids, ["ch4_camel_replay"], "書かれたまま再生されていなかった再挑戦の朝");
    assert.deepEqual(result.bgs, ["bg_dubai_camel_track_morning"]);
    assert.deepEqual(result.flags, { _venue_arrival_at_camel_track: "4:60:0", _venue_arrival_turn_camel_track: 1 });
    assert.deepEqual([result.visit.used, result.raced, result.slot], [false, false, 0], "会話だけでは昼の枠を使わない");
  });
}, { initScript: () => { try { localStorage.setItem("suien_venue_arrivals", "on"); } catch {} } });
