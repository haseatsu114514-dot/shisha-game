// #662: normal production practice pipeline, including both care rounds, and saved boundary recovery.
// Existing craftTest.auto resolves timing games; real-input coverage lives in materials/progress/steam suites.
import assert from 'node:assert/strict';
import { suite } from './support.mjs';
await suite('craft-routes', async check => {
  for (const [device, options] of [['pc', {}], ['touch', {viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    for (const coached of [false,true]) await check(`${device}-${coached ? 'tutorial':'normal'}-full-and-load`, async page => {
      await page.evaluate(async coached => {
        const core=await import('./js/core/state.js'); core.newGame();
        const session=await import('./js/craft/session.js'), practice=await import('./js/craft/practice.js');
        window.R={core,session,practice,seen:[],done:false,error:null};
        core.saveToSlot('suien_remake_slot1');
        R.saved=JSON.stringify(core.readSlot('suien_remake_slot1'));
        R.watch=new MutationObserver(() => {
          const panel=document.querySelector('.bench-panel');
          const step=panel?.dataset.step;
          if(step && R.seen.at(-1)!==step)R.seen.push(step);
          if(document.querySelector('.result-card.show')){
            const mark=document.querySelector('.rc-evaluation')?.textContent;
            if(!['◎','○','△'].includes(mark))R.error='Result mark missing';
          }
        });
        R.watch.observe(document.getElementById('screen'),{subtree:true,childList:true,attributes:true,attributeFilter:['data-step','class']});
        session.craftTest.auto='good';
        R.run=practice.runFullPractice({coached}).then(cs=>{R.cs=cs;R.done=true;}).catch(e=>{R.error=String(e);R.done=true;});
      },coached);
      await page.waitForFunction(()=>R.done,{},{timeout:120000});
      const result=await page.evaluate(()=>({error:R.error,seen:R.seen,failed:R.cs?.failed,care:R.cs?.careHistory?.length,records:R.practice.practiceRecords()}));
      assert.equal(result.error,null);assert(!result.failed);assert.equal(result.care,2);
      for(const step of ['mix','pack','holes','place','heat','steam','pull','care'])assert(result.seen.includes(step),`Missing transition ${step}: ${result.seen}`);
      assert.equal(result.records.length,1);assert.equal(result.records[0].served,true);assert.equal(result.records[0].adjustments,2);
      assert.equal(await page.evaluate(()=>JSON.stringify(R.core.readSlot('suien_remake_slot1'))===R.saved),true,'Practice rewrote the manual save');
      await page.evaluate(()=>{R.watch.disconnect();R.session.craftTest.auto=null;R.core.loadFromSlot('suien_remake_slot1');});
      assert.equal(await page.evaluate(()=>R.practice.practiceRecords().length),0,'LOAD failed to restore the pre-practice boundary');
    },options);
  }
});
