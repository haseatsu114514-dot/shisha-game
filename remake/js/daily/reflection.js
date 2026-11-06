// 内省（SPEC 第2版 2.8）: 参拝の場所で静かに振り返ると、学んだことが火になる。盤で火種を灯せるのはこの時だけ。
// 時間を使わない（行動の回数も体力も減らない）。大会前夜に火種が残っていれば、強制の場面で盤を開く。
import { state, save } from "../core/state.js";
import { play } from "../vn/engine.js";
import { growthEnabled, growthView, openGrowthBoard } from "../core/growth.js";
import { hasUsableHidane } from "../core/growth-board.js";
import { starterPending } from "./growth-board-tutorial.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "./spot-hours.js";

/** 場所ごとの場面と背景。新設の弁天堂・モスクの背景は画像が届くまで近い背景で代える */
export const REFLECT_PLACES = {
  kannon: { scene: "reflect_kannon", bg: "res://assets/backgrounds/bg_kannon_night.png", label: "観音堂" },
  // 東京は公園の池に浮かぶ弁天堂（IR26・SBD98）。背景は bg_tokyo_benten_*（tools/bg_prompts.txt PK03・PK04）が届くまで
  // 同じ公園の池の絵（昼夜で切り替わる）で代える。id の tokyo_shrine は仮置きの「路地裏の神社」の時のまま（互換）
  tokyo_shrine: { scene: "reflect_tokyo_shrine", bg: "bg_tokyo_park", label: "池の弁天堂" },
  dubai_mosque: { scene: "reflect_dubai_mosque", bg: "res://assets/backgrounds/bg_dubai_map_dusk.png", label: "見学できるモスク", ...MOSQUE_VISITING_HOURS },
  dubai_waterside: { scene: "reflect_dubai_waterside", bg: "res://assets/backgrounds/bg_dubai_map_dusk.png", label: "モスクの見える水辺" },
  inn_window: { scene: "reflect_inn_window", bg: "res://assets/backgrounds/bg_ch3_hotel_night.png", label: "宿の窓辺" },
};

/** 灯せる火種があるか（盤が有効な時だけ） */
export const canReflect = (s = state) => !!s && growthEnabled() && hasUsableHidane(growthView(s), s); // 地図を描くだけで成長データを作らない
/** その場所で振り返れるか。観音堂だけは、最初の火種をまだ渡していなければ火種が0でも開ける（はじめての案内・growth-board-tutorial.js） */
export const canReflectAt = (place, s = state) => canReflect(s) || (place === "kannon" && !!s && growthEnabled() && starterPending(s));

/**
 * 大会前夜の内省の導入。地元の観音堂へは帰宅（または前夜の早寝）のあとに出かけ直すので、その流れに合わせる（#2775）。
 * 宿の窓辺や遠征先は従来の導入のまま。
 */
function eveOpening(place) {
  if (place !== "kannon") return "reflect_eve";
  return state.flags._eve_slept === state.day ? "reflect_eve_slept" : "reflect_eve_home";
}

/** 内省の場面 → 盤（灯せる）。戻り値=灯したマス（やめたら空） */
export async function reflectAt(place, { eve = false } = {}) {
  const spot = REFLECT_PLACES[place];
  if (!spot || !canReflectAt(place) || !openingStatus(spot, state).ok) return [];
  const owner = state;
  if (eve) await play(eveOpening(place), { bg: spot.bg });
  if (state !== owner) return [];
  await play(spot.scene, { bg: spot.bg });
  if (state !== owner || !canReflectAt(place) || !openingStatus(spot, state).ok) return [];
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
