import test from 'node:test';
import assert from 'node:assert/strict';
import { purchasePlannedFlavor } from './playthrough-shopping.mjs';

function fixture(failure) {
  const state = { screen: 'shop', day: 10, slot: 1, quantity: 0, stock: 0, owned: false, money: 5000, price: 1200 };
  const plan = { planIdx: 20, pendingShopBuy: 'lemon' };
  const events = [];
  const options = {
    id: plan.pendingShopBuy, read: async () => ({ ...state }), trace: e => events.push(e),
    consume: () => { plan.planIdx++; plan.pendingShopBuy = null; },
    click: async sel => {
      if (failure === sel) return false;
      if (sel.includes('buy-')) state.quantity++;
      if (sel.includes('checkout')) {
        if (failure === 'screen') { state.screen = 'map'; return true; }
        if (failure === 'noop') return true;
        state.stock += 50; state.money -= state.price; state.owned = true; state.quantity = 0;
        if (failure === 'wrong-payment') state.money++;
      }
      return true;
    },
  };
  return { state, plan, events, options };
}

for (const failure of ['.shop-tab[data-tab="flavor"]', '[data-test="buy-lemon"]', '[data-test="shop-checkout"]', 'screen', 'noop', 'wrong-payment']) {
  test(`preserves purchase plan and reports incomplete: ${failure}`, async () => {
    const f = fixture(failure);
    await assert.rejects(purchasePlannedFlavor(f.options), /Shopping incomplete/);
    assert.deepEqual(f.plan, { planIdx: 20, pendingShopBuy: 'lemon' });
    assert.ok(!f.events.some(e => e.completed));
    assert.ok(f.events.length <= 3, 'no unbounded retries');
  });
}
test('consumes exactly once after observed stock/payment/ownership/empty-cart success', async () => {
  const f = fixture();
  await purchasePlannedFlavor(f.options);
  assert.deepEqual(f.plan, { planIdx: 21, pendingShopBuy: null });
  assert.equal(f.state.stock, 50);
  assert.equal(f.state.money, 3800);
  assert.equal(f.events.filter(e => e.completed).length, 1);
});
test('existing lemon from a lottery is not mistaken for the planned purchase', async () => {
  const f = fixture('noop');
  f.state.stock = 50; f.state.owned = true;
  await assert.rejects(purchasePlannedFlavor(f.options), /purchase state mismatch/);
  assert.equal(f.plan.pendingShopBuy, 'lemon');
});
test('refuses a preselected cart instead of adding duplicate quantities on re-entry', async () => {
  const f = fixture(); f.state.quantity = 1;
  await assert.rejects(purchasePlannedFlavor(f.options), /invalid starting state/);
  assert.equal(f.events.length, 0);
  assert.equal(f.plan.planIdx, 20);
});
