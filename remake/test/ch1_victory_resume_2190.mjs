// #2190 final follow-up 1/2/7: real chapter runner, background resolver and SAVE/LOAD.
// VN/phone/DOM/ability ports are controlled; no browser or player's localStorage is used.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { paginate } from "../js/vn/text.js";

const root = fileURLToPath(new URL("../../", import.meta.url));
const copy = value => JSON.parse(JSON.stringify(value));
const read = id => fs.readFileSync(path.join(root, "remake/js", id), "utf8");
const dialogues = Object.fromEntries(["ch1_tournament", "ch1_interval", "ch1_naru"]
  .flatMap(name => JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", `${name}.json`), "utf8")).dialogues)
  .map(dialogue => [dialogue.dialogue_id, dialogue]));
const manifest = JSON.parse(fs.readFileSync(path.join(root, "remake/data/manifest.json"), "utf8"));
const real = new Set(["chapters/ch1.js", "core/state.js", "core/data.js", "core/rules.js", "core/flavor-mastery.js"]);
const SLOT = "suien_remake_slot1";
const startingMoney = 45813;
const prize = 30000;
const sceneNames = ["bg_c_station_lobby", "bg_c_station_lobby", "bg_tonari_inside_night",
  "bg_tonari_inside_night", "bg_tonari_inside_night", "bg_tonari_inside_night",
  "bg_home_day", "kemurikusa", "kemurikusa", "kemurikusa", "bg_tonari_inside_night"];
const sceneUrl = name => `../assets/backgrounds/${name}.png`;

async function harness({ step = 0, paid = true, revealed = true, snapshot = null } = {}) {
  const modules = new Map(), synthetic = new Map(), memory = new Map();
  const events = [], writes = [], money = [], awards = [], cutins = [];
  let core, data, background = "title-background", titlePresent = true;
  const current = () => core.state;
  const memoryStorage = {
    getItem: key => memory.get(key) ?? null,
    setItem: (key, value) => {
      memory.set(key, String(value));
      if (key === "suien_remake_save") writes.push(JSON.parse(value));
    },
    removeItem: key => memory.delete(key),
  };
  const context = vm.createContext({ console, URL, DOMException, setTimeout, clearTimeout,
    localStorage: memoryStorage, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  const observe = (kind, details = {}) => {
    assert.equal(current().day, 14, `${kind}: narrative background changes must not advance the saved day`);
    assert.equal(current().slot, 0, `${kind}: narrative background changes must not advance the action slot`);
    events.push({ kind, step: current().tournament.victory?.step, background, titlePresent, ...details });
  };
  const setBackground = async (url, options = {}) => {
    assert(url, "an actual registered background must resolve before showing the scene");
    background = url;
    observe("background", { tint: options.tint || null });
  };
  const play = async (input, options = {}) => {
    const dialogue = typeof input === "string" ? data.DB.dialogues[input] : input;
    assert(dialogue, "runner must request an existing dialogue");
    const ref = options.bg || dialogue.metadata?.bg;
    if (ref) {
      const scene = data.sceneBg(ref, core.timeOfDay());
      await setBackground(scene.url, { tint: scene.tint });
    }
    observe("dialogue", { id: dialogue.dialogue_id });
    // Interpret only real background control rows. Dialogue choices/rewards are outside this port's scope.
    for (const line of dialogue.lines) if (line.type === "bg") {
      const scene = data.sceneBg(line.bg, core.timeOfDay());
      await setBackground(scene.url, { tint: scene.tint });
    }
    return { id: dialogue.dialogue_id, visited: [dialogue.dialogue_id] };
  };
  const ports = {
    CRAFT_STEPS: [], hooks: {}, emit() {}, recordGalleryProgress() {},
    play, setBg: setBackground,
    clearScreen: () => { titlePresent = false; observe("clear-screen"); },
    showScreen: name => { titlePresent = false; observe("screen", { name }); },
    showHud: value => { assert.equal(value, false); observe("hud-hidden"); },
    playBgm() {}, bannersIdle: async () => {}, finishDeferredNights: async () => {},
    clearContinueHistory: () => observe("continue-history-cleared"),
    addMoney: delta => { money.push(delta); current().money += delta; observe("money", { delta }); },
    gainStat: (stat, amount) => {
      awards.push({ stat, amount }); current().stats[stat] += amount; observe("ability", { stat, amount });
    },
    nagumoCutin: async rank => { cutins.push(rank); observe("cutin", { rank }); },
    openPhone: async (messages, options) => {
      assert.equal(titlePresent, false, "LOAD's title screen must be removed before phone content appears");
      observe("phone", { title: options.title, ids: messages.map(message => message.id) });
      return [];
    },
    el: () => ({ isConnected: true, addEventListener() {}, focus() {} }),
    radar: () => ({}),
  };
  function module(id) {
    if (modules.has(id)) return modules.get(id);
    const result = new vm.SourceTextModule(read(id), { identifier: id, context });
    modules.set(id, result);
    return result;
  }
  async function link(specifier, referencing) {
    const id = path.posix.normalize(path.posix.join(path.posix.dirname(referencing.identifier), specifier));
    if (real.has(id)) return module(id);
    const key = `${referencing.identifier}->${id}`;
    if (synthetic.has(key)) return synthetic.get(key);
    const names = [...read(referencing.identifier).matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["']/g)]
      .filter(match => match[2] === specifier)
      .flatMap(match => match[1].split(",").map(name => name.trim().split(/\s+as\s+/)[0]));
    const exports = [...new Set(names)];
    const result = new vm.SyntheticModule(exports, function () {
      for (const name of exports) this.setExport(name, ports[name] ?? (() => {
        throw new Error(`Unexpected controlled port ${name}`);
      }));
    }, { identifier: key, context });
    synthetic.set(key, result);
    return result;
  }
  const chapter = module("chapters/ch1.js");
  await chapter.link(link);
  await chapter.evaluate();
  core = modules.get("core/state.js").namespace;
  data = modules.get("core/data.js").namespace;
  Object.assign(data.DB, { dialogues, manifest });
  if (snapshot) {
    memory.set(SLOT, JSON.stringify(snapshot));
  } else {
    const state = core.newGame();
    Object.assign(state, { day: 14, slot: 0, phase: "tournament", money: startingMoney + (paid ? prize : 0),
      stamina: 61, flavorStock: { lemon: 17, mint: 29 }, flavors: ["lemon", "mint"],
      affinity: { sumi: 24, tsumugi: 36, naru: 18 },
      tournament: { ...state.tournament, attempts: 5, lastRank: 1,
        victory: { step, paid, revealed, comment: paid ? "保存された講評" : null } } });
    state.flags._ch1_preview_seen = true;
    if (step > 4) state.stats.guts++;
    if (step > 9) state.stats.insight++;
    assert(core.saveToSlot(SLOT));
  }
  const loaded = core.loadFromSlot(SLOT);
  assert(loaded, "real current-schema SAVE must load");
  assert.equal(loaded.schema, core.SCHEMA);
  const before = copy(current());
  events.length = writes.length = 0;
  const run = () => chapter.namespace.resumeGame();
  return { core, current, run, before, events, writes, money, awards, cutins,
    memory, titlePresent: () => titlePresent };
}

const preserved = state => copy({ day: state.day, slot: state.slot, chapter: state.chapter,
  stamina: state.stamina, flavorStock: state.flavorStock, flavors: state.flavors,
  affinity: state.affinity, affinityCarry: state.affinityCarry, loveCarry: state.loveCarry,
  owned: state.owned, equip: state.equip, recipes: state.recipes, keepsakes: state.keepsakes,
  tournament: { attempts: state.tournament.attempts, lastRank: state.tournament.lastRank,
    losses: state.tournament.losses, lastLossAttempt: state.tournament.lastLossAttempt } });

async function checkRun(h) {
  const initial = h.before.tournament.victory;
  await h.run();
  assert.equal(h.current().phase, "cleared");
  assert.equal(h.current().tournament.victory, undefined);
  assert.deepEqual(preserved(h.current()), preserved(h.before));
  assert.equal(h.current().money, startingMoney + prize);
  assert.deepEqual(h.money, initial.paid ? [] : [prize], "prize is paid once only when its saved marker is absent");
  const remaining = [
    ...(initial.step <= 4 ? [{ stat: "guts", amount: 1 }] : []),
    ...(initial.step <= 9 ? [{ stat: "insight", amount: 1 }] : []),
  ];
  assert.deepEqual(h.awards, remaining, "only still-pending chapter ability checkpoints execute");
  assert.deepEqual(copy(h.current().stats), { technique: 10, sense: 10, guts: 11, charm: 10, insight: 11 });
  assert.deepEqual(h.cutins, initial.revealed ? [] : [1]);
  assert.equal(h.events[0].kind, "clear-screen", "remove the title before revealing or restoring any chapter scene");
  for (let step = initial.step; step < sceneNames.length; step++) {
    const events = h.events.filter(event => event.step === step && !["clear-screen", "hud-hidden", "continue-history-cleared", "money", "cutin"].includes(event.kind));
    const restored = events.find(event => event.kind === "background" && event.background === sceneUrl(sceneNames[step]));
    assert(restored, `saved victory step ${step} must establish its canonical background`);
    const visible = events.filter(event => ["dialogue", "phone", "ability"].includes(event.kind) && event.id !== "ch1_tournament_reveal");
    assert(visible.length, `saved victory step ${step} must execute its existing content`);
    for (const event of visible) {
      assert.equal(event.background, sceneUrl(sceneNames[step]), `step ${step}: content must use its own location and time`);
      assert.equal(event.titlePresent, false, `step ${step}: no title behind chapter content`);
    }
    assert(h.events.indexOf(restored) < h.events.indexOf(visible[0]), `step ${step}: establish background before content`);
  }
  const savedSteps = h.writes.filter(saved => saved.tournament.victory).map(saved => saved.tournament.victory.step);
  assert.deepEqual([...new Set(savedSteps)].filter(step => step > initial.step),
    Array.from({ length: 11 - initial.step }, (_, index) => initial.step + index + 1),
    "each original checkpoint advances once and is saved in order");
  const beforeAgain = copy(h.current());
  assert(h.core.saveToSlot(SLOT));
  assert(h.core.loadFromSlot(SLOT));
  const awardsBefore = h.awards.length, moneyBefore = h.money.length;
  await h.run(); // cleared resumes its existing clear screen, never the victory runner again
  assert.equal(h.awards.length, awardsBefore);
  assert.equal(h.money.length, moneyBefore);
  assert.deepEqual(preserved(h.current()), preserved(beforeAgain));
  assert.equal(h.current().money, beforeAgain.money);
}

let cases = 0;
for (let step = 0; step <= 10; step++) for (const paid of [false, true]) for (const revealed of [false, true]) {
  await checkRun(await harness({ step, paid, revealed }));
  cases++;
}

// Reopen checkpoints actually written by the runner, not only constructed current-schema inputs.
const complete = await harness({ paid: false, revealed: false });
await checkRun(complete);
const checkpointByStep = new Map(complete.writes.filter(saved => saved.tournament.victory?.paid)
  .map(saved => [saved.tournament.victory.step, saved]));
for (let step = 0; step <= 10; step++) {
  const snapshot = checkpointByStep.get(step);
  assert(snapshot, `real AUTO checkpoint ${step} must have been saved`);
  await checkRun(await harness({ snapshot }));
  cases++;
}

const sentenceCases = [
  ["ch1_tournament_judging", "チャコール博士の評価も、", "チャコール博士の評価も、はじめとなるへ割れて入っていく。はじめの棒が、アダムを抜いて頭ひとつ前に出た。"],
  ["interval_day2_adam_lime", "アダムからはそれきりで、", "アダムからはそれきりで、こちらの返信にも既読がつかなかった。……何か、大きなことが動いている気がする。"],
];
for (const [id, start, original] of sentenceCases) {
  const lines = dialogues[id].lines;
  const at = lines.findIndex(line => line.text?.startsWith(start));
  assert(at >= 0);
  const split = lines.slice(at, at + 2);
  assert(split.every(line => line.speaker === "" && !line.type), `${id}: preserve narration semantics`);
  assert.equal(split.map(line => line.text).join(""), original, `${id}: splitting must preserve the exact original text`);
  for (const line of split) {
    assert.equal(paginate(line.text).length, 1, `${id}: each complete sentence must remain on one page`);
    assert(line.text.endsWith("。"), `${id}: page ends at a sentence boundary`);
  }
}

console.log(`PASS: ${cases} victory SAVE/LOAD cases, all 11 context/reward checkpoints, cleared replay and exact sentence pagination`);
console.log("Scope: native real ch1/state/data/rules/flavor-mastery; controlled VN/phone/DOM/ability ports, memory storage only. Browser/AX rendering and normal full playthrough are not exercised.");
