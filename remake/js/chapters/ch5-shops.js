// 第5章の地元の通い店（#2033 F の1つ目）。第1章の物語の続きが流れる店は、第5章では「通いの小会話」だけで出す。
//   KEMURIKUSA（なる）: 第4章で再開した店（ch4_naru_dubai_3）。第2章の決裂の判定（naruRiftActive）は LIME・誘いでも
//     使うので変えず、第5章の地図だけこの通い店で出す（charId を持たせない＝臨時休業の判定に掛からない）。
//   C.STATION: 大会を運営するチェーン店。世界大会の後の、新しい王者としての来店。
// 代金・体力・能力は第1章の来店と同じ。好感度は第5章の通いの +5（なるだけ）。台詞は data/dialogue/ch5_shops.json。
// ヒロインの店（PEPPERMINT・SHISHARK・あげはの店）は別のPR。
import { state, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { SPOTS, CHAR_STAT, VISIT_BG } from "../daily/spots.js";

const TALKS_FLAG = "_ch5_shop_talks"; // 小会話の巡回の回数（店ごと）
const base = id => SPOTS.find(spot => spot.id === id);

// 地図のピン・定休日・代金・体力は第1章の店のまま。charId だけ外し、話し相手は talkWith に持つ。
const shop = (id, fields) => Object.freeze({ ...base(id), charId: undefined, ch5Shop: true, ...fields });
export const CH5_SHOPS = Object.freeze([
  shop("naru", { talkWith: "naru", stat: CHAR_STAT.naru, bg: VISIT_BG.naru, affinity: 5,
    talks: ["ch5_naru_shop", "ch5_naru_shop_b", "ch5_naru_shop_c"],
    desc: "なるの店。再開してから、前からの客が戻ってきた。" }),
  shop("c_station", { bg: "bg_c_station",
    talks: ["ch5_c_station", "ch5_c_station_b", "ch5_c_station_c"],
    desc: "大会を運営するチェーン店。世界大会の後は、少し落ち着かない。" }),
]);
export const CH5_SHOP_IDS = Object.freeze(CH5_SHOPS.map(entry => entry.id));
/** 第5章の地元の地図に出す通い店（C.STATION は第1章と同じく、なるに会ってから）。 */
export const chapterFiveShops = (value = state) => CH5_SHOPS.filter(entry => !entry.requiresMet || value?.met?.[entry.requiresMet]);

const SCENES = CH5_SHOPS.flatMap(entry => entry.talks);
let loading = null;
async function loadShopScenes() {
  if (SCENES.every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= readDialogues("ch5_shops", SCENES).then(found => { Object.assign(DB.dialogues, found); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

const unused = { used: false, exerted: false };

/** 通い店の来店。対象外は null（日常ループの通常の処理へ）。中断・LOADでは代金・体力・回数を残さない。 */
export async function performChapterFiveShop(spot, { staminaGuard } = {}) {
  const entry = CH5_SHOPS.find(item => item.id === spot?.id);
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
  const { url, tint } = sceneBg(entry.bg, timeOfDay());
  await setBg(url, { instant: true, tint });
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
