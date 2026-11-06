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
// 第4章で遊んだ人だけ、ラクダレース場と「ヌールと砂丘へ」にも行ける（chapterFiveDubaiLeisureSpots。出会い・誘いは第4章だけ）。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast, layers } from "../core/ui.js";
import { showHud } from "../daily/hud.js";
import { CAMEL_DAILY_SPOT_ID, CAMEL_SCENES, CH4_CAMEL_SCENE_FILES, camelDailySpot, camelSceneBg } from "./ch4-camel-progress.js";
import { DESERT_SPOT_IDS, desertRevisitSpots } from "./ch4-desert-progress.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity, visitAffinity } from "../core/stats.js";
import { dubaiTripStatus, receiveDubaiLetter, useDubaiTicket, recordDubaiReturn, DUBAI_LETTER_AGAIN, DUBAI_LETTER_DAYS } from "./ch5-travel.js";
import { openShop } from "../daily/shop.js";
import { reflectAt } from "../daily/reflection.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "../daily/spot-hours.js";
import { consultLessons } from "../core/growth.js";

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
    preview: "bg_dubai_souq_day", stamina: -10, stat: "insight", talks: ["ch5_dubai_souq", "ch5_dubai_souq_b"],
    desc: "スパイスの匂いが立つ市場を歩く。" }),
  spot({ id: "ch5_dubai_alley", label: "路地裏のカフェ", area: "路地の奥", x: 30, y: 78, theme: "store", glyph: "茶",
    preview: "bg_dubai_alley_cafe_night", cost: 3000, stamina: -10, stat: "technique", talks: ["ch5_dubai_alley", "ch5_dubai_alley_b"],
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

// ---- 第4章で遊んだ人だけの行き先（ラクダレース場・ヌールと砂丘へ） ------------------------------
// 地図の id・位置・アイコン・押せない理由・記録・報酬は第4章と同じ（ch4-camel-progress.js・ch4-desert-progress.js）。
// 第4章で一度でも走った／砂丘へ出かけた人だけ出す（出会い・誘い・初回の場面は大会の頃の話なので、第5章では始めない）。
// 第5章で最初に行った日だけ、再会の場面を読む（新着の印も、その一度だけ出す）。
const CAMEL_AGAIN = Object.freeze({ scene: "ch5_dubai_camel_again", flag: "_ch5_dubai_camel_again" });
const DUNES_AGAIN = Object.freeze({ scene: "ch5_dubai_dunes_again", flag: "_ch5_dubai_dunes_again" });
const reunionOf = entry => entry.id === CAMEL_DAILY_SPOT_ID ? CAMEL_AGAIN : DUNES_AGAIN;

/** 今のドバイの地図に足す行き先（ラクダレース場・ヌールと砂丘へ）。第4章で遊んでいなければ空。 */
export function chapterFiveDubaiLeisureSpots(value = state) {
  if (value?.chapter !== 5 || !inDubai(value)) return [];
  return [camelDailySpot(value, { region: DUBAI, kind: "ch5_dubai", stamina: 0 }), ...desertRevisitSpots(value, value.day)]
    .filter(Boolean)
    .map(entry => entry.unavailable || value.flags?.[reunionOf(entry).flag] ? entry : Object.freeze({ ...entry, hasNew: () => true }));
}
/** 地図で選んだ行き先を、今行ける時だけ返す（行けない行き先は処理しない）。 */
export const chapterFiveDubaiLeisureById = id => chapterFiveDubaiLeisureSpots().find(entry => entry.id === id && !entry.unavailable) || null;

const SCENES = DUBAI_SPOTS.flatMap(entry => entry.talks || [])
  .concat(["ch5_dubai_letter", ...DUBAI_LETTER_AGAIN, "ch5_dubai_go", "ch5_dubai_back", "ch5_dubai_arrival", "ch5_dubai_guest_rest",
    CAMEL_AGAIN.scene, DUNES_AGAIN.scene]);
const CH4_SCENES = ["ch4_creek_walk_day", "ch4_creek_walk_night"];

let loading = null;
async function loadDubaiScenes() {
  if ([...SCENES, ...CH4_SCENES].every(id => DB.dialogues[id]?.lines?.length)) return;
  loading ||= Promise.all([readDialogues("ch5_dubai", SCENES), readDialogues("ch4_dubai_daily", CH4_SCENES)])
    .then(([dubai, ch4]) => { Object.assign(DB.dialogues, dubai, ch4); })
    .catch(error => { loading = null; throw error; });
  await loading;
}

const showBg = (ref, tod) => { const { url, tint } = sceneBg(ref, tod); return setBg(url, { instant: true, tint }); };

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
    const scene = state.slot >= 1 ? "ch4_creek_walk_night" : "ch4_creek_walk_day";
    if (!await read(scene, "bg_dubai_street_night", owner)) return unused;
    addStamina(spot.stamina);
    return { used: true, exerted: false };
  }
  if (!spot.talks) return null;
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

async function goToDubai(owner) {
  const status = dubaiTripStatus(state);
  if (!status.ok) {
    toast(`シェイクの次の手紙は、まだ届いていない（あと${status.daysLeft}日）`);
    return unused;
  }
  // 手紙が届いていれば先に読む（読むだけでは行動を使わない）。同封の往復の切符が手に入る。
  if (status.letter) {
    if (!await read(status.letter, "bg_home", owner)) return unused;
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
 * ラクダレース場（第4章で一度でも走った人だけ）。練習レースの流れ・記録・報酬は第4章と同じ（ch4-camel-race.js。報酬は初めての完走だけ）。
 * 第5章で最初に来た日は、レース前の会話（ch4_camel_replay）を再会の場面に替える。昼の枠は ch4-camel-race.js が完走の時だけ
 * 記録と一緒に進めて保存するので、日常ループには slotsUsed: 0 を返す（二重に進めない。第4章と同じ）。体力・お金は使わない。
 */
async function visitCamelTrack(owner) {
  let race;
  try { [race] = await Promise.all([import("./ch4-camel-race.js"), loadCamelScenes()]); } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  const result = await keepDailyHud(() => race.visitCamelRace({
    read: id => readCamelScene(id, owner),
    isCurrent: () => state === owner,
    beforeRace: () => showHud(false),
  }));
  return result.used && state === owner ? { used: true, exerted: false, slotsUsed: 0 } : unused;
}

async function readCamelScene(id, owner) {
  const reunion = id === CAMEL_SCENES.replay && !state.flags[CAMEL_AGAIN.flag];
  if (!await read(reunion ? CAMEL_AGAIN.scene : id, camelSceneBg(id), owner)) return false;
  if (reunion) { state.flags[CAMEL_AGAIN.flag] = true; save(); }
  return true;
}

/**
 * ヌールと砂丘へ（第4章で一度でも出かけた人だけ）。外出・ツアー代・1日1回・記録・報酬は第4章と同じ（ch4-desert.js の performDesertSpot）。
 * 第5章で最初の日は、カフェ・サーリムの表のデスクで再会の場面を読んでから出かける。なるは地元にいるので砂丘に来ない（naru: false）。
 * day は通算の日（ch4-desert-progress.js の desertRevisitSpots）。
 */
async function visitDunes(spot, owner) {
  if (!state.flags[DUNES_AGAIN.flag]) {
    if (!await read(DUNES_AGAIN.scene, "bg_dubai_inn_day", owner)) return unused;
    state.flags[DUNES_AGAIN.flag] = true;
    save();
  }
  let desert;
  try { desert = await import("./ch4-desert.js"); } catch {
    toast(LOAD_FAILED);
    return unused;
  }
  if (state !== owner) return unused;
  return desert.performDesertSpot(spot, { day: state.day, showHud, naru: false });
}

/** 夜: ドバイにいれば屋敷の客間で寝る（帰らない）。 */
export async function dubaiNight() {
  await showBg(RESIDENCE_BG, "night");
  return true;
}
export const dubaiWakeBackground = () => RESIDENCE_BG;
