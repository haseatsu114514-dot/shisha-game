import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const routes = JSON.parse(fs.readFileSync(new URL('data/story_routes.json', root)));
const source = fs.readFileSync(new URL('remake/js/core/story-routes.js', root), 'utf8');
const {selectStoryEvening, selectStoryEnding, canReadOptionalStory} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const scenes = new Set(fs.readdirSync(new URL('data/dialogue/', root)).filter(f => f.endsWith('.json'))
  .flatMap(f => JSON.parse(fs.readFileSync(new URL(`data/dialogue/${f}`, root))).dialogues || []).map(s => s.dialogue_id));
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
}
assert.equal(selectStoryEvening(routes, {chapter: 3, lovers: ['ageha']}, {...context, selected: 'ageha'}).kind, 'rest');
for (let n = 2; n <= all.length; n++) {
  const lovers = all.slice(0, n);
  const state = {chapter: 4, lovers};
  const result = selectStoryEvening(routes, state, context);
  assert.equal(result.kind, 'conflict');
  assert.deepEqual(result.participants, lovers);
  assert.equal(result.scenes.length, n + 2);
  assert.deepEqual(result.unresolved, lovers);
  result.scenes.forEach(id => assert.ok(scenes.has(id), id));
  assert.equal(selectStoryEvening(routes, state, {present: [lovers[0]]}).kind, 'rest');
  assert.equal(selectStoryEnding(routes, state, context)[1], routes.conflict.pending_ending);
}
assert.equal(selectStoryEvening(routes, {chapter: 4, lovers: ['rin', 'rin', 'unknown']}, {present: ['rin']}).kind, 'rest');
assert.equal(selectStoryEvening(routes, {}).kind, 'rest');
const mintoCall = 'ch3_minto_small_lies';
const heard = {completedScenes: ['ch3_double_apple_incident', 'confession_minto']};
assert(!canReadOptionalStory(routes, {contacts: ['minto'], affinity: {minto: 100}}, mintoCall));
assert(!canReadOptionalStory(routes, {}, mintoCall, heard));
assert(canReadOptionalStory(routes, {contacts: ['minto']}, mintoCall, heard));
assert(!canReadOptionalStory(routes, {}, 'ch3_cigarman_trace', {completedScenes: ['ch3_cigarman_rumor']}));
assert(!canReadOptionalStory(routes, {}, 'unknown'));
console.log('OK: seven routes, 0–7 lovers, dates, location/acceptance, unresolved conflicts, old saves');
