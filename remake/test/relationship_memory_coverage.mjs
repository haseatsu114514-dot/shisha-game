// #1898: 回想の対象と後日談・敗北台本の文言を、データだけで確認する（ブラウザ不要）。
import assert from 'node:assert/strict';
import fs from 'node:fs';
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

// サメちゃん・ひより（恋人候補）と久世・スティーブ（第4章正本の調整の記憶）も第5章の回想に浮かぶ。
const byChar = {};
for (const m of memories) (byChar[m.char_id] ||= []).push(m);
const expected = {
  samechan: { scenes: ['samechan_shop_closing_check', 'samechan_bond_finale'], name: 'サメちゃん' },
  hiyori: { scenes: ['hiyori_work_talk', 'hiyori_axe_reveal_close'], name: 'ひより' },
  kuze: { scenes: ['ch3_kuze_advice'], name: '久世' },
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
for (const [, scene] of scenes) {
  for (const row of reflections(scene)) {
    // text は導入の地の文の差し替え（空文字は導入なし）。表示される1行なので48字以内。
    if ('text' in row) assert(typeof row.text === 'string' && width(row.text) <= 48, `${scene.dialogue_id}: reflection text`);
  }
}
const routes = readJson('data/story_routes.json').chapters;
const chapterCast = {
  3: ['kuze', 'steve', 'volk', 'mashiro', 'mukai_master'],
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
const ch4Names = { da_silva: '太陽さん', sheikh: '路地裏のあの人', master_hookah: '王煙楼さん' };
for (const [charId, name] of Object.entries(ch4Names)) {
  for (const m of byChar[charId]) assert(m.echo.includes(name), `${m.id}: echo must name ${name}`);
}
assert(byChar.sheikh.every((m) => !/シェイク|王族|王者/.test(m.echo)), 'sheikh memory reveals his identity');

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

console.log(`OK: ${memories.length} memories across ${Object.keys(byChar).length} people, remember wiring, eve reflections ch1-5 (ch3/ch4 cast before the eve), epilogue openers, ch5 defeat`);
