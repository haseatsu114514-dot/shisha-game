// 読了・面識・好感度から、ひよりの各段階への接続条件を判定。
// 保存先は既存の flags / story / affinity / romanceChoices / finales / lovers。
import { DB } from "./data.js";
import { state } from "./state.js";
import { affinityLevel } from "./stats.js";
import { hiyoriFirstMeetingReady } from "./axe-bar-discovery.js";

export const hiyoriRoute = () => DB.hiyori?.route || {};
export const hiyoriHasContact = () => !!state && (state.contacts.includes("hiyori") || !!state.flags._lime_contact_hiyori);
export const hiyoriIsFriend = () => !!state && !state.lovers.includes("hiyori") && !!state.finales.hiyori
  && (state.finales.hiyori.route === "friend" || !!state.flags._friend_hiyori);

/** 読んだイベントだけから判定。好感度・訪問回数では正体発覚を推測しない。 */
export function hiyoriStoriesDone() {
  const route = hiyoriRoute();
  return !!state && !!route.storyEvents?.length && route.storyEvents.every((id) => {
    const event = route.events?.find((e) => e.id === id);
    return !!event?.flag && !!state.flags[event.flag];
  });
}

/** disabled / missing_script / seen / chapter / time / prerequisites / relationship / ready */
export function hiyoriEventStatus(id) {
  const route = hiyoriRoute();
  const event = route.events?.find((e) => e.id === id);
  if (!state || !route.enabled || !event) return "disabled";
  const dialogue = DB.dialogues[event.dialogue];
  const scripts = [dialogue, ...(event.outro ? [DB.dialogues[event.outro]] : [])];
  if (scripts.some(script => !script?.lines?.length || script.metadata?.preview_only)) return "missing_script";
  if (state.flags[event.flag]) return "seen";
  if (!event.chapters.includes(state.chapter)) return "chapter";
  if (id === "meeting" && !hiyoriFirstMeetingReady(state)) return "prerequisites";
  if (event.slot !== undefined && state.slot !== event.slot) return "time";
  if (event.requires.some((flag) => !state.flags[flag]) || event.met && !state.met.hiyori
    || event.contact && !hiyoriHasContact() || affinityLevel("hiyori") < (event.minAffinity || 0)) return "prerequisites";
  if (event.relationship === "lover" && !state.lovers.includes("hiyori")
    || event.relationship === "friend" && !hiyoriIsFriend()
    || (state.loveLevel.hiyori || 0) < (event.minLoveLevel || 0)) return "relationship";
  return "ready";
}

export const availableHiyoriEvents = () => (hiyoriRoute().events || []).filter((e) => hiyoriEventStatus(e.id) === "ready");

/**
 * 露出判定用: 時間帯（slot）と費用を除く前提だけを見る（hiyoriEventStatus の time 判定を外したもの）。
 * 既読（seen）は「これから前提を満たす」対象ではないので false。前提そのものは変えない。
 */
export function hiyoriEventPrereqsMet(id) {
  const route = hiyoriRoute();
  const event = route.events?.find((e) => e.id === id);
  if (!state || !route.enabled || !event) return false;
  const dialogue = DB.dialogues[event.dialogue];
  const scripts = [dialogue, ...(event.outro ? [DB.dialogues[event.outro]] : [])];
  if (scripts.some((script) => !script?.lines?.length || script.metadata?.preview_only)) return false;
  if (state.flags[event.flag]) return false;
  if (!event.chapters.includes(state.chapter)) return false;
  if (id === "meeting" && !hiyoriFirstMeetingReady(state)) return false;
  if (event.requires.some((flag) => !state.flags[flag]) || event.met && !state.met.hiyori
    || event.contact && !hiyoriHasContact() || affinityLevel("hiyori") < (event.minAffinity || 0)) return false;
  if (event.relationship === "lover" && !state.lovers.includes("hiyori")
    || event.relationship === "friend" && !hiyoriIsFriend()
    || (state.loveLevel.hiyori || 0) < (event.minLoveLevel || 0)) return false;
  return true;
}

/** 専用ハガルと正式な締めくくりを揃えるまで、既存の恋愛／友人ルートを起動しない。 */
export function hiyoriFinaleReady() {
  const { finale, question } = hiyoriRoute();
  return !!hiyoriRoute().enabled && hiyoriStoriesDone() && state.chapter <= 3 && !!state.met.hiyori
    && !!DB.dialogues[question?.dialogue]?.lines?.length && !DB.dialogues[question?.dialogue]?.metadata?.preview_only
    && state.romanceChoices[question?.choice]?.char === "hiyori"
    && Number.isFinite(state.romanceChoices[question?.choice]?.value) && state.romanceChoices[question.choice].value >= 0
    && !!state.flags[question?.flag]
    && !!finale?.gift && !!DB.equipById[finale.gift] && !!DB.dialogues[finale.dialogue]?.lines?.length
    && !DB.dialogues[finale.dialogue].metadata?.preview_only;
}
