// Presentation only: scoring remains in axe-model.js. Coordinates are board SVG units.
export const TARGET = { x: 330, y: 245, radius: 164 };
// Generated side-view axe: rotate around its heavy head/upper handle, not the cutting edge.
export const AXE_SPRITE = { x: -59.5, y: -50.7, width: 106, height: 159, blade: { x: -39, y: -23.1 } };
export const FLIGHT = { travel: 760, fall: 360, impactScale: .65 };
const rotate = (point, degrees) => {
  const a = degrees * Math.PI / 180;
  return { x: point.x * Math.cos(a) - point.y * Math.sin(a), y: point.x * Math.sin(a) + point.y * Math.cos(a) };
};
export function impactPose(shot) {
  const blade = rotate(AXE_SPRITE.blade, shot.rotation), scale = FLIGHT.impactScale;
  return { x: TARGET.x + shot.landing.x * TARGET.radius - blade.x * scale,
    y: TARGET.y + shot.landing.y * TARGET.radius - blade.y * scale, rotation: shot.rotation, scale, opacity: 1 };
}
export const poseTransform = pose => `translate(${pose.x} ${pose.y}) rotate(${pose.rotation}) scale(${pose.scale})`;
export function flightPose(shot, milliseconds) {
  const t = Math.min(1, Math.max(0, milliseconds / FLIGHT.travel)), end = impactPose(shot);
  const pose = { x: TARGET.x + (end.x - TARGET.x) * t,
    y: 450 + (end.y - 450) * t - 24 * Math.sin(Math.PI * t),
    rotation: shot.rotation * t, scale: 1.3 + (end.scale - 1.3) * t, opacity: 1 };
  const fall = !shot.stuck ? Math.min(1, Math.max(0, (milliseconds - FLIGHT.travel) / FLIGHT.fall)) : 0;
  if (fall) { pose.y += 140 * fall * fall; pose.x += 16 * fall; pose.rotation += 75 * fall; pose.opacity = 1 - fall; }
  const blade = rotate(AXE_SPRITE.blade, pose.rotation);
  return { ...pose, bladeX: pose.x + blade.x * pose.scale, bladeY: pose.y + blade.y * pose.scale,
    contact: t === 1, done: t === 1 && (shot.stuck || fall === 1) };
}
