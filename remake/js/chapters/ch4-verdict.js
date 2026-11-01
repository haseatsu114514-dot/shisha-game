// 世界大会の実配合・提供温度・二度の調整から表示を組み立てる。物語の台本は書き換えない。
import { DB } from "../core/data.js";
import { flavorFamilyGrams } from "../craft/score.js";
import { servedEvaluationLines, servedStateLine } from "../craft/served-eval.js";
import { evaluationOf, feedbackLine } from "../craft/feedback.js";
import { careStartTemp } from "../craft/pull.js";

const PLANS = Object.freeze({
  sakura: { flavor: "sakura", label: "桜", aim: "香りを先に届ける" },
  peach: { flavor: "peach", label: "桃", aim: "甘さでやわらかく迎える" },
  tea: { flavor: "black_tea", label: "茶", aim: "余韻を長く残す" },
});
const line = (text, speaker = "") => ({ speaker, face: speaker ? "normal" : "", text });

export function chapterFourCraftAdvice(value, step) {
  const plan = PLANS[value.flags?._ch4_strategy];
  const read = value.flags?._ch4?.read || {};
  const hints = [];
  if (step === 1) {
    if (plan) hints.push(`出発前の方針：${plan.label}で${plan.aim}。配合と温度帯を確かめよう。`);
    if (read.ch4_dubai_souq) hints.push("スークで触れた香りを思い出し、混ぜる葉の特徴を見比べる。");
  }
  if ([6, 9, 10].includes(step) && read.ch4_stranger_second) {
    hints.push("路地裏では、換気が変わると熱も変わった。前と同じ手順でも、今の温度と吸い心地を確かめよう。");
  }
  if ([9, 10].includes(step) && read.ch4_stranger_third) hints.push("前夜の『明日の私に、出してくれ』。さっきの一口をそのまま正解にしない。");
  return hints;
}

export function chapterFourCustomerLines(cs, round) {
  const sample = round === 1 ? cs.pull : cs.careHistory?.[0];
  return [line(`調整${round}回目の前に、吸い心地を確かめた。`),
    line(servedStateLine({ ...cs, pull: { ...sample, temp: careStartTemp({ ...cs, careRound: round }) } }))];
}

export function chapterFourPlanReview(value, cs) {
  const plan = PLANS[value.flags?._ch4_strategy];
  if (!plan) return "";
  const grams = flavorFamilyGrams(cs.mix, plan.flavor, DB.flavorById);
  const total = Object.values(cs.mix || {}).filter(g => Number.isFinite(g) && g > 0).reduce((a, b) => a + b, 0);
  return grams > 0
      ? `出発前に選んだ${plan.label}は${grams}g、配合の${Math.round(100 * grams / Math.max(1, total))}%。${plan.aim}方針を、この配合で試した。`
      : `出発前は${plan.label}を考えていたが、本番では使わず、別の配合で出した。`;
}

export function chapterFourReviewLines(value, cs) {
  const lines = cs.pullDone && !cs.pull?.failed ? servedEvaluationLines(cs) : [];
  const plan = chapterFourPlanReview(value, cs);
  if (plan) lines.push(line(plan));
  for (const [index, care] of (cs.careHistory || []).entries()) {
    const evaluation = evaluationOf(care.score);
    lines.push(line(`調整${index + 1}回目：${evaluation.mark}　炭交換${care.coals || 0}個`));
    lines.push(line(feedbackLine("da_silva", "care", evaluation), "da_silva"));
  }
  if (value.flags?._ch4?.read?.ch4_stranger_second && cs.careHistory?.length) {
    const marks = cs.careHistory.map(care => evaluationOf(care.score).mark).join(" → ");
    lines.push(line(`路地裏で確かめた、熱が変わった後の一口。本番の二度の調整は ${marks}。`));
  }
  if (cs.failed) lines.push(line(`${{ burnt: "葉が焦げた", cold: "炭の熱が尽きた", leaf: "葉の香りが抜け切った" }[cs.failed] || "煙が止まった"}。道具を置いて、一台を確かめる。`));
  return lines;
}

/**
 * 固定の自分の操作描写（ブロンドをほぐす〜炭を一つ離す）だけを、完了した一台の味と熱の2行に差し替える。
 * 配合%・調整マーク・太陽の講評は直前の結果モーダルに任せ、ここでは成績表を繰り返さない。
 * 操作に左右されない「ふと視線を感じた」以降と、対戦相手の場面は既存台本のまま。
 */
export function chapterFourFinalDialogue(source, value, cs) {
  const start = source.lines.findIndex(row => row.text === "はじめは普通のブロンドをほぐす。和の配合は、何度も試したものだ。");
  const end = source.lines.findIndex(row => row.text?.startsWith("ふと視線を感じた。"));
  const served = cs.pullDone && !cs.pull?.failed ? servedEvaluationLines(cs) : [];
  return { ...source, lines: start >= 0 && end > start
    ? [...source.lines.slice(0, start), ...served, ...source.lines.slice(end)] : served };
}

/** 敗北でも、未完了の提供や「最後まで吸いたくなる」という固定の成功評価を捏造しない。 */
export function chapterFourDefeatDialogue(source, value, cs) {
  return { ...source, lines: [...chapterFourReviewLines(value, cs), ...source.lines.slice(2)] };
}
