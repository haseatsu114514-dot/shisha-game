// Real world-tournament runner/state/scoring; controlled UI and individual mini-game input ports.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { newState, setState } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import * as match from "../js/chapters/ch4-tournament-state.js";
globalThis.document = { addEventListener() {} };
const score = await import("../js/craft/score.js");
const verdict = await import("../js/chapters/ch4-verdict.js");
const growth = await import("../js/core/growth.js");
const { maxStamina } = await import("../js/core/stats.js");
const { applyAssistRecovery } = await import("../js/chapters/tournament-resources.js");
const { TOURNAMENT_STORY_STEPS } = await import("../js/craft/tournament-story-data.js");
delete globalThis.document;
const data = file => JSON.parse(fs.readFileSync(new URL(`../../data/${file}.json`, import.meta.url)));
DB.flavorById = Object.fromEntries(data("flavors").flavors.map(row => [row.id, row]));
DB.equipById = Object.fromEntries(data("equipment").equipment.map(row => [row.id, row]));
const source = fs.readFileSync(new URL("../js/chapters/ch4-tournament.js", import.meta.url), "utf8");
const retrySource = fs.readFileSync(new URL("../js/chapters/retry-assist.js", import.meta.url), "utf8");

async function run({ failure = null, abandon = false, invalidate = false, resume = null, ask = true, loadFails = false,
  storyCancel = null, quality = 96, rulesVersion, assistChoice = false, assistInvalidate = false, staffCancel = false } = {}) {
  const value = resume || newState();
  if (!resume) {
    value.chapter = 4; value.phase = "tournament";
    value.flags._ch4_strategy = "sakura";
    value.flags._ch4 = { part: "tournament", read: { ch4_tournament_start: true, ch4_stranger_second: true, ch4_stranger_third: true } };
  }
  setState(value);
  const trace = [], snapshots = [], contexts = [], shown = [];
  let current = true;
  const initial = () => { trace.push(`session-stamina:${value.stamina}`); return { mode: "tournament", chapter: 4, equip: {}, mix: {}, careHistory: [],
    pack: "normal", place: "triangle", steamSeconds: 480, pullDone: false, total: 0 }; };
  const values = { ...match, ...score, ...verdict, ...growth, state: value, CRAFT_STEPS: [],
    maxStamina, applyAssistRecovery,
    CH4_STAFF_IDS: { echo: "ch4_staff_match_echo" },
    readChapterFourStaffCheckpoint: async () => {
      if (staffCancel) { trace.push("staff-echo-cancel"); return false; }
      return true; // 未体験の保存は本物のcheckpointでもそのまま続ける。
    },
    startChapterFourCraft: (value, cs) => {
      const p = match.startChapterFourCraft(value, cs);
      if (rulesVersion !== undefined) p.rulesVersion = rulesVersion;
      return p;
    },
    newSession: initial,
    save: () => snapshots.push(JSON.parse(JSON.stringify(value))),
    openBench: cs => trace.push(`bench:${match.chapterFourMatch(value).step}`),
    waitBenchReady: async () => trace.push("ready"),
    benchRoot: () => ({ querySelector: () => ({ append: () => trace.push("menu") }) }),
    showChapterFourStandings: async p => { trace.push(`standings:${p.voted}`); shown.push(match.chapterFourStandings(p)); },
    retireScreen: () => trace.push("retire"), playBgm() {}, clearComments() {}, block() {},
    play: async dialogue => { trace.push(dialogue.dialogue_id); return {}; },
    modal: async options => { trace.push(options.title);
      if (options.title === "コンティニュー") { if (assistInvalidate) current = false; return assistChoice; }
      return ask;
    },
    // 制作中の掛け合い（#2031）: 台本の読み込みと、既読を制作保存へ書く共通の再生（本物と同じく既読は読まない）。
    TOURNAMENT_STORY_STEPS,
    loadTournamentCraftDialogue: async () => { trace.push("craft-dialogue"); if (loadFails) throw new Error("offline"); },
    playTournamentEvent: async (cs, event, options) => {
      const story = cs.tournamentStory ||= { seen: [] };
      story.seen ||= [];
      if (story.seen.includes(event)) return true;
      trace.push(`story:${event}:${options?.context?.rank ?? "-"}`);
      contexts.push({ event, ...options?.context });
      if (storyCancel === event) return false;
      story.seen.push(event);
      return true;
    },
    stepSetup: async () => trace.push("setup"), stepWater: async () => trace.push("water"),
    stepMix: async cs => { trace.push("mix"); cs.mix = { sakura: 12 }; cs.mixInfo = { total: 12, score: 96, intensity: 5 }; },
    stepPack: async cs => { trace.push("pack"); cs.pack = "normal"; },
    runHoles: async cs => { trace.push("holes"); cs.holes = { score: quality, outerEven: 1, total: 24, minimumComplete: true, innerExcess: 0 }; },
    stepPlace: async cs => { trace.push("place"); cs.place = "triangle"; },
    runHeat: async cs => { trace.push("heat"); cs.heat = { score: quality, heatPower: 85, heatStability: 100, burnRisk: 0, aromaRetention: 100 }; },
    stepSteamTime: async cs => { trace.push("steam-time"); cs.steamSeconds = 480; },
    runSteamDodge: async cs => { trace.push("steam"); cs.steam = { score: 96 }; },
    runPull: async cs => {
      trace.push("pull"); value.stamina -= 4;
      if (invalidate) { current = false; return true; }
      if (abandon) return false;
      cs.pull = { score: quality, temp: .54, pulls: 2 }; cs.pullDone = true;
      if (failure === "pull") cs.failed = "burnt";
      return true;
    },
    runCare: async (cs, { round }) => {
      trace.push(`care${round}`); cs.careHistory[round - 1] = { score: quality, temp: .54, coals: 1 };
      if (failure === `care${round}`) cs.failed = "cold";
    },
  };
  const context = vm.createContext({ console, structuredClone, DOMException });
  // 実際の3敗判定/取消/所有者確認を使い、UIの選択だけを制御する。
  const retry = new vm.SourceTextModule(retrySource, { context });
  await retry.link(() => new vm.SyntheticModule(["modal"], function () { this.setExport("modal", values.modal); }, { context }));
  await retry.evaluate(); values.chooseRetryAssist = retry.namespace.chooseRetryAssist;
  const module = new vm.SourceTextModule(source, { context });
  await module.link(async spec => {
    const names = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
      .filter(row => row[2] === spec).flatMap(row => row[1].split(",").map(name => name.trim()));
    assert(names.every(name => name in values), `Missing controlled port for ${spec}`);
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name]);
    }, { context });
  });
  await module.evaluate();
  let result, error;
  try { result = await module.namespace.runChapterFourCraft({ isCurrent: () => current, menuButton: () => ({}) }); }
  catch (e) { error = e; }
  return { trace, snapshots, value, result, error, contexts, shown };
}
const success = await run();
assert.equal(success.error, undefined);
assert.equal(success.result.win, true);
// DAY9の実体験の回想で中断した時、次の制作へ進まず同じ工程前から再開できる。
{
  const stopped = await run({ staffCancel: true });
  assert.equal(stopped.error, undefined);
  assert.equal(stopped.result, false);
  assert.equal(stopped.value.flags._ch4.match.step, 1);
  assert(stopped.trace.includes("staff-echo-cancel"));
  assert(!stopped.trace.includes("mix"));
  assert.equal(stopped.value.flags._ch4.match.voted, 0);
  const resumed = await run({ resume: stopped.value });
  assert.equal(resumed.error, undefined);
  assert.equal(resumed.result.win, true);
  assert(!resumed.trace.includes("setup"), "A completed setup repeated after the memory interruption");
}
assert.equal(success.value.flags._ch4.match.step, 11);
assert.deepEqual(success.trace.filter(item => ["setup", "water", "mix", "pack", "holes", "place", "heat", "steam-time", "steam", "pull", "care1", "care2"].includes(item)),
  ["setup", "water", "mix", "pack", "holes", "place", "heat", "steam-time", "steam", "pull", "care1", "care2"]);
assert(success.trace.indexOf("pull") < success.trace.indexOf("ch4_customer_1"));
// #2031: 投票が動いた3回（提供・調整1・調整2の前）だけ途中順位を見せ、最後の票は結果画面に任せる。
assert.deepEqual(success.trace.filter(item => String(item).startsWith("standings:")), ["standings:1", "standings:2", "standings:3"]);
assert(success.trace.indexOf("standings:1") < success.trace.indexOf("ch4_customer_1"));
assert(success.trace.indexOf("ch4_customer_1") < success.trace.indexOf("care1"));
assert(success.trace.indexOf("ch4_customer_2") < success.trace.indexOf("care2"));
assert.deepEqual(success.value.flags._ch4.match.craft.customerChecks, [true, true]);
assert.equal(success.result.parts.care1, 96);
assert.equal(success.result.parts.care2, 96);
assert(success.result.parts.shisha > 0);
for (const failure of ["pull", "care1", "care2"]) {
  const failed = await run({ failure });
  assert.equal(failed.error, undefined);
  assert.equal(failed.result.win, false);
  if (failure === "pull") assert(!failed.trace.includes("care1"));
  if (failure === "care1") assert(!failed.trace.includes("care2"));
}
const abandoned = await run({ abandon: true });
assert.equal(abandoned.result, false);
assert.equal(abandoned.value.flags._ch4.match.result, null);
assert.equal(abandoned.value.flags._ch4.match.step, 8);
assert.equal(abandoned.value.stamina, 100, "Uncommitted pull consumption rolls back");
assert(!abandoned.trace.includes("care1"));
const invalidated = await run({ invalidate: true });
assert.equal(invalidated.error?.name, "AbortError");
assert.equal(invalidated.value.flags._ch4.match.result, null);
assert.equal(invalidated.value.flags._ch4.match.step, 8);
assert(!invalidated.trace.includes("care1"));
// Real serialized SAVE taken while pull is pending resumes that step only, not mix/heat or previous votes.
const pendingPull = success.snapshots.find(snapshot => snapshot.flags._ch4.match.step === 8 && snapshot.flags._ch4.match.rollback);
const resumed = await run({ resume: pendingPull });
assert.equal(resumed.error, undefined);
assert.equal(resumed.result.win, true);
assert(!resumed.trace.includes("mix"));
assert(!resumed.trace.includes("heat"));
assert.equal(resumed.value.flags._ch4.match.voted, 4);
// #2031: 制作中の掛け合いは工程の前に一度ずつ。提供後・調整1の後は途中順位→掛け合い→助言→問いの順。
{
  const at = (trace, item) => trace.indexOf(item);
  const story = (trace, event) => trace.findIndex(item => String(item).startsWith(`story:${event}:`));
  const told = trace => trace.filter(item => String(item).startsWith("story:")).map(item => item.split(":")[1]);
  const t = success.trace;
  assert.equal(t[0], "craft-dialogue", "The craft banter loads before any save or step");
  assert.deepEqual(told(t), ["prestart", "opening", "packed", "waiting", "serve", "interlude1", "interlude2", "preresult"]);
  // #3060: 開始前の掛け合いは制作の最初の工程・opening の前。
  assert(story(t, "prestart") < story(t, "opening"));
  // #3060: 提供開始の掛け合いは吸い出しの前、結果発表前の掛け合いは二度目の調整の後・結果の前。
  assert(at(t, "standings:1") < story(t, "serve") && story(t, "serve") < at(t, "pull"));
  assert(story(t, "preresult") > at(t, "care2") && story(t, "preresult") < at(t, "retire"));
  assert(story(t, "opening") < at(t, "setup"));
  assert(at(t, "pack") < story(t, "packed") && story(t, "packed") < at(t, "holes"));
  assert(at(t, "steam-time") < story(t, "waiting") && story(t, "waiting") < at(t, "steam"));
  assert(at(t, "standings:2") < story(t, "interlude1") && story(t, "interlude1") < at(t, "ch4_craft_advice_9"));
  assert(at(t, "ch4_craft_advice_9") < at(t, "ch4_customer_1"));
  assert(at(t, "standings:3") < story(t, "interlude2") && story(t, "interlude2") < at(t, "ch4_customer_2"));
  // 提供後の掛け合いには実際の順位を渡す。版2は炭/調整96だけでは中盤のなるに並ばれる。
  assert(t.includes("story:interlude1:2"));
  assert.deepEqual(success.value.flags._ch4.match.craft.tournamentStory.seen, ["prestart", "opening", "packed", "waiting", "serve", "interlude1", "interlude2", "preresult"]);
  // 保存から再開しても、読んだ掛け合いは繰り返さない。提供で失敗した一台に調整前の掛け合いは出ない。
  assert.deepEqual(told(resumed.trace), ["interlude1", "interlude2", "preresult"]);
  const burnt = await run({ failure: "pull" });
  assert(!told(burnt.trace).some(event => event.startsWith("interlude") || event === "preresult"));
  assert.deepEqual(told((await run({ failure: "care1" })).trace), ["prestart", "opening", "packed", "waiting", "serve", "interlude1"]);
  // 台本が読めなければ、保存と大会の開始地点に触れない（第3章と同じ）。
  const offline = await run({ loadFails: true });
  assert.equal(offline.error?.message, "offline");
  assert.equal(offline.snapshots.length, 0);
  assert.equal(offline.value.flags._ch4.match?.craft ?? null, null);
  // 掛け合いの途中で閉じたら制作を止め、次は読みかけの掛け合いから（読んだ分は保存に残る）。
  const closed = await run({ storyCancel: "packed" });
  assert.equal(closed.result, false);
  assert.equal(closed.value.flags._ch4.match.step, 3);
  assert(!closed.trace.includes("holes"));
  const reopened = await run({ resume: structuredClone(closed.value) });
  assert.equal(reopened.result.win, true);
  assert.deepEqual(told(reopened.trace), ["packed", "waiting", "serve", "interlude1", "interlude2", "preresult"]);
}
// 2026-11-02「なるを強くする」: ふつうの出来の一台では、提供後・調整1回目の票でなるが先頭に立ち、最後の票で逆転する。
// 掛け合いには、直前に見せた途中順位と同じ並び（はじめの順位と先頭）を渡す。強い一台では先頭ははじめのまま。
{
  const average = await run({ quality: 89, rulesVersion: 1 });
  const legacyStrong = await run({ rulesVersion: 1 });
  const currentStrong = await run({ quality: 100 });
  assert(legacyStrong.trace.includes("story:interlude1:1"), "Legacy strong crafts keep the original story context");
  assert.equal(currentStrong.result.win, true);
  assert.equal(average.result.win, true);
  const told = (r, event) => r.contexts.find(row => row.event === event);
  assert.deepEqual(average.shown.map(rows => rows[0].id), ["hajime", "naru", "naru"]);
  for (const r of [average, legacyStrong, success, currentStrong]) for (const [event, index] of [["interlude1", 1], ["interlude2", 2]]) {
    const rows = r.shown[index], me = rows.find(row => row.id === "hajime");
    assert.deepEqual(told(r, event), { event, leader: rows[0].id, rank: me.rank,
      tied: rows[1].points === rows[0].points, level: me.points === rows[0].points }, `${event} is told the standings just shown`);
  }
  // ふつうの一台では、なるは提供後・調整1回目の票の1位を取って、はじめと同じ持ち点に並ぶ（盤の上はその回の出来の差）。
  // 台本には「並んだ」と渡し、単独の先頭とは言わせない。
  assert.deepEqual(average.shown.slice(1).map(rows => rows.slice(0, 2).map(row => `${row.id}:${row.points}`)),
    [["naru:7", "hajime:7"], ["naru:10", "hajime:10"]]);
  assert.equal(told(average, "interlude1").tied, true);
  assert.equal(told(average, "interlude1").level, true);
  assert.equal(told(legacyStrong, "interlude1").leader, "hajime");
  assert.equal(told(legacyStrong, "interlude2").leader, "hajime");
  assert.equal(told(currentStrong, "interlude1").leader, "hajime");
  assert.equal(told(currentStrong, "interlude2").leader, "hajime");
  assert.equal(told(success, "interlude1").leader, "naru", "Current mid-game Naru lead is passed to the story, never a stale fixed rank");
}
const noAsk = await run({ ask: false });
assert.deepEqual(noAsk.value.flags._ch4.match.craft.customerChecks, [false, false]);
assert(!noAsk.trace.includes("ch4_customer_1"));
assert.equal(noAsk.result.total, success.result.total, "Asking is information, not an automatic points bonus");
// 同じ実runnerで、盤モードの結果確定→保存再開→敗北後の再挑戦まで経験値を確認する。
const previewStorage = new Map();
globalThis.localStorage = {getItem:key=>previewStorage.get(key)??null,setItem:(key,value)=>previewStorage.set(key,String(value))};
growth.setGrowthPreview(true);
const grown=await run(); assert.equal(grown.error,undefined);
assert.equal(grown.value.growth.xp,525);assert.equal(grown.value.growth.earned,2);
const grownReload=await run({resume:structuredClone(grown.value)});
assert.equal(grownReload.value.growth.xp,525);assert.equal(grownReload.value.growth.earned,2);
const grownLoss=await run({failure:"pull"});
assert.equal(grownLoss.value.growth.xp,245);assert.equal(grownLoss.value.growth.earned,0);
assert(match.resetChapterFourCraft(grownLoss.value));
const grownRetry=await run({resume:structuredClone(grownLoss.value)});
assert.equal(grownRetry.error,undefined);assert.equal(grownRetry.value.growth.xp,525);
assert(grownRetry.trace.includes("story:opening:1"),"再挑戦は大会の最初からなので、開幕の掛け合いも読み直す");
assert.equal(grownRetry.value.growth.earned,2,"再挑戦は順位の差分だけ。色の火種は完成後に一度");
previewStorage.clear();
// 版2の強化と同時に既存の操作補助を接続。明示的な3敗からだけ、次の一台に適用する。
{
  const failed = newState(); failed.chapter = 4; failed.phase = "tournament"; failed.stamina = 22;
  failed.flags._ch4_strategy = "sakura";
  failed.flags._ch4 = { part: "tournament", read: { ch4_tournament_start: true } };
  match.chapterFourMatch(failed).history = [{ win: false }, { win: false }, { win: false }];
  const yes = await run({ resume: structuredClone(failed), assistChoice: true });
  assert.equal(yes.error, undefined);
  assert.equal(yes.value.flags._ch4.match.craft.retryAssist, true);
  assert(yes.trace.includes("session-stamina:100"), "The accepted one-craft assist recovers stamina before creating its condition snapshot");
  assert.equal(yes.trace.filter(item => item === "コンティニュー").length, 1);
  const no = await run({ resume: structuredClone(failed), assistChoice: false });
  assert.equal(no.value.flags._ch4.match.craft.retryAssist, false);
  assert(no.trace.includes("session-stamina:22"), "Declining assist does not recover stamina");
  const cancelled = await run({ resume: structuredClone(failed), assistChoice: null });
  assert.equal(cancelled.result, false);
  assert.equal(cancelled.value.flags._ch4.match.craft, null);
  assert.equal(cancelled.value.stamina, 22);
  assert.equal(cancelled.snapshots.length, 0, "Cancel does not start or save a new attempt");
  const changed = await run({ resume: structuredClone(failed), assistChoice: true, assistInvalidate: true });
  assert.equal(changed.error?.name, "AbortError");
  assert.equal(changed.value.flags._ch4.match.craft, null);
  assert.equal(changed.value.stamina, 22);
  const pending = yes.snapshots.find(snapshot => snapshot.flags._ch4.match.step === 8 && snapshot.flags._ch4.match.rollback);
  const continued = await run({ resume: pending });
  assert.equal(continued.value.flags._ch4.match.craft.retryAssist, true);
  assert(!continued.trace.includes("コンティニュー"), "SAVE/LOAD keeps the selected assist without asking again mid-craft");
  const unknown = structuredClone(failed); unknown.flags._ch4.match.history = [];
  unknown.flags._ch4.attempts = 99;
  const noInferredLoss = await run({ resume: unknown, assistChoice: true });
  assert.equal(noInferredLoss.value.flags._ch4.match.craft.retryAssist, false);
  assert(!noInferredLoss.trace.includes("コンティニュー"));
}
console.log("PASS: real Chapter 4 runner awaits each craft step, handles failures/abandonment/owner changes and resumes serialized saves");
