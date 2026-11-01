// 経験値・レベル・火種の芯（SPEC 1.2〜1.5・1.9・6.1a、REPORT R1・R4・R7）。GROWTH_BOARD の裏で動く。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// #1690: 精算と前夜の内省は、就寝・夜明けの演出より前に済ませる。
const calendarSource = readFileSync(new URL("../js/daily/calendar.js", import.meta.url), "utf8");
const nightFlow = calendarSource.match(/^async function endDay\b[^\n]*\{[\s\S]*?^\}/m)?.[0];
const advanceDayBody = calendarSource.match(/^async function advanceDay\b[^\n]*\{[\s\S]*?^\}/m)?.[0];
assert.ok(nightFlow && advanceDayBody, "#1690: 夜の進行と翌日への遷移を検査できる");
const settlementAt = nightFlow.search(/\bawait\s+presentNight\s*\(/);
const advanceAt = nightFlow.search(/\bawait\s+advanceDay\s*\(/);
assert.ok(settlementAt >= 0 && advanceAt > settlementAt, "#1690: 夜の精算を待ってから翌日へ進む");
assert.match(nightFlow.slice(0, settlementAt), /\bconst\s+eve\s*=\s*state\.day\s*\+\s*1\s*>=\s*\(\s*chapterDef\.untilDay\s*\?\?\s*TOURNAMENT_DAY\s*\)\s*;/, "#1690: 章の大会日（未指定ならTOURNAMENT_DAY）から前夜を判定する");
assert.match(nightFlow.slice(settlementAt, advanceAt), /\bawait\s+presentNight\s*\(\s*\{\s*evePlace\s*:\s*eve\s*\?[^;]*:\s*null\s*\}\s*\)/, "#1690: 大会前夜だけ内省場所evePlaceを精算へ渡す");
assert.doesNotMatch(advanceDayBody, /\bpresentNight(?:Growth)?\s*\(/, "#1690: advanceDay内で精算せず、夜明けより前に済ませる");
assert.match(advanceDayBody, /\bawait\s+dayTurn\s*\(/, "#1690: 精算後のadvanceDayで通常日の夜明けを演出する");
assert.match(advanceDayBody, /\bawait\s+fadeBlack\s*\(/, "#1690: 精算後のadvanceDayで大会当日の暗転を行う");

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const stats = await import("../js/core/stats.js");
const { on } = await import("../js/core/bus.js");
const tick = (ms) => new Promise((r) => setTimeout(r, ms));

// 曲線（1.5 の表）
assert.equal(growth.GROWTH_BOARD, false, "盤の画面ができるまで既定で無効");
for (const [lv, total] of [[1, 0], [2, 205], [5, 850], [10, 2025], [20, 4750], [40, 11700], [80, 31600]]) assert.equal(growth.totalExpFor(lv), total, `Lv.${lv}`);
assert.equal(growth.expToNext(79), 595);
assert.equal(growth.levelForExp(204), 1);
assert.equal(growth.levelForExp(205), 2);
assert.equal(growth.levelForExp(1e9), 99);
assert.deepEqual([1, 2, 3, 4, 5, 9].map(growth.freshness), [1, 1, 0.8, 0.6, 0.4, 0.4]);

// 無効のときは状態も通知も増やさない（旧しくみのまま）
core.newGame();
core.state.phase = "daily";
const chips = [];
on("exp-gain", (c) => chips.push(c));
assert.equal(growth.growthEnabled(), false);
assert.equal(growth.gainExp(100), 0);
const off = await stats.paidAction(async () => { stats.addStamina(-10); return true; }, { exp: { key: "naru", person: "naru" } });
assert.equal(off.spent > 0, true);
assert.equal(core.state.growth, undefined, "無効なら growth を作らない");
assert.equal(growth.settleGrowth(), null);
const legacyRaw = core.state.stats.sense;
await stats.paidAction(async () => { stats.earnStat("sense", 2); stats.addStamina(-4); });
assert.equal(core.state.stats.sense, legacyRaw + 1, "無効時の行動による旧成長は維持");

// 有効: 自由行動 X1〜X3、新鮮さ、1行動1枚のチップ
growth.setGrowthPreview(true);
assert.equal(growth.growthEnabled(), true);
core.newGame();
core.state.phase = "daily";
const statsBefore = { ...core.state.stats };
const visit = (target, run = async () => { stats.addStamina(-4); return true; }) => stats.paidAction(run, { exp: target });
assert.equal(stats.gainStat("sense", 20), 0, "盤モードでは確定加算口からも旧能力を増やさない");
stats.earnStat("sense", 20);
await visit({ key: "naru", person: "naru" });
const g = core.state.growth;
assert.equal(g.xp, 70, "初めての相手: 30＋40");
assert.deepEqual(g.firsts.people, ["naru"]);
await tick(10);
assert.equal(chips.length, 1, "1行動につきチップ1枚");
assert.deepEqual(chips[0], { total: 70, tags: ["はじめて"] });
assert.deepEqual(Object.keys(core.state.stats).map((k) => core.state.stats[k] >= statsBefore[k]), [true, true, true, true, true], "旧しくみの能力は下がらない");
assert.deepEqual(core.state.stats, statsBefore, "経験値と旧能力の二重成長をしない");
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 100, "2回目は満額・はじめて無し");
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 124, "3回目 ×0.8");
await tick(10);
assert.deepEqual(chips.at(-1), { total: 24, tags: ["なじみ"] });
await visit({ key: "naru", person: "naru" });
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp, 124 + 18 + 12, "4回目 ×0.6、5回目 ×0.4");
// 体力を使わない行動・中断は数えない
await visit({ key: "kannon", place: "kannon" }, async () => false);
assert.equal(g.xp, 154);
assert.equal(g.fresh.counts.kannon, undefined);
// 関数で結果から鍵を決める（tonari のサブメニュー）
await stats.paidAction(async () => { stats.addStamina(-24); return { sub: "baito" }; }, { exp: (r) => ({ key: `tonari_${r.sub}`, place: `tonari_${r.sub}` }) });
assert.equal(g.xp, 224);
assert.equal(g.today.learned.tonari_baito, 70);

// 好感度の段（X4）は自由行動の中だけ。行動中の分は行動のチップへ合算する
const before = g.xp;
stats.gainAffinity("tsumugi", 12); // 行動の外（LIMEや強制イベント相当）
await tick(800);
assert.equal(g.xp, before, "行動の外の好感度では入らない");
const chipCount = chips.length;
await visit({ key: "minto", person: "minto" }, async () => { stats.addStamina(-16); stats.gainAffinity("minto", 12); return true; });
assert.equal(g.xp, before + 30 + 40 + 30, "段1つで +30");
await tick(800);
assert.equal(chips.length, chipCount + 1, "好感度の段も同じ1枚に");
assert.deepEqual(chips.at(-1).tags.sort(), ["はじめて", "仲が深まった"].sort());

// 章が変わると新鮮さは数え直し、章倍率が掛かる
core.state.chapter = 2;
const xp2 = g.xp;
await visit({ key: "naru", person: "naru" });
assert.equal(g.xp - xp2, 38, "第2章 30×1.25 を四捨五入、新鮮さはリセット");
core.state.chapter = 1;

// 寝る時の精算: レベルと火種、今日の分、冪等
const lvBefore = g.level;
assert.equal(lvBefore, 1, "日中はレベルが上がらない");
const pending = growth.pendingLevels();
assert.equal(pending, growth.levelForExp(g.xp) - 1);
const first = growth.settleGrowth();
assert.equal(first.from, 1);
assert.equal(first.to, growth.levelForExp(g.xp));
assert.equal(first.full, true, "初めてのレベルアップはフル演出");
assert.equal(g.hidane.any, 2 * (first.to - 1), "レベル1つで火種2つ（SBD60）");
assert.equal(g.earned, 2 * (first.to - 1));
assert.deepEqual([growth.hidaneForLevel(2), growth.hidaneForLevel(50), growth.hidaneForLevel(99)], [2, 2, 2]);
// 1周目（中央 Lv.57）で盤の約7割、Lv.99 までのレベルの火種＋節目＋大会2周で全部に近い（SPEC 1.6a）
const levelHidane = (to) => Array.from({ length: to - 1 }, (_, i) => growth.hidaneForLevel(i + 2)).reduce((a, b) => a + b, 0);
const firstRun = levelHidane(57) + 5 * 2 + 5 * 2 + 8; // 節目5・大会5・♥5 数人
assert(firstRun / growth.BOARD_TOTAL >= 0.7 && firstRun / growth.BOARD_TOTAL <= 0.8, `1周目 ${firstRun}/${growth.BOARD_TOTAL}（3盤とも7割）`);
const full = levelHidane(99) + 9 * 2 + 10 * 2;
assert(full >= growth.BOARD_TOTAL, "2周目の途中で全部開く（1周目の7割を優先）");
assert.equal(g.settledXp, g.xp);
assert.deepEqual(g.today, { xp: 0, learned: {}, gifts: [] });
assert.ok(first.learned.length <= 3 && first.learned.includes("naru"), "今日学んだこと（最大3つ）");
const again = growth.settleGrowth();
assert.equal(again.to, again.from, "二度精算しても増えない");
assert.equal(g.earned, 2 * (first.to - 1));

// 2回目以降の1レベルは短い帯、2つ以上はフル
growth.gainExp(growth.totalExpFor(g.level + 1) - g.xp);
const one = growth.settleGrowth();
assert.equal(one.to - one.from, 1);
assert.equal(one.full, false, "ふだんの1レベルは短い帯");
growth.gainExp(growth.totalExpFor(g.level + 2) - g.xp);
const two = growth.settleGrowth();
assert.equal(two.to - two.from, 2);
assert.equal(two.full, true, "1晩に2つ以上はフル");

// 節目 Lv.10: 色つきの火種2つ。前の節目から一番灯した盤の色（同数なら段の低い盤）
growth.noteLit(g, "wisdom", 3);
growth.noteLit(g, "sense", 5);
growth.gainExp(growth.totalExpFor(10) - g.xp);
const earnedBefore = g.earned;
const ms = growth.settleGrowth();
assert.equal(ms.to, 10);
assert.equal(ms.full, true, "節目はフル");
assert.deepEqual(ms.gains.limited, [{ level: 10, system: "sense", n: 2 }], "感覚盤に一番灯した");
assert.equal(g.hidane.sense, 2);
assert.equal(g.earned - earnedBefore, 2 * (ms.to - ms.from) + 2);
assert.deepEqual(g.milestones, [10]);
assert.deepEqual(g.litSince, { body: 0, sense: 0, wisdom: 0 }, "節目で数え直す");
assert.equal(growth.milestoneSystem(g), "body", "同数（0）なら段の低い盤、それも同じなら才能");

// ♥5の人から、その人のタイプの色の火種2つ（周回ごとに1回）
core.state.affinity.minto = 999;
const gift = growth.giftAtMaxHeart("minto");
assert.deepEqual(gift, { kind: "body", n: 2 });
assert.equal(g.hidane.body, 2);
assert.equal(growth.giftAtMaxHeart("minto"), null, "二度はもらえない");
assert.equal(growth.giftAtMaxHeart("sumi"), null, "タイプの無い人はくれない");
core.state.affinity.minto = 0;
assert.deepEqual(g.today.gifts, [{ who: "minto", parts: [{ kind: "body", n: 2 }] }], "寝る前に知らせる");

// 遊びのご褒美（SBD39）: 斧投げ・TRPG の水準。一度だけ。寝る前の精算でまとめて渡す
core.state.flags._axe_bar_records = { classic: { plays: 3, best: { total: 70, maximum: 100 } } }; // 70% → A
core.state.trpg.cleared = { "ordinary-cup": { ending: "x", stars: 3 } };
const axe = await import("../js/minigames/axe-challenges.js");
for (const [rank, min] of growth.AXE_RANKS) assert.equal(axe.rankOf(min * 100, 100), rank, "斧投げのランクの境目が本体と同じ");
// くじのラストワン賞（SBD40）: 箱を引き切ったら火種のセット
core.state.kuji = { g500: { order: [0, 0], drawn: 2, emptyDay: 5 } };
const held = { ...g.hidane };
const night = growth.settleGrowth();
const labels = night.gifts.map((x) => x.label || x.who);
assert.deepEqual(labels, ["minto", "斧投げで Aランク", "TRPGで★3の卓", "くじのラストワン賞"]);
assert.deepEqual(night.gifts[1].parts, [{ kind: "body", n: 1 }], "斧投げAで才1（小さめ。SBD39）");
assert.deepEqual(night.gifts[2].parts, [{ kind: "wisdom", n: 1 }], "TRPG★3で理1");
assert.deepEqual(night.gifts[3].parts, [{ kind: "body", n: 1 }], "ラストワン賞は1つ。段が同じなら才能盤の色");
assert.equal(g.hidane.sense - held.sense + g.hidane.body - held.body + g.hidane.wisdom - held.wisdom, 3, "ラストワン賞は1つだけ（いちばん段の低い盤の色）");
assert.deepEqual(growth.settleGrowth().gifts, [], "同じ水準・同じ箱では二度もらえない");
core.state.kuji.g500.emptyDay = 9;
assert.deepEqual(growth.settleGrowth().gifts.map((x) => x.label), ["くじのラストワン賞"], "次の箱を引き切ればまたもらえる");
core.state.flags._axe_bar_records = { classic: { plays: 9, best: { total: 85, maximum: 100 } } };
assert.deepEqual(growth.settleGrowth().gifts, [], "斧投げのご褒美は Aランクの1回だけ");
delete core.state.flags._axe_bar_records; core.state.trpg.cleared = {}; core.state.kuji = {};

// ゲージ（6.1a）
const gauge = growth.gaugeAt(12, growth.totalExpFor(12) + 130, growth.totalExpFor(12) + 200);
assert.equal(gauge.settled, 0.5);
assert.equal(Math.round(gauge.now * 1000), 769);
assert.equal(gauge.left, 60);
assert.equal(gauge.pending, 0);
const over = growth.gaugeAt(12, growth.totalExpFor(12), growth.totalExpFor(13) + 80);
assert.deepEqual([over.now, over.pending, over.overflow, over.left], [1, 1, 80, 0]);
assert.equal(growth.gaugeAt(9, 0, 0).nextMilestone, true);
assert.equal(growth.gaugeAt(99, 0, 0).max, true);
assert.equal(growth.gaugeAt(80, 0, 0).max, false);

// 保存・読込・壊れた値
core.save(); core.load();
assert.equal(core.state.growth.level, 10);
assert.equal(core.state.growth.hidane.sense, 2, "節目の2");
assert.equal(core.state.growth.gifted.minto, true);
core.state.growth = { level: 99, xp: -5, hidane: "x", milestones: [3, 10], firsts: null };
const fixed = growth.ensureGrowth();
assert.equal(fixed.level, 1);
assert.equal(fixed.xp, 0);
assert.equal(growth.hidaneTotal(fixed), 0);
assert.deepEqual(fixed.milestones, [10]);
// 第1版の試作の色は万能に寄せる
core.state.growth = { ...growth.newGrowth(), hidane: { any: 1, technique: 2, guts: 1, sense: 1 }, nodes: ["T1", "B1", "K03"] };
const old = growth.ensureGrowth();
assert.deepEqual(old.hidane, { any: 4, body: 0, sense: 1, wisdom: 0 });
assert.deepEqual(old.nodes, ["B1", "K03"], "知らないマスIDは落とす");
// 旧セーブの習得済みフラグ → 授業のマスが灯る。灯した授業はフラグを戻す（4.5・2.6）
core.state.flags._coal_cube_learned = true;
core.state.growth.nodes.push("M-S1");
growth.ensureGrowth();
assert.ok(core.state.growth.nodes.includes("M-W1"), "キューブ炭の旧フラグ → 授業のマス");
assert.ok(core.state.growth.learned.includes("M-W1"), "旧フラグの授業は習得済みとして灯る");
assert.notEqual(core.state.flags._sumi_attack_learned, true, "灯しただけ（相談前）の授業はフラグを立てない（SBD50）");
core.state.growth.learned.push("M-S1");
growth.ensureGrowth();
assert.equal(core.state.flags._sumi_attack_learned, true, "習得した授業のフラグは周回で消えても戻す");
delete core.state.flags._coal_cube_learned; delete core.state.flags._sumi_attack_learned;
// 上限: 盤の全部（3盤とも66の盤で198）を超えて渡さない
assert.equal(growth.BOARD_TOTAL, 198);
core.state.growth = { ...growth.newGrowth(), earned: growth.BOARD_TOTAL - 1 };
growth.gainExp(growth.totalExpFor(12));
const capped = growth.settleGrowth();
assert.equal(core.state.growth.earned, growth.BOARD_TOTAL);
assert.equal(capped.boardFull, false, "受け取りが上限でも、灯していなければ「盤は埋まった」と出さない");

// 無効へ戻すと新しいゲームには growth が無い
// X6/X7: 行動の確定時にだけ配合の発見を精算し、再読・LOAD・無料練習では増やさない。
core.newGame(); core.state.phase = "daily";
const discoveryStats = { ...core.state.stats };
stats.earnRecipeDiscovery("lemon_mint", { discovered: true, golden: true });
assert.equal(core.state.growth, undefined, "自由行動の外では報酬を作らない");
await stats.paidAction(async () => {
  stats.addStamina(-4); stats.earnStat("sense", 4);
  stats.earnRecipeDiscovery("lemon_mint", { discovered: true });
  stats.earnRecipeDiscovery("lemon_mint", { golden: true });
}, { exp: { key: "tonari_practice", place: "tonari_practice" } });
assert.equal(core.state.growth.xp, 120, "X1+X3+新レシピ30+黄金比20");
assert.deepEqual(core.state.stats, discoveryStats);
core.save(); core.load();
await stats.paidAction(async () => {
  stats.addStamina(-4); stats.earnRecipeDiscovery("lemon_mint", { discovered: true, golden: true });
});
assert.equal(core.state.growth.xp, 120, "同じ配合を再び確定しても発見は重複しない");
await stats.paidAction(async () => { stats.earnRecipeDiscovery("no_cost", { discovered: true }); });
assert.equal(core.state.growth.xp, 120);
assert(!core.state.growth.discoveries.recipes.includes("no_cost"));
await assert.rejects(stats.paidAction(async () => {
  stats.addStamina(-4); stats.earnRecipeDiscovery("cancelled", { discovered: true }); throw new Error("cancel");
}), /cancel/);
assert.equal(core.state.growth.xp, 120);
await stats.paidAction(async () => {
  stats.addStamina(-4); stats.earnRecipeDiscovery("old_owner", { discovered: true }); core.newGame();
});
assert.equal(core.state.growth, undefined, "LOAD相当で所有者が変わった行動の報酬を持ち越さない");
core.state.chapter = 2;
await stats.paidAction(async () => { stats.addStamina(-4); stats.earnRecipeDiscovery("chapter2", { discovered: true, golden: true }); });
assert.equal(core.state.growth.xp, 63, "第2章の新レシピ38＋黄金比25");
const { buildCarryPackage } = await import("../js/core/carry.js");
assert.deepEqual(buildCarryPackage(core.state).growth.discoveries, { recipes: [], golden: [] });
assert.deepEqual(core.state.growth.discoveries, { recipes: ["chapter2"], golden: ["chapter2"] }, "周回パッケージ作成で現セーブを変更しない");
core.newGame(); core.state.phase="daily";
growth.ensureGrowth().nodes=["K04","K04"];
growth.awardActionExp({key:"new_person",person:"new_person"});
assert.equal(core.state.growth.xp,78,"K04はX2の40だけを20%増やす。X1の30はそのまま");
growth.awardActionExp({key:"new_place",place:"new_place"});
assert.equal(core.state.growth.xp,156);
growth.awardActionExp({key:"new_person",person:"new_person"});
assert.equal(core.state.growth.xp,186,"再訪の行動経験値にK04を付けない");
growth.awardRecipeExp("recipe",{discovered:true,golden:true});
assert.equal(core.state.growth.xp,236,"新レシピと黄金比はK04の対象外");
// X5/X5s は完読候補を行動終了で精算。部品の再通知・無料会話・旧ownerを除外する。
stats.earnSceneCompletion("outside"); assert.deepEqual(core.state.growth.read,[]);
await stats.paidAction(async () => {
  stats.addStamina(-4); stats.earnSceneCompletion("cafe_idea"); stats.earnSceneCompletion("cafe_idea");
});
assert.equal(core.state.growth.xp,260,"初場面20にK04の20%を適用、重複候補は一度だけ");
core.save(); core.load();
await stats.paidAction(async () => { stats.addStamina(-4); stats.earnSceneCompletion("cafe_idea"); });
assert.equal(core.state.growth.xp,260,"LOAD後の同じ場面に再付与しない");
await stats.paidAction(async () => { stats.earnSceneCompletion("no_cost"); });
assert.deepEqual(core.state.growth.read,["cafe_idea"]);
assert.equal(growth.awardSceneExp("lover_minto_lv2"),0,"恋人専用の先行報酬と重ねない");
assert.equal(growth.awardSceneExp("hiyori_feelings_spoken"),0);
assert.deepEqual(buildCarryPackage(core.state).growth.read,[]);
// X8〜X11: 再挑戦では最高順位との差分、章の終了・広さは一度だけ。大会の資源を変更しない。
core.newGame(); core.state.phase="tournament";
const resourceBefore={day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,money:core.state.money,stats:{...core.state.stats}};
assert.equal(growth.awardTournamentExp(0),0);
assert.equal(growth.awardTournamentExp(4,{failed:"burnt"}),140);
assert.equal(growth.hidaneTotal(),0,"制作途中の敗北では工程の色を推測しない");
const finishedCraft={pullDone:true,careHistory:[{score:60},{score:70}],heat:{score:95},steam:{score:80},holes:{score:90},stats:{craftQuality:85}};
assert.equal(growth.awardTournamentExp(3,finishedCraft),40);
assert.equal(core.state.growth.hidane.sense,2);
assert.equal(growth.awardTournamentExp(2,finishedCraft),40);
assert.equal(growth.awardTournamentExp(1,finishedCraft),80);
assert.equal(growth.awardTournamentExp(4,finishedCraft),0);
core.save();core.load();
assert.equal(growth.awardTournamentExp(1,finishedCraft),0);
assert.equal(core.state.growth.xp,300);assert.equal(core.state.growth.earned,2);
assert.equal(core.state.growth.today.gifts.length,1);
assert.deepEqual({day:core.state.day,slot:core.state.slot,stamina:core.state.stamina,money:core.state.money,stats:core.state.stats},resourceBefore);
growth.awardActionExp({key:"naru",person:"naru"});
growth.awardActionExp({key:"naru",person:"naru"});
growth.awardActionExp({key:"cafe",place:"cafe"});
assert.equal(growth.awardChapterClearExp(),190,"章クリア150＋1人25＋1種類15");
core.save();core.load();assert.equal(growth.awardChapterClearExp(),0);
core.state.chapter=2;
assert.equal(growth.awardTournamentExp(1,finishedCraft),375,"別の章は再集計し章倍率1.25を適用");
assert.equal(growth.awardChapterClearExp(),188,"前章の広さを次章へ数えない");
const carry=buildCarryPackage(core.state).growth;
assert.deepEqual(carry.chapterLog,{});assert.deepEqual(carry.tournamentXp,{});assert.deepEqual(carry.cleared,[]);
// 欠けた新台帳・壊れた章別レコードで旧セーブを落とさない。
core.newGame();core.state.growth={...growth.newGrowth(),chapterLog:{1:42},tournamentXp:{1:"invalid"}};
growth.awardActionExp({key:"cafe",place:"cafe"});
assert.equal(growth.awardTournamentExp(4),140);
assert.equal(growth.awardChapterClearExp(),165);
growth.setGrowthPreview(false);
core.newGame();
assert.equal(core.state.growth, undefined);
console.log("[growth levelup] PASS: curve, flag off, X1-X4 + freshness, one chip per action, chapter mult, night settlement, short/full, milestone hidane, ♥5 gift, play rewards, kuji last one, gauge, save/load, legacy lessons, cap");
