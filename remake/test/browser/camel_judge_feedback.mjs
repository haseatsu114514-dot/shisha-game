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
}, { entry: new URL("camel-race.html?pilot=perfect", baseURL).href, readySelector: quick });
