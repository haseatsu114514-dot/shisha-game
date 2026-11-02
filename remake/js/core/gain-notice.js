// 成長通知（ui.js の gainCard）の「見た記録」と表示時間。DOM に触れない純粋関数。

/** 成長通知の「見た記録」キー。2回目以降の短縮は能力の通常加算と好感度の通常加算だけが対象（段上がり・恋人・通知は常にフル）。 */
export function gainSeenKey(o) {
  if (o.kind === "stat" && o.stat && !o.evolution && !o.fx) return `_motion_seen_gain_stat_${o.stat}`;
  if (o.kind === "affinity" && !o.bond && o.sub === "好感度が少し上がった") return "_motion_seen_gain_affinity";
  return null;
}
/** 通知を見せている時間(ms)。shorten は「既読を短く」設定オン＋同種の通知を見た記録がある場合。 */
export function bannerHold(o, shorten = false) {
  if (o.evolution) return 4200;
  if (o.fx) return 3200;
  if (o.hearts && o.hearts.to.join() !== o.hearts.from.join()) return shorten ? 1500 : 2600;
  return shorten ? 1200 : 2200;
}
