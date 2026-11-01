// #514: isolated chapter-two city slice, using the production VN engine and real inputs.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits, baseURL, storageSnapshot } from "./support.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const evidence = path.join(root, "docs/qa/ch2-preview");
const route = new URL("chapter2-preview.html", baseURL).href;
const test = name => `[data-test="ch2-preview-${name}"]`;
const pins = ["ageha", "kumicho", "rei", "c_station"];
const names = { ageha: "あげは", kumicho: "神崎竜二", rei: "零", volk: "ヴォルク" };
fs.mkdirSync(evidence, { recursive: true });

async function seedAndOpen(page, prepare = null) {
  // Seed all save channels in the main game first. The preview must not load or write them.
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const state = core.newGame();
    Object.assign(state, { chapter: 1, day: 9, money: 54321 });
    state.flags._ch2_preview_qa_sentinel = "main-progress-must-survive";
    state.stats.technique = 37;
    core.save();
    for (let i = 1; i <= 3; i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ chapter: 1, day: i + 2, marker: `manual-slot-${i}` }));
    localStorage.setItem("suien_remake_config", JSON.stringify({ bgmVolume: 0, seVolume: 0, textSpeed: 4, voiceBlip: false, marker: "settings-must-survive" }));
    localStorage.setItem("unrelated-game-storage", "preserve");
    sessionStorage.setItem("suien_remake_boot_load", "1");
    sessionStorage.setItem("unrelated-session-storage", "preserve");
  });
  const before = await storageSnapshot(page);
  // Instrument the prototype before any preview code runs, catching even transient writes.
  await page.addInitScript(() => {
    window.__previewStorageWrites = [];
    for (const method of ["setItem", "removeItem", "clear"]) {
      const original = Storage.prototype[method];
      Storage.prototype[method] = function (...args) {
        window.__previewStorageWrites.push({ storage: this === localStorage ? "local" : "session", method, args });
        return original.apply(this, args);
      };
    }
  });
  if (prepare) await prepare();
  await page.goto(route, { waitUntil: "load" });
  if (!prepare) await page.locator(test("start")).waitFor();
  return before;
}

async function preserved(page, before) {
  assert.deepEqual(await storageSnapshot(page), before, "The preview changed the main save, three manual slots, settings or boot session");
  assert.deepEqual(await page.evaluate(() => window.__previewStorageWrites), [], "The preview wrote storage transiently even though its final contents match");
}

async function turbo(page, value = true) {
  await page.evaluate(value => { window.__ch2Preview.vnTest.turbo = value; }, value);
}

async function launch(page, fast = true) {
  await page.locator(test("start")).waitFor();
  await turbo(page, fast);
  await page.locator(test("start")).click();
  if (fast) await page.locator(test("map")).waitFor();
}

async function progress(page) {
  return page.evaluate(() => window.__ch2Preview.visited);
}

async function visit(page, id, { double = false, touch = false, inside = false } = {}) {
  const button = page.locator(test(`pin-${id}`));
  if (double) await button.dblclick({ delay: 30 });
  else if (touch) await button.tap();
  else await button.click();
  await page.waitForFunction(id => window.__ch2Preview.visited.includes(id), id);
  if (id !== "c_station") {
    await page.locator(test("stop")).waitFor();
    await assertFits(page, `${test("inside")}, ${test("back-map")}`);
    const logo = page.locator(`[data-store-logo="ch2_${id}"] img`);
    assert.equal(await logo.evaluate(async img => { await img.decode(); return img.naturalWidth; }), 768);
    await assertFits(page, `[data-store-logo="ch2_${id}"]`);
    await screenshot(page, `${touch ? 'touch' : 'desktop'}-logo-${id}.png`);
    const next = page.locator(test(inside ? "inside" : "back-map"));
    if (touch) await next.tap(); else await next.click();
  }
  await page.locator(test("map")).waitFor();
}

async function mapLayout(page) {
  // The pin's decorative tail intentionally overflows its button. Test text nodes and
  // button rectangles separately so decoration cannot hide real text clipping.
  await page.locator(`${test("map")}[data-phase="ready"]`).waitFor();
  await assertFits(page, [".ch2-pin-title", ".ch2-pin-caption", ".ch2-pin-num", test("day"), test("night"), test("progress")].join(","));
  const textContained = await page.locator(".ch2-pin").evaluateAll(nodes => nodes.map(node => {
    const outer = node.getBoundingClientRect();
    return { name: node.textContent, contained: [...node.children].every(child => {
      const r = child.getBoundingClientRect();
      return r.left >= outer.left - 1 && r.right <= outer.right + 1 && r.top >= outer.top - 1 && r.bottom <= outer.bottom + 1;
    }) };
  }));
  for (const pin of textContained) assert(pin.contained, `Map pin text escaped its frame: ${JSON.stringify(pin)}`);
  const rectangles = await page.locator(pins.map(id => test(`pin-${id}`)).concat([test("station")]).join(",")).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { id: node.dataset.test, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }));
  for (let i = 0; i < rectangles.length; i++) for (let j = i + 1; j < rectangles.length; j++) {
    const a = rectangles[i], b = rectangles[j];
    const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    assert(overlap < 1, `Map destinations overlap: ${JSON.stringify({ a, b, overlap })}`);
  }
  for (const r of rectangles) assert(r.width >= 24 && r.height >= 24, `Map destination is too small for touch: ${JSON.stringify(r)}`);
}

async function screenshot(page, filename) {
  if (/map-|end|logo-/.test(filename)) {
    await page.waitForFunction(() => !document.querySelector('#vn.active') && Number(getComputedStyle(document.getElementById('vn')).opacity) < .02);
  }
  await page.screenshot({ path: path.join(evidence, filename) });
}

async function changeTime(page, time, touch = false) {
  const control = page.locator(test(time));
  if (touch) await control.tap(); else await control.click();
  await page.locator(`${test('map')}[data-time="${time}"][data-phase="ready"]`).waitFor();
  await page.waitForFunction(() => document.getElementById('screen').getAttribute('aria-busy') === 'false');
  assert.equal(await page.locator(test(time)).getAttribute('aria-pressed'), 'true');
  assert(await page.locator('#bg > .bg-img').last().evaluate((node, time) => node.style.backgroundImage.includes(`map_${time}.webp`), time));
}

// Real dialogue clicks, with no SKIP/turbo. Capture name and text after each render.
async function manualToMap(page, { watch = null, captureUnknown = null, inside = false, captureRoom = null } = {}) {
  const observed = [];
  for (let i = 0; i < 100; i++) {
    if (await page.locator(test("map")).isVisible()) {
      assert.equal(captureRoom, null, 'Room portrait capture was never reached');
      return observed;
    }
    if (await page.locator(test("stop")).isVisible()) {
      await assertFits(page, `${test("inside")}, ${test("back-map")}`);
      await page.locator(test(inside ? "inside" : "back-map")).click();
      await page.locator(test("stop")).waitFor({ state: "detached" });
      inside = false;
      continue;
    }
    const intro = page.locator(".cutin");
    if (await intro.count()) {
      observed.push(await page.evaluate(watch => ({ name: document.querySelector(".cutin .ci-name")?.textContent || "", title: document.querySelector(".cutin .ci-title")?.textContent || "", text: "character introduction", met: watch ? !!window.__ch2Preview.state.met[watch] : null }), watch));
      await intro.waitFor({ state: "detached", timeout: 10000 });
      continue;
    }
    const box = page.locator("#vn.active .vn-box");
    await box.waitFor();
    await page.waitForTimeout(360);
    const frame = await page.evaluate(watch => ({
      name: document.querySelector(".vn-name")?.textContent || "",
      text: document.querySelector(".vn-text")?.textContent || "",
      met: watch ? !!window.__ch2Preview.state.met[watch] : null,
      textFits: (() => { const node = document.querySelector(".vn-text"); return !node || (node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1); })(),
    }), watch);
    assert(frame.textFits, `Production VN text was clipped: ${JSON.stringify(frame)}`);
    if (!observed.some(old => old.name === frame.name && old.text === frame.text && old.met === frame.met)) observed.push(frame);
    if (captureUnknown && frame.name === "？？？") { await screenshot(page, captureUnknown); captureUnknown = null; }
    if (captureRoom && await page.evaluate(async id => {
      const { ROOMS } = await import("./js/chapters/ch2-city-data.js");
      const portrait = document.querySelector(`.vn-portraits img[data-speaker="${id}"].active`);
      return document.querySelector('#bg > .bg-img:last-child')?.style.backgroundImage.includes(ROOMS[id].split("/").at(-1)) && portrait?.complete && portrait.naturalWidth > 0;
    }, watch)) {
      const portrait = await page.locator(`.vn-portraits img[data-speaker="${watch}"].active`).evaluate(node => ({ src: node.getAttribute("src"), width: node.naturalWidth, height: node.naturalHeight }));
      if (watch !== "ageha") assert(portrait.src.endsWith(`/chr_${watch}_normal.webp`), `Wrong normal portrait: ${JSON.stringify(portrait)}`);
      // A portrait can arrive before its entrance animation finishes and before
      // the new text replaces the preceding narration. Capture settled dialogue.
      await page.waitForTimeout(1200);
      assert((await page.locator('.vn-text').textContent()).trim(), 'Room evidence captured an empty dialogue box');
      await screenshot(page, captureRoom);
      captureRoom = null;
    }
    await box.click({ position: { x: 100, y: 40 } });
  }
  throw new Error(`Manual dialogue never returned to the map: ${JSON.stringify(observed)}`);
}

await suite("ch2-preview", async check => {
  const run = check;
  check = (...args) => !process.env.TEST_CASES || args[0].includes(process.env.TEST_CASES) ? run(...args) : Promise.resolve();
  await check("desktop-arbitrary-order-full-run", async page => {
    const before = await seedAndOpen(page);
    await assertFits(page, test("start"));
    const scope = await page.locator("#screen").textContent();
    assert.match(scope, /試遊/);
    assert.match(scope, /セーブ/);
    assert.match(scope, /未収録|未接続/);
    await screenshot(page, "desktop-entry.png");
    await launch(page);
    assert.equal(await page.evaluate(() => window.__ch2Preview.state.chapter), 2);
    assert.equal(await page.evaluate(() => window.__ch2Preview.state.flags._ch2_preview_qa_sentinel), undefined, "Preview loaded main-game progress");
    assert.deepEqual(await progress(page), []);
    await mapLayout(page);
    await screenshot(page, "desktop-map-day.png");
    await changeTime(page, "night");
    await mapLayout(page);
    await screenshot(page, "desktop-map-night.png");
    await changeTime(page, "day");
    for (const id of ["ageha", "c_station", "rei", "kumicho"]) await visit(page, id, { double: id === "ageha" });
    assert.deepEqual(await progress(page), ["ageha", "c_station", "rei", "kumicho"]);
    await page.locator(test("station")).dblclick({ delay: 30 });
    await page.locator(test("end")).waitFor();
    assert.match(await page.locator(test("end")).textContent(), /4|全|歩/);
    await screenshot(page, "desktop-end.png");
    await preserved(page, before);
    await page.locator(test("restart")).click();
    await page.locator(test("start")).waitFor();
    assert.deepEqual(await progress(page), []);
    await launch(page);
    assert.deepEqual(await progress(page), []);
    await preserved(page, before);
  });

  await check("touch-arbitrary-order-replay-and-return", async page => {
    const before = await seedAndOpen(page);
    await page.locator(test("start")).waitFor();
    await turbo(page);
    await page.locator(test("start")).tap();
    await page.locator(test("map")).waitFor();
    await mapLayout(page);
    await screenshot(page, "touch-map-day.png");
    for (const id of ["rei", "c_station", "kumicho", "ageha"]) {
      await visit(page, id, { touch: true, inside: id !== "c_station" });
      if (id !== "c_station") assert.equal(await page.evaluate(id => !!window.__ch2Preview.state.flags[`_ch2_city_inside_${id}`], id), true);
    }
    await visit(page, "rei", { touch: true });
    assert.deepEqual(await progress(page), ["rei", "c_station", "kumicho", "ageha"], "Revisiting counted the same destination twice");
    await changeTime(page, "night", true);
    await screenshot(page, "touch-map-night.png");
    await page.locator(test("station")).tap();
    await page.locator(test("end")).waitFor();
    await assertFits(page, test("restart"));
    await preserved(page, before);
    await page.reload();
    await page.locator(test("start")).waitFor();
    assert.deepEqual(await progress(page), []);
    await preserved(page, before);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("real-click-arrival-and-name-release", async page => {
    const before = await seedAndOpen(page);
    await launch(page, false);
    const arrival = await manualToMap(page);
    assert(arrival.some(frame => frame.text), "Arrival dialogue was empty");
    for (const id of ["ageha", "rei", "kumicho"]) {
      assert.equal(await page.evaluate(id => !!window.__ch2Preview.state.met[id], id), false);
      await page.locator(test(`pin-${id}`)).click();
      const frames = await manualToMap(page, { watch: id, captureUnknown: id === "ageha" ? "desktop-unknown-name.png" : null, inside: true, captureRoom: `desktop-room-${id}.png` });
      const unknown = frames.findIndex(frame => frame.name === "？？？" && !frame.met);
      const known = frames.findIndex(frame => frame.name.includes(names[id]) && frame.met);
      assert(unknown >= 0 && known > unknown, `${id} name appeared before introduction or did not unlock: ${JSON.stringify(frames)}`);
      assert.equal(await page.evaluate(id => !!window.__ch2Preview.state.flags[`_ch2_city_inside_${id}`], id), true);
      assert(fs.existsSync(path.join(evidence, `desktop-room-${id}.png`)), `Room portrait was not displayed: ${id}`);
      if (id === 'kumicho') assert(!frames.some(frame => /組長/.test(frame.title || '')), 'Kanzaki introduction must leave his identity ambiguous');
      if (id === 'ageha') assert(frames.some(frame => frame.text.includes('うちも！')), 'Ageha must remain a chapter-two tournament rival');
    }
    await turbo(page);
    await page.locator(test("station")).click();
    await page.locator(test("end")).waitFor();
    await preserved(page, before);
  });

  await check("partial-safe-ending-and-reset", async page => {
    const before = await seedAndOpen(page);
    await launch(page);
    await visit(page, "c_station");
    await page.locator(test("station")).click();
    await page.locator(test("end")).waitFor();
    assert.deepEqual(await progress(page), ["c_station"]);
    await page.locator(test("restart")).dblclick({ delay: 30 });
    await page.locator(test("start")).waitFor();
    assert.deepEqual(await progress(page), []);
    await preserved(page, before);
  });

  await check("room-image-recovery-and-night-return", async page => {
    const before = await seedAndOpen(page, () => page.route('**/bg_ch2_ageha_entry.webp', route => route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid room image' })));
    await launch(page);
    await changeTime(page, 'night');
    await page.locator(test('pin-ageha')).click();
    await page.locator(test('stop')).waitFor();
    await page.locator(test('inside')).click();
    await page.locator('.ch2-room-warning').waitFor();
    assert.equal(await page.evaluate(() => !!window.__ch2Preview.state.flags._ch2_city_inside_ageha), false);
    assert.equal(await page.locator('#vn.active').count(), 0, 'Failed room image must not start room dialogue');
    await page.locator(test('back-map')).click();
    await page.locator(`${test('map')}[data-time="night"]`).waitFor();
    await page.locator(test('pin-ageha')).click();
    await page.locator(test('stop')).waitFor();
    await page.locator(test('inside')).click();
    await page.locator('.ch2-room-warning').waitFor();
    await page.unroute('**/bg_ch2_ageha_entry.webp');
    await page.locator(test('inside')).click();
    await page.locator(`${test('map')}[data-time="night"]`).waitFor();
    assert.equal(await page.evaluate(() => !!window.__ch2Preview.state.flags._ch2_city_inside_ageha), true);
    assert(await page.locator('#bg > .bg-img').last().evaluate(node => node.style.backgroundImage.includes('map_night.webp')));
    assert.deepEqual(await progress(page), ['ageha']);
    await preserved(page, before);
  });

  await check("data-failure-retry", async page => {
    const before = await seedAndOpen(page);
    await page.route("**/data/dialogue/ch2_city.json", route => route.fulfill({ status: 200, contentType: "application/json", body: "{ malformed" }));
    // Reload after installing the fault, exercising the actual initial loader.
    await page.reload();
    await page.locator(test("retry")).waitFor();
    await assertFits(page, test("retry"));
    await page.unroute("**/data/dialogue/ch2_city.json");
    await page.locator(test("retry")).click();
    await launch(page);
    await page.locator(test("station")).click();
    await page.locator(test("end")).waitFor();
    await preserved(page, before);
  });

  await check("map-image-failure-retry", async page => {
    const before = await seedAndOpen(page, () => page.route("**/bg_widehanga_map_day.webp", route => route.fulfill({ status: 200, contentType: "image/webp", body: "not a decodable image" })));
    await launch(page);
    await page.locator(test("retry-map")).waitFor();
    await assertFits(page, test("retry-map"));
    await page.unroute("**/bg_widehanga_map_day.webp");
    await page.locator(test("retry-map")).click();
    await page.locator(test("retry-map")).waitFor({ state: "detached" });
    await mapLayout(page);
    await changeTime(page, "night");
    await page.locator(test("station")).click();
    await page.locator(test("end")).waitFor();
    await preserved(page, before);
  });

  await check("return-remembers-only-completed-visits", async page => {
    const before = await seedAndOpen(page);
    const people = { ageha: 'あげはさん', kumicho: '神崎さん', rei: 'REIさん', volk: 'ヴォルクさん' };
    for (const itinerary of [[], ['c_station'], ['ageha']]) {
      await launch(page);
      for (const id of itinerary) await visit(page, id);
      await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().splice(0));
      await page.locator(test('station')).click();
      await page.locator(test('end')).waitFor();
      const text = await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().map(line => line.text).join('\n'));
      for (const [id, name] of Object.entries(people)) assert.equal(text.includes(name), itinerary.includes(id), `Unvisited person appeared in return: ${text}`);
      assert.equal(text.includes('会場、分かりました'), itinerary.includes('c_station'));
      assert.equal(text.includes('入口で挨拶した'), itinerary.some(id => id !== 'c_station'));
      await preserved(page, before);
      await page.locator(test('restart')).click();
      await page.locator(test('start')).waitFor();
    }
  });

  await check("station-image-failure-keeps-arrival-playable", async page => {
    const before = await seedAndOpen(page, () => page.route('**/bg_widehanga_station_day.webp', route => route.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid image' })));
    await launch(page);
    await visit(page, 'c_station');
    await page.locator(test('station')).click();
    await page.locator(test('end')).waitFor();
    await preserved(page, before);
  });

  await check("interrupted-dialogue-and-history-reset", async page => {
    const before = await seedAndOpen(page);
    await launch(page);
    await turbo(page, false);
    await page.locator(test('pin-ageha')).click();
    await page.locator('#vn.active .vn-box').waitFor();
    await page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide'));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.locator(test('start')).waitFor();
    await page.waitForTimeout(300);
    assert.deepEqual(await progress(page), []);
    assert.equal(await page.evaluate(() => !!window.__ch2Preview.state.met.ageha), false);
    assert.equal(await page.locator('#vn.active').count(), 0);
    await launch(page);
    assert.deepEqual(await progress(page), []);
    await page.locator(test('pin-ageha')).click();
    await page.locator(test('stop')).waitFor();
    await turbo(page, false);
    await page.locator(test('inside')).click();
    await page.locator('#vn.active .vn-box').waitFor();
    await page.evaluate(() => {
      dispatchEvent(new PageTransitionEvent('pagehide'));
      dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
    });
    await page.locator(test('start')).waitFor();
    assert.deepEqual(await progress(page), []);
    assert.equal(await page.evaluate(() => !!window.__ch2Preview.state.flags._ch2_city_inside_ageha), false);
    assert.equal(await page.locator('#vn.active').count(), 0);
    await preserved(page, before);
  });
});
