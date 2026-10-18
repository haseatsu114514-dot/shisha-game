import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const routes = JSON.parse(fs.readFileSync(new URL('data/story_routes.json', root)));
const source = fs.readFileSync(new URL('remake/js/core/story-routes.js', root), 'utf8');
const {selectStoryEvening, selectStoryEnding, selectPostEndingConflict, canReadOptionalStory} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const sceneData = new Map(fs.readdirSync(new URL('data/dialogue/', root)).filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(fs.readFileSync(new URL(`data/dialogue/${f}`, root))).dialogues || []).map(s => [s.dialogue_id, s]));
const scenes = new Set(sceneData.keys());
const all = routes.heroine_ids;
const context = {present: all, accepted: all};
assert.equal(selectStoryEvening(routes, {chapter: 4, affinity: Object.fromEntries(all.map(id => [id, 100]))}, context).kind, 'rest');
for (const id of all) {
  const state = {chapter: 4, lovers: [id], flags: {}};
  const ctx = {...context, selected: id};
  assert.equal(selectStoryEvening(routes, state, ctx).kind, 'date');
  assert.equal(selectStoryEvening(routes, state, {...ctx, present: []}).kind, 'rest');
  assert.equal(selectStoryEvening(routes, state, {...ctx, accepted: []}).kind, 'rest');
  assert.equal(selectStoryEvening(routes, state, {...ctx, unresolved: [id]}).kind, 'rest');
  assert.equal(selectStoryEvening(routes, {...state, flags: {_story_shuraba_unresolved: true}}, ctx).kind, 'rest');
  assert.equal(selectStoryEnding(routes, state, ctx)[1], routes.romance[id].epilogue);
  assert.equal(selectStoryEnding(routes, state, {...ctx, present: []})[1], routes.ending.normal);
  assert.equal(selectPostEndingConflict(routes, state, ctx).kind, 'none');
}
assert.equal(selectStoryEvening(routes, {chapter: 3, lovers: ['ageha']}, {...context, selected: 'ageha'}).kind, 'rest');
for (let n = 2; n <= all.length; n++) {
  const lovers = all.slice(0, n);
  const state = {chapter: 4, lovers};
  assert.equal(selectStoryEvening(routes, state, context).kind, 'overlap');
  const result = selectPostEndingConflict(routes, state, context);
  assert.equal(result.kind, 'conflict');
  assert.deepEqual(result.participants, lovers);
  assert.equal(result.scenes.length, n + 3);
  assert.deepEqual(result.unresolved, lovers);
  result.scenes.forEach(id => assert.ok(scenes.has(id), id));
  assert.equal(selectStoryEvening(routes, state, {present: [lovers[0]]}).kind, 'rest');
  assert.equal(selectStoryEnding(routes, state, context)[1], routes.ending.normal);
  assert.equal(selectPostEndingConflict(routes, state, {present: [lovers[0]]}).kind, 'pending');

  const tokyo = {chapter: 3, lovers};
  const before = structuredClone(tokyo);
  const near = selectStoryEvening(routes, tokyo, {present: [...all, 'steve']});
  assert.equal(near.kind, 'near_conflict');
  assert(!near.participants.includes('ageha'), 'ageha only rejoins after Tokyo');
  assert.equal(near.unresolved, undefined, 'the joke must not settle the relationship dispute');
  const nearLines = near.scenes.flatMap(id => sceneData.get(id).lines);
  assert(nearLines.some(row => row.speaker === 'steve'));
  assert(!nearLines.some(row => row.flag === '_story_shuraba_unresolved'));
  assert.deepEqual(tokyo, before);
  assert.equal(selectStoryEvening(routes, tokyo, context).kind, 'overlap', 'no absent Steve');
  assert(!selectStoryEnding(routes, tokyo, context).includes(routes.conflict.open));
}
const pair = {chapter: 4, lovers: ['minto', 'rin']};
assert.equal(selectStoryEvening(routes, pair, {present: ['minto', 'rin', 'steve']}).kind, 'overlap', 'no Tokyo gag in Dubai');
const partial = selectPostEndingConflict(routes, {...pair, lovers: all}, {present: ['minto', 'rin', 'steve']});
assert.deepEqual(partial.participants, ['minto', 'rin'], 'only present lovers confront him');
assert(!partial.scenes.flatMap(id => sceneData.get(id).lines).some(row => row.speaker === 'steve'), 'no comic interruption after the ending');
assert.equal(selectPostEndingConflict(routes, {lovers: [], flags: {_story_shuraba_unresolved: true}}).kind, 'pending');
assert.equal(selectPostEndingConflict(routes, {}, context).kind, 'none');
assert.equal(selectStoryEvening(routes, {chapter: 4, lovers: ['rin', 'rin', 'unknown']}, {present: ['rin']}).kind, 'rest');
assert.equal(selectStoryEvening(routes, {}).kind, 'rest');
const mintoCall = 'ch3_minto_small_lies';
const heard = {completedScenes: ['ch3_double_apple_incident', 'confession_minto']};
assert(!canReadOptionalStory(routes, {contacts: ['minto'], affinity: {minto: 100}}, mintoCall));
assert(!canReadOptionalStory(routes, {}, mintoCall, heard));
assert(canReadOptionalStory(routes, {contacts: ['minto']}, mintoCall, heard));
assert(!canReadOptionalStory(routes, {}, 'ch3_cigarman_trace', {completedScenes: ['ch3_cigarman_rumor']}));
assert(!canReadOptionalStory(routes, {}, 'unknown'));
console.log('OK: seven routes, 0–7 lovers, Tokyo near-conflict, post-ending conflict, location, old saves');
