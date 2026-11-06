// #2688 A16・A17・A18・A20: 大会まわりの小さな動き（ROUND の横帯・会場入りの煙ワイプ・工程の一筆・優勝の煙の輪・第4章の視点の横帯）。
// 通常と動き軽減の両方で、出る・消える・入力を止める・turbo で省く、を確かめる。
// CHROME_EXECUTABLE_PATH=... node remake/test/browser/tournament_motions.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || undefined });
const errors = [];
const log = (...a) => console.log(...a);

async function open(reducedMotion = "no-preference") {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, reducedMotion });
  const page = await context.newPage();
  page.on("pageerror", e => errors.push(`${reducedMotion}: ${e.message}`));
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]', { timeout: 90000 });
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    document.getElementById("screen").replaceChildren();
  });
  return { page, context };
}

for (const rm of ["no-preference", "reduce"]) {
  const { page, context } = await open(rm);
  // A16: ROUND の横帯（工程 0/8/9/10 だけ）と会場入りの煙ワイプ
  const round = await page.evaluate(async () => {
    const m = await import("./js/motions/tournament.js");
    const seen = [];
    const obs = new MutationObserver(() => document.querySelectorAll(".round-cut").forEach(n => seen.push(n.textContent)));
    obs.observe(document.getElementById("fx"), { childList: true, subtree: true });
    const t0 = performance.now();
    const shown = [];
    for (const step of [0, 1, 8, 9, 10]) shown.push(await m.tournamentRound(step));
    const ms = performance.now() - t0;
    obs.disconnect();
    const w0 = performance.now();
    let covered = false;
    await m.venueWipe(() => { covered = document.getElementById("wipe").classList.contains("cover"); });
    return { shown, texts: [...new Set(seen)], ms, covered, wipeMs: performance.now() - w0, left: document.querySelectorAll(".round-cut").length };
  });
  log(rm, "A16", JSON.stringify(round));
  assert.deepEqual(round.shown, [true, false, true, true, true]);
  assert.ok(round.texts.some(t => t.includes("ROUND 1") && t.includes("準備")));
  assert.ok(round.texts.some(t => t.includes("ROUND 4")));
  assert.equal(round.left, 0);
  assert.ok(round.covered, "煙ワイプが覆った瞬間に mid が呼ばれる");

  // A18: 煙の輪3つ（約1.2秒）。覆っている間は Enter を止める
  const rings = await page.evaluate(async () => {
    const m = await import("./js/motions/tournament.js");
    const host = document.createElement("div");
    host.style.cssText = "position:absolute;inset:0";
    document.getElementById("fx").append(host);
    let max = 0, passed = 0;
    const count = setInterval(() => { max = Math.max(max, host.querySelectorAll(".tm-ring").length); }, 30);
    const listener = () => passed++;
    window.addEventListener("keydown", listener);
    const t0 = performance.now();
    const done = m.victoryRings(host);
    await new Promise(r => setTimeout(r, 100));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await done;
    const ms = performance.now() - t0;
    clearInterval(count);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    window.removeEventListener("keydown", listener);
    const left = host.querySelectorAll(".tm-rings").length; host.remove();
    return { max, ms, left, passed };
  });
  log(rm, "A18", JSON.stringify(rings));
  assert.equal(rings.max, 3); assert.equal(rings.left, 0);
  assert.ok(rings.ms > 900 && rings.ms < 2600, `輪の長さ ${rings.ms}`);
  assert.equal(rings.passed, 1, "輪の間の Enter は止め、終わった後は通す");

  // A20: 第4章の蒸らし待ちの台本で、なる → 王煙楼 → シェイクの順に横帯が流れ、会話は最後まで進む
  await page.evaluate(async () => {
    const data = await import("./js/core/data.js");
    await data.loadTournamentCraftDialogue();
    const story = await import("./js/craft/tournament-story-data.js");
    const vn = await import("./js/vn/engine.js");
    const dlg = story.tournamentStoryDialogue({ chapter: 4, mix: {}, pack: "normal" }, "waiting");
    const f = window.__focus = { order: [], rings: [], lineAtBand: [], done: false, motionLines: dlg.lines.filter(l => l.type === "motion").length };
    const obs = new MutationObserver(recs => recs.forEach(r => r.addedNodes.forEach(n => {
      if (n.classList?.contains("tm-focus")) { f.order.push(n.dataset.focus); f.rings.push(n.textContent); f.lineAtBand.push(document.querySelector(".vn-text")?.textContent || ""); }
    })));
    obs.observe(document.getElementById("fx"), { childList: true });
    f.t0 = performance.now();
    vn.play(dlg).then(res => { obs.disconnect(); f.done = true; f.cancelled = !!res?.cancelled; f.ms = performance.now() - f.t0; });
  });
  // 実キーの Enter で送る。帯の間の Enter は止められ、帯が終わると次の行が出る。
  for (let i = 0; i < 200 && !await page.evaluate(() => window.__focus.done); i++) {
    await page.keyboard.press("Enter"); await page.waitForTimeout(250);
  }
  const focus = await page.evaluate(() => ({ ...window.__focus, left: document.querySelectorAll(".tm-focus").length }));
  log(rm, "A20", JSON.stringify(focus));
  assert.equal(focus.motionLines, 3);
  assert.deepEqual(focus.order, ["naru", "master_hookah", "sheikh"]);
  assert.ok(focus.rings[0].includes("孤高の探求者") && focus.rings[1].includes("王 煙楼"));
  assert.equal(focus.left, 0); assert.equal(focus.cancelled, false);

  // A20: turbo（テストの瞬時送り）では帯を出さずに通る
  const turbo = await page.evaluate(async () => {
    const story = await import("./js/craft/tournament-story-data.js");
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true;
    let n = 0;
    const obs = new MutationObserver(() => { n += document.querySelectorAll(".tm-focus").length; });
    obs.observe(document.getElementById("fx"), { childList: true });
    await vn.play(story.tournamentStoryDialogue({ chapter: 4, mix: {}, pack: "normal" }, "waiting"));
    obs.disconnect(); vn.vnTest.turbo = false;
    return n;
  });
  assert.equal(turbo, 0);

  // A17: 作業台の工程が替わるときだけ、操作欄に一筆が出る
  const stroke = await page.evaluate(async () => {
    const session = await import("./js/craft/session.js");
    const cs = session.newSession("practice");
    const bench = session.openBench(cs, { steps: [["setup", "準備"], ["mix", "配合"]] });
    await bench.ready;
    const right = document.querySelector(".bench-right");
    session.stepPanel("setup", "準備");
    const first = right.querySelectorAll(".tm-stroke-clip").length;
    session.stepPanel("setup", "準備");
    const same = right.querySelectorAll(".tm-stroke-clip").length;
    session.stepPanel("mix", "配合");
    const switched = right.querySelectorAll(".tm-stroke-clip").length;
    const calm = right.querySelector(".tm-stroke")?.dataset.calm;
    const pos = getComputedStyle(right).position;
    const clip = right.querySelector(".tm-stroke-clip")?.getBoundingClientRect();
    const box = right.getBoundingClientRect();
    for (let i = 0; i < 30 && right.querySelector(".tm-stroke-clip"); i++) await new Promise(r => setTimeout(r, 100));
    return { first, same, switched, calm, pos, inside: clip && Math.abs(clip.width - box.width) <= 4 && Math.abs(clip.top - box.top) <= 4,
      after: right.querySelectorAll(".tm-stroke-clip").length, pointer: getComputedStyle(right).pointerEvents };
  });
  log(rm, "A17", JSON.stringify(stroke));
  assert.equal(stroke.first, 0); assert.equal(stroke.same, 0); assert.equal(stroke.switched, 1);
  assert.equal(stroke.calm, rm === "reduce" ? "true" : "false");
  assert.ok(stroke.inside); assert.equal(stroke.after, 0);
  await context.close();
}
await browser.close();
assert.deepEqual(errors, []);
console.log("PASS #2688 A16 A17 A18 A20 motions");
