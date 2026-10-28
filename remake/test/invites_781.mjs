// Controlled production calendar/phone/access probes; synthetic state only.
// node --experimental-vm-modules remake/test/invites_781.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import * as invitations from '../js/daily/invitations.js';
import { spendableMoney } from '../js/core/travel-budget.js';
const state={}, trace=[], notes=[], DB={lime:[],dialogues:{}};
const noop=()=>{};
class Node {
 constructor(spec,attrs={},children=[]){this.spec=spec;this.children=[];this.dataset={};const classes=new Set(spec.split('.').slice(1));this.classList={add:(...xs)=>xs.forEach(x=>classes.add(x)),remove:(...xs)=>xs.forEach(x=>classes.delete(x)),contains:x=>classes.has(x)};if(Array.isArray(attrs)){children=attrs;attrs={};}Object.assign(this,attrs);this.append(children);}
 append(...xs){for(const x of xs.flat(Infinity).filter(Boolean)){this.children.push(x);x.parentNode=this;}}
 replaceChildren(...xs){for(const c of this.children)c.parentNode=null;this.children=[];this.append(xs);} remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.classList.contains(selector.slice(1))?[n]:[]),...n.querySelectorAll(selector)]);}
}
const el=(...args)=>new Node(...args), layers={modal:el('div'),fx:el('div')};
const values={state,DB,el,layers,SE:{cancel:noop,click:noop,select:noop},hooks:{interpolate:x=>x},bond:{},TOURNAMENT_DAY:14,
 sleep:async()=>{},chapterDay:()=>state.day,displayName:String,faceIconUrl:()=>null,
 gainAffinity:()=>trace.push('affinity'),addMoney:n=>{state.money+=n;trace.push(`money:${n}`);},addStamina:noop,
 ...invitations,spendableMoney,CHAR_STAT:{},VISIT_BG:{minto:'peppermint'},spotById:id=>id?{id,kind:'rival',charId:id,bg:'peppermint'}:null,
 isClosed:()=>false,isUnlocked:()=>true,isTemporaryClosed:()=>false,visitedToday:id=>state.visitedDay[id]===state.day,openingStatus:()=>({ok:true}),yen:String,
 completeInvitation:()=>trace.push('completed'),afterStory:async()=>{},save:()=>trace.push('save'),
 play:async()=>{trace.push('play');return {cancelled:state.cancelled};},
 bgUrl:x=>x,setBg:async()=>trace.push('background'),setPhoneBadge:noop,unreadCount:()=>0,syncSamechanKnowledge:noop,
 interruptMap:()=>{trace.push('interrupt');return true;},dropRetired:()=>trace.push('drop-map'),fadeBlack:async()=>trace.push('empty-fade'),
 isFriendEvent:()=>false,isFinaleEvent:()=>false,visitRival:async()=>true,
};
async function load(file, extras='', overrides={}){
 const code=await fs.readFile(new URL(`../js/daily/${file}`,import.meta.url),'utf8');
 const context=vm.createContext({console,setTimeout,requestAnimationFrame:fn=>fn(),document:{querySelector:()=>null}});
 const mod=new vm.SourceTextModule(code+extras,{context});
 await mod.link(spec=>{
  const names=[...new Set([...code.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)].filter(m=>m[2]===spec).flatMap(m=>m[1].split(',').map(s=>s.trim().split(/\s+as\s+/)[0])))];
  const bound={...values,...overrides};return new vm.SyntheticModule(names,function(){for(const n of names)this.setExport(n,n in bound?bound[n]:noop);},{context});
 });await mod.evaluate();return mod.namespace;
}
function reset(){Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,{chapter:1,day:4,slot:0,phase:'daily',money:10000,flags:{},met:{},inbox:[],limeRead:[],visitedDay:{},contacts:[]});trace.length=0;notes.length=0;DB.lime=[];}
const invite={event:'interaction_minto_noon_01',sender:'minto',day:4,slot:0,originId:'minto-invite'};
const source={id:invite.originId,sender:'minto',type:'invitation',accept_event:invite.event};
assert.equal(invitations.invitationVisitSpot(invite,source),'minto');assert.equal(invitations.invitationVisitSpot({event:'unknown',sender:'minto'},null),null,'never guess venue from sender');
assert.equal(invitations.visitReminderSpot({...source,private_schedule:'holiday_or_after_close'}),null);
reset();DB.lime=[source];let target=invite;
const calendar=await load('calendar.js','\nexport { meetInvitation, readLime, performSpotAction }; export const configure = () => { chapterDef = {nightEvents:{}}; };',{
 openLime:async opts=>{trace.push('phone-open');state.pendingInvite=target;await opts.beforeClose();trace.push('phone-close');},
});
await calendar.readLime('minto');assert.deepEqual(trace.slice(0,5),['phone-open','background','interrupt','drop-map','phone-close'],'prepare destination and retire map before phone closes');
trace.length=0;assert.equal(await calendar.meetInvitation(invite),true);assert(!trace.includes('empty-fade'),'no black-to-map roundtrip');assert.equal(state.visitedDay.minto,4);assert.equal(state.flags._invitation_visit_minto,'1:4');assert.equal(state.money,7000);assert.equal(trace.filter(x=>x==='completed').length,1);
const access=await load('spot-access.js');assert.equal(access.spotAvailability({id:'minto',kind:'rival'}).ok,false);assert.equal(access.spotAvailability({id:'shop',kind:'shop'}).ok,true,'unrelated visit unchanged');
state.flags._invitation_visit_shop='1:4';assert.equal(access.spotAvailability({id:'shop',kind:'shop'}).ok,false);calendar.configure();assert.equal((await calendar.performSpotAction({id:'minto',kind:'rival',charId:'minto',stamina:0})).used,true,'forced/direct event entry keeps its existing exemption');state.day++;assert.equal(access.spotAvailability({id:'minto',kind:'rival'}).ok,true,'next day');
reset();state.cancelled=true;DB.lime=[source];assert.equal(await calendar.meetInvitation(invite),false);assert.equal(state.visitedDay.minto,undefined);assert.equal(state.flags._invitation_visit_minto,undefined);assert(!trace.includes('completed'));
reset();target={...invite,slot:1};DB.lime=[source];await calendar.readLime('minto');assert(!trace.includes('background'),'future promise does not move');assert.equal(state.pendingInvite,target);assert(!trace.includes('empty-fade'));
const calendarCode=await fs.readFile(new URL('../js/daily/calendar.js',import.meta.url),'utf8');assert(!calendarCode.includes('notice: inv'),'promise banner absent');
const phone=await load('phone.js','\nexport { runItem, drawHistory };');
reset();state.day=5;const old={id:source.id,day:4,msg:source,read:true,done:true,result:'expired',replyState:'expired',log:[{note:'old long note'}]};
const ui={gen:0,live:()=>true,bubble:async()=>{},note:t=>notes.push(t)};await phone.runItem(old,ui,[]);assert.deepEqual(notes,['返信するタイミングを逃した']);const original=JSON.stringify(old);notes.length=0;phone.drawHistory([old],ui);assert(notes.includes('返信するタイミングを逃した'));assert(!notes.includes('old long note'));assert.equal(JSON.stringify(old),original,'history display preserves data');
reset();state.inbox=[{id:'chat',day:4,msg:{id:'chat',sender:'minto',type:'chat',messages:['hello']},read:true,done:true,log:[]}];
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
let closePrepared=false;const session=phone.openLime({beforeClose:async()=>{assert(layers.modal.classList.contains('show'));closePrepared=true;}});await flush();assert(layers.modal.querySelectorAll('.lcr-tag').some(n=>n.text==='雑談'));
function find(node,id){if(node.dataset?.test===id)return node;for(const child of node.children){const hit=find(child,id);if(hit)return hit;}}
find(layers.modal,'phone-close').onclick();await session;assert(closePrepared);assert(!layers.modal.classList.contains('show'));
console.log('PASS #781: pre-close direct destination, successful venue record, normal/forced/next-day access, cancellation, future promise data, banner absence, expired history and chat label; synthetic state');
