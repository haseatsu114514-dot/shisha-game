// シーシャ作りの工程を、本番（大会）と同じセッション・同じ工程関数で1つずつ開くための共通部品
const { sleep } = require('./common.cjs');

async function initCraft(page, { mode = 'tournament', mix = null, extra = '' } = {}) {
  await page.evaluate(async ({ mode, mix, extra }) => {
    const core = await import('./js/core/state.js');
    const s = core.newGame();
    Object.assign(s, { phase: mode === 'tournament' ? 'tournament' : 'daily', day: mode === 'tournament' ? 14 : 8, slot: 0 });
    s.flavorStock = { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 };
    s.flavors = ['double_apple', 'mint', 'blueberry', 'lemon'];
    for (const id of ['sumi', 'naru', 'adam', 'minto', 'sui', 'maezono', 'dr_kemuri', 'tsumugi']) s.met[id] = true;
    window.T = { core,
      data: await import('./js/core/data.js'),
      ui: await import('./js/core/ui.js'),
      session: await import('./js/craft/session.js'),
      steps: await import('./js/craft/steps.js'),
      holes: await import('./js/craft/holes.js'),
      heat: await import('./js/craft/heat.js'),
      steam: await import('./js/craft/steam.js'),
      pull: await import('./js/craft/pull.js'),
      practice: await import('./js/craft/practice.js'),
      broadcast: await import('./js/craft/broadcast.js'),
      chapter: await import('./js/chapters/ch1.js'),
      audio: await import('./js/core/audio.js'),
    };
    T.chapter.setupHooks();
    T.ui.clearScreen();
    if (extra) new Function('T', 's', extra)(T, s);
    T.session.craftTest.auto = null;
    const cs = window.cs = T.session.newSession(mode);
    if (mix) cs.mix = mix;
    const b = T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
    while (!b.root.isConnected) await new Promise(requestAnimationFrame);
    await T.session.waitBenchReady(cs);
  }, { mode, mix, extra });
}

const visibleTests = (page) => page.evaluate(() => [...document.querySelectorAll('#stage [data-test]')].filter(n => n.offsetParent).map(n => n.dataset.test).join(' '));
const panelText = (page) => page.evaluate(() => document.querySelector('.bench-panel')?.innerText.replace(/\n+/g, ' / ').slice(0, 600));

module.exports = { initCraft, visibleTests, panelText, sleep };

// 指定の工程まで自動（上手）で進め、その工程だけ手動にする。工程の順は本番と同じ。
async function runUntil(page, target, { mix = { lemon: 7, mint: 3, blueberry: 2 } } = {}) {
  await page.evaluate(async ({ target, mix }) => {
    const order = ['setup', 'mix', 'pack', 'holes', 'place', 'heat', 'timer', 'steam', 'pull', 'care1', 'care2'];
    const fns = {
      setup: () => T.steps.stepSetup(cs),
      mix: async () => { T.broadcast.block(cs, 'mix'); await T.steps.stepMix(cs); },
      pack: async () => { T.broadcast.block(cs, 'pack'); await T.steps.stepPack(cs); },
      holes: async () => { T.broadcast.block(cs, 'foil'); await T.holes.runHoles(cs); },
      place: () => T.steps.stepPlace(cs),
      heat: async () => { T.broadcast.block(cs, 'coalfire'); await T.heat.runHeat(cs); },
      timer: () => T.steps.stepSteamTime(cs),
      steam: async () => { T.broadcast.block(cs, 'steam'); await T.steam.runSteamDodge(cs); },
      pull: async () => { T.broadcast.block(cs, 'pull'); await T.pull.runPull(cs); },
      care1: async () => { T.broadcast.block(cs, 'adjust'); await T.pull.runCare(cs, { round: 1 }); },
      care2: async () => { T.broadcast.block(cs, 'adjust'); await T.pull.runCare(cs, { round: 2 }); },
    };
    window.stepNow = '';
    window.runAll = (async () => {
      for (const id of order) {
        window.stepNow = id;
        T.session.craftTest.auto = order.indexOf(id) < order.indexOf(target) ? 'good' : null;
        window.stepManual = !T.session.craftTest.auto;
        await fns[id]();
        window.stepDone = id;
      }
    })().catch(e => { window.runError = String(e.stack || e); console.error(window.runError); });
  }, { target, mix });
  await page.waitForFunction(() => window.stepManual === true || window.runError, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.runError);
  if (err) throw new Error(err);
}

module.exports.runUntil = runUntil;

// アルミを使うHMD（店で買えるタヌキッシュリッド）を持っている状態。大会でも穴あけの工程が入る。
const FOIL_HMD = "s.owned.push('tanukish_lid'); s.equip.hms = 'tanukish_lid';";
module.exports.FOIL_HMD = FOIL_HMD;

// 穴あけ: 針が光る目印に重なった瞬間に押し、少し押し込んで離す（本番と同じ pointer 入力）
async function punchHoles(page, n, { hold = 260 } = {}) {
  return page.evaluate(async ({ n, hold }) => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const disc = document.querySelector('[data-test="foil"]');
    const center = (node) => { const r = node.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
    let done = 0;
    for (let i = 0; i < n; i++) {
      const next = document.querySelector('[data-test="hole-next"]');
      if (next && !next.disabled) { next.click(); await sleep(500); }
      const ok = await new Promise(resolve => {
        const deadline = performance.now() + 6000;
        const seek = () => {
          const cursor = document.querySelector('[data-test="hole-needle"]');
          const marker = document.querySelector('.foil-marker.next');
          if (cursor && marker && !cursor.hidden) {
            const [cx, cy] = center(cursor), [mx, my] = center(marker);
            if (Math.hypot(cx - mx, cy - my) < 2.2) {
              disc.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
              return resolve(true);
            }
          }
          if (performance.now() > deadline) return resolve(false);
          requestAnimationFrame(seek);
        };
        requestAnimationFrame(seek);
      });
      if (!ok) break;
      await sleep(hold);
      disc.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
      done++;
      await sleep(180);
    }
    return { done, feedback: document.querySelector('[data-test="hole-feedback"]')?.textContent, ring: document.querySelector('.hr-ring')?.textContent };
  }, { n, hold });
}
module.exports.punchHoles = punchHoles;

// 炭焼き: 全面が赤くなった（data-phase="just"）炭をその場で取り上げる。取るたびに window.coalPicked が増える
async function armCoalPicker(page, { delay = 60 } = {}) {
  await page.evaluate(({ delay }) => {
    window.coalPicked = 0;
    const tick = () => {
      const coals = [...document.querySelectorAll('[data-test^="coal-"]')].filter(n => /^coal-\d+$/.test(n.dataset.test));
      for (const c of coals) {
        if (c.dataset.phase === 'just' && !c.classList.contains('picked') && !c.dataset.armed) {
          c.dataset.armed = '1';
          setTimeout(() => { c.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })); window.coalPicked++; }, delay);
        }
      }
      if (coals.length && coals.every(c => c.classList.contains('picked'))) return;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, { delay });
}
module.exports.armCoalPicker = armCoalPicker;
