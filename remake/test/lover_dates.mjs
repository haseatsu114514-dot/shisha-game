// Data-level regression test for all seven romance dates.
// Run: node remake/test/lover_dates.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const data = JSON.parse(readFileSync(new URL("../data/lover.json", import.meta.url), "utf8"));
const ids = ["tsumugi", "minto", "rin", "ageha", "hiyori", "mashiro", "samechan"];
const allowedStats = new Set(["sense", "charm", "insight", "technique", "guts"]);
for (const id of ids) {
  const scene = data.dates?.[id];
  assert.ok(scene, `Missing date for ${id}`);
  for (const field of ["arrive", "mid", "close"]) {
    assert.ok(scene[field]?.face && scene[field]?.text, `${id}: missing ${field}`);
  }
  assert.ok(scene.choiceQ, `${id}: missing choice prompt`);
  for (const field of ["optA", "optB"]) {
    const choice = scene[field];
    assert.ok(choice?.text && choice?.line, `${id}: incomplete ${field}`);
    assert.ok(allowedStats.has(choice.stat), `${id}: invalid stat ${choice.stat}`);
    assert.ok([...choice.text].length <= 26, `${id}: choice exceeds 26 characters`);
  }
  assert.ok(data.inviteLines?.[id], `${id}: no invitation messages`);
}
const mashiro = data.dates.mashiro;
const dialogue = [mashiro.arrive.text, mashiro.mid.text, mashiro.optA.line, mashiro.optB.line, mashiro.close.text].join("\n");
assert.ok(dialogue.includes("はじめくん"));
assert.ok(dialogue.includes("僕"));
assert.doesNotMatch(dialogue, /わたし|私|はじめさん|蒸野くん/);
for (const field of ["optA", "optB"]) {
  assert.match(mashiro[field].text, /ましろちゃん/, `Mashiro date ${field}: Hajime uses her established name`);
  assert.doesNotMatch(mashiro[field].text, /ましろ(?!ちゃん)/, `Mashiro date ${field}: no bare name in Hajime's speech`);
}
console.log("OK: all seven romance dates have complete data and Mashiro's voice is consistent");

// 恋人の節目は台詞中のキューも能力の加算元になる。入れ子の分岐を含めて残さない。
const milestones = JSON.parse(readFileSync(new URL("../../data/dialogue/lover_events.json", import.meta.url), "utf8")).dialogues;
assert.equal(milestones.length, 35);
for (const id of ["tsumugi", "minto", "rin", "ageha", "mashiro", "samechan", "hiyori"]) {
  for (let level = 1; level <= 5; level++) {
    const scene = milestones.find(scene => scene.dialogue_id === `lover_${id}_lv${level}`);
    assert.ok(scene?.lines.length, `${id} Lv${level}: missing milestone`);
  }
}
function checkMilestone(value, id) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    assert.ok(!["stats", "add_stat", "growth_stats"].includes(key), `${id}: legacy ability reward ${key}`);
    if (key === "text") assert.doesNotMatch(child, /【(?:技術|センス|根性|魅力|洞察)】.*上が/, `${id}: ability cue`);
    checkMilestone(child, id);
  }
}
for (const scene of milestones) checkMilestone(scene, scene.dialogue_id);
console.log("OK: all 35 lover milestones contain no ability rewards or cues");

// ひよりの恋人Lv1〜5（#1498 オーナー決定: 斧投げ・ラーメン・総務の区切り・儚い女の演技 → epilogue_hiyori）。
const { existsSync } = await import("node:fs");
const { execFileSync } = await import("node:child_process");
// quick CI は画像を sparse-checkout しないため、作業ツリーに無ければ git の索引で存在を確かめる。
const assetExists = rel => {
  if (existsSync(new URL(`../../${rel}`, import.meta.url))) return true;
  try { execFileSync("git", ["ls-files", "--error-unmatch", rel], { cwd: new URL("../../", import.meta.url), stdio: "ignore" }); return true; } catch { return false; }
};
const hiyori = [1, 2, 3, 4, 5].map(level => milestones.find(scene => scene.dialogue_id === `lover_hiyori_lv${level}`));
const sceneText = scene => scene.lines.map(line => `${line.text || ""}${line.inner || ""}`).join("\n");
for (const scene of hiyori) {
  assert.equal(scene.metadata.private_scene, true, `${scene.dialogue_id}: private scene`);
  {
    const rel = scene.metadata.bg.replace("res://", "");
    assert.ok(assetExists(rel), `${scene.dialogue_id}: bg exists`);
  }
  assert.ok(!scene.metadata.preview_only && !scene.metadata.min_chapter, `${scene.dialogue_id}: playable in chapters 1-3`);
  assert.ok(!scene.branches, `${scene.dialogue_id}: no timeline branch needed`);
  for (const line of scene.lines) {
    assert.ok(["", "hiyori", "hajime"].includes(line.speaker), `${scene.dialogue_id}: speaker ${line.speaker}`);
    if (line.speaker === "hiyori") {
      assert.ok(assetExists(`assets/sprites/characters/hiyori/chr_hiyori_${line.face}.png`), `${scene.dialogue_id}: face ${line.face}`);
      assert.doesNotMatch(line.text, /はじめさん|ハジメ/, `${scene.dialogue_id}: Hiyori calls him はじめくん`);
    } else assert.ok(!line.inner, `${scene.dialogue_id}: only Hiyori has inner lines`);
    if (line.speaker === "hajime") assert.doesNotMatch(line.text, /ひより(?!さん)/, `${scene.dialogue_id}: Hajime says ひよりさん`);
  }
  const text = sceneText(scene);
  // 大会前後どちらで読んでも成立させる（交流の時系列ルール）。
  assert.doesNotMatch(text, /大会|予選|本番|決勝|ドバイ|東京/, `${scene.dialogue_id}: timeline-neutral`);
  const inner = scene.lines.filter(line => line.inner).length;
  assert.ok(inner >= 1 && inner < scene.lines.filter(line => line.speaker === "hiyori").length / 2, `${scene.dialogue_id}: inner is sparse`);
}
assert.match(hiyori[0].metadata.bg, /bg_axe_lounge_night/);
assert.match(sceneText(hiyori[0]), /斧/);
assert.match(sceneText(hiyori[1]), /ラーメン|味噌|替え玉/);
assert.match(sceneText(hiyori[2]), /総務、これにて閉店/);
assert.match(sceneText(hiyori[2]), /延長申請/);
assert.match(sceneText(hiyori[3]), /儚い/);
assert.match(sceneText(hiyori[3]), /見つけ/);
// 後日談 epilogue_hiyori の「総務、閉店」「半透明」「肩、五分」「捕まえて」へ自然につなぐ。
const epilogue = JSON.parse(readFileSync(new URL("../../data/dialogue/ending.json", import.meta.url), "utf8"))
  .dialogues.find(scene => scene.dialogue_id === "epilogue_hiyori");
const epilogueText = sceneText(epilogue);
for (const motif of ["総務、閉店", "半透明", "肩、五分", "捕まえて"]) {
  assert.ok(epilogueText.includes(motif) && sceneText(hiyori[4]).includes(motif), `Lv5 sets up epilogue motif ${motif}`);
}
console.log("OK: Hiyori lover Lv1-5 cover the owner themes and lead into epilogue_hiyori");
