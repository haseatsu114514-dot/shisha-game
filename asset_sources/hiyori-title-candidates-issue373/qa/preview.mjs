import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {suite, storageSnapshot, assertFits} from '../../../remake/test/browser/support.mjs';
const out=path.resolve(process.env.ARTIFACT_DIR || '.codex/artifacts/hiyori-candidate-review');fs.mkdirSync(out,{recursive:true});
const ids=['title_art_hiyori_01_twilight_walk','title_art_hiyori_02_window_pause','title_art_hiyori_03_after_rain'];
await suite('hiyori-title-candidate-preview',async check=>{
 for(const [label,viewport,isMobile,hasTouch] of [['pc',{width:1280,height:720},false,false],['mobile',{width:844,height:390},true,true]]){
  await check(label,async page=>{
   await page.locator('.title-art.ready').waitFor();
   const before=await storageSnapshot(page);
   const manifestBefore=await page.evaluate(()=>JSON.stringify(__remake.DB.manifest));
   for(const id of ids){
    await page.evaluate(async id=>{
     const art=await (await import('./js/scenes/title-art.js')).prepareTitleArt({character:'hiyori',file:id+'.png',url:'/asset_sources/hiyori-title-candidates-issue373/'+id+'.png'});
     assertReady(art);
     (await import('./js/scenes/title.js')).showTitle(art);
     function assertReady(a){if(a.character!=='hiyori'||!a.ready)throw Error('Candidate failed to decode');}
    },id);
    await page.locator('.title-art.ready[data-character="hiyori"]').waitFor();
    assert.equal(await page.locator('.title-art').getAttribute('data-art'),id+'.png');
    await assertFits(page,'.title-item');
    await page.locator('.title').evaluate(node=>{for(const a of node.getAnimations({subtree:true})){if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();}});
    await page.screenshot({path:path.join(out,`${label}-${id}.png`)});
   }
   assert.equal(await page.evaluate(()=>JSON.stringify(__remake.DB.manifest)),manifestBefore,'Preview mutated manifest');
   assert.equal(await page.evaluate(()=>__remake.DB.manifest.titleArts.length),JSON.parse(manifestBefore).titleArts.length,'Preview changed adopted art count');
   assert.deepEqual(await storageSnapshot(page),before,'Preview changed save/config');
  },{viewport,isMobile,hasTouch});
 }
});
