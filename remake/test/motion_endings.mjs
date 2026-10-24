// 採用した演出を通常速度で再生。終端の光の打ち切り、チェキの着地/CG受け渡し、入力と幕の後片付けを確認。
// CHROME_EXECUTABLE_PATH=... SHOTS=/tmp/motion-review node remake/test/motion_endings.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const errors = [];

async function open(viewport, name, reducedMotion = "no-preference", variant = null) {
  const context = await browser.newContext({ viewport, reducedMotion,
    ...(shots ? { recordVideo: { dir: shots, size: viewport } } : {}),
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${name}: ${e.message}`));
  const url = new URL(base);
  if (variant) url.searchParams.set("movar", variant);
  await page.goto(url.href); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    const ui = await import("./js/core/ui.js");
    const data = await import("./js/core/data.js");
    const motions = await import("./js/core/scene-motions.js");
    const transitions = await import("./js/core/transitions.js");
    window.T = { core, ui, data, motions, transitions };
    document.getElementById("screen").replaceChildren();
    await ui.setBg(data.bgUrl("bg_tonari_inside", "night"), { instant: true });

    // Animationを早送りしない。実際に幕を外す瞬間の、まだ見える光を記録する。
    window.audit = { cutLights: [], penJumps: [], dotLoops: [], mid: [], keys: 0, handoff: null, stalls: 0, penFrameGap: 0 };
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const a = originalAnimate.apply(this, args);
      if (this.matches(".mo-ck-dots")) audit.dotLoops.push(a);
      return a;
    };
    const cancel = Animation.prototype.cancel;
    Animation.prototype.cancel = function () {
      const target = this.effect?.target;
      const frames = this.effect?.getKeyframes() || [];
      const timing = this.effect?.getComputedTiming();
      if (target?.closest(".mo") && this.playState === "running" && Number.isFinite(timing?.endTime)
          && frames[0]?.transform?.includes("scale(0)") && frames.at(-1)?.transform?.includes("scale(0)")) {
        const style = getComputedStyle(target);
        const matrix = new DOMMatrix(style.transform);
        if (Math.hypot(matrix.a, matrix.b) > .03 && Number(style.opacity) > .02) {
          audit.cutLights.push({ remaining: timing.endTime - this.currentTime, scale: Math.hypot(matrix.a, matrix.b) });
        }
      }
      return cancel.call(this);
    };
    // コールバックの実行間隔は描画フレームの間隔ではない。重いフレームの後には
    // 別フレームの更新が3ms未満で届くため、rAFのtimestampで同一フレームを判定する。
    let frame = null, penUpdated = false;
    const raf = window.requestAnimationFrame;
    const frameCallback = callback => timestamp => {
      frame = timestamp; penUpdated = false;
      callback(timestamp);
      if (audit.stallPenFrames && penUpdated && audit.stalls < 4) {
        audit.stalls++;
        const until = performance.now() + 80;
        while (performance.now() < until) {} // 実際に描画を落とす。演出の時計は早送りしない。
      }
    };
    window.requestAnimationFrame = callback => raf.call(window, frameCallback(callback));
    // ペンの移動終了と書き出しが同じフレームで高さを変えていないか。
    const previous = new WeakMap();
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      if (name === "transform" && this.firstElementChild?.getAttribute("d") === "M -8 -48 L -4 -7 Q 0 0 4 -7 L 8 -48 Z") {
        const match = String(value).match(/^translate\([^ ]+ ([^)]+)\)/);
        if (match) {
          const y = Number(match[1]), prev = previous.get(this);
          if (prev && frame !== null && frame === prev.frame && Math.abs(y - prev.y) > 8 && getComputedStyle(this.parentElement).opacity !== "0") {
            audit.penJumps.push(Math.abs(y - prev.y));
          }
          if (prev && frame !== null && prev.frame !== null) audit.penFrameGap = Math.max(audit.penFrameGap, frame - prev.frame);
          previous.set(this, { y, frame }); penUpdated = true;
        }
      }
      return setAttribute.call(this, name, value);
    };
    // 同じ監視を合成フレームでも検査。壁時計を固定し、旧3ms判定の誤検出を再現する。
    window.checkPenAudit = () => {
      const ns = "http://www.w3.org/2000/svg", root = document.createElementNS(ns, "svg");
      const pen = document.createElementNS(ns, "g"), tip = document.createElementNS(ns, "path");
      tip.setAttribute("d", "M -8 -48 L -4 -7 Q 0 0 4 -7 L 8 -48 Z");
      pen.append(tip); root.append(pen); document.body.append(root);
      const now = Object.getOwnPropertyDescriptor(performance, "now");
      Object.defineProperty(performance, "now", { configurable: true, value: () => 1000 });
      const place = (timestamp, y) => frameCallback(() => pen.setAttribute("transform", `translate(0 ${y})`))(timestamp);
      try {
        place(100, -30); place(116.667, -18.182);
        const separateFrames = audit.penJumps.splice(0);
        place(133.333, -30); audit.penJumps.length = 0;
        place(133.333, 0);
        const sameFrame = audit.penJumps.splice(0);
        root.style.opacity = "0"; place(133.333, -30);
        return { separateFrames, sameFrame, hidden: audit.penJumps.splice(0) };
      } finally {
        if (now) Object.defineProperty(performance, "now", now); else delete performance.now;
        root.remove(); frame = null; audit.penFrameGap = 0;
      }
    };
    document.addEventListener("keydown", (e) => { if (e.key === "Enter") audit.keys++; });
  });
  return { context, page };
}

async function checkScene(name, viewport, label, variant = null, stallPenFrames = false) {
  const { context, page } = await open(viewport, `${label}-${name}`, "no-preference", variant);
  try {
    await page.evaluate(stall => { audit.stallPenFrames = stall; }, stallPenFrames);
    await page.evaluate((name) => {
      window.motionDone = false;
      window.motionRun = (async () => {
        const { ui, data, motions, transitions } = T;
        const mid = async () => {
          audit.mid.push(transitions.isCovering());
          // 背景のロードが遅くても幕を先に外さない。
          await new Promise((r) => setTimeout(r, 120));
          await ui.setBg(data.bgUrl("bg_home", "day"));
        };
        if (name === "door") {
          const door = (await import("./js/motions/door.js")).a(document.getElementById("fx"), { x: 1030, y: 410 });
          await door.covered;
          await ui.setBg(data.bgUrl("bg_home", "day"), { instant: true });
          await door.release(); await door.release(); // 二重解放も安全
        } else if (name === "cheki") {
          // 本編と同じshow_cgを使い、モーションの直後にCGが同じ位置へ置かれることを確認。
          const engine = await import("./js/vn/engine.js");
          const previous = engine.hooks.onCg;
          const shown = new Promise((resolve) => {
            engine.hooks.onCg = (id) => { previous?.(id); resolve(); };
          });
          const remove = Element.prototype.remove;
          Element.prototype.remove = function () {
            if (this.matches(".mo-cheki")) {
              const fly = this.querySelector(".mo-ck-fly, .mo-ck-cam > .mo-ck-film");
              const cg = document.querySelector('.vn-cg[data-cg="cg_minto_first_cheki"]');
              const a = fly.getBoundingClientRect(), b = cg.getBoundingClientRect();
              const scale = document.getElementById("stage").getBoundingClientRect().height / 720;
              audit.handoff = { visible: getComputedStyle(cg).opacity, showing: cg.classList.contains("show"),
                left: a.left - (b.left + (1280 - 490 * 993 / 1584) * scale / 2),
                top: a.top - (b.top + 18 * scale), width: a.width - 490 * 993 / 1584 * scale,
                height: a.height - 490 * scale };
            }
            return remove.call(this);
          };
          engine.play({ dialogue_id: "motion_cheki_test", metadata: {}, lines: [
            { type: "show_cg", cg_id: "cg_minto_first_cheki", effect: "cheki" },
            { speaker: "minto", text: "チェキ、できたよ。" },
          ] });
          await shown; engine.hooks.onCg = previous;
        } else if (name === "tarot") await motions.tarotFlip("tsumugi");
        else if (name === "gift") await motions.giftOpen("suyaki_tsumugi");
        else if (name === "shift") await motions.shiftClose();
        else if (name === "shark") await motions.sharkSwim(mid);
        else if (name === "sketch") await motions.sketchIn(mid, data.bgUrl("bg_home", "day"));
        else if (name.startsWith("dawn-")) await transitions.nightToMorning(document.getElementById("fx"), async () => {
          await mid(); return { fromDay: 3, day: 4, fromLeft: 12, left: 11,
            weather: name.slice(5), sick: name === "dawn-sick" };
        });
        window.motionDone = true;
      })();
    }, name);
    await page.waitForSelector(".mo, .scene-curtain, .tr-dawn");
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => audit.keys), 0, `${name}: Enter leaked through the motion`);
    await page.waitForFunction(() => window.motionDone, null, { timeout: 45000 });
    await page.evaluate(() => window.motionRun);
    const result = await page.evaluate(() => ({
      ...audit, dotLoops: audit.dotLoops.map((a) => ({ state: a.playState, iterations: a.effect.getTiming().iterations === Infinity })),
      leftovers: document.querySelectorAll(".mo, .scene-curtain, .tr-dawn").length, covering: T.transitions.isCovering(),
    }));
    assert.deepEqual(result.cutLights, [], `${name}: visible twinkles were cut off`);
    assert.deepEqual(result.penJumps, [], `${name}: marker snapped to the paper`);
    if (stallPenFrames) {
      assert.equal(result.stalls, 4, "exercise marker updates with dropped frames");
      assert.ok(result.penFrameGap >= 64, `no dropped marker frame: ${result.penFrameGap}ms`);
    }
    assert.equal(result.leftovers, 0); assert.equal(result.covering, false);
    if (["shark", "sketch"].includes(name) || name.startsWith("dawn-")) assert.deepEqual(result.mid, [true]);
    if (name === "cheki") {
      assert.deepEqual(result.dotLoops, variant === "a" ? [] : [{ state: "idle", iterations: true }], "dots must loop and be canceled at cleanup");
      assert.equal(result.handoff.showing, true); assert.equal(Number(result.handoff.visible), 1);
      for (const k of ["left", "top", "width", "height"]) assert.ok(Math.abs(result.handoff[k]) < 1, `CG jumped at handoff: ${k}`);
    }
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => audit.keys), 1, `${name}: input stayed blocked after cleanup`);
    if (shots) { await page.waitForTimeout(300); await page.screenshot({ path: `${shots}/${label}-${name}-after.png` }); }
    console.log(`PASS ${label} ${name}`);
  } finally {
    const video = page.video(); await context.close();
    if (shots) await video.saveAs(`${shots}/${label}-${name}.webm`);
  }
}

// 電車は実際のアニメーションを通常速度で測る。紫・遮蔽・任意の乗客・保存不変を確認。
async function checkTrains() {
  const cases = [
    ["normal", { width: 1280, height: 720 }, { cameo: null, tone: "night" }],
    ...["samechan", "hiyori", "minto", "adam", "tsumugi"].map(cameo => [cameo, { width: 1280, height: 720 }, { cameo }]),
    ["halloween", { width: 844, height: 390 }, { halloween: true, cameo: "samechan" }],
    ["portrait", { width: 390, height: 844 }, { halloween: true, cameo: "hiyori" }],
    ["slow-arrival", { width: 1280, height: 720 }, { cameo: null, delay: 1300 }],
    ["missing-crowd", { width: 1280, height: 720 }, { cameo: null, unavailable: true }],
  ];
  for (const [name, viewport, options] of cases.filter(c => !process.env.TRAIN_CASE_FILTER || c[0] === process.env.TRAIN_CASE_FILTER)) {
    const { page, context } = await open(viewport, `train-${name}`);
    try {
      if (options.unavailable) await page.route("**/ui/transitions/train/crowd_*.webp", route => route.fulfill({ status: 404, body: "test missing image" }));
      if (name === "normal") await page.evaluate(async () => (await import("./js/core/mg-kit.js")).setMotionPalette("free"));
      await page.evaluate(options => {
        T.core.state.chapter = 2;
        window.trainAudit = { mid: 0, opacity: null, fades: [], done: false, before: JSON.stringify(T.core.state), start: performance.now() };
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (frames, timing) {
          if (this.matches(".mo-train")) trainAudit.fades.push({ frames, duration: timing.duration });
          return animate.call(this, frames, timing);
        };
        window.trainRun = T.motions.trainRide(async () => {
          trainAudit.mid++;
          const node = document.querySelector(".mo-train");
          trainAudit.opacity = Number(getComputedStyle(node).opacity);
          trainAudit.covering = T.transitions.isCovering();
          if (options.delay) await new Promise(r => setTimeout(r, options.delay));
          document.getElementById("bg").style.backgroundColor = "rgb(9, 7, 19)";
        }, options).then(() => {
          trainAudit.elapsed = performance.now() - trainAudit.start;
          trainAudit.unchanged = trainAudit.before === JSON.stringify(T.core.state);
          trainAudit.done = true;
        });
      }, options);
      await page.waitForFunction(() => window.trainAudit.opacity === 1);
      await page.keyboard.press("Enter");
      const visible = await page.evaluate(() => ({
        guests: document.querySelectorAll(".train-guest").length,
        costumes: document.querySelectorAll(".train-costume").length,
        backdrop: document.querySelector(".mo-train .mo-back").style.backgroundColor,
        keys: audit.keys,
      }));
      assert.deepEqual(visible, { guests: options.cameo ? 1 : 0, costumes: options.halloween ? 2 : 0, backdrop: "rgb(21, 14, 48)", keys: 0 });
      if (options.unavailable) assert.equal(await page.locator('.mo-train image[href*="/transitions/train/"]').count(), 0);
      if (shots) await page.screenshot({ path: `${shots}/train-${name}-covered.png` });
      await page.waitForFunction(() => trainAudit.done);
      const result = await page.evaluate(() => ({ ...trainAudit,
        overlays: document.querySelectorAll(".mo-train").length, coveringAfter: T.transitions.isCovering() }));
      assert.equal(result.mid, 1); assert.equal(result.opacity, 1); assert.equal(result.covering, true);
      assert.equal(result.unchanged, true); assert.equal(result.overlays, 0); assert.equal(result.coveringAfter, false);
      assert.deepEqual(result.fades.map(f => [f.frames[0].opacity, f.frames.at(-1).opacity, f.duration]), [[0, 1, 220], [1, 0, 280]]);
      assert(result.elapsed < 2800, `${name}: ${result.elapsed}ms took too long`);
      await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => audit.keys), 1);
      if (name === "normal") {
        const policy = await page.evaluate(async () => {
          const { trainPassengers } = await import("./js/motions/train-passengers.js");
          const value = { chapter: 2, day: 17, slot: 0, weatherSeed: 1, flags: {}, met: Object.fromEntries(["samechan", "hiyori", "minto", "adam", "tsumugi", "naru"].map(id => [id, true])) };
          const before = JSON.stringify(value), seen = new Set();
          for (let weatherSeed = 0; weatherSeed < 500; weatherSeed++) seen.add(trainPassengers({ ...value, weatherSeed }).cameo);
          const selected = trainPassengers(value);
          return { seen: [...seen].filter(Boolean).sort(), occasional: seen.has(null), stable: JSON.stringify(selected) === JSON.stringify(trainPassengers(value)),
            chapter1: trainPassengers({ ...value, chapter: 1 }).cameo, unknown: trainPassengers({ ...value, met: {} }).cameo,
            seasonal: trainPassengers({ ...value, flags: { _ch2_halloween_active: true } }).halloween,
            ordinary: selected.halloween, chapter3: trainPassengers({ ...value, chapter: 3, flags: { _ch2_halloween_active: true } }).halloween,
            unchanged: before === JSON.stringify(value) };
        });
        assert.deepEqual(policy, { seen: ["adam", "hiyori", "minto", "samechan", "tsumugi"], occasional: true, stable: true,
          chapter1: null, unknown: null, seasonal: true, ordinary: false, chapter3: false, unchanged: true });
      }
      console.log(`PASS train ${name}: ${Math.round(result.elapsed)}ms, fade/cover/cleanup/save`);
    } finally { await context.close(); }
  }
  if (process.env.TRAIN_CASE_FILTER) return;
  for (const mode of ["skip", "reduced", "turbo", "exception"]) {
    const { page, context } = await open({ width: 1280, height: 720 }, `train-${mode}`, mode === "reduced" ? "reduce" : "no-preference");
    try {
      const result = await page.evaluate(async mode => {
        if (mode === "skip") document.body.classList.add("vn-skip");
        if (mode === "turbo") window.__remake.vnTest.turbo = true;
        let mid = 0, rejected = false;
        try { await T.motions.trainRide(() => { mid++; if (mode === "exception") throw Error("expected train failure"); }); }
        catch (e) { if (e.message !== "expected train failure") throw e; rejected = true; }
        return { mid, rejected, overlays: document.querySelectorAll(".mo-train").length, covering: T.transitions.isCovering() };
      }, mode);
      assert.deepEqual(result, { mid: 1, rejected: mode === "exception", overlays: 0, covering: false });
      console.log(`PASS train ${mode}`);
    } finally { await context.close(); }
  }
}

try {
  await checkTrains();
  if (!process.argv.includes("--train-only")) {
  const desktop = { width: 1280, height: 720 }, mobile = { width: 844, height: 390 };
  const { page: auditPage, context: auditContext } = await open(desktop, "pen-audit");
  try {
    assert.deepEqual(await auditPage.evaluate(() => checkPenAudit()), { separateFrames: [], sameFrame: [30], hidden: [] });
    console.log("PASS marker audit: separate frames, same-frame snap, hidden pen");
  } finally { await auditContext.close(); }
  const alternatesOnly = process.argv.includes("--alternates-only");
  if (!alternatesOnly) {
    for (const name of ["door", "cheki", "tarot", "gift", "shift", "shark", "sketch", "dawn-sun", "dawn-cloud", "dawn-rain", "dawn-sick"]) await checkScene(name, desktop, "desktop");
    for (const name of ["door", "cheki", "tarot", "gift", "shift", "shark", "sketch", "dawn-rain"]) await checkScene(name, mobile, "mobile");
  }
  // 共通のペン・finish()を使う別案も確認（採用の変更はしない）。
  await checkScene("cheki", desktop, "alternate-a", "a");
  await checkScene("gift", desktop, "alternate-b", "b");
  await checkScene("cheki", desktop, "dropped-frames", null, true);
  for (const reduced of [false, true]) {
    const { page, context } = await open(desktop, reduced ? "reduced" : "skip", reduced ? "reduce" : "no-preference");
    try {
      const result = await page.evaluate(async (reduced) => {
        if (!reduced) document.body.classList.add("vn-skip");
        let mid = 0, placed = 0;
        await T.motions.chekiShot(T.data.cgUrl("cg_minto_first_cheki"), () => placed++);
        await T.motions.tarotFlip("tsumugi"); await T.motions.giftOpen("suyaki_tsumugi"); await T.motions.shiftClose();
        await T.motions.sharkSwim(() => mid++);
        await T.motions.sketchIn(() => mid++, T.data.bgUrl("bg_home", "day"));
        return { mid, placed, overlays: document.getElementById("fx").children.length, covering: T.transitions.isCovering() };
      }, reduced);
      assert.deepEqual(result, { mid: 2, placed: 0, overlays: 0, covering: false });
      console.log(`PASS ${reduced ? "reduced motion" : "skip"}`);
    } finally { await context.close(); }
  }
  // 途中で例外が出た場合もループと入力抑止を残さない。
  const { page, context } = await open(desktop, "exception");
  try {
    const result = await page.evaluate(async () => {
      const { stagePlay } = await import("./js/motions/stage.js"); let animation;
      try { await stagePlay("test", async (node) => {
        animation = node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 1000, iterations: Infinity });
        throw new Error("expected test failure");
      }, { cover: true }); } catch (e) { if (e.message !== "expected test failure") throw e; }
      return { state: animation.playState, covering: T.transitions.isCovering(), overlays: document.getElementById("fx").children.length };
    });
    assert.deepEqual(result, { state: "idle", covering: false, overlays: 0 });
    await page.keyboard.press("Enter"); assert.equal(await page.evaluate(() => audit.keys), 1);
    console.log("PASS exception cleanup");
  } finally { await context.close(); }
  assert.deepEqual(errors, []);
  console.log(`PASS motion endings: ${alternatesOnly ? 3 : 22} normal-speed scenes (including dropped frames), marker audit, skip/reduced motion, CG handoff and exception cleanup; browser errors 0`);
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
