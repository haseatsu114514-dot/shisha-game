// 表示専用。競走・採点・保存には触れず、いまの息を読みやすくする。
import { PLAYER, WHIP, inSpurt, whipReady, whipDrain, staminaRecovery } from "./camel-race-model.js";

export const STAMINA_WARNING = 40;
export const SPURT_RESERVE = WHIP.empty + WHIP.spurtDrain * 3;

/** 数字は現在の消費/回復率の目安。未来の声の成功や順位を予言しない。 */
export function camelStaminaReadout(race) {
  const p = race.player, spurt = inSpurt(race);
  // 風よけの中は消費が軽く、回復が多い（モデルと同じ式を使う）。
  const drain = whipDrain(race);
  const recovery = staminaRecovery(race);
  const seconds = Math.max(0, (p.stamina - WHIP.empty) / drain);
  const locked = !whipReady(race);
  const state = locked ? "spent" : p.stamina < PLAYER.tired ? "tired" : p.stamina <= STAMINA_WARNING ? "low" : "ok";
  const rate = recovery > 0 ? `${p.drafting && !locked ? "風よけ · " : ""}回復 +${recovery.toFixed(1)}/秒` : "輪に合わせた声で調子を戻そう";
  let message;
  if (locked) message = `ムチ停止 · 再使用まで ${Math.max(0, Math.ceil(WHIP.resume - p.stamina))} · ${rate}`;
  else if (state === "tired") message = `⚠ 速度低下 · ムチを離して声で整える`;
  else if (state === "low") message = `⚠ 息が残り少ない · 30未満で速度低下`;
  else if (p.whipping) message = `加速中 · ムチあと約${seconds.toFixed(1)}秒`;
  else if (spurt) message = `LAST SPURT · ムチの効きが大きい`;
  else message = rate;
  return { state, message, recovery, seconds, reserve: !spurt && p.stamina >= SPURT_RESERVE,
    reserveText: spurt ? "終盤は +5m/s" : `終盤3秒ぶんの目安 ${SPURT_RESERVE} / 100`,
    accelerating: p.whipping && !locked };
}
