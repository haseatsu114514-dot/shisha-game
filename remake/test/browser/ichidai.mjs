// カードゲーム「一台勝負」（ICG）: 試遊ページ（設定→はじめの炭→準備→提供→審査→結果・一台と審査員の札・遊び方・やめる・横持ちタッチ・
// 対面の卓＝相手の席と奥行きのある卓・対称のマット・縦に積む火力ゾーンと判定のゲージ、札が飛んで置かれる動き、VS演出、相手の一言）と、
// 本編の入口（既定では tonari に出ない／?ichidai=1 で出る／最後まで打つと state.ichidai に残って保存される・時間は進まない）。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { overflowed } from "./ichidai_support.mjs";

const t = (name) => `[data-test="${name}"]`;
const page1 = (query) => ({ pageEntry: `${baseURL}ichidai.html?${query}`, pageReadySelector: t("ichi-menu-start") });
const data = (page, key) => page.locator(t("ichi-game")).getAttribute(`data-${key}`);
const has = async (page, name) => (await page.locator(`${t(name)}:not([disabled])`).count()) > 0;
const waitMine = (page) => page.waitForFunction(() => {
  const g = document.querySelector('[data-test="ichi-game"]');
  return g && (g.dataset.turn === "me" || g.dataset.phase === "end" || !document.querySelector(".ichi-sheet").hidden);
}, null, { timeout: 30000 });
const COAL = ["flat", "cube", "dense_flat"].map((id) => `${t("ichi-hand")} button[data-card="${id}"]`).join(", ");
// 第0.8版: 熱（一台の温度）と火力（炭の火の合計）は別の数。熱は、ターンの終わりに火力へ1近づく
const heat = async (page) => Number(await page.locator(t("ichi-pillar")).getAttribute("data-heat"));
const firePower = async (page) => Number(await page.locator(t("ichi-pillar")).getAttribute("data-fire"));
/** HUD の熱の札: left＝火力、total＝熱 */
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
    // はじめの炭: 手札から3枚ちょうどを裏向きで置く（熱は0から）。3枚そろうまで置けない。4枚目を選ぶと、先に選んだ札が外れる
    assert.equal(await has(page, "ichi-embers"), false, "1枚も選ばないと置けない");
    await page.locator(t("ichi-hand-0")).click();
    assert.equal(await has(page, "ichi-embers"), false, "1枚では置けない（3枚ちょうど）");
    for (const i of [1, 2]) await page.locator(t(`ichi-hand-${i}`)).click();
    assert.equal(await has(page, "ichi-embers"), true, "3枚そろうと置ける");
    await page.locator(t("ichi-hand-3")).click();
    assert.deepEqual(await page.locator(`${t("ichi-hand")} .ichi-hand-card.is-sel`).evaluateAll((list) => list.map((n) => n.dataset.test)), ["ichi-hand-1", "ichi-hand-2", "ichi-hand-3"], "4枚目を選ぶと、先に選んだ札が外れる");
    assert.match(await page.locator(t("ichi-embers")).innerText(), /炭を置く（3\/3枚）/);
    await page.locator(t("ichi-embers")).click();
  } else if (wait === "prep") {
    // 準備（第0.8版）: 同じターンに、葉を詰めて、炭にも触れる（詰めるか蒸らすかの二択は無い）
    let packed = 0;
    assert.equal(await page.locator(t("ichi-steam")).count(), 0, "「蒸らす」のボタンは無い");
    if (await page.locator(`${t("ichi-market")} .ichi-pile-main:not([disabled])`).count()) {
      for (const [id, n] of plan) {
        while ((got[id] || 0) < n && packed < 4) {
          const pile = page.locator(`${t(`ichi-market-${id}`)} .ichi-pile-main:not([disabled])`);
          if (!(await pile.count())) break;
          await pile.click(); got[id] = (got[id] || 0) + 1; packed++;
        }
      }
    }
    if (packed) {
      await page.locator(t("ichi-pack")).click();
      await page.locator(t("ichi-market")).waitFor({ state: "detached" }); // 詰めたら、盆は下がる（卓を炭のために空ける）
    } else if (await page.locator(t("ichi-market-close")).count()) {
      // もう詰めないターン: 盆をしまって、炭を触る。「葉の盆をひらく」で、また出せる
      await page.locator(t("ichi-market-close")).click();
      assert.deepEqual([await page.locator(t("ichi-market")).count(), await has(page, "ichi-market-open")], [0, true], "盆をしまうと、ひらくボタンが出る");
      got.closed = (got.closed || 0) + 1;
    }
    await placeCoals(page);
    for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    const h0 = await heat(page), f0 = await firePower(page);
    await page.locator(t("ichi-end")).click();
    // 蒸らし: ターンを終えると、熱が火力へ1近づく
    await page.waitForFunction(([h, f]) => Number(document.querySelector('[data-test="ichi-pillar"]').dataset.heat) === h + Math.sign(f - h), [h0, f0]);
    got.steamed = (got.steamed || 0) + (f0 !== h0 ? 1 : 0);
  } else if (wait === "cool" || wait === "weaken" || wait === "wear") {
    await page.waitForTimeout(150); // 炭が弱る・すきま風は、自動で進む（ガイドを切っていても）
  } else if (wait === "main") {
    await placeCoals(page);
    for (let k = 0; k < 5 && await page.locator(`${t("ichi-stove")} button.can`).count(); k++) await page.locator(`${t("ichi-stove")} button.can`).first().click();
    await page.locator(t("ichi-end")).click();
  } else if (wait === "discard") {
    for (let k = 0; k < 6 && !(await has(page, "ichi-discard")); k++) await page.locator(t(`ichi-hand-${k}`)).click();
    await page.locator(t("ichi-discard")).click();
  } else if (wait === "react") {
    await page.locator(t("ichi-pass")).click();
  } else await page.waitForTimeout(120);
  return false;
}

await suite("ichidai", async (check) => {
  await check("cpu-autoplay-finishes-a-match", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    await page.locator(t("ichi-end-sheet")).waitFor({ timeout: 90000 });
    const sheet = page.locator(t("ichi-end-sheet"));
    assert.match(await sheet.getAttribute("data-winner"), /^(me|foe|draw)$/);
    assert.equal(await page.locator(t("ichi-say")).count(), 0, "CPUに打たせる早回しでは、相手の一言を出さない");
    assert.equal(await page.locator(`${t("ichi-seat")}[data-motion], ${t("ichi-emote")}`).count(), 0, "早回しでは、相手の動きも出さない");
    const [mine, foe] = (await sheet.locator(".ichi-end-scores b").allInnerTexts()).map(Number);
    assert.ok(mine > 20 && foe > 20 && mine < 200 && foe < 200, `点が範囲外: ${mine} / ${foe}`);
    await page.locator(t("ichi-finish")).click();
    assert.match(await page.locator(t("ichi-menu-result")).innerText(), /前回：(勝ち|負け|引き分け)（\d+ 対 \d+）/);
    assert.equal(await page.locator(t("ichi-game")).count(), 0, "終わったら画面を片付ける");
  }, page1("kit=a&tournament=open_cloud&level=1&pilot=cpu&speed=30&seed=7"));

  await check("human-plays-setup-to-first-judge", async (page) => {
    await page.locator(t("ichi-menu-quick")).click();
    // 設定の画面: 一式・大会・強さ
    // 一式の棚: はじめは「基本」（入門の一局と、基本の一式2つ）。「上級」に替えると、人物やイベントの入った4つ
    assert.deepEqual([await page.locator(t("ichi-tier-basic")).getAttribute("aria-pressed"), await page.locator(t("ichi-kit-s1")).getAttribute("aria-pressed"), await page.locator(t("ichi-intro-start")).count(), await page.locator(t("ichi-kit-a")).count()], ["true", "true", 1, 0]);
    await page.locator(t("ichi-tier-advanced")).click();
    assert.deepEqual([await page.locator(t("ichi-intro-start")).count(), await page.locator(".ichi-setup .ichi-kit").count()], [0, 4]);
    await page.locator(t("ichi-kit-a")).click();
    await page.locator(t("ichi-tour-crown")).click();
    await page.locator(t("ichi-level-0")).click();
    assert.equal(await page.locator(t("ichi-tour-crown")).getAttribute("aria-pressed"), "true");
    await page.locator(t("ichi-start")).click();
    // 対戦の前に「VS」: 登場カットインの人物絵とその背景で向かい合い、あいだを電撃が走る。終わると卓に着く
    const vs = page.locator(t("ichi-vs"));
    await vs.waitFor();
    assert.equal(await vs.getAttribute("data-count"), "2");
    assert.deepEqual(await vs.locator(".ichi-vs-player > b").allInnerTexts(), ["はじめ", "スミさん"]);
    assert.deepEqual(await vs.locator(".ichi-vs-art").evaluateAll((list) => list.map((i) => i.getAttribute("src").split("/").slice(-2).join("/"))), ["graphic/hajime.webp", "graphic/sumi.webp"], "人物は登場カットインの絵");
    assert.match(await vs.locator(".ichi-vs-panel.p-1 .ichi-vs-bg").getAttribute("style"), /graphic\/bg_sumi\.webp/, "背景も登場カットインのもの");
    const bolt0 = await vs.locator(".ichi-vs-bolts polyline.is-core").first().getAttribute("points");
    assert.ok(bolt0.split(" ").length > 6, "電撃はギザギザの線");
    await page.locator(`${t("ichi-vs")}.is-clash .ichi-vs-mark`).waitFor();
    // ビリビリ: 電撃の形は短い間隔で引き直され、火花と「VS」のまわりの放電も出る。「VS」は大きい
    assert.notEqual(await vs.locator(".ichi-vs-bolts polyline.is-core").first().getAttribute("points"), bolt0, "電撃の形が引き直される");
    assert.ok(await vs.locator(".ichi-vs-bolts .is-spark").count() >= 10 && await vs.locator(".ichi-vs-bolts .is-arc").count() >= 4, "火花と放電");
    assert.ok(parseFloat(await vs.locator(".ichi-vs-mark").evaluate((n) => getComputedStyle(n).fontSize)) >= 240, "「VS」は大きい");
    assert.equal(await page.locator(t("ichi-board")).isVisible(), false, "VSのあいだは卓を出さない");
    await vs.waitFor({ state: "detached", timeout: 8000 });
    await page.locator(t("ichi-foe")).waitFor();
    // 相手の動き（2026-11-11 オーナー「シャドウバースみたいに相手キャラに動きや躍動感が欲しい」）: 席の動きと気持ちのしるしを見張る
    await page.evaluate(() => {
      window.__ichiMotion = new Set();
      const seat = document.querySelector('[data-test="ichi-seat"]');
      const note = () => { if (seat.dataset.motion) window.__ichiMotion.add(seat.dataset.motion); if (seat.classList.contains("is-blink")) window.__ichiMotion.add("blink"); for (const n of seat.querySelectorAll('[data-test="ichi-emote"]')) window.__ichiMotion.add(`emote:${n.dataset.kind}`); };
      note(); new MutationObserver(note).observe(seat, { attributes: true, attributeFilter: ["data-motion", "class"], childList: true });
    });
    assert.match(await page.locator(".ichi-seat-bust").evaluate((n) => getComputedStyle(n).animationName), /ichi-(sway|m-)/, "相手は、ふだんからゆっくり揺れている");
    // まばたきと口の動き（オーナー「いる」）: 立ち絵の目と口の上に、まぶたと開いた口の重ね絵がある
    assert.deepEqual([await page.locator(`${t("ichi-foe-bust")} .ichi-eyelid`).count(), await page.locator(t("ichi-foe-bust")).getAttribute("data-parts")], [2, "1"], "まぶたは左右に1つずつ");
    const eyes = await page.evaluate(() => { const b = document.querySelector('[data-test="ichi-foe-bust"]').getBoundingClientRect(); return [...document.querySelectorAll(".ichi-eyelid")].map((n) => { const r = n.getBoundingClientRect(); return { x: (r.left + r.right) / 2 - b.left, y: (r.top + r.bottom) / 2 - b.top, w: r.width }; }); });
    assert.ok(eyes.every((e) => e.y > 40 && e.y < 90 && e.w > 10 && e.w < 30) && eyes[0].x < 210 && eyes[1].x > 210, `まぶたは顔の目の位置にある: ${JSON.stringify(eyes)}`);
    // 卓に着くと、相手が一言しゃべる（吹き出しは相手の顔の左横。指は通す）
    const say = page.locator(t("ichi-say"));
    await say.waitFor();
    assert.equal(await say.getAttribute("data-line"), "ichidai_sumi_start");
    assert.equal(await page.locator(`${t("ichi-seat")}.is-talking`).count(), 1, "しゃべっているあいだ、口が動く");
    const talk = await page.evaluate(() => {
      const b = (sel) => document.querySelector(sel).getBoundingClientRect(), s = b('[data-test="ichi-say"]'), a = b(".ichi-say-anchor"), st = b("#stage");
      return { right: s.right, anchorLeft: a.left, midY: (s.top + s.bottom) / 2, anchorTop: a.top, anchorBottom: a.bottom, inside: s.left >= st.left && s.top >= st.top,
        text: document.querySelector('[data-test="ichi-say"]').textContent, events: getComputedStyle(document.querySelector('[data-test="ichi-say"]')).pointerEvents };
    });
    assert.ok(talk.text.length > 0 && talk.inside && talk.events === "none", `一言が画面の中に出る: ${JSON.stringify(talk)}`);
    assert.ok(talk.right <= talk.anchorLeft && talk.midY > talk.anchorTop && talk.midY < talk.anchorBottom, "吹き出しは相手の顔の左横");
    // ほかの UI（左上の相手の札とラウンド・案内・ボタン・右上の小ボタン）に重ならない（2026-11-11 オーナー「キャラのセリフは他のUIに被らないように」）
    const overlaps = await page.evaluate(() => {
      const s = document.querySelector('[data-test="ichi-say"]').getBoundingClientRect();
      const hit = (r) => r.width && r.height && s.left < r.right && r.left < s.right && s.top < r.bottom && r.top < s.bottom;
      return [".ichi-hud-left > *", ".ichi-guide", ".ichi-actions > *", '[data-test="ichi-help"]', '[data-test="ichi-close"]', '[data-test="ichi-fast"]', ".ichi-heat-read"]
        .flatMap((sel) => [...document.querySelectorAll(sel)].filter((n) => hit(n.getBoundingClientRect())).map((n) => n.className || sel));
    });
    assert.deepEqual(overlaps, [], "吹き出しはほかの UI に重ならない");
    await page.waitForFunction(() => window.__ichiMotion.has("blink"), null, { timeout: 9000 }); // 数秒おきに、まばたきする（一瞬なので、見張りの記録で確かめる）
    // 試遊ページでも顔アイコンは WebP を読む（manifest だけ差し替えて PNG を指し、顔が出なかった不具合の再発防止）
    await page.waitForFunction(() => [...document.querySelectorAll(".ichi-leader.is-me img.ichi-face, .ichi-judges img.ichi-face")]
      .every((i) => /\.webp(\?|$)/.test(i.getAttribute("src")) && i.complete && i.naturalWidth > 0) && document.querySelectorAll(".ichi-judges img.ichi-face").length === 3, null, { timeout: 15000 });
    // 遊び方は「？」から。ゲームの上に重なり、閉じると戻る
    await page.locator(t("ichi-help")).click();
    await page.locator(t("ichi-help-sheet")).waitFor();
    await page.locator(t("ichi-help-next")).click();
    await page.locator(t("ichi-help-close")).click();
    assert.equal(await page.locator(t("ichi-help-sheet")).count(), 0);
    // はじめの炭 → 準備（課題のレモン3枚から。ブルーベリーとミントを詰める）→ 提供 → 最初の審査
    const got = {}; let seenPrep = false, seenServe = false, chargedViaSlot = false, usedCard = null;
    for (let guard = 0; guard < 400; guard++) {
      await waitMine(page);
      const phase = await data(page, "phase");
      if (phase === "prep" && !seenPrep) {
        seenPrep = true;
        assert.match(await page.locator(t("ichi-bowl")).getAttribute("data-leaves"), /^lemon:3$/, "課題の葉を受け取っている");
        assert.deepEqual([await heat(page), await firePower(page)], [0, 3], "種火3枚で火力3。熱は0から");
        assert.equal(await page.locator(`${t("ichi-stove")} .ichi-row.is-stove > *`).count(), 4, "炭焼き場は、マットの枠に4つ");
        // プレイマットの上のカードゲームとして見せる: ボウル（ハガル）もHMDも札。コンロやボウルの現物の絵は置かない
        assert.equal(await page.locator(`${t("ichi-bowl")} .ichi-card.t-bowl`).count(), 1, "ボウルは札");
        assert.equal(await page.locator(`${t("ichi-bowl")} .ichi-card.t-hmd`).count(), 1, "HMDは札");
        assert.equal(await page.locator(".ichi-stove-art, .ichi-rig").count(), 0, "現物の絵は置かない");
        assert.equal(await page.locator(`${t("ichi-zone")} .ichi-on`).count(), 3, "種火3枚は火力ゾーンの札");
        assert.deepEqual(await fire(page), { left: 3, total: 0 }, "種火3つ（火1ずつ）で、火力3・熱0");
        // 熱の向かう先（蒸らし）: このターンを終えると、熱が火力へ1近づく。HUD に ▲1、火力は別に出る
        const trend = page.locator(t("ichi-trend"));
        assert.deepEqual([await trend.getAttribute("data-dir"), await trend.getAttribute("data-next"), await trend.innerText(), await page.locator(t("ichi-fire")).innerText()], ["up", "1", "▲1", "火力 3"]);
        assert.equal(await page.locator(t("ichi-coal-count")).getAttribute("data-n"), "3", "炭は3つ（4つまで）");
        assert.deepEqual(await page.locator(`${t("ichi-zone")} .ichi-coal-btn`).evaluateAll((list) => list.map((n) => n.dataset.fire)), ["1", "1", "1"], "種火は火1");
        // 火力ゾーンは卓の端に縦に積む柱で、すぐ外側に熱の目盛り（10段）が並ぶ。積んだ高さ＝火力、明るいところまで＝熱
        const column = await page.evaluate(() => {
          const box = (n) => { const b = n.getBoundingClientRect(); return { l: b.left, r: b.right, t: b.top, b: b.bottom, cx: (b.left + b.right) / 2, cy: (b.top + b.bottom) / 2 }; };
          const side = (sel) => {
            const z = document.querySelector(sel), cells = [...z.querySelectorAll(".ichi-fire-gauge i")], cards = [...z.querySelectorAll(".ichi-fire-stack .ichi-coal-btn")];
            const at = (cls) => cells.findIndex((c) => c.classList.contains(cls)) + 1;
            return { zone: box(z), cells: cells.map(box), lit: cells.filter((c) => c.classList.contains("is-lit")).length, now: at("is-now"), next: at("is-next"), fireAt: at("is-fire"),
              cards: cards.map(box), gauge: box(z.querySelector(".ichi-fire-gauge")), stack: box(z.querySelector(".ichi-fire-stack")) };
          };
          return { me: side('[data-test="ichi-zone"]'), foe: side('[data-test="ichi-foe-zone"]'), stove: box(document.querySelector('[data-test="ichi-stove"]')), foeStove: box(document.querySelector('[data-test="ichi-foe-stove"]')),
            board: box(document.querySelector('[data-test="ichi-board"]')), flow: document.querySelectorAll('[data-test="ichi-stove"] .ichi-flow, [data-test="ichi-foe-stove"] .ichi-flow').length };
        });
        assert.equal(column.me.cells.length, 10, "熱の目盛りは10段");
        assert.deepEqual([column.me.lit, column.me.now, column.me.next, column.me.fireAt], [0, 0, 1, 3], "熱0（まだ灯らない）・次は1段目へ・火力の印は、積んだ3枚ぶんの3段目");
        assert.ok(column.me.cards[0].cy > column.me.cards[1].cy && column.me.cards[1].cy > column.me.cards[2].cy, "自分の札は手前から奥へ積み上がる");
        assert.ok(Math.abs(column.me.cards[2].cy - column.me.cells[2].cy) < 12, "3枚目の札は、目盛りの3段目の横");
        assert.ok(column.me.gauge.cx < column.me.stack.cx && column.me.stack.cx < column.stove.cx, "左から 熱の目盛り・積んだ札・炭焼き場（となり合う）");
        assert.equal(column.flow, 2, "炭焼き場から火力ゾーンへの矢印（自分と相手）");
        // 相手のマットも同じ作り（卓のまんなかで点対称）: 相手の柱は右端で、奥から手前へ積む
        assert.equal(await page.locator(`${t("ichi-foe-zone")} .ichi-on`).count(), Number(await page.locator(t("ichi-foe-zone")).getAttribute("data-count")), "相手の火力ゾーンの札も積んである");
        assert.deepEqual([column.foe.cells.length, column.foe.cards.length, column.foe.fireAt], [10, 3, 3], "相手の目盛り10段・種火3枚（火力3）");
        assert.ok(column.foe.lit <= 1, "相手の熱も0から（先に1ターン終えていれば1）");
        assert.ok(column.foe.cards[0].cy < column.foe.cards[1].cy && column.foe.cards[1].cy < column.foe.cards[2].cy, "相手の札は奥から手前へ積み上がる");
        assert.ok(column.foe.gauge.cx > column.foe.stack.cx && column.foe.stack.cx > column.foeStove.cx, "相手は右から 熱の目盛り・積んだ札・炭焼き場");
        assert.ok(column.me.zone.cx < column.board.cx && column.foe.zone.cx > column.board.cx, "自分の柱は左端、相手の柱は右端");
        const order = (sel) => page.locator(`${sel} > *`).evaluateAll((list) => list.map((n) => (n.matches(".is-stove") ? "炭焼き場" : n.matches(".is-setting") ? "ボウル" : n.matches(".is-perms") ? "器具" : "山札")));
        assert.deepEqual(await order(".ichi-mine"), ["炭焼き場", "ボウル", "器具", "山札"]);
        assert.deepEqual(await order(t("ichi-foe")), ["山札", "器具", "ボウル", "炭焼き場"], "相手は同じ並びの逆順（向かい合わせ）");
        assert.equal(await page.locator(`${t("ichi-foe")} .s-mini, ${t("ichi-foe")} .s-mid`).count() > 0 && await page.locator(`${t("ichi-foe")} .ichi-zone-box`).count(), await page.locator(".ichi-mine .ichi-zone-box").count(), "枠の数も同じ");
        const foeFire = page.locator(t("ichi-foe-fire"));
        assert.match(await foeFire.getAttribute("data-heat"), /^[01]$/, "相手の熱は HUD でも読める");
        // 対面の卓: 奥行きを付けて傾けた卓の向こうに相手が座り、手札の裏を持っている
        const scene = await page.evaluate(() => {
          const q = (sel) => document.querySelector(sel), w = (sel) => q(sel).getBoundingClientRect();
          return { board: getComputedStyle(q('[data-test="ichi-board"]')).transform, far: w('[data-test="ichi-foe"]'), near: w(".ichi-mine"), seat: w('[data-test="ichi-seat"]'),
            backs: document.querySelectorAll(".ichi-seat-hand .ichi-back").length, count: q(".ichi-seat-hand").dataset.count,
            foeCard: getComputedStyle(q('[data-test="ichi-foe"] .is-deck .ichi-back')).rotate, bust: !!q('[data-test="ichi-foe-bust"] img, [data-test="ichi-seat"] .ichi-face') };
        });
        assert.match(scene.board, /^matrix3d\(/, "卓は奥行きを付けて傾けてある");
        assert.ok(scene.far.width < scene.near.width * 0.9 && scene.far.top < scene.near.top, `卓の奥（相手の札）は手前より小さく見える: ${scene.far.width} / ${scene.near.width}`);
        assert.ok(scene.seat.bottom > scene.far.top - 40 && scene.seat.top < scene.far.top, "相手は卓の向こうに座る");
        assert.ok(scene.bust, "相手の顔が出ている");
        assert.equal(scene.backs, Math.min(7, Number(scene.count)), "相手は手札の裏を持っている");
        assert.equal(scene.foeCard, "180deg", "相手の札は向こう向き");
        assert.ok(await page.locator(`${t("ichi-hand")} .ichi-card.s-hand`).count() >= 3, "手札はトレカの札");
        assert.equal(await page.locator(`${t("ichi-market")} .ichi-card.t-flavor`).count(), 10, "場の葉も札");
        // 右下は審査員の声の掲示板。まだ審査が無いあいだは、審査員3人の顔だけ（文字を減らした。決め手は審査の山を押すと見られる）
        assert.deepEqual([await page.locator(`${t("ichi-forecast")} ${t("ichi-post-intro")}`).count(), await page.locator(`${t("ichi-forecast")} ${t("ichi-post-intro")} .ichi-face`).count()], [1, 3], "審査員3人の顔");
        assert.match(await page.locator(t("ichi-forecast")).innerText(), /審査員の声[\s\S]*決め手/);
        assert.match(await page.locator(t("ichi-tips")).innerText(), /熱0▲1（火力3）。適温は熱\d+〜\d+/, "案内に、熱の向かう先と葉の適温が出る");
        assert.deepEqual(await overflowed(page), [], "準備の画面で、文字が枠からはみ出していない");
        // 葉の盆: 10種の札がすべて盆の中に収まり、右のボタン（詰める・ターンを終える）に重ならない
        const tray = await page.evaluate(() => {
          const b = (n) => n.getBoundingClientRect(), m = b(document.querySelector('[data-test="ichi-market"]'));
          const piles = [...document.querySelectorAll('[data-test="ichi-market"] .ichi-pile-card')].map(b), btns = [...document.querySelectorAll(".ichi-actions .ichi-btn")].map(b);
          return { out: piles.filter((r) => r.left < m.left - 1 || r.right > m.right + 1).length, right: Math.max(...piles.map((r) => r.right)), btnLeft: Math.min(...btns.map((r) => r.left)) };
        });
        assert.ok(tray.out === 0 && tray.right <= tray.btnLeft, `葉の札が盆からはみ出さず、ボタンに重ならない: ${JSON.stringify(tray)}`);
        // 札の名前は切れない・1文字だけ次の行に落ちない（手札・葉の盆・卓のボウルとHMD）
        const names = await page.locator(`${t("ichi-hand")} .ichi-card-name, ${t("ichi-market")} .ichi-card-name, ${t("ichi-bowl")} .ichi-card-name`).evaluateAll((list) => list.map((n) => {
          const r = document.createRange(); r.selectNodeContents(n); const rects = [...r.getClientRects()], lines = new Set(rects.map((x) => Math.round(x.top))).size;
          return { text: n.getAttribute("aria-label"), cut: n.scrollHeight > n.clientHeight + 3, orphan: lines > 1 && rects.at(-1).width < parseFloat(getComputedStyle(n).fontSize) * 1.3 };
        }));
        assert.deepEqual(names.filter((x) => x.cut || x.orphan), [], "札の名前が切れていない・1文字だけ落ちていない");
        // 「炭の使い方」から、遊び方の炭のページが開く
        await page.locator(t("ichi-coal-help")).click();
        assert.match(await page.locator(`${t("ichi-help-sheet")} h2`).innerText(), /炭の活用法/);
        assert.match(await page.locator(t("ichi-help-sheet")).innerText(), /上げる：火力を熱より上[\s\S]*保つ：火力を熱と同じ[\s\S]*下げる：火力を熱より下/);
        await page.locator(t("ichi-help-close")).click();
        // 詰めた葉は、ボウルの横に葉の札の束で置く（種類ごとに1束・帯に枚数）。体力（葉の枚数）は HUD 左
        const bundles = page.locator(`${t("ichi-bundles")} ${t("ichi-bundle")}`);
        assert.equal(await bundles.count(), 1, "課題のレモンの束が1つ");
        assert.deepEqual([await bundles.first().getAttribute("data-id"), await bundles.first().getAttribute("data-n")], ["lemon", "3"]);
        assert.equal(await bundles.first().locator(".ichi-card.t-flavor").count(), 1, "束は葉の札");
        assert.match(await bundles.first().locator(".ichi-bundle-band").innerText(), /×3/, "帯に枚数");
        assert.equal(await page.locator(t("ichi-hp")).getAttribute("data-hp"), "3", "体力＝葉の枚数");
        assert.equal(await page.locator(".ichi-mine .ichi-mix").count(), 0, "卓の上に文字の帯は出さない");
        // カードの左上は必要な熱。届かない札は暗い
        for (const card of await page.locator(`${t("ichi-hand")} .ichi-hand-card`).all()) {
          const id = await card.getAttribute("data-card"); if (["flat", "cube", "dense_flat"].includes(id)) continue;
          const need = Number(await card.locator(".ichi-gem b").innerText());
          assert.equal(await card.getAttribute("data-locked") === "1", need > 0, `${id}: 必要な熱${need}と熱0で、暗くするかが決まる`);
        }
      }
      if (phase === "serve" && !seenServe) {
        seenServe = true;
        // 第0.5版: 提供に入ると、まずこのラウンドの審査カードがめくられる（札が出ているあいだは卓を押せない）。閉じるまで待つ
        // （data-input="1"＝進行が人の入力を待っている。めくる演出のあいだは "0"）
        await page.waitForFunction(() => { const g = document.querySelector('[data-test="ichi-game"]'); return document.querySelector(".ichi-sheet").hidden && g.dataset.turn === "me" && g.dataset.input === "1"; }, null, { timeout: 20000 });
        assert.ok(await heat(page) >= 3 && await heat(page) <= 4, "準備の4ターンで、熱は3〜4まで上がっている");
        // 火力＝炭の火の合計（炭の数ではない）。炭は4つまでで、火の段数ぶんの高さで積む
        const coals = await page.locator(`${t("ichi-zone")} .ichi-coal-btn`).evaluateAll((list) => list.map((n) => ({ fire: Number(n.dataset.fire), up: n.dataset.up, h: n.offsetHeight, label: n.querySelector(".ichi-coal-fire")?.textContent })));
        assert.equal(coals.reduce((a, c) => a + c.fire, 0), await firePower(page), `火力は炭の火の合計: ${JSON.stringify(coals)}`);
        // 炭の焼け具合は、札の上の炭の絵で分かる（新品の火＝hot・弱った＝warm・火1＝ember。種火は札の裏のまま）
        const looks = await page.locator(`${t("ichi-zone")} .ichi-coal-btn`).evaluateAll((list) => list.map((n) => ({ up: n.dataset.up, state: n.dataset.state, fire: Number(n.dataset.fire), art: n.querySelector(".ichi-coal-sprite")?.getAttribute("src")?.split("/").pop() || null })));
        assert.ok(looks.every((c) => (c.up === "1" ? /^coal(_flat)?_(just|red|white)\.webp/.test(c.art) && (c.fire === 1 ? c.state === "ember" : ["hot", "warm"].includes(c.state)) : c.state === "seed" && c.art === null)), `炭の絵: ${JSON.stringify(looks)}`);
        assert.ok(got.steamed >= 3 && got.closed >= 1, `準備で熱が上がり（${got.steamed}回）、盆をしまって炭を触った（${got.closed}回）`);
        assert.ok(coals.length <= 4 && coals.length === Number(await page.locator(t("ichi-coal-count")).getAttribute("data-n")), "炭は4つまで");
        assert.ok(coals.every((c) => c.label === String(c.fire) && (c.up === "1" ? c.fire >= 1 && c.fire <= 3 : c.fire === 1)), "札の横に、いまの火が出る（種火は1）");
        const unit = Math.min(...coals.map((c) => c.h / c.fire));
        assert.ok(coals.every((c) => Math.abs(c.h - unit * c.fire) < 3), "炭は火の段数ぶんの高さ");
        // 第0.5版: 審査カードはラウンドのはじめに1枚めくってある（山は11枚）。今回の吸い方は左上に出る
        assert.equal(await page.locator(t("ichi-pile")).getAttribute("data-left"), "11");
        assert.match(await page.locator(t("ichi-now-judge")).getAttribute("aria-label"), /^今回の審査 /, "見出しは出さず、読み上げに残す");
        assert.match((await page.locator(t("ichi-now-judge")).innerText()).replace(/\s+/g, ""), /^.+[±+−]\d$/);
        // 提供に入ったら場は出さない。葉の札の束と体力は出し続ける（相手の束も卓の奥に。HUD の相手の札には主役と体力）
        assert.equal(await page.locator(t("ichi-market")).count(), 0);
        const bowl = (await page.locator(t("ichi-bowl")).getAttribute("data-leaves")).split(",").map((x) => x.split(":")), leaves = bowl.reduce((a, [, n]) => a + Number(n), 0);
        assert.equal(Number(await page.locator(t("ichi-hp")).getAttribute("data-hp")), leaves, "体力＝ボウルの葉の枚数");
        assert.equal(await page.locator(`${t("ichi-bundles")} ${t("ichi-bundle")}`).count(), bowl.length, "葉の種類ごとに束");
        assert.equal(await page.locator(`${t("ichi-bundles")} ${t("ichi-bundle")}.is-main`).getAttribute("data-id"), "blueberry", "いちばん多いブルーベリーが主役の束");
        assert.ok(await page.locator(`${t("ichi-foe-bundles")} ${t("ichi-bundle")}`).count() >= 1, "相手の葉の札の束も卓にある");
        assert.equal(await page.locator(`${t("ichi-foe-mix")} .ichi-mix-leaf`).count(), 1, "HUD の相手の札は主役だけ");
        assert.ok(Number(await page.locator(t("ichi-foe-mix")).getAttribute("data-hp")) > 0, "相手の体力");
        await page.locator(t("ichi-bowl")).click();
        const rig = page.locator(t("ichi-info-sheet"));
        assert.match(await rig.innerText(), /あなたの一台[\s\S]*主役[\s\S]*ブルーベリー ×\d/);
        await page.locator(t("ichi-info-close")).click();
        // 審査の山をタップすると、残りの吸い方と審査員の決め手が見られる
        await page.locator(t("ichi-pile")).click();
        assert.match(await rig.innerText(), /審査カード 残り11枚[\s\S]*決め手/);
        await page.locator(t("ichi-info-close")).click();
        assert.equal(await rig.count(), 0);
      }
      // 提供の最初の自分のターン: 手札を選ぶと火力ゾーンに「裏向きで置く」が出て、押すとチャージ（火力+1）
      if (phase === "serve" && !chargedViaSlot && await data(page, "wait") === "main" && await data(page, "turn") === "me") {
        const before = await fire(page);
        // 卓の上を飛ぶ札（.ichi-fly）が出たかを数える（すぐ消えるので、足された瞬間を見張る）
        await page.evaluate(() => {
          window.__ichiFly = 0;
          new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n.classList?.contains("ichi-fly")) window.__ichiFly++; })
            .observe(document.querySelector('[data-test="ichi-game"]'), { childList: true });
        });
        // 炭の手引き: 熱の向かう先（と火力）・炭の手・次のターン、が案内に出る
        const tips = await page.locator(`${t("ichi-tips")} small`).allInnerTexts();
        assert.ok(tips.length >= 2 && /熱\d+(のまま|[▲▼]\d+)（火力\d+）/.test(tips[0]) && tips.some((x) => /次のターンは炭が弱って火力−\d/.test(x)), `炭の手引き: ${JSON.stringify(tips)}`);
        assert.deepEqual(await overflowed(page), [], "提供の画面で、文字が枠からはみ出していない");
        // チャージ＆ドロー: 手札を1枚置いて1枚引く（手札の枚数は変わらない）。炭を足す手は1ターンに1つ（第0.7版）
        const left = page.locator(t("ichi-coal-left"));
        assert.deepEqual([await left.getAttribute("data-add"), await left.getAttribute("data-ash"), await left.locator("i").allInnerTexts()], ["1", "1", ["足す", "外す"]], "このターン、炭を1つ足せて、1つ外せる");
        const handCount = () => page.locator(`${t("ichi-hand")} .ichi-hand-card`).count(), hand0 = await handCount();
        await page.locator(t("ichi-hand-0")).click();
        assert.match(await page.locator(t("ichi-charge-slot")).innerText(), /置いて1枚引く/);
        assert.match(await page.locator(t("ichi-do-charge")).innerText(), /チャージ＆ドロー/);
        await page.locator(t("ichi-charge-slot")).click();
        await page.waitForFunction((n) => Number(document.querySelector('[data-test="ichi-pillar"]').dataset.fire) === n, before.left + 1);
        assert.deepEqual(await fire(page), { left: before.left + 1, total: before.total }, "裏向きで置いた札が火力ゾーンに加わる（火力+1。熱は、ターンの終わりまで動かない）");
        await page.waitForFunction((n) => document.querySelectorAll('[data-test="ichi-hand"] .ichi-hand-card').length === n, hand0);
        assert.equal(await handCount(), hand0, "1枚置いて1枚引くので、手札の枚数は変わらない");
        await page.locator(t("ichi-hand-0")).click();
        assert.equal(await page.locator(t("ichi-charge-slot")).count(), 0, "炭を足すのは1ターンに1つ（2枚目の置き場は出ない）");
        assert.equal(await page.locator(t("ichi-do-charge")).isDisabled(), true);
        assert.match(await page.locator(t("ichi-do-charge")).getAttribute("title"), /炭を足すのは1ターンに1つ/);
        assert.deepEqual([await left.getAttribute("data-add"), await left.locator("i").first().innerText()], ["0", "足す済"], "足したので、灯が消える");
        await page.locator(t("ichi-hand-0")).click();
        chargedViaSlot = true;
        // 印象の見込み（自分と相手）
        assert.match(await page.locator(t("ichi-impression")).getAttribute("data-me"), /^-?\d+$/);
        // 点差と一票の点（第0.6版の先行分・ICG59/62）: 左上に点差。負けている人の顔の横に「一票+3」。一票の見込みには取れたら何点か
        {
          const [mine, foe] = await Promise.all(["me", "foe"].map(async (w) => Number(await page.locator(t(`ichi-score-${w}`)).getAttribute("data-score"))));
          const st = page.locator(t("ichi-standing")), gap = mine - foe;
          assert.equal(Number(await st.getAttribute("data-gap")), gap);
          assert.match(await st.innerText(), gap > 0 ? new RegExp(`あなたが${gap}点リード`) : gap < 0 ? new RegExp(`${-gap}点リード`) : /^同点$/);
          assert.deepEqual([await page.locator(t("ichi-chase-0")).count(), await page.locator(t("ichi-chase-1")).count()], [gap < 0 ? 1 : 0, gap > 0 ? 1 : 0], "負けている人にだけ「一票+3」");
          const imp = page.locator(t("ichi-impression")), [a, b] = [Number(await imp.getAttribute("data-me")), Number(await imp.getAttribute("data-foe"))];
          assert.equal(await imp.getAttribute("data-vote"), a > b ? (gap < 0 ? "3" : "2") : a < b ? (gap > 0 ? "3" : "2") : "", "一票の見込みに、取れたら何点か");
        }
        // カードは自分のターンに1枚。一口のカードがあれば仕込み、なければ使えるカードを1枚使う
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
        assert.ok(await heat(page) === before.total || ["reset", "tongs", "all_in"].includes(id), "払わないので熱は動かない");
        if (["heat_in", "heat_out", "blow", "duel", "all_in", "show_smoke"].includes(id)) assert.equal(await page.locator(`${t("ichi-puff-me")} ${t("ichi-set-card")}[data-card="${id}"]`).count(), 1, "仕込んだ一口のカードが、卓の「自分の一口」に置かれる");
        assert.ok(await page.evaluate(() => window.__ichiFly) >= 2, "チャージした札と使った札が、手札から卓へ飛ぶ");
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
    assert.match(await page.locator(".ichi-result-vote").innerText(), /印象[\s\S]*(一票（\+\d+(・追い上げ)?）|票は入らない)/);
    // 葉は一口ごとに1枚減る（一式aの雲窯ファンネルは、各セッション最初の一口では減らない。相手の一式bは減る）
    assert.deepEqual([await page.locator(`${t("ichi-result-me")} ${t("ichi-result-wear")}`).count(), await page.locator(`${t("ichi-result-foe")} ${t("ichi-result-wear")}`).getAttribute("data-n")], [0, "1"], "一口で減った葉が、審査の札に出る");
    assert.deepEqual(await overflowed(page), [], "審査の結果で、文字が枠からはみ出していない");
    const myZone = await page.locator(t("ichi-result-me")).getAttribute("data-zone");
    await page.locator(t("ichi-next")).click();
    // 審査員の声（掲示板）に、いまの一口が書き込まれる: 何口目・吸い方・帯・次にどうするかの一言・点・一票
    const post = page.locator(`${t("ichi-forecast")} ${t("ichi-post")}`);
    await post.first().waitFor();
    assert.deepEqual([await post.count(), await post.first().getAttribute("data-round"), await post.first().getAttribute("data-zone")], [1, "1", myZone]);
    // 文字を減らした書き込み: 何口目・吸い方／自分の帯と点（直すところがあれば一言）／相手の帯と点（一票が入れば、だれに）
    assert.match(await post.first().innerText(), /1口目[\s\S]*吸う[\s\S]*(ジャスト|適温|ズレ|外れ|焦げ)[\s\S]*\+\d+[\s\S]*スミさん (ジャスト|適温|ズレ|外れ|焦げ) \+\d+/);
    assert.ok((await page.locator(t("ichi-forecast")).innerText()).replace(/\s+/g, "").length < 90, "審査員の声は短い");
    assert.equal(await page.locator(`${t("ichi-forecast")} ${t("ichi-post-intro")}`).count(), 0, "書き込みが入ったら、紹介は外す");
    // 相手は、手を動かすとき（炭を置く・のせる・チャージ・カードを使う・番のはじめ）と、審査の結果に反応して動く
    await page.waitForFunction(() => ["joy", "shock", "down", "nod"].some((k) => window.__ichiMotion.has(k)), null, { timeout: 5000 });
    const motions = await page.evaluate(() => [...window.__ichiMotion]);
    assert.ok(motions.some((k) => ["reach", "play", "lean"].includes(k)), `相手が手を動かすと、席が動く: ${motions.join(",")}`);
    // 第0.5版: 次のラウンドのはじめに、次の審査カードがめくられる（山はもう1枚減って10枚）。めくる札が閉じるまで待つ
    await page.locator(t("ichi-reveal")).waitFor({ timeout: 8000 });
    assert.match(await page.locator(t("ichi-reveal")).innerText(), /このラウンドの審査/);
    await page.locator(t("ichi-reveal")).waitFor({ state: "detached", timeout: 8000 });
    assert.equal(await page.locator(t("ichi-pile")).getAttribute("data-left"), "10", "めくった審査カードは山から減る");
    // やめる: 確かめてから。記録は残らない
    await page.locator(t("ichi-close")).click();
    await page.locator(t("ichi-quit-sheet")).waitFor();
    await page.locator(t("ichi-quit-no")).click();
    assert.equal(await page.locator(t("ichi-game")).count(), 1);
    await page.locator(t("ichi-close")).click();
    await page.locator(t("ichi-quit-yes")).click();
    assert.match(await page.locator(t("ichi-menu-result")).innerText(), /まだ対戦していません/);
  }, page1("seed=11&foe=b&assist=0")); // 相手の一式は b に決め打ち（炭4つまでの一式で、相手の火力ゾーンの並びを確かめるため）。ガイドは切る（炭の手引きが出る）

  await check("touch-landscape-fits-and-buttons-are-tappable", async (page) => {
    await page.locator(t("ichi-menu-quick")).tap();
    await page.locator(t("ichi-tier-advanced")).tap();
    await page.locator(t("ichi-kit-c")).tap();
    await page.locator(t("ichi-start")).tap();
    // VS演出はタップで飛ばせる
    await page.locator(t("ichi-vs")).waitFor();
    await page.locator(t("ichi-vs")).tap();
    assert.equal(await page.locator(t("ichi-vs")).count(), 0, "タップで VS を飛ばす");
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

  // VS演出の並べ方: 2人＝左右、3人＝横に3つ、4人＝四隅。あいだを電撃が走る（4人の対戦そのものはまだ無いので、見本で確かめる）
  await check("versus-intro-lays-out-two-to-four", async (page) => {
    for (const [n, boltCount] of [[2, 1], [3, 2], [4, 2]]) {
      await page.goto(`${baseURL}ichidai.html?versus=${n}&speed=0.5`);
      await page.locator(t("ichi-menu-versus")).click();
      const vs = page.locator(t("ichi-vs"));
      await vs.waitFor();
      assert.equal(await vs.getAttribute("data-count"), String(n));
      assert.equal(await vs.locator(".ichi-vs-player").count(), n, `${n}人ぶんの名前の札`);
      assert.equal(await vs.locator(".ichi-vs-art").count(), n, `${n}人とも登場カットインの人物絵`);
      assert.equal(await vs.locator(".ichi-vs-bg").count(), n, `${n}人ぶんの背景`);
      assert.equal(await vs.locator(".ichi-vs-bolts polyline.is-core.is-main").count(), boltCount, `${n}人のときの電撃の本数`);
      await page.waitForFunction(() => [...document.querySelectorAll(".ichi-vs-art")].every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 4000 });
      await page.locator(`${t("ichi-vs")}.is-clash`).waitFor();
      // 名前の札どうしは重ならず、画面に収まる。人物の頭は、その人の面の中にある
      const stage = await page.locator("#stage").evaluate((s) => { const b = s.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; });
      const names = await vs.locator(".ichi-vs-player > b").evaluateAll((list) => list.map((r) => { const b = r.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom]; }));
      for (const [i, a] of names.entries()) {
        assert.ok(a[0] >= stage[0] && a[1] >= stage[1] && a[2] <= stage[2] && a[3] <= stage[3], `名前の札${i}が画面の中`);
        for (const b of names.slice(i + 1)) assert.ok(a[2] <= b[0] || b[2] <= a[0] || a[3] <= b[1] || b[3] <= a[1], "名前の札が重ならない");
      }
      if (n === 4) {
        const corner = (b) => [(b[0] + b[2]) / 2 < (stage[0] + stage[2]) / 2 ? "左" : "右", (b[1] + b[3]) / 2 < (stage[1] + stage[3]) / 2 ? "上" : "下"].join("");
        assert.deepEqual(names.map(corner), ["左上", "右上", "左下", "右下"], "4人は四隅");
      }
      // 電撃の形は引き直される（ビリビリ）
      const first = await vs.locator(".ichi-vs-bolts polyline.is-core").first().getAttribute("points");
      await page.waitForFunction((was) => document.querySelector('[data-test="ichi-vs"] .ichi-vs-bolts polyline.is-core')?.getAttribute("points") !== was, first, { timeout: 3000 });
      await vs.waitFor({ state: "detached", timeout: 12000 });
    }
    // 登場カットインの絵が無いキャラは、顔アイコン（無ければ名前の頭文字）と色の面で出す
    await page.goto(`${baseURL}ichidai.html?versus=hajime,tetsuko&speed=0.5`);
    await page.locator(t("ichi-menu-versus")).click();
    const vs = page.locator(t("ichi-vs"));
    await vs.waitFor();
    assert.deepEqual([await vs.locator(".ichi-vs-art").count(), await vs.locator(".ichi-vs-player.no-art .ichi-vs-ring").count()], [1, 1]);
    await vs.click();
    assert.equal(await vs.count(), 0);
  }, page1("versus=2"));

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

  // 本編（index.html）の一台勝負でも、札は A 案の組み（ichidai-skin-signs.css）で出る。拡大札の人物は顔が欄に収まり、文は切れない。
  // 準備の場の葉の名前は2行まで・長音や小さい字で行を始めない・右上の残り枚数の丸に隠れない（2026-11-13 #3257 第2段階の確かめ直し）
  await check("in-game-cards-use-the-adopted-design", async (page) => {
    await page.evaluate(async () => {
      const { runIchidai } = await import("./js/minigames/ichidai.js");
      window.__run = runIchidai({ host: document.getElementById("stage"), config: { kit: "a", tournament: "practice", level: 1 }, seed: 7, opponent: { id: "sumi", name: "スミさん" } });
    });
    await page.locator(`${t("ichi-hand")} .ichi-card .ichi-gem`).first().waitFor({ timeout: 15000 });
    const signs = await page.evaluate(async () => {
      // CSS バンドル化（#3631）以降は個別ファイルでなく、それを含むバンドルが読まれる。bundles.json で所在を引く。
      const bundles = await (await fetch("css/bundles.json")).json();
      const seg = (bundles.segments || []).find((g) => (g.files || []).includes("ichidai-skin-signs.css"));
      const hrefs = [...document.styleSheets].map((s) => s.href || "");
      return {
        sheet: hrefs.some((h) => /\/css\/ichidai-skin-signs\.css(\?|$)/.test(h)) || (!!seg && hrefs.some((h) => h.endsWith("/css/" + seg.out))),
        mark: getComputedStyle(document.querySelector('[data-test="ichi-hand"] .ichi-card .ichi-gem'), "::before").maskImage,
      };
    });
    assert.ok(signs.sheet, "本編も ichidai-skin-signs.css を読む");
    assert.match(signs.mark, /img\/ui\/ichidai\/signs\/\w+\.svg/, "左上の印に、しるしが重なる");
    // 拡大札（相手が使った札の見せ方と同じ組み）: 人物の顔は欄の中に全部入る。どの札も文が切れない
    const big = await page.evaluate(async () => {
      const { tcg } = await import("./js/minigames/ichidai.js");
      const D = await import("./js/minigames/ichidai-data.js");
      const root = document.querySelector('[data-test="ichi-game"]'), shelf = document.createElement("div");
      shelf.className = "ichi-played"; root.append(shelf);
      const sumi = tcg("card", "sumi", { size: "big" }); shelf.append(sumi);
      const img = sumi.querySelector(".ichi-card-art img");
      if (!img.complete) await new Promise((r) => { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); });
      const a = sumi.querySelector(".ichi-card-art").getBoundingClientRect(), b = img.getBoundingClientRect();
      const face = { fit: getComputedStyle(img).objectFit, loaded: img.naturalWidth > 0, inside: b.top >= a.top - 1 && b.bottom <= a.bottom + 1 && b.left >= a.left - 1 && b.right <= a.right + 1 };
      const cut = [];
      for (const [kind, list] of [["card", D.CARDS], ["flavor", D.FLAVORS], ["bowl", D.BOWLS], ["hmd", D.HMDS]]) for (const { id } of list) {
        const c = tcg(kind, id, { size: "big" }); shelf.replaceChildren(c);
        const text = c.querySelector(".ichi-card-text"), foot = c.querySelector(".ichi-card-foot").getBoundingClientRect(), card = c.getBoundingClientRect();
        if (text.scrollHeight > text.clientHeight + 3 || foot.bottom > card.bottom) cut.push(`${kind}:${id}`);
      }
      shelf.remove();
      return { face, cut };
    });
    assert.deepEqual(big.face, { fit: "contain", loaded: true, inside: true }, "拡大札の人物の顔は、絵の欄からはみ出さない（帽子と目元だけにならない）");
    assert.deepEqual(big.cut, [], "拡大札の文が切れない");
    // 準備の場（CPU に最初の火を任せてから、人の手に戻す）
    await page.evaluate(() => window.__ichidai.autoplay(30));
    await page.waitForFunction(() => document.querySelector('[data-test="ichi-game"]')?.dataset.phase === "prep", null, { timeout: 60000 });
    await page.evaluate(() => window.__ichidai.manual());
    await page.locator(`${t("ichi-market")} .ichi-pile-card`).first().waitFor({ timeout: 30000 });
    // 盆は奥へ傾けて出す（遠近）。字と丸の重なりは、傾きと出てくる動きを外した盆の面で測る
    const names = await page.evaluate(() => [...document.querySelectorAll('[data-test="ichi-market"] .ichi-pile-card')].map((pile, i, all) => {
      if (i === 0) Object.assign(all[0].closest('[data-test="ichi-market"]').style, { transform: "none", animation: "none" });
      const n = pile.querySelector(".ichi-card-name"), lines = [];
      let line = "", top = null, firstRight = 0;
      for (const node of n.childNodes) for (let i = 0; node.nodeType === 3 && i < node.length; i++) {
        if (node.data[i] === "​") continue;
        const r = document.createRange(); r.setStart(node, i); r.setEnd(node, i + 1);
        const box = r.getClientRects()[0]; if (!box) continue;
        if (top !== null && box.top > top + 3) { lines.push(line); line = ""; }
        if (!line) top = box.top;
        line += node.data[i];
        if (lines.length === 0) firstRight = Math.max(firstRight, box.right);
      }
      lines.push(line);
      return { name: n.getAttribute("aria-label"), lines, firstRight, badge: pile.querySelector(".ichi-count").getBoundingClientRect().left };
    }));
    assert.ok(names.length >= 10, `準備の場に葉が並ぶ: ${names.length}`);
    const bad = names.filter((x) => x.lines.length > 2 || x.lines.slice(1).some((l) => /^[ーッャュョァィゥェォ]/.test(l)) || x.firstRight > x.badge + 2)
      .map((x) => `${x.lines.join("／")}${x.firstRight > x.badge + 2 ? `（丸の下 ${Math.round(x.firstRight - x.badge)}px）` : ""}`);
    assert.deepEqual(bad, [], "準備の場の葉の名前");
  });
});
