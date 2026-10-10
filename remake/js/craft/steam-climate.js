// ゲーム内のその日の気候。天気の種から決め、一台の途中やタイマー操作では引き直さない。
import { clamp } from "../core/util.js";

export function steamEnvironment(rainy, day = 1, seed = 0, time = "day") {
  const hash = Math.imul((seed + day * 3571) | 0, 2654435761) >>> 0;
  return {
    rainy, day,
    ambientC: (rainy ? 19 : 22) + hash % 7 - (time === "night" ? 2 : 0),
    humidityPercent: (rainy ? 72 : 42) + (hash >>> 8) % 17,
  };
}

export function steamClimate(environment = {}) {
  const rainy = !!environment.rainy;
  const ambientC = clamp(Number.isFinite(environment.ambientC) ? environment.ambientC : rainy ? 21 : 23, 5, 38);
  const humidityPercent = clamp(Number.isFinite(environment.humidityPercent) ? environment.humidityPercent : rainy ? 80 : 52, 20, 95);
  // 気温は初期の熱に、湿気は熱の入り方に効く。実機の物理温度ではなくゲームの温度帯への補正。
  const offset = (ambientC - 23) * .0025 - Math.max(0, humidityPercent - 55) * .0006 - (rainy ? .01 : 0);
  const transfer = clamp(1 + (ambientC - 23) * .012 - Math.max(0, humidityPercent - 50) * .0025 - (rainy ? .055 : 0), .72, 1.14);
  return { rainy, ambientC, humidityPercent, offset, transfer };
}

// 洞察で炭の状態を読み取る。最高でも6割までで、実際の揺らぎを全部は知れない。
export function steamForecastProfile(insight, variation) {
  const precision = clamp(insight ?? 0, 0, 1), read = precision * .6;
  return { precision, offset: variation.offset * read, transfer: 1 + (variation.transfer - 1) * read };
}
