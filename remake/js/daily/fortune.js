// 路上占い師（旧版 F11 / J2-J3）。2026-11-02 オーナー指定（台帳 URA）で出方を作り替えた:
// 章ごとに1〜2回、予定と重ならない昼か夜に、街のどこかへふらっと現れる（判定は fortune-schedule.js）。
// 第1章だけ、つむぎの噂を聞いた後。第5章は東京にも現れる（理由は語らない）。ドバイには出ない。
// 深いローブの老婆のタロット占い。相性占い3,000円・時間は使わない・現れた1回につき1度。
// 指名した相手と「次に会ったとき」だけ好感度の伸びが2倍（一度きり。stats.js の gainAffinity で消費）
import { DB, displayName } from "../core/data.js";
import { state, markMet, save } from "../core/state.js";
import { addMoney } from "../core/stats.js";
import { play } from "../vn/engine.js";
import { bgRef } from "./spots.js";
import { fortuneHere, fortuneIndexHere, markFortuneUsed } from "./fortune-schedule.js";
import { grantFortuneReading, fortuneResultId, fortuneTargets, isFortuneTargetAvailable } from "../core/fortune-effects.js";

export const FORTUNE_FEE = 3000;
const BG = "bg_street";

export { FORTUNE_RUMOR_ID, fortuneRumorHeard } from "./fortune-schedule.js";
/** 今の時間帯に、どこかに現れているか（名前は旧版のまま。日単位ではない）。 */
export const fortuneToday = () => !!state && fortuneHere(state);

/** 占い師に寄る（時間は使わない）。戻り値=占ってもらったか */
export async function doFortune() {
  if (!fortuneToday()) return false;
  const bg = bgRef(BG);
  const first = !state.flags._fortune_met;
  const inTokyo = state.flags._fortune_wander?.shown?.[fortuneIndexHere(state)]?.where === "tokyo";
  state.flags._fortune_met = true;
  markMet("uranaishi");
  // 東京で会ったときは、なぜいるのかを詳しく言わない（ch5_tokyo.json）。初めて会う場合は通常の初対面。
  await play(first ? "remake_fortune_first" : inTokyo && DB.dialogues.ch5_tokyo_fortune ? "ch5_tokyo_fortune" : "remake_fortune_again", { bg });
  if (state.money < FORTUNE_FEE) {
    await play("remake_fortune_broke", { bg });
    return false;
  }
  delete state.flags._fortune_go;
  await play("remake_fortune_offer", { bg });
  if (!state.flags._fortune_go) return false;
  delete state.flags._fortune_go;

  // 占える相手 = 知り合って好感度のある相手（第2章でなると決裂した後は除外）
  const targets = fortuneTargets(state, DB.characters);
  if (!targets.length) {
    await play("remake_fortune_no_target", { bg });
    return false;
  }
  const ask = DB.dialogues.remake_fortune_pick;
  await play({
    dialogue_id: "remake_fortune_pick_live",
    lines: [...(ask?.lines || []), { type: "choice", id: "fortune_pick", choices: targets.map((id) => ({ text: displayName(id, state), next: `t_${id}` })) }],
    branches: Object.fromEntries(targets.map((id) => [`t_${id}`, [{ type: "set_flag", flag: `_fortune_pick_${id}` }]])),
  }, { bg });
  const picked = targets.find((id) => state.flags[`_fortune_pick_${id}`]);
  for (const id of targets) delete state.flags[`_fortune_pick_${id}`];
  if (!picked || !isFortuneTargetAvailable(state, picked)) return false;
  addMoney(-FORTUNE_FEE);
  const trivia = grantFortuneReading(state, picked, DB.fortuneTrivia);
  state.fortuneDay = state.day; // 旧版の記録（互換のため残す）
  markFortuneUsed(state); // この出現はおしまい。次に会うのは次の予定
  save();
  await play(trivia ? fortuneResultId(trivia) : "remake_fortune_result", { bg }); // {fortuneName} は interpolate で相手の名前になる
  return true;
}
