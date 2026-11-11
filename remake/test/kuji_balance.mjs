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
// 売って作れるお金: 小物の売値と、売れる機材の買い取り額。くじで手に入れた台・機材の買い取りは、重複しても売っても
// 「そのくじ1回の値段」まで（KJ16・daily/kuji-resale.js と kuji.js の grant()）。
const resaleOf = (p, price) => p.type === 'goods' ? p.sell
  : p.equipId && !equipment[p.equipId].unsellable ? Math.min(equipment[p.equipId].sell_price, price) : 0;
// 上限が無かったら売って作れたお金（値下げ前の数え方）。上限が要る箱を確かめるのに使う。
const uncappedResaleOf = p => p.type === 'goods' ? p.sell
  : p.equipId && !equipment[p.equipId].unsellable ? equipment[p.equipId].sell_price : 0;
// 値段は 2026-11-11 に1ランクずつ下げた（KJ15・オーナー「くじ高すぎるのでもう1ランクずつ値段下げて」「中身そのまま安く」）。
// 景品と枚数（box・total＝定価換算）は値下げ前と同じ。price が1回の値段、was が値下げ前。
const EXPECTED = {
  g1000: { box: 50, total: 50660, price: 500, was: 1000 },
  g3000: { box: 20, total: 63575, price: 1000, was: 3000 },
  g5000: { box: 40, total: 223300, price: 3000, was: 5000 },
  g10000: { box: 40, total: 425150, price: 5000, was: 10000 },
  // 第5章の限定台くじ（KJ05）: S賞はくじ限定の台3種（非売品なので景品評価＝元の特注台の中古評価150,000円で数える）
  g20000: { box: 30, total: 630800, s: 3, price: 10000, was: 20000 },
};
assert.deepEqual(Object.keys(data.grades), Object.keys(EXPECTED), '本店の箱から、新しい街ほど上位のくじを値段の順に並べる（旧500円の箱は廃止・KJ11）');
assert.deepEqual(Object.values(data.grades).map(g => g.price), [500, 1000, 3000, 5000, 10000], '1回の値段は新しい街ほど高い');
for (const [id, g] of Object.entries(data.grades)) {
  const want = EXPECTED[id];
  assert.equal(g.boxSize, want.box, `${id}: 箱の枚数`);
  assert.equal(g.prizes.reduce((n, p) => n + p.count, 0), g.boxSize);
  assert.equal(g.prizes.filter(p => p.rank === 'S').reduce((n, p) => n + p.count, 0), want.s ?? 1);
  assert.equal(g.lastOne.secret, true);
  assert.equal(g.price, want.price, `${id}: 1回の値段（1ランク下げた・KJ15）`);
  const cost = g.price * g.boxSize;
  const total = g.prizes.reduce((n, p) => n + valueOf(p) * p.count, 0);
  assert.equal(total, want.total, `${id}: 定価換算（景品は値下げ前と同じ）`);
  // 値下げ前は「定価換算が箱の総額の100〜115%」だった。景品をそのままに値段だけ下げたので、今は箱の総額より多い。
  assert(total / (want.was * g.boxSize) >= 1 && (total + valueOf(g.lastOne)) / (want.was * g.boxSize) <= 1.15, `${id}: 景品の量は値下げ前の釣り合いのまま`);
  assert(total / cost >= 1.8, `${id}: 値下げ後は定価換算が箱の総額の約2倍以上（引く側が得）`);
  assert(g.prizes.every(p => p.type !== 'consumable' && (p.type !== 'flavor' || p.flavorId || p.flavors)), 'No no-op filler awards');
  // 箱を買い切って売れる物を全部売っても、払ったお金より少ない（お金が増える穴を作らない）。ラストワン賞も入れて数える。
  const prizes = [...g.prizes, g.lastOne];
  const cash = prizes.reduce((n, p) => n + resaleOf(p, g.price) * p.count, 0);
  assert(cash < cost / 2, `${id}: 売って戻るお金は箱の総額の半分に届かない（${cash} / ${cost}）`);
  // 台・機材1つで戻るお金は、1回の値段を超えない（上限の決まり・KJ16）。
  for (const p of prizes.filter(p => p.equipId)) assert(resaleOf(p, g.price) <= g.price, `${id}「${p.name}」`);
  const uncapped = prizes.reduce((n, p) => n + uncappedResaleOf(p) * p.count, 0);
  // S賞が店で買える台のとき、箱を引き切る方が店より安い箱がある（オーナー承知の値下げ）。その一覧を固定して、気づかずに増減させない。
  const s = g.prizes.find(p => p.rank === 'S');
  const cheaperThanShop = !!s.equipId && !equipment[s.equipId].not_for_sale && cost < equipment[s.equipId].buy_price;
  assert.equal(cheaperThanShop, ['g3000', 'g10000'].includes(id), `${id}: 箱の総額がS賞の店頭価格より安いのは、柚ヶ谷店とドバイ店だけ`);
  // 上限が無ければお金が増えていた箱は柚ヶ谷店だけ（箱20,000円に対して中古買い取り25,600円）。
  assert.equal(uncapped > cost, id === 'g3000', `${id}: 上限が無いと売って増える箱（${uncapped} / ${cost}）`);
  console.log(`[kuji balance] ${id}: ¥${g.price} x ${g.boxSize}, S=${want.s ?? 1}/${g.boxSize}, value=${total} (${(total / cost * 100).toFixed(2)}%), resale=${cash} (uncapped ${uncapped})`);
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
