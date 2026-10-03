// 大会の生放送レイヤー（旧版 #24/#20/#26・N4）。本番（tournament）のときだけ出る。
// ・ニコ動風コメント: 工程の出来に観客が反応して右から左へ流れる
// ・体感スコア: 審査員の持ち点とは別系統の「観客ウケ」。判定のたびに「+N P」がポップする
// ・MC の前振り＋ライバルの進行実況: 工程の頭でパッキーが煽り、ライバルの動きも順に流す
// 文面は remake/data/broadcast.json。
import { el, pick } from "../core/util.js";
import { DB } from "../core/data.js";
import { layers } from "../core/ui.js";
import { tickerSay } from "./session.js";

const FEEL_PTS = { perfect: 12, great: 10, good: 6, miss: 0 };
const ROWS = 7;
let nextRow = 0; // 行は順番に回して、同時に流れるコメントが重ならないようにする

const live = (cs) => cs?.mode === "tournament";
const bench = () => layers.screen.querySelector(":scope > .bench:not(.done)");

/** 流れるコメントの帯と体感スコアの札を、作業台の上に用意する（作業台が作り直されても付け直す） */
function ensure(cs) {
  const b = bench();
  if (!b) return null;
  let lane = b.querySelector(".bc-lane");
  if (!lane) b.append((lane = el("div.bc-lane")));
  let feel = b.querySelector(".bc-feel");
  if (!feel) {
    feel = el("div.bc-feel", [el("span.bf-label", { text: "体感スコア" }), el("b.bf-num", { text: String(cs.feel || 0) }), el("span.bf-p", { text: "P" })]);
    (b.querySelector(".bench-top") || b).append(feel);
  }
  return { lane, feel };
}

/** コメントを1本流す（右→左） */
export function comment(cs, text, { cls = "", row = null } = {}) {
  if (!live(cs)) return;
  const b = ensure(cs);
  if (!b) return;
  const r = row != null ? row % ROWS : (nextRow++ % ROWS);
  const dur = 4.2 + Math.random() * 1.8;
  // 右上の体感スコア札の下（14%〜）から流す
  const c = el(`div.nico${cls ? "." + cls : ""}`, { text, style: { top: `${14 + r * 9}%`, animationDuration: `${dur}s` } });
  b.lane.append(c);
  setTimeout(() => c.remove(), dur * 1000 + 250);
}

/** 同じ種類のコメントを n 本、少しずつずらして流す */
export function burst(cs, kind, n = null) {
  const pool = DB.broadcast?.nico?.[kind] || [];
  if (!live(cs) || !pool.length) return;
  n = n ?? (kind === "perfect" ? 3 : 2);
  const cls = ["perfect", "miss", "rival"].includes(kind) ? kind : "";
  for (let i = 0; i < n; i++) setTimeout(() => comment(cs, pick(pool), { cls }), i * 170);
}

/** 体感スコアを足して「+N P」をポップ */
function feelPop(cs, pts, label) {
  const b = ensure(cs);
  if (!b || !(pts > 0)) return;
  cs.feel = (cs.feel || 0) + pts;
  const num = b.feel.querySelector(".bf-num");
  num.textContent = String(cs.feel);
  num.classList.remove("bump");
  void num.offsetWidth;
  num.classList.add("bump");
  b.feel.classList.add("show");
  const pop = el("div.feel-pop", [`+${pts}`, el("span", { text: "P" }), label ? el("small", { text: label }) : null]);
  b.feel.append(pop);
  setTimeout(() => pop.remove(), 1150);
}

/** 点数（0〜100）→ 観客の反応の段階 */
export const judgeOf = (score) => (score >= 88 ? "perfect" : score >= 74 ? "great" : score >= 55 ? "good" : "miss");

/** 工程の出来を、体感スコア・コメント・パッキーの実況へまとめて反映 */
export function judge(cs, result, label = "") {
  if (!live(cs)) return;
  const pts = FEEL_PTS[result] ?? 6;
  if (pts > 0) feelPop(cs, pts, label);
  burst(cs, result === "great" ? "perfect" : result);
  const lines = DB.broadcast?.ticker?.[result === "great" ? "perfect" : result];
  if (lines?.length) tickerSay(`パッキー「${pick(lines)}」`);
}

/** 工程の頭: MC の前振り＋その工程らしい観客の声＋ライバルの進行をひとつ */
export function block(cs, step) {
  if (!live(cs)) return;
  const bc = DB.broadcast || {};
  if (bc.mc?.[step]) tickerSay(`パッキー「${bc.mc[step]}」`);
  burst(cs, "block", 1);
  const sp = bc.step?.[step];
  if (sp?.length) setTimeout(() => comment(cs, pick(sp)), 900);
  const feed = bc.rivalFeed || [];
  cs.feedIdx = cs.feedIdx || 0;
  if (cs.feedIdx < feed.length) {
    const r = feed[cs.feedIdx++];
    setTimeout(() => { if (bench()) { tickerSay(`パッキー「${r}」`); burst(cs, "rival", 1); } }, 2700);
  }
}

/** 結果発表の前に、流れているコメントを片付ける（体感スコアは cs.feel に残る） */
export function clearComments() {
  layers.screen.querySelectorAll(".bc-lane").forEach((l) => l.replaceChildren());
}
