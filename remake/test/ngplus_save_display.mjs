// node remake/test/ngplus_save_display.mjs
// NG+ U9（Issue #1228 / 設計 §3.6・§8.3）: セーブ枠とステータス見出しの周回表示、
// および手動セーブ時の別周回上書き確認に添える注意文の判定。
// 表示は生データを相手にするため、ここでは移行・保存が起きないことも確認する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); },
  removeItem: (k) => { store.delete(k); },
  clear: () => store.clear(),
};
globalThis.sessionStorage ??= globalThis.localStorage;

const { slotCycle, slotCycleId, cycleBadgeText, overwriteCycleNote } = await import("../js/core/cycle-display.js");
const { newState } = await import("../js/core/state.js");

const copy = (v) => JSON.parse(JSON.stringify(v));

// ---------------------------------------------------------------- 表示（cycleBadgeText）
// 1周目は従来表示のまま（何も出さない）
assert.equal(cycleBadgeText({ cycle: 1, cycleId: "a" }), null);
// cycle 欠損の旧セーブは1周目として扱い、周回数を出さない
assert.equal(cycleBadgeText({ cycleId: "a" }), null);
assert.equal(cycleBadgeText({}), null);
// 空枠・壊れた値でも例外なく null
assert.equal(cycleBadgeText(null), null);
assert.equal(cycleBadgeText(undefined), null);
assert.equal(cycleBadgeText({ cycle: 0 }), null);
assert.equal(cycleBadgeText({ cycle: -2 }), null);
assert.equal(cycleBadgeText({ cycle: 2.5 }), null);
assert.equal(cycleBadgeText({ cycle: "2" }), null);
// 2周目以降は「N周目」。2桁もそのまま出す（丸めない）
assert.equal(cycleBadgeText({ cycle: 2, cycleId: "b" }), "2周目");
assert.equal(cycleBadgeText({ cycle: 12, cycleId: "c" }), "12周目");

// 現行の newState でも判定できる
{
  const s = newState();
  assert.equal(cycleBadgeText(s), null); // 1周目
  s.cycle = 3;
  assert.equal(cycleBadgeText(s), "3周目");
}

// ---------------------------------------------------------------- 値の取り出し
assert.equal(slotCycle({ cycle: 1 }), 1);
assert.equal(slotCycle({ cycle: 2 }), 2);
assert.equal(slotCycle({}), null);
assert.equal(slotCycleId({ cycleId: "x" }), "x");
assert.equal(slotCycleId({ cycleId: "" }), null);
assert.equal(slotCycleId({ cycleId: 42 }), null);
assert.equal(slotCycleId({}), null);

// ---------------------------------------------------------------- 上書き注意文（overwriteCycleNote）
const current = { cycle: 2, cycleId: "run-B" };
// 同じ cycleId なら従来の確認のまま（注意文なし）
assert.equal(overwriteCycleNote({ cycle: 2, cycleId: "run-B" }, current), null);
// 同じ周回数でも cycleId が異なれば別周回として警告し、保存先の周回数を出す
assert.equal(overwriteCycleNote({ cycle: 2, cycleId: "run-A" }, current), "別の周回（2周目）のセーブを上書きします。");
assert.equal(overwriteCycleNote({ cycle: 1, cycleId: "run-A" }, current), "別の周回（1周目）のセーブを上書きします。");
// 保存先の cycle が読めなくても、ID が異なれば別周回として警告する（周回数は出さない）
assert.equal(overwriteCycleNote({ cycleId: "run-A" }, current), "別の周回のセーブを上書きします。");
// cycleId のない旧枠は同一周回と断定せず、旧セーブである旨を添える
assert.equal(overwriteCycleNote({ cycle: 1 }, current), "この枠は周回IDのない旧セーブです。");
assert.equal(overwriteCycleNote({}, current), "この枠は周回IDのない旧セーブです。");
// 現在側の ID が判定できない場合は注意文を足さない（通常の state では起きない理論ケース）
assert.equal(overwriteCycleNote({ cycle: 3, cycleId: "run-A" }, {}), null);

// 表示・判定のために入力データを書き換えない（旧枠の閲覧で移行・保存を発生させない）
{
  const legacy = { day: 3, money: 100 };
  const before = copy(legacy);
  cycleBadgeText(legacy);
  overwriteCycleNote(legacy, current);
  assert.deepEqual(legacy, before);
  assert.equal(store.size, 0); // localStorage にも触らない
}

// ---------------------------------------------------------------- 保存済みの心得の盤（#3120）
const { saveGrowthSummary } = await import("../js/core/save-growth-display.js");
const { BOARD_VERSION, MAX_LEVEL } = await import("../js/core/growth.js");
const { BOARD_KEYS, NODES, statCount, statTotal } = await import("../js/core/growth-board.js");
const freeze = value => {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
const saved = freeze({ schema: 27, day: 2, stats: { technique: 10 }, growth: {
  boardVersion: BOARD_VERSION, level: 7, xp: 99999, settledXp: 0,
  hidane: { any: 4, body: 2, sense: 1, wisdom: 3 },
  nodes: ["B1", "B1", "S1", "W1", "BG1", "K01", "missing", "__proto__", null],
  paid: { B1: { any: 1 } }, target: "B2",
} });
const beforeGrowth = JSON.stringify(saved), beforeStorage = [...store];
const summary = saveGrowthSummary(saved, true);
assert.equal(summary.level, 7); // XP から再精算しない
assert.equal(summary.hidane, 10);
assert.equal(summary.hidaneText, "白火 4・紅火 2・蒼火 1・翠火 3");
assert.deepEqual(summary.boards.map(b => [b.name, b.count, b.total]), [
  ["才能", 1, 27], ["感覚", 1, 26], ["理論", 1, 26],
]);
assert.equal(summary.note, null);
assert.equal(saveGrowthSummary(saved, false), null);
for (const value of [null, {}, { growth: null }, { growth: [] }, { growth: "old" }]) {
  assert.equal(saveGrowthSummary(value, true), null);
}
// 版が違う盤の ID を現行として再解釈したり、返金して表示したりしない。
for (const boardVersion of [undefined, BOARD_VERSION - 1, BOARD_VERSION + 1]) {
  const old = freeze({ ...saved, growth: { ...saved.growth, boardVersion } });
  const oldBefore = JSON.stringify(old), view = saveGrowthSummary(old, true);
  assert.equal(view.boards, null);
  assert.match(view.note, /別の版/);
  assert.equal(view.hidane, 10);
  assert.equal(JSON.stringify(old), oldBefore);
}
// 完成した盤も MENU と同じ分母。重複・未知 ID は増やさない。
const full = saveGrowthSummary({ growth: { boardVersion: BOARD_VERSION, level: MAX_LEVEL,
  nodes: [...NODES.map(n => n.id), ...NODES.map(n => n.id), "unknown"] } }, true);
for (const [i, key] of BOARD_KEYS.entries()) {
  assert.equal(full.boards[i].total, statTotal(key));
  assert.equal(full.boards[i].count, statCount(key, new Set(NODES.map(n => n.id))));
}
const malformed = saveGrowthSummary({ growth: { boardVersion: BOARD_VERSION, level: Infinity,
  nodes: {}, hidane: { any: -3, body: "4", sense: Infinity, wisdom: NaN } } }, true);
assert.equal(malformed.level, 1);
assert.equal(malformed.hidane, 0);
assert(malformed.boards.every(b => b.count === 0));
store.set("suien_growth_preview", "0");
assert.equal(saveGrowthSummary(saved), null);
store.delete("suien_growth_preview");
assert.equal(saveGrowthSummary(saved).level, 7);
assert.equal(JSON.stringify(saved), beforeGrowth);
assert.deepEqual([...store], beforeStorage);

// 実際の saves.js を小さなDOMホストで動かす。音とモーダル基盤だけ差し替える。
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.attrs = {}; this.dataset = {}; this.listeners = {};
    this.className = ""; this.style = { setProperty(k, v) { this[k] = v; } };
    this.classList = {
      add: (...names) => { this.className = [...new Set([...this.className.split(" ").filter(Boolean), ...names])].join(" "); },
      remove: (...names) => { this.className = this.className.split(" ").filter(n => !names.includes(n)).join(" "); },
      contains: name => this.className.split(" ").includes(name),
    };
  }
  append(node) { this.children.push(node); }
  replaceChildren(...nodes) { this.children = nodes; }
  setAttribute(key, value) { this.attrs[key] = String(value); }
  addEventListener(key, fn) { this.listeners[key] = fn; }
  set textContent(value) { this.text = String(value); this.children = []; }
  get textContent() { return (this.text || "") + this.children.map(n => n.textContent).join(""); }
  click() { if (!("disabled" in this.attrs)) this.listeners.click?.({}); }
}
globalThis.Node = Element;
globalThis.document = { createElement: tag => new Element(tag), createTextNode: text => {
  const node = new Element("#text"); node.textContent = text; return node;
} };
const modalRoot = new Element("div"), warnings = [];
globalThis.__saveDisplayTest = { layers: { modal: modalRoot }, modal: async () => false,
  toast: message => warnings.push(message), SE: { select() {}, cancel() {}, money() {} } };
const asModule = text => `data:text/javascript;base64,${Buffer.from(text).toString("base64")}`;
const savesUrl = new URL("../js/scenes/saves.js", import.meta.url);
const source = readFileSync(savesUrl, "utf8").replace(/from "([^"]+)"/g, (_, path) => {
  const stub = path === "../core/ui.js" ? "export const {layers,modal,toast}=globalThis.__saveDisplayTest;"
    : path === "../core/audio.js" ? "export const {SE}=globalThis.__saveDisplayTest;" : null;
  return `from ${JSON.stringify(stub ? asModule(stub) : new URL(path, savesUrl).href)}`;
});
const saves = await import(asModule(source));
const core = await import("../js/core/state.js");
const descendants = root => root.children.flatMap(n => [n, ...descendants(n)]);
const byClass = (root, name) => descendants(root).filter(n => n.classList.contains(name));
const row = i => descendants(modalRoot).find(n => n.dataset.test === `slot-${i}`);
const cancel = () => descendants(modalRoot).find(n => n.dataset.test === "slot-cancel").click();
const legacy = { day: 2, stats: { technique: 10 } };
const future = { ...saved, schema: core.SCHEMA + 1 };
for (const [i, slot] of core.SAVE_SLOTS.entries()) store.set(slot.key, JSON.stringify([saved, saved, legacy, future][i]));
const slotSnapshot = [...store], stateSnapshot = JSON.stringify(core.state);
for (const mode of ["title-load", "save", "game-load", "save", "title-load"]) {
  const pending = mode === "save" ? saves.saveFlow() : saves.loadFlow({ inGame: mode === "game-load" });
  for (const i of [0, 1]) {
    assert.match(row(i).textContent, /Lv\.7.*火種 10/);
    assert.deepEqual(byClass(row(i), "ss-stat").map(n => n.children[0].textContent), ["才能 1/27", "感覚 1/26", "理論 1/26"]);
  }
  assert.equal(byClass(row(2), "ss-stat").length, 5);
  assert.equal(byClass(row(2), "ss-growth").length, 0);
  assert.match(row(3).textContent, /新しいバージョンのセーブです/);
  assert.equal(byClass(row(3), "ss-growth").length, 0);
  assert.equal("disabled" in row(0).attrs, mode === "save");
  if (mode !== "save") { row(3).click(); assert.equal(modalRoot.classList.contains("show"), true); }
  assert.deepEqual([...store], slotSnapshot);
  assert.equal(JSON.stringify(core.state), stateSnapshot);
  cancel();
  assert.equal(await pending, mode === "save" ? false : null);
  assert.equal(modalRoot.children.length, 0);
}
assert.equal(warnings.length, 3);
store.set("suien_growth_preview", "0");
const oldMode = saves.loadFlow();
assert.equal(byClass(modalRoot, "ss-growth").length, 0);
assert.equal(byClass(row(0), "ss-stat").length, 5);
cancel(); await oldMode;
store.delete("suien_growth_preview");
delete globalThis.__saveDisplayTest;

console.log("ngplus_save_display: all assertions passed");

