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
DB.casualLime = JSON.parse(fs.readFileSync(new URL("../data/casual_lime.json", import.meta.url), "utf8"));
const casual = await import("../js/daily/casual-lime.js");
const entry = await import("../js/chapters/friend-entry.js");
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

// LM07: 友人のLIMEが無い時は、♥3以上で締めくくり前の知り合いの雑談が第3〜5章でも届く（読むだけ・一度ずつ・離れた場所からの文面が続く）
{
  const t = core.newGame();
  Object.assign(t, { chapter: 3, phase: "chapter3", day: 40, contacts: ["adam", "kumicho", "mashiro"], met: { adam: true, kumicho: true, mashiro: true }, flags: {}, levels: {} });
  t.affinity = { adam: 40, kumicho: 40, mashiro: 40 }; // ♥3以上
  assert.deepEqual(casual.casualMessages(), [], "朝の端末用の呼び出しでは第3章に出さない");
  const first = entry.pendingFriendLime({ exclude: ["mashiro"] });
  assert.equal(first.length, 1, "友人が居なくても知り合いの雑談が1通届く");
  assert.ok(first[0].casual && first[0].type === "chat" && !first[0].replies?.length, "読むだけ");
  assert.equal(entry.pendingFriendLime({ exclude: ["adam", "kumicho"] }).length, 0, "同行者・会えている相手は送ってこない");
  const sender = first[0].sender;
  const seen = [];
  for (let i = 0; i < 6; i++) {
    const [m] = entry.pendingFriendLime();
    if (!m || m.sender !== sender) { t.day += 7; if (!m) continue; }
    const mm = m || {};
    seen.push(mm.id);
    t.inbox.push({ id: mm.id, originId: mm.id, day: t.day, chapter: t.chapter, read: true, done: true, msg: mm, log: [] });
    t.limeRead.push(mm.id);
    t.day += 7;
    t.chapter = 3 + (i % 3);
  }
  assert.equal(new Set(seen).size, seen.length, "同じ雑談は二度届かない");
  const ofAdam = seen.filter(id => id.startsWith("_casual_adam_"));
  assert.ok(ofAdam.length >= 3, `第1・2章の分(2)を使い切ったあと、離れた場所からの雑談(later)が続く: ${seen}`);
}

const src = file => fs.readFileSync(new URL(`../js/chapters/${file}`, import.meta.url), "utf8");
for (const file of ["ch3.js", "ch4.js", "ch5.js"]) assert.match(src(file), /readFriendLime/, `${file} に入口が無い`);
console.log("friend_lime_scene_chapters: ok");
