// 第5章の自由行動を、第1・2章と同じ日常ループ（daily/calendar.js の runDaily）で遊ぶ（#2033）。
// 日付・昼夜・体力・睡眠・天気・LIMEの受信箱・地図・育成（能力の上限は100）は日常ループが持つ。
// ここでは第5章の行き先と、tonari の3場面・閉店後の試作・EDEN・博士への連絡だけを差し込む。
// 地域は地元・橙須と隣町・柚ヶ谷（駅で行き来。夜は地元へ帰る。第2章と同じ電車の仕組み）と東京（Dr.fookah の配送便。
// 昼に出て夜に着く。ムカイさんの屋根裏に好きなだけ泊まれる。chapters/ch5-tokyo.js）とドバイ（シェイクの手紙に同封の
// 往復の切符で飛行機。シェイクの屋敷の客間に泊まれる。chapters/ch5-dubai.js）。交通の決まりは chapters/ch5-travel.js。
// 勝負の日は博士と決めるまで無い（untilDay = Infinity）。決めると翌日が勝負の日になり、その朝でループが終わる。
// 恋人とは第1・2章と同じく、LIMEの誘い→デート（絆が深まる）→節目（lover_events）の順に進む（帰郷後なので開ける・IR16・IR17）。
// デートは地元の店なので、東京・ドバイにいる間は誘いが届かない（daily/romance.js の hometownDateOpen）。
import { state, save, timeOfDay } from "../core/state.js";
import { bgUrl, displayName } from "../core/data.js";
import { modal, toast } from "../core/ui.js";
import { rescheduleInvitation } from "../daily/phone.js";
import { CH2_CITY_NAME, HOME_CITY_NAME } from "../core/city-locations.js";
import { runDaily } from "../daily/calendar.js";
import { allSpots, fortuneSpot } from "../daily/spots.js";
import { openShop } from "../daily/shop.js";
import { canReflect } from "../daily/reflection.js";
import { trpgSpot } from "../daily/trpg.js";
import { MAP } from "./ch2-city-data.js";
import { CITY_SHOP } from "./ch2-outings.js";
import { returnCityHome } from "./ch2-commute.js";
import { cityRegularSpots, visitCityRegular } from "./ch2-preparation.js";
import { TOKYO, TOKYO_SPOTS, TO_TOKYO_SPOT, performTokyoSpot, inTokyo, tokyoNight, tokyoWakeBackground, chapterFiveMukaiShift,
  chapterFiveTokyoPin, tokyoSpotsNow } from "./ch5-tokyo.js";
import { DUBAI, DUBAI_SPOTS, TO_DUBAI_SPOT, performDubaiSpot, inDubai, dubaiNight, dubaiWakeBackground, chapterFiveDubaiPin } from "./ch5-dubai.js";
import { chapterFiveShops, chapterFiveCityShops, chapterFiveShopById, performChapterFiveShop } from "./ch5-shops.js";
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

// 第1章の店そのものは地図に出さない行き先。第1・2章の物語の続きが流れるため。
//   naru（KEMURIKUSA）・c_station: 第5章の通いの小会話だけで出す（chapters/ch5-shops.js。#2033 F）
//   minto（PEPPERMINT）/ shishark（SHISHARK）: ヒロインの店も同じく通いの小会話で出す（恋人でも友人でも自然な会話）
//   trpg_bar: 柚ヶ谷の店（隣町の地域で出す）
// 占い師は第5章にも現れる（章で1〜2回・予定の無い昼か夜。daily/fortune-schedule.js）。
const HIDDEN_SPOTS = Object.freeze(["naru", "minto", "shishark", "c_station", "trpg_bar"]);

/** 第5章の地元の行き先（東京の配送便は昼だけ・ドバイは切符入りの手紙が届いている時だけ押せる）。 */
export function chapterFiveHomeSpots() {
  return [...allSpots().filter(spot => !HIDDEN_SPOTS.includes(spot.id)), ...chapterFiveShops(), CH5_CALL_SPOT, chapterFiveTokyoPin(), chapterFiveDubaiPin()];
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
    // 告白は第1〜3章の物語なので、第5章では夜に告白の場面を始めない。恋人の誘いとデートは開いている（IR16）。
    confessions: false,
    mapOptions: () => ({
      regionId: currentRegion(),
      regions: [
        { id: "home", label: `地元・${HOME_CITY_NAME}`, background: () => bgUrl(`bg_osu_map_${timeOfDay()}`), spots: chapterFiveHomeSpots },
        { id: "widehanga", label: `隣町・${CH2_CITY_NAME}`, background: () => MAP[timeOfDay()], spots: chapterFiveCitySpots },
        { id: TOKYO, label: "東京", background: () => bgUrl(`bg_tokyo_map_${timeOfDay()}`), spots: chapterFiveTokyoSpots },
        // ドバイの地図は第4章と同じ（昼は真昼、夜は夕景）。占い師はドバイには現れない（台帳 URA）。
        { id: DUBAI, label: "ドバイ", background: () => bgUrl(timeOfDay() === "night" ? "bg_dubai_map_dusk" : "bg_dubai_map"), spots: chapterFiveDubaiSpots },
      ],
      onRegionChange: id => { state.flags._ch2_region = id; save(); },
    }),
    // 夜は地元へ帰ってから（柚ヶ谷にいれば帰りの電車。第2章と同じ）。東京にいれば屋根裏で寝る。
    beforeHomecoming: () => inTokyo() ? tokyoNight() : inDubai() ? dubaiNight() : returnCityHome(),
    // 東京・ドバイにいる間は恋人のデートの約束が成り立たない（daily/phone.js が予定を改める）。仕事の約束などで
    // 東京にいる時も、地元へ瞬間移動させない（false はループを止めるので返さない）。
    beforeInvitation: destination => inTokyo() || inDubai() ? true
      : destination && (destination.region || "home") === "home" ? returnCityHome() : true,
    // 東京の屋根裏でも寝る前の家シーシャを選べる（台を持って行く・VOL12。FIN10 の「出さない」を更新）。
    wakeBackground: () => inTokyo() ? tokyoWakeBackground() : inDubai() ? dubaiWakeBackground() : null,
    spotById: id => [CH5_CALL_SPOT, CH5_CITY_SHOP, TO_TOKYO_SPOT, ...TOKYO_SPOTS, TO_DUBAI_SPOT, ...DUBAI_SPOTS, ...cityRegularSpots()].find(spot => spot.id === id) || chapterFiveShopById(id),
    performSpot: (spot, options) => performChapterFiveSpot(spot, io, options),
    // ムカイさんの LIME で呼ばれたシフト（VOL10）
    mukaiShift: ({ called = false } = {}) => chapterFiveMukaiShift(state, { called }),
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

const currentRegion = () => ["widehanga", TOKYO, DUBAI].includes(state.flags._ch2_region) ? state.flags._ch2_region : "home";

/** 東京の行き先（スティーブ・ヴォルクの店は会ったことがあれば。帰りの配送便は昼だけ）。 */
// 占い師は東京にも現れる（理由は語らない・台帳 URA）。
export const chapterFiveTokyoSpots = () => [...tokyoSpotsNow().filter(spot => (!spot.charId || state.met?.[spot.charId]) && reflectable(spot)), fortuneSpot(TOKYO)].filter(Boolean);
/** ドバイの行き先（モスクは灯せる火種がある時だけ）。 */
export const chapterFiveDubaiSpots = () => DUBAI_SPOTS.filter(reflectable);
// 内省の場所（東京の池の弁天堂・ドバイのモスク）は、心得の盤で灯せる火種がある時だけ地図に出す（第3・4章と同じ）。
const reflectable = spot => !spot.reflect || canReflect(state);

/** 柚ヶ谷の支店（第2章の「県大会向け」の説明は使わない）。 */
const CH5_CITY_SHOP = Object.freeze({ ...CITY_SHOP, desc: "隣町の支店。仕入れはここでも。" });

/** 第5章の柚ヶ谷の行き先: 神崎・REI・あげはの店（会ったことがあれば）・支店・ボドゲカフェ（知っていれば）。 */
export function chapterFiveCitySpots() {
  return [...cityRegularSpots(), ...chapterFiveCityShops(), CH5_CITY_SHOP, trpgSpot()].filter(Boolean);
}

/** 今日の恋人のデートの約束（地元の店で会う）。無ければ null。 */
const todaysDate = () => {
  const invite = state.pendingInvite;
  return invite && /^date_/.test(invite.event) && (invite.day ?? state.day) === state.day ? invite : null;
};

/**
 * 東京・ドバイへ発つ前に、今日の恋人との約束を確かめる。行くなら約束を別の日に改める（地元のデートは遠くではできない）。
 * true＝そのまま出発してよい。
 */
async function leaveDateBehind(spot) {
  const invite = todaysDate();
  if (!invite) return true;
  const name = displayName(invite.sender, state, { context: "private" });
  const city = spot.id === TO_DUBAI_SPOT.id ? "ドバイ" : "東京";
  const go = await modal({ title: "今日の約束", body: `今日は${name}と会う約束がある。<br>${city}へ行くなら、約束は別の日に改めることになる。`,
    options: [
      { label: "やめておく", value: false, test: "ch5-date-stay", primary: true },
      { label: `約束を改めて、${city}へ`, value: true, test: "ch5-date-leave" },
    ] });
  if (!go || state.pendingInvite !== invite) return false;
  rescheduleInvitation(invite, `${city}へ出かけることになり、約束を別の日に改めることにした`);
  save();
  return true;
}

async function performChapterFiveSpot(spot, io, options = {}) {
  if ([TO_TOKYO_SPOT.id, TO_DUBAI_SPOT.id].includes(spot.id) && !await leaveDateBehind(spot)) return { used: false, exerted: false };
  const tokyo = await performTokyoSpot(spot, options);
  if (tokyo) return tokyo;
  const dubai = await performDubaiSpot(spot, options);
  if (dubai) return dubai;
  const regular = await performChapterFiveShop(spot, options);
  if (regular) return regular;
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
  if (progress.part === "scheduled") {
    // 日を決めた日の残りは勝負の準備。今夜の恋人との約束は、別の日に改める。
    const invite = todaysDate();
    if (invite) {
      rescheduleInvitation(invite, "博士との勝負の準備にあてるため、約束を別の日に改めることにした");
      toast(`${displayName(invite.sender, state, { context: "private" })}との今夜の約束は、別の日に改めることにした`);
      save();
    }
    return { used: true, exerted: false, slotsUsed: Math.max(1, 2 - state.slot) };
  }
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
