// 章が変わった時の心得の盤の知らせ（SPEC 6.3・11章・5.2。#1801 C10）: 本物の runDaily で、第2章の最初の朝に
// 「盤に新しいスキルがNつ」と「今なら盤を組み直せる」のカードを出し、地図の右下の案内に組み直しの期限を添える（上の帯はピンと重なるので使わない）。一度だけ出すこと・旧セーブ・周回は node の growth_chapter_notice.mjs で見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    window.R = { core: await import("./js/core/state.js"), growth: await import("./js/core/growth.js"),
      board: await import("./js/core/growth-board.js"), data: await import("./js/core/growth-board-data.js"),
      ch1: await import("./js/chapters/ch1.js"), calendar: await import("./js/daily/calendar.js"),
      map: await import("./js/daily/map.js"), vn: await import("./js/vn/engine.js") };
    R.ch1.setupHooks(); R.vn.vnTest.turbo = true; R.vn.vnTest.choose = () => 0;
    // 第1章の盤を少し灯した保存を、第2章の最初の日常の朝へ進める（冒頭の強制イベントの後）
    const s = R.core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 0, stamina: 100 });
    Object.assign(s.flags, { _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true, _lime_opened: true, _lime_tut: 1 });
    const g = R.growth.ensureGrowth(s);
    g.hidane.any = 20;
    R.board.commitPending(R.board.pathTo("B1", new Set(g.nodes)).path);
    g.chapterNotice = { key: `${s.cycleId || `cycle:${s.cycle || 1}`}:1`, ring: 1 };
    s.chapter = 2; s.day = 17;
    R.expected = R.data.SKILLS.filter(k => k.ring === 2).map(k => k.name);
    R.run = () => { R.failure = null; R.promise = R.calendar.runDaily({ nightEvents: {}, untilDay: 30 }).catch(e => R.failure = e.stack); };
  });
}

const failure = async page => { const f = await page.evaluate(() => window.R?.failure); assert(!f, f); };

await suite("growth-chapter-notice", async check => {
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) await check(`ch2-first-morning-${label}`, async page => {
    await setup(page);
    await page.evaluate(() => R.run());
    const skills = page.locator(".gain-card", { hasText: "盤に新しいスキルが" });
    await skills.waitFor();
    const expected = await page.evaluate(() => R.expected);
    assert.equal(await skills.locator(".gc-main").textContent(), `盤に新しいスキルが${expected.length}つ`);
    assert.equal(await skills.locator(".gc-sub").textContent(), expected.join("・"));
    assert.equal(await skills.locator(".gc-top").textContent(), "NEW SKILL");
    await page.locator(".gain-card", { hasText: "今なら盤を組み直せる" }).waitFor();
    const map = page.locator(".map:not(.done)");
    const reminder = map.locator('[data-test="map-reminder"]');
    await reminder.waitFor();
    assert.equal(await reminder.textContent(), "心得の盤の組み直しは、最初の行動まで");
    assert.equal(await map.locator(".map-notice:not(.map-unlock-notice)").count(), 0, "上の帯は使わない");
    // 案内の枠からはみ出さない
    const fits = await reminder.evaluate(n => { const a = n.getBoundingClientRect(), b = n.closest(".map-info").getBoundingClientRect(); return a.left >= b.left - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1; });
    assert(fits, "組み直しの一言が右下の案内に収まる");
    await failure(page);
    const saved = await page.evaluate(() => R.core.state.growth.chapterNotice);
    assert.equal(saved.ring, 2, "知らせた章の範囲を残す");
  }, options);
});
