// ショップ専用の表示変換。商品データと内部makerは書き換えない。
export const shopText = (text) => String(text || "")
  .replace(/\bAF\b/g, "アルファヘブン").replace(/アルファーヘブン/g, "アルファヘブン");
export const shopProductName = (item) => shopText(item.short_name || item.name);

/** 絞込済みの品をメーカー初出順にまとめ、メーカー内の既存順を保つ。 */
export function groupShopFlavors(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.maker;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()].flat();
}
