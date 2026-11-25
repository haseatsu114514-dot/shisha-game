/** 章の保存検査で落ちた条件。通信や台本のエラーと区別する。 */
export class ChapterSaveError extends Error {
  constructor(chapter, message, condition) {
    super(message);
    this.chapter = chapter;
    this.condition = condition;
  }
}

/** 既存の章遷移が確定した直後の状態を一つだけ、同じ保存に入れる。 */
export function captureChapterStart(value) {
  const flags = { ...value.flags };
  delete flags._chapter_start_checkpoint;
  value.flags._chapter_start_checkpoint = structuredClone({ ...value, flags });
}

export function captureUnrecordedChapterStart(value) {
  if (isChapterStart(value, value) && !isChapterStart(value.flags._chapter_start_checkpoint, value)) {
    captureChapterStart(value);
  }
}

/** 旧保存では、同じ周回の未読・未行動の章頭が残っている場合に使える。 */
export function isChapterStart(value, owner) {
  if (!owner?.cycleId || value?.cycleId !== owner.cycleId || value.chapter !== owner.chapter
    || value.phase !== "opening" || value.slot !== 0 || !Number.isInteger(value.day) || value.day < 1) return false;
  const { flags } = value;
  if (value.chapter === 2) {
    const start = flags?._ch2_day1;
    return start?.startDay === value.day && start.stage === "departure" && start.titleSeen === false
      && !flags._ch2_preparation_started && !flags._ch2_tournament;
  }
  if (value.chapter === 3 || value.chapter === 4) {
    const prep = value.chapter === 3 ? flags?._ch3_prep : flags?._ch4_prep;
    const start = value.chapter === 3 ? flags?._ch3_intro : flags?._ch4;
    const firstDay = prep ? prep.startDay === value.day && prep.step === 0 && prep.departed === false
      : start?.startDay === value.day;
    return firstDay && start?.stage === 0 && start.titleSeen === false
      && (value.chapter === 3 ? !flags._ch3_tournament : start.part === "prologue" && !start.match);
  }
  if (value.chapter === 5) {
    const start = flags?._ch5;
    return start?.startDay === value.day && start.part === "prologue" && start.stage === 0
      && start.titleSeen === false && flags._ch5_match_scheduled === false && flags._ch5_match_started === false;
  }
  return false;
}
