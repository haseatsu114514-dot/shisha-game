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

// 雨は背景の外に出す。窓が確認できない店内は音だけにし、部屋の中に降らせない。
const TONARI_WINDOWS = [[2,70,54,245],[88,91,56,237],[300,148,31,160],[351,167,31,137],[830,196,46,108],[898,196,46,108]];
const HOME_WINDOWS = [[677,137,104,135],[800,137,76,135]];
const C_STATION_WINDOWS = [[540,190,17,99],[572,183,23,118],[609,174,39,129],[741,157,53,139],[812,147,51,150],[881,139,38,146],[1061,107,65,209],[1145,91,114,220]];
const CHOIZAP_WINDOWS = [[731,152,61,28],[815,152,50,28],[1123,156,104,24]];

/** 見えている背景と画面に対応する雨。抽選とセーブ値は既存 isRainy を使う。 */
export function rainScene(background, screen) {
  if (["title", "end", "result", "count"].includes(screen)) return null;
  const file = String(background || "").split(/[?#]/)[0].split("/").pop().replace(/\.webp$/, ".png");
  if (!file || /(?:title|tournament)/.test(file) || !isRainy()) return null;
  if (/^bg_(?:osu_map|map_local|street|kannon|tonari_outside|cafe|shishark|shishark_preparing)(?:_day|_night)?\.png$/.test(file)) {
    return { mode: "outdoor", windows: [] };
  }
  const windows = /^bg_tonari_inside_(?:day|night)\.png$/.test(file) ? TONARI_WINDOWS
    : /^bg_home_(?:day|night)\.png$/.test(file) ? HOME_WINDOWS
    : /^bg_c_station_(?:day|night)\.png$/.test(file) ? C_STATION_WINDOWS
    : file === "bg_choizap.png" ? CHOIZAP_WINDOWS : [];
  return { mode: "indoor", windows };
}
