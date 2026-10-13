// 味の予告は選んだ葉の実gから読む。温度・相性・採点には加算しない。
import { DB } from "../core/data.js";

export function mixTaste(mix, catalog = DB.flavorById) {
  const entries = Object.entries(mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, g]) => sum + g, 0);
  if (!total) return { headline: "どんな一服にしよう", detail: "主役の葉を足して、香りを組み立てよう。", tags: [] };
  const main = entries[0][0], name = catalog[main]?.short_name || catalog[main]?.name || "選んだ葉";
  const profile = {};
  for (const [id, g] of entries) for (const [key, value] of Object.entries(catalog[id]?.stats || {})) {
    if (Number.isFinite(value)) profile[key] = (profile[key] || 0) + value * g / total;
  }
  const sweet = Math.max(profile.sweet_natural || 0, profile.sweet_confection || 0);
  const cooling = profile.cooling || 0, refreshing = profile.refreshing || 0, body = profile.smoke_body || 0;
  const tags = [sweet >= 4 ? "甘さしっかり" : "甘さ控えめ",
    cooling >= 2 || refreshing >= 5 ? "後味すっきり" : body >= 6 ? "余韻どっしり" : "軽い余韻"];
  if (cooling >= 5) tags.push("清涼感強め");
  let detail = `${name}の香りが中心。${tags.join("、")}の一服になりそう。`;
  const mint = (mix?.mint || 0) / total;
  if (main === "double_apple" && mint > 0 && mint <= .35) detail = "アニスの甘く濃い香りに、ミントの涼しい後味。";
  else if (mint > .45 && entries.length > 1) detail = "ミントの清涼感が前に出て、他の葉の香りは控えめ。";
  return { headline: `${name}が主役`, detail, tags };
}
