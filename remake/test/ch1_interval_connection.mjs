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
  'const after = DB.dialogues.ch1_tournament_after;',
  '() => play({ ...after, lines: after.lines.slice(0, tonariAt) }, { bg: STAGE }),',
  'id: "_sys_sumi_scoresheet"', 'title: "表彰式のあと"',
  '() => play({ ...after, lines: after.lines.slice(tonariAt) }),',
  '() => play("interval_day1_naru_lime"),', '() => gainStat("guts", 1),',
  'id: "_sys_unknown_recorded"', 'title: "優勝の夜"',
  '() => play("interval_day1_morning_win"),', '() => play("ch1_naru_promise"),',
  '() => play("interval_day2_adam_lime"),', '() => gainStat("insight", 1),',
  '() => play("interval_day5_eve"),', 'state.phase = "aftermath";',
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
// #2088: 優勝確定から余韻の各段ごとに保存し、再開は大会を作り直さず続きから。賞金は一度だけ。
assert.match(chapter, /state\.phase === "tournament" && state\.tournament\?\.victory\) return resumeVictory\(\);\n  if \(state\.phase === "tournament"\) return tournamentDay\(\);/);
assert.match(victory, /if \(!v\.paid\) \{[\s\S]*?addMoney\(PRIZE\);[\s\S]*?v\.paid = true;\n    save\(\);/);
assert.match(victory, /while \(v\.step < steps\.length\) \{\n    await steps\[v\.step\]\(\);\n    v\.step \+= 1;\n    save\(\);/);
assert.equal((victory.match(/addMoney\(/g) || []).length, 1, 'prize paid once');
const tday = chapter.slice(chapter.indexOf('if (out.rank === 1) {'), chapter.indexOf('await victory(cs);'));
assert(tday.indexOf('state.tournament.victory = { step: 0, revealed: false };') < tday.indexOf('ch1_tournament_judging'), 'victory marked before the long judging scene');
// 前夜の早寝は休養扱い（発熱予約を消し、その夜の告白を後回し）
const eve = chapter.slice(chapter.indexOf('if (progress.choice === "sleep_early") {'), chapter.indexOf('setFlag("_ev_last_night");\n  save();'));
assert(eve.includes('delete state.flags._cold_pending;') && eve.includes('state.flags._eve_slept = state.day;'));
assert.match(read('remake/js/daily/calendar.js'), /busyNight: metTonight \|\| rested \|\| state\.flags\._eve_slept === state\.day/);
assert.match(read('remake/js/daily/phone.js'), /function sumiBaitoInvite\(\{ tournamentDay = false, fixedNight = null \} = \{\}\) \{[\s\S]*?if \(!fixed && fixedNight\?\.\(state\.day\)\) return null;/);
// 祝福LIME（「帰ったら、一緒に一服しよう」）は、tonariの祝杯より前に届く。区切りの背景切替が祝杯の手前にあること。
const after = JSON.parse(read('data/dialogue/ch1_tournament.json')).dialogues
  .find(scene => scene.dialogue_id === 'ch1_tournament_after');
const tonariAt = after.lines.findIndex(line => line.type === 'bg' && line.bg?.includes('bg_tonari_inside'));
const toastAt = after.lines.findIndex(line => line.text === 'おう。よくやった。今日は一杯、付き合え');
assert(tonariAt > 0 && toastAt > tonariAt, 'the tonari toast follows the split point');
assert.match(victory, /"今日は喜べ。帰ったら、一緒に一服しよう"/);
assert.match(chapter, /import \{[^}]*\bgainStat\b[^}]*\} from "\.\.\/core\/stats\.js"/);

const morning = scenes.find(scene => scene.dialogue_id === 'interval_day1_morning_win');
assert.equal(morning.lines[0].text, '大会で優勝した翌朝。目が覚めて、まずトロフィーを探した。');
assert.equal(morning.lines[1].text, '……そうだ、店のカウンターに飾ったんだった。現実感が、まだ追いつかない。');
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
