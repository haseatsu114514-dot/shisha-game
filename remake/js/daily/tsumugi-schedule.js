// 固定物語と通常在店で、同じ日程・読了条件を参照する。
export const TSUMUGI_STORY = [
  { day: 1, dialogue: "ch1_tsumugi_research", flag: "_tsumugi_contest_research", level: 1 },
  { day: 3, dialogue: "ch1_tsumugi_work_in_progress", flag: "_tsumugi_contest_progress" },
  { day: 11, dialogue: "ch1_tsumugi_sketch", flag: "_tsumugi_contest_submitted", level: 2 },
  { day: 13, dialogue: "ch1_tsumugi_eve", flag: "_tsumugi_contest_eve" },
];

/** 表示にも来店にも使う読み取り専用判定。固定回・延期の未読を通常会話で代替しない。 */
export function tsumugiAtTonari(save) {
  if (save.slot !== 0 && save.slot !== 1) return false;
  if (save.flags?._tsumugi_story_day === `${save.chapter}:${save.day}`) return false;
  if (save.chapter === 1 && TSUMUGI_STORY.some(step => step.day <= save.day
    && (step.day === save.day || !save.flags?.[step.flag]))) return false;
  // 基本は夜。序盤の一部だけ昼に来る。夜専用の後半会話は夜に残す。
  const slot = save.day % 4 === 0 && (save.story?.tsumugi || 0) < 4 ? 0 : 1;
  return save.slot === slot;
}

/** 既存の汎用雑談を二度だけ早期にも使う。贈り物に言及する友情成立後の文は使わない。 */
export function tsumugiMessages(save, friends) {
  if (save.chapter !== 1) return [];
  const recent = (save.inbox || []).some(item => item.msg?.sender === "tsumugi"
    && item.chapter === save.chapter && save.day - item.day < 2);
  if (recent) return [];
  return [5, 10].flatMap((day, index) => {
    const chat = friends?.friends?.tsumugi?.chats?.[index];
    if (!chat || save.day < day || save.day > day + 1) return [];
    return [{ id: `lime_tsumugi_note_day${day}`, sender: "tsumugi", chapter: 1,
      trigger_condition: "lime_exchanged", trigger_day: day, type: "chat",
      messages: chat.m.slice(), replies: chat.r }];
  });
}
