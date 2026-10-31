// 東京の自由時間に地図から選ぶ行き先（#1655）: 出る時期・予約との関係・一度性・台本・地図への投影。
import assert from "node:assert/strict";
import fs from "node:fs";
import { newState } from "../js/core/state.js";
import { advanceToChapterThree, chapterThreeScenes, completeChapterThreeScene,
  chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { TOKYO_OUTINGS, OUTING_DIALOGUE_IDS, OUTINGS_FLAG, chapterThreeOutings, chapterThreeOutingCandidates,
  claimChapterThreeOuting, outingDialogueId, tasteRecovered } from "../js/chapters/ch3-outing-progress.js";
import { chapterThreeMapModel } from "../js/chapters/ch3-map-model.js";
import { classifyFlag } from "../js/core/carry.js";
import { AFFINITY_RANK_PTS } from "../js/core/stats.js";
import { availableOptionalScenes, commitOptionalRead } from "../js/chapters/ch3-story-wiring.js";

function departure({ member = false, legacy = false } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 2, day: 28, phase: "cleared", money: 1000, stamina: 80 });
  value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" },
    ...(member ? { _gym_member: true } : {}) };
  assert(advanceToChapterThree(value));
  if (legacy) delete value.flags._ch3_intro.routeVersion;
  return value;
}
const ids = (value, window) => chapterThreeOutings(value, window.id).map(item => item.id);

// 新ルートは会員でなくても6回の自由時間に行き先がある。行き先は物語の時点で変わる。
{
  const value = departure();
  const seen = {};
  for (const scene of chapterThreeScenes(value)) {
    for (let window; (window = chapterThreeFreeTime(value));) {
      const before = structuredClone(value);
      seen[window.id] = ids(value, window);
      assert.deepEqual(value, before, "Reading outings mutated the save");
      assert(completeChapterThreeFreeTime(value, window.id));
    }
    assert(completeChapterThreeScene(value, scene.id));
  }
  assert.deepEqual(Object.keys(seen), ["d5-noon", "d6-night", "d8-night", "d9-night", "d10-noon", "d12-noon"]);
  for (const list of Object.values(seen)) assert(list.includes("mukai_help") && list.includes("park_walk") && list.includes("tetsuko"));
  // 久世は初対面の後、助言の前後で別の理由。スティーブは店を訪ねた後だけ。
  assert(!seen["d6-night"].includes("enmaku_notes"), "Kuze's shop before meeting him");
  assert(seen["d8-night"].includes("enmaku_notes"));
  assert(!seen["d8-night"].includes("steve_timer"));
  assert(!seen["d12-noon"].includes("enmaku_notes"));
  assert(seen["d12-noon"].includes("enmaku_answer") && seen["d12-noon"].includes("steve_timer"));
  assert.equal(value.phase, "tournament");
  assert.deepEqual(chapterThreeOutingCandidates(value).filter(item => item.id === "enmaku_notes"), []);
}

// スティーブの来店（#1696）: 配達で面識があり、彼の店を訪ねる前だけ。一度きり。
{
  const early = at("d8-night");
  assert(!ids(early.value, early.window).includes("mukai_steve"), "Steve visits before meeting him");
  early.value.met.steve = true;
  assert(ids(early.value, early.window).includes("mukai_steve"));
  const outing = claimChapterThreeOuting(early.value, early.window.id, "mukai_steve");
  assert.equal(outing.money, 3000);
  assert.equal(outingDialogueId(early.value, outing, early.window), "ch3_outing_mukai_steve");
  const next = nextWindow(early.value);
  assert(!ids(early.value, next).includes("mukai_steve"), "Steve's visit repeated");
  const late = at("d12-noon");
  late.value.met.steve = true;
  assert(!ids(late.value, late.window).includes("mukai_steve"), "Steve's first visit after his shop scene");
}

// 旧ルートの非会員は従来どおり空き時間を増やさない。
{
  const value = departure({ legacy: true });
  for (const scene of chapterThreeScenes(value)) {
    assert.equal(chapterThreeFreeTime(value), null);
    assert(completeChapterThreeScene(value, scene.id));
  }
}

function at(windowId, options) {
  const value = departure(options);
  for (let guard = 0; guard < 60; guard++) {
    const window = chapterThreeFreeTime(value);
    if (window?.id === windowId) return { value, window };
    if (window) { assert(completeChapterThreeFreeTime(value, window.id)); continue; }
    const scene = chapterThreeScenes(value)[value.flags._ch3_intro.stage];
    if (!scene) break;
    assert(completeChapterThreeScene(value, scene.id));
  }
  throw new Error(`no ${windowId}`);
}

function nextWindow(value) {
  for (let window; !(window = chapterThreeFreeTime(value));) {
    const scene = chapterThreeScenes(value)[value.flags._ch3_intro.stage];
    if (!scene) return null;
    assert(completeChapterThreeScene(value, scene.id));
  }
  return chapterThreeFreeTime(value);
}

// 確定: 一枠だけ閉じ、回数を残す。再訪型は一度きり、手伝いと散歩は繰り返せる。stageは進めない。
{
  const { value, window } = at("d8-night");
  const stage = value.flags._ch3_intro.stage;
  assert.equal(claimChapterThreeOuting(value, window.id, "steve_timer"), null, "A locked destination was claimed");
  const outing = claimChapterThreeOuting(value, window.id, "enmaku_notes");
  assert.equal(outing.id, "enmaku_notes");
  assert.equal(value.flags._ch3_intro.stage, stage);
  assert(value.tokyoVisits.closedSlots.includes(window.id));
  assert.deepEqual(value.flags[OUTINGS_FLAG], { enmaku_notes: 1 });
  const once = structuredClone(value);
  assert.equal(claimChapterThreeOuting(value, window.id, "enmaku_notes"), null, "An old button claimed twice");
  assert.deepEqual(value, once);
  const next = nextWindow(value);
  assert.equal(next.id, "d9-night");
  assert(!ids(value, next).includes("enmaku_notes"), "A one-time visit repeated");
  assert(claimChapterThreeOuting(value, next.id, "mukai_help"));
  const later = nextWindow(value);
  assert(claimChapterThreeOuting(value, later.id, "mukai_help"));
  assert.equal(value.flags[OUTINGS_FLAG].mukai_help, 2);
}

// 疲れ切っている時は体力を使う行き先を選べない。公園は休めるので選べる。
{
  const { value, window } = at("d5-noon");
  value.stamina = 0;
  const list = chapterThreeOutings(value, window.id);
  assert.equal(list.find(item => item.id === "mukai_help").ok, false);
  assert.match(list.find(item => item.id === "mukai_help").why, /体力/);
  assert.equal(list.find(item => item.id === "park_walk").ok, true);
  assert.equal(list.find(item => item.id === "tetsuko").ok, true, "The cat rests you, so tiredness must not lock her");
  assert.equal(claimChapterThreeOuting(value, window.id, "mukai_help"), null);
}

// てつこ（#1993）: mukaiの裏口で毎回選べる。体力だけ少し戻し、能力・お金は付かない。背景は裏口（街の道）。
{
  const { value, window } = at("d5-noon");
  const cat = TOKYO_OUTINGS.find(item => item.id === "tetsuko");
  assert.equal(cat.place, "mukai");
  assert(cat.repeat && cat.stamina > 0 && cat.stamina < 20, "A small rest, less than the park walk");
  assert(!cat.stat && !cat.money);
  assert.equal(cat.bg, "bg_street");
  assert.equal(outingDialogueId(value, cat, window), "ch3_outing_tetsuko");
  assert(claimChapterThreeOuting(value, window.id, "tetsuko"));
  const next = nextWindow(value);
  assert(ids(value, next).includes("tetsuko"), "The cat should be there every free time");
  assert(claimChapterThreeOuting(value, next.id, "tetsuko"));
  assert.equal(value.flags[OUTINGS_FLAG].tetsuko, 2);
}

// 恋人の訪問など予約済みの枠には行き先を出さない。
{
  const { value, window } = at("d5-noon");
  value.pendingInvite = { day: window.day, slot: window.slot, event: "existing" };
  assert.deepEqual(chapterThreeOutings(value, window.id), []);
}

// 台本: 味が戻る前後・昼夜で読み分け、必要な場面がそろう。報酬・面識の制御行を置かない。
{
  const { value, window } = at("d5-noon");
  const mukai = TOKYO_OUTINGS.find(item => item.id === "mukai_help"), park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  assert(!tasteRecovered(value));
  assert.equal(outingDialogueId(value, mukai, window), "ch3_outing_mukai_help_lost");
  assert.equal(outingDialogueId(value, park, window), "ch3_outing_park_walk_day");
  const late = at("d12-noon");
  assert(tasteRecovered(late.value));
  assert.equal(outingDialogueId(late.value, mukai, late.window), "ch3_outing_mukai_help");
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_outings.json", import.meta.url)));
  const byId = Object.fromEntries(data.dialogues.map(dialogue => [dialogue.dialogue_id, dialogue]));
  assert.deepEqual(Object.keys(byId).sort(), [...OUTING_DIALOGUE_IDS].sort());
  for (const dialogue of data.dialogues) {
    const lines = [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
    assert(lines.every(line => line.type === "condition" || line.type === "choice" || !line.type),
      `${dialogue.dialogue_id}: no reward/meeting control lines`);
    assert(!lines.some(line => line.type === "set_flag" || line.type === "apply"));
  }
  assert.deepEqual(Object.keys(byId.ch3_outing_enmaku_answer.branches).sort(), ["tried", "untried"]);
  // スティーブの味の会話（#2028）。熟練度は台本の metadata、好感度は任意の外出の確定時だけ。
  assert.deepEqual(byId.ch3_outing_steve_timer.metadata.flavor_lesson, { mountain_mist: 1 });
  assert.deepEqual(TOKYO_OUTINGS.find(item => item.id === "steve_timer").affinity, { steve: 10 });
  assert(TOKYO_OUTINGS.filter(item => item.affinity).every(item => !item.repeat), "Affinity outings are read once");
  // 久世（#2028）: 好感度は煙幕への再訪（任意の外出）だけ。台本には報酬行を置かない。
  for (const id of ["enmaku_notes", "enmaku_answer"]) {
    assert.deepEqual(TOKYO_OUTINGS.find(item => item.id === id).affinity, { kuze: 10 });
    assert(!JSON.stringify(byId[`ch3_outing_${id}`]).includes("affinity"));
  }
  // てつこの世話は撫でる／餌の2択。どちらの枝も次の行へ戻り、報酬行を持たない。
  const care = byId.ch3_outing_tetsuko.lines.find(line => line.type === "choice");
  assert.deepEqual(care.choices.map(choice => choice.next).sort(), ["feed", "pet"]);
  assert.deepEqual(Object.keys(byId.ch3_outing_tetsuko.branches).sort(), ["feed", "pet"]);
  assert(!JSON.stringify(byId.ch3_outing_tetsuko).includes("テツコ"), "The cat is てつこ, not テツコ");
}

// 地図: 行き先の場所に理由と行動を載せ、公園は行き先がある時だけ地点になる。
{
  const { value, window } = at("d8-night");
  const actions = chapterThreeOutings(value, window.id);
  const model = chapterThreeMapModel(value, chapterThreeScenes(value), { freeTime: true, actions });
  const pin = id => model.pins.find(item => item.id === id);
  assert.deepEqual(pin("enmaku").actions.map(item => item.id), ["enmaku_notes"]);
  assert.deepEqual(pin("park").actions.map(item => item.id), ["park_walk"]);
  assert(pin("mukai").actions.some(item => item.id === "tetsuko"), "The cat is reached from the mukai pin");
  assert(!model.landmarks.some(item => item.id === "park"), "The park is both a landmark and a pin");
  assert.match(model.note, /行き先/);
  const plain = chapterThreeMapModel(value, chapterThreeScenes(value), { freeTime: true });
  assert(!plain.pins.some(item => item.id === "park"));
}

// 久世のLIME交換と締めくくり（#2028）: 助言の後、煙幕への再訪で♥1になった時だけ場面カードに出る。
// 好感度は任意の場面だけで付き、必須場面（本編・後日談の片づけ）では付かない。
{
  const routes = JSON.parse(fs.readFileSync(new URL("../../data/story_routes.json", import.meta.url)));
  const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))).dialogues;
  const scene = id => [...read("ch3_rivals"), ...read("ch3_main")].find(dialogue => dialogue.dialogue_id === id);
  const offered = value => availableOptionalScenes(routes, value).map(item => item.id);
  const early = at("d8-night");
  early.value.affinity.kuze = AFFINITY_RANK_PTS[5];
  assert(!offered(early.value).includes("ch3_kuze_lime"), "Kuze's LIME before his advice");
  const { value } = at("d12-noon");
  assert(!offered(value).includes("ch3_kuze_lime"), "Kuze's LIME without affinity");
  value.affinity.kuze = AFFINITY_RANK_PTS[1] - 1;
  assert(!offered(value).includes("ch3_kuze_lime"), "Kuze's LIME below ♥1");
  value.affinity.kuze = AFFINITY_RANK_PTS[1];
  assert(offered(value).includes("ch3_kuze_lime"));
  commitOptionalRead(value, "ch3_kuze_lime");
  assert(!offered(value).includes("ch3_kuze_lime"), "Kuze's LIME read twice");
  const lime = scene("ch3_kuze_lime").lines;
  assert(lime.some(line => line.type === "set_flag" && line.flag === "_lime_contact_kuze"));
  assert.deepEqual(lime.filter(line => line.type === "apply").map(line => line.affinity), [{ kuze: 2 }]);
  assert.equal(classifyFlag("_lime_contact_kuze"), "person");
  for (const id of ["ch3_kuze_first", "ch3_kuze_mukai_visit", "ch3_kuze_advice", "ch3_enmaku_cleanup"]) {
    const dialogue = scene(id);
    const lines = [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
    assert(!dialogue.metadata?.add_affinity && !lines.some(line => line.affinity?.kuze), `${id}: mandatory scenes give no affinity`);
  }
  const cleanup = scene("ch3_enmaku_cleanup");
  const gate = cleanup.lines.find(line => line.type === "condition" && line.flag === "_lime_contact_kuze");
  assert(gate && !gate.next_false && cleanup.branches[gate.next_true].some(line => line.speaker === "kuze"));
  // CI の quick は立ち絵を取得しないため、画像がある環境だけ表情を照合する（表情の登録は lint_dialogue でも検査）。
  const spriteDir = new URL("../img/sprites/characters/kuze/", import.meta.url);
  if (fs.existsSync(spriteDir)) {
    const faces = new Set(fs.readdirSync(spriteDir).map(name => name.replace(/^chr_kuze_|\.webp$/g, "")));
    for (const line of [...lime, ...cleanup.branches[gate.next_true]]) if (line.speaker === "kuze") assert(faces.has(line.face), line.face);
  }
}

assert.equal(classifyFlag(OUTINGS_FLAG), "progression");
console.log("ch3 outings: ok");
