// #1045 B05: 本筋DAY9の味覚不調（神崎の苺・試煙会）を、EDENの通常来店会話(ch1_adam_second)へ
// 一言だけ引き継ぐ。DAY9前（_ch2_afsahr_tasting 未設定）は元の文のまま、DAY9後だけ不調の一言が出る。
import assert from "node:assert/strict";
import fs from "node:fs";

const read = (path) => JSON.parse(fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8"));
const adam = Object.fromEntries(read("data/dialogue/ch1_adam.json").dialogues.map((d) => [d.dialogue_id, d]));
const second = adam.ch1_adam_second;
assert(second, "ch1_adam_second が存在する");

// 不調を引き継ぐ縛りは、神崎の試煙会(ch2)で立つフラグと同じものを使う（本筋の不調の後にしか出さない）
const story = read("data/dialogue/ch2_ageha_story.json").dialogues.find((d) => d.dialogue_id === "remake_ch2_ageha_tasting");
assert(story.lines.some((l) => l.type === "set_flag" && l.flag === "_ch2_afsahr_tasting"),
  "試煙会で _ch2_afsahr_tasting が立つ");

// 縛りの位置: 「軽く抜けた」の地の文の直後、「同じ味のはずなのに」の直前に条件がある
const narrIdx = second.lines.findIndex((l) => (l.text || "").includes("前より軽く抜けた"));
const spokenIdx = second.lines.findIndex((l) => (l.text || "").includes("同じ味のはずなのに"));
assert(narrIdx >= 0 && spokenIdx > narrIdx, "地の文と返しの順序");
const cond = second.lines[narrIdx + 1];
assert.equal(cond.type, "condition");
assert.equal(cond.condition_type, "flag");
assert.equal(cond.flag, "_ch2_afsahr_tasting");
assert.equal(cond.next_true, "taste_carryover");
assert.equal(cond.next_false, undefined, "DAY9前は分岐せず元の行へそのまま落ちる");
assert.equal(spokenIdx, narrIdx + 2, "条件は地の文と返しの間に挟む");

// 引き継ぎの一言: 一人称「俺」・味への確信のなさ・香り/抜け方は分かる。診断や完治の断定はしない
const carry = second.branches.taste_carryover;
assert(Array.isArray(carry) && carry.length === 1, "不調の一言は1行だけ（全会話で反復しない）");
const line = carry[0];
assert.equal(line.speaker, "hajime");
assert.match(line.text, /俺/, "一人称は俺");
assert.match(line.text, /確信|味/, "味への確信のなさを受ける");
assert.match(line.text, /抜け|甘さ|香り/, "香り・抜け方は分かる（実力は残す）");
for (const bad of ["病気", "味覚障害", "治った", "完治", "診断"]) assert.doesNotMatch(line.text, new RegExp(bad), `診断・完治を書かない: ${bad}`);
// 全角48字以内（半角0.5換算、（）も全角1字）
const width = [...line.text].reduce((w, ch) => w + (/[\x00-\x7F]/.test(ch) ? 0.5 : 1), 0);
assert(width <= 48, `吹き出し1枚に収まる (${width})`);

// エンジンの handleCondition と同じ挙動を再現して、DAY9前/後のセリフ列を確かめる
const render = (flags) => {
  const queue = [...second.lines];
  const out = [];
  while (queue.length) {
    const l = queue.shift();
    if (l.type === "condition" && l.condition_type === "flag") {
      const ok = !!flags[l.flag];
      const key = ok ? l.next_true : l.next_false;
      if (key && second.branches[key]) queue.unshift(...second.branches[key]);
      continue;
    }
    if (l.speaker !== undefined && l.text !== undefined) out.push(`${l.speaker}:${l.text}`);
  }
  return out;
};

const before = render({});                       // DAY9前（不調が起きていない）
const after = render({ _ch2_afsahr_tasting: true }); // DAY9後（試煙会のあと）
const carryText = `hajime:${line.text}`;

assert(!before.includes(carryText), "DAY9前は不調の一言が出ない（元の文のまま）");
assert(after.includes(carryText), "DAY9後は不調の一言が出る");
// DAY9前は、縛りの一言を足した以外は従来通り（元の列と完全一致）
assert.deepEqual(after.filter((t) => t !== carryText), before, "不調の一言以外は前後で同じ");
// 不調の一言は「軽く抜けた」地の文の後、「同じ味のはずなのに」の前に入る
const ai = after.indexOf(carryText);
assert(after[ai - 1].includes("前より軽く抜けた") && after[ai + 1].includes("同じ味のはずなのに"), "不調の一言の位置");

console.log("ok ch1_adam_taste_carryover");
