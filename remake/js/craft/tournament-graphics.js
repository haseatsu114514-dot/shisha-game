// 大会の中継グラフィック（第1章〜第3章共通）。
// 審査員ごとに色を決め、票の帯・持ち点の粒・凡例を同じ色でそろえる。
import { el } from "../core/util.js";
import { displayName } from "../core/data.js";
import { state } from "../core/state.js";
import { autoSkill } from "./common.js";

/** 審査員ごとの色と短い呼び名 */
export const JUDGE_LOOK = {
  maezono: { short: "上園", color: "#ff8db4" },
  emil: { short: "エミル", color: "#8fb2ff" },
  dr_kemuri: { short: "博士", color: "#5fe2cf" },
  nagumo: { short: "南雲", color: "#f6c95e" },
};
export const VOTE_SCALE = 20; // 帯の全幅＝20点（2人分の満票）
const look = (judge) => JUDGE_LOOK[judge] || { short: displayName(judge, state), color: "#c9bcd8" };
/** table[judge][contestant] の合計 */
export const givenBy = (table, judge) => Object.values(table[judge] || {}).reduce((a, b) => a + b, 0);

/**
 * 審査員ごとに色分けした票の帯。どの審査員の点で伸びたかが一目で分かる。
 * @param judges 審査員idの並び（帯の左から）
 * @param upto   先頭から何人分を伸ばすか（残りは0幅で置き、あとで伸ばせる）
 */
export function voteStack(table, contestant, cls, judges, upto = judges.length) {
  return el(`i.${cls}.vote-stack`, { "aria-hidden": "true" }, judges.map((judge, k) => el("b", {
    dataset: { judge },
    style: { width: `${k < upto ? (table[judge]?.[contestant] || 0) / VOTE_SCALE * 100 : 0}%`, "--c": look(judge).color },
  })));
}

/** 審査員の持ち点（10点を10粒で）。投入済みは点灯、held の審査員は保留中として鍵を付ける。 */
export function judgePanel(table, judges, { held = [], name = (j) => displayName(j, state), face = null, cls = "" } = {}) {
  return el(`div.judge-panel${cls}`, { dataset: { test: "judge-panel" } }, judges.map((judge) => {
    const used = givenBy(table, judge), waiting = held.includes(judge);
    return el(`div.judge-chip${waiting ? ".held" : ""}`, { dataset: { judge, spent: String(used) }, style: { "--c": look(judge).color } }, [
      face ? face(judge) : null,
      el("span.judge-name", { text: name(judge) }),
      el("i.judge-pips", { "aria-hidden": "true" }, Array.from({ length: 10 }, (_, k) => el(k < used ? "b.on" : "b"))),
      el("small.judge-left", { text: waiting ? "10点を保留中" : used >= 10 ? "全10点 投入済み" : `投入 ${used} ／ 残り ${10 - used}` }),
    ]);
  }));
}

/** 凡例（色＝審査員） */
export const judgeLegend = (judges) => el("div.judge-legend", { "aria-hidden": "true" }, judges.map((judge) =>
  el("span", { style: { "--c": look(judge).color } }, [el("i"), look(judge).short])));

/** 数字を from→to へ数え上げる（自動進行中・動きを減らす設定では即座に）。 */
export function countUp(node, from, to, ms, format = String) {
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (autoSkill() || reduced || ms <= 0 || from === to) { node.textContent = format(to); return; }
  const start = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - start) / ms), eased = 1 - (1 - k) ** 3;
    node.textContent = format(Math.round(from + (to - from) * eased));
    if (k < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** 結果カード共通の「今回よかったこと／次に変える一つ」（第2章以降、#1909）。行が無ければ出さない。 */
export function craftReviewBlock(lines, test = "craft-review") {
  if (!lines?.length) return null;
  return el("div.ch2-contest-reason.craft-review", { dataset: { test } }, [
    el("b.ch2-contest-reason-tag", { text: "振り返り" }), ...lines.map(text => el("p", { text })),
  ]);
}
