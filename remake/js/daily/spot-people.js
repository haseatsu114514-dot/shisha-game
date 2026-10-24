import { ryujiAtMeltyPuff } from "../core/ryuji-visit.js";
// 地図の在店表示。来店と同じ判定を読み、報酬・既読・抽選状態は更新しない。
import { state } from "../core/state.js";
import { displayName } from "../core/data.js";
import { isUnlocked, isClosed } from "./spots.js";
import { rinUnavailable } from "./spot-hours.js";
import { hiyoriShopEncounterDue, hiyoriAtTonari } from "./hiyori.js";
import { hiyoriFirstMeetingReady } from "../core/axe-bar-discovery.js";
import { tsumugiAtTonari } from "./tsumugi-schedule.js";
import { cityGuestAtShop } from "./city-guests.js";
// 今後のゲストはここへ独立した登場条件を追加する。好感度の変化は表示側で起こさない。
const GUESTS = [
  { id: "kumicho", present: spot => spot.id === "ch2_ageha" && ryujiAtMeltyPuff(state) },
  { id: "tsumugi", present: spot => spot.id === "tonari" && tsumugiAtTonari(state) },
  { id: "hiyori", present: spot => {
    if (!hiyoriFirstMeetingReady(state)) return false;
    const invite = state.pendingInvite;
    const bookedToday = invite && (invite.sender === "hiyori" || invite.event === "hiyori_tonari_return")
      && (invite.day ?? state.day) === state.day;
    if (bookedToday) return invite.slot === state.slot && (invite.event === "hiyori_tonari_return" ? spot.id === "tonari"
      : invite.event === "__hiyori_shop__" && invite.visitSpot === spot.id);
    return spot.id === "tonari" ? hiyoriAtTonari() : hiyoriShopEncounterDue(spot);
  } },
];

/** ゲストの共通入口。名前は面識がある場合だけ返す。 */
export function spotPeople(spot) {
  if (!isUnlocked(spot) || isClosed(spot) || spot.unavailable) return [];
  const ids = [];
  if (spot.face && (spot.face !== "rin" || !rinUnavailable(state))) ids.push(spot.face);
  for (const guest of GUESTS) if (guest.present(spot)) ids.push(guest.id);
  const visiting = cityGuestAtShop(spot);
  if (visiting) ids.push(visiting.id);
  return [...new Set(ids)].map(id => {
    const known = id === "sumi" || !!state.met[id]
      || id === "tsumugi" && !!(state.flags._met_tsumugi || state.story.tsumugi > 0);
    return { id, known, role: id === spot.face ? "owner" : "guest", name: known ? displayName(id, state) : "見知らぬ客" };
  });
}
