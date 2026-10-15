import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const base = new URL("trpg-preview.html", process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
const artifacts = path.resolve(process.env.ARTIFACT_DIR || ".codex/artifacts/trpg-experience");
const group = process.env.TRPG_EXPERIENCE_GROUP || "";
assert(["", "ordinary", "shark"].includes(group), "Choose the ordinary or shark experience group");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [];
let sharkForecast = null;

const control = (page, test) => page.locator(`[data-test="${test}"]`);
const state = page => page.evaluate(() => window.__trpg.snapshot());
async function hit(page, test) {
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control(page, test).tap();
  else await control(page, test).click();
}
async function dialogue(page) {
  for (let n = 0; n < 60; n++) {
    if (!await control(page, "trpg-next").isVisible()) return;
    await hit(page, "trpg-next");
  }
  throw new Error("Dialogue did not terminate");
}
async function fits(page) {
  const clipped = await page.locator("button:not([hidden]), .trpg-speech p").evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return nodes.filter(n => n.offsetWidth && n.offsetHeight).filter(n => {
      const r = n.getBoundingClientRect();
      return r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1
        || r.bottom > stage.bottom + 1 || n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1;
    }).map(n => ({ text: n.textContent, width: n.clientWidth, scroll: n.scrollWidth }));
  });
  assert.deepEqual(clipped, [], "Controls and dialogue fit the stage");
  const blocked = await page.locator(".trpg-side > button:not(:disabled)").evaluateAll(nodes => {
    if (document.querySelector(".trpg-overlay")) return [];
    return nodes.filter(n => n.offsetWidth && n.offsetHeight).filter(n => {
      const r = n.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !top || !n.contains(top);
    }).map(n => n.textContent);
  });
  assert.deepEqual(blocked, [], "The conversation dock cannot cover the current action");
}
async function currentStep(page) {
  assert.equal(await page.locator('nav.trpg-journey[aria-label="物語の進行"] [aria-current="step"]').count(), 1);
}
async function forecast(page, supported = false, conditional = false) {
  const odds = await control(page, "trpg-odds-success").textContent();
  const expected = conditional ? (supported ? /58.*72/ : /28.*42/) : (supported ? /58/ : /28/);
  assert.match(odds, expected, "Success odds reflect support and conditional insight");
  for (const grade of ["success", "mixed", "trouble"]) {
    const range = (await control(page, "trpg-odds-" + grade).textContent()).match(/(\d+)[〜～](\d+)/);
    if (range) assert(Number(range[1]) <= Number(range[2]), "Conditional probabilities use an ascending range");
  }
  assert.match(await control(page, "trpg-bonus").textContent(), supported ? /[+＋]\s*3/ : /[+＋]\s*1/);
  assert.match(await control(page, "trpg-forecast").textContent(), /10/);
  await fits(page);
}
async function roll(page, { trap = false } = {}) {
  await hit(page, "trpg-roll");
  if (trap) {
    await page.keyboard.press("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".trpg-overlay")),
      "Tab stays inside the modal while all rolling controls are disabled");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".trpg-overlay").count(), 1, "A committed roll cannot be dismissed");
  }
  await control(page, "trpg-settle").waitFor();
  const announcement = page.locator('.trpg-dice-total[role="status"]');
  assert.equal(await announcement.count(), 1, "The settled total and grade are announced");
  assert.match(await announcement.textContent(), /合計/);
  await fits(page);
}
async function settle(page) {
  await hit(page, "trpg-settle");
  await dialogue(page);
}
async function begin(page, { keyboard = false } = {}) {
  if (keyboard) {
    await control(page, "trpg-start").press("Enter");
    const before = await page.locator(".trpg-speech p").textContent();
    await page.keyboard.down("Enter");
    const once = await page.locator(".trpg-speech p").textContent();
    await page.keyboard.down("Enter");
    const repeated = await page.locator(".trpg-speech p").textContent();
    await page.keyboard.up("Enter");
    assert.notEqual(once, before, "One Enter press advances the dialogue");
    assert.equal(repeated, once, "Holding Enter does not skip another dialogue line");
  } else await hit(page, "trpg-start");
  await currentStep(page);
  await dialogue(page);
  await forecast(page);
  await roll(page, { trap: keyboard });
  await settle(page);
  assert.equal((await state(page)).phase, "explore");
  await currentStep(page);
}
async function inspect(page, id, { focus = false } = {}) {
  await hit(page, "trpg-spot-" + id);
  await dialogue(page);
  if (focus) assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "trpg-spot-" + id,
    "Reading an investigation restores focus to its spot");
}
async function compare(page, count, screenshot = null) {
  await hit(page, "trpg-compare-notes");
  assert.equal(await page.locator(".trpg-note-card").count(), count, "Every discovered clue can be compared");
  assert(await page.evaluate(() => !!document.activeElement.closest(".trpg-overlay")));
  const modalButtons = page.locator(".trpg-overlay button:not(:disabled)");
  await modalButtons.first().focus();
  await page.keyboard.press("Shift+Tab");
  assert(await page.evaluate(() => !!document.activeElement.closest(".trpg-overlay")), "Reverse Tab stays in the modal");
  await modalButtons.last().focus();
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => !!document.activeElement.closest(".trpg-overlay")), "Tab wraps inside the modal");
  await modalButtons.last().focus();
  for (let repeat = 0; repeat < 10; repeat++) {
    await page.keyboard.down("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest(".trpg-overlay")),
      "Holding Tab never escapes the modal");
  }
  await page.keyboard.up("Tab");
  if (screenshot) await page.screenshot({ path: path.join(artifacts, screenshot + ".png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".trpg-overlay").count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "trpg-compare-notes",
    "Escape restores focus to the comparison button");
}
async function choosePlan(page, fields) {
  for (const [field, value] of Object.entries(fields)) await hit(page, `trpg-plan-${field}-${value}`);
  await fits(page);
}
async function ordinary(page, keyboard) {
  await begin(page, { keyboard });
  const budget = await control(page, "trpg-investigation").textContent();
  assert.match(budget, /3/);
  assert.match(budget, /残り|あと/);
  assert.match(budget, /時間制限なし/);
  assert(await control(page, "trpg-interpret").isDisabled());
  for (const id of ["menu", "window", "bag"]) await inspect(page, id, { focus: keyboard });
  assert(await control(page, "trpg-interpret").isEnabled());
  await compare(page, 3, keyboard ? "ordinary-memo-comparison" : null);
  await hit(page, "trpg-interpret");
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-hypothesis-pc.png") });
  await hit(page, "trpg-hypothesis-quiet");
  await dialogue(page);
  await currentStep(page);
  await compare(page, 3);
  await choosePlan(page, { aroma: "tea", seat: "window" });
  const summary = await control(page, "trpg-plan-summary").textContent();
  assert.match(summary, /穏やかな紅茶/);
  assert.match(summary, /雨を眺める窓辺/);
  await page.screenshot({ path: path.join(artifacts, keyboard ? "ordinary-plan-pc.png" : "ordinary-plan-touch.png") });
  await hit(page, "trpg-prepare-open");
  await forecast(page);
  await control(page, "trpg-support-adam").focus();
  await page.keyboard.press("Space");
  assert(await control(page, "trpg-support-adam").isChecked(), "Space still operates the support checkbox");
  await forecast(page, true);
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-supported-forecast-pc.png") });
  await roll(page);
  await settle(page);
  await currentStep(page);
  await compare(page, 3);
  await choosePlan(page, { approach: "quiet" });
  assert.match(await control(page, "trpg-plan-summary").textContent(), /声を添えて/);
  await hit(page, "trpg-serve-open");
  await roll(page);
  await settle(page);
  assert.equal((await state(page)).phase, "ending");
  assert.equal(await control(page, "trpg-ending-title").textContent(), "雨音のある一台");
  await hit(page, "trpg-recap");
  assert.equal(await page.locator(".trpg-recap-check").count(), 3);
  const recap = await page.locator(".trpg-modal-body").textContent();
  assert.match(recap, /穏やかな紅茶/);
  assert.match(recap, /目を止めた紅茶/);
  await page.screenshot({ path: path.join(artifacts, keyboard ? "ordinary-recap-pc.png" : "ordinary-recap-touch.png") });
  const readable = page.locator('.trpg-modal-body[role="region"][tabindex="0"]');
  assert.equal(await readable.count(), 1, "The recap offers a focusable reading region");
  assert.match(await readable.getAttribute("aria-label"), /内容/);
  if (await readable.evaluate(n => n.scrollHeight > n.clientHeight + 1)) {
    await readable.focus();
    await page.keyboard.press("End");
    await page.waitForFunction(() => document.querySelector(".trpg-modal-body").scrollTop > 0);
    assert(await readable.evaluate(n => n.scrollTop > 0), "Keyboard readers can scroll to the rest of the recap");
  }
  await page.keyboard.press("Escape");
  assert.equal((await state(page)).checks.length, 3);
  await fits(page);
}
async function shark(page, correct) {
  await begin(page);
  assert.match(await control(page, "trpg-investigation").textContent(), /危機/);
  for (const id of ["radio", "leaves", "fan", "lamp"]) await inspect(page, id);
  const collected = await state(page);
  assert.equal(collected.clues.length, 4);
  assert(await control(page, "trpg-spot-rope").isDisabled(), "The fourth investigation spends the remaining budget");
  await inspect(page, "radio");
  assert.equal((await state(page)).pressure, collected.pressure, "Rereading a clue spends no pressure");
  await compare(page, 4);
  await page.screenshot({ path: path.join(artifacts, correct ? "shark-exploration-pc.png" : "shark-exploration-alternate.png") });
  await hit(page, "trpg-interpret");
  await hit(page, "trpg-hypothesis-scent");
  await dialogue(page);
  await choosePlan(page, { tool: "citrus", route: "pier" });
  await hit(page, "trpg-prepare-open");
  await forecast(page, false, true);
  const preview = (await control(page, "trpg-forecast").textContent()).replace(/\s+/g, " ").trim();
  if (correct) sharkForecast = preview;
  else assert.equal(preview, sharkForecast, "The forecast cannot reveal whether the chosen hypothesis matches the hidden profile");
  await hit(page, "trpg-support-hiyori");
  await forecast(page, true, true);
  await roll(page);
  assert.equal((await state(page)).pending.bonus, correct ? 4 : 3,
    "The actual insight bonus is applied only when its hypothesis matches");
  await settle(page);
  if (correct) {
    await choosePlan(page, { finale: "lure" });
    await hit(page, "trpg-serve-open");
    await roll(page);
    await settle(page);
    assert.equal((await state(page)).phase, "ending");
    await hit(page, "trpg-recap");
    assert.equal(await page.locator(".trpg-recap-check").count(), 3);
    await page.keyboard.press("Escape");
  }
  await fits(page);
}
async function run(label, params, options, body) {
  if (group && !label.startsWith(group)) return;
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
  await context.addInitScript(() => {
    const get = Storage.prototype.getItem;
    localStorage.setItem("suien_remake_save", '{"sentinel":"existing-save"}');
    localStorage.setItem("suien_remake_slot1", "existing-manual-save");
    sessionStorage.setItem("trpg-experience-sentinel", "existing-session");
    window.__storageTouches = [];
    window.__originalStorageGet = get;
    for (const key of ["getItem", "setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[key];
      Storage.prototype[key] = function(...args) { window.__storageTouches.push([key, ...args]); return original.apply(this, args); };
    }
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  try {
    await page.goto(url.href);
    await page.waitForFunction(() => window.__trpg?.ready === true);
    await body(page);
    assert.deepEqual(errors, []);
    const storage = await page.evaluate(() => ({ touches: window.__storageTouches,
      save: window.__originalStorageGet.call(localStorage, "suien_remake_save"),
      manual: window.__originalStorageGet.call(localStorage, "suien_remake_slot1"),
      session: window.__originalStorageGet.call(sessionStorage, "trpg-experience-sentinel") }));
    assert.deepEqual(storage, { touches: [], save: '{"sentinel":"existing-save"}', manual: "existing-manual-save", session: "existing-session" });
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
  await run("ordinary-keyboard-pc", { seed: "9", traveler: "quiet" }, {}, page => ordinary(page, true));
  await run("ordinary-touch-reduced-motion", { seed: "9", traveler: "quiet" }, {
    viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: "reduce",
  }, page => ordinary(page, false));
  await run("shark-insight-correct", { scenario: "shark-last-order", seed: "9", traveler: "scent" }, {}, page => shark(page, true));
  await run("shark-insight-hidden", { scenario: "shark-last-order", seed: "9", traveler: "vibration" }, {}, page => shark(page, false));
} finally {
  await browser.close();
  fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify(results, null, 2) + "\n");
}
assert.equal(results.filter(r => r.status === "failed").length, 0, "TRPG experience browser cases failed");
