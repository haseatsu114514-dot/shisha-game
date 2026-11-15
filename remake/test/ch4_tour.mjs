// 第4章の初日の街回り（4-1・SPC28）: 出す時・相手の選び方・台本（remake/js/chapters/ch4-tour.js・data/dialogue/ch4_tour.json）。
// DAY1の昼（版2の日常）に一度だけ。同行の恋人がいれば恋人となるのどちらかを選ぶ（恋人が先）。いなければなると回る。報酬なし。
// node remake/test/ch4_tour.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState } from "../js/core/state.js";
import { CH4_PROLOGUE, CH4_PREP_SCENES, advanceToChapterFour, completeChapterFourScene, departChapterFour, syncChapterFourDay } from "../js/chapters/ch4-progress.js";
import { OVERSEAS_HEROINES, chooseOverseasCompanion } from "../js/core/overseas-companion.js";
import { CH4_TOUR_BG, CH4_TOUR_FLAG, CH4_TOUR_IDS, CH4_TOUR_PARTNERS, CH4_TOUR_PICK, CH4_TOUR_SCENES, chapterFourTourCompanion,
  chapterFourTourDue, chapterFourTourPartner, chapterFourTourScript } from "../js/chapters/ch4-tour.js";
import { classifyFlag } from "../js/core/carry.js";

const readData = name => JSON.parse(readFileSync(new URL(`../../data/${name}.json`, import.meta.url), "utf8"));
const rows = readData("dialogue/ch4_tour").dialogues;
const dialogues = Object.fromEntries(rows.map(row => [row.dialogue_id, row]));
const characters = readData("characters");

// ドバイDAY1の昼（到着の宿まで読んだ直後）の保存。
function dayOneSave({ lovers = [], companion = null } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 3, phase: "cleared", day: 45, slot: 1, lovers: [...lovers] });
  value.flags = { _ch3_cleared: true, _ch3_aftermath: { version: 2, winDay: 42, stage: 6 }, _ch3_tournament_won: true };
  assert(advanceToChapterFour(value));
  assert(chooseOverseasCompanion(value, companion));
  for (const id of CH4_PREP_SCENES) assert(completeChapterFourScene(value, id));
  value.day += 3;
  assert(departChapterFour(value));
  for (const scene of CH4_PROLOGUE.slice(CH4_PREP_SCENES.length)) assert(completeChapterFourScene(value, scene.id));
  return value;
}
const keep = value => structuredClone({ lovers: value.lovers, affinity: value.affinity, money: value.money, stats: value.stats,
  day: value.day, slot: value.slot, ch4: value.flags._ch4, companion: value.flags._overseas_companion, tour: value.flags[CH4_TOUR_FLAG] });

// ---- 台本: 読み込み一覧と一致し、相手ごとの場面がそろっている
{
  assert.deepEqual([...CH4_TOUR_IDS].sort(), Object.keys(dialogues).sort(), "ch4_tour: all scenes registered");
  assert.deepEqual([...CH4_TOUR_PARTNERS], ["naru", ...OVERSEAS_HEROINES]);
  for (const id of CH4_TOUR_IDS) assert(dialogues[id].lines.length > 0, id);
  // 本文での呼び方（地の文・台詞）。どれも characters.json の名前の一部
  const names = { tsumugi: "つむぎ", minto: "栞", rio: "凛想", ageha: "あげは", mashiro: "ましろ", samechan: "サメちゃん", hiyori: "ひより" };
  for (const [id, name] of Object.entries(names)) {
    const c = characters.find(row => row.id === id);
    assert(JSON.stringify(c).includes(name.replace("サメちゃん", "サメ")), `${id}: ${name}`);
  }
  const otherNames = id => OVERSEAS_HEROINES.filter(other => other !== id).map(other => names[other]).filter(Boolean);
  for (const id of CH4_TOUR_PARTNERS) {
    const lines = dialogues[CH4_TOUR_SCENES.with[id]].lines;
    // 金のスーク → クリーク → 夕方のモスク（背景は行の bg で切り替える）
    assert.deepEqual(lines.filter(line => line.type === "bg").map(line => line.bg), ["bg_dubai_souq_day", "bg_dubai_map", "bg_dubai_map_dusk"], id);
    const speakers = new Set(lines.filter(line => !line.type).map(line => line.speaker));
    assert.deepEqual([...speakers].filter(speaker => !["", "hajime", id].includes(speaker)), [], `${id}: only the partner and Hajime speak`);
    const text = lines.map(line => line.text || "").join("");
    for (const other of otherNames(id)) assert(!text.includes(other), `${id}: no other heroine (${other}) on the walk`);
    // 先取りしない: 旅装の男・渡し舟の乗り方（背中合わせ・人が満ちたら出る）・龍龍水煙所
    assert(!/旅装|背中合わせ|満ちたら|龍龍|王煙楼/.test(text), `${id}: does not spoil later first visits`);
  }
  for (const id of OVERSEAS_HEROINES) {
    for (const scene of [CH4_TOUR_SCENES.ask[id], CH4_TOUR_SCENES.stay[id]]) {
      const speakers = new Set(dialogues[scene].lines.map(line => line.speaker));
      assert.deepEqual([...speakers].filter(speaker => !["", "hajime", id].includes(speaker)), [], scene);
    }
  }
  // なるが戻ってくる理由（通行証は今夜の説明会で配る）。到着の宿の「夜まで別行動」とつなぐ
  assert.match(dialogues[CH4_TOUR_SCENES.open].lines.map(line => line.text).join(""), /通行証は、今夜の説明会/);
}

// ---- 出す時: 版2のDAY1の昼・自由行動・まだ回っていない時だけ
{
  const value = dayOneSave();
  assert.equal(value.flags._ch4.part, "free");
  assert.equal(value.flags._ch4.day, 1);
  assert.equal(value.slot, 0);
  assert(chapterFourTourDue(value), "DAY1 noon");
  assert(!chapterFourTourDue({ ...value, slot: 1 }), "not in the evening");
  const later = structuredClone(value);
  later.day += 1; syncChapterFourDay(later);
  assert.equal(later.flags._ch4.day, 2);
  assert(!chapterFourTourDue(later), "not on DAY2");
  const done = structuredClone(value);
  done.flags[CH4_TOUR_FLAG] = { with: "naru" };
  assert(!chapterFourTourDue(done), "only once");
  const legacy = structuredClone(value);
  delete legacy.flags._ch4.routeVersion;
  assert(!chapterFourTourDue(legacy), "not on the old 5-day map");
  const prologue = dayOneSave();
  prologue.flags._ch4.part = "prologue"; prologue.flags._ch4.stage = CH4_PROLOGUE.length - 1;
  assert(!chapterFourTourDue(prologue), "not before the inn");
  assert(!chapterFourTourDue({ chapter: 3, slot: 0, flags: {} }));
  assert(!chapterFourTourDue(null));
}

// ---- 同行の恋人がいない: 選択肢は出さず、なると回る（別便の恋人はまだ着いていない）
{
  const value = dayOneSave({ lovers: ["tsumugi", "minto"] }), before = keep(value);
  assert.equal(chapterFourTourCompanion(value), null);
  const { script, picks } = chapterFourTourScript(value, dialogues);
  assert.equal(script.lines.some(line => line.type === "choice"), false);
  assert.deepEqual(picks, {});
  const lines = id => dialogues[id].lines;
  assert.deepEqual(script.lines, [...lines(CH4_TOUR_SCENES.open), ...lines(CH4_TOUR_SCENES.alone), ...lines(CH4_TOUR_SCENES.with.naru)]);
  assert.equal(chapterFourTourPartner(value, []), "naru");
  assert.deepEqual(keep(value), before, "building the script changes nothing");
}

// ---- 同行の恋人がいる: 恋人が先の二択。選んだ相手の続きは next_id で飛ぶ先、visited で相手を知る
for (const companion of OVERSEAS_HEROINES) {
  const value = dayOneSave({ lovers: [companion], companion }), before = keep(value);
  assert.equal(chapterFourTourCompanion(value), companion);
  const { script, picks } = chapterFourTourScript(value, dialogues, { companionLabel: "あの人" });
  const choice = script.lines.at(-1);
  assert.equal(choice.type, "choice");
  assert.deepEqual(choice.choices.map(c => [c.text, c.next_id]), [["あの人と回る", CH4_TOUR_PICK.companion], ["なると回る", CH4_TOUR_PICK.naru]]);
  const lines = id => dialogues[id].lines;
  assert.deepEqual(script.lines.slice(0, -1), [...lines(CH4_TOUR_SCENES.open), ...lines(CH4_TOUR_SCENES.ask[companion]), ...lines(CH4_TOUR_SCENES.choose)]);
  assert.deepEqual(picks[CH4_TOUR_PICK.companion].lines, [...lines(CH4_TOUR_SCENES.naruLeaves), ...lines(CH4_TOUR_SCENES.with[companion])]);
  assert.deepEqual(picks[CH4_TOUR_PICK.naru].lines, [...lines(CH4_TOUR_SCENES.stay[companion]), ...lines(CH4_TOUR_SCENES.with.naru)]);
  assert.equal(chapterFourTourPartner(value, ["ch4_tour", CH4_TOUR_PICK.companion]), companion);
  assert.equal(chapterFourTourPartner(value, ["ch4_tour", CH4_TOUR_PICK.naru]), "naru");
  assert.equal(chapterFourTourPartner(value, ["ch4_tour"]), null, "ended before choosing");
  assert.deepEqual(keep(value), before);
}

// ---- 宿の背景から始まる・旗は周回で持ち越さない
assert.equal(CH4_TOUR_BG, "bg_dubai_inn_day");
assert.equal(classifyFlag(CH4_TOUR_FLAG), "progression");
console.log("ch4_tour OK");
