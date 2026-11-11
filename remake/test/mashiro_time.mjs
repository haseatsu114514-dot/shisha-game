// 恋人のましろと mukai で過ごす時間（BLC03）: 一日に一度・短い場面の巡回・デートと同じ絆・節目を Lv5 まで読めること。
// node remake/test/mashiro_time.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import { releaseLoveAffinity, AFFINITY_RANK_PTS } from "../js/core/stats.js";
import { MASHIRO_TIME_FILE, MASHIRO_TIME_FLAG, MASHIRO_TIME_SCENES, MASHIRO_TIME_BOND, mashiroTimeOpen, mashiroTimeScene,
  mashiroTimeSpentToday, spendMashiroTime } from "../js/chapters/mashiro-time.js";
import { CH3_STORY_DIALOGUE_FILES } from "../js/chapters/ch3-story-wiring.js";
import { classifyFlag } from "../js/core/carry.js";

const json = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const scenes = Object.fromEntries(json(`../../data/dialogue/${MASHIRO_TIME_FILE}.json`).dialogues.map(d => [d.dialogue_id, d]));
const milestones = Object.fromEntries(json("../../data/dialogue/lover_events.json").dialogues.map(d => [d.dialogue_id, d]));

// ---- 台本: 4本とも私的な場面。報酬・分岐を持たず、第3章でも第5章でも読める文にする ---------------
assert.equal(MASHIRO_TIME_SCENES.length, 4);
for (const id of MASHIRO_TIME_SCENES) {
  const scene = scenes[id];
  assert(scene?.lines?.length >= 8, `${id}: 台本がある`);
  assert.equal(scene.metadata?.private_scene, true, `${id}: 私的な場面`);
  assert(scene.lines.every(line => !line.type), `${id}: 報酬・分岐・旗を持たない（絆は呼び出し側が一度だけ足す）`);
  assert(scene.lines.every(line => ["", "mashiro", "hajime"].includes(line.speaker)), `${id}: 二人だけ`);
  const all = scene.lines.map(line => line.text).join("");
  assert(!/大会|優勝|決勝|予選|博士|ドバイ|帰る日|味が|味は/.test(all), `${id}: 章と時期を決める言葉を入れない`);
  assert(scene.lines.some(line => line.speaker === "mashiro" && /僕/.test(line.text)) || /ましろちゃん/.test(all), `${id}: ましろの一人称・呼び方`);
}
assert(MASHIRO_TIME_SCENES.every(id => CH3_STORY_DIALOGUE_FILES[MASHIRO_TIME_FILE].includes(id)), "第3章の読み込み一覧に入っている");
{
  const ch5 = text("../js/chapters/ch5-tokyo.js"), ch3 = text("../js/chapters/ch3-tokyo-daily.js");
  assert.match(ch5, /readDialogues\(MASHIRO_TIME_FILE, MASHIRO_TIME_SCENES\)/, "第5章の東京でも台本を読み込む");
  assert.match(ch5, /mashiroTimeOpen\(state, \{ milestoneDue: mashiroMilestoneDue\(\) \}\)/);
  assert.match(ch3, /mashiroTimeOpen\(state, \{ milestoneDue: mashiroMilestoneDue\(\) \}\) \? "lover"/);
  assert.match(ch3, /if \(kind !== "lover"\) gainAffinity\("mashiro", 5\)/, "恋人の時間の絆は部品の側だけが足す");
}
assert.equal(classifyFlag(MASHIRO_TIME_FLAG), "person");

// ---- 進行: 実物の state・stats で、交際の初日から Lv5 の節目まで ---------------------------------
Object.assign(DB.dialogues, scenes, milestones);
function lover(extra = {}) {
  const value = newState();
  Object.assign(value, { chapter: 3, day: 40, slot: 1, lovers: ["mashiro"], contacts: ["mashiro"], loverEventsSeen: [] }, extra);
  value.loveLevel.mashiro = 1; value.lovePts.mashiro = AFFINITY_RANK_PTS[1];
  setState(value);
  return value;
}
// chapters/lover-entry.js と同じ決まり（今の絆Lvまでの最初の未読。読んだら保留の絆を解放）を、端末の画面なしで再現する。
const io = (value, log) => {
  const next = () => {
    for (let n = 1; n <= Math.min(5, value.loveLevel.mashiro || 0); n++) if (!value.loverEventsSeen.includes(`lover_mashiro_lv${n}`)) return `lover_mashiro_lv${n}`;
    return null;
  };
  return {
    read: async scene => { log.push(scene); return true; },
    milestoneDue: () => !!next(),
    readMilestone: async () => { const id = next(); if (!id) return false; value.loverEventsSeen.push(id); log.push(id); releaseLoveAffinity("mashiro"); return true; },
  };
};
{
  const value = lover(), log = [], port = io(value, log);
  assert(mashiroTimeOpen(value, { milestoneDue: port.milestoneDue() }));
  // 1日目: 交際の最初の節目から。短い場面は挟まず、絆は一日分だけ入る。
  assert.equal(await spendMashiroTime(port), true);
  assert.deepEqual(log, ["lover_mashiro_lv1"]);
  assert.equal(value.lovePts.mashiro, AFFINITY_RANK_PTS[1] + MASHIRO_TIME_BOND / 2, "デート1回と同じ量（恋人の絆は半分）");
  assert.deepEqual(value.flags[MASHIRO_TIME_FLAG], { count: 0, day: 40 });
  assert(mashiroTimeSpentToday(value));
  assert(!mashiroTimeOpen(value, { milestoneDue: port.milestoneDue() }), "同じ日は二度過ごせない");
  assert.equal(await spendMashiroTime(port), false);
  assert.equal(value.lovePts.mashiro, AFFINITY_RANK_PTS[1] + MASHIRO_TIME_BOND / 2, "断られた回で絆は増えない");
  // 2日目から: 短い場面を巡回で読み、絆が次の段に届いた日は節目を続けて読む。
  let days = 1;
  while (!value.loverEventsSeen.includes("lover_mashiro_lv5")) {
    value.day++; days++;
    assert(days <= 16, `Lv5 の節目まで ${days} 日を超えた`);
    assert(mashiroTimeOpen(value, { milestoneDue: port.milestoneDue() }), `day ${days}`);
    assert.equal(await spendMashiroTime(port), true, `day ${days}`);
  }
  assert.deepEqual(value.loverEventsSeen, [1, 2, 3, 4, 5].map(n => `lover_mashiro_lv${n}`), "節目は前の段から順に");
  assert.equal(value.loveLevel.mashiro, 5);
  const times = log.filter(id => MASHIRO_TIME_SCENES.includes(id));
  assert.deepEqual(times.slice(0, 5), [...MASHIRO_TIME_SCENES, MASHIRO_TIME_SCENES[0]], "短い場面は巡回する");
  assert.equal(times.length, days - 1, "節目から始めた初日を除き、一日に一本");
  assert.equal(value.flags[MASHIRO_TIME_FLAG].count, times.length);
  console.log(`  交際の初日から Lv5 の節目まで ${days} 日（一日に一度）`);
}
// 途中でやめた回は、回数も絆も日付も残さない。次に同じ場面から読める。
{
  const value = lover({ loverEventsSeen: ["lover_mashiro_lv1"] }), log = [], port = io(value, log);
  const before = value.lovePts.mashiro, scene = mashiroTimeScene(value);
  assert.equal(await spendMashiroTime({ ...port, read: async () => false }), false);
  assert.equal(value.flags[MASHIRO_TIME_FLAG], undefined);
  assert.equal(value.lovePts.mashiro, before);
  assert.equal(mashiroTimeScene(value), scene);
  assert.equal(await spendMashiroTime(port), true);
  assert.deepEqual(log, [scene]);
}
// 恋人でない・話し合いが済んでいない・台本が読めていない時は出さない。壊れた保存値は初回として読む。
{
  const friend = lover({ lovers: [] });
  assert(!mashiroTimeOpen(friend)); assert(!mashiroTimeOpen(friend, { milestoneDue: true }));
  const hurt = lover(); hurt.flags._story_shuraba_unresolved = true;
  assert(!mashiroTimeOpen(hurt, { milestoneDue: true }));
  for (const bad of [null, 3, "x", [], { count: -2, day: "a" }, { count: 1.5 }]) {
    const value = lover(); value.flags[MASHIRO_TIME_FLAG] = bad;
    assert.equal(mashiroTimeScene(value), MASHIRO_TIME_SCENES[0]);
    assert(mashiroTimeOpen(value));
  }
  const value = lover(), kept = DB.dialogues[MASHIRO_TIME_SCENES[0]];
  delete DB.dialogues[MASHIRO_TIME_SCENES[0]];
  assert(!mashiroTimeOpen(value), "台本が無ければ出さない");
  DB.dialogues[MASHIRO_TIME_SCENES[0]] = kept;
}
console.log("PASS mashiro time: once a day, rotating private scenes, date-sized bond, milestones lv1-lv5 reachable, interrupted reads leave nothing");
