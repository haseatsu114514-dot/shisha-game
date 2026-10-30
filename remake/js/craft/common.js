// ミニゲーム共通の部品（評価ランク・結果カード・自動操作・キー入力）。
import { el, sleep, clamp } from "../core/util.js";
import { SE } from "../core/audio.js";
import { tier01 } from "../core/stats.js";
import { craftTest, presentBenchResult } from "./session.js";
import { craftCondition } from "../core/condition.js";

export const gradeOf = (s) => (s >= 90 ? "S" : s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D");
export const autoSkill = () => craftTest.auto; // "good" | "bad" | null

/** 吸いすぎ・熱すぎで溜まった疲れ（TH29）。針が速く、成功帯が狭くなる。3回分で頭打ち。 */
export const strainSlow = (cs) => 0.9 ** Math.min(3, cs?.strain || 0);
export const strainWindow = (cs) => 0.88 ** Math.min(3, cs?.strain || 0);

/** 腕前（★）に、その一台を作り始めたときの体力コンディションと、途中で溜まった疲れを重ねる。 */
export const skill = {
  slow: (cs) => (1 + 0.18 * tier01("technique")) * craftCondition(cs).slow * strainSlow(cs) * (cs.retryAssist ? 1.35 : 1),
  window: (cs) => (1 + 0.45 * tier01("sense")) * craftCondition(cs).window * strainWindow(cs) * (cs.retryAssist ? 1.5 : 1),
  clarity: (cs) => clamp(tier01("insight") + craftCondition(cs).focus - 1, 0, 1),
};

/** 工程の結果カード。自動操作中は少し待って勝手に閉じる */
export function resultCard(panel, { title, lines = [], summary = [], advice = "", button = "次へ" }) {
  const { evaluation, hasAudience } = presentBenchResult(panel, title, advice);
  // 結果を読むとき、直前の判定文字を重ねない。
  panel.querySelectorAll(".stamp").forEach((stamp) => stamp.remove());
  return new Promise((resolve) => {
    const btn = el("button.btn.primary.rc-next", {
      dataset: { test: "step-next" },
      onclick: () => {
        if (btn.disabled) return;
        btn.disabled = true;
        SE.select();
        card.classList.remove("show");
        card.classList.add("done");
        setTimeout(() => card.remove(), 300);
        resolve();
      },
    }, [el("span.btn-label", { text: button })]);
    const card = el(`div.result-card.compact${summary.length ? ".with-summary" : ""}`, [
      summary.length ? el("div.rc-summary", { dataset: { test: "step-summary" } }, summary.map((text) => el("p", { text }))) : null,
      !hasAudience ? el(`b.rc-evaluation.${evaluation.tone}`, { text: evaluation.mark, "aria-label": evaluation.label }) : null,
      el("div.rc-title", { text: title }),
      el("details.rc-details", [el("summary", { text: "詳しく見る", dataset: { test: "step-details" } }), el("ul.rc-lines", lines.filter(Boolean).map((t) => el("li", typeof t === "string" ? { text: t } : [t])))]),
      btn,
    ]);
    panel.append(card);
    requestAnimationFrame(() => card.classList.add("show"));
    SE.stamp();
    if (autoSkill()) sleep(120).then(() => btn.click());
  });
}

/** キー入力（Space / Enter など）をミニゲームの間だけ拾う */
export function keys(map, { actionSpace = false } = {}) {
  const h = (e) => {
    if (globalThis.document?.querySelector(".bench-guide[open]")) return;
    // 説明・体調を開く操作を、ミニゲームのSpace/Enterに流さない。
    if (e.target?.closest?.(".bench-condition")) return;
    if ((e.key === " " || e.key === "Enter") && e.target?.closest?.(".bench-guide, .timer-button")) return;
    // 蒸らしはSpaceをリフレッシュに予約する。Enterはフォーカス中のボタンを操作する。
    if ((e.key === "Enter" || (e.key === " " && !actionSpace)) && e.target?.closest?.(".dodge-action")) return;
    // 操作ボタンにフォーカスがある間は、ブラウザのボタン起動に任せる。
    if ((e.key === "Enter" || e.key === " ") && e.target?.closest?.(".pull-btns button, .hr-row button")) return;
    const fn = map[e.key] || map[e.code];
    if (fn) { e.preventDefault(); fn(e); }
  };
  window.addEventListener("keydown", h);
  return () => window.removeEventListener("keydown", h);
}

/** 表示名だけを統一する。内部の判定種別・点数・成功幅はそのまま使う。 */
export function timingLabel(kind, fallback = "") {
  if (kind === "perfect" || kind === "just") return "EXCELLENT";
  if (kind === "good") return "GOOD";
  if (kind === "bad" || kind === "miss") return "MISS";
  return fallback;
}

/** 画面内の座標で判定スタンプを出す（パネル基準） */
export function popStamp(host, text, kind = "", x = "50%", y = "40%") {
  const s = el(`div.stamp${kind ? "." + kind : ""}`, { text: timingLabel(kind, text), style: { left: x, top: y } });
  host.append(s);
  setTimeout(() => s.remove(), 1100);
}
