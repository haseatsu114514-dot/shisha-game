// 実際の訪問・LIME・固有会話・交友の締めくくりから、同じ夜の交際選択まで確認する。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    window.T = {
      core: await import("./js/core/state.js"),
      vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"),
      spots: await import("./js/daily/spots.js"),
      phone: await import("./js/daily/phone.js"),
      bonds: await import("./js/daily/bonds.js"),
      romance: await import("./js/daily/romance.js"),
    };
    T.ch1.setupHooks(); T.vn.vnTest.turbo = true;
    T.fresh = () => {
      T.core.newGame();
      Object.assign(T.core.state, { phase: "daily", day: 3, slot: 1 });
      T.vn.backlog().length = 0;
      return T.core.state;
    };
  });
  const run = (friend) => page.evaluate(async (friend) => {
    const state = T.fresh();
    T.vn.vnTest.choose = (_, labels) => Math.max(0, labels.findIndex((l) =>
      friend ? l.includes("友達") : /二人|想いを伝え|付き合って/.test(l)));
    await T.spots.visitChar("minto");
    const first = T.vn.backlog().map((l) => l.text);
    const identity = { known: !!state.flags._minto_identity_revealed, full: !!state.flags._minto_name_known };
    await T.spots.visitChar("minto");
    const afterSecond = !!state.flags._minto_identity_revealed;
    await T.spots.visitChar("minto");
    const commute = T.vn.backlog().map(l => l.text);
    const afterThird = !!state.flags._minto_identity_revealed;
    for (let n = 3; n < 5; n++) await T.spots.visitChar("minto");
    const noSpoiler = !T.phone.morningMessages({ fixedNight: () => false }).some((m) => m.id === "rumor_minto_late_night");
    const invite = T.phone.morningMessages({ fixedNight: () => false }).find((m) => m.id === "lime_minto_first_holiday");
    T.vn.backlog().length = 0;
    await T.vn.play(invite.accept_event);
    await T.bonds.afterStory(invite.accept_event);
    const outing = T.vn.backlog().map((l) => l.text);
    const q1 = state.romanceChoices.bond_q1_minto;
    T.vn.backlog().length = 0;
    await T.vn.play("ch1_minto_private_1");
    await T.bonds.afterStory("ch1_minto_private_1");
    const secondOuting = T.vn.backlog().map((l) => l.text);
    const answerCount = Object.keys(state.romanceChoices).length;
    await T.spots.visitChar("minto"); // 夜の固有会話も読み終える
    state.affinity.minto = 90;
    Object.assign(state, { day: 12, slot: 0 });
    const finaleInvite = T.phone.morningMessages({ fixedNight: () => false }).find((m) => m.origin_id === "lime_minto_bond_finale");
    const workdayFinale = finaleInvite && { slot: finaleInvite.time_slot, after: finaleInvite.after_close };
    state.day = 13;
    const holidayFinale = T.phone.morningMessages({ fixedNight: () => false }).find((m) => m.origin_id === "lime_minto_bond_finale");
    // 夜の約束として保存済みの場合も、大会の前夜に同じ相手へ気持ちを伝えられる。
    state.slot = 2;
    await T.bonds.playFinale("minto");
    const before = state.finales.minto.route;
    const beats = [];
    const postponed = await T.romance.maybeConfession(async (t) => beats.push(t), { busyNight: true, companion: "tsumugi" });
    const confessed = await T.romance.maybeConfession(async (t) => beats.push(t), { busyNight: true, companion: "minto" });
    return { first, identity, afterSecond, afterThird, commute, noSpoiler, invite: invite && { slot: invite.time_slot, after: invite.after_close }, outing, q1,
      secondOuting, answerCount, finaleInvite: workdayFinale,
      holidayFinale: holidayFinale && { slot: holidayFinale.time_slot, after: holidayFinale.after_close },
      before, postponed, confessed, lovers: state.lovers, gift: state.owned.includes("suyaki_minto"), beats };
  }, friend);
  const romance = await run(false);
  assert(!romance.first.some(t => t.includes("出勤前") || t.includes("tonariに来てた")));
  assert.deepEqual(romance.identity, { known: false, full: false });
  assert.equal(romance.afterSecond, false);
  assert.equal(romance.afterThird, true);
  assert(romance.commute.some(t => t.includes("出勤前")));
  assert(romance.noSpoiler);
  assert.deepEqual(romance.invite, { slot: "night", after: true });
  assert(!romance.outing.some((t) => t.includes("お姉、さん") || t.includes("ばれた")), "Already-known identity was revealed again");
  assert.equal(romance.q1.value, 1);
  assert.equal(romance.answerCount, 1, "The private follow-up asked the relationship question twice");
  assert(!romance.secondOuting.some((t) => t.includes("あらためて。私、緑川栞")), "Already-known real name was introduced again");
  assert.deepEqual(romance.finaleInvite, { slot: "night", after: true });
  assert.deepEqual(romance.holidayFinale, { slot: "noon", after: false });
  assert.equal(romance.before, "romance");
  assert.equal(romance.postponed, false, "Confession interrupted an evening with somebody else");
  assert.equal(romance.confessed, true, "Same-person finale on DAY13 postponed confession past the tournament");
  assert(romance.lovers.includes("minto")); assert(romance.gift);
  assert(romance.beats[0].includes("別れ際"));
  console.log("[minto progression] PASS: street recognition, workday invitation, remembered identity/name, one question, DAY13 same-night dating");
  const friend = await run(true);
  assert.equal(friend.q1.value, 0); assert.equal(friend.before, "friend");
  assert.equal(friend.confessed, false); assert.deepEqual(friend.lovers, []); assert(friend.gift);
  console.log("[minto progression] PASS: friendship answer preserves friendship and the same gift");
  const legacy = await page.evaluate(async () => {
    const state = T.fresh();
    state.story.minto = 4;
    state.limeRead.push("rumor_minto_late_night");
    await T.spots.visitChar("minto");
    await T.spots.visitChar("minto");
    const known = { history: !!state.flags._minto_history_shared, phantom: !!state.flags._minto_phantom_shared };
    const lines = T.vn.backlog().map((l) => l.text);
    const fresh = T.fresh();
    fresh.story.minto = 4;
    fresh.inbox.push({ id: "rumor_minto_late_night", read: false });
    await T.spots.visitChar("minto");
    return { known, lines, unread: !!fresh.flags._minto_phantom_shared };
  });
  assert.deepEqual(legacy.known, { history: true, phantom: true });
  assert(legacy.lines.some((t) => /前に|話してくれ/.test(t)));
  assert(!legacy.lines.some((t) => t.includes("初めて") && t.includes("打ち明け")));
  assert.equal(legacy.unread, false, "Unread old LIME fabricated knowledge");
  assert.deepEqual(errors, []);
  console.log("[minto progression] PASS: read old-save LIME is remembered, unread LIME does not fabricate knowledge");
} finally { await browser.close(); }
