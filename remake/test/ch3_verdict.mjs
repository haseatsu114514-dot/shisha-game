// 全国大会の講評が調整履歴と前日方針に連動することを、実台本で確認する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjustmentLines, resultLines, defeatLines } from "../js/chapters/ch3-verdict.js";

const data = JSON.parse(readFileSync(new URL("../../data/dialogue/ch3_main.json", import.meta.url), "utf8"));
const find = id => (data.dialogues || data).find(d => d.dialogue_id === id).lines;
const adj = find("ch3_national_adjustment"), res = find("ch3_national_result");
const text = lines => lines.map(l => l.text).join("\n");
const care = (coals, extra = {}) => ({ coals, ...extra });

// 履歴なし（旧セーブ）は正本のまま
assert.equal(adjustmentLines(adj, null), adj);
assert.equal(resultLines(res, { careHistory: [] }), res);

// 炭を替えなかった: 「待つ」の描写が残り、「動いた！」は出ない
let t = text(adjustmentLines(adj, { careHistory: [care(0)] }));
assert.match(t, /待つって、手を抜くことじゃなかった/);
assert.doesNotMatch(t, /動いた！/);

// 炭を替えた: 待った前提の台詞が消え、替えた判断への反応になる
t = text(adjustmentLines(adj, { careHistory: [care(2)] }));
assert.doesNotMatch(t, /待つって|待たされた|待ち時間/);
assert.match(t, /炭を替え|炭替え/);
assert.match(t, /動いた！/);

// 客の感想は温度の結果に従う
assert.match(text(adjustmentLines(adj, { careHistory: [care(0, { over: true })] })), /まだ少し熱い/);
assert.match(text(adjustmentLines(adj, { careHistory: [care(1, { under: true })] })), /まだ少し薄い/);

// 決着: 一度でも替えたら「炭は動かなかった」を言わない
for (const history of [[care(1), care(0)], [care(0), care(3)]]) {
  t = text(resultLines(res, { careHistory: history }));
  assert.doesNotMatch(t, /炭は動かなかった|客の一口を待てました/);
  assert.match(t, /炭を替えた/);
}
t = text(resultLines(res, { careHistory: [care(0), care(0)] }));
assert.match(t, /君の炭は動かなかった/);

// 前日方針は決着の振り返りに返る（数値には影響しない）
for (const key of ["aroma", "light", "sweet"]) {
  const lines = resultLines(res, { careHistory: [care(0), care(0)] }, key);
  assert.equal(lines.length, res.length + 1);
}
assert.equal(resultLines(res, { careHistory: [care(0), care(0)] }, undefined).length, res.length);

// 敗退: 一度も替えずに負けたら「待てた」ではなく「替えてもよかった」と振り返る
const def = find("ch3_national_defeat");
assert.equal(defeatLines(def, null), def);
assert.match(text(defeatLines(def, { careHistory: [care(0), care(0)] })), /替えてもよかった/);
assert.match(text(defeatLines(def, { careHistory: [care(1), care(0)] })), /待てた気がする/);
console.log("ch3_verdict ok");
