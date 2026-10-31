import { DJAudio } from './audio.mjs';
import { beatAt, lowCutDb, LOW_CUT_DB, updateMix, phaseError, phraseError, mod, dancerPose, scoreMix } from './model.mjs';
import { peakAt } from './tracks.mjs';
import { TRACKS, STAGES } from './tracks.mjs';
const $=id=>document.getElementById(id);
let stage=0,score=null,audio=new DJAudio();
function bindInterruption(){audio.onInterrupted=()=>status('音声が中断されました。PLAYで再開してください。');}
function stageDisplay(){[STAGES[stage].a,STAGES[stage].b].forEach((key,id)=>$('track-'+(id?'b':'a')).textContent=TRACKS[key].title);}
stageDisplay();
document.querySelectorAll('.stage-btn').forEach((b,index)=>b.addEventListener('click',async()=>{
 document.querySelectorAll('.stage-btn').forEach(b=>b.disabled=true);
 try{await audio.dispose();stage=index;score=null;audio=new DJAudio(undefined,{stageIndex:stage});bindInterruption();stageDisplay();$('score-result').textContent='';$('play-feedback').textContent='';await audio.play(0);}
 catch(e){status(e.message);}finally{document.querySelectorAll('.stage-btn').forEach(b=>b.disabled=false);}
}));
function judge(){if(!audio.mix.decks.every(d=>d.playing))return;score=scoreMix(audio.mix,audio.now);if(!score)return;
 $('score-result').innerHTML=`<strong class="rank">${score.rank}</strong><table><tr><th>ピッチ誤差</th><td>${score.pitchErrPct.toFixed(3)}%</td></tr><tr><th>PLAYずれ</th><td>${score.playMs.toFixed(1)} ms</td></tr><tr><th>位相ドリフト</th><td>${score.driftMs.toFixed(1)} ms</td></tr><tr><th>合計</th><td>${score.total}点</td></tr></table><p>${{S:'完璧なミックス！',A:'いいつなぎ！',B:'あと少し、位相を合わせよう',C:'ピッチとPLAYをもう一度練習しよう'}[score.rank]}</p>`;
}
$('judge').addEventListener('click',judge);
document.querySelectorAll('[data-nudge-ms]').forEach(b=>b.addEventListener('click',()=>audio.nudgeMs(1,Number(b.dataset.nudgeMs))));
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let disposed=false,frame=0,frameView={mode:'idle'},message='';
const status=text=>{$('status').textContent=text;};
export function snapshot(){
 const now=audio.now;
 return {stage,lastPlay:audio.mix.lastPlay||null,score,clock:now,state:audio.context?.state||'not-started',running:audio.mix.running,
  bpms:audio.mix.decks.map(d=>d.bpm),beats:audio.mix.decks.map(d=>beatAt(d,now)),playing:audio.mix.decks.map(d=>d.playing),
  phase:phaseError(...audio.mix.decks,now),phraseOffset:phraseError(...audio.mix.decks,now),mix:audio.mix.mix,
  master:audio.mix.master,visualMaster:audio.mix.visualMaster,mode:frameView.mode,
  guide:audio.mix.guide?{...audio.mix.guide}:null,voices:audio.voices.filter(Boolean).length,retiring:audio.retiring.size,
  rms:audio.level(),reduced:reduced.matches};
}
audio.onInterrupted=()=>status('音声が中断されました。全体再開または各PLAYで再開できます。自動再開はしません。');
async function pause(){try{await audio.pause();status('全体停止。全体再開は直前に鳴っていたデッキだけを戻します。');}catch(e){status(`停止処理: ${e.message}。音声nodeは切断済みです。`);}}
for(const id of [0,1]){
 const key=id?'b':'a';
 $('tempo-'+key).addEventListener('input',e=>audio.tempo(id,Number(e.target.value)));
 $('play-'+key).addEventListener('click',async()=>{
  try{if(audio.mix.decks[id].playing){audio.pauseDeck(id);status(`${key.toUpperCase()} PAUSE。位置を保ちます。`);}
   else if(await audio.play(id)){if(document.hidden){await pause();return;}status(`${key.toUpperCase()} PLAY。押した時点の音声時計で開始。拍の位置は押したタイミングで決まります。`);}}
  catch(e){status(`${e.message}。PLAYから再試行できます。`);}
 });
}
// Jog outer rim = fine pitch (replaces the ±0.01 BPM buttons). Same audio.tempo call the buttons used; 12° of rim travel = 0.01 BPM.
const JOG_STEP_DEG=12,JOG_INNER=.42;
function finePitch(id,steps){const bpm=audio.mix.decks[id].bpm,next=Math.max(110,Math.min(140,Math.round((bpm+steps*.01)*100)/100));if(next!==bpm)audio.tempo(id,next);return next!==bpm;}
for(const id of [0,1]){
 const jog=$('platter-'+(id?'b':'a'));let drag=null,spin=0;
 const angle=(e,r)=>Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))*180/Math.PI;
 jog.addEventListener('pointerdown',e=>{const r=jog.getBoundingClientRect(),dist=Math.hypot(e.clientX-(r.left+r.width/2),e.clientY-(r.top+r.height/2))/(r.width/2);
  if(dist<JOG_INNER||dist>1.05)return;e.preventDefault();jog.setPointerCapture(e.pointerId);drag={last:angle(e,r),acc:0};jog.classList.add('touching');});
 jog.addEventListener('pointermove',e=>{if(!drag)return;const r=jog.getBoundingClientRect(),a=angle(e,r);let d=a-drag.last;if(d>180)d-=360;if(d<-180)d+=360;drag.last=a;drag.acc+=d;spin+=d;
  jog.style.setProperty('--spin',`${spin}deg`);const steps=Math.trunc(drag.acc/JOG_STEP_DEG);if(steps){drag.acc-=steps*JOG_STEP_DEG;if(finePitch(id,steps)){jog.classList.add('tick');setTimeout(()=>jog.classList.remove('tick'),90);if(matchMedia('(pointer: coarse)').matches)navigator.vibrate?.(3);}}});
 const end=()=>{drag=null;jog.classList.remove('touching');};jog.addEventListener('pointerup',end);jog.addEventListener('pointercancel',end);
 jog.addEventListener('keydown',e=>{const k={ArrowRight:1,ArrowUp:1,ArrowLeft:-1,ArrowDown:-1}[e.key];if(!k)return;e.preventDefault();if(finePitch(id,k)){spin+=k*JOG_STEP_DEG;jog.style.setProperty('--spin',`${spin}deg`);}});
}
$('volume').addEventListener('input',e=>audio.setVolume(e.target.value));
$('crossfader').addEventListener('input',e=>audio.setMix(e.target.value));
document.querySelectorAll('[data-nudge]').forEach(button=>button.addEventListener('click',()=>{const[id,beats]=button.dataset.nudge.split(',').map(Number);audio.nudge(id,beats);}));
$('offset').addEventListener('click',()=>{if(audio.nudge(1,.5))status('再生中のBを実際に半拍進めました。微調整で戻せます。');});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
window.addEventListener('pagehide',event=>{if(event.persisted){pause();return;}disposed=true;cancelAnimationFrame(frame);audio.dispose().catch(()=>{});});

function wave(canvas, id, now) {
  const c = canvas.getContext('2d'), w = canvas.width, h = canvas.height, x0 = Math.round(w * .32), scale = w / 7;
  c.clearRect(0, 0, w, h); if (!audio.tracks) return;
  const d = audio.mix.decks[id], b = beatAt(d, now), t = audio.tracks[id];
  c.fillStyle = id ? '#7fdcf0' : '#c39bff';
  for (let x = 0; x < w; x += 2) {
    const beat = b + ((x - x0) / scale) * d.bpm / 60;
    const peak = peakAt(t, t.firstBeat + mod(b, t.beats)*60/t.nativeBpm + (beat-b)*60/t.nativeBpm);
    const size = peak * (h - 8); c.globalAlpha = .75; c.fillRect(x, h / 2 - size / 2, 2, Math.max(1, size));
  }
  c.globalAlpha = 1;
  const first = Math.floor(b - x0 / scale * d.bpm / 60);
  for (let n = first; n < b + (w - x0) / scale * d.bpm / 60; n++) {
    const x = x0 + (n - b) * 60 / d.bpm * scale;
    c.fillStyle = mod(n, 32) === 0 ? '#aee7d5' : mod(n, 4) === 0 ? '#e7d8dd' : '#60545e'; c.fillRect(x, 0, mod(n,32)===0?2:1, h);
    if (mod(n, 4) === 0) { c.font = '10px monospace'; c.fillText(`${Math.floor(mod(n, 32) / 4) + 1}`, x + 3, 11); }
  }
  const guide=audio.mix.guide;
  if(guide?.from===id){const x=x0+(guide.start-b)*60/d.bpm*scale;if(x>=0&&x<w){c.fillStyle='#aee7d5';c.fillRect(x,0,2,h);c.font='10px monospace';c.fillText('NEXT HEAD',Math.min(w-75,x+4),h-5);}}
  c.fillStyle = '#fff'; c.fillRect(x0, 0, 2, h);
}
function drawVJ(beat,energy){
 const c=$('vj').getContext('2d');c.imageSmoothingEnabled=false;c.clearRect(0,0,160,112);
 const pulse=reduced.matches ? .035 : .035+Math.min(.05,energy*.25);c.fillStyle=`rgba(150,92,240,${pulse})`;
 for(let i=0;i<5;i++)c.fillRect(5+i*33,32,16,70);
 const phase=mod(beat,32),dancing=audio.mix.running&&!reduced.matches&&phase<4;
 const character=audio.mix.running&&!reduced.matches&&phase>=28;
 const block=(x,y,w,h,color)=>{c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),w,h);};
 const limb=(x,y,xx,yy,color)=>{const steps=Math.max(1,Math.ceil(Math.max(Math.abs(xx-x),Math.abs(yy-y))/2));for(let i=0;i<=steps;i++)block(x+(xx-x)*i/steps,y+(yy-y)*i/steps,4,4,color);};
 if(dancing){
  const p=dancerPose(beat),u=2,cx=80+Math.round(p.hip)*u,cy=36+Math.round(p.bob)*u;
  block(cx-6,cy-16,12,12,'#efb8a0');block(cx-8,cy-18,16,6,'#211926');block(cx-8,cy,16,18,'#9b5cf0');block(cx-2,cy+2,4,14,'#d9a6ff');
  limb(cx-8,cy+2,cx-18,cy+12+Math.round(p.arm)*u,'#b47cf5');limb(cx+6,cy+2,cx+16,cy+12-Math.round(p.arm)*u,'#b47cf5');
  const lx=66-Math.round(p.left)*u,rx=86+Math.round(p.right)*u,ly=94-Math.round(p.left)*u,ry=94-Math.round(p.right)*u;
  limb(cx-6,cy+18,lx+4,ly-2,'#49374f');limb(cx+4,cy+18,rx+2,ry-2,'#49374f');block(lx,ly,10,4,'#e4c9ca');block(rx,ry,10,4,'#e4c9ca');
 }else if(character){
  // Original geometric bust only: not a borrowed character/portrait or adopted new cast.
  block(60,19,40,43,'#8e5cc9');block(70,25,22,27,'#efbdad');block(66,19,34,10,'#c49af0');block(56,62,49,33,'#6f46a8');block(77,56,8,27,'#e0b66e');
  block(42,24,4,4,'#e0b66e');block(113,38,4,4,'#e0b66e');
 }
 block(0,102,160,1,'#7a5aa8');
 $('visual-label').textContent=reduced.matches?'低減表示・静止VJ':dancing?'4拍の仮ドット・自動演出':character?'華やかな仮シルエット（案）':'背景VJのみ・操作不要';
}
function render(){
 if(disposed)return;const now=audio.now;
 const oldGuide=audio.mix.guide;
 const completed=oldGuide && audio.mix.decks.every(d=>d.playing) && beatAt(audio.mix.decks[oldGuide.from],now)>=oldGuide.end;
 frameView=updateMix(audio.mix,now);
 if(!score && (completed || frameView.progress>=1))judge();
 $('judge').disabled=!audio.mix.decks.every(d=>d.playing)||!audio.mix.lastPlay;
 if(audio.mix.lastPlay){const p=audio.mix.lastPlay;$('play-feedback').textContent=`PLAY: ${p.grade}!（拍から ${p.errorMs>=0?'+':''}${p.errorMs.toFixed(0)}ms）`;$('play-feedback').dataset.grade=p.grade;}
 document.querySelectorAll('[data-nudge-ms]').forEach(b=>b.disabled=!audio.mix.decks[1].playing);
 const both=audio.mix.decks.every(d=>d.playing),guide=audio.mix.guide;
 for(const id of [0,1]){
  const key=id?'b':'a',d=audio.mix.decks[id],beat=mod(beatAt(d,now),32),play=$('play-'+key);
  $('bpm-'+key).value=d.bpm.toFixed(2);$('tempo-'+key).value=String(d.bpm);
  $('beat-'+key).textContent=`${d.playing?'再生':'停止'}・${Math.floor(beat/4)+1}小節 ${Math.floor(beat%4)+1}拍`;
  play.textContent=d.playing?'Ⅱ':'▶';play.setAttribute('aria-label',`${key.toUpperCase()}を${d.playing?'一時停止':'再生'}`);play.setAttribute('aria-pressed',String(d.playing));play.disabled=audio.busy;
  $('deck-'+key).dataset.playing=String(d.playing);
  $('indicator-'+key).textContent=d.playing?'ON AIR':'STANDBY';
  $('platter-'+key).style.setProperty('--rotation',`${reduced.matches?0:mod(beatAt(d,now),4)*90}deg`);
  wave($('wave-'+key),id,now);
 }
 document.querySelectorAll('[data-nudge]').forEach(b=>{b.disabled=!audio.mix.decks[Number(b.dataset.nudge.split(',')[0])].playing;});
 for(const key of ['a','b'])$('platter-'+key).setAttribute('aria-valuenow',$('bpm-'+key).value);
 $('offset').disabled=!audio.mix.decks[1].playing;
 $('mix-value').textContent=`A ${Math.round((1-audio.mix.mix)*100)} / B ${Math.round(audio.mix.mix*100)}%`;
 $('phase').textContent=`共通7秒 / BPM差 ${(audio.mix.decks[1].bpm-audio.mix.decks[0].bpm).toFixed(2)} / ${both?`B−A拍位相 ${phaseError(...audio.mix.decks,now).toFixed(3)} / ${(phaseError(...audio.mix.decks,now)*60000/audio.mix.decks[0].bpm).toFixed(1)} ms・フレーズ差 ${phraseError(...audio.mix.decks,now).toFixed(2)}拍`:'各PLAYを押すまで、そのデッキの波形は停止'}`;
 $('master').textContent=`VJ基準 ${audio.mix.visualMaster?'B':'A'}（音声時計）`;
 $('phrase').value=frameView.mode==='mix'?frameView.progress:0;
 const target=guide?.to?'B':'A';let text;
 if(frameView.mode==='idle')text='BPMを合わせて、まずAの▶。';
 else if(frameView.mode==='entry')text=frameView.remaining<=4?`${target}の入りまで ${Math.ceil(frameView.remaining)} 拍。合図で自分でPLAY。`:`次のフレーズ頭まで ${Math.ceil(frameView.remaining/4)}小節。${target}のBPMを合わせてPLAYを準備。`;
 else if(frameView.mode==='waiting-play')text=frameView.elapsed<1?`PLAY ${target}：今がフレーズ頭。押した瞬間に再生します。`:`${target}は停止中。次の頭まで ${Math.ceil(frameView.remaining)}拍。自動で再生しません。`;
 else text=`8小節MIX ${Math.floor(frameView.progress*8)+1}/8：位相を確かめ、横フェーダーを動かそう。ピッチ・PLAY・位相を採点します。`;
 if(text!==message){$('coaching').textContent=text;message=text;}
 controllerLeds();
 drawVJ(beatAt(audio.mix.decks[audio.mix.visualMaster],now),audio.level());frame=requestAnimationFrame(render);
}
render();

// Controller LEDs only (no input/scoring effect): channel meters and the decorative LOW knobs that show the automatic bass cut.
function controllerLeds(){
 const level=Math.min(1,audio.level()*6),g=[Math.cos(audio.mix.mix*Math.PI/2),Math.sin(audio.mix.mix*Math.PI/2)],cut=lowCutDb(audio.mix.mix);
 for(const id of [0,1]){
  const key=id?'b':'a',on=audio.mix.decks[id].playing&&audio.mix.running,c=cut[id]/LOW_CUT_DB;
  $('meter-'+key).style.setProperty('--lvl',on?(level*g[id]).toFixed(3):'0');
  const knob=$('eq-low-'+key);knob.style.setProperty('--k',`${-135*c}deg`);knob.parentElement.style.setProperty('--cut',c.toFixed(2));
 }
 const cutting=cut.findIndex(v=>v<-1);
 $('auto-low').textContent=cutting<0?'LOWは横フェーダーに合わせて自動でカット':`AUTO LOW CUT：${cutting?'B':'A'} ${Math.round(cut[cutting])}dB`;
}
