// First-person camera, looking along +Z. +Y points down; the board is in the distance.
// This is presentation only. The saved shot and score still come from axe-model.js.
export const TARGET = { x: 330, y: 245, radius: 164 };
export const CAMERA = { focal: 700, boardDepth: 650 };
// A 16in hatchet against a 48in board: the mesh is drawn at this scale so the axe reads at its real size.
export const AXE_SCALE = 1.6;
export const AXE = { blade: { x: 0, y: -28 * AXE_SCALE, z: 62 * AXE_SCALE }, handleTip: { x: 0, y: 160 * AXE_SCALE, z: -3 * AXE_SCALE } };
// Shared presentation clock for solo and versus; scoring/rotation stay in the model.
// slowFrom: a called throw (killshot or sudden death) plays the last part of its flight at half speed.
export const FLIGHT = { travel: 600, fall: 300, slowFrom: .6, slowRate: .5 };
/** Display clock for the flight. Slow motion stretches only the approach; the shot itself never changes. */
export function flightTime(milliseconds, slow = false) {
  const t = Math.max(0, milliseconds);
  if (!slow) return t;
  const start = FLIGHT.travel * FLIGHT.slowFrom, end = start + (FLIGHT.travel - start) / FLIGHT.slowRate;
  return t <= start ? t : t <= end ? start + (t - start) * FLIGHT.slowRate : FLIGHT.travel + (t - end);
}
/** Wall-clock length of a whole flight, including the fall of a drop. */
export const flightDuration = (shot, slow = false) => (slow ? FLIGHT.travel * FLIGHT.slowFrom + FLIGHT.travel * (1 - FLIGHT.slowFrom) / FLIGHT.slowRate : FLIGHT.travel) + (shot.stuck ? 0 : FLIGHT.fall);
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
