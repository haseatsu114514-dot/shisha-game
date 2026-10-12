// Issue 360 Set C: actual show_cg commands, gallery IDs, slow loading and save protection.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, storageSnapshot, assertFits } from "./browser/support.mjs";

const cases = [
  ["cg_ch1_sumi_training", "ch1_day5_sumi_story"],
  ["cg_ch1_tsumugi_heart_art", "ch1_tsumugi_fifth"],
  ["cg_ch1_minto_casual_reveal", "ch1_minto_fifth"],
  ["cg_ch1_dr_kemuri_hook", "ch1_tournament_after"],
  ["cg_ch1_tournament_battle", "ch1_tournament_match"],
  ["cg_ch1_nagumo_smile", "ch1_tournament_reveal"],
  ["cg_oneesan_first_smoke", "ch1_tutorial_oneesan"],
  ["cg_minto_casual", "outing_minto_1"],
  ["cg_tsumugi_smoke_color", "ch1_tsumugi_smoke_color"],
];
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/ch1-cg-art");
const withoutGallery = value => ({ ...value, local: Object.fromEntries(Object.entries(value.local).filter(([key]) => key !== "suien_remake_gallery")) });

async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
    const ui = await import("./js/core/ui.js"), engine = await import("./js/vn/engine.js");
    const gallery = await import("./js/scenes/gallery.js");
    core.newGame(); core.save(); core.config.textSpeed = 4;
    for (const id of ["hajime", "sumi", "tsumugi", "minto", "naru", "adam", "nagumo", "dr_kemuri", "oneesan"]) {
      core.state.met[id] = true; core.state.flags[`_intro_${id}`] = true;
    }
    core.state.flags._minto_identity_revealed = true;
    ui.clearScreen(); engine.vnTest.turbo = false; engine.hooks.onCg = gallery.recordCg;
    window.C = { core, data, ui, engine, gallery };
  });
}

async function showFixture(page, id, dialogue) {
  return page.evaluate(async ({ id, dialogue }) => {
    const original = C.data.DB.dialogues[dialogue];
    const index = original.lines.findIndex(line => line.type === "show_cg" && line.cg_id === id);
    if (index < 0) throw new Error(`Missing canonical CG command: ${dialogue}/${id}`);
    const line = original.lines.slice(index + 1).find(item => item.text);
    const url = C.data.cgUrl(id), image = new Image(); image.src = url;
    const start = performance.now(); await image.decode();
    const bg = original.metadata?.bg || "bg_tonari_inside_night";
    await C.ui.setBg(C.data.bgUrl(bg), { instant: true });
    // Rendering fixture uses an actual command and next spoken/narration line, without event rewards.
    window.cgScene = C.engine.play({ dialogue_id: `cg-art-${id}`,
      metadata: { private_scene: original.metadata?.private_scene },
      lines: [original.lines[index], line, { type: "hide_cg" }, { type: "choice", choices: [{ text: "続ける" }] }] });
    return { url, dimensions: [image.naturalWidth, image.naturalHeight], decodeMs: performance.now() - start, text: line.text };
  }, { id, dialogue });
}

await suite("ch1-cg-art", async check => {
  fs.mkdirSync(artifacts, { recursive: true });
  for (const [device, viewport] of [["pc", { width: 1920, height: 1080 }], ["touch", { width: 844, height: 390 }]]) {
    const options = { viewport, ...(device === "touch" ? { isMobile: true, hasTouch: true } : {}) };
    for (const [id, dialogue] of cases) await check(`${device}-${id}`, async page => {
      await prepare(page); const saved = withoutGallery(await storageSnapshot(page));
      const result = await showFixture(page, id, dialogue);
      assert.equal(result.url, `img/cgs/${id}.webp`);
      assert.deepEqual(result.dimensions, [1920, 1080]);
      await page.waitForFunction(id => document.querySelector(".vn-cg.show")?.dataset.cg === id
        && Number(getComputedStyle(document.querySelector(".vn-cg")).opacity) >= .99
        && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99
        && document.querySelector(".vn-text")?.textContent.length > 0, id);
      await assertFits(page, ".vn-text");
      await page.screenshot({ path: path.join(artifacts, `${device}-${id}-vn.png`) });
      assert.deepEqual(withoutGallery(await storageSnapshot(page)), saved, "Showing CG modified persisted game state");
      assert.equal(await page.evaluate(id => JSON.parse(localStorage.getItem("suien_remake_gallery")).includes(id), id), true);
      await page.locator('[data-test="vn-skip"]').click();
      await page.locator('[data-test="choice-0"]').click(); await page.evaluate(() => window.cgScene);
      await page.evaluate(() => { void C.gallery.openGallery(); });
      await page.locator(`[data-test="gal-${id}"]`).click();
      assert.match(await page.locator(".gal-viewer.show").evaluate(node => node.style.backgroundImage), new RegExp(`${id}\\.webp`));
      assert.equal(await page.locator(`[data-test="gal-${id}"] img`).evaluate(im => im.complete && im.naturalWidth === 1920), true);
      assert.deepEqual(withoutGallery(await storageSnapshot(page)), saved, "Gallery modified game save");
    }, options);

    await check(`${device}-delayed-new-cg`, async page => {
      await prepare(page);
      await page.route("**/cg_oneesan_first_smoke.webp", async route => {
        await new Promise(resolve => setTimeout(resolve, 1100)); await route.continue();
      });
      await page.evaluate(() => {
        window.cgAudit = { maxOpacity: 0, stop: false };
        const sample = () => {
          if (cgAudit.stop) return;
          const node = document.querySelector(".vn-cg");
          if (node?.classList.contains("show")) cgAudit.maxOpacity = Math.max(cgAudit.maxOpacity, Number(getComputedStyle(node).opacity));
          requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
        window.cgScene = C.engine.play({ dialogue_id: "delayed-new-cg", lines: [
          { text: "一台を見せる。" }, { type: "show_cg", cg_id: "cg_oneesan_first_smoke" },
          { text: "読み込んでから味わう。" }, { type: "hide_cg" },
          { type: "choice", choices: [{ text: "続ける" }] },
        ] });
      });
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "一台を見せる。");
      await page.locator('[data-test="vn-skip"]').click(); await page.waitForTimeout(200);
      assert.notEqual(await page.locator(".vn-text").textContent(), "読み込んでから味わう。");
      await page.locator('[data-test="choice-0"]').waitFor();
      const audit = await page.evaluate(() => { cgAudit.stop = true; return cgAudit; });
      assert.ok(audit.maxOpacity >= .95, "New CG was skipped before fully displayed");
      await page.locator('[data-test="choice-0"]').click(); await page.evaluate(() => window.cgScene);
    }, options);
  }

  await check("unused-placeholder-still-excluded", async page => {
    const result = await page.evaluate(async () => {
      const data = await import("./js/core/data.js");
      return ["cg_ch1_sumi_secret", "cg_ch1_tournament_tension"].map(data.cgUrl);
    }); assert.deepEqual(result, [null, null]);
  });
  await check("touch-portrait-rotation", async page => {
    await prepare(page); await showFixture(page, "cg_oneesan_first_smoke", "ch1_tutorial_oneesan");
    await page.waitForFunction(() => document.querySelector(".vn-cg.show")?.dataset.cg === "cg_oneesan_first_smoke"
      && Number(getComputedStyle(document.querySelector(".vn-cg")).opacity) >= .99
      && Number(getComputedStyle(document.getElementById("vn")).opacity) >= .99
      && document.querySelector(".vn-text")?.textContent.length > 0);
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(150);
    await assertFits(page, ".vn-text");
    await page.screenshot({ path: path.join(artifacts, "touch-portrait-first-smoke-vn.png") });
    await page.setViewportSize({ width: 844, height: 390 }); await assertFits(page, ".vn-text");
    assert.equal(await page.locator(".vn-cg.show").getAttribute("data-cg"), "cg_oneesan_first_smoke");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
});
