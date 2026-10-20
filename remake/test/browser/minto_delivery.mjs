import assert from 'node:assert/strict';
import fs from 'node:fs';
import { suite } from './support.mjs';
const shots=process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser'; fs.mkdirSync(shots,{recursive:true});
const scene='remake_delivery_minto_handoff';
await suite('minto-delivery',async check=>{
 for(const [device,touch,opts] of [['pc',false,{}],['touch',true,{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
  for(const legacy of [false,true]) for(const mode of ['normal','auto','skip']) await check(`${device}-${mode}-${legacy?'legacy-resume':'new'}-indoors`,async page=>{
   page.setDefaultTimeout(30000);
   await page.evaluate(async ({scene,mode,legacy})=>{
    window.D={core:await import('./js/core/state.js'),vn:await import('./js/vn/engine.js'),calendar:await import('./js/daily/calendar.js'),ch1:await import('./js/chapters/ch1.js'),ui:await import('./js/core/ui.js')};
    const s=D.core.newGame(); Object.assign(s,{phase:'daily',day:2,slot:0,money:10000,stamina:80});
    Object.assign(s.flags,{_c_station_registered:true,_errand_scout_done:true,_delivery_adam_done:true,_delivery_minto_told:true,_morning_2:true,_lime_tut:true,_lime_opened:true});
    if(legacy) {
     // 旧schemaで、みんとの依頼後・引渡し前に中断した保存。
     s.schema=13; s.flags._delivery_minto=true;
     s.flags._tsumugi_contest_research=true; s.affinity.tsumugi=25;
    }
    D.core.save();
    if(!legacy) D.run=D.calendar.runDaily({untilDay:3,nightEvents:{}}).catch(e=>D.error=e.stack);
   },{scene,mode,legacy});
   if(legacy) {
    // 文書を破棄し、本番タイトル→オートセーブLOAD→resumeGameで再開。
    await page.reload({waitUntil:'load'});
    await page.locator('[data-test="title-load"]:not([disabled])').click();
    await page.locator('[data-test="slot-0"]').click();
   }
   await page.locator('[data-test="pin-minto"]').waitFor();
   await page.evaluate(async scene=>{
    window.D={core:await import('./js/core/state.js'),vn:await import('./js/vn/engine.js'),ch1:await import('./js/chapters/ch1.js')};
    const s=D.core.state;
    D.ch1.setupHooks(); D.trace=[]; D.frames=[]; D.mutations=[]; D.inHandoff=false;
    const snapshot=()=>Array.from(document.querySelectorAll('#bg .bg-img')).map(n=>({bg:n.dataset.sceneBg||n.style.backgroundImage,opacity:getComputedStyle(n).opacity}));
    const tick=()=>{if(D.inHandoff) D.frames.push({time:performance.now(),bg:snapshot(),text:document.querySelector('.vn-text')?.textContent});requestAnimationFrame(tick)}; requestAnimationFrame(tick);
    new MutationObserver(()=>{if(D.inHandoff) D.mutations.push(snapshot())}).observe(document.querySelector('#bg'),{subtree:true,childList:true,attributes:true});
    const enter=D.vn.hooks.onEnter;
    D.vn.hooks.onEnter=(id,dlg)=>{enter?.(id,dlg);if(id===scene) D.inHandoff=true}; D.scene=scene; D.done=false;
    D.bg=()=>{const n=document.querySelector('#bg > .bg-img:last-child');return n?.dataset.sceneBg || n?.style.backgroundImage || ''};
    D.vn.hooks.onLine=(id,line)=>{if(id===scene) D.trace.push({text:line.text,speaker:line.speaker,bg:D.bg()});};
    D.before={stats:{...s.stats},statXp:{...s.statXp},affinity:{...s.affinity},story:{...s.story}};
   },scene);
   await (touch?page.locator('[data-test="pin-minto"]').tap():page.locator('[data-test="pin-minto"]').click());
   await (touch?page.locator('[data-test="map-go"]').tap():page.locator('[data-test="map-go"]').click());
   await page.locator('#vn.active .vn-text').waitFor();
   if(mode==='skip') await page.locator('[data-test="vn-skip"]').click();
   // AUTO's real line durations are exercised; normal mode uses pointer/Enter to advance.
   if(mode==='auto') await page.locator('[data-test="vn-auto"]').click();
   let captured=false;
   for(let n=0;n<250;n++) {
    const r=await page.evaluate(()=>({done:!!D.core.state.flags._delivery_minto_done,trace:D.trace,error:D.error}));
    assert.equal(r.error,undefined);
    if(!captured && r.trace.some(l=>l.speaker==='minto')) {
     if(mode==='normal') {
      await page.waitForFunction(()=>document.querySelector('.vn-text')?.textContent.includes('いらっしゃい'));
      await page.locator('#vn').evaluate(async root=>Promise.all(root.getAnimations({subtree:true}).map(a=>a.finished.catch(()=>{}))));
     }
     await page.screenshot({path:`${shots}/${device}-${mode}-${legacy?"legacy":"new"}-delivery-inside.png`});captured=true;
    }
    if(r.done) { await page.evaluate(()=>D.inHandoff=false); break; }
    if(mode==='normal') {
     if(touch) await page.locator('.vn-box').tap(); else await page.keyboard.press('Enter');
    }
    await page.waitForTimeout(mode==='auto'?400:80);
   }
   await page.waitForFunction(()=>D.core.state.flags._delivery_minto_done && D.core.state.slot===1);
   await page.locator('.map:not(.done)').waitFor();
   const result=await page.evaluate(()=>({s:D.core.state,before:D.before,trace:D.trace,frames:D.frames,mutations:D.mutations,saved:JSON.parse(localStorage.getItem(D.core.SAVE_KEY))}));
   assert.equal(result.trace[0].speaker,'minto');
   assert(result.frames.length>0,'No rendered frames recorded');
   fs.writeFileSync(`${shots}/${device}-${mode}-${legacy?'legacy':'new'}-frames.json`,JSON.stringify({frames:result.frames,mutations:result.mutations,trace:result.trace},null,2));
   for(const frame of [...result.frames,...result.mutations.map(bg=>({bg}))]) {
    for(const layer of frame.bg) assert(!/bg_street/.test(layer.bg),`Street background submitted: ${JSON.stringify(frame)}`);
   }
   for(const row of result.trace) assert.match(row.bg,/peppermint/,`${row.text}: ${row.bg}`);
   assert(result.trace.some(l=>l.text?.includes('カウンター脇')));
   assert.equal(result.s.money,12000); assert.equal(result.s.stamina,70); assert.equal(result.s.slot,1);
   for(const key of ['stats','statXp','affinity','story']) assert.deepEqual(result.s[key],result.before[key],key);
   assert.equal(result.s.met.minto,true); assert.equal(result.s.flags.known_name_minto,true);
   assert(!result.s.flags._minto_identity_revealed && !result.s.flags._minto_name_known);
   assert.equal(result.saved.flags._delivery_minto_done,true);
   const replay=await page.evaluate(()=>{
    const money=D.core.state.money; D.core.load(); const s=D.core.state;
    return {money:s.money,same:s.money===money,done:s.flags._delivery_minto_done,slot:s.slot};
   });
   assert.deepEqual(replay,{money:12000,same:true,done:true,slot:1});
  },opts);
 }
});
