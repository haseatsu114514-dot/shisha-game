// 全国大会の講評が調整履歴と前日方針に連動することを、実台本で確認する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjustmentLines, resultLines, defeatLines } from "../js/chapters/ch3-verdict.js";
import { DB } from "../js/core/data.js";
import { temperatureBands } from "../js/craft/temperature-model.js";

const data = JSON.parse(readFileSync(new URL("../../data/dialogue/ch3_main.json", import.meta.url), "utf8"));
const find = id => (data.dialogues || data).find(d => d.dialogue_id === id).lines;
const adj = find("ch3_national_adjustment"), res = find("ch3_national_result");
const text = lines => lines.map(l => l.text).join("\n");
const care = (coals, extra = {}) => ({ coals, ...extra });

// 履歴なし（旧セーブ）は正本のまま
assert.equal(adjustmentLines(adj, null), adj);
assert.equal(resultLines(res, { careHistory: [] }), res);

// S7: 綾取が前夜の告白を突き、はじめは審査席の前で「分からない」まま客に聞く。どちらの調整でも残る
for (const coals of [0, 2]) {
  const lines = adjustmentLines(adj, { careHistory: [care(coals)] });
  const at = id => lines.findIndex(line => line.text === id);
  assert.ok(at("昨日、分からないって言ってたよね。その一口、どう？") >= 0);
  assert.ok(at("……今日も、薄く感じます。だから、聞きます") > at("昨日、分からないって言ってたよね。その一口、どう？"));
  assert.ok(at("熱いか、軽いか。それだけ、教えてください") > at("……今日も、薄く感じます。だから、聞きます"));
}
// 客の返事がどの調整結果でも、CGは返事の直後に消える。
for (const craft of [null, ...[care(0), care(2), care(0, { over: true }), care(1, { under: true })]
  .map(entry => ({ careHistory: [entry] }))]) {
  const lines = adjustmentLines(adj, craft);
  const show = lines.findIndex(line => line.type === "show_cg" && line.cg_id === "cg_ch3_national_ask_customer");
  const answer = lines.findIndex((line, index) => index > show && line.speaker === "customer");
  assert(show > 0 && answer > show);
  assert.equal(lines[show - 1].text, "俺は綾取から目を外し、客へ向き直った。");
  assert.equal(lines[answer + 1].type, "hide_cg");
}
// 教訓の心の声は置かない（全体講評C3）
assert.doesNotMatch(text(adj), /待つって、手を抜くことじゃなかった/);

// 炭を替えなかった: 「待つ」の描写が残り、「動いた！」は出ない
let t = text(adjustmentLines(adj, { careHistory: [care(0)] }));
assert.match(t, /僕の方が待たされた/);
assert.match(t, /軽いけど、嫌な軽さじゃない/);
assert.doesNotMatch(t, /動いた！/);

// 炭を替えた: 待った前提の台詞が消え、替えた判断への反応になる
t = text(adjustmentLines(adj, { careHistory: [care(2)] }));
assert.doesNotMatch(t, /待つって|待たされた|待ち時間/);
assert.match(t, /炭を替え|炭替え/);
assert.match(t, /動いた！/);
assert.match(t, /最初より遠くなったかも/);
assert.doesNotMatch(t, /嫌な軽さじゃない/);

// 客の感想は温度の結果に従う（聞いた直後の答えと、後の感想が食い違わない）
t = text(adjustmentLines(adj, { careHistory: [care(0, { over: true })] }));
assert.match(t, /まだ少し熱い/);
assert.match(t, /少し熱いです/);
assert.doesNotMatch(t, /熱くはないです/);
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

// 「甘い余韻」は提供した一台の甘い印象で言い分ける（#3909。点・票は変えない）。提供の記録が無い旧セーブは今までの一行
{
  const flavors = JSON.parse(readFileSync(new URL("../../data/flavors.json", import.meta.url), "utf8")).flavors;
  DB.flavorById = Object.fromEntries(flavors.map(flavor => [flavor.id, flavor]));
  const served = (mix, at = .5) => {
    const cs = { mix, pullDone: true, careHistory: [care(0), care(0)] };
    const { ideal } = temperatureBands(cs);
    const width = ideal[1] - ideal[0];
    cs.pull = { temp: at === "cold" ? ideal[0] - width : ideal[0] + width * at };
    return cs;
  };
  const sweetLine = craft => resultLines(res, craft, "sweet").find(line => line.speaker === "hajime" && line.text.includes("甘い余韻"))?.text;
  assert.match(sweetLine({ careHistory: [care(0), care(0)] }), /最後の一口まで、そこを見て動けた/);
  assert.match(sweetLine(served({ chocolate: 12 })), /最後の一口まで、そこを見て動けた/);
  assert.match(sweetLine(served({ chocolate: 6, mint: 6 })), /甘さはあと一歩/);
  // チョコは課題の4gだけ、ミントが主役で高めに出す（甘い印象3.4）
  assert.match(sweetLine(served({ chocolate: 4, mint: 8 }, 1)), /狙ったところまで届かなかった/);
  assert.match(sweetLine(served({ chocolate: 12 }, "cold")), /熱が合わず/);
  // 甘さの判定は「甘い余韻」の方針だけ。ほかの方針の一行は配合で変えない
  for (const key of ["aroma", "light"]) {
    assert.equal(text(resultLines(res, served({ chocolate: 4, mint: 8 }), key)), text(resultLines(res, { careHistory: [care(0), care(0)] }, key)));
  }
  for (const craft of [served({ chocolate: 12 }), served({ chocolate: 4, mint: 8 }, 1), served({ chocolate: 12 }, "cold")]) {
    assert.equal(resultLines(res, craft, "sweet").length, res.length + 1);
  }
}

// 敗退: 一度も替えずに負けたら「待てた」ではなく「替えてもよかった」と振り返る
const def = find("ch3_national_defeat");
assert.equal(defeatLines(def, null), def);
assert.match(text(defeatLines(def, { careHistory: [care(0), care(0)] })), /替えてもよかった/);
assert.match(text(defeatLines(def, { careHistory: [care(1), care(0)] })), /待てた気がする/);
console.log("ch3_verdict ok");
