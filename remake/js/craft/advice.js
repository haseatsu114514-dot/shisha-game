// 完了した有限の工程だけを比較する。未実施の0点や未知のキーを助言に使わない。
export const ADVICE_PARTS = ["holes", "heat", "shisha", "care1", "care2"];
export function weakestPart(parts = {}, completed = ADVICE_PARTS) {
  let weakest = null;
  for (const key of ADVICE_PARTS) {
    if (!completed.includes(key) || !Number.isFinite(parts?.[key])) continue;
    if (weakest === null || parts[key] < parts[weakest]) weakest = key;
  }
  return weakest;
}
export function improvementOf(cs) {
  return {
    holes: "次の練習：目印に合わせて、穴を均等に開けよう。",
    heat: "次の練習：炭の芯が光る瞬間を確かめよう。",
    shisha: "次の練習：配合と、提供時の温度を確かめよう。",
    care1: "次の練習：1回目の調整で、交換する炭の数を見直そう。",
    care2: "次の練習：2回目まで葉を残し、最適温で仕上げよう。",
  }[weakestPart(cs.parts)] || "";
}
