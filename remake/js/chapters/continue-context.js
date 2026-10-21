// CONTINUEへ渡す読取専用の敗北情報。採点・乱数・セーブには触れない。
const PARTS = ["holes", "heat", "shisha", "care1", "care2"];
const OPENING = {
  burnt: ["……熱が入りすぎたな", "次は『下げ吸い』で逃がすぞ"],
  cold: ["……冷え切っちまったか", "次は冷える前に、炭を替えよう"],
  leaf: ["……香りが抜けちまったな", "次は吸う前に、葉の残りを見ろ"],
  rank: ["……届かなかったか", "なら、次は一つだけ変えてみよう"],
};
const ADVICE = {
  holes: "次は、目印に合わせて穴を開けよう",
  heat: "次は、炭の芯が光る瞬間を見ろ",
  shisha: "次は、配合と提供時の温度を見よう",
  care1: "次は、一度目の交換数を見直すぞ",
  care2: "次は、二度目まで葉を残そう",
};

export function continueContext(context, { reason = "rank", rank = null } = {}) {
  const input = context && typeof context === "object" ? context : {};
  const rawReason = input.reason ?? reason;
  const knownReason = Object.hasOwn(OPENING, rawReason);
  const actualRank = input.rank ?? rank;
  const safeRank = knownReason && rawReason === "rank" && Number.isSafeInteger(actualRank)
    && actualRank > 0 && [...`……${actualRank}位か。悔しいな`].length <= 22 ? actualRank : null;
  const completed = Array.isArray(input.completedParts) ? input.completedParts : [];
  const parts = Object.fromEntries(PARTS.filter(key => completed.includes(key)
    && Number.isFinite(input.parts?.[key])).map(key => [key, input.parts[key]]));
  return Object.freeze({
    reason: knownReason ? rawReason : "rank", rank: safeRank,
    // 未知reasonでは工程から敗因を推測しない。
    parts: Object.freeze(knownReason ? parts : {}),
    completedParts: Object.freeze(knownReason ? Object.keys(parts) : []),
  });
}

export function continueOpening(context) {
  const [fallback, advice] = OPENING[context.reason];
  const weakest = context.completedParts.reduce((best, key) =>
    best == null || context.parts[key] < context.parts[best] ? key : best, null);
  return [
    context.rank == null ? fallback : `……${context.rank}位か。悔しいな`,
    context.reason === "rank" && weakest ? ADVICE[weakest] : advice,
  ].map((text, index) => ({ at: index * 1.8, face: "serious", text }));
}
