import assert from "node:assert/strict";
import { suite } from "./support.mjs";

// 横持ちスマホの心得の盤（#3121）: 右パネル・値段・目的地の文字は実効 11.5px 以上（検査は 11.4）。
// 拡大・？・閉じるは実寸 39px 以上。マスのクリック箱は等倍では隣と重なるので 44px のまま、
// 1.2 倍以上で実効 44px まで広げる。盤の絵の地名や、後ろのマップのピンは対象外。
const t = (name) => `[data-test="${name}"]`;
const MIN_FONT = 11.4;
const MIN_TAP = 39;
const phone = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function openBoard(page) {
  await page.evaluate(async () => {
    (await import("./js/core/growth.js")).setGrowthPreview(true);
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    const g = (await import("./js/core/growth.js")).ensureGrowth(s);
    Object.assign(g, { xp: 520, level: 3, settledXp: 480, hidane: { any: 2 }, nodes: ["B1", "B2", "S1"] });
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.menuRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.menuError = String(error.stack || error); });
  });
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  await page.locator(t("hud-menu")).click();
  await page.locator(t("menu-board")).click();
  await page.locator(`${t("growth-board")}[data-mode="view"]`).waitFor({ timeout: 20000 });
  await page.locator(`${t("growth-board")}[data-art]`).waitFor({ timeout: 15000 }).catch(() => {});
}

const scanText = (minFont) => {
  const root = document.querySelector(".gboard");
  const stage = document.querySelector("#stage");
  const k = stage.getBoundingClientRect().width / stage.offsetWidth;
  const small = [];
  for (const node of root.querySelectorAll("*")) {
    if (![...node.childNodes].some((child) => child.nodeType === 3 && child.textContent.trim())) continue;
    if (node.closest(".gb-sr")) continue;
    const style = getComputedStyle(node);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = node.getBoundingClientRect();
    const effective = parseFloat(style.fontSize) * k;
    if (!box.width || !box.height || effective === 0 || effective >= minFont) continue;
    small.push(`${node.tagName.toLowerCase()}.${String(node.className).replace(/ /g, ".")} "${node.textContent.trim().slice(0, 8)}" ${effective.toFixed(1)}px`);
  }
  return small;
};

await suite("board-phone-text", async (check) => {
  await check("phone-844x390", async (page) => {
    await openBoard(page);
    assert.deepEqual(await page.evaluate(scanText, MIN_FONT), [], "board: small text");
    const chrome = await page.evaluate((minTap) => {
      const small = [];
      for (const name of ["board-zoom-in", "board-zoom-out", "board-zoom-fit", "board-help", "board-close"]) {
        const node = document.querySelector(`[data-test="${name}"]`);
        const box = node.getBoundingClientRect();
        if (Math.min(box.width, box.height) + 0.05 < minTap) small.push(`${name} ${box.width.toFixed(1)}x${box.height.toFixed(1)}`);
      }
      return small;
    }, MIN_TAP);
    assert.deepEqual(chrome, [], "board: small chrome taps");

    const before = await page.evaluate(() => {
      const n = document.querySelector('[data-test="board-node-B1"]');
      const r = n.getBoundingClientRect();
      return { hit: document.querySelector('[data-test="board-viewport"]').dataset.hit, w: r.width, h: r.height };
    });
    assert.equal(before.hit, "tight");
    assert(before.w < 39, `default zoom should keep node hits compact, got ${before.w}`);

    await page.locator(t("board-zoom-in")).click();
    const after = await page.evaluate(() => {
      const viewport = document.querySelector('[data-test="board-viewport"]');
      const nodes = [...document.querySelectorAll(".gb-node")].map((n) => n.getBoundingClientRect());
      let minGap = Infinity;
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = (a.left + a.right) / 2 - (b.left + b.right) / 2;
        const dy = (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2;
        const gap = Math.hypot(dx, dy) - (Math.max(a.width, a.height) + Math.max(b.width, b.height)) / 2;
        if (gap < minGap) minGap = gap;
      }
      const n = document.querySelector('[data-test="board-node-B1"]').getBoundingClientRect();
      return { hit: viewport.dataset.hit, zoom: viewport.dataset.zoom, w: +n.width.toFixed(1), h: +n.height.toFixed(1), minGap: +minGap.toFixed(1) };
    });
    assert.equal(after.hit, "wide", JSON.stringify(after));
    assert(after.w + 0.05 >= 43 && after.h + 0.05 >= 43, `zoomed node hit should be 44px effective, got ${JSON.stringify(after)}`);
    assert(after.minGap >= -0.5, `zoomed node hits must not overlap, gap ${after.minGap}`);
  }, phone);
});
