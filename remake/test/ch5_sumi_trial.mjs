// #2020 F: 第5章の決戦前の実制作練習。閉店後の試作の会話（#1666）を終えた夜の tonari で、任意で一度だけ
// ダブルアップルを提供まで作り、スミさんが吸って一点を返す。講評は勝負の二台目の前に一行で返る。
// node remake/test/ch5_sumi_trial.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";
import {
  SUMI_TRIAL_FLAG, SUMI_TRIAL_STEPS, SUMI_TRIAL_GREAT, SUMI_TRIAL_RESULTS, SUMI_TRIAL_INTRO, SUMI_TRIAL_IDS, SUMI_TRIAL_STAMINA,
  sumiTrialScene, sumiTrialRecallScene, sumiTrialOpen, sumiTrialOffered, declineSumiTrialTonight, sumiTrialFeedbackPending,
  sumiTrialResult, recordSumiTrial, finishSumiTrialFeedback, sumiTrialRecall,
} from "../js/chapters/ch5-sumi-trial.js";
import {
  CH5_SCENE_FILES, CH5_SCENE_BG, CH5_MATCH_SCENES, CH5_PROLOGUE, advanceToChapterFive, completeChapterFiveScene,
  recordChapterFivePrepTrial, recordChapterFivePrepAdjustment, chapterFivePrepEcho, chapterFiveProgress,
  recordChapterFiveScheduleDecision, beginChapterFiveMatch,
} from "../js/chapters/ch5-progress.js";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

function freeSave() {
  const value = newState();
  Object.assign(value, { chapter: 4, phase: "cleared", day: 60, slot: 1 });
  value.flags = { _ch4_cleared: true };
  assert.equal(advanceToChapterFive(value), true);
  for (const scene of CH5_PROLOGUE) assert.equal(completeChapterFiveScene(value, scene.id), true, scene.id);
  value.phase = "daily";
  value.slot = 1;
  return value;
}
function preparedSave(adjusted = true) {
  const value = freeSave();
  assert.equal(completeChapterFiveScene(value, "ch5_free_tonari_practice"), true);
  assert.equal(recordChapterFivePrepTrial(value, "heat"), true);
  assert.equal(recordChapterFivePrepAdjustment(value, adjusted), true);
  return value;
}
const unchanged = (value, op) => {
  const prior = structuredClone(value);
  assert.equal(op(value), false);
  assert.deepEqual(value, prior, "A rejected operation must not change the state");
};

// 1. いつ出るか: 試作の会話を終えた第5章の自由行動の夜だけ。毎日のノルマではなく、断れば今夜はいつもの tonari
{
  const free = freeSave();
  assert.equal(sumiTrialOpen(free), false, "閉店後の練習の前は出ない");
  assert.equal(completeChapterFiveScene(free, "ch5_free_tonari_practice"), true);
  assert.equal(sumiTrialOpen(free), false, "試作の会話の途中は、まず会話の続き");
  assert.equal(recordChapterFivePrepTrial(free, "pack"), true);
  assert.equal(sumiTrialOpen(free), false, "直すか覚えるかを選ぶまでは出ない");
  assert.equal(recordChapterFivePrepAdjustment(free, false), true);
  assert.equal(sumiTrialOpen(free), true, "そのまま覚えた人も作れる");
  free.slot = 0;
  assert.equal(sumiTrialOffered(free), false, "昼は出さない（閉店後の作業台）");
  free.slot = 1;
  assert.equal(sumiTrialOffered(free), true);
  assert.equal(declineSumiTrialTonight(free), true);
  assert.equal(sumiTrialOffered(free), false, "断った夜はもう聞かない");
  assert.equal(sumiTrialOpen(free), true, "断っても権利は残る");
  free.day += 1;
  assert.equal(sumiTrialOffered(free), true, "次の夜にまた選べる");
  chapterFiveProgress(free); // 試作の印は _ch5 の外にあり、章の保存の検証を変えない
}
{
  const chapterFour = preparedSave();
  chapterFour.chapter = 4;
  assert.equal(sumiTrialOpen(chapterFour), false, "第5章だけ");
  const scheduled = preparedSave();
  assert.equal(completeChapterFiveScene(scheduled, "ch5_unrecorded_day"), true);
  assert.equal(recordChapterFiveScheduleDecision(scheduled, "decide"), true);
  assert.equal(completeChapterFiveScene(scheduled, "ch5_schedule_contact"), true);
  assert.equal(sumiTrialOpen(scheduled), false, "日程を決めた後は出さない（勝負を遅らせない）");
  unchanged(scheduled, v => recordSumiTrial(v, "heat"));
}

// 2. スミさんが返す一点: 提供できなければ失敗、点の付いた工程のいちばん低いもの、全部よければ great
const cup = (scores, extra = {}) => ({ pullDone: true, ...Object.fromEntries(Object.entries(scores).map(([k, score]) => [k, { score }])), ...extra });
assert.deepEqual(SUMI_TRIAL_STEPS, ["holes", "heat", "steam", "pull"]);
assert.deepEqual(SUMI_TRIAL_RESULTS, ["great", "holes", "heat", "steam", "pull", "failed"]);
assert.equal(SUMI_TRIAL_STAMINA, 16, "第4章の宿の試作と同じ体力");
assert.equal(sumiTrialResult(null), "failed");
assert.equal(sumiTrialResult(cup({ holes: 90, heat: 90, steam: 90, pull: 0 }, { failed: "burnt" })), "failed");
assert.equal(sumiTrialResult({ ...cup({ holes: 90, heat: 90, steam: 90 }), pullDone: false }), "failed", "提供まで届かない一台");
assert.equal(sumiTrialResult(cup({ holes: 70, heat: 55, steam: 90, pull: 88 })), "heat");
assert.equal(sumiTrialResult(cup({ holes: 60, heat: 60, steam: 90, pull: 88 })), "holes", "同点なら先の工程");
assert.equal(sumiTrialResult(cup({ holes: 95, heat: 92, steam: 40, pull: 88 })), "steam");
assert.equal(sumiTrialResult(cup({ holes: 95, heat: 92, steam: 90, pull: 70 })), "pull");
assert.equal(sumiTrialResult(cup({ holes: SUMI_TRIAL_GREAT, heat: 99, steam: 90, pull: 88 })), "great");
assert.equal(sumiTrialResult(cup({ holes: SUMI_TRIAL_GREAT - 1, heat: 99, steam: 90, pull: 88 })), "holes");
// 穴あけを飛ばした一台（ロートスHMD）は、穴を見ない
assert.equal(sumiTrialResult({ ...cup({ heat: 85, steam: 90, pull: 88 }), holes: { skipped: true, score: null } }), "great");

// 3. 一度だけ記録 → 講評を読むまで「講評の続き」→ 読み終えたら二台目の前に一行返る
{
  const value = preparedSave(true);
  unchanged(value, v => recordSumiTrial(v, "bogus"));
  unchanged(value, v => finishSumiTrialFeedback(v));
  assert.deepEqual(sumiTrialRecall(value), []);
  assert.equal(recordSumiTrial(value, "steam"), true);
  assert.deepEqual(value.flags[SUMI_TRIAL_FLAG], { result: "steam", feedbackRead: false });
  unchanged(value, v => recordSumiTrial(v, "great"));
  assert.equal(sumiTrialOpen(value), false, "作った後は作業台を出さない");
  assert.equal(sumiTrialOffered(value), false);
  assert.equal(sumiTrialFeedbackPending(value), true, "講評だけ中断した保存は、講評から読む");
  value.slot = 0;
  assert.equal(sumiTrialFeedbackPending(value), true, "講評の続きは昼でも読める");
  assert.deepEqual(sumiTrialRecall(value), [], "講評を読む前は返さない");
  assert.deepEqual(chapterFivePrepEcho(value, CH5_MATCH_SCENES.beforeSecond), ["ch5_prep_recall_heat_adjusted"]);
  // SAVE/LOAD（JSON往復）でも同じ
  const loaded = JSON.parse(JSON.stringify(value));
  assert.equal(sumiTrialFeedbackPending(loaded), true);
  assert.equal(finishSumiTrialFeedback(value), true);
  unchanged(value, v => finishSumiTrialFeedback(v));
  assert.equal(sumiTrialFeedbackPending(value), false);
  assert.deepEqual(sumiTrialRecall(value), ["ch5_sumi_trial_recall_steam"]);
  assert.deepEqual(chapterFivePrepEcho(value, CH5_MATCH_SCENES.beforeSecond),
    ["ch5_prep_recall_heat_adjusted", "ch5_sumi_trial_recall_steam"], "試作の返りの後に一行");
  assert.deepEqual(chapterFivePrepEcho(value, "ch5_return_to_tonari"), ["ch5_prep_answer_heat_adjusted"], "帰店後の返答は変えない");
  assert.deepEqual(chapterFivePrepEcho(value, CH5_MATCH_SCENES.firstCup), [], "一台目には何も足さない");
  // 勝負へ進んでも記録は残り、二台目の前に返る
  assert.equal(completeChapterFiveScene(value, "ch5_unrecorded_day"), true);
  assert.equal(recordChapterFiveScheduleDecision(value, "decide"), true);
  assert.equal(completeChapterFiveScene(value, "ch5_schedule_contact"), true);
  assert.equal(beginChapterFiveMatch(value), true);
  assert.deepEqual(chapterFivePrepEcho(value, CH5_MATCH_SCENES.beforeSecond).at(-1), "ch5_sumi_trial_recall_steam");
  assert.equal(sumiTrialFeedbackPending(value), false, "勝負の後は tonari で講評を出さない");
}
// 旧保存（作っていない）は返りを足さず、これまでどおり
{
  const legacy = preparedSave(false);
  assert.deepEqual(chapterFivePrepEcho(legacy, CH5_MATCH_SCENES.beforeSecond), ["ch5_prep_recall_heat_kept"]);
  legacy.flags[SUMI_TRIAL_FLAG] = { result: "unknown", feedbackRead: true };
  assert.deepEqual(sumiTrialRecall(legacy), [], "壊れた記録は読まない");
  assert.equal(sumiTrialOpen(legacy), true);
}

// 4. 台本: 全部読み込まれ、背景があり、台詞の規範を守る。スミさんの返答は工程ごとに違う
{
  const scenes = JSON.parse(read("../../data/dialogue/ch5_main.json")).dialogues;
  const byId = Object.fromEntries(scenes.map(row => [row.dialogue_id, row]));
  assert.deepEqual(SUMI_TRIAL_IDS, [SUMI_TRIAL_INTRO, ...SUMI_TRIAL_RESULTS.map(sumiTrialScene), ...SUMI_TRIAL_RESULTS.map(sumiTrialRecallScene)]);
  for (const id of SUMI_TRIAL_IDS) {
    assert(CH5_SCENE_FILES.ch5_main.includes(id), `${id} is loaded by ch5`);
    assert(CH5_SCENE_BG[id], `bg for ${id}`);
    const lines = byId[id]?.lines;
    assert(lines?.length, `${id} has lines`);
    for (const line of lines) {
      assert(!line.text.includes("\n"), `${id}: no manual line break`);
      assert([...line.text].length <= 48, `${id}: 48字以内 ${line.text}`);
      if (line.speaker) assert(!line.text.endsWith("。"), `${id}: 台詞の末尾に「。」なし`);
      assert(["", "hajime", "sumi"].includes(line.speaker), `${id}: speaker ${line.speaker}`);
    }
  }
  for (const result of SUMI_TRIAL_RESULTS) {
    const feedback = byId[sumiTrialScene(result)].lines;
    assert(feedback.length >= 3 && feedback.length <= 6, `${result}: 講評は数行`);
    assert(feedback.some(line => line.speaker === "sumi"), `${result}: スミさんが返す`);
    const recall = byId[sumiTrialRecallScene(result)].lines;
    assert.equal(recall.length, 1, `${result}: 二台目の前は一行`);
    assert.equal(recall[0].speaker, "", "地の文");
  }
  const sumiWords = SUMI_TRIAL_RESULTS.map(result => byId[sumiTrialScene(result)].lines.filter(line => line.speaker === "sumi").map(line => line.text).join("/"));
  assert.equal(new Set(sumiWords).size, sumiWords.length, "工程ごとに違う返答");
  assert.match(byId[SUMI_TRIAL_INTRO].lines.map(line => line.text).join(""), /12グラム/);
}

// 5. 画面と制作の接続（ch5-daily.js）: 試作の会話の続きを先に、作業台はその後、いつもの tonari の場面より前
{
  const daily = read("../js/chapters/ch5-daily.js");
  const tonari = daily.slice(daily.indexOf('if (spot.id === "tonari")'));
  const order = ["chapterFivePrepPending(state)", "offerSumiTrial(io, options)", "dueTonariScene()"].map(text => tonari.indexOf(text));
  assert(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `tonari order ${order}`);
  const offer = daily.slice(daily.indexOf("async function offerSumiTrial"), daily.indexOf("async function runPrep"));
  assert.match(offer, /runFullPractice\(\{ kind: "ch5_sumi_trial", adjustments: false/, "提供までの一台（調整は本番）");
  assert.match(offer, /staminaGuard\(-SUMI_TRIAL_STAMINA\)/);
  const saveAt = offer.indexOf("save(); // 講評中");
  assert(saveAt > offer.indexOf("recordSumiTrial(owner") && saveAt < offer.indexOf("sumiTrialScene("), "作り終えたら講評の前に保存");
  assert.match(offer, /"usual"[\s\S]*declineSumiTrialTonight\(state\); return null;/, "断れば、いつもの tonari");
  // 最終戦の二台目の制作・投票の処理は触らない（ch5.js に試作の参照を足さない）
  assert(!read("../js/chapters/ch5.js").includes("sumiTrial"), "ch5.js の勝負の処理は変えない");
}

// 6. 周回では作り直す（持ち越さない）
assert.equal(classifyFlag(SUMI_TRIAL_FLAG), "progression");
assert.equal(flagVerdict(SUMI_TRIAL_FLAG), "reset");

console.log("ch5 sumi trial: optional one-shot real cup after the prep talk, Sumi's one point, echo before the second cup PASS");
