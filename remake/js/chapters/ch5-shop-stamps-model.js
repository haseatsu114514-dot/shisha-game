// 第5章の各地の店めぐり帳（MGR・2026-11-07 司令塔／ミューズの仮判断「J. 各地の店めぐり帳」。オーナーが後から変えられる）。
// 状態を読む・記録するだけの純粋な決まり（地図からの判子・LIMEの帳面・くじ券の受け渡しは chapters/ch5-shop-stamps.js）。
//
// 流れ: 第5章の自由行動の日（博士との勝負の日を決めるまで）に、地元・柚ヶ谷・東京・ドバイのシーシャ屋へ行き、来店を終えると
//   その店の判子が一つ押される（一店に一つ。二度目からは何も増えない）。第4章までの来店は数えない（第5章の帳面）。
//   来店の中身・代金・体力・好感度・能力は、それぞれの店のいつもの来店のまま（この仕組みは何も足さない・減らさない）。
//   代金を取らない物語の来店（EDENの「二つのダブルアップル」、東京の♥5の締めくくり）も、店で一台を吸うので判子を押す。
// 報酬: お金ではなく、限定台くじのくじ券（渡すのは ch5-shop-stamps.js）。地域の判子がそろうごとに REGION_TICKETS 枚、
//   全部そろうと、さらに COMPLETE_BONUS_TICKETS 枚。必須10店で5枚、任意の2店で各1枚（最大7枚）。
//   出張シーシャの依頼は1回の行動で最大2枚なので、それより少なめ。来店そのものの好感度・能力・経験値は別にもらえる）。
//   火種・心得の盤・大会・エンディング・進行の条件にはつながない（#2455）。周回では帳面を持ち越さない（core/carry.js）。
//
// 必須の店（SHOP_STAMP_REGIONS）: 第5章の地図に、運や好感度に関係なく必ず出る、一台を吸うシーシャ屋。
//   地元: KEMURIKUSA・EDEN・PEPPERMINT・C.STATION（なる・アダム・みんとには第1章の大会で必ず会う。C.STATION は第1章の初日に
//     スミさんに頼まれて KEMURIKUSA へ偵察に行くと地図に出る＝大会の参加登録の店）
//   柚ヶ谷: MELTY PUFF・神崎煙草店・零-ZERO-（あげは・神崎・クラウドには第2章の大会で必ず会う）
//   東京: Smoke & Glory・鉄の煙（スティーブ・ヴォルクには第3章の大会で必ず会う）
//   ドバイ: 路地裏のカフェ（いつでも行ける）
//   任意の店: SHISHARK はサメちゃんに会った保存だけ、カフェ・オアシスはヌールの締めくくりまで。
//   行けない保存でも必須10店の達成を妨げない。tonari・mukai は働く店なので載せない。
//
// 保存（flags._ch5_shop_stamps）:
//   shops   : 判子を押した店 { 店のID: 押した日（通算日） }
//   rewards : 受け取ったくじ券 { 地域のID または "all": 実際に増えた枚数 }（一度だけ渡すための記録）
//   opened  : LIMEの帳面を一度開いた（一覧の行の赤い丸を消す）
import { HOME_CITY_NAME, CH2_CITY_NAME } from "../core/city-locations.js";

export const SHOP_STAMPS_FLAG = "_ch5_shop_stamps";
/** 地域の判子がそろった時のくじ券の枚数。 */
export const REGION_TICKETS = 1;
/** 帳面が全部そろった時に、地域の分とは別にもらえるくじ券の枚数。 */
export const COMPLETE_BONUS_TICKETS = 1;
export const OPTIONAL_SHOP_TICKETS = 1;
/** 全部そろえた時の受け取りの記録の鍵（地域のIDと重ならない）。 */
export const COMPLETE_KEY = "all";

const shop = (id, label, optional = false) => Object.freeze({ id, label, optional });
const region = (id, label, shops) => Object.freeze({ id, label, shops: Object.freeze(shops) });

/**
 * 帳面に載せる店。id は第5章の地図の行き先のID（地図の地域の id と同じ並び）、label は地図の店名と同じ。
 * 必須店が地図に必ず出ることと、任意店が会っている保存で出ることは remake/test/ch5_shop_stamps.mjs で確かめる。
 */
export const SHOP_STAMP_REGIONS = Object.freeze([
  region("home", `地元・${HOME_CITY_NAME}`, [
    shop("naru", "KEMURIKUSA"), shop("adam", "EDEN"), shop("minto", "PEPPERMINT"), shop("c_station", "C.STATION"),
    shop("shishark", "SHISHARK", true),
  ]),
  region("widehanga", `隣町・${CH2_CITY_NAME}`, [
    shop("ch2_ageha", "MELTY PUFF"), shop("ch2_kumicho", "神崎煙草店"), shop("ch2_rei", "零-ZERO-"),
  ]),
  region("tokyo", "東京", [shop("ch5_tokyo_steve", "Smoke & Glory"), shop("ch5_tokyo_volk", "鉄の煙")]),
  region("dubai", "ドバイ", [shop("ch5_dubai_alley", "路地裏のカフェ"), shop("ch4_dubai_tour_desk", "カフェ・オアシス", true)]),
]);
export const SHOP_STAMP_TOTAL = SHOP_STAMP_REGIONS.reduce((n, entry) => n + entry.shops.filter(item => !item.optional).length, 0);
const REQUIRED_IDS = new Set(SHOP_STAMP_REGIONS.flatMap(entry => entry.shops.filter(item => !item.optional).map(item => item.id)));

/** 地図の行き先のIDから、帳面の店と地域を引く。載っていなければ null。 */
export function shopStampEntry(spotId) {
  for (const entry of SHOP_STAMP_REGIONS) {
    const found = entry.shops.find(item => item.id === spotId);
    if (found) return { region: entry, shop: found };
  }
  return null;
}

const isRecord = value => !!value && typeof value === "object" && !Array.isArray(value);
const SHOP_IDS = new Set(SHOP_STAMP_REGIONS.flatMap(entry => entry.shops.map(item => item.id)));
const REWARD_KEYS = new Set([...SHOP_STAMP_REGIONS.map(entry => entry.id), ...SHOP_STAMP_REGIONS.flatMap(entry => entry.shops.filter(item => item.optional).map(item => item.id)), COMPLETE_KEY]);

/** 保存の帳面を読む（無い・壊れた値は空として読む。知らない店・鍵は数えない）。 */
export function shopStampsState(value) {
  const raw = value?.flags?.[SHOP_STAMPS_FLAG];
  const record = isRecord(raw) ? raw : {};
  const shops = {}, rewards = {};
  if (isRecord(record.shops)) {
    for (const [id, day] of Object.entries(record.shops)) if (SHOP_IDS.has(id) && Number.isInteger(day)) shops[id] = day;
  }
  if (isRecord(record.rewards)) {
    for (const [key, n] of Object.entries(record.rewards)) if (REWARD_KEYS.has(key) && Number.isInteger(n) && n >= 0) rewards[key] = n;
  }
  return { shops, rewards, opened: record.opened === true };
}

/** 帳面の今の様子（LIMEの帳面・一覧の行が使う）。 */
export function shopStampsProgress(value) {
  const record = shopStampsState(value);
  const regions = SHOP_STAMP_REGIONS.map(entry => {
    const shops = entry.shops.map(item => ({ id: item.id, label: item.label, optional: item.optional, stamped: Object.hasOwn(record.shops, item.id) }));
    const required = shops.filter(item => !item.optional);
    const count = required.filter(item => item.stamped).length;
    return { id: entry.id, label: entry.label, shops, count, total: required.length, complete: count === required.length,
      rewarded: Object.hasOwn(record.rewards, entry.id) };
  });
  const count = regions.reduce((n, entry) => n + entry.count, 0);
  return { count, total: SHOP_STAMP_TOTAL, optionalCount: regions.flatMap(entry => entry.shops).filter(item => item.optional && item.stamped).length,
    complete: count === SHOP_STAMP_TOTAL, opened: record.opened, regions };
}

/**
 * 第5章で、帳面の店への来店を終えた時に判子を押す。grant(n) はくじ券を渡して実際に増えた枚数を返す（ch5-shop-stamps.js が渡す）。
 * 判子が増えなかった時（第5章でない・載っていない店・押したことのある店）は null で、何も変えない。
 * 戻り値: { shop, region, count, total, regionDone, complete, tickets }（tickets＝この判子で実際に増えたくじ券の枚数）。
 */
export function recordShopStamp(value, spotId, grant = () => 0) {
  if (value?.chapter !== 5 || !value.flags) return null;
  const found = shopStampEntry(spotId);
  if (!found) return null;
  const record = shopStampsState(value);
  if (Object.hasOwn(record.shops, spotId)) return null;
  record.shops[spotId] = Number.isInteger(value.day) ? value.day : 0;
  const firstStamp = Object.keys(record.shops).length === 1;
  const regionDone = !found.shop.optional && found.region.shops.filter(item => !item.optional).every(item => Object.hasOwn(record.shops, item.id));
  const count = Object.keys(record.shops).filter(id => REQUIRED_IDS.has(id)).length;
  const complete = count === SHOP_STAMP_TOTAL;
  let tickets = 0;
  const pay = (key, n) => {
    if (Object.hasOwn(record.rewards, key)) return;
    const got = Math.max(0, Number(grant(n)) || 0);
    record.rewards[key] = got;
    tickets += got;
  };
  if (found.shop.optional) pay(found.shop.id, OPTIONAL_SHOP_TICKETS);
  if (regionDone) pay(found.region.id, REGION_TICKETS);
  if (complete && !found.shop.optional) pay(COMPLETE_KEY, COMPLETE_BONUS_TICKETS);
  value.flags[SHOP_STAMPS_FLAG] = { shops: record.shops, rewards: record.rewards, opened: record.opened };
  return { shop: found.shop, region: found.region, count, total: SHOP_STAMP_TOTAL, firstStamp,
    regionDone, complete, tickets };
}

/** LIMEの帳面を開いた（一覧の行の赤い丸を消す）。変わったら true。 */
export function markShopStampsOpened(value) {
  if (!value?.flags) return false;
  const record = shopStampsState(value);
  if (record.opened) return false;
  value.flags[SHOP_STAMPS_FLAG] = { shops: record.shops, rewards: record.rewards, opened: true };
  return true;
}
