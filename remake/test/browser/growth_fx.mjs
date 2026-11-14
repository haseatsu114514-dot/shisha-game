// 心得の盤の演出（SBD102〜105）、経験値が届いたその場のレベルアップ（SBD108〜110・SBD122）、
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
/** その場のレベルアップの札（押せない飾り。出て、少しして消える） */
const cutIn = (page) => page.locator(t("levelup"));
const shown = (page) => page.locator(`${t("levelup")}.show`).waitFor();
const gone = (page) => cutIn(page).waitFor({ state: "detached", timeout: 15000 });
/** 札の火種: [種類, 見える数] */
const fires = (page) => page.locator(`${t("levelup-rewards")} .lvup-fire`).evaluateAll((nodes) => nodes.map((n) => [n.className.match(/k-(\w+)/)[1], n.querySelector("b").textContent]));
/** 画面に見えている文字（読み上げ用の文を除く）。絵と数だけにした画面で、文が戻っていないことを見る */
const visibleText = (page, sel) => page.locator(sel).evaluate((node) => { const copy = node.cloneNode(true); copy.querySelectorAll(".lu-sr, .gb-sr").forEach((n) => n.remove()); return copy.textContent.replace(/\s+/g, ""); });

await suite("growth-fx", async (check) => {
  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    // 経験値が届いて上がったその場で、短い札が出る（SBD122）。まとめて見せる画面・寝る前の演出・ためておく印は無い
    await check(`${label}-levelup-on-the-spot`, async (page) => {
      await setupDaily(page);
      await page.evaluate(async () => { const g = await import("./js/core/growth.js"); g.gainExp(g.totalExpFor(3)); });
      assert.deepEqual(await page.evaluate(() => ({ level: __remake.state.growth.level, fire: __remake.state.growth.hidane.any })), { level: 3, fire: 4 }, "レベルと火種はその場で入る");
      await shown(page);
      const card = cutIn(page);
      assert.deepEqual(await card.evaluate((node) => ({ ...node.dataset })), { test: "levelup", kind: "level", line: "LEVEL UP Lv.3　白火 ＋4", from: "1", to: "3" });
      assert.deepEqual(await fires(page), [["any", "×4"]]);
      assert.equal(await visibleText(page, t("levelup")), "LEVELUPLv.1→Lv.3×4", "見えるのは見出し・レベル・粒の数だけ");
      assert.equal(await card.evaluate((node) => getComputedStyle(node).pointerEvents), "none", "押せない飾り（操作を止めない）");
      assert.equal(await page.locator(".lvup-fire .hidane-icon.has-img").count() > 0, true, "火種の粒は盤と同じ絵");
      await assertFits(page, ".lvup-plate");
      await page.locator(".gain-card", { hasText: "火種を手に入れた" }).waitFor();
      assert.match(await page.locator(t("hud-exp")).innerText(), /Lv\.3/);
      assert.doesNotMatch(await page.locator(t("hud-exp")).innerText(), /Lv UP/, "ためておく印は出さない");
      assert.equal(await page.locator(t("hud-hidane")).innerText(), "4");
      assert.equal(await page.locator(".levelup-backdrop, .levelup-band, [data-test=\"levelup-ok\"], [data-test=\"stock-chip\"]").count(), 0, "止めて見せる画面は無い");
      await gone(page);
      // 寝る前の区切りでは何も出ない（もう上がっている）
      const night = await page.evaluate(async () => { const r = await (await import("./js/core/growth.js")).presentNight(); await new Promise((done) => setTimeout(done, 400)); return { from: r.from, to: r.to, card: !!document.querySelector('[data-test="levelup"]') }; });
      assert.deepEqual(night, { from: 3, to: 3, card: false });

      // 続けて入った経験値は一つの札にまとまる。節目（Lv.10）は色の火1＋白火1で、札が大きく光る
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
        g.gainExp(g.totalExpFor(8) - gr.xp, { key: "sumi" });
        g.gainExp(g.totalExpFor(10) - gr.xp + 10, { key: "kannon" });
      });
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 10);
      await shown(page);
      assert.deepEqual(await card.evaluate((node) => [node.dataset.from, node.dataset.to, node.classList.contains("milestone")]), ["3", "10", true]);
      const got = await fires(page);
      assert.deepEqual(got[0], ["any", "×15"], "Lv.3→10 の白火14＋節目の白火1");
      assert.deepEqual(got.slice(1).map((f) => f[1]), ["×1"], `節目の色の火は1つ: ${JSON.stringify(got)}`);
      assert.match(await card.getAttribute("data-line"), /^LEVEL UP Lv\.10　白火 ＋15　(紅火|蒼火|翠火) ＋1$/);
      await assertFits(page, ".lvup-plate");
      await gone(page);
      assert.equal(await page.locator(t("levelup")).count(), 0, "一つにまとめて出し、二つ目は出さない");

      // ご褒美の火種（♥5）も同じ形で、その場に出る。贈り主は顔（絵が読めない時は短い名札）
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        __remake.state.affinity.minto = 999; __remake.state.flags._met_minto = true;
        window.heart = g.giftAtMaxHeart("minto");
      });
      assert.deepEqual(await page.evaluate(() => window.heart), [{ kind: "body", n: 1 }, { kind: "any", n: 1 }], "♥5は色の火1＋白火1（SBD109）");
      await shown(page);
      assert.equal(await card.getAttribute("data-kind"), "gift");
      assert.equal(await card.locator(".lvup-head").innerText(), "HIDANE");
      assert.deepEqual(await fires(page), [["any", "×1"], ["body", "×1"]]);
      assert.equal(await card.locator(":is(.lvup-face, .lvup-tag)").count(), 1);
      assert.match(await card.getAttribute("data-line"), /　白火 ＋1　紅火 ＋1$/);
      await gone(page);
    }, options);
  }

  // 観音堂で振り返る: 内省の場面 → 盤（灯せる）。レベルアップをまとめて見せる画面は挟まない
  await check("reflection-opens-the-board", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js");
      __remake.state.flags._board_starter_given = true; __remake.state.flags._board_tutorial_done = true;
      g.gainExp(g.totalExpFor(4) + 5);
    });
    await shown(page);
    await gone(page);
    await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      window.lit = (await import("./js/daily/reflection.js")).reflectAt("kannon");
    });
    await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor({ timeout: 30000 });
    assert.equal(await page.locator(t("levelup")).count(), 0);
    assert.match(await page.locator(t("board-wallet")).innerText(), /白火\s*6/);
    await page.locator(t("board-close")).click();
    await page.locator(t("growth-board")).waitFor({ state: "detached" });
    // 火種を使い切れば、内省の入口は出ない（見せるためだけの内省は無い）
    assert.equal(await page.evaluate(async () => { __remake.state.growth.hidane.any = 0; return (await import("./js/daily/reflection.js")).canReflect(); }), false);
  }, { viewport: { width: 1331, height: 760 } });

  // 受け取りの上限に届いた後のレベルアップは、火種が増えない理由を札の中に一言で出す
  await check("capped-levelup-explains", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js"), gr = g.ensureGrowth();
      Object.assign(gr, { level: 70, xp: g.totalExpFor(70), settledXp: g.totalExpFor(70), earned: g.BOARD_TOTAL });
      gr.hidane.any = 9;
      g.gainExp(g.totalExpFor(72) + 5 - gr.xp);
    });
    await shown(page);
    assert.equal(await page.locator(t("levelup-none")).innerText(), "火種は受け取り済み");
    assert.equal(await page.locator(t("levelup-rewards")).count(), 0);
    assert.equal(await cutIn(page).getAttribute("data-line"), "LEVEL UP Lv.72　火種は受け取り済み");
    assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 9, "上限の後は増えない");
    await gone(page);
  }, { viewport: { width: 1331, height: 760 } });

  // 動きを減らす設定: 札は動かさずに出して消す（知らせは残す）。LOAD で入れ替わった前のセーブの分は出さない
  await check("levelup-still-and-stale", async (page) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await setupDaily(page);
    await page.evaluate(async () => { const g = await import("./js/core/growth.js"); g.gainExp(g.totalExpFor(2)); });
    await shown(page);
    assert.equal(await cutIn(page).evaluate((node) => node.classList.contains("still")), true);
    assert.equal(await page.locator(".lvup-rays").evaluate((node) => getComputedStyle(node).display), "none");
    assert.equal(await page.locator("#fx .gfx-ring, #fx .gfx-fly, #fx .gfx-spark").count(), 0, "光・飛ぶ粒は出さない");
    await gone(page);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"), g = await import("./js/core/growth.js");
      g.gainExp(g.totalExpFor(3) - g.ensureGrowth().xp);
      core.newGame(); // 札を出す前に別のセーブへ
    });
    await page.waitForTimeout(600);
    assert.equal(await page.locator(t("levelup")).count(), 0, "前のセーブのレベルアップを、新しいセーブの画面に出さない");
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
      // 「？」: 絵つきの見方（何も選んでいない時は「ながれ」から）。ページを送れて、閉じると盤に戻る
      await tap(t("board-help"));
      const help = page.locator(t("board-help-pages"));
      await help.waitFor();
      assert.equal(await help.locator(".gh-page").getAttribute("data-page"), "flow");
      assert.equal(await help.locator(".gh-flow > li").count(), 4);
      assert.match(await help.innerText(), /1\/7[\s\S]*その場でレベルアップ[\s\S]*観音堂などで振り返る/);
      await tap(t("board-help-next"));
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

    // スキルの漫画のコマ（SBD129）は絵の欄いっぱいに敷き、中央で切り抜く。
    // 欄は grid なので、height: 100% だけではコマが元の比の高さのまま上に寄り、スマホ横で顔の上半分しか見えなかった（2026-11-13 オーナー「漫画の位置ズレてました」）
    await check(`${label}-skill-manga-fills-the-art`, async (page) => {
      await setupDaily(page, { chapter: 4 });
      await page.evaluate(async () => {
        __remake.state.flags._board_starter_given = true; __remake.state.flags._board_tutorial_done = true;
        void (await import("./js/core/growth.js")).openGrowthBoard({ place: "kannon" });
      });
      await page.locator(`${t("growth-board")}[data-art]`).waitFor();
      for (const [tab, id] of [["body", "K12"], ["sense", "K15"], ["wisdom", "K02"]]) {
        await page.locator(t(`board-tab-${tab}`)).click();
        await page.locator(t(`board-node-${id}`)).click({ force: true });
        const art = page.locator(".gb-art.has-skill-art");
        await art.waitFor();
        await page.waitForFunction(() => document.querySelector(".gb-skill-art")?.complete && document.querySelector(".gb-skill-art").naturalWidth > 0);
        const box = await art.evaluate((node) => {
          const outer = node.getBoundingClientRect(), img = node.querySelector(".gb-skill-art").getBoundingClientRect(), cs = getComputedStyle(node);
          const inner = { top: outer.top + parseFloat(cs.borderTopWidth), bottom: outer.bottom - parseFloat(cs.borderBottomWidth),
            left: outer.left + parseFloat(cs.borderLeftWidth), right: outer.right - parseFloat(cs.borderRightWidth) };
          const style = getComputedStyle(node.querySelector(".gb-skill-art"));
          return { gaps: [img.top - inner.top, inner.bottom - img.bottom, img.left - inner.left, inner.right - img.right].map((v) => Math.round(v * 10) / 10),
            fit: style.objectFit, position: style.objectPosition };
        });
        assert(box.gaps.every((gap) => Math.abs(gap) <= 1), `${id}: コマは絵の欄の内側いっぱい（上下左右のずれ 1px 以内） ${JSON.stringify(box)}`);
        assert.equal(box.fit, "cover", `${id}: コマは欄に合わせて切り抜く`);
        assert.equal(box.position, "50% 50%", `${id}: 切り抜きは中央（顔と動きは原画の高さの 25〜75% に描いてある）`);
      }
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
