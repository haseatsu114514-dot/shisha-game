import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { trpgClubFoundingDialogue, playTrpgClubFounding } from "../js/trpg/club-event.js";

const catalog = JSON.parse(await readFile(new URL("../../data/trpg_catalog.json", import.meta.url)));
const club = JSON.parse(await readFile(new URL("../../data/dialogue/trpg_club.json", import.meta.url)));
const fresh = () => ({ chapter: 2, phase: "daily", day: 3, slot: 0, money: 1234,
  trpg: { stock: [], owned: [], cleared: {}, club: { founded: null, members: {} } } });

test("both VN choices reuse the proposal and full founding scene, without mutating source copy", () => {
  const before = structuredClone(club), dialogue = trpgClubFoundingDialogue(club);
  assert.deepEqual(dialogue.lines.slice(0, -1), club.lines);
  const choice = dialogue.lines.at(-1);
  assert.equal(choice.type, "choice");
  assert.deepEqual(choice.choices.map(c => c.next), ["proposal_time", "proposal_people"]);
  for (const { next } of choice.choices) {
    assert.deepEqual(dialogue.branches[next], [...club.branches[next], ...club.branches.founded]);
  }
  assert.deepEqual(club, before);
});

test("day/night and later chapters found only after the complete VN; no time, money or book changes", async () => {
  for (const chapter of [2, 3, 5]) for (const slot of [0, 1]) {
    const state = fresh(); Object.assign(state, { chapter, slot });
    const before = structuredClone(state); let saves = 0;
    assert(await playTrpgClubFounding({ getState: () => state, catalog, club,
      play: async (dialogue, options) => {
        assert.equal(state.trpg.club.founded, null); assert.equal(saves, 0);
        assert.equal(dialogue.dialogue_id, "trpg_club_founding"); return { visited: [dialogue.dialogue_id] };
      }, save: () => { saves++; } }));
    assert.equal(saves, 1); assert.deepEqual(state.trpg.club.founded, { chapter, day: 3 });
    assert.deepEqual({ ...state, trpg: { ...state.trpg, club: before.trpg.club } }, before);
  }
});

test("founded old saves keep membership, books and clears and never replay or resave", async () => {
  const state = fresh(); state.trpg.club = { founded: { chapter: 2, day: 1 }, members: { hiyori: { chapter: 2, day: 2 } } };
  state.trpg.owned = ["ordinary-cup"]; state.trpg.cleared = { "ordinary-cup": { ending: "discovery" } };
  const before = structuredClone(state);
  assert(await playTrpgClubFounding({ getState: () => state, catalog, club,
    play: () => assert.fail("Old save replayed"), save: () => assert.fail("Old save rewritten") }));
  assert.deepEqual(state, before);
});

test("unfounded legacy saves without TRPG progress can found normally", async () => {
  const state = fresh(); delete state.trpg;
  assert(await playTrpgClubFounding({ getState: () => state, catalog, club, play: async () => ({}) }));
  assert.deepEqual(state.trpg.club, { founded: { chapter: 2, day: 3 }, members: {} });
});

test("cancel, abort, navigation, replacement save, changed time and phase never commit", async () => {
  for (const kind of ["cancel", "abort", "navigate", "replace", "day", "slot", "chapter", "phase"]) {
    const original = fresh(); let state = original, active = true, saves = 0;
    const abort = new AbortController();
    const ok = await playTrpgClubFounding({ getState: () => state, catalog, club, signal: abort.signal,
      isCurrent: () => active, save: () => { saves++; }, play: async () => {
        if (kind === "cancel") return { cancelled: true };
        if (kind === "abort") abort.abort();
        if (kind === "navigate") active = false;
        if (kind === "replace") state = fresh();
        if (["day", "slot", "chapter"].includes(kind)) original[kind]++;
        if (kind === "phase") original.phase = "tournament";
        return {};
      } });
    assert.equal(ok, false, kind); assert.equal(saves, 0, kind);
    assert.equal(original.trpg.club.founded, null, kind); assert.equal(state.trpg.club.founded, null, kind);
  }
});

test("cancelled and failed loads retry; duplicate in-flight visit cannot found twice", async () => {
  const state = fresh(); let finish, calls = 0, saves = 0;
  const options = { getState: () => state, catalog, club, save: () => { saves++; },
    play: () => { calls++; return new Promise(resolve => { finish = resolve; }); } };
  const first = playTrpgClubFounding(options);
  assert.equal(await playTrpgClubFounding(options), false); assert.equal(calls, 1);
  finish({ cancelled: true }); assert.equal(await first, false);
  await assert.rejects(playTrpgClubFounding({ ...options, play: async () => { throw new Error("load"); } }), /load/);
  const retry = playTrpgClubFounding(options); finish({}); assert(await retry);
  assert.equal(calls, 2); assert.equal(saves, 1);
});

test("before unlock, outside daily, pre-abort and inactive visits do not start a VN", async () => {
  const abort = new AbortController(); abort.abort();
  for (const change of [{ chapter: 1 }, { phase: "tournament" }, { signal: abort.signal }, { isCurrent: () => false }]) {
    const state = fresh(), { signal, isCurrent, ...fields } = change; Object.assign(state, fields);
    assert.equal(await playTrpgClubFounding({ getState: () => state, catalog, club, signal, isCurrent,
      play: () => assert.fail("Invalid visit starts VN"), save: () => assert.fail("Invalid visit saves") }), false);
  }
});
