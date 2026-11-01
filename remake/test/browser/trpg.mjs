import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const base = new URL("trpg-preview.html", process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/trpg");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];

async function hit(page, selector) {
  const locator = page.locator(selector);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await locator.tap();
  else await locator.click();
}
async function nextLines(page, keyboard = false) {
  for (let n = 0; n < 60; n++) {
    const next = page.locator('[data-test="trpg-next"]');
    if (!await next.isVisible()) return;
    if (keyboard) await page.keyboard.press("Enter"); else await hit(page, '[data-test="trpg-next"]');
  }
  throw new Error("Dialogue did not terminate");
}
// The declaration stage: a real table says who acts before any die is touched.
async function declare(page) {
  const card = page.locator('[data-test^="trpg-approach-"]').first();
  if (!await card.count() || !await card.isVisible()) return;
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await card.tap(); else await card.click();
  await nextLines(page);
}
async function checkRoll(page, { support = null, reroll = false } = {}) {
  await declare(page);
  if (support) await hit(page, '[data-test="trpg-support-' + support + '"]');
  await hit(page, '[data-test="trpg-roll"]');
  await page.locator('[data-test="trpg-settle"]').waitFor();
  if (reroll) await hit(page, '[data-test="trpg-reroll-0"]');
  await hit(page, '[data-test="trpg-settle"]');
  await nextLines(page);
}
async function begin(page, keyboard = false) {
  const start = page.locator('[data-test="trpg-start"]');
  if (keyboard) await start.press("Enter"); else await hit(page, '[data-test="trpg-start"]');
  if (keyboard) {
    const line = await page.locator(".trpg-speech p").textContent();
    await page.locator('[data-test="trpg-log"]').press("Enter");
    await page.locator('[data-test="trpg-log-close"]').waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-speech p").textContent(), line);
    await page.locator('[data-test="trpg-next"]').focus();
  }
  await nextLines(page, keyboard);
  await checkRoll(page);
  assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "explore");
  await fits(page);
}
async function explore(page, { spots = ["menu", "window", "bag"], hypothesis = "quiet" } = {}) {
  for (const id of spots) {
    await hit(page, '[data-test="trpg-spot-' + id + '"]');
    await nextLines(page);
  }
  await hit(page, '[data-test="trpg-consult-tsumugi"]');
  await nextLines(page);
  await hit(page, '[data-test="trpg-interpret"]');
  await hit(page, '[data-test="trpg-hypothesis-' + hypothesis + '"]');
  await nextLines(page);
}
async function finish(page, choices) {
  const fields = Object.keys(choices);
  for (const field of fields.slice(0, 2)) await hit(page, '[data-test="trpg-plan-' + field + '-' + choices[field] + '"]');
  await hit(page, '[data-test="trpg-prepare-open"]');
  await checkRoll(page, { support: choices.tool ? "hiyori" : "adam" });
  const last = fields[2];
  await hit(page, '[data-test="trpg-plan-' + last + '-' + choices[last] + '"]');
  await hit(page, '[data-test="trpg-serve-open"]');
  await checkRoll(page, { support: "tsumugi" });
}
async function fits(page) {
  const clips = await page.locator("button:not([hidden]), .trpg-speech p, .trpg-spot span, .trpg-object-label, .trpg-object-detail").evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return nodes.filter(n => n.offsetWidth && n.offsetHeight && n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).filter(n => {
      const r = n.getBoundingClientRect();
      return r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1
        || r.bottom > stage.bottom + 1 || !n.matches(".trpg-spot, .trpg-spot span, .trpg-object-choice, .trpg-object-label, .trpg-object-detail")
          && (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
    }).map(n => ({ text: n.textContent, width: n.clientWidth, scroll: n.scrollWidth }));
  });
  assert.deepEqual(clips, [], "Clipped controls or dialogue");
  const overlaps = await page.locator(".trpg-spot").evaluateAll(nodes => {
    const visible = nodes.filter(n => n.offsetWidth && n.offsetHeight);
    const result = [];
    for (let i = 0; i < visible.length; i++) for (let j = i + 1; j < visible.length; j++) {
      const a = visible[i].getBoundingClientRect(), b = visible[j].getBoundingClientRect();
      if (Math.min(a.right, b.right) > Math.max(a.left, b.left) && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top))
        result.push([visible[i].textContent, visible[j].textContent]);
    }
    return result;
  });
  assert.deepEqual(overlaps, [], "Investigation labels cover each other");
}
async function run(label, params, options, body, beforeLoad = null) {
  if (process.env.CASE_FILTER && label !== process.env.CASE_FILTER) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    set.call(localStorage, "suien_remake_save", '{"schema":11,"day":8,"sentinel":"existing-player"}');
    set.call(localStorage, "suien_remake_slot1", "manual-save-sentinel");
    set.call(sessionStorage, "unrelated-tab", "keep-me");
    window.__storageTouches = [];
    for (const key of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function(...args) { window.__storageTouches.push([key, ...args]); return original.apply(this, args); };
    }
    window.__originalStorageGet = get;
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  page.on("response", response => { if (response.status() >= 400) errors.push(response.status() + " " + response.url()); });
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    if (beforeLoad) await beforeLoad(page);
    await page.goto(url.href);
    if (label !== "loading-retry") await page.waitForFunction(() => window.__trpg?.ready === true);
    await body(page, errors);
    await fits(page);
    assert.deepEqual(errors, []);
    const storage = await page.evaluate(() => ({
      touches: __storageTouches,
      save: __originalStorageGet.call(localStorage, "suien_remake_save"),
      slot: __originalStorageGet.call(localStorage, "suien_remake_slot1"),
      other: __originalStorageGet.call(sessionStorage, "unrelated-tab"),
    }));
    assert.deepEqual(storage.touches, [], "The prototype accessed browser storage");
    assert.equal(storage.save, '{"schema":11,"day":8,"sentinel":"existing-player"}');
    assert.equal(storage.slot, "manual-save-sentinel");
    assert.equal(storage.other, "keep-me");
    await page.screenshot({ path: path.join(artifacts, label + ".png") });
    results.push({ label, status: "passed" });
    console.log("PASS " + label);
  } catch (error) {
    await page.screenshot({ path: path.join(artifacts, label + "-failed.png") }).catch(() => {});
    results.push({ label, status: "failed", error: error.stack, errors });
    console.error("FAIL " + label + "\n" + error.stack);
  } finally { await context.close(); }
}

try {
  await run("cover-pc", { seed: "9", traveler: "quiet" }, {}, async page => {
    await fits(page);
    await page.locator('[data-test="trpg-cover-help"]').click();
    await fits(page); await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-overlay").count(), 0);
  });
  await run("quiet-pc-keyboard", { seed: "9", traveler: "quiet" }, {}, async page => {
    await begin(page, true);
    await page.screenshot({ path: path.join(artifacts, "explore-pc.png") });
    await page.locator('[data-test="trpg-spot-notebook"]').press("Enter");
    await nextLines(page, true);
    await page.locator('[data-test="trpg-compare-notes"]').click();
    assert((await page.locator(".trpg-note-card").first().textContent()).includes("ノート"));
    await page.keyboard.press("Escape");
    await explore(page);
    await page.screenshot({ path: path.join(artifacts, "prepare-pc.png") });
    await finish(page, { aroma: "tea", seat: "window", approach: "quiet" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "雨音のある一台");
    await page.locator('[data-test="trpg-finish"]').click();
    await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
    await hit(page, '[data-test="trpg-select-ordinary-cup"]');
    await page.locator('[data-test="trpg-start"]').waitFor();
    assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 2);
  });
  await run("home-touch", { seed: "3", traveler: "home" },
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, async page => {
      await page.locator('[data-test="trpg-start"]').tap();
      await nextLines(page); await checkRoll(page);
      await explore(page); await finish(page, { aroma: "tea", seat: "shelf", approach: "memory" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "帰り道の一台");
    });
  await run("company-pc", { seed: "15", traveler: "company" }, {}, async page => {
    await begin(page); await explore(page);
    await finish(page, { aroma: "fruit", seat: "counter", approach: "company" });
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "話の始まる一台");
  });
  await run("discovery-small-touch", { seed: "12", traveler: "quiet" },
    { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true }, async page => {
      await begin(page); await explore(page);
      await finish(page, { aroma: "spice", seat: "counter", approach: "company" });
      assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), "一緒に見つけた一台");
    });
  await run("reroll-cancel-and-low-motion", { seed: "8", traveler: "quiet" },
    { reducedMotion: "reduce" }, async page => {
      await page.locator('[data-test="trpg-start"]').click();
      await nextLines(page);
      await checkRoll(page, { reroll: true });
      assert.equal((await page.evaluate(() => __trpg.snapshot())).teamwork, 1);
      await page.locator('[data-test="trpg-log"]').click();
      assert((await page.locator(".trpg-log-line").count()) > 5);
      await page.keyboard.press("Escape");
      await page.locator('[data-test="trpg-exit"]').click();
      await page.locator('[data-test="trpg-exit-confirm"]').click();
      await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
      assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "library");
    });
  await run("character-builder-pc", { seed: "9", traveler: "quiet" }, {}, async page => {
    assert.equal(await page.locator('[data-test="trpg-cover-pc-name"]').textContent(), "フィン");
    await hit(page, '[data-test="trpg-build"]');
    await page.locator('[data-test="trpg-builder"]').waitFor();
    await fits(page);
    await hit(page, '[data-test="trpg-look-rust"]'); await hit(page, '[data-test="trpg-archetype-sailor"]');
    assert.equal(await page.locator('[data-test="trpg-stat-nerve-down"]').count(), 0, "easy mode hides the point-buy");
    await hit(page, '[data-test="trpg-builder-advanced"]');
    await hit(page, '[data-test="trpg-stat-nerve-down"]'); await hit(page, '[data-test="trpg-stat-talk-up"]');
    assert.equal(await page.locator('[data-test="trpg-stat-points"]').getAttribute("data-left"), "0");
    assert(await page.locator('[data-test="trpg-stat-talk-up"]').isDisabled(), "spent points disable raising");
    await page.locator('[data-test="trpg-pc-name"]').fill("ソラ");
    await hit(page, '[data-test="trpg-build-confirm"]');
    assert.equal(await page.locator('[data-test="trpg-cover-pc-name"]').textContent(), "ソラ");
    const pc = (await page.evaluate(() => __trpg.snapshot())).pc;
    assert.deepEqual(pc, { name: "ソラ", title: "船乗り帰りの手伝い", look: "rust", archetype: "sailor", stats: { eye: 2, hand: 3, talk: 3, nerve: 3 } });
    // "Leave it to the dice" is reproducible from the model, and cancelling keeps the confirmed character.
    await hit(page, '[data-test="trpg-build"]'); await hit(page, '[data-test="trpg-build-random"]'); await hit(page, '[data-test="trpg-build-back"]');
    assert.deepEqual((await page.evaluate(() => __trpg.snapshot())).pc, pc);
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page);
    assert.match(await page.locator('[data-test="trpg-seat-pc-hajime"]').textContent(), /ソラ/);
    await hit(page, '[data-test="trpg-approach-listen_talk"]');
    assert.match(await page.locator(".trpg-speech p").textContent(), /^ソラは/);
    assert.equal(await page.locator(".trpg-root").evaluate(n => n.textContent.includes("{pc}")), false);
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-bonus"]').textContent(), "＋3", "the built talk stat is the roll's base");
    await fits(page);
  });
  await run("shopkeeper-tutorial-and-session-zero", { seed: "6", traveler: "quiet", tutorial: "1" }, {}, async page => {
    await page.locator('[data-test="trpg-tutorial-panel"]').waitFor();
    assert(!await page.locator('[data-test="trpg-start"]').isVisible(), "the cover waits for the shopkeeper");
    await fits(page);
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-tutorial-panel"]').count(), 0);
    await hit(page, '[data-test="trpg-start"]');
    const first = await page.locator(".trpg-speech p").textContent();
    assert.match(first, /キャラ作り/, "the GM opens session zero");
    await nextLines(page);
    assert.equal(await page.locator('[data-test="trpg-approach-best"]').count(), 1, "one approach carries the beginner's recommendation");
    await fits(page);
    await hit(page, '[data-test="trpg-approach-listen_talk"]');
    await nextLines(page);
    assert.equal(await page.locator(".trpg-root").evaluate(n => n.textContent.includes("{pc")), false);
  });
  await run("portrait-touch-hint", { seed: "1" },
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, async page => {
      assert(await page.locator("#trpg-rotate").isVisible());
      await page.setViewportSize({ width: 844, height: 390 });
      await page.locator("#trpg-rotate").waitFor({ state: "hidden" });
      await fits(page);
    });
  await run("double-input-and-integration-abort", { seed: "13", traveler: "quiet" }, {}, async page => {
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page); await declare(page);
    await page.locator('[data-test="trpg-roll"]').evaluate(node => { node.click(); node.click(); });
    await page.locator('[data-test="trpg-settle"]').waitFor();
    await page.locator('[data-test="trpg-settle"]').evaluate(node => { node.click(); node.click(); });
    await nextLines(page);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.length, 1);
    const cancelled = await page.evaluate(async () => {
      const { runTrpg } = await import("/remake/js/trpg/index.js");
      const fixture = document.createElement("div");
      fixture.style.cssText = "position:absolute;inset:0;z-index:200";
      document.getElementById("stage").append(fixture);
      const signal = new AbortController();
      const pending = runTrpg(fixture, { seed: 9, signal: signal.signal });
      signal.abort();
      const result = await pending;
      const children = fixture.children.length;
      fixture.remove();
      return { result, children };
    });
    assert.equal(cancelled.result.cancelled, true);
    assert.equal(cancelled.children, 0);
    assert.equal(await page.locator(".trpg-root").count(), 1);
  });
  await run("library-two-stories", {}, {}, async page => {
    assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "library");
    assert.equal(await page.locator(".trpg-library-book").count(), 2);
    await page.screenshot({ path: path.join(artifacts, "library-pc.png") });
    await hit(page, '[data-test="trpg-select-ordinary-cup"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).scenarioId, "ordinary-cup");
    await hit(page, '[data-test="trpg-exit"]');
    await page.locator('[data-test="trpg-select-shark-last-order"]').waitFor();
    await hit(page, '[data-test="trpg-select-shark-last-order"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).scenarioId, "shark-last-order");
    assert((await page.locator(".trpg-cover-person").first().textContent()).includes("サメちゃん"));
    await page.screenshot({ path: path.join(artifacts, "shark-cover.png") });
  });
  const movies = [
    { label: "shark-scent-pc", profile: "scent", choices: { tool: "citrus", route: "pier", finale: "lure" }, ending: "海へ贈るラストオーダー", seed: 9, options: {} },
    { label: "shark-vibration-touch", profile: "vibration", choices: { tool: "sealed", route: "roof", finale: "silence" }, ending: "世界一静かなエンドロール", seed: 14,
      options: { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } },
    { label: "shark-light-pc", profile: "light", choices: { tool: "beacon", route: "channel", finale: "signal" }, ending: "海上プレミア上映", seed: 4, options: {} },
    { label: "shark-sequel-small-touch", profile: "scent", choices: { tool: "beacon", route: "roof", finale: "silence" }, ending: "そして、翌朝の予告編", seed: 5,
      options: { viewport: { width: 667, height: 375 }, isMobile: true, hasTouch: true } },
  ];
  for (const movie of movies) await run(movie.label, { scenario: "shark-last-order", traveler: movie.profile, seed: movie.seed }, movie.options, async page => {
    await begin(page);
    for (const id of ["radio", "leaves", "fan", "lamp"]) {
      await hit(page, '[data-test="trpg-spot-' + id + '"]'); await nextLines(page);
    }
    assert(await page.locator('[data-test="trpg-spot-rope"]').isDisabled());
    const pressure = (await page.evaluate(() => __trpg.snapshot())).pressure;
    await hit(page, '[data-test="trpg-compare-notes"]');
    assert((await page.locator(".trpg-note-card").first().textContent()).includes("無線"));
    await hit(page, '[data-test="trpg-notes-close"]');
    await hit(page, '[data-test="trpg-consult-hiyori"]'); await nextLines(page);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).pressure, pressure);
    if (movie.label === "shark-scent-pc") await page.screenshot({ path: path.join(artifacts, "shark-explore-pc.png") });
    await hit(page, '[data-test="trpg-interpret"]');
    await hit(page, '[data-test="trpg-hypothesis-' + movie.profile + '"]'); await nextLines(page);
    await finish(page, movie.choices);
    assert.equal(await page.locator('[data-test="trpg-ending-title"]').textContent(), movie.ending);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks[1].hypothesisBonus, 4); // d20版の見立て補正
    await fits(page);
    if (movie.label === "shark-scent-pc") {
      await hit(page, '[data-test="trpg-replay"]');
      await page.locator('[data-test="trpg-start"]').waitFor();
      const reset = await page.evaluate(() => __trpg.snapshot());
      assert.equal(reset.phase, "cover"); assert.equal(reset.teamwork, 2); assert.equal(reset.pressure, 0);
    }
  });
  await run("audio-and-check-cancellation", { scenario: "shark-last-order", traveler: "light", seed: 3 }, {}, async page => {
    assert.equal((await page.evaluate(() => __trpg.audio())).state, "idle");
    await hit(page, '[data-test="trpg-audio"]');
    await page.waitForFunction(() => __trpg.audio().enabled && __trpg.audio().state === "running");
    await hit(page, '[data-test="trpg-start"]'); await nextLines(page);
    await hit(page, '[data-test="trpg-declare-back"]');
    assert.equal((await page.evaluate(() => __trpg.snapshot())).pending, null);
    assert.equal((await page.evaluate(() => __trpg.snapshot())).checks.length, 0);
    await hit(page, '[data-test="trpg-listen-open"]'); await checkRoll(page);
    await hit(page, '[data-test="trpg-audio"]');
    await page.waitForFunction(() => !__trpg.audio().enabled && __trpg.audio().state === "suspended");
    assert.equal((await page.evaluate(() => __trpg.audio())).ambience, 0);
    await hit(page, '[data-test="trpg-exit"]'); await hit(page, '[data-test="trpg-exit-confirm"]');
    await page.locator('[data-test="trpg-select-ordinary-cup"]').waitFor();
  });
  let rejectCatalog = true;
  await run("loading-retry", {}, {}, async (page, errors) => {
    await page.locator('[data-test="trpg-retry-load"]').waitFor();
    rejectCatalog = false;
    await hit(page, '[data-test="trpg-retry-load"]');
    await page.locator('[data-test="trpg-select-shark-last-order"]').waitFor();
    assert(errors.length > 0);
    assert(errors.every(error => /503|Resource unavailable/.test(error)), errors.join("\n"));
    errors.length = 0;
  }, page => page.route("**/data/trpg_catalog.json", route => rejectCatalog ? route.fulfill({ status: 503, body: "Temporary failure" }) : route.continue()));
  let rejectScene = true;
  await run("scene-retry-and-shark-api-abort", { scenario: "shark-last-order", seed: 4, traveler: "scent" }, {}, async (page, errors) => {
    await begin(page);
    await page.locator('[data-test="trpg-scene-retry"]').waitFor();
    rejectScene = false;
    await hit(page, '[data-test="trpg-scene-retry"]');
    await page.locator('[data-test="trpg-scene-retry"]').waitFor({ state: "hidden" });
    assert.equal((await page.evaluate(() => __trpg.snapshot())).phase, "explore");
    const aborted = await page.evaluate(async () => {
      const { runTrpg, loadTrpgResources } = await import("/remake/js/trpg/index.js");
      const resources = await loadTrpgResources({ scenarioId: "shark-last-order" });
      const host = document.createElement("div"), abort = new AbortController();
      document.getElementById("stage").append(host);
      const result = runTrpg(host, { resources, signal: abort.signal });
      const mounted = host.children.length; abort.abort();
      const cancelled = await result;
      const children = host.children.length; host.remove();
      return { mounted, cancelled, children };
    });
    assert.equal(aborted.mounted, 1); assert.equal(aborted.children, 0);
    assert.equal(aborted.cancelled.scenarioId, "shark-last-order"); assert(aborted.cancelled.cancelled);
    assert(errors.length > 0);
    assert(errors.every(error => /503/.test(error)), errors.join("\n")); errors.length = 0;
  }, page => page.route("**/trpg_shark_room.webp*", route => rejectScene ? route.fulfill({ status: 503, body: "Temporary failure" }) : route.continue()));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ results }, null, 2) + "\n");
}
assert(results.length > 0, "No TRPG browser cases were selected");
assert.equal(results.filter(r => r.status === "failed").length, 0, "TRPG browser cases failed");
