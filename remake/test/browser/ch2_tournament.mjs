// DAY14朝の旧保存を入口とするfixture。自然なDAY13→14はch2_storyが別途検証する。
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shots=process.env.SHOTS;
if(shots)fs.mkdirSync(shots,{recursive:true});
const capture=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`});};
import { suite, assertFits } from './support.mjs';
const t = name => `[data-test="ch2-tournament-${name}"]`;
const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(()=>structuredClone(window.__remake.state));
async function seed(page, { known = false, stage = '', auto = 'good' } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async opts => {
    const core = await import('./js/core/state.js'); const s = core.newGame();
    Object.assign(s,{ chapter:2,day:28,slot:0,phase:'daily',money:23456,stamina:100,
      flavorStock:{double_apple:40,mint:12},lovers:['minto'],loverSince:{minto:10},lastDate:{minto:25},contacts:['sumi','minto'],
      keepsakes:['qa_memory'],relationshipMemories:['tsumugi_creature'] });
    s.flags = { _elapsed_calendar:true,_ch1_cleared:true,_ch2_day1:{startDay:15,stage:'complete'},_ch2_eve_done:true,_ch2_taste_distant:true };
    s.stats={technique:42,sense:42,guts:42,charm:42,insight:42};
    s.inbox=[{id:'qa_old',originId:'qa_old',day:20,read:true,done:true,replyState:'none',log:[{text:'大切な約束'}],msg:{sender:'minto',type:'message',messages:['また会おうね']}}];
    s.tournament.lastRank=1; s.tournament.lastTotal=88;
    if(opts.known) for(const who of ['ageha','kumicho','rei'])s.met[who]=true;
    for(const who of ['ageha','kumicho','rei','pakki','maezono','dr_kemuri','nagumo','hajime','sumi'])s.flags[`_intro_${who}`]=true;
    if(opts.stage) (await import('./js/chapters/ch2-tournament-state.js')).tournamentProgress(s).stage=opts.stage;
    Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});core.saveConfig();core.save();
    const vn=await import('./js/vn/engine.js'); (await import('./js/chapters/ch1.js')).setupHooks();
    vn.vnTest.turbo=true; vn.vnTest.choose=()=>0;
    window.__texts=[];window.__trace=[];
    vn.hooks.onLine=(id,line)=>{if(window.__trace.at(-1)!==id)window.__trace.push(id);if(line.text)window.__texts.push(line.text);};
    (await import('./js/craft/session.js')).craftTest.auto=opts.auto;
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
  }, {known,stage,auto});
}
async function phone(page,touch=false) {
  await page.locator(dt('phone-next')).waitFor();
  if(touch)await page.locator(dt('phone-next')).tap();else await page.locator(dt('phone-next')).click();
}
async function playAttempt(page,touch=false,reloadCare=false) {
  const click=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
  await click(t('craft-start'));
  for(let round=1;round<=3;round++) {
    await page.locator(t('votes')).waitFor();
    const s=await get(page);assert.equal(s.flags._ch2_tournament.voted,round);
    assert.deepEqual(await page.locator('[data-contestant]').evaluateAll(ns=>ns.map(n=>n.dataset.contestant).sort()),['ageha','hajime','kumicho','rei']);
    for(const row of Object.values(s.flags._ch2_tournament.votes))assert(Object.values(row).reduce((a,b)=>a+b,0)<=10);
    await assertFits(page,'.ch2-contest .btn, .ch2-contest-rival, .ch2-contest-judges>div');
    if(reloadCare && round===3) {
      assert.equal(s.flags._ch2_tournament.craft.careHistory.length,1);
      const votes=structuredClone(s.flags._ch2_tournament.votes);
      await reload(page);await page.locator(t('votes')).waitFor();
      const loaded=await get(page);assert.deepEqual(loaded.flags._ch2_tournament.votes,votes);
      assert.deepEqual(loaded.flags._ch2_tournament.craft.careHistory,s.flags._ch2_tournament.craft.careHistory);
      await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    }
    await click(t('continue'));
  }
  await page.locator(t('result')).waitFor();
  await capture(page,touch?'touch-result':'pc-result');
  const s=await get(page),p=s.flags._ch2_tournament;
  assert.equal(p.craft.careHistory.length,2);assert.equal(p.result.careHistory.length,2);assert.equal(p.history.length,1);
  for(const row of Object.values(p.votes))assert.equal(Object.values(row).reduce((a,b)=>a+b,0),10);
  assert.equal(p.craft.chapter,2);
  assert(await page.locator('.ch2-contest-rival img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.naturalWidth>0);}));assert.deepEqual(p.craft.audienceIds.slice().sort(),['dr_kemuri','maezono','nagumo']);
  // 同じ配分で計算された総合値がそのまま章2の記録に残る。
  assert.equal(p.result.total,p.craft.total);
  assert.equal(p.craft.total,Math.round(Math.min(100,Object.values(p.craft.parts).reduce((a,b)=>a+b,0)*.2)*10)/10);
  return s;
}
async function reload(page,slot=0,touch=false) {
  const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
  await page.reload();await press(dt('title-load'));
  await page.evaluate(()=>{window.__remake.vnTest.turbo=true;window.__remake.vnTest.choose=()=>0;});
  await press(dt(`slot-${slot}`));
}
await suite('ch2-tournament',async check=>{
  await check('pc-old-morning-win-complete-and-idempotent-load',async page=>{
    await seed(page);await page.locator(t('entry')).waitFor();const before=await get(page);
    await assertFits(page,'.ch2-contest .btn');await page.locator(t('start')).click();await phone(page);
    await page.locator(t('ready')).waitFor();
    const texts=await page.evaluate(()=>window.__texts.join('\n'));
    assert.match(texts,/名前を聞くのは初めて/);assert.match(texts,/零-ZERO-のREI/);assert.match(texts,/俺はヤクザだ/);
    const entryTrace=await page.evaluate(()=>window.__trace);
    const result=await playAttempt(page,false,true);assert.equal(result.flags._ch2_tournament.result.rank,1);
    await page.locator(t('continue')).click();await phone(page);await page.locator(t('complete')).waitFor();
    let s=await get(page);assert(s.flags._ch2_tokyo_invitation);assert(s.flags._ch2_taste_distant);assert(!s.flags.ch2_taste_recovered);assert.equal(s.phase,'cleared');assert.equal(s.day,28);assert.equal(s.slot,1);
    for(const key of ['tournament','lovers','loverSince','lastDate','contacts','keepsakes','relationshipMemories','money','stats'])assert.deepEqual(s[key],before[key],key);
    assert.deepEqual(s.inbox[0],before.inbox[0]);assert.equal(s.inbox.filter(i=>i.id.startsWith('ch2_tournament_sumi_')).length,2);
    assert.equal(await page.getByRole('button',{name:/第三章|第3章/}).count(),0);
    assert.deepEqual(entryTrace,['ch2_tournament_lobby','ch2_tournament_entrance','ch2_tournament_rules']);
    const afterText=await page.evaluate(async()=>(await import('./js/vn/engine.js')).backlog().map(l=>l.text).join('\n'));
    assert.match(afterText,/理由は、聞かないで/);assert.match(afterText,/味の輪郭は戻らない/);
    assert.match(afterText,/おめでとうの文字が届いていた/);
    await reload(page);await page.locator(t('complete')).waitFor();s=await get(page);
    assert.equal(s.flags._ch2_tournament.history.length,1);assert.equal(s.inbox.filter(i=>i.id.startsWith('ch2_tournament_sumi_')).length,2);
    await assertFits(page,'.ch2-contest .btn');
    await capture(page,'pc-complete');
  });
  await check('touch-known-loss-retry-and-preserved-consumption',async page=>{
    await seed(page,{known:true,auto:'bad'});await page.locator(t('start')).tap();await phone(page,true);await page.locator(t('ready')).waitFor();
    const text=await page.evaluate(()=>window.__texts.join('\n'));assert.match(text,/神崎さんだ/);assert.match(text,/また会ったな/);assert(!text.includes('名前を聞くのは初めて'));
    const before=await get(page);const loss=await playAttempt(page,true);assert(loss.flags._ch2_tournament.result.rank>1);
    await page.locator(t('continue')).tap();await page.locator(t('defeat')).waitFor();
    await page.locator(t('retry')).tap();await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    await page.locator(t('craft-start')).tap();
    await page.locator(t('votes')).waitFor();const retried=await get(page);
    assert.equal(retried.flags._ch2_tournament.attempts,2);assert.equal(retried.flags._ch2_tournament.history.length,1);
    assert.equal(retried.flavorStock.double_apple,before.flavorStock.double_apple-9);
    assert.equal(retried.money,before.money);assert.deepEqual(retried.tournament,before.tournament);
    await assertFits(page,'.ch2-contest .btn, .ch2-contest-rival');
  },{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  for(const touch of [false,true]) await check(`${touch?'touch-':''}native-mix-manual-save-load-and-single-stock-cost`,async page=>{
    const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
    await seed(page,{stage:'ready',auto:null});await press(t('craft-start'));
    await page.locator(dt('mix-plus-strawberry')).waitFor();
    assert.match(await page.locator('.bench-mode').textContent(),/HAZE: OPEN CLOUD/);
    assert.match(await page.locator(dt('mix-taste')).textContent(),/つかめない/);
    assert.match(await page.locator('.worker-scene-tag').textContent(),/HAZE: OPEN CLOUD/);
    assert.deepEqual(await page.locator('.bench-phase-copy b').allTextContents(),['パッキング','炭焼き','蒸らし','吸い出し','提供','調整']);
    await assertFits(page,'.bench-top > *, .bench-phase-copy b');
    await capture(page,touch?'touch-mix-header':'pc-mix-header');
    for(let n=0;n<3;n++)await press(dt('mix-plus-strawberry'));
    for(let n=0;n<9;n++)await press(dt('mix-plus-double_apple'));
    const before=await get(page);
    await press(t('menu'));await press(t('save'));await press(dt('slot-1'));
    await reload(page,1,touch);await page.locator(dt('mix-plus-strawberry')).waitFor();
    let s=await get(page);assert.deepEqual(s.flavorStock,before.flavorStock);assert.equal(s.flags._ch2_tournament.step,1);
    for(let n=0;n<3;n++)await press(dt('mix-plus-strawberry'));
    for(let n=0;n<9;n++)await press(dt('mix-plus-double_apple'));
    await assertFits(page,dt('mix-ok'));await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    await press(dt('mix-ok'));await page.locator(t('votes')).waitFor();
    s=await get(page);assert.equal(s.flavorStock.double_apple,before.flavorStock.double_apple-9);
    const snapshot=structuredClone(s.flags._ch2_tournament.votes);
    await reload(page,0,touch);await page.locator(t('votes')).waitFor();s=await get(page);assert.deepEqual(s.flags._ch2_tournament.votes,snapshot);
    assert.equal(s.flavorStock.double_apple,before.flavorStock.double_apple-9);
  },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{});
  await check('burn-failure-reload-and-retry',async page=>{
    await seed(page,{stage:'ready',auto:'burn'});await page.locator(t('craft-start')).click();
    // 初期温度で焦げる工程が変わる。最大でも同じ一台の2回の調整まで進め、失敗は必須とする。
    for(let round=0;round<4;round++) {
      await page.locator(`${t('votes')}, ${t('defeat')}, ${t('result')}`).first().waitFor();
      if(await page.locator(t('defeat')).count())break;
      assert.equal(await page.locator(t('result')).count(),0,'Overheating must fail before a complete result');
      await page.locator(t('continue')).click();
    }
    await page.locator(t('defeat')).waitFor();
    let s=await get(page);assert(s.flags._ch2_tournament.failure);assert.equal(s.flags._ch2_tournament.history.length,0);
    await reload(page);await page.locator(t('defeat')).waitFor();await page.locator(t('retry')).click();await page.locator(t('ready')).waitFor();
  });
  await check('missing-dialogue-preflight-retry-keeps-save',async page=>{
    let bad=true;await page.route('**/ch2_tournament.json',async route=>{
      if(!bad)return route.continue();const response=await route.fetch();const body=await response.json();body.dialogues=body.dialogues.filter(d=>d.dialogue_id!=='ch2_tournament_tasteless');await route.fulfill({response,json:body});
    });
    await seed(page);await page.locator(t('error')).waitFor();let s=await get(page);
    assert.equal(s.day,28);assert.equal(s.stamina,100);assert.equal(s.flavorStock.double_apple,40);assert(!s.flags._ch2_tournament);
    bad=false;await page.locator(t('reload')).click();await page.locator(t('entry')).waitFor();s=await get(page);assert.equal(s.flavorStock.double_apple,40);
  });
});
