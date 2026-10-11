// 制作中に常時見せる情報は短く。詳しい説明は必要なときだけ開く。
import { el } from "../core/util.js";

export const STEP_BRIEFS = {
  setup: "この一台に使う道具を選ぶ",
  mix: "合計12g以上で配合を決める",
  pack: "葉の詰め方で、空気の通り道を作る",
  holes: "光が目印に重なったら、穴を開ける",
  heat: "芯が光った炭をタップして取る",
  place: "炭を置いて、熱を均等に届ける",
  steam: "雑念をよける。困ったらリフレッシュ",
  pull: "針を止めて吸い、虹色の最適温を狙う",
  care: "消耗した炭を交換して、吸って整える",
};


/**
 * 初回レッスンだけ、工程の「理由」を簡潔に見せる。
 * 抽選・採点・通常練習には影響させず、既存の「?」ガイドを再利用する。
 */
export const TUTORIAL_STEP_HELP = Object.freeze({
  mix: { brief: "香りを組み合わせ、葉の配合を決める", detail: "スミ「二種類の葉で香りを作る。合計12gを目指せ」" },
  pack: { brief: "葉の間に空気の通り道を作る", detail: "スミ「押し込みすぎるな。熱と空気の抜け道を作れ」" },
  holes: { brief: "アルミの穴から熱と空気を通す", detail: "スミ「穴が偏ると熱も偏る。目印を見て開けろ」" },
  place: { brief: "炭を三角に置いて熱を広げる", detail: "スミ「最初は三角が基本だ。熱を均等に回せ」" },
  heat: { brief: "炭は芯まで焼いてから使う", detail: "スミ「表面だけじゃ足りん。芯まで赤くして使うぞ」" },
  steam: { brief: "蒸らして葉に熱をなじませる", detail: "スミ「待つ間にも熱は入る。落ち着いて雑念をよけろ」" },
  pull: { brief: "吸い出して仕上がりの温度を整える", detail: "スミ「針を見て吸え。虹色がちょうどいい温度だ」" },
});

export function buildGuide() {
  const note = el("p");
  const root = el("details.bench-guide", [
    el("summary", { text: "?", "aria-label": "操作の説明", title: "操作の説明" }),
    el("div.bench-guide-tip", [el("b", { text: "操作の説明" }), note]),
  ]);
  return { root, note };
}
