import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const baseline = JSON.parse(fs.readFileSync(new URL("../../../docs/qa/issue452-regular/baseline-scenes.json", import.meta.url)));
const REG = "ch1_salaryman_regular", LATER = "ch1_salaryman_change";
const KEYS = ["_salaryman_service_order", "_salaryman_service_water"];
const RESPONSES = ["……この前も、先に聞いてくれましたね。今日も、助かる",
  "……この前、水を先に置いてくれたでしょう。あれ、助かりました"];
const NEUTRAL = "（……何かあったのかな。聞かない方がいい気がする）";
const BG = "res://assets/backgrounds/bg_tonari_inside_night.png";
const artifact = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";

async function prepare(page) {
  await page.context().route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.abort());
  await page.evaluate(async () => {
    window.T = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), night: await import("./js/daily/night-events.js"),
      saves: await import("./js/scenes/saves.js") };
    T.ch1.setupHooks(); (await import("./js/core/ui.js")).clearScreen();
    T.fresh = () => {
      const s = T.core.newGame(); Object.assign(s, { day: 2, slot: 2, phase: "daily", seed: 452, weatherSeed: 452 });
      for (const id of ["sumi", "salaryman", "tsumugi"]) { s.met[id] = true; s.flags[`_intro_${id}`] = true; }
      T.vn.backlog().length = 0;
      return s;
    };
    T.lines = () => T.vn.backlog().map(l => l.text);
    T.game = () => { const s = structuredClone(T.core.state); delete s.savedAt; return s; };
    T.events = { 2: T.ch1.NIGHT_EVENTS[2], 10: T.ch1.NIGHT_EVENTS[10] };
  });
}
function response(lines, answer, seen = true) {
  const expected = seen ? answer : null;
  assert.equal(lines.includes(NEUTRAL), expected === null);
  RESPONSES.forEach((text, i) => assert.equal(lines.includes(text), expected === i));
  assert(lines.some(t => t.includes("今日は、ミント多めで")), "Original order was lost");
  assert(lines.includes("小さく笑って電話を切り、スマホをしまった。肩がほんの少しだけ下がっていた。"));
  assert(lines.includes("顔は描かないけど。座ってた時の手は、残したいです"));
}
async function input(locator, touch) { if (touch) await locator.tap(); else await locator.click(); }
async function start(page, scene, realNight = false) {
  await page.evaluate(({ scene, realNight, BG }) => {
    T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4; T.vn.backlog().length = 0; window.finished = false;
    const task = realNight ? T.ch1.NIGHT_EVENTS[2].run() : T.vn.play(scene, { bg: BG });
    task.then(() => { window.finished = true; });
  }, { scene, realNight, BG });
  await page.waitForFunction(() => T.vn.backlog().length > 0); await page.waitForTimeout(350);
}
async function finish(page, { touch, answer = 0, shot = null } = {}) {
  let clicks = 0, choices = 0;
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate(() => window.finished)) return { clicks, choices, lines: await page.evaluate(() => T.lines()) };
    const buttons = page.locator(".vn-choices button");
    if (await buttons.count()) {
      assert.deepEqual(await buttons.allTextContents(), ["注文を先に聞く", "水を出して少し待つ"]);
      await assertFits(page, ".vn-choices button");
      await input(buttons.nth(answer), touch); choices++; continue;
    }
    await page.waitForFunction(() => window.finished || document.querySelector(".vn-next.show") || document.querySelector(".vn-choices button"));
    if (await page.evaluate(() => window.finished) || await buttons.count()) continue;
    const before = await page.evaluate(() => ({ n: T.vn.backlog().length, text: document.querySelector(".vn-text").textContent }));
    if (shot && await page.evaluate(texts => texts.includes(T.lines().at(-1)), [...RESPONSES, NEUTRAL])) {
      await assertFits(page, ".vn-box, .vn-text");
      assert(await page.locator('img[data-speaker="salaryman"]').evaluate(im => im.complete && im.naturalWidth > 0));
      await page.screenshot({ path: `${artifact}/${shot}.jpg`, type: "jpeg", quality: 80 }); shot = null;
    }
    await input(page.locator(".vn-box"), touch); clicks++;
    await page.waitForFunction(before => window.finished || T.vn.backlog().length > before.n
      || document.querySelector(".vn-text").textContent !== before.text || document.querySelector(".vn-choices button"), before);
  }
  throw Error("Scene did not finish");
}
async function advanceUntil(page, target, touch) {
  for (let i = 0; i < 80; i++) {
    if (await page.evaluate(t => T.lines().at(-1) === t, target)) return;
    await page.locator(".vn-next.show").waitFor();
    const before = await page.evaluate(() => ({ n: T.vn.backlog().length, text: document.querySelector(".vn-text").textContent }));
    await input(page.locator(".vn-box"), touch);
    await page.waitForFunction(before => T.vn.backlog().length > before.n
      || document.querySelector(".vn-text").textContent !== before.text || window.finished, before);
    assert.equal(await page.evaluate(() => window.finished), false, `Ended before ${target}`);
  }
  throw Error(`Did not reach ${target}`);
}

await suite("regular-service-response", async check => {
  await check("both-answers-read-unread-legacy-and-full-state", async page => {
    await prepare(page);
    const rows = await page.evaluate(async ({ baseline, REG, LATER, KEYS, BG }) => {
      const out = []; T.vn.vnTest.turbo = true;
      for (const answer of [null, 0, 1]) for (const seen of [false, true]) for (const legacy of [false, true]) {
        const s = T.fresh(); T.vn.vnTest.choose = () => answer || 0;
        if (answer !== null) await T.vn.play(REG, { bg: BG });
        s.flags._ev_salaryman = seen; s.day = 10;
        if (legacy) s.schema = 13;
        T.core.saveToSlot("suien_remake_slot1"); T.core.newGame(); T.core.loadFromSlot("suien_remake_slot1");
        const initial = structuredClone(T.core.state);
        T.vn.backlog().length = 0; await T.vn.play(baseline.scenes[LATER]); const expected = T.game();
        T.core.setState(structuredClone(initial)); T.vn.backlog().length = 0;
        await T.vn.play(LATER); out.push({ answer, seen, legacy, expected, current: T.game(), lines: T.lines(),
          keys: KEYS.map(k => T.core.state.flags[k] ?? null) });
      }
      // DAY2 has no new gameplay effect beyond saving the two actual-answer flags.
      for (const answer of [0, 1]) {
        const initial = structuredClone(T.fresh());
        await T.vn.play(baseline.scenes[REG], { bg: BG }); const expected = T.game();
        T.core.setState(structuredClone(initial)); T.vn.vnTest.choose = () => answer;
        await T.vn.play(REG, { bg: BG }); const current = T.game();
        KEYS.forEach(k => delete current.flags[k]);
        if (JSON.stringify(current) !== JSON.stringify(expected)) throw Error("DAY2 gameplay state changed");
      }
      return out;
    }, { baseline, REG, LATER, KEYS, BG });
    for (const r of rows) {
      assert.deepEqual(r.current, r.expected, JSON.stringify([r.answer, r.seen, r.legacy]));
      assert.deepEqual(r.keys, r.answer === null ? [null, null] : [r.answer === 0, r.answer === 1]);
      response(r.lines, r.answer, r.seen);
    }
    console.log(`Full state/rewards equal in ${rows.length} later-scene paths and both DAY2 answers`);
  });

  await check("deferred-night-prerequisite-save-and-repeat", async page => {
    await prepare(page);
    const r = await page.evaluate(async () => {
      const s = T.fresh(); T.vn.vnTest.turbo = true; T.vn.vnTest.choose = () => 1;
      s.restDay = { chapter: 1, day: 2, fullDay: true };
      T.night.syncNightQueue(T.events); const held = await T.night.runNightPlan(T.events);
      const unread = !s.flags._ev_salaryman && !s.flags._salaryman_service_water;
      s.day = 3; s.restDay = null; T.night.syncNightQueue(T.events); await T.night.runNightPlan(T.events);
      T.core.save(); T.core.load(); T.core.state.day = 10; T.vn.backlog().length = 0;
      T.night.syncNightQueue(T.events); await T.night.runNightPlan(T.events);
      const lines = T.lines(), once = T.game(); T.vn.backlog().length = 0;
      const again = await T.night.runNightPlan(T.events);
      return { held, unread, lines, once, twice: T.game(), again, repeated: T.lines() };
    });
    assert.equal(r.held, 0); assert(r.unread); response(r.lines, 1);
    assert(r.once.flags._ev_salaryman && r.once.flags._ev_salaryman_change);
    assert.deepEqual(r.twice, r.once); assert.equal(r.again, 0); assert.deepEqual(r.repeated, []);
  });

  for (const [label, options, touch] of [["pc", {}, false],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true]]) {
    await check(`${label}-auto-stops-at-service-and-reads-later-response`, async page => {
      await prepare(page); await page.evaluate(() => { T.fresh(); });
      await start(page, REG, true);
      await advanceUntil(page, "いつものサラリーマンが、いつもの席に座る。襟元に指を入れて、無言でメニューを指差した。", touch);
      await input(page.locator('[data-test="vn-auto"]'), touch);
      const choices = page.locator('.vn-choices button');
      await choices.first().waitFor({ timeout: 20000 }); await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => window.finished), false);
      assert.deepEqual(await choices.allTextContents(), ["注文を先に聞く", "水を出して少し待つ"]);
      assert.deepEqual(await page.evaluate(keys => keys.map(k => T.core.state.flags[k] ?? null), KEYS), [null, null]);
      const answer = touch ? 0 : 1;
      await input(choices.nth(answer), touch);
      const reply = answer === 0 ? "ダブルアップルにミント少し、ですね"
        : "先に水を置くと、サラリーマンは一口飲んでから、小さく頷いた。";
      await page.waitForFunction(text => T.lines().includes(text), reply);
      await input(page.locator('[data-test="vn-auto"]'), touch);
      await input(page.locator('[data-test="vn-skip"]'), touch);
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      assert.deepEqual(await page.evaluate(keys => keys.map(k => T.core.state.flags[k]), KEYS), [answer === 0, answer === 1]);
      await page.evaluate(() => { T.core.state.day = 10; });
      await start(page, LATER);
      await advanceUntil(page, "スマホの画面を伏せて置いて、煙を長く、深く吐く。吸っている間、肩の力は抜けなかった。", touch);
      await input(page.locator('[data-test="vn-auto"]'), touch);
      await page.waitForFunction(text => T.lines().includes(text), RESPONSES[answer], { timeout: 20000 });
      await assertFits(page, ".vn-box, .vn-text");
      await input(page.locator('[data-test="vn-auto"]'), touch);
      await input(page.locator('[data-test="vn-skip"]'), touch);
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      response(await page.evaluate(() => T.lines()), answer);
    }, options);
    for (const answer of [null, 0, 1]) await check(`${label}-${answer ?? "legacy"}-clicks-save-load-skip`, async page => {
      await prepare(page); const counts = {};
      for (const version of ["baseline", "current"]) {
        await page.evaluate(() => { T.fresh(); localStorage.removeItem("suien_remake_slot1"); });
        let first = { clicks: 0, choices: 0 };
        if (answer !== null) {
          await start(page, version === "baseline" ? baseline.scenes[REG] : REG, version === "current");
          first = await finish(page, { touch, answer });
        }
        await page.evaluate(() => { T.core.state.flags._ev_salaryman = true; T.core.state.day = 10; });
        if (version === "current") {
          await page.evaluate(() => { window.saved = T.saves.saveFlow(); });
          await input(page.locator('[data-test="slot-1"]'), touch); assert(await page.evaluate(() => window.saved));
          await page.reload(); await page.locator('[data-test="vn-fixture-ready"]').waitFor(); await prepare(page);
          await page.evaluate(() => { window.loaded = T.saves.loadFlow(); });
          await input(page.locator('[data-test="slot-1"]'), touch);
          await page.evaluate(async () => { T.core.loadFromSlot(await window.loaded); });
        }
        await start(page, version === "baseline" ? baseline.scenes[LATER] : LATER);
        const later = await finish(page, { touch, answer, shot: version === "current" ? `${label}-${answer ?? "legacy"}` : null });
        if (version === "current") response(later.lines, answer);
        counts[version] = { first: first.clicks, choices: first.choices, later: later.clicks };
      }
      // The new mouthpiece explanation adds one line to the current first visit.
      assert.equal(counts.current.first, counts.baseline.first + (answer === null ? 0 : 1));
      assert.equal(counts.current.choices, answer === null ? 0 : 1);
      assert.equal(counts.baseline.choices, 0); assert.equal(counts.current.later, counts.baseline.later);
      console.log(`${label}/${answer ?? "legacy"} clicks ${JSON.stringify(counts)}`);
      await page.evaluate(() => { T.fresh(); });
      if (answer !== null) {
        await start(page, REG, true); await input(page.locator('[data-test="vn-skip"]'), touch);
        await page.locator('.vn-choices button').first().waitFor(); await page.waitForTimeout(200);
        assert.deepEqual(await page.evaluate(keys => keys.map(k => T.core.state.flags[k] ?? null), KEYS), [null, null]);
        await input(page.locator('.vn-choices button').nth(answer), touch);
        const immediate = await page.evaluate(keys => ({ read: !!T.core.peekSave().flags._ev_salaryman,
          keys: keys.map(k => T.core.peekSave().flags[k]) }), KEYS);
        assert(!immediate.read); assert.deepEqual(immediate.keys, [answer === 0, answer === 1]);
        await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      } else await page.evaluate(() => { T.core.state.flags._ev_salaryman = true; });
      await start(page, LATER); await input(page.locator('[data-test="vn-skip"]'), touch);
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      response(await page.evaluate(() => T.lines()), answer);
    }, options);
  }
}, {
  entry: process.env.BASE_URL?.endsWith(".html") ? process.env.BASE_URL
    : new URL("test/browser/fixtures/regular_service.html", process.env.BASE_URL || "http://127.0.0.1:8123/remake/").href,
  readySelector: '[data-test="vn-fixture-ready"]',
});
