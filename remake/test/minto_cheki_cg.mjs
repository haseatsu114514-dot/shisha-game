// Actual DAY4 LIME acceptance and saved appointment reach the existing two-shot command.
import assert from "node:assert/strict";
import path from "node:path";
import { suite, storageSnapshot, assertFits } from "./browser/support.mjs";

const id = "cg_minto_cheki";
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/minto-cheki-cg");
async function prepare(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), data = await import("./js/core/data.js");
    const engine = await import("./js/vn/engine.js"), ui = await import("./js/core/ui.js");
    const phone = await import("./js/daily/phone.js"), calendar = await import("./js/daily/calendar.js");
    const ch1 = await import("./js/chapters/ch1.js"), gallery = await import("./js/scenes/gallery.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 4, slot: 0, money: 30000, stamina: 100, contacts: ["minto"], lastBaitoDay: 4 });
    Object.assign(s.flags, { _morning_4: true, _lime_tut: 1, _lime_opened: true, _intro_minto: true, _intro_hajime: true,
      _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true });
    s.met.minto = true; s.story.minto = 1; s.affinity.minto = 20;
    core.config.textSpeed = 4; ch1.setupHooks(); engine.vnTest.turbo = false; ui.clearScreen();
    localStorage.setItem("suien_remake_gallery", JSON.stringify(["cg_minto_first_cheki"]));
    window.K = { core, data, engine, phone, calendar, gallery, ui };
  });
}

async function stopAtPhoto(page) {
  await page.locator('[data-test="vn-skip"]').waitFor();
  await page.locator('[data-test="vn-skip"]').click();
  await page.waitForFunction(() => document.querySelector(".vn-cg.show")?.dataset.cg === "cg_minto_cheki");
  await page.locator('[data-test="vn-skip"]').click();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".vn-cg")).opacity) >= .99
    && document.querySelector(".vn-text")?.textContent.includes("ツーショット"));
  await assertFits(page, ".vn-text");
  const result = await page.evaluate(async () => {
    const image = new Image(); image.src = K.data.cgUrl("cg_minto_cheki"); await image.decode();
    return { url: K.data.cgUrl("cg_minto_cheki"), size: [image.naturalWidth, image.naturalHeight],
      gallery: JSON.parse(localStorage.getItem("suien_remake_gallery")), money: K.core.state.money };
  });
  assert.equal(result.url, "img/cgs/cg_minto_cheki.webp"); assert.deepEqual(result.size, [1920, 1080]);
  assert(result.gallery.includes(id) && result.gallery.includes("cg_minto_first_cheki"));
  assert.equal(result.money, 27000, "The actual accepted store invitation was not charged once");
}

await suite("minto-cheki-cg", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  for (const [device, options] of [["pc", { viewport: { width: 1920, height: 1080 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" }]]) {
    await check(device + "-real-lime-invitation", async page => {
      await prepare(page);
      await page.evaluate(() => {
        K.phone.deliverMorning({ fixedNight: () => false });
        if (!K.core.state.inbox.some(item => item.msg.id === "lime_minto_day4")) throw Error("Canonical DAY4 invitation was not delivered");
        K.core.saveToSlot("suien_remake_slot1");
        window.manualBefore = localStorage.getItem("suien_remake_slot1");
        void K.calendar.runDaily({ nightEvents: {} });
      });
      await page.locator('[data-test="hud-phone"]').click();
      await page.locator('[data-test="lime-chat-minto"]').click();
      for (let n = 0; n < 45 && !await page.locator('[data-test="reply-0"]').isVisible(); n++) {
        const next = page.locator('[data-test="phone-next"]');
        if (await next.isVisible()) await next.click();
        await page.waitForTimeout(100);
      }
      await page.locator('[data-test="reply-0"]').click();
      for (let n = 0; n < 30 && !await page.evaluate(() => K.core.state.pendingInvite?.event === "interaction_minto_noon_01"); n++) {
        const next = page.locator('[data-test="phone-next"]');
        if (await next.isVisible()) await next.click();
        await page.waitForTimeout(100);
      }
      assert.equal(await page.evaluate(() => K.core.state.pendingInvite?.event), "interaction_minto_noon_01");
      const close = page.locator('[data-test="phone-close"]');
      if (!await close.isVisible()) await page.locator('[data-test="lime-back"]').click();
      await close.click();
      await stopAtPhoto(page);
      await page.screenshot({ path: path.join(artifacts, device + "-photo-vn.png") });
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_slot1") === manualBefore), true);
      await page.locator('[data-test="vn-skip"]').click();
      await page.waitForFunction(() => K.core.state.slot === 1 && !!document.querySelector('[data-test="pin-minto"]'));
      await page.evaluate(() => { void K.gallery.openGallery(); });
      await page.locator('[data-test="gal-cg_minto_cheki"]').click();
      assert.match(await page.locator(".gal-viewer.show").evaluate(node => node.style.backgroundImage), /cg_minto_cheki\.webp/);
      await page.screenshot({ path: path.join(artifacts, device + "-gallery.png") });
      const loaded = await page.evaluate(() => {
        K.core.loadFromSlot("suien_remake_slot1");
        return { day: K.core.state.day, slot: K.core.state.slot, money: K.core.state.money,
          seen: JSON.parse(localStorage.getItem("suien_remake_gallery")) };
      });
      assert.deepEqual([loaded.day, loaded.slot, loaded.money], [4, 0, 30000]);
      assert(loaded.seen.includes(id), "Loading a prior save erased the separate gallery record");
    }, options);

    await check(device + "-legacy-saved-invitation", async page => {
      await prepare(page);
      const loaded = await page.evaluate(() => {
        // Actual old schema appointment: migration supplies the omitted day/origin fields.
        K.core.state.schema = 5;
        K.core.state.pendingInvite = { sender: "minto", slot: 0, event: "interaction_minto_noon_01" };
        K.core.saveToSlot("suien_remake_slot2"); K.core.newGame(); K.core.loadFromSlot("suien_remake_slot2");
        window.legacyBefore = localStorage.getItem("suien_remake_slot2");
        const appointment = structuredClone(K.core.state.pendingInvite);
        void K.calendar.runDaily({ nightEvents: {} });
        return appointment;
      });
      assert.equal(loaded.day, 4); assert.equal(loaded.event, "interaction_minto_noon_01");
      await stopAtPhoto(page);
      await page.screenshot({ path: path.join(artifacts, device + "-legacy-photo-vn.png") });
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_slot2") === legacyBefore), true);
      await page.locator('[data-test="vn-skip"]').click();
      await page.waitForFunction(() => K.core.state.slot === 1 && !!document.querySelector('[data-test="pin-minto"]'));
      assert.equal(await page.evaluate(() => K.core.state.pendingInvite), null);
    }, options);

    await check(device + "-delayed-photo-skip-waits", async page => {
      await prepare(page); const saved = await storageSnapshot(page);
      let release;
      const gate = new Promise(resolve => { release = resolve; });
      await page.route("**/cg_minto_cheki.webp", async route => { await gate; await route.continue(); });
      await page.evaluate(() => {
        const original = K.data.DB.dialogues.interaction_minto_noon_01;
        const index = original.lines.findIndex(line => line.type === "show_cg" && line.cg_id === "cg_minto_cheki");
        window.photoAudit = { maxOpacity: 0, stop: false };
        const sample = () => {
          if (photoAudit.stop) return;
          const node = document.querySelector(".vn-cg.show");
          if (node) photoAudit.maxOpacity = Math.max(photoAudit.maxOpacity, Number(getComputedStyle(node).opacity));
          requestAnimationFrame(sample);
        }; requestAnimationFrame(sample);
        window.delayedPhoto = K.engine.play({ dialogue_id: "delayed-photo", lines: [
          { text: "写真を読み込む。" }, original.lines[index], original.lines[index + 1],
          { type: "hide_cg" }, { type: "choice", choices: [{ text: "続ける" }] } ] });
      });
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "写真を読み込む。");
      await page.locator('[data-test="vn-skip"]').click(); await page.waitForTimeout(300);
      assert.equal(await page.locator(".vn-text").textContent(), "写真を読み込む。");
      assert.equal(await page.locator(".vn-cg.show").count(), 0);
      assert.deepEqual(await storageSnapshot(page), saved);
      await page.screenshot({ path: path.join(artifacts, device + "-loading.png") });
      release(); await page.locator('[data-test="choice-0"]').waitFor();
      assert(await page.evaluate(() => { photoAudit.stop = true; return photoAudit.maxOpacity >= .95; }), "SKIP hid the photo before it was visible");
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_gallery")).includes("cg_minto_cheki")), true);
      await page.locator('[data-test="choice-0"]').click(); await page.evaluate(() => window.delayedPhoto);
    }, options);

    await check(device + "-failed-photo-not-recorded", async page => {
      await prepare(page); const saved = await storageSnapshot(page);
      await page.route("**/cg_minto_cheki.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "invalid image" }));
      await page.evaluate(() => {
        const command = K.data.DB.dialogues.interaction_minto_noon_01.lines.find(line => line.type === "show_cg");
        window.failedPhoto = K.engine.play({ dialogue_id: "failed-minto-photo", lines: [
          { text: "写真を見る。" }, command, { text: "画像がなくても進む。" }, { type: "hide_cg" },
          { type: "choice", choices: [{ text: "続ける" }] } ] });
      });
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent === "写真を見る。");
      await page.locator('[data-test="vn-skip"]').click(); await page.locator('[data-test="choice-0"]').waitFor();
      assert.equal(await page.locator(".vn-cg.show").count(), 0);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_gallery")).includes("cg_minto_cheki")), false);
      assert.deepEqual(await storageSnapshot(page), saved);
      await page.locator('[data-test="choice-0"]').click(); await page.evaluate(() => window.failedPhoto);
    }, options);
  }
});
