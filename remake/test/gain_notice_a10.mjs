// #1081 A10: 成長通知は初回は必ずフル、2回目以降は「見た演出を短く」設定オンのときだけ短くする。
import assert from "node:assert/strict";
import { bannerHold, gainSeenKey } from "../js/core/gain-notice.js";

const stat = { kind: "stat", stat: "sense", points: 2 };
const affinity = { kind: "affinity", sub: "好感度が少し上がった", hearts: { from: [0, 0, 0, 0, 0], to: [50, 0, 0, 0, 0] } };

// 記録の対象は能力の通常加算と好感度の通常加算だけ
assert.equal(gainSeenKey(stat), "_motion_seen_gain_stat_sense");
assert.equal(gainSeenKey({ ...stat, stat: "charm" }), "_motion_seen_gain_stat_charm");
assert.equal(gainSeenKey(affinity), "_motion_seen_gain_affinity");
assert.equal(gainSeenKey({ ...stat, evolution: true }), null);
assert.equal(gainSeenKey({ ...stat, fx: "新しい効果" }), null);
assert.equal(gainSeenKey({ ...affinity, bond: true }), null);
assert.equal(gainSeenKey({ ...affinity, sub: "仲が深まった（♥2）" }), null);
assert.equal(gainSeenKey({ kind: "notice" }), null);

// 初回・設定オフは従来の長さ、短縮は既読＋設定オンのときだけ
assert.equal(bannerHold(stat), 2200);
assert.equal(bannerHold(stat, true), 1200);
assert.equal(bannerHold(affinity), 2600);
assert.equal(bannerHold(affinity, true), 1500);
// 段上がり・新効果は短縮しても常にフル
assert.equal(bannerHold({ ...stat, evolution: true }, true), 4200);
assert.equal(bannerHold({ ...stat, fx: "x" }, true), 3200);
console.log("gain notice A10: PASS");
