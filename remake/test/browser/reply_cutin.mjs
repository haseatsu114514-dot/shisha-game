import assert from 'node:assert/strict';
import { suite } from './support.mjs';
import path from 'node:path';
await suite('reply-cutin',async check=>{
 for(const viewport of [{width:1280,height:720},{width:844,height:390}])for(const style of ['new','classic']){
  await check(`${viewport.width}-${style}`,async page=>{
   await page.evaluate(async style=>{
    const core=await import('./js/core/state.js'),data=await import('./js/core/data.js'),vn=await import('./js/vn/engine.js'),intro=await import('./js/vn/intro.js');
    core.newGame();core.markMet('tsumugi');intro.markIntroSeen('tsumugi');
    Object.assign(core.config,{portraitStyle:style,textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false,skipSeenOnly:false});
    const source=data.DB.dialogues.ch1_tsumugi_second;
    const a=source.lines.findIndex(l=>l.text==='なんか、いいな。煙をそんなふうに見てくれる人がいるって');
    const c=source.lines.findIndex(l=>l.text==='えっ、見てないのに、わかるの？');
    window.replyQA={core,vn,data,source,a,c,start(index){this.controller=new AbortController();this.scene=vn.play({dialogue_id:source.dialogue_id,lines:[source.lines.slice(0,index).findLast(l=>l.speaker==='tsumugi'),source.lines[index],source.lines[index+1],{type:'choice',choices:[{text:'終える'}]}]},{signal:this.controller.signal});}};
    replyQA.start(c);
   },style);
   await page.waitForFunction(()=>document.querySelector('.vn-next.show'));
   await page.waitForTimeout(350);
   await page.locator('.vn-box').click();
   await page.waitForFunction(()=>document.querySelector('.vn-reply-cutin[data-kind=c] .reply-image')?.complete);
   const c=await page.evaluate(()=>{const img=document.querySelector('.vn-reply-cutin .reply-image'),r=img.getBoundingClientRect(),stage=document.querySelector('#stage')?.getBoundingClientRect();return {decoded:img.naturalWidth>0,src:img.src,width:r.width,stage};});
   assert(c.decoded);assert.match(c.src,new RegExp(style==='new'?'character_variants/new/hajime':'sprites/characters/hajime'));
   await page.screenshot({path:path.resolve(process.env.ARTIFACT_DIR||'.codex/artifacts/remake-browser',`reply-cutin-${viewport.width}-${style}-C.png`)});
   const text=await page.locator('.vn-text').textContent();await page.waitForFunction(()=>!document.querySelector('.vn-reply-cutin'));
   assert.equal(await page.locator('.vn-text').textContent(),text,'C does not advance or replace dialogue');
   await page.evaluate(async()=>{replyQA.controller.abort();await replyQA.scene;replyQA.start(replyQA.a);});
   await page.waitForFunction(()=>document.querySelector('.vn-next.show'));
   await page.waitForTimeout(350);
   await page.locator('.vn-box').click();
   await page.waitForFunction(()=>document.querySelector('.vn-reply-cutin[data-kind=a] .reply-image')?.complete);
   assert(await page.locator('.vn-reply-cutin .reply-image').evaluate(n=>n.naturalWidth>0));
   await page.screenshot({path:path.resolve(process.env.ARTIFACT_DIR||'.codex/artifacts/remake-browser',`reply-cutin-${viewport.width}-${style}-A.png`)});
   const before=await page.evaluate(()=>({state:JSON.stringify(replyQA.core.state),log:JSON.stringify(replyQA.vn.backlog())}));
   await page.evaluate(()=>{replyQA.core.config.portraitStyle=replyQA.core.config.portraitStyle==='new'?'classic':'new';replyQA.vn.refreshPortraits();});
   await page.waitForFunction(()=>{const img=document.querySelector('.vn-reply-cutin .reply-image');return img?.complete&&img.naturalWidth>0;});
   assert.deepEqual(await page.evaluate(()=>({state:JSON.stringify(replyQA.core.state),log:JSON.stringify(replyQA.vn.backlog())})),before);
   await page.locator('[data-test="vn-log"]').click();assert.equal(await page.locator('.vn-reply-cutin').count(),0);
   await page.locator('.log-head button').click();assert.equal(await page.locator('.vn-reply-cutin').count(),0);
   await page.locator('.vn-box').click();await page.waitForFunction(()=>document.querySelector('.vn-next.show'));
   await page.locator('.vn-box').click();await page.locator('[data-test="choice-0"]').waitFor();assert.equal(await page.locator('.vn-reply-cutin').count(),0);
   await page.locator('[data-test="choice-0"]').click();await page.evaluate(()=>replyQA.scene);
   assert.equal(await page.locator('.vn-reply-cutin').count(),0);
  },{viewport});
 }
});
