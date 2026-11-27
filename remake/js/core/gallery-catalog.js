import { PHOTO_KEEPSAKES, purikuraId } from "./gallery-progress.js";
import { ALL_MINTO_CHEKIS } from "./minto-cheki-data.js";
import { PURIKURA_PHOTOS, PURIKURA_CHAR } from "./purikura-data.js";

export const GALLERY_TABS = [
  ["all", "すべて"], ["still", "スチル"], ["cheki", "チェキ"],
  ["purikura", "プリクラ"], ["comic", "漫画"],
];
export const CHAR_LABELS = {
  minto: "みんと", ageha: "あげは", tsumugi: "つむぎ", naru: "なる",
  rio: "凛想", mashiro: "ましろ", other: "その他",
};
const cgChars = Object.fromEntries(Object.entries({
  ageha: ["cg_ageha_first_purikura", "cg_ch2_ageha_purikura_strip", "cg_ageha_confession", "cg_ch2_ageha_lesson", "cg_ch2_ageha_white_bear"],
  minto: ["cg_ch1_minto_casual_reveal", "cg_minto_casual", "cg_minto_cheki", "cg_minto_confession", "cg_minto_first_cheki", ...ALL_MINTO_CHEKIS.map(c => c.cg)],
  tsumugi: ["cg_ch1_tsumugi_heart_art", "cg_tsumugi_confession", "cg_tsumugi_smoke_color", "cg_ch5_tsumugi_serves_hajime"],
  naru: ["cg_naru_after_hours", "cg_naru_last_chance", "cg_naru_next_entry", "cg_ch2_naru_score_sheet"],
  rio: ["cg_rio_confession"],
  mashiro: ["cg_ch3_childhood_offered_hand", "cg_saku_mashiro_childhood", "cg_mashiro_double_apple", "cg_mashiro_confession", "cg_ch3_mashiro_no_craft_day", "cg_ch3_half_cake"],
}).flatMap(([char, ids]) => ids.map(id => [id, char])).concat(
  // MELTY PUFF のプリクラ（PFC18）。札のある人だけ。神崎・ひより・ひとりは「その他」
  PURIKURA_PHOTOS.filter(p => PURIKURA_CHAR[p.with]).map(p => [p.cg, PURIKURA_CHAR[p.with]])));
const charTag = char => Object.hasOwn(CHAR_LABELS, char) ? char : "other";
// IDに cheki を含むが通常のスチルとして扱うもの（オーナー指示 2026-11-18: cg_minto_cheki はツーショット写真でありチェキではない）。
const cgKindOverrides = { cg_minto_cheki: "still" };
// IDに章がないCGは、実際の表示先の台本で章を確認できたものだけ記載する。
const cgChapters = {
  cg_ageha_first_purikura: 2, cg_ryuji_purikura: 2,
  cg_saku_mashiro_childhood: 3, cg_mashiro_double_apple: 3,
  cg_minto_casual: 1, cg_minto_cheki: 1, cg_minto_first_cheki: 1,
  // PEPPERMINTのチェキ（頼むチェキ・2ショットの回・こっそりの一枚）は第1章から撮れる（daily/minto-cheki.js・daily/spots.js）
  ...Object.fromEntries(ALL_MINTO_CHEKIS.map(c => [c.cg, 1])),
  // MELTY PUFF のプリクラは第2章から撮れる（chapters/ch2-purikura.js）
  ...Object.fromEntries(PURIKURA_PHOTOS.map(p => [p.cg, 2])),
  cg_naru_after_hours: 2, cg_naru_last_chance: 3, cg_naru_next_entry: 3,
  cg_oneesan_first_smoke: 1, cg_tsumugi_smoke_color: 1,
};
export function galleryHint(entry) {
  if (entry.requiredChapter) return `第${entry.requiredChapter}章クリアで解放`;
  const chapter = entry.chapter ? `第${entry.chapter}章` : "";
  const char = entry.char && entry.char !== "other" ? CHAR_LABELS[entry.char] || "" : "";
  return [chapter, char].filter(Boolean).join("・");
}

/** 撮影ごとに増えるプリクラ記録は収集率に含めない。 */
export function galleryStats(entries) {
  const counter = () => ({ total: 0, unlocked: 0, rate: 0 });
  const stats = {
    ...counter(),
    byKind: Object.fromEntries(GALLERY_TABS.slice(1).map(([kind]) => [kind, counter()])),
    byChar: Object.fromEntries(Object.keys(CHAR_LABELS).map(char => [char, counter()])),
  };
  for (const entry of entries) {
    if (Object.hasOwn(entry, "photo")) continue;
    for (const group of [stats, stats.byKind[entry.kind], stats.byChar[charTag(entry.char)]]) {
      group.total++;
      if (entry.unlocked) group.unlocked++;
    }
  }
  for (const group of [stats, ...Object.values(stats.byKind), ...Object.values(stats.byChar)]) {
    group.rate = group.total ? Math.floor(group.unlocked / group.total * 100) : 0;
  }
  return stats;
}
const labels = {
  cg_ch5_party_toast: "世界一の乾杯",
  cg_ch5_tsumugi_serves_hajime: "最初は、ゆっくりどうぞ",
  cg_ch5_adam_two_bowls: "どの顔だった",
  cg_ch5_regular_hose_lap: "今日は時間、あるから",
  cg_ch5_cocreation_notes: "数字の隣に味の言葉",
  cg_ch5_sumi_pulls_chair: "おかえりの椅子",
  cg_ch4_festa_welcome: "FESTAの椅子と水",
  cg_ch4_traveler_tongs: "返したトング",
  cg_ch4_sheikh_reveal: "四つ目の台",
  cg_ch4_young_sumi_water: "十五年前の一杯の水",
  cg_ch4_noor_pencil_x: "消さなかった×",
  cg_ch4_creek_dhow: "クリークの荷積み",
  cg_ch3_liars_night: "嘘つきたちの夜",
  cg_ch3_national_ask_customer: "炭より先に、客の返事",
  cg_ch3_half_cake: "半分ずつのケーキ",
  cg_ch3_mukai_latte_cat: "そっぽを向く泡の猫",
  cg_ch2_kanzaki_id_check: "神崎煙草店の年齢確認",
  cg_ch2_naru_score_sheet: "光る採点表",
  cg_ch2_rest_notebook: "ノートを閉じた日",
  cg_ch2_rei_earphone: "片耳ぶんの一曲",
  cg_ch2_ageha_white_bear: "白いクマと閉店後",
  cg_ch2_sofa_wet_cloth: "焦げ跡と濡れ布",
  cg_ch2_ageha_lesson: "あげはの吸い方講座",
  cg_ch3_mashiro_no_craft_day: "作らないと決めた昼",
  cg_ch4_traveler_chair: "日陰の椅子",
  cg_ch5_doctor_yunomi: "湯のみを包む博士",
  cg_naru_after_hours: "なる・旅先のやり直し",
  cg_naru_last_chance: "なる・勝って帰る日",
  cg_naru_next_entry: "なる・もう一つの予選",
  cg_minto_first_cheki: "みんとの初来店チェキ", cg_minto_cheki: "みんととのツーショット",
  cg_ageha_first_purikura: "あげはとの初プリ", cg_ryuji_purikura: "神崎との職人プリ",
  cg_ch2_ageha_purikura_strip: "あげはと半分このプリクラ",
  ...Object.fromEntries(ALL_MINTO_CHEKIS.map(c => [c.cg, c.secret ? `ないしょのチェキ・${c.label}` : c.twoShot ? `2ショットチェキ・${c.label}` : `みんとのチェキ・${c.label}`])),
  ...Object.fromEntries(PURIKURA_PHOTOS.map(p => [p.cg, p.label])),
};
const localAsset = (path, extensions) => typeof path === "string"
  && /^(?:img|\.\.\/assets)\/[a-zA-Z0-9_./-]+$/.test(path)
  && !path.split("/").slice(path.startsWith("../") ? 1 : 0).includes("..")
  && extensions.test(path);

/** manifestの正式CGと、明示的に採用された追加コンテンツだけを一覧へ出す。 */
export function galleryEntries(manifest, catalog, progress, seen) {
  const got = new Set(seen);
  progress.keepsakes.forEach(id => got.add(PHOTO_KEEPSAKES[id]));
  // 撮った写真の絵（PFC18）は、その絵の一覧の項目で解放する
  progress.purikura.forEach(p => { if (p.cg) got.add(p.cg); });
  const entries = [...new Set((manifest.cgs || []).map(file => file.replace(/\.png$/, "")))]
    // 制作途中の下描き（#1076 DAY3 で見せる素材）は収集スチルではないので一覧に出さない。
    .filter(id => !/^cg_ch2_ageha_purikura_strip_(?:soft|gal)$/.test(id) && id !== "cg_ch1_tsumugi_sketch_wip").sort().map((id, i) => ({
    id, cg: id, char: cgChars[id] || "other",
    ...(id.match(/cg_ch([1-5])_/) ? { chapter: Number(id.match(/cg_ch([1-5])_/)[1]) }
      : Object.hasOwn(cgChapters, id) ? { chapter: cgChapters[id] } : {}),
    kind: cgKindOverrides[id] || (id.includes("cheki") ? "cheki" : id.includes("purikura") ? "purikura" : "still"),
    title: labels[id] || "物語のスチル " + (i + 1), unlocked: got.has(id),
  }));
  // 絵のある撮影は、上の絵の項目に出す（同じ写真を立ち絵の写真として重ねない）。絵の無い撮影・旧セーブだけ撮影ごとに出す
  const pictured = new Set(entries.map(e => e.id));
  progress.purikura.filter(p => !(p.cg && pictured.has(p.cg))).forEach(p => entries.push({
    id: purikuraId(p), kind: "purikura", photo: p, unlocked: true,
    title: "第" + p.chapter + "章・DAY" + (p.chapterDay ?? p.day) + (p.slot === 0 ? " 昼" : " 夜") + "のプリクラ",
  }));
  const used = new Set(entries.map(e => e.id));
  for (const item of Array.isArray(catalog?.items) ? catalog.items : []) {
    if (!item || item.approved !== true || item.kind !== "comic"
      || typeof item.id !== "string" || !/^[a-z][a-z0-9_-]*$/.test(item.id) || used.has(item.id)
      || typeof item.title !== "string" || !item.title.trim()
      || !Number.isInteger(item.requiredChapter) || item.requiredChapter < 1 || item.requiredChapter > 5
      || !Array.isArray(item.pages) || !item.pages.length
      || !item.pages.every(p => localAsset(p, /\.(?:png|webp|jpe?g)$/i))) continue;
    used.add(item.id);
    entries.push({ ...item, char: charTag(item.char), unlocked: progress.clearedChapters.includes(item.requiredChapter) });
  }
  return entries;
}
