// 定休日限定の外出と、仕事後が埋まった大事なイベントを、臨時休暇で進める。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || "/usr/bin/chromium" });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    window.T = { core: await import("./js/core/state.js"), phone: await import("./js/daily/phone.js"),
      spots: await import("./js/daily/spots.js"), map: await import("./js/daily/map.js"),
      ui: await import("./js/core/ui.js"), data: await import("./js/core/data.js"), romance: await import("./js/daily/romance.js") };
    T.templates = T.data.DB.lime;
  });
  for (const id of ["naru", "minto", "adam"]) {
    const result = await page.evaluate(async (id) => {
      T.core.newGame();
      const state = T.core.state;
      Object.assign(state, { phase: "daily", day: 4, slot: 0, contacts: [id], lastBaitoDay: 4 });
      state.met[id] = true; state.affinity[id] = 90;
      const template = id === "adam" ? { id: "temporary_adam_story", sender: id, important: true, type: "invitation",
        private_schedule: "holiday_or_after_close", trigger_condition: "affinity_level", trigger_value: 3,
        accept_event: "outing_adam_1", messages: ["午後、共に出かけよう"] }
        : T.templates.find((m) => m.id === `lime_outing_${id}_1`);
      T.data.DB.lime = [template];
      const due = T.phone.morningMessages({ fixedNight: () => true }).find((m) => m.sender === id);
      const spot = T.spots.SPOTS.find((s) => s.charId === id);
      const before = T.spots.isClosed(spot);
      T.phone.deliverMorning({ fixedNight: () => true });
      const closed = T.spots.isTemporaryClosed(spot);
      T.core.save(); T.core.newGame(); T.core.load();
      const loaded = T.spots.isClosed(spot);
      const item = T.core.state.inbox.find((i) => i.msg.sender === id);
      // 実際に届いた約束を保存した後、別の入口でLIMEを開いても予定の時刻を変えない。
      Object.assign(item, { result: "accepted", done: true, read: true });
      T.core.state.pendingInvite = { event: due.accept_event, sender: id, day: 4, slot: 0,
        originId: due.id, temporaryClosed: true };
      T.phone.expireInvitations();
      const kept = !!T.core.state.pendingInvite;
      T.map.chooseSpot();
      return { before, closed, loaded, kept, time: due.time_slot, temporary: due.temporary_closed,
        words: JSON.stringify(due.messages), ordinary: T.romance.dateSchedule(id, { day: 4, fixedNight: () => true }) };
    }, id);
    assert.equal(result.before, false); assert(result.closed && result.loaded && result.kept, id);
    assert.equal(result.time, "noon"); assert(result.temporary); assert.match(result.words, /臨時/);
    assert.equal(result.ordinary, null, "Ordinary dates changed into surprise days off");
    // 休業ピンは説明を読むために選べるが、訪問ボタンは出さない。
    await page.waitForSelector(`.spot-pin.off[data-test="pin-${id}"]`);
    const pin = page.locator(`[data-test="pin-${id}"]`);
    assert.match(await pin.textContent(), /本日臨時休業/);
    await pin.click();
    assert.match(await page.locator(".mi-no").textContent(), /本日臨時休業/);
    assert.equal(await page.locator('[data-test="map-go"]').count(), 0);
    const expires = await page.evaluate((id) => {
      const spot = T.spots.SPOTS.find((s) => s.charId === id);
      T.core.state.day = 8; // 全員の定休日以外。翌週の同じ日へも持ち越さない。
      const next = T.spots.isClosed(spot);
      T.core.state.chapter = 2; T.core.state.day = 4;
      return { next, chapter: T.spots.isClosed(spot) };
    }, id);
    assert.deepEqual(expires, { next: false, chapter: false });
  }
  const holiday = await page.evaluate(() => {
    T.core.newGame(); Object.assign(T.core.state, { phase: "daily", day: 3, contacts: ["naru"], lastBaitoDay: 3 });
    T.core.state.met.naru = true; T.core.state.affinity.naru = 90;
    T.data.DB.lime = [T.templates.find((m) => m.id === "lime_outing_naru_1")];
    const m = T.phone.morningMessages().find((m) => m.sender === "naru");
    T.data.DB.lime = T.templates;
    return { time: m.time_slot, temporary: !!m.temporary_closed, dayOff: m.closed_on };
  });
  assert.deepEqual(holiday, { time: "noon", temporary: false, dayOff: 3 });
  assert.deepEqual(errors, []);
  console.log("[temporary closures] PASS: all three shop owners, real delivery/map/save/reload, preserved appointment, day/chapter expiry, regular holiday and ordinary dates");
} finally { await browser.close(); }
