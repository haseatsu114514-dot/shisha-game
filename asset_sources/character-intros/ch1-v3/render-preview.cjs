// Render the editable UI with untouched portrait assets. No raster post-processing.
const {chromium}=require("playwright");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {spawn,spawnSync}=require("node:child_process"),os=require("node:os"),crypto=require("node:crypto");
const base=__dirname,root=path.resolve(base,"../../..");
const records=JSON.parse(fs.readFileSync(path.join(base,"characters.json"),"utf8"));
const video=process.argv.includes("--video");
function packageHTML(){
 let css=fs.readFileSync(path.join(base,"style.css"),"utf8");
 css=css.replace(/url\("([^"]+)"\)/g,(_,p)=>'url("data:font/woff2;base64,'+fs.readFileSync(path.resolve(base,p)).toString("base64")+'")');
 const packed=records.map(c=>({...c,portrait:"data:image/png;base64,"+fs.readFileSync(path.join(root,c.portrait)).toString("base64"),
  ...(c.backgrounds?{backgrounds:Object.fromEntries(Object.entries(c.backgrounds).map(([key,b])=>[key,{...b,src:"data:image/png;base64,"+fs.readFileSync(path.join(root,b.src)).toString("base64")}]))}:{})}));
 let html=fs.readFileSync(path.join(base,"index.html"),"utf8");
 html=html.replace('<link rel="stylesheet" href="style.css">',"<style>"+css+"</style>");
 const preview=fs.readFileSync(path.join(base,"preview.js"),"utf8").replace('import { motifs } from "./motifs.js";',fs.readFileSync(path.join(base,"motifs.js"),"utf8").replace("export const motifs","const motifs"));
 html=html.replace('<script type="module" src="preview.js"></script>',"<script>window.INTRO_CHARACTERS="+JSON.stringify(packed)+";</script><script type=\"module\">"+preview+"</script>");
 fs.writeFileSync(path.join(base,"mockup.html"),html);
 const cards=records.map(c=>'<a href="index.html?character='+c.id+'" aria-label="'+(c.select_label||c.name)+'"><img src="'+c.id+'/preview.png" alt="'+(c.select_label||c.name)+'"></a>').join("");
 fs.writeFileSync(path.join(base,"gallery.html"),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>一章 登場カット一覧</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0f14}.grid{display:grid;grid-template-columns:repeat(3,640px);gap:0}a,img{display:block;width:640px;height:360px}</style><main class="grid">'+cards+"</main></html>");
 for(const style of ['geometric','illustrated']){
  const six=['adam','tsumugi','ageha','minto','kafuka','naru'].map(id=>'<img src="'+id+'/'+(style==='geometric'?'geometric':'illustrated')+'.png" alt="'+records.find(c=>c.id===id).name+'">').join('');
  fs.writeFileSync(path.join(base,style+'-six.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>6人の登場カット</title><style>body{margin:0;background:#0b0f14}.grid{display:grid;grid-template-columns:repeat(3,640px)}img{display:block;width:640px;height:360px}</style><main class="grid">'+six+'</main></html>');
 }
 const comparisonCards=[
  ['最初の初遭遇案（比較用）','first-unknown.png'],
  ['今回の初遭遇版','../ageha_unknown/preview.png'],
  ['最初の名乗り後案（比較用）','first-named.png'],
  ['今回の第2章版・プロの顔','../ageha/preview.png']
 ].map(([label,src])=>'<figure><figcaption>'+label+'</figcaption><img src="'+src+'" alt="'+label+'"></figure>').join('');
 fs.writeFileSync(path.join(base,'ageha-comparison/index.html'),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>アゲハの最初の案と今回の2版</title><style>*{box-sizing:border-box}body{margin:0;background:#0b0f14;color:#fff;font:700 18px sans-serif}.grid{display:grid;grid-template-columns:repeat(2,640px)}figure{margin:0}figcaption{height:48px;padding:12px 16px}img{display:block;width:640px;height:360px}</style><main class="grid">'+comparisonCards+'</main></html>');
}
function composition(){
 const out={};
 for(const id of ["title","name","full","quote"]){
  const el=document.getElementById(id),r=el.getBoundingClientRect();
  out[id]={text:el.textContent,x:r.x,y:r.y,width:r.width,height:r.height,font:getComputedStyle(el).fontFamily,fontSize:getComputedStyle(el).fontSize};
 }
 return {id:document.querySelector("#stage").dataset.character,text:out,portraitLoaded:document.querySelector("#portrait").naturalWidth>0,portraitFilter:getComputedStyle(document.querySelector("#portrait")).filter,englishTagPresent:!!document.querySelector(".tag"),animations:window.introPreview.animations.length};
}
(async()=>{
 packageHTML();
 for(const old of JSON.parse(fs.readFileSync(path.join(base,'ageha-comparison/originals.json'),'utf8'))){
  assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(base,'ageha-comparison',old.file))).digest('hex'),old.sha256,'archived original changed: '+old.file);
 }
 const server=spawn("python3",["-u","-m","http.server","8771","--bind","127.0.0.1"],{cwd:root,stdio:["ignore","pipe","pipe"]});
 await new Promise((resolve,reject)=>{server.stdout.on("data",b=>{if(b.toString().includes("Serving HTTP"))resolve()});server.on("exit",c=>reject(new Error("server exit "+c)))});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||"/usr/bin/chromium"});
 const errors=[],checks=[],illustratedChecks=[],animationPhases=[];
 const url="http://127.0.0.1:8771/asset_sources/character-intros/ch1-v3/";
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on("pageerror",e=>errors.push(e.message));
  page.on("response",r=>{if(r.status()>=400&&!r.url().endsWith("favicon.ico"))errors.push(r.status()+" "+r.url())});
  await page.goto(url+"?video=1");await page.waitForFunction(()=>window.previewReady);
  for(const c of records){
   assert.equal(c.full,'','parenthesized name is still in the current card: '+c.id);
   if(c.id==='ageha_unknown'){
    assert.equal(c.name,'？？？');assert.equal(c.expression,'smile');
    assert.equal(c.line,'大丈夫？ ケガしてない？');
    assert(!/バイブス|宵野|葉子/.test(c.name+c.full+c.title+c.line),'first encounter reveals identity');
   }
   if(c.id==='ageha'){
    assert.equal(c.expression,'normal');assert.equal(c.line,'あたし超感覚派なんだよね〜');
    assert.notEqual(c.portrait_sha256,records.find(v=>v.id==='ageha_unknown').portrait_sha256,'same expression in both versions');
   }
   assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,c.portrait))).digest("hex"),c.portrait_sha256,"portrait changed: "+c.id);
   await page.evaluate(id=>window.introPreview.showCharacter(id,{play:false}),c.id);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const check=await page.evaluate(composition);
   for(const [key,t] of Object.entries(check.text)){
    if(!t.text)continue;
    assert(t.x>=600&&t.x+t.width<=1240&&t.y>=0&&t.y+t.height<=720,c.id+" "+key+" overflows "+JSON.stringify(t));
   }
   assert(check.portraitLoaded&&check.portraitFilter==="none"&&!check.englishTagPresent,"portrait/tag: "+c.id);
   assert.equal(check.text.name.text,c.name);assert.equal(check.text.title.text,c.title);
   assert.equal(check.text.quote.text,"「"+c.line+"」");
   assert.equal(check.text.quote.fontSize,'38px');assert(check.text.quote.height<=104,'quote exceeds two lines: '+c.id);
   assert.equal(check.text.full.text,'','parenthesized name rendered: '+c.id);
   fs.mkdirSync(path.join(base,c.id),{recursive:true});
   await page.screenshot({path:path.join(base,c.id,"preview.png")});checks.push(check);
  }
  const illustrated = records.filter(c=>c.backgrounds?.illustrated);
  await page.evaluate(()=>window.introPreview.setBackgroundStyle('geometric',{play:false}));
  for(const c of illustrated){
   await page.evaluate(id=>window.introPreview.showCharacter(id,{play:false}),c.id);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   await page.screenshot({path:path.join(base,c.id,'geometric.png')});
  }
  for(const c of illustrated){
   assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(root,c.backgrounds.illustrated.src))).digest("hex"),c.backgrounds.illustrated.sha256,"background changed: "+c.id);
   await page.evaluate(id=>window.introPreview.showCharacter(id,{play:false}),c.id);
   await page.evaluate(()=>window.introPreview.setBackgroundStyle("illustrated",{play:false}));
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const check=await page.evaluate(composition);
   for(const [key,t] of Object.entries(check.text)){if(t.text)assert(t.x>=600&&t.x+t.width<=1240&&t.y>=0&&t.y+t.height<=720,c.id+" illustrated "+key+" overflows")}
   assert.equal(check.text.quote.text,"「"+c.line+"」");
   const legibility=await page.evaluate(()=>({veil:getComputedStyle(document.querySelector('.art-veil')).display,titleBackground:getComputedStyle(document.querySelector('#title')).backgroundColor,portraitFilter:getComputedStyle(document.querySelector('#portrait')).filter}));
   assert.equal(legibility.veil,"block");assert.notEqual(legibility.titleBackground,"rgba(0, 0, 0, 0)");assert.equal(legibility.portraitFilter,"none");illustratedChecks.push({...check,legibility});
   await page.screenshot({path:path.join(base,c.id,"illustrated.png")});
  }
  await page.evaluate(()=>window.introPreview.setBackgroundStyle("geometric",{play:false}));
  if(illustrated.length){
   const rows=illustrated.map(c=>'<img src="'+c.id+'/geometric.png" alt="'+c.name+' 幾何学"><img src="'+c.id+'/illustrated.png" alt="'+c.name+' イラスト">').join("");
   fs.writeFileSync(path.join(base,"styles.html"),'<!doctype html><html lang="ja"><meta charset="utf-8"><title>幾何学とイラストの比較</title><style>body{margin:0;background:#0b0f14}.grid{display:grid;grid-template-columns:repeat(2,640px)}img{width:640px;height:360px;display:block}</style><main class="grid">'+rows+"</main></html>");
  }
  for(const c of ["adam","kafuka"]){
   await page.evaluate(id=>window.introPreview.showCharacter(id),c);
   for(const ms of [0,400,1600]){
    await page.evaluate(t=>window.introPreview.seek(t),ms);
    const phase=await page.evaluate(()=>({portraitOpacity:getComputedStyle(document.querySelector("#portrait")).opacity,nameOpacity:getComputedStyle(document.querySelector(".name-line")).opacity}));
    animationPhases.push({id:c,ms,...phase});
    assert(ms!==0||phase.nameOpacity==="0","name visible at start");
    assert(ms!==1600||phase.nameOpacity==="1","name invisible after entrance");
   }
  }
  await page.goto(url+"gallery.html");await page.setViewportSize({width:1920,height:1800});
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(base,"comparison.png"),fullPage:true});
  await page.setViewportSize({width:1280,height:816});await page.goto(url+'ageha-comparison/index.html');
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
  await page.screenshot({path:path.join(base,'ageha-comparison/comparison.png'),fullPage:true});
  for(const style of ['geometric','illustrated']){
   await page.setViewportSize({width:1920,height:720});await page.goto(url+style+'-six.html');
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await page.screenshot({path:path.join(base,style+'-six.png')});
  }
  if(illustrated.length){
   await page.setViewportSize({width:1280,height:360*illustrated.length});await page.goto(url+"styles.html");
   await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode())));
   await page.screenshot({path:path.join(base,"styles-comparison.png"),fullPage:true});
  }
  // The downloadable HTML must work with all external asset requests blocked.
  const external=[];
  await page.route("**/*",route=>{
   const u=route.request().url();if(u.startsWith("data:")||u===url+"mockup.html"){route.continue();return}
   external.push(u);route.abort();
  });
  await page.setViewportSize({width:1280,height:840});await page.goto(url+"mockup.html");await page.waitForFunction(()=>window.previewReady);
  await page.locator('[data-select="adam"]').click();await page.waitForFunction(()=>window.previewReady&&document.querySelector("#stage").dataset.character==="adam");
  await page.locator("#pause").click();assert(await page.evaluate(()=>window.introPreview.animations.every(a=>a.playState==="paused")));
  await page.locator("#pause").click();await page.locator("#replay").click();await page.locator("#loop").click();
  await page.waitForFunction(()=>window.previewReady&&document.querySelector("#stage").dataset.character==="minto",null,{timeout:6000});await page.locator("#loop").click();
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>window.introPreview.seek(1600));
  assert(await page.locator("#controls").evaluate(el=>el.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(base,"mobile-preview.png")});
  await page.emulateMedia({reducedMotion:"reduce"});await page.evaluate(()=>window.introPreview.showCharacter("dr_kemuri"));
  assert.equal(await page.evaluate(()=>window.introPreview.animations.length),0);
  assert.deepEqual(external,[]);await page.unroute("**/*");
  if(video){
   await page.emulateMedia({reducedMotion:"no-preference"});await page.setViewportSize({width:1280,height:720});
   await page.goto(url+"?video=1");await page.waitForFunction(()=>window.previewReady);
   const dir=fs.mkdtempSync(path.join(os.tmpdir(),"suien-intro-v3-"));let frame=0;const fps=12,frames=42;
   for(const c of records){
    await page.evaluate(id=>window.introPreview.showCharacter(id),c.id);
    for(let n=0;n<frames;n++){
     await page.evaluate(t=>window.introPreview.seek(t),n*1000/fps);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     await page.screenshot({path:path.join(dir,String(frame++).padStart(5,"0")+".png")});
    }
    console.log("Video: "+c.name);
   }
   const encoded=spawnSync("ffmpeg",["-y","-loglevel","error","-framerate",String(fps),"-i",path.join(dir,"%05d.png"),"-c:v","libx264","-crf","21","-pix_fmt","yuv420p","-movflags","+faststart",path.join(base,"animation-preview.mp4")],{encoding:"utf8"});
   assert.equal(encoded.status,0,encoded.stderr);fs.rmSync(dir,{recursive:true,force:true});
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(base,"render-validation.json"),JSON.stringify({canvas:[1280,720],characters:checks,illustratedComparisons:illustratedChecks,animationPhases,sourceHashesVerified:true,standaloneButtons:true,standaloneExternalRequests:external,mobileControlsFit:true,reducedMotionRespected:true,browserErrors:errors,videoGenerated:video,runtimeFilesChanged:true,illustrationRuntimeConnected:false,allParenthesizedNamesRemoved:true,agehaExpressionsDiffer:true},null,2)+"\n");
  console.log("PASS: "+checks.length+" compositions, original portraits, Japanese copy, animation, standalone controls, mobile");
 }finally{await browser.close();server.kill()}
})().catch(e=>{console.error(e);process.exitCode=1});
