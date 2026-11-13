import { AxePullSession, SCENE, scenePoint, boardPoint } from './minigames/axe-pull-model.js';
import { BOARD, RINGS, LINE, CLUSTERS, KILLS, BLADE, closuresOf, canCall, totalOf } from './minigames/axe-model.js';
import { flightPose, flightTime, flightDuration, TARGET } from './minigames/axe-flight.js';
import { projectedAxe } from './minigames/axe-geometry.js';
import { AXE_EQUIPMENT, PERSONAL_AXES, HOUSE_AXE, bestOwnedAxe, ownsAxe, axePurchaseStatus, buyAxe, axeGreenBand, axeEffect } from './minigames/axe-equipment.js';
const $ = id => document.getElementById(id), svg = $('scene'), ns = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent = svg) => { const n = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); parent.append(n); return n; };
// This wallet is deliberately memory-only. No main-game state or save API is imported.
const demoWallet = { chapter: 1, money: 100000, owned: [] };
let game, last = 0, flight = 0, blocked = false, pointer = null, space = false;
const fingers = new Set(), labels = ['左上', '右上', '左下', '右下'];
const point = event => scenePoint(svg.getBoundingClientRect(), event.clientX, event.clientY);
const scale = () => Math.min(svg.clientWidth / SCENE.width, svg.clientHeight / SCENE.height);
// Pull controls sit in the viewport HUD, not inside the letterboxed world.
const pullPoint = event => event.clientX < 0 || event.clientY < 0 || event.clientX > innerWidth || event.clientY > innerHeight ? null : { x: event.clientX / scale(), y: event.clientY / scale() };
const focusScene = () => svg.focus({ preventScroll: true });
// Code-native temporary scene. No unapproved generated art, no baked scoring marks.
svg.innerHTML = `<defs><linearGradient id="wall" x2="0" y2="1"><stop stop-color="#5a4937"/><stop offset="1" stop-color="#241f1b"/></linearGradient><linearGradient id="floor" x2="0" y2="1"><stop stop-color="#20282a"/><stop offset="1" stop-color="#0a1318"/></linearGradient><radialGradient id="light"><stop stop-color="#f6d5a1" stop-opacity=".17"/><stop offset="1" stop-color="#f6d5a1" stop-opacity="0"/></radialGradient><pattern id="mesh" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M0 14L14 0 28 14 14 28Z" fill="none" stroke="#76817b" stroke-opacity=".22" stroke-width="2"/></pattern></defs><rect width="1600" height="900" fill="#171f22"/><path d="M350 0H1250L1180 800H420Z" fill="url(#wall)"/><path d="M0 0H350L420 800 0 900ZM1250 0H1600V900L1180 800Z" fill="url(#mesh)"/><path d="M0 900L420 800H1180L1600 900Z" fill="url(#floor)"/><path d="M120 0L420 800M1480 0L1180 800M0 700L420 650M1600 700L1180 650" stroke="#3e4a48" stroke-width="9"/><ellipse cx="800" cy="370" rx="670" ry="540" fill="url(#light)"/><path d="M540 28H1060" stroke="#e7c18a" stroke-width="9"/><path d="M250 885H1350" stroke="#d5b46e" stroke-width="7" opacity=".6"/>`;
const board = el('g', { transform: `translate(${SCENE.cx} ${SCENE.cy}) scale(${SCENE.radius})` });
for (let i = 0; i < 5; i++) { const x = BOARD.left + i * (BOARD.right - BOARD.left) / 5; el('rect', { x, y: BOARD.top, width: (BOARD.right - BOARD.left) / 5, height: BOARD.bottom - BOARD.top, fill: ['#c9a777','#d0b185','#c2a071','#cfaf7f','#c8a675'][i], stroke: '#6a5038', 'stroke-width': .009 }, board); for (let j = 0; j < 8; j++) el('path', { d: `M${x + .04 + j * .055} ${BOARD.top}q.035 .6 0 1.2t.01 1.46`, fill: 'none', stroke: '#7b5b38', opacity: .18, 'stroke-width': .003 }, board); }
for (const r of RINGS.slice(2).reverse()) el('circle', { r: r.radius, fill: 'none', stroke: '#222827', 'stroke-width': LINE * 2 }, board);
const clusters = CLUSTERS.map(c => { const g = el('g', { transform: `translate(${c.x} ${c.y})` }, board); const five = el('circle', { r: RINGS[1].radius, fill: 'none', stroke: '#252927', 'stroke-width': LINE * 2 }, g); const bull = el('circle', { r: RINGS[0].radius, fill: '#a83127' }, g); const closed = el('path', { d: 'M-.09 -.09L.09 .09M.09 -.09L-.09 .09', stroke: '#e3dfce', 'stroke-width': .018, visibility: 'hidden' }, g); return { ...c, five, bull, closed }; });
const kills = KILLS.map(k => { const g = el('g', { transform: `translate(${k.x} ${k.y})` }, board); el('circle', { r: k.outer, fill: '#337c97' }, g); el('circle', { r: k.inner, fill: '#68bcd1' }, g); const call = el('circle', { r: k.outer + .025, fill: 'none', stroke: '#b8eeff', 'stroke-width': .01, visibility: 'hidden' }, g); return { ...k, call }; });
const marks = el('g', {}, board), reticle = el('g', {}), predicted = el('circle', { r: 6, fill: '#e8f8dd', stroke: '#203b35', 'stroke-width': 2 });
el('circle', { r: 17, fill: 'none', stroke: '#f2e9c8', 'stroke-width': 2 }, reticle); el('path', { d: 'M-27 0H-11M11 0H27M0 -27V-11M0 11V27', stroke: '#f2e9c8', 'stroke-width': 2 }, reticle);
const hands = el('g', {}); hands.innerHTML = `<path d="M1600 900H1130L1060 750 1090 685 1160 695Z" fill="#252a30" stroke="#111b20" stroke-width="8"/><path d="M1090 730L1060 670Q1053 638 1075 633L1118 638 1145 694 1125 736Z" fill="#cfa37c" stroke="#624e41" stroke-width="4"/><path d="M1200 900H900L1025 744 1100 736 1130 780Z" fill="#20282e" stroke="#10191d" stroke-width="8"/><path d="M1070 752L1052 715Q1050 696 1074 698L1120 706Q1142 720 1130 752L1114 775Z" fill="#d3ab84" stroke="#624e41" stroke-width="4"/><path d="M1107 754L1065 440" stroke="#422d1c" stroke-width="27"/><path d="M1107 754L1065 440" stroke="#af7d45" stroke-width="18"/><path d="M1065 440L981 409 955 454 1049 492 1084 477 1081 445Z" fill="#455159" stroke="#152027" stroke-width="5"/><path d="M981 409L955 454 978 463 999 418Z" fill="#b6c0bc"/>`;
const axe = el('g', {}), bladeFlash = el('circle', { r: 25, fill: 'none', stroke: '#f2d398', 'stroke-width': 3, visibility: 'hidden' });
// Reuse the production solid mesh, including depth sorting and the blade-contact pivot.
function drawAxe(shot, ms) {
  axe.replaceChildren();
  const pose = flightPose(shot, flightTime(ms, Boolean(shot.called)));
  const k = SCENE.radius / TARGET.radius;
  for (const face of projectedAxe(pose).polygons) {
    el('polygon', { points: face.points.map(p => `${SCENE.cx + (p.x + pose.pixelX - TARGET.x) * k},${SCENE.cy + (p.y + pose.pixelY - TARGET.y) * k}`).join(' '), fill: face.fill, stroke: '#18262a', 'stroke-width': 1, opacity: pose.opacity }, axe);
  }
}
for (const [i,k] of KILLS.entries()) { const b=document.createElement('button'); b.textContent=`青 ${labels[i]}`; b.dataset.call=k.id; b.addEventListener('click',()=>{ if(game.declare(game.called===k.id?null:k.id)) {focusScene();update();} }); $('calls').append(b); }
function cancel() { game?.cancelPull(); space=false; if(pointer!==null) { const id=pointer; pointer=null; if($('grip').hasPointerCapture(id)) $('grip').releasePointerCapture(id); } }
function start() { cancel(); game=new AxePullSession({mode:$('mode').value,division:$('division').value,difficulty:$('difficulty').value,equipmentId:ownsAxe(demoWallet,$('equipment').value)?$('equipment').value:bestOwnedAxe(demoWallet).id}); flight=0; marks.replaceChildren(); axe.replaceChildren(); $('menu').close(); $('summary').close(); blocked=false; last=0; update(); focusScene(); }
function update() {
  const active=game.canAim()||game.phase==='pull'; $('score').textContent=`${totalOf(game.shots)} pt · ${Math.min(game.shots.length+1,game.rules.throws)}/${game.rules.throws}${game.match?`\nひより ${totalOf(game.match.opponent)} pt`:''}`;
  $('instruction').textContent=game.phase==='result'?`${game.actor==='opponent'?'ひより · ':''}${game.last.score}点${game.last.stuck?'':' / 落下'}`:game.phase==='flight'?(game.actor==='opponent'?'ひよりの投球':''):game.suddenDeath?'サドンデス · 指定の青を狙う':!game.selected?'的をタップして、狙いを決める':game.phase==='pull'?'緑の位置で、離す':'右のハンドルを引く';
  $('next').hidden=game.phase!=='result'; $('next').textContent=game.match&&game.actor==='player'?'ひよりの投球へ':game.shots.length===game.rules.throws?'結果へ':'次の投球'; $('pull').hidden=!active; $('grip').disabled=!active||!game.selected; $('focus').disabled=!active||!game.selected||game.focusUsed;
  for (const b of $('calls').children) { b.disabled=!game.canAim()||game.suddenDeath||!canCall(b.dataset.call,game.shots,game.rules.throws); b.setAttribute('aria-pressed',String(game.called===b.dataset.call)); }
  const closed=closuresOf(game.shots,game.shots.length,game.rules.throws,game.division);
  for (const c of clusters) { c.bull.setAttribute('fill',closed.bull.has(c.id)||closed.cluster.has(c.id)?'#716b5d':'#a83127'); c.closed.setAttribute('visibility',closed.cluster.has(c.id)?'visible':'hidden'); c.five.setAttribute('stroke',closed.five.has(c.id)?'#797162':'#252927'); }
  for(const k of kills) k.call.setAttribute('visibility',game.called===k.id?'visible':'hidden');
  renderAim();
}
function renderAim() { const active=game.actor==='player'&&['aim','pull'].includes(game.phase); hands.setAttribute('visibility',active?'visible':'hidden'); hands.setAttribute('transform',`translate(0 ${game.power*90})`); reticle.setAttribute('visibility',active&&game.selected?'visible':'hidden'); predicted.setAttribute('visibility',active&&game.selected?'visible':'hidden'); if(active&&game.selected) { reticle.setAttribute('transform',`translate(${SCENE.cx+game.aim.x*SCENE.radius} ${SCENE.cy+game.aim.y*SCENE.radius})`); const p=game.preview(); predicted.setAttribute('cx',SCENE.cx+p.aim.x*SCENE.radius); predicted.setAttribute('cy',SCENE.cy+p.aim.y*SCENE.radius); }
  const band=axeGreenBand(game.equipment.id); $('track').querySelector('i').style.top=`${band.min*100}%`; $('track').querySelector('i').style.height=`${(band.max-band.min)*100}%`; $('grip').style.background=game.equipment.grip;
  const distance=SCENE.pullDistance*scale(); $('track').style.height=`${distance}px`; $('power-label').style.top=`${distance+55}px`; $('power').style.height=`${game.power*100}%`; $('grip').style.setProperty('--pull',`${game.power*distance}px`); $('power-label').textContent=`${Math.round(game.power*100)}%`; }
function beginFlight() { flight=0; axe.replaceChildren(); bladeFlash.setAttribute('visibility','hidden'); update(); }
function release(id,p) { if(game.release(id,p)) beginFlight(); else update(); }
svg.addEventListener('pointerdown',e=>{ if(e.button!==0||!e.isPrimary||fingers.size>1||blocked)return; const p=boardPoint(point(e)); if(game.aimAt(p)) { focusScene(); update(); } });
window.addEventListener('pointerdown',e=>{ fingers.add(e.pointerId); if(fingers.size>1) {cancel();update();} },true);
window.addEventListener('pointerup',e=>fingers.delete(e.pointerId));
window.addEventListener('pointercancel',e=>{fingers.delete(e.pointerId);cancel();update();});
$('grip').addEventListener('pointerdown',e=>{ if(e.button!==0||!e.isPrimary||fingers.size>1||blocked)return; e.preventDefault(); if(game.beginPull(e.pointerId,pullPoint(e))) {pointer=e.pointerId; $('grip').setPointerCapture(pointer); update();} });
$('grip').addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return; game.movePull(pointer,pullPoint(e)); if(game.phase!=='pull')cancel(); renderAim();});
$('grip').addEventListener('pointerup',e=>{if(pointer!==e.pointerId)return; const id=pointer; pointer=null; release(id,pullPoint(e)); if($('grip').hasPointerCapture(id))$('grip').releasePointerCapture(id);});
$('grip').addEventListener('lostpointercapture',()=>{if(pointer!==null){cancel();update();}});
$('focus').addEventListener('click',()=>{game.focus();focusScene();update();});
$('next').addEventListener('click',()=>{ if(!game.next())return; bladeFlash.setAttribute('visibility','hidden'); axe.replaceChildren(); if(game.phase==='summary') {const r=game.result(true); $('result').textContent=`${r.total} / ${r.maximum}点\nランク ${r.rank} · ${game.equipment.name}${r.match?`\n${r.match.winner==='player'?'あなたの勝ち':'ひよりの勝ち'}`:''}\nセーブ・報酬には反映しません`; $('summary').showModal();blocked=true;} else if(game.phase==='flight')beginFlight(); update(); if(game.phase==='aim')focusScene(); });
function menu() {cancel();blocked=true;$('menu').showModal();update();}
$('settings').addEventListener('click',menu); $('restart').addEventListener('click',start); $('again').addEventListener('click',start); $('summary-settings').addEventListener('click',()=>{$('summary').close();menu();});
$('menu').addEventListener('close',()=>{blocked=$('summary').open;last=0;if(!blocked)focusScene();}); $('summary').addEventListener('cancel',e=>e.preventDefault());
window.addEventListener('keydown',e=>{ if(blocked||['SELECT','INPUT','BUTTON'].includes(e.target.tagName)&&e.code!=='Escape')return; if(e.code==='Escape'){e.preventDefault();if(game.phase==='pull'){cancel();update();}else menu();return;} if(e.code==='Space'){e.preventDefault();if(!e.repeat&&!space&&game.beginPull('keyboard',{x:0,y:0},true)){space=true;update();}return;} if(e.code==='KeyF'){e.preventDefault();if(!e.repeat){game.focus();update();}return;} const d={ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,-.025],ArrowDown:[0,.025]}[e.code]; if(d){e.preventDefault();game.aimAt({x:game.aim.x+d[0],y:game.aim.y+d[1]});update();} });
window.addEventListener('keyup',e=>{if(e.code==='Space'&&space){e.preventDefault();space=false;if(!blocked)release('keyboard');else cancel();}});
function suspend(){cancel();fingers.clear();last=0;update();}
window.addEventListener('blur',suspend); window.addEventListener('resize',suspend); document.addEventListener('visibilitychange',suspend);
function frame(now) { const dt=last?Math.min(now-last,100):0;last=now; if(!blocked&&!document.hidden&&document.hasFocus()){ game.tick(dt); if(game.phase==='flight'){flight+=dt;drawAxe(game.pending,flight);if(flight>=flightDuration(game.pending,Boolean(game.pending.called))){const s=game.pending;game.impact();if(s.stuck){el('path',{d:`M${s.landing.x} ${s.landing.y-BLADE.halfLength}V${s.landing.y+BLADE.halfLength}`,stroke:s.score?'#3b3124':'#70634d','stroke-width':.012},marks);bladeFlash.setAttribute('cx',SCENE.cx+s.landing.x*SCENE.radius);bladeFlash.setAttribute('cy',SCENE.cy+s.landing.y*SCENE.radius);bladeFlash.setAttribute('visibility',s.score?'visible':'hidden');}update();}} renderAim();} requestAnimationFrame(frame); }
function renderShop(preferred) {
  $('wallet').textContent = `試作用所持金 ${demoWallet.money.toLocaleString('ja-JP')}円`;
  const previous = typeof preferred === 'string' ? preferred : $('equipment').value;
  $('equipment').replaceChildren();
  for (const gear of [HOUSE_AXE, ...PERSONAL_AXES]) if (ownsAxe(demoWallet, gear.id)) {
    const option = document.createElement('option'); option.value = gear.id; option.textContent = gear.name; $('equipment').append(option);
  }
  $('equipment').value = ownsAxe(demoWallet, previous) ? previous : bestOwnedAxe(demoWallet).id;
  $('axe-offers').replaceChildren();
  for (const gear of PERSONAL_AXES) {
    const button = document.createElement('button'); button.type = 'button';
    const status = axePurchaseStatus(demoWallet, gear.id); button.disabled = !status.ok;
    button.textContent = `${gear.name} · ${gear.price.toLocaleString('ja-JP')}円${status.reason === 'owned' ? ' · 所持済み' : status.reason === 'money' ? ' · 残高不足' : ''} / ${axeEffect(gear)}`;
    button.addEventListener('click', () => { if (buyAxe(demoWallet, gear.id)) { renderShop(bestOwnedAxe(demoWallet).id); } });
    $('axe-offers').append(button);
  }
  $('axe-effect').textContent = axeEffect(AXE_EQUIPMENT[$('equipment').value] || HOUSE_AXE) + '。この設定で最初から、で反映。点数・刃の大きさは共通。';
}
$('equipment').addEventListener('change', renderShop);
renderShop(); start(); requestAnimationFrame(frame);
