// DOM/event harness, not a substitute for a real browser or mobile Safari test.
import test from 'node:test';
import assert from 'node:assert/strict';
class Element extends EventTarget {
 constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.hidden=false;this.disabled=false;this.open=false;this.value='';this.textContent='';this.captures=new Set();}
 querySelector(selector){if(selector==='i')return this.band ||= new Element('i');return null}
 setAttribute(k,v){this.attrs[k]=String(v)} append(n){this.children.push(n)} replaceChildren(){this.children=[]} focus(){document.activeElement=this} hasPointerCapture(id){return this.captures.has(id)} setPointerCapture(id){this.captures.add(id)} releasePointerCapture(id){this.captures.delete(id);this.dispatchEvent(new Event('lostpointercapture'))}
 showModal(){this.open=true} close(){if(this.open){this.open=false;this.dispatchEvent(new Event('close'))}}
 getBoundingClientRect(){return {left:0,top:0,width:innerWidth,height:innerHeight}} get clientWidth(){return innerWidth}get clientHeight(){return innerHeight}
}
const ids=['scene','calls','score','instruction','next','pull','grip','focus','track','power-label','power','menu','summary','mode','division','difficulty','settings','restart','again','summary-settings','result','wallet','equipment','axe-offers','axe-effect'];
const nodes=Object.fromEntries(ids.map(id=>[id,new Element(['grip','next','focus','settings','restart','again','summary-settings'].includes(id)?'button':id==='scene'?'svg':'div')]));
nodes.mode.value='practice';nodes.division.value='rec';nodes.difficulty.value='normal';
globalThis.window=new EventTarget();globalThis.document=Object.assign(new EventTarget(),{hidden:false,hasFocus:()=>true,getElementById:id=>nodes[id],createElement:tag=>new Element(tag),createElementNS:(_,tag)=>new Element(tag)});
globalThis.innerWidth=844;globalThis.innerHeight=390;let raf;globalThis.requestAnimationFrame=cb=>{raf=cb};
await import('../js/axe-pull-preview-page.js');
const fire=(target,type,props={})=>{const e=new Event(type,{cancelable:true});for(const[k,v]of Object.entries(props))Object.defineProperty(e,k,{value:v});target.dispatchEvent(e)};
let now=0;const advance=ms=>{for(let t=0;t<ms;t+=20){now+=20;raf(now)}};
const restart=()=>{fire(nodes.restart,'click');advance(20)};
const pointer=(type,x,y,id=1)=>({clientX:x,clientY:y,pointerId:id,isPrimary:true,button:0});
const aim=()=>{const k=Math.min(innerWidth/1600,innerHeight/900);fire(nodes.scene,'pointerdown',pointer('pointerdown',innerWidth/2,(innerHeight-900*k)/2+430*k))};
function down(x,y,id=1){const p=pointer('pointerdown',x,y,id);fire(window,'pointerdown',p);fire(nodes.grip,'pointerdown',p)}
function up(x,y,id=1){const p=pointer('pointerup',x,y,id);fire(nodes.grip,'pointerup',p);fire(window,'pointerup',p)}
function key(type,code){fire(window,type,{code,repeat:false,target:document.activeElement})}
test('HUD grip works outside SVG letterbox on both wide landscape sizes and portrait',()=>{for(const [w,h]of[[844,390],[932,430],[390,844],[667,375]]){globalThis.innerWidth=w;globalThis.innerHeight=h;restart();aim();const k=Math.min(w/1600,h/900),x=w-60,y=h*.45;down(x,y);up(x,y+.62*230*k);advance(1000);assert.equal(nodes.next.hidden,false,`${w}x${h}`);assert.match(nodes.instruction.textContent,/点/);}});
test('multiple fingers, pointercancel, resize and blur cancel without scoring',()=>{globalThis.innerWidth=844;globalThis.innerHeight=390;for(const event of ['pointercancel','resize','blur','multi']){restart();aim();down(780,170);fire(nodes.grip,'pointermove',pointer('',780,230));if(event==='multi')fire(window,'pointerdown',pointer('',300,200,2));else fire(window,event,pointer('',780,230));up(780,230);fire(window,'pointerup',pointer('',300,200,2));advance(1200);assert.equal(nodes.next.hidden,true,event);assert.match(nodes.score.textContent,/0 pt · 1\/3/);}});
test('keyboard stays usable after next and restart, and buttons regain scene focus',()=>{restart();for(let i=0;i<3;i++){assert.equal(document.activeElement,nodes.scene);key('keydown','ArrowRight');key('keydown','Space');advance(740);key('keyup','Space');advance(1000);assert.equal(nodes.next.hidden,false);nodes.next.focus();fire(nodes.next,'click');}assert.equal(nodes.summary.open,true);assert.match(nodes.result.textContent,/ランク/);restart();assert.equal(document.activeElement,nodes.scene);});
test('opening settings cancels pull and paused frames never release it',()=>{restart();aim();down(780,170);fire(nodes.settings,'click');advance(5000);up(780,230);nodes.menu.close();advance(500);assert.equal(nodes.next.hidden,true);assert.equal(document.activeElement,nodes.scene);assert.match(nodes.score.textContent,/0 pt · 1\/3/);});

test('kill declaration and focus buttons return to keyboard aiming',()=>{restart();aim();nodes.calls.children[0].focus();fire(nodes.calls.children[0],'click');assert.equal(document.activeElement,nodes.scene);nodes.focus.focus();fire(nodes.focus,'click');assert.equal(document.activeElement,nodes.scene);key('keydown','Space');advance(740);key('keyup','Space');advance(1000);assert.equal(nodes.next.hidden,false);});

test('demo shop charges once, equips best owned after purchase and does not stack bonuses',()=>{
  restart();fire(nodes.settings,'click');
  fire(nodes['axe-offers'].children[0],'click');assert.equal(nodes.wallet.textContent,'試作用所持金 85,000円');assert.equal(nodes.equipment.value,'gear_hatchet');
  fire(nodes['axe-offers'].children[0],'click');assert.equal(nodes.wallet.textContent,'試作用所持金 85,000円');
  fire(nodes['axe-offers'].children[2],'click');assert.equal(nodes.wallet.textContent,'試作用所持金 35,000円');assert.equal(nodes.equipment.value,'gear_hatchet_precision');
  restart();aim();assert.equal(nodes.grip.style.background,'#303c48');assert(Math.abs(parseFloat(nodes.track.querySelector('i').style.height)-20)<1e-8);
});
