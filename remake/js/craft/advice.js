import { temperatureBands, isIdealTemperature, makerMixProfile } from "./temperature-model.js";
import { recordedTemperatureState } from "./temperature-records.js";
import { evaluationOf } from "./feedback.js";
import { coalCount } from "./coals.js";

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
/** 炭焼きの次の練習は、炭焼き結果の助言と同じ向き（早取り／遅取り）で示す（#2190 P03）。 */
export function heatPracticeOf(picks = []) {
  const list = Array.isArray(picks) ? picks : [];
  const early = list.some(p => ["raw", "early", "pre"].includes(p));
  const late = list.some(p => ["hot", "over"].includes(p));
  if (early && late) return "次の練習：黒い面が消えて全面が赤くなった炭から取り出そう。";
  if (late) return "次の練習：炭の全面が赤くなったら、待たずに取り出そう。";
  if (early) return "次の練習：黒い面が消えるまで待ってから取り出そう。";
  return "次の練習：炭の全面が赤くなる頃合いを確かめよう。";
}

function holesPractice(holes) {
  if (holes?.holeSizes?.shallow > 0) return "次の練習：浅い穴を減らすため、針を押してから少し待って離そう。";
  if (holes && holes.sizeStab < Math.min(holes.evenness, holes.precision)) return "次の練習：穴の大きさをそろえるため、押した針を早めに離そう。";
  return "次の練習：穴あけは、針が目印に重なったところで押そう。";
}

function steamPractice(steam) {
  if (steam.hits >= 3) return "次の練習：同じ配合で蒸らし、雑念に囲まれる前にリフレッシュを使ってみよう。";
  return "次の練習：蒸らしでは雑念が近づく前に、心を空いている方へ動かそう。";
}

function temperaturePractice(cs, label, result, hot, cold) {
  if (!hot && !cold) return `次に変える一つ：${label}は温度計が適温帯に入ったところで仕上げよう。`;
  if (label === "提供") return `次に変える一つ：提供は${hot ? "下げ吸いを一口して、少し下げて" : "上げ吸いを一口して、少し熱を戻して"}から仕上げよう。`;
  const count = result.coals;
  const place = result.coalsDetail?.place;
  if (hot && count === 0) return `次に変える一つ：${label}は温度計が適温帯まで下がるのを待ってから、一口吸おう。`;
  if (hot) return place === "outer" || count === 1
    ? `次に変える一つ：${label}は少し下げて仕上げられるよう、交換する炭を一つ減らそう。`
    : `次に変える一つ：${label}は少し下げて仕上げられるよう、交換する炭を外寄りに置こう。`;
  if (count === coalCount(cs) && place === "inner") return `次に変える一つ：${label}は温度が落ちる前に、味を確かめる一口を始めよう。`;
  return count === coalCount(cs)
    ? `次に変える一つ：${label}は少し熱を戻して仕上げられるよう、交換する炭を内寄りに置こう。`
    : `次に変える一つ：${label}は少し熱を戻して仕上げられるよう、交換する炭を一つ増やそう。`;
}

export function improvementOf(cs) {
  const bands = temperatureBands(cs);
  const safeBonus = makerMixProfile(cs).safePullsBonus || 0;
  const rounds = [["提供", cs.pull, 3], ["調整1回目", cs.careHistory?.[0], 2], ["調整2回目", cs.careHistory?.[1], 2]];
  const excessLine = label => `次に変える一つ：${label}は吸う回数を減らし、後半の葉を残そう。`;
  const excessive = (result, safe) => Number.isFinite(result?.pulls) && !result.skipped && result.pulls > safe + safeBonus;
  // 完成できなかったときは終端の原因を直す。葉切れは前の工程での吸いすぎも見る。
  const failed = rounds.find(([, result]) => !result?.skipped && ["cold", "burnt", "leaf"].includes(result?.failed));
  if (failed) {
    const [label, result] = failed;
    if (result.failed === "cold") return `次に変える一つ：${label}は冷え切る前に炭を交換しよう。`;
    if (result.failed === "burnt") return `次に変える一つ：${label}は熱が上がり切る前に下げ吸いを試そう。`;
    const overpull = rounds.find(([, result, safe]) => excessive(result, safe));
    return overpull ? excessLine(overpull[0]) : `次に変える一つ：${label}で葉が尽きたので、次は適温に入った工程から吸い足さずに仕上げよう。`;
  }

  let weakest = null;
  const consider = (score, line) => {
    if (!weakest || score < weakest.score) weakest = { score, line };
  };
  // 合成点ではなく各工程の値を比べる。旧記録は穴と炭の正の部分点まで使う。
  let recorded = false;
  for (const [key, practice] of [["holes", holesPractice], ["heat", heat => heatPracticeOf(heat?.picks)], ["steam", steamPractice]]) {
    const result = cs[key];
    if (result?.skipped || result?.failed || result?.zeroSteam || (key === "holes" && cs.foilSkipped)) continue;
    const savedScore = cs.parts?.[key];
    const score = result?.score ?? (key !== "steam" && savedScore > 0 ? savedScore : undefined);
    if (!Number.isFinite(score)) continue;
    recorded = true;
    if (evaluationOf(score).kind !== "just") consider(score, practice(result));
  }
  // 同点は工程順。終了時の成否を、後から狭まった適温帯で覆さない。
  for (const [label, result, safe] of rounds) {
    if (!result || result.skipped) continue;
    const { temp, score } = result;
    const known = recordedTemperatureState(result);
    const measured = Number.isFinite(temp);
    const ideal = known ?? (measured && isIdealTemperature(temp, bands));
    if (result.attack !== true && measured && !ideal) {
      const hot = known === null ? temp > bands.ideal[1] : result.over ?? temp > bands.ideal[1];
      const cold = known === null ? temp < bands.ideal[0] : result.under ?? temp < bands.ideal[0];
      consider(Number.isFinite(score) ? score : 65, temperaturePractice(cs, label, result, hot, cold));
    } else if (excessive(result, safe)) {
      consider(Number.isFinite(score) ? score : 65, excessLine(label));
    } else if (ideal || result.attack === true) {
      if (result.failed || !Number.isFinite(score)) continue;
      recorded = true;
      if (label === "提供" && !result.attack && result.optimal === false && result.pulls > 0 && result.justs === 0 && evaluationOf(score).kind !== "just") {
        consider(score, "次の練習：吸い出しで温度を保ちたい一口は、中央のキープの芯で針を止めよう。");
      }
    }
  }
  const canRepeat = recorded && !rounds.some(([, result]) => result?.failed);
  return weakest?.line || (canRepeat ? "次の練習：同じ手順でもう一台作り、今回の仕上がりを再現しよう。" : "");
}

/** 結果カード共通の講評と、確定時のNG理由。 */
export function craftReviewLines(cs) {
  if (!cs) return [];
  return [goodPointOf(cs), improvementOf(cs), ...(cs.mixInfo?.ngReasons || [])].filter(text => typeof text === "string" && text);
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
