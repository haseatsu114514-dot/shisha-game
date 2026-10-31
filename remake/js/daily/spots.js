// 第1章のスポット定義と「行く」の中身（訪問・施設・休む）。
// どの行動にも必ず報酬（好感度・ステ・体力・お金のどれか）が付く。
import { state, markMet } from "../core/state.js";
import { growthEnabled, hidaneTotal } from "../core/growth.js";
import { refreshPlaceCue } from "../core/transitions.js";
import { DB } from "../core/data.js";
import { earnStat, gainAffinity, addStamina, addMoney, affinityLevel, releaseAffinity, AFFINITY_RANK_PTS, setStoryAffinityCap, ensureAffinityLevel } from "../core/stats.js";

import { play } from "../vn/engine.js";
import { playBgm } from "../core/audio.js";
import { isRainy, RAIN_SPOT_TEXTS } from "./weather.js";
import { samechanSpot, samechanVisitDialogue } from "./samechan.js";
import { cinemaSpot, visitCinema } from "./cinema.js";
import { cinemaDiscovered, cinemaIntroductionDue } from "../core/cinema-discovery.js";
import { afterStory, questionVisitDue, playQuestionVisit, finaleAtVisit, playFinale } from "./bonds.js";
import { installReel } from "./reel.js";
import { toast } from "../core/ui.js";
import { cafeIdeaDue, pickCafeIdea, ideaDialogue, markCafeIdea } from "./cafe-ideas.js";
import { syncMintoKnowledge } from "../core/story-knowledge.js";
import { meetHiyoriAtTonari, hiyoriShopEncounterDue } from "./hiyori.js";
import { tsumugiAtTonari } from "./tsumugi-schedule.js";
import { trpgSpot, maybeRecruitTrpgMember } from "./trpg.js";
import { AXE_BAR } from "./axe-bar-data.js";
import { axeBarDiscovered } from "../core/axe-bar-discovery.js";
import { fortuneRumorHeard, fortuneOpenOn } from "./fortune-schedule.js";
import { openingStatus, rinUnavailable } from "./spot-hours.js";

import { spotEncounterDue, quietSpotPool, recordSpotEncounter, spotFollowupDue } from "./spot-encounters.js";

export const VISIT_COST = 3000;

// キャラ別の「通うと伸びる」主要ステ（ch1の6人で5種を一通りカバー）
export const CHAR_STAT = { sumi: "technique", tsumugi: "sense", naru: "insight", adam: "guts", minto: "charm", rin: "sense" };

// 固有会話の順番。特別回（常連回・総督回など）は関係ができた頃合いに一度だけ挟む
export { VISIT_SEQ } from "../core/affinity-stages.js";
import { VISIT_SEQ } from "../core/affinity-stages.js";
const REPEAT_POOL = {
  rin: ["ch1_rin_repeat", "ch1_rin_repeat_b", "ch1_rin_repeat_c"],
};
// 固有会話をいくつ見たら LIME を交換済みとみなすか（交換シーンは固有会話の中にある）
// アダムは総督回を挟むので、交換の場面（ch1_adam_third）は4本目
const LIME_EXCHANGE = { naru: 2, adam: 4, minto: 1, tsumugi: 2, sumi: 1, rin: 2 };

// 背景（訪問先）
export const VISIT_BG = {
  sumi: "bg_tonari_inside", tsumugi: "bg_tonari_inside",
  naru: "kemurikusa", adam: "bg_eden_shop", minto: "peppermint", rin: "bg_fookah_showroom",
};

/**
 * マップのスポット。x/y はマップ（bg_osu_map）上の位置（%）。店舗は看板のしっぽ、施設は絵の中心が指す地点。
 * 施設絵は絵の中心を地点へ合わせる。観音堂は背景のお堂、家は右側の住宅、占いはアーケード脇。
 * kind: tonari（サブメニュー）/ rival（店主に会う）/ shop / spot（施設）/ rest
 * theme: 看板の色 / glyph: 顔ドット絵が無いときの一文字 / face: 看板に出す顔（面識があれば）
 * label: 看板の下の店名・施設名（店は「へ行く」を足す）
 * closedOn: day % 7 がこの値の日は定休日
 */
export const SPOTS = [
  AXE_BAR,
  { id: "tonari", kind: "tonari", label: "tonari", area: "バイト先", x: 86, y: 36, theme: "baito", glyph: "店", face: "sumi",
    desc: "バイト先のシーシャラウンジ。客として一服するか、シフトに入るか。" },
  { id: "naru", kind: "rival", charId: "naru", label: "KEMURIKUSA", area: "商店街の外れ", x: 70, y: 24, theme: "rival", glyph: "煙", face: "naru", cost: VISIT_COST, closedOn: 3,
    desc: "焼き菓子みたいな甘い匂いの人気店。腕のいい若い店員がいると評判らしい。", stamina: -16 },
  { id: "adam", kind: "rival", charId: "adam", label: "EDEN", area: "下町", x: 46, y: 48, theme: "rival", glyph: "煙", face: "adam", cost: VISIT_COST, closedOn: 5,
    desc: "アニスの甘い香りが漏れてくる店。注文はなぜかいつもダブルアップル。", stamina: -16 },
  { id: "minto", kind: "rival", charId: "minto", label: "PEPPERMINT", area: "繁華街", x: 28, y: 62, theme: "rival", glyph: "煙", face: "minto", cost: VISIT_COST, closedOn: 6,
    desc: "SNSで人気のポップな店。コンカフェ風の接客らしい。", stamina: -16 },
  { id: "shop", kind: "shop", label: "Dr.fookah", area: "問屋街", x: 36, y: 30, theme: "shop", glyph: "卸",
    desc: "1階の買い物は昼夜とも時間消費なし。2階のショールームで相談できるのは夜だけ。" },
  { id: "cafe", kind: "spot", label: "喫茶こはく", area: "繁華街", x: 72, y: 45, theme: "cafe", glyph: "珈", cost: 800, requiresMet: "naru", stat: "sense", stamina: -4,
    first: "ch1_cafe_visit", pool: ["cafe_herb_tea", "cafe_counter_watch", "cafe_crowd", "cafe_naru_break", "cafe_master_quiz"], bg: "bg_cafe",
    openSlots: [0], desc: "昼だけ開く、なる行きつけの喫茶。ラテと焼き菓子でひと息。常連の小話も聞こえる。" },
  { id: "kannon", kind: "spot", label: "観音堂", area: "古町", x: 18, y: 57, theme: "park", glyph: "観", requiresMet: "adam", stat: "guts", stamina: -4,
    first: "ch1_kannon_visit", pool: ["kannon_cat", "kannon_sweep", "kannon_adam", "kannon_oldman"], bg: "bg_kannon_day",
    nightPool: ["venue_kannon_night", "venue_kannon_night_b"],
    desc: "街の小さなお堂。昼は猫や街の人と会い、夜は静かな境内で今日を振り返る。" },
  { id: "choizap", kind: "spot", label: "CHOI-ZAP", area: "ジム", x: 20, y: 24, theme: "gym", glyph: "筋", requiresMet: "minto", stat: "charm", stamina: -8,
    first: "ch1_choizap_first", pool: ["choizap_lesson", "choizap_mirror", "choizap_oldman", "choizap_minto"], bg: "bg_choizap",
    nightPool: ["venue_choizap_night", "venue_choizap_night_b"],
    desc: "昼夜とも使える無人ジム。入会はアプリから。動画でフォームを確かめ、自分のペースで汗を流す。" },
  { id: "c_station", kind: "spot", label: "C.STATION", area: "大会運営", x: 54, y: 66, theme: "stadium", glyph: "C", cost: 2500, requiresMet: "naru", stat: "insight", stamina: -16,
    first: "ch1_c_station_visit", pool: ["cs_staff_greeting", "cs_customer_rumor", "cs_stage_setup", "cs_regular_chat", "cs_nagumo_glimpse", "cs_kemuri_solo", "cs_maezono_taste", "cs_pakki_rehearsal", "cs_prep_line"], bg: "bg_c_station",
    desc: "大会を運営する大型チェーン店。会場は同じビルのイベントホール。噂や大会情報が集まる。" },
  // 路上占い師（旧版 F11）: 週2日だけアーケード脇に出る。時間を使わない・1日1回・相性占い3,000円。
  // 出店日に正式な施設名で表示する。未対面の人物情報は引き続き伏せる。
  { id: "fortune", kind: "fortune", charId: "uranaishi", label: "路上占い", area: "アーケード脇", x: 63, y: 69, theme: "park", glyph: "占",
    desc: "タロットで相性を見てくれる。誰かとの縁を見てもらえるらしい（3,000円・時間はかからない）。",
    unknownDesc: "路地の隅に、見慣れない小さな出店がある。……誰か座っている？" },
  { id: "rest", kind: "rest", label: "家", area: "自宅", x: 89, y: 44, theme: "rest", glyph: "休", stamina: 55,
    desc: "1行動使って体を休める。体力が大きく戻る。" },
];
/** 行き先の中の様子（マップ右下のプレビュー）。入ったときの背景と同じ絵を指す */
export const SPOT_PREVIEW = {
  tonari: "bg_tonari_inside", naru: "kemurikusa", adam: "bg_eden_shop", minto: "peppermint",
  shop: "bg_fookah_showroom", cafe: "bg_cafe", kannon: "bg_kannon_day", choizap: "bg_choizap",
  c_station: "bg_c_station", rest: "bg_home", fortune: "bg_street",
};
/** 第2章以降、SHISHARKを追加。保存を切り替えても古いピンを残さない。 */
/** 好感度の上がらない施設（#621・#784）。自分で選んだ1回の行動で、主な能力1つに2P。
 *  それ以外の行動は従来どおり最大2能力に各1P。 */
export const FACILITY_GROWTH_SPOTS = Object.freeze(["kannon", "choizap", "cafe", "axe_bar", "rojiura_cinema"]);
export const facilityGrowth = (spot) => FACILITY_GROWTH_SPOTS.includes(spot?.id)
  ? { budget: 1, points: 2, primary: spot.stat || null } : {};
export const allSpots = () => [...SPOTS, ...[samechanSpot(), trpgSpot(), cinemaSpot()].filter(Boolean)];
export const spotById = (id) => allSpots().find((s) => s.id === id);

// ---------------------------------------------------------------- 状態の読み取り

export const storyCount = (id) => state.story[id] || 0;
/** 固有会話をもう読んだか。並び順と消化数で決まるので、フラグの無い旧セーブでも同じに分かる */
export function storySeen(dialogueId) {
  for (const [charId, seq] of Object.entries(VISIT_SEQ)) {
    const at = seq.indexOf(dialogueId);
    if (at >= 0) return storyCount(charId) > at;
  }
  return false;
}

const NIGHT_STORIES = new Set([
  "ch1_sumi_training", "ch1_sumi_secret", "ch1_sumi_closing", "ch1_sumi_final",
  "ch1_tsumugi_fifth", "ch1_tsumugi_smoke_color", "ch1_minto_phantom_smell",
]);
/** 通常段階会話は章をまたいでも既存の必要ハートで解放し、最古未読を一訪問一本だけ読む。 */
// 師匠の修業と恋人・専用ルートは、この通常列のハート判定で止めない。
const HEART_STORY_EXEMPT = new Set(["sumi"]);
const heartStoryTarget = (id, s) => !!VISIT_SEQ[id] && !HEART_STORY_EXEMPT.has(id)
  && !(s?.lovers || []).includes(id);
/** 旧公開portは保持するが、通常好感度を会話数で制限しない。 */
export function storyAffinityCap(id, s = state) { return Infinity; }
setStoryAffinityCap(storyAffinityCap);
export function storyHeartReady(charId, index, s = state) {
  if (!heartStoryTarget(charId, s)) return true;
  const need = Math.min(index, AFFINITY_RANK_PTS.length - 1);
  return (s?.affinity?.[charId] || 0) >= AFFINITY_RANK_PTS[need];
}
const storyAvailable = (id) => (!NIGHT_STORIES.has(id) || state.slot >= 1) && storyOpenByHeart(id);
function storyOpenByHeart(id) {
  for (const [charId, seq] of Object.entries(VISIT_SEQ)) {
    const at = seq.indexOf(id);
    if (at >= 0) return storyHeartReady(charId, at);
  }
  return true;
}
/** 店に通って親しくなってから、店内で正体がつながる一度だけの会話。 */
export const mintoIdentityRevealDue = () => !state.flags._minto_identity_revealed
  && storyCount("minto") >= 2 && affinityLevel("minto") >= 3;
/** 夜の2階で試作品を確かめる一度きりの回（#1696）。固有会話3本目の後、新しい話が無い来店で読む。 */
const RIN_PROTOTYPE = "ch1_rin_prototype_night";
const RIN_PROTOTYPE_SEEN = `_spot_seen_${RIN_PROTOTYPE}`;
export const rinPrototypeDue = () => !state.flags[RIN_PROTOTYPE_SEEN]
  && storyCount("rin") >= 3 && !!DB.dialogues[RIN_PROTOTYPE]?.lines?.length;
/**
 * 章が明けて最初の来店で一度だけ読む後日談（#2026）。第1章で実際に通った店主だけ（regulars は
 * 章の切り替え時の記録。ch2-progress.js）。既読は台本末尾の set_flag。第2章の地元の地図だけが入口。
 */
export const AFTER_CHAPTER_VISITS = Object.freeze({
  adam: { chapter: 2, regulars: "_ch1_regulars", scene: "ch1_adam_after_ch1", done: "ch1_adam_after_ch1_done" },
  minto: { chapter: 2, regulars: "_ch1_regulars", scene: "ch1_minto_after_ch1", done: "ch1_minto_after_ch1_done" },
});
export function afterChapterVisitDue(charId, s = state) {
  const entry = AFTER_CHAPTER_VISITS[charId];
  return entry && (s.chapter || 1) === entry.chapter && !s.flags?.[entry.done] && !!s.flags?.[entry.regulars]?.[charId]
    && DB.dialogues[entry.scene]?.lines?.length ? entry.scene : null;
}
/** 次に会うと新しいイベントがあるか（固有会話・途中の質問・好感度MAXの締めくくり）。 */
export function hasNewStory(charId) {
  if (afterChapterVisitDue(charId)) return true;
  if (charId === "minto" && mintoIdentityRevealDue()) return true;
  if (questionVisitDue(charId)) return true;
  if (charId === "rin" && rinPrototypeDue()) return true;
  const id = (VISIT_SEQ[charId] || [])[storyCount(charId)];
  if (id) return storyAvailable(id);
  return questionVisitDue(charId) || finaleAtVisit(charId);
}

/** 実来店と予定表示で、同じ既存repeat（訪問順・雨差分）を読む。状態は進めない。 */
function repeatVisitDialogue(charId) {
  const pool = REPEAT_POOL[charId] || [0, 1, 2, 3].map(i => `remake_repeat_${charId}_${i}`);
  if (charId === "adam" && (state.chapter || 1) >= 2) pool.push("remake_repeat_adam_4");
  const rain = `remake_repeat_${charId}_rain`;
  return isRainy() && affinityLevel(charId) >= 1 && DB.dialogues[rain]
    ? rain : pool[(state.visits[charId] || 0) % pool.length];
}

/** ひよりのsoft priority用。初対面・専用回・紹介・未取得台本を短日常と扱わない。 */
export function shortNormalVisit(spot) {
  const valid = id => !!DB.dialogues[id]?.lines?.length;
  if (spot?.kind === "samechan") {
    if (!state.met?.samechan || cinemaIntroductionDue(state)) return false;
    const receipt = state.flags._samechan_visit;
    const id = receipt?.stamp === `${state.chapter}:${state.day}:${state.slot}`
      ? receipt.dialogue : samechanVisitDialogue();
    return !!id?.startsWith("samechan_shop_repeat_") && valid(id);
  }
  if (spot?.kind === "rival") {
    const id = spot.charId;
    if (!id || !state.met?.[id] || !storyCount(id) || id === "naru" && naruRiftActive(state)
      || hasNewStory(id) || finaleAtVisit(id) || spotFollowupDue(id, state, DB.dialogues)) return false;
    if (id === "naru" && storyCount(id) >= 2 && !state.flags._cafe_introduced
      && DB.dialogues.ch1_naru_cafe_intro) return false;
    return valid(repeatVisitDialogue(id));
  }
  if (spot?.id === "c_station") {
    const n = (state.spotVisits?.[spot.id] || 0) + 1;
    if (n < 2 || !state.reel?.introDone || state.flags._pakki_first_spin_pending
      || state.flags._ev_reviewer_cameo && !state.flags._ev_reviewer_payoff && DB.dialogues.ch1_reviewer_payoff
      || spotEncounterDue(spot.id, n, state, DB.dialogues)) return false;
    const pool = quietSpotPool(spot, state.slot);
    const rain = RAIN_SPOT_TEXTS[spot.id];
    const id = rain && isRainy() && DB.dialogues[rain] ? rain : pool[Math.max(0, n - 2) % pool.length];
    return valid(id);
  }
  return false;
}

/** 店主の固有イベントと、初めて訪れる施設のイベントを同じ印で案内する。 */
export function hasNewEvent(spot) {
  if (isClosed(spot)) return false;
  if (spot.kind === "tonari") return state.visitedDay.tonari_baito !== state.day && hasNewStory("sumi")
    || state.visitedDay.tonari_customer !== state.day && tsumugiAtTonari(state) && hasNewStory("tsumugi");
  if (spot.kind === "shop") return !rinUnavailable(state) && hasNewStory("rin");
  if (spot.charId === "samechan") {
    const scene = samechanVisitDialogue();
    return !!scene && !scene.startsWith("samechan_shop_repeat_") && !!DB.dialogues[scene]?.lines?.length;
  }
  if (spot.charId) return hasNewStory(spot.charId);
  if (!spot.first || !DB.dialogues[spot.first]) return false;
  return spot.id === "choizap" ? !state.flags._gym_member : !(state.spotVisits?.[spot.id] > 0);
}

export function isClosed(spot) {
  return !openingStatus(spot, state).ok || isTemporaryClosed(spot) || spot.closedOn !== undefined && state.day % 7 === spot.closedOn;
}

export function naruRiftActive(save = state) {
  const flags = save?.flags;
  return (save?.chapter || 1) >= 2 && !!(
    flags?._ch2_read_ch2_naru_confrontation
    || flags?._ch2_night_11_done
    || flags?._ch2_naru_listened
    || flags?._ch2_naru_hurt
  );
}

/** 届いたLIMEで知らせた臨時休暇は、その章・その日だけ店にも反映する。なるは対峙後、行き先を告げず修行へ出るため継続して休業にする。 */
export function isTemporaryClosed(spot) {
  return !!spot.charId && (
    state.flags[`_temporary_closed_${spot.charId}`] === `${state.chapter || 1}:${state.day}`
    || spot.charId === "naru" && naruRiftActive(state)
  );
}

export function visitedToday(spotId) {
  return state.visitedDay[spotId] === state.day;
}

export function isUnlocked(spot) {
  // 初回受領後は使い切っても内省の場所を残す。紹介・訪問の記録は変更しない。
  if (spot.id === "kannon" && growthEnabled() && (state.growth?.earned > 0 || hidaneTotal() > 0)) return true;
  if (spot.id === "rojiura_cinema") return cinemaDiscovered(state);
  if (spot.kind === "fortune") return [1, 2].includes(state.chapter) && fortuneRumorHeard(state) && fortuneOpenOn(state.day, isRainy);
  if (spot.id === "axe_bar" && !axeBarDiscovered(state)) return false;
  if (spot.id === "cafe") return !!state.flags._cafe_introduced || (state.spotVisits?.cafe || 0) > 0;
  // 旧保存でも実際に訪れた施設は保持する。面識だけの解放は引き継がない。
  return !spot.requiresMet || !!state.flags[`_spot_guide_${spot.requiresMet}`] || (state.spotVisits?.[spot.id] || 0) > 0;
}

/** マップに出す名前（店主に会う前は店名の看板だけ） */
/** 店種は詳細カードだけに添える。ピン名・ID・保存値は変えない。 */
export function spotDetailLabel(spot) {
  const category = ["tonari", "rival", "samechan"].includes(spot.kind) || spot.id === "c_station"
    ? "シーシャ屋" : spot.kind === "shop" ? "ショップ" : null;
  return category ? `${spot.label}（${category}）` : spot.label;
}

export function hasContact(id) {
  if (state.contacts.includes(id)) return true;
  if (state.flags[`_lime_contact_${id}`] || storyCount(id) >= (LIME_EXCHANGE[id] || 99)) {
    state.contacts.push(id);
    return true;
  }
  return false;
}

// ---------------------------------------------------------------- 訪問

export const bgRef = (name) => `res://assets/backgrounds/${name}.png`;

/**
 * キャラに会う。固有会話が残っていれば次の1本（読んだ直後に途中の質問があれば続けて）。
 * 尽きたら、途中の質問の訪問 → 好感度MAXの締めくくり（一度だけ・専用ハガル）→ 通い訪問の小会話の順。
 * 報酬: 固有会話・締めくくり=好感度+10／通い=好感度+5。通常の主要能力は1P。
 */
const visitsInFlight = new WeakMap();
export async function visitChar(charId, { welcome = null, signal = null } = {}) {
  if (charId === "naru" && naruRiftActive(state)) return false;
  const owner = state;
  const active = visitsInFlight.get(owner) || new Set();
  if (active.has(charId) || signal?.aborted) return false;
  visitsInFlight.set(owner, active); active.add(charId);
  try {
    const live = () => state === owner && !signal?.aborted;
    const read = async (scene, opts = {}) => {
      if (!live()) return false;
      const result = await play(scene, { ...opts, signal });
      return live() && !!result && !result.cancelled;
    };
    if (charId === "sumi") await meetHiyoriAtTonari();
    if (!live()) return false;
    syncMintoKnowledge();
    const visit = (state.visits[charId] || 0) + 1;
    const seq = VISIT_SEQ[charId] || [];
    const idx = storyCount(charId);
    // Keep already-connected legacy saves from repeating the newly early exchange.
    // The original story-count thresholds remain a compatibility path only.
    if (["naru", "adam"].includes(charId) && hasContact(charId)) {
      state.flags[`_lime_contact_${charId}`] = true;
    }
    const bg = bgRef(VISIT_BG[charId] || "bg_tonari_inside");
    const followup = spotFollowupDue(charId, state, DB.dialogues);
    if (followup && !await read(followup, { bg })) return false;
    const afterChapter = afterChapterVisitDue(charId);
    // 施設で交わした話の続きは、店舗の昼夜挨拶より先に返す。章明けの再訪は自前の来店描写があるので挨拶を挟まない。
    if (welcome && state === owner && idx > 0 && !afterChapter && DB.dialogues[welcome]) {
      if (!await read(welcome, { bg })) return false;
    }
    if (afterChapter) {
      // 既読フラグは台本末尾の set_flag。中断では立たず、次の来店で読み直せる。
      if (!await read(afterChapter, DB.dialogues[afterChapter].metadata?.bg ? {} : { bg })) return false;
      gainAffinity(charId, 5);
    } else if (charId === "minto" && mintoIdentityRevealDue() && DB.dialogues.ch1_minto_identity_reveal) {
      // 正体がつながる日の照れた接客を最後まで見せ、通常回は次の来店へ残す。
      if (!await read("ch1_minto_identity_reveal")) return false;
      gainAffinity(charId, 10);
    } else if (questionVisitDue(charId)) {
      // 節目を先に読んだ旧セーブ・♥3未満で外出した場合も、次の実対面で分岐を受け取る。
      if (!await playQuestionVisit(charId, { bg, signal, deferSave: true }) || !live()) return false;
      gainAffinity(charId, 5);
    } else if (idx < seq.length && DB.dialogues[seq[idx]] && storyAvailable(seq[idx])) {
      const opts = DB.dialogues[seq[idx]].metadata?.bg ? {} : { bg };
      // 試供品は完読で受領する。SKIPでは進行を確定せず、次回読み直せるようにする。
      if (charId === "rin" && seq[idx] === "ch1_rin_third") opts.cancelOnSkip = true;
      if (!await read(seq[idx], opts)) return false;
      state.story[charId] = idx + 1;
      gainAffinity(charId, 10);
      // 初回読了と通常獲得はここで確定する。後続の質問・勧誘の中断で保証だけを失わない。
      if (idx === 0) ensureAffinityLevel(charId, 1);
      if (await afterStory(seq[idx], { bg, signal, deferSave: true }) === false || !live()) return false;
    } else if (finaleAtVisit(charId)) {
      if (!await playFinale(charId, { bg, signal, deferSave: true }) || !live()) return false;
      gainAffinity(charId, 10);
    } else if (charId === "rin" && rinPrototypeDue()) {
      if (!await read(RIN_PROTOTYPE, {})) return false;
      state.flags[RIN_PROTOTYPE_SEEN] = true;
      gainAffinity(charId, 5);
    } else {
      const rainy = isRainy();
      const id = repeatVisitDialogue(charId);
      const dlg = DB.dialogues[id];
      const opener = rainy && dlg ? DB.dialogues.remake_rain_opener?.lines || [] : [];
      if (!await read(opener.length ? { ...dlg, lines: [...opener, ...(dlg?.lines || [])] } : id, { bg })) return false;
      gainAffinity(charId, 5);
    }
    if (!live()) return false;
    // 回数は紹介を出す条件だけ。実際の紹介を完読するまで喫茶店を解放しない。
    if (charId === "naru" && storyCount("naru") >= 2 && !state.flags._cafe_introduced
      && DB.dialogues.ch1_naru_cafe_intro) {
      if (!await read("ch1_naru_cafe_intro", { bg })) return false;
      state.flags._cafe_introduced = true;
    }
    // 話の初回・繰り返し・質問回でも、体力を使った訪問の基礎成長を揃える。
    state.visits[charId] = visit;
    releaseAffinity(charId);
    earnStat(CHAR_STAT[charId], 4);
    markMet(charId);
    hasContact(charId); // 交換済みの判定をこの場で記録
    await maybeRecruitTrpgMember(charId);
    if (!live()) return false;
    return true;
  } finally { active.delete(charId); }


}

export async function visitRival(spot) {
  if (!spot || isClosed(spot)) return false;
  refreshPlaceCue(spot.id);
  addMoney(-(spot.cost || 0));
  addStamina(spot.stamina || -16);
  playBgm("tonari");
  // 相席予定の日には「一人占め」の昼挨拶を出さない。台詞正本・実遭遇の処理は維持する。
  const welcome = spot.charId === "minto" && state.slot === 0 && hiyoriShopEncounterDue(spot)
    ? null : `venue_${spot.charId}_${state.slot === 0 ? "day" : "night"}`;
  const owner = state;
  const completed = await visitChar(spot.charId, { welcome });
  // 配達やチュートリアルの面識ではなく、自主来店の会話を終えてから地図に出す。
  if (completed && state === owner) state.flags[`_spot_guide_${spot.charId}`] = true;
  return completed;
}

/** 施設スポット。場所ごとの成長・体力変化と、時々会う街の人の小話。 */
export async function visitSpot(spot) {
  if (spot.id === "rojiura_cinema") return visitCinema();
  if (!openingStatus(spot, state).ok) return false;
  refreshPlaceCue(spot.id);
  if (spot.cost) addMoney(-spot.cost);
  addStamina(spot.stamina || 0);
  state.spotVisits = state.spotVisits || {};
  const n = (state.spotVisits[spot.id] = (state.spotVisits[spot.id] || 0) + 1);
  const owner = state;
  const pool = quietSpotPool(spot, state.slot);
  let id = spot.first;
  if (spot.id === "choizap") {
    if (state.flags._gym_member && pool.length) id = pool[(n - 1) % pool.length];
  } else if ((n > 1 || state.slot === 1 && spot.nightPool) && pool.length) {
    id = pool[Math.max(0, n - 2) % pool.length];
  }
  const encounter = spotEncounterDue(spot.id, n, state, DB.dialogues);
  if (encounter) id = encounter;
  // 雨の日（2回目以降）は雨の回を出す
  const rainId = RAIN_SPOT_TEXTS[spot.id];
  if (rainId && n > 1 && isRainy() && !(state.slot === 1 && spot.nightPool) && DB.dialogues[rainId]) id = rainId;
  // お忍び客の回収: tonari で覆面レビュアーを接客していたら、2回目以降の来店で記事の噂を聞く
  if (spot.id === "c_station" && n > 1 && state.flags._ev_reviewer_cameo && !state.flags._ev_reviewer_payoff && DB.dialogues.ch1_reviewer_payoff) {
    state.flags._ev_reviewer_payoff = true;
    id = "ch1_reviewer_payoff";
  }
  await play(id, { bg: bgRef(spot.bg) }); // bgUrl が昼夜差分（_day/_night）を選ぶ
  if (state !== owner) return;
  recordSpotEncounter(spot.id, id, n, state);
  if (spot.id === "c_station") {
    state.flags._c_station_registered = true;
    await installReel();
  }
  // キャラとの会話があった来店には重ねない（くつろいだ静かな来店だけ）
  if (spot.id === "cafe" && !encounter) await maybeCafeIdea(spot, n);
  earnStat(spot.stat, 4);
}

/** 喫茶こはくのおまけ: くつろいでいると、たまに配合を思いつく（ライバルの話の想起／自分のひらめき） */
async function maybeCafeIdea(spot, visit) {
  const pick = pickCafeIdea(state, DB.recipes || [], { rainy: isRainy() });
  if (!pick || !cafeIdeaDue(state, visit)) return;
  const owner = state;
  await play(ideaDialogue(pick), { bg: bgRef(spot.bg) });
  if (state !== owner) return;
  const combo = markCafeIdea(state, pick, DB.flavors || []);
  toast(`📝 試したい配合をメモした ──「${combo}」（配合の画面でひらめきに出る）`, { kind: "good" });
}

export async function restAtHome(spot, { fullDay = false } = {}) {
  const owner = state;
  addStamina(spot.stamina);
  delete state.flags._cold_pending;
  delete state.flags._overwork;
  state.flags._home_tonight = state.slot >= 1;
  const result = await play(fullDay ? "remake_rest_day" : "remake_rest");
  if (state === owner && owner.chapter === 2 && result && !result.cancelled) owner.flags._ch2_rest_taken = true;
}

/** 好感度の段階（♥の数） */
export const hearts = (id) => affinityLevel(id);
