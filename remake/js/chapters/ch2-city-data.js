// 本編の初日と独立試遊が使う同じ街・同じ台本。セーブ操作を含めない。
import { DB } from "../core/data.js";

export const MAP = {
  day: "../assets/backgrounds/bg_widehanga_map_day.webp",
  night: "../assets/backgrounds/bg_widehanga_map_night.webp",
};
export const STATION = "../assets/backgrounds/bg_widehanga_station_day.webp";
export const STOPS = [
  { id: "ageha", name: "MELTY PUFF", x: 81, y: 46 },
  { id: "kumicho", name: "神崎煙草店", x: 63, y: 65 },
  { id: "rei", name: "零-ZERO-", x: 42, y: 78 },
  { id: "volk", name: "鉄の煙", x: 18, y: 76, sceneLabel: "鉄の煙の技術展示" },
  { id: "c_station", name: "県大会ホール", x: 85, y: 30 },
];
export const ROOMS = Object.fromEntries(["ageha", "kumicho", "rei", "volk"].map((id) => [id, `../assets/backgrounds/bg_ch2_${id}_entry.webp`]));
const CITY_IDS = ["arrival", ...STOPS.map((stop) => stop.id), ...Object.keys(ROOMS).map((id) => `${id}_inside`), "return"].map((id) => `ch2_city_${id}`);

async function readDialogues(name, required) {
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
  ]);
  for (const dialogues of data) Object.assign(DB.dialogues, dialogues);
}

export async function loadPreparationDialogues() {
  const required = ["ageha", "kumicho", "rei", "volk"].flatMap(id => ["chat", "repeat"].map(suffix => `remake_ch2_${id}_${suffix}`));
  const [preparation, isolation] = await Promise.all([
    readDialogues("ch2_preparation", required),
    readDialogues("ch2_isolation", ["ch2_naru_warm"]),
  ]);
  // 後半の孤立場面を日常へ偶然流さず、DAY3の一場面だけを接続する。
  Object.assign(DB.dialogues, preparation, { ch2_naru_warm: isolation.ch2_naru_warm });
}
