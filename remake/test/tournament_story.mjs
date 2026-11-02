import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DB } from '../js/core/data.js';
import { temperatureBands } from '../js/craft/temperature-model.js';
import { tournamentStoryDialogue } from '../js/craft/tournament-story-data.js';
import { feedbackLine, evaluationOf } from '../js/craft/feedback.js';
const dialogues = JSON.parse(fs.readFileSync(new URL('../../data/dialogue/tournament_craft.json',import.meta.url))).dialogues;
Object.assign(DB.dialogues,Object.fromEntries(dialogues.map(d=>[d.dialogue_id,d])));
DB.flavorById = { mint:{short_name:'ミント',heat_tolerance:1}, strawberry:{short_name:'ストロベリー',heat_tolerance:1.2} };
const cs={chapter:1,mix:{mint:8,strawberry:4},pack:'normal',tournamentStory:{servedAroma:85,seen:[]}};
const text=(event,c=cs,r=()=>0)=>tournamentStoryDialogue(c,event,r).lines.map(l=>l.text).join('\n');
for (const chapter of [1,2,3]) {
 const c={...cs,chapter}; assert.match(text('opening',c),chapter===1?/なる、アダム、みんと/:chapter===2?/ストロベリー/:/久世、スティーブ、ヴォルク/);
 assert.match(text('waiting',c),chapter===1?/なる選手/:chapter===2?/あげは選手/:/久世|スティーブ|ヴォルク/);
}
for (const event of ['opening','packed','waiting','tasting']) {
 const national=tournamentStoryDialogue({...cs,chapter:3,pull:{temp:.5},careHistory:[]},event,()=>.99);
 assert(!national.lines.some(line=>['maezono','naru','adam','minto','ageha','kumicho','rei'].includes(line.speaker)),
  `Chapter 3 ${event} used an earlier rival or judge`);
}
// Audience/graphics import the browser audio module, so provide its visibility observer only.
globalThis.document={addEventListener(){}};
const [{audienceFor},{JUDGE_LOOK}]=await Promise.all([
 import('../js/craft/audience.js'),import('../js/craft/tournament-graphics.js'),
]);
delete globalThis.document;
assert.deepEqual(audienceFor('tournament',3),['nagumo','emil','dr_kemuri']);
assert.equal(new Set(['nagumo','emil','dr_kemuri'].map(id=>JUDGE_LOOK[id].color)).size,3);
assert.match(feedbackLine('emil','pull',evaluationOf(90)),/奥の味/);
const nationalBroadcast=JSON.parse(fs.readFileSync(new URL('../data/broadcast.json',import.meta.url))).chapter3;
assert(nationalBroadcast.rivalComments.length && nationalBroadcast.rivalFeed.length);
assert(!/なる選手|あげは|神崎|REI|アダム|みんと/.test(JSON.stringify(nationalBroadcast)));
for (const [pack,expected] of [['fluffy',/ふわっと/],['normal',/均等/],['firm',/しっかり/]]) {
 const lines=text('packed',{...cs,pack});assert.match(lines,expected);assert.match(lines,/ミント 8g、ストロベリー 4g/);
 assert(!/成功|失敗|完璧/.test(lines));
}
assert.match(text('packed',{...cs,mix:{mint:12,strawberry:0}}),/一本で/);
assert(!text('packed',{...cs,mix:{mint:12,strawberry:NaN}}).includes('NaN'));
for (const r of [0,.34,.99]) assert.equal(tournamentStoryDialogue(cs,'waiting',()=>r).lines.length,5);
const b=temperatureBands(cs),good={temp:b.center},hot={temp:b.ideal[1]+.01},cold={temp:b.ideal[0]-.01};
const base={...cs,pull:good,careHistory:[good,good]};
assert.match(text('tasting',base),/香りがすっと鼻に抜けた/);
// 試飲の感想は配合カードではなく葉の名前で言う（メーカー略称・g数を読み上げない。主役2種まで）
assert.match(text('tasting',base),/さっきのミントとストロベリーだねえ/);assert.doesNotMatch(text('tasting',base),/\d+g/);
{ const saved=DB.flavorById; DB.flavorById={...saved,lemon:{short_name:'AF レモン'},peach:{short_name:'ドバジ ピーチ'}};
  const three=text('tasting',{...base,mix:{lemon:3,peach:5,mint:4}});assert.match(three,/さっきのピーチとミントだねえ/);assert.doesNotMatch(three,/AF|ドバジ|レモン/);
  DB.flavorById=saved; }
assert.match(text('tasting',base),/最後まで届けた/);
assert.match(text('tasting',{...base,pull:hot}),/提供時|立ち上がり/);
assert.match(text('tasting',{...base,pull:cold,careHistory:[hot,good]}),/最後の調整で戻した/);
assert.match(text('tasting',{...base,careHistory:[good,hot]}),/最後の調整は熱が強い/);
assert.match(text('tasting',{...base,careHistory:[good,cold]}),/最後の調整は熱が足りない/);
assert.match(text('tasting',{...base,tournamentStory:{servedAroma:20}}),/もう少し輪郭/);
assert.match(text('tasting',{...base,tournamentStory:undefined}),/最後まで味わわせて/);
assert.match(text('tasting',{...cs}),/提供後の変化/);
const saved=JSON.stringify(base);
for (const event of ['opening','packed','waiting','tasting']) {
 const d=tournamentStoryDialogue(base,event);
 assert(d.lines.length>=4&&d.lines.length<=7);assert(!JSON.stringify(d).match(/\{flavors\}|\{packing\}/));
 assert.deepEqual(tournamentStoryDialogue(JSON.parse(saved),event,()=>0),tournamentStoryDialogue(base,event,()=>0));
}
assert.equal(JSON.stringify(base),saved,'Dialogue must not alter craft/results');
// Interlude banter (#1290): scenes exist per chapter, stay within 4-7 lines,
// and Chapter 3 interludes use only the national cast.
for (const chapter of [1, 2, 3]) {
 const c={...cs,chapter};
 for (const event of ['interlude1','interlude2']) {
  const d=tournamentStoryDialogue(c,event,()=>0);
  assert(d.lines.length>=4&&d.lines.length<=7,`${event}_${chapter} line count`);
 }
}
assert(tournamentStoryDialogue(cs,'interlude3',()=>0).lines.length>=4);
// 第2章の大会当日（2026-10-28 ドラマ性）: 提供前の心の声と講評前の待ち時間は第2章の4人だけで、結果を言わない。
for (const event of ['interlude_pull','interlude3']) {
 const d=tournamentStoryDialogue({...cs,chapter:2},event,()=>0);
 assert(d.lines.length>=4&&d.lines.length<=7,`${event}_2 line count`);
 assert(d.lines.every(l=>['','pakki','hajime','ageha','kumicho','rei'].includes(l.speaker)),`${event}_2 used another chapter's cast`);
 assert.doesNotMatch(d.lines.map(l=>l.text).join('\n'),/優勝|県代表|震え/,`${event}_2 must not reveal results or the secret`);
}
// #1649: 第2章の提供後の掛け合いは、実際に投入された票（castVotes の結果）と提供の実績から選ぶ。
{
 const T=await import('../js/chapters/ch2-tournament-state.js');
 const empty=()=>({votes:Object.fromEntries(T.JUDGES.map(j=>[j,Object.fromEntries(T.CONTESTANTS.map(c=>[c,0]))])),voted:0});
 const agehaOf=progress=>T.JUDGES.reduce((sum,j)=>sum+(progress.lastVotes[j].points.ageha||0),0);
 const banter=(progress,c={...cs,chapter:2})=>tournamentStoryDialogue(c,'interlude1',()=>0,{progress});
 const agehaText=d=>d.lines.filter(l=>l.speaker==='ageha').map(l=>l.text).join('\n');
 // 多数票: はじめが低い一台では、上園があげはを一番に推す。
 const many=empty(); for(const r of [0,1]) T.castVotes(many,r,40);
 assert(agehaOf(many)>=2); assert.match(agehaText(banter(many)),/一番に入れてくれた/);
 // はじめが全審査員の1位でも、あげはは上園の二番手として票を得る（上園の好み補正で神崎を上回る）。
 const strong=empty(); for(const r of [0,1]) T.castVotes(strong,r,98);
 assert.equal(agehaOf(strong),1); assert.equal(strong.lastVotes.maezono.second,'ageha');
 assert.match(agehaText(banter(strong)),/二番手/);
 // あげは0票（旧値で投じられた保存など）: 「票、入ってる」と言わない。
 const zero=empty(); for(const r of [0,1]) T.castVotes(zero,r,98);
 for(const j of T.JUDGES){ zero.votes[j].kumicho+=zero.votes[j].ageha; zero.votes[j].ageha=0; }
 for(const j of T.JUDGES){ const l=zero.lastVotes[j]; if(l.second==='ageha'){ l.second='kumicho'; l.points={[l.first]:l.points[l.first],kumicho:1}; } }
 assert.equal(agehaOf(zero),0); const zt=agehaText(banter(zero));
 assert.match(zt,/一点も入ってない/); assert.doesNotMatch(zt,/票、入ってる|一番に/);
 // 「一回目」とは言わない（この場面は提供後、2回目の投票の後）。票の記録が無ければ票に触れない。
 for(const d of [banter(many),banter(strong),banter(zero),banter(null)]){
  assert.doesNotMatch(d.lines.map(l=>l.text).join('\n'),/一回目/);
  assert(d.lines.length>=4&&d.lines.length<=7);
 }
 assert.doesNotMatch(agehaText(banter(null)),/票、入ってる|一点も/);
 // はじめの独白は提供の温度・香りに合わせる。
 const bands=temperatureBands({...cs,chapter:2});
 const mid=(bands.ideal[0]+bands.ideal[1])/2;
 const hajime=c=>banter(many,{...cs,chapter:2,...c}).lines.filter(l=>l.speaker==='hajime').map(l=>l.text).join('\n');
 assert.match(hajime({pull:{temp:mid}}),/起きてる/);
 assert.match(hajime({pull:{temp:bands.ideal[1]+.05}}),/熱を一段引き/);
 assert.match(hajime({pull:{temp:bands.ideal[0]-.05}}),/熱が足りなくて/);
 assert.match(hajime({pull:{temp:mid},tournamentStory:{servedAroma:40,seen:[]}}),/立ちきってない/);
}
const ch2Broadcast=JSON.parse(fs.readFileSync(new URL('../data/broadcast.json',import.meta.url))).chapter2;
for (const step of ['holes','heat','steam','pull','care']) for (const kind of ['perfect','great','good','miss'])
 assert(ch2Broadcast.completion[step][kind].length,`chapter2 completion ${step}.${kind}`);
assert(!/なる選手|アダム|みんと|久世|スティーブ|ヴォルク|エミル/.test(JSON.stringify(ch2Broadcast)),'chapter2 broadcast used another chapter cast');
const nationalInterludeSpeakers=[1,2].flatMap(n=>tournamentStoryDialogue({...cs,chapter:3},`interlude${n}`,()=>0).lines.map(l=>l.speaker));
assert(!nationalInterludeSpeakers.some(s=>['maezono','naru','adam','minto','ageha','kumicho','rei'].includes(s)),
 'Chapter 3 interludes used an earlier rival or judge');
console.log('PASS: three tournaments, judges, packings, mix, crowds, temperature/care callbacks, legacy saves and no score mutation');
