// SBD52: 日程を決める前の再渡航。金額は第4章賞金の1割を往復先払いする初期値。
import { CH4_PRIZE } from "./ch4-progress.js";
export const TRAVEL = Object.freeze({ roundTrip: CH4_PRIZE / 10, visit: 3000, strain: 16,
  rest: 55, sleep: 14, uniqueAffinity: 10, repeatAffinity: 5, topics: 8 });
export const TEACHERS = Object.freeze(["sheikh", "da_silva"]);
const count = n => Number.isSafeInteger(n) && n >= 0 ? n : 0;
export function tripState(s) {
  const r = s?.flags?._ch5_growth_travel;
  return { region: r?.region === "dubai" ? "dubai" : "local", pendingNight: r?.pendingNight === true,
    visits: Object.fromEntries(TEACHERS.map(id => [id, count(r?.visits?.[id])])) };
}
export const travelAllowed = s => s?.chapter === 5 && s.phase === "daily" && s.flags?._ch5?.part === "free"
  && s.flags?._ch4_cleared === true;
const stamp = s => JSON.stringify([s.cycleId, s.day, s.slot, tripState(s)]);

/** 純粋な実行候補。読了前には料金・行動・好感度を確定しない。 */
export function planTripAction(s, kind, who = null) {
  if (!travelAllowed(s) || tripState(s).pendingNight || ![0, 1].includes(s.slot)) return null;
  const r = tripState(s);
  const plan = { owner: s, stamp: stamp(s), kind, who, cost: 0, strain: 0, slots: 1 };
  if (kind === "fly" && r.region === "local") {
    if (s.money < TRAVEL.roundTrip) return null;
    return { ...plan, cost: TRAVEL.roundTrip, slots: 2 - s.slot };
  }
  if (kind === "return" && r.region === "dubai") return { ...plan, slots: 2 - s.slot };
  if (kind === "rest") return plan;
  if (kind === "shift" && r.region === "local" && s.stamina > 0 && s.lastBaitoDay !== s.day) return plan;
  if (kind !== "visit" || r.region !== "dubai" || !TEACHERS.includes(who) || s.money < TRAVEL.visit || s.stamina <= 0) return null;
  if (who === "sheikh" && s.flags._ch4_sheikh_revealed !== true) return null;
  const index = Math.min(TRAVEL.topics, r.visits[who]);
  return { ...plan, cost: TRAVEL.visit, strain: TRAVEL.strain,
    scene: `ch5_growth_${who}_${index}`, affinity: index < TRAVEL.topics ? TRAVEL.uniqueAffinity : TRAVEL.repeatAffinity };
}

/** callerが実際の費用・体力を処理する直前の一度だけの境界。古いowner・再入力は拒否。 */
export function commitTripAction(s, plan) {
  if (!plan || plan.owner !== s || !travelAllowed(s) || stamp(s) !== plan.stamp) return false;
  const expected = planTripAction(plan.kind === "shift" ? { ...s, stamina: 1, lastBaitoDay: -1 } : s, plan.kind, plan.who);
  if (!expected || ["cost", "strain", "slots", "scene", "affinity"].some(key => expected[key] !== plan[key])) return false;
  const r = tripState(s);
  if (plan.kind === "fly") r.region = "dubai";
  if (plan.kind === "return") r.region = "local";
  if (plan.kind === "visit") r.visits[plan.who]++;
  s.slot += plan.slots;
  r.pendingNight = s.slot >= 2;
  s.flags._ch5_growth_travel = r;
  return true;
}

/** 回復と同じ同期区間で保存する。再開時も夜のXP精算は既存の一度性に従う。 */
export function completeTripNight(s) {
  const r = tripState(s);
  if (!travelAllowed(s) || !r.pendingNight || s.slot < 2) return false;
  s.day++; s.slot = 0; r.pendingNight = false; s.flags._ch5_growth_travel = r;
  return true;
}
