// ピンと街の入口は同じ訪問条件を使う。ここでは進行・支払い・訪問記録を変更しない。
import { state } from "../core/state.js";
import { yen } from "../core/util.js";
import { isUnlocked, isClosed, isTemporaryClosed, visitedToday } from "./spots.js";

export const freeGuide = (s, guide) => !!guide?.free && guide.pin === s.id;

export function spotAvailability(s, { guide = null } = {}) {
  if (!isUnlocked(s)) return { ok: false, why: "locked" };
  if (s.unavailable) return { ok: false, why: s.unavailable, tag: s.unavailableTag || s.unavailable };
  if (s.kind === "fortune" && state.fortuneDay === state.day) return { ok: false, why: "今日はもう占ってもらった", tag: "今日はもう占った" };
  if (guide && s.id !== guide.pin) return { ok: false, why: "今はスミさんの頼みが先", guided: true };
  if (isClosed(s)) {
    const tag = isTemporaryClosed(s) ? "本日臨時休業" : "本日定休日";
    return { ok: false, why: tag, tag };
  }
  if (s.kind !== "shop" && s.kind !== "rest" && s.kind !== "tonari" && visitedToday(s.id)) return { ok: false, why: "今日はもう行った", tag: "今日はもう行った" };
  if (s.cost && !freeGuide(s, guide) && state.money < s.cost) return { ok: false, why: `お金が足りない（${yen(s.cost)}）`, tag: "お金が足りない" };
  return { ok: true };
}
