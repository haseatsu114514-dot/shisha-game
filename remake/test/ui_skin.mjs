// 簡潔な能力通知と5色・所持金の桁・体力に応じて伸びるHUDを実ブラウザで確認。
// サーバーを8123で起動後: node remake/test/ui_skin.mjs（SHOTSで確認画像の保存先）
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    core.newGame();
    const hud = await import("./js/daily/hud.js");
    const ui = await import("./js/core/ui.js");
    const map = await import("./js/daily/map.js");
    const stats = await import("./js/core/stats.js");
    window.T = { core, hud, ui, map, stats };
    core.state.phase = "daily";
    for (const id of ["minto", "naru", "adam", "tsumugi", "rin"]) core.state.met[id] = true;
    hud.initHud({}); hud.showHud();
    window.previewMap = map.chooseSpot();
    await Promise.all(["panel", "button", "map-pin", "heart", "reward-clean", "gauge-frame", "gauge-fill"].map(async (name) => {
      const image = new Image(); image.src = `img/ui/lounge/${name}.webp`;
      await image.decode();
      if (!image.naturalWidth) throw new Error(`Failed to decode ${name}`);
    }));
  });
  // 実フローでは chooseSpot() が地図画面を出して初めて HUD がレイアウトされる
  // （タイトル画面では #hud が display:none で矩形が全て 0 になる）。
  // 地図画面に着いて HUD の幅が出るまで待ってから計測する。
  await page.waitForFunction(() => document.body.dataset.screen === "map"
    && document.querySelector(".hud-stamina")?.getBoundingClientRect().width > 0, null, { timeout: 30000 });
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
      document.querySelector(".hud-bar").style.transition = "none";
      const snapshot = () => [".hud-card", ".hud-stamina", ".hud-level", ".hud-lime", ".hud-menu"].map((selector) => {
        const rect = document.querySelector(selector).getBoundingClientRect();
        return [rect.x, rect.y, rect.width, rect.height];
      });
      const result = [];
      for (const money of [0, 9, 99, 999, 9999, 99999, 999999]) {
        for (const [day, guts, slot] of [[1, 10, 0], [13, 90, 1]]) {
          Object.assign(T.core.state, { money, day, slot });
          T.core.state.stats.guts = guts;
          T.hud.updateHud();
          const amount = document.querySelector(".dc-row.money b");
          const countdown = amount.closest(".dc-meta").querySelector(".dc-row:not(.money)");
          const time = document.querySelector(".dc-slot");
          result.push({ money, day, rects: snapshot(), barWidth: parseFloat(document.querySelector(".hud-bar").style.width), visible: amount.scrollWidth <= amount.clientWidth,
            timeFits: time.scrollWidth <= time.clientWidth,
            countdown: countdown.textContent, countdownFits: countdown.scrollWidth <= countdown.clientWidth });
        }
      }
      return result;
    });
    for (const result of geometry) {
      const sameCapacity = geometry.find((value) => value.day === result.day);
      assert.deepEqual(result.rects, sameCapacity.rects, `HUD moved: money=${result.money}, day=${result.day}`);
      assert.deepEqual([result.rects[0], ...result.rects.slice(2)], [geometry[0].rects[0], ...geometry[0].rects.slice(2)], "Capacity change moved the other HUD controls");
      assert(result.visible, `Money was clipped: ${result.money}`);
      assert(result.timeFits, "Time/weather label overlapped the money column");
      assert(result.countdownFits, "Next tournament countdown was clipped");
      assert.equal(result.countdown, `次の大会まであと${14 - result.day}日`);
    }
    // 統合HUDではカード幅が固定でバーが列幅いっぱいに広がるため、器の伸びは
    // バーに指定された幅（updateHud が最大体力から決める）で見る。
    assert(geometry[1].barWidth > geometry[0].barWidth, "Stamina window did not grow with maximum capacity");
    if (shots) await page.screenshot({ path: `${shots}/fixed-hud-${viewport.width}.png` });
  }
  console.log("[ui skin] PASS: 7 generated images, stable money/controls and growing stamina window at desktop and mobile sizes");
  await page.setViewportSize({ width: 1280, height: 720 });
  const moneyAndSave = await page.evaluate(() => {
    T.core.state.money = 999990;
    T.stats.addMoney(20);
    const capped = T.core.state.money;
    T.stats.addMoney(-125);
    const spent = T.core.state.money;
    T.stats.addMoney(-1000000);
    const minimum = T.core.state.money;
    Object.assign(T.core.state, { money: 10000000, day: 15, phase: "tournament" });
    T.core.state.tournament.attempts = 2;
    T.core.state.flags._ev_last_night = true;
    T.core.save();
    const loaded = T.core.load();
    const migrated = { money: loaded.money, day: loaded.day, phase: loaded.phase,
      attempts: loaded.tournament.attempts, lastNight: loaded.flags._ev_last_night };
    const countdowns = [];
    for (let day = 1; day <= 14; day++) { loaded.day = day; countdowns.push(T.hud.daysLeft()); }
    T.hud.updateHud();
    const lime = document.querySelector(".hud-lime"), label = lime.querySelector("span");
    const outer = lime.getBoundingClientRect(), inner = label.getBoundingClientRect();
    const labelRange = document.createRange(); labelRange.selectNodeContents(label);
    const glyphs = labelRange.getBoundingClientRect();
    const centered = Math.abs(inner.x + inner.width / 2 - outer.x - outer.width / 2) < .5
      && Math.abs(glyphs.x + glyphs.width / 2 - inner.x - inner.width / 2) < .5;
    const readable = getComputedStyle(document.querySelector(".dc-row.money b")).fontSize;
    const onDayText = document.querySelector(".dc-meta .dc-row:not(.money)").textContent;
    return { capped, spent, minimum, migrated, countdowns, centered, readable, onDayText };
  });
  assert.deepEqual([moneyAndSave.capped, moneyAndSave.spent, moneyAndSave.minimum], [999999, 999874, 0]);
  assert.deepEqual(moneyAndSave.migrated, { money: 999999, day: 14, phase: "tournament", attempts: 2, lastNight: true });
  assert.deepEqual(moneyAndSave.countdowns, Array.from({length: 14}, (_, i) => 13 - i));
  assert.equal(moneyAndSave.onDayText, "次の大会まであと0日");
  assert(moneyAndSave.centered, "LIME label or glyphs were off center");
  assert.equal(moneyAndSave.readable, "20px");
  console.log("[ui skin] PASS: six-digit cap, spending, zero, old DAY15 save, countdown, centered LIME, readable money");
  const stamina = await page.evaluate(() => {
    const out = [];
    for (const guts of [10, 90]) {
      T.core.state.stats.guts = guts;
      const maximum = guts === 10 ? 100 : 154; // 根性90＝9段: 100＋54（10段表 GUTS_STAMINA_BONUS）
      for (const ratio of [1, 0.51, 0.5, 0.26, 0.25, 0.01, 0]) {
        T.core.state.stamina = Math.round(ratio * maximum);
        T.hud.updateHud();
        const holder = document.querySelector(".hud-stamina");
        const bar = holder.querySelector(".hud-bar"), label = holder.querySelector(":scope > span"), style = getComputedStyle(holder), barStyle = getComputedStyle(bar);
        out.push({ ratio: T.core.state.stamina / maximum, maximum, // 丸めた実際の体力で境界を判定する（最大154は割り切れない）
           health: holder.dataset.health, color: getComputedStyle(holder.querySelector("b")).backgroundColor,
          width: holder.querySelector("b").style.width, windowWidth: holder.clientWidth, barWidth: bar.clientWidth, barSpecifiedWidth: parseFloat(bar.style.width),
          extra: holder.clientWidth - label.offsetWidth - bar.offsetWidth - parseFloat(barStyle.marginLeft) - parseFloat(barStyle.marginRight) - parseFloat(style.gap) - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
            // 根性の上乗せがある時だけ「根」バッジが並ぶ（#1685 T3）
            - (holder.querySelector(".guts-badge:not([hidden])") ? holder.querySelector(".guts-badge").offsetWidth + parseFloat(style.gap) : 0) });
      }
    }
    return out;
  });
  for (const value of stamina) {
    const expected = value.ratio > .5 ? ["green", "rgb(142, 230, 168)"] : value.ratio > .25 ? ["yellow", "rgb(255, 212, 92)"] : ["red", "rgb(255, 105, 105)"];
    assert.deepEqual([value.health, value.color], expected);
    assert.equal(value.width, `${Math.round(value.ratio * 100)}%`);
    // バーは margin-right: -9px でカード端まで張り出す設計のため、余白計算はバーのマージンボックス込みで数える。
    assert(Math.abs(value.extra) <= 1, `Unused horizontal stamina space: ${value.extra}px`);
  }
  for (const maximum of [100, 154]) {
    assert.equal(new Set(stamina.filter((value) => value.maximum === maximum).map((value) => value.windowWidth)).size, 1, "Losing stamina changed the capacity window");
  }
  assert.equal(stamina[0].barSpecifiedWidth, 150);
  assert.equal(stamina[7].barSpecifiedWidth, 231); // 150px × 154/100（DUI13 でバーを長くした）
  console.log("[ui skin] PASS: green/yellow/red, exact boundaries, zero/full, expanded stamina capacity");
  const sessions = await page.evaluate(async () => {
    const { newSession } = await import("./js/craft/session.js"), { skill } = await import("./js/craft/common.js");
    const out = [];
    for (const guts of [10, 90]) {
      T.core.state.stats.guts = guts;
      for (const ratio of [.51, .5, .25]) {
        T.core.state.stamina = Math.floor(T.stats.maxStamina() * ratio); // 最大154でも境界の内側に置く
        const cs = newSession("tournament"), tutorial = newSession("tutorial");
        T.core.state.stamina = T.stats.maxStamina(); // 始めた後の回復で同じ一台の判定は変えない
        out.push({ guts, ratio, health: cs.condition.health, now: T.stats.currentCondition().health,
          slow: skill.slow(cs), window: skill.window(cs), tutorialSlow: skill.slow(tutorial), tutorialWindow: skill.window(tutorial) });
      }
    }
    return out;
  });
  for (const guts of [10, 90]) {
    const [green, yellow, red] = sessions.filter((value) => value.guts === guts);
    assert.deepEqual([green.health, yellow.health, red.health], ["green", "yellow", "red"]);
    assert(sessions.every((value) => value.now === "green"));
    assert(green.slow > yellow.slow && red.slow < yellow.slow);
    assert(green.window > yellow.window && red.window < yellow.window);
    assert.deepEqual([red.tutorialSlow, red.tutorialWindow], [yellow.slow, yellow.window]);
  }
  console.log("[ui skin] PASS: real session captures HUD condition at both capacities, recovery cannot change the current craft, lessons remain neutral");
  const colors = await page.evaluate(() => {
    const stats = [["technique", "技", "技術"], ["sense", "感", "センス"], ["guts", "根", "根性"], ["charm", "魅", "魅力"], ["insight", "察", "洞察"]];
    T.ui.gainCard({ kind: "stat", stat: "technique", points: 1, badge: "技", top: "STATUS UP", main: "技術" });
    const template = document.querySelector(".gain-card.st-technique");
    template.style.visibility = "hidden";
    const preview = document.createElement("div");
    preview.style.cssText = "position:absolute;inset:110px 240px 90px;display:grid;grid-template-columns:1fr 1fr;align-content:center;gap:24px;z-index:60";
    document.querySelector("#stage").append(preview);
    const out = [];
    for (const [key, badge, name] of stats) {
      const card = template.cloneNode(true);
      card.className = `gain-card stat st-${key}`;
      card.style.cssText = "animation:none;opacity:1;transform:none";
      card.querySelector(".gc-badge").textContent = badge;
      card.querySelector(".gc-main").textContent = name;
      preview.append(card);
      const skin = getComputedStyle(card, "::after");
      out.push({ key, color: getComputedStyle(card).getPropertyValue("--gc").trim(), art: skin.backgroundImage, mask: skin.maskImage,
        badge: getComputedStyle(card.querySelector(".gc-badge")).borderImageSource });
    }
    return out;
  });
  assert.deepEqual(colors.map((c) => c.color), ["#f2c34c", "#6cc6e8", "#ef7a5e", "#b49aef", "#65c9bb"]);
  assert(colors.every((c) => c.art.includes("reward-clean.webp") && c.mask.includes("reward-clean.webp") && c.badge.includes("panel.webp")), "Original smoke-free frame or badge were missing");
  if (shots) await page.screenshot({ path: `${shots}/stat-colors.png` });
  assert.deepEqual(errors, []);
  console.log("[ui skin] PASS: all five status colors and the original smoke-free frame remain");
} finally {
  await browser.close();
}
