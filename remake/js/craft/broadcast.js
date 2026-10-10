// 大会の生放送レイヤー（旧版 #24/#20/#26・N4）。本番（tournament）のときだけ出る。
// ・ニコ動風コメント: 工程の出来に観客が反応して右から左へ流れる
// ・点数は作業台の上の SCORE（総合スコア TH42）に一本化した。以前の「体感スコア」の札は出さない
// ・MC の前振り＋ライバルの進行実況: 工程の頭でパッキーが煽り、ライバルの動きも順に流す
// 文面は remake/data/broadcast.json。
import { el, pick } from "../core/util.js";
import { DB } from "../core/data.js";
import { layers } from "../core/ui.js";
import { tickerSay } from "./session.js";

const ROWS = 7;
let nextRow = 0; // 行は順番に回して、同時に流れるコメントが重ならないようにする

const live = (cs) => cs?.mode === "tournament";
const bench = () => layers.screen.querySelector(":scope > .bench:not(.done)");

/** 流れるコメントの帯を、作業台の上に用意する（作業台が作り直されても付け直す） */
function ensure() {
  const b = bench();
  if (!b) return null;
  let lane = b.querySelector(".bc-lane");
  if (!lane) b.append((lane = el("div.bc-lane")));
  return { lane };
}

/** コメントを1本流す（右→左） */
export function comment(cs, text, { cls = "", row = null } = {}) {
  if (!live(cs)) return;
  const b = ensure();
  if (!b) return;
  const r = row != null ? row % ROWS : (nextRow++ % ROWS);
  const dur = 4.2 + Math.random() * 1.8;
  // 右上の SCORE の下（14%〜）から流す
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

/** 点数（0〜100）→ 観客の反応の段階 */
export const judgeOf = (score) => (score >= 88 ? "perfect" : score >= 74 ? "great" : score >= 55 ? "good" : "miss");

/** 工程の出来を、観客のコメント・パッキーの実況へまとめて反映（点数は SCORE が工程ごとに入れる） */
export function judge(cs, result) {
  if (!live(cs)) return;
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

/** 結果発表の前に、流れているコメントを片付ける */
export function clearComments() {
  layers.screen.querySelectorAll(".bc-lane").forEach((l) => l.replaceChildren());
}
