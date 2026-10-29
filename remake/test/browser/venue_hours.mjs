import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const t = id => `[data-test="${id}"]`;
async function hit(page, id) {
  const button = page.locator(t(id));
  if (await page.evaluate(() => matchMedia("(pointer:coarse)").matches)) await button.tap(); else await button.click();
}
async function setup(page, { chapter = 1, slot = 0 } = {}) {
  await page.evaluate(async ({ chapter, slot }) => {
    window.V = { core: await import("./js/core/state.js"), data: await import("./js/core/data.js"),
      ui: await import("./js/core/ui.js"), shop: await import("./js/daily/shop.js"),
      spots: await import("./js/daily/spots.js"), access: await import("./js/daily/spot-access.js"),
      vn: await import("./js/vn/engine.js"), hud: await import("./js/daily/hud.js") };
    const s = V.core.newGame();
    Object.assign(s, { chapter, slot, day: chapter === 1 ? 5 : 16, phase: "daily", money: 15000, stamina: 80 });
    Object.assign(s.met, { naru: true, adam: true, minto: true });
    // #577: 営業時間と店主UIを検査するため、噂・実目撃を完読済みの保存を使う。
    // 未発見のロック／目撃の中断・無報酬はaxe_bar_discovery.mjsの専用回帰で検査する。
    // #780: 喫茶店は紹介フラグ後に解放される。ロック判定は別途 axe_bar_discovery で検査する。
    Object.assign(s.flags, { _cafe_introduced: true, _axe_bar_rumor_done: true, _axe_bar_sighting_done: true,
      _intro_maki: true, _intro_sai: true, // 初登場はrecent_introsで検査。ここは来店後の案内・消費なしを検査する。
      _axe_bar_sighting_day: s.day - 1, _axe_bar_sighting_chapter: chapter,
      _gym_member: true, _ch2_day1: { startDay: 15, stage: "complete" },
      _spot_guide_naru: true, _spot_guide_adam: true, _spot_guide_minto: true });
    s.flags._rei_trpg_introduced = true; V.vn.vnTest.turbo = true; V.core.config.textSpeed = 4; V.core.config.bgmVolume = 0;
    (await import("./js/chapters/ch1.js")).setupHooks();
    V.ui.clearScreen(); V.hud.initHud({}); V.hud.showHud();
    V.openCafe = async () => {
      V.result = null; (await import("./js/daily/trpg.js")).openTrpgBar().then(result => { V.result = result; });
    };
    V.openAxe = async () => {
      V.result = null; (await import("./js/daily/axe-bar.js")).visitAxeBar().then(result => { V.result = result; });
    };
  }, { chapter, slot });
}
const snapshot = page => page.evaluate(() => JSON.stringify(V.core.state));
const portraitReady = (page, id) => page.waitForFunction(id => {
  const img = document.querySelector(`[data-test="venue-host-${id}"] img`);
  return img?.complete && img.naturalWidth > 0;
}, id);

await suite("venue-hours", async runCheck => {
  const check = (name, ...args) => !process.env.CASE_FILTER || name.includes(process.env.CASE_FILTER) ? runCheck(name, ...args) : Promise.resolve();
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(label + "-day-map-and-entry-guards", async page => {
      await setup(page); const before = await snapshot(page);
      const blocked = await page.evaluate(async () => ({
        axe: await (await import("./js/daily/axe-bar.js")).visitAxeBar(),
        rin: await V.shop.visitRin(),
        axeMap: V.access.spotAvailability(V.spots.spotById("axe_bar")),
        cafe: V.access.spotAvailability(V.spots.spotById("cafe")),
      }));
      assert.equal(blocked.axe, false); assert.equal(blocked.rin, false);
      assert(!blocked.axeMap.ok && blocked.cafe.ok); assert.match(blocked.axeMap.why, /夜/);
      assert.equal(await snapshot(page), before);
      await page.evaluate(async () => { void (await import("./js/daily/map.js")).chooseSpot(); });
      await hit(page, "pin-axe_bar");
      assert.equal(await page.locator(t("map-go")).count(), 0);
      assert.match(await page.locator(".mi-no").innerText(), /夜/);
      await assertFits(page, ".mi-no");
    }, options);

    await check(label + "-night-maki-and-day-cafe-closed", async page => {
      await setup(page, { slot: 1 }); const before = await snapshot(page);
      const unavailable = await page.evaluate(async () => ({
        access: V.access.spotAvailability(V.spots.spotById("cafe")),
        visit: await V.spots.visitSpot(V.spots.spotById("cafe")),
      }));
      assert(!unavailable.access.ok); assert.equal(unavailable.visit, false);
      assert.equal(await snapshot(page), before);
      await page.evaluate(() => V.openAxe()); await portraitReady(page, "maki");
      assert.match(await page.locator(t("venue-host-maki")).innerText(), /斧崎マキ/);
      await assertFits(page, ".venue-host, .axe-bar-menu button");
      assert.equal(await snapshot(page), before);
    }, options);

    await check(label + "-sai-free-trial-stop-bust-and-return", async page => {
      await setup(page, { chapter: 2 }); await page.evaluate(() => V.openCafe());
      await portraitReady(page, "sai"); await page.locator(t("trpg-trial-open")).waitFor();
      const before = await snapshot(page);
      await hit(page, "trpg-trial-open");
      assert(await page.locator(t("trpg-trial-stop")).isDisabled());
      await page.evaluate(() => { Math.random = () => .999; });
      await hit(page, "trpg-trial-roll"); await hit(page, "trpg-trial-stop");
      assert.match(await page.locator(t("trpg-trial-total")).innerText(), /6 \/ 7/);
      assert(await page.locator(t("trpg-trial-roll")).isDisabled());
      assert.equal(await snapshot(page), before);
      await hit(page, "trpg-trial-back"); await hit(page, "trpg-trial-open");
      await hit(page, "trpg-trial-roll"); await hit(page, "trpg-trial-roll");
      assert.match(await page.locator(t("venue-host-line")).innerText(), /越えましたね/);
      await assertFits(page, ".venue-host, .trpg-trial-actions button");
      assert.equal(await snapshot(page), before);
      await hit(page, "trpg-trial-back"); await hit(page, "trpg-club-choice-time");
      assert(await page.evaluate(() => !!V.core.state.trpg.club.founded));
      await hit(page, "trpg-trial-open");
    }, options);
  }

  await check("rin-night-floor-and-day-shopping", async page => {
    await setup(page);
    await page.evaluate(() => { V.shop.openShop().then(r => { V.destination = r; }); });
    assert(await page.locator(t("shop-upstairs")).isDisabled());
    assert.match(await page.locator(".showroom").innerText(), /夜/);
    await hit(page, "shop-enter"); await page.locator(".shop-tabs").waitFor();
    const before = await snapshot(page);
    await hit(page, "shop-leave"); assert.equal(await snapshot(page), before);
    await page.evaluate(() => { V.core.state.slot = 1; V.destination = null; V.shop.openShop().then(r => { V.destination = r; }); });
    assert(!await page.locator(t("shop-upstairs")).isDisabled());
    await hit(page, "shop-upstairs"); await page.waitForFunction(() => V.destination === "rin");
    assert(await page.evaluate(() => V.shop.visitRin()));
    assert.equal(await page.evaluate(() => V.core.state.stamina), 66);
    const after = await snapshot(page);
    assert.equal(await page.evaluate(() => V.shop.visitRin()), false);
    assert.equal(await snapshot(page), after);
  });

  await check("night-cafe-has-no-free-day-trial", async page => {
    await setup(page, { chapter: 2, slot: 1 }); await page.evaluate(() => V.openCafe());
    await portraitReady(page, "sai"); await page.locator(t("trpg-club-choice-time")).waitFor();
    assert.equal(await page.locator(t("trpg-trial-open")).count(), 0);
    assert.match(await page.locator(t("venue-host-line")).innerText(), /今夜/);
  });

  await check("trial-load-cancel-does-not-touch-new-save", async page => {
    await setup(page, { chapter: 2 }); await page.evaluate(() => V.openCafe());
    await hit(page, "trpg-trial-open"); await hit(page, "trpg-trial-roll");
    await page.evaluate(() => { V.oldRoll = document.querySelector('[data-test="trpg-trial-roll"]'); V.core.newGame(); });
    await page.waitForFunction(() => V.result?.completed === false);
    const fresh = await snapshot(page); await page.evaluate(() => V.oldRoll.click());
    assert.equal(await snapshot(page), fresh);
  });

  await check("unmanned-gym-and-quiet-night-temple", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      await V.vn.play("choizap_lesson");
      const dayLines = V.vn.backlog().map(l => l.text).join(" ");
      V.core.state.slot = 1; V.core.state.spotVisits = { kannon: 1, choizap: 1 };
      V.core.state.flags._spot_last_choizap = 1; // 利用者と話した次の、静かな訪問
      await V.spots.visitSpot(V.spots.spotById("kannon"));
      await V.spots.visitSpot(V.spots.spotById("choizap"));
      return { dayLines, lines: V.vn.backlog().map(l => l.text).join(" "), flags: V.core.state.flags };
    });
    assert.match(result.dayLines, /アプリのフォーム動画/);
    assert(!/スタッフが来る|フォームを直される/.test(result.dayLines));
    assert.match(result.lines, /夜の境内/); assert.match(result.lines, /夜のCHOI-ZAP/);
    assert(!result.flags._spot_seen_kannon_adam && !result.flags._spot_seen_kannon_oldman);
  });
});
