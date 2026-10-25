// #872 水入れミニゲーム（試遊ページ）：長押しで注ぐ・傾けてこぼす・判定は実水量だけ・PC/タッチ。
import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot } from "./support.mjs";

const entry = new URL("craft-preview.html?step=water", baseURL).href;
const view = page => page.evaluate(() => {
  const d = globalThis.__waterPourPreview.debug, root = document.querySelector('[data-test="water-pour"]');
  return { volume: d.volume, tilt: d.tilt, spilled: d.spilledArea, target: d.target, pour: root.dataset.pour, tiltOn: root.dataset.tilt };
});
async function holdMouse(page, selector, ms) {
  await page.locator(selector).hover();
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up();
}
async function setVolumeAtLine(page, offsetPx = 0) {
  await page.evaluate(async offsetPx => {
    const m = await import("./js/craft/water-pour.js");
    const d = globalThis.__waterPourPreview.debug;
    d.volume = m.volumeAtLevel(d.target + offsetPx);
  }, offsetPx);
}


// Actual document/canvas/events/native timers; sound callbacks are observations,
// not audible-output QA. No fake clock or manually invoked queued callbacks.
async function setupCancelMounts(page) {
  await page.evaluate(async () => {
    const { mountWaterPour } = await import("./js/craft/water-pour-view.js");
    const previous = globalThis.__waterPourPreview;
    previous.result.catch(() => {}); // Attach before cancelling the preview fixture.
    previous.cancel();
    const panel = previous.root.parentElement;
    previous.root.remove();
    const c = globalThis.__pourCancelCase = { panel, timers: [], oldMutations: 0 };
    const make = id => {
      const sounds = [], settled = [];
      const api = mountWaterPour(panel, { random: () => .5,
        sound: Object.fromEntries(["click", "pour", "perfect", "miss", "good", "select"].map(name => [name, () => sounds.push(name)])) });
      api.root.id = `pour-cancel-${id}`;
      api.result.then(value => settled.push({ kind: "resolve", grade: value.grade }),
        error => settled.push({ kind: "reject", name: error.name }));
      return { api, sounds, settled };
    };
    c.old = make("old");
    c.oldSnapshot = () => ({ connected: c.old.api.root.isConnected,
      html: c.old.api.root.outerHTML, sounds: [...c.old.sounds], settled: c.old.settled.map(x => ({ ...x })) });
    c.newSnapshot = () => ({ connected: c.new.api.root.isConnected,
      resultHTML: c.new.api.root.querySelector('[data-test="pour-result"]').outerHTML,
      grade: c.new.api.root.dataset.grade || null, sounds: [...c.new.sounds],
      settled: c.new.settled.map(x => ({ ...x })), volume: c.new.api.debug.volume });
    const nativeSetTimeout = window.setTimeout;
    c.restoreTimer = () => { window.setTimeout = nativeSetTimeout; };
    // Observe ONLY the two production wait/reveal boundaries. The native timer
    // still supplies its real ID, delay, queue and single callback execution.
    window.setTimeout = function (callback, delay, ...args) {
      if (typeof callback !== "function" || !["wait", "reveal"].includes(callback.name) || ![60, 900].includes(delay)) {
        return Reflect.apply(nativeSetTimeout, window, [callback, delay, ...args]);
      }
      const observation = { delay, fired: 0 };
      c.timers.push(observation);
      return Reflect.apply(nativeSetTimeout, window, [function (...values) {
        observation.fired++;
        return Reflect.apply(callback, window, values);
      }, delay, ...args]);
    };
    // Production click listener runs first; cancel in the SAME real input event
    // turn so a slow CI protocol round trip cannot miss the 60ms/900ms race.
    c.old.api.root.querySelector('[data-test="pour-decide"]').addEventListener("click", () => {
      c.atDecide = { tilt: c.old.api.debug.tilt, timers: c.timers.map(x => ({ ...x })) };
      c.old.api.cancel(); c.old.api.cancel();
      c.new = make("new"); // Exists before any former timer could become due.
      queueMicrotask(() => {
        c.cancelledAt = performance.now();
        c.before = c.oldSnapshot();
        c.newBefore = c.newSnapshot();
        c.observer = new MutationObserver(records => { c.oldMutations += records.length; });
        c.observer.observe(c.old.api.root, { attributes: true, childList: true, subtree: true, characterData: true });
      });
    }, { once: true });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function cancelAndRemount(page, { touch, waiting }) {
  const beforeStorage = await storageSnapshot(page);
  await setupCancelMounts(page);
  if (waiting === 60) {
    const button = page.locator('#pour-cancel-old [data-test="pour-tilt"]');
    let cdp;
    if (touch) {
      const box = await button.boundingBox();
      assert(box, "old tilt button exists");
      cdp = await page.context().newCDPSession(page);
      await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    } else { await button.hover(); await page.mouse.down(); }
    try { await page.waitForFunction(() => __pourCancelCase.old.api.debug.tilt > .7); }
    finally {
      if (touch) { await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await cdp.detach(); }
      else await page.mouse.up();
    }
  }
  const decide = page.locator('#pour-cancel-old [data-test="pour-decide"]');
  if (touch) await decide.tap(); else await decide.click();
  await page.waitForFunction(() => !!__pourCancelCase.before);
  const start = await page.evaluate(() => ({ before: __pourCancelCase.before,
    atDecide: __pourCancelCase.atDecide, newBefore: __pourCancelCase.newBefore,
    visibleOld: !__pourCancelCase.old.api.root.hidden && getComputedStyle(__pourCancelCase.old.api.root).display !== "none" }));
  assert.equal(start.visibleOld, true, "cancelled old root is kept, not hidden/removed");
  assert.equal(start.before.connected, true);
  assert.deepEqual(start.before.settled, [{ kind: "reject", name: "AbortError" }]);
  assert.deepEqual(start.atDecide.timers, [{ delay: waiting, fired: 0 }], "real decide reached the requested production timer boundary");
  if (waiting === 60) assert(start.atDecide.tilt > 0, "tilt still drains when decide starts its60ms wait");
  // Native real time, longer than900ms; no fake scheduler or clock advance.
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => {
    const c = __pourCancelCase;
    c.oldMutations += c.observer.takeRecords().length;
    c.restoreTimer();
    return { old: c.oldSnapshot(), fresh: c.newSnapshot(), mutations: c.oldMutations,
      timers: c.timers.map(x => ({ ...x })), elapsed: performance.now() - c.cancelledAt };
  });
  assert(after.elapsed >= 900, "former reveal deadline has passed on the real clock");
  assert.deepEqual(after.old, start.before, "cancelled root DOM/SFX/settlement stay unchanged");
  assert.equal(after.mutations, 0, "no late DOM writes on connected cancelled root");
  assert.deepEqual(after.timers, start.atDecide.timers, "cleared real timer neither fires nor reschedules");
  assert.deepEqual(after.fresh, start.newBefore, "former callback cannot affect the fresh mount");
  const normal = await page.evaluate(async () => {
    const c = __pourCancelCase;
    const math = await import("./js/craft/water-pour.js");
    c.new.api.debug.volume = math.volumeAtLevel(c.new.api.debug.target);
    c.new.api.decide();
    const result = await c.new.api.result;
    return { grade: result.grade, sounds: [...c.new.sounds], settled: c.new.settled.map(x => ({ ...x })),
      resultVisible: !c.new.api.root.querySelector('[data-test="pour-result"]').hidden,
      old: c.oldSnapshot() };
  });
  assert.equal(normal.grade, "perfect"); assert.equal(normal.resultVisible, true);
  assert.deepEqual(normal.sounds, ["perfect"], "fresh mount's own grade callback fires once");
  assert.deepEqual(normal.settled, [{ kind: "resolve", grade: "perfect" }]);
  assert.deepEqual(normal.old, start.before, "fresh success also leaves cancelled old root unchanged");
  await page.evaluate(() => { const c = __pourCancelCase; c.new.api.cancel(); c.old.api.cancel(); c.observer.disconnect(); c.restoreTimer(); });
  assert.deepEqual(await storageSnapshot(page), beforeStorage, "cancel/remount does not touch saves");
}

await suite("water_pour", async check => {
  for (const [device, touch, options] of [
    ["pc", false, { viewport: { width: 1280, height: 772 } }],
    ["touch", true, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }],
  ]) for (const waiting of [900, 60]) {
    await check(`${device}-cancel-${waiting}ms-and-remount`, page => cancelAndRemount(page, { touch, waiting }), options);
  }

  await check("pc-pour-and-spill", async page => {
    await page.waitForTimeout(300);
    const before = await storageSnapshot(page);
    assert.equal((await view(page)).volume, 0);
    await holdMouse(page, '[data-test="pour-hold"]', 1200);
    await page.waitForTimeout(700); // 落ちている途中の水まで入る
    const poured = await view(page);
    assert.ok(poured.volume > 15000, `pouring adds water (${poured.volume})`);
    assert.equal(poured.pour, "off");
    await page.waitForTimeout(500);
    assert.equal((await view(page)).volume, poured.volume, "water stops after release");

    // たっぷり入れてから倒すと、口からこぼれて卓に溜まる。
    await page.evaluate(() => { globalThis.__waterPourPreview.debug.volume = 300000; });
    await holdMouse(page, '[data-test="pour-tilt"]', 1800);
    const spilled = await view(page);
    assert.ok(spilled.spilled > 0 && spilled.volume < 300000, "tilting far enough spills water");
    assert.notEqual(await page.locator('[data-test="pour-spilled"]').textContent(), "0ml");
    await page.waitForTimeout(1200);
    assert.equal((await view(page)).tilt, 0, "bottle stands back up after release");
    assert.deepEqual(await storageSnapshot(page), before, "preview must not touch saves");
  }, { viewport: { width: 1280, height: 772 } });

  await check("judges-real-water-not-waves", async page => {
    await page.waitForTimeout(300);
    await setVolumeAtLine(page);
    // 少しだけ傾けて水面を大きく揺らす（こぼれない角度）。
    await holdMouse(page, '[data-test="pour-tilt"]', 250);
    assert.equal((await view(page)).spilled, 0);
    await page.locator('[data-test="pour-decide"]').click();
    await page.locator('[data-test="pour-result"]').waitFor({ state: "visible" });
    assert.match(await page.locator('[data-test="pour-result"]').innerText(), /EXCELLENT[\s\S]*±0\.0mm/);
    assert.equal(await page.locator('[data-test="pour-hold"]').isDisabled(), true);

    // 次の一本：空のボトルと新しい目安線。
    await page.locator('[data-test="pour-next"]').click();
    const fresh = await view(page);
    assert.equal(fresh.volume, 0);
    assert.equal(await page.locator('[data-test="pour-result"]').isVisible(), false);

    await setVolumeAtLine(page, -4 * 4.25 - 3); // 約4.7mm 多い
    await page.keyboard.press("Enter");
    await page.locator('[data-test="pour-result"]').waitFor({ state: "visible" });
    assert.match(await page.locator('[data-test="pour-result"]').innerText(), /GOOD[\s\S]*\+4\.\dmm/);
  }, { viewport: { width: 1280, height: 772 } });

  await check("keyboard-and-interruptions", async page => {
    await page.waitForTimeout(300);
    await page.keyboard.down("Space");
    await page.waitForTimeout(200);
    assert.equal((await view(page)).pour, "on");
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    assert.equal((await view(page)).pour, "off", "window blur stops pouring");
    await page.keyboard.up("Space");
    await page.waitForTimeout(700);
    const stopped = (await view(page)).volume;
    await page.waitForTimeout(400);
    assert.equal((await view(page)).volume, stopped, "no automatic restart");
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(200);
    assert.equal((await view(page)).tiltOn, "on");
    await page.keyboard.up("ArrowRight");
    assert.equal((await view(page)).tiltOn, "off");
  }, { viewport: { width: 1280, height: 772 } });

  await check("touch-landscape-fits", async page => {
    await page.waitForTimeout(300);
    const layout = await page.evaluate(() => {
      const stage = document.querySelector(".wpour-stage"), canvas = stage.querySelector("canvas");
      const side = document.querySelector(".wpour-info").getBoundingClientRect();
      const buttons = [...document.querySelectorAll(".wpour-actions .btn")].map(b => b.getBoundingClientRect());
      return {
        canvasFillsStage: Math.abs(canvas.clientWidth - stage.clientWidth) < 2 && Math.abs(canvas.clientHeight - stage.clientHeight) < 2,
        buttonsInside: buttons.every(b => b.left >= side.left - 1 && b.right <= side.right + 1 && b.bottom <= side.bottom + 1),
        smallest: Math.min(...buttons.map(b => b.height)),
      };
    });
    assert.ok(layout.canvasFillsStage, "canvas uses the stage even when the bench is scaled");
    assert.ok(layout.buttonsInside, "buttons stay inside the side card");
    const box = await page.locator('[data-test="pour-hold"]').boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    await page.waitForTimeout(900);
    assert.equal((await view(page)).pour, "on");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForTimeout(700);
    const after = await view(page);
    assert.equal(after.pour, "off");
    assert.ok(after.volume > 0, "touch hold pours");
  }, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
}, { entry, readySelector: '[data-test="pour-hold"]' });
