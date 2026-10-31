// Actions that consume the chapter's limited free time.
export const PLAN = [
  "baito:holes",
  "adam", "customer",
  "minto", "baito:sumi",
  "naru", "rest",
  "baito:heat", "cafe",
  "c_station", "customer",
  "adam", "baito:sumi",
  "rin", "kannon",
  "baito:pull", "rest",
  "naru", "choizap",
  "rin", "baito:sumi",
  // 休養では回らないため、後半にも消耗する外出を残して20回以上の実回転を検証する。
  "adam", "kannon",
  "baito:steam", "customer",
  "minto", "customer", "rest", "rest",
];

// Midcheck chooses its preparation leaf before this independent purchase.
// Illness, invitations and emergency rest may delay PLAN; buying uses no slot.
export function nextPlanAction({ planIdx, phase, midcheckDone, lemonPurchased }) {
  if (phase === "daily" && midcheckDone && !lemonPurchased)
    return { item: "shop:lemon", requiredPurchase: true };
  return { item: PLAN[planIdx] || "rest", requiredPurchase: false };
}
