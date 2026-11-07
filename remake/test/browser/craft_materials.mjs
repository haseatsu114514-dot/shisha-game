// #533: 見比べて確定・針穴の残留・目印と光の分離を本番の工程で操作する。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits, storageSnapshot, baseURL } from "./support.mjs";
const shots = process.env.SHOTS;
const ngMixes = JSON.parse(fs.readFileSync(new URL("../../../data/ng_mixes.json", import.meta.url), "utf8")).ng_mixes;
const flavors = JSON.parse(fs.readFileSync(new URL("../../../data/flavors.json", import.meta.url), "utf8")).flavors;
const ngCase = ng => Object.fromEntries(ng.flavors.map(family => [
  flavors.find(flavor => flavor.family === family && flavor.id !== family)?.id || family, 6,
]));
if (shots) fs.mkdirSync(shots, { recursive: true });
const capture = async (page, name) => { if (shots) await page.screenshot({ path: `${shots}/${name}.png` }); };
const click = (page, selector, touch) => touch ? page.locator(selector).tap() : page.locator(selector).click();
async function demoKeyboardLoop(page) {
  await page.waitForFunction(() => document.activeElement?.classList.contains("bench-demo-skip"));
  await page.keyboard.press("Shift+Tab");
  assert.equal(await page.locator(".bench-demo-finish").evaluate(n => n === document.activeElement), true);
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(".bench-demo-skip").evaluate(n => n === document.activeElement), true);
  // Include native video controls when present, the text disclosure, and both close buttons.
  for (const key of ["Tab", "Shift+Tab"]) for (let i = 0; i < 16; i++) {
    await page.keyboard.press(key);
    assert.equal(await page.locator(".bench-demo-sheet").evaluate(n => n.contains(document.activeElement)), true, key);
  }
}
async function setup(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    window.F = { core, session: await import("./js/craft/session.js"), steps: await import("./js/craft/steps.js"),
      holes: await import("./js/craft/holes.js"), common: await import("./js/craft/common.js") };
    F.cs = F.session.newSession("tutorial"); F.cs.mix = { double_apple: 10, mint: 2 };
    await F.session.openBench(F.cs).ready;
  });
}
await suite("craft-materials", async check => {
  for (const [device, touch, options] of [["pc", false, {}], ["touch", true,
    { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, reducedMotion: "reduce" }]]) {
    await check(`${device}-chapter-five-exact-12g`, async page => {
      for (const bowl of ["silicone_bowl", "hagal_80beat", "suyaki_hagal"]) {
        await page.evaluate(async bowl => {
          const core = await import("./js/core/state.js"), session = await import("./js/craft/session.js");
          const steps = await import("./js/craft/steps.js"), ui = await import("./js/core/ui.js");
          const s = core.newGame(); s.chapter = 5;
          s.owned.push("hagal_80beat", "suyaki_hagal");
          ui.clearScreen(); session.craftTest.auto = null;
          window.F = { core, steps, session, cs: session.newSession("tournament") };
          F.cs.orderFlavorIds = ["double_apple"];
          session.openBench(F.cs, { steps: [["setup", "機材"], ["mix", "配合"]] });
          F.beforeStock = JSON.stringify(s.flavorStock);
          F.running = (async () => { await steps.stepSetup(F.cs); await steps.stepMix(F.cs); })();
        }, bowl);
        await click(page, `[data-test="opt-${bowl}"]`, touch);
        const plus = '[data-test="mix-plus-double_apple"]', minus = '[data-test="mix-minus-double_apple"]';
        const ok = page.locator('[data-test="mix-ok"]');
        await ok.waitFor();
        assert.equal(await page.locator('.flavor-row').count(), 1, "Only the supplied double apple is offered");
        for (let i = 0; i < 11; i++) await click(page, plus, touch);
        assert(await ok.isDisabled(), "11g is short");
        await click(page, plus, touch);
        assert(!(await ok.isDisabled()), "12g is valid");
        assert.match(await page.locator('.reg-line').innerText(), /^✓/);
        const cap = await page.evaluate(async () => (await import("./js/core/data.js")).DB.equipById[F.cs.equip.bowl].capacity);
        if (cap > 12) {
          for (let grams = 13; grams <= cap; grams++) {
            await click(page, plus, touch);
            assert(await ok.isDisabled(), `${grams}g must not commit`);
            assert.match(await page.locator('.reg-line').innerText(), /^✗/);
          }
          for (let grams = cap; grams > 12; grams--) await click(page, minus, touch);
        }
        assert(!(await ok.isDisabled()), "Returning to 12g restores confirmation");
        await click(page, '[data-test="mix-ok"]', touch);
        const result = await page.evaluate(async () => {
          await F.running;
          return { mix: F.cs.mix, regOk: F.cs.mixInfo.regOk, stock: JSON.stringify(F.core.state.flavorStock), beforeStock: F.beforeStock };
        });
        assert.deepEqual(result.mix, { double_apple: 12 }); assert.equal(result.regOk, true);
        assert.equal(result.stock, result.beforeStock, "The supplied match leaf does not consume private stock");
      }
    }, { ...options, reducedMotion: "reduce" });
    // #1906-2: 評価は毎回更新するが、NG理由は確定後に1件だけ表示する。
    const ngSetup = async (page, ids, golden = false) => {
      await page.evaluate(async ({ ids, golden }) => {
        const core = await import("./js/core/state.js"), session = await import("./js/craft/session.js");
        const steps = await import("./js/craft/steps.js"), ui = await import("./js/core/ui.js");
        const { DB } = await import("./js/core/data.js");
        core.newGame();
        if (golden) DB.recipes = [...DB.recipes, { id: "test_ng_golden", name: "NG併存fixture", flavors: ["mint", "vanilla"], golden: { mint: 1, vanilla: 1 } }];
        const cs = session.newSession("drill");
        cs.equip.bowl = "suyaki_tsumugi"; cs.orderFlavorIds = ids;
        await session.openBench(cs).ready;
        ui.layers.toasts.replaceChildren();
        window.NG?.observer?.disconnect();
        const seen = [];
        const observer = new MutationObserver(records => {
          for (const r of records) for (const n of r.addedNodes) if (n.matches?.(".toast")) seen.push(n.textContent);
        });
        observer.observe(ui.layers.toasts, { childList: true });
        window.NG = { core, cs, seen, observer, reasons: DB.ngMixes.map(ng => ng.text), run: steps.stepMix(cs).then(() => "done", e => e.name) };
      }, { ids, golden });
      await page.locator(`[data-test="mix-plus-${ids[0]}"]`).waitFor();
    };
    const changeGrams = async (page, id, grams) => {
      for (let i = 0; i < Math.abs(grams); i++) await click(page, `[data-test="mix-${grams > 0 ? "plus" : "minus"}-${id}"]`, touch);
    };
    const ngNotices = page => page.evaluate(() => NG.seen.filter(text => NG.reasons.includes(text)));
    await check(`${device}-ng-family-confirmation`, async page => {
      assert.equal(ngMixes.length, 6, "Current NG catalog has six entries");
      for (const [mix, expected, golden] of [
        [{ mint: 6, vanilla: 6 }, 1, false],
        [{ dobaj_mint: 6, vanilla: 6 }, 1, false],
        [{ mint: 2, dobaj_mint: 2, absal_mint: 2, vanilla: 6, coconut: 6 }, 3, false],
        [{ dobaj_mint: 6, vanilla: 6 }, 1, true],
        ...ngMixes.map(ng => [ngCase(ng), 1, false]),
      ]) {
        await ngSetup(page, Object.keys(mix), golden);
        for (const [id, g] of Object.entries(mix)) await changeGrams(page, id, g);
        assert.deepEqual(await ngNotices(page), [], "Changing grams must not reveal NG reasons");
        assert.equal(await page.evaluate(() => NG.cs.mixInfo), null);
        await click(page, '[data-test="mix-ok"]', touch);
        assert.equal(await page.evaluate(() => NG.run), "done");
        const info = await page.evaluate(() => NG.cs.mixInfo);
        assert.equal(info.ngReasons.length, expected, "All matching NG penalties remain in the evaluation");
        assert.deepEqual(await ngNotices(page), [info.ngReasons[0]], "Show only the first existing reason, not recipe/balance notes");
        assert.equal(await page.locator("#toasts .toast").filter({ hasText: info.ngReasons[0] }).count(), 1);
        if (golden) {
          assert.equal(info.golden, "hit");
          assert(await page.locator("#toasts .toast").filter({ hasText: "黄金比！" }).isVisible(), "Golden and NG notices coexist");
        }
      }
    }, { ...options, reducedMotion: "reduce" });
    await check(`${device}-ng-withdraw-and-cancel`, async page => {
      await ngSetup(page, ["dobaj_mint", "vanilla", "lemon"]);
      await changeGrams(page, "dobaj_mint", 6); await changeGrams(page, "vanilla", 6);
      await changeGrams(page, "vanilla", -6); await changeGrams(page, "lemon", 6);
      assert.deepEqual(await ngNotices(page), []);
      await click(page, '[data-test="mix-ok"]', touch);
      assert.equal(await page.evaluate(() => NG.run), "done");
      assert.deepEqual(await page.evaluate(() => NG.cs.mixInfo.ngReasons), [], "A removed NG mix must not leave a stale reason");
      assert.deepEqual(await ngNotices(page), []);

      await ngSetup(page, ["dobaj_mint", "vanilla"]);
      await changeGrams(page, "dobaj_mint", 6); await changeGrams(page, "vanilla", 6);
      const before = await storageSnapshot(page);
      await page.evaluate(() => { NG.core.newGame(); NG.afterLoad = JSON.stringify(NG.core.state); });
      // Load/new game invalidates this pending step; a late confirmation cannot report its old NG.
      await click(page, '[data-test="mix-ok"]', touch);
      assert.equal(await page.evaluate(() => NG.run), "AbortError");
      assert.deepEqual(await ngNotices(page), []);
      assert.equal(await page.evaluate(() => JSON.stringify(NG.core.state)), await page.evaluate(() => NG.afterLoad));
      assert.deepEqual(await storageSnapshot(page), before);
      assert.equal(await page.evaluate(() => NG.cs.mixInfo), null);
    }, { ...options, reducedMotion: "reduce" });
    await check(`${device}-packing`, async page => {
      await setup(page);
      // 心得の盤（通常プレイの既定・SBD97）ではデンスパックはスキル K18 で覚える。3種類の詰め方を比べるため覚えた状態にする
      // （覚える前に押せないことは growth_levelup.mjs の dense-pack-new-and-legacy が確かめる）
      await page.evaluate(async () => {
        const g = await import("./js/core/growth.js");
        if (g.growthEnabled() && !g.ensureGrowth().nodes.includes("K18")) g.ensureGrowth().nodes.push("K18");
      });
      for (const bowl of ["silicone_bowl", "hagal_80beat", "suyaki_tsumugi"]) {
        const before = await page.evaluate(bowl => {
          F.cs.equip.bowl = bowl; F.cs.pack = null;
          F.before = JSON.stringify(F.core.state); F.mix = JSON.stringify(F.cs.mix);
          F.running = F.steps.stepPack(F.cs);
          return { state: F.before, mix: F.mix };
        }, bowl);
        await page.locator('[data-test="pack-confirm"]').waitFor();
        const variants = [];
        for (const pack of ["normal", "fluffy", "firm"]) {
          await click(page, `[data-test="opt-${pack}"]`, touch);
          assert.equal(await page.locator(`[data-test="opt-${pack}"]`).getAttribute("aria-pressed"), "true");
          assert.equal(await page.locator('[data-test="pack-vessel"]').getAttribute("data-pack"), pack);
          assert.equal(await page.evaluate(() => F.cs.pack), null, "Comparing committed the choice");
          variants.push(await page.locator(".pack-vessel-art").evaluate(n => [...n.children].map(c => c.style.backgroundImage).join(" ")));
          await assertFits(page, ".pack-aroma, .pack-vessel-art, .pack-caption, .pack-choice, .pack-footer");
          if (bowl === "silicone_bowl" || pack === "normal") await capture(page, `${device}-pack-${bowl}-${pack}`);
        }
        assert.equal(new Set(variants).size, 3, "Leaf surfaces did not change");
        // Native keyboard confirmation also works; touch uses real pointer input.
        if (touch) await click(page, '[data-test="pack-confirm"]', true);
        else { await page.locator('[data-test="pack-confirm"]').focus(); await page.keyboard.press("Enter"); }
        await page.evaluate(() => F.running);
        assert.equal(await page.locator(".pack-choice:disabled").count(), 3, "Confirmed packing can still be changed on screen");
        const after = await page.evaluate(() => ({ pack: F.cs.pack, state: JSON.stringify(F.core.state), mix: JSON.stringify(F.cs.mix) }));
        assert.equal(after.pack, "firm"); assert.equal(after.state, before.state); assert.equal(after.mix, before.mix);
      }
    }, options);
    await check(`${device}-foil`, async page => {
      await setup(page);
      await page.evaluate(() => {
        F.clock = 1000;
        Object.defineProperty(performance, "now", { configurable: true, value: () => F.clock });
        const raf = requestAnimationFrame.bind(window); window.requestAnimationFrame = callback => raf(() => callback(F.clock));
        F.running = F.holes.runHoles(F.cs);
      });
      await click(page, '.bench-demo-skip', touch);
      await click(page, '[data-test="hole-template-outer12-middle12"]', touch);
      assert.equal(await page.locator('.ht-option').count(), 1);
      assert.equal(await page.locator(".ht-preview .foil-hole").count(), 0, "Template already has punched holes");
      assert.equal(await page.locator(".ht-preview .foil-marker").count(), 24);
      assert.match(await page.locator(".ht-preview .foil-surface").evaluate(n => n.style.backgroundImage), /foil_interactive_top/);
      const center = await page.locator('.ht-preview').evaluate(n => {
        const disc=n.getBoundingClientRect(), plane=n.querySelector('.foil-target-plane').getBoundingClientRect();
        return ((plane.top+plane.bottom)/2-disc.top)/disc.height;
      });
      assert(Math.abs(center-.47)<.001, 'Foil targets must sit above the lower crimped rim');
      await capture(page, `${device}-foil-template`);
      await click(page, '[data-test="hole-start"]', touch);
      await page.locator(".countdown").waitFor(); await page.locator(".countdown").waitFor({ state: "detached" });
      await assertFits(page, ".foil, .hr-side, .hr-punch, .hr-row");
      // #2937: 凡例・集計・採点の説明は「?」へ。基本画面には置かない。
      assert.equal(await page.locator(".foil-legend, .hr-score, .hr-combo, .hr-role").count(), 0, "Foil base screen must stay uncluttered");
      assert.equal(await page.locator('.bench-guide-extra[data-test="hole-guide"] li').count(), 6);
      // 針は狙う目印の手前の端から 0.4秒×slow で重なる。押して、時計を進めてから離す。
      const slow = await page.evaluate(() => F.common.skill.slow(F.cs) * 1.3);
      const advance = ms => page.evaluate(async ms => {
        F.clock += ms;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      }, ms);
      const pressHold = async (selector, ms, key = false) => {
        if (touch) {
          await page.locator(selector).dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
          await advance(ms);
          await page.locator(selector).dispatchEvent("pointerup", { pointerType: "touch", isPrimary: true });
        } else if (key) {
          await page.keyboard.down("Space"); await advance(ms); await page.keyboard.up("Space");
        } else {
          const box = await page.locator(selector).boundingBox();
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down(); await advance(ms); await page.mouse.up();
        }
      };
      for (let k = 0; k < 12; k++) {
        await advance(400 * slow);
        assert.equal(await page.locator(".foil-markers .foil-marker.next").count(), 1);
        const gap = await page.evaluate(() => {
          const a = document.querySelector(".foil-markers .next").getBoundingClientRect(), b = document.querySelector("[data-test=foil] .foil-cursor").getBoundingClientRect();
          return Math.hypot((a.left + a.right - b.left - b.right) / 2, (a.top + a.bottom - b.top - b.bottom) / 2);
        });
        assert(gap < 1, `Next marker disagrees with the scoring target: ${gap}px`);
        await pressHold('[data-test="hole-punch"]', 250, true);
      }
      assert.equal(await page.locator(".foil-holes .foil-hole.perfect").count(), 12);
      assert.equal(await page.locator(".foil-holes .foil-hole.small").count(), 12, "A moderate press must leave the standard small hole");
      assert(await page.locator('[data-test="hole-punch"]').isDisabled());
      assert(await page.locator('[data-test="foil"] .foil-cursor').isHidden());
      const locations = await page.locator(".foil-holes .foil-hole").evaluateAll(ns => ns.map(n => [n.style.left, n.style.top]));
      await capture(page, `${device}-foil-outer-complete`);
      await click(page, '[data-test="hole-next"]', touch);
      assert.deepEqual(await page.locator(".foil-holes .foil-hole").evaluateAll(ns => ns.map(n => [n.style.left, n.style.top])), locations);
      await advance(900 * slow); // 弧の奥の端で休んでいる針
      await pressHold('[data-test="foil"]', 250); // Off-target puncture: its mark must remain too.
      assert.equal(await page.locator(".foil-holes .foil-hole.miss").count(), 1);
      for (let k = 1; k <= 12; k++) {
        await advance(400 * slow);
        await pressHold('[data-test="hole-punch"]', 250);
        if (k === 3) await capture(page, `${device}-foil-punches`);
      }
      assert.equal(await page.locator(".foil-holes .foil-hole").count(), 25);
      assert.equal(await page.locator(".foil-markers .next").count(), 0);
      assert.equal(await page.locator(".worker-punch-dots ellipse").count(), 25, "Hand illustration lost the real holes");
      assert(!await page.locator('[data-test="hole-done"]').isDisabled());
      const finalBar = await page.locator('.hr-time-bar b').evaluate(n=>n.style.width);
      await page.evaluate(async () => {
        F.clock += 60000;
        await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      assert.equal(await page.locator('.hr-time-bar b').evaluate(n=>n.style.width),finalBar);
      assert.equal(await page.evaluate(()=>F.cs.holes),null,'Completed foil advanced without confirmation');
      assert.equal(await page.locator('[data-test="step-next"]').count(),0);
      await click(page, '[data-test="hole-done"]', touch);
      await page.waitForFunction(() => F.cs.holes !== null);
      const result = await page.evaluate(() => ({ template: F.cs.holes.templateId, outer: F.cs.holes.outer, middle: F.cs.holes.middle, inner: F.cs.holes.inner }));
      assert.deepEqual(result, { template: "outer12-middle12", outer: 12, middle: 13, inner: 0 });
      await click(page, '[data-test="step-next"]', touch);
      await page.evaluate(()=>F.running);
    }, options);
    await check(`${device}-preview-isolated`, async page => {
      await page.evaluate(() => { localStorage.setItem("craft-preview-sentinel", "keep"); sessionStorage.setItem("craft-preview-sentinel", "keep"); });
      const before = await storageSnapshot(page);
      await page.goto(new URL("craft-preview.html", baseURL).href);
      await page.locator('[data-test="pack-confirm"]').waitFor();
      await click(page, '[data-test="opt-fluffy"]', touch);
      await click(page, '[data-test="pack-confirm"]', touch);
      await click(page, '.bench-demo-skip', touch);
      await page.locator('[data-test="hole-start"]').waitFor();
      await page.locator('[data-preview-step="holes"]').click();
      await click(page, '.bench-demo-skip', touch);
      await page.locator('[data-test="hole-start"]').waitFor();
      assert.equal(await page.locator(".foil-cursor").count(), 0);
      await page.locator('[data-preview-step="pack"]').click();
      await page.locator('[data-test="pack-confirm"]').waitFor();
      assert.deepEqual(await storageSnapshot(page), before);
      await capture(page, `${device}-preview`);
    }, options);
  }
  await check("demo-reopen-keyboard-background", async page => {
    await page.route("**/media/demo-holes.mp4", route => route.fulfill({ contentType: "video/mp4", body: "invalid video fixture" }));
    await setup(page);
    await page.evaluate(() => { F.running = F.holes.runHoles(F.cs); });
    await page.locator(".bench-demo-skip").click();
    await page.locator('[data-test="hole-start"]').waitFor();
    await page.locator(".bench-guide > summary").click();
    await page.locator(".bench-demo-link").click();
    await page.waitForFunction(() => document.activeElement?.classList.contains("bench-demo-skip"));
    await page.keyboard.press("Shift+Tab");
    const escaped = await page.evaluate(() => !document.querySelector(".bench-demo-sheet").contains(document.activeElement));
    const target = await page.evaluate(() => document.activeElement?.getAttribute("data-test"));
    if (escaped && target === "bench-guide-close") {
      await page.keyboard.press("Enter");
      await page.waitForFunction(() => !document.querySelector(".bench-guide").open && !document.querySelector(".bench-panel").inert);
    }
    if (escaped) await page.locator(".bench-demo-skip").click();
    else {
      assert.equal(await page.locator(".bench-demo-finish").evaluate(n => n === document.activeElement), true);
      await page.keyboard.press("Enter");
    }
    await page.locator(".bench-demo-sheet").waitFor({ state: "detached" });
    const state = await page.evaluate(escaped => ({ escaped, guideOpen: document.querySelector(".bench-guide").open,
      panelInert: document.querySelector(".bench-panel").inert }), escaped);
    console.log("demo keyboard restoration", JSON.stringify({ target, ...state }));
    assert.equal(escaped, false, "Shift+Tab must not reach the background guide");
    assert.equal(state.guideOpen, true);
    assert.equal(state.panelInert, true, "The still-open guide keeps the work panel paused");
    await page.locator('[data-test="bench-guide-close"]').click();
    await page.waitForFunction(() => !document.querySelector(".bench-panel").inert);
  });
  // #2447: failure simulation is separate from verifying the packaged video's contents.
  for (const [device, touch, options] of [["pc", false, {}], ["touch", true,
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`demo-decode-error-${device}`, async page => {
      // A successful HTTP response with undecodable media exercises the real media error event.
      await page.route("**/media/demo-holes.mp4", route => route.fulfill({ contentType: "video/mp4", body: "invalid video fixture" }));
      await setup(page);
      await page.evaluate(() => { F.running = F.holes.runHoles(F.cs); });
      const sheet = page.locator(".bench-demo-sheet");
      await sheet.waitFor();
      await page.waitForFunction(() => document.querySelector(".bench-demo-stage")?.hidden);
      await demoKeyboardLoop(page);
      assert.match(await page.locator(".bench-demo-status").innerText(), /動画を再生できません/);
      assert.equal(await page.locator(".bench-demo-instructions").evaluate(n => n.open), true);
      const expected = await page.evaluate(async () => (await import("./js/craft/demo.js")).STEP_DEMOS.holes.cues.map(c => c.text));
      assert.deepEqual(await page.locator(".bench-demo-instructions li").allTextContents(), expected);
      const contrasts = await page.locator(".bench-demo-card").evaluate(card => {
        const luma = css => css.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => {
          const c = n / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
        }).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
        const bg = luma(getComputedStyle(card).backgroundColor);
        return [...card.querySelectorAll(".bench-demo-status, .bench-demo-instructions summary, .bench-demo-instructions li")].map(n => {
          const fg = luma(getComputedStyle(n).color);
          return { text: n.textContent, ratio: (Math.max(fg, bg) + .05) / (Math.min(fg, bg) + .05) };
        });
      });
      assert.equal(contrasts.length, 8);
      assert(contrasts.every(row => row.ratio >= 4.5), JSON.stringify(contrasts));
      await page.locator(".bench-demo-instructions summary").scrollIntoViewIfNeeded();
      await assertFits(page, ".bench-demo-instructions summary");
      await capture(page, `2447-demo-error-${device}`);
      await click(page, ".bench-demo-finish", touch);
      await sheet.waitFor({ state: "detached" });
      await page.locator('[data-test="hole-start"]').waitFor();
      assert.equal(await page.locator(".bench-panel").evaluate(n => n.inert), false);
      assert.equal(await page.locator(".bench").getAttribute("data-demo-paused"), null);
      // Reopen through the real help entry; skipping remains available after another error.
      await click(page, ".bench-guide > summary", touch);
      await click(page, ".bench-guide .bench-demo-link", touch);
      await sheet.waitFor();
      await demoKeyboardLoop(page);
      await click(page, ".bench-demo-skip", touch);
      await sheet.waitFor({ state: "detached" });
      assert.equal(await page.locator(".bench-demo-link").evaluate(n => n === document.activeElement), true);
      await click(page, '[data-test="bench-guide-close"]', touch);
      await page.waitForFunction(() => !document.querySelector(".bench-panel").inert);
    }, options);
    await check(`demo-stall-and-interrupt-${device}`, async page => {
      const pending = [];
      await page.route("**/media/demo-holes.mp4", route => { pending.push(route); });
      await setup(page);
      await page.evaluate(async () => {
        F.demo = await import("./js/craft/demo.js");
        F.beforeDemo = JSON.stringify(F.core.state);
        F.beforeDemoInert = [...document.querySelector(".bench").children].map(n => n.inert);
        F.plays = [];
        // Controlled promises/events test autoplay and delayed callbacks without relying on network timing.
        HTMLMediaElement.prototype.play = function () { return new Promise((resolve, reject) => F.plays.push({ resolve, reject })); };
        F.startDemo = () => F.demo.openDemoSheet(document.querySelector(".bench"), "holes");
        F.demoTask = F.startDemo();
      });
      await page.locator(".bench-demo-sheet").waitFor();
      await demoKeyboardLoop(page);
      assert.equal(await page.locator(".bench-demo-instructions li").count(), 6, "Instructions exist before any media event");
      await page.evaluate(() => F.plays[0].reject(new DOMException("fixture autoplay policy", "NotAllowedError")));
      await page.waitForFunction(() => document.querySelector(".bench-demo-status")?.textContent.includes("自動再生できません"));
      assert.equal(await page.locator(".bench-demo-stage").evaluate(n => n.hidden), false, "Manual video controls stay available");
      for (const type of ["stalled", "waiting"]) {
        await page.evaluate(type => document.querySelector(".bench-demo-stage video").dispatchEvent(new Event(type)), type);
        assert.match(await page.locator(".bench-demo-status").innerText(), /読み込みが止まっています/);
        assert.equal(await page.locator(".bench-demo-instructions").evaluate(n => n.open), true);
      }
      await page.evaluate(() => document.querySelector(".bench-demo-stage video").dispatchEvent(new Event("playing")));
      assert.match(await page.locator(".bench-demo-status").innerText(), /再生中/);
      await page.locator(".bench-demo-finish").scrollIntoViewIfNeeded();
      await assertFits(page, ".bench-demo-finish");
      await capture(page, `2447-demo-steps-${device}`);
      await page.evaluate(() => { F.oldFinish = document.querySelector(".bench-demo-finish"); });
      await click(page, ".bench-demo-finish", touch);
      assert.equal(await page.evaluate(() => F.demoTask), true);
      assert.deepEqual(await page.evaluate(() => [...document.querySelector(".bench").children].map(n => n.inert)),
        await page.evaluate(() => F.beforeDemoInert), "Restore every background element's previous inert state");
      await page.evaluate(() => { F.oldFinish.click(); F.oldFinish.click(); F.demoTask = F.startDemo(); });
      await page.locator(".bench-demo-sheet").waitFor();
      // Replacing the scene (as on LOAD) cancels the old sheet and its late promise safely.
      await page.evaluate(() => document.querySelector(".bench").remove());
      assert.equal(await page.evaluate(() => F.demoTask), false);
      await page.evaluate(() => F.plays[1].reject(new DOMException("late rejection", "NotAllowedError")));
      assert.equal(await page.locator(".bench-demo-sheet").count(), 0);
      assert.equal(await page.evaluate(() => JSON.stringify(F.core.state)), await page.evaluate(() => F.beforeDemo));
      for (const route of pending) await route.abort("aborted").catch(() => {});
    }, options);
  }
  await check("automatic-packing", async page => {
    await setup(page);
    await page.evaluate(async () => { F.session.craftTest.auto = "good"; await F.steps.stepPack(F.cs); F.session.craftTest.auto = null; });
    assert.equal(await page.evaluate(() => F.cs.pack), "normal");
  });
  // #2359: 実際の制作処理と素材で3サイズを撮影。縦長はデスクトップ窓で確認し、回転案内は改変しない。
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }, { width: 390, height: 844 }]) {
    for (const step of ["pack", "holes", "heat"]) await check(`night-${step}-${viewport.width}x${viewport.height}`, async page => {
      await setup(page);
      await page.evaluate(async step => {
        F.cs.mode = "drill";
        const heat = await import("./js/craft/heat.js");
        F.running = step === "pack" ? F.steps.stepPack(F.cs) : step === "holes" ? F.holes.runHoles(F.cs) : heat.runHeat(F.cs);
      }, step);
      await page.locator(step === "pack" ? '[data-test="pack-confirm"]' : step === "holes" ? '[data-test="hole-start"]' : '.heat[aria-busy="false"]').waitFor();
      if (step === "pack") {
        const paint = await page.locator('[data-test="pack-confirm"]').evaluate(n => {
          const s = getComputedStyle(n); return { background: s.backgroundColor, image: s.borderImageSource, width: s.borderTopWidth };
        });
        assert.deepEqual(paint, { background: "rgb(227, 189, 110)", image: paint.image, width: "14px" });
        assert.match(paint.image, /button-gold\.webp/);
      }
      if (step === "holes") {
        assert.equal(await page.locator('.ht-option[aria-pressed="true"]').evaluate(n => getComputedStyle(n).color), "rgb(46, 29, 69)");
      }
      assert.equal(await page.locator('.bench-worker-name').evaluate(n => getComputedStyle(n).backgroundImage), "none");
      // 外部画像が全て実画像としてデコード済みであることを確認する（placeholderは不可）。
      await page.waitForFunction(step => {
        const worker = document.querySelector('.bench-worker');
        const image = worker.querySelector('.worker-action:not([hidden])');
        return worker.dataset.scene === step && image?.complete && image.naturalWidth > 0
          && image.checkVisibility({ visibilityProperty: true });
      }, step);
      await capture(page, `night-${step}-${viewport.width}x${viewport.height}`);
    }, { viewport, reducedMotion: "reduce" });
  }

});
