// 提供直後に、はじめが自分の一台を一口確かめる地の文を2行だけ組み立てる。
//   1行目＝選んだ葉の特徴（実配合）／2行目＝提供時の熱の状態（調整前の cs.pull.temp）。
// 既存データ（mix の実g・flavorFamilyGrams の同系統合算・共有の温度帯）だけを読む。
// 採点・票・在庫・熱管理には一切触れず、味や勝敗の品質を新しく決めない。
import { DB } from "../core/data.js";
import { temperatureBands, isIdealTemperature } from "./temperature-model.js";

// 散文に出す香りの名前。短縮名の先頭メーカー表記（AF/NS/ドバジ 等）は落として葉の名だけにする。
const MAKER_TOKENS = new Set(["AF", "NS", "ドバジ", "ナイトサイド", "アフサール"]);
function aromaName(id, flavorById = DB.flavorById) {
  const name = flavorById?.[id]?.short_name || flavorById?.[id]?.name || "選んだ葉";
  const sp = name.indexOf(" ");
  return sp > 0 && MAKER_TOKENS.has(name.slice(0, sp)) ? name.slice(sp + 1) : name;
}

// 実gから主役の香りを決める。銘柄違いの同系統（family）は合算し、代表はその中で一番多い葉。
function dominantAromas(cs, flavorById = DB.flavorById) {
  const entries = Object.entries(cs?.mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0);
  if (!entries.length) return null;
  const total = entries.reduce((sum, [, g]) => sum + g, 0);
  const groups = new Map();
  for (const [id, g] of entries) {
    const key = flavorById?.[id]?.family || id;
    const cur = groups.get(key) || { grams: 0, topId: id, topGrams: 0 };
    cur.grams += g;
    if (g > cur.topGrams) { cur.topGrams = g; cur.topId = id; }
    groups.set(key, cur);
  }
  return { total, groups: [...groups.values()].sort((a, b) => b.grams - a.grams) };
}

// 選んだ葉の特徴。少量を主役と言わず、判定できない配合は中立文へ。
export function servedTasteLine(cs) {
  const dom = dominantAromas(cs);
  if (!dom) return "選んだ葉の香りを、一口ずつ確かめる。";
  const [main, second] = dom.groups;
  const mainName = aromaName(main.topId);
  // 主役がはっきり立つ一台（単葉、または主役が7割以上）。
  if (!second || main.grams / dom.total >= 0.7) return `${mainName}の香りが、まっすぐ立つ。今日は、この香りで出す。`;
  return `${mainName}に、${aromaName(second.topId)}が重なる。さっき自分で選んだ香りだ。`;
}

// 提供時の状態。調整前の温度を共有の良好帯で見るだけ。終盤の温度で書き換えない。
export function servedStateLine(cs) {
  const temp = cs?.pull?.temp;
  if (!Number.isFinite(temp)) return "今の一口を覚えておく。ここから、同じ一台を整えていく。";
  const bands = temperatureBands(cs);
  if (isIdealTemperature(temp, bands)) return "熱は落ち着いている。もう一口、確かめたくなる。";
  if (temp > bands.ideal[1]) return "香りと一緒に、熱が前へ出る。次の調整で、落ち着かせたい。";
  return "香りはまだ遠い。次の調整で、もう少し立たせたい。";
}

// 固定だった「華やかさはない。個性も薄い」の代わりに差し込む地の文2行。
export function servedEvaluationLines(cs) {
  return [servedTasteLine(cs), servedStateLine(cs)].map(text => ({ speaker: "", face: "", text }));
}
