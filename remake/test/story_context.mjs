// Actual native VN handler + shared dialogue data. No DOM, assets or player storage.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { tournamentFinished } from '../js/core/story-context.js';
import { VISIT_SEQ } from '../js/core/affinity-stages.js';
const root = new URL('../../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const DB = {dialogues:{}};
for (const file of fs.readdirSync(new URL('data/dialogue/', root)).filter(f => f.endsWith('.json'))) {
  for (const scene of JSON.parse(read(`data/dialogue/${file}`)).dialogues || []) DB.dialogues[scene.dialogue_id] = scene;
}
const source = read('remake/js/vn/engine.js');
const start = source.indexOf('function handleCondition('), end = source.indexOf('\n}\n', start);
assert(start >= 0 && end > start);
const context = vm.createContext({DB, STAT_EN:{}, tournamentFinished, affinityLevel:()=>5,
  hooks:{evalCondition:line=>line.condition_type==='story_seen' ? context.storySeen(line.dialogue) : false}, jumpTo:()=>{throw Error('Unexpected cross-scene condition');}});
// VNの制作経験条件も、本番と同じ履歴判定を共有する（DOM・セーブ領域は使わない）。
vm.runInContext(read('remake/js/craft/practice-history.js').replace(/^import .*;\n/gm, '').replace(/^export /gm, ''), context);
vm.runInContext(source.slice(start,end+2),context);
const spotsSource=read('remake/js/daily/spots.js');
const seenStart=spotsSource.indexOf('function storySeen('), seenEnd=spotsSource.indexOf('\n}\n',seenStart);
Object.assign(context,{VISIT_SEQ,storyCount:id=>context.state.story?.[id] || 0});
vm.runInContext(spotsSource.slice(seenStart,seenEnd+2),context);
// Enumerate every choice, using the production condition handler for branch selection.
function paths(id, state, knownFlags = false) {
  const scene = DB.dialogues[id]; assert(scene, id);
  function run(queue, branches, value, out, budget=500) {
    assert(budget > 0, `Dialogue loop: ${id}`);
    if (!queue.length) return [out];
    const [line,...tail] = queue;
    if (line.type === 'condition') {
      const running = {queue:tail,branches};
      Object.assign(context,{running,state:value});context.handleCondition(line);
      return run(running.queue,branches,value,out,budget-1);
    }
    if (line.type === 'choice') return line.choices.flatMap(choice =>
      run([...(branches[choice.next] || []),...tail],branches,structuredClone(value),[...out,{text:choice.text}],budget-1));
    if (line.type === 'jump') {
      const target = DB.dialogues[line.next_id]; assert(target,line.next_id);
      return run(target.lines,target.branches || {},value,out,budget-1);
    }
    if (line.type === 'set_flag') value.flags[line.flag] = true;
    return run(tail,branches,value,[...out,line],budget-1);
  }
  const value = structuredClone(state);
  if (knownFlags) for (const row of JSON.stringify(scene).matchAll(/"flag":"([^"]+)"/g)) value.flags[row[1]]=true;
  return run(scene.lines,scene.branches || {},value,[]);
}
const state = (chapter,phase='daily',met={}) => ({chapter,phase,day:1,flags:{},met,stats:{},money:100000});
// #2056: 大会前・大会後・後続章でも、神崎の素性を公表済みとして扱わない。
for (const value of [state(2), state(2,'cleared'), state(3)]) {
  for (const id of ['ch2_tournament_entrance','ch2_kumicho_third','ch2_kumicho_fourth','ch2_kumicho_after_ch2']) {
    for (const rows of paths(id,value)) {
      const text=rows.map(row=>row.text || '').join('\n');
      assert.doesNotMatch(text,/昔は組を張って|昔の組|足は洗った|カタギの範囲|隠したまま同じ舞台|昔のことを自分から話して/,id);
      if(id==='ch2_tournament_entrance') assert.match(text,/今日は、いち職人として来た。文句なら、俺の煙に言いな/);
      if(id==='ch2_kumicho_fourth' && tournamentFinished(value,2)) {
        assert.match(text,/職人として来たって言ってましたね/);
        assert.match(text,/それ以上は、まだ分からない/);
      }
    }
  }
}
for (let target=1;target<=5;target++) {
  for (const phase of ['opening','daily','tournament','aftermath','cleared']) {
    const value=state(target,phase), before=JSON.stringify(value);
    assert.equal(tournamentFinished(value,target),['aftermath','cleared'].includes(phase));
    assert.equal(JSON.stringify(value),before);
  }
  assert.equal(tournamentFinished(state(target+1),target),true);
  if(target>1)assert.equal(tournamentFinished(state(target-1,'cleared'),target),false);
}
for(const bad of [undefined,null,0,-1,1.5,'2',NaN])assert.equal(tournamentFinished(state(5,'cleared'),bad),false);
const sensitive = /大会前|本番、よろしく|いよいよ大会|大会が近い|大会の日の煙|大会の……お守り|君の大会、見に行けない|なのに大会では|大会で戦うことになる|大会では焦り|大会の本番|今度の大会|大会出るの|大会のお願い|大会の日も描く|今回のSMOKE|大会ステージの準備|大会で使うん|参加登録はもう|大会に出す理由|SMOKE CROWN CUP、俺も出る|同じ卓で会おう|本番までに決めて/;
const effects = rows => rows.filter(r => ['remember','apply','set_flag','buy_keepsake','flavor_lesson'].includes(r.type)
  || r.text && /【.+】.*上がった/.test(r.text));
const fullRun = {scope:'full',success:true,served:true,kind:'practice'};
const sumiCases = [
  ['未体験', {}, false],
  ['未完了の手本', {_tutorial_requested:true}, false],
  ['旧スキップ', {_tutorial_done:true,_tutorial_skipped:true}, false],
  ['旧制作完了', {_tutorial_done:true}, true],
  ['制作1回', {_craft_practice_runs:[fullRun]}, true],
  ['制作複数回', {_craft_practice_runs:[fullRun,fullRun]}, true],
  ['吸い出し失敗', {_craft_practice_runs:[{...fullRun,success:false,served:false}]}, false],
  ['提供未完了', {_tutorial_done:true,_craft_practice_runs:[{...fullRun,kind:'tutorial',served:false}]}, false],
  ['調整練習だけ', {_craft_practice_runs:[{...fullRun,scope:'care'}]}, false],
];
const sumiFirst = paths('ch1_sumi_basics', state(1))[0];
for (const [label,flags,review] of sumiCases) for (const [chapter,phase] of [[1,'daily'],[1,'aftermath'],[2,'daily']]) {
  const value = {...state(chapter,phase),day:9,flags:structuredClone(flags)};
  const before = JSON.stringify(value);
  const rows = paths('ch1_sumi_basics', value)[0];
  assert.equal(rows.some(r=>r.text?.includes('今日は復習だ')), review, label);
  assert.deepEqual(rows.filter(r=>r.diagram).map(r=>r.diagram),
    review ? ['hose','hide'] : ['show','heat','smoke','bubble','hose','hide'], label);
  assert.deepEqual(effects(rows), effects(sumiFirst), `${label}: 記憶と技術報酬は各1回`);
  assert.equal(rows.filter(r=>r.type==='remember' && r.memory_id==='sumi_heat').length, 1);
  assert(rows.some(r=>r.text?.includes('今ここにある一台を見ろ')), `${label}: 記憶が参照する言葉を保持`);
  if (review) assert(rows.length < sumiFirst.length / 2, `${label}: 短い復習`);
  else assert.deepEqual(rows, sumiFirst, `${label}: 従来の説明を保持`);
  assert.deepEqual(paths('ch1_sumi_basics', JSON.parse(before))[0], rows, `${label}: 保存復元後も同じ分岐`);
  assert.equal(JSON.stringify(value), before, `${label}: 分岐だけで状態を変更しない`);
}
console.log(`PASS: スミの基礎説明 ${sumiCases.length * 3} 状態（制作履歴・旧セーブ・大会後・保存復元・図解・共通報酬）`);
// #1253: the private finale is valid before/after chapter 1's tournament and in later chapters.
// Exercise friendship, the final romance question and already-lover branches with the real VN condition handler.
const originalEval = context.hooks.evalCondition;
for (const route of ['friend', 'romance', 'lover']) {
  context.hooks.evalCondition = line => line.condition_type === 'lover' ? route === 'lover'
    : line.condition_type === 'romance_open' ? route === 'romance' : originalEval(line);
  const before = paths('ch1_minto_bond_finale', state(1));
  for (const [chapter, phase] of [[1, 'aftermath'], [2, 'daily'], [3, 'daily'], [4, 'daily'], [5, 'daily']]) {
    const value = state(chapter, phase);
    const after = paths('ch1_minto_bond_finale', JSON.parse(JSON.stringify(value)));
    assert.deepEqual(after, before, `Minto ${route} ch${chapter}/${phase}: same dialogue, choices and effects`);
    for (const rows of after) assert.doesNotMatch(rows.map(r => r.text || '').join('\n'), sensitive);
  }
}
context.hooks.evalCondition = originalEval;
console.log('PASS: Minto finale friendship/romance/lover chronology before tournament, aftermath and chapters 2–5');
const changed = ['ch1_naru_first','ch1_naru_second','ch1_naru_third','ch1_naru_fifth','ch1_naru_bond_finale',
  'ch1_minto_second','ch1_adam_fifth','ch1_tsumugi_fifth','ch1_tsumugi_smoke_color','ch1_rin_third','ch2_rei_first','ch2_rei_fifth','remake_ch2_kumicho_chat'];
let count=0;
for (const id of changed) {
  const target=id.includes('ch2_')?2:1;
  const pre=paths(id,state(target));
  assert(pre.some(rows=>sensitive.test(rows.map(r=>r.text||'').join('\n'))),`${id}: original pre-match dialogue retained`);
  for (const [chapter,phase] of [[target,'aftermath'],[target,'cleared'],[target+1,'daily'],[5,'daily']]) {
    const post=paths(id,state(chapter,phase));
    assert.equal(post.length,pre.length,`${id}: choices preserved`);
    post.forEach((rows,i)=> {
      assert.doesNotMatch(rows.map(r=>r.text||'').join('\n'),sensitive,`${id} ch${chapter}/${phase}`);
      assert.deepEqual(effects(rows),effects(pre[i]),`${id}: reward/memory/flags preserved`);
      count++;
    });
  }
}
for(const seen of [false,true]) {
  const value=state(1,'tournament');value.story={naru:seen?VISIT_SEQ.naru.length:1};
  for(const rows of paths('ch1_naru_promise',value)) {
    const text=rows.map(r=>r.text||'').join('\n');
    if(seen)assert.match(text,/約束、覚えてたか/);
    else {assert.doesNotMatch(text,/約束、覚えてたか/);assert.match(text,/今日はお前の一台/);}
  }
}
// Audit every connected chapter-1 affinity stage, including choice branches and prior knowledge.
for (const id of Object.values(VISIT_SEQ).flat()) for(const known of [false,true]) {
  for(const rows of paths(id,state(3,'daily'),known)) {
    assert.doesNotMatch(rows.map(r=>r.text||'').join('\n'),sensitive,id);count++;
  }
}
for(const scene of Object.values(DB.dialogues).filter(s => s.dialogue_id.startsWith('interaction_') || s.dialogue_id.startsWith('outing_') || JSON.stringify(s).includes('tournament_finished'))) {
  for(const rows of paths(scene.dialogue_id,state(5)))assert.doesNotMatch(rows.map(r=>r.text||'').join('\n'),sensitive,scene.dialogue_id);
}
for(const [id,char] of [['ch1_minto_first','minto'],['ch2_rei_first','rei'],['ch2_kumicho_first','kumicho']]) {
  for(const rows of paths(id,state(3,'daily',{[char]:true}))) {
    assert.doesNotMatch(rows.map(r=>r.text||'').join('\n'),/はじめまして|初めまして|見ねえ顔|蒸野といいます|俺は神崎/,`${id}: already met`);
  }
}
for(const id of ['ch1_adam_after_ch1','ch1_minto_after_ch1','ch1_naru_after_return','ch2_kumicho_after_ch2']) {
  const expected=paths(id,state(3));
  assert.deepEqual(paths(id+'_firstshop',state(3)),expected,`${id}: old ID reaches same familiar aftermath, rewards once`);
}
// Every newly authored context condition must name its tournament and both local branches.
for(const scene of Object.values(DB.dialogues)) {
  function validate(node) {
    if(!node || typeof node!=='object')return;
    if(node.condition_type==='tournament_finished') {
      assert(Number.isInteger(node.tournament_chapter) && node.tournament_chapter>0,scene.dialogue_id);
      assert(scene.branches?.[node.next_true]?.length && scene.branches?.[node.next_false]?.length,scene.dialogue_id);
    }
    Object.values(node).forEach(validate);
  }
  validate(scene);
}
console.log(`PASS: shared tournament context chapters 1–5; ${count} dialogue paths, effects and familiar aftermath aliases`);
