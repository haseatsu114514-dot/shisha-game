// 新フレーバー7種の発売章・各店の品揃えと、第4章 Dr.fookah ドバイ店の行き先（NF01〜NF03）。
// node --experimental-vm-modules remake/test/shop_new_flavors_dubai.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const { DB } = await import('../js/core/data.js');
const flavors = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json', import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));
DB.recipes = []; DB.ngMixes = [];
const { SHOP_FLAVORS, DUBAI_FLAVORS, releasedFlavor } = await import('../js/daily/shop.js');
const { WIDEHANGA_FLAVORS, TOKYO_FLAVORS, DUBAI_SHOP_NAME } = await import('../js/daily/shop-catalogs.js');
const { isTournamentFlavorLegal } = await import('../js/craft/steps.js');

// 発売章: みんとの新作の材料は第1章、柚ヶ谷の新入荷は第2章、東京の新入荷は第3章。
const RELEASE = { grapefruit: 1, honey: 1, milk: 2, cherry: 2, passion_fruit: 2, lime: 3, biscuit: 3 };
for (const [id, chapter] of Object.entries(RELEASE)) {
  const f = DB.flavorById[id];
  assert(f, `${id} がデータにある`);
  assert.equal(f.chapter_min, chapter, `${id} の発売章`);
  assert.equal(f.leaf, 'blond', `${id} はブロンドリーフ`);
  assert(!f.sample && !f.not_for_sale && f.competition_legal !== false, `${id} は通常の商品`);
  if (chapter > 1) assert.equal(releasedFlavor(id, chapter - 1), false, `${id} は発売前の章では並ばない`);
  assert.equal(releasedFlavor(id, chapter), true, `${id} は発売章から並ぶ`);
  assert.equal(isTournamentFlavorLegal(id, chapter), true, `${id} は発売章の大会で使える`);
}
assert(SHOP_FLAVORS.includes('grapefruit') && SHOP_FLAVORS.includes('honey'), '地元店にグレープフルーツとハニー');
for (const id of ['milk', 'cherry', 'passion_fruit']) assert(WIDEHANGA_FLAVORS.includes(id), `柚ヶ谷店に ${id}`);
for (const id of ['lime', 'biscuit']) assert(TOKYO_FLAVORS.includes(id) && WIDEHANGA_FLAVORS.includes(id), `東京店と第5章の柚ヶ谷店に ${id}`);
// 既存の店頭品はどれも、その店を開く章で発売済み（絞り込みで今の品揃えが消えない）。
for (const [list, chapter] of [[SHOP_FLAVORS.filter(id => !(id in RELEASE)), 1], [WIDEHANGA_FLAVORS.filter(id => !(id in RELEASE)), 2], [TOKYO_FLAVORS.filter(id => !(id in RELEASE)), 3]]) {
  for (const id of list) assert(releasedFlavor(id, chapter), `${id} は第${chapter}章の店頭に残る`);
}

// ドバイ店: 日本の各店で扱ってきた葉を全部、重複なしで。第4章では全品が発売済み。
assert.equal(DUBAI_SHOP_NAME, 'Dr.fookah ドバイ店');
const everyShop = new Set([...SHOP_FLAVORS, ...WIDEHANGA_FLAVORS, ...TOKYO_FLAVORS]);
assert.equal(DUBAI_FLAVORS.length, everyShop.size, 'ドバイ店は重複なし');
for (const id of everyShop) assert(DUBAI_FLAVORS.includes(id), `ドバイ店に ${id}`);
for (const id of Object.keys(RELEASE)) assert(DUBAI_FLAVORS.includes(id), `ドバイ店に新フレーバー ${id}`);
for (const id of DUBAI_FLAVORS) assert(releasedFlavor(id, 4), `${id} は第4章で並ぶ`);
assert(!DUBAI_FLAVORS.some(id => DB.flavorById[id].leaf !== 'blond'), 'はじめはブロンドリーフのみ');

console.log('PASS new flavors release chapters, shop catalogs and Dubai shop catalog (map destination: ch4_progress.mjs)');
