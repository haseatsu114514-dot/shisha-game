// 実ブラウザで、回転中のマップ再表示と夜の行動の演出を検証する。
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
if (process.env.SHOTS) fs.mkdirSync(process.env.SHOTS, { recursive: true });
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const browser = await chromium.launch({
  headless: true,
  chromiumSandbox: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});

async function waitForSpin(task, label) {
  let timer;
  try {
    await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} did not finish within 20 seconds`)), 20000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function checkInstallation(label, run, touch = false, preview = false) {
  const context = await browser.newContext({
    viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: touch,
  });
  const page = await context.newPage(), errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const boot = async (resume = false) => {
    await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(async ({ resume, preview }) => {
      const core = await import("./js/core/state.js"), reel = await import("./js/daily/reel.js");
      const growth = await import("./js/core/growth.js");
      resume ? core.load() : core.newGame();
      growth.setGrowthPreview(preview);
      core.state.phase = "daily";
      if (!resume) core.state.reel.seed = 1;
      core.config.bgmVolume = core.config.seVolume = 0;
      const ui = await import("./js/core/ui.js"), data = await import("./js/core/data.js");
      ui.showScreen("reel-install-test", document.createElement("div"));
      await ui.setBg(data.bgUrl("bg_c_station"), { fast: true });
      window.installProbe = { core, reel, growth };
      window.startInstall = () => { window.installTask = reel.installReel(); };
      window.installSnapshot = () => ({
        count: core.state.reel.count, stats: { ...core.state.stats }, statXp: { ...core.state.statXp },
        xp: core.state.growth?.xp || 0, hidane: core.state.growth?.hidane || null,
        pending: core.state.reel.pending.length, flags: { ...core.state.flags },
        day: core.state.day, slot: core.state.slot, stamina: core.state.stamina, money: core.state.money,
      });
    }, { resume, preview });
  };
  const tap = async () => {
    const intro = page.locator('[data-test="reel-intro"]');
    touch ? await intro.tap() : await intro.click();
  };
  const assertGuide = async (growthMode) => {
    const guide = page.locator('[data-test="reel-guide-card"]');
    const text = await guide.innerText();
    if (growthMode) {
      assert.match(text, /チェリー・ベル・ボーナスで経験値/);
      assert.match(text, /ハズレ・リプレイはなし/);
      assert.doesNotMatch(text, /能力は少し伸びる/);
    } else assert.match(text, /能力は少し伸びる。天井で必ず当たる/);
    const widths = await guide.locator('.rn-tile-body').evaluateAll(nodes => nodes.map(n => [n.scrollWidth, n.clientWidth]));
    for (const [scroll, client] of widths) assert(scroll <= client + 1, "遊び方が横にはみ出した");
  };
  const readIntro = async () => {
    for (let i = 0; i < 4; i++) await tap();
    const text = await page.locator('[data-test="reel-intro"] .ri-text').innerText();
    if (preview) {
      assert.match(text, /図柄が揃うと経験値が入るよ/);
      assert.doesNotMatch(text, /外れても|回したぶんだけ/);
    } else assert.match(text, /外れても大丈夫。回したぶんだけ/);
    await tap();
    await page.locator('[data-test="reel-guide-card"]').waitFor();
    await assertGuide(preview);
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), 0, "説明中に先に抽選した");
    await tap();
  };
  const finish = () => waitForSpin(page.evaluate(() => window.installTask), label);
  try {
    await boot();
    await run({ page, boot, tap, readIntro, finish, assertGuide });
    assert.deepEqual(errors, [], `${label}: browser errors`);
    console.log(`[reel install] PASS: ${label}`);
  } finally { await context.close(); }
}

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const reel = await import("./js/daily/reel.js");
    const { layers } = await import("./js/core/ui.js");
    core.newGame();
    core.state.phase = "daily";
    core.state.reel.seed = 1;
    core.state.reel.installed = true; core.state.reel.introDone = true;
    layers.screen.replaceChildren();
    reel.onAction({ spent: 10 });
    window.reelProbe = { core, reel, layers };
    window.daySpin = reel.mountReel(layers.screen);
  });
  await page.waitForSelector('.rw-strip.spinning');
  const remount = await page.evaluate(() => {
    const { reel, layers } = window.reelProbe;
    const firstWidget = document.querySelector('.reel-widget');
    layers.screen.replaceChildren();
    const task = reel.mountReel(layers.screen);
    return {
      sameWidget: firstWidget === document.querySelector('.reel-widget'),
      spinning: document.querySelectorAll('.rw-strip.spinning').length,
      sameTask: task === window.daySpin,
    };
  });
  assert(remount.sameWidget, "回転中の筐体が、前回の停止出目の筐体に置き換わった");
  assert(remount.spinning > 0, "マップを戻したら回転済みの出目が表示された");
  assert(remount.sameTask, "再表示で回転の待機処理が分かれた");
  await waitForSpin(page.evaluate(() => window.daySpin), "day spin");
  const final = await page.evaluate(() => {
    const { core, reel } = window.reelProbe;
    return [...document.querySelectorAll('.rw-strip')].map((node, i) => ({
      y: new DOMMatrixReadOnly(getComputedStyle(node).transform).m42,
      expected: -26 * (core.state.reel.shown[i] + reel.core.STRIPS[i].length - 1),
    }));
  });
  for (const stop of final) assert(Math.abs(stop.y - stop.expected) < 0.1, "再表示したリールの最終出目が抽選結果と違う");

  // 夜の行動を実際に抽選。表示は回転数・適用済み報酬を増やさない。
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    layers.screen.replaceChildren();
    core.state.slot = 2;
    reel.onAction({ spent: 10 });
    window.nightBefore = JSON.stringify({ count: core.state.reel.count, stats: core.state.stats });
    window.nightFirstFrame = null;
    const observer = new MutationObserver(() => {
      const host = document.querySelector('.reel-night.show');
      if (!host) return;
      window.nightFirstFrame = host.querySelectorAll('.rw-strip.spinning').length;
      observer.disconnect();
    });
    observer.observe(layers.fx, { subtree: true, attributes: true });
    window.nightSpin = reel.presentNow();
  });
  await page.waitForSelector('.reel-night.show .rw-strip.spinning');
  assert.equal(await page.evaluate(() => window.nightFirstFrame), 3, "夜の表示開始時に前回の停止出目が見えた");
  await waitForSpin(page.evaluate(() => window.nightSpin), "night spin");
  const night = await page.evaluate(() => {
    const { core } = window.reelProbe;
    return {
      sameRewards: window.nightBefore === JSON.stringify({ count: core.state.reel.count, stats: core.state.stats }),
      pending: core.state.reel.pending.length,
      overlays: document.querySelectorAll('.reel-night').length,
    };
  });
  assert(night.sameRewards, "夜の演出で報酬または回転数が二重加算された");
  assert.equal(night.pending, 0, "夜の回転が翌朝に残った");
  assert.equal(night.overlays, 0, "終わった夜の筐体が残った");
  await page.evaluate(() => window.reelProbe.reel.presentNow());
  assert.equal(await page.locator('.reel-night').count(), 0, "表示済みの夜の回転がもう一度出た");

  // 初回説明中に再表示しても、説明・回転・報酬を重複させない。
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    core.state.reel.introDone = false;
    core.state.slot = 1;
    reel.onAction({ spent: 10 });
    layers.screen.replaceChildren();
    window.introSpin = reel.mountReel(layers.screen);
    window.introBox = document.querySelector('.reel-intro');
    layers.screen.replaceChildren();
    window.introRemount = reel.mountReel(layers.screen);
  });
  assert(await page.evaluate(() => window.introBox === document.querySelector('.reel-intro')), "再表示で初回説明が作り直された");
  assert(await page.evaluate(() => window.introSpin === window.introRemount), "初回説明中に回転処理が重複した");
  // Read all five dialogue pages, then the guide card added to the introduction.
  for (let i = 0; i < 5; i++) await page.click('[data-test="reel-intro"]');
  await page.locator('[data-test="reel-guide-card"]').waitFor({ timeout: 10000 });
  await page.click('[data-test="reel-intro"]');
  await waitForSpin(page.evaluate(() => window.introSpin), "intro spin");
  assert.equal(await page.locator('.reel-intro').count(), 0);
  assert.deepEqual(errors, []);
  console.log('[reel lifecycle] remount while spinning, correct stops, night spin once, no repeated rewards, intro remount: PASS');

  // #1359: 揃え演出（alignBonus）が例外で落ちても mountReel が固まらず、次の回転まで進める。
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    layers.screen.replaceChildren();
    core.state.reel.pending.push({
      role: "big", variant: "before", ceiling: null, zone: null, n: 1,
      exp: 0, got: 0, quiet: true, target: null, stops: [0, 0, 0],
    });
    // 拡大盤の位置読み取り（DOMMatrixReadOnly）を壊し、alignBonus を reject させる
    window.__RealDOMMatrixReadOnly = window.DOMMatrixReadOnly;
    window.DOMMatrixReadOnly = class { constructor() { throw new Error("forced alignBonus failure (#1359)"); } };
    window.bonusFailSpin = reel.mountReel(layers.screen);
  });
  await waitForSpin(page.evaluate(() => window.bonusFailSpin), "bonus failure spin");
  await page.evaluate(() => {
    const { core, reel, layers } = window.reelProbe;
    window.DOMMatrixReadOnly = window.__RealDOMMatrixReadOnly;
    // busy が解除されていれば、次の回転も最後まで見せられる
    core.state.reel.pending.push({ role: "miss", stops: [1, 1, 2], ceilingRemain: 99, exp: 0, got: 0, quiet: true, target: null });
    window.afterFailSpin = reel.mountReel(layers.screen);
  });
  await waitForSpin(page.evaluate(() => window.afterFailSpin), "spin after bonus failure");
  assert.equal(await page.evaluate(() => window.reelProbe.core.state.reel.pending.length), 0, "ボーナス演出の失敗後に回転が再開できなかった");
  assert.deepEqual(errors, [], "bonus failure spin: browser errors");
  console.log("[reel lifecycle] bonus presentation failure does not wedge the reel: PASS");

  for (const touch of [false, true]) for (const preview of [false, true]) await checkInstallation(`first-spin-${preview ? "exp" : "legacy"}-${touch ? "touch" : "pc"}`, async ({ page, readIntro, finish, assertGuide }) => {
    const expected = await page.evaluate(() => {
      const { core, reel, growth } = installProbe;
      const before = installSnapshot();
      const copy = structuredClone(core.state.reel);
      const results = reel.core.spinSeries(copy, { chapterFirst: true, reset: true });
      startInstall();
      const sameTask = installTask === reel.installReel();
      return { count: copy.count, exp: results.reduce((n, r) => n + r.exp, 0),
        xp: results.reduce((n, r) => n + (growth.SLOT_EXP[r.overlap || r.role] || 0), 0), before, sameTask };
    });
    assert(expected.sameTask, "二重導入が別の説明を作った");
    await readIntro();
    await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
    assert.equal(await page.locator('.rn-label').innerText(), "はじめてのスロット");
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.reel-night.show')).opacity) >= .99);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/first-spin-${touch ? "touch" : "pc"}.png` });
    await finish();
    const after = await page.evaluate(() => installSnapshot());
    assert.equal(after.count, expected.count, "通常抽選と回転数が違う");
    assert.equal(Object.values(after.stats).reduce((a, b) => a + b, 0) - Object.values(expected.before.stats).reduce((a, b) => a + b, 0), preview ? 0 : expected.exp);
    assert.equal(after.xp - expected.before.xp, preview ? expected.xp : 0);
    if (preview) assert.deepEqual(after.statXp, expected.before.statXp);
    for (const key of ["day", "slot", "stamina", "money"]) assert.equal(after[key], expected.before[key], key);
    assert.equal(after.pending, 0);
    assert(!after.flags._pakki_first_spin_pending);
    await page.evaluate(() => installProbe.reel.installReel());
    assert.deepEqual(await page.evaluate(() => installSnapshot()), after, "再訪で体験を繰り返した");
    assert.equal(await page.locator('.reel-night, .reel-intro').count(), 0);
    // 同じノートをモード切替の前後で開き、開いた時点の遊び方を読む。
    for (const mode of [preview, !preview]) {
      await page.evaluate(mode => { installProbe.growth.setGrowthPreview(mode); installProbe.reel.openNote(); }, mode);
      const note = page.locator('[data-test="reel-note"]');
      await (touch ? note.tap() : note.click());
      await assertGuide(mode);
      await (touch ? note.tap() : note.click());
      await (touch ? note.tap() : note.click());
    }
    assert.deepEqual(await page.evaluate(() => installSnapshot()), after, "ノート閲覧で報酬を増やさない");
  }, touch, preview);

  for (const preview of [false, true]) for (const capped of preview ? [false, true] : [false]) {
    await checkInstallation(`saved-${preview ? "exp" : "legacy"}${capped ? "-capped" : ""}-switch-mode`, async ({ page, boot }) => {
      const before = await page.evaluate(capped => {
        const { core, reel, growth } = installProbe;
        Object.assign(core.state.reel, { installed: true, introDone: true, settingGuideDone: true,
          lock: { count: 0, role: "bell", overlap: null, cue: "green" } });
        core.state.flags.pakki_app_installed = true;
        if (capped) growth.gainExp(growth.totalExpFor(growth.MAX_LEVEL), { silent: true });
        reel.onAction({ spent: 10 });
        core.save();
        return installSnapshot();
      }, capped);
      await boot(true);
      assert.deepEqual(await page.evaluate(() => installSnapshot()), before, "LOADで確定済み報酬が変わった");
      await page.evaluate(preview => {
        const { reel, growth } = installProbe;
        growth.setGrowthPreview(!preview);
        window.rewardCards = [];
        new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) {
            if (node.matches?.('.gain-card.slot-bonus')) rewardCards.push({ cls: node.className, text: node.textContent });
          }
        }).observe(document.getElementById('banners'), { childList: true });
        window.savedSpin = reel.presentNow();
      }, preview);
      await page.waitForFunction(capped => {
        const text = document.querySelector('.rw-bubble')?.textContent || "";
        return capped ? text.includes('経験値はもう上限だよ') : /経験値が|【.+】が/.test(text);
      }, capped);
      const bubble = await page.locator('.rw-bubble').innerText();
      if (preview) {
        assert.match(bubble, /経験値/);
        assert.doesNotMatch(bubble, /上がった|【/);
      } else assert.match(bubble, /【.+】が.+上がった/);
      await waitForSpin(page.evaluate(() => window.savedSpin), "saved result");
      await page.evaluate(() => installProbe.reel.presentNow());
      const after = await page.evaluate(() => installSnapshot());
      for (const key of ['count', 'stats', 'statXp', 'xp', 'hidane', 'day', 'slot', 'money', 'stamina']) {
        assert.deepEqual(after[key], before[key], `再表示で${key}を二重付与しない`);
      }
      assert.equal(after.pending, 0);
      const cards = await page.evaluate(() => window.rewardCards);
      assert.equal(cards.length, capped ? 0 : 1, "結果カードも一度だけ、上限で0なら通知しない");
      if (!capped) {
        assert.match(cards[0].cls, preview ? /\bexp\b/ : /\bstat\b/);
        if (preview) assert.match(cards[0].text, /EXP \+15/);
      }
    }, false, preview);
  }

  await checkInstallation("first-spin-keeps-normal-replay-chain", async ({ page, readIntro, finish }) => {
    const expected = await page.evaluate(() => {
      const { core, reel } = installProbe;
      for (let seed = 1; seed <= 1000; seed++) {
        const copy = { ...structuredClone(core.state.reel), seed };
        const results = reel.core.spinSeries(copy, {});
        if (results[0].role === "replay" && results.every(r => !reel.core.PEKA.includes(r.role) && !r.overlap)) {
          core.state.reel.seed = seed; startInstall();
          return { seed, count: copy.count };
        }
      }
      throw new Error("No replay seed found");
    });
    assert(expected.count > 1);
    await readIntro(); await finish();
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), expected.count);
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.pending.length), 0);
  });

  await checkInstallation("reload-during-explanation", async ({ page, boot, tap, readIntro, finish }) => {
    await page.evaluate(() => startInstall());
    await tap(); await tap();
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(installProbe.core.SAVE_KEY)).flags._pakki_first_spin_pending), true);
    await boot(true);
    await page.evaluate(() => startInstall());
    await readIntro(); await finish();
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), 1);
  });

  await checkInstallation("reload-after-explanation-before-draw", async ({ page, boot, finish }) => {
    // 説明完了のsaveと抽選確定の間で中断した、到達可能な保存境界。
    await page.evaluate(() => {
      const { core } = installProbe;
      core.state.reel.installed = core.state.reel.introDone = core.state.reel.settingGuideDone = true;
      core.state.flags._pakki_first_spin_pending = true; core.save();
    });
    await boot(true);
    await page.evaluate(() => startInstall());
    await finish();
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), 1);
    assert.equal(await page.locator('.reel-intro').count(), 0);
  });

  await checkInstallation("reload-during-first-spin", async ({ page, boot, readIntro }) => {
    await page.evaluate(() => startInstall()); await readIntro();
    await page.locator('.reel-night .rw-strip.spinning').first().waitFor();
    const committed = await page.evaluate(() => JSON.parse(localStorage.getItem(installProbe.core.SAVE_KEY)));
    assert.equal(committed.reel.count, 1);
    assert(!committed.flags._pakki_first_spin_pending);
    await boot(true);
    await page.evaluate(() => installProbe.reel.installReel());
    const after = await page.evaluate(() => installSnapshot());
    assert.equal(after.count, committed.reel.count);
    assert.deepEqual(after.stats, committed.stats, "途中再開で再抽選・二重報酬");
    assert.equal(await page.locator('.reel-night, .reel-intro').count(), 0);
  });

  for (const introDone of [false, true]) await checkInstallation(`legacy-installed-${introDone ? "read" : "unread"}`, async ({ page, readIntro, finish }) => {
    await page.evaluate(introDone => {
      const { core } = installProbe;
      core.state.reel.installed = true; core.state.reel.introDone = introDone;
      startInstall();
    }, introDone);
    if (!introDone) await readIntro();
    await finish();
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), 0, "旧導入済み保存へ体験を追加した");
  });

  await checkInstallation("existing-action-result-is-not-drawn-again", async ({ page, tap, finish }) => {
    await page.evaluate(() => { startInstall(); installProbe.reel.onAction({ spent: 10 }); });
    const before = await page.evaluate(() => installSnapshot());
    for (let i = 0; i < 6; i++) await tap();
    await finish();
    const after = await page.evaluate(() => installSnapshot());
    assert.equal(after.count, before.count); assert.deepEqual(after.stats, before.stats);
    assert.equal(after.pending, 0);
  });

  await checkInstallation("new-game-during-explanation", async ({ page }) => {
    await page.evaluate(() => {
      startInstall(); installProbe.core.newGame();
    });
    await waitForSpin(page.evaluate(() => installTask), "cancel old explanation");
    assert.equal(await page.locator('.reel-intro').count(), 0);
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.count), 0);
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.introDone), false);
    assert.equal(await page.evaluate(() => installProbe.core.state.reel.installed), false);
  });
} finally {
  await browser.close();
}
