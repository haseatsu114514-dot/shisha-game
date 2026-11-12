import * as shiftPay from "../js/core/shift-pay.js";
// 店長表示と、出張中のつむぎを接客に二重配置しないこと。画面/音だけ差し替え、tonari本体を実行する。
// node --experimental-vm-modules remake/test/ch5_tonari_manager.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/daily/tonari.js", import.meta.url), "utf8");
const state = { chapter: 5, day: 70, slot: 1, flags: {}, met: { tsumugi: true }, story: {}, visitedDay: {} };
let present = true, screen, order;
const played = [];
const noop = () => {};
const values = {
  ...shiftPay,
  state, config: {}, DB: { dialogues: {} }, SE: { select: noop, cancel: noop },
  el: (tag, attrs = {}, children = []) => Array.isArray(attrs) ? ({ tag, children: attrs }) : ({ tag, ...attrs, children }),
  showScreen: (_id, root) => (screen = root),
  bgUrl: ref => ref, timeOfDay: () => "night", setBg: noop, playBgm: noop,
  tsumugiAtTonari: () => present, hasNewStory: () => false,
  hiyoriAxeReady: () => false, hiyoriAxeAffordable: () => false, axeThrowExposed: () => false,
  modal: async data => { order = data; return 0; },
  play: async scene => { played.push(scene); return {}; },
};
const context = vm.createContext({ console, localStorage: { getItem: () => null } });
const module = new vm.SourceTextModule(`${source}\nexport { serveShiftOrder };`, { context });
const imports = new Map([...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
  .map(([, names, path]) => [path, names.split(",").map(n => n.trim())]));
await module.link(path => {
  const names = imports.get(path);
  return new vm.SyntheticModule(names, function () {
    for (const name of names) this.setExport(name, values[name] ?? noop);
  }, { context });
});
await module.evaluate();
const text = node => node ? [node.text || "", ...(node.children || []).map(text)].join(" ") : "";

// メニューは非同期の選択待ち。表示だけを検査しても状態・行動は変えない。
module.namespace.tonariMenu();
assert.match(text(screen), /店長として店に立つ/);
assert.match(text(screen), /人手に合わせてスミさんが店に立ってくれる/);
assert.match(text(screen), /つむぎが接客/);
assert.doesNotMatch(text(screen), /シフトに入る（バイト）|常連席にはつむぎ/);
present = false;
module.namespace.tonariMenu();
assert.doesNotMatch(text(screen), /つむぎが接客/);
assert.equal(state.slot, 1);

// 出張の枠でつむぎの相談を出さない。戻った枠では既存の相談も選ばれる。
for (let day = 70; day < 90; day++) {
  state.day = day;
  state.flags = {};
  await module.namespace.serveShiftOrder();
  assert.doesNotMatch(order.title + order.body, /つむぎ/);
  assert.match(played.at(-1), /ch5_world_viewer/);
}
present = true;
const seen = new Set();
for (let day = 70; day < 110; day++) {
  state.day = day;
  state.flags = {};
  await module.namespace.serveShiftOrder();
  seen.add(played.at(-1));
}
assert([...seen].some(id => /ch5_tsumugi/.test(id)));
assert([...seen].some(id => /ch5_world_viewer/.test(id)));

// 前章の表示・一般客向けの注文は変更しない。
state.chapter = 1;
state.flags = {};
module.namespace.tonariMenu();
assert.match(text(screen), /シフトに入る（バイト）/);
assert.match(text(screen), /常連席にはつむぎがいる/);
await module.namespace.serveShiftOrder();
assert.doesNotMatch(played.at(-1), /ch5_/);
console.log("ch5 tonari manager: menu, absent/present orders, chapter-one regression passed");

