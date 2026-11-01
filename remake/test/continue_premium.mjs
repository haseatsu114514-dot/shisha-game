// プレミアコンティニューの抽選条件: 現在の恋人だけ、1章のみんと除外。
// node remake/test/continue_premium.mjs
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { PREMIUM_CONTINUE_SCRIPTS, PREMIUM_CONTINUE_RATE, choosePremiumContinue } from "../js/chapters/continue-premium.js";
assert.equal(PREMIUM_CONTINUE_RATE, .20);
assert.equal(choosePremiumContinue([], 1, () => 0), null, "no romance must never trigger");
assert.equal(choosePremiumContinue(["minto"], 1, () => 0), null, "Minto is a rival in chapter 1");
assert.equal(choosePremiumContinue(["minto", "minto"], 1, () => 0), null, "duplicate Minto cannot bypass ban");
assert.equal(choosePremiumContinue(["tsumugi"], 1, () => .20), null, "20% boundary must not trigger");
assert.equal(choosePremiumContinue(["tsumugi"], 1, () => .199)?.speaker, "tsumugi");
assert.equal(choosePremiumContinue(["minto"], 2, () => 0)?.speaker, "minto", "Minto may appear starting chapter 2");
assert.equal(choosePremiumContinue(["minto", "tsumugi"], 1, () => 0)?.speaker, "tsumugi", "excluded rival is never rolled");
assert.equal(choosePremiumContinue(["minto", "tsumugi"], 2, (() => { let i = 0; return () => [0, .99][i++]; })())?.speaker, "tsumugi", "multiple partners only choose eligible");
assert.equal(choosePremiumContinue(["stranger"], 5, () => 0), null, "no default for unsupported lover");
assert.equal(choosePremiumContinue(["samechan"], 1, () => 0)?.speaker, "samechan", "shark is eligible only when actually in state.lovers");
assert.equal(choosePremiumContinue(["tsumugi"], 1, () => 0, "tsumugi"), null, "same lover cannot appear consecutively when alone");
assert.equal(choosePremiumContinue(["tsumugi", "rin"], 1, () => 0, "tsumugi")?.speaker, "rin", "choose another eligible lover on the next continue");
assert.equal(choosePremiumContinue(["tsumugi", "rin"], 1, () => 0, "rin")?.speaker, "tsumugi", "previous lover is excluded");
assert.equal(choosePremiumContinue(["minto", "samechan"], 1, () => 0, "samechan"), null, "chapter-one Minto cannot bypass last-speaker exclusion");
for (const [id, s] of Object.entries(PREMIUM_CONTINUE_SCRIPTS)) {
  assert.equal(s.speaker, id);
  assert.equal(s.duration, 20);
  assert.equal(s.cues[0].at, 0);
  assert(s.cues.length === 7, "telops are split into one-line cues");
  assert(["retry", "quit"].every(k => Array.isArray(s.reactions[k].text) && s.reactions[k].text.length === 1));
  assert(s.cues.every((c,i) => c.text && c.face && (i === 0 || c.at > s.cues[i-1].at)));
}
assert.equal(PREMIUM_CONTINUE_SCRIPTS.tsumugi.cues.at(-1).face, "smile", "Tsumugi's dark last beat should smile");
assert.equal(PREMIUM_CONTINUE_SCRIPTS.minto.cues[0].face, "ura_surprise", "romance Minto uses private pose");
// #2025: Hiyori joins the same lottery; existing six scripts stay byte-for-byte equivalent.
const existingIds = ["tsumugi", "minto", "rin", "ageha", "samechan", "mashiro"];
assert.equal(createHash("sha256").update(JSON.stringify(Object.fromEntries(existingIds.map(id => [id, PREMIUM_CONTINUE_SCRIPTS[id]])))).digest("hex"),
  "ec44ff206f47277fffab2fcee1fdc0e2e33403bf76da2eb617b082e72da4579c");
assert.deepEqual(Object.keys(PREMIUM_CONTINUE_SCRIPTS), [...existingIds, "hiyori"]);
const hiyori = PREMIUM_CONTINUE_SCRIPTS.hiyori;
const manifest = JSON.parse(readFileSync(new URL("../data/manifest.json", import.meta.url), "utf8"));
assert.equal(hiyori.audio, null);
assert.deepEqual(hiyori.cues.map(c => c.at), [0, 1.8, 4.2, 7, 10.3, 13.6, 16.5]);
for (const cue of hiyori.cues) assert(cue.at >= 0 && cue.at < hiyori.duration);
const usedFaces = new Set([...hiyori.cues.map(c => c.face), ...Object.values(hiyori.reactions).flatMap(r => r.faces)]);
for (const face of usedFaces) {
  assert(manifest.portraits.hiyori.faces.includes(face), `existing Hiyori face: ${face}`);
  assert(existsSync(new URL(`../img/sprites/characters/hiyori/chr_hiyori_${face}.webp`, import.meta.url)));
}
for (const reaction of Object.values(hiyori.reactions)) {
  assert.equal(reaction.effect, "warm");
  assert(reaction.word && reaction.faces.length > 0);
}
const width = text => [...text].reduce((n, c) => n + (/[\x20-\x7e]/.test(c) ? .5 : 1), 0);
for (const text of [...hiyori.cues.map(c => c.text), ...Object.values(hiyori.reactions).flatMap(r => r.text)]) assert(width(text) <= 22);
for (const chapter of [1, 2, 3, 4, 5]) {
  assert.equal(choosePremiumContinue([], chapter, () => 0), null, "no Hiyori without an actual lover");
  assert.equal(choosePremiumContinue(["hiyori"], chapter, () => 0), hiyori);
  assert.equal(choosePremiumContinue(["hiyori", "hiyori"], chapter, () => 0, "hiyori"), null);
  assert.equal(choosePremiumContinue(["hiyori"], chapter, () => PREMIUM_CONTINUE_RATE), null);
  assert.equal(choosePremiumContinue(["hiyori"], chapter, () => PREMIUM_CONTINUE_RATE - Number.EPSILON), hiyori);
  for (const previous of [null, "hiyori", "rin"]) {
    const eligible = ["hiyori", "rin"].filter(id => id !== previous);
    for (const draw of [0, .49, .5, .999999]) {
      let calls = 0;
      const result = choosePremiumContinue(["hiyori", "hiyori", "rin"], chapter, () => calls++ === 0 ? 0 : draw, previous);
      assert.equal(result.speaker, eligible[Math.floor(draw * eligible.length)]);
      assert.equal(calls, 2);
    }
  }
}
assert.equal(choosePremiumContinue(["minto", "hiyori"], 1, () => 0, "hiyori"), null, "Sumi fallback after Hiyori; chapter-one Minto remains excluded");
assert.equal(choosePremiumContinue(["minto", "hiyori"], 1, () => 0)?.speaker, "hiyori");
console.log("PASS: 20% girlfriend-only continue, shark cameo, no repeats, no chapter-one Minto, character beats valid");
