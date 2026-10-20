// シーシャークの出会い・第2章からの店。競技のライバル枠とは分ける。
import { DB, sceneBg } from "../core/data.js";
import { state, save, markMet, timeOfDay } from "../core/state.js";
import { setBg } from "../core/ui.js";
import { sharkSwim } from "../core/scene-motions.js";
import { gainAffinity, affinityLevel, releaseAffinity, earnStat, addMoney, addStamina } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";
import { finaleAtVisit, playFinale } from "./bonds.js";
import { maybeRecruitTrpgMember } from "./trpg.js";

export const SAMECHAN_NICKNAME_TOPIC = "lime_naru_samechan_nickname";
export const SAMECHAN_BOND_CHOICE = "bond_q1_samechan";
let visiting = false;

const entryEvents = [
  { dialogue: "samechan_shop_quiet_seat", flag: "_samechan_quiet_seat_done" },
  { dialogue: "samechan_shop_closing_check", flag: "_samechan_closing_check_done", night: true },
];

/** 旧訪問回数は既存会話にだけ使う。新しい交流と問いかけの既読を推測しない。 */
export function samechanVisitDialogue() {
  if (!state || (state.chapter || 1) < 2) return null;
  const count = state.story.samechan || 0;
  if (count === 0) return "samechan_shop_first";
  if (count >= 3) {
    for (const event of entryEvents) {
      if (state.flags[event.flag]) continue;
      if (event.night && state.slot < 1) break;
      return event.dialogue;
    }
    if (state.flags._samechan_closing_check_done && affinityLevel("samechan") >= 3
      && !state.romanceChoices?.[SAMECHAN_BOND_CHOICE] && !state.finales?.samechan
      && !state.flags._friend_samechan && !(state.lovers || []).includes("samechan")) {
      return "samechan_shop_bond_question";
    }
  }
  if (finaleAtVisit("samechan")) return "samechan_bond_finale";
  return `samechan_shop_repeat_${(count - 1) % 2}`;
}

// 中断セーブに実際の回答が残っていれば、その返事の続きを読む。回答を上書きしない。
function visitScript(id) {
  const answer = state.romanceChoices?.[SAMECHAN_BOND_CHOICE];
  if (id !== "samechan_shop_bond_question" || !answer) return id;
  const scene = DB.dialogues[id];
  if (!scene) return id;
  return { ...scene, lines: (scene.lines || []).flatMap(line => {
    if (line.type !== "choice" || line.id !== SAMECHAN_BOND_CHOICE) return [line];
    const choice = line.choices.find(c => (c.romance > 0) === (answer.value > 0));
    return scene.branches?.[choice.next] || [];
  }) };
}

/** 既存flags/contactsを使う。旧セーブの未読から名乗りを推測しない。 */
export function syncSamechanKnowledge() {
  if (!state) return;
  state.flags ||= {};
  state.contacts ||= [];
  state.met ||= {};
  // 交換したアカウントに書かれた通称は分かる。本名は後の名乗りまで伏せる。
  if (state.flags._lime_contact_samechan || state.contacts.includes("samechan")) state.flags._samechan_nickname_known = true;
  if ((state.limeRead || []).includes(SAMECHAN_NICKNAME_TOPIC)) state.flags._samechan_nickname_known = true;
  if (state.flags._samechan_nickname_known || state.flags._samechan_name_known) markMet("samechan");
  if (state.flags._lime_contact_samechan && !state.contacts.includes("samechan")) state.contacts.push("samechan");
  if (state.chapter >= 2 && state.flags._samechan_first_encounter) state.flags._shishark_opened = true;
}

/** 最初の候補はDAY8。忙しい夜や既に家にいる夜は、次の空いた帰り道へ持ち越す。 */
export function samechanEncounterDue({ hasNightEvent = false, hasAppointment = false, hadConfession = false, athome = false } = {}) {
  return !!state && state.phase === "daily" && state.chapter === 1 && state.day >= 8
    && !state.flags._samechan_first_encounter && !hasNightEvent && !hasAppointment && state.flags._private_night_day !== state.day && !hadConfession && !athome;
}

export async function maybeSamechanEncounter(context = {}) {
  if (!samechanEncounterDue(context) || !DB.dialogues.samechan_first_encounter) return false;
  await playSamechanEncounter();
  return true;
}

/** 出会いの場面。水が満ちてサメが横切る間に店先の絵へ替え、泡がはじけて会話へ */
export async function playSamechanEncounter() {
  const front = sceneBg(DB.dialogues.samechan_first_encounter.metadata?.bg, timeOfDay());
  await sharkSwim(async () => { if (front.url) await setBg(front.url, { tint: front.tint }); });
  await play("samechan_first_encounter");
  state.flags._samechan_first_encounter = true;
  state.flags._lime_contact_samechan = true;
  // アカウントの通称を知った後の名前・旧セーブも同じ処理で揃える。
  syncSamechanKnowledge();
  gainAffinity("samechan", 1); // 好きでも少し怖くても、手伝ってもらった親近感は同じ。
  save();
  return true;
}

export function samechanSpot() {
  if (!state || (state.chapter || 1) < (DB.samechan?.spot?.minChapter || 2)
    || !DB.samechan?.spot) return null;
  const spot = { ...DB.samechan.spot };
  return spot;
}

/** 章2のランタイムが接続された時の訪問。現在の章1では準備中で呼ばれない。 */
export async function visitSamechan(spot) {
  if (!spot || spot.id !== "shishark" || spot.unavailable || (state.chapter || 1) < 2
    || visiting || isPlaying()) return false;
  const stamp = `${state.chapter}:${state.day}:${state.slot}`;
  const receipt = state.flags._samechan_visit;
  const pending = receipt?.stamp === stamp && !!DB.dialogues[receipt.dialogue]?.lines?.length;
  // 同じ行動への再入では、料金・報酬を再処理せずcalendarに返す。
  if (pending && receipt.complete === true) return true;
  const count = state.story.samechan || 0;
  const dialogue = pending ? receipt.dialogue : samechanVisitDialogue();
  if (!DB.dialogues[dialogue]?.lines?.length) return false;
  const owner = state;
  visiting = true;
  try {
    if (!pending) {
      state.flags._samechan_visit = { stamp, dialogue, complete: false };
      save();
    }
    if (dialogue === "samechan_bond_finale") {
      if (!await playFinale("samechan", { deferSave: true })) return false;
    } else await play(visitScript(dialogue));
    if (state !== owner) return false;
    // 読了時に一度だけ確定。中断のセーブは未払いなので、残金が訪問料だけでも再開できる。
    addMoney(-(spot.cost || 0));
    addStamina(spot.stamina || 0);
    const event = entryEvents.find(e => e.dialogue === dialogue);
    if (event) state.flags[event.flag] = true;
    if (dialogue === "samechan_shop_bond_question") {
      state.flags._samechan_bond_question_done = true;
      releaseAffinity("samechan");
    }
    state.story.samechan = count + 1;
    gainAffinity("samechan", count === 0 ? 2 : 1);
    earnStat("insight", 4);
    syncSamechanKnowledge();
    await maybeRecruitTrpgMember("samechan");
    if (state !== owner) return false;
    state.flags._samechan_visit.complete = true;
    // calendarが行動・育成の確定後に保存する。支払済み／行動未消費の中間セーブを作らない。
    return true;
  } finally { visiting = false; }
}
