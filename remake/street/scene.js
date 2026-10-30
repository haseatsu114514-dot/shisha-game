// 旧ハリボテ試作の8方向・反転・タップ/ダッシュを本編用の遠近通り/4コマへ。
// 親のinfo/enter/visited/back/paused/onReady/onLoadErrorだけを使用し、保存・訪問・報酬を変更しない。
import { VIEW, FLOOR, SPAWN, DOORS, CHARACTER_HEIGHT, STRIDE_LENGTH, camera, moveOnFloor, groundDistance, walkingPoint, toScreen, fromScreen, project, unproject, constrain, direction, inRect } from './model.js';
import { drawWalker, walkerFrame } from './gait.js';
const $ = (s) => document.querySelector(s), canvas = $('#view'), ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search), night = params.get('night') === '1';
const dirs = ['down', 'down_right', 'right', 'up_right', 'up'];
const mirror = { down_left: 'down_right', left: 'right', up_left: 'up_right' };
let host, ready = false, wasPaused = true, alwaysRun = false, target = null, message = '', travel = false, dragging = false;
let player = { ...SPAWN }, cam = camera(SPAWN), walked = 0, strideDistance=0, gaitDistance=0, moving = false, last = performance.now();
const gaitPhase = () => gaitDistance/STRIDE_LENGTH%1;
const gaitFrame = () => walkerFrame(gaitPhase(), moving);
const keys = new Set();
const stop = () => { keys.clear(); target = null; moving = false; gaitDistance = 0; dragging = false; };
const paused = () => !host || host.paused() || document.hidden;
const focus = () => canvas.focus({ preventScroll: true });
function fit() { $('#stage').style.setProperty('--k', Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h)); }
fit(); addEventListener('resize', fit);
$('#standalone').hidden = window.parent !== window;
const LOAD_TIMEOUT_MS = 8000;
const LOAD_FAIL_TEXT = '準備に時間がかかっています／読み込みに失敗しました。ピンマップへ戻れます';
let timedOut = false, loadFailed = false, readyNotified = false;
function image(src) {
  return new Promise(resolve => {
    let settled = false;
    const i = new Image();
    const timer = setTimeout(() => settle(null, true), LOAD_TIMEOUT_MS);
    function settle(value, timeout) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      i.onload = i.onerror = null;
      if (timeout) timedOut = true;
      resolve(value);
    }
    i.onload = () => settle(i, false);
    i.onerror = () => settle(null, false);
    i.src = src;
  });
}
function loadMeta() {
  const url = '../../assets/street_walk/hajime_walk_cycle_144.json';
  const read = (r) => { if (!r.ok) throw Error('sprite metadata'); return r.json(); };
  if (typeof AbortController !== 'function') {
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => { timedOut = true; resolve(null); }, LOAD_TIMEOUT_MS); });
    return Promise.race([fetch(url).then(read).catch(() => null), timeout]).finally(() => clearTimeout(timer));
  }
  const controller = new AbortController();
  let settled = false;
  const timer = setTimeout(() => { if (!settled) timedOut = true; controller.abort(); }, LOAD_TIMEOUT_MS);
  return fetch(url, { signal: controller.signal }).then(read).catch(() => null).finally(() => { settled = true; clearTimeout(timer); });
}
const bgPromise = image(`../img/street/arcade-${night ? 'night' : 'day'}.webp`);
const spritePromise = image('../../assets/street_walk/hajime_walk_cycle_144.png');
const metaPromise = loadMeta();
let bg, sprite, meta;
function showLoadNote() {
  const loading = $('#street-loading');
  if (!loading) return;
  if (loadFailed) { loading.hidden = false; loading.textContent = LOAD_FAIL_TEXT; return; }
  loading.hidden = ready;
}
// 完了通知は1回だけ。connectが先でも後でも届く。失敗しても代替描画のまま歩ける。
function notifyReady() {
  if (readyNotified || !ready || !host) return;
  readyNotified = true;
  if (loadFailed) host.onLoadError?.();
  host.onReady?.();
}
Promise.all([bgPromise, spritePromise, metaPromise]).then(values => {
  [bg, sprite, meta] = values;
  loadFailed = timedOut || (!bg && !sprite);
  ready = true;
  showLoadNote();
  notifyReady();
});
function say(text) { stop(); message = text; $('#msg').textContent = text; $('#msg').hidden = false; }
function dismiss() { stop(); message = ''; $('#msg').hidden = true; focus(); }
const foot = () => project(player);
function nearest() {
  const p = foot(); return DOORS.filter(d => Math.hypot(p.x - d.foot[0], p.y - d.foot[1]) < Math.max(12, 55 * p.scale))
    .sort((a,b) => Math.hypot(p.x-a.foot[0],p.y-a.foot[1])-Math.hypot(p.x-b.foot[0],p.y-b.foot[1]))[0];
}
function enter(door) {
  if (!host || paused() || !door) return;
  const info = host.info(door.id);
  if (info.ok) { stop(); host.enter(door.id); }
  else say(info.why);
}
function act() { if (paused() || !ready) return; if (message) return dismiss(); const d = nearest(); d ? enter(d) : say('入口の前まで歩こう。'); }
function setTravel(open) {
  stop(); travel = open; $('#travel').hidden = !open;
  if (!open) { focus(); return; }
  const list = $('#travel-list'); list.replaceChildren();
  const button = (label, door, enabled, callback) => {
    const b = document.createElement('button'); b.textContent = label; b.disabled = !enabled;
    if (door) b.dataset.door = door;
    b.onclick = () => { if (paused()) return; callback(); setTravel(false); }; list.append(b);
  };
  button('通りの入口', null, true, () => { player = { ...SPAWN }; cam=camera(player); walked=strideDistance=0; });
  for (const d of DOORS) button(host.visited(d.id) ? host.info(d.id).label : '？？？', d.id, host.visited(d.id), () => place(...d.foot, 'up'));
}
$('#btn-act').onclick = act;
$('#btn-map').onclick = () => { if (!paused() && ready && !message) setTravel(!travel); };
$('#btn-dash').onclick = () => { if (paused()) return; alwaysRun = !alwaysRun; $('#btn-dash').setAttribute('aria-pressed', String(alwaysRun)); focus(); };
const controls = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD','ShiftLeft','ShiftRight']);
addEventListener('keydown', e => {
  if (controls.has(e.code) || ['KeyZ','Enter','Space','KeyX','Escape','KeyM'].includes(e.code)) e.preventDefault();
  if (paused() || !ready) return;
  if (controls.has(e.code)) { if (!message && !travel) { target = null; keys.add(e.code); } return; }
  if (e.repeat) return;
  if (['KeyZ','Enter','Space'].includes(e.code)) act();
  if (['KeyX','Escape'].includes(e.code)) { if (message) dismiss(); else if (travel) setTravel(false); }
  if (e.code === 'KeyM' && !message) setTravel(!travel);
});
addEventListener('keyup', e => keys.delete(e.code)); addEventListener('blur', stop);
document.addEventListener('visibilitychange', stop);
const pointer = (e) => { const r=canvas.getBoundingClientRect(); return { x:(e.clientX-r.left)*VIEW.w/r.width, y:(e.clientY-r.top)*VIEW.h/r.height }; };
function aim(e) {
  if (paused() || !ready || travel) return;
  if (message) { dismiss(); return; }
  const raw = pointer(e), p = fromScreen(raw.x,raw.y,cam), d = DOORS.find(d => inRect(p.x,p.y,d.rect));
  const point = d ? {x:d.foot[0],y:d.foot[1]} : project(constrain(unproject(p.x,p.y)));
  if (!d && p.y < FLOOR.horizon + 40) return;
  keys.clear(); target = { ...point, door:d, back:!d&&p.y>=FLOOR.horizon+FLOOR.rise }; focus();
}
canvas.addEventListener('pointerdown', e => { dragging = true; canvas.setPointerCapture(e.pointerId); aim(e); });
canvas.addEventListener('pointermove', e => { if (dragging && !target?.door) aim(e); });
canvas.addEventListener('pointerup', () => dragging = false); canvas.addEventListener('pointercancel', () => { dragging = false; stop(); });
function place(x,y,dir='up') { stop(); player = {...constrain(unproject(x,y)),dir}; cam=camera(player); walked=strideDistance=0; }
function update(dt) {
  const isPaused=paused();
  if (isPaused) { stop(); wasPaused=true; return; }
  // pause中に古い入力は破棄済み。ready直後に届いた新しいキーまで消さない。
  if (wasPaused) { focus(); wasPaused=false; }
  if (!ready || message || travel) { stop(); return; }
  let dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  let dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  let goal;
  if (target) { goal={x:target.x,y:target.y}; const destination=walkingPoint(unproject(goal.x,goal.y)), current=walkingPoint(player); dx=destination.x-current.x; dy=destination.y-current.y; }
  const len=Math.hypot(dx,dy), run=alwaysRun||keys.has('ShiftLeft')||keys.has('ShiftRight');
  moving=len>.0001;
  if (!moving) { gaitDistance=0; if (target) { const {door:d,back}=target; target=null; if(back)host.back();else if(d)enter(d); } return; }
  player.dir=direction(dx,dy);
  const moved=moveOnFloor(player,dx,dy,dt,run,goal),distance=groundDistance(player,moved.player);
  Object.assign(player,moved.player); moving=distance>1e-6; walked+=distance;strideDistance+=moved.distance;gaitDistance=moving?gaitDistance+moved.distance:0;cam=camera(player);
  if (target && moved.arrived) { const {door:d,back}=target; stop(); if(back)host.back();else if(d)enter(d); return; }
  if (!target && player.z===0 && dy>0) { stop(); host.back(); }
}
function draw() {
  ctx.save();ctx.translate(cam.tx,cam.ty);ctx.scale(cam.zoom,cam.zoom);
  ctx.imageSmoothingEnabled=true;
  if(bg) ctx.drawImage(bg,0,0,VIEW.w,VIEW.h);
  else { ctx.fillStyle=night?'#262439':'#bbb6a6'; ctx.fillRect(0,0,VIEW.w,VIEW.h); ctx.fillStyle='#686479';
    ctx.beginPath();ctx.moveTo(595,380);ctx.lineTo(685,380);ctx.lineTo(1280,720);ctx.lineTo(0,720);ctx.fill();
    ctx.strokeStyle='#cbb49a';for(let y=410;y<720;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1280,y);ctx.stroke();} }
  ctx.restore(); if(!host) return;
  const raw=foot(), p=toScreen(raw.x,raw.y,cam), h=CHARACTER_HEIGHT*raw.scale*cam.zoom;
  const size=h/(meta?.charHeight||144);
  ctx.fillStyle='#17111a66';ctx.beginPath();ctx.ellipse(p.x,p.y-1,h*.2,h*.035,0,0,Math.PI*2);ctx.fill();
  if(sprite&&meta){const mirrored=!!mirror[player.dir],col=dirs.indexOf(mirror[player.dir]||player.dir);
    const [ax,ay]=meta.anchor;
    ctx.save();ctx.translate(p.x,p.y);ctx.scale(mirrored?-size:size,size);ctx.imageSmoothingEnabled=false;
    ctx.translate(-ax,-ay);drawWalker(ctx,sprite,meta,col,gaitPhase(),moving);ctx.restore();
  }else{ctx.fillStyle='#15111c';ctx.fillRect(p.x-h*.18,p.y-h,h*.36,h);ctx.fillStyle='#dbc3a9';ctx.fillRect(p.x-h*.13,p.y-h*.93,h*.26,h*.2);}
  for(const d of DOORS){const i=host.info(d.id),{x,y}=toScreen(...d.label,cam);if(x<-120||x>VIEW.w+120||y<-40||y>VIEW.h+40)continue;ctx.font='bold 19px system-ui';ctx.textAlign='center';
    const text=i.label,w=Math.max(108,ctx.measureText(text).width+24);ctx.fillStyle='#19131cdb';ctx.fillRect(x-w/2,y-21,w,48);
    ctx.strokeStyle=i.guided?'#fff3a1':i.ok?'#dfc181':'#756f77';ctx.strokeRect(x-w/2,y-21,w,48);ctx.fillStyle=i.ok?'#fff2cf':'#c0bac6';ctx.fillText(text,x,y);
    ctx.font='14px system-ui';ctx.fillText(i.tag||'',x,y+19);if(i.event){ctx.fillStyle='#f9dc73';ctx.font='bold 24px system-ui';ctx.fillText('!',x,y-30);}}
  const d=nearest();if(d&&!message&&!travel){ctx.fillStyle='#ffe29d';ctx.font='bold 24px system-ui';ctx.textAlign='center';ctx.fillText('!',p.x,p.y-h-12);}
}
// 通常のフレーム落ちは分割して全時間分進める。非表示/確認中の入力は破棄する。
function tick(now){let dt=Math.min(.25,(now-last)/1000);last=now;do{const step=Math.min(dt,1/120);update(step);dt-=step;}while(dt>1e-6);draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.streetScene={connect(adapter){host=adapter;stop();wasPaused=true;focus();notifyReady();}};
window.__street={
  state:()=>({ready,loading:!ready,timedOut,loadFailed,paused:paused(),night,alwaysRun,...toScreen(foot().x,foot().y,cam),z:player.z,
    worldX:foot().x,worldY:foot().y,worldScale:foot().scale,cameraZoom:cam.zoom,
    renderHeight:CHARACTER_HEIGHT*foot().scale*cam.zoom,camX:cam.tx,vanishing:toScreen(FLOOR.cx,FLOOR.horizon,cam),dir:player.dir,gaitFrame:gaitFrame(),gaitPhase:gaitPhase(),strideDistance,walked,moving,frames:4,msg:message,busy:false,
    travel:DOORS.map(d=>({id:d.id,off:!host?.visited(d.id)})),character:'hajime'}),
  layout:()=>({kind:'arcade',projection:'depth',view:VIEW,doors:DOORS.map(d=>{const a=toScreen(d.rect[0],d.rect[1],cam),f=toScreen(...d.foot,cam);return {...d,rect:[a.x,a.y,d.rect[2]*cam.zoom,d.rect[3]*cam.zoom],foot:[f.x,f.y]};}),spawn:project(SPAWN),setSource:bg?'image':'placeholder'}),
  warp(id){const d=DOORS.find(d=>d.id===id);if(d)place(...d.foot,'up');},place,
};
