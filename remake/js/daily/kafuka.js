// シーシャークの出会い・第2章からの店。競技のライバル枠とは分ける。
import { DB, sceneBg } from "../core/data.js";
import { state, save, markMet, timeOfDay } from "../core/state.js";
import { setBg } from "../core/ui.js";
import { sharkSwim } from "../core/scene-motions.js";
import { gainAffinity, affinityLevel, releaseAffinity, earnStat, addMoney, addStamina } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";

export const KAFUKA_NICKNAME_TOPIC = "lime_naru_kafuka_nickname";
export const KAFUKA_BOND_CHOICE = "bond_q1_kafuka";
let visiting = false;

const entryEvents = [
  { dialogue: "kafuka_shop_quiet_seat", flag: "_kafuka_quiet_seat_done" },
  { dialogue: "kafuka_shop_closing_check", flag: "_kafuka_closing_check_done", night: true },
];

/** 旧訪問回数は既存会話にだけ使う。新しい交流と問いかけの既読を推測しない。 */
export function kafukaVisitDialogue() {
  if (!state || (state.chapter || 1) < 2) return null;
  const count = state.story.kafuka || 0;
  if (count === 0) return "kafuka_shop_first";
  if (count >= 3) {
    for (const event of entryEvents) {
      if (state.flags[event.flag]) continue;
      if (event.night && state.slot < 1) break;
      return event.dialogue;
    }
    if (state.flags._kafuka_closing_check_done && affinityLevel("kafuka") >= 3
      && !state.romanceChoices?.[KAFUKA_BOND_CHOICE] && !state.finales?.kafuka
      && !state.flags._friend_kafuka && !(state.lovers || []).includes("kafuka")) {
      return "kafuka_shop_bond_question";
    }
  }
  return `kafuka_shop_repeat_${(count - 1) % 2}`;
}

// 中断セーブに実際の回答が残っていれば、その返事の続きを読む。回答を上書きしない。
function visitScript(id) {
  const answer = state.romanceChoices?.[KAFUKA_BOND_CHOICE];
  if (id !== "kafuka_shop_bond_question" || !answer) return id;
  const scene = DB.dialogues[id];
  return { ...scene, lines: scene.lines.flatMap(line => {
    if (line.type !== "choice" || line.id !== KAFUKA_BOND_CHOICE) return [line];
    const choice = line.choices.find(c => (c.romance > 0) === (answer.value > 0));
    return scene.branches[choice.next];
  }) };
}

/** 既存flags/contactsを使う。旧セーブの未読から名乗りを推測しない。 */
export function syncKafukaKnowledge() {
  if (!state) return;
  state.flags ||= {};
  state.contacts ||= [];
  state.met ||= {};
  // 交換したアカウントに書かれた通称は分かる。本名は後の名乗りまで伏せる。
  if (state.flags._lime_contact_kafuka || state.contacts.includes("kafuka")) state.flags._kafuka_nickname_known = true;
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
  await playKafukaEncounter();
  return true;
}

/** 出会いの場面。水が満ちてサメが横切る間に店先の絵へ替え、泡がはじけて会話へ */
export async function playKafukaEncounter() {
  const front = sceneBg(DB.dialogues.kafuka_first_encounter.metadata?.bg, timeOfDay());
  await sharkSwim(async () => { if (front.url) await setBg(front.url, { tint: front.tint }); });
  await play("kafuka_first_encounter");
  state.flags._kafuka_first_encounter = true;
  state.flags._lime_contact_kafuka = true;
  // アカウントの通称を知った後の名前・旧セーブも同じ処理で揃える。
  syncKafukaKnowledge();
  gainAffinity("kafuka", 1); // 好きでも少し怖くても、手伝ってもらった親近感は同じ。
  save();
  return true;
}

export function kafukaSpot() {
  if (!state || (state.chapter || 1) < (DB.kafuka?.spot?.minChapter || 2)
    || !DB.kafuka?.spot) return null;
  const spot = { ...DB.kafuka.spot };
  return spot;
}

/** 章2のランタイムが接続された時の訪問。現在の章1では準備中で呼ばれない。 */
export async function visitKafuka(spot) {
  if (!spot || spot.id !== "shishark" || spot.unavailable || (state.chapter || 1) < 2
    || visiting || isPlaying()) return false;
  const stamp = `${state.chapter}:${state.day}:${state.slot}`;
  const receipt = state.flags._kafuka_visit;
  const pending = receipt?.stamp === stamp && !!DB.dialogues[receipt.dialogue]?.lines?.length;
  // 読了直後のセーブから戻った同じ行動は、料金・報酬を再処理せずcalendarに返す。
  if (pending && receipt.complete === true) return true;
  const count = state.story.kafuka || 0;
  const dialogue = pending ? receipt.dialogue : kafukaVisitDialogue();
  if (!DB.dialogues[dialogue]?.lines?.length) return false;
  const owner = state;
  visiting = true;
  try {
    if (!pending) {
      addMoney(-(spot.cost || 0));
      addStamina(spot.stamina || 0);
      state.flags._kafuka_visit = { stamp, dialogue, complete: false };
      save();
    }
    await play(visitScript(dialogue));
    if (state !== owner) return false;
    const event = entryEvents.find(e => e.dialogue === dialogue);
    if (event) state.flags[event.flag] = true;
    if (dialogue === "kafuka_shop_bond_question") {
      state.flags._kafuka_bond_question_done = true;
      releaseAffinity("kafuka");
    }
    state.story.kafuka = count + 1;
    gainAffinity("kafuka", count === 0 ? 2 : 1);
    earnStat("insight", 4);
    syncKafukaKnowledge();
    state.flags._kafuka_visit.complete = true;
    save();
    return true;
  } finally { visiting = false; }
}
