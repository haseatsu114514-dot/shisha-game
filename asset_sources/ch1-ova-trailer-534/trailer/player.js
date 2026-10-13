import { spec } from "./timeline.js";
import { createScore } from "./score.js";

const $ = id => document.getElementById(id);
const canvas=$("canvas"), ctx=canvas.getContext("2d",{alpha:false}), images=new Map();
const score=createScore(), reducedMotion=matchMedia("(prefers-reduced-motion: reduce)").matches;
if(new URLSearchParams(location.search).has("cinema"))document.body.classList.add("cinema");
let ready=false, phase="loading", offset=0, epoch=0, muted=false, operation=0, lastCut="";
const clamp = x => Math.max(0,Math.min(1,x));
const smooth = x => {x=clamp(x);return x*x*(3-2*x);};
const at = () => phase==="playing" ? Math.min(spec.duration,offset+(performance.now()-epoch)/1000) : offset;
const font = size => size+'px "OvaDot"';
const captionBoxes=[];
function text(line,x,y,size,align="left",color="#f0ede4") {
  ctx.font=font(size);ctx.textAlign=align;ctx.fillStyle=color;
  ctx.shadowColor="rgba(0,0,0,.9)";ctx.shadowBlur=5;ctx.shadowOffsetY=2;
  ctx.fillText(line,x,y);
  const metrics=ctx.measureText(line),w=metrics.width;
  const left=align==="right"?x-w:align==="center"?x-w/2:x;
  captionBoxes.push({text:line,left,right:left+w,top:y-size,bottom:y+5});
  ctx.shadowBlur=0;ctx.shadowOffsetY=0;
}
function render(time,{still=false,noFade=false}={}) {
  const t=Math.max(0,Math.min(spec.duration-.00001,time));
  const cut=spec.segments.find(s=>t<s.end), local=t-cut.start;
  const progress=smooth(local/cut.duration);
  captionBoxes.length=0;
  ctx.fillStyle="#05070b";ctx.fillRect(0,0,1280,720);
  if(cut.image) {
    const image=images.get(cut.image);
    if(!image)return cut;
    const scale=still||reducedMotion||cut.move==="hold"?1:cut.move==="out"?1.025-progress*.025:1+progress*.025;
    const focus=cut.id==="city-night"?[.6,.5]:[.6,.38];
    ctx.drawImage(image,-(1280*scale-1280)*focus[0],-(720*scale-720)*focus[1],1280*scale,720*scale);
    if(cut.text) {
      ctx.save();ctx.globalAlpha=smooth((local-.35)/.5);
      // 薄い下端の影のみ。スミの台の中心・手元は覆わない。
      const g=ctx.createLinearGradient(0,590,0,720);g.addColorStop(0,"rgba(0,0,0,0)");g.addColorStop(1,"rgba(0,0,0,.47)");
      ctx.fillStyle=g;ctx.fillRect(0,590,1280,130);
      const lines=cut.text.split("\n"),align=cut.anchor==="right"?"right":"left",x=align==="right"?1226:54;
      const top=lines.length>1?615:658;
      if(cut.speaker)text(cut.speaker,x,top-41,22,align,"#e4c88c");
      lines.forEach((line,i)=>text(line,x,top+i*43,32,align));
      ctx.restore();
    }
  } else if(cut.kind==="quote") {
    ctx.save();ctx.globalAlpha=smooth(local/.3);
    text(cut.text,640,372,32,"center");
    ctx.restore();
  } else if(cut.kind==="title") {
    ctx.save();ctx.globalAlpha=smooth(local/.45);
    text(spec.chapter.label,640,246,29,"center","#d0b887");
    text(spec.chapter.title,640,367,76,"center");
    ctx.fillStyle="#b69561";ctx.fillRect(565,414,150,1);
    text(spec.chapter.subtitle,640,474,29,"center","#d8c8ab");
    text("水煙前線 -EN:CODE-",640,578,23,"center","#9297a1");
    ctx.restore();
  }
  if(!noFade) {
    const fade=Math.max(1-smooth(local/.22),1-smooth((cut.duration-local)/.22));
    ctx.fillStyle="rgba(5,7,11,"+fade+")";ctx.fillRect(0,0,1280,720);
  }
  $("screen").dataset.cut=cut.id;$("screen").dataset.elapsed=String(Math.round(t*1000));
  if(cut.id!==lastCut) {
    $("caption").textContent=cut.kind==="title"?spec.chapter.label+" "+spec.chapter.title:(cut.speaker?cut.speaker+"：":"")+cut.text;
    canvas.setAttribute("aria-label",cut.kind==="title"?spec.chapter.title:cut.text||"顔を伏せたライバルの気配");
    lastCut=cut.id;
  }
  return cut;
}
function controls() {
  $("screen").dataset.phase=phase;
  $("intro").hidden=phase!=="ready";
  $("end").hidden=phase!=="ended";
  $("pause").disabled=!["playing","paused"].includes(phase);
  $("pause").textContent=phase==="paused"?"再生":"一時停止";
  $("seek").disabled=!ready;$("restart").disabled=!ready;
  const t=at();$("seek").value=t;
  const whole=Math.floor(t);$("time").textContent="0:"+String(whole).padStart(2,"0")+" / 0:40";
}
async function play(from=at()) {
  if(!ready)return;
  const ticket=++operation;
  offset=Math.max(0,Math.min(spec.duration,from));
  if(offset>=spec.duration)offset=0;
  $("start").disabled=true;$("replay").disabled=true;
  try { await score.play(offset); } catch { /* 音声が使えなくても映像は進む。 */ }
  if(ticket!==operation)return;
  epoch=performance.now();phase="playing";controls();
  $("start").disabled=false;$("replay").disabled=false;
}
function pause() {
  if(phase!=="playing")return;
  offset=at();operation++;score.pause();phase="paused";render(offset);controls();
}
function seek(to) {
  if(!ready)return;
  const wasPlaying=phase==="playing";pause();
  offset=Math.max(0,Math.min(spec.duration,to));
  if(wasPlaying && offset<spec.duration){void play(offset);return;}
  phase=offset>=spec.duration?"ended":"paused";render(offset,{noFade:true});controls();
}
function toggleMute() {
  muted=!muted;score.mute(muted);
  $("mute").textContent=muted?"音なし":"音あり";
  $("mute").setAttribute("aria-pressed",String(muted));
}
$("start").onclick=()=>void play(0);
$("replay").onclick=()=>void play(0);
$("restart").onclick=()=>void play(0);
$("pause").onclick=()=>phase==="playing"?pause():void play();
$("mute").onclick=toggleMute;
$("seek").addEventListener("change",()=>seek(Number($("seek").value)));
addEventListener("keydown",event=>{
  if(event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement)return;
  if(event.code==="Space"){event.preventDefault();phase==="playing"?pause():void play(phase==="ended"?0:at());}
  if(event.code==="ArrowLeft"||event.code==="ArrowRight"){event.preventDefault();seek(at()+(event.code==="ArrowLeft"?-5:5));}
  if(event.code==="KeyM")toggleMute();
});
document.addEventListener("visibilitychange",()=>{if(document.hidden)pause();});
window.trailerReady=Promise.all([
  document.fonts.load('32px "OvaDot"',"煙がつなぐ街").then(faces=>{if(!faces.length)throw Error("Trailer font missing");}),
  ...[...new Set(spec.segments.map(s=>s.image).filter(Boolean))].map(id=>new Promise((resolve,reject)=>{
    const image=new Image();image.onload=async()=>{try{await image.decode();images.set(id,image);resolve();}catch(e){reject(e);}};
    image.onerror=()=>reject(Error("Missing image: "+id));image.src="art/"+id+".webp";
  })),
]).then(()=>{ready=true;phase="ready";$("start").textContent="予告を再生";$("start").disabled=false;render(1,{still:true,noFade:true});controls();})
  .catch(error=>{phase="error";$("intro").hidden=true;$("error").hidden=false;console.error(error);throw error;});
function tick() {
  if(phase==="playing") {
    const t=at();render(t);controls();
    if(t>=spec.duration){offset=spec.duration;operation++;score.pause();phase="ended";controls();$("replay").focus({preventScroll:true});}
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
// 録画・検品用の読み取り口。セーブ・既読・報酬には触れない。
window.getTrailerState=()=>({ready,phase,time:at(),cut:$("screen").dataset.cut,muted,reducedMotion,images:[...images.keys()],audio:score.state,captionBoxes:[...captionBoxes]});
window.renderTrailerFrame=render;
window.seekTrailer=seek;
window.TRAILER_SPEC=spec;
