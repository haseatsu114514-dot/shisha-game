// 第2・3章の順位集計。投票・quality・保存状態は呼び出し元が持つ。
// 総票 → quality → ID の順で順位を決め、入力の配列・票は変更しない。
export function tournamentStandings(p, contestants, judges) {
  const points = Object.fromEntries(contestants.map(id => [id,
    judges.reduce((sum, judge) => sum + (p.votes[judge]?.[id] || 0), 0)]));
  return [...contestants].sort((a, b) => points[b] - points[a]
    || (p.quality?.[b] || 0) - (p.quality?.[a] || 0) || a.localeCompare(b))
    .map((id, index) => ({ id, rank: index + 1, points: points[id] }));
}
