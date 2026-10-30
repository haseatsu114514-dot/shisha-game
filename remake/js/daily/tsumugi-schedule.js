// 固定物語と通常在店で、同じ日程・読了条件を参照する。
export const TSUMUGI_STORY = [
  { day: 1, dialogue: "ch1_tsumugi_research", flag: "_tsumugi_contest_research", level: 1 },
  { day: 3, dialogue: "ch1_tsumugi_work_in_progress", flag: "_tsumugi_contest_progress" },
  { day: 11, dialogue: "ch1_tsumugi_sketch", flag: "_tsumugi_contest_submitted" },
  { day: 13, dialogue: "ch1_tsumugi_eve", flag: "_tsumugi_contest_eve" },
];

/** 表示にも来店にも使う読み取り専用判定。固定回・延期の未読を通常会話で代替しない。 */
export function tsumugiAtTonari(save) {
  if (save.slot !== 0 && save.slot !== 1) return false;
  if (save.flags?._tsumugi_story_day === `${save.chapter}:${save.day}`) return false;
  if (save.chapter === 1 && TSUMUGI_STORY.some(step => step.day <= save.day
    && (step.day === save.day || !save.flags?.[step.flag]))) return false;
  // 序盤のDAY4/8だけ昼、それ以外は夜。会話の進行で同じ日の在店枠を変えない。
  const slot = save.day < 10 && save.day % 4 === 0 ? 0 : 1;
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
    // #1507 TL-05: 2通目（スケッチブック）は提出日 DAY11 と重ならないよう当日限り
    const lastDay = day + (index === 1 ? 0 : 1);
    if (!chat || save.day < day || save.day > lastDay) return [];
    return [{ id: `lime_tsumugi_note_day${day}`, sender: "tsumugi", chapter: 1,
      trigger_condition: "lime_exchanged", trigger_day: day, type: "chat",
      messages: chat.m.slice(), replies: chat.r }];
  });
}
