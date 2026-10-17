// #640: 実描画・所持品取得・保存境界。本体/成長/セーブのルールは変更しない。
import assert from "node:assert/strict";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { suite, assertFits } from "./support.mjs";

const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
const baseline = process.env.HOME_RIG_BASELINE === "1";
const variants = [[], ["home_rig_set"], ["home_rig_pro"], ["home_rig_set", "home_rig_pro"]];
const names = ["none", "tabletop", "pro", "both"];
const rigs = (page, host = "#bg > :last-child") => page.locator(`${host} [data-home-rig]`).evaluateAll(ns => ns.map(n => n.dataset.homeRig));
const expectedRigs = owned => baseline ? [] : owned;
const hit = (page, label, selector) => label === "touch" ? page.locator(selector).tap() : page.locator(selector).click();

async function setup(page) {
  if (baseline) {
    for (const file of ["scene-art.js", "ui.js"]) {
      const body = execFileSync("git", ["show", `13bf4a125d781c1d1bc4e6e94687e72f8d9477f4:remake/js/core/${file}`], { encoding: "utf8" });
      await page.route(`**/js/core/${file}`, route => route.fulfill({ contentType: "text/javascript", body }));
    }
    await page.reload();
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
  }
  await page.evaluate(async () => {
    window.HQ = { core: await import("./js/core/state.js"), ui: await import("./js/core/ui.js"),
      data: await import("./js/core/data.js"), vn: await import("./js/vn/engine.js"),
      art: await import("./js/core/scene-art.js"), bus: await import("./js/core/bus.js") };
    Object.assign(HQ.core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    HQ.core.saveConfig();
  });
}
async function home(page, owned, tod) {
  await page.evaluate(async ({ owned, tod }) => {
    const s = HQ.core.newGame();
    Object.assign(s, { phase: "daily", day: 1, slot: tod === "night" ? 1 : 0, stamina: 80 });
    s.owned.push(...owned);
    // 装備に大会台を置いても、所持しなければ表示しない。
    s.equip.pipe = "home_rig_pro";
    HQ.ui.showScreen("home", document.createElement("div"));
    await HQ.ui.setBg(HQ.data.bgUrl("bg_home", tod), { instant: true });
  }, { owned, tod });
}

await suite("home-rig-backgrounds", async check => {
  for (const [label, opts] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-four-states-day-night`, async page => {
      await setup(page);
      for (const tod of ["day", "night"]) for (const [i, owned] of variants.entries()) {
        await home(page, owned, tod);
        assert.deepEqual(await rigs(page), expectedRigs(owned), `${tod}/${names[i]}`);
        const before = await page.evaluate(() => JSON.stringify(HQ.core.state));
        const geometry = await page.locator("#bg [data-home-rig]").evaluateAll(ns => ns.map(n => ({
          id: n.dataset.homeRig, x: +n.getAttribute("x"), y: +n.getAttribute("y"),
          w: +n.getAttribute("width"), h: +n.getAttribute("height"), pointer: getComputedStyle(n.closest(".scene-art")).pointerEvents,
        })));
        for (const g of geometry) {
          assert.equal(g.pointer, "none");
          assert(g.x > 0 && g.y > 0 && g.x + g.w < 1280 && g.y + g.h < 720);
        }
        const preloads = await page.evaluate(() => HQ.art.sceneArtUrls(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay())));
        assert.equal(preloads.length, 1 + expectedRigs(owned).length);
        assert.equal(await page.evaluate(() => JSON.stringify(HQ.core.state)), before, "Rendering must not mutate game state");
        await page.screenshot({ path: `${out}/${baseline ? "before" : "after"}-${label}-${tod}-${names[i]}.jpg`, type: "jpeg", quality: 82 });
        // 同じURLで所持品だけ変わる場合も、setBgのキャッシュに古い台を残さない。
        await page.evaluate(async () => { HQ.core.state.owned = [...HQ.core.STARTER_EQUIPMENT]; await HQ.ui.setBg(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay()), { instant: true }); });
        assert.deepEqual(await rigs(page), []);
      }
      if (baseline) return;
      await home(page, variants[3], "night");
      for (const file of ["bg_home.png", "bg_home_overcast_day.png", "bg_home_overcast_night.png"]) {
        await page.evaluate(async file => HQ.ui.setBg(HQ.data.img(`backgrounds/${file}`), { instant: true }), file);
        assert.deepEqual(await rigs(page), variants[3], file);
      }
      await page.evaluate(async () => HQ.ui.setBg(HQ.data.bgUrl("bg_street", "day"), { instant: true }));
      assert.deepEqual(await rigs(page), [], "No props on unrelated backgrounds");
    }, opts);

    if (baseline) continue;
    await check(`${label}-acquire-save-load-new-game`, async page => {
      await setup(page); await home(page, [], "day");
      // 実際の卓上台受取を通す。使用中の台の判定は使わない。
      await page.evaluate(async () => {
        HQ.vn.vnTest.turbo = true;
        await (await import("./js/daily/home-rig.js")).giveSumiRig({ bg: "res://assets/backgrounds/bg_home.png" });
        await HQ.ui.bannersIdle();
      });
      assert.deepEqual(await rigs(page), variants[1]);
      // 実くじをS賞確定の箱で引き、grantと保存を通す。
      await page.evaluate(async () => {
        const s = HQ.core.state, g = HQ.data.DB.kuji.grades.g1000;
        s.kuji.g1000 = { order: [g.prizes.findIndex(p => p.equipId === "home_rig_pro")], drawn: 0, emptyDay: null };
        const host = document.createElement("div"); host.id = "qa-kuji";
        host.append(...(await import("./js/daily/kuji.js")).kujiRows(() => {}));
        HQ.ui.layers.screen.append(host);
      });
      await hit(page, label, '[data-test="kuji-g1000"]');
      await page.locator(".kuji-card.reveal").waitFor();
      assert.deepEqual(await rigs(page), variants[3], "Kuji acquisition updates the current home without a new setBg");
      await hit(page, label, '[data-test="kuji-reveal"]');
      await page.evaluate(() => { document.getElementById("qa-kuji")?.remove(); });

      for (const [i, owned] of variants.entries()) {
        await home(page, owned, "night");
        const result = await page.evaluate(() => {
          const c = HQ.core, original = structuredClone(c.state); c.saveToSlot("suien_remake_slot1");
          const manual = localStorage.getItem("suien_remake_slot1");
          c.newGame(); c.loadFromSlot("suien_remake_slot1");
          const restored = structuredClone(c.state);
          delete original.savedAt; delete restored.savedAt;
          return { original, restored, manualUnchanged: manual === localStorage.getItem("suien_remake_slot1") };
        });
        assert.deepEqual(result.restored, result.original); assert(result.manualUnchanged);
        assert.deepEqual(await rigs(page), owned, `${names[i]} manual LOAD refreshes the same visible host`);
        await page.reload();
        await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
        await page.locator("#boot").waitFor({ state: "detached" });
        await setup(page);
        await page.evaluate(async () => {
          HQ.core.load(); HQ.ui.showScreen("home", document.createElement("div"));
          await HQ.ui.setBg(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay()), { instant: true });
        });
        assert.deepEqual(await rigs(page), owned, `${names[i]} browser reload + real autosave load`);
        await page.evaluate(() => HQ.core.newGame());
        assert.deepEqual(await rigs(page), [], "NEW GAME clears the already visible old home");
      }
      // 異なる実手動枠を交互にLOADして、前の所持状態を引き継がない。
      await home(page, variants[3], "night");
      await page.evaluate(() => { HQ.core.saveToSlot("suien_remake_slot1"); HQ.core.newGame(); HQ.core.saveToSlot("suien_remake_slot2"); });
      for (let n = 0; n < 2; n++) {
        await page.evaluate(() => HQ.core.loadFromSlot("suien_remake_slot1"));
        assert.deepEqual(await rigs(page), variants[3]);
        await page.evaluate(() => HQ.core.loadFromSlot("suien_remake_slot2"));
        assert.deepEqual(await rigs(page), []);
      }
    }, opts);

    await check(`${label}-home-scenes-and-map-preview`, async page => {
      await setup(page); await home(page, variants[3], "night");
      // 実台本: 家の休息と帰宅3種。abortはテスト内の会話だけに用いる。
      for (const id of ["remake_rest", "remake_homecoming_0", "remake_homecoming_1", "remake_homecoming_2"]) {
        await page.evaluate(id => {
          HQ.vn.vnTest.turbo = false; window.homeAbort = new AbortController();
          window.homeScene = HQ.vn.play(id, { signal: homeAbort.signal });
        }, id);
        await page.locator("#vn.active .vn-box").waitFor();
        assert.deepEqual(await rigs(page), variants[3], id);
        await assertFits(page, ".vn-box");
        await page.screenshot({ path: `${out}/${label}-${id}.jpg`, type: "jpeg", quality: 82 });
        await page.evaluate(async () => { homeAbort.abort(); await homeScene; });
      }
      // 寝る前の一服の実モーダル。消費前にキャンセルする。
      await page.evaluate(async () => {
        HQ.core.state.flavorStock = { lemon: 20, mint: 20 };
        void (await import("./js/daily/home-shisha.js")).runHomeShisha();
      });
      await page.locator('[data-test="home-shisha-skip"]').waitFor();
      assert.deepEqual(await rigs(page), variants[3]);
      await assertFits(page, ".home-shisha-dialog .modal-actions button");
      await page.screenshot({ path: `${out}/${label}-bedtime.jpg`, type: "jpeg", quality: 82 });
      await hit(page, label, '[data-test="home-shisha-skip"]');
      await page.evaluate(async () => {
        const home = await import("./js/daily/home-shisha.js");
        window.homeAbort = new AbortController();
        window.homeScene = HQ.vn.play(home.homeShishaDialogue({ taste: "fine", stat: null }, { id: "home_rig_pro" }), { signal: homeAbort.signal });
      });
      await page.locator("#vn.active .vn-box").waitFor();
      assert.deepEqual(await rigs(page), variants[3], "Bedtime dialogue background");
      await page.evaluate(async () => { homeAbort.abort(); await homeScene; });

      for (const tod of ["day", "night"]) {
        await home(page, variants[3], tod);
        await page.evaluate(async () => {
          const map = await import("./js/daily/map.js"); window.homeMap = map;
          void map.chooseSpot();
        });
        await hit(page, label, '[data-test="pin-rest"]');
        await page.waitForFunction(() => document.querySelectorAll(".mi-preview [data-home-rig]").length === 2);
        assert.deepEqual(await rigs(page, ".mi-preview"), variants[3]);
        await assertFits(page, '[data-test="map-go"], [data-test="map-home-practice"]');
        await page.screenshot({ path: `${out}/${label}-preview-${tod}.jpg`, type: "jpeg", quality: 82 });
        await page.evaluate(() => homeMap.interruptMap("rest"));
      }
      await page.evaluate(async () => {
        const worker = (await import("./js/craft/worker.js")).buildWorkerScene({ mode: "drill", venue: "home" });
        HQ.ui.showScreen("home", worker.root); await worker.ready;
      });
      assert.deepEqual(await rigs(page, ".bench-worker-stage"), variants[3], "Home practice uses the same scene art");
      await page.evaluate(() => HQ.core.newGame());
      assert.deepEqual(await rigs(page, ".bench-worker-stage"), [], "Practice backdrop also clears on NEW GAME");
    }, opts);

    await check(`${label}-real-night-to-morning`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = HQ.core.newGame();
        Object.assign(s, { phase: "daily", day: 8, slot: 2, stamina: 80 });
        s.owned.push("home_rig_set", "home_rig_pro");
        s.flavorStock = {};
        Object.assign(s.flags, { _ev_salaryman: true, _ev_first_practice: true, _ev_day5: true,
          _ev_midcheck: true, _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
          _hiyori_meeting_done: true, _hiyori_message_delivered: true, _lime_tut: true,
          _lime_opened: true, _morning_8: true, _home_tonight: true });
        HQ.core.save();
      });
      await page.addInitScript(() => {
        window.homeWakeFrames = [];
        new MutationObserver(() => {
          if (window.__remake?.state?.day !== 9) return;
          const bg = document.querySelector("#bg > :last-child[data-home-scene]");
          if (bg) homeWakeFrames.push({ url: bg.dataset.homeScene, rigs: [...bg.querySelectorAll("[data-home-rig]")].map(n => n.dataset.homeRig) });
        }).observe(document, { childList: true, subtree: true });
      });
      await page.reload();
      await page.locator('[data-test="title-load"]').waitFor({ timeout: 30000 });
      await page.locator("#boot").waitFor({ state: "detached" });
      await page.evaluate(() => { __remake.vnTest.turbo = true; });
      await hit(page, label, '[data-test="title-load"]'); await hit(page, label, '[data-test="slot-0"]');
      await page.waitForFunction(() => __remake.state.day === 9 && document.querySelector('[data-destination-selection]:not(.done)'), null, { timeout: 30000 });
      const frames = await page.evaluate(() => homeWakeFrames);
      assert(frames.some(f => /bg_home_(?:overcast_)?day\.webp$/.test(f.url) && f.rigs.join(",") === variants[3].join(",")), "Real advanceDay renders both rigs on the morning home before the map");
    }, opts);
  }
});
