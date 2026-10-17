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
  const clipped = await page.locator("button:not([hidden]), summary[data-test], .trpg-speech p, .trpg-spot span, .trpg-object-label, .trpg-object-detail").evaluateAll(nodes => {
    const stage = document.getElementById("stage").getBoundingClientRect();
    return nodes.filter(n => n.offsetWidth && n.offsetHeight
      && n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).filter(n => {
      const r = n.getBoundingClientRect();
      return r.left < stage.left - 1 || r.right > stage.right + 1 || r.top < stage.top - 1
        || r.bottom > stage.bottom + 1 || !n.matches(".trpg-spot, .trpg-spot span, .trpg-object-choice, .trpg-object-label, .trpg-object-detail")
          && (n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1);
    }).map(n => ({ text: n.textContent, width: n.clientWidth, scroll: n.scrollWidth }));
  });
  assert.deepEqual(clipped, [], "Controls and dialogue fit the stage");
  const blocked = await page.locator("button[data-test]:not(:disabled), summary[data-test]").evaluateAll(nodes => {
    const dialog = document.querySelector('[role="dialog"]');
    return nodes.filter(n => (!dialog || dialog.contains(n)) && n.offsetWidth && n.offsetHeight
      && n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).filter(n => {
      // Notebook contents may scroll. Only test controls whose center is inside their scroll viewport.
      const r = n.getBoundingClientRect(), top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      for (let parent = n.parentElement; parent; parent = parent.parentElement) {
        const style = getComputedStyle(parent), box = parent.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX + style.overflowY)
          && (r.x + r.width / 2 < box.left || r.x + r.width / 2 > box.right
            || r.y + r.height / 2 < box.top || r.y + r.height / 2 > box.bottom)) return false;
      }
      return !top || !n.contains(top);
    }).map(n => n.textContent);
  });
  assert.deepEqual(blocked, [], "Scenery, portraits and labels cannot cover the current controls");
}
async function currentStep(page) {
  assert.equal(await page.locator('nav.trpg-journey[aria-label="物語の進行"] [aria-current="step"]').count(), 1);
  assert(await page.locator("nav.trpg-journey").evaluate(n => {
    const style = getComputedStyle(n), r = n.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden"
      && (r.width <= 2 && r.height <= 2 || style.clipPath !== "none" || style.clip !== "auto");
  }), "Progress remains available to screen readers without a visible navigation bar");
}
async function cinematicScene(page) {
  assert.equal(await page.locator(".trpg-root.trpg-cinematic").count(), 1);
  assert.equal(await page.locator(".trpg-side").count(), 0, "A permanent sidebar does not cover the scene");
  const room = await page.locator(".trpg-room").boundingBox(), root = await page.locator(".trpg-root").boundingBox();
  for (const edge of ["x", "y", "width", "height"]) assert(Math.abs(room[edge] - root[edge]) < 2,
    "The illustrated room fills the stage");
  assert(!await page.locator(".trpg-dock").evaluate(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })),
    "Idle exploration and choices do not retain a dialogue window");
  await fits(page);
}
async function closedDetails(page) {
  assert.equal(await page.locator('[role="dialog"].trpg-roll-stage').count(), 1);
  const details = control(page, "trpg-roll-details");
  assert(await details.evaluate(n => n.tagName === "DETAILS" && !n.open), "Roll details start folded");
  assert(!await control(page, "trpg-forecast").isVisible(), "Probabilities do not crowd the initial roll view");
  assert(await control(page, "trpg-details-toggle").isVisible(), "Players can open the roll information when needed");
}
async function forecast(page, supported = false, conditional = false) {
  if (!await control(page, "trpg-roll-details").evaluate(n => n.open)) await hit(page, "trpg-details-toggle");
  assert(await control(page, "trpg-forecast").isVisible(), "Opening the details reveals the probability forecast");
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
    assert(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')),
      "Tab stays inside the modal while all rolling controls are disabled");
    await page.keyboard.press("Escape");
    assert.equal(await page.locator('[role="dialog"]').count(), 1, "A committed roll cannot be dismissed");
  }
  await control(page, "trpg-settle").waitFor();
  const announcement = page.locator('.trpg-dice-total[role="status"]');
  assert.equal(await announcement.count(), 1, "The settled total and grade are announced");
  assert.match(await announcement.textContent(), /合計/);
  const pending = (await state(page)).pending;
  assert.equal(await page.locator(".trpg-roll-equation").textContent(), `${pending.dice[0]} ＋ ${pending.dice[1]} ＋ 補正${pending.bonus} ＝`);
  assert.equal(await announcement.locator("strong").textContent(), "合計 " + (pending.dice[0] + pending.dice[1] + pending.bonus));
  assert.match(await page.locator(".trpg-roll-context").textContent(), new RegExp("連携札 " + (await state(page)).teamwork + "/2"));
  const reduced = await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  assert.equal(await page.locator(".trpg-roll-fx").count(), reduced ? 0 : 1);
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
  assert(await page.locator(".trpg-dock").evaluate(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })),
    "Conversation appears as subtitles while a character speaks");
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-conversation-pc.png") });
  await currentStep(page);
  await dialogue(page);
  await closedDetails(page);
  await forecast(page);
  if (keyboard) {
    await hit(page, "trpg-details-toggle");
    assert(!await control(page, "trpg-forecast").isVisible(), "The forecast can be folded away again");
    await hit(page, "trpg-details-toggle");
  }
  await roll(page, { trap: keyboard });
  await settle(page);
  assert.equal((await state(page)).phase, "explore");
  await currentStep(page);
  await cinematicScene(page);
}
async function inspect(page, id, { focus = false } = {}) {
  await hit(page, "trpg-spot-" + id);
  await dialogue(page);
  if (focus) assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "trpg-spot-" + id,
    "Reading an investigation restores focus to its spot");
  assert(!await page.locator(".trpg-dock").evaluate(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })),
    "The scene is clear again after the clue conversation");
}
async function hotspots(page, keyboard) {
  if (keyboard) {
    await page.mouse.move(2, 2);
    await page.locator(".trpg-root").focus();
    await page.waitForFunction(() => {
      const label = document.querySelector('[data-test="trpg-spot-menu"] span'), style = getComputedStyle(label);
      return !label.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        || Number(style.opacity) < .05;
    });
    await page.keyboard.press("Tab");
    await control(page, "trpg-spot-menu").focus();
    await page.waitForFunction(() => {
      const label = document.querySelector('[data-test="trpg-spot-menu"] span');
      return label.checkVisibility({ opacityProperty: true, visibilityProperty: true })
        && Number(getComputedStyle(label).opacity) > .95;
    });
    assert.match(await control(page, "trpg-spot-menu").getAttribute("aria-label"), /メニュー/);
  }
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) {
    const tooSmall = await page.locator(".trpg-spot").evaluateAll(nodes => nodes.filter(n => {
      const r = n.getBoundingClientRect(); return r.width < 43.5 || r.height < 43.5;
    }).map(n => n.getAttribute("aria-label")));
    assert.deepEqual(tooSmall, [], "Hotspots retain a 44 px touch target after stage scaling");
  }
}
async function compare(page, count, screenshot = null) {
  assert(await page.locator('.trpg-stage-pockets [data-test="trpg-compare-notes"]').isEnabled());
  await hit(page, "trpg-compare-notes");
  assert.equal(await page.locator(".trpg-note-card").count(), count, "Every discovered clue can be compared");
  assert(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')));
  const modalButtons = page.locator('[role="dialog"] button:not(:disabled)');
  await modalButtons.first().focus();
  await page.keyboard.press("Shift+Tab");
  assert(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), "Reverse Tab stays in the modal");
  await modalButtons.last().focus();
  await page.keyboard.press("Tab");
  assert(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), "Tab wraps inside the modal");
  await modalButtons.last().focus();
  for (let repeat = 0; repeat < 10; repeat++) {
    await page.keyboard.down("Tab");
    assert(await page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')),
      "Holding Tab never escapes the modal");
  }
  await page.keyboard.up("Tab");
  if (screenshot) await page.screenshot({ path: path.join(artifacts, screenshot + ".png") });
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('[role="dialog"]').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.dataset.test), "trpg-compare-notes",
    "Escape restores focus to the comparison button");
}
async function choiceGroup(page, field) {
  const cards = page.locator(".trpg-choice-cards button.trpg-object-choice:visible");
  assert.equal(await cards.count(), 3, "Only the current group of three illustrated choices is shown");
  const tests = await cards.evaluateAll(nodes => nodes.map(n => n.dataset.test));
  assert(tests.every(test => test.startsWith("trpg-plan-" + field + "-")), "The choice group follows the active preparation step");
  await page.waitForFunction(() => [...document.querySelectorAll(".trpg-choice-cards button.trpg-object-choice")]
    .filter(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })).every(card =>
      [card, ...card.querySelectorAll("*")].some(n => n.tagName === "IMG" ? n.complete && n.naturalWidth > 0
        : getComputedStyle(n).backgroundImage.includes("url("))));
  await choiceArtwork(page);
  await cinematicScene(page);
}
async function choiceArtwork(page) {
  await page.evaluate(async () => {
    const urls = new Set([...document.querySelectorAll(".trpg-object-choice, .trpg-object-choice *")]
      .flatMap(n => [...getComputedStyle(n).backgroundImage.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map(match => match[1])));
    await Promise.all([...urls].map(src => { const image = new Image(); image.src = src; return image.decode(); }));
  });
}
async function choiceDetails(page) {
  await page.mouse.move(2, 2);
  await page.locator(".trpg-root").focus();
  await page.waitForFunction(() => [...document.querySelectorAll(".trpg-object-detail")]
    .every(n => !n.checkVisibility({ opacityProperty: true, visibilityProperty: true })));
  await page.keyboard.press("Tab");
  const card = page.locator(".trpg-object-choice:visible").first();
  await card.focus();
  await page.waitForFunction(() => [...document.querySelectorAll(".trpg-object-detail")]
    .filter(n => n.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      && Number(getComputedStyle(n).opacity) > .95).length === 1);
  assert((await card.getAttribute("aria-label")).includes(await card.locator(".trpg-object-detail").textContent()),
    "The focused illustrated choice exposes its description visually and accessibly");
  await fits(page);
}
async function choosePlan(page, fields) {
  for (const [field, value] of Object.entries(fields)) {
    await choiceGroup(page, field);
    await hit(page, `trpg-plan-${field}-${value}`);
  }
  await fits(page);
}
async function ordinary(page, keyboard) {
  await begin(page, { keyboard });
  const budget = await control(page, "trpg-investigation").textContent();
  assert.match(budget, /手がかり\s*0\s*\/\s*3/);
  await hotspots(page, keyboard);
  await compare(page, 0);
  assert.equal(await control(page, "trpg-interpret").count(), 0, "The next action appears when three clues have been discovered");
  await page.screenshot({ path: path.join(artifacts, keyboard ? "ordinary-exploration-pc.png" : "ordinary-exploration-touch.png") });
  for (const id of ["menu", "window", "bag"]) await inspect(page, id, { focus: keyboard });
  assert(await control(page, "trpg-interpret").isEnabled());
  await page.keyboard.press("Tab");
  await control(page, "trpg-spot-counter").focus();
  await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('[data-test="trpg-spot-counter"] span')).opacity) > .95);
  assert(await page.evaluate(() => {
    const action = document.querySelector('[data-test="trpg-interpret"]').getBoundingClientRect();
    return [...document.querySelectorAll(".trpg-spot, [data-test='trpg-spot-counter'] span")].every(n => {
      const r = n.getBoundingClientRect();
      return Math.min(action.right, r.right) <= Math.max(action.left, r.left)
        || Math.min(action.bottom, r.bottom) <= Math.max(action.top, r.top);
    });
  }), "The unlocked action cannot cover a hotspot or its focused label");
  await compare(page, 3, keyboard ? "ordinary-memo-comparison" : null);
  await hit(page, "trpg-interpret");
  await choiceArtwork(page);
  await fits(page);
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-hypothesis-pc.png") });
  await hit(page, "trpg-hypothesis-quiet");
  await dialogue(page);
  await currentStep(page);
  await compare(page, 3);
  await choiceGroup(page, "aroma");
  if (keyboard) await choiceDetails(page);
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-aroma-choice-pc.png") });
  if (keyboard) {
    await control(page, "trpg-plan-aroma-tea").focus();
    await page.keyboard.down("Enter");
    assert.equal((await state(page)).plan.aroma, "tea");
    await page.keyboard.down("Enter");
    assert.equal((await state(page)).plan.seat, null, "Holding Enter cannot choose the next group automatically");
    await page.keyboard.up("Enter");
    await choosePlan(page, { seat: "window" });
  } else await choosePlan(page, { aroma: "tea", seat: "window" });
  await hit(page, "trpg-choice-tab-aroma");
  await choiceGroup(page, "aroma");
  assert.equal(await control(page, "trpg-plan-aroma-tea").getAttribute("aria-pressed"), "true",
    "Returning to an earlier choice retains its selection");
  assert.equal((await state(page)).plan.seat, "window", "Returning to the aroma keeps the seat selection");
  await hit(page, "trpg-choice-tab-seat");
  await choiceGroup(page, "seat");
  assert.equal(await control(page, "trpg-plan-seat-window").getAttribute("aria-pressed"), "true");
  const summary = await control(page, "trpg-plan-summary").textContent();
  assert.match(summary, /穏やかな紅茶/);
  assert.match(summary, /雨を眺める窓辺/);
  await page.screenshot({ path: path.join(artifacts, keyboard ? "ordinary-plan-pc.png" : "ordinary-plan-touch.png") });
  await hit(page, "trpg-prepare-open");
  await closedDetails(page);
  const aid = await control(page, "trpg-support-adam").evaluate(n => n.closest("label")?.textContent || n.getAttribute("aria-label"));
  assert.match(aid, /[+＋]\s*2/);
  assert.match(aid, /札\s*1/);
  assert(await control(page, "trpg-support-adam").isEnabled(), "Support remains usable without opening the probability details");
  if (keyboard) await page.screenshot({ path: path.join(artifacts, "ordinary-roll-stage-pc.png") });
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
  await closedDetails(page);
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
  const budget = await control(page, "trpg-investigation").textContent();
  assert.match(budget, /0\s*\/\s*3/);
  assert.match(budget, /調査.*4.*箇所/);
  assert.match(budget, /危機[+＋]\s*1/);
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
  await closedDetails(page);
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
    await closedDetails(page);
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
