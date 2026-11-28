// 持ち点のうち1票は比較票。本命以外の3台を、審査員と回で順に重点試喫する。
// 通常の2番手と僅差なら、その回に注目した台にも票を入れる。
export const COMPARISON_MARGIN = 12;

export function tournamentBallot(contestants, judgeIndex, round, scoreOf, tie, comparisonBallot) {
  const sorted = [...contestants].sort((a, b) => scoreOf(b) - scoreOf(a) || tie(a, b));
  const [first, second] = sorted;
  if (!comparisonBallot) return [first, second];
  const others = contestants.filter(id => id !== first);
  const focus = others[(round + judgeIndex) % others.length];
  if (scoreOf(focus) + COMPARISON_MARGIN >= scoreOf(second)) {
    return [first, focus];
  }
  return [first, second];
}
