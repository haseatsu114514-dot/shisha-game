import { temperatureBands, isIdealTemperature, makerMixProfile } from "./temperature-model.js";

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
  const bands = temperatureBands(cs);
  const rounds = [["提供", cs.pull, 3], ["調整1回目", cs.careHistory?.[0], 2], ["調整2回目", cs.careHistory?.[1], 2]];
  const safeBonus = makerMixProfile(cs).safePullsBonus || 0;
  const excessive = rounds.find(([, result, safe]) => result && result.pulls > safe + safeBonus);
  if (excessive) return `次に変える一つ：${excessive[0]}は吸う回数を減らし、後半の葉を残そう。`;
  const failed = rounds.find(([, result]) => result?.failed);
  if (failed) return failed[1].failed === "cold"
    ? `次に変える一つ：${failed[0]}は冷え切る前に炭を交換しよう。`
    : `次に変える一つ：${failed[0]}は熱が上がり切る前に熱を逃がす吸いを試そう。`;
  const missed = [...rounds].reverse().find(([, result]) => Number.isFinite(result?.temp) && !isIdealTemperature(result.temp, bands));
  if (missed) return `次に変える一つ：${missed[0]}は${missed[1].temp > bands.ideal[1] ? "少し下げて" : "少し熱を戻して"}から仕上げよう。`;
  return {
    holes: "次の練習：目印に合わせて、穴を均等に開けよう。",
    heat: "次の練習：炭の全面が赤くなる頃合いを確かめよう。",
    shisha: "次の練習：配合と、提供時の温度を確かめよう。",
    care1: "次の練習：1回目の調整で、交換する炭の数を見直そう。",
    care2: "次の練習：2回目まで葉を残し、適温で仕上げよう。",
  }[weakestPart(cs.parts)] || "";
}

/** 実際に完了した工程から一つだけ認める。未記録の成功は推測しない。 */
export function goodPointOf(cs) {
  const bands = temperatureBands(cs);
  const good = result => Number.isFinite(result?.temp) && !result.failed && isIdealTemperature(result.temp, bands);
  const care = cs.careHistory || [];
  if (good(cs.pull) && care.length >= 2 && care.slice(0, 2).every(good)) return "今回よかったこと：提供と2回の調整を、適温で仕上げた。";
  if (care.length >= 2 && good(care[1])) return "今回よかったこと：2回目の調整で適温に整えられた。";
  if (good(cs.pull)) return "今回よかったこと：適温に整えて提供できた。";
  if (cs.heat?.score >= 85) return "今回よかったこと：炭をしっかり焼き、立ち上げの熱を作れた。";
  if (cs.holes?.score >= 85) return "今回よかったこと：穴をそろえて空気の通り道を作れた。";
  if (cs.steam?.score >= 85) return "今回よかったこと：蒸らしで集中を保てた。";
  return "";
}
