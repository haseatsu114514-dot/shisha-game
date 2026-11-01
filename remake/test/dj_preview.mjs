// DJ set contracts (2026-11-01 redesign): quantized ▶, 8-bar crossfade scoring, automatic EQ, floor meter, set flow.
// Actual modules + controlled WebAudio; no real browser/listening claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSet,makeDeck,detuneFactorFor,playDeck,pauseMix,resumeMix,beatAt,setTempo,setPitch,pitchOf,bpmRange,phaseError,gains,updateSet,syncIncoming,quality,floorStep,scoreTransition,scoreFromErr,rankFromScore,scoreSet,lowCutDb,LOW_CUT_DB,LOCK_PCT,PHRASE,LEAD,GRACE,toward,gradeOf,dancerPose} from '../previews/dj/model.mjs';
import {renderTrack,peakAt} from '../previews/dj/synth.mjs';
import {DJAudio} from '../previews/dj/audio.mjs';
import {TRACKS,SETS,buildTrackData,peakAt as fullPeakAt} from '../previews/dj/tracks.mjs';
let groups=0;async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
const S1=SETS[0],S2=SETS[1];
const sec=(d,beats)=>beats*60/d.bpm; // seconds for beats on a deck

await check('sets: first track never detuned, SET 1 needs no pitch, random detune stays ±1.2〜2.8 %',()=>{
 const m=createSet(S1,detuneFactorFor(S1));assert.deepEqual(m.decks.map(d=>d.bpm),[120,120]);assert.deepEqual(m.decks.map(d=>d.track),['danceMonster','digitalLemonade']);assert.equal(m.position,2);assert.equal(m.phase,'idle');near(m.floor,.5);
 for(let i=0;i<50;i++){const f=detuneFactorFor(S2)(1),v=Math.abs(f-1);assert(v>=.012&&v<=.028);assert.equal(detuneFactorFor(S2)(0),1);}
 const seeded=detuneFactorFor(S2,()=>.9);near(seeded(1),1+.012+.9*.016);near(seeded(2),seeded(1));
 assert.equal(SETS.length,3);for(const s of SETS){assert(s.tracks.length>=3);for(const k of s.tracks)assert(TRACKS[k]);}
});
await check('pitch fader is ±8 % of the native tempo; BPM rounds to 0.01',()=>{
 const d=makeDeck('danceMonster');assert.deepEqual(bpmRange(d),[110.4,129.6]);setPitch(d,2,0);near(d.bpm,122.4);near(pitchOf(d),2);setPitch(d,-9,0);near(d.bpm,110.4);setPitch(d,9,0);near(d.bpm,129.6);
 setTempo(d,121.004,0);near(d.bpm,121);setTempo(d,200,0);near(d.bpm,129.6);assert.equal(makeDeck('risingTide',1.02).bpm,124.44);
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
await check('quantized ▶: the incoming deck lands on the master\'s nearest beat and the error is graded in ms',()=>{
 for(const [beat,ms,grade,snap] of [[31.9,-50,'GOOD',32],[32.02,10,'PERFECT',32],[32.9,450,'LATE',33],[31.5,-250,'EARLY',32],[33.4,700,'LATE',33]]){
  const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t=sec(a,beat);updateSet(m,t);assert(playDeck(m,1,t));
  near(m.lastPlay.errorMs,ms,1e-6);assert.equal(m.lastPlay.grade,grade);assert.equal(m.cue.pressed.beat,snap);assert.equal(m.phase,'mix');
  near(m.decks[1].at,sec(a,snap));near(beatAt(m.decks[1],sec(a,snap)),0);near(beatAt(m.decks[1],sec(a,snap+1)),1);near(phaseError(a,m.decks[1],sec(a,40)),0);
 }
 for(const [ms,g] of [[0,'PERFECT'],[30,'PERFECT'],[31,'GOOD'],[60,'GOOD'],[61,'OK'],[120,'OK'],[-121,'EARLY'],[121,'LATE']])assert.equal(gradeOf(ms),g);
 const m=createSet(S1);playDeck(m,0,0);playDeck(m,1,sec(m.decks[0],32));assert.equal(playDeck(m,1,20),false);
});
await check('mix: fader jump within 250 ms is tracked; crossing 0.9 toward the incoming deck records progress',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 m.mix=0;updateSet(m,t0+.1);m.mix=.1;updateSet(m,t0+.2);near(m.fader.maxJump,.1);m.mix=.5;updateSet(m,t0+.3);near(m.fader.maxJump,.5);
 m.mix=.5;updateSet(m,t0+2);near(m.fader.maxJump,.5);assert.equal(m.fader.reached,null);
 m.mix=.92;const v=updateSet(m,t0+sec(a,16));near(m.fader.reached,.5);assert.equal(v.mode,'mix');near(v.progress,.5);
 const m2=createSet(S1);playDeck(m2,1,0);const b=m2.decks[1];updateSet(m2,sec(b,32));playDeck(m2,0,sec(b,32));m2.mix=1;updateSet(m2,sec(b,33));near(toward(m2),0);m2.mix=.05;updateSet(m2,sec(b,34));near(toward(m2),.95);near(m2.fader.reached,2/32);
});
await check('transition end: score recorded, outgoing deck stops and takes the next track, new cue from the new master',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0+.01);
 for(let i=1;i<=32;i++){m.mix=Math.min(1,i/24);updateSet(m,t0+sec(a,i)-.001);}
 const v=updateSet(m,t0+sec(a,32));assert(v.transition);assert.equal(v.stopped,0);assert.deepEqual(v.loaded,{id:0,key:'danceMonster'});
 assert.equal(m.transitions.length,1);const t=m.transitions[0];assert.equal(t.from,'danceMonster');assert.equal(t.to,'digitalLemonade');assert.equal(t.grade,'PERFECT');assert.deepEqual(t.parts,[100,100,100]);assert.equal(t.rank,'S');
 assert(!m.decks[0].playing);assert.equal(m.decks[0].track,'danceMonster');assert.equal(m.decks[0].bpm,120);assert.equal(m.position,3);assert.equal(m.master,1);
 assert.deepEqual([m.phase,m.cue.from,m.cue.to],['cue',1,0]);assert.equal(m.cue.start,64,'B is at beat 32: the next head with ≥4 bars lead is 64');
 assert(m.decks[1].playing);near(beatAt(m.decks[1],t0+sec(a,32)),32);
});
await check('grace: without a crossing the outgoing deck keeps playing up to 8 more bars, then the fader item is marked late',()=>{
 const m=createSet(S1);playDeck(m,0,0);const a=m.decks[0],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 let v=updateSet(m,t0+sec(a,32.5));assert.equal(v.mode,'mix');assert(m.decks[0].playing);near(v.progress,1);
 m.mix=.95;v=updateSet(m,t0+sec(a,40));assert(v.transition);near(v.transition.reached,40/32);assert.equal(v.transition.done,60);assert.equal(v.transition.parts[2],Math.round((60+100)/2));
 const m2=createSet(S1);playDeck(m2,0,0);updateSet(m2,t0);playDeck(m2,1,t0);v=updateSet(m2,t0+sec(a,PHRASE+GRACE));assert(v.transition);assert.equal(v.transition.reached,null);assert.equal(v.transition.done,30);
});
await check('whole set: last transition ends the set with an averaged result; the final track keeps playing',()=>{
 const m=createSet(S1);let now=0;playDeck(m,0,now);
 const run=()=>{const from=m.decks[m.cue.from],to=m.cue.to;now=from.at+sec(from,m.cue.start-from.beat);updateSet(m,now);playDeck(m,to,now);const t0=now;
  for(let i=1;i<32;i++){m.mix=to?Math.min(1,i/20):Math.max(0,1-i/20);now=t0+sec(from,i);updateSet(m,now);}now=t0+sec(from,32)+.001;return updateSet(m,now);};
 let v=run();assert(v.transition&&!v.finished);assert.equal(m.phase,'cue');assert.equal(m.decks[0].track,'danceMonster');
 v=run();assert(v.finished);assert.equal(m.phase,'done');assert.equal(m.cue,null);assert.equal(m.decks[1].track,null);assert(m.decks[0].playing);assert(!m.decks[1].playing);
 assert.equal(m.result.transitions.length,2);assert.equal(m.result.rank,'S');assert.equal(m.result.total,100);assert.equal(m.result.set,'SET 1');assert(m.result.floor>50);
 assert.equal(updateSet(m,now+5).mode,'done');assert.equal(playDeck(m,1,now+5),false);assert.equal(scoreSet(createSet(S1)),null);
});
await check('QUANTIZE: once the BPMs lock, the incoming deck\'s phase snaps to the master; unlocked tempos drift',()=>{
 const m=createSet(S2,()=>1.02);playDeck(m,0,0);const a=m.decks[0],b=m.decks[1],t0=sec(a,32);updateSet(m,t0);playDeck(m,1,t0);
 assert.equal(b.bpm,124.44);let v=updateSet(m,t0+4);assert.equal(v.snapped,null);const drift=Math.abs(phaseError(a,b,t0+4));assert(drift>.05);
 setTempo(b,122.1,t0+4);v=updateSet(m,t0+4.01);assert.equal(v.snapped,1);near(phaseError(a,b,t0+4.01),0);near(b.bpm,122.1);
 v=updateSet(m,t0+6);assert.equal(v.snapped,null,'aligned within 0.02 beat: no second snap');
 setTempo(b,122.2,t0+6);v=updateSet(m,t0+6.01);assert.equal(v.snapped,null,'0.16 % off is not locked');
});
await check('SYNC copies the master tempo to the incoming deck (clamped to its range) and marks the transition',()=>{
 const m=createSet(S2,()=>1.02);playDeck(m,0,0);assert(syncIncoming(m,1));near(m.decks[1].bpm,122);assert(m.cue.synced);
 const m2=createSet(SETS[2]);playDeck(m2,0,0);setTempo(m2.decks[0],131,0);syncIncoming(m2,1);near(m2.decks[1].bpm,129.6);assert.equal(syncIncoming(createSet(S1),0),false);
});
await check('scores: thresholds, SYNC cap, fader completion and smoothness, ranks',()=>{
 for(const [v,p] of [[.15,100],[.1501,85],[.3,85],[.3001,60],[.6,60],[.6001,30]])assert.equal(scoreTransition({pitchErrPct:v,playMs:0,reached:.5,maxJump:0}).parts[0],p);
 assert.equal(scoreTransition({pitchErrPct:0,synced:true,playMs:0,reached:.5,maxJump:0}).parts[0],85);
 for(const [v,p] of [[30,100],[31,85],[60,85],[61,60],[120,60],[121,30]])assert.equal(scoreTransition({pitchErrPct:0,playMs:v,reached:.5,maxJump:0}).parts[1],p);
 for(const [r,p] of [[null,30],[1.5,60],[.2,85],[.3,100],[1,100]])assert.equal(scoreTransition({pitchErrPct:0,playMs:0,reached:r,maxJump:0}).done,p);
 for(const [j,p] of [[.2,100],[.21,85],[.4,85],[.41,60],[.7,60],[.71,30]])assert.equal(scoreTransition({pitchErrPct:0,playMs:0,reached:.5,maxJump:j}).smooth,p);
 const s=scoreTransition({pitchErrPct:.2,playMs:70,reached:.2,maxJump:.5});assert.deepEqual(s.parts,[85,60,Math.round((85+60)/2)]);assert.equal(s.total,Math.round((85+60+73)/3));
 for(const [s,a,b] of [[30,60,120],[25,50,100]]){assert.equal(scoreFromErr(s,s,a,b),100);assert.equal(scoreFromErr(s+.001,s,a,b),85);assert.equal(scoreFromErr(b+.001,s,a,b),30);}
 for(const [v,r] of [[90,'S'],[89,'A'],[75,'A'],[74,'B'],[55,'B'],[54,'C']])assert.equal(rankFromScore(v),r);
});
await check('floor: silence and clashing beats bring it down, a clean blend lifts it; PERFECT entries give a bump',()=>{
 const m=createSet(S1);playDeck(m,0,0);m.mix=0;near(quality(m,1),.6);m.mix=1;near(quality(m,1),0,1e-9);m.mix=.5;near(quality(m,1),.6,1e-9);m.mix=.75;near(quality(m,1),gains(.75)[0]**2*.6,1e-9);
 const t0=sec(m.decks[0],32);updateSet(m,t0);playDeck(m,1,t0);m.mix=.5;near(quality(m,t0+1),1);
 m.decks[1].beat+=.25;assert(quality(m,t0+1)<.5);m.mix=0;near(quality(m,t0+1),1,1e-9);
 const f=createSet(S1);floorStep(f,1,10);near(f.floor,.5+.45*10*.06);floorStep(f,0,100);near(f.floor,0);
 const g=createSet(S1);playDeck(g,0,0);updateSet(g,sec(g.decks[0],32));playDeck(g,1,sec(g.decks[0],32));near(g.floor,.58);
 const h=createSet(S1);playDeck(h,0,0);updateSet(h,sec(h.decks[0],33));playDeck(h,1,sec(h.decks[0],33));near(h.floor,.45);
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
await check('audio: first ▶ loads the two deck tracks and starts exactly one source at native rate',async()=>{
 loads.length=0;const a=new DJAudio(Context,{setIndex:0,loadTrack});assert.equal(a.context,null);assert(await a.play(0));
 assert.deepEqual(loads,['danceMonster','digitalLemonade']);assert.equal(a.context.sources.length,1);assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.voices[0].source.playbackRate.value,1);near(a.voices[0].source.started.offset,.006);near(a.voices[0].source.loopStart,.006);
 assert.equal(await a.play(0),false);assert.equal(a.context.sources.length,1);await a.dispose();
});
await check('audio: quantized ▶ schedules the source on the master\'s next beat; pitch changes only the chosen rate',async()=>{
 const a=new DJAudio(Context,{setIndex:1,detuneFactor:1.02,loadTrack});await a.play(0);const c=a.context,A=a.mix.decks[0];
 c.currentTime=sec(A,31.9);a.update();await a.play(1);const v=a.voices[1].source;near(v.started.t,sec(A,32));near(v.started.offset,.006);assert.equal(a.mix.lastPlay.grade,'GOOD');
 near(v.playbackRate.value,124.44/122);a.pitch(1,0);near(a.mix.decks[1].bpm,122);near(v.playbackRate.value,1);near(a.mix.decks[0].bpm,122);a.tempo(0,122.3);near(a.voices[0].source.playbackRate.value,122.3/122);near(v.playbackRate.value,1);
 assert.equal(await a.play(1),false);assert.equal(live(c).length,2);await a.dispose();
});
await check('audio: update applies QUANTIZE snaps, the outgoing stop, and preloads then assigns the next track',async()=>{
 loads.length=0;const a=new DJAudio(Context,{setIndex:1,detuneFactor:1.02,loadTrack});await a.play(0);const c=a.context,A=a.mix.decks[0];
 c.currentTime=sec(A,32);a.update();await a.play(1);c.currentTime=sec(A,34);a.update();assert.deepEqual(loads,['ravingEnergy','cutAndDry','risingTide'],'third track prefetched during the mix');
 const first=a.voices[1];a.pitch(1,0);c.currentTime=sec(A,34.01);a.update();assert.notEqual(a.voices[1],first,'snap re-seeks the incoming deck');assert(first.stopped);near(phaseError(A,a.mix.decks[1],c.currentTime),0);
 a.setMix(1);for(let i=35;i<=64;i++){c.currentTime=sec(A,i);a.update();}
 assert.equal(a.mix.transitions.length,1);assert.equal(a.voices[0],null);assert.equal(live(c).length,1);assert.equal(a.mix.decks[0].track,'risingTide');
 await a.ensure(0);assert.equal(a.tracks[0].nativeBpm,122);assert.equal(a.tracks[0].firstBeat,.486);
 const B=a.mix.decks[1];c.currentTime=B.at+sec(B,a.mix.cue.start-B.beat);a.update();assert(await a.play(0));near(a.voices[0].source.started.offset,.486);near(a.voices[0].gain.gain.value,gains(1)[0]*10**(5/20),1e-9);await a.dispose();
});
await check('audio: fader keeps equal power, automatic low cut, master volume only while running',async()=>{
 const a=new DJAudio(Context,{setIndex:0,loadTrack});await a.play(0);const c=a.context;c.currentTime=sec(a.mix.decks[0],32);a.update();await a.play(1);
 a.setMix(.5);near(a.voices[0].gain.gain.value,Math.SQRT1_2);near(a.voices[1].gain.gain.value,Math.SQRT1_2);assert.equal(a.voices[0].filter,null);
 a.setMix(1);near(a.voices[0].gain.gain.value,0);near(a.voices[1].gain.gain.value,1);near(a.output.gain.value,.18);await a.pause();near(a.output.gain.value,0);assert(!a.mix.running);await a.dispose();
});
await check('audio: failed ▶ can be retried; interruption pauses without resuming or changing pitch',async()=>{
 class Failed extends Context{constructor(){super();this.fail=true;}}
 const a=new DJAudio(Failed,{setIndex:0,loadTrack});a.pitch(1,1.5);await assert.rejects(a.play(0),/audio refused/);assert(!a.mix.running);assert.equal(a.context.sources.length,0);a.context.fail=false;assert(await a.play(0));near(a.mix.decks[1].bpm,121.8);
 a.context.currentTime=2;a.context.change('interrupted');assert(!a.mix.running);assert.equal(a.voices.filter(Boolean).length,0);assert.deepEqual(a.mix.resumeDecks,[0]);await a.start();assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.mix.decks[1].bpm,121.8);await a.dispose();
});
await check('audio: pause during a pending ▶ cancels it; dispose during a pending ▶ leaves no nodes',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);if(this.state==='closed')throw Error('closed');this.change('running');}}
 const a=new DJAudio(Deferred,{setIndex:0,loadTrack});const p=a.play(0);assert.equal(await a.play(1),false);await a.pause();finish();assert.equal(await p,false);assert(!a.mix.running);assert.equal(a.context.sources.length,0);await a.dispose();
 const b=new DJAudio(Deferred,{setIndex:0,loadTrack});const q=b.play(1);await b.dispose();finish();await assert.rejects(q,/closed/);assert.equal(b.context.sources.length,0);assert(!b.mix.running);
});
await check('audio: SYNC applies the rate to the incoming deck only',async()=>{
 const a=new DJAudio(Context,{setIndex:1,detuneFactor:1.02,loadTrack});await a.play(0);assert(a.sync());near(a.mix.decks[1].bpm,122);assert(a.mix.cue.synced);
 a.context.currentTime=sec(a.mix.decks[0],32);a.update();await a.play(1);near(a.voices[1].source.playbackRate.value,1);await a.dispose();
});
// quick CIはGit LFSの実体を取らないので、ポインタなら記載された実体サイズで確かめる。
const audioSize=url=>{const head=fs.readFileSync(url).subarray(0,200).toString();const m=head.startsWith('version https://git-lfs.github.com/spec/v1')&&head.match(/^size (\d+)$/m);return m?Number(m[1]):fs.statSync(url).size;};
await check('track metadata and real audio files (quick CI has no images: artwork is checked by the browser suite)',()=>{
 const expected=[[120,.006,'USUAN1100272'],[120,0,'USUAN1700010'],[122,.006,'USUAN1900013'],[122,.006,'USUAN1100852'],[122,.486,'USUAN1900011']];
 assert.equal(Object.keys(TRACKS).length,5);Object.entries(TRACKS).forEach(([key,t],i)=>{assert.deepEqual([t.bpm,t.firstBeat,t.isrc],expected[i]);assert(audioSize(new URL('../../assets/audio/dj/'+t.file,import.meta.url))>1e6);assert(fs.readFileSync(new URL('../previews/dj/app.mjs',import.meta.url),'utf8').includes('art-${'),key);});
 const pcm=Float32Array.from({length:10000},(_,i)=>Math.sin(i));const a=buildTrackData(pcm,1000,TRACKS.danceMonster);assert.equal(a.peaks.length,8192);assert.equal(a.beats,16);assert.equal(fullPeakAt(a,-1),a.peaks[0]);assert.equal(fullPeakAt(a,100),a.peaks.at(-1));
});
await check('entry: ▶×2, crossfader, SYNC, decorative EQ, credits; no sync-by-default, storage or network in the modules',()=>{
 const dir=new URL('../previews/dj/',import.meta.url);
 for(const name of ['app.mjs','audio.mjs','model.mjs','tracks.mjs']){const s=fs.readFileSync(new URL(name,dir),'utf8');assert(!/localStorage|sessionStorage|core\/state|daily\/|https?:\/\//.test(s),name);}
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');
 for(const id of ['play-a','play-b','crossfader','sync','pitch-a','pitch-b','wave-a','wave-b','crowd','floor-fill','restart'])assert(html.includes(`id="${id}"`),id);
 assert(!/id="eq-[^"]*"[^>]*type=|<input[^>]*eq/i.test(html),'EQ knobs are decorative, not inputs');assert(!/data-nudge|id="assist"|id="tap"|id="judge-btn"|stage-btn/.test(html));assert(html.includes('CC BY 4.0'));
 assert.equal(LEAD,16);assert.equal(GRACE,32);assert.equal(LOCK_PCT,.15);
});
console.log(`DJ set: ${groups} controlled groups PASS; real browser/listening/capture NOT RUN.`);
