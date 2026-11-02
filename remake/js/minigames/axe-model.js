// Lounge rules built on the WATL 2026 Hatchet target (worldaxethrowingleague.com/axe-throwing-rules, 2026-10-07).
// Geometry, scoring and rendering agree. Point scoring from a fixed stance, three gauges and
// the companion/opponent layer are game adaptations; the target, blade-touch scoring, calls,
// drop bonus calls, halves and the division closing rules follow the official text.
export const RULESET = "watl-2026-lounge";
export const MODES = { practice: { throws: 3, max: 22, half: 0 }, league: { throws: 10, max: 64, half: 5 } };
/** Divisions change only what closes after a hit. Scores, calls and drops are shared. */
export const DIVISIONS = {
  rec: { name: "レク", short: "REC", note: "何も閉じない。全部の赤と5が毎投開いている" },
  am: { name: "アマ", short: "AM", note: "当てた赤・5はその半分（5投）のあいだ閉じる。閉じた赤は5点、閉じた5は外側のリング点" },
  pro: { name: "プロ", short: "PRO", note: "当てた5の円は丸ごと閉じる。同じ半分で2度目は0点。5つの赤を順に回る" },
};
// Normalized board units: 1 = radius of the 1 ring (14.75 in). Sizes are the official inches.
export const INCH = 1 / 14.75;
export const RINGS = [
  { radius: .75 * INCH, score: 6 }, { radius: 1.75 * INCH, score: 5 }, { radius: 5.375 * INCH, score: 4 },
  { radius: 8.5 * INCH, score: 3 }, { radius: 11.625 * INCH, score: 2 }, { radius: 14.75 * INCH, score: 1 },
];
/** The painted 20 mm black lines score the lower zone: a ring counts only strictly inside its line. */
export const LINE = .3937 * INCH;
/** A 4 in cutting edge, vertical when stuck. The highest zone it touches scores. */
export const BLADE = { halfLength: 2 * INCH };
export const CLUSTERS = [
  { id: "center", x: 0, y: 0, ring: 4 },
  ...[-1, 1].flatMap(y => [-1, 1].map(x => ({ id: (y < 0 ? "u" : "l") + (x < 0 ? "l" : "r"), x: x * 6 * INCH, y: y * 3.5 * INCH, ring: 3 }))),
];
export const BULLS = CLUSTERS.slice(1).map(c => ({ x: c.x, y: c.y, outer: RINGS[1].radius, inner: RINGS[0].radius }));
export const KILLS = [-1, 1].flatMap(y => [-1, 1].map(x => ({
  id: (y < 0 ? "upper" : "lower") + (x < 0 ? "-left" : "-right"),
  row: y < 0 ? "upper" : "lower", x: x * 7 * INCH, y: y * 12 * INCH, outer: .75 * INCH, inner: .375 * INCH,
})));
/** Clockwise sudden-death rotation, starting upper-left. */
export const KILL_ROTATION = ["upper-left", "upper-right", "lower-right", "lower-left"];
export const POWER = { ideal: .62, sweetMin: .54, sweetMax: .70, stickMin: .42, stickMax: .82 };
/** Five 2x10 planks (46.25 in) by 48 in, centred on the bullseye. Outside is air. */
export const BOARD = { left: -23.125 * INCH, right: 23.125 * INCH, top: -24 * INCH, bottom: 24 * INCH };
/** Gauges sweep this far from the centre, so misses into plain wood exist. */
export const AIM_RANGE = 1.2;
export const SWAY = { min: .03, max: .17, fatigueStart: 1500, fatigueFull: 8000, focusDuration: 1200, focusScale: .18 };
export const CALLS = 2;
export function finite(...values) {
  if (!values.every(Number.isFinite)) throw new RangeError("Finite gauge values required");
}
export function gaugeAt(milliseconds, cycle = 3200) {
  finite(milliseconds, cycle);
  if (cycle <= 0) throw new RangeError("Positive gauge cycle required");
  const phase = (Math.max(0, milliseconds) % cycle) / (cycle / 2);
  return phase <= 1 ? phase : 2 - phase;
}
export const axisAt = needle => { finite(needle); return (needle * 2 - 1) * AIM_RANGE; };
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
  if (Math.abs(aim.x) > AIM_RANGE || Math.abs(aim.y) > AIM_RANGE) throw new RangeError("Aim out of range");
  const sway = swayAt(milliseconds, power, throwIndex, focused);
  const clampAxis = n => Math.max(-AIM_RANGE, Math.min(AIM_RANGE, n));
  return { x: clampAxis(aim.x + sway.x), y: clampAxis(aim.y + sway.y), sway };
}
/** Shortest distance from a point to the vertical cutting edge centred on (x, y). */
export function bladeDistance(x, y, px, py) {
  const sy = Math.max(y - BLADE.halfLength, Math.min(y + BLADE.halfLength, py));
  return Math.hypot(x - px, sy - py);
}
export const halfOf = (index, throws) => MODES.league.half && throws >= MODES.league.throws ? (index < MODES.league.half ? 0 : 1) : 0;
/** Which bulls (6) and 5 rings this half has already used, read from resolved shots. */
export function closuresOf(history, index = history.length, throws = MODES.league.throws, division = "rec") {
  const closed = { bull: new Set(), five: new Set(), cluster: new Set() };
  if (division === "rec") return closed;
  const half = halfOf(index, throws);
  history.forEach((shot, i) => {
    if (halfOf(i, throws) !== half || shot.called || !shot.zone?.cluster) return;
    if (division === "pro") closed.cluster.add(shot.zone.cluster);
    else if (shot.zone.kind === "bull") closed.bull.add(shot.zone.cluster);
    else if (shot.zone.kind === "five") closed.five.add(shot.zone.cluster);
  });
  return closed;
}
/** Highest zone the cutting edge touches, after this division's closures. Point scoring uses a zero-length blade. */
export function scoreBlade(x, y, { closed = closuresOf([]), division = "rec", halfLength = BLADE.halfLength } = {}) {
  finite(x, y);
  const touch = (px, py) => {
    const sy = Math.max(y - halfLength, Math.min(y + halfLength, py));
    return Math.hypot(x - px, sy - py);
  };
  let best = { score: 0, kind: null, cluster: null }, closedTouch = false;
  const consider = (score, kind, cluster) => { if (score > best.score) best = { score, kind, cluster }; };
  for (const c of CLUSTERS) {
    const d = touch(c.x, c.y);
    const bull = d <= RINGS[0].radius + 1e-9, five = d < RINGS[1].radius - LINE - 1e-9;
    if (!bull && !five) continue;
    if (division === "pro" && closed.cluster.has(c.id)) { closedTouch = true; continue; }
    if (bull && !(division === "am" && closed.bull.has(c.id))) consider(6, "bull", c.id);
    else if (!(division === "am" && closed.five.has(c.id))) consider(5, "five", c.id);
    else consider(c.ring, "ring", null);
  }
  const centre = touch(0, 0);
  for (const ring of RINGS.slice(2)) if (centre < ring.radius - LINE - 1e-9) { consider(ring.score, "ring", null); break; }
  if (closedTouch) return { score: 0, kind: "closed", cluster: null };
  return best;
}
export const scoreAt = (x, y, options) => scoreBlade(x, y, options).score;
export function killState(history, throws = history.length + 1) {
  const used = history.filter(shot => shot.called).length;
  const bonus = history.filter((shot, i) => !shot.stuck && i !== throws - 1).length;
  const closed = [...new Set(history.filter(shot => shot.outcome === "killshot").map(shot => KILLS.find(k => k.id === shot.called)?.row))].filter(Boolean);
  const lastRow = KILLS.find(k => k.id === history.findLast(shot => shot.called)?.called)?.row || null;
  // Bonus calls earned by drops go to the opposite height from the previous call.
  const mustRow = used >= CALLS && lastRow ? (lastRow === "upper" ? "lower" : "upper") : null;
  return { remaining: Math.max(0, CALLS + bonus - used), closed, bonus, used, mustRow };
}
export function canCall(id, history, throws) {
  const target = KILLS.find(k => k.id === id), state = killState(history, throws);
  return Boolean(target && state.remaining > 0 && !state.closed.includes(target.row) && (!state.mustRow || state.mustRow === target.row));
}
/**
 * Resolve one throw. history is this thrower's own resolved shots in the game.
 * options: { division, throws, suddenDeath } — sudden death forces the called target and ignores closures and call limits.
 */
export function resolveThrow({ x, y, power, called = null }, history = [], options = {}) {
  finite(x, y, power);
  const { division = "rec", throws = history.length + 1, suddenDeath = false } = options;
  if (!Object.hasOwn(DIVISIONS, division)) throw new RangeError("Unknown division");
  if (Math.abs(x) > AIM_RANGE || Math.abs(y) > AIM_RANGE || power < 0 || power > 1)
    throw new RangeError("Gauge value out of range");
  if (suddenDeath ? !KILLS.some(k => k.id === called) : called !== null && !canCall(called, history, throws))
    throw new RangeError("Unavailable Killshot call");
  const index = history.length, half = halfOf(index, throws);
  const landing = { x, y: y + (POWER.ideal - power) * .28 };
  const onBoard = landing.x >= BOARD.left && landing.x <= BOARD.right && landing.y >= BOARD.top && landing.y <= BOARD.bottom;
  const validPower = power >= POWER.stickMin && power <= POWER.stickMax;
  const stuck = validPower && onBoard;
  const rotation = 360 + (power - POWER.ideal) * 150;
  let score = 0, outcome = called ? "killshot-miss" : "miss", zone = { kind: null, cluster: null }, distance = null;
  if (stuck) {
    if (called) {
      const target = KILLS.find(k => k.id === called);
      distance = bladeDistance(x, landing.y, target.x, target.y);
      score = distance <= target.inner + 1e-9 ? 8 : distance <= target.outer + 1e-9 ? 7 : 0;
      outcome = score ? "killshot" : "killshot-miss";
      if (score) zone = { kind: "kill", cluster: null };
    } else {
      zone = scoreBlade(x, landing.y, { closed: closuresOf(history, index, throws, division), division });
      score = zone.score;
      outcome = zone.kind === "bull" ? "bull" : score ? "hit" : "miss";
      zone = { kind: zone.kind, cluster: zone.cluster };
    }
  } else outcome = onBoard ? "drop" : called ? "killshot-miss" : "miss";
  return { aim: { x, y }, power, called, landing, rotation, stuck, score, outcome, zone, half, distance,
    dropReason: !onBoard ? "off-board" : stuck ? null : power < POWER.stickMin ? "weak" : "rotation" };
}
export const totalOf = throws => throws.reduce((sum, shot) => sum + shot.score, 0);
export const gradeOf = (total, max) => total >= max * .7 ? "great" : total >= max * .35 ? "good" : "again";
