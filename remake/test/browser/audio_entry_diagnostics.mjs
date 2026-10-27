// Caller-run only. No real profile, save writes, external services or audio assertions weakened.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
try {
  for (const touch of [false, true]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, hasTouch: touch, isMobile: touch });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.audioTrace = []; window.audioContexts = []; window.audioGains = []; let serial = 0, active = 0;
      const AC = window.AudioContext;
      for (const method of ['createBufferSource', 'createOscillator']) {
        const native = AC.prototype[method];
        AC.prototype[method] = function (...args) {
          if (!audioContexts.includes(this)) audioContexts.push(this);
          const ctx = this, node = native.apply(this, args), start = node.start, id = ++serial;
          node.start = function (...times) {
            active++;
            audioTrace.push({ event: 'start', id, method, state: ctx.state, audioTime: ctx.currentTime,
              wallTime: performance.now(), times, active, mode: document.body.className,
              frames: node.buffer?.length, rate: node.buffer?.sampleRate });
            return start.apply(this, times);
          };
          node.addEventListener('ended', () => { active--; audioTrace.push({ event: 'end', id, active, audioTime: ctx.currentTime }); });
          return node;
        };
      }
      const gain = AC.prototype.createGain;
      AC.prototype.createGain = function () {
        const node = gain.call(this); audioGains.push({ node, context: this }); return node;
      };
    });
    await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/', { waitUntil: 'domcontentloaded' });
    await page.locator('[data-test="title-new"]').waitFor();
    await page.evaluate(async () => {
      window.qaAudio = await import('./js/core/audio.js');
      window.qaConfig = (await import('./js/core/state.js')).config;
      qaConfig.bgmVolume = 0; qaConfig.seVolume = .8; qaAudio.stopBgm(0); qaAudio.applyVolumes();
      const button = document.createElement('button'); button.id = 'audio-qa-unlock'; button.textContent = 'Audio QA';
      Object.assign(button.style, { position: 'fixed', top: '0', left: '0', zIndex: 99999 });
      button.onclick = () => { qaAudio.unlockAudio(); qaAudio.SE.click(); };
      document.body.append(button);
    });
    if (touch) await page.locator('#audio-qa-unlock').tap(); else await page.locator('#audio-qa-unlock').click();
    await page.evaluate(() => qaAudio.preloadSe());
    const entryResults = await page.evaluate(async () => {
      const ui = await import('./js/core/ui.js'), transitions = await import('./js/core/transitions.js');
      const original = qaAudio.SE.doorbell; let rings = 0;
      qaAudio.SE.doorbell = () => { rings++; original(); };
      const results = [], home = '../assets/backgrounds/bg_home.png', shop = '../assets/backgrounds/bg_tonari_inside_day.png';
      try {
        for (const mode of ['normal', 'instant', 'skip', 'cover', 'wipe']) {
          await ui.setBg(home, { instant: true });
          document.body.classList.toggle('vn-skip', mode === 'skip');
          const release = mode === 'cover' ? transitions.holdCover() : () => {};
          if (mode === 'wipe') ui.layers.wipe.classList.add('cover');
          transitions.cueTransition('place', { spotId: 'tonari' }); const before = rings;
          await ui.setBg(shop, { instant: mode === 'instant' });
          release(); ui.layers.wipe.classList.remove('cover'); document.body.classList.remove('vn-skip');
          results.push({ mode, rings: rings-before });
        }
        const before = rings;
        transitions.cueTransition('place', { spotId: 'tonari' });
        await ui.setBg(shop); await ui.setBg(home, { instant: true }); await ui.setBg(shop, { instant: true });
        results.push({ mode: 'redraw-restore-stale', rings: rings-before });
      } finally { qaAudio.SE.doorbell = original; }
      return results;
    });
    console.log(JSON.stringify({ touch, entryResults }));
    for (const result of entryResults) assert.equal(result.rings, result.mode === 'redraw-restore-stale' ? 0 : 1, result.mode);
    const report = await page.evaluate(async () => {
      const probes = audioGains.map(({node, context}, index) => {
        const analyser = context.createAnalyser(); analyser.fftSize = 2048; node.connect(analyser);
        return { analyser, context, index, gain: node.gain.value };
      });
      const rows = [];
      const stop = qaAudio.startBubbling({ strength: .65 });
      for (let i = 0; i < 12; i++) {
        await new Promise(r => setTimeout(r, 50));
        rows.push(probes.map(({analyser, context, index, gain}) => {
          const a = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(a);
          return { index, gain, state: context.state, time: context.currentTime,
            rms: Math.sqrt(a.reduce((s,x) => s+x*x,0)/a.length), peak: Math.max(...a.map(Math.abs)), samples: [...a.slice(0,16)] };
        }));
      }
      stop();
      for (const id of ['click', 'blip', 'phoneReceive', 'phoneSend']) { qaAudio.SE[id](); await new Promise(r => setTimeout(r, 250)); }
      probes.forEach(({analyser}) => analyser.disconnect());
      return { hidden: document.hidden, rows, trace: audioTrace };
    });
    console.log(JSON.stringify({ touch, report }));
    assert(report.rows.some(row => row.some(p => p.state === 'running' && p.rms > .0001)), 'real samples required; inspect state/time/all gain probes on failure');
    await context.close();
  }
} finally { await browser.close(); }
