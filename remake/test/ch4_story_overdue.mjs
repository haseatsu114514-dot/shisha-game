// 第4章の本筋の夜の取りこぼし防止（#3097・2026-11-20）: 店の手伝い・期限の出会い・なるとの話で送られた本筋の夜は、
// 予定の日を過ぎていれば、その夜の予定の後に続けて読む。一夜に本筋は一本まで。予定の日当日の本筋は従来どおり空いた夜へ。
// 本物の chapters/ch4-dubai-daily.js を vm で読み、本物の ch4-progress.js の判定（chapterFourStoryNightDue）につなぐ。
// node --experimental-vm-modules remake/test/ch4_story_overdue.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { chapterFourProgress, chapterFourStoryNightDue, chapterFourLastNightCall, CH4_STORY_NIGHTS, CH4_PROLOGUE } from "../js/chapters/ch4-progress.js";

const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");

/** remake/js/<rel> を vm で読み、import の名前を overrides（無ければ何もしない関数）につなぐ。 */
async function load(rel, overrides) {
  const source = text(`../js/${rel}`);
  const context = vm.createContext({ console, structuredClone });
  const module = new vm.SourceTextModule(source, { context, identifier: rel });
  const bindings = new Map();
  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    const names = match[1].split(",").map(name => name.trim()).filter(Boolean);
    bindings.set(match[2], [...new Set([...(bindings.get(match[2]) || []), ...names])]);
  }
  const linked = new Map();
  await module.link(specifier => {
    const names = bindings.get(specifier) || [];
    const synthetic = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in overrides ? overrides[name] : () => {});
    }, { context, identifier: specifier });
    linked.set(specifier, synthetic);
    return synthetic;
  });
  await module.evaluate();
  return { ns: module.namespace, setExport: (specifier, name, value) => linked.get(specifier)?.setExport(name, value) };
}

let state;
const played = [];
let staff = null; // { id, finished } 今夜の店の手伝い
const ch4 = await load("chapters/ch4-dubai-daily.js", {
  get state() { return state; }, save() {}, timeOfDay: () => "night", DB: { dialogues: {} }, bgUrl: id => id,
  layers: { hud: { firstElementChild: null } }, setBg: async () => {}, toast() {}, showHud() {},
  modal: async () => "skip", CH4_PLACE_BG: { inn: "bg_inn" }, CH4_SCENE_BG: {}, CH4_DAILY_EVE_DAY: 13, CH4_FREE_SCENE_IDS: [],
  chapterFourProgress, chapterFourStoryNightDue, chapterFourLastNightCall, CH4_SUMI_CALL: "ch4_story_sumi_call",
  syncChapterFourDay() {}, chapterFourSecondAvailable: () => false,
  // 一覧に広げられる定数（この試験では使わない）
  INN_TRIAL_IDS: [], REHEARSAL_IDS: [], CAFE_TASTE_IDS: [], NIGHT_SCENE_IDS: [], STALL_SCENE_IDS: [], LONGLONG_IDS: [],
  LONGLONG_LOAD_IDS: [], CAFE_PLACES: [], CAFE_MENU: [], SMOKED_IN_SCENE: [], TALKS_AFTER_ORDER: [], FESTA_BOND_IDS: [],
  COMPANION_TIME_IDS: [], CH4_TOUR_IDS: [], CAFE_EVENTS: [],
  chapterFourStaffNightEvent: () => staff && !staff.finished ? {
    id: `dubai-staff:${staff.id}`, schedule: "fixed", pin: null, label: "店の手伝い", beat: "夜。店の手伝いへ──",
    done: () => !!staff.finished,
    run: async () => {
      played.push(`staff:${staff.id}`);
      if (staff.interrupt) throw new DOMException("Dubai staff work interrupted", "AbortError");
      staff.finished = true;
    },
  } : null,
});
const io = { readAndCommit: async id => { played.push(id); state.flags._ch4.read[id] = true; return true; } };
const nightEvent = () => Object.values(ch4.ns.chapterFourDubaiDefinition(io).nightEvents)[0] || null;

// 出会い・FESTA・なるとの話は読み終えた状態（この試験は手伝いの夜と本筋の重なりだけを見る）
function at(day, read = []) {
  state = { chapter: 4, day: 47 + day, slot: 2, money: 100000, stamina: 100, phase: "daily",
    flags: { _ch4: { startDay: 48, day, part: "free", stage: CH4_PROLOGUE.length, titleSeen: true,
      firstDay: null, resolution: 0, attempts: 0, routeVersion: 2, read: Object.fromEntries(
      ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_stranger_second", ...read].map(id => [id, true])) },
      _ch4_dubai_talks: { naru: 99 } } };
  ch4.setExport("../core/state.js", "state", state); // 読み込んだモジュールの state も差し替える
  played.length = 0;
}
const stories = CH4_STORY_NIGHTS.map(entry => entry.id);

// 1) 予定の日を過ぎて送られた本筋は、手伝いの後に続けて読む
at(7, stories.slice(0, 1)); // 説明会だけ読んだ DAY7。下見（DAY3）が送られている
staff = { id: "d7" };
{
  const event = nightEvent();
  assert.equal(event.id, "dubai-staff:d7+dubai-story:ch4_story_venue");
  assert.equal(event.beat, "夜。店の手伝いへ──", "The first scene's arrival line stays");
  assert.equal(event.done(), false);
  await event.run();
  assert.deepEqual(played, ["staff:d7", "ch4_story_venue"]);
  assert.equal(event.done(), true);
}

// 2) 一夜に本筋は一本まで（下見・買い出しの両方が遅れていても、今夜は下見だけ）
at(8, stories.slice(0, 1));
staff = { id: "d8" };
await nightEvent().run();
assert.deepEqual(played, ["staff:d8", "ch4_story_venue"]);
assert.equal(chapterFourStoryNightDue(state).id, "ch4_story_market", "The next story waits for the next night");

// 3) 予定の日当日の本筋は重ねない（手伝いの夜は手伝いだけ。本筋は翌晩以降へ）
at(3, stories.slice(0, 1));
staff = { id: "d3" };
{
  const event = nightEvent();
  assert.equal(event.id, "dubai-staff:d3");
  await event.run();
  assert.deepEqual(played, ["staff:d3"]);
}

// 4) 予定が無い夜は、従来どおり本筋だけ
at(5, stories.slice(0, 2));
staff = null;
{
  const event = nightEvent();
  assert.equal(event.id, "dubai-story:ch4_story_market");
  await event.run();
  assert.equal(played[0], "ch4_story_market");
}

// 5) 手伝いが途中で止まった（LOAD・中断）夜は、本筋を読まない
at(9, stories.slice(0, 3));
staff = { id: "d9", interrupt: true };
await assert.rejects(() => nightEvent().run(), { name: "AbortError" });
assert.deepEqual(played, ["staff:d9"]);
assert.equal(state.flags._ch4.read.ch4_story_sumi_call, undefined);

// 6) 本筋をすべて読んだ後は、手伝いの夜は手伝いだけ
at(10, stories);
staff = { id: "d10" };
assert.equal(nightEvent().id, "dubai-staff:d10");

console.log("ch4 story overdue: a displaced story night follows that night's event, one per night, not on its own day, not after an interruption: PASS");
