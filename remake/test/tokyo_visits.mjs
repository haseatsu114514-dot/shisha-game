import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot, load, SAVE_KEY, SCHEMA } from "../js/core/state.js";
import { advanceToChapterThree, CH3_INTRO_SCENES, completeChapterThreeScene, chapterThreeFreeTime,
  completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { proposeTokyoVisit, bookTokyoVisit, syncTokyoVisits, characterRegion, playerRegion,
  completeTokyoVisitAction, visitContacts, dueTokyoVisit } from "../js/core/tokyo-visits.js";
import { completeChapterThreeAftermathScene, beginChapterThreeAftermath, CH3_AFTERMATH_SCENES } from "../js/chapters/ch3-aftermath-progress.js";
const definitions = JSON.parse(readFileSync(new URL("../../data/tokyo_visits.json", import.meta.url)));
const scenes = JSON.parse(readFileSync(new URL("../../data/dialogue/ch3_visits.json", import.meta.url))).dialogues;
const heroineIds = JSON.parse(readFileSync(new URL("../../data/story_routes.json", import.meta.url))).heroine_ids;
for (const [id, definition] of Object.entries(definitions.characters)) {
  assert(heroineIds.includes(id));
  assert.equal(definition.home, "home");
  if (definition.dateMinChapter > 3) continue;
  for (const kind of ["meetup", "date"]) {
    const scene = scenes.find(scene => scene.dialogue_id === `ch3_visit_${id}_${kind}`);
    assert(scene?.lines.length);
    assert(scene.lines.every(line => !line.type), "Unconditional date dialogue must not apply rewards or flags");
  }
}
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
function departure() {
  const value = newState();
  Object.assign(value, { chapter: 2, day: 28, phase: "cleared", lovers: ["tsumugi", "minto", "rin", "samechan", "hiyori"],
    contacts: ["sumi", "tsumugi", "minto", "rin", "samechan", "hiyori"], money: 23456, stamina: 45 });
  value.owned.push("home_rig_set");
  value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" } };
  assert(advanceToChapterThree(value));
  return value;
}
const keptKeys = ["lovers", "contacts", "loverSince", "loveLevel", "lovePts", "affinity", "stats", "statXp", "stamina", "money", "owned", "equip", "goods", "keepsakes", "relationshipMemories", "pendingInvite", "guilt"];
const kept = value => Object.fromEntries(keptKeys.map(key => [key, structuredClone(value[key])]));
for (const id of ["tsumugi", "minto", "rin", "samechan", "hiyori"]) {
  const value = departure(), before = kept(value);
  const proposal = proposeTokyoVisit(value, definitions, id);
  assert(proposal && proposal.arrivalDay >= value.day + 2);
  assert(bookTokyoVisit(value, definitions, proposal));
  assert(!bookTokyoVisit(value, definitions, proposal), "Repeated acceptance double booked");
  const plan = value.tokyoVisits.plans[0];
  assert.equal(characterRegion(value, definitions, id), "home", "Booking teleported a guest");
  // 予約のない空き時間（#1655 で会員でなくても開く）は休んで閉じ、訪問の枠だけを検査する。
  const skipOpen = () => {
    for (let window; (window = chapterThreeFreeTime(value)) && !dueTokyoVisit(value, window);) {
      assert(completeChapterThreeFreeTime(value, window.id));
    }
  };
  for (let i = 0; i < CH3_INTRO_SCENES.length; i++) {
    skipOpen();
    const free = chapterThreeFreeTime(value);
    if (free) throw new Error("An action was not closed before the next story scene");
    assert(completeChapterThreeScene(value, CH3_INTRO_SCENES[i].id));
    for (let window; (skipOpen(), window = chapterThreeFreeTime(value));) {
      assert.equal(value.day, window.day); assert.equal(value.slot, window.slot);
      assert.equal(characterRegion(value, definitions, id), "tokyo");
      assert(dueTokyoVisit(value, window));
      const story = CH3_INTRO_SCENES[value.flags._ch3_intro.stage];
      if (story) assert(!completeChapterThreeScene(value, story.id), "Story bypassed a reserved action window");
      // Stopping a VN before it completes performs no commit. All four real save keys retain that checkpoint.
      const prior = structuredClone(value);
      setState(value);
      for (const key of [SAVE_KEY, "suien_remake_slot1", "suien_remake_slot2", "suien_remake_slot3"]) {
        assert(saveToSlot(key));
        const loaded = loadFromSlot(key);
        assert.deepEqual(loaded.tokyoVisits, prior.tokyoVisits);
        assert.deepEqual(kept(loaded), kept(prior));
        assert.equal(loaded.day, prior.day); assert.equal(loaded.slot, prior.slot);
      }
      assert.deepEqual(value.tokyoVisits, prior.tokyoVisits);
      assert(completeTokyoVisitAction(value, definitions, plan.id, window));
      assert(!completeTokyoVisitAction(value, definitions, plan.id, window), "Repeated completion consumed another action");
      assert(completeChapterThreeFreeTime(value, window.id));
      assert(!completeChapterThreeFreeTime(value, window.id));
    }
  }
  assert(plan.met && plan.dateDone);
  assert.equal(plan.status, "returned");
  assert.equal(characterRegion(value, definitions, id), "home");
  assert.equal(value.day, 42); assert.equal(value.slot, 0); assert.equal(value.phase, "tournament");
  assert.deepEqual(kept(value), before, "Travel or a free dialogue changed relationship benefits/resources");
}
console.log("PASS: five hometown lovers book, arrive, meet, date, return through real chapter progress; all save slots preserve uncommitted actions");

{
  const value = departure();
  const proposals = value.lovers.map(id => proposeTokyoVisit(value, definitions, id));
  assert(bookTokyoVisit(value, definitions, proposals[0]));
  assert(!bookTokyoVisit(value, definitions, proposals[1]), "An outdated overlapping offer was accepted");
  for (const id of value.lovers.slice(1)) {
    const proposal = proposeTokyoVisit(value, definitions, id);
    if (proposal) assert(bookTokyoVisit(value, definitions, proposal));
  }
  const plans = value.tokyoVisits.plans;
  assert(plans.length >= 3);
  for (let index = 1; index < plans.length; index++) assert(plans[index].arrivalDay >= plans[index - 1].returnDay);
  const before = kept(value);
  // A caller may skip a rendezvous. At the end of the stay, even unread/missed visits must return.
  value.day = plans.at(-1).returnDay;
  syncTokyoVisits(value);
  assert(plans.every(plan => plan.status === "returned" && !plan.met && !plan.dateDone));
  assert.deepEqual(kept(value), before);
}
{
  const value = departure();
  value.lovers = []; value.affinity.tsumugi = 999; value.flags._friend_tsumugi = true;
  assert.deepEqual(visitContacts(value, definitions), []);
  assert.equal(proposeTokyoVisit(value, definitions, "tsumugi"), null);
  assert.equal(chapterThreeFreeTime(value), null);
  value.lovers = ["ageha", "mashiro"];
  value.contacts = ["ageha", "mashiro"];
  assert.equal(proposeTokyoVisit(value, definitions, "ageha"), null, "Ageha bypassed the post-homecoming gate");
  assert.equal(proposeTokyoVisit(value, definitions, "mashiro"), null, "Tokyo resident was treated as a hometown visitor");
}
{
  const value = departure();
  const offer = proposeTokyoVisit(value, definitions, "tsumugi");
  value.pendingInvite = { sender: "sumi", day: offer.meetup.day, slot: offer.meetup.slot, event: "existing" };
  assert(!bookTokyoVisit(value, definitions, offer));
  const next = proposeTokyoVisit(value, definitions, "tsumugi");
  assert.notDeepEqual(next.meetup, offer.meetup);
  assert.equal(value.pendingInvite.event, "existing");
}
{
  const value = departure();
  assert(bookTokyoVisit(value, definitions, proposeTokyoVisit(value, definitions, "tsumugi")));
  value.flags._ch3_tournament_won = true;
  value.flags._ch3_tournament = { stage: "complete", result: { rank: 1, win: true } };
  beginChapterThreeAftermath(value);
  for (const scene of CH3_AFTERMATH_SCENES) assert(completeChapterThreeAftermathScene(value, scene.id));
  assert.equal(playerRegion(value), "home");
  assert(value.tokyoVisits.plans.every(plan => plan.status === "returned"));
}
for (const schema of [11, 13, 19]) {
  const legacy = departure(); legacy.schema = schema; delete legacy.tokyoVisits;
  const before = kept(legacy);
  memory.set(SAVE_KEY, JSON.stringify(legacy));
  const restored = load();
  assert.equal(restored.schema, SCHEMA);
  assert.deepEqual(restored.tokyoVisits, { version: 1, plans: [], offers: {}, closedSlots: [], chats: {} });
  assert.deepEqual(kept(restored), before, `schema${schema} changed existing progression`);
}
console.log("PASS: sequential visitors, stale/conflicting offers, missed arrival, friend/MAX gates, homecoming and schema11/13/19 migration");

{
  const malformed = departure();
  malformed.tokyoVisits = { version: 1, plans: [null, {}], offers: { tsumugi: "broken" }, closedSlots: [null, {}], chats: null };
  memory.set(SAVE_KEY, JSON.stringify(malformed));
  const restored = load();
  assert.deepEqual(restored.tokyoVisits.plans, []);
  assert.deepEqual(restored.tokyoVisits.offers, {});
  assert.doesNotThrow(() => proposeTokyoVisit(restored, definitions, "tsumugi"));
}
console.log("PASS: malformed travel records are discarded without changing the valid save");
