// #832: 表示解決と実stateの保存/復元。ブラウザでの送り・紹介はvn_visual_readinessで確認する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { linePresentation, playerNameKnown } from "../js/vn/line-presentation.js";
import { DB, displayName } from "../js/core/data.js";
import * as core from "../js/core/state.js";

const originalCharacters = DB.characters;
const originalState = core.state;
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const files = new Map();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: key => files.get(key) ?? null,
  setItem: (key, value) => files.set(key, String(value)),
  removeItem: key => files.delete(key),
} });
DB.characters = Object.fromEntries(JSON.parse(readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8")).map(c => [c.id, c]));

function present(line, save, options = {}) {
  return linePresentation(line, {
    text: String(line.text || ""), save,
    resolveName: id => displayName(id, save, { context: options.context }),
    ...options,
  });
}

try {
  const before = core.newState();
  const after = core.newState();
  after.flags._intro_hajime = true;
  const playerName = displayName("hajime", after);
  assert.equal(playerName, "はじめ", "the canonical character definition supplies the revealed name");
  assert.equal(playerNameKnown(null), false);
  assert.equal(playerNameKnown(before), false, "missing opening progress alone must not reveal a fresh player's name");
  before.met.hajime = true;
  before.flags._ch1_opening = {};
  assert.equal(playerNameKnown(before), false, "portraits/met and an unfinished opening are not a name introduction");
  for (const speaker of [undefined, "", "hajime", "hazime"]) {
    const line = Object.freeze({ speaker, text: "香りを確かめる。", portrait: false, voice: "unchanged" });
    assert.deepEqual(present(line, before), { name: "???", text: line.text, thought: false });
    assert.deepEqual(present(line, after), { name: playerName, text: line.text, thought: false });
    assert.equal(line.speaker, speaker, "the display resolver must not replace the internal speaker");
    assert.equal(line.voice, "unchanged");
    assert.equal(line.portrait, false);
  }
  for (const speaker of ["", "hajime", "hazime"]) {
    const thought = { speaker, text: "（この香り、覚えておこう）" };
    assert.deepEqual(present(thought, before), { name: "???", text: thought.text, thought: true });
    assert.deepEqual(present(thought, after), { name: playerName, text: thought.text, thought: true });
    const mixed = { speaker, text: "そうですね。（あとで試そう）" };
    assert.equal(present(mixed, after).text, mixed.text);
    assert.equal(present(mixed, after).thought, false, "spoken words must not be enclosed as a thought");
  }

  const introductionDone = core.newState();
  introductionDone.flags._ch1_opening = { introDone: true };
  assert.equal(playerNameKnown(introductionDone), true, "existing resume progress covers old opening saves");
  for (const phase of ["daily", "tournament", "aftermath", "cleared"]) {
    const oldSave = { ...core.newState(), phase };
    assert.equal(playerNameKnown(oldSave), true, `legacy ${phase} saves have passed the introduction`);
  }
  assert.equal(playerNameKnown({ ...core.newState(), chapter: 2 }), true);

  const anonymous = { speaker: "", text: "「優勝の感想と、勝因を一言お願いします！」" };
  assert.deepEqual(present(anonymous, after, { dialogueId: "ch1_tournament_after" }), {
    name: displayName("???", after), text: anonymous.text, thought: false,
  });
  const commentary = { speaker: "", text: "「──決勝ッ！　世界の頂点を決める、最後の一台が……いま、提供されますッ！」" };
  assert.equal(present(commentary, before, { dialogueId: "ch1_cold_open" }).name, "？？？");
  for (const dialogueId of ["ch1_naru_group_regulars", "ch1_adam_group_soutoku", "ch1_minto_first", "ch1_minto_group_regulars", "ch1_rei_cameo"]) {
    const text = "[imp]「みんと、今日も可愛いよー！」「あとでチェキお願い！」[/imp]";
    assert.deepEqual(present({ text }, after, { dialogueId }), { name: "？？？", text, thought: false });
  }
  const memo = "「ダブルアップル7:ミント3 → 清涼感◎、余韻が短い」";
  assert.deepEqual(present({ text: memo }, after, { dialogueId: "ch1_tsumugi_fourth" }), { name: playerName, text: memo, thought: false });
  const notification = "『【ぺぱーみんと】ご登録ありがとうございます♡』";
  assert.deepEqual(present({ text: notification }, after, { dialogueId: "ch1_minto_first" }), { name: "", text: notification, thought: false });
  assert.deepEqual(present({ text: "[sub]（静かな心の声）[/sub]" }, after), { name: playerName, text: "[sub]（静かな心の声）[/sub]", thought: true });
  for (const text of ["誰かが呟いた。「……なんだよ、この煙……」", "「応募完了」。短い文字を、２人で確かめた。"]) {
    assert.deepEqual(present({ text }, after, { dialogueId: "ch1_cold_open" }), { name: playerName, text, thought: false });
  }
  const reward = { speaker: "", text: "……【好感度】が少し上がった。" };
  assert.deepEqual(present(reward, after, { isReward: true }), { name: "", text: reward.text, thought: false });

  for (const speaker of ["sumi", "minto", "hiyori", "???"]) {
    const line = { speaker, text: "（これは他人の言葉）" };
    assert.deepEqual(present(line, before), { name: displayName(speaker, before), text: line.text, thought: false });
  }
  after.flags._minto_name_known = true;
  after.met.minto = true;
  const minto = { speaker: "minto", text: "また会いましょう。" };
  assert.equal(present(minto, after, { context: "private" }).name, DB.characters.minto.private_name);
  assert.equal(present(minto, after).name, displayName("minto", after));
  assert.equal(present({ speaker: "samechan", voice: "korochan", text: "声を切り替える。" }, before).name, "コロちゃん");
  const longName = "長い名前を既存のname-fitへそのまま渡す";
  assert.equal(present({ speaker: "naru", text: "こんにちは。" }, after, { resolveName: () => longName }).name, longName);
  const originalSave = JSON.stringify(after);
  present({ text: "夕方のtonari。" }, after);
  assert.equal(JSON.stringify(after), originalSave, "displaying a line does not write progress or introduction flags");

  // 実stateモジュールを使うslot往復。会話の行位置を復元するテストではない。
  core.newGame();
  core.state.flags._ch1_opening = {};
  const [preSlot, postSlot] = core.SAVE_SLOTS.slice(1, 3).map(s => s.key);
  assert.equal(core.saveToSlot(preSlot), true);
  core.state.flags._intro_hajime = true;
  assert.equal(core.saveToSlot(postSlot), true);
  for (const [slot, expected] of [[preSlot, "???"], [postSlot, playerName], [preSlot, "???"]]) {
    assert.ok(core.loadFromSlot(slot));
    assert.equal(present({ text: "ロード後の地の文。" }, core.state).name, expected, "name follows the loaded slot, not a cached global");
  }
  const legacy = { ...core.newState(), schema: 17, phase: "daily" };
  files.set(preSlot, JSON.stringify(legacy));
  assert.ok(core.loadFromSlot(preSlot));
  assert.equal(core.state.schema, core.SCHEMA);
  assert.equal(present({ text: "旧セーブの地の文。" }, core.state).name, playerName);
  assert.equal(core.state.flags._intro_hajime, undefined, "legacy display must not forge introduction history");
  core.newGame();
  assert.equal(present({ text: "はじめから。" }, core.state).name, "???");
  console.log("PASS: #832 dialogue names, thought/quote/reward boundaries, canonical names and real save slots");
} finally {
  DB.characters = originalCharacters;
  core.setState(originalState);
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete globalThis.localStorage;
}
