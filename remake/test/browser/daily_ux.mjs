// #661: プレイヤーの実操作、保存失敗、期限・予約、表示を同じ本番モジュールで検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite, assertFits } from "./support.mjs";
const out = process.env.ARTIFACT_DIR || ".codex/artifacts/daily-ux";
fs.mkdirSync(out, { recursive: true });
const shot = async (page, name) => {
  // CSSの入場アニメーションが終わった状態をレポートへ保存する。
  await page.waitForTimeout(400);
  return page.screenshot({ path: path.join(out, `${name}.jpg`), quality: 85 });
};
async function setup(page, { ds = false, booked = false } = {}) {
  await page.evaluate(async ({ ds, booked }) => {
    if (ds) { localStorage.setItem("suien_title_layout", "ds"); window.dispatchEvent(new Event("display-layout-change")); }
    window.U = { core: await import("./js/core/state.js"), map: await import("./js/daily/map.js"),
      ui: await import("./js/core/ui.js"), hud: await import("./js/daily/hud.js"), phone: await import("./js/daily/phone.js"),
      data: await import("./js/core/data.js"), status: await import("./js/daily/status.js"), stats: await import("./js/core/stats.js"),
      preview: await import("./js/daily/action-preview.js"), settings: await import("./js/scenes/settings.js"), calendar: await import("./js/daily/calendar.js") };
    const s = U.core.newGame(); Object.assign(s, { phase: "daily", day: 4, slot: 0, money: 12800, stamina: 45, seed: 131 });
    s.reel.installed = true;
    s.stats.guts = 41; s.met.naru = s.met.adam = s.met.minto = true; s.contacts.push("minto");
    Object.assign(s.flags, { _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    const m = U.data.DB.lime.find(m => m.id === "lime_minto_day4");
    s.inbox.push({ id: m.id, originId: m.id, day: 4, msg: structuredClone(m), read: true, done: false, replyState: "waiting", log: [] });
    if (booked) s.pendingInvite = { event: "hiyori_tonari_return", sender: "sumi", slot: 1, day: 4 };
    U.ui.clearScreen(); U.hud.initHud({ phone: () => U.phone.openLime(), menu: () => U.calendar.openMenu({ schedule: [{ pin: "tonari", label: "スミさんとの夜の予定" }] }) }); U.hud.showHud();
    U.hud.setPhoneBadge(U.phone.replySummary()); U.result = "pending";
    U.map.chooseSpot({ schedule: [{ pin: "tonari", label: "スミさんとの夜の予定" }], eventPin: "tonari" }).then(v => U.result = v);
  }, { ds, booked });
  await page.locator('[data-test="pin-rest"]').waitFor();
}

await suite("daily-ux", async check => {
  for (const [name, viewport, ds] of [["pc", { width: 1280, height: 720 }, false],
    ["mobile-landscape", { width: 844, height: 390 }, false], ["mobile-portrait", { width: 390, height: 844 }, false],
    ["mobile-ds", { width: 390, height: 844 }, true]]) {
    await check(`${name}-map-phone-notebook`, async page => {
      await setup(page, { ds });
      await shot(page, `${name}-map`);
      const before = await page.evaluate(() => JSON.stringify(U.core.state));
      const pin = page.locator('[data-test="pin-minto"]'); await pin.scrollIntoViewIfNeeded(); await pin.click();
      // 2度目のピン入力も確定してはいけない。
      await pin.scrollIntoViewIfNeeded(); await pin.click();
      assert.equal(await page.evaluate(() => U.result), "pending");
      assert.equal(await page.evaluate(() => JSON.stringify(U.core.state)), before);
      assert.match(await page.locator('.ap-condition').innerText(), /31\/125/);
      assert.match(await page.locator('.ap-warning').innerText(), /風邪/);
      assert(!await page.locator('.map-info').evaluate(n => [...n.childNodes].some(c => c.nodeType === 3 && c.textContent === "null")));
      await assertFits(page, '[data-test="map-go"]');
      const go = await page.locator('[data-test="map-go"]').boundingBox();
      assert(go.height >= 44, JSON.stringify(go));
      await shot(page, `${name}-selected`);
      await page.locator('.mi-close').click();
      assert.equal(await page.locator('.map-filters, .map-plan, [data-test="hud-status"]').count(), 0);
      await page.locator('[data-test="pin-kannon"]').scrollIntoViewIfNeeded();
      assert.equal(await page.locator('[data-test="pin-kannon"] [data-facility="kannondo"]').count(), 1);
      await page.locator('[data-test="pin-kannon"] img').evaluate(n => n.decode());
      assert.equal(await page.locator('[data-test="pin-choizap"].facility-pin [data-facility="choizap"]').count(), 1);
      assert.equal(await page.locator('[data-test="pin-choizap"] .store-logo').count(), 0);
      assert.match(await page.locator('[data-test="hud-phone"]').getAttribute('aria-label'), /未読0件・返信待ち1件/);
      await page.locator('[data-test="hud-phone"]').click();
      await page.locator('.phone-overlay.show').waitFor();
      await page.waitForFunction(() => getComputedStyle(document.querySelector('.phone-overlay')).opacity === '1');
      assert.match(await page.locator('.lcr-tag').innerText(), /返信待ち.*夜/);
      await shot(page, `${name}-lime`);
      const phone = await page.locator('.phone').boundingBox(); assert(phone.width >= Math.min(viewport.width - 24, 340), JSON.stringify(phone));
      await page.locator('[data-test="lime-chat-minto"]').click();
      await page.locator('[data-test="reply-2"]').waitFor();
      await assertFits(page, '[data-test="lime-close"], [data-test="reply-0"]');
      await page.keyboard.press('Escape');
      await page.locator('#modal.show').waitFor({ state: 'hidden' });
      assert.equal(await page.evaluate(() => U.phone.replySummary().waiting), 1);
      assert.equal(await page.evaluate(() => document.activeElement.dataset.test), 'hud-phone');
      await page.locator('[data-test="hud-menu"]').click();
      await page.locator('[data-test="menu-notebook"]').click();
      assert.match(await page.locator('.plan-title').innerText(), /自由あと2行動/);
      await shot(page, `${name}-notebook`);
      await page.locator('[data-tab="people"]').click();
      await page.locator('[data-test="person-map-minto"]').scrollIntoViewIfNeeded();
      await page.locator('[data-test="person-map-minto"]').click();
      await page.locator('[data-test="map-go"]').waitFor();
      assert.equal(await page.evaluate(() => U.result), "pending");
      assert.match(await page.locator('.mi-banner').innerText(), /PEPPERMINT/);
    }, { viewport, isMobile: name !== "pc", hasTouch: name !== "pc", reducedMotion: "reduce" });
  }

  await check("reservation-save-failure-settings", async page => {
    await setup(page, { booked: true });
    await page.locator('[data-test="hud-menu"]').click();
    await page.locator('[data-test="menu-notebook"]').click();
    assert.match(await page.locator('.plan-title').innerText(), /自由あと1行動/);
    assert.match(await page.locator('.plan-items').innerText(), /行動後・自動/);
    await page.keyboard.press('Escape');
    await page.evaluate(() => {
      U.core.state.savedAt = 123; U.core.save(); U.previousSave = localStorage.getItem(U.core.SAVE_KEY);
      U.previousAt = U.core.state.savedAt;
      U.realWrite = Storage.prototype.setItem;
      Storage.prototype.setItem = function() { throw new DOMException("quota", "QuotaExceededError"); };
      U.core.state.money = 11234; U.failed = U.core.save();
    });
    assert.equal(await page.evaluate(() => U.failed), false);
    assert(await page.evaluate(() => U.core.state.savedAt === U.previousAt));
    await page.locator('[data-test="save-retry"]').waitFor();
    await shot(page, 'save-failure');
    // 失敗した安全な区切りを再試行し、その後の途中状態を保存しない。
    await page.evaluate(() => { Storage.prototype.setItem = U.realWrite; U.core.state.money = 9999; });
    await page.locator('[data-test="save-retry"]').click();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(U.core.SAVE_KEY)).money), 11234);
    assert.equal(await page.locator('#save-warning').count(), 0);
    await page.evaluate(() => { U.settings.openConfig(); });
    await page.locator('[data-test="config-textSize"]').selectOption('large');
    assert.equal(await page.locator('html').getAttribute('data-text-size'), 'large');
    await shot(page, 'settings');
    await page.keyboard.press('Escape'); await page.locator('#modal.show').waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(U.core.CONFIG_KEY)).textSize), 'large');
    await page.evaluate(() => {
      const old = U.core.newState(); delete old.actionHistory; old.schema = 16;
      localStorage.setItem(U.core.SAVE_KEY, JSON.stringify(old)); U.core.load();
    });
    assert.deepEqual(await page.evaluate(() => U.core.state.actionHistory), []);
  }, { reducedMotion: 'reduce' });
});
