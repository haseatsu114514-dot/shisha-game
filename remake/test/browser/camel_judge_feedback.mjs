// 試遊ページの声かけ判定: 説明がない表示に余分な文字やノードを出さず、既存のコンボ説明は残す。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const quick = '[data-test="camel-menu-quick"]';

async function startRace(page) {
  await page.locator(quick).click();
  await page.waitForFunction(() => document.querySelector('[data-test="camel-game"]')?.dataset.phase === "race");
  await recordFeedback(page);
}

async function recordFeedback(page) {
  await page.evaluate(() => {
    const node = document.querySelector(".camel-feedback");
    window.__camelJudgeFeedback = [];
    new MutationObserver(() => {
      const label = node.querySelector("b")?.textContent;
      if (!label || !node.classList.contains("show")) return;
      const entry = {
        label,
        text: node.textContent,
        childCount: node.childNodes.length,
        sub: node.querySelector("small")?.textContent ?? null,
      };
      const last = window.__camelJudgeFeedback.at(-1);
      if (last?.label !== entry.label || last?.text !== entry.text) window.__camelJudgeFeedback.push(entry);
    }).observe(node, { attributes: true, childList: true, subtree: true, characterData: true });
  });
}

async function recorded(page, label, occurrence = 1) {
  await page.waitForFunction(({ label, occurrence }) =>
    window.__camelJudgeFeedback?.filter(entry => entry.label === label).length >= occurrence,
  { label, occurrence }, { timeout: 20000 });
  return page.evaluate(({ label, occurrence }) =>
    window.__camelJudgeFeedback.filter(entry => entry.label === label)[occurrence - 1],
  { label, occurrence });
}

function withoutDetail(entry, label) {
  assert.equal(entry.text, label, `${label} の下に余分な文字を表示しない`);
  assert.equal(entry.childCount, 1, `${label} に説明要素・文字ノードを作らない`);
  assert.equal(entry.sub, null, `${label} に説明要素を作らない`);
}

await suite("camel-judge-feedback", async check => {
  await check("wasted-voice-without-cue", async page => {
    await startRace(page);
    const cueAtPress = await page.evaluate(() => {
      const button = document.querySelector('[data-test="camel-voice"]');
      const cue = button.dataset.cue;
      button.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" }));
      return cue;
    });
    assert.equal(cueAtPress, "off", "輪のない時に声ボタンを押す");
    withoutDetail(await recorded(page, "無駄な声"), "無駄な声");
  });

  await check("perfect-and-existing-combo", async page => {
    await startRace(page);
    withoutDetail(await recorded(page, "PERFECT"), "PERFECT");
    const combo = await recorded(page, "PERFECT", 2);
    assert.equal(combo.sub, "2 COMBO", "既存の説明文は表示する");
    assert.equal(combo.text, "PERFECT2 COMBO");
    assert.equal(combo.childCount, 2);
  });

  await check("missed-cue", async page => {
    await page.goto(new URL("camel-race.html?pilot=none", baseURL).href);
    await startRace(page);
    withoutDetail(await recorded(page, "見送った……"), "見送った……");
  });

  // ---- 手応え（2026-11-13・CRF）。数値は __camelRace.feel、今の状態は __camelRace.fx ----
  const fx = page => page.evaluate(() => window.__camelRace.fx);
  const open = async (page, query) => {
    await page.goto(new URL(`camel-race.html?${query}`, baseURL).href);
    await page.locator(quick).click();
    await page.waitForFunction(() => window.__camelRace?.fx.phase === "countdown");
  };

  await check("hit-stop-freezes-clock-and-keeps-input", async page => {
    await open(page, "pilot=perfect");
    assert.equal((await fx(page)).countdownTotal, 3, "最初の1本の合図は3秒");
    // スタート前に押しても黙らない（ボタンが沈み、判定はしない）。
    await page.evaluate(() => document.querySelector('[data-test="camel-voice"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1, pointerType: "mouse" })));
    assert.equal(await page.evaluate(() => document.querySelector('[data-test="camel-voice"]').classList.contains("held")), true, "スタート前の声でもボタンが沈む");
    await page.waitForFunction(() => window.__camelRace.fx.phase === "race");
    // 止めを長くして、PERFECT の瞬間を捕まえる（止めの間はレースの時計が進まない＝輪も止まる）。
    await page.evaluate(() => { window.__camelRace.feel.stopPerfect = 1.5; });
    await page.waitForFunction(() => window.__camelRace.fx.stop > 1, null, { timeout: 20000 });
    const before = await fx(page);
    assert(before.stretch.player, "PERFECT で自分のラクダが伸びる");
    assert(before.glow > 0, "PERFECT で騎手のまわりが光る");
    assert(before.marks >= 1, "PERFECT で星形のヒットマークが出る");
    assert(before.tremble.player > 0, "止めの間、声を受けた自分のラクダが震える");
    assert.equal(before.whipHeld, false);
    // 止めの間もムチは押せる。
    await page.evaluate(() => document.querySelector('[data-test="camel-signal"]').dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 7, pointerType: "mouse" })));
    await page.waitForTimeout(250);
    const during = await fx(page);
    assert(during.stop > 0, "まだ止めの間");
    assert.equal(during.t, before.t, "止めの間はレースの時計が進まない");
    assert.equal(during.whipHeld, true, "止めの間に押したムチが入る");
    // 明けたら時計が進み、前へ出る動きが始まる。
    await page.evaluate(() => { window.__camelRace.feel.stopPerfect = 0.045; });
    await page.waitForFunction(t => window.__camelRace.fx.stop === 0 && window.__camelRace.fx.t > t, before.t, { timeout: 5000 });
  });

  await check("goal-afterglow-skip-and-record", async page => {
    await open(page, "pilot=perfect&speed=8");
    // 余韻が自然には終わらないようにして、飛ばす操作だけを確かめる。
    await page.evaluate(() => { const feel = window.__camelRace.feel; feel.goalAfter = 1e9; feel.goalSkipAfter = 1e9; });
    await page.waitForFunction(() => window.__camelRace.fx.phase === "goal", null, { timeout: 60000 });
    assert.equal((await fx(page)).runs, 1, "記録はゴールした瞬間に入る");
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
    assert.equal((await fx(page)).phase, "goal", "余韻の出だしは飛ばせない");
    await page.evaluate(() => { window.__camelRace.feel.goalSkipAfter = 0; });
    await page.keyboard.press("Enter"); // 声・ムチ・Enter のどれでも飛ばせる
    await page.waitForFunction(() => window.__camelRace.fx.phase === "result", null, { timeout: 3000 });
    assert.equal((await fx(page)).runs, 1, "結果を開いても記録は1件のまま");
    const next = await page.locator('[data-test="camel-next"]').innerText();
    assert.match(next, /次の評価 [SAB] まで あと \d+点|評価 S/, "結果に次の目標が出る");
    // 2本目からの合図は短い。
    await page.locator('[data-test="camel-retry"]').click();
    await page.waitForFunction(() => window.__camelRace.fx.phase === "countdown");
    const retry = await fx(page);
    assert.equal(retry.countdownTotal, 1.5, "2本目からの合図は1.5秒");
    assert(retry.countdown > 0 && retry.countdown <= 1.5);
    // ゴールした後の「やめる」は、閉じずに結果へ（走り切った記録を捨てない）。
    await page.waitForFunction(() => window.__camelRace.fx.phase === "goal", null, { timeout: 60000 });
    await page.locator('[data-test="camel-close"]').click();
    await page.waitForFunction(() => window.__camelRace?.fx.phase === "result", null, { timeout: 3000 });
    assert.equal((await fx(page)).runs, 2);
    assert.equal(await page.locator('[data-test="camel-result"]').count(), 1);
  });

  await check("whip-empty-and-ready-are-announced", async page => {
    await open(page, "pilot=hold&speed=4");
    await page.evaluate(() => { window.__camelRace.feel.flash.whipEmpty = [3, 0.3, 0]; });
    await page.waitForFunction(() => window.__camelRace.fx.flash.kind === "whipEmpty" && window.__camelRace.fx.flash.t > 0, null, { timeout: 30000 });
    const state = await fx(page);
    assert.equal(state.whipping, false, "ムチが止まった瞬間に暗く沈む");
    assert.equal(await page.locator('[data-test="camel-signal"]').getAttribute("data-hit"), "miss", "ムチのボタンが赤く光る");
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.hit === "boost", null, { timeout: 30000 });
  });

  // ---- 桜井スキルでの添削（2026-11-13・CRF13〜） ----
  await check("pause-freezes-and-resumes-with-a-lead", async page => {
    await open(page, "pilot=perfect");
    await page.waitForFunction(() => window.__camelRace.fx.phase === "race" && window.__camelRace.fx.t > 1);
    await page.locator('[data-test="camel-pause"]').click();
    await page.locator('[data-test="camel-paused"]').waitFor();
    const held = await fx(page);
    assert.equal(held.paused, true);
    await page.waitForTimeout(300);
    assert.equal((await fx(page)).t, held.t, "一時停止の間はレースの時計が進まない");
    // Esc で戻る。3・2・1 を数える間は止まったまま、そのあと同じ所から走り出す。
    await page.evaluate(() => { window.__camelRace.feel.pauseLead = 1.2; });
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => window.__camelRace.fx.paused === false);
    const lead = await fx(page);
    assert(lead.resumeLead > 0, "戻る合図が始まる");
    assert.equal(lead.t, held.t, "合図の間も止まったまま");
    assert.equal(await page.locator('[data-test="camel-paused"]').count(), 0);
    await page.waitForFunction(t => window.__camelRace.fx.resumeLead <= 0 && window.__camelRace.fx.t > t, held.t, { timeout: 5000 });
    // Esc でも止まる。「最初からやり直す」は記録を残さず、短い合図からもう一度。
    await page.keyboard.press("Escape");
    await page.locator('[data-test="camel-restart"]').click();
    await page.waitForFunction(() => window.__camelRace.fx.phase === "countdown" && window.__camelRace.fx.paused === false);
    const again = await fx(page);
    assert.equal(again.runs, 0, "やり直しは記録に入らない");
    assert.equal(again.countdownTotal, 1.5, "やり直しの合図は短い");
    // カードの「やめる」で閉じる。
    await page.keyboard.press("p");
    await page.locator('[data-test="camel-pause-quit"]').click();
    await page.locator(quick).waitFor();
  });

  await check("first-run-coach-teaches-while-racing", async page => {
    // すぐ走る（遊び方なし）では教えない。
    await open(page, "pilot=perfect");
    assert.equal((await fx(page)).coach, null);
    // 遊び方から入った最初の1本: 最初の輪はゆっくり → 当てたらムチ → 入れたら離し時、の順に進む。
    await page.goto(new URL("camel-race.html?pilot=perfect", baseURL).href);
    await page.locator('[data-test="camel-menu-start"]').click();
    await page.locator('[data-test="camel-tutorial-skip"]').click();
    await page.waitForFunction(() => window.__camelRace?.fx.phase === "race", null, { timeout: 15000 });
    assert.equal((await fx(page)).coach, "voice");
    await page.waitForFunction(() => document.querySelector('[data-test="camel-voice"]').dataset.cue === "on");
    const slow = await page.evaluate(async () => {
      const from = window.__camelRace.fx.t, at = performance.now();
      await new Promise(resolve => setTimeout(resolve, 200));
      return { race: window.__camelRace.fx.t - from, real: (performance.now() - at) / 1000, coach: window.__camelRace.fx.coach };
    });
    if (slow.coach === "voice") assert(slow.race <= slow.real * 0.75, `最初の輪の間はレース全体がゆっくり（${slow.race.toFixed(3)} / ${slow.real.toFixed(3)}）`);
    await page.waitForFunction(() => window.__camelRace.fx.coach === "whip", null, { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.coach === "on", null, { timeout: 10000 });
    assert.match(await page.locator('[data-test="camel-call"]').innerText(), /次はムチだ/);
    await page.evaluate(() => { window.__camelRace.debug.warp(0.3); window.__camelRace.debug.stamina(100); });
    await page.waitForFunction(() => ["release", "done"].includes(window.__camelRace.fx.coach), null, { timeout: 20000 });
    assert.equal(await page.locator('[data-test="camel-signal"]').getAttribute("data-coach"), "off", "ムチを入れたら光は消える");
  });

  await check("target-ahead-feel-override-and-debug-tools", async page => {
    // URL からの上書き（数の所に数だけ。知らない名前は無視）。
    await open(page, "pilot=none&feel=stopPerfect:0.3,shake.goal.0:21,nothing:9,se.hoof.gain:0.2");
    const feel = await page.evaluate(() => ({ stop: window.__camelRace.feel.stopPerfect, goal: window.__camelRace.feel.shake.goal[0], hoof: window.__camelRace.feel.se.hoof.gain, nothing: "nothing" in window.__camelRace.feel }));
    assert.deepEqual(feel, { stop: 0.3, goal: 21, hoof: 0.2, nothing: false });
    // 何もしないと後ろへ下がる: すぐ前の相手が「目の前の目標」になる。
    await page.waitForFunction(() => window.__camelRace.fx.t > 4 && ["front", "closer", "steady"].includes(window.__camelRace.fx.target), null, { timeout: 30000 });
    // 確認用の道具（試遊ページだけ）: 息の指定・コースの好きな所へ移動・画面の静止。
    assert.equal(await page.evaluate(() => window.__camelRace.debug.stamina(12)), true);
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"] .camel-stamina').dataset.state !== "ok");
    await page.evaluate(() => window.__camelRace.debug.warp(0.9));
    await page.waitForFunction(() => document.querySelector('[data-test="camel-signal"]').dataset.state === "spurt" || document.querySelector(".camel-banner.show") !== null, null, { timeout: 5000 });
    await page.evaluate(() => window.__camelRace.debug.freeze(true));
    const stopped = (await fx(page)).t;
    await page.waitForTimeout(250);
    assert.equal((await fx(page)).t, stopped, "静止の間は進まない");
    await page.evaluate(() => window.__camelRace.debug.freeze(false));
    await page.waitForFunction(t => window.__camelRace.fx.t > t, stopped, { timeout: 5000 });
  });

  await check("reduced-motion-has-no-stop", async page => {
    await open(page, "pilot=perfect");
    assert.equal((await fx(page)).reducedMotion, true);
    await page.evaluate(() => { window.__camelRace.feel.stopPerfect = 5; });
    await recordFeedback(page);
    await recorded(page, "PERFECT");
    const state = await fx(page);
    assert.equal(state.stop, 0, "動き軽減では止めない");
    assert.deepEqual(state.stretch, {}, "動き軽減では潰し伸ばしをしない");
    assert.equal(state.lunge, 0);
  }, { reducedMotion: "reduce" });
}, { entry: new URL("camel-race.html?pilot=perfect", baseURL).href, readySelector: quick });
