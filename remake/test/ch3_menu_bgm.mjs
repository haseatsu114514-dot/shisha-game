// Production chapter runners with controlled DOM/audio/modal ports. No browser/audio playback.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { newState } from "../js/core/state.js";
import { beginChapterThreeAftermath, completeChapterThreeAftermathScene,
  CH3_AFTERMATH_SCENES } from "../js/chapters/ch3-aftermath-progress.js";

const clone = value => JSON.parse(JSON.stringify(value));
function winningSave() {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "aftermath", day: 42, slot: 1 });
  value.flags._ch3_tournament_won = true;
  value.flags._ch3_tournament = { stage: "complete", result: { rank: 1, win: true } };
  return value;
}

async function harness(chapter, value) {
  const calls = { bgm: [], modals: [], config: 0, glossary: 0, saves: 0, errors: [], screens: [] };
  let choice = null, currentBgm = null;
  const classList = { add() {}, remove() {}, toggle() {} };
  const node = (selector, props, children) => ({ selector,
    props: Array.isArray(props) ? {} : props, children: Array.isArray(props) ? props : children,
    classList, replaceChildren() {} });
  const context = vm.createContext({ console: { error: (...args) => calls.errors.push(args) },
    AbortController, document: { body: { classList } }, window: { addEventListener() {} } });
  const modules = new Map();
  const bindings = {
    state: value, save: () => calls.saves++,
    chapterGrowthNight: async () => true, // 盤無効のMENU検査。夜の実精算はgrowth_chapter_rewardsで別途検証。
    DB: { dialogues: {} }, bgUrl: key => key, el: node,
    layers: { hud: node() }, showScreen: (name, root) => calls.screens.push({ name, root }), setBg: async () => {},
    modal: async options => { calls.modals.push(options); return calls.modals.length === 1 ? choice : true; },
    glossaryPanel: () => { calls.glossary++; return "controlled glossary panel"; },
    openConfig: async () => { calls.config++; },
    playBgm: key => { currentBgm = key; calls.bgm.push(key); },
    readDialogues: async (file, ids) => Object.fromEntries(ids.map(id => [id, { lines: [] }])),
    play: async () => ({}), syncTokyoVisits: () => {},
    tournamentProgress: () => value.flags._ch3_tournament,
    TOURNAMENT_STORY_STEPS: new Map(), MUKAI_DELIVERY_STEPS: [], CH3_STORY_DIALOGUE_FILES: {},
  };
  async function synthetic(url, names) {
    const key = url.href;
    if (!modules.has(key)) {
      const exports = [...new Set(names)];
      const mod = new vm.SyntheticModule(exports, function () {
        for (const name of exports) this.setExport(name, bindings[name] ?? (() => {}));
      }, { context, identifier: key });
      modules.set(key, mod);
    }
    return modules.get(key);
  }
  const url = new URL(`../js/chapters/${chapter}.js`, import.meta.url);
  const original = readFileSync(url, "utf8");
  // Expose the private MENU and owner only inside this VM; production exports stay unchanged.
  const extra = `\nexport { openMenu };\nexport function menuOwner() {
    return session = { state, active: true, busy: false, menuBusy: false };
  }\n${chapter === "ch3-tournament" ? "export { drive };" : ""}`;
  const required = new Map();
  for (const match of original.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)) {
    required.set(new URL(match[2], url).href, match[1].split(",").map(x => x.trim().split(/\s+as\s+/)[0]));
  }
  const mod = new vm.SourceTextModule(original + extra, { context, identifier: url.href,
    importModuleDynamically: async specifier => {
      const dep = await synthetic(new URL(specifier, url), ["openConfig"]);
      if (dep.status === "unlinked") await dep.link(() => {});
      if (dep.status === "linked") await dep.evaluate();
      return dep;
    },
  });
  await mod.link(async specifier => {
    const depUrl = new URL(specifier, url);
    if (specifier === "../core/chapter-actions.js") {
      const dep = new vm.SourceTextModule(readFileSync(depUrl, "utf8"), { context });
      await dep.link(async () => synthetic(new URL("../core/util.js", url), ["el"]));
      return dep;
    }
    if (specifier === "./ch3-aftermath-progress.js") {
      const dep = new vm.SourceTextModule(readFileSync(depUrl, "utf8"), { context });
      await dep.link(async () => synthetic(new URL("../js/core/tokyo-visits.js", import.meta.url), ["syncTokyoVisits"]));
      return dep;
    }
    if (specifier === "./ch3-romance-entry.js") {
      // #1930: DOMを持たない告白の入口の条件は実物を使う（定数配列を関数の代用品にしない）。
      const dep = new vm.SourceTextModule(readFileSync(depUrl, "utf8"), { context });
      await dep.link(async () => { throw new Error("ch3-romance-entry.js must stay import-free"); });
      return dep;
    }
    return synthetic(depUrl, required.get(depUrl.href) || []);
  });
  await mod.evaluate();
  return { api: mod.namespace, calls, choose: next => { choice = next; calls.modals.length = 0; },
    stopBgm: () => { currentBgm = null; }, bgm: () => currentBgm };
}

for (const chapter of ["ch3", "ch3-aftermath", "ch3-tournament"]) {
  const value = winningSave(), before = clone(value), h = await harness(chapter, value);
  const owner = h.api.menuOwner();
  for (const choice of ["config", "glossary", null]) {
    h.choose(choice);
    await h.api.openMenu(owner);
    const options = h.calls.modals[0].options;
    for (const [value, label] of [["config", "設定"], ["glossary", "用語集"]]) {
      assert.equal(options.filter(option => option.value === value).length, 1, `${chapter}: ${value} entry`);
      assert.equal(options.find(option => option.value === value).label, label);
    }
    if (choice === "config") assert.equal(h.calls.config, 1, `${chapter}: opens shared settings`);
    if (choice === "glossary") {
      assert.equal(h.calls.glossary, 1);
      assert.equal(h.calls.modals[1].className, "glossary-modal");
      assert.equal(h.calls.modals[1].body, "controlled glossary panel");
    }
    assert.equal(owner.menuBusy, false);
    assert.deepEqual(value, before, `${chapter}: menu cannot alter save/progress`);
  }
  owner.active = false;
  h.choose("config");
  await h.api.openMenu(owner);
  assert.equal(h.calls.modals.length, 0, `${chapter}: stale owner cannot open menu`);
}
console.log("PASS #1258: all three chapter MENU entries open shared settings/glossary, preserve saves, and reject stale owners");

const checkpoints = [];
const value = winningSave();
checkpoints.push(clone(value)); // Winner before first aftermath checkpoint.
beginChapterThreeAftermath(value);
checkpoints.push(clone(value));
for (const scene of CH3_AFTERMATH_SCENES) {
  completeChapterThreeAftermathScene(value, scene.id);
  checkpoints.push(clone(value));
}
for (const stage of [0, 3, 4, 5]) {
  const legacy = winningSave();
  legacy.flags._ch3_aftermath = { version: 1, winDay: 42, stage };
  if (stage === 5) legacy.flags._ch3_cleared = true;
  checkpoints.push(legacy);
}
for (const checkpoint of checkpoints) {
  const h = await harness("ch3-aftermath", checkpoint);
  h.stopBgm(); // Title LOAD stops the outgoing title track before chapter resume.
  assert.equal(await h.api.runChapterThreeAftermath(), true);
  assert.equal(h.bgm(), "bgm_aftermath", `LOAD stage ${checkpoint.flags._ch3_aftermath?.stage}`);
  assert.equal(h.calls.errors.length, 0);
  const before = clone(checkpoint);
  h.stopBgm();
  assert.equal(await h.api.runChapterThreeAftermath(), true);
  assert.equal(h.bgm(), "bgm_aftermath");
  assert.deepEqual(clone(checkpoint), before, "Repeated resume must not advance scene/date/resources");
}
// Follow the real card actions through all six scenes, then compare the loaded ending.
const continuous = winningSave(), h = await harness("ch3-aftermath", continuous);
await h.api.runChapterThreeAftermath();
for (let stage = 0; stage < CH3_AFTERMATH_SCENES.length; stage++) {
  const card = h.calls.screens.at(-1).root;
  const actions = card.children.at(-1).children;
  const next = actions.find(node => node.props.dataset?.test === "ch3-aftermath-continue");
  assert(next, `continue action at stage ${stage}`);
  await next.props.onclick();
  assert.equal(h.bgm(), "bgm_aftermath");
  assert.equal(continuous.flags._ch3_aftermath.stage, stage + 1);
}
assert.equal(h.calls.errors.length, 0);
assert.equal(continuous.flags._ch3_cleared, true);
const complete = winningSave(), tournament = await harness("ch3-tournament", complete);
await tournament.api.drive(tournament.api.menuOwner());
assert.equal(tournament.bgm(), "bgm_aftermath", "Winning tournament complete card restores victory BGM");
for (const edit of [s => { s.chapter = 2; }, s => { s.flags._ch3_tournament_won = false; },
  s => { s.flags._ch3_tournament.result.rank = 2; }, s => { s.flags._ch3_tournament.stage = "victory"; }]) {
  const invalid = winningSave(); edit(invalid);
  const before = clone(invalid), h = await harness("ch3-aftermath", invalid);
  assert.equal(await h.api.runChapterThreeAftermath(), false);
  assert.equal(h.calls.bgm.length, 0, "Invalid save cannot start aftermath audio");
  assert.deepEqual(invalid, before);
}
console.log("PASS #1261: 12 current/legacy LOAD checkpoints, six-scene continuous flow, repeat resume, victory card and invalid-save guards");
