// Scoring and the painted rings share this geometry. No game/save state or RNG.
export const RINGS = [
  { radius: .12, score: 6 }, { radius: .28, score: 5 }, { radius: .46, score: 4 },
  { radius: .64, score: 3 }, { radius: .82, score: 2 }, { radius: 1, score: 1 },
];
export const THROW_COUNT = 3;
function finite(...values) {
  if (!values.every(Number.isFinite)) throw new RangeError("Finite aim and timing required");
}
export function scoreAt(x, y) {
  finite(x, y);
  const radius = Math.hypot(x, y);
  return RINGS.find(ring => radius <= ring.radius + 1e-9)?.score || 0;
}
export function gaugeAt(milliseconds) {
  finite(milliseconds);
  const phase = (Math.max(0, milliseconds) % 2600) / 1300;
  return phase <= 1 ? phase : 2 - phase;
}
export function resolveThrow(aim, timing) {
  finite(aim.x, aim.y, timing);
  if (timing < 0 || timing > 1) throw new RangeError("Timing must be within the gauge");
  const error = (timing - .5) * 2;
  const landing = { x: aim.x + error * .24, y: aim.y + error * .42 };
  return { aim: { ...aim }, timing, landing, score: scoreAt(landing.x, landing.y),
    precision: Math.abs(error) <= .12 ? "perfect" : Math.abs(error) <= .35 ? "good" : "off" };
}
export const totalOf = throws => throws.reduce((sum, shot) => sum + shot.score, 0);
export const gradeOf = total => total >= 13 ? "great" : total >= 7 ? "good" : "again";
