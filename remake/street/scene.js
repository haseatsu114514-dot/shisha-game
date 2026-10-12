// 旧ハリボテ試作の8方向・足元基準・2コマ・反転・タップ/ダッシュを本編用の遠近通りへ。
// 親のinfo/enter/visited/back/pausedだけを使用し、保存・訪問・報酬を変更しない。
import { VIEW, FLOOR, SPAWN, DOORS, project, unproject, constrain, direction, inRect } from './model.js';
const $ = (s) => document.querySelector(s), canvas = $('#view'), ctx = canvas.getContext('2d');
const params = new URLSearchParams(location.search), night = params.get('night') === '1';
const dirs = ['down', 'down_right', 'right', 'up_right', 'up'];
const mirror = { down_left: 'down_right', left: 'right', up_left: 'up_right' };
let host, ready = false, wasPaused = true, alwaysRun = false, target = null, message = '', travel = false;
let player = { ...SPAWN }, clock = 0, moving = false, last = performance.now();
const keys = new Set();
const stop = () => { keys.clear(); target = null; moving = false; };
const paused = () => !host || host.paused() || document.hidden;
const focus = () => canvas.focus({ preventScroll: true });
function fit() { $('#stage').style.setProperty('--k', Math.min(innerWidth / VIEW.w, innerHeight / VIEW.h)); }
fit(); addEventListener('resize', fit);
$('#standalone').hidden = window.parent !== window;
function image(src) { return new Promise(resolve => { const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = src; }); }
const bgPromise = image(`../img/street/arcade-${night ? 'night' : 'day'}.webp`);
const spritePromise = image('../../assets/street_walk/hajime_walk_72.png');
const metaPromise = fetch('../../assets/street_walk/hajime_walk_72.json').then(r => { if (!r.ok) throw Error('sprite metadata'); return r.json(); }).catch(() => null);
let bg, sprite, meta;
Promise.all([bgPromise, spritePromise, metaPromise]).then(values => { [bg, sprite, meta] = values; ready = true; });
function say(text) { stop(); message = text; $('#msg').textContent = text; $('#msg').hidden = false; }
function dismiss() { stop(); message = ''; $('#msg').hidden = true; focus(); }
const foot = () => project(player);
function nearest() {
  const p = foot(); return DOORS.filter(d => Math.hypot(p.x - d.foot[0], p.y - d.foot[1]) < Math.max(30, 75 * p.scale))
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
  button('通りの入口', null, true, () => { player = { ...SPAWN }; });
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
let dragging = false;
function aim(e) {
  if (paused() || !ready || travel) return;
  if (message) { dismiss(); return; }
  const p = pointer(e), d = DOORS.find(d => inRect(p.x,p.y,d.rect));
  const point = d ? {x:d.foot[0],y:d.foot[1]} : project(constrain(unproject(p.x,p.y)));
  if (!d && p.y < FLOOR.horizon + 40) return;
  keys.clear(); target = { ...point, door:d, run:Math.hypot(point.x-foot().x,point.y-foot().y)>144 }; focus();
}
canvas.addEventListener('pointerdown', e => { dragging = true; canvas.setPointerCapture(e.pointerId); aim(e); });
canvas.addEventListener('pointermove', e => { if (dragging && !target?.door) aim(e); });
canvas.addEventListener('pointerup', () => dragging = false); canvas.addEventListener('pointercancel', () => { dragging = false; stop(); });
function place(x,y,dir='up') { stop(); player = {...constrain(unproject(x,y)),dir}; }
function update(dt) {
  const isPaused=paused();
  if (isPaused) { stop(); wasPaused=true; return; }
  if (wasPaused) { stop(); focus(); wasPaused=false; }
  if (!ready || message || travel) { stop(); return; }
  let dx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  let dy=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  const p=foot();
  if (target) { dx=target.x-p.x; dy=target.y-p.y; }
  const len=Math.hypot(dx,dy), run=alwaysRun||keys.has('ShiftLeft')||keys.has('ShiftRight')||target?.run;
  const step=(run?140:80)*dt; moving=len>.5;
  if (!moving) { if (target) { const d=target.door; target=null; if(d) enter(d); } return; }
  player.dir=direction(dx,dy);
  if (target && len<=step) { const d=target.door; place(target.x,target.y,player.dir); if(d) enter(d); return; }
  const next=unproject(p.x+dx/len*step,p.y+dy/len*step);
  if (next.z<0 && dy>0) { stop(); host.back(); return; }
  Object.assign(player,constrain(next)); clock+=dt;
}
function draw() {
  ctx.imageSmoothingEnabled=true;
  if(bg) ctx.drawImage(bg,0,0,VIEW.w,VIEW.h);
  else { ctx.fillStyle=night?'#262439':'#bbb6a6'; ctx.fillRect(0,0,VIEW.w,VIEW.h); ctx.fillStyle='#686479';
    ctx.beginPath();ctx.moveTo(595,380);ctx.lineTo(685,380);ctx.lineTo(1280,720);ctx.lineTo(0,720);ctx.fill();
    ctx.strokeStyle='#cbb49a';for(let y=410;y<720;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1280,y);ctx.stroke();} }
  if(!host) return;
  const p=foot(), size=2*p.scale;
  ctx.fillStyle='#17111a66';ctx.beginPath();ctx.ellipse(p.x,p.y-1,26*size,5*size,0,0,Math.PI*2);ctx.fill();
  if(sprite&&meta){const mirrored=!!mirror[player.dir],col=dirs.indexOf(mirror[player.dir]||player.dir),row=moving?Math.floor(clock/.16)%2:0;
    const [cw,ch]=meta.cell,[ax,ay]=meta.anchor;ctx.save();ctx.translate(p.x,p.y);ctx.scale(mirrored?-size:size,size);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(sprite,col*cw,row*ch,cw,ch,-ax,-ay,cw,ch);ctx.restore();
  }else{ctx.fillStyle='#15111c';ctx.fillRect(p.x-12*size,p.y-64*size,24*size,64*size);ctx.fillStyle='#dbc3a9';ctx.fillRect(p.x-9*size,p.y-60*size,18*size,15*size);}
  for(const d of DOORS){const i=host.info(d.id),[x,y]=d.label;ctx.font='bold 19px system-ui';ctx.textAlign='center';
    const text=i.label,w=Math.max(108,ctx.measureText(text).width+24);ctx.fillStyle='#19131cdb';ctx.fillRect(x-w/2,y-21,w,48);
    ctx.strokeStyle=i.guided?'#fff3a1':i.ok?'#dfc181':'#756f77';ctx.strokeRect(x-w/2,y-21,w,48);ctx.fillStyle=i.ok?'#fff2cf':'#c0bac6';ctx.fillText(text,x,y);
    ctx.font='14px system-ui';ctx.fillText(i.tag||'',x,y+19);if(i.event){ctx.fillStyle='#f9dc73';ctx.font='bold 24px system-ui';ctx.fillText('!',x,y-30);}}
  const d=nearest();if(d&&!message&&!travel){ctx.fillStyle='#ffe29d';ctx.font='bold 24px system-ui';ctx.textAlign='center';ctx.fillText('!',p.x,p.y-152*p.scale);}
}
function tick(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
window.streetScene={connect(adapter){host=adapter;stop();wasPaused=true;focus();}};
window.__street={
  state:()=>({ready,paused:paused(),night,alwaysRun,x:foot().x,y:foot().y,z:player.z,scale:foot().scale,camX:0,msg:message,busy:false,
    travel:DOORS.map(d=>({id:d.id,off:!host?.visited(d.id)})),character:'hajime'}),
  layout:()=>({kind:'arcade',projection:'depth',view:VIEW,doors:DOORS,spawn:project(SPAWN),setSource:bg?'image':'placeholder'}),
  warp(id){const d=DOORS.find(d=>d.id===id);if(d)place(...d.foot,'up');},place,
};
