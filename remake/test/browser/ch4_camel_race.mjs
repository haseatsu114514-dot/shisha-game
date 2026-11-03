// 第4章ドバイ・ラクダレースの実UI検証: 自由行動の地図から店員と知り合う→誘い→本番見学→練習レース（自動操作）→結果の会話、
// 昼の行動の消費と1日1回、途中でやめた場合の非消費、実セーブ→ロード後の継続、再挑戦で報酬が増えないこと。
// もう一件は、ドバイ14日の日常ループの地図（ch4-dubai-daily.js・#2297）から同じ流れに入り、昼の枠を一度だけ使うこと。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const arm = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
// 会話に入った台本IDを数える。ゲームの起動が hooks.onEnter を設定し直すので、章の画面が出てから包む。
const trackEnter = page => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  window.__camelEntered = [];
  const previous = vn.hooks.onEnter;
  vn.hooks.onEnter = (id, dlg) => { window.__camelEntered.push(id); previous?.(id, dlg); };
});
const entered = page => page.evaluate(() => window.__camelEntered.slice());
const camelTest = (page, options) => page.evaluate(options => { window.__remake.camelTest = options; }, options);
const freeDay = (page, day) => page.locator(dt("ch4-free")).getByRole("heading", { name: new RegExp(`^DAY ${day}・`) }).waitFor();

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    // ドバイ到着日の自由行動（プロローグ4場面を読み終えた直後）。
    Object.assign(value, { chapter: 4, day: 46, slot: 0, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _ch3_tournament_won: true, _ch3_japan_first_representative: true,
      _overseas_companion: { decided: true, companion: null, supports: [] },
      _ch4_strategy: "sakura", _ch4_sheikh_revealed: false,
      _ch4: { startDay: 46, day: 1, stage: 4, part: "free", titleSeen: true, firstDay: null, resolution: 0, attempts: 0,
        read: { ch4_sumi_training: true, ch4_strategy: true, ch4_opening: true, ch4_arrival_inn: true } } };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
  });
}
async function loadSlot(page, slot) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page);
  await page.locator(dt(`slot-${slot}`)).click();
}
const endDay = async (page, nextDay) => {
  await page.locator(dt("ch4-go-inn")).click();
  await freeDay(page, nextDay);
};

await suite("ch4-camel-race", async check => {
  await check("meet-invite-watch-race-record-and-replay-on-one-save", async page => {
    await seed(page);
    await loadSlot(page, 0);
    await page.locator(dt("ch4-free")).waitFor({ timeout: 60000 });
    await trackEnter(page);
    let state = await get(page);
    assert.equal(state.flags._ch4_camel, undefined);
    const startDay = state.day;
    // DAY1: 店先で知り合う（時間を使わない）。同じ日はもう話せない。
    const camel = page.locator(dt("ch4-go-camel"));
    await expectLabel(camel, /店員と話す/);
    await camel.click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.stage === 1);
    await page.locator(dt("ch4-free")).waitFor();
    assert.deepEqual(await entered(page), ["ch4_camel_meet"]);
    state = await get(page);
    assert.equal(state.flags._ch4_camel.meetDay, startDay);
    assert.equal(state.slot, 0, "a conversation does not spend the daytime slot");
    assert.equal(state.met.saif, true);
    await assert.rejects(() => camel.click({ timeout: 1500 }), /not enabled|disabled|Timeout/i, "no second talk on the same day");
    // DAY2: 誘われる。レースは翌朝なのでまだ行けない。
    await endDay(page, 2);
    await expectLabel(camel, /サイフとまた話す/);
    await camel.click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.stage === 2);
    await page.locator(dt("ch4-free")).waitFor();
    assert.equal((await get(page)).met.rashid, undefined, "Rashid appears at the track, not in the shop");
    await assert.rejects(() => camel.click({ timeout: 1500 }), /not enabled|disabled|Timeout/i, "the race is tomorrow morning");
    // DAY3: 本番を見て、レースを途中でやめる → 消費なし・見学は既読のまま。
    await endDay(page, 3);
    await expectLabel(camel, /ラクダレース場へ/);
    await camelTest(page, { pilot: "none", timeScale: 4 });
    await camel.click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.watched === true);
    await page.locator(dt("camel-tutorial")).waitFor({ timeout: 60000 });
    await page.locator(dt("camel-tutorial-skip")).click();
    await page.waitForFunction(() => document.querySelector(".camel-game")?.dataset.phase === "race");
    await page.locator(dt("camel-close")).click();
    await page.locator(dt("ch4-free")).waitFor();
    state = await get(page);
    assert.equal(state.flags._ch4_camel.plays, 0);
    assert.equal(state.flags._ch4_camel.stage, 2);
    assert.equal(state.slot, 0, "quitting mid-race spends nothing");
    assert.equal(state.met.rashid, true);
    // 同じ日にもう一度: 見学は繰り返さず、すぐチュートリアル→レース（自動操作で完走）→結果の会話。
    await camelTest(page, { pilot: "perfect", timeScale: 8 });
    const before = await get(page);
    await camel.click();
    const enteredBefore = (await entered(page)).length;
    await page.locator(dt("camel-tutorial")).waitFor({ timeout: 20000 });
    assert.equal((await entered(page)).length, enteredBefore, "the watched scene must not replay");
    for (let i = 0; i < 3; i++) await page.locator(dt("camel-tutorial-next")).click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    const result = await page.locator(dt("camel-result")).evaluate(node => ({ ...node.dataset }));
    assert.equal(result.rank, "1"); assert.equal(result.grade, "S");
    assert.equal(await page.locator(dt("camel-new-best")).count(), 0, "the first run has no previous best");
    // 記録・消費はリザルトの「終える」の前に確定している（結果の会話を読み切れなくても二重にならない）。
    await page.locator(dt("camel-retry")).waitFor();
    await page.locator(dt("camel-finish")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.plays === 1);
    await page.locator(dt("ch4-free")).waitFor({ timeout: 60000 });
    assert.equal((await entered(page)).at(-1), "ch4_camel_result_win", "the winner's scene follows a 1st place");
    state = await get(page);
    assert.equal(state.flags._ch4_camel.stage, 3);
    assert.equal(state.flags._ch4_camel.best.total, Number(result.total));
    assert.equal(state.flags._ch4_camel.best.rank, 1);
    assert.equal(state.flags._ch4_camel.lastPlayDay, state.day);
    assert.equal(state.slot, 1, "the race spends the daytime slot");
    assert.deepEqual(state.stats, before.stats, "no direct stat reward");
    assert.equal(state.money, before.money);
    assert.equal(state.flags._ch4.part, "free"); assert.equal(state.flags._ch4_sheikh_revealed, false);
    await expectLabel(camel, /練習レース/);
    await assert.rejects(() => camel.click({ timeout: 1500 }), /not enabled|disabled|Timeout/i, "once per day");
    // 実セーブ→ロード: 段階・自己ベスト・今日の消費が残る。
    await page.locator(dt("ch4-menu")).click();
    await page.locator(dt("ch4-save")).click();
    await page.locator(dt("slot-1")).click();
    await loadSlot(page, 1);
    await page.locator(dt("ch4-free")).waitFor({ timeout: 60000 });
    await trackEnter(page);
    const resumed = await get(page);
    assert.deepEqual(resumed.flags._ch4_camel, state.flags._ch4_camel);
    assert.equal(resumed.slot, 1);
    await assert.rejects(() => camel.click({ timeout: 1500 }), /not enabled|disabled|Timeout/i);
    // DAY4（前夜日）: 再挑戦。悪い結果では自己ベストは変わらず、報酬も増えない（能力・所持金は同じ）。
    await endDay(page, 4);
    assert.equal((await get(page)).slot, 0);
    await camelTest(page, { pilot: "none", timeScale: 8 });
    await camel.click();
    await page.locator(dt("camel-game")).waitFor({ timeout: 60000 });
    assert.equal(await page.locator(dt("camel-tutorial")).count(), 0, "no tutorial after the first run");
    await page.locator('[data-test="camel-cup"][data-cup="practice"]').click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    const second = await page.locator(dt("camel-result")).evaluate(node => ({ ...node.dataset }));
    assert.equal(second.rank, "4");
    await page.locator(dt("camel-finish")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.plays === 2);
    await page.locator(dt("ch4-free")).waitFor({ timeout: 60000 });
    const replayScenes = (await entered(page)).slice(-2);
    assert.deepEqual(replayScenes, ["ch4_camel_replay", "ch4_camel_replay_usual"]);
    state = await get(page);
    assert.equal(state.flags._ch4_camel.best.total, Number(result.total), "a worse run keeps the best");
    assert.equal(state.slot, 1);
    assert.deepEqual(state.stats, before.stats); assert.equal(state.money, before.money);
    // 盤が隠れている旧しくみ（?growth=0）では成長の記録を作らない。心得の盤（通常プレイの既定・#2166）では能力は直接伸びず、経験値の記録だけが残る。
    if (await page.evaluate(async () => (await import("./js/core/growth-mode.js")).growthEnabled())) assert.equal(typeof state.growth, "object");
    else assert.equal(state.growth, undefined, "no growth ledger is created while the board is hidden");
    // 大会の進行は変わらない: 宿へ戻ると前夜へ。
    await page.locator(dt("ch4-go-inn")).click();
    await page.locator(dt("ch4-eve")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch4.part, "eve");
  });
});

// ---- ドバイ14日の日常ループ（版2）------------------------------------------------------------------------
const dubaiMap = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
async function go(page, pin) {
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
}
/** 出発の朝にドバイへ着き、到着・宿の場面を読み終えた日常ループの保存。camel はラクダレースの記録（任意）。 */
async function seedDaily(page, camel = null) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async camel => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "nagumo", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { naru: true });
    if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("Departure failed");
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    if (camel) value.flags._ch4_camel = { ...camel, inviteDay: value.day - 1, meetDay: value.day - 2 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  }, camel);
}

await suite("ch4-camel-race-daily", async check => {
  await check("daily-map-meet-is-free-and-race-spends-the-day-slot-once", async page => {
    await seedDaily(page);
    await loadSlot(page, 0);
    await dubaiMap(page, { slot: 0 });
    let state = await get(page);
    const day = state.day;
    assert.equal(state.flags._ch4.routeVersion, 2);
    // 店先で知り合う: 時間・体力・お金を使わず、同じ昼の地図へ戻る。
    assert.equal(await page.locator(dt("pin-ch4_dubai_camel")).count(), 1, "the shop front is on the Dubai map");
    const before = { stamina: state.stamina, money: state.money, slot: state.slot };
    await go(page, "ch4_dubai_camel");
    await page.waitForFunction(() => window.__remake.state.flags._ch4_camel?.stage === 1);
    await dubaiMap(page, { day, slot: 0 });
    state = await get(page);
    assert.deepEqual({ stamina: state.stamina, money: state.money, slot: state.slot }, before);
    assert.equal(state.met.saif, true);
    assert.equal(state.visitedDay.ch4_dubai_camel, undefined, "a conversation is not a visit");
  });

  await check("daily-map-race-records-best-and-uses-one-daytime-slot", async page => {
    await seedDaily(page, { stage: 2, watched: false, plays: 0, lastPlayDay: null, best: null });
    await loadSlot(page, 0);
    await dubaiMap(page, { slot: 0 });
    let state = await get(page);
    const day = state.day;
    await camelTest(page, { pilot: "perfect", timeScale: 8 });
    await go(page, "ch4_dubai_camel");
    await page.locator(dt("camel-tutorial")).waitFor({ timeout: 60000 });
    for (let i = 0; i < 3; i++) await page.locator(dt("camel-tutorial-next")).click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    await page.locator(dt("camel-finish")).click();
    // 昼の枠は一度だけ使い、同じ日の夜の地図へ（日常ループと二重に進めない）。
    await dubaiMap(page, { day, slot: 1 });
    state = await get(page);
    assert.equal(state.flags._ch4_camel.stage, 3);
    assert.equal(state.flags._ch4_camel.watched, true);
    assert.equal(state.flags._ch4_camel.plays, 1);
    assert.equal(state.flags._ch4_camel.best.rank, 1);
    assert.equal(state.flags._ch4_camel.lastPlayDay, day);
    assert.equal(state.visitedDay.ch4_dubai_camel, day);
    assert.equal(state.stats.technique, 60, "no direct stat reward");
    assert.equal(state.met.rashid, true);
    // 夜はレースへ行けない（案内に理由を出し、「ここへ行く」は出さない）。
    await page.locator(dt("pin-ch4_dubai_camel")).click();
    await page.locator(".mi-no").filter({ hasText: /今日はもう走った|レースは昼だけ|今日はもう行った/ }).waitFor();
    assert.equal(await page.locator(dt("map-go")).count(), 0, "no race at night");
  });
});

await suite("ch4-camel-cups", async check => {
  await check("cup-unlocks-cancel-multiple-runs-and-save-load", async page => {
    await seedDaily(page, { stage: 3, watched: true, plays: 1, lastPlayDay: null, best: null });
    await loadSlot(page, 0);
    await dubaiMap(page, { slot: 0 });
    await camelTest(page, { pilot: "good", timeScale: 8 });
    const before = await get(page);
    await go(page, "ch4_dubai_camel");
    await page.locator(dt("camel-cups")).waitFor();
    const cup = id => page.locator(`[data-test="camel-cup"][data-cup="${id}"]`);
    assert.equal(await cup("standard").isDisabled(), true);
    assert.equal(await cup("expert").isDisabled(), true);
    await page.locator(dt("camel-close")).click();
    await dubaiMap(page, { slot: 0 });
    const cancelled = await get(page);
    assert.deepEqual(cancelled.flags._ch4_camel, before.flags._ch4_camel);
    assert.equal(cancelled.slot, before.slot);
    await go(page, "ch4_dubai_camel");
    await cup("rookie").click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    await page.locator(dt("camel-choose-cup")).click();
    assert.equal(await cup("standard").isDisabled(), false);
    await cup("standard").click();
    await page.locator(dt("camel-result")).waitFor({ timeout: 120000 });
    assert.match(await page.locator(dt("camel-result")).textContent(), /中級認定/);
    await page.locator(dt("camel-choose-cup")).click();
    assert.equal(await cup("expert").isDisabled(), false);
    await page.locator(dt("camel-close")).click();
    await dubaiMap(page, { day: before.day, slot: 1 });
    const completed = await get(page);
    assert.equal(completed.flags._ch4_camel.plays, 3, "all finished runs are saved once");
    assert.equal(completed.flags._camel_cups.standard.mastered, true);
    assert.equal(completed.flags._camel_cups.expert.mastered, false);
    await loadSlot(page, 0);
    await dubaiMap(page, { day: before.day, slot: 1 });
    assert.deepEqual((await get(page)).flags._camel_cups, completed.flags._camel_cups);
  });
});

async function expectLabel(locator, pattern) {
  await locator.waitFor();
  assert.match(await locator.textContent(), pattern);
}

// 独立ページで操作の手ごたえを確かめる（2026-11-02 オーナー「ラクダ操ってる感」）: ムチは X／右のボタンを押している間だけ効き、
// 離すと止まる。押している間は速度計が赤く、スタミナが減る。窓のはじめ・幕の絵が読めている。
await suite("ch4-camel-race-controls", async check => {
  await check("whip-works-only-while-held-by-key-and-by-pointer", async page => {
    await page.locator(dt("camel-menu-quick")).click();
    const game = page.locator(dt("camel-game"));
    await page.waitForFunction(() => document.querySelector('[data-test="camel-game"]')?.dataset.phase === "race", null, { timeout: 15000 });
    assert.equal(await game.getAttribute("data-art"), "sprites");
    const whip = page.locator(dt("camel-signal"));
    const stamina = async () => Number(await page.locator(".camel-stamina b").textContent());
    const full = await stamina();
    // キーボード: 押している間だけムチ。
    await page.keyboard.down("x");
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.state === "whipping");
    await page.waitForTimeout(700);
    assert.equal(await page.locator(".camel-speed").getAttribute("data-state"), "whip");
    const pressed = await stamina();
    assert(pressed < full - 5, `holding X spends stamina (${full} → ${pressed})`);
    await page.keyboard.up("x");
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.state !== "whipping");
    const released = await stamina();
    await page.waitForTimeout(500);
    assert(await stamina() >= released - 1, "releasing stops the drain");
    // 右のボタン: 指を置いている間だけ。
    const box = await whip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.state === "whipping");
    await page.mouse.up();
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.state !== "whipping");
    // Space の声も、本編の会話エンジンに取られずレースに届く（判定の文字が出る）。
    await page.keyboard.press("Space");
    await page.locator(".camel-feedback.show").waitFor();
    assert.match(await page.locator(".camel-feedback").textContent(), /PERFECT|GOOD|無駄な声|連打/);
    await page.locator(dt("camel-close")).click();
    await page.locator(dt("camel-menu-quick")).waitFor();
  });
}, { entry: new URL("camel-race.html", baseURL).href, readySelector: '[data-test="camel-menu-quick"]' });

