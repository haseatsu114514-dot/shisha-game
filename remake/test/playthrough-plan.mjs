// Actions that consume the chapter's limited free time.
export const PLAN = [
  "baito:holes",
  // #2213 B01/B03: DAY2 の昼は自由行動、夜は固定シフト、帰り道に PEPPERMINT→EDEN へ配達。
  // 先に EDEN・PEPPERMINT へ客として行くと配達の初来店が飛ぶので、DAY2 の昼は KEMURIKUSA にする。
  // 占い師（11/02 から章に1〜2回・第1章はつむぎの噂の後）に会えるよう、客席は つむぎが昼にいる DAY4 に当てる。
  "naru", "adam",
  "customer", "minto",
  "baito:sumi", "rest",
  "baito:heat", "cafe",
  "c_station", "customer",
  "adam", "baito:sumi",
  "rio", "kannon",
  "baito:pull", "rest",
  "naru", "choizap",
  "rio", "baito:sumi",
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
