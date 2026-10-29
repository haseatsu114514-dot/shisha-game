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
assert.match(text('tasting',base),/最初の香りがはっきり/);
assert.match(text('tasting',base),/最後まで届けた/);
assert.match(text('tasting',{...base,pull:hot}),/提供時|立ち上がり/);
assert.match(text('tasting',{...base,pull:cold,careHistory:[hot,good]}),/最後の調整で戻した/);
assert.match(text('tasting',{...base,careHistory:[good,hot]}),/最後の調整は熱が強い/);
assert.match(text('tasting',{...base,careHistory:[good,cold]}),/最後の調整では熱が足りなかった/);
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
const nationalInterludeSpeakers=[1,2].flatMap(n=>tournamentStoryDialogue({...cs,chapter:3},`interlude${n}`,()=>0).lines.map(l=>l.speaker));
assert(!nationalInterludeSpeakers.some(s=>['maezono','naru','adam','minto','ageha','kumicho','rei'].includes(s)),
 'Chapter 3 interludes used an earlier rival or judge');
console.log('PASS: three tournaments, judges, packings, mix, crowds, temperature/care callbacks, legacy saves and no score mutation');
