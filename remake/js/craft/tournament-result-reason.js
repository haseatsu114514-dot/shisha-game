const ROUNDS = ["準備の投票", "提供後の投票", "一度目の調整後の投票", "二度目の調整後の投票"];

/** 確定順位と、各回に実際に入った持ち点から結果の一言を組み立てる。 */
export function tournamentResultReason(rows, { rounds, quality, beforeLast } = {}) {
  const mine = rows.find(row => row.id === "hajime");
  const won = mine?.rank === 1;
  const rival = won ? rows[1] : rows[0];
  if (!mine || !rival || rival.id === mine.id) return null;
  const winner = won ? mine : rival;
  const other = won ? rival : mine;
  const margin = Math.abs(mine.points - rival.points);

  // 第1章の独立した1点だけを外した時、同点判定まで含めて首位が変わるか。
  const beforeWinner = beforeLast?.[0]?.id;
  if (beforeWinner && beforeWinner !== winner.id && (won || beforeWinner === mine.id)) {
    const place = won ? "はじめが首位に立った" : "首位を奪われた";
    return margin === 0 ? `千須の最後の1点で同点。判定で${place}。` : `千須の最後の1点で${place}。`;
  }
  if (margin === 0) {
    const result = won ? "首位に立った" : "首位に届かなかった";
    return quality?.[winner.id] > quality?.[other.id]
      ? `持ち点は同点。一台の出来栄えで${result}。`
      : `持ち点は同点。同点時の判定で${result}。`;
  }

  // 途中から記録を始めた旧セーブでは、全工程を比較できる時だけ決め手を挙げる。
  let swing = 0, decidingRound;
  if (ROUNDS.every((_, i) => rounds?.[i])) {
    for (const [i, label] of ROUNDS.entries()) {
      const diff = Object.values(rounds[i]).reduce((sum, { points }) =>
        sum + (points[winner.id] || 0) - (points[other.id] || 0), 0);
      if (diff > swing) { swing = diff; decidingRound = label; }
    }
  }
  if (decidingRound) {
    const gap = won ? `2位より${swing}点多く取った` : `首位に${swing}点及ばなかった`;
    return `${decidingRound}で、${gap}${margin !== swing ? `。最終${margin}点差` : ""}。`;
  }
  return won ? `持ち点で2位に${margin}点差をつけた。` : `首位に持ち点で${margin}点及ばなかった。`;
}

/** 第5章の挙手は二台分の合計。台ごとの票を読み、工程別の票は仮定しない。 */
export function exhibitionResultReason(tally) {
  const second = tally.second.hajime - tally.second.machine;
  const total = tally.total.hajime - tally.total.machine;
  if (total > 0) return `二台目の挙手で${second}票差をつけ、合計${total}票差で逆転した。`;
  if (total === 0) return `二台目で${second}票差を返し、合計で並んだ。`;
  return second < 0 ? `二台目で${-second}票差がつき、合計で${-total}票届かなかった。`
    : `二台目は同票。一台目の${-total}票差が残った。`;
}
