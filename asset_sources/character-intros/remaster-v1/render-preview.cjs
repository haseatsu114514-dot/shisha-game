const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const base=__dirname;
const repoRoot=path.resolve(base,'../../..');
(async()=>{
 const server=spawn('python3',['-u','-m','http.server','8767','--bind','127.0.0.1'],{cwd:repoRoot,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.on('data',data=>{if(data.toString().includes('Serving HTTP'))resolve();});server.on('exit',code=>reject(new Error(`preview server exited ${code}`)));});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium'});
 const errors=[],checks=[];
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
  for(const cid of ['hajime','adam','naru','dr_kemuri']){
   await page.goto(`http://127.0.0.1:8767/asset_sources/character-intros/remaster-v1/?character=${cid}`);
   await page.waitForFunction(()=>window.previewReady===true);
   const check=await page.evaluate(()=>{
    const rects={};for(const id of ['title','name','full','quote']){const el=document.getElementById(id),r=el.getBoundingClientRect();rects[id]={x:r.x,y:r.y,width:r.width,height:r.height,fontSize:getComputedStyle(el).fontSize,text:el.textContent,overflow:el.scrollWidth>el.clientWidth+1};}
    return {character:document.querySelector('#stage').dataset.character,rects,portraitLoaded:document.querySelector('#portrait').naturalWidth===896,fontFamily:getComputedStyle(document.querySelector('#name')).fontFamily,portraitFilter:getComputedStyle(document.querySelector('#portrait')).filter};
   });
   if(!check.portraitLoaded||Object.values(check.rects).some(r=>r.overflow||r.x<0||r.x+r.width>1280||r.y+r.height>720))throw new Error(`intro composition bounds: ${cid}`);
   fs.mkdirSync(path.join(base,cid),{recursive:true});
   await page.screenshot({path:path.join(base,cid,'preview.png')});
   checks.push(check);
  }
  if(errors.length)throw new Error(errors.join('\n'));
  fs.writeFileSync(path.join(base,'render-validation.json'),JSON.stringify({canvas:[1280,720],browser:'Chromium',checks,browserErrors:errors,runtimeFilesChanged:false},null,2)+'\n');
  console.log(JSON.stringify({rendered:checks.map(c=>c.character),browserErrors:errors,allPortraitsUnfiltered:checks.every(c=>c.portraitFilter==='none')}));
 }finally{await browser.close();server.kill();}
})();
