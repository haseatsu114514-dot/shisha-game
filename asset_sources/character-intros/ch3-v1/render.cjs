// Review approved portrait composition, typography, controls and motion in Chromium.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),crypto=require('node:crypto');
const {chromium}=require('playwright');
const base=__dirname,root=path.resolve(base,'../../..'),previous=path.join(base,'../ch1-v3');
const records=JSON.parse(fs.readFileSync(path.join(base,'characters.json')));
function standalone(){
 let css=fs.readFileSync(path.join(previous,'style.css'),'utf8').replace(/@font-face\{[^}]+\}/g,'');
 css+='\n'+fs.readFileSync(path.join(base,'style.css'),'utf8').replace(/@import[^;]+;/,'');
 css=css.replace('fonts/NotoSansJP-Ch3.woff2','data:font/woff2;base64,'+fs.readFileSync(path.join(base,'fonts/NotoSansJP-Ch3.woff2')).toString('base64'));
 const packed=records.map(c=>({...c,portrait:'data:image/png;base64,'+fs.readFileSync(path.join(root,c.portrait)).toString('base64'),backgrounds:{illustrated:{src:'data:image/png;base64,'+fs.readFileSync(path.join(root,c.backgrounds.illustrated.src)).toString('base64')}}}));
 const js=fs.readFileSync(path.join(previous,'preview.js'),'utf8').replace('import { motifs } from "./motifs.js";',fs.readFileSync(path.join(previous,'motifs.js'),'utf8').replace('export const motifs','const motifs'));
 let html=fs.readFileSync(path.join(base,'index.html'),'utf8').replace('<link rel="stylesheet" href="style.css">','<style>'+css+'</style>');
 html=html.replace('<script type="module" src="../ch1-v3/preview.js"></script>','<script>window.INTRO_CHARACTERS='+JSON.stringify(packed)+';</script><script type="module">'+js+'</script>');
 fs.writeFileSync(path.join(base,'mockup.html'),html);
}
(async()=>{
 standalone();
 const server=spawn('python3',['-u','-m','http.server','8773','--bind','127.0.0.1'],{cwd:root,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.on('data',b=>b.toString().includes('Serving HTTP')&&resolve());server.on('exit',c=>reject(Error('server '+c)))});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const errors=[],checks=[];const url='http://127.0.0.1:8773/asset_sources/character-intros/ch3-v1/';
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.status()>=400&&!r.url().endsWith('favicon.ico'))errors.push(r.status()+' '+r.url())});
  await page.goto(url+'?video=1');await page.waitForFunction(()=>window.previewReady);
  for(const c of records){
   const master=JSON.parse(fs.readFileSync(path.join(root,'data/characters.json'))).find(v=>v.id===c.id);
   assert.equal(c.title,master.intro_cutin.title);assert.equal(c.line,master.intro_cutin.line);assert.equal(c.expression,master.intro_cutin.face);
   assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,c.portrait))).digest('hex'),c.portrait_sha256);
   await page.evaluate(id=>window.introPreview.showCharacter(id,{play:false}),c.id);
   await page.waitForFunction(()=>window.previewReady);
   const check=await page.evaluate(()=>{
    const text={};for(const id of ['name','title','quote']){const e=document.getElementById(id),r=e.getBoundingClientRect();text[id]={text:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height,font:getComputedStyle(e).fontFamily}}
    return {id:document.querySelector('#stage').dataset.character,text,portraitLoaded:document.querySelector('#portrait').naturalWidth>0,backgroundLoaded:document.querySelector('#art-background').naturalWidth>0,filter:getComputedStyle(document.querySelector('#portrait')).filter,full:document.querySelector('#full').textContent};
   });
   assert(check.portraitLoaded&&check.backgroundLoaded);assert.equal(check.filter,'none');assert.equal(check.full,'');assert.equal(check.text.name.text,c.name);
   for(const t of Object.values(check.text)){assert(t.x>=600&&t.x+t.w<=1240&&t.y>=0&&t.y+t.h<=720,JSON.stringify(t));assert(t.font.includes('Chapter Intro Gothic'))}
   assert(check.text.quote.h<=104);checks.push(check);
   fs.mkdirSync(path.join(base,c.id),{recursive:true});await page.screenshot({path:path.join(base,c.id,'preview.png')});
   await page.evaluate(id=>window.introPreview.showCharacter(id),c.id);
   for(const ms of [0,400,1600]){await page.evaluate(t=>window.introPreview.seek(t),ms);const opacity=await page.locator('.name-line').evaluate(e=>getComputedStyle(e).opacity);if(ms===0)assert.equal(opacity,'0');if(ms===1600)assert.equal(opacity,'1')}
  }
  await page.goto(url);await page.waitForFunction(()=>window.previewReady);
  await page.getByRole('button',{name:'ヴォルク',exact:true}).click();await page.waitForFunction(()=>window.previewReady&&document.querySelector('#stage').dataset.character==='volk');
  await page.getByRole('button',{name:'一時停止',exact:true}).click();assert.equal(await page.getByRole('button',{name:'再開',exact:true}).getAttribute('aria-pressed'),'true');
  await page.setViewportSize({width:844,height:390});
  await page.waitForFunction(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),nav=document.querySelector('#controls').getBoundingClientRect();return r.x>=-1&&r.right<=innerWidth+1&&r.y>=-1&&r.bottom<=nav.y+1});
  const phone=await page.evaluate(()=>{const r=document.querySelector('#stage').getBoundingClientRect(),nav=document.querySelector('#controls').getBoundingClientRect();return {stage:{x:r.x,y:r.y,w:r.width,h:r.height},controls:{y:nav.y,h:nav.height},width:innerWidth,height:innerHeight}});
  assert(phone.stage.x>=-1&&phone.stage.x+phone.stage.w<=845&&phone.stage.y>=-1&&phone.stage.y+phone.stage.h<=phone.controls.y+1);
  await page.screenshot({path:path.join(base,'mobile-preview.png')});checks.push({phone});
  await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'ましろ',exact:true}).click();await page.waitForFunction(()=>window.previewReady);assert.equal(await page.evaluate(()=>window.introPreview.animations.length),0);
  // Single-file deliverable must work with all networking blocked.
  const externalRequests=[];
  await page.route('**/*',route=>{if(route.request().url()===url+'offline.html')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(base,'mockup.html'),'utf8')});externalRequests.push(route.request().url());return route.abort()});
  await page.goto(url+'offline.html');await page.waitForFunction(()=>window.previewReady);assert.equal(await page.locator('#portrait').evaluate(e=>e.naturalWidth>0),true);assert.deepEqual(externalRequests,[]);await page.unroute('**/*');
  await page.setViewportSize({width:1280,height:360});
  fs.writeFileSync(path.join(base,'gallery.html'),'<html lang="ja"><meta charset="utf-8"><title>第3章 登場カット一覧</title><style>body{margin:0;background:#0b0f14;display:grid;grid-template-columns:repeat(2,640px)}img{display:block;width:640px;height:360px}</style>'+records.map(c=>'<a href="index.html?character='+c.id+'"><img alt="'+c.name+'" src="'+c.id+'/preview.png"></a>').join('')+'</html>');
  await page.goto(url+'gallery.html');
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));await page.screenshot({path:path.join(base,'comparison.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(base,'render-validation.json'),JSON.stringify({checks,errors,animationPhases:[0,400,1600],reducedMotion:true,standaloneOffline:true},null,2)+'\n');
  console.log('PASS: 2 compositions, approved portrait hashes/text, motion phases, switch/pause, landscape phone, reduced motion, offline single HTML; browser errors 0');
 }finally{await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exit(1)});
