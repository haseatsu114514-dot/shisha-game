// 第3章の回復後の試作（#1654）: 出る時期・一度性・講評の分岐を、新旧の東京ルートで確かめる。
import assert from "node:assert/strict";
import fs from "node:fs";
import { newState } from "../js/core/state.js";
import { advanceToChapterThree, chapterThreeScenes, completeChapterThreeScene,
  chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { CH3_TRIALS, CH3_TRIAL_DIALOGUE_IDS, TRIAL_GOOD_SCORE, availableChapterThreeTrials, trialResult,
  recordTrialPractice, finishTrialFeedback, trialFinished, trialFlag, trialFeedbackDialogue } from "../js/chapters/ch3-trial-progress.js";

function departure({ legacy = false } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 1000, stamina: 80 });
  value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
  assert(advanceToChapterThree(value));
  if (legacy) delete value.flags._ch3_intro.routeVersion;
  return value;
}
const ids = value => availableChapterThreeTrials(value).map(trial => trial.id);

function walk(value, visit) {
  for (const scene of chapterThreeScenes(value)) {
    for (let window; (window = chapterThreeFreeTime(value));) assert(completeChapterThreeFreeTime(value, window.id));
    visit(scene);
    assert(completeChapterThreeScene(value, scene.id));
  }
}

for (const legacy of [false, true]) {
  const value = departure({ legacy });
  const scenes = chapterThreeScenes(value).map(scene => scene.id);
  const recovery = scenes.indexOf("ch3_abyss_recovery");
  const seen = [];
  walk(value, scene => {
    const before = structuredClone(value);
    const now = ids(value);
    assert.deepEqual(value, before, "Reading trial availability mutated the save");
    const index = scenes.indexOf(scene.id);
    // 回復前（休養中）は試作を出さない。
    if (index <= recovery) assert.deepEqual(now, [], `${scene.id}: trial before recovery`);
    if (index <= scenes.indexOf("ch3_kuze_advice")) assert(!now.includes("kuze"), `${scene.id}: kuze trial too early`);
    else assert(now.includes("kuze"), `${scene.id}: kuze trial missing`);
    if (index <= scenes.indexOf("ch3_steve_low_heat")) assert(!now.includes("steve"), `${scene.id}: steve trial too early`);
    else assert(now.includes("steve"), `${scene.id}: steve trial missing`);
    seen.push(...now);
  });
  assert(seen.includes("kuze") && seen.includes("steve"), "Both trials must be reachable before the tournament");
  // 全場面を読み終えた大会の朝・大会後には出さない。
  assert.deepEqual(ids(value), []);
  value.flags._ch3_tournament = { stage: "complete" };
  value.flags._ch3_aftermath = true;
  assert.deepEqual(ids(value), []);
}

// 一度性: 制作の確定は一度だけ。講評を読み終えると消え、途中なら同じ試作の講評から再開できる。
{
  const value = departure();
  const scenes = chapterThreeScenes(value);
  walk(value, () => {});
  value.flags._ch3_intro.stage = scenes.findIndex(scene => scene.id === "ch3_volk_first");
  assert.deepEqual(ids(value), ["kuze", "steve"]);
  assert.equal(recordTrialPractice(value, "kuze", "bogus"), false);
  assert.equal(recordTrialPractice(value, "nobody", "good"), false);
  assert(recordTrialPractice(value, "kuze", "rough"));
  const once = structuredClone(value);
  assert.equal(recordTrialPractice(value, "kuze", "good"), false, "A finished build was replaced");
  assert.deepEqual(value, once);
  assert.deepEqual(ids(value), ["kuze", "steve"], "Unread feedback must stay reachable");
  assert(finishTrialFeedback(value, "kuze"));
  assert.equal(finishTrialFeedback(value, "kuze"), false);
  assert(trialFinished(value, "kuze"));
  assert.deepEqual(ids(value), ["steve"]);
  assert.equal(finishTrialFeedback(value, "steve"), false, "Feedback before building");
  // 壊れた古い値は未着手として扱う。
  value.flags[trialFlag("steve")] = "done";
  assert.deepEqual(ids(value), ["steve"]);
  assert(recordTrialPractice(value, "steve", "good"));
  assert.equal(value.flags[trialFlag("steve")].result, "good");
}

// 講評の分岐。通し制作は穴・熱・仕上がり、調整は2回の点数で、第1章と同じ境界を使う。
{
  const [full, care] = CH3_TRIALS;
  assert.equal(full.scope, "full"); assert.equal(care.scope, "care");
  assert.equal(trialResult(full, null), "failed");
  assert.equal(trialResult(full, { failed: true, holes: { score: 99 } }), "failed");
  assert.equal(trialResult(full, { holes: { score: TRIAL_GOOD_SCORE }, heat: { score: TRIAL_GOOD_SCORE } }, TRIAL_GOOD_SCORE), "good");
  assert.equal(trialResult(full, { holes: { score: 60 }, heat: { score: 70 } }, 70), "rough");
  assert.equal(trialResult(care, { careHistory: [{ score: 80 }, { score: 60 }] }), "good");
  assert.equal(trialResult(care, { careHistory: [{ score: 50 }, { score: 60 }] }), "rough");
  assert.equal(trialResult(care, { failed: true, careHistory: [{ score: 90 }] }), "failed");
}

// 台本: 必要な4場面がそろい、講評は3つの結果すべてに分岐を持つ。報酬・好感度・面識の制御行を置かない。
{
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_trials.json", import.meta.url)));
  const byId = Object.fromEntries(data.dialogues.map(dialogue => [dialogue.dialogue_id, dialogue]));
  assert.deepEqual(Object.keys(byId).sort(), [...CH3_TRIAL_DIALOGUE_IDS].sort());
  for (const trial of CH3_TRIALS) {
    const end = byId[trial.end];
    assert.deepEqual(Object.keys(end.branches).sort(), ["failed", "good", "rough"]);
    for (const dialogue of [byId[trial.intro], end]) {
      const lines = [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
      assert(lines.every(line => !line.type && ["", "hajime", "mashiro", "customer"].includes(line.speaker)),
        `${dialogue.dialogue_id}: a trial must not pre-apply rewards or meet anyone`);
    }
    for (const result of ["good", "rough", "failed"]) {
      const merged = trialFeedbackDialogue(end, result);
      assert.deepEqual(merged.lines, [...end.branches[result], ...end.lines]);
      assert.deepEqual(merged.branches, {});
    }
  }
}

// 新しい保存フラグは引き継ぎ表に分類されている。
{
  const { classifyFlag } = await import("../js/core/carry.js");
  for (const trial of CH3_TRIALS) assert.equal(classifyFlag(trialFlag(trial.id)), "progression");
}

console.log("ch3 trials: ok");
