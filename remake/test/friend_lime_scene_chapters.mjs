// #2022: 第3〜5章（場面カード式）でも、友人になった相手のたまのLIME（雑談のみ）が届く。
import assert from "node:assert/strict";
import fs from "node:fs";
globalThis.document ||= { addEventListener() {}, querySelector() { return null; }, createElement() { return { style: {}, classList: { add() {} } }; } };
globalThis.window ||= globalThis;
const storage = new Map();
globalThis.localStorage ||= { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) };
const core = await import("../js/core/state.js");
const { DB } = await import("../js/core/data.js");
const bonds = await import("../js/daily/bonds.js");

DB.friends = JSON.parse(fs.readFileSync(new URL("../data/friends.json", import.meta.url), "utf8"));
const s = core.newGame();
Object.assign(s, { chapter: 3, phase: "chapter3", day: 40 });
s.finales = { naru: { route: "friend", day: 30 } };
s.contacts = [...(s.contacts || []), "naru"];
s.flags._lime_contact_naru = true;

assert.deepEqual(bonds.friendMessages(), [], "日常の朝の端末（第1・2章）用の呼び出しでは第3章に出さない");
const due = bonds.friendMessages({ sceneChapter: true });
assert.ok(due.length >= 1, "第3章の場面カードから友人LIMEが届く");
assert.ok(due.every(m => m.type === "chat" && m.friend), "第3章以降はお誘いを出さない");
assert.equal(due[0].sender, "naru");
assert.deepEqual(bonds.friendMessages({ sceneChapter: true, tournamentDay: true }), []);

// 届いた直後は間隔（globalGapDays）を空ける。
s.inbox = [{ id: due[0].id, originId: due[0].id, day: s.day, read: true, msg: due[0] }];
assert.deepEqual(bonds.friendMessages({ sceneChapter: true }), []);
s.day += 5;
assert.ok(bonds.friendMessages({ sceneChapter: true }).length >= 1);

for (const chapter of [4, 5]) { s.chapter = chapter; assert.ok(bonds.friendMessages({ sceneChapter: true }).length >= 1, `第${chapter}章`); }
s.chapter = 2; s.phase = "chapter2";
assert.deepEqual(bonds.friendMessages({ sceneChapter: true }), [], "第1・2章は従来の朝の端末だけ");

const src = file => fs.readFileSync(new URL(`../js/chapters/${file}`, import.meta.url), "utf8");
for (const file of ["ch3.js", "ch4.js", "ch5.js"]) assert.match(src(file), /readFriendLime/, `${file} に入口が無い`);
console.log("friend_lime_scene_chapters: ok");
