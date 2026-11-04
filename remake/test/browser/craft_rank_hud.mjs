// Isolated display preparation. This is not gameplay/scoring or approved-art acceptance.
import assert from "node:assert/strict";
import { suite, baseURL, assertFits } from "./support.mjs";
import { assertCraftProgress } from "./craft_progress_assertions.mjs";

const rects = page => page.locator(".bench-top").evaluate(top => {
  const rect = node => node.getBoundingClientRect().toJSON();
  return { top: rect(top), rank: rect(top.querySelector(".craft-rank")), progress: rect(top.querySelector(".bench-progress")), button: rect(top.querySelector(".bench-appearance-button")) };
});
const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
async function prepare(page, ds = false) {
  await page.evaluate(ds => {
    // Remove only the preview controls so geometry uses the exact gameplay viewport.
    document.querySelector(".rank-preview-tools").hidden = true;
    document.documentElement.style.setProperty("--rank-tools-height", "0px");
    rankPreview.setLayout(ds);
  }, ds);
}

await suite("craft-rank-hud", async check => {
  await check("manual-preview-and-unmeasured", async page => {
    assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), 'unavailable');
    assert.equal(await page.locator('.craft-rank-meter:visible').count(), 0);
    await page.locator('[data-grade="A"]').click();
    assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), 'A');
    assert.match(await page.locator('[data-test="craft-rank-status"]').textContent(), /Aromatic/);
    await page.locator('[data-test="rank-preview-unavailable"]').click();
    assert.match(await page.locator('[data-test="craft-rank-status"]').textContent(), /未計測/);
  });
  for (const [name, options, ds] of [
    ["pc", { viewport: { width: 1280, height: 720 } }, false],
    ["touch-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, false],
    ["ds-portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, true],
    ["ds-small", { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true }, true],
    ["ds-landscape", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) await check(`layout-${name}`, async page => {
    await prepare(page, ds);
    let anchor, phaseAnchor;
    for (const step of ["pack", "heat", "steam", "pull", "serve", "care"]) {
      await page.evaluate(step => { rankPreview.phases.update(step, step); document.querySelector('.bench').dataset.step = step; }, step);
      for (const grade of ["D", "C", "B", "A", "S", "SS", "SSS"]) {
        await page.evaluate(grade => rankPreview.rank.update({ grade, label: grade === "A" ? "Aromatic" : "", progress: .4 }), grade);
        assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), grade === "SSS" ? "100" : "40");
        await assertFits(page, '.craft-rank, .craft-rank-meter');
        await assertCraftProgress(page);
        const layout = await rects(page);
        assert(!overlap(layout.rank, layout.progress), `rank covers phases: ${JSON.stringify(layout)}`);
        assert(!overlap(layout.rank, layout.button), `rank covers appearance button: ${JSON.stringify(layout)}`);
        if (!anchor) { anchor = layout.rank; phaseAnchor = layout.progress; }
        for (const key of ["x", "y", "width", "height"]) assert(Math.abs(layout.progress[key] - phaseAnchor[key]) < 1, `${step}/${grade}: phase header moved`);
        const meterBox = await page.locator('.craft-rank-meter').evaluate(node => node.getBoundingClientRect().toJSON());
        assert(meterBox.height >= 1 && !overlap(meterBox, layout.progress), "meter must stay visible outside phases");
        for (const key of ["x", "y", "width", "height"]) assert(Math.abs(layout.rank[key] - anchor[key]) < 1, `${step}/${grade}: rank moved`);
        const gradeBox = await page.locator(ds || name === 'touch-landscape' ? '.craft-rank-compact .craft-rank-grade' : '.craft-rank-wide .craft-rank-grade').evaluate(node => node.getBoundingClientRect().toJSON());
        assert(gradeBox && gradeBox.left >= layout.rank.left - 1 && gradeBox.right <= layout.rank.right + 1, `grade clipped: ${grade}`);
      }
    }
    assert.equal(await page.locator('.craft-rank').getAttribute('tabindex'), null);
    const intercepts = await page.locator('.craft-rank').evaluate(node => { const r = node.getBoundingClientRect(); return !!document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest('.craft-rank'); });
    assert.equal(intercepts, false, 'Read-only rank must not capture input');
  }, options);
  await check("reduced-motion-and-dispose", async page => {
    await prepare(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { rankPreview.rank.update({ grade: 'D' }); rankPreview.rank.update({ grade: 'SSS' }); });
    assert.equal(await page.locator('.craft-rank').getAttribute('data-change'), null);
    const motion = await page.locator('.craft-rank-wide').evaluate(node => getComputedStyle(node).animationName);
    assert.equal(motion, 'none');
    assert.equal(await page.locator('.craft-rank-wide').evaluate(node => getComputedStyle(node).transform), 'none');
    assert.equal(await page.locator('.craft-rank-meter i').evaluate(node => getComputedStyle(node).transitionDuration), '0s');
    await page.evaluate(() => rankPreview.rank.dispose());
    assert.equal(await page.locator('.craft-rank').count(), 0);
    assert.equal(await page.locator('.bench-mode').textContent(), 'SMOKE CROWN CUP');
    assert.equal(await page.locator('.bench-progress').count(), 1);
    assert.equal(await page.locator('.bench-appearance-button').count(), 1);
  });
  await check("staging-and-motion-preference-change", async page => {
    const changes = await page.evaluate(() => {
      const changes = [];
      for (const grade of ['D', 'SSS', 'S']) {
        rankPreview.rank.update({ grade, progress: .6 });
        changes.push(rankPreview.rank.root.dataset.change);
      }
      return changes;
    });
    assert.deepEqual(changes, ['enter', 'up', 'down']);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('.craft-rank').dataset.change);
    assert.equal(await page.locator('.craft-rank-wide').evaluate(node => getComputedStyle(node).transform), 'none');
    await page.evaluate(() => rankPreview.setLayout(true));
    await assertFits(page, '.craft-rank, .craft-rank-meter');
    const toolsBottom = await page.locator('.rank-preview-tools').evaluate(node => node.getBoundingClientRect().bottom);
    const rankTop = await page.locator('.craft-rank').evaluate(node => node.getBoundingClientRect().top);
    assert(rankTop >= toolsBottom, 'Preview controls must not cover the DS rank');
  });
  await check("preview-slider-and-auto-demo", async page => {
    await page.locator('button[data-grade="S"]').click();
    assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), '60');
    await page.locator('#rank-progress').fill('85');
    await page.locator('#rank-progress').dispatchEvent('input');
    assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), '85');
    await page.locator('[data-test="rank-preview-demo"]').click();
    assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), 'D');
    await page.waitForFunction(() => document.querySelector('.craft-rank').dataset.grade === 'SSS', null, { timeout: 16000 });
    assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), '100');
    assert.equal(await page.locator('[data-test="rank-preview-demo"]').getAttribute('aria-pressed'), 'false');
  });
  await check("resize-keeps-snapshot", async page => {
    await prepare(page, true);
    await page.evaluate(() => rankPreview.rank.update({ grade: 'SSS', progress: .75 }));
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(viewport);
      await page.evaluate(() => rankPreview.resize());
      await assertFits(page, '.craft-rank, .craft-rank-meter');
      assert.equal(await page.locator('.craft-rank').getAttribute('data-grade'), 'SSS');
      assert.equal(await page.locator('.craft-rank-meter').getAttribute('aria-valuenow'), '100');
    }
  });
}, {
  entry: `${baseURL}craft-rank-preview.html`, readySelector: 'body[data-rank-ready="true"]',
  readLoadingComics: false, acknowledgeGrowth: false,
});
