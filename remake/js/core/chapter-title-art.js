// 採用済みの静止画。第3章はオーナー指定で保留し、従来の文字表示を維持する。
const art = file => new URL(`../../img/ui/chapters/${file}.webp`, import.meta.url).href;
export const CHAPTER_TITLE_ART = Object.freeze([
  { chapter: 1, no: "第一章", name: "煙がつなぐ街", read: "スモーク・アンド・タイズ ── Smoke & Ties", sub: "SMOKE CROWN CUP 編", url: art("ch1-title") },
  { chapter: 2, no: "第二章", name: "才能の壁", read: "ジェラシー・ヘイズ ── Jealousy Haze", sub: "HAZE: OPEN CLOUD 編", url: art("ch2-title") },
  { chapter: 4, no: "第四章", name: "継承の煙", read: "レガシー・スモーク ── Legacy Smoke", url: art("ch4-title") },
  { chapter: 5, no: "第五章", name: "機械仕掛けの神", read: "デウス・エクス・マキナ ── Deus Ex Machina", url: art("ch5-title") },
].map(entry => Object.freeze(entry)));

export const chapterTitleArt = no => CHAPTER_TITLE_ART.find(entry => entry.no === no)?.url || null;
