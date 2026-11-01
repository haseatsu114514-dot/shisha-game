// #577: 実VN・店舗入口・共通予定・実SAVE/LOADで新規と旧保存を分ける。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
const t = id => `[data-test="${id}"]`;
const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

async function setup(page, { rumor = false, legacy = false, met = false } = {}) {
  await page.evaluate(async ({ rumor, legacy, met }) => {
    window.A = {
      core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      daily: await import("./js/daily/hiyori.js"), route: await import("./js/core/hiyori-route.js"),
      bar: await import("./js/daily/axe-bar.js"), discovery: await import("./js/daily/axe-bar-discovery.js"),
      spots: await import("./js/daily/spots.js"), map: await import("./js/daily/map.js"),
      access: await import("./js/daily/spot-access.js"), people: await import("./js/daily/spot-people.js"),
      ui: await import("./js/core/ui.js"), bus: await import("./js/core/bus.js"), lines: [], result: null,
    };
    const s = A.core.newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 1, money: 12000, stamina: 80, seed: 131 });
    // スミさんとBARのマキは本人が話す。既知の話し手として固定し、ひよりの面識だけを検査する。
    for (const id of ["sumi", "maki"]) { s.met[id] = true; s.flags[`_intro_${id}`] = true; }
    if (rumor) s.flags._axe_bar_rumor_done = true;
    if (met) { s.met.hiyori = true; s.flags._hiyori_meeting_done = true; }
    if (legacy) { s.schema = 15; A.core.save(); A.core.load(); }
    A.core.config.textSpeed = 4; A.core.config.bgmVolume = 0;
    A.vn.vnTest.turbo = false;
    A.vn.hooks.onLine = (id, line) => A.lines.push({ id, text: line.text, speaker: line.speaker });
    A.core.save();
  }, { rumor, legacy, met });
}
const resources = page => page.evaluate(() => {
  const s = A.core.state;
  return structuredClone({ money: s.money, stamina: s.stamina, slot: s.slot, stats: s.stats, met: s.met,
    affinity: s.affinity, contacts: s.contacts, story: s.story, visitedDay: s.visitedDay,
    lovers: s.lovers, records: s.flags._axe_bar_records, encounter: s.flags._hiyori_encounter_day,
    formal: s.flags._hiyori_meeting_done, memories: s.relationshipMemories });
});
async function finishScene(page, mode = "normal") {
  await page.locator("#vn.active").waitFor();
  if (mode === "auto" || mode === "skip") {
    const button = page.locator(t(mode === "auto" ? "vn-auto" : "vn-skip"));
    if (!await button.evaluate(n => n.classList.contains("on"))) await button.click();
    await page.waitForFunction(() => !A.vn.isPlaying(), null, { timeout: 45000 });
    return;
  }
  const deadline = Date.now() + 30000;
  while (await page.evaluate(() => A.vn.isPlaying())) {
    assert(Date.now() < deadline, "VN normal input timed out");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(100);
  }
}
async function beginSighting(page) {
  await page.evaluate(() => { A.abort = new AbortController(); A.result = null; A.flow = A.bar.visitAxeBar({ signal: A.abort.signal }).then(r => A.result = r); });
  await page.locator("#vn.active").waitFor();
}

await suite("axe-bar-discovery", async check => {
  for (const [device, options, mode] of [["pc", {}, "normal"], ["touch", touch, "skip"], ["auto", {}, "auto"]]) {
    await check(`${device}-rumor-sighting-next-day`, async page => {
      await setup(page);
      const before = await resources(page);
      const locked = await page.evaluate(async () => {
        const spot = A.spots.spotById("axe_bar");
        A.flow = A.map.chooseSpot();
        return { unlocked: A.spots.isUnlocked(spot), why: A.access.spotAvailability(spot).why,
          direct: await A.bar.visitAxeBar(), location: A.daily.hiyoriShopLocation() };
      });
      assert.deepEqual(locked, { unlocked: false, why: "locked", direct: false, location: null });
      // #780: 未発見の施設は「？？？」でも出さず、地図にピンを作らない。
      assert.equal(await page.locator(t("pin-axe_bar")).count(), 0);
      await page.evaluate(() => { A.map.interruptMap("__lime__"); A.result = null; A.flow = A.daily.meetHiyoriAtTonari().then(r => A.result = r); });
      await finishScene(page, mode);
      assert.equal(await page.evaluate(() => A.result), true);
      assert.deepEqual(await resources(page), before, "噂だけで面識・関係・報酬を付けない");
      assert.equal(await page.evaluate(() => A.core.state.flags._axe_bar_rumor_done), true);
      // 地図の実ボタンから、無料のBAR入口へ接続。
      await page.evaluate(() => { A.result = null; A.flow = A.map.chooseSpot().then(id => id === "axe_bar" && A.bar.visitAxeBar()).then(r => A.result = r); });
      await page.locator('.map:not(.done):not([data-revealing="true"])').waitFor(); // #780: 新ピンの解錠演出中は選択を受け付けない
      await page.locator(t("pin-axe_bar")).click(); await page.locator(t("map-go")).click();
      await finishScene(page, mode);
      await page.locator(t("axe-bar-back")).waitFor();
      assert.equal(await page.locator('.cutin[data-char="hiyori"]').count(), 0);
      assert.equal(await page.evaluate(() => A.lines.some(l => l.id === "axe_bar_sighting" && l.speaker === "hiyori")), false);
      assert.deepEqual(await resources(page), before, "無料目撃で料金・行動・能力・通常交流を進めない");
      const sameDay = await page.evaluate(async () => {
        const s = A.core.state;
        const saved = A.core.peekSave();
        return { sighting: s.flags._axe_bar_sighting_done, day: s.flags._axe_bar_sighting_day,
          chapter: s.flags._axe_bar_sighting_chapter, stored: saved.flags._axe_bar_sighting_done,
          meeting: A.route.hiyoriEventStatus("meeting"), location: A.daily.hiyoriShopLocation(),
          bypass: await A.daily.playHiyoriEvent("meeting") };
      });
      assert.deepEqual(sameDay, { sighting: true, day: 5, chapter: 1, stored: true, meeting: "prerequisites", location: null, bypass: false });
      await page.locator(t("axe-bar-back"))[device === "touch" ? "tap" : "click"]();
      await page.waitForFunction(() => A.result !== null);
      assert.equal(await page.evaluate(() => A.result), false, "無料帰還は有料プレイの完走ではない");
      await page.evaluate(async () => {
        A.core.saveToSlot("suien_remake_slot1"); A.core.newGame(); A.core.loadFromSlot("suien_remake_slot1"); A.core.save(); A.core.load();
        A.core.state.day = 6; A.core.state.slot = 0;
        const spot = A.spots.spotById(A.daily.hiyoriShopLocation());
        A.vn.vnTest.turbo = true;
        A.result = null; A.flow = A.daily.visitHiyoriAtShop(spot).then(r => A.result = r);
      });
      await page.waitForFunction(() => A.result !== null, null, { timeout: 30000 });
      assert.equal(await page.evaluate(() => A.result), true);
      assert.equal(await page.evaluate(() => A.core.state.flags._hiyori_meeting_done), true);
      assert.equal(await page.evaluate(() => A.core.state.met.hiyori), true);
      assert.equal(await page.evaluate(() => A.lines.some(l => l.id === "hiyori_meeting" && /どこかで見たような/.test(l.text))), true);
    }, options);
  }

  for (const reason of ["abort", "state", "day", "slot", "chapter", "screen", "pagehide"]) {
    await check(`sighting-${reason}-does-not-commit`, async page => {
      await setup(page, { rumor: true });
      const before = await resources(page);
      await beginSighting(page);
      const expected = await page.evaluate(reason => {
        A.oldOwner = A.core.state;
        if (reason === "abort") A.abort.abort();
        if (reason === "state") {
          const s = A.core.newGame(); Object.assign(s, { phase: "daily", day: 9, slot: 1, money: 7654 });
          A.core.saveToSlot("suien_remake_slot2"); A.core.loadFromSlot("suien_remake_slot2");
        }
        if (["day", "slot", "chapter"].includes(reason)) { A.core.state[reason]++; A.bus.emit("hud"); }
        if (reason === "screen") A.ui.showScreen("home", document.createElement("div"));
        if (reason === "pagehide") window.dispatchEvent(new Event("pagehide"));
        return JSON.stringify(A.core.state);
      }, reason);
      await page.waitForFunction(() => A.result !== null);
      assert.equal(await page.evaluate(() => A.result), false);
      assert.equal(await page.evaluate(() => A.oldOwner.flags._axe_bar_sighting_done), undefined);
      assert.equal(await page.evaluate(() => JSON.stringify(A.core.state)), expected, "破棄された目撃が現在の保存へ書き戻さない");
      if (!["state", "day", "slot", "chapter"].includes(reason)) assert.deepEqual(await resources(page), before);
    });
  }
  await check("no-money-free-sighting-and-reentry", async page => {
    await setup(page, { rumor: true });
    await page.evaluate(() => { A.core.state.money = 0; });
    const before = await resources(page);
    await beginSighting(page); await finishScene(page, "skip");
    await page.locator(t("axe-bar-back")).waitFor();
    assert.equal(await page.locator(t("axe-bar-practice")).isDisabled(), true);
    assert.equal(await page.locator(t("axe-bar-league")).isDisabled(), true);
    assert.deepEqual(await resources(page), before, "資金不足でも目撃は無料で完読できる");
    await page.locator(t("axe-bar-back")).click(); await page.waitForFunction(() => A.result !== null);
    await page.evaluate(() => { A.core.state.day++; A.result = null; A.flow = A.bar.visitAxeBar().then(r => A.result = r); });
    await page.locator(t("axe-bar-back")).waitFor();
    assert.equal(await page.evaluate(() => A.vn.isPlaying()), false);
    assert.equal(await page.evaluate(() => A.core.state.flags._axe_bar_sighting_day), 5, "再入店で目撃日を上書きしない");
    await page.locator(t("axe-bar-back")).click();
  });
  await check("rumor-abort-and-legacy-no-backfill", async page => {
    await setup(page);
    await page.evaluate(() => { A.abort = new AbortController(); A.result = null; A.flow = A.discovery.playAxeBarRumor({ signal: A.abort.signal }).then(r => A.result = r); });
    await page.locator("#vn.active").waitFor(); await page.evaluate(() => A.abort.abort());
    await page.waitForFunction(() => A.result !== null);
    assert.equal(await page.evaluate(() => A.core.state.flags._axe_bar_rumor_done), undefined);
    await setup(page, { legacy: true });
    assert.equal(await page.evaluate(() => A.spots.isUnlocked(A.spots.spotById("axe_bar"))), true);
    assert.equal(await page.evaluate(() => A.route.hiyoriEventStatus("meeting")), "ready");
    await page.evaluate(() => { A.vn.vnTest.turbo = true; A.result = null; A.flow = A.daily.playHiyoriEvent("meeting").then(r => A.result = r); });
    await page.waitForFunction(() => A.result !== null, null, { timeout: 30000 });
    assert.equal(await page.evaluate(() => A.result), true);
    assert.equal(await page.evaluate(() => A.lines.some(l => /どこかで見たような/.test(l.text))), false);
    assert.equal(await page.evaluate(() => A.core.state.flags._axe_bar_sighting_done), undefined);
    await page.evaluate(() => { A.result = null; A.flow = A.bar.visitAxeBar().then(r => A.result = r); });
    await page.locator(t("axe-bar-back")).waitFor();
    assert.equal(await page.evaluate(() => A.vn.isPlaying()), false, "対面済みの旧保存へ目撃を後付けしない");
    await page.locator(t("axe-bar-back")).click();
  });
});
