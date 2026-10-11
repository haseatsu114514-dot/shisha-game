// 他店での相席 → スミさんへの報告 → 交流 → LIMEからtonariへ。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { seeded } from "../core/util.js";
import { gainAffinity, affinityLevel } from "../core/stats.js";
import { hiyoriRoute, hiyoriEventStatus, hiyoriHasContact } from "../core/hiyori-route.js";
import { play, isPlaying } from "../vn/engine.js";
import { afterStory } from "./bonds.js";

let active = false;

/** 実際に読み終えた後だけ進行を記録。同時呼び出し・再読で好感度を稼がない。 */
export async function playHiyoriEvent(id, options = {}) {
  if (active || isPlaying() || hiyoriEventStatus(id) !== "ready") return false;
  const event = hiyoriRoute().events.find((e) => e.id === id);
  const owner = state;
  active = true;
  try {
    await play(event.dialogue, options);
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

/** 買い物だけでは会わない。実際に一服する他店なら、初対面の店は固定しない。 */
export const hiyoriShopEligible = (spot) => !!spot && (spot.kind === "rival" || spot.kind === "kafuka"
  || spot.kind === "shop" || spot.id === "c_station");

// 同じ訪問をロードしても再抽選しない。店主・施設側の来店テーブルはそのまま使う。
function encounterRoll(spot) {
  const key = `hiyori:${state.chapter}:${state.day}:${state.slot}:${spot.id}`;
  let salt = 2166136261;
  for (const char of key) salt = Math.imul(salt ^ char.charCodeAt(0), 16777619) >>> 0;
  return seeded(state.seed, salt);
}

/** 既存の訪問に相席を添える。同じ日の多重遭遇・無料の買い物による好感度稼ぎを防ぐ。 */
export async function visitHiyoriAtShop(spot, { bg } = {}) {
  if (!hiyoriShopEligible(spot) || !hiyoriRoute().enabled || ![1, 2].includes(state.chapter)) return false;
  const stamp = `${state.chapter}:${state.day}`;
  if (state.flags._hiyori_encounter_day === stamp) return false;
  const options = { bg };
  if (hiyoriEventStatus("meeting") === "ready") {
    if (!await playHiyoriEvent("meeting", options)) return false;
    state.flags._hiyori_meeting_shop = spot.id;
  } else {
    // 次のスミさんとの会話を先に読む。好感度から伝言の既読を推測しない。
    if (!state.flags._hiyori_sumi_message_done || active || isPlaying()) return false;
    if (encounterRoll(spot) >= 0.2) return false;
    if (hiyoriEventStatus("relay") === "ready") {
      if (!await playHiyoriEvent("relay", options)) return false;
    } else if (hiyoriEventStatus("cracks") === "ready") {
      if (!await playHiyoriEvent("cracks", options)) return false;
    } else {
      const n = Number(state.flags._hiyori_repeat_count || 0);
      const id = `hiyori_shop_repeat_${n % 4}`;
      if (!DB.dialogues[id]?.lines?.length) return false;
      const owner = state;
      active = true;
      try {
        await play(id, options);
        if (state !== owner) return false;
        state.flags._hiyori_repeat_count = n + 1;
        gainAffinity("hiyori", 10);
      } finally { active = false; }
    }
  }
  state.flags._hiyori_encounter_day = stamp;
  if (affinityLevel("hiyori") >= 3 && state.flags._hiyori_cracks_done) state.flags._hiyori_tonari_ready = true;
  save();
  return true;
}

/** バイト・客席・スミさんとの会話、いずれも次の実際の対面で一度だけ進める。 */
export async function meetHiyoriAtTonari() {
  if (hiyoriEventStatus("sumi_message") === "ready") return playHiyoriEvent("sumi_message");
  if (hiyoriEventStatus("tonari_followup") === "ready") return playHiyoriEvent("tonari_followup");
  if (hiyoriEventStatus("tonari_afterwork") === "ready") return playHiyoriEvent("tonari_afterwork");
  return false;
}
