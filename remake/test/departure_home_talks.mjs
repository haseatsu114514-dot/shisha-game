// 第3・4章の出発前の準備3日（VOL02）に、地元の常連が準備期間の来店で一度だけ話す送り出しの会話（N3a）。
// ① 台本（data/dialogue/ch3_ch4_home.json・ch4_prep_home.json）: 18本すべてが接続済み・報酬の文なし・その章の行き先だけを話す
// ② アダム・みんと・凛想・つむぎ・柚ヶ谷の三人（実 spots.js の CHAPTER_TALKS / visitChar）: 準備期間だけ・一度だけ・中断は未読・昼夜のあいさつを重ねない
//    （正体の回・途中の質問が先の来店では次へ残す）。柚ヶ谷の店の来店での精算は ch2_followups.mjs が確かめる
// ③ サメちゃん（実 samechan.js）: 初来店の後、準備期間の来店で一度だけ。出発後・ほかの章では出さない
// ④ 準備期間の入口（実 departure-prep.js）: 2つの台本ファイルを読み込み、地元の地図に4人の店が出る。読み込めなくても準備期間は始まる
// ⑤ ひより（実 hiyori.js）: tonariでの再会の後、準備期間の夜のtonariの対面で一度だけ。物語の段階が先・客席でつむぎの新しい話を読む来店は次へ
// node --experimental-vm-modules remake/test/departure_home_talks.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const root = new URL("../../", import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), "utf8");
const dialogueFile = name => JSON.parse(read(`data/dialogue/${name}.json`)).dialogues;
// 第3章の分と最初の4人の第4章の分は ch3_ch4_home.json。#3097 PR-I で足した5人の第4章の分は ch4_prep_home.json
const TALK_FILES = ["ch3_ch4_home", "ch4_prep_home"];
const talks = TALK_FILES.flatMap(dialogueFile);
const all = Object.fromEntries([...TALK_FILES, "ch2_home", "remake_ch1", "venue_hours", "samechan"]
  .flatMap(dialogueFile).map(d => [d.dialogue_id, d]));
const samechanData = JSON.parse(read("data/dialogue/samechan.json"));
const plain = v => JSON.parse(JSON.stringify(v));

function namedImports(src) {
  const map = new Map();
  for (const m of src.matchAll(/(?:import|export)\s*\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
    const set = map.get(m[2]) || new Set();
    for (const part of m[1].split(",").map(s => s.trim()).filter(Boolean)) set.add(part.split(/\s+as\s+/)[0].trim());
    map.set(m[2], set);
  }
  return map;
}
async function loadWithStubs(file, overrides) {
  const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout });
  const src = read(file);
  const mod = new vm.SourceTextModule(src, { context, identifier: file });
  const imports = namedImports(src);
  const synthetic = new Map();
  await mod.link(spec => {
    const names = [...(imports.get(spec) || [])];
    const values = overrides[spec] || {};
    const stub = new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, name in values ? values[name] : (() => undefined));
    }, { context, identifier: spec });
    synthetic.set(spec, stub);
    return stub;
  });
  await mod.evaluate();
  return { ns: mod.namespace, set: (spec, name, value) => synthetic.get(spec).setExport(name, value) };
}

const PREP = { startDay: 29, days: 3, step: 4, departed: false };
const prepFlags = (chapter, extra = {}) => ({ [`_ch${chapter}_prep`]: { ...PREP }, _minto_identity_revealed: true, ...extra });

// ---- ① 台本 ---------------------------------------------------------------------
// #3097 PR-I（計画 3-3・4-4）: 地元のつむぎ・ひよりと、柚ヶ谷のあげは・神崎・クラウドを足した
const ADDED = ["tsumugi", "hiyori", "ageha", "kumicho", "kuraudo"];
const PEOPLE = ["adam", "minto", "rio", "samechan", ...ADDED];
const SCENES = [3, 4].flatMap(chapter => PEOPLE.map(id => `ch${chapter}_prep_${id}`));
assert.deepEqual(talks.map(d => d.dialogue_id).sort(), [...SCENES].sort(), "one talk per person per chapter");
// 章ごとの台詞量はファイル名の章接頭辞で数える（tools/chapter_volume.py）。足した第4章の分は ch4_ で始まるファイルに置く
const idsIn = name => dialogueFile(name).map(d => d.dialogue_id);
assert.deepEqual(idsIn("ch4_prep_home").sort(), ADDED.map(id => `ch4_prep_${id}`).sort());
for (const id of ADDED) assert(idsIn("ch3_ch4_home").includes(`ch3_prep_${id}`), `ch3_prep_${id} sits with the other chapter 3 talks`);
const textOf = dialogue => [dialogue.lines, ...Object.values(dialogue.branches || {})].flat().map(line => line.text || "").join("\n");
for (const dialogue of talks) {
  const id = dialogue.dialogue_id, person = id.split("_").pop(), text = textOf(dialogue);
  const lines = [dialogue.lines, ...Object.values(dialogue.branches || {})].flat();
  assert(lines.filter(line => line.text).length <= 14, `${id}: a short talk`);
  assert(lines.every(line => !line.type || line.type === "condition"), `${id}: no rewards, flags or choices in the script`);
  assert(!/が(少し|かなり|大きく)?上がった/.test(text), `${id}: the visit gives growth, not the script`);
  assert(lines.every(line => !String(line.text || "").includes("\n")), `${id}: no manual line breaks`);
  assert(lines.filter(line => line.speaker).every(line => ["hajime", person].includes(line.speaker)), `${id}: only Hajime and ${person} speak`);
  assert(dialogue.metadata?.bg, `${id}: the shop background`);
  if (id.startsWith("ch3_")) {
    assert(/東京/.test(text) && !/ドバイ|世界/.test(text), `${id}: before Tokyo, nothing about the world tournament`);
  } else {
    assert(/ドバイ|世界/.test(text) && !/県大会/.test(text), `${id}: before Dubai`);
  }
  // 恋人でも友人でも成り立つ店の会話。ドバイへの同行・応援・見送りの約束はしない（同行の選択は章頭に済んでいる）
  assert(!/一緒に行|見送り|待ってる|応援に行/.test(text), `${id}: nothing about who travels`);
  // 味の不調の原因を決めつけない（物語の正本「味の不調と受診」）。第4章でも回復しきったとは書かない（回復は続いていく）
  assert(!/心因|気のせい|ストレス/.test(text), `${id}: no diagnosis`);
  assert(!/すっかり|完全に|元通り|治っ/.test(text), `${id}: the recovery is still going on`);
  // 呼び名は data/characters.json の現在の正本（凛想・みんと・サメちゃん）。旧名は tools/check_legacy_terms.py が全ファイルで止める
  // コロちゃん（腹話術）は「余」「勇者はじめ」で、サメちゃん本人の「じゃ」「のう」「おる」を使わない（samechan.json の speech_style）
  for (const line of lines.filter(line => line.face === "ventriloquism")) {
    assert(!/じゃ|のう|おる/.test(line.text), `${id}: Korochan speaks like a king: ${line.text}`);
  }
}
// 第3章は味がまだ遠い。第4章で「分かる」と言えるのは、ダブルアップルの判別（ch3_taste_return）の後だから
assert(!/(アニス|リコリス).*(分かる|残ります)/.test(textOf(all.ch3_prep_adam)), "chapter 3: Hajime does not name flavours yet");
assert(/アニス/.test(textOf(all.ch4_prep_adam)) && /リコリス/.test(textOf(all.ch4_prep_adam)));
// 第2章「また分かる日に吸え」の回収は第5章の ch5_free_eden_adam（#1588 オーナー決定）。第4章のアダムは先取りしない
assert(!/分かる日が来た|遅くなりました|好きです|点より先/.test(textOf(all.ch4_prep_adam)), "chapter 4 Adam stops short of the chapter 5 EDEN payoff");
// 第4章の出発前は全国大会から日がたっている。同行の恋人にも不自然にならないよう、優勝を初耳の知らせにしない
for (const id of ["ch4_prep_minto", "ch4_prep_rio", ...ADDED.map(person => `ch4_prep_${person}`)]) {
  assert(!/全国優勝|おめでと|結果見た/.test(textOf(all[id])), `${id}: not fresh news`);
}
// #3097 PR-I で足した10本（2026-11-18 オーナー決定: 恋愛を進めない普段の会話。恋人の保存でも、友人の保存でも通る）
for (const id of ADDED.flatMap(person => [`ch3_prep_${person}`, `ch4_prep_${person}`])) {
  const dialogue = all[id], text = textOf(dialogue), person = id.split("_").pop();
  const lines = [dialogue.lines, ...Object.values(dialogue.branches || {})].flat();
  assert(!/好き|恋人|付き合|デート|告白|彼女|彼氏/.test(text), `${id}: an everyday talk that does not move the romance`);
  // 1本 8〜12行（読む道筋ごと。分岐は片方だけ通る）
  const path = dialogue.lines.filter(line => line.text).length;
  assert(path >= 8 && path <= 12, `${id}: ${path} lines`);
  // 第3章の出発前は、はじめの味が遠い時期（ch3_prep_opening「無理に吸って確かめるな」）。誰も味の話をしない
  if (id.startsWith("ch3_")) assert(!/味/.test(text), `${id}: nobody talks about the taste before Tokyo`);
  // 第4章の出発前は、ドバイで初めて知ることを言わない。五人ともドバイへ来ることがある（core/overseas-companion.js）ので、行く・行かないも言わない
  if (id.startsWith("ch4_")) {
    assert(!/シェイク|王煙楼|龍龍|前夜祭|十五年前|有給|サウナ|休演/.test(text), `${id}: nothing only learned in Dubai, nobody hints at coming`);
    assert(!/帰ってきたら|帰ったら|留守/.test(text), `${id}: no promise that assumes they stay home`);
  }
  // 本心（inner）はひよりだけの演出
  assert(lines.every(line => !line.inner || line.speaker === "hiyori"), `${id}: inner is Hiyori's`);
  // 呼び名は characters.json の voice
  const callsHajime = { tsumugi: "はじめさん", hiyori: "はじめくん", ageha: "ハジメっち", kumicho: "あんちゃん" }[person];
  if (callsHajime) assert(lines.some(line => line.speaker === person && line.text.includes(callsHajime)), `${id}: ${person} calls Hajime ${callsHajime}`);
}
// 神崎が県大会の日に持ち点の表を見ていた話は第5章（ch2_kumicho_after_ch2）まで言わない。盃の喩えは「映画の話だ」でごまかす
for (const id of ["ch3_prep_kumicho", "ch4_prep_kumicho"]) assert(!/持ち点|点数|表を見/.test(textOf(all[id])), id);
assert(/盃/.test(textOf(all.ch3_prep_kumicho)) && /映画の話だ/.test(textOf(all.ch3_prep_kumicho)));
// クラウドの本名・笑顔の練習・「嘘」・同士の呼び方には触れない（第2章の段階会話の話）
for (const id of ["ch3_prep_kuraudo", "ch4_prep_kuraudo"]) assert(!/健太|田中|笑顔|嘘|同士/.test(textOf(all[id])), id);
// あげはの手の震え・前夜の点の話は、帰郷の再会（ch3_ageha_reunion）で本人が話す。第3章の出発前は約束の一台を帰郷まで残す
assert(!/震え|点の話|前夜/.test(textOf(all.ch3_prep_ageha)) && /約束/.test(textOf(all.ch3_prep_ageha)));
// 第4章の分岐は、第3章のその人の送り出し（クラウドはライブの夜も）を読んだかだけを見る
for (const person of ADDED) {
  const flags = all[`ch4_prep_${person}`].lines.filter(line => line.type === "condition").map(line => line.flag);
  const allowed = [`_talk_seen_ch3_prep_${person}`, ...(person === "kuraudo" ? ["_talk_seen_ch3_prep_kuraudo_live"] : [])];
  assert(flags.every(flag => allowed.includes(flag)), `ch4_prep_${person}: ${flags}`);
}
// 第3章で凛想に頼まれた「向こうの顔」は、第4章で報告を返す（第3章の会話を読んだ時だけ）
assert(all.ch4_prep_rio.lines.some(line => line.type === "condition" && line.flag === "_talk_seen_ch3_prep_rio" && line.next_true === "faces"));
assert(/顔/.test(all.ch4_prep_rio.branches.faces.map(line => line.text).join("\n")), "ch4 Rio: Hajime brings back a face");
// 来店の書き出しを同じ型（「〜へ発つ前に、〜へ寄った。」）にそろえない
assert(talks.every(d => !/発つ前に、.+へ寄った/.test(d.lines[0].text || "")), "the openings are not one template");
// 凛想が「吸ってる人の顔を見たことがない」と明かすのは固有会話 ch1_rio_fourth。読む前の分岐では理由を明かさない
assert(!/見たことがない|見たことない/.test(all.ch3_prep_rio.branches.face_new.map(line => line.text).join("\n")), "ch3 Rio: the secret stays for ch1_rio_fourth");
// 凛想の分岐は既存の記録だけを見る（新しい保存フラグを作らない）
const conditions = talks.flatMap(d => [d.lines, ...Object.values(d.branches || {})].flat()).filter(line => line.type === "condition");
for (const line of conditions) {
  assert(["flag", "story_seen"].includes(line.condition_type), line.condition_type);
  if (line.condition_type === "flag") assert(["_talk_seen_ch2_rio_taste", "_talk_seen_ch3_prep_rio", "_met_volk",
    ...ADDED.map(person => `_talk_seen_ch3_prep_${person}`), "_talk_seen_ch3_prep_kuraudo_live"].includes(line.flag), line.flag);
  if (line.condition_type === "story_seen") assert.equal(line.dialogue, "ch1_rio_fourth");
}

// ---- ② アダム・みんと・凛想（実 spots.js） --------------------------------------------------
let state, played, affinity, playMode = "ok";
const DB = { dialogues: { ...all }, manifest: {} };
const spotsModule = await loadWithStubs("remake/js/daily/spots.js", {
  "../core/state.js": { markMet: id => { state.met[id] = true; } },
  "../core/data.js": { DB },
  "../core/stats.js": { gainAffinity: (id, n) => affinity.push([id, n]), visitAffinity: kind => ({ story: 16, talk: 8 })[kind], affinityLevel: () => 5,
    releaseAffinity: () => 0, AFFINITY_RANK_PTS: [0, 9, 20, 33, 48, 66], earnStat: () => {}, addStamina: () => {}, addMoney: () => {} },
  "../vn/engine.js": { play: async scene => { played.push(typeof scene === "string" ? scene : scene.dialogue_id); return playMode === "cancel" ? { cancelled: true } : { id: scene }; } },
  "../core/affinity-stages.js": { VISIT_SEQ: { adam: ["ch1_adam_first"], minto: ["ch1_minto_first"], rio: ["ch1_rio_first"] } },
  "./weather.js": { isRainy: () => false, RAIN_SPOT_TEXTS: {} },
  "./bonds.js": { questionVisitDue: () => false, finaleAtVisit: () => false, afterStory: async () => true },
  "./spot-encounters.js": { spotFollowupDue: () => null },
  "./trpg.js": { maybeRecruitTrpgMember: async () => false, trpgSpot: () => null },
  "./axe-bar-data.js": { AXE_BAR: { id: "axe_bar" } },
});
const spots = spotsModule.ns;
function save(chapter, patch = {}) {
  const value = { chapter, phase: "daily", day: 30, slot: 1, story: { adam: 1, minto: 1, rio: 1 }, visits: { adam: 3, minto: 3, rio: 3 },
    met: { adam: true, minto: true, rio: true }, contacts: [], affinity: { adam: 40, minto: 40, rio: 40 }, lovers: [], flags: prepFlags(chapter), ...patch };
  spotsModule.set("../core/state.js", "state", value);
  return value;
}
const ids = ["adam", "minto", "rio"];
// 準備期間（地元）だけ、その章の会話
for (const chapter of [3, 4]) {
  state = save(chapter);
  for (const id of ids) {
    assert.equal(spots.chapterTalkDue(id), `ch${chapter}_prep_${id}`, `chapter ${chapter} prep: ${id}`);
    assert.equal(spots.hasNewStory(id), true, `${id}: the map pin shows that there is something new`);
  }
}
const none = (label, value) => { state = value; for (const id of ids) assert.equal(spots.chapterTalkDue(id), null, `${label}: ${id}`); };
// 出発後（東京・ドバイの日々、その章の大会の前後とも）・後続の第5章・それより前の章には出さない
none("chapter 3 after departure", save(3, { flags: prepFlags(3, { _ch3_prep: { ...PREP, departed: true } }) }));
none("chapter 4 after departure", save(4, { flags: prepFlags(4, { _ch4_prep: { ...PREP, departed: true } }) }));
none("chapter 5 (the chapter 4 prep record stays)", save(5, { flags: prepFlags(4, { _ch4_prep: { ...PREP, departed: true } }) }));
none("chapter 5 with an unfinished record", save(5, { flags: prepFlags(4) }));
none("chapter 1", save(1, { flags: prepFlags(3) }));
none("chapter 3 without the prep record (older route)", save(3, { flags: {} }));
none("chapter 4 save holding only the chapter 3 record", save(4, { flags: prepFlags(3) }));
none("not in the daily loop", save(3, { phase: "opening" }));
none("before the first meeting", save(3, { story: {} }));
state = save(3); DB.dialogues = {}; for (const id of ids) assert.equal(spots.chapterTalkDue(id), null, "script not loaded"); DB.dialogues = { ...all };
// 第2章の凛想の会話は今までどおり（第2章だけ）
state = save(2, { flags: {} }); assert.equal(spots.chapterTalkDue("rio"), "ch2_rio_strawberry");
// #3097 第1弾: アダム・みんとにも第2章だけの会話が一本ずつ（第3章の送り出しとは別。第3章では下のとおり出ない）
assert.equal(spots.chapterTalkDue("adam"), "ch2_adam_ticket_machine");
assert.equal(spots.chapterTalkDue("minto"), "ch2_minto_commute_frame");
state = save(3); assert.equal(spots.chapterTalkDue("rio"), "ch3_prep_rio", "chapter 2 talks are not read in chapter 3");
// 一度だけ。来店の会話として読み、昼夜のあいさつは重ねない。好感度は通いの値
state = save(3); played = []; affinity = [];
assert.equal(await spots.visitChar("adam", { welcome: "venue_adam_night" }), true);
assert.deepEqual(played, ["ch3_prep_adam"], "the talk has its own arrival, so no greeting first");
assert.equal(state.flags._talk_seen_ch3_prep_adam, true);
assert.deepEqual(plain(affinity), [["adam", 8]]);
assert.equal(state.visits.adam, 4, "an ordinary visit");
assert.equal(spots.chapterTalkDue("adam"), null, "read once");
played = []; affinity = [];
await spots.visitChar("adam", { welcome: "venue_adam_night" });
assert.equal(played[0], "venue_adam_night", "the next visit is the usual one");
assert(!played.includes("ch3_prep_adam"));
// 第3章で読んでも、第4章の会話は別に一度
state = save(4, { flags: prepFlags(4, { _talk_seen_ch3_prep_adam: true }) }); assert.equal(spots.chapterTalkDue("adam"), "ch4_prep_adam");
// 中断したら既読にしない（次の来店で読み直せる）
state = save(4); playMode = "cancel"; played = []; affinity = [];
assert.equal(await spots.visitChar("minto"), false);
assert.equal(state.flags._talk_seen_ch4_prep_minto, undefined); assert.deepEqual(plain(affinity), []);
playMode = "ok";
assert.equal(await spots.visitChar("minto"), true);
assert.deepEqual(played.slice(-1), ["ch4_prep_minto"]); assert.equal(state.flags._talk_seen_ch4_prep_minto, true);
// 段階会話が残っていても、準備期間の短さを考えて送り出しの会話を先に（段階は次の来店）
state = save(3, { story: { adam: 1, minto: 1, rio: 1 } });
spotsModule.set("../core/affinity-stages.js", "VISIT_SEQ", { adam: ["ch1_adam_first", "remake_repeat_adam_0"], minto: ["ch1_minto_first"], rio: ["ch1_rio_first"] });
played = [];
await spots.visitChar("adam"); assert.deepEqual(played, ["ch3_prep_adam"]); assert.equal(state.story.adam, 1);
spotsModule.set("../core/affinity-stages.js", "VISIT_SEQ", { adam: ["ch1_adam_first"], minto: ["ch1_minto_first", "ch1_minto_second"], rio: ["ch1_rio_first"] });
// 正体がつながる回・途中の質問が先に来る来店では、いつものあいさつを残し、送り出しの会話は次の来店へ（既読にしない）
DB.dialogues = { ...all, ch1_minto_identity_reveal: { dialogue_id: "ch1_minto_identity_reveal", lines: [{ speaker: "minto", face: "normal", text: "……" }] } };
state = save(3, { story: { adam: 1, minto: 2, rio: 1 }, flags: { _ch3_prep: { ...PREP } } }); played = []; affinity = [];
assert.equal(await spots.visitChar("minto", { welcome: "venue_minto_night" }), true);
assert.deepEqual(played, ["venue_minto_night", "ch1_minto_identity_reveal"], "the identity reveal keeps its greeting");
assert.equal(state.flags._talk_seen_ch3_prep_minto, undefined);
state.flags._minto_identity_revealed = true;
assert.equal(spots.chapterTalkDue("minto"), "ch3_prep_minto", "the send-off talk waits for the next visit");
DB.dialogues = { ...all };
spotsModule.set("./bonds.js", "questionVisitDue", id => id === "adam");
spotsModule.set("./bonds.js", "playQuestionVisit", async id => { played.push(`question_${id}`); return true; });
state = save(4); played = []; affinity = [];
assert.equal(await spots.visitChar("adam", { welcome: "venue_adam_night" }), true);
assert.deepEqual(played, ["venue_adam_night", "question_adam"], "the question visit keeps its greeting");
assert.equal(state.flags._talk_seen_ch4_prep_adam, undefined);
spotsModule.set("./bonds.js", "questionVisitDue", () => false);
assert.equal(spots.chapterTalkDue("adam"), "ch4_prep_adam");
// #3097 PR-I: つむぎ（tonariの客席。固有会話を読んだ後）と、柚ヶ谷の三人（第2章の最初の来店の会話 _ch2_talks の後）
const LOCALS = ["tsumugi", "ageha", "kumicho", "kuraudo"];
const known = (chapter, flags = {}, patch = {}) => save(chapter, { story: { adam: 1, minto: 1, rio: 1, tsumugi: 1 },
  visits: { adam: 3, minto: 3, rio: 3, tsumugi: 3 }, met: { adam: true, minto: true, rio: true, tsumugi: true },
  flags: prepFlags(chapter, { _ch2_talks: { ageha: 1, kumicho: 1, kuraudo: 1 }, ...flags }), ...patch });
for (const chapter of [3, 4]) {
  state = known(chapter);
  for (const id of LOCALS) assert.equal(spots.chapterTalkDue(id), `ch${chapter}_prep_${id}`, `chapter ${chapter} prep: ${id}`);
  assert.equal(spots.hasNewStory("tsumugi"), true, "the tonari pin shows Tsumugi's new talk");
}
const noneOf = (label, value) => { state = value; for (const id of LOCALS) assert.equal(spots.chapterTalkDue(id), null, `${label}: ${id}`); };
noneOf("chapter 3 after departure", known(3, { _ch3_prep: { ...PREP, departed: true } }));
noneOf("chapter 4 after departure", known(4, { _ch4_prep: { ...PREP, departed: true } }));
noneOf("chapter 5", known(5, { _ch4_prep: { ...PREP, departed: true } }));
// 第2章は送り出しを出さない。つむぎだけは第2章の客席の会話（#3097 第5弾）が先に来る（送り出しではない）
state = known(2, { _ch3_prep: { ...PREP } });
for (const id of ["ageha", "kumicho", "kuraudo"]) assert.equal(spots.chapterTalkDue(id), null, `chapter 2: ${id}`);
assert.equal(spots.chapterTalkDue("tsumugi"), "ch2_tsumugi_charcoal_bread", "chapter 2: Tsumugi's own chapter 2 talk, not a send-off");
noneOf("before the first talk", save(3, { flags: prepFlags(3, { _ch2_talks: { ageha: 0 } }) }));
// 第2章で余りチケットを受け取った人は、第3章はライブの夜（ch3_prep_kuraudo_live）が送り出し。第4章の送り出しは読める
state = known(3, { _ch2_kuraudo_ticket: true }); assert.equal(spots.chapterTalkDue("kuraudo"), null, "the live night is the chapter 3 send-off");
assert.equal(spots.chapterTalkDue("kumicho"), "ch3_prep_kumicho");
state = known(4, { _ch2_kuraudo_ticket: true }); assert.equal(spots.chapterTalkDue("kuraudo"), "ch4_prep_kuraudo");
// 第3章で読んでも、第4章の会話は別に一度
state = known(4, { _talk_seen_ch3_prep_tsumugi: true, _talk_seen_ch3_prep_ageha: true });
assert.equal(spots.chapterTalkDue("tsumugi"), "ch4_prep_tsumugi"); assert.equal(spots.chapterTalkDue("ageha"), "ch4_prep_ageha");
// つむぎは客席の来店（visitChar）で一度だけ。好感度は通いの値
state = known(3); played = []; affinity = [];
assert.equal(await spots.visitChar("tsumugi"), true);
assert.deepEqual(played, ["ch3_prep_tsumugi"]);
assert.equal(state.flags._talk_seen_ch3_prep_tsumugi, true); assert.deepEqual(plain(affinity), [["tsumugi", 8]]);
assert.equal(spots.chapterTalkDue("tsumugi"), null, "read once");
played = []; await spots.visitChar("tsumugi"); assert(!played.includes("ch3_prep_tsumugi"));
// 中断したら既読にしない
state = known(4); playMode = "cancel"; played = []; affinity = [];
assert.equal(await spots.visitChar("tsumugi"), false);
assert.equal(state.flags._talk_seen_ch4_prep_tsumugi, undefined); assert.deepEqual(plain(affinity), []);
playMode = "ok";

// ---- ③ サメちゃん（実 samechan.js） ----------------------------------------------------
let shark, sharkPlayed, sharkAffinity;
const sharkDB = { dialogues: { ...all }, samechan: samechanData };
const sharkModule = await loadWithStubs("remake/js/daily/samechan.js", {
  "../core/data.js": { DB: sharkDB, sceneBg: () => ({}), loadCinemaDialogue: async () => {} },
  "../core/state.js": { save: () => {}, markMet: id => { shark.met[id] = true; }, timeOfDay: () => "night" },
  "../core/ui.js": { setBg: async () => {} },
  "../core/scene-motions.js": { sharkSwim: async swap => swap() },
  "../core/stats.js": { gainAffinity: (id, n) => sharkAffinity.push([id, n]), visitAffinity: kind => ({ story: 16, talk: 8 })[kind], affinityLevel: () => 2, releaseAffinity: () => 0,
    ensureAffinityLevel: () => {}, earnStat: () => {}, addMoney: () => {}, addStamina: () => {}, STAMINA_LOW: 25 },
  "../vn/engine.js": { play: async scene => { sharkPlayed.push(typeof scene === "string" ? scene : scene.dialogue_id); return { id: scene }; }, isPlaying: () => false },
  "./bonds.js": { finaleAtVisit: () => false, playFinale: async () => false, BOND_FINALES: { samechan: { dialogue: "samechan_bond_finale" } } },
  "./trpg.js": { maybeRecruitTrpgMember: async () => false },
  "../core/cinema-discovery.js": { CINEMA_INTRO: "cinema_intro", cinemaIntroductionDue: () => false },
  "../core/affinity-stages.js": { SAMECHAN_HEART_EVENTS: [], samechanHeartEventDone: () => true, questionDoneKey: id => `_question_done_${id}` },
  "./cinema.js": { readCinemaIntroduction: async () => true },
});
const samechan = sharkModule.ns;
function sharkSave(chapter, patch = {}) {
  const value = { chapter, phase: "daily", day: 30, slot: 0, stamina: 90, money: 50000, story: { samechan: 2 }, met: { samechan: true },
    contacts: ["samechan"], lovers: [], affinity: { samechan: 20 }, spotVisits: {}, flags: prepFlags(chapter), ...patch };
  sharkModule.set("../core/state.js", "state", value);
  return value;
}
assert.deepEqual(plain(samechan.SAMECHAN_PREP_TALKS), { 3: "ch3_prep_samechan", 4: "ch4_prep_samechan" });
for (const chapter of [3, 4]) { shark = sharkSave(chapter); assert.equal(samechan.samechanVisitDialogue(), `ch${chapter}_prep_samechan`); }
shark = sharkSave(3, { story: { samechan: 0 } }); assert.equal(samechan.samechanVisitDialogue(), "samechan_shop_first", "the first visit stays the first visit");
for (const [label, value] of [
  ["after departure", sharkSave(3, { flags: prepFlags(3, { _ch3_prep: { ...PREP, departed: true } }) })],
  ["chapter 2", sharkSave(2, { flags: {} })],
  ["chapter 5", sharkSave(5, { flags: prepFlags(4) })],
]) { shark = value; assert(!/_prep_samechan$/.test(samechan.samechanVisitDialogue() || ""), label); }
shark = sharkSave(4); sharkDB.dialogues = { ...all }; delete sharkDB.dialogues.ch4_prep_samechan;
assert.notEqual(samechan.samechanVisitDialogue(), "ch4_prep_samechan", "script not loaded"); sharkDB.dialogues = { ...all };
// 来店で読む（代金・体力・好感度は通常の来店と同じ）→ 既読 → 次は通常の来店
const spot = { ...samechanData.spot, region: "home" };
shark = sharkSave(3); sharkPlayed = []; sharkAffinity = [];
assert.equal(await samechan.visitSamechan(spot), true);
assert.deepEqual(sharkPlayed, ["ch3_prep_samechan"]);
assert.equal(shark.flags._talk_seen_ch3_prep_samechan, true);
assert.equal(shark.story.samechan, 3); assert.deepEqual(plain(sharkAffinity), [["samechan", 8]]); // 送り出しの会話は通いの小会話と同じ（BLC01）
shark.slot = 1; sharkPlayed = [];
await samechan.visitSamechan(spot);
assert(!sharkPlayed.includes("ch3_prep_samechan"), "read once");

// ---- ④ ひより（実 hiyori.js・#3097 PR-I） --------------------------------------------------
// tonariでの再会（_hiyori_tonari_return_done）の後、準備期間の夜（仕事帰り）のtonariの対面で一度だけ。物語の段階・質問・締めくくりが先。
let hiyoriPlayed = [], hiyoriMode = "ok", readyEvent = null, hiyoriSaves = 0;
const hiyoriDB = { dialogues: { ...all, hiyori_peach_talk: { dialogue_id: "hiyori_peach_talk", lines: [{ speaker: "hiyori", face: "normal", text: "ピーチ" }] } } };
const hiyoriModule = await loadWithStubs("remake/js/daily/hiyori.js", {
  "../core/data.js": { DB: hiyoriDB },
  "../core/state.js": { save: () => { hiyoriSaves++; } },
  "../core/hiyori-route.js": { hiyoriRoute: () => ({ enabled: true, storyEvents: [], events: [{ id: "peach_talk", dialogue: "hiyori_peach_talk", flag: "_hiyori_peach_talk_done" }] }),
    hiyoriEventStatus: id => id === readyEvent ? "ready" : "seen", hiyoriHasContact: () => true },
  "../vn/engine.js": { play: async scene => { hiyoriPlayed.push(scene); return hiyoriMode === "cancel" ? { cancelled: true } : { id: scene }; }, isPlaying: () => false },
  "./bonds.js": { hiyoriQuestionReady: () => false, finaleAtVisit: () => false, playFinale: async () => false, afterStory: async () => true },
  "../core/axe-bar-discovery.js": { axeBarRumorDue: () => false, hiyoriFirstMeetingReady: () => true },
  "../core/bus.js": { on: () => () => {} },
  "./trpg.js": { maybeRecruitTrpgMember: async () => false },
});
const hiyori = hiyoriModule.ns;
const hiyoriSave = (chapter, flags = {}, patch = {}) => {
  const value = { chapter, phase: "daily", day: 30, slot: 1, met: { hiyori: true }, story: { hiyori: 4 }, contacts: [], lovers: [],
    finales: {}, affinity: {}, flags: prepFlags(chapter, { _hiyori_tonari_return_done: true, ...flags }), ...patch };
  hiyoriModule.set("../core/state.js", "state", value);
  return value;
};
assert.deepEqual(plain(hiyori.HIYORI_PREP_TALKS), { 3: "ch3_prep_hiyori", 4: "ch4_prep_hiyori" });
for (const chapter of [3, 4]) {
  hiyoriSave(chapter);
  assert.equal(hiyori.hiyoriPrepTalkDue(), `ch${chapter}_prep_hiyori`);
  assert.equal(hiyori.hiyoriAtTonari(), true, "the tonari pin shows Hiyori while her send-off waits");
}
for (const [label, value] of [
  ["daytime (she comes after work)", () => hiyoriSave(3, {}, { slot: 0 })],
  ["before the tonari reunion", () => hiyoriSave(3, { _hiyori_tonari_return_done: false })],
  ["not met", () => hiyoriSave(3, {}, { met: {} })],
  ["after departure", () => hiyoriSave(3, { _ch3_prep: { ...PREP, departed: true } })],
  ["chapter 4 save holding only the chapter 3 record", () => hiyoriSave(4, { _ch4_prep: undefined, _ch3_prep: { ...PREP } })],
  ["chapter 5", () => hiyoriSave(5, { _ch4_prep: { ...PREP, departed: true } })],
  ["chapter 2", () => hiyoriSave(2, { _ch3_prep: { ...PREP } })],
  ["not in the daily loop", () => hiyoriSave(3, {}, { phase: "opening" })],
]) { value(); assert.equal(hiyori.hiyoriPrepTalkDue(), null, label); assert.equal(hiyori.hiyoriAtTonari(), false, label); }
{
  const saved = hiyoriDB.dialogues.ch3_prep_hiyori; delete hiyoriDB.dialogues.ch3_prep_hiyori;
  hiyoriSave(3); assert.equal(hiyori.hiyoriPrepTalkDue(), null, "script not loaded");
  hiyoriDB.dialogues.ch3_prep_hiyori = saved;
}
// 中断は既読にしない。最後まで読んだら既読で、次の対面には出ない
let hiyoriState = hiyoriSave(3); hiyoriMode = "cancel"; hiyoriPlayed = [];
assert.equal(await hiyori.meetHiyoriAtTonari(), false);
assert.deepEqual(hiyoriPlayed, ["ch3_prep_hiyori"]); assert.equal(hiyoriState.flags._talk_seen_ch3_prep_hiyori, undefined);
hiyoriMode = "ok"; hiyoriPlayed = []; hiyoriSaves = 0;
assert.equal(await hiyori.meetHiyoriAtTonari(), true);
assert.deepEqual(hiyoriPlayed, ["ch3_prep_hiyori"]); assert.equal(hiyoriState.flags._talk_seen_ch3_prep_hiyori, true);
assert.equal(hiyoriSaves, 1); assert.deepEqual(plain(hiyoriState.affinity), {}, "no affinity of its own (the tonari visit settles as usual)");
hiyoriPlayed = []; assert.equal(await hiyori.meetHiyoriAtTonari(), false); assert.deepEqual(hiyoriPlayed, [], "read once");
// 第3章で読んでも、第4章の送り出しは別に一度
hiyoriState = hiyoriSave(4, { _talk_seen_ch3_prep_hiyori: true }); assert.equal(hiyori.hiyoriPrepTalkDue(), "ch4_prep_hiyori");
// 客席でつむぎの新しい話を読む来店（daily/tonari.js が prepTalk: false を渡す）では、次の対面へ残す
hiyoriPlayed = []; assert.equal(await hiyori.meetHiyoriAtTonari({ prepTalk: false }), false);
assert.deepEqual(hiyoriPlayed, []); assert.equal(hiyoriState.flags._talk_seen_ch4_prep_hiyori, undefined);
// 物語の段階（♥4のピーチの会話など）が待っている対面では、段階が先。送り出しは次の対面
readyEvent = "peach_talk"; hiyoriPlayed = [];
assert.equal(await hiyori.meetHiyoriAtTonari(), true);
assert.deepEqual(hiyoriPlayed, ["hiyori_peach_talk"]); assert.equal(hiyoriState.flags._talk_seen_ch4_prep_hiyori, undefined);
readyEvent = null; hiyoriPlayed = [];
assert.equal(await hiyori.meetHiyoriAtTonari(), true); assert.deepEqual(hiyoriPlayed, ["ch4_prep_hiyori"]);
// 客席の来店（実 tonari.js の tonariCustomer）: つむぎが新しい話を持っている夜だけ、ひよりの送り出しを次の対面へ残す
{
  let tsumugiHere = true, tsumugiNew = true;
  const calls = [];
  const tonariModule = await loadWithStubs("remake/js/daily/tonari.js", {
    "./hiyori.js": { meetHiyoriAtTonari: async opts => { calls.push(["hiyori", plain(opts)]); return false; } },
    "./tsumugi-schedule.js": { tsumugiAtTonari: () => tsumugiHere },
    "./spots.js": { hasNewStory: id => id === "tsumugi" && tsumugiNew, visitChar: async id => { calls.push(["visit", id]); return true; } },
    "../vn/engine.js": { play: async () => ({}) },
    "./fortune-rumor.js": { hearFortuneRumor: async () => true },
    "../core/growth.js": { consultLessons: async () => [] },
  });
  for (const [here, fresh, prepTalk] of [[true, true, false], [true, false, true], [false, true, true]]) {
    tsumugiHere = here; tsumugiNew = fresh; calls.length = 0;
    tonariModule.set("../core/state.js", "state", { chapter: 3, day: 30, slot: 1, flags: prepFlags(3) });
    assert.equal(await tonariModule.ns.tonariCustomer(), true);
    assert.deepEqual(calls[0], ["hiyori", { prepTalk }], `tsumugi here=${here} new=${fresh}`);
    assert.deepEqual(calls.slice(1), here ? [["visit", "tsumugi"]] : []);
  }
}

// ---- ⑤ 準備期間の入口（実 departure-prep.js） ----------------------------------------------
let prepState, captured = null, readCalls = [], readFails = false;
const prepDB = { dialogues: {} };
const homeSpots = [...spots.SPOTS, { ...samechanData.spot, region: "home" }, { id: "trpg", kind: "trpg" }];
const prepModule = await loadWithStubs("remake/js/chapters/departure-prep.js", {
  // 店頭・未面識の納品紹介はshop_greeting.mjsで実runnerとともに検査する。
  "../daily/shop-greeting.js": { ensureRioBeforeTokyo: async () => true },
  "../core/state.js": { save: () => {}, timeOfDay: () => "day" },
  "../core/data.js": { DB: prepDB, bgUrl: x => x },
  "../core/chapter-data.js": { readDialogues: async (name, required) => {
    readCalls.push([name, [...required]]);
    if (readFails) throw new Error("offline");
    const found = Object.fromEntries(dialogueFile(name).map(d => [d.dialogue_id, d]));
    for (const id of required) assert(found[id]?.lines?.length, `${name}: ${id}`);
    return found;
  } },
  "../core/city-locations.js": { CH2_CITY_NAME: "柚ヶ谷", HOME_CITY_NAME: "橙須" },
  "../core/chapter-clock.js": { DEPARTURE_PREP_DAYS: 3 },
  "../daily/calendar.js": { runDaily: async def => { captured = def; } },
  "../daily/spots.js": { allSpots: () => homeSpots, CHAPTER_TALKS: spots.CHAPTER_TALKS, chapterTalkDue: () => null },
  "../daily/samechan.js": { SAMECHAN_PREP_TALKS: samechan.SAMECHAN_PREP_TALKS },
  "../daily/hiyori.js": { HIYORI_PREP_TALKS: hiyori.HIYORI_PREP_TALKS },
  "../daily/trpg.js": { trpgSpot: () => null },
  "./ch2-city-data.js": { MAP: { day: "map", night: "map" }, loadChapterTwoDialogues: async () => {}, loadPreparationDialogues: async () => {} },
  "./ch2-outings.js": { CITY_SHOP: { id: "ch2_shop" }, knownCityOutings: () => [] },
  "./ch2-commute.js": { returnCityHome: () => true },
  "./ch2-preparation.js": { PREPARATION_SPOTS: [], visitPreparationSpot: async () => null, kuraudoLiveDue: () => false },
});
const departure = prepModule.ns;
assert.deepEqual([...departure.departureTalkScenes()].sort(), [...SCENES].sort(), "every talk in the files is wired, and nothing else");
assert.deepEqual([...departure.DEPARTURE_TALK_FILES], TALK_FILES);
prepState = { chapter: 3, phase: "opening", day: 29, slot: 0, flags: prepFlags(3) };
prepModule.set("../core/state.js", "state", prepState);
await departure.runDeparturePrep({ destination: "東京" });
assert.deepEqual(readCalls.map(([name]) => name), TALK_FILES);
for (const id of SCENES) assert(prepDB.dialogues[id], `${id} loaded for the prep days`);
// 柚ヶ谷の地図: クラウドの店の「！」は、ライブの夜と送り出しの会話のどちらかが待っている間（神崎・あげはは spots.js の hasNewStory）
{
  const kuraudoShop = { id: "ch2_rei", charId: "kuraudo", kind: "rival", region: "widehanga" };
  prepModule.set("./ch2-preparation.js", "PREPARATION_SPOTS", [kuraudoShop]);
  const kuraudoPin = () => captured.mapOptions().regions.find(region => region.id === "widehanga").spots().find(item => item.charId === "kuraudo");
  prepModule.set("../daily/spots.js", "chapterTalkDue", id => id === "kuraudo" ? "ch3_prep_kuraudo" : null);
  assert.equal(kuraudoPin().hasNew(), true, "the send-off talk shows on Cloud's pin");
  prepModule.set("../daily/spots.js", "chapterTalkDue", () => null);
  assert.equal(kuraudoPin().hasNew(), false);
  prepModule.set("./ch2-preparation.js", "kuraudoLiveDue", () => true);
  assert.equal(kuraudoPin().hasNew(), true, "the live night still shows");
  prepModule.set("./ch2-preparation.js", "kuraudoLiveDue", () => false);
  prepModule.set("./ch2-preparation.js", "PREPARATION_SPOTS", []);
}
// 片方のファイルが読めない時は、送り出しを出さない（準備期間は始まる）
{
  const saved = captured; captured = null; prepDB.dialogues = {}; readCalls = [];
  const original = dialogueFile;
  const warn = console.warn; console.warn = () => {};
  prepModule.set("../core/chapter-data.js", "readDialogues", async name => {
    readCalls.push([name, []]);
    if (name === "ch4_prep_home") throw new Error("ch4_prep_home: HTTP 404");
    return Object.fromEntries(original(name).map(d => [d.dialogue_id, d]));
  });
  try { await departure.runDeparturePrep({ destination: "東京" }); } finally { console.warn = warn; }
  assert(captured, "the prep loop still starts");
  assert.equal(prepDB.dialogues.ch3_prep_adam, undefined, "all or nothing, as before");
  prepModule.set("../core/chapter-data.js", "readDialogues", async (name, required) => {
    readCalls.push([name, [...required]]);
    if (readFails) throw new Error("offline");
    return Object.fromEntries(dialogueFile(name).map(d => [d.dialogue_id, d]));
  });
  captured = saved;
}
assert.equal(prepState.phase, "daily", "chapterTalkDue needs the daily phase");
// 地元の地図に4人の店（EDEN・PEPPERMINT・Dr.fookah・SHISHARK）が出る
const home = captured.mapOptions().regions.find(region => region.id === "home").spots();
const pins = Object.fromEntries(home.map(item => [item.id, item.kind]));
assert.deepEqual([pins.adam, pins.minto, pins.shop, pins.shishark], ["rival", "rival", "shop", "samechan"]);
assert.equal(home.find(item => item.id === "adam").charId, "adam"); assert.equal(home.find(item => item.id === "minto").charId, "minto");
// 読み込めなくても準備期間は始まる（会話が出ないだけ）
captured = null; readFails = true; prepDB.dialogues = {};
const warn = console.warn; console.warn = () => {};
try { await departure.runDeparturePrep({ destination: "ドバイ" }); } finally { console.warn = warn; }
assert(captured, "the prep loop still starts"); assert.equal(prepDB.dialogues.ch4_prep_adam, undefined);

console.log("PASS departure home talks: one send-off talk per hometown regular in the chapter 3/4 prep days, read once, wired to the home map");
