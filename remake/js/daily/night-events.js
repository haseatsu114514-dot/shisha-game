// 日付固定の予定と、休養で見送った夜の予定を分ける。台本・報酬は章側が実行する。
import { state, save } from "../core/state.js";
import { TOURNAMENT_DAY } from "../core/rules.js";

export const restingToday = () => state.restDay?.chapter === state.chapter
  && state.restDay.day === state.day && state.restDay.fullDay;

const postponeable = (ev) => ev?.schedule === "regular" || ev?.schedule === "preparation";
const currentQueue = () => (state.deferredNightEvents || []).filter((entry) => entry.chapter === state.chapter);
const eventById = (events, id) => Object.values(events).find((ev) => ev.id === id);
const ready = (ev) => (ev.prerequisites || []).every((key) => state.flags[key]);

/** 旧セーブの未読も読了フラグで照合する。日付だけで完了にせず、別章の待機分は保持する。 */
export function syncNightQueue(events, { resting = restingToday() } = {}) {
  state.deferredNightEvents ||= [];
  state.deferredNightEvents = state.deferredNightEvents.filter((entry) => {
    if (entry.chapter !== state.chapter) return true;
    return !eventById(events, entry.id)?.done?.();
  });
  for (const [day, ev] of Object.entries(events)) {
    if (!postponeable(ev) || Number(day) > state.day || ev.done?.()) continue;
    let entry = currentQueue().find((item) => item.id === ev.id);
    if (!entry) {
      entry = { id: ev.id, chapter: state.chapter, originalDay: Number(day), deferredOn: Number(day) - 1,
        reason: Number(day) < state.day ? "unread-save" : "scheduled", prerequisites: ev.prerequisites || [], doneKeys: ev.doneKeys || [] };
      state.deferredNightEvents.push(entry);
    }
    if (resting) { entry.deferredOn = state.day; entry.reason = "rest"; }
  }
}

/** 最も早い成立可能な夜に1件。期限を迎えた準備だけは休養・約束より先に救済する。 */
export function nightPlan(events, { resting = restingToday(), appointment = state.pendingInvite } = {}) {
  const pending = currentQueue().map((entry) => ({ entry, ev: eventById(events, entry.id) }))
    .filter(({ ev }) => ev && !ev.done?.())
    .sort((a, b) => a.entry.originalDay - b.entry.originalDay);
  const urgent = pending.filter(({ ev }) => ev.schedule === "preparation" && ev.deadline <= state.day);
  // 旧セーブで複数の期限が過ぎていた場合も、先行準備の実読了後に後続を実行する。
  if (urgent.length) return urgent.map(({ ev }) => ev);
  if (state.day >= TOURNAMENT_DAY) return [];
  const fixed = events[state.day];
  if (fixed && !postponeable(fixed) && !fixed.done?.()) return [fixed];
  const bookedNight = appointment && (appointment.day ?? state.day) === state.day && appointment.slot === 1;
  if (resting || bookedNight) return [];
  const next = pending.find(({ entry, ev }) => entry.deferredOn < state.day && ready(ev));
  return next ? [next.ev] : [];
}

export function nightOccupied(events, day) {
  if (day !== state.day) return !!events[day] && !events[day].done?.();
  // 受諾済みの約束がある夜は通常の延期候補を実行しない。新規受諾前は予定を予約する。
  return nightPlan(events).length > 0;
}

/** 完了は章のrunが成功してから。固定イベントの前提を救済する場合にも同じ実行経路を使う。 */
export async function runNightPlan(events, before = async () => {}) {
  const plan = nightPlan(events);
  const fixed = events[state.day];
  if (fixed && !postponeable(fixed) && !fixed.done?.() && !plan.includes(fixed)) plan.push(fixed);
  let count = 0;
  for (const ev of plan) {
    if (ev.done?.()) continue;
    if (!ready(ev)) throw new Error(`Night event prerequisites missing: ${ev.id}`);
    await before(ev);
    await ev.run();
    count++;
    syncNightQueue(events, { resting: false });
    save();
  }
  return count;
}

/** 大会前に必要な準備は含めない。大会後の通常会話を元の日付・因果関係順に補完する。 */
export async function finishDeferredNights(events, before = async () => {}) {
  syncNightQueue(events, { resting: false });
  for (const entry of currentQueue().sort((a, b) => a.originalDay - b.originalDay)) {
    const ev = eventById(events, entry.id);
    if (!ev || ev.done?.()) continue;
    if (ev.schedule !== "regular" || !ready(ev)) throw new Error(`Unfinished tournament preparation: ${entry.id}`);
    await before(ev);
    await ev.run();
    syncNightQueue(events, { resting: false });
    save();
  }
}
