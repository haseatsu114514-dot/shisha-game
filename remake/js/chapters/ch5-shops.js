// 第5章の通い店（#2033 F）。第1・2章の物語の続きが流れる店は、第5章では「通いの小会話」だけで出す。
//   KEMURIKUSA（なる）: 第4章で再開した店（ch4_naru_dubai_3）。第2章の決裂の判定（naruRiftActive）は LIME・誘いでも
//     使うので変えず、第5章の地図だけこの通い店で出す（charId を持たせない＝臨時休業の判定に掛からない）。
//   C.STATION: 大会を運営するチェーン店。世界大会の後の、新しい王者としての来店。
//   Dr.fookah の2階（凛想・夜だけ）: 地図のピンは1階の店。来店の時に階を選ぶ（chapterFiveShowroom・BLC08）。
//   PEPPERMINT（みんと）・SHISHARK（サメちゃん）・MELTY PUFF（あげは・柚ヶ谷）: ヒロインの店。恋人でも友人でも
//     不自然にならない、店での会話にする（オーナー指定 2026-11-02）。恋人の好感度は店では深まらない（core/stats.js）。
// 代金・体力・能力は元の店の来店と同じ。好感度は第5章の通いの +5。台詞は data/dialogue/ch5_shops.json。
// 通い店でない常連（アダム・レヰ・神崎）の、第5章の最初の来店で一度だけ読む会話も、ここで同じ精算で出す（ch5-first-talks.js）。
import { state, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { SPOTS, CHAR_STAT, VISIT_BG, isClosed } from "../daily/spots.js";
import { PREPARATION_SPOTS } from "./ch2-preparation.js";
import { consultLessons } from "../core/growth.js";
import { CH5_FIRST_TALKS, chapterFiveFirstTalkDue, chapterFiveFirstTalkSeenFlag } from "./ch5-first-talks.js";

const TALKS_FLAG = "_ch5_shop_talks"; // 小会話の巡回の回数（店ごと）

// 地図のピン・定休日・代金・体力は元の店のまま。charId だけ外し、話し相手は talkWith に持つ。
const shop = (base, fields) => base ? Object.freeze({ ...base, charId: undefined, ch5Shop: true, ...fields }) : null;
const homeBase = id => SPOTS.find(spot => spot.id === id);
const talksOf = id => [`ch5_${id}`, `ch5_${id}_b`, `ch5_${id}_c`];

export const CH5_SHOPS = Object.freeze([
  shop(homeBase("naru"), { talkWith: "naru", stat: CHAR_STAT.naru, bg: VISIT_BG.naru, affinity: 5,
    talks: talksOf("naru_shop"), desc: "なるの店。再開してから、前からの客が戻ってきた。" }),
  shop(homeBase("c_station"), { bg: "bg_c_station", talks: talksOf("c_station"),
    desc: "大会を運営するチェーン店。世界大会の後は、少し落ち着かない。" }),
  shop(homeBase("minto"), { talkWith: "minto", stat: CHAR_STAT.minto, bg: VISIT_BG.minto, affinity: 5,
    needsMet: true, talks: talksOf("minto_shop"), desc: "みんとのコンセプトカフェ。今日も、ミントの香りがする。" }),
]);
// Dr.fookah の2階（凛想・夜だけ・BLC08）。地図のピンは1階の店のままで、来店の時に階を選ぶ（ch5-daily.js）。
// 第1・2章の物語の続き（段階の会話・試作）は流さず、ほかのヒロインの店と同じ通いの小会話にする。代金はかからない。
const SHOWROOM_ID = "ch5_rio_showroom";
const showroom = () => shop(homeBase("shop"), { id: SHOWROOM_ID, talkWith: "rio", stat: CHAR_STAT.rio, bg: VISIT_BG.rio, affinity: 5,
  needsMet: true, stamina: -14, talks: talksOf("rio_shop"), desc: "Dr.fookah の2階。夜は、凛想さんがショールームにいる。" });
/** 今、Dr.fookah の2階へ上がれるか（凛想に会ったことがあり、夜）。上がれるならその通い店、無ければ null。 */
export function chapterFiveShowroom(value = state) {
  const entry = showroom();
  return value?.chapter === 5 && (value.slot || 0) >= 1 && known(value, entry) ? entry : null;
}
// SHISHARK は台本データ（samechan.json の spot）、MELTY PUFF は柚ヶ谷の店から作る（読み込み後に決まる）。
const samechanShop = () => shop(DB.samechan?.spot && { ...DB.samechan.spot, region: "home" }, {
  talkWith: "samechan", stat: "insight", bg: DB.samechan?.spot?.bg || "bg_shishark", affinity: 5,
  needsMet: true, talks: talksOf("samechan_shop"), desc: "海とサメがモチーフの店。サメちゃんと側近がいる。" });
const agehaShop = () => shop(PREPARATION_SPOTS.find(spot => spot.charId === "ageha"), {
  talkWith: "ageha", stat: "sense", bgUrl: PREPARATION_SPOTS.find(spot => spot.charId === "ageha")?.previewUrl, affinity: 5,
  needsMet: true, talks: talksOf("ageha_shop"), desc: "あげはの店。ギャルとオタクで、今日もにぎやか。" });

const known = (value, entry) => !!entry && (!entry.needsMet || !!value?.met?.[entry.talkWith])
  && (!entry.requiresMet || !!value?.met?.[entry.requiresMet]);
/** 第5章の地元の地図に出す通い店（会ったことのある人の店だけ。C.STATION は第1章と同じく、なるに会ってから）。 */
export const chapterFiveShops = (value = state) => [...CH5_SHOPS, samechanShop()].filter(entry => known(value, entry));
/** 第5章の柚ヶ谷の地図に出す通い店（あげはの店）。 */
export const chapterFiveCityShops = (value = state) => [agehaShop()].filter(entry => known(value, entry));
const allShops = () => [...CH5_SHOPS, samechanShop(), agehaShop(), showroom()].filter(Boolean);
/** spotById 用（地図の外から id で引く）。 */
export const chapterFiveShopById = id => allShops().find(entry => entry.id === id) || null;

/**
 * 第5章の最初の来店で一度だけ読む会話がある常連の店（ch5-first-talks.js）。通い店と同じ精算で、いつもの会話の代わりに読む。
 * 無ければ null（いつもの来店へ。EDEN は日常ループの来店、柚ヶ谷の神崎・レヰは ch2-preparation.js の visitCityRegular）。
 */
function firstTalkShop(spot) {
  const id = spot?.charId, talk = id ? chapterFiveFirstTalkDue(id, state) : null;
  if (!talk || (spot.region || "home") !== talk.region) return null;
  return Object.freeze({ ...spot, talkWith: id, stat: talk.stat, affinity: 5, talks: [talk.scene], firstTalk: talk,
    ...(spot.previewUrl ? { bgUrl: spot.previewUrl } : { bg: VISIT_BG[id] }) });
}

// 台本ファイルごとに、要る場面だけを読み込む（失敗したら次の来店で読み直す）。readDialogues はファイルの全場面を返すが、
// 第2章の台本（ch2_kumicho）の段階会話などは第5章の DB に入れない（来店の判定が台本の有無を見るため）。
const loading = new Map();
function loadScenes(file, scenes) {
  if (scenes.every(id => DB.dialogues[id]?.lines?.length)) return Promise.resolve();
  const key = `${file}:${scenes.join(",")}`;
  if (!loading.has(key)) loading.set(key, readDialogues(file, scenes)
    .then(found => { for (const id of scenes) DB.dialogues[id] = found[id]; })
    .catch(error => { loading.delete(key); throw error; }));
  return loading.get(key);
}
async function loadShopScenes(entry) {
  const firstTalks = Object.values(CH5_FIRST_TALKS);
  await loadScenes("ch5_shops", [...allShops().flatMap(shop => shop.talks),
    ...firstTalks.filter(talk => talk.file === "ch5_shops").map(talk => talk.scene)]);
  const talk = entry.firstTalk;
  if (talk && talk.file !== "ch5_shops") await loadScenes(talk.file, [talk.scene]);
}

/** 一度だけの会話を読み終えた来店の記録。既読と、元の店のいつもの来店と同じ回数・印。 */
function recordFirstTalk(entry) {
  const id = entry.talkWith;
  state.flags[chapterFiveFirstTalkSeenFlag(entry.firstTalk)] = true;
  state.visits[id] = (state.visits[id] || 0) + 1;
  if (entry.firstTalk.region === "widehanga") {
    // 柚ヶ谷の通い訪問の回数（ch2-preparation.js の小会話の巡回）にも数える
    const regular = state.flags._ch2_talks ||= {};
    regular[id] = (regular[id] || 0) + 1;
  } else state.flags[`_spot_guide_${id}`] = true; // 自主来店を終えた印（daily/spots.js の visitRival と同じ）
}

const unused = { used: false, exerted: false };

/** 通い店の来店。対象外は null（日常ループの通常の処理へ）。中断・LOADでは代金・体力・回数を残さない。 */
export async function performChapterFiveShop(spot, { staminaGuard } = {}) {
  if (state?.chapter !== 5) return null;
  const entry = spot?.ch5Shop ? chapterFiveShopById(spot.id) : firstTalkShop(spot);
  if (!entry) return null;
  const owner = state;
  try { await loadShopScenes(entry); } catch {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return unused;
  }
  if (state !== owner) return unused;
  if (entry.firstTalk && isClosed(spot)) return unused;
  if ((entry.cost || 0) > spendableMoney(state)) {
    toast("お金が足りない");
    return unused;
  }
  if (staminaGuard && !(await staminaGuard(entry.stamina))) return unused;
  const talks = state.flags[TALKS_FLAG] ||= {};
  const scene = entry.firstTalk ? entry.firstTalk.scene : entry.talks[(talks[entry.id] || 0) % entry.talks.length];
  if (entry.bgUrl) await setBg(entry.bgUrl);
  else {
    const { url, tint } = sceneBg(entry.bg, timeOfDay());
    await setBg(url, { tint });
  }
  if (state !== owner) return unused;
  const result = await play(scene);
  if (state !== owner || !result || result.cancelled) return unused;
  if (entry.cost) addMoney(-entry.cost);
  addStamina(entry.stamina || -16);
  if (entry.firstTalk) recordFirstTalk(entry);
  else talks[entry.id] = (talks[entry.id] || 0) + 1;
  if (entry.talkWith) { gainAffinity(entry.talkWith, entry.affinity || 5); markMet(entry.talkWith); }
  if (entry.stat) earnStat(entry.stat, 4);
  // 心得の盤の授業（SPEC 2.6・SBD61）: 通い店で会った人に、灯した授業があれば相談する（なる・みんと・サメちゃん・あげは。
  // 一度だけの会話を読んだアダム・レヰ・神崎も、いつもの来店と同じく相談する）
  if (entry.talkWith && state === owner) await consultLessons(entry.talkWith, { bg: entry.bgUrl || sceneBg(entry.bg, timeOfDay()).url });
  return { used: true, exerted: true };
}
