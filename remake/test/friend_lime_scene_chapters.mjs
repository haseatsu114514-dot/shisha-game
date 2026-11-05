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
// #2033: 第5章の自由行動は日常ループ（runDaily）。朝の端末に友人の雑談が届き、お誘いは出さない。
{
  const savedPhase = s.phase, savedInbox = s.inbox;
  s.chapter = 5; s.phase = "daily";
  // 雑談の後でもお誘いにしない（第1・2章なら雑談→お誘いの順）。
  s.inbox = [{ id: "_prev_chat", originId: "_prev_chat", day: s.day - 10, read: true, msg: { id: "_prev_chat", sender: "naru", type: "chat", friend: true } }];
  const daily = bonds.friendMessages();
  assert.ok(daily.length >= 1, "第5章の日常ループの朝に友人の雑談が届く");
  assert.ok(daily.every(m => m.type === "chat" && m.friend), "第5章はお誘いを出さない");
  s.phase = savedPhase; s.inbox = savedInbox;
}
s.chapter = 2; s.phase = "chapter2";
assert.deepEqual(bonds.friendMessages({ sceneChapter: true }), [], "第1・2章は従来の朝の端末だけ");

// #2035: 機能表へ移しても、入口・章の型・旧セーブのfallback・お誘い条件は変えない。
for (const chapter of [1, 2, 3, 4, 5, 6, "1", "3", undefined, null, 0, false, NaN]) {
  for (const sceneChapter of [false, true]) for (const phase of ["daily", "chapter3"])
    for (const tournamentDay of [false, true]) for (const pending of [false, true]) {
      Object.assign(s, { chapter, phase, day: 50, pendingInvite: pending ? { event: "other" } : null,
        inbox: [{ id: "_friend_chat_naru_d30", day: 30, read: true,
          msg: { sender: "naru", type: "chat", friend: true } }] });
      const before = JSON.stringify(s);
      const open = !tournamentDay && (sceneChapter ? [3, 4, 5].includes(chapter)
        : phase === "daily" && [1, 2, 5].includes(chapter || 1));
      const expected = !open ? [] : !sceneChapter && chapter !== 5 && !pending ? ["invitation", "chat"] : ["chat"];
      assert.deepEqual(bonds.friendMessages({ sceneChapter, tournamentDay }).map(m => m.type), expected,
        `chapter=${String(chapter)}, scene=${sceneChapter}, phase=${phase}, tournament=${tournamentDay}, pending=${pending}`);
      assert.equal(JSON.stringify(s), before, "候補の照会で保存状態を変えない");
    }
}

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
    const [m] = entry.pendingFriendLime({ exclude: ["mashiro"] }); // ましろの近況（第4章）は下の #2025 で見る
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

// #2025: 第3〜4章のヒロインの近況（読むだけ・各2通）。ひより・サメちゃんは第3・4章、
// 東京で一緒に働くましろは第4章だけ。くゆりは LM07 の later で既に届く。恋人には届かない。
{
  const people = DB.casualLime.people;
  for (const id of ["hiyori", "samechan", "mashiro", "kuyuri"]) assert.equal(people[id]?.later?.length, 2, `${id}: 近況は2通`);
  assert.deepEqual(people.mashiro.chapters, [4], "ましろは東京で会えている第3章には送ってこない");
  const ids = ["hiyori", "samechan", "mashiro"];
  const make = chapter => {
    const u = core.newGame();
    Object.assign(u, { chapter, phase: `chapter${chapter}`, day: 60, contacts: [...ids], flags: {}, levels: {},
      met: Object.fromEntries(ids.map(id => [id, true])) });
    u.affinity = Object.fromEntries(ids.map(id => [id, 40]));
    return u;
  };
  const drain = () => {
    const got = [];
    for (let i = 0; i < 12; i++) {
      const [m] = casual.casualMessages({ sceneChapter: true });
      if (m) {
        assert.ok(m.casual && m.type === "chat" && !m.replies?.length, `${m.id}: 読むだけ`);
        got.push(m);
        core.state.inbox.push({ id: m.id, originId: m.id, day: core.state.day, chapter: core.state.chapter, read: true, done: true, msg: m, log: [] });
        core.state.limeRead.push(m.id);
      }
      core.state.day += 7;
    }
    return got;
  };
  make(3);
  const ch3 = drain();
  assert.deepEqual([...new Set(ch3.map(m => m.sender))].sort(), ["hiyori", "samechan"], `第3章: ${ch3.map(m => m.id)}`);
  assert.equal(ch3.length, 4, "ひより・サメちゃんの近況が各2通ずつ一度だけ");
  make(4);
  const ch4 = drain();
  assert.deepEqual([...new Set(ch4.map(m => m.sender))].sort(), ids.slice().sort(), `第4章: ${ch4.map(m => m.id)}`);
  assert.equal(ch4.filter(m => m.sender === "mashiro").length, 2);
  const lover = make(4);
  lover.lovers = ["hiyori"];
  assert.ok(!drain().some(m => m.sender === "hiyori"), "恋人には恋人のLIMEが届くので近況の雑談は来ない");
}

const src = file => fs.readFileSync(new URL(`../js/chapters/${file}`, import.meta.url), "utf8");
for (const file of ["ch3.js", "ch4.js"]) assert.match(src(file), /readFriendLime/, `${file} に入口が無い`);
// 第5章は日常ループの朝の端末から届く（場面カードの入口は無い）。
assert.match(src("ch5-daily.js"), /runDaily\(/, "ch5-daily.js が日常ループに乗っていない");
console.log("friend_lime_scene_chapters: ok");

