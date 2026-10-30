import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/daily/kuji.js", import.meta.url), "utf8");
const match = source.match(/^export function goodsSellRows\(rerender, confirmSale\) \{[\s\S]*?^\}/m);
assert(match, "goodsSellRows source was not found");
const functionSource = match[0].replace(/^export /, "");

function setup() {
  const goods = [{ name: "限定コラボ・ガラスハガル", sell: 6000 }, { name: "B", sell: 20 }, { name: "B", sell: 20 }];
  const state = { goods };
  const result = { paid: 0, payments: 0, sounds: 0, renders: 0, prompts: [] };
  const context = {
    state,
    el: (tag, value) => Array.isArray(value)
      ? { tag, children: value }
      : { tag, props: value, isConnected: true },
    yen: n => n,
    addMoney: n => { result.paid += n; result.payments++; },
    SE: { money: () => result.sounds++ },
  };
  vm.runInNewContext(functionSource, context);
  let decide;
  const rows = context.goodsSellRows(() => result.renders++, (name, price) => {
    result.prompts.push({ name, price });
    return new Promise(resolve => { decide = resolve; });
  });
  return { goods, state, context, result, button: i => rows[i].children[2], decide: ok => decide(ok) };
}

for (const ok of [false, true]) {
  const t = setup();
  const pending = t.button(0).props.onclick();
  assert.equal(t.goods.length, 3, "opening confirmation preserves inventory");
  assert.equal(t.result.paid, 0, "opening confirmation pays nothing");
  assert.deepEqual(t.result.prompts, [{ name: "限定コラボ・ガラスハガル", price: 6000 }]);
  t.decide(ok); await pending;
  assert.equal(t.goods.length, ok ? 2 : 3);
  assert.equal(t.result.paid, ok ? 6000 : 0);
  assert.equal(t.result.payments, Number(ok));
  assert.equal(t.result.sounds, Number(ok));
  assert.equal(t.result.renders, Number(ok));
  if (ok) {
    await t.button(0).props.onclick();
    assert.equal(t.result.payments, 1, "repeated old click cannot pay again");
    assert.equal(t.result.prompts.length, 1);
  }
}
for (const invalidate of [
  t => { t.context.state = { goods: t.goods }; },
  t => { t.state.goods = [...t.goods]; },
  t => { t.button(0).isConnected = false; },
  t => { t.goods.splice(0, 1); },
]) {
  const t = setup();
  const pending = t.button(0).props.onclick();
  invalidate(t); t.decide(true); await pending;
  assert.equal(t.result.payments, 0, "stale confirmation must not pay");
  assert.equal(t.result.renders, 0);
}
const t = setup();
for (const i of [0, 2]) {
  const pending = t.button(i).props.onclick(); t.decide(true); await pending;
}
assert.equal(t.goods.length, 1);
assert.equal(t.goods[0].name, "B", "shifted indices and identical names preserve the other object");
assert.equal(t.result.paid, 6020);
console.log("PASS: kuji sell confirmation, cancellation, identity and stale clicks");
