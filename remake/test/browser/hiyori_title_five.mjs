import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { suite, storageSnapshot, assertFits } from "./support.mjs";
const filenames=["title_art_hiyori_01_twilight_walk.png","title_art_hiyori_02_window_pause.png","title_art_hiyori_03_after_rain.png","title_art_hiyori_04_daylight_bookshop.png","title_art_hiyori_05_ramen_break.png"];
const output=process.env.COMPARISON_DIR;
if(output) await fs.mkdir(output,{recursive:true});
async function loadedFriend(page) {
  await page.evaluate(async()=>{
    const core=await import("./js/core/state.js"),route=await import("./js/core/hiyori-route.js");
    const s=core.newGame();s.met.hiyori=true;s.flags._friend_hiyori=true;s.flags._hiyori_real_self_known=false;
    s.finales.hiyori={route:"friend",chapter:1,day:4};s.lovers=["rin"];s.affinity.hiyori=66;s.money=45678;s.stamina=71;
    s.contacts.push("hiyori");s.inbox=[{id:"keep",read:true,log:["keep"]}];s.pendingInvite={sender:"hiyori",day:10,slot:1};
    core.save();window.titleCheck={core,route,before:JSON.stringify(core.state),friendBefore:route.hiyoriIsFriend()};
  });
  assert(await page.evaluate(()=>titleCheck.friendBefore));
}
async function selected(page, target, index) {
  return page.evaluate(async({target,index})=>{
    const data=await import("./js/core/data.js"),loader=await import("./js/scenes/title-art.js"),title=await import("./js/scenes/title.js");
    const characters=[...new Set(data.DB.manifest.titleArts.map(a=>a.character))];
    let previous=document.querySelector(".title-art").dataset.character;
    const pick=(id,n)=>{
      const fresh=characters.filter(c=>c!==previous), images=data.DB.manifest.titleArts.filter(a=>a.character===id);
      const original=Math.random;let calls=0;
      try {Math.random=()=>calls++===0?(fresh.indexOf(id)+.5)/fresh.length:(n+.5)/images.length;return loader.pickTitleArt();}
      finally {Math.random=original;}
    };
    if(previous===target){const away=characters.find(c=>c!==target);const a=pick(away,0);if(a.character!==away)throw Error("Consecutive character guard failed");previous=away;}
    const art=pick(target,index);if(art.character!==target)throw Error("Character weight changed");
    title.showTitle(await loader.prepareTitleArt(art));return art;
  },{target,index});
}
await suite("hiyori-title-five",async check=>{
  await check("uniform-character-and-five-image-buckets",async page=>{
    const before=await storageSnapshot(page);
    const result=await page.evaluate(async()=>{
      const data=await import("./js/core/data.js"),characters=[...new Set(data.DB.manifest.titleArts.map(a=>a.character))];
      const chosen=[];
      for(let i=0;i<characters.length;i++){
        const loader=await import("./js/scenes/title-art.js?character_probe="+i),original=Math.random;let calls=0;
        try{Math.random=()=>calls++===0?(i+.5)/characters.length:.49;chosen.push(loader.pickTitleArt().character);}
        finally{Math.random=original;}
      }
      return {characters,chosen};
    });
    assert.deepEqual(result.chosen,result.characters,"A five-image heroine must not get a larger character weight");
    assert.equal(result.characters.length,7);
    const chosen=[];
    for(let n=0;n<5;n++){const art=await selected(page,"hiyori",n);chosen.push(art.file);}
    assert.deepEqual(chosen,filenames,"Every equal image bucket must select its real registered image");
    assert.deepEqual(await storageSnapshot(page),before);
  });
  for(const [label,options] of [
    ["pc",{viewport:{width:1280,height:720}}],
    ["touch-landscape",{viewport:{width:844,height:390},isMobile:true,hasTouch:true}],
    ["touch-portrait-rotation",{viewport:{width:390,height:844},isMobile:true,hasTouch:true}],
  ]) await check(label,async page=>{
    if(label==="touch-portrait-rotation") {
      await page.locator("#rotate-hint").waitFor({state:"visible"});
      await page.setViewportSize({width:844,height:390});
    }
    await page.locator("#rotate-hint").waitFor({state:"hidden"});
    await loadedFriend(page);const before=await storageSnapshot(page);
    for(let n=0;n<5;n++){
      const art=await selected(page,"hiyori",n);await page.locator(".title-art.ready").waitFor();
      assert.equal(art.file,filenames[n]);assert.equal(await page.locator(".title-art").getAttribute("data-art"),filenames[n]);
      assert(await page.locator(".title-art").evaluate(async node=>{
        const image=new Image();image.src=node.style.backgroundImage.slice(5,-2);await image.decode();
        return image.naturalWidth===1024&&image.naturalHeight===1536;
      }));
      await assertFits(page,".title-item");
      await page.locator(".title").evaluate(root=>{for(const a of root.getAnimations({subtree:true}))if(Number.isFinite(a.effect.getComputedTiming().endTime))a.finish();});
      if(output) await page.screenshot({path:output+"/"+label+"-"+filenames[n]});
    }
    assert.deepEqual(await storageSnapshot(page),before);
    assert(await page.evaluate(()=>JSON.stringify(titleCheck.core.state)===titleCheck.before));
    assert(await page.evaluate(()=>titleCheck.route.hiyoriIsFriend()===titleCheck.friendBefore));
  },options);
  await check("legacy-and-multiple-lovers-preserved",async page=>{
    await page.evaluate(()=>{
      localStorage.setItem("suien_remake_save",JSON.stringify({schema:5,money:45678,stamina:71,lovers:["hiyori","rin"],flags:{_hiyori_real_self_known:false},affinity:{hiyori:88},inbox:[{id:"keep",read:true}],pendingInvite:{sender:"hiyori",day:10,slot:1}}));
      sessionStorage.setItem("keep","unchanged");
    });
    const before=await storageSnapshot(page);
    for(let n=0;n<5;n++)await selected(page,"hiyori",n);
    assert.deepEqual(await storageSnapshot(page),before);
  });
});
