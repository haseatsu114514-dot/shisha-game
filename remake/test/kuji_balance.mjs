// Retail-equivalent expectation uses actual granted grams, not decorative/no-op prizes.
// 店で売る機材は店頭価格、非売品は景品の中古評価（sell）で数える。
// 釣り合いの決まり（KJ18・2026-11-11）: (1) お金は増えない（買い切って全部売っても箱の総額の8割まで）
// (2) ハズレは1回の値段より安い葉 (3) 定価換算は箱の総額以上（くじで損はしない）。
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
// 戻るお金の多い方: 売る、または持っている物が当たったときの補償（売れない台は景品評価の半額。くじ限定の台はくじ券でお金は0）。
// kuji.js の grant() と同じ数え方。
const cashBackOf = p => {
  if (!p.equipId) return resaleOf(p);
  const e = equipment[p.equipId];
  if (e.kuji_only) return 0;
  return !e.unsellable && e.sell_price > 0 ? e.sell_price : Math.round((p.sell || 0) * 0.5);
};
// 2026-11-11 に1回の値段を1ランクずつ下げ（KJ15）、中身も値段に合わせ（KJ17）、箱の枚数を40枚前後にそろえた（KJ18・
// オーナー「くじ自体が多すぎる気がしないでもない」→ 推奨で決定）。S賞・A賞の台と機材・ラストワン賞は値下げ前と同じ。
// price＝1回の値段、was＝値下げ前（引き途中の旧箱はこの値段のまま）。
const EXPECTED = {
  g1000: { box: 40, total: 22095, price: 500, was: 1000 },
  g3000: { box: 40, total: 64625, price: 1000, was: 3000 },
  g5000: { box: 40, total: 179820, price: 3000, was: 5000 },
  g10000: { box: 45, total: 362710, price: 5000, was: 10000 },
  // 第5章の限定台くじ（KJ05）: S賞はくじ限定の台3種（非売品なので景品評価＝元の特注台の中古評価150,000円で数える）
  g20000: { box: 30, total: 595820, s: 3, price: 10000, was: 20000 },
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
  // (3) くじで損はしない: 定価換算は箱の総額以上。
  assert(total >= cost, `${id}: 定価換算 ${total} < 箱の総額 ${cost}`);
  assert(g.prizes.every(p => p.type !== 'consumable' && (p.type !== 'flavor' || p.flavorId || p.flavors)), 'No no-op filler awards');
  // (1) お金は増えない: 箱を買い切って、売れる物を全部売り、持っている物が当たったときのお金も受け取っても、箱の総額の8割まで。
  const cash = [...g.prizes, g.lastOne].reduce((n, p) => n + cashBackOf(p) * p.count, 0);
  assert(cash <= cost * 0.8, `${id}: 戻るお金 ${cash} / 箱の総額 ${cost}`);
  assert(g.prizes.reduce((n, p) => n + resaleOf(p) * p.count, 0) < cost, 'Reselling does not create a profitable draw loop');
  // 1枚ずつ見ても、S賞以外で払った値段より高く売れる景品が箱の1割を超えない（ハズレを引き続けてお金が増えない）。
  const overpaid = g.prizes.filter(p => p.rank !== 'S' && cashBackOf(p) > g.price).reduce((n, p) => n + p.count, 0);
  assert(overpaid <= g.boxSize * 0.1, `${id}: 1回の値段より高く売れる景品は ${overpaid} / ${g.boxSize} 枚`);
  // (2) ハズレ（C賞）は1回の値段より安い葉。くじを引くのが、店で葉を買うより安い手段にならない。
  const hazure = g.prizes.filter(p => p.rank === 'C');
  assert(hazure.length && hazure.every(p => p.type === 'flavor' && valueOf(p) <= g.price), `${id}: ハズレは1回の値段以下の葉`);
  // 箱の大きさ: S賞が出るまでの枚数をそろえる（30〜45枚。値下げ前に枚数を増やした 60・55・70枚の箱はやめた）。
  assert(g.boxSize >= 30 && g.boxSize <= 45, `${id}: 箱は30〜45枚（${g.boxSize}）`);
  console.log(`[kuji balance] ${id}: ¥${g.price} x ${g.boxSize}, S=${want.s ?? 1}/${g.boxSize}, value=${total} (${(total / cost * 100).toFixed(2)}%), cash back=${cash} (${(cash / cost * 100).toFixed(1)}%)`);
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
