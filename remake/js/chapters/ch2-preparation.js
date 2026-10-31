import { normalizeCommuteState, chooseMorningCity, returnCityHome } from "./ch2-commute.js";
import { spendableMoney } from "../core/travel-budget.js";
import { CH2_CITY_NAME, HOME_CITY_NAME } from "../core/city-locations.js";
// 第2章の自由日。日常の消費・練習・保存・LIME・就寝は既存calendarを使う。
import { DB, bgUrl } from "../core/data.js";
import { state, save, markMet, timeOfDay } from "../core/state.js";
import { addMoney, addStamina, earnStat, gainAffinity, affinityLevel } from "../core/stats.js";
import { imageReady, setBg, toast, withScenePreparation } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { allSpots, isClosed, VISIT_COST } from "../daily/spots.js";
import { setHiyoriExtraShops } from "../daily/hiyori.js";
import { trpgSpot } from "../daily/trpg.js";
import { CITY_OUTINGS, CITY_SHOP, knownCityOutings, introduceCitySpot, outingDialogue, recordOutingVisit } from "./ch2-outings.js";
import { offerAgehaPurikura } from "./ch2-purikura.js";
import { openShop } from "../daily/shop.js";
import { MAP, STOPS, ROOMS } from "./ch2-city-data.js";
import { dayOneProgress, recordCityVisit } from "./ch2-progress.js";
import { chapterTwoNights } from "./ch2-story.js";
import { agehaStoryScene, syncAgehaVibes } from "./ch2-story-data.js";
import { CH2_VISIT_STORIES, ch2VisitDone } from "../core/affinity-stages.js";
import { BOND_QUESTIONS, BOND_FINALES, playQuestionVisit, questionVisitDue, finaleAtVisit, playFinale } from "../daily/bonds.js";
import { consultLessons } from "../core/growth.js";

const stat = { ageha: "sense", kumicho: "guts", rei: "charm" };
// day % 7（1=月曜）。第2章の準備期間（通算16〜27日）では各店とも1日だけ休む（#2027）。
// 定休日の私的な誘いは daily/romance.js の dateSchedule に同じ曜日を書いている。
export const CH2_CLOSED_ON = Object.freeze({ kumicho: 0, rei: 1 });
// 通い訪問の小会話。初回相談と続編だけを前提にし、来店数で巡回する（#2027）
const REPEAT_POOL = {
  kumicho: ["remake_ch2_kumicho_repeat", "remake_ch2_kumicho_repeat_b", "remake_ch2_kumicho_repeat_c", "remake_ch2_kumicho_repeat_d"],
  rei: ["remake_ch2_rei_repeat", "remake_ch2_rei_repeat_b", "remake_ch2_rei_repeat_c", "remake_ch2_rei_repeat_d"],
};
function repeatScene(id) {
  const pool = (REPEAT_POOL[id] || []).filter(scene => DB.dialogues[scene]?.lines?.length);
  return pool.length ? pool[(state.flags._ch2_talks?.[id] || 0) % pool.length] : `remake_ch2_${id}_repeat`;
}
const descriptions = {
  ageha: "平成ギャルのMELTY PUFF。あげはと客席づくりや香りの話をする。",
  kumicho: "黒革の応接室で神崎の丁寧な仕事について話す。",
  rei: "CDとギターのある零-ZERO-。REIの好きな曲や客への気遣いを聞く。",
};
const unknownDescriptions = {
  ageha: "白・ピンクのクマと平成ギャルの小物が並ぶシーシャ店。店主に話を聞いてみよう。",
  kumicho: "木壁と黒革ソファの重厚な店内。看板は煙草店だが、事務所のようにも見える。",
  rei: "CDとギター、薔薇の格子が並ぶV系コンセプトの店。",
};
export const PREPARATION_SPOTS = STOPS.filter(stop => ROOMS[stop.id]).map(stop => ({
  ...stop, id: `ch2_${stop.id}`, charId: stop.id, kind: "rival", region: "widehanga",
  label: stop.name, area: CH2_CITY_NAME, closedOn: CH2_CLOSED_ON[stop.id],
  theme: "store", glyph: "煙", cost: VISIT_COST, stamina: -16, desc: descriptions[stop.id],
  unknownDesc: unknownDescriptions[stop.id],
  previewUrl: ROOMS[stop.id], face: stop.id,
}));

async function visitPreparationSpot(spot, { staminaGuard }) {
  if (spot.region !== "widehanga") return null;
  if (!(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
  const owner = state, id = spot.charId;
  if (spot.id === CITY_SHOP.id) {
    await openShop({ branch: "widehanga" });
    return { used: false, exerted: false };
  }
  const outing = knownCityOutings(state).find(item => item.id === spot.id && item.kind === "outing");
  if (outing) {
    if (spendableMoney(state) < outing.cost) return { used: false, exerted: false };
    const dialogueId = outingDialogue(outing, state.flags);
    const result = await play(dialogueId, { bg: outing.previewUrl || MAP[timeOfDay()] });
    if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
    addMoney(-outing.cost); addStamina(outing.stamina);
    if (outing.stat) earnStat(outing.stat, 2);
    recordOutingVisit(state.flags, outing);
    return { used: true, exerted: outing.stamina < 0 };
  }
  if (spot.kind === "trpg") return null;
  if (isClosed(spot) || spendableMoney(state) < (spot.cost || 0)) return { used: false, exerted: false };
  const first = !state.flags._ch2_talks?.[id];
  // 旧セーブの総訪問・好感度・思い出から、新しい会話の読了を作らない。
  const stages = CH2_VISIT_STORIES[id];
  // 神崎・REIは訪問列の最古の未読を、必要ハートに届いた時だけ読む。届くまではrepeat（#1648）。
  const pendingStage = !first && stages ? stages.find(entry => !ch2VisitDone(state.flags, id, entry)) : null;
  const stage = pendingStage && affinityLevel(id) >= pendingStage.heart ? pendingStage : null;
  const pendingFollowup = !first && !stages && !state.flags._ch2_followup_done?.[id];
  const followup = pendingFollowup && affinityLevel(id) >= 1;
  // 訪問列を読み終えた♥5の次の来店で、締めくくりを一度だけ（#2027）。
  let finale = !first && stages && !pendingStage && finaleAtVisit(id);
  // あげはは続編のあと、店に通う回（ギャル友・初めての客・雑誌取材・ダメな日）を一度ずつ読む（#626）
  const chapterDayNow = state.day - dayOneProgress(state).startDay + 1;
  const story = id === "ageha" && !first && !pendingFollowup ? agehaStoryScene(state, chapterDayNow, DB.dialogues) : null;
  // あげは: 店に通う回と♥3の質問を読み終えた♥5の次の来店は、いつもの会話の代わりに締めくくり（#2023・一度だけ）。
  if (!finale && id === "ageha" && !first && !pendingFollowup && !story) finale = finaleAtVisit("ageha");
  const repeat = !first && !followup && !story && !stage && !finale;
  const scene = story || stage?.scene || (finale ? BOND_FINALES[id].dialogue
    : first ? `remake_ch2_${id}_chat` : followup ? `remake_ch2_${id}_followup` : repeatScene(id));
  const dialogue = DB.dialogues[scene];
  if (!dialogue?.lines?.length || (followup || stage?.done) && !dialogue.lines.every(line => line && !line.type
    && typeof line.text === "string" && line.text.length > 0 && typeof line.speaker === "string" && typeof line.face === "string")) {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (!await withScenePreparation(imageReady(ROOMS[spot.charId], 15000))) {
    toast("室内を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (state !== owner) return { used: false, exerted: false };
  // 未訪問なら先に実際の名乗りを読む。見学・顔合わせだけで交流回数を増やさない。
  if (!state.met[id]) {
    await withScenePreparation(setBg(MAP[timeOfDay()], { instant: true }));
    const result = await play(`ch2_city_${id}`);
    if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
    recordCityVisit(state, id);
  }
  // 続編・再訪・段階会話は、正常終端まで請求と既読を保留する。
  // cancelled/途中LOAD/例外で、追加の街紹介の前に費用だけが残らない。
  await withScenePreparation(setBg(ROOMS[id], { instant: true }));
  if (state !== owner) return { used: false, exerted: false };
  // 通い訪問の小会話の前だけ、昼夜の店のあいさつを挟む（段階会話・締めくくりは自前の導入がある）。
  const welcome = repeat && REPEAT_POOL[id] ? `venue_${id}_${timeOfDay()}` : null;
  if (welcome && DB.dialogues[welcome]?.lines?.length) {
    const greeted = await play(welcome);
    if (state !== owner || !greeted || greeted.cancelled) return { used: false, exerted: false };
  }
  if (finale) {
    // 締めくくりの記録と専用ハガルの受け取りは playFinale が完読時に一度だけ行う。保存は calendar の精算と同時。
    if (!await playFinale(id, { bg: ROOMS[id], deferSave: true }) || state !== owner) return { used: false, exerted: false };
  } else {
    // 長い段階会話の旧背景指定（metadata.bg）より、いま居る店の室内を優先する。
    const result = await play(scene, stage && !stage.done ? { bg: ROOMS[id] } : undefined);
    if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
  }
  const discovered = CITY_OUTINGS.find(item => item.introducedBy === id);
  if (discovered && !state.flags[discovered.flag]) {
    const introduction = await play(discovered.introduction);
    if (state !== owner || !introduction || introduction.cancelled) return { used: false, exerted: false };
    introduceCitySpot(state, id);
  }
  // あげはの♥3の節目（#1988）: 「初めての客」を読んだ直後に恋愛／友情の質問を続ける。
  // 先に読み終えて未回答の保存（旧版）は次の訪問で受け取る。中断したら訪問ごと未確定にし、既読・請求を残さない。
  if (id === "ageha" && (story === BOND_QUESTIONS.ageha.host && DB.dialogues[BOND_QUESTIONS.ageha.dialogue]?.lines?.length
    || questionVisitDue("ageha"))) {
    if (!await playQuestionVisit("ageha", { bg: ROOMS.ageha, deferSave: true })) return { used: false, exerted: false };
    if (state !== owner) return { used: false, exerted: false };
  }
  if (id === "ageha" && !await offerAgehaPurikura(ROOMS.ageha, spot)) return { used: false, exerted: false };
  addMoney(-spot.cost); addStamina(spot.stamina);
  if (followup) (state.flags._ch2_followup_done ||= {})[id] = true;
  if (stage?.done) (state.flags[stage.done] ||= {})[id] = true;
  else if (stage) state.flags[`_ch2_read_${stage.scene}`] = true;
  if (story) { state.flags[`_ch2_read_${story}`] = true; syncAgehaVibes(state.flags); }
  const talks = state.flags._ch2_talks ||= {};
  talks[id] = (talks[id] || 0) + 1;
  state.visits[id] = (state.visits[id] || 0) + 1;
  markMet(id); recordCityVisit(state, id);
  // 台本で交換した連絡先は、訪問を終えた時点で連絡先一覧にも記録する（daily/spots.js の hasContact と同じ）
  if (state.flags[`_lime_contact_${id}`] && !state.contacts.includes(id)) state.contacts.push(id);
  // あげはの交換後LIME（lime_ch2_ageha_after_visit）と旧セーブ互換の到達フラグ
  if (id === "ageha" && state.flags._lime_contact_ageha) state.flags._ch2_ageha_contact = true;
  // 神崎・REIの長い段階会話と締めくくりは、第1章の固有会話と同じ+10（#2027）。
  gainAffinity(id, first || finale || stages && stage?.file ? 10 : 5); earnStat(stat[id], 4);
  // 心得の盤で灯した授業があれば、その店で相談して習う（SBD61: 会った時だけ）
  if (state === owner) await consultLessons(id, { bg: ROOMS[id] });
  return { used: true, exerted: true };
}

export async function runChapterTwoPreparation() {
  setHiyoriExtraShops(() => state.chapter === 2 ? PREPARATION_SPOTS : []);
  normalizeCommuteState(state);
  const startDay = dayOneProgress(state).startDay;
  // 現行の卓は通常シフト後に集まれる。準備開始だけで旧DAY8の空き予定を追加しない。
  // 保存済みの個別予定・部員・連絡先はそのまま引き継ぐ。
  state.flags._ch2_preparation_started = true;
  state.flags._ch2_region ||= "home";
  save();
  await runDaily({
    morningDeparture: chooseMorningCity, beforeHomecoming: returnCityHome,
    // 地元の予定の前だけ帰る。柚ヶ谷の試煙会などは現地のまま開く。
    beforeNightEvent: event => allSpots().some(spot => spot.id === event.pin && (spot.region || "home") === "home")
      ? returnCityHome() : true,
    startNextDay: true, untilDay: startDay + 13, tournamentName: "HAZE: OPEN CLOUD",
    // LIMEの会場が地元と分かる場合も、面会の前に既存の帰路を通す。
    beforeInvitation: destination => destination && (destination.region || "home") === "home"
      ? returnCityHome() : true,
    mapOptions: () => ({
      regionId: state.flags._ch2_region,
      regions: [
        { id: "home", label: `地元・${HOME_CITY_NAME}`, background: () => bgUrl(`bg_osu_map_${timeOfDay()}`), spots: () => allSpots().filter(spot => spot.kind !== "trpg") },
        { id: "widehanga", label: `隣町・${CH2_CITY_NAME}`, background: () => MAP[timeOfDay()], spots: () => [...PREPARATION_SPOTS, CITY_SHOP, ...knownCityOutings(state).filter(spot => spot.kind !== "trpg"), trpgSpot()].filter(Boolean) },
      ],
      onRegionChange: id => { state.flags._ch2_region = id; save(); },
    }),
    spotById: id => [...PREPARATION_SPOTS, CITY_SHOP, ...knownCityOutings(state)].find(spot => spot.id === id),
    performSpot: visitPreparationSpot,
    nightEvents: chapterTwoNights(startDay),
  });
}

