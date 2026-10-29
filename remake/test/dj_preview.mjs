// New manual pitch/PLAY contracts. Actual modules + controlled WebAudio; no real browser/listening claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMix,playDeck,pauseDeck,resumeMix,pauseMix,beatAt,setTempo,nudgeDeck,phaseError,phraseError,gains,guideNext,updateMix,dancerPose,createStageMix,scoreMix,scoreFromErr,rankFromScore} from '../previews/dj/model.mjs';
import {renderTrack,peakAt} from '../previews/dj/synth.mjs';
import {DJAudio} from '../previews/dj/audio.mjs';
import {TRACKS,STAGES,buildTrackData,peakAt as fullPeakAt} from '../previews/dj/tracks.mjs';
const loadTracks=async c=>[0,1].map(id=>({...renderTrack(id,c.sampleRate),firstBeat:0,beats:32}));
let groups=0;async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
await check('initial readiness starts no deck and retains 128/126 BPM mismatch',()=>{
 const m=createMix();resumeMix(m,20);assert.deepEqual(m.decks.map(d=>d.playing),[false,false]);assert.deepEqual(m.decks.map(d=>d.bpm),[128,126]);assert.equal(m.guide,null);assert(!m.running);assert(!('assist'in m));
});
await check('only manual pitch changes selected BPM; stopped head remains stationary',()=>{
 const m=createMix();setTempo(m.decks[1],127.3,4);near(beatAt(m.decks[1],100),0);assert.equal(m.decks[0].bpm,128);assert.equal(m.decks[1].bpm,127.3);assert.equal(nudgeDeck(m,1,.5,5),false);near(m.decks[1].beat,0);
});
await check('PLAY A starts A only; guide crosses many phrases without starting/syncing B',()=>{
 const m=createMix();assert(playDeck(m,0,2));const before=JSON.stringify(m.decks[1]);assert.equal(m.guide.start,32);
 for(const t of [10,17,20,32,50,100])updateMix(m,t);
 assert.equal(JSON.stringify(m.decks[1]),before);assert.equal(m.decks[0].bpm,128);assert.equal(m.decks[1].bpm,126);assert(!m.decks[1].playing);
});
await check('manual PLAY is immediate at supplied audio time, not quantized to phrase',()=>{
 const m=createMix();playDeck(m,0,2);setTempo(m.decks[1],128,3);assert(playDeck(m,1,17.08));
 assert.equal(m.decks[1].at,17.08);near(m.decks[1].beat,0);near(beatAt(m.decks[1],17.38),.3*128/60);assert(Math.abs(phaseError(...m.decks,17.08))>.1);assert.equal(playDeck(m,1,18),false);
});
await check('manual phase nudge changes offset without tempo or guide auto-correction',()=>{
 const m=createMix();playDeck(m,0,0);playDeck(m,1,3.1);const bpms=m.decks.map(d=>d.bpm),old=beatAt(m.decks[1],5);
 assert(nudgeDeck(m,1,.0625,5));near(beatAt(m.decks[1],5),old+.0625);updateMix(m,5);guideNext(m,5);assert.deepEqual(m.decks.map(d=>d.bpm),bpms);near(beatAt(m.decks[1],5),old+.0625);
});
await check('beat alignment is distinct from a whole-bar phrase offset',()=>{
 const m=createMix();setTempo(m.decks[1],128,0);playDeck(m,0,0);playDeck(m,1,4*60/128);near(phaseError(...m.decks,5),0);near(phraseError(...m.decks,5),-4);
});
await check('8-bar guide/fader/master never modify manual pitch or head positions',()=>{
 const m=createMix();playDeck(m,0,0);setTempo(m.decks[1],127.7,3);playDeck(m,1,15.1);const before=JSON.stringify(m.decks);
 assert.equal(updateMix(m,14).mode,'entry');assert.equal(updateMix(m,15.1).mode,'mix');near(updateMix(m,22.5).progress,.5);m.mix=1;updateMix(m,30);assert.equal(m.master,1);assert.equal(m.visualMaster,1);assert.equal(JSON.stringify(m.decks),before);assert(!('last'in m));assert(!('reached'in m));
});
await check('missed PLAY remains a manual wait at later phrase heads',()=>{
 const m=createMix();playDeck(m,0,0);assert.equal(updateMix(m,15).mode,'waiting-play');assert.equal(updateMix(m,30).mode,'waiting-play');assert.equal(m.guide.start,64);assert.equal(m.guide.end,96);assert(!m.decks[1].playing);
});
await check('global pause/resume preserves the same guide and only previously playing decks',()=>{
 const m=createMix();playDeck(m,0,0);const guide=JSON.stringify(m.guide);pauseMix(m,4);pauseMix(m,5);near(beatAt(m.decks[0],500),128/60*4);resumeMix(m,500);assert.deepEqual(m.decks.map(d=>d.playing),[true,false]);assert.equal(JSON.stringify(m.guide),guide);near(beatAt(m.decks[0],501),128/60*5);
});
await check('manual deck pause retains head and does not get resumed by guide/fader',()=>{
 const m=createMix();playDeck(m,0,0);playDeck(m,1,2);pauseDeck(m,1,5);const pos=m.decks[1].beat;
 m.mix=1;updateMix(m,30);assert(!m.decks[1].playing);near(m.decks[1].beat,pos);pauseMix(m,31);resumeMix(m,50);assert(!m.decks[1].playing);playDeck(m,1,51);near(m.decks[1].beat,pos);assert.equal(m.decks[1].bpm,126);
});
await check('tempo reanchor and audio-clock pause remain continuous',()=>{
 const m=createMix();playDeck(m,0,10);near(beatAt(m.decks[0],40),64);setTempo(m.decks[0],120,40);near(beatAt(m.decks[0],55),94);pauseMix(m,55);resumeMix(m,5000);near(beatAt(m.decks[0],5001),96);
});
await check('equal-power fader math remains bounded',()=>{for(let i=0;i<=100;i++){const[a,b]=gains(i/100);near(a*a+b*b,1);assert(a+b<=Math.SQRT2+1e-7);}near(gains(0)[0],1);near(gains(1)[1],1);});
await check('actual PCM BPM/duration/peaks/onsets remain finite and deterministic',()=>{
 for(const id of [0,1]){const a=renderTrack(id,8000),b=renderTrack(id,8000);near(a.duration*a.nativeBpm/60,32);let max=0,energy=0;
  for(let i=0;i<a.samples.length;i++){assert(Number.isFinite(a.samples[i]));assert.equal(a.samples[i],b.samples[i]);max=Math.max(max,Math.abs(a.samples[i]));energy+=a.samples[i]**2;}
  assert(max>.3&&max<.95);assert(energy/a.samples.length>.001);assert.equal(a.samples[0],0);assert.equal(a.samples.at(-1),0);
  for(let i=0;i<a.peaks.length;i++){let p=0;for(let j=i*a.stride;j<Math.min((i+1)*a.stride,a.samples.length);j++)p=Math.max(p,Math.abs(a.samples[j]));near(a.peaks[i],p,1e-6);}near(peakAt(a,.04),peakAt(a,a.duration+.04));
 }
 const a=renderTrack(0,8000),energy=beat=>{const i=Math.round(beat*60/128*8000);return a.samples.slice(i,i+160).reduce((s,v)=>s+v*v,0);};assert(energy(4)>energy(4.7)*3);
});
await check('audio-clock dance loop keeps alternating planted feet and reduced pose',()=>{
 const a=dancerPose(0),b=dancerPose(4);for(const k of Object.keys(a))near(a[k],b[k]);
 for(let p=0;p<4;p+=.05){const s=dancerPose(p);assert(s.left===0||s.right===0);assert(s.left<=4&&s.right<=4);}assert.deepEqual(dancerPose(2,true),{hip:0,bob:0,left:0,right:0,arm:0});
});
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
await check('audio preparation creates no source; actual PLAY starts exactly one native-rate deck',async()=>{
 const a=new DJAudio(Context,{loadTracks});await a.start();assert.equal(a.context.sources.length,0);assert(!a.mix.running);assert.equal(a.output.gain.value,0);
 a.tempo(1,127.3);await a.play(0);assert.equal(a.context.sources.length,1);assert(!a.mix.decks[1].playing);const c=a.context;c.currentTime=4.23;await a.play(1);assert.equal(c.sources.length,2);near(a.voices[1].source.started.t,4.23);near(a.voices[1].source.started.offset,0);near(a.voices[1].source.playbackRate.value,127.3/a.tracks[1].nativeBpm);assert.equal(a.mix.decks[1].bpm,127.3);assert.equal(await a.play(1),false);assert.equal(c.sources.length,2);await a.dispose();
});
await check('fader/guide/prepare/PLAY do not replace manual tempo in actual audio params',async()=>{
 const a=new DJAudio(Context,{loadTracks});a.tempo(1,129.1);await a.start();await a.play(0);a.context.currentTime=3;await a.play(1);
 const before=JSON.stringify(a.mix.decks),rate=a.voices[1].source.playbackRate.value;for(const x of [0,.3,.8,1]){a.setMix(x);updateMix(a.mix,a.now);guideNext(a.mix,a.now);}await a.start();assert.equal(JSON.stringify(a.mix.decks),before);near(a.voices[1].source.playbackRate.value,rate);assert.equal(a.context.sources.length,2);await a.dispose();
});
await check('actual phase correction seeks audio, never starts a stopped deck',async()=>{
 const a=new DJAudio(Context,{loadTracks});await a.start();assert.equal(a.nudge(1,.5),false);assert.equal(a.context.sources.length,0);await a.play(1);a.context.currentTime=2;const old=beatAt(a.mix.decks[1],2);a.nudge(1,.5);near(a.voices[1].source.started.offset,((old+.5)%32)*60/a.tracks[1].nativeBpm);near(a.voices[1].source.playbackRate.value,126/a.tracks[1].nativeBpm);assert.equal(a.context.sources.filter(s=>!s.stopped).length,1);await a.dispose();
});
await check('pause/resume freezes beats and preserves independent active-deck ownership',async()=>{
 const a=new DJAudio(Context,{loadTracks});await a.play(0);const c=a.context;c.currentTime=4;await a.pause();const beat=a.mix.decks[0].beat;c.currentTime=90;await a.start();near(beatAt(a.mix.decks[0],90),beat);assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);assert.equal(c.sources.filter(s=>!s.stopped).length,1);a.pauseDeck(0);assert(!a.mix.running);await a.start();assert.equal(c.sources.filter(s=>!s.stopped).length,0);await a.dispose();
});
await check('failed manual PLAY can be retried without auto-starting the other deck',async()=>{
 class Failed extends Context{constructor(){super();this.fail=true;}}
 const a=new DJAudio(Failed,{loadTracks});a.tempo(1,127.7);await assert.rejects(a.play(1),/audio refused/);assert(!a.mix.running);assert.equal(a.context.sources.length,0);a.context.fail=false;assert(await a.play(1));assert.deepEqual(a.mix.decks.map(d=>d.playing),[false,true]);near(a.mix.decks[1].bpm,127.7);await a.dispose();
});
await check('mute start and suspend failure silence every active voice',async()=>{
 const a=new DJAudio(Context,{loadTracks});a.muted=true;await a.play(0);assert.equal(a.output.gain.value,0);a.context.failSuspend=true;await assert.rejects(a.pause(),/suspend failed/);assert(!a.mix.running);assert(a.context.sources.every(s=>s.stopped));assert.equal(a.output.gain.value,0);await a.dispose();
});
await check('interruption is a pause, not auto resumption or pitch matching',async()=>{
 const a=new DJAudio(Context,{loadTracks});a.tempo(1,127.2);await a.play(0);a.context.currentTime=2;a.context.change('interrupted');assert(!a.mix.running);assert.equal(a.voices.filter(Boolean).length,0);assert.deepEqual(a.mix.resumeDecks,[0]);await a.start();assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.mix.decks[1].bpm,127.2);await a.dispose();
});
await check('pause during pending PLAY cancels sound; duplicate request is not queued',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);this.change('running');}}
 const a=new DJAudio(Deferred,{loadTracks});const p=a.play(0);assert.equal(await a.play(1),false);await a.pause();finish();assert.equal(await p,false);assert(!a.mix.running);assert.equal(a.context.sources.length,0);await a.dispose();
});
await check('dispose during pending PLAY prevents late sources and leaves no nodes',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);if(this.state==='closed')throw Error('closed');this.change('running');}}
 const a=new DJAudio(Deferred,{loadTracks});const p=a.play(1);await a.dispose();finish();await assert.rejects(p,/closed/);assert.equal(a.context.sources.length,0);assert(a.disposed);assert(!a.mix.running);
});
await check('entry has individual PLAY and no hidden sync/auto blend or game SAVE',()=>{
 const dir=new URL('../previews/dj/',import.meta.url);for(const name of ['app.mjs','audio.mjs','model.mjs','synth.mjs']){const s=fs.readFileSync(new URL(name,dir),'utf8');assert(!/localStorage|sessionStorage|core\/state|daily\/|https?:\/\//.test(s));if(name!=='synth.mjs')assert(!/syncDeck|queueMix|\.sync\(|assist|reconcile|reached/.test(s));}
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');assert(html.includes('play-a')&&html.includes('play-b'));assert(!/data-sync|id="assist"|id="tap"/.test(html));assert(html.includes('wave-a')&&html.includes('wave-b'));assert(html.includes('実曲'));
});


await check('hundredth-BPM changes preserve current beat and affect only selected playback rate',async()=>{
 const a=new DJAudio(Context,{loadTracks});await a.play(0);await a.play(1);a.context.currentTime=2;
 const beat=beatAt(a.mix.decks[1],2);a.tempo(1,126.01);
 near(beatAt(a.mix.decks[1],2),beat);near(a.mix.decks[0].bpm,128);near(a.voices[1].source.playbackRate.value,126.01/a.tracks[1].nativeBpm);
 near(beatAt(a.mix.decks[1],3),beat+126.01/60);
 a.tempo(1,140.01);near(a.mix.decks[1].bpm,140);a.tempo(1,109.99);near(a.mix.decks[1].bpm,110);await a.dispose();
});

await check('manual pitch copies a chosen value while stopped without playback',()=>{
 const a=new DJAudio(Context,{loadTracks});a.tempo(0,127.83);a.tempo(1,a.mix.decks[0].bpm);assert.deepEqual(a.mix.decks.map(d=>d.bpm),[127.83,127.83]);assert.equal(a.context,null);assert.deepEqual(a.mix.decks.map(d=>d.playing),[false,false]);
 a.tempo(1,126.17);a.tempo(0,a.mix.decks[1].bpm);assert.deepEqual(a.mix.decks.map(d=>d.bpm),[126.17,126.17]);
 a.tempo(1,125.01);near(a.mix.decks[0].bpm,126.17);
});
await check('manual pitch updates actual rate without seeking beat/phrase or changing reference',async()=>{
 const a=new DJAudio(Context,{loadTracks});await a.play(0);a.context.currentTime=2;await a.play(1);a.context.currentTime=5;
 a.tempo(0,129.37);const beats=a.mix.decks.map(d=>beatAt(d,5)),sources=a.context.sources.length,guide=JSON.stringify(a.mix.guide);
 a.tempo(1,a.mix.decks[0].bpm);near(a.mix.decks[1].bpm,129.37);near(a.voices[1].source.playbackRate.value,129.37/a.tracks[1].nativeBpm);
 a.mix.decks.forEach((d,i)=>near(beatAt(d,5),beats[i]));assert.equal(a.context.sources.length,sources);assert.equal(JSON.stringify(a.mix.guide),guide);assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,true]);
 a.tempo(0,130);near(a.mix.decks[1].bpm,129.37);a.tempo(1,129.38);near(a.mix.decks[1].bpm,129.38);await a.dispose();
});
// quick CIはGit LFSの実体を取らないので、ポインタなら記載された実体サイズで確かめる。
const audioSize=url=>{const head=fs.readFileSync(url).subarray(0,200).toString();const m=head.startsWith('version https://git-lfs.github.com/spec/v1')&&head.match(/^size (\d+)$/m);return m?Number(m[1]):fs.statSync(url).size;};
await check('stage metadata and real files',()=>{
 const expected=[[120,.006,'USUAN1100272'],[120,0,'USUAN1700010'],[122,.006,'USUAN1900013'],[122,.006,'USUAN1100852'],[122,.486,'USUAN1900011']];
 assert.equal(Object.keys(TRACKS).length,5);Object.values(TRACKS).forEach((t,i)=>{assert.deepEqual([t.bpm,t.firstBeat,t.isrc],expected[i]);assert(audioSize(new URL('../../assets/audio/dj/'+t.file,import.meta.url))>1e6);});
});
await check('stage mixes and injected detune',()=>{for(const stage of STAGES){const m=createStageMix(stage,1.02);near(m.decks[1].bpm,Math.round(TRACKS[stage.b].bpm*1.02*100)/100);}assert.deepEqual(createStageMix(STAGES[2],1).decks.map(d=>d.bpm),[122,120]);});
await check('signed immediate PLAY feedback thresholds',()=>{for(const [ms,grade] of [[0,'PERFECT'],[29,'PERFECT'],[31,'GOOD'],[59,'GOOD'],[61,'OK'],[119,'OK'],[-150,'EARLY'],[150,'LATE']]){const m=createStageMix(STAGES[0]);playDeck(m,0,0);playDeck(m,1,.5+ms/1000);near(m.lastPlay.errorMs,ms);assert.equal(m.lastPlay.grade,grade);near(m.decks[1].beat,0);}});
await check('score thresholds, perfect mix, missing PLAY and ranks',()=>{const m=createStageMix(STAGES[0]);assert.equal(scoreMix(m,0),null);playDeck(m,0,0);playDeck(m,1,0);assert.equal(scoreMix(m,0).total,100);assert.equal(scoreMix(m,0).rank,'S');for(const [v,points] of [[.1,100],[.10001,85],[.25,85],[.25001,60],[.5,60],[.50001,30]]){m.decks[1].bpm=120*(1+v/100);assert.equal(scoreMix(m,0).parts[0],points);}for(const [s,a,b] of [[30,60,120],[25,50,100]]){assert.equal(scoreFromErr(s,s,a,b),100);assert.equal(scoreFromErr(s+.001,s,a,b),85);assert.equal(scoreFromErr(a,s,a,b),85);assert.equal(scoreFromErr(a+.001,s,a,b),60);assert.equal(scoreFromErr(b,s,a,b),60);assert.equal(scoreFromErr(b+.001,s,a,b),30);}for(const [v,r] of [[90,'S'],[89,'A'],[75,'A'],[74,'B'],[55,'B'],[54,'C']])assert.equal(rankFromScore(v),r);});
await check('millisecond nudge uses current tempo',async()=>{const a=new DJAudio(Context,{loadTracks});await a.play(1);const before=beatAt(a.mix.decks[1],a.now);a.nudgeMs(1,10);near(beatAt(a.mix.decks[1],a.now)-before,.01*126/60);await a.dispose();});
await check('deterministic full-song peaks and whole bars',()=>{const pcm=Float32Array.from({length:10000},(_,i)=>Math.sin(i));const a=buildTrackData(pcm,1000,TRACKS.danceMonster),b=buildTrackData(pcm,1000,TRACKS.danceMonster);assert.deepEqual(a,b);assert.equal(a.peaks.length,8192);assert.equal(a.beats%4,0);assert.equal(a.beats,16);assert.equal(fullPeakAt(a,-1),a.peaks[0]);assert.equal(fullPeakAt(a,100),a.peaks.at(-1));});
await check('SYNC API removed',()=>assert.equal(new DJAudio(Context,{loadTracks}).syncBpm,undefined));
await check('stage audio loader preserves first beat, whole-song loop and trim',async()=>{
 const loadTracks=async c=>[TRACKS.risingTide,TRACKS.danceMonster].map(cfg=>({...buildTrackData(new Float32Array(80000),8000,cfg),buffer:c.createBuffer(1,80000,8000),trimDb:cfg.trimDb}));
 const a=new DJAudio(Context,{stageIndex:2,detuneFactor:1,loadTracks});await a.play(0);await a.play(1);
 near(a.voices[0].source.started.offset,.486);near(a.voices[1].source.started.offset,.006);
 near(a.voices[0].source.loopStart,.486);near(a.voices[0].source.loopEnd,.486+a.tracks[0].beats*60/122);
 near(a.voices[0].gain.gain.value,10**(5/20));assert.deepEqual(a.mix.decks.map(d=>d.bpm),[122,120]);await a.dispose();
});
await check('pause while track loading prevents late PLAY',async()=>{
 let finish;const a=new DJAudio(Context,{stageIndex:0,detuneFactor:1,loadTracks:c=>new Promise(r=>finish=()=>r([0,1].map(id=>({...renderTrack(id,c.sampleRate),firstBeat:0,beats:32}))))});
 const pending=a.play(0);await a.pause();finish();assert.equal(await pending,false);assert.equal(a.context.sources.length,0);await a.dispose();
});
console.log(`DJ revision: ${groups} current controlled groups PASS; real browser/listening/capture NOT RUN.`);
