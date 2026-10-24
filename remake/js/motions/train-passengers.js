// 乗車中の小さなカメオ。保存・在店予定・好感度には触れず、同じ時間帯の再読込でも変えない。
import { seeded } from "../core/util.js";

// 正規立ち絵の透過範囲。みんとは私服、ひよりは鞄を持った私服を使う。
export const PRIVATE_PASSENGERS = {
  samechan: { face: "normal", bounds: [256, 266, 428, 908] },
  hiyori: { face: "normal", bounds: [275, 173, 346, 1000] },
  minto: { face: "ura_normal", bounds: [353, 230, 329, 948] },
  adam: { face: "normal", bounds: [237, 122, 404, 1056] },
  tsumugi: { face: "normal", bounds: [313, 305, 253, 869] },
};

/** ハロウィンの開催日は未定。章イベントが期間の開始/終了でflagを切り替える。 */
export function trainPassengers(value, { halloween, cameo } = {}) {
  const flags = value?.flags || {};
  const seasonal = halloween ?? (value?.chapter === 2 && flags._ch2_halloween_active === true);
  if (cameo !== undefined) return { halloween: !!seasonal, cameo: Object.hasOwn(PRIVATE_PASSENGERS, cameo) ? cameo : null };
  if (!(value?.chapter >= 2)) return { halloween: !!seasonal, cameo: null };
  const pool = Object.keys(PRIVATE_PASSENGERS).filter(id => value.met?.[id]);
  const salt = value.chapter * 10000 + value.day * 10 + value.slot;
  const appears = seeded(value.weatherSeed, salt + 891) < 0.35;
  const id = pool[Math.floor(seeded(value.weatherSeed, salt + 892) * pool.length)] || null;
  return { halloween: !!seasonal, cameo: appears ? id : null };
}
