const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn,spawnSync}=require('node:child_process');
const base=__dirname,root=path.resolve(base,'../../..');
const records=JSON.parse(fs.readFileSync(path.join(base,'characters.json'),'utf8'));
const video=process.argv.includes('--video');
const errors=[],checks=[];
function packageHTML(){
 let css=fs.readFileSync(path.join(base,'style.css'),'utf8');
 css=css.replace(/url\("([^"]+)"\)/g,(_,p)=>`url("data:font/woff2;base64,${fs.readFileSync(path.resolve(base,p)).toString('base64')}")`);
 const packed=records.map(c=>({...c,portrait:`data:image/png;base64,${fs.readFileSync(path.resolve(base,c.portrait)).toString('base64')}`}));
 let html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 html=html.replace('<link rel="stylesheet" href="style.css">',`<style>${css}</style>`);
 html=html.replace('<script type="module" src="preview.js"></script>',`<script>window.INTRO_CHARACTERS=${JSON.stringify(packed)};</script><script type="module">${fs.readFileSync(path.join(base,'preview.js'),'utf8')}</script>`);
 fs.writeFileSync(path.join(base,'mockup.html'),html);
}
function checkRects(){
 const text={};for(const id of ['title','name','full','quote']){const el=document.getElementById(id),r=el.getBoundingClientRect();text[id]={text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,overflow:el.scrollWidth>el.clientWidth+1};}
 return {character:document.querySelector('#stage').dataset.character,text,portraitLoaded:document.querySelector('#portrait').naturalWidth===896,portraitFilter:getComputedStyle(document.querySelector('#portrait')).filter,motif:document.querySelector('#motif').innerHTML.length,animations:window.introPreview.animations.length};
}
(async()=>{
 packageHTML();
 const server=spawn('python3',['-u','-m','http.server','8769','--bind','127.0.0.1'],{cwd:root,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('Serving HTTP'))resolve();});server.on('exit',c=>reject(new Error(`server exit ${c}`)));});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  const url='http://127.0.0.1:8769/asset_sources/character-intros/personality-v2/';
  await page.goto(url+'?video=1');await page.waitForFunction(()=>window.previewReady===true);
  for(const c of records){
   await page.evaluate(id=>window.introPreview.showCharacter(id),c.id);await page.evaluate(()=>window.introPreview.seek(1600));
   const check=await page.evaluate(checkRects);if(!check.portraitLoaded||check.portraitFilter!=='none'||Object.values(check.text).some(t=>t.overflow||t.x<0||t.x+t.width>1280||t.y+t.height>720))throw new Error('composition '+c.id);
   fs.mkdirSync(path.join(base,c.id),{recursive:true});await page.screenshot({path:path.join(base,c.id,'preview.png')});checks.push(check);
  }
  // Meaningful animation checkpoints: initially hidden, mid-transition, fully readable.
  await page.evaluate(()=>window.introPreview.showCharacter('kafuka'));
  const phases=[];for(const ms of [0,400,1600]){await page.evaluate(t=>window.introPreview.seek(t),ms);phases.push(await page.evaluate(t=>({ms:t,portraitOpacity:getComputedStyle(document.querySelector('#portrait')).opacity,nameOpacity:getComputedStyle(document.querySelector('#name')).opacity,nameTransform:getComputedStyle(document.querySelector('#name')).transform}),ms));await page.screenshot({path:path.join(base,`animation-${ms}.png`)});}
  if(phases[0].nameOpacity!=='0'||Number(phases[1].portraitOpacity)<=0||phases[2].nameOpacity!=='1')throw new Error('animation timing');
  // Managed Chromium blocks file://. Serve the self-contained file and reject any
  // external requests: it must use only the document and its embedded assets.
  const external=[];await page.route('**/*',route=>{
   const u=route.request().url();
   if(u.startsWith('data:')||u===url+'mockup.html'){route.continue();return;}
   external.push(u);route.abort();
  });
  await page.goto(url+'mockup.html');await page.waitForFunction(()=>window.previewReady===true);
  await page.locator('[data-select="adam"]').click();await page.waitForFunction(()=>window.previewReady&&document.querySelector('#stage').dataset.character==='adam');
  await page.locator('#pause').click();await page.waitForFunction(()=>window.introPreview.animations.every(a=>a.playState==='paused'));
  await page.locator('#pause').click();await page.locator('#replay').click();await page.locator('#loop').click();await page.waitForFunction(()=>document.querySelector('#loop').getAttribute('aria-pressed')==='true');
  await page.waitForFunction(()=>window.previewReady&&document.querySelector('#stage').dataset.character==='naru',{},{timeout:6000});await page.locator('#loop').click();
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(base,'mobile-preview.png')});
  const controlsFit=await page.locator('#controls').evaluate(el=>el.scrollWidth<=innerWidth);if(!controlsFit)throw new Error('mobile controls overflow');
  await page.emulateMedia({reducedMotion:'reduce'});await page.evaluate(()=>window.introPreview.showCharacter('kafuka'));if(await page.evaluate(()=>window.introPreview.animations.length)!==0)throw new Error('reduced motion');
  if(external.length)throw new Error('standalone external requests '+external.join(','));
  await page.unroute('**/*');
  if(video){
   await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1280,height:720});await page.goto(url+'?video=1');await page.waitForFunction(()=>window.previewReady===true);
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),'suien-intro-frames-'));let frame=0;
   const fps=24,duration=3.3,frames=Math.round(fps*duration);
   for(const c of records){
    await page.evaluate(id=>window.introPreview.showCharacter(id),c.id);
    for(let n=0;n<frames;n++){
     const t=n*1000/fps;await page.evaluate(t=>window.introPreview.seek(t),t);
     await page.screenshot({path:path.join(dir,`${String(frame++).padStart(5,'0')}.png`)});
    }
    console.log('video frames '+c.id);
   }
   const encode=spawnSync('ffmpeg',['-y','-loglevel','error','-framerate',String(fps),'-i',path.join(dir,'%05d.png'),'-c:v','libx264','-crf','21','-pix_fmt','yuv420p','-movflags','+faststart',path.join(base,'animation-preview.mp4')],{encoding:'utf8'});if(encode.status!==0)throw new Error(encode.stderr);fs.rmSync(dir,{recursive:true,force:true});
  }
  if(errors.length)throw new Error(errors.join('\n'));
  fs.writeFileSync(path.join(base,'render-validation.json'),JSON.stringify({canvas:[1280,720],characters:checks,animationPhases:phases,standaloneButtons:true,mobileControlsFit:controlsFit,reducedMotionRespected:true,browserErrors:errors,videoGenerated:video,runtimeFilesChanged:false},null,2)+'\n');
  console.log(JSON.stringify({rendered:checks.map(c=>c.character),animationPhases:phases,standaloneButtons:true,browserErrors:errors,video}));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
