// #322: 実LIME返信の通知、今回の獲得/レベル到達、長い発話と本心の固定枠をPC/タッチ画面で確認。
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["touch", { width: 844, height: 390 }]]) {
    const page = await browser.newPage({ viewport, ...(label === "touch" ? { isMobile: true, hasTouch: true } : {}) });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(base);
    await page.waitForSelector('[data-test="title-new"]');
    await page.evaluate(async () => {
      window.QA = { core: await import("./js/core/state.js"), ui: await import("./js/core/ui.js"),
        stats: await import("./js/core/stats.js"), phone: await import("./js/daily/phone.js"), vn: await import("./js/vn/engine.js") };
      QA.core.newGame();
      const s = QA.core.state;
      // #814: LIMEを交換した2本目まで読んでいる（読まずに♥1を超えない）。
      s.phase = "daily"; s.met.naru = true; s.story.naru = 2; s.affinity.naru = 17;
      // LIME返信は0.25倍のため、端数繰り越しを足して1回の返信で+1に届くようにする（期待値18は変えない）。
      s.affinityCarry = { ...(s.affinityCarry || {}), naru: 0.9 };
      // 正式な返信処理を通すためのテスト専用の雑談。
      s.inbox = [{ id: "qa_layout", day: s.day, read: true, done: false, log: [],
        msg: { id: "qa_layout", sender: "naru", type: "chat", messages: ["今日もいい煙だったな"],
          replies: [{ text: "ありがとうございます", affinity: 2 }] } }];
      QA.phoneRun = QA.phone.openLime({ sender: "naru" });
    });
    await page.locator('[data-test="reply-0"]').click();
    const feedback = page.locator('.lime-note').filter({ hasText: '♡ ほんの少し仲良くなった' });
    await feedback.waitFor();
    assert.equal(await feedback.count(), 1, "実返信の微小上昇はLIME内に一度だけ表示する");
    assert.equal(await page.locator('.gain-card.affinity').count(), 0, "LIME返信は大きな獲得カードと重複しない");
    assert.equal(await page.evaluate(() => QA.core.state.affinity.naru), 18);
    const feedbackFits = await feedback.evaluate(node => {
      const r = node.getBoundingClientRect();
      return r.width > 0 && r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight
        && node.scrollWidth <= node.clientWidth + 1;
    });
    assert(feedbackFits, "LIME内の微小上昇通知が画面内に収まる");
    // 通常の獲得カードの重なり・非阻害性は、LIME倍率を使わない実獲得で別途検査する。
    await page.evaluate(() => QA.stats.gainAffinity("naru", 1));
    await page.waitForSelector(".gain-card.affinity.show");
    await page.waitForTimeout(500);
    assert.equal(await page.locator(".gc-sub").textContent(), "好感度が少し上がった");
    assert.equal(await page.evaluate(() => QA.core.state.affinity.naru), 19);
    const layer = await page.evaluate(() => {
      const banners = document.getElementById("banners"), modal = document.getElementById("modal"), wipe = document.getElementById("wipe");
      const r = banners.querySelector(".gain-card").getBoundingClientRect();
      return { front: +getComputedStyle(banners).zIndex > +getComputedStyle(modal).zIndex,
        coveredByWipe: +getComputedStyle(wipe).zIndex > +getComputedStyle(banners).zIndex,
        pointer: getComputedStyle(banners).pointerEvents, fits: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight };
    });
    assert.deepEqual(layer, { front: true, coveredByWipe: true, pointer: "none", fits: true });
    if (shots) await page.screenshot({ path: `${shots}/${label}-lime.png` });
    // カードが表示中でもLIMEを操作できる。
    await page.locator('[data-test="lime-back"]').click();
    await page.locator('[data-test="phone-close"]').click();
    await page.evaluate(() => QA.phoneRun);
    await page.evaluate(() => QA.ui.bannersIdle());

    for (const [from, amount] of [[20, 1], [10, 16]]) {
      await page.evaluate(({ from, amount }) => {
        QA.core.state.stats.charm = from;
        QA.stats.gainStat("charm", amount);
      }, { from, amount });
      await page.waitForSelector(".gain-card.st-charm.show");
      assert.equal(await page.locator(".gc-earned").count(), 0);
      assert.equal(await page.locator(".gc-points").count(), 0, "レベル到達時に＋数値を表示しない");
      assert.equal(await page.locator(".gc-evolution").textContent(), "3段に上がった", "能力値21・26はどちらも3段（10ごとに1段）");
      const after = await page.evaluate(() => JSON.stringify(QA.core.state));
      if (shots && amount === 1) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/${label}-level.png` }); }
      await page.evaluate(() => QA.ui.bannersIdle());
      assert.equal(await page.evaluate(() => JSON.stringify(QA.core.state)), after);
    }

    const long = "今日は仕事の連絡を切って、ゆっくり煙の香りを楽しみたい。".repeat(4);
    await page.evaluate(text => {
      QA.core.state.met.hiyori = true; QA.core.state.flags._intro_hiyori = true; QA.core.config.textSpeed = 4;
      QA.beforeDialogue = JSON.stringify(QA.core.state); QA.done = false;
      QA.vn.play({ dialogue_id: "qa_fixed_box", metadata: {}, lines: [
        { speaker: "hajime", text }, { speaker: "hiyori", text, inner: text },
        { speaker: "hajime", text: "ゆっくりしましょう" },
      ] }).then(() => { QA.done = true; });
    }, long);
    let pages = 0, innerPages = 0;
    await page.waitForTimeout(350);
    while (!await page.evaluate(() => QA.done)) {
      assert(++pages < 60, "会話が最後まで進まない");
      await page.waitForSelector(".vn-next.show");
      const geometry = await page.evaluate(() => {
        const box = document.querySelector(".vn-box"), r = box.getBoundingClientRect();
        const scale = document.getElementById("stage").getBoundingClientRect().height / 720;
        const inner = document.querySelector(".vn-inner");
        return { height: box.offsetHeight, inner: !inner.hidden,
          contained: [document.querySelector(".vn-text"), ...(!inner.hidden ? [inner] : [])].every(n => {
            const b = n.getBoundingClientRect();
            return b.top >= r.top && b.bottom <= r.bottom - 15 * scale && n.scrollWidth <= n.clientWidth + 1;
          }) };
      });
      assert.equal(geometry.height, 176); // 名前と操作を上辺へ出し、本文2行を収める共通会話枠
      assert(geometry.contained, JSON.stringify(geometry));
      if (geometry.inner) {
        innerPages++;
        if (shots && innerPages === 1) await page.screenshot({ path: `${shots}/${label}-dialogue.png` });
      }
      await page.keyboard.press("Enter");
      // 次の話者の立ち絵を待っている間、前ページの送り印が残る。入力を連打しない。
      await page.waitForTimeout(500);
    }
    assert(innerPages > 1, "長い本心の続きが表示されない");
    assert.equal(await page.evaluate(() => JSON.stringify(QA.core.state)), await page.evaluate(() => QA.beforeDialogue));
    assert.deepEqual(errors, []);
    console.log(`PASS notifications layout ${label}: real LIME reply, level reached without point numbers, ${pages} fixed-height dialogue pages, state unchanged`);
    await page.close();
  }
} finally { await browser.close(); }
