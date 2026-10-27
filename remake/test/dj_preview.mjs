// Actual prototype modules + deterministic audio clock/WebAudio ports. No real browser/speaker claim.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMix,startMix,pauseMix,beatAt,setTempo,nudgeDeck,syncDeck,phaseError,gains,updateMix,dancerPose} from '../previews/dj/model.mjs';
import {renderTrack,peakAt} from '../previews/dj/synth.mjs';
import {DJAudio} from '../previews/dj/audio.mjs';
let groups=0;async function check(name,fn){await fn();groups++;console.log('PASS '+name);}
const near=(a,b,e=1e-7)=>assert(Math.abs(a-b)<e,`${a} != ${b}`);
await check('source clock tempo reanchor, pause/resume without wall-clock accumulation',()=>{
 const m=createMix();startMix(m,10);near(beatAt(m.decks[0],40),64);setTempo(m.decks[0],120,40);near(beatAt(m.decks[0],55),94);
 pauseMix(m,55);near(beatAt(m.decks[0],5000),94);startMix(m,5000);near(beatAt(m.decks[0],5001),96);
});
await check('initial beginner sync aligns actual target tempo and full phrase',()=>{
 const m=createMix();startMix(m,0);near(m.decks[1].bpm,128);near(phaseError(...m.decks,10),0);near(beatAt(m.decks[0],10),beatAt(m.decks[1],10));assert.equal(m.transition.start,32);assert.equal(m.transition.end,64);
});
await check('manual tempo drift differs from phase nudge and is recoverable',()=>{
 const m=createMix();m.assist=false;startMix(m,0);near(beatAt(m.decks[1],30)-beatAt(m.decks[0],30),-1);
 const old=beatAt(m.decks[1],30);nudgeDeck(m,1,.0625,30);near(beatAt(m.decks[1],30),old+.0625);assert.equal(m.decks[1].bpm,126);
 syncDeck(m,1,30);near(m.decks[1].bpm,128);near(phaseError(...m.decks,31),0);
});
await check('8-bar window, manual fader and next master; no extra tap demand',()=>{
 const m=createMix();startMix(m,0);assert.equal(updateMix(m,14).mode,'queued');assert.equal(updateMix(m,15).mode,'mix');near(updateMix(m,22.5).progress,.5);
 m.mix=1;assert.equal(updateMix(m,30).reached,true);assert.equal(m.master,1);assert.equal(m.visualMaster,1);assert.equal(m.transition.from,1);assert.equal(m.transition.start,96);
});
await check('unfinished transfer is recoverable, not score/loss or forced gain jump',()=>{
 const m=createMix();startMix(m,0);m.mix=.3;assert.equal(updateMix(m,30).reached,false);assert.equal(m.mix,.3);assert.equal(m.master,0);assert(m.transition);
});
await check('equal-power endpoints/center and bounded output',()=>{
 near(gains(0)[0],1);near(gains(1)[1],1);near(gains(.5)[0],Math.SQRT1_2);
 for(let i=0;i<=100;i++){const [a,b]=gains(i/100);near(a*a+b*b,1);assert(a+b<=Math.SQRT2+1e-7);}
});
await check('procedural PCM length/true clock/peaks are finite, deterministic and original',()=>{
 for(const id of [0,1]){const a=renderTrack(id,8000),b=renderTrack(id,8000);assert.equal(a.samples.length,Math.round(32*60/(id?126:128)*8000));near(a.duration*a.nativeBpm/60,32);
  let max=0,energy=0;for(let i=0;i<a.samples.length;i++){assert(Number.isFinite(a.samples[i]));assert.equal(a.samples[i],b.samples[i]);max=Math.max(max,Math.abs(a.samples[i]));energy+=a.samples[i]**2;}
  assert(max>.3&&max<.95);assert(energy/a.samples.length>.001);assert.equal(a.samples[0],0);assert.equal(a.samples.at(-1),0);
  for(let i=0;i<a.peaks.length;i++){let p=0;for(let j=i*a.stride;j<Math.min((i+1)*a.stride,a.samples.length);j++)p=Math.max(p,Math.abs(a.samples[j]));near(a.peaks[i],p,1e-6);}
  near(peakAt(a,.04),peakAt(a,a.duration+.04),1e-7);
 }
});
await check('kick onsets follow BPM rather than display-only constants',()=>{
 const t=renderTrack(0,8000),energyAt=beat=>{const at=Math.round(beat*60/128*8000);return t.samples.slice(at,at+160).reduce((s,v)=>s+v*v,0);};
 assert(energyAt(4)>energyAt(4.7)*3);assert(energyAt(8)>energyAt(8.7)*3);
});
await check('dance has alternating planted feet, four-beat loop and reduced-motion pose',()=>{
 const first=dancerPose(0),last=dancerPose(4);for(const k of Object.keys(first))near(first[k],last[k]);
 for(let b=0;b<=4;b+=.05){const p=dancerPose(b);assert(p.left===0||p.right===0);assert(p.left<=4&&p.right<=4);assert(Number.isFinite(p.hip));}
 const a=dancerPose(.75);assert(a.left>0&&a.right===0);const b=dancerPose(2.75);assert(b.right>0&&b.left===0);assert.deepEqual(dancerPose(2,true),{hip:0,bob:0,left:0,right:0,arm:0});
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
await check('real audio controller builds two sources once; rates/offsets match model',async()=>{
 const a=new DJAudio(Context);await a.start();const c=a.context;assert.equal(c.sources.length,2);await a.start();assert.equal(c.sources.length,2);
 c.currentTime=3;const d=a.mix.decks[1];a.tempo(1,133);near(a.voices[1].source.playbackRate.value,133/a.tracks[1].nativeBpm);
 a.nudge(1,.5);assert.equal(c.sources.length,3);near(a.voices[1].source.started.offset,((beatAt(d,3)%32)+32)%32*60/a.tracks[1].nativeBpm);
 assert(c.sources[1].stopped);a.sync(1);near(phaseError(...a.mix.decks,3),0);assert.equal(a.retiring.size,0);await a.dispose();assert(c.sources.every(s=>s.stopped));assert.equal(c.state,'closed');
});
await check('pause/resume keeps position, disconnects voices and never doubles playback',async()=>{
 const a=new DJAudio(Context);await a.start();const c=a.context;c.currentTime=4;await a.pause();const b=beatAt(a.mix.decks[0],4);assert(a.voices.every(v=>v===null));assert.equal(a.output.gain.value,0);
 c.currentTime=99;await a.start();near(beatAt(a.mix.decks[0],99),b);assert.equal(c.sources.filter(s=>!s.stopped).length,2);await a.dispose();
});
await check('resume failure is explicit and a user retry reuses safe graph',async()=>{
 class Failed extends Context{constructor(){super();this.fail=true;}}
 const a=new DJAudio(Failed);await assert.rejects(a.start(),/audio refused/);assert(!a.mix.running);assert.equal(a.context.sources.length,0);a.context.fail=false;assert(await a.start());assert.equal(a.context.sources.length,2);await a.dispose();
});
await check('suspend failure silences nodes even if hardware clock remains running',async()=>{
 const a=new DJAudio(Context);await a.start();a.context.failSuspend=true;await assert.rejects(a.pause(),/suspend failed/);assert(!a.mix.running);assert.equal(a.output.gain.value,0);assert(a.context.sources.every(s=>s.stopped));await a.dispose();
});
await check('mute before start and interruption freeze/silence without automatic restart',async()=>{
 const a=new DJAudio(Context);a.muted=true;await a.start();assert.equal(a.output.gain.value,0);a.context.currentTime=2;a.context.change('interrupted');assert(!a.mix.running);assert(a.voices.every(v=>v===null));assert(a.context.sources.every(s=>s.stopped));await a.dispose();
});
await check('pending resume cannot restart after pause or duplicate click',async()=>{
 let finish;class Deferred extends Context{async resume(){await new Promise(r=>finish=r);this.change('running');}}
 const a=new DJAudio(Deferred);const pending=a.start();assert.equal(await a.start(),false);await a.pause();finish();assert.equal(await pending,false);assert(!a.mix.running);assert.equal(a.context.sources.length,0);await a.dispose();
});
await check('entry is self-contained and has no game state/storage or remote media dependency',()=>{
 const dir=new URL('../previews/dj/',import.meta.url);for(const name of ['app.mjs','audio.mjs','model.mjs','synth.mjs']){const s=fs.readFileSync(new URL(name,dir),'utf8');assert(!/localStorage|sessionStorage|fetch\(|core\/state|daily\/|https?:\/\//.test(s));}
 const html=fs.readFileSync(new URL('index.html',dir),'utf8');assert(html.includes('wave-a')&&html.includes('wave-b'));assert(html.includes('試験音'));assert(!/https?:\/\/|<audio|<video/.test(html));
});
console.log(`DJ prototype: ${groups} controlled groups PASS; real browser/audio listening/capture NOT RUN.`);
