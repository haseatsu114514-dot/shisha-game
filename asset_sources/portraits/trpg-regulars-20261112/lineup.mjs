import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const here=fileURLToPath(new URL('.',import.meta.url));
const {chromium}=createRequire(process.env.PLAYWRIGHT_PACKAGE||path.join(root,'remake/test/browser/package.json'))('playwright');
const base=process.env.BASE_URL||'http://127.0.0.1:8127/';
const entries=JSON.parse(fs.readFileSync(path.join(here,'sources.json'))).lineup;
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 for(const mode of ['height-lineup','face-size']) {
  const panels=entries.map(e=>{
   const [l,t,r,b]=e.alpha_bounds_ge16, p=e.points;
   const side=(p.chin[1]-p.crown[1])/.58, cx=(p.cheeks[0]+p.cheeks[1])/2;
   const top=(p.chin[1]+p.crown[1])/2-.48*side;
   const scale=mode==='height-lineup'?680/(b-t):200/side;
   const x=mode==='height-lineup'?150-(l+r)/2*scale:100-cx*scale;
   const y=mode==='height-lineup'?20-t*scale:-top*scale;
   return `<section><h2>${e.id}</h2><div class="frame ${mode}"><img src="${base+e.path}" style="position:absolute;width:${e.size[0]*scale}px;left:${x}px;top:${y}px"></div></section>`;
  }).join('');
  await page.setContent(`<html><head><meta charset="utf-8"><style>body{margin:0;background:#e5e2db;color:#262626;font:16px sans-serif}h1{margin:18px;font-size:21px}main{display:grid;grid-template-columns:repeat(4,1fr)}section{text-align:center}h2{font-size:18px}.frame{position:relative;margin:auto;overflow:hidden}.height-lineup{width:300px;height:720px;border-bottom:2px solid #777}.face-size{width:200px;height:200px;background:#293e40;border-radius:50%}</style></head><body><h1>${mode==='height-lineup'?'千須・凛想との同高比較（候補の身長設定は未確定）':'同じ規格の顔枠で比較（頭高0.58・中心高0.48）'}</h1><main>${panels}</main></body></html>`);
  await page.evaluate(()=>Promise.all([...document.images].map(im=>im.decode())));
  await page.screenshot({path:path.join(here,'qa',mode+'.png')});
 }
} finally {await browser.close();}
