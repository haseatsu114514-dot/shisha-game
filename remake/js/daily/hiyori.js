// 他店での相席 → スミさんへの報告 → 交流 → LIMEからtonariへ。
import { DB } from "../core/data.js";
import { state, save } from "../core/state.js";
import { seeded } from "../core/util.js";
import { gainAffinity, affinityLevel, releaseHiyoriAffinity, ensureAffinityLevel } from "../core/stats.js";
import { hiyoriRoute, hiyoriEventStatus, hiyoriHasContact } from "../core/hiyori-route.js";
import { play, isPlaying } from "../vn/engine.js";
import { afterStory, hiyoriQuestionReady, playHiyoriQuestion, finaleAtVisit, playFinale } from "./bonds.js";
import { on } from "../core/bus.js";
import { hiyoriAxeAffordable, playHiyoriAxeSequence } from "./hiyori-axe.js";
import { addMoney, addStamina } from "../core/stats.js";
import { maybeRecruitTrpgMember } from "./trpg.js";
import { allSpots, isClosed, isUnlocked, shortNormalVisit } from "./spots.js";
import { hiyoriFirstMeetingReady, axeBarRumorDue } from "../core/axe-bar-discovery.js";
import { playAxeBarRumor } from "./axe-bar-discovery.js";

let active = false;
let extraShopSource = () => [];
export function setHiyoriExtraShops(source) { extraShopSource = source; }

function ownedConversation(signal) {
  const owner = state, controller = new AbortController();
  const stop = () => controller.abort();
  const unsubscribe = on("hud", () => { if (state !== owner) stop(); });
  signal?.addEventListener("abort", stop, { once: true });
  if (signal?.aborted) stop();
  return { signal: controller.signal, close() { unsubscribe(); signal?.removeEventListener("abort", stop); stop(); } };
}

/** 実際に読み終えた後だけ進行を記録。同時呼び出し・再読で好感度を稼がない。 */
export async function playHiyoriEvent(id, options = {}) {
  if (options.signal?.aborted || active || isPlaying() || hiyoriEventStatus(id) !== "ready") return false;
  const event = hiyoriRoute().events.find((e) => e.id === id);
  if (id === "axe_reveal" && !hiyoriAxeAffordable()) return false;
  const owner = state;
  const lifetime = id === "work_talk" ? ownedConversation(options.signal) : null;
  active = true;
  try {
    if (id === "axe_reveal") {
      if (!await playHiyoriAxeSequence(event, options)) return false;
    } else {
      const result = await play(event.dialogue, { ...options, ...(lifetime ? { signal: lifetime.signal } : {}) });
      if (!result || result.cancelled) return false;
    }
    if (state !== owner || options.signal?.aborted || lifetime?.signal.aborted) return false;
    if (id === "axe_reveal") {
      // 前段・実プレイ・後段の読了と料金を同じ保存にする。中止は未払い。
      if (!hiyoriAxeAffordable()) return false;
      addMoney(-event.cost);
      addStamina(-event.staminaCost);
      state.slot = Math.min(2, state.slot + 1);
      state.flags._private_night_day = state.day;
      state.flags._private_night_char = "hiyori";
    }
    state.flags[event.flag] = true;
    if (id === "tonari_return") releaseHiyoriAffinity();
    if (hiyoriHasContact() && !state.contacts.includes("hiyori")) state.contacts.push("hiyori");
    if (hiyoriRoute().storyEvents.includes(id)) state.story.hiyori = (state.story.hiyori || 0) + 1;
    if (event.affinity) gainAffinity("hiyori", event.affinity);
    // 面識・読了と同じ確定境界。後続の勧誘待ちでLOADされても保証を取り残さない。
    if (id === "meeting") ensureAffinityLevel("hiyori", 1);
    await afterStory(event.dialogue, { signal: lifetime?.signal, deferSave: id === "work_talk" });
    if (state !== owner || options.signal?.aborted || lifetime?.signal.aborted) return false;
    await maybeRecruitTrpgMember("hiyori");
    if (state !== owner || options.signal?.aborted) return false;
    save();
    return true;
  } finally {
    lifetime?.close();
    active = false;
  }
}

/** 買い物だけでは会わない。実際に一服できる他店を滞在候補にする（ショールームは除外）。 */
export const hiyoriShopEligible = (spot) => !!spot && (spot.kind === "rival" || spot.kind === "samechan"
  || spot.id === "c_station");

// 同じ訪問をロードしても再抽選しない。店主・施設側の来店テーブルはそのまま使う。
function encounterRoll(spot) {
  const key = `hiyori:${state.chapter}:${state.day}:${state.slot}:${spot.id}`;
  let salt = 2166136261;
  for (const char of key) salt = Math.imul(salt ^ char.charCodeAt(0), 16777619) >>> 0;
  return seeded(state.seed, salt);
}

/** tonariの次の対面で実際にひより本人が登場する場合。スミさんへの伝言だけの日は除く。 */
export function hiyoriAtTonari() {
  if (["tonari_followup", "tonari_afterwork", "work_talk"].some(id => hiyoriEventStatus(id) === "ready")) return true;
  return hiyoriQuestionReady() || !!state.flags._hiyori_work_talk_done && finaleAtVisit("hiyori");
}

/** 時間帯ごとに一つの滞在先を選ぶ。既存のseedを使い、ロードや地図再描画で再抽選しない。 */
export function hiyoriShopLocation() {
  if (!hiyoriRoute().enabled || ![1, 2].includes(state.chapter) || state.slot > 1 || hiyoriAtTonari()) return null;
  if (state.pendingInvite && (state.pendingInvite.day ?? state.day) === state.day
    && (state.pendingInvite.sender === "hiyori" || state.pendingInvite.event === "hiyori_tonari_return")) return null;
  if (state.flags._hiyori_encounter_day === `${state.chapter}:${state.day}`) return null;
  const first = hiyoriEventStatus("meeting") === "ready";
  if (!first && !state.flags._hiyori_sumi_message_done) return null;
  const ready = first || hiyoriEventStatus("relay") === "ready" || hiyoriEventStatus("cracks") === "ready"
    || !!DB.dialogues[`hiyori_shop_repeat_${Number(state.flags._hiyori_repeat_count || 0) % 4}`]?.lines?.length;
  if (!ready) return null;
  const candidates = [...allSpots(), ...extraShopSource()].filter(spot => hiyoriShopEligible(spot) && isUnlocked(spot)
    && !isClosed(spot) && !spot.unavailable && state.visitedDay?.[spot.id] !== state.day)
    .map(spot => ({ id: spot.id, roll: encounterRoll(spot), quiet: shortNormalVisit(spot) }))
    .filter(spot => first || spot.roll < 0.2)
    .sort((a, b) => Number(b.quiet) - Number(a.quiet) || a.roll - b.roll || a.id.localeCompare(b.id));
  return candidates[0]?.id || null;
}

/** 地図も実来店も同じ予定を読む。報酬・既読・抽選状態は更新しない。 */
export const hiyoriShopEncounterDue = spot => !!spot && hiyoriShopLocation() === spot.id;

/** 既存の訪問に相席を添える。同じ日の多重遭遇・無料の買い物による好感度稼ぎを防ぐ。 */
export async function visitHiyoriAtShop(spot, { bg, scheduledSpot = hiyoriShopLocation(), signal = null } = {}) {
  // 来店中の面識・訪問済みの更新で、入店前に示した滞在先を再抽選しない。
  if (signal?.aborted || !hiyoriShopEligible(spot) || !scheduledSpot || scheduledSpot !== spot.id
    || state.flags._hiyori_encounter_day === `${state.chapter}:${state.day}`) return false;
  const owner = state;
  const stamp = `${state.chapter}:${state.day}`;
  const options = { bg, signal };
  if (hiyoriEventStatus("meeting") === "ready") {
    if (!await playHiyoriEvent("meeting", options)) return false;
    state.flags._hiyori_meeting_shop = spot.id;
  } else {
    // 次のスミさんとの会話を先に読む。好感度から伝言の既読を推測しない。
    if (!state.flags._hiyori_sumi_message_done || active || isPlaying()) return false;
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
        const result = await play(id, options);
        if (state !== owner || signal?.aborted || !result || result.cancelled) return false;
        state.flags._hiyori_repeat_count = n + 1;
        gainAffinity("hiyori", 10);
      } finally { active = false; }
    }
  }
  state.flags._hiyori_encounter_day = stamp;
  if (affinityLevel("hiyori") >= 3 && state.flags._hiyori_cracks_done) state.flags._hiyori_tonari_ready = true;
  await maybeRecruitTrpgMember("hiyori");
  if (state !== owner) return false;
  save();
  return true;
}

/** 返信で予約した店で既存の短い交流を読む。予約なしの確定出現は増やさない。 */
export async function playHiyoriHangout(options = {}) {
  if (!hiyoriFirstMeetingReady(state)) return false;
  const stamp = `${state.chapter}:${state.day}`;
  if (active || isPlaying() || state.flags._hiyori_encounter_day === stamp) return false;
  const n = Number(state.flags._hiyori_repeat_count || 0);
  // 約束して来た店では、偶然の相席ではなく約束の入りを読む（再会後の最初の一本）
  const promised = state.flags._hiyori_tonari_return_done && n % 4 === 0;
  const id = promised ? "hiyori_shop_repeat_0_promised" : `hiyori_shop_repeat_${n % 4}`;
  if (!DB.dialogues[id]?.lines?.length) return false;
  const owner = state;
  active = true;
  try {
    await play(id, options);
    if (state !== owner) return false;
    state.flags._hiyori_repeat_count = n + 1;
    state.flags._hiyori_encounter_day = stamp;
    gainAffinity("hiyori", 10);
    await maybeRecruitTrpgMember("hiyori");
    if (state !== owner) return false;
    save();
    return true;
  } finally { active = false; }
}

/** バイト・客席・スミさんとの会話、いずれも次の実際の対面で一度だけ進める。 */
export async function meetHiyoriAtTonari() {
  if (axeBarRumorDue(state)) return playAxeBarRumor();
  if (hiyoriEventStatus("sumi_message") === "ready") return playHiyoriEvent("sumi_message");
  if (hiyoriEventStatus("tonari_followup") === "ready") return playHiyoriEvent("tonari_followup");
  if (hiyoriEventStatus("tonari_afterwork") === "ready") return playHiyoriEvent("tonari_afterwork");
  if (hiyoriEventStatus("work_talk") === "ready") return playHiyoriEvent("work_talk");
  if (!active && !isPlaying() && hiyoriQuestionReady()) {
    const lifetime = ownedConversation(); active = true;
    try { if (await playHiyoriQuestion({ signal: lifetime.signal })) { await maybeRecruitTrpgMember("hiyori"); return true; } }
    finally { lifetime.close(); active = false; }
  }
  if (!active && !isPlaying() && finaleAtVisit("hiyori")) {
    const lifetime = ownedConversation(); active = true;
    try { const played = await playFinale("hiyori", { signal: lifetime.signal });
      if (played) await maybeRecruitTrpgMember("hiyori"); return played; }
    finally { lifetime.close(); active = false; }
  }
  return false;
}
