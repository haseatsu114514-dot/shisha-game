// よその店にふらっと居合わせる人（2026-11-02 オーナー「ひよりみたいに別スポットに現れるキャラを他にも作りたい。
// 他のライバルとかちょい役とかで」「女性ももう少し欲しい。あまり店を持っていない人がいい」）。
// ひよりの相席（daily/hiyori.js）と同じ形:
// - 時間帯ごとに、保存の種で「今いる人（一人まで）と店」を決める。LOAD・地図の描き直しで変わらない
// - 地図の店に顔を出す（spot-people.js）。会ったことのない人は「見知らぬ客」、台詞の名前は？？？
// - その店を訪ねて一服を終えた時だけ、短い会話を読む。代金・体力・能力は店の来店のまま（この会話では増やさない）
// - 読み終えた時だけ回数・好感度・その日の印を残す（中断・LOADでは残さない）
// - 出るのは時間帯の4回に1回ほど。よその店で誰かと話した日は（ひより・隣町からの客も含め）、その日はもう出ない
// - ひより・隣町からの客・つむぎ（tonari）・組長（MELTY PUFF）がいる店、今日もう行った店、閉まっている店には出ない
// 台詞は data/dialogue/roaming_guests.json（roam_<id>_first → _a → _b → _c → _a …）。
import { state, save } from "../core/state.js";
import { DB } from "../core/data.js";
import { seeded } from "../core/util.js";
import { gainAffinity, visitAffinity } from "../core/stats.js";
import { readDialogues } from "../core/chapter-data.js";
import { play, isPlaying } from "../vn/engine.js";
import { on } from "../core/bus.js";
import { allSpots, isUnlocked, isClosed } from "./spots.js";
import { hiyoriShopLocation } from "./hiyori.js";
import { cityGuestVisit } from "./city-guests.js";
import { ryujiAtMeltyPuff, reiGreetingDue } from "../core/ryuji-visit.js";

/** 人ごとの、読み終えた回数（数）。台本の flag_count 条件で読める（第5章の博士の「記録」など）。 */
export const roamSeenFlag = id => `_roam_seen_${id}`;
export const ROAM_DAY_FLAG = "_roam_day"; // 人ごとの、最後に会った日（"章:日"）
/**
 * 一つの時間帯に、誰かがよその店に居合わせる割合（2026-11-02 オーナー「毎回誰かしらいるのもくどいので頻度を適度に」）。
 * 4回に1回ほど。さらに、その日によその店で誰かと話したら（ひより・隣町からの客も含む）、その日はもう出ない。
 */
export const ROAM_RATE = 0.25;

// 一服できる店（ひよりと同じ。買い物だけの店・家・ジムは除く）
const shishaShop = spot => spot.kind === "rival" || spot.kind === "samechan" || spot.id === "c_station";
const ownShop = id => spot => spot.charId === id || spot.face === id;
const metStory = id => value => id === "tsumugi" ? !!(value.flags._met_tsumugi || value.story?.tsumugi > 0) : !!value.met?.[id];
// 東京（第3章の日常ループ）の、一服できる店（mukai・煙幕・Smoke & Glory・鉄の煙）。買い物・部屋・公園などは除く
const tokyoShop = spot => spot.region === "tokyo" && ["mukai", "enmaku", "steve", "volk"].includes(spot.place);

/**
 * 居合わせる人。chapters＝出る章、at＝居合わせる店、ready＝出はじめる条件、
 * bond＝読み終えた時に好感度が上がる（その章の通いの小会話と同じ量。core/stats.js の visitAffinity("talk")）。
 * 審査員は会う前でも出る（名前は伏せる。台詞は met で分岐）。友人・ライバルは会ったことがある時だけ。
 */
export const ROAMERS = Object.freeze([
  { id: "maezono", chapters: [1, 2], at: spot => shishaShop(spot) || spot.id === "cafe", ready: () => true },
  { id: "dr_kemuri", chapters: [1, 2], at: shishaShop, ready: () => true },
  // 自分のチェーン（C.STATION）ではなく、地元の小さな店をお忍びで見る
  { id: "sui", chapters: [1, 2], at: spot => shishaShop(spot) && spot.id !== "c_station", ready: () => true },
  { id: "adam", chapters: [1, 2], at: spot => shishaShop(spot) && !ownShop("adam")(spot), ready: metStory("adam"), bond: true },
  { id: "rio", chapters: [1, 2], at: shishaShop, ready: metStory("rio"), bond: true },
  { id: "tsumugi", chapters: [1, 2], at: spot => shishaShop(spot) || spot.id === "cafe", ready: metStory("tsumugi"), bond: true },
  // 第3章の東京。ヴォルクは市場調査（自分の店「鉄の煙」には出ない）、ましろちゃんは休日（働いている mukai には出ない）、
  // エミルは全国大会で名前を知るまで伏せる（台詞は met で分岐）
  { id: "volk", chapters: [3], at: spot => tokyoShop(spot) && spot.place !== "volk", ready: metStory("volk"), bond: true },
  { id: "mashiro", chapters: [3], at: spot => tokyoShop(spot) && spot.place !== "mukai", ready: metStory("mashiro"), bond: true },
  { id: "emil", chapters: [3], at: tokyoShop, ready: () => true },
  // 第5章の地元。ひよりは自分の店を持たないので、仕事帰りによその店に居合わせる（BLC08。第1・2章の相席 daily/hiyori.js の続き）。
  // tonari での再会（_hiyori_tonari_return_done）を読んだ後だけ。恋人でも友人でも読める会話にしてある。
  { id: "hiyori", chapters: [5], at: shishaShop, ready: value => metStory("hiyori")(value) && !!value.flags?._hiyori_tonari_return_done, bond: true },
  // mukai の看板猫。裏口で一度構った後は、公園やよその店の帰り道で見かけることがある（2026-11-02 オーナー「てつこは作って」）
  { id: "tetsuko", chapters: [3], at: spot => spot.region === "tokyo" && (spot.place === "park" || tokyoShop(spot) && spot.place !== "mukai"),
    ready: value => (value.flags?._ch3_outings?.tetsuko || 0) >= 1 },
].map(Object.freeze));
const BY_ID = Object.fromEntries(ROAMERS.map(entry => [entry.id, entry]));

// 章ごとの、地図の外の店（第2章の柚ヶ谷など）。章のモジュールが登録する（循環importを避ける）
const extraSources = [];
export function addRoamerSpots(source) { if (!extraSources.includes(source)) extraSources.push(source); }
const chapterSpots = () => [...allSpots(), ...extraSources.flatMap(source => source() || [])];

// 検査用: 店を訪ねる他の検査で会話の流れを変えないよう、browser の support.mjs が既定で "off" にする。
// 居合わせる人の検査（roamers.mjs）だけが外す。遊ぶ時は使わない。
const switchedOff = () => { try { return globalThis.localStorage?.getItem("suien_roamers") === "off"; } catch { return false; } };
const dayStamp = value => `${value.chapter}:${value.day}`;
// 第1章は、地図に慣れた4日目から（最初の数日は案内と本筋の顔合わせが続く）
const started = value => value.chapter !== 1 || value.day >= 4;
function roll(value, key) {
  let salt = 2166136261;
  for (const char of `roam:${value.chapter}:${value.day}:${value.slot}:${key}`) salt = Math.imul(salt ^ char.charCodeAt(0), 16777619) >>> 0;
  return seeded(value.seed, salt % 1000003);
}
const metToday = (value, id) => value.flags?.[ROAM_DAY_FLAG]?.[id] === dayStamp(value);
/** その日、よその店でもう誰かと話したか（居合わせる人・ひより・隣町からの客）。一日に一度までにする。 */
const guestMetToday = value => Object.values(value.flags?.[ROAM_DAY_FLAG] || {}).includes(dayStamp(value))
  || value.flags?._hiyori_encounter_day === dayStamp(value) || value.flags?._city_guest_day === dayStamp(value);
const bookedToday = (value, id) => {
  const invite = value.pendingInvite;
  return !!invite && invite.sender === id && (invite.day ?? value.day) === value.day;
};

/** ほかの客がいる店（ひより・隣町からの客・組長・つむぎ）。重ねて出さない。 */
function busySpots(value) {
  const busy = new Set(["tonari"]);
  try { const hiyori = hiyoriShopLocation(); if (hiyori) busy.add(hiyori); } catch {}
  try { const city = cityGuestVisit(); if (city?.spotId) busy.add(city.spotId); } catch {}
  if (ryujiAtMeltyPuff(value)) busy.add("ch2_ageha"); // 組長が MELTY PUFF に来ている時間帯
  if (reiGreetingDue(value)) busy.add("ch2_ageha"); // クラウドが MELTY PUFF へ挨拶に来る回（#3468）
  return busy;
}

/**
 * 今の時間帯に、よその店に居合わせている人。{ id, spotId } か null。
 * 地図・来店の前に同じ答えを返す（保存は変えない）。
 */
export function roamerPlan(value = state) {
  if (switchedOff() || !value?.flags || value.phase !== "daily" || value.slot > 1 || !Number.isFinite(value.seed) || !started(value)) return null;
  if (guestMetToday(value) || roll(value, "rate") >= ROAM_RATE) return null;
  const people = ROAMERS.filter(entry => entry.chapters.includes(value.chapter) && entry.ready(value)
    && !metToday(value, entry.id) && !bookedToday(value, entry.id));
  if (!people.length) return null;
  const busy = busySpots(value);
  const open = chapterSpots().filter(spot => spot && !busy.has(spot.id) && !spot.unavailable
    && value.visitedDay?.[spot.id] !== value.day && isUnlocked(spot) && !isClosed(spot));
  // 選ぶ順も保存の種で決める。最初の人が居られる店が無ければ次の人へ
  const order = people.map(entry => ({ entry, r: roll(value, `who:${entry.id}`) })).sort((a, b) => a.r - b.r || a.entry.id.localeCompare(b.entry.id));
  for (const { entry } of order) {
    const spots = open.filter(entry.at).sort((a, b) => a.id.localeCompare(b.id));
    if (!spots.length) continue;
    const spot = spots[Math.floor(roll(value, `where:${entry.id}`) * spots.length) % spots.length];
    return { id: entry.id, spotId: spot.id };
  }
  return null;
}

/** その店に今いる人（地図の顔）。いなければ null。 */
export function roamerAt(spot, value = state) {
  const plan = spot ? roamerPlan(value) : null;
  return plan && plan.spotId === spot.id ? plan : null;
}

export const roamerCount = (id, value = state) => Number(value?.flags?.[roamSeenFlag(id)] || 0);
const REPEATS = ["a", "b", "c"];
/** 次に読む会話（初回 → a → b → c → a …）。 */
export function roamerScene(id, value = state) {
  const n = roamerCount(id, value);
  return n === 0 ? `roam_${id}_first` : `roam_${id}_${REPEATS[(n - 1) % REPEATS.length]}`;
}
export const ROAMER_SCENES = Object.freeze(ROAMERS.flatMap(entry => [`roam_${entry.id}_first`, ...REPEATS.map(key => `roam_${entry.id}_${key}`)]));

let loading = null, active = false;
async function loadScenes() {
  if (ROAMER_SCENES.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("roaming_guests", ROAMER_SCENES).then(found => { Object.assign(DB.dialogues, found); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

/**
 * 店の一服を終えた後に、居合わせた人と話す。scheduled は来店の前に roamerAt で取った答え
 * （来店で「今日行った店」が変わっても、入る前に地図で見た人と会う）。読み終えたら true。
 */
export async function meetRoamer(spot, scheduled, { bg } = {}) {
  if (!spot || !scheduled || scheduled.spotId !== spot.id || active || isPlaying()) return false;
  const entry = BY_ID[scheduled.id];
  const owner = state;
  if (!entry || !owner?.flags || metToday(owner, entry.id)) return false;
  try { await loadScenes(); } catch { return false; } // 居合わせる会話は寄り道。読めなければ出さない（来店は済んでいる）
  if (state !== owner) return false;
  const scene = roamerScene(entry.id, owner);
  // 途中でLOAD・タイトルへ戻ったら、会話を止めて何も残さない
  const controller = new AbortController();
  const unsubscribe = on("hud", () => { if (state !== owner) controller.abort(); });
  active = true;
  try {
    const result = await play(scene, { ...(bg ? { bg } : {}), signal: controller.signal });
    if (state !== owner || controller.signal.aborted || !result || result.cancelled) return false;
    owner.flags[roamSeenFlag(entry.id)] = roamerCount(entry.id, owner) + 1;
    owner.flags[ROAM_DAY_FLAG] = { ...(owner.flags[ROAM_DAY_FLAG] || {}), [entry.id]: dayStamp(owner) };
    if (entry.bond) gainAffinity(entry.id, visitAffinity("talk", owner));
    save();
    return true;
  } finally {
    active = false;
    unsubscribe();
    controller.abort();
  }
}
