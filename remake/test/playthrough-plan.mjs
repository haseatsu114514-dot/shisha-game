// Actions that consume the chapter's limited free time.
export const PLAN = [
  "baito:holes",
  // #3819: DAY2 の朝に参加登録のついでに PEPPERMINT→EDEN へ配達し、報告の後は昼・夜とも自由行動（固定シフトなし）。
  // 最初の "baito:holes" が DAY2 の昼のシフトになり、常連さんの話はこのシフトで読む。
  // 占い師（11/02 から章に1〜2回・第1章はつむぎの噂の後）に会えるよう、客席は つむぎが昼にいる DAY4 に当てる。
  "customer", "naru",
  "cafe", "minto",
  // 店番は昼夜を通して1回転。誘いのシフトの間には、体力を使う一コマの外出も入れる。
  "kannon", "choizap",
  "cafe", "kannon",
  "c_station", "customer",
  "adam", "baito:sumi",
  "rio", "kannon",
  "choizap", "rest",
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
