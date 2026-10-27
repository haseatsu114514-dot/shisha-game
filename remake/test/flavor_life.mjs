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

// ---- #1106: ダメージ蓄積・体力合成・長時間蒸らし・帯の縮み・停止ズレ ----
import {applyLeafDamage,leafDamageRatio,flavorMixLife,steamDamageMult,leafDamagePerPull,leafStopDrift,LEAF_FAIL_STEPS,LEAF_DAMAGE} from '../js/craft/flavor-life.js';
import {temperatureBands} from '../js/craft/temperature-model.js';

// amount=1 は従来の1段階ずつと同じ。13回で赤が尽きて失敗域に達する。
{
  const c={},l=ensureFlavorLife(c);
  for(let i=0;i<LEAF_FAIL_STEPS;i++) applyLeafDamage(l,1);
  assert.equal(l.hp,0,'amount=1 fails after exactly LEAF_FAIL_STEPS over-pulls (same as legacy)');
  assert.deepEqual(flavorLeafStages(l),['gone','gone','gone','gone','brown']);
}
// 端数ダメージ：1.0たまるまで段階は進まない。体力の高い配合（amount<1）は傷みにくい。
{
  const c={},l=ensureFlavorLife(c);
  applyLeafDamage(l,0.5); assert.equal(l.steps,0,'half a point does not advance a stage yet');
  assert.equal(l.hp,5,'no leaf lost before one full point');
  applyLeafDamage(l,0.5); assert.equal(l.steps,1,'two halves advance exactly one stage');
  assert.equal(l.hp,4);
}
// 大きなダメージは一度に複数段階進む（脆い配合・長時間蒸らしの合わせ技）。
{
  const c={},l=ensureFlavorLife(c);
  applyLeafDamage(l,3); assert.equal(l.steps,3,'amount=3 advances three stages at once');
}
// leafDamageRatio は 0〜1。帯の縮み・停止ズレの強さに使う。
{
  const c={},l=ensureFlavorLife(c);
  assert.equal(leafDamageRatio(l),0,'fresh leaf has zero damage ratio');
  l.dmg=LEAF_FAIL_STEPS/2; assert(Math.abs(leafDamageRatio(l)-0.5)<1e-9,'half damage ~ 0.5 ratio');
  l.dmg=LEAF_FAIL_STEPS*2; assert.equal(leafDamageRatio(l),1,'ratio is clamped at 1');
}
// 体力（mix_life）はグラム比で合成。未設定は既定1.0。
{
  const catalog={soft:{heat_tolerance:1,mix_life:0.8},hard:{heat_tolerance:1,mix_life:1.2},plain:{heat_tolerance:1}};
  assert(Math.abs(flavorMixLife({mix:{soft:10,hard:10}},catalog)-1.0)<1e-9,'equal grams of 0.8 and 1.2 average to 1.0');
  assert(Math.abs(flavorMixLife({mix:{soft:30,hard:10}},catalog)-0.9)<1e-9,'gram-weighted: 3:1 of 0.8/1.2 = 0.9');
  assert.equal(flavorMixLife({mix:{plain:10}},catalog),LEAF_DAMAGE.mixLifeDefault,'unset flavor uses the default (unchanged difficulty)');
  assert.equal(flavorMixLife({mix:{}},catalog),LEAF_DAMAGE.mixLifeDefault,'empty mix uses the default');
}
// 長時間蒸らし：8分以下は1.0、10分で最大、間は線形。
{
  assert.equal(steamDamageMult({steamSeconds:300}),1,'5min steam: no extra damage');
  assert.equal(steamDamageMult({steamSeconds:480}),1,'8min steam: still no extra damage');
  assert.equal(steamDamageMult({steamSeconds:600}),LEAF_DAMAGE.longSteamMult,'10min steam: full multiplier');
  const nine=steamDamageMult({steamSeconds:540});
  assert(nine>1&&nine<LEAF_DAMAGE.longSteamMult,'9min steam sits between 8 and 10 min');
}
// 1回のダメージ量は体力と蒸らしの合成。既定＋通常蒸らしは基準値のまま。
{
  const catalog={soft:{heat_tolerance:1,mix_life:0.8},plain:{heat_tolerance:1}};
  assert.equal(leafDamagePerPull({mix:{plain:10},steamSeconds:300},catalog),LEAF_DAMAGE.perOverPull,'default flavor + normal steam = base damage');
  const hot=leafDamagePerPull({mix:{soft:10},steamSeconds:600},catalog);
  assert(Math.abs(hot-LEAF_DAMAGE.perOverPull/0.8*LEAF_DAMAGE.longSteamMult)<1e-9,'fragile flavor + long steam stacks');
}
// 停止ズレ：ダメージ0ならズレ0、roll符号に追従、満身創痍でも上限内。
{
  assert.equal(leafStopDrift(0,1),0,'no damage => no drift');
  assert.equal(leafStopDrift(1,0),0,'centered roll => no drift');
  assert(leafStopDrift(1,1)>0&&leafStopDrift(1,-1)<0,'drift follows the roll sign');
  assert(Math.abs(leafStopDrift(1,1))<=LEAF_DAMAGE.stopDrift+1e-12,'drift never exceeds the cap');
  assert(leafStopDrift(0.5,1)<leafStopDrift(1,1),'more damage => larger possible drift');
}
// 適温帯はダメージで細くなる。中心は動かず、幅だけが damageScale 倍に縮む。
{
  const catalog={a:{heat_tolerance:1}};
  const fresh=temperatureBands({mix:{a:10},leaf:{dmg:0}},catalog);
  const hurt=temperatureBands({mix:{a:10},leaf:{dmg:LEAF_FAIL_STEPS/2}},catalog);
  assert(Math.abs(fresh.center-hurt.center)<1e-12,'damage never moves the center');
  const freshWidth=fresh.ideal[1]-fresh.ideal[0],hurtWidth=hurt.ideal[1]-hurt.ideal[0];
  const expected=1-LEAF_DAMAGE.bandNarrow*0.5;
  assert(Math.abs(hurtWidth/freshWidth-expected)<1e-9,'ideal band narrows by damageScale');
  assert(Math.abs((hurt.optimal[1]-hurt.optimal[0])/(fresh.optimal[1]-fresh.optimal[0])-expected)<1e-9,'optimal band narrows by the same scale');
  assert.equal(fresh.damageScale,1,'fresh leaf keeps full width');
  assert(hurt.damageScale<1&&hurt.damageScale>0,'damaged leaf exposes a narrower damageScale');
}
console.log('PASS: #1106 accumulation, gram-ratio life, long-steam multiplier, band narrowing, and stop drift');
