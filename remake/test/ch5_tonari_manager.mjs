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
const module = new vm.SourceTextModule(source, { context });
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
const card = () => {
  const find = node => !node ? null : node.dataset?.test === "tonari-baito" ? node : (node.children || []).map(find).find(Boolean) || null;
  return find(screen);
};

// メニューは非同期の選択待ち。表示だけを検査しても状態・行動は変えない。
module.namespace.tonariMenu();
assert.match(text(screen), /店長として店に立つ/);
assert.match(text(screen), /人手に合わせてスミさんが店に立ってくれる/);
assert.match(text(screen), /つむぎが接客/);
assert.doesNotMatch(text(screen), /シフトに入る（バイト）|常連席にはつむぎ/);
// 店長の店番も、昼から夜まで（2コマ・TFL62）。夜からは入れない
assert.match(text(card()), /昼から夜まで、今日の営業を引き受ける（2コマ）/);
assert.match(text(card()), /夜からは入れない/);
assert.equal(card().disabled, true);
present = false;
module.namespace.tonariMenu();
assert.doesNotMatch(text(screen), /つむぎが接客/);
assert.equal(state.slot, 1);
state.slot = 0;
module.namespace.tonariMenu();
assert.equal(!!card().disabled, false, "昼は店番に入れる");
assert.doesNotMatch(text(card()), /夜からは入れない/);

// 前章の表示は変更しない（店番の札は一つだけ。旧バイトの「フロアを任される」は無い・TFL63）。
state.chapter = 1;
state.flags = {};
present = true;
module.namespace.tonariMenu();
assert.match(text(screen), /シフトに入る（バイト）/);
assert.match(text(card()), /【はじめての店番】昼から夜まで、五つの卓を一人で回す（2コマ）/);
assert.match(text(screen), /常連席にはつむぎがいる/);
assert.doesNotMatch(text(screen), /フロアを任される/);
console.log("ch5 tonari manager: manager card (noon to night, closed at night), Tsumugi present/absent, chapter-one card passed");
