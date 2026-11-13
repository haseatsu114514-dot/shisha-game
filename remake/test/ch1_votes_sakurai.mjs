// 第1章の桜井式の審査（試作・SKR04）: 1回ごとの勝負・審査員の見る所・攻めの帯・千須の最後の1点・方式の切替。
import assert from "node:assert/strict";
import { beginCh1Votes, castCh1Votes, isSakuraiVotes, sakuraiMine, sakuraiRival, SAKURAI,
  CH1_JUDGES, CH1_CONTESTANTS, CH1_VOTE_VERSION, CH1_SAKURAI_VERSION } from "../js/craft/ch1-votes.js";
import { ATTACK_BAND, attackGuide, attackRange, inAttackRange, attackScore } from "../js/craft/attack-band.js";
import { voteStyleFrom, voteStyleForCraftVersion } from "../js/core/vote-style.js";
import { craftVersionFrom, normalizeCraftVersion, renewalCraft, PLAYER_DEFAULT_CRAFT_VERSION } from "../js/core/craft-version.js";
import { temperatureBands } from "../js/craft/temperature-model.js";

const BASE_STATS = { aroma: 98, taste: 46, heatStability: 73, burnRisk: 25, draw: 80, smoke: 62, craftQuality: 79 };
/** attack: 攻めの帯で終えた回（投票の回の番号。1＝提供・2＝調整1回目・3＝調整2回目） */
function craft({ holes = null, heat = 86, pull = 100, stats = BASE_STATS, care = [100, 100], attack = [] } = {}) {
  return { holes: holes === null ? { skipped: true } : { score: holes }, heat: { score: heat },
    pull: { score: pull, ...(attack.includes(1) ? { attack: true } : {}) }, stats: { ...stats },
    careHistory: care.map((score, i) => ({ score, ...(attack.includes(i + 2) ? { attack: true } : {}) })), total: 90 };
}
function match(cs, style = "sakurai") {
  const attempt = {};
  beginCh1Votes(attempt, { style });
  for (let round = 0; round < 4; round++) {
    assert.equal(castCh1Votes(attempt, round, cs), true);
    assert.equal(castCh1Votes(attempt, round, cs), false, "二重投入しない");
  }
  return attempt.voteAttempt;
}
const hajimeVotes = (p) => p.result.rows.find(row => row.id === "hajime").points;

// 方式: 省略はいままでの審査（旧呼び出し・旧セーブはそのまま）。桜井式は版3で、始めた後は変えない。
{
  const classic = {}; beginCh1Votes(classic);
  assert.equal(classic.voteAttempt.rulesVersion, CH1_VOTE_VERSION);
  assert.equal(isSakuraiVotes(classic.voteAttempt), false);
  const sakurai = {}; beginCh1Votes(sakurai, { style: "sakurai" });
  assert.equal(sakurai.voteAttempt.rulesVersion, CH1_SAKURAI_VERSION);
  assert.equal(isSakuraiVotes(sakurai.voteAttempt), true);
  assert.equal(beginCh1Votes(sakurai, { style: "classic" }), sakurai.voteAttempt, "始めた試合の方式は変えない");
  const loaded = JSON.parse(JSON.stringify(sakurai));
  assert.equal(isSakuraiVotes(loaded.voteAttempt), true, "保存して読み込んでも桜井式のまま");
}

// 持ち点・基礎票・同じ制作は同じ票。
for (const score of [60, 70, 80, 86, 90, 100]) {
  const cs = craft({ heat: score, pull: score, care: [score, score] });
  const p = match(cs);
  assert.deepEqual(p, match(cs), "同じ制作は同じ票");
  for (const judge of CH1_JUDGES) assert.equal(Object.values(p.votes[judge]).reduce((a, b) => a + b, 0), 10);
  assert.equal(p.result.rows.reduce((a, b) => a + b.points, 0), 34);
  assert(p.result.rows.every(row => row.points >= 1), "全員に最低1票");
  assert.equal(p.views.length, 4); assert.equal(p.picks.length, 4);
}

// 柱1: 各回はその回に仕上げた工程だけ。出だしの炭焼きは、提供・調整の回の評価に入らない。
{
  const weak = match(craft({ heat: 60 })), strong = match(craft({ heat: 100 }));
  for (const round of [1, 2, 3]) assert.deepEqual(weak.views[round], strong.views[round], `${round}回目は炭焼きの点に左右されない`);
  assert(weak.views[0].dr_kemuri.hajime < strong.views[0].dr_kemuri.hajime);
}

// 柱2: 提供の回は審査員ごとに見る所が違う。詰め方の違い（味・吸い心地）で取れる審査員が変わる。
{
  const views = (stats) => sakuraiMine(craft({ stats }), 1);
  const normal = views(BASE_STATS);
  const dense = views({ ...BASE_STATS, taste: BASE_STATS.taste + 14, draw: BASE_STATS.draw - 12, smoke: BASE_STATS.smoke - 5.4 });
  const fluffy = views({ ...BASE_STATS, taste: BASE_STATS.taste - 6, draw: BASE_STATS.draw + 12, smoke: BASE_STATS.smoke + 5.4, burnRisk: BASE_STATS.burnRisk + 5 });
  assert(dense.maezono > normal.maezono && dense.sui < normal.sui, "デンスパックは味の上園に効き、煙の千須に響く");
  assert(fluffy.sui > normal.sui && fluffy.maezono < normal.maezono && fluffy.dr_kemuri < normal.dr_kemuri, "ふんわりは煙の千須に効く");
  const rivalBest = (judge) => Math.max(...["naru", "adam", "minto"].map(id => sakuraiRival(id, judge, 1)));
  assert(fluffy.sui > rivalBest("sui"), "ふんわりの一台は千須の1位を取れる");
  assert(normal.sui < rivalBest("sui"), "ふつうの一台は千須の1位を取れない");
  for (const judge of CH1_JUDGES) assert.equal(normal[judge], Math.round(Object.entries(SAKURAI.serve[judge])
    .reduce((n, [k, w]) => n + w * (k === "safety" ? 100 - BASE_STATS.burnRisk : k === "pull" ? 100 : BASE_STATS[k]), 0) * 100) / 100);
}

// 柱3: 攻めの帯で終えた回は全審査員の評価に上積み。失敗した記録には乗らない。
{
  const plain = sakuraiMine(craft(), 3), attack = sakuraiMine(craft({ attack: [3] }), 3);
  for (const judge of CH1_JUDGES) assert.equal(attack[judge] - plain[judge], ATTACK_BAND.bonus);
  const failed = craft({ attack: [3] }); failed.careHistory[1].failed = "burnt";
  assert.deepEqual(sakuraiMine(failed, 3), plain);
  // 調整2回目を真ん中で終えると、最後に攻めてくるみんとに1位と千須の最後の1点を取られる。攻めると取り返せる。
  const center = match(craft());
  assert.equal(center.lastPoint, "minto");
  assert.equal(center.picks[3].maezono.first, "minto");
  const bold = match(craft({ attack: [3] }));
  assert.equal(bold.lastPoint, "hajime");
  assert.equal(bold.attacks[3], true);
  assert(hajimeVotes(bold) > hajimeVotes(center));
}

// 逆転: 出だしでつまずいても、後半を攻めれば勝てる（いままでの審査では前半で決まっていた）。
{
  const slip = craft({ heat: 70, pull: 100, care: [100, 100] });
  assert.notEqual(match(slip).result.rank, 1, "攻めなければ届かない");
  assert.equal(match(craft({ heat: 70, attack: [1, 2, 3] })).result.rank, 1, "攻めれば逆転できる");
  assert.notEqual(match(slip, "classic").result.rank, 1, "いままでの審査では前半の失敗を取り返せない");
}

// 改善で得票は減らない（どの工程・どの内訳を上げても）。
for (const base of [70, 80, 90]) {
  const make = (patch = {}) => craft({ heat: base, pull: base, care: [base, base], ...patch });
  const baseline = match(make()).votes;
  const ups = [{ heat: base + 2 }, { pull: base + 2 }, { care: [base + 2, base] }, { care: [base, base + 2] },
    ...["aroma", "taste", "heatStability", "draw", "smoke"].map(k => ({ stats: { ...BASE_STATS, [k]: BASE_STATS[k] + 2 } })),
    { stats: { ...BASE_STATS, burnRisk: BASE_STATS.burnRisk - 2 } }, { attack: [3] }];
  for (const up of ups) {
    const upgraded = match(make(up)).votes;
    for (const judge of CH1_JUDGES) assert(upgraded[judge].hajime >= baseline[judge].hajime, `改善で得票は減らない ${JSON.stringify(up)}`);
  }
}

// 確定済みの結果を再計算しない。成績の足りない回は投票しない。
{
  const loaded = JSON.parse(JSON.stringify({ voteAttempt: match(craft()) }));
  const result = structuredClone(loaded.voteAttempt.result);
  assert.equal(castCh1Votes(loaded, 3, craft({ care: [100, 100], attack: [3] })), false);
  assert.deepEqual(loaded.voteAttempt.result, result);
  const attempt = {}; beginCh1Votes(attempt, { style: "sakurai" });
  castCh1Votes(attempt, 0, craft());
  const missing = craft(); delete missing.stats.aroma;
  assert.throws(() => castCh1Votes(attempt, 1, missing), /提供の成績が不足/);
  assert.deepEqual(CH1_CONTESTANTS, ["naru", "adam", "minto", "hajime"]);
}

// 攻めの帯: 適温帯の上の端（最適温より上・適温の上端まで）。帯の中は温度を満点として扱い、吸いすぎの減点は残す。
{
  const bands = temperatureBands({ mix: { lemon: 10, mint: 2 } });
  const range = attackRange(bands);
  assert(range.low > bands.optimal[1] && range.high === bands.ideal[1] && range.high < .9);
  assert(inAttackRange((range.low + range.high) / 2, range));
  assert(!inAttackRange(range.high + .01, range) && !inAttackRange(bands.center, range));
  assert.equal(attackScore(3, 3), 100);
  assert.equal(attackScore(4, 3), 92);
  assert.equal(attackRange({ ideal: [.4, .5], optimal: [.45, .55] }), null);
  assert.equal(attackGuide({ mode: "tournament", voteStyle: "sakurai" }), true);
  assert.equal(attackGuide({ mode: "tournament" }), false, "いままでの審査では出さない");
  assert.equal(attackGuide({ mode: "drill", voteStyle: "sakurai" }), false, "練習では出さない");
}

// 方式の選び方（CRN16）: 審査の方式はシーシャ作りの版で決まる（桜井版＝桜井式・リニューアル＝いままで）。
// 何も選んでいない端末はリニューアル。?craft= は設定より、?vote= は版より優先する（どちらも保存しない）。
{
  assert.equal(PLAYER_DEFAULT_CRAFT_VERSION, "renewal");
  assert.equal(normalizeCraftVersion(null), "renewal");
  assert.equal(normalizeCraftVersion("nonsense"), "renewal");
  assert.equal(craftVersionFrom({ craftVersion: "sakurai" }, ""), "sakurai");
  assert.equal(craftVersionFrom({ craftVersion: "sakurai" }, "?craft=renewal"), "renewal");
  assert.equal(craftVersionFrom({}, "?craft=sakurai&look=neo"), "sakurai");
  assert.equal(craftVersionFrom({ craftVersion: "renewal" }, "?craft=oops"), "renewal");
  assert.equal(renewalCraft({ craftVersion: "sakurai" }), false);
  assert.equal(renewalCraft({}), true, "版の無い一台（古いSAVE・部品だけのテスト）はリニューアル");
  assert.equal(voteStyleForCraftVersion("sakurai"), "sakurai");
  assert.equal(voteStyleForCraftVersion("renewal"), "classic");
  assert.equal(voteStyleFrom({}, ""), "classic");
  assert.equal(voteStyleFrom({ craftVersion: "sakurai" }, ""), "sakurai");
  assert.equal(voteStyleFrom({ craftVersion: "renewal" }, "?craft=sakurai"), "sakurai");
  assert.equal(voteStyleFrom({ craftVersion: "renewal" }, "?vote=sakurai"), "sakurai");
  assert.equal(voteStyleFrom({ craftVersion: "sakurai" }, "?vote=classic&look=neo"), "classic");
  assert.equal(voteStyleFrom({ craftVersion: "sakurai" }, "?vote=oops"), "sakurai");
}

console.log("PASS: Chapter 1 Sakurai-style votes (per-round, judge focus, attack band, last point, style switch)");
