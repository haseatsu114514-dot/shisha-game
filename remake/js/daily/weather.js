// 天気（旧版 A8/W4）。日ごとに晴れ/雨を、セーブ固有の種から決める（約3割・DAY1 は晴れ固定）。
// 雨の日: マップに雨、観音堂・カフェは雨の回、つむぎは長居、バイトは長居客の追加注文ぶん給料に上乗せ。
import { state } from "../core/state.js";
import { setBackgroundWeatherSource } from "../core/data.js";
import { growthSkill } from "../core/growth-effects.js";

setBackgroundWeatherSource(weatherOf);

export function isRainy(day = state?.day) {
  if (!state || !day || day < 2 || state.phase === "tournament") return false;
  if (state.weatherSeed == null) state.weatherSeed = Math.floor(Math.random() * 100000);
  const h = Math.imul(state.weatherSeed + day * 7919, 2654435761) >>> 0;
  return h % 100 < 30;
}

/**
 * DAYカードに出す天気（CI109）。雨は isRainy のまま。雨でない日の約3割を「くもり」として見せるだけで、
 * くもりは会話・給料・制作を変えず、専用の曇天画がある背景だけ切り替える。DAY1 は晴れ。大会中は null。
 */
export function weatherOf(day = state?.day) {
  if (!state || !day || state.phase === "tournament") return null;
  if (isRainy(day)) return "rain";
  if (day < 2) return "sun";
  const h = Math.imul(state.weatherSeed + day * 104729, 2246822519) >>> 0;
  return h % 100 < 30 ? "cloud" : "sun";
}
export const WEATHER_LABEL = { sun: "晴れ", cloud: "くもり", rain: "雨" };

/** 空模様は同じ保存済みの種を読むだけ。表示のために天気を抽選し直さない。 */
export function tomorrowForecast(s = state) {
  if (!growthSkill(s, "K05") || !Number.isFinite(s?.weatherSeed) || s.phase === "tournament") return null;
  const day = (s.day || 1) + 1;
  const rain = (Math.imul(s.weatherSeed + day * 7919, 2654435761) >>> 0) % 100 < 30;
  const cloud = (Math.imul(s.weatherSeed + day * 104729, 2246822519) >>> 0) % 100 < 30;
  return WEATHER_LABEL[rain ? "rain" : cloud ? "cloud" : "sun"];
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
// 新カフェ店内の窓ガラスだけ。枠・室内の椅子・テーブルへ雨を重ねない。
const CAFE_WINDOWS = [[355,167,72,140],[456,167,93,141],[581,153,143,178],[765,153,91,174],[893,145,54,186],[963,119,231,207]];
// 第2章・柚ヶ谷の窓がある室内（1280×720 背景の実画像で確認した外窓ガラス領域のみ。柱・家具・水槽・暖簾・障子を避ける）
const YUZUGAYA_C_STATION_WINDOWS = [[878,100,24,168],[914,78,34,190],[962,54,34,284],[1114,8,64,300],[1182,8,64,300]];
const YUZUGAYA_SHOP_WINDOWS = [[60,66,96,102],[172,112,70,228],[256,146,48,172]];
const YUZUGAYA_AQUARIUM_WINDOWS = [[6,38,66,310],[152,144,84,204],[272,224,60,124],[358,276,42,72]];
const YUZUGAYA_SENTO_WINDOWS = [[52,114,74,110],[130,158,62,100],[218,228,82,68],[518,126,128,48]];
const VOLK_SHOP_WINDOWS = [[2,8,64,232],[126,48,70,300],[204,80,44,264],[256,98,26,242]];

const OUTDOOR_BG_RE = /^bg_(?:osu_map|map_local|widehanga_map|widehanga_station|street|kannon|tonari_outside|shishark|shishark_preparing|ch2_venue_bench|kemurikusa_outside)(?:_day|_night)?\.png$/;

const INDOOR_WINDOWS_BY_BG = [
  [/^bg_tonari_inside_(?:day|night)\.png$/, TONARI_WINDOWS],
  [/^bg_home_(?:day|night)\.png$/, HOME_WINDOWS],
  [/^bg_c_station_(?:day|night)\.png$/, C_STATION_WINDOWS],
  [/^bg_choizap(?:_night)?\.png$/, CHOIZAP_WINDOWS],
  [/^bg_cafe_(?:day|night)\.png$/, CAFE_WINDOWS],
  [/^bg_yuzugaya_c_station(?:_night)?\.png$/, YUZUGAYA_C_STATION_WINDOWS],
  [/^bg_yuzugaya_shop\.png$/, YUZUGAYA_SHOP_WINDOWS],
  [/^bg_yuzugaya_aquarium\.png$/, YUZUGAYA_AQUARIUM_WINDOWS],
  [/^bg_yuzugaya_sento\.png$/, YUZUGAYA_SENTO_WINDOWS],
  [/^bg_volk_shop\.png$/, VOLK_SHOP_WINDOWS],
];

/** 見えている背景と画面に対応する雨。抽選とセーブ値は既存 isRainy を使う。 */
export function rainScene(background, screen) {
  if (["title", "end", "result", "count"].includes(screen)) return null;
  const file = String(background || "").split(/[?#]/)[0].split("/").pop().replace(/\.webp$/, ".png")
    .replace(/_overcast_(day|night)\.png$/, "_$1.png");
  if (!file || /(?:title|tournament)/.test(file) || !isRainy()) return null;
  if (OUTDOOR_BG_RE.test(file)) {
    return { mode: "outdoor", windows: [] };
  }
  const windows = INDOOR_WINDOWS_BY_BG.find(([re]) => re.test(file))?.[1] || [];
  return { mode: "indoor", windows };
}

/** 背景が曇天差分済みか、昼の通常原画か、夜かを判定する（晴天原画に雨が重なる時の色調補正用）。 */
export function weatherSkyTone(background = "", tint = "") {
  const clean = String(background || "").split(/[?#]/)[0];
  if (!clean) return "none";
  if (/_overcast_(?:day|night)\.(?:png|webp)$/.test(clean)) return "overcast";
  if (tint === "night" || /_night\.(?:png|webp)$/.test(clean)) return "night";
  return "day";
}

/** 屋外雨の見え方区分（地図・駅前広場・街路・室内）。 */
export function weatherViewKind(background = "", scene = null) {
  if (!scene) return "none";
  if (scene.mode !== "outdoor") return "indoor";
  const file = String(background || "").split(/[?#]/)[0].split("/").pop();
  if (/^bg_(?:osu_map|map_local|widehanga_map)/.test(file)) return "map";
  if (/^bg_widehanga_station/.test(file)) return "station";
  return "street";
}

const OUTDOOR_DROP_COUNT = 54;
const WINDOW_DROP_COUNT = 5;
const OUTDOOR_RIPPLES = [
  [14, 76], [27, 84], [39, 71], [52, 87],
  [63, 74], [75, 82], [86, 69], [46, 79],
];

/**
 * #weather レイヤーに雨粒・霧・水紋を構築する。
 * - 屋外は遠景(far)・中景(mid)・近景(near)の3層で奥行きを出し、地面の波紋と霧を添える。
 * - 室内は窓ガラス座標にクリッピングし、既存の1窓5粒契約を維持しつつ奥行きと非同期配置を与える。
 */
export function renderWeatherLayer(host, scene, { sky = "day", view = "street", el } = {}) {
  if (!host || !el) return;
  host.replaceChildren();
  host.dataset.mode = scene?.mode || "none";
  host.dataset.sky = scene ? sky : "none";
  host.dataset.view = scene ? view : "none";
  host.hidden = !scene;
  if (!scene) return;

  if (scene.mode === "outdoor") {
    const node = el("div.weather-sheet.outdoor", {
      dataset: { view, sky },
      style: { "--rain-travel": "790px" },
    });
    node.append(el("span.weather-mist", { "aria-hidden": "true" }));
    for (let i = 0; i < OUTDOOR_DROP_COUNT; i++) {
      const depth = i % 6 === 0 ? "near" : i % 2 === 0 ? "mid" : "far";
      const left = ((i * 29 + (i % 3) * 17 + 7) % 98) + 1;
      const len = depth === "near" ? 42 + (i % 3) * 6 : depth === "mid" ? 28 + (i % 4) * 4 : 18 + (i % 4) * 3;
      const w = depth === "near" ? "2px" : depth === "mid" ? "1.6px" : "1.2px";
      const alpha = depth === "near" ? (0.74 + (i % 3) * 0.05).toFixed(2)
        : depth === "mid" ? (0.58 + (i % 3) * 0.05).toFixed(2)
        : (0.40 + (i % 3) * 0.05).toFixed(2);
      const dur = depth === "near" ? (0.50 + (i % 4) * 0.03).toFixed(2)
        : depth === "mid" ? (0.64 + (i % 5) * 0.04).toFixed(2)
        : (0.82 + (i % 5) * 0.05).toFixed(2);
      const delay = -(((i * 11 + 3) % 23) * 0.045).toFixed(3);
      node.append(el("i.weather-drop", {
        dataset: { depth },
        style: {
          left: `${left}%`,
          "--drop-len": `${len}px`,
          "--drop-w": w,
          "--drop-alpha": alpha,
          animationDuration: `${dur}s`,
          animationDelay: `${delay}s`,
        },
      }));
    }
    for (let i = 0; i < OUTDOOR_RIPPLES.length; i++) {
      const [rx, ry] = OUTDOOR_RIPPLES[i];
      node.append(el("b.weather-ripple", {
        style: {
          left: `${rx}%`,
          top: `${ry}%`,
          animationDuration: `${(1.35 + (i % 4) * 0.16).toFixed(2)}s`,
          animationDelay: `${-((i * 0.23) % 1.4).toFixed(2)}s`,
        },
      }));
    }
    host.append(node);
    return;
  }

  scene.windows.forEach((windowRect, winIdx) => {
    const node = el("div.weather-sheet.window", {
      style: {
        left: `${windowRect[0]}px`,
        top: `${windowRect[1]}px`,
        width: `${windowRect[2]}px`,
        height: `${windowRect[3]}px`,
        "--rain-travel": `${windowRect[3] + 60}px`,
      },
    });
    for (let i = 0; i < WINDOW_DROP_COUNT; i++) {
      const depth = i === 0 ? "near" : i <= 2 ? "mid" : "far";
      const left = ((winIdx * 23 + i * 37 + 11) % 88) + 6;
      const len = depth === "near" ? 28 : depth === "mid" ? 22 : 16;
      const w = depth === "near" ? "1.6px" : depth === "mid" ? "1.3px" : "1px";
      const alpha = depth === "near" ? "0.64" : depth === "mid" ? "0.50" : "0.35";
      const dur = (0.58 + ((winIdx + i) % 5) * 0.08).toFixed(2);
      const delay = -(((winIdx * 5 + i * 7) % 17) * 0.07).toFixed(2);
      node.append(el("i.weather-drop", {
        dataset: { depth },
        style: {
          left: `${left}%`,
          "--drop-len": `${len}px`,
          "--drop-w": w,
          "--drop-alpha": alpha,
          animationDuration: `${dur}s`,
          animationDelay: `${delay}s`,
        },
      }));
    }
    host.append(node);
  });
}
