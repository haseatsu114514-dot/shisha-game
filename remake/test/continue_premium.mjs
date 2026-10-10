// プレミアコンティニューの抽選条件: 現在の恋人だけ、1章のみんと除外。
// node remake/test/continue_premium.mjs
import assert from "node:assert/strict";
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
assert.equal(choosePremiumContinue(["kafuka"], 1, () => 0)?.speaker, "kafuka", "shark is eligible only when actually in state.lovers");
assert.equal(choosePremiumContinue(["tsumugi"], 1, () => 0, "tsumugi"), null, "same lover cannot appear consecutively when alone");
assert.equal(choosePremiumContinue(["tsumugi", "rin"], 1, () => 0, "tsumugi")?.speaker, "rin", "choose another eligible lover on the next continue");
assert.equal(choosePremiumContinue(["tsumugi", "rin"], 1, () => 0, "rin")?.speaker, "tsumugi", "previous lover is excluded");
assert.equal(choosePremiumContinue(["minto", "kafuka"], 1, () => 0, "kafuka"), null, "chapter-one Minto cannot bypass last-speaker exclusion");
for (const [id, s] of Object.entries(PREMIUM_CONTINUE_SCRIPTS)) {
  assert.equal(s.speaker, id);
  assert.equal(s.duration, 20);
  assert.equal(s.cues[0].at, 0);
  assert(s.cues.length >= 10 && s.cues.length <= 18, "telops are split into one-line cues");
  assert(["retry", "quit"].every(k => Array.isArray(s.reactions[k].text) && s.reactions[k].text.length >= 2));
  assert(s.cues.every((c,i) => c.text && c.face && (i === 0 || c.at > s.cues[i-1].at)));
}
assert.equal(PREMIUM_CONTINUE_SCRIPTS.tsumugi.cues.at(-1).face, "smile", "Tsumugi's dark last beat should smile");
assert.equal(PREMIUM_CONTINUE_SCRIPTS.minto.cues[0].face, "ura_surprise", "romance Minto uses private pose");
console.log("PASS: 20% girlfriend-only continue, shark cameo, no repeats, no chapter-one Minto, character beats valid");
