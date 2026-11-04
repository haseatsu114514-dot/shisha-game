// 第5章の東京（#2033 D）。勝負の日を決める前の自由行動で、Dr.fookah の配送便に乗せてもらって東京へ行ける。
// オーナー指定（2026-11-02）: 東京はムカイさんの屋根裏に好きなだけ泊まれて、好きな時に帰れる。
// 交通（FIN13・オーナー「東京は配送便で」）: 問屋街から東京店へ葉を運ぶ車に乗せてもらうので運賃はかからない。
// 便は昼に出て夜に着く（その日の昼と夜の2行動）。帰りも同じ。決まりは chapters/ch5-travel.js。
// 最初に乗る日は、Dr.fookah の裏口で店員に乗せてもらう話になる（ch5_tokyo_van_first）。
// 行き先: mukai（手伝い）・Smoke & Glory（スティーブ）・鉄の煙（ヴォルク）・公園・裏口のてつこ・東京の店・屋根裏・地元へ帰る。
// ましろ（ヒロイン）は第5章の会話に出さない。綾取は第3章の後に福岡へ戻ったので煙幕は出さない。
// 台詞は data/dialogue/ch5_tokyo.json（てつこと夜の公園は第3章の場面を使う）。現在地は flags._ch2_region = "tokyo"。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity, visitAffinity } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { tokyoVanBlock, TOKYO_VAN_SLOTS } from "./ch5-travel.js";
import { openShop } from "../daily/shop.js";
import { TOKYO_VISIT_COST } from "../daily/spots.js";
import { modal } from "../core/ui.js";
import { runMukaiShift, loadMukaiShift, MUKAI_SHIFT_STAMINA } from "./tokyo-mukai.js";
import { reflectAt } from "../daily/reflection.js";
import { TOKYO_OUTINGS, outingDialogueId, outingCounts, OUTINGS_FLAG } from "./ch3-outing-progress.js";
import { consultLessons } from "../core/growth.js";

export const TOKYO = "tokyo";
const ATTIC_FLAG = "_ch5_tokyo_attic"; // ムカイさんに屋根裏を貸してもらった（最初の到着の場面を読んだ）
const VAN_FLAG = "_ch5_tokyo_van"; // Dr.fookah の配送便に乗せてもらう話を読んだ（最初に「東京へ」を選んだ日）
const HOME_ID = "ch5_tokyo_home";
const TALKS_FLAG = "_ch5_tokyo_talks"; // 小会話の巡回の回数（人ごと）
const ATTIC_BG = "bg_mukai_attic"; // ムカイさんの店の上の屋根裏（2026-11-02 採用）。夜は既存の夜の暗転を共用する

// 座標は東京の地図（bg_tokyo_map_*）に対する百分率。第3章の TOKYO_MAP_PLACES と同じ位置。
const spot = fields => Object.freeze({ region: TOKYO, kind: "ch5_tokyo", ...fields });
export const TOKYO_SPOTS = Object.freeze([
  spot({ id: "ch5_tokyo_mukai", label: "mukai", area: "高架下の商店街", x: 29.6, y: 62.7, theme: "baito", glyph: "店", face: "mukai_master",
    preview: "bg_mukai_shop", stamina: MUKAI_SHIFT_STAMINA, shift: true, talks: ["ch5_tokyo_mukai_help", "ch5_tokyo_mukai_help_b", "ch5_tokyo_mukai_help_c"],
    desc: "ムカイさんの店のシフト（日当6,000円）。帰りに裏口のてつこにも会える。" }),
  spot({ id: "ch5_tokyo_steve", charId: "steve", label: "Smoke & Glory", area: "スティーブの店", x: 23.3, y: 36.1, theme: "rival", glyph: "煙", face: "steve",
    preview: "bg_steve_shop", cost: TOKYO_VISIT_COST, stamina: -16, stat: "technique",
    talks: ["ch5_tokyo_steve", "ch5_tokyo_steve_b", "ch5_tokyo_steve_c"], desc: "タイマーの並ぶ店。二口目までの一台。" }),
  spot({ id: "ch5_tokyo_volk", charId: "volk", label: "鉄の煙", area: "ヴォルクの店", x: 55.9, y: 40.4, theme: "rival", glyph: "煙", face: "volk",
    preview: "bg_volk_shop", cost: TOKYO_VISIT_COST, stamina: -16, stat: "insight",
    talks: ["ch5_tokyo_volk", "ch5_tokyo_volk_b", "ch5_tokyo_volk_c"], desc: "計器の並ぶ店。測ってから、客に聞く。" }),
  spot({ id: "ch5_tokyo_park", label: "公園", area: "池のある公園", x: 69, y: 62, theme: "park", glyph: "園", preview: "bg_street",
    stamina: 20, desc: "何も決めずに歩いて、少し体を休める。" }),
  // 裏口のてつこは地図の行き先にせず、mukai のシフトの帰りに会う（VOL11）。
  spot({ id: "ch5_tokyo_shop", kind: "shop", label: "Dr.fookah 東京店", area: "駅前の店", x: 15, y: 51, theme: "shop", glyph: "卸",
    preview: "bg_fookah_showroom", desc: "東京の店。第3章と同じ品ぞろえ。" }),
  spot({ id: "ch5_tokyo_attic", label: "屋根裏", area: "mukaiの上", x: 45, y: 63, theme: "rest", glyph: "休", preview: ATTIC_BG,
    stamina: 55, desc: "ムカイさんの屋根裏で休む。体力が大きく戻る。" }),
  // 心得の盤の内省（SPEC 2.8）: 第3章と同じ池の弁天堂（IR26）。灯せる火種がある時だけ地図に出す（ch5-daily.js）。時間は使わない。
  spot({ id: "ch5_tokyo_shrine", reflect: "tokyo_shrine", label: "池の弁天堂", area: "公園の池", x: 91, y: 73, theme: "rest", glyph: "弁",
    preview: "bg_tokyo_park", desc: "池に浮かぶ小さなお堂。学んだことを火にして、心得の盤に灯す（時間は使わない）。" }),
  // 帰りも東京店から出る配送便（地図の絵は文字の盾。新幹線の駅の絵は使わない）。
  // 文字の盾は札を印の上に描くので、駅の絵だった頃（y: 20）と同じ所に見えるよう少し下げた。
  spot({ id: HOME_ID, label: "地元へ帰る（配送便）", area: "Dr.fookah 東京店の帰りの便", x: 40, y: 28, theme: "rest", glyph: "便", preview: "bg_street",
    desc: "配送便で橙須へ帰る（運賃はかからない）。昼に出て夜に着くので、今日の昼と夜の2行動を使う。" }),
]);

/** 地元の地図に出す「東京へ（配送便）」。昼だけ出る。 */
// 位置: CHOI-ZAP・観音堂・路上占いの出る場所と重ならない左端（新幹線の駅のアイコンだった頃に #2371 で決めた場所）。
// 文字の盾は札を印の上に描くので、駅の絵の頃（y: 40）と同じ所に見え、電車の「駅」（15,36）に重ならないよう少し下げた。
export const TO_TOKYO_SPOT = Object.freeze({
  id: "ch5_to_tokyo", kind: "ch5_tokyo", label: "東京へ（配送便）", area: "Dr.fookah の搬入口", x: 8, y: 48, theme: "stadium", glyph: "便",
  preview: "bg_shop",
  desc: "Dr.fookah の配送便に乗せてもらう（運賃はかからない）。昼に出て夜に着くので、今日の昼と夜の2行動を使う。ムカイさんの屋根裏に好きなだけ泊まれて、帰りも配送便。",
});

// 配送便は昼だけ。乗れない時もピンは残し、理由を出す（ドバイの砂丘と同じ見せ方）。
const vanPin = (entry, value) => {
  const blocked = tokyoVanBlock(value);
  return blocked ? Object.freeze({ ...entry, unavailable: blocked.why, unavailableTag: blocked.tag }) : entry;
};
/** 地元の地図に出す今の「東京へ（配送便）」。 */
export const chapterFiveTokyoPin = (value = state) => vanPin(TO_TOKYO_SPOT, value);
/** 東京の地図に出す今の行き先（帰りの配送便は昼だけ）。 */
export const tokyoSpotsNow = (value = state) => TOKYO_SPOTS.map(entry => entry.id === HOME_ID ? vanPin(entry, value) : entry);

export const inTokyo = (value = state) => value?.flags?._ch2_region === TOKYO;
const SCENES = TOKYO_SPOTS.flatMap(entry => entry.talks || []).concat(["ch5_tokyo_van_first", "ch5_tokyo_go", "ch5_tokyo_back", "ch5_tokyo_arrival", "ch5_tokyo_park_day", "ch5_tokyo_attic_rest", "ch5_tokyo_fortune"]);
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

/** 読み終えたら true。中断・LOADは false（代金・体力・既読を残さない）。tod は背景の時間帯（配送便で着く夜など）。 */
async function read(id, bg, owner, tod = timeOfDay()) {
  if (bg) await showBg(bg, tod);
  if (state !== owner) return false;
  const result = await play(id);
  return state === owner && !!result && !result.cancelled;
}

/**
 * 心得の盤の授業（SPEC 2.6・SBD61）: 会いに行った店で、灯した授業があれば相談して話を聞く（第5章のドバイの屋敷と同じ）。
 * スティーブの授業（ピザとシーシャの夜）は第3章の大会の翌夜にだけ開ける夜なので、第5章では相談しない（大会後の東京で相談する）。
 */
const TOKYO_TEACHERS = Object.freeze({ ch5_tokyo_volk: "volk" });

/** 東京の行き先と「東京へ」の処理。対象外の行き先は null（日常ループの通常の処理へ）。 */
export async function performTokyoSpot(spot, { staminaGuard } = {}) {
  if (spot.id !== TO_TOKYO_SPOT.id && spot.region !== TOKYO) return null;
  const owner = state;
  try { await loadTokyoScenes(); } catch {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return { used: false, exerted: false };
  }
  if (state !== owner) return { used: false, exerted: false };
  if (spot.id === TO_TOKYO_SPOT.id || spot.id === HOME_ID) {
    const blocked = tokyoVanBlock(state);
    if (blocked) { toast(blocked.why); return { used: false, exerted: false }; }
    return spot.id === HOME_ID ? goHome(owner) : goToTokyo(owner);
  }
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
    toast("お金が足りない");
    return { used: false, exerted: false };
  }
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
  const talks = state.flags[TALKS_FLAG] ||= {};
  const visits = talks[spot.id] || 0;
  const scene = spot.talks[visits % spot.talks.length];
  if (!await read(scene, spot.preview, owner)) return { used: false, exerted: false };
  if (spot.cost) addMoney(-spot.cost);
  if (spot.pay) addMoney(spot.pay);
  addStamina(spot.stamina);
  talks[spot.id] = visits + 1;
  // 好感度は通いと同じ値（core/stats.js の visitAffinity。第5章はゆっくりの 10・5）。1回目は段階会話、2回目からは小会話。
  // ヴォルクは第3章の終盤に会うので、ここへ通って♥5に届き、授業（♥5）を相談できる（IR23）
  if (spot.charId) { gainAffinity(spot.charId, visitAffinity(visits ? "talk" : "story")); markMet(spot.charId); }
  earnStat(spot.stat, 4);
  const teacher = TOKYO_TEACHERS[spot.id];
  if (teacher && state === owner) await consultLessons(teacher, { bg: sceneBg(spot.preview, timeOfDay()).url });
  return { used: true, exerted: true };
}

/** 配送便で東京へ（昼に出て夜に着く。今日の昼と夜の2行動）。着いた夜は屋根裏で寝る。 */
async function goToTokyo(owner) {
  // 最初に選んだ日は、Dr.fookah の裏口で配送便に乗せてもらう話になる（読むだけでは行動を使わない）。
  if (!state.flags[VAN_FLAG]) {
    if (!await read("ch5_tokyo_van_first", "bg_shop", owner)) return { used: false, exerted: false };
    state.flags[VAN_FLAG] = true;
    save();
  }
  if (!await read("ch5_tokyo_go", "bg_street", owner)) return { used: false, exerted: false };
  state.flags._ch2_region = TOKYO;
  save();
  // 第5章で初めて着いた夜は、ムカイさんに屋根裏を貸してもらう。
  if (!state.flags[ATTIC_FLAG]) {
    if (await read("ch5_tokyo_arrival", "bg_mukai_shop", owner, "night")) { state.flags[ATTIC_FLAG] = true; markMet("mukai_master"); save(); }
  }
  return { used: true, exerted: false, slotsUsed: TOKYO_VAN_SLOTS };
}

/** 帰りの配送便（昼に出て夜に地元へ着く。今日の昼と夜の2行動）。 */
async function goHome(owner) {
  if (!await read("ch5_tokyo_back", "bg_street", owner)) return { used: false, exerted: false };
  state.flags._ch2_region = "home";
  save();
  return { used: true, exerted: false, slotsUsed: TOKYO_VAN_SLOTS };
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
