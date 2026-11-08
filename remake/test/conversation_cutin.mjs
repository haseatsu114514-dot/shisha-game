// 会話カットイン（立ち絵版・#2990）の置き場と出せる条件。ブラウザ不要。
// 実際の出入り（行で出る・次の行で消える・2c は0.9秒・SKIP/LOG で消える）は remake/test/browser/conversation_cutin_2990.mjs が見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CUES, KINDS, FRAMES, FOCUS, conversationCutinCue, conversationCutinAllowed, conversationCutinArt, createConversationCutin } from "../js/vn/conversation-cutin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dialogues = {};
for (const f of fs.readdirSync(path.join(root, "data/dialogue")).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", f), "utf8"));
  for (const d of j.dialogues || [j]) if (d?.dialogue_id) dialogues[d.dialogue_id] = d;
}

// 1) 採用7件だけ（2026-11-08 オーナー選別）。不採用の 1（聞き手の小窓）・3m（心の声の目元帯）は入れない
assert.deepEqual([...new Set(CUES.map((c) => c.id))].sort(), ["2a", "2c", "3", "4", "4m", "5", "5b"]);
assert(!Object.values(KINDS).some((k) => k.plan === 1), "案1 は不採用");
assert(!KINDS["3"].partners.includes(0), "3m（相手なしの目元帯）は不採用");
for (const [id, k] of Object.entries(KINDS)) if (k.partners.includes(0)) assert.equal(id, "4", "相手なしで出せるのは案4（4m）だけ");

// 2) 置き場は実在する1行だけを指す（台本は書き換えない。台詞が変わったらここで気づく）
const NO_PORTRAIT = new Set(["hajime", "hazime", "", "everyone", "customer", "shop_clerk", "old_man", "traveler"]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "remake/data/manifest.json"), "utf8"));
for (const cue of CUES) {
  const d = dialogues[cue.dialogue];
  assert(d, `${cue.dialogue} がある`);
  const hits = (d.lines || []).filter((l) => conversationCutinCue(cue.dialogue, l) === cue);
  assert.equal(hits.length, 1, `${cue.id} ${cue.dialogue}「${cue.text}」はちょうど1行`);
  const kind = KINDS[cue.kind];
  assert.equal(cue.speaker === "hajime", kind.on === "line", `${cue.id}: 相手の行に出す案は相手の行・はじめの行に出す案ははじめの行`);
  assert(manifest.portraitVariants.new.hajime.faces.includes(cue.face), `${cue.id}: 既存の new の表情 ${cue.face}`);
  assert(fs.existsSync(path.join(root, `remake/img/sprites/character_variants/new/hajime/chr_hajime_${cue.face}.webp`)), `${cue.face} の立ち絵がある`);
  assert(FOCUS[kind.pose.focus || "face"][cue.face], `${cue.id}: 顔の位置 ${cue.face}`);
  // 3) 実際の再生で条件を満たす（engine.js の立ち絵の枠: 2枚まで・古い方から入れ替え・hide_portrait で外す）
  const slots = [];
  const touch = (c) => {
    if (!c || slots.includes(c) || !manifest.portraits[c]) return;
    if (slots.length >= 2) slots.shift();
    slots.push(c);
  };
  for (const l of d.lines) {
    if (l.type === "hide_portrait" && slots.includes(l.char_id)) slots.splice(slots.indexOf(l.char_id), 1);
    if (l.type) continue;
    if (l.portrait !== false && !NO_PORTRAIT.has(String(l.speaker || ""))) touch(l.speaker);
    if (l.portrait) touch(l.portrait);
    if (l === hits[0]) break;
  }
  assert(conversationCutinAllowed(cue, { portraits: slots.length, portraitSpeakers: slots }),
    `${cue.id} ${cue.dialogue}: その行の相手の立ち絵 ${slots.join(",") || "なし"} で出せる`);
}
// 同じ会話に2つ置かない（1会話1回まで）
assert.equal(new Set(CUES.map((c) => c.dialogue)).size, CUES.length);
// 制御行・立ち絵の指定を差し替えた行・別の会話には出さない
const sample = CUES[0], line = { speaker: sample.speaker, text: sample.text };
assert.equal(conversationCutinCue(sample.dialogue, line), sample);
for (const edit of [{ type: "choice" }, { portrait: false }, { portrait: "sumi" }, { speaker: "hajime" }]) assert.equal(conversationCutinCue(sample.dialogue, { ...line, ...edit }), null);
assert.equal(conversationCutinCue("another", line), null);

// 4) 出せる条件（#2845 オーナー決定）
const at = (id) => CUES.find((c) => c.id === id);
const one = (cue) => ({ portraits: 1, portraitSpeakers: [cue.speaker === "hajime" ? "sumi" : cue.speaker] });
for (const cue of CUES) {
  const ctx = one(cue);
  assert.equal(conversationCutinAllowed(cue, ctx), true, cue.id);
  for (const field of ["shown", "skip", "turbo", "cg", "log", "choices", "intro", "protagonistVisible"]) assert.equal(conversationCutinAllowed(cue, { ...ctx, [field]: true }), false, `${cue.id} ${field}`);
}
for (const id of ["2a", "2c"]) {
  for (const n of [0, 2]) assert.equal(conversationCutinAllowed(at(id), { portraits: n, portraitSpeakers: ["tsumugi", "sumi"].slice(0, n) }), false, `${id}: 相手の行は1枚の時だけ`);
  assert.equal(conversationCutinAllowed(at(id), { portraits: 1, portraitSpeakers: ["sumi"] }), false, `${id}: 映っている1枚が話し手の時だけ`);
}
for (const id of ["5", "5b"]) for (const n of [0, 2]) assert.equal(conversationCutinAllowed(at(id), { portraits: n, portraitSpeakers: [] }), false, `${id}: 1枚の時だけ`);
assert.equal(conversationCutinAllowed(at("4m"), { portraits: 0, portraitSpeakers: [] }), true, "4m は相手なしでも出す");
assert.equal(conversationCutinAllowed(at("4"), { portraits: 2, portraitSpeakers: [] }), false);
assert.equal(conversationCutinAllowed(at("3"), { portraits: 0, portraitSpeakers: [] }), false, "3m は不採用");

// 5) 枠は左側で、本文欄（y526〜）と重ならない。絵は既存の立ち絵をそのまま縮尺するだけ（縦横比を変えない）
for (const [name, f] of Object.entries(FRAMES)) {
  assert(f.x >= 0 && f.x + f.w <= 640, `${name} は左半分`);
  assert(f.y + f.h <= 526, `${name} は本文欄より上`);
}
for (const cue of CUES) {
  const a = conversationCutinArt(cue);
  assert(Math.abs(a.width / a.height - 896 / 1200) < 1e-9, `${cue.id}: 縦横比そのまま`);
}

// 6) 層の出し入れ: 次の行で消える・案4は0.3秒で薄れる・2c は0.9秒・clear は即座
function element(tag = "div") {
  return {
    tag, style: {}, dataset: {}, children: [], classList: { set: new Set(), add(c) { this.set.add(c); }, contains(c) { return this.set.has(c); } },
    setAttribute() {}, append(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.removed = true; },
  };
}
const timers = new Map();
let tid = 0;
const doc = { createElement: element, createElementNS: (_, tag) => element(tag) };
const layer = element();
const ct = createConversationCutin(layer, { document: doc, schedule: (fn, ms) => { timers.set(++tid, { fn, ms }); return tid; }, cancel: (k) => timers.delete(k) });
const run = (ms) => { for (const [k, t] of [...timers]) if (t.ms === ms) { timers.delete(k); t.fn(); } };

const a = ct.show(at("2a"), "sad.webp");
assert.equal(layer.children.length, 1);
assert.equal(a.dataset.enter, "slide");
ct.leave();
assert(a.removed, "2a は次の行で消える");
const c = ct.show(at("2c"), "surprise.webp");
assert.equal([...timers.values()][0].ms, 900);
run(900);
assert(c.removed, "2c は0.9秒で消える");
const s = ct.show(at("4"), "sad.webp");
assert(s.classList.contains("sink"));
ct.leave();
assert(s.classList.contains("leave") && !s.removed, "案4は薄れてから消える");
run(300);
assert(s.removed);
const still = ct.show(at("4m"), "sad.webp", { still: true });
assert.equal(still.dataset.still, "true");
ct.leave({ still: true });
assert(still.removed, "動きを減らす設定では即座に消す");
const five = ct.show(at("5"), "smile.webp");
assert(five.classList.contains("amber") && five.dataset.enter === "rise");
ct.show(at("3"), "serious.webp");
assert(five.removed && layer.children.length === 1, "新しいカットインは前のものを置き換える");
ct.clear();
assert.equal(layer.children.length, 0);
ct.show(at("2c"), "surprise.webp");
ct.clear();
assert.equal(timers.size, 0, "clear は2c の消去タイマーも止める");

// 7) 会話エンジンの接続: 次の行・SKIP・LOG・会話の開始と終了で片付ける
const engine = fs.readFileSync(path.join(root, "remake/js/vn/engine.js"), "utf8");
assert.match(engine, /function next\(\) \{[\s\S]{0,260}cutin\?\.leave\(/);
assert.match(engine, /if \(v\) \{ cutin\?\.clear\(\); setAuto\(false\); \}/);
assert.match(engine, /function openLog\(\) \{\n  cutin\?\.clear\(\);/);
assert.match(engine, /function finish\(cancelled = false\) \{[\s\S]{0,900}cutin\?\.clear\(\);/);
for (const page of ["index.html", "conversation-preview.html"]) {
  assert(fs.readFileSync(path.join(root, "remake", page), "utf8").includes('href="css/vn/conversation-cutin.css"'), `${page} が CSS を読む`);
}

console.log(`conversation-cutin: ${CUES.length} 行（採用7件）の置き場・出せる条件・出入り PASS`);
