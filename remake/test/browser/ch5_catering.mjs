// 第5章の出張シーシャの依頼（DLV・chapters/ch5-catering.js）を、実際の朝のLIME・地図・場面で確かめる。
// 1. 依頼のLIMEが届く → 「引き受けます」→ その日は地図に出ない → 翌日、決まった時間帯に「出張シーシャ」→ 葉の組み合わせを選ぶ
//    → ぴったりならくじ券+2、合うなら+1（お金は動かない・行動1回・体力を使う）。
// 2. 「今回は見送ります」→ 何も減らず、地図にも出ない。次の依頼は数日後。
// 3. 期限: 引き受けたまま日が過ぎたら、スミさんの「気にすんな」が届いて地図から消える。返事をしないまま締め切られた依頼は、返事のボタンが出ない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const mapReady = (page, { day, slot } = {}) => page.waitForFunction(([day, slot]) => {
  const s = window.__remake?.state;
  return s && (day === undefined || s.day === day) && (slot === undefined || s.slot === slot)
    && document.querySelector('.map:not(.done):not([data-revealing="true"])[data-region="home"] [data-test=pin-tonari]')
    && !document.querySelector("#modal.show");
}, [day, slot], { timeout: 60000 });
const clearLog = page => page.evaluate(async () => (await import("./js/vn/engine.js")).clearLog());
const logText = page => page.evaluate(async () => (await import("./js/vn/engine.js")).backlog().map(row => row.text).join("\n"));
const model = page => page.evaluate(async () => {
  const m = await import("./js/chapters/ch5-catering-model.js");
  return { requests: structuredClone(m.CATERING_REQUESTS), gap: m.REQUEST_GAP_DAYS, job: m.JOB_DAYS, stamina: m.CATERING_STAMINA };
});

const START = 49; // 第5章の1日目。51日目＝第5章の3日目の朝に、最初の依頼が届く
/** 第5章の自由行動の保存を作って LOAD する（朝の LIME は LOAD の後に届く）。 */
async function seed(page, { day = 51, slot = 0, seedValue = 0, flags = {}, inbox = [], met = {} } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ day, slot, seedValue, flags, inbox, met, START }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day, slot, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, seed: seedValue,
      lovers: [], contacts: ["sumi"], kujiTickets: 0 });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: "home", _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: START, stage: 2, part: "free", titleSeen: true,
        read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
        finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true, ...flags };
    value.inbox = inbox;
    Object.assign(value.met, met);
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    // 辻占のオババが地図の演出を挟まないよう、第5章の出現は済んだことにする（ch5_home_talks と同じ）
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  }, { day, slot, seedValue, flags, inbox, met, START });
  await reopen(page);
}
async function reopen(page) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
  });
  await page.locator(dt("slot-0")).click();
}
/** 今の保存を書き換えて保存し、LOAD し直す（日を進める等）。 */
async function rewrite(page, change) {
  await page.evaluate(async change => {
    const core = await import("./js/core/state.js");
    new Function("s", change)(core.state);
    core.save();
  }, change);
  await reopen(page);
}
/** スミさんのトークを開いて、返事を一つ選び、スマホを閉じる。 */
async function replyToSumi(page, text, note) {
  await page.locator(dt("hud-phone")).click();
  await page.locator(dt("lime-chat-sumi")).click();
  await page.getByRole("button", { name: text, exact: true }).click();
  await page.locator(".lime-chat .lime-note", { hasText: note }).waitFor();
  await page.locator(dt("phone-next")).click();
  await page.locator(dt("phone-close")).click();
  await page.locator(".phone-overlay").waitFor({ state: "detached" });
}
const offerOf = state => state.flags._ch5_catering?.offer ?? null;

await suite("ch5-catering", async check => {
  for (const fit of ["best", "ok"]) await check(`request-accept-then-serve-${fit}`, async page => {
    // 地元の店の行き先がそろった地図で、ピンの重なりも見る（昼の会・夜の会の両方）
    await seed(page, { seedValue: fit === "best" ? 0 : 3, met: { naru: true, adam: true, minto: true } });
    await mapReady(page, { day: 51, slot: 0 });
    const { requests, job, stamina } = await model(page);
    let state = await get(page);
    const offer = offerOf(state);
    assert(offer && offer.accepted === null, "a request arrived this morning");
    const entry = requests.find(r => r.id === offer.id);
    const item = state.inbox.find(i => i.id === offer.msg);
    assert.equal(item?.msg?.sender, "sumi", "Sumi forwards the shop's request");
    assert.equal(item.read, false);
    assert.equal(await page.locator(dt("pin-ch5_catering")).count(), 0, "not on the map before accepting");

    await replyToSumi(page, "引き受けます", "引き受けた");
    state = await get(page);
    assert.deepEqual([offerOf(state).accepted, offerOf(state).until], [51, 51 + job]);
    assert.equal(await page.locator(dt("pin-ch5_catering")).count(), 0, "the job starts tomorrow");

    // 翌日、その依頼の時間帯（昼の会・夜の会）に地図から向かう
    await rewrite(page, `s.day = 52; s.slot = ${entry.slot}; s.flags._morning_52 = true;`);
    await mapReady(page, { day: 52, slot: entry.slot });
    const before = await get(page);
    const pin = page.locator(dt("pin-ch5_catering"));
    assert.equal(await pin.count(), 1, "the job is on the home map");
    // ほかの行き先のピンと、右下の案内の枠に重ならない
    const layout = await page.evaluate(() => {
      const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom }; };
      const map = document.querySelector(".map:not(.done) .map-pins"), mine = map.querySelector('[data-spot="ch5_catering"]');
      return { mine: box(mine), info: box(document.querySelector(".map:not(.done) .map-info")),
        others: [...map.querySelectorAll(".spot-pin")].filter(node => node !== mine).map(node => ({ id: node.dataset.spot, ...box(node) })) };
    });
    const apart = (a, b) => a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y;
    for (const other of [...layout.others, { id: "map-info", ...layout.info }]) assert(apart(layout.mine, other), `ch5_catering と ${other.id} が重なる`);
    await clearLog(page);
    await pin.click();
    await page.locator(dt("map-go")).click();
    const index = entry.options.findIndex(o => o.fit === fit);
    await page.locator(dt(`catering-option-${index}`)).click();
    // 夜の会なら、そのまま夜が明けて翌日の昼の地図へ
    await (entry.slot === 0 ? mapReady(page, { day: 52, slot: 1 }) : mapReady(page, { day: 53, slot: 0 }));
    state = await get(page);
    const text = await logText(page);
    assert.match(text, /道具を返しに、tonariへ寄った/, "back at tonari with Sumi after the job");
    assert.equal(state.kujiTickets, fit === "best" ? 2 : 1, `${fit} → tickets`);
    assert.equal(state.money, before.money, "no money for the job");
    assert.equal(offerOf(state), null, "the request is done");
    assert.equal(state.flags._ch5_catering.served[entry.id], 1);
    assert.deepEqual(state.flags._ch5_catering.last, { id: entry.id, day: 52, fit, tickets: fit === "best" ? 2 : 1 });
    assert.equal(state.visitedDay.ch5_catering, 52, "one action on the map");
    // 体力は mukai のシフトと同じだけ使う（盤の恩恵で少し軽くなることがある）。夜の会は、そのあと眠って戻る
    if (entry.slot === 0) assert(state.stamina < before.stamina && state.stamina >= before.stamina + stamina,
      `the job uses stamina like a shift (${before.stamina} → ${state.stamina})`);
    assert.equal(state.flags._ch5.part, "free", "the story does not move");
    assert.equal(await page.locator(dt("pin-ch5_catering")).count(), 0, "gone from the map");
  });

  await check("request-decline-changes-nothing", async page => {
    await seed(page);
    await mapReady(page, { day: 51, slot: 0 });
    const { gap } = await model(page);
    const before = await get(page);
    assert(offerOf(before));
    await replyToSumi(page, "今回は見送ります", "今回は見送った");
    const state = await get(page);
    assert.equal(offerOf(state), null);
    assert.equal(state.flags._ch5_catering.next, 51 + gap, "the next request comes a few days later");
    assert.deepEqual([state.money, state.kujiTickets, state.slot, state.affinity.sumi || 0],
      [before.money, 0, 0, before.affinity.sumi || 0], "declining costs nothing");
    assert.equal(await page.locator(dt("pin-ch5_catering")).count(), 0);
    const item = state.inbox.find(i => i.msg?.ch5Catering);
    assert(item.log.some(entry => entry.me && entry.text === "今回は見送ります"));
  });

  await check("expired-job-and-unanswered-request", async page => {
    // 引き受けたまま期限（50日目）が過ぎた → 51日目の朝にスミさんの一言が届き、地図から消える
    await seed(page, { flags: { _ch5_catering: { next: 0, offers: 1, served: {}, last: null,
      offer: { id: "festival_rest", msg: "ch5-catering:festival_rest:d46", day: 46, accepted: 47, until: 50 } } } });
    await mapReady(page, { day: 51, slot: 0 });
    const { gap } = await model(page);
    let state = await get(page);
    assert.equal(offerOf(state), null);
    assert.equal(state.flags._ch5_catering.next, 50 + gap);
    const lapse = state.inbox.find(i => /^ch5-catering-lapse:/.test(i.id));
    assert(lapse && lapse.msg.sender === "sumi" && !lapse.read, "Sumi says it is fine");
    assert.equal(await page.locator(dt("pin-ch5_catering")).count(), 0);
    assert.equal(state.kujiTickets, 0);

    // 返事をしないまま締め切られた依頼: 返事のボタンを出さず、締め切りの一言だけ
    const msg = { id: "ch5-catering:wedding_party:d49", sender: "sumi", type: "chat", ch5Catering: "wedding_party",
      messages: ["店のLIMEに、出張の頼みが来てる。お前に回すぞ"],
      replies: [{ text: "引き受けます", action: "ch5_catering_accept", response: "おう", affinity: 0 },
        { text: "今回は見送ります", action: "ch5_catering_decline", response: "わかった", affinity: 0 }] };
    await seed(page, { day: 51, flags: { _ch5_catering: { next: 0, offers: 1, served: {}, last: null,
      offer: { id: "wedding_party", msg: msg.id, day: 49, accepted: null, until: 50 } } },
      inbox: [{ id: msg.id, originId: msg.id, day: 49, chapter: 5, msg, read: false, done: false, replyState: "waiting", log: [] }] });
    await mapReady(page, { day: 51, slot: 0 });
    state = await get(page);
    assert.equal(offerOf(state), null);
    const item = state.inbox.find(i => i.id === msg.id);
    assert.deepEqual([item.done, item.replyState], [true, "expired"]);
    await page.locator(dt("hud-phone")).click();
    await page.locator(dt("lime-chat-sumi")).click();
    await page.locator(".lime-chat .lime-note", { hasText: "返事をしないうちに" }).waitFor();
    assert.equal(await page.getByRole("button", { name: "引き受けます", exact: true }).count(), 0, "no reply buttons after the deadline");
    await page.locator(dt("phone-next")).click();
    await page.locator(dt("phone-close")).click();
  });
});
