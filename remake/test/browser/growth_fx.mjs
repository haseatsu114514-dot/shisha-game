// 心得の盤・レベルアップの演出（SBD102〜105）と、ストックしてから観音堂でまとめて見せる流れ（SBD108〜110）を実DOMで確かめる。
// 飾りは規則を変えない: 火種の数・灯したマス・保存は今までどおりで、動きを減らす設定では待たずに閉じる。
import assert from "node:assert/strict";
import { suite, baseURL, assertFits } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;

async function setupDaily(page, { chapter = 1 } = {}) {
  await page.evaluate(async (chapter) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90, chapter });
    core.config.bgmVolume = 0; core.config.seVolume = 0; core.config.voiceBlip = false;
    const ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js"), hud = await import("./js/daily/hud.js");
    ui.showScreen("map", document.createElement("div"));
    await ui.setBg(data.bgUrl("bg_home", "night"), { fast: true });
    hud.initHud({ phone() {}, status() {}, menu() {} });
    hud.showHud(true);
    (await import("./js/core/growth.js")).ensureGrowth().ringsOpen = chapter;
    s.growth.seenRing = chapter;
  }, chapter);
}
/** ストックした分のフル演出（観音堂などの内省が呼ぶもの）を直接出す */
const present = (page) => page.evaluate(async () => {
  window.night = null;
  void (await import("./js/daily/levelup.js")).presentStockedGrowth().then((r) => { window.night = r; });
});
const settled = (page) => page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state"));

await suite("growth-fx", async (check) => {
  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-levelup-rewards`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page);
      // 経験値が入ったその場でレベルが上がり、火種が手持ちに入る。寝る前の演出は出ない。HUD に小さく知らせる
      await page.evaluate(async () => { const g = await import("./js/core/growth.js"); g.gainExp(g.totalExpFor(3)); });
      assert.deepEqual(await page.evaluate(() => ({ level: __remake.state.growth.level, fire: __remake.state.growth.hidane.any })), { level: 3, fire: 4 });
      assert.match(await page.locator(t("stock-chip")).innerText(), /LEVEL UP Lv\.3[\s\S]*火種 ＋4/);
      await assertFits(page, t("stock-chip"));
      await page.locator(".gain-card", { hasText: "火種をストックした" }).waitFor();
      assert.match(await page.locator(t("hud-exp")).innerText(), /Lv\.3[\s\S]*Lv UP ×2/, "見せていないレベルアップがある間は HUD に出す");
      assert.equal(await page.locator(t("hud-hidane")).innerText(), "4");
      assert.equal(await page.locator(t("levelup")).count(), 0);
      const quiet = await page.evaluate(async () => { const r = await (await import("./js/core/growth.js")).presentNight(); return { panel: !!document.querySelector(".levelup-backdrop, .levelup-band"), to: r.to, from: r.from }; });
      assert.deepEqual(quiet, { panel: false, from: 1, to: 3 }, "寝る前は何も出さず、ストックも残す");

      // ストックした分のフル演出: 火種の札・次の節目・手持ち。白火だけなら色の火の説明を出さない
      await present(page);
      const panel = page.locator(t("levelup"));
      await panel.waitFor();
      await tap(".levelup-backdrop");
      await settled(page);
      assert.deepEqual(await page.locator(`${t("levelup-rewards")} .lu-chip`).allInnerTexts(), ["火種 ＋4"]);
      assert.match(await panel.innerText(), /Lv\.1 → Lv\.3/);
      assert.match(await page.locator(t("levelup-next")).innerText(), /次の節目 Lv\.10（色の火がもらえる）まで あと7/);
      assert.match(await page.locator(t("levelup-wallet")).innerText(), /手持ちの火種[\s\S]*白火 4/);
      assert.equal(await page.locator(t("levelup-color-note")).count(), 0);
      assert.equal(await page.locator(t("levelup-board")).count(), 0, "盤はこのあと開くので、盤を見るボタンは無い");
      assert.equal(await page.locator(".lu-chip .hidane-icon.has-img").count() > 0, true, "火種の粒は盤と同じ絵");
      await assertFits(page, t("levelup"));
      await tap(t("levelup-ok"));
      await page.waitForFunction(() => window.night?.to === 3);
      await panel.waitFor({ state: "detached" });
      assert.equal(await page.evaluate(async () => (await import("./js/core/growth.js")).hasGrowthStock()), false, "見終えたらストックは空");
      assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).peekSave()?.growth?.today?.from ?? null), null, "見終えたことを保存する");
      await page.waitForFunction(() => !/Lv UP/.test(document.querySelector('[data-test="hud-exp"]').textContent));

      // 何回かに分けてためた分も、一つの演出にまとまる。節目（第1章）は色の火1＋白火1で、色の火は台座の鍵だと伝える
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
        g.gainExp(g.totalExpFor(8) - gr.xp, { key: "sumi" });
        gr.today.gifts.push({ label: "斧投げで Aランク", parts: [g.giveColored(gr, "body", 1)] });
        g.gainExp(g.totalExpFor(10) - gr.xp + 10, { key: "kannon" });
      });
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 10);
      await present(page);
      await panel.waitFor();
      await tap(".levelup-backdrop");
      await settled(page);
      const chips = await page.locator(`${t("levelup-rewards")} .lu-chip`).allInnerTexts();
      assert.equal(chips[0], "火種 ＋14", "Lv.3→10 のレベルの白火");
      assert.match(chips[1], /^(紅火|蒼火|翠火) ＋1$/, "節目の色の火は1つ");
      assert.equal(chips[2], "白火 ＋1", "節目の白火");
      assert.equal(await page.locator(`${t("levelup-rewards")} .lu-chip.milestone`).count(), 2);
      assert.match(await panel.innerText(), /Lv\.3 → Lv\.10[\s\S]*節目の Lv\.10！ (紅火|蒼火|翠火)と白火を1つずつ/);
      assert.match(await panel.innerText(), /学んできたこと：/);
      assert.match(await page.locator(t("levelup-color-note")).innerText(), /色の台座」にはめる鍵。台座は物語が進むと盤に現れる/);
      assert.equal(await page.locator(t("levelup-gift")).count(), 1);
      assert.match(await panel.innerText(), /斧投げで Aランク[\s\S]*紅火 ＋1/);
      assert.equal(await panel.evaluate((node) => node.classList.contains("milestone")), true);
      await assertFits(page, t("levelup"));
      await assertFits(page, t("levelup-ok"));
      await tap(t("levelup-ok"));
      await panel.waitFor({ state: "detached" });

      // ご褒美だけ（レベルは上がっていない）でも、同じ画面で見せる
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
        __remake.state.affinity.minto = 999; __remake.state.flags._met_minto = true;
        window.heart = g.giftAtMaxHeart("minto");
      });
      assert.deepEqual(await page.evaluate(() => window.heart), [{ kind: "body", n: 1 }, { kind: "any", n: 1 }], "♥5は色の火1＋白火1（SBD109）");
      await present(page);
      await panel.waitFor();
      await tap(".levelup-backdrop");
      await settled(page);
      assert.equal(await panel.evaluate((node) => node.classList.contains("gift-only")), true);
      assert.doesNotMatch(await panel.innerText(), /→/);
      assert.match(await panel.innerText(), /紅火 ＋1[\s\S]*白火 ＋1/);
      await tap(t("levelup-ok"));
      await panel.waitFor({ state: "detached" });

      // 台座が盤に出ている章（第2章〜）は、はめると道が開く、と伝える
      const note = await page.evaluate(async () => {
        __remake.state.chapter = 2;
        const { colorFireNote } = await import("./js/daily/levelup.js");
        return colorFireNote({ gains: { any: 2, limited: [{ level: 20, system: "sense", n: 1, any: 1 }] }, gifts: [] });
      });
      assert.match(note, /はめると、その先の道が開く/);
    }, options);
  }

  // 観音堂で振り返る: 内省の場面 → ためた分のフル演出 → 盤（灯せる）。演出を見終えるまで盤は開かない
  await check("reflection-presents-stock-then-board", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js");
      __remake.state.flags._board_starter_given = true; __remake.state.flags._board_tutorial_done = true;
      g.gainExp(g.totalExpFor(4) + 5);
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      window.lit = (await import("./js/daily/reflection.js")).reflectAt("kannon");
    });
    const panel = page.locator(t("levelup"));
    await panel.waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("growth-board")).count(), 0, "演出の間は盤を開かない");
    assert.match(await panel.innerText(), /Lv\.1 → Lv\.4[\s\S]*火種 ＋6/);
    await page.locator(".levelup-backdrop").click();
    await settled(page);
    await page.locator(t("levelup-ok")).click();
    await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
    assert.match(await page.locator(t("board-wallet")).innerText(), /白火\s*6/);
    assert.equal(await page.evaluate(async () => (await import("./js/core/growth.js")).hasGrowthStock()), false);
    await page.locator(t("board-close")).click();
    await page.locator(t("growth-board")).waitFor({ state: "detached" });
    // 2回目は見せるものが無いので、演出を挟まずに盤が開く
    await page.evaluate(async () => { window.lit = (await import("./js/daily/reflection.js")).reflectAt("kannon"); });
    await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("levelup")).count(), 0);
    await page.locator(t("board-close")).click();
  }, { viewport: { width: 1331, height: 760 } });

  // 受け取りの上限に届いた後のレベルアップは、火種が増えない理由を一言で出す
  await check("capped-levelup-explains", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
      Object.assign(gr, { level: 70, xp: g.totalExpFor(70), settledXp: g.totalExpFor(70), earned: g.BOARD_TOTAL });
      gr.hidane.any = 9;
      g.gainExp(g.totalExpFor(72) + 5 - gr.xp);
    });
    await present(page);
    await page.locator(t("levelup")).waitFor();
    await page.locator(".levelup-backdrop").click();
    await settled(page);
    assert.match(await page.locator(t("levelup")).innerText(), /火種は盤の全部のぶんを受け取った/);
    assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 9, "上限の後は増えない");
    await page.locator(t("levelup-ok")).click();
  }, { viewport: { width: 1331, height: 760 } });

  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-board-light-and-commit`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page, { chapter: 2 });
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
        __remake.state.flags._board_starter_given = true; __remake.state.flags._board_tutorial_done = true;
        Object.assign(gr, { hidane: { any: 20, body: 2, sense: 0, wisdom: 0 }, earned: 22, target: "K07" });
        window.boardDone = g.openGrowthBoard({ place: "kannon" });
      });
      const board = page.locator(t("growth-board"));
      await page.locator(`${t("growth-board")}[data-art]`).waitFor();
      // 近い目的地: 3つまで。結界の先・まだ分からない授業・現れていないスキルは出さない
      await page.locator(t("board-node-K07")).evaluate((node) => node.blur());
      await tap(t("board-tab-sense"));
      const goals = page.locator(`${t("board-goals")} .gb-goal`);
      assert.equal(await goals.count(), 3);
      const names = await goals.locator(".gb-goal-name").allInnerTexts();
      assert(names.some((name) => /スミさんの授業「蒸らしアタック」/.test(name)), `会っている人の近い授業が出る: ${names}`);
      assert(!names.some((name) => /？？？|龍の煙|炭の声/.test(name)), `伏せている中身は出さない: ${names}`);
      await assertFits(page, t("board-goals"));
      const first = await goals.first().getAttribute("data-test");
      await goals.first().click();
      assert.equal(await page.locator(`.gb-node.selected`).getAttribute("data-test"), first.replace("board-goal-", "board-node-"));

      // 目標（空気を読む）まで灯す: 火種が飛び、盤の中に光が出る。仮置きの数と財布は今までどおり
      await tap(t("board-tab-body"));
      await tap(t("board-node-K07"));
      await tap(t("board-towards"));
      await page.locator(".gb-fx .gfx-ring").first().waitFor({ state: "attached" });
      assert.equal(await page.locator(".gb-node.s-pending").count(), 7, "紋から K07 まで7マス");
      assert.match(await page.locator(t("board-wallet")).innerText(), /白火\s*10[\s\S]*紅火\s*1/, "白火10・紅火1を払う");
      await page.waitForFunction(() => !document.querySelector(".gfx-fly"));

      // 決定: 保存してから演出。スキル・色の台座・要のマスをカットインで出し、押すと次へ進む
      await tap(t("board-decide"));
      const cutin = page.locator(t("board-cutin"));
      await cutin.waitFor();
      assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).peekSave()?.growth?.nodes?.includes("K07") ?? null), true, "演出の前に保存済み");
      assert.match(await cutin.innerText(), /SKILL[\s\S]*空気を読む[\s\S]*1\/3/);
      await assertFits(page, ".gfx-cutin");
      await cutin.dispatchEvent("pointerdown");
      await page.waitForFunction(() => /色の台座/.test(document.querySelector('[data-test="board-cutin"]')?.textContent || ""));
      assert.match(await cutin.innerText(), /紅火がはまった[\s\S]*2\/3/);
      await cutin.dispatchEvent("pointerdown");
      await page.waitForFunction(() => /要のマス/.test(document.querySelector('[data-test="board-cutin"]')?.textContent || ""));
      assert.match(await cutin.innerText(), /人懐こい/);
      await cutin.dispatchEvent("pointerdown");
      await board.waitFor({ state: "detached" });
      const result = await page.evaluate(async () => ({ lit: (await window.boardDone).map((n) => n.id), g: __remake.state.growth }));
      assert.equal(result.lit.length, 7);
      assert(result.lit.includes("K07") && result.lit.includes("BG1"));
      assert.deepEqual(result.g.hidane, { any: 10, body: 1, sense: 0, wisdom: 0 });
      await page.locator(".gain-card", { hasText: "空気を読む" }).waitFor();
    }, options);
  }

  // 動きを減らす設定: 光もカットインも出さず、待たずに閉じる。灯した結果は同じ
  await check("reduced-motion-skips-effects", async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupDaily(page, { chapter: 2 });
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
      __remake.state.flags._board_starter_given = true; __remake.state.flags._board_tutorial_done = true;
      Object.assign(gr, { hidane: { any: 20, body: 2, sense: 0, wisdom: 0 }, earned: 22, target: "K07" });
      window.cutins = 0;
      new MutationObserver(() => { if (document.querySelector('[data-test="board-cutin"], .gfx-ring, .gfx-fly, .gfx-spark')) window.cutins++; }).observe(document.body, { childList: true, subtree: true });
      window.boardDone = g.openGrowthBoard({ place: "kannon" });
    });
    await page.locator(`${t("growth-board")}[data-art]`).waitFor();
    assert.equal(await page.locator(".gb-embers").evaluate((node) => getComputedStyle(node).display), "none");
    await page.locator(t("board-towards")).click();
    const started = Date.now();
    await page.locator(t("board-decide")).click();
    await page.locator(t("growth-board")).waitFor({ state: "detached" });
    assert(Date.now() - started < 1500, "演出の待ちを作らない");
    assert.equal(await page.evaluate(() => window.cutins), 0, "光・カットインを出さない");
    assert.equal(await page.evaluate(async () => (await window.boardDone).length), 7);
  }, { viewport: { width: 1331, height: 760 } });
}, { entry: `${baseURL}?growth=1`, acknowledgeGrowth: false });
