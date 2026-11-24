// 第4章の大会当日の朝（4-4・SPC28・2026-11-15 オーナー採用）。大会の場面（ch4_tournament_start）の前に一度だけ読む。
// 導入（なると宿のロビー）→ 来てくれた人の一言（その場にいる人だけ。恋人を先に、最大 CH4_MORNING_CHEERS_MAX 人）→ 締め（会場まで歩く）。
// その場にいる人は砂浜の顔ぶれと同じ決まり（ch4-beach.js の chapterFourBeachCast。同行者・到着を読んだ人・会ったヌール・♥5の男の友人）。
// なるは一緒に歩くので一言の枠には入れない。好感度・能力・お金・日付は動かさない。読み終えた時だけ旗を立てる。
import { chapterFourBeachCast, CH4_BEACH_RIVALS } from "./ch4-beach.js";

export const CH4_MORNING_FLAG = "_ch4_morning_done";
export const CH4_MORNING_CHEERS_MAX = 4;
const CHEER_IDS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor",
  "adam", "kumicho", "kuraudo", "ayatori", "steve", "volk"]);
export const CH4_MORNING_SCENES = Object.freeze({
  open: "ch4_tournament_morning_open", crowd: "ch4_tournament_morning_crowd", more: "ch4_tournament_morning_more",
  close: "ch4_tournament_morning_close",
  cheers: Object.freeze(Object.fromEntries(CHEER_IDS.map(id => [id, `ch4_morning_cheer_${id}`]))),
});
// 結果発表のあと（#3097 第3弾・VOL23）: 朝に一言をくれた同じ人が、客席から降りてきて一言ずつ。恋人には恋人の台本。
// ヌールと男の友人は恋人にならないので、友人の台本だけ。
const AFTER_LOVER_IDS = Object.freeze(["tsumugi", "minto", "rio", "ageha", "mashiro", "samechan", "hiyori"]);
export const CH4_AFTER_SCENES = Object.freeze({
  open: "ch4_tournament_after_open", more: "ch4_tournament_after_more", close: "ch4_tournament_after_close",
  cheers: Object.freeze(Object.fromEntries(CHEER_IDS.map(id => [id, `ch4_after_cheer_${id}`]))),
  lovers: Object.freeze(Object.fromEntries(AFTER_LOVER_IDS.map(id => [id, `ch4_after_cheer_${id}_lover`]))),
});
export const CH4_MORNING_FILES = Object.freeze({ ch4_morning: Object.freeze([CH4_MORNING_SCENES.open, CH4_MORNING_SCENES.crowd,
  CH4_MORNING_SCENES.more, CH4_MORNING_SCENES.close, ...Object.values(CH4_MORNING_SCENES.cheers),
  CH4_AFTER_SCENES.open, CH4_AFTER_SCENES.more, CH4_AFTER_SCENES.close,
  ...Object.values(CH4_AFTER_SCENES.cheers), ...Object.values(CH4_AFTER_SCENES.lovers)]) });

/** 朝に一言をくれる人（恋人を先に、その後は砂浜の顔ぶれの順。最大 CH4_MORNING_CHEERS_MAX 人）と、ほかにも来ている人がいるか。 */
export function chapterFourMorningCheers(value) {
  const lovers = new Set(value?.lovers || []);
  const present = chapterFourBeachCast(value).filter(id => !CH4_BEACH_RIVALS.includes(id) && CH4_MORNING_SCENES.cheers[id]);
  const ordered = [...present.filter(id => lovers.has(id)), ...present.filter(id => !lovers.has(id))];
  return { cheers: ordered.slice(0, CH4_MORNING_CHEERS_MAX), more: ordered.length > CH4_MORNING_CHEERS_MAX };
}

/** 朝を読むか（大会の場面をまだ読んでいない・朝をまだ読み終えていない）。 */
export const chapterFourMorningDue = (value, startRead) => !startRead && value?.flags?.[CH4_MORNING_FLAG] !== true;

/** 読む台本（一本の会話につないだもの）。dialogues は台詞の表（DB.dialogues）。 */
export function chapterFourMorningScript(value, dialogues) {
  const lines = id => dialogues[id]?.lines || [];
  const { cheers, more } = chapterFourMorningCheers(value);
  return {
    dialogue_id: "ch4_tournament_morning",
    lines: [
      ...lines(CH4_MORNING_SCENES.open),
      ...(cheers.length ? lines(CH4_MORNING_SCENES.crowd) : []),
      ...cheers.flatMap(id => lines(CH4_MORNING_SCENES.cheers[id])),
      ...(more ? lines(CH4_MORNING_SCENES.more) : []),
      ...lines(CH4_MORNING_SCENES.close),
    ],
  };
}

/**
 * 結果発表（ch4_result・優勝の時だけ読む）の後ろに、来てくれた人の一言をつないだ台本。顔ぶれは朝と同じ
 * （chapterFourMorningCheers）。誰も来ていなければ元の台本のまま。好感度・能力・お金・日付は動かさない。
 */
export function chapterFourResultScript(source, value, dialogues) {
  const { cheers, more } = chapterFourMorningCheers(value);
  if (!cheers.length) return source;
  const lines = id => dialogues[id]?.lines || [];
  const lovers = new Set(value?.lovers || []);
  return {
    ...source,
    lines: [
      ...source.lines,
      ...lines(CH4_AFTER_SCENES.open),
      ...cheers.flatMap(id => lines(lovers.has(id) && CH4_AFTER_SCENES.lovers[id] || CH4_AFTER_SCENES.cheers[id])),
      ...(more ? lines(CH4_AFTER_SCENES.more) : []),
      ...lines(CH4_AFTER_SCENES.close),
    ],
  };
}
