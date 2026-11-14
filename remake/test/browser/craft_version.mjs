// シーシャ作りの版（CRN16）: 桜井版はリニューアル前の作業台、リニューアルは新しい作業台で動くこと。
// 試遊ページ（craft-preview.html）の ?craft= で版を選ぶ。本編の設定の切替と大会の審査は ch1_vote_style.mjs。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const preview = (query) => new URL(`craft-preview.html?${query}`, baseURL).href;
const LONG = 120000;

/** カウントダウンの文字と、版で分かれる部品が一度でも出たかを記録する（自動操作の速い工程でも取りこぼさない） */
function watchCraft() {
  window.__seen = { countdown: [], destination: false, arc: false, focus: false, readyCue: false, callout: false };
  const look = () => {
    const seen = window.__seen, cd = document.querySelector(".countdown");
    if (cd && seen.countdown[seen.countdown.length - 1] !== cd.textContent) seen.countdown.push(cd.textContent);
    if (!cd && seen.countdown.length && seen.countdown[seen.countdown.length - 1] !== "|") seen.countdown.push("|");
    seen.destination ||= !!document.querySelector('[data-test="pull-destination"]');
    seen.arc ||= !!document.querySelector(".pg-draw-arc");
    seen.focus ||= !!document.querySelector('[data-test="pull-focus"]');
    seen.readyCue ||= !!document.querySelector(".coal.ready-cue");
    seen.callout ||= !!document.querySelector(".foil-target-plane > .stamp");
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });
}
const autoGood = (page) => page.evaluate(async () => { (await import("./js/craft/session.js")).craftTest.auto = "good"; });
const seen = (page) => page.evaluate(() => structuredClone(window.__seen));
const rankText = (page) => page.locator(".bench-top > .craft-rank").textContent();
/** 同じ作業台でもう一度カウントダウンを回し、出た文字を返す（2回目の短縮はリニューアルだけ） */
const secondCountdown = (page) => page.evaluate(async () => {
  window.__seen.countdown = [];
  await (await import("./js/core/ui.js")).countdown();
  return window.__seen.countdown.filter((text) => text !== "|").join(" ");
});

await suite("craft-version", async (check) => {
  await check("sakurai-holes-before-renewal", async (page) => {
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "sakurai");
    assert.match(await rankText(page), /未計測/, "桜井版の暫定ランクは、はじめ「—」（工程を終えた平均）");
    await page.locator(t("hole-start")).click();
    await page.locator(t("hole-punch")).waitFor();
    // リニューアル前の「次のリングへ」「穴あけを終えて結果へ」のボタンがあり、はじめは押せない
    assert.equal(await page.locator(t("hole-next")).isDisabled(), true);
    assert.equal(await page.locator(t("hole-done")).isDisabled(), true);
    await page.waitForFunction(() => !document.querySelector(".countdown"));
    assert.deepEqual((await seen(page)).countdown.slice(0, 4), ["3", "2", "1", "GO!"]);
    assert.equal(await secondCountdown(page), "3 2 1 GO!", "同じ作業台の2回目も 3・2・1（リニューアルは GO! だけ）");
  }, { pageEntry: preview("step=holes&mode=rehearsal&craft=sakurai"), pageReadySelector: t("hole-start") });

  await check("renewal-holes", async (page) => {
    assert.equal(await page.locator(".bench").getAttribute("data-craft-version"), "renewal");
    assert.match(await rankText(page), /制作ランク D/, "リニューアルの暫定ランクは、はじめD");
    await page.locator(t("hole-start")).click();
    await page.locator(t("hole-punch")).waitFor();
    assert.equal(await page.locator(t("hole-next")).count(), 0, "リングが埋まると自動で次へ進む（ボタンは無い）");
    assert.equal(await page.locator(t("hole-done")).count(), 0);
    await page.waitForFunction(() => !document.querySelector(".countdown"));
    assert.equal(await secondCountdown(page), "GO!", "同じ作業台の2回目は GO! だけ");
  }, { pageEntry: preview("step=holes&mode=rehearsal"), pageReadySelector: t("hole-start") });

  await check("sakurai-lesson-demo-is-the-old-recording", async (page) => {
    const src = await page.locator(".bench-demo-sheet video").getAttribute("src");
    assert.match(src, /demo-holes-classic\.mp4$/, "桜井版のお手本は「次のリングへ」を押す前の画面の映像");
    await page.locator(".bench-demo-skip").click();
    await page.locator(t("hole-start")).waitFor();
  }, { pageEntry: preview("step=holes&mode=tutorial&craft=sakurai"), pageReadySelector: ".bench-demo-sheet",
    ignoreFailedResource: (failure) => /\.mp4/.test(failure) });

  await check("sakurai-steam-and-pull-before-renewal", async (page) => {
    await autoGood(page);
    await page.waitForFunction(() => globalThis.__craftPreview?.done, null, { timeout: LONG, polling: 250 });
    const s = await seen(page);
    assert.equal(s.destination, false, "針の札の「止めると →」はリニューアルだけ");
    assert.equal(s.arc, false, "吸っている間の弧はリニューアルだけ");
    assert.equal(s.focus, false, "集中の札はリニューアルだけ");
  }, { pageEntry: preview("step=pull&mode=rehearsal&craft=sakurai"), pageReadySelector: ".bench" });

  await check("renewal-steam-and-pull", async (page) => {
    await autoGood(page);
    await page.waitForFunction(() => globalThis.__craftPreview?.done, null, { timeout: LONG, polling: 250 });
    const s = await seen(page);
    assert.equal(s.destination, true, "針の札に行き先が出る");
    assert.equal(s.arc, true, "吸っている間の弧がある");
  }, { pageEntry: preview("step=pull&mode=rehearsal"), pageReadySelector: ".bench" });
}, { initScript: watchCraft });
