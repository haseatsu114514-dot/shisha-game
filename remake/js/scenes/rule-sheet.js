import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { config, state } from "../core/state.js";
import { REGULATION, regulationFor } from "../craft/steps.js";
import { voteStyleFrom } from "../core/vote-style.js";
import { ch1RoundPoints, isSakuraiVotes, SAKURAI } from "../craft/ch1-votes.js";

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
    chapter === 1 ? article("四", "審査", ch1Judging()) : null,
    el("p.rule-sheet-foot", { text: "大会運営委員会" }),
  ]);
}

const focusText = Object.entries(SAKURAI.focus).map(([id, f]) => `${{ uezono: "上園", dr_charcoal: "チャコール博士", sensu: "千須" }[id]}は${f.detail}`).join("、");
const roundPoints = SAKURAI.rounds.map((_, round) => ch1RoundPoints("uezono", round)).join("・");
const ALLOCATION = `審査員3人が各10点を、準備・提供・調整1回目・調整2回目の4回に分けて入れる（${roundPoints}点）。各回は1位に「その回の点−1」、2位に1点。千須は最終回の持ち点から1点を残し、もう一口吸いたい一台へ入れる。`;
function ch1Judging() {
  const tournament = state?.chapter === 1 ? state.tournament : null;
  const attempt = tournament?.voteAttempt;
  // 試合中は開始時の方式。票の記録がない旧版の試合は、一台の総合点で順位が決まる。
  if (state?.chapter === 1 && state.phase === "tournament" && !attempt && tournament?.rulesVersion < 2) {
    return "一台の総合点で順位を決める。";
  }
  const sakurai = attempt ? isSakuraiVotes(attempt) : voteStyleFrom(config) === "sakurai";
  const evaluation = sakurai
    ? `各回は、その回に仕上げた工程だけで決める。提供の回は、${focusText}を見る。温度計の「攻めの帯」で提供・調整を終えると、その回の審査が伸びる。`
    : "各回は、その回までに仕上げた工程の成績で決める。";
  return ALLOCATION + evaluation;
}

export const openRuleSheet = () => modal({
  title: "大会の規則",
  className: "rule-sheet-modal",
  body: ruleSheetPanel(),
  options: [{ label: "閉じる", value: true, primary: true, test: "rule-sheet-close" }],
});
