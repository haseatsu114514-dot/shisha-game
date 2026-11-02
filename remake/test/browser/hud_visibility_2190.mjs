// #2190 final report 9: hidden HUD controls must leave AX and keyboard navigation.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const viewport = { width: 1180, height: 757 };
const menu = '[data-test="hud-menu"]';
async function prepareHud(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js");
    const hud = await import("./js/daily/hud.js");
    const { el } = await import("./js/core/util.js");
    window.HV = { core, ui, hud, menuCalls: 0 };
    ui.showScreen("map", el("button", { text: "画面内の操作", dataset: { test: "hud-focus-anchor" } }));
    hud.initHud({ menu: () => { HV.menuCalls++; } }); hud.showHud(true);
  });
}
async function assertHiddenHud(page) {
  assert.equal(await page.locator("#hud").getByRole("button").count(), 0, "Invisible HUD controls remain in AX");
  assert.doesNotMatch(await page.locator("#hud").ariaSnapshot(), /button|MENU|LIME|ステータス/);
  const result = await page.locator(menu).evaluate(async button => {
    const stage = document.querySelector("#stage"), before = stage.scrollLeft;
    button.focus(); // The focus attempt must not scroll an invisible control into view.
    await new Promise(requestAnimationFrame);
    return { before, after: stage.scrollLeft, focused: button.closest("#hud").contains(document.activeElement), visibility: getComputedStyle(button).visibility };
  });
  assert.equal(result.visibility, "hidden");
  assert.equal(result.focused, false, "An invisible HUD control accepted focus");
  assert.equal(result.after, result.before, "Focusing hidden MENU shifted the stage");
  assert.equal(result.after, 0, "Stage scrolled sideways");
  for (let n = 0; n < 5; n++) {
    await page.keyboard.press("Tab");
    assert.equal(await page.evaluate(() => document.querySelector("#hud").contains(document.activeElement)), false,
      "Tab reached an invisible HUD control");
  }
}

await suite("hud-visibility-2190", async check => {
  await check("hide-update-direct-class-and-focus-restore", async page => {
    await prepareHud(page);
    assert.equal(await page.locator("#hud").getByRole("button", { name: "MENU", exact: true }).count(), 1);
    await page.locator(menu).focus();
    await page.evaluate(() => { HV.hud.showHud(false); HV.hud.updateHud(); });
    await assertHiddenHud(page);
    // Several chapter/title callers set this class directly instead of showHud().
    await page.evaluate(() => HV.ui.layers.hud.classList.add("show"));
    await page.locator(menu).click();
    assert.equal(await page.evaluate(() => HV.menuCalls), 1);
    await page.evaluate(() => {
      void HV.ui.modal({ title: "フォーカスの復帰", options: [{ label: "閉じる", test: "hud-visibility-close", primary: true }] });
      HV.hud.showHud(false);
    });
    await page.locator('[data-test="hud-visibility-close"]').click();
    await assertHiddenHud(page);
    for (const context of ["vn-open", "in-vn", "bench", "count", "result"]) {
      await page.evaluate(context => {
        HV.hud.showHud(true);
        if (["vn-open", "in-vn"].includes(context)) document.body.classList.add(context);
        else document.body.dataset.screen = context;
      }, context);
      await assertHiddenHud(page);
      await page.evaluate(() => {
        document.body.classList.remove("vn-open", "in-vn"); document.body.dataset.screen = "map";
      });
    }
    await page.locator(menu).click();
    assert.equal(await page.evaluate(() => HV.menuCalls), 2, "Visible HUD did not become usable again");
  }, { viewport });

  await check("production-chapter-vn-menu-stays-available", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), state = core.newGame();
      Object.assign(state, { chapter: 2, day: 28, phase: "tournament" });
      for (const id of ["ageha", "kumicho", "rei", "pakki", "maezono", "dr_kemuri", "nagumo", "hajime", "sumi"]) state.flags[`_intro_${id}`] = true;
      const { tournamentProgress } = await import("./js/chapters/ch2-tournament-state.js");
      tournamentProgress(state).stage = "lobby";
      (await import("./js/chapters/ch1.js")).setupHooks();
      void (await import("./js/chapters/ch2-tournament.js")).runChapterTwoTournament();
    });
    const custom = page.locator('#hud [data-test="ch2-tournament-menu"]');
    await custom.waitFor();
    assert.equal(await page.locator("#hud").getByRole("button", { name: "MENU", exact: true }).count(), 1);
    await custom.focus();
    assert.equal(await custom.evaluate(node => node === document.activeElement), true);
    await page.keyboard.press("Enter");
    await page.locator('[data-test="ch2-tournament-save"]').waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    assert.equal(await custom.evaluate(node => node === document.activeElement), true, "Custom VN menu lost focus restoration");
    assert.equal(await page.locator("#stage").evaluate(node => node.scrollLeft), 0);
  }, { viewport });

  await check("normal-load-to-victory-lobby", async page => {
    await prepareHud(page);
    await page.evaluate(async () => {
      const s = HV.core.state;
      Object.assign(s, { day: 14, phase: "tournament", money: 75813 });
      Object.assign(s.tournament, { victory: { step: 0, revealed: true, paid: true }, lastRank: 1 });
      HV.core.save();
      (await import("./js/scenes/title.js")).showTitle();
    });
    // Production title LOAD keeps the document and its old HUD, matching the report.
    await assertHiddenHud(page);
    await page.locator('[data-test="title-load"]').click();
    await page.locator('[data-test="slot-0"]').click();
    await page.locator("#vn.active").waitFor();
    await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.trim());
    await assertHiddenHud(page);
    assert.equal(await page.evaluate(() => HV.core.state.tournament.victory.step), 0, "LOAD skipped the lobby checkpoint");
  }, { viewport });
});
