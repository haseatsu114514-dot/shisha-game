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
const EXPECTED = {
  g500: { box: 50, total: 25541 },
  g1000: { box: 50, total: 50660 },
  g3000: { box: 20, total: 63575 },
  g5000: { box: 40, total: 223300 },
  g10000: { box: 40, total: 425150 },
  // 第5章の限定台くじ（KJ05）: S賞はくじ限定の台3種（非売品なので景品評価＝元の特注台の中古評価150,000円で数える）
  g20000: { box: 30, total: 630800, s: 3 },
};
assert.deepEqual(Object.keys(data.grades), Object.keys(EXPECTED), '500円・1,000円の箱を残し、上位くじを値段の順に並べる');
for (const [id, g] of Object.entries(data.grades)) {
  const want = EXPECTED[id];
  assert.equal(g.boxSize, want.box, `${id}: 箱の枚数`);
  assert.equal(g.prizes.reduce((n, p) => n + p.count, 0), g.boxSize);
  assert.equal(g.prizes.filter(p => p.rank === 'S').reduce((n, p) => n + p.count, 0), want.s ?? 1);
  assert.equal(g.lastOne.secret, true);
  const cost = g.price * g.boxSize;
  const total = g.prizes.reduce((n, p) => n + valueOf(p) * p.count, 0);
  assert.equal(total, want.total, `${id}: 定価換算`);
  assert(total / cost >= 1);
  assert((total + valueOf(g.lastOne)) / cost <= 1.15);
  assert(g.prizes.every(p => p.type !== 'consumable' && (p.type !== 'flavor' || p.flavorId || p.flavors)), 'No no-op filler awards');
  const cash = g.prizes.reduce((n, p) => n + resaleOf(p) * p.count, 0);
  assert(cash < cost, 'Reselling does not create a profitable draw loop');
  // S賞が店で買える台なら、箱を引き切るより店で買う方が安い（くじは運試しで、店の値段を下回る確実な買い方にしない）。
  const s = g.prizes.find(p => p.rank === 'S');
  if (s.equipId && !equipment[s.equipId].not_for_sale) assert(equipment[s.equipId].buy_price < cost, `${id}: S賞の店頭価格 < 箱の総額`);
  console.log(`[kuji balance] ${id}: S=${want.s ?? 1}/${g.boxSize}, value=${total} (${(total / cost * 100).toFixed(2)}%), with last=${((total + valueOf(g.lastOne)) / cost * 100).toFixed(2)}%, resale=${cash}`);
}
assert.equal(data.legacyGrades.g500.boxSize, 20);
assert.equal(data.legacyGrades.g1000.boxSize, 12);
for (const g of Object.values(data.legacyGrades)) assert.equal(g.prizes.reduce((n,p) => n+p.count, 0), g.boxSize);
