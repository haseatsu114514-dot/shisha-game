// 第2章の自由日。日常の消費・練習・保存・LIME・就寝は既存calendarを使う。
import { DB, bgUrl } from "../core/data.js";
import { state, save, markMet, timeOfDay } from "../core/state.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { imageReady, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { allSpots, VISIT_COST } from "../daily/spots.js";
import { trpgSpot } from "../daily/trpg.js";
import { MAP, STOPS, ROOMS } from "./ch2-city-data.js";
import { dayOneProgress, recordCityVisit, scheduleChapterTwoTrpgNight } from "./ch2-progress.js";
import { chapterTwoNights } from "./ch2-story.js";
import { agehaStoryScene, syncAgehaVibes } from "./ch2-story-data.js";

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
  label: stop.name, area: "ワイドハンガ街",
  theme: "store", glyph: "煙", cost: VISIT_COST, stamina: -16, desc: descriptions[stop.id],
  unknownDesc: unknownDescriptions[stop.id],
  previewUrl: ROOMS[stop.id],
}));

async function visitPreparationSpot(spot, { staminaGuard }) {
  if (spot.region !== "widehanga") return null;
  if (!(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
  const owner = state, id = spot.charId;
  const first = !state.flags._ch2_talks?.[id];
  // 旧セーブの総訪問・好感度・思い出から、新しい会話の読了を作らない。
  const followup = !first && !state.flags._ch2_followup_done?.[id];
  // あげはは続編のあと、店に通う回（ギャル友・初めての客・雑誌取材・ダメな日）を一度ずつ読む（#626）
  const chapterDayNow = state.day - dayOneProgress(state).startDay + 1;
  const story = id === "ageha" && !first && !followup ? agehaStoryScene(state, chapterDayNow, DB.dialogues) : null;
  // 神崎・REIは続編のあと一度だけ、前の話を覚えていて少し進む再訪（#952）。その後はいつもの会話。
  const revisitId = `remake_ch2_${id}_revisit`;
  const revisit = !first && !followup && !story && !state.flags._ch2_revisit_done?.[id] && !!DB.dialogues[revisitId];
  const deferred = followup || revisit;
  const scene = story || (revisit ? revisitId : `remake_ch2_${id}_${first ? "chat" : followup ? "followup" : "repeat"}`);
  const dialogue = DB.dialogues[scene];
  if (!dialogue?.lines?.length || deferred && !dialogue.lines.every(line => line && !line.type
    && typeof line.text === "string" && line.text.length > 0 && typeof line.speaker === "string" && typeof line.face === "string")) {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (!await imageReady(ROOMS[spot.charId], 15000)) {
    toast("室内を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (state !== owner) return { used: false, exerted: false };
  // 未訪問なら先に実際の名乗りを読む。見学・顔合わせだけで交流回数を増やさない。
  if (!state.met[id]) {
    await setBg(MAP[timeOfDay()], { instant: true });
    const result = await play(`ch2_city_${id}`);
    if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
    recordCityVisit(state, id);
  }
  // 新しい続編には制御行・報酬を持たせず、正常終端まで請求を保留する。
  // cancelled/途中LOAD/例外で費用だけがRAMや保存に残らない。既存chat/repeatの順序は保持。
  if (!deferred) { addMoney(-spot.cost); addStamina(spot.stamina); }
  await setBg(ROOMS[id], { instant: true });
  if (state !== owner) return { used: false, exerted: false };
  const result = await play(scene);
  if (state !== owner || !result || result.cancelled) return { used: false, exerted: false };
  if (deferred) {
    addMoney(-spot.cost); addStamina(spot.stamina);
    (state.flags[followup ? "_ch2_followup_done" : "_ch2_revisit_done"] ||= {})[id] = true;
  }
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
  return { used: true, exerted: true };
}

export async function runChapterTwoPreparation() {
  const startDay = dayOneProgress(state).startDay;
  scheduleChapterTwoTrpgNight(state, startDay);
  state.flags._ch2_preparation_started = true;
  state.flags._ch2_region ||= "home";
  save();
  await runDaily({
    startNextDay: true, untilDay: startDay + 13, tournamentName: "HAZE: OPEN CLOUD",
    mapOptions: () => ({
      regionId: state.flags._ch2_region,
      regions: [
        { id: "home", label: "地元・大須／栄", background: () => bgUrl(`bg_osu_map_${timeOfDay()}`), spots: () => allSpots().filter(spot => spot.kind !== "trpg") },
        { id: "widehanga", label: "隣町・ワイドハンガ", background: () => MAP[timeOfDay()], spots: () => [...PREPARATION_SPOTS, trpgSpot()].filter(Boolean) },
      ],
      onRegionChange: id => { state.flags._ch2_region = id; save(); },
    }),
    spotById: id => PREPARATION_SPOTS.find(spot => spot.id === id),
    performSpot: visitPreparationSpot,
    nightEvents: chapterTwoNights(startDay),
  });
}
