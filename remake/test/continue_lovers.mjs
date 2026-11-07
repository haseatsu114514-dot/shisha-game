// CONTINUEの出演者選び（#2524・2026-11-06）: スミさんか、そのセーブで成立済みの恋人だけ。恋人は希少枠ではなく通常枠。
// node remake/test/continue_lovers.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { LOVER_CONTINUE_SCRIPTS, chooseContinueSpeaker } from "../js/chapters/continue-lovers.js";

// 恋人がいなければ必ずスミさん。乱数の値や直前の出演者に関係なく、未成立の人物は出ない。
for (const rng of [() => 0, () => .5, () => .999999, () => NaN]) for (const previous of [null, "sumi", "tsumugi"])
  assert.equal(chooseContinueSpeaker([], 1, rng, previous), "sumi");
assert.equal(chooseContinueSpeaker(["stranger"], 5, () => .99), "sumi", "unsupported lover never appears");
assert.equal(chooseContinueSpeaker(undefined, 1, () => .99), "sumi");
// 第1章の栞は大会の対戦相手なので除外。第2章以降は候補に入る。
assert.equal(chooseContinueSpeaker(["minto"], 1, () => .99), "sumi");
assert.equal(chooseContinueSpeaker(["minto", "minto"], 1, () => .99), "sumi", "duplicate Minto cannot bypass the ban");
assert.equal(chooseContinueSpeaker(["minto"], 2, () => .99), "minto");
// スミさんと恋人は同じ確率（候補の並びは [sumi, ...lovers]。乱数×人数の切り捨て）。
assert.equal(chooseContinueSpeaker(["tsumugi"], 1, () => 0), "sumi");
assert.equal(chooseContinueSpeaker(["tsumugi"], 1, () => .499), "sumi");
assert.equal(chooseContinueSpeaker(["tsumugi"], 1, () => .5), "tsumugi");
assert.equal(chooseContinueSpeaker(["tsumugi", "rio", "rio"], 1, () => .34), "tsumugi", "duplicates do not weight the draw");
assert.equal(chooseContinueSpeaker(["tsumugi", "rio"], 1, () => .67), "rio");
// 直前と同じ人物は、他に候補がいれば続けて出さない。候補が1人なら同じ人物でも出す。
assert.equal(chooseContinueSpeaker(["tsumugi"], 1, () => 0, "sumi"), "tsumugi");
assert.equal(chooseContinueSpeaker(["tsumugi"], 1, () => .99, "tsumugi"), "sumi");
assert.equal(chooseContinueSpeaker(["tsumugi", "rio"], 1, () => 0, "sumi"), "tsumugi");
assert.equal(chooseContinueSpeaker(["tsumugi", "rio"], 1, () => .5, "sumi"), "rio");
assert.equal(chooseContinueSpeaker([], 1, () => 0, "sumi"), "sumi", "Sumi alone repeats");
assert.equal(chooseContinueSpeaker(["minto"], 1, () => 0, "sumi"), "sumi", "chapter-one Minto cannot bypass the repeat rule");
// 長期の分布: 恋人2人なら3人がほぼ均等（直前除外つき）。
{
  let seed = 7; const rng = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647; };
  const counts = { sumi: 0, tsumugi: 0, hiyori: 0 }; let previous = null;
  for (let i = 0; i < 3000; i++) { previous = chooseContinueSpeaker(["tsumugi", "hiyori"], 3, rng, previous); counts[previous]++; }
  for (const id of Object.keys(counts)) assert(counts[id] > 800 && counts[id] < 1200, `even share: ${JSON.stringify(counts)}`);
}

// 台本の形: 7行・各行1行（全角22字以内）・反応1行・先頭0秒。台本は前バージョン（2026-11-07 オーナー決定）で、
// 恋人がプレイヤーへ直接語りかける。はじめの自問（（））は置かない。
const width = text => [...text].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? .5 : 1), 0);
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
assert.deepEqual(Object.keys(LOVER_CONTINUE_SCRIPTS), ["tsumugi", "minto", "rio", "ageha", "samechan", "mashiro", "hiyori"]);
for (const [id, s] of Object.entries(LOVER_CONTINUE_SCRIPTS)) {
  assert.equal(s.speaker, id); assert.equal(s.duration, 20); assert.equal(s.audio, null); assert.equal(s.id, `lover_${id}`);
  assert.deepEqual(s.cues.map(c => c.at), [0, 1.8, 4.2, 7, 10.3, 13.6, 16.5]);
  assert(["retry", "quit"].every(k => Array.isArray(s.reactions[k].text) && s.reactions[k].text.length === 1 && s.reactions[k].faces.length > 0 && s.reactions[k].word));
  for (const text of [...s.cues.map(c => c.text), ...Object.values(s.reactions).flatMap(r => r.text)]) {
    assert(width(text) <= 22, `${id}: one line: ${text}`);
    assert.doesNotMatch(text, /[（）]/, `${id}: no inner monologue: ${text}`);
    assert.doesNotMatch(text, /。$/, `${id}: no sentence-final 。: ${text}`);
  }
  assert.match(s.cues.at(-1).text, /(？|\?|ですか)$/, `${id}: the last line hands the decision back`);
  // 連敗の短縮 [0,2,5,6] でも単独で読める行だけが残る（index 2・5 は前の行を受けない）。
  for (const index of [2, 5]) assert.doesNotMatch(s.cues[index].text, /^(それ|そう|でも|だから)/, `${id}: cue ${index} must stand alone`);
  // 使う表情は現行の立ち絵に実在し、新版を使う人物は新版にも全表情と顔の測定値がそろう。
  const faces = new Set([...s.cues.map(c => c.face), ...Object.values(s.reactions).flatMap(r => r.faces)]);
  // 現行の立ち絵に無い表情は portraitInfo と同じ近い表情へ寄せる（excited→smile 等）。
  const near = { excited: "smile", smug: "smile", wink: "smile", evil: "serious", thinking: "serious", intense: "serious" };
  for (const face of faces) {
    const classic = manifest.portraits[id].faces.includes(face) ? face : near[face];
    assert(classic && manifest.portraits[id].faces.includes(classic), `${id}: classic face ${face}`);
    assert(manifest.continuePortraits[id][classic], `${id}: classic framing ${face}`);
  }
  const variant = manifest.portraitVariants.new[id], framing = manifest.continuePortraitVariants.new[id];
  const complete = [...faces].every(face => variant?.faces?.includes(face) && framing?.[face]);
  assert.equal(complete, ["tsumugi", "minto", "rio", "samechan", "hiyori"].includes(id), `${id}: new-version coverage changed; update the expected list (framing comes from portrait_metrics styles.new)`);
}
assert.equal(LOVER_CONTINUE_SCRIPTS.tsumugi.cues.at(-1).face, "smile", "Tsumugi's dark last beat should smile");
assert.equal(LOVER_CONTINUE_SCRIPTS.minto.cues[0].face, "ura_surprise", "romance Minto uses private pose");
// quick CI intentionally omits image bytes; require tracked assets for Hiyori's faces even in sparse checkout.
for (const face of new Set([...LOVER_CONTINUE_SCRIPTS.hiyori.cues.map(c => c.face), ...Object.values(LOVER_CONTINUE_SCRIPTS.hiyori.reactions).flatMap(r => r.faces)])) {
  const asset = `remake/img/sprites/characters/hiyori/chr_hiyori_${face}.webp`;
  assert.equal(execFileSync("git", ["ls-files", "--error-unmatch", "--", asset], { cwd: new URL("../../", import.meta.url), encoding: "utf8" }).trim(), asset);
}
console.log("PASS: Sumi-or-lover selection (even share, no repeats, no chapter-one Minto, no strangers), seven lines (previous-version scripts), faces and framing present");

