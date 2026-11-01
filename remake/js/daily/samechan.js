// シーシャークの出会い・第2章からの店。競技のライバル枠とは分ける。
import { DB, sceneBg, loadCinemaDialogue } from "../core/data.js";
import { state, save, markMet, timeOfDay } from "../core/state.js";
import { setBg } from "../core/ui.js";
import { sharkSwim } from "../core/scene-motions.js";
import { gainAffinity, affinityLevel, releaseAffinity, ensureAffinityLevel, earnStat, addMoney, addStamina, STAMINA_LOW } from "../core/stats.js";
import { play, isPlaying } from "../vn/engine.js";
import { finaleAtVisit, playFinale } from "./bonds.js";
import { maybeRecruitTrpgMember } from "./trpg.js";
import { CINEMA_INTRO, cinemaIntroductionDue } from "../core/cinema-discovery.js";
import { readCinemaIntroduction } from "./cinema.js";

export const SAMECHAN_NICKNAME_TOPIC = "lime_naru_samechan_nickname";
export const SAMECHAN_BOND_CHOICE = "bond_q1_samechan";
let visiting = false;
const encountersInFlight = new WeakSet();

const entryEvents = [
  { dialogue: "samechan_shop_quiet_seat", flag: "_samechan_quiet_seat_done" },
  { dialogue: "samechan_shop_closing_check", flag: "_samechan_closing_check_done", night: true },
];
// 路地裏シネマの最初の上映は必ずサメ映画。一度でも観た後の来店で、感想を一度だけ聞く。
const cinemaImpression = { dialogue: "samechan_shop_cinema_impression", flag: "_samechan_cinema_impression_done" };
const cinemaImpressionDue = () => (state.spotVisits?.rojiura_cinema || 0) >= 1 && !state.flags[cinemaImpression.flag];
// 体力が少ない日の来店で一度だけ、腹話術をしまって本人の声で叱る。ほかの来店イベントは押しのけない。
const unwellVisit = { dialogue: "samechan_shop_unwell", flag: "_samechan_unwell_done" };
const unwellVisitDue = () => state.stamina < STAMINA_LOW && !state.flags[unwellVisit.flag];

/** 旧訪問回数は既存会話にだけ使う。新しい交流と問いかけの既読を推測しない。 */
export function samechanVisitDialogue() {
  if (!state || (state.chapter || 1) < 2) return null;
  const count = state.story.samechan || 0;
  if (count === 0) return "samechan_shop_first";
  if (count >= 3) {
    for (const event of entryEvents) {
      if (state.flags[event.flag]) continue;
      if (event.night && state.slot < 1) break;
      if (affinityLevel("samechan") < (event.night ? 3 : 2)) break;
      return event.dialogue;
    }
    if (state.flags._samechan_closing_check_done && affinityLevel("samechan") >= 3
      && !state.flags._samechan_bond_question_done && !state.finales?.samechan
      && !state.flags._friend_samechan && !(state.lovers || []).includes("samechan")) {
      return "samechan_shop_bond_question";
    }
  }
  if (finaleAtVisit("samechan")) return "samechan_bond_finale";
  if (count >= 1 && cinemaImpressionDue()) return cinemaImpression.dialogue;
  if (count >= 1 && unwellVisitDue()) return unwellVisit.dialogue;
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
  return playSamechanEncounter();
}

/** 出会いの場面。水が満ちてサメが横切る間に店先の絵へ替え、泡がはじけて会話へ */
export async function playSamechanEncounter({ signal = null } = {}) {
  if (state.flags._samechan_first_encounter || signal?.aborted || encountersInFlight.has(state)) return false;
  const owner = state;
  encountersInFlight.add(owner);
  try {
    const front = sceneBg(DB.dialogues.samechan_first_encounter.metadata?.bg, timeOfDay());
    await sharkSwim(async () => { if (state === owner && !signal?.aborted && front.url) await setBg(front.url, { tint: front.tint }); });
    if (state !== owner || signal?.aborted) return false;
    const result = await play("samechan_first_encounter", { signal });
    if (state !== owner || signal?.aborted || (!result || result.cancelled)) return false;
    state.flags._samechan_first_encounter = true;
    // 初対面を読み終えた一度きりの境界で♥1を保証する（中断・LOADでは到達しない）。
    ensureAffinityLevel("samechan", 1);
    state.flags._lime_contact_samechan = true;
    // アカウントの通称を知った後の名前・旧セーブも同じ処理で揃える。
    syncSamechanKnowledge();
    gainAffinity("samechan", 1); // 好きでも少し怖くても、手伝ってもらった親近感は同じ。
    save();
    return true;
  } finally { encountersInFlight.delete(owner); }
}

export function samechanSpot() {
  if (!state || (state.chapter || 1) < (DB.samechan?.spot?.minChapter || 2)
    || !DB.samechan?.spot) return null;
  const spot = { ...DB.samechan.spot, region: "home" };
  return spot;
}

/** 章2のランタイムが接続された時の訪問。地元マップから入店し、読了時に訪問を確定する。 */
export async function visitSamechan(spot, { signal = null } = {}) {
  if (!spot || spot.id !== "shishark" || spot.unavailable || (state.chapter || 1) < 2
    || visiting || isPlaying() || signal?.aborted) return false;
  const stamp = `${state.chapter}:${state.day}:${state.slot}`;
  const receipt = state.flags._samechan_visit;
  const pending = receipt?.stamp === stamp && !!DB.dialogues[receipt.dialogue]?.lines?.length;
  // 同じ行動への再入では、料金・報酬を再処理せずcalendarに返す。
  if (pending && receipt.complete === true) return true;
  const count = state.story.samechan || 0;
  const dialogue = pending ? receipt.dialogue : samechanVisitDialogue();
  if (!DB.dialogues[dialogue]?.lines?.length) return false;
  // 静かな席を読む当日には先取りせず、成立後の次の自主訪問に添える。
  const introduceCinema = pending && typeof receipt.cinemaIntroduction === "boolean"
    ? receipt.cinemaIntroduction : cinemaIntroductionDue(state);
  if (introduceCinema) {
    const beforeLoad = state;
    await loadCinemaDialogue();
    if (state !== beforeLoad || visiting || isPlaying() || signal?.aborted
      || `${state.chapter}:${state.day}:${state.slot}` !== stamp) return false;
  }
  if (introduceCinema && !DB.dialogues[CINEMA_INTRO]?.lines?.length) return false;
  const owner = state;
  const current = () => state === owner && `${state.chapter}:${state.day}:${state.slot}` === stamp && !signal?.aborted;
  visiting = true;
  try {
    if (!pending) {
      state.flags._samechan_visit = { stamp, dialogue, cinemaIntroduction: introduceCinema, complete: false };
      save();
    }
    if (dialogue === "samechan_bond_finale") {
      if (!await playFinale("samechan", { deferSave: true, signal })) return false;
    } else {
      const result = await play(visitScript(dialogue), { signal, growthScene: true });
      if ((!result || result.cancelled)) return false;
    }
    if (!current()) return false;
    if (dialogue === "samechan_shop_bond_question"
      && state.romanceChoices?.[SAMECHAN_BOND_CHOICE]?.char !== "samechan") return false;
    if (introduceCinema && !await readCinemaIntroduction({ signal })) return false;
    if (!current()) return false;
    // 読了時に一度だけ確定。中断のセーブは未払いなので、残金が訪問料だけでも再開できる。
    addMoney(-(spot.cost || 0));
    addStamina(spot.stamina || 0);
    const event = [...entryEvents, cinemaImpression, unwellVisit].find(e => e.dialogue === dialogue);
    if (event) state.flags[event.flag] = true;
    if (dialogue === "samechan_shop_bond_question") {
      state.flags._samechan_bond_question_done = true;
      releaseAffinity("samechan");
    }
    state.story.samechan = count + 1;
    releaseAffinity("samechan");
    gainAffinity("samechan", count === 0 ? 2 : 1);
    earnStat("insight", 4);
    syncSamechanKnowledge();
    // 紹介・訪問の精算を同期的にまとめ、後続の任意勧誘では再課金しない。
    if (introduceCinema) state.flags._samechan_cinema_introduced = true;
    state.flags._samechan_visit.complete = true;
    await maybeRecruitTrpgMember("samechan");
    if (!current()) return false;
    // calendarが行動・育成の確定後に保存する。支払済み／行動未消費の中間セーブを作らない。
    return true;
  } finally { visiting = false; }
}
