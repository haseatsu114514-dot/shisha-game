// Retail-equivalent expectation uses actual granted grams, not decorative/no-op prizes.
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read = file => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'));
const data = read('../../data/kuji.json');
const flavors = Object.fromEntries(read('../../data/flavors.json').flavors.map(f => [f.id, f]));
const leafValue = (id, grams) => {
  assert(flavors[id]); assert(grams > 0 && Number.isFinite(grams));
  return flavors[id].price * grams / 50;
};
const valueOf = p => p.flavorId ? leafValue(p.flavorId, p.grams ?? 50)
  : p.flavors ? p.flavors.reduce((n, leaf) => n + leafValue(leaf.id, leaf.grams), 0) : p.sell;
for (const [id, g] of Object.entries(data.grades)) {
  assert.equal(g.boxSize, 50);
  assert.equal(g.prizes.reduce((n, p) => n + p.count, 0), 50);
  assert.equal(g.prizes.filter(p => p.rank === 'S').reduce((n, p) => n + p.count, 0), 1);
  assert.equal(g.lastOne.secret, true);
  const total = g.prizes.reduce((n, p) => n + valueOf(p) * p.count, 0);
  assert.equal(total, id === 'g500' ? 25391 : 50660);
  assert(total / (g.price * g.boxSize) >= 1);
  assert((total + valueOf(g.lastOne)) / (g.price * g.boxSize) <= 1.15);
  assert(g.prizes.every(p => p.type !== 'consumable' && (p.type !== 'flavor' || p.flavorId || p.flavors)), 'No no-op filler awards');
  const cash = g.prizes.filter(p => p.type === 'goods').reduce((n, p) => n + p.sell * p.count, 0);
  assert(cash < g.price * g.boxSize, 'Reselling does not create a profitable draw loop');
  console.log(`[kuji balance] ${id}: S=1/50, value=${total}, EV=${total / 50}, with last=${(total + valueOf(g.lastOne)) / 50}, cash=${cash}`);
}
assert.equal(data.legacyGrades.g500.boxSize, 20);
assert.equal(data.legacyGrades.g1000.boxSize, 12);
for (const g of Object.values(data.legacyGrades)) assert.equal(g.prizes.reduce((n,p) => n+p.count, 0), g.boxSize);
