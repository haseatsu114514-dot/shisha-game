// 周回（NG+）の表示専用ヘルパー（Issue #1228 U9 / 設計 §3.6・§8.3）。
// cycle/cycleId は SCHEMA 22 で state に入った値。ここでは値の解釈だけを行い、
// 状態・保存には一切触らない（旧セーブの表示で移行や保存を発生させない）。
// 周回メタ層（suien_remake_cycle）とは独立で、セーブ枠の生データを相手にする。

/** 表示・比較に使える周回数（1以上の整数）。欠損・不正なら null */
export function slotCycle(data) {
  const c = data?.cycle;
  return Number.isInteger(c) && c >= 1 ? c : null;
}

/** 比較に使える周回ID（非空文字列）。欠損・不正なら null */
export function slotCycleId(data) {
  const id = data?.cycleId;
  return typeof id === "string" && id.length > 0 ? id : null;
}

/**
 * 「N周目」の表示文。2周目以降だけ返す。
 * 1周目・cycle 欠損の旧セーブ・不正値では null（=何も表示しない。設計 §3.6）。
 * 2桁以上の周回数もそのまま出す（§10-14 は表示だけの未決定のため丸めない）。
 */
export function cycleBadgeText(data) {
  const c = slotCycle(data);
  return c !== null && c >= 2 ? `${c}周目` : null;
}

/**
 * 手動セーブの上書き確認に添える注意文（設計 §8.3 の確認2、U9）。
 * - 保存先に cycleId が無い（旧セーブ）: 同一周回と断定せず、その旨を返す
 * - 保存先と現在の cycleId が両方有効で異なる: 別周回の警告（保存先の周回数を出す）。
 *   周回数が同じでも ID が異なれば別周回として扱う
 * - 同一ID、または現在側のIDが判定できない: null（従来の確認文のまま）
 */
export function overwriteCycleNote(slotData, current) {
  const slotId = slotCycleId(slotData);
  if (!slotId) return "この枠は周回IDのない旧セーブです。";
  const curId = slotCycleId(current);
  if (!curId || curId === slotId) return null;
  const c = slotCycle(slotData);
  return c !== null ? `別の周回（${c}周目）のセーブを上書きします。` : "別の周回のセーブを上書きします。";
}
