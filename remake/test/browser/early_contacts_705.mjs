// #705: play the production visits, legacy exchange path and existing motion.
import assert from 'node:assert/strict';
import {suite} from './support.mjs';

async function setup(page, id, variant='new') {
  await page.evaluate(async ({id,variant})=>{
    const core=await import('./js/core/state.js'), vn=await import('./js/vn/engine.js');
    const spots=await import('./js/daily/spots.js'), data=await import('./js/core/data.js');
    core.newGame(); core.state.phase='daily'; core.state.day=2;
    core.state.flags['_intro_'+id]=true;
    if(variant==='legacy') { core.state.met[id]=true;core.state.story[id]=id==='naru'?1:3; }
    if(variant==='connected') { core.state.met[id]=true;core.state.contacts.push(id); }
    vn.vnTest.turbo=true;
    window.E={core,vn,spots,data,lines:[]};
    vn.hooks.onLine=(_,line)=>E.lines.push(line.text||'');
  },{id,variant});
}
async function visit(page,id) {
  await page.evaluate(id=>{E.run=E.spots.visitChar(id)},id);
  await page.evaluate(()=>E.run);
}
await suite('early-contacts-705',async check=>{
  for(const [device,options] of [['pc',{}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    for(const id of ['naru','adam']) {
      await check(`${device}-${id}-first-and-legacy`,async page=>{
        for(const variant of ['new','legacy','connected']) {
          await setup(page,id,variant);
          if(variant==='new') assert.equal(await page.evaluate(id=>E.spots.hasContact(id),id),false);
          await visit(page,id);
          const snapshot=await page.evaluate(id=>({
            flag:E.core.state.flags['_lime_contact_'+id],met:E.core.state.met[id],
            contacts:E.core.state.contacts.filter(x=>x===id).length,
            exchanges:E.lines.filter(x=>/LIME.*交換|連絡先を交換/.test(x)),
          }),id);
          assert(snapshot.flag&&snapshot.met);
          assert.equal(snapshot.contacts,1);
          assert.equal(snapshot.exchanges.length>0,variant!=='connected',JSON.stringify({variant,snapshot}));
          await page.evaluate(()=>{E.core.save();E.core.newGame();if(!E.core.load())throw Error('Load failed');E.lines=[];});
          assert.equal(await page.evaluate(id=>E.spots.hasContact(id),id),true);
          // New naru's second and adam's later exchange scene must not repeat it.
          await page.evaluate(id=>{
            E.core.state.story[id]=id==='naru'?1:3;
          },id);
          await visit(page,id);
          assert.equal(await page.evaluate(()=>E.lines.filter(x=>/LIME.*交換|連絡先を交換/.test(x)).length),0);
          assert.equal(await page.evaluate(id=>E.core.state.contacts.filter(x=>x===id).length,id),1);
        }
      },options);
      await check(`${device}-${id}-exchange-motion`,async page=>{
        await setup(page,id);
        await page.evaluate(id=>{
          E.vn.vnTest.turbo=false;E.core.config.textSpeed=0;E.core.markMet(id);
          const first=E.data.DB.dialogues['ch1_'+id+'_first'];
          E.run=E.vn.play({dialogue_id:'__705_motion',lines:first.branches.early_lime_exchange});
        },id);
        for(let n=0;n<15&&await page.locator('.mo-lime').count()===0;n++) {
          await page.locator('.vn-next.show').waitFor();
          const prior=await page.locator('.vn-text').textContent();
          if(options.hasTouch)await page.locator('.vn-box').tap();else await page.keyboard.press('Enter');
          await page.waitForFunction(prior=>!!document.querySelector('.mo-lime')||document.querySelector('.vn-text')?.textContent!==prior,prior);
        }
        await page.locator('.mo-lime-toast').waitFor();
        await page.waitForFunction(()=>getComputedStyle(document.querySelector('.mo-lime-toast')).opacity==='1');
        assert.match(await page.locator('.mo-lime').innerText(),id==='naru'?/なる.*友だちに追加しました/s:/アダム.*友だちに追加しました/s);
        await page.screenshot({path:`${process.env.ARTIFACT_DIR||'.codex/artifacts/remake-browser'}/${device}-${id}-exchange.png`});
        await page.locator('.mo-lime').waitFor({state:'detached'});await page.evaluate(()=>E.run);
        assert.equal(await page.evaluate(id=>E.spots.hasContact(id),id),true);
        assert.equal(await page.evaluate(id=>E.core.state.contacts.filter(x=>x===id).length,id),1);
      },options);
    }
  }
  // #833: 実際の初回訪問を最初から送る。SKIP中・動きを減らす設定でも、初めての交換は一度だけ見せる。
  for(const [mode,options] of [['skip',{}],['reduced-motion',{reducedMotion:'reduce'}]]) {
    await check(`naru-first-visit-${mode}-shows-exchange-once`,async page=>{
      await page.evaluate(async()=>{
        const core=await import('./js/core/state.js'),vn=await import('./js/vn/engine.js'),spots=await import('./js/daily/spots.js');
        core.newGame();Object.assign(core.state,{phase:'daily',day:1,slot:0});
        Object.assign(core.config,{textSpeed:0,bgmVolume:0,seVolume:0});vn.vnTest.turbo=false;
        window.E={core,spots,lime:0,done:false};
        new MutationObserver(()=>{if(document.querySelector('.mo-lime'))E.lime=1;}).observe(document.body,{childList:true,subtree:true});
        spots.visitChar('naru').then(()=>{E.done=true;});
      });
      if(mode==='skip'){await page.locator('#vn.active').waitFor();await page.getByText('SKIP',{exact:true}).first().click();}
      for(let i=0;i<600&&!(await page.evaluate(()=>E.done));i++){
        const choice=page.locator('.vn-choices.show button:not(:disabled)');
        if(await choice.count())await choice.first().click({timeout:1000}).catch(()=>{});
        else if(mode!=='skip')await page.keyboard.press('Enter');
        await page.waitForTimeout(100);
      }
      const r=await page.evaluate(()=>({done:E.done,lime:E.lime,shown:!!E.core.state.flags._lime_exchange_shown_naru,contact:E.spots.hasContact('naru')}));
      assert.deepEqual(r,{done:true,lime:1,shown:true,contact:true});
    },options);
  }
});
