import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), 'utf8');
const scenes = JSON.parse(read('data/dialogue/ch1_interval.json')).dialogues;
const expected = [
  'interval_day1_morning_win', 'interval_day1_naru_lime',
  'interval_day2_adam_lime', 'interval_day3_sumi_call', 'interval_day5_eve',
];
assert.deepEqual(scenes.map(scene => scene.dialogue_id).sort(), [...expected].sort());

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sortKeys(value[key])]));
  }
  return value;
}
const sumi = scenes.find(scene => scene.dialogue_id === 'interval_day3_sumi_call');
// The supplied digest uses UTF-8 JSON with spaces after commas and colons
// (json.dumps(sort_keys=True, ensure_ascii=False) separators).
function stringify(value) {
  if (Array.isArray(value)) return `[${value.map(stringify).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value).map(([key, item]) => `${JSON.stringify(key)}: ${stringify(item)}`).join(', ')}}`;
  }
  return JSON.stringify(value);
}
assert.equal(createHash('sha256').update(stringify(sortKeys(sumi))).digest('hex'),
  '186935cd6f1ee864150edb8d3d9d415a98ecd2871fcc2a67dbcd4e41f5616465');
const legacy = JSON.parse(read('data/dialogue/_legacy/forced_events.json')).interval_1;
assert(!legacy.some(entry => entry.id === 'interval_day1_morning'));
assert(legacy.some(entry => entry.id === 'interval_day3_sumi_call'));

const data = read('remake/js/core/data.js');
const files = data.match(/const DIALOGUE_FILES = \[([\s\S]*?)\];/);
assert(files, 'DIALOGUE_FILES declaration exists');
assert.match(files[1], /"ch1_interval"/);
const chapter = read('remake/js/chapters/ch1.js');
const start = chapter.indexOf('async function victory(');
const end = chapter.indexOf('\nasync function finishAfterTournament(', start);
assert(start >= 0 && end > start, 'victory function boundaries exist');
const victory = chapter.slice(start, end);
const sequence = [
  'await play("ch1_tournament_after", { bg: STAGE });',
  'await play("interval_day1_naru_lime");', 'gainStat("guts", 1);',
  'await openPhone(', 'title: "優勝の夜"',
  'await play("interval_day1_morning_win");', 'await play("ch1_naru_promise");',
  'await play("interval_day2_adam_lime");', 'gainStat("insight", 1);',
  'await play("interval_day5_eve");', 'state.phase = "aftermath";',
];
let previous = -1;
for (const call of sequence) {
  const index = victory.indexOf(call);
  assert(index > previous, `${call} exists in the required order`);
  assert.equal(victory.indexOf(call, index + 1), -1, `${call} occurs once`);
  previous = index;
}
assert.equal((victory.match(/\bgainStat\(/g) || []).length, 2, 'Only the two announced rewards');
assert.doesNotMatch(chapter, /play\("interval_day3_sumi_call"/);
assert.match(chapter, /import \{[^}]*\bgainStat\b[^}]*\} from "\.\.\/core\/stats\.js"/);

assert.equal(scenes.find(scene => scene.dialogue_id === 'interval_day1_morning_win').lines[0].text,
  '大会で優勝した翌朝。目が覚めて、まずトロフィーを探した。……そうだ、店のカウンターに飾ったんだった。現実感がまだ追いついていない。');
console.log('PASS: interval IDs, unchanged Sumi hash, legacy entries, loader, victory order, rewards and trophy continuity');
const remaining = [];
function scan(directory) {
  for (const entry of fs.readdirSync(new URL(directory, root), { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) scan(path);
    else if (entry.isFile()) {
      const bytes = fs.readFileSync(new URL(path, root));
      if (!bytes.includes(0)) {
        bytes.toString('utf8').split('\n').forEach((line, index) => {
          // 完全なID一致だけを残存参照とする。interval_day1_morning_done は残す優勝版の完了フラグと
          // 周回引き継ぎ分類で使われる別識別子であり、削除場面への参照ではないため対象外。
          if (/interval_day1_morning(?!\w)/.test(line)) remaining.push(`${path}:${index + 1}: ${line.trim()}`);
        });
      }
    }
  }
}
scan('data');
scan('remake/js');
assert.deepEqual(remaining, [], 'No references matching /interval_day1_morning(?!\\w)/');
console.log('PASS: Chapter 1 interval IDs, unchanged Sumi, loader, victory order, rewards and trophy continuity');
