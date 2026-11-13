// #1898: 回想の対象と後日談・敗北台本の文言を、データだけで確認する（ブラウザ不要）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { AFFINITY_CHARACTERS } from '../js/core/state.js';
const root = new URL('../../', import.meta.url);
const readJson = (path) => JSON.parse(fs.readFileSync(new URL(path, root), 'utf8'));
const memories = readJson('data/relationship_memories.json').memories;
const scenes = new Map(fs.readdirSync(new URL('data/dialogue/', root)).filter((f) => f.endsWith('.json'))
  .flatMap((f) => readJson(`data/dialogue/${f}`).dialogues || []).map((s) => [s.dialogue_id, s]));

// 場面内のすべての行（分岐・入れ子を含む）。
const rows = (node) => {
  if (Array.isArray(node)) return node.flatMap(rows);
  if (!node || typeof node !== 'object') return [];
  return [node, ...Object.values(node).flatMap(rows)];
};
const rememberIds = (scene) => new Set(rows(scene.lines).concat(rows(scene.branches || {}))
  .filter((row) => row.type === 'remember').map((row) => row.memory_id));

// 記憶IDは一意で、記した場面に remember 行がある。
const ids = new Set();
for (const memory of memories) {
  assert(!ids.has(memory.id), `duplicate memory id: ${memory.id}`);
  ids.add(memory.id);
  const scene = scenes.get(memory.dialogue_id);
  assert(scene, `${memory.id}: missing scene ${memory.dialogue_id}`);
  assert(rememberIds(scene).has(memory.id), `${memory.id}: ${memory.dialogue_id} has no remember line`);
  assert(/^（.+）$/.test(memory.echo), `${memory.id}: echo must be an inner thought`);
}
// 逆に、remember 行が指すIDはすべて登録済み。
for (const [sceneId, scene] of scenes) {
  for (const id of rememberIds(scene)) assert(ids.has(id), `${sceneId}: unknown memory ${id}`);
}

// サメちゃん・ひより（恋人候補）は第5章の回想に、綾取・スティーブ（第4章正本の調整の記憶）は第3章の前夜の回想に浮かぶ。
const byChar = {};
for (const m of memories) (byChar[m.char_id] ||= []).push(m);
const expected = {
  samechan: { scenes: ['samechan_shop_closing_check', 'samechan_bond_finale'], name: 'サメちゃん' },
  hiyori: { scenes: ['hiyori_work_talk', 'hiyori_axe_reveal_close'], name: 'ひより' },
  saku: { scenes: ['ch3_saku_advice'], name: '綾取' },
  steve: { scenes: ['ch3_steve_low_heat'], name: 'スティーブ' },
};
for (const [charId, spec] of Object.entries(expected)) {
  const own = byChar[charId] || [];
  assert.deepEqual(own.map((m) => m.dialogue_id).sort(), spec.scenes.slice().sort(), charId);
  for (const m of own) assert(m.echo.includes(spec.name), `${m.id}: echo must name ${spec.name}`);
}

// 勝負の前の振り返り（reflection 行）は全章にある（第1〜4章は大会前夜、第5章は二台目の前）。第3・4章は前夜の必須場面の最後で、
// その章の相手の記憶が、同じ章の前夜より前の必須場面で残る（交流の時系列ルール）。
const reflections = (scene) => rows(scene.lines).concat(rows(scene.branches || {})).filter((row) => row.type === 'reflection');
const eveScenes = { 1: 'ch1_day7_last_night', 2: 'ch2_pre_tournament_realisation', 3: 'ch3_tournament_eve',
  4: 'ch4_stranger_third', 5: 'ch5_relationship_before_second_cup' };
for (const [chapter, id] of Object.entries(eveScenes)) {
  assert(scenes.has(id), `chapter ${chapter}: missing ${id}`);
  assert.equal(reflections(scenes.get(id)).length, 1, `chapter ${chapter}: ${id} needs one reflection line`);
}
const width = (s) => [...s].reduce((n, ch) => n + (ch.codePointAt(0) <= 0xff ? 0.5 : 1), 0);
const memoryChars = new Set(memories.map((m) => m.char_id));
for (const [, scene] of scenes) {
  for (const row of reflections(scene)) {
    // text は導入の地の文、close は締めの内心の差し替え（空文字は出さない）。表示される1行なので48字以内。
    if ('text' in row) assert(typeof row.text === 'string' && width(row.text) <= 48, `${scene.dialogue_id}: reflection text`);
    if ('close' in row) {
      assert(typeof row.close === 'string' && width(row.close) <= 48, `${scene.dialogue_id}: reflection close`);
      assert(row.close === '' || /^（.+）$/.test(row.close), `${scene.dialogue_id}: reflection close must be an inner thought`);
    }
    // chars は振り返る相手の絞り込み。記憶のある相手だけを書く。
    if ('chars' in row) {
      assert(Array.isArray(row.chars) && row.chars.length, `${scene.dialogue_id}: reflection chars`);
      for (const id of row.chars) assert(memoryChars.has(id), `${scene.dialogue_id}: reflection chars has no memory for ${id}`);
    }
  }
}
// 第5章の回想は、交流した相手（人物タブの顔ぶれ）だけ。未交流でもスミさんで成立する（正本: 第5章「回想は本当にプレイした交流だけ」）。
const people = AFFINITY_CHARACTERS;
const ch5Reflection = reflections(scenes.get(eveScenes[5]))[0];
// 人物タブに出ても、第3・4章の前夜に浮かんだ大会の相手は第5章で繰り返さない（ch5_main.json の reflection の comment）。
// スティーブ（#2028）は♥5の締めくくりがあるので人物タブに出るが、記憶は第3章の前夜に浮かぶ低温の話だけ。
const eveRivals = ['saku', 'steve', 'volk', 'da_silva', 'sheikh', 'master_hookah'];
assert.deepEqual(ch5Reflection.chars, people.filter((id) => !eveRivals.includes(id)),
  'ch5 reflection must recall the People tab cast (status.js PEOPLE) except the chapter 3/4 eve rivals');
assert(people.includes('sumi'), 'ch5 reflection falls back to Sumi');
const routes = readJson('data/story_routes.json').chapters;
const chapterCast = {
  3: ['saku', 'steve', 'volk', 'mashiro', 'mukai_master'],
  4: ['da_silva', 'sheikh', 'master_hookah'],
};
for (const [chapter, cast] of Object.entries(chapterCast)) {
  const order = routes[chapter].before_eve;
  const eve = order.indexOf(eveScenes[chapter]);
  assert.equal(eve, order.length - 1, `chapter ${chapter}: the reflection must be in the last eve scene`);
  for (const charId of cast) {
    const before = (byChar[charId] || []).filter((m) => {
      const at = order.indexOf(m.dialogue_id);
      return at >= 0 && at < eve;
    });
    assert(before.length, `chapter ${chapter}: ${charId} needs a memory from a required scene before the eve`);
  }
}
// 第4章の顔ぶれ。旅装の男（シェイク）の正体は大会当日まで伏せるので、記憶の言葉にも名前を出さない。
const ch4Names = { da_silva: '太陽さん', sheikh: '路地裏のあの人', master_hookah: '王煙楼' };
for (const [charId, name] of Object.entries(ch4Names)) {
  for (const m of byChar[charId]) assert(m.echo.includes(name), `${m.id}: echo must name ${name}`);
}
assert(byChar.sheikh.every((m) => !/シェイク|王族|王者/.test(m.echo)), 'sheikh memory reveals his identity');

// 振り返りの組み立てを本物の relationships.js で確かめる（ブラウザ不要。PRのCIで毎回動く）。
// 第3章→第4章→第5章と必須場面の記憶が積み重なっても、前夜ごとに違う顔ぶれが浮かぶ。
const stub = (code) => `data:text/javascript,${encodeURIComponent(code)}`;
const relationshipSource = fs.readFileSync(new URL('remake/js/core/relationships.js', root), 'utf8')
  .replace('from "./data.js"', `from "${stub('export const DB = globalThis.__relationshipTest.DB;')}"`)
  .replace('from "./state.js"', `from "${stub('export const state = globalThis.__relationshipTest.state;')}"`);
assert(!/from "\.\//.test(relationshipSource), 'relationships.js gained an import; stub it here');
const reflectionState = { chapter: 1, relationshipMemories: [] };
globalThis.__relationshipTest = {
  DB: { relationshipMemories: Object.fromEntries(memories.map((m) => [m.id, m])) },
  state: reflectionState,
};
const { relationshipReflectionLines } = await import(`data:text/javascript;base64,${Buffer.from(relationshipSource).toString('base64')}`);
const texts = (line) => relationshipReflectionLines(line).map((l) => l.text);
const echoOf = Object.fromEntries(memories.map((m) => [m.id, m.echo]));
const lineOf = (chapter) => reflections(scenes.get(eveScenes[chapter]))[0];
const sceneMemories = (id) => rows(scenes.get(id).lines).filter((row) => row.type === 'remember').map((row) => row.memory_id);
const rememberAll = (ids) => { for (const id of ids) if (!reflectionState.relationshipMemories.includes(id)) reflectionState.relationshipMemories.push(id); };
// 未交流のプレイ: 第1章のスミさん、第2章の交流なし。
rememberAll(['sumi_heat', 'sumi_quiet', 'sumi_return']);
assert.deepEqual(texts({}), ['トングを持つ。誰かと過ごした時間が、ふとよみがえった。', ...['sumi_return'].map((id) => echoOf[id]),
  '（一緒に過ごした時間も、今の俺に残っている）'], 'default lead and the chapter 1 close');
Object.assign(reflectionState, { chapter: 3 });
for (const id of routes[3].before_eve) rememberAll(sceneMemories(id));
const ch3Eve = texts(lineOf(3));
assert.deepEqual(ch3Eve, ['saku_decide', 'steve_wait', 'volk_measure'].map((id) => echoOf[id]),
  'ch3 eve: only the three newest echoes (the narration leads in, Hajime\'s spoken doubt follows)');
Object.assign(reflectionState, { chapter: 4 });
for (const id of routes[4].before_eve) rememberAll(sceneMemories(id));
const ch4Eve = texts(lineOf(4));
assert.deepEqual(ch4Eve.slice(1, 4), ['da_silva_shop', 'sheikh_asked', 'master_hookah_wait'].map((id) => echoOf[id]), 'ch4 eve');
assert.equal(ch4Eve.at(-1), '（誰かにもらったものまで、消さなくていい）');
Object.assign(reflectionState, { chapter: 5 });
const ch5 = texts(lineOf(5));
const echoes = (lines) => lines.filter((t) => Object.values(echoOf).includes(t));
assert.deepEqual(echoes(ch5), ['sumi_return', 'mashiro_pace'].map((id) => echoOf[id]), 'ch5 recalls the People tab cast, not the rivals');
for (const earlier of [ch3Eve, ch4Eve]) {
  assert(echoes(ch5).every((t) => !earlier.includes(t)), 'ch5 reflection repeats an earlier eve');
}
assert.deepEqual(texts({ text: '', close: '', chars: ['nobody'] }), ['（まず、今の一台を確かめよう。急がなくていい）'],
  'no matching memory falls back to the plain line');

// 後日談は1本だけ読むので、前の後日談を前提にした「また」「さらに」で始めない。
for (const scene of readJson('data/dialogue/ending.json').dialogues) {
  for (const row of rows(scene.lines)) {
    const text = String(row.text || '');
    assert(!/^(また|さらに)別の日/.test(text), `${scene.dialogue_id}: ${text}`);
    assert(!/^別の日の/.test(text), `${scene.dialogue_id}: ${text}`);
  }
}

// 第5章の敗北は後日談へ直行する。台詞で再挑戦を約束しない。
const defeat = rows(scenes.get('ch5_second_cup_defeat').lines).map((row) => String(row.text || '')).join('\n');
assert(!/もう一度|試しますか|再挑戦/.test(defeat), 'ch5_second_cup_defeat promises a retry');

console.log(`OK: ${memories.length} memories across ${Object.keys(byChar).length} people, remember wiring, eve reflections ch1-5 (ch3/ch4 cast before the eve, ch3→ch4→ch5 recall different people), epilogue openers, ch5 defeat`);
