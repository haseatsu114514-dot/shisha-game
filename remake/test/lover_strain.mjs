// すれ違い（恋人の裏の数値・台帳 STR）: 決まり（core/lover-strain.js）と台本（data/dialogue/lover_strain.json・remake/data/lover.json の strain）。
// node remake/test/lover_strain.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { STRAIN_IDS, STRAIN_SIGN1, STRAIN_SIGN2, STRAIN_TALK, STRAIN_MAX, STRAIN_CAUSES, STRAIN_GAIN, STRAIN_EASE, STRAIN_UNREAD_DAYS,
  STRAIN_TALK_GAP, STRAIN_TALK_REST, STRAIN_KEEP_VALUE, STRAIN_EXCUSE_VALUE, STRAIN_SCENES, STRAIN_OUTCOME_FLAGS,
  strainRecord, strainOf, strainLovers, strainPaused, strainDrift, addStrain, easeStrain, strainCause, strainUnread, syncStrain,
  tickStrain, strainTalkPick, endLoverRelation, settleStrainTalk, strainSuspect, strainVisit, strainSignMessage,
  strainTalkScenes, joinStrainScenes, strainReunionPick, deferStrainReunion, settleStrainReunion,
  STRAIN_REUNION_WAIT, STRAIN_REUNION_DAYS, STRAIN_REUNION_FLAG } from "../js/core/lover-strain.js";
import { FLAG_EXACT_RULES, STATE_KEY_RULES } from "../js/core/carry.js";

const root = new URL("../../", import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const routes = json("data/story_routes.json");
const dialogues = Object.fromEntries(json("data/dialogue/lover_strain.json").dialogues.map(d => [d.dialogue_id, d]));
const lover = json("remake/data/lover.json");
// 第1章 DAY d（flags._elapsed_calendar が無い保存は、章と日から通算日を数える。core/chapter-clock.js）
const save = (lovers, { day = 1, chapter = 1, flags = {} } = {}) => ({ chapter, day, lovers: [...lovers], flags: { ...flags },
  inbox: [], lastDate: {}, pendingInvite: null });
const invite = (sender, day, result = null) => ({ id: `_date_inv_${sender}_d${day}`, day, chapter: 1, read: true, done: !!result,
  ...(result ? { result } : {}), msg: { sender, lover: true, type: "invitation", accept_event: `date_${sender}` } });
const morning = (sender, day, read = false) => ({ id: `_lover_morning_${sender}_d${day}`, day, chapter: 1, read, done: false,
  msg: { sender, lover: true, type: "chat", messages: ["おはよう"] } });
/** day 日まで朝を進める。each(day) でその日の出来事を足す */
const run = (value, until, each = () => {}) => {
  const events = [];
  for (; value.day <= until; value.day++) { each(value.day); events.push(...tickStrain(value).map(e => ({ ...e, day: value.day }))); }
  value.day = until;
  return events;
};

// ---- 対象と、止まっている時期
assert.ok(STRAIN_IDS.every(id => routes.heroine_ids.includes(id)), "Only heroines are tracked");
assert.ok(!STRAIN_IDS.includes("mashiro") && !STRAIN_IDS.includes("noor"), "Lovers who live far away are never blamed for distance");
assert.ok(STRAIN_SIGN1 < STRAIN_SIGN2 && STRAIN_SIGN2 < STRAIN_TALK && STRAIN_TALK <= STRAIN_MAX);
assert.ok(STRAIN_MAX - STRAIN_EASE.date < STRAIN_TALK, "One date always pulls a lover back from the breakup talk");
assert.deepEqual(strainLovers(save(["rio", "rio", "noor", "samechan"])), ["rio"], "Samechan only counts from chapter 2");
assert.deepEqual(strainLovers(save(["samechan"], { chapter: 2 })), ["samechan"]);
assert.equal(strainPaused(save([])), true);
assert.equal(strainPaused(save(["mashiro"])), true, "Only faraway lovers: nothing moves");
assert.equal(strainPaused(save(["rio"])), false, "One lover is enough for the system to run");
assert.equal(strainPaused(save(["rio"], { flags: { _story_shuraba_unresolved: true } })), true);
assert.equal(strainPaused(save(["rio"], { flags: { _ch2_region: "tokyo" } })), true);
assert.equal(strainPaused(save(["rio"], { flags: { _ch2_region: "dubai" } })), true);
assert.equal(strainPaused(save(["rio"], { chapter: 3, flags: { _ch3_prep: { startDay: 15, days: 3 } } })), true, "Departure prep");

// ---- 女の勘: 1人なら0、人数が多いほど速い（6人で頭打ち）
assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 8].map(strainDrift), [0, 0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.5]);

// ---- 恋人が1人: 何もしなければ溜まらない。誘いを断り続ける・LIMEを放っておく「よっぽど」の時だけ別れ話まで行く
const calm = save(["tsumugi"]);
assert.deepEqual(run(calm, 30), [], "A single lover never drifts");
assert.equal(strainOf(calm, "tsumugi"), 0);

const cold = save(["tsumugi"]);
const coldEvents = run(cold, 22, day => { if (day % 4 === 0) cold.inbox.push(invite("tsumugi", day - 1, "declined")); });
assert.deepEqual(coldEvents.map(e => [e.stage, e.cause, e.day]), [[1, "decline", 8], [2, "decline", 16]], "Signs after the 2nd and 4th refusal");
assert.equal(strainOf(cold, "tsumugi"), 5 * STRAIN_GAIN.decline);
assert.equal(strainOf(cold, "tsumugi") >= STRAIN_TALK, true, "Five refusals in a row: she asks to talk");
assert.deepEqual(strainTalkPick(cold), { id: "tsumugi", cause: "decline", again: false });
assert.equal(cold.inbox.every(item => item.strain === true), true, "Each refusal is counted once");
run(cold, 23);
assert.equal(strainOf(cold, "tsumugi"), 10, "Counted items are not counted again");

const ghost = save(["hiyori"]);
ghost.inbox.push(morning("hiyori", 1));
assert.equal(strainUnread(ghost, "hiyori"), false, "The day it arrives is not neglect");
ghost.day = 1 + STRAIN_UNREAD_DAYS;
assert.equal(strainUnread(ghost, "hiyori"), true);
// 章をまたいでも、届いた日からの通算日で数える（第1章 DAY 14 に届いた分は、第2章 DAY 1 の朝にはまだ1日）
const border = { ...save(["hiyori"], { chapter: 2, day: 1 }), inbox: [{ ...morning("hiyori", 14), chapter: 1 }] };
assert.equal(strainUnread(border, "hiyori"), false);
border.day = 2;
assert.equal(strainUnread(border, "hiyori"), true);
ghost.day = 1;
const ghostEvents = run(ghost, 23);
assert.equal(strainOf(ghost, "hiyori"), 10.5, "Half a point for each morning the message stays unopened");
assert.deepEqual(ghostEvents.map(e => [e.stage, e.cause]), [[1, "unread"], [2, "unread"]]);
assert.equal(strainTalkPick(ghost).cause, "unread");
ghost.inbox[0].read = true;
run(ghost, 30);
assert.equal(strainOf(ghost, "hiyori"), 10.5, "Reading it stops the count");
const expired = save(["rio"]);
expired.inbox.push(invite("rio", 1, "expired"));
syncStrain(expired); // 最初の一度は、前からあった分を数えない
assert.equal(strainOf(expired, "rio"), 0, "Refusals from before the system existed are not held against the player");
expired.inbox.push(invite("rio", 2, "expired"), { ...invite("rio", 3, "accepted"), completed: true });
syncStrain(expired);
assert.equal(strainOf(expired, "rio"), STRAIN_GAIN.expired, "An invitation left unanswered counts less than a refusal");
assert.equal(strainCause(expired, "rio"), "decline");

// ---- 減る: デート・返事・その人の店へ顔を出す。記念日は数えない（溜める側に無い）
const mend = save(["ageha"]);
mend.lastDate.ageha = 3;
syncStrain(mend);
addStrain(mend, "ageha", 9, "decline");
syncStrain(mend);
assert.equal(strainOf(mend, "ageha"), 9, "A date from before the record began does not count");
mend.lastDate.ageha = 6;
syncStrain(mend);
assert.equal(strainOf(mend, "ageha"), 9 - STRAIN_EASE.date);
assert.equal(strainRecord(mend, "ageha").why.decline, 5, "The reasons fade with the number");
mend.inbox.push({ id: "_lover_strain_ageha_s2_t6", day: 6, chapter: 1, read: true, done: true, replyState: "replied",
  msg: { sender: "ageha", lover: true, type: "chat", messages: ["……"], replies: [{ text: "ごめん" }] } });
syncStrain(mend);
syncStrain(mend);
assert.equal(strainOf(mend, "ageha"), 9 - STRAIN_EASE.date - STRAIN_EASE.reply, "A reply eases once");
mend.day = 7;
assert.equal(strainVisit(mend, "ageha"), STRAIN_EASE.visit);
assert.equal(strainVisit(mend, "ageha"), 0, "A visit eases once a day");
assert.equal(strainVisit(mend, "rio"), 0, "Not a lover");
assert.equal(easeStrain(mend, "ageha", 99), 3);
assert.equal(strainOf(mend, "ageha"), 0);
assert.equal(addStrain(mend, "ageha", 99, "unread"), STRAIN_MAX, "Capped");
assert.equal(addStrain(mend, "noor", 3, "unread"), 0, "Untracked lovers gain nothing");
assert.equal(JSON.stringify(STRAIN_GAIN).includes("anniv"), false);

// ---- 恋人が2人以上: 何もしなくても少しずつ溜まる。誘いに乗っていれば2〜3人は予兆まで行かず、増えるほど追いつかなくなる
const steady = (lovers, days) => {
  const value = save(lovers);
  const local = strainLovers(value);
  let peak = 0, turn = 0;
  const events = run(value, days, day => {
    // 誘いは全員あわせて4日に1回。届いた誘いには必ず乗る（romance.js の LOVER_INVITE_GAP）
    if (day % 4 === 0) { value.lastDate[local[turn++ % local.length]] = day; }
    peak = Math.max(peak, ...local.map(id => strainOf(value, id)));
  });
  return { value, events, peak };
};
assert.ok(steady(["tsumugi", "rio"], 60).peak < STRAIN_SIGN1, "Two lovers, every invitation accepted: no sign at all");
assert.ok(steady(["tsumugi", "rio", "ageha"], 60).peak < STRAIN_SIGN1, "Three lovers: still fine");
const harem = steady(["tsumugi", "minto", "rio", "ageha", "samechan", "hiyori", "mashiro", "noor"], 60);
assert.ok(harem.events.some(e => e.stage === 2 && e.cause === "suspect"), "Many lovers: intuition catches up even with every date kept");
assert.ok(harem.peak >= STRAIN_TALK, "…and ends in a breakup talk");
assert.equal(harem.value.loverStrain.by.mashiro, undefined, "Faraway lovers add to the count but are not tracked");
const petit = save(["rio", "minto"]);
strainSuspect(petit, ["rio", "noor", "rio"]);
assert.equal(strainOf(petit, "rio"), STRAIN_GAIN.petit);
assert.equal(strainOf(petit, "minto"), 0);
assert.equal(strainCause(petit, "minto"), "suspect", "With two lovers the default reason is intuition");
assert.equal(strainCause(save(["rio"]), "rio"), "unread");

// ---- 朝は一日一度だけ進む。予兆は段ごとに一度で、境目を行き来しても繰り返さない
const once = save(["rio", "minto"]);
tickStrain(once);
tickStrain(once);
assert.equal(strainOf(once, "rio"), 0.1);
const edge = save(["rio"]);
addStrain(edge, "rio", STRAIN_SIGN1, "decline");
assert.deepEqual(tickStrain(edge), [{ id: "rio", stage: 1, cause: "decline" }]);
easeStrain(edge, "rio", 0.5);
edge.day = 2; tickStrain(edge);
addStrain(edge, "rio", 0.5, "decline");
edge.day = 3;
assert.deepEqual(tickStrain(edge), [], "Hovering at the threshold does not repeat the sign");
easeStrain(edge, "rio", 2);
edge.day = 4; tickStrain(edge);
addStrain(edge, "rio", 2, "decline");
edge.day = 5;
assert.equal(tickStrain(edge).length, 1, "After really recovering, the sign can show again");

// ---- 別れ話: いちばん溜まっている一人・間隔・答え3つ。引き止めに回数の上限は無い
const night = save(["tsumugi", "rio", "ageha"], { day: 20 });
addStrain(night, "tsumugi", 10, "unread");
addStrain(night, "rio", 11, "decline");
assert.equal(strainTalkPick(night).id, "rio");
assert.equal(settleStrainTalk(night, "rio", "keep"), true);
assert.deepEqual(night.lovers, ["tsumugi", "rio", "ageha"], "Held back: still lovers");
assert.equal(strainOf(night, "rio"), STRAIN_KEEP_VALUE);
assert.equal(strainTalkPick(night), null, "No second talk the same week, with anyone");
night.day = 20 + STRAIN_TALK_GAP;
assert.equal(strainTalkPick(night).id, "tsumugi");
assert.equal(settleStrainTalk(night, "tsumugi", "excuse"), true);
assert.equal(strainOf(night, "tsumugi"), STRAIN_EXCUSE_VALUE);
assert.equal(strainRecord(night, "tsumugi").sign, 1, "An excuse leaves her at the first sign");
assert.ok(STRAIN_EXCUSE_VALUE >= STRAIN_SIGN1 && STRAIN_EXCUSE_VALUE < STRAIN_SIGN2);
addStrain(night, "rio", 11, "unread");
night.day = 20 + STRAIN_TALK_REST - 1;
assert.equal(strainTalkPick(night), null, "The same lover rests longer between talks");
night.day = 20 + STRAIN_TALK_REST;
assert.deepEqual(strainTalkPick(night), { id: "rio", cause: "unread", again: true }, "It can happen again, as often as she is neglected");
night.pendingInvite = { sender: "rio", event: "date_rio", day: night.day };
night.inbox.push(invite("rio", night.day), invite("ageha", night.day));
night.flags._confession_due = "rio";
assert.equal(settleStrainTalk(night, "rio", "end"), true);
assert.deepEqual(night.lovers, ["tsumugi", "ageha"], "Accepted: back to friends");
assert.equal(night.flags._friend_rio, true);
assert.equal(night.flags._confession_due, undefined);
assert.equal(night.pendingInvite, null, "The date she was promised is gone");
assert.equal(night.inbox.find(item => item.msg.sender === "rio").result, "expired");
assert.equal(night.inbox.find(item => item.msg.sender === "ageha").result, undefined, "Other lovers are untouched");
assert.equal(strainRecord(night, "rio").talks, 2);
assert.equal(strainRecord(night, "rio").ex, night.day);
assert.equal(settleStrainTalk(night, "rio", "keep"), false, "No longer a lover");
assert.equal(endLoverRelation(night, "rio"), false);
assert.equal(addStrain(night, "rio", 5, "unread"), 0);
const paused = save(["rio"], { day: 20, flags: { _ch2_region: "tokyo" } });
strainRecord(paused, "rio").v = 11;
assert.equal(strainTalkPick(paused), null, "Nothing happens while away");
assert.deepEqual(tickStrain(paused), []);

// ---- やり直し（復縁）: 友達に戻った相手に、章をまたいだ後、こちらから一度だけ申し込める
const ex = save(["tsumugi"], { day: 10 });
addStrain(ex, "tsumugi", 10, "decline");
settleStrainTalk(ex, "tsumugi", "end");
assert.equal(strainRecord(ex, "tsumugi").exChapter, 1);
assert.equal(strainReunionPick(ex), null, "Not in the chapter she left");
ex.day = 14;
assert.equal(strainReunionPick(ex), null);
Object.assign(ex, { chapter: 2, day: 1 });
assert.equal(strainReunionPick(ex), "tsumugi", "From the next chapter on");
ex.flags._ch2_region = "tokyo";
assert.equal(strainReunionPick(ex), null, "Not while away");
delete ex.flags._ch2_region;
deferStrainReunion(ex, "tsumugi");
assert.equal(strainReunionPick(ex), null, "'Not now' waits a few days");
ex.day = STRAIN_REUNION_WAIT;
assert.equal(strainReunionPick(ex), null);
ex.day = 1 + STRAIN_REUNION_WAIT;
assert.equal(strainReunionPick(ex), "tsumugi", "…and the chance is still there");
assert.equal(settleStrainReunion(ex, "tsumugi"), true);
assert.deepEqual([strainRecord(ex, "tsumugi").ex, strainRecord(ex, "tsumugi").reunited, strainRecord(ex, "tsumugi").askDay], [null, true, undefined]);
ex.lovers.push("tsumugi"); delete ex.flags._friend_tsumugi; // 恋人へ戻す処理は daily/romance.js の rejoinLover
assert.equal(strainReunionPick(ex), null);
assert.equal(settleStrainReunion(ex, "tsumugi"), false);
addStrain(ex, "tsumugi", 10, "unread");
ex.day = 30;
settleStrainTalk(ex, "tsumugi", "end");
Object.assign(ex, { chapter: 3, day: 1 });
assert.equal(strainReunionPick(ex), null, "Only once per lover: the second goodbye is final");
const legacy = { ...save([], { day: 5 }), loverStrain: { by: { rio: { ex: 2 } } } };
legacy.flags._friend_rio = true;
assert.equal(strainReunionPick(legacy), null);
legacy.day = 2 + STRAIN_REUNION_DAYS;
assert.equal(strainReunionPick(legacy), "rio", "A record without its chapter waits two weeks instead");
delete legacy.flags._friend_rio;
assert.equal(strainReunionPick(legacy), null, "Only someone who really went back to friends");
assert.ok(FLAG_EXACT_RULES.some(([name, kind]) => name === STRAIN_REUNION_FLAG && kind === "person"));

// ---- 保存: 周回では持ち越さない。壊れた値は空から
assert.equal(STATE_KEY_RULES.loverStrain.verdict, "reset");
for (const flag of Object.values(STRAIN_OUTCOME_FLAGS)) {
  assert.ok(FLAG_EXACT_RULES.some(([name, kind]) => name === flag && kind === "person"), `${flag} is classified`);
}
const broken = { ...save(["rio"]), loverStrain: { by: { rio: { v: "x", why: 3, sign: 9, talks: -1 } } } };
assert.deepEqual(strainRecord(broken, "rio"), { v: 0, why: {}, sign: 0, talks: 0 });
assert.equal(strainOf({ loverStrain: null }, "rio"), 0);

// ---- 台本: 6人 ×（切り出し・二度目の一言・理由3つ・問いかけ）。必ず読む場面なので報酬は無い
assert.equal(STRAIN_SCENES.length, STRAIN_IDS.length * (4 + STRAIN_CAUSES.length));
for (const id of STRAIN_SCENES) assert.ok(dialogues[id]?.lines?.length, `${id} exists`);
assert.deepEqual(Object.keys(dialogues).sort(), [...STRAIN_SCENES].sort(), "No stray scenes");
const allLines = scene => [...scene.lines, ...Object.values(scene.branches || {}).flat()];
for (const id of STRAIN_IDS) {
  for (const cause of STRAIN_CAUSES) {
    const order = strainTalkScenes({ id, cause, again: true });
    assert.deepEqual(order, [`strain_talk_open_${id}`, `strain_talk_again_${id}`, `strain_talk_why_${cause}_${id}`, `strain_talk_ask_${id}`]);
    const talk = joinStrainScenes(dialogues, order);
    assert.equal(talk.metadata.private_scene, true);
    assert.deepEqual(Object.keys(talk.branches).sort(), ["end", "excuse", "keep"]);
    const speakers = new Set(allLines(talk).filter(line => !line.type && line.speaker).map(line => line.speaker));
    assert.deepEqual([...speakers].sort(), ["hajime", id].sort(), `${id}: only she and hajime speak`);
    for (const line of allLines(talk)) {
      assert.ok(!line.stats && !line.money && !line.affinity && !line.reward, `${id}: a forced scene gives no reward`);
      if (line.text) assert.ok(!/\d|ストレス|すれ違い/.test(line.text.replace(/LIME/g, "")), `${id}: the hidden number never shows (${line.text})`);
    }
  }
  assert.equal(strainTalkScenes({ id, cause: "unread", again: false }).length, 3, "The first talk has no 'again' line");
  const ask = dialogues[`strain_talk_ask_${id}`];
  const choice = ask.lines.at(-1);
  assert.equal(choice.type, "choice", `${id}: the scene ends on the answer`);
  assert.deepEqual(choice.choices.map(c => c.next), ["keep", "excuse", "end"]);
  for (const [key, flag] of Object.entries(STRAIN_OUTCOME_FLAGS)) {
    const flags = ask.branches[key].filter(line => line.type === "set_flag").map(line => line.flag);
    assert.deepEqual(flags, [flag], `${id}: ${key} reports exactly its own answer`);
  }
  // 理由が聞き取れる: 断り続けた時は「構って」、LIMEの時は「LIME」。気配の時は、二股を言い当てない
  assert.match(allLines(dialogues[`strain_talk_why_decline_${id}`]).map(l => l.text).join(""), /構って/);
  assert.match(allLines(dialogues[`strain_talk_why_unread_${id}`]).map(l => l.text).join(""), /LIME/);
  assert.doesNotMatch(allLines(dialogues[`strain_talk_why_suspect_${id}`]).map(l => l.text).join(""), /二股|浮気|付き合ってる|ほかの女|別の女/);
  assert.match(allLines(ask).map(l => l.text || "").join(""), /友達に、戻|友に、戻/, `${id}: she says what she is asking for`);
  // やり直しの場面: はじめが申し込み、彼女が受ける（選択肢は無い。申し込むかどうかは再生側の一拍で選ぶ）
  const reunion = dialogues[`strain_reunion_${id}`];
  assert.ok(reunion.lines.every(line => !line.type && !line.stats && !line.money && !line.affinity), `${id}: no choice and no reward in the reunion`);
  assert.deepEqual([...new Set(reunion.lines.filter(line => line.speaker).map(line => line.speaker))].sort(), ["hajime", id].sort());
  assert.match(reunion.lines.find(line => line.speaker === "hajime").text, /もう一度、付き合って/, `${id}: hajime is the one who asks`);
  assert.equal(reunion.lines.at(-2).speaker, id, `${id}: she gives the answer`);
  // 予兆のLIME
  const sign1 = strainSignMessage(lover, id, 1, 12), sign2 = strainSignMessage(lover, id, 2, 12);
  assert.equal(sign1.id, `_lover_strain_${id}_s1_t12`);
  assert.equal(sign1.lover, true);
  assert.equal(sign1.replies, undefined, "The first sign needs no answer");
  assert.ok(sign2.replies.length >= 1 && sign2.replies.every(reply => reply.affinity === 0 && reply.response && [...reply.text].length <= 19));
  assert.notEqual(sign2.replies, lover.strain.sign2[id].r, "The data is not shared with the inbox");
}
assert.equal(strainSignMessage(lover, "noor", 1, 1), null);
assert.equal(joinStrainScenes(dialogues, ["strain_talk_open_rio", "missing"]), null);

console.log("lover strain: PASS (pause rules, single-lover neglect, intuition by lover count, relief, signs, breakup talk outcomes, script & LIME data)");
