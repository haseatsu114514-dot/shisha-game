// 東京の自由時間に地図から選ぶ行き先（#1655）: 出る時期・予約との関係・一度性・台本・地図への投影。
import assert from "node:assert/strict";
import fs from "node:fs";
import { newState, setState, saveToSlot, loadFromSlot } from "../js/core/state.js";
import { advanceToChapterThree, departChapterThree, chapterThreeScenes, completeChapterThreeScene,
  chapterThreeFreeTime, completeChapterThreeFreeTime } from "../js/chapters/ch3-progress.js";
import { TOKYO_OUTINGS, OUTING_DIALOGUE_IDS, OUTINGS_FLAG, chapterThreeOutings, chapterThreeOutingCandidates,
  claimChapterThreeOuting, outingDialogueId, outingAffinity, tasteRecovered, recordChapterThreeOuting } from "../js/chapters/ch3-outing-progress.js";
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

// RVE07: 鉄の煙にも通える。初来店（DAY12夜の ch3_volk_first）の後から、何度でも・3本を巡回・好感度は通いの値
{
  const volk = TOKYO_OUTINGS.find(item => item.id === "volk_visit");
  assert.deepEqual([volk.place, volk.after, volk.affinityWith, volk.repeat, volk.regular, volk.talks.length],
    ["volk", "ch3_volk_first", "volk", true, true, 3]);
  for (const id of volk.talks) assert(OUTING_DIALOGUE_IDS.includes(id), `${id} is loaded`);
  const before = at("d12-noon");
  assert(!ids(before.value, before.window).includes("volk_visit"), "Not before the first visit to Iron Smoke");
  const talkAfter = n => outingDialogueId({ ...before.value, flags: { ...before.value.flags, [OUTINGS_FLAG]: { volk_visit: n } } }, volk, before.window);
  assert.deepEqual([0, 1, 2, 3, 4].map(talkAfter),
    ["ch3_outing_volk_visit", "ch3_outing_volk_visit_b", "ch3_outing_volk_visit_c", "ch3_outing_volk_visit_b", "ch3_outing_volk_visit_c"]);
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
    assert.deepEqual(outingAffinity(newState(), TOKYO_OUTINGS.find(item => item.id === id)), { saku: 16 });
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
  early.value.affinity.saku = AFFINITY_RANK_PTS[5];
  assert(!offered(early.value).includes("ch3_saku_lime"), "Ayatori's LIME before his advice");
  const { value } = at("d12-noon");
  assert(!offered(value).includes("ch3_saku_lime"), "Ayatori's LIME without affinity");
  value.affinity.saku = AFFINITY_RANK_PTS[1] - 1;
  assert(!offered(value).includes("ch3_saku_lime"), "Ayatori's LIME below ♥1");
  value.affinity.saku = AFFINITY_RANK_PTS[1];
  assert(offered(value).includes("ch3_saku_lime"));
  commitOptionalRead(value, "ch3_saku_lime");
  assert(!offered(value).includes("ch3_saku_lime"), "Ayatori's LIME read twice");
  const lime = scene("ch3_saku_lime").lines;
  assert(lime.some(line => line.type === "set_flag" && line.flag === "_lime_contact_saku"));
  assert.deepEqual(lime.filter(line => line.type === "apply").map(line => line.affinity), [{ saku: 2 }]);
  assert.equal(classifyFlag("_lime_contact_saku"), "person");
  for (const id of ["ch3_saku_first", "ch3_saku_mukai_visit", "ch3_saku_advice", "ch3_enmaku_cleanup"]) {
    const dialogue = scene(id);
    const lines = [...dialogue.lines, ...Object.values(dialogue.branches || {}).flat()];
    assert(!dialogue.metadata?.add_affinity && !lines.some(line => line.affinity?.saku), `${id}: mandatory scenes give no affinity`);
  }
  const cleanup = scene("ch3_enmaku_cleanup");
  const gate = cleanup.lines.find(line => line.type === "condition" && line.flag === "_lime_contact_saku");
  assert(gate && !gate.next_false && cleanup.branches[gate.next_true].some(line => line.speaker === "saku"));
  // CI の quick は立ち絵を取得しないため、画像がある環境だけ表情を照合する（表情の登録は lint_dialogue でも検査）。
  const spriteDir = new URL("../img/sprites/characters/saku/", import.meta.url);
  if (fs.existsSync(spriteDir)) {
    const faces = new Set(fs.readdirSync(spriteDir).map(name => name.replace(/^chr_saku_|\.webp$/g, "")));
    for (const line of [...lime, ...cleanup.branches[gate.next_true]]) if (line.speaker === "saku") assert(faces.has(line.face), line.face);
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
      assert.equal(outingDialogueId(value, park, { slot }), count ? `${base}_${count % 2 ? "b" : "c"}` : base);
      assert.deepEqual(value, before, "Selecting a park revisit must not mark a visit or change the save");
      value.slot = slot;
      assert.equal(outingDialogueId(value, park), count ? `${base}_${count % 2 ? "b" : "c"}` : base);
    }
  }
  const data = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/ch3_outings.json", import.meta.url)));
  const byId = Object.fromEntries(data.dialogues.map(scene => [scene.dialogue_id, scene]));
  const newIds = ["enmaku_visit_d", "steve_visit_c", ...["day", "night"].flatMap(time => ["b", "c"].map(suffix => `park_walk_${time}_${suffix}`))].map(id => `ch3_outing_${id}`);
  for (const id of newIds) {
    assert(OUTING_DIALOGUE_IDS.includes(id), `${id}: real loader requests the new scene`);
    assert(byId[id].lines.length >= 8);
    assert(byId[id].lines.every(line => !line.type && typeof line.text === "string" && line.text.length > 0));
    assert.equal(byId[id].metadata, undefined, `${id}: no extra reward, flavor lesson or background override`);
  }
  for (const [id, expected] of [
    ["enmaku_visit", ["b", "c", "d", "b", "c", "d"]],
    ["steve_visit", ["b", "c", "b", "c", "b", "c"]],
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

// 日常ループの完読記録: 昼夜交互でもb/cを両方読み、実SAVE/LOADでも続きが残る。
{
  const storage = new Map();
  globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)) };
  let value = at("d5-noon").value;
  const park = TOKYO_OUTINGS.find(item => item.id === "park_walk");
  value.flags[OUTINGS_FLAG] = { park_walk: 81, mukai_help: 4 };
  const stamina = value.stamina, money = value.money;
  for (const suffix of ["", "_b", "_c", "_b", "_c"]) {
    for (const slot of [0, 1]) {
      value.slot = slot;
      const expected = `ch3_outing_park_walk_${slot ? "night" : "day"}${suffix}`;
      assert.equal(outingDialogueId(value, park), expected, "Old totals must not be guessed as day/night history");
      recordChapterThreeOuting(value, park.id, slot);
      setState(value);
      assert(saveToSlot("suien_remake_slot1"));
      value = loadFromSlot("suien_remake_slot1");
      assert(value);
    }
  }
  assert.deepEqual(value.flags[OUTINGS_FLAG], { park_walk: 91, mukai_help: 4, park_walk_day: 5, park_walk_night: 5 });
  assert.equal(value.stamina, stamina);
  assert.equal(value.money, money);
}
console.log("PASS: park day/night rotation, old saves, SAVE/LOAD and duplicate completion");
