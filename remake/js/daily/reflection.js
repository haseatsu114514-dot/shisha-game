// 内省（SPEC 第2版 2.8）: 参拝の場所で静かに振り返ると、学んだことが火になる。盤で火種を灯せるのはこの時だけ。
// 時間を使わない（行動の回数も体力も減らない）。大会前夜に火種が残っていれば、強制の場面で盤を開く。
import { state, save } from "../core/state.js";
import { play } from "../vn/engine.js";
import { growthEnabled, ensureGrowth, openGrowthBoard } from "../core/growth.js";
import { hasUsableHidane } from "../core/growth-board.js";

/** 場所ごとの場面と背景。新設の神社・モスクの背景は #1788 の画像が届くまで近い背景で代える */
export const REFLECT_PLACES = {
  kannon: { scene: "reflect_kannon", bg: "res://assets/backgrounds/bg_kannon_night.png", label: "観音堂" },
  tokyo_shrine: { scene: "reflect_tokyo_shrine", bg: "res://assets/backgrounds/bg_street_night.png", label: "路地裏の神社" },
  dubai_mosque: { scene: "reflect_dubai_mosque", bg: "res://assets/backgrounds/bg_dubai_map_dusk.png", label: "見学できるモスク" },
  dubai_waterside: { scene: "reflect_dubai_waterside", bg: "res://assets/backgrounds/bg_dubai_map_dusk.png", label: "モスクの見える水辺" },
  inn_window: { scene: "reflect_inn_window", bg: "res://assets/backgrounds/bg_ch3_hotel_night.png", label: "宿の窓辺" },
};

/** 灯せる火種があるか（盤が有効な時だけ） */
export const canReflect = (s = state) => !!s && growthEnabled() && hasUsableHidane(ensureGrowth(s), s);

/** 内省の場面 → 盤（灯せる）。戻り値=灯したマス（やめたら空） */
export async function reflectAt(place, { eve = false } = {}) {
  const spot = REFLECT_PLACES[place];
  if (!spot || !canReflect()) return [];
  const owner = state;
  if (eve) await play("reflect_eve", { bg: spot.bg });
  if (state !== owner) return [];
  await play(spot.scene, { bg: spot.bg });
  if (state !== owner) return [];
  const lit = await openGrowthBoard({ place }) || [];
  if (state === owner) save();
  return lit;
}

/**
 * 大会前夜の内省（寝る前の精算のあと）。火種が残っていれば一度だけ強制で開く。
 * 地元は観音堂、遠征先は宿の窓辺（2.8）。
 */
export async function eveReflection(place) {
  if (!canReflect()) return false;
  const key = `_eve_reflect_${state.chapter}`;
  if (state.flags[key]) return false;
  state.flags[key] = true;
  await reflectAt(place, { eve: true });
  return true;
}
