// 第1章の大会の後の夜（ch1_tournament_after）: つむぎの「浮かれて見えた」と、取材・成長の分岐（#1414）。
// もとは「今日の注文」の記録の検査（shift_mix_record.mjs）に同居していた。今日の注文は旧バイトと一緒に廃止した（TFL63）ので、大会の側だけを残す。
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("../../", import.meta.url);
const read = path => fs.readFileSync(new URL(path, root), "utf8");
const tournament = JSON.parse(read("data/dialogue/ch1_tournament.json"));
const after = tournament.dialogues.find(d => d.dialogue_id === "ch1_tournament_after");
assert(after);
// 会話演出の印（[pause] 等。#2828）は表示に出ないので、外して比べる
const lines = after.lines.map(line => (line.text || "").replace(/\[\/?[a-z]+\]/g, ""));
assert(lines.includes("……今日の煙、すごかったです。きれいでした。……でも"));
assert(lines.includes("……最後の方の、はじめさんの顔。少しだけ、浮かれて見えました"));
assert(lines.includes("ドアベルが鳴って、彼女は夜に消えた。浮かれてた？ 優勝した日の、俺の顔が？"));
assert(!lines.some(text => text.includes("濁ってた") || text.includes("優勝した日の煙が")));
for (const flag of ["_met_tsumugi", "_tsumugi_contest_submitted"]) {
  assert(after.lines.some(line => line.type === "condition" && line.condition_type === "flag" && line.flag === flag));
}
for (const branch of ["ta_tsumugi_named", "ta_tsumugi_unnamed", "ta_tsumugi_today", "ta_tsumugi_no_draft", "ta_growth_echo", "iv_pride", "iv_honest"]) {
  assert(Array.isArray(after.branches[branch]), branch);
}
console.log("tournament after-night feedback: OK");
