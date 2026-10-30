// 経験値ゲージ → 寝る前のレベルアップ → 火種の印を実DOMで確かめる（GROWTH_BOARD の裏。?growth=1 で有効）。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, baseURL, assertFits } from "./support.mjs";

const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
fs.mkdirSync(out, { recursive: true });
const t = (id) => `[data-test="${id}"]`;

async function setupDaily(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    core.config.bgmVolume = 0; core.config.seVolume = 0; core.config.voiceBlip = false;
    const ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js"), hud = await import("./js/daily/hud.js");
    ui.showScreen("map", document.createElement("div"));
    await ui.setBg(data.bgUrl("bg_home", "night"), { fast: true });
    hud.initHud({ phone() {}, status() {}, menu() {} });
    hud.showHud(true);
  });
}

await suite("growth-levelup", async (check) => {
  await check("flag-off-hides-everything", async (page) => {
    await page.evaluate(async () => (await import("./js/core/growth.js")).setGrowthPreview(false));
    await setupDaily(page);
    assert.equal(await page.evaluate(async () => (await import("./js/core/growth.js")).growthEnabled()), false);
    assert.equal(await page.locator(t("hud-exp")).isVisible(), false);
    assert.equal(await page.locator(t("hud-hidane")).isVisible(), false);
    assert.equal(await page.evaluate(() => __remake.state.growth), undefined);
  });

  // #1807: the real map and HUD entry points, with Adam unvisited.
  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["portrait", { viewport: { width: 591, height: 1280 } }],
  ]) {
    await check(`${label}-reflection-entry`, async (page) => {
      const tap = async (sel) => {
        const node = page.locator(sel).first();
        await node.scrollIntoViewIfNeeded();
        if (options.hasTouch) await node.tap(); else await node.click();
      };
      await setupDaily(page);
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        core.config.textSpeed = 4;
        Object.assign(core.state, { day: 6, slot: 0 });
        window.entryStatus = 0;
        (await import("./js/daily/hud.js")).initHud({ status: () => { window.entryStatus++; } });
        (await import("./js/daily/hud.js")).showHud(true);
        window.entryMap = async () => {
          const map = await import("./js/daily/map.js");
          window.entryFlow = map.chooseSpot().then(async id => {
            if (id === "kannon") await (await import("./js/core/growth.js")).reflectAtSpot(id);
          });
        };
        await window.entryMap();
      });
      await page.locator(".map:not(.done)").waitFor();
      assert.equal(await page.locator(t("pin-kannon")).count(), 0);
      await page.evaluate(async () => {
        const map = await import("./js/daily/map.js");
        map.interruptMap(null); await window.entryFlow;
        const growth = await import("./js/core/growth.js");
        growth.gainExp(205); growth.settleGrowth();
        window.entryBefore = { day: __remake.state.day, slot: __remake.state.slot, stamina: __remake.state.stamina };
        await window.entryMap();
      });
      await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
      await page.locator(t("kannon-hidane")).waitFor();
      assert.equal(await page.evaluate(() => !!__remake.state.flags._spot_guide_adam || !!__remake.state.met.adam), false);
      await assertFits(page, t("kannon-hidane"));
      await tap(t("hud-status"));
      await page.locator(`${t("growth-board")}[data-mode="view"]`).waitFor();
      assert.equal(await page.locator(t("board-light")).count(), 0);
      await tap('.gb-node[data-status="available"]');
      assert.equal(await page.locator(t("board-light")).count(), 0);
      await tap(t("board-close"));
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 2);
      assert.equal(await page.evaluate(() => window.entryStatus), 0);
      await tap(t("pin-kannon")); await tap(t("map-go"));
      await tap(t("kannon-reflect"));
      for (let i = 0; i < 30 && !(await page.locator(t("growth-board")).count()); i++) {
        const next = page.locator(".vn-box");
        if (await next.isVisible()) await tap(".vn-box");
        await page.waitForTimeout(150);
      }
      await page.locator(`${t("growth-board")}[data-mode="light"]`).waitFor();
      for (let i = 0; i < 2; i++) {
        await tap('.gb-node[data-status="available"]');
        await tap(t("board-light"));
      }
      await tap(t("board-decide"));
      await page.locator(t("growth-board")).waitFor({ state: "detached" });
      await page.evaluate(async () => { await window.entryFlow; await window.entryMap(); });
      await page.locator(".map:not(.done)").waitFor();
      assert.equal(await page.locator(t("kannon-hidane")).count(), 0);
      assert.equal(await page.locator(t("hud-hidane")).isVisible(), false);
      assert.equal(await page.locator(t("pin-kannon")).count(), 1);
      assert.deepEqual(await page.evaluate(() => ({ day: __remake.state.day, slot: __remake.state.slot, stamina: __remake.state.stamina })),
        await page.evaluate(() => window.entryBefore));
      await tap(t("hud-status"));
      assert.equal(await page.evaluate(() => window.entryStatus), 1);
    }, options);
  }

  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
    ["portrait", { viewport: { width: 591, height: 1280 } }], // スマホ縦は横向きの案内になるため窓の縦長で見る
  ]) {
    await check(`${label}-gauge-chip-night`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page);
      const exp = page.locator(t("hud-exp"));
      await exp.waitFor();
      assert.match(await exp.innerText(), /Lv\.1[\s\S]*あと205/);

      // 自由行動1回 → チップ1枚（内訳の数字は出さない）
      await page.evaluate(async () => {
        const stats = await import("./js/core/stats.js");
        __remake.state.met.naru = true;
        await stats.paidAction(async () => { stats.addStamina(-16); return true; }, { exp: { key: "naru", person: "naru" } });
      });
      const chip = page.locator(t("exp-chip"));
      await chip.waitFor();
      assert.match(await chip.innerText(), /EXP \+70[\s\S]*はじめて/);
      assert.match(await exp.innerText(), /あと135/);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-chip.png` });

      // 満タンを越えても日中は上がらない
      await page.evaluate(async () => (await import("./js/core/growth.js")).gainExp(400));
      await page.waitForFunction(() => /今夜 Lv UP/.test(document.querySelector('[data-test="hud-exp"]').textContent));
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 1);
      await page.waitForFunction(() => !document.querySelector('[data-test="exp-chip"]'));
      await assertFits(page, '[data-test="hud-exp"]');

      // 寝る前: 初回はフル演出。押すと最後まで早送り → OK
      await page.evaluate(async () => {
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      const panel = page.locator(t("levelup"));
      await panel.waitFor();
      await tap(".levelup-backdrop");
      const ok = page.locator(t("levelup-ok"));
      await page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state"));
      const text = await panel.innerText();
      assert.match(text, /Lv\.1 → Lv\.3/);
      assert.match(text, /火種 ＋6/, "Lv.50 まではレベル1つで火種3つ");
      assert.doesNotMatch(text, /？？？/, "名乗っていない相手の名前は出さない");
      await assertFits(page, '[data-test="levelup-ok"]');
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-full.png` });
      await tap(t("levelup-ok"));
      await page.waitForFunction(() => window.night?.to === 3);
      await panel.waitFor({ state: "detached" });
      const badge = page.locator(t("hud-hidane"));
      await badge.waitFor();
      assert.equal(await badge.innerText(), "6");
      assert.match(await exp.innerText(), /Lv\.3/);

      // ふだんの1レベルは短い帯で、押さなくても消える
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        g.gainExp(g.totalExpFor(4) - __remake.state.growth.xp);
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      const band = page.locator(t("levelup-band"));
      await band.waitFor();
      assert.match(await band.innerText(), /Lv\.3 → 4[\s\S]*火種 ＋3/);
      await page.waitForFunction(() => document.querySelector('[data-test="levelup-band"]')?.classList.contains("show"));
      await page.waitForTimeout(250);
      await page.screenshot({ path: `${out}/growth-levelup-${label}-band.png` });
      await page.waitForFunction(() => window.night?.to === 4, null, { timeout: 5000 });
      await band.waitFor({ state: "detached" });
      assert.equal(await badge.innerText(), "9");

      // 保存・読込で残る
      await page.evaluate(async () => { const core = await import("./js/core/state.js"); core.save(); core.load(); });
      assert.equal(await page.evaluate(() => __remake.state.growth.level), 4);
    }, options);
  }

  for (const [label, options] of [
    ["pc", { viewport: { width: 1331, height: 760 } }],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    await check(`${label}-board-from-levelup`, async (page) => {
      const tap = (sel) => !options.hasTouch ? page.locator(sel).click() : page.locator(sel).tap();
      await setupDaily(page);
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        g.gainExp(g.totalExpFor(3));
        window.night = null;
        void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
      });
      await page.locator(t("levelup")).waitFor();
      await tap(".levelup-backdrop");
      await page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state"));
      await tap(t("levelup-board"));
      const board = page.locator(t("growth-board"));
      await board.waitFor();
      // 寝る前・メニューからは見るだけ（灯すのは参拝の場所。SPEC 2.8）
      assert.equal(await board.getAttribute("data-mode"), "view");
      assert.match(await page.locator(t("board-place")).innerText(), /見るだけ/);
      assert.match(await page.locator(t("board-wallet")).innerText(), /万能\s*6/, "Lv.1→3 で火種6");
      const ids = await page.evaluate(async () => {
        const b = await import("./js/core/growth-board.js");
        const first = b.boardNodes("body").find((n) => n.kind === "stat" && n.links.includes(b.HUB)).id;
        return { first, far: b.NODE_BY_ID[first].links.find((l) => l !== b.HUB) };
      });
      assert.equal(await page.locator(t(`board-node-${ids.first}`)).getAttribute("data-status"), "available");
      assert.equal(await page.locator(t(`board-node-${ids.far}`)).getAttribute("data-status"), "far");
      await tap(t("board-node-K03"));
      assert.match(await page.locator(t("board-preview")).innerText(), /スキル「早寝早起き」[\s\S]*まだ道がつながっていない/);
      assert.equal(await page.locator(t("board-light")).count(), 0, "見るだけの盤に「灯す」は無い");
      await tap(t("board-target"));
      assert.equal(await page.evaluate(() => __remake.state.growth.target), "K03", "目標は見るだけの盤でも決められる");
      await tap(t("board-close"));
      await board.waitFor({ state: "detached" });
      await page.waitForFunction(() => window.night?.to === 3);

      // 観音堂で内省 → 灯せる。目標まで灯す → 決定
      await page.evaluate(() => { window.lit = null; void import("./js/core/growth.js").then((g) => g.openGrowthBoard({ place: "kannon" })).then((r) => { window.lit = r; }); });
      await board.waitFor();
      assert.equal(await board.getAttribute("data-mode"), "light");
      assert.match(await page.locator(t("board-place")).innerText(), /観音堂で内省/);
      assert.match(await page.locator(t("board-preview")).innerText(), /早寝早起き/, "目標のマスが選ばれた状態で開く");
      await tap(t("board-towards"));
      const pend = await page.locator('[data-status="pending"]').count();
      assert.ok(pend >= 1 && pend <= 6, `火種6の分だけ道を仮置き（${pend}）`);
      await tap(t("board-tab-wisdom"));
      assert.equal(await page.locator(t("board-node-K01")).count(), 1, "札で理論盤へ");
      await assertFits(page, '[data-test="board-decide"], [data-test="board-close"], [data-test="board-tab-body"], [data-test="board-tab-wisdom"]');
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${out}/growth-board-${label}.png` });
      await tap(t("board-decide"));
      await board.waitFor({ state: "detached" });
      await page.waitForFunction(() => Array.isArray(window.lit));
      assert.equal(await page.evaluate(() => __remake.state.growth.nodes.length), pend);
      assert.equal(await page.evaluate(() => __remake.state.growth.hidane.any), 6 - pend);
      await page.locator(".gain-card", { hasText: "能力の火" }).waitFor();
    }, options);
  }

  // 大会前夜の内省（SPEC 2.8・#1690）: 火種が残っていれば一度だけ、場面のあと灯せる盤が開く
  await check("eve-reflection-once", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      (await import("./js/core/growth.js")).ensureGrowth().hidane.any = 3;
      window.eve = null;
      void (await import("./js/daily/reflection.js")).eveReflection("kannon").then((r) => { window.eve = r; });
    });
    const board = page.locator(t("growth-board"));
    await board.waitFor({ timeout: 15000 });
    assert.equal(await board.getAttribute("data-mode"), "light");
    assert.match(await page.locator(t("board-place")).innerText(), /観音堂で内省/);
    await page.locator(t("board-close")).click();
    await page.waitForFunction(() => window.eve === true);
    assert.equal(await page.evaluate(async () => (await import("./js/daily/reflection.js")).eveReflection("kannon")), false, "同じ章の前夜は一度だけ");
  }, { viewport: { width: 1331, height: 760 } });

  // 章の範囲は章の数を出さず封で見せ、章が進んで初めて開くと「封が解けた」（SBD42）。ご褒美だけの夜は短い帯（SBD39・40）
  await check("chapter-seal-and-gifts", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => { (await import("./js/core/growth.js")).ensureGrowth().hidane.any = 2; void (await import("./js/core/growth.js")).openGrowthBoard(); });
    const board = page.locator(t("growth-board"));
    await board.waitFor();
    const text = await board.innerText();
    assert.doesNotMatch(text, /[0-9０-９]章/, "盤に章の数を書かない");
    assert.ok(await page.locator('[data-status="locked"]').count() > 0);
    assert.equal(await page.locator(t("board-opened")).count(), 0, "第1章では演出なし");
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    await page.evaluate(async () => { __remake.state.chapter = 2; void (await import("./js/core/growth.js")).openGrowthBoard(); });
    await page.locator(t("board-opened")).waitFor();
    assert.match(await page.locator(t("board-opened")).innerText(), /封が解けた/);
    assert.ok(await page.locator(".gb-node.just-opened").count() > 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/growth-board-unseal.png` });
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    await page.evaluate(async () => { void (await import("./js/core/growth.js")).openGrowthBoard(); });
    await board.waitFor();
    assert.equal(await page.locator(t("board-opened")).count(), 0, "演出は一度だけ");
    await page.locator(t("board-close")).click();
    await board.waitFor({ state: "detached" });
    // くじを引き切った夜（レベルは上がっていない）
    await page.evaluate(async () => {
      __remake.state.kuji = { g500: { order: [0], drawn: 1, emptyDay: 3 } };
      window.night = null;
      void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
    });
    const band = page.locator(t("gift-band"));
    await band.waitFor();
    assert.match(await band.innerText(), /くじのラストワン賞[\s\S]*才の火種 ＋1/);
    await assertFits(page, '[data-test="gift-band"]');
    await page.waitForFunction(() => window.night?.gifts?.length === 1, null, { timeout: 8000 });
  }, { viewport: { width: 1331, height: 760 } });

  // 既存スミ授業を実際のVNで中断→途中保存→再相談。好感度0でも、盤から同じ機能が開く。
  for (const id of ["M-S1", "M-W1"]) {
    await check(`sumi-${id}-resume`, async (page) => {
      await setupDaily(page);
      await page.evaluate(async (id) => {
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const node = b.NODE_BY_ID[id];
        const gr = g.ensureGrowth();
        __remake.state.affinity.sumi = 0;
        __remake.state.flags._intro_sumi = true;
        // 第1章の道と3段までの能力マスは既に灯した状態。
        gr.nodes = b.boardNodes(node.board).filter((n) => n.kind === "stat" && n.ring === 1).map((n) => n.id);
        if (!b.commitPending([id]).length) throw new Error("授業が灯せない");
        window.lessonAbort = new AbortController();
        window.lessonDone = null;
        void g.consultLessons("sumi", { only: id, signal: window.lessonAbort.signal }).then((r) => { window.lessonDone = r; });
      }, id);
      await page.locator("#vn.active").waitFor();
      const interrupted = await page.evaluate(async (id) => {
        const core = await import("./js/core/state.js");
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const flag = b.NODE_BY_ID[id].unlocks[0];
        core.save();
        window.lessonAbort.abort();
        return !!core.state.flags[flag];
      }, id);
      assert.equal(interrupted, false);
      await page.waitForFunction(() => window.lessonDone !== null);
      assert.deepEqual(await page.evaluate(() => window.lessonDone), []);
      const result = await page.evaluate(async (id) => {
        const core = await import("./js/core/state.js");
        core.load();
        const g = await import("./js/core/growth.js");
        const b = await import("./js/core/growth-board.js");
        const flag = b.NODE_BY_ID[id].unlocks[0];
        const before = [core.state.day, core.state.slot, core.state.stamina, g.hidaneTotal()];
        (await import("./js/vn/engine.js")).vnTest.turbo = true;
        const done = await g.consultLessons("sumi", { only: id });
        core.load();
        return { done: done.map((l) => l.id), learned: !!core.state.flags[flag],
          repeat: await g.consultLessons("sumi", { only: id }), before,
          after: [core.state.day, core.state.slot, core.state.stamina, g.hidaneTotal()] };
      }, id);
      assert.deepEqual(result.done, [id]);
      assert.equal(result.learned, true);
      assert.deepEqual(result.repeat, []);
      assert.deepEqual(result.after, result.before);
    });
  }

  // 授業（SBD50）: 盤で灯すと「相談できる」。次に会った時に、はじめが相談して話を聞く場面を最後まで見て習得
  await check("lesson-consult", async (page) => {
    await setupDaily(page);
    const r = await page.evaluate(async () => {
      (await import("./js/vn/engine.js")).vnTest.turbo = true;
      const g = await import("./js/core/growth.js");
      const gr = g.ensureGrowth();
      gr.nodes.push("M-W2");
      const before = g.readyLessons("sumi").map((l) => l.id);
      const done = await g.consultLessons("sumi");
      return { before, done: done.map((l) => l.id), learned: g.lessonLearned("M-W2"),
        four: __remake.state.flags._coal_four_unlocked, mix: __remake.state.flags._coal_mix_unlocked, after: g.readyLessons("sumi").length };
    });
    assert.deepEqual(r.before, ["M-W2"]);
    assert.deepEqual(r.done, ["M-W2"]);
    assert.equal(r.learned, true);
    assert.equal(r.four, true, "四つ置きが開く");
    assert.equal(r.mix, true, "混ぜ置きが開く");
    assert.equal(r.after, 0);
    await page.locator(".gain-card", { hasText: "四つ置き" }).waitFor();
  }, { viewport: { width: 1331, height: 760 } });
}, { entry: `${baseURL}?growth=1` });
