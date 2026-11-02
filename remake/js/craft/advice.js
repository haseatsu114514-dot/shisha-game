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
  // 熱の失敗・実測温度のずれを先に直す。未知の失敗種別から原因を推測しない。
  const failed = rounds.find(([, result]) => ["cold", "burnt", "leaf"].includes(result?.failed));
  if (failed && failed[1].failed !== "leaf") return failed[1].failed === "cold"
    ? `次に変える一つ：${failed[0]}は冷え切る前に炭を交換しよう。`
    : `次に変える一つ：${failed[0]}は熱が上がり切る前に熱を逃がす吸いを試そう。`;
  // 葉切れは別の終端原因。消耗で狭まった適温帯のずれを、熱の失敗と取り違えない。
  const exhausted = failed?.[1].failed === "leaf";
  const missed = [...rounds].reverse().find(([, result]) => Number.isFinite(result?.temp) && !isIdealTemperature(result.temp, bands));
  if (missed && !exhausted) return `次に変える一つ：${missed[0]}は${missed[1].temp > bands.ideal[1] ? "少し下げて" : "少し熱を戻して"}から仕上げよう。`;
  const safeBonus = makerMixProfile(cs).safePullsBonus || 0;
  const excessive = rounds.find(([, result, safe]) => result && result.pulls > safe + safeBonus);
  if (excessive) return `次に変える一つ：${excessive[0]}は吸う回数を減らし、後半の葉を残そう。`;
  if (exhausted) return `次に変える一つ：${failed[0]}で葉が尽きた。一台を通して吸う回数を見直そう。`;
  return {
    holes: "次の練習：目印に合わせて、穴を均等に開けよう。",
    heat: "次の練習：炭の全面が赤くなる頃合いを確かめよう。",
    shisha: "次の練習：配合と、提供時の温度を確かめよう。",
    care1: "次の練習：1回目の調整で、交換する炭の数を見直そう。",
    care2: "次の練習：2回目まで葉を残し、適温で仕上げよう。",
  }[weakestPart(cs.parts)] || "";
}

/** 結果カード共通の2行（今回よかったこと／次に変える一つ）。空の行は出さない（#1909）。 */
export function craftReviewLines(cs) {
  if (!cs) return [];
  return [goodPointOf(cs), improvementOf(cs)].filter(text => typeof text === "string" && text);
}

/** 実際に完了した工程から一つだけ認める。未記録の成功は推測しない。 */
export function goodPointOf(cs) {
  const bands = temperatureBands(cs);
  const recorded = result => Number.isFinite(result?.score) && result.score > 0 && !result.failed && !result.skipped;
  const good = result => Number.isFinite(result?.temp) && !result.failed && !result.skipped && isIdealTemperature(result.temp, bands);
  const care = cs.careHistory || [];
  if (good(cs.pull) && good(care[0]) && good(care[1])) return "今回よかったこと：提供と2回の調整を、適温で仕上げた。";
  if (care.length >= 2 && good(care[1])) return "今回よかったこと：2回目の調整で適温に整えられた。";
  if (good(cs.pull)) return "今回よかったこと：適温に整えて提供できた。";
  if (recorded(cs.heat) && cs.heat.score >= 85) return "今回よかったこと：炭をしっかり焼き、立ち上げの熱を作れた。";
  if (recorded(cs.holes) && cs.holes.score >= 85) return "今回よかったこと：穴をそろえて空気の通り道を作れた。";
  if (recorded(cs.steam) && cs.steam.score >= 85) return "今回よかったこと：蒸らしで集中を保てた。";
  // parts は未実施でも初期値を持つため、完了時に保存される実測結果だけを使う。
  // 同点なら工程順の先頭を選ぶ。低い点を「成功」「適温」と言い換えない。
  const rounds = [
    ["穴あけ", cs.holes], ["炭焼き", cs.heat], ["蒸らし", cs.steam],
    ["提供", cs.pull], ["1回目の調整", care[0]], ["2回目の調整", care[1]],
  ];
  let best = null;
  for (const entry of rounds) {
    if (recorded(entry[1]) && (!best || entry[1].score > best[1].score)) best = entry;
  }
  return best ? `今回よかったこと：今回の工程では、${best[0]}の評価が比較的よかった。` : "";
}
