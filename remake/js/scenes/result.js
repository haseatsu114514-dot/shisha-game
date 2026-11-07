// リザルト画面（#2902）。スタッフロールを流し終えたあとに一度出し、ボタンでタイトル（見直しなら完了カード）へ進む。
// 項目は保存に既にある記録から拾う。新しく数え始めたのはプレイ時間（state.playMs）だけ。
// 基本画面は必要な数字だけを大きく出し、説明の文は置かない（ミニゲームを含めたUI方針）。
import { el, yen } from "../core/util.js";
import { showScreen } from "../core/ui.js";
import { displayName } from "../core/data.js";
import { AFFINITY_CHARACTERS, playTimeMs } from "../core/state.js";
import { AFFINITY_RANK_PTS } from "../core/stats.js";

/** プレイ時間の表示（「12時間 05分」。1時間未満は「42分」） */
export function formatPlayTime(ms) {
  const minutes = Math.max(0, Math.floor((Number.isFinite(ms) ? ms : 0) / 60000));
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return h ? `${h}時間 ${String(m).padStart(2, "0")}分` : `${m}分`;
}

/**
 * 画面に出す数字をまとめる。value は保存の形（state）。
 * match は第5章の勝負 { won: true|false|null, tally: { hajime, machine } | null }（章の進行側が渡す）。
 * 好感度MAXは、出会った相手のうち恋人か最大段階のポイントに届いた人（stats.js の affinityLevel と同じ基準）。
 */
export function resultSummary(value, { match = null, playMs = playTimeMs(value) } = {}) {
  const lovers = (value.lovers || []).filter(id => AFFINITY_CHARACTERS.includes(id));
  const maxPts = AFFINITY_RANK_PTS.at(-1);
  const maxed = AFFINITY_CHARACTERS.filter(id => value.met?.[id]
    && (lovers.includes(id) || (value.affinity?.[id] || 0) >= maxPts));
  return {
    playMs,
    playFull: value.playMsFull === true,
    cycle: Number.isInteger(value.cycle) && value.cycle > 1 ? value.cycle : 1,
    won: typeof match?.won === "boolean" ? match.won : null,
    tally: match?.tally || null,
    maxed: maxed.length,
    lovers,
    money: Number.isFinite(value.money) ? value.money : 0,
  };
}

function item(name, key, valueText, sub = "") {
  return el("div.result-item", { dataset: { test: `result-${key}` } }, [
    el("p.result-label", { text: name }),
    el("p.result-value", { text: valueText }),
    sub ? el("p.result-sub", { text: sub }) : null,
  ]);
}

function loverText(value, lovers) {
  if (!lovers.length) return "なし";
  if (lovers.length > 3) return `${lovers.length}人`;
  return lovers.map(id => displayName(id, value)).join("・");
}

/**
 * リザルト画面を出し、ボタンが押されるまで待つ。
 * @param value 保存の形（state）
 * @param opts.match 第5章の勝負（resultSummary を参照）
 * @param opts.next ボタンの文言（初回は「タイトルへ」、完了カードからの見直しは「もどる」）
 */
export function playResult(value, { match = null, next = "タイトルへ" } = {}) {
  const summary = resultSummary(value, { match });
  return new Promise(resolve => {
    const done = () => resolve(summary);
    const host = el("main.result-screen", { dataset: { test: "result" }, "aria-label": "リザルト" }, [
      el("div.panel.result-panel", [
        el("h1.result-title", { text: "RESULT" }),
        summary.cycle > 1 ? el("p.result-cycle", { text: `${summary.cycle}周目` }) : null,
        el("div.result-hero", { dataset: { test: "result-playtime" } }, [
          el("p.result-label", { text: "プレイ時間" }),
          el("p.result-hero-value", { text: formatPlayTime(summary.playMs) }),
          summary.playFull ? null : el("p.result-sub", { text: "記録を始める前の分は含みません" }),
        ]),
        el("div.result-grid", [
          summary.won === null ? null : item("SHISHA-9000 との勝負", "match", summary.won ? "勝利" : "敗北",
            summary.tally ? `挙手 ${summary.tally.hajime} 対 ${summary.tally.machine}` : ""),
          item("好感度MAX", "maxed", `${summary.maxed}人`),
          item("恋人", "lovers", loverText(value, summary.lovers)),
          item("所持金", "money", yen(summary.money)),
        ]),
        el("button.btn.primary.result-next", { type: "button", dataset: { test: "result-next" }, text: next, onclick: done }),
      ]),
    ]);
    showScreen("result", host);
    host.querySelector(".result-next")?.focus({ preventScroll: true });
  });
}
