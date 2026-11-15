// 第4章ドバイの水着回（SPC18・Issue #3657）: 顔ぶれ・出せる時・確定（remake/js/chapters/ch4-beach.js）と台本。
// 顔ぶれは「その場に実際にいる人」だけ（同行者・到着を読んだ別便の人・会ったことのあるヌール）。好感度や渡航予定だけでは足さない。
// node remake/test/ch4_beach.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { CH4_PROLOGUE, CH4_PREP_SCENES, CH4_DAILY_TOURNAMENT_DAY, advanceToChapterFour, chapterFourArrivalsDue, completeChapterFourScene,
  departChapterFour, enterChapterFourEve, syncChapterFourDay } from "../js/chapters/ch4-progress.js";
import { OVERSEAS_HEROINES, chooseOverseasCompanion } from "../js/core/overseas-companion.js";
import { CH4_BEACH_SCENES, CH4_BEACH_SCENE_FILES, CH4_BEACH_PICKS, CH4_BEACH_RESIDENTS, chapterFourBeachCast,
  chapterFourBeachDue, chapterFourBeachPickCount, chapterFourBeachRecord, commitChapterFourBeach } from "../js/chapters/ch4-beach.js";
import { classifyFlag } from "../js/core/carry.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"));

// 前夜（前夜祭の日）まで進めた保存。lovers・同行者・友人の締めくくり・ヌールに会ったかを選べる。
function eveSave({ lovers = [], companion = null, finales = {}, flags = {}, met = {}, eve = true } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45, slot: 1, lovers: [...lovers], finales: { ...finales } });
  value.flags = { _ch3_cleared: true, _ch3_aftermath: { version: 2, winDay: 42, stage: 6 }, _ch3_tournament_won: true, ...flags };
  value.met = { ...value.met, ...met };
  assert(advanceToChapterFour(value));
  assert(chooseOverseasCompanion(value, companion));
  for (const id of CH4_PREP_SCENES) assert(completeChapterFourScene(value, id));
  value.day += 3;
  assert(departChapterFour(value));
  for (const scene of CH4_PROLOGUE.slice(CH4_PREP_SCENES.length)) assert(completeChapterFourScene(value, scene.id));
  value.day = value.flags._ch4.startDay + 11; syncChapterFourDay(value);
  if (eve) { value.day = value.flags._ch4.startDay + 12; assert(enterChapterFourEve(value)); }
  return value;
}
const arriveAll = value => { for (const { scene } of chapterFourArrivalsDue(value)) assert(completeChapterFourScene(value, scene), scene); return value; };
const keep = value => structuredClone({ lovers: value.lovers, affinity: value.affinity, money: value.money, stats: value.stats,
  day: value.day, slot: value.slot, evening: value.flags._ch4_evening, ch4: value.flags._ch4, companion: value.flags._overseas_companion });

// ---- 台本: 全員分の場面があり、読み込み一覧と一致する
{
  const rows = readData("dialogue/ch4_beach").dialogues;
  assert.deepEqual(Object.keys(CH4_BEACH_SCENES.people), [...OVERSEAS_HEROINES, ...CH4_BEACH_RESIDENTS]);
  assert.deepEqual([...CH4_BEACH_SCENE_FILES.ch4_beach].sort(), rows.map(row => row.dialogue_id).sort(), "ch4_beach: all scenes registered");
  for (const id of CH4_BEACH_SCENE_FILES.ch4_beach) {
    const row = rows.find(item => item.dialogue_id === id);
    assert(row?.lines?.length, id);
    // 報酬・恋人の分岐を持たない（恋人でも友人でも同じ台本）。サメちゃんの泳げない秘密だけ、既読の記録で分ける。
    const lines = [...row.lines, ...Object.values(row.branches || {}).flat()];
    assert(lines.every(line => line.type !== "apply" && line.condition_type !== "lover" && line.condition_type !== "romance_open"), `${id}: no reward or lover branch`);
    assert(!lines.some(line => /上がった。?$|下がった。?$/.test(line.text || "")), `${id}: no reward cue`);
  }
  const samechan = rows.find(row => row.dialogue_id === CH4_BEACH_SCENES.people.samechan);
  const condition = samechan.lines.find(line => line.type === "condition");
  assert.deepEqual([condition.condition_type, condition.flag], ["flag", "_samechan_swimming_known"]);
  assert(!samechan.branches.swim_unknown.some(line => /泳げ/.test(line.text || "")), "The swimming secret stays hidden until it is known");
  // 導入と締めは人数に触れない（一人でも全員でも成り立つ）。
  for (const id of [CH4_BEACH_SCENES.open, CH4_BEACH_SCENES.close]) {
    const text = rows.find(row => row.dialogue_id === id).lines.map(line => line.text).join("");
    assert(!/みんな|全員|二人|三人|ふたり/.test(text), `${id} does not count the people`);
  }
  assert.equal(classifyFlag("_ch4_beach"), "progression");
}

// ---- 顔ぶれ: 恋人ゼロ・同行なし → いつも来るつむぎ・ましろ（友人版）。到着を読むまでは砂浜にいない。
{
  const value = eveSave();
  assert.deepEqual(chapterFourBeachCast(value), [], "No one has arrived yet");
  assert.equal(chapterFourBeachDue(value), false, "The beach waits for the arrivals");
  arriveAll(value);
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "mashiro"]);
  assert.equal(chapterFourBeachDue(value), true);
  assert.equal(chapterFourBeachPickCount(value), 2, "Fewer people than picks: play with everyone");
}
// ---- 顔ぶれ: 同行者は最初からいる。別便の恋人・♥5の友人は到着を読んだら。会ったことのあるヌールも来る。
{
  const value = eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio",
    finales: { hiyori: { day: 21, chapter: 2, route: "friend" } }, met: { noor: true } });
  assert.deepEqual(chapterFourBeachCast(value), ["rio", "noor"], "The companion and Noor are already in Dubai");
  assert.equal(chapterFourBeachDue(value), false, "Arrivals first");
  arriveAll(value);
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "minto", "rio", "mashiro", "samechan", "hiyori", "noor"]);
  assert.equal(chapterFourBeachPickCount(value), CH4_BEACH_PICKS);
  // 好感度の数値・告白待ちの恋愛ルートだけでは来ない（出発前の顔ぶれで決まる）。
  assert(!chapterFourBeachCast(value).includes("ageha"));
}
// ---- 会ったことのないヌールは来ない。
{
  const value = arriveAll(eveSave({ lovers: ["ageha"] }));
  assert.deepEqual(chapterFourBeachCast(value), ["tsumugi", "ageha", "mashiro"]);
}

// ---- 確定: ちょうど遊べる回数・顔ぶれから重ならずに。好感度・お金・日付・前夜の記録は変えない。一度だけ。
{
  const value = arriveAll(eveSave({ lovers: ["minto", "rio", "samechan"], companion: "rio", met: { noor: true } }));
  const before = keep(value);
  for (const wrong of [[], ["rio", "noor"], ["rio", "rio", "noor"], ["rio", "noor", "ageha"], ["rio", "noor", "minto", "tsumugi"], "rio"]) {
    assert.equal(commitChapterFourBeach(value, wrong), false, JSON.stringify(wrong));
    assert.equal(chapterFourBeachRecord(value), null);
  }
  assert.equal(commitChapterFourBeach(value, ["noor", "rio", "minto"]), true);
  assert.deepEqual(chapterFourBeachRecord(value), { picks: ["noor", "rio", "minto"] });
  assert.deepEqual(keep(value), before, "The beach changes nothing else");
  assert.equal(chapterFourBeachDue(value), false, "Once");
  assert.equal(commitChapterFourBeach(value, ["tsumugi", "mashiro", "samechan"]), false);
  assert.deepEqual(chapterFourBeachRecord(JSON.parse(JSON.stringify(value))), { picks: ["noor", "rio", "minto"] }, "Survives SAVE/LOAD");
}
// ---- 出せない時: 前夜祭が始まった後・前夜の過ごし方を記録した後・大会の後・同行の選択が無い旧保存。
{
  const festival = arriveAll(eveSave());
  for (const id of ["ch4_festa", "ch4_stranger_first", "ch4_stranger_second"]) festival.flags._ch4.read[id] = true;
  assert(completeChapterFourScene(festival, "ch4_wang_reception_forced_in"));
  assert.equal(chapterFourBeachDue(festival), false, "No beach after the festival started");
  assert.equal(commitChapterFourBeach(festival, ["tsumugi", "mashiro"]), false);
  const settled = arriveAll(eveSave());
  settled.flags._ch4_evening = { kind: "rest", participants: [] };
  assert.equal(chapterFourBeachDue(settled), false);
  const after = arriveAll(eveSave());
  Object.assign(after.flags._ch4, { part: "tournament", day: CH4_DAILY_TOURNAMENT_DAY });
  assert.equal(chapterFourBeachDue(after), false);
  const free = eveSave({ eve: false });
  assert.equal(free.flags._ch4.part, "free");
  assert.equal(chapterFourBeachDue(free), false, "Not during the Dubai daily days");
}
console.log("PASS ch4 beach: cast is who is actually there, picks once without rewards, before the festival only");
