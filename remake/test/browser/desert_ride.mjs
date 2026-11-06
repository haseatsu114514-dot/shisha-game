// DESERT RIDE（第4章ドバイ・サンドボード）: 単体ページ（PCの鍵盤・スマホのタッチ・動き軽減）と、
// 第4章の本編接続（デスクで3日話す→砂丘へ→練習→本番→記録→夕日→同じ日は二度行けない→SAVE/LOAD→中断）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const ride = (page, code) => page.evaluate(code);
const game = page => page.evaluate(() => { const g = window.__desertRide?.game; return g ? { z: g.z, x: g.x, air: g.air, airKind: g.airKind, t: g.t, score: g.score, falls: g.falls, finished: g.finished, hops: g.stats.hops, bigJumps: g.stats.bigJumps } : null; });
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === value, value, { timeout: 90000 });
const autoplayToResult = async (page, skill = "expert") => {
  await page.evaluate(skill => { window.__desertRide.autoplay(skill); window.__desertRide.setSpeedUp(8); }, skill);
  await phase(page, "result");
};
const resultText = async page => (await page.locator(t("desert-result")).innerText()).replace(/\s+/g, " ");

await suite("desert-ride", async check => {
  await check("standalone-page-keyboard-run-result-best-and-quit", async page => {
    await page.goto(new URL("desert-ride.html", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-menu")).waitFor();
    assert.match(await page.locator(t("desert-menu")).innerText(), /DESERT RIDE/);
    assert.equal(await page.locator(t("desert-best")).count(), 0, "no best yet");
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    // 本番はスタートの合図（3・2・1・GO）から。合図の間は進まず、ヌールが左に並んでいる
    assert(await page.evaluate(() => window.__desertRide.countdown > 0), "the run starts with a countdown");
    assert.equal(await page.locator(t("desert-race-gap")).innerText(), "VS ヌール");
    assert(await page.evaluate(() => window.__desertRide.rival.finishTime > 45), "Noor races the same course");
    // PC: → を押し続けると慣性で右へ、Space はホップ（起伏が無い所）
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => window.__desertRide.game.x > 0.3);
    await page.keyboard.up("ArrowRight");
    let g = await game(page);
    assert(g.x > 0.3 && g.hops === 0);
    await page.keyboard.press("Space");
    g = await game(page);
    assert(g.hops === 1 || g.bigJumps === 1, "Space jumps");
    assert(await page.locator(t("desert-left")).isVisible() && await page.locator(t("desert-jump")).isVisible(), "touch buttons are shown on PC too");
    // Codex の採用画像（遠景の空・陸、主人公の背面、岩、旗、ゴール、砂煙）を読み込んで描いている
    const loaded = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name).filter(name => name.includes("/img/ui/desert_ride/")).map(name => name.split("/").pop()).sort());
    assert.deepEqual(loaded, ["backdrop_day_land.webp", "backdrop_day_sky.webp", "backdrop_dusk_land.webp", "backdrop_dusk_sky.webp", "flag_pole.webp", "goal_banner.webp",
      "rider_brace.webp", "rider_fall.webp", "rider_jump.webp", "rider_lean_left.webp", "rider_lean_right.webp",
      "rider_noor_brace.webp", "rider_noor_fall.webp", "rider_noor_jump.webp", "rider_noor_lean_left.webp", "rider_noor_lean_right.webp", "rider_noor_ride.webp",
      "rider_ride.webp", "rock_large.webp", "rock_small.webp", "sand_puff.webp"]);
    // 空中トリックとブーストを使う理想の滑り: S、ヌールに勝つ。360 以上を決めるとカットインが走る
    await page.evaluate(() => {
      window.__cutins = [];
      const node = document.querySelector('[data-test="desert-cutin"]');
      new MutationObserver(() => { if (node.classList.contains("show")) window.__cutins.push(node.dataset.degrees); }).observe(node, { attributes: true, attributeFilter: ["class"] });
    });
    await autoplayToResult(page, "expert");
    const cutins = await page.evaluate(() => window.__cutins);
    assert(cutins.length >= 5 && cutins.includes("720"), `a cut-in for each big trick (${cutins.join(", ")})`);
    assert.equal(await page.locator(".dr-cutin-rider").count() <= 1, true);
    const text = await resultText(page);
    assert.match(text, /RESULT/); assert.match(text, /転倒 0 回/); assert.match(text, /大ジャンプ 7 回/); assert.match(text, /自己ベスト更新/);
    assert.match(text, /トリック 7 回（最高 720）/); assert.match(text, /ブースト [2-9] 回/);
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-won"), "true");
    assert.match(await page.locator(t("desert-race")).innerText(), /ヌールに勝った！/);
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "S", "the ideal run is S on the fixed course");
    const total = Number((await page.locator(t("desert-total")).innerText()).replace(/[^\d]/g, ""));
    assert(total >= 16000, `S needs 16000+ (${total})`);
    assert.match(await page.locator(t("desert-time")).innerText(), /(4[5-9]|5\d)\.\d 秒/, "a run takes about a minute");
    // もう一度 → 途中でやめる（Escape）: 記録は残らず、メニューへ
    await page.locator(t("desert-retry")).click();
    await phase(page, "run");
    await page.waitForFunction(() => window.__desertRide.game.z > 60);
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    assert.match(await page.locator(t("desert-menu")).innerText(), /途中でやめた/);
    assert.match(await page.locator(t("desert-best")).innerText(), new RegExp(`自己ベスト ${total.toLocaleString("ja-JP")}点 ／ S`));
    assert.equal(await page.evaluate(() => window.__desertRide.results.length), 1, "the abandoned run is not a result");
    await page.locator(t("desert-leave")).click();
    await page.locator(t("desert-page-best")).waitFor();
    assert.equal(await page.locator(t("desert-ride")).count(), 0, "the game cleans itself up");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")).rank), "S");
    // ヌールに勝ったので、単体ページでもなる（裏の相手）と勝負できる
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")).beatNoor), true);
    await page.locator(t("desert-page-naru")).waitFor();
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start-naru")).click();
    await phase(page, "run");
    assert.equal(await page.evaluate(() => window.__desertRide.raceWith), "naru");
    assert.equal(await page.locator(t("desert-race-gap")).innerText(), "VS なる");
    await autoplayToResult(page, "perfect");
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-who"), "naru");
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-won"), "false", "clean landings without spins lose to Naru");
    await page.locator(t("desert-leave")).click();
    await page.locator(t("desert-page-best")).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), null, "the page never touches the real save");
  });

  await check("phone-touch-buttons-reduced-motion-and-tutorial", async page => {
    await page.goto(new URL("desert-ride.html", page.url()).href);
    await page.locator(t("desert-page-reduce")).check();
    await page.locator(t("desert-page-tutorial")).tap();
    await phase(page, "practice");
    assert.equal(await page.locator(t("desert-ride")).getAttribute("data-reduced-motion"), "true");
    assert.equal(await page.locator(t("desert-caption")).innerText(), "← → で左右に動こう");
    // ボタンは下辺の左右に分かれ、真ん中の視界を隠さない
    const stage = await page.locator("#stage").boundingBox();
    const left = await page.locator(t("desert-left")).boundingBox(), right = await page.locator(t("desert-right")).boundingBox(), jump = await page.locator(t("desert-jump")).boundingBox();
    const boostButton = await page.locator(t("desert-boost")).boundingBox();
    for (const box of [left, right, jump, boostButton]) {
      assert(box.width >= 100 * (stage.width / 1280) && box.height >= 80 * (stage.height / 720), "buttons are big enough for a thumb");
      assert(box.y > stage.y + stage.height * 0.7, "buttons sit at the bottom");
    }
    assert(right.x + right.width < stage.x + stage.width * 0.35 && jump.x > stage.x + stage.width * 0.7, "the middle of the view stays clear");
    // 右を押している間だけ右へ。離すと入力が消える
    const press = async (box, hold) => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(hold);
      await page.mouse.up();
    };
    await press(right, 700);
    let g = await game(page);
    assert(g.x > 0.2, `held right moves right (${g.x})`);
    const inputs = await page.evaluate(() => { const b = document.querySelector('[data-test="desert-right"]'); return b.classList.contains("on"); });
    assert.equal(inputs, false, "released button is off");
    await press(jump, 60);
    g = await game(page);
    assert(g.hops + g.bigJumps >= 1, "the jump button jumps");
    // BOOST ボタン: ゲージが空の間は効かず、ストックがあれば部分ゲージでも超加速
    await press(boostButton, 60);
    assert.equal(await page.evaluate(() => window.__desertRide.game.stats.boosts), 0, "an empty gauge does not boost");
    await page.evaluate(async () => { const { chargeBoost } = await import("./js/minigames/desert-ride-model.js"); chargeBoost(window.__desertRide.game, 0.4); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]').dataset.gauge === "full");
    await press(boostButton, 60);
    assert.equal(await page.evaluate(() => window.__desertRide.game.stats.boosts), 1, "the BOOST button spends a partial gauge");
    assert.equal(await page.evaluate(() => window.__desertRide.game.gauge), 0, "the BOOST button consumes the stocked gauge");
    assert(await page.evaluate(() => window.__desertRide.game.boostT > 0), "the partial gauge gives boost time");
    // 練習は説明つきで（回転・ブーストまで）、終わると本番へ進むカード
    await page.evaluate(() => {
      window.__captions = [];
      new MutationObserver(() => { const text = document.querySelector('[data-test="desert-caption"]').textContent; if (text && !window.__captions.includes(text)) window.__captions.push(text); })
        .observe(document.querySelector('[data-test="desert-caption"]'), { childList: true, characterData: true, subtree: true });
      window.__desertRide.autoplay("expert"); window.__desertRide.setSpeedUp(4);
    });
    await phase(page, "practiced");
    const captions = await page.evaluate(() => window.__captions);
    assert(captions.some(text => /空中で ← か → を押し続けて回ろう/.test(text)), `the lesson teaches the spin (${captions.join(" / ")})`);
    assert(captions.some(text => /溜まったゲージで↓（BOOST）を押すと超加速/.test(text)), `the lesson explains stocked boost (${captions.join(" / ")})`);
    assert.match(await page.locator(t("desert-practiced")).innerText(), /練習おわり/);
    await page.locator(t("desert-start")).tap();
    await phase(page, "run");
    await autoplayToResult(page, "none");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "C", "dodging without any jump is a C");
    assert.match(await resultText(page), /大ジャンプ 0 回/);
    await page.locator(t("desert-leave")).tap();
    await page.locator(t("desert-page-best")).waitFor();
  }, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  await check("chapter-four-desk-talks-outing-record-sunset-day-use-save-load-and-interrupt", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 4, day: 46, slot: 0, phase: "daily", money: 50000, stamina: 100, lovers: [], contacts: ["sumi"] });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _overseas_companion: { decided: true, companion: null, supports: [] }, _ch4_sheikh_revealed: false, _ch4_strategy: "sakura",
        _ch4: { startDay: 46, day: 1, stage: 4, part: "free", titleSeen: true, resolution: 0, attempts: 0, firstDay: null,
          read: { ch4_sumi_training: true, ch4_strategy: true, ch4_opening: true, ch4_arrival_inn: true } } };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    await arm();
    const before = await get(page);
    const freeDay = day => page.locator(t("ch4-free")).getByRole("heading", { name: new RegExp(`^DAY ${day}・`) }).waitFor();
    const talksDone = n => page.waitForFunction(n => window.__remake.state.flags._ch4_desert?.talks === n, n);
    // DAY1: デスクをのぞく → 名乗り → 登場カットイン。同じ日は二度話せない。
    assert.match(await page.locator(t("ch4-go-tour_desk")).innerText(), /カフェ/);
    assert.equal(await page.locator(t("ch4-go-dunes")).count(), 0, "the dunes wait for the invitation");
    await page.locator(t("ch4-go-tour_desk")).click();
    await talksDone(1);
    await freeDay(1);
    let value = await get(page);
    // 立ち絵があるので、登場カットインは会話エンジンが名乗りの直後に出す（このテストは早送りなので既読の印だけが付く）
    assert.equal(value.met.noor, true); assert.equal(value.flags._intro_noor, true, "the guide's intro cut-in is marked as seen");
    assert(await page.locator(t("ch4-go-tour_desk")).isDisabled(), "one talk per day");
    assert.equal(value.flags._ch4.day, 1, "talking does not advance the day");
    // DAY2・DAY3: 続きの会話 → 誘い → 砂丘が地図に出る
    await page.locator(t("ch4-go-inn")).click(); await freeDay(2);
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(2); await freeDay(2);
    await page.locator(t("ch4-go-inn")).click(); await freeDay(3);
    // 旧カードの地図（5日）は以前と同じ3回目で誘う（店の3つ目は飛ばして、段階は全部読んだ扱い）
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(4);
    await page.locator(".toast", { hasText: "ヌールと砂丘へ" }).waitFor();
    await freeDay(3);
    value = await get(page);
    assert(value.affinity.noor > 0, "talking at the café raises Noor's affinity");
    assert.equal(await page.locator(t("ch4-go-tour_desk")).count(), 0, "the desk gives way to the dunes");
    assert.match(await page.locator(t("ch4-go-dunes")).innerText(), /ヌールと砂丘へ/);
    assert.match(await page.locator(t("ch4-free")).innerText(), /昼の行動を1つ使う/);
    // 砂丘へ: 到着の場面 → 外出を確定 → 練習 → 本番 → 記録
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "practice");
    assert.match(await page.locator("#bg .bg-img").last().evaluate(node => node.style.backgroundImage), /bg_dubai_dunes_day/, "the arrival scene uses the adopted dunes background");
    value = await get(page);
    assert.equal(value.slot, 1, "the trip spends the daytime action (shared with the camel race)");
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 1, lastOutingDay: 3 }, "the outing is spent when the trip starts");
    assert.equal(value.money, before.money, "the first trip is free");
    assert.equal(value.desert, undefined);
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
    assert.match(await page.locator(t("desert-practiced")).innerText(), /ヌール「上手！/);
    await page.locator(t("desert-start")).click();
    // 1本目は着地が遅い滑り: B。ヌールと同じ滑りなので競走は負け
    await autoplayToResult(page, "good");
    await page.locator(".toast", { hasText: "ヌール「" }).waitFor();
    await page.locator(".toast", { hasText: "初めての完走" }).waitFor();
    value = await get(page);
    assert.equal(value.desert.runs, 1); assert.equal(value.desert.best.rank, "B"); assert.equal(value.desert.bestRank, "B");
    assert.equal(value.desert.wins, 0); assert.equal(value.desert.best.race.won, false);
    assert.deepEqual(value.desert.firstClear, { chapter: 4, day: 48 }); assert.equal(value.desert.rewarded, true);
    assert.deepEqual(value.stats, before.stats, "no direct stat gain"); assert.equal(value.money, before.money);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("suien_remake_save"))).desert.bestRank, "B", "recorded to the autosave");
    // 同じ外出の中の再挑戦: 行動は増えず、記録だけ増える。自己ベストは点数で更新。回ってブーストすればヌールに勝つ（勝ちのひとこと）
    await page.locator(t("desert-retry")).click();
    await autoplayToResult(page, "expert");
    await page.locator(".toast", { hasText: "ヌール「悔しいけど、今日は私の負け。次は負けないからね」" }).waitFor();
    value = await get(page);
    assert.equal(value.desert.runs, 2); assert.equal(value.desert.bestRank, "S"); assert.equal(value.flags._ch4_desert.outings, 1);
    assert.equal(value.desert.wins, 1);
    assert.match(await resultText(page), /自己ベスト更新/);
    // 初めて勝った日は、夕日の前に旗の下で短く話す
    await page.evaluate(async () => {
      const { hooks } = await import("./js/vn/engine.js");
      window.__played = [];
      const previous = hooks.onEnter;
      hooks.onEnter = (id, dlg) => { window.__played.push(id); return previous?.(id, dlg); };
    });
    // 砂丘を下りる → （初勝利の会話）→ 夕日の場面（大会前の分岐）→ 地図。今日はもう行けない。
    await page.locator(t("desert-leave")).click();
    await freeDay(3);
    const played = await page.evaluate(() => window.__played);
    assert(played.indexOf("ch4_desert_race_first_win") >= 0 && played.indexOf("ch4_desert_race_first_win") < played.indexOf("ch4_desert_sunset_first"),
      `the first win talk comes before the sunset (${played.join(", ")})`);
    assert(await page.locator(t("ch4-go-dunes")).isDisabled(), "no second trip on the same day");
    assert.match(await page.locator(t("ch4-free")).innerText(), /今日はもう砂丘へ行った/);
    value = await get(page);
    assert.equal(value.flags._ch4.day, 3); assert.equal(value.day, 48, "the trip itself does not advance the calendar");
    // SAVE → LOAD: 記録と行動の消費が残る
    await page.locator(t("ch4-menu")).click(); await page.locator(t("ch4-save")).click(); await page.locator(t("slot-1")).click();
    await page.reload();
    await page.locator(t("title-load")).click();
    await arm();
    await page.locator(t("slot-1")).click();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.desert.bestRank, "S"); assert.equal(value.desert.runs, 2);
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 1, lastOutingDay: 3 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled());
    // 翌日はまた行ける。2回目の外出は短い到着 → 練習なしで本番。途中で中断（再読込）しても外出の消費だけ残り、記録は増えない。
    await page.locator(t("ch4-go-inn")).click(); await freeDay(4);
    assert(!(await page.locator(t("ch4-go-dunes")).isDisabled()));
    assert.match(await page.locator(t("ch4-free")).innerText(), /自己ベスト/);
    assert.match(await page.locator(t("ch4-free")).innerText(), /6,000円/, "the second trip shows the tour fee");
    const moneyBefore = (await get(page)).money;
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "menu");
    // ヌールに勝った後の外出: なるが砂丘に来て、勝負の相手に加わる（来た場面は一度だけ）
    assert.equal(await page.locator(t("desert-start-naru")).count(), 1, "after beating Noor, Naru waits at the dunes");
    value = await get(page);
    assert.equal(value.desert.naruMet, true);
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await page.waitForFunction(() => window.__desertRide.game.z > 40);
    value = await get(page);
    assert.equal(value.flags._ch4_desert.outings, 2);
    assert.equal(value.money, moneyBefore - 6000, "from the second trip, the tour fee is paid when the trip starts");
    await page.evaluate(async () => { (await import("./js/core/state.js")).requestResumeOnBoot(); });
    await page.reload();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.desert.runs, 2, "an interrupted run leaves no record");
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 2, lastOutingDay: 4 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled(), "the interrupted trip still used the day");
    assert.equal(await page.locator(t("desert-ride")).count(), 0);
  });

  // 14日のドバイ（版2・日常ループ）でも同じ寄り道: 地図のデスク→誘い→砂丘（昼の行動を使う・体力と能力は変えない）→夜の地図。
  await check("chapter-four-daily-route-desk-and-dunes-on-the-dubai-map", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri", "noor"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, noor: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("Departure failed");
      value.flags._ch4_desert = { v: 2, talks: 3, chats: 0, lastTalkDay: null, outings: 0, lastOutingDay: null }; // カフェで3つ話した後
      value.affinity = { ...(value.affinity || {}), noor: 33 }; // ♥3
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); Object.assign(core.state, value); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await arm();
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) {
      await page.locator(`[data-test="ch4-scene"][data-scene="${id}"]`).waitFor({ timeout: 60000 });
      await page.locator(t("ch4-continue")).click();
    }
    const dubaiMap = slot => page.waitForFunction(slot => window.__remake.state.slot === slot
      && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show"), slot, { timeout: 60000 });
    // 新しく現れた行き先は地図の登場演出の間は選べないので、ここへ行くボタンが出るまで選び直す
    const go = async pin => {
      for (let i = 0; i < 40 && !(await page.locator(t("map-go")).isVisible().catch(() => false)); i++) {
        await page.locator(t(`pin-${pin}`)).click();
        await page.waitForTimeout(250);
      }
      await page.locator(t("map-go")).click();
    };
    await dubaiMap(0);
    let value = await get(page);
    assert.equal(value.flags._ch4.routeVersion, 2);
    assert.equal(await page.locator(t("pin-ch4_dubai_tour_desk")).count(), 1, "the café is on the Dubai map");
    assert.equal(await page.locator(t("pin-ch4_dubai_dunes")).count(), 0, "the dunes appear after the invitation");
    // ♥3 でカフェに寄ると誘い。一台頼む来店なので 3,000円と行動を1つ使い、好感度も上がる。カフェは地図に残り、砂丘が加わる
    const cafeBefore = await get(page);
    await go("ch4_dubai_tour_desk");
    await page.waitForFunction(() => window.__remake.state.flags._ch4_desert.talks === 4);
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.money, cafeBefore.money - 3000, "a shisha at the café costs 3,000円");
    assert(value.affinity.noor > cafeBefore.affinity.noor, "talking at the café raises Noor's affinity");
    await page.locator(t("pin-ch4_dubai_dunes")).waitFor();
    assert.equal(await page.locator(t("pin-ch4_dubai_tour_desk")).count(), 1, "the café stays on the map");
    // 砂丘は昼だけ。宿で夜を越して翌日の昼に出かける
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const before = await get(page);
    await go("ch4_dubai_dunes");
    await phase(page, "practice");
    value = await get(page);
    assert.equal(value.slot, 1, "the trip spends the daytime action once");
    assert.equal(value.flags._ch4_desert.outings, 1);
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
    await page.locator(t("desert-start")).click();
    await autoplayToResult(page, "perfect");
    await page.evaluate(() => {
      window.__bgs = [];
      new MutationObserver(() => { for (const node of document.querySelectorAll("#bg .bg-img")) if (!window.__bgs.includes(node.style.backgroundImage)) window.__bgs.push(node.style.backgroundImage); })
        .observe(document.getElementById("bg"), { childList: true, subtree: true, attributes: true });
    });
    await page.locator(t("desert-leave")).click();
    // 夕日の会話のあと、夜の地図へ（日常ループが追加で行動を進めない）
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.day, before.day); assert.equal(value.slot, 1);
    assert.equal(value.desert.bestRank, "A", "clean landings without spins are an A"); assert.equal(value.desert.rewarded, true);
    assert.equal(value.desert.wins, 1, "clean landings and the boost beat Noor");
    assert.equal(value.stamina, before.stamina, "the trip uses no stamina");
    assert.deepEqual(value.stats, before.stats, "no direct stat gain");
    assert.match(await page.locator(t("pin-ch4_dubai_dunes")).getAttribute("class"), /\boff\b/, "no second trip tonight (the pin stays, disabled)");
    assert(await page.locator(".hud").isVisible(), "the daily HUD comes back");
    assert((await page.evaluate(() => window.__bgs)).some(url => /bg_dubai_dunes_dusk/.test(url)), "the sunset talk uses the adopted dusk background");
  });
  await check("legacy-preview-best-is-separate-from-the-new-landing-rules", async page => {
    await page.evaluate(() => localStorage.setItem("suien_desert_ride_preview", JSON.stringify({ score: 99999, rank: "S", beatNoor: true })));
    await page.goto(new URL("desert-ride.html", page.url()).href);
    assert.match(await page.locator(t("desert-page-legacy-best")).innerText(), /旧ルール.*99,999/);
    assert.equal(await page.locator(t("desert-page-best")).count(), 0);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-menu")).waitFor();
    assert.match(await page.locator(t("desert-legacy-best")).innerText(), /99,999/);
    assert.equal(await page.locator(t("desert-best")).count(), 0, "the old score is not the target for the new rules");
    await page.locator(t("desert-start")).click();
    await autoplayToResult(page, "perfect");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "A");
    assert.match(await page.locator(t("desert-best")).innerText(), /自己ベスト更新/);
    await page.locator(t("desert-leave")).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")));
    assert.equal(saved.rulesVersion, 2); assert(saved.score < 99999);
    assert.deepEqual(saved.legacyBest, { score: 99999, rank: "S" });
    assert.equal(saved.beatNoor, true);
    await page.reload();
    assert.match(await page.locator(t("desert-page-legacy-best")).innerText(), /99,999/);
    assert.match(await page.locator(t("desert-page-best")).innerText(), /自己ベスト.*A/);
  });

  await check("legacy-main-records-survive-real-auto-and-slot-save-load", async page => {
    const got = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-desert-progress.js");
      const value = core.newGame();
      const old = { finished: true, score: 30000, rank: "S", time: 48, maxCombo: 20, falls: 0 };
      value.desert = { runs: 7, best: old, bestRank: "S", rewarded: true, wins: 2, naruMet: true, naruWins: 1, firstClear: { chapter: 4, day: 46 } };
      const saved = progress.recordDesertResult(value, { ...old, score: 3500, rank: "B", rulesVersion: 2 });
      core.save();
      const auto = structuredClone(core.load().desert);
      const slotSaved = core.saveToSlot("suien_remake_slot1");
      core.state.desert = null;
      const loaded = core.loadFromSlot("suien_remake_slot1");
      return { newBest: saved.newBest, auto, slotSaved, slot: structuredClone(loaded?.desert), unlocked: progress.desertRivals(loaded) };
    });
    assert.equal(got.newBest, true); assert.equal(got.slotSaved, true);
    assert.equal(got.auto.best.score, 3500); assert.equal(got.auto.best.rulesVersion, 2);
    assert.equal(got.auto.legacyBest.score, 30000); assert.equal(got.auto.bestRank, "S");
    assert.equal(got.auto.runs, 8); assert.equal(got.auto.rewarded, true);
    assert.equal(got.auto.wins, 2); assert.equal(got.auto.naruWins, 1); assert.equal(got.auto.naruMet, true);
    assert.deepEqual(got.slot, got.auto);
    assert.deepEqual(got.unlocked, ["noor", "naru"]);
  });

  // DSR20: 段階の会話と♥3の問いを読んだ♥5の来店で、締めくくり（専用ハガル・最後の問い）。恋愛を選ぶと次の砂丘はツアー代なしで、
  // 滑ったあと夕日の砂丘でヌールから告白され、付き合う。
  await check("chapter-four-daily-noor-finale-then-sunset-confession", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "nagumo", "dr_kemuri", "noor"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, noor: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("Departure failed");
      // カフェの段階を全部読み、♥3の問いに恋愛寄りで答え、砂丘へも一度行った♥5
      value.flags._ch4_desert = { v: 2, talks: 6, chats: 0, lastTalkDay: null, outings: 1, lastOutingDay: null };
      value.flags._noor_affinity_question_done = true;
      value.romanceChoices = { bond_q1_noor: { char: "noor", value: 1, day: value.day } };
      value.affinity = { ...(value.affinity || {}), noor: 66 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); Object.assign(core.state, value); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await arm();
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) {
      await page.locator(`[data-test="ch4-scene"][data-scene="${id}"]`).waitFor({ timeout: 60000 });
      await page.locator(t("ch4-continue")).click();
    }
    const dubaiMap = slot => page.waitForFunction(slot => window.__remake.state.slot === slot
      && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show"), slot, { timeout: 60000 });
    const go = async pin => {
      for (let i = 0; i < 40 && !(await page.locator(t("map-go")).isVisible().catch(() => false)); i++) {
        await page.locator(t(`pin-${pin}`)).click();
        await page.waitForTimeout(250);
      }
      await page.locator(t("map-go")).click();
    };
    await dubaiMap(0);
    // ♥5の来店: 締めくくり。最後の問いで「二人で」（choose=0）→ 専用ハガル、恋愛ルート。一台の代金と行動を1つ使う
    const cafeBefore = await get(page);
    await go("ch4_dubai_tour_desk");
    await page.waitForFunction(() => window.__remake.state.finales?.noor);
    await page.locator(".toast", { hasText: "次の砂丘で、ヌールが待っている" }).waitFor();
    await dubaiMap(1);
    let value = await get(page);
    assert.equal(value.finales.noor.route, "romance");
    assert.equal(value.romanceChoices.bond_q2_noor.value, 1);
    assert(value.owned.includes("suyaki_noor"), "Noor's double apple hagal");
    assert.equal(value.money, cafeBefore.money - 3000);
    assert.equal(value.flags._confession_due, undefined, "no night-walk reservation");
    // 翌日の昼、約束の砂丘（ツアー代なし）。滑らずに下りても、夕日の場面で告白され、付き合う（choose=0）
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const before = await get(page);
    await page.evaluate(() => {
      window.__bgs = [];
      new MutationObserver(() => { for (const node of document.querySelectorAll("#bg .bg-img")) if (!window.__bgs.includes(node.style.backgroundImage)) window.__bgs.push(node.style.backgroundImage); })
        .observe(document.getElementById("bg"), { childList: true, subtree: true, attributes: true });
    });
    await go("ch4_dubai_dunes");
    await phase(page, "menu");
    assert.equal(await page.locator(t("desert-start-naru")).count(), 0, "a day for the two of them");
    await page.locator(t("desert-leave")).click();
    await page.waitForFunction(() => (window.__remake.state.lovers || []).includes("noor"));
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.money, before.money, "Noor's invitation: no tour fee");
    assert.deepEqual(value.lovers, ["noor"]);
    assert.equal(value.loveLevel.noor, 1);
    assert(value.flags._lime_contact_noor && value.contacts.includes("noor"), "they exchange LIME when they start dating");
    assert.equal(value.flags._noor_confession_other_lover, undefined, "the temporary flag is cleared");
    assert((await page.evaluate(() => window.__bgs)).some(url => /bg_dubai_dunes_dusk/.test(url)), "the confession is on the sunset dunes");
    // 告白は一度だけ。次の砂丘は相場のツアー代
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const price = await page.evaluate(async () => {
      const desert = await import("./js/chapters/ch4-desert-progress.js");
      return desert.desertOutingStatus(window.__remake.state, 99).price;
    });
    assert.equal(price, 6000);
  });
});


