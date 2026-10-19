import assert from 'node:assert/strict';
import {suite,assertFits} from './support.mjs';
async function setup(page){await page.evaluate(async()=>{
 window.W={core:await import('./js/core/state.js'),data:await import('./js/core/data.js'),vn:await import('./js/vn/engine.js'),daily:await import('./js/daily/hiyori.js'),route:await import('./js/core/hiyori-route.js'),bonds:await import('./js/daily/bonds.js'),romance:await import('./js/daily/romance.js')};
 (await import('./js/chapters/ch1.js')).setupHooks();
 // 未登録機材を前提とする既存の拒否ケース。正式機材の接続はhiyori_hagal.mjsで別に検証する。
 W.data.DB.hiyori.route.finale.gift=null;
 W.fresh=()=>{const s=W.core.newGame();Object.assign(s,{phase:'daily',day:10,slot:1,money:90000,stamina:80});s.met.hiyori=true;s.contacts.push('hiyori');s.affinity.hiyori=59;
  for(const f of ['_intro_hiyori','_hiyori_meeting_done','_hiyori_sumi_message_done','_hiyori_message_delivered','_hiyori_cracks_done','_hiyori_tonari_return_done','_hiyori_tonari_followup_done','_hiyori_tonari_afterwork_done','_hiyori_real_self_known'])s.flags[f]=true;
  W.core.config.textSpeed=4;W.vn.vnTest.turbo=true;W.vn.vnTest.choose=()=>0;return s;};W.fresh();
 W.snapshot=()=>{const s=W.core.state;return {money:s.money,stamina:s.stamina,affinity:s.affinity.hiyori,story:s.story.hiyori||0,work:!!s.flags._hiyori_work_talk_done,q1:!!s.flags._hiyori_bond_question_done,q2:!!s.flags._hiyori_bond_finale_done,lovers:s.lovers,finales:s.finales,choices:s.romanceChoices};};
 W.syntheticGift=()=>{W.data.DB.hiyori.route.finale.gift='silicone_bowl';};
});}
async function work(page,answer=0){return page.evaluate(async answer=>{W.vn.vnTest.choose=()=>answer;return W.daily.playHiyoriEvent('work_talk');},answer);}
await suite('hiyori-work-relationship',async run=>{
 const check=(label,...args)=>!process.env.TEST_CASES||label.includes(process.env.TEST_CASES)?run(label,...args):Promise.resolve();
 await check('tonari-presence-question-can-play',async page=>{
  await setup(page);
  for(const chapter of [1,2])for(const answer of [null,0,1]){
   const before=await page.evaluate(async({chapter,answer})=>{
    const s=W.fresh();s.chapter=chapter;s.flags._hiyori_work_talk_done=true;
    if(answer!==null)s.romanceChoices.bond_q1_hiyori={char:'hiyori',value:answer,day:s.day};
    W.people=await import('./js/daily/spot-people.js');W.spots=await import('./js/daily/spots.js');
    const snapshot=JSON.stringify(s),present=W.daily.hiyoriAtTonari(),listed=W.people.spotPeople(W.spots.spotById('tonari')).some(p=>p.id==='hiyori');
    window.mapFlow=(await import('./js/daily/map.js')).chooseSpot();
    return {present,listed,unchanged:snapshot===JSON.stringify(s)};
   },{chapter,answer});
   assert(before.present&&before.listed&&before.unchanged,JSON.stringify({chapter,answer,before}));
   await page.locator('[data-test="pin-tonari"] img[alt="ひより"]').waitFor();
   const after=await page.evaluate(async()=>{const played=await W.daily.meetHiyoriAtTonari();return {played,done:W.core.state.flags._hiyori_bond_question_done,value:W.core.state.romanceChoices.bond_q1_hiyori.value,present:W.daily.hiyoriAtTonari()};});
   assert(after.played&&after.done&&!after.present,JSON.stringify(after));assert.equal(after.value,answer??0);
  }
 });
 await check('tonari-presence-question-unavailable',async page=>{
  await setup(page);
  const results=await page.evaluate(async()=>{
   const people=await import('./js/daily/spot-people.js'),spots=await import('./js/daily/spots.js');
   const route=structuredClone(W.data.DB.hiyori.route),dialogue=route.question.dialogue,scene=W.data.DB.dialogues[dialogue];
   const cases={
    chapter3:s=>s.chapter=3,chapter4:s=>s.chapter=4,
    disabled:()=>W.data.DB.hiyori.route.enabled=false,
    unread_reveal:s=>delete s.flags._hiyori_real_self_known,
    unmet:s=>s.met.hiyori=false,
    missing_flag:()=>delete W.data.DB.hiyori.route.question.flag,
    completed:s=>s.flags[route.question.flag]=true,
    configured_completed:s=>{W.data.DB.hiyori.route.question.flag='_configured_question_done';s.flags._configured_question_done=true;},
    missing_script:()=>delete W.data.DB.dialogues[dialogue],
    empty_script:()=>W.data.DB.dialogues[dialogue]={...scene,lines:[]},
    preview_script:()=>W.data.DB.dialogues[dialogue]={...scene,metadata:{...scene.metadata,preview_only:true}},
    lover:s=>s.lovers.push('hiyori'),friend:s=>s.flags._friend_hiyori=true,
    finale_seen:s=>s.finales.hiyori={route:'friend',day:s.day,chapter:s.chapter},
    invalid_answer:s=>s.romanceChoices[route.question.choice]={char:'hiyori'},
    other_answer:s=>s.romanceChoices[route.question.choice]={char:'rin',value:1},
    negative_answer:s=>s.romanceChoices[route.question.choice]={char:'hiyori',value:-1},
    nan_answer:s=>s.romanceChoices[route.question.choice]={char:'hiyori',value:NaN},
   },out=[];
   for(const [label,change] of Object.entries(cases)){
    W.data.DB.hiyori.route=structuredClone(route);W.data.DB.dialogues[dialogue]=scene;
    const s=W.fresh();s.flags._hiyori_work_talk_done=true;change(s);
    const snapshot=JSON.stringify(s),present=W.daily.hiyoriAtTonari(),listed=people.spotPeople(spots.spotById('tonari')).some(p=>p.id==='hiyori');
    const played=await W.daily.meetHiyoriAtTonari();out.push({label,present,listed,played,unchanged:snapshot===JSON.stringify(s)});
   }
   W.data.DB.hiyori.route=route;W.data.DB.dialogues[dialogue]=scene;return out;
  });
  for(const r of results)assert(!r.present&&!r.listed&&!r.played&&r.unchanged,JSON.stringify(r));
 });
 await check('tonari-presence-chapter3-map-hides-blocked-question',async page=>{
  await setup(page);await page.evaluate(async()=>{const s=W.core.state;s.chapter=3;s.flags._hiyori_work_talk_done=true;window.mapFlow=(await import('./js/daily/map.js')).chooseSpot();});
  await page.locator('[data-test="pin-tonari"] .pin-people').waitFor();
  assert.equal(await page.locator('[data-test="pin-tonari"] img[alt="ひより"]').count(),0);
  assert(!await page.evaluate(()=>W.daily.meetHiyoriAtTonari()));
 });
 await check('tonari-presence-other-encounters-and-chapter3-finale',async page=>{
  await setup(page);const results=await page.evaluate(async()=>{
   const out=[];
   for(const id of ['tonari_followup','tonari_afterwork','work_talk']){
    const s=W.fresh();
    if(id==='tonari_followup')delete s.flags._hiyori_tonari_followup_done;
    if(id!=='work_talk'){delete s.flags._hiyori_tonari_afterwork_done;delete s.flags._hiyori_real_self_known;}
    const present=W.daily.hiyoriAtTonari(),played=await W.daily.meetHiyoriAtTonari();
    out.push({id,present,played,done:!!s.flags[W.route.hiyoriRoute().events.find(e=>e.id===id).flag]});
   }
   const report=W.fresh();report.flags={_hiyori_meeting_done:true};
   out.push({id:'sumi_message',present:W.daily.hiyoriAtTonari(),played:await W.daily.meetHiyoriAtTonari(),done:!!report.flags._hiyori_sumi_message_done});
   const s=W.fresh();s.chapter=3;s.affinity.hiyori=66;s.flags._hiyori_work_talk_done=s.flags._hiyori_bond_question_done=true;
   s.romanceChoices.bond_q1_hiyori={char:'hiyori',value:0,day:s.day};W.data.DB.hiyori.route.finale.gift='suyaki_hiyori';
   s.slot=0;const daytime=W.daily.hiyoriAtTonari();s.slot=1;
   const present=W.daily.hiyoriAtTonari(),played=await W.daily.meetHiyoriAtTonari();
   return {out,finale:{daytime,present,played,done:!!s.flags._hiyori_bond_finale_done,remaining:W.daily.hiyoriAtTonari(),gifts:s.owned.filter(id=>id==='suyaki_hiyori').length}};
  });
  for(const r of results.out)assert(r.played&&r.done&&r.present===(r.id!=='sumi_message'),JSON.stringify(r));
  const f=results.finale;assert(!f.daytime&&f.present&&f.played&&f.done&&!f.remaining,JSON.stringify(f));assert.equal(f.gifts,1);
 });
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
 await check('q2-saved-zero-resumes-reaction-without-a-second-answer',async page=>{
  await setup(page);assert(await work(page,1));
  await page.evaluate(()=>{W.syntheticGift();W.core.state.affinity.hiyori=66;W.vn.vnTest.choose=()=>0;const previous=W.vn.hooks.onLine;W.vn.hooks.onLine=(id,line)=>{previous?.(id,line);if(id==='hiyori_bond_finale'&&line.speaker==='hiyori'&&W.core.state.romanceChoices.bond_q2_hiyori)W.vn.vnTest.turbo=false;};W.run=W.daily.meetHiyoriAtTonari();});
  await page.waitForFunction(()=>W.core.state.romanceChoices.bond_q2_hiyori&&document.querySelector('#vn.active .vn-next.show'));
  const before=await page.evaluate(()=>{const s=W.core.state;const done=!!s.flags._hiyori_bond_finale_done,route=s.finales.hiyori;W.core.saveToSlot('suien_remake_slot1');W.core.newGame();W.core.loadFromSlot('suien_remake_slot1');return {done,route};});
  assert(!before.done&&!before.route);assert(!await page.evaluate(()=>W.run));
  const result=await page.evaluate(async()=>{W.vn.hooks.onLine=null;W.vn.vnTest.turbo=true;W.vn.vnTest.choose=()=>{throw Error('Saved Q2 must not ask again');};const resumed=await W.daily.meetHiyoriAtTonari();return {resumed,route:W.core.state.finales.hiyori.route,answer:W.core.state.romanceChoices.bond_q2_hiyori.value,flag:W.core.state.flags._hiyori_bond_finale_done};});
  assert(result.resumed&&result.flag);assert.equal(result.route,'friend');assert.equal(result.answer,0);
 });
 await check('malformed-or-other-character-answer-cannot-settle-hiyori',async page=>{
  await setup(page);assert(await work(page,1));
  const r=await page.evaluate(async()=>{W.syntheticGift();W.core.state.affinity.hiyori=66;
   W.core.state.romanceChoices.bond_q1_hiyori={char:'hiyori'};const missing=W.bonds.finaleDue('hiyori');
   W.core.state.romanceChoices.bond_q1_hiyori={char:'hiyori',value:1,day:10};W.core.state.romanceChoices.bond_q2_hiyori={char:'rin',value:1,day:10};
   const before=JSON.stringify(W.core.state);const done=await W.bonds.playFinale('hiyori');return {missing,done,same:JSON.stringify(W.core.state)===before};});
  assert(!r.missing&&!r.done&&r.same);
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
