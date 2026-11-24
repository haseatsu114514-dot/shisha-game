// Samechanのデートは、VN読了後に料金・行動・選択した成長を一緒に確定する。
import { DB } from "../core/data.js";
import { state, save, STAT_KEYS } from "../core/state.js";
import { addMoney, addStamina, earnStat, gainAffinity, paidAction, prepareLoveAffinity, privateBondScope } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";
import { dateVenue, dateScene, relationshipDayTotal, relationshipDayOf, dateTopic, advanceDateTopic } from "./date-scene.js";
import { playSamechanMilestone } from "./samechan-bonds.js";
import { invitationGrowth } from "./invitations.js";
import { petitAfterDate } from "./petit-shuraba.js";

let playing = false;
export function samechanDateReady() {
  const sc = DB.lover?.dates?.samechan;
  return !!state && (state.chapter || 1) >= 2 && (state.lovers || []).includes("samechan")
    && !!dateVenue("samechan") && !!sc?.choiceQ
    && ["arrive", "mid", "close"].every(key => !!sc[key]?.face && !!sc[key]?.text)
    && ["optA", "optB"].every(key => !!sc[key]?.text && !!sc[key]?.line && STAT_KEYS.includes(sc[key].stat));
}

/** 実デートで記録した章を使う。章情報のない旧日は最新の可能な過去日として扱い、永久停止を防ぐ。
 * 通算日の保存（第2章から。_elapsed_calendar）は lastDate も通算日なので、章の14日を足さずにそのまま引く。 */
export function samechanDateGap() {
  const day = state.lastDate.samechan;
  if (!Number.isInteger(day) || day < 1) return Infinity;
  const chapter = Number.isInteger(state.flags._samechan_last_date_chapter)
    ? state.flags._samechan_last_date_chapter : Math.max(1, (state.chapter || 1) - (day > state.day ? 1 : 0));
  return relationshipDayTotal() - relationshipDayOf(day, chapter);
}

/** inviteなしは共通playDateの実モジュール検証口。通常ゲームはcalendarからinvite/costを渡す。 */
export async function playSamechanDate({ invite = null, cost = 0, advanceSlot = false } = {}) {
  const no = { done: false, spent: 0 };
  if (!samechanDateReady() || playing || isPlaying()
    || invite && (invite.event !== "date_samechan" || invite.sender !== "samechan" || (invite.day ?? state.day) !== state.day)) return no;
  const stamp = `${state.chapter}:${invite?.day ?? state.day}:${invite?.slot ?? state.slot}`;
  const old = state.flags._samechan_date;
  if (old?.stamp === stamp && old.complete) {
    if (invite) { state.pendingInvite = null; save(); }
    return { done: true, spent: 0 }; // 同じ読了を料金や報酬へ再換算しない。
  }
  if (state.money < cost) return no;
  const venue = dateVenue("samechan", old?.stamp === stamp ? old.venue : null);
  const choiceFlags = { a: `_samechan_date_${stamp}_a`, b: `_samechan_date_${stamp}_b` };
  const choice = state.flags[choiceFlags.a] ? "a" : state.flags[choiceFlags.b] ? "b" : null;
  const owner = state, startDay = state.day, startSlot = state.slot;
  playing = true;
  let restorePrivate;
  try {
    await prepareLoveAffinity(["samechan"]);
    if (state !== owner || state.day !== startDay || state.slot !== startSlot || !samechanDateReady() || isPlaying()) return no;
    restorePrivate = privateBondScope();
    if (invite) state.pendingInvite = invite; // 中断保存は予約あり・未払い。calendarは同じ場面へ戻れる。
    state.flags._samechan_date = { stamp, venue: venue.id, complete: false };
    save();
    const { value: done, spent } = await paidAction(async () => {
      const result = await play(dateScene("samechan", venue, { choice, choiceFlags, growth: false }), { growthScene: true });
      if (state !== owner || !result || result.cancelled) return false;
      const selected = state.flags[choiceFlags.a] ? "optA" : state.flags[choiceFlags.b] ? "optB" : null;
      if (!selected) return false;
      addMoney(-cost);
      addStamina(-10);
      earnStat(dateTopic("samechan")[selected].stat, 2);
      gainAffinity("samechan", 10);
      return true;
    }, { ...invitationGrowth("date_samechan"), exp: { key: "samechan", person: "samechan", bond: true } });
    if (!done || state !== owner) return no;
    advanceDateTopic("samechan"); // 次のデートは次の話題（#4030）。読み終えた時だけ
    state.lastDate.samechan = state.day;
    state.flags._samechan_last_date_chapter = state.chapter;
    if (advanceSlot) state.slot = Math.min(2, state.slot + 1);
    if (startSlot >= 1) { state.flags._private_night_day = state.day; state.flags._private_night_char = "samechan"; }
    if (invite) state.pendingInvite = null;
    state.flags._samechan_date.complete = true;
    save(); // 日付・支払・選択・成長・行動まで一緒に確定。後続の絆の中断でデートを失わない。
    restorePrivate();
    await petitAfterDate("samechan"); // プチ修羅場（恋人が2人以上・一度きり）。デートは確定済みで、報酬は無い
    if (state === owner) await playSamechanMilestone();
    return { done: true, spent };
  } finally { restorePrivate?.(); playing = false; }
}
