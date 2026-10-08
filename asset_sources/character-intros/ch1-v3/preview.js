const records = window.INTRO_CHARACTERS || await fetch("characters.json").then(r => r.json());
const query = new URLSearchParams(location.search);
const stage = document.querySelector("#stage"), portrait = document.querySelector("#portrait");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let current = 0, animations = [], paused = false, looping = false, loopTimer, renderToken = 0;
let backgroundStyle = query.get("style") === "geometric" ? "geometric" : "illustrated";
if(query.has("video")) document.body.classList.add("video-only");

import { motifs } from "./motifs.js";
function fitStage(){
 const available = innerHeight - (document.body.classList.contains("video-only") ? 0 : document.querySelector("#controls").offsetHeight);
 const scale = Math.min(innerWidth / 1280, available / 720);
 stage.style.transform = "translate(" + ((innerWidth - 1280 * scale) / 2) + "px," + ((available - 720 * scale) / 2) + "px) scale(" + scale + ")";
}
function animate(selector, frames, options){
 const a = document.querySelector(selector).animate(frames, {duration:600,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both",...options});
 animations.push(a); return a;
}
function startAnimation(){
 animations.forEach(a => a.cancel()); animations = []; paused = false;
 document.querySelector("#pause").textContent = "一時停止";
 document.querySelector("#pause").setAttribute("aria-pressed", "false");
 if(reducedMotion.matches) return;
 const id = records[current].id;
 if(stage.classList.contains("has-art-background")) animate("#art-background",[{opacity:0,transform:"scale(1.035)"},{opacity:1,transform:"none"}],{duration:700,delay:0});
 animate(".left-field", [{clipPath:"polygon(0 0,0 0,0 720px,0 720px)"},{clipPath:"polygon(0 0,535px 0,438px 720px,0 720px)"}], {duration:450});
 animate(".halftone", [{opacity:0},{opacity:id === "dr_kemuri" ? .7 : .18}], {duration:450,delay:100});
 animate(".ribbon", [{transform:"translateX(1480px) rotate(4deg)"},{transform:"translateX(0) rotate(4deg)"}], {duration:id === "adam" ? 340 : 480,delay:130});
 animate(".accent-line", [{transform:"translateX(-1480px) rotate(4deg)"},{transform:"translateX(0) rotate(4deg)"}], {duration:510,delay:180});
 const portraitFrames = ["kafuka","pakki"].includes(id) ? [{opacity:0,transform:"translate(-100px,20px)"},{opacity:1,transform:"translate(5px,-4px)",offset:.8},{opacity:1,transform:"none"}] : [{opacity:0,transform:"translateX(-130px)"},{opacity:1,transform:"none"}];
 animate("#portrait",portraitFrames,{duration:id === "adam" ? 430 : 620,delay:160});
 animate(".motif",[{opacity:0,transform:id === "naru" ? "translateX(100px)" : "scale(1.06)"},{opacity:1,transform:"none"}],{duration:1000,delay:80});
 animate(".floor-lines",[{opacity:0},{opacity:.68}],{duration:650,delay:350});
 for(const [selector, delay] of [["#title",470],[".name-line",510],[".quote-area",810]]) animate(selector,[{opacity:0,transform:"translateX(30px)"},{opacity:1,transform:"none"}],{duration:440,delay});
}
async function showCharacter(id,{play=true}={}){
 const token = ++renderToken, idx = records.findIndex(c => c.id === id);
 current = idx < 0 ? 0 : idx; const c = records[current];
 window.previewReady = false; animations.forEach(a => a.cancel()); animations = [];
 stage.dataset.character = c.id;
 for(const [key, value] of Object.entries({accent:c.color,secondary:c.secondary,"portrait-bg":c.shadow,"portrait-width":c.frame.width+"px","portrait-left":c.frame.left+"px","portrait-top":c.frame.top+"px"})) stage.style.setProperty("--"+key,value);
 document.querySelector("#motif").innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">' + motifs[c.motif] + "</svg>";
 for(const [key, text] of Object.entries({title:c.title,name:c.name,full:c.full ? "（"+c.full+"）" : "",quote:"「"+c.line+"」"})) document.getElementById(key).textContent = text;
 portrait.src = c.portrait.startsWith("data:") ? c.portrait : "../../../"+c.portrait;
 portrait.alt = c.name;
 const art = document.querySelector("#art-background");
 const bg = c.backgrounds?.[backgroundStyle] || c.backgrounds?.geometric;
 art.hidden = !bg;
 stage.classList.toggle("has-art-background",!!bg);
 if(bg) art.src = bg.src.startsWith("data:") ? bg.src : "../../../"+bg.src;
 const styleButton=document.querySelector("#background-style");
 styleButton.disabled=!c.backgrounds?.illustrated;
 styleButton.textContent=bg&&backgroundStyle === "illustrated" ? "背景：イラスト" : "背景：幾何学";
 styleButton.setAttribute("aria-pressed",String(!!bg&&backgroundStyle === "illustrated"));
 await Promise.all([document.fonts.ready,portrait.decode(),bg ? art.decode() : Promise.resolve()]); if(token !== renderToken) return;
 // Measure the final transformed glyph rectangle, not the uncondensed em width.
 stage.style.transform = "none";
 const name = document.querySelector("#name"), group = document.querySelector(".name-group"), wrap = document.querySelector(".name-wrap");
 let size = 150; name.style.fontSize = size+"px";
 const nameWidth=()=>name.offsetWidth*.86+(c.full?name.offsetHeight*.09:0);
 wrap.style.width = nameWidth()+"px";
 while(group.offsetWidth > 596 && size > 60){
  name.style.fontSize = (--size)+"px";wrap.style.width = nameWidth()+"px";
 }
 for(const [selector, initial, min, max] of [["#title",28,20,580]]){
  const el = document.querySelector(selector); let s = initial; el.style.fontSize = s+"px";
  while(el.scrollWidth > max && s > min) el.style.fontSize = (--s)+"px";
 }
 // Keep the quote large; wrap naturally into at most two lines instead of shrinking.
 const quote=document.querySelector('#quote');quote.style.fontSize='38px';
 const preferredBreak={adam:c.line.indexOf('。')+1,minto:c.line.indexOf(' ')+1,sumi:c.line.indexOf('、')+1,naru:c.line.indexOf('全部'),pakki:c.line.indexOf(' ')+1,ageha_unknown:c.line.indexOf(' ')+1}[c.id];
 if(quote.offsetHeight>parseFloat(getComputedStyle(quote).lineHeight)+1&&preferredBreak>0){
  const first=document.createElement('span'),second=document.createElement('span');
  first.textContent='「'+c.line.slice(0,preferredBreak);second.textContent=c.line.slice(preferredBreak)+'」';
  first.style.display=second.style.display='block';quote.replaceChildren(first,second);
 }
 document.querySelectorAll("[data-select]").forEach(b => b.setAttribute("aria-pressed",String(b.dataset.select === c.id)));
 fitStage(); if(play) startAnimation(); window.previewReady = true;
}
function seek(ms){animations.forEach(a => {a.pause();a.currentTime=ms});paused=true}
function scheduleLoop(){
 clearTimeout(loopTimer); if(!looping || paused) return;
 loopTimer=setTimeout(async()=>{if(!looping || paused)return;await showCharacter(records[(current+1)%records.length].id);scheduleLoop()},3900);
}
for(const c of records){
 const button=document.createElement("button");button.type="button";button.textContent=c.select_label || c.name;button.dataset.select=c.id;button.setAttribute("aria-pressed","false");
 button.onclick=async()=>{await showCharacter(c.id);scheduleLoop()};document.querySelector("#character-buttons").append(button);
}
document.querySelector("#replay").onclick=()=>{startAnimation();scheduleLoop()};
async function setBackgroundStyle(style,{play=true}={}){
 backgroundStyle = style === "illustrated" ? "illustrated" : "geometric";
 await showCharacter(records[current].id,{play});scheduleLoop();
}
document.querySelector("#background-style").onclick=()=>setBackgroundStyle(backgroundStyle==="geometric"?"illustrated":"geometric");
document.querySelector("#pause").onclick=()=>{
 paused=!paused;animations.forEach(a=>paused?a.pause():a.play());
 document.querySelector("#pause").textContent=paused?"再開":"一時停止";document.querySelector("#pause").setAttribute("aria-pressed",String(paused));
 clearTimeout(loopTimer);if(!paused)scheduleLoop();
};
document.querySelector("#loop").onclick=async()=>{
 looping=!looping;document.querySelector("#loop").setAttribute("aria-pressed",String(looping));
 document.querySelector("#loop").textContent=looping?"連続再生を止める":"全員を続けて再生";
 if(looping){await showCharacter(records[current].id);scheduleLoop()}else clearTimeout(loopTimer);
};
addEventListener("resize",fitStage);
reducedMotion.addEventListener("change",()=>{animations.forEach(a=>a.cancel());animations=[]});
window.introPreview={showCharacter,seek,setBackgroundStyle,records,get backgroundStyle(){return backgroundStyle},get animations(){return animations},get duration(){return 3900}};
await showCharacter(query.get("character")||records[0].id,{play:!query.has("still")});
