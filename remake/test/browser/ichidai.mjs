// カードゲーム「一台勝負」（ICG）: 試遊ページ（設定→最初の火→準備→提供→審査→結果・遊び方・やめる・横持ちタッチ）と、
// 本編の入口（既定では tonari に出ない／?ichidai=1 で出る／最後まで打つと state.ichidai に残って保存される・時間は進まない）。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (name) => `[data-test="${name}"]`;
const page1 = (query) => ({ pageEntry: `${baseURL}ichidai.html?${query}`, pageReadySelector: t("ichi-menu-start") });
const data = (page, key) => page.locator(t("ichi-game")).getAttribute(`data-${key}`);
const has = async (page, name) => (await page.locator(`${t(name)}:not([disabled])`).count()) > 0;
const waitMine = (page) => page.waitForFunction(() => {
  const g = document.querySelector('[data-test="ichi-game"]');
  return g && (g.dataset.turn === "me" || g.dataset.phase === "end" || !document.querySelector(".ichi-sheet").hidden);
}, null, { timeout: 30000 });
const COAL = ["flat", "cube", "dense_flat"].map((id) => `${t("ichi-hand")} button[data-card="${id}"]`).join(", ");
const heat = async (page) => Number(await page.locator(t("ichi-pillar")).getAttribute("data-heat"));

/** 自分の番を1つ進める（人の手で）。最初の結果の札が出たら true */
async function stepMine(page, plan, got) {
  if (await page.locator(t("ichi-result")).count()) return true;
  const wait = await data(page, "wait"), turn = await data(page, "turn");
  if (turn !== "me") { await page.waitForTimeout(120); return false; }
  if (wait === "embers") {
    assert.equal(await has(page, "ichi-embers"), false, "3枚選ぶまで種火にできない");
    for (const i of [0, 1, 2]) await page.locator(t(`ichi-hand-${i}`)).click();
    await page.locator(t("ichi-embers")).click();
  } else if (wait === "prep") {
    let packed = 0;
    if (await has(page, "ichi-steam") || await page.locator(`${t("ichi-market")} .ichi-pile-main:not([disabled])`).count()) {
      for (const [id, n] of plan) {
        while ((got[id] || 0) < n) {
          const pile = page.locator(`${t(`ichi-market-${id}`)} .ichi-pile-main:not([disabled])`);
          if (!(await pile.count())) break;
          await pile.click(); got[id] = (got[id] || 0) + 1; packed++;
        }
      }
    }
    if (packed && await has(page, "ichi-pack")) await page.locator(t("ichi-pack")).click();
    else if (await has(page, "ichi-steam")) {
      await page.locator(t("ichi-steam")).click();
      for (let k = 0; k < 6 && await page.locator(COAL).count(); k++) {
        await page.locator(COAL).first().click();
        if (!(await has(page, "ichi-do-place"))) break;
        await page.locator(t("ichi-do-place")).click();
      }
      for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    }
    await page.locator(t("ichi-end")).click();
  } else if (wait === "cool" || wait === "weaken") {
    await page.locator(`${t("ichi-zone")} .ichi-coal-btn.can`).first().click();
  } else if (wait === "main") {
    for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    await page.locator(t("ichi-end")).click();
  } else if (wait === "discard") {
    for (let k = 0; k < 6 && !(await has(page, "ichi-discard")); k++) await page.locator(t(`ichi-hand-${k}`)).click();
    await page.locator(t("ichi-discard")).click();
  } else if (wait === "react") {
    await page.locator(t("ichi-pass")).click();
  } else if (wait === "wear") {
    for (let k = 0; k < 4 && !(await has(page, "ichi-wear")); k++) await page.locator(`${t("ichi-bowl")} button.ichi-leaf.can`).first().click();
    await page.locator(t("ichi-wear")).click();
  } else await page.waitForTimeout(120);
  return false;
}

await suite("ichidai", async (check) => {
  await check("cpu-autoplay-finishes-a-match", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    await page.locator(t("ichi-end-sheet")).waitFor({ timeout: 90000 });
    const sheet = page.locator(t("ichi-end-sheet"));
    assert.match(await sheet.getAttribute("data-winner"), /^(me|foe|draw)$/);
    const [mine, foe] = (await sheet.locator(".ichi-end-scores b").allInnerTexts()).map(Number);
    assert.ok(mine > 20 && foe > 20 && mine < 200 && foe < 200, `点が範囲外: ${mine} / ${foe}`);
    await page.locator(t("ichi-finish")).click();
    assert.match(await page.locator(t("ichi-menu-result")).innerText(), /前回：(勝ち|負け|引き分け)（\d+ 対 \d+）/);
    assert.equal(await page.locator(t("ichi-game")).count(), 0, "終わったら画面を片付ける");
  }, page1("kit=a&tournament=open_cloud&level=1&pilot=cpu&speed=30&seed=7"));

  await check("human-plays-setup-to-first-judge", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    // 設定の画面: 一式・大会・強さ
    await page.locator(t("ichi-kit-a")).click();
    await page.locator(t("ichi-tour-crown")).click();
    await page.locator(t("ichi-level-0")).click();
    assert.equal(await page.locator(t("ichi-tour-crown")).getAttribute("aria-pressed"), "true");
    await page.locator(t("ichi-start")).click();
    await page.locator(t("ichi-foe")).waitFor();
    // 遊び方は「？」から。ゲームの上に重なり、閉じると戻る
    await page.locator(t("ichi-help")).click();
    await page.locator(t("ichi-help-sheet")).waitFor();
    await page.locator(t("ichi-help-next")).click();
    await page.locator(t("ichi-help-close")).click();
    assert.equal(await page.locator(t("ichi-help-sheet")).count(), 0);
    // 最初の火 → 準備（課題のレモン3枚から。ブルーベリーとミントを詰める）→ 提供 → 最初の審査
    const got = {}; let seenPrep = false, seenServe = false;
    for (let guard = 0; guard < 400; guard++) {
      await waitMine(page);
      const phase = await data(page, "phase");
      if (phase === "prep" && !seenPrep) {
        seenPrep = true;
        assert.match(await page.locator(t("ichi-bowl")).innerText(), /レモン ×3/, "課題の葉を受け取っている");
        assert.equal(await heat(page), 3, "種火3枚で熱3");
      }
      if (phase === "serve" && !seenServe) {
        seenServe = true;
        assert.ok(await heat(page) >= 3, "提供に入るとき、炭が載っている");
        assert.match(await page.locator(t("ichi-pile")).innerText(), /審査カード 残り12枚/);
      }
      if (await stepMine(page, [["blueberry", 8], ["mint", 4]], got)) break;
    }
    assert.ok(seenPrep && seenServe, "準備と提供を通った");
    const result = page.locator(t("ichi-result"));
    await result.waitFor();
    for (const who of ["me", "foe"]) {
      const row = page.locator(t(`ichi-result-${who}`));
      assert.match(await row.getAttribute("data-zone"), /^(just|band|off|cold|scorch)$/);
      assert.match(await row.innerText(), /判定熱 -?\d+[\s\S]*\d+点/);
    }
    assert.match(await page.locator(".ichi-result-vote").innerText(), /一票|票は入らない/);
    await page.locator(t("ichi-next")).click();
    assert.match(await page.locator(t("ichi-pile")).innerText(), /審査カード 残り11枚/, "めくった審査カードは山から減る");
    // やめる: 確かめてから。記録は残らない
    await page.locator(t("ichi-close")).click();
    await page.locator(t("ichi-quit-sheet")).waitFor();
    await page.locator(t("ichi-quit-no")).click();
    assert.equal(await page.locator(t("ichi-game")).count(), 1);
    await page.locator(t("ichi-close")).click();
    await page.locator(t("ichi-quit-yes")).click();
    assert.match(await page.locator(t("ichi-menu-result")).innerText(), /まだ対戦していません/);
  }, page1("seed=11"));

  await check("touch-landscape-fits-and-buttons-are-tappable", async (page) => {
    await page.locator(t("ichi-menu-quick")).tap();
    await page.locator(t("ichi-kit-c")).tap();
    await page.locator(t("ichi-start")).tap();
    await waitMine(page);
    const boxes = await page.evaluate(() => {
      const r = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); return { w: b.width, h: b.height, right: b.right, bottom: b.bottom }; };
      return { stage: r("#stage"), close: r('[data-test="ichi-close"]'), help: r('[data-test="ichi-help"]'), card: r('[data-test="ichi-hand-0"]'), vw: innerWidth, vh: innerHeight };
    });
    // 40px を拡縮の倍率で割り戻して作るので、掛け戻した実寸には小数の誤差が出る（39.9987 など）
    assert.ok(boxes.close.w >= 39.99 && boxes.close.h >= 39.99 && boxes.help.w >= 39.99, `「？」「✕」の押せる範囲が40px未満: ${JSON.stringify(boxes.close)}`);
    assert.ok(boxes.card.bottom <= boxes.vh + 1 && boxes.close.right <= boxes.vw + 1, "手札と右上のボタンが画面に収まる");
    for (const i of [0, 1, 2]) await page.locator(t(`ichi-hand-${i}`)).tap();
    await page.locator(t("ichi-embers")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="ichi-game"]').dataset.phase === "prep");
  }, { ...page1("tournament=practice&seed=3"), viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("in-game-entry-is-off-by-default", async (page) => {
    const on = await page.evaluate(async () => (await import("./js/daily/ichidai-table.js")).ichidaiEnabled());
    assert.equal(on, false);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      Object.assign(core.newGame(), { phase: "daily", day: 4, slot: 0 });
      void (await import("./js/daily/tonari.js")).tonariMenu();
    });
    await page.locator(t("tonari-customer")).waitFor();
    assert.equal(await page.locator(t("tonari-ichidai")).count(), 0, "既定では tonari に出さない");
  });

  await check("in-game-entry-records-a-finished-match", async (page) => {
    const before = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      Object.assign(core.newGame(), { phase: "daily", day: 4, slot: 0 });
      core.save();
      const table = await import("./js/daily/ichidai-table.js");
      window.__menu = (await import("./js/daily/tonari.js")).tonariMenu();
      return { on: table.ichidaiEnabled(), day: core.state.day, slot: core.state.slot, money: core.state.money, stamina: core.state.stamina };
    });
    assert.equal(before.on, true, "?ichidai=1 で入る");
    const entry = page.locator(t("tonari-ichidai"));
    await entry.waitFor();
    assert.match(await entry.innerText(), /時間は進まない/);
    await entry.click();
    assert.equal(await page.evaluate(() => window.__menu), "ichidai");
    await page.evaluate(async () => { window.__visit = (await import("./js/daily/ichidai-table.js")).visitIchidaiTable(); });
    // はじめての一戦は遊び方から。閉じて、設定の画面で始める
    await page.locator(t("ichi-game")).waitFor();
    await page.locator(t("ichi-tour-practice")).click();
    await page.locator(t("ichi-start")).click();
    await page.locator(t("ichi-help-sheet")).waitFor();
    await page.locator(t("ichi-help-close")).click();
    await page.evaluate(() => window.__ichidai.autoplay(40));
    await page.locator(t("ichi-end-sheet")).waitFor({ timeout: 90000 });
    await page.locator(t("ichi-finish")).click();
    assert.equal(await page.evaluate(() => window.__visit), false, "行動は使わない");
    const after = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const saved = JSON.parse(localStorage.getItem("suien_remake_save"));
      return { rec: core.state.ichidai, saved: saved.ichidai, day: core.state.day, slot: core.state.slot, money: core.state.money, stamina: core.state.stamina };
    });
    assert.equal(after.rec.plays, 1);
    assert.equal(after.rec.wins + after.rec.losses + after.rec.draws, 1);
    assert.equal(after.rec.tours.practice.plays, 1);
    assert.ok(Number.isFinite(after.rec.tours.practice.best));
    assert.deepEqual(after.saved, after.rec, "保存にも同じ戦績が残る");
    assert.deepEqual([after.day, after.slot, after.money, after.stamina], [before.day, before.slot, before.money, before.stamina], "日付・時間・お金・体力は変わらない");
  }, { pageEntry: `${baseURL}?ichidai=1` });
});
