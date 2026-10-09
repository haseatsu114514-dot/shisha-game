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
  pull: "針を止めて吸い、細い最適温を狙う",
  care: "炭を替えるか決めて、吸って整える",
  trial: "香りと合うアピールポイントを選ぶ",
};

export function conditionBadge(condition) {
  const mouth = { green: 'M7 14c1.5 4 8.5 4 10 0', yellow: 'M8 16h8', red: 'M8 17c2-2.5 6-2.5 8 0' }[condition.health];
  const eyes = condition.health === "red" ? '<path d="m7 9 2 1m6 0 2-1"/>' : '<path d="M8 9v1m8-1v1"/>';
  return el("details.bench-condition", { dataset: { health: condition.health, test: "craft-condition" } }, [
    el("summary", { "aria-label": `体調：${condition.label}。詳しく見る`, title: `体調：${condition.label}` }, [
      el("span", { "aria-hidden": "true", html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="10"/>${eyes}<path d="${mouth}"/></svg>` }),
    ]),
    el("div.bench-condition-tip", [el("b", { text: `体調：${condition.label}` }), el("p", { text: condition.hint })]),
  ]);
}

export function buildGuide() {
  const note = el("p");
  const root = el("details.bench-guide", [
    el("summary", { text: "?", "aria-label": "操作の説明", title: "操作の説明" }),
    el("div.bench-guide-tip", [el("b", { text: "操作の説明" }), note]),
  ]);
  return { root, note };
}
