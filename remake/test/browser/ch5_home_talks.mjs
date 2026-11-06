// 第5章の最初の来店で一度だけ読む会話（N3・chapters/ch5-first-talks.js）を、実際の地図の来店で確かめる。
// 柚ヶ谷: 神崎煙草店の最初の来店は第2章の後日談（世界大会の後の版）→ 零-ZERO- の最初の来店はレヰの会話 → 次の日の神崎の店は
// いつもの来店（昼のあいさつ＋通い訪問の小会話）。地元: EDEN の最初の来店は任意場面「二つのダブルアップル」、次の日のEDENがアダムの会話。
// 代金・好感度（第5章の通い +5）・回数は元の店の来店と同じ。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
import { travelToCity } from "./station_helpers.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const mapReady = (page, { day, slot, region = "home" } = {}) => page.waitForFunction(([day, slot, region]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    // 新しく出た行き先の演出中は選べないので、終わるまで待つ
    && document.querySelector(`.map:not(.done):not([data-revealing="true"])[data-region="${region}"] [data-test=station-open], .map:not(.done):not([data-revealing="true"])[data-region="${region}"] [data-test=pin-tonari]`)
    && !document.querySelector("#modal.show");
}, [day, slot, region], { timeout: 60000 });
// 来店の会話の文（VNのログ）。来店の前にログを空にしてから読む。
const clearLog = page => page.evaluate(async () => (await import("./js/vn/engine.js")).clearLog());
const logText = page => page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
async function visit(page, pin) {
  await clearLog(page);
  await page.locator(dt(`pin-${pin}`)).click();
  await page.locator(dt("map-go")).click();
}

async function seed(page, { region = "home", met = {}, read = {}, affinity = {} } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ region, met, read, affinity }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: region, _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true,
        read: { ch5_bridge_after_return: true, ch5_opening: true, ...read }, scheduleDecision: null, aftermath: 0, finale: 0,
        finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true };
    Object.assign(value.met, met);
    Object.assign(value.affinity, affinity);
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    // 辻占のオババが地図の演出を挟まないよう、第5章の出現は済んだことにする（ch5_full_flow と同じ）
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  }, { region, met, read, affinity });
  await page.reload();
  await page.locator(dt("title-load")).click();
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
  });
  await page.locator(dt("slot-0")).click();
}

await suite("ch5-home-talks", async check => {
  await check("yuzugaya-kanzaki-aftermath-and-rei-talk-read-once", async page => {
    await seed(page, { met: { kumicho: true, rei: true }, affinity: { kumicho: 30, rei: 30 } });
    await mapReady(page, { day: 51, slot: 0 });
    await travelToCity(page, "widehanga");
    // 1. 昼の神崎煙草店: 第2章の後日談（世界大会の後の版）を一度だけ。代金・好感度は第5章の通いと同じ。
    let before = await get(page);
    await visit(page, "ch2_kumicho");
    await mapReady(page, { day: 51, slot: 1, region: "widehanga" });
    let state = await get(page);
    let text = await logText(page);
    assert.match(text, /炭より先に持ち点の表を見てた/, "Kanzaki says he saw through the Chapter 2 win");
    assert.match(text, /世界から、よく戻りなすった/);
    assert.doesNotMatch(text, /昼の神崎煙草店/, "the one-time talk has its own arrival, no day greeting");
    assert.equal(state.flags.ch2_kumicho_after_ch2_done, true);
    assert.equal(state.money, before.money - 3000, "the usual 3,000 yen");
    assert.equal(state.affinity.kumicho, before.affinity.kumicho + 5, "the Chapter 5 regular visit +5");
    assert.equal(state.flags._ch2_talks?.kumicho, (before.flags._ch2_talks?.kumicho || 0) + 1, "counted as a regular visit");
    assert.equal(state.visits.kumicho, (before.visits.kumicho || 0) + 1);
    assert.equal(state.flags._ch5.part, "free", "the talk does not move the Chapter 5 story");
    // 2. 夜の零-ZERO-: レヰの第5章の会話を一度だけ。夜を越えると地元へ帰る。
    before = state;
    await visit(page, "ch2_rei");
    await mapReady(page, { day: 52, slot: 0 });
    state = await get(page);
    text = await logText(page);
    assert.match(text, /世界大会の動画、店で流した/, "Rei's Chapter 5 talk");
    assert.equal(state.flags._talk_seen_ch5_rei_shop, true);
    assert.equal(state.affinity.rei, before.affinity.rei + 5);
    assert.equal(state.flags._ch2_talks?.rei, (before.flags._ch2_talks?.rei || 0) + 1);
    assert.equal(state.flags._ch2_region, "home", "the night ends at home");
    // 3. 次の日の神崎煙草店は、いつもの来店（昼のあいさつ＋通い訪問の小会話）。後日談は読み直さない。
    await travelToCity(page, "widehanga");
    before = await get(page);
    await visit(page, "ch2_kumicho");
    await mapReady(page, { day: 52, slot: 1, region: "widehanga" });
    state = await get(page);
    text = await logText(page);
    assert.match(text, /昼の神崎煙草店/, "back to the usual day greeting");
    assert.doesNotMatch(text, /持ち点の表|世界から、よく戻りなすった/, "the aftermath is read once");
    assert.equal(state.money, before.money - 3000);
    assert.equal(state.flags._ch2_talks?.kumicho, (before.flags._ch2_talks?.kumicho || 0) + 1);
  });

  // 中断・LOAD: 後日談の途中で別の保存を読み込んだら、既読・代金・好感度・回数を残さない（次の来店で読み直せる）。
  await check("kanzaki-aftermath-left-by-load-is-not-read", async page => {
    await seed(page, { met: { kumicho: true }, affinity: { kumicho: 30 } });
    await mapReady(page, { day: 51, slot: 0 });
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), vn = await import("./js/vn/engine.js");
      const shops = await import("./js/chapters/ch5-shops.js"), prep = await import("./js/chapters/ch2-preparation.js");
      const owner = core.state, saved = structuredClone(owner);
      const spot = prep.cityRegularSpots(owner).find(entry => entry.charId === "kumicho");
      const enter = vn.hooks.onEnter;
      // 後日談が始まった瞬間に LOAD したことにする（読み込んだ保存が state に入る）
      vn.hooks.onEnter = (id, dlg) => {
        enter?.(id, dlg);
        if (id === "ch2_kumicho_after_ch2" && core.state === owner) core.setState(structuredClone(saved));
      };
      try {
        const visit = await shops.performChapterFiveShop(spot, { staminaGuard: async () => true });
        const pick = value => ({ read: !!value.flags.ch2_kumicho_after_ch2_done, money: value.money,
          affinity: value.affinity.kumicho, talks: value.flags._ch2_talks?.kumicho || 0, visits: value.visits.kumicho || 0 });
        return { visit, switched: core.state !== owner, owner: pick(owner), loaded: pick(core.state), saved: pick(saved) };
      } finally { vn.hooks.onEnter = enter; }
    });
    assert.equal(result.switched, true, "the save was replaced while the aftermath was playing");
    assert.deepEqual(result.visit, { used: false, exerted: false });
    assert.deepEqual(result.owner, result.saved, "nothing is settled on the save that started the visit");
    assert.deepEqual(result.loaded, result.saved, "the loaded save keeps the aftermath unread");
    assert.equal(result.saved.read, false);
  });

  await check("eden-adam-talk-follows-the-free-scene", async page => {
    await seed(page, { met: { adam: true }, affinity: { adam: 30 } });
    await mapReady(page, { day: 51, slot: 0 });
    // 1. 最初のEDENは、第5章の任意場面「二つのダブルアップル」（代金なし・既存）。
    await visit(page, "adam");
    await mapReady(page, { day: 51, slot: 1 });
    let state = await get(page);
    assert.equal(state.flags._ch5.read.ch5_free_eden_adam, true);
    assert.notEqual(state.flags._talk_seen_ch5_adam_shop, true, "Adam's talk waits for the next visit");
    assert.doesNotMatch(await logText(page), /世界一の同志も吸った林檎/);
    // 同じ店は一日一度。夜は家で休んで、次の日の昼に。
    await visit(page, "rest");
    await mapReady(page, { day: 52, slot: 0 });
    // 2. 次のEDENで、アダムの第5章の会話を一度だけ。代金・好感度は通いと同じ。
    const before = await get(page);
    await visit(page, "adam");
    await mapReady(page, { day: 52, slot: 1 });
    state = await get(page);
    const text = await logText(page);
    assert.match(text, /世界一の同志も吸った林檎/, "Adam's Chapter 5 talk");
    assert.match(text, /吸う奴の今日も見る/);
    assert.doesNotMatch(text, /二つのダブルアップル|ラベルの違うタッパーを二つ/, "the free scene is not replayed");
    assert.equal(state.flags._talk_seen_ch5_adam_shop, true);
    assert.equal(state.money, before.money - 3000, "the usual 3,000 yen");
    assert.equal(state.affinity.adam, before.affinity.adam + 5);
    assert.equal(state.visits.adam, (before.visits.adam || 0) + 1);
  });
});
