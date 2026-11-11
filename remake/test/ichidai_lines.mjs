// カードゲーム「一台勝負」の相手の一言（#3244 項目3。ブラウザ不要）。
//   1. 台詞（data/dialogue/ichidai_lines.json）の形: 場面ID・実在する話者と表情・吹き出し1枚に収まる長さ・文末に句点なし・手動改行なし
//   2. 対戦相手になりうるキャラ（本編の卓と試遊ページの既定）に、全部の場面の台詞がある
//   3. 出来事 → 場面の決め方と優先順位、選び方
//   4. CPUどうしの対戦で、一言にする出来事にはいつも台詞が見つかる。早送り・CPU自動では出さない
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CARD } from "../js/minigames/ichidai-data.js";
import { createGame, act } from "../js/minigames/ichidai-rules.js";
import { aiAct } from "../js/minigames/ichidai-ai.js";
import { indexLines, triggersOf, pickLine, attachIchidaiLines } from "../js/minigames/ichidai-lines.js";

const read = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const DATA = JSON.parse(read("data/dialogue/ichidai_lines.json"));
const LINES = indexLines(DATA);
const chars = JSON.parse(read("data/characters.json"));
const CHAR_IDS = new Set((Array.isArray(chars) ? chars : chars.characters).map((c) => c.id));
const PORTRAITS = JSON.parse(read("remake/data/manifest.json")).portraits;
const SCENES = ["start", "play_tech", "play_tool", "play_event", "play_person", "foe_just", "foe_scorch", "hajime_just", "hajime_scorch", "foe_vote", "hajime_vote", "foe_win", "foe_lose", "draw"];
const MAX_CHARS = 18; // 吹き出し1枚（幅420px・20px）に1〜2行で収まる長さ

// ── 1. 台詞の形 ──
const owners = new Set();
for (const d of DATA.dialogues) {
  const m = /^ichidai_([a-z0-9_]+?)_(start|play_card_[a-z_]+|play_[a-z]+|foe_just|foe_scorch|hajime_just|hajime_scorch|foe_vote|hajime_vote|foe_win|foe_lose|draw)$/.exec(d.dialogue_id);
  assert.ok(m, `場面ID ${d.dialogue_id}`);
  const [, who, scene] = m;
  owners.add(who);
  assert.ok(CHAR_IDS.has(who), `${d.dialogue_id}: ${who} は characters.json にいない`);
  if (scene.startsWith("play_card_")) assert.ok(CARD[scene.slice(10)], `${d.dialogue_id}: カードが無い`);
  else assert.ok(SCENES.includes(scene), `${d.dialogue_id}: 知らない場面`);
  assert.ok(d.lines.length >= 1, `${d.dialogue_id}: 候補が無い`);
  for (const l of d.lines) {
    assert.equal(l.speaker, who, `${d.dialogue_id}: 話者は場面IDの相手と同じ`);
    assert.ok(PORTRAITS[who]?.faces.includes(l.face), `${d.dialogue_id}: ${who} に表情 ${l.face} が無い`);
    assert.ok(!/\n/.test(l.text), `${l.text}: 手動改行`);
    assert.ok(!/。$/.test(l.text), `${l.text}: 文末に句点`);
    assert.ok([...l.text].length <= MAX_CHARS, `${l.text}: ${MAX_CHARS}字を超える`);
  }
}
assert.equal(new Set(DATA.dialogues.map((d) => d.dialogue_id)).size, DATA.dialogues.length, "場面IDの重複");

// ── 2. 対戦相手になりうるキャラ全員に、全部の場面 ──
const opponents = new Set();
for (const p of ["remake/js/daily/ichidai-table.js", "remake/js/ichidai-page.js"]) {
  for (const m of read(p).matchAll(/opponent: \{ id: (?:params\.get\("face"\) \|\| )?"([a-z_]+)"/g)) opponents.add(m[1]);
}
assert.ok(opponents.size > 0, "対戦相手の指定が見つからない");
for (const who of new Set([...opponents, ...owners])) {
  for (const s of SCENES) assert.ok(LINES[`ichidai_${who}_${s}`]?.length, `${who} に場面 ${s} の台詞が無い`);
}

// ── 3. 場面の決め方と選び方 ──
{
  const res = (me, foe) => [{ zone: me }, { zone: foe }];
  assert.deepEqual(triggersOf({ t: "play", p: 1, id: "hype" }), ["play_card_hype", "play_event"]);
  assert.deepEqual(triggersOf({ t: "play", p: 0, id: "hype" }), [], "はじめが使ったカードには相手は喋らない");
  assert.deepEqual(triggersOf({ t: "play", p: 1, id: "flat" }), [], "炭は一言にしない");
  assert.deepEqual(triggersOf({ t: "score", res: res("band", "scorch"), voter: 0 }), ["foe_scorch", "hajime_vote"]);
  assert.deepEqual(triggersOf({ t: "score", res: res("just", "band"), voter: 0 }), ["hajime_just", "hajime_vote"]);
  assert.deepEqual(triggersOf({ t: "score", res: res("scorch", "just"), voter: 1 }), ["hajime_scorch", "foe_just", "foe_vote"]);
  assert.deepEqual(triggersOf({ t: "score", res: res("band", "band"), voter: null }), []);
  assert.deepEqual(triggersOf({ t: "end", result: { winner: 1 } }), ["foe_win"]);
  assert.deepEqual(triggersOf({ t: "end", result: { winner: 0 } }), ["foe_lose"]);
  assert.deepEqual(triggersOf({ t: "end", result: { winner: null } }), ["draw"]);
  assert.deepEqual(triggersOf({ t: "charge", p: 1 }), []);
  // カードだけの一言が種類より先。台詞の無い相手は null
  assert.equal(pickLine(LINES, "sumi", triggersOf({ t: "play", p: 1, id: "sumi" }), () => 0).id, "ichidai_sumi_play_card_sumi");
  assert.equal(pickLine(LINES, "sumi", triggersOf({ t: "play", p: 1, id: "packy" }), () => 0).id, "ichidai_sumi_play_person");
  assert.equal(pickLine(LINES, "nobody", ["start"]), null);
  assert.equal(pickLine(LINES, null, ["start"]), null);
  const all = LINES.ichidai_sumi_start;
  assert.equal(pickLine(LINES, "sumi", ["start"], () => 0.9999).text, all.at(-1).text);
}

// ── 4. CPUどうしの対戦 ──
for (const [seed, kits] of [[11, ["a", "b"]], [12, ["c", "a"]], [13, ["b", "c"]]]) {
  const G = createGame({ seed, tournament: "crown", players: [{ name: "はじめ", kit: kits[0], ai: true, level: 2 }, { name: "スミさん", kit: kits[1], ai: true, level: 2 }] });
  let said = 0, steps = 0;
  while (!G.over) {
    assert.ok(act(G, aiAct(G, G.wait.player)).ok);
    assert.ok(++steps < 4000);
    for (const ev of G.events.splice(0)) {
      const t = triggersOf(ev);
      if (t.length) { assert.ok(pickLine(LINES, "sumi", t), `${JSON.stringify(t)} の台詞が無い`); said++; }
    }
  }
  assert.ok(said > 0, "一言にする出来事が一度も起きない");
}
{
  // 早送り・CPU自動（quick）と、外れた画面には何も出さない（DOM に触れる前に返る）
  const root = { isConnected: true, querySelector: () => { throw new Error("DOM に触れた"); }, append: () => { throw new Error("DOM に触れた"); } };
  const ev = { t: "end", result: { winner: 1 } };
  assert.equal(attachIchidaiLines({ root, charId: "sumi", lines: LINES, quick: () => true }).event(ev), null);
  assert.equal(attachIchidaiLines({ root: { isConnected: false }, charId: "sumi", lines: LINES }).event(ev), null);
  assert.equal(attachIchidaiLines({ root, charId: "nobody", lines: LINES }).event(ev), null);
}
console.log(`ichidai_lines: OK（相手 ${[...opponents].join("・")}／場面 ${DATA.dialogues.length}）`);
