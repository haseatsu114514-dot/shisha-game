// 第4章ドバイのカフェで一台頼んで吸う（2026-11-02 オーナー「カフェで吸えたりとかにしよう」「一台注文して味わう」）。
// 中心地のカフェと路地裏のカフェは、来店のたびに現地のメニューから一台を選んで味わう（再生は ch4-dubai-daily.js）。
// ここは DOM を持たない判定と記録だけ。台詞は data/dialogue/ch4_dubai_daily.json の ch4_dubai_taste_*（初めての一台は
// metadata の flavor_lesson で熟練度が少し伸びる。二度目からは短い *_again）。代金は来店の値段（中心地 3,500円・路地裏 2,000円）に入っている。

/** 頼んだ回数（メニューごと）。周回では持ち越さない（core/carry.js の progression）。 */
export const CAFE_ORDERS_FLAG = "_ch4_cafe_orders";

/** 現地のメニュー。並びは選択肢の順（先頭が定番）。両方のカフェで同じ。 */
export const CAFE_MENU = Object.freeze([
  { id: "double_apple", label: "ダブルアップル" },
  { id: "grape_mint", label: "グレープミント" },
  { id: "lemon_mint", label: "レモンミント" },
  { id: "mint", label: "ミント" },
].map(item => Object.freeze(item)));
export const OMAKASE = "omakase";

/** 一台を頼むカフェ（行き先の place）。 */
export const CAFE_PLACES = Object.freeze(["center_cafe", "alley_cafe"]);

// 来店の場面との並び。吸っている間・吸い終えた後の会話（文化の話・閉店前の茶）は、注文と味わいの後に読む。
export const TALKS_AFTER_ORDER = Object.freeze([
  "ch4_cafe_culture_hose", "ch4_cafe_culture_coffee", "ch4_alley_culture_clay", "ch4_alley_culture_majlis", "ch4_alley_talk_c",
]);
// 場面の中で一台を吸う（作る）ので、注文を重ねない（旅装の男との約束・あの男の葉を一口もらう回）。
export const SMOKED_IN_SCENE = Object.freeze(["ch4_stranger_second", "ch4_alley_cafe_quiet"]);

// おまかせで頼んだ時に、味わいの前に置く一行（店ごと）。
export const OMAKASE_LINE = Object.freeze({
  center_cafe: "おまかせで頼むと、店員は少しこちらの顔を見てから、奥へ下がった。",
  alley_cafe: "おまかせで頼むと、店員は棚の缶をいくつか見比べてから、一つを下ろした。",
});

export const tasteSceneId = (id, again = false) => `ch4_dubai_taste_${id}${again ? "_again" : ""}`;
/** 味わいの台詞（ch4_dubai_daily.json）。読み込みの一覧に使う。 */
export const CAFE_TASTE_IDS = Object.freeze(CAFE_MENU.flatMap(item => [tasteSceneId(item.id), tasteSceneId(item.id, true)]));

export function cafeOrders(value) {
  const record = value?.flags?.[CAFE_ORDERS_FLAG];
  return record && typeof record === "object" && !Array.isArray(record) ? record : {};
}

const known = id => CAFE_MENU.some(item => item.id === id);

/** 今の一台の味わいの場面。初めての一台は本編、二度目からは短い方。 */
export function tasteScene(value, id) {
  if (!known(id)) return null;
  return tasteSceneId(id, (Number(cafeOrders(value)[id]) || 0) > 0);
}

/** おまかせ: まだ頼んでいない一台を先に（メニュー順）。全部頼んだ後は日付で回す。保存は変えない。 */
export function omakaseChoice(value) {
  const orders = cafeOrders(value);
  const fresh = CAFE_MENU.find(item => !(Number(orders[item.id]) > 0));
  if (fresh) return fresh.id;
  const day = Number.isInteger(value?.day) ? value.day : 0;
  return CAFE_MENU[((day % CAFE_MENU.length) + CAFE_MENU.length) % CAFE_MENU.length].id;
}

/** 選んだ値（メニューの id か "omakase"）を、実際の一台の id にする。 */
export const resolveCafeOrder = (value, pick) => pick === OMAKASE ? omakaseChoice(value) : known(pick) ? pick : null;

/** 味わいを読み終えた時だけ呼ぶ。回数を一つ増やす。 */
export function recordCafeOrder(value, id) {
  if (!known(id) || !value?.flags) return false;
  const orders = cafeOrders(value);
  value.flags[CAFE_ORDERS_FLAG] = { ...orders, [id]: (Number(orders[id]) || 0) + 1 };
  return true;
}
