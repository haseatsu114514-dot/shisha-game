// 遊び場の来店のやり取り（VAR・daily/venue-arrivals.js）: 選び方・記録・台本の照合。ブラウザ不要。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VENUE_ARRIVALS, pickArrival, commitArrival, markArrival, leaveArrivalNote, arrivalGreeted,
  arrivalAtKey, arrivalTurnKey, arrivalSeenKey, arrivalNoteKey } from "../js/daily/venue-arrivals.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";

const read = path => JSON.parse(readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const source = path => readFileSync(new URL(`../js/${path}`, import.meta.url), "utf8");
const byId = file => Object.fromEntries(read(`data/dialogue/${file}.json`).dialogues.map(d => [d.dialogue_id, d]));
const arrivals = byId("venue_arrivals");
const dialogues = { ...byId("ch3_club"), ...byId("ch4_camel_race"), ...arrivals };
const characters = new Set(read("data/characters.json").map(c => c.id));
const idsOf = def => [...(def.pool || []), ...(def.regular || []), ...(def.once || []), ...(def.idle || []), ...Object.values(def.notes || {}).flat()]
  .map(entry => typeof entry === "string" ? entry : entry.id);
const newSave = (extra = {}) => ({ chapter: 1, day: 5, slot: 1, flags: {}, owned: [], trpg: { club: { members: {} } }, ...extra });
const nextSlot = save => { save.day += 1; };
/** 一本読んで記録するまで（本編の playArrival と同じ順）。 */
const visit = (venue, save, ctx = {}) => {
  const picked = pickArrival(venue, save, dialogues, ctx);
  if (picked) commitArrival(venue, picked, save);
  return picked?.id ?? null;
};

// ---- 台本の照合 --------------------------------------------------------------------------------
{
  // 束に書いた場面は、どれも台本がある
  for (const [venue, def] of Object.entries(VENUE_ARRIVALS)) {
    for (const id of idsOf(def)) assert(dialogues[id]?.lines?.length, `${venue}: 台本が無い ${id}`);
    assert.equal(new Set(idsOf(def)).size, idsOf(def).length, `${venue}: 同じ場面を二度並べている`);
  }
  // venue_arrivals.json に書いた場面は、束か店の入口のどこかで使う（書いたのに再生されない場面を残さない）
  const wired = new Set(Object.values(VENUE_ARRIVALS).flatMap(idsOf));
  const entrances = ["daily/axe-bar.js", "daily/trpg.js", "daily/dj-club.js"].map(source).join("\n");
  for (const id of Object.keys(arrivals)) {
    assert(wired.has(id) || entrances.includes(`"${id}"`), `どこからも再生されない場面: ${id}`);
  }
  // 以前は書いたまま再生されていなかった3本も束に入っている
  assert(VENUE_ARRIVALS.club_seam.pool.includes("ch3_club_floor_edge") && VENUE_ARRIVALS.club_seam.pool.includes("ch3_club_low_corner"));
  assert(VENUE_ARRIVALS.camel_track.pool.includes("ch4_camel_replay"));
  assert.match(source("daily/dj-club.js"), /"ch3_club_floor_edge", "ch3_club_low_corner"\]/, "クラブの2本を読み込む");
  // 話す人は実在し、店の人が話す（地の文だけの場面にしない）。最後の行は店の人か地の文で、メニューへ渡す
  const hosts = { axe: "maki", trpg: "sai", club: "yoru", camel: "khalil", venue_maki: "maki", venue_yoru: "yoru" };
  for (const [id, dialogue] of Object.entries(arrivals)) {
    const rows = [dialogue.lines, ...Object.values(dialogue.branches || {})].flat().filter(line => !line.type);
    for (const line of rows) if (line.speaker) assert(characters.has(line.speaker), `${id}: 話者 ${line.speaker}`);
    const host = hosts[Object.keys(hosts).find(prefix => id.startsWith(prefix))];
    assert(host, `${id}: 店の接頭辞が分からない`);
    if (id !== "trpg_cafe_first_visit_lead") assert(rows.some(line => line.speaker === host), `${id}: ${host} が話さない`);
  }
  // どの章のいつ読んでも成り立つ文にする: 大会・勝敗・味の調子に触れない（第2章の祝いの一本だけは、終わった大会の話）
  for (const [id, dialogue] of Object.entries(arrivals)) {
    const text = [dialogue.lines, ...Object.values(dialogue.branches || {})].flat().map(line => line.text || "").join("");
    if (id !== "axe_arrival_champion") assert.doesNotMatch(text, /大会|優勝|予選|決勝|王者|世界一/, `${id}: 大会に触れている`);
    assert.doesNotMatch(text, /味がしない|味覚|舌が|明日の|いよいよ|本番/, `${id}: 章の進み具合に触れている`);
    assert.doesNotMatch(text, /店の匂い/, `${id}: 章に一度のモチーフは使わない`);
  }
  assert.match(JSON.stringify(arrivals.axe_arrival_champion), /優勝/);
  const champion = VENUE_ARRIVALS.axe_bar.once.find(entry => entry.id === "axe_arrival_champion");
  assert.deepEqual([1, 2, 3, 5].map(chapter => champion.when({ chapter })), [false, true, false, false], "祝いの一本は第2章の間だけ");
  // ラクダのレース場は、仕様どおり大会・シェイク・宿に触れない
  for (const id of VENUE_ARRIVALS.camel_track.pool) {
    assert.doesNotMatch(JSON.stringify(dialogues[id]), /大会|王者|優勝|世界一|シェイク|宿/, id);
  }
  // 初めての来店: 名乗る行で終わり、登場カットインの後に続きを読む
  for (const id of ["axe_bar_first_visit", "trpg_cafe_first_visit_day", "trpg_cafe_first_visit_night"]) {
    const endings = id === "axe_bar_first_visit" ? Object.values(arrivals[id].branches) : [arrivals[id].lines];
    for (const rows of endings) assert.match(rows.at(-1).text, /斧崎マキ|六角サイ/, `${id}: 名乗って終わる`);
  }
  const first = arrivals.axe_bar_first_visit.lines.at(-1);
  assert.deepEqual([first.type, first.condition_type, first.flag, first.next_true, first.next_false],
    ["condition", "flag", "_hiyori_real_self_known", "came_before", "brand_new"], "ひよりと来たことがあれば、初めてとは言わない");
  assert.match(JSON.stringify(arrivals.axe_bar_first_visit.branches.came_before), /前に一度/);
  assert.doesNotMatch(JSON.stringify(arrivals.axe_bar_first_visit.branches.came_before), /初めて/);
}

// ---- 巡回 --------------------------------------------------------------------------------------
{
  // 一巡するまで同じ文に戻らない。入り直しでは読まない。次の日は次の一本
  const save = newSave();
  const pool = VENUE_ARRIVALS.club_seam.pool;
  const seen = [];
  for (let i = 0; i < pool.length; i++) {
    seen.push(visit("club_seam", save));
    assert.equal(pickArrival("club_seam", save, dialogues, {}), null, "同じ時間帯の入り直しでは読まない");
    assert(arrivalGreeted("club_seam", save));
    nextSlot(save);
    assert(!arrivalGreeted("club_seam", save));
  }
  assert.deepEqual(seen, pool, "束の順に一本ずつ");
  // 束を読み終えた後は、顔なじみの短いやり取りを巡回する（長い回には戻らない）
  const regular = VENUE_ARRIVALS.club_seam.regular, later = [];
  for (let i = 0; i <= regular.length; i++) { later.push(visit("club_seam", save)); nextSlot(save); }
  assert.deepEqual(later, [...regular, regular[0]]);
  assert.equal(save.flags[arrivalTurnKey("club_seam")], pool.length + regular.length + 1);
  for (const [venue, def] of Object.entries(VENUE_ARRIVALS)) {
    if (!def.regular) continue;
    assert(def.regular.length >= 2, `${venue}: 顔なじみのやり取りは2本以上`);
    for (const id of def.regular) {
      const rows = dialogues[id].lines.filter(line => !line.type);
      assert(rows.length <= 3, `${id}: 顔なじみのやり取りは3行まで`);
    }
    for (const entry of def.pool) assert(dialogues[typeof entry === "string" ? entry : entry.id].lines.length >= 4, `${venue}: 束の回は4行以上`);
  }
  // 顔なじみのやり取りが無い束（投げ終えた後の締め）は、束をもう一度巡回する
  const closing = newSave(), finish = VENUE_ARRIVALS.axe_bar_finish.pool;
  closing.flags[arrivalTurnKey("axe_bar_finish")] = finish.length;
  assert.equal(pickArrival("axe_bar_finish", closing, dialogues, {}).id, finish[0]);
  closing.flags[arrivalTurnKey("axe_bar_finish")] = finish.length + 1;
  assert.equal(pickArrival("axe_bar_finish", closing, dialogues, {}).id, finish[1]);
  // 条件が合わずに飛ばした回には戻らない（束の残りが読めない時は、顔なじみのやり取りへ）
  const skipped = newSave();
  skipped.flags[arrivalTurnKey("axe_bar")] = VENUE_ARRIVALS.axe_bar.pool.length - 1;
  const only = { ...dialogues, axe_arrival_first_timers: undefined };
  assert.equal(pickArrival("axe_bar", skipped, only, {}).id, VENUE_ARRIVALS.axe_bar.regular[0]);
  // 選ぶだけでは何も変えない
  const untouched = newSave(), before = JSON.stringify(untouched);
  pickArrival("axe_bar", untouched, dialogues, { rainy: true });
  assert.equal(JSON.stringify(untouched), before);
  // 昼と夜は別の束・別の印
  const cafe = newSave({ chapter: 2, slot: 0 });
  assert.equal(visit("trpg_day", cafe), "trpg_day_shelf");
  cafe.slot = 1;
  assert.equal(visit("trpg_night", cafe), "trpg_night_lamp");
  assert.equal(pickArrival("trpg_night", cafe, dialogues, {}), null);
  // 台本を読めていない場面は飛ばす。全部読めなければ何も出さない
  const partial = { ...dialogues, club_arrival_stairs: undefined };
  assert.equal(pickArrival("club_seam", newSave(), partial, {}).id, "ch3_club_floor_edge");
  assert.equal(pickArrival("club_seam", newSave(), {}, {}), null);
  assert.equal(pickArrival("no_such_venue", newSave(), dialogues, {}), null);
}

// ---- 条件付き・一度きり・メモ・遊べない来店 ----------------------------------------------------
{
  // 黒板に名前がある回は、一度でも投げ終えた記録がある人だけ（無い人は飛ばして次へ）
  const fresh = newSave();
  fresh.flags[arrivalTurnKey("axe_bar")] = 3;
  assert.equal(visit("axe_bar", fresh), "axe_arrival_board");
  const recorded = newSave();
  recorded.flags[arrivalTurnKey("axe_bar")] = 3;
  recorded.flags._axe_bar_records = { practice: { plays: 1 } };
  assert.equal(visit("axe_bar", recorded), "axe_arrival_chalk");
  // 一度きりの回は巡回より先。読んだら二度と出ない。巡回の本数は進めない
  const rainy = newSave();
  assert.equal(visit("axe_bar", rainy, { rainy: true }), "axe_arrival_rain");
  assert.equal(rainy.flags[arrivalSeenKey("axe_arrival_rain")], true);
  assert.equal(rainy.flags[arrivalTurnKey("axe_bar")], undefined);
  nextSlot(rainy);
  assert.equal(visit("axe_bar", rainy, { rainy: true }), "axe_arrival_whetstone");
  // 自分の道具を買った後の最初の来店
  const geared = newSave({ owned: ["gear_hatchet", "gear_dice", "gear_headphones"] });
  assert.equal(visit("axe_bar", geared), "axe_arrival_own_axe");
  assert.equal(visit("club_seam", geared), "club_arrival_headphones");
  assert.equal(visit("trpg_night", geared), "trpg_arrival_own_dice");
  // ボドゲカフェの一度きりの回は昼と夜で共有する
  geared.slot = 0;
  assert.equal(visit("trpg_day", geared), "trpg_day_shelf");
  const members = newSave({ chapter: 2, trpg: { club: { members: { adam: {} } } } });
  assert.equal(visit("trpg_night", members), "trpg_arrival_first_member");
  // 第2章の間だけの祝い
  assert.equal(visit("axe_bar", newSave({ chapter: 2 })), "axe_arrival_champion");
  assert.equal(visit("axe_bar", newSave({ chapter: 5 })), "axe_arrival_whetstone");
  // 前の来店のメモ: 自己ベストは2本まで、一本も刺さらなかった日は1本。受けたら消える。3回目は巡回へ
  const noted = newSave();
  leaveArrivalNote("axe_bar", "record", noted);
  assert.equal(visit("axe_bar", noted, { rainy: true }), "axe_arrival_after_record", "メモは雨の回より先");
  assert.equal(noted.flags[arrivalNoteKey("axe_bar")], undefined);
  nextSlot(noted); leaveArrivalNote("axe_bar", "record", noted);
  assert.equal(visit("axe_bar", noted), "axe_arrival_after_record_b");
  nextSlot(noted); leaveArrivalNote("axe_bar", "record", noted);
  assert.equal(visit("axe_bar", noted), "axe_arrival_whetstone");
  assert.equal(noted.flags[arrivalNoteKey("axe_bar")], undefined, "受ける回が無くても、古いメモは残さない");
  nextSlot(noted); leaveArrivalNote("axe_bar", "miss", noted);
  assert.equal(visit("axe_bar", noted), "axe_arrival_after_miss");
  leaveArrivalNote("axe_bar", "miss", noted); leaveArrivalNote("axe_bar", null, noted);
  assert.equal(noted.flags[arrivalNoteKey("axe_bar")], undefined);
  // 遊べない来店: 専用の回だけ。巡回・一度きり・メモは使わず、進めない
  const broke = newSave({ owned: ["gear_hatchet"] });
  leaveArrivalNote("axe_bar", "record", broke);
  assert.deepEqual(pickArrival("axe_bar", broke, dialogues, { idle: true, rainy: true }), { id: "axe_arrival_look", kind: "idle" });
  assert.equal(visit("axe_bar", broke, { idle: true }), "axe_arrival_look");
  assert.equal(broke.flags[arrivalTurnKey("axe_bar")], undefined);
  assert.equal(broke.flags[arrivalSeenKey("axe_arrival_own_axe")], undefined);
  assert.equal(pickArrival("axe_bar", broke, dialogues, {}), null, "遊べない来店でも、同じ夜の入り直しでは読まない");
  assert.equal(visit("trpg_night", newSave(), { idle: true }), "trpg_night_idle");
  assert.equal(pickArrival("club_seam", newSave(), dialogues, { idle: true }), null, "専用の回が無い店は何も読まない");
  // 初めての来店を読んだ夜は、来店のやり取りを重ねない
  const firstNight = newSave();
  markArrival("axe_bar", firstNight);
  assert.equal(firstNight.flags[arrivalAtKey("axe_bar")], "1:5:1");
  assert.equal(pickArrival("axe_bar", firstNight, dialogues, {}), null);
}

// ---- 周回の引き継ぎ: 巡回・既読・メモは持ち越さない --------------------------------------------
for (const key of [arrivalAtKey("axe_bar"), arrivalTurnKey("trpg_night"), arrivalSeenKey("club_arrival_rain"), arrivalNoteKey("axe_bar")]) {
  assert.equal(classifyFlag(key), "progression", key);
  assert.equal(flagVerdict(key), "reset", key);
}

// ---- 店の入口への接続（書いた場面を読む経路があること）------------------------------------------
{
  const axe = source("daily/axe-bar.js"), cafe = source("daily/trpg.js"), club = source("daily/dj-club.js"), camel = source("chapters/ch4-camel-race.js");
  assert.match(axe, /playArrival\("axe_bar", \{ read, save: owner, ctx: \{ idle: !available\(\) \} \}\)/);
  assert.match(axe, /playVenueTurn\("axe_bar_finish"/);
  assert.match(axe, /leaveArrivalNote\("axe_bar", outcome === "finish" \? null : outcome, owner\)/);
  assert.match(cafe, /playArrival\(venue, \{ read, save: owner, ctx: \{ idle \} \}\)/);
  assert.match(cafe, /tablePlayableTonight\(owner, library\.catalog, library\.scenarios, \{ nightBusy: nightBusy\(\) \}\)/);
  assert.match(club, /playArrival\("club_seam", \{ read, save: owner \}\)/);
  assert.match(camel, /playArrival\("camel_track", \{ read, save: value \}\)/);
}

console.log("venue_arrivals: PASS（台本の照合・巡回・条件付き・一度きり・メモ・遊べない来店・周回の扱い・入口への接続）");
