// 章が変わった時の心得の盤の知らせ（SPEC 6.3「章が変わった」・11章の章はじめの再案内・5.2 の地図の一言。#1801 C10）。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 日常の朝（夜明けの幕・朝のカードの後）に一度だけ出し、地図の一言は章の reminder が無い時だけ
const calendarSource = readFileSync(new URL("../js/daily/calendar.js", import.meta.url), "utf8");
const loop = calendarSource.match(/^export async function runDaily\b[\s\S]*?^\}/m)?.[0];
assert.ok(loop, "runDaily を検査できる");
assert.match(loop, /await morning\(\);\s*save\(\);\s*\}\s*\/\/[^\n]*\n\s*announceChapterBoard\(\);/, "朝の後、その日の行動より前に知らせる");
assert.match(calendarSource, /reminder:\s*mapOptions\.reminder\s*\|\|\s*respecMapNotice\(state\)/, "章の地図の一言が無い時だけ、組み直しの期限を地図の案内に添える");
assert.match(calendarSource, /takeRespecCloseWarning\(state\)[\s\S]{0,600}confirmLimeReminder\(destination/, "行動の確認（onBeforeGo）で閉じることを知らせてから LIME の確認へ進む");

globalThis.document ||= { addEventListener() {} };
globalThis.window ||= {};
const storage = new Map();
globalThis.localStorage = { setItem: (k, v) => storage.set(k, String(v)), getItem: (k) => storage.get(k) ?? null, removeItem: (k) => storage.delete(k) };
const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const board = await import("../js/core/growth-board.js");
const respec = await import("../js/core/growth-respec.js");
const { SKILLS } = await import("../js/core/growth-board-data.js");
const { buildCarryPackage } = await import("../js/core/carry.js");
const notice = await import("../js/core/growth-chapter-notice.js");
const { takeChapterBoardNotice: take, chapterBoardCards: cards, respecMapNotice: band } = notice;

const ringSkills = ring => SKILLS.filter(k => k.ring === ring).map(k => k.name);
const keyAt = (st, chapter) => `${respec.cycleOf(st)}:${chapter}`;
const noPeriod = list => list.forEach(c => ["main", "sub", "fx"].forEach(k => assert.ok(!String(c[k] ?? "").endsWith("。"), `${k} の行末に句点を付けない: ${c[k]}`)));

core.newGame();
const s = core.state;
s.phase = "daily";
assert.equal(take(s), null, "成長データが無いうちは何もしない（読むだけで作らない）");
assert.equal(s.growth, undefined);

const g = growth.ensureGrowth(s);
assert.equal(g.chapterNotice, null, "新しい成長データは未記録");
assert.equal(take(s), null, "第1章の最初は知らせない（見た章として記録だけ）");
assert.deepEqual(g.chapterNotice, { key: keyAt(s, 1), ring: 1 });
assert.equal(take(s), null, "同じ章では二度出さない");
assert.equal(band(s), "", "第1章の1周目は組み直しが無い");

g.hidane.any = 40;
board.commitPending(board.pathTo("B1", new Set(g.nodes)).path);
assert.ok(g.nodes.includes("B1"));

// 第2章: 冒頭の強制イベント中は出さず、最初の日常で出す
s.chapter = 2; s.phase = "opening";
assert.equal(take(s), null, "冒頭の強制イベント中は出さない");
assert.deepEqual(g.chapterNotice, { key: keyAt(s, 1), ring: 1 }, "出さなかった時は記録を進めない");
s.day += 2; s.phase = "daily";
const ch2 = take(s);
assert.ok(ch2, "第2章の最初の日常で知らせる");
assert.equal(ch2.opened, true);
assert.deepEqual(ch2.skills.map(k => k.name), ringSkills(2), "第2章で灯せるようになったスキルだけ");
assert.equal(ch2.respec, true, "組み直しが開いている");
const ch2Cards = cards(ch2);
assert.equal(ch2Cards.length, 2);
assert.equal(ch2Cards[0].main, `盤に新しいスキルが${ringSkills(2).length}つ`);
assert.equal(ch2Cards[0].sub, ringSkills(2).join("・"));
assert.equal(ch2Cards[1].main, "今なら盤を組み直せる");
noPeriod(ch2Cards);
assert.equal(take(s), null, "知らせは章ごとに一度");
assert.equal(band(s), "心得の盤の組み直しは、最初の行動まで", "開いている間は地図の案内に添える");
assert.equal(notice.takeRespecCloseWarning(s), "この行動をすると、この章の組み直しは閉じます", "開いている間の最初の確認で、閉じることを添える");
assert.equal(notice.takeRespecCloseWarning(s), "", "確認の一言は一度だけ");
respec.closeRespecOpportunity(g);
assert.equal(notice.takeRespecCloseWarning(s), "", "閉じた後は添えない");
assert.equal(band(s), "", "最初の行動で閉じたら一言も消える");

// 第3章: 組み直しの機会が閉じた後に知らせを取り直しても、組み直しのカードは出さない
s.chapter = 3; s.day += 15;
const ch3 = take(s);
assert.deepEqual(ch3.skills.map(k => k.name), ringSkills(3));
assert.ok(ch3.skills.length > 0);
respec.closeRespecOpportunity(g);
assert.equal(band(s), "");

// 授業だけが灯っている時は、組み直しても外すものが無いので案内しない
const saved = [...g.nodes];
g.nodes = g.nodes.filter(id => id.startsWith("M-"));
s.chapter = 4; s.day += 15;
const ch4 = take(s);
assert.deepEqual(ch4.skills.map(k => k.name), ringSkills(4));
assert.equal(ch4.respec, false, "戻せるマスが無ければ組み直しの案内は出さない");
assert.equal(cards(ch4).length, 1);
g.nodes = saved;
respec.closeRespecOpportunity(g);

// 第5章: スキルは増えないが、結界は解ける
s.chapter = 5; s.day += 15;
respec.syncRespecOpportunity(g, s); respec.closeRespecOpportunity(g);
const ch5 = take(s);
assert.deepEqual(ch5.skills, [], "第5章で増えるスキルは無い");
assert.equal(ch5.opened, true);
const ch5Cards = cards(ch5);
assert.equal(ch5Cards[0].main, "心得の盤の結界が解けた");
noPeriod(ch5Cards);

// 旧セーブ（記録の無い成長データ）を初めて読んだ章では出さない
delete g.chapterNotice;
s.chapter = 3;
assert.equal(take(s), null, "旧セーブの初読では知らせを作らない");
assert.deepEqual(g.chapterNotice, { key: keyAt(s, 3), ring: 3 });
g.chapterNotice = { key: "x", ring: 99 };
assert.equal(take(s), null, "壊れた記録も初読と同じく今の章で記録し直す");
assert.deepEqual(g.chapterNotice, { key: keyAt(s, 3), ring: 3 });

// 周回: 能力を引き継いだ第1章は、組み直しの案内だけ（章の範囲は広がらない）
s.chapter = 5;
const carried = buildCarryPackage(s).growth;
core.newGame();
const next = core.state;
next.cycle = 2; delete next.cycleId; next.phase = "daily";
next.growth = carried;
const g2 = growth.ensureGrowth(next);
const ng = take(next);
assert.ok(ng, "周回のはじめに知らせる");
assert.equal(ng.opened, false, "第1章の範囲は前の周の第5章より広くない");
assert.equal(ng.respec, true, "周回開始の組み直し（SPEC 5.2）");
assert.deepEqual(cards(ng).map(c => c.top), ["REBUILD"]);
assert.deepEqual(g2.chapterNotice, { key: "cycle:2:1", ring: 1 });
next.chapter = 2; next.day += 15;
assert.deepEqual(take(next).skills.map(k => k.name), ringSkills(2), "周回の第2章も、その章で灯せるようになったスキル");

// 盤を切っている時は出さない
growth.setGrowthPreview(false);
next.chapter = 3; next.day += 15;
assert.equal(take(next), null);
assert.equal(band(next), "");
growth.setGrowthPreview(true);

console.log("[growth chapter notice] PASS: once per chapter/cycle on the first daily morning, new skills of the chapter, barrier card in ch5, respec card + map reminder only while open and only with removable squares, old saves silent, NG+ respec only");
