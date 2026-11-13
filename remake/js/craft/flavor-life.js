// TH77〜82: 赤い葉5枚。使用中の1枚だけが赤→茶→黒→消えると進む。
// hp は次に使える赤い葉の残数。最後の赤が茶色になったら、その一台は失敗。
import { growthPerks, growthSkill, SKILL_TUNING } from "../core/growth-effects.js";
import { state } from "../core/state.js";
import { DB } from "../core/data.js";
import { steamSecondsOf } from "./steam-time.js";

export const LEAF_MAX = 5;
// 赤5枚を赤→茶→黒→消で使い切るまでの焦げ段階の総数。最後の赤が茶になった時点で失敗する。
export const LEAF_FAIL_STEPS = LEAF_MAX * 3 - 2; // 13

// #1106: 葉ダメージの蓄積で難しくするための係数は、全部ここ1か所に集める。
// 数値はすべて仮で、オーナーが実プレイで調整する前提。既定（mix_life 未設定・8分以下の蒸らし）は現状の難しさと同じ。
export const LEAF_DAMAGE = Object.freeze({
  mixLifeDefault: 1,     // mix_life 未設定フレーバーの体力。1.0=現状＝過吸い1回で葉が1段階傷む。
  perOverPull: 1,        // 体力1.0・通常蒸らしでの過吸い1回あたりの基準ダメージ（段階数）。
  bandNarrow: 0.3,       // 満身創痍（ratio=1）で適温帯が縮む最大割合。0.3=最大30%細くなる。
  stopDrift: 0.045,      // 満身創痍での針停止位置の最大ズレ幅（ダイヤル一周=1）。
  longSteamFrom: 480,    // ここ（8分）までは長時間蒸らしのダメージ増がない。
  longSteamTo: 600,      // 10分で蒸らしダメージ倍率が最大。
  longSteamMult: 1.5,    // 10分蒸らしでの過吸いダメージ倍率。
});

export function ensureFlavorLife(cs) {
  cs.leaf ??= { hp: LEAF_MAX, max: LEAF_MAX, burn: 0 };
  cs.leaf.max = LEAF_MAX;
  cs.leaf.burn ??= 0;
  cs.leaf.dmg ??= 0;   // 連続ダメージの累積（段階換算）。帯の縮み・停止ズレの強さに使う。
  cs.leaf.steps ??= 0; // これまでに進めた焦げ段階の数。dmg の整数部まで進める。
  return cs.leaf;
}

export function burnFlavorLeaf(leaf) {
  if (leaf.hp <= 0) return;
  if (!leaf.burn) {
    leaf.hp--;
    leaf.burn = 1;
  } else {
    leaf.burn = (leaf.burn + 1) % 3;
  }
}

/**
 * 連続ダメージを溜め、1.0ごとに1段階ずつ葉を焦がす。
 * amount=1（既定）は過吸い1回=1段階で、従来の burnFlavorLeaf 1回と同じ挙動になる。
 */
export function applyLeafDamage(leaf, amount = 1) {
  if (!leaf || leaf.hp <= 0) return;
  if (!Number.isFinite(leaf.dmg)) leaf.dmg = 0;
  if (!Number.isFinite(leaf.steps)) leaf.steps = 0;
  leaf.dmg += Math.max(0, Number.isFinite(amount) ? amount : 0);
  const target = Math.floor(leaf.dmg);
  while (leaf.steps < target && leaf.hp > 0) { burnFlavorLeaf(leaf); leaf.steps++; }
}

/** 0〜1。葉がどれだけ傷んだか。ダメージが少ないうちは0付近で、増えるほど1へ近づく。 */
export function leafDamageRatio(leaf) {
  const dmg = Number.isFinite(leaf?.dmg) ? leaf.dmg : 0;
  return Math.max(0, Math.min(1, dmg / LEAF_FAIL_STEPS));
}

/** 配合のグラム比で合成した体力（mix_life）。未設定の葉は既定1.0。高いほど傷みにくい。 */
export function flavorMixLife(cs, flavorById = DB.flavorById) {
  const entries = Object.entries(cs?.mix ?? {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  if (!entries.length) return LEAF_DAMAGE.mixLifeDefault;
  let total = 0, weighted = 0;
  for (const [id, g] of entries) {
    const value = flavorById?.[id]?.mix_life;
    const life = Number.isFinite(value) && value > 0 ? value : LEAF_DAMAGE.mixLifeDefault;
    total += g;
    weighted += g * life;
  }
  return total > 0 ? weighted / total : LEAF_DAMAGE.mixLifeDefault;
}

/** 9〜10分の長い蒸らしは過吸いダメージを少し増やす。8分以下は1.0（現状）。 */
export function steamDamageMult(cs) {
  const seconds = steamSecondsOf(cs);
  const { longSteamFrom: from, longSteamTo: to, longSteamMult: mult } = LEAF_DAMAGE;
  if (seconds <= from) return 1;
  if (seconds >= to) return mult;
  return 1 + (mult - 1) * (seconds - from) / (to - from);
}

/** 過吸い1回あたりのダメージ量。体力が高い配合ほど小さく、長い蒸らしほど大きい。 */
export function leafDamagePerPull(cs, flavorById = DB.flavorById) {
  const life = flavorMixLife(cs, flavorById) || LEAF_DAMAGE.mixLifeDefault;
  return LEAF_DAMAGE.perOverPull / life * steamDamageMult(cs) * (1 - (growthPerks(state)?.leaf || 0) / 100)
    * (growthSkill(state, "K17") ? 1 - SKILL_TUNING.leaf : 1);
}

/** 止めた針位置の小さなズレ。roll は [-1,1]。ダメージが少ないうちはほぼ0で、増えるほど少しずつ広がる。 */
export function leafStopDrift(ratio, roll) {
  const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
  const k = Number.isFinite(roll) ? Math.max(-1, Math.min(1, roll)) : 0;
  return LEAF_DAMAGE.stopDrift * r * k;
}

export function flavorLeafStages(leaf) {
  const hp = leaf?.hp ?? LEAF_MAX, burn = leaf?.burn ?? 0;
  const gone = LEAF_MAX - hp - (burn ? 1 : 0);
  return Array.from({ length: LEAF_MAX }, (_, i) =>
    i < gone ? "gone" : i === gone && burn ? (burn === 1 ? "brown" : "black") : "red");
}
