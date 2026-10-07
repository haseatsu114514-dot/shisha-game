// Review candidates in the existing engine without replacing runtime files.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path');const {spawn}=require('node:child_process');
const base=__dirname,root=path.resolve(base,'../../..');
const parts=path.join(root,'asset_sources/portraits/kafuka-approved-blue-inner-v1/game-ready');
const errors=[],checks={maps:[],portraits:[]};
(async()=>{
 const server=spawn('python3',['-u','-m','http.server','8771','--bind','127.0.0.1'],{cwd:root,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.on('data',b=>{if(b.toString().includes('Serving HTTP'))resolve();});server.on('exit',c=>reject(new Error(`server exit ${c}`)));});
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium'});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.route(/chr_kafuka_[a-z]+\.(png|webp)(\?.*)?$/,route=>{
   const name=route.request().url().split('/').pop().split('?')[0];const file=path.join(parts,name);
   if(fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:name.endsWith('.webp')?'image/webp':'image/png'});
   return route.continue();
  });
  await page.route(/face_kafuka\.png(\?.*)?$/,route=>route.fulfill({body:fs.readFileSync(path.join(parts,'face_kafuka.png')),contentType:'image/png'}));
  await page.goto('http://127.0.0.1:8771/remake/');await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async()=>{
   const core=await import('./js/core/state.js'),data=await import('./js/core/data.js'),ui=await import('./js/core/ui.js'),map=await import('./js/daily/map.js'),vn=await import('./js/vn/engine.js');
   core.newGame();const s=core.state;s.phase='daily';s.day=1;s.slot=0;s.flags._kafuka_nickname_known=true;s.flags._lime_contact_kafuka=true;s.flags._intro_kafuka=true;s.contacts.push('kafuka');
   for(const id of Object.keys(data.DB.characters))s.met[id]=true;
   // Candidate-only face registration; the real manifest on disk is untouched.
   data.DB.manifest.portraits.kafuka.faces.push('ventriloquism');
   window.review={core,data,ui,map,vn};
  });
  for(const tod of ['day','night']){
   await page.evaluate(async tod=>{review.core.state.slot=tod==='night'?1:0;review.map.interruptMap(null);review.mapDone=review.map.chooseSpot();},tod);
   await page.waitForSelector('.map .spot-pin');await page.waitForTimeout(500);
   const before=await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.spot,x:n.style.left,y:n.style.top})));
   await page.screenshot({path:path.join(base,`map-${tod}-current.png`)});
   await page.evaluate(tod=>review.ui.setBg(`../asset_sources/backgrounds/osu-sakae-map-remaster-v1/${tod}/preview.png`,{instant:true}),tod);
   await page.waitForTimeout(500);
   const after=await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.spot,x:n.style.left,y:n.style.top})));
   if(JSON.stringify(before)!==JSON.stringify(after))throw new Error('pins changed');
   await page.screenshot({path:path.join(base,`map-${tod}-candidate.png`)});
   await page.locator('[data-test="pin-tonari"]').click();await page.waitForSelector('[data-test="map-go"]');
   const panel=await page.locator('.map-info').boundingBox();if(!panel||panel.x<0||panel.x+panel.width>1280||panel.y+panel.height>720)throw new Error('map panel clipped');
   await page.screenshot({path:path.join(base,`map-${tod}-selected.png`)});
   checks.maps.push({timeOfDay:tod,pins:after,pinPositionsUnchanged:true,infoPanelInBounds:true});
  }
  await page.evaluate(()=>{review.map.interruptMap(null);review.ui.clearScreen();});
  const faces=['normal','smile','serious','surprise','excited','ventriloquism'];
  await page.evaluate(faces=>{review.core.config.textSpeed=0;review.talk=review.vn.play({dialogue_id:'asset_review_only',metadata:{bg:'bg_street_day'},lines:faces.map(face=>({speaker:'kafuka',face,text:`素材確認：${face}`}))});},faces);
  for(let i=0;i<faces.length;i++){
   const face=faces[i];await page.waitForFunction(face=>document.querySelector('.vn-text')?.textContent.includes(face)&&document.querySelector('.portrait.active')?.src.includes(`_${face}.`),face);
   await page.waitForFunction(()=>{const im=document.querySelector('.portrait.active');return im?.complete&&im.naturalWidth===896&&!im.classList.contains('enter');});
   await page.waitForTimeout(350);
   const check=await page.locator('.portrait.active').evaluate(im=>({src:im.src,naturalSize:[im.naturalWidth,im.naturalHeight],height:im.style.height,bottom:im.style.bottom,anchor:im.style.getPropertyValue('--ax'),filter:getComputedStyle(im).filter}));
   if(check.filter!=='none')throw new Error('portrait filtered');
   checks.portraits.push({face,...check});await page.screenshot({path:path.join(base,`portrait-${face}.png`)});
   await page.locator('.vn-box').click();await page.waitForTimeout(40);
   if(i<faces.length-1)await page.locator('.vn-box').click();
  }
  await page.evaluate(()=>review.talk);
  const frameKeys=['height','bottom','anchor'];if(frameKeys.some(k=>new Set(checks.portraits.map(c=>c[k])).size!==1))throw new Error('portrait frame shifted');
  await page.setViewportSize({width:591,height:1280});
  await page.evaluate(()=>{review.core.state.slot=0;review.mapDone=review.map.chooseSpot();});await page.waitForSelector('.map .spot-pin');await page.evaluate(()=>review.ui.setBg('../asset_sources/backgrounds/osu-sakae-map-remaster-v1/day/preview.png',{instant:true}));await page.waitForTimeout(350);await page.screenshot({path:path.join(base,'map-mobile.png')});
  if(errors.length)throw new Error(errors.join('\n'));
  fs.writeFileSync(path.join(base,'validation.json'),JSON.stringify({checks,browserErrors:errors,runtimeFilesModified:false,candidateMethod:'Temporary browser URL responses for portraits/icon, and setBg to source map preview. No data files or runtime assets replaced.'},null,2)+'\n');
  console.log(JSON.stringify({maps:checks.maps.length,portraits:checks.portraits.map(c=>c.face),frameSame:true,browserErrors:errors}));
 }finally{await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
