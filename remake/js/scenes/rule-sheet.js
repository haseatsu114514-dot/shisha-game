import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { state } from "../core/state.js";
import { REGULATION, regulationFor } from "../craft/steps.js";
import { config } from "../core/state.js";
import { voteStyleFrom } from "../core/vote-style.js";
import { isSakuraiVotes, SAKURAI } from "../craft/ch1-votes.js";

export function ruleSheetPanel(chapter = state?.chapter || 1) {
  const regulation = chapter === state?.chapter ? regulationFor({ mode: "tournament" }) : REGULATION[chapter];
  const tournament = { 1: "SMOKE CROWN CUP", 2: "県大会", 3: "全国大会", 4: "HAZE: GRAND SMOKE" }[chapter] || "大会";
  const challenge = chapter === 3 && regulation?.label
    ? `${regulation.label}。甘み・苦み・後味の調整で一台に仕上げる。`
    : regulation?.label || "大会の課題を確認する。";
  const stock = chapter === 4
    ? "出発前に持ち込み申請した方針の葉は大会が預かり、当日は好きなだけ使える。ほかの葉は自分の在庫から持ち込む。事前に練習した葉ほど、本番で手に馴染む。"
    : "課題の葉は大会が用意し、当日は好きなだけ使える。ほかの葉は自分の在庫から持ち込む。事前に買って練習した葉ほど、本番で手に馴染む。";
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
    // 桜井式の審査（第1章・SKR04）だけ、票の取り方を条文にする。試合中はその試合の方式、試合前は今の設定に従う。
    chapter === 1 && sakuraiRules() ? article("四", "審査", SAKURAI_ARTICLE) : null,
    el("p.rule-sheet-foot", { text: "大会運営委員会" }),
  ]);
}

const focusText = Object.entries(SAKURAI.focus).map(([id, f]) => `${{ maezono: "上園", dr_kemuri: "チャコール博士", sui: "千須" }[id]}は${f.detail}`).join("、");
const SAKURAI_ARTICLE = `審査員3人が各10点を、準備・提供・調整1回目・調整2回目の4回に分けて入れる（2・3・2・3点）。各回は、その回に仕上げた工程だけで決め、1位に「その回の点−1」、2位に1点。提供の回は、${focusText}を見る。温度計の「攻めの帯」で提供・調整を終えると、その回の審査が伸びる。千須は最後の1点を、2回目の調整がいちばん良い一台へ入れる。`;
function sakuraiRules() {
  const attempt = state?.tournament?.voteAttempt;
  return attempt ? isSakuraiVotes(attempt) : voteStyleFrom(config) === "sakurai";
}

export const openRuleSheet = () => modal({
  title: "大会の規則",
  className: "rule-sheet-modal",
  body: ruleSheetPanel(),
  options: [{ label: "閉じる", value: true, primary: true, test: "rule-sheet-close" }],
});
