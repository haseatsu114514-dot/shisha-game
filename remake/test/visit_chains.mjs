// 通いの続きの小さな出来事（#2020 D・chapters/visit-chains.js）: 開く条件・後日・夜・一度だけの記録・壊れた保存・
// 台本の選択と条件（全部の選び方を辿る）・交流の記憶・周回の扱いを、ブラウザなしで確かめる。
// node remake/test/visit_chains.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VISIT_CHAINS, VISIT_CHAINS_FLAG, VISIT_CHAINS_FILE, VISIT_CHAIN_DIALOGUE_IDS, chainRecord, chainFinished, nextChainStage,
  chainStageAt, recordChainStage, chainCondition } from "../js/chapters/visit-chains.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";

const readJson = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const scenes = Object.fromEntries(readJson(`../../data/dialogue/${VISIT_CHAINS_FILE}.json`).dialogues.map(d => [d.dialogue_id, d]));
const memories = readJson("../../data/relationship_memories.json").memories;
const save = (extra = {}) => ({ chapter: 3, day: 40, slot: 0, phase: "daily", flags: {}, ...extra });

// ---- 開く条件: その章の日常で、行き先の巡回を一通り読んだ（mukai は2回働いた）後だけ ---------------------------
{
  const s = save();
  assert.equal(chainStageAt(s, "mukai"), null, "mukai で働く前は開かない");
  s.flags._ch3_outings = { mukai_help: 1 };
  assert.equal(chainStageAt(s, "mukai"), null, "1回では開かない");
  s.flags._ch3_outings = { mukai_help: 1, mukai_steve: 1 };
  assert.deepEqual(chainStageAt(s, "mukai"), { id: "ch3_tofu", stage: VISIT_CHAINS.ch3_tofu.stages[0] }, "手伝いと店番で2回");
  assert.equal(chainStageAt({ ...s, chapter: 4 }, "mukai"), null, "第3章の東京の外では開かない");
  for (const broken of [null, 3, "x", [], { mukai_help: "a" }, { mukai_help: -5 }]) {
    assert.equal(chainStageAt(save({ flags: { _ch3_outings: broken } }), "mukai"), null, `壊れた回数 ${JSON.stringify(broken)}`);
  }
  const cafe = save({ chapter: 4, flags: { _ch4_dubai_talks: { center_cafe: 2 } } });
  assert.equal(chainStageAt(cafe, "center_cafe"), null, "再訪の会話2本では開かない");
  cafe.flags._ch4_dubai_talks.center_cafe = 3;
  assert.equal(chainStageAt(cafe, "center_cafe")?.stage.id, "ch4_chain_bowl_1");
  assert.equal(chainStageAt(cafe, "inn"), null, "宿の段は、カフェの段の後");
  const steve = save({ chapter: 5, flags: { _ch5_tokyo_talks: { ch5_tokyo_steve: 2 } } });
  assert.equal(chainStageAt(steve, "ch5_tokyo_steve"), null);
  steve.flags._ch5_tokyo_talks.ch5_tokyo_steve = 3;
  assert.equal(chainStageAt(steve, "ch5_tokyo_steve")?.stage.id, "ch5_chain_guest_1");
  assert.equal(chainStageAt(steve, "ch5_tokyo_volk"), null, "ヴォルクの店には無い");
  const alley = save({ chapter: 5, flags: { _ch5_dubai_talks: { ch5_dubai_alley: 3 } } });
  assert.equal(chainStageAt(alley, "ch5_dubai_alley")?.stage.id, "ch5_chain_gift_1");
}

// ---- 後日・夜・一度だけ。読み取りは保存を変えない ----------------------------------------------------------
{
  const s = save({ flags: { _ch3_outings: { mukai_help: 2 } } });
  const before = structuredClone(s);
  for (let i = 0; i < 3; i++) chainStageAt(s, "mukai");
  nextChainStage(s, "ch3_tofu"); chainRecord(s, "ch3_tofu"); chainFinished(s, "ch3_tofu");
  assert.deepEqual(s, before, "読み取りで保存が変わった");
  assert.equal(recordChainStage(s, "ch3_tofu", "ch3_chain_tofu_2", "own"), false, "順番を飛ばして記録しない");
  assert.deepEqual(s, before);
  assert.equal(recordChainStage(s, "nobody", "ch3_chain_tofu_1", "coal"), false);
  assert(recordChainStage(s, "ch3_tofu", "ch3_chain_tofu_1", "leaf"));
  assert.deepEqual(s.flags[VISIT_CHAINS_FLAG], { ch3_tofu: { done: 1, day: 40, picks: { ch3_chain_tofu_1: "leaf" } } });
  assert.equal(recordChainStage(s, "ch3_tofu", "ch3_chain_tofu_1", "coal"), false, "同じ段を二度記録しない");
  assert.equal(chainRecord(s, "ch3_tofu").picks.ch3_chain_tofu_1, "leaf", "最初の答えのまま");
  assert.equal(chainStageAt(s, "mukai"), null, "同じ日には次の段を出さない（後日）");
  s.slot = 1;
  assert.equal(chainStageAt(s, "mukai"), null, "同じ日の夜でも出さない");
  s.day = 41; s.slot = 0;
  assert.equal(chainStageAt(s, "mukai")?.stage.id, "ch3_chain_tofu_2", "翌日に次の段");
  assert(recordChainStage(s, "ch3_tofu", "ch3_chain_tofu_2", "bogus"), "知らない答えでも段は進む");
  assert.equal(chainRecord(s, "ch3_tofu").picks.ch3_chain_tofu_2, undefined, "知らない答えは残さない");
  s.day = 42;
  assert(recordChainStage(s, "ch3_tofu", "ch3_chain_tofu_3"));
  assert(chainFinished(s, "ch3_tofu"));
  s.day = 50;
  assert.equal(chainStageAt(s, "mukai"), null, "終わった後は出さない");

  const night = save({ chapter: 5, day: 70, flags: { _ch5_dubai_talks: { ch5_dubai_alley: 3 } } });
  assert(recordChainStage(night, "ch5_alley_gift", "ch5_chain_gift_1", "house"));
  night.day = 71;
  assert.equal(chainStageAt(night, "ch5_dubai_alley"), null, "閉店後の段は昼に出さない");
  night.slot = 1;
  assert.equal(chainStageAt(night, "ch5_dubai_alley")?.stage.id, "ch5_chain_gift_2");
  assert(VISIT_CHAINS.ch5_alley_gift.stages[1].free, "閉店後の段は代金を取らない");
}

// ---- 壊れた保存値は未着手（または範囲内）として読み、例外にしない -------------------------------------------
for (const bad of [null, 1, "x", [], { ch3_tofu: null }, { ch3_tofu: { done: "a", day: "b", picks: [] } },
  { ch3_tofu: { done: 99, day: 1.5, picks: { ch3_chain_tofu_1: "nope", other: "coal" } } }]) {
  const s = save({ flags: { [VISIT_CHAINS_FLAG]: bad, _ch3_outings: { mukai_help: 2 } } });
  const record = chainRecord(s, "ch3_tofu");
  assert(record.done >= 0 && record.done <= 3, JSON.stringify(bad));
  assert.equal(record.day, null);
  assert.deepEqual(record.picks, {});
}
assert.deepEqual(chainRecord(save(), "unknown"), { done: 0, day: null, picks: {} });

// ---- 台本の条件 ---------------------------------------------------------------------------------------
{
  const s = save({ flags: { [VISIT_CHAINS_FLAG]: { ch3_tofu: { done: 2, day: 40, picks: { ch3_chain_tofu_1: "wait", ch3_chain_tofu_2: "own" } } } } });
  const pick = (scene, value) => ({ condition_type: "chain_pick", scene, pick: value });
  assert.equal(chainCondition(s, pick("ch3_chain_tofu_1", "wait")), true);
  assert.equal(chainCondition(s, pick("ch3_chain_tofu_1", "coal")), false);
  assert.equal(chainCondition(s, pick("ch3_chain_tofu_2", "own"), { pending: { ch3_chain_tofu_2: "watch" } }), false, "読んでいる段の答えが先");
  assert.equal(chainCondition(s, pick("nowhere", "x")), false);
  assert.equal(chainCondition(s, { condition_type: "chain_pick", scene: 1 }), false);
  assert.equal(chainCondition(s, { condition_type: "chain_fact", fact: "inn_trial", value: "good" }, { facts: { inn_trial: "good" } }), true);
  assert.equal(chainCondition(s, { condition_type: "chain_fact", fact: "inn_trial", value: "good" }, { facts: {} }), false);
  assert.equal(chainCondition(s, { condition_type: "flag", flag: "_x" }), undefined, "ほかの条件は本編の判定へ");
}

// ---- 台本: 段・選択肢・条件・分岐のつながり ---------------------------------------------------------------
const rows = node => Array.isArray(node) ? node.flatMap(rows) : node && typeof node === "object" ? [node, ...Object.values(node).flatMap(rows)] : [];
assert.deepEqual(Object.keys(scenes).sort(), [...VISIT_CHAIN_DIALOGUE_IDS].sort(), "台本と段の一覧が一致しない");
for (const [chainId, chain] of Object.entries(VISIT_CHAINS)) {
  assert(chain.stages.length >= 2 && chain.stages.length <= 3, `${chainId}: 2〜3段で区切る`);
  chain.stages.forEach((stage, index) => {
    const scene = scenes[stage.id];
    const all = rows([scene.lines, scene.branches || {}]);
    const choices = all.filter(row => row.type === "choice");
    if (stage.choice) {
      const own = choices.filter(row => row.id === stage.choice);
      assert.equal(own.length, 1, `${stage.id}: 選択肢 ${stage.choice}`);
      assert.deepEqual(own[0].choices.map(c => c.next), [...stage.picks], `${stage.id}: 分岐名と記録する答え`);
    } else assert.equal(stage.picks.length, 0, stage.id);
    for (const row of all.filter(row => row.type === "condition")) {
      for (const key of [row.next_true, row.next_false]) assert(!key || scene.branches?.[key], `${stage.id}: 分岐 ${key} が無い`);
      if (row.condition_type === "chain_pick") {
        const at = chain.stages.findIndex(entry => entry.id === row.scene);
        assert(at >= 0 && at <= index, `${stage.id}: ${row.scene} は同じ連なりの前の段（か読んでいる段）`);
        assert(chain.stages[at].picks.includes(row.pick), `${stage.id}: ${row.scene} に答え ${row.pick} は無い`);
      } else assert.equal(row.condition_type, "chain_fact", `${stage.id}: 連なりの台本は chain_pick / chain_fact で分ける`);
    }
    if (stage.label) assert(stage.label.length <= 26, `${stage.id}: 選択肢の字数`);
  });
}
// 第4章の宿の試作の結果だけが chain_fact（作っていなければ触れない）
const facts = Object.values(scenes).flatMap(scene => rows([scene.lines, scene.branches || {}]).filter(row => row.condition_type === "chain_fact")
  .map(row => `${scene.dialogue_id}:${row.fact}:${row.value}`));
assert.deepEqual([...new Set(facts)].sort(), ["ch4_chain_bowl_3:inn_trial:failed", "ch4_chain_bowl_3:inn_trial:good", "ch4_chain_bowl_3:inn_trial:rough"]);

// ---- 全部の選び方を、本編の読み方（選択→分岐を差し込む・条件→分岐を差し込む）で辿る ---------------------------------
// 段ごとに、読み終えた時の記録（visit-chain-play.js と同じ: 選んだ答えは読み終えた時だけ残す）と本文を確かめる。
function readStage(value, chainId, stage, choose, factsNow = {}) {
  const scene = scenes[stage.id];
  const pending = {};
  const queue = [...scene.lines];
  const texts = [];
  const remembered = [];
  while (queue.length) {
    const line = queue.shift();
    if (line.type === "choice") {
      const choice = line.choices[choose(line)];
      assert(choice, `${stage.id}: 選べない`);
      if (line.id === stage.choice) pending[stage.id] = choice.next;
      queue.unshift(...scene.branches[choice.next]);
    } else if (line.type === "condition") {
      const ok = chainCondition(value, line, { pending, facts: factsNow });
      assert.equal(typeof ok, "boolean", `${stage.id}: 条件 ${line.condition_type}`);
      const key = ok ? line.next_true : line.next_false;
      if (key) queue.unshift(...scene.branches[key]);
    } else if (line.type === "remember") remembered.push(line.memory_id);
    else if (!line.type) texts.push(line.text);
    else assert.fail(`${stage.id}: 想定外の行 ${line.type}`);
  }
  assert(recordChainStage(value, chainId, stage.id, pending[stage.id] ?? null), `${stage.id}: 記録できない`);
  return { texts, remembered };
}
const combos = lists => lists.reduce((all, list) => all.flatMap(prefix => list.map(item => [...prefix, item])), [[]]);
const opened = {
  ch3_tofu: { chapter: 3, flags: { _ch3_outings: { mukai_help: 2 } } },
  ch4_second_bowl: { chapter: 4, flags: { _ch4_dubai_talks: { center_cafe: 3 } } },
  ch5_steve_guest: { chapter: 5, flags: { _ch5_tokyo_talks: { ch5_tokyo_steve: 3 } } },
  ch5_alley_gift: { chapter: 5, slot: 1, flags: { _ch5_dubai_talks: { ch5_dubai_alley: 3 } } },
};
const endings = {};
for (const [chainId, chain] of Object.entries(VISIT_CHAINS)) {
  const pickLists = chain.stages.map(stage => stage.picks.length ? stage.picks.map((_, i) => i) : [null]);
  const factList = chainId === "ch4_second_bowl" ? ["good", "rough", "failed", "none"] : [undefined];
  for (const fact of factList) for (const indexes of combos(pickLists)) {
    const value = save({ ...structuredClone(opened[chainId]), day: 60 });
    const read = [];
    chain.stages.forEach((stage, i) => {
      const due = chainStageAt(value, stage.place);
      assert.equal(due?.stage.id, stage.id, `${chainId} ${indexes}: ${stage.id} が出ない`);
      read.push(readStage(value, chainId, stage, () => indexes[i] ?? 0, fact ? { inn_trial: fact } : {}));
      value.day += 1;
    });
    assert(chainFinished(value, chainId));
    const record = chainRecord(value, chainId);
    chain.stages.forEach((stage, i) => {
      if (stage.picks.length) assert.equal(record.picks[stage.id], stage.picks[indexes[i]], `${chainId}: 答えの記録`);
    });
    for (const { texts } of read) {
      assert(texts.length >= 6, `${chainId}: 段が短すぎる`);
      for (const text of texts) assert(typeof text === "string" && text.length > 0);
    }
    const last = read.at(-1).texts.join("\n");
    (endings[chainId] ||= new Map()).set(`${indexes}|${fact}`, last);
    // 交流の記憶は最後の段で一度だけ（第3・4章の連なり）
    const remembered = read.flatMap(r => r.remembered);
    assert.deepEqual(remembered, { ch3_tofu: ["tofu_regular_throat"], ch4_second_bowl: ["dubai_cafe_second_bowl"] }[chainId] || []);
  }
}
// 先の答えで、最後の段の言葉が変わる（全部の組み合わせが別の文になる）
for (const [chainId, map] of Object.entries(endings)) {
  assert.equal(new Set(map.values()).size, map.size, `${chainId}: 答えの違いが最後の段に返っていない`);
}

// ---- 交流の記憶: 最後の段の remember と対応し、前夜の振り返りに出る内心の形 ----------------------------------------
for (const id of ["tofu_regular_throat", "dubai_cafe_second_bowl"]) {
  const memory = memories.find(m => m.id === id);
  assert(memory, id);
  assert(/^（.+）$/.test(memory.echo), id);
  assert(rows(scenes[memory.dialogue_id].lines).some(row => row.type === "remember" && row.memory_id === id), id);
}

// ---- 周回: 進行として持ち越さない ---------------------------------------------------------------------------
assert.equal(classifyFlag(VISIT_CHAINS_FLAG), "progression");
assert.equal(flagVerdict(VISIT_CHAINS_FLAG), "reset");

console.log(`OK: ${Object.keys(VISIT_CHAINS).length} visit chains (${VISIT_CHAIN_DIALOGUE_IDS.length} scenes): opening, later-day/night gating, once-only records, broken saves, every pick path, memories, NG+`);
