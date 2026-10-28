// #503: 無関係な画像の待機をなくし、必要素材/表示画像の準備と時計の順序を守る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { suite } from "./support.mjs";

const metrics = [];
async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.T = { core, session: await import("./js/craft/session.js"),
      heat: await import("./js/craft/heat.js"), common: await import("./js/craft/common.js"),
      readiness: await import("./js/craft/readiness.js"), data: await import("./js/core/data.js") };
  });
}

await suite("craft-readiness", async check => {
  await check("unrelated-art-and-cached-reopen", async page => {
    // main.warmUp() ends with this image. Do not attribute its background
    // stove_coil request to the bench that this case has not opened yet.
    await page.waitForFunction(() => performance.getEntriesByType("resource")
      .some(entry => /\/ui\/making\/hookah_base\.(png|webp)(\?|$)/.test(entry.name)));
    await init(page);
    const scope = await page.evaluate(() => {
      const { DB, img, makingUrl, faceIconUrl, portraitInfo, bgUrl } = T.data;
      window.cs = T.session.newSession("tournament");
      const current = T.readiness.craftAssetUrls(cs.mode, { step: "heat", cs });
      const allowed = new Set([...current, ...T.readiness.craftAssetUrls(cs.mode, { cs }),
        ...["normal", "sad", "surprise"].map(face => portraitInfo("hajime", face)?.src)]);
      const people = ["hajime", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"];
      const oldMaking = DB.manifest.making.filter(name => !/^(heat_|hajime_heat_scene)/.test(name));
      const previous = [...new Set([
        ...oldMaking.map(makingUrl), img("ui/continue/backdrop_stage.png"), bgUrl("bg_tournament_stage"),
        ...people.flatMap(id => [faceIconUrl(id), ...DB.manifest.portraits[id].faces.map(face => portraitInfo(id, face)?.src)]),
      ].filter(Boolean))];
      return { beforeCount: previous.length, currentCount: current.length,
        includesLegacyStove: current.includes(makingUrl("stove_coil.png")),
        unrelated: previous.filter(url => !allowed.has(url)).map(url => new URL(url, document.baseURI).href) };
    });
    assert.equal(scope.includesLegacyStove, false, "現在の炭焼き準備が無関係なコンロ画像に依存した");
    let release;
    const held = new Promise(resolve => { release = resolve; });
    const blocked = [];
    await page.route("**/*", async route => {
      if (scope.unrelated.includes(route.request().url())) { blocked.push(route.request().url()); await held; }
      await route.continue();
    });
    try {
      await page.evaluate(() => {
        T.session.craftTest.auto = "good";
        const started = performance.now();
        T.session.openBench(cs);
        window.preparing = T.session.waitBenchReady(cs, "heat").then(() => { window.preparationMs = performance.now() - started; });
        window.heatRun = T.heat.runHeat(cs);
      });
      await page.waitForFunction(() => window.preparationMs != null);
      assert.deepEqual(blocked, [], "別工程/全員の表情を今の開始条件にした");
      assert(scope.currentCount < scope.beforeCount / 2);
      const initialMs = await page.evaluate(() => preparationMs);
      const heldAtStart = blocked.length;
      await page.evaluate(() => heatRun);
      const requests = [];
      page.on("request", request => { if (/\.(webp|png)(\?|$)/.test(request.url())) requests.push(request.url()); });
      await page.evaluate(async () => {
        window.loadingAdded = 0;
        const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(n => {
          if (n.nodeType === 1 && (n.matches('[data-test="craft-loading"]') || n.querySelector('[data-test="craft-loading"]'))) loadingAdded++;
        })));
        observer.observe(document.getElementById("screen"), { subtree: true, childList: true });
        const cached = T.session.newSession("tournament");
        const started = performance.now();
        T.session.openBench(cached);
        await T.session.waitBenchReady(cached, "heat");
        window.cachedMs = performance.now() - started;
        await new Promise(resolve => setTimeout(resolve, 250));
        observer.disconnect();
      });
      assert.equal(await page.evaluate(() => loadingAdded), 0, "キャッシュ済み工程で準備中の幕が点滅した");
      assert.deepEqual(requests, [], "同じ素材を再通信した");
      metrics.push({ case: "scoped-and-cached", beforeCount: scope.beforeCount, currentCount: scope.currentCount,
        preparationMs: Math.round(initialMs), cachedMs: Math.round(await page.evaluate(() => cachedMs)),
        unrelatedAtStart: heldAtStart, laterBackgroundRequests: blocked.map(url => new URL(url).pathname),
        repeatedRequests: requests.length, cachedLoadingScreens: 0 });
    } finally { release(); }
  });

  await check("next-step-prefetch-does-not-block", async page => {
    await init(page);
    // 初回の必要素材/背景準備を済ませ、保留する次工程だけが開始を止めないことを測る。
    await page.evaluate(async () => {
      window.cs = T.session.newSession("tournament");
      const bench = T.session.openBench(cs, { steps: [["heat", "炭焼き"], ["place", "炭の配置"]] });
      await Promise.all([bench.ready, T.readiness.warmCraftAssets(cs.mode, { cs, step: "heat" }), bench.worker.prepare("heat")]);
    });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let requested = false;
    await page.route("**/img/ui/making/coal_just.png", async route => { requested = true; await held; await route.continue(); });
    // 圧縮対象の名前がWebP化されても同じ挙動を検証する。
    await page.route("**/img/ui/making/coal_just.webp", async route => { requested = true; await held; await route.continue(); });
    try {
      await page.evaluate(() => {
        window.preparing = T.session.waitBenchReady(cs, "heat").then(() => { window.currentReady = true; });
      });
      await page.waitForFunction(() => window.currentReady);
      await page.waitForTimeout(50);
      assert(requested, "次の配置素材を裏で読み始めていない");
      assert.equal(await page.locator(".bench").evaluate(n => n.inert), false);
      assert.equal(await page.locator('[data-test="craft-loading"]').count(), 0);
    } finally { release(); }
    await page.evaluate(() => T.session.waitBenchReady(cs, "place"));
  });

  await check("mixed-shapes-keyboard-and-automatic-removal", async page => {
    await init(page);
    // This fixture exercises unlocked mixed coals, independently of the lesson-gate tests.
    await page.evaluate(() => {
      Object.assign(T.core.state.flags, { _coal_cube_learned: true, _coal_mix_unlocked: true });
      T.core.state.owned.push("cube_charcoal");
    });
    let release;
    const held = new Promise(resolve => { release = resolve; });
    await page.route("**/img/ui/making/heat_cube_lit.webp", async route => { await held; await route.continue(); });
    try {
      await page.evaluate(() => {
        window.coalClock = 1000;
        Object.defineProperty(performance, "now", { configurable: true, value: () => coalClock });
        const raf = requestAnimationFrame.bind(window);
        window.requestAnimationFrame = fn => raf(() => fn(coalClock));
        Math.random = () => .5;
        window.cs = T.session.newSession("tournament");
        cs.coalTypes = ["cube_charcoal", "flat_charcoal", "cube_charcoal"];
        window.before = JSON.stringify(T.core.state);
        T.session.openBench(cs);
        window.heatRun = T.heat.runHeat(cs);
      });
      await page.locator('[data-test="craft-loading"]').waitFor();
      assert.equal(await page.locator(".countdown, .stove .coal").count(), 0, "必須画像より先に時計が始まった");
      assert.equal(await page.evaluate(() => cs.heat), null);
    } finally { release(); }
    // 必須画像の既存15秒上限と、その後の3秒カウントダウンを含む。
    await page.waitForFunction(() => document.querySelector('.heat')?.getAttribute('aria-busy') === "false", null, { timeout: 20000 });
    const shapes = await page.locator(".stove .coal").evaluateAll(nodes => nodes.map(n => ({
      image: n.querySelector(".c-cold").style.backgroundImage,
      height: parseFloat(n.querySelector(".coal-sprite").style.height),
    })));
    assert.match(shapes[0].image, /heat_cube_cold/);
    assert.match(shapes[1].image, /heat_flat_cold/);
    assert(shapes[0].height > shapes[1].height, "キューブにフラットと同じ厚みを使った");
    await page.evaluate(() => { coalClock = 1000 + (5.8 + .5 * T.common.skill.window(cs) / 2) * 1000; });
    await page.locator('[data-test="coal-0"]').focus(); await page.keyboard.press("Space");
    await page.locator('[data-test="coal-1"]').focus(); await page.keyboard.press("Enter");
    assert.equal(await page.locator('[data-test="coal-count"]').textContent(), "2 / 3");
    assert.match(await page.locator('[data-test="stored-coal-0"] .c-cold').getAttribute("style"), /heat_cube_cold/);
    assert.match(await page.locator('[data-test="stored-coal-1"] .c-cold').getAttribute("style"), /heat_flat_cold/);
    await page.evaluate(() => { coalClock = 11500; });
    await page.locator('[data-test="step-summary"]').waitFor();
    assert.deepEqual(await page.evaluate(() => ({ phases: cs.heat.picks, score: cs.heat.score, automatic: cs.heat.timings.map(t => t.automatic) })),
      { phases: ["just", "just", "over"], score: 89, automatic: [false, false, true] });
    assert.equal(await page.locator('[data-test="coal-count"]').textContent(), "3 / 3");
    assert.equal(await page.evaluate(() => JSON.stringify(T.core.state)), await page.evaluate(() => before));
  });
}, {
  // Observe the final boot resource even when startup exceeds the default 250 entries.
  initScript: () => performance.setResourceTimingBufferSize(2048),
});

if (metrics.length) {
  const out = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "craft-readiness-metrics.json"), JSON.stringify(metrics, null, 2) + "\n");
  console.log(JSON.stringify(metrics));
}
