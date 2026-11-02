// 第5章のドバイ（#2033 E）。勝負の日を決める前の自由行動で、飛行機でドバイへ行ける。
// オーナー指定（2026-11-02）: シェイクがはじめを気に入り「また遊びに来い」と言ってくれて、宿（屋敷の客間）は
// 用意してくれる（無料）。飛行機は1回目はシェイクが往復の切符をくれる。2回目からは往復 DUBAI_ROUND_TRIP_FARE
// （出発の時に払う。帰りは払わない）。移動は1行動。
// 招待は手紙で届く（シェイクはLIMEの相手ではない）。最初に「ドバイへ」を選んだ時に読む。
// 行き先: シェイクの屋敷（話す）・中庭の太陽・客間（休む）・スーク・路地裏のカフェ・クリーク沿い・Dr.fookah ドバイ店・空港（帰る）。
// 地図と座標は第4章の日常ループ（ch4-dubai-daily.js）と同じ。FESTAは大会の出張ブースだったので出さず、太陽は休暇で
// シェイクの屋敷に遊びに来ている（2026-11-02 オーナー「任せる」）。心得の盤の授業（シェイク・太陽）は、ここで会った時に相談する（SBD52）。
// 台詞は data/dialogue/ch5_dubai.json（クリーク沿いは第4章の場面を使う）。現在地は flags._ch2_region = "dubai"。
import { state, save, timeOfDay, markMet } from "../core/state.js";
import { DB, sceneBg } from "../core/data.js";
import { modal, setBg, toast } from "../core/ui.js";
import { play } from "../vn/engine.js";
import { readDialogues } from "../core/chapter-data.js";
import { addMoney, addStamina, earnStat, gainAffinity, visitAffinity } from "../core/stats.js";
import { DUBAI_ROUND_TRIP_FARE } from "../core/travel-budget.js";
import { openShop } from "../daily/shop.js";
import { reflectAt } from "../daily/reflection.js";
import { openingStatus, MOSQUE_VISITING_HOURS } from "../daily/spot-hours.js";
import { consultLessons } from "../core/growth.js";

export const DUBAI = "dubai";
const LETTER_FLAG = "_ch5_dubai_letter"; // シェイクの招待の手紙を読んだ
const GUEST_FLAG = "_ch5_dubai_guest"; // 最初の到着（屋敷の客間を用意してもらった）を読んだ
const TALKS_FLAG = "_ch5_dubai_talks"; // 小会話の巡回の回数（行き先ごと）
const FLIGHTS_FLAG = "_ch5_dubai_flights"; // ドバイへ飛んだ回数（0回なら、シェイクがくれた切符で無料）
const RESIDENCE_BG = "bg_dubai_sheikh_residence";
const yen = n => n.toLocaleString("ja-JP");

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

/** 地元の地図に出す「ドバイへ（飛行機）」。往復の運賃は出発の時に払う。 */
export const TO_DUBAI_SPOT = Object.freeze({
  id: "ch5_to_dubai", kind: "ch5_dubai", label: "ドバイへ（飛行機）", area: "空港行きのバス", x: 56, y: 86, theme: "stadium", glyph: "空",
  face: "sheikh", preview: "bg_dubai_airport_day",
  desc: `1回目はシェイクがくれた往復の切符。2回目からは往復${yen(DUBAI_ROUND_TRIP_FARE)}円・1行動。屋敷の客間に泊まれて、好きな時に帰れる。`,
});

export const inDubai = (value = state) => value?.flags?._ch2_region === DUBAI;
const SCENES = DUBAI_SPOTS.flatMap(entry => entry.talks || [])
  .concat(["ch5_dubai_letter", "ch5_dubai_go", "ch5_dubai_back", "ch5_dubai_arrival", "ch5_dubai_guest_rest"]);
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

/** ドバイの行き先と「ドバイへ」の処理。対象外の行き先は null（日常ループの通常の処理へ）。 */
export async function performDubaiSpot(spot, { staminaGuard } = {}) {
  if (spot.id !== TO_DUBAI_SPOT.id && spot.region !== DUBAI) return null;
  const owner = state;
  try { await loadDubaiScenes(); } catch {
    toast("会話を読み込めませんでした。代金と行動は使っていません。地図からもう一度選べます");
    return unused;
  }
  if (state !== owner) return unused;
  if (spot.id === TO_DUBAI_SPOT.id) return goToDubai(owner);
  if (spot.id === "ch5_dubai_home") return goHome(owner);
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
  // 最初に選んだ時は、シェイクの招待の手紙を読む（読むだけでは行動を使わない）。
  if (!state.flags[LETTER_FLAG]) {
    if (!await read("ch5_dubai_letter", "bg_home", owner)) return unused;
    state.flags[LETTER_FLAG] = true;
    save();
  }
  // 1回目はシェイクが手紙に同封した往復の切符。2回目からは自分で往復の運賃を払う。
  const fare = (state.flags[FLIGHTS_FLAG] || 0) > 0 ? DUBAI_ROUND_TRIP_FARE : 0;
  if (state.money < fare) {
    toast(`往復の運賃（${yen(fare)}円）が足りない`);
    return unused;
  }
  const go = await modal({
    title: "ドバイへ行く",
    body: `${fare ? `往復${yen(fare)}円（帰りの便も入っている）` : "シェイクがくれた往復の切符で行く"}・1行動。<br>宿はシェイクの屋敷の客間。好きな時に帰れる。`,
    options: [
      { label: fare ? `行く（${yen(fare)}円）` : "行く（シェイクの切符）", value: "go", test: "ch5-dubai-go", primary: true },
      { label: "やめておく", value: null, test: "ch5-dubai-cancel" },
    ],
  });
  if (go !== "go" || state !== owner) return unused;
  if (!await read("ch5_dubai_go", "bg_dubai_airport_day", owner)) return unused;
  if (fare) addMoney(-fare);
  state.flags[FLIGHTS_FLAG] = (state.flags[FLIGHTS_FLAG] || 0) + 1;
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
  // 帰りの便は往復の切符に入っている（ここでは払わない）。
  state.flags._ch2_region = "home";
  save();
  return { used: true, exerted: false };
}

/** 夜: ドバイにいれば屋敷の客間で寝る（帰らない）。 */
export async function dubaiNight() {
  await showBg(RESIDENCE_BG, "night");
  return true;
}
export const dubaiWakeBackground = () => RESIDENCE_BG;
