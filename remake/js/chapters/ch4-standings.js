// 世界大会の途中順位（#2031）。第2・3章の「いま、動いた持ち点。」と同じ部品で、投票が動いた工程の後に一度だけ見せる。
// 保存には触れない（票と順位は ch4-tournament-state.js が確定済み）。
import { faceIconUrl, portraitInfo, displayName } from "../core/data.js";
import { el } from "../core/util.js";
import { state } from "../core/state.js";
import { modal } from "../core/ui.js";
import { voteStack, judgePanel, judgeLegend } from "../craft/tournament-graphics.js";
import { CH4_JUDGES, chapterFourStandings } from "./ch4-tournament-state.js";

// 内部名 wang の表示と顔は master_hookah（王煙楼）。
const FACE = { wang: "master_hookah" };
const NAME = { wang: "王 煙楼" };
const nameOf = id => NAME[id] || displayName(FACE[id] || id, state);
const NOTES = [
  "制作が終わり、次は吸い出しと提供。",
  "提供を終えた一台。次は客席での調整。",
  "一度目の調整を終え、同じ一台をもう一度確かめる。",
];

function avatar(id) {
  const who = FACE[id] || id;
  const src = faceIconUrl(who) || portraitInfo(who, "normal")?.src;
  return src ? el("span.ch2-contest-avatar", [el("img", { src, alt: "" })])
    : el("span.ch2-contest-avatar", { "aria-hidden": "true", text: nameOf(id).slice(0, 2) });
}

export function chapterFourStandingsView(p) {
  const rows = chapterFourStandings(p);
  return el("div.ch4-standings", { dataset: { test: "ch4-standings" } }, [
    el("p.ch2-contest-note", { text: NOTES[Math.max(0, Math.min(NOTES.length - 1, p.voted - 1))] }),
    el("section.ch2-contest-board", [judgeLegend(CH4_JUDGES), el("ol.ch2-contest-ranking", rows.map(row =>
      el(`li.ch2-contest-rival${row.id === "hajime" ? ".me" : ""}`, { dataset: { contestant: row.id, rank: String(row.rank) } }, [
        el("b.rank-medal", { text: String(row.rank) }), avatar(row.id), el("span", { text: row.id === "hajime" ? "はじめ" : nameOf(row.id) }),
        voteStack(p.votes, row.id, "ch2-contest-stack", CH4_JUDGES),
        el("strong", [String(row.points), el("small", { text: "pt" })]),
      ])))]),
    judgePanel(p.votes, CH4_JUDGES, { cls: ".ch2-contest-judges" }),
  ]);
}

/** 投票が動いた直後の途中順位。OK で制作へ戻る。 */
export async function showChapterFourStandings(p) {
  await modal({ title: "いま、動いた持ち点。", body: chapterFourStandingsView(p),
    options: [{ label: "続きを作る", value: true, primary: true, test: "ch4-standings-continue" }] });
}
