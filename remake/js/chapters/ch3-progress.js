import { nextTokyoFreeTime } from "../core/tokyo-clock.js";
import { syncTokyoVisits, tokyoVisitState } from "../core/tokyo-visits.js";
import { CH3_INTRO_SCENES, chapterThreeScenes } from "./ch3-scenes.js";
export { CH3_INTRO_SCENES, chapterThreeScenes } from "./ch3-scenes.js";
import { recordChapterThreeStoryLime } from "./ch3-story-lime.js";

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
  value.flags._ch3_intro = { startDay: value.day, stage: 0, titleSeen: false, prologueStep: 0, routeVersion: 2 };
  return true;
}

/** 旧手動保存は既読を推測せず、現在の日付を導入の初日として扱う。 */
export function chapterThreeProgress(value) {
  if (value?.chapter !== 3) throw new Error("第3章の保存ではありません");
  const progress = value.flags._ch3_intro ||= { startDay: value.day, stage: 0, titleSeen: false };
  if (!Number.isInteger(progress.startDay) || progress.startDay < 1
    || !Number.isInteger(progress.stage) || progress.stage < 0 || progress.stage > chapterThreeScenes(value).length
    || typeof progress.titleSeen !== "boolean"
    || (progress.routeVersion !== undefined && progress.routeVersion !== 2)
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
