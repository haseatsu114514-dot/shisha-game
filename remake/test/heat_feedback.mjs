// #354: 大会3/4炭と実際の交換1〜4炭。実入力・評価・操作領域・画面内の収まりを確認。
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
try {
  for (const [name, viewport, touch] of [["pc", { width: 1280, height: 720 }, false],
    ["touch", { width: 844, height: 390 }, true], ["portrait", { width: 390, height: 844 }, false]]) {
    const cases = name === "portrait" ? [[false, 4, false], [true, 4, false]] :
      [[false, 3, false], [false, 4, false], [false, 4, true], ...[1, 2, 3, 4].map(n => [true, n, false])];
    for (const [compact, count, excellentOnly] of cases) {
      const label = `${name}-${compact ? "care" : "heat"}-${count}${excellentOnly ? "-excellent" : ""}`;
      const page = await browser.newPage({ viewport, isMobile: touch, hasTouch: touch });
      const errors = []; page.on("pageerror", e => errors.push(e.message));
      if (process.env.ASSET_REV) await page.route("**/*", route => {
        const u = new URL(route.request().url());
        if (u.origin === new URL(base).origin && /\.(js|css)$/.test(u.pathname)) u.searchParams.set("qa", process.env.ASSET_REV);
        return route.continue({ url: u.href });
      });
      await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
      if (touch) {
        // スマホ縦向きでは既存の横向き案内が入力を覆う。回転してから実操作する。
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator("#rotate-hint").waitFor({ state: "visible" });
        await page.setViewportSize(viewport);
        await page.locator("#rotate-hint").waitFor({ state: "hidden" });
      }
      await page.evaluate(async ({ compact, count }) => {
        const core = await import("./js/core/state.js"); core.newGame();
        const session = await import("./js/craft/session.js"), heat = await import("./js/craft/heat.js");
        const pull = await import("./js/craft/pull.js"), common = await import("./js/craft/common.js");
        window.QA = { core, session, heat, pull, common };
        window.coalClock = 1000;
        Object.defineProperty(performance, "now", { configurable: true, value: () => window.coalClock });
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = fn => raf(() => fn(window.coalClock));
        QA.random = Math.random; Math.random = () => .5;
        window.cs = session.newSession("tournament"); cs.place = count === 4 ? "four" : "triangle";
        cs.holes = { total: 24, minimumComplete: true }; cs.pack = "normal";
        cs.steam = { temp: .54, score: 100, hits: 0, concentration: 1 };
        cs.pull = { temp: .54, pulls: 2, score: 100 };
        if (compact) cs.heat = { score: 80, grade: "B", picks: ["pre", "just", "pre"],
          heatPower: 60, heatStability: 70, startup: 55, burnRisk: 25, aromaRetention: 70 };
        QA.before = JSON.stringify(core.state); QA.originalHeat = JSON.stringify(cs.heat);
        session.openBench(cs);
        QA.run = compact ? pull.runCare(cs) : heat.runHeat(cs);
        QA.justSeconds = .5 * common.skill.window(cs);
        QA.ideal = 5.8 + QA.justSeconds / 2;
      }, { compact, count });
      if (compact) await page.locator(`[data-test="care-coal-${count}"]`).click();
      await page.waitForFunction(() => document.querySelector('[data-test="coal-0"]')?.dataset.phase === "raw");
      await page.evaluate(() => { Math.random = QA.random; });
      assert.equal(await page.locator(".stove .coal").count(), count);
      // 入力イベントが反映された瞬間を読む。最後の炭の結果カードへ切り替わる350ms後と競争しない。
      await page.evaluate(() => {
        document.addEventListener("pointerdown", e => {
          const coal = e.target.closest?.(".stove .coal");
          if (!coal?.disabled) return;
          const index = coal.dataset.test.split("-")[1];
          const collected = document.querySelector(`[data-test="stored-coal-${index}"]`);
          const panel = document.querySelector(".bench-panel").getBoundingClientRect();
          const strip = document.querySelector(".heat-feedback"), f = strip.getBoundingClientRect();
          const carrier = document.querySelector(".heat-info").getBoundingClientRect();
          const stamp = strip.querySelector(".stamp");
          const r = stamp.getBoundingClientRect();
          const inside = b => b.left >= panel.left - 1 && b.right <= panel.right + 1 && b.top >= panel.top - 1 && b.bottom <= panel.bottom + 1;
          const nodes = [...document.querySelectorAll(".stove .coal:not(:disabled)")];
          const active = nodes.map(n => n.getBoundingClientRect());
          const images = n => [...n.querySelectorAll(".coal-sprite .art")].map(n => n.style.backgroundImage);
          QA.lastPick = {
            phase: coal.dataset.phase, storedPhase: collected.dataset.phase,
            count: document.querySelector('[data-test="coal-count"]').textContent,
            originals: images(coal), stored: images(collected),
            rating: document.querySelector(`[data-test="coal-timing-${index}"]`).dataset.rating,
            stamps: strip.querySelectorAll(".stamp").length, stamp: stamp.textContent,
            geometry: {
              separate: active.every(r => r.right <= carrier.left), stripInside: inside(f), carrierInside: inside(carrier),
              separated: active.every((r, i) => active.slice(i + 1).every(o => r.right <= o.left || o.right <= r.left || r.bottom <= o.top || o.bottom <= r.top)),
              textInside: r.left >= f.left && r.right <= f.right,
              accessible: nodes.every(n => { const r = n.getBoundingClientRect(); return [.5, .25, .75, .1, .9].some(y => [.5, .25, .75, .1, .9].some(x => n.contains(document.elementFromPoint(r.x + r.width * x, r.y + r.height * y)))); }),
              pointer: getComputedStyle(strip).pointerEvents, floating: document.querySelectorAll(".bench-panel > .stamp, .care-burn > .stamp").length,
            },
          };
        });
      });
      const expected = [];
      for (let i = 0; i < count; i++) {
        const phase = excellentOnly ? "just" : ["raw", "pre", "just", "over"][i];
        const grade = { raw: ["MISS", 15], pre: ["GOOD", 78], just: ["PERFECT", 100], over: ["MISS", 28] }[phase];
        expected.push({ phase, rating: grade[0], score: grade[1] });
        await page.evaluate(({ phase }) => {
          const time = { raw: 1, pre: 5.7, just: QA.ideal, over: 9.5 }[phase];
          window.coalClock = 1000 + time * 1000;
        }, { phase });
        await page.waitForTimeout(30);
        const coal = page.locator(`[data-test="coal-${i}"]`);
        // 実際に見えていて入力が届く位置でタップする。
        const point = await coal.evaluate(n => {
          const r = n.getBoundingClientRect();
          for (const y of [.5, .25, .75, .1, .9]) for (const x of [.5, .25, .75, .1, .9]) {
            const p = { x: r.x + r.width * x, y: r.y + r.height * y };
            if (n.contains(document.elementFromPoint(p.x, p.y))) return p;
          }
          return null;
        });
        assert(point, `${label}: 炭${i + 1}に実入力が届く場所がない`);
        if (touch) await page.touchscreen.tap(point.x, point.y); else await page.mouse.click(point.x, point.y);
        const sample = await page.evaluate(() => QA.lastPick);
        assert.equal(sample.phase, phase);
        assert.equal(sample.storedPhase, phase);
        assert.equal(sample.count, `${i + 1} / ${count}`);
        assert.equal(sample.originals.length, 4);
        assert.deepEqual(sample.originals, sample.stored, "回収しても同じ炭素材を保持する");
        assert.equal(sample.rating, grade[0]);
        assert.equal(sample.stamps, 1, "連続評価は差し替えられる");
        assert.equal(sample.stamp, phase === "just" ? "EXCELLENT" : grade[0]);
        assert.deepEqual(sample.geometry, { separate: true, stripInside: true, carrierInside: true, separated: true,
          textInside: true, accessible: true, pointer: "none", floating: 0 }, `${label}: ${JSON.stringify(sample.geometry)}`);
        if (shots && (i === count - 1 || phase === "just")) {
          await page.waitForTimeout(270); await page.screenshot({ path: `${shots}/${label}-${i + 1}.png` });
        }
      }
      if (compact) {
        await page.waitForFunction(() => cs.careCoals?.count > 0);
        assert.deepEqual(await page.evaluate(() => cs.careCoals.picks), expected.map(g => g.phase));
        assert.equal(await page.evaluate(() => JSON.stringify(cs.heat)), await page.evaluate(() => QA.originalHeat));
      } else {
        await page.waitForSelector('[data-test="step-summary"]');
        const result = await page.evaluate(() => ({ score: cs.heat.score,
          phases: cs.heat.picks, ratings: cs.heat.timings.map(t => t.rating),
          accuracy: cs.heat.timingAccuracy }));
        const score = Math.round(expected.reduce((sum, g) => sum + g.score, 0) / count);
        assert.deepEqual(result, { score, phases: expected.map(g => g.phase), ratings: expected.map(g => g.rating), accuracy: score });
        if (excellentOnly) assert.deepEqual(await page.locator(".heat-bonus").allTextContents(), ["HEAT STABLE", "AROMA KEEP"]);
        await page.waitForSelector(".result-card.show");
        await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => QA.run);
      }
      assert.equal(await page.evaluate(() => JSON.stringify(QA.core.state)), await page.evaluate(() => QA.before), "UI/工程単体の検証で保存状態を変えない");
      assert.deepEqual(errors, []);
      console.log(`PASS heat feedback ${label}: real input, rating/score, non-overlap, bounds, state unchanged`);
      await page.close();
    }
  }
} finally { await browser.close(); }
