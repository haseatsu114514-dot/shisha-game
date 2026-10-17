// 家の一服を実DOMで操作し、葉・体力・能力端数と保存復帰を検証する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
fs.mkdirSync(out, { recursive: true });
const t = id => `[data-test="${id}"]`;
const snapshot = page => page.evaluate(() => {
  const s = __remake.state;
  return structuredClone({ owned: s.owned, equip: s.equip, money: s.money, stats: s.stats,
    statXp: s.statXp, flavorStock: s.flavorStock, stamina: s.stamina, slot: s.slot });
});
async function offer(page) {
  await page.evaluate(async () => {
    __remake.vnTest.turbo = false;
    window.homeDone = null;
    void (await import("./js/daily/home-shisha.js")).runHomeShisha().then(value => { homeDone = value; });
  });
  await page.locator(t("home-shisha-mix")).waitFor();
}

await suite("home-shisha", async check => {
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-mix-recipe-and-reload`, async page => {
      const hit = async id => label === "touch" ? page.locator(t(id)).tap() : page.locator(t(id)).click();
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"), s = core.newGame();
        Object.assign(s, { phase: "daily", day: 8, slot: 2, stamina: 80 });
        s.stats = { technique: 20, sense: 12, guts: 30, charm: 14, insight: 25 };
        s.statXp = {}; s.flavorStock = { lemon: 20, mint: 20 };
        s.flags._ev_midcheck = true;
        core.config.bgmVolume = 0; core.config.voiceBlip = false;
        __remake.vnTest.turbo = true;
        const rig = await import("./js/daily/home-rig.js");
        await rig.giveSumiRig();
        window.secondRigGrant = await rig.giveSumiRig();
        const ui = await import("./js/core/ui.js");
        await ui.bannersIdle();
        ui.showScreen("home", document.createElement("div"));
        await ui.setBg((await import("./js/core/data.js")).bgUrl("bg_home", "night"), { fast: true });
      });
      assert.equal(await page.evaluate(() => secondRigGrant), false);
      const before = await snapshot(page);
      assert.equal(before.owned.filter(id => id === "home_rig_set").length, 1);

      await offer(page); await hit("home-shisha-mix");
      await hit("home-plus-lemon"); await hit("home-mix-cancel"); await hit("home-shisha-skip");
      await page.waitForFunction(() => homeDone === false);
      assert.deepEqual(await snapshot(page), before, "Cancelled mixing must not consume anything");

      await offer(page); await hit("home-shisha-mix");
      for (let n = 0; n < 9; n++) await hit("home-plus-lemon");
      for (let n = 0; n < 2; n++) await hit("home-plus-mint");
      assert(await page.locator(t("home-mix-ok")).isDisabled(), "11g is not a complete bowl");
      await hit("home-plus-mint");
      assert(await page.locator(t("home-mix-ok")).isEnabled());
      assert.equal(await page.locator(t("home-ratio-lemon")).textContent(), "75%");
      assert.equal(await page.locator(t("home-ratio-mint")).textContent(), "25%");
      await assertFits(page, ".home-mix-row button, .home-shisha-dialog .modal-actions button");
      await page.screenshot({ path: `${out}/home-shisha-${label}-mix.png` });
      // 画面操作は実入力。決定後の短い会話だけをturboで送る。
      await page.evaluate(() => { __remake.vnTest.turbo = true; });
      await hit("home-mix-ok"); await page.waitForFunction(() => homeDone === true);
      const after = await snapshot(page);
      assert.deepEqual(after, { ...before, flavorStock: { lemon: 11, mint: 17 }, stamina: 74, statXp: { sense: .5 } });
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.load(); core.save(); core.load();
        window.repeatOffer = (await import("./js/daily/home-shisha.js")).homeShishaOffer();
      });
      assert.deepEqual(await snapshot(page), after, "Reload must preserve the half point and consumption");
      assert.equal(await page.evaluate(() => repeatOffer), null, "Same night cannot be smoked twice after LOAD");

      await page.evaluate(() => { __remake.state.day++; });
      await offer(page); await hit("home-shisha-recipe");
      await page.locator(t("home-recipe-ice_lemonade")).waitFor();
      await assertFits(page, ".home-shisha-dialog .modal-actions button");
      await page.evaluate(() => { __remake.vnTest.turbo = true; });
      await hit("home-recipe-ice_lemonade"); await page.waitForFunction(() => homeDone === true);
      assert.deepEqual(await snapshot(page), { ...after, flavorStock: { lemon: 3, mint: 13 }, stamina: 68,
        stats: { ...before.stats, sense: 13 }, statXp: { sense: 0 } });
    }, options);
  }
});
