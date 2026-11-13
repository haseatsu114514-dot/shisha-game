import { save } from "../core/state.js";
import { awardTournamentExp } from "../core/growth.js";
import { computeShisha } from "../craft/score.js";
import * as broadcast from "../craft/broadcast.js";

// 工程が完了した後だけ呼ぶ。章別の投票・結果確定は onMilestone に残す。
// 香り→工程確定→敗北判定→配信消去→章別処理→保存の順を両章で固定する。
export function advanceTournamentCraft({ state, progress, craft, finishStep, milestones, onMilestone }) {
  if (progress.step === 8 && !craft.failed) {
    craft.tournamentStory ||= { seen: [] };
    craft.tournamentStory.servedAroma = computeShisha(craft).aroma;
  }
  finishStep(state, craft);
  if (craft.failed) {
    awardTournamentExp(4, craft);
    save();
    return false;
  }
  if (milestones.has(progress.step)) {
    broadcast.clearComments();
    onMilestone(milestones.get(progress.step));
  }
  save();
  return true;
}
