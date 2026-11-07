// 帰国後の tonari の打ち上げ（オーナー指定 2026-11-02「帰ってきてTonariで打ち上げ」）。
// 第4章で世界王者になって帰ってきた後、第5章の自由行動の始めに一度だけ。誰の隣に座るかを選ぶ。
//   - その場にいる恋人が2人以上: 隣に座った時に浮気がばれて修羅場。恋人ごとの反応（routes.romance[id].conflict）と
//     謝罪（routes.conflict.close＝shuraba_accountability。未解決の印 _story_shuraba_unresolved を立てる）を続けて読む
//   - 恋人が1人: その人の隣なら穏やかに。別の人の隣なら、離れた席から視線を感じる（修羅場にはしない）
//   - 恋人がいない: そのまま打ち上げを楽しむ
// その場にいるのは、会ったことのあるヒロイン全員（地元の店に集まる。第3章の東京・第4章のドバイの所在の規則とは別）。
// 判定は core/story-routes.js の selectPostEndingConflict（2人以上の恋人がその場にいる時の修羅場）を使う。
// 中断・LOADでは打ち上げを済ませた印を立てない（次に自由行動へ入る時に、始めから読み直す）。
import { state, save } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { partyBeforeSeat, partyGuests, partyScenes, SEAT_LABELS } from "./ch5-party-plan.js";

export const PARTY_FLAG = "_ch5_after_party"; // 打ち上げを読み終えた
export const PARTY_SEAT_FLAG = "_ch5_party_seat"; // 隣に座った人（"sumi" かヒロインのID）
// 打ち上げの修羅場で反応まで読んだ恋人（IDの配列。#2815）。スタッフロールの後（ch5-progress.js）は、この人たちだけを
// 反応済みとして話し直しへ送り、打ち上げの後に恋人になった相手とは区別する。修羅場にならなかった打ち上げでは立てない。
export const PARTY_CONFLICT_FLAG = "_ch5_party_conflict";
const BG = "bg_tonari_inside_night";
let routesTask = null;
function loadRoutes() {
  routesTask ||= fetch("../data/story_routes.json", { cache: "no-cache" }).then(response => {
    if (!response.ok) throw new Error(`story_routes: HTTP ${response.status}`);
    return response.json();
  }).then(routes => {
    if (!Array.isArray(routes.heroine_ids) || !routes.romance || !routes.conflict) throw new Error("story_routes: 形式を確認してください");
    return routes;
  }).catch(error => { routesTask = null; throw error; });
  return routesTask;
}

const PARTY_SCENES = ["ch5_party_open", "ch5_party_seat_sumi", "ch5_party_seat_friend", "ch5_party_seat_lover",
  "ch5_party_seat_away", "ch5_party_noor_call", "ch5_party_shuraba_open", "ch5_party_shuraba_close", "ch5_party_close"];
async function loadScenes(routes) {
  const conflicts = [routes.conflict.close, ...Object.values(routes.romance).map(entry => entry.conflict)].filter(Boolean);
  const missing = [...PARTY_SCENES, ...conflicts].filter(id => !DB.dialogues[id]?.lines?.length);
  if (!missing.length) return;
  const [party, shuraba] = await Promise.all([readDialogues("ch5_party", PARTY_SCENES), readDialogues("relationship_conflicts", conflicts)]);
  Object.assign(DB.dialogues, party, shuraba);
}

/** 打ち上げを一度だけ。true＝読み終えた（または済んでいる）。false＝中断・読み込み失敗（次に自由行動へ入る時にやり直す）。 */
export async function runAfterParty() {
  if (state?.chapter !== 5 || state.flags?.[PARTY_FLAG]) return true;
  const owner = state;
  let routes;
  try {
    routes = await loadRoutes();
    await loadScenes(routes);
  } catch {
    toast("打ち上げの会話を読み込めませんでした。次に地図を開く時に、もう一度");
    return false;
  }
  if (state !== owner) return false;
  const { url, tint } = sceneBg(BG, "night");
  await setBg(url, { tint });
  const read = async id => {
    if (state !== owner) return false;
    const result = await play(id);
    return state === owner && !!result && !result.cancelled;
  };
  if (!await read("ch5_party_open")) return false;
  // 修羅場になる打ち上げでは、遠くの恋人のテレビ電話を席の前につなぐ（反応が「聞こえてた」と受ける・#2815）
  for (const id of partyBeforeSeat(routes, state)) if (!await read(id)) return false;
  const { present } = partyGuests(routes, state);
  const seat = present.length ? await modal({
    title: "誰の隣に座る？", body: "打ち上げの席。空いている席は、いくつかある。",
    options: [...present.map(id => ({ label: `${SEAT_LABELS[id] || id}の隣`, value: id, test: `party-seat-${id}` })),
      { label: "スミさんの隣", value: "sumi", test: "party-seat-sumi" }],
  }) : "sumi";
  if (!seat || state !== owner) return false;
  const plan = partyScenes(routes, state, seat);
  for (const id of plan.scenes) if (!await read(id)) return false;
  state.flags[PARTY_FLAG] = true;
  state.flags[PARTY_SEAT_FLAG] = seat;
  if (plan.kind === "conflict") state.flags[PARTY_CONFLICT_FLAG] = [...plan.participants];
  save();
  return true;
}
