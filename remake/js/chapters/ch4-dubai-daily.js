// 第4章のドバイを、第1・2章と同じ日常ループ（daily/calendar.js の runDaily）で遊ぶ（VOL04・2026-11-02
// オーナー「3も4も14日」）。日付・昼夜・体力・睡眠・天気・LIMEの受信箱・地図・育成（上限90）・寝る前の家シーシャは
// 日常ループが持つ。ドバイDAY1〜12がこの日常、DAY13は前夜祭と前夜（ch4.js の今までの「前夜」の流れ）、DAY14が世界大会。
// ここはドバイだけの部分:
//   - 行き先: スーク・FESTA・中心地のカフェ・路地裏のカフェ（約束の後）・龍龍水煙所（王煙楼の店）・なると会う・公式練習会場・
//     クリーク沿い・Dr.fookah ドバイ店・モスク（火種がある時・見学時間）・宿
//   - 龍龍水煙所: 王煙楼の店がドバイに出した店。ほかの章のライバルの店と同じく、通うと好感度と段階の会話が進む（ch4-longlong.js）
//   - 必須の出会い（FESTAの太陽・スークの出会い・路地裏の約束）は、期限の夜までに寄らなければその夜に読む
//   - 再訪の会話は data/dialogue/ch4_dubai_daily.json から巡回して読む
//   - 中心地のカフェ・路地裏のカフェは、来店のたびに現地のメニューから一台頼んで味わう（ch4-dubai-cafe.js。2026-11-02
//     オーナー「カフェで吸えたりとかにしよう」）。ドバイで一台吸う来店は現地の相場をきりよく（2026-11-02 オーナー「シーシャは6000 カフェは3000 できりよくいく」）:
//     専門店（FESTA）6,000円・カフェ（中心地・路地裏）3,000円。調べた相場（1ディルハム≒43.5円）は
//     専門のラウンジ 100〜150ディルハム、モール・中心地のカフェ 65〜75ディルハム、下町の小さなカフェ 30〜70ディルハム
//   - ラクダレース（任意・ch4-camel-race.js）: 店先でファーリスと知り合う→誘い→昼にレース場。行き先は段階で変わる
//   - 街の手触り（ch4-dubai-local.js。2026-11-02 オーナー「2以外は採用」）: 昼の屋外（スーク・クリーク沿い）は暑さで体力を多めに
//     使い、カフェ・専門店は夜がにぎわう（夜の一行。初めての夜は短い場面）。スークの後に屋台で軽く買える（体力が少し戻る）。
//     ドバイの値段には約何ディルハムかを添える
// 読了の確定は ch4-progress.js の completeChapterFourScene だけ（本筋の場面）。現在地は flags._ch2_region = "dubai"。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, bgUrl, displayName } from "../core/data.js";
import { layers, setBg, toast, modal } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { showHud } from "../daily/hud.js";
import { addMoney, addStamina, earnStat, gainAffinity, affinityLevel, visitAffinity } from "../core/stats.js";
import { openShop } from "../daily/shop.js";
import { canReflect, reflectAt } from "../daily/reflection.js";
import { consultLessons } from "../core/growth.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "../daily/spot-hours.js";
import { spendableMoney } from "../core/travel-budget.js";
import { readDialogues } from "../core/chapter-data.js";
import { CH4_PLACE_BG, CH4_SCENE_BG, CH4_DAILY_EVE_DAY, CH4_FREE_SCENE_IDS, chapterFourProgress, syncChapterFourDay,
  chapterFourSecondAvailable } from "./ch4-progress.js";
import { CAMEL_DAILY_SPOT_ID, camelDailySpot, camelSceneBg } from "./ch4-camel-progress.js";
import { overseasCompanion } from "../core/overseas-companion.js";
import { visitCamelRace } from "./ch4-camel-race.js";
import { desertDailySpots, desertDailySpotById } from "./ch4-desert-progress.js";
import { CAFE_MENU, CAFE_PLACES, CAFE_TASTE_IDS, OMAKASE, OMAKASE_LINE, SMOKED_IN_SCENE, TALKS_AFTER_ORDER,
  resolveCafeOrder, tasteScene, recordCafeOrder } from "./ch4-dubai-cafe.js";
import { LONGLONG_BG, LONGLONG_CHAR, LONGLONG_IDS, LONGLONG_LOAD_IDS, nextLonglongVisit, longlongHasNew, recordLonglongVisit } from "./ch4-longlong.js";
import { finaleAtVisit, playFinale } from "../daily/bonds.js";
import { FESTA_BOND_IDS, nextDubaiBondStory, recordDubaiBondRead } from "./dubai-bonds.js";
import { NIGHT_SCENE_IDS, STALL_NONE, STALL_PLACE, STALL_SCENE_IDS, dubaiSpotAt, nightVisit, recordNightVisit, priceText,
  stallChoices, stallItem, stallLabel, stallSceneId } from "./ch4-dubai-local.js";
import { runFullPractice } from "../craft/practice.js";
import { computeShisha } from "../craft/score.js";
import { INN_TRIAL_FLAG, INN_TRIAL_IDS, innTrialDue, innTrialResult } from "./ch4-inn-trial.js";
import { REHEARSAL_FLAG, REHEARSAL_IDS, rehearsalDue, rehearsalResult } from "./ch4-rehearsal.js";
import { COMPANION_TIME_FILE, COMPANION_TIME_IDS, companionLover, companionTimeOpen, spendCompanionTime } from "./companion-time.js";

export const DUBAI = "dubai";
const TALKS_FLAG = "_ch4_dubai_talks"; // 再訪の会話の巡回の回数（行き先ごと）

// 必須の出会いの期限（ドバイDAY。この日の夜までに寄らなければ、その夜に読む）。路地裏は出会いの2日後から。
const DEADLINE = Object.freeze({ festa: 6, first: 8, second: 11 });

// 再訪の会話（data/dialogue/ch4_dubai_daily.json）。既存の再訪（ch4_main.json）と並べて巡回する。
// カフェの *_culture_* は現地のシーシャ文化の話（吸いながら店の人・常連から聞く。注文の後に読む）。
const TALKS = Object.freeze({
  souq: ["ch4_dubai_souq_revisit", "ch4_souq_talk_b", "ch4_souq_talk_c", "ch4_souq_talk_d"],
  festa: ["ch4_festa_revisit", "ch4_festa_talk_b", "ch4_festa_talk_c", "ch4_festa_talk_d"],
  center_cafe: ["ch4_dubai_cafe_revisit", "ch4_cafe_talk_b", "ch4_cafe_culture_hose", "ch4_cafe_talk_c", "ch4_cafe_culture_coffee", "ch4_cafe_talk_d"],
  alley_cafe: ["ch4_alley_cafe_quiet", "ch4_alley_culture_clay", "ch4_alley_talk_c", "ch4_alley_culture_majlis"],
  naru: ["ch4_naru_dubai_1", "ch4_naru_dubai_2", "ch4_naru_dubai_3"],
  practice: ["ch4_practice_hall_1", "ch4_practice_hall_2"],
});
// 再訪の会話の背景（行き先の既定と違う場面だけ）。なるの2回目は練習会場、3回目はクリーク沿い。
const TALK_BG = Object.freeze({
  ch4_naru_dubai_1: CH4_PLACE_BG.inn, ch4_naru_dubai_2: CH4_PLACE_BG.venue, ch4_naru_dubai_3: "bg_dubai_street_night",
  ch4_practice_hall_1: CH4_PLACE_BG.venue, ch4_practice_hall_2: CH4_PLACE_BG.venue,
});
export const DUBAI_DAILY_IDS = Object.freeze([
  ...["souq", "festa", "center_cafe", "alley_cafe", "naru", "practice"].flatMap(id => TALKS[id].filter(scene => /_(talk_[b-d]|dubai_\d|hall_\d|culture_[a-z]+)$/.test(scene))),
  "ch4_creek_walk_day", "ch4_creek_walk_night", "ch4_inn_rest", ...INN_TRIAL_IDS, ...REHEARSAL_IDS, ...CAFE_TASTE_IDS, ...NIGHT_SCENE_IDS, ...STALL_SCENE_IDS,
]);

const read = id => chapterFourProgress(state).read[id] === true;
const dubaiDay = (value = state) => Math.max(1, value.day - chapterFourProgress(value).startDay + 1);
/** 日常ループの最後の朝（DAY13＝前夜祭と前夜の日）の通算日。 */
export const dubaiEveDay = (value = state) => chapterFourProgress(value).startDay + CH4_DAILY_EVE_DAY - 1;

// ---- 行き先 -----------------------------------------------------------------------------
const spot = fields => Object.freeze({ region: DUBAI, kind: "ch4_dubai", ...fields });
export const CH4_DUBAI_SPOTS = Object.freeze([
  spot({ id: "ch4_dubai_souq", place: "souq", label: "スーク", area: "旧市街の市場", x: 22, y: 58, theme: "shop", glyph: "市",
    preview: CH4_PLACE_BG.souq, stamina: -10, stat: "insight", desc: "スパイスの匂いが立つ市場。歩くたびに、違うものが目に入る。屋台で軽いものも買える。" }),
  spot({ id: "ch4_dubai_festa", place: "festa", label: "FESTA", area: "大会会場の出張ブース", x: 56, y: 28, theme: "rival", glyph: "煙",
    face: "da_silva", preview: CH4_PLACE_BG.festa, cost: 6000, stamina: -12, stat: "charm", desc: "手拍子と炭の匂いのする、太陽の店。一台6,000円（約140ディルハム）。夜がにぎわう。" }),
  spot({ id: "ch4_dubai_cafe", place: "center_cafe", label: "中心地のカフェ", area: "街の中心", x: 70, y: 52, theme: "store", glyph: "茶",
    preview: CH4_PLACE_BG.center_cafe, cost: 3000, stamina: -10, stat: "sense", desc: "立派なカフェ。現地のメニューから一台頼んで、給仕と客の作法も見る。一台3,000円（約70ディルハム）。夜がにぎわう。" }),
  spot({ id: "ch4_dubai_alley", place: "alley_cafe", label: "路地裏のカフェ", area: "路地の奥", x: 30, y: 78, theme: "store", glyph: "茶",
    preview: CH4_PLACE_BG.alley_cafe, cost: 3000, stamina: -10, stat: "technique", desc: "古い台が並ぶ小さなカフェ。現地のメニューから一台頼んで吸う。一台3,000円（約70ディルハム）。夜は常連が集まる。" }),
  // 龍龍水煙所（王煙楼の店）は最初から出す。王煙楼に会うまでは店主の顔は「？」（daily/spot-people.js）。背景は仮置き。
  spot({ id: "ch4_dubai_longlong", place: "longlong", label: "龍龍水煙所", area: "世界大会のあいだの店", x: 58, y: 50, theme: "rival", glyph: "龍",
    face: LONGLONG_CHAR, preview: LONGLONG_BG, cost: 6000, stamina: -12, stat: "insight",
    desc: "中国の水煙の老舗が、世界大会に合わせて出した店。一台6,000円（約140ディルハム）。夜がにぎわう。" }),
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

/** FESTAで次に読む太陽の段階（初対面の ch4_festa の後・必要ハートに届いた最古の未読）。無ければ null。 */
const festaBondDue = () => read("ch4_festa") ? nextDubaiBondStory(state, "da_silva", "festa", affinityLevel("da_silva")) : null;

function spotHasNew(entry) {
  // 訪問時と同じ初回条件・巡回記録を見る。一巡後は会話を続けても新着にはしない。
  if (entry.place === "festa" && festaBondDue()) return true;
  if (["souq", "festa", "center_cafe", "alley_cafe"].includes(entry.place))
    return firstScenes(entry.place).length > 0 || nextTalk(entry.place, { once: true }) !== null;
  if (entry.place === "naru") return nextTalk("naru", { once: true }) !== null;
  if (entry.place === "practice") return nextTalk("practice", { once: true }) !== null;
  if (entry.place === "longlong") return longlongHasNew(state, affinityLevel(LONGLONG_CHAR)) || finaleAtVisit(LONGLONG_CHAR);
  if (entry.place === "inn") return (dubaiDay() >= 2 && !read("ch4_inn_tool_care")) || innTrialDue(state) || rehearsalDue(state)
    || companionTimeOpen(state); // 同行した恋人と過ごせる日（BLC08）
  return false;
}

/** ラクダレースの行き先（段階・日付・昼夜で中身が変わるので、地図を描くたびに作る）。 */
const camelSpot = () => camelDailySpot(state, { region: DUBAI, kind: "ch4_dubai", stamina: 0 });

/** 今の時間（昼の暑さ）に合わせた行き先（ch4-dubai-local.js）。 */
const spotNow = entry => dubaiSpotAt(entry, state.slot);

/** 今の時間・物語の時点で地図に出す行き先。 */
export function chapterFourDubaiSpots() {
  const spots = CH4_DUBAI_SPOTS.filter(entry => {
    if (entry.place === "alley_cafe") return read("ch4_stranger_second") || chapterFourSecondAvailable(state);
    if (entry.place === "naru") return nextTalk("naru", { once: true }) !== null;
    if (entry.place === "mosque") return canReflect(state);
    return true;
  }).map(spotNow);
  const camel = camelSpot();
  if (camel) spots.splice(spots.findIndex(entry => entry.place === "inn"), 0, camel);
  spots.push(...desertDailySpots(state, dubaiDay())); // 砂漠ツアーのデスク／ヌールと砂丘へ（任意・ch4-desert.js）
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

/**
 * 本筋ではない短い会話。読み終えたら true。id の代わりに台本そのもの（前に一行足したもの）も渡せる。
 * growthScene はスポット固有の場面として初めて読み終えた時に経験値（X5s）の候補にする（vn/engine.js）。
 */
async function readPlain(id, bg, owner, { growthScene = false } = {}) {
  const dialogue = typeof id === "string" ? DB.dialogues[id] : id;
  if (!dialogue?.lines?.length) return false;
  const url = bgUrl(bg);
  await setBg(url);
  if (state !== owner) return false;
  const result = await play(dialogue, { bg: url, ...(growthScene ? { growthScene: true } : {}) });
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
      await setBg(bgUrl("bg_dubai_inn_night"));
      return true;
    },
    beforeInvitation: () => true,
    wakeBackground: () => CH4_PLACE_BG.inn,
    // ドバイでは恋人の誘い・デート・節目（lover_events）を出さず、遠くの恋人からのLIMEだけ続く（IR17）。
    // 同行した恋人は一緒にいるのでLIMEを送ってこない（ch4.js の恋人の入口と同じ）。
    dateInvitations: false,
    withLovers: () => [overseasCompanion(state).companion].filter(Boolean),
    confessions: false,
    spotById: id => id === CAMEL_DAILY_SPOT_ID ? camelSpot()
      : spotNow(CH4_DUBAI_SPOTS.find(entry => entry.id === id)) || desertDailySpotById(state, dubaiDay(), id),
    performSpot: (entry, options) => performDubaiSpot(entry, io, options),
  };
}

/** ドバイの日常（DAY1〜12）を回す。前夜祭の日（DAY13）の朝か LOAD で戻る。 */
export async function runChapterFourDubai(io) {
  const owner = state;
  Object.assign(DB.dialogues, await readDialogues("ch4_dubai_daily", DUBAI_DAILY_IDS), await readDialogues("ch4_longlong", LONGLONG_LOAD_IDS),
    await readDialogues("taiyo_bond", FESTA_BOND_IDS));
  // 同行した恋人と宿で過ごす場面（BLC08・companion-time.js）。読めなくても地図は開き、宿の選択肢に出ないだけ
  if (companionLover(owner)) await readDialogues(COMPANION_TIME_FILE, COMPANION_TIME_IDS).then(found => Object.assign(DB.dialogues, found)).catch(() => {});
  // LOAD・再開でも最初の地図から、ヌールの MENU の案内（♥5の締めくくり・告白を選べる）を合わせる。どちらも台詞が読み込まれているかを見る
  // （daily/bonds.js の finaleDue・daily/romance.js の romanceRouteOpen。第5章は ch5-dubai.js の preloadNoorScenes）。読めなくても地図は開く
  if (owner.met?.noor) await import("./ch4-desert.js").then(desert => desert.loadDesertDialogues()).catch(() => {});
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
  if (entry.kind === "ch4_desert") {
    const { performDesertSpot } = await import("./ch4-desert.js");
    return performDesertSpot(entry, { day: chapterFourProgress(state).day, showHud });
  }
  if (entry.place === "shop") { await openShop({ branch: "dubai" }); return unused; }
  if (entry.place === "mosque") {
    const hours = openingStatus(MOSQUE_VISITING_HOURS, state);
    if (!hours.ok) { toast(hours.why || "今は見学の時間ではない"); return unused; }
    await keepDailyHud(() => reflectAt("dubai_mosque"));
    return unused;
  }
  if (entry.place === "camel") return visitCamel(owner);
  if ((entry.cost || 0) > spendableMoney(state)) { toast(`お金が足りない（${priceText(entry.cost)}）`); return unused; }
  if (entry.stamina < 0 && !(await staminaGuard(entry.stamina))) return unused;
  // 夜がにぎわう店（ch4-dubai-local.js）: 先に店の夜を読む。初めての夜は短い場面、二度目からは最初の一行だけ。
  const night = nightVisit(state, entry.place);
  if (night && !await readNight(night, entry, owner)) return unused;
  let done = false, longlong = null, innTrial = false, festaBond = null, withCompanion = false;
  if (entry.place === "inn") {
    const visit = await visitInn(io, owner, staminaGuard);
    done = visit.done; innTrial = visit.trial; withCompanion = !!visit.companion;
  }
  else if (entry.place === "creek") done = await readPlain(state.slot ? "ch4_creek_walk_night" : "ch4_creek_walk_day", "bg_dubai_street_night", owner);
  else if (entry.place === "longlong") {
    // ♥5の締めくくりが来ていれば、段階や小会話より先に一度だけ読む（客の一台ではないので代金は取らない）。
    if (finaleAtVisit(LONGLONG_CHAR)) {
      await setBg(bgUrl(LONGLONG_BG));
      if (state !== owner) return unused;
      done = !!(await playFinale(LONGLONG_CHAR, { bg: bgUrl(LONGLONG_BG) }));
      if (!done || state !== owner) return unused;
      addStamina(entry.stamina || 0);
      if (entry.stat) earnStat(entry.stat, 4);
      return { used: true, exerted: (entry.stamina || 0) < 0, exp: { key: LONGLONG_CHAR, person: LONGLONG_CHAR } };
    }
    // 必要ハートに届いた最古の未読の段階、無ければ小会話（ch4-longlong.js）。読み終えた時だけ記録する。
    longlong = nextLonglongVisit(state, affinityLevel(LONGLONG_CHAR));
    done = await readPlain(longlong.id, LONGLONG_BG, owner);
  }
  else if (entry.place === "festa" && (festaBond = festaBondDue())) {
    // 太陽の段階の会話（chapters/dubai-bonds.js）。初対面の後、必要ハートに届いた最古の未読を、小会話の代わりに一本読む。
    done = await readPlain(festaBond, entry.preview, owner);
  }
  else done = await visitPlace(entry, io, owner);
  if (!done || state !== owner) return unused;
  if (night) recordNightVisit(state, entry.place);
  if (longlong) recordLonglongVisit(state, longlong);
  if (festaBond) recordDubaiBondRead(state, festaBond);
  if (entry.cost) addMoney(-entry.cost);
  // 同行者と過ごした回は、休んだ扱いにしない（体力は戻らない）
  addStamina(innTrial || withCompanion ? 0 : entry.stamina || 0);
  if (entry.heat) toast(entry.heat); // 昼の屋外（暑さで多めに使った・夜ほど休まらない）
  // スークの後は屋台で軽く買える（時間は使わない・体力が少し戻る）。体力を使った後に戻すので、上限で消えにくい。
  if (entry.place === STALL_PLACE && state === owner) await visitStall(owner);
  if (entry.stat && !innTrial) earnStat(entry.stat, 4);
  // 太陽: 来店ごとに通いの小会話と同じ +8（IR23）。段階の会話を読んだ来店は、ほかの店の段階と同じ +16
  if (entry.place === "festa") gainAffinity("da_silva", visitAffinity(festaBond ? "story" : "talk"));
  if (entry.place === "naru") gainAffinity("naru", 5);
  // 龍龍水煙所: ほかの章のライバルの店と同じ値（段階の会話 +16・通いの小会話 +8。core/stats.js の visitAffinity）
  if (longlong) gainAffinity(LONGLONG_CHAR, visitAffinity(longlong.kind === "story" ? "story" : "talk"));
  // 心得の盤の授業（SPEC 2.6・SBD50）: 会いに行った店で、灯した授業があれば相談して話を聞く（FESTA＝太陽）。
  // 路地裏のカフェの日常の会話で話すのは店員で、シェイクの授業は大会で名を明かすまで伏せる。シェイクへの相談は第5章の屋敷（ch5-dubai.js）。
  const teacher = { festa: "da_silva" }[entry.place];
  if (teacher && state === owner) await keepDailyHud(() => consultLessons(teacher));
  return { used: true, exerted: innTrial || (entry.stamina || 0) < 0 };
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

/** 宿で休むか、持ってきた葉で一台試すかを選ぶ。最初の道具の手入れは従来どおり先に読む。 */
async function visitInn(io, owner, staminaGuard) {
  if (rehearsalDue(state)) return visitRehearsal(owner, staminaGuard);
  if (dubaiDay() >= 2 && !read("ch4_inn_tool_care"))
    return { done: await keepDailyHud(() => io.readAndCommit("ch4_inn_tool_care")), trial: false };
  const pending = state.flags[INN_TRIAL_FLAG]?.result;
  // 同じ便で来た恋人と過ごす（BLC08・一日に一度・体力は戻らない）。試作の講評の途中（pending）は、先に講評を読む。
  const companion = !pending && companionTimeOpen(state) ? companionLover(state) : null;
  if (!innTrialDue(state) && !companion) return { done: await readPlain("ch4_inn_rest", "bg_dubai_inn_night", owner), trial: false };
  if (!pending) {
    const trialOpen = innTrialDue(state);
    const choice = await modal({ title: trialOpen ? "宿の作業台" : "宿",
      body: trialOpen ? "持ってきた葉で一台試せる。試作は1行動・体力16。休むなら体力が戻る。" : "今日は、どう過ごそう。休むなら体力が戻る。",
      options: [
        ...(companion ? [{ label: `${displayName(companion, state, { context: "private" })}と過ごす（同行）`, value: "companion", test: "ch4-inn-companion", primary: true }] : []),
        ...(trialOpen ? [{ label: "一台試作する", value: "trial", test: "ch4-inn-trial", primary: !companion }] : []),
        { label: "休む", value: "rest", test: "ch4-inn-rest" },
        { label: "戻る", value: "cancel", test: "ch4-inn-cancel" },
      ] });
    if (state !== owner || !choice || choice === "cancel") return { done: false, trial: false };
    if (choice === "rest") return { done: await readPlain("ch4_inn_rest", "bg_dubai_inn_night", owner), trial: false };
    if (choice === "companion") {
      const bg = timeOfDay() === "night" ? "bg_dubai_inn_night" : "bg_dubai_inn_day";
      return { done: await spendCompanionTime({ read: id => readPlain(id, bg, owner) }), trial: false, companion: true };
    }
    if (!(await staminaGuard(-16)) || state !== owner) return { done: false, trial: false };
    if (!await readPlain("ch4_inn_trial_intro", "bg_dubai_inn_night", owner)) return { done: false, trial: false };
    const cs = await runFullPractice({ kind: "ch4_inn_trial", adjustments: false, note: "宿での試作", isCurrent: () => state === owner });
    if (state !== owner || !cs || cs.cancelled || !cs.pullDone && !cs.failed) return { done: false, trial: false };
    const result = innTrialResult(cs, cs.failed ? null : computeShisha(cs).craftQuality);
    owner.flags[INN_TRIAL_FLAG] = { result, feedbackRead: false, day: dubaiDay() };
    addStamina(-16);
    save(); // 講評中のLOADでも完成した一台を作り直させない
  }
  const result = owner.flags[INN_TRIAL_FLAG].result;
  const done = await readPlain(`ch4_inn_trial_${result}`, "bg_dubai_inn_night", owner);
  if (done) owner.flags[INN_TRIAL_FLAG].feedbackRead = true;
  return { done, trial: done };
}

/** 前日の一台は独立した一度きりの行動。完成直後に保存して講評だけ再開できるようにする。 */
async function visitRehearsal(owner, staminaGuard) {
  const bg = "bg_dubai_inn_night";
  if (!owner.flags[REHEARSAL_FLAG]?.result) {
    const choice = await modal({ title: "前日リハーサル", body: "本番と同じ手順で一台作り、調整を2回まで通す。1行動・体力16。葉は減らず、能力値は増えない。",
      options: [
        { label: "リハーサルをする", value: "rehearsal", test: "ch4-rehearsal", primary: true },
        { label: "いつもの宿", value: "rest", test: "ch4-rehearsal-rest" },
        { label: "戻る", value: "cancel", test: "ch4-rehearsal-cancel" },
      ] });
    if (state !== owner || !choice || choice === "cancel") return { done: false, trial: false };
    if (choice === "rest") return { done: await readPlain("ch4_inn_rest", bg, owner), trial: false };
    if (!(await staminaGuard(-16)) || state !== owner) return { done: false, trial: false };
    if (!await readPlain("ch4_rehearsal_intro", bg, owner)) return { done: false, trial: false };
    const cs = await runFullPractice({ kind: "rehearsal", isCurrent: () => state === owner });
    if (state !== owner || !cs || cs.cancelled || !cs.pullDone && !cs.failed) return { done: false, trial: false };
    owner.flags[REHEARSAL_FLAG] = { result: rehearsalResult(cs, computeShisha), feedbackRead: false };
    addStamina(-16);
    save();
  }
  const progress = owner.flags[REHEARSAL_FLAG];
  const done = await readPlain(`ch4_rehearsal_${progress.result}`, bg, owner);
  if (done) progress.feedbackRead = true;
  return { done, trial: done };
}

/**
 * 行き先の場面: 初めての場面（本筋）があればそれ、無ければ再訪の会話を巡回して読む。
 * カフェでは、場面の後（吸いながらの会話は前）に現地のメニューから一台頼んで味わう。場面の中で吸う回は頼まない。
 */
async function visitPlace(entry, io, owner) {
  const cafe = CAFE_PLACES.includes(entry.place);
  const first = firstScenes(entry.place);
  if (first.length) {
    for (const id of first) if (!await keepDailyHud(() => io.readAndCommit(id)) || state !== owner) return false;
    return cafe && !first.some(id => SMOKED_IN_SCENE.includes(id)) ? orderAtCafe(entry, owner) : true;
  }
  const talk = nextTalk(entry.place);
  if (!talk) return false;
  const orderFirst = cafe && TALKS_AFTER_ORDER.includes(talk);
  if (orderFirst && !await orderAtCafe(entry, owner)) return false;
  // 既存の再訪（ch4_main.json の自由行動の場面）は本筋の確定も通す。新しい再訪の会話は読むだけ。
  const done = CH4_FREE_SCENE_IDS.includes(talk) ? await keepDailyHud(() => io.readAndCommit(talk))
    : await readPlain(talk, TALK_BG[talk] || CH4_SCENE_BG[talk] || entry.preview, owner);
  if (!done || state !== owner) return false;
  countTalk(entry.place);
  if (cafe && !orderFirst && !SMOKED_IN_SCENE.includes(talk)) return orderAtCafe(entry, owner);
  return true;
}

/**
 * カフェで一台頼む: 現地のメニュー（おまかせも選べる）→ 味わいの場面。代金は来店の値段に入っている。
 * 読み終えた時だけ頼んだ回数を記録する（初めての一台の熟練度は台本の flavor_lesson が一度だけ付ける）。
 */
async function orderAtCafe(entry, owner) {
  const pick = await modal({ title: entry.label, className: "ch4-cafe-order",
    body: "現地のメニューから、一台頼む。",
    options: [...CAFE_MENU.map((item, index) => ({ label: item.label, value: item.id, test: `cafe-order-${item.id}`, primary: index === 0 })),
      { label: "おまかせで", value: OMAKASE, test: "cafe-order-omakase" }] });
  if (state !== owner) return false;
  const id = resolveCafeOrder(state, pick) || CAFE_MENU[0].id;
  const scene = DB.dialogues[tasteScene(state, id)];
  if (!scene?.lines?.length) return true; // 台本が無い時も来店そのものは済んでいる
  const lines = pick === OMAKASE ? [{ speaker: "", face: "", text: OMAKASE_LINE[entry.place] }, ...scene.lines] : scene.lines;
  if (!await readPlain({ ...scene, lines }, entry.preview, owner)) return false;
  recordCafeOrder(state, id);
  return true;
}

/** 夜の店の場面。初めての夜は全部（スポット固有の場面の経験値の候補）、二度目からは最初の一行だけ。 */
async function readNight(night, entry, owner) {
  const scene = DB.dialogues[night.id];
  if (!scene?.lines?.length) return true; // 台本が無い時も来店はできる
  return readPlain(night.first ? scene : { ...scene, lines: scene.lines.slice(0, 1) }, entry.preview, owner, { growthScene: night.first });
}

/**
 * スークの屋台: 買えるものだけ並べる（何も買わない、も選べる）。選んだ時に代金と体力を確定してから、味の場面を読む。
 * 手持ちで何も買えなければ出さない。
 */
async function visitStall(owner) {
  const choices = stallChoices(spendableMoney(state));
  if (!choices.length) return;
  const pick = await modal({ title: "スークの屋台", className: "ch4-souq-stall",
    body: "屋台の店主が「マルハバ」と手を上げた。<br>カラクチャイは甘いミルクティー、シャワルマは肉の包み、ルカイマットは蜜がけの揚げ団子。"
      + "<br>どれも体力が少し戻る（時間は使わない）。",
    options: [...choices.map(item => ({ label: stallLabel(item), value: item.id, test: `stall-${item.id}` })),
      { label: "何も買わない", value: STALL_NONE, test: `stall-${STALL_NONE}` }] });
  const item = stallItem(pick);
  if (state !== owner || !item || item.price > spendableMoney(state)) return;
  addMoney(-item.price);
  addStamina(item.stamina);
  await readPlain(stallSceneId(item.id), CH4_PLACE_BG.souq, owner);
}

/** 行き先で最初に読む本筋の場面（未読のものだけ、順に）。 */
function firstScenes(place) {
  if (place === "souq") return ["ch4_dubai_souq", "ch4_stranger_first"].filter(id => !read(id));
  if (place === "festa") return read("ch4_festa") ? [] : ["ch4_festa"];
  if (place === "center_cafe") return read("ch4_dubai_cafe") ? [] : ["ch4_dubai_cafe"];
  if (place === "alley_cafe") return read("ch4_stranger_second") ? [] : chapterFourSecondAvailable(state) ? ["ch4_stranger_second"] : [];
  return [];
}
