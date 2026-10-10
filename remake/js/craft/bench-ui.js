// 制作中に常時見せる情報は短く。詳しい説明は必要なときだけ開く。
import { el } from "../core/util.js";

export const STEP_BRIEFS = {
  setup: "この一台に使う道具を選ぶ",
  concept: "大切にすることを2つ選ぶ",
  mix: "合計12g以上で配合を決める",
  pack: "葉の詰め方で、空気の通り道を作る",
  holes: "光が目印に重なったら、穴を開ける",
  heat: "芯が光った炭をタップして取る",
  place: "炭を置いて、熱を均等に届ける",
  steam: "雑念をよける。困ったらリフレッシュ",
  pull: "針を止めて吸い、虹色の最適温を狙う",
  care: "消耗した炭を交換して、吸って整える",
  trial: "香りと合うアピールポイントを選ぶ",
};

export function buildGuide() {
  const note = el("p");
  const root = el("details.bench-guide", [
    el("summary", { text: "?", "aria-label": "操作の説明", title: "操作の説明" }),
    el("div.bench-guide-tip", [el("b", { text: "操作の説明" }), note]),
  ]);
  return { root, note };
}
