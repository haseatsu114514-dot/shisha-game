// 第4章の「みんな来ちゃった」（4-2・SPC28。2026-11-15 オーナー「恋人が複数いるときみんな来ちゃったみたいな修羅場の内心を作りたいのと、
// プチ修羅場イベント現地でも欲しい」）。前夜祭の日、別便の到着を読み終えて砂浜（水着回）へ行く前に一度だけ読む強制イベント（ch4.js の renderEve）。
// 日本から来た恋人が2人以上その場にいる時（同行者と、到着を読んだ別便の恋人。ドバイに住むヌールは「来た」人ではないので数えない）。
// 1) はじめの内心: 部屋に戻って、来てくれた恋人の名前を数える（2人と3人以上で一行だけ変える）。
// 2) プチ修羅場（core/petit-shuraba.js の dubai。間を空ける決まりなど petitOpen が通る時だけ）: 到着のばたばたの中で、恋人2人に
//    同じ六時の約束を返していた。六時のロビーで二人が鉢合わせ（2026-11-15 オーナー「ノック二つはありえないのでスケジュールかぶるとかで」）。
//    はじめは「みんなで砂浜へ」でごまかし、そのまま砂浜へ行く。途中では謝罪・和解・破局を決めない。
// 好感度・能力・お金は動かさない。読み終えた時だけ旗を立て、プチ修羅場は数えておく（第5章の最後の修羅場で一行返る）。
import { OVERSEAS_HEROINES } from "../core/overseas-companion.js";
import { petitOpen } from "../core/petit-shuraba.js";
import { chapterFourBeachCast, chapterFourBeachDue } from "./ch4-beach.js";

export const CH4_LOVERS_FLAG = "_ch4_lovers_inner";
export const CH4_LOVERS_PETIT = "dubai";
export const CH4_LOVERS_SCENE = "ch4_lovers_eve";
/** 内心で呼ぶ名前（恋人なので、みんとは栞さん） */
export const CH4_LOVERS_CALL = Object.freeze({ tsumugi: "つむぎ", minto: "栞さん", rio: "凛想さん", ageha: "あげは", mashiro: "ましろちゃん",
  samechan: "サメちゃん", hiyori: "ひよりさん" });
const byId = prefix => Object.freeze(Object.fromEntries(OVERSEAS_HEROINES.map(id => [id, `${prefix}${id}`])));
export const CH4_LOVERS_SCENES = Object.freeze({
  open: "ch4_lovers_inner_open", two: "ch4_lovers_inner_two", many: "ch4_lovers_inner_many", close: "ch4_lovers_inner_close",
  clashOpen: "ch4_petit_clash_open", clashMeet: "ch4_petit_clash_meet", clashClose: "ch4_petit_clash_close",
  invite: byId("ch4_petit_invite_"), look: byId("ch4_petit_look_"),
});
export const CH4_LOVERS_FILES = Object.freeze({ ch4_lovers: Object.freeze([CH4_LOVERS_SCENES.open, CH4_LOVERS_SCENES.two, CH4_LOVERS_SCENES.many,
  CH4_LOVERS_SCENES.close, CH4_LOVERS_SCENES.clashOpen, CH4_LOVERS_SCENES.clashMeet, CH4_LOVERS_SCENES.clashClose,
  ...Object.values(CH4_LOVERS_SCENES.invite), ...Object.values(CH4_LOVERS_SCENES.look)]) });

/** 日本から来て、今その場にいる恋人（同行者と、到着を読んだ別便の恋人。砂浜の顔ぶれと同じ決まり・同じ並び）。 */
export function chapterFourLoversHere(value) {
  const lovers = new Set(value?.lovers || []);
  return chapterFourBeachCast(value).filter(id => OVERSEAS_HEROINES.includes(id) && lovers.has(id));
}

/** 内心を読む時か（前夜祭の日・到着の後・砂浜の前・恋人が2人以上・まだ読んでいない）。 */
export const chapterFourLoversDue = value => value?.flags?.[CH4_LOVERS_FLAG] !== true && chapterFourBeachDue(value)
  && chapterFourLoversHere(value).length >= 2;

/**
 * 読む台本と、約束が重なった2人（プチ修羅場を読まない時は null）。dialogues は台詞の表（DB.dialogues）。
 * 名前を数える一行だけコードで作る（来た人と人数で変わるため）。
 */
export function chapterFourLoversScript(value, dialogues) {
  const lines = id => dialogues[id]?.lines || [];
  const here = chapterFourLoversHere(value);
  const pair = petitOpen(value, CH4_LOVERS_PETIT) ? here.slice(0, 2) : null;
  const { open, two, many, close, clashOpen, clashMeet, clashClose, invite, look } = CH4_LOVERS_SCENES;
  return {
    pair,
    script: { dialogue_id: CH4_LOVERS_SCENE, lines: [
      ...lines(open),
      { speaker: "hajime", face: "serious", text: `（${here.map(id => CH4_LOVERS_CALL[id]).join("、")}……みんな、来てくれた）` },
      ...lines(here.length === 2 ? two : many),
      ...lines(close),
      ...(pair ? [...lines(clashOpen), ...pair.flatMap(id => lines(invite[id])), ...lines(clashMeet),
        ...pair.flatMap(id => lines(look[id])), ...lines(clashClose)] : []),
    ] },
  };
}
