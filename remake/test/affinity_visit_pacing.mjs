// Actual visit entrypoints and gainAffinity, with neutral stat modifiers and UI/VN stubs.
// No fortune/LIME/board bonus. This does not replace the full VN/browser regression.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const strip = s => s.replace(/^import .*;\n/gm, '').replace(/\bexport /g, '');
const thresholds = [0,9,20,33,48,66];
const level = n => thresholds.reduce((a,p,i) => n >= p ? i : a, 0);
function harness(id, initial = 9) {
  const played=[], gains=[], charges=[], stats=[];
  const s={chapter:2,day:16,slot:1,phase:'daily',money:100000,stamina:100,flags:{},story:{},visits:{},met:{[id]:true},affinity:{[id]:initial},affinityCarry:{},contacts:[],finales:{},lovers:[],romanceChoices:{}};
  const c={console,AbortController,state:s,DB:{dialogues:{}},played,gains,charges,stats,
    cancel:null,swap:null,answer:1,missingAnswer:false,hasAffinity:()=>true,firstMeetingAction:()=>false,
    queueAffinityGain:()=>{},tier01:()=>0,growthPerks:()=>({}),fortuneMult:()=>1,
    releaseAffinity:()=>0,affinityPointCap:()=>Infinity,AFFINITY_PACE:.85,LIME_AFFINITY_SCALE:.25,
    reportAffinityGain:()=>{},AFFINITY_RANK_PTS:thresholds,
    affinityLevel:who=>level(c.state.affinity[who]||0),visitAffinity:kind=>({story:16,talk:8})[kind],
    save:()=>{},markMet:who=>{if(!c.state.met[who])c.state.flags[`_affinity_first_meeting_pending_${who}`]=true;c.state.met[who]=true;},
    earnStat:(...a)=>stats.push(a),addMoney:n=>{charges.push(n);c.state.money+=n;},addStamina:n=>c.state.stamina+=n,
    ensureAffinityLevel:()=>{},STAMINA_LOW:25,timeOfDay:()=>c.state.slot>0?'night':'day',
    setBg:async()=>{},isPlaying:()=>false,sharkSwim:async fn=>fn(),sceneBg:()=>({}),loadCinemaDialogue:async()=>{},
    cinemaIntroductionDue:()=>false,CINEMA_INTRO:'cinema_intro',readCinemaIntroduction:async()=>true,
    maybeRecruitTrpgMember:async()=>false,
    BOND_FINALES:{samechan:{dialogue:'samechan_bond_finale'},ageha:{dialogue:'ch2_ageha_bond_finale'}},
    BOND_QUESTIONS:{ageha:{host:'remake_ch2_ageha_newcomer',dialogue:'ch2_ageha_bond_question'}},
    questionVisitDue:()=>false,
    playQuestionVisit:async who=>{
      const r=await c.play('ch2_ageha_bond_question');
      if(r?.cancelled)return false;
      c.state.flags._ageha_affinity_question_done=true;
      c.state.romanceChoices.bond_q1_ageha={char:who,value:c.answer};
      return true;
    },
    finaleAtVisit:who=>{
      const f=c.state.flags;
      if(c.state.finales[who]||c.affinityLevel(who)<5)return false;
      return who==='samechan'?!!f._samechan_bond_question_done&&!!f._samechan_heart4_done&&!!f._samechan_heart5_done&&c.state.slot>=1
        :c.AGEHA_AFFINITY_VISITS.every(x=>f[`_ch2_read_${x}`])&&!!f._ageha_affinity_question_done;
    },
    playFinale:async who=>{const r=await c.play(c.BOND_FINALES[who].dialogue);if(r?.cancelled)return false;c.state.finales[who]={route:c.answer?'romance':'friend'};return true;},
    STOPS:[{id:'ageha'},{id:'kumicho'},{id:'rei'}],ROOMS:{ageha:'room',kumicho:'room',rei:'room'},MAP:{day:'map',night:'map'},CITY_SHOP:{id:'shop'},
    VISIT_COST:3000,CITY_OUTINGS:[],CH2_CITY_NAME:'city',HOME_CITY_NAME:'home',CITY_BACKGROUNDS:{},CH2_SCENE_BACKGROUNDS:{},
    spendableMoney:x=>x.money,isClosed:()=>false,knownCityOutings:()=>[],dayOneProgress:()=>({startDay:15}),
    imageReady:async()=>true,withScenePreparation:async x=>x,toast:()=>{},recordCityVisit:()=>{},offerAgehaPurikura:async()=>true,consultLessons:async()=>{},
  };
  c.play=async script=>{
    const name=typeof script==='string'?script:script.dialogue_id;
    played.push(name);
    if(c.swap===name)c.state=structuredClone(c.state);
    if(name==='samechan_shop_bond_question'&&!c.missingAnswer){
      c.state.romanceChoices.bond_q1_samechan||={char:'samechan',value:c.answer};
    }
    return {cancelled:c.cancel===name};
  };
  vm.createContext(c);
  vm.runInContext(strip(read('remake/js/core/affinity-stages.js'))+'\nthis.AGEHA_AFFINITY_VISITS=AGEHA_AFFINITY_VISITS;',c);
  const source=read('remake/js/core/stats.js'),start=source.indexOf('export function gainAffinity('),end=source.indexOf('// ---------------------------------------------------------------- 体力',start);
  vm.runInContext(source.slice(start,end).replace('export ','')+'\nthis.actualGain=gainAffinity;',c);
  c.gainAffinity=(...args)=>{gains.push(args);return c.actualGain(...args);};
  vm.runInContext(strip(read('remake/js/chapters/ch2-story-data.js'))+'\nObject.assign(this,{agehaStoryScene,agehaLaterScene,AGEHA_BADDAY,AGEHA_LATER_SCENES,syncAgehaVibes});',c);
  for(const p of ['samechan','ch2_preparation','ch2_ageha_story'])for(const d of JSON.parse(read(`data/dialogue/${p}.json`)).dialogues)c.DB.dialogues[d.dialogue_id]=d;
  vm.runInContext(strip(read('remake/js/daily/samechan.js'))+'\nthis.visitSamechan=visitSamechan;this.samechanVisitDialogue=samechanVisitDialogue;',c);
  vm.runInContext(strip(read('remake/js/chapters/ch2-preparation.js'))+'\nthis.visitPreparationSpot=visitPreparationSpot;',c);
  const spot=id==='samechan'?{id:'shishark',cost:3000,stamina:-16}:{id:'ch2_ageha',charId:'ageha',region:'widehanga',kind:'rival',cost:3000,stamina:-16};
  const visit=()=>id==='samechan'?c.visitSamechan(spot):c.visitPreparationSpot(spot,{staminaGuard:async()=>true});
  return {c,s,played,gains,charges,stats,visit};
}

// The default chapter-one encounter/face-to-face introduction has already earned ♥1.
for(const who of ['samechan','ageha'])for(const answer of [0,1]){
  const h=harness(who);h.c.answer=answer;const visits=[];
  for(let i=0;i<12&&!h.s.finales[who];i++){
    h.s.day=16+i;const from=h.played.length;const before=h.s.affinity[who];
    assert(await h.visit());
    visits.push({visit:i+1,day:h.s.day,before,after:h.s.affinity[who],scenes:h.played.slice(from)});
    assert.equal(h.gains.length,i+1,'one affinity award per visit');
    assert.equal(h.charges.length,i+1,'one payment per visit');
    assert.equal(h.stats.length,i+1,'one stat award per visit');
  }
  assert(h.s.finales[who]);assert.equal(visits.length,who==='samechan'?7:8,`${who} from normal ♥1 and DAY2 start`);
  assert.equal(h.s.finales[who].route,answer?'romance':'friend');
  if(who==='samechan'){
    assert.deepEqual(visits[2].scenes,['samechan_shop_closing_check','samechan_shop_bond_question']);
    const before=h.s.money, rewards=h.gains.length;assert.equal(await h.visit(),true);assert.equal(h.s.money,before);assert.equal(h.gains.length,rewards,'completed receipt cannot pay twice');
  }else{
    assert.deepEqual(visits[1].scenes,['remake_ch2_ageha_followup','remake_ch2_ageha_gyaru']);
    assert(visits.some(v=>v.scenes.includes('remake_ch2_ageha_badday')),'bad day is kept');
  }
  if(answer===1)console.log('[neutral pacing]',who,JSON.stringify(visits));
}
// Samechan: night condition, old unbundled question, real answer preservation and interruptions.
{
  const h=harness('samechan',36);Object.assign(h.s.story,{samechan:1});h.s.flags._samechan_quiet_seat_done=true;
  h.s.slot=0;assert.notEqual(h.c.samechanVisitDialogue(),'samechan_shop_closing_check');
  h.s.slot=1;assert.equal(h.c.samechanVisitDialogue(),'samechan_shop_closing_check');
  h.c.cancel='samechan_shop_bond_question';assert.equal(await h.visit(),false);
  assert.equal(h.s.money,100000);assert.equal(h.gains.length,0);assert(!h.s.flags._samechan_closing_check_done);assert(!h.s.flags._samechan_bond_question_done);
  assert.equal(h.s.romanceChoices.bond_q1_samechan.value,1,'answer may persist before its response ends');
  h.c.answer=0;h.c.cancel=null;assert.equal(await h.visit(),true);
  assert.equal(h.s.romanceChoices.bond_q1_samechan.value,1,'saved answer not overwritten on retry');
  assert(h.s.flags._samechan_closing_check_done&&h.s.flags._samechan_bond_question_done);assert.equal(h.gains.length,1);
}
{
  const h=harness('samechan',50);h.s.story.samechan=4;h.s.flags._samechan_closing_check_done=true;h.s.flags._samechan_quiet_seat_done=true;
  assert.equal(h.c.samechanVisitDialogue(),'samechan_shop_bond_question','old save with closing already read');
  assert(await h.visit());assert.equal(h.gains[0][1],8,'standalone old question remains talk');
}
// A DAY3 start reaches the day-seven event before an extra filler visit is needed.
{
  const h=harness('ageha');let visits=0;
  while(!h.s.finales.ageha&&visits<12){h.s.day=17+visits;assert((await h.visit()).used);visits++;}
  assert.equal(visits,7);
}
for(const mode of ['missing','load']){
  const h=harness('samechan',36);h.s.story.samechan=1;h.s.flags._samechan_quiet_seat_done=true;
  if(mode==='missing')h.c.missingAnswer=true;else h.c.swap='samechan_shop_bond_question';
  assert.equal(await h.visit(),false);assert.equal(h.gains.length,0);assert.equal(h.charges.length,0);assert(!h.s.flags._samechan_closing_check_done);
}
// Ageha: old followup completion never inferred, malformed followup and cancellation remain unpaid.
for(const mode of ['cancel','load','malformed']){
  const h=harness('ageha',22);h.s.flags._ch2_talks={ageha:1};
  if(mode==='malformed')h.c.DB.dialogues.remake_ch2_ageha_followup.lines=[{type:'bad'}];
  else if(mode==='cancel')h.c.cancel='remake_ch2_ageha_gyaru';else h.c.swap='remake_ch2_ageha_gyaru';
  const r=await h.visit();assert.equal(r.used,false);assert.equal(h.charges.length,0);assert.equal(h.gains.length,0);assert(!h.s.flags._ch2_followup_done?.ageha);assert(!h.s.flags._ch2_read_remake_ch2_ageha_gyaru);
}
{
  const h=harness('ageha',22);h.s.flags._ch2_talks={ageha:1};h.s.flags._ch2_followup_done={ageha:true};
  assert((await h.visit()).used);assert.deepEqual(h.played,['remake_ch2_ageha_gyaru']);
}
{
  const h=harness('ageha',22);h.s.day=22;h.s.flags._ch2_talks={ageha:1};
  assert((await h.visit()).used);assert.deepEqual(h.played,['remake_ch2_ageha_followup'],'late bad day is a separate arrival, not a sudden mood change after the followup');
  h.s.day++;assert((await h.visit()).used);assert.equal(h.played.at(-1),'remake_ch2_ageha_badday');
}
console.log('affinity visit pacing: PASS (real entrypoints/gain, neutral 7 / 7-8 visits, friendship/romance, night, old saves, interruption, one receipt)');
