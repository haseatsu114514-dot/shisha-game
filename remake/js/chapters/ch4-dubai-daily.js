// 第4章のドバイを、第1・2章と同じ日常ループ（daily/calendar.js の runDaily）で遊ぶ（VOL04・2026-11-02
// オーナー「3も4も14日」）。日付・昼夜・体力・睡眠・天気・LIMEの受信箱・地図・育成（上限90）・寝る前の家シーシャは
// 日常ループが持つ。ドバイDAY1〜12がこの日常、DAY13は前夜祭と前夜（ch4.js の今までの「前夜」の流れ）、DAY14が世界大会。
// ここはドバイだけの部分:
//   - 行き先: スーク・FESTA・中心地のカフェ・路地裏のカフェ（約束の後）・なると会う・公式練習会場・クリーク沿い・
//     Dr.fookah ドバイ店・モスク（火種がある時・見学時間）・宿
//   - 必須の出会い（FESTAの太陽・スークの出会い・路地裏の約束）は、期限の夜までに寄らなければその夜に読む
//   - 再訪の会話は data/dialogue/ch4_dubai_daily.json から巡回して読む
//   - ラクダレース（任意・ch4-camel-race.js）: 店先でサイフと知り合う→誘い→昼にレース場。行き先は段階で変わる
// 読了の確定は ch4-progress.js の completeChapterFourScene だけ（本筋の場面）。現在地は flags._ch2_region = "dubai"。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, bgUrl } from "../core/data.js";
import { layers, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { showHud } from "../daily/hud.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { openShop } from "../daily/shop.js";
import { canReflect, reflectAt } from "../daily/reflection.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "../daily/spot-hours.js";
import { spendableMoney } from "../core/travel-budget.js";
import { readDialogues } from "../core/chapter-data.js";
import { CH4_PLACE_BG, CH4_SCENE_BG, CH4_DAILY_EVE_DAY, CH4_FREE_SCENE_IDS, chapterFourProgress, syncChapterFourDay,
  chapterFourSecondAvailable } from "./ch4-progress.js";
import { CAMEL_DAILY_SPOT_ID, camelDailySpot, camelSceneBg } from "./ch4-camel-progress.js";
import { visitCamelRace } from "./ch4-camel-race.js";

export const DUBAI = "dubai";
const TALKS_FLAG = "_ch4_dubai_talks"; // 再訪の会話の巡回の回数（行き先ごと）

// 必須の出会いの期限（ドバイDAY。この日の夜までに寄らなければ、その夜に読む）。路地裏は出会いの2日後から。
const DEADLINE = Object.freeze({ festa: 6, first: 8, second: 11 });

// 再訪の会話（data/dialogue/ch4_dubai_daily.json）。既存の再訪（ch4_main.json）と並べて巡回する。
const TALKS = Object.freeze({
  souq: ["ch4_dubai_souq_revisit", "ch4_souq_talk_b", "ch4_souq_talk_c", "ch4_souq_talk_d"],
  festa: ["ch4_festa_revisit", "ch4_festa_talk_b", "ch4_festa_talk_c", "ch4_festa_talk_d"],
  center_cafe: ["ch4_dubai_cafe_revisit", "ch4_cafe_talk_b", "ch4_cafe_talk_c", "ch4_cafe_talk_d"],
  alley_cafe: ["ch4_alley_cafe_quiet", "ch4_alley_talk_b", "ch4_alley_talk_c"],
  naru: ["ch4_naru_dubai_1", "ch4_naru_dubai_2", "ch4_naru_dubai_3"],
  practice: ["ch4_practice_hall_1", "ch4_practice_hall_2"],
});
// 再訪の会話の背景（行き先の既定と違う場面だけ）。なるの2回目は練習会場、3回目はクリーク沿い。
const TALK_BG = Object.freeze({
  ch4_naru_dubai_1: CH4_PLACE_BG.inn, ch4_naru_dubai_2: CH4_PLACE_BG.venue, ch4_naru_dubai_3: "bg_dubai_street_night",
  ch4_practice_hall_1: CH4_PLACE_BG.venue, ch4_practice_hall_2: CH4_PLACE_BG.venue,
});
export const DUBAI_DAILY_IDS = Object.freeze([
  ...["souq", "festa", "center_cafe", "alley_cafe", "naru", "practice"].flatMap(id => TALKS[id].filter(scene => /_(talk_[b-d]|dubai_\d|hall_\d)$/.test(scene))),
  "ch4_creek_walk_day", "ch4_creek_walk_night", "ch4_inn_rest",
]);

const read = id => chapterFourProgress(state).read[id] === true;
const dubaiDay = (value = state) => Math.max(1, value.day - chapterFourProgress(value).startDay + 1);
/** 日常ループの最後の朝（DAY13＝前夜祭と前夜の日）の通算日。 */
export const dubaiEveDay = (value = state) => chapterFourProgress(value).startDay + CH4_DAILY_EVE_DAY - 1;

// ---- 行き先 -----------------------------------------------------------------------------
const spot = fields => Object.freeze({ region: DUBAI, kind: "ch4_dubai", ...fields });
export const CH4_DUBAI_SPOTS = Object.freeze([
  spot({ id: "ch4_dubai_souq", place: "souq", label: "スーク", area: "旧市街の市場", x: 22, y: 58, theme: "shop", glyph: "市",
    preview: CH4_PLACE_BG.souq, stamina: -10, stat: "insight", desc: "スパイスの匂いが立つ市場。歩くたびに、違うものが目に入る。" }),
  spot({ id: "ch4_dubai_festa", place: "festa", label: "FESTA", area: "大会会場の出張ブース", x: 56, y: 28, theme: "rival", glyph: "煙",
    face: "da_silva", preview: CH4_PLACE_BG.festa, cost: 3000, stamina: -12, stat: "charm", desc: "手拍子と炭の匂いのする、太陽の店。" }),
  spot({ id: "ch4_dubai_cafe", place: "center_cafe", label: "中心地のカフェ", area: "街の中心", x: 70, y: 52, theme: "store", glyph: "茶",
    preview: CH4_PLACE_BG.center_cafe, cost: 6000, stamina: -10, stat: "sense", desc: "一台6,000円の立派なカフェ。給仕と客の作法を見る。" }),
  spot({ id: "ch4_dubai_alley", place: "alley_cafe", label: "路地裏のカフェ", area: "路地の奥", x: 30, y: 78, theme: "store", glyph: "茶",
    preview: CH4_PLACE_BG.alley_cafe, cost: 3000, stamina: -10, stat: "technique", desc: "路地の奥の小さなカフェ。古い台が並ぶ。" }),
  spot({ id: "ch4_dubai_naru", place: "naru", label: "なると会う", area: "宿のロビー", x: 20, y: 36, theme: "rival", glyph: "友",
    face: "naru", preview: CH4_PLACE_BG.inn, stamina: -8, stat: "guts", desc: "同じ街にいる日本の第二代表。少し話す。" }),
  spot({ id: "ch4_dubai_practice", place: "practice", label: "公式練習会場", area: "大会会場", x: 84, y: 30, theme: "stadium", glyph: "練",
    preview: CH4_PLACE_BG.venue, stamina: -14, stat: "technique", desc: "大会の会場で、本番と同じ台を試せる。空調と炭の減りを確かめる。" }),
  spot({ id: "ch4_dubai_creek", place: "creek", label: "クリーク沿い", area: "水辺の遊歩道", x: 58, y: 86, theme: "park", glyph: "水",
    preview: "bg_dubai_street_night", stamina: 20, desc: "水辺を歩いて、少し体を休める。" }),
  spot({ id: "ch4_dubai_shop", place: "shop", label: "Dr.fookah ドバイ店", area: "街の中心", x: 35, y: 57, theme: "shop", glyph: "卸",
    preview: CH4_PLACE_BG.shop, desc: "日本で出た葉が全部そろう（時間は使わない）。" }),
  spot({ id: "ch4_dubai_mosque", place: "mosque", label: "風の回廊モスク", area: "見学の回廊", x: 58, y: 70, theme: "rest", glyph: "回",
    preview: "bg_dubai_map", desc: "案内付きで見学し、中庭の回廊で振り返る（時間は使わない）。" }),
  spot({ id: "ch4_dubai_inn", place: "inn", label: "宿", area: "旧市街の宿", x: 8, y: 46, theme: "rest", glyph: "休",
    preview: CH4_PLACE_BG.inn, stamina: 55, desc: "部屋で休む。体力が大きく戻る。" }),
].map(entry => Object.freeze({ ...entry, hasNew: () => spotHasNew(entry) })));

function spotHasNew(entry) {
  if (entry.place === "souq") return !read("ch4_dubai_souq") || !read("ch4_stranger_first");
  if (entry.place === "festa") return !read("ch4_festa");
  if (entry.place === "center_cafe") return !read("ch4_dubai_cafe");
  if (entry.place === "alley_cafe") return !read("ch4_stranger_second") || !read("ch4_alley_cafe_quiet");
  if (entry.place === "naru") return nextTalk("naru", { once: true }) !== null;
  if (entry.place === "practice") return nextTalk("practice", { once: true }) !== null;
  return false;
}

/** ラクダレースの行き先（段階・日付・昼夜で中身が変わるので、地図を描くたびに作る）。 */
const camelSpot = () => camelDailySpot(state, { region: DUBAI, kind: "ch4_dubai", stamina: 0 });

/** 今の時間・物語の時点で地図に出す行き先。 */
export function chapterFourDubaiSpots() {
  const spots = CH4_DUBAI_SPOTS.filter(entry => {
    if (entry.place === "alley_cafe") return read("ch4_stranger_second") || chapterFourSecondAvailable(state);
    if (entry.place === "naru") return nextTalk("naru", { once: true }) !== null;
    if (entry.place === "mosque") return canReflect(state);
    return true;
  });
  const camel = camelSpot();
  if (camel) spots.splice(spots.findIndex(entry => entry.place === "inn"), 0, camel);
  return spots;
}

/** 行き先の次の会話。once は一巡したら出さない（なると会う・練習会場の初回）。 */
function nextTalk(place, { once = false } = {}) {
  const pool = (TALKS[place] || []).filter(id => DB.dialogues[id]?.lines?.length);
  if (!pool.length) return null;
  const count = state.flags[TALKS_FLAG]?.[place] || 0;
  if (once && count >= pool.length) return null;
  return pool[count % pool.length];
}
function countTalk(place) {
  const talks = state.flags[TALKS_FLAG] ||= {};
  talks[place] = (talks[place] || 0) + 1;
}

// ---- 読む -------------------------------------------------------------------------------
/** 章の側の読み方（ch4.js の readAndCommit）は HUD を章のカード用に差し替えるので、読み終えたら日常の HUD を戻す。 */
async function keepDailyHud(task) {
  const root = layers.hud.firstElementChild;
  try { return await task(); }
  finally {
    if (root && !root.isConnected) layers.hud.replaceChildren(root);
    showHud(true);
  }
}

/** 本筋ではない短い会話。読み終えたら true。 */
async function readPlain(id, bg, owner) {
  if (!DB.dialogues[id]?.lines?.length) return false;
  const url = bgUrl(bg);
  await setBg(url, { instant: true });
  if (state !== owner) return false;
  const result = await play(DB.dialogues[id], { bg: url });
  return state === owner && !!result && !result.cancelled;
}

// ---- 章定義 -----------------------------------------------------------------------------
/** @param io.readAndCommit (id) => Promise<boolean> 本筋の場面を読んで確定・保存する（ch4.js） */
export function chapterFourDubaiDefinition(io) {
  return {
    get untilDay() { return dubaiEveDay(state); },
    tournamentName: "HAZE: GRAND SMOKE",
    get nightEvents() { const event = dubaiNightEvent(io); return event ? { [state.day]: event } : {}; },
    morningDeparture: async () => { syncChapterFourDay(state); save(); },
    mapOptions: () => ({
      regionId: DUBAI,
      regions: [{ id: DUBAI, label: "ドバイ", background: () => bgUrl(timeOfDay() === "night" ? CH4_PLACE_BG.mapDusk : CH4_PLACE_BG.map),
        spots: chapterFourDubaiSpots }],
      onRegionChange: () => {},
    }),
    // 夜は宿で寝る（地元の帰り道の一言・道での出会いは出さない）。宿でも寝る前の家シーシャを選べる。
    beforeHomecoming: async () => {
      state.flags._home_tonight = true;
      await setBg(bgUrl("bg_dubai_inn_night"), { instant: true });
      return true;
    },
    beforeInvitation: () => true,
    wakeBackground: () => CH4_PLACE_BG.inn,
    dateInvitations: false,
    confessions: false,
    spotById: id => id === CAMEL_DAILY_SPOT_ID ? camelSpot() : CH4_DUBAI_SPOTS.find(entry => entry.id === id) || null,
    performSpot: (entry, options) => performDubaiSpot(entry, io, options),
  };
}

/** ドバイの日常（DAY1〜12）を回す。前夜祭の日（DAY13）の朝か LOAD で戻る。 */
export async function runChapterFourDubai(io) {
  const owner = state;
  Object.assign(DB.dialogues, await readDialogues("ch4_dubai_daily", DUBAI_DAILY_IDS));
  if (state !== owner) return;
  state.flags._ch2_region = DUBAI;
  state.phase = "daily";
  syncChapterFourDay(state);
  save();
  await runDaily(chapterFourDubaiDefinition(io));
}

// ---- 期限の夜 ---------------------------------------------------------------------------
/** 期限を過ぎた必須の出会い（story_routes の順）。前のものを読むまで次は来ない。 */
function dueMandatory() {
  const day = dubaiDay();
  if (!read("ch4_festa")) return day >= DEADLINE.festa ? [{ id: "ch4_festa", beat: "夜。会場の出張ブースから、手拍子が聞こえてくる──" }] : null;
  if (!read("ch4_stranger_first")) return day >= DEADLINE.first
    ? [...(read("ch4_dubai_souq") ? [] : [{ id: "ch4_stranger_first_forced_in" }]), { id: "ch4_stranger_first", beat: "夜。香辛料の匂いがする方へ、足が向いた──" }] : null;
  if (!read("ch4_stranger_second")) return day >= DEADLINE.second && chapterFourSecondAvailable(state)
    ? [{ id: "ch4_stranger_second", beat: "夜。約束した路地の奥の店へ──" }] : null;
  return null;
}

function dubaiNightEvent(io) {
  const due = dueMandatory();
  if (!due) return null;
  const last = due[due.length - 1];
  return {
    id: `dubai-night:${last.id}`, schedule: "fixed", pin: null, label: "ドバイの夜", beat: last.beat,
    done: () => !dueMandatory(),
    run: async () => {
      for (const scene of due) {
        if (read(scene.id)) continue;
        if (!await keepDailyHud(() => io.readAndCommit(scene.id))) return;
      }
    },
  };
}

// ---- 行き先の処理 -------------------------------------------------------------------------
const unused = { used: false, exerted: false };

async function performDubaiSpot(entry, io, { staminaGuard }) {
  if (entry.region !== DUBAI) return null;
  const owner = state;
  syncChapterFourDay(state);
  if (entry.place === "shop") { await openShop({ branch: "dubai" }); return unused; }
  if (entry.place === "mosque") {
    const hours = openingStatus(MOSQUE_VISITING_HOURS, state);
    if (!hours.ok) { toast(hours.why || "今は見学の時間ではない"); return unused; }
    await keepDailyHud(() => reflectAt("dubai_mosque"));
    return unused;
  }
  if (entry.place === "camel") return visitCamel(owner);
  if ((entry.cost || 0) > spendableMoney(state)) { toast(`お金が足りない（${entry.cost.toLocaleString("ja-JP")}円）`); return unused; }
  if (entry.stamina < 0 && !(await staminaGuard(entry.stamina))) return unused;
  let done = false;
  if (entry.place === "inn") done = await restAtInn(io, owner);
  else if (entry.place === "creek") done = await readPlain(state.slot ? "ch4_creek_walk_night" : "ch4_creek_walk_day", "bg_dubai_street_night", owner);
  else done = await visitPlace(entry, io, owner);
  if (!done || state !== owner) return unused;
  if (entry.cost) addMoney(-entry.cost);
  addStamina(entry.stamina || 0);
  if (entry.stat) earnStat(entry.stat, 4);
  if (entry.place === "festa") gainAffinity("da_silva", 5);
  if (entry.place === "naru") gainAffinity("naru", 5);
  return { used: true, exerted: (entry.stamina || 0) < 0 };
}

/**
 * ラクダレース。会話の段階は時間を使わない。レースは完走した時だけ昼の枠を使い、ch4-camel-race.js が
 * 記録と一緒に枠を進めて保存する（日常ループには slotsUsed: 0 を返し、二重に進めない）。体力・能力は使わない。
 */
async function visitCamel(owner) {
  const result = await keepDailyHud(() => visitCamelRace({
    read: id => readPlain(id, camelSceneBg(id), owner),
    isCurrent: () => state === owner,
    beforeRace: () => showHud(false),
  }));
  return result.used && state === owner ? { used: true, exerted: false, slotsUsed: 0 } : unused;
}

/** 宿で休む。2日目以降の最初の一回は、道具の手入れ（本筋の場面）を先に読む。 */
async function restAtInn(io, owner) {
  if (dubaiDay() >= 2 && !read("ch4_inn_tool_care")) return keepDailyHud(() => io.readAndCommit("ch4_inn_tool_care"));
  return readPlain("ch4_inn_rest", "bg_dubai_inn_night", owner);
}

/** 行き先の場面: 初めての場面（本筋）があればそれ、無ければ再訪の会話を巡回して読む。 */
async function visitPlace(entry, io, owner) {
  const first = firstScenes(entry.place);
  if (first.length) {
    for (const id of first) if (!await keepDailyHud(() => io.readAndCommit(id)) || state !== owner) return false;
    return true;
  }
  const talk = nextTalk(entry.place);
  if (!talk) return false;
  // 既存の再訪（ch4_main.json の自由行動の場面）は本筋の確定も通す。新しい再訪の会話は読むだけ。
  const done = CH4_FREE_SCENE_IDS.includes(talk) ? await keepDailyHud(() => io.readAndCommit(talk))
    : await readPlain(talk, TALK_BG[talk] || CH4_SCENE_BG[talk] || entry.preview, owner);
  if (!done || state !== owner) return false;
  countTalk(entry.place);
  return true;
}

/** 行き先で最初に読む本筋の場面（未読のものだけ、順に）。 */
function firstScenes(place) {
  if (place === "souq") return ["ch4_dubai_souq", "ch4_stranger_first"].filter(id => !read(id));
  if (place === "festa") return read("ch4_festa") ? [] : ["ch4_festa"];
  if (place === "center_cafe") return read("ch4_dubai_cafe") ? [] : ["ch4_dubai_cafe"];
  if (place === "alley_cafe") return read("ch4_stranger_second") ? [] : chapterFourSecondAvailable(state) ? ["ch4_stranger_second"] : [];
  return [];
}
