// 第3章の東京14日を、第1・2章と同じ日常ループ（daily/calendar.js の runDaily）で遊ぶ（VOL03・2026-11-02
// オーナー「3も4も14日」）。日付・昼夜・体力・睡眠・天気・LIMEの受信箱・地図・育成（上限82）・寝る前の家シーシャは
// 日常ループが持つ。ここは東京だけの部分:
//   - 本筋の場面: 昼の行動を使う場面（slotEvent）と夜の予定（nightEvents）。並びと日付は ch3-progress.js の CH3_DAILY_PLAN
//   - 恋人の東京訪問: 約束した時間帯に、合流・散歩が一つの行動として入る（core/tokyo-visits.js）
//   - 行き先: mukai（手伝い・ましろちゃんとの時間・店番・作業台・裏口のてつこ）・煙幕・Smoke & Glory・鉄の煙・公園・
//     東京の店・CHOI-ZAP・路地裏の神社・クラブSEAM・mukaiの奥の部屋・地元との連絡
//   - 寄り道（任意の場面）は、その場所を訪ねた時に一つずつ読む（行動を使うので選んで読む。台本の能力報酬も効く）。
//     遠くからの電話（みんと・つむぎ・ひより）は、本筋の予定が無い夜に一つ届く
// 現在地は flags._ch2_region = "tokyo"（HUD の街の札）。台詞の正本は data/dialogue/ch3_*.json と ch3_tokyo_daily.json。
import { state, save, timeOfDay } from "../core/state.js";
import { DB, bgUrl, displayName } from "../core/data.js";
import { layers, setBg, toast, modal } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { runDaily } from "../daily/calendar.js";
import { showHud } from "../daily/hud.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { openShop } from "../daily/shop.js";
import { fortuneSpot } from "../daily/spots.js";
import { canReflect, reflectAt } from "../daily/reflection.js";
import { readDialogues, loadStoryRoutes } from "../core/chapter-data.js";
import { chapterDay } from "../core/chapter-clock.js";
import { tokyoTime, TOKYO_FREE_TIMES_V3, timeNumber } from "../core/tokyo-clock.js";
import { dueTokyoVisit, completeTokyoVisitAction, visitContacts, syncTokyoVisits } from "../core/tokyo-visits.js";
import { CH3_DAILY_PLAN, chapterThreeScenes, chapterThreeProgress, completeChapterThreeScene } from "./ch3-progress.js";
import { OUTINGS_FLAG, outingCounts, outingDialogueId, chapterThreeOutingCandidates } from "./ch3-outing-progress.js";
import { availableChapterThreeTrials } from "./ch3-trial-progress.js";
import { runMukaiDeliveryWork } from "./ch3-deliveries.js";
import { availableOptionalScenes, commitOptionalRead, selectChapterThreeEvening,
  eveningRecord, EVENING_WINDOW } from "./ch3-story-wiring.js";
import { loverMilestonesDue, readLoverMilestone } from "./lover-entry.js";
import { questionVisitDue, playQuestionVisit, finaleAtVisit, playFinale } from "../daily/bonds.js";
import { runMukaiShift, loadMukaiShift, MUKAI_PAY, MUKAI_SHIFT_STAMINA } from "./tokyo-mukai.js";

export const TOKYO = "tokyo";
const BG = name => bgUrl(name, timeOfDay());
const CALL_NIGHT_FLAG = "_ch3_tokyo_call_night"; // 遠くからの電話を受けた夜（通算日）。同じ夜に二度届けない

// ---- 寄り道の置き場所 ------------------------------------------------------------------
// 任意の場面の location を、東京の地図の行き先へ。電話の場面は夜の予定として届く（行動を使わない）。
const PLACE_OF_LOCATION = Object.freeze({
  mukai: "mukai", "東京の問屋": "mukai", "ましろの部屋": "mukai",
  "煙幕": "enmaku", "鉄の煙": "volk",
});
const CALL_SCENES = Object.freeze(["ch3_minto_small_lies", "ch3_tsumugi_slump", "hiyori_tokyo_contact"]);
const isCall = id => CALL_SCENES.includes(id);
const optionalPlace = scene => isCall(scene.id) ? null : PLACE_OF_LOCATION[scene.location] || null;

let routes = null;
let optional = [];
/** 寄り道の候補を引き直す（地図を開くたび・訪問のたび）。 */
async function refreshOptional() {
  routes ||= await loadStoryRoutes();
  optional = availableOptionalScenes(routes, state);
  return optional;
}
const optionalAt = place => optional.filter(scene => optionalPlace(scene) === place);

// ---- 本筋の場面 -------------------------------------------------------------------------
const nextScene = (value = state) => chapterThreeScenes(value)[chapterThreeProgress(value).stage] || null;
const planOf = scene => scene ? CH3_DAILY_PLAN[scene.id] || null : null;
const tokyoDay = (value = state) => chapterDay(value);

/** 今の時間帯に読む、昼の行動を使う本筋の場面（日付を過ぎていれば遅れても読む）。 */
function dueSlotScene(value = state) {
  const scene = nextScene(value), plan = planOf(scene);
  if (!plan || plan.kind !== "slot") return null;
  const day = tokyoDay(value);
  return day > plan.day || day === plan.day && value.slot >= plan.slot ? scene : null;
}
/** 今夜読む本筋の場面（日付を過ぎていれば遅れても読む）。 */
function dueNightScene(value = state) {
  const scene = nextScene(value), plan = planOf(scene);
  return plan?.kind === "night" && tokyoDay(value) >= plan.day ? scene : null;
}

/** 大会前の東京の最後の朝（DAY14）の通算日。 */
export const tokyoTournamentDay = (value = state) => chapterThreeProgress(value).startDay + 13;

// ---- 行き先 -----------------------------------------------------------------------------
const spot = fields => Object.freeze({ region: TOKYO, kind: "ch3_tokyo", ...fields });
const visitBg = { mukai: "bg_mukai_shop", enmaku: "bg_yohaku_shop", steve: "bg_steve_shop", volk: "bg_volk_shop" };
export const CH3_TOKYO_SPOTS = Object.freeze([
  spot({ id: "ch3_tokyo_mukai", place: "mukai", label: "mukai", area: "高架下の商店街", x: 29.6, y: 62.7, theme: "baito", glyph: "店",
    face: "mukai_master", preview: "bg_mukai_shop", desc: "働かせてもらっている店。手伝い、ましろちゃんとの時間、作業台。帰りに裏口のてつこにも会える。" }),
  spot({ id: "ch3_tokyo_enmaku", place: "enmaku", label: "煙幕", area: "久世の店", x: 45.3, y: 49.7, theme: "rival", glyph: "煙",
    face: "kuze", preview: "bg_yohaku_shop", desc: "久世の店。お茶と、ノートの続き。", met: "kuze" }),
  spot({ id: "ch3_tokyo_steve", place: "steve", label: "Smoke & Glory", area: "スティーブの店", x: 23.3, y: 36.1, theme: "rival", glyph: "煙",
    face: "steve", preview: "bg_steve_shop", desc: "タイマーの並ぶ店。", met: "steve" }),
  spot({ id: "ch3_tokyo_volk", place: "volk", label: "鉄の煙", area: "ヴォルクの店", x: 55.9, y: 40.4, theme: "rival", glyph: "煙",
    face: "volk", preview: "bg_volk_shop", desc: "計器の並ぶ店。", met: "volk" }),
  spot({ id: "ch3_tokyo_park", place: "park", label: "公園", area: "池のある公園", x: 69, y: 62, theme: "park", glyph: "園",
    preview: "bg_street", stamina: 20, desc: "何も決めずに歩いて、少し体を休める。" }),
  spot({ id: "ch3_tokyo_shop", place: "shop", label: "Dr.fookah 東京店", area: "駅前の店", x: 15, y: 51, theme: "shop", glyph: "卸",
    preview: "bg_fookah_showroom", desc: "東京の店。葉を買える（時間は使わない）。" }),
  spot({ id: "ch3_tokyo_gym", place: "gym", label: "CHOI-ZAP", area: "高架下のジム", x: 34.9, y: 75.9, theme: "gym", glyph: "体",
    preview: "bg_choizap", stamina: -8, stat: "charm", desc: "全国の店で使える会員証で、体を動かす。" }),
  spot({ id: "ch3_tokyo_shrine", place: "shrine", label: "路地裏の神社", area: "路地の奥", x: 54, y: 70, theme: "rest", glyph: "社",
    preview: "bg_street", desc: "学んだことを火にして、心得の盤に灯す（時間は使わない）。" }),
  // 店名は入口で知る（DJS12）。店主の針間ヨルに会うまでは「地下の店」と出す（daily/map.js の charId・unknownLabel）。
  spot({ id: "ch3_tokyo_club", place: "club", label: "クラブSEAM", area: "路地の地下", x: 86, y: 50, theme: "stadium", glyph: "♪",
    charId: "yoru", unknownLabel: "地下の店", unknownDesc: "地下から低い音がする。のぞいてみる（時間は使わない）。",
    preview: "bg_club_seam_entrance", desc: "セットを選んで曲をつなぐ（時間は使わない）。" }),
  spot({ id: "ch3_tokyo_room", place: "room", label: "mukaiの奥の部屋", area: "店の奥", x: 45, y: 63, theme: "rest", glyph: "休",
    preview: "bg_mukai_shop", stamina: 55, desc: "寝泊まりしている部屋で休む。体力が大きく戻る。" }),
  spot({ id: "ch3_tokyo_lime", place: "lime", label: "地元と連絡", area: "スマホ", x: 8, y: 84, theme: "rest", glyph: "☎",
    preview: "bg_street", desc: "地元の恋人・知り合いとLIMEで話す。東京へ来る約束もここで（時間は使わない）。" }),
].map(entry => Object.freeze({ ...entry, hasNew: () => spotHasNew(entry) })));

function spotHasNew(entry) {
  if (["mukai", "enmaku", "volk"].includes(entry.place) && optionalAt(entry.place).length) return true;
  if (entry.place === "mukai") return mukaiBondDue() || outingsAt("mukai").some(outing => !outing.repeat);
  return outingsAt(entry.place).some(outing => !outing.repeat);
}

const outingsAt = place => chapterThreeOutingCandidates(state).filter(outing => outing.place === place && outing.id !== "tetsuko");
const mukaiBondDue = () => loverMilestonesDue(["mashiro"]).length > 0 || questionVisitDue("mashiro") || finaleAtVisit("mashiro");

/** 今の時間・物語の時点で地図に出す行き先。 */
export function chapterThreeTokyoSpots() {
  const night = state.slot >= 1;
  return CH3_TOKYO_SPOTS.filter(entry => {
    if (entry.met && !state.met?.[entry.met]) return false;
    if (["enmaku", "steve", "volk"].includes(entry.place)) return optionalAt(entry.place).length > 0 || outingsAt(entry.place).length > 0;
    if (entry.place === "gym") return !!state.flags._gym_member;
    if (entry.place === "shrine") return canReflect(state);
    if (entry.place === "club") return night;
    return true;
  }).concat([fortuneSpot(TOKYO)].filter(Boolean)); // 路上占い師は東京にも現れる（章で1〜2回・理由は語らない。VOL15）
}

// ---- 読む -------------------------------------------------------------------------------
/**
 * 章の側の読み方（ch3.js の readScene: 名乗りの巻き戻し・告白の返事・作戦の選択）を使うと、HUD が章のカード用に
 * 差し替わるので、読み終えたら日常ループの HUD を戻す。
 */
async function keepDailyHud(task) {
  const root = layers.hud.firstElementChild;
  try { return await task(); }
  finally {
    if (root && !root.isConnected) layers.hud.replaceChildren(root);
    showHud(true);
  }
}

/** 読み終えたら true。中断・LOADは false（代金・体力・既読を残さない）。 */
async function readPlain(id, bg, owner) {
  if (bg) await setBg(BG(bg), { instant: true });
  if (state !== owner) return false;
  const result = await play(DB.dialogues[id], bg ? { bg: BG(bg) } : {});
  return state === owner && !!result && !result.cancelled;
}

// ---- 章定義 -----------------------------------------------------------------------------
/**
 * @param io.readScene (scene { id, bg }) => Promise<boolean> 章の側の読み方（ch3.js）
 * @param io.openRuleSheet () => Promise 受付の規則
 */
export function chapterThreeTokyoDefinition(io) {
  return {
    get untilDay() { return tokyoTournamentDay(state); },
    tournamentName: "HAZE: NATIONAL TOKYO",
    get nightEvents() { const event = tokyoNightEvent(io); return event ? { [state.day]: event } : {}; },
    slotEvent: () => tokyoSlotEvent(io),
    mapOptions: () => ({
      regionId: TOKYO,
      regions: [{ id: TOKYO, label: "東京", background: () => bgUrl(`bg_tokyo_map_${timeOfDay()}`), spots: chapterThreeTokyoSpots }],
      onRegionChange: () => {},
    }),
    // 夜は mukai の奥の部屋で寝る（地元へは帰らない）。地元の帰り道の一言・道での出会いは出さない（_home_tonight）。
    // 東京でも寝る前の家シーシャを選べる（荷物に詰めてきた台・VOL12）。
    beforeHomecoming: async () => {
      state.flags._home_tonight = true;
      await setBg(BG("bg_mukai_shop"), { instant: true });
      return true;
    },
    beforeInvitation: () => true,
    wakeBackground: () => "bg_mukai_shop",
    // 地元の恋人のデートの誘いは東京では受けられない（東京へ来る約束は「地元と連絡」から）。
    dateInvitations: false,
    spotById: id => CH3_TOKYO_SPOTS.find(entry => entry.id === id) || null,
    performSpot: (entry, options) => performTokyoSpot(entry, io, options),
    // ムカイさんの LIME で呼ばれたシフト（VOL10。daily/calendar.js の約束から）
    mukaiShift: ({ called = false } = {}) => mukaiShift(state, { called }),
  };
}

/** 東京の14日を日常ループで回す。大会の朝（DAY14）か LOAD で戻る。 */
export async function runChapterThreeTokyo(io) {
  const owner = state;
  const [, , , definitions] = await Promise.all([
    readDialogues("ch3_outings", OUTING_IDS).then(found => Object.assign(DB.dialogues, found)),
    readDialogues("ch3_activities", ["ch3_choizap_day", "ch3_choizap_night"]).then(found => Object.assign(DB.dialogues, found)),
    readDialogues("ch3_tokyo_daily", TOKYO_DAILY_IDS).then(found => Object.assign(DB.dialogues, found)),
    loadMukaiShift(),
    import("./ch3-social.js").then(social => social.loadTokyoSocial()),
    refreshOptional(),
  ]);
  if (state !== owner) return;
  socialDefinitions = definitions;
  state.flags._ch2_region = TOKYO;
  state.phase = "daily";
  save();
  await runDaily(chapterThreeTokyoDefinition(io));
}

const OUTING_IDS = ["ch3_outing_mukai_help_lost", "ch3_outing_mukai_help", "ch3_outing_enmaku_notes", "ch3_outing_enmaku_answer",
  "ch3_outing_mukai_steve", "ch3_outing_steve_timer", "ch3_outing_park_walk_day", "ch3_outing_park_walk_night", "ch3_outing_tetsuko"];
export const TOKYO_DAILY_IDS = Object.freeze(["ch3_tokyo_room_rest", "ch3_tokyo_fortune"]);

// ---- 昼の行動を使う場面・約束 ----------------------------------------------------------
function tokyoSlotEvent(io) {
  const scene = dueSlotScene();
  if (scene) return { run: () => readStorySlot(io) };
  const visit = dueVisitNow();
  if (visit) return {
    beat: visit.plan.met ? `${visit.name}と、東京の街を歩く約束の時間だ──` : `${visit.name}を、東京駅へ迎えに行く時間だ──`,
    run: () => meetTokyoVisitor(visit),
  };
  return null;
}

/** 今の時間帯（昼／夜の行動）が恋人の東京訪問の約束か。前夜（d13-night）は夜の予定の方で扱う。 */
function dueVisitNow() {
  const day = tokyoDay();
  const base = TOKYO_FREE_TIMES_V3.find(window => window.day === day && window.slot === state.slot);
  if (!base || base.id === EVENING_WINDOW) return null;
  const window = tokyoTime(state, base);
  if (timeNumber(window) !== timeNumber(state)) return null;
  const plan = dueTokyoVisit(state, window);
  const definitions = tokyoDefinitions();
  if (!plan || !definitions) return null;
  const eligible = visitContacts(state, definitions).includes(plan.characterId)
    && (!plan.met || !state.flags._story_shuraba_unresolved);
  return eligible ? { plan, window, definitions, name: displayName(plan.characterId, state, { context: "private" }) } : null;
}
let socialDefinitions = null;
const tokyoDefinitions = () => socialDefinitions;

async function meetTokyoVisitor({ plan, window, definitions }) {
  const owner = state, id = plan.characterId, kind = plan.met ? "date" : "meetup";
  if (!await readPlain(`ch3_visit_${id}_${kind}`, window.slot ? "bg_street_night" : "bg_street_day", owner)) return false;
  if (!completeTokyoVisitAction(state, definitions, plan.id, window)) return false;
  save();
  if (kind === "date" && loverMilestonesDue([id]).length) await readLoverMilestone(id);
  return state === owner;
}

/** 昼の行動を使う本筋の場面を一つ（同じ時間帯に続く場面はまとめて）。 */
async function readStorySlot(io) {
  const owner = state;
  for (let scene = dueSlotScene(), first = true; scene; scene = dueSlotScene(), first = false) {
    const plan = planOf(scene);
    // 同じ時間帯に続く場面だけをまとめる（DAY11の昼: 昨日とは違う今日 → 予想の外側）。
    if (!first && !(plan.day === tokyoDay() && plan.slot === state.slot)) break;
    if (!await readStory(io, scene) || state !== owner) return false;
    if (!completeChapterThreeScene(state, scene.id)) return false;
    save();
    if (scene.id === "ch3_mukai_arrival" || scene.id === "ch3_opening") break; // 到着日は昼と夜で一場面ずつ
  }
  return state === owner;
}

/** 本筋の一場面。受付（登録と規則）と初出勤（配達）は今の東京の行程と同じ手順。 */
async function readStory(io, scene) {
  const owner = state;
  if (scene.id === "ch3_opening") {
    return keepDailyHud(async () => {
      if (!state.flags._ch3_opening_read) {
        if (!await io.readScene(scene)) return false;
        state.flags._ch3_opening_read = true;
        save();
      }
      if (!state.flags._ch3_registration_read) {
        if (!await io.readScene({ id: "ch3_registration", bg: "bg_tournament_stage" })) return false;
        state.flags._ch3_registration_read = true;
        save();
      }
      if (!state.flags._ch3_rules_read) {
        await io.openRuleSheet();
        if (state !== owner) return false;
        state.flags._ch3_rules_read = true;
        save();
      }
      return true;
    });
  }
  if (scene.id === "ch3_mukai_intro") {
    return keepDailyHud(() => runMukaiDeliveryWork(state, { read: step => io.readScene(step), save, isCurrent: () => state === owner }));
  }
  return keepDailyHud(() => io.readScene(scene));
}

// ---- 夜の予定 ---------------------------------------------------------------------------
function tokyoNightEvent(io) {
  const scene = dueNightScene();
  if (scene) return {
    id: `tokyo-night:${scene.id}`, schedule: "fixed", pin: scene.location === "mukai" ? "ch3_tokyo_mukai" : null,
    label: scene.label, beat: `夜。${scene.location}へ──`,
    done: () => !dueNightScene(),
    run: () => readStoryNight(io),
  };
  const call = dueCall();
  if (call) return {
    id: `tokyo-call:${call.id}`, schedule: "fixed", pin: null, label: call.label, beat: "夜。奥の部屋で、スマホが震えた──",
    done: () => state.flags[CALL_NIGHT_FLAG] === state.day || !dueCall(),
    run: () => readCall(io, call),
  };
  return null;
}

async function readStoryNight(io) {
  const owner = state;
  for (let scene = dueNightScene(); scene; scene = dueNightScene()) {
    if (!await readStory(io, scene) || state !== owner) return;
    if (!completeChapterThreeScene(state, scene.id)) return;
    save();
    if (scene.id === "ch3_tournament_eve") await settleEvening(io);
  }
  await refreshOptional();
}

/** 前夜の過ごし方（大会前夜の場面の後）。約束のある恋人がいれば一緒に過ごし、無ければ休む。 */
async function settleEvening(io) {
  if (state.flags._ch3_evening) return;
  const owner = state, definitions = tokyoDefinitions() || await (await import("./ch3-social.js")).loadTokyoSocial();
  routes ||= await loadStoryRoutes();
  const window = tokyoTime(state, TOKYO_FREE_TIMES_V3.find(entry => entry.id === EVENING_WINDOW));
  const result = selectChapterThreeEvening(routes, state, definitions, window);
  for (const id of result.scenes) {
    if (!await keepDailyHud(() => io.readScene({ id, bg: "bg_street_night" })) || state !== owner) return;
  }
  // 前夜デートは訪問デートと同じ一回の散歩。訪問の記録を済ませる（ch3_visit_*_date は再生しない）。
  if (result.kind === "date") {
    for (const plan of syncTokyoVisits(state).plans) {
      if (plan.met && !plan.dateDone && plan.date.id === EVENING_WINDOW && result.participants.includes(plan.characterId)) plan.dateDone = true;
    }
  }
  state.flags._ch3_evening = eveningRecord(result);
  save();
  if (result.kind === "date") for (const id of result.participants) if (loverMilestonesDue([id]).length) await readLoverMilestone(id);
}

function dueCall() {
  if (state.flags[CALL_NIGHT_FLAG] === state.day) return null;
  return optional.find(scene => isCall(scene.id)) || null;
}

async function readCall(io, call) {
  const owner = state;
  state.flags[CALL_NIGHT_FLAG] = state.day;
  if (!await keepDailyHud(() => io.readScene(call)) || state !== owner) return;
  commitOptionalRead(state, call.id);
  save();
  await refreshOptional();
}

// ---- 行き先の処理 -------------------------------------------------------------------------
const unused = { used: false, exerted: false };

async function performTokyoSpot(entry, io, { staminaGuard }) {
  if (entry.region !== TOKYO) return null;
  const owner = state;
  await refreshOptional();
  if (entry.place === "shop") { await openShop({ branch: "tokyo" }); return unused; }
  if (entry.place === "lime") {
    const social = await import("./ch3-social.js");
    await keepDailyHud(() => social.openTokyoLime({}));
    return unused;
  }
  if (entry.place === "shrine") { await keepDailyHud(() => reflectAt("tokyo_shrine")); return unused; }
  if (entry.place === "club") {
    const club = await import("../daily/dj-club.js");
    await keepDailyHud(() => club.visitDjClub({ isCurrent: () => state === owner }));
    return unused;
  }
  if (entry.place === "room") {
    if (!await readPlain("ch3_tokyo_room_rest", "bg_mukai_shop", owner)) return unused;
    addStamina(entry.stamina);
    return { used: true, exerted: false };
  }
  if (entry.place === "park") return goOuting(outingById("park_walk"), staminaGuard, owner);
  if (entry.place === "gym") return goGym(entry, staminaGuard, owner);
  if (entry.place === "mukai") return visitMukai(io, staminaGuard, owner);
  return visitRivalShop(entry, io, staminaGuard, owner);
}

const outingById = id => chapterThreeOutingCandidates(state).find(outing => outing.id === id) || null;

/** 東京の外出（#1655 の行き先）を一つ。代金・体力・回数・好感度・能力は読み終えた時だけ。 */
async function goOuting(outing, staminaGuard, owner) {
  if (!outing) return unused;
  if (outing.stamina < 0 && !(await staminaGuard(outing.stamina))) return unused;
  const bg = outing.bg || visitBg[outing.place] || "bg_street";
  if (!await readPlain(outingDialogueId(state, outing), bg, owner)) return unused;
  addStamina(outing.stamina);
  if (outing.money) addMoney(outing.money);
  if (outing.stat) earnStat(outing.stat, 4);
  for (const [who, pts] of Object.entries(outing.affinity || {})) gainAffinity(who, pts);
  state.flags[OUTINGS_FLAG] = { ...outingCounts(state), [outing.id]: (outingCounts(state)[outing.id] || 0) + 1 };
  if (outing.money) toast(`+${outing.money.toLocaleString("ja-JP")}円`, { kind: "good" });
  return { used: true, exerted: outing.stamina < 0 };
}

async function goGym(entry, staminaGuard, owner) {
  if (!(await staminaGuard(entry.stamina))) return unused;
  if (!await readPlain(state.slot ? "ch3_choizap_night" : "ch3_choizap_day", "bg_choizap", owner)) return unused;
  addStamina(entry.stamina);
  earnStat(entry.stat, 4);
  return { used: true, exerted: true };
}

/** 寄り道を一つ読む（行動を一つ使う）。台本の能力・好感度の報酬は日常ループの行動の中で効く。 */
async function readOptionalHere(io, scene, staminaGuard, owner, stamina = -10) {
  if (!(await staminaGuard(stamina))) return unused;
  if (!await keepDailyHud(() => io.readScene(scene)) || state !== owner) return unused;
  commitOptionalRead(state, scene.id);
  addStamina(stamina);
  await refreshOptional();
  return { used: true, exerted: true };
}

/** 煙幕・Smoke & Glory・鉄の煙: 寄り道があればそれ、無ければその店の外出（#1655）。 */
async function visitRivalShop(entry, io, staminaGuard, owner) {
  const choices = [
    ...optionalAt(entry.place).map(scene => ({ label: scene.label, value: `scene:${scene.id}` })),
    ...outingsAt(entry.place).map(outing => ({ label: `${outing.label.replace(/\s*に(顔を出す|寄る)$/, "")}：${typeof outing.reason === "string" ? outing.reason : outing.label}`, value: `outing:${outing.id}` })),
  ];
  if (!choices.length) { toast("今日は、話すことが思いつかない"); return unused; }
  const pick = choices.length === 1 ? choices[0].value : await modal({ title: entry.label, className: "tokyo-visit-choice",
    body: "何をしに行こう。", options: [...choices.map((choice, index) => ({ ...choice, test: `tokyo-${entry.place}-${index}` })),
      { label: "やめておく", value: null, test: "tokyo-visit-cancel" }] });
  if (!pick || state !== owner) return unused;
  const [kind, id] = pick.split(":");
  if (kind === "scene") return readOptionalHere(io, optional.find(scene => scene.id === id), staminaGuard, owner);
  return goOuting(outingById(id), staminaGuard, owner);
}

/**
 * mukai: 店を手伝う（日当）・ましろちゃんとの時間（寄り道・♥3の質問・締めくくり・恋人の節目）・店番・作業台。
 * 行動を使った帰りに、裏口のてつこの様子を見ていける（行動は使わない・体力が少し戻る。VOL11）。
 */
async function visitMukai(io, staminaGuard, owner) {
  const bond = loverMilestonesDue(["mashiro"]).length ? "lover" : questionVisitDue("mashiro") ? "question" : finaleAtVisit("mashiro") ? "finale" : null;
  const scenes = optionalAt("mukai");
  const outings = outingsAt("mukai");
  const trials = availableChapterThreeTrials(state);
  const options = [
    ...(bond ? [{ label: bond === "lover" ? "ましろちゃんと過ごす（恋人）" : bond === "question" ? "ましろちゃんと話す" : "ましろちゃんに呼ばれる", value: `bond:${bond}` }] : []),
    ...scenes.map(scene => ({ label: scene.label, value: `scene:${scene.id}` })),
    ...outings.map(outing => ({ label: outing.id === "mukai_help" ? `シフトに入る（バイト・日当 ${MUKAI_PAY.toLocaleString("ja-JP")}円）` : outing.label, value: `outing:${outing.id}` })),
    ...trials.map(trial => ({ label: `作業台で${trial.label}（時間は進まない）`, value: `trial:${trial.id}` })),
  ];
  const pick = await modal({ title: "mukai", className: "tokyo-visit-choice", body: "何をしよう。",
    options: [...options.map((option, index) => ({ ...option, test: `tokyo-mukai-${index}` })), { label: "やめておく", value: null, test: "tokyo-visit-cancel" }] });
  if (!pick || state !== owner) return unused;
  const [kind, id] = pick.split(":");
  let result = unused;
  if (kind === "trial") {
    const trial = await import("./ch3-trials.js");
    await keepDailyHud(() => trial.runChapterThreeTrial(id, { isCurrent: () => state === owner }));
    return unused;
  }
  if (kind === "bond") result = await readMashiroBond(id, staminaGuard, owner);
  else if (kind === "scene") result = await readOptionalHere(io, optional.find(scene => scene.id === id), staminaGuard, owner);
  else if (id === "mukai_help") result = await (await staminaGuard(MUKAI_SHIFT_STAMINA) ? mukaiShift(owner) : false)
    ? { used: true, exerted: true } : unused;
  else result = await goOuting(outingById(id), staminaGuard, owner);
  if (result.used && state === owner) await offerTetsuko(owner);
  return result;
}

/** mukai のシフト（VOL09）。導入は手伝いの場面（味が戻る前後で読み分け）。回数は手伝いの記録に数える。 */
async function mukaiShift(owner, { called = false } = {}) {
  const help = outingById("mukai_help");
  if (!help || state !== owner) return false;
  const done = await runMukaiShift({ called, intro: () => readPlain(outingDialogueId(state, help), "bg_mukai_shop", owner) });
  if (!done || state !== owner) return false;
  state.flags[OUTINGS_FLAG] = { ...outingCounts(state), mukai_help: (outingCounts(state).mukai_help || 0) + 1 };
  return true;
}

async function readMashiroBond(kind, staminaGuard, owner) {
  if (!(await staminaGuard(-10))) return unused;
  const bg = BG("bg_mukai_shop");
  await setBg(bg, { instant: true });
  let done = false;
  if (kind === "lover") done = await readLoverMilestone("mashiro");
  else if (kind === "question") done = await playQuestionVisit("mashiro", { bg });
  else done = await playFinale("mashiro", { bg });
  if (!done || state !== owner) return unused;
  addStamina(-10);
  gainAffinity("mashiro", 5);
  return { used: true, exerted: true };
}

/** 帰りに裏口のてつこへ（行動を使わない）。会うかどうかは選べる。 */
async function offerTetsuko(owner) {
  const outing = outingById("tetsuko");
  if (!outing) return;
  const go = await modal({ title: "裏口のてつこ", body: "帰りに裏口をのぞくと、看板猫のてつこがベンチで丸くなっている。",
    options: [{ label: "少し構っていく", value: true, test: "tokyo-tetsuko-yes", primary: true }, { label: "今日はそっとしておく", value: false, test: "tokyo-tetsuko-no" }] });
  if (!go || state !== owner) return;
  if (!await readPlain(outingDialogueId(state, outing), outing.bg || "bg_street", owner)) return;
  addStamina(outing.stamina);
  state.flags[OUTINGS_FLAG] = { ...outingCounts(state), tetsuko: (outingCounts(state).tetsuko || 0) + 1 };
  toast(outing.toast || "てつこに、少し元気をもらった", { kind: "good" });
}
