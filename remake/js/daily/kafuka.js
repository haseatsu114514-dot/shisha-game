// シーシャークの出会い・準備中の店。競技のライバル枠とは分ける。
import { DB } from "../core/data.js";
import { state, save, markMet } from "../core/state.js";
import { gainAffinity, gainStat, addMoney, addStamina } from "../core/stats.js";
import { play } from "../vn/engine.js";

export const KAFUKA_NICKNAME_TOPIC = "lime_naru_kafuka_nickname";

/** 既存flags/contactsを使う。旧セーブの未読から名乗りを推測しない。 */
export function syncKafukaKnowledge() {
  if (!state) return;
  state.flags ||= {};
  state.contacts ||= [];
  state.met ||= {};
  if ((state.limeRead || []).includes(KAFUKA_NICKNAME_TOPIC)) state.flags._kafuka_nickname_known = true;
  if (state.flags._kafuka_nickname_known || state.flags._kafuka_name_known) markMet("kafuka");
  if (state.flags._lime_contact_kafuka && !state.contacts.includes("kafuka")) state.contacts.push("kafuka");
  if (state.chapter >= 2 && state.flags._kafuka_first_encounter) state.flags._shishark_opened = true;
}

/** 最初の候補はDAY8。忙しい夜や既に家にいる夜は、次の空いた帰り道へ持ち越す。 */
export function kafukaEncounterDue({ hasNightEvent = false, hasAppointment = false, hadConfession = false, athome = false } = {}) {
  return !!state && state.phase === "daily" && state.chapter === 1 && state.day >= 8
    && !state.flags._kafuka_first_encounter && !hasNightEvent && !hasAppointment && state.flags._private_night_day !== state.day && !hadConfession && !athome;
}

export async function maybeKafukaEncounter(context = {}) {
  if (!kafukaEncounterDue(context) || !DB.dialogues.kafuka_first_encounter) return false;
  await play("kafuka_first_encounter");
  state.flags._kafuka_first_encounter = true;
  state.flags._lime_contact_kafuka = true;
  // 名前はまだ？？？。連絡先交換だけでは名乗りを受けた扱いにしない。
  syncKafukaKnowledge();
  gainAffinity("kafuka", 1); // 好きでも少し怖くても、手伝ってもらった親近感は同じ。
  save();
  return true;
}

export function kafukaSpot() {
  if (!state || !(state.contacts?.includes("kafuka") || state.flags?._lime_contact_kafuka) || !DB.kafuka?.spot) return null;
  const spot = { ...DB.kafuka.spot };
  if ((state.chapter || 1) < spot.minChapter) {
    Object.assign(spot, { sub: "開店準備中", unknownSub: "開店準備中", desc: "シーシャークはまだ開店準備中。第2章から訪ねられる。",
      unknownDesc: "シーシャークはまだ開店準備中。第2章から訪ねられる。", cost: 0, stamina: 0, unavailable: "開店準備中", unavailableTag: "第2章から", preview: "bg_shishark_preparing_night", bg: "bg_shishark_preparing_night" });
  }
  return spot;
}

/** 章2のランタイムが接続された時の訪問。現在の章1では準備中で呼ばれない。 */
export async function visitKafuka(spot) {
  if (!spot || spot.unavailable || (state.chapter || 1) < 2) return false;
  const count = state.story.kafuka || 0;
  const dialogue = count === 0 ? "kafuka_shop_first" : `kafuka_shop_repeat_${(count - 1) % 2}`;
  if (!DB.dialogues[dialogue]) return false;
  addMoney(-(spot.cost || 0));
  addStamina(spot.stamina || 0);
  await play(dialogue);
  state.story.kafuka = count + 1;
  gainAffinity("kafuka", count === 0 ? 2 : 1);
  gainStat("insight", 1);
  syncKafukaKnowledge();
  return true;
}
