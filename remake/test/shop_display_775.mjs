import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { shopText, shopProductName, groupShopFlavors } from '../js/daily/shop-display.js';
const source = fs.readFileSync(new URL('../js/daily/shop.js', import.meta.url), 'utf8');
new vm.SourceTextModule(source); // Production module syntax, including the render expression.
const catalog = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json', import.meta.url)));
const before = JSON.stringify(catalog);
const ids = Array.from(vm.runInNewContext(source.match(/export const SHOP_FLAVORS = (\[[\s\S]*?\]);/)[1]));
const rows = ids.map(id => catalog.flavors.find(f => f.id === id));
assert.equal(rows.length, 25);
assert(ids.includes('cardamom') && ids.includes('lavender'));
const results = [];
for (const category of ['all', 'fruit', 'sweet']) {
  const input = rows.filter(f => category === 'all' || f.category === category);
  const original = input.slice();
  const output = groupShopFlavors(input);
  assert.deepEqual(input, original, 'does not mutate input order');
  assert.equal(output.length, input.length);
  assert.equal(new Set(output).size, input.length);
  const completed = new Set(); let previous;
  for (const f of output) {
    assert(input.includes(f), 'preserves original product object');
    if (f.maker !== previous) {
      assert(!completed.has(f.maker), 'a maker must not reappear');
      if (previous !== undefined) completed.add(previous);
      previous = f.maker;
    }
    assert(!/\bAF\b|アルファヘブン/.test(shopProductName(f)));
    if (f.maker === 'af') assert(shopProductName(f).startsWith('アルファーヘブン '));
  }
  const makers = [...new Set(output.map(f => f.maker))];
  assert.deepEqual(makers, [...new Set(input.map(f => f.maker))], 'maker first-appearance order');
  for (const maker of makers) assert.deepEqual(output.filter(f => f.maker === maker), input.filter(f => f.maker === maker), 'within-maker order');
  results.push({ category, ids: output.map(f => f.id), names: output.map(shopProductName) });
}
assert.deepEqual(groupShopFlavors([]), []);
assert.equal(shopText('AFのミント。アルファヘブン。アルファーヘブン。'), 'アルファーヘブンのミント。アルファーヘブン。アルファーヘブン。');
assert.equal(shopProductName({name:'AF ミント'}), 'アルファーヘブン ミント');
assert.equal(shopProductName({short_name:'アルファヘブン ミント'}), 'アルファーヘブン ミント');
assert.equal(shopText('アルファーヘブン'), 'アルファーヘブン');
assert.equal(shopProductName({name:'ドバジ バニラ'}), 'ドバジ バニラ');
assert.equal(JSON.stringify(catalog), before, 'all ID/maker/price/performance fields unchanged');
console.log(JSON.stringify({status:'PASS', checks:['all/fruit/sweet grouping','maker and product stability','original references','display labels','catalog unchanged','production syntax'], results}, null, 2));
