// 第5章の自由行動を、第1・2章と同じ日常ループ（daily/calendar.js の runDaily）で遊ぶ（#2033）。
// 日付・昼夜・体力・睡眠・天気・LIMEの受信箱・地図・育成（能力の上限は100）は日常ループが持つ。
// ここでは第5章の行き先と、tonari の3場面・閉店後の試作・EDEN・博士への連絡だけを差し込む。
// 地域は地元・橙須と隣町・柚ヶ谷（駅で行き来。夜は地元へ帰る。第2章と同じ電車の仕組み）。
// 勝負の日は博士と決めるまで無い（untilDay = Infinity）。決めると翌日が勝負の日になり、その朝でループが終わる。
import { state, save, timeOfDay } from "../core/state.js";
import { bgUrl } from "../core/data.js";
import { modal } from "../core/ui.js";
import { CH2_CITY_NAME, HOME_CITY_NAME } from "../core/city-locations.js";
import { runDaily } from "../daily/calendar.js";
import { allSpots } from "../daily/spots.js";
import { openShop } from "../daily/shop.js";
import { trpgSpot } from "../daily/trpg.js";
import { MAP } from "./ch2-city-data.js";
import { CITY_SHOP } from "./ch2-outings.js";
import { returnCityHome } from "./ch2-commute.js";
import { cityRegularSpots, visitCityRegular } from "./ch2-preparation.js";
import {
  chapterFiveProgress, chapterFiveFreeRemaining, chapterFiveRead, chapterFiveTimeoutPending,
  chapterFivePreparation, chapterFivePrepPending, recordChapterFivePrepTrial, recordChapterFivePrepAdjustment,
  chapterFivePrepScene, CH5_PREP_TRIALS,
} from "./ch5-progress.js";

// tonari の場面の時間帯（台本コメント: ましろの訪問は昼・初めての客は夕方・閉店後の練習は夜）。
// 昼と夜の2枠なので、夕方の場面はどちらでも読める。
const TONARI_SLOTS = Object.freeze({
  ch5_free_mashiro_visit: [0],
  ch5_free_first_visitor: [0, 1],
  ch5_free_tonari_practice: [1],
});
const PRACTICE = "ch5_free_tonari_practice";

/** 博士に連絡する（勝負の日を決める）。家の電話から。 */
export const CH5_CALL_SPOT = Object.freeze({
  id: "ch5_call", kind: "ch5_call", label: "博士に連絡する", area: "自宅の電話", x: 64, y: 66,
  theme: "rest", glyph: "☎", preview: "bg_home",
  desc: "勝負の日を決める。決めたら、その日の残りは準備にあてて、翌日が勝負になる。",
});

// 第5章ではまだ地図に出さない行き先。第1・2章の物語の続きが流れる店と、第1章の大会の話題の施設。
// 第5章向けの会話ができたら外す（#2033 の残り）。
//   naru: 第2章の決裂の印が残ると「臨時休業」のまま（第3章の仲直り後の扱いが未整備）
//   minto（PEPPERMINT）/ shishark（SHISHARK）: ヒロインの店（第5章は恋人と過ごす場面を描かない）
//   c_station: 第1章の大会の受付・噂 / fortune: 占いは第1・2章だけ / trpg_bar: 柚ヶ谷の店（隣町の地域で出す）
const HIDDEN_SPOTS = Object.freeze(["naru", "minto", "shishark", "c_station", "fortune", "trpg_bar"]);

/** 第5章の地元の行き先。 */
export function chapterFiveHomeSpots() {
  return [...allSpots().filter(spot => !HIDDEN_SPOTS.includes(spot.id)), CH5_CALL_SPOT];
}

/** 次に tonari で読む場面（並びの順・時間帯が合うときだけ）。無ければ null＝いつもの tonari。 */
export function dueTonariScene(value = state) {
  const [next] = chapterFiveFreeRemaining(value).filter(scene => scene.location === "tonari");
  return next && (TONARI_SLOTS[next.id] || [0, 1]).includes(value.slot) ? next : null;
}

/**
 * 日常ループの章定義。
 * @param io.readAndCommit (id) => Promise<boolean> 読了して進行を確定・保存する（ch5.js）
 * @param io.readScene (id) => Promise<boolean> 読むだけ（試作の場面。確定は呼び出し側）
 */
export function chapterFiveDailyDefinition(io) {
  return {
    get untilDay() {
      const match = state?.flags?._ch5?.matchDay;
      return Number.isInteger(match) ? match : Infinity;
    },
    nightEvents: {},
    tournamentName: "博士との勝負",
    undatedNote: "博士との勝負の日は、まだ決まっていない",
    dateInvitations: false,
    confessions: false,
    mapOptions: () => ({
      regionId: currentRegion(),
      regions: [
        { id: "home", label: `地元・${HOME_CITY_NAME}`, background: () => bgUrl(`bg_osu_map_${timeOfDay()}`), spots: chapterFiveHomeSpots },
        { id: "widehanga", label: `隣町・${CH2_CITY_NAME}`, background: () => MAP[timeOfDay()], spots: chapterFiveCitySpots },
      ],
      onRegionChange: id => { state.flags._ch2_region = id; save(); },
    }),
    // 夜は地元へ帰ってから（柚ヶ谷にいれば帰りの電車。第2章と同じ）。
    beforeHomecoming: returnCityHome,
    beforeInvitation: destination => destination && (destination.region || "home") === "home" ? returnCityHome() : true,
    spotById: id => [CH5_CALL_SPOT, CH5_CITY_SHOP, ...cityRegularSpots()].find(spot => spot.id === id) || null,
    performSpot: (spot, options) => performChapterFiveSpot(spot, io, options),
  };
}

/** 第5章の自由行動を日常ループで回す。勝負の日の朝（または LOAD）で戻る。 */
export async function runChapterFiveDaily(io) {
  // 現在地は第2章と同じ flags._ch2_region。第5章は地元から始める（第2章の保存の柚ヶ谷を持ち込まない）。
  if (!state.flags._ch5_region_started) {
    state.flags._ch2_region = "home";
    state.flags._ch5_region_started = true;
    save();
  }
  await runDaily(chapterFiveDailyDefinition(io));
}

const currentRegion = () => state.flags._ch2_region === "widehanga" ? "widehanga" : "home";

/** 柚ヶ谷の支店（第2章の「県大会向け」の説明は使わない）。 */
const CH5_CITY_SHOP = Object.freeze({ ...CITY_SHOP, desc: "隣町の支店。仕入れはここでも。" });

/** 第5章の柚ヶ谷の行き先: 神崎・REIの店（会ったことがあれば）・支店・ボドゲカフェ（知っていれば）。 */
export function chapterFiveCitySpots() {
  return [...cityRegularSpots(), CH5_CITY_SHOP, trpgSpot()].filter(Boolean);
}

async function performChapterFiveSpot(spot, io, options = {}) {
  if (spot.region === "widehanga") {
    if (spot.id === CH5_CITY_SHOP.id) {
      await openShop({ branch: "widehanga" }); // 時間は使わない
      return { used: false, exerted: false };
    }
    const visited = await visitCityRegular(spot, options);
    if (visited) return visited;
  }
  if (spot.id === "tonari") {
    // 閉店後の試作が途中なら、まずその続き（LOAD 後など）。
    if (chapterFivePrepPending(state)) return { used: await runPrep(io), exerted: false };
    const scene = dueTonariScene();
    if (!scene) return null; // いつもの tonari（バイト・練習）
    if (!await io.readAndCommit(scene.id)) return { used: false, exerted: false };
    if (scene.id === PRACTICE) await runPrep(io);
    return { used: true, exerted: false };
  }
  if (spot.id === "adam" && !chapterFiveRead(state, "ch5_free_eden_adam")
    && chapterFiveFreeRemaining(state).some(scene => scene.id === "ch5_free_eden_adam")) {
    return { used: await io.readAndCommit("ch5_free_eden_adam"), exerted: false };
  }
  if (spot.kind === "shop") {
    // 第5章は1階の買い物だけ（2階の相談＝凛の場面は出さない）。時間は使わない。
    await openShop({ errand: true });
    return { used: false, exerted: false };
  }
  if (spot.id === CH5_CALL_SPOT.id) return contactDoctor(io);
  return null;
}

/**
 * 博士に連絡する（Q12: 「記録に残らない一日」が未読なら先に読む）。
 * 日を決めたら、その日の残りを使い切って夜へ。翌朝が勝負の日（untilDay）なのでループが終わる。
 * 先送りなら ch5_timeout を続けて読み、自由行動に戻る。
 */
async function contactDoctor(io) {
  if (!chapterFiveRead(state, "ch5_unrecorded_day") && !await io.readAndCommit("ch5_unrecorded_day")) return { used: false, exerted: false };
  if (!await io.readAndCommit("ch5_schedule_contact")) return { used: false, exerted: false };
  const progress = chapterFiveProgress(state);
  if (progress.part === "scheduled") return { used: true, exerted: false, slotsUsed: Math.max(1, 2 - state.slot) };
  if (chapterFiveTimeoutPending(state)) await io.readAndCommit("ch5_timeout");
  return { used: true, exerted: false };
}

/** 閉店後の試作（#1666）: 何を試す → スミさんが吸って返す → 直すか、このまま覚えるか。true＝最後まで済んだ。 */
async function runPrep(io) {
  if (!chapterFivePreparation(state)) {
    const trialId = await modal({
      title: "閉店後の試作", body: "ダブルアップル12グラム。今夜は、何を試す？<br>できた一台は、スミさんが吸って返してくれる。",
      options: CH5_PREP_TRIALS.map(trial => ({ label: trial.label, value: trial.id, test: `ch5-prep-${trial.id}` })),
    });
    if (!trialId || !await io.readScene(chapterFivePrepScene("trial", trialId))) return false;
    if (!recordChapterFivePrepTrial(state, trialId)) return false;
    save();
  }
  const prep = chapterFivePreparation(state);
  if (!prep || prep.adjusted !== null) return true;
  const trial = CH5_PREP_TRIALS.find(entry => entry.id === prep.trial);
  const adjusted = await modal({
    title: "もう一台か、このままか", body: `試したこと: ${trial.label}<br>スミさんの返答: ${trial.point}`,
    options: [
      { label: trial.adjust, value: "adjust", test: "ch5-prep-adjust", primary: true },
      { label: "このまま、手に覚えさせる", value: "keep", test: "ch5-prep-keep" },
    ],
  });
  if (!adjusted) return false;
  const sceneId = adjusted === "adjust" ? chapterFivePrepScene("adjust", trial.id) : chapterFivePrepScene("keep");
  if (!await io.readScene(sceneId)) return false;
  if (!recordChapterFivePrepAdjustment(state, adjusted === "adjust")) return false;
  save();
  return true;
}
