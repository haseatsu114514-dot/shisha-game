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
// #1716: 各人の反応ははじめの個別の返答で閉じる。話し直しは一人ずつで、許しや未解決の解除を決めない。
for (const id of all) {
  const reply = sceneData.get(routes.romance[id].conflict).lines.at(-1);
  assert.equal(reply.speaker, 'hajime', id);
  const talk = sceneData.get(routes.romance[id].talk)?.lines;
  assert.ok(talk, `${id} talk`);
  assert(talk.some(row => row.speaker === id) && talk.some(row => row.speaker === 'hajime'), id);
  assert(!talk.some(row => row.type || row.flag || ['steve', ...all.filter(x => x !== id)].includes(row.speaker)), id);
}
assert(!sceneData.get(routes.romance.hiyori.conflict).lines.some(row => row.text?.includes('付き合おう')), 'hiyori quotes her real confession');
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

// --- #1176 GAP 3-B: 第3章の任意場面・前夜の配線（ch3-story-wiring.js）。ブラウザ不要の純粋ロジック。
const wiring = await import(new URL('remake/js/chapters/ch3-story-wiring.js', root));
const {newState} = await import(new URL('remake/js/core/state.js', root));
const progress = await import(new URL('remake/js/chapters/ch3-progress.js', root));
const clock = await import(new URL('remake/js/core/tokyo-clock.js', root));
const tokyoDefs = JSON.parse(fs.readFileSync(new URL('data/tokyo_visits.json', root)));
const fileScenes = file => new Set(JSON.parse(fs.readFileSync(new URL(`data/dialogue/${file}.json`, root))).dialogues.map(s => s.dialogue_id));
{
  // 台本のロード対象: routes の任意8場面と、第3章で再生しうる前夜の場面がすべて実在するファイルに載っている。
  const optional = routes.chapters['3'].optional;
  assert.deepEqual(Object.keys(wiring.CH3_OPTIONAL_SCENES).sort(), [...optional].sort());
  const loaded = new Map(Object.entries(wiring.CH3_STORY_DIALOGUE_FILES).flatMap(([file, ids]) => ids.map(id => [id, file])));
  for (const id of optional) {
    assert.equal(loaded.get(id), wiring.CH3_OPTIONAL_SCENES[id].file, id);
    assert(fileScenes(wiring.CH3_OPTIONAL_SCENES[id].file).has(id), `${id} is not in ${wiring.CH3_OPTIONAL_SCENES[id].file}`);
  }
  const eveningIds = [routes.near_conflict.open, routes.near_conflict.close, routes.near_conflict.overlap,
    ...all.filter(id => routes.romance[id].date_min_chapter <= 3).flatMap(id => [routes.romance[id].date, routes.romance[id].near_conflict])];
  for (const id of eveningIds) assert(loaded.has(id), `${id} is not loaded by chapter 3`);
  assert(!loaded.has(routes.romance.ageha.date), 'ageha date is chapter 4');
  for (const [file, ids] of Object.entries(wiring.CH3_STORY_DIALOGUE_FILES)) for (const id of ids) assert(fileScenes(file).has(id), `${id} missing in ${file}`);
  // 前夜デートは報酬・フラグを持たない。分岐は選択と、東京前夜／ドバイ前夜の帰り道を分ける大会の終了判定だけ（#1895）。
  for (const id of all) {
    const dateLines = [...sceneData.get(routes.romance[id].date).lines, ...Object.values(sceneData.get(routes.romance[id].date).branches || {}).flat()];
    assert(dateLines.every(row => !row.type || row.type === 'choice'
      || (row.type === 'condition' && row.condition_type === 'tournament_finished')), 'eve date must not apply rewards or flags');
    assert(!dateLines.some(row => row.stats || row.money || row.affinity || row.flag), `${id} date must not apply rewards or flags`);
  }
}
const tokyo = () => {
  const value = newState();
  Object.assign(value, {chapter: 2, day: 28, phase: 'cleared', lovers: [], contacts: ['sumi']});
  value.flags = {_ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: {stage: 'complete'}};
  assert(progress.advanceToChapterThree(value));
  return value;
};
const readUntil = (value, sceneId) => {
  while (progress.chapterThreeScenes(value)[value.flags._ch3_intro.stage]?.id !== sceneId) {
    const scene = progress.chapterThreeScenes(value)[value.flags._ch3_intro.stage];
    assert(scene, `no scene ${sceneId}`);
    while (progress.chapterThreeFreeTime(value)) progress.completeChapterThreeFreeTime(value, progress.chapterThreeFreeTime(value).id);
    assert(progress.completeChapterThreeScene(value, scene.id), scene.id);
  }
};
const offered = (value) => wiring.availableOptionalScenes(routes, value).map(scene => scene.id);
{
  // 任意場面: 必須の進行と実際の記録だけが条件。好感度や所在から読めるようにしない。
  const value = tokyo();
  value.affinity = Object.fromEntries(all.map(id => [id, 100]));
  assert.deepEqual(offered(value), [], 'nothing before arrival');
  readUntil(value, 'ch3_mukai_intro');
  assert.deepEqual(offered(value), ['ch3_cigarman_rumor', 'ch3_mashiro_play_1']);
  readUntil(value, 'ch3_rest_before_recovery');
  assert(wiring.chapterThreeCompletedScenes(value).includes('ch3_double_apple_incident'));
  assert(!offered(value).includes('ch3_minto_small_lies'), 'no confession record: max affinity and a contact are not enough');
  value.contacts.push('minto');
  assert(!offered(value).includes('ch3_minto_small_lies'));
  const friend = structuredClone(value); friend.flags._friend_minto = true;
  assert(offered(friend).includes('ch3_minto_small_lies'), 'a declined confession was still heard');
  value.lovers.push('minto');
  assert.equal(offered(value)[0], 'ch3_minto_small_lies');
  assert(offered(value).includes('ch3_mashiro_practice'), 'practice follows the other-shop scene');
  assert(!offered(value).includes('ch3_mashiro_play_2'));
  const pos = {stage: value.flags._ch3_intro.stage, day: value.day, slot: value.slot, phase: value.phase};
  const closed = structuredClone(value.tokyoVisits);
  wiring.commitOptionalRead(value, 'ch3_mashiro_play_1');
  assert.equal(value.flags._ch3_read_ch3_mashiro_play_1, true);
  assert(!offered(value).includes('ch3_mashiro_play_1'), 'read once only');
  assert(offered(value).includes('ch3_mashiro_play_2'));
  assert.deepEqual({stage: value.flags._ch3_intro.stage, day: value.day, slot: value.slot, phase: value.phase}, pos, 'optional reads leave progress alone');
  assert.deepEqual(value.tokyoVisits, closed, 'optional reads leave the free-time windows alone');
  assert(!offered(value).includes('ch3_emil_workshop') && !offered(value).includes('ch3_cigarman_trace'));
  value.met.emil = true;
  assert(offered(value).includes('ch3_emil_workshop'), 'met judge may host the workshop');
  assert(!offered(value).includes('ch3_cigarman_trace'), 'needs the national result');
  value.flags._ch3_tournament_won = true;
  assert(wiring.chapterThreeCompletedScenes(value).includes('ch3_national_result'));
  value.flags._ch3_read_ch3_cigarman_rumor = true;
  assert(offered(value).includes('ch3_cigarman_trace'));
  assert.deepEqual(wiring.availableOptionalScenes(routes, {...value, chapter: 4}), []);
}
{
  // #1930: ましろの告白の入口。任意4場面の読了だけが条件で、好感度・面識からは開かない。返事で着地したら出さない。
  const entry = await import(new URL('remake/js/chapters/ch3-romance-entry.js', root));
  const value = tokyo();
  value.affinity = Object.fromEntries(all.map(id => [id, 100]));
  value.met.mashiro = true;
  readUntil(value, 'ch3_double_apple_incident');
  assert(!offered(value).includes('confession_mashiro'), 'max affinity alone does not open the confession');
  for (const id of ['ch3_mashiro_play_1', 'ch3_mashiro_play_2', 'ch3_mashiro_play_3']) wiring.commitOptionalRead(value, id);
  assert(!offered(value).includes('confession_mashiro'), 'needs the practice scene too');
  readUntil(value, 'ch3_rest_before_recovery');
  wiring.commitOptionalRead(value, 'ch3_mashiro_practice');
  assert(offered(value).includes('confession_mashiro'), 'four optional scenes open the confession');
  const confession = sceneData.get('confession_mashiro');
  const targets = confession.lines.find(row => row.type === 'choice').choices.map(choice => choice.next_id);
  assert.deepEqual(targets, ['confession_mashiro_accept', 'confession_mashiro_reject']);
  assert.equal(sceneData.get('confession_mashiro_accept').metadata.set_romance, 'mashiro');
  for (const id of targets) assert(wiring.CH3_STORY_DIALOGUE_FILES.confession.includes(id), `${id} loaded with the confession`);
  assert.equal(entry.confessionAnswer(['confession_mashiro', 'confession_mashiro_reject'], 'mashiro'), 'confession_mashiro_reject');
  assert.equal(entry.confessionAnswer(['confession_mashiro'], 'mashiro'), null, 'no answer when the choice was not reached');
  assert(!offered({...value, lovers: [...value.lovers, 'mashiro']}).includes('confession_mashiro'), 'lover already landed');
  assert(!offered({...value, flags: {...value.flags, _friend_mashiro: true}}).includes('confession_mashiro'), 'friend already landed');
  wiring.commitOptionalRead(value, 'confession_mashiro');
  assert(!offered(value).includes('confession_mashiro'), 'read once only');
  // あげは（#1988）: 第3章の後日談を読み終え、♥3の分岐で恋愛寄り・♥5の保存だけ。未回答・友情・♥4・着地済み・第4章では出さない。
  const romance = {bond_q1_ageha: {char: 'ageha', value: 1, day: 20}};
  const cleared = {chapter: 3, lovers: [], flags: {_ch3_cleared: true, _ch3_aftermath: {version: 3, winDay: 42, stage: 7}},
    romanceChoices: romance, affinity: {ageha: 66}, day: 45, slot: 0};
  assert.equal(entry.agehaConfessionDue(cleared), true);
  assert.equal(entry.agehaConfessionDue({...cleared, flags: {}}), false, 'not before the reunion');
  assert.equal(entry.agehaConfessionDue({...cleared, romanceChoices: {}}), false, 'no ♥3 answer: no confession');
  assert.equal(entry.agehaConfessionDue({...cleared, romanceChoices: {bond_q1_ageha: {char: 'ageha', value: 0, day: 20}}}), false, 'friendship answer');
  assert.equal(entry.agehaConfessionDue({...cleared, romanceChoices: {bond_q1_ageha: {char: 'minto', value: 1, day: 20}}}), false, 'another character\'s answer');
  assert.equal(entry.agehaConfessionDue({...cleared, affinity: {ageha: 65}}), false, '♥4 is not enough');
  assert.equal(entry.agehaConfessionDue({...cleared, affinity: {}}), false, 'max affinity is required even on the romance route');
  assert.equal(entry.agehaConfessionDue({...cleared, lovers: ['ageha']}), false);
  assert.equal(entry.agehaConfessionDue({...cleared, flags: {...cleared.flags, _friend_ageha: true}}), false);
  assert.equal(entry.agehaConfessionDue({...cleared, chapter: 4}), false);
  assert.equal(entry.AGEHA_ROUTE_CHOICE, 'bond_q1_ageha');
  // 告白は再会（優勝3日後）の翌日。進んだ時計は戻さず、条件を満たさない保存の時計には触れない。
  const timed = structuredClone(cleared);
  assert.equal(entry.beginAgehaConfessionDay(timed), true);
  assert.deepEqual([timed.day, timed.slot], [46, 0]);
  assert.equal(entry.beginAgehaConfessionDay(timed), false, 'idempotent');
  const late = {...structuredClone(cleared), day: 47, slot: 1};
  assert.equal(entry.beginAgehaConfessionDay(late), false);
  assert.deepEqual([late.day, late.slot], [47, 1], 'never rewinds');
  const friend = {...structuredClone(cleared), romanceChoices: {}};
  assert.equal(entry.beginAgehaConfessionDay(friend), false);
  assert.equal(friend.day, 45);
  assert.equal(sceneData.get('confession_ageha_accept').metadata.set_romance, 'ageha');
  for (const id of entry.AGEHA_CONFESSION_SCENES) assert(sceneData.get(id)?.lines?.length, id);
}
{
  // ひよりの tokyo_contact（#1434 決定B）: 仕事の相談を読んだ面識・連絡先のある相手だけ。恋人は要らず、東京に来ている間は出さない。
  const value = tokyo();
  readUntil(value, 'ch3_mukai_intro');
  value.met.hiyori = true; value.contacts.push('hiyori');
  assert(!offered(value).includes('hiyori_tokyo_contact'), 'needs the work talk');
  value.flags._hiyori_work_talk_done = true;
  assert(wiring.chapterThreeCompletedScenes(value).includes('hiyori_work_talk'));
  assert(offered(value).includes('hiyori_tokyo_contact'), 'a friend can call; no lover or meeting required');
  assert(!offered({...value, contacts: ['sumi']}).includes('hiyori_tokyo_contact'), 'needs the contact');
  assert(!offered({...value, met: {}}).includes('hiyori_tokyo_contact'), 'needs to have met');
  const visiting = structuredClone(value);
  visiting.tokyoVisits.plans.push({id: 'tokyo.hiyori.x', characterId: 'hiyori', status: 'staying', arrivalDay: value.day, returnDay: value.day + 2});
  assert(!offered(visiting).includes('hiyori_tokyo_contact'), 'no remote call while she is in Tokyo');
  wiring.commitOptionalRead(value, 'hiyori_tokyo_contact');
  assert.equal(value.flags._ch3_read_hiyori_tokyo_contact, true);
  assert(!offered(value).includes('hiyori_tokyo_contact'), 'read once only');
  // route.events と寄り道の既読を一本化する: 同じフラグで「既読」になる。
  const hiyoriRoute = JSON.parse(fs.readFileSync(new URL('data/dialogue/hiyori.json', root))).route;
  assert.equal(hiyoriRoute.events.find(e => e.id === 'tokyo_contact').flag, wiring.optionalReadFlag('hiyori_tokyo_contact'));
}
{
  // #2022: ましろとはmukai二日目の本編でLIMEを交換する（第5章のLIMEは連絡先が前提）。
  assert(sceneData.get('ch3_mukai_intro').lines.some(row => row.type === 'set_flag' && row.flag === '_lime_contact_mashiro'));
  // 味の会話は休みの日の配合メモの後、味覚が戻ってから。読むと好感度と熟練度が上がる。
  const value = tokyo();
  readUntil(value, 'ch3_rest_before_recovery');
  wiring.commitOptionalRead(value, 'ch3_mashiro_play_1');
  assert(!offered(value).includes('ch3_mashiro_black_tea'), 'not while the taste is gone');
  readUntil(value, 'ch3_abyss_recovery');
  assert(offered(value).includes('ch3_mashiro_black_tea'));
  assert(!offered({...value, flags: {...value.flags, _ch3_read_ch3_mashiro_play_1: false}}).includes('ch3_mashiro_black_tea'));
  const lesson = sceneData.get('ch3_mashiro_black_tea');
  assert.deepEqual(lesson.metadata.flavor_lesson, {black_tea: 1});
  for (const id of ['ch3_mashiro_play_1', 'ch3_mashiro_play_2', 'ch3_mashiro_play_3', 'ch3_mashiro_practice', 'ch3_mashiro_black_tea']) {
    assert(sceneData.get(id).lines.some(row => row.type === 'apply' && row.affinity?.mashiro > 0), `${id} raises Mashiro's affinity`);
  }
}
{
  // 久世とましろの任意場面: 煙幕の初訪問の後にましろ側、mukaiの客として来た後に久世側。
  const value = tokyo();
  readUntil(value, 'ch3_kuze_first');
  assert(!offered(value).some(id => id.startsWith('ch3_kuze_mashiro_')), 'no childhood scenes before meeting kuze');
  readUntil(value, 'ch3_kuze_mukai_visit');
  assert(offered(value).includes('ch3_kuze_mashiro_tea_tin'));
  assert(!offered(value).includes('ch3_kuze_mashiro_soon_back'), 'kuze talks after visiting mukai');
  readUntil(value, 'ch3_taste_return');
  assert(offered(value).includes('ch3_kuze_mashiro_soon_back'));
}
{
  // 前夜: location_contract どおり、実際に滞在中の人物と会う約束だけが根拠。
  const window = value => clock.tokyoTime(value, clock.TOKYO_FREE_TIMES.find(time => time.id === wiring.EVENING_WINDOW));
  const eve = (visitors, {lovers = visitors, met = ['steve'], status = 'staying', contacts = lovers} = {}) => {
    const value = tokyo();
    const start = value.flags._ch3_intro.startDay;
    Object.assign(value, {lovers: [...lovers], contacts: ['sumi', ...contacts], day: start + 12, slot: 1, phase: 'daily'});
    value.flags._ch3_intro.stage = progress.chapterThreeScenes(value).length;
    for (const who of met) value.met[who] = true;
    visitors.forEach(id => value.tokyoVisits.plans.push({id: `tokyo.${id}.${start + 11}`, characterId: id, status, met: true, dateDone: false,
      arrivalDay: start + 11, returnDay: start + 13, meetup: {id: 'd12-noon', day: start + 11, slot: 0}, date: {id: 'd13-night', day: start + 12, slot: 1}}));
    value.tokyoVisits.closedSlots.push('d12-noon');
    return value;
  };
  const pick = (value) => wiring.selectChapterThreeEvening(routes, value, tokyoDefs, window(value));
  let value = eve(['minto']);
  assert.equal(progress.chapterThreeFreeTime(value).id, wiring.EVENING_WINDOW);
  const date = pick(value);
  assert.equal(date.kind, 'date'); assert.deepEqual(date.scenes, ['tournament_date_minto']);
  assert.deepEqual(wiring.eveningRecord(date), {kind: 'date', participants: ['minto'], deferred: []});
  assert.equal(wiring.chapterThreeEveningContext(value, tokyoDefs, window(value)).unresolved.length, 0);
  assert.deepEqual(wiring.chapterThreeEveningContext(value, tokyoDefs, window(value)).present, ['minto', 'steve']);
  // 渡航予定だけ・好感度だけからは、到着も恋人も作らない。
  assert.equal(pick(eve(['minto'], {status: 'booked'})).kind, 'rest', 'booked but not arrived');
  assert.equal(pick(eve(['minto'], {lovers: []})).kind, 'rest', 'a friend is not a date');
  assert.equal(pick(eve(['minto'], {contacts: []})).kind, 'rest', 'no accepted invitation without a contact');
  value = eve(['minto']); value.flags._story_shuraba_unresolved = true;
  assert.equal(pick(value).kind, 'rest');
  value = eve([], {lovers: ['minto', 'rin']}); value.affinity = {minto: 100, rin: 100};
  assert.equal(pick(value).kind, 'rest', 'lovers who never arrived');
  // 二人以上が実際に同じ東京にいる前夜: スティーブに面識があれば茶化しで保留、なければ重なった予定。
  value = eve(['tsumugi', 'minto', 'ageha'], {lovers: ['minto', 'tsumugi', 'ageha']});
  const near = pick(value);
  assert.equal(near.kind, 'near_conflict');
  assert.deepEqual(near.participants, ['minto', 'tsumugi'], 'only lovers who actually arrived');
  assert.deepEqual(near.scenes, [routes.near_conflict.open, ...near.participants.map(id => routes.romance[id].near_conflict), routes.near_conflict.close]);
  assert(!near.participants.includes('ageha'));
  assert.deepEqual(wiring.eveningRecord(near).deferred, near.participants);
  assert.equal(near.unresolved, undefined);
  assert.equal(value.flags._story_shuraba_unresolved, undefined, 'the joke does not settle the dispute');
  value = eve(['tsumugi', 'minto'], {lovers: ['minto', 'tsumugi'], met: []});
  assert.equal(pick(value).kind, 'overlap', 'Steve has not been met');
  assert.deepEqual(pick(value).scenes, [routes.near_conflict.overlap]);
  // 仮置き: 東京在住のましろは、面識があればもう一人の恋人と並んで present になる。
  value = eve(['minto'], {lovers: ['minto', 'mashiro'], met: ['steve', 'mashiro']});
  assert.deepEqual(pick(value).participants, ['minto', 'mashiro']);
  assert.equal(pick(value).kind, 'near_conflict');
  assert.equal(pick(eve(['minto'], {lovers: ['minto', 'mashiro'], met: ['steve']})).kind, 'date', 'unmet Mashiro is not present');
  // 前夜の過ぎた朝（大会当日）は、滞在が終わっているので誰もいない。
  value = eve(['minto']); value.day += 1; value.slot = 0;
  assert.equal(pick(value).kind, 'rest');
}

// --- #1895: 第4章の前夜（ch4-story-wiring.js）と、前夜デートの帰り道。ブラウザ不要の純粋ロジック。
{
  const {tournamentFinished} = await import(new URL('remake/js/core/story-context.js', root));
  const ch4 = await import(new URL('remake/js/chapters/ch4-story-wiring.js', root));
  const ch4Progress = await import(new URL('remake/js/chapters/ch4-progress.js', root));
  const companion = await import(new URL('remake/js/core/overseas-companion.js', root));
  // 帰り道: 第3章の前夜（大会前）は mukai の裏口、第4章（第3章の大会後）は宿のロビー。あげはは第4章だけ。
  const eveTokyo = {chapter: 3, phase: 'daily'};
  const eveDubai = {chapter: 4, phase: 'daily'};
  for (const id of all) {
    const scene = sceneData.get(routes.romance[id].date);
    const stayLines = state => {
      const out = [];
      for (const row of scene.branches.stay) {
        if (row.type !== 'condition') { out.push(row.text); continue; }
        assert.equal(row.tournament_chapter, 3, id);
        out.push(...scene.branches[tournamentFinished(state, row.tournament_chapter) ? row.next_true : row.next_false].map(line => line.text));
      }
      return out.join('');
    };
    assert(!stayLines(eveDubai).includes('mukai'), `${id}: no mukai back door in Dubai`);
    assert(stayLines(eveDubai).includes('宿のロビー'), `${id}: back to the inn in Dubai`);
    if (routes.romance[id].date_min_chapter <= 3) assert(stayLines(eveTokyo).includes('mukaiの裏口'), `${id}: Tokyo eve keeps mukai`);
    else assert(!scene.branches.stay.some(row => row.type), `${id} only plays in Dubai`);
  }
  // 台本のロード対象: 第4章の前夜で再生しうる全員のデートと、重なった予定の保留が実在のファイルにある。
  const loaded = new Map(Object.entries(ch4.CH4_EVENING_DIALOGUE_FILES).flatMap(([file, ids]) => ids.map(id => [id, file])));
  for (const id of [...all.map(id => routes.romance[id].date), routes.near_conflict.overlap]) assert(loaded.has(id), `${id} is not loaded by chapter 4`);
  for (const [file, ids] of Object.entries(ch4.CH4_EVENING_DIALOGUE_FILES)) for (const id of ids) assert(fileScenes(file).has(id), `${id} missing in ${file}`);
  // 第3章を終えた保存から第4章へ進め、同行を選び、前夜（必須場面を読了）まで進めた保存。
  const dubaiEve = (lovers, pick, extra = {}) => {
    const value = newState();
    Object.assign(value, {chapter: 3, phase: 'cleared', day: 45, slot: 1, lovers});
    value.flags = {_ch3_cleared: true, _ch3_aftermath: {version: 2, winDay: 42, stage: 6}, _ch3_tournament_won: true};
    assert(ch4Progress.advanceToChapterFour(value));
    assert(companion.chooseOverseasCompanion(value, pick));
    const p = value.flags._ch4;
    Object.assign(p, {part: 'eve', day: ch4Progress.CH4_EVE_DAY, stage: ch4Progress.CH4_PROLOGUE.length, firstDay: 1});
    for (const entry of ch4Progress.CH4_MANDATORY) p.read[entry.id] = true;
    for (const id of extra.arrived || []) p.read[routes.romance[id].arrival] = true;
    return value;
  };
  // あげは（date_min_chapter 4）は同行すれば第4章の前夜デートになる。第3章の東京前夜には出ない（上で確認済み）。
  let value = dubaiEve(['ageha'], 'ageha');
  assert.equal(ch4.selectChapterFourEvening(routes, value).kind, 'rest', 'no date without an invitation');
  assert.equal(ch4.chapterFourEveningPartner(routes, value), 'ageha');
  let result = ch4.selectChapterFourEvening(routes, value, 'ageha');
  assert.deepEqual(result, {kind: 'date', participants: ['ageha'], scenes: ['tournament_date_ageha']});
  assert.deepEqual(ch4.chapterFourEveningRecord(result), {kind: 'date', participants: ['ageha']});
  for (const id of all) {
    value = dubaiEve([id], id);
    assert.equal(ch4.chapterFourEveningPartner(routes, value), id, `${id} can be invited in Dubai`);
    assert.deepEqual(ch4.selectChapterFourEvening(routes, value, id).scenes, [routes.romance[id].date]);
  }
  // 同行なし: 別便の恋人も、到着の記録が無ければその場にいない。到着場面を読み終えた人だけ。
  value = dubaiEve(['minto'], null);
  assert.deepEqual(ch4.chapterFourEveningContext(routes, value).present, []);
  assert.equal(ch4.chapterFourEveningPartner(routes, value), null, 'a separate-flight lover without an arrival record');
  assert.equal(ch4.selectChapterFourEvening(routes, value, 'minto').kind, 'rest');
  value = dubaiEve(['minto'], null, {arrived: ['minto']});
  assert.equal(ch4.chapterFourEveningPartner(routes, value), 'minto');
  // 友人として来るましろは恋人ではないので誘えず、恋人の数にも入らない。
  value = dubaiEve(['rin'], 'rin', {arrived: ['mashiro']});
  assert(ch4.chapterFourEveningContext(routes, value).present.includes('mashiro'));
  assert.equal(ch4.chapterFourEveningPartner(routes, value), 'rin');
  // 同じ場所の恋人が二人以上: 第4章ではスティーブの茶化しを出さず、重なった予定を保留する。誘いの選択は出さない。
  value = dubaiEve(['tsumugi', 'ageha'], 'tsumugi', {arrived: ['ageha']});
  value.met = {steve: true};
  result = ch4.selectChapterFourEvening(routes, value);
  assert.deepEqual(result, {kind: 'overlap', participants: ['tsumugi', 'ageha'], scenes: [routes.near_conflict.overlap]});
  assert.equal(ch4.selectChapterFourEvening(routes, value, 'ageha').kind, 'overlap', 'choosing one does not hide the other');
  assert.equal(ch4.chapterFourEveningPartner(routes, value), null);
  assert.equal(value.flags._story_shuraba_unresolved, undefined, 'the overlap does not settle the dispute');
  // 到着前の別便の恋人は数えない: 同行者だけならデートになる。
  value = dubaiEve(['tsumugi', 'ageha'], 'tsumugi');
  assert.equal(ch4.chapterFourEveningPartner(routes, value), 'tsumugi');
  // エンディング後の未解決の修羅場がある保存では前夜デートにしない。
  value = dubaiEve(['ageha'], 'ageha'); value.flags._story_shuraba_unresolved = true;
  assert.equal(ch4.chapterFourEveningPartner(routes, value), null);
  assert.equal(ch4.selectChapterFourEvening(routes, value, 'ageha').kind, 'rest');
}

console.log('OK: seven routes, 0–7 lovers, Tokyo near-conflict, post-ending conflict, location, old saves, chapter 3 optional/eve wiring, chapter 4 eve wiring');
