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
import { allSpots, VISIT_COST } from "../daily/spots.js";
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
import { consultLessons } from "../core/growth.js";

const stat = { ageha: "sense", kumicho: "guts", rei: "charm" };
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
  label: stop.name, area: CH2_CITY_NAME,
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
  if (spendableMoney(state) < (spot.cost || 0)) return { used: false, exerted: false };
  const first = !state.flags._ch2_talks?.[id];
  // 旧セーブの総訪問・好感度・思い出から、新しい会話の読了を作らない。
  const stages = CH2_VISIT_STORIES[id];
  // 神崎・REIは訪問列の最古の未読を、必要ハートに届いた時だけ読む。届くまではrepeat（#1648）。
  const pendingStage = !first && stages ? stages.find(entry => !ch2VisitDone(state.flags, id, entry)) : null;
  const stage = pendingStage && affinityLevel(id) >= pendingStage.heart ? pendingStage : null;
  const pendingFollowup = !first && !stages && !state.flags._ch2_followup_done?.[id];
  const followup = pendingFollowup && affinityLevel(id) >= 1;
  // あげはは続編のあと、店に通う回（ギャル友・初めての客・雑誌取材・ダメな日）を一度ずつ読む（#626）
  const chapterDayNow = state.day - dayOneProgress(state).startDay + 1;
  const story = id === "ageha" && !first && !pendingFollowup ? agehaStoryScene(state, chapterDayNow, DB.dialogues) : null;
  const scene = story || stage?.scene || `remake_ch2_${id}_${first ? "chat" : followup ? "followup" : "repeat"}`;
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
  // 長い段階会話の旧背景指定（metadata.bg）より、いま居る店の室内を優先する。
  const result = await play(scene, stage && !stage.done ? { bg: ROOMS[id] } : undefined);
  if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
  const discovered = CITY_OUTINGS.find(item => item.introducedBy === id);
  if (discovered && !state.flags[discovered.flag]) {
    const introduction = await play(discovered.introduction);
    if (state !== owner || !introduction || introduction.cancelled) return { used: false, exerted: false };
    introduceCitySpot(state, id);
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
  gainAffinity(id, first ? 10 : 5); earnStat(stat[id], 4);
  if (id === "ageha" && first) {
    state.flags._ch2_ageha_contact = true;
    state.flags._lime_contact_ageha = true;
    if (!state.contacts.includes("ageha")) state.contacts.push("ageha");
  }
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

