// 持ち点のうち1票は比較票。本命以外の3台を、審査員と回で順に重点試喫する。
// 通常の2番手と僅差なら、その回に注目した台にも票を入れる。
export const COMPARISON_MARGIN = 12;

export function tournamentBallot(contestants, judgeIndex, round, scoreOf, tie, comparisonBallot, rivalForm) {
  const sorted = [...contestants].sort((a, b) => scoreOf(b) - scoreOf(a) || tie(a, b));
  const [first, second] = sorted;
  if (!comparisonBallot) return [first, second];
  const others = contestants.filter(id => id !== first);
  // その日のライバルの出来に合わせ、比較を始める卓順も挑戦ごとに変える。
  if (rivalForm) others.sort((a, b) => (rivalForm[b] ?? 0) - (rivalForm[a] ?? 0));
  const focus = others[(round + judgeIndex) % others.length];
  if (scoreOf(focus) + COMPARISON_MARGIN >= scoreOf(second)) {
    return [first, focus];
  }
  return [first, second];
}

// 3人のライバルに、普段どおりの1通りと好不調の担当が異なる6通り。
// セーブごとに開始位置と巡る向きを変え、好調な選手が続きにくい順に回す。同じ大会の連続した挑戦で同じ組を引かない。
const FORMS = [[0, 0, 0], [8, 0, -8], [-8, 8, 0], [0, -8, 8], [8, -8, 0], [0, 8, -8], [-8, 0, 8]];
export function drawRivalForm(rivals, weatherSeed, chapter, attempt) {
  const seed = Math.imul(weatherSeed >>> 0, 0x9e3779b1 ^ (chapter << 8)) >>> 0;
  const cycle = Math.floor((attempt - 1) / FORMS.length);
  const cycleSeed = (seed ^ Math.imul(cycle, 0x85ebca6b)) >>> 0;
  const stride = (cycleSeed >>> 31) === 0 ? 1 : FORMS.length - 1;
  // 一巡後は開始位置を2つ進める。前の周がどちら向きでも境目の二試合が重ならない。
  const start = seed % FORMS.length + 2 * cycle;
  const form = FORMS[(start + ((attempt - 1) % FORMS.length) * stride) % FORMS.length];
  return Object.fromEntries(rivals.map((id, i) => [id, form[i]]));
}

// その工程で元々ついた3人分の評価を、調子を考慮した順に配分する。
// 総評価を保ち、大差のある得意工程はそのまま。はじめの出来は別に審査する。
export function rivalScores(scores, form, share = 1) {
  if (!form) return scores; // 途中保存は旧来の評価で完走。
  const ids = Object.keys(scores);
  const values = Object.values(scores).sort((a, b) => b - a);
  const priority = id => scores[id] + (form[id] ?? 0);
  ids.sort((a, b) => priority(b) - priority(a) || scores[b] - scores[a]);
  const result = { ...scores };
  ids.forEach((id, i) => { result[id] = scores[id] + (values[i] - scores[id]) * share; });
  return result;
}
