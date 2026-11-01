// ゲーム内のその日の気候。天気の種から決め、一台の途中やタイマー操作では引き直さない。
import { clamp } from "../core/util.js";

export function steamEnvironment(rainy, day = 1, seed = 0, time = "day") {
  const hash = Math.imul((seed + day * 3571) | 0, 2654435761) >>> 0;
  return {
    rainy, day,
    ambientC: (rainy ? 19 : 22) + hash % 7 - (time === "night" ? 2 : 0),
  };
}

export function steamClimate(environment = {}) {
  const rainy = !!environment.rainy;
  const ambientC = clamp(Number.isFinite(environment.ambientC) ? environment.ambientC : rainy ? 21 : 23, 5, 38);
  // 気温は初期の熱と熱の入り方に、雨の日は熱の入り方に効く。実機の物理温度ではなくゲームの温度帯への補正で、
  // 係数はゲーム用の調整値。湿度は計算に使わない（#1129 オーナー決定 2026-10-30）。
  const offset = (ambientC - 23) * .0025 - (rainy ? .01 : 0);
  const transfer = clamp(1 + (ambientC - 23) * .012 - (rainy ? .055 : 0), .72, 1.14);
  const precision = environment.precision === true ? clamp(environment.precisionAmount ?? .5,0,1) : 1;
  return { rainy, ambientC, offset: offset * precision, transfer: 1 + (transfer - 1) * precision };
}

// 洞察で炭の状態を読み取る。最高でも6割までで、実際の揺らぎを全部は知れない。
export function steamForecastProfile(insight, variation, { readBonus = 0 } = {}) {
  const precision = clamp(insight ?? 0, 0, 1), bonus = clamp(readBonus, 0, .3), read = Math.min(.9, precision * .6 + bonus);
  return { precision, offset: variation.offset * read, transfer: 1 + (variation.transfer - 1) * read,
    ...(bonus ? { readBonus: bonus } : {}) };
}
