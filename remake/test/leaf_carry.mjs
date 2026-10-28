// E07（#1081）: 蒸らし・提供で使ったフレーバーの持ち/消耗度を、調整（熱管理）の場面へ引き継ぐ。
// 場面切替・SAVE/LOAD で葉が新品へ戻らないこと、旧セーブ（消耗記録なし）は新品扱いで安全に読めることを守る。
// 実際の state.newGame() と craft/session.js の newSession を回し、消耗は flavor-life の実関数で進める。
// TODO: tools/ci/suites.json への登録が必要（E07 完成後にまとめて登録する）。
import assert from 'node:assert/strict';

// session.js / state.js はモジュール内で DOM を触らないが、関数呼び出し時に少しだけ使う。最小の shim を先に用意する。
const stubNode = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, contains() { return false; }, toggle() {} },
  setAttribute() {}, removeAttribute() {}, getAttribute() { return null; }, append() {}, prepend() {},
  replaceChildren() {}, querySelector() { return null; }, querySelectorAll() { return []; }, addEventListener() {}, remove() {} });
globalThis.document ??= { createElement: stubNode, createElementNS: stubNode, getElementById: () => null,
  body: { classList: { add() {}, remove() {} }, append() {} } };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {} });
globalThis.localStorage ??= { _m: new Map(), getItem(k) { return this._m.get(k) ?? null; },
  setItem(k, v) { this._m.set(k, String(v)); }, removeItem(k) { this._m.delete(k); } };

const { newGame, state } = await import('../js/core/state.js');
const { newSession } = await import('../js/craft/session.js');
const { ensureFlavorLife, applyLeafDamage, leafDamagePerPull, leafDamageRatio, LEAF_MAX, LEAF_FAIL_STEPS } =
  await import('../js/craft/flavor-life.js');

const clone = (value) => JSON.parse(JSON.stringify(value)); // SAVE/LOAD と同じ（ch1/2/3 大会の clone）

newGame();

// 1) セッションを作った時点で葉の状態が生まれる（場面切替で後から新品を作り直さない）。
{
  const cs = newSession('tournament');
  assert(cs.leaf, 'newSession must seed the flavor-life state so it is owned by the session');
  assert.equal(cs.leaf.hp, LEAF_MAX, 'a fresh session starts with a full flavor');
  assert.equal(cs.leaf.dmg, 0, 'a fresh session has no accumulated wear');
  assert.equal(cs.leaf.steps, 0, 'a fresh session has not advanced any burn step');
}

// 2) 蒸らし→提供で傷んだ葉が、調整の場面（別画面＋途中SAVE/LOAD）へそのまま引き継がれる。
{
  const cs = newSession('tournament');
  cs.mix = { double_apple: 12 };
  cs.steamSeconds = 540; // 9分の長め蒸らし。過吸いのダメージが少し増える。
  // 提供（吸い出し）で3回過吸いした想定。実際の pull.js と同じ applyLeafDamage で進める。
  for (let i = 0; i < 3; i++) applyLeafDamage(cs.leaf, leafDamagePerPull(cs));
  const served = clone(cs.leaf);
  assert(served.hp < LEAF_MAX, 'over-pulling during serving must wear the flavor down');
  assert(served.dmg > 0, 'serving wear must be recorded as accumulated damage');

  // 調整の場面へ。大会は提供後に clone(cs) を保存し、LOAD で clone(p.craft) から再開する。
  const resumed = clone(cs);
  // 調整ミニゲーム（pull.js の care）は開始時に ensureFlavorLife を呼ぶ。新品へ戻してはいけない。
  const leaf = ensureFlavorLife(resumed);
  assert.deepEqual({ hp: leaf.hp, burn: leaf.burn, dmg: leaf.dmg, steps: leaf.steps },
    { hp: served.hp, burn: served.burn, dmg: served.dmg, steps: served.steps },
    'adjustment must carry the exact wear from serving across SAVE/LOAD, not reset to new');
  assert(leafDamageRatio(leaf) > 0, 'the carried wear still narrows the ideal band in adjustment');

  // 調整でさらに過吸いしても、提供分と二重計上せず、提供の続きから進む。
  const before = leaf.steps;
  applyLeafDamage(leaf, leafDamagePerPull(resumed));
  assert(leaf.steps >= before, 'adjustment wear continues from the served state (no double-count reset)');
}

// 3) 旧セーブ（leaf の記録が無い）は、新品扱いのまま安全に読める。
{
  const old = { mix: { double_apple: 12 } }; // E07 以前のセーブには leaf が無い
  const leaf = ensureFlavorLife(old);
  assert.equal(leaf.hp, LEAF_MAX, 'a save without wear is treated as a full, new flavor');
  assert.equal(leaf.dmg, 0, 'no phantom wear is invented for old saves');
  assert.equal(leaf.steps, 0, 'old saves start from zero burn steps');
}

// 4) #1106 以前の部分的な葉（dmg/steps 無し）も、hp/burn を保ったまま壊さず読める。
{
  const legacy = { leaf: { hp: 3, max: LEAF_MAX, burn: 1 } };
  const leaf = ensureFlavorLife(legacy);
  assert.equal(leaf.hp, 3, 'a partially-worn legacy leaf keeps its remaining hp');
  assert.equal(leaf.burn, 1, 'the legacy burn stage is preserved');
  assert.equal(leaf.dmg, 0, 'missing damage record is read as none (safe as new for difficulty)');
  assert(LEAF_FAIL_STEPS > 0);
}

console.log('PASS: E07 flavor wear is session-owned, carries steam/serve -> adjustment across SAVE/LOAD, and old saves stay safe');
