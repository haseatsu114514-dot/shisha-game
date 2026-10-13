// Lounge rules inspired by WATL 2026. Geometry, scoring and rendering agree.
// Point scoring / two calls / no bonus calls on drops are explicit game adaptations.
export const RULESET = "lounge-2026-v1";
export const MODES = { practice: { throws: 3, max: 22 }, league: { throws: 10, max: 64 } };
export const RINGS = [
  { radius: .1, score: 6 }, { radius: .23, score: 5 }, { radius: .4, score: 4 },
  { radius: .62, score: 3 }, { radius: .8, score: 2 }, { radius: 1, score: 1 },
];
export const BULLS = [-1, 1].flatMap(x => [-1, 1].map(y => ({ x: x * .36, y: y * .24, outer: .13, inner: .06 })));
export const KILLS = [-1, 1].flatMap(y => [-1, 1].map(x => ({
  id: (y < 0 ? "upper" : "lower") + (x < 0 ? "-left" : "-right"),
  row: y < 0 ? "upper" : "lower", x: x * .56, y: y * .70, outer: .09, inner: .045,
})));
export const POWER = { ideal: .62, sweetMin: .54, sweetMax: .70, stickMin: .42, stickMax: .82 };
export const SWAY = { min: .06, max: .18, fatigueStart: 1500, fatigueFull: 8000, focusDuration: 1200, focusScale: .18 };
export function finite(...values) {
  if (!values.every(Number.isFinite)) throw new RangeError("Finite gauge values required");
}
export function gaugeAt(milliseconds, cycle = 3200) {
  finite(milliseconds, cycle);
  if (cycle <= 0) throw new RangeError("Positive gauge cycle required");
  const phase = (Math.max(0, milliseconds) % cycle) / (cycle / 2);
  return phase <= 1 ? phase : 2 - phase;
}
export const axisAt = needle => { finite(needle); return (needle * 2 - 1) * 1.08; };
/** Visible, reproducible hand movement. Time is the active stance clock, not wall time. */
export function swayAt(milliseconds, power = POWER.ideal, throwIndex = 0, focused = false) {
  finite(milliseconds, power, throwIndex);
  if (milliseconds < 0 || power < 0 || power > 1 || !Number.isInteger(throwIndex) || throwIndex < 0)
    throw new RangeError("Invalid stance values");
  const fatigue = Math.min(1, Math.max(0, (milliseconds - SWAY.fatigueStart) / (SWAY.fatigueFull - SWAY.fatigueStart)));
  const strain = Math.max(0, POWER.sweetMin - power, power - POWER.sweetMax);
  const amplitude = (SWAY.min + (SWAY.max - SWAY.min) * fatigue) * (1 + strain) * (focused ? SWAY.focusScale : 1);
  const t = milliseconds / 1000, offset = throwIndex * 1.73;
  return { x: amplitude * (.75 * Math.sin(t * 4.7 + offset) + .25 * Math.sin(t * 10.3 + offset)),
    y: amplitude * (.75 * Math.cos(t * 3.9 + offset) + .25 * Math.sin(t * 8.1 - offset)), amplitude, fatigue, focused };
}
export function releaseAimAt(aim, milliseconds, power, throwIndex, focused) {
  finite(aim.x, aim.y);
  if (Math.abs(aim.x) > 1.08 || Math.abs(aim.y) > 1.08) throw new RangeError("Aim out of range");
  const sway = swayAt(milliseconds, power, throwIndex, focused);
  const clampAxis = n => Math.max(-1.08, Math.min(1.08, n));
  return { x: clampAxis(aim.x + sway.x), y: clampAxis(aim.y + sway.y), sway };
}
export function scoreAt(x, y) {
  finite(x, y);
  const radius = Math.hypot(x, y);
  // Ring boundaries score the lower neighbouring zone. Red bull boundaries count.
  if (radius <= RINGS[0].radius + 1e-9) return 6;
  for (const bull of BULLS) {
    const distance = Math.hypot(x - bull.x, y - bull.y);
    if (distance <= bull.inner + 1e-9) return 6;
    if (distance <= bull.outer + 1e-9) return 5;
  }
  return RINGS.slice(1).find(ring => radius < ring.radius - 1e-9)?.score || 0;
}
export function killState(history) {
  const used = history.filter(shot => shot.called).length;
  const closed = new Set(history.filter(shot => shot.outcome === "killshot").map(shot => KILLS.find(k => k.id === shot.called)?.row));
  return { remaining: Math.max(0, 2 - used), closed: [...closed].filter(Boolean) };
}
export function canCall(id, history) {
  const target = KILLS.find(k => k.id === id), state = killState(history);
  return Boolean(target && state.remaining > 0 && !state.closed.includes(target.row));
}
export function resolveThrow({ x, y, power, called = null }, history = []) {
  finite(x, y, power);
  if (Math.abs(x) > 1.08 || Math.abs(y) > 1.08 || power < 0 || power > 1)
    throw new RangeError("Gauge value out of range");
  if (called !== null && !canCall(called, history)) throw new RangeError("Unavailable Killshot call");
  const landing = { x, y: y + (POWER.ideal - power) * .28 };
  const stuck = power >= POWER.stickMin && power <= POWER.stickMax;
  const rotation = 360 + (power - POWER.ideal) * 150;
  let score = 0, outcome = "drop";
  if (stuck) {
    if (called) {
      const target = KILLS.find(k => k.id === called), distance = Math.hypot(x - target.x, landing.y - target.y);
      score = distance <= target.inner + 1e-9 ? 8 : distance <= target.outer + 1e-9 ? 7 : 0;
      outcome = score ? "killshot" : "killshot-miss";
    } else { score = scoreAt(x, landing.y); outcome = score === 6 ? "bull" : score ? "hit" : "miss"; }
  }
  return { aim: { x, y }, power, called, landing, rotation, stuck, score, outcome,
    dropReason: stuck ? null : power < POWER.stickMin ? "weak" : "rotation" };
}
export const totalOf = throws => throws.reduce((sum, shot) => sum + shot.score, 0);
export const gradeOf = (total, max) => total >= max * .7 ? "great" : total >= max * .35 ? "good" : "again";
