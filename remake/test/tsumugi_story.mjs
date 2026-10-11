// 本筋だけの♥2、前後する個別交流、旧セーブ、実際の夜イベントをブラウザで確認する。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
const errors = [];
async function open() {
  const page = await browser.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    window.T = {
      core: await import("./js/core/state.js"),
      stats: await import("./js/core/stats.js"),
      vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"),
      story: await import("./js/chapters/tsumugi-story.js"),
      spots: await import("./js/daily/spots.js"),
      phone: await import("./js/daily/phone.js"),
      bonds: await import("./js/daily/bonds.js"),
      romance: await import("./js/daily/romance.js"),
    };
    T.ch1.setupHooks(); T.vn.vnTest.turbo = true;
    T.fresh = () => {
      T.core.newGame();
      Object.assign(T.core.state, { phase: "daily", day: 3, slot: 1, stamina: 70 });
      T.vn.backlog().length = 0; T.vn.vnTest.choose = null;
      return T.core.state;
    };
    T.lines = () => T.vn.backlog().map(l => l.text);
    T.resources = () => {
      const s = T.core.state;
      return JSON.stringify([s.stats, s.statXp, s.stamina, s.money, s.slot, s.reel, s.owned, s.flavorStock]);
    };
  });
  return page;
}
try {
  const page = await open();
  for (const draftChoice of [0, 1]) {
    const result = await page.evaluate(async draftChoice => {
      const s = T.fresh();
      T.vn.vnTest.choose = () => draftChoice;
      // 魅力と占いを持っていても、固定進行では♥2を超えず、占いを消費しない。
      s.stats.charm = 90; s.fortune = { char: "tsumugi" };
      const before = T.resources();
      const levels = [];
      for (const day of [1, 3, 12, 13]) {
        s.day = day; await T.story.playTsumugiStory(day);
        levels.push(T.stats.affinityLevel("tsumugi"));
      }
      const lines = T.lines();
      T.core.saveToSlot("suien_remake_slot1");
      T.core.loadFromSlot("suien_remake_slot1");
      T.vn.backlog().length = 0;
      await T.story.playTsumugiStory(13);
      const saved = T.core.state;
      return { levels, pts: saved.affinity.tsumugi, sameResources: before === T.resources(),
        fortune: saved.fortune, contacts: saved.contacts, visits: saved.visits.tsumugi || 0,
        stories: saved.story.tsumugi || 0, lovers: saved.lovers, answers: saved.romanceChoices,
        memories: saved.relationshipMemories, lines, reread: T.lines() };
    }, draftChoice);
    assert.deepEqual(result.levels, [1, 1, 2, 2]);
    assert.equal(result.pts, 20); assert(result.sameResources);
    assert.deepEqual(result.fortune, { char: "tsumugi" });
    assert.deepEqual(result.contacts, ["tsumugi"]);
    assert.equal(result.visits, 0); assert.equal(result.stories, 0);
    assert.deepEqual(result.lovers, []); assert.deepEqual(result.answers, {});
    assert.deepEqual(result.memories, ["tsumugi_research", "tsumugi_progress", "tsumugi_submission"]);
    assert(result.lines.includes("うちの店の宣伝になるなら、交換しとけ"));
    assert(result.lines.some(t => t.includes("日常の風景")));
    assert(result.lines.some(t => t.includes("応募完了")));
    assert(!result.lines.some(t => /共感覚|約[5５]万|\{tsumugiContestTheme\}/.test(t)));
    assert.deepEqual(result.reread, [], "Loading replayed or rewarded the fixed story");
  }
  console.log("[tsumugi story] PASS: both draft choices, fixed ♥1→♥2, no action/skill/bond bonus, saved progress");

  const legacy = await page.evaluate(async () => {
    const s = T.fresh();
    Object.assign(s, { day: 13 });
    s.story.tsumugi = 2; s.visits.tsumugi = 2;
    s.affinity.tsumugi = 40; s.affinityCarry.tsumugi = 0.6;
    s.flags._ev_tsumugi_sketch = true; // 旧版のスケッチを読んでも、新しい応募は未読。
    T.core.save(); T.core.load();
    await T.story.playTsumugiStory(13);
    const saved = T.core.state;
    const catchup = { pts: saved.affinity.tsumugi, carry: saved.affinityCarry.tsumugi,
      stories: saved.story.tsumugi, memories: saved.relationshipMemories, lines: T.lines() };
    T.vn.backlog().length = 0; T.core.load();
    await T.story.playTsumugiStory(13);
    catchup.reread = T.lines();
    const lover = T.fresh();
    lover.lovers.push("tsumugi"); lover.affinity.tsumugi = 80;
    lover.lovePts.tsumugi = 14; lover.loveLevel.tsumugi = 1; lover.loveCarry.tsumugi = 0.5;
    await T.story.playTsumugiStory(13);
    return { catchup, lover: { pts: lover.affinity.tsumugi, lovePts: lover.lovePts.tsumugi,
      level: lover.loveLevel.tsumugi, carry: lover.loveCarry.tsumugi } };
  });
  assert.equal(legacy.catchup.pts, 40); assert.equal(legacy.catchup.carry, 0.6);
  assert.equal(legacy.catchup.stories, 2);
  assert(legacy.catchup.lines.some(t => t.includes("イラストのコンテスト")));
  assert(legacy.catchup.lines.some(t => t.includes("応募完了")));
  assert(!legacy.catchup.lines.some(t => t.includes("QRコード") || t.includes("つむぎです")));
  assert.deepEqual(legacy.catchup.memories, ["tsumugi_research", "tsumugi_progress", "tsumugi_submission"]);
  assert.deepEqual(legacy.catchup.reread, [], "Catch-up was not saved before the next free action");
  assert.deepEqual(legacy.lover, { pts: 80, lovePts: 14, level: 1, carry: 0.5 });
  console.log("[tsumugi story] PASS: old contacts, unread submission, existing higher affinity and lover bond preserved");

  const early = await page.evaluate(async () => {
    const s = T.fresh(); s.day = 2;
    await T.spots.visitChar("tsumugi"); await T.spots.visitChar("tsumugi");
    const first = T.lines(); T.vn.backlog().length = 0;
    await T.story.playTsumugiStory(1);
    return { first, later: T.lines(), stories: s.story.tsumugi, hasContact: T.spots.hasContact("tsumugi") };
  });
  assert(early.first.some(t => t.includes("イラストのコンテスト")));
  assert.equal(early.first.filter(t => t.includes("QRコード")).length, 1);
  assert.deepEqual(early.later, []); assert.equal(early.stories, 2); assert(early.hasContact);

  // 本筋の後でも全ての固有会話を読める。友情と恋愛を同じ贈り物まで確かめる。
  for (const friend of [false, true]) {
    const route = await page.evaluate(async friend => {
      const s = T.fresh(); s.day = 12;
      await T.story.playTsumugiStory(12); T.vn.backlog().length = 0;
      T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(l => friend
        ? /ゆっくり|思い出ごと|友達/.test(l) : /会いたい|二人|想いを伝え|付き合/.test(l)));
      for (let i = 0; i < 6; i++) await T.spots.visitChar("tsumugi");
      const visits = T.lines();
      s.affinity.tsumugi = 80; s.slot = 2; s.day = 13;
      await T.bonds.playFinale("tsumugi");
      const finale = s.finales.tsumugi.route;
      const confessed = await T.romance.maybeConfession(async () => {});
      return { visits, finale, confessed, lovers: s.lovers, gift: s.owned.includes("suyaki_tsumugi"),
        q1: s.romanceChoices.bond_q1_tsumugi.value, stories: s.story.tsumugi, lines: T.lines() };
    }, friend);
    assert.equal(route.stories, 6); assert(route.gift);
    assert(!route.visits.some(t => t.includes("ああ、つむぎか") || t.includes("QRコード")));
    assert(route.visits.some(t => /約[5５]万/.test(t)), "Optional SNS scene became inaccessible");
    assert(route.visits.some(t => t.includes("応募の絵、また見せてくれる")));
    assert(route.lines.some(t => t.includes("別の一枚")));
    assert.equal(route.q1, friend ? 0 : 1); assert.equal(route.finale, friend ? "friend" : "romance");
    assert.equal(route.confessed, !friend); assert.deepEqual(route.lovers, friend ? [] : ["tsumugi"]);
  }
  console.log("[tsumugi story] PASS: early exchange once, all optional scenes, friendship and dating still available");

  // ゲーム開始から取材・♥1へ。配達やみんとの登場より先に読める。
  const opening = await open();
  await opening.evaluate(() => {
    T.core.newGame(); T.vn.backlog().length = 0;
    T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(l => l.includes("今は練習しない")));
    T.ch1.startNewGame().catch(e => { window.calendarError = e.message; });
  });
  await opening.waitForFunction(() => T.core.state.affinity.tsumugi === 9, null, { timeout: 30000 });
  const intro = await opening.evaluate(() => ({ day: T.core.state.day, stories: T.core.state.story.tsumugi || 0,
    met: T.core.state.met.tsumugi, contact: T.spots.hasContact("tsumugi"), lines: T.lines(), error: window.calendarError }));
  assert.equal(intro.error, undefined); assert.equal(intro.day, 1); assert.equal(intro.stories, 0);
  assert(intro.met); assert(intro.contact);
  assert(intro.lines.includes("うちの店の宣伝になるなら、交換しとけ"));
  assert(!intro.lines.some(t => /みんと|コンカフェ|ケムリクサへ偵察/.test(t)));
  await opening.close();
  console.log("[tsumugi story] PASS: first-day introduction and contact before other errands/characters");

  // 本番カレンダーの夜枠で必須イベントが発火し、翌日のマップへ戻る。全章通しは不要。
  for (const day of [3, 12, 13]) {
    const calendar = await open();
    await calendar.evaluate(async day => {
      const s = T.fresh(); s.day = day;
      await T.story.playTsumugiStory(day - 1);
      s.flags[`_morning_${day}`] = true;
      if (day === 13) { s.flags._ev_rehearsal = true; s.flags._ev_last_night = true; }
      T.vn.backlog().length = 0;
      T.ch1.resumeGame().catch(e => { window.calendarError = e.message; });
    }, day);
    await calendar.waitForSelector('.map:not(.done) [data-spot="rest"]', { timeout: 20000 });
    await calendar.locator('.map:not(.done) [data-spot="rest"]').click();
    await calendar.locator('[data-test="map-go"]').click();
    if (day < 13) {
      await calendar.waitForFunction(day => window.T.core.state.day === day + 1
        && document.querySelector('.map:not(.done)'), day, { timeout: 30000 });
    } else {
      await calendar.waitForFunction(() => window.T.core.state.day === 14, null, { timeout: 30000 });
    }
    const end = await calendar.evaluate(() => ({ pts: T.core.state.affinity.tsumugi,
      flags: T.core.state.flags, stories: T.core.state.story.tsumugi || 0, lines: T.lines(), error: window.calendarError }));
    assert.equal(end.error, undefined); assert.equal(end.stories, 0);
    assert.equal(end.pts, day < 12 ? 9 : 20);
    const expected = { 3: "_tsumugi_contest_progress",
      12: "_tsumugi_contest_submitted", 13: "_tsumugi_contest_eve" }[day];
    assert(end.flags[expected], `DAY${day} missed its mandatory Tsumugi scene`);
    assert(end.lines.some(t => /コンテスト|下描き|応募|はじめさんの番/.test(t)));
    await calendar.close();
    console.log(`[tsumugi story] PASS: DAY${day} fixed event → next morning`);
  }
  assert.deepEqual(errors, []);
  console.log("[tsumugi story] PASS: first day and DAY3/12/13 calendar events, including the old completed-eve save");
} finally { await browser.close(); }
