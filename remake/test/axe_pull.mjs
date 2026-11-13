import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AxePullSession, SCENE, scenePoint, boardPoint, pullPower, FLICK, flickPower, flickRead, flickSpeedFor } from '../js/minigames/axe-pull-model.js';
import { resolveThrow, releaseAimAt, KILLS, totalOf } from '../js/minigames/axe-model.js';
import { createMatch, takeTurn, turnOf, planOpponent } from '../js/minigames/axe-match.js';
const pull=(s,p=.62)=>{assert(s.beginPull(1,{x:1300,y:400}));return s.release(1,{x:1300,y:400+230*p});};
test('landscape and portrait letterboxing resolve the same real board point',()=>{
 for(const [width,height] of [[844,390],[932,430],[390,844],[1600,900],[667,375]]) { const rect={left:11,top:7,width,height},k=Math.min(width/1600,height/900);const p={x:SCENE.cx+.4*SCENE.radius,y:SCENE.cy-.5*SCENE.radius}; const got=scenePoint(rect,11+(width-1600*k)/2+p.x*k,7+(height-900*k)/2+p.y*k);assert(Math.abs(boardPoint(got).x-.4)<1e-12);assert(Math.abs(boardPoint(got).y+.5)<1e-12); }
 assert.equal(scenePoint({left:0,top:0,width:390,height:844},5,5),null);assert.equal(boardPoint({x:0,y:0}),null);assert.equal(scenePoint({left:0,top:0,width:0,height:2},1,1),null);
});
// 本編の投げ方（2026-11-12）: 上へ弾く速さで強さ、傾きで左右のぶれ。
const stroke=(speed,{height=390,ms=80,lean=0,steps=4}={})=>Array.from({length:steps+1},(_,i)=>({t:1000+ms*i/steps,x:400+speed*height*ms/1000*lean*i/steps,y:300-speed*height*ms/1000*i/steps}));
test('flick power follows the upward speed on a log scale, with the sweet band at about x0.7-x1.4 of the base speed',()=>{
 assert(Math.abs(flickPower(stroke(FLICK.base),390).raw-.62)<1e-9);
 for(const raw of [.3,.54,.62,.7,.95])assert(Math.abs(flickPower(stroke(flickSpeedFor(raw),{ms:200}),390).raw-raw)<1e-9,String(raw));
 assert(Math.abs(flickSpeedFor(.54)/FLICK.base-2**-.5)<1e-9);assert(Math.abs(flickSpeedFor(.70)/FLICK.base-2**.5)<1e-9);
 // 画面の高さで割るので、同じ「画面に対する速さ」なら端末が違っても同じ強さ
 assert(Math.abs(flickPower(stroke(3,{height:720}),720).raw-flickPower(stroke(3,{height:390}),390).raw)<1e-9);
 // 速さは離す直前 window ms で測る（ゆっくり始めて最後に速く弾けば、最後の速さ）
 const late=[{t:0,x:400,y:300},{t:400,x:400,y:290},{t:440,x:400,y:290-3*390*.04},{t:490,x:400,y:290-3*390*.09}];
 assert(Math.abs(flickPower(late,390).raw-.62)<.02,'the last ~90 ms decide the strength');
});
test('flick lean drifts sideways; taps, downward, sideways and malformed strokes are not throws',()=>{
 const right=flickPower(stroke(3,{lean:.4}),390);assert(Math.abs(right.lean-.4*FLICK.lean)<1e-9);assert(right.lean>0);
 assert(flickPower(stroke(3,{lean:-.4}),390).lean<0);
 assert.equal(flickPower([{t:0,x:0,y:300},{t:80,x:0,y:300-390*.03}],390),null,'shorter than shortRise');
 assert.equal(flickPower([{t:0,x:0,y:300},{t:80,x:0,y:380}],390),null,'downward');
 assert.equal(flickPower(stroke(3,{lean:2}),390),null,'more sideways than upward');
 // 2026-11-13 指摘3: 弾き損ねは理由を返す。触れただけ・戻しただけは理由なし
 assert.deepEqual(flickRead([{t:0,x:0,y:300},{t:80,x:0,y:300-390*.03}],390),{miss:'shallow'});
 assert.deepEqual(flickRead([{t:0,x:0,y:300},{t:80,x:0,y:380}],390),{miss:'down'});
 assert.deepEqual(flickRead(stroke(3,{lean:2}),390),{miss:'lean'});
 assert.deepEqual(flickRead([{t:0,x:0,y:300},{t:80,x:1,y:301}],390),{miss:null},'a tap only aims');
 assert.deepEqual(flickRead([{t:0,x:0,y:300},{t:40,x:0,y:200},{t:80,x:0,y:300}],390),{miss:null},'up and back is a deliberate cancel');
 // 浅い弾き（shortRise〜minRise）は弱い投げとして結果を返す（柄から当たる強さ）
 const short=flickPower([{t:0,x:0,y:300},{t:80,x:0,y:300-390*.05}],390);
 assert(short&&short.short&&short.raw<=FLICK.shortRaw&&short.raw<.42,'a shallow flick still throws, too weak to stick');
 // 45〜54°の斜めは、横のぶれを最大に張り付けて投げる
 const wild=flickPower(stroke(3,{lean:1.2}),390);assert(wild&&wild.wild);assert(Math.abs(wild.lean-FLICK.maxLean*FLICK.lean)<1e-9);
 assert.equal(flickPower(stroke(3,{lean:1.5}),390),null,'beyond wildLean is not a throw');
 assert.equal(flickPower([{t:0,x:0,y:300}],390),null);assert.equal(flickPower(stroke(3),0),null);assert.equal(flickPower([{t:0,x:0,y:NaN},{t:1,x:0,y:0}],390),null);
 assert.equal(flickPower([{t:80,x:0,y:300},{t:80,x:0,y:200}],390),null,'no elapsed time');
});
test('pull is distance-based, direction and bounds safe',()=>{assert.equal(pullPower({x:0,y:0},{x:0,y:142.6}),.62);assert.equal(pullPower({x:0,y:10},{x:0,y:0}),0);assert.equal(pullPower({x:0,y:0},{x:400,y:160}),null);assert.equal(pullPower(null,null),null);});
test('tap alone, unselected pull, wrong pointer, cancellation and duplicate release never spend throws',()=>{const s=new AxePullSession();assert.equal(s.beginPull(1,{x:0,y:0}),false);assert(s.aimAt({x:0,y:0}));assert(s.beginPull(1,{x:0,y:0}));assert.equal(s.release(2,{x:0,y:140}),null);assert.equal(s.release(1,{x:0,y:0}),null);assert.equal(s.shots.length,0);assert.equal(s.phase,'aim');assert(s.beginPull(1,{x:0,y:0}));s.movePull(1,{x:1,y:140});assert(s.cancelPull());assert.equal(s.release(1,{x:1,y:140}),null);assert.equal(s.shots.length,0);});
test('every aim, power and division delegates scoring to canonical model',()=>{for(const division of ['rec','am','pro'])for(const x of [-1.2,-.4,0,.4,1.2])for(const p of [.1,.42,.54,.62,.7,.82,.99]){const s=new AxePullSession({division});s.aimAt({x,y:.1});s.tick(764);const shot=pull(s,p);const actual=releaseAimAt(s.aim,764,shot.power,0,false,1);const expected=resolveThrow({x:actual.x,y:actual.y,power:shot.power,called:null},[],{division,throws:3});for(const key of Object.keys(expected))assert.deepEqual(shot[key],expected[key]);assert(s.impact());assert.equal(s.impact(),false);assert.equal(s.shots.length,1);}});
test('keyboard uses active clock, focus once, hold clamps, cancel resets without throw',()=>{const s=new AxePullSession();s.aimAt({x:0,y:0});assert(s.focus());assert.equal(s.focus(),false);s.beginPull('keyboard',{x:0,y:0},true);s.tick(744);assert.equal(s.power,.62);assert.equal(s.preview().sway.focused,true);const p=s.release('keyboard');assert.equal(p.power,.62);s.impact();s.next();assert.equal(s.focusUsed,false);s.aimAt({x:0,y:0});s.beginPull('keyboard',{x:0,y:0},true);s.tick(5000);assert.equal(s.power,1);s.cancelPull();assert.equal(s.power,0);});
test('practice and all ten throws finish with canonical rank/result and independent snapshots',()=>{for(const mode of ['practice','league'])for(const division of ['rec','am','pro']){const s=new AxePullSession({mode,division});while(s.phase!=='summary'){s.aimAt({x:0,y:0});pull(s);s.impact();s.next();}const r=s.result(true);assert(r.completed);assert.equal(r.cancelled,false);assert.equal(r.throws.length,mode==='practice'?3:10);assert.equal(r.total,totalOf(s.shots));assert.equal(r.ruleset,'watl-2026-lounge');assert(r.rank);assert.equal(s.beginPull(1,{x:0,y:0}),false);r.throws[0].score=999;assert.notEqual(s.shots[0].score,999);}});
test('declared kills stay explicit and limited, no inferred declaration from tapping blue',()=>{const s=new AxePullSession();const k=KILLS[0];s.aimAt(k);assert.equal(s.called,null);assert(s.declare(k.id));assert.equal(s.declare('unknown'),false);pull(s);s.impact();s.next();assert.equal(s.called,null);});
test('versus decisions and histories match the canonical deterministic match',()=>{for(const difficulty of ['easy','normal','hard']){const s=new AxePullSession({mode:'versus',difficulty});let match=createMatch(difficulty,11,'rec');let guard=0;while(s.phase!=='summary'&&guard++<100){if(s.actor==='player'&&s.phase==='aim'){s.aimAt({x:0,y:0});pull(s);} const pending=s.pending;assert(pending);match=takeTurn(match,s.actor,{...pending.aim,power:pending.power,called:pending.called,baseAim:pending.baseAim,sway:pending.sway});s.impact();s.next();assert.deepEqual(s.match,match);}assert.equal(s.phase,'summary');assert.equal(turnOf(match),null);assert(s.result(true).match.winner);}});
test('sudden death follows canonical calls without adding normal throws',()=>{const s=new AxePullSession({mode:'versus'});let m=createMatch('normal',11,'rec');for(let i=0;i<10;i++){m=takeTurn(m,'player',{x:0,y:0,power:.62});m=takeTurn(m,'opponent',{x:0,y:0,power:.62});}s.match=m;s.shots=m.player;s.phase='result';s.next();assert(s.suddenDeath);assert.equal(s.called,'upper-left');s.aimAt(KILLS[0]);pull(s);s.impact();assert.equal(s.shots.length,10);assert.equal(s.match.suddenDeath.length,1);assert.equal(s.match.suddenDeath[0].player.called,'upper-left');s.next();assert.equal(s.actor,'opponent');const ai=planOpponent(s.match);assert.deepEqual(s.pending.aim,{x:ai.x,y:ai.y});s.impact();s.next();assert(['aim','summary'].includes(s.phase));});
test('no save/reward writes or main runtime replacement; page uses shared deployment boot',()=>{const page=fs.readFileSync(new URL('../js/axe-pull-preview-page.js',import.meta.url),'utf8'),model=fs.readFileSync(new URL('../js/minigames/axe-pull-model.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../axe-pull-preview.html',import.meta.url),'utf8');assert(!/localStorage|sessionStorage|indexedDB|saveState|grantReward/.test(page+model));assert(html.includes('data-page="js/axe-pull-preview-page.js"'));assert(html.includes('name="suien-build"'));for(const event of ['pointercancel','lostpointercapture','visibilitychange','blur','resize'])assert(page.includes(event));});
test('invalid options do not unlock secret opponent',()=>{for(const option of [{mode:'x'},{division:'x'},{mode:'versus',difficulty:'secret'},{seed:-1},{steady:.1}])assert.throws(()=>new AxePullSession(option),RangeError);});
