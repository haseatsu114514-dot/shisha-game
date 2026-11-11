// 第5章のドバイ（#2033 E）。勝負の日を決める前の自由行動で、飛行機でドバイへ行ける。
// オーナー指定（2026-11-02）: シェイクがはじめを気に入り「また遊びに来い」と言ってくれて、宿（屋敷の客間）は
// 用意してくれる（無料）。移動は1行動。
// 交通（FIN14・オーナー「ドバイの交通費はシェイクの手紙で」）: シェイクの手紙に毎回、往復の切符が同封されている（運賃はかからない）。
// 招待は手紙で届く（シェイクはLIMEの相手ではない）。最初の手紙は「ドバイへ」を選んだ時に読み、2通目からは
// 帰ってから DUBAI_LETTER_DAYS 日後の朝に届く（届いた手紙も「ドバイへ」を選んだ時に読む）。決まりは chapters/ch5-travel.js。
// 行き先: シェイクの屋敷（話す）・中庭の太陽・客間（休む）・スーク・路地裏のカフェ・クリーク沿い・Dr.fookah ドバイ店・空港（帰る）。
// 地図と座標は第4章の日常ループ（ch4-dubai-daily.js）と同じ。FESTAは大会の出張ブースだったので出さず、太陽は休暇で
// シェイクの屋敷に遊びに来ている（2026-11-02 オーナー「任せる」）。心得の盤の授業（シェイク・太陽）は、ここで会った時に相談する（SBD52）。
// 台詞は data/dialogue/ch5_dubai.json（クリーク沿いは第4章の場面を使う）。現在地は flags._ch2_region = "dubai"。
// ラクダレース（第4章で走っていなければ店先の出会いから）・カフェ・オアシス（ヌールの締めくくりまで）・「ヌールと砂丘へ」（誘われていれば）にも
// 行ける（chapterFiveDubaiLeisureSpots。2026-11-07 オーナー決定「第4章を飛ばしたプレイヤーも、第5章側で前提を補ってルートに入れる」）。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast, layers } from "../core/ui.js";
import { planeRide } from "../core/scene-motions.js";
import { showHud } from "../daily/hud.js";
import { CAMEL_DAILY_SPOT_ID, CAMEL_SCENES, CAMEL_STAGES, CH4_CAMEL_SCENE_FILES, CH5_CAMEL_MEET, camelDailySpot, camelRaceRecord, camelSceneBg,
  chapterFiveCamelMeetDue, advanceChapterFiveCamelMeet } from "./ch4-camel-progress.js";
import { DESERT_CAFE_PRICE, DESERT_GUIDE, DESERT_SPOT_IDS, completeDesertReunion, desertChapterFiveSpots, desertProgress, noorConfessionWaiting } from "./ch4-desert-progress.js";
import { spendableMoney } from "../core/travel-budget.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, affinityLevel, earnStat, gainAffinity, visitAffinity } from "../core/stats.js";
import { dubaiTripStatus, receiveDubaiLetter, useDubaiTicket, recordDubaiReturn, DUBAI_LETTER_AGAIN, DUBAI_LETTER_DAYS } from "./ch5-travel.js";
import { openShop } from "../daily/shop.js";
import { reflectAt } from "../daily/reflection.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "../daily/spot-hours.js";
import { consultLessons } from "../core/growth.js";
import { finaleAtVisit, playFinale } from "../daily/bonds.js";
import { SHEIKH_BOND_IDS, TAIYO_BOND_IDS, nextDubaiBondStory, recordDubaiBondRead, recordSheikhBondLetter, sheikhBondLetterDue } from "./dubai-bonds.js";
import { chainStageAt } from "./visit-chains.js";
import { chainVisitDue, playChainStage } from "./visit-chain-play.js";
import { CREEK_SCENES, CREEK_SPOT_IDS, CREEK_TURN, creekSpotScenes } from "./ch4-dubai-local.js";
import { quietTurn } from "../daily/spots.js";

export const DUBAI = "dubai";
// 手紙・切符・飛んだ回数・帰った日の旗は chapters/ch5-travel.js が持つ。
const GUEST_FLAG = "_ch5_dubai_guest"; // 最初の到着（屋敷の客間を用意してもらった）を読んだ
const TALKS_FLAG = "_ch5_dubai_talks"; // 小会話の巡回の回数（行き先ごと）
const RESIDENCE_BG = "bg_dubai_sheikh_residence";

// 座標は第4章のドバイの地図（bg_dubai_map）に対する百分率。第4章の行き先と同じ位置を使う。
// ただし客間・空港は、左上の状態表示と右上のボタンに隠れない位置へずらした（画面で確認）。
const spot = fields => Object.freeze({ region: DUBAI, kind: "ch5_dubai", ...fields });
export const DUBAI_SPOTS = Object.freeze([
  spot({ id: "ch5_dubai_sheikh", charId: "sheikh", label: "シェイクの屋敷", area: "中庭と低い卓の部屋", x: 19, y: 39, theme: "rival", glyph: "邸",
    face: "sheikh", preview: RESIDENCE_BG, stamina: -10, stat: "insight", talks: ["ch5_dubai_sheikh", "ch5_dubai_sheikh_b", "ch5_dubai_sheikh_c"],
    teacher: "sheikh", desc: "シェイクと話す。屋敷では、王族ではなく友人として。" }),
  spot({ id: "ch5_dubai_taiyo", charId: "da_silva", label: "中庭の太陽", area: "シェイクの屋敷の中庭", x: 34, y: 32, theme: "rival", glyph: "陽",
    face: "da_silva", preview: RESIDENCE_BG, stamina: -10, stat: "charm", teacher: "da_silva",
    talks: ["ch5_dubai_taiyo", "ch5_dubai_taiyo_b", "ch5_dubai_taiyo_c"],
    desc: "休暇で屋敷に遊びに来ている太陽。今日は審査じゃなく、ただのフェスタ。" }),
  spot({ id: "ch5_dubai_souq", label: "スーク", area: "旧市街の市場", x: 22, y: 58, theme: "shop", glyph: "市",
    preview: "bg_dubai_souq_day", stamina: -10, stat: "insight", talks: ["ch5_dubai_souq", "ch5_dubai_souq_b", "ch5_dubai_souq_c"],
    desc: "スパイスの匂いが立つ市場を歩く。" }),
  spot({ id: "ch5_dubai_alley", label: "路地裏のカフェ", area: "路地の奥", x: 30, y: 78, theme: "store", glyph: "茶",
    preview: "bg_dubai_alley_cafe_night", cost: 3000, stamina: -10, stat: "technique", talks: ["ch5_dubai_alley", "ch5_dubai_alley_b", "ch5_dubai_alley_c"],
    // 小会話を一通り読んだ後の、店員に一台を渡す通いの続き（chapters/visit-chains.js）が読める時に「！」
    hasNew: () => !!chainStageAt(state, "ch5_dubai_alley"),
    desc: "前に旅装のシェイクと向かい合った、小さなカフェ。一台3,000円（約70ディルハム）。" }),
  spot({ id: "ch5_dubai_creek", label: "クリーク沿い", area: "水辺の遊歩道", x: 58, y: 86, theme: "park", glyph: "水",
    preview: "bg_dubai_street_night", stamina: 20, desc: "水辺を歩いて、少し体を休める。" }),
  spot({ id: "ch5_dubai_shop", kind: "shop", label: "Dr.fookah ドバイ店", area: "街の中心", x: 40, y: 50, theme: "shop", glyph: "卸",
    preview: "bg_shop", desc: "日本で出た葉が全部そろう（時間は使わない）。" }),
  spot({ id: "ch5_dubai_guest", label: "客間", area: "シェイクの屋敷の二階", x: 8, y: 60, theme: "rest", glyph: "休", preview: RESIDENCE_BG,
    stamina: 55, desc: "屋敷の客間で休む。体力が大きく戻る。" }),
  // 心得の盤の内省（SPEC 2.8）: 第4章と同じ風の回廊モスク。灯せる火種がある時だけ地図に出す（ch5-daily.js）。時間は使わない。
  spot({ id: "ch5_dubai_mosque", reflect: "dubai_mosque", label: "風の回廊モスク", area: "見学の回廊", x: 58, y: 70, theme: "rest", glyph: "回",
    preview: "bg_dubai_map", desc: "案内付きで見学し、中庭の回廊で振り返る（昼だけ・時間は使わない）。" }),
  spot({ id: "ch5_dubai_home", label: "地元へ帰る", area: "ドバイ国際空港", x: 88, y: 42, theme: "rest", glyph: "空", preview: "bg_dubai_airport_day",
    desc: "迎えの車で空港へ。帰りの便は往復の切符に入っている・1行動。" }),
]);

/** 地元の地図に出す「ドバイへ（飛行機）」。シェイクの手紙に同封された往復の切符で行く。 */
export const TO_DUBAI_SPOT = Object.freeze({
  id: "ch5_to_dubai", kind: "ch5_dubai", label: "ドバイへ（飛行機）", area: "空港行きのバス", x: 56, y: 86, theme: "stadium", glyph: "空",
  face: "sheikh", preview: "bg_dubai_airport_day",
  desc: `シェイクの手紙に同封された往復の切符で行く（運賃はかからない）・1行動。帰ってから${DUBAI_LETTER_DAYS}日後に、次の切符入りの手紙が届く。屋敷の客間に泊まれて、好きな時に帰れる。`,
});

/** 地元の地図に出す今の「ドバイへ」。手紙が届いていれば「！」、次の手紙を待つ間は理由を出して押せない。 */
export function chapterFiveDubaiPin(value = state) {
  const status = dubaiTripStatus(value);
  if (!status.ok) {
    return Object.freeze({ ...TO_DUBAI_SPOT, unavailable: `シェイクの次の手紙は、まだ届いていない（あと${status.daysLeft}日）`, unavailableTag: "手紙待ち" });
  }
  return status.letter ? Object.freeze({ ...TO_DUBAI_SPOT, desc: `シェイクから手紙が届いている。${TO_DUBAI_SPOT.desc}`, hasNew: () => true }) : TO_DUBAI_SPOT;
}

export const inDubai = (value = state) => value?.flags?._ch2_region === DUBAI;

// ---- ラクダレース・カフェ・オアシス・ヌールと砂丘へ ------------------------------------------------
// 地図の id・アイコン・押せない理由・記録・報酬は第4章と同じ（ch4-camel-progress.js・ch4-desert-progress.js）。
// 2026-11-07 オーナー決定（「第4章のラクダレース／砂丘を飛ばしたプレイヤーも、第5章側で前提を補ってルートに入れる（完全な締め出しにはしない）」
// 「ノールの告白は第5章でも可能にする」）で、#2708 の「第4章で遊んだ人だけ」をやめた。第4章で走っていない人は Dr.fookah の店先で
// ファーリスと出会い（会い直し）、ヌールに会っていない人はカフェ・オアシスで出会う（どちらも第5章の場面。大会・宿の頃の話はしない）。
// 第5章で最初に行った日だけ、再会の場面を読む（新着の印も、その一度だけ出す）。
const CAMEL_AGAIN = Object.freeze({ scene: "ch5_dubai_camel_again", flag: "_ch5_dubai_camel_again" });
// DUNES_AGAIN は「第5章でヌールと会い直した」印も兼ねる: 第5章のカフェ・オアシスで出会った・再会した時にも立て、砂丘の前の再会を重ねない。
const DUNES_AGAIN = Object.freeze({ scene: "ch5_dubai_dunes_again", flag: "_ch5_dubai_dunes_again" });
// 再会の場面を読む間だけ立てる印: 第4章の締めくくりのあと砂丘へ行けずに帰国し、ヌールが告白を待っている（台本の promise の分岐）
const NOOR_PROMISE_FLAG = "_noor_ch5_promise";
// 店先の場面を読む間だけ立てる印: 第4章のラクダレースの段階（0 会っていない・1 知り合った／誘われた・2 本番を見た。台本の分岐）
const CH5_CAMEL_KNOWN = "_ch5_camel_known";
// 第4章でカフェ・オアシスに通っていた（締めくくりはまだ）人の、第5章で最初の来店（再会だけを今日の来店にする）。
const NOOR_CAFE_AGAIN = "ch5_noor_cafe_again";
// 第5章で読む書き出しの差し替え（第4章の宿・大会の前を前提にする言い方を使わない）。段階の数え方・報酬は元の id のまま（ch4-desert.js）。
const CH5_NOOR_SCENES = Object.freeze({ ch4_noor_meet: "ch5_noor_meet", ch4_noor_cafe_4: "ch5_noor_cafe_4", ch4_desert_sunset_first: "ch5_noor_sunset_first" });
const chapterFiveNoorScene = id => CH5_NOOR_SCENES[id] || id;
const reunionOf = entry => entry.id === CAMEL_DAILY_SPOT_ID ? CAMEL_AGAIN : DUNES_AGAIN;

// 店先の段階の位置。第5章の地図では Dr.fookah ドバイ店（40,50）の札に重なるので、右上へずらす（画面で確認。第4章の位置は変えない）
const CH5_CAMEL_SHOP_AT = Object.freeze({ x: 48, y: 36 });

/** 今のドバイの地図に足す行き先（ラクダレース場か店先・カフェ・オアシス・ヌールと砂丘へ）。 */
export function chapterFiveDubaiLeisureSpots(value = state) {
  if (value?.chapter !== 5 || !inDubai(value)) return [];
  const camel = camelDailySpot(value, { region: DUBAI, kind: "ch5_dubai", stamina: 0 });
  return [camel && chapterFiveCamelMeetDue(value) ? Object.freeze({ ...camel, ...CH5_CAMEL_SHOP_AT }) : camel, ...desertChapterFiveSpots(value, value.day)]
    .filter(Boolean)
    .map(entry => entry.unavailable || value.flags?.[reunionOf(entry).flag] ? entry : Object.freeze({ ...entry, hasNew: () => true }));
}
/** 地図で選んだ行き先を、今行ける時だけ返す（行けない行き先は処理しない）。 */
export const chapterFiveDubaiLeisureById = id => chapterFiveDubaiLeisureSpots().find(entry => entry.id === id && !entry.unavailable) || null;

const SCENES = DUBAI_SPOTS.flatMap(entry => entry.talks || [])
  .concat(["ch5_dubai_letter", ...DUBAI_LETTER_AGAIN, "ch5_dubai_go", "ch5_dubai_back", "ch5_dubai_arrival", "ch5_dubai_guest_rest",
    CAMEL_AGAIN.scene, DUNES_AGAIN.scene, CH5_CAMEL_MEET.scene, NOOR_CAFE_AGAIN, ...Object.values(CH5_NOOR_SCENES)]);
const CH4_SCENES = ["ch4_creek_walk_day", "ch4_creek_walk_night"];
// クリーク沿いは第4章と同じ場面を、同じ順番の続きから読む（SPV03）

let loading = null;
async function loadDubaiScenes() {
  if ([...SCENES, ...CH4_SCENES, ...CREEK_SPOT_IDS, ...SHEIKH_BOND_IDS, ...TAIYO_BOND_IDS].every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= Promise.all([readDialogues("ch5_dubai", SCENES), readDialogues("ch4_dubai_daily", CH4_SCENES),
    readDialogues("sheikh_bond", SHEIKH_BOND_IDS), readDialogues("taiyo_bond", TAIYO_BOND_IDS), readDialogues("ch4_spots", CREEK_SPOT_IDS)])
    .then(([dubai, ch4, sheikh, taiyo, creek]) => { Object.assign(DB.dialogues, dubai, ch4, sheikh, taiyo, creekSpotScenes(creek)); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

/**
 * ヌールに会ったことのある保存を再開・LOAD した時は、最初の行動の前にカフェ・オアシスと砂丘の台詞（ch4_desert.json）を読んでおく。
 * MENU の人間関係の「次にカフェ・オアシスで会うと」（daily/bonds.js の finaleDue）と「告白を選べる」（daily/romance.js の romanceRouteOpen）は
 * 締めくくり・告白の台詞が読み込まれているかを見るので、カフェか砂丘へ行くまで出なかった（地元にいても同じなので、ドバイにいる時に限らない）。
 * 読めなくても地図は開く（カフェ・砂丘を選んだ時に読み直し、失敗ならそこで知らせる）。東京の preloadTokyoScenes と同じ（ch5-daily.js）。
 */
export async function preloadNoorScenes(value = state) {
  if (!value?.met?.[DESERT_GUIDE]) return;
  try { await (await import("./ch4-desert.js")).loadDesertDialogues(); } catch { /* カフェ・砂丘を選んだ時の読み込みで知らせる */ }
}

const showBg = (ref, tod) => { const { url, tint } = sceneBg(ref, tod); return setBg(url, { tint }); };

/** 読み終えたら true。中断・LOADは false（代金・体力・既読を残さない）。 */
async function read(id, bg, owner) {
  if (bg) await showBg(bg, timeOfDay());
  if (state !== owner) return false;
  const result = await play(id);
  return state === owner && !!result && !result.cancelled;
}

const unused = { used: false, exerted: false };
const LOAD_FAILED = "会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます";

/** ドバイの行き先と「ドバイへ」の処理。対象外の行き先は null（日常ループの通常の処理へ）。 */
export async function performDubaiSpot(spot, { staminaGuard } = {}) {
  if (spot.id !== TO_DUBAI_SPOT.id && spot.region !== DUBAI) return null;
  const owner = state;
  try { await loadDubaiScenes(); } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  if (spot.id === TO_DUBAI_SPOT.id) return goToDubai(owner);
  if (spot.id === "ch5_dubai_home") return goHome(owner);
  if (spot.id === CAMEL_DAILY_SPOT_ID) return visitCamelTrack(owner);
  if (spot.id === DESERT_SPOT_IDS.dunes) return visitDunes(spot, owner);
  if (spot.id === DESERT_SPOT_IDS.desk) return visitNoorCafe(spot, owner);
  if (spot.reflect) {
    const hours = openingStatus(MOSQUE_VISITING_HOURS, state);
    if (!hours.ok) { toast(hours.why || "今は見学の時間ではない"); return unused; }
    await reflectAt(spot.reflect);
    return unused;
  }
  if (spot.id === "ch5_dubai_shop") {
    await openShop({ branch: "dubai" }); // 時間は使わない
    return unused;
  }
  if (spot.id === "ch5_dubai_guest") {
    if (!await read("ch5_dubai_guest_rest", RESIDENCE_BG, owner)) return unused;
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (spot.id === "ch5_dubai_creek") {
    const turn = quietTurn(CREEK_TURN, CREEK_SCENES[state.slot >= 1 ? "night" : "day"], state.slot >= 1 ? "night" : "");
    const scene = turn?.id || (state.slot >= 1 ? "ch4_creek_walk_night" : "ch4_creek_walk_day");
    if (!await read(scene, "bg_dubai_street_night", owner)) return unused;
    if (turn) state.flags[turn.key] = turn.count + 1;
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (!spot.talks) return null;
  // シェイク・太陽（2026-11-11 RVE03）: ♥5の締めくくりが来ていれば先に一度だけ、次に屋敷の段階の会話、無ければ小会話（chapters/dubai-bonds.js）。
  const bond = BOND_PLACE[spot.id];
  if (bond && finaleAtVisit(bond.who)) return readDubaiFinale(spot, bond.who, staminaGuard, owner);
  const story = bond && bondStoryDue(spot, bond);
  if (story) return readDubaiBondStory(spot, bond.who, story, staminaGuard, owner);
  // 小会話を一通り読んだ後は、通いの続き（chapters/visit-chains.js）の段を読む（路地裏のカフェ）。
  const chain = await chainVisitDue(spot.id);
  if (state !== owner) return unused;
  if (chain) return readDubaiChain(spot, chain, staminaGuard, owner);
  // シェイクの屋敷・スーク・路地裏のカフェ: 小会話を巡回して読む。
  if ((spot.cost || 0) > state.money) {
    toast("お金が足りない");
    return unused;
  }
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return unused;
  const talks = state.flags[TALKS_FLAG] ||= {};
  const visits = talks[spot.id] || 0;
  const scene = spot.talks[visits % spot.talks.length];
  if (!await read(scene, spot.preview, owner)) return unused;
  if (spot.cost) addMoney(-spot.cost);
  addStamina(spot.stamina);
  talks[spot.id] = visits + 1;
  // 好感度は会うたびに通いと同じ値（core/stats.js の visitAffinity。第5章はゆっくりの 10・5。東京と同じ。台帳 AFB01）。
  // 1回目は段階会話、2回目からは小会話（第3章の通いと同じ）。シェイク・太陽はここで♥5に届き、♥5の授業を相談できる（IR23）
  if (spot.charId) { gainAffinity(spot.charId, visitAffinity(visits ? "talk" : "story")); markMet(spot.charId); }
  earnStat(spot.stat, 4);
  // 心得の盤で灯した授業があれば、会ったこの場で相談して習う（盤が無効な時は何もしない・SBD52）
  if (spot.teacher && state === owner) await consultLessons(spot.teacher, { bg: sceneBg(spot.preview, timeOfDay()).url });
  return { used: true, exerted: true };
}

/**
 * 通いの続きの一段。代金・体力・能力はいつもの来店と同じ（閉店後の段は客の一台ではないので代金なし）。
 * 小会話の巡回は進めない。読み終えた時だけ段を記録する（chapters/visit-chain-play.js）。
 */
async function readDubaiChain(spot, due, staminaGuard, owner) {
  const fee = due.stage.free ? 0 : spot.cost || 0;
  if (fee > state.money) {
    toast("お金が足りない");
    return unused;
  }
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return unused;
  if (!await playChainStage(due, id => read(id, spot.preview, owner)) || state !== owner) return unused;
  if (fee) addMoney(-fee);
  addStamina(spot.stamina);
  earnStat(spot.stat, 4);
  return { used: true, exerted: true };
}

/** 屋敷の段階の会話がある行き先（中庭の太陽は、第5章の最初の来店の場面 ch5_dubai_taiyo の後から）。 */
const BOND_PLACE = Object.freeze({
  ch5_dubai_sheikh: Object.freeze({ who: "sheikh", where: "residence" }),
  ch5_dubai_taiyo: Object.freeze({ who: "da_silva", where: "courtyard", afterFirstTalk: true }),
});
function bondStoryDue(spot, bond) {
  if (bond.afterFirstTalk && !(state.flags[TALKS_FLAG]?.[spot.id] > 0)) return null;
  return nextDubaiBondStory(state, bond.who, bond.where, affinityLevel(bond.who));
}
/** 屋敷の行き先に、新しい段階の会話か締めくくりがあるか（地図の「！」）。 */
export const dubaiBondHasNew = spot => !!BOND_PLACE[spot.id]
  && (finaleAtVisit(BOND_PLACE[spot.id].who) || !!bondStoryDue(spot, BOND_PLACE[spot.id]));

/** 段階の会話を一本読む。読み終えた時だけ既読・体力・好感度（段階の値）・能力を確定する。 */
async function readDubaiBondStory(spot, who, scene, staminaGuard, owner) {
  if (staminaGuard && !(await staminaGuard(spot.stamina))) return unused;
  if (!await read(scene, spot.preview, owner)) return unused;
  recordDubaiBondRead(state, scene);
  addStamina(spot.stamina);
  gainAffinity(who, visitAffinity("story"));
  markMet(who);
  earnStat(spot.stat, 4);
  if (spot.teacher && state === owner) await consultLessons(spot.teacher, { bg: sceneBg(spot.preview, timeOfDay()).url });
  return { used: true, exerted: true };
}

/** ♥5の締めくくり（daily/bonds.js）。客の一台ではないので体力・能力は動かさない。読み終えた時だけ行動を使う。 */
async function readDubaiFinale(spot, who, staminaGuard, owner) {
  await showBg(spot.preview, timeOfDay());
  if (state !== owner) return unused;
  const done = await playFinale(who, { bg: sceneBg(spot.preview, timeOfDay()).url });
  if (!done || state !== owner) return unused;
  // 会った場で授業も相談できる（第3章の東京の締めくくりと同じ。ch3-tokyo-daily.js の withLesson）
  if (spot.teacher) await consultLessons(spot.teacher, { bg: sceneBg(spot.preview, timeOfDay()).url });
  return { used: true, exerted: false };
}

async function goToDubai(owner) {
  const status = dubaiTripStatus(state);
  if (!status.ok) {
    toast(`シェイクの次の手紙は、まだ届いていない（あと${status.daysLeft}日）`);
    return unused;
  }
  // 手紙が届いていれば先に読む（読むだけでは行動を使わない）。同封の往復の切符が手に入る。
  if (status.letter) {
    // 段階を読んだ後・締めくくりの後は、いつもの手紙の代わりにシェイクの手紙が一度ずつ届く（chapters/dubai-bonds.js）
    const bondLetter = sheikhBondLetterDue(state);
    const letter = bondLetter && DB.dialogues[bondLetter]?.lines?.length ? bondLetter : status.letter;
    if (!await read(letter, "bg_home", owner)) return unused;
    if (letter === bondLetter) recordSheikhBondLetter(state, bondLetter);
    receiveDubaiLetter(state);
    save();
  }
  const go = await modal({
    title: "ドバイへ行く",
    body: "シェイクがくれた往復の切符で行く（帰りの便も入っている）・1行動。<br>宿はシェイクの屋敷の客間。好きな時に帰れる。",
    options: [
      { label: "行く（シェイクの切符）", value: "go", test: "ch5-dubai-go", primary: true },
      { label: "やめておく", value: null, test: "ch5-dubai-cancel" },
    ],
  });
  if (go !== "go" || state !== owner) return unused;
  if (!await read("ch5_dubai_go", "bg_dubai_airport_day", owner)) return unused;
  useDubaiTicket(state);
  state.flags._ch2_region = DUBAI;
  save();
  // 機窓で日本の夜からドバイの朝焼けへ（#2688 A4）。着いた先は屋敷（初めて）か空港
  await planeRide(() => showBg(state.flags[GUEST_FLAG] ? "bg_dubai_airport_day" : RESIDENCE_BG, state.flags[GUEST_FLAG] ? "day" : timeOfDay()), { to: "dubai" });
  if (state !== owner) return unused;
  // 第5章で初めて着いた日は、シェイクに迎えられて客間へ案内される。
  if (!state.flags[GUEST_FLAG]) {
    if (await read("ch5_dubai_arrival", RESIDENCE_BG, owner)) { state.flags[GUEST_FLAG] = true; markMet("sheikh"); save(); }
  }
  return { used: true, exerted: false };
}

async function goHome(owner) {
  if (!await read("ch5_dubai_back", "bg_dubai_airport_day", owner)) return unused;
  // 帰りの便は往復の切符に入っている（ここでは払わない）。次の切符入りの手紙は、この日から数えて届く。
  recordDubaiReturn(state);
  state.flags._ch2_region = "home";
  save();
  // 機窓で夕方から日本の夜の街の灯へ（#2688 A4）
  await planeRide(() => showBg(`bg_osu_map_${timeOfDay()}`, timeOfDay()), { to: "home" });
  return { used: true, exerted: false };
}

/** 章の側の読み方やミニゲームは HUD を差し替えるので、終わったら日常ループの HUD を戻す（ch4-dubai-daily.js と同じ形）。 */
async function keepDailyHud(task) {
  const root = layers.hud.firstElementChild;
  try { return await task(); }
  finally {
    if (root && !root.isConnected) layers.hud.replaceChildren(root);
    showHud(true);
  }
}

let camelLoading = null;
/** ラクダレースの会話（第4章の台本 ch4_camel_race）は、レース場へ行く時だけ読み込む。 */
async function loadCamelScenes() {
  const ids = CH4_CAMEL_SCENE_FILES.ch4_camel_race;
  if (ids.every(id => DB.dialogues[id]?.lines?.length)) return;
  camelLoading ||= readDialogues("ch4_camel_race", ids).then(rows => { Object.assign(DB.dialogues, rows); })
    .catch(error => { camelLoading = null; throw error; });
  await camelLoading;
}

/**
 * ラクダレース場。練習レースの流れ・記録・報酬は第4章と同じ（ch4-camel-race.js。報酬は初めての完走だけ）。
 * 第4章で走っていない人の最初の一回は、Dr.fookah ドバイ店の店先で出会い（再会）と誘いの場面（時間・お金は使わない。第4章の店先と同じ）。
 * 翌日以降の昼にレース場で、本番を見ていなければ見学（ch4_camel_watch）から。
 * 第4章で走った人が第5章で最初に来た日は、レース前の会話（ch4_camel_replay）を再会の場面に替える。昼の枠は ch4-camel-race.js が完走の時だけ
 * 記録と一緒に進めて保存するので、日常ループには slotsUsed: 0 を返す（二重に進めない。第4章と同じ）。体力・お金は使わない。
 */
async function visitCamelTrack(owner) {
  if (chapterFiveCamelMeetDue(owner)) return meetFarisAtShop(owner);
  let race;
  try { [race] = await Promise.all([import("./ch4-camel-race.js"), loadCamelScenes()]); } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  const result = await keepDailyHud(() => race.visitCamelRace({
    read: id => readCamelScene(id, owner),
    replayIntro: !owner.flags[CAMEL_AGAIN.flag],
    isCurrent: () => state === owner,
    beforeRace: () => showHud(false),
  }));
  return result.used && state === owner ? { used: true, exerted: false, slotsUsed: 0 } : unused;
}

/** 第5章の店先の場面（2026-11-07 オーナー決定）。第4章の段階で出会い・知り合いの再会・本番を見た人の再会を出し分け、誘われた段階へ進める。 */
async function meetFarisAtShop(owner) {
  const camel = camelRaceRecord(owner);
  owner.flags[CH5_CAMEL_KNOWN] = camel.stage === CAMEL_STAGES.unknown ? 0 : camel.watched ? 2 : 1;
  let done = false;
  try { done = await read(CH5_CAMEL_MEET.scene, camelSceneBg(CAMEL_SCENES.meet), owner); } finally { delete owner.flags[CH5_CAMEL_KNOWN]; }
  if (!done || !advanceChapterFiveCamelMeet(owner)) return unused;
  owner.flags[CAMEL_AGAIN.flag] = true; // 第5章で会い直したので、レース場の前の再会（日本に帰ったんじゃ…）は読まない
  save();
  toast("明日の昼から、ラクダレース場へ行ける", { kind: "good" });
  return unused;
}

async function readCamelScene(id, owner) {
  const reunion = id === CAMEL_SCENES.replay && !state.flags[CAMEL_AGAIN.flag];
  if (!await read(reunion ? CAMEL_AGAIN.scene : id, camelSceneBg(id), owner)) return false;
  if (reunion) { state.flags[CAMEL_AGAIN.flag] = true; save(); }
  return true;
}

/**
 * ヌールと砂丘へ（誘われていれば）。外出・ツアー代・1日1回・記録・報酬は第4章と同じ（ch4-desert.js の performDesertSpot）。
 * 第5章でまだヌールに会い直していなければ、カフェ・オアシスの表のデスクで再会の場面を読んでから出かける。なるは地元にいるので砂丘に来ない（naru: false）。
 * 初めての砂丘の夕日は第5章の言い方（CH5_NOOR_SCENES）。
 * 第4章の締めくくりで「二人で見たい」と答えたまま砂丘へ行けずに帰国した人は、告白を待たれている（ツアー代なし）。
 * 再会は約束の続きの言い方（台本の条件で出す一時の印 NOOR_PROMISE_FLAG）にし、滑ったあとの夕日で confession_noor を読む
 * （帰国した後の言い方は台本の tournament_finished の分岐。第5章で締めくくりを迎えた人は visiting の分岐）。
 * day は通算の日（ch4-desert-progress.js の desertChapterFiveSpots）。
 */
async function visitDunes(spot, owner) {
  let desert, romance;
  try {
    [desert, romance] = await Promise.all([import("./ch4-desert.js"), import("../daily/romance.js")]);
    await desert.loadDesertDialogues(); // 告白を待たれているか（romanceRouteOpen）は、告白の台本を読み込んだ後に分かる
  } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  if (!state.flags[DUNES_AGAIN.flag]) {
    owner.flags[NOOR_PROMISE_FLAG] = noorConfessionWaiting(owner) && romance.romanceRouteOpen(DESERT_GUIDE);
    let done = false;
    try { done = await read(DUNES_AGAIN.scene, "bg_dubai_cafe_salim_day", owner); } finally { delete owner.flags[NOOR_PROMISE_FLAG]; }
    if (!done) return unused;
    state.flags[DUNES_AGAIN.flag] = true;
    save();
  }
  return desert.performDesertSpot(spot, { day: state.day, showHud, naru: false, scene: chapterFiveNoorScene });
}

/**
 * カフェ・オアシス（第5章・締めくくりを迎えるまで。2026-11-07 オーナー決定）。一台の代金・1日1回・段階の会話・♥3の問い・♥5の締めくくり・
 * 好感度（第5章の通いの値）は第4章と同じ（ch4-desert.js の performDesertSpot）。第4章の宿や大会の前を前提にする書き出しだけ第5章の場面に替える。
 * 第4章で通っていた人の、第5章で最初の来店は再会の場面だけを今日の来店にする（雑談と同じ一台・好感度。段階の会話は次の来店から）。
 */
async function visitNoorCafe(spot, owner) {
  let desert;
  try { desert = await import("./ch4-desert.js"); await desert.loadDesertDialogues(); } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  if (!owner.flags[DUNES_AGAIN.flag] && desertProgress(owner).talks > 0) {
    if (DESERT_CAFE_PRICE > spendableMoney(owner)) { toast(`お金が足りない（${DESERT_CAFE_PRICE.toLocaleString("ja-JP")}円）`); return unused; }
    if (!await read(NOOR_CAFE_AGAIN, "bg_dubai_cafe_salim_day", owner) || !completeDesertReunion(owner, owner.day)) return unused;
    addMoney(-DESERT_CAFE_PRICE);
    gainAffinity(DESERT_GUIDE, visitAffinity("talk"));
    owner.flags[DUNES_AGAIN.flag] = true;
    save();
    return { used: true, exerted: false };
  }
  const result = await desert.performDesertSpot(spot, { day: state.day, showHud, naru: false, scene: chapterFiveNoorScene });
  // 第5章で出会いを読み終えたら、砂丘の前の再会（久しぶり）は読まない
  if (state === owner && desertProgress(owner).talks > 0 && !owner.flags[DUNES_AGAIN.flag]) { owner.flags[DUNES_AGAIN.flag] = true; save(); }
  return result;
}

/** 夜: ドバイにいれば屋敷の客間で寝る（帰らない）。 */
export async function dubaiNight() {
  await showBg(RESIDENCE_BG, "night");
  return true;
}
export const dubaiWakeBackground = () => RESIDENCE_BG;
