// 日付固定の予定と、休養で見送った夜の予定を分ける。台本・報酬は章側が実行する。
import { state, save } from "../core/state.js";
import { atChapterFinalDay } from "../core/chapter-clock.js";

export const restingToday = () => state.restDay?.chapter === state.chapter
  && state.restDay.day === state.day && state.restDay.fullDay;

const postponeable = (ev) => ev?.schedule === "regular" || ev?.schedule === "preparation";
const currentQueue = () => (state.deferredNightEvents || []).filter((entry) => entry.chapter === state.chapter);
const eventById = (events, id) => Object.values(events).find((ev) => ev.id === id);
const ready = (ev) => (ev.prerequisites || []).every((key) => state.flags[key]);

/** 保存された延期と当日の予定を照合。キューが無い旧セーブに過去の予定を推測して作らない。 */
export function syncNightQueue(events, { resting = restingToday() } = {}) {
  state.deferredNightEvents ||= [];
  state.deferredNightEvents = state.deferredNightEvents.filter((entry) => {
    if (entry.chapter !== state.chapter) return true;
    return !eventById(events, entry.id)?.done?.();
  });
  const visiting = new Set();
  function enqueue(day, ev, reason = "scheduled") {
    if (!postponeable(ev) || day > state.day || ev.done?.() || visiting.has(ev.id)) return;
    visiting.add(ev.id);
    for (const key of ev.prerequisites || []) {
      if (state.flags[key]) continue;
      const prerequisite = Object.entries(events).find(([, candidate]) => candidate.doneKeys?.includes(key));
      if (prerequisite) enqueue(Number(prerequisite[0]), prerequisite[1], "prerequisite");
    }
    let entry = currentQueue().find((item) => item.id === ev.id);
    if (!entry) {
      entry = { id: ev.id, chapter: state.chapter, originalDay: day, deferredOn: day - 1,
        reason, prerequisites: ev.prerequisites || [], doneKeys: ev.doneKeys || [] };
      state.deferredNightEvents.push(entry);
    }
    if (resting) { entry.deferredOn = state.day; entry.reason = "rest"; }
  }
  for (const [day, ev] of Object.entries(events)) {
    if (Number(day) === state.day) enqueue(Number(day), ev);
  }
  // 保存された後続予定にも、未読の先行条件を実際の会話で補う。
  for (const entry of currentQueue()) {
    const ev = eventById(events, entry.id);
    if (ev) enqueue(entry.originalDay, ev, entry.reason);
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
  if (atChapterFinalDay(state)) return [];
  const fixed = events[state.day];
  if (fixed && !postponeable(fixed)) return fixed.done?.() ? [] : [fixed];
  // 会話後〜翌朝の保存から再開しても、同じ夜の通常予定をもう1件実行しない。
  if (state.flags._night_event_day === `${state.chapter}:${state.day}`) return [];
  const bookedNight = state.flags._private_night_day === state.day
    || appointment && (appointment.day ?? state.day) === state.day && appointment.slot === 1;
  if (resting || bookedNight) return [];
  // 章が守る自由な夜（freeNights）には、後送りした予定を入れない。期限の救済だけは上で優先する。
  const next = pending.find(({ entry, ev }) => entry.deferredOn < state.day && ready(ev)
    && !(ev.freeNights || []).includes(state.day));
  return next ? [next.ev] : [];
}

/** 自由訪問だけの案内。runNightPlanと同じ実行順を読むが、キュー・既読・保存は更新しない。 */
export function fixedNightVisitBlock(events, spot) {
  if (spot?.id !== "tonari" || ![0, 1].includes(state.slot) || atChapterFinalDay(state)) return null;
  const plan = nightPlan(events).slice();
  const fixed = events[state.day];
  // 期限救済の準備が先でも、その後の固定回を見落とさない。
  if (fixed && !postponeable(fixed) && !fixed.done?.() && !plan.includes(fixed)) plan.push(fixed);
  const flags = new Set(Object.keys(state.flags).filter(key => state.flags[key]));
  for (const ev of plan) {
    if (ev.done?.()) continue;
    if (!(ev.prerequisites || []).every(key => flags.has(key))) break;
    const mandatory = !postponeable(ev) || ev.schedule === "preparation" && ev.deadline <= state.day;
    if (mandatory && ev.pin === spot.id) {
      // #1044 A08: 説明欄が通常の「一服／シフト」のままだと、何がいつ使えないか迷う。
      const homeRig = (state.owned || []).some(id => id === "home_rig_set" || id === "home_rig_pro");
      return {
        ok: false,
        why: "この後もtonariに行くから、今は別のところにしよう",
        tag: "この後、必須の予定あり",
        desc: `今夜はtonariで本編の予定${ev.label ? `「${ev.label}」` : ""}がある。それまで客としての一服・まかない練習・シフトには入れない。tonariの用事は、夜の予定がない日に回そう。${homeRig ? "配合の試作なら、寝る前の家シーシャでもできる。" : ""}`,
      };
    }
    for (const key of ev.doneKeys || []) flags.add(key);
  }
  return null;
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
    const context = await before(ev);
    await ev.run(context);
    state.flags._night_event_day = `${state.chapter}:${state.day}`;
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
