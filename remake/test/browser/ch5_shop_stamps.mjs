// 第5章の各地の店めぐり帳（MGR・chapters/ch5-shop-stamps.js）を、実際の地図の来店と LIME の帳面で確かめる。
// 1. 第5章の地元の店（KEMURIKUSA）へ行く → 来店の会話を読み終えると判子が一つ（一言の案内）→ もう一度行っても増えない。
//    くじ券は増えず、代金はいつもの来店のまま。
// 2. 帳面の最後の一店（C.STATION）で判子 → 地元がそろった1枚＋全部そろった2枚＝くじ券3枚。
// 3. LIME の一番上の「店めぐり帳」の行 → 帳面が開き、地域ごとの判子と「判子 10/10」が見える（時間は使わない）。
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
/** 一言（toast）は数秒で消えるので、出た順に書き留めておく。 */
const recordToasts = page => page.evaluate(() => {
  window.__toastLog = [];
  window.__toastWatch?.disconnect();
  window.__toastWatch = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) if (node.classList?.contains("toast")) window.__toastLog.push(node.textContent);
  });
  window.__toastWatch.observe(document.body, { subtree: true, childList: true });
});
const toasts = page => page.evaluate(() => window.__toastLog || []);

const START = 49;
const MET = { naru: true, adam: true, minto: true, ageha: true, kumicho: true, rei: true, steve: true, volk: true };
/** 第5章の自由行動の保存を作って LOAD する（ch5_catering と同じ形。勝負の日は未定）。 */
async function seed(page, { day = 51, slot = 0, flags = {} } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ day, slot, flags, START, MET }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day, slot, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, seed: 0,
      lovers: [], contacts: ["sumi"], kujiTickets: 0 });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: "home", _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: START, stage: 2, part: "free", titleSeen: true,
        read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null, aftermath: 0, finale: 0,
        finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true,
      _spot_guide_naru: true, // 第1章の初日の偵察（C.STATION の地図の解放。ch5_full_flow と同じ）
      // 出張シーシャの依頼の最初の一通が届かない日にしておく（このテストの LIME を一つにする）
      _ch5_catering: { next: day + 30, offers: 0, offer: null, served: {}, last: null }, ...flags };
    Object.assign(value.met, MET);
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    // 辻占のオババが地図の演出を挟まないよう、第5章の出現は済んだことにする（ch5_catering と同じ）
    const fortunePlan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: fortunePlan.map(() => null), used: fortunePlan.map(() => true) };
    core.saveConfig(); core.save();
  }, { day, slot, flags, START, MET });
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
/** 地図のピンを選んで向かう。 */
async function visit(page, id) {
  await page.locator(dt(`pin-${id}`)).click();
  await page.locator(dt("map-go")).click();
}
const book = state => state.flags._ch5_shop_stamps ?? null;

await suite("ch5-shop-stamps", async check => {
  await check("first-stamp-then-repeat-visit", async page => {
    await seed(page);
    await mapReady(page, { day: 51, slot: 0 });
    const before = await get(page);
    assert.equal(book(before), null, "the book starts empty in chapter 5");
    await recordToasts(page);
    await visit(page, "naru");
    await mapReady(page, { day: 51, slot: 1 });
    let state = await get(page);
    assert.deepEqual(book(state).shops, { naru: 51 }, "KEMURIKUSA is stamped after the visit");
    assert.equal(state.kujiTickets, 0, "no tickets for a single stamp");
    assert.equal(state.money, before.money - 3000, "the usual shop price, nothing more");
    assert(state.visitedDay.naru === 51, "one action on the map");
    assert((await toasts(page)).some(text => /店めぐり帳に判子をもらった：KEMURIKUSA（1\/10）/.test(text) && /LIMEの「店めぐり帳」/.test(text)),
      "a short note tells where to see the book");

    // 同じ店は一日一回なので、別の日にもう一度行く（52日目は KEMURIKUSA の定休日なので53日目）
    await rewrite(page, "s.day = 53; s.slot = 0; s.flags._morning_53 = true;");
    await mapReady(page, { day: 53, slot: 0 });
    await recordToasts(page);
    await visit(page, "naru");
    await mapReady(page, { day: 53, slot: 1 });
    assert(!(await toasts(page)).some(text => /店めぐり帳/.test(text)), "no stamp note on a repeat visit");
    state = await get(page);
    assert.deepEqual(book(state).shops, { naru: 51 }, "a repeat visit adds nothing");
    assert.equal(state.kujiTickets, 0);
  });

  await check("last-stamp-grants-tickets-and-book-view", async page => {
    // 地元の C.STATION だけが残った帳面（ほかの地域は受け取り済み）
    const shops = { naru: 50, adam: 50, minto: 50, ch2_ageha: 50, ch2_kumicho: 50, ch2_rei: 50, ch5_tokyo_steve: 50, ch5_tokyo_volk: 50, ch5_dubai_alley: 50 };
    await seed(page, { flags: { _ch5_shop_stamps: { shops, rewards: { widehanga: 1, tokyo: 1, dubai: 1 }, opened: false } } });
    await mapReady(page, { day: 51, slot: 0 });
    const before = await get(page);
    await recordToasts(page);
    await visit(page, "c_station");
    await mapReady(page, { day: 51, slot: 1 });
    const state = await get(page);
    assert.equal(Object.keys(book(state).shops).length, 10, "the book is full");
    assert.deepEqual(book(state).rewards, { widehanga: 1, tokyo: 1, dubai: 1, home: 1, all: 2 });
    assert.equal(state.kujiTickets, 3, "home region (1) + full book (2)");
    assert.equal(state.money, before.money - 2500, "C.STATION's usual price; the book gives no money");
    const notes = await toasts(page);
    assert(notes.some(text => /判子をもらった：C\.STATION（10\/10）/.test(text)), notes.join(" | "));
    assert(notes.some(text => /店めぐり帳が全部そろった。Dr\.fookahから、くじ券を3枚もらった/.test(text)), notes.join(" | "));

    // LIME の一番上の行から帳面を開く（時間は使わない）
    await page.locator(dt("hud-phone")).click();
    const row = page.locator(dt("lime-shortcut-ch5_shop_stamps"));
    await row.waitFor();
    assert.match(await row.textContent(), /店めぐり帳.*判子 10\/10・全部そろった/);
    assert.equal(await row.locator(".lcr-dot").count(), 1, "unread dot until the book is opened once");
    await row.click();
    const panel = page.locator(`#modal.show ${dt("shop-stamps")}`);
    await panel.waitFor();
    assert.equal(await panel.locator(dt("shop-stamps-total")).textContent(), "判子 10/10");
    for (const region of ["home", "widehanga", "tokyo", "dubai"]) {
      assert.match(await panel.locator(dt(`shop-stamps-${region}`)).getAttribute("class"), /done/, `${region} is complete`);
    }
    assert.equal(await panel.locator('li[data-stamped="1"]').count(), 10);
    assert.match(await panel.textContent(), /地元・橙須.*KEMURIKUSA.*EDEN.*PEPPERMINT.*C\.STATION.*隣町・柚ヶ谷.*MELTY PUFF.*神崎煙草店.*零-ZERO-.*東京.*Smoke & Glory.*鉄の煙.*ドバイ.*路地裏のカフェ/);
    await page.locator(dt("shop-stamps-close")).click();
    await mapReady(page, { day: 51, slot: 1 });
    const after = await get(page);
    assert.equal(after.flags._ch5_shop_stamps.opened, true, "opening the book clears the dot");
    assert.equal(after.slot, 1, "viewing the book uses no time");
    assert.equal(after.kujiTickets, 3);
  });

  await check("book-view-partial-progress", async page => {
    await seed(page, { flags: { _ch5_shop_stamps: { shops: { adam: 50, ch5_tokyo_steve: 50 }, rewards: {}, opened: true } } });
    await mapReady(page, { day: 51, slot: 0 });
    await page.locator(dt("hud-phone")).click();
    const row = page.locator(dt("lime-shortcut-ch5_shop_stamps"));
    await row.waitFor();
    assert.match(await row.textContent(), /判子 2\/10・各地のシーシャ屋で一台ずつ/);
    assert.equal(await row.locator(".lcr-dot").count(), 0, "no dot once opened");
    await row.click();
    const panel = page.locator(`#modal.show ${dt("shop-stamps")}`);
    await panel.waitFor();
    assert.equal(await panel.locator(dt("shop-stamps-total")).textContent(), "判子 2/10");
    assert.equal(await panel.locator(`${dt("shop-stamp-adam")}[data-stamped="1"]`).count(), 1);
    assert.equal(await panel.locator(`${dt("shop-stamp-naru")}[data-stamped="0"]`).count(), 1);
    assert.match(await panel.locator(dt("shop-stamps-home")).textContent(), /1\/4/);
    assert.match(await panel.locator(dt("shop-stamps-tokyo")).textContent(), /1\/2/);
    // 帳面は画面に収まり、文字がはみ出さない（中は縦にスクロールできる）
    const fit = await page.evaluate(() => {
      const box = document.querySelector("#modal.show .modal-box").getBoundingClientRect();
      const stage = document.getElementById("stage").getBoundingClientRect();
      const lis = [...document.querySelectorAll("#modal.show .shop-stamps li")].map(li => li.scrollWidth <= li.clientWidth + 1);
      return { inside: box.left >= stage.left - 1 && box.right <= stage.right + 1 && box.top >= stage.top - 1 && box.bottom <= stage.bottom + 1,
        lis: lis.every(Boolean) };
    });
    assert.deepEqual(fit, { inside: true, lis: true });
    await page.locator(dt("shop-stamps-close")).click();
    await mapReady(page, { day: 51, slot: 0 });
  });
});
