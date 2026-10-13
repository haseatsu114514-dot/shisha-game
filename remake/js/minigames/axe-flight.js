// First-person camera, looking along +Z. +Y points down; the board is in the distance.
// This is presentation only. The saved shot and score still come from axe-model.js.
export const TARGET = { x: 330, y: 245, radius: 164 };
export const CAMERA = { focal: 700, boardDepth: 650 };
export const AXE = { blade: { x: 0, y: -28, z: 62 }, handleTip: { x: 0, y: 160, z: -3 } };
export const FLIGHT = { travel: 920, fall: 360 };
export function turnPoint(point, pitch) {
  const a = pitch * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
  return { x: point.x, y: point.y * c - point.z * s, z: point.y * s + point.z * c };
}
export function worldPoint(pose, point) {
  const p = turnPoint(point, pose.pitch);
  return { x: pose.x + p.x, y: pose.y + p.y, z: pose.z + p.z };
}
export function projectPoint(point) {
  const scale = CAMERA.focal / (CAMERA.focal + point.z);
  return { x: TARGET.x + point.x * scale, y: TARGET.y + point.y * scale };
}
export const projectAxePoint = (pose, point) => projectPoint(worldPoint(pose, point));
function decorate(pose) {
  const center = projectPoint(pose), blade = projectAxePoint(pose, AXE.blade);
  return { ...pose, pixelX: center.x, pixelY: center.y, bladeX: blade.x, bladeY: blade.y,
    scale: CAMERA.focal / (CAMERA.focal + pose.z) };
}
export function impactPose(shot) {
  // Forward tumble around the horizontal world axis, never a roll in the screen plane.
  const pitch = -shot.rotation, blade = turnPoint(AXE.blade, pitch);
  const inverseScale = (CAMERA.focal + CAMERA.boardDepth) / CAMERA.focal;
  return decorate({ x: shot.landing.x * TARGET.radius * inverseScale - blade.x,
    y: shot.landing.y * TARGET.radius * inverseScale - blade.y,
    z: CAMERA.boardDepth - blade.z, pitch, opacity: 1 });
}
export const poseTransform = pose => `translate(${pose.pixelX} ${pose.pixelY})`;
export function flightPose(shot, milliseconds) {
  const t = Math.min(1, Math.max(0, milliseconds / FLIGHT.travel)), end = impactPose(shot);
  // Overhead release, just to the right of the player's eyes. Gravity bends the world path.
  const start = { x: 105 * 780 / 700, y: -125 * 780 / 700, z: 80 };
  const pose = t === 1 ? { ...end } : {
    x: start.x + (end.x - start.x) * t,
    y: start.y + (end.y - start.y) * t - 48 * 4 * t * (1 - t),
    z: start.z + (end.z - start.z) * t, pitch: -shot.rotation * t, opacity: 1,
  };
  const fall = !shot.stuck ? Math.min(1, Math.max(0, (milliseconds - FLIGHT.travel) / FLIGHT.fall)) : 0;
  if (fall) { pose.y += 260 * fall * fall; pose.pitch -= 75 * fall; pose.opacity = 1 - fall; }
  return { ...decorate(pose), contact: t === 1, done: t === 1 && (shot.stuck || fall === 1) };
}
