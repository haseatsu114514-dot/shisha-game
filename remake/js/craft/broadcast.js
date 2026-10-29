// 大会の生放送レイヤー（旧版 #24/#20/#26・N4）。本番（tournament）のときだけ出る。
// ・ニコ動風コメント: 工程の出来に観客が反応して右から左へ流れる
// ・出来栄えは観客の反応とパッキーの実況で伝える
// ・MC の前振りは固定の人物欄へ。流れるコメントは工程の結果確認中だけ出す
// 文面は remake/data/broadcast.json。
import { el, pick } from "../core/util.js";
import { DB } from "../core/data.js";
import { layers } from "../core/ui.js";
import { tickerSay, benchRoot } from "./session.js";

const ROWS = 5;
let nextRow = 0; // 行は順番に回して、同時に流れるコメントが重ならないようにする
let generation = 0;
const timers = new Set();
// 一台の間だけ抽選履歴を保持。表示の消去では忘れず、セーブには書き込まない。
const recentComments = new WeakMap();
function pickFresh(cs, pool, count) {
  const recent = recentComments.get(cs) || [];
  const available = [...new Set(pool)];
  const chosen = [];
  while (chosen.length < count && available.length) {
    let candidates = available.filter(text => !recent.includes(text));
    if (!candidates.length) {
      const oldest = Math.min(...available.map(text => recent.lastIndexOf(text)));
      candidates = available.filter(text => recent.lastIndexOf(text) === oldest);
    }
    const text = pick(candidates);
    chosen.push(text);
    available.splice(available.indexOf(text), 1);
    recent.push(text);
  }
  recentComments.set(cs, recent.slice(-24));
  return chosen;
}

const live = (cs) => cs?.mode === "tournament";

/** 流れるコメントの帯を、作業台の上に用意する（作業台が作り直されても付け直す） */
function ensure(cs) {
  const b = benchRoot(cs);
  if (!b) return null;
  let lane = b.querySelector(".bc-lane");
  if (!lane) b.append((lane = el("div.bc-lane", { "aria-hidden": "true" })));
  return { lane };
}

/** コメントを1本流す（右→左） */
export function comment(cs, text, { cls = "", row = null } = {}) {
  if (!live(cs)) return;
  const b = ensure(cs);
  if (!b) return;
  if (b.lane.children.length >= ROWS) return;
  const occupied = new Set([...b.lane.children].map(node => Number(node.dataset.row)));
  let r = row != null ? row % ROWS : nextRow++ % ROWS;
  for (let i = 0; i < ROWS && occupied.has(r); i++) r = (r + 1) % ROWS;
  if (occupied.has(r)) return;
  const dur = 7.2;
  const c = el(`div.nico${cls ? "." + cls : ""}`, { text, dataset: { row: r }, style: { top: `${5 + r * 15}%`, animationDuration: `${dur}s` } });
  b.lane.append(c);
  c.addEventListener("animationend", () => c.remove(), { once: true });
  defer(cs, () => c.remove(), dur * 1000 + 250);
}

function defer(cs, fn, delay) {
  const owner = benchRoot(cs), token = generation;
  if (!owner) return;
  const timer = setTimeout(() => {
    timers.delete(timer);
    if (token === generation && benchRoot(cs) === owner) fn();
  }, delay);
  timers.add(timer);
}

/** 章別の文面節（broadcast.json の chapter1/2/3）。無い章は null */
const chapterSection = (cs) => DB.broadcast?.[`chapter${cs?.chapter}`] || null;

/** 反応プールは共通分へ章別の追加分をマージする（章の空気だけ少し変える） */
const nicoPool = (cs, kind) => [
  ...(DB.broadcast?.nico?.[kind] || []),
  ...(chapterSection(cs)?.nico?.[kind] || []),
];

/** 同じ種類のコメントを n 本、少しずつずらして流す */
export function burst(cs, kind, n = null) {
  const pool = kind === "rival"
    ? chapterSection(cs)?.rivalComments || DB.broadcast?.nico?.rival || []
    : nicoPool(cs, kind);
  if (!live(cs) || !pool.length) return;
  n = n ?? (kind === "perfect" ? 3 : 2);
  const cls = ["perfect", "miss", "rival"].includes(kind) ? kind : "";
  pickFresh(cs, pool, n).forEach((text, i) => defer(cs, () => comment(cs, text, { cls }), i * 750));
}

/** 点数（0〜100）→ 観客の反応の段階 */
export const judgeOf = (score) => (score >= 88 ? "perfect" : score >= 74 ? "great" : score >= 55 ? "good" : "miss");

/** 工程の出来を、観客のコメント・パッキーの実況へまとめて反映 */
export function judge(cs, result) {
  if (!live(cs)) return;
  burst(cs, result === "great" ? "perfect" : result);
  const lines = DB.broadcast?.ticker?.[result === "great" ? "perfect" : result];
  if (lines?.length) tickerSay(`パッキー「${pick(lines)}」`);
}

/** 工程の頭では固定のMC欄だけを更新。観客コメントは完了時に出す。 */
export function block(cs, step) {
  if (!live(cs)) return;
  clearComments();
  const bc = DB.broadcast || {};
  if (bc.mc?.[step]) tickerSay(`パッキー「${bc.mc[step]}」`);
}

/** 結果を確認している間だけ、その工程の出来への反応を流す。 */
export function completed(cs, step, score) {
  if (!live(cs)) return;
  clearComments();
  const kind = judgeOf(score);
  const genericKind = kind === "great" ? "perfect" : kind;
  const cls = genericKind;
  const shared = DB.broadcast?.completion?.[step]?.[kind] || [];
  const local = chapterSection(cs)?.completion?.[step]?.[kind] || [];
  const generic = nicoPool(cs, genericKind);
  // 工程に触れた視聴者コメント2本を先頭に、短い歓声3本を続けて数を増やす。
  // 章別の一言があれば1本はそこから選び、章ごとの客席の空気を出す。
  // 以前の「【炭焼き】…」のような機械的な工程ラベルは付けない（コメント自体が工程に触れている）。
  const specific = local.length && shared.length
    ? [...pickFresh(cs, local, 1), ...pickFresh(cs, shared, 1)]
    : pickFresh(cs, [...shared, ...local], 2);
  const lines = specific.length ? [...specific, ...pickFresh(cs, generic, 3)] : pickFresh(cs, generic, 3);
  lines.forEach((text, i) => {
    if (i === 0) comment(cs, text, { cls });
    else defer(cs, () => comment(cs, text, { cls }), i * 600);
  });
}

/** 結果発表の前に、流れているコメントを片付ける */
export function clearComments() {
  generation++;
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
  nextRow = 0;
  layers.screen.querySelectorAll(".bc-lane").forEach((l) => l.replaceChildren());
}
