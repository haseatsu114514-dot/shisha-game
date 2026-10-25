import { PHOTO_KEEPSAKES, purikuraId } from "./gallery-progress.js";

export const GALLERY_TABS = [
  ["all", "すべて"], ["still", "スチル"], ["cheki", "チェキ"],
  ["purikura", "プリクラ"], ["comic", "漫画"], ["movie", "ムービー"],
];
const labels = {
  cg_minto_first_cheki: "みんとの初来店チェキ", cg_minto_cheki: "みんととのチェキ",
  cg_ageha_first_purikura: "あげはとの初プリ", cg_ryuji_purikura: "神崎との職人プリ",
};
const localAsset = (path, extensions) => typeof path === "string"
  && /^(?:img|movies|\.\.\/assets)\/[a-zA-Z0-9_./-]+$/.test(path)
  && !path.split("/").slice(path.startsWith("../") ? 1 : 0).includes("..")
  && extensions.test(path);

/** manifestの正式CGと、明示的に採用された追加コンテンツだけを一覧へ出す。 */
export function galleryEntries(manifest, catalog, progress, seen) {
  const got = new Set(seen);
  progress.keepsakes.forEach(id => got.add(PHOTO_KEEPSAKES[id]));
  const entries = [...new Set((manifest.cgs || []).map(file => file.replace(/\.png$/, "")))].sort().map((id, i) => ({
    id, cg: id, kind: id.includes("cheki") ? "cheki" : id.includes("purikura") ? "purikura" : "still",
    title: labels[id] || "物語のスチル " + (i + 1), unlocked: got.has(id),
  }));
  progress.purikura.forEach(p => entries.push({
    id: purikuraId(p), kind: "purikura", photo: p, unlocked: true,
    title: "第" + p.chapter + "章・DAY" + p.day + (p.slot === 0 ? " 昼" : " 夜") + "のプリクラ",
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
    entries.push({ ...item, unlocked: progress.clearedChapters.includes(item.requiredChapter) });
  }
  return entries;
}
