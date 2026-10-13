// Samechanのデートは、VN読了後に料金・行動・選択した成長を一緒に確定する。
import { DB } from "../core/data.js";
import { state, save, STAT_KEYS } from "../core/state.js";
import { addMoney, addStamina, gainStat, gainAffinity, bond } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";
import { dateVenue, dateScene, relationshipDayTotal } from "./date-scene.js";
import { playSamechanMilestone } from "./samechan-bonds.js";

let playing = false;
export function samechanDateReady() {
  const sc = DB.lover?.dates?.samechan;
  return !!state && (state.chapter || 1) >= 2 && (state.lovers || []).includes("samechan")
    && !!dateVenue("samechan") && !!sc?.choiceQ
    && ["arrive", "mid", "close"].every(key => !!sc[key]?.face && !!sc[key]?.text)
    && ["optA", "optB"].every(key => !!sc[key]?.text && !!sc[key]?.line && STAT_KEYS.includes(sc[key].stat));
}

/** 実デートで記録した章を使う。章情報のない旧日は最新の可能な過去日として扱い、永久停止を防ぐ。 */
export function samechanDateGap() {
  const day = state.lastDate.samechan;
  if (!Number.isInteger(day) || day < 1) return Infinity;
  const chapter = Number.isInteger(state.flags._samechan_last_date_chapter)
    ? state.flags._samechan_last_date_chapter : Math.max(1, (state.chapter || 1) - (day > state.day ? 1 : 0));
  return relationshipDayTotal() - ((chapter - 1) * 14 + day);
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
  if (state.money < cost || state.stamina <= 0) return no;
  const venue = dateVenue("samechan", old?.stamp === stamp ? old.venue : null);
  const choiceFlags = { a: `_samechan_date_${stamp}_a`, b: `_samechan_date_${stamp}_b` };
  const choice = state.flags[choiceFlags.a] ? "a" : state.flags[choiceFlags.b] ? "b" : null;
  const owner = state, previousPrivate = bond.private, startSlot = state.slot;
  playing = true; bond.private = true;
  try {
    if (invite) state.pendingInvite = invite; // 中断保存は予約あり・未払い。calendarは同じ場面へ戻れる。
    state.flags._samechan_date = { stamp, venue: venue.id, complete: false };
    save();
    await play(dateScene("samechan", venue, { choice, choiceFlags, growth: false }));
    if (state !== owner) return no;
    const selected = state.flags[choiceFlags.a] ? "optA" : state.flags[choiceFlags.b] ? "optB" : null;
    if (!selected) return no; // 未回答を選んだことにはしない。
    addMoney(-cost);
    const before = state.stamina; addStamina(-10); const spent = before - state.stamina;
    if (spent > 0) gainStat(DB.lover.dates.samechan[selected].stat, 2);
    gainAffinity("samechan", 10);
    state.lastDate.samechan = state.day;
    state.flags._samechan_last_date_chapter = state.chapter;
    if (advanceSlot) state.slot = Math.min(2, state.slot + 1);
    if (startSlot >= 1) { state.flags._private_night_day = state.day; state.flags._private_night_char = "samechan"; }
    if (invite) state.pendingInvite = null;
    state.flags._samechan_date.complete = true;
    save(); // 日付・支払・選択・成長・行動まで一緒に確定。後続の絆の中断でデートを失わない。
    bond.private = previousPrivate;
    await playSamechanMilestone();
    return { done: true, spent };
  } finally { bond.private = previousPrivate; playing = false; }
}
