// 素材・予想・実際の味を読み分け、初心者も基本情報を開けることを実画面で確認する。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setupMix(page, mastered = false) {
  await page.evaluate(async mastered => {
    const core = await import("./js/core/state.js"), session = await import("./js/craft/session.js");
    const steps = await import("./js/craft/steps.js"), ui = await import("./js/core/ui.js");
    const s = core.newGame();
    s.flavorStock = { lemon: 50, mint: 50, double_apple: 50 };
    s.flavors = Object.keys(s.flavorStock);
    s.flavorMastery = mastered ? { lemon: 60, mint: 60, double_apple: 60 } : {};
    const cs = session.newSession("drill");
    await session.openBench(cs).ready;
    window.FE = { core, session, steps, ui, cs, run: steps.stepMix(cs) };
  }, mastered);
  await page.locator('[data-test="flavor-info-mint"]').waitFor();
}

async function add(page, id, grams) {
  for (let i = 0; i < grams; i++) await page.locator(`[data-test="mix-plus-${id}"]`).click();
}

async function forecast(page) {
  const compact = page.locator('[data-test="mix-taste-compact"]');
  const host = await compact.isVisible() ? compact : page.locator('[data-test="mix-taste"]');
  const details = host.locator(".flavor-forecast-compact");
  if (await details.count() && !await details.evaluate(node => node.open)) await details.locator(":scope > summary").click();
  return host.locator('[data-test="mix-forecast"]');
}

async function readRanges(card) {
  return card.locator('[role="meter"]').evaluateAll(nodes => nodes.map(node => ({
    label: node.getAttribute("aria-label"), text: node.getAttribute("aria-valuetext"),
    low: parseFloat(node.style.getPropertyValue("--axis-low")),
    high: parseFloat(node.style.getPropertyValue("--axis-high")),
  })));
}

async function feature(page, closeTest) {
  const card = page.locator('[data-test="flavor-feature-card"]');
  await card.waitFor();
  const bars = await card.locator('[role="meter"]').evaluateAll(nodes => nodes.map(node => ({
    label: node.getAttribute("aria-label"), text: node.getAttribute("aria-valuetext"),
    value: Number(node.getAttribute("aria-valuenow")),
  })));
  assert.deepEqual(bars.map(bar => bar.label), ["香りの主張", "清涼感", "酸味"]);
  assert(bars.every(bar => bar.value >= 0 && bar.value <= 10 && /10・/.test(bar.text)));
  assert.match(await card.innerText(), /品質点ではありません/);
  assert.equal(await card.locator(".flavor-guide-more").evaluate(node => node.open), false, "Long explanations start collapsed");
  await assertFits(page, '[data-test="flavor-feature-card"] .flavor-axis');
  await assertFits(page, `[data-test="${closeTest}"]`);
  await page.locator(`[data-test="${closeTest}"]`).click();
  return bars;
}

await suite("flavor-expression", async check => {
  for (const [platform, options] of [["desktop", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`features-and-forecast-${platform}`, async page => {
      await setupMix(page);
      assert.match(await page.locator('[data-flavor="mint"] .fr-mastery').innerText(), /熟練度 ★☆☆☆☆/);
      const before = await page.evaluate(() => JSON.stringify(FE.core.state));
      await page.locator('[data-test="flavor-info-mint"]').click();
      await feature(page, "flavor-info-close");
      assert.equal(await page.evaluate(() => JSON.stringify(FE.core.state)), before, "Reading basic stats neither spends leaves nor requires mastery");

      await add(page, "mint", 1);
      const mintOnly = await readRanges(await forecast(page));
      await add(page, "lemon", 11);
      const noviceCard = await forecast(page), novice = await readRanges(noviceCard);
      assert.equal(novice.length, 3);
      assert.deepEqual(novice.map(axis => axis.label), ["甘い印象", "清涼感", "煙の厚み"]);
      assert(novice.every(axis => /予想/.test(axis.text) && axis.low < axis.high));
      assert.notDeepEqual(novice, mintOnly, "Real gram controls update the blended forecast");
      assert.match(await noviceCard.innerText(), /仕上がりの目安/);
      assert.match(await noviceCard.innerText(), /低め/);
      assert.match(await noviceCard.innerText(), /高め/);
      assert.match(await noviceCard.innerText(), /予想幅：広い/);
      assert.equal(await noviceCard.getAttribute("data-expressive"), "true");
      assert(await noviceCard.locator('[role="meter"]').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().width >= 48)), "Forecast bars need enough visible width to compare their ranges");
      await noviceCard.locator(".flavor-axes").scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="mix-forecast"]:visible .flavor-axis');
      await page.locator('[data-test="mix-ok"]').scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="mix-ok"]');

      await setupMix(page, true);
      await add(page, "mint", 1); await add(page, "lemon", 11);
      const masteredCard = await forecast(page), mastered = await readRanges(masteredCard);
      assert.match(await masteredCard.innerText(), /予想幅：絞れる/);
      assert(mastered.every((axis, i) => axis.high - axis.low < novice[i].high - novice[i].low), "Mastery narrows uncertainty for the same blend");
      assert(mastered.every(axis => axis.high > axis.low), "Even mastery leaves room for different heat expressions");
      await page.locator('[data-test="flavor-info-mint"]').click();
      await feature(page, "flavor-info-close");
    }, { reducedMotion: "reduce", ...options });

    await check(`shop-basic-stats-${platform}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), shop = await import("./js/daily/shop.js");
        const ui = await import("./js/core/ui.js"), hud = await import("./js/daily/hud.js");
        const s = core.newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 0, money: 12800, stamina: 100 });
        ui.clearScreen(); hud.initHud({}); hud.showHud();
        window.FE = { core, run: shop.openShop() };
      });
      await page.locator('[data-test="shop-enter"]').click();
      await page.locator('[data-test="detail-mint"]').click();
      const before = await page.evaluate(() => JSON.stringify(FE.core.state));
      await feature(page, "shop-detail-close");
      assert.equal(await page.evaluate(() => JSON.stringify(FE.core.state)), before);
      assert.match(await page.locator('[data-test="detail-mint"] .shop-feature-tags').innerText(), /清涼/);
      await page.locator('[data-tab="equip"]').click();
      await page.locator('[data-test="detail-flat_charcoal"]').click();
      const gear = page.locator(".shop-detail .equipment-guide");
      assert.match(await gear.innerText(), /得意/); assert.match(await gear.innerText(), /注意/);
      assert.equal(await gear.locator("details").evaluate(node => node.open), false);
      await gear.locator("summary").click();
      assert.match(await gear.innerText(), /3個の加熱/);
      await page.locator('[data-test="shop-detail-close"]').click();
    }, { reducedMotion: "reduce", ...options });

    await check(`actual-and-review-${platform}`, async page => {
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), session = await import("./js/craft/session.js");
        const result = await import("./js/craft/result.js"), score = await import("./js/craft/score.js");
        const model = await import("./js/craft/temperature-model.js");
        core.newGame();
        const cs = session.newSession("tournament");
        cs.mix = { mint: 12 }; cs.mixInfo = { total: 12, score: 80, intensity: 5 }; cs.pack = "normal"; cs.water = 0.5;
        const bands = model.temperatureBands(cs), low = bands.ideal[0] + .02;
        cs.holes = { total: 24, outerEven: .9, innerExcess: 0, score: 90 };
        cs.heat = { heatPower: 50, heatStability: 75, aromaRetention: 75, burnRisk: 15, score: 85 };
        cs.steam = { seconds: 300, score: 80 };
        cs.pull = { temp: low, pulls: 2, score: 100 }; cs.pullDone = true;
        cs.careHistory = [{ temp: bands.center, pulls: 1, score: 100 }, { temp: bands.ideal[0] - .04, pulls: 1, score: 50 }];
        score.finalize(cs);
        window.FE = { cs, run: result.resultTable(cs, 3) };
      });
      const actual = page.locator('[data-test="actual-flavor"]');
      await actual.waitFor();
      assert.equal(await actual.getAttribute("data-zone"), "low", "Result describes the actual first serving, not the later cold adjustment");
      assert.match(await actual.innerText(), /今回の仕上がり/);
      assert.match(await actual.innerText(), /強さと品質は別/);
      assert.equal(await actual.locator(".is-forecast").count(), 0, "Actual bars use a solid value rather than a prediction interval");
      assert.equal(await actual.locator('[role="meter"]').count(), 3);
      assert(!/予想/.test(await actual.innerText()));
      assert.match(await page.locator('[data-test="result-good-point"]').innerText(), /適温に整えて提供/);
      assert.match(await page.locator(".rt-next-tip").innerText(), /調整2回目は少し熱を戻して/);
      await actual.scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="actual-flavor"] .flavor-axis');
      await page.locator(".rt-next-tip").scrollIntoViewIfNeeded();
      await assertFits(page, '.rt-next-tip');
      await page.locator('[data-test="result-next"]').scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="result-next"]');
      assert.equal(await page.evaluate(() => {
        const tip = document.querySelector(".rt-next-tip").getBoundingClientRect();
        const button = document.querySelector('[data-test="result-next"]').getBoundingClientRect();
        return tip.left < button.right && tip.right > button.left && tip.top < button.bottom && tip.bottom > button.top;
      }), false, "The next-action button must not cover the advice");
    }, { reducedMotion: "reduce", ...options });
  }

  await check("compact-forecast-ds-touch", async page => {
    await page.evaluate(async () => {
      const { TITLE_LAYOUT_KEY } = await import("./js/scenes/title-layout.js");
      localStorage.setItem(TITLE_LAYOUT_KEY, "ds");
      window.dispatchEvent(new Event("display-layout-change"));
    });
    await setupMix(page);
    await page.locator("body.game-ds").waitFor();
    await add(page, "mint", 12);
    await assertFits(page, '.mix-temperature-preview .mix-temperature-legend, .mix-temperature-preview > small:visible');
    const compact = page.locator('[data-test="mix-taste-compact"]');
    assert(await compact.isVisible());
    assert.equal(await compact.locator(".flavor-forecast-compact").evaluate(node => node.open), false);
    const card = await forecast(page);
    assert.equal((await readRanges(card)).length, 3);
    await card.locator(".flavor-axes").scrollIntoViewIfNeeded();
    await assertFits(page, '[data-test="mix-taste-compact"] .flavor-axis');
    await page.locator('[data-test="mix-minus-mint"]').click();
    assert.equal(await compact.locator(".flavor-forecast-compact").evaluate(node => node.open), true, "Changing grams preserves the expanded preview");
    await page.locator('[data-test="flavor-info-mint"]').click();
    await feature(page, "flavor-info-close");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
});
