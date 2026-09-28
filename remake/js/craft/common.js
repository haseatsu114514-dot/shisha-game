// ミニゲーム共通の部品（評価ランク・結果カード・自動操作・キー入力）。
import { el, sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { tier01 } from "../core/stats.js";
import { craftTest } from "./session.js";

export const gradeOf = (s) => (s >= 90 ? "S" : s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D");
export const autoSkill = () => craftTest.auto; // "good" | "bad" | null

/** 腕前（★）の効き。技術=ゲージ減速・センス=ジャスト幅・洞察=読みやすさ。どれも「そこそこ有利」まで */
export const skill = {
  slow: () => 1 + 0.18 * tier01("technique"),
  window: () => 1 + 0.45 * tier01("sense"),
  clarity: () => tier01("insight"),
};

/** 工程の結果カード。自動操作中は少し待って勝手に閉じる */
export function resultCard(panel, { title, grade, lines = [], button = "次へ" }) {
  return new Promise((resolve) => {
    const btn = el("button.btn.primary.rc-next", {
      dataset: { test: "step-next" },
      onclick: () => {
        SE.select();
        card.classList.remove("show");
        card.classList.add("done");
        setTimeout(() => card.remove(), 300);
        resolve();
      },
    }, [el("span.btn-label", { text: button })]);
    const card = el("div.result-card", [
      el("div.rc-title", { text: title }),
      grade ? el(`div.rc-grade.g-${grade}`, { text: grade }) : null,
      el("ul.rc-lines", lines.filter(Boolean).map((t) => el("li", { text: t }))),
      btn,
    ]);
    panel.append(card);
    requestAnimationFrame(() => card.classList.add("show"));
    SE.stamp();
    if (autoSkill()) sleep(120).then(() => btn.click());
  });
}

/** キー入力（Space / Enter など）をミニゲームの間だけ拾う */
export function keys(map) {
  const h = (e) => {
    const fn = map[e.key] || map[e.code];
    if (fn) { e.preventDefault(); fn(e); }
  };
  window.addEventListener("keydown", h);
  return () => window.removeEventListener("keydown", h);
}

/** 画面内の座標で判定スタンプを出す（パネル基準） */
export function popStamp(host, text, kind = "", x = "50%", y = "40%") {
  const s = el(`div.stamp${kind ? "." + kind : ""}`, { text, style: { left: x, top: y } });
  host.append(s);
  setTimeout(() => s.remove(), 1100);
}
