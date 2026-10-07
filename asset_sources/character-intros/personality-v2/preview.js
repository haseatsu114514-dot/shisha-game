const records = window.INTRO_CHARACTERS || await fetch("characters.json").then(r => r.json());
const query = new URLSearchParams(location.search);
const stage = document.querySelector("#stage"), portrait = document.querySelector("#portrait");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let current=0, animations=[], paused=false, looping=false, loopTimer, renderToken=0;
if(query.has("video")) document.body.classList.add("video-only");
const motifs={
 smoke:`<g fill="none" stroke="currentColor" stroke-width="3" opacity=".38"><path d="M680 720C590 590 870 520 744 416S552 226 744 185 780 60 720-45"/><path d="M777 756C684 550 1070 527 888 330S724 162 896 99 1030-35 942-80"/><circle cx="1090" cy="115" r="151"/><circle cx="1090" cy="115" r="174"/><circle cx="1090" cy="115" r="195"/></g><g fill="currentColor" opacity=".26"><circle cx="586" cy="123" r="6"/><circle cx="615" cy="144" r="3"/><circle cx="626" cy="113" r="3"/></g>`,
 duality:`<g fill="none" stroke-width="5" opacity=".38"><circle cx="925" cy="55" r="196" stroke="var(--secondary)"/><circle cx="1108" cy="55" r="196" stroke="currentColor"/><circle cx="925" cy="55" r="174" stroke="var(--secondary)"/><circle cx="1108" cy="55" r="174" stroke="currentColor"/></g><g stroke="currentColor" stroke-width="2" opacity=".26"><path d="M528 720L685 720 819 560 981 560 1111 415"/><path d="M495 695L660 695 792 534 953 534"/><path d="M1110 620h170M1130 646h150M1150 672h130"/></g>`,
 stripes:`<g stroke="currentColor" fill="none" opacity=".3"><path d="M700-40L590 180M795-40L685 180M890-40L780 180M985-40L875 180M1080-40L970 180M1175-40L1065 180M1270-40L1160 180" stroke-width="12"/><path d="M810 720L980 514M860 720L1030 514M910 720L1080 514M960 720L1130 514M1010 720L1180 514M1060 720L1230 514" stroke-width="3"/></g>`,
 science:`<defs><pattern id="hex" width="92" height="80" patternUnits="userSpaceOnUse"><path d="M23 0H69L92 40 69 80H23L0 40Z" fill="none" stroke="currentColor" stroke-width="1"/></pattern></defs><rect x="560" width="720" height="720" fill="url(#hex)" opacity=".12"/><g fill="none" stroke="currentColor" opacity=".43"><path d="M668 654V530M668 654H1228" stroke-width="2"/><path d="M685 638L768 600 856 628 963 567 1058 582 1162 514 1246 524" stroke-width="4"/></g><g fill="var(--secondary)" opacity=".55"><circle cx="768" cy="600" r="5"/><circle cx="856" cy="628" r="5"/><circle cx="963" cy="567" r="5"/><circle cx="1058" cy="582" r="5"/><circle cx="1162" cy="514" r="5"/></g>`,
 shark:`<g fill="none" stroke="currentColor" stroke-width="3" opacity=".42"><path d="M560 80Q620 20 680 80T800 80 920 80 1040 80 1160 80 1280 80"/><path d="M560 108Q620 48 680 108T800 108 920 108 1040 108 1160 108 1280 108"/><path d="M665 664Q725 604 785 664T905 664 1025 664 1145 664 1265 664"/></g><g fill="var(--secondary)" opacity=".2"><path d="M950 148h46l-23 39ZM1009 148h46l-23 39ZM1068 148h46l-23 39ZM1127 148h46l-23 39ZM1186 148h46l-23 39Z"/></g><g stroke="currentColor" stroke-width="4" opacity=".4"><path d="M595 541v32M581 557h28M1210 232v32M1196 248h28"/></g>`
};
function fitStage(){
 const available=innerHeight-(document.body.classList.contains("video-only")?0:document.querySelector("#controls").offsetHeight);
 const s=Math.min(innerWidth/1280,available/720);
 stage.style.transform=`translate(${(innerWidth-1280*s)/2}px,${(available-720*s)/2}px) scale(${s})`;
}
function animate(selector,frames,options){
 const el=document.querySelector(selector);
 const a=el.animate(frames,{duration:600,easing:"cubic-bezier(.2,.8,.2,1)",fill:"both",...options});
 animations.push(a);return a;
}
function startAnimation(){
 animations.forEach(a=>a.cancel());animations=[];paused=false;
 document.querySelector("#pause").textContent="一時停止";document.querySelector("#pause").setAttribute("aria-pressed","false");
 if(reducedMotion.matches)return;
 const id=records[current].id;
 animate(".left-field",[{clipPath:"polygon(0 0,0 0,0 720px,0 720px)"},{clipPath:"polygon(0 0,558px 0,410px 720px,0 720px)"}],{duration:450});
 animate(".halftone",[{opacity:0},{opacity:id==="dr_kemuri"?.5:.12}],{duration:450,delay:150});
 animate(".sweep",[{transform:"translateX(1450px) rotate(-7deg)"},{transform:"translateX(0) rotate(-7deg)"}],{duration:id==="adam"?370:540,delay:110});
 animate(".accent-line",[{transform:"translateX(-1500px) rotate(-7deg)"},{transform:"translateX(0) rotate(-7deg)"}],{duration:520,delay:220});
 animate(".secondary-line",[{transform:"translateX(-1500px) rotate(-7deg)"},{transform:"translateX(0) rotate(-7deg)"}],{duration:520,delay:300});
 const portraitFrames=id==="kafuka"?[{opacity:0,transform:"translate(-130px,22px)"},{opacity:1,transform:"translate(8px,-5px)",offset:.8},{opacity:1,transform:"translate(0,0)"}]:[{opacity:0,transform:`translateX(${id==="adam"?-180:-110}px)`},{opacity:1,transform:"translateX(0)"}];
 animate("#portrait",portraitFrames,{duration:id==="adam"?450:670,delay:140});
 animate(".motif",[{opacity:0,transform:id==="naru"?"translateX(80px)":"scale(1.09)"},{opacity:1,transform:"none"}],{duration:1000,delay:100});
 animate(".edge-stripes",[{opacity:0},{opacity:.5}],{duration:700,delay:500});
 for(const [selector,delay] of [["#tag",390],["#title",500],["#name",560],["#full",720],[".quote-area",920]])animate(selector,[{opacity:0,transform:"translateX(45px)"},{opacity:1,transform:"translateX(0)"}],{duration:selector==="#name"?400:510,delay});
 animate(".quote-rule",[{transform:"scaleX(0)",transformOrigin:"left"},{transform:"scaleX(1)",transformOrigin:"left"}],{duration:410,delay:940});
}
async function showCharacter(id,{play=true}={}){
 const token=++renderToken;const idx=records.findIndex(c=>c.id===id);current=idx<0?0:idx;const c=records[current];
 window.previewReady=false;animations.forEach(a=>a.cancel());animations=[];
 stage.dataset.character=c.id;
 for(const [key,value] of Object.entries({accent:c.color,secondary:c.secondary,shade:c.shade,"portrait-width":`${c.frame.width}px`,"portrait-left":`${c.frame.left}px`,"portrait-top":`${c.frame.top}px`}))stage.style.setProperty(`--${key}`,value);
 document.querySelector("#motif").innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720">${motifs[c.motif]}</svg>`;
 for(const [key,text] of Object.entries({title:c.title,name:c.name,full:c.full?`（${c.full}）`:"",quote:`「${c.line}」`,tag:c.tag}))document.getElementById(key).textContent=text;
 portrait.src=c.portrait;portrait.alt=c.name;
 await Promise.all([document.fonts.ready,portrait.decode()]);if(token!==renderToken)return;
 for(const [selector,initial,min] of [["#name",116,60],["#title",30,23],["#quote",30,18]]){const el=document.querySelector(selector);let size=initial;el.style.fontSize=`${size}px`;while(el.scrollWidth>el.clientWidth+1&&size>min)el.style.fontSize=`${--size}px`;}
 document.querySelectorAll("[data-select]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.select===c.id)));
 fitStage();if(play)startAnimation();window.previewReady=true;
}
function seek(ms){animations.forEach(a=>{a.pause();a.currentTime=ms;});paused=true;}
async function scheduleLoop(){clearTimeout(loopTimer);if(!looping)return;loopTimer=setTimeout(async()=>{if(!looping)return;await showCharacter(records[(current+1)%records.length].id);scheduleLoop();},3900);}
for(const c of records){const button=document.createElement("button");button.type="button";button.textContent=c.name;button.dataset.select=c.id;button.setAttribute("aria-pressed","false");button.onclick=async()=>{await showCharacter(c.id);scheduleLoop();};document.querySelector("#character-buttons").append(button);}
document.querySelector("#replay").onclick=()=>{startAnimation();scheduleLoop();};
document.querySelector("#pause").onclick=()=>{paused=!paused;animations.forEach(a=>paused?a.pause():a.play());document.querySelector("#pause").textContent=paused?"再開":"一時停止";document.querySelector("#pause").setAttribute("aria-pressed",String(paused));clearTimeout(loopTimer);if(!paused)scheduleLoop();};
document.querySelector("#loop").onclick=async()=>{looping=!looping;document.querySelector("#loop").setAttribute("aria-pressed",String(looping));document.querySelector("#loop").textContent=looping?"連続再生を止める":"5人を続けて再生";if(looping){await showCharacter(records[current].id);scheduleLoop();}else clearTimeout(loopTimer);};
addEventListener("resize",fitStage);reducedMotion.addEventListener("change",()=>{animations.forEach(a=>a.cancel());animations=[];});
window.introPreview={showCharacter,seek,records,get animations(){return animations;},get duration(){return 3900;}};
await showCharacter(query.get("character")||records[0].id,{play:!query.has("still")});
