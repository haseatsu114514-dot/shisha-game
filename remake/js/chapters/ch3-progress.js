import { nextTokyoFreeTime } from "../core/tokyo-clock.js";
import { syncTokyoVisits, tokyoVisitState } from "../core/tokyo-visits.js";
import { CH3_INTRO_SCENES, chapterThreeScenes } from "./ch3-scenes.js";
export { CH3_INTRO_SCENES, chapterThreeScenes } from "./ch3-scenes.js";
import { recordChapterThreeStoryLime } from "./ch3-story-lime.js";
import { DEPARTURE_PREP_DAYS } from "../core/chapter-clock.js";

/**
 * 東京の14日も共通の日常ループで遊ぶ行程（routeVersion 3・VOL03）。場面の並びは版2と同じで、
 * 昼の行動を使う場面（slot）と夜の予定（night）に分けて日付に置く（DAYは正本の東京DAY）。
 * 日付・時間帯は日常ループが進めるので、場面の読了で時計を動かさない。
 */
export const CH3_DAILY_PLAN = Object.freeze({
  ch3_opening: { kind: "slot", day: 1, slot: 0 },
  ch3_mukai_arrival: { kind: "slot", day: 1, slot: 1 },
  ch3_mukai_intro: { kind: "slot", day: 2, slot: 0 },
  ch3_individuality_doubt: { kind: "night", day: 2 },
  ch3_tokyo_shop_gap: { kind: "slot", day: 3, slot: 0 },
  ch3_double_apple_incident: { kind: "night", day: 3 },
  ch3_rest_before_recovery: { kind: "slot", day: 4, slot: 0 },
  ch3_daily_cup_1: { kind: "night", day: 4 },
  ch3_work_without_taste: { kind: "night", day: 5 },
  ch3_naru_contact_before_tournament: { kind: "night", day: 7 },
  ch3_naru_work: { kind: "night", day: 7 },
  ch3_kuze_first: { kind: "slot", day: 8, slot: 0 },
  // DAY9の久世来店は強制だが行動枠を使わない（正本「一度の崩れと、続いていく回復」）。
  ch3_kuze_mukai_visit: { kind: "night", day: 9 },
  ch3_taste_return: { kind: "night", day: 10 },
  ch3_abyss_recovery: { kind: "slot", day: 11, slot: 0 },
  ch3_kuze_advice: { kind: "slot", day: 11, slot: 0 },
  ch3_steve_low_heat: { kind: "night", day: 11 },
  ch3_volk_first: { kind: "night", day: 12 },
  ch3_strategy: { kind: "slot", day: 13, slot: 0 },
  ch3_tournament_eve: { kind: "night", day: 13 },
});
export const chapterThreeDaily = value => value?.chapter === 3 && value.flags?._ch3_intro?.routeVersion === 3;

/** 第2章の優勝と後日談を終えた保存だけ、東京の初日へ進める。 */
export function canAdvanceToChapterThree(value) {
  return !!value && value.chapter === 2 && value.phase === "cleared"
    && value.flags?._ch2_cleared === true
    && value.flags?._ch2_read_ch2_tournament_ageha_heart === true
    && value.flags?._ch2_tournament?.stage === "complete";
}

export function advanceToChapterThree(value) {
  if (!canAdvanceToChapterThree(value)) return false;
  value.chapter = 3;
  value.day += 1;
  value.slot = 0;
  value.phase = "opening";
  value.statsAtChapterStart = { ...value.stats };
  // 出発前の3日を地元で過ごしてから東京へ（VOL02）。章頭の回想・章題・準備・出発は chapters/ch3.js の renderPrep。
  // 東京DAY1は出発の朝（準備の最後の日の翌朝）。出発時に実際の日付で確定し直す。
  value.flags._ch3_prep = { startDay: value.day, days: DEPARTURE_PREP_DAYS, step: 0, departed: false };
  value.flags._ch2_region = "home";
  value.flags._ch3_intro = { startDay: value.day + DEPARTURE_PREP_DAYS, stage: 0, titleSeen: false, routeVersion: 3 };
  return true;
}

/** 出発前の準備期間（VOL02）が終わって出発の朝に着いたか。準備期間の無い旧保存は false。 */
export const chapterThreePrepPending = value => {
  const prep = value?.flags?._ch3_prep;
  return value?.chapter === 3 && !!prep && !prep.departed;
};

/**
 * 出発の朝（準備の最後の日の翌朝）に東京DAY1を確定する。以後は東京の行程（場面の順と自由時間）のまま。
 * 準備期間の無い保存・まだ出発の朝でない保存・出発済みは false（何も変えない）。
 */
export function departChapterThree(value) {
  const prep = value?.flags?._ch3_prep;
  if (!chapterThreePrepPending(value) || !Number.isInteger(prep.startDay) || !Number.isInteger(prep.days)
    || value.day < prep.startDay + prep.days) return false;
  const progress = chapterThreeProgress(value);
  prep.departed = true;
  progress.startDay = value.day;
  value.slot = 0;
  value.phase = "opening";
  value.flags._ch2_region = "home";
  return true;
}

/** 旧手動保存は既読を推測せず、現在の日付を導入の初日として扱う。 */
export function chapterThreeProgress(value) {
  if (value?.chapter !== 3) throw new Error("第3章の保存ではありません");
  const progress = value.flags._ch3_intro ||= { startDay: value.day, stage: 0, titleSeen: false };
  if (!Number.isInteger(progress.startDay) || progress.startDay < 1
    || !Number.isInteger(progress.stage) || progress.stage < 0 || progress.stage > chapterThreeScenes(value).length
    || typeof progress.titleSeen !== "boolean"
    || (progress.routeVersion !== undefined && progress.routeVersion !== 2 && progress.routeVersion !== 3)
    || (progress.prologueStep !== undefined && (!Number.isInteger(progress.prologueStep)
      || progress.prologueStep < 0 || progress.prologueStep > 4))) throw new Error("東京編の保存地点を確認できません");
  return progress;
}

/** 現在の一場面の正常読了時だけ進める。次の日付は場面順から決める。 */
export function completeChapterThreeScene(value, sceneId) {
  const progress = chapterThreeProgress(value);
  if (chapterThreeScenes(value)[progress.stage]?.id !== sceneId || chapterThreeFreeTime(value)) return false;
  recordChapterThreeStoryLime(value, sceneId);
  progress.stage += 1;
  // 東京も日常ループの行程（版3）は、日付と時間帯を日常ループが進める。
  if (progress.routeVersion === 3) return true;
  setNextChapterThreeTime(value);
  return true;
}

function setNextChapterThreeTime(value) {
  const progress = chapterThreeProgress(value);
  const next = chapterThreeScenes(value)[progress.stage];
  const free = nextTokyoFreeTime(value, next?.id || "tournament");
  if (free) {
    value.day = free.day;
    value.slot = free.slot;
  } else if (next) {
    value.day = Math.max(value.day, progress.startDay + next.day - 1);
    value.slot = next.slot;
  } else {
    value.day = Math.max(value.day, progress.startDay + 13);
    value.slot = 0;
  }
  value.phase = free ? "daily" : next ? progress.stage <= 1 ? "opening" : "daily" : "tournament";
  syncTokyoVisits(value);
}

export function chapterThreeFreeTime(value) {
  const progress = chapterThreeProgress(value);
  return nextTokyoFreeTime(value, chapterThreeScenes(value)[progress.stage]?.id || "tournament");
}

export function completeChapterThreeFreeTime(value, windowId) {
  const window = chapterThreeFreeTime(value);
  if (!window || window.id !== windowId || value.day !== window.day || value.slot !== window.slot) return false;
  tokyoVisitState(value).closedSlots.push(window.id);
  setNextChapterThreeTime(value);
  return true;
}
