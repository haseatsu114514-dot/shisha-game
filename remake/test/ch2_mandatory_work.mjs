// DAY3の質問とDAY6の分担は、選択・実作業・本編読了を混同しない。
// 既存ch2_night_pacingからも実行する。node --experimental-vm-modules remake/test/ch2_mandatory_work.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = file => fs.readFileSync(new URL(file, root), "utf8");
const dialogues = Object.fromEntries(["ch2_isolation", "ch2_main", "ch2_ageha_story", "remake_ch2", "ch2_choice_echoes"]
  .flatMap(file => JSON.parse(read(`data/dialogue/${file}.json`)).dialogues).map(scene => [scene.dialogue_id, scene]));
const WORK_SCENES = new Set(["ch2_naru_warm", "ch2_naru_confrontation", "ch2_coal_together", "ch2_lingering_smell", "ch2_sumi_silence"]);
const START = 15, abs = day => START + day - 1;
const plain = value => JSON.parse(JSON.stringify(value));
const context = vm.createContext({});
let state, played, shown, chosen, branches, selection, interruption;
const statePort = new vm.SyntheticModule(["state", "save", "markMet"], function () {
  this.setExport("state", state);
  this.setExport("save", () => {});
  this.setExport("markMet", id => { state.met[id] = true; });
}, { context });
const fixed = values => new vm.SyntheticModule(Object.keys(values), function () {
  for (const [key, value] of Object.entries(values)) this.setExport(key, value);
}, { context });

// The production night runner controls completion. This small VN port interprets the
// unchanged engine's branch/flag contract against the actual JSON, including cancellation.
async function play(id) {
  played.push(id);
  if (interruption?.id === id && interruption.atStart) return { cancelled: true };
  if (!WORK_SCENES.has(id)) return { id };
  const scene = dialogues[id], queue = [...scene.lines];
  const enter = key => {
    if (!key) return;
    assert(scene.branches?.[key], `${id}: unresolved branch ${key}`);
    branches.push([id, key]); queue.unshift(...scene.branches[key]);
  };
  while (queue.length) {
    const line = queue.shift();
    if (line.type === "condition") {
      assert.equal(line.condition_type, "flag");
      enter(state.flags[line.flag] ? line.next_true : line.next_false);
    } else if (line.type === "choice") {
      if (interruption?.id === id && interruption.beforeChoice) return { cancelled: true };
      const index = selection[line.id] ?? 0;
      assert(line.choices[index], `${id}: invalid selection ${index}`);
      chosen.push([id, line.id, index]); enter(line.choices[index].next);
    } else if (line.type === "set_flag") {
      state.flags[line.flag] = true;
      if (interruption?.id === id && interruption.afterFlag === line.flag) {
        if (interruption.replaceOwner) {
          state = fresh(); statePort.setExport("state", state);
        }
        return { cancelled: true };
      }
    } else {
      assert(!line.type || line.type === "hide_portrait", `${id}: unexpected effect ${line.type}`);
      if (line.text) shown.push([id, line.text]);
    }
  }
  return { id };
}

const modules = new Map([
  ["remake/js/core/state.js", statePort],
  ["remake/js/core/data.js", fixed({ DB: { dialogues }, bgUrl: id => id })],
  ["remake/js/core/ui.js", fixed({ imageReady: async () => true, setBg: async () => {} })],
  ["remake/js/vn/engine.js", fixed({ play })],
  ["remake/js/chapters/ch2-city-data.js", fixed({ MAP: { night: "night" }, ROOMS: {} })],
  ["remake/js/chapters/ch2-strawberry-trial.js", fixed({ grantStrawberrySample: () => {} })],
  ["remake/js/chapters/ch2-lime.js", fixed({ recordSentLime: () => false })],
  ["remake/js/core/affinity-stages.js", fixed({ AGEHA_AFFINITY_VISITS: [] })],
  ["remake/js/core/city-locations.js", fixed({ CITY_BACKGROUNDS: { c_station_night: "c" }, CH2_SCENE_BACKGROUNDS: {} })],
  ["remake/js/core/rules.js", fixed({ TOURNAMENT_DAY: 14 })],
  ["remake/js/core/chapter-clock.js", fixed({ chapterDay: s => s.day - START + 1, atChapterFinalDay: s => s.day - START + 1 >= 14 })],
]);
async function moduleAt(file) {
  if (modules.has(file)) return modules.get(file);
  assert(["remake/js/chapters/ch2-story.js", "remake/js/chapters/ch2-story-data.js", "remake/js/daily/night-events.js"].includes(file), file);
  const mod = new vm.SourceTextModule(read(file), { context, identifier: file });
  modules.set(file, mod);
  await mod.link(spec => moduleAt(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec))));
  return mod;
}
const story = await moduleAt("remake/js/chapters/ch2-story.js"); await story.evaluate();
const nights = await moduleAt("remake/js/daily/night-events.js"); await nights.evaluate();
const { CH2_NIGHTS, CH2_FREE_NIGHTS } = (await moduleAt("remake/js/chapters/ch2-story-data.js")).namespace;
function fresh(flags = {}) {
  return { chapter: 2, phase: "daily", day: abs(3), slot: 2, money: 0, stamina: 0,
    stats: { technique: 11, sense: 12, guts: 13, charm: 14, insight: 15 },
    affinity: {}, inventory: {}, lovers: [], met: {}, contacts: [], deferredNightEvents: [],
    flags: { _ch2_day1: { startDay: START }, _ch2_taste_distant: true, ...flags } };
}
function reset(flags = {}) {
  state = fresh(flags); statePort.setExport("state", state);
  played = []; shown = []; chosen = []; branches = []; selection = {}; interruption = null;
}
function reload() {
  state = plain(state); statePort.setExport("state", state);
}
function resources() {
  return plain({ money: state.money, stamina: state.stamina, stats: state.stats,
    affinity: state.affinity, inventory: state.inventory, lovers: state.lovers,
    tasteDistant: state.flags._ch2_taste_distant });
}
async function run(day) {
  state.day = abs(day);
  await story.namespace.chapterTwoNights(START)[abs(day)].run();
}
const words = id => shown.filter(([scene]) => scene === id).map(([, text]) => text).join("\n");
const flavorMemory = /最後まで軽く吸えるバニラ/;
const customerMemory = /祝いの夜に聞いた注文/;
const coalMemory = /俺が炭を確認し/;
const plateMemory = /俺は金属の皿を構える/;

// Both normal questions lead to an actual shared cup, no score/reward, and only their
// own later memory. The DAY11 response remains a completely independent choice.
for (const index of [0, 1]) {
  reset(); selection.ch2_naru_warm_question = index;
  const before = resources();
  await run(3);
  const questionFlag = index ? "_ch2_naru_warm_customers" : "_ch2_naru_warm_flavor";
  const otherFlag = index ? "_ch2_naru_warm_flavor" : "_ch2_naru_warm_customers";
  assert(state.flags[questionFlag] && !state.flags[otherFlag]);
  assert(state.flags._ch2_read_ch2_naru_warm && state.flags._ch2_naru_warm_done);
  assert(!state.flags._ch2_naru_listened && !state.flags._ch2_naru_hurt, "DAY3 cannot choose the DAY11 answer");
  assert.match(words("ch2_naru_warm"), /葉をほぐす[\s\S]*炭を置き[\s\S]*吸い出した[\s\S]*同じ客席/);
  reload(); await run(3);
  assert.equal(played.filter(id => id === "ch2_naru_warm").length, 1, "completed cup does not replay after SAVE/LOAD");
  selection.ch2_naru_response = 1 - index;
  await run(11);
  assert.match(words("ch2_naru_confrontation"), index ? customerMemory : flavorMemory);
  assert.doesNotMatch(words("ch2_naru_confrontation"), index ? flavorMemory : customerMemory);
  assert.equal(!!state.flags._ch2_naru_hurt, index === 0);
  assert.equal(!!state.flags._ch2_naru_listened, index === 1);
  assert.deepEqual(resources(), before, "mandatory dialogue does not spend/award money, stamina, leaves, stats, relationships or cure taste");
}

// Whichever role is chosen, Hajime asks for help, both people do the work, and the
// DAY10 echo returns exactly that role without demanding a second choice.
for (const index of [0, 1]) {
  reset({ _ch2_read_ch2_sofa_burn: true }); selection.ch2_coal_shared_role = index;
  const before = resources();
  await run(6);
  assert(state.flags[index ? "_ch2_coal_role_plate" : "_ch2_coal_role_coals"]);
  assert(!state.flags[index ? "_ch2_coal_role_coals" : "_ch2_coal_role_plate"]);
  assert(state.flags._ch2_read_ch2_coal_together && state.flags._ch2_read_ch2_lingering_smell && state.flags._ch2_night_6_done);
  assert.match(words("ch2_coal_together"), index ? /俺は金属の皿を持ち[\s\S]*皿を止める/ : /コンロの炭を一つずつ返す[\s\S]*トングで炭を持ち上げた/);
  assert.match(words("ch2_lingering_smell"), /二人分をよそった[\s\S]*夕飯[\s\S]*焦げた革/);
  reload(); await run(6); await run(10);
  assert.equal(played.filter(id => id === "ch2_coal_together").length, 1);
  assert.equal(chosen.filter(([, id]) => id === "ch2_coal_shared_role").length, 1);
  assert.match(words("ch2_sumi_silence"), index ? plateMemory : coalMemory);
  assert.doesNotMatch(words("ch2_sumi_silence"), index ? coalMemory : plateMemory);
  assert.deepEqual(resources(), before);
}

// A choice flag is not completion. If saving/cancelling after the choice but before
// the work, no later scene pretends it finished. Resuming uses the same chosen branch.
for (const [day, id, choice, flag, later, match, doneFlag] of [
  [3, "ch2_naru_warm", "ch2_naru_warm_question", "_ch2_naru_warm_customers", 11, customerMemory, "_ch2_naru_warm_done"],
  [6, "ch2_coal_together", "ch2_coal_shared_role", "_ch2_coal_role_plate", 10, plateMemory, "_ch2_night_6_done"],
]) {
  reset({ _ch2_read_ch2_sofa_burn: true }); selection[choice] = 1;
  interruption = { id, afterFlag: flag };
  await assert.rejects(run(day), /未読の場面/);
  assert(state.flags[flag] && !state.flags[`_ch2_read_${id}`] && !state.flags[doneFlag]);
  const interruptedSave = plain(state);
  interruption = null; await run(later);
  assert.doesNotMatch(words(later === 11 ? "ch2_naru_confrontation" : "ch2_sumi_silence"), match, "pending work has no later memory");
  state = interruptedSave; statePort.setExport("state", state); reload();
  chosen = []; shown = []; selection[choice] = 0;
  await run(day);
  assert.deepEqual(chosen, [], "LOAD keeps the actual earlier choice instead of inventing a different one");
  assert(state.flags[`_ch2_read_${id}`] && state.flags[doneFlag]);
  await run(later);
  assert.match(words(later === 11 ? "ch2_naru_confrontation" : "ch2_sumi_silence"), match);
}

// Cancellation before choosing invents neither role nor question. Replacing the
// owner by LOAD cannot attach a stale work completion to the new save.
for (const [day, id, choice, flag] of [
  [3, "ch2_naru_warm", "ch2_naru_warm_question", "_ch2_naru_warm_flavor"],
  [6, "ch2_coal_together", "ch2_coal_shared_role", "_ch2_coal_role_coals"],
]) {
  reset(); interruption = { id, beforeChoice: true };
  await assert.rejects(run(day));
  assert(!state.flags[flag] && !state.flags[`_ch2_read_${id}`]);
  reset(); interruption = { id, afterFlag: flag, replaceOwner: true }; selection[choice] = 0;
  const owner = state;
  await assert.rejects(run(day));
  assert(owner.flags[flag] && !owner.flags[`_ch2_read_${id}`]);
  assert(!state.flags[flag] && !state.flags[`_ch2_read_${id}`]);
}

// Coal work is its own completed checkpoint. Cancelling the following cleanup
// scene resumes cleanup, not the already provided cup or the role question.
reset(); selection.ch2_coal_shared_role = 1;
interruption = { id: "ch2_lingering_smell", atStart: true };
await assert.rejects(run(6));
assert(state.flags._ch2_read_ch2_coal_together && !state.flags._ch2_night_6_done);
reload(); interruption = null; await run(6);
assert.equal(played.filter(id => id === "ch2_coal_together").length, 1);
assert.equal(chosen.filter(([, id]) => id === "ch2_coal_shared_role").length, 1);

// An old completed save has neither newly invented memories nor inserted replays.
for (const flags of [{}, { _ch2_read_ch2_naru_warm: true, _ch2_read_ch2_coal_together: true },
  { _ch2_naru_warm_flavor: true, _ch2_coal_role_coals: true }]) {
  reset(flags); await run(10); await run(11);
  assert.doesNotMatch(words("ch2_naru_confrontation"), flavorMemory);
  assert.doesNotMatch(words("ch2_naru_confrontation"), customerMemory);
  assert.doesNotMatch(words("ch2_sumi_silence"), coalMemory);
  assert.doesNotMatch(words("ch2_sumi_silence"), plateMemory);
}
reset({ _ch2_naru_warm_done: true, _ch2_night_6_done: true });
for (const day of [3, 6]) {
  state.day = abs(day);
  const events = story.namespace.chapterTwoNights(START);
  await nights.namespace.runNightPlan(events, async () => {});
}
assert.deepEqual(played, [], "a completed old night is not reopened to insert new work");
assert.deepEqual([...CH2_FREE_NIGHTS], [2, 8]);
assert(!CH2_NIGHTS.some(night => [2, 8].includes(night.day)));
const day6 = CH2_NIGHTS.find(night => night.day === 6);
assert.equal(day6.schedule, "preparation"); assert.equal(day6.deadline, 7);
assert.deepEqual([...day6.prerequisites], ["_ch2_read_ch2_sofa_burn"]);

console.log("ch2_mandatory_work: PASS reciprocal cup, both roles, actual-choice echoes, interruption/LOAD, legacy saves, no costs/rewards/cure");
