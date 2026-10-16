// #308: same-background dialogue loading, input protection, legacy saves and timeout recovery.
import assert from "node:assert/strict";
import { suite, storageSnapshot } from "./support.mjs";

async function prepare(page, legacy = false) {
  await page.evaluate(async legacy => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.state.flags._qa_preserved = true;
    if (legacy) {
      const old = JSON.parse(JSON.stringify(core.state)); old.schema = 5;
      delete old.relationshipMemories; delete old.statXp;
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(old)); core.load();
    }
    const engine = await import("./js/vn/engine.js"), ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const ch1 = await import("./js/chapters/ch1.js"); ch1.setupHooks();
    engine.vnTest.turbo = true;
    await ui.setBg(data.bgUrl("bg_tonari_inside"), { instant: true });
    await engine.play("remake_tutorial_result");
    engine.vnTest.turbo = false; core.config.textSpeed = 4;
    engine.backlog().length = 0;
    window.V = { core, engine, ui, data };
  }, legacy);
}

await suite("tutorial-transition", async check => {
  for (const [name, legacy, options] of [
    ["slow-pc-new-save", false, {}],
    ["slow-mobile-legacy-save", true, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(name, async page => {
      await prepare(page, legacy);
      const before = await storageSnapshot(page);
      await page.route("**/chr_minto_ura_normal.webp", async route => {
        const response = await route.fetch();
        await new Promise(resolve => setTimeout(resolve, 1800));
        await route.fulfill({ response });
      });
      await page.evaluate(() => { window.scene = V.engine.play("ch1_tutorial_oneesan"); });
      const loading = page.locator('[data-test="vn-loading"]');
      await loading.waitFor();
      assert.equal(await loading.getAttribute("role"), "status");
      assert.match(await loading.textContent(), /準備/);
      await page.keyboard.press("Enter"); await page.mouse.click(640, 500);
      assert.deepEqual(await page.evaluate(() => V.engine.backlog()), [], "Input skipped the pending scene");
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent.includes("ドアが開き"));
      await loading.waitFor({ state: "detached" });
      assert(await page.locator('.portrait[data-speaker="oneesan"]').evaluate(img => img.complete && img.naturalWidth > 0));
      assert.deepEqual(await storageSnapshot(page), before, "Loading changed persisted saves");
      assert(await page.evaluate(() => V.core.state.flags._qa_preserved));
      await page.evaluate(() => { V.engine.vnTest.turbo = true; document.querySelector('[data-test="vn-skip"]').click(); });
      await page.evaluate(() => window.scene);
      assert(await page.evaluate(() => V.core.state.flags._oneesan_id_checked));
      assert.equal(await page.locator('[data-test="vn-loading"]').count(), 0);
    }, options);
  }

  await check("image-deadline-and-late-recovery", async page => {
    await prepare(page);
    await page.route("**/chr_minto_ura_normal.webp?qa=*", async route => {
      const response = await route.fetch();
      await new Promise(resolve => setTimeout(resolve, 650));
      await route.fulfill({ response });
    });
    const result = await page.evaluate(async () => {
      const url = V.data.portraitInfo("oneesan", "ura_normal").src + "?qa=deadline";
      const first = await V.ui.imageReady(url, 120);
      const start = performance.now(), second = await V.ui.imageReady(url, 120), repeatedWait = performance.now() - start;
      // A larger budget is still allowed; once the original request loads, all callers see it.
      const recovered = await V.ui.imageReady(url, 1500);
      const cached = await V.ui.imageReady(url, 120);
      return { first, second, repeatedWait, recovered, cached };
    });
    assert.equal(result.first, false); assert.equal(result.second, false);
    assert(result.repeatedWait < 80, `Repeated the exhausted image wait: ${JSON.stringify(result)}`);
    assert(result.recovered && result.cached, JSON.stringify(result));
  });
});
