// 生成素材・項目別の通知色・所持金の桁が変わっても動かないHUDを実ブラウザで確認。
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
    await Promise.all(["panel", "button", "map-pin", "heart", "reward", "gauge-frame", "gauge-fill"].map(async (name) => {
      const image = new Image(); image.src = `img/ui/lounge/${name}.webp`;
      await image.decode();
      if (!image.naturalWidth) throw new Error(`Failed to decode ${name}`);
    }));
  });
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    await page.setViewportSize(viewport);
    const geometry = await page.evaluate(() => {
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
          result.push({ money, day, rects: snapshot(), visible: amount.scrollWidth <= amount.clientWidth,
            timeFits: time.scrollWidth <= time.clientWidth,
            countdown: countdown.textContent, countdownFits: countdown.scrollWidth <= countdown.clientWidth });
        }
      }
      return result;
    });
    for (const result of geometry) {
      assert.deepEqual(result.rects, geometry[0].rects, `HUD moved: money=${result.money}, day=${result.day}`);
      assert(result.visible, `Money was clipped: ${result.money}`);
      assert(result.timeFits, "Time/weather label overlapped the money column");
      assert(result.countdownFits, "Next tournament countdown was clipped");
      assert.equal(result.countdown, `次の大会まであと${14 - result.day}日`);
    }
    if (shots) await page.screenshot({ path: `${shots}/fixed-hud-${viewport.width}.png` });
  }
  console.log("[ui skin] PASS: 7 generated images, 28 money/day/stamina cases at desktop and mobile sizes");
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
      const maximum = guts === 10 ? 100 : 160;
      for (const ratio of [1, 0.51, 0.5, 0.26, 0.25, 0.01, 0]) {
        T.core.state.stamina = Math.round(ratio * maximum);
        T.hud.updateHud();
        const holder = document.querySelector(".hud-stamina");
        out.push({ ratio, maximum, health: holder.dataset.health, color: getComputedStyle(holder.querySelector("b")).backgroundColor,
          width: holder.querySelector("b").style.width });
      }
    }
    return out;
  });
  for (const value of stamina) {
    const expected = value.ratio > .5 ? ["green", "rgb(142, 230, 168)"] : value.ratio > .25 ? ["yellow", "rgb(255, 212, 92)"] : ["red", "rgb(255, 105, 105)"];
    assert.deepEqual([value.health, value.color], expected);
    assert.equal(value.width, `${Math.round(value.ratio * 100)}%`);
  }
  console.log("[ui skin] PASS: green/yellow/red, exact boundaries, zero/full, expanded stamina capacity");
  const colors = await page.evaluate(() => {
    const stats = [["technique", "技", "技術"], ["sense", "感", "センス"], ["guts", "根", "根性"], ["charm", "魅", "魅力"], ["insight", "察", "洞察"]];
    T.ui.gainCard({ kind: "stat", stat: "technique", points: 3, badge: "技", top: "STATUS UP", main: "技術", sub: "上がった" });
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
      out.push({ key, color: skin.backgroundColor, generated: skin.backgroundImage.includes("reward.webp"), blend: skin.backgroundBlendMode });
    }
    return out;
  });
  assert.deepEqual(colors.map((c) => c.color), ["rgb(242, 195, 76)", "rgb(108, 198, 232)", "rgb(239, 122, 94)", "rgb(180, 154, 239)", "rgb(101, 201, 187)"]);
  assert(colors.every((c) => c.generated && c.blend === "luminosity"));
  if (shots) await page.screenshot({ path: `${shots}/stat-colors.png` });
  assert.deepEqual(errors, []);
  console.log("[ui skin] PASS: all five status colors tint the generated window face and rim");
} finally {
  await browser.close();
}
