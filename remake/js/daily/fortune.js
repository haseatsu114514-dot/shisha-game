// 路上占い師（旧版 F11 / J2-J3）。週2日（7日周期の3・6日目）だけアーケード脇に出る。
// 深いローブの老婆のタロット占い。相性占い3,000円・1日1回・時間は使わない。
// 指名した相手と「次に会ったとき」だけ好感度の伸びが1.5倍（一度きり。stats.js の gainAffinity で消費）
import { DB, displayName } from "../core/data.js";
import { state, markMet, save } from "../core/state.js";
import { addMoney } from "../core/stats.js";
import { play } from "../vn/engine.js";
import { bgRef } from "./spots.js";

export const FORTUNE_FEE = 3000;
const BG = "bg_street";

export const fortuneToday = () => !!state && state.chapter === 1 && (state.day % 7 === 3 || state.day % 7 === 6);

/** 占い師の出店に寄る（時間は使わない）。戻り値=占ってもらったか */
export async function doFortune() {
  const bg = bgRef(BG);
  const first = !state.flags._fortune_met;
  state.flags._fortune_met = true;
  markMet("uranaishi");
  await play(first ? "remake_fortune_first" : "remake_fortune_again", { bg });
  if (state.money < FORTUNE_FEE) {
    await play("remake_fortune_broke", { bg });
    return false;
  }
  delete state.flags._fortune_go;
  await play("remake_fortune_offer", { bg });
  if (!state.flags._fortune_go) return false;
  delete state.flags._fortune_go;

  // 占える相手 = 知り合って好感度のある相手
  const targets = Object.keys(state.affinity || {}).filter((id) => state.met[id] && DB.characters[id]);
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
  if (!picked) return false;
  addMoney(-FORTUNE_FEE);
  state.fortune = { char: picked };
  state.fortuneDay = state.day;
  save();
  await play("remake_fortune_result", { bg }); // {fortuneName} は interpolate で相手の名前になる
  return true;
}
