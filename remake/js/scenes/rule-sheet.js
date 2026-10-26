import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { state } from "../core/state.js";
import { REGULATION, regulationFor } from "../craft/steps.js";

export function ruleSheetPanel(chapter = state?.chapter || 1) {
  const regulation = chapter <= 2 ? chapter === state?.chapter ? regulationFor({ mode: "tournament" }) : REGULATION[chapter] : null;
  const tournament = { 1: "SMOKE CROWN CUP", 2: "県大会", 3: "全国大会" }[chapter] || "大会";
  const challenge = chapter === 3
    ? "前夜に決めた一台を制作する。"
    : regulation?.label || "大会の課題を確認する。";
  const stock = chapter === 3
    ? "道具と材料は、前夜の準備を確かめて持ち込む。"
    : regulation?.supply ? "指定の葉は主催者が用意する。" : "大会の葉は、自分の在庫から持ち込む。";
  const article = (number, title, body) => el("section.rule-article", [
    el("h3", { text: `第${number}条　${title}` }), el("p", { text: body }),
  ]);
  return el("article.rule-sheet", { dataset: { test: "rule-sheet", chapter: String(chapter) }, "aria-label": `${tournament}の競技規則` }, [
    el("p.rule-sheet-eyebrow", { text: tournament }),
    el("h2", { text: "競技規則" }),
    el("p.rule-sheet-lead", { text: "出場前に確認する項目" }),
    article("一", "課題", challenge),
    article("二", "材料", stock),
    article("三", "一台の進行", "一台を制作し、吸い出して提供する。その後も同じ一台を二度調整する。"),
    el("p.rule-sheet-foot", { text: "大会運営委員会" }),
  ]);
}

export const openRuleSheet = () => modal({
  title: "大会の規則",
  className: "rule-sheet-modal",
  body: ruleSheetPanel(),
  options: [{ label: "閉じる", value: true, primary: true, test: "rule-sheet-close" }],
});
