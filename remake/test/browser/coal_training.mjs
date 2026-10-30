// #694: isolated real-browser playtest. Existing Playwright + Chrome only; no downloads.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const output = path.resolve(root, process.env.COAL_ARTIFACTS || ".codex/artifacts/coal-694");
fs.mkdirSync(output, { recursive: true });
const missing = new Set(), results = [];
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
// #964: classic の会話枠原画は narration.svg（dialogue.svg は要求されない）。
const vnAssets = ["/remake/img/ui/vn-lounge/narration.svg", "/remake/img/ui/vn-lounge/controls.svg", "/remake/fonts/ZenOldMincho-Name-Bold.woff2"];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = path.resolve(root, "." + (pathname.endsWith("/") ? pathname + "index.html" : pathname));
  if (!file.startsWith(root + path.sep) || !mime[path.extname(file)]) { res.writeHead(404).end(); return; }
  try { res.writeHead(200, { "Content-Type": mime[path.extname(file)] }).end(fs.readFileSync(file)); }
  catch { missing.add(pathname); res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true,
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
  for (const [label, viewport, touch, reducedMotion] of [
    ["pc", { width: 1280, height: 720 }, false, "no-preference"],
    ["touch", { width: 844, height: 390 }, true, "no-preference"],
    ["reduced", { width: 844, height: 390 }, true, "reduce"],
  ]) {
    if (process.env.CASE_FILTER && label !== process.env.CASE_FILTER) continue;
    console.log(`[coal browser] START ${label}`);
    const context = await browser.newContext({ viewport, isMobile: touch, hasTouch: touch, reducedMotion });
    await context.route("**/*", route => {
      const u = new URL(route.request().url());
      // Heat sprites and the adopted VN frame/font are local. Other media remains blocked.
      const allowed = /\.(html|js|css|json)$/.test(u.pathname) || /\/img\/ui\/making\/heat_[^/]+\.webp$/.test(u.pathname) || vnAssets.includes(u.pathname);
      return u.origin === origin && (allowed || u.pathname.endsWith("/")) ? route.continue() : route.abort();
    });
    const page = await context.newPage(), errors = [], vnResponses = new Map();
    page.on("response", response => {
      const pathname = new URL(response.url()).pathname;
      if (vnAssets.includes(pathname)) vnResponses.set(pathname, response.status());
    });
    page.setDefaultTimeout(20000);
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(origin + "/remake/");
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      window.Q = { core, vn: await import("./js/vn/engine.js"), tonari: await import("./js/daily/tonari.js"),
        lesson: await import("./js/daily/coal-lesson.js"), session: await import("./js/craft/session.js"),
        steps: await import("./js/craft/steps.js"), heat: await import("./js/craft/heat.js"),
        view: await import("./js/craft/heat_view.js"), kuji: await import("./js/daily/kuji.js"),
        data: await import("./js/core/data.js"), coals: await import("./js/craft/coals.js") };
      const intro = await import("./js/vn/intro.js");
      for (const id of Object.keys(Q.data.DB.characters)) intro.markIntroSeen(id);
      Q.core.config.textSpeed = 1;
      Q.core.state.owned.push("cube_charcoal"); Q.core.state.equip.charcoal = "cube_charcoal";
      Q.core.state.affinity.sumi = 9; Q.core.state.flags.ch1_sumi_training = true; // ♥1。シフト後のスミとの会話で好感度が上がっても♥2（20）に届かない値
      Q.vn.vnTest.turbo = true;
      Q.shift = Q.tonari.doBaito();
    });
    await page.locator('[data-test="shift-order-0"]').click();
    await page.locator('[data-test="after-none"]').waitFor();
    assert.equal(await page.locator('[data-test="after-cube-coals"]').count(), 0);
    await page.locator('[data-test="after-none"]').click(); await page.evaluate(() => Q.shift);
    await page.evaluate(() => { Q.core.state.affinity.sumi = 20; Q.shift = Q.tonari.doBaito(); });
    await page.locator('[data-test="after-cube-coals"]').waitFor();
    await page.evaluate(() => { Q.vn.vnTest.turbo = false; });
    await page.locator('[data-test="after-cube-coals"]').click();
    await page.locator("#vn.active").waitFor();
    const nameFontLoaded = await page.evaluate(async () => {
      await document.fonts.load('700 24px "Suien Name"');
      return document.fonts.check('700 24px "Suien Name"') && getComputedStyle(document.querySelector(".vn-name")).fontFamily.includes("Suien Name");
    });
    assert.equal(nameFontLoaded, true, "統合後の授業で採用済み会話UIの名前書体を使う");
    assert.equal(await page.evaluate(() => Q.coals.hasCoalTraining(Q.core.state.flags)), false);
    await page.locator('[data-test="vn-skip"]').click();
    await page.evaluate(() => Q.shift);
    console.log(`[coal browser] ${label}: shift menu and SKIP read complete`);
    assert.equal(await page.evaluate(() => Q.coals.hasCoalTraining(Q.core.state.flags)), true);
    await page.evaluate(() => { Q.core.load(); });
    assert.equal(await page.evaluate(() => Q.lesson.canStudyCubeCoals()), false);
    assert.equal(await page.evaluate(() => Q.session.newSession("drill").equip.charcoal), "cube_charcoal");

    // Real VN cancellation followed by rereading: no completion reward on abort.
    await page.evaluate(() => {
      delete Q.core.state.flags[Q.coals.COAL_UNLOCK.cube];
      Q.abort = new AbortController(); Q.read = Q.lesson.studyCubeCoals({ signal: Q.abort.signal });
    });
    await page.locator("#vn.active").waitFor();
    await page.evaluate(() => Q.abort.abort());
    assert.equal(await page.evaluate(() => Q.read), false);
    assert.equal(await page.evaluate(() => Q.coals.hasCoalTraining(Q.core.state.flags)), false);
    await page.evaluate(() => { Q.read = Q.lesson.studyCubeCoals(); });
    await page.locator("#vn.active").waitFor();
    await page.locator('[data-test="vn-auto"]').click();
    await page.evaluate(() => Q.read);
    assert.equal(await page.evaluate(() => Q.coals.hasCoalTraining(Q.core.state.flags)), true);
    console.log(`[coal browser] ${label}: abort and AUTO reread complete`);

    // Existing snapshot survives the new data; replenishment switches only after exhaustion + three days.
    // Frozen pre-#694 data (remake/test/fixtures/kuji-legacy.json). Reading origin/main via git is not
    // possible in CI checkouts (no such ref) and drifts as main moves; the case guards that a snapshot
    // written against THIS old data survives, so the old data must be a fixed fixture.
    const oldKuji = JSON.parse(fs.readFileSync(path.join(root, "remake/test/fixtures/kuji-legacy.json"), "utf8"));
    await page.evaluate(async oldKuji => {
      Q.vn.vnTest.turbo = true;
      const old = oldKuji.grades.g500;
      const order = old.prizes.flatMap((p, i) => Array(p.count).fill(i));
      const hose = old.prizes.findIndex(p => p.name.includes("ホース"));
      const index = order.indexOf(hose); [order[0], order[index]] = [order[index], order[0]];
      Q.core.state.kuji.g500 = { version: 2, order, drawn: 0, emptyDay: null, prizes: structuredClone(old.prizes), lastOne: structuredClone(old.lastOne) };
      Q.core.state.money = 30000; Q.core.state.goods = [{ name: "既所持ホース", sell: 800 }];
      const ui = await import("./js/core/ui.js"), util = await import("./js/core/util.js");
      Q.kujiRender = () => ui.showScreen("coal-kuji-test", util.el("div.shop", Q.kuji.kujiRows(Q.kujiRender)));
      Q.kujiRender();
    }, oldKuji);
    await page.locator('[data-test="kuji-g500"]').click();
    await page.locator(".kuji-card.reveal").waitFor();
    await page.locator('[data-test="kuji-reveal"]').click();
    assert.equal(await page.evaluate(() => Q.core.state.goods.length), 2);
    assert.equal(await page.evaluate(() => Q.core.state.kuji.g500.prizes.some(p => p.name.includes("ホース"))), true);
    await page.evaluate(() => {
      const b = Q.core.state.kuji.g500; b.drawn = b.order.length; b.emptyDay = Q.core.state.day;
      Q.core.state.day += 2; Q.kujiRender();
    });
    assert.equal(await page.locator('[data-test="kuji-g500"]').isDisabled(), true);
    await page.evaluate(() => {
      Q.core.state.day++; Q.kujiRender();
      const b = Q.core.state.kuji.g500;
      const vanilla = b.prizes.findIndex(p => p.flavorId === "vanilla" && p.grams === 25);
      const index = b.order.indexOf(vanilla); [b.order[0], b.order[index]] = [b.order[index], b.order[0]];
      Q.stockBefore = Q.core.state.flavorStock.vanilla || 0;
    });
    assert.equal(await page.evaluate(() => Q.core.state.kuji.g500.order.length), 50);
    assert.equal(await page.evaluate(() => Q.core.state.kuji.g500.prizes.some(p => p.name.includes("ホース"))), false);
    await page.locator('[data-test="kuji-g500"]').click();
    await page.locator(".kuji-card.reveal").waitFor();
    await page.locator('[data-test="kuji-reveal"]').click();
    assert.equal(await page.evaluate(() => Q.core.state.flavorStock.vanilla - Q.stockBefore), 25);
    assert.equal(await page.evaluate(() => Q.core.state.goods.length), 2);
    await page.evaluate(() => Q.core.load());
    assert.equal(await page.evaluate(() => Q.core.state.flavorStock.vanilla - Q.stockBefore), 25);
    console.log(`[coal browser] ${label}: old snapshot/hose, refill and actual 25g saved`);

    // The lesson unlocks cube, while four/mixed still require their independent flags.
    await page.evaluate(async () => {
      Q.cs = Q.session.newSession("drill");
      Q.session.openBench(Q.cs); await Q.session.waitBenchReady(Q.cs);
      Q.placement = Q.steps.stepPlace(Q.cs);
    });
    await page.locator('[data-test="opt-triangle"]').waitFor();
    assert.equal(await page.locator('[data-test="opt-four"], [data-test="opt-mixed"]').count(), 0);
    await page.locator('[data-test="opt-triangle"]').click(); await page.evaluate(() => Q.placement);
    await page.evaluate(() => { Q.core.state.flags._coal_four_unlocked = true; Q.placement = Q.steps.stepPlace(Q.cs); });
    await page.locator('[data-test="opt-four"]').click(); await page.evaluate(() => Q.placement);
    assert.equal(await page.locator('[data-test="opt-mixed"]').count(), 0);
    assert.equal(await page.evaluate(() => Q.coals.coalCount(Q.cs)), 4);
    await page.evaluate(() => { Q.core.state.flags._coal_mix_unlocked = true; Q.placement = Q.steps.stepPlace(Q.cs); });
    await page.locator('[data-test="opt-four"]').click();
    await page.locator('[data-test="opt-mixed"]').click(); await page.evaluate(() => Q.placement);
    assert.deepEqual(await page.evaluate(() => Q.cs.coalTypes), ["cube_charcoal", "flat_charcoal", "flat_charcoal", "flat_charcoal"]);

    await page.evaluate(async () => {
      Q.cs = Q.session.newSession("tournament"); Q.cs.equip.charcoal = "flat_charcoal";
      Q.cs.place = "triangle"; Q.cs.coalTypes = Array(3).fill("flat_charcoal");
      Q.session.openBench(Q.cs); await Q.session.waitBenchReady(Q.cs);
      const panel = Q.session.stepPanel("heat", "炭焼き", "芯と輪郭の光を見て取り上げる");
      const view = Q.view.buildHeatView(Q.cs.coalTypes);
      panel.append(view.root); view.root.setAttribute("aria-busy", "false");
      for (const c of view.coals) { c.node.classList.add("pikan"); c.node.dataset.phase = "just";
        c.node.style.setProperty("--red", "1"); c.node.style.setProperty("--hot", ".6"); }
    });
    // Frozen pre-#694 sheet for the before/after screenshots; see the kuji fixture note above.
    const baseline = fs.readFileSync(path.join(root, "remake/test/fixtures/craft-css-legacy.css"), "utf8");
    // Disable the entire new sheet: layering the old sheet alone would leave new-only selectors active.
    await page.locator('link[href$="css/craft.css"]').evaluate(n => { n.disabled = true; });
    const oldStyle = await page.addStyleTag({ content: baseline });
    await page.locator(".stove").screenshot({ path: path.join(output, label + "-before.png") });
    await oldStyle.evaluate(n => n.remove());
    await page.locator('link[href$="css/craft.css"]').evaluate(n => { n.disabled = false; });
    await page.locator(".stove").screenshot({ path: path.join(output, label + "-after.png") });
    const glow = await page.locator(".coal.pikan .c-core").first().evaluate(n => ({
      width: getComputedStyle(n).width, opacity: getComputedStyle(n).opacity,
      animation: getComputedStyle(n).animationName, boxShadow: getComputedStyle(n).boxShadow,
    }));
    assert.equal(glow.width, "32px"); assert.equal(glow.opacity, "1"); assert.equal(glow.animation, "none");
    assert.equal(await page.locator(".coal-now").count(), 0, "炭の取り頃に文字ラベルを表示しない");
    assert.equal(await page.locator(".coal .c-hot").first().evaluate(n => getComputedStyle(n).opacity), "1");

    // Shared production burnCoals: actual pointer/touch, exchange counts 1..4, keyboard access and window edge.
    const timing = [];
    for (const count of [1, 2, 3, 4]) {
      await page.evaluate(async count => {
        Q.vn.vnTest.turbo = false; Q.core.state.goods = count === 1 ? [] : [{ name: "ステンレストング（上物）", sell: 1000 }];
        Q.cs.condition = { health: "green", slow: 1, window: 1, focus: 1 };
        Q.core.state.stats.sense = 10;
        const panel = Q.session.stepPanel("heat", "炭焼き", "芯の光を見て取り出す");
        Q.realNow = performance.now.bind(performance); Q.now = 1000;
        Q.realRandom = Math.random; Math.random = () => .5; performance.now = () => Q.now;
        Q.burn = Q.heat.burnCoals(Q.cs, panel, { count, compact: count !== 3 });
      }, count);
      await page.waitForFunction(() => document.querySelector('.heat[aria-busy="false"]'));
      // The core is dark before the real timing band, then stays lit without a flashing animation.
      await page.evaluate(() => { Q.now += 5799; });
      await page.waitForFunction(() => document.querySelector('[data-test="coal-0"]').dataset.phase === "pre");
      assert.equal(await page.locator(".coal.pikan").count(), 0);
      assert.equal(await page.locator(".coal .c-core").first().evaluate(n => getComputedStyle(n).opacity), "0");
      await page.evaluate(() => { Q.now += 2; });
      await page.waitForFunction(() => document.querySelector('[data-test="coal-0"]').dataset.phase === "just");
      assert.equal(await page.locator(".coal.pikan").count(), count);
      assert.equal(await page.locator(".coal .c-core").first().evaluate(n => getComputedStyle(n).opacity), "1");
      // .525 seconds into the ordinary just window: without tongs it has ended; with tongs it remains lit.
      await page.evaluate(() => { Q.now += 524; });
      await page.waitForFunction(expected => document.querySelector('[data-test="coal-0"]').dataset.phase === expected, count === 1 ? "hot" : "just");
      assert.equal(await page.locator(".coal.pikan").count(), count === 1 ? 0 : count);
      assert.equal(await page.locator(".coal .c-core").first().evaluate(n => getComputedStyle(n).opacity), count === 1 ? "0" : "1");
      for (let i = 0; i < count; i++) {
        const node = page.locator(`[data-test="coal-${i}"]`);
        if (count === 4 && i === 3) { await node.focus(); await page.keyboard.press("Enter"); }
        else if (touch) await node.tap(); else await node.click();
      }
      const res = await page.evaluate(async () => {
        const { res } = await Q.burn; performance.now = Q.realNow; Math.random = Q.realRandom; return res;
      });
      assert.equal(res.picks.length, count); assert.equal(res.score, count === 1 ? 80 : 100);
      timing.push({ count, score: res.score, picks: res.picks });
      console.log(`[coal browser] ${label}: shared burn count=${count} score=${res.score}`);
    }
    const served = await page.evaluate(async () => {
      const conditions = await import("./js/craft/conditions.js");
      const pull = await import("./js/craft/pull.js");
      const cs = Q.session.newSession("tournament");
      Object.assign(cs, { equip: { ...cs.equip, charcoal: "flat_charcoal" }, place: "triangle", coalTypes: Array(3).fill("flat_charcoal"),
        mix: { double_apple: 10, mint: 2 }, pack: "normal", holes: { score: 100, total: 24, outer: 24, minimumComplete: true },
        steamSeconds: 480, environment: { rainy: false, ambientC: 23, humidityPercent: 52 } });
      cs.mixInfo = Q.steps.evaluateMix(cs);
      Q.session.craftTest.auto = "good";
      Q.session.openBench(cs); await Q.session.waitBenchReady(cs);
      await Q.heat.runHeat(cs);
      cs.steam = { score: 100, seconds: 480, temp: conditions.temperatureAfterSteam(cs, 480, 0) };
      await pull.runPull(cs);
      for (const round of [1, 2]) await pull.runCare(cs, { round });
      Q.session.craftTest.auto = null;
      return { failed: cs.failed || null, pull: cs.pull, careHistory: cs.careHistory };
    });
    assert.equal(served.failed, null);
    assert.equal(served.pull.inZone, true);
    assert.equal(served.careHistory.length, 2);
    assert(served.careHistory.every(care => !care.failed && care.inZone));
    assert.deepEqual(errors, []);
    assert.deepEqual(vnAssets.map(path => [path, vnResponses.get(path)]), vnAssets.map(path => [path, 200]), "採用済み会話枠・操作枠・名前書体をローカルで読み込む");
    results.push({ label, status: "passed", glow, timing, served,
      scope: "real Chrome; touch and reduced-motion emulation; unrelated media intentionally omitted; steam outcome is a numerical fixture, not a dodge playthrough" });
    console.log(`[coal browser] PASS ${label}: boot, shift menu, real lesson SKIP/AUTO/abort, save, glow, production burn 1..4 and pointer/keyboard`);
    await context.close();
  }
} finally {
  await browser?.close(); await new Promise(resolve => server.close(resolve));
  fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify({ results, missing: [...missing] }, null, 2) + "\n");
}
assert.equal(results.length, process.env.CASE_FILTER ? 1 : 3);
assert.deepEqual([...missing], [], "Missing text or heat sprites in the test checkout");
