// node --experimental-vm-modules remake/test/tsumugi_schedule_782.mjs
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import vm from "node:vm";
import path from "node:path";
import { TSUMUGI_STORY, tsumugiAtTonari, tsumugiMessages } from "../js/daily/tsumugi-schedule.js";

const flags = Object.fromEntries(TSUMUGI_STORY.map(step => [step.flag, true]));
const state = { chapter: 1, day: 6, slot: 0, flags: { ...flags }, story: {}, met: {}, contacts: [], inbox: [] };
const baseline = JSON.stringify(state);
assert.equal(tsumugiAtTonari(state), false);
assert.equal(tsumugiAtTonari({ ...state, slot: 1 }), true);
assert.equal(tsumugiAtTonari({ ...state, day: 8 }), true);
assert.equal(tsumugiAtTonari({ ...state, day: 8, slot: 1 }), false);
assert.equal(tsumugiAtTonari({ ...state, day: 8, slot: 1, story: { tsumugi: 4 } }), false);
for (const day of [4, 8, 12]) {
  for (const tsumugi of [0, 3, 4, 5, 6]) {
    const at = { ...state, day, story: { tsumugi } };
    assert.equal(tsumugiAtTonari({ ...at, slot: 0 }), day < 10);
    assert.equal(tsumugiAtTonari({ ...at, slot: 1 }), day >= 10);
  }
}
assert.equal(tsumugiAtTonari({ ...state, slot: 2 }), false);
for (const step of TSUMUGI_STORY) {
  for (const slot of [0, 1]) assert.equal(tsumugiAtTonari({ ...state, day: step.day, slot }), false);
}
// 延期未読・実際に補完した当日は通常遭遇なし。次の通常夜には復帰する。
const deferred = { ...flags, _tsumugi_contest_progress: false };
assert.equal(tsumugiAtTonari({ ...state, day: 4, flags: deferred }), false);
assert.equal(tsumugiAtTonari({ ...state, flags: { ...flags, _tsumugi_story_day: "1:6" }, slot: 1 }), false);
assert.equal(tsumugiAtTonari({ ...state, day: 7, flags: { ...flags, _tsumugi_story_day: "1:6" }, slot: 1 }), true);
assert.equal(tsumugiAtTonari({ ...state, chapter: 2, slot: 1, flags: {} }), true);
assert.equal(JSON.stringify(state), baseline, "在店照会が状態を書き換えた");

const friends = JSON.parse(await fs.readFile(new URL("../data/friends.json", import.meta.url), "utf8"));
for (const [index, day] of [5, 10].entries()) {
  const messages = tsumugiMessages({ ...state, day }, friends);
  assert.equal(messages.length, 1);
  assert.equal(messages[0].trigger_day, day);
  assert.deepEqual(messages[0].messages, friends.friends.tsumugi.chats[index].m);
  assert.equal(tsumugiMessages({ ...state, day, inbox: [{ day: day - 1, chapter: 1, msg: { sender: "tsumugi" } }] }, friends).length, 0);
  assert.equal(tsumugiMessages({ ...state, day, inbox: [{ day, chapter: 1, msg: { sender: "tsumugi" } }] }, friends).length, 0);
}
assert.deepEqual(tsumugiMessages({ ...state, chapter: 2, day: 5 }, friends), []);
assert.deepEqual(tsumugiMessages({ ...state, day: 8 }, friends), []);

// 本番固定runnerを実行し、既読・一度きり・旧セーブ補完を確認。
const plays = [], saves = [];
const context = vm.createContext({ console });
const scheduleSource = await fs.readFile(new URL("../js/daily/tsumugi-schedule.js", import.meta.url), "utf8");
const schedule = new vm.SourceTextModule(scheduleSource, { context });
await schedule.link(() => { throw Error("Unexpected schedule import"); });
await schedule.evaluate();
const mocks = {
  "state.js": { state, save: () => saves.push(JSON.stringify(state)) },
  "stats.js": { ensureAffinityLevel: () => 0 },
  "engine.js": { play: async id => plays.push(id), hooks: {}, dialogueSequence: async run => run() },
  "data.js": { DB: {}, cgUrl() {} },
  "util.js": { el() {} },
  "ui.js": { layers: {}, imageReady() {} },
  "scene-motions.js": { sketchIn() {} },
  "spots.js": { hasContact: () => true },
};
const story = new vm.SourceTextModule(await fs.readFile(new URL("../js/chapters/tsumugi-story.js", import.meta.url), "utf8"), { context });
await story.link(specifier => {
  const name = specifier.split("/").at(-1);
  if (name === "tsumugi-schedule.js") return schedule;
  const values = mocks[name];
  assert(values, `Unexpected import: ${specifier}`);
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [key, value] of Object.entries(values)) this.setExport(key, value);
  }, { context });
});
await story.evaluate();
state.flags = {}; state.day = 4;
await story.namespace.playTsumugiStory(3, { deferFlags: ["_tsumugi_contest_progress"] });
assert.deepEqual(plays, ["ch1_tsumugi_research"]);
assert.equal(state.flags._tsumugi_contest_progress, undefined);
await story.namespace.playTsumugiStory(3);
assert.deepEqual(plays, ["ch1_tsumugi_research", "ch1_tsumugi_work_in_progress"]);
assert.equal(state.flags._tsumugi_story_day, "1:4");
assert.equal(tsumugiAtTonari(state), false);
state.day = 11;
await story.namespace.playTsumugiStory(11);
state.day = 13;
await story.namespace.playTsumugiStory(13);
const saved = JSON.stringify(state);
await story.namespace.playTsumugiStory(13);
assert.deepEqual(plays, TSUMUGI_STORY.map(step => step.dialogue));
assert.equal(JSON.stringify(state), saved);
assert.equal(saves.length, 4);
console.log("[782] 昼夜/固定日/延期/旧セーブ/一度きり/既存文の配信候補: PASS");

// #1901: 実際のメニュー・hasNewStory・在店判定を通す。表示用の照会は保存も報酬も進めない。
{
  const menuState = { chapter: 1, day: 6, slot: 1, flags: { ...flags }, met: {}, story: {},
    affinity: { tsumugi: 100 }, visitedDay: {}, lovers: [] };
  const menuContext = vm.createContext({ console });
  let screen;
  const noop = () => {};
  const ports = {
    state: menuState, config: {}, DB: { dialogues: {}, flavorById: {} },
    timeOfDay: () => menuState.slot === 0 ? "day" : "night", bgUrl: () => "background",
    setBg: noop, playBgm: noop, retire: noop, SE: { select: noop, cancel: noop },
    el: (selector, attrs, children) => Array.isArray(attrs)
      ? { selector, attrs: {}, children: attrs.filter(Boolean) }
      : { selector, attrs, children: (children || []).filter(Boolean) },
    showScreen: (_id, root) => (screen = root), staffFlavors: () => [],
    hiyoriAxeReady: () => false, questionVisitDue: () => false, finaleAtVisit: () => false,
    setStoryAffinityCap: noop, AFFINITY_RANK_PTS: [0, 17, 34, 51, 68, 85],
  };
  const real = ["daily/tonari.js", "daily/spots.js", "daily/tsumugi-schedule.js", "core/affinity-stages.js"];
  const modules = new Map(), imports = new Map();
  for (const id of real) {
    const source = await fs.readFile(new URL(`../js/${id}`, import.meta.url), "utf8");
    modules.set(id, new vm.SourceTextModule(source, { context: menuContext, identifier: id }));
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(id), match[2]));
      if (real.includes(target)) continue;
      if (!imports.has(target)) imports.set(target, new Set());
      for (const name of match[1].split(",")) imports.get(target).add(name.trim().split(/\s+as\s+/)[0]);
    }
  }
  for (const [id, names] of imports) modules.set(id, new vm.SyntheticModule([...names], function () {
    for (const name of names) this.setExport(name, ports[name] ?? (() => { throw Error(`Unexpected port: ${id}:${name}`); }));
  }, { context: menuContext }));
  const menu = modules.get("daily/tonari.js");
  await menu.link((specifier, ref) => modules.get(path.posix.normalize(path.posix.join(path.posix.dirname(ref.identifier), specifier))));
  await menu.evaluate();
  const flatten = node => [node, ...(node.children || []).flatMap(flatten)];
  async function inspect({ sumi = false, tsumugi = false, night = false, known = false, choose = null } = {}) {
    const before = JSON.stringify(menuState);
    const pending = menu.namespace.tonariMenu();
    const nodes = flatten(screen);
    const button = test => nodes.find(node => node.attrs?.dataset?.test === test);
    const desc = test => button(test).children.find(node => node.selector === "small").attrs.text;
    assert.equal(desc("tonari-baito").includes("新しい話"), sumi);
    assert.equal(desc("tonari-customer").includes("新しい話"), tsumugi);
    assert.equal(desc("tonari-baito").includes("夜のシフト後"), night);
    assert.equal(desc("tonari-customer").includes("つむぎ"), known);
    assert(!desc("tonari-practice").includes("新しい話"));
    button(choose ? `tonari-${choose}` : "sub-back").attrs.onclick();
    assert.equal(await pending, choose);
    assert.equal(JSON.stringify(menuState), before, "メニュー表示・選択で進行や報酬を変更しない");
  }
  await inspect({ sumi: true, tsumugi: true, night: true, choose: "customer" });
  menuState.met.tsumugi = true;
  await inspect({ sumi: true, tsumugi: true, night: true, known: true, choose: "baito" });
  menuState.visitedDay = { tonari_customer: 6, tonari_baito: 6 };
  await inspect({ known: true });
  menuState.visitedDay = {}; menuState.slot = 0;
  await inspect({ sumi: true }); // 昼でも読める序盤のスミ会話
  menuState.story.sumi = 2;
  await inspect(); // スミ3本目は夜限定、つむぎも不在
  menuState.slot = 1;
  await inspect({ sumi: true, tsumugi: true, night: true, known: true });
  menuState.story = { sumi: 6, tsumugi: 6 };
  await inspect({ known: true }); // 既読済み
  menuState.story = {}; menuState.day = 8; menuState.slot = 0;
  await inspect({ sumi: true, tsumugi: true, known: true }); // 昼在店日
  menuState.flags._tsumugi_contest_progress = false;
  await inspect({ sumi: true }); // 延期された固定イベントが先
  menuState.flags = { ...flags }; menuState.day = 11; menuState.slot = 1;
  await inspect({ sumi: true, night: true }); // 固定イベント日は通常在店なし
  console.log("[1901] tonariの印: 昼夜・在店・未面識・既読・利用済み・無変更・選択先 PASS");
}
