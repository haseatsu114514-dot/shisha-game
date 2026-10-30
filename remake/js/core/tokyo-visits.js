// 訪問の正本。人物の常住地・恋愛・能力・旧pendingInviteは変更しない。
import { TOKYO_FREE_TIMES, tokyoTime, timeNumber } from "./tokyo-clock.js";

import { emptyTokyoVisits } from "./state.js";
export const tokyoVisitState = value => value.tokyoVisits ||= emptyTokyoVisits();

export function playerRegion(value) {
  if (value.chapter !== 3) return value.chapter < 3 ? "home" : "unknown";
  // 後日談の帰郷の夜（版3は煙幕の片づけの次、版1・2は三場面目）からは地元。
  const aftermath = value.flags?._ch3_aftermath;
  const homeStage = aftermath?.version >= 3 ? 4 : 3;
  return value.flags?._ch3_cleared || (aftermath?.stage ?? -1) >= homeStage ? "home" : "tokyo";
}

export function visitContacts(value, definitions) {
  return Object.keys(definitions.characters).filter(id => (value.lovers || []).includes(id)
    && (value.contacts || []).includes(id));
}
export function characterRegion(value, definitions, id) {
  const plan = value.tokyoVisits?.plans.find(plan => plan.characterId === id
    && ["arrived", "staying"].includes(plan.status) && value.day >= plan.arrivalDay && value.day < plan.returnDay);
  return plan ? "tokyo" : definitions.characters[id]?.home || "unknown";
}

/** 時計・地域変更時に必ず呼ぶ。未合流でも帰郷し、未読通知を所在条件にしない。 */
export function syncTokyoVisits(value) {
  const visits = tokyoVisitState(value);
  for (const plan of visits.plans) {
    if (plan.status === "returned") continue;
    if (playerRegion(value) !== "tokyo" || value.day >= plan.returnDay) {
      plan.status = "returned";
      plan.returnReason = playerRegion(value) === "home" ? "player_home" : "schedule";
    } else if (value.day >= plan.arrivalDay && plan.status === "booked") plan.status = "arrived";
  }
  return visits;
}

function windowAvailable(value, window) {
  const pending = value.pendingInvite;
  return !(value.tokyoVisits?.closedSlots || []).includes(window.id)
    && timeNumber(window) >= timeNumber(value)
    && !(pending && pending.day === window.day && pending.slot === window.slot);
}

/** 合流とデートは別の一行動。通常訪問は滞在期間全体が同時一人まで。 */
export function proposeTokyoVisit(value, definitions, id) {
  const character = definitions.characters[id];
  if (playerRegion(value) !== "tokyo" || !value.flags?._ch3_intro || value.phase === "tournament"
    || value.flags._ch3_aftermath || !visitContacts(value, definitions).includes(id)
    || !character || value.chapter < character.dateMinChapter) return null;
  const visits = syncTokyoVisits(value);
  if (visits.plans.some(plan => plan.characterId === id && plan.status !== "returned")) return null;
  const windows = TOKYO_FREE_TIMES.map(window => tokyoTime(value, window)).filter(window => windowAvailable(value, window));
  for (const meetup of windows) {
    if (meetup.day < value.day + definitions.leadDays) continue;
    const returnDay = meetup.day + definitions.stayDays;
    if (visits.plans.some(plan => plan.status !== "returned"
      && meetup.day < plan.returnDay && plan.arrivalDay < returnDay)) continue;
    const date = windows.find(window => timeNumber(window) > timeNumber(meetup) && window.day < returnDay);
    if (!date) continue;
    return { characterId: id, arrivalDay: meetup.day, returnDay, meetup: { id: meetup.id, day: meetup.day, slot: meetup.slot },
      date: { id: date.id, day: date.day, slot: date.slot } };
  }
  return null;
}

/** 承諾直前にも再計算。古い提案・二重クリックで予約を上書きしない。 */
export function bookTokyoVisit(value, definitions, proposal) {
  const current = proposal && proposeTokyoVisit(value, definitions, proposal.characterId);
  if (!current || JSON.stringify(current) !== JSON.stringify(proposal)) return false;
  const visits = tokyoVisitState(value);
  visits.plans.push({ ...structuredClone(current), id: `tokyo.${current.characterId}.${current.arrivalDay}`,
    status: "booked", met: false, dateDone: false });
  delete visits.offers[proposal.characterId];
  return true;
}

export function dueTokyoVisit(value, window) {
  syncTokyoVisits(value);
  return value.tokyoVisits.plans.find(plan => plan.status !== "returned"
    && ((!plan.met && plan.meetup.id === window.id && timeNumber(plan.meetup) === timeNumber(window))
      || (plan.met && !plan.dateDone && plan.date.id === window.id && timeNumber(plan.date) === timeNumber(window)))) || null;
}

/** 正常完読後のみ確定。取消・中断は未実施のまま。 */
export function completeTokyoVisitAction(value, definitions, planId, window) {
  const plan = dueTokyoVisit(value, window);
  if (!plan || plan.id !== planId || (plan.met && value.flags?._story_shuraba_unresolved) || !visitContacts(value, definitions).includes(plan.characterId)
    || characterRegion(value, definitions, plan.characterId) !== "tokyo"
    || timeNumber(value) !== timeNumber(window)) return false;
  if (!plan.met) { plan.met = true; plan.status = "staying"; }
  else plan.dateDone = true;
  return true;
}

