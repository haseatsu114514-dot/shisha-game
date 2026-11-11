// くじで手に入れた台・機材の買い取りの上限（KJ16・2026-11-11）。
// くじの値段を1ランクずつ下げた（KJ15。景品と枚数はそのまま）ので、箱を買い切って台・機材を売ると
// 払った額より多く戻る箱ができる（柚ヶ谷店: 箱20,000円に対して中古買い取り22,600円）。
// くじで手に入れた台・機材は「重複しても売っても、そのくじ1回の値段まで」にして、お金が増える穴をふさぐ。
// 店で買った物・今までのセーブで持っていた物は今までどおりの買い取り額。
//
// 覚える場所はその箱（state.kuji[くじのID].won ＝ そのくじで手に入れて今も持っている物のID）。
// 箱が新しく入れ替わっても引き継ぐ（daily/kuji.js の boxOf）。
import { state } from "../core/state.js";
import { DB } from "../core/data.js";

/** くじで手に入れた台・機材として覚える */
export function noteKujiGear(gradeId, equipId) {
  const box = state.kuji?.[gradeId];
  if (!box || !equipId) return;
  if (!Array.isArray(box.won)) box.won = [];
  if (!box.won.includes(equipId)) box.won.push(equipId);
}

/** その品を売るときの上限（くじで手に入れた物でなければ null）。複数のくじの記録にあれば安い方 */
export function kujiResaleCap(equipId) {
  let cap = null;
  for (const [gradeId, box] of Object.entries(state.kuji || {})) {
    if (!Array.isArray(box?.won) || !box.won.includes(equipId)) continue;
    const price = DB.kuji?.grades?.[gradeId]?.price;
    if (price > 0) cap = cap == null ? price : Math.min(cap, price);
  }
  return cap;
}

/** 手放したら記録を消す（あとで店で買い直した物は、店の買い取り額に戻る） */
export function forgetKujiGear(equipId) {
  for (const box of Object.values(state.kuji || {})) {
    if (Array.isArray(box?.won) && box.won.includes(equipId)) box.won = box.won.filter((id) => id !== equipId);
  }
}

/** 買い取り額。くじで手に入れた物は、そのくじ1回の値段まで */
export function resalePrice(e) {
  const cap = kujiResaleCap(e.id);
  return cap == null ? e.sell_price : Math.min(e.sell_price, cap);
}
