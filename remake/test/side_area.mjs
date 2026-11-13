// 左右の余白（YHK）の決まり: 余白の幅の段、縦書きの帯に出す言葉、漢数字。画面を使わない部分だけを確かめる。
// 置き場所・ボタンの動きは remake/test/browser/side_area.mjs。
import assert from "node:assert/strict";
import { SIDE_MIN, sideTier, kanjiNumber, stripInfo } from "../js/core/side-area.js";
import { fitStage, onStageFit } from "../js/core/stage-fit.js";

// 段: 主流のスマホ（19:9＝120・19.5:9＝140・20:9＝160）は wide、18:9（80）は mid、16:9（0）は none
assert.deepEqual([0, 19, 20, 59, 60, 80, 117, 118, 120, 140, 160, 289].map(sideTier),
  ["none", "none", "narrow", "narrow", "mid", "mid", "mid", "wide", "wide", "wide", "wide", "wide"]);
const gutter = (ratio) => (720 * ratio - 1280) / 2; // ステージ上の px・片側
assert.equal(sideTier(gutter(16 / 9)), "none");
assert.equal(sideTier(gutter(18 / 9)), "mid");
for (const ratio of [19 / 9, 19.5 / 9, 20 / 9, 21 / 9]) assert.equal(sideTier(gutter(ratio)), "wide", String(ratio));
// ボタン（88px）が余白に収まる幅から wide にする
assert(SIDE_MIN.wide >= 88 + 14 * 2);

assert.deepEqual([0, 1, 5, 9, 10, 11, 14, 20, 23, 99, 100].map(kanjiNumber),
  ["〇", "一", "五", "九", "十", "十一", "十四", "二十", "二十三", "九十九", "100"]);

const base = { chapter: 1, day: 5, slot: 0, phase: "daily", flags: {} };
// 遊んでいる最中ではない画面・状態が無い時は出さない
for (const screen of ["boot", "title", "staff-roll", "end", "ch2-loading", "ch3-aftermath-loading", "", undefined]) {
  assert.equal(stripInfo(base, screen), null, String(screen));
}
assert.equal(stripInfo(null, "map"), null);
// 日常: 章・街・日付と時間帯
assert.deepEqual(stripInfo(base, "map"), { chapter: "第一章", city: "橙須", when: "五日目・昼" });
assert.deepEqual(stripInfo({ ...base, slot: 1 }, "none"), { chapter: "第一章", city: "橙須", when: "五日目・夜" });
assert.deepEqual(stripInfo({ ...base, slot: 2 }, "home"), { chapter: "第一章", city: "橙須", when: "五日目・夜" });
// 大会当日・日常以外（プロローグ・大会後）は時間帯を付けない
assert.equal(stripInfo({ ...base, day: 14, phase: "tournament" }, "none").when, "大会当日");
assert.equal(stripInfo({ ...base, day: 1, phase: "opening" }, "none").when, "一日目");
// 第2章: 章内の日付と、今いる街（HUD の札と同じ）
const ch2 = { chapter: 2, day: 17, slot: 0, phase: "daily", flags: { _ch2_day1: { startDay: 15 }, _ch2_region: "widehanga" } };
assert.deepEqual(stripInfo(ch2, "map"), { chapter: "第二章", city: "柚ヶ谷", when: "三日目・昼" });
assert.equal(stripInfo({ ...ch2, flags: { ...ch2.flags, _ch2_region: "home" } }, "map").city, "橙須");
// 第3章の出発前の準備期間と、東京。第4章のドバイ
const prep = { chapter: 3, day: 30, slot: 1, phase: "daily", flags: { _ch3_prep: { startDay: 29, days: 3 }, _ch2_region: "home" } };
assert.deepEqual(stripInfo(prep, "map"), { chapter: "第三章", city: "橙須", when: "出発前二日目" });
assert.equal(stripInfo({ chapter: 3, day: 33, slot: 0, phase: "daily", flags: { _ch3_intro: { startDay: 32 }, _ch2_region: "tokyo" } }, "none").city, "東京");
assert.equal(stripInfo({ chapter: 4, day: 50, slot: 0, phase: "daily", flags: { _ch4: { startDay: 47 }, _ch2_region: "dubai" } }, "none").city, "ドバイ");
// 帯は1列。いちばん長い組み合わせでも字数が増えすぎない（章3字＋街3字＋日付7字）
assert(stripInfo({ ...prep, day: 31 }, "map").when.length <= 7);

// 画面の当て直しの通知: 余白の層は、ここで倍率とステージを受け取る
const calls = [];
const off = onStageFit((detail) => calls.push(detail));
const props = new Map();
const stage = { style: { setProperty: (k, v) => props.set(k, v), removeProperty: (k) => props.delete(k) }, dataset: {} };
globalThis.window = { visualViewport: { width: 852, height: 393 }, innerWidth: 852, innerHeight: 393 };
globalThis.document = { documentElement: { dataset: {} } };
const k = fitStage(stage);
assert.equal(calls.length, 1);
assert.equal(calls[0].stage, stage);
assert.equal(calls[0].k, k);
assert.equal(calls[0].region, null);
off();
fitStage(stage);
assert.equal(calls.length, 1);

console.log("side_area ok");
