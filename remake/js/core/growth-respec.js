// 組み直しの機会と仮状態。保存・UI・旧5能力を直接書き換えない。
import { BOARD_KEYS } from "./growth-board-data.js";
import { NODE_BY_ID } from "./growth-board-layout.js";
import { chapterThreeScenes } from "../chapters/ch3-scenes.js";
import { nextTokyoFreeTime } from "./tokyo-clock.js";

const COLORS = ["any", ...BOARD_KEYS];
const copy = value => JSON.parse(JSON.stringify(value));
const cycleOf = s => s.cycleId || `cycle:${s.cycle || 1}`;
const allocation = g => JSON.stringify([g.nodes, g.paid, g.hidane, g.litSince]);
const freeTime = s => s.phase === "daily" && (s.chapter !== 3
  || !!s.flags?._ch3_intro && !!nextTokyoFreeTime(s,
    chapterThreeScenes(s)[s.flags._ch3_intro.stage]?.id || "tournament"));

/** 初めて読む旧保存では開かない。実際の章／周回変更の後、最初の日常で開く。 */
export function syncRespecOpportunity(g, s) {
  const cycle = cycleOf(s), chapter = s.chapter || 1;
  let r = g.respec;
  if (!r || typeof r !== "object" || !["closed", "pending", "open"].includes(r.status)) {
    g.respec = { cycle, chapter, day: s.day, status: "closed" };
    return;
  }
  if (r.cycle !== cycle || r.chapter !== chapter) {
    const forward = r.cycle !== cycle || chapter > r.chapter;
    r = g.respec = { cycle, chapter, day: s.day,
      status: forward && (chapter > 1 || s.cycle > 1) ? "pending" : "closed" };
  }
  if (r.status === "pending" && freeTime(s)) {
    r.status = "open"; r.day = s.day;
  }
  if (r.status === "open" && r.day !== s.day) r.status = "closed";
}

export function canRespec(g, s) {
  return !!g?.respec && g.respec.status === "open" && g.respec.cycle === cycleOf(s)
    && g.respec.chapter === s.chapter && g.respec.day === s.day && freeTime(s);
}
export function closeRespecOpportunity(g) {
  if (g?.respec?.status === "open") g.respec.status = "closed";
}

/** 実際の支払のみ返す。記録欠落・不正な支払は推測せず、元の盤を保持する。 */
export function prepareRespec(g, s) {
  if (!canRespec(g, s)) return null;
  const removed = [...new Set(g.nodes)].filter(id => NODE_BY_ID[id]?.kind !== "lesson");
  if (!removed.length) return null;
  const draft = copy(g);
  for (const id of removed) {
    const pay = g.paid[id];
    if (!pay || typeof pay !== "object" || Array.isArray(pay)) return null;
    for (const [color, amount] of Object.entries(pay)) {
      if (!COLORS.includes(color) || !Number.isSafeInteger(amount) || amount < 0) return null;
      if (!Number.isSafeInteger(draft.hidane[color] + amount)) return null;
      draft.hidane[color] += amount;
    }
    delete draft.paid[id];
  }
  draft.nodes = draft.nodes.filter(id => NODE_BY_ID[id]?.kind === "lesson");
  draft.target = null;
  draft.litSince = Object.fromEntries(BOARD_KEYS.map(key => [key, 0]));
  return { base: allocation(g), growth: draft };
}

/** 仮状態の返金額も再検証。閉じる取消・LOAD・期限切れ・二重確定では適用しない。 */
export function commitRespec(g, transaction, s) {
  if (s?.growth !== g || !transaction || allocation(g) !== transaction.base) return false;
  const expected = prepareRespec(g, s);
  if (!expected || allocation(expected.growth) !== allocation(transaction.growth)) return false;
  for (const key of ["nodes", "paid", "hidane", "litSince", "target"]) g[key] = copy(transaction.growth[key]);
  return true;
}
