// 第4章ドバイの街の手触り（2026-11-02 オーナー「2以外は採用」。渡し舟の案だけ不採用）。
// ここは DOM を持たない判定・記録と文言だけ。再生・代金・体力は ch4-dubai-daily.js、台詞は data/dialogue/ch4_dubai_daily.json。
//   1. 暑さと夜の街: 昼の屋外（スーク・クリーク沿い）は暑さで体力を多めに使い（クリーク沿いは夜ほど休まらない）、
//      カフェ・専門店（中心地のカフェ・路地裏のカフェ・FESTA・龍龍水煙所）は夜がにぎわう。夜に行くと店の夜の一行を読み、
//      その店で初めての夜だけは短い場面になる（スポットの場面の経験値 X5s が一度付く。docs/stat-design/SPEC.md）。
//      砂丘とラクダレースは昼だけの遊びで、体力を使わない作りのまま（暑さは足さない）。
//   2. 屋台: スークの後に屋台で軽く買える（カラクチャイ・シャワルマ・ルカイマット）。時間は使わず、体力が少し戻る。
//   3. ディルハム: ドバイの値段に、約何ディルハムかを添える（1ディルハム≒43.5円。DBS02 で調べた相場と同じ）。
// 季節は正本に無いので書かない（日付・気温は出さず、「昼の暑さ」「夜の川風」までにする）。
import { tournamentFinished } from "../core/story-context.js";

// ---- ディルハム ---------------------------------------------------------------------------
export const YEN_PER_DIRHAM = 43.5;

/** 円を、見せるためのおおよそのディルハムにする（10未満は1刻み、100未満は5刻み、それ以上は10刻み）。 */
export function dirhamOf(yen) {
  const value = Number(yen) / YEN_PER_DIRHAM;
  if (!(value > 0)) return 0;
  const unit = value < 10 ? 1 : value < 100 ? 5 : 10;
  return Math.max(1, Math.round(value / unit) * unit);
}
export const dirhamText = yen => `約${dirhamOf(yen)}ディルハム`;
/** 「6,000円（約140ディルハム）」 */
export const priceText = yen => `${Number(yen).toLocaleString("ja-JP")}円（${dirhamText(yen)}）`;

// ---- 暑さ ---------------------------------------------------------------------------------
/** 昼か（slot 0）。ラクダレース・砂丘と同じ判定。 */
export const dubaiDaytime = slot => (slot ?? 0) === 0;

/**
 * クリーク沿いの場面（SPV03）。昼・夜それぞれを順番に読む（daily/spots.js の quietTurn。鍵は CREEK_TURN。第5章のドバイも同じ）。
 * 岸から眺める場面だけ。渡し舟に乗る `ch4_creek_abra` は、渡し舟で渡る案が不採用（DBS12）なのでつながない。
 * 歩く場面は ch4_dubai_daily.json、荷積みと釣りは ch4_spots.json（CREEK_SPOT_IDS）。
 */
export const CREEK_SCENES = Object.freeze({
  // #3097: 昼夜それぞれ2本→4本（カモメ・冷水の箱／食事船・家族との通話）
  day: Object.freeze(["ch4_creek_walk_day", "ch4_creek_dhow", "ch4_creek_gulls", "ch4_creek_water_box"]),
  night: Object.freeze(["ch4_creek_walk_night", "ch4_creek_fishing", "ch4_creek_dinner_boat", "ch4_creek_call_home"]),
});
export const CREEK_SPOT_IDS = Object.freeze(["ch4_creek_dhow", "ch4_creek_fishing", "ch4_creek_gulls", "ch4_creek_water_box", "ch4_creek_dinner_boat", "ch4_creek_call_home"]);
export const CREEK_TURN = "dubai_creek";
/** ch4_spots.json から、クリーク沿いの場面だけを取り出す（本筋のスーク・カフェの台本を上書きしない）。 */
export const creekSpotScenes = rows => Object.fromEntries(CREEK_SPOT_IDS.map(id => [id, rows[id]]));

/**
 * 昼の屋外の行き先（place）。extra は昼に足す体力（スーク -10→-15、クリーク沿い +20→+12）。
 * desc は地図の説明に足す一文、note は行った後に出す一言。
 */
export const DUBAI_HEAT = Object.freeze({
  souq: Object.freeze({ extra: -5, desc: "昼は暑く、いつもより体力を使う。", note: "昼の暑さで、いつもより体力を使った" }),
  creek: Object.freeze({ extra: -8, desc: "昼は日差しが強く、夜ほどは休まらない。", note: "昼の日差しで、夜ほどは休めなかった" }),
});

/**
 * 今の時間の行き先。昼の屋外は体力と説明を変えた写しを返す（heat に行った後の一言）。それ以外はそのまま返す。
 * 保存は変えない。
 */
export function dubaiSpotAt(entry, slot) {
  const heat = entry && dubaiDaytime(slot) ? DUBAI_HEAT[entry.place] : null;
  if (!heat) return entry;
  return Object.freeze({ ...entry, stamina: (entry.stamina || 0) + heat.extra, desc: `${entry.desc}${heat.desc}`, heat: heat.note });
}

// ---- 夜の店 -------------------------------------------------------------------------------
/** 夜がにぎわう店（行き先の place）。 */
export const DUBAI_NIGHT_PLACES = Object.freeze(["festa", "center_cafe", "alley_cafe", "longlong"]);
/** 店ごとの夜の場面（初めての夜は全部、二度目からは最初の一行だけ読む）。 */
export const nightSceneId = place => `ch4_dubai_night_${place}`;
export const NIGHT_SCENE_IDS = Object.freeze(DUBAI_NIGHT_PLACES.map(nightSceneId));
/** 夜に行った回数（店ごと）。周回では持ち越さない（core/carry.js の progression）。 */
export const NIGHT_FLAG = "_ch4_dubai_nights";

export function dubaiNights(value) {
  const record = value?.flags?.[NIGHT_FLAG];
  return record && typeof record === "object" && !Array.isArray(record) ? record : {};
}

/** 夜の来店なら { id, first }（first はその店で初めての夜）。昼・夜がにぎわう店でなければ null。保存は変えない。 */
export function nightVisit(value, place) {
  if (dubaiDaytime(value?.slot) || !DUBAI_NIGHT_PLACES.includes(place)) return null;
  return { id: nightSceneId(place), first: !(Number(dubaiNights(value)[place]) > 0) };
}

/** 夜の来店を読み終えた時だけ呼ぶ。回数を一つ増やす。 */
export function recordNightVisit(value, place) {
  if (!value?.flags || !DUBAI_NIGHT_PLACES.includes(place)) return false;
  const nights = dubaiNights(value);
  value.flags[NIGHT_FLAG] = { ...nights, [place]: (Number(nights[place]) || 0) + 1 };
  return true;
}

// ---- スークの屋台 ---------------------------------------------------------------------------
// 値段は現地の屋台の相場（カラクチャイ 1〜2ディルハム、シャワルマ・ルカイマット 10〜15ディルハム）をきりのよい円にした。
// stamina は買った時に戻る体力。時間は使わない（スークに行った行動の中で買う）。
export const STALL_MENU = Object.freeze([
  { id: "karak", label: "カラクチャイ", price: 100, stamina: 5 },
  { id: "shawarma", label: "シャワルマ", price: 500, stamina: 12 },
  { id: "luqaimat", label: "ルカイマット", price: 500, stamina: 8 },
].map(item => Object.freeze(item)));
export const STALL_NONE = "none";
export const STALL_PLACE = "souq";
export const stallSceneId = id => `ch4_souq_stall_${id}`;
// 同じ品を買うたびに読む場面は、品ごとに3本を巡回する（#3097・RLS03。daily/spots.js の quietTurn。鍵は STALL_TURN）
export const STALL_TALKS = Object.freeze(Object.fromEntries(STALL_MENU.map(item =>
  [item.id, Object.freeze(["", "_b", "_c"].map(suffix => `${stallSceneId(item.id)}${suffix}`))])));
export const STALL_TURN = id => `dubai_stall_${id}`;
export const STALL_SCENE_IDS = Object.freeze(STALL_MENU.flatMap(item => STALL_TALKS[item.id]));

/** 屋台の選択肢の文字（「シャワルマ 500円（約10ディルハム）」）。 */
export const stallLabel = item => `${item.label} ${priceText(item.price)}`;
/** 今の手持ちで買えるものだけ（並びはメニュー順）。 */
export const stallChoices = money => STALL_MENU.filter(item => item.price <= (Number(money) || 0));
export const stallItem = id => STALL_MENU.find(item => item.id === id) || null;

// ---- 地元からの昼の電話 ------------------------------------------------------------------------
// 宿で昼に休むと、日本（夜）の地元の人から電話が来る（#3097 第2弾・VOL20・2026-11-21 オーナー「交友を1章以降も厚く」）。
// 台本は data/dialogue/ch4_home_calls.json。休む場面の代わりに未読の一本を読む（一度きり。休む場面の巡回は進めない）。
// 夜はスミさんの電話（ch4-dubai-daily.js の SUMI_NIGHT_CALLS）が受け持つので、昼だけ（ドバイの昼＝日本の夜）。
// LIMEの連絡先にいて、今ドバイに来ていない人だけ（present は ch4-beach.js の chapterFourBeachCast）。
// 初回の休み（宿の部屋の場面）の後から。世界大会の前の暮らしの電話なので、大会の後は出さない（core/story-context.js）。
export const HOME_DAY_CALL_FLAG = "_ch4_home_calls";
// #3097 第3弾で、つむぎ・ましろ・綾取・スティーブの4本を間に足した（ドバイへ来る前の人から先に届くよう、地元の人と交互に並べる）。
export const HOME_DAY_CALLS = Object.freeze([
  { scene: "ch4_home_call_adam_apple", from: "adam" },
  { scene: "ch4_home_call_tsumugi_sky", from: "tsumugi" },
  { scene: "ch4_home_call_rio_scent", from: "rio" },
  { scene: "ch4_home_call_kumicho_coffee", from: "kumicho" },
  { scene: "ch4_home_call_mashiro_chai", from: "mashiro" },
  { scene: "ch4_home_call_samechan_shark", from: "samechan" },
  { scene: "ch4_home_call_minto_mint", from: "minto" },
  { scene: "ch4_home_call_saku_menu", from: "saku" },
  { scene: "ch4_home_call_volk_door", from: "volk" },
  { scene: "ch4_home_call_rei_sound", from: "rei" },
  { scene: "ch4_home_call_hiyori_train", from: "hiyori" },
  { scene: "ch4_home_call_steve_timer", from: "steve" },
  { scene: "ch4_home_call_ageha_gold", from: "ageha" },
  // #3097・VOL23: 二本目の電話は、まだ一度も話していない相手からの電話の後。
  { scene: "ch4_home_call_adam_bookmark", from: "adam" },
  { scene: "ch4_home_call_rio_delivery", from: "rio" },
  { scene: "ch4_home_call_minto_coaster", from: "minto" },
  { scene: "ch4_home_call_samechan_shade", from: "samechan" },
  { scene: "ch4_home_call_rei_sleeves", from: "rei" },
  { scene: "ch4_home_call_hiyori_announcement", from: "hiyori" },
  { scene: "ch4_home_call_ageha_clip", from: "ageha" },
].map(call => Object.freeze(call)));
// 電話の中で、かけてきた人のほかに話す人（mukai の開店前のムカイさん）
export const HOME_DAY_CALL_EXTRA_SPEAKERS = Object.freeze({ ch4_home_call_mashiro_chai: Object.freeze(["mukai_master"]) });
export const HOME_DAY_CALL_IDS = Object.freeze(HOME_DAY_CALLS.map(call => call.scene));
/**
 * 今、宿で休むと届く地元からの電話の台本ID（読むだけ）。無ければ null（いつもの休む場面を読む）。
 * @param options.daytime 昼の休みか
 * @param options.rested これまでに宿で休んだ回数（初回の休みは部屋の場面のまま）
 * @param options.present 今ドバイにいる人の id の一覧
 */
export function homeDayCallId(value, { daytime = false, rested = 0, present = [] } = {}) {
  if (!daytime || !(rested > 0) || value?.chapter !== 4 || tournamentFinished(value, 4)) return null;
  const read = value.flags?.[HOME_DAY_CALL_FLAG] || {};
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const here = new Set(Array.isArray(present) ? present : []);
  return HOME_DAY_CALLS.find(call => !read[call.scene] && contacts.includes(call.from) && !here.has(call.from))?.scene || null;
}
/** 電話を読んだ記録（読了後）。休む場面の巡回の回数は進めない。 */
export function recordHomeDayCall(value, scene) {
  if (!value?.flags || !HOME_DAY_CALL_IDS.includes(scene)) return false;
  value.flags[HOME_DAY_CALL_FLAG] = { ...(value.flags[HOME_DAY_CALL_FLAG] || {}), [scene]: true };
  return true;
}
