// 営業時間と案内。状態を読むだけで、行動・料金・会話記録は変更しない。
import { RIN_AWAY_DAY } from "../core/rules.js";

export function openingStatus(spot, save) {
  if (!spot.openSlots || spot.openSlots.includes(save.slot)) return { ok: true };
  const tag = spot.openSlots.includes(1) ? "夜から営業" : "昼のみ営業";
  return { ok: false, tag, why: tag };
}

export function rinUnavailable(save) {
  if (save.day % 7 === RIN_AWAY_DAY) return "今日は担当者が出張中";
  if (save.slot !== 1) return "2階の相談は夜から";
  if (save.visitedDay.rin === save.day) return "今日は訪問済み";
  return "";
}

export function spotTimeNote(spot, save) {
  if (spot.openSlots) return spot.openSlots.includes(1) ? "夜のみ営業" : "昼のみ営業";
  if (spot.kind === "shop") return save.slot === 1 ? rinUnavailable(save) || "2階の相談を受付中" : "買い物は昼夜・2階の相談は夜";
  if (spot.kind === "trpg") return save.slot === 0 ? "昼：店長と無料試遊・本選び" : "夜：仲間とTRPG";
  if (spot.id === "choizap") return save.slot === 0 ? "無人ジム・動画で自主トレ" : "無人ジム・夜の自主トレ";
  if (spot.id === "kannon") return save.slot === 0 ? "昼：猫と街の人のいる境内" : "夜：静かな境内でひと休み";
  if (spot.kind === "tonari" || spot.kind === "rival") return save.slot === 0 ? "昼：仕込みや調整の話" : "夜：常連が集まる時間";
  return "";
}
