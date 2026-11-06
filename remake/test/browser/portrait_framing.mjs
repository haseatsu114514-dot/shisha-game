// Actual adopted rasters in the production conversation UI, not a comparison mockup.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suite } from './support.mjs';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const out = path.resolve(root, process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser');
const measurements = [];
async function scene(page, ids, style, face = 'normal') {
  const tag = `${ids.join('-')}-${style}-${face}`;
  await page.evaluate(async ({ids,style,face,tag}) => {
    const core = await import('./js/core/state.js');
    const {DB} = await import('./js/core/data.js');
    const {markIntroSeen} = await import('./js/vn/intro.js');
    const {play} = await import('./js/vn/engine.js');
    window.framingAbort?.abort();
    if (!core.state) core.newGame();
    for (const id of Object.keys(DB.characters)) markIntroSeen(id);
    core.config.textSpeed = 4; core.config.portraitStyle = style;
    core.config.reduceShake = true;
    window.framingAbort = new AbortController();
    // Silent portrait on the first line gives a genuine simultaneous two-person scene.
    void play({dialogue_id:`__framing_${tag}`,metadata:{bg:'bg_tonari_inside'},lines:[
      {speaker:ids[0],face,text:tag,...(ids[1]?{portrait:ids[1],portrait_face:'normal'}:{})},
    ]},{signal:window.framingAbort.signal,previewProtagonist:true});
  }, {ids,style,face,tag});
  await page.waitForFunction(tag => document.querySelector('.vn-text')?.textContent === tag, tag);
  await page.locator('.vn-portraits img').evaluateAll(async imgs => Promise.all(imgs.map(im=>im.decode())));
  // The engine waits for entry before showing the line. Confirm the actual visual
  // state as well, instead of adding 450ms to every already-settled raster.
  await page.waitForFunction(() => [...document.querySelectorAll('.vn-portraits img')].every(im =>
    !im.classList.contains('enter') && Number(getComputedStyle(im).opacity) > .98 &&
    im.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity)
      .every(a => a.playState === 'finished' || a.playState === 'idle')));
  assert.equal(await page.locator('.vn-portraits img').count(),ids.length);
  return tag;
}
async function inspect(page, label, tag) {
  const rows = await page.locator('.vn-portraits img').evaluateAll(imgs => imgs.map(im => {
    const stage=document.querySelector('#stage').getBoundingClientRect(), r=im.getBoundingClientRect();
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const a=ctx.getImageData(0,0,c.width,c.height).data;
    let top=c.height,bottom=0,opaque=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>=24){opaque++;top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
    let left=c.width,right=0;
    // Upper 24% of the visible silhouette, not anatomical face landmarks.
    const headEnd=top+(bottom-top)*.24;
    for(let y=top;y<headEnd;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>=24){left=Math.min(left,x);right=Math.max(right,x+1);}
    let headSum=0,headCount=0;
    for(let y=top;y<top+(bottom-top)*.2;y++)for(let x=0;x<c.width;x++)if(a[(y*c.width+x)*4+3]>=24){headSum+=x;headCount++;}
    const headCenter=(r.left-stage.left+headSum/headCount*r.width/c.width)*1280/stage.width;
    const k=1280/stage.width;
    return {opaque,headCenter,speaker:im.dataset.speaker,src:im.getAttribute('src'),position:im.dataset.pos,
      top:(r.top-stage.top+top*r.height/c.height)*k,
      headLeft:(r.left-stage.left+left*r.width/c.width)*k,
      headRight:(r.left-stage.left+right*r.width/c.width)*k,
      frame:im.style.cssText};
  }));
  for(const row of rows){
    if(rows.length===1 && row.speaker==='ageha' && row.src.includes('character_variants/new/')) assert.ok(Math.abs(row.headCenter-640)<=1,`${tag}: Ageha upper silhouette must be centered ${JSON.stringify(row)}`);
    assert.ok(row.opaque>0,`${tag}: no visible raster pixels ${JSON.stringify(row)}`);
    assert.ok(row.top>=-.5,`${tag}: clipped upper silhouette ${JSON.stringify(row)}`);
    assert.ok(row.headLeft>=-.5 && row.headRight<=1280.5,`${tag}: horizontally clipped upper silhouette ${JSON.stringify(row)}`);
  }
  if(rows.length===2){const sorted=[...rows].sort((a,b)=>a.headLeft-b.headLeft);
    assert.ok(sorted[0].headRight<=sorted[1].headLeft,`${tag}: overlapping upper silhouettes ${JSON.stringify(rows)}`);
  }
  measurements.push({label,tag,rows});
  await page.screenshot({path:path.join(out,`framing-${label}-${tag}.jpg`),quality:90});
  return rows;
}
await suite('portrait-framing',async check=>{
  for(const [label,options] of [['desktop',{viewport:{width:1280,height:720}}],['landscape-touch',{viewport:{width:844,height:390},hasTouch:true}]]){
    const viewportArg=process.argv.find(arg=>arg.startsWith('--viewport='))?.split('=')[1];
    if(viewportArg && viewportArg!==label)continue;
    await check(`${label}-${process.argv.includes('--cutins-only')?'cutins':'adopted-cast'}`,async page=>{
      await page.evaluate(async()=>{
        const core=await import('./js/core/state.js');const {play}=await import('./js/vn/engine.js');
        core.newGame();core.config.textSpeed=4;core.config.mute=true;
        window.framingAbort=new AbortController();
        void play({dialogue_id:'__default_protagonist',lines:[{speaker:'hajime',text:'__default_protagonist'}]},{signal:window.framingAbort.signal});
      });
      await page.waitForFunction(()=>document.querySelector('.vn-text')?.textContent==='__default_protagonist');
      assert.equal(await page.locator('.vn-portraits img').count(),0,'normal gameplay must keep protagonist off screen');
      const inventory=await page.evaluate(async()=>{const {DB}=await import('./js/core/data.js');
        return {classic:Object.keys(DB.manifest.portraits),variants:{new:DB.manifest.portraitVariants?.new||{}}};
      });
      if(!process.argv.includes('--cutins-only')){
      for(const id of inventory.classic){const tag=await scene(page,[id],'classic');await inspect(page,label,tag);}
      for(const [style,portraits] of Object.entries(inventory.variants))for(const [id,p] of Object.entries(portraits))for(const face of p.faces){const tag=await scene(page,[id],style,face);await inspect(page,label,tag);}
      for(const style of ['classic','new'])for(const ids of [['sumi','tsumugi'],['kumicho','mashiro'],['sumi','minto'],['naru','tsumugi'],['hiyori','adam']]){
        const tag=await scene(page,ids,style);await inspect(page,label,tag);
      }
      }
      const tag=await scene(page,['sumi','tsumugi'],'new');
      const before=await inspect(page,label,tag+'-before-intro');
      for(const art of ['classic','graphic']) {
        await page.evaluate(async art=>{
          const core=await import('./js/core/state.js');
          core.config.introArtStyle=art;core.config.introTransition='morph';core.config.reduceShake=art==='classic';
          // 毎回初対面として流す（#2688 F10: 同じ人物の2回目以降は変身を一閃に落とすため）
          delete core.state.flags._intro_sumi;
          window.framingMorphSeen=false;
          const vn=document.querySelector('#vn');
          const observer=new MutationObserver(()=>{if(vn.classList.contains('intro-morph-dialog-hidden'))window.framingMorphSeen=true;});
          observer.observe(vn,{attributes:true,attributeFilter:['class']});
          const {playIntro}=await import('./js/vn/intro.js');
          window.framingIntro=playIntro('sumi').finally(()=>observer.disconnect());
        },art);
        await page.locator('.cutin.in').waitFor();
        // Wait through the portrait/name entrance, including the graphic morph.
        await page.waitForFunction(()=>{
          const host=document.querySelector('.cutin.in');
          return host && !host.classList.contains('ci-staged') && host.getAnimations({subtree:true})
            .filter(a=>a.effect?.getComputedTiming().iterations!==Infinity)
            .every(a=>a.playState==='finished'||a.playState==='idle');
        });
        assert.ok(await page.locator('.cutin .ci-portrait').evaluate(im=>im.complete && im.naturalWidth>0 && Number(getComputedStyle(im).opacity)>.98),'stable cutin portrait must be visible');
        const introSrc=await page.locator('.cutin .ci-portrait').getAttribute('src');
        if(art==='classic')assert.ok(!introSrc.includes('character_variants/'),'classic cutin must use classic frame source');
        if(art==='graphic')assert.equal(await page.evaluate(()=>window.framingMorphSeen),true,'graphic cutin did not enter standing-portrait morph');
        await page.screenshot({path:path.join(out,`framing-${label}-sumi-intro-${art}.jpg`),quality:90});
        await page.evaluate(()=>window.framingIntro);
        assert.equal(await page.locator('.cutin').count(),0);
        assert.equal(await page.locator('#vn.intro-morph-dialog-hidden').count(),0,'dialogue did not return after morph');
        const after=await inspect(page,label,tag+'-after-intro-'+art);
        assert.deepEqual(after,before,'cutin changed retained portrait framing');
      }
    },options);
  }
},{initScript:()=>localStorage.setItem('suien_remake_config',JSON.stringify({mute:true,textSpeed:4,reduceShake:true,introArtStyle:'classic'}))});
fs.writeFileSync(path.join(out,'portrait-framing-measurements.json'),JSON.stringify(measurements,null,2)+'\n');

