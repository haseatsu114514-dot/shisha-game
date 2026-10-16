// SKIPでも未読込の表情を出さず、CGと場面転換が終わってから次へ進む。
import assert from "node:assert/strict";
import { suite } from "./browser/support.mjs";

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame(); core.config.textSpeed = 4;
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const engine = await import("./js/vn/engine.js");
    const intro = await import("./js/vn/intro.js");
    ["sumi", "adam"].forEach(id => { core.state.met[id] = true; intro.markIntroSeen(id); });
    engine.vnTest.turbo = false;
    ui.clearScreen();
    await ui.setBg(data.bgUrl("bg_tonari_inside"), { instant: true });
    await Promise.all(["sumi", "adam"].map(id => ui.imageReady(data.portraitInfo(id, "normal").src, 15000)));
    window.V = { core, ui, data, engine };
  });
}

await suite("vn-visual-readiness", async (check) => {
  for (const [label, viewport] of [["portrait-pc", { width: 1280, height: 720 }], ["portrait-mobile", { width: 844, height: 390 }]]) {
    await check(label, async page => {
      await prepare(page);
      await page.route("**/chr_sumi_smile.webp", async route => {
        await new Promise(resolve => setTimeout(resolve, 1000));
        await route.continue();
      });
      await page.evaluate(() => {
        window.scene = V.engine.play({ dialogue_id: "slow-expression", lines: [
          { speaker: "sumi", face: "normal", text: "最初の台詞。" },
          { speaker: "adam", face: "normal", text: "次の台詞。" },
          { speaker: "sumi", face: "smile", text: "読み込んでから笑顔を見せる。" },
          { type: "choice", choices: [{ text: "続ける" }] },
        ] });
      });
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "最初の台詞。");
      await page.locator('[data-test="vn-skip"]').click();
      await page.waitForTimeout(180);
      assert.notEqual(await page.locator(".vn-text").textContent(), "読み込んでから笑顔を見せる。", "SKIP reached the delayed expression before it loaded");
      assert.equal(await page.locator('.portrait[data-speaker="sumi"]').evaluate(img => img.complete && img.naturalWidth > 0), true, "The previous portrait disappeared while loading");
      await page.locator('[data-test="choice-0"]').waitFor();
      assert.equal(await page.locator('.portrait[data-speaker="sumi"]').evaluate(img => img.complete && img.naturalWidth > 0 && img.src.endsWith("chr_sumi_smile.webp")), true);
      await page.locator('[data-test="choice-0"]').click();
      await page.evaluate(() => window.scene);
      assert.equal(await page.locator("body.vn-skip").count(), 0, "SKIP remained active after the scene");
    }, { viewport });
  }

  await check("cg-fade-and-choice", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      await V.ui.imageReady(V.data.cgUrl("cg_ch1_sumi_training"), 15000);
      window.audit = { maximum: 0, choiceDuringFade: false, stop: false };
      const sample = () => {
        if (audit.stop) return;
        const cg = document.querySelector(".vn-cg"), opacity = Number(getComputedStyle(cg).opacity);
        if (cg.classList.contains("show")) audit.maximum = Math.max(audit.maximum, opacity);
        if (document.querySelector(".vn-choice") && opacity > .01) audit.choiceDuringFade = true;
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      window.scene = V.engine.play({ dialogue_id: "cg-fade", lines: [
        { speaker: "sumi", text: "写真を見る。" },
        { type: "show_cg", cg_id: "cg_ch1_sumi_training" },
        { speaker: "sumi", text: "写真の後の台詞。" },
        { type: "hide_cg" },
        { type: "choice", choices: [{ text: "続ける" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "写真を見る。");
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator('[data-test="choice-0"]').waitFor();
    await page.waitForTimeout(20);
    const audit = await page.evaluate(() => { audit.stop = true; return window.audit; });
    assert.ok(audit.maximum >= .95, `CG was hidden before the fade completed (${audit.maximum})`);
    assert.equal(audit.choiceDuringFade, false, "Choices appeared during the CG fade-out");
    await page.locator('[data-test="choice-0"]').click();
    await page.evaluate(() => window.scene);
  });

  await check("skip-curtain", async page => {
    await prepare(page);
    await page.evaluate(async () => {
      await V.ui.imageReady(V.data.bgUrl("bg_home"), 15000);
      window.audit = { started: null, ended: null, overlap: false, stop: false };
      const sample = () => {
        if (audit.stop) return;
        const curtain = document.querySelector(".scene-curtain");
        if (curtain) { audit.started ??= performance.now(); if (document.querySelector(".vn-choice")) audit.overlap = true; }
        else if (audit.started !== null) audit.ended ??= performance.now();
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      window.scene = V.engine.play({ dialogue_id: "skip-curtain", lines: [
        { speaker: "sumi", text: "家へ帰る。" },
        { type: "bg", bg: "bg_home" },
        { type: "choice", choices: [{ text: "休む" }] },
      ] });
    });
    await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "家へ帰る。");
    await page.locator('[data-test="vn-skip"]').click();
    await page.locator('[data-test="choice-0"]').waitFor();
    await page.waitForFunction(() => audit.ended !== null);
    const audit = await page.evaluate(() => { audit.stop = true; return window.audit; });
    assert.ok(audit.ended - audit.started >= 250, `The scene curtain was too abrupt (${audit.ended - audit.started}ms)`);
    assert.equal(audit.overlap, false);
    await page.locator('[data-test="choice-0"]').click();
    await page.evaluate(() => window.scene);
  });
});
