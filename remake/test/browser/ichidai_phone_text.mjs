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
const phone844 = { ...phone, viewport: { width: 844, height: 390 } };
const practice = { pageEntry: `${baseURL}ichidai.html?kit=a&tournament=practice&level=1&seed=33`, pageReadySelector: t("ichi-menu-start") };

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

  // 葉の盆: 2行名が右上の残り枚数の丸に隠れないこと（#3557。844x390 実プレイで ダブルアップル→「アッ」等）
  await check("market-844x390-leaf-names", async (page) => {
    await enterGame(page);
    for (const i of [0, 1, 2]) await page.locator(t(`ichi-hand-${i}`)).click();
    await page.locator(t("ichi-embers")).click();
    await page.locator(t("ichi-market")).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => {
      const nodes = [...document.querySelectorAll("*")].filter((n) => /あなたのターン/.test(n.textContent || ""));
      return !nodes.some((n) => {
        const r = n.getBoundingClientRect();
        const o = getComputedStyle(n);
        return r.width > 200 && o.opacity !== "0" && o.visibility !== "hidden" && o.display !== "none";
      });
    }, null, { timeout: 8000 }).catch(() => {});
    const problems = await page.evaluate(() => {
      const need = ["ダブルアップル", "ブラックティー", "ブルーベリー"];
      const overlap = (a, b) => {
        const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
        const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
        return x * y;
      };
      const out = [];
      for (const name of need) {
        const card = [...document.querySelectorAll("[data-test^='ichi-market-'] .ichi-card")].find((n) => (n.querySelector(".ichi-card-name")?.textContent || "").replace(/\u200b/g, "").includes(name));
        if (!card) { out.push(`missing ${name}`); continue; }
        const title = card.querySelector(".ichi-card-name");
        const count = card.closest(".ichi-pile-card")?.querySelector(".ichi-count");
        if (!count) continue;
        const cr = count.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(title);
        let area = 0;
        for (const r of range.getClientRects()) area += overlap(r, cr);
        if (area > 1) out.push(`重なり ${name} ${area.toFixed(0)}px²`);
      }
      return out;
    });
    assert.deepEqual(problems, [], "market leaf names");

    const readouts = await page.evaluate(() => {
      const stage = document.querySelector("#stage");
      const k = stage.getBoundingClientRect().width / stage.offsetWidth;
      return [".ichi-coal-left i", ".ichi-market-head b", ".ichi-coal-fire.is-ember", ".ichi-trend.is-up"].map(
        selector => [...document.querySelectorAll(selector)].map(el => parseFloat(getComputedStyle(el).fontSize) * k));
    });
    assert.ok(readouts.every(sizes => sizes.length && sizes.every(size => size >= MIN_FONT)), JSON.stringify(readouts));

    const confirm = async test => {
      const box = await page.locator(t(test)).boundingBox();
      assert.ok(Math.min(box.width, box.height) >= MIN_TAP, `${test}: ${JSON.stringify(box)}`);
    };
    await page.locator(`${t("ichi-market")} .ichi-pile-main`).first().tap();
    await confirm("ichi-pack");
    await page.locator(t("ichi-pack")).tap();
    await page.locator(t("ichi-market")).waitFor({ state: "detached" });
    await confirm("ichi-end");
  }, { ...phone844, ...practice });

  await check("help-844x390", async (page) => {
    await enterGame(page);
    await page.locator(t("ichi-help")).tap();
    const next = page.locator(t("ichi-help-next"));
    for (;;) {
      const problems = await page.evaluate(({ minFont, minTap }) => {
        const stage = document.querySelector("#stage");
        const bounds = stage.getBoundingClientRect();
        const k = bounds.width / stage.offsetWidth;
        const sheet = document.querySelector(".ichi-help").getBoundingClientRect();
        const problems = [];
        if (sheet.top < bounds.top || sheet.bottom > bounds.bottom) problems.push("遊び方が画面外");
        for (const li of document.querySelectorAll(".ichi-help li")) {
          if (parseFloat(getComputedStyle(li).fontSize) * k < minFont || li.scrollWidth > li.clientWidth + 1) problems.push(li.textContent);
        }
        for (const button of document.querySelectorAll(".ichi-help-buttons button")) {
          const { width, height, bottom } = button.getBoundingClientRect();
          if (Math.min(width, height) < minTap || bottom > bounds.bottom) problems.push(button.textContent);
        }
        return problems;
      }, { minFont: MIN_FONT, minTap: MIN_TAP });
      assert.deepEqual(problems, []);
      if (await next.isDisabled()) break;
      await next.tap();
    }
    await page.locator(t("ichi-help-close")).tap();
  }, { ...phone844, ...practice });

  await check("versus-844x390-long-name", async (page) => {
    await page.locator(t("ichi-menu-quick")).tap();
    await page.locator(".ichi-vs-player.p-1 > b").waitFor();
    const placement = await page.evaluate(() => {
      const stage = document.querySelector("#stage").getBoundingClientRect();
      const labels = [...document.querySelectorAll(".ichi-vs-player > :is(b, small)")];
      return labels.flatMap(label => {
        const rect = label.getBoundingClientRect();
        return rect.left < stage.left || rect.right > stage.right || rect.top < stage.top || rect.bottom > stage.bottom
          ? [label.textContent] : [];
      });
    });
    assert.deepEqual(placement, [], "VSの長い名前を画面内に表示");
  }, { ...phone844, ...practice, reducedMotion: "reduce",
    pageEntry: `${practice.pageEntry}&face=sumi&name=${encodeURIComponent("†黒羅雨℃† ロングネームの対戦相手")}` });
});
