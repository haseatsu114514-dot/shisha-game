// 手描き背景の床へ投影する。行き先選択以外のゲーム状態は持たない。
export const VIEW = { w: 1280, h: 720 };
export const FLOOR = { cx: 640, horizon: 350, rise: 330, halfWidth: 600, depth: 1.3 };
export const SPAWN = { x: 0, z: .04, dir: 'up' };
export const DOORS = [
  { id: 'cafe', rect: [54, 270, 150, 270], foot: [235, 592], label: [160, 252] },
  { id: 'peppermint', rect: [1116, 280, 100, 274], foot: [1060, 592], label: [1110, 258] },
  { id: 'kemurikusa', rect: [662, 335, 52, 52], foot: [678, 408], label: [720, 307] },
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
export function inRect(x, y, [rx, ry, w, h]) { return x >= rx && x <= rx + w && y >= ry && y <= ry + h; }
export function direction(dx, dy) {
  return ['right', 'down_right', 'down', 'down_left', 'left', 'up_left', 'up', 'up_right'][(Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8];
}
