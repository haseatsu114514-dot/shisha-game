// #638: 家で練習（一台を通して）は自分の葉を使う。減るのは一台を作り終えたときの1回だけ。
// 途中で再読込した一台は保存に残らない（二重消費・消費漏れなし）。葉が12gなければ選べない。
// CHROME_EXECUTABLE_PATH=/usr/bin/chromium node remake/test/browser/home_practice_leaves.mjs
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true };

// 実際の家の練習メニュー（runHomePractice）を開く。作業台は既存の自動操作で進める
async function startPractice(page, stock, { auto = "good" } = {}) {
  await page.evaluate(async ({ stock, auto }) => {
    const core = await import("./js/core/state.js");
    const vn = await import("./js/vn/engine.js"), craft = await import("./js/craft/session.js");
    vn.vnTest.turbo = true; craft.craftTest.auto = auto;
    core.newGame(); Object.assign(core.state, { phase: "daily", day: 8, slot: 0, stamina: 80, weatherSeed: 4 });
    core.state.flavorStock = { ...stock };
    core.state.flavors = Object.keys(stock);
    core.save(); // 行動前のオートセーブ
    window.__practice = { done: false };
    import("./js/daily/home-practice.js").then(home => home.runHomePractice({ staminaGuard: async () => true }))
      .then(value => { window.__practice = { done: true, value }; });
  }, { stock, auto });
  await page.locator('[data-test="home-practice-full"]').waitFor();
}

const snapshot = page => page.evaluate(async () => {
  const core = await import("./js/core/state.js");
  const runs = core.state.flags._craft_practice_runs || [];
  const steps = await import("./js/craft/steps.js");
  return { stock: { ...core.state.flavorStock }, stamina: core.state.stamina, runs: runs.length, mix: runs.at(-1)?.mix || null,
    supplied: steps.regulationFor({ mode: "rehearsal" })?.flavor || null,
    saved: JSON.parse(localStorage.getItem(core.SAVE_KEY) || "null")?.flavorStock || null };
});
const sum = o => Object.values(o || {}).reduce((s, g) => s + g, 0);

async function completes(page, tap) {
  await startPractice(page, { double_apple: 20, mint: 10 });
  const full = page.locator('[data-test="home-practice-full"]');
  assert.equal(await full.isEnabled(), true);
  if (tap) await full.tap(); else await full.click();
  await page.waitForFunction(() => window.__practice.done, null, { timeout: 120000 });
  const after = await snapshot(page);
  assert.equal(after.runs, 1, "一台を作り終えた記録が1件");
  assert(sum(after.mix) >= 12, `配合は12g以上: ${JSON.stringify(after.mix)}`);
  for (const [id, before] of Object.entries({ double_apple: 20, mint: 10 })) {
    // 練習でも大会の課題を再現する。課題の葉は支給なので、大会と同じく減らさない
    const used = id === after.supplied ? 0 : (after.mix[id] || 0);
    assert.equal(after.stock[id], before - used, `${id}は自分の葉として使った分だけ減る`);
  }
  assert(sum(after.mix) - (after.mix[after.supplied] || 0) > 0, "自分の葉を使っている");
  assert.deepEqual((await page.evaluate(() => window.__practice.value)), { used: true, exerted: true });
}

await suite("home-practice-leaves", async (check) => {
  await check("pc-full-run-consumes-once", page => completes(page, false));
  await check("touch-full-run-consumes-once", page => completes(page, true), touch);

  await check("not-enough-leaves-disabled", async (page) => {
    await startPractice(page, { double_apple: 9, mint: 2 });
    const full = page.locator('[data-test="home-practice-full"]');
    assert.equal(await full.isDisabled(), true, "12g未満では「一台を通して」を押せない");
    assert.match(await full.innerText(), /12g/);
    // 工程ドリルは配合しないので選べる
    assert.equal(await page.locator('[data-test="drill-heat"]').isEnabled(), true);
    await page.locator('[data-test="home-practice-back"]').click();
    await page.waitForFunction(() => window.__practice.done);
    assert.deepEqual((await snapshot(page)).stock, { double_apple: 9, mint: 2 }, "戻ったら何も減らない");
  });

  await check("stamina-warning-cancel-changes-nothing", async (page) => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      core.newGame(); Object.assign(core.state, { phase: "daily", day: 8, slot: 0, stamina: 80 });
      core.state.flavorStock = { double_apple: 20, mint: 10 };
      window.__before = JSON.stringify(core.state);
      window.__practice = { done: false };
      // 体力警告で「やめる」を選んだのと同じ: staminaGuard が false
      import("./js/daily/home-practice.js").then(h => h.runHomePractice({ staminaGuard: async () => false }))
        .then(value => { window.__practice = { done: true, value }; });
    });
    await page.locator('[data-test="home-practice-full"]').click();
    await page.waitForFunction(() => window.__practice.done);
    assert.deepEqual(await page.evaluate(() => window.__practice.value), { used: false, exerted: false });
    assert.equal(await page.evaluate(async () => JSON.stringify((await import("./js/core/state.js")).state) === window.__before), true,
      "葉・体力・行動・記録は何も変わらない");
  });

  await check("hidden-menu-not-clickable-on-bench", async (page) => {
    await startPractice(page, { double_apple: 20, mint: 10 }, { auto: null });
    // 日常の画面と同じ実HUDを組む（MENUを押した回数だけ数える）
    await page.evaluate(async () => {
      window.__menuOpened = 0;
      (await import("./js/daily/hud.js")).initHud({ phone() {}, status() {}, menu() { window.__menuOpened++; } });
    });
    await page.locator('[data-test="home-practice-full"]').click();
    await page.locator('[data-test="mix-ok"]').waitFor();
    // 作業台では見えないHUDのMENUを押せない（タイトルへ戻る＝途中保存をさせない）
    const hit = await page.evaluate(() => {
      const m = document.querySelector('[data-test="hud-menu"]');
      if (!m) throw new Error("HUD MENU was not built");
      const r = m.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return top === m || m.contains(top);
    });
    assert.equal(hit, false, "作業台の上に見えないMENUが残っている");
  }, touch);

  await check("mix-capped-by-own-leaves", async (page) => {
    await startPractice(page, { double_apple: 8, mint: 6 }, { auto: null });
    await page.locator('[data-test="home-practice-full"]').click();
    await page.locator('[data-test="mix-ok"]').waitFor();
    assert.match(await page.locator('.flavor-row[data-flavor="double_apple"] .fr-stock').innerText(), /手持ち 残り8g/);
    for (let n = 0; n < 10; n++) await page.locator('[data-test="mix-plus-double_apple"]').click();
    assert.equal(await page.evaluate(() => document.querySelector('.flavor-row[data-flavor="double_apple"] .fr-g').textContent), "8g", "手持ちより多くは詰められない");
  });

  await check("reload-mid-bench-keeps-save", async (page) => {
    await startPractice(page, { double_apple: 20, mint: 10 }, { auto: null });
    await page.locator('[data-test="home-practice-full"]').click();
    await page.locator('[data-test="mix-ok"]').waitFor();
    for (let n = 0; n < 9; n++) await page.locator('[data-test="mix-plus-double_apple"]').click();
    // 課題（支給）の葉を、決定できるまで足す
    for (let n = 0; n < 8 && !(await page.locator('[data-test="mix-ok"]').isEnabled()); n++) await page.locator('[data-test="mix-plus-mint"]').click();
    await page.locator('[data-test="mix-ok"]').click();
    await page.locator('[data-test="pack-confirm"]').waitFor();
    const mid = await snapshot(page);
    assert.deepEqual(mid.stock, { double_apple: 20, mint: 10 }, "配合を決めた時点ではまだ減らない");
    assert.deepEqual(mid.saved, { double_apple: 20, mint: 10 });
    await page.reload({ waitUntil: "load" });
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    const reloaded = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.load();
      return { stock: s.flavorStock, stamina: s.stamina, runs: (s.flags._craft_practice_runs || []).length };
    });
    assert.deepEqual(reloaded, { stock: { double_apple: 20, mint: 10 }, stamina: 80, runs: 0 }, "途中の一台は保存に残らない");
  });
});
