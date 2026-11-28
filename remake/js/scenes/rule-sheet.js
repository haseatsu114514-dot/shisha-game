import { el } from "../core/util.js";
import { modal } from "../core/ui.js";
import { config, state } from "../core/state.js";
import { REGULATION, regulationFor } from "../craft/steps.js";
import { voteStyleFrom } from "../core/vote-style.js";
import { COMPARISON_MARGIN } from "../chapters/tournament-ballot.js";
import { ch1RoundPoints, isSakuraiVotes, SAKURAI } from "../craft/ch1-votes.js";
import { JUDGE_PROFILES as CH2_JUDGE_PROFILES, SPEND as CH2_SPEND } from "../chapters/ch2-tournament-state.js";
import { JUDGE_PROFILES as CH3_JUDGE_PROFILES, SPEND as CH3_SPEND } from "../chapters/ch3-tournament-state.js";
import { CH4_JUDGE_WEIGHTS, CH4_SPEND } from "../chapters/ch4-tournament-state.js";

export function ruleSheetPanel(chapter = state?.chapter || 1) {
  const regulation = chapter === state?.chapter ? regulationFor({ mode: "tournament" }) : REGULATION[chapter];
  const tournament = { 1: "SMOKE CROWN CUP", 2: "県大会", 3: "全国大会", 4: "HAZE: GRAND SMOKE" }[chapter] || "大会";
  const challenge = chapter === 3 && regulation?.label
    ? `${regulation.label}。甘み・苦み・後味の調整で一台に仕上げる。`
    : regulation?.label || "大会の課題を確認する。";
  const stock = chapter === 4
    ? "出発前に持ち込み申請した方針の葉は大会が預かり、当日は好きなだけ使える。ほかの葉は自分の在庫から持ち込む。事前に練習した葉ほど、本番で手に馴染む。"
    : "課題の葉は大会が用意し、当日は好きなだけ使える。ほかの葉は自分の在庫から持ち込む。事前に買って練習した葉ほど、本番で手に馴染む。";
  const article = (number, title, ...body) => el("section.rule-article", [
    el("h3", { text: `第${number}条　${title}` }), ...body.map(text => el("p", { text })),
  ]);
  const judging = chapter === 1 ? [ch1Judging()] : laterJudging(chapter);
  return el("article.rule-sheet", { dataset: { test: "rule-sheet", chapter: String(chapter) }, "aria-label": `${tournament}の競技規則` }, [
    el("p.rule-sheet-eyebrow", { text: tournament }),
    el("h2", { text: "競技規則" }),
    el("p.rule-sheet-lead", { text: "出場前に確認する項目" }),
    article("一", "課題", challenge),
    article("二", "材料", stock),
    article("三", "一台の進行", "一台を制作し、吸い出して提供する。その後も同じ一台を二度調整する。"),
    judging ? article("四", "審査", ...judging) : null,
    el("p.rule-sheet-foot", { text: "大会運営委員会" }),
  ]);
}

const focusText = Object.entries(SAKURAI.focus).map(([id, f]) => `${{ uezono: "上園", dr_charcoal: "チャコール博士", sensu: "千須" }[id]}は${f.detail}`).join("、");
const roundPoints = SAKURAI.rounds.map((_, round) => ch1RoundPoints("uezono", round)).join("・");
const allocationRule = useComparison => useComparison
  ? `各回は最高評価の台に「その回の点−1」を入れる。残り1点は別の台を選ぶ比較票。審査員が持ち回りで見る台が次点の評価から${COMPARISON_MARGIN}点以内ならその台へ、それより差があれば次点へ入れる。`
  : "各回は1位に「その回の点−1」、2位に1点。";
function ch1Judging() {
  const tournament = state?.chapter === 1 ? state.tournament : null;
  const attempt = tournament?.voteAttempt;
  // 試合中は開始時の方式。票の記録がない旧版の試合は、一台の総合点で順位が決まる。
  if (state?.chapter === 1 && state.phase === "tournament" && !attempt && tournament?.rulesVersion < 2) {
    return "一台の総合点で順位を決める。";
  }
  const sakurai = attempt ? isSakuraiVotes(attempt) : voteStyleFrom(config) === "sakurai";
  const evaluation = sakurai
    ? `各回は、その回に仕上げた工程で決める。提供の回は、${focusText}を見て、制作ボーナスも反映する。温度計の「攻めの帯」で提供・調整を終えると、その回の審査が伸びる。`
    : "各回は、その回までに仕上げた工程の成績で決める。提供の回には制作ボーナスも反映する。";
  const rule = allocationRule(!attempt || attempt.comparisonBallot);
  return `審査員3人が各10点を、準備・提供・調整1回目・調整2回目の4回に分けて入れる（${roundPoints}点）。${rule}千須は最終回の持ち点から1点を残し、もう一口吸いたい一台へ入れる。${evaluation}`;
}

const allocation = (spend, match) =>
  `審査員3人が各${spend.reduce((sum, points) => sum + points, 0)}点を、準備・提供・調整1回目・調整2回目の4回に分けて入れる（${spend.join("・")}点）。${allocationRule(!match?.craft || match.comparisonBallot)}新しい試合では全出場者に基礎票1点が入る。`;
const standings = order =>
  `各回の審査で評価が同じなら${order}の順。最終順位は総得票で決め、同点なら好みなどの補正を加える前の最終回の出来栄え、そこも同じなら各回の審査と同じ順で決める。`;

function laterJudging(chapter) {
  if (chapter === 2) {
    const { uezono, dr_charcoal, sensu } = CH2_JUDGE_PROFILES;
    return [
      `その回までの出来栄えを比べる。${uezono.label}は好みであげはに4点、クラウドに1点、${dr_charcoal.label}は神崎竜二に3点、${sensu.label}はクラウドに3点を評価に加える。`,
      allocation(CH2_SPEND, state?.flags?._ch2_tournament),
      standings("あげは・はじめ・神崎竜二・クラウド"),
    ];
  }
  if (chapter === 3) {
    const { emil, dr_charcoal } = CH3_JUDGE_PROFILES;
    return [
      `エミル・チャコール博士・千須はその回までの出来栄えを比べる。綾取の柑橘にはエミルが${emil.citrus}点、博士が＋${dr_charcoal.citrus}点の補正をかける。`,
      `試喫順は挑戦ごと、審査員と回ごとに決まり、綾取は先になりやすい。提供以降、水を挟まず綾取の直後に吸った台の評価は、エミルは${emil.contrast}点、博士は＋${dr_charcoal.contrast}点変わる。綾取の後に水を飲む割合はエミルが${emil.waterChance * 100}%、博士が${dr_charcoal.waterChance * 100}%で、千須は毎回飲む。`,
      allocation(CH3_SPEND, state?.flags?._ch3_tournament),
      standings("はじめ・綾取・スティーブ・ヴォルク"),
    ];
  }
  if (chapter === 4) {
    const match = state?.chapter === 4 ? state.flags?._ch4?.match : null;
    const legacy = match?.craft && (match.rulesVersion ?? 1) < 3;
    const { sensu, da_silva, emil } = CH4_JUDGE_WEIGHTS;
    return [
      legacy
        ? "千須・ダ・シルヴァ・エミルは、はじめの台をその回までに仕上げた工程の平均で評価し、最後の回は一台の総合点を見る。"
        : `はじめの台は、穴あけ・炭の温度・提供・調整1回目・調整2回目・最終総合のうち、その回までに確定した項目で評価する。穴あけを省いた台は、その項目を外す。項目の重みは、千須が最終総合を${sensu[5]}、ダ・シルヴァが炭の温度を${da_silva[1]}、エミルが調整2回目を${emil[4]}とし、ほかの項目は各${sensu[0]}。各項目の点に重みをかけて足し、使った重みの合計で割る。`,
      "相手の台には、各回ごとの出来栄えの点を使う。",
      allocation(CH4_SPEND, match),
      "各回の審査で評価が同じなら、はじめ・なる・シェイク・王 煙楼の順。最終順位は総得票で決め、同点なら最終回の出来栄え（はじめは一台の総合点）、そこも同じなら各回の審査と同じ順で決める。",
    ];
  }
  return null;
}

export const openRuleSheet = () => modal({
  title: "大会の規則",
  className: "rule-sheet-modal",
  body: ruleSheetPanel(),
  options: [{ label: "閉じる", value: true, primary: true, test: "rule-sheet-close" }],
});
