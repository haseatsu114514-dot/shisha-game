// 比較資料用。実ゲームの成功画面と、手動再生の停止／再開動画を保存する。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const url = process.env.CUTIN_PREVIEW_URL || 'http://127.0.0.1:8125/craft-cutin-placement/tools/browser/craft_cutin_preview.html';
const out = process.env.SHOTS || path.resolve(__dirname, '../../asset_sources/craft-success-cutins/placements-v2-20261008/review');
fs.mkdirSync(out, { recursive:true });
async function boot(page, step = 'heat') {
  await page.goto(url); await page.waitForFunction(() => window.cutinDemo?.effect);
  if (step !== 'heat') {
    await page.selectOption('#step',step);
    await page.waitForFunction(step => cutinDemo?.window.__cutinStep === step,step);
  }
  return page.frames().find(f => f.parentFrame());
}
async function main() {
  const browser = await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium'});
  const errors = [], temp = fs.mkdtempSync(path.join(os.tmpdir(),'craft-cutin-video-'));
  try {
    const context = await browser.newContext({viewport:{width:1324,height:1040},recordVideo:{dir:temp,size:{width:1324,height:1040}}});
    const page = await context.newPage(); page.on('pageerror',e => errors.push(e.message));
    const started = Date.now(), frame = await boot(page,'pull');
    await frame.waitForFunction(() => !!document.querySelector('.pg-needle')?.style.left);
    await page.selectOption('#variant','center');
    const trim = (Date.now() - started) / 1000;
    await page.waitForTimeout(600);
    for (const variant of ['center','full','center','full']) {
      await page.selectOption('#variant',variant); await page.click('#play');
      await page.waitForFunction(() => cutinDemo.effect.active === null);
      await page.waitForTimeout(700);
    }
    const duration = (Date.now() - started) / 1000 - trim;
    const video = page.video(); await context.close(); const raw = await video.path();
    execFileSync('ffmpeg',['-loglevel','error','-y','-ss',String(trim),'-i',raw,'-t',String(duration),'-c:v','libx264','-preset','fast','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',path.join(out,'center-and-full-pause.mp4')]);
    const shots = await browser.newPage({viewport:{width:1324,height:980}}); shots.on('pageerror',e => errors.push(e.message));
    for (const size of [{name:'desktop',width:1280,height:720},{name:'mobile-landscape',width:844,height:390},{name:'mobile-portrait',width:390,height:844}]) {
      await shots.setViewportSize({width:size.width+44,height:size.height+340});
      const f = await boot(shots);
      await shots.locator('main').evaluate(n => n.style.maxWidth = 'none');
      await shots.locator('.frame').evaluate((n,size) => Object.assign(n.style,{width:`${size.width}px`,height:`${size.height}px`,aspectRatio:'auto'}),size);
      await f.waitForFunction(() => document.querySelector('[data-test="coal-0"]')?.dataset.phase === 'just');
      await shots.evaluate(() => cutinDemo.clock.pause());
      await f.locator('[data-test="coal-0"]').click();
      if (await f.locator('[data-test="coal-timing-0"]').getAttribute('data-rating') !== 'PERFECT') throw new Error('capture lost the PERFECT timing');
      await f.waitForFunction(() => [...document.querySelectorAll('.worker-actor,.audience-face img')].every(i => i.complete && i.naturalWidth));
      await shots.waitForTimeout(500);
      for (const variant of ['center','full',...(size.name === 'desktop' ? ['pair','peek','window'] : [])]) {
        await shots.evaluate(variant => { cutinDemo.clock.pause(); cutinDemo.effect.show(variant,{hold:true}); },variant);
        await f.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
        await shots.locator('.frame').screenshot({path:path.join(out,`${variant}-${size.name}.png`)});
        await shots.evaluate(() => cutinDemo.effect.hide());
      }
    }
    if (errors.length) throw new Error(errors.join('\n'));
    fs.writeFileSync(path.join(out,'capture-validation.json'),JSON.stringify({url,video:'center-and-full-pause.mp4',videoDurationSeconds:duration,variants:['center','full'],allShotsAfterGoldFlash:true,actualHeatRating:'PERFECT',browserErrors:errors},null,2)+'\n');
    console.log(`Saved nine game captures and ${duration.toFixed(1)}s pause/restart video`);
  } finally { await browser.close(); fs.rmSync(temp,{recursive:true,force:true}); }
}
main().catch(e => {console.error(e);process.exitCode=1;});
