import { PHOTO_KEEPSAKES, purikuraId } from "./gallery-progress.js";

export const GALLERY_TABS = [
  ["all", "すべて"], ["still", "スチル"], ["cheki", "チェキ"],
  ["purikura", "プリクラ"], ["comic", "漫画"], ["movie", "ムービー"],
];
export const CHAR_LABELS = {
  minto: "みんと", ageha: "あげは", tsumugi: "つむぎ", naru: "なる",
  rin: "りん", mashiro: "ましろ", other: "その他",
};
const cgChars = Object.fromEntries(Object.entries({
  ageha: ["cg_ageha_first_purikura", "cg_ch2_ageha_purikura_strip", "cg_ageha_confession"],
  minto: ["cg_ch1_minto_casual_reveal", "cg_minto_casual", "cg_minto_cheki", "cg_minto_confession", "cg_minto_first_cheki"],
  tsumugi: ["cg_ch1_tsumugi_heart_art", "cg_tsumugi_confession", "cg_tsumugi_smoke_color"],
  naru: ["cg_naru_after_hours", "cg_naru_last_chance", "cg_naru_next_entry"],
  rin: ["cg_rin_confession"],
  mashiro: ["cg_ch3_childhood_offered_hand", "cg_kuze_mashiro_childhood", "cg_mashiro_double_apple", "cg_mashiro_confession"],
}).flatMap(([char, ids]) => ids.map(id => [id, char])));
const charTag = char => Object.hasOwn(CHAR_LABELS, char) ? char : "other";
// IDに章がないCGは、実際の表示先の台本で章を確認できたものだけ記載する。
const cgChapters = {
  cg_ageha_first_purikura: 2, cg_ryuji_purikura: 2,
  cg_kuze_mashiro_childhood: 3, cg_mashiro_double_apple: 3,
  cg_minto_casual: 1, cg_minto_cheki: 1, cg_minto_first_cheki: 1,
  cg_naru_after_hours: 2, cg_naru_last_chance: 3, cg_naru_next_entry: 3,
  cg_oneesan_first_smoke: 1, cg_tsumugi_smoke_color: 1,
};
export function galleryHint(entry) {
  if (entry.requiredChapter) return `第${entry.requiredChapter}章クリアで解放`;
  const chapter = entry.chapter ? `第${entry.chapter}章` : "";
  const char = entry.char && entry.char !== "other" ? CHAR_LABELS[entry.char] || "" : "";
  return [chapter, char].filter(Boolean).join("・");
}

/** 撮影ごとに増えるプリクラ記録は収集率に含めず、件数だけを返す。 */
export function galleryStats(entries) {
  const counter = () => ({ total: 0, unlocked: 0, rate: 0 });
  const stats = {
    ...counter(),
    byKind: Object.fromEntries(GALLERY_TABS.slice(1).map(([kind]) => [kind, counter()])),
    byChar: Object.fromEntries(Object.keys(CHAR_LABELS).map(char => [char, counter()])),
    purikuraPhotos: 0,
  };
  for (const entry of entries) {
    if (Object.hasOwn(entry, "photo")) { stats.purikuraPhotos++; continue; }
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
  cg_naru_after_hours: "なる・旅先のやり直し",
  cg_naru_last_chance: "なる・勝って帰る日",
  cg_naru_next_entry: "なる・もう一つの予選",
  cg_minto_first_cheki: "みんとの初来店チェキ", cg_minto_cheki: "みんととのチェキ",
  cg_ageha_first_purikura: "あげはとの初プリ", cg_ryuji_purikura: "神崎との職人プリ",
  cg_ch2_ageha_purikura_strip: "あげはと半分このプリクラ",
};
const localAsset = (path, extensions) => typeof path === "string"
  && /^(?:img|movies|\.\.\/assets)\/[a-zA-Z0-9_./-]+$/.test(path)
  && !path.split("/").slice(path.startsWith("../") ? 1 : 0).includes("..")
  && extensions.test(path);

/** manifestの正式CGと、明示的に採用された追加コンテンツだけを一覧へ出す。 */
export function galleryEntries(manifest, catalog, progress, seen) {
  const got = new Set(seen);
  progress.keepsakes.forEach(id => got.add(PHOTO_KEEPSAKES[id]));
  const entries = [...new Set((manifest.cgs || []).map(file => file.replace(/\.png$/, "")))]
    // 制作途中の下描き（#1076 DAY3 で見せる素材）は収集スチルではないので一覧に出さない。
    .filter(id => !/^cg_ch2_ageha_purikura_strip_(?:soft|gal)$/.test(id) && id !== "cg_ch1_tsumugi_sketch_wip").sort().map((id, i) => ({
    id, cg: id, char: cgChars[id] || "other",
    ...(id.match(/cg_ch([1-5])_/) ? { chapter: Number(id.match(/cg_ch([1-5])_/)[1]) }
      : Object.hasOwn(cgChapters, id) ? { chapter: cgChapters[id] } : {}),
    kind: id.includes("cheki") ? "cheki" : id.includes("purikura") ? "purikura" : "still",
    title: labels[id] || "物語のスチル " + (i + 1), unlocked: got.has(id),
  }));
  progress.purikura.forEach(p => entries.push({
    id: purikuraId(p), kind: "purikura", photo: p, unlocked: true,
    title: "第" + p.chapter + "章・DAY" + (p.chapterDay ?? p.day) + (p.slot === 0 ? " 昼" : " 夜") + "のプリクラ",
  }));
  const used = new Set(entries.map(e => e.id));
  for (const item of Array.isArray(catalog?.items) ? catalog.items : []) {
    if (!item || item.approved !== true || !["comic", "movie"].includes(item.kind)
      || typeof item.id !== "string" || !/^[a-z][a-z0-9_-]*$/.test(item.id) || used.has(item.id)
      || typeof item.title !== "string" || !item.title.trim()
      || !Number.isInteger(item.requiredChapter) || item.requiredChapter < 1 || item.requiredChapter > 5) continue;
    if (item.kind === "comic" && (!Array.isArray(item.pages) || !item.pages.length
      || !item.pages.every(p => localAsset(p, /\.(?:png|webp|jpe?g)$/i)))) continue;
    if (item.kind === "movie" && !localAsset(item.src, /\.(?:webm|mp4)$/i)) continue;
    used.add(item.id);
    entries.push({ ...item, char: charTag(item.char), unlocked: progress.clearedChapters.includes(item.requiredChapter) });
  }
  return entries;
}
