// 審査待ちのなるの一言を、実際の調整実績に合わせて選ぶ。
//   提供（cs.pull）と2回の調整（cs.careHistory）を共有の温度帯で見て、
//   安定／途中で乱れて立て直し／終盤も帯の外／記録不足の4通りに分ける。
// tournamentStoryDialogue(cs, "tasting") の care 判定（care_steady / care_recovered /
//   care_hot・care_cold / care_incomplete）と同じ土台を使うので、直前の試飲演出と食い違わない。
// 採点・票・在庫・勝敗には触れない。なるの言葉は感覚の感想だけで、技術のうんちくは足さない。
import { temperatureBands, isIdealTemperature } from "./temperature-model.js";

// 2回の調整を終えた実履歴から区分を返す。記録不足・旧セーブは品質を捏造せず "unknown"。
export function naruTastingCategory(cs, { careRounds = 2 } = {}) {
  const bands = temperatureBands(cs);
  const ideal = result => Number.isFinite(result?.temp) && isIdealTemperature(result.temp, bands);
  const cares = (cs?.careHistory || []).slice(0, careRounds);
  const last = cares.at(-1);
  if (cares.length !== careRounds || careRounds <= 0 || !Number.isFinite(last?.temp)) return "unknown";
  if (ideal(last)) return ideal(cs?.pull) && cares.every(ideal) ? "steady" : "recovered";
  return "offband";
}

// 区分ごとの、なるの短い感想（感覚の言葉のみ）。
const NARU_LINES = {
  steady: "最後まで熱を保ったな。見てて、ぶれなかったの分かったよ",
  recovered: "途中で熱が揺れたろ。そこから戻したの、見てたよ",
  offband: "香りは覚えてる。ただ、最後の熱は、まだ詰められるな",
  unknown: "お前の一台、ちゃんと見てたよ。結果が出たら、また話そうぜ",
};

export function naruTastingLine(cs, options) {
  return NARU_LINES[naruTastingCategory(cs, options)] || NARU_LINES.unknown;
}
