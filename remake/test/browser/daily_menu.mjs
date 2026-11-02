// 全画面MENU（DUI03・#2097）: 実際の日常ループ（runDaily）の HUD から開く4タブ。
// 読むだけで保存データを変えないこと・キー操作・レシピ／チェキの戻り方・盤への入口・手動セーブ・
// 1280×720／横持ちタッチ／DS風（縦持ち 390×844・320×568）で紙が舞台に収まりタブに届くことを確かめる。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";

const out = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser");
fs.mkdirSync(out, { recursive: true });
const t = (id) => `[data-test="${id}"]`;
const TABS = ["status", "people", "items", "system"];

/** 第1章 DAY5 の昼。持ち物・人間関係・記念品・贈り物が埋まった保存を、本物の runDaily で地図まで出す。 */
async function setup(page, { growth = false } = {}) {
  await page.evaluate(async (growth) => {
    (await import("./js/core/growth.js")).setGrowthPreview(growth);
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rin"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    Object.assign(s.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    s.lovers = ["tsumugi"];
    s.flavorStock = { mint: 44, lemon: 50, double_apple: 12 };
    s.flavorMastery = { mint: 20, lemon: 7 };
    s.recipes = { sumi_basic: { day: 3 } };
    s.keepsakes = ["minto_first_cheki"];
    s.owned.push("suyaki_minto");
    s.relationshipMemories = ["sumi_heat"];
    if (growth) {
      const g = (await import("./js/core/growth.js")).ensureGrowth(s);
      Object.assign(g, { xp: 520, level: 3, settledXp: 480, hidane: { any: 2 }, nodes: ["B1", "B2", "S1"] });
    }
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.menuRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.menuError = String(error.stack || error); });
  }, growth);
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
}

const progress = (page) => page.evaluate(() => {
  const copy = JSON.parse(JSON.stringify(window.__remake.state));
  delete copy.savedAt;
  return JSON.stringify(copy);
});

async function settle(page) {
  await page.locator(".dmenu .dm-sheet").evaluate((node) => Promise.all(node.getAnimations().map((a) => a.finished.catch(() => {}))));
}

/** 紙が舞台に収まり、タブ・閉じるが押せる位置にあり、面が横にはみ出さない */
async function assertLayout(page, label) {
  const geometry = await page.evaluate(() => {
    const rect = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const hit = (n) => { const r = n.getBoundingClientRect(); const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2); return n === top || n.contains(top); };
    const sheet = document.querySelector(".dmenu .dm-sheet"), stage = document.getElementById("stage"), panel = document.querySelector(".dmenu .dm-panel");
    return { sheet: rect(sheet), stage: rect(stage), view: { width: innerWidth, height: innerHeight },
      panel: { width: panel.clientWidth, height: panel.clientHeight, scrollWidth: panel.scrollWidth },
      controls: [...document.querySelectorAll(".dmenu .dm-tab, .dmenu .dm-close")].map((n) => ({ test: n.dataset.test, rect: rect(n), hit: hit(n) })) };
  });
  const inside = (a, b) => a.left >= b.left - 1 && a.top >= b.top - 1 && a.right <= b.right + 1 && a.bottom <= b.bottom + 1;
  assert(inside(geometry.sheet, geometry.stage), `${label}: MENU sheet escapes the stage ${JSON.stringify(geometry)}`);
  assert(geometry.sheet.right <= geometry.view.width + 1 && geometry.sheet.bottom <= geometry.view.height + 1, `${label}: MENU leaves the viewport`);
  assert(geometry.panel.height > 80, `${label}: MENU panel has no room ${JSON.stringify(geometry.panel)}`);
  assert(geometry.panel.scrollWidth <= geometry.panel.width + 1, `${label}: MENU panel scrolls sideways ${JSON.stringify(geometry.panel)}`);
  for (const control of geometry.controls) {
    assert(inside(control.rect, geometry.sheet), `${label}: ${control.test} is outside the sheet`);
    assert(control.hit, `${label}: ${control.test} is covered`);
  }
}

async function visitTabs(page, label, press) {
  for (const tab of TABS) {
    await press(t(`menu-tab-${tab}`));
    assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), tab);
    assert.equal(await page.locator(t(`menu-tab-${tab}`)).getAttribute("aria-selected"), "true");
    await assertLayout(page, `${label}/${tab}`);
    await page.screenshot({ path: path.join(out, `daily-menu-${label}-${tab}.png`) });
  }
}

await suite("daily-menu", async (check) => {
  await check("pc-tabs-keys-readonly", async (page) => {
    await setup(page);
    assert.equal(await page.locator(t("hud-status")).count(), 0, "the pentagon status button is retired (DUI05)");
    const before = await progress(page);
    // M で開く（地図で行き先を選んでいる間）。最初はステータス。
    await page.keyboard.press("m");
    await page.locator(".dmenu").waitFor();
    await settle(page);
    assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), "status");
    const summary = await page.locator(t("menu-summary")).innerText();
    assert.match(summary, /DAY\s*5\s*\/14/); assert.match(summary, /あと9日/); assert.match(summary, /42,000円/);
    // 盤の公開前は旧5能力の行。三角・五角形のグラフは出さない（DUI03・04）
    assert.equal(await page.locator(".dmenu .dm-stat").count(), 5);
    assert.equal(await page.locator(".dmenu svg, .dmenu .radar").count(), 0);
    await page.locator(t("menu-stat-insight")).click();
    assert.match(await page.locator(".dmenu .dm-panel > .dm-note").innerText(), /【洞察】/);
    // 数字キー・Q/E・矢印でタブを移る
    for (const [key, tab] of [["2", "people"], ["e", "items"], ["e", "system"], ["e", "status"], ["q", "system"], ["1", "status"]]) {
      await page.keyboard.press(key);
      assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), tab, `key ${key}`);
    }
    await page.locator(t("menu-tab-status")).focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), "people");
    // 人間関係: 会った人だけ。行を開くと直近の思い出、恋人は札
    assert.equal(await page.locator(".dmenu .dm-person").count(), 6);
    assert.equal(await page.locator(`${t("menu-person-tsumugi")} .rel-lover`).innerText(), "恋人");
    await page.locator(t("menu-person-sumi")).click();
    assert.equal(await page.locator(t("menu-person-sumi")).getAttribute("aria-expanded"), "true");
    assert.match(await page.locator(t("menu-person-detail-sumi")).innerText(), /今の一台を見ろ/);
    await page.locator(t("menu-person-minto")).click();
    assert.equal(await page.locator(t("menu-person-detail-sumi")).isVisible(), false, "one row open at a time");
    assert.match(await page.locator(t("menu-person-detail-minto")).innerText(), /贈り物：みんとが育てたミント専用ハガル/);
    await page.screenshot({ path: path.join(out, "daily-menu-pc-people-open.png") });
    // 持ち物: 葉の在庫と熟練度、レシピの詳細から戻る、チェキは Esc で閉じても MENU は残る
    await page.keyboard.press("3");
    assert.equal(await page.locator(".dmenu .dm-flavor").count(), 3);
    assert.match(await page.locator(t("menu-flavor-mint")).innerText(), /44g[\s\S]*Lv\.3/);
    await page.locator(t("recipe-sumi_basic")).click();
    await page.locator(t("recipe-detail")).waitFor();
    await page.screenshot({ path: path.join(out, "daily-menu-pc-recipe.png") });
    await page.keyboard.press("Escape");
    await page.locator(t("recipe-detail")).waitFor({ state: "detached" });
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.test), "recipe-sumi_basic");
    await page.locator(t("keepsake-minto_first_cheki")).click();
    await page.locator("#modal > .keepsake-viewer").waitFor();
    await page.keyboard.press("Escape");
    await page.locator("#modal > .keepsake-viewer").waitFor({ state: "detached" });
    assert.equal(await page.locator(".dmenu").count(), 1);
    await visitTabs(page, "pc", (sel) => page.locator(sel).click());
    assert(await page.locator(t("menu-save")).isEnabled(), "manual save is available while choosing a destination");
    // 見るだけ: タブを全部見ても保存データは変わらない
    assert.equal(await progress(page), before);
    await page.keyboard.press("M");
    await page.locator(".dmenu").waitFor({ state: "detached" });
    assert.equal(await page.locator("#modal.show").count(), 0);
    assert.equal(await page.evaluate(() => window.menuError || null), null);
  });

  await check("pc-growth-board-entry", async (page) => {
    await setup(page, { growth: true });
    // 未使用の火種の印は MENU の右上（五角形のボタンは無い）
    const badge = page.locator(`${t("hud-menu")} ${t("hud-hidane")}`);
    await badge.waitFor();
    assert.equal(await badge.innerText(), "2");
    assert.match(await page.locator(t("hud-menu")).getAttribute("aria-label"), /火種 2/);
    await page.locator(t("hud-menu")).click();
    await page.locator(".dmenu").waitFor();
    await settle(page);
    assert.match(await page.locator(t("menu-level")).innerText(), /Lv\.\s*3[\s\S]*EXP 110/);
    assert.match(await page.locator(t("menu-hidane")).innerText(), /2\s*火種/);
    assert.match(await page.locator(t("menu-board-body")).innerText(), /才能[\s\S]*2 \/ 26/);
    assert.equal(await page.locator(".dmenu svg, .dmenu .radar").count(), 0, "no triangle graph (DUI03)");
    await assertLayout(page, "pc-growth");
    await page.screenshot({ path: path.join(out, "daily-menu-pc-growth-status.png") });
    const before = await progress(page);
    await page.locator(t("menu-board")).click();
    await page.locator(`${t("growth-board")}[data-mode="view"]`).waitFor();
    await page.locator(t("board-close")).click();
    await page.locator(t("growth-board")).waitFor({ state: "detached" });
    assert.equal(await page.locator(".dmenu").count(), 0);
    assert.equal(await progress(page), before, "looking at the board from MENU spends nothing");
  });

  await check("pc-system-save-and-guard", async (page) => {
    await setup(page);
    await page.locator(t("hud-menu")).click();
    await page.locator(t("menu-tab-system")).click();
    await page.locator(t("menu-save")).click();
    await page.locator(t("slot-1")).click();
    await page.locator("#modal.show").waitFor({ state: "hidden" });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_slot1")));
    assert.equal(saved.day, 5); assert.equal(saved.money, 42000);
    // 会話や作業の途中から開いた時（行き先を選んでいない時）はセーブを押せず、理由を出す
    await page.evaluate(async () => {
      window.guarded = (await import("./js/daily/menu.js")).openMenu({ tab: "system", canSave: () => false });
    });
    await page.locator(".dmenu").waitFor();
    assert.equal(await page.locator(".dmenu").getAttribute("data-tab"), "system");
    assert(await page.locator(t("menu-save")).isDisabled());
    assert.match(await page.locator(t("menu-save-note")).innerText(), /今はセーブできない/);
    await page.locator(t("menu-close")).click();
    assert.equal(await page.evaluate(() => window.guarded), null);
  });

  await check("touch-landscape", async (page) => {
    await setup(page);
    await page.locator(t("hud-menu")).tap();
    await page.locator(".dmenu").waitFor();
    await settle(page);
    await visitTabs(page, "landscape", (sel) => page.locator(sel).tap());
    await page.getByRole("button", { name: "閉じる", exact: true }).tap();
    await page.locator(".dmenu").waitFor({ state: "detached" });
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  for (const [label, width, height] of [["ds-portrait", 390, 844], ["ds-small", 320, 568]]) {
    await check(label, async (page) => {
      // DS風（上下2画面）。タイトルの表示設定を切り替えて読み直す。
      await page.evaluate(() => localStorage.setItem("suien_title_layout", "ds"));
      await page.reload();
      await page.locator(t("title-new")).waitFor({ timeout: 30000 });
      await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page);
      await page.locator("body.game-ds").waitFor();
      await page.locator(t("hud-menu")).tap();
      await page.locator(".dmenu").waitFor();
      await settle(page);
      // タブは下の帯（下画面の一番下）に横並び
      const bar = await page.evaluate(() => {
        const tabs = [...document.querySelectorAll(".dmenu .dm-tab")].map((n) => n.getBoundingClientRect());
        const panel = document.querySelector(".dmenu .dm-panel").getBoundingClientRect();
        return { sameRow: tabs.every((r) => Math.abs(r.top - tabs[0].top) < 1), belowPanel: tabs[0].top >= panel.bottom - 1,
          labelsFit: [...document.querySelectorAll(".dmenu .dm-tab .dm-label")].every((n) => n.scrollWidth <= n.parentElement.clientWidth + 1) };
      });
      assert.deepEqual(bar, { sameRow: true, belowPanel: true, labelsFit: true });
      await visitTabs(page, label, (sel) => page.locator(sel).tap());
      await page.locator(t("menu-close")).tap();
      await page.locator(".dmenu").waitFor({ state: "detached" });
    }, { viewport: { width, height }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
  }
});
