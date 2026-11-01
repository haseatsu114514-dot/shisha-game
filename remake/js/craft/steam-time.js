// キッチンタイマーの秒数が正本。旧工程・テストの steamMin（分）も読めるようにする。
import { clamp } from "../core/util.js";

export const MAX_STEAM_SECONDS = 10 * 60;
export const normalizeSteamSeconds = (seconds) => clamp(Math.round((Number.isFinite(seconds) ? seconds : 300) / 10) * 10, 0, MAX_STEAM_SECONDS);

export function steamSecondsOf(cs) {
  const seconds = cs?.steamSeconds ?? cs?.steam?.seconds ?? (cs?.steamMin != null ? cs.steamMin * 60 : (cs?.steam?.min ?? 5) * 60);
  return Math.max(cs?.zeroSteam === true && cs?.mode !== "tutorial" ? 0 : 10, normalizeSteamSeconds(seconds));
}

export const clockTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
export const steamTimeLabel = (seconds) => `${Math.floor(seconds / 60) ? `${Math.floor(seconds / 60)}分` : ""}${seconds % 60 ? `${seconds % 60}秒` : ""}` || "0秒";

function interpolate(seconds, points) {
  if (seconds <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [end, value] = points[i], [start, before] = points[i - 1];
    if (seconds <= end) return before + (value - before) * (seconds - start) / (end - start);
  }
  return points.at(-1)[1];
}

// 3/5/8/10分の従来の温まり方と弾幕の長さを保ち、その間を連続的につなぐ。
export const steamHeatFor = (seconds) => interpolate(seconds, [[0, -0.14], [180, -0.06], [300, 0], [480, 0.12], [600, 0.18]]);
export const steamPlaySeconds = (seconds) => interpolate(seconds, [[10, 4], [180, 9], [300, 12], [480, 16], [600, 20]]);
// B08: 既習プレイヤーが任意で雑念回避を短くするときの上限。蒸らし時間・温度・採点は変えず、遊ぶ尺だけ縮める。
export const SHORT_DODGE_SECONDS = 8;
export const steamOpening = (seconds) => clamp((seconds - 300) / 180, 0, 1);
export const steamBurnRisk = (seconds) => interpolate(seconds, [[0, 0], [480, 0], [600, 9]]);
