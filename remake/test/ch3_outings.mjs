// 東京の自由時間に地図から選ぶ行き先（#1655）: 出る時期・予約との関係・一度性・台本・地図への投影。
import assert from "node:assert/strict";
import fs from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot } from "../js/core/state.js";
import { advanceToChapterThree, departChapterThree, chapterThreeScenes, completeChapterThreeScene,
  chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { TOKYO_OUTINGS, OUTING_DIALOGUE_IDS, OUTINGS_FLAG, chapterThreeOutings, chapterThreeOutingCandidates,
  claimChapterThreeOuting, outingDialogueId, outingAffinity, tasteRecovered, recordChapterThreeOuting,
  rainyOuting, roomRestId, recordRoomRest, ROOM_REST_IDS, HOME_CALLS, HOME_CALL_IDS, HOME_CALL_FLAG, homeCallId,
  recordHomeCall } from "../js/chapters/ch3-outing-progress.js";
import { rainyFor } from "../js/daily/weather.js";
import { chapterThreeMapModel } from "../js/chapters/ch3-map-model.js";
import { classifyFlag } from "../js/core/carry.js";
import { AFFINITY_RANK_PTS } from "../js/core/stats.js";
import { availableOptionalScenes, commitOptionalRead } from "../js/chapters/ch3-story-wiring.js";

function departure({ member = false, legacy = false } = {}) {
  const value = newState();
  Object.assign(value, { chapter: 2, day: 25, /* 準備3日の後の東京DAY1が従来どおり通算29日 */ phase: "cleared", money: 1000, stamina: 80 });
  value.flags = { _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true, _ch2_tournament: { stage: "complete" },
    ...(member ? { _gym_member: true } : {}) };
  assert(advanceToChapterThree(value));
  value.day += 3; // 出発前の準備3日（VOL02）を過ごした出発の朝
  assert(departChapterThree(value));
  value.flags._ch3_intro.routeVersion = 2; // 場面カードの東京（作業中の旧セーブの行程）を確かめる
  if (legacy) delete value.flags._ch3_intro.routeVersion;
  // 雨の日の読み分け（PR-G）は天気の種で決まる。種の無いセーブは晴れ扱いなので、雨は下のテストで種を決めて確かめる。
  value.weatherSeed = null;
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
  // 綾取は初対面の後、助言の前後で別の理由。スティーブは店を訪ねた後だけ。
  assert(!seen["d6-night"].includes("enmaku_notes"), "Ayatori's shop before meeting him");
  assert(seen["d8-night"].includes("enmaku_notes"));
  assert(!seen["d8-night"].includes("steve_timer"));
  assert(!seen["d12-noon"].includes("enmaku_notes"));
  assert(seen["d12-noon"].includes("enmaku_answer") && seen["d12-noon"].includes("steve_timer"));
  assert.equal(value.phase, "tournament");
  assert.deepEqual(chapterThreeOutingCandidates(value).filter(item => item.id === "enmaku_notes"), []);
}

// スティーブの来店（#1696・AFB02）: 配達で面識があり、彼の店を訪ねる前まで何度でも。2回目からは合図の回と客の顔の回を交互。
{
  const early = at("d8-night");
  assert(!ids(early.value, early.window).includes("mukai_steve"), "Steve visits before meeting him");
  early.value.met.steve = true;
  assert(ids(early.value, early.window).includes("mukai_steve"));
  const first = chapterThreeOutings(early.value, early.window.id).find(item => item.id === "mukai_steve");
  assert.equal(outingDialogueId(early.value, first, early.window), "ch3_outing_mukai_steve");
  assert.equal(first.reasonText, "配達先のスティーブが、今日は客として来るらしい");
  assert.deepEqual(outingAffinity(early.value, first), { steve: 16 }, "The first visit gains like a stage talk");
  const outing = claimChapterThreeOuting(early.value, early.window.id, "mukai_steve");
  assert.equal(outing.money, 3000);
  const next = nextWindow(early.value);
  const again = chapterThreeOutings(early.value, next.id).find(item => item.id === "mukai_steve");
  assert(again, "Steve comes again as a customer");
  assert.equal(again.reasonText, "スティーブが、また客として来るらしい");
  assert.deepEqual(outingAffinity(early.value, again), { steve: 8 }, "Later visits gain like a small talk");
  const talkAfter = n => outingDialogueId({ ...early.value, flags: { ...early.value.flags, [OUTINGS_FLAG]: { mukai_steve: n } } }, again, next);
  assert.deepEqual([1, 2, 3, 4].map(talkAfter),
    ["ch3_outing_mukai_steve_b", "ch3_outing_mukai_steve_c", "ch3_outing_mukai_steve_b", "ch3_outing_mukai_steve_c"]);
  const late = at("d12-noon");
  late.value.met.steve = true;
  assert(!ids(late.value, late.window).includes("mukai_steve"), "Steve's customer visit after his shop scene");
}

// 煙幕・Smoke & Glory に通う（AFB02）: 一度きりの話がある間はそちらだけ。読んだ後は何度でも寄れる。
{
  const { value, window } = at("d8-night");
  assert(!ids(value, window).includes("enmaku_visit"), "Regular visit shown before the one-time talk");
  assert(claimChapterThreeOuting(value, window.id, "enmaku_notes"));
  let next = nextWindow(value);
  const visit = chapterThreeOutings(value, next.id).find(item => item.id === "enmaku_visit");
  assert(visit, "Ayatori's shop becomes a regular after the notes");
  assert.equal(outingDialogueId(value, visit, next), "ch3_outing_enmaku_visit");
  assert(claimChapterThreeOuting(value, next.id, "enmaku_visit"));
  next = nextWindow(value);
  const again = chapterThreeOutings(value, next.id).find(item => item.id === "enmaku_visit");
  assert.equal(outingDialogueId(value, again, next), "ch3_outing_enmaku_visit_b");
  // 助言の後は「答えを返しに行く」・味の会話が先。読むまで通いは出さない。
  const late = at("d12-noon");
  for (const [once, regular] of [["enmaku_answer", "enmaku_visit"], ["steve_timer", "steve_visit"]])
    assert(ids(late.value, late.window).includes(once) && !ids(late.value, late.window).includes(regular), `${regular} waits for ${once}`);
}

// RVE07: 鉄の煙にも通える。初来店（DAY12夜の ch3_volk_first）の後から、何度でも・小会話を巡回・好感度は通いの値
// （#3097 で b・c に d〜f を足した）
{
  const volk = TOKYO_OUTINGS.find(item => item.id === "volk_visit");
  assert.deepEqual([volk.place, volk.after, volk.affinityWith, volk.repeat, volk.regular, volk.talks.length],
    ["volk", "ch3_volk_first", "volk", true, true, 6]);
  for (const id of volk.talks) assert(OUTING_DIALOGUE_IDS.includes(id), `${id} is loaded`);
  const before = at("d12-noon");
  assert(!ids(before.value, before.window).includes("volk_visit"), "Not before the first visit to Iron Smoke");
  const talkAfter = n => outingDialogueId({ ...before.value, flags: { ...before.value.flags, [OUTINGS_FLAG]: { volk_visit: n } } }, volk, before.window);
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(talkAfter), ["ch3_outing_volk_visit",
    ...["b", "c", "d", "e", "f", "b", "c"].map(suffix => `ch3_outing_volk_visit_${suffix}`)]);
  assert.deepEqual(outingAffinity(before.value, volk), { volk: 16 }, "The first visit gains like a stage talk");
  const regulars = { ...before.value, flags: { ...before.value.flags, [OUTINGS_FLAG]: { volk_visit: 1 } } };
  assert.deepEqual(outingAffinity(regulars, volk), { volk: 8 }, "Later visits gain like a small talk");
  const after = { ...before.value, flags: { ...before.value.flags, _ch3_intro: { ...before.value.flags._ch3_intro,
    stage: chapterThreeScenes(before.value).findIndex(scene => scene.id === "ch3_volk_first") + 1 } } };
  assert(chapterThreeOutingCandidates(after).some(item => item.id === "volk_visit"), "Open after the first visit");
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
  assert.equal(chapterThreeOutings(value, next.id).find(item => item.id === "mukai_help").money, 10000, "mukai and tonari share the chapter 3 wage");
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
  assert.equal(TOKYO_OUTINGS.find(item => item.id === "steve_timer").affinityWith, "steve");
  // 好感度の付く外出は、一度きりの話か、通うたびに台本が変わる行き先（AFB02）。
  assert(TOKYO_OUTINGS.filter(item => item.affinityWith).every(item => !item.repeat || item.talks?.length >= 2), "Repeated affinity outings rotate talks");
  // 綾取（#2028・AFB02）: 好感度は煙幕への外出の確定時（一度きりの話は段階会話の +16）。台本には報酬行を置かない。
  for (const id of ["enmaku_notes", "enmaku_answer"]) {
    assert.deepEqual(outingAffinity(newState(), TOKYO_OUTINGS.find(item => item.id === id)), { ayatori: 16 });
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

// 綾取のLIME交換と締めくくり（#2028）: 助言の後、煙幕への再訪で♥1になった時だけ場面カードに出る。
// 好感度は任意の場面だけで付き、必須場面（本編・後日談の片づけ）では付かない。
{
  const routes = JSON.parse(fs.readFileSync(new URL("../../data/story_routes.json", import.meta.url)));
  const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))).dialogues;
  const scene = id => [...read("ch3_rivals"), ...read("ch3_main")].find(dialogue => dialogue.dialogue_id === id);
  const offered = value => availableOptionalScenes(routes, value).map(item => item.id);
  const early = at("d8-night");
  early.value.affinity.ayatori = AFFINITY_RANK_PTS[5];
  assert(!offered(early.value).includes("ch3_ayatori_lime"), "Ayatori's LIME before his advice");
  const { value } = at("d12-noon");
  assert(!offered(value).includes("ch3_ayatori_lime"), "Ayatori's LIME without affinity");
  value.affinity.ayatori = AFFINITY_RANK_PTS[1] - 1;
  assert(!offered(value).includes("ch3_ayatori_lime"), "Ayatori's LIME below ♥1");
  value.affinity.ayatori = AFFINITY_RANK_PTS[1];
  assert(offered(value).includes("ch3_ayatori_lime"));
  commitOptionalRead(value, "ch3_ayatori_lime");
  assert(!offered(value).includes("ch3_ayatori_lime"), "Ayatori's LIME read twice");
  const lime = scene("ch3_ayatori_lime").lines;
  assert(lime.some(line => line.type === "set_flag" && line.flag === "_lime_contact_ayatori"));
  assert.deepEqual(lime.filter(line => line.type === "apply").map(line => line.affinity), [{ ayatori: 2 }]);
  assert.equal(classifyFlag("_lime_contact_ayatori"), "person");
  for (const id of ["ch3_ayatori_first", "ch3_ayatori_mukai_visit", "ch3_ayatori_advice", "ch3_enmaku_cleanup"]) {
    const dialogue = scene(id);
    const lines = [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
    assert(!dialogue.metadata?.add_affinity && !lines.some(line => line.affinity?.ayatori), `${id}: mandatory scenes give no affinity`);
  }
  const cleanup = scene("ch3_enmaku_cleanup");
  const gate = cleanup.lines.find(line => line.type === "condition" && line.flag === "_lime_contact_ayatori");
  assert(gate && !gate.next_false && cleanup.branches[gate.next_true].some(line => line.speaker === "ayatori"));
  // CI の quick は立ち絵を取得しないため、画像がある環境だけ表情を照合する（表情の登録は lint_dialogue でも検査）。
  const spriteDir = new URL("../img/sprites/characters/ayatori/", import.meta.url);
  if (fs.existsSync(spriteDir)) {
    const faces = new Set(fs.readdirSync(spriteDir).map(name => name.replace(/^chr_ayatori_|\.webp$/g, "")));
    for (const line of [...lime, ...cleanup.branches[gate.next_true]]) if (line.speaker === "ayatori") assert(faces.has(line.face), line.face);
  }
}

// スティーブのLIME交換（#2028）: 配達で面識があり、♥2で、mukai の店番の3回目（客の顔の回 _c）の後に mukai の寄り道に出る
// （締めくくりの前提）。店番の通いは1回目で♥1、2回目で♥2。顔の回より先に頼みごとを読むと、話の順が逆になる。
// 低温の話の後は店番の通いが終わるので、♥2だけで開く。好感度は任意の場面だけで付き、必須の低温の話では付かない。
{
  const routes = JSON.parse(fs.readFileSync(new URL("../../data/story_routes.json", import.meta.url)));
  const read = name => JSON.parse(fs.readFileSync(new URL(`../../data/dialogue/${name}.json`, import.meta.url))).dialogues;
  const scene = id => read("ch3_rivals").find(dialogue => dialogue.dialogue_id === id);
  const offered = value => availableOptionalScenes(routes, value).map(item => item.id);
  const { value } = at("d8-night");
  value.affinity.steve = AFFINITY_RANK_PTS[5];
  assert(!offered(value).includes("ch3_steve_lime"), "Steve's LIME before meeting him");
  value.met.steve = true;
  const visits = TOKYO_OUTINGS.find(item => item.id === "mukai_steve");
  value.affinity.steve = outingAffinity(newState(), visits).steve;
  assert(value.affinity.steve < AFFINITY_RANK_PTS[2], "one customer visit is ♥1");
  assert(!offered(value).includes("ch3_steve_lime"), "Steve's LIME below ♥2");
  value.affinity.steve += outingAffinity({ ...value, flags: { ...value.flags, [OUTINGS_FLAG]: { mukai_steve: 1 } } }, visits).steve;
  assert(value.affinity.steve >= AFFINITY_RANK_PTS[2], "the second customer visit reaches ♥2");
  value.flags[OUTINGS_FLAG] = { mukai_steve: 2 };
  assert(!offered(value).includes("ch3_steve_lime"), "Steve's LIME before the face-reading visit");
  assert.equal(outingDialogueId(value, visits), "ch3_outing_mukai_steve_c", "the third visit is the face-reading talk");
  value.flags[OUTINGS_FLAG] = { mukai_steve: 3 };
  const entry = availableOptionalScenes(routes, value).find(item => item.id === "ch3_steve_lime");
  assert(entry, "Steve's LIME opens at ♥2 after the face-reading visit");
  assert.equal(entry.label, "スティーブの頼みごと", "the mukai entry names Steve");
  assert.deepEqual([entry.location, entry.host], ["mukai", "steve"], "read at mukai, the action's person is Steve");
  commitOptionalRead(value, "ch3_steve_lime");
  assert(!offered(value).includes("ch3_steve_lime"), "Steve's LIME read twice");
  // 低温の話の後は店番の通い（mukai_steve）が出ないので、回数を問わず♥2で開く（Smoke & Glory の通いでも♥は上がる）。
  {
    const late = departure();
    const stop = chapterThreeScenes(late).findIndex(item => item.id === "ch3_steve_low_heat");
    for (let guard = 0; late.flags._ch3_intro.stage <= stop && guard < 80; guard++) {
      const window = chapterThreeFreeTime(late);
      if (window) { assert(completeChapterThreeFreeTime(late, window.id)); continue; }
      assert(completeChapterThreeScene(late, chapterThreeScenes(late)[late.flags._ch3_intro.stage].id));
    }
    late.met.steve = true;
    late.affinity.steve = AFFINITY_RANK_PTS[2];
    assert(!chapterThreeOutingCandidates(late).some(item => item.id === "mukai_steve"), "the customer visits end at the low-heat talk");
    assert(offered(late).includes("ch3_steve_lime"), "after the low-heat talk, ♥2 alone opens Steve's LIME");
    late.affinity.steve = AFFINITY_RANK_PTS[2] - 1;
    assert(!offered(late).includes("ch3_steve_lime"), "still ♥2 after the low-heat talk");
  }
  const lime = scene("ch3_steve_lime").lines;
  assert(lime.some(line => line.type === "set_flag" && line.flag === "_lime_contact_steve"));
  assert.deepEqual(lime.filter(line => line.type === "apply").map(line => line.affinity), [{ steve: 2 }]);
  assert.equal(classifyFlag("_lime_contact_steve"), "person");
  assert.equal(classifyFlag("_ch3_read_ch3_steve_lime"), "progression");
  const low = scene("ch3_steve_low_heat");
  assert(!low.metadata?.add_affinity && !low.lines.some(line => line.affinity?.steve), "the mandatory low-heat scene gives no affinity");
  // 日常ループでは昼にも夜にも読むので、時間帯を言わない（締めくくりも同じ）。
  const finale = scene("ch3_steve_bond_finale");
  const texts = [...lime, ...finale.lines, ...Object.values(finale.branches).flat()].map(line => line.text || "").join("\n");
  assert.doesNotMatch(texts, /今夜|閉店後|昼の/, "no time of day in Steve's LIME and finale");
  const spriteDir = new URL("../img/sprites/characters/steve/", import.meta.url);
  if (fs.existsSync(spriteDir)) {
    const faces = new Set(fs.readdirSync(spriteDir).map(name => name.replace(/^chr_steve_|\.webp$/g, "")));
    for (const line of [...lime, ...finale.lines, ...Object.values(finale.branches).flat()])
      if (line.speaker === "steve") assert(faces.has(line.face), line.face);
  }
}

// ヴォルクのLIME交換（#2028）: 鉄の煙の四度目の来店（「次は、俺のメモも持ってきます」）の後、面識と♥2で鉄の煙の寄り道に出る
// （締めくくりの前提）。版3の日常ループでは初来店から大会まで行動が一つしかないので、大会後の寄り道にも同じ条件で出す
// （ch3_aftermath.mjs）。好感度は任意の場面だけで付く。昼にも夜にも読むので、LIME交換と締めくくりは時間帯を言わない。
{
  const routes = JSON.parse(fs.readFileSync(new URL("../../data/story_routes.json", import.meta.url)));
  const volk = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_volk.json", import.meta.url))).dialogues;
  const scene = id => volk.find(dialogue => dialogue.dialogue_id === id);
  const offered = value => availableOptionalScenes(routes, value).map(item => item.id);
  const late = departure();
  const first = chapterThreeScenes(late).findIndex(item => item.id === "ch3_volk_first");
  for (let guard = 0; late.flags._ch3_intro.stage <= first && guard < 80; guard++) {
    const window = chapterThreeFreeTime(late);
    if (window) { assert(completeChapterThreeFreeTime(late, window.id)); continue; }
    assert(completeChapterThreeScene(late, chapterThreeScenes(late)[late.flags._ch3_intro.stage].id));
  }
  late.met.volk = true;
  late.affinity.volk = AFFINITY_RANK_PTS[5];
  assert(offered(late).includes("ch3_volk_second") && !offered(late).includes("ch3_volk_lime"), "the visits come first");
  for (const id of ["ch3_volk_second", "ch3_volk_third"]) {
    commitOptionalRead(late, id);
    assert(!offered(late).includes("ch3_volk_lime"), `not right after ${id}`);
  }
  commitOptionalRead(late, "ch3_volk_fourth");
  const entry = availableOptionalScenes(routes, late).find(item => item.id === "ch3_volk_lime");
  assert(entry, "Volk's LIME opens after the fourth visit");
  assert.deepEqual([entry.label, entry.location, entry.bg], ["持ってきたメモ", "鉄の煙", "bg_volk_shop"]);
  late.affinity.volk = AFFINITY_RANK_PTS[2] - 1;
  assert(!offered(late).includes("ch3_volk_lime"), "below ♥2");
  late.affinity.volk = AFFINITY_RANK_PTS[2];
  assert(offered(late).includes("ch3_volk_lime"), "at ♥2");
  late.met.volk = false;
  assert(!offered(late).includes("ch3_volk_lime"), "only once met");
  late.met.volk = true;
  commitOptionalRead(late, "ch3_volk_lime");
  assert(!offered(late).includes("ch3_volk_lime"), "read once");
  const lime = scene("ch3_volk_lime").lines;
  assert(lime.some(line => line.type === "set_flag" && line.flag === "_lime_contact_volk"));
  assert.deepEqual(lime.filter(line => line.type === "apply").map(line => line.affinity), [{ volk: 2 }]);
  assert.equal(classifyFlag("_lime_contact_volk"), "person");
  assert.equal(classifyFlag("_ch3_read_ch3_volk_lime"), "progression");
  const finale = scene("ch3_volk_bond_finale");
  const rows = [...lime, ...finale.lines, ...Object.values(finale.branches).flat()];
  assert.doesNotMatch(rows.map(line => line.text || "").join("\n"), /今夜|閉店後|昼の|夜の/, "no time of day in Volk's LIME and finale");
  const spriteDir = new URL("../img/sprites/characters/volk/", import.meta.url);
  if (fs.existsSync(spriteDir)) {
    const faces = new Set(fs.readdirSync(spriteDir).map(name => name.replace(/^chr_volk_|\.webp$/g, "")));
    for (const line of rows) if (line.speaker === "volk") assert(faces.has(line.face), line.face);
  }
}

// #3097: mukaiのシフトの導入は、味が戻る前は手伝いの回数で、戻った後は戻ってからの回数で巡回する。
// 戻った後の1回目は必ず「戻ってきた」場面。回数は確定の時だけ進み、選ぶだけでは保存を変えない。
{
  const mukai = TOKYO_OUTINGS.find(item => item.id === "mukai_help");
  const { value } = at("d5-noon");
  assert(!tasteRecovered(value));
  // RLS10: ムカイさんが話す回（d〜f）を、ましろの回と交互に読む
  for (const [count, expected] of [[0, "lost"], [1, "lost_d"], [2, "lost_b"], [3, "lost_e"], [4, "lost_c"], [5, "lost_f"], [6, "lost"], [7, "lost_d"]]) {
    value.flags[OUTINGS_FLAG] = { mukai_help: count };
    const before = structuredClone(value);
    assert.equal(outingDialogueId(value, mukai), `ch3_outing_mukai_help_${expected}`);
    assert.deepEqual(value, before, "Selecting the shift intro must not change the save");
  }
  for (const broken of ["a", -5, null, 2.7]) {
    value.flags[OUTINGS_FLAG] = { mukai_help: broken };
    assert(OUTING_DIALOGUE_IDS.includes(outingDialogueId(value, mukai)), `broken count ${broken} still picks a loaded scene`);
  }
  value.flags[OUTINGS_FLAG] = { mukai_help: 2 };
  recordChapterThreeOuting(value, "mukai_help");
  assert.deepEqual(value.flags[OUTINGS_FLAG], { mukai_help: 3 }, "Before the taste returns, only the shift count moves");

  const late = at("d12-noon").value;
  assert(tasteRecovered(late));
  late.flags[OUTINGS_FLAG] = { mukai_help: 5 };
  assert.equal(outingDialogueId(late, mukai), "ch3_outing_mukai_help", "The first shift after the taste returns reads the return scene");
  for (const expected of ["_d", "_b", "_e", "_c", "_f", "", "_d"]) {
    recordChapterThreeOuting(late, "mukai_help");
    assert.equal(outingDialogueId(late, mukai), `ch3_outing_mukai_help${expected}`);
  }
  assert.deepEqual(late.flags[OUTINGS_FLAG], { mukai_help: 12, mukai_help_back: 7 });

  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_outings.json", import.meta.url)));
  const byId = Object.fromEntries(data.dialogues.map(scene => [scene.dialogue_id, scene]));
  for (const id of ["lost_b", "lost_c", "lost_d", "lost_e", "lost_f", "b", "c", "d", "e", "f"].map(suffix => `ch3_outing_mukai_help_${suffix}`)) {
    assert(OUTING_DIALOGUE_IDS.includes(id), `${id}: real loader requests the new scene`);
    assert(byId[id].lines.length >= 7);
    assert(byId[id].lines.every(line => !line.type && typeof line.text === "string" && line.text.length > 0));
    assert.equal(byId[id].metadata, undefined, `${id}: no extra reward or background override`);
    assert.equal(byId[id].lines.at(-1).text, "閉店まで手伝い、ムカイさんから日当を受け取った。", `${id}: ends like the existing shift intro`);
  }
  // RLS10: d〜f はムカイさん本人が話す回。シフトはどの時間帯にも入れるので、昼夜の言葉は使わない。
  for (const id of ["lost_d", "lost_e", "lost_f", "d", "e", "f"].map(suffix => `ch3_outing_mukai_help_${suffix}`)) {
    assert(byId[id].lines.filter(line => line.speaker === "mukai_master").length >= 3, `${id}: Mukai speaks`);
    assert.doesNotMatch(byId[id].lines.map(line => line.text).join("\n"), /昼|夜|午後|朝|大会/, `${id}: no time of day or tournament`);
  }
  // 味が戻る前の回は、はじめの舌の話をしない（シフトは「作れない日」より前にも入れる）
  for (const id of ["lost_d", "lost_e", "lost_f"].map(suffix => `ch3_outing_mukai_help_${suffix}`)) {
    assert.doesNotMatch(byId[id].lines.map(line => line.text).join("\n"), /舌|味が/, `${id}: no taste talk before the return`);
  }
}

// #3097 計画 3-1（PR-G）: 雨の日は、mukaiの手伝い・公園・奥の部屋を雨の日の版で読む。
// 手伝いの最初の1回と味が戻った後の1回目は通常の場面。公園と奥の部屋は、雨で読んだ回に晴れの日の巡回を進めない。
{
  const seedFor = (value, rain) => {
    for (let seed = 0; seed < 5000; seed++) if (rainyFor({ ...value, weatherSeed: seed }) === rain) return seed;
    throw new Error("no seed");
  };
  const mukai = TOKYO_OUTINGS.find(item => item.id === "mukai_help"), park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  const { value, window } = at("d5-noon");
  assert(!tasteRecovered(value));
  assert.equal(rainyFor(value), false, "A save without a weather seed reads as dry");
  value.weatherSeed = seedFor(value, true);
  // 手伝い: 最初の1回は導入のまま、2回目からは雨の版を雨の回数で巡回する
  value.flags[OUTINGS_FLAG] = {};
  assert.equal(rainyOuting(value, "mukai_help"), false);
  assert.equal(outingDialogueId(value, mukai), "ch3_outing_mukai_help_lost");
  value.flags[OUTINGS_FLAG] = { mukai_help: 3 };
  const before = structuredClone(value);
  assert.equal(outingDialogueId(value, mukai), "ch3_outing_mukai_help_rain");
  assert.deepEqual(value, before, "Selecting the rain intro must not change the save");
  recordChapterThreeOuting(value, "mukai_help");
  assert.deepEqual(value.flags[OUTINGS_FLAG], { mukai_help: 4, mukai_help_rain: 1 }, "The shift count still moves on a rainy day");
  assert.equal(outingDialogueId(value, mukai), "ch3_outing_mukai_help_rain_b");
  recordChapterThreeOuting(value, "mukai_help");
  assert.equal(outingDialogueId(value, mukai), "ch3_outing_mukai_help_rain");
  // 晴れの日は、雨の回数に関係なく通常の巡回（手伝いの回数で決まる）
  value.weatherSeed = seedFor(value, false);
  assert.equal(outingDialogueId(value, mukai), "ch3_outing_mukai_help_lost_f");
  // 味が戻った後: 戻ってからの1回目は「戻ってきた」場面、その後は雨の版
  const late = at("d12-noon").value;
  assert(tasteRecovered(late));
  late.weatherSeed = seedFor(late, true);
  late.flags[OUTINGS_FLAG] = { mukai_help: 5 };
  assert.equal(outingDialogueId(late, mukai), "ch3_outing_mukai_help");
  recordChapterThreeOuting(late, "mukai_help");
  assert.deepEqual(late.flags[OUTINGS_FLAG], { mukai_help: 6, mukai_help_back: 1 });
  assert.equal(outingDialogueId(late, mukai), "ch3_outing_mukai_help_rain");
  // 公園: 雨なら昼夜それぞれの雨の版。昼夜の巡回は進めず、合計と雨の回数だけ数える
  value.weatherSeed = seedFor(value, true);
  value.flags[OUTINGS_FLAG] = { park_walk: 2, park_walk_day: 1, park_walk_night: 1 };
  assert.equal(outingDialogueId(value, park, { slot: 0 }), "ch3_outing_park_walk_day_rain");
  assert.equal(outingDialogueId(value, park, { slot: 1 }), "ch3_outing_park_walk_night_rain");
  recordChapterThreeOuting(value, "park_walk", 0);
  assert.deepEqual(value.flags[OUTINGS_FLAG], { park_walk: 3, park_walk_day: 1, park_walk_night: 1, park_walk_rain: 1 });
  value.weatherSeed = seedFor(value, false);
  assert.equal(outingDialogueId(value, park, { slot: 0 }), "ch3_outing_park_walk_day_b", "The next dry day continues the day rotation");
  // 奥の部屋: 初回は雨でも導入。2回目以降の雨の日は雨の版で、巡回の回数は進めない
  value.weatherSeed = seedFor(value, true);
  value.flags._ch3_room_rests = 0;
  assert.equal(roomRestId(value), "ch3_tokyo_room_rest");
  recordRoomRest(value);
  assert.equal(value.flags._ch3_room_rests, 1);
  assert.equal(roomRestId(value), "ch3_tokyo_room_rest_rain");
  recordRoomRest(value);
  assert.equal(value.flags._ch3_room_rests, 1, "A rainy rest does not advance the dry rotation");
  value.weatherSeed = seedFor(value, false);
  assert.equal(roomRestId(value), "ch3_tokyo_room_rest_b");
  recordRoomRest(value);
  assert.equal(value.flags._ch3_room_rests, 2);

  // 台本: 読み込み一覧にあり、ムカイさんが話し、雨の場面であることが本文で分かる。手伝いの雨版は味の感想を言わない
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_outings.json", import.meta.url)));
  const daily = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_tokyo_daily.json", import.meta.url)));
  const byId = Object.fromEntries([...data.dialogues, ...daily.dialogues].map(scene => [scene.dialogue_id, scene]));
  const rainIds = ["ch3_outing_mukai_help_rain", "ch3_outing_mukai_help_rain_b", "ch3_outing_park_walk_day_rain", "ch3_outing_park_walk_night_rain"];
  for (const id of rainIds) assert(OUTING_DIALOGUE_IDS.includes(id), `${id}: real loader requests the rain scene`);
  assert(ROOM_REST_IDS.includes("ch3_tokyo_room_rest_rain"));
  for (const id of [...rainIds, "ch3_tokyo_room_rest_rain"]) {
    const scene = byId[id];
    assert(scene, id);
    assert(scene.lines.length >= 12, `${id}: a full scene, not a stub`);
    assert(scene.lines.every(line => !line.type && typeof line.text === "string" && line.text.length > 0));
    assert.equal(scene.metadata, undefined, `${id}: no extra reward or background override`);
    assert.match(scene.lines.map(line => line.text).join("\n"), /雨|傘/, `${id}: reads as a rainy day`);
  }
  for (const id of ["ch3_outing_mukai_help_rain", "ch3_outing_mukai_help_rain_b", "ch3_tokyo_room_rest_rain"]) {
    assert(byId[id].lines.filter(line => line.speaker === "mukai_master").length >= 3, `${id}: Mukai speaks`);
  }
  for (const id of ["ch3_outing_mukai_help_rain", "ch3_outing_mukai_help_rain_b"]) {
    assert.doesNotMatch(byId[id].lines.map(line => line.text).join("\n"), /舌|味が|大会/, `${id}: readable before and after the taste returns`);
  }
}

assert.equal(classifyFlag(OUTINGS_FLAG), "progression");
console.log("ch3 outings: ok");


// SPV04: 昼夜を挟んでも各時間帯の初回→b→cを飛ばさない。完読前・二重確定は数えない。
{
  const { value, window } = at("d5-noon");
  const park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  let current = window;
  for (const suffix of ["day", "night", "night_b", "night_c", "day_b", "day_c"]) {
    assert(current);
    const before = structuredClone(value);
    const expected = `ch3_outing_park_walk_${suffix}`;
    assert.equal(outingDialogueId(value, park, current), expected);
    assert.equal(outingDialogueId(value, park, current), expected, "An unread/cancelled visit must not advance the next scene");
    assert.deepEqual(value, before);
    assert(claimChapterThreeOuting(value, current.id, "park_walk"));
    const once = structuredClone(value);
    assert.equal(claimChapterThreeOuting(value, current.id, "park_walk"), null);
    assert.deepEqual(value, once, "A repeated completion must not advance either counter");
    current = nextWindow(value);
  }
  assert.equal(value.flags[OUTINGS_FLAG].park_walk, 6, "Keep the existing total visit count");
}

// #3097: park revisits vary by visit count and actual slot without changing state or recovery.
{
  const park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  const value = at("d5-noon").value;
  assert.equal(park.stamina, 20);
  assert.equal(park.stat, undefined);
  assert.equal(park.affinityWith, undefined);
  for (const slot of [0, 1]) {
    const base = `ch3_outing_park_walk_${slot ? "night" : "day"}`;
    for (const count of [0, 1, 2, 3, 4, 81]) {
      value.flags[OUTINGS_FLAG] = { park_walk: count + 7, [`park_walk_${slot ? "night" : "day"}`]: count };
      value.slot = 1 - slot;
      const before = structuredClone(value);
      const revisit = count ? `${base}_${["b", "c", "d", "e", "f", "g", "h"][(count - 1) % 7]}` : base;
      assert.equal(outingDialogueId(value, park, { slot }), revisit);
      assert.deepEqual(value, before, "Selecting a park revisit must not mark a visit or change the save");
      value.slot = slot;
      assert.equal(outingDialogueId(value, park), revisit);
    }
  }
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_outings.json", import.meta.url)));
  const byId = Object.fromEntries(data.dialogues.map(scene => [scene.dialogue_id, scene]));
  const newIds = ["enmaku_visit_d", "steve_visit_c", ...["day", "night"].flatMap(time => ["b", "c", "d", "e", "f", "g", "h"].map(suffix => `park_walk_${time}_${suffix}`)),
    // #3097（RLS03）: ライバル店の通いの小会話
    "enmaku_visit_e", "enmaku_visit_f", "enmaku_visit_g", "steve_visit_d", "steve_visit_e", "steve_visit_f",
    "volk_visit_d", "volk_visit_e", "volk_visit_f"].map(id => `ch3_outing_${id}`);
  for (const id of newIds) {
    assert(OUTING_DIALOGUE_IDS.includes(id), `${id}: real loader requests the new scene`);
    assert(byId[id].lines.length >= 8);
    assert(byId[id].lines.every(line => !line.type && typeof line.text === "string" && line.text.length > 0));
    assert.equal(byId[id].metadata, undefined, `${id}: no extra reward, flavor lesson or background override`);
  }
  for (const [id, expected] of [
    ["enmaku_visit", ["b", "c", "d", "e", "f", "g", "b", "c"]],
    ["steve_visit", ["b", "c", "d", "e", "f", "b", "c"]],
    ["volk_visit", ["b", "c", "d", "e", "f", "b"]],
  ]) {
    const outing = TOKYO_OUTINGS.find(item => item.id === id);
    for (let count = 1; count <= expected.length; count++) {
      value.flags[OUTINGS_FLAG] = { [id]: count };
      const before = structuredClone(value);
      assert.equal(outingDialogueId(value, outing), `ch3_outing_${id}_${expected[count - 1]}`);
      assert.deepEqual(outingAffinity(value, outing), { [outing.affinityWith]: 8 });
      assert.deepEqual(value, before);
    }
  }
}
console.log("PASS: six everyday scenes load and rotate; park recovery and ordinary visit affinity remain unchanged");

// 日常ループの完読記録: 昼夜交互でもb〜eを順に読み、実SAVE/LOADでも続きが残る。
{
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)) };
  let value = at("d5-noon").value;
  const park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  value.flags[OUTINGS_FLAG] = { park_walk: 81, mukai_help: 4 };
  const stamina = value.stamina, money = value.money;
  for (const suffix of ["", "_b", "_c", "_d", "_e", "_f"]) { // #3097 で巡回を b・c から b〜e、さらに b〜g へ
    for (const slot of [0, 1]) {
      value.slot = slot;
      const expected = `ch3_outing_park_walk_${slot ? "night" : "day"}${suffix}`;
      assert.equal(outingDialogueId(value, park), expected, "Old totals must not be guessed as day/night history");
      recordChapterThreeOuting(value, park.id, slot);
      setState(value);
      assert(saveToSlot("suien_remake_slot1"));
      value = loadFromSlot("suien_remake_slot1");
      assert(value);
      value.weatherSeed = null; // 読み込みで種が作り直される。雨の日の版は PR-G のテストで種を決めて確かめる
    }
  }
  assert.deepEqual(value.flags[OUTINGS_FLAG], { park_walk: 93, mukai_help: 4, park_walk_day: 6, park_walk_night: 6 });
  assert.equal(value.stamina, stamina);
  assert.equal(value.money, money);
}
console.log("PASS: park day/night rotation, old saves, SAVE/LOAD and duplicate completion");

// 地元からの電話（#3097 第2弾・2026-11-21 オーナー「交友を1章以降も厚く」）: 奥の部屋で休むと、休む場面の代わりに一本ずつ読む。
{
  const value = departure();
  value.contacts = ["sumi"];
  value.flags._ch3_room_rests = 0;
  assert.equal(homeCallId(value, { night: true }), null, "The first rest keeps the introduction of the room");
  recordRoomRest(value);
  // 連絡先にいる人だけ。並びの先頭から、未読の一本
  assert.equal(homeCallId(value), "ch3_home_call_sumi_fan");
  recordHomeCall(value, "ch3_home_call_sumi_fan");
  assert.equal(value.flags._ch3_room_rests, 1, "A call does not advance the rest rotation");
  assert.equal(homeCallId(value), null, "Sumi's night call waits for the night; nobody else is in the contacts");
  assert.equal(homeCallId(value, { night: true }), "ch3_home_call_sumi_pocket");
  assert.equal(homeCallId(value, { night: true, busy: true }), null, "A night with a story scene or a far call has no home call");
  value.contacts.push("adam", "samechan", "rio", "kumicho", "kuraudo");
  assert.equal(homeCallId(value), "ch3_home_call_adam_exit");
  assert.equal(homeCallId(value, { night: true }), "ch3_home_call_adam_exit");
  assert.equal(homeCallId(value, { away: id => id === "adam" }), "ch3_home_call_rio_face", "Someone visiting Tokyo does not call from home");
  value.contacts.push("tsumugi", "ageha", "hiyori");
  const read = [];
  for (let turn = 0; turn < 20; turn++) { // 昼と夜の休みを交互に（夜だけの電話は昼には来ない）
    const call = homeCallId(value, { night: turn % 2 === 0 });
    if (call) { read.push(call); recordHomeCall(value, call); }
  }
  assert.equal(read.length, new Set(read).size, "No call is read twice");
  const reachable = HOME_CALLS.filter(call => value.contacts.includes(call.from)).map(call => call.scene); // みんとは連絡先にいない
  assert.deepEqual(new Set(read), new Set(reachable.filter(id => id !== "ch3_home_call_sumi_fan")), "Every call from a contact is read once");
  assert.equal(homeCallId(value, { night: true }), null);
  assert.deepEqual(Object.keys(value.flags[HOME_CALL_FLAG]).sort(), [...reachable].sort());
  assert(!value.flags[HOME_CALL_FLAG].ch3_home_call_minto_frame, "Not from someone outside the contacts");
  recordHomeCall(value, "ch3_tokyo_room_rest_b");
  assert.equal(value.flags[HOME_CALL_FLAG].ch3_tokyo_room_rest_b, undefined, "Only home calls are recorded");
  assert.equal(classifyFlag(HOME_CALL_FLAG), "progression");
  // 全国大会の後・別の章では出さない
  const after = departure();
  Object.assign(after, { contacts: ["sumi"], phase: "aftermath" });
  after.flags._ch3_room_rests = 3;
  assert.equal(homeCallId(after), null, "No pre-tournament call after the national tournament");
  after.phase = "daily";
  assert.equal(homeCallId(after), "ch3_home_call_sumi_fan");
  after.chapter = 4;
  assert.equal(homeCallId(after), null);
  // 保存と読み込みで既読が残る
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, v) => storage.set(key, String(v)) };
  const saved = departure();
  saved.contacts = ["sumi"];
  saved.flags._ch3_room_rests = 1;
  recordHomeCall(saved, homeCallId(saved));
  setState(saved);
  assert(saveToSlot("suien_remake_slot1"));
  const loaded = loadFromSlot("suien_remake_slot1");
  assert.equal(homeCallId(loaded), null);
  assert.equal(homeCallId(loaded, { night: true }), "ch3_home_call_sumi_pocket");

  // 台本: 一覧の全部があり、電話をかけてくる人が話す（ポケットの誤発信だけは店の音とLIME）。はじめは味の感想を言わず、大会・事件に触れない
  const calls = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_home_calls.json", import.meta.url)));
  const byId = Object.fromEntries(calls.dialogues.map(scene => [scene.dialogue_id, scene]));
  assert.deepEqual(Object.keys(byId).sort(), [...HOME_CALL_IDS].sort());
  for (const { scene: id, from } of HOME_CALLS) {
    const scene = byId[id];
    assert(scene.lines.length >= 12, `${id}: a full scene, not a stub`);
    assert(scene.lines.every(line => !line.type && typeof line.text === "string" && line.text.length > 0));
    assert.equal(scene.metadata, undefined, `${id}: no reward or background override`);
    if (id !== "ch3_home_call_sumi_pocket") assert(scene.lines.filter(line => line.speaker === from).length >= 4, `${id}: ${from} speaks`);
    const text = scene.lines.map(line => line.text).join("\n");
    assert.doesNotMatch(text, /大会|ダブルアップル|舌|なるさん/, `${id}: readable before and after the taste returns, apart from the story`);
    assert.match(text, /スマホ|電話|通話/, `${id}: reads as a call`);
  }
}
console.log("PASS: home calls replace a Tokyo rest one at a time, only from contacts and only before the national tournament");
