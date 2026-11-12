// Review-only browser substitution; game sources and player saves are untouched.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const here = fileURLToPath(new URL('.', import.meta.url));
const { chromium, selectors } = createRequire(process.env.PLAYWRIGHT_PACKAGE || path.join(root, 'remake/test/browser/package.json'))('playwright');
selectors.setTestIdAttribute('data-test');
const base = process.env.BASE_URL || 'http://127.0.0.1:8127/';
const prefix = 'asset_sources/portraits/trpg-regulars-20261112/';
const metrics = JSON.parse(fs.readFileSync(path.join(here, 'metrics.json')));
const ids = Object.keys(metrics);
const frames = Object.fromEntries(ids.map(id => [id, metrics[id].trpg_face_frame_candidate]));
const out = path.join(here, 'qa'); fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_EXECUTABLE_PATH || '/usr/bin/chromium' });
const report = { baseMain: '3da1f351338b16b970a90215dfd141df09fdbff5', mode: 'local route overrides, candidate art and measured crops only', results: [] };
async function settle(page) {
  await page.locator('.trpg-entrance').waitFor({state:'detached',timeout:10000});
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.querySelectorAll('.trpg-root img')].filter(im=>im.offsetWidth>0).map(im=>im.decode()));
    await Promise.all(document.getAnimations().filter(a=>a.effect?.getTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  });
}
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.goto(base + 'remake/trpg-preview.html');
  await page.setContent(`<html><head><meta charset="utf-8"><style>
    body{margin:0;background:#eee;color:#222;font:16px sans-serif}h1{font-size:22px;margin:16px}
    .grid{display:grid;grid-template-columns:repeat(6,1fr)}.tile{text-align:center;padding:12px 0}
    .dark{background:#24383b;color:white}.white{background:white}.check{background:repeating-conic-gradient(#ddd 0% 25%,#fff 0% 50%) 0/20px 20px}
    .full{height:680px;max-width:100%;object-fit:contain}.icons img{height:64px;width:64px}.icons .small{height:32px;width:32px}
    </style></head><body><h1>TRPG常連A・B：未採用候補／透過・縮小の検品</h1><div class="grid">${['white','dark','check'].flatMap(bg => ids.map(id => `<div class="tile ${bg}"><p>${id} / ${bg}</p><img class="full" src="${base+prefix}delivery/chr_${id}_normal.png"><div class="icons"><img src="${base+prefix}delivery/face_${id}.png"><img class="small" src="${base+prefix}delivery/face_${id}.png"></div></div>`)).join('')}</div></body></html>`);
  await page.evaluate(() => Promise.all([...document.images].map(im => im.decode())));
  await page.screenshot({ path: path.join(out, 'alpha-and-small-faces.png'), fullPage: true });
  await page.close();

  for (const [label, viewport, touch] of [['pc',{width:1280,height:720},false],['touch',{width:844,height:390},true]]) {
    const context = await browser.newContext({ viewport, hasTouch:touch, isMobile:touch, deviceScaleFactor:1 });
    const page = await context.newPage(); const errors=[], failedResources=[];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if(r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`); });
    await page.route('**/js/trpg/regulars.js*', route => {
      let text=fs.readFileSync(path.join(root,'remake/js/trpg/regulars.js'),'utf8');
      text=text.replace('  const color =', `  return new URL('/${prefix}delivery/chr_' + id + '_normal.webp', location.origin).href;\n  const color =`);
      return route.fulfill({contentType:'text/javascript',body:text});
    });
    await page.route('**/js/trpg/presentation.js*', route => {
      let text=fs.readFileSync(path.join(root,'remake/js/trpg/presentation.js'),'utf8');
      text=text.replace('(headY - width / 6)', '(headY - .05 * width / (896 / 1200))').replace('return 0.125;', 'return .05;');
      return route.fulfill({contentType:'text/javascript',body:text});
    });
    await page.route('**/js/trpg/face-crops.js*', route => {
      let text=fs.readFileSync(path.join(root,'remake/js/trpg/face-crops.js'),'utf8');
      text=text.replace('  const folder = ALIASES', `  const candidateFrames = ${JSON.stringify(frames)};\n  if (candidateFrames[id]) return candidateFrames[id];\n  const folder = ALIASES`);
      return route.fulfill({contentType:'text/javascript',body:text});
    });
    const result={label,errors,failedResources,captured:[]}; report.results.push(result);
    try {
      await page.goto(base+'remake/trpg-preview.html?scenario=regular-harbor&seed=17');
      await page.waitForFunction(() => window.__trpg?.ready, {timeout:30000});
      await page.getByTestId('trpg-start').waitFor({timeout:15000});
      await settle(page);
      await page.screenshot({path:path.join(out,`${label}-cover.png`)}); result.captured.push('cover');
      await page.getByTestId('trpg-start').click();
      for(let i=0;i<90 && !ids.every(id=>result.captured.includes(id));i++) {
        const active=await page.locator('.trpg-stage-speaker img, .trpg-speaker-art img, .trpg-bust img').evaluateAll(els=>els.map(e=>({src:e.src,visible:e.getBoundingClientRect().width>0}))).catch(()=>[]);
        for(const id of ids) if(!result.captured.includes(id) && active.some(x=>x.visible && x.src.includes(`chr_${id}_normal`))) {
          await settle(page);
          await page.screenshot({path:path.join(out,`${label}-${id}.png`)}); result.captured.push(id);
        }
        const next=page.getByTestId('trpg-next');
        if(await next.isVisible()) {await next.click();continue;}
        const buttons=page.locator('[data-test="trpg-ready"], [data-test="trpg-build"], [data-test^="trpg-approach-"]');
        if(await buttons.first().isVisible()) {await buttons.first().click();continue;}
        break;
      }
      await settle(page);
      await page.screenshot({path:path.join(out,`${label}-table.png`)});
      result.snapshot=await page.evaluate(()=>window.__trpg?.snapshot());
      if (!ids.every(id=>result.captured.includes(id))) throw new Error('Both regular speaking portraits must be captured');
      if (errors.length || failedResources.length) throw new Error('Browser errors or missing resources');
      result.status='passed';
    } catch(e) {result.status='failed'; result.error=String(e);await page.screenshot({path:path.join(out,`${label}-failed.png`)});}
    result.failedResources=[...new Set(failedResources)];
    await context.close();
  }
} finally { await browser.close(); fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify(report.results.map(({label,status,error,errors,failedResources,captured})=>({label,status,error,errors,failedResources,captured})),null,2));
