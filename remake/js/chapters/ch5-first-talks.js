// 第5章の最初の来店で一度だけ読む会話（N3）。通い店（ch5-shops.js の CH5_SHOPS）に入れていない常連の店に、
// 世界大会の後・博士との勝負の前の一言を足す。読んだ後は、いつもの来店（通い訪問の小会話）に戻る。
//   アダム（EDEN・地元）: 第5章の任意場面「二つのダブルアップル」（ch5_free_eden_adam）がEDENの最初の来店なので、その次の来店
//   レヰ（零-ZERO-・柚ヶ谷）: 第5章の最初の来店
//   神崎（神崎煙草店・柚ヶ谷）: 未接続だった第2章の後日談 ch2_kumicho_after_ch2 を、世界大会の後の場面に書き直して読む
//     （STP07 J-6・オーナー判断 C13 Q3=A）。第5章の柚ヶ谷では第2章の物語の場面を出さない（#2033・ch2-preparation.js）
//     ことの、ただ一つの例外。旧ID ch2_kumicho_after_ch2_firstshop は台本の jump で同じ場面へ進む。
// 台詞は data/dialogue/ch5_shops.json（アダム・レヰ）と ch2_kumicho.json（神崎）。代金・体力・好感度・能力は
// 来店の処理（ch5-shops.js の performChapterFiveShop）が付け、既読も来店の精算と一緒に付ける（中断・LOADでは残さない）。
// DOMに触れないので、remake/test/ch5_first_talks.mjs が node で読み込んで判定を確かめる。
import { chapterFiveProgress, chapterFiveRead } from "./ch5-progress.js";

// stat はいつもの来店で上がる能力（アダムは daily/spots.js の CHAR_STAT、神崎・レヰは ch2-preparation.js の通い訪問と同じ）。
export const CH5_FIRST_TALKS = Object.freeze({
  adam: Object.freeze({ file: "ch5_shops", scene: "ch5_adam_shop", region: "home", stat: "guts", after: "ch5_free_eden_adam" }),
  rei: Object.freeze({ file: "ch5_shops", scene: "ch5_rei_shop", region: "widehanga", stat: "charm" }),
  // 既読の名前は、未接続だった頃の台本末尾の set_flag と同じ（core/carry.js の分類も同じ）
  kumicho: Object.freeze({ file: "ch2_kumicho", scene: "ch2_kumicho_after_ch2", region: "widehanga", stat: "guts",
    doneFlag: "ch2_kumicho_after_ch2_done" }),
});

/** 読んだ印の flag 名（神崎は旧台本と同じ名前・ほかは章の間だけの会話と同じ `_talk_seen_<scene>`）。 */
export const chapterFiveFirstTalkSeenFlag = talk => talk.doneFlag || `_talk_seen_${talk.scene}`;

/** 博士との勝負の前（自由行動・日を決めた日）か。第5章の保存として読めなければ false（例外を出さない）。 */
function beforeMatch(value) {
  try { return ["free", "scheduled"].includes(chapterFiveProgress(value).part); }
  catch { return false; }
}

/**
 * その人の店で、いま一度だけの会話を読むか。読むなら CH5_FIRST_TALKS の項目、無ければ null（いつもの来店）。
 * 第5章の勝負の前だけ。勝負の後と、ほかの章では出さない（台詞が「次は博士と勝負」を前提にするため）。
 */
export function chapterFiveFirstTalkDue(charId, value) {
  const talk = Object.hasOwn(CH5_FIRST_TALKS, charId) ? CH5_FIRST_TALKS[charId] : null;
  if (!talk || value?.chapter !== 5 || !beforeMatch(value)) return null;
  if (value.flags?.[chapterFiveFirstTalkSeenFlag(talk)]) return null;
  if (talk.after && !chapterFiveRead(value, talk.after)) return null;
  return talk;
}
