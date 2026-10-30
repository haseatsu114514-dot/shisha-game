// 営業時間と案内。状態を読むだけで、行動・料金・会話記録は変更しない。
import { RIN_AWAY_DAY } from "../core/rules.js";

const slotsFor = spot => spot.openSlots || (spot.kind === "fortune" ? [0] : null);

// 昼/夜の二枠では礼拝の時刻を刻まない。昼の枠は礼拝時間外の案内付き見学を表す。
// 曜日は day 1=月曜として扱い、金曜の昼枠は午前の見学がないため閉じる（安全側の仮置き）。
export const MOSQUE_VISITING_HOURS = Object.freeze({
  openSlots: Object.freeze([0]),
  closedWeekSlots: Object.freeze({ 5: Object.freeze([0]) }),
  closedWhy: "金曜午前は見学できません",
});

export function openingStatus(spot, save) {
  const slots = slotsFor(spot);
  if (spot.closedWeekSlots?.[save.day % 7]?.includes(save.slot)) {
    const why = spot.closedWhy || "この時間は見学できません";
    return { ok: false, tag: why, why };
  }
  if (!slots || slots.includes(save.slot)) return { ok: true };
  const tag = slots.includes(1) ? "夜から営業" : "昼のみ営業";
  return { ok: false, tag, why: tag };
}

export function rinUnavailable(save) {
  if (save.day % 7 === RIN_AWAY_DAY) return "今日は担当者が出張中";
  if (save.slot !== 1) return "2階の相談は夜から";
  if (save.visitedDay.rin === save.day) return "今日は訪問済み";
  return "";
}

export function spotTimeNote(spot, save) {
  const slots = slotsFor(spot);
  if (slots) return slots.includes(1) ? "夜のみ営業" : "昼のみ営業";
  if (spot.kind === "shop") return save.slot === 1 ? rinUnavailable(save) || "2階の相談を受付中" : "買い物は昼夜・2階の相談は夜";
  if (spot.kind === "trpg") return save.slot === 0 ? "昼：店長と無料試遊・本選び" : "夜：仲間とTRPG";
  if (spot.id === "choizap") return save.slot === 0 ? "無人ジム・動画で自主トレ" : "無人ジム・夜の自主トレ";
  if (spot.id === "kannon") return save.slot === 0 ? "昼：猫と街の人のいる境内" : "夜：静かな境内でひと休み";
  return "";
}
