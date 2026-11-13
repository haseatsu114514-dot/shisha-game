// 東京の mukai のシフトの注文（chapters/tokyo-mukai.js・VOL09）。#2020 E: 一度シフトに入った次の日からは、
// 知らない客に何を聞くか・あいまいな注文をどう読むかを選ぶ「任される注文」も混ざる。最初のシフトは従来の4種だけ。
// ブラウザ不要。注文表と選び方の部分だけを取り出して動かす（shift_mix_record.mjs と同じやり方）。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const source = read("remake/js/chapters/tokyo-mukai.js");
const start = source.indexOf("export const MUKAI_ORDERS");
const fnStart = source.indexOf("export function mukaiOrderOf");
const end = source.indexOf("\n}\n", fnStart) + 2;
assert(start >= 0 && fnStart > start && end > fnStart);
const flagName = source.match(/export const MUKAI_SHIFT_FLAG = "([^"]+)"/)?.[1];
assert.equal(flagName, "_mukai_shift_day");
const body = source.slice(start, end).replace(/^export /gm, "");
const api = vm.runInNewContext(`const MUKAI_SHIFT_FLAG = ${JSON.stringify(flagName)}; const state = null;\n${body}\n({ MUKAI_ORDERS, MUKAI_REACTION_IDS, mukaiEntrusted, mukaiOrderOf })`, {});
const { MUKAI_ORDERS, MUKAI_REACTION_IDS, mukaiEntrusted, mukaiOrderOf } = api;

const BASE = ["after_coffee", "light_break", "sweet_latte", "slow_heavy"];
const ENTRUSTED = ["first_timer", "anything_fine", "tokyo_like", "celebration"];
assert.deepEqual([...MUKAI_ORDERS.map(order => order.id)], [...BASE, ...ENTRUSTED]);
assert.deepEqual([...MUKAI_ORDERS.filter(order => order.entrusted).map(order => order.id)], ENTRUSTED);

// 注文表: 二択で、配合は実在の葉・合計12g。選択肢は1行に収まる短さ（会話の選択肢と同じ26字以内）。
const flavors = new Set(JSON.parse(read("data/flavors.json")).flavors.map(flavor => flavor.id));
for (const order of MUKAI_ORDERS) {
  assert.equal(order.labels.length, 2, order.id);
  assert.equal(order.mixes.length, 2, order.id);
  for (const label of order.labels) assert([...label].length <= 26, `${order.id}: ${label}`);
  for (const mix of order.mixes) {
    assert.equal(Object.values(mix).reduce((sum, grams) => sum + grams, 0), 12, `${order.id}: 12g`);
    for (const id of Object.keys(mix)) assert(flavors.has(id), `${order.id}: unknown flavor ${id}`);
  }
  if (order.entrusted) assert(order.ask, `${order.id}: the entrusted order asks what to do before making`);
}

// 台詞: 反応はすべて mukai_shift.json にある。任される注文は、聞き出す注文なら先にはじめが尋ね、客が答える。
const dialogues = Object.fromEntries(JSON.parse(read("data/dialogue/mukai_shift.json")).dialogues.map(d => [d.dialogue_id, d]));
for (const id of MUKAI_REACTION_IDS) assert(dialogues[id]?.lines?.length, id);
for (const id of ["first_timer", "anything_fine"]) for (const index of [0, 1]) {
  const [question, answer] = dialogues[`mukai_shift_${id}_${index}`].lines;
  assert.equal(question.speaker, "hajime", `${id}_${index}: hajime asks first`);
  assert.equal(answer.speaker, "customer", `${id}_${index}: the customer answers`);
}
for (const [id, scene] of Object.entries(dialogues)) {
  for (const line of scene.lines) {
    assert(["", "customer", "hajime", "mukai_master"].includes(line.speaker), `${id}: ${line.speaker}`);
    // 味覚が戻る前の第3章でも読めるよう、はじめ自身が味を確かめる言い方をしない
    if (line.speaker === "hajime") assert(!/吸ってみ|味見|舌で/.test(line.text), `${id}: ${line.text}`);
  }
}

// 任されるのは、前の日までにシフトに入ってから。今日入った後も今日の候補は変わらない（同じ日は同じ注文）。
const at = (day, last, extra = {}) => ({ chapter: 3, day, weatherSeed: 5, flags: last === undefined ? {} : { [flagName]: last }, ...extra });
assert.equal(mukaiEntrusted(at(33)), false, "never worked");
assert.equal(mukaiEntrusted(at(33, 33)), false, "worked only today");
assert.equal(mukaiEntrusted(at(34, 33)), true, "worked on an earlier day");
assert.equal(mukaiEntrusted(at(34, "33")), false, "a broken record is not trusted");
assert.equal(mukaiEntrusted({ chapter: 3, day: 34 }), false, "no flags");
const seen = { first: new Set(), later: new Set(), ch5: new Set() };
for (let seed = 0; seed < 200; seed++) {
  seen.first.add(mukaiOrderOf(at(33 + (seed % 5), undefined, { weatherSeed: seed })).id);
  seen.later.add(mukaiOrderOf(at(40 + (seed % 5), 35, { weatherSeed: seed })).id);
  // 第5章の東京では、第3章で入ったシフトの記録がそのまま効く
  seen.ch5.add(mukaiOrderOf({ chapter: 5, day: 90 + (seed % 7), weatherSeed: seed, flags: { [flagName]: 44 } }).id);
}
assert.deepEqual([...seen.first].sort(), [...BASE].sort(), "the first shift is one of the plain orders");
assert.deepEqual([...seen.later].sort(), [...BASE, ...ENTRUSTED].sort(), "later shifts also hand over the entrusted orders");
assert.deepEqual([...seen.ch5].sort(), [...BASE, ...ENTRUSTED].sort());
for (let seed = 0; seed < 40; seed++) {
  const value = at(40, 35, { weatherSeed: seed });
  assert.equal(mukaiOrderOf(value).id, mukaiOrderOf(structuredClone(value)).id, "same day, same order");
}
console.log("mukai shift orders (#2020 E): OK");
