// DJ set contracts (2026-11-01 redesign, DJS17 gameplay; 2026-11-13 DJF feel: 4-bar entry lines, feel table, sound effects; DJG: no tempo faders, slips fixed on the platter): quantized ▶, guide-line fader follow, 選曲, automatic EQ, floor meter, set flow.
// Actual modules + controlled WebAudio; no real browser/listening claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {cancelReserve,createSet,makeDeck,playDeck,pauseMix,resumeMix,beatAt,phaseError,gains,updateSet,nudgeDeck,SYNC_BAND,SNAP_BAND,DRIFT_BEATS,SYNC_FLOOR,SLIP_FLOOR,quality,floorStep,scoreTransition,scoreFromErr,scoreFromRatio,rankFromScore,scoreSet,lowCutDb,LOW_CUT_DB,PHRASE,LEAD,GRACE,FOLLOW_BAND,toward,gradeOf,ENTRY_BANDS,PHONES_ALLOWANCE,dancerPose,guideAt,keyMatch,energyMatch,pickRating,chooseTrack,REQUESTS,PICK_FLOOR,GRADE_FLOOR,RANK_FLOOR,FOLLOW_FLOOR,FLOOR_WARM,FOLLOW_SWEET,MOODS,moodOf,followHint,QUICK_GRID,quickEntry,RANK_LINES} from '../previews/dj/model.mjs';
import {FEEL,applyFeelOverrides} from '../previews/dj/feel.mjs';
import {DJSfx} from '../previews/dj/sfx.mjs';
import {renderTrack,peakAt} from '../previews/dj/synth.mjs';
import {DJAudio,TrackLoadError} from '../previews/dj/audio.mjs';
import {TRACKS,SETS,buildTrackData,buildBufferTrackData,peakAt as fullPeakAt,previewBeat} from '../previews/dj/tracks.mjs';
let groups=0;async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const S1=SETS[0],S2=SETS[1],S3=SETS[2];
// 皿の仕組みの検査は、いつもズレる版で確かめる（本物のセットは DJR03 から「たまにズレる」）。数値は以前の SET 2・3 と同じ
const SLIP2={...S2,drift:{windows:[[6,20]],size:[.12,.2]}},SLIP3={...S3,drift:{windows:[[4,11],[17,25]],size:[.16,.3]}};
const sec=(d,beats)=>beats*60/d.bpm; // seconds for beats on a deck

await check('sets: an opening pair plus picks up to count; every track arrives at the playing tempo (no tempo faders, DJG); SET 1 never slips, SET 2 once, SET 3 twice',()=>{
 const m=createSet(S1);assert.deepEqual(m.decks.map(d=>d.bpm),[120,120]);assert.deepEqual(m.decks.map(d=>d.track),['danceMonster','digitalLemonade']);assert.deepEqual(m.played,['danceMonster','digitalLemonade']);assert.equal(m.count,3);assert.equal(m.phase,'idle');near(m.floor,.5);
 const m3=createSet(S3);assert.deepEqual(m3.decks.map(d=>d.bpm),[122,122],'SET 3: the 120 BPM track is brought up to 122');assert.deepEqual(m3.decks.map(d=>d.nativeBpm),[122,120]);
 assert.equal(SETS.length,3);assert.deepEqual(SETS.map(s=>s.count),[3,4,4]);for(const s of SETS){assert.equal(s.tracks.length,2);for(const k of s.tracks)assert(TRACKS[k]);assert(!('detune' in s));}
 assert.equal(S1.drift,null);assert.deepEqual(S2.drift,{windows:[[6,20]],size:[.1,.16],chance:.25});assert.deepEqual(S3.drift,{windows:[[4,11],[17,25]],size:[.12,.22],chance:.25});
 for(const s of [...SETS,SLIP2,SLIP3])for(const [from,to] of s.drift?.windows||[]){assert(from>=2&&to+DRIFT_BEATS<=PHRASE-2,'a slip settles with beats left to fix it');assert(s.drift.size[0]>SYNC_BAND&&s.drift.size[1]<.5);}
 for(const t of Object.values(TRACKS)){assert.match(t.camelot,/^(1[0-2]|[1-9])[AB]$/);assert(Number.isInteger(t.energy)&&t.energy>=1&&t.energy<=5);}
});
await check('decks: a track plays at its own tempo unless it is brought in at another; BPM rounds to 0.01',()=>{
 const d=makeDeck('danceMonster');assert.deepEqual([d.bpm,d.nativeBpm,d.playing],[120,120,false]);assert.equal(makeDeck('risingTide',120).bpm,120);assert.equal(makeDeck('risingTide',120).nativeBpm,122);assert.equal(makeDeck('danceMonster',121.004).bpm,121);
});
await check('▶ A starts A at once and cues B at the next phrase head at least 4 bars away; B never auto-starts',()=>{
 const m=createSet(S1);assert(playDeck(m,0,2));assert.deepEqual([m.phase,m.cue.from,m.cue.to,m.cue.start,m.cue.end],['cue',0,1,PHRASE,2*PHRASE]);assert.equal(m.master,0);
 const before=JSON.stringify(m.decks[1]);for(const t of [3,10,17.9,20,30])updateSet(m,t);assert.equal(JSON.stringify(m.decks[1]),before);
 const m2=createSet(S1);playDeck(m2,0,0);m2.decks[0].beat=20;assert.equal(playDeck(m2,0,0),false);
 const m3=createSet(S1);m3.decks[0].playing=false;playDeck(m3,1,5);assert.equal(m3.master,1);assert.deepEqual([m3.cue.from,m3.cue.to],[1,0]);
});
await check('cue view: bars remaining, open window, a missed head rolls to the next phrase',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0];
 let v=updateSet(m,sec(a,28));assert.equal(v.mode,'cue');near(v.remaining,4);assert(!v.open);
 v=updateSet(m,sec(a,32.5));assert(v.open);near(v.remaining,-.5);
 v=updateSet(m,sec(a,64.1));assert.equal(m.cue.start,64);assert.equal(m.cue.end,96);assert.equal(m.cue.missed,1);assert(v.open,'the head that just passed is still playable (late)');v=updateSet(m,sec(a,130));assert.equal(m.cue.start,128);assert.equal(m.cue.missed,3);
});
await check('#2456 §4 forgiving entry: graded in beats (PERFECT ±½・GOOD ±2・OK ±4); early is held for the line (予約), late comes in phrase-aligned; outside the bands the ▶ is not taken',()=>{
 // 120 BPM: a beat is 500 ms. Every accepted ▶ puts B's beat 0 exactly on the entry line, so the two tracks' phrases line up.
 for(const [beat,ms,grade,reserved] of [[31.9,-50,'PERFECT',true],[32.02,10,'PERFECT',false],[31.5,-250,'PERFECT',true],[32.9,450,'GOOD',false],[30.5,-750,'GOOD',true],[34.5,1250,'OK',false],[28,-2000,'OK',true],[36,2000,'OK',false]]){
  const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t=sec(a,beat);updateSet(m,t);assert(playDeck(m,1,t),`${beat} is taken`);
  near(m.lastPlay.errorMs,ms,1e-6);assert.equal(m.lastPlay.grade,grade);assert.equal(m.lastPlay.reserved,reserved);assert.equal(m.cue.pressed.reserved,reserved);assert.equal(m.cue.pressed.beat,32);assert.equal(m.phase,'mix');
  near(m.decks[1].at,sec(a,32));near(m.lastPlay.at,sec(a,32));near(beatAt(m.decks[1],sec(a,32)),0);near(beatAt(m.decks[1],sec(a,33)),1);near(phaseError(a,m.decks[1],sec(a,40)),0);
  const v=updateSet(m,t);assert.equal(v.reserved,reserved,'the view says the track is waiting for the line');if(reserved)near(v.untilIn,32-beat,1e-6);
  if(reserved){const w=updateSet(m,sec(a,32.01));assert(!w.reserved,'in on the line');}
 }
 // outside the OK band the ▶ is not taken (nothing changes, nothing is lost): too early before the count, too late after the bar of いま！
 for(const beat of [27.9,36.1,40,47.9]){const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t=sec(a,beat);updateSet(m,t);const floor=m.floor;assert.equal(playDeck(m,1,t),false,`${beat} is not taken`);
  assert.equal(m.phase,'cue');assert.equal(m.cue.pressed,null);assert.equal(m.lastPlay,null);assert(!m.decks[1].playing);near(m.floor,floor);}
 // aiming at the next line: past the middle of the gap the nearest line is the next one (4-bar lines)
 {const m=createSet(S1,Math.random,quickEntry());playDeck(m,0,0);const a=m.decks[0];assert.equal(m.cue.start,16);updateSet(m,sec(a,25));assert.equal(playDeck(m,1,sec(a,25)),false,'7 beats before the next line');
  assert(playDeck(m,1,sec(a,29)));assert.equal(m.cue.start,32);assert.equal(m.cue.missed,1);assert.equal(m.lastPlay.grade,'OK');assert(m.lastPlay.reserved);}
 // the main game's headphones widen every band by a quarter beat (DJK07: PERFECT ±½ → ±¾, OK reaches 4¼ beats)
 {const m=createSet(S1,Math.random,{allowance:PHONES_ALLOWANCE});playDeck(m,0,0);const a=m.decks[0],t=sec(a,32-4.2);updateSet(m,t);assert(playDeck(m,1,t),'4.2 beats early is taken with the headphones');assert.equal(m.lastPlay.grade,'OK');}
 {const m=createSet(S1,Math.random,{allowance:PHONES_ALLOWANCE});playDeck(m,0,0);const a=m.decks[0],t=sec(a,32.7);updateSet(m,t);assert(playDeck(m,1,t));assert.equal(m.lastPlay.grade,'PERFECT','¾ beat late is still PERFECT with them');}
 {const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t=sec(a,32-4.2);updateSet(m,t);assert.equal(playDeck(m,1,t),false,'and not without');}
 for(const [ms,g] of [[0,'PERFECT'],[250,'PERFECT'],[251,'GOOD'],[1000,'GOOD'],[1001,'OK'],[2000,'OK'],[-2000,'OK'],[-2001,'EARLY'],[2001,'LATE']])assert.equal(gradeOf(ms),g,`${ms}`);
 assert.equal(gradeOf(250,0,122),'GOOD','the bands are beats: a beat is shorter at 122 BPM');assert.equal(gradeOf(375,PHONES_ALLOWANCE),'PERFECT','headphones');assert.equal(gradeOf(376,PHONES_ALLOWANCE),'GOOD');
 assert.deepEqual(ENTRY_BANDS,{PERFECT:.5,GOOD:2,OK:4});assert(Object.isFrozen(ENTRY_BANDS));
 const m=createSet(S1);playDeck(m,0,0);playDeck(m,1,sec(m.decks[0],32));assert.equal(playDeck(m,1,20),false);
});
await check('mix: crossing 0.9 toward the incoming deck records progress; B→A is measured mirrored',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 m.mix=.5;updateSet(m,t0+2);assert.equal(m.fader.reached,null);
 m.mix=.92;const v=updateSet(m,t0+sec(a,16));near(m.fader.reached,.5);assert.equal(v.mode,'mix');near(v.progress,.5);
 const m2=createSet(S1);playDeck(m2,1,0);const b=m2.decks[1];updateSet(m2,sec(b,32));playDeck(m2,0,sec(b,32));m2.mix=1;updateSet(m2,sec(b,33));near(toward(m2),0);m2.mix=.05;updateSet(m2,sec(b,34));near(toward(m2),.95);near(m2.fader.reached,2/32);
});
await check('guide line: eases 0→1 over the 8 bars; one check per beat, combo, misses reset it',()=>{
 near(guideAt(0),0);near(guideAt(.5),.5);near(guideAt(1),1);near(guideAt(-1),0);near(guideAt(2),1);for(let i=1;i<=32;i++)assert(guideAt(i/32)>guideAt((i-1)/32));
 assert.equal(FOLLOW_BAND,.14);
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 m.mix=guideAt(1/32);let v=updateSet(m,t0+sec(a,1.5));assert.deepEqual(v.follow,{beat:1,hit:true,combo:1});near(v.guide,guideAt(1.5/32));
 v=updateSet(m,t0+sec(a,1.8));assert.equal(v.follow,null,'no new beat: no check');
 m.mix=guideAt(2/32)+FOLLOW_BAND-.001;v=updateSet(m,t0+sec(a,2.5));assert(v.follow.hit);assert.equal(m.fader.combo,2);
 m.mix=.9;v=updateSet(m,t0+sec(a,3.5));assert.deepEqual(v.follow,{beat:3,hit:false,combo:0});assert.equal(m.fader.best,2);
 m.mix=guideAt(6/32);v=updateSet(m,t0+sec(a,6.2));assert.equal(v.follow.beat,6,'skipped beats are all checked');assert.deepEqual([m.fader.checks,m.fader.hits,m.fader.combo],[6,5,3]);
 const m2=createSet(S1);playDeck(m2,1,0);const b=m2.decks[1];updateSet(m2,sec(b,32));playDeck(m2,0,sec(b,32));m2.mix=1-guideAt(1/32);
 assert(updateSet(m2,sec(b,33.5)).follow.hit,'B→A follows the mirrored line');
 const f=createSet(S1);playDeck(f,0,0);updateSet(f,t0);playDeck(f,1,t0);const floor=f.floor;f.mix=guideAt(1/32);updateSet(f,t0+sec(a,1.01));assert(f.floor>floor,'a hit lifts the floor');
});
await check('予約の取り消し（DJR01）: ▶ held for the line can be taken back by pressing it again before the line; the cue is open again and the heat step is undone',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32),early=t0-sec(a,1.5);updateSet(m,early);const floor=m.floor;
 assert(playDeck(m,1,early));assert(m.cue.pressed.reserved);assert.equal(m.phase,'mix');assert(m.decks[1].playing);assert(updateSet(m,early+.01).reserved);
 assert.equal(cancelReserve(m,0,early+.02),false,'the playing deck has nothing to take back');
 assert(cancelReserve(m,1,early+.02));assert.equal(m.phase,'cue');assert.equal(m.cue.pressed,null);assert(!m.decks[1].playing);assert.equal(m.fader,null);assert.equal(m.lastPlay,null);near(m.floor,floor,1e-3);
 const v=updateSet(m,early+.05);assert(!v.reserved);assert.equal(v.mode,'cue');
 assert(playDeck(m,1,t0),'pressed again on the line: it comes in');assert.equal(m.lastPlay.grade,'PERFECT');assert.equal(m.lastPlay.reserved,false);
 assert.equal(cancelReserve(m,1,t0+sec(a,.5)),false,'once the line has come the track is in: nothing to take back');
 const late=createSet(S1);playDeck(late,0,0);updateSet(late,t0+sec(a,1));assert(playDeck(late,1,t0+sec(a,1)));assert.equal(cancelReserve(late,1,t0+sec(a,1.1)),false,'a late ▶ was never held');
});
await check('フェーダーに触るまで「ぴったり」は出ない（DJR02）: a fader left alone on the line is not a hit (no combo, nothing shown); once the line leaves it, it misses as before',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 let shown=[];for(let b=1;b<=12;b++){const v=updateSet(m,t0+sec(a,b+.01));if(v.follow)shown.push(v.follow);}
 assert(!m.fader.touched);assert.equal(m.fader.hits,0,'never a hit while untouched');assert.equal(m.fader.best,0);assert(shown.length>0&&shown.every(f=>!f.hit),'the beats it falls off the line are shown as misses');
 assert(shown[0].beat>=5,`the first beats on the line show nothing (first shown: beat ${shown[0].beat})`);assert.equal(m.fader.checks,12,'every beat still counts');
 m.mix=guideAt(13/32);let v=updateSet(m,t0+sec(a,13.01));assert(m.fader.touched,'moved: touched');assert.deepEqual(v.follow,{beat:13,hit:true,combo:1});
});
await check('transition end: score recorded, outgoing deck stops and empties, then 選曲 offers two fresh tracks',()=>{
 const m=createSet(S1,()=>0);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0+.01);
 for(let i=1;i<=32;i++){m.mix=guideAt(i/32);updateSet(m,t0+sec(a,i)-.001);}
 const now=t0+sec(a,32),v=updateSet(m,now);assert(v.transition);assert.equal(v.stopped,0);
 assert.equal(m.transitions.length,1);const t=m.transitions[0];assert.equal(t.from,'danceMonster');assert.equal(t.to,'digitalLemonade');assert.equal(t.grade,'PERFECT');assert.deepEqual(t.parts,[100,100,100]);assert.equal(t.rank,'S');assert.deepEqual([t.combo,t.follow,t.pick],[32,1,null]);assert.deepEqual([t.sync,t.drifts,t.fixes],[1,0,0],'SET 1: nothing slips');
 assert(!m.decks[0].playing);assert.equal(m.decks[0].track,null);assert.equal(m.master,1);assert.equal(m.cue,null);assert.equal(m.phase,'select');assert.equal(playDeck(m,0,now),false,'an empty deck has nothing to play');
 assert.deepEqual(v.select,{deck:0,options:['cutAndDry','risingTide'],request:'up'},'two unplayed tracks; a calm track makes the floor ask for more');
 assert(m.decks[1].playing);near(beatAt(m.decks[1],now),32);assert.equal(updateSet(m,now+3).mode,'select','the set waits for the pick');
 const floor=m.floor,picked=chooseTrack(m,1,now+3);assert.deepEqual(picked,{id:0,key:'risingTide',rating:'◎'});near(m.floor,Math.min(1,floor+PICK_FLOOR['◎']));
 assert.equal(m.decks[0].track,'risingTide');assert.equal(m.decks[0].bpm,120,'SET 1 sets the pick to the master tempo');assert.deepEqual(m.played,['danceMonster','digitalLemonade','risingTide']);assert.deepEqual(m.pendingPick,{key:'risingTide',rating:'◎',request:'up'});
 assert.deepEqual([m.phase,m.cue.from,m.cue.to],['cue',1,0]);assert.equal(m.cue.start,64,'B is past beat 32: the next head with ≥4 bars lead is 64');assert.equal(chooseTrack(m,0,now+3),null,'only one pick');
});
await check('grace: without a crossing the outgoing deck keeps playing up to 8 more bars, then the fader item is marked late',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 let v;for(let i=1;i<=32;i++){m.mix=Math.min(.88,guideAt(i/32));v=updateSet(m,t0+sec(a,i)+.001);}assert.equal(v.mode,'mix');assert(m.decks[0].playing);near(v.progress,1,1e-3);assert.equal(m.fader.hits,32);
 m.mix=.95;v=updateSet(m,t0+sec(a,40));assert(v.transition);near(v.transition.reached,40/32);assert.equal(v.transition.parts[2],60,'a late crossing caps the fader at 60 even when every beat was on the line');
 // the fader never moved (#2456 §4-2 無音にしない): past the grace the outgoing deck does not stop into silence. It keeps playing (stuck) until the
 // incoming one can be heard (the fader half way), then hands over, scored as never reached.
 const m2=createSet(S1);playDeck(m2,0,0);updateSet(m2,t0);playDeck(m2,1,t0);v=updateSet(m2,t0+sec(a,PHRASE+GRACE));assert.equal(v.transition,null);assert(v.stuck);assert.equal(m2.phase,'mix');assert(m2.decks[0].playing&&m2.decks[1].playing);
 v=updateSet(m2,t0+sec(a,PHRASE+GRACE+20));assert(v.stuck&&!v.transition,'it waits as long as it takes; the outgoing track loops');assert(quality(m2,t0+sec(a,PHRASE+GRACE+20))>.5,'the room still hears the outgoing track');
 m2.mix=.45;v=updateSet(m2,t0+sec(a,PHRASE+GRACE+21));assert(v.stuck&&!v.transition,'not yet: the incoming track is quieter than the outgoing one');
 m2.mix=.55;v=updateSet(m2,t0+sec(a,PHRASE+GRACE+22));assert(!v.stuck);assert(v.transition);assert.equal(v.transition.reached,null);assert.equal(v.transition.parts[2],30);assert.equal(m2.master,1);assert(m2.decks[1].playing);
 // crossing after the grace is still "never reached" (30), not a late crossing (60)
 const m3=createSet(S1);playDeck(m3,0,0);updateSet(m3,t0);playDeck(m3,1,t0);updateSet(m3,t0+sec(a,PHRASE+GRACE+1));m3.mix=1;v=updateSet(m3,t0+sec(a,PHRASE+GRACE+2));assert(v.transition);assert.equal(v.transition.reached,null);assert.equal(v.transition.parts[2],30);
});
// One transition ridden along the guide line from the cued phrase head.
function ride(m){
 const from=m.decks[m.cue.from],to=m.cue.to;let now=from.at+sec(from,m.cue.start-from.beat);updateSet(m,now);playDeck(m,to,now);const t0=now;
 for(let i=1;i<32;i++){const g=guideAt((i+.5)/32);m.mix=to?g:1-g;now=t0+sec(from,i+.5);updateSet(m,now);}
 m.mix=to?1:0;now=t0+sec(from,32)+.001;return {v:updateSet(m,now),now};
}
await check('whole set: picks between transitions, the last transition ends the set with an averaged result and a FLOOR bonus',()=>{
 const m=createSet(S1);playDeck(m,0,0);
 let {v,now}=ride(m);assert(v.transition&&v.select&&!v.finished);assert.equal(m.phase,'select');assert.equal(m.decks[0].track,null);
 const {options:[pick],request}=v.select,picked=chooseTrack(m,0,now);assert.equal(m.decks[0].track,pick);assert.equal(picked.rating,pickRating(request,'digitalLemonade',pick));
 ({v,now}=ride(m));assert(v.finished);assert.equal(v.select,null);assert.equal(m.phase,'done');assert.equal(m.cue,null);assert.equal(m.decks[1].track,null);assert(m.decks[0].playing);assert(!m.decks[1].playing);
 assert.equal(m.result.transitions.length,2);assert.deepEqual(m.result.transitions.map(t=>t.pick),[null,picked.rating]);
 assert.deepEqual(m.result.transitions.map(t=>t.combo),[32,32]);assert.equal(m.result.base,100);assert(m.result.floor>=80);assert.equal(m.result.bonus,5);assert.equal(m.result.total,100,'the bonus never goes past 100');assert.equal(m.result.rank,'S');assert.equal(m.result.set,'SET 1');
 assert.equal(updateSet(m,now+5).mode,'done');assert.equal(playDeck(m,1,now+5),false);assert.equal(scoreSet(createSet(S1)),null);
});
// ── 2026-11-13 DJG: the incoming track slips out of time, the player turns its platter to bring it back ──
// One transition of `m` from its cue, the fader on the guide line. fix(view, now, into) is called on every half beat while the tracks are out of time.
function rideSlips(m,fix=null){
 const from=m.decks[m.cue.from],to=m.cue.to,log={slipped:0,retuned:0,maxError:0,offBeats:0};let now=from.at+sec(from,m.cue.start-from.beat);updateSet(m,now);playDeck(m,to,now);const t0=now;
 for(let i=1;i<64;i++){const into=i/2,g=guideAt(Math.min(1,(into+.25)/32));m.mix=to?g:1-g;now=t0+sec(from,into+.01);const v=updateSet(m,now);
  if(v.slipped)log.slipped++;if(v.retuned!=null)log.retuned++;if(v.sync){log.maxError=Math.max(log.maxError,Math.abs(v.sync.error));if(v.sync.off){log.offBeats+=.5;fix?.(v,now,into);}}}
 m.mix=to?1:0;now=t0+sec(from,32)+.001;return {v:updateSet(m,now),now,log};
}
await check('ズレ (DJG): the plan of a transition. One slip per window on a whole beat, either way, inside the size range; SET 1 has none',()=>{
 const signs=new Set();
 for(let seed=1;seed<=120;seed++){let x=seed;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  for(const set of [S1,SLIP2,SLIP3]){const m=createSet(set,rng);playDeck(m,0,0);const t0=sec(m.decks[0],32);updateSet(m,t0);playDeck(m,1,t0);const plan=m.fader.drifts,w=set.drift?.windows||[];
   assert.equal(plan.length,w.length,set.name);plan.forEach((d,i)=>{assert(Number.isInteger(d.at)&&d.at>=w[i][0]&&d.at<=w[i][1],`${set.name} at ${d.at}`);const size=Math.abs(d.size);assert(size>=set.drift.size[0]&&size<=set.drift.size[1]);signs.add(Math.sign(d.size));assert(!d.started&&!d.ended);});}}
 assert.deepEqual([...signs].sort(),[-1,1],'the track runs ahead in some transitions and falls behind in others');
});
await check('ズレは基本起きない（DJR03・2026-11-25 オーナー「拍のズレを基本発生させない」）: SET 2・3 の窓は4回に1回くらいだけズレる。SET 1 は一度もズレない',()=>{
 const count={};
 for(let seed=1;seed<=800;seed++){let x=seed*0x9e3779b9>>>0;const rng=()=>{x=(x+0x6d2b79f5)>>>0;let t=Math.imul(x^x>>>15,x|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}; // mulberry32
  for(const set of SETS){const m=createSet(set,rng);playDeck(m,0,0);const t0=sec(m.decks[0],32);updateSet(m,t0);playDeck(m,1,t0);
   const c=count[set.name]||(count[set.name]={mixes:0,slips:0,none:0});c.mixes++;c.slips+=m.fader.drifts.length;if(!m.fader.drifts.length)c.none++;
   for(const d of m.fader.drifts){const size=Math.abs(d.size);assert(size>=set.drift.size[0]&&size<=set.drift.size[1]);}}}
 assert.equal(count['SET 1'].slips,0);
 for(const name of ['SET 2','SET 3']){const c=count[name],windows=SETS.find(s=>s.name===name).drift.windows.length,rate=c.slips/(c.mixes*windows);
  assert(rate>.18&&rate<.32,`${name}: a window slips about a quarter of the time (${rate})`);assert(c.none/c.mixes>.5,`${name}: most mixes go through in time (${c.none}/${c.mixes})`);}
});
await check('ズレ: builds over 3 beats (the host is told to change the rate twice), then stays until it is fixed; beats out of time are counted and the sound cools the room',()=>{
 const m=createSet(SLIP2,()=>0);playDeck(m,0,0);const a=m.decks[0],b=m.decks[1],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 assert.deepEqual(m.fader.drifts.map(d=>[d.at,d.size]),[[6,-.12]],'rng 0: at beat 6, falling 0.12 beat behind');
 const at=into=>t0+sec(a,into);let v;
 for(let i=1;i<=5;i++){m.mix=guideAt(i/32);v=updateSet(m,at(i+.01));assert.equal(v.retuned,null);assert(!v.sync.off);near(v.sync.error,0,1e-9);}
 v=updateSet(m,at(6.01));assert.equal(v.retuned,1,'the slip starts: the incoming deck runs slow');near(b.bpm,a.bpm*(1-.12/DRIFT_BEATS),1e-9);assert(!v.slipped);
 v=updateSet(m,at(7.4));assert(!v.sync.off,'still inside the band');assert(v.sync.error<0);
 v=updateSet(m,at(8.01));assert(v.sync.off);assert(v.slipped,'told once, when it leaves the band');assert.equal(v.sync.deck,1);assert.equal(updateSet(m,at(8.2)).slipped,false);
 v=updateSet(m,at(9.01));assert.equal(v.retuned,1,'the slip has built up: back to the master tempo');assert.equal(b.bpm,a.bpm);near(v.sync.error,-.12,2e-3);
 for(let i=10;i<=14;i++){m.mix=guideAt(i/32);const before=m.floor;v=updateSet(m,at(i+.01));assert.equal(v.retuned,null);near(v.sync.error,-.12,2e-3);assert(v.follow.hit,'the fader is still judged on its own');assert(m.floor<before,'a beat out of time cools the room even with the fader on the line');}
 assert(SLIP_FLOOR<0&&FOLLOW_FLOOR.hit+SLIP_FLOOR<0&&SYNC_FLOOR>-2*SLIP_FLOOR,'out of time costs more than the fader earns; a quick fix earns it back');
 assert.equal(m.fader.checks,14);assert.equal(m.fader.inTime,7,'beats 1〜7 were in time, 8〜14 were not');assert.equal(m.fader.hits,14);assert(m.fader.off);
 m.mix=.5;assert(quality(m,at(14.5))<.75,'two tracks rubbing sound worse');const clean=createSet(S1);playDeck(clean,0,0);updateSet(clean,t0);playDeck(clean,1,t0);clean.mix=.5;near(quality(clean,at(14.5)),1);
});
await check('皿 (DJG): turning the right way brings the track back; QUANTIZE catches a turn that lands close or passes through; the wrong way takes it further; in time nothing moves',()=>{
 const slipped=()=>{const m=createSet(SLIP2,()=>0);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);for(let i=1;i<=10;i++){m.mix=guideAt(i/32);updateSet(m,t0+sec(a,i+.01));}return {m,now:t0+sec(a,10.3),a,b:m.decks[1]};};
 let {m,now,a,b}=slipped();near(phaseError(a,b,now),-.12,2e-3);
 assert.equal(nudgeDeck(m,0,.05,now),null,'the playing deck has nothing to fix');assert.equal(nudgeDeck(m,1,0,now),null);assert.equal(nudgeDeck(m,1,NaN,now),null);near(phaseError(a,b,now),-.12,2e-3);
 let r=nudgeDeck(m,1,-.05,now);assert.equal(r.fixed,false);near(r.error,-.17,2e-3);                                   // the wrong way
 r=nudgeDeck(m,1,.05,now);near(r.error,-.12,2e-3);r=nudgeDeck(m,1,.05,now);near(r.error,-.07,2e-3);assert.equal(m.fader.fixes,0);
 const floor=m.floor;r=nudgeDeck(m,1,.05,now);assert.deepEqual(r,{error:0,fixed:true},'-0.02: inside the snap band');near(phaseError(a,b,now),0,1e-9);assert.equal(m.fader.fixes,1);assert.equal(m.fader.off,false);near(m.floor,floor+SYNC_FLOOR);
 assert.equal(nudgeDeck(m,1,.2,now),null,'in time: the platter moves nothing (no way to knock it out yourself)');near(phaseError(a,b,now),0,1e-9);
 const v=updateSet(m,now+.01);assert(!v.sync.off);assert(!v.slipped);
 ({m,now,a,b}=slipped());assert.deepEqual(nudgeDeck(m,1,.3,now),{error:0,fixed:true},'a big turn that carries it through the beat is caught');near(phaseError(a,b,now),0,1e-9);
 ({m,now,a,b}=slipped());r=nudgeDeck(m,1,-.3,now);assert.equal(r.fixed,false);near(r.error,-.42,2e-3);r=nudgeDeck(m,1,-.2,now);assert.equal(r.fixed,false,'going round the back of the beat is not a catch');near(r.error,.38,2e-3);
 assert(SNAP_BAND<SYNC_BAND,'a catch is always counted as in time');
 const idle=createSet(S2);assert.equal(nudgeDeck(idle,1,.1,0),null);playDeck(idle,0,0);assert.equal(nudgeDeck(idle,1,.1,1),null,'only during a mix');
});
await check('ズレ → 採点: fixed within a beat or two the ビート item stays 100, left alone it falls to 30; every slip can be fixed (SET 2・3, 60 seeds)',()=>{
 const quick=(v,now)=>{};
 for(let seed=1;seed<=60;seed++){
  for(const set of [SLIP2,SLIP3]){
   let x=seed;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
   const m=createSet(set,rng,quickEntry());playDeck(m,0,0);const {v,log}=rideSlips(m,(view,now)=>{const r=nudgeDeck(m,view.sync.deck,-view.sync.error,now);assert(r&&r.fixed,'turning back by the error lands on the beat');});
   const t=v.transition;assert(t,`${set.name} seed ${seed}`);assert.equal(t.drifts,set.drift.windows.length);assert.equal(t.fixes,t.drifts);assert.equal(log.slipped,t.drifts);assert(log.retuned>=t.drifts&&log.retuned<=t.drifts*2,'a slip caught while it builds stops there');
   assert(log.offBeats<=t.drifts,'caught on the first half beat it was out');assert.equal(t.parts[0],100,`ビート ${t.sync}`);assert.equal(t.parts[2],100);assert.equal(t.rank,'S');assert.equal(m.decks[m.master].bpm,m.decks[1-m.master]?.bpm??m.decks[m.master].bpm);
  }
 }
 const left=createSet(SLIP2,()=>0,quickEntry());playDeck(left,0,0);const alone=rideSlips(left).v.transition;assert.deepEqual([alone.drifts,alone.fixes],[1,0]);assert.equal(alone.parts[0],30,`left alone from beat 8 on: ${alone.sync}`);assert.equal(alone.parts[2],100);assert.notEqual(alone.rank,'S');
 const slow=createSet(SLIP2,()=>0,quickEntry());playDeck(slow,0,0);let waited=0;const late=rideSlips(slow,(view,now)=>{if(++waited>=10)nudgeDeck(slow,view.sync.deck,-view.sync.error,now);}).v.transition;assert.equal(late.parts[0],85,`five beats out of time: ${late.sync}`);
 const fixed=createSet(SLIP2,()=>0,quickEntry());playDeck(fixed,0,0);rideSlips(fixed,(view,now)=>nudgeDeck(fixed,view.sync.deck,-view.sync.error,now));assert(fixed.floor>left.floor+.1,`fixing keeps the room warm: ${fixed.floor} vs ${left.floor}`);
 const s1=createSet(S1,()=>0,quickEntry());playDeck(s1,0,0);const r1=rideSlips(s1);assert.deepEqual([r1.log.slipped,r1.log.retuned,r1.v.transition.parts[0]],[0,0,100]);
});
await check('scores: thresholds, ビート = share of beats in time, fader = share of beats on the guide line (late 60, never 30), ranks, FLOOR bonus',()=>{
 for(const [v,p] of [[1,100],[.9,100],[.89,85],[.75,85],[.74,60],[.5,60],[.49,30],[0,30]])assert.equal(scoreTransition({sync:v,playMs:0,reached:.5,follow:1}).parts[0],p);
 assert.equal(scoreTransition({playMs:0,reached:.5,follow:1}).parts[0],100,'nothing slipped');
 // 入り (#2456 §4): by the entry's grade; without one, the error in ms is graded in beats at the tempo (120 BPM: 250 / 1000 / 2000 ms)
 for(const [v,p] of [[250,100],[251,85],[1000,85],[1001,60],[2000,60],[2001,30]])assert.equal(scoreTransition({playMs:v,reached:.5,follow:1}).parts[1],p,`${v}`);
 for(const [g,p] of [['PERFECT',100],['GOOD',85],['OK',60],['EARLY',30],['LATE',30]])assert.equal(scoreTransition({playMs:9999,grade:g,reached:.5,follow:1}).parts[1],p,g);
 assert.equal(scoreTransition({playMs:250,bpm:122,reached:.5,follow:1}).parts[1],85);assert.equal(scoreTransition({playMs:370,allowance:PHONES_ALLOWANCE,reached:.5,follow:1}).parts[1],100);
 for(const [r,p] of [[.9,100],[.89,85],[.75,85],[.74,60],[.5,60],[.49,30],[0,30]])assert.equal(scoreFromRatio(r),p);
 for(const [reached,follow,p] of [[null,1,30],[1.5,1,60],[1.5,.6,60],[1.5,.4,30],[.5,1,100],[1,.8,85],[0,.6,60]])assert.equal(scoreTransition({playMs:0,reached,follow}).parts[2],p,`${reached} ${follow}`);
 const s=scoreTransition({sync:.8,playMs:1500,reached:.2,follow:.8});assert.deepEqual(s.parts,[85,60,85]);assert.equal(s.total,Math.round((85+60+85)/3));assert.equal(s.rank,'A');
 const set=(totals,floor)=>scoreSet({transitions:totals.map(total=>({total})),floor,set:{name:'X'}});
 assert.deepEqual([set([80],.8).total,set([80],.8).bonus],[85,5]);assert.deepEqual([set([80],.29).total,set([80],.29).bonus],[75,-5]);assert.equal(set([80,70],.5).total,75);assert.equal(set([100],1).total,100);assert.equal(set([80],.799).bonus,0);
 for(const [s,a,b] of [[30,60,120],[25,50,100]]){assert.equal(scoreFromErr(s,s,a,b),100);assert.equal(scoreFromErr(s+.001,s,a,b),85);assert.equal(scoreFromErr(b+.001,s,a,b),30);}
 for(const [v,r] of [[90,'S'],[89,'A'],[75,'A'],[74,'B'],[55,'B'],[54,'C']])assert.equal(rankFromScore(v),r);
});
await check('選曲: Camelot key match, the floor request vs energy, ◎○△ rating and its floor effect',()=>{
 for(const [a,b,ok] of [['danceMonster','risingTide',true],['danceMonster','digitalLemonade',true],['danceMonster','cutAndDry',true],['digitalLemonade','ravingEnergy',true],['ravingEnergy','danceMonster',false],['cutAndDry','digitalLemonade',false]]){assert.equal(keyMatch(a,b),ok,a+b);assert.equal(keyMatch(b,a),ok);}
 assert.equal(keyMatch('danceMonster','nope'),false);
 for(const [r,a,b,ok] of [['up','digitalLemonade','ravingEnergy',true],['up','ravingEnergy','cutAndDry',false],['down','ravingEnergy','cutAndDry',true],['down','digitalLemonade','danceMonster',false],['keep','danceMonster','risingTide',true],['keep','digitalLemonade','ravingEnergy',false]])assert.equal(energyMatch(r,a,b),ok,r+a+b);
 assert.equal(pickRating('up','digitalLemonade','risingTide'),'◎');assert.equal(pickRating('down','digitalLemonade','risingTide'),'○');assert.equal(pickRating('up','ravingEnergy','danceMonster'),'△');
 assert.deepEqual(Object.keys(REQUESTS),['up','keep','down']);assert(PICK_FLOOR['◎']>PICK_FLOOR['○']&&PICK_FLOOR['○']>0&&PICK_FLOOR['△']<0);
 // SET 2 (4 tracks): every offer leaves out the master and prefers tracks not played yet; picks arrive at the playing tempo.
 const m=createSet(S2);playDeck(m,0,0);
 for(let n=0;n<2;n++){const {v,now}=ride(m);const s=v.select;assert(s);assert.equal(s.options.length,2);assert(!s.options.includes(m.decks[m.master].track));for(const k of s.options)assert(!m.played.includes(k),k);assert(REQUESTS[s.request]);
  if(m.decks[m.master].track==='ravingEnergy')assert.notEqual(s.request,'up','the hottest track never asks for more');
  const p=chooseTrack(m,1,now);assert.equal(m.decks[p.id].bpm,m.decks[m.master].bpm);assert.equal(m.decks[p.id].nativeBpm,TRACKS[p.key].bpm);}
 assert.equal(m.played.length,4);assert(ride(m).v.finished);
 assert.equal(chooseTrack(createSet(S1),0,0),null,'no pick outside the 選曲 phase');
});
await check('floor: silence and clashing beats bring it down, a clean blend lifts it slowly; entries give a visible step',()=>{
 const m=createSet(S1);playDeck(m,0,0);m.mix=0;near(quality(m,1),.6);m.mix=1;near(quality(m,1),0,1e-9);m.mix=.5;near(quality(m,1),.6,1e-9);m.mix=.75;near(quality(m,1),gains(.75)[0]**2*.6,1e-9);
 const t0=sec(m.decks[0],32);updateSet(m,t0);playDeck(m,1,t0);m.mix=.5;near(quality(m,t0+1),1);
 m.decks[1].beat+=.25;assert(quality(m,t0+1)<.5);m.mix=0;near(quality(m,t0+1),1,1e-9);
 // DJS20: a good sound warms the room slowly (FLOOR_WARM), a bad sound cools it at full speed.
 const f=createSet(S1);floorStep(f,1,10);near(f.floor,.5+.45*10*.06*FLOOR_WARM);const cool=createSet(S1);floorStep(cool,0,5);near(cool.floor,.5-.55*5*.06);floorStep(f,0,100);near(f.floor,0);
 const g=createSet(S1);playDeck(g,0,0);updateSet(g,sec(g.decks[0],32));playDeck(g,1,sec(g.decks[0],32));near(g.floor,.5+GRADE_FLOOR.PERFECT);
 const h=createSet(S1);playDeck(h,0,0);updateSet(h,sec(h.decks[0],33));playDeck(h,1,sec(h.decks[0],33));near(h.floor,.5+GRADE_FLOOR.GOOD,1e-9);
 const o=createSet(S1);playDeck(o,0,0);updateSet(o,sec(o.decks[0],34.5));playDeck(o,1,sec(o.decks[0],34.5));assert.equal(o.lastPlay.grade,'OK');near(o.floor,.5+GRADE_FLOOR.OK,1e-9);
 assert(GRADE_FLOOR.PERFECT>GRADE_FLOOR.GOOD&&GRADE_FLOOR.GOOD>0&&GRADE_FLOOR.OK===0&&GRADE_FLOOR.EARLY<0&&GRADE_FLOOR.LATE<0);assert(RANK_FLOOR.S>RANK_FLOOR.A&&RANK_FLOOR.B===0&&RANK_FLOOR.C<0);assert(FOLLOW_FLOOR.hit>0&&FOLLOW_FLOOR.miss<0);
});
await check('floor (DJS20): one perfect transition warms the room by a step, it takes a whole clean set to reach 最高潮; a sloppy one cools it',()=>{
 // perfect: PERFECT entry, 32 beats on the line, clean blend, rank S
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 for(let b=1;b<=32;b++){m.mix=guideAt(b/32);updateSet(m,t0+sec(a,b+.01));}
 assert.equal(m.transitions[0].rank,'S');assert(m.floor>.72&&m.floor<.85,`one perfect transition: ${m.floor}`);assert(moodOf(m.floor)>=3);
 // sloppy: an OK entry (2½ beats late; #2456 §4 takes it), the fader left behind for the whole 8 bars and pushed over at the end
 const s=createSet(S1);playDeck(s,0,0);const ts=t0+sec(a,2.5);updateSet(s,ts);playDeck(s,1,ts);assert.equal(s.lastPlay.grade,'OK');
 for(let b=3;b<=32;b++)updateSet(s,t0+sec(a,b+.01));s.mix=1;updateSet(s,t0+sec(a,33));
 assert.equal(s.transitions.length,1);assert(s.floor<.45,`a sloppy transition cools the room: ${s.floor}`);assert(moodOf(s.floor)<=2);assert(m.floor-s.floor>.3,`far below the clean one: ${m.floor} vs ${s.floor}`);
 assert.deepEqual([0,.19,.2,.39,.4,.59,.6,.79,.8,1].map(moodOf),[0,0,1,1,2,2,3,3,4,4]);assert.equal(MOODS.length,5);assert.equal(MOODS[moodOf(.5)],'様子見','the set opens with the room watching');
});
await check('▶ is judged against the nearest phrase head (DJS20): a little before the next head is PERFECT/OK, not a huge LATE',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0];updateSet(m,sec(a,40));assert.equal(m.cue.start,32,'the first head has passed, the window is still open');
 const t=sec(a,64)-.02;updateSet(m,t);playDeck(m,1,t);assert.equal(m.cue.start,64,'aimed at the next head');assert.equal(m.cue.missed,1);assert.equal(m.lastPlay.grade,'PERFECT');near(m.lastPlay.errorMs,-20,1e-6);assert.equal(m.cue.pressed.beat,64);
 const e=createSet(S1);playDeck(e,0,0);const te=sec(a,64)-1.6;updateSet(e,te);playDeck(e,1,te);assert.equal(e.lastPlay.grade,'OK');assert(e.lastPlay.errorMs<0);assert(e.lastPlay.reserved);
 const l=createSet(S1);playDeck(l,0,0);const tl=sec(a,32+3);updateSet(l,tl);playDeck(l,1,tl);assert.equal(l.cue.start,32,'before the middle it is still the head that just passed');assert.equal(l.lastPlay.grade,'OK');assert(!l.lastPlay.reserved);
 const x=createSet(S1);playDeck(x,0,0);const tx=sec(a,32+15);updateSet(x,tx);assert.equal(playDeck(x,1,tx),false,'15 beats after a head and 17 before the next: not taken (#2456 §4)');
 // the guide line starts from the head that was judged
 updateSet(m,sec(a,64+16));near(updateSet(m,sec(a,64+16)).progress,.5,1e-6);
});
// ── 2026-11-13 DJF: shorter waits (4-bar entry lines), feel numbers, sound effects ──
await check('entry lines every 4 bars (DJF03): the game waits 2〜6 bars in every set (no tempo to match, DJG); the default grid is unchanged',()=>{
 assert.equal(QUICK_GRID,16);for(const set of SETS)assert.deepEqual(quickEntry(set),{grid:16,lead:8});
 const d=createSet(S1);assert.deepEqual([d.grid,d.lead],[PHRASE,LEAD],'createSet without options keeps the 8-bar phrase heads');
 const m=createSet(S1,()=>0,quickEntry(S1));playDeck(m,0,0);const a=m.decks[0];assert.deepEqual([m.cue.start,m.cue.end],[16,48],'SET 1: the first entry is 4 bars in (8 s at 120 BPM), the mix is still 8 bars');
 const m2=createSet(S2,()=>0,quickEntry(S2));playDeck(m2,0,0);assert.equal(m2.cue.start,16,'SET 2・3 too');
 // every wait is between lead and lead+grid beats, wherever the track is when the cue opens
 for(let b=0;b<200;b+=.37)for(const set of SETS){const q=quickEntry(set),x=createSet(set,()=>0,q);x.decks[0].beat=b;playDeck(x,0,0);const wait=x.cue.start-b;assert(wait>q.lead-1e-9&&wait<=q.lead+q.grid+1e-9,`${set.name} from ${b}: ${wait}`);assert.equal(x.cue.start%16,0);}
 // a line that goes by rolls to the next one 4 bars on (view.rolled tells the screen once); ▶ past the middle aims at the next line
 let v=updateSet(m,sec(a,15));assert(!v.rolled&&!v.open);v=updateSet(m,sec(a,20));assert(v.open&&!v.rolled,'just past the line: still playable (late)');
 v=updateSet(m,sec(a,32.1));assert(v.rolled);assert.deepEqual([m.cue.start,m.cue.end,m.cue.missed],[32,64,1]);assert.equal(updateSet(m,sec(a,33)).rolled,false);
 const l=createSet(S1,()=>0,quickEntry(S1));playDeck(l,0,0);let t=sec(a,16+7);updateSet(l,t);assert.equal(playDeck(l,1,t),false,'7 beats late: not taken (#2456 §4)');assert.equal(l.cue.start,16);assert.equal(l.lastPlay,null);
 t=sec(a,16+3.5);updateSet(l,t);assert(playDeck(l,1,t));assert.equal(l.cue.start,16);assert.equal(l.lastPlay.grade,'OK');
 const n=createSet(S1,()=>0,quickEntry(S1));playDeck(n,0,0);t=sec(a,32)-.02;updateSet(n,sec(a,25));playDeck(n,1,t);assert.equal(n.cue.start,32,'past the middle: judged against the next line');assert.equal(n.lastPlay.grade,'PERFECT');near(n.lastPlay.errorMs,-20,1e-6);
 // the whole set scores exactly as on the 8-bar grid, and takes fewer beats
 const beats=(opts)=>{const x=createSet(S1,()=>0,opts);playDeck(x,0,0);let r=ride(x);chooseTrack(x,0,r.now+3);r=ride(x);assert(r.v.finished);return {result:x.result,sec:r.now};};
 const quick=beats(quickEntry(S1)),slow=beats({});assert.deepEqual(quick.result,slow.result,'scoring does not depend on the grid');assert.equal(quick.result.rank,'S');
 near(slow.sec,64.001,1e-6);near(quick.sec,48.001,1e-6);// picking 3 s after the first transition: 64 s → 48 sassert(quick.sec<50,`SET 1 in under 50 s: ${quick.sec}`);
});
await check('rank lines (DJF07) are the thresholds rankFromScore uses',()=>{
 assert.deepEqual({...RANK_LINES},{S:90,A:75,B:55});for(const [rank,line] of Object.entries(RANK_LINES)){assert.equal(rankFromScore(line),rank);assert.notEqual(rankFromScore(line-1),rank);}
});
await check('feel numbers (DJF11): one table, overridable by name; unknown names and non-numbers are ignored; bigger moments are held longer and sound louder',()=>{
 assert(!Object.isFrozen(FEEL));const before=JSON.stringify(FEEL);
 assert.deepEqual(applyFeelOverrides('hold.PERFECT:140, afterglow.ms:0,nope.x:1,hold.nope:3,holdDim:abc,sfx.cheer.S:.1,shake.S:1,hold.GOOD:'),['hold.PERFECT','afterglow.ms','sfx.cheer.S']);
 assert.deepEqual([FEEL.hold.PERFECT,FEEL.afterglow.ms,FEEL.sfx.cheer.S,FEEL.shake.S,FEEL.hold.GOOD],[140,0,.1,'big',60]);assert.deepEqual(applyFeelOverrides(null),[]);
 Object.assign(FEEL,JSON.parse(before));assert.equal(JSON.stringify(FEEL),before);
 assert(FEEL.hold.PERFECT>FEEL.hold.GOOD&&FEEL.hold.GOOD>FEEL.hold.OK&&FEEL.hold.EARLY===0&&FEEL.hold.LATE===0,'only a good entry is held');assert(FEEL.hold.S>FEEL.hold.A&&FEEL.hold.finish>=FEEL.hold.S);
 assert(Math.max(...Object.values(FEEL.hold))<=150,'a hold is a blink: the music never stops');
 const c=FEEL.sfx.cheer;assert(c.PERFECT>c.GOOD&&c.S>c.A&&c.finishS>c.finishA&&c.finishA>c.finishB&&c.combo32>c.combo24&&c.combo24>c.combo16);assert(FEEL.sfx.tick<FEEL.sfx.impactSmall&&FEEL.sfx.impactSmall<FEEL.sfx.impact,'guidance is quieter than a result');
 assert(new Set(Object.values(FEEL.shake)).size>=4,'four shake types');assert.notEqual(FEEL.shake.PERFECT,FEEL.shake.LATE);assert.notEqual(FEEL.shake.S,FEEL.shake.A);
});
await check('選曲 (DJS22): the guests never ask for something neither candidate can answer',()=>{
 for(let seed=1;seed<=200;seed++){
  let x=seed;const rng=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
  for(const set of SETS){
   const m=createSet(set,rng);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);m.mix=1;const v=updateSet(m,t0+sec(a,32.01));
   assert(v.select,'select after the first transition');const now=m.decks[m.master].track;
   assert(v.select.options.some(key=>energyMatch(v.select.request,now,key)),`${set.name} seed ${seed}: ${JSON.stringify(v.select)}`);
  }
 }
});
await check('fader arrows (DJS20): on the line no arrow, behind it points on toward the incoming deck, ahead it points back; mirrored when A is incoming',()=>{
 const m=createSet(S1);playDeck(m,0,0);const t0=sec(m.decks[0],32);updateSet(m,t0);playDeck(m,1,t0);
 m.mix=.5;assert.equal(followHint(m,.5),0);m.mix=.5-FOLLOW_SWEET+.001;assert.equal(followHint(m,.5),0);m.mix=.5-FOLLOW_SWEET-.01;assert.equal(followHint(m,.5),1);m.mix=.5+FOLLOW_SWEET+.01;assert.equal(followHint(m,.5),-1);
 assert(FOLLOW_SWEET<FOLLOW_BAND,'the arrow shows before the beat check would miss');
 m.cue.to=0;m.cue.from=1;m.mix=.8;assert.equal(followHint(m,.5),1,'toward A: the fader at 0.8 has only come 0.2 of the way');m.mix=.2;assert.equal(followHint(m,.5),-1);
});
await check('global pause/resume keeps beats, cue and fader state; dt does not jump across a pause',()=>{
 const m=createSet(S1);playDeck(m,0,0);updateSet(m,4);pauseMix(m,4);near(beatAt(m.decks[0],500),8);assert.deepEqual(m.resumeDecks,[0]);assert.equal(updateSet(m,100).mode,'idle');
 resumeMix(m,500);assert.deepEqual(m.decks.map(d=>d.playing),[true,false]);assert.equal(m.cue.start,32);const floor=m.floor;updateSet(m,500.5);assert(Math.abs(m.floor-floor)<.05);near(beatAt(m.decks[0],501),10);
});
await check('equal-power fader and automatic low cut',()=>{
 for(let i=0;i<=100;i++){const[a,b]=gains(i/100);near(a*a+b*b,1);}near(gains(0)[0],1);near(gains(1)[1],1);
 assert.deepEqual(lowCutDb(0),[0,LOW_CUT_DB]);assert.deepEqual(lowCutDb(.5),[0,0]);assert.deepEqual(lowCutDb(1),[LOW_CUT_DB,0]);const [a,b]=lowCutDb(.375);assert.equal(a,0);near(b,LOW_CUT_DB/2);
});
await check('procedural test audio and dancer pose stay deterministic',()=>{
 for(const id of [0,1]){const a=renderTrack(id,8000),b=renderTrack(id,8000);near(a.duration*a.nativeBpm/60,32);for(let i=0;i<a.samples.length;i+=97)assert.equal(a.samples[i],b.samples[i]);near(peakAt(a,.04),peakAt(a,a.duration+.04));}
 const a=dancerPose(0),b=dancerPose(4);for(const k of Object.keys(a))near(a[k],b[k]);assert.deepEqual(dancerPose(2,true),{hip:0,bob:0,left:0,right:0,arm:0});
});
// ── controlled WebAudio ──
class Param{constructor(value=0){this.value=value;this.calls=[];}setValueAtTime(v,t){this.value=v;this.calls.push([v,t]);}linearRampToValueAtTime(v,t){this.value=v;this.calls.push([v,t]);}setTargetAtTime(v,t){this.value=v;this.calls.push([v,t]);}cancelScheduledValues(){}}
class Node{constructor(){this.connections=[];this.gain=new Param();this.playbackRate=new Param(1);}connect(n){this.connections.push(n);}disconnect(){this.connections=[];}}
class Source extends Node{start(t,offset){assert(!this.started);this.started={t,offset};}stop(t){assert(!this.stopped);this.stopped={t};this.onended?.();}}
class Context{
 constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.destination={};this.sources=[];this.listeners=[];Context.last=this;}
 addEventListener(_,fn){this.listeners.push(fn);}change(s){this.state=s;for(const f of this.listeners)f();}
 createGain(){return new Node();}createAnalyser(){const n=new Node();n.getFloatTimeDomainData=a=>a.fill(0);return n;}
 createBuffer(_,length,sampleRate){return {duration:length/sampleRate,copyToChannel(a){assert.equal(a.length,length);}};}
 createBufferSource(){const n=new Source();this.sources.push(n);return n;}
 async resume(){if(this.fail)throw Error('audio refused');this.change('running');}
 async suspend(){if(this.failSuspend)throw Error('suspend failed');this.change('suspended');}
 async close(){this.change('closed');}
}
const loads=[];
const loadTrack=async(c,key)=>{loads.push(key);const cfg=TRACKS[key];return {...renderTrack(Object.keys(TRACKS).indexOf(key)%2,c.sampleRate),nativeBpm:cfg.bpm,firstBeat:cfg.firstBeat,beats:32,trimDb:cfg.trimDb};};
const live=c=>c.sources.filter(s=>!s.stopped);
await check('sound effects (DJF02): silent without oscillators (no throw); with them, every event builds nodes on its own bus that follows the game volume and mute',async()=>{
 const plain=new DJAudio(Context,{setIndex:0,loadTrack});const quiet=new DJSfx(plain);assert.equal(quiet.play('entry',{grade:'PERFECT'}),false,'no audio context yet');await plain.play(0);assert.equal(quiet.play('entry',{grade:'PERFECT'}),false,'a context without oscillators');assert.equal(quiet.count,0);await plain.dispose();
 const made=[];class P extends Param{exponentialRampToValueAtTime(v,t){this.value=v;this.calls.push([v,t]);}}
 class N{constructor(kind){this.kind=kind;this.gain=new P();this.frequency=new P();this.Q=new P();this.playbackRate=new P(1);this.to=[];made.push(this);}connect(n){this.to.push(n);}disconnect(){}start(t){this.started=t;}stop(t){this.stopped=t;}}
 class Rich extends Context{createGain(){return new N('gain');}createOscillator(){return new N('osc');}createBiquadFilter(){return new N('filter');}createBufferSource(){const n=new N('source');this.sources.push(n);return n;}
  createBuffer(_,length,sampleRate){return {duration:length/sampleRate,getChannelData:()=>new Float32Array(length),copyToChannel(){}};}async decodeAudioData(){return {duration:1};}}
 const fetched=[],realFetch=globalThis.fetch;globalThis.fetch=async url=>{fetched.push(String(url));return {ok:true,arrayBuffer:async()=>new ArrayBuffer(8)};};
 try{
  const a=new DJAudio(Rich,{setIndex:0,loadTrack});await a.play(0);const c=a.context,s=new DJSfx(a),own=made.length;c.currentTime=5;
  for(const [name,arg] of [['tick',{at:5.05,last:true}],['entry',{grade:'PERFECT'}],['entry',{grade:'GOOD'}],['entry',{grade:'OK'}],['entry',{grade:'LATE'}],['combo',{combo:8}],['combo',{combo:32}],['broken',{}],['nope',{}],['reserve',{}],['slip',{}],['fix',{}],['transition',{rank:'S'}],['transition',{rank:'C'}],['pick',{rating:'◎'}],['pick',{rating:'△'}],['finish',{rank:'A'}],['stamp',{}]]){
   const n=made.length;assert.equal(s.play(name,arg),true,name);assert(made.length>n,`${name} builds nodes`);assert.equal(s.last,name);}
  assert.equal(s.count,18);assert.equal(s.play('no-such-sound'),false);assert.equal(s.count,18);
  assert.deepEqual(fetched.map(u=>u.split('/assets/audio/se/')[1]).sort(),['crowd_applause_01.mp3','minigame/axe_cheer.wav'],'the two recorded crowds, fetched once');
  const fxNodes=made.slice(own),osc=fxNodes.filter(n=>n.kind==='osc');assert(osc.every(o=>o.started>=5&&o.stopped>o.started),'every tone is scheduled now or later and stops');assert(osc.some(o=>Math.abs(o.started-5.05)<1e-9),'the count-in click lands on its beat time');
  assert(fxNodes.length>20&&!fxNodes.some(n=>n.to.includes(a.output)||n.to.includes(a.analyser)),'effects never go through the music output (the meters stay the music)');assert(s.bus.to.includes(c.destination));
  near(s.bus.gain.value,.42*FEEL.sfx.master);a.volume=.36;s.play('stamp');near(s.bus.gain.value,.84*FEEL.sfx.master);a.muted=true;s.play('stamp');assert.equal(s.bus.gain.value,0,'the game mute silences the effects');
  await new Promise(r=>setTimeout(r,0));await a.dispose();
 }finally{globalThis.fetch=realFetch;}
});
await check('audio: first ▶ loads the two deck tracks and starts exactly one source at native rate',async()=>{
 loads.length=0;const a=new DJAudio(Context,{setIndex:0,loadTrack});assert.equal(a.context,null);assert(await a.play(0));
 assert.deepEqual(loads,['danceMonster','digitalLemonade']);assert.equal(a.context.sources.length,1);assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.voices[0].source.playbackRate.value,1);near(a.voices[0].source.started.offset,.006);near(a.voices[0].source.loopStart,.006);
 assert.equal(await a.play(0),false);assert.equal(a.context.sources.length,1);await a.dispose();
});
await check('audio: retrying the first ▶ reloads a failed standby track and reuses the ready deck',async()=>{
 let attempts=0;
 const a=new DJAudio(Context,{loadTrack:async(c,key)=>{
  if(key==='digitalLemonade' && ++attempts===1){
   await a.ensure(0);
   throw new Error('decode failed');
  }
  return loadTrack(c,key);
 }});
 await assert.rejects(a.play(0),TrackLoadError);
 const ready=a.tracks[0];
 assert(ready);assert.equal(a.tracks[1],null);
 assert(await a.play(0));assert.equal(attempts,2);assert.equal(a.tracks[0],ready);assert(a.tracks[1]);
 assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);await a.dispose();
});
await check('audio: an early ▶ schedules the source on the entry line (予約), at the master\'s tempo (a 120 BPM track is sped up to 122)',async()=>{
 const a=new DJAudio(Context,{setIndex:2,loadTrack});await a.play(0);const c=a.context,A=a.mix.decks[0];
 c.currentTime=sec(A,31.9);a.update();await a.play(1);const v=a.voices[1].source;near(v.started.t,sec(A,32));near(v.started.offset,.006);assert.equal(a.mix.lastPlay.grade,'PERFECT');assert(a.mix.lastPlay.reserved);
 near(v.playbackRate.value,122/120);near(a.voices[0].source.playbackRate.value,1);assert.equal(typeof a.pitch,'undefined');assert.equal(typeof a.sync,'undefined','no tempo controls');
 assert.equal(await a.play(1),false);assert.equal(live(c).length,2);await a.dispose();
});
await check('audio (#2456 §4): a ▶ held for the line still lands on it after a pause and resume; a ▶ a little late starts at once, phrase-aligned',async()=>{
 const a=new DJAudio(Context,{setIndex:0,loadTrack});await a.play(0);const c=a.context,A=a.mix.decks[0];
 c.currentTime=sec(A,30.5);a.update();assert(await a.play(1));assert.equal(a.mix.lastPlay.grade,'GOOD');assert(a.mix.lastPlay.reserved);near(a.voices[1].source.started.t,sec(A,32));near(a.voices[1].source.started.offset,0);
 c.currentTime=sec(A,31);await a.pause();assert.deepEqual(a.mix.resumeDecks,[0,1]);c.currentTime=100;assert(await a.start());
 const v=a.voices[1].source;near(v.started.t,100+sec(A,1),1e-9);near(v.started.offset,0);near(beatAt(a.mix.decks[0],100+sec(A,1)),32,1e-9);assert.equal(a.update().reserved,true);
 c.currentTime=100+sec(A,1.01);assert.equal(a.update().reserved,false,'in on the line');near(phaseError(a.mix.decks[0],a.mix.decks[1],c.currentTime),0,1e-9);await a.dispose();
 const b=new DJAudio(Context,{setIndex:0,loadTrack});await b.play(0);const d=b.context,B=b.mix.decks[0];
 d.currentTime=sec(B,33.5);b.update();assert(await b.play(1));assert.equal(b.mix.lastPlay.grade,'GOOD');assert(!b.mix.lastPlay.reserved);
 const s=b.voices[1].source;near(s.started.t,sec(B,33.5));near(s.started.offset,sec(B,1.5),1e-9);near(beatAt(b.mix.decks[1],d.currentTime),1.5,1e-9);await b.dispose();
});
await check('audio (#2456 review 3): a track that failed to load is fetched again on the next ▶, and the playing track keeps going meanwhile',async()=>{
 let failing=false;const tries=[];const flaky=async(c,key)=>{tries.push(key);if(failing&&key==='digitalLemonade')throw Error('音源読み込み失敗: Digital Lemonade');return loadTrack(c,key);};
 const a=new DJAudio(Context,{setIndex:0,loadTrack:flaky});assert(await a.play(0));const c=a.context,A=a.mix.decks[0];
 a.cache.delete('digitalLemonade');a.tracks[1]=null;failing=true;tries.length=0; // the next track is not loaded yet and the network is down
 c.currentTime=sec(A,31.9);a.update();await assert.rejects(a.play(1),/Digital Lemonade/);
 assert(a.mix.running&&A.playing,'the set keeps playing');assert(a.voices[0]&&!a.voices[0].stopped,'the playing voice is untouched');assert(!a.mix.decks[1].playing);assert.equal(a.mix.cue.pressed,null);assert.equal(a.cache.has('digitalLemonade'),false,'the failure is not cached');
 failing=false;c.currentTime=sec(A,32.2);a.update();assert(await a.play(1),'▶ again loads it and comes in');assert.deepEqual(tries,['digitalLemonade','digitalLemonade']);assert(a.mix.decks[1].playing);assert.equal(a.mix.lastPlay.grade,'PERFECT');
 await a.dispose();
});
await check('試聴 (DJK06・#2456 §3): a card plays its loudest bars for a few seconds on its own path at the playing tempo, the music dips and comes back; another card, a stale load, the end of the clip or a pause',async()=>{
 // where a card's preview starts: the loudest 2 bars of the loop (bar-aligned), worked out once
 const fake={nativeBpm:120,firstBeat:0,duration:64,beats:128,peaks:new Float32Array(6400).fill(.1)};for(let i=40*50;i<48*50;i++)fake.peaks[i]=.9;
 assert.equal(previewBeat(fake),40);assert.equal(fake.previewBeat,40);assert.equal(previewBeat({nativeBpm:120,firstBeat:0,duration:64,beats:128,peaks:new Float32Array(6400)}),0,'a silent track starts at the top');
 const a=new DJAudio(Context,{setIndex:0,loadTrack});assert.equal(await a.preview('risingTide'),false,'nothing before the set is on');
 await a.play(0);const c=a.context,master=a.voices[0];c.currentTime=10;a.update();const n=c.sources.length;
 assert(await a.preview('risingTide'));const p=a.previewing;assert.equal(p.key,'risingTide');assert.equal(c.sources.length,n+1);
 const t=await a.track('risingTide');near(p.source.started.t,10);near(p.source.started.offset,t.firstBeat+previewBeat(t,FEEL.preview.bars)*60/t.nativeBpm);near(p.source.playbackRate.value,120/122);
 assert(p.gain.connections.includes(c.destination)&&!p.gain.connections.includes(a.output),'its own path: the meters stay the music on air');near(p.gain.gain.calls[1][0],.18*FEEL.preview.level*10**(5/20));
 near(a.output.gain.value,.18*FEEL.preview.duck);assert.equal(a.voices[0],master,'the deck on air is not touched');assert(!master.stopped);
 assert(await a.preview('cutAndDry'));assert(p.source.stopped,'another card stops the first');assert.equal(a.previewing.key,'cutAndDry');near(a.output.gain.value,.18*FEEL.preview.duck);
 c.currentTime=10+FEEL.preview.seconds+.01;a.update();assert.equal(a.previewing,null,'the few seconds are over');near(a.output.gain.value,.18);
 a.muted=true;assert(await a.preview('cutAndDry'));near(a.previewing.gain.gain.calls[1][0],0,1e-12);near(a.output.gain.value,0,1e-12);a.muted=false;
 assert(await a.preview('ravingEnergy'));await a.pause();assert.equal(a.previewing,null,'a pause stops it');assert.equal(await a.preview('ravingEnergy'),false,'and nothing plays while paused');await a.dispose();
 let release;const slow=async(ctx,key)=>{if(key==='ravingEnergy')await new Promise(r=>release=r);return loadTrack(ctx,key);};
 const b=new DJAudio(Context,{setIndex:0,loadTrack:slow});await b.play(0);const first=b.preview('ravingEnergy');assert(await b.preview('cutAndDry'));release();
 assert.equal(await first,false,'a card tapped earlier never plays after a newer one');assert.equal(b.previewing.key,'cutAndDry');await b.dispose();assert.equal(b.previewing,null);
});
await check('audio: a missing excerpt or a custom preview passage can use the original without caching its PCM',async()=>{
 const clipLoads=[], a=new DJAudio(Context,{loadTrack,loadPreview:async(_ctx,key)=>{clipLoads.push(key);throw Error('clip unavailable');}});
 await a.play(0);
 const key='risingTide', t=await loadTrack(a.context,key), current={...FEEL.preview};
 try {
  assert(await a.preview(key));assert.deepEqual(clipLoads,[key]);
  near(a.previewing.source.started.offset,t.firstBeat+previewBeat(t,current.bars)*60/t.nativeBpm);
  assert.equal(a.cache.has(key),false);
  FEEL.preview.bars=3;
  FEEL.preview.seconds=5;
  const custom={...t,previewBeat:undefined};
  assert(await a.preview(key));assert.deepEqual(clipLoads,[key],'a tuning override uses the configured passage');
  near(a.previewing.source.started.offset,t.firstBeat+previewBeat(custom,3)*60/t.nativeBpm);
  assert.equal(a.cache.has(key),false);
 } finally {Object.assign(FEEL.preview,current);await a.dispose();}
 assert.equal(a.cache.size,0);assert.deepEqual(a.tracks,[null,null]);assert.equal(a.retiring.size,0);
});
await check('audio: slip and platter keep their timing; selection prefetches just the excerpts, releases the outgoing buffer, and decodes only the pick',async()=>{
 loads.length=0;const clipLoads=[],clip={duration:3.5};
 const loadPreview=async(_context,key,_signal,priority)=>{clipLoads.push([key,priority]);return clip;};
 const a=new DJAudio(Context,{setIndex:1,loadTrack,loadPreview,rng:()=>0});await a.play(0);const c=a.context,A=a.mix.decks[0];
 c.currentTime=sec(A,32);a.update();await a.play(1);c.currentTime=sec(A,34);a.update();assert.deepEqual(loads,['ravingEnergy','cutAndDry']);
 const first=a.voices[1],rate=first.source.playbackRate;near(rate.value,1);assert.equal(a.nudge(1,.1),null,'in time: the platter moves nothing');assert.equal(a.voices[1],first);
 c.currentTime=sec(A,38.01);a.update();near(rate.value,1-.1/DRIFT_BEATS,1e-9);assert.equal(a.voices[1],first,'the rate changes on the playing voice');
 c.currentTime=sec(A,41.01);a.update();near(rate.value,1);near(phaseError(A,a.mix.decks[1],c.currentTime),-.1,2e-3); // SET 2 slips .10〜.16 (DJR03); rng 0 takes the smallest
 let r=a.nudge(1,.04);assert.equal(r.fixed,false);assert.notEqual(a.voices[1],first,'a turn re-seeks the incoming deck');assert(first.stopped);const second=a.voices[1];
 r=a.nudge(1,.3);assert.equal(r.fixed,true);assert.notEqual(a.voices[1],second);near(phaseError(A,a.mix.decks[1],c.currentTime),0,1e-9);assert.equal(a.nudge(0,.1),null);
 a.setMix(1);for(let i=42;i<=64;i++){c.currentTime=sec(A,i);a.update();}
 assert.equal(a.mix.transitions.length,1);assert.deepEqual([a.mix.transitions[0].drifts,a.mix.transitions[0].fixes],[1,1]);assert.equal(a.voices[0],null);assert.equal(live(c).length,1);assert.equal(a.mix.decks[0].track,null);assert.equal(a.mix.phase,'select');
 const options=a.mix.select.options;assert.deepEqual(clipLoads,options.map(key=>[key,'low']));assert(options.includes('risingTide'));
 assert.deepEqual(loads,['ravingEnergy','cutAndDry'],'no candidate recording has been loaded');
 assert.equal(a.cache.has('ravingEnergy'),false);assert.equal(c.sources[0].buffer,null);assert.equal(a.tracks[0].buffer,undefined);assert(a.tracks[0].peaks.length>0,'the outgoing waveform is kept');
 assert(await a.preview('risingTide'));assert.equal(a.previewing.source.buffer,clip);near(a.previewing.source.started.offset,0);
 assert.deepEqual(loads,['ravingEnergy','cutAndDry'],'listening uses the prefetched excerpt');
 const picked=a.choose(options.indexOf('risingTide'));assert.deepEqual([picked.id,picked.key],[0,'risingTide']);assert.equal(a.choose(0),null);
 assert.equal(a.clips.size,0);assert.equal(a.previewing,null);
 await a.ensure(0);assert.equal(a.tracks[0].nativeBpm,122);assert.equal(a.tracks[0].firstBeat,.486);assert.equal(a.mix.decks[0].bpm,122,'the pick arrives at the playing tempo');assert.equal(loads.filter(k=>k==='risingTide').length,1,'fetched once');
 const B=a.mix.decks[1];c.currentTime=B.at+sec(B,a.mix.cue.start-B.beat);a.update();assert(await a.play(0));near(a.voices[0].source.started.offset,.486);near(a.voices[0].gain.gain.value,gains(1)[0]*10**(5/20),1e-9);await a.dispose();
});
await check('audio: fader keeps equal power, automatic low cut, master volume only while running',async()=>{
 const a=new DJAudio(Context,{setIndex:0,loadTrack});await a.play(0);const c=a.context;c.currentTime=sec(a.mix.decks[0],32);a.update();await a.play(1);
 a.setMix(.5);near(a.voices[0].gain.gain.value,Math.SQRT1_2);near(a.voices[1].gain.gain.value,Math.SQRT1_2);assert.equal(a.voices[0].filter,null);
 a.setMix(1);near(a.voices[0].gain.gain.value,0);near(a.voices[1].gain.gain.value,1);near(a.output.gain.value,.18);await a.pause();near(a.output.gain.value,0);assert(!a.mix.running);await a.dispose();
});
await check('audio: the last record keeps playing on the result screen, and resumes from its beat after a pause',async()=>{
 const a=new DJAudio(Context,{setIndex:0,loadTrack,rng:()=>0});await a.play(0);
 const c=a.context, A=a.mix.decks[0];
 c.currentTime=sec(A,32);a.update();await a.play(1);
 a.setMix(1);c.currentTime=sec(A,64);a.update();
 const {id,key}=a.choose(0);const B=a.mix.decks[1];
 const entry=B.at+sec(B,a.mix.cue.start-B.beat);
 c.currentTime=entry;a.update();assert(await a.play(id));
 a.setMix(0);c.currentTime=entry+sec(B,32);assert(a.update().finished);
 assert.equal(a.mix.phase,'done');assert.equal(a.voices[1],null);assert.deepEqual([...a.cache.keys()],[key]);
 const last=a.tracks[id], beat=beatAt(a.mix.decks[id],c.currentTime);
 assert.equal(a.voices[id].source.buffer,last.buffer);await a.pause();
 c.currentTime+=20;assert(await a.start());
 near(beatAt(a.mix.decks[id],c.currentTime),beat);assert.equal(a.voices[id].source.buffer,last.buffer);
 await a.dispose();assert.equal(a.cache.size,0);
});
await check('audio: failed ▶ can be retried; interruption pauses without resuming or changing the tempo',async()=>{
 class Failed extends Context{constructor(){super();this.fail=true;}}
 const a=new DJAudio(Failed,{setIndex:0,loadTrack});await assert.rejects(a.play(0),/audio refused/);assert(!a.mix.running);assert.equal(a.context.sources.length,0);a.context.fail=false;assert(await a.play(0));
 a.context.currentTime=2;a.context.change('interrupted');assert(!a.mix.running);assert.equal(a.voices.filter(Boolean).length,0);assert.deepEqual(a.mix.resumeDecks,[0]);await a.start();assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.mix.decks[1].bpm,120);await a.dispose();
});
await check('audio: pause during a pending ▶ cancels it; dispose during a pending ▶ leaves no nodes',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);if(this.state==='closed')throw Error('closed');this.change('running');}}
 const a=new DJAudio(Deferred,{setIndex:0,loadTrack});const p=a.play(0);assert.equal(await a.play(1),false);await a.pause();finish();assert.equal(await p,false);assert(!a.mix.running);assert.equal(a.context.sources.length,0);await a.dispose();
 const b=new DJAudio(Deferred,{setIndex:0,loadTrack});const q=b.play(1);await b.dispose();finish();await assert.rejects(q,/closed/);assert.equal(b.context.sources.length,0);assert(!b.mix.running);
});
// quick CIはGit LFSの実体を取らないので、ポインタなら記載された実体サイズで確かめる。
const audioSize=url=>{try{const head=fs.readFileSync(url).subarray(0,200).toString();const m=head.startsWith('version https://git-lfs.github.com/spec/v1')&&head.match(/^size (\d+)$/m);return m?Number(m[1]):fs.statSync(url).size;}catch{ // quick CIのsparseで実ファイルが無い時は、コミット済みblobの大きさで確かめる
const root=new URL('../../',import.meta.url);const rel=decodeURIComponent(url.pathname.slice(root.pathname.length));return Number(execFileSync('git',['cat-file','-s','HEAD:'+rel],{encoding:'utf8'}).trim());}};
await check('track metadata, real audio files and the original waveform peaks (artwork is checked by the browser suite)',async()=>{
 const expected=[[120,.006,'USUAN1100272'],[120,0,'USUAN1700010'],[122,.006,'USUAN1900013'],[122,.006,'USUAN1100852'],[122,.486,'USUAN1900011']];
 assert.equal(Object.keys(TRACKS).length,5);Object.entries(TRACKS).forEach(([key,t],i)=>{assert.deepEqual([t.bpm,t.firstBeat,t.isrc],expected[i]);assert(audioSize(new URL('../../assets/audio/dj/'+t.file,import.meta.url))>1e6);const clip=audioSize(new URL('../previews/dj/clips/'+key+'.flac',import.meta.url));assert(clip>1000&&clip<1e6,key);assert(fs.readFileSync(new URL('../previews/dj/app.mjs',import.meta.url),'utf8').includes('art-${'),key);});
 const pcm=Float32Array.from({length:10000},(_,i)=>Math.sin(i));const a=buildTrackData(pcm,1000,TRACKS.danceMonster);assert.equal(a.peaks.length,8192);assert.equal(a.beats,16);assert.equal(fullPeakAt(a,-1),a.peaks[0]);assert.equal(fullPeakAt(a,100),a.peaks.at(-1));
 const channel=Float32Array.from({length:70003},(_,i)=>Math.sin(i/3));const reference=new Float32Array(8192);
 for(let i=0;i<channel.length;i++){const bucket=Math.floor(i*reference.length/channel.length);reference[bucket]=Math.max(reference[bucket],Math.abs(channel[i]));}
 const chunked=await buildBufferTrackData({length:channel.length,sampleRate:8000,copyFromChannel(dst,_,offset){dst.set(channel.subarray(offset,offset+dst.length));}},TRACKS.risingTide,new AbortController().signal);
 assert.deepEqual(chunked.peaks,reference,'bins match the original calculation across PCM chunk boundaries');
});
await check('entry: ▶×2, one crossfader, two platters and the beat meter (no tempo faders, no SYNC), credits; no storage or network in the modules',()=>{
 const dir=new URL('../previews/dj/',import.meta.url);
 for(const name of ['app.mjs','audio.mjs','model.mjs','tracks.mjs','feel.mjs','sfx.mjs']){const s=fs.readFileSync(new URL(name,dir),'utf8');assert(!/localStorage|sessionStorage|core\/state|daily\/|https?:\/\//.test(s),name);}
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');
 for(const id of ['play-a','play-b','crossfader','platter-a','platter-b','jog-arrows-a','jog-arrows-b','beat','beat-dot','wave-a','wave-b','crowd','floor-fill','restart','guide','combo','pick','request','pick-cards','drop','burst-a','burst-b'])assert(html.includes(`id="${id}"`),id);
 assert(!/id="eq-[^"]*"[^>]*type=|<input[^>]*eq/i.test(html),'EQ knobs are decorative, not inputs');assert(!/data-nudge|id="assist"|id="tap"|id="judge-btn"|stage-btn/.test(html));assert(html.includes('CC BY 4.0'));
 assert.equal((html.match(/type="?range/g)||[]).length,1,'the crossfader is the only fader');assert(!/id="(sync|pitch-[ab]|lock-[ab])"/.test(html),'DJG: no tempo faders, SYNC or LOCK lamps');
 assert.equal(LEAD,16);assert.equal(GRACE,32);assert.equal(SYNC_BAND,.06);assert.equal(SNAP_BAND,.035);assert.equal(DRIFT_BEATS,3);
});
console.log(`DJ set: ${groups} controlled groups PASS; real browser/listening/capture NOT RUN.`);
