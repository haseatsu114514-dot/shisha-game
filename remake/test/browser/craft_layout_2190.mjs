// #2190 P02/P11/P21: horizontal desktop observations, using current UI/data.
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const viewport = { width: 1180, height: 740 };
const inside = (inner, outer) => inner.left >= outer.left - 1 && inner.right <= outer.right + 1
  && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;

await suite("craft-layout-2190", async check => {
  await check("mix-recipe-and-classic-scrollbar", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      const session = await import("./js/craft/session.js");
      const steps = await import("./js/craft/steps.js");
      window.layoutSession = session;
      window.layoutSteps = steps;
    });
    for (const mode of ["tutorial", "rehearsal"]) {
      await page.evaluate(async mode => {
        window.layoutCS = layoutSession.newSession(mode);
        // The observed first mix is lemon + mint. Use real controls for its quantities.
        layoutCS.orderFlavorIds = ["lemon", "mint"];
        layoutSession.openBench(layoutCS);
        await layoutSession.waitBenchReady(layoutCS);
        window.layoutMixDone = layoutSteps.stepMix(layoutCS);
      }, mode);
      await page.locator('[data-test="mix-plus-lemon"]').waitFor();
      for (const id of ["lemon", "mint"]) {
        for (let n = 0; n < 6; n++) await page.locator(`[data-test="mix-plus-${id}"]`).click();
      }
      assert.match(await page.locator(".recipe-line").textContent(), /氷レモネード/);
      // Reserve the scrollbar width even on hosts using overlay scrollbars.
      await page.locator(".mix-side").evaluate(node => { node.style.scrollbarGutter = "stable"; });
      const layout = await page.locator(".mix-side").evaluate(side => {
        const recipe = side.querySelector(".recipe-line");
        const s = side.getBoundingClientRect(), r = recipe.getBoundingClientRect();
        return { side: s.toJSON(), recipe: r.toJSON(), scrollWidth: side.scrollWidth, clientWidth: side.clientWidth, scrollTop: side.scrollTop };
      });
      assert.equal(layout.scrollTop, 0);
      assert(layout.scrollWidth <= layout.clientWidth + 1, `${mode}: sideways overflow ${JSON.stringify(layout)}`);
      assert(inside(layout.recipe, layout.side), `${mode}: detected recipe hidden ${JSON.stringify(layout)}`);
      // Longer explanation remains reachable; fixing the recipe must not disable its scroll.
      await page.locator('.mix-taste [data-test="mix-mastery-summary"]').click();
      await page.locator(".mix-side").evaluate(node => { node.scrollTop = node.scrollHeight; });
      const explanation = await page.locator(".mix-taste .flavor-guide-more p").last().evaluate(node => {
        const r = node.getBoundingClientRect(), s = node.closest(".mix-side").getBoundingClientRect();
        return { text: node.textContent, rect: r.toJSON(), scroller: s.toJSON() };
      });
      assert.match(explanation.text, /葉の基本情報は最初から/);
      assert(inside(explanation.rect, explanation.scroller), `${mode}: last explanation unreachable`);
      await page.locator('[data-test="mix-ok"]').click();
      await page.evaluate(() => window.layoutMixDone);
    }
  }, { viewport });

  await check("result-full-flavor-body", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      const session = await import("./js/craft/session.js");
      const common = await import("./js/craft/common.js");
      const { actualExpressionCard } = await import("./js/craft/flavor-guide.js");
      const cs = session.newSession("tournament");
      Object.assign(cs, { mix: { lemon: 6, mint: 6 }, water: .5, pull: { score: 90, temp: .54, pulls: 5 } });
      session.openBench(cs); await session.waitBenchReady(cs);
      const panel = session.stepPanel("pull", "提供", "提供の温度を見よう");
      window.layoutResultDone = false;
      void common.resultCard(panel, {
        title: "提供", summary: ["お客さんへシーシャを提供した。しばらく吸ってもらおう"],
        lines: ["適温で、味の表情を整えて提供できた", actualExpressionCard(cs, .54), "水量は標準、吸いやすい重さ", "5回吸った"],
      }).then(() => { window.layoutResultDone = true; });
    });
    const details = page.locator('[data-test="step-details"]');
    await details.focus(); await page.keyboard.press("Enter");
    await assertFits(page, ".rc-details .rc-lines, .rc-details .rc-lines > li, .rc-details .flavor-axis, [data-test='step-next']");
    const layout = await page.locator(".rc-lines").evaluate(list => {
      const right = list.closest(".bench-right").getBoundingClientRect();
      const points = [...list.querySelectorAll("li")].map(node => {
        const r = node.getBoundingClientRect(), x = r.left + 2, y = r.bottom - 2;
        return { visible: node.contains(document.elementFromPoint(x, y)), rect: r.toJSON() };
      });
      return { right: right.toJSON(), points };
    });
    for (const point of layout.points) {
      assert(inside(point.rect, layout.right) && point.visible, `Result text covered ${JSON.stringify(point)}`);
    }
    const snapshot = await page.locator(".rc-details").ariaSnapshot();
    assert.match(snapshot, /listitem: 5回吸った/);
    assert.match(snapshot, /今回の仕上がり/);
    assert.match(snapshot, /meter.*甘い印象/);
    await page.locator('[data-test="step-next"]').click();
    await page.waitForFunction(() => window.layoutResultDone);
  }, { viewport });

  await check("status-selected-explanation", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const state = core.newGame(); state.recipes.ice_lemonade = { day: 1 };
      const status = await import("./js/daily/status.js"); void status.openStatus();
    });
    for (const [key, label] of [["technique", "技術"], ["sense", "センス"], ["guts", "根性"], ["charm", "魅力"], ["insight", "洞察"]]) {
      await page.locator(`[data-test="st-${key}"]`).click();
      const layout = await page.locator(".st-note").evaluate(note => ({
        rect: note.getBoundingClientRect().toJSON(), body: note.closest(".modal-body").getBoundingClientRect().toJSON(),
        selected: note.textContent, visible: note.contains(document.elementFromPoint(note.getBoundingClientRect().left + 5, note.getBoundingClientRect().top + 5)),
      }));
      assert(layout.selected.startsWith(`【${label}】`) && layout.selected.length > label.length + 2,
        `${key}: wrong selected explanation ${layout.selected}`);
      assert(inside(layout.rect, layout.body) && layout.visible, `Selected explanation clipped ${JSON.stringify(layout)}`);
    }
    await page.locator('.st-tab[data-tab="items"]').click();
    const itemNotes = await page.locator(".st-items .st-note").evaluateAll(notes => notes.map(note => getComputedStyle(note).position));
    assert(itemNotes.length >= 2, "Missing item and recipe-book notes");
    assert(itemNotes.every(position => position === "static"), "Other status-tab notes must remain in normal flow");
    await page.locator('[data-test="recipe-ice_lemonade"]').click();
    assert.equal(await page.locator(".recipe-detail .st-note").evaluate(note => getComputedStyle(note).position), "static",
      "The recipe detail note must remain in normal flow");
    await page.locator('[data-test="recipe-back"]').click();
    await assertFits(page, '[data-test="status-close"]');
    await page.locator('[data-test="status-close"]').click();
    assert.equal(await page.locator(".status-modal").count(), 0);
  }, { viewport });
});
