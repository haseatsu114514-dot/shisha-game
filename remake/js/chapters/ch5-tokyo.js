// 第5章の東京（#2033 D）。勝負の日を決める前の自由行動で、Dr.fookah の配送便に乗せてもらって東京へ行ける。
// オーナー指定（2026-11-02）: 東京はムカイさんの屋根裏に好きなだけ泊まれて、好きな時に帰れる。
// 交通（FIN13・オーナー「東京は配送便で」）: 問屋街から東京店へ葉を運ぶ車に乗せてもらうので運賃はかからない。
// 便は昼に出て夜に着く（その日の昼と夜の2行動）。帰りも同じ。決まりは chapters/ch5-travel.js。
// 最初に乗る日は、Dr.fookah の裏口で店員に乗せてもらう話になる（ch5_tokyo_van_first）。
// 行き先: mukai（手伝い）・Smoke & Glory（スティーブ）・鉄の煙（ヴォルク）・公園・裏口のてつこ・東京の店・屋根裏・地元へ帰る。
// 第3章の東京と同じく、CHOI-ZAP（会員の時だけ）とクラブSEAM（夜だけ・時間は使わない）にも寄れる（#2033）。
// ましろ（ヒロイン）は第5章の店の会話に出さない。恋人の時だけ、mukai で「ましろちゃんと過ごす（恋人）」を選べる
// （BLC03・chapters/mashiro-time.js。地元の恋人のデートにあたり、恋人の節目の続きをここで読む）。
// 綾取は第3章の後に福岡へ戻ったので煙幕は出さない。
// 台詞は data/dialogue/ch5_tokyo.json（てつこと夜の公園は第3章の場面を使う）。現在地は flags._ch2_region = "tokyo"。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { setBg, toast } from "../core/ui.js";
import { vanRide } from "../core/scene-motions.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { chainStageAt } from "./visit-chains.js";
import { chainVisitDue, playChainStage } from "./visit-chain-play.js";
import { addMoney, addStamina, earnStat, gainAffinity, visitAffinity, earnSceneCompletion } from "../core/stats.js";
import { spendableMoney } from "../core/travel-budget.js";
import { tokyoVanBlock, TOKYO_VAN_SLOTS } from "./ch5-travel.js";
import { openShop } from "../daily/shop.js";
import { TOKYO_VISIT_COST, quietTurn } from "../daily/spots.js";
import { modal } from "../core/ui.js";
import { runMukaiShift, loadMukaiShift, MUKAI_SHIFT_STAMINA, mukaiShiftPay } from "./tokyo-mukai.js";
import { loverMilestonesDue, readLoverMilestone } from "./lover-entry.js";
import { reflectAt } from "../daily/reflection.js";
import { TOKYO_OUTINGS, outingDialogueId, outingCounts, OUTINGS_FLAG } from "./ch3-outing-progress.js";
import { consultLessons } from "../core/growth.js";
import { keepDailyHud } from "../daily/hud.js";
import { finaleAtVisit, playFinale } from "../daily/bonds.js";
import { mashiroTimeOpen, spendMashiroTime, MASHIRO_TIME_FILE, MASHIRO_TIME_SCENES } from "./mashiro-time.js";
import { petitAfterDate } from "../daily/petit-shuraba.js";

export const TOKYO = "tokyo";
const ATTIC_FLAG = "_ch5_tokyo_attic"; // ムカイさんに屋根裏を貸してもらった（最初の到着の場面を読んだ）
const VAN_FLAG = "_ch5_tokyo_van"; // Dr.fookah の配送便に乗せてもらう話を読んだ（最初に「東京へ」を選んだ日）
const HOME_ID = "ch5_tokyo_home";
const TALKS_FLAG = "_ch5_tokyo_talks"; // 小会話の巡回の回数（人ごと）
const MASHIRO_TIME_STAMINA = -10; // 第3章の mukai で過ごす時間と同じ（ch3-tokyo-daily.js の readMashiroBond）
const ATTIC_BG = "bg_mukai_attic"; // ムカイさんの店の上の屋根裏（2026-11-02 採用）。夜は既存の夜の暗転を共用する

// 座標は東京の地図（bg_tokyo_map_*）に対する百分率。第3章の TOKYO_MAP_PLACES と同じ位置。
const spot = fields => Object.freeze({ region: TOKYO, kind: "ch5_tokyo", ...fields });
/** 第5章の東京の店で迎える♥5の締めくくり（スティーブ #2705・ヴォルク 2026-11-07 オーナー指示「スティーブと揃える」）。 */
const TOKYO_FINALES = Object.freeze(["steve", "volk"]);
/** この来店が♥5の締めくくりになるか（performTokyoSpot の分岐と、地図の利用料 cost の両方がこれを見る）。 */
const finaleVisit = entry => TOKYO_FINALES.includes(entry.charId) && finaleAtVisit(entry.charId);
// スティーブ・ヴォルクの店。第5章の締めくくりの来店はいつも代金を取らないので、その間は地図の利用料も0にして、4,000円に
// 足りない日でも入れる（第3章の ch3-tokyo-daily.js の cost と同じ考え方。第3章は払える日に一台も選べるので、足りない日だけ0）。
// ふだんの来店は TOKYO_VISIT_COST。
const rivalSpot = fields => Object.freeze(Object.defineProperty({ region: TOKYO, kind: "ch5_tokyo", ...fields }, "cost", {
  enumerable: true, get: () => finaleVisit(fields) ? 0 : TOKYO_VISIT_COST }));
export const TOKYO_SPOTS = Object.freeze([
  spot({ id: "ch5_tokyo_mukai", label: "mukai", area: "高架下の商店街", x: 29.6, y: 62.7, theme: "baito", glyph: "店", face: "mukai_master",
    preview: "bg_mukai_shop", stamina: MUKAI_SHIFT_STAMINA, shift: true, talks: ["ch5_tokyo_mukai_help", "ch5_tokyo_mukai_help_b", "ch5_tokyo_mukai_help_c"],
    desc: "ムカイさんの店のシフト。日当は大会実績で変わる。帰りに裏口のてつこにも会える。" }),
  rivalSpot({ id: "ch5_tokyo_steve", charId: "steve", label: "Smoke & Glory", area: "スティーブの店", x: 23.3, y: 36.1, theme: "rival", glyph: "煙", face: "steve",
    preview: "bg_steve_shop", stamina: -16, stat: "technique",
    talks: ["ch5_tokyo_steve", "ch5_tokyo_steve_b", "ch5_tokyo_steve_c"], desc: "タイマーの並ぶ店。二口目までの一台。" }),
  rivalSpot({ id: "ch5_tokyo_volk", charId: "volk", label: "鉄の煙", area: "ヴォルクの店", x: 55.9, y: 40.4, theme: "rival", glyph: "煙", face: "volk",
    preview: "bg_volk_shop", stamina: -16, stat: "insight",
    talks: ["ch5_tokyo_volk", "ch5_tokyo_volk_b", "ch5_tokyo_volk_c"], desc: "温度計の立つ店。測ってから、客に聞く。" }),
  spot({ id: "ch5_tokyo_park", label: "公園", area: "池のある公園", x: 69, y: 62, theme: "park", glyph: "園", preview: "bg_tokyo_park",
    stamina: 20, desc: "何も決めずに歩いて、少し体を休める。" }),
  // 裏口のてつこは地図の行き先にせず、mukai のシフトの帰りに会う（VOL11）。
  spot({ id: "ch5_tokyo_shop", kind: "shop", label: "Dr.fookah 東京店", area: "駅前の店", x: 15, y: 51, theme: "shop", glyph: "卸",
    preview: "bg_fookah_showroom", desc: "東京の店。第3章と同じ品ぞろえ。" }),
  spot({ id: "ch5_tokyo_attic", label: "屋根裏", area: "mukaiの上", x: 45, y: 63, theme: "rest", glyph: "休", preview: ATTIC_BG,
    stamina: 55, desc: "ムカイさんの屋根裏で休む。体力が大きく戻る。" }),
  // CHOI-ZAP（無人のジム）: 会員の時だけ地図に出す（ch5-daily.js）。gym の印で、3日間の「風邪をひきにくい」が付く（daily/calendar.js）。
  // 経験値の鍵は、第5章のほかの行き先と同じくこの行き先の id（第3章の東京の店とは分ける）。
  spot({ id: "ch5_tokyo_gym", label: "CHOI-ZAP", area: "高架下のジム", x: 34.9, y: 75.9, theme: "gym", glyph: "体", preview: "bg_choizap",
    stamina: -8, stat: "charm", gym: true, desc: "全国の店で使える会員証で、体を動かす。" }),
  // クラブSEAM（DJ・時間は使わない）: 夜だけ。店主の針間ヨルに会うまでは「地下の店」と出す（daily/map.js の charId・unknownLabel）。
  spot({ id: "ch5_tokyo_club", charId: "yoru", label: "クラブSEAM", area: "路地の地下", x: 86, y: 50, theme: "stadium", glyph: "♪", night: true,
    unknownLabel: "地下の店", unknownDesc: "地下から低い音がする。のぞいてみる（時間は使わない）。",
    preview: "bg_club_seam_entrance", desc: "セットを選んで曲をつなぐ（時間は使わない）。" }),
  // 心得の盤の内省（SPEC 2.8）: 第3章と同じ池の弁天堂（IR26）。灯せる火種がある時だけ地図に出す（ch5-daily.js）。時間は使わない。
  spot({ id: "ch5_tokyo_shrine", reflect: "tokyo_shrine", label: "池の弁天堂", area: "公園の池", x: 91, y: 73, theme: "rest", glyph: "弁",
    preview: "bg_tokyo_park", desc: "池に浮かぶ小さなお堂。学んだことを火にして、心得の盤に灯す（時間は使わない）。" }),
  // 帰りも東京店から出る配送便（地図の絵は配送便のアイコン #3022。新幹線の駅の絵は使わない）。
  // ピンの位置は、駅の絵だった頃（y: 20）と同じ所に見えるよう少し下げたもの。
  spot({ id: HOME_ID, label: "地元へ帰る（配送便）", area: "Dr.fookah 東京店の帰りの便", x: 40, y: 28, theme: "rest", glyph: "便", preview: "bg_street",
    desc: "配送便で橙須へ帰る（運賃はかからない）。昼に出て夜に着くので、今日の昼と夜の2行動を使う。" }),
]);

/** 地元の地図に出す「東京へ（配送便）」。昼だけ出る。 */
// 位置: CHOI-ZAP・観音堂・路上占いの出る場所と重ならない左端（新幹線の駅のアイコンだった頃に #2371 で決めた場所）。
// 駅の絵の頃（y: 40）と同じ所に見え、電車の「駅」（15,36）に重ならないよう少し下げた。
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
// 通いの続き（chapters/visit-chains.js）の段が読める店は「！」。無い時は付けず、いつもの判定（締めくくり等・daily/spots.js）に任せる。
// 代金（rivalSpot の cost）は読み出しのたびに決まるので、写しも同じ getter を持たせる。
const chainPin = (entry, value) => chainStageAt(value, entry.id)
  ? Object.freeze(Object.defineProperties({}, { ...Object.getOwnPropertyDescriptors(entry), hasNew: { value: () => true, enumerable: true } }))
  : entry;
/** 東京の地図に出す今の行き先（帰りの配送便は昼だけ）。 */
export const tokyoSpotsNow = (value = state) => TOKYO_SPOTS.map(entry => entry.id === HOME_ID ? vanPin(entry, value)
  : entry.id === "ch5_tokyo_mukai" ? Object.freeze({ ...chainPin(entry, value), desc: `ムカイさんの店のシフト（日当${mukaiShiftPay(value).toLocaleString("ja-JP")}円）。帰りに裏口のてつこにも会える。` })
  : chainPin(entry, value));

export const inTokyo = (value = state) => value?.flags?._ch2_region === TOKYO;
const REST_SCENES = ["ch5_tokyo_attic_rest", "ch5_tokyo_attic_rest_b", "ch5_tokyo_attic_rest_c"];
const SCENES = TOKYO_SPOTS.flatMap(entry => entry.talks || []).concat(["ch5_tokyo_van_first", "ch5_tokyo_go", "ch5_tokyo_back", "ch5_tokyo_arrival", "ch5_tokyo_park_day", ...REST_SCENES, "ch5_tokyo_fortune",
  "ch5_tokyo_gym_day", "ch5_tokyo_gym_night", "ch5_steve_bond_finale", "ch5_volk_bond_finale"]);
// てつこのお世話は第3章の続き（通うほど懐いていく。回数も第3章と同じ記録。ch3-outing-progress.js の stages・loop）
const TETSUKO = TOKYO_OUTINGS.find(outing => outing.id === "tetsuko");
// 公園と CHOI-ZAP は、昼・夜それぞれの小品を順番に読む（SPV03。daily/spots.js の quietTurn）。
// 一本目は第5章の場面、続きは第3章で書いた東京の小品（章に触れない文だけ。「遠征バッジ」の ch3_choizap_app は第3章だけ）。
const PARK_SCENES = Object.freeze({
  day: ["ch5_tokyo_park_day", "ch3_outing_park_walk_day_b", "ch3_outing_park_walk_day_c"],
  night: ["ch3_outing_park_walk_night", "ch3_outing_park_walk_night_b", "ch3_outing_park_walk_night_c"],
});
const GYM_SCENES = Object.freeze({
  day: ["ch5_tokyo_gym_day", "ch3_choizap_lunch", "ch3_choizap_train"],
  night: ["ch5_tokyo_gym_night", "ch3_choizap_locker"],
});
/** 今の時間帯の次の一本 { id, key, count }。読み終えたら flags[key] を count + 1 にする。 */
function quietScene(key, scenes) {
  const night = state.slot >= 1, ids = scenes[night ? "night" : "day"];
  return quietTurn(key, ids, night ? "night" : "") || { id: ids[0], key: null, count: 0 };
}
const readTurn = turn => { if (turn.key) state.flags[turn.key] = turn.count + 1; };
const CH3_ACTIVITY_SCENES = [...GYM_SCENES.day, ...GYM_SCENES.night].filter(id => id.startsWith("ch3_"));
const CH3_SCENES = [...PARK_SCENES.day, ...PARK_SCENES.night].filter(id => id.startsWith("ch3_")).concat(TETSUKO.stages, TETSUKO.loop);
async function careForTetsuko(owner) {
  const { openTetsukoTime, settleTetsukoTime, tetsukoVisitKey } = await import("../minigames/tetsuko-time.js");
  if (state !== owner) return false;
  const visitKey = tetsukoVisitKey(owner);
  const stageRead = (outingCounts(owner).tetsuko || 0) < TETSUKO.stages.length;
  if (stageRead && !await read(outingDialogueId(owner, TETSUKO), "bg_street", owner)) return false;
  if (state !== owner) return false;
  const result = await openTetsukoTime({ value: owner, visitKey,
    bg: sceneBg("bg_street", timeOfDay()).url, isCurrent: () => state === owner });
  if (state !== owner || result?.cancelled) return false;
  return settleTetsukoTime(owner, { ...result, visitKey, meaningful: stageRead || !!result?.meaningful }).committed;
}

let loading = null;
async function loadTokyoScenes() {
  if ([...SCENES, ...CH3_SCENES, ...CH3_ACTIVITY_SCENES, ...MASHIRO_TIME_SCENES].every(id => DB.dialogues[id]?.lines?.length)) return loadMukaiShift();
  loading ||= Promise.all([readDialogues("ch5_tokyo", SCENES), readDialogues("ch3_outings", CH3_SCENES),
    readDialogues(MASHIRO_TIME_FILE, MASHIRO_TIME_SCENES), readDialogues("ch3_activities", CH3_ACTIVITY_SCENES), loadMukaiShift().then(() => ({}))])
    .then(([tokyo, ch3, mashiro, activities]) => { Object.assign(DB.dialogues, tokyo, ch3, mashiro, activities); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

/**
 * 東京にいる保存を再開・LOAD した時は、最初の行動の前に東京の台詞を読んでおく。地図の「!」と MENU の「次に会うと」は
 * 締めくくりの台詞が読み込まれているかを見る（daily/bonds.js の finaleDue）ので、読む前は出なかった。
 * 読めなくても地図は開く（行き先を選んだ時に読み直し、失敗ならそこで知らせる）。
 */
export async function preloadTokyoScenes(value = state) {
  if (!inTokyo(value)) return;
  try { await loadTokyoScenes(); } catch { /* 行き先を選んだ時の読み込みで知らせる */ }
}

// 夜は外光のある場所に既存の夜の暗転（tint）を掛ける。屋根裏の絵は昼の光なので、tint を落とさない。
const showBg = (ref, tod) => { const { url, tint } = sceneBg(ref, tod); return setBg(url, { tint }); };

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
    const turn = quietTurn(spot.id, REST_SCENES);
    if (!turn || !await read(turn.id, ATTIC_BG, owner)) return { used: false, exerted: false };
    owner.flags[turn.key] = turn.count + 1;
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_tokyo_park") {
    // 池のある公園の絵（昼夜の差分あり）。第3章の公園と同じ（ch3-outings.js の OUTING_BG.park）
    const turn = quietScene(spot.id, PARK_SCENES);
    if (!await read(turn.id, spot.preview, owner)) return { used: false, exerted: false };
    readTurn(turn);
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_tokyo_tetsuko") {
    if (!await careForTetsuko(owner)) return { used: false, exerted: false };
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_tokyo_club") {
    // DJ はミニゲームなので時間・お金・体力を使わない（daily/dj-club.js）。クラブの場面が HUD を外すので、戻ったら日常の HUD を戻す。
    const { visitDjClub } = await import("../daily/dj-club.js");
    await keepDailyHud(() => visitDjClub({ isCurrent: () => state === owner }));
    return { used: false, exerted: false };
  }
  if (spot.gym) {
    // 第3章の東京の CHOI-ZAP と同じ手順（体力・魅力・初めて読んだ場面）。昼と夜で場面が違う。
    if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
    const turn = quietScene(spot.id, GYM_SCENES), scene = turn.id;
    if (!await read(scene, spot.preview, owner)) return { used: false, exerted: false };
    readTurn(turn);
    addStamina(spot.stamina);
    earnStat(spot.stat, 4);
    earnSceneCompletion(scene, owner);
    return { used: true, exerted: true };
  }
  if (!spot.talks) return null;
  if (spot.shift) {
    // 恋人のましろがいる時は、シフトに入るか、二人で過ごすかを選ぶ（BLC03）。恋人でなければ今までどおりシフトだけ。
    const mashiroMilestoneDue = () => loverMilestonesDue(["mashiro"]).length > 0;
    if (mashiroTimeOpen(state, { milestoneDue: mashiroMilestoneDue() })) {
      const pick = await modal({ title: "mukai", className: "tokyo-visit-choice", body: "何をしよう。", options: [
        { label: "ましろちゃんと過ごす（恋人）", value: "lover", test: "tokyo-mukai-lover", primary: true },
        { label: `シフトに入る（バイト・日当 ${mukaiShiftPay(state).toLocaleString("ja-JP")}円）`, value: "shift", test: "tokyo-mukai-shift" },
        { label: "やめておく", value: null, test: "tokyo-visit-cancel" }] });
      if (!pick || state !== owner) return { used: false, exerted: false };
      if (pick === "lover") {
        if (staminaGuard && !(await staminaGuard(MASHIRO_TIME_STAMINA))) return { used: false, exerted: false };
        if (!await spendMashiroTime({ read: scene => read(scene, spot.preview, owner), milestoneDue: mashiroMilestoneDue,
          readMilestone: () => readLoverMilestone("mashiro") }) || state !== owner) return { used: false, exerted: false };
        await petitAfterDate("mashiro"); // プチ修羅場（恋人が2人以上・一度きり。daily/petit-shuraba.js）
        if (state !== owner) return { used: false, exerted: false };
        addStamina(MASHIRO_TIME_STAMINA);
        return { used: true, exerted: true };
      }
    }
    if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
    if (!await chapterFiveMukaiShift(owner)) return { used: false, exerted: false };
    await offerTetsuko(owner);
    return { used: true, exerted: true };
  }
  // スティーブ・ヴォルク: 小会話を巡回して読む。代金は地図の利用料と同じ決まり（締めくくりの来店は0円・rivalSpot の cost）。
  const finale = finaleVisit(spot);
  const fee = spot.cost || 0;
  if (fee > spendableMoney(state)) {
    toast("お金が足りない", { se: "error" });
    return { used: false, exerted: false };
  }
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return { used: false, exerted: false };
  // スティーブ・ヴォルクの♥5の締めくくり（#2705・2026-11-07）: 第3章で見ていない人は、店に通って♥5になった次の来店で一度だけ。
  // 小会話の巡回は進めず、好感度は足さず、代金も取らない（締めくくりは bonds.js の playFinale が記録・専用ハガルを渡す）。
  // ヴォルクの授業の相談（TOKYO_TEACHERS）はこの来店では出さず、次の来店で（締めくくりと授業を一度に重ねない）。
  if (finale) {
    const bg = sceneBg(spot.preview, timeOfDay()).url;
    await showBg(spot.preview, timeOfDay());
    if (state !== owner || !await playFinale(spot.charId, { bg })) return { used: false, exerted: false };
    addStamina(spot.stamina);
    return { used: true, exerted: true };
  }
  const talks = state.flags[TALKS_FLAG] ||= {};
  const visits = talks[spot.id] || 0;
  // 小会話を一通り読んだ後は、通いの続き（chapters/visit-chains.js）の段を読む。代金・体力・好感度・能力はいつもの来店と同じで、
  // 小会話の巡回は進めない（段を読み終えると、また小会話に戻る）。
  const chain = await chainVisitDue(spot.id);
  if (state !== owner) return { used: false, exerted: false };
  const scene = spot.talks[visits % spot.talks.length];
  if (!await (chain ? playChainStage(chain, id => read(id, spot.preview, owner)) : read(scene, spot.preview, owner))) return { used: false, exerted: false };
  if (fee) addMoney(-fee);
  if (spot.pay) addMoney(spot.pay);
  addStamina(spot.stamina);
  if (!chain) talks[spot.id] = visits + 1;
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
  // 配送便の車窓。道路の灯が流れて、夜の東京に着く（#2688 A4）
  await vanRide(() => showBg(state.flags[ATTIC_FLAG] ? "bg_tokyo_map_night" : "bg_mukai_shop", "night"), { to: "tokyo" });
  if (state !== owner) return { used: false, exerted: false };
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
  // 配送便の車窓で地元の夜へ（#2688 A4）
  await vanRide(() => showBg("bg_osu_map_night", "night"), { to: "town" });
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
    options: [{ label: "てつこといっしょ", value: true, test: "tokyo-tetsuko-yes", primary: true }, { label: "今日はそっとしておく", value: false, test: "tokyo-tetsuko-no" }] });
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
