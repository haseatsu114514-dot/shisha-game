// 第2章の苺の試作（#1650）。DAY9試煙会の試供品で、tonariのまかない練習を一度だけ苺の一台にする。
// 確かめるのは熱だけ。はじめの舌は不調なので、結果はスミさんに吸ってもらって返す。
import { state, save } from "../core/state.js";
import { play } from "../vn/engine.js";
import { addFlavorStock, flavorStock } from "../daily/shop.js";
import { flavorFamilyGrams } from "../craft/score.js";
import { STRAWBERRY_TRIAL_IDS, strawberryTrialReady } from "./ch2-story-data.js";
export { STRAWBERRY_TRIAL_IDS, strawberryTrialReady };

export const STRAWBERRY_SAMPLE = { flavor: "afsahr_strawberry", grams: 12 };

/** 試供品は一度だけ渡す。DAY9を読み終えた旧セーブは、試作を始める時に渡す。 */
export function grantStrawberrySample(owner = state) {
  if (owner.flags._ch2_strawberry_sample_given) return false;
  addFlavorStock(STRAWBERRY_SAMPLE.flavor, STRAWBERRY_SAMPLE.grams);
  owner.flags._ch2_strawberry_sample_given = true;
  return true;
}

/** 熱の一点で読む。焦げ・熱すぎは hot、冷え・届かずは thin。苺が入っていなければやり直し。 */
export function strawberryTrialResult(cs) {
  if (flavorFamilyGrams(cs.mix, "strawberry") <= 0) return "no_berry";
  if (cs.burnt || cs.pull?.over) return "hot";
  if (cs.pull?.under || cs.failed) return "thin";
  return "gentle";
}

export async function runStrawberryTrial({ bg, isCurrent = null } = {}) {
  const owner = state;
  const { runFullPractice } = await import("../craft/practice.js");
  grantStrawberrySample(owner);
  // 試作の前に別の練習で使い切っていても、一台分は残す（第1章のレモンと同じ扱い）。
  const { flavor, grams } = STRAWBERRY_SAMPLE;
  if (flavorStock(flavor) < grams) addFlavorStock(flavor, grams - flavorStock(flavor));
  save();
  await play("ch2_strawberry_trial_intro", { bg });
  const cs = await runFullPractice({ kind: "self", staffPractice: true, isCurrent: () => state === owner && (!isCurrent || isCurrent()) });
  const result = strawberryTrialResult(cs);
  await play(`ch2_strawberry_trial_${result}`, { bg });
  if (state !== owner) return result;
  // 苺を入れ忘れた時は、次のまかないでもう一度試せる。
  if (result !== "no_berry") owner.flags._ch2_strawberry_trial = result;
  save();
  return result;
}
