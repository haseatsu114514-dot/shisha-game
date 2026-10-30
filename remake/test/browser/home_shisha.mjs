// 家の一服を実DOMで操作し、葉・体力・能力端数と保存復帰を検証する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
fs.mkdirSync(out, { recursive: true });
const t = id => `[data-test="${id}"]`;
const recipes = JSON.parse(fs.readFileSync(new URL("../../../data/recipes.json", import.meta.url), "utf8")).recipes;
const flavors = JSON.parse(fs.readFileSync(new URL("../../../data/flavors.json", import.meta.url), "utf8")).flavors;
const flavorById = Object.fromEntries(flavors.map(flavor => [flavor.id, flavor]));
const leafName = id => String(flavorById[id]?.short_name || flavorById[id]?.name || id).split(" ").pop();
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
  await check("all-discovered-recipe-details", async page => {
    assert.equal(recipes.length, 13, "Current regular recipe catalog has 13 entries");
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { DB } = await import("./js/core/data.js");
      const state = core.newGame();
      state.recipes = Object.fromEntries(DB.recipes.map(recipe => [recipe.id, { day: 8 }]));
      void (await import("./js/daily/status.js")).openStatus();
    });
    await page.locator('[data-tab="items"]').click();
    assert.equal(await page.locator('[data-recipe]').count(), recipes.length);
    for (const recipe of recipes) {
      await page.locator(t(`recipe-${recipe.id}`)).click();
      const detail = await page.locator(t("recipe-detail")).innerText();
      assert(detail.includes(recipe.name), `${recipe.id}: name`);
      assert(detail.includes(`材料：${recipe.flavors.map(leafName).join(" ／ ")}`), `${recipe.id}: ingredients`);
      const ratio = recipe.golden
        ? `${Object.entries(recipe.golden).map(([id, weight]) => `${leafName(id)} ${weight}`).join("：")}（割合）`
        : "未設定";
      assert(detail.includes(`黄金比：${ratio}`), `${recipe.id}: golden ratio`);
      assert(detail.includes("発見日：DAY 8"), `${recipe.id}: discovery day`);
      await page.locator(t("recipe-back")).click();
    }
    await page.locator(t("status-close")).click();
  });
  // #1906: 家で発見した配合を、在庫や保存内容を変えずにレシピ帳で読み返す。
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["portrait", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-discovered-recipe-details`, async page => {
      const before = await page.evaluate(async portrait => {
        if (portrait) {
          const layout = await import("./js/scenes/title-layout.js");
          localStorage.setItem(layout.TITLE_LAYOUT_KEY, "ds");
          (await import("./js/core/ui.js")).showScreen("home", document.createElement("div"));
          window.dispatchEvent(new Event("display-layout-change"));
        }
        const core = await import("./js/core/state.js"), s = core.newGame();
        s.recipes = { ice_lemonade: { day: 3, home: true }, sumi_basic: true, secret_probe: { day: 1 } };
        s.flavorStock = {}; // 閲覧には材料の在庫を要求しない。
        core.save(); core.load();
        window.recipeClosed = false;
        void (await import("./js/daily/status.js")).openStatus().then(() => { recipeClosed = true; });
        return JSON.stringify(core.state);
      }, label === "portrait");
      const storage = await storageSnapshot(page);
      await page.locator('[data-tab="items"]').click();
      assert.equal(await page.locator('[data-recipe]').count(), 2);
      assert.equal(await page.locator(t("recipe-peach_sorbet")).count(), 0, "未発見は名前も操作も出さない");
      assert.equal(await page.locator(t("recipe-secret_probe")).count(), 0, "未知・裏レシピの保存IDを露出しない");
      await page.locator(t("recipe-ice_lemonade")).scrollIntoViewIfNeeded();
      if (options.hasTouch) await page.locator(t("recipe-ice_lemonade")).tap();
      else {
        await page.locator(t("recipe-ice_lemonade")).focus();
        await page.keyboard.press("Enter");
      }
      const detail = page.locator(t("recipe-detail"));
      assert.match(await detail.innerText(), /材料：.*ミント.*レモン/);
      assert.match(await detail.innerText(), /黄金比：.*レモン 7：.*ミント 3（割合）/);
      assert.match(await detail.innerText(), /発見日：DAY 3/);
      assert.match(await detail.innerText(), /発見時のグラム数は記録していない/);
      assert.doesNotMatch(await detail.innerText(), /白桃ソルベ|secret_probe/);
      await assertFits(page, '[data-test="recipe-detail"]');
      await page.locator(t("recipe-back")).scrollIntoViewIfNeeded();
      await assertFits(page, '[data-test="recipe-back"]');
      await page.screenshot({ path: `${out}/recipe-details-${label}.png` });
      assert.equal(await page.evaluate(() => recipeClosed), false, "詳細閲覧中もSTATUSの呼出元を再開しない");
      await page.locator(t("recipe-back")).click();
      assert.equal(await page.locator('[data-tab="items"].on').count(), 1);
      assert(await page.locator(t("recipe-ice_lemonade")).evaluate(node => node === document.activeElement));
      await page.locator(t("recipe-sumi_basic")).click();
      assert.match(await detail.innerText(), /黄金比：未設定/);
      assert.match(await detail.innerText(), /発見日：記録なし/);
      assert.equal(await page.evaluate(() => JSON.stringify(__remake.state)), before);
      assert.deepEqual(await storageSnapshot(page), storage, "閲覧と戻る操作は保存も消費も行わない");
      await page.locator(t("status-close")).click();
      await page.waitForFunction(() => recipeClosed);
      // 旧セーブの未知IDだけでは、空の帳面に名前を作らない。
      await page.evaluate(async () => {
        __remake.state.recipes = { secret_probe: { day: 1 } };
        void (await import("./js/daily/status.js")).openStatus();
      });
      await page.locator('[data-tab="items"]').click();
      assert.equal(await page.locator('[data-recipe]').count(), 0);
      assert.match(await page.locator('.st-items').innerText(), /まだ白紙/);
      // 持ち物・発見数が増えても、詳細先頭と元のスクロール位置へ戻れる。
      const lastId = await page.evaluate(async () => {
        const { DB } = await import("./js/core/data.js");
        __remake.state.flavorStock = Object.fromEntries(DB.flavors.map(f => [f.id, 50]));
        __remake.state.recipes = Object.fromEntries(DB.recipes.map(r => [r.id, { day: 8 }]));
        return DB.recipes.at(-1).id;
      });
      await page.locator('[data-tab="items"]').click();
      const last = page.locator(t(`recipe-${lastId}`));
      await last.scrollIntoViewIfNeeded();
      const scrollTop = await page.locator('.status-modal .modal-body').evaluate(node => node.scrollTop);
      assert(scrollTop > 0);
      await last.click();
      assert.equal(await page.locator('.status-modal .modal-body').evaluate(node => node.scrollTop), 0);
      await page.locator(t("recipe-back")).click();
      assert.equal(await page.locator('.status-modal .modal-body').evaluate(node => node.scrollTop), scrollTop);
    }, options);
  }

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
      assert.deepEqual(before.flavorStock, { lemon: 20, mint: 20 }, "The rig gift and repeated receipt must leave all private leaves unchanged");

      await offer(page);
      assert.match(await page.locator(".home-shisha-dialog").innerText(), /寝る前の家シーシャ/);
      assert.doesNotMatch(await page.locator(".home-shisha-dialog").innerText(), /体力\s*[+＋−-]?\d/);
      assert.match(await page.locator(".home-shisha-dialog").innerText(), /体力を使う/);
      assert.doesNotMatch(await page.locator(".home-shisha-dialog").innerText(), /大きく減る|配合/);
      await hit("home-shisha-mix");
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
      // 体力-24は根性で軽くなる。根性30＝10段の3段目（STATUS-P1）で -22.67 → 80から57。
      assert.deepEqual(after, { ...before, flavorStock: { ...before.flavorStock, lemon: 11, mint: 17 }, stamina: 57, statXp: {} });
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js"); core.load(); core.save(); core.load();
        window.repeatOffer = (await import("./js/daily/home-shisha.js")).homeShishaOffer();
      });
      assert.deepEqual(await snapshot(page), after, "Reload must preserve the half point and consumption");
      assert.equal(await page.evaluate(() => repeatOffer), null, "Same night cannot be smoked twice after LOAD");

      await page.evaluate(() => { __remake.state.day++; });
      await offer(page); await hit("home-shisha-recipe");
      await page.locator(t("home-recipe-ice_lemonade")).waitFor();
      assert.doesNotMatch(await page.locator(".home-shisha-dialog").innerText(), /配合/);
      await assertFits(page, ".home-shisha-dialog .modal-actions button");
      await page.evaluate(() => { __remake.vnTest.turbo = true; });
      await hit("home-recipe-ice_lemonade"); await page.waitForFunction(() => homeDone === true);
      assert.deepEqual(await snapshot(page), { ...after, flavorStock: { ...after.flavorStock, lemon: 3, mint: 13 }, stamina: 34,
        stats: before.stats, statXp: {} });
    }, options);
  }

  // #1081 D04-D06: HUDの現在色・回復後・誘い中LOAD・単品の文言。
  for (const [label, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-health-and-offer-load`, async page => {
      const hit = async id => label === "touch" ? page.locator(t(id)).tap() : page.locator(t(id)).click();
      await page.evaluate(async () => {
        window.H = { core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
          hud: await import("./js/daily/hud.js"), home: await import("./js/daily/home-shisha.js") };
        const s = H.core.newGame(); Object.assign(s, {phase:"daily",day:8,slot:2,stamina:80});
        s.stats.guts = 0; s.flags._sumi_double_apple_received = true; s.flavorStock = {mint:30};
        H.hud.initHud({}); H.hud.showHud(); __remake.vnTest.turbo = false;
      });
      assert.equal(await page.evaluate(() => H.home.homeShishaOffer()), null, "台なし");
      await page.evaluate(() => H.core.state.owned.push("home_rig_set"));
      for (const [before, after, health] of [[25,25,"red"],[50,50,"yellow"],[51,51,"green"],[80,45,"yellow"],[10,40,"yellow"],[40,70,"green"]]) {
        const result = await page.evaluate(({before,after}) => {
          H.core.state.stamina=before; H.stats.addStamina(after-before); H.hud.updateHud();
          return {health:document.querySelector('.hud-stamina').dataset.health, offered:!!H.home.homeShishaOffer()};
        }, {before,after});
        assert.deepEqual(result,{health,offered:health==="green"});
        if (health === "green") { await offer(page); await hit("home-shisha-skip"); await page.waitForFunction(()=>homeDone===false); }
        else assert.equal(await page.evaluate(()=>H.home.runHomeShisha()),false);
      }
      // 実保存APIで黄色の別セーブをLOADし、緑の旧誘いを押しても消費しない。
      await page.evaluate(()=>{H.core.state.stamina=50;H.core.saveToSlot("suien_remake_slot1");H.core.state.stamina=80;});
      await offer(page);
      const loaded = await page.evaluate(()=>{H.core.loadFromSlot("suien_remake_slot1");return structuredClone(H.core.state);});
      await hit("home-shisha-mix"); await page.waitForFunction(()=>homeDone===false);
      assert.deepEqual(await page.evaluate(()=>structuredClone(H.core.state)),loaded);
      assert.equal(await page.evaluate(()=>H.home.runHomeShisha()),false);
      assert.equal(await page.locator(t("home-shisha-mix")).count(),0);
      assert.equal(loaded.owned.filter(id=>id==="home_rig_set").length,1);
      // 単品でも選択画面・感想に「配合」と表示しない。
      await page.evaluate(()=>{H.core.state.stamina=80;window.homeLines=[];
        __remake.vnTest.turbo=true;});
      await offer(page); await hit("home-shisha-mix");
      assert.doesNotMatch(await page.locator(".home-shisha-dialog").innerText(),/配合/);
      for(let i=0;i<12;i++) await hit("home-plus-mint");
      await page.evaluate(async()=>{const vn=await import("./js/vn/engine.js");vn.hooks.onLine=(_id,line)=>homeLines.push(line.text);__remake.vnTest.turbo=true;});
      await hit("home-mix-ok"); await page.waitForFunction(()=>homeDone===true);
      assert.doesNotMatch((await page.evaluate(()=>homeLines)).join(" "),/配合/);
      assert.match((await page.evaluate(()=>homeLines)).join(" "),/この味の感触/);
    }, options);
  }

  // 実ページの再読み込み→CONTINUEを通し、一服の前・会話中・会話後を検査する。
  // 卓上台と大会台の両方で整数Pへの繰越しを含め、保存済み消費と報酬を照合する。
  for (const [label, rig, growth, options] of [
    ["pc", "home_rig_set", .5, {}],
    ["touch", "home_rig_pro", .75, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) for (const timing of ["before", "during", "after"]) {
    await check(`${label}-${timing}-dialogue-reload`, async page => {
      const hit = async id => label === "touch" ? page.locator(t(id)).tap() : page.locator(t(id)).click();
      await page.evaluate(async rig => {
        const core = await import("./js/core/state.js"), s = core.newGame();
        Object.assign(s, { phase: "daily", day: 8, slot: 2, stamina: 80 });
        s.stats = { technique: 20, sense: 12, guts: 30, charm: 14, insight: 25 };
        s.statXp = { sense: .75 }; s.flavorStock = { lemon: 20, mint: 20 };
        s.owned.push("home_rig_set", ...(rig === "home_rig_pro" ? [rig] : []));
        s.recipes.ice_lemonade = { day: 3 };
        Object.assign(s.flags, { _ev_salaryman: true, _ev_first_practice: true, _ev_day5: true,
          _ev_midcheck: true, _sumi_double_apple_received: true, _tsumugi_contest_research: true, _tsumugi_contest_progress: true,
          _hiyori_meeting_done: true, _hiyori_message_delivered: true, _lime_tut: true,
          _lime_opened: true, _morning_8: true, _home_tonight: true });
        Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
        core.saveConfig(); core.save();
      }, rig);
      const before = await snapshot(page);
      await offer(page); await hit("home-shisha-recipe");
      await page.locator(t("home-recipe-ice_lemonade")).waitFor();
      if (timing !== "before") {
        if (timing === "after") await page.evaluate(() => { __remake.vnTest.turbo = true; });
        await hit("home-recipe-ice_lemonade");
        if (timing === "during") {
          await page.locator("#vn.active .vn-box").waitFor();
          assert.equal(await page.evaluate(() => homeDone), null, "Reload while the home dialogue is still unfinished");
        } else await page.waitForFunction(() => homeDone === true);
      }
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
      const expected = timing === "before" ? before : { ...before, stamina: 57,
        flavorStock: { lemon: 12, mint: 16 }, stats: before.stats, statXp: before.statXp };
      const savedResources = Object.fromEntries(Object.keys(before).map(key => [key, saved[key]]));
      const continueSave = async () => {
        await page.reload();
        await page.locator(t("title-load")).waitFor({ timeout: 30000 });
        await page.locator("#boot").waitFor({ state: "detached" });
        await page.evaluate(() => { __remake.vnTest.turbo = true; });
        await hit("title-load"); await hit("slot-0");
        await page.waitForFunction(() => __remake.state.day === 9 && __remake.state.slot === 0
          && document.querySelector('[data-destination-selection]:not(.done)'), null, { timeout: 30000 });
      };
      await continueSave();
      // 一日の終わりを再開した最初のCONTINUEだけ、通常の就寝回復14を受ける。
      const resumed = { ...expected, slot: 0, stamina: expected.stamina + 14 };
      assert.deepEqual(await snapshot(page), resumed, `${timing}: CONTINUE must preserve consumption and its full growth`);
      assert.deepEqual(savedResources, expected, `${timing}: consumption, completion and growth must share a save`);
      assert.equal(saved.flags._home_shisha_day, timing === "before" ? undefined : "1:8");
      assert.equal(await page.evaluate(() => __remake.state.flags._home_shisha_day), saved.flags._home_shisha_day);
      const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save")));
      await continueSave();
      assert.deepEqual(await snapshot(page), resumed, "A second CONTINUE must not grant growth or consume leaves again");
      assert.equal(await page.evaluate(() => __remake.state.flags._home_shisha_day), persisted.flags._home_shisha_day);
    }, options);
  }
});
