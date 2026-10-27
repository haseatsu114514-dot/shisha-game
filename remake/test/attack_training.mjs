import assert from 'node:assert/strict';
globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k,v) => storage.set(k,v), getItem: k => storage.get(k) ?? null };
const core = await import('../js/core/state.js');
const { ATTACK_UNLOCK, hasAttackTraining } = await import('../js/craft/attack-training.js');
const lesson = await import('../js/daily/attack-lesson.js');
for (const points of [0, 9, 20, 32, 33, 48, 66]) {
  core.newGame(); core.state.affinity.sumi = points;
  Object.assign(core.state.flags, { ch1_sumi_training: true, _coal_cube_learned: true });
  core.state.story.sumi = 6;
  core.save(); core.load();
  assert.equal(hasAttackTraining(core.state.flags), false, 'Old stories/coal lesson/hearts granted attack');
  assert.equal(lesson.canStudyAttack(), points >= 33);
}
core.newGame(); core.state.affinity.sumi = 33;
const student = core.state, result = { id: lesson.ATTACK_LESSON, visited: [lesson.ATTACK_LESSON] };
for (const invalid of [null, {}, {...result, cancelled:true}, {...result, visited:[]}, {...result, id:'ch1_sumi_training'}, {...result, id:'ch1_sumi_cube_coals'}]) {
  assert.equal(lesson.completeAttackLesson(student, invalid), false);
  assert.equal(hasAttackTraining(core.state.flags), false);
}
core.save(); core.load();
assert.equal(lesson.completeAttackLesson(student, result), false, 'Load must invalidate pending lesson');
assert.equal(lesson.completeAttackLesson(core.state, result), true);
assert.equal(lesson.completeAttackLesson(core.state, result), false, 'Repeat completion');
core.load(); assert.equal(hasAttackTraining(core.state.flags), true);
assert.equal(core.saveToSlot('suien_remake_slot1'), true);
core.newGame(); assert.equal(hasAttackTraining(core.state.flags), false);
core.loadFromSlot('suien_remake_slot1'); assert.equal(hasAttackTraining(core.state.flags), true);
core.saveToSlot('suien_remake_slot2');
core.newGame(); core.loadFromSlot('suien_remake_slot2'); assert.equal(hasAttackTraining(core.state.flags), true);
core.state.affinity.sumi = 0; assert.equal(hasAttackTraining(core.state.flags), true, 'Learning is independent of later hearts');
core.newGame(); assert.equal(hasAttackTraining(core.state.flags), false);
for (const value of [undefined, false, 'true', 1]) assert.equal(hasAttackTraining({[ATTACK_UNLOCK]:value}), false);
console.log('[attack training] PASS: heart3 boundary, legacy locked, explicit completion, cancellation, stale load, one-time save/load, new game');
