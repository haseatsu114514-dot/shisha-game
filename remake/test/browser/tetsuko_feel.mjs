// てつこといっしょの手応え（docs/spec/tetsuko_time.md §10・2026-11-11）。実UIで次を確かめる:
// - 触らなくても、数秒で頭の上におねだりの吹き出しが出て、応えられる道具が知らされる
// - なでる場所で反応が変わる。しっぽは触らせてくれないが、ごきげんは減らない。擬音が猫のそばに出る
// - じゃらしは 3 回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ
// - ごきげんのハートがいっぱいになると「とっておき」が出て、ハートは空に戻る。通算の回数が結果と記録に残る
// - 触らずに眺めているだけでも、隣で見守ったことになる（「そっと見守る」「止める」のボタンは無い）
// 本編の入口・確定（回復12・来訪1回）は ch3_tokyo_daily.mjs、専用テーマと基本画面の文字は tetsuko_theme.mjs が見る。
// ここは画面を直接開く（本編の道のりを通らない短い検査）。確定は、同じ確定点 settleTetsukoTime をページの中で呼んで確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;

// 懐いた後（来訪5回＝気を許す段階）のセーブで、ふれあいの画面を直接開く。結果は window.__tetsukoResult に入る。
async function open(page, { visits = 5, record = { sessions: 3, peaks: 3 } } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async ({ visits, record }) => {
    const core = await import("./js/core/state.js");
    const data = await import("./js/core/data.js");
    const time = await import("./js/minigames/tetsuko-time.js");
    const value = core.newState();
    Object.assign(value, { chapter: 3, phase: "daily", day: 36, slot: 1 });
    value.met = { ...(value.met || {}), mashiro: true, mukai_master: true };
    value.flags = { ...(value.flags || {}), _ch3_outings: { tetsuko: visits }, _tetsuko_time: record };
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
    window.__tetsukoValue = value;
    window.__tetsukoResult = null;
    time.openTetsukoTime({ value, visitKey: time.tetsukoVisitKey(value), bg: data.sceneBg?.("bg_street", "night")?.url || null })
      .then(result => { window.__tetsukoResult = result; });
  }, { visits, record });
  const screen = page.locator(dt("tetsuko-time-screen"));
  await screen.waitFor();
  return screen;
}
// 帰って、結果を同じ確定点で確定する（本編の呼び出し側と同じ順）。
async function leaveAndSettle(page) {
  await page.locator(dt("tetsuko-time-back")).click();
  await page.waitForFunction(() => window.__tetsukoResult, null, { timeout: 30000 });
  return await page.evaluate(async () => {
    const time = await import("./js/minigames/tetsuko-time.js");
    const settled = time.settleTetsukoTime(window.__tetsukoValue, window.__tetsukoResult);
    return { result: window.__tetsukoResult, settled, flags: window.__tetsukoValue.flags };
  });
}

await suite("tetsuko-feel", async check => {
  await check("tetsuko-feel-wish-zones-pounce-and-joy-peak", async page => {
    const screen = await open(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    const caption = () => get("caption").textContent();
    const joy = async () => Number(await get("joy").getAttribute("data-value"));
    assert.equal(await screen.getAttribute("data-stage"), "3");
    assert.equal(await page.locator(".tt-heart").count(), 5, "Five hearts show how happy she is");
    // 触らなくても、数秒で頭の上に吹き出しが出て、応えられる道具が知らされる。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.wish, null, { timeout: 15000 });
    const wish = await screen.getAttribute("data-wish");
    assert(["pet", "play", "brush", "treat", "watch", "decor"].includes(wish), `She shows what she wants (${wish})`);
    assert.equal(await get("wish").isVisible(), true);
    assert.equal(await page.evaluate(() => document.querySelectorAll(".tt-act.asked, .tt-tool.asked").length), wish === "watch" ? 0 : 1, "Exactly the tool that answers is marked");
    // なでる: 触った場所で反応が変わる。しっぽは触らせてくれない（ごきげんは減らない）。擬音が出る。
    const box = await get("cat").boundingBox();
    const at = (rx, ry) => [box.x + box.width * rx, box.y + box.height * ry];
    await page.mouse.click(...at(.5, .25));
    await page.waitForFunction(() => /すり寄って/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert(await page.locator(".tt-pop").count() >= 1, "A short sound word pops beside her");
    const afterRub = await joy();
    assert(afterRub > 0);
    await page.mouse.click(...at(.5, .55));
    await page.waitForFunction(() => /あご|お気に入り|押しつけて/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert(await joy() > afterRub, "Each stroke adds a little");
    const beforeTail = await joy();
    await page.mouse.click(...at(.14, .86));
    await page.waitForFunction(() => /しっぽ/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent));
    assert.equal(await joy(), beforeTail, "Touching her tail costs nothing");
    // じゃらし: 持ち替えると少し引いた画になる。3回で前足、次のひと振りで飛びつき、先がそこにあれば抱えこむ。
    await get("play").click();
    assert.equal(await screen.getAttribute("data-tool"), "toy");
    await get("play").click();
    await get("play").click();
    await get("note").filter({ hasText: "はじめて前足が出た" }).waitFor();
    await get("play").click();
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-cat"]')?.dataset.at === "free", null, { timeout: 5000 });
    await page.waitForFunction(() => /抱えこんで/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 5000 });
    assert.equal(await screen.getAttribute("data-toy"), "held", "The toy stays in her arms for a moment");
    // ごきげんがいっぱいになるまで遊ぶと「とっておき」: ハートが空に戻り、写真に撮れるしぐさが出る。
    for (let i = 0; i < 40 && await screen.getAttribute("data-peak") !== "1"; i += 1) {
      if (await screen.getAttribute("data-toy") !== "held") await get("play").click();
      await page.waitForTimeout(450);
    }
    assert.equal(await screen.getAttribute("data-peak"), "1", "Her hearts fill up while playing");
    assert.match(await caption(), /膝に乗ってきた|頭をこすりつけて/, "A special moment at the stage she trusts you");
    assert(await joy() < 40, "The hearts start again after the special moment");
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-photo"]') && !document.querySelector('[data-test="tetsuko-photo"]').hidden);
    await get("photo").click();
    // 手帳に、ごきげんにした通算の回数が出る（前の3回＋今回）。
    await get("book").click();
    assert.match(await get("book-joy").textContent(), /4回/);
    await get("panel-close").click();
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true);
    assert.equal(result.peaks, 1);
    assert(result.found.includes("first_rub") && result.found.includes("hug_toy"));
    assert(result.album.length >= 1);
    assert.deepEqual(settled, { committed: true, stamina: 12 }, "The same settle point as before: one visit, 12 stamina");
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(flags._tetsuko_time.peaks, 4, "The lifetime count of happy peaks is kept for the notebook");
    assert.equal(await screen.count(), 0);
  });

  // 触らずに眺めているだけでも、隣で見守ったことになる（「そっと見守る」のボタンは無い）。てつこは自分で動き、帰ると来訪が数えられる。
  await check("tetsuko-feel-just-watching-counts-as-being-with-her", async page => {
    const screen = await open(page, { record: { sessions: 3, found: ["waiting"] } });
    assert.equal(await page.locator(dt("tetsuko-watch")).count(), 0, "No button for sitting beside her");
    assert.equal(await page.locator(dt("tetsuko-catch")).count(), 0, "No button for stopping the toy");
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".tt-dock .tt-act-label")].map(node => node.textContent)),
      ["なでる", "じゃらし", "ブラシ", "おやつ"], "Four tools in hand");
    await page.waitForFunction(() => /前足をそろえて|膝に乗ってきた/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 40000 });
    assert(Number(await page.locator(dt("tetsuko-joy")).getAttribute("data-value")) > 0, "Being together fills her hearts a little");
    const { result, settled, flags } = await leaveAndSettle(page);
    assert.equal(result.meaningful, true, "Just watching her counts");
    assert(result.found.includes("paws_together") || result.found.includes("lap_nap"));
    assert.equal(settled.committed, true);
    assert.equal(flags._ch3_outings.tetsuko, 6);
    assert.equal(await screen.count(), 0);
  });

  // すぐ帰れば、何も確定しない（見守ったことになるのは、数秒そばにいた時だけ）。動きを減らす設定でも遊べる（跳ばずに結果だけ出る）。
  await check("tetsuko-feel-reduced-motion-plays-without-leaps", async page => {
    const screen = await open(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    assert.equal(await screen.getAttribute("data-reduced"), "true");
    for (let i = 0; i < 4; i += 1) await get("play").click();
    await page.waitForFunction(() => /抱えこんで/.test(document.querySelector('[data-test="tetsuko-caption"]')?.textContent), null, { timeout: 5000 });
    assert.notEqual(await get("cat").getAttribute("data-at"), "free", "She does not leap when motion is reduced");
    assert.equal(await page.locator(".tt-bit").count(), 0, "No flying bits when motion is reduced");
    assert(Number(await get("joy").getAttribute("data-value")) > 0);
    const { result } = await leaveAndSettle(page);
    assert(result.found.includes("hug_toy"));
  }, { reducedMotion: "reduce" });
});
