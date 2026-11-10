// ラクダレースのBGMキーと、走行速度→再生速度の対応。競走モデル・操作判定は触らない。
// 再生そのものは core/audio.js のフック（setBgmPlaybackRate / tickBgmPlaybackRate）に任せる。
import { PLAYER, WHIP } from "./camel-race-model.js";

export const CAMEL_RACE_BGM = "bgm_camel_race";

// 巡航（調子が最大でムチなし）で 1.00、ラストスパートのムチ上乗せで 1.14。
const CRUISE = PLAYER.base * (PLAYER.rhythmFloor + PLAYER.rhythmSpan);
const TOP = CRUISE + WHIP.spurtBoost;

export const CAMEL_RACE_BGM_RATE = Object.freeze({
  min: 1,
  max: 1.14,
  ease: 0.22,
  cruise: CRUISE,
  top: TOP,
});

/** プレイヤーの現在速度（m/s）を再生倍率へ。巡航以下は 1.00、上限は 1.14。 */
export function camelRaceBgmRate(speed) {
  const { min, max, cruise, top } = CAMEL_RACE_BGM_RATE;
  const value = Number(speed);
  if (!Number.isFinite(value) || value <= cruise) return min;
  const t = Math.min(1, (value - cruise) / (top - cruise));
  return min + (max - min) * t;
}
