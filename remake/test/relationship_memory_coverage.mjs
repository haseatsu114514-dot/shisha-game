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

console.log(`OK: ${memories.length} memories across ${Object.keys(byChar).length} people, remember wiring, epilogue openers, ch5 defeat`);
