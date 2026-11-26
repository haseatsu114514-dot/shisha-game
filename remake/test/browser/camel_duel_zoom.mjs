import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const voice = '[data-test="camel-voice"]';
const whip = '[data-test="camel-signal"]';
const touch = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };

async function launch(page) {
  await page.evaluate(async () => {
    const { runCamelRace } = await import("./js/minigames/camel-race.js");
    const gaps = {
      open: [-25, -32, -42],
      close: [-1, -18, -28],
      hysteresis: [-3.8, -18, -28],
      playerCluster: [.45, -.9, -1.2],
      opponentCluster: [2.1, 1.55, 1.45],
      mergedCluster: [-1.7, -2.1, .4],
      finish: [-1, -18, -28],
    };
    const control = window.__duelTest = { layout: "open", cue: false, race: null };
    const pilot = race => {
      if (control.race !== race) {
        control.race = race;
        race.player.distance = 300;
        race.cues = [];
      }
      // Set the relative positions while keeping the player's movement and normal race controls.
      if (control.layout === "finish") race.player.distance = race.length - .05;
      race.rivals.forEach((rival, i) => {
        rival.distance = race.player.distance + gaps[control.layout][i];
      });
      if (control.cue) {
        race.cues.push({ at: race.t + .12, lead: .9, state: "pending", presses: 0 });
        control.cue = false;
      }
      return { whip: race.player.whipHeld };
    };
    void runCamelRace({ host: document.getElementById("stage"), tutorial: false, seed: 4, pilot });
  });
  await page.waitForFunction(() => window.__camelRace?.fx.t >= 3.15);
}

const camera = page => page.evaluate(() => window.__camelRace.fx.duelCamera);
const changeLayout = (page, layout) => page.evaluate(layout => { window.__duelTest.layout = layout; }, layout);
const waitForPair = (page, id) => page.waitForFunction(id => window.__camelRace.fx.duelCamera.pair?.includes(id), id);

async function transition(page, layout, seconds) {
  return page.evaluate(({ layout, seconds }) => new Promise((resolve, reject) => {
    const startTime = window.__camelRace.fx.t;
    const deadline = performance.now() + 10000;
    const frames = [];
    function sample(now) {
      const { duelCamera, t } = window.__camelRace.fx;
      frames.push({ ...duelCamera, t });
      if (t - startTime >= seconds) resolve(frames);
      else if (now >= deadline) reject(new Error(`Race did not advance with the ${layout} gaps`));
      else requestAnimationFrame(sample);
    }
    sample(performance.now());
    window.__duelTest.layout = layout;
  }), { layout, seconds });
}

async function observeRenderedScale(page) {
  await page.evaluate(() => {
    // Read the transform while the race camera is active for a world draw.
    const { drawImage } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.drawImage = function (image, ...args) {
      if (this.canvas.classList.contains("camel-canvas") && image.src?.endsWith("/bg_dubai_camel_track_morning.webp")) {
        window.__duelRenderedScale = this.getTransform().a;
      }
      return drawImage.call(this, image, ...args);
    };
  });
}

const renderedScale = page => page.evaluate(() => window.__duelRenderedScale);

function assertSmooth(frames, from, to) {
  const lower = Math.min(from, to);
  const upper = Math.max(from, to);
  const intermediate = frames.filter(({ scale }) => scale > lower + .015 && scale < upper - .015);
  assert(intermediate.length >= 2, `camera should show intermediate scales from ${from} to ${to}`);
  assert(intermediate.every(({ scale }, i) => !i || (scale - intermediate[i - 1].scale) * (to - from) >= 0),
    "the zoom should ease consistently in the direction of travel");
}

async function assertTouchLayout(page) {
  const boxes = await page.evaluate(selectors => selectors.map(selector => {
    const box = document.querySelector(selector).getBoundingClientRect();
    const { left, right, top, bottom, width, height } = box;
    return { selector, left, right, top, bottom, width, height };
  }), [voice, whip, ".camel-pacing", ".camel-progress", ".camel-standings"]);
  for (const box of boxes) {
    assert(box.width > 0 && box.height > 0, `${box.selector} remains visible during zoom`);
    assert(box.left >= 0 && box.top >= 0 && box.right <= 845 && box.bottom <= 391,
      `${box.selector} fits the landscape viewport`);
  }
}

await suite("camel-duel-zoom", async check => {
  await check("desktop-zoom-follows-the-leading-pair", async page => {
    await observeRenderedScale(page);
    await launch(page);
    const initial = await camera(page);
    assert.equal(initial.pair, null);
    assert.equal(initial.scale, 1);
    assert.equal(await renderedScale(page), 1);

    const brief = await transition(page, "close", .15);
    assert(brief.every(({ pair, scale }) => !pair && scale === 1), "a brief gap closure must not zoom");
    const reset = await transition(page, "open", .25);
    assert(reset.every(({ pair, scale }) => !pair && scale === 1));

    const zoomIn = await transition(page, "close", 1.95);
    const chosen = zoomIn.find(frame => frame.pair);
    assert(chosen && chosen.t - zoomIn[0].t >= .85, "the lead gap must stay close for the entry period");
    assert.deepEqual(zoomIn.at(-1).pair?.slice().sort(), ["front", "player"]);
    const zoomedScale = zoomIn.at(-1).scale;
    assert(Math.abs(zoomedScale - 1.36) < .01, "a sustained close race reaches 1.36x zoom");
    assertSmooth(zoomIn, 1, zoomedScale);
    assert(Math.abs(await renderedScale(page) - zoomedScale) < .001, "the canvas applies the duel scale");
    assert.equal(await page.locator(".camel-canvas").evaluate(canvas => getComputedStyle(canvas).transform), "none");
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => window.__duelTest.race.stats.miss), 1,
      "Space remains available for voice during zoom");

    const cluster = await transition(page, "playerCluster", .35);
    assert(cluster.every(({ pair }) => pair?.slice().sort().join() === "front,player"),
      "a change of order and a closer trailing pair do not steal the camera from the two leaders");

    const hysteresis = await transition(page, "hysteresis", .5);
    assert(hysteresis.every(({ pair, scale }) => pair && scale >= zoomedScale - .01),
      "a gap between the enter and exit thresholds keeps the active zoom");
    const briefSeparation = await transition(page, "open", .15);
    assert(briefSeparation.every(({ pair, scale }) => pair && scale >= zoomedScale - .01),
      "brief separation keeps the active zoom");
    await transition(page, "close", .2);

    const zoomOut = await transition(page, "open", 1.02);
    assert.equal(zoomOut.at(-1).pair, null);
    assert(Math.abs(zoomOut.at(-1).scale - 1) < .01, "the view returns to its original scale");
    assertSmooth(zoomOut, zoomedScale, 1);
    await page.waitForFunction(() => window.__duelRenderedScale === 1);

    const cooldown = await transition(page, "opponentCluster", 1.1);
    assert(cooldown.every(({ pair }) => !pair), "cooldown delays another close pair from zooming immediately");
    await waitForPair(page, "closer");
    await page.waitForFunction(() => window.__camelRace.fx.duelCamera.scale > 1.1);
    const opponentZoom = await camera(page);
    assert.deepEqual(opponentZoom.pair.slice().sort(), ["closer", "front"], "the front two of the group get the zoom");

    await page.waitForFunction(() => window.__camelRace.fx.duelCamera.scale === 1.36);
    const merged = await transition(page, "mergedCluster", 1.25);
    assert.deepEqual(merged[0].pair.slice().sort(), ["closer", "front"]);
    assert.deepEqual(merged.at(-1).pair.slice().sort(), ["player", "steady"],
      "a connected four-camel pack moves the focus to the sustained new leading pair");
    assert(merged.every(({ scale }) => scale === 1.36), "a change of pair keeps the zoom level stable");
  });

  await check("touch-zoom-keeps-the-race-controls-usable", async page => {
    await launch(page);
    await changeLayout(page, "close");
    await waitForPair(page, "player");
    await page.waitForFunction(() => window.__camelRace.fx.duelCamera.scale === 1.36);
    await assertTouchLayout(page);

    const voiceBox = await page.locator(voice).boundingBox();
    await page.evaluate(() => { window.__duelTest.cue = true; });
    await page.locator(`${voice}[data-cue="on"]`).waitFor();
    await page.touchscreen.tap(voiceBox.x + voiceBox.width / 2, voiceBox.y + voiceBox.height / 2);
    assert.equal(await page.evaluate(() => {
      const { perfect, good } = window.__duelTest.race.stats;
      return perfect + good;
    }), 1, "the zoom leaves the timed voice control usable");

    const whipBox = await page.locator(whip).boundingBox();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{
      x: whipBox.x + whipBox.width / 2, y: whipBox.y + whipBox.height / 2,
    }] });
    await page.waitForFunction(() => window.__camelRace.fx.whipHeld);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.waitForFunction(() => !window.__camelRace.fx.whipHeld);
  }, touch);

  await check("zoom-ends-at-the-finish", async page => {
    await launch(page);
    await changeLayout(page, "close");
    await waitForPair(page, "player");
    await page.waitForFunction(() => window.__camelRace.fx.duelCamera.scale === 1.36);

    await changeLayout(page, "finish");
    await page.waitForFunction(() => window.__camelRace.fx.phase === "goal");
    assert.equal((await camera(page)).pair, null);
    await page.waitForFunction(() => window.__camelRace.fx.duelCamera.scale === 1);
  });

  await check("reduced-motion-skips-the-camera-zoom", async page => {
    await observeRenderedScale(page);
    await launch(page);
    const frames = await transition(page, "close", 1.95);
    assert(frames.every(({ scale, pan }) => scale === 1 && pan === 0));
    assert(frames.at(-1).pair?.includes("player"));
    assert.equal(await renderedScale(page), 1);
  }, { reducedMotion: "reduce" });
}, {
  entry: new URL("camel-race.html", baseURL).href,
  readySelector: '[data-test="camel-menu-quick"]',
});
