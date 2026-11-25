// 好みの判定（#3909 第1段）。好みの帯と、提供した一台の仕上がり（甘い印象・清涼感）を照らす。
// 採点・票・保存には使わない（講評と台詞の出し分けだけ）。
// 煙の量のゲージ（葉の smoke_body）は、完成品の「煙」（穴・炭・蒸らしから出る）と別の値なので使わない。
import { mixExpression } from "./flavor-profile.js";

export const PREFERENCE_AXES = Object.freeze(["sweetness", "cooling"]);
/** 帯の端からこの幅までは「ほぼ合う」。1gの差で判定が大きく変わらないようにする。 */
export const NEAR_MARGIN = 0.5;
/** 甘めの狙い（第3章の作戦「甘い余韻」・第4章の作戦「桃」）。甘い印象4.5以上。上限は置かない。 */
export const SWEET_AIM = Object.freeze({ sweetness: Object.freeze([4.5, null]) });

// 画面の棒の数値（flavor-guide.js の format）と同じく0.1で丸めてから比べる。見えている値と判定をずらさない。
const shown = value => Math.round(value * 10) / 10;
const hasMix = cs => Object.values(cs?.mix || {}).some(g => Number.isFinite(g) && g > 0);

/**
 * 提供した一台が好みの帯に入ったか。preference は { sweetness: [下限, 上限], cooling: [下限, 上限] }（null は制限なし）。
 * 戻り値 null: 記録が無い（未提供・吸い出しの失敗・葉が焦げた等で一台が崩れた・配合なし・温度の無い旧セーブ）。
 * fit "outside": 適温帯の外で出した。香りが弱まり甘さも清涼感も下がるので、好みは判定しない
 *   （「甘さ控えめ」の好みで、温度を外すほど合う、を起こさない）。
 * fit "match"／"near"（外れが NEAR_MARGIN 以内）／"off"。misses は外れた軸と向き（low＝足りない／high＝強すぎ）。
 */
export function preferenceFit(cs, preference, { catalog } = {}) {
  const temp = cs?.pull?.temp;
  if (!cs?.pullDone || cs.pull?.failed || cs.failed || !Number.isFinite(temp) || !hasMix(cs)) return null;
  const expression = mixExpression(cs, temp, { catalog });
  const values = Object.fromEntries(PREFERENCE_AXES.map(axis => [axis, shown(expression.values[axis])]));
  if (expression.zone === "cold" || expression.zone === "hot") return { fit: "outside", zone: expression.zone, values, misses: [] };
  const misses = [];
  for (const axis of PREFERENCE_AXES) {
    const [low = null, high = null] = preference?.[axis] || [];
    const value = values[axis];
    if (Number.isFinite(low) && value < low) misses.push({ axis, side: "low", by: shown(low - value) });
    else if (Number.isFinite(high) && value > high) misses.push({ axis, side: "high", by: shown(value - high) });
  }
  const worst = misses.reduce((max, miss) => Math.max(max, miss.by), 0);
  const fit = !misses.length ? "match" : worst <= NEAR_MARGIN ? "near" : "off";
  return { fit, zone: expression.zone, values, misses };
}
