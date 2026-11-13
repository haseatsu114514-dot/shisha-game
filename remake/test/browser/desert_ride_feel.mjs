// DESERT RIDE の手応え（2026-11-13 の手応えレビューの反映・DSR49〜）: 止め（ヒットストップ）・立て直しの合図・押した瞬間の傾き・潰し伸ばし・
// ゴールの余韻・短い再スタート・次の目標・動き軽減。長さは __desertRide.feel（実行中に書き換えられる）で延ばして、コマの速さに左右されずに確かめる。
// 本編の接続と画面の基本は desert_ride.mjs。CI で1本の制限時間（5分）に収まるよう、手応えの検査は別のスイート（desert-ride-feel）にした。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const ride = (page, code) => page.evaluate(code);
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === value, value, { timeout: 90000 });
const autoplayToResult = async (page, skill = "expert") => {
  await phase(page, "run"); // 初回/相手変更の画像準備が終わってから自動操縦を設定する。
  await page.evaluate(skill => { window.__desertRide.autoplay(skill); window.__desertRide.setSpeedUp(8); }, skill);
  await phase(page, "result");
};

await suite("desert-ride-feel", async check => {
  // 2026-11-13 手応えレビューの反映: 止め（ヒットストップ）・立て直しの合図・押した瞬間の傾き・潰し伸ばし・ゴールの余韻・短い再スタート・次の目標。
  // 長さは __desertRide.feel（実行中に書き換えられる）で延ばして、コマの速さに左右されずに確かめる。
  await check("feel-hit-stop-recover-cue-lean-squash-goal-afterglow-short-retry-and-next-goal", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    assert.equal(await ride(page, () => window.__desertRide.fx.countdownTotal), 2.4, "the first race with Noor has the full 3-2-1-GO");
    // 押した最初のコマで姿勢が傾く（横の速さが付くのを待たない）。離せば戻る
    const lean = await ride(page, () => {
      const d = window.__desertRide; d.skipCountdown(); d.pause(true); d.advance(0.2);
      const pose = (left, right) => { d.setInput(left, right); d.redraw(); return [d.fx.pose, Math.abs(d.game.vx) < 0.05]; };
      return { idle: pose(false, false), right: pose(false, true), left: pose(true, false), back: pose(false, false) };
    });
    assert.deepEqual(lean, { idle: ["rider", true], right: ["riderRight", true], left: ["riderLeft", true], back: ["rider", true] }, "the pose leans on the first frame of a press");
    // 岩に当たった瞬間: 規則の時計が止まる（揺れ・閃光は動く）。立て直せる間は BOOST が緑に光り、押せば止めの中からでも立て直せる
    const beforeHit = await ride(page, () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopFall = 30; // 止めを長くして、止めの間の様子を見る（実行中に変えられる）
      const rock = g.course.features.find(f => f.kind === "rock" && !g.passed.has(f));
      while (g.z < rock.z - 3) d.advance(1 / 60);
      g.x = rock.x; g.vx = 0; g.gauge = 0.6;
      d.pause(false);
      return { glow: getComputedStyle(document.querySelector('[data-test="desert-boost"]')).filter };
    });
    await page.waitForFunction(() => window.__desertRide.game.falls === 1 && window.__desertRide.fx.hitStop > 0);
    const stopped = await ride(page, () => ({ t: window.__desertRide.game.t, z: window.__desertRide.game.z, fx: window.__desertRide.fx }));
    assert(stopped.fx.shake.ax > 0 && stopped.fx.shake.ay > 0 && stopped.fx.shake.life >= 0.3, "a fall shakes both ways, long");
    await page.waitForFunction(() => window.__desertRide.fx.shake.t === 0, null, { timeout: 5000 }); // 揺れは止めの間も実時間で収まる
    const later = await ride(page, () => ({ t: window.__desertRide.game.t, z: window.__desertRide.game.z, hitStop: window.__desertRide.fx.hitStop, recover: document.querySelector('[data-test="desert-ride"]').dataset.recover,
      glow: getComputedStyle(document.querySelector('[data-test="desert-boost"]')).filter }));
    assert.equal(later.t, stopped.t, "the rules clock is frozen during the hit stop"); assert.equal(later.z, stopped.z);
    assert(later.hitStop > 20, "the stop itself runs on real time");
    assert.equal(later.recover, "ready");
    assert.notEqual(later.glow, beforeHit.glow, "the BOOST button itself lights up while a recovery is possible");
    assert.match(later.glow, /drop-shadow/);
    await page.keyboard.press("ArrowDown");
    const recovered = await ride(page, () => ({ falls: window.__desertRide.game.falls, recoveries: window.__desertRide.game.stats.recoveries, hitStop: window.__desertRide.fx.hitStop, feel: window.__desertRide.feel.stopRecover }));
    assert.equal(recovered.falls, 0); assert.equal(recovered.recoveries, 1);
    assert(recovered.hitStop <= recovered.feel + 1e-9, "recovering drops the rest of the fall's stop");
    await page.waitForFunction(t0 => window.__desertRide.game.t > t0 + 0.2, stopped.t); // また走り出す
    // ブーストで岩を砕く: 止めの間だけ岩が白く残り、砕くたびにブーストの残りが減る
    const smash = await ride(page, async () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopFall = 0.12; d.feel.stopSmash = 30;
      d.pause(true);
      const rock = g.course.features.find(f => f.kind === "rock" && !g.passed.has(f) && f.z > g.z + 20);
      while (g.z < rock.z - 3) d.advance(1 / 60, {});
      g.x = rock.x; g.vx = 0; g.boostT = 2; g.fallT = 0;
      d.pause(false);
      await new Promise(resolve => { const timer = setInterval(() => { if (g.stats.smashed > 0 && d.fx.hitStop > 0) { clearInterval(timer); resolve(); } }, 4); });
      const during = { flash: d.fx.smashFlash, boostT: g.boostT };
      d.endHitStop(); d.feel.stopSmash = 0.05;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { during, after: d.fx.smashFlash };
    });
    assert.equal(smash.during.flash, 1, "the smashed rock stays, white, for the stop"); assert.equal(smash.after, 0, "and bursts into chips when the stop ends");
    assert(smash.during.boostT < 2 - 0.3 && smash.during.boostT > 1.5, `smashing costs boost time (${smash.during.boostT})`);
    // 大ジャンプ: 跳んだ瞬間は縦に伸び、頂点は滞空の後ろ寄り（落ちる方が速い）、完璧な着地は横に潰れて金の輪
    const jump = await ride(page, async () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopPerfect = 30;
      const stretchLife = d.feel.stretchJump; d.feel.stretchJump = [stretchLife[0], stretchLife[1], 0.5]; // 伸びを長くして、コマの速さに左右されずに見る
      g.boostT = 0; g.speed = 30; d.autoplay("perfect");
      const perfectBefore = g.stats.perfect; let stretch = null, half = null, late = null;
      await new Promise(resolve => { const timer = setInterval(() => {
        if (g.air > 0 && g.airKind === "big") {
          const progress = 1 - g.air / g.airTotal, fx = d.fx;
          if (!stretch && g.airTotal - g.air < 0.25) stretch = fx.squash;
          if (Math.abs(progress - 0.5) < 0.03) half = fx.shownHeight / g.airPeak;
          if (Math.abs(progress - d.feel.jumpApex) < 0.03) late = fx.shownHeight / g.airPeak;
        }
        if (g.stats.perfect > perfectBefore && d.fx.hitStop > 0) { clearInterval(timer); resolve(); }
      }, 2); });
      const landed = { squash: d.fx.squash, rings: d.fx.rings, lastLand: d.fx.lastLand, apex: d.feel.jumpApex };
      d.endHitStop(); d.feel.stopPerfect = 0.06; d.feel.stretchJump = stretchLife;
      return { stretch, half, late, landed };
    });
    assert(jump.stretch && jump.stretch[0] < 1 && jump.stretch[1] > 1, `take-off stretches tall (${jump.stretch})`);
    assert(jump.landed.apex > 0.5 && jump.half < jump.late && jump.late > 0.99, `the apex comes late, so the fall is faster than the rise (${jump.half} at half, ${jump.late} at the apex)`);
    assert(jump.landed.squash[0] > 1.1 && jump.landed.squash[1] < 0.9, `a perfect landing squashes wide (${jump.landed.squash})`);
    assert.equal(jump.landed.lastLand, "perfect"); assert(jump.landed.rings.includes("perfect"), "the landing ring carries the grade (gold for perfect)");
    // ゴール: 結果はその場で確定するが、カードはすぐ重ねない。幕の先へ滑り抜ける余韻（GOAL!・紙吹雪）を、ジャンプで飛ばせる
    await ride(page, () => { const d = window.__desertRide; d.feel.goalAfter = 600; d.autoplay("expert"); d.setSpeedUp(8); });
    await page.waitForFunction(() => window.__desertRide.fx.goal !== null, null, { timeout: 90000 });
    await ride(page, () => window.__desertRide.setSpeedUp(1));
    const goal = await ride(page, () => { const d = window.__desertRide; return { results: d.results.length, phase: document.querySelector('[data-test="desert-ride"]').dataset.phase, card: document.querySelectorAll('[data-test="desert-result"]').length,
      pop: document.querySelector(".dr-start-pop").textContent, confetti: d.fx.confetti, won: d.game.race.won, clock: document.querySelector(".dr-time").textContent, finish: d.game.finishTime }; });
    assert.deepEqual({ results: goal.results, phase: goal.phase, card: goal.card, pop: goal.pop }, { results: 1, phase: "run", card: 0, pop: "GOAL!" }, "the result is recorded at the line, the card waits");
    assert(goal.confetti > 0, "confetti from the goal poles");
    await page.waitForFunction(() => window.__desertRide.fx.goal > 0.4 && window.__desertRide.game.z > window.__desertRide.game.course.length + 4);
    assert.equal(await page.locator(".dr-time").innerText(), goal.finish.toFixed(1), "the clock shows the finish time while the rider glides on");
    // ゴールした後の差は、距離ではなく結果と同じ秒差で出す（2026-11-13 オーナー「ライバルとの時差も距離に対してリアリティがない」）
    const gapLabel = await page.locator(t("desert-race-gap")).innerText(), result = await ride(page, () => window.__desertRide.game.race);
    assert.equal(gapLabel, result.won ? `ヌールに ${result.gap.toFixed(1)}秒差` : `ヌールの勝ち ＋${result.gap.toFixed(1)}秒`, "the HUD shows the same gap as the result");
    await page.keyboard.press("Space"); // 余韻は飛ばせる
    await phase(page, "result");
    assert.equal(await ride(page, () => window.__desertRide.results.length), 1, "skipping does not record twice");
    assert.equal(await page.locator(t("desert-race-points")).count(), goal.won ? 1 : 0);
    // もう一度: 同じ相手との2本目は、合図が短い（3・2・1・GO を 1.2 秒で）
    await ride(page, () => { window.__desertRide.feel.goalAfter = 1; });
    await page.locator(t("desert-retry")).click();
    await phase(page, "run");
    const retry = await ride(page, () => ({ total: window.__desertRide.fx.countdownTotal, countdown: window.__desertRide.countdown }));
    assert.equal(retry.total, 1.2); assert(retry.countdown > 0 && retry.countdown <= 1.2);
    await page.waitForFunction(() => window.__desertRide.countdown === 0, null, { timeout: 5000 });
    // 着地が遅い滑り（B）: 次の評価までの点と、今回いちばん伸びる所（回転）のひとことが出る
    await autoplayToResult(page, "good");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "B");
    const total = Number((await page.locator(t("desert-total")).locator("strong").innerText()).replace(/[^\d]/g, ""));
    assert.equal(await page.locator(t("desert-next-rank")).innerText(), `次の評価 A まで あと ${(7000 - total).toLocaleString("ja-JP")}点`); // A の境目（2026-11-13 に 2,000m へ延ばして 6,000 → 7,000）
    assert.match(await page.locator(t("desert-tip")).innerText(), /空中で ← か → を押し続けると回転/);
    assert.equal(await ride(page, () => window.__desertRide.results.length), 2);
    // 結果のカードは舞台の中に収まる（行が増えても、上が切れない）
    const card = await page.locator(t("desert-result")).evaluate(node => ({ scroll: node.scrollHeight, client: node.clientHeight }));
    assert(card.scroll <= card.client, `the result card fits without scrolling (${card.scroll} / ${card.client})`);
  });

  // 動き軽減: 止め・揺れ・閃光・潰し伸ばし・紙吹雪・落下の速い軌道は使わない（余韻とひとことは出る）
  await check("feel-reduced-motion-has-no-hit-stop-shake-flash-squash-or-confetti", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-reduce")).check();
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await ride(page, () => {
      const d = window.__desertRide, g = d.game; d.skipCountdown(); d.pause(true);
      const rock = g.course.features.find(f => f.kind === "rock");
      while (g.z < rock.z - 3) d.advance(1 / 60);
      g.x = rock.x; g.vx = 0; d.pause(false);
    });
    await page.waitForFunction(() => window.__desertRide.game.falls === 1);
    const fall = await ride(page, () => window.__desertRide.fx);
    assert.deepEqual({ hitStop: fall.hitStop, shake: fall.shake.t, flash: fall.flash.t, dark: fall.flashDark, squash: fall.squash }, { hitStop: 0, shake: 0, flash: 0, dark: 0, squash: [1, 1] });
    await ride(page, () => { const d = window.__desertRide; d.autoplay("perfect"); d.setSpeedUp(8); });
    await page.waitForFunction(() => window.__desertRide.fx.goal !== null, null, { timeout: 90000 });
    const goal = await ride(page, () => window.__desertRide.fx);
    assert.deepEqual({ confetti: goal.confetti, hitStop: goal.hitStop, flash: goal.flash.t }, { confetti: 0, hitStop: 0, flash: 0 });
    await phase(page, "result");
  });
});
