// 会話カットイン（はじめの顔の帯。#2990・2026-11-20 再設計 CCR01〜05）の置き場と出せる条件。ブラウザ不要。
// 実際の出入り（相手の行は台詞が出切ってから・はじめの行は名前の上・決意は全幅・SKIP/LOG で消える）は
// remake/test/browser/conversation_cutin_2990.mjs が見る。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ART, ART_DIR, CUES, KINDS, FRAMES, LEAVE_MS, conversationCutinCue, conversationCutinAllowed, conversationCutinArt, conversationCutinSrc, createConversationCutin } from "../js/vn/conversation-cutin.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dialogues = {};
for (const f of fs.readdirSync(path.join(root, "data/dialogue")).filter((f) => f.endsWith(".json"))) {
  const j = JSON.parse(fs.readFileSync(path.join(root, "data/dialogue", f), "utf8"));
  for (const d of j.dialogues || [j]) if (d?.dialogue_id) dialogues[d.dialogue_id] = d;
}

// 1) 型は5つ（2026-11-08 選別の採用分）。不採用の 1（聞き手の小窓）・3m（心の声の目元帯）は入れない
assert.deepEqual(Object.keys(KINDS).sort(), ["2a", "2c", "3", "4", "5"]);
assert.deepEqual([...new Set(CUES.map((c) => c.id))].sort(), ["2a", "2c", "3", "4", "4m", "5", "5b"]);
assert(!KINDS["3"].partners.includes(0), "3m（相手なしの目元帯）は不採用");
for (const [id, k] of Object.entries(KINDS)) if (k.partners.includes(0)) assert.equal(id, "4", "相手なしで出せるのは沈む（4m）だけ");
// 型ごとの帯: 寄りの帯は相手の行もはじめの行も名前の上の1か所（band）、決意だけ全幅（eyes）
for (const [id, k] of Object.entries(KINDS)) {
  assert(FRAMES[k.frame], `${id}: 帯 ${k.frame}`);
  assert.equal(k.frame, id === "3" ? "eyes" : "band", `${id}: 帯の置き場（寄りの帯は1か所にそろえる）`);
  assert(LEAVE_MS[k.leave] >= 0, `${id}: 消える動き ${k.leave}`);
}

// 2) CCR04（2026-11-20 オーナー決定）: 冒頭の「なんか、負けられないなあ」と、つむぎ初回の「……猫です」は外し、
//    序盤はアダム初回の「その顔」へ置き直した
assert(!CUES.some((c) => c.dialogue === "ch1_opening" || c.dialogue === "ch1_tsumugi_first"), "内容と合わない2か所は外す");
assert(CUES.some((c) => c.dialogue === "ch1_adam_first" && c.kind === "2c"), "序盤はアダム初回の「その顔」");
// 相手の行に置くのは、相手がはじめの顔に触れた台詞だけ
for (const cue of CUES.filter((c) => KINDS[c.kind].on === "partner")) assert.match(cue.text, /顔|目の下/, `${cue.dialogue}: 顔に触れた台詞`);

// 3) 置き場は実在する1行だけを指す（台本は書き換えない。台詞が変わったらここで気づく）
const NO_PORTRAIT = new Set(["hajime", "hazime", "", "everyone", "customer", "shop_clerk", "old_man", "traveler"]);
const manifest = JSON.parse(fs.readFileSync(path.join(root, "remake/data/manifest.json"), "utf8"));
for (const cue of CUES) {
  const d = dialogues[cue.dialogue];
  assert(d, `${cue.dialogue} がある`);
  const hits = (d.lines || []).filter((l) => conversationCutinCue(cue.dialogue, l) === cue);
  assert.equal(hits.length, 1, `${cue.id} ${cue.dialogue}「${cue.text}」はちょうど1行`);
  const kind = KINDS[cue.kind];
  assert.equal(cue.speaker === "hajime", kind.on === "line", `${cue.id}: 相手の行に出す型は相手の行・はじめの行に出す型ははじめの行`);
  assert(ART[cue.art], `${cue.id}: 絵 ${cue.art}`);
  // 実際の再生で条件を満たす（engine.js の立ち絵の枠: 2枚まで・古い方から入れ替え・hide_portrait で外す）
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

// 4) 絵: 4枚とも置いてあり、寸法の記録が実物と合う。
//    quick CI は画像を含まない sparse checkout なので、絵のフォルダがある時だけ実物を見る（LFS の実体がある時は寸法も）
const artDir = path.join(root, "remake", ART_DIR);
const artPresent = fs.existsSync(artDir);
const lfsReady = artPresent && fs.readdirSync(artDir).every((f) => fs.readFileSync(path.join(artDir, f)).subarray(0, 4).toString() === "RIFF");
for (const [name, art] of Object.entries(ART)) {
  assert.equal(art.file, `hajime_${name}.webp`);
  assert(art.face[0] > 0 && art.face[0] < art.w && art.face[1] > 0 && art.face[1] < art.h && art.head > 0, `${name}: 顔の位置と頭の高さ`);
  const file = path.join(artDir, art.file);
  if (artPresent) assert(fs.existsSync(file), `${art.file} がある`);
  if (lfsReady) {
    // WebP（VP8/VP8L/VP8X）の寸法を読む
    const b = fs.readFileSync(file), kind = b.subarray(12, 16).toString();
    const [w, h] = kind === "VP8X" ? [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)]
      : kind === "VP8L" ? [1 + (b.readUInt32LE(21) & 0x3fff), 1 + ((b.readUInt32LE(21) >> 14) & 0x3fff)]
        : [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
    assert.deepEqual([w, h], [art.w, art.h], `${art.file} の寸法`);
  }
}
assert.equal(conversationCutinSrc(CUES[0]), `${ART_DIR}${ART[CUES[0].art].file}`);

// 5) 帯は本文欄（y526〜）より上。寄りの帯は左側だけ（相手の立ち絵の顔へ掛けない）、全幅は決意だけ。
//    はじめの行の帯は新版の名前の行（y505〜）にも掛からない
for (const [name, f] of Object.entries(FRAMES)) {
  assert(f.x >= 0 && f.x + f.w <= (f.wide ? 1280 : 520), `${name} の左右`);
  assert(f.y + f.h <= 526, `${name} は本文欄より上`);
}
assert(FRAMES.band.y + FRAMES.band.h <= 500, "寄りの帯は名前の行より上");
assert.deepEqual(Object.keys(FRAMES).sort(), ["band", "eyes"], "出す位置は寄りの帯と目元の帯の2つだけ");
// 絵は縦横比を変えずに縮尺するだけ。顔の中心が帯の中に入る
for (const cue of CUES) {
  const a = conversationCutinArt(cue), art = ART[cue.art], f = FRAMES[KINDS[cue.kind].frame];
  assert(Math.abs(a.width / a.height - art.w / art.h) < 1e-9, `${cue.id}: 縦横比そのまま`);
  const cx = a.left + art.face[0] * a.scale, cy = a.top + art.face[1] * a.scale;
  assert(cx > 0 && cx < f.w && cy > 0 && cy < f.h, `${cue.id}: 顔が帯の中`);
}


// 6) 層の出し入れ
function element(tag = "div") {
  return {
    tag, style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, children: [], attrs: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, contains(c) { return this.set.has(c); } },
    setAttribute(k, v) { this.attrs[k] = v; }, append(...cs) { for (const c of cs) { c.parent = this; this.children.push(c); } },
    remove() { if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this); this.removed = true; },
  };
}
const timers = new Map(), sounds = [];
let tid = 0;
const doc = { createElement: element, createElementNS: (_, tag) => element(tag) };
const layer = element();
const ct = createConversationCutin(layer, {
  document: doc, sound: (n) => sounds.push(n),
  schedule: (fn, ms) => { timers.set(++tid, { fn, ms }); return tid; }, cancel: (k) => timers.delete(k),
});
const run = (ms) => { for (const [k, t] of [...timers]) if (t.ms === ms) { timers.delete(k); t.fn(); } };
const at = (id) => CUES.find((c) => c.id === id);
const find = (n, cls) => n.children.flatMap((c) => [c, ...find(c, cls).map((x) => x)]).filter((c) => c.className === cls);

// 相手の行は、文字送りの途中なら台詞が出切るまで待つ
assert.equal(ct.show(at("2a"), "downcast.webp", { typing: true, bg: 'url("bg.webp")' }), null, "文字送り中は待つ");
assert.equal(layer.children.length, 0);
const heavy = ct.reveal();
assert.equal(layer.children.length, 1, "文字送りが終わると出る");
assert.equal(heavy.dataset.frame, "band");
assert.equal(find(heavy, "vn-cutin-bg")[0].style.backgroundImage, 'url("bg.webp")', "帯の中に今の背景");
assert.equal(ct.reveal(), null, "出すのは1回だけ");
ct.leave();
assert(!heavy.removed && heavy.classList.contains("leave") && heavy.dataset.leave === "soft", "重い型は薄れてから消える");
run(LEAVE_MS.soft);
assert(heavy.removed);
// はじめの行は文字送り中でもすぐ出る
const own = ct.show(at("5"), "grateful.webp", { typing: true });
assert(own && own.dataset.tone === "amber" && own.dataset.enter === "rise", "受け取るは琥珀・持ち上がる");
assert.equal(find(own, "vn-cutin-over").length, 0, "帽子も帯の中に収める（はみ出さない）");
ct.clear();
const sink = ct.show(at("4m"), "downcast.webp");
assert.equal(sink.dataset.tone, "cool");
assert.equal(find(sink, "vn-cutin-over").length, 0, "沈むも帯からはみ出さない");
// 軽い型は自分から消える（効果音つき）
ct.clear();
sounds.length = 0;
const light = ct.show(at("2c"), "flustered.webp");
assert.deepEqual(sounds, ["whoosh"]);
assert.equal([...timers.values()].find((t) => t.ms === KINDS["2c"].ms)?.ms, 1150);
run(1150);
assert(light.classList.contains("leave") && light.dataset.leave === "cut" && !light.removed, "軽い型は約1秒で閉じ始める");
run(LEAVE_MS.cut);
assert(light.removed);
// 決意は全幅の帯と、帯より上を暗くする幕
const eyes = ct.show(at("3"), "resolve.webp");
assert.equal(eyes.dataset.frame, "eyes");
assert.equal(layer.children.length, 2, "幕と帯");
assert.equal(layer.children[0].className, "vn-cutin-dim");
run(KINDS["3"].ms);
assert(layer.children.every((n) => n.classList.contains("leave")), "幕も一緒に消える");
run(LEAVE_MS.eyes);
assert.equal(layer.children.length, 0);
// 動きを減らす設定では即座に消す
const still = ct.show(at("4"), "downcast.webp", { still: true });
assert.equal(still.dataset.still, "true");
ct.leave({ still: true });
assert(still.removed);
// 待っている間に次の行へ進んだ・SKIP・LOG では出さない
ct.show(at("2c"), "flustered.webp", { typing: true });
ct.leave();
assert.equal(ct.reveal(), null, "次の行へ進んだら出さない");
ct.show(at("2c"), "flustered.webp", { typing: true });
ct.clear();
assert.equal(ct.reveal(), null, "clear で待ちも捨てる");
// 新しいカットインは前のものを置き換える。clear は自分から消えるタイマーも止める
ct.show(at("5"), "grateful.webp");
ct.show(at("2c"), "flustered.webp");
assert.equal(layer.children.length, 1);
ct.clear();
assert.equal(layer.children.length, 0);
assert.equal([...timers.values()].filter((t) => t.ms === KINDS["2c"].ms).length, 0, "clear は消去タイマーも止める");

// 7) 会話エンジンの接続: 次の行・SKIP・LOG・会話の開始と終了で片付け、文字送りが終わった時に待っていた分を出す
const engine = fs.readFileSync(path.join(root, "remake/js/vn/engine.js"), "utf8");
assert.match(engine, /function next\(\) \{[\s\S]{0,260}cutin\?\.leave\(/);
assert.match(engine, /if \(v\) \{ cutin\?\.clear\(\); setAuto\(false\); \}/);
assert.match(engine, /function openLog\(\) \{\n  cutin\?\.clear\(\);/);
// 会話の終わり（finish の本体の中）で片付ける。字数の上限ではなく、関数の閉じ括弧より前にあることを確かめる
assert.match(engine, /function finish\(cancelled = false\) \{(?:(?!\n\}\n)[\s\S])*cutin\?\.clear\(\);/);
assert.match(engine, /function completeTyping\(\) \{[\s\S]{0,500}cutin\?\.reveal\(\);/);
assert.match(engine, /renderPage\(\);\n[^\n]*\n  if \(cutinSrc\) showCutin\(r, cutinCue, cutinSrc\);/, "文字送りを始めてから出す");
assert.match(engine, /cutin\?\.show\(cue, src, \{ still: reducedMotion\(\), bg: cutinBackdrop\(\), typing: !!r\.typing \}\)/);
for (const page of ["index.html", "conversation-preview.html"]) {
  const html = fs.readFileSync(path.join(root, "remake", page), "utf8");
  if (page === "index.html") {
    // 本編は CSS バンドル経由で読む（bundles.json に vn/conversation-cutin.css が入っていること）
    const bundles = JSON.parse(fs.readFileSync(path.join(root, "remake/css/bundles.json"), "utf8"));
    assert(html.includes('href="css/vn/bundle.css"'), "index.html が vn バンドルを読む");
    assert(bundles.segments.some((s) => s.out === "vn/bundle.css" && s.files.includes("vn/conversation-cutin.css")), "vn バンドルに conversation-cutin.css が入っている");
  } else {
    assert(html.includes('href="css/vn/conversation-cutin.css"'), `${page} が CSS を読む`);
  }
}

console.log(`conversation-cutin: ${CUES.length} 行（5つの型・絵4枚）の置き場・出せる条件・出入り PASS`);
