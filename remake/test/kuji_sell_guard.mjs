import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../js/daily/kuji.js", import.meta.url), "utf8");
const match = source.match(/^export function goodsSellRows\(rerender\) \{[\s\S]*?^\}/m);
assert(match, "goodsSellRows source was not found");
const functionSource = match[0].replace(/^export /, "");

function run(mode) {
  const state = {
    goods: [
      { name: "A", sell: 10 },
      { name: "B", sell: 20 },
      { name: "C", sell: 30 },
    ],
  };
  let paid = 0;
  let payments = 0;
  let sounds = 0;
  let renders = 0;
  const context = {
    state,
    el: (tag, value) => Array.isArray(value)
      ? { tag, children: value }
      : { tag, props: value },
    yen: n => n,
    addMoney: n => { paid += n; payments++; },
    SE: { money: () => sounds++ },
  };

  vm.runInNewContext(functionSource, context);
  const rows = context.goodsSellRows(() => renders++);
  const handler = i => rows[i].children[2].props.onclick;

  if (mode === "normal") handler(0)();
  if (mode === "repeat") {
    const old = handler(0);
    old();
    old();
  }
  if (mode === "shift") {
    handler(0)();
    handler(1)();
  }

  return {
    goods: state.goods.map(g => g.name).join(","),
    paid,
    payments,
    sounds,
    renders,
  };
}

const expected = {
  normal: { goods: "B,C", paid: 10, payments: 1, sounds: 1, renders: 1 },
  repeat: { goods: "B,C", paid: 10, payments: 1, sounds: 1, renders: 1 },
  shift: { goods: "C", paid: 30, payments: 2, sounds: 2, renders: 2 },
};

const actual = Object.fromEntries(
  Object.keys(expected).map(mode => [mode, run(mode)])
);
for (const [mode, result] of Object.entries(actual)) {
  console.log(mode, JSON.stringify(result));
  assert.deepEqual(result, expected[mode], mode);
}
console.log("PASS: kuji sell guard");
