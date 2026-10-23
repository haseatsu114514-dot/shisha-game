// QA wrapper only. Production modules/data are imported unchanged from the pinned virtual root.
// It never calls boot(), resumeGame(), a chapter, warmUiArt(), or any external network broker.
const root=new URL('./',location.href);const variant=location.pathname.split('/').filter(Boolean)[0];
const base=document.createElement('base');base.href=root.href;document.head.prepend(base);
window.qa={ready:false,error:null,events:[],inputEvents:[],variant,root:root.href};
for(const type of ['pointerdown','pointerup','mousedown','mouseup','click','contextmenu','keydown','keyup'])document.addEventListener(type,e=>{qa.inputEvents.push({type,time:performance.now(),test:e.target.closest?.('[data-test]')?.dataset.test,key:e.key,ctrlKey:e.ctrlKey,button:e.button,pointerType:e.pointerType,text:document.querySelector('.vn-text')?.textContent,choices:document.querySelector('.vn-choices')?.className});},true);
const fit=()=>document.querySelector('#stage').style.setProperty('--k',Math.min(innerWidth/1280,innerHeight/720));fit();addEventListener('resize',fit);
try{
 const paths=['base','vn','intro','craft','ui-art','ui-inner','shop','worker-scenes','craft-header','motions','game-ds','vn-lounge'].map(name=>'css/'+name+'.css');
 if(variant==='759'&&!paths.includes('css/craft-landscape.css'))paths.push('css/craft-landscape.css');
 await Promise.all(paths.map(href=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(href,root);link.onload=resolve;link.onerror=()=>reject(Error('CSS '+href));document.head.append(link)})));
 const mod=path=>import(new URL('js/'+path,root));
 const [data,s,ui,vn,intro,session,steps]=await Promise.all(['core/data.js','core/state.js','core/ui.js','vn/engine.js','vn/intro.js','craft/session.js','craft/steps.js'].map(mod));
 await data.loadAll();
 const slot='suien_remake_slot1';let reloaded=false;
 if(s.readSlot(slot)?.flags?.__limitedQaCheckpoint){s.loadFromSlot(slot);reloaded=true}else s.newGame();
 Object.assign(s.config,{textSpeed:3,seVolume:0,bgmVolume:0,voiceBlip:false});
 s.state.met.sumi=true;s.state.met.hajime=true;intro.markIntroSeen('sumi');intro.markIntroSeen('hajime');ui.initLayers();
 await Promise.all([document.fonts.load('500 20px "Suien Gothic"','日本語'),document.fonts.load('700 20px "Suien Gothic"','日本語'),document.fonts.load('900 20px "Suien Gothic"','日本語'),document.fonts.load('700 24px "Suien Name"','スミ'),document.fonts.load('700 24px "Craft Mincho"','作業')]);
 let vnController;let activeCraft=null;
 const scene=()=>({dialogue_id:'limited-ui-qa',lines:[{speaker:'sumi',face:'normal',text:'道具は相棒だ。手元を見て、一つずつ確かめよう。'},{speaker:'hajime',text:'（落ち着いて、ひとつずつ確かめよう）'},{type:'choice',id:'limited-choice',choices:[{text:'もう少し話す'},{text:'ここで決める'}]},{speaker:'sumi',face:'normal',text:'よし、それでいこう。'}]});
 vn.hooks.onChoice=(...args)=>qa.events.push({type:'choice',id:args[1]});
 qa.startVN=async()=>{vnController?.abort();vnController=new AbortController();qa.vnDone=false;qa.vnPromise=vn.play(scene(),{bg:'bg_tonari_inside',signal:vnController.signal}).then(result=>{qa.vnDone=true;qa.vnResult=result});};
 qa.abortVN=async()=>{vnController?.abort();await qa.vnPromise};
 qa.saveCheckpoint=()=>{s.state.flags.__limitedQaCheckpoint='same-scene-reopen-only';return s.saveToSlot(slot)};
 qa.reloadedFromSlot=reloaded;
 qa.startCraft=async(step,{preview=false}={})=>{
  if(activeCraft)throw Error('One production craft call per fresh page; do not discard a pending step');
  const mode=preview?'rehearsal':'tutorial';const cs=session.newSession(mode);cs.equip={...cs.equip,bowl:'silicone_bowl',hms:'lotos_hagal',charcoal:'flat_charcoal'};
  if(step==='setup'){
   const choices=data.DB.equipment.filter(e=>e.type==='bowl'&&['silicone_bowl','hagal_80beat'].includes(e.id)).map(e=>e.id);s.state.owned=[...new Set([...s.state.owned,...choices])];
  }
  if(step==='mix')cs.orderFlavorIds=['double_apple','mint'];
  if(step==='pack')cs.mix={double_apple:9,mint:3};
  activeCraft=cs;qa.cs=cs;qa.craftDone=false;session.openBench(cs,{steps:[[step,()=>{}]]});await session.waitBenchReady(cs);
  const fn={setup:steps.stepSetup,mix:steps.stepMix,pack:steps.stepPack,place:steps.stepPlace}[step];if(!fn)throw Error('Unapproved craft step '+step);
  qa.craftPromise=fn(cs).then(()=>{qa.craftDone=true;qa.craftResult={step,pack:cs.pack,mix:{...cs.mix},place:cs.place,equip:{...cs.equip}}});
 };
 qa.snapshot=()=>{
  const rect=selector=>{const e=document.querySelector(selector);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return{x:r.x,y:r.y,width:r.width,height:r.height,font:c.fontSize,fontFamily:c.fontFamily,scroll:e.scrollHeight,client:e.clientHeight,hidden:e.hidden,display:c.display,overflowX:c.overflowX,overflowY:c.overflowY,touchAction:c.touchAction}};
  return{variant,root:root.href,viewport:[innerWidth,innerHeight],time:performance.now(),text:document.querySelector('.vn-text')?.textContent,choices:document.querySelector('.vn-choices')?.className,inputEvents:qa.inputEvents.slice(-40),coarse:matchMedia('(pointer:coarse)').matches,hoverNone:matchMedia('(hover:none)').matches,rects:Object.fromEntries(['.vn-box','.vn-name','.vn-text','.vn-controls','.vn-choices','.bench-left','.bench-right','.bench-panel','.bench-head','.audience-people','.audience-speech','.audience-name','.mix','.mix-temperature','.mix-temperature-legend > :first-child','.mix-temperature-legend > :last-child','.pack-choices','.pack-footer','.pack-vessel','.mix-vessel','.fr-btn','.mix-footer > .btn','.opt','.bench-worker-name','.bench-audience','.audience-face','.audience-heading','.audience-note','.pack-choice','.pack-confirm','.mix-temperature-preview','.mix-temperature-legend','.mix-ideal','.mix-optimal'].map(sel=>[sel,rect(sel)])),images:[...document.images].map(i=>({src:i.currentSrc||i.src,complete:i.complete,naturalWidth:i.naturalWidth,naturalHeight:i.naturalHeight})),fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),auto:document.querySelector('[data-test=vn-auto]')?.getAttribute('aria-pressed'),skip:document.querySelector('[data-test=vn-skip]')?.getAttribute('aria-pressed'),vnDone:qa.vnDone,craftDone:qa.craftDone,reloadedFromSlot:reloaded};
 };
 qa.ready=true;document.body.dataset.qa='ready';
}catch(error){qa.error=String(error.stack||error);document.body.dataset.qa='error';console.error(error)}
