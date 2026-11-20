// くじ運（心得の盤のスキル K26。2026-11-20 SBD154）。箱の中身と枚数は変えず、新しい箱を作る時の順番だけを少し寄せる。
// 箱は作った時に順番が決まって保存されるので、引く時やロードでは変わらない。ほかの部品に依存しない（単体で検査できる）。

/** 上の賞 */
export const KUJI_HIGH = new Set(["S", "A"]);

/**
 * 後ろ半分に入った上の賞（S・A）を、確率 rate で前半のどこか（上の賞でない札）と入れ替える。
 * @param order 箱の順番（景品の番号の並び。先頭から引く）
 * @param prizes 景品（rank を見る）
 * @param lucky くじ運を覚えているか。覚えていなければ order をそのまま返す
 */
export function luckyOrder(order, prizes, lucky, rate = 0.5, random = Math.random) {
  if (!lucky) return order;
  const out = order.slice(), half = Math.floor(out.length / 2), high = (i) => KUJI_HIGH.has(prizes[out[i]]?.rank);
  for (let i = half; i < out.length; i++) {
    if (!high(i) || random() >= rate) continue;
    const front = [];
    for (let k = 0; k < half; k++) if (!high(k)) front.push(k);
    if (!front.length) break;
    const j = front[Math.floor(random() * front.length)];
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
