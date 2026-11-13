// #1657: ナイトサイドの正式品は、第3章ではヴォルクへの配達（DAY2）の後から東京店に並ぶ。
// 配達の既読フラグが無い旧保存でもDAY2を終えていれば消えず、第4章のドバイ店・第5章の東京では最初から並ぶ。
// node --experimental-vm-modules remake/test/shop_tokyo_nightside.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.document = { addEventListener() {}, querySelector() { return null; } };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) };
const { DB } = await import('../js/core/data.js');
const flavors = JSON.parse(fs.readFileSync(new URL('../../data/flavors.json', import.meta.url))).flavors;
DB.flavorById = Object.fromEntries(flavors.map(f => [f.id, f]));
DB.recipes = []; DB.ngMixes = [];
const { DUBAI_FLAVORS, releasedFlavor } = await import('../js/daily/shop.js');
const { TOKYO_FLAVORS, NIGHTSIDE_RELEASE_FLAVORS, nightsideOnSale, tokyoShopFlavors } = await import('../js/daily/shop-catalogs.js');
const { MUKAI_DELIVERY_STEPS } = await import('../js/chapters/ch3-deliveries.js');
const { chapterThreeScenes } = await import('../js/chapters/ch3-progress.js');

const NIGHTSIDE = ['nightside_blast_mint', 'nightside_earlgrey_release'];
assert.deepEqual([...NIGHTSIDE_RELEASE_FLAVORS], NIGHTSIDE);
for (const id of NIGHTSIDE) {
  assert(TOKYO_FLAVORS.includes(id), `${id} は東京店の品目`);
  assert.equal(DB.flavorById[id].chapter_min, 3, `${id} の発売章は第3章のまま`);
}
// 配達のフラグ名と、旧保存の判定に使う「DAY2の場面＝東京の行程の3番目」を実物から確かめる。
assert.equal(MUKAI_DELIVERY_STEPS.find(step => step.person === 'volk')?.flag, '_ch3_delivery_volk');
for (const routeVersion of [undefined, 2, 3]) {
  assert.equal(chapterThreeScenes({ flags: { _ch3_intro: { routeVersion } } })[2].id, 'ch3_mukai_intro', `版${routeVersion ?? 1}の3番目はDAY2の配達`);
}

const ch3 = (flags = {}) => ({ chapter: 3, flags });
const hasNightside = value => NIGHTSIDE.every(id => tokyoShopFlavors(value).includes(id));
const noNightside = value => NIGHTSIDE.every(id => !tokyoShopFlavors(value).includes(id));
// 東京に着いたばかり（配達前）は並ばない。ほかの品目はそのまま。
for (const value of [ch3(), ch3({ _ch3_intro: { stage: 0, routeVersion: 3 } }), ch3({ _ch3_intro: { stage: 2, routeVersion: 3 }, _ch3_delivery_saku: true, _ch3_delivery_steve: true })]) {
  assert.equal(nightsideOnSale(value), false);
  assert(noNightside(value), '配達前の東京店にナイトサイドは無い');
  assert.deepEqual(tokyoShopFlavors(value), TOKYO_FLAVORS.filter(id => !NIGHTSIDE.includes(id)), '残りの品目と並び順は変えない');
}
// ヴォルクへ届けた直後（DAY2の場面の途中）から並ぶ。
assert(hasNightside(ch3({ _ch3_intro: { stage: 2, routeVersion: 3 }, _ch3_delivery_volk: true })), '配達の後は並ぶ');
// 配達フラグの無い旧保存でも、DAY2の場面を終えていれば消えない（版1〜3）。
for (const routeVersion of [undefined, 2, 3]) {
  assert(hasNightside(ch3({ _ch3_intro: { stage: 3, routeVersion } })), `旧保存（版${routeVersion ?? 1}）のDAY3以降は並ぶ`);
  assert(hasNightside(ch3({ _ch3_intro: { stage: 18, routeVersion } })), `旧保存（版${routeVersion ?? 1}）の大会前も並ぶ`);
}
// 後の章: 第5章の東京は最初から全品目。第4章のドバイ店にも並ぶ。
for (const value of [{ chapter: 5, flags: {} }, { chapter: 5, flags: { _ch3_intro: { stage: 0 } } }]) {
  assert.deepEqual(tokyoShopFlavors(value), TOKYO_FLAVORS, '第5章の東京店は全品目');
}
assert.equal(nightsideOnSale({ chapter: 4, flags: {} }), true);
for (const id of NIGHTSIDE) {
  assert(DUBAI_FLAVORS.includes(id) && releasedFlavor(id, 4) && releasedFlavor(id, 5), `${id} は第4・5章でも買える`);
}
// 東京店を開くと、この品目で売り場を作る（ショップの東京分岐が絞り込みを通る）。
assert.match(fs.readFileSync(new URL('../js/daily/shop.js', import.meta.url), 'utf8'), /flavorIds: tokyoShopFlavors\(state\)/);

console.log('PASS Tokyo shop lists Nightside only after the Volk delivery in chapter 3 (old saves and chapters 4-5 keep it) (#1657)');
