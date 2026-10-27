// Actual browser/VN and isolated storage; no existing player's SAVE is opened.
import assert from 'node:assert/strict';
import {suite, assertFits} from './support.mjs';

await suite('naru-chapter-context', async check => {
  for (const [label, options] of [['pc', {}], ['touch', {viewport:{width:844,height:390},isMobile:true,hasTouch:true}]]) {
    await check(`${label}-chapter2-interrupt-load-fifth-finale`, async page => {
      await page.evaluate(async () => {
        window.N = {core:await import('./js/core/state.js'), spots:await import('./js/daily/spots.js'),
          bonds:await import('./js/daily/bonds.js'), vn:await import('./js/vn/engine.js'),
          ch1:await import('./js/chapters/ch1.js')};
        N.ch1.setupHooks();
        const s=N.core.newGame();
        Object.assign(s,{chapter:2,phase:'daily',day:8,slot:1,money:30000,stamina:100});
        s.met.naru=true;s.flags._intro_naru=true;s.flags._cafe_introduced=true;
        s.story.naru=4;s.affinity.naru=66;
        N.abort=new AbortController();N.vn.vnTest.turbo=false;
        N.pending=N.spots.visitChar('naru',{signal:N.abort.signal});
      });
      const fifth=page.locator('.vn-text').filter({hasText:'今日はゆっくり吸ってけよ'});
      await fifth.waitFor();
      await assertFits(page,'.vn-box');
      await page.locator('.vn-box')[options.hasTouch ? 'tap' : 'click']();
      const interrupted=await page.evaluate(async () => {
        N.abort.abort();const completed=await N.pending;const s=N.core.state;
        return {completed,story:s.story.naru,finale:s.finales.naru??null,
          gifts:s.owned.filter(x=>x==='suyaki_naru').length};
      });
      assert.deepEqual(interrupted,{completed:false,story:4,finale:null,gifts:0});
      // Real state save/load API in this suite's fresh browser localStorage.
      await page.evaluate(() => {
        N.core.saveToSlot('suien_remake_slot1');N.core.newGame();
        if(!N.core.loadFromSlot('suien_remake_slot1'))throw Error('Isolated interrupted slot did not load');
      });
      const resumed=await page.evaluate(async () => {
        N.vn.vnTest.turbo=true;const start=N.vn.backlog().length;
        const completed=await N.spots.visitChar('naru');const s=N.core.state;
        return {completed,chapter:s.chapter,story:s.story.naru,gifts:s.owned.filter(x=>x==='suyaki_naru').length,
          text:N.vn.backlog().slice(start).map(x=>x.text).join('\n')};
      });
      assert.equal(resumed.completed,true);assert.equal(resumed.chapter,2);assert.equal(resumed.story,5);
      assert.equal(resumed.gifts,0);assert.match(resumed.text,/今日はゆっくり吸ってけよ/);
      assert.doesNotMatch(resumed.text,/大会前の最後|本番、よろしく|勝った方が作る/);
      const finale=await page.evaluate(async () => {
        const start=N.vn.backlog().length,completed=await N.spots.visitChar('naru'),s=N.core.state;
        N.core.saveToSlot('suien_remake_slot1');N.core.newGame();N.core.loadFromSlot('suien_remake_slot1');
        const loaded=N.core.state, before=JSON.stringify(loaded), replay=await N.bonds.playFinale('naru');
        return {completed,route:s.finales.naru?.route,gifts:loaded.owned.filter(x=>x==='suyaki_naru').length,
          story:loaded.story.naru,replay,unchanged:JSON.stringify(loaded)===before,
          text:N.vn.backlog().slice(start).map(x=>x.text).join('\n')};
      });
      assert.equal(finale.completed,true);assert.equal(finale.route,'friend');assert.equal(finale.gifts,1);
      assert.equal(finale.story,5);assert.equal(finale.replay,false);assert.equal(finale.unchanged,true);
      assert.match(finale.text,/また一服したくなったか/);
      assert.doesNotMatch(finale.text,/大会前の最後|本番、よろしく/);
    }, options);
  }
});
