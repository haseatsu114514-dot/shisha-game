// DAY14朝の旧保存を入口とするfixture。自然なDAY13→14はch2_storyが別途検証する。
import assert from 'node:assert/strict';
import fs from 'node:fs';
const shots=process.env.SHOTS;
if(shots)fs.mkdirSync(shots,{recursive:true});
const capture=async(page,name)=>{if(shots)await page.screenshot({path:`${shots}/${name}.png`});};
import { suite, assertFits } from './support.mjs';
import { confirmAppearanceSetup, prepareAppearanceCatalog } from './appearance_setup.mjs';
import { confirmWaterSetup } from './water_setup.mjs';
prepareAppearanceCatalog();
const t = name => `[data-test="ch2-tournament-${name}"]`;
const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(()=>structuredClone(window.__remake.state));
async function seed(page, { known = false, stage = '', auto = 'good', progress = null } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async opts => {
    const core = await import('./js/core/state.js'); const s = core.newGame();
    Object.assign(s,{ chapter:2,day:28,slot:0,phase:'daily',money:23456,stamina:100,
      flavorStock:{double_apple:40,mint:12},lovers:['minto'],loverSince:{minto:10},lastDate:{minto:25},contacts:['sumi','minto'],
      keepsakes:['qa_memory'],relationshipMemories:['tsumugi_creature'] });
    // 予告1の自動再生は chapter_preview.mjs が専任で検証する。ここでは既読にして大会本体に集中する。
    s.flags = { _elapsed_calendar:true,_ch1_cleared:true,_ch2_day1:{startDay:15,stage:'complete'},_ch2_eve_done:true,_ch2_taste_distant:true,_ch2_preview_seen:true };
    s.stats={technique:42,sense:42,guts:42,charm:42,insight:42};
    s.inbox=[{id:'qa_old',originId:'qa_old',day:20,read:true,done:true,replyState:'none',log:[{text:'大切な約束'}],msg:{sender:'minto',type:'message',messages:['また会おうね']}}];
    s.tournament.lastRank=1; s.tournament.lastTotal=88;
    if(opts.known) for(const who of ['ageha','kumicho','rei'])s.met[who]=true;
    for(const who of ['ageha','kumicho','rei','pakki','maezono','dr_kemuri','nagumo','hajime','sumi'])s.flags[`_intro_${who}`]=true;
    if(opts.stage) (await import('./js/chapters/ch2-tournament-state.js')).tournamentProgress(s).stage=opts.stage;
    if(opts.progress) Object.assign((await import('./js/chapters/ch2-tournament-state.js')).tournamentProgress(s),opts.progress);
    Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});core.saveConfig();core.save();
    const vn=await import('./js/vn/engine.js'); (await import('./js/chapters/ch1.js')).setupHooks();
    vn.vnTest.turbo=true; vn.vnTest.choose=()=>0;
    window.__texts=[];window.__trace=[];
    vn.hooks.onLine=(id,line)=>{if(window.__trace.at(-1)!==id)window.__trace.push(id);if(line.text)window.__texts.push(line.text);};
    (await import('./js/craft/session.js')).craftTest.auto=opts.auto;
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
  }, {known,stage,auto,progress});
}
// 応援・祝福のトークが先に並ぶ場合も、返信を選びながら最後の「スマホを閉じる」まで読む（#1653 ⑦）。
async function phone(page,touch=false) {
  const press=sel=>touch?page.locator(sel).first().tap():page.locator(sel).first().click();
  for(;;){
    await page.locator(`${dt('phone-next')}, ${dt('reply-0')}`).first().waitFor();
    if(await page.locator(dt('reply-0')).count()){await press(dt('reply-0'));await page.locator(dt('phone-next')).waitFor();continue;}
    const last=(await page.locator(dt('phone-next')).first().innerText()).includes('閉じる');
    await press(dt('phone-next'));
    if(last)return;
    await page.locator(dt('phone-next')).first().waitFor({state:'detached'});
  }
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
    // #909: 票が動いた理由。実際の「この回の票」と同じ点数・人を言う。
    const reason=await page.locator(t('vote-reason')).innerText();
    const last=s.flags._ch2_tournament.lastVotes,got=Object.values(last).reduce((a,v)=>a+(v.points.hajime||0),0);
    if(got)assert.match(reason,new RegExp(`今回 \\+${got}点`));else assert.match(reason,/上位2人にも入らなかった/);
    assert.match(reason,/(アルミ穴あけ|炭の温度|蒸らしと吸い出し|一度目の調整)：[◎○△].*「.+」/);
    await assertFits(page,'.ch2-contest-reason p');
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
  const remnants=await page.locator('#vn .vn-box, #vn .vn-controls').evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).visibility));
  assert(remnants.length===2 && remnants.every(value=>value==='hidden'),'Finished dialogue remains visible over tournament result');
  await capture(page,touch?'touch-result':'pc-result');
  const s=await get(page),p=s.flags._ch2_tournament;
  assert.equal(p.craft.careHistory.length,2);assert.equal(p.result.careHistory.length,2);assert.equal(p.history.length,1);
  for(const row of Object.values(p.votes))assert.equal(Object.values(row).reduce((a,b)=>a+b,0),10);
  assert.equal(p.craft.chapter,2);
  assert.deepEqual(p.craft.tournamentStory.seen,['opening','packed','waiting','interlude_pull','interlude1','interlude2','interlude3','tasting']);
  assert(Number.isFinite(p.craft.tournamentStory.servedAroma));
  assert(await page.locator('.ch2-contest-rival img').evaluateAll(async imgs=>{await Promise.all(imgs.map(i=>i.decode()));return imgs.every(i=>i.naturalWidth>0);}));assert.deepEqual(p.craft.audienceIds.slice().sort(),['dr_kemuri','maezono','nagumo']);
  // 同じ配分で計算された総合値がそのまま章2の記録に残る。
  assert.equal(p.result.total,p.craft.total);
  // #1107 B2: ロートスHMDはアルミ穴あけを飛ばすので、穴あけの重みを外し残り4工程を各25%で割り直す（finalizeと同じ配分）。
  const w=p.craft.foilSkipped?.25:.2;
  const sum=Object.entries(p.craft.parts).reduce((a,[k,v])=>a+((p.craft.foilSkipped&&k==='holes')?0:v),0);
  assert.equal(p.craft.total,Math.round(Math.min(100,sum*w)*10)/10);
  return s;
}
async function reload(page,slot=0,touch=false) {
  const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
  await page.reload();await press(dt('title-load'));
  await page.evaluate(()=>{window.__remake.vnTest.turbo=true;window.__remake.vnTest.choose=()=>0;});
  await press(dt(`slot-${slot}`));
}
async function finishChapterThreePrologue(page) {
  await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_opening"]').waitFor({timeout:60000});
  const reached=await get(page);
  assert.equal(reached.flags._ch3_intro.prologueStep,4);
  assert.equal(reached.flags._ch3_intro.titleSeen,true);
  assert.equal(reached.met.kuze,undefined,'The anonymous prologue must not reveal Kuze to Hajime');
}
// play() の入口で、実VNと同じ名乗り・カットインの副作用を作ってから制御を止める。
// onLine で throw すると非同期表示側の拒否となり、play() の失敗を再現できない。
async function installChapterThreeMeetingFault(page) {
  await page.route('**/js/vn/engine.js',async route=>{
    const response=await route.fetch();
    const source=await response.text();
    const marker='export function play(idOrDlg, opts = {}) {';
    assert(source.includes(marker),'VN play entry changed; update the interruption fixture');
    const injected=marker+`
  const fault=window.__ch3MeetingFault;
  const sceneId=typeof idOrDlg==='string'?idOrDlg:idOrDlg?.dialogue_id;
  if(fault?.scene===sceneId){
    window.__ch3MeetingFault=null;
    for(const who of fault.people){
      state.flags['_met_'+who]=true;
      markMet(who);
      markIntroSeen(who);
    }
    state.flags._ch3_unrelated_meeting_test=true;
    window.__ch3FaultTriggered=true;
    if(fault.mode==='throw')throw new Error('controlled VN interruption after meeting');
    if(fault.mode==='cancel')return Promise.resolve({id:sceneId,visited:[],cancelled:true});
    return new Promise(resolve=>{window.__ch3ResolveFault=()=>{
      resolve({id:sceneId,visited:[],cancelled:true});
      return new Promise(done=>setTimeout(done,0));
    };});
  }
`;
    await route.fulfill({response,body:source.replace(marker,injected)});
  });
  await page.reload();
  await page.locator(dt('title-new')).waitFor();
}
async function seedChapterThreeMeeting(page,sceneId,known=[]) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async({sceneId,known})=>{
    const core=await import('./js/core/state.js');
    const {CH3_INTRO_SCENES}=await import('./js/chapters/ch3-progress.js');
    const stage=CH3_INTRO_SCENES.findIndex(scene=>scene.id===sceneId);
    if(stage<0)throw new Error(`Unknown Chapter 3 scene: ${sceneId}`);
    const scene=CH3_INTRO_SCENES[stage],s=core.newGame();
    Object.assign(s,{chapter:3,day:28+scene.day,slot:scene.slot,phase:'daily'});
    s.flags={_elapsed_calendar:true,_ch3_intro:{startDay:29,stage,titleSeen:true,routeVersion:2}};
    for(const who of known){s.met[who]=true;s.flags['_met_'+who]=true;s.flags['_intro_'+who]=true;}
    Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});
    core.saveConfig();core.save();
    const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
    void (await import('./js/chapters/ch3.js')).resumeChapterThree();
  },{sceneId,known});
  await page.locator(`[data-test="ch3-intro-scene"][data-scene="${sceneId}"]`).waitFor();
}
await suite('ch2-tournament',async check=>{
  // #1922: 本番CONTINUEのMENUからのLOAD失敗で、旧画面の寿命を失わない。
  for (const outcome of ['retry', 'reload']) await check(`continue-load-failure-${outcome}`, async page => {
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now() + 100));
    await seed(page, { stage: 'defeat', auto: null,
      progress: { attempts: 2, losses: 1, lastLossAttempt: 1, failure: 'cold' } });
    await page.locator(t('defeat')).waitFor();
    await page.clock.runFor(1500);
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      window.loadQA = { core, owner: core.state, json: JSON.stringify(core.state),
        auto: localStorage.getItem(core.SAVE_KEY), root: document.querySelector('.gameover'),
        setItem: Storage.prototype.setItem };
      const selected = structuredClone(core.state);
      selected.money = 98765;
      selected.flags._ch2_tournament.stage = 'ready';
      localStorage.setItem(core.SAVE_SLOTS[1].key, JSON.stringify(selected));
      loadQA.manual = localStorage.getItem(core.SAVE_SLOTS[1].key);
      Storage.prototype.setItem = function(key, value) {
        if (this === localStorage && key === core.SAVE_KEY) throw new DOMException('QA quota', 'QuotaExceededError');
        return loadQA.setItem.call(this, key, value);
      };
    });
    const uiLoad = async () => {
      await page.locator(t('menu')).click();
      await page.locator(t('load')).click();
      await page.locator(dt('slot-1')).click();
      await page.locator(dt('confirm-load')).click();
      await page.locator('#modal.show').waitFor({ state: 'hidden' });
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      await uiLoad();
      assert.deepEqual(await page.evaluate(() => ({
        owner: loadQA.core.state === loadQA.owner,
        state: JSON.stringify(loadQA.core.state) === loadQA.json,
        auto: localStorage.getItem(loadQA.core.SAVE_KEY) === loadQA.auto,
        manual: localStorage.getItem(loadQA.core.SAVE_SLOTS[1].key) === loadQA.manual,
        root: document.querySelector('.gameover') === loadQA.root,
      })), { owner: true, state: true, auto: true, manual: true, root: true });
    }
    // 移行で拒否されるデータも旧ownerと保存を維持し、通知しない。
    assert.equal(await page.evaluate(() => {
      const { core } = loadQA;
      localStorage.setItem(core.SAVE_SLOTS[2].key, JSON.stringify({ day: 1, schema: core.SCHEMA + 1 }));
      return core.loadFromSlot(core.SAVE_SLOTS[2].key);
    }), null);
    const count = Number(await page.locator('.go-count').textContent());
    await page.clock.runFor(2000);
    assert(Number(await page.locator('.go-count').textContent()) < count, '失敗後も元のカウントが進む');
    if (outcome === 'retry') {
      await page.locator(t('retry')).click();
      assert.equal(await page.locator(t('defeat')).getAttribute('data-phase'), 'reaction');
      await page.clock.runFor(10000);
      await page.locator(t('ready')).waitFor();
      assert.equal((await get(page)).flags._ch2_tournament.attempts, 2);
    } else {
      const manual = await page.evaluate(() => loadQA.manual);
      await page.evaluate(() => { Storage.prototype.setItem = loadQA.setItem; });
      await page.clock.resume();
      await Promise.all([page.waitForEvent('load'), uiLoad()]);
      await page.locator(t('ready')).waitFor();
      assert.equal((await get(page)).money, 98765);
      assert.equal(await page.evaluate(() => localStorage.getItem('suien_remake_slot1')), manual);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('suien_remake_save')).money), 98765);
    }
  });

  await check('chapter-three-prologue-resumes-anonymous-research',async page=>{
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js'),s=core.newGame();
      Object.assign(s,{chapter:3,day:29,slot:0,phase:'opening'});
      s.flags={_elapsed_calendar:true,_ch2_cleared:true,
        _ch3_intro:{startDay:29,stage:0,titleSeen:false,prologueStep:0,routeVersion:2}};
      Object.assign(core.config,{textSpeed:4,bgmVolume:0,seVolume:0,voiceBlip:false});
      core.saveConfig();core.save();
      const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
      window.__texts=[];
      vn.hooks.onLine=(id,line)=>{
        if(line.text)window.__texts.push(line.text);
        if(id==='ch3_kuze_research'&&line.text?.includes('机のパソコン'))vn.vnTest.turbo=false;
      };
      void (await import('./js/chapters/ch3.js')).resumeChapterThree();
    });
    const before=await get(page);
    await page.waitForFunction(()=>window.__remake.state.flags._ch3_intro?.prologueStep===1
      && document.querySelector('#vn.active .vn-text')?.textContent.includes('机のパソコン'));
    assert((await page.evaluate(()=>window.__texts)).some(line=>line.includes('友達だもん')));
    assert(await page.locator('#bg > .bg-img').last().evaluate(node=>node.style.backgroundImage.includes('bg_ch3_kuze_video')));
    assert.equal((await get(page)).flags._ch3_intro.prologueStep,1);
    await page.reload();await page.locator(dt('title-load')).click();
    await page.evaluate(async()=>{
      const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
      window.__researchReplayLines=[];
      vn.hooks.onLine=(id,line)=>{
        if(line.text)window.__researchReplayLines.push({id,text:line.text});
        if(id==='ch3_kuze_research'&&line.text?.includes('机のパソコン'))vn.vnTest.turbo=false;
      };
    });
    await page.locator(dt('slot-0')).click();
    await page.waitForFunction(()=>document.querySelector('#vn.active .vn-text')?.textContent.includes('机のパソコン'));
    assert.equal((await get(page)).flags._ch3_intro.prologueStep,1);
    assert.equal((await get(page)).met.kuze,undefined);
    await page.evaluate(()=>{window.__remake.vnTest.turbo=true;});
    await page.keyboard.press('Enter');
    await finishChapterThreePrologue(page);
    const replay=await page.evaluate(()=>window.__researchReplayLines);
    assert(replay.every(line=>line.id!=='ch3_childhood_opening'),'Completed childhood memory must not replay');
    assert(replay.some(line=>line.text.includes('試したいことができた')),'The research must finish as story dialogue');
    const after=await get(page);
    for(const key of ['money','stamina','stats','flavorStock','lovers','relationshipMemories'])
      assert.deepEqual(after[key],before[key],`Prologue changed ${key}`);
  });
  // Chapter 3 guide uses existing story/save inputs; exercise normal user controls in both sizes.
  for(const touch of [false,true]) await check(`chapter-three-wayfinding-first-slice-${touch?'touch':'pc'}`,async page=>{
    const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
    const scene=id=>`[data-test="ch3-intro-scene"][data-scene="${id}"]`;
    const guide=dt('ch3-wayfinding'),next=dt('ch3-intro-continue'),menu=dt('ch3-intro-menu');
    const checkGuide=async()=>{
      // Scene visibility precedes the layout observer after LOAD/VN teardown.
      // Wait for the same containment contract that assertFits checks below.
      await page.waitForFunction(()=>{
        const stage=document.querySelector('#stage').getBoundingClientRect();
        return [...document.querySelectorAll('[data-test="ch3-intro-menu"], [data-test="ch3-intro-continue"]')].every(node=>{
          const r=node.getBoundingClientRect();
          return r.width>0&&r.height>0&&r.left>=stage.left-1&&r.top>=stage.top-1
            &&r.right<=stage.right+1&&r.bottom<=stage.bottom+1
            &&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;
        });
      });
      await assertFits(page,`${guide}, ${guide} .ch3-wayfinding-stop, ${guide} small, ${guide} strong, ${guide} span, ${menu}, ${next}`);
      const separate=await page.locator(guide).evaluate(node=>{
        const r=node.getBoundingClientRect();
        return [...document.querySelectorAll('[data-test="ch3-intro-menu"], [data-test="ch3-intro-continue"]')].every(button=>{
          const b=button.getBoundingClientRect();
          return r.bottom<=b.top||b.bottom<=r.top||r.right<=b.left||b.right<=r.left;
        });
      });
      assert(separate,'The guide must not cover the original MENU or continue control');
    };
    await seed(page,{stage:'complete'});await page.locator(t('complete')).waitFor();
    await page.evaluate(async()=>{const c=await import('./js/core/state.js');c.state.phase='cleared';c.state.flags._ch2_cleared=true;c.save();});
    const before=await get(page);await press(t('chapter-three'));
    await finishChapterThreePrologue(page);
    await page.locator(scene('ch3_opening')).waitFor();await checkGuide();
    assert.match(await page.locator(guide).innerText(),/東京駅/);
    assert.doesNotMatch(await page.locator(guide).innerText(),/mukai|煙幕|鉄の煙/);
    if(touch)await press(next);
    else {
      // Reach the existing button through native keyboard focus, then activate it.
      for(let i=0;i<8;i++){
        if(await page.evaluate(()=>document.activeElement?.dataset.test==='ch3-intro-continue'))break;
        await page.keyboard.press('Tab');
      }
      assert.equal(await page.evaluate(()=>document.activeElement?.dataset.test),'ch3-intro-continue');
      await page.keyboard.press('Enter');
    }
    await page.locator(scene('ch3_registration')).waitFor();
    assert.match(await page.locator(scene('ch3_registration')).innerText(),/参加登録/);
    assert.equal((await get(page)).flags._ch3_opening_read,true);
    await reload(page,0,touch);
    await page.locator(scene('ch3_registration')).waitFor();
    assert.equal((await get(page)).flags._ch3_intro.stage,0,'登録前のロードで東京駅を再演しない');
    await press(next);
    await page.locator('[data-test="rule-sheet"]').waitFor();
    assert.equal((await get(page)).flags._ch3_registration_read,true);
    if(!touch){
      await reload(page);
      await page.locator(scene('ch3_registration')).waitFor();
      assert.match(await page.locator(next).innerText(),/競技規則を確認する/);
      await press(next);
      await page.locator('[data-test="rule-sheet"]').waitFor();
    }
    await press(dt('rule-sheet-close'));
    await page.locator(scene('ch3_mukai_arrival')).waitFor();await checkGuide();
    assert.match(await page.locator(guide).innerText(),/直前に読んだ場面[\s\S]*東京駅/);
    assert.match(await page.locator(guide).innerText(),/これから読む場面[\s\S]*mukai/);
    assert.equal((await get(page)).flags._ch3_intro.stage,1);
    await reload(page,0,touch);await page.locator(scene('ch3_mukai_arrival')).waitFor();await checkGuide();
    assert.equal((await get(page)).flags._ch3_intro.stage,1,'Real slot reload must resume the unread arrival');
    await press(next);await page.locator(scene('ch3_mukai_intro')).waitFor();await checkGuide();
    const after=await get(page);assert.equal(after.flags._ch3_intro.stage,2);
    assert.match(await page.locator(guide).innerText(),/新しい店の朝/);
    for(const key of ['money','stamina','stats','flavorStock','lovers','keepsakes'])
      assert.deepEqual(after[key],before[key],`Guide changed ${key}`);
    // #1740（e32120da）: ch3_mukai_arrival を読み終えると交流の記憶 mashiro_pace が残る（台詞側の remember）。案内は記憶を足さない。
    assert.deepEqual(after.relationshipMemories,[...before.relationshipMemories,'mashiro_pace'],'Guide changed relationshipMemories');
    await press(menu);await page.getByRole('button',{name:'閉じる',exact:true})[touch?'tap':'click']();
    await checkGuide();assert.equal((await get(page)).flags._ch3_intro.stage,2);
  },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{});
  await check('abandoned-pull-keeps-the-vote-and-recovers-the-step',async page=>{
    await seed(page,{stage:'ready',auto:'good'});
    await page.locator(t('ready')).waitFor();
    await page.locator(t('craft-start')).click();
    await page.locator(t('votes')).waitFor();
    const before=await get(page);
    assert.equal(before.flags._ch2_tournament.step,8);
    assert.equal(before.flags._ch2_tournament.voted,1);
    await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto=null;});
    await page.locator(t('continue')).click();
    await page.locator('.pull-play').waitFor();
    await page.evaluate(async()=>{
      const {state}=await import('./js/core/state.js');
      state.stamina-=7;
      state.flavorStock.double_apple-=1;
      document.querySelector('.pull-play').remove();
    });
    await page.locator(t('error')).waitFor();
    const after=await get(page),p=after.flags._ch2_tournament;
    assert.equal(p.stage,'craft');
    assert.equal(p.step,8);
    assert.equal(p.voted,1);
    assert.equal(p.attempts,before.flags._ch2_tournament.attempts);
    assert.equal(after.day,before.day);
    assert.equal(after.slot,before.slot);
    assert.deepEqual(p.votes,before.flags._ch2_tournament.votes);
    // 吸い出しの前に読んだ提供前の掛け合いだけは既読として残る（読み直させない）。工程・在庫・票は戻る。
    const expectedCraft=structuredClone(before.flags._ch2_tournament.craft);expectedCraft.tournamentStory.seen.push('interlude_pull');
    assert.deepEqual(p.craft,expectedCraft);
    assert.equal(p.rollback,null);
    assert.equal(after.stamina,before.stamina);
    assert.deepEqual(after.flavorStock,before.flavorStock);
    assert.equal(p.result,null);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('suien_remake_save')));
    assert.equal(saved.flags._ch2_tournament.step,8);
    assert.equal(saved.flags._ch2_tournament.voted,1);
    await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    await page.locator(t('reload')).click();
    await page.locator(t('votes')).waitFor();
    const retried=await get(page);
    assert.equal(retried.flags._ch2_tournament.step,9);
    assert.equal(retried.flags._ch2_tournament.voted,2);
    assert.equal(retried.flags._ch2_tournament.attempts,before.flags._ch2_tournament.attempts);
    assert.deepEqual(retried.flavorStock,before.flavorStock);
  },{reducedMotion:'reduce'});
  await check('vote-reason-low-holes-uses-actual-step-label',async page=>{
    await seed(page,{stage:'entry',auto:null});await page.locator(t('entry')).waitFor();
    const before=await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');
      const model=await import('./js/chapters/ch2-tournament-state.js');
      const p=model.startAttempt(core.state,{holes:{score:20},heat:{score:90},pack:'normal',careHistory:[]});
      model.castVotes(p,0,55);p.stage='votes';core.save();
      const snapshot=structuredClone(p),stamina=core.state.stamina;
      await (await import('./js/chapters/ch2-tournament.js')).runChapterTwoTournament();
      return {snapshot,stamina};
    });
    await page.locator(t('votes')).waitFor();
    const reason=await page.locator(t('vote-reason')).innerText();
    assert.match(reason,/アルミ穴あけ：△.*「.+」/);
    assert(!reason.includes('パッキング'));
    const after=await get(page);assert.deepEqual(after.flags._ch2_tournament,before.snapshot);
    assert.equal(after.stamina,before.stamina);
  });

  await check('pc-old-morning-win-complete-and-idempotent-load',async page=>{
    await seed(page);await page.locator(t('entry')).waitFor();const before=await get(page);
    await assertFits(page,'.ch2-contest .btn');await page.locator(t('start')).click();await phone(page);
    await page.locator(t('ready')).waitFor();
    const texts=await page.evaluate(()=>window.__texts.join('\n'));
    assert.match(texts,/名前を聞くのは初めて/);assert.match(texts,/零-ZERO-のREI/);
    assert.match(texts,/神崎煙草店の神崎竜二でさ/);
    assert.match(texts,/今日は、いち職人として来た。文句なら、俺の煙に言いな/);
    assert.doesNotMatch(texts,/昔は組を張って|足は洗った/);
    const entryTrace=await page.evaluate(()=>window.__trace);
    const result=await playAttempt(page,false,true);assert.equal(result.flags._ch2_tournament.result.rank,1);
    // 最終票を確定した直後、講評の途中で離脱した保存を再現する。
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js'),p=core.state.flags._ch2_tournament;
      p.stage='tasting';p.craft.tournamentStory.seen=p.craft.tournamentStory.seen.filter(id=>id!=='tasting');core.save();
    });
    await reload(page);await page.locator(t('result')).waitFor();
    const resumed=await get(page);
    assert.equal(resumed.flags._ch2_tournament.history.length,1);
    assert.deepEqual(resumed.flags._ch2_tournament.votes,result.flags._ch2_tournament.votes);
    assert.equal(resumed.flags._ch2_tournament.result.total,result.flags._ch2_tournament.result.total);
    assert.deepEqual(resumed.flags._ch2_tournament.craft.tournamentStory.seen,['opening','packed','waiting','interlude_pull','interlude1','interlude2','interlude3','tasting']);
    await page.locator(t('continue')).click();await phone(page);await page.locator(t('complete')).waitFor();
    let s=await get(page);assert(s.flags._ch2_tokyo_invitation);assert(s.flags._ch2_taste_distant);assert(!s.flags.ch2_taste_recovered);assert.equal(s.phase,'cleared');assert.equal(s.day,28);assert.equal(s.slot,1);
    // 初期所持金23,456円 + 第2章優勝賞金50,000円。
    for(const key of ['tournament','lovers','loverSince','lastDate','contacts','keepsakes','relationshipMemories','money','stats'])assert.deepEqual(s[key],key==='money'?before.money+50000:before[key],key);
    assert.deepEqual(s.inbox[0],before.inbox[0]);assert.equal(s.inbox.filter(i=>i.id.startsWith('ch2_tournament_sumi_')).length,2);
    assert.equal(await page.getByRole('button',{name:'第三章・東京へ'}).count(),1);
    assert.deepEqual(entryTrace,['ch2_tournament_lobby','ch2_tournament_entrance','ch2_tournament_stations','ch2_tournament_rules']);
    const afterText=await page.evaluate(async()=>(await import('./js/vn/engine.js')).backlog().map(l=>l.text).join('\n'));
    // #929: あげはは消えない。悔しさと祝福を両立し、店での次の一台を約束する
    assert.doesNotMatch(afterText,/理由は、聞かないで|扉の向こうへ消えた/);assert.match(afterText,/おめでと、ハジメっち/);assert.match(afterText,/次は、うちの店ね/);
    assert.match(afterText,/スジの通った一台/);assert.match(afterText,/味の輪郭は戻らない/);
    // #1653: 優勝時だけ、結果カードの前に決着の間を置く
    assert.match(afterText,/県代表の座は──/);assert(afterText.indexOf('県代表の座は──')<afterText.indexOf('スジの通った一台'));
    // #929: 章の最後に、はじめのいない店であげはの心の声。読了を記録し、再読込で繰り返さない
    assert.match(afterText,/こんなの、ズルいよ/);assert(s.flags._ch2_read_ch2_tournament_ageha_heart);
    assert(afterText.indexOf('こんなの、ズルいよ')>afterText.indexOf('味の輪郭は戻らない'));
    assert.match(afterText,/おめでとうの文字が届いていた/);
    // #1653 ⑦: 祝福は実際のLIMEで届き、ありがとうは選んだ返信として履歴に残る。第1章の応援文は第2章で届かない
    const congrats=s.inbox.find(i=>i.id==='ch2_congrats_minto');
    assert(congrats?.read&&congrats.done);assert.deepEqual(congrats.log.filter(l=>l.me).map(l=>l.text),['……ありがとうございます']);
    assert(!s.inbox.some(i=>i.id==='encourage_minto'),'chapter-one cheer must not arrive in chapter two');
    assert(s.inbox.findIndex(i=>i.id==='ch2_congrats_minto')<s.inbox.findIndex(i=>i.id==='ch2_tournament_sumi_tokyo'));
    // #1653: 完了カードも閉店後のMELTY PUFFのまま（昼の大会ステージへ戻さない）
    assert.match(await page.locator('#bg > .bg-img').last().evaluate(node=>node.style.backgroundImage),/bg_ch2_ageha_closed_night/,'complete card must keep the closed MELTY PUFF background');
    await reload(page);await page.locator(t('complete')).waitFor();s=await get(page);
    assert.equal(s.flags._ch2_tournament.history.length,1);assert.equal(s.inbox.filter(i=>i.id.startsWith('ch2_tournament_sumi_')).length,2);
    assert(!/ズルいよ/.test(await page.evaluate(async()=>(await import('./js/vn/engine.js')).backlog().map(l=>l.text).join('\n'))),'complete reload must not replay the ending');
    await assertFits(page,'.ch2-contest .btn');
    await capture(page,'pc-complete');
  });
  await check('touch-known-loss-retry-and-preserved-consumption',async page=>{
    await seed(page,{known:true,auto:'bad'});await page.locator(t('start')).tap();await phone(page,true);await page.locator(t('ready')).waitFor();
    const text=await page.evaluate(()=>window.__texts.join('\n'));assert.match(text,/神崎さんだ/);assert.match(text,/また会ったな/);assert(!text.includes('名前を聞くのは初めて'));
    assert.match(text,/神崎煙草店の神崎竜二でさ/);
    assert.match(text,/今日は、いち職人として来た。文句なら、俺の煙に言いな/);
    assert.doesNotMatch(text,/昔は組を張って|足は洗った/);
    const before=await get(page);const loss=await playAttempt(page,true);assert(loss.flags._ch2_tournament.result.rank>1);
    await page.locator(t('continue')).tap();await page.locator(t('defeat')).waitFor();
    await page.locator(t('retry')).tap();await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    await page.locator(t('craft-start')).tap();
    await page.locator(t('votes')).waitFor();const retried=await get(page);
    assert.equal(retried.flags._ch2_tournament.attempts,2);assert.equal(retried.flags._ch2_tournament.history.length,1);
    assert.equal(retried.flavorStock.double_apple,before.flavorStock.double_apple-8);
    assert.equal(retried.money,before.money);assert.deepEqual(retried.tournament,before.tournament);
    await assertFits(page,'.ch2-contest .btn, .ch2-contest-rival');
  },{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  for(const touch of [false,true]) await check(`${touch?'touch-':''}native-mix-manual-save-load-and-single-stock-cost`,async page=>{
    const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
    await seed(page,{stage:'ready',auto:null});await press(t('craft-start'));
    await confirmAppearanceSetup(page, { touch });
    await confirmWaterSetup(page, { touch });
    await page.locator(dt('mix-plus-afsahr_strawberry')).waitFor();
    assert.match(await page.locator('.bench-mode').textContent(),/HAZE: OPEN CLOUD/);
    assert.match(await page.locator(dt('mix-taste')).textContent(),/つかめない/);
    // #929: 課題の支給葉は試煙会で吸ったアフサールの新作。旧AFストロベリーの行は持ち込みが無ければ出さない
    assert.match(await page.locator('.flavor-row[data-flavor="afsahr_strawberry"]').textContent(),/アフサール ストロベリー[\s\S]*課題（支給）/);
    assert.equal(await page.locator('.flavor-row[data-flavor="strawberry"]').count(),0);
    assert.match(await page.locator('.worker-scene-tag').textContent(),/HAZE: OPEN CLOUD/);
    assert.deepEqual(await page.locator('.bench-phase-copy b').allTextContents(),['パッキング','炭焼き','蒸らし','吸い出し','提供','調整']);
    await assertFits(page,'.bench-top > *, .bench-phase-copy b');
    await capture(page,touch?'touch-mix-header':'pc-mix-header');
    for(let n=0;n<4;n++)await press(dt('mix-plus-afsahr_strawberry'));
    for(let n=0;n<8;n++)await press(dt('mix-plus-double_apple'));
    const before=await get(page);
    await press(t('menu'));await press(t('save'));await press(dt('slot-1'));
    await page.clock.resume();
    await reload(page,1,touch);await page.locator(dt('mix-plus-afsahr_strawberry')).waitFor();
    let s=await get(page);assert.deepEqual(s.flavorStock,before.flavorStock);assert.equal(s.flags._ch2_tournament.step,1);
    for(let n=0;n<4;n++)await press(dt('mix-plus-afsahr_strawberry'));
    for(let n=0;n<8;n++)await press(dt('mix-plus-double_apple'));
    await assertFits(page,dt('mix-ok'));await page.evaluate(async()=>{(await import('./js/craft/session.js')).craftTest.auto='good';});
    await press(dt('mix-ok'));await page.locator(t('votes')).waitFor();
    s=await get(page);assert.equal(s.flavorStock.double_apple,before.flavorStock.double_apple-8);
    const snapshot=structuredClone(s.flags._ch2_tournament.votes);
    await reload(page,0,touch);await page.locator(t('votes')).waitFor();s=await get(page);assert.deepEqual(s.flags._ch2_tournament.votes,snapshot);
    assert.equal(s.flavorStock.double_apple,before.flavorStock.double_apple-8);
  },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{});
  for (const touch of [false,true]) await check(`continue-menu-${touch?'touch':'pc'}`,async page=>{
    const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
    await seed(page,{stage:'defeat',auto:null,progress:{attempts:2,failure:'cold'}});
    await page.locator(t('defeat')).waitFor();
    await page.clock.install();
    await page.clock.pauseAt(new Date(Date.now()+100));
    const before=await get(page);
    await press(t('menu'));
    const count=await page.locator('.go-count').textContent();
    await page.clock.runFor(30000);
    assert.equal(await page.locator('.go-count').textContent(),count);
    assert.equal(await page.locator(t('defeat')).getAttribute('data-paused'),'true');
    await press(t('save'));await press(dt('slot-1'));
    await page.clock.resume();
    await reload(page,1,touch);
    await page.locator(t('defeat')).waitFor();
    const restored=await get(page);
    assert.equal(restored.flags._ch2_tournament.attempts,before.flags._ch2_tournament.attempts);
    assert.equal(restored.flags._ch2_tournament.losses,before.flags._ch2_tournament.losses);
    assert.deepEqual(restored.flags._ch2_tournament.votes,before.flags._ch2_tournament.votes);
    assert.deepEqual(restored.flavorStock,before.flavorStock);
    assert.equal(restored.stamina,before.stamina);
    await press(t('retry')); await page.locator(t('ready')).waitFor();
    assert.equal((await get(page)).flags._ch2_tournament.attempts,2);
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
  for (const touch of [false,true]) await check(`continue-assist-cancel-${touch?'touch':'pc'}`,async page=>{
    const press=sel=>touch?page.locator(sel).tap():page.locator(sel).click();
    await seed(page,{stage:'defeat',auto:null,progress:{attempts:3,losses:2,lastLossAttempt:2,failure:'leaf'}});
    await page.locator(t('defeat')).waitFor();
    const speaker=await page.locator(t('defeat')).getAttribute('data-speaker');
    const variant=await page.locator(t('defeat')).getAttribute('data-variant');
    const before=await get(page);
    await press(t('retry'));await press(dt('retry-assist-cancel'));
    await page.waitForFunction(()=>document.querySelector('.gameover')?.dataset.phase==='speaking');
    assert.equal(await page.locator(t('defeat')).getAttribute('data-speaker'),speaker);
    assert.equal(await page.locator(t('defeat')).getAttribute('data-variant'),variant);
    const after=await get(page);
    assert.equal(after.flags._ch2_tournament.attempts,3);
    assert.equal(after.flags._ch2_tournament.losses,3);
    assert.equal(after.flags._ch2_tournament.retryAssist,false);
    assert.equal(after.stamina,before.stamina);assert.deepEqual(after.flavorStock,before.flavorStock);
    await press(t('retry'));await press(dt('retry-assist-no'));await page.locator(t('ready')).waitFor();
  },touch?{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'}:{});
  // #590: 3敗目の再挑戦で第1章と同じ救済。選んだ挑戦だけ現在の最大体力へ、断れば大会開始時の体力。
  for(const assist of [true,false]) await check(`third-loss-retry-assist-${assist?'yes':'no'}`,async page=>{
    const entry={flavorStock:{double_apple:40,mint:12},stamina:30,equip:null,recipes:{},stats:{technique:42,sense:42,guts:42,charm:42,insight:42}};
    await seed(page,{stage:'defeat',auto:null,progress:{attempts:3,losses:2,lastLossAttempt:2,failure:'burnt',entry}});
    await page.evaluate(async e=>{const c=await import('./js/core/state.js');e.equip=structuredClone(c.state.equip);c.state.flags._ch2_tournament.entry=e;c.save();},entry);
    await page.locator(t('defeat')).waitFor();await page.locator(t('retry')).click();
    await page.locator(dt(assist?'retry-assist-yes':'retry-assist-no')).click();
    await page.locator(t('ready')).waitFor();
    let s=await get(page);assert.equal(s.flags._ch2_tournament.losses,3);assert.equal(s.flags._ch2_tournament.retryAssist,assist);
    await page.locator(t('craft-start')).click();
    await confirmAppearanceSetup(page,{touch:false});
    await page.waitForFunction(()=>window.__remake?.state?.flags?._ch2_tournament?.attempts===4);
    s=await get(page);
    const max=await page.evaluate(async()=>(await import('./js/core/stats.js')).maxStamina());
    assert.equal(s.stamina,assist?max:30,'assist recovers to the current maximum; declining keeps the entry stamina');
    assert.equal(s.flags._ch2_tournament.entry.stamina,30,'the entry snapshot is not rewritten');
    assert.equal(s.flags._ch2_tournament.craft.retryAssist,assist);
    assert.equal(s.flags._ch2_tournament.craft.condition.health,assist?'green':'red',
      'The craft condition must reflect the recovered starting stamina');
  });
  await check('missing-dialogue-preflight-retry-keeps-save',async page=>{
    let bad=true;await page.route('**/ch2_tournament.json',async route=>{
      if(!bad)return route.continue();const response=await route.fetch();const body=await response.json();body.dialogues=body.dialogues.filter(d=>d.dialogue_id!=='ch2_tournament_tasteless');await route.fulfill({response,json:body});
    });
    await seed(page);await page.locator(t('error')).waitFor();let s=await get(page);
    assert.equal(s.day,28);assert.equal(s.stamina,100);assert.equal(s.flavorStock.double_apple,40);assert(!s.flags._ch2_tournament);
    bad=false;await page.locator(t('reload')).click();await page.locator(t('entry')).waitFor();s=await get(page);assert.equal(s.flavorStock.double_apple,40);
  });
  await check('chapter-three-kuze-entry-resume-and-day-spacing',async page=>{
    page.setDefaultTimeout(30000);
    await seed(page,{stage:'complete'});
    await page.locator(t('complete')).waitFor();
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');
      core.state.phase='cleared';core.state.flags._ch2_cleared=true;core.save();
    });
    const before=await get(page);
    await page.locator(t('chapter-three')).click();
    await finishChapterThreePrologue(page);
    const scene=id=>`[data-test="ch3-intro-scene"][data-scene="${id}"]`;
    const continueButton=dt('ch3-intro-continue');
    await page.locator(scene('ch3_opening')).waitFor();
    let s=await get(page);
    assert.equal(s.chapter,3);assert.equal(s.day,29);assert.equal(s.flags._ch3_intro.stage,0);
    for(const key of ['money','stamina','stats','flavorStock','lovers','loverSince','keepsakes','relationshipMemories','tournament'])
      assert.deepEqual(s[key],before[key],`Chapter 3 entry changed ${key}`);
    await page.locator(continueButton).click();
    await page.locator(scene('ch3_registration')).waitFor();
    await page.locator(continueButton).click();
    await page.locator('[data-test="rule-sheet"]').waitFor();
    await page.locator(dt('rule-sheet-close')).click();
    await page.locator(scene('ch3_mukai_arrival')).waitFor();
    assert.equal((await get(page)).flags._ch3_intro.stage,1);
    // 1場面を確定後にロード。冒頭が再生されず、次の場面から続く。
    await page.reload();await page.locator(dt('title-load')).click();
    assert.match(await page.locator(dt('slot-0')).innerText(),/第3章\s*DAY 1(?!\d)/);
    await page.evaluate(async()=>{
      const vn=await import('./js/vn/engine.js');vn.vnTest.turbo=true;vn.vnTest.choose=()=>0;
      window.__chapterThreeTrace=[];
      window.__pausedChapterThree={};
      vn.hooks.onLine=(id,line)=>{
        if(window.__chapterThreeTrace.at(-1)!==id)window.__chapterThreeTrace.push(id);
        const key=id==='ch3_double_apple_incident'?'mukai'
          :id==='ch3_kuze_first'&&line.speaker==='kuze'?'kuze'
          :id==='ch3_steve_low_heat'&&line.speaker==='steve'?'steve'
          :id==='ch3_volk_first'&&line.speaker==='volk'&&line.text?.includes('壁の計器')?'volk':null;
        if(key&&!window.__pausedChapterThree[key]){window.__pausedChapterThree[key]=true;vn.vnTest.turbo=false;}
      };
    });
    await page.locator(dt('slot-0')).click();
    await page.locator(scene('ch3_mukai_arrival')).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.__chapterThreeTrace),[]);
    const ordered=await page.evaluate(async()=>
      (await import('./js/chapters/ch3-progress.js')).CH3_INTRO_SCENES.map(({id,day,slot})=>({id,day,slot})));
    for(const {id,day,slot} of ordered.slice(1)) {
      // 東京の空き時間（#1655）は休んで次の場面へ。休養は体力だけを戻す。
      await page.locator(`${scene(id)}, ${dt('ch3-intro-free')}`).first().waitFor();
      while(await page.locator(dt('ch3-intro-free')).count()){
        const card=await page.locator(dt('ch3-intro-free')).elementHandle();
        await page.locator(dt('ch3-intro-visit-rest')).click();
        await card.waitForElementState('hidden');
        await page.locator(`${scene(id)}, ${dt('ch3-intro-free')}`).first().waitFor();
      }
      await page.locator(scene(id)).waitFor();
      s=await get(page);
      assert.equal(s.day,28+day,`Wrong elapsed day before ${id}`);
      assert.equal(s.slot,slot,`Wrong time slot before ${id}`);
      await page.locator(continueButton).click();
      if(id==='ch3_double_apple_incident'){
        await page.waitForFunction(()=>window.__pausedChapterThree.mukai&&document.querySelector('#vn.active .vn-text')?.textContent.includes('mukai'));
        assert(await page.locator('#bg > .bg-img').last().evaluate(node=>node.style.backgroundImage.includes('bg_mukai_shop')),
          'Tokyo mukai must not show the old tonari interior');
        await page.evaluate(()=>{window.__remake.vnTest.turbo=true;});
        await page.keyboard.press('Enter');
      }
      if(id==='ch3_kuze_first'){
        const portrait=page.locator('.vn-portraits img[data-speaker="kuze"].active');
        await portrait.waitFor();
        await page.waitForFunction(()=>document.querySelector('#vn.active .vn-text')?.textContent.includes('いらっしゃい'));
        assert(await portrait.evaluate(async node=>{await node.decode();return node.naturalWidth>0;}),
          'Kuze portrait must decode in his first conversation');
        assert.match(await page.locator('#vn.active .vn-name').textContent(),/久世/);
        assert(await page.locator('#bg > .bg-img').last().evaluate(node=>node.style.backgroundImage.includes('bg_yohaku_shop')),
          'Kuze must appear inside 煙幕');
        assert.equal(await page.locator(dt('ch3-intro-menu')).count(),0,
          'Saving during Kuze dialogue could commit his name before the first scene completes');
        await page.waitForTimeout(500);
        await capture(page,'ch3-kuze-first');
        await page.evaluate(()=>{window.__remake.vnTest.turbo=true;});
        await page.keyboard.press('Enter');
      }
      if(id==='ch3_steve_low_heat'||id==='ch3_volk_first'){
        const who=id==='ch3_steve_low_heat'?'steve':'volk';
        await page.waitForFunction(who=>window.__pausedChapterThree[who],who);
        const portrait=page.locator(`.vn-portraits img[data-speaker="${who}"].active`);
        await portrait.waitFor();
        assert(await portrait.evaluate(async node=>{await node.decode();return node.naturalWidth>0;}),
          `${who} portrait must decode inside the rival's shop`);
        assert(await page.locator('#bg > .bg-img').last().evaluate((node,name)=>node.style.backgroundImage.includes(name),
          `bg_${who}_shop`),`${who} needs the matching shop background`);
        await page.evaluate(()=>{window.__remake.vnTest.turbo=true;});
        await page.keyboard.press('Enter');
      }
    }
    await page.locator(dt('ch3-intro-ready')).waitFor();
    s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,ordered.length);
    assert.equal(s.chapter,3);assert.equal(s.day,42);assert.equal(s.phase,'tournament');
    assert.equal(s.flags._ch3_cleared,undefined);
    assert(s.met.kuze,'Kuze must be known after the first visit');
    assert(s.met.steve,'Steve must be known after the low-heat visit');
    assert(s.met.volk,'Volk must be known after his shop visit');
    assert.equal(s.flags._ch3_strategy,'aroma','The chosen strategy must survive the eve checkpoint');
    assert(s.relationshipMemories.includes('volk_measure'),'Volk’s measured hospitality should be remembered');
    assert.deepEqual(await page.evaluate(()=>window.__chapterThreeTrace),ordered.slice(1).flatMap(scene=>
      scene.id === 'ch3_mukai_intro' ? [scene.id, 'ch3_delivery_offer', 'ch3_delivery_kuze',
        'ch3_delivery_steve', 'ch3_delivery_volk', 'ch3_delivery_return'] : [scene.id]));
    for (const who of ['kuze', 'steve', 'volk']) assert.equal(s.flags[`_ch3_delivery_${who}`], true);
    assert.equal(await page.getByText(/全国大会・優勝|第三章・完/).count(),0,'The introduction cannot award a national win');
    for(const key of ['money','stats','flavorStock','lovers','loverSince','keepsakes','tournament'])
      assert.deepEqual(s[key],before[key],`Intro scene changed ${key}`);
  });
  await check('chapter-three-missing-dialogue-keeps-chapter-two-save',async page=>{
    let bad=true;
    await page.route('**/ch3_rivals.json',async route=>{
      if(!bad)return route.continue();
      const response=await route.fetch();const body=await response.json();
      body.dialogues=body.dialogues.filter(d=>d.dialogue_id!=='ch3_kuze_advice');
      await route.fulfill({response,json:body});
    });
    await seed(page,{stage:'complete'});await page.locator(t('complete')).waitFor();
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');
      core.state.phase='cleared';core.state.flags._ch2_cleared=true;core.save();
    });
    const prior=await get(page);
    await page.locator(t('chapter-three')).click();
    await page.locator(dt('ch3-intro-error')).waitFor();
    assert.deepEqual(await get(page),prior,'Missing later Kuze dialogue must not advance the chapter or consume resources');
    bad=false;await page.locator(dt('ch3-intro-reload')).click();
    await finishChapterThreePrologue(page);
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_opening"]').waitFor();
    const entered=await get(page);
    assert.equal(entered.chapter,3);assert.equal(entered.day,29);assert.equal(entered.flags._ch3_intro.stage,0);
  });
  await check('chapter-three-kuze-throw-error-menu-save-rolls-back-meeting',async page=>{
    await installChapterThreeMeetingFault(page);
    await seedChapterThreeMeeting(page,'ch3_kuze_first');
    await page.evaluate(()=>{window.__ch3MeetingFault={scene:'ch3_kuze_first',people:['kuze'],mode:'throw'};});
    await page.locator(dt('ch3-intro-continue')).click();
    await page.locator(dt('ch3-intro-error')).waitFor();
    let s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,11);
    for(const value of [s.met.kuze,s.flags._met_kuze,s.flags._intro_kuze])assert.equal(value,undefined);
    assert.equal(s.flags._ch3_unrelated_meeting_test,true,'Unrelated state must survive the local rollback');
    await page.locator(dt('ch3-intro-menu')).click();
    await page.locator(dt('ch3-intro-save')).click();
    await page.locator(dt('slot-1')).click();
    const saved=await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');
      return core.readSlot(core.SAVE_SLOTS[1].key);
    });
    assert.equal(saved.flags._ch3_intro.stage,11,'The error MENU must save the unread scene');
    for(const value of [saved.met.kuze,saved.flags._met_kuze,saved.flags._intro_kuze])assert.equal(value,undefined);
    assert.equal(saved.flags._ch3_unrelated_meeting_test,true);
    await page.locator(dt('ch3-intro-reload')).click();
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_kuze_first"]').waitFor();
    await page.locator(dt('ch3-intro-continue')).click();
    // 初対面の夜は東京の空き時間（#1655）。休んで次の場面へ。
    await page.locator(dt('ch3-intro-free')).waitFor();
    await page.locator(dt('ch3-intro-visit-rest')).click();
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_kuze_mukai_visit"]').waitFor();
    s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,12);
    for(const value of [s.met.kuze,s.flags._met_kuze,s.flags._intro_kuze])assert.equal(value,true);
  });
  await check('chapter-three-real-vn-abort-rolls-back-kuze-intro',async page=>{
    await seedChapterThreeMeeting(page,'ch3_kuze_first');
    await page.evaluate(async()=>{
      const vn=await import('./js/vn/engine.js');
      vn.hooks.onLine=(id,line)=>{
        if(id==='ch3_kuze_first'&&line.speaker==='hajime'&&line.text?.includes('今日は飲み物だけで'))vn.vnTest.turbo=false;
      };
    });
    await page.locator(dt('ch3-intro-continue')).click();
    await page.waitForFunction(()=>{
      const s=window.__remake.state;
      return s.met.kuze&&s.flags._met_kuze&&s.flags._intro_kuze&&document.querySelector('#vn.active .vn-text')?.textContent.includes('今日は飲み物だけで');
    });
    await page.evaluate(async()=>{void (await import('./js/chapters/ch3.js')).resumeChapterThree();});
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_kuze_first"]').waitFor();
    const s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,11);
    for(const value of [s.met.kuze,s.flags._met_kuze,s.flags._intro_kuze])assert.equal(value,undefined);
  });
  await check('chapter-three-mukai-cancel-preserves-loaded-owner',async page=>{
    await installChapterThreeMeetingFault(page);
    await seedChapterThreeMeeting(page,'ch3_mukai_arrival',['mashiro']);
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js'),s=core.state;
      s.met.mukai_master=true;s.flags._met_mukai_master=true;s.flags._intro_mukai_master=true;
      s.flags._new_loaded_owner='keep';
      core.saveToSlot(core.SAVE_SLOTS[1].key);
      delete s.met.mukai_master;delete s.flags._met_mukai_master;delete s.flags._intro_mukai_master;
      delete s.flags._new_loaded_owner;core.save();
      window.__ch3MeetingFault={scene:'ch3_mukai_arrival',people:['mukai_master','mashiro'],mode:'cancel'};
    });
    await page.locator(dt('ch3-intro-continue')).click();
    await page.waitForFunction(()=>window.__ch3FaultTriggered);
    let s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,1);
    for(const value of [s.met.mukai_master,s.flags._met_mukai_master,s.flags._intro_mukai_master])assert.equal(value,undefined);
    for(const value of [s.met.mashiro,s.flags._met_mashiro,s.flags._intro_mashiro])assert.equal(value,true);
    await page.evaluate(async()=>{void (await import('./js/chapters/ch3.js')).resumeChapterThree();});
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_mukai_arrival"]').waitFor();
    await page.evaluate(()=>{
      window.__ch3FaultTriggered=false;
      window.__ch3MeetingFault={scene:'ch3_mukai_arrival',people:['mukai_master','mashiro'],mode:'defer'};
    });
    await page.locator(dt('ch3-intro-continue')).click();
    await page.waitForFunction(()=>typeof window.__ch3ResolveFault==='function');
    await page.evaluate(async()=>{void (await import('./js/chapters/ch3.js')).resumeChapterThree();});
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_mukai_arrival"]').waitFor();
    await page.evaluate(async()=>{await window.__ch3ResolveFault();window.__ch3ResolveFault=null;});
    s=await get(page);
    for(const value of [s.met.mukai_master,s.flags._met_mukai_master,s.flags._intro_mukai_master])assert.equal(value,undefined);
    for(const value of [s.met.mashiro,s.flags._met_mashiro,s.flags._intro_mashiro])assert.equal(value,true);
    await page.evaluate(()=>{
      window.__ch3FaultTriggered=false;
      window.__ch3MeetingFault={scene:'ch3_mukai_arrival',people:['mukai_master','mashiro'],mode:'defer'};
    });
    await page.locator(dt('ch3-intro-continue')).click();
    await page.waitForFunction(()=>typeof window.__ch3ResolveFault==='function');
    await page.evaluate(async()=>{
      const core=await import('./js/core/state.js');
      if(!core.loadFromSlot(core.SAVE_SLOTS[1].key))throw new Error('manual LOAD failed');
      void (await import('./js/chapters/ch3.js')).resumeChapterThree();
    });
    await page.locator('[data-test="ch3-intro-scene"][data-scene="ch3_mukai_arrival"]').waitFor();
    await page.evaluate(async()=>{await window.__ch3ResolveFault();window.__ch3ResolveFault=null;});
    s=await get(page);
    assert.equal(s.flags._ch3_intro.stage,1);
    for(const value of [s.met.mukai_master,s.flags._met_mukai_master,s.flags._intro_mukai_master,
      s.met.mashiro,s.flags._met_mashiro,s.flags._intro_mashiro])assert.equal(value,true);
    assert.equal(s.flags._new_loaded_owner,'keep','The old owner must not revert a different LOAD state');
    assert.equal(s.flags._ch3_unrelated_meeting_test,undefined);
  });
});
