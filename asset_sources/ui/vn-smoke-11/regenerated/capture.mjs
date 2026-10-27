import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const folder=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(folder,'../../../..');
const {chromium}=createRequire(path.join(repo,'remake/test/browser/support.mjs'))('playwright');
const base=(process.env.BASE_URL||'http://127.0.0.1:8123/')+'asset_sources/ui/vn-smoke-11/regenerated/';
const data=JSON.parse(await fs.readFile(path.join(folder,'generation.json'),'utf8'));
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium'});
try{
 const page=await browser.newPage({viewport:{width:1280,height:720}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const item of data.items){
  await page.goto(base+'preview.html?theme='+item.id);
  await page.waitForFunction(()=>window.previewReady);
  const qa=await page.evaluate(()=>{
   const glyphs=selector=>{const r=document.createRange();r.selectNodeContents(document.querySelector(selector));return [...r.getClientRects()].filter(r=>r.width);};
   const dialogue=glyphs('.dialogue');
   const boxes=['.name','.commands','.next'].map(s=>document.querySelector(s).getBoundingClientRect());
   const overlap=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
   return {lines:new Set(dialogue.map(r=>Math.round(r.top))).size,clear:dialogue.every(r=>boxes.every(b=>!overlap(r,b))),inside:[...dialogue,...boxes].every(r=>r.left>=0&&r.right<=1280&&r.top>=0&&r.bottom<=720),labels:[...document.querySelectorAll('.commands span')].map(n=>n.textContent)};
  });
  assert.equal(qa.lines,2);assert(qa.clear&&qa.inside);assert.deepEqual(qa.labels,['AUTO','SKIP','LOG','用語']);
  await page.screenshot({path:path.join(folder,item.id+'-preview.png')});
  console.log('PASS new design:',item.id,qa);
 }
 assert.deepEqual(errors,[]);
 const cards=data.items.map(item=>`<figure><figcaption>${item.label} <a href="${item.source}">原画</a></figcaption><a href="${item.id}-preview.png"><img src="${item.id}-preview.png" alt="${item.label}"></a></figure>`).join('');
 await fs.writeFile(path.join(folder,'comparison.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><title>6路線・新しい会話ウインドウ原案</title><style>body{margin:0;padding:24px;background:#19151e;color:#eee5df;font:18px sans-serif}h1{font-size:28px;margin:0 0 12px}p{line-height:1.7;margin:0 0 20px;color:#ccc1ca}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}figure{margin:0;padding:12px;border:1px solid #5f5167;background:#241d2a}figcaption{margin-bottom:12px}img{display:block;width:100%}a{color:#d7c0ef}</style><h1>会話ウインドウ｜6路線を画像生成で再設計</h1><p>新しい原画＋実ゲームの背景と立ち絵＋実フォントの本文2行。名前札・操作枠も生成した意匠。採用前の静止プレビュー。</p><main class="grid">${cards}</main></html>`);
 await page.setViewportSize({width:1600,height:300});await page.goto(base+'comparison.html');await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(folder,'comparison.png'),fullPage:true});
}finally{await browser.close();}
