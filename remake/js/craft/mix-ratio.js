// 配合の比率（#638 オーナー依頼「今の比率も出したい。フレーバーのグラム数ではなく」）。
// 表示用。判定（黄金比など）には使わない。整数%に丸め、合計がちょうど100になるよう最大剰余法でそろえる。

/** { id: g } → { id: % }。0g の葉は 0。合計0gなら全部 0 */
export function mixPercents(mix = {}) {
  const entries = Object.entries(mix).map(([id, g]) => [id, Number.isFinite(g) && g > 0 ? g : 0]);
  const total = entries.reduce((s, [, g]) => s + g, 0);
  if (!total) return Object.fromEntries(entries.map(([id]) => [id, 0]));
  const raw = entries.map(([id, g]) => [id, (g * 100) / total]);
  const out = Object.fromEntries(raw.map(([id, r]) => [id, Math.floor(r)]));
  let rest = 100 - Object.values(out).reduce((a, b) => a + b, 0);
  raw.map(([id, r], i) => [id, r - Math.floor(r), i]).sort((a, b) => b[1] - a[1] || a[2] - b[2])
    .forEach(([id, frac]) => { if (rest > 0 && frac > 0) { out[id] += 1; rest -= 1; } });
  return out;
}
