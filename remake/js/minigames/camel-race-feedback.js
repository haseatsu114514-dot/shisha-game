// 表示専用。競走・採点・保存には触れず、いまの息と架空の観客席を読みやすくする。
import { PLAYER, WHIP, inSpurt, whipReady, standings } from "./camel-race-model.js";

export const STAMINA_WARNING = 40;
export const SPURT_RESERVE = WHIP.empty + WHIP.spurtDrain * 3;

/** 数字は現在の消費/回復率の目安。未来の声の成功や順位を予言しない。 */
export function camelStaminaReadout(race) {
  const p = race.player, spurt = inSpurt(race);
  const drain = spurt ? WHIP.spurtDrain : WHIP.drain;
  const recovery = PLAYER.staminaRecover * p.rhythm - PLAYER.staminaDrain;
  const seconds = Math.max(0, (p.stamina - WHIP.empty) / drain);
  const locked = !whipReady(race);
  const state = locked ? "spent" : p.stamina < PLAYER.tired ? "tired" : p.stamina <= STAMINA_WARNING ? "low" : "ok";
  const rate = recovery > 0 ? `回復 +${recovery.toFixed(1)}/秒` : "輪に合わせた声で調子を戻そう";
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

const COMMENTS = Object.freeze({
  start: ["金の★ハビーバに一票！ 最後の直線まで見届けるぞ", "ナジュム派だ！ 先行してそのまま頼む！", "追い込みのリーフ推し。まだまだ序盤だ", "サブールに賭けた気持ちで応援！ 安定した足が好き"],
  boost: ["ハビーバ、風を切った！ ここで前へ出るか！", "おっ、金の★が加速！ 息を残せるか？"],
  low: ["ハビーバ、息は大丈夫か？ 最後まで持たせてくれ！", "ここで休ませるのも作戦。声のタイミングが勝負だな"],
  rest: ["一息ついてる。最後のムチに備えてるのか？", "押すだけじゃないんだな。次の伸びを待つぞ"],
  spurt: ["ラストスパート！ リーフ派もハビーバ派も立ち上がった！", "残りわずか！ ここで溜めた息を使うのか！"],
  cruise: ["サブール、ぶれないな。こういう足に一票！", "ナジュム派、まだ諦めてないぞ！", "リーフの追い込みを信じてる！", "順位が動くたびに声が出る。どの子も走りきれ！"],
  finish: ["ゴール！ 推しの順位に一喜一憂、いいレースだった！", "最後まで見入った！ 次は誰を応援しようかな"],
});

/** 同じseedと時刻は同じ文。順位・息・加速に反応。実際の賭けや通貨は持たない。 */
export function camelSpectatorComment(race, phase = "race") {
  const slot = Math.floor(race.t / 14);
  const kind = phase === "goal" || race.finished ? "finish" : race.t < 7 ? "start"
    : inSpurt(race) ? "spurt" : race.player.stamina <= STAMINA_WARNING ? "low"
      : race.player.whipping ? "boost" : race.player.stamina < 80 ? "rest" : "cruise";
  const list = COMMENTS[kind];
  const text = list[((race.seed >>> 0) + slot) % list.length];
  const leader = standings(race)[0];
  return { key: `${kind}-${slot}-${leader.id}`, text: `${leader.name}が先頭！ ${text}` };
}
