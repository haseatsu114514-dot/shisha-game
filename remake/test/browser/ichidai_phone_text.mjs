import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { overflowed } from "./ichidai_support.mjs";

// 横持ちスマホの一台勝負（#3557）: 文字は実効 11.5px 以上（検査は 11.4）、
// 押せる箱は配合と同じ実寸 39px 以上（--phone-tap / --help-hit）。
// 極小のトークン札（s-tiny / s-mini）と札の左上の印（.ichi-gem の数字）は枠に収まらないので対象外。
const t = (name) => `[data-test="${name}"]`;
const MIN_FONT = 11.4;
const MIN_TAP = 39;
const phone = { viewport: { width: 846, height: 393 }, isMobile: true, hasTouch: true };

const scanText = (minFont) => {
  const stage = document.querySelector("#stage");
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const small = [];
  for (const node of stage.querySelectorAll("*")) {
    if (![...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim())) continue;
    if (node.closest(".s-tiny, .s-mini, .ichi-gem, .ichi-vs")) continue;
    let hidden = false;
    for (let a = node; a && a !== stage; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.display === "none" || o.visibility === "hidden" || o.opacity === "0" || a.hidden) hidden = true;
    }
    if (hidden) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = node.getBoundingClientRect();
    const effective = parseFloat(style.fontSize) * k;
    if (!box.width || !box.height || effective === 0 || effective >= minFont) continue;
    small.push(`${node.tagName.toLowerCase()}.${String(node.className).replace(/ /g, ".")} "${node.textContent.trim().slice(0, 8)}" ${effective.toFixed(1)}px`);
  }
  return small;
};

const scanTaps = (minTap) => {
  const stage = document.querySelector("#stage");
  const small = [];
  for (const name of ["ichi-menu-start", "ichi-menu-quick", "ichi-coal-help", "ichi-assist", "ichi-embers", "ichi-do-hint", "ichi-help", "ichi-close", "ichi-fast"]) {
    const node = document.querySelector(`[data-test="${name}"]`);
    if (!node) continue;
    let hidden = false;
    for (let a = node; a; a = a.parentElement) {
      const o = getComputedStyle(a);
      if (o.display === "none" || o.visibility === "hidden" || o.opacity === "0" || a.hidden) hidden = true;
    }
    if (hidden) continue;
    const box = node.getBoundingClientRect();
    if (Math.min(box.width, box.height) + 0.05 < minTap) small.push(`${name} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
  }
  return small;
};

const enterGame = async (page) => {
  await page.locator(t("ichi-menu-quick")).click();
  const skip = page.locator(".ichi-vs-skip");
  try { await skip.waitFor({ timeout: 4000 }); await skip.click(); } catch {}
  await page.locator(t("ichi-game")).waitFor({ timeout: 30000 });
  await page.waitForFunction(() => {
    const g = document.querySelector('[data-test="ichi-game"]');
    return g && (g.dataset.phase === "prep" || g.dataset.phase === "serve" || g.dataset.turn === "me");
  }, null, { timeout: 30000 });
};

await suite("ichidai-phone-text", async (check) => {
  await check("menu-846x393", async (page) => {
    assert.deepEqual(await page.evaluate(scanText, MIN_FONT), [], "menu: small text");
    assert.deepEqual(await page.evaluate(scanTaps, MIN_TAP), [], "menu: small taps");
  }, { ...phone, pageEntry: `${baseURL}ichidai.html`, pageReadySelector: t("ichi-menu-start") });

  await check("game-846x393", async (page) => {
    await enterGame(page);
    assert.deepEqual(await overflowed(page), [], "game: overflow");
    assert.deepEqual(await page.evaluate(scanText, MIN_FONT), [], "game: small text");
    assert.deepEqual(await page.evaluate(scanTaps, MIN_TAP), [], "game: small taps");
  }, { ...phone, pageEntry: `${baseURL}ichidai.html?kit=a&tournament=practice&level=1&seed=33`, pageReadySelector: t("ichi-menu-start") });
});
