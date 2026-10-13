import assert from 'node:assert/strict';
import {suite,assertFits} from './support.mjs';
async function setup(page){await page.evaluate(async()=>{
 window.W={core:await import('./js/core/state.js'),data:await import('./js/core/data.js'),vn:await import('./js/vn/engine.js'),daily:await import('./js/daily/hiyori.js'),route:await import('./js/core/hiyori-route.js'),bonds:await import('./js/daily/bonds.js'),romance:await import('./js/daily/romance.js')};
 (await import('./js/chapters/ch1.js')).setupHooks();
 W.fresh=()=>{const s=W.core.newGame();Object.assign(s,{phase:'daily',day:10,slot:1,money:90000,stamina:80});s.met.hiyori=true;s.contacts.push('hiyori');s.affinity.hiyori=59;
  for(const f of ['_intro_hiyori','_hiyori_meeting_done','_hiyori_sumi_message_done','_hiyori_message_delivered','_hiyori_cracks_done','_hiyori_tonari_return_done','_hiyori_tonari_followup_done','_hiyori_tonari_afterwork_done','_hiyori_real_self_known'])s.flags[f]=true;
  W.core.config.textSpeed=4;W.vn.vnTest.turbo=true;W.vn.vnTest.choose=()=>0;return s;};W.fresh();
 W.snapshot=()=>{const s=W.core.state;return {money:s.money,stamina:s.stamina,affinity:s.affinity.hiyori,story:s.story.hiyori||0,work:!!s.flags._hiyori_work_talk_done,q1:!!s.flags._hiyori_bond_question_done,q2:!!s.flags._hiyori_bond_finale_done,lovers:s.lovers,finales:s.finales,choices:s.romanceChoices};};
 W.syntheticGift=()=>{W.data.DB.hiyori.route.finale.gift='silicone_bowl';};
});}
async function work(page,answer=0){return page.evaluate(async answer=>{W.vn.vnTest.choose=()=>answer;return W.daily.playHiyoriEvent('work_talk');},answer);}
await suite('hiyori-work-relationship',async check=>{
 await check('only-real-self-read-unlocks-work-and-no-gift-unlocks-finale',async page=>{
  await setup(page);const r=await page.evaluate(async()=>{const s=W.core.state;s.affinity.hiyori=100;delete s.flags._hiyori_real_self_known;const before=JSON.stringify(s),early=await W.daily.playHiyoriEvent('work_talk');
   return {early,same:JSON.stringify(s)===before,finale:W.bonds.finaleDue('hiyori'),status:W.route.hiyoriEventStatus('work_talk')};});
  assert(!r.early&&r.same&&!r.finale);assert.equal(r.status,'prerequisites');
 });
 for(const answer of [0,1])await check('actual-work-and-q1-'+answer,async page=>{
  await setup(page);assert(await work(page,answer));const r=await page.evaluate(async()=>{const before=W.snapshot(),replay=await W.daily.playHiyoriEvent('work_talk');W.core.saveToSlot('suien_remake_slot1');W.core.newGame();W.core.loadFromSlot('suien_remake_slot1');return {before,replay,after:W.snapshot(),finale:W.bonds.finaleDue('hiyori'),romance:W.romance.romanceRouteOpen('hiyori')};});
  assert(r.before.work&&r.before.q1&&!r.before.q2&&!r.replay&&!r.finale&&!r.romance);assert.equal(r.before.choices.bond_q1_hiyori.value,answer);assert.equal(r.before.story,1);assert.equal(r.before.money,90000);assert.equal(r.before.stamina,80);assert.deepEqual(r.after,r.before);
 });
 await check('q1-saved-answer-zero-needs-read-reaction-and-resumes-once',async page=>{
  await setup(page);await page.evaluate(()=>{const prev=W.vn.hooks.onLine;W.vn.hooks.onLine=(id,line)=>{prev?.(id,line);if(id==='hiyori_bond_question'&&line.speaker==='hiyori'&&W.core.state.romanceChoices.bond_q1_hiyori)W.vn.vnTest.turbo=false;};W.run=W.daily.playHiyoriEvent('work_talk');});
  await page.waitForFunction(()=>W.core.state.romanceChoices.bond_q1_hiyori&&document.querySelector('#vn.active .vn-next.show'));
  const r=await page.evaluate(()=>{const s=W.core.state;W.savedAffinity=s.affinity.hiyori;const q1=s.flags._hiyori_bond_question_done;W.core.saveToSlot('suien_remake_slot1');W.core.newGame();W.core.loadFromSlot('suien_remake_slot1');return {q1,answer:W.core.state.romanceChoices.bond_q1_hiyori.value};});
  assert(!r.q1);assert.equal(r.answer,0);assert(!await page.evaluate(()=>W.run));
  const end=await page.evaluate(async()=>{W.vn.hooks.onLine=null;W.vn.vnTest.turbo=true;const resumed=await W.daily.meetHiyoriAtTonari();return {resumed,question:W.core.state.flags._hiyori_bond_question_done,value:W.core.state.romanceChoices.bond_q1_hiyori.value,unchanged:W.core.state.affinity.hiyori===W.savedAffinity,finale:W.bonds.finaleDue('hiyori')};});
  assert(end.resumed&&end.question&&end.unchanged&&!end.finale,JSON.stringify(end));assert.equal(end.value,0);
 });
 await check('load-during-work-stops-old-vn-with-no-new-state-reward',async page=>{
  await setup(page);await page.evaluate(()=>{W.vn.vnTest.turbo=false;W.run=W.daily.playHiyoriEvent('work_talk');});await page.locator('#vn.active .vn-next.show').waitFor();
  await page.evaluate(()=>{W.core.newGame();W.freshState=JSON.stringify(W.core.state);});assert(!await page.evaluate(()=>W.run));assert(!await page.evaluate(()=>W.vn.isPlaying()));assert(await page.evaluate(()=>JSON.stringify(W.core.state)===W.freshState));
 });
 for(const [r1,r2,route] of [[0,0,'friend'],[1,0,'friend'],[1,1,'romance']])await check('formal-finale-with-explicit-gift-fixture-'+r1+'-'+r2,async page=>{
  await setup(page);assert(await work(page,r1));const r=await page.evaluate(async({r2})=>{W.syntheticGift();W.core.state.affinity.hiyori=66;W.vn.vnTest.choose=()=>r2;const done=await W.bonds.playFinale('hiyori');return {done,route:W.core.state.finales.hiyori?.route,flag:W.core.state.flags._hiyori_bond_finale_done,q2:W.core.state.romanceChoices.bond_q2_hiyori?.value,open:W.romance.romanceRouteOpen('hiyori')};},{r2});
  assert(r.done&&r.flag);assert.equal(r.route,route);if(r1===0)assert.equal(r.q2,undefined);else assert.equal(r.q2,r2);assert.equal(r.open,route==='romance');
 });
 await check('actual-two-answers-and-confession-accept-reject',async page=>{
  await setup(page);for(const accept of [true,false]){
   await page.evaluate(()=>W.fresh());assert(await work(page,1));
   const r=await page.evaluate(async accept=>{W.syntheticGift();W.core.state.affinity.hiyori=66;W.vn.vnTest.choose=()=>1;await W.bonds.playFinale('hiyori');W.vn.vnTest.choose=()=>accept?0:1;await W.vn.play('confession_hiyori');return {lovers:W.core.state.lovers,friend:W.route.hiyoriIsFriend(),q1:W.core.state.romanceChoices.bond_q1_hiyori.value,q2:W.core.state.romanceChoices.bond_q2_hiyori.value};},accept);
   assert.equal(r.lovers.includes('hiyori'),accept);assert.equal(r.friend,!accept);assert.equal(r.q1,1);assert.equal(r.q2,1);
  }
 });
 await check('confession-cannot-bypass-unread-and-existing-relationships',async page=>{
  await setup(page);const r=await page.evaluate(async()=>{await W.vn.play('confession_hiyori_accept');const early=[...W.core.state.lovers];const results=[];
   for(const type of ['friend','lover']){const s=W.fresh();s.finales.hiyori={route:type==='friend'?'friend':'lover',day:4,chapter:1};s.flags._friend_hiyori=type==='friend';s.lovers=type==='lover'?['hiyori','rin']:['rin'];s.lovePts.hiyori=12;s.loveLevel.hiyori=2;const before=JSON.stringify({finales:s.finales,lovers:s.lovers,lovePts:s.lovePts,loveLevel:s.loveLevel,friend:s.flags._friend_hiyori});await W.daily.playHiyoriEvent('work_talk');await W.vn.play('confession_hiyori_accept');results.push(before===JSON.stringify({finales:s.finales,lovers:s.lovers,lovePts:s.lovePts,loveLevel:s.loveLevel,friend:s.flags._friend_hiyori}));}return {early,results};});
  assert.deepEqual(r.early,[]);assert(r.results.every(Boolean));
 });
 await check('lime-inbox-and-future-appointment-survive-work',async page=>{
  await setup(page);await page.evaluate(()=>{const s=W.core.state;s.pendingInvite={sender:'rin',day:11,slot:1,event:'date_rin'};s.inbox=[{id:'keep',read:false,msg:{sender:'rin'},log:['keep']}];W.lime=JSON.stringify({inbox:s.inbox,invite:s.pendingInvite});});assert(await work(page,0));assert(await page.evaluate(()=>JSON.stringify({inbox:W.core.state.inbox,invite:W.core.state.pendingInvite})===W.lime));
 });
 for(const [label,opts] of [['pc',{}],['touch',{viewport:{width:844,height:390},isMobile:true,hasTouch:true}]])await check(label+'-real-serious-and-love-blush',async page=>{
  await setup(page);
  for(const face of ['serious','love_blush']){
   await page.evaluate(face=>{W.vn.vnTest.turbo=false;const source=W.data.DB.dialogues[face==='serious'?'hiyori_work_talk':'hiyori_bond_question'];W.visual=W.vn.play({dialogue_id:'visual_'+face,metadata:source.metadata,lines:[source.lines.find(l=>l.face===face)]});},face);
   await page.locator('#vn.active .vn-next.show').waitFor();await assertFits(page,'.vn-box,.vn-text,.vn-inner:not([hidden])');
   const image=page.locator('img[data-speaker="hiyori"]');assert.equal(await image.count(),1);assert((await image.getAttribute('src')).endsWith('chr_hiyori_'+face+'.webp'));assert(await image.evaluate(i=>i.complete&&i.naturalWidth===896&&i.naturalHeight===1200));
   // 小さい画面の改ページも実入力で最後まで読む。未解決Promiseで検証を止めない。
   for(let n=0;n<5&&await page.evaluate(()=>W.vn.isPlaying());n++){
    await page.waitForFunction(()=>!W.vn.isPlaying()||document.querySelector('#vn.active .vn-next.show'));
    await page.waitForTimeout(350);
    if(label==='touch')await page.locator('.vn-box').tap();else await page.locator('.vn-box').click();
   }
   await page.waitForFunction(()=>!W.vn.isPlaying());await page.evaluate(()=>W.visual);
  }
 },opts);
});
