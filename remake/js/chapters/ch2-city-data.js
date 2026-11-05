// 本編の初日と独立試遊が使う同じ街・同じ台本。セーブ操作を含めない。
import { DB } from "../core/data.js";
// 台本の読み込みは core/chapter-data.js（#2035）。この章の読み込みでも使う。
import { readDialogues } from "../core/chapter-data.js";
export { readDialogues };
import { CH2_NIGHTS, AGEHA_VISITS, AGEHA_BADDAY, STRAWBERRY_TRIAL_IDS } from "./ch2-story-data.js";
import { CH2_VISIT_STORIES } from "../core/affinity-stages.js";

export const MAP = {
  day: "../assets/backgrounds/bg_widehanga_map_day.webp",
  night: "../assets/backgrounds/bg_widehanga_map_night.webp",
};
export const STATION = "../assets/backgrounds/bg_widehanga_station_day.webp";
export const STOPS = [
  { id: "ageha", name: "MELTY PUFF", x: 81, y: 46 },
  { id: "kumicho", name: "神崎煙草店", x: 63, y: 65 },
  { id: "rei", name: "零-ZERO-", x: 42, y: 78 },
  { id: "c_station", name: "県大会ホール", x: 85, y: 30 },
];
// 神崎（kumicho）は採用済みの内装 bg_ch2_kumicho_entry.webp を使う。#962 で街の店舗画像
// bg_yuzugaya_kumicho.webp（LFS）へ一時的に差し替わり、採用内装が出ないうえ、LFS未取得の配信では
// ポインタのまま「室内を読み込めませんでした」になっていた（#1081 A02 / #1044 A04）。
export const ROOMS = Object.fromEntries(["ageha", "kumicho", "rei"].map((id) => [id, `../assets/backgrounds/bg_ch2_${id}_entry.webp`]));
const PURIKURA_IDS = ["remake_ch2_ryuji_melty_greeting", "remake_ch2_purikura_ryuji", "remake_ch2_ageha_purikura", ...["invite", "solo", "pair", "guest"].map(id => `remake_ch2_purikura_${id}`)];
const DISCOVERY_IDS = ["remake_ch2_rei_trpg", "remake_ch2_ageha_aquarium", "remake_ch2_kumicho_sento"];
export const CH2_HOME_IDS = Object.freeze(["cafe_ch2_commute", "cafe_ch2_taste", "kannon_ch2_wish", "choizap_ch2_numbers", "cs_ch2_haze",
  "ch2_kuyuri_taste", "ch2_kuyuri_strawberry",
  // tonariの大会準備で一台作る場面（ch2-craft-prep.js の CH2_CRAFT_PREP_IDS と同じ。読み込みを軽くするため名前を並べる）
  "ch2_prep_basics_intro", "ch2_prep_basics_end", "ch2_prep_basics_failed",
  "ch2_prep_midcheck_intro", "ch2_prep_midcheck_good", "ch2_prep_midcheck_rough", "ch2_prep_midcheck_failed", "ch2_prep_rehearsal_intro",
  ...["great", "good", "rough", "burnt", "drill"].map(result => `ch2_prep_rehearsal_${result}`)]);
const OUTING_IDS = ["aquarium", "sento", "chain"].flatMap(id => ["look", "visit", "repeat"].map(suffix => `remake_ch2_${id}_${suffix}`));
const CITY_IDS = ["arrival", ...STOPS.map((stop) => stop.id), ...Object.keys(ROOMS).flatMap((id) => [`${id}_inside`, `${id}_farewell`]), "return"].map((id) => `ch2_city_${id}`);

export async function loadCityDialogues() {
  const dialogues = await readDialogues("ch2_city", CITY_IDS);
  Object.assign(DB.dialogues, dialogues);
}

export async function loadChapterTwoDialogues() {
  // 両方が検証できるまで公開しない。第1章の起動では追加通信を行わない。
  const data = await Promise.all([
    readDialogues("ch2_city", CITY_IDS),
    readDialogues("remake_ch2", ["remake_ch2_departure", "remake_ch2_day1_night"]),
    readDialogues("ch2_deliveries", ["remake_ch2_delivery_offer", ...PURIKURA_IDS, ...DISCOVERY_IDS, ...OUTING_IDS, ...["ageha", "kumicho", "rei"].map(id => `remake_ch2_delivery_${id}`)]),
  ]);
  for (const dialogues of data) Object.assign(DB.dialogues, dialogues);
}

export async function loadPreparationDialogues() {
  const required = ["ageha", "kumicho", "rei"].flatMap(id => ["chat", "followup", "repeat"].map(suffix => `remake_ch2_${id}_${suffix}`));
  required.push(...["kumicho", "rei"].map(id => `remake_ch2_${id}_revisit`));
  // 神崎・レヰの通い訪問の小会話（#2027）
  required.push(...["kumicho", "rei"].flatMap(id => ["b", "c", "d"].map(suffix => `remake_ch2_${id}_repeat_${suffix}`)));
  // 好感度MAXの締めくくり（daily/bonds.js の BOND_FINALES・#2027）
  const files = { ch2_preparation: required, ch2_deliveries: [...PURIKURA_IDS, ...DISCOVERY_IDS, ...OUTING_IDS],
    ch2_kumicho: ["ch2_kumicho_bond_finale"], ch2_rei: ["ch2_rei_bond_finale"] };
  for (const step of CH2_NIGHTS.flatMap(night => night.steps)) (files[step.file] ||= []).push(step.id);
  // 神崎・レヰの長い段階会話（味の学習を含む）も通常訪問列として公開する（#1648）。
  for (const entry of Object.values(CH2_VISIT_STORIES).flat()) if (entry.file) (files[entry.file] ||= []).push(entry.scene);
  // 店に通う回（#626）と♥3の質問（#1988）、♥5の締めくくり（#2023）、通い訪問の小会話 b〜d（VOL13）
  const agehaVisits = [...(AGEHA_VISITS || []), AGEHA_BADDAY?.id, "ch2_ageha_bond_question", "ch2_ageha_bond_finale",
    ...["b", "c", "d"].map(suffix => `remake_ch2_ageha_repeat_${suffix}`)].filter(Boolean);
  if (agehaVisits.length) (files.ch2_ageha_story ||= []).push(...agehaVisits);
  if (STRAWBERRY_TRIAL_IDS.length) (files.ch2_main ||= []).push(...STRAWBERRY_TRIAL_IDS); // まかないの苺の試作（#1650）
  // 地元の施設の第2章の寄り道（daily/spot-encounters.js）とりんの会話（daily/spots.js の CHAPTER_TALKS）（VOL13）
  files.ch2_home = [...CH2_HOME_IDS];
  // 全台本を検証してから、接続するIDだけ公開。旧導入・大会結果は日常へ混ぜない。
  const groups = await Promise.all(Object.entries(files).map(async ([file, ids]) => {
    const dialogues = await readDialogues(file, ids);
    if (file === "ch2_preparation") {
      for (const id of ids.filter(id => /_(followup|revisit)$/.test(id))) {
        if (!dialogues[id].lines.every(line => line && !line.type && typeof line.text === "string"
          && line.text.length > 0 && typeof line.speaker === "string" && typeof line.face === "string")) {
          throw new Error(`${file}: 続編・再訪台本の形式を確認してください ${id}`);
        }
      }
    }
    return Object.fromEntries(ids.map(id => [id, dialogues[id]]));
  }));
  Object.assign(DB.dialogues, ...groups);
}
