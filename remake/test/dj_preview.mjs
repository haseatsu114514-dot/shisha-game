// New manual pitch/PLAY contracts. Actual modules + controlled WebAudio; no real browser/listening claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMix,playDeck,pauseDeck,resumeMix,pauseMix,beatAt,setTempo,nudgeDeck,phaseError,phraseError,gains,guideNext,updateMix,dancerPose} from '../previews/dj/model.mjs';
import {renderTrack,peakAt} from '../previews/dj/synth.mjs';
import {DJAudio} from '../previews/dj/audio.mjs';
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
 const a=new DJAudio(Context);await a.start();assert.equal(a.context.sources.length,0);assert(!a.mix.running);assert.equal(a.output.gain.value,0);
 a.tempo(1,127.3);await a.play(0);assert.equal(a.context.sources.length,1);assert(!a.mix.decks[1].playing);const c=a.context;c.currentTime=4.23;await a.play(1);assert.equal(c.sources.length,2);near(a.voices[1].source.started.t,4.23);near(a.voices[1].source.started.offset,0);near(a.voices[1].source.playbackRate.value,127.3/a.tracks[1].nativeBpm);assert.equal(a.mix.decks[1].bpm,127.3);assert.equal(await a.play(1),false);assert.equal(c.sources.length,2);await a.dispose();
});
await check('fader/guide/prepare/PLAY do not replace manual tempo in actual audio params',async()=>{
 const a=new DJAudio(Context);a.tempo(1,129.1);await a.start();await a.play(0);a.context.currentTime=3;await a.play(1);
 const before=JSON.stringify(a.mix.decks),rate=a.voices[1].source.playbackRate.value;for(const x of [0,.3,.8,1]){a.setMix(x);updateMix(a.mix,a.now);guideNext(a.mix,a.now);}await a.start();assert.equal(JSON.stringify(a.mix.decks),before);near(a.voices[1].source.playbackRate.value,rate);assert.equal(a.context.sources.length,2);await a.dispose();
});
await check('actual phase correction seeks audio, never starts a stopped deck',async()=>{
 const a=new DJAudio(Context);await a.start();assert.equal(a.nudge(1,.5),false);assert.equal(a.context.sources.length,0);await a.play(1);a.context.currentTime=2;const old=beatAt(a.mix.decks[1],2);a.nudge(1,.5);near(a.voices[1].source.started.offset,((old+.5)%32)*60/a.tracks[1].nativeBpm);near(a.voices[1].source.playbackRate.value,126/a.tracks[1].nativeBpm);assert.equal(a.context.sources.filter(s=>!s.stopped).length,1);await a.dispose();
});
await check('pause/resume freezes beats and preserves independent active-deck ownership',async()=>{
 const a=new DJAudio(Context);await a.play(0);const c=a.context;c.currentTime=4;await a.pause();const beat=a.mix.decks[0].beat;c.currentTime=90;await a.start();near(beatAt(a.mix.decks[0],90),beat);assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);assert.equal(c.sources.filter(s=>!s.stopped).length,1);a.pauseDeck(0);assert(!a.mix.running);await a.start();assert.equal(c.sources.filter(s=>!s.stopped).length,0);await a.dispose();
});
await check('failed manual PLAY can be retried without auto-starting the other deck',async()=>{
 class Failed extends Context{constructor(){super();this.fail=true;}}
 const a=new DJAudio(Failed);a.tempo(1,127.7);await assert.rejects(a.play(1),/audio refused/);assert(!a.mix.running);assert.equal(a.context.sources.length,0);a.context.fail=false;assert(await a.play(1));assert.deepEqual(a.mix.decks.map(d=>d.playing),[false,true]);near(a.mix.decks[1].bpm,127.7);await a.dispose();
});
await check('mute start and suspend failure silence every active voice',async()=>{
 const a=new DJAudio(Context);a.muted=true;await a.play(0);assert.equal(a.output.gain.value,0);a.context.failSuspend=true;await assert.rejects(a.pause(),/suspend failed/);assert(!a.mix.running);assert(a.context.sources.every(s=>s.stopped));assert.equal(a.output.gain.value,0);await a.dispose();
});
await check('interruption is a pause, not auto resumption or pitch matching',async()=>{
 const a=new DJAudio(Context);a.tempo(1,127.2);await a.play(0);a.context.currentTime=2;a.context.change('interrupted');assert(!a.mix.running);assert.equal(a.voices.filter(Boolean).length,0);assert.deepEqual(a.mix.resumeDecks,[0]);await a.start();assert.deepEqual(a.mix.decks.map(d=>d.playing),[true,false]);near(a.mix.decks[1].bpm,127.2);await a.dispose();
});
await check('pause during pending PLAY cancels sound; duplicate request is not queued',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);this.change('running');}}
 const a=new DJAudio(Deferred);const p=a.play(0);assert.equal(await a.play(1),false);await a.pause();finish();assert.equal(await p,false);assert(!a.mix.running);assert.equal(a.context.sources.length,0);await a.dispose();
});
await check('dispose during pending PLAY prevents late sources and leaves no nodes',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);if(this.state==='closed')throw Error('closed');this.change('running');}}
 const a=new DJAudio(Deferred);const p=a.play(1);await a.dispose();finish();await assert.rejects(p,/closed/);assert.equal(a.context.sources.length,0);assert(a.disposed);assert(!a.mix.running);
});
await check('entry has individual PLAY and no hidden sync/auto blend or game SAVE',()=>{
 const dir=new URL('../previews/dj/',import.meta.url);for(const name of ['app.mjs','audio.mjs','model.mjs','synth.mjs']){const s=fs.readFileSync(new URL(name,dir),'utf8');assert(!/localStorage|sessionStorage|fetch\(|core\/state|daily\/|https?:\/\//.test(s));if(name!=='synth.mjs')assert(!/syncDeck|queueMix|\.sync\(|assist|reconcile|reached/.test(s));}
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');assert(html.includes('play-a')&&html.includes('play-b'));assert(!/data-sync|id="assist"|id="tap"/.test(html));assert(html.includes('wave-a')&&html.includes('wave-b'));assert(html.includes('試験音'));
});
console.log(`DJ manual revision: ${groups} current controlled groups PASS; real browser/listening/capture NOT RUN.`);
