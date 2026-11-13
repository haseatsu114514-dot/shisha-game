// ♥5の贈り物（色の火1＋白火1・SBD109）を、無料LIME・物語（強制イベント）で♥5になったときも寝る前の精算で回収する。
// 実 stats / growth / state を使う。VN・DOM は使わない（通常プレイや画面の目視とは別）。
import assert from 'node:assert/strict';
globalThis.document = { addEventListener() {} };
globalThis.window = {};
const storage = new Map();
globalThis.localStorage = { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const core = await import('../js/core/state.js');
const stats = await import('../js/core/stats.js');
const growth = await import('../js/core/growth.js');
const { CHAR_TYPE } = await import('../js/core/growth-board-data.js');
const MAX = stats.AFFINITY_RANK_PTS[5];
function fresh() { core.newGame(); core.state.phase = 'daily'; growth.ensureGrowth(); return core.state; }
const fires = s => ({ ...s.growth.hidane });

// 無料LIMEで♥5。その場ではEXPも贈り物も入らず、精算で一度だけ届く。保存・LOAD・再精算で重ならない。
{
  const s = fresh(); s.affinity.naru = MAX - 1;
  const color = CHAR_TYPE.naru, before = fires(s);
  for (let i = 0; i < 3; i++) stats.gainAffinity('naru', 2, { source: 'lime', onGain() {} });
  assert.equal(stats.affinityLevel('naru'), 5);
  assert.equal(s.growth.xp, 0, 'LIMEの♥5は経験値にしない（SPEC 1.1）');
  assert(!s.growth.gifted.naru, 'LIMEの♥5ではその場で贈り物を渡さない');
  core.save(); assert(core.load());
  growth.settleGrowth();
  const g = core.state.growth;
  assert.equal(g.xp, 0, '精算でも経験値は付けない');
  assert.equal(g.gifted.naru, true);
  assert.equal(g.hidane[color] - (before[color] || 0), growth.KEY_GIFT.color, '色の火1つ');
  assert.equal(g.hidane.any - (before.any || 0), growth.KEY_GIFT.any, '白火1つ');
  const once = fires(core.state);
  growth.settleGrowth(); core.save(); assert(core.load()); growth.settleGrowth();
  assert.deepEqual(fires(core.state), once, '再精算・LOADで二重に渡さない');
}

// 以前の保存で♥5のまま受け取っていない人（恋人を含む）。CHAR_TYPE に無い人と、盤が無効な時は対象外。
{
  const s = fresh(); s.affinity.adam = MAX; s.lovers = ['samechan']; s.affinity.sumi = MAX;
  const ids = Object.keys(CHAR_TYPE).filter(id => stats.affinityLevel(id) >= 5);
  assert(ids.includes('adam') && ids.includes('samechan'), `fixture: ${ids}`);
  assert(!('sumi' in CHAR_TYPE));
  growth.setGrowthPreview(false); assert.equal(growth.settleGrowth(), null); assert.equal(s.growth.earned, 0);
  growth.setGrowthPreview(true); growth.settleGrowth();
  for (const id of ids) assert.equal(s.growth.gifted[id], true, id);
  assert(!s.growth.gifted.sumi);
  fresh(); growth.settleGrowth();
  assert.deepEqual(core.state.growth.gifted, {}, '別のセーブ（新規）には引き継がない');
}

// 自由行動で♥5になった時は、その場で渡した分を夜に重ねない。
{
  const s = fresh(); s.affinity.naru = MAX - 1;
  await stats.paidAction(() => { stats.gainAffinity('naru', 4); stats.addStamina(-10); return true; }, { exp: { key: 'naru', person: 'naru' } });
  assert.equal(stats.affinityLevel('naru'), 5);
  assert.equal(s.growth.gifted.naru, true, '自由行動の♥5はその場で渡す（今までどおり）');
  const once = fires(s);
  growth.settleGrowth();
  assert.deepEqual(fires(s), once, '夜の精算で重ねない');
}

console.log('affection regressions: free ♥5 gift recovery / no EXP / no duplicate gifts across settle, SAVE/LOAD and paid visits: PASS');
