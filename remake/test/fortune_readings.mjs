import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import { activeFortuneSight, grantFortuneReading, fortuneChoiceIndex, fortuneResultId, registerFortuneReadings } from '../js/core/fortune-effects.js';
import { openingStatus, spotTimeNote } from '../js/daily/spot-hours.js';
const trivia=JSON.parse(fs.readFileSync(new URL('../data/fortune-trivia.json',import.meta.url)));
const hints=JSON.parse(fs.readFileSync(new URL('../data/fortune-choice-hints.json',import.meta.url)));
assert.equal(Object.keys(trivia.characters).length,8);
const all=Object.values(trivia.characters).flat(); assert.equal(all.length,40); assert.equal(new Set(all.map(x=>x.id)).size,40);
for(const [char,entries] of Object.entries(trivia.characters)) {
 assert.equal(entries.length,5); assert(entries.every(x=>x.teller && x.reaction));
 const s={chapter:1,day:3,seed:131,flags:{},fortune:null}; const beforeSeed=s.seed;
 const seen=[]; for(let i=0;i<5;i++)seen.push(grantFortuneReading(s,char,trivia).id);
 assert.equal(new Set(seen).size,5,'repeat before all five have been read');
 const next=grantFortuneReading(s,char,trivia); assert(entries.some(x=>x.id===next.id)); assert.equal(s.seed,beforeSeed,'fortune advances gameplay RNG');
 assert.equal(activeFortuneSight(s).char,char);
 s.fortune=null; assert(activeFortuneSight(s),'one-visit affinity consumption removed three-day sight');
 for(const day of [3,4,5]) {s.day=day;assert(activeFortuneSight(JSON.parse(JSON.stringify(s))));}
 s.day=6;assert.equal(activeFortuneSight(s),null);
 s.day=2;assert.equal(activeFortuneSight(s),null);
 s.day=3;s.chapter=2;assert.equal(activeFortuneSight(s),null);
}
const border={chapter:1,day:13,seed:1,flags:{}};grantFortuneReading(border,'naru',trivia);
border.chapter=2;border.day=15;border.flags._ch2_day1={startDay:15};assert(activeFortuneSight(border),'chapter transition prematurely expires sight');
border.day=16;assert.equal(activeFortuneSight(border),null);
const save={chapter:1,day:3,seed:1,flags:{},money:90000};grantFortuneReading(save,'naru',trivia);
const line={id:'naru_first_scout',choices:[{next:'scout_honest'},{next:'scout_bluff'}]};
assert.equal(fortuneChoiceIndex(save,'ch1_naru_first',line,hints),0);
assert.equal(fortuneChoiceIndex({...save,day:5},'ch1_naru_first',line,hints),0);
assert.equal(fortuneChoiceIndex({...save,day:6},'ch1_naru_first',line,hints),-1);
assert.equal(fortuneChoiceIndex(save,'other_dialogue',line,hints),-1);
assert.equal(fortuneChoiceIndex(save,'ch1_naru_first',{...line,choices:[...line.choices,{}]},hints),-1);
assert.equal(fortuneChoiceIndex(save,'ch1_naru_first',{...line,choices:[...line.choices].reverse()},hints),-1,'stale annotations should not label a changed choice');
const before=JSON.stringify(save);fortuneChoiceIndex(save,'ch1_naru_first',line,hints);assert.equal(JSON.stringify(save),before);
grantFortuneReading(save,'rin',trivia); assert.equal(fortuneChoiceIndex(save,'ch1_naru_first',line,hints),-1);
const romance={id:'bond_q1_rin',choices:[{next:'personal'},{next:'work'}]};
assert.equal(fortuneChoiceIndex(save,'ch1_rin_bond_question',romance,{...hints,includeRomance:false}),-1);
assert.equal(fortuneChoiceIndex(save,'ch1_rin_bond_question',romance,{...hints,includeRomance:true}),0);
assert.equal(activeFortuneSight({chapter:1,day:3,flags:{_fortune_choice_sight:{char:'naru',chapter:1,from:3,until:999}}}),null);
const base=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/remake_ch1.json',import.meta.url))).dialogues;
const db={dialogues:Object.fromEntries(base.map(d=>[d.dialogue_id,d])),fortuneTrivia:trivia};
registerFortuneReadings(db);
for(const entry of all) {const d=db.dialogues[fortuneResultId(entry)];assert(d);assert(d.lines.some(l=>l.text===entry.teller));assert(d.lines.some(l=>l.type==='motion'&&l.id==='tarot'));}
assert(db.dialogues.remake_fortune_result,'legacy result was removed');
for(const slot of [1,2])assert.equal(openingStatus({kind:'fortune'},{slot}).ok,false);
assert.equal(openingStatus({kind:'fortune'},{slot:0}).ok,true);
assert.equal(spotTimeNote({kind:'fortune'},{slot:1}),'昼のみ営業');
// Verify annotations against the actual authored branches rather than implementation fixtures.
const dialogues={};for(const f of fs.readdirSync(new URL('../../data/dialogue/',import.meta.url)).filter(x=>x.endsWith('.json'))) {
 const raw=JSON.parse(fs.readFileSync(new URL('../../data/dialogue/'+f,import.meta.url)));
 for(const d of raw.dialogues||[])dialogues[d.dialogue_id]=d;
}
for(const [key,h] of Object.entries(hints.choices)){
 const [did,cid]=key.split(':'),d=dialogues[did],c=d?.lines.find(l=>l.type==='choice'&&l.id===cid);
 assert(c,key+' missing');assert.deepEqual(c.choices.map(x=>String(x.next||x.next_id||'')),h.options,key+' annotation stale');assert(h.options.includes(h.preferred));
}
const art=spawnSync('python3',['-c',`
from PIL import Image
import json,sys
from pathlib import Path
root=Path(sys.argv[1]); a=Image.open(root/'asset_sources/fortune-teller-682/generated.png').convert('RGBA');b=Image.open(root/'assets/sprites/characters/uranaishi/chr_uranaishi_normal.png').convert('RGBA')
assert a.size==b.size and a.tobytes()==b.tobytes(), 'portrait encoding changed source pixels'
alpha=b.getchannel('A');assert alpha.getextrema()==(0,255)
for p in [(0,0),(b.width-1,0),(0,b.height-1),(b.width-1,b.height-1)]:assert alpha.getpixel(p)==0
left,top,right,bottom=alpha.point(lambda v:255 if v>2 else 0).getbbox();assert left>0 and top>0 and right<b.width and bottom<b.height, 'portrait cut off at an edge'
w=Image.open(root/'remake/img/sprites/characters/uranaishi/chr_uranaishi_normal.webp').convert('RGBA');assert w.size==b.size and w.getchannel('A').tobytes()==alpha.tobytes()
m=json.loads((root/'remake/data/manifest.json').read_text());assert m['portraits']['uranaishi']['faces']==['normal']
`,new URL('../../',import.meta.url).pathname],{encoding:'utf8'});assert.equal(art.status,0,art.stderr);
console.log('PASS fortune: 40 provisional readings, nonrepeat/save/RNG, inclusive three days, independent bonus, guarded choice hints, daylight hours and authored annotations');
