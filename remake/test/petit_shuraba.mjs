// プチ修羅場（SRB10〜）: 決まり（core/petit-shuraba.js）と台本（data/dialogue/petit_shuraba.json・remake/data/lover.json の misfire）。
// node remake/test/petit_shuraba.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import { PETIT_KEYS, PETIT_NOTICE_IDS, PETIT_CALL_PARTNERS, PETIT_CROSS_HOSTS, PETIT_CROSS_GUESTS, PETIT_SCENES, PETIT_GAP_DAYS,
  PETIT_COUNT_FLAG, PETIT_LAST_FLAG, PETIT_NOTICE_FLAG, petitSeenFlag, petitActive, petitOpen, petitCount, markPetit,
  petitAfterDatePick, petitAfterVisitPick, joinPetitScenes } from "../js/core/petit-shuraba.js";
import { FLAG_EXACT_RULES } from "../js/core/carry.js";

const root = new URL("../../", import.meta.url);
const json = path => JSON.parse(fs.readFileSync(new URL(path, root), "utf8"));
const routes = json("data/story_routes.json");
const dialogues = Object.fromEntries(json("data/dialogue/petit_shuraba.json").dialogues.map(d => [d.dialogue_id, d]));
const lover = json("remake/data/lover.json");
const characters = json("data/characters.json");
// 第1章 DAY d。flags._elapsed_calendar が無い保存は、章と日から通算日を数える（core/chapter-clock.js）
const save = (lovers, { day = 5, flags = {} } = {}) => ({ chapter: 1, day, lovers, flags: { ...flags } });

// ---- 起きる条件: 恋人が2人以上・修羅場が表に出る前・一度きり・間を空ける
assert.deepEqual([...PETIT_NOTICE_IDS].sort(), [...routes.heroine_ids].sort(), "Every heroine has a notice scene");
assert.equal(petitActive(save([])), false);
assert.equal(petitActive(save(["rio"])), false, "One lover: nothing to hide");
assert.equal(petitActive(save(["rio", "rio"])), false, "The same lover twice is still one");
assert.equal(petitActive(save(["rio", "minto"])), true);
assert.equal(petitActive(save(["rio", "minto"], { flags: { _story_shuraba_unresolved: true } })), false, "After the real shuraba nothing is left to hide");
const two = save(["rio", "minto"]);
assert.equal(petitOpen(two, "date_call"), true);
assert.equal(petitOpen(two, "unknown"), false);
assert.equal(petitCount(two), 0);
assert.equal(markPetit(two, "date_call"), true);
assert.equal(two.flags[petitSeenFlag("date_call")], true);
assert.equal(two.flags[PETIT_COUNT_FLAG], 1);
assert.equal(two.flags[PETIT_LAST_FLAG], 5);
assert.equal(markPetit(two, "date_call"), false, "Recorded once");
assert.equal(petitCount(two), 1);
assert.equal(petitOpen(two, "date_call"), false, "Each scene happens once");
assert.equal(petitOpen(two, "notice_rio"), false, "Not on the same day as the last one");
two.day = 5 + PETIT_GAP_DAYS - 1;
assert.equal(petitOpen(two, "notice_rio"), false, "Not the day after either");
two.day = 5 + PETIT_GAP_DAYS;
assert.equal(petitOpen(two, "notice_rio"), true);
assert.equal(two.flags[PETIT_NOTICE_FLAG], undefined);
markPetit(two, "notice_rio");
assert.equal(two.flags[PETIT_NOTICE_FLAG], true, "Any notice sets the shared flag the final shuraba reads");
assert.equal(petitCount(two), 2);

// ---- デートの終わり: 着信 → その人の気づきかけ → 誤爆 → ヌールのテレビ電話、の順に一つずつ
const fresh = lovers => save(lovers);
assert.equal(petitAfterDatePick(fresh(["rio"]), "rio"), null, "One lover: no petit shuraba");
assert.equal(petitAfterDatePick(fresh(["rio", "minto"]), "tsumugi"), null, "Only after time with a lover");
const dating = fresh(["rio", "minto", "noor"]);
const order = [];
for (let day = 1; order.length < 5 && day < 40; day += PETIT_GAP_DAYS) {
  dating.day = day;
  const pick = petitAfterDatePick(dating, "rio");
  if (!pick) break;
  order.push(pick.key);
  markPetit(dating, pick.key);
}
assert.deepEqual(order, ["date_call", "notice_rio", "lime_misfire", "notice_noor"], "One per date, in this order, then nothing");
assert.deepEqual(petitAfterDatePick(fresh(["rio", "minto"]), "rio"), { key: "date_call", kind: "call", partner: "rio" });
const afterCall = fresh(["minto", "rio"]); markPetit(afterCall, "date_call"); afterCall.day += PETIT_GAP_DAYS;
assert.deepEqual(petitAfterDatePick(afterCall, "minto"), { key: "notice_minto", kind: "notice", who: "minto" });
markPetit(afterCall, "notice_minto"); afterCall.day += PETIT_GAP_DAYS;
assert.deepEqual(petitAfterDatePick(afterCall, "minto"), { key: "lime_misfire", kind: "misfire", to: "rio" }, "The thanks goes to the other lover");
// ヌールにはデート中の着信の一言が無い（地元のデートに来ない）。ヌールのテレビ電話は、ほかの恋人と会った帰り道だけ。
assert(!PETIT_CALL_PARTNERS.includes("noor"));
assert.equal(petitAfterDatePick(fresh(["noor", "rio"]), "noor").key, "notice_noor");

// ---- 店や施設の訪問の後
const town = fresh(["rio", "minto"]);
assert.deepEqual(petitAfterVisitPick(town, { kind: "tonari" }), { key: "sumi", kind: "scene", scene: "petit_sumi_reservation" });
assert.deepEqual(petitAfterVisitPick(town, { kind: "cinema" }), { key: "cinema", kind: "scene", scene: "petit_cinema_row" });
assert.deepEqual(petitAfterVisitPick(town, { kind: "shop", who: "naru" }), { key: "naru", kind: "scene", scene: "petit_naru_warning" });
assert.deepEqual(petitAfterVisitPick(town, { kind: "shop", who: "minto" }), { key: "cross", kind: "cross", host: "minto", guest: "rio" });
assert.equal(petitAfterVisitPick(town, { kind: "shop", who: "adam" }), null, "Nothing at a shop that is not a lover's");
assert.equal(petitAfterVisitPick(fresh(["rio", "tsumugi"]), { kind: "shop", who: "minto" }), null, "The shop owner must be a lover");
assert.equal(petitAfterVisitPick(fresh(["rio"]), { kind: "tonari" }), null);
// 第5章のつむぎは tonari で働いているので、予約を入れる客には数えない（第4章までは常連）。
assert.equal(petitAfterVisitPick({ ...fresh(["tsumugi", "rio"]), chapter: 5 }, { kind: "tonari" }), null);
assert.equal(petitAfterVisitPick({ ...fresh(["tsumugi", "rio", "minto"]), chapter: 5 }, { kind: "tonari" }).key, "sumi");
assert.equal(petitAfterVisitPick(fresh(["tsumugi", "rio"]), { kind: "tonari" }).key, "sumi");
assert.equal(petitAfterVisitPick(town, null), null);
// 東京のましろ・ドバイのヌールは、地元の店や映画館に居合わせない。
const far = fresh(["mashiro", "noor"]);
for (const place of [{ kind: "tonari" }, { kind: "cinema" }, { kind: "shop", who: "naru" }]) assert.equal(petitAfterVisitPick(far, place), null);
assert.equal(petitAfterVisitPick(fresh(["minto", "mashiro"]), { kind: "shop", who: "minto" }), null, "No local lover to walk in");
assert.equal(petitAfterVisitPick(fresh(["minto", "mashiro", "hiyori"]), { kind: "shop", who: "minto" }).guest, "hiyori");
// 続けては起きない。
markPetit(town, "sumi");
assert.equal(petitAfterVisitPick(town, { kind: "cinema" }), null);
town.day += PETIT_GAP_DAYS;
assert.equal(petitAfterVisitPick(town, { kind: "tonari" }), null, "The reservation scene is not repeated");
assert.equal(petitAfterVisitPick(town, { kind: "cinema" }).key, "cinema");

// ---- 台本: 使う場面がすべてあり、報酬行が無く、選択肢はどれも同じ続きへ戻る
for (const id of PETIT_SCENES) assert(dialogues[id]?.lines?.length, `${id}: scene exists`);
assert.deepEqual(Object.keys(dialogues).sort(), [...PETIT_SCENES].sort(), "No unused scene in the file");
const walk = dialogue => [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
for (const [id, dialogue] of Object.entries(dialogues)) {
  for (const line of walk(dialogue)) {
    assert(!["apply", "set_flag", "jump", "game_over"].includes(line.type) && !line.affinity && !line.stats, `${id}: no reward, flag or jump lines`);
    assert(!/【[^】]+】[^。]*上がった/.test(line.text || ""), `${id}: no reward phrasing`);
    if (line.speaker) assert(characters.some(character => character.id === line.speaker), `${id}: speaker ${line.speaker}`);
  }
  for (const line of dialogue.lines.filter(line => line.type === "choice")) {
    assert.equal(line.choices.length, 3, `${id}: three ways to dodge`);
    for (const choice of line.choices) assert(dialogue.branches?.[choice.next]?.length, `${id}: branch ${choice.next}`);
  }
  for (const branch of Object.values(dialogue.branches || {})) assert(!branch.some(line => line.type === "choice"), `${id}: branches do not nest choices`);
}
// 気づきかけ: 本人とはじめだけが話し、選択肢が一つある。謝罪・告白の言葉は出さない（決着は最後の修羅場）。
for (const id of PETIT_NOTICE_IDS) {
  const dialogue = dialogues[`petit_notice_${id}`];
  const speakers = new Set(walk(dialogue).map(line => line.speaker).filter(Boolean));
  assert(speakers.has(id) && [...speakers].every(speaker => speaker === id || speaker === "hajime"), `${id}: notice cast`);
  assert.equal(dialogue.lines.filter(line => line.type === "choice").length, 1, `${id}: one choice`);
  assert(!walk(dialogue).some(line => /付き合ってます|ごめんなさい|別れよう|別れる/.test(line.text || "")), `${id}: nothing is settled here`);
}
// 着信・居合わせは、いくつかの場面を一つの会話につないで読む。
for (const id of PETIT_CALL_PARTNERS) {
  const joined = joinPetitScenes(dialogues, ["petit_date_call", `petit_date_call_${id}`, "petit_date_call_close"]);
  assert.deepEqual(joined.lines.filter(line => line.speaker && line.speaker !== "hajime").map(line => line.speaker), [id, id], `${id}: her two lines follow the call`);
  assert.equal(joined.lines.at(-1), dialogues.petit_date_call_close.lines.at(-1));
}
for (const host of PETIT_CROSS_HOSTS) for (const guest of PETIT_CROSS_GUESTS.filter(id => id !== host)) {
  const joined = joinPetitScenes(dialogues, ["petit_cross_open", `petit_cross_host_${host}`, `petit_cross_guest_${guest}`, "petit_cross_close"]);
  assert.deepEqual(joined.lines.filter(line => line.speaker && line.speaker !== "hajime").map(line => line.speaker), [host, guest]);
  assert(joined.lines.some(line => line.type === "motion" && line.id === "gaze" && line.brief === true), "The short stare cut-in");
  assert(joined.branches.regular && joined.branches.staff && joined.branches.wallet);
}
assert.equal(joinPetitScenes(dialogues, ["petit_cross_open", "petit_cross_host_nobody"]), null);
// よその店のみんとは私服（栞）。自分の店では営業の顔。
assert(dialogues.petit_cross_guest_minto.lines.every(line => line.face.startsWith("ura_")));
assert(dialogues.petit_cross_host_minto.lines.every(line => !line.face.startsWith("ura_")));

// ---- LIMEの誤爆: 8人ぶんの返事と、はじめの言い訳3つ（どれも絆は増えない）
assert.equal(typeof lover.misfire.sent, "string");
assert.deepEqual(Object.keys(lover.misfire.to).sort(), [...routes.heroine_ids].sort());
for (const [id, lines] of Object.entries(lover.misfire.to)) {
  assert(lines.m.length >= 1 && lines.m.every(text => typeof text === "string" && !text.endsWith("。")), `${id}: her reply`);
  assert.equal(lines.r.length, 3, `${id}: three excuses`);
  for (const reply of lines.r) assert(reply.text && reply.response && reply.affinity === 0, `${id}: an excuse earns no bond`);
}

// ---- 周回: 記録はすべて分類済み（持ち越さない）
const rules = new Map(FLAG_EXACT_RULES);
for (const flag of [PETIT_COUNT_FLAG, PETIT_LAST_FLAG, PETIT_NOTICE_FLAG, ...PETIT_KEYS.map(petitSeenFlag)])
  assert.equal(rules.get(flag), "progression", `${flag}: classified for the next cycle`);
console.log(`petit shuraba: ok (${PETIT_KEYS.length} scenes)`);
