// 心得の盤・レベルアップの演出（SBD102〜105）と、ストックしてから観音堂でまとめて見せる流れ（SBD108〜110）、
// 絵と数だけの画面と絵つきの「？」（SBD116〜119）を実DOMで確かめる。
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
/** もらった火種の大きな粒: [種類, 見える数, 読み上げの文] */
const bigFires = (page) => page.locator(`${t("levelup-rewards")} .lu-big`).evaluateAll((nodes) => nodes.map((n) => [n.className.match(/k-(\w+)/)[1], n.querySelector("b").textContent, n.querySelector(".lu-sr").textContent]));
/** 画面に見えている文字（読み上げ用の文を除く）。絵と数だけにした画面で、文が戻っていないことを見る */
const visibleText = (page, sel) => page.locator(sel).evaluate((node) => { const copy = node.cloneNode(true); copy.querySelectorAll(".lu-sr, .gb-sr").forEach((n) => n.remove()); return copy.textContent.replace(/\s+/g, ""); });

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

      // ストックした分のフル演出: 絵と数だけ（大きな粒と ×N）。説明の文は出さず、「？」の見方に寄せる（SBD116）
      await present(page);
      const panel = page.locator(t("levelup"));
      await panel.waitFor();
      await tap(".levelup-backdrop");
      await settled(page);
      assert.deepEqual(await bigFires(page), [["any", "×4", "白火 ＋4"]]);
      assert.match(await panel.innerText(), /Lv\.1 → Lv\.3/);
      assert.equal(await visibleText(page, t("levelup")), "LEVELUPLv.3Lv.1→Lv.3×4盤へ？", "見えるのは見出し・レベル・数・ボタンだけ");
      assert.equal(await page.locator(`${t("levelup-next")}, ${t("levelup-wallet")}, ${t("levelup-color-note")}, ${t("levelup-sources")}`).count(), 0, "次の節目・手持ち・色の火の説明は出さない");
      assert.equal(await page.locator(t("levelup-board")).count(), 0, "盤はこのあと開くので、盤を見るボタンは無い");
      assert.equal(await page.locator(".lu-big .hidane-icon.has-img").count() > 0, true, "火種の粒は盤と同じ絵");
      await assertFits(page, t("levelup"));
      await assertFits(page, t("levelup-help"));

      // 「？」: 火種のページから開く絵つきの見方。ページを送れて、閉じると元の画面に戻る
      await tap(t("levelup-help"));
      const help = page.locator(t("board-help-pages"));
      await help.waitFor();
      assert.equal(await help.locator(".gh-page").getAttribute("data-page"), "fire");
      assert.match(await help.innerText(), /2\/7[\s\S]*白火[\s\S]*色の台座[\s\S]*節目（Lv\.10ごと）[\s\S]*大会で優勝/);
      assert.equal(await help.locator(".gh-gain").count(), 6, "もらえる時は6つ");
      await page.waitForFunction(() => { const imgs = [...document.querySelectorAll(".gh-page .gh-pic")]; return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0); }, null, { timeout: 10000 }); // 見本は盤と同じ絵が読めている
      await tap(t("board-help-next"));
      assert.equal(await help.locator(".gh-page").getAttribute("data-page"), "kinds");
      assert.equal(await help.locator(".gh-row").count(), 7, "マスの種類は7つ");
      await tap(t("board-help-tab-perks"));
      const perks = await help.locator("[data-perk]").evaluateAll((rows) => rows.map((row) => [row.dataset.perk, row.querySelector("b").textContent, row.querySelector(".gh-text span").textContent]));
      assert.equal(perks.length, 12, "能力は12");
      assert(perks.every(([key, name, text]) => key && name && text), `どの能力にも名前と一言がある: ${JSON.stringify(perks)}`);
      for (const id of ["flow", "fire", "kinds", "perks", "states", "how", "rules"]) {
        await tap(t(`board-help-tab-${id}`));
        await assertFits(page, t("board-help-pages"));
        await assertFits(page, t("board-help-next"));
        await assertFits(page, t("board-help-close"));
      }
      assert.equal(await page.locator(t("board-help-next")).isDisabled(), true, "最後のページでは「次へ」を押せない");
      await tap(t("board-help-close"));
      await help.waitFor({ state: "detached" });
      await panel.waitFor();
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
      // 大きな粒は種類ごとの合計: 白火＝レベル7つ分の14＋節目の1、色の火＝節目の1＋斧投げの紅火1
      const fires = await bigFires(page);
      assert.deepEqual(fires[0], ["any", "×15", "白火 ＋15"]);
      assert.equal(fires.slice(1).reduce((sum, f) => sum + Number(f[1].slice(1)), 0), 2, `色の火は合わせて2: ${JSON.stringify(fires)}`);
      assert.match(await panel.innerText(), /Lv\.3 → Lv\.10/);
      // 内訳は小さな札（節目は ★Lv.10、ご褒美は短い名札）。長い文は読み上げと説明（title）に残す
      const milestone = page.locator(t("levelup-milestone"));
      assert.equal(await milestone.count(), 1);
      assert.equal(await milestone.locator(".lu-src-tag").innerText(), "★Lv.10");
      assert.match(await milestone.locator(".lu-sr").textContent(), /^節目の Lv\.10：(紅火|蒼火|翠火) ＋1　白火 ＋1$/, "節目は色の火1＋白火1");
      assert.equal(await milestone.locator(".lu-mini").count(), 2);
      const gift = page.locator(t("levelup-gift"));
      assert.equal(await gift.count(), 1);
      assert.equal(await gift.locator(".lu-src-tag").innerText(), "斧投げ");
      assert.match(await gift.locator(".lu-sr").textContent(), /斧投げで Aランク：紅火 ＋1/);
      assert.match(await gift.getAttribute("title"), /斧投げで Aランク/);
      assert.match(await page.locator(t("levelup-learned")).getAttribute("title"), /^学んできたこと：/);
      assert.equal(await page.locator(`${t("levelup-learned")} :is(.lu-face, .lu-src-tag)`).count(), 1, "学んできた相手（スミさん）は顔で出す（絵が読めない時は短い名札）。場所は説明だけ");
      assert((await visibleText(page, t("levelup"))).length < 60, "見える文字は短い札だけ");
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
      assert.deepEqual(await bigFires(page), [["any", "×1", "白火 ＋1"], ["body", "×1", "紅火 ＋1"]]);
      assert.match(await page.locator(`${t("levelup-gift")} .lu-sr`).textContent(), /.+から：紅火 ＋1　白火 ＋1$/, "贈り主の札（顔か名前）と、読み上げの文（名前はその時の呼び名）");
      assert.equal(await page.locator(`${t("levelup-gift")} :is(.lu-src-face, .lu-src-tag)`).count(), 1);
      await tap(t("levelup-ok"));
      await panel.waitFor({ state: "detached" });
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
    assert.match(await panel.innerText(), /Lv\.1 → Lv\.4/);
    assert.deepEqual(await bigFires(page), [["any", "×6", "白火 ＋6"]]);
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
      // 行は絵・短い名前・火種の粒と数だけ。長い名前（誰の授業か・あと火種いくつ）は説明（title）と読み上げに残す
      const names = await goals.locator(".gb-goal-name").allInnerTexts(), titles = await goals.evaluateAll((rows) => rows.map((row) => row.title));
      assert(names.includes("蒸らしアタック") && titles.some((title) => /スミさんの授業「蒸らしアタック」/.test(title)), `会っている人の近い授業が出る: ${names} / ${titles}`);
      assert(![...names, ...titles].some((name) => /？？？|龍の煙|炭の声/.test(name)), `伏せている中身は出さない: ${names} / ${titles}`);
      assert.equal(await goals.locator(".gb-goal-icon").count(), 3, "どの行にも絵");
      assert.equal(await goals.locator(".gb-goal-cost").count(), 3, "どの行にも火種の粒か「今」");
      await assertFits(page, t("board-goals"));
      // 右の横棒はアイコン・棒・数字だけ。押すと名前と合計が一行で出て、もう一度押すと閉じる（SBD117）
      assert.deepEqual(await page.locator(`${t("board-bars")} .gb-bar-sum`).allInnerTexts(), ["＋0%", "＋0%", "−0%", "＋0"], "どの能力にも符号つきの短い数字");
      assert.equal(await page.locator(t("board-bar-note")).count(), 0);
      await tap(t("board-bar-heat"));
      assert.match(await page.locator(t("board-bar-note")).innerText(), /火加減[\s\S]*炭焼き・熱管理のジャスト帯 ＋0%/);
      await assertFits(page, t("board-bar-note"));
      await tap(t("board-bar-heat"));
      assert.equal(await page.locator(t("board-bar-note")).count(), 0);
      // 画面の文は短い札と絵だけ: 「灯せる」の札、財布は粒と数、凡例は「？」へ
      assert.equal(await page.locator(`${t("board-place")} .gb-place-chip`).innerText(), "灯せる");
      assert.equal(await page.locator(".gb-legend").count(), 0, "凡例は「？」の見方へ寄せた");
      assert.match(await visibleText(page, t("board-wallet")), /^\d+\d+\d+\d+$/, "財布は粒と数だけ");
      // 盤の「？」も同じ絵つきの見方（何も選んでいない時は「ながれ」から）
      await tap(t("board-help"));
      await page.locator(t("board-help-pages")).waitFor();
      assert.equal(await page.locator(".gh-page").getAttribute("data-page"), "flow");
      assert.equal(await page.locator(".gh-flow > li").count(), 4);
      await tap(t("board-help-close"));
      await page.locator(t("board-help-pages")).waitFor({ state: "detached" });
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
