import { CITY_BACKGROUNDS, CH2_CITY_NAME } from "../core/city-locations.js";
import { knowsTrpgBar } from "../core/trpg-discovery.js";

// 出会っただけでは解放しない。紹介会話を最後まで読んだ場所だけを地図へ出す。
export const CITY_OUTINGS = [
  { id: "trpg_bar", label: "ボドゲカフェ", kind: "trpg", introducedBy: "rei", flag: "_rei_trpg_introduced",
    previewUrl: CITY_BACKGROUNDS.trpg, introduction: "remake_ch2_rei_trpg", x: 48, y: 25, glyph: "卓",
    dayOneDesc: "零が教えてくれた、夜はTRPGバーになる店。昼は店長に遊び方を聞ける。" },
  { id: "ch2_aquarium", label: "都市型水族館", kind: "outing", introducedBy: "ageha", flag: "_ageha_aquarium_introduced",
    previewUrl: CITY_BACKGROUNDS.aquarium, introduction: "remake_ch2_ageha_aquarium", look: "remake_ch2_aquarium_look", first: "remake_ch2_aquarium_visit", repeat: ["remake_ch2_aquarium_repeat", "remake_ch2_aquarium_repeat_b", "remake_ch2_aquarium_repeat_c"], x: 28, y: 47, glyph: "魚", cost: 1800, stamina: 0,
    dayOneDesc: "あげはが教えてくれた、駅前のビルにある水族館。今日は入口を確かめよう。",
    desc: "ビルの中の水族館。青い水槽で気分転換。" },
  { id: "ch2_sento", label: "銭湯・サウナ", kind: "outing", introducedBy: "kumicho", flag: "_kumicho_sento_introduced",
    previewUrl: CITY_BACKGROUNDS.sento, introduction: "remake_ch2_kumicho_sento", look: "remake_ch2_sento_look", first: "remake_ch2_sento_visit", repeat: ["remake_ch2_sento_repeat", "remake_ch2_sento_repeat_b", "remake_ch2_sento_repeat_c"], x: 19, y: 71, glyph: "湯", cost: 800, stamina: 25,
    dayOneDesc: "神崎が通う刺青OKの銭湯。サウナとシングルの水風呂が名物。今日は入口を確かめよう。",
    desc: "刺青OKの銭湯。熱波と水風呂が名物。" },
];
export const CITY_SHOP = { id: "ch2_shop", kind: "shop", label: `Dr.fookah ${CH2_CITY_NAME}店`, name: `Dr.fookah ${CH2_CITY_NAME}店`, region: "widehanga", area: "駅前のシーシャ用品店", x: 61, y: 38,
  previewUrl: CITY_BACKGROUNDS.shop, theme: "shop", glyph: "卸", desc: "隣町の支店。県大会向けの仕入れに。", shop: true };

export const CITY_CHAIN = { id: "ch2_c_station", label: "C.STATION", name: `C.STATION ${CH2_CITY_NAME}店`, kind: "outing", region: "widehanga", area: "大手チェーンの支店", theme: "stadium", glyph: "C", x: 46, y: 54,
  previewUrl: CITY_BACKGROUNDS.c_station, look: "remake_ch2_chain_look", first: "remake_ch2_chain_visit", repeat: ["remake_ch2_chain_repeat", "remake_ch2_chain_repeat_b", "remake_ch2_chain_repeat_c"], cost: 2500, stamina: -16, stat: "insight",
  dayOneDesc: "地元でも見た大手シーシャチェーンの支店。県大会ホールと同じビルだが、客席は別のフロアにある。",
  desc: "同じチェーンの柚ヶ谷店。接客を見る。" };

// 再訪は場所ごとの小さな変化を順に読む（#1653 ⑥）。能力値は足さず、会話だけを変える。
// 回数は施設ごとのフラグ `_ch2_outing_visits_<id>` に数える。旧セーブ（訪問済みフラグだけ）は1回目の再訪から始める。
export function outingDialogue(outing, flags = {}) {
  if (!flags[`_ch2_visited_${outing.id}`]) return outing.first;
  const pool = [].concat(outing.repeat);
  const visits = Math.max(1, Number(flags[`_ch2_outing_visits_${outing.id}`]) || 1);
  return pool[(visits - 1) % pool.length];
}

export function recordOutingVisit(flags, outing) {
  const before = Number(flags[`_ch2_outing_visits_${outing.id}`]) || (flags[`_ch2_visited_${outing.id}`] ? 1 : 0);
  flags[`_ch2_outing_visits_${outing.id}`] = before + 1;
  flags[`_ch2_visited_${outing.id}`] = true;
}

export function introduceCitySpot(value, character) {
  const spot = CITY_OUTINGS.find(item => item.introducedBy === character);
  if (!spot || value.chapter !== 2 || value.flags[spot.flag]) return false;
  value.flags[spot.flag] = true;
  return true;
}

export function knownCityOutings(value) {
  if (value?.chapter !== 2) return [];
  return [CITY_CHAIN, ...CITY_OUTINGS.filter(spot => value.flags?.[spot.flag] || spot.id === "trpg_bar" && knowsTrpgBar(value))
    ].map(spot => ({ ...spot, region: "widehanga", area: "隣町の遊び場", theme: "cafe" }));
}
