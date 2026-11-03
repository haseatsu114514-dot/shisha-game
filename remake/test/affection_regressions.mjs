// 実stats/growth/stateと交流関数。VN/DOMのみ代役、通常プレイや画面目視とは別。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,String(v)), removeItem:k=>storage.delete(k) };
const core = await import('../js/core/state.js');
const stats = await import('../js/core/stats.js');
const growth = await import('../js/core/growth.js');
const read = p=>fs.readFileSync(new URL('../js/'+p,import.meta.url),'utf8');
function fresh() { core.newGame();core.state.phase='daily';growth.ensureGrowth();return core.state; }
// 無料LIMEで♥5。夜にだけ火種を回収し、無料EXP・既存セーブの値を増やさない。
{
 const s=fresh();s.affinity.naru=65;
 for(let i=0;i<3;i++)stats.gainAffinity('naru',2,{source:'lime',onGain(){}});
 assert.equal(stats.affinityLevel('naru'),5);assert.equal(s.growth.xp,0);assert(!s.growth.gifted.naru);
 core.save();assert(core.load());
 const report=growth.settleGrowth();assert.equal(core.state.growth.xp,0);
 assert.deepEqual(report.gifts,[{who:'naru',parts:[{kind:'wisdom',n:2}]}]);
 assert.equal(core.state.growth.hidane.wisdom,2);assert.equal(core.state.growth.gifted.naru,true);
 assert.deepEqual(growth.settleGrowth().gifts,[]);core.save();core.load();
 assert.deepEqual(growth.settleGrowth().gifts,[]);assert.equal(core.state.growth.hidane.wisdom,2);
}
// 以前の無料♥5セーブ、恋人、非対象人物、別セーブ、無効モード。
{
 const s=fresh();s.affinity.adam=66;s.lovers=['samechan'];s.affinity.sumi=66;s.affinity.tsumugi=66;
 growth.setGrowthPreview(false);assert.equal(growth.settleGrowth(),null);assert.equal(s.growth.earned,0);
 growth.setGrowthPreview(true);const report=growth.settleGrowth();
 assert.deepEqual(report.gifts.map(x=>x.who),['adam','samechan']);assert.equal(s.growth.earned,4);
 fresh();assert.deepEqual(growth.settleGrowth().gifts,[]);
}
// 有料の段上昇ですでに渡した火種を、夜に重ねない。
{
 const s=fresh();s.affinity.naru=65;
 await stats.paidAction(()=>{stats.gainAffinity('naru',2);stats.addStamina(-10);return true;},{exp:{key:'naru',person:'naru'}});
 assert.equal(s.growth.hidane.wisdom,2);growth.settleGrowth();assert.equal(s.growth.hidane.wisdom,2);
}
// ましろの恋人節目: 実gainAffinityとprivate scope。読了、中断、同じ節目の再入、LOAD。
{
 const source=read('chapters/ch3-tokyo-daily.js');
 const body=source.slice(source.indexOf('async function readMashiroBond('),source.indexOf('\n/** 帰りに裏口'));
 let mode='done',seen=false;
 const context=vm.createContext({get state(){return core.state;},unused:{used:false,exerted:false},BG:x=>x,setBg:async()=>{},
  readLoverMilestone:async()=>{if(mode==='load'){fresh();return true;}if(mode==='cancel'||seen)return false;seen=true;return true;},
  playQuestionVisit:async()=>true,playFinale:async()=>true,personExp:id=>({key:id}),
  addStamina:stats.addStamina,gainAffinity:stats.gainAffinity,privateBondScope:stats.privateBondScope});
 vm.runInContext(body+';globalThis.run=readMashiroBond;',context);
 function lover(){const s=fresh();s.chapter=3;s.lovers=['mashiro'];s.lovePts.mashiro=9;s.loveLevel.mashiro=1;return s;}
 let s=lover();const result=await context.run('lover',async()=>true,s);
 assert(result.used);assert.equal(s.lovePts.mashiro+s.loveCarry.mashiro,11.5);assert.equal(stats.bond.private,false);
 const before=JSON.stringify(s);assert(!(await context.run('lover',async()=>true,s)).used);assert.equal(JSON.stringify(s),before);
 mode='cancel';seen=false;s=lover();assert(!(await context.run('lover',async()=>true,s)).used);assert.equal(s.lovePts.mashiro,9);assert.equal(s.stamina,100);
 mode='load';s=lover();assert(!(await context.run('lover',async()=>true,s)).used);assert.notEqual(core.state,s);assert.equal(core.state.stamina,100);assert.equal(stats.bond.private,false);
 s=lover();stats.gainAffinity('mashiro',16);assert.equal(s.lovePts.mashiro,9,'仕事中の通常来店は恋人の絆を増やさない');
}
// サメちゃんの実来店と実加算。初遭遇保証から♥5まで、会話順と支払済みreceiptを保持。
{
 const stages=await import('../js/core/affinity-stages.js');
 const dialogues=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/samechan.json',import.meta.url))).dialogues;
 const DB={dialogues:Object.fromEntries(dialogues.map(x=>[x.dialogue_id,x]))};let mode='done';const played=[];
 const c=vm.createContext({get state(){return core.state;},DB,Set,WeakSet,save:core.save,markMet:core.markMet,
  ...stats,...stages,visitAffinity:kind=>stats.visitAffinity(kind),isPlaying:()=>false,
  cinemaIntroductionDue:()=>false,maybeRecruitTrpgMember:async()=>false,finaleAtVisit:()=>false,
  play:async scene=>{const id=typeof scene==='string'?scene:scene.dialogue_id;played.push(id);
   if(mode==='load'){fresh();return {cancelled:false};}if(mode==='cancel')return {cancelled:true};
   if(id==='samechan_shop_bond_question')core.state.romanceChoices.bond_q1_samechan={char:'samechan',value:0};return {cancelled:false};}});
 const source=read('daily/samechan.js').replace(/^import\s[^;]+;$/gm,'').replace(/\bexport\s+(?=(?:const|function|async function))/g,'');
 vm.runInContext(source+';globalThis.visit=visitSamechan;',c);
 const spot={id:'shishark',cost:3000,stamina:-12};
 let s=fresh();s.chapter=2;s.day=15;s.slot=1;s.money=100000;
 stats.ensureAffinityLevel('samechan',1);stats.gainAffinity('samechan',1);
 let visits=0;while(stats.affinityLevel('samechan')<5&&visits<12){assert(await c.visit(spot));visits++;core.state.day++;}
 assert.equal(visits,6);assert.equal(s.flags._samechan_bond_question_done,true);
 assert(!s.flags._samechan_heart4_done&&!s.flags._samechan_heart5_done,'数値MAXだけで既読を先取りしない');
 for(let i=0;i<2;i++){await c.visit(spot);s.day++;}assert(s.flags._samechan_heart4_done&&s.flags._samechan_heart5_done);
 assert(played.indexOf('samechan_shop_bond_question')<played.indexOf('samechan_shop_heart4'));
 s.day--;const before=JSON.stringify(s);await c.visit(spot);assert.equal(JSON.stringify(s),before,'同日同枠の再入は無料・報酬なし');
 core.save();core.load();const saved=JSON.stringify(core.state);await c.visit(spot);assert.equal(JSON.stringify(core.state),saved,'LOAD後もreceiptが二重付与を防ぐ');
 mode='cancel';s=fresh();s.chapter=2;s.money=3000;assert.equal(await c.visit(spot),false);assert.equal(s.money,3000);assert.equal(s.story.samechan,undefined);
 mode='load';s=fresh();s.chapter=2;s.money=3000;assert.equal(await c.visit(spot),false);assert.equal(core.state.money,30000);
}
// 人間関係の実行時フィルタ。面識のない後発人物を名前/顔ごと漏らさない。
{
 const source=read('daily/status.js');const start=source.indexOf('const PEOPLE =');const end=source.indexOf('\n/** 贈られた機材',start);
 const node=(tag,props={},children=[])=>Array.isArray(props)?{tag,children:props}:{tag,...props,children};
 const c=vm.createContext({get state(){return core.state;},el:node,affinityLevel:stats.affinityLevel,faceIconUrl:()=>null,displayName:id=>id,
 relationshipStatus:()=>({kind:'known',label:'知人'}),recentMemoryEcho:()=>null,heartRow:()=>({tag:'hearts'})});
 vm.runInContext(source.slice(start,end)+';globalThis.run=peopleTab;',c);
 const s=fresh(),ids=['kuze','steve','volk','master_hookah','da_silva','sheikh'];
 const rows=()=>c.run().children.filter(x=>x?.dataset?.person).map(x=>x.dataset.person);
 assert.deepEqual(Array.from(rows()),['sumi']);for(const id of ids)s.met[id]=true;
 assert.deepEqual(Array.from(rows()),['sumi',...ids]);assert(!rows().includes('noor'));
}
console.log('affection regressions: free ♥5 recovery / no duplicate EXP or gifts / private Mashiro bond / LOAD / later people secrecy: PASS');
