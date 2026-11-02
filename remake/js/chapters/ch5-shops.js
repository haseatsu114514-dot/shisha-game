// 第5章の通い店（#2033 F）。第1・2章の物語の続きが流れる店は、第5章では「通いの小会話」だけで出す。
//   KEMURIKUSA（なる）: 第4章で再開した店（ch4_naru_dubai_3）。第2章の決裂の判定（naruRiftActive）は LIME・誘いでも
//     使うので変えず、第5章の地図だけこの通い店で出す（charId を持たせない＝臨時休業の判定に掛からない）。
//   C.STATION: 大会を運営するチェーン店。世界大会の後の、新しい王者としての来店。
//   PEPPERMINT（みんと）・SHISHARK（サメちゃん）・MELTY PUFF（あげは・柚ヶ谷）: ヒロインの店。恋人でも友人でも
//     不自然にならない、店での会話にする（オーナー指定 2026-11-02）。恋人の好感度は店では深まらない（core/stats.js）。
// 代金・体力・能力は元の店の来店と同じ。好感度は第5章の通いの +5。台詞は data/dialogue/ch5_shops.json。
import { state, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { SPOTS, CHAR_STAT, VISIT_BG } from "../daily/spots.js";
import { PREPARATION_SPOTS } from "./ch2-preparation.js";

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
const allShops = () => [...CH5_SHOPS, samechanShop(), agehaShop()].filter(Boolean);
/** spotById 用（地図の外から id で引く）。 */
export const chapterFiveShopById = id => allShops().find(entry => entry.id === id) || null;

let loading = null;
async function loadShopScenes() {
  const scenes = allShops().flatMap(entry => entry.talks);
  if (scenes.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("ch5_shops", scenes).then(found => { Object.assign(DB.dialogues, found); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

const unused = { used: false, exerted: false };

/** 通い店の来店。対象外は null（日常ループの通常の処理へ）。中断・LOADでは代金・体力・回数を残さない。 */
export async function performChapterFiveShop(spot, { staminaGuard } = {}) {
  const entry = spot?.ch5Shop ? chapterFiveShopById(spot.id) : null;
  if (!entry || state?.chapter !== 5) return null;
  const owner = state;
  try { await loadShopScenes(); } catch {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return unused;
  }
  if (state !== owner) return unused;
  if ((entry.cost || 0) > spendableMoney(state)) {
    toast("お金が足りない");
    return unused;
  }
  if (staminaGuard && !(await staminaGuard(entry.stamina))) return unused;
  const talks = state.flags[TALKS_FLAG] ||= {};
  const scene = entry.talks[(talks[entry.id] || 0) % entry.talks.length];
  if (entry.bgUrl) await setBg(entry.bgUrl, { instant: true });
  else {
    const { url, tint } = sceneBg(entry.bg, timeOfDay());
    await setBg(url, { instant: true, tint });
  }
  if (state !== owner) return unused;
  const result = await play(scene);
  if (state !== owner || !result || result.cancelled) return unused;
  if (entry.cost) addMoney(-entry.cost);
  addStamina(entry.stamina || -16);
  talks[entry.id] = (talks[entry.id] || 0) + 1;
  if (entry.talkWith) { gainAffinity(entry.talkWith, entry.affinity || 5); markMet(entry.talkWith); }
  if (entry.stat) earnStat(entry.stat, 4);
  return { used: true, exerted: true };
}
