// 表示専用。競走・採点・保存には触れず、いまの息を読みやすくする。
import { PLAYER, WHIP, GRADES, inSpurt, whipReady, whipDrain, staminaRecovery, camelCupQualified, camelMastered, camelExpert } from "./camel-race-model.js";

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

/**
 * 結果のカードの「次の目標」（2026-11-13・CRF10。表示専用。採点・認定の条件は camel-race-model.js のまま）。
 * grade: 次の評価までの点。tip: 今回いちばん点を落とした所の直し方を1つだけ（満点なら null）。
 * cup: 大会の条件のうち、今回届いたもの・届かなかったもの（もう達成済み・今回達成・条件の無い練習は null）。
 */
export function camelNextGoal(run, { mastered = false } = {}) {
  const { parts, stats } = run;
  const higher = GRADES.filter(([, min]) => min > run.total).at(-1);
  const grade = higher ? `次の評価 ${higher[0]} まで あと ${higher[1] - run.total}点` : "評価 S ── いちばん上の評価";
  // 声とスタミナのうち、落とした割合の大きい方を直す。どちらもほぼ満点（落とした割合が 12% 未満）で順位だけ届かなかった時は、位置取りの話をする
  // （順位は声とムチの結果なので、点数の大きさだけで選ぶといつも順位の話になる）。
  const voice = (35 - parts.timing) / 35, stamina = (25 - parts.stamina) / 25;
  const topic = Math.max(voice, stamina) >= 0.12 || parts.rank >= 40 ? (voice >= stamina ? "voice" : "stamina") : "rank";
  let tip = null;
  if (topic === "rank" || Math.max(voice, stamina) > 0) {
    if (topic === "voice") {
      tip = stats.spam > 0 ? `連打をやめる（今回 ${stats.spam}回）`
        : stats.miss > 0 && stats.miss * 2 >= (35 - parts.timing) / 2 ? `輪の無い時は声をかけない（今回 ${stats.miss}回・1回 −2点）`
        : stats.lost > 0 ? `輪を見送らない（今回 ${stats.lost}回）`
        : `GOOD を PERFECT に（今回 GOOD ${stats.good}回）`;
    } else if (topic === "stamina") {
      // 採点の3つの内訳（スパートのムチ 8・息が無いのに押していない 9・残りの息 8）のうち、いちばん落とした所。
      const pressed = stats.whipTime + stats.emptyWhip;
      const drops = [
        [8 * (1 - Math.min(1, stats.spurtWhip / 3)), `LAST SPURT でムチを3秒以上（今回 ${stats.spurtWhip}秒）`],
        [pressed > 0 ? 9 * stats.emptyWhip / pressed : 0, `息が切れたらムチを離す（今回 ${stats.emptyWhip}秒 押したまま）`],
        [Math.min(8, Math.max(0, (stats.staminaLeft - 30) / 7)), `息を使い切ってゴールする（今回 残り${stats.staminaLeft}）`],
      ].sort((a, b) => b[0] - a[0]);
      tip = drops[0][0] > 0 ? drops[0][1] : "ムチは息のあるうちに離す";
    } else {
      tip = stats.duels > stats.duelsWon ? "競り合いは、声を当てるかムチで抜き切る" : "前のラクダの後ろで息を貯めて、最後に差す";
    }
    tip = `伸びる所：${tip}`;
  }
  let cup = null;
  if (!mastered) {
    if (run.cup === "rookie" && !camelCupQualified(run)) cup = { label: "標準大会まで", items: [{ text: "3位以内", ok: false }] };
    else if (run.cup === "standard" && !camelMastered(run)) cup = { label: "中級認定まで", items: [
      { text: "3位以内", ok: run.rank <= 3 }, { text: `声かけ ${parts.timing}／20点`, ok: parts.timing >= 20 },
      { text: `スタミナ ${parts.stamina}／20点`, ok: parts.stamina >= 20 }, { text: `連打 ${stats.spam}回（1回まで）`, ok: stats.spam <= 1 }] };
    else if (run.cup === "expert" && !camelExpert(run)) cup = { label: "称号まで", items: [
      { text: "1位", ok: run.rank === 1 }, { text: `S評価（${run.total}／85点）`, ok: run.total >= 85 }, { text: "連打なし", ok: stats.spam === 0 }] };
  }
  return { grade, tip, cup };
}
