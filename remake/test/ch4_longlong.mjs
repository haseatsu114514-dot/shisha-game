// 龍龍水煙所のドバイの店（2026-11-02 オーナー「ドバイ編でマスターフーカーの店に行けたり」「普通に他の章のライバルと同じ扱い」）。
// 段階の会話の順・必要ハート・好感度のつり合い（5回で♥5）・記録・周回、台本（名乗り・面識・大会後の分岐・人物の決まり）、
// 前夜祭の面識の分岐（交流の時系列ルール）。実際の画面の流れは remake/test/browser/ch4_dubai_daily.mjs。
// node remake/test/ch4_longlong.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { newState, setState } from "../js/core/state.js";
import { gainAffinity, affinityLevel, visitAffinity } from "../js/core/stats.js";
import { LONGLONG_VISIT_STORIES, pendingAffinityStage } from "../js/core/affinity-stages.js";
import { LONGLONG_FLAG, LONGLONG_CHAR, LONGLONG_TALKS, LONGLONG_IDS, LONGLONG_LOAD_IDS, LONGLONG_FINALE, LONGLONG_BG, longlongRecord, nextLonglongVisit,
  longlongHasNew, longlongStoriesDone, recordLonglongVisit } from "../js/chapters/ch4-longlong.js";
import { classifyFlag, flagVerdict } from "../js/core/carry.js";
import { CHAR_TYPE } from "../js/core/growth-board-data.js";
import { tournamentFinished } from "../js/core/story-context.js";

const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
const json = rel => JSON.parse(read(rel));
const shop = Object.fromEntries(json("../../data/dialogue/ch4_longlong.json").dialogues.map(d => [d.dialogue_id, d]));
const main = Object.fromEntries(json("../../data/dialogue/ch4_main.json").dialogues.map(d => [d.dialogue_id, d]));
const manifest = json("../data/manifest.json");
const flavors = new Set(json("../../data/flavors.json").flavors.map(f => f.id));
const linesOf = d => [...(d.lines || []), ...Object.values(d.branches || {}).flat()];

// ---- 段階の会話（必要ハートに届いた最古の未読を一訪問一本）----------------------------------------
assert.deepEqual(LONGLONG_VISIT_STORIES.map(e => [e.scene, e.heart]), [
  ["ch4_longlong_first", 0], ["ch4_longlong_second", 1], ["ch4_longlong_third", 2], ["ch4_longlong_fourth", 3], ["ch4_longlong_fifth", 4]]);
assert.deepEqual([...LONGLONG_IDS], [...LONGLONG_VISIT_STORIES.map(e => e.scene), ...LONGLONG_TALKS]);
assert.deepEqual([...LONGLONG_LOAD_IDS], [...LONGLONG_IDS, LONGLONG_FINALE]);
assert.equal(LONGLONG_CHAR, "master_hookah");
assert.equal(LONGLONG_BG, "bg_longlong_shop", "Longlong visits use the adopted shop interior");
assert(manifest.backgrounds.includes(`${LONGLONG_BG}.png`), "shop background is registered");
assert(manifest.webp.includes(`backgrounds/${LONGLONG_BG}.png`), "shop background uses the display WebP");
const value = { day: 50, flags: {} };
assert.deepEqual(longlongRecord(value), { read: {}, talks: 0 });
assert.deepEqual(nextLonglongVisit(value, 0), { id: "ch4_longlong_first", kind: "story" });
assert.equal(longlongHasNew(value, 0), true);
const before = structuredClone(value);
nextLonglongVisit(value, 3); longlongHasNew(value, 3);
assert.deepEqual(value, before, "選ぶだけでは保存を変えない");
assert.equal(recordLonglongVisit(value, { id: "nope", kind: "story" }), false);
assert(recordLonglongVisit(value, nextLonglongVisit(value, 0)));
assert.deepEqual(nextLonglongVisit(value, 0), { id: "ch4_longlong_visit_b", kind: "talk" }, "♥が足りない段階は飛ばさず、小会話");
assert.equal(longlongHasNew(value, 0), false);
assert.deepEqual(nextLonglongVisit(value, 1), { id: "ch4_longlong_second", kind: "story" });
recordLonglongVisit(value, { id: "ch4_longlong_visit_b", kind: "talk" });
assert.deepEqual(longlongRecord(value), { read: { ch4_longlong_first: true }, talks: 1 });
assert.deepEqual(nextLonglongVisit(value, 0), { id: "ch4_longlong_visit_c", kind: "talk" }, "小会話は順に巡回");
value.flags[LONGLONG_FLAG] = "broken";
assert.deepEqual(longlongRecord(value), { read: {}, talks: 0 }, "壊れた記録は空として読む");
assert.equal(classifyFlag(LONGLONG_FLAG), "progression");
assert.equal(flagVerdict(LONGLONG_FLAG), "reset", "周回では持ち越さない");

// ---- 好感度のつり合い: ほかの章のライバルの店と同じ値で、5回通うと♥5（段階 +16、通い +8）-----------------
{
  const s = newState();
  Object.assign(s, { chapter: 4, day: 50 });
  s.stats.charm = 10; // 魅力の上乗せなしでも届く
  setState(s);
  const levels = [];
  for (let visit = 0; visit < 5; visit++) {
    const next = nextLonglongVisit(s, affinityLevel(LONGLONG_CHAR));
    assert.equal(next.kind, "story", `visit ${visit + 1} reads a stage`);
    assert.equal(next.id, LONGLONG_VISIT_STORIES[visit].scene);
    recordLonglongVisit(s, next);
    gainAffinity(LONGLONG_CHAR, visitAffinity("story"));
    levels.push(affinityLevel(LONGLONG_CHAR));
  }
  assert.deepEqual(levels, [1, 2, 3, 4, 5], "5回の来店で♥5（ほかの章のライバルと同じ）");
  assert(longlongStoriesDone(s));
  assert.equal(pendingAffinityStage(s, LONGLONG_CHAR), null, "段階の会話はすべて済んだ");
  assert.deepEqual(nextLonglongVisit(s, 5), { id: "ch4_longlong_visit_b", kind: "talk" }, "後は通いの小会話");
  assert.equal(visitAffinity("story"), 16); assert.equal(visitAffinity("talk"), 8);
  const fresh = newState();
  assert.equal(pendingAffinityStage(fresh, LONGLONG_CHAR).scene, "ch4_longlong_first");
}
assert.equal(CHAR_TYPE.master_hookah, "sense", "♥5の色の火種は授業 M-S7 と同じ感覚盤");

// ---- 台本 -------------------------------------------------------------------------------
for (const id of LONGLONG_IDS) {
  const d = shop[id];
  assert(d?.lines?.length >= 5, `${id} の台本`);
  for (const line of linesOf(d)) {
    if (!line.text) continue;
    if (line.speaker === "master_hookah") {
      assert(!/(じゃ|わし|のう)$|わし[はがも]/.test(line.text), `${id}: 王煙楼は老人語にしない: ${line.text}`);
      assert(!/俺|僕/.test(line.text), `${id}: 王煙楼の一人称は私: ${line.text}`);
    }
    assert(!/煙楼先生|スミさんの弟子|旧友/.test(line.text), `${id}: 呼び名・関係の決まり: ${line.text}`);
    assert(!/シェイク|旅装|弟子/.test(line.text), `${id}: シェイクの師であることは大会まで出さない: ${line.text}`);
    assert(!/ライチ/.test(line.text), `${id}: ライチの話は前夜祭の味の会話`);
    assert(!/【(技術|センス|根性|魅力|洞察)】/.test(line.text), "能力の報酬文を書かない");
  }
  assert(!linesOf(d).some(line => ["sheikh", "traveler"].includes(line.speaker)), id);
}
// 初来店: 会っていなければここで名乗って面識（登場カットイン）。会っていれば名乗りを繰り返さない。
const first = shop.ch4_longlong_first;
const metCheck = first.lines.find(line => line.type === "condition");
assert.deepEqual([metCheck.condition_type, metCheck.char_id, metCheck.next_true, metCheck.next_false], ["met", "master_hookah", "familiar", "first_meeting"]);
assert.equal(first.branches.first_meeting[0].type, "set_flag");
assert.equal(first.branches.first_meeting[0].flag, "_met_master_hookah", "名乗りの前に面識");
assert(first.branches.first_meeting.some(line => /王煙楼だ/.test(line.text || "")), "名乗る");
assert(!first.branches.familiar.some(line => /王煙楼だ/.test(line.text || "") || line.type === "set_flag"), "顔見知りには名乗らない");
for (const [id, d] of [["first", first.branches.first_meeting], ["fifth", shop.ch4_longlong_fifth.lines]]) {
  const after = d.find(line => line.condition_type === "tournament_finished");
  assert(after, `${id}: 大会に触れる行は大会前／大会後で分ける`);
  assert.equal(after.tournament_chapter, 4);
  const branches = id === "first" ? first.branches : shop.ch4_longlong_fifth.branches;
  assert(branches[after.next_true]?.length && branches[after.next_false]?.length, id);
  assert(!branches[after.next_true].some(line => /出ます|手加減しない|台の前で会う/.test(line.text || "")), `${id}: 大会後に大会前の台詞を話さない`);
}
assert.equal(tournamentFinished({ chapter: 4, phase: "daily" }, 4), false);
assert.equal(tournamentFinished({ chapter: 4, phase: "aftermath" }, 4), true);
assert.equal(tournamentFinished({ chapter: 5, phase: "daily" }, 4), true);
assert.deepEqual(Object.keys(first.metadata.flavor_lesson), ["jasmine"]);
for (const id of Object.keys(first.metadata.flavor_lesson)) assert(flavors.has(id));
// 中国の水煙の話（水煙袋）。水の役割は「煙を冷やす」だけ（濾過・除去と言わない）。
const pipe = shop.ch4_longlong_second.lines.map(line => line.text).join("");
assert(pipe.includes("水煙袋") && pipe.includes("冷やす") && !/濾過|有害|除去/.test(pipe));

// ---- 前夜祭の面識の分岐（交流の時系列ルール）----------------------------------------------------
const reception = main.ch4_wang_reception;
const firstCondition = reception.lines.find(line => line.type === "condition");
assert.deepEqual([firstCondition.condition_type, firstCondition.char_id, firstCondition.next_true, firstCondition.next_false],
  ["met", "master_hookah", "met_at_shop", "first_sight"], "先に店で会っていれば顔見知りの分岐");
const setFlagAt = reception.lines.findIndex(line => line.type === "set_flag" && line.flag === "_met_master_hookah");
assert(setFlagAt > reception.lines.indexOf(firstCondition), "面識の判定は、前夜祭で面識を付ける前");
assert.deepEqual(reception.branches.first_sight.filter(line => line.type === "condition")
  .map(({ condition_type, flag, next_true, next_false }) => [condition_type, flag, next_true, next_false]),
  [["flag", "_ch2_city_visit_c_station", "seen_on_monitor", "heard_only"]], "日本語の説明後も、モニターの既読で初登場を分ける");
for (const key of ["seen_on_monitor", "heard_only"]) assert(reception.branches[key]?.length, key);
assert(reception.branches.met_at_shop.some(line => line.speaker === "master_hookah" && /店の時/.test(line.text)), "店で会ったことに触れる");
assert(!reception.branches.met_at_shop.some(line => /名前だけは|モニターで見た/.test(line.text || "")), "顔見知りに初対面の地の文を出さない");
assert.deepEqual(reception.metadata, { forced_event: true, flavor_lesson: { lychee: 1 } }, "前夜祭は今までどおり熟練度だけ（強制イベントなので好感度なし）");

// ---- ドバイの地図・代金・読み込み --------------------------------------------------------------
const daily = read("../js/chapters/ch4-dubai-daily.js");
assert.match(daily, /id: "ch4_dubai_longlong", place: "longlong", label: "龍龍水煙所"[^}]*x: 58, y: 50[^}]*face: LONGLONG_CHAR[^}]*cost: 6000, stamina: -12, stat: "insight"/,
  "龍龍水煙所は最初から地図に出て、一台6,000円（専門店）");
assert.match(daily, /readDialogues\("ch4_longlong", LONGLONG_LOAD_IDS\)/);
assert.match(daily, /finaleAtVisit\(LONGLONG_CHAR\)/);
assert.match(daily, /playFinale\(LONGLONG_CHAR/);
assert(shop[LONGLONG_FINALE]?.lines?.length, "♥5の締めくくりの台本がある");
assert.equal(shop[LONGLONG_FINALE].metadata?.bond_finale, "master_hookah");
assert.match(daily, /gainAffinity\(LONGLONG_CHAR, visitAffinity\(longlong\.kind === "story" \? "story" : "talk"\)\)/);
assert.doesNotMatch(daily, /longlong: "master_hookah"|teacher.*longlong/, "授業（龍の煙）は大会後の会場の台詞なので、店では相談しない");
// IR23: FESTA の太陽も、来店ごとに通いの小会話と同じ値（visitAffinity。第4章は +8）。♥5の授業（フェスタの煙）に届く
assert.match(daily, /if \(entry\.place === "festa"\) gainAffinity\("da_silva", visitAffinity\("talk"\)\)/);
assert.doesNotMatch(daily, /gainAffinity\("da_silva", \d/, "no fixed number for Taiyo");

console.log("PASS ch4 Longlong Dubai shop: stages, hearts, records, scripts, eve-of-tournament acquaintance branch");
