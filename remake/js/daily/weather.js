// 天気（旧版 A8/W4）。日ごとに晴れ/雨を、セーブ固有の種から決める（約3割・DAY1 は晴れ固定）。
// 雨の日: マップに雨、観音堂・カフェは雨の回、つむぎは長居、バイトは長居客の追加注文ぶん給料に上乗せ。
import { state } from "../core/state.js";

export function isRainy(day = state?.day) {
  if (!state || !day || day < 2 || state.phase === "tournament") return false;
  if (state.weatherSeed == null) state.weatherSeed = Math.floor(Math.random() * 100000);
  const h = Math.imul(state.weatherSeed + day * 7919, 2654435761) >>> 0;
  return h % 100 < 30;
}

/** 雨の日だけ出す回（晴れの日はローテーションに出さない＝天気と文が食い違わない） */
export const RAIN_SPOT_TEXTS = { kannon: "kannon_rain", cafe: "cafe_window_rain" };
export const RAIN_BAITO = ["baito_rainy_day", "baito_tsumugi_rain"];
export const RAIN_BAITO_BONUS = 500;
