// 実装変更前後の画面・描画フレームを同じ新規contextで比較する。保存済み画像は再生成しない。
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const { chromium } = createRequire(path.join(root, 'remake/test/browser/package.json'))('playwright');
import fs from 'node:fs';
const out = process.env.ARTIFACT_DIR || fileURLToPath(new URL('.', import.meta.url));
const base = process.env.BASE_REF || 'e3aa425581afe4ed0f6ff3e195ae1577752d63ec';
const oldFile = file => execFileSync('git', ['show', `${base}:${file}`], { cwd: root, encoding: 'utf8' });
fs.mkdirSync(out, { recursive: true });
const browser=await chromium.launch({...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),headless:true});
for(const version of ['before','after']){
 const context=await browser.newContext({viewport:{width:1280,height:720},...(process.env.RECORD_VIDEO === '1' ? { recordVideo: { dir: path.join(out, 'video-tmp'), size: { width: 1280, height: 720 } } } : {})});
 const page=await context.newPage();
 if(version==='before'){
   await page.route('**/js/core/ui.js',route=>route.fulfill({contentType:'text/javascript',body:oldFile('remake/js/core/ui.js')}));
   await page.route('**/css/base.css',route=>route.fulfill({contentType:'text/css',body:oldFile('remake/css/base.css')}));
 }
 await page.goto(process.env.BASE_URL || 'http://127.0.0.1:8123/remake/');
 await page.locator('[data-test="title-new"]').waitFor({timeout:30000}); await page.locator('#boot').waitFor({state:'detached'});
 await page.evaluate(async()=>{
  const ui=await import('./js/core/ui.js'), data=await import('./js/core/data.js');
  await ui.setBg(data.bgUrl('bg_tonari_inside','day'),{instant:true}); ui.clearScreen();
  window.record={samples:[],events:[]};window.titleFinished=false;window.started=performance.now();
  document.addEventListener('transitionrun',e=>{if(e.target.matches('.chapter-card'))record.events.push({property:e.propertyName,t:performance.now()-started});});
  function sample(){const c=document.querySelector('.chapter-card.show');if(c)record.samples.push({t:Math.round(performance.now()-started),opacity:Number(getComputedStyle(c).opacity),out:c.classList.contains('out')});if(!titleFinished)requestAnimationFrame(sample);}
  requestAnimationFrame(sample);
  ui.chapterTitle((await import('./js/core/chapter-title-art.js')).CHAPTER_TITLE_ART[0]).then(()=>titleFinished=true);
 });
 await page.waitForFunction(()=>document.querySelector('.chapter-card.show'));
 await page.waitForTimeout(140);await page.screenshot({path:`${out}/${version}-entry.png`});
 await page.waitForTimeout(1000); if (version === 'after') await page.screenshot({path:`${out}/${version}-hold.png`});
 await page.waitForFunction(()=>document.querySelector('.chapter-card.out'));
 await page.waitForTimeout(140); if (version === 'after') await page.screenshot({path:`${out}/${version}-exit.png`});
 await page.waitForFunction(()=>titleFinished);
 if (version === 'after') await page.screenshot({path:`${out}/${version}-returned.png`});
 fs.writeFileSync(`${out}/${version}-frames.json`,JSON.stringify(await page.evaluate(()=>record),null,2)+'\n');
 const video=page.video(); await context.close(); if (video) { await video.saveAs(`${out}/${version}.webm`); await video.delete(); }
 console.log(version,JSON.stringify(JSON.parse(fs.readFileSync(`${out}/${version}-frames.json`,'utf8')).samples.slice(0,5)));
}
await browser.close();
