// Shared by the real browser driver and Node failure-injection regressions.
// One attempt only: a failed input/state check preserves the plan and stops.
export async function enterPlannedShop({ read, click, ready }) {
  const before = await read();
  if (before.screen !== "map") throw new Error("Shop navigation incomplete: not on map");
  // A click can reach the handler before Playwright's response times out. Never
  // repeat it: require the actual destination and unchanged time/resources.
  await click('[data-test="map-go"]');
  await ready();
  const after = await read();
  const resources = s => ({ day: s.day, slot: s.slot, money: s.money, flavorStock: s.flavorStock });
  if (after.screen !== "shop-entry" || JSON.stringify(resources(before)) !== JSON.stringify(resources(after))) {
    throw new Error(`Shop navigation incomplete: ${JSON.stringify({ before: resources(before), after: resources(after), screen: after.screen })}`);
  }
}

export async function purchasePlannedFlavor({ id, read, click, consume, trace = () => {} }) {
  const before = await read(id);
  const fail = reason => { throw new Error(`Shopping incomplete: ${reason}; ${JSON.stringify({ id, before })}`); };
  if (before.screen !== "shop" || before.quantity !== 0 || !(before.price > 0)) fail("invalid starting state");
  for (const sel of ['.shop-tab[data-tab="flavor"]', `[data-test="buy-${id}"]`, '[data-test="shop-checkout"]']) {
    const ok = await click(sel);
    const after = await read(id);
    trace({ id, sel, ok, before, after });
    if (!ok) fail(`input failed: ${sel}`);
    if (after.screen !== "shop" || after.day !== before.day || after.slot !== before.slot) fail("screen/day/slot changed");
    if (sel.includes("buy-") && after.quantity !== 1) fail("quantity selection not applied");
  }
  const after = await read(id);
  if (after.stock !== before.stock + 50 || !after.owned || after.money !== before.money - before.price || after.quantity !== 0)
    fail(`purchase state mismatch: ${JSON.stringify(after)}`);
  consume();
  trace({ id, completed: true, before, after });
}
