// Paper notifications and board interaction use the production UI on desktop and touch.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

// Reward cards have a flat opaque paper background; reject unmeasured layers.
async function cardContrasts(page) {
  return page.locator(".gain-card.info .gc-top, .gain-card.info .gc-main, .gain-card.info .gc-sub, .gain-card.info .gc-badge").evaluateAll(nodes => {
    const rgb = css => css.match(/[\d.]+/g).map(Number);
    const lum = c => { const p = c.slice(0, 3).map(n => { n /= 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }); return p[0] * .2126 + p[1] * .7152 + p[2] * .0722; };
    return nodes.map(node => {
      let bg;
      for (let p = node; p; p = p.parentElement) {
        const style = getComputedStyle(p), color = rgb(style.backgroundColor);
        if (style.backgroundImage !== "none" || style.borderImageSource !== "none" || +style.opacity !== 1) throw Error(`Unmeasured notification layer ${p.className}`);
        if (color.length === 3 || color[3] === 1) { bg = color; break; }
        if (color[3] !== 0) throw Error("Unmeasured translucent background");
      }
      if (!bg) throw Error("No opaque background");
      const fg = rgb(getComputedStyle(node).color);
      if (fg.length > 3 && fg[3] !== 1) throw Error("Unmeasured translucent text");
      const a = lum(fg), b = lum(bg);
      return { text: node.textContent, selector: node.className, ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05), shadow: getComputedStyle(node).textShadow };
    });
  });
}

await suite("board-notification-visibility", async check => {
  for (const touch of [false, true]) {
    await check(touch ? "touch" : "desktop", async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), ui = await import("./js/core/ui.js");
        (await import("./js/core/ui-theme.js")).applyUiTheme("paper");
        const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 3, slot: 1, money: 10000 });
        (await import("./js/core/mastery-notice.js")).notifyMastery([{ id: "lemon", before: 1, level: 2 }]);
        ui.gainCard({ kind: "info", badge: "葉", top: "FLAVOR", main: "レモンを手に入れた", sub: "在庫が50g増えた" });
        const hud = await import("./js/daily/hud.js"); hud.initHud({}); hud.showHud();
        window.visibilityTest = { core, ui };
      });
      await page.locator(".gain-card.info").last().waitFor();
      await page.waitForTimeout(650);
      const cards = await cardContrasts(page);
      assert.equal(cards.length, 8);
      for (const row of cards) {
        assert(row.ratio >= 4.5, `Paper card text contrast ${JSON.stringify(row)}`);
        if (row.selector === "gc-main") assert.equal(row.shadow, "none");
      }
      // Negative control: the previous inherited white text must be caught.
      await page.locator(".gain-card.info .gc-main").evaluateAll(nodes => nodes.forEach(n => n.style.color = "#f4ede0"));
      assert((await cardContrasts(page)).filter(r => r.selector === "gc-main").every(r => r.ratio < 4.5));
      await page.locator(".gain-card.info .gc-main").evaluateAll(nodes => nodes.forEach(n => n.style.removeProperty("color")));
      assert((await cardContrasts(page)).every(r => r.ratio >= 4.5));
      await page.screenshot({ path: `/tmp/paper-notifications-${touch ? "touch" : "desktop"}.png` });
      await page.evaluate(() => visibilityTest.ui.bannersIdle());

      // Buy a real flavor rather than injecting a lookalike toast.
      await page.evaluate(async () => {
        const { openShop } = await import("./js/daily/shop.js");
        const s = visibilityTest.core.state;
        visibilityTest.before = { stock: s.flavorStock.lemon || 0, money: s.money };
        visibilityTest.shop = openShop({ errand: "lemon" });
      });
      await page.locator('[data-test="buy-lemon"]').click();
      await page.locator('[data-test="shop-checkout"]').click();
      const notice = page.locator(".toast.good").filter({ hasText: "仕入れが完了しました" });
      await notice.waitFor();
      await assertFits(page, ".toast.good");
      const purchase = await page.evaluate(() => {
        const { core, before } = visibilityTest, cs = getComputedStyle(document.querySelector(".toast.good"));
        return { grams: core.state.flavorStock.lemon - before.stock, paid: before.money - core.state.money, color: cs.color, shadow: cs.textShadow, moneyColor: getComputedStyle(document.querySelector(".money-pop.minus")).color, moneyShadow: getComputedStyle(document.querySelector(".money-pop.minus")).textShadow };
      });
      assert.equal(purchase.grams, 50); assert(purchase.paid > 0);
      assert.equal(purchase.color, "rgb(47, 107, 69)"); assert.equal(purchase.shadow, "none");
      assert.equal(purchase.moneyColor, "rgb(168, 58, 58)"); assert.equal(purchase.moneyShadow, "none");
      await page.locator('[data-test="shop-leave"]').click();
      await page.evaluate(() => visibilityTest.shop);

      await page.evaluate(async () => {
        const growth = await import("./js/core/growth.js"), board = await import("./js/core/growth-board.js");
        const { openBoard } = await import("./js/daily/growth-board-screen.js");
        const g = growth.ensureGrowth(); g.hidane.any = 30; g.seenRing = 1;
        visibilityTest.board = board; visibilityTest.openBoard = openBoard;
        visibilityTest.done = openBoard({ place: "kannon" });
      });
      await page.waitForFunction(() => document.querySelector('[data-test="growth-board"]')?.dataset.art);
      const selection = await page.evaluate(() => {
        const root = document.querySelector('[data-test="growth-board"]'), svg = root.querySelector(".gb-svg"), layer = root.querySelector(".gb-nodes");
        const nodes = [...layer.children], paths = [...svg.children], wallet = root.querySelector('[data-test="board-wallet"]');
        const viewport = root.querySelector('[data-test="board-viewport"]');
        const scroll = [viewport.scrollLeft, viewport.scrollTop];
        const t = performance.now(); for (const n of nodes) n.click();
        return { nodes: nodes.every((n, i) => layer.children[i] === n), paths: paths.every((n, i) => svg.children[i] === n), wallet: root.querySelector('[data-test="board-wallet"]') === wallet,
          scroll: scroll.every((v, i) => [viewport.scrollLeft, viewport.scrollTop][i] === v), selected: root.querySelectorAll(".gb-node.selected").length,
          filters: svg.querySelectorAll("filter, feTurbulence").length, count: nodes.length, elapsed: performance.now() - t };
      });
      assert(selection.nodes && selection.paths && selection.wallet && selection.scroll, JSON.stringify(selection));
      assert.equal(selection.selected, 1); assert.equal(selection.filters, 0);
      console.log(`board selection (${touch ? "touch" : "desktop"}): ${JSON.stringify(selection)}`);
      const node = page.locator('.gb-node[data-status="available"]').first();
      const id = (await node.getAttribute("data-test")).replace("board-node-", "");
      await node.click(); await page.locator('[data-test="board-light"]').click();
      const lit = page.locator(`[data-test="board-node-${id}"]`);
      assert.equal(await lit.getAttribute("data-status"), "pending");
      assert.equal(await lit.locator(".gb-node-state").innerText(), "+");
      assert.match(await lit.getAttribute("class"), /lit-now/);
      await lit.click(); await page.locator('[data-test="board-undo"]').click();
      assert.equal(await lit.locator(".gb-node-state").count(), 0);
      await lit.click(); await page.locator('[data-test="board-light"]').click();
      await page.locator('[data-test="board-decide"]').click();
      await page.evaluate(async id => {
        await visibilityTest.done;
        if (!visibilityTest.core.state.growth.nodes.includes(id)) throw Error("Node not committed");
        visibilityTest.core.save(); visibilityTest.core.load();
        visibilityTest.done = visibilityTest.openBoard();
      }, id);
      await page.locator('[data-test="growth-board"]').waitFor();
      assert.equal(await lit.getAttribute("data-status"), "unlocked");
      assert.equal(await lit.locator(".gb-node-state").innerText(), "✓");
      await assertFits(page, ".gb-footer");
      await page.screenshot({ path: `/tmp/board-lit-${touch ? "touch" : "desktop"}.png` });
      await page.locator('[data-test="board-close"]').click();
      await page.evaluate(() => visibilityTest.done);
    }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : { reducedMotion: "reduce" });
  }
});
