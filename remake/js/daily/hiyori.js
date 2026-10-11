// 確定した登場処理から明示的に呼ぶ。現段階ではカレンダーやtonariに自動挿入しない。
import { state, save } from "../core/state.js";
import { gainAffinity } from "../core/stats.js";
import { hiyoriRoute, hiyoriEventStatus, hiyoriHasContact } from "../core/hiyori-route.js";
import { play, isPlaying } from "../vn/engine.js";
import { afterStory } from "./bonds.js";

let active = false;

/** 実際に読み終えた後だけ進行を記録。同時呼び出し・再読で好感度を稼がない。 */
export async function playHiyoriEvent(id) {
  if (active || isPlaying() || hiyoriEventStatus(id) !== "ready") return false;
  const event = hiyoriRoute().events.find((e) => e.id === id);
  const owner = state;
  active = true;
  try {
    await play(event.dialogue);
    if (state !== owner) return false;
    state.flags[event.flag] = true;
    if (hiyoriHasContact() && !state.contacts.includes("hiyori")) state.contacts.push("hiyori");
    if (hiyoriRoute().storyEvents.includes(id)) state.story.hiyori = (state.story.hiyori || 0) + 1;
    if (event.affinity) gainAffinity("hiyori", event.affinity);
    await afterStory(event.dialogue);
    if (state !== owner) return false;
    save();
    return true;
  } finally {
    active = false;
  }
}
