import assert from "node:assert/strict";
import fs from "node:fs";
import { DB } from "../js/core/data.js";
import { temperatureBands } from "../js/craft/temperature-model.js";
import { judgeNaruMatch, naruMatchReviewLines, NARU_MATCH_BASELINE, NARU_MATCH_DRAW_MARGIN } from "../js/chapters/naru-match.js";

// #1089 DAY7 なる戦: 実制作の値となるの基準点で勝ち／負け／引分けが決まり、講評の内容が変わること。
DB.flavorById = { lemon: { short_name: "AF レモン", heat_tolerance: 1 } };
const dialogues = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/remake_ch1.json", import.meta.url))).dialogues;
const review = dialogues.find(d => d.dialogue_id === "remake_naru_match_review");
const invite = dialogues.find(d => d.dialogue_id === "remake_naru_match_invite");
assert(review && invite);

const base = { chapter: 1, mix: { lemon: 10 }, pack: "normal" };
const b = temperatureBands(base);
const run = (score, { heat = score, temp = b.center } = {}) => judgeNaruMatch(
  { ...base, holes: { score }, heat: { score: heat }, pull: { temp }, careHistory: [{ score }, { score }] },
  { craftQuality: score });

const { total } = NARU_MATCH_BASELINE;
assert.equal(run(total + NARU_MATCH_DRAW_MARGIN).result, "win");
assert.equal(run(total + NARU_MATCH_DRAW_MARGIN - 1).result, "draw");
assert.equal(run(total).result, "draw");
assert.equal(run(total - NARU_MATCH_DRAW_MARGIN + 1).result, "draw");
assert.equal(run(total - NARU_MATCH_DRAW_MARGIN).result, "lose");
assert.equal(run(95).score, 95);

// 熱の軸はなるの熱の基準点と比べる。総合と別に動く。
assert.equal(run(90, { heat: NARU_MATCH_BASELINE.heat }).heat, "hajime");
assert.equal(run(90, { heat: NARU_MATCH_BASELINE.heat - 1 }).heat, "naru");
// 提供時の温度は共有の良好帯で読む。
assert.equal(run(80).served, "ideal");
assert.equal(run(80, { temp: b.ideal[1] + 0.03 }).served, "hot");
assert.equal(run(80, { temp: b.ideal[0] - 0.03 }).served, "cold");
assert.equal(judgeNaruMatch({ ...base, holes: { score: 80 }, heat: { score: 80 }, careHistory: [] }, { craftQuality: 80 }).served, "unknown");
// 提供前の失敗は負け。講評へは進む。
assert.deepEqual(judgeNaruMatch({ failed: "burnt" }), { result: "lose", score: 0, heat: "failed", served: "unknown", failed: true });

// 結果ごとに講評が変わり、どの組み合わせでも分岐が実在する。
const text = match => naruMatchReviewLines(review, match).map(l => l.text).filter(Boolean).join("\n");
const seen = new Set();
for (const result of ["win", "draw", "lose"]) for (const heat of ["hajime", "naru"]) for (const served of ["ideal", "hot", "cold", "unknown"]) {
  const match = { result, heat, served, failed: false };
  for (const key of [`heat_${heat}`, `served_${served}`, `result_${result}`, `naru_${result}`]) assert(Array.isArray(review.branches[key]), key);
  seen.add(text(match));
}
assert.equal(seen.size, 3 * 2 * 3 + 3 * 2, "勝敗・熱・提供の違いが講評に出る（unknown は提供の行なし）");
const failed = text(judgeNaruMatch({ failed: "burnt" }));
assert.match(failed, /焦がした台/); assert.match(failed, /今日の一台は、なるだ/);
assert.match(text({ result: "win", heat: "hajime", served: "ideal" }), /今日の一台は、はじめだ/);
assert.match(text({ result: "draw", heat: "naru", served: "hot" }), /引分け/);
// なるが店を出てからスミさんが締める。報酬は従来のDAY7と同じ洞察+2の一度だけ。
for (const result of ["win", "draw", "lose"]) {
  const lines = naruMatchReviewLines(review, { result, heat: "naru", served: "ideal" });
  const left = lines.findIndex(l => /店を出ていった/.test(l.text || ""));
  assert(left > 0);
  assert(lines.slice(left + 1).every(l => l.speaker !== "naru"), "退店後になるは話さない");
  assert(lines.slice(left + 1).some(l => l.speaker === "sumi"));
  assert.deepEqual(lines.filter(l => l.type === "apply").map(l => l.stats), [{ insight: 2 }]);
}
// 誘いは面識の有無で分かれ、初対面なら面識を記録する。
assert(invite.branches.new.some(l => l.type === "set_flag" && l.flag === "_met_naru"));
assert(invite.lines.some(l => l.type === "condition" && l.flag === "_met_naru"));
console.log("naru_match: ok");
