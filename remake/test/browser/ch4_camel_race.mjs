// 第4章ドバイ・ラクダレースの実UI検証: 自由行動の地図から店員と知り合う→誘い→本番見学→練習レース（自動操作）→結果の会話、
// 昼の行動の消費と1日1回、途中でやめた場合の非消費、実セーブ→ロード後の継続、再挑戦で報酬が増えないこと。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

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
    assert.equal(state.growth, undefined, "no growth ledger is created while the board is hidden");
    // 大会の進行は変わらない: 宿へ戻ると前夜へ。
    await page.locator(dt("ch4-go-inn")).click();
    await page.locator(dt("ch4-eve")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch4.part, "eve");
  });
});

async function expectLabel(locator, pattern) {
  await locator.waitFor();
  assert.match(await locator.textContent(), pattern);
}
