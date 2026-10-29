// 本筋では最初の♥1だけを保証し、個別交流・旧セーブ・実際の夜イベントをブラウザで確認する。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { installLoadingComicReader } from "./browser/loading_reader.mjs";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
const errors = [];
async function open() {
  const page = await browser.newPage();
  await installLoadingComicReader(page);
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
      // 魅力と占いを持っていても、固定進行は最初の♥1だけで、占いを消費しない。
      s.stats.charm = 90; s.fortune = { char: "tsumugi" };
      const before = T.resources();
      const levels = [];
      for (const day of [1, 3, 11, 13]) {
        s.day = day; await T.story.playTsumugiStory(day);
        levels.push(T.stats.affinityLevel("tsumugi"));
      }
      const lines = T.lines();
      T.core.saveToSlot("suien_remake_slot1");
      T.core.loadFromSlot("suien_remake_slot1");
      T.vn.backlog().length = 0;
      await T.story.playTsumugiStory(13);
      const saved = T.core.state;
      return { levels, pts: saved.affinity.tsumugi || 0, sameResources: before === T.resources(),
        fortune: saved.fortune, contacts: saved.contacts, visits: saved.visits.tsumugi || 0,
        stories: saved.story.tsumugi || 0, lovers: saved.lovers, answers: saved.romanceChoices,
        memories: saved.relationshipMemories, lines, reread: T.lines() };
    }, draftChoice);
    assert.deepEqual(result.levels, [1, 1, 1, 1]);
    assert.equal(result.pts, 9); assert(result.sameResources);
    assert.deepEqual(result.fortune, { char: "tsumugi" });
    assert.deepEqual(result.contacts, ["sumi", "tsumugi"]);
    assert.equal(result.visits, 0); assert.equal(result.stories, 0);
    assert.deepEqual(result.lovers, []); assert.deepEqual(result.answers, {});
    assert.deepEqual(result.memories, ["tsumugi_research", "tsumugi_progress", "tsumugi_submission"]);
    assert(result.lines.includes("うちの店の宣伝になるなら、交換しとけ"));
    assert(result.lines.some(t => t.includes("記憶と気配の交差")));
    assert(result.lines.some(t => t.includes("応募完了")));
    assert(!result.lines.some(t => /共感覚|約[5５]万|\{tsumugiContestTheme\}/.test(t)));
    assert.deepEqual(result.reread, [], "Loading replayed or rewarded the fixed story");
  }
  console.log("[tsumugi story] PASS: both draft choices, fixed scenes grant only initial heart, saved progress");

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
    // #814: 2本目の会話は♥1で開く。間にハートが上がった状態を作る（ペースは別テスト）。
    await T.spots.visitChar("tsumugi"); s.affinity.tsumugi = Math.max(s.affinity.tsumugi || 0, 9); await T.spots.visitChar("tsumugi");
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
        ? /ゆっくり|思い出ごと|友達/.test(l) : /会いたい|２人|想いを伝え|付き合/.test(l)));
      // #814: k本目は♥k で開く。各回の前にそのハートへ届いた状態を作る（読む順と内容を検査する）。
      for (let i = 0; i < 6; i++) {
        s.affinity.tsumugi = Math.max(s.affinity.tsumugi || 0, T.stats.AFFINITY_RANK_PTS[Math.min(5, s.story.tsumugi || 0)]);
        await T.spots.visitChar("tsumugi");
      }
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
    assert(route.visits.some(t => t.includes("応募の夜に見せてもらった絵")));
    assert(route.lines.some(t => t.includes("別の１枚")));
    assert.equal(route.q1, friend ? 0 : 1); assert.equal(route.finale, friend ? "friend" : "romance");
    assert.equal(route.confessed, !friend); assert.deepEqual(route.lovers, friend ? [] : ["tsumugi"]);
  }
  console.log("[tsumugi story] PASS: early exchange once, all optional scenes, friendship and dating still available");

  // ゲーム開始から取材へ。配達やみんとの登場より先に読める。
  const opening = await open();
  await opening.evaluate(() => {
    T.core.newGame(); T.vn.backlog().length = 0;
    T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(l => l.includes("今は練習しない")));
    T.ch1.startNewGame().catch(e => { window.calendarError = e.message; });
  });
  await opening.waitForFunction(() => T.core.state.flags._tsumugi_contest_research, null, { timeout: 30000 });
  const intro = await opening.evaluate(() => ({ day: T.core.state.day, stories: T.core.state.story.tsumugi || 0,
    met: T.core.state.met.tsumugi, contact: T.spots.hasContact("tsumugi"), lines: T.lines(), error: window.calendarError }));
  assert.equal(intro.error, undefined); assert.equal(intro.day, 1); assert.equal(intro.stories, 0);
  assert(intro.met); assert(intro.contact);
  assert(intro.lines.includes("うちの店の宣伝になるなら、交換しとけ"));
  assert(!intro.lines.some(t => /みんと|コンカフェ|ケムリクサへ偵察/.test(t)));
  await opening.close();
  console.log("[tsumugi story] PASS: first-day introduction and contact before other errands/characters");

  // #815: 客席の固有会話は客の視点。取材・連絡先交換の後は、初回でも初対面の態度へ戻らない。
  const seat = await open();
  for (const researched of [true, false]) {
    const visit = await seat.evaluate(async researched => {
      const s = T.fresh(); s.day = 2;
      if (researched) await T.story.playTsumugiStory(1);
      T.vn.backlog().length = 0;
      T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(l => l.includes("一声かけて")));
      for (let i = 0; i < 6; i++) {
        s.affinity.tsumugi = Math.max(s.affinity.tsumugi || 0, T.stats.AFFINITY_RANK_PTS[Math.min(5, s.story.tsumugi || 0)]); // #814
        await T.spots.visitChar("tsumugi");
      }
      return { lines: T.lines(), research: !!s.flags._tsumugi_contest_research };
    }, researched);
    assert.equal(visit.research, true);
    assert(!visit.lines.some(t => /シフト中|バイト中|閉店作業|別のお客さんの一台|あなた、最初の日/.test(t)));
    assert.equal(visit.lines.includes("……どうも"), !researched, "Known regular returned to a first meeting");
    assert.equal(visit.lines.includes("……ありがとうございます"), researched);
  }
  await seat.close();
  console.log("[tsumugi story] PASS: customer-seat scenes, known after the interview, first meeting kept before it");

  // 通常好感度は既読数と独立。会話は必要ハートで開き、一訪問で最古未読を一本だけ読む。
  const gate = await open();
  const g = await gate.evaluate(async () => {
    const below = T.fresh(); below.story.naru = 1; below.affinity.naru = 8;
    const belowHeart = T.spots.hasNewStory("naru");
    below.affinity.naru = 9;
    const atHeart = T.spots.hasNewStory("naru");
    const s = T.fresh(); s.day = 4; s.slot = 0; s.met.naru = true;
    const lv = () => T.stats.affinityLevel("naru");
    await T.spots.visitChar("naru");
    const first = { story: s.story.naru, pts: s.affinity.naru, lv: lv(), open: T.spots.hasNewStory("naru") };
    T.stats.gainAffinity("naru", 30); // 未読会話を既読にせず、獲得点は保留せずに加算する。
    const gained = { story: s.story.naru, pts: s.affinity.naru, lv: lv(), waiting: s.flags._naru_affinity_waiting_pts || 0, open: T.spots.hasNewStory("naru") };
    T.vn.backlog().length = 0;
    await T.spots.visitChar("naru");
    const second = { story: s.story.naru, pts: s.affinity.naru, lv: lv(), waiting: s.flags._naru_affinity_waiting_pts || 0,
      read: T.lines().length > 0, released: s.flags._naru_affinity_stage_released_pts || 0 };
    // 第2章でも好感度は伸び、未読の第1章会話は次の訪問へ残る。
    const ch2 = T.fresh(); ch2.chapter = 2; ch2.met.naru = true; T.stats.gainAffinity("naru", 60);
    return { belowHeart, atHeart, first, gained, second, ch2: { story: ch2.story.naru || 0,
      open: T.spots.hasNewStory("naru"), level: T.stats.affinityLevel("naru"), points: ch2.affinity.naru,
      waiting: ch2.flags._naru_affinity_waiting_pts || 0 } };
  });
  assert.equal(g.belowHeart, false, "2nd talk waits for ♥1");
  assert.equal(g.atHeart, true, "♥1 opens the 2nd talk");
  assert.deepEqual(g.first, { story: 1, pts: 9, lv: 1, open: true }, "First completed talk guarantees ♥1");
  assert.deepEqual(g.gained, { story: 1, pts: 35, lv: 3, waiting: 0, open: true },
    "Ordinary gains cross unread hearts without reading the next talk or deferring points");
  assert.deepEqual(g.second, { story: 2, pts: 43, lv: 3, waiting: 0, read: true, released: 0 },
    "One visit reads only the 2nd talk and grants its normal reward");
  assert.deepEqual(g.ch2, { story: 0, open: true, level: 4, points: 51, waiting: 0 },
    "Chapter 2 gains leave the first chapter's oldest unread talk available");
  await gate.close();
  console.log("[tsumugi story] PASS: heart1 floor, heart-gated talks, independent ordinary gains, one talk per visit across chapters");

  // 本番カレンダーの夜枠で必須イベントが発火し、翌日のマップへ戻る。全章通しは不要。
  for (const day of [3, 11, 13]) {
    const calendar = await open();
    await calendar.evaluate(async day => {
      const s = T.fresh(); s.day = day;
      await T.story.playTsumugiStory(day - 1);
      if (day === 3) {
        // DAY3は絵の確認に続いて実際の制作練習まで通す。
        const { craftTest } = await import("./js/craft/session.js");
        craftTest.auto = "good";
      }
      s.flags[`_morning_${day}`] = true;
      if (day === 13) { s.flags._ev_rehearsal = true; s.flags._ev_last_night = true; }
      T.vn.backlog().length = 0;
      T.ch1.resumeGame().catch(e => { window.calendarError = e.message; });
    }, day);
    await calendar.waitForSelector('.map:not(.done) [data-spot="rest"]', { timeout: 20000 });
    await calendar.locator('.map:not(.done):not([data-revealing="true"])').waitFor(); // #780: 解錠演出中は選択を受け付けない
    await calendar.locator('.map:not(.done) [data-spot="rest"]').click();
    await calendar.locator('[data-test="map-go"]').click();
    if (day < 13) {
      await calendar.waitForFunction(day => window.T.core.state.day === day + 1
        && document.querySelector('.map:not(.done)'), day, { timeout: day === 3 ? 60000 : 30000 });
    } else {
      await calendar.waitForFunction(() => window.T.core.state.day === 14, null, { timeout: 30000 });
    }
    const end = await calendar.evaluate(() => ({ pts: T.core.state.affinity.tsumugi || 0,
      flags: T.core.state.flags, stories: T.core.state.story.tsumugi || 0, lines: T.lines(), error: window.calendarError }));
    assert.equal(end.error, undefined); assert.equal(end.stories, 0);
    assert.equal(end.pts, 9);
    const expected = { 3: "_tsumugi_contest_progress",
      11: "_tsumugi_contest_submitted", 13: "_tsumugi_contest_eve" }[day];
    assert(end.flags[expected], `DAY${day} missed its mandatory Tsumugi scene`);
    if (day === 3) {
      assert(end.flags._ev_first_practice, "DAY3 missed the following crafting practice");
      assert.equal(end.flags._craft_practice_runs?.length, 1);
      assert.equal(end.flags._craft_practice_runs[0].adjustments, 0);
    }
    assert(end.lines.some(t => /コンテスト|下描き|応募|はじめさんの番/.test(t)));
    await calendar.close();
    console.log(`[tsumugi story] PASS: DAY${day} fixed event → next morning`);
  }
  // 旧DAY12/13セーブは、移動済みの応募を補完し、保存後の再読では報酬も会話も重ねない。
  for (const day of [12, 13]) {
    for (const submitted of [false, true]) {
      const old = await page.evaluate(async ({ day, submitted }) => {
        const s = T.fresh(); s.day = day;
        await T.story.playTsumugiStory(3);
        if (submitted) await T.story.playTsumugiStory(11);
        s.flags._ev_tsumugi_sketch = true;
        T.core.save(); T.core.load(); T.vn.backlog().length = 0;
        const before = T.resources();
        await T.story.playTsumugiStory(day - 1);
        const first = T.lines();
        T.core.load(); T.vn.backlog().length = 0;
        await T.story.playTsumugiStory(day - 1);
        return { first, repeat: T.lines(), sameResources: before === T.resources(),
          submitted: T.core.state.flags._tsumugi_contest_submitted, pts: T.core.state.affinity.tsumugi || 0 };
      }, { day, submitted });
      assert(old.submitted); assert.equal(old.pts, 9); assert(old.sameResources);
      assert.equal(old.first.some(t => t.includes("応募完了")), !submitted);
      assert.deepEqual(old.repeat, []);
    }
  }
  console.log("[tsumugi story] PASS: unread/read DAY12/13 legacy submissions, save/load without duplicate reward");

  // DAY11→12→13を同じカレンダーで連続プレイ。自由行動2回を保ち、間の夜は強制回なし。
  // H08: DAY11の応募は、完成を告げる前半→完成画の提示・応募の後半に分かれる。
  const sketchTrace = ["ch1_tsumugi_sketch_presentation", "ch1_tsumugi_sketch"];
  const mandatoryTrace = trace => trace.filter(id => /tsumugi|preparation|midcheck|rehearsal/.test(id));
  const consecutive = await open();
  await consecutive.evaluate(async () => {
    const s = T.fresh(); Object.assign(s, { day: 11, slot: 0 });
    await T.story.playTsumugiStory(10);
    s.flags._morning_11 = true;
    s.flags._lime_tut = 1; // DAY11まで遊んだ状態。初回LIME案内の操作は別の検証で扱う。
    s.flavors.push("blueberry", "lemon"); s.flavorStock.blueberry = 50; s.flavorStock.lemon = 50;
    const { craftTest } = await import("./js/craft/session.js"); craftTest.auto = "good";
    T.vn.backlog().length = 0;
    T.trace = [];
    const hook = T.vn.hooks.onLine;
    T.vn.hooks.onLine = (id, line) => {
      hook?.(id, line);
      if (T.trace.at(-1) !== id) T.trace.push(id);
    };
    T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex(l => l.includes("通しリハーサル")));
    T.ch1.resumeGame().catch(e => { window.calendarError = e.message; });
  });
  for (const day of [11, 12, 13]) {
    for (const slot of [0, 1]) {
      await consecutive.waitForFunction(({ day, slot }) => T.core.state.day === day && T.core.state.slot === slot
        && document.querySelector('.map:not(.done) [data-spot="rest"]'), { day, slot }, { timeout: 60000 });
      if (day === 12 && slot === 0) {
        const before = await consecutive.evaluate(() => {
          // 保存された側で永続性を確認する。ここで loadFromSlot すると state が
          // 差し替わり、カレンダーのセッション同一性ガード（runDaily の owner 照合）が
          // 働いて進行中のループが終了し、DAY13 のマップへ進めなくなる。
          T.core.saveToSlot("suien_remake_slot1");
          const saved = JSON.parse(localStorage.getItem("suien_remake_slot1"));
          return { flags: saved.flags, trace: T.trace };
        });
        assert(before.flags._tsumugi_contest_submitted);
        assert.deepEqual(mandatoryTrace(before.trace), sketchTrace,
          "DAY11 must finish the presentation and submission exactly once before DAY12");
      }
      await consecutive.locator('.map:not(.done):not([data-revealing="true"])').waitFor(); // #780: 解錠演出中は選択を受け付けない
      await consecutive.locator('.map:not(.done) [data-spot="rest"]').click();
      await consecutive.locator('[data-test="map-go"]').click();
      // Keep resting through the real invitation deadline prompt without
      // reading or accepting it; the next day/slot still needs to advance.
      await consecutive.waitForFunction(({ day, slot }) => T.core.state.day !== day || T.core.state.slot !== slot
        || document.querySelector('[data-test="venue-invite-go"]'), { day, slot }, { timeout: 60000 });
      const reminder = consecutive.locator('[data-test="venue-invite-go"]');
      if (await reminder.count()) await reminder.click();
    }
    if (day < 13) {
      await consecutive.waitForFunction(day => T.core.state.day === day + 1
        && document.querySelector('.map:not(.done)'), day, { timeout: 60000 });
      if (day === 12) {
        assert.deepEqual(mandatoryTrace(await consecutive.evaluate(() => T.trace)),
          sketchTrace, "DAY12 repeated or added a mandatory training/story scene");
      }
    }
  }
  await consecutive.waitForFunction(() => T.core.state.day === 14, null, { timeout: 60000 });
  const final = await consecutive.evaluate(() => ({ trace: T.trace, flags: T.core.state.flags,
    pts: T.core.state.affinity.tsumugi || 0, error: window.calendarError }));
  assert.equal(final.error, undefined); assert.equal(final.pts, 9);
  assert.equal(final.trace.filter(id => id === "ch1_tsumugi_sketch_presentation").length, 1);
  assert.equal(final.trace.filter(id => id === "ch1_tsumugi_sketch").length, 1);
  assert.equal(final.trace.filter(id => id === "ch1_tsumugi_eve").length, 1);
  assert(final.trace.indexOf("ch1_tsumugi_sketch_presentation") < final.trace.indexOf("ch1_tsumugi_sketch"));
  assert(final.trace.indexOf("ch1_tsumugi_sketch") < final.trace.indexOf("ch1_tsumugi_eve"));
  assert(final.flags._ev_rehearsal && final.flags._ev_last_night);
  assert.equal(final.flags._craft_practice_runs.length, 1);
  assert.equal(final.flags._craft_practice_runs[0].kind, "rehearsal");
  await consecutive.close();
  console.log("[tsumugi story] PASS: continuous DAY11→14, two actions/day, quiet DAY12, DAY13 rehearsal/eve exactly once");

  // #1076 DAY3: つむぎの描きかけ下描き（cg_ch1_tsumugi_sketch_wip）を全景で見せ、回答した箇所へ
  // 一度だけ寄せる。選んでいない側は寄せず、SKIP・低減モーションでは全景のまま。中断後は残さない。
  const SKETCH = "cg_ch1_tsumugi_sketch_wip";
  const FOCUS = ["cg-focus-sketch-cat", "cg-focus-sketch-blank"]; // 0=猫の顔 1=未着色の右側（選択肢の順と一致）
  const draft = await open();
  await draft.evaluate(() => { T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4; });
  const cgSnap = () => {
    const node = document.querySelector(".vn-cg");
    return { cg: node?.dataset.cg || "", show: !!node?.classList.contains("show"),
      classes: node ? [...node.classList] : [] };
  };
  const startDraft = async () => {
    await draft.evaluate(() => {
      T.fresh(); T.vn.backlog().length = 0; window.finished = false;
      T.vn.play("ch1_tsumugi_work_in_progress").then(() => { window.finished = true; });
    });
    await draft.waitForFunction(() => T.vn.backlog().length > 0);
  };
  // 全画面のCG（z-index）が台詞箱を覆うので、送りはキーボードのEnterで行う（箱クリックは
  // 当たり判定で弾かれる）。選択だけはボタンを押す。各行の表示時点でCGの寄せ状態を記録する。
  const playDraft = async (answer) => {
    await startDraft();
    const trace = [];
    for (let i = 0; i < 200; i++) {
      if (await draft.evaluate(() => window.finished)) break;
      const choices = draft.locator(".vn-choices button");
      if (await choices.count()) {
        assert.deepEqual(await choices.allTextContents(), ["ほどけていく煙と猫", "まだ色のない右側"]);
        await choices.nth(answer).click();
        await draft.waitForFunction(() => window.finished || !document.querySelector(".vn-choices button"));
        continue;
      }
      await draft.waitForFunction(() => window.finished || document.querySelector(".vn-next.show")
        || document.querySelector(".vn-choices button"));
      if (await draft.evaluate(() => window.finished)) break;
      if (await choices.count()) continue;
      trace.push(await draft.evaluate(cgSnap));
      const before = await draft.evaluate(() => document.querySelector(".vn-text").textContent);
      await draft.keyboard.press("Enter");
      await draft.waitForFunction(b => window.finished
        || document.querySelector(".vn-text").textContent !== b || document.querySelector(".vn-choices button"), before);
    }
    return trace;
  };
  for (const answer of [0, 1]) {
    const trace = await playDraft(answer);
    assert(trace.some(s => s.cg === SKETCH && s.show && !FOCUS.some(f => s.classes.includes(f))),
      `DAY3 answer ${answer}: draft was not shown full-frame before the eye-guide`);
    assert(trace.some(s => s.cg === SKETCH && s.classes.includes(FOCUS[answer])),
      `DAY3 answer ${answer}: the chosen area was never focused`);
    assert(!trace.some(s => s.classes.includes(FOCUS[1 - answer])),
      `DAY3 answer ${answer}: focused the area the player did not choose`);
    assert.equal(await draft.locator(".vn-cg.show").count(), 0, `DAY3 answer ${answer}: the sketch stayed open`);
    assert.equal(await draft.evaluate(() => T.core.state.flags._tsumugi_contest_progress), true);
  }
  // 低減モーションでは全景のまま（カメラを動かさない）。
  await draft.emulateMedia({ reducedMotion: "reduce" });
  for (const answer of [0, 1]) {
    const trace = await playDraft(answer);
    assert(trace.some(s => s.cg === SKETCH && s.show), `DAY3 reduced ${answer}: draft not shown`);
    assert(!trace.some(s => FOCUS.some(f => s.classes.includes(f))), `DAY3 reduced ${answer}: camera moved`);
  }
  await draft.emulateMedia({ reducedMotion: null });
  // SKIPでも下描きは見せ、カメラは動かさない。答えは勝手に入れない。
  await startDraft();
  await draft.locator('[data-test="vn-skip"]').click();
  await draft.locator(".vn-choices button").first().waitFor();
  assert.equal(await draft.locator(".vn-cg.show").count(), 1, "DAY3 SKIP hid the draft before the choice");
  const skipClasses = await draft.evaluate(() => [...(document.querySelector(".vn-cg")?.classList || [])]);
  assert(!FOCUS.some(f => skipClasses.includes(f)), "DAY3 SKIP moved the camera");
  assert.equal(await draft.evaluate(() => T.core.state.flags._tsumugi_contest_draft_window ?? null), null);
  await draft.locator(".vn-choices button").nth(0).click();
  await draft.waitForFunction(() => window.finished, null, { timeout: 20000 });
  await draft.close();
  console.log("[tsumugi story] PASS: DAY3 draft shown full, answer guides focus once, reduced-motion/SKIP keep the full view");

  assert.deepEqual(errors, []);
  console.log("[tsumugi story] PASS: first day and DAY3/11/13 calendar events, including the old completed-eve save");
} finally { await browser.close(); }
