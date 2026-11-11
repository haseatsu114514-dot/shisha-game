// カードゲーム「一台勝負」（ICG）: 試遊ページ（設定→最初の火→準備→提供→審査→結果・一台と審査員の札・遊び方・やめる・横持ちタッチ）と、
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
const fire = async (page) => { const c = page.locator(t("ichi-firepower")); return { left: Number(await c.getAttribute("data-left")), total: Number(await c.getAttribute("data-total")) }; };
let placedViaSlot = false;
/** 手札の炭カードを炭焼き場に置けるだけ置く。炭カードを選ぶと炭焼き場の空き枠が「ここに置く」になるので、1回目はそこを押し、あとは詳しい札のボタンで置く */
async function placeCoals(page) {
  for (let k = 0; k < 6 && await page.locator(COAL).count(); k++) {
    await page.locator(COAL).first().click();
    if (!(await has(page, "ichi-do-place"))) { await page.locator(COAL).first().click(); break; } // 置けない（枠がいっぱい）なら選ぶのをやめる
    const slot = page.locator(t("ichi-place-slot"));
    if (!placedViaSlot) {
      assert.equal(await slot.count(), 1, "炭カードを選ぶと、炭焼き場に置き場が出る");
      const before = Number(await page.locator(t("ichi-stove")).getAttribute("data-count"));
      await slot.click(); placedViaSlot = true;
      assert.equal(Number(await page.locator(t("ichi-stove")).getAttribute("data-count")), before + 1, "置き場を押すと炭焼き場に置ける");
    } else await page.locator(t("ichi-do-place")).click();
  }
}

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
      await placeCoals(page);
      for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    }
    await page.locator(t("ichi-end")).click();
  } else if (wait === "cool" || wait === "weaken") {
    await page.locator(`${t("ichi-zone")} .ichi-coal-btn.can`).first().click();
  } else if (wait === "main") {
    await placeCoals(page);
    for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    await page.locator(t("ichi-end")).click();
  } else if (wait === "discard") {
    for (let k = 0; k < 6 && !(await has(page, "ichi-discard")); k++) await page.locator(t(`ichi-hand-${k}`)).click();
    await page.locator(t("ichi-discard")).click();
  } else if (wait === "react") {
    await page.locator(t("ichi-pass")).click();
  } else if (wait === "wear") {
    for (let k = 0; k < 4 && !(await has(page, "ichi-wear")); k++) await page.locator(`${t("ichi-wear-picker")} button.ichi-leaf.can`).first().click();
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
    // 試遊ページでも顔アイコンは WebP を読む（manifest だけ差し替えて PNG を指し、顔が出なかった不具合の再発防止）
    await page.waitForFunction(() => [...document.querySelectorAll(".ichi-leader.is-me img.ichi-face, .ichi-judges img.ichi-face")]
      .every((i) => /\.webp(\?|$)/.test(i.getAttribute("src")) && i.complete && i.naturalWidth > 0) && document.querySelectorAll(".ichi-judges img.ichi-face").length === 3, null, { timeout: 15000 });
    // 遊び方は「？」から。ゲームの上に重なり、閉じると戻る
    await page.locator(t("ichi-help")).click();
    await page.locator(t("ichi-help-sheet")).waitFor();
    await page.locator(t("ichi-help-next")).click();
    await page.locator(t("ichi-help-close")).click();
    assert.equal(await page.locator(t("ichi-help-sheet")).count(), 0);
    // 最初の火 → 準備（課題のレモン3枚から。ブルーベリーとミントを詰める）→ 提供 → 最初の審査
    const got = {}; let seenPrep = false, seenServe = false, chargedViaSlot = false, usedCard = null;
    for (let guard = 0; guard < 400; guard++) {
      await waitMine(page);
      const phase = await data(page, "phase");
      if (phase === "prep" && !seenPrep) {
        seenPrep = true;
        assert.match(await page.locator(t("ichi-bowl")).getAttribute("data-leaves"), /^lemon:3$/, "課題の葉を受け取っている");
        assert.equal(await heat(page), 3, "種火3枚で熱3");
        assert.equal(await page.locator(`${t("ichi-stove")} .ichi-row.is-stove > *`).count(), 4, "炭焼き場は、マットの枠に4つ");
        // プレイマットの上のカードゲームとして見せる: ボウル（ハガル）もHMDも札。コンロやボウルの現物の絵は置かない
        assert.equal(await page.locator(`${t("ichi-bowl")} .ichi-card.t-bowl`).count(), 1, "ボウルは札");
        assert.equal(await page.locator(`${t("ichi-bowl")} .ichi-card.t-hmd`).count(), 1, "HMDは札");
        assert.equal(await page.locator(".ichi-stove-art, .ichi-rig").count(), 0, "現物の絵は置かない");
        assert.equal(await page.locator(`${t("ichi-zone")} .ichi-on`).count(), 3, "種火3枚は火力ゾーンの札");
        assert.deepEqual(await fire(page), { left: 3, total: 3 }, "火力ゾーンの札を数えて、火力3（＝熱）");
        // 炭焼き場と火力ゾーンは、ひと続きの枠（炭焼き場 ➜ 火力ゾーン）
        assert.equal(await page.locator(`.ichi-lane ${t("ichi-stove")} ~ .ichi-flow ~ ${t("ichi-zone")}`).count(), 1, "炭焼き場から火力ゾーンへ流れる並び");
        // 相手は簡易なゲージ（火力の目盛りと炭焼き場）
        const foeFire = page.locator(t("ichi-foe-fire"));
        assert.equal(await foeFire.locator(".ichi-gauge i.is-lit").count(), Number(await foeFire.getAttribute("data-left")), "相手の火力のゲージ");
        assert.equal(await page.locator(`${t("ichi-foe")} .ichi-on`).count(), 0, "相手の火力ゾーンは札を並べず、ゲージで見せる");
        assert.ok(await page.locator(`${t("ichi-hand")} .ichi-card.s-hand`).count() >= 3, "手札はトレカの札");
        assert.equal(await page.locator(`${t("ichi-market")} .ichi-card.t-flavor`).count(), 10, "場の葉も札");
        // フレーバーミックスと葉の体力（ボウルの葉の枚数）を、ボウルの札の下に出す
        assert.equal(await page.locator(`${t("ichi-mix")} .ichi-mix-leaf`).count(), 1, "詰めた葉（課題のレモン）が並ぶ");
        assert.equal(await page.locator(t("ichi-mix")).getAttribute("data-hp"), "3", "体力＝葉の枚数");
        // カードの左上は必要火力。届かない札は暗い
        for (const card of await page.locator(`${t("ichi-hand")} .ichi-hand-card`).all()) {
          const id = await card.getAttribute("data-card"); if (["flat", "cube", "dense_flat"].includes(id)) continue;
          const need = Number(await card.locator(".ichi-gem b").innerText());
          assert.equal(await card.getAttribute("data-locked") === "1", need > 3, `${id}: 必要火力${need}と熱3で、暗くするかが決まる`);
        }
      }
      if (phase === "serve" && !seenServe) {
        seenServe = true;
        assert.ok(await heat(page) >= 3, "提供に入るとき、炭が載っている");
        assert.equal(await page.locator(t("ichi-pile")).getAttribute("data-left"), "12");
        // 提供に入ったら場は出さない。ミックスと体力は出し続ける（相手は主役と体力だけ）
        assert.equal(await page.locator(t("ichi-market")).count(), 0);
        const leaves = (await page.locator(t("ichi-bowl")).getAttribute("data-leaves")).split(",").reduce((a, x) => a + Number(x.split(":")[1]), 0);
        assert.equal(Number(await page.locator(t("ichi-mix")).getAttribute("data-hp")), leaves, "体力＝ボウルの葉の枚数");
        assert.match(await page.locator(t("ichi-mix")).innerText(), /ブルーベリー/, "フレーバーミックスに主役が出る");
        assert.equal(await page.locator(`${t("ichi-foe-mix")} .ichi-mix-leaf`).count(), 1, "相手は主役だけ");
        assert.ok(Number(await page.locator(t("ichi-foe-mix")).getAttribute("data-hp")) > 0, "相手の体力");
        await page.locator(t("ichi-bowl")).click();
        const rig = page.locator(t("ichi-info-sheet"));
        assert.match(await rig.innerText(), /あなたの一台[\s\S]*主役[\s\S]*ブルーベリー ×\d/);
        await page.locator(t("ichi-info-close")).click();
        // 審査の山をタップすると、残りの吸い方と審査員の決め手が見られる
        await page.locator(t("ichi-pile")).click();
        assert.match(await rig.innerText(), /審査カード 残り12枚[\s\S]*決め手/);
        await page.locator(t("ichi-info-close")).click();
        assert.equal(await rig.count(), 0);
      }
      // 提供の最初の自分のターン: 手札を選ぶと火力ゾーンに「裏向きで置く」が出て、押すとチャージ（熱+1・火力+1）
      if (phase === "serve" && !chargedViaSlot && await data(page, "wait") === "main" && await data(page, "turn") === "me") {
        const before = await fire(page);
        await page.locator(t("ichi-hand-0")).click();
        await page.locator(t("ichi-charge-slot")).click();
        await page.waitForFunction((n) => Number(document.querySelector('[data-test="ichi-pillar"]').dataset.heat) === n, before.total + 1);
        assert.deepEqual(await fire(page), { left: before.left + 1, total: before.total + 1 }, "裏向きで置いた札が火力ゾーンに加わる");
        await page.locator(t("ichi-hand-0")).click();
        assert.equal(await page.locator(t("ichi-charge-slot")).count(), 1, "チャージは何回でも");
        await page.locator(t("ichi-hand-0")).click();
        chargedViaSlot = true;
        // 印象の見込み（自分と相手）
        assert.match(await page.locator(t("ichi-impression")).getAttribute("data-me"), /^-?\d+$/);
        // カードは1ラウンドに1枚。一口のカードがあれば仕込み、なければ使えるカードを1枚使う
        assert.equal(await page.locator(t("ichi-card-left")).getAttribute("data-left"), "1");
        // 枠を返すカード（ひと息・追い炭・トングさばき・仕切り直し）は、使ってもまだ1枚使えるので、ここでは選ばない
        const usable = `${t("ichi-hand")} .ichi-hand-card.can` + ["flat", "cube", "dense_flat", "breath", "add_coal", "tongs", "reset"].map((id) => `:not([data-card="${id}"])`).join("");
        const puff = page.locator(`${t("ichi-hand")} .ichi-hand-card.can:is([data-card="heat_in"], [data-card="heat_out"], [data-card="blow"], [data-card="duel"], [data-card="all_in"], [data-card="show_smoke"])`);
        const pick = (await puff.count()) ? puff.first() : page.locator(usable).first();
        const id = await pick.getAttribute("data-card");
        await pick.click();
        if (await puff.count()) assert.equal(await page.locator(t("ichi-do-play")).innerText(), "この一口に仕込む");
        await page.locator(t("ichi-do-play")).click();
        await page.locator(`${t("ichi-card-left")}[data-left="0"]`).waitFor();
        assert.equal(await page.locator(usable).count(), 0, "1枚使ったら、ほかのカードは使えない");
        assert.ok(await heat(page) >= before.total + 1 || id === "reset" || id === "tongs", "払わないので熱は下がらない");
        if (["heat_in", "heat_out", "blow", "duel", "all_in", "show_smoke"].includes(id)) assert.equal(await page.locator(`${t("ichi-set-card")}[data-card="${id}"]`).count(), 1, "仕込んだ一口のカードが見える");
        usedCard = id;
      }
      if (await stepMine(page, [["blueberry", 8], ["mint", 4]], got)) break;
    }
    assert.ok(seenPrep && seenServe && chargedViaSlot && placedViaSlot && usedCard, `準備と提供を通り、置き場からチャージと炭置き、カードを1枚使った: ${JSON.stringify({ seenPrep, seenServe, chargedViaSlot, placedViaSlot, usedCard })}`);
    const result = page.locator(t("ichi-result"));
    await result.waitFor();
    for (const who of ["me", "foe"]) {
      const row = page.locator(t(`ichi-result-${who}`));
      assert.match(await row.getAttribute("data-zone"), /^(just|band|off|cold|scorch)$/);
      assert.match(await row.innerText(), /判定熱 -?\d+[\s\S]*印象 -?\d+[\s\S]*\d+点/);
    }
    assert.match(await page.locator(".ichi-result-vote").innerText(), /印象[\s\S]*(一票|票は入らない)/);
    await page.locator(t("ichi-next")).click();
    assert.equal(await page.locator(t("ichi-pile")).getAttribute("data-left"), "11", "めくった審査カードは山から減る");
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
      return { stage: r("#stage"), close: r('[data-test="ichi-close"]'), help: r('[data-test="ichi-help"]'), fast: r('[data-test="ichi-fast"]'), card: r('[data-test="ichi-hand-0"]'),
        stove: r('[data-test="ichi-stove"]'), mine: r('[data-test="ichi-score-me"]'), vw: innerWidth, vh: innerHeight };
    });
    // 40px を拡縮の倍率で割り戻して作るので、掛け戻した実寸には小数の誤差が出る（39.9987 など）
    assert.ok(boxes.close.w >= 39.99 && boxes.close.h >= 39.99 && boxes.help.w >= 39.99, `「？」「✕」の押せる範囲が40px未満: ${JSON.stringify(boxes.close)}`);
    assert.ok(boxes.fast.w >= 39.99 && boxes.fast.h >= 39.99, "早送りの押せる範囲が40px未満");
    assert.ok(boxes.card.bottom <= boxes.vh + 1 && boxes.close.right <= boxes.vw + 1, "手札と右上のボタンが画面に収まる");
    assert.ok(boxes.stove.right <= boxes.vw + 1 && boxes.stove.bottom <= boxes.vh + 1 && boxes.mine.bottom <= boxes.vh + 1, "炭焼き場と自分の顔が画面に収まる");
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
