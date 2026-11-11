// 交際後の後半の章の場面（BLC08）:
// - 第4章ドバイで、同じ便で来た恋人（同行者）と宿で過ごす時間（chapters/companion-time.js）
// - 第5章の Dr.fookah の2階（凛想・夜だけの通いの小会話。chapters/ch5-shops.js の chapterFiveShowroom）
// - 第5章の地元で、ひよりがよその店に居合わせる（daily/roamers.js）
// node remake/test/companion_time.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState } from "../js/core/state.js";
import { DB } from "../js/core/data.js";
import { AFFINITY_RANK_PTS } from "../js/core/stats.js";
import { OVERSEAS_HEROINES } from "../js/core/overseas-companion.js";
import { COMPANION_TIME_FILE, COMPANION_TIME_FLAG, COMPANION_TIME_IDS, COMPANION_TIME_SCENES, COMPANION_TIME_BOND,
  companionLover, companionTimeOpen, companionTimeScene, spendCompanionTime } from "../js/chapters/companion-time.js";
import { classifyFlag } from "../js/core/carry.js";

const json = rel => JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
const text = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const byId = name => Object.fromEntries(json(`../../data/dialogue/${name}.json`).dialogues.map(d => [d.dialogue_id, d]));
const body = scene => [...scene.lines, ...Object.values(scene.branches || {}).flat()];

// ---- 同行者の場面: 7人×2本。私的な場面で、報酬・分岐を持たず、大会の結果に触れない ----------------
const companion = byId(COMPANION_TIME_FILE);
assert.deepEqual(Object.keys(COMPANION_TIME_SCENES), [...OVERSEAS_HEROINES]);
assert.equal(COMPANION_TIME_IDS.length, OVERSEAS_HEROINES.length * 2);
for (const [who, ids] of Object.entries(COMPANION_TIME_SCENES)) for (const id of ids) {
  const scene = companion[id];
  assert(scene?.lines?.length >= 8, `${id}: 台本がある`);
  assert.equal(scene.metadata?.private_scene, true, `${id}: 私的な場面`);
  assert(scene.lines.every(line => !line.type), `${id}: 報酬・分岐・旗を持たない`);
  assert(scene.lines.some(line => line.speaker === who), `${id}: 同行者が話す`);
  assert(scene.lines.every(line => ["", "hajime", who].includes(line.speaker)), `${id}: 二人だけ`);
  assert.doesNotMatch(scene.lines.map(line => line.text).join(""), /優勝|準優勝|前夜祭|到着|別便|迎えに/, `${id}: 大会前・同じ便の場面`);
}
assert.equal(classifyFlag(COMPANION_TIME_FLAG), "person");
{
  const daily = text("../js/chapters/ch4-dubai-daily.js");
  assert.match(daily, /readDialogues\(COMPANION_TIME_FILE, COMPANION_TIME_IDS\)/, "ドバイの日常で台本を読み込む");
  assert.match(daily, /test: "ch4-inn-companion"/, "宿の選択肢に出る");
  assert.match(daily, /addStamina\(innTrial \|\| withCompanion \? 0/, "同行者と過ごした回は体力が戻らない");
  assert.match(daily, /\|\| companionTimeOpen\(state\)/, "過ごせる日は宿に新着の印");
}

Object.assign(DB.dialogues, companion);
function dubai(lovers = ["minto"], pick = "minto", extra = {}) {
  const value = newState();
  Object.assign(value, { chapter: 4, day: 60, slot: 1, lovers, contacts: [...lovers], loverEventsSeen: [] }, extra);
  for (const id of lovers) { value.loveLevel[id] = 1; value.lovePts[id] = AFFINITY_RANK_PTS[1]; }
  value.flags._overseas_companion = { decided: true, companion: pick, supports: lovers.filter(id => id !== pick) };
  setState(value);
  return value;
}
{
  const value = dubai(), log = [];
  const read = async scene => { log.push(scene); return true; };
  assert.equal(companionLover(value), "minto");
  assert(companionTimeOpen(value));
  assert.equal(await spendCompanionTime({ read }), true);
  assert.deepEqual(log, ["ch4_companion_minto_1"]);
  assert.equal(value.lovePts.minto, AFFINITY_RANK_PTS[1] + COMPANION_TIME_BOND / 2, "デート1回と同じ絆（恋人は半分）");
  assert.deepEqual(value.flags[COMPANION_TIME_FLAG], { read: ["ch4_companion_minto_1"], day: 60 });
  assert(!companionTimeOpen(value), "同じ日は一度だけ");
  assert.equal(await spendCompanionTime({ read }), false);
  value.day++;
  assert.equal(companionTimeScene(value), "ch4_companion_minto_2");
  assert.equal(await spendCompanionTime({ read }), true);
  value.day++;
  assert.equal(companionTimeScene(value), null, "二本で終わり");
  assert(!companionTimeOpen(value));
  assert.deepEqual(log, ["ch4_companion_minto_1", "ch4_companion_minto_2"]);
  assert.deepEqual(value.loverEventsSeen, [], "ドバイでは節目を読まない（IR17）");
}
// 途中でやめた回は何も残さない。同行なし・恋人でない・別の章・話し合い前は出さない。壊れた保存値は空として読む。
{
  const value = dubai(), before = value.lovePts.minto;
  assert.equal(await spendCompanionTime({ read: async () => false }), false);
  assert.equal(value.flags[COMPANION_TIME_FLAG], undefined);
  assert.equal(value.lovePts.minto, before);
  assert(!companionTimeOpen(dubai(["minto"], null)), "同行なし");
  const broke = dubai(); broke.lovers = []; assert(!companionTimeOpen(broke), "恋人でなくなった相手");
  assert(!companionTimeOpen(dubai(["minto"], "minto", { chapter: 5 })), "第4章だけ");
  const hurt = dubai(); hurt.flags._story_shuraba_unresolved = true; assert(!companionTimeOpen(hurt));
  for (const bad of [null, 3, "x", [], { read: "a", day: "b" }, { read: [null, "ch4_companion_rio_1"] }]) {
    const value = dubai(); value.flags[COMPANION_TIME_FLAG] = bad;
    assert.equal(companionTimeScene(value), "ch4_companion_minto_1");
  }
  for (const who of OVERSEAS_HEROINES) assert.equal(companionTimeScene(dubai([who], who)), `ch4_companion_${who}_1`, who);
}

// ---- 第5章の Dr.fookah の2階: 凛想の通いの小会話（夜・会ったことがある時だけ）----------------------
{
  const shops = byId("ch5_shops"), daily = text("../js/chapters/ch5-daily.js"), source = text("../js/chapters/ch5-shops.js");
  for (const id of ["ch5_rio_shop", "ch5_rio_shop_b", "ch5_rio_shop_c"]) {
    const scene = shops[id];
    assert(scene?.lines?.length >= 6, id);
    assert(body(scene).every(line => line.type === undefined || line.type === "condition"), `${id}: 報酬を持たない`);
    assert(body(scene).some(line => line.speaker === "rio"), id);
  }
  // 呼び方は恋人で分ける（恋人ははじめくん・それ以外はモルモットくん）
  const gate = shops.ch5_rio_shop.lines.find(line => line.type === "condition");
  assert.deepEqual([gate.condition_type, gate.char_id], ["lover", "rio"]);
  assert.match(shops.ch5_rio_shop.branches.lover.map(line => line.text).join(""), /はじめくん/);
  assert.match(shops.ch5_rio_shop.branches.friend.map(line => line.text).join(""), /モルモットくん/);
  assert.match(source, /talks: talksOf\("rio_shop"\)/);
  assert.match(source, /\(value\.slot \|\| 0\) >= 1 && known\(value, entry\)/, "夜だけ・会ったことがある時だけ");
  assert.match(daily, /test: "ch5-fookah-showroom"/, "問屋の来店で階を選ぶ");
  assert.doesNotMatch(daily, /2階の相談＝凛想の場面は出さない/);
}

// ---- 第5章の地元: ひよりがよその店に居合わせる（tonari で再会した後）-------------------------------
{
  const roam = byId("roaming_guests"), source = text("../js/daily/roamers.js");
  for (const id of ["roam_hiyori_first", "roam_hiyori_a", "roam_hiyori_b", "roam_hiyori_c"]) {
    const scene = roam[id];
    assert(scene?.lines?.length >= 6, id);
    assert(scene.lines.every(line => !line.type), `${id}: 報酬・分岐を持たない`);
    assert(scene.lines.some(line => line.speaker === "hiyori" && line.inner), `${id}: ひよりの本心がある`);
    assert.doesNotMatch(scene.lines.map(line => line.text).join(""), /店員|店主|マスター/, `${id}: どの店でも合うよう店の人に触れない`);
  }
  assert.match(source, /\{ id: "hiyori", chapters: \[5\], at: shishaShop, ready: value => metStory\("hiyori"\)\(value\) && !!value\.flags\?\._hiyori_tonari_return_done, bond: true \}/);
}
console.log("PASS companion time: Dubai companion scenes once a day (2 each, date-sized bond, no milestones), ch5 Rio showroom talks, ch5 Hiyori roaming");
