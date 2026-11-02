// DESERT RIDE（第4章ドバイ・サンドボード）: 単体ページ（PCの鍵盤・スマホのタッチ・動き軽減）と、
// 第4章の本編接続（デスクで3日話す→砂丘へ→練習→本番→記録→夕日→同じ日は二度行けない→SAVE/LOAD→中断）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const ride = (page, code) => page.evaluate(code);
const game = page => page.evaluate(() => { const g = window.__desertRide?.game; return g ? { z: g.z, x: g.x, air: g.air, airKind: g.airKind, t: g.t, score: g.score, falls: g.falls, finished: g.finished, hops: g.stats.hops, bigJumps: g.stats.bigJumps } : null; });
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === value, value, { timeout: 90000 });
const autoplayToResult = async (page, skill = "perfect") => {
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
    await autoplayToResult(page, "perfect");
    const text = await resultText(page);
    assert.match(text, /RESULT/); assert.match(text, /転倒 0 回/); assert.match(text, /大ジャンプ 7 回/); assert.match(text, /自己ベスト更新/);
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "S", "the ideal run is S on the fixed course");
    const total = Number((await page.locator(t("desert-total")).innerText()).replace(/[^\d]/g, ""));
    assert(total >= 9000, `S needs 9000+ (${total})`);
    assert.match(await page.locator(t("desert-time")).innerText(), /5\d\.\d 秒/, "a run takes about a minute");
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
    for (const box of [left, right, jump]) {
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
    // 練習は説明つきで、終わると本番へ進むカード
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
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
    assert.match(await page.locator(t("ch4-go-tour_desk")).innerText(), /ツアーデスク/);
    assert.equal(await page.locator(t("ch4-go-dunes")).count(), 0, "the dunes wait for the invitation");
    await page.evaluate(() => { window.__cutins = []; new MutationObserver(records => { for (const r of records) for (const n of r.addedNodes) if (n.dataset?.char) window.__cutins.push(n.dataset.char); }).observe(document.body, { childList: true, subtree: true }); });
    await page.locator(t("ch4-go-tour_desk")).click();
    await talksDone(1);
    await freeDay(1);
    let value = await get(page);
    assert.equal(value.met.noor, true); assert.equal(value.flags._intro_noor, true);
    assert.ok((await page.evaluate(() => window.__cutins)).includes("noor"), "the guide gets her intro cut-in once");
    assert(await page.locator(t("ch4-go-tour_desk")).isDisabled(), "one talk per day");
    assert.equal(value.flags._ch4.day, 1, "talking does not advance the day");
    // DAY2・DAY3: 続きの会話 → 誘い → 砂丘が地図に出る
    await page.locator(t("ch4-go-inn")).click(); await freeDay(2);
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(2); await freeDay(2);
    await page.locator(t("ch4-go-inn")).click(); await freeDay(3);
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(3);
    await page.locator(".toast", { hasText: "ヌールと砂丘へ" }).waitFor();
    await freeDay(3);
    assert.equal(await page.locator(t("ch4-go-tour_desk")).count(), 0, "the desk gives way to the dunes");
    assert.match(await page.locator(t("ch4-go-dunes")).innerText(), /ヌールと砂丘へ/);
    assert.match(await page.locator(t("ch4-free")).innerText(), /昼の行動を1つ使う/);
    // 砂丘へ: 到着の場面 → 外出を確定 → 練習 → 本番 → 記録
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "practice");
    value = await get(page);
    assert.deepEqual(value.flags._ch4_desert, { talks: 3, lastTalkDay: 3, outings: 1, lastOutingDay: 3 }, "the outing is spent when the trip starts");
    assert.equal(value.desert, undefined);
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
    assert.match(await page.locator(t("desert-practiced")).innerText(), /ヌール「いいね/);
    await page.locator(t("desert-start")).click();
    await autoplayToResult(page, "good");
    await page.locator(".toast", { hasText: "ヌール「" }).waitFor();
    await page.locator(".toast", { hasText: "初めての完走" }).waitFor();
    value = await get(page);
    assert.equal(value.desert.runs, 1); assert.equal(value.desert.best.rank, "A"); assert.equal(value.desert.bestRank, "A");
    assert.deepEqual(value.desert.firstClear, { chapter: 4, day: 48 }); assert.equal(value.desert.rewarded, true);
    assert.deepEqual(value.stats, before.stats, "no direct stat gain"); assert.equal(value.money, before.money);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("suien_remake_save"))).desert.bestRank, "A", "recorded to the autosave");
    // 同じ外出の中の再挑戦: 行動は増えず、記録だけ増える。自己ベストは点数で更新
    await page.locator(t("desert-retry")).click();
    await autoplayToResult(page, "perfect");
    value = await get(page);
    assert.equal(value.desert.runs, 2); assert.equal(value.desert.bestRank, "S"); assert.equal(value.flags._ch4_desert.outings, 1);
    assert.match(await resultText(page), /自己ベスト更新/);
    // 砂丘を下りる → 夕日の場面（大会前の分岐）→ 地図。今日はもう行けない。
    await page.locator(t("desert-leave")).click();
    await freeDay(3);
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
    assert.deepEqual(value.flags._ch4_desert, { talks: 3, lastTalkDay: 3, outings: 1, lastOutingDay: 3 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled());
    // 翌日はまた行ける。2回目の外出は短い到着 → 練習なしで本番。途中で中断（再読込）しても外出の消費だけ残り、記録は増えない。
    await page.locator(t("ch4-go-inn")).click(); await freeDay(4);
    assert(!(await page.locator(t("ch4-go-dunes")).isDisabled()));
    assert.match(await page.locator(t("ch4-free")).innerText(), /自己ベスト/);
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "menu");
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await page.waitForFunction(() => window.__desertRide.game.z > 40);
    value = await get(page);
    assert.equal(value.flags._ch4_desert.outings, 2);
    await page.evaluate(async () => { (await import("./js/core/state.js")).requestResumeOnBoot(); });
    await page.reload();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.desert.runs, 2, "an interrupted run leaves no record");
    assert.deepEqual(value.flags._ch4_desert, { talks: 3, lastTalkDay: 3, outings: 2, lastOutingDay: 4 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled(), "the interrupted trip still used the day");
    assert.equal(await page.locator(t("desert-ride")).count(), 0);
  });
});
