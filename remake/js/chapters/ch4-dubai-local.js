// 第4章ドバイの街の手触り（2026-11-02 オーナー「2以外は採用」。渡し舟の案だけ不採用）。
// ここは DOM を持たない判定・記録と文言だけ。再生・代金・体力は ch4-dubai-daily.js、台詞は data/dialogue/ch4_dubai_daily.json。
//   1. 暑さと夜の街: 昼の屋外（スーク・クリーク沿い）は暑さで体力を多めに使い（クリーク沿いは夜ほど休まらない）、
//      カフェ・専門店（中心地のカフェ・路地裏のカフェ・FESTA・龍龍水煙所）は夜がにぎわう。夜に行くと店の夜の一行を読み、
//      その店で初めての夜だけは短い場面になる（スポットの場面の経験値 X5s が一度付く。docs/stat-design/SPEC.md）。
//      砂丘とラクダレースは昼だけの遊びで、体力を使わない作りのまま（暑さは足さない）。
//   2. 屋台: スークの後に屋台で軽く買える（カラクチャイ・シャワルマ・ルカイマット）。時間は使わず、体力が少し戻る。
//   3. ディルハム: ドバイの値段に、約何ディルハムかを添える（1ディルハム≒43.5円。DBS02 で調べた相場と同じ）。
// 季節は正本に無いので書かない（日付・気温は出さず、「昼の暑さ」「夜の川風」までにする）。

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
export const STALL_SCENE_IDS = Object.freeze(STALL_MENU.map(item => stallSceneId(item.id)));

/** 屋台の選択肢の文字（「シャワルマ 500円（約10ディルハム）」）。 */
export const stallLabel = item => `${item.label} ${priceText(item.price)}`;
/** 今の手持ちで買えるものだけ（並びはメニュー順）。 */
export const stallChoices = money => STALL_MENU.filter(item => item.price <= (Number(money) || 0));
export const stallItem = id => STALL_MENU.find(item => item.id === id) || null;
