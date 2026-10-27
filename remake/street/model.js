// 手描き背景の床へ投影する。行き先選択以外のゲーム状態は持たない。
export const VIEW = { w: 1280, h: 720 };
export const FLOOR = { cx: 640, horizon: 350, rise: 330, halfWidth: 600, depth: 1.3 };
export const SPAWN = { x: 0, z: .04, dir: 'up' };
// 3入口の足元で人物高が扉高の約83%になるよう、同じ世界縮尺で校正。
export const CHARACTER_HEIGHT = 302.4;
// 背景上の移動量を人物高で校正する。奥行きの二乗で縦移動を遅くしない。
export const WALK_SPEED = 420, RUN_SPEED = 660, STRIDE_LENGTH = 250;
// 左右は中央から端まで約1秒。奥行きと入力・カメラの即応性は維持する。
export const SIDE_SPEED = 1.4, DEPTH_SPEED = .55;
const CAMERA_ZOOM_EXPONENT = .55;
export const DOORS = [
  { id: 'cafe', rect: [54, 270, 150, 270], foot: [235, 592], label: [160, 252] },
  { id: 'peppermint', rect: [1116, 280, 100, 274], foot: [1060, 592], label: [1110, 258] },
  { id: 'kemurikusa', rect: [662, 335, 52, 52], foot: [678, 397], label: [720, 307] },
];
export function project({ x, z }) {
  const scale = 1 / (1 + 5 * z);
  return { x: FLOOR.cx + x * FLOOR.halfWidth * scale, y: FLOOR.horizon + FLOOR.rise * scale, scale };
}
export function unproject(x, y) {
  const scale = Math.max(.001, (y - FLOOR.horizon) / FLOOR.rise);
  return { x: (x - FLOOR.cx) / (FLOOR.halfWidth * scale), z: (1 / scale - 1) / 5 };
}
export function constrain(p) {
  return { x: Math.max(-.98, Math.min(.98, p.x)), z: Math.max(0, Math.min(FLOOR.depth, p.z)) };
}
export function camera(player) {
  const ratio = project(SPAWN).scale / project(player).scale;
  return cameraAtZoom(Math.max(1, ratio ** CAMERA_ZOOM_EXPONENT));
}
function cameraAtZoom(zoom) {
  // 消失点は固定。人物の足元を画面下へ引き戻すズーム/横追従をしない。
  return { zoom, tx:FLOOR.cx*(1-zoom), ty:FLOOR.horizon*(1-zoom) };
}
export function followCamera(current, player, dt) {
  // 位置との一対一対応。停止後にズームだけ進む遅れを作らない。
  return camera(player);
}
export function groundDistance(a,b) { return Math.hypot(a.x-b.x,5*(a.z-b.z)); }
// カメラのズームも含めた、歩く人物の足元と表示倍率。
// 床だけの投影座標で移動すると、奥へ進むときの足元だけがズームで遅くなる。
export function walkingPoint(player) {
  const p=project(player),cam=camera(player),screen=toScreen(p.x,p.y,cam);
  return {...screen,scale:p.scale*cam.zoom};
}
function unprojectWalkingPoint(x,y) {
  const visibleScale=Math.max(.001,(y-FLOOR.horizon)/FLOOR.rise);
  const spawnScale=project(SPAWN).scale;
  const scale=visibleScale>=spawnScale ? visibleScale :
    (visibleScale/spawnScale**CAMERA_ZOOM_EXPONENT)**(1/(1-CAMERA_ZOOM_EXPONENT));
  return {x:(x-FLOOR.cx)/(FLOOR.halfWidth*visibleScale),z:(1/scale-1)/5};
}
export function moveOnFloor(player, dx, dy, dt, run=false, goal=null) {
  const start=walkingPoint(player),len=Math.hypot(dx,dy);
  if(len<1e-6)return { player:{...player},distance:0,arrived:!!goal };
  // 斜めも向きを変えず、横・奥行きそれぞれの距離に応じて速さを決める。
  const nx=dx/len,ny=dy/len;
  const pace=1/Math.hypot(nx/SIDE_SPEED,ny/DEPTH_SPEED);
  const speed=(run?RUN_SPEED:WALK_SPEED)*pace;
  const k=ny*speed/FLOOR.rise;
  const step=speed*start.scale*(Math.abs(k)<1e-9?dt:Math.expm1(k*dt)/k);
  const goalPoint=goal?walkingPoint(unproject(goal.x,goal.y)):null;
  const remaining=goalPoint?Math.hypot(goalPoint.x-start.x,goalPoint.y-start.y):Infinity;
  const amount=Math.min(step,remaining);
  const next=constrain(unprojectWalkingPoint(start.x+nx*amount,start.y+ny*amount));
  const end=walkingPoint(next),scale=(start.scale+end.scale)/2;
  // 遠近による画面上の歩幅差を補正し、向きが変わっても足運びの周期を保つ。
  return {player:next,distance:Math.hypot(end.x-start.x,end.y-start.y)/scale/pace,
    arrived:!!goalPoint&&Math.hypot(end.x-goalPoint.x,end.y-goalPoint.y)<1e-4};
}
export function toScreen(x, y, cam) { return { x: x * cam.zoom + cam.tx, y: y * cam.zoom + cam.ty }; }
export function fromScreen(x, y, cam) { return { x: (x - cam.tx) / cam.zoom, y: (y - cam.ty) / cam.zoom }; }
export function inRect(x, y, [rx, ry, w, h]) { return x >= rx && x <= rx + w && y >= ry && y <= ry + h; }
export function direction(dx, dy) {
  return ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
