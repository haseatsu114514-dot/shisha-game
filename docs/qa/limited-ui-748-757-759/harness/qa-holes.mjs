// QA entrypoint only. Production modules are imported unchanged; no chapter/main entrypoint.
import { loadAll, DB } from './js/core/data.js';
import { initLayers } from './js/core/ui.js';
import { newGame } from './js/core/state.js';
import { newSession, openBench, waitBenchReady, craftTest } from './js/craft/session.js';
import { runHoles } from './js/craft/holes.js';
const errors=[];window.addEventListener('error',e=>errors.push(e.message));window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason?.stack||e.reason)));
window.H={head:'aeff796097f10d92df932d1bccd3f440910303ed',errors,resolutions:0,started:false};
function fit(){document.querySelector('#stage').style.setProperty('--k',String(Math.min(innerWidth/1280,innerHeight/720)));}addEventListener('resize',fit);fit();
H.ready=(async()=>{await loadAll();initLayers();newGame();craftTest.auto=null;await document.fonts.ready;return true;})();
H.start=async()=>{await H.ready;H.cs=newSession('drill');openBench(H.cs,{steps:[['holes','アルミ穴あけ']]});await waitBenchReady(H.cs);H.running=runHoles(H.cs).then(()=>{H.resolutions++;});H.started=true;};
H.sample=()=>{const q=s=>document.querySelector(s),disabled=t=>q(`[data-test="${t}"]`)?.disabled;return{plan:q('[data-test="hole-plan"]')?.textContent,punchDisabled:disabled('hole-punch'),nextDisabled:disabled('hole-next'),doneDisabled:disabled('hole-done'),visualHoles:q('.foil-holes')?.children.length,markers:q('.foil-markers')?.children.length,results:document.querySelectorAll('[data-test="step-next"]').length,done:H.cs?.holes,resolutions:H.resolutions,active:document.activeElement?.dataset?.test,errors:[...errors]};};
H.nearNext=()=>new Promise((resolve,reject)=>{const began=performance.now();function tick(){const a=document.querySelector('.foil-cursor'),b=document.querySelector('.foil-marker.next');if(!a||!b){reject(Error('cursor or next marker missing'));return;}const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(),gap=Math.hypot((x.left+x.right-y.left-y.right)/2,(x.top+x.bottom-y.top-y.bottom)/2);if(gap<4){resolve({gap,at:performance.now()});return;}if(performance.now()-began>15000){reject(Error('next target did not approach'));return;}requestAnimationFrame(tick);}requestAnimationFrame(tick);});
