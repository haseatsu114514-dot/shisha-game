import { growthLesson } from "../core/growth-effects.js";
import { canRunChapterThreeAftermath } from "./ch3-aftermath-progress.js";

// 大会翌日の和解を読み終えた夜だけ。帰郷済みの旧セーブを東京へ戻さない。
export function chapterThreePartyWindow(value) {
  const progress = value?.flags?._ch3_aftermath;
  return canRunChapterThreeAftermath(value) && progress?.version === 3 && progress.stage === 2
    && value.phase === "aftermath" && value.day === progress.winDay + 1 && value.slot === 1
    && value.flags._ch3_naru_party_ready === true && !value.flags._ch3_pizza_party
    && growthLesson(value, "M-S5")
    && !(value.pendingInvite?.day === value.day && value.pendingInvite?.slot === value.slot);
}

// この夜まで東京にいる店主・大会参加者。地元の仲間は実際の滞在・合流記録が必要。
const LOCALS = ["mashiro", "kuze", "volk"];
const VISITORS = ["tsumugi", "minto", "rin", "samechan", "hiyori", "ageha"];
export function chapterThreePartyGuests(value) {
  if (!chapterThreePartyWindow(value)) return [];
  const last = Array.isArray(value.growth?.partyLast) ? value.growth.partyLast : [];
  return [...LOCALS, ...VISITORS.filter(id => value.tokyoVisits?.plans?.some(plan =>
    plan.characterId === id && plan.met && ["arrived", "staying"].includes(plan.status)
    && plan.arrivalDay <= value.day && value.day < plan.returnDay
    && !(plan.date?.day === value.day && plan.date?.slot === value.slot && !plan.dateDone))) ]
    .filter(id => value.met?.[id] && !last.includes(id));
}

export const PARTY_AFFINITY = 10; // 仮値。通常の交流と同じ好感度の補正・上限を使う。
export function completeChapterThreeParty(value, guests, award) {
  const eligible = chapterThreePartyGuests(value);
  if (!Array.isArray(guests) || guests.length < 2 || guests.length > 3
    || new Set(guests).size !== guests.length || !guests.every(id => eligible.includes(id))) return false;
  value.flags._ch3_pizza_party = { day: value.day, guests: [...guests] };
  value.growth.partyLast = [...guests];
  for (const id of guests) award(id, PARTY_AFFINITY);
  return true;
}
