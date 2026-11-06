import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {replyCutinCue,replyCutinAllowed,replyImagePlacement,createReplyCutin,REPLY_COMPOSITIONS} from '../js/vn/reply-cutin.js';
const dialogue=JSON.parse(readFileSync(new URL('../../data/dialogue/ch1_tsumugi.json',import.meta.url),'utf8')).dialogues.find(d=>d.dialogue_id==='ch1_tsumugi_second');
const cues=dialogue.lines.filter(l=>replyCutinCue(dialogue.dialogue_id,l));
assert.equal(cues.length,2);assert.deepEqual(cues.map(l=>replyCutinCue(dialogue.dialogue_id,l)),['c','a']);
for(const line of cues){
 assert.equal(replyCutinCue('another-scene',line),null);
 for(const edit of [{speaker:'tsumugi'},{type:'choice'},{portrait:'hajime'},{portrait:false}])assert.equal(replyCutinCue(dialogue.dialogue_id,{...line,...edit}),null);
}
const context={portraitCount:1};assert.equal(replyCutinAllowed(context),true);
for(const field of ['cg','choices','log','intro','skip','protagonistVisible'])assert.equal(replyCutinAllowed({...context,[field]:true}),false);
for(const portraitCount of [0,2])assert.equal(replyCutinAllowed({portraitCount}),false);
const manifest=JSON.parse(readFileSync(new URL('../data/manifest.json',import.meta.url),'utf8'));
for(const kind of ['a','c'])for(const m of [manifest.portraits.hajime,manifest.portraitVariants.new.hajime]){
 const p=replyImagePlacement({...m,src:'resolved-style'},kind);assert(Number.isFinite(p.top));assert.equal(p.src,'resolved-style');
 assert(Math.abs(p.left+m.ax*p.width-REPLY_COMPOSITIONS[kind].anchorX)<1e-9);
}
assert.equal(replyImagePlacement(null,'a'),null);assert.equal(replyImagePlacement({src:'x',h:NaN},'c'),null);
function element(){return {style:{},dataset:{},children:[],setAttribute(){},append(...children){this.children.push(...children);},remove(){this.removed=true;},querySelector(){return this.children.find(x=>x.className==='reply-clip');}};}
const host=element(),head=element(),timers=new Map();let id=0;
const document={head,getElementById:()=>null,createElement:element,createElementNS:element};
const controller=createReplyCutin(host,{document,schedule(fn){timers.set(++id,fn);return id;},cancel(key){timers.delete(key);}});
const info={src:'resolved-style',h:.8992,b:.0508,ax:.5004,aspect:.7467};const nodes=host.children[0].children;
assert.equal(controller.show('a',context,info),true);assert.equal(timers.size,0);
const a=nodes.at(-1),oldError=a.querySelector().children[0].onerror;
assert.equal(controller.show('c',context,info),true);assert(a.removed);assert.equal(timers.size,1);
const stale=[...timers.values()][0];oldError();assert(!nodes.at(-1).removed);
controller.show('a',context,info);stale();assert(!nodes.at(-1).removed);assert.equal(timers.size,0);
const oldImage=nodes.at(-1).querySelector().children.at(-1);
controller.refresh({...info,src:'another-style'},{still:true});oldImage.onerror();assert(!nodes.at(-1).removed);assert.equal(nodes.at(-1).dataset.still,'true');
nodes.at(-1).querySelector().children.at(-1).onerror();assert(nodes.at(-1).removed);
controller.show('c',context,info);controller.refresh({...info,src:'another-style'});[...timers.values()][0]();assert(nodes.at(-1).removed);
controller.clear();controller.clear();assert.equal(timers.size,0);
assert.equal(controller.show('a',{...context,cg:true},info),false);
const engine=readFileSync(new URL('../js/vn/engine.js',import.meta.url),'utf8');
for(const start of ['function next() {','function finish(cancelled = false) {','function openLog() {','async function openGlossary() {'])assert(engine.includes(start+'\n  replyCutin?.clear();'));
console.log('reply-cutin: explicit real cues, all exclusions, style metrics, stale errors/timers and cleanup PASS');
