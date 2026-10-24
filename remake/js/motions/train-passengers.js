// 乗車中の小さなカメオ。保存・在店予定・好感度には触れず、同じ時間帯の再読込でも変えない。
import { seeded } from "../core/util.js";

// 正規立ち絵の透過範囲。みんとは私服、ひよりは鞄を持った私服を使う。
export const PRIVATE_PASSENGERS = {
  samechan: { city: "home", face: "normal", bounds: [256, 266, 428, 908] },
  hiyori: { city: "home", face: "normal", bounds: [275, 173, 346, 1000] },
  minto: { city: "home", face: "ura_normal", bounds: [353, 230, 329, 948] },
  adam: { city: "home", face: "normal", bounds: [237, 122, 404, 1056] },
  tsumugi: { city: "home", face: "normal", bounds: [313, 305, 253, 869] },
  ageha: { city: "widehanga", face: "normal", bounds: [307, 201, 379, 977] },
  kumicho: { city: "widehanga", face: "normal", bounds: [229, 3, 445, 1184] },
  rei: { city: "widehanga", face: "normal", bounds: [202, 2, 517, 1195] },
};

/** ハロウィンの開催日は未定。章イベントが期間の開始/終了でflagを切り替える。 */
export function trainPassengers(value, { halloween, cameo, from, to } = {}) {
  const flags = value?.flags || {};
  const seasonal = halloween ?? (value?.chapter === 2 && flags._ch2_halloween_active === true);
  if (cameo !== undefined) return { halloween: !!seasonal, cameo: Object.hasOwn(PRIVATE_PASSENGERS, cameo) ? cameo : null };
  if (!(value?.chapter >= 2)) return { halloween: !!seasonal, cameo: null };
  // 行き先の街へ私用で遊びに行く側。経路を渡さない既存の演出確認は地元発として扱う。
  const origin = from ?? (to === "home" ? "widehanga" : "home");
  const destination = to ?? (origin === "home" ? "widehanga" : "home");
  if (!["home", "widehanga"].includes(origin) || !["home", "widehanga"].includes(destination) || origin === destination) {
    return { halloween: !!seasonal, cameo: null };
  }
  const pool = Object.keys(PRIVATE_PASSENGERS).filter(id => PRIVATE_PASSENGERS[id].city === origin && value.met?.[id]);
  const salt = value.chapter * 10000 + value.day * 10 + value.slot + (origin === "widehanga" ? 1000 : 0);
  const appears = seeded(value.weatherSeed, salt + 891) < 0.35;
  const id = pool[Math.floor(seeded(value.weatherSeed, salt + 892) * pool.length)] || null;
  return { halloween: !!seasonal, cameo: appears ? id : null };
}
