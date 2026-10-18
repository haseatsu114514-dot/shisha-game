// #662: reproducible real DOM captures; identical seed/session/viewport before and after.
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";

const baseline = process.env.CAPTURE_BASELINE === "1";
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const scenarios = {
  mix: ['steps', 'stepMix', '.mix'],
  pack: ['steps', 'stepPack', '.packing'],
  holes: ['holes', 'runHoles', '[data-test="hole-start"]'],
  place: ['steps', 'stepPlace', '.opt-grid'],
  heat: ['heat', 'runHeat', '[data-test="coal-0"]'],
  timer: ['timer', 'runSteamTimer', '[data-test="timer-start"]'],
  steam: ['steam', 'runSteamDodge', '[data-test="dodge"]'],
  pull: ['pull', 'runPull', '.pull'],
  care: ['pull', 'runCare', '.care-coals'],
};

async function prepare(page, mode = "rehearsal") {
  await page.evaluate(async mode => {
    let seed = 662;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    const core = await import('./js/core/state.js'); core.newGame();
    core.state.weatherSeed = 662;
    window.G = { core };
    for (const name of ['session', 'steps', 'holes', 'heat', 'timer', 'steam', 'pull', 'practice']) G[name] = await import(`./js/craft/${name}.js`);
    G.cs = G.session.newSession(mode);
    Object.assign(G.cs, { mix: { double_apple: 10, mint: 2 }, pack: 'normal', place: 'triangle',
      holes: { total: 24, outer: 24, middle: 0, inner: 0 }, heat: { heatPower: 50 },
      steamSeconds: 300, steam: { temp: .48, score: 80 }, steamVariation: { offset: 0, transfer: 1 } });
    G.cs.mixInfo = G.steps.evaluateMix(G.cs);
    await G.session.openBench(G.cs, { steps: G.practice.CRAFT_STEPS }).ready;
    // Freeze game performance time, not loading/countdown timers. This is test-only.
    Object.defineProperty(performance, 'now', { configurable: true, value: () => 1000 });
    const raf = requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => raf(() => callback(1000));
  }, mode);
}

await suite('craft-guidance', async check => {
  for (const [device, options] of [['pc', { reducedMotion: 'reduce' }],
    ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }]]) {
    for (const [step, [module, method, selector]] of Object.entries(scenarios)) {
      await check(`${device}-${step}`, async page => {
        await prepare(page);
        await page.evaluate(({ module, method, step }) => {
          if (step === 'mix') G.cs.mix = {};
          if (step === 'timer') G.cs.steamSeconds = null;
          G.running = G[module][method](G.cs);
        }, { module, method, step });
        await page.locator(selector).first().waitFor();
        await page.locator('.countdown').waitFor({ state: 'detached' });
        await page.waitForFunction(() => !document.querySelector('.bench').inert);
        await page.evaluate(() => document.fonts.ready);
        if (!baseline) {
          await assertFits(page, '.bench-heading, .bench-hint');
          assert((await page.locator('.bench-hint').textContent()).trim().length > 0, 'Missing current instruction');
          const overlaps = await page.evaluate(() => {
            const a = document.querySelector('.bench-head').getBoundingClientRect();
            const b = document.querySelector('.bench-panel').getBoundingClientRect();
            return a.bottom > b.top + 1;
          });
          assert(!overlaps, 'Help/instructions overlap play area');
        }
        if (step === 'holes') {
          const chosen = page.locator('[data-test="hole-template-outer12-middle12"]');
          if (device === 'touch') await chosen.tap(); else await chosen.click();
          assert.equal(await chosen.getAttribute('aria-pressed'), 'true');
          assert.match(await page.locator('[data-test="hole-preview"]').getAttribute('aria-label'), /12/);
        }
        if (shots) await page.screenshot({ path: `${shots}/${device}-${step}.png`, animations: 'disabled' });
      }, options);
    }
  }
});
