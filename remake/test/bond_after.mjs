// #3693 好感度MAX（♥5）の締めくくりの後の会話: 対象（友人ルートだけ）・順番・前提の持ち物・短い汎用の巡回・台本の揃い。
// 実際の来店は、店の来店 visitChar が first_meeting_affinity.mjs、スミさんのバイト上がりが after_shift_b05_b06.mjs、
// 柚ヶ谷の店（第2〜4章の visitPreparationSpot・第5章の visitCityRegular）が remake/test/browser/ で見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import { BOND_AFTER, BOND_AFTER_SCENE_IDS, bondAfterEligible, bondAfterNext, markBondAfterRead } from "../js/core/bond-after.js";

const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/bond_after.json", import.meta.url), "utf8"));
const scenes = Object.fromEntries(data.dialogues.map(d => [d.dialogue_id, d]));
const characters = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/characters.json", import.meta.url), "utf8")).map(c => [c.id, c]));
// 表情は立ち絵の目録から読む（CI の quick は画像を取得しないので、画像のフォルダは見ない）
const manifest = JSON.parse(fs.readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
const faces = id => manifest.portraits?.[id]?.faces || [];

// 台本: 全場面がそろい、話者と表情が実在する。報酬キュー・手動改行・大会を前提にした言い回しを入れない
for (const id of BOND_AFTER_SCENE_IDS) assert(scenes[id]?.lines?.length, `${id} の台本がない`);
assert.deepEqual(Object.keys(scenes).sort(), [...BOND_AFTER_SCENE_IDS].sort(), "台本と bond-after.js の一覧が一致する");
for (const [id, scene] of Object.entries(scenes)) {
  // 分岐（なるへの敬語・タメ口）は、第3章の和解（tournament_finished 3）で分ける。分岐先がそろっている
  for (const line of scene.lines.filter(line => line.type === "condition")) {
    assert.equal(line.condition_type, "tournament_finished", `${id}: 分岐は大会の前後だけ`);
    for (const key of [line.next_true, line.next_false]) assert(scene.branches?.[key]?.length, `${id}: 分岐 ${key} が無い`);
  }
  const lines = [...scene.lines, ...Object.values(scene.branches || {}).flat()].filter(line => line.type !== "condition");
  for (const line of lines) {
    if (!line.speaker) continue;
    if (line.speaker === "customer") continue;
    assert(characters[line.speaker], `${id}: 話者 ${line.speaker}`);
    assert(faces(line.speaker).includes(line.face), `${id}: ${line.speaker} の表情 ${line.face} が無い`);
  }
  for (const line of lines) {
    assert.equal(typeof line.text, "string", `${id}: 台詞の行には text がある`);
    assert.doesNotMatch(line.text, /\n|が(少し|かなり|大きく)?上がった。/, `${id}: 手動改行・報酬の言い回しを入れない`);
    assert.doesNotMatch(line.text, /大会|本番|明日の/, `${id}: 大会の前後どちらでも読めるよう、大会を前提にしない`);
  }
}
// コロちゃんの代弁に、本人の語尾（じゃ・のう・おる）を混ぜない（samechan_story.mjs と同じ決まり）
for (const scene of Object.values(scenes)) for (const line of scene.lines)
  if (line.voice === "korochan") assert.doesNotMatch(line.text, /じゃ|のう|おる/, `${scene.dialogue_id}: コロちゃんの語尾`);
// なる: 和解の前は「なるさん」と敬語、後は「なる」とタメ口（締めくくり ch1_naru_bond_finale と同じ。#3693）
for (const id of BOND_AFTER.naru.scenes.map(scene => scene.id)) {
  const branches = Object.entries(scenes[id].branches || {});
  assert(branches.length, `${id}: はじめの台詞を敬語・タメ口に分ける`);
  for (const [key, list] of branches) for (const line of list) {
    if (key.startsWith("keigo_")) assert.doesNotMatch(line.text, /なる(?!さん)/, `${id}/${key}: 和解の前は「なるさん」`);
    else assert.doesNotMatch(line.text, /なるさん|です|ます/, `${id}/${key}: 和解の後はタメ口`);
  }
}
for (const [id, item] of Object.entries(BOND_AFTER)) {
  assert.equal(item.scenes.length, 5, `${id}: ♥5後は5本`);
  assert(item.shorts.length >= 3, `${id}: 短い汎用は3本以上`);
  for (const short of item.shorts) assert(scenes[short].lines.length <= 3, `${short}: 短い汎用は3行まで`);
}

const save = (fields = {}) => ({ finales: {}, lovers: [], owned: [], flags: {}, ...fields });
const friendOf = (id, extra = {}) => save({ finales: { [id]: { day: 20, chapter: 2, route: "friend" } }, ...extra });

// 対象: 締めくくり前・恋人・恋愛ルートは出さない。友人ルート（または _friend_<id>）だけ
assert.equal(bondAfterNext(save(), "kumicho"), null, "締めくくりの前は出さない");
assert.equal(bondAfterEligible(save({ finales: { rei: { route: "romance" } } }), "rei"), false, "恋愛ルートは出さない");
assert.equal(bondAfterEligible(save({ finales: { rei: { route: "friend" } }, lovers: ["rei"] }), "rei"), false, "恋人には出さない");
assert.equal(bondAfterEligible(save({ finales: { rei: { route: "romance" } }, flags: { _friend_rei: true } }), "rei"), true, "後から友人に落ち着いた人は出す");
assert.equal(bondAfterNext(friendOf("ageha"), "ageha"), null, "まだ5本を書いていない人は対象外（いつもの来店のまま）");

// 順番: 5本を一度ずつ順に。読んだ記録は場面のIDで持つ
{
  const value = friendOf("rei");
  const order = [];
  for (let i = 0; i < 5; i++) {
    const next = bondAfterNext(value, "rei");
    assert.equal(next.kind, "story");
    order.push(next.scene);
    assert.deepEqual(bondAfterNext(value, "rei"), next, "読み終えるまで同じ場面（中断しても進まない）");
    markBondAfterRead(value, "rei", next);
  }
  assert.deepEqual(order, BOND_AFTER.rei.scenes.map(scene => scene.id));
  // その後は短い汎用を巡回
  const shorts = [];
  for (let i = 0; i < 6; i++) { const next = bondAfterNext(value, "rei"); assert.equal(next.kind, "short"); shorts.push(next.scene); markBondAfterRead(value, "rei", next); }
  assert.deepEqual(shorts, [...BOND_AFTER.rei.shorts, ...BOND_AFTER.rei.shorts].slice(0, 6));
  assert.deepEqual(value.flags._bond_after.rei, order, "5本の記録は増えない");
}

// 前提の持ち物: 一本目が締めくくりの素焼きの回収になっている人は、素焼きを持っている時だけ
for (const id of ["kumicho", "naru", "adam", "tsumugi", "sumi", "minto", "rio", "samechan"]) assert.equal(BOND_AFTER[id].scenes[0].requires, `suyaki_${id}`, `${id}: 一本目は素焼きが前提`);
// ひよりの素焼きの一台は友人の一服（friends.json）が描くので、一本目に前提を置かない
assert.equal(BOND_AFTER.hiyori.scenes.some(scene => scene.requires), false);
// サメちゃんの来店（daily/samechan.js）は背景を渡さないので、台本の metadata に店の背景を持つ。ひよりは私的な場面
for (const id of [...BOND_AFTER.samechan.scenes.map(scene => scene.id), ...BOND_AFTER.samechan.shorts]) assert.match(scenes[id].metadata?.bg || "", /bg_shishark/, id);
for (const id of [...BOND_AFTER.hiyori.scenes.map(scene => scene.id), ...BOND_AFTER.hiyori.shorts]) assert.equal(scenes[id].metadata?.private_scene, true, id);
// みんとは営業中の店なので、私服の立ち絵（ura_*）を使わない
for (const id of [...BOND_AFTER.minto.scenes.map(scene => scene.id), ...BOND_AFTER.minto.shorts])
  for (const line of scenes[id].lines) assert.doesNotMatch(line.face || "", /^ura_/, `${id}: 営業の姿の表情`);
// 神崎の一本目は締めくくりの素焼きを持っている時だけ。無い保存では飛ばし、持てば読む
{
  const without = friendOf("kumicho");
  assert.equal(bondAfterNext(without, "kumicho").scene, "bond_after_kumicho_2", "素焼きが無ければ一本目を飛ばす");
  for (let i = 0; i < 4; i++) markBondAfterRead(without, "kumicho", bondAfterNext(without, "kumicho"));
  assert.equal(bondAfterNext(without, "kumicho").kind, "short", "前提を満たす4本の後は汎用へ");
  without.owned.push("suyaki_kumicho");
  assert.equal(bondAfterNext(without, "kumicho").scene, "bond_after_kumicho_1", "あとから持てば、その来店で読む");
  const withGift = friendOf("kumicho", { owned: ["suyaki_kumicho"] });
  assert.equal(bondAfterNext(withGift, "kumicho").scene, "bond_after_kumicho_1");
}
// 壊れた記録は空として読む
assert.equal(bondAfterNext(friendOf("rei", { flags: { _bond_after: { rei: "x", rei_short: "y" } } }), "rei").scene, "bond_after_rei_1");

console.log(`bond_after: PASS ${Object.keys(BOND_AFTER).length} people, ${BOND_AFTER_SCENE_IDS.length} scenes (order, friend-only, requires, shorts)`);
