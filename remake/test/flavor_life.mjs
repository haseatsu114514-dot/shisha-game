import assert from 'node:assert/strict';
import {ensureFlavorLife,burnFlavorLeaf,flavorLeafStages} from '../js/craft/flavor-life.js';
const cs={},leaf=ensureFlavorLife(cs);
assert.deepEqual(flavorLeafStages(leaf),['red','red','red','red','red']);
burnFlavorLeaf(leaf);
assert.deepEqual(flavorLeafStages(leaf),['brown','red','red','red','red']);
burnFlavorLeaf(leaf);
assert.deepEqual(flavorLeafStages(leaf),['black','red','red','red','red']);
burnFlavorLeaf(leaf);
assert.deepEqual(flavorLeafStages(leaf),['gone','red','red','red','red']);
assert.equal(leaf.hp,4);
burnFlavorLeaf(leaf);
assert.deepEqual(flavorLeafStages(leaf),['gone','brown','red','red','red']);
for(let i=5;i<=13;i++){
  burnFlavorLeaf(leaf);
  const stages=flavorLeafStages(leaf);
  assert.equal(stages.filter(s=>s==='red').length,leaf.hp,'red count must match the remaining usable leaves');
  assert(stages.filter(s=>s==='brown'||s==='black').length<=1,'only one leaf may deteriorate at once');
}
assert.deepEqual(flavorLeafStages(leaf),['gone','gone','gone','gone','brown']);
assert.equal(leaf.hp,0,'last red turning brown ends the flavor life');
const before={...leaf}; burnFlavorLeaf(leaf); assert.deepEqual(leaf,before,'no damage after red leaves run out');
assert.equal(ensureFlavorLife(cs),leaf,'same life state is carried into the next stage');
console.log('PASS: five red leaves, one-at-a-time red→brown→black→gone, untouched reserve, last red runs out after 13 damage steps, and shared state');
