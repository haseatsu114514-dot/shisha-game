// Review artifacts for the four-person CIG07 pilot. Run with NODE_PATH=remake/test/browser/node_modules.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const out = process.env.ARTIFACT_DIR || '/tmp/intro-motion-review';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium', headless: true });
const ids = ['naru','rin','nagumo','pakki'];
const report = [];
async function prepare(page, id) {
  await page.goto(`${process.env.BASE_URL || 'http://127.0.0.1:8123'}/remake/character-intros-preview.html?character=${id}`);
  await page.locator('#play:enabled').waitFor();
  await page.evaluate(async id => {
    const data = await import('./js/core/data.js');
    const ui = await import('./js/core/ui.js');
    window.captureIntro = (await import('./js/vn/intro.js')).playIntro;
    const p = data.portraitInfo(id, data.DB.characters[id].intro_cutin.face || 'normal');
    const portrait = new Image(); portrait.src = p.src; portrait.className = 'portrait active'; portrait.dataset.speaker = id;
    portrait.style.cssText = 'height:680px;bottom:0;left:30%;--ax:-50%';
    await portrait.decode(); document.querySelector('#preview-portraits').replaceChildren(portrait);
    await Promise.all([ui.imageReady(`img/ui/character_intros/graphic/${id}.webp`,15000),
      ui.imageReady(`img/ui/character_intros/graphic/bg_${id}.webp`,15000),document.fonts.ready]);
    await document.fonts.load('900 150px "Intro Gothic"');
  }, id);
}
try {
  for (const id of ids) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await context.newPage();
    await prepare(page, id);
    await page.addStyleTag({ content: '.cutin,.cutin * {transition:none!important}' });
    // Freeze JS timers and explicitly seek WAAPI: exact requested frame times, no screenshot latency drift.
    const epoch = new Date('2026-11-01T00:00:00Z');
    await page.clock.install({ time: epoch });
    await page.clock.pauseAt(epoch);
    await page.evaluate(() => {
      const native = Element.prototype.animate;
      window.captureAnimations = [];
      Element.prototype.animate = function(frames, options) {
        const animation = native.call(this, frames, options); animation.pause();
        captureAnimations.push({ animation, at: performance.now() }); return animation;
      };
      window.captureDone = captureIntro(document.querySelector('#character').value);
    });
    // Let cached resource/font promises settle without advancing the animation clock.
    await page.waitForFunction(() => document.querySelector('.ci-transition'));
    const start = await page.evaluate(() => performance.now());
    let prior = 0;
    for (const ms of [0,150,300,600,1500]) {
      if (ms > prior) await page.clock.runFor(ms - prior);
      await page.evaluate(() => {
        for (const { animation, at } of captureAnimations) if (animation.playState !== 'idle') animation.currentTime = performance.now() - at;
      });
      await page.screenshot({ path: `${out}/${id}-${ms}ms.png` });
      report.push({ id, requestedMs: ms, actualMs: await page.evaluate(start => performance.now() - start, start) });
      prior = ms;
    }
    await context.close();
    const videoContext = await browser.newContext({ viewport: { width: 1280, height: 860 }, recordVideo: { dir: out, size: { width: 1280, height: 860 } } });
    const videoPage = await videoContext.newPage();
    await prepare(videoPage, id);
    await videoPage.locator('#play').click();
    await videoPage.locator('#status').filter({ hasText: '再生終了' }).waitFor();
    await videoPage.waitForTimeout(300);
    const video = videoPage.video();
    await videoContext.close();
    await video.saveAs(`${out}/${id}-motion.webm`);
    await video.delete();
    console.log(`Captured ${id}: 5 exact frames + video`);
  }
  await writeFile(`${out}/timing.json`, JSON.stringify(report,null,2));
} finally { await browser.close(); }
