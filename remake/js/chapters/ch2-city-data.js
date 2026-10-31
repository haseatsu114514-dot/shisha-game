// 本編の初日と独立試遊が使う同じ街・同じ台本。セーブ操作を含めない。
import { DB } from "../core/data.js";
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
const OUTING_IDS = ["aquarium", "sento", "chain"].flatMap(id => ["look", "visit", "repeat"].map(suffix => `remake_ch2_${id}_${suffix}`));
const CITY_IDS = ["arrival", ...STOPS.map((stop) => stop.id), ...Object.keys(ROOMS).flatMap((id) => [`${id}_inside`, `${id}_farewell`]), "return"].map((id) => `ch2_city_${id}`);

export async function readDialogues(name, required) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`../data/dialogue/${name}.json`, { cache: "no-cache", signal: controller.signal });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data.dialogues)) throw new Error(`${name}: 台本の形式を確認してください`);
    const dialogues = Object.fromEntries(data.dialogues.map((dialogue) => [dialogue.dialogue_id, dialogue]));
    for (const id of required) {
      if (!dialogues[id]?.lines?.length) throw new Error(`${name}: 台本が不足しています ${id}`);
    }
    return dialogues;
  } finally { clearTimeout(timer); }
}

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
  const files = { ch2_preparation: required, ch2_deliveries: [...PURIKURA_IDS, ...DISCOVERY_IDS, ...OUTING_IDS] };
  for (const step of CH2_NIGHTS.flatMap(night => night.steps)) (files[step.file] ||= []).push(step.id);
  // 神崎・REIの長い段階会話（味の学習を含む）も通常訪問列として公開する（#1648）。
  for (const entry of Object.values(CH2_VISIT_STORIES).flat()) if (entry.file) (files[entry.file] ||= []).push(entry.scene);
  const agehaVisits = [...(AGEHA_VISITS || []), AGEHA_BADDAY?.id, "ch2_ageha_bond_question"].filter(Boolean); // 店に通う回（#626）と♥3の質問（#1988）
  if (agehaVisits.length) (files.ch2_ageha_story ||= []).push(...agehaVisits);
  if (STRAWBERRY_TRIAL_IDS.length) (files.ch2_main ||= []).push(...STRAWBERRY_TRIAL_IDS); // まかないの苺の試作（#1650）
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
