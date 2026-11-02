// 第5章の東京（#2033 D）。勝負の日を決める前の自由行動で、新幹線で東京へ行ける。
// オーナー指定（2026-11-02）: 東京はムカイさんの屋根裏に好きなだけ泊まれて、好きな時に帰れる。
// 運賃は片道 TOKYO_TRAIN_FARE（往復分が無いと出発できず、東京では帰りの分を使えない）。移動は1行動。
// 行き先: mukai（手伝い）・Smoke & Glory（スティーブ）・鉄の煙（ヴォルク）・公園・裏口のてつこ・東京の店・屋根裏・地元へ帰る。
// ましろ（ヒロイン）は第5章の会話に出さない。久世は第3章の後に福岡へ戻ったので煙幕は出さない。
// 台詞は data/dialogue/ch5_tokyo.json（てつこと夜の公園は第3章の場面を使う）。現在地は flags._ch2_region = "tokyo"。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity } from "../core/stats.js";
import { spendableMoney, TOKYO_TRAIN_FARE } from "../core/travel-budget.js";
import { openShop } from "../daily/shop.js";
import { VISIT_COST } from "../daily/spots.js";
import { modal } from "../core/ui.js";
import { runMukaiShift, loadMukaiShift, MUKAI_SHIFT_STAMINA } from "./tokyo-mukai.js";
import { reflectAt } from "../daily/reflection.js";
import { TOKYO_OUTINGS, outingDialogueId, outingCounts, OUTINGS_FLAG } from "./ch3-outing-progress.js";

export const TOKYO = "tokyo";
const ATTIC_FLAG = "_ch5_tokyo_attic"; // ムカイさんに屋根裏を貸してもらった（最初の到着の場面を読んだ）
const TALKS_FLAG = "_ch5_tokyo_talks"; // 小会話の巡回の回数（人ごと）
const ATTIC_BG = "bg_mukai_attic"; // ムカイさんの店の上の屋根裏（2026-11-02 採用）。夜は既存の夜の暗転を共用する

// 座標は東京の地図（bg_tokyo_map_*）に対する百分率。第3章の TOKYO_MAP_PLACES と同じ位置。
const spot = fields => Object.freeze({ region: TOKYO, kind: "ch5_tokyo", ...fields });
export const TOKYO_SPOTS = Object.freeze([
  spot({ id: "ch5_tokyo_mukai", label: "mukai", area: "高架下の商店街", x: 29.6, y: 62.7, theme: "baito", glyph: "店", face: "mukai_master",
    preview: "bg_mukai_shop", stamina: MUKAI_SHIFT_STAMINA, shift: true, talks: ["ch5_tokyo_mukai_help", "ch5_tokyo_mukai_help_b", "ch5_tokyo_mukai_help_c"],
    desc: "ムカイさんの店のシフト（日当6,000円）。帰りに裏口のてつこにも会える。" }),
  spot({ id: "ch5_tokyo_steve", charId: "steve", label: "Smoke & Glory", area: "スティーブの店", x: 23.3, y: 36.1, theme: "rival", glyph: "煙", face: "steve",
    preview: "bg_steve_shop", cost: VISIT_COST, stamina: -16, stat: "technique", affinity: 5,
    talks: ["ch5_tokyo_steve", "ch5_tokyo_steve_b", "ch5_tokyo_steve_c"], desc: "タイマーの並ぶ店。二口目までの一台。" }),
  spot({ id: "ch5_tokyo_volk", charId: "volk", label: "鉄の煙", area: "ヴォルクの店", x: 55.9, y: 40.4, theme: "rival", glyph: "煙", face: "volk",
    preview: "bg_volk_shop", cost: VISIT_COST, stamina: -16, stat: "insight", affinity: 5,
    talks: ["ch5_tokyo_volk", "ch5_tokyo_volk_b", "ch5_tokyo_volk_c"], desc: "計器の並ぶ店。測ってから、客に聞く。" }),
  spot({ id: "ch5_tokyo_park", label: "公園", area: "池のある公園", x: 69, y: 62, theme: "park", glyph: "園", preview: "bg_street",
    stamina: 20, desc: "何も決めずに歩いて、少し体を休める。" }),
  // 裏口のてつこは地図の行き先にせず、mukai のシフトの帰りに会う（VOL11）。
  spot({ id: "ch5_tokyo_shop", kind: "shop", label: "Dr.fookah 東京店", area: "駅前の店", x: 15, y: 51, theme: "shop", glyph: "卸",
    preview: "bg_fookah_showroom", desc: "東京の店。第3章と同じ品ぞろえ。" }),
  spot({ id: "ch5_tokyo_attic", label: "屋根裏", area: "mukaiの上", x: 45, y: 63, theme: "rest", glyph: "休", preview: ATTIC_BG,
    stamina: 55, desc: "ムカイさんの屋根裏で休む。体力が大きく戻る。" }),
  // 心得の盤の内省（SPEC 2.8）: 第3章と同じ路地裏の神社。灯せる火種がある時だけ地図に出す（ch5-daily.js）。時間は使わない。
  spot({ id: "ch5_tokyo_shrine", reflect: "tokyo_shrine", label: "路地裏の神社", area: "路地の奥", x: 54, y: 70, theme: "rest", glyph: "社",
    preview: "bg_street", desc: "学んだことを火にして、心得の盤に灯す（時間は使わない）。" }),
  spot({ id: "ch5_tokyo_home", label: "地元へ帰る", area: "東京駅", x: 40, y: 20, theme: "rest", glyph: "駅", preview: "bg_ch3_train_arrival",
    desc: `新幹線で橙須へ帰る。片道${TOKYO_TRAIN_FARE.toLocaleString("ja-JP")}円・1行動。` }),
]);

/** 地元の地図に出す「東京へ（新幹線）」。往復の運賃が無いと出発できない。 */
// 位置: 新幹線の駅のアイコン（#2371）は文字の盾より大きく、(27,44) では名札が下の PEPPERMINT（28,62）を覆って押せなかった。
// CHOI-ZAP・観音堂・路上占いの出る場所とも重ならない左端へ。
export const TO_TOKYO_SPOT = Object.freeze({
  id: "ch5_to_tokyo", kind: "ch5_tokyo", label: "東京へ（新幹線）", area: "橙須駅", x: 8, y: 40, theme: "stadium", glyph: "新",
  preview: "bg_ch3_train_arrival",
  desc: `片道${TOKYO_TRAIN_FARE.toLocaleString("ja-JP")}円・1行動。ムカイさんの屋根裏に好きなだけ泊まれて、好きな時に帰れる。`,
});

export const inTokyo = (value = state) => value?.flags?._ch2_region === TOKYO;
const SCENES = TOKYO_SPOTS.flatMap(entry => entry.talks || []).concat(["ch5_tokyo_go", "ch5_tokyo_back", "ch5_tokyo_arrival", "ch5_tokyo_park_day", "ch5_tokyo_attic_rest", "ch5_tokyo_fortune"]);
// てつこのお世話は第3章の続き（通うほど懐いていく。回数も第3章と同じ記録。ch3-outing-progress.js の stages・loop）
const TETSUKO = TOKYO_OUTINGS.find(outing => outing.id === "tetsuko");
const CH3_SCENES = ["ch3_outing_park_walk_night", ...TETSUKO.stages, ...TETSUKO.loop];
async function careForTetsuko(owner) {
  if (!await read(outingDialogueId(state, TETSUKO), "bg_street", owner)) return false;
  state.flags[OUTINGS_FLAG] = { ...outingCounts(state), tetsuko: (outingCounts(state).tetsuko || 0) + 1 };
  return true;
}

let loading = null;
async function loadTokyoScenes() {
  if ([...SCENES, ...CH3_SCENES].every(id => DB.dialogues[id]?.lines?.length)) return loadMukaiShift();
  loading ||= Promise.all([readDialogues("ch5_tokyo", SCENES), readDialogues("ch3_outings", CH3_SCENES), loadMukaiShift().then(() => ({}))])
    .then(([tokyo, ch3]) => { Object.assign(DB.dialogues, tokyo, ch3); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

// 夜は外光のある場所に既存の夜の暗転（tint）を掛ける。屋根裏の絵は昼の光なので、tint を落とさない。
const showBg = (ref, tod) => { const { url, tint } = sceneBg(ref, tod); return setBg(url, { instant: true, tint }); };

/** 読み終えたら true。中断・LOADは false（代金・体力・既読を残さない）。 */
async function read(id, bg, owner) {
  if (bg) await showBg(bg, timeOfDay());
  if (state !== owner) return false;
  const result = await play(id);
  return state === owner && !!result && !result.cancelled;
}

/** 東京の行き先と「東京へ」の処理。対象外の行き先は null（日常ループの通常の処理へ）。 */
export async function performTokyoSpot(spot, { staminaGuard } = {}) {
  if (spot.id !== TO_TOKYO_SPOT.id && spot.region !== TOKYO) return null;
  const owner = state;
  try { await loadTokyoScenes(); } catch {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (state !== owner) return { used: false, exerted: false };
  if (spot.id === TO_TOKYO_SPOT.id) return goToTokyo(owner);
  if (spot.id === "ch5_tokyo_home") return goHome(owner);
  if (spot.reflect) { await reflectAt(spot.reflect); return { used: false, exerted: false }; }
  if (spot.id === "ch5_tokyo_shop") {
    await openShop({ branch: "tokyo" }); // 時間は使わない
    return { used: false, exerted: false };
  }
  if (spot.id === "ch5_tokyo_attic") {
    if (!await read("ch5_tokyo_attic_rest", ATTIC_BG, owner)) return { used: false, exerted: false };
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_tokyo_park") {
    const scene = state.slot >= 1 ? "ch3_outing_park_walk_night" : "ch5_tokyo_park_day";
    if (!await read(scene, "bg_street", owner)) return { used: false, exerted: false };
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_tokyo_tetsuko") {
    if (!await careForTetsuko(owner)) return { used: false, exerted: false };
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (!spot.talks) return null;
  if (spot.shift) {
    if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
    if (!await chapterFiveMukaiShift(owner)) return { used: false, exerted: false };
    await offerTetsuko(owner);
    return { used: true, exerted: true };
  }
  // スティーブ・ヴォルク: 小会話を巡回して読む。
  if ((spot.cost || 0) > spendableMoney(state)) {
    toast("お金が足りない（帰りの新幹線の分は使えない）");
    return { used: false, exerted: false };
  }
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
  const talks = state.flags[TALKS_FLAG] ||= {};
  const scene = spot.talks[(talks[spot.id] || 0) % spot.talks.length];
  if (!await read(scene, spot.preview, owner)) return { used: false, exerted: false };
  if (spot.cost) addMoney(-spot.cost);
  if (spot.pay) addMoney(spot.pay);
  addStamina(spot.stamina);
  talks[spot.id] = (talks[spot.id] || 0) + 1;
  if (spot.charId) { gainAffinity(spot.charId, spot.affinity || 5); markMet(spot.charId); }
  earnStat(spot.stat, 4);
  return { used: true, exerted: true };
}

async function goToTokyo(owner) {
  if (state.money < TOKYO_TRAIN_FARE * 2) {
    toast(`往復の運賃（${(TOKYO_TRAIN_FARE * 2).toLocaleString("ja-JP")}円）が足りない`);
    return { used: false, exerted: false };
  }
  if (!await read("ch5_tokyo_go", "bg_ch3_train_arrival", owner)) return { used: false, exerted: false };
  addMoney(-TOKYO_TRAIN_FARE);
  state.flags._ch2_region = TOKYO;
  save();
  // 第5章で初めて着いた日は、ムカイさんに屋根裏を貸してもらう。
  if (!state.flags[ATTIC_FLAG]) {
    if (await read("ch5_tokyo_arrival", "bg_mukai_shop", owner)) { state.flags[ATTIC_FLAG] = true; markMet("mukai_master"); save(); }
  }
  return { used: true, exerted: false };
}

async function goHome(owner) {
  if (!await read("ch5_tokyo_back", "bg_ch3_train_arrival", owner)) return { used: false, exerted: false };
  // 帰りの分は取り置いてある。旧保存などで足りない時も、東京に閉じ込めない（残りの所持金まで）。
  addMoney(-Math.min(TOKYO_TRAIN_FARE, Math.max(0, state.money)));
  state.flags._ch2_region = "home";
  save();
  return { used: true, exerted: false };
}

/**
 * mukai のシフト（VOL09。chapters/tokyo-mukai.js と第3章の東京で共通）。導入はムカイさんとの小会話を巡回して読む。
 * ムカイさんの LIME で呼ばれた日は called（日当に上乗せ）。
 */
export async function chapterFiveMukaiShift(owner = state, { called = false } = {}) {
  const entry = TOKYO_SPOTS.find(item => item.shift);
  const talks = state.flags[TALKS_FLAG] ||= {};
  const scene = entry.talks[(talks[entry.id] || 0) % entry.talks.length];
  const done = await runMukaiShift({ called, intro: () => read(scene, entry.preview, owner) });
  if (!done || state !== owner) return false;
  talks[entry.id] = (talks[entry.id] || 0) + 1;
  return true;
}

/** シフトの帰りに裏口のてつこへ（行動を使わない。体力が少し戻る・VOL11）。 */
async function offerTetsuko(owner) {
  const go = await modal({ title: "裏口のてつこ", body: "帰りに裏口をのぞくと、看板猫のてつこがベンチで丸くなっている。",
    options: [{ label: "少し構っていく", value: true, test: "tokyo-tetsuko-yes", primary: true }, { label: "今日はそっとしておく", value: false, test: "tokyo-tetsuko-no" }] });
  if (!go || state !== owner) return;
  if (!await careForTetsuko(owner)) return;
  addStamina(12);
  toast("てつこに、少し元気をもらった", { kind: "good" });
}

/** 夜: 東京にいれば屋根裏で寝る（帰らない）。 */
export async function tokyoNight() {
  state.flags._home_tonight = true; // 地元の帰り道の一言・道での出会いは東京では出さない
  await showBg(ATTIC_BG, "night");
  return true;
}
export const tokyoWakeBackground = () => ATTIC_BG;
