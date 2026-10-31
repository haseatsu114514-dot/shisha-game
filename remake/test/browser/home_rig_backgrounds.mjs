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

// DOMの背景枚数だけでは縮小stageの鏡像反復を検出できない。
// タッチの実モーダルを、同じ場面のぼかしなし参照と画素で照合する。
async function assertTouchModalBackground(page) {
  const actual = await page.screenshot({ path: `${out}/home-rig-backgrounds-touch-bedtime.png`, animations: "disabled" });
  const control = await page.addStyleTag({ content: ".modal-backdrop { backdrop-filter: none !important; }" });
  let reference;
  try {
    reference = await page.screenshot({ path: `${out}/home-rig-backgrounds-touch-bedtime-reference.png`, animations: "disabled" });
  } finally { await control.evaluate(node => node.remove()); }
  const difference = await page.evaluate(async ([actual, reference]) => {
    const decode = async base64 => {
      const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
      const ctx = canvas.getContext("2d"); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, image.width, image.height);
    };
    const a = await decode(actual), b = await decode(reference);
    const box = document.querySelector(".home-shisha-dialog").getBoundingClientRect();
    const scale = a.width / innerWidth;
    let changed = 0, pixels = 0;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      if (x / scale >= box.left - 4 && x / scale <= box.right + 4 && y / scale >= box.top - 4 && y / scale <= box.bottom + 4) continue;
      const i = (y * a.width + x) * 4;
      if ([0, 1, 2].some(c => Math.abs(a.data[i + c] - b.data[i + c]) > 2)) changed++;
      pixels++;
    }
    return { changed, pixels };
  }, [actual.toString("base64"), reference.toString("base64")]);
  assert(difference.pixels > 10000, "Modal reference must include visible room pixels");
  assert(difference.changed / difference.pixels < .001, `Touch modal changed the room image: ${JSON.stringify(difference)}`);
}

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
    await check(`${label}-tabletop-first-night`, async page => {
      await setup(page);
      await home(page, [], "night");
      await page.evaluate(async () => {
        HQ.rig = await import("./js/daily/home-rig.js");
        HQ.calendar = await import("./js/daily/calendar.js");
        const s = HQ.core.state;
        // DAY2を晴れに固定し、曇天差分の抽選で背景の厳密照合を揺らさない。
        Object.assign(s, { day: 2, slot: 2, stamina: 40, weatherSeed: 0 });
        s.flags._morning_2 = true;
        HQ.beforeNight = structuredClone(s);
        HQ.entered = [];
        HQ.vn.vnTest.turbo = true;
        HQ.vn.hooks.onEnter = id => {
          HQ.entered.push(id);
          if (id === HQ.rig.RIG_HOME_SCENE) {
            HQ.vn.vnTest.turbo = false;
            HQ.firstNightStarted = performance.now();
          }
        };
        // 本編と同じ贈呈→帰宅→就寝をcalendar経由で通す。
        HQ.nightTask = HQ.calendar.runDaily({ nightEvents: {}, untilDay: 3,
          beforeHomecoming: HQ.rig.giveEarlyHomeRig });
      });
      const lines = await page.evaluate(() => HQ.data.DB.dialogues[HQ.rig.RIG_HOME_SCENE].lines.map(l => l.text));
      await page.waitForFunction(text => document.querySelector(".vn-text")?.textContent === text
        && document.querySelector(".vn-next.show") && performance.now() > HQ.firstNightStarted + 350, lines[0]);
      assert.deepEqual(await rigs(page), ["home_rig_set"]);
      const image = page.locator('#bg > :last-child [data-home-rig="home_rig_set"] image');
      assert.match(await image.getAttribute("href"), /ui\/scene_props\/shisha_home_tabletop\.(webp|png)$/);
      assert.equal(await page.locator("#bg > :last-child").getAttribute("data-scene-bg"), "bg_home_night.png");
      await assertFits(page, ".vn-box");
      await page.screenshot({ path: `${out}/tabletop-first-night-${label}.png`, animations: "disabled" });
      assert.equal(await page.evaluate(() => HQ.rig.showSumiRigAtHome()), false, "表示中の再入室でも再生しない");
      const during = await page.evaluate(() => {
        HQ.core.saveToSlot("suien_remake_slot1");
        return JSON.parse(localStorage.getItem(HQ.core.SAVE_KEY));
      });
      assert.equal(during.flags._sumi_rig_home_seen, true, "表示開始時に既読を保存済み");
      assert.equal(during.flags._sumi_rig_received_day, "1:2");
      await hit(page, label, ".vn-box");
      await page.waitForFunction(text => document.querySelector(".vn-text")?.textContent === text
        && document.querySelector(".vn-next.show"), lines[1]);
      await hit(page, label, ".vn-box");
      await page.evaluate(() => HQ.nightTask);
      const after = await page.evaluate(() => structuredClone(HQ.core.state));
      assert.equal(after.day, 3, "演出後は通常どおり翌朝へ進む");
      assert.equal(after.stamina, 54, "追加の体力消費はなく、通常の睡眠回復だけ");
      for (const key of ["money", "flavorStock", "stats", "statXp"]) {
        assert.deepEqual(after[key], await page.evaluate(key => HQ.beforeNight[key], key), key);
      }
      assert.equal(await page.locator(".home-shisha-dialog").count(), 0, "黄色の夜に家シーシャの誘いを追加しない");
      const entered = await page.evaluate(() => HQ.entered);
      assert(entered.includes("remake_homecoming_2"));
      assert(entered.indexOf("remake_homecoming_2") < entered.indexOf("ch1_sumi_home_rig_homecoming"));
      assert.equal(entered.filter(id => id === "ch1_sumi_home_rig_homecoming").length, 1);
      for (const key of ["suien_remake_slot1", "suien_remake_save"]) {
        const result = await page.evaluate(async key => {
          HQ.core.loadFromSlot(key);
          const before = JSON.stringify(HQ.core.state);
          return { played: await HQ.rig.showSumiRigAtHome(), unchanged: before === JSON.stringify(HQ.core.state) };
        }, key);
        assert.deepEqual(result, { played: false, unchanged: true }, `${key}: 同じ夜の保存からLOADしても再生しない`);
      }
    }, opts);

    await check(`${label}-tabletop-first-night-load`, async page => {
      await setup(page); await home(page, [], "night");
      await page.evaluate(async () => {
        HQ.rig = await import("./js/daily/home-rig.js");
        Object.assign(HQ.core.state, { day: 2, slot: 2 });
        HQ.core.saveToSlot("suien_remake_slot1"); // 台を受け取る前の別の保存
        HQ.vn.vnTest.turbo = true;
        await HQ.rig.giveEarlyHomeRig();
        await HQ.ui.bannersIdle();
        HQ.core.saveToSlot("suien_remake_slot2"); // 受取後・自室演出前
        HQ.vn.vnTest.turbo = false;
        HQ.interruptedStarted = performance.now();
        HQ.interruptedTask = HQ.rig.showSumiRigAtHome();
      });
      await page.waitForFunction(() => document.querySelector("#vn.active .vn-next.show")
        && performance.now() > HQ.interruptedStarted + 350);
      const loaded = await page.evaluate(() => {
        HQ.core.loadFromSlot("suien_remake_slot1");
        HQ.vn.vnTest.turbo = true;
        return structuredClone(HQ.core.state);
      });
      await hit(page, label, ".vn-box");
      assert.equal(await page.evaluate(() => HQ.interruptedTask), false);
      assert.deepEqual(await page.evaluate(() => structuredClone(HQ.core.state)), loaded, "表示中LOADで別SAVEに既読や台を付けない");
      const replay = await page.evaluate(async () => {
        HQ.core.loadFromSlot("suien_remake_slot2");
        const first = await HQ.rig.showSumiRigAtHome();
        HQ.core.load();
        return [first, await HQ.rig.showSumiRigAtHome()];
      });
      assert.deepEqual(replay, [true, false], "未見の保存では一度再生し、その後のLOADでは再生しない");
    }, opts);

    await check(`${label}-tabletop-gift-image`, async page => {
      await setup(page); await home(page, [], "day");
      const startGift = async () => {
        await page.evaluate(async () => {
          HQ.rig = await import("./js/daily/home-rig.js");
          HQ.beforeGift = structuredClone(HQ.core.state);
          HQ.giftDone = false;
          HQ.giftStarted = performance.now();
          HQ.vn.vnTest.turbo = true;
          // 実台本を最後の地の文まで読み、受取の直前から実クリックで進める。
          const scene = HQ.data.DB.dialogues[HQ.rig.RIG_SCENE];
          const last = scene.lines.at(-1);
          HQ.vn.hooks.onLine = (id, line) => {
            // 再生中の行は既読管理のための写しなので、同じ行かは中身で見る（#1950 以降）。
            if (id === HQ.rig.RIG_SCENE && line.text === last.text && line.speaker === last.speaker) HQ.vn.vnTest.turbo = false;
          };
          HQ.giftTask = HQ.rig.giveSumiRig({ bg: "res://assets/backgrounds/bg_tonari_inside.png" })
            .then(result => { HQ.giftDone = true; return result; });
        });
        // VNの既存の誤クリック防止(320ms)が明けてから、通常のpointer入力を送る。
        await page.waitForFunction(() => !HQ.vn.vnTest.turbo && performance.now() > HQ.giftStarted + 350
          && document.querySelector(".vn-next.show"));
        await hit(page, label, ".vn-box");
        await page.locator(".home-rig-gift").waitFor();
      };
      await startGift();
      const image = page.locator(".home-rig-gift img");
      assert.equal(await image.getAttribute("alt"), "ミャア 卓上台");
      assert.match(await image.getAttribute("src"), /ui\/scene_props\/shisha_home_tabletop\.(webp|png)$/);
      assert(await image.evaluate(n => n.complete && n.naturalWidth > 0), "採用済み卓上台をデコードしてから表示する");
      await assertFits(page, ".home-rig-gift h3, .home-rig-gift img, .home-rig-gift .modal-actions button");
      assert.deepEqual(await page.evaluate(() => HQ.core.state.owned), await page.evaluate(() => HQ.beforeGift.owned));
      assert.equal(await page.evaluate(() => HQ.giftDone), false, "クリック前は受取を確定しない");
      await page.screenshot({ path: `${out}/tabletop-gift-${label}.png`, animations: "disabled" });
      await hit(page, label, '[data-test="home-rig-gift-close"]');
      assert.equal(await page.evaluate(() => HQ.giftTask), true);
      assert.equal(await page.locator(".home-rig-gift").count(), 0);
      const result = await page.evaluate(async () => {
        const before = HQ.beforeGift, after = structuredClone(HQ.core.state);
        HQ.core.load();
        return { before, after, loaded: structuredClone(HQ.core.state), repeated: await HQ.rig.giveSumiRig() };
      });
      assert.equal(result.after.owned.filter(id => id === "home_rig_set").length, 1);
      for (const key of ["flavorStock", "money", "stamina", "day", "slot", "stats", "statXp"]) {
        assert.deepEqual(result.after[key], result.before[key], key);
        assert.deepEqual(result.loaded[key], result.after[key], `LOAD ${key}`);
      }
      assert.equal(result.repeated, false);
      assert.equal(await page.locator(".home-rig-gift").count(), 0, "受領済みでは表示を繰り返さない");

      // 表示中に別SAVEをLOADしたら、そのSAVEへ台を付与しない。
      await page.evaluate(() => { HQ.core.newGame(); HQ.core.saveToSlot("suien_remake_slot1"); });
      await startGift();
      await page.evaluate(() => HQ.core.loadFromSlot("suien_remake_slot1"));
      await hit(page, label, '[data-test="home-rig-gift-close"]');
      assert.equal(await page.evaluate(() => HQ.giftTask), false);
      assert(!await page.evaluate(() => HQ.core.state.owned.includes("home_rig_set")));
    }, opts);

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
      await page.screenshot({ path: `${out}/${label}-bedtime.jpg`, type: "jpeg", quality: 82, animations: "disabled" });
      if (label === "touch") await assertTouchModalBackground(page);
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
        await assertFits(page, '[data-test="map-go"]');
        await page.screenshot({ path: `${out}/${label}-preview-${tod}.jpg`, type: "jpeg", quality: 82 });
        await page.evaluate(() => homeMap.interruptMap("rest"));
      }
      await page.evaluate(async () => {
        const worker = (await import("./js/craft/worker.js")).buildWorkerScene({ mode: "drill", venue: "home" });
        HQ.ui.showScreen("home", worker.root); await worker.ready;
      });
      // #873: 制作中は大会用の台だけ。家の練習窓・作業台の背景に所持品の台を置かない。
      assert.deepEqual(await rigs(page, ".bench-worker-stage"), [], "Home practice window shows only the tournament rig");
      assert.equal(await page.locator(".bench-worker-stage .scene-art, .bench-worker-stage [data-home-scene]").count(), 0);
      await page.evaluate(async () => HQ.ui.setBg(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay()), { instant: true, homeRigs: false }));
      assert.deepEqual(await rigs(page), [], "Craft bench background has no owned rigs");
      assert.deepEqual(await page.evaluate(() => HQ.art.sceneArtUrls(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay()), { homeRigs: false }).length), 1);
      // 制作を終えて家の場面へ戻れば、所持品の台はそのまま出る。
      await page.evaluate(async () => HQ.ui.setBg(HQ.data.bgUrl("bg_home", HQ.core.timeOfDay()), { instant: true }));
      assert.deepEqual(await rigs(page), variants[3], "Home scene keeps the owned rigs after crafting");
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
