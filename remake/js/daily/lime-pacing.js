// 朝のLIMEの塩梅（2026-11-12 オーナー「届きすぎても邪魔だし来ないのも寂しい」「いろんなキャラと連絡しつつ」LM08〜）。
// 何を・誰から・何通届けるかの決まりをここに集める。phone.js の morningMessages が候補を集め、ここの決まりで選ぶ。
//
// 連絡の種類（paceClass）:
// - must   必ず届く: 物語の誘いと大事な連絡（priority のある物語の連絡、締めくくりの誘い）・連絡先を交換した翌朝の最初の一通・
//          噂（物語の伏線）・恋人の私用アカウントの最初のひとこと・記念日・デートの誘い（恋人全員で4日に1回まで）・大会の朝の応援。
// - work   仕事の連絡（スミさん・ムカイさんのシフトの誘い）。必ず届き、通数にも数えない（オーナー「バイトの誘いはいい」）。
// - react  会った後・出来事の後の続き（店で話を読んだ翌朝の一言、外出の後の礼）。プレイヤーの行動への返事なので、
//          同じ人の間隔は待たず、通数の枠の中でいちばん先に届く。
// - timed  日付に結びついた連絡（章の◯日目の連絡・章が始まって◯日目からの連絡）。
// - ambient ふだんの雑談（交換した後いつでも届く雑談・♥で開く雑談・恋人の朝のひとこと・友人のLIME・知り合いの雑談・ひよりの誘い）。
//
// 決まり:
// 1. 朝は softCap 通まで（must が softCap を超えて重なった朝だけ hardCap 通まで）。仕事の連絡は通数に数えない。
//    softCap 通届いた翌朝は、must のほかは afterBusyCap 通まで（にぎやかな朝と静かな朝が交互になる）。
//    章の◯日目の連絡（lime_exchanged）だけは、その日を逃すと届かないので、静かな朝の番でも枠が空いていれば届く。
// 2. ふだんの雑談は、同じ人から続けて届かない。間隔は仲の深さで決まる（gapDays）。知り合ったばかりの人ほど、用事のない連絡は少ない。
// 3. 届く順は「待っている度合い」（urgency）: 会った後の続き → 間隔の倍以上待っている人の雑談 → 日付の連絡 → 間隔を過ぎた人の雑談。
//    雑談どうしは、間隔に対していちばん長く連絡のない人から（特定の人に偏らず、いろんな人から届く）。
// 4. 読んでいないLIMEが backlog 通以上たまっている朝は、ふだんの雑談を届けない（読まずにいる間に積み上がらない）。
// 5. 返事の要る雑談は、返事の要る連絡が今朝すでにあるなら重ねない（LM04 を雑談全体へ広げた）。
// 6. quietDays 日なにも届いていなければ、間隔を待たずに1通届く（送る話題がある限り、静かな朝は続かない）。
import { state } from "../core/state.js";
import { affinityLevel } from "../core/stats.js";

export const LIME_PACING = Object.freeze({
  softCap: 2,
  hardCap: 3,
  afterBusyCap: 1,
  backlog: 3,
  quietDays: 2,
  // 同じ人のふだんの雑談の間隔（日）。lover=恋人／close=締めくくりを読んだ相手か♥4以上／known=♥2〜3／fresh=♥0〜1
  gapDays: Object.freeze({ lover: 2, close: 3, known: 4, fresh: 6 }),
});

/** 仕事の連絡としてのシフトの誘い（人と会う約束・返事の要る雑談・朝の通数には数えない）。 */
export const WORK_INVITES = new Set(["__sumi_baito__", "__mukai_baito__"]);
export const isWorkInvite = (m) => WORK_INVITES.has(m?.accept_event);

/** 仲の深さ。恋人 → 締めくくりを読んだ相手か♥4以上 → ♥2〜3 → それ未満 */
export function closeness(id) {
  if ((state.lovers || []).includes(id)) return "lover";
  const level = affinityLevel(id);
  if (state.finales?.[id] || level >= 4) return "close";
  return level >= 2 ? "known" : "fresh";
}
export const senderGapDays = (id) => LIME_PACING.gapDays[closeness(id)];

/**
 * 絆の深い相手（恋人・締めくくりを読んだ相手）からの、人と会う誘いか（仕事の連絡は除く）。
 * 乗った時の経験値が多い（core/growth.js の BOND_INVITE_MULT・LM11）。
 */
export const bondInvitation = (event, sender) => !WORK_INVITES.has(event) && !!sender
  && ((state.lovers || []).includes(sender) || !!state.finales?.[sender]);

/**
 * 物語のLIME（data/lime_messages.json の1件）の種類。恋人・友人・知り合いのLIMEは phone.js が候補にする時に決める。
 * 交換の印（_lime_contact_・_friend_）だけで届く雑談と♥で開く雑談は、いつ読んでもよい話題なので ambient。
 * それ以外の印（場面を読んだ・外出した）で届く連絡は、その出来事の続きなので react。
 */
export function storyPaceClass(m) {
  if (isWorkInvite(m)) return "work";
  // 物語の誘いは返事の期限がその日のうち、噂は物語の伏線。どちらも、ほかの連絡に押されて消えないよう必ず届ける
  if ((m.priority || 0) > 0 || m.type === "invitation" || m.type === "rumor") return "must";
  const cond = m.trigger_condition || "";
  if (cond === "lime_exchanged" || /^ch\d+_started$/.test(cond)) return "timed";
  if (cond === "flag" && !/^_(lime_contact|friend)_/.test(m.trigger_flag || "")) return "react";
  return "ambient";
}

/** 受信箱から、朝の配分に使う履歴をまとめる（仕事の連絡は数えない）。 */
export function pacingHistory(inbox = state.inbox || [], day = state.day) {
  const lastBySender = new Map();
  let lastAny = -Infinity, yesterday = 0, unread = 0;
  for (const item of inbox) {
    if (!item?.msg || isWorkInvite(item.msg)) continue;
    const at = Number.isFinite(item.day) ? item.day : -Infinity;
    const sender = item.msg.sender;
    if (at > (lastBySender.get(sender) ?? -Infinity)) lastBySender.set(sender, at);
    if (at > lastAny && at <= day) lastAny = at;
    if (at === day - 1) yesterday++;
    if (!item.read) unread++;
  }
  return { lastBySender, lastAny, yesterday, unread };
}

/** その人のふだんの雑談が、間隔に対してどれだけ待っているか（1以上で届けられる。大きいほど先）。 */
export function overdue(sender, history, day = state.day) {
  const gap = senderGapDays(sender);
  const last = history.lastBySender.get(sender);
  // まだ一度も届いていない相手は、間隔を過ぎたばかりの人より少し先
  return last == null || last === -Infinity ? 1.5 : (day - last) / gap;
}

/** 待っている度合い。大きいほど先に届く（決まり3）。ふだんの雑談は wait（overdue の値）で決まり、会った後の続きは追い越さない。 */
export const urgency = (cls, wait = 0) => cls === "react" ? 3 : cls === "timed" ? 2 : Math.min(2.9, wait);

/** 今朝、must のほかに届けてよい通数（決まり1）。 */
export const dayCap = (history) => history.yesterday >= LIME_PACING.softCap ? LIME_PACING.afterBusyCap : LIME_PACING.softCap;
