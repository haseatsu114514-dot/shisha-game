// Retail-equivalent expectation uses actual granted grams, not decorative/no-op prizes.
// 店で売る機材は店頭価格、非売品は景品の中古評価（sell）で数える。上位くじ（KJ02）は箱の枚数が違う。
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const data = read('../../data/kuji.json');
const flavors = Object.fromEntries(read('../../data/flavors.json').flavors.map(f => [f.id, f]));
const equipment = Object.fromEntries(read('../../data/equipment.json').equipment.map(e => [e.id, e]));
const leafValue = (id, grams) => {
  assert(flavors[id]); assert(grams > 0 && Number.isFinite(grams));
  return flavors[id].price * grams / 50;
};
const gearValue = p => {
  const e = equipment[p.equipId];
  assert(e, `${p.equipId} がある`);
  return e.not_for_sale ? p.sell : e.buy_price;
};
const valueOf = p => p.flavorId ? leafValue(p.flavorId, p.grams ?? 50)
  : p.flavors ? p.flavors.reduce((n, leaf) => n + leafValue(leaf.id, leaf.grams), 0)
  : p.equipId ? gearValue(p) : p.sell;
// 売って作れるお金: 小物の売値と、売れる機材の中古買い取り額。
const resaleOf = p => p.type === 'goods' ? p.sell
  : p.equipId && !equipment[p.equipId].unsellable ? equipment[p.equipId].sell_price : 0;
// 2026-11-11 に1回の値段を1ランクずつ下げ（KJ15）、中身も値段に合わせた（KJ17・オーナー「お金が増えるの変なので中身もその分
// ハズレのやつとかを安くしたりで調整」）。ハズレの葉をお試し10gにし、台と機材だけで箱の総額に届く店は枚数を増やした。
// S賞・A賞の台と機材・ラストワン賞は値下げ前と同じ。price＝1回の値段、was＝値下げ前（引き途中の旧箱はこの値段のまま）。
const EXPECTED = {
  g1000: { box: 50, total: 25660, price: 500, was: 1000 },
  g3000: { box: 60, total: 65500, price: 1000, was: 3000 },
  g5000: { box: 55, total: 184790, price: 3000, was: 5000 },
  g10000: { box: 70, total: 366490, price: 5000, was: 10000 },
  // 第5章の限定台くじ（KJ05）: S賞はくじ限定の台3種（非売品なので景品評価＝元の特注台の中古評価150,000円で数える）
  g20000: { box: 55, total: 598730, s: 3, price: 10000, was: 20000 },
};
assert.deepEqual(Object.keys(data.grades), Object.keys(EXPECTED), '本店の箱から、新しい街ほど上位のくじを値段の順に並べる（旧500円の箱は廃止・KJ11）');
for (const [id, g] of Object.entries(data.grades)) {
  const want = EXPECTED[id];
  assert.equal(g.boxSize, want.box, `${id}: 箱の枚数`);
  assert.equal(g.prizes.reduce((n, p) => n + p.count, 0), g.boxSize);
  assert.equal(g.prizes.filter(p => p.rank === 'S').reduce((n, p) => n + p.count, 0), want.s ?? 1);
  assert.equal(g.lastOne.secret, true);
  assert.equal(g.price, want.price, `${id}: 1回の値段（1ランク下げた・KJ15）`);
  assert.equal(g.priceWas, want.was, `${id}: 値下げ前の1回の値段（引き途中の旧箱に使う）`);
  const cost = g.price * g.boxSize;
  const total = g.prizes.reduce((n, p) => n + valueOf(p) * p.count, 0);
  assert.equal(total, want.total, `${id}: 定価換算`);
  assert(total / cost >= 1);
  assert((total + valueOf(g.lastOne)) / cost <= 1.15);
  assert(g.prizes.every(p => p.type !== 'consumable' && (p.type !== 'flavor' || p.flavorId || p.flavors)), 'No no-op filler awards');
  // 売って作れるお金は、ラストワン賞を入れても箱の総額に届かない（箱を買い切って売っても、お金が増えない）。
  const cash = g.prizes.reduce((n, p) => n + resaleOf(p) * p.count, 0);
  assert(cash < cost, 'Reselling does not create a profitable draw loop');
  assert(cash + resaleOf(g.lastOne) < cost * 0.6, `${id}: ラストワン賞まで全部売っても箱の総額の6割に届かない`);
  // 1枚ずつ見ても、S賞以外で払った値段より高く売れる景品が箱の1割を超えない（ハズレを引き続けてお金が増えない）。
  const overpaid = g.prizes.filter(p => p.rank !== 'S' && resaleOf(p) > g.price).reduce((n, p) => n + p.count, 0);
  assert(overpaid <= g.boxSize * 0.1, `${id}: 1回の値段より高く売れる景品は ${overpaid} / ${g.boxSize} 枚`);
  // S賞が店で買える台なら、箱を引き切るより店で買う方が安い（くじは運試しで、店の値段を下回る確実な買い方にしない）。
  const s = g.prizes.find(p => p.rank === 'S');
  if (s.equipId && !equipment[s.equipId].not_for_sale) assert(equipment[s.equipId].buy_price < cost, `${id}: S賞の店頭価格 < 箱の総額`);
  console.log(`[kuji balance] ${id}: S=${want.s ?? 1}/${g.boxSize}, value=${total} (${(total / cost * 100).toFixed(2)}%), with last=${((total + valueOf(g.lastOne)) / cost * 100).toFixed(2)}%, resale=${cash}`);
}
assert.deepEqual(Object.keys(data.legacyGrades), ['g1000'], '旧箱が残るのは本店の1,000円だけ');
assert.equal(data.legacyGrades.g1000.boxSize, 12);
for (const g of Object.values(data.legacyGrades)) assert.equal(g.prizes.reduce((n,p) => n+p.count, 0), g.boxSize);
// 旧箱の flavor 景品も grant() が実際に付与できる形にする（#2823 C1）。参照を持たない景品は当たっても何も渡らない。
for (const [id, g] of Object.entries(data.legacyGrades)) {
  assert(g.prizes.every(p => p.type !== 'flavor' || p.flavorId || (Array.isArray(p.flavors) && p.flavors.length > 0)), `${id}: 旧箱に付与できない flavor 景品がある`);
}
// C1 の確定内容: 旧箱 g1000「人気フレーバー詰め合わせ」は現行と同名品に揃え、ぶどう+ローズ各50g。
const legacySet = data.legacyGrades.g1000.prizes.find(p => p.name === '人気フレーバー詰め合わせ');
const currentSet = data.grades.g1000.prizes.find(p => p.name === '人気フレーバー詰め合わせ');
assert.deepEqual(legacySet.flavors, [{ id: 'grape', grams: 50 }, { id: 'rose', grams: 50 }]);
assert.deepEqual(legacySet.flavors, currentSet.flavors);
