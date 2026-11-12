// 共通VNの実装関数を実行する局所検査。DOM/画像/実ブラウザの代わりではない。
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const read = path => fs.readFileSync(new URL(path, import.meta.url), "utf8");
const model = await import(`data:text/javascript;base64,${Buffer.from(read("../js/core/romance-hesitation.js")).toString("base64")}`);
const engine = read("../js/vn/engine.js");
const start = engine.indexOf("function pickChoice(line, c) {");
const end = engine.indexOf("// ---------------------------------------------------------------- ログ", start);
assert(start > 0 && end > start);
const dialogues = Object.fromEntries(JSON.parse(read("../../data/dialogue/confession.json")).dialogues.map(d => [d.dialogue_id, d]));
const ids = ["minto", "tsumugi", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor"];
function node(html = "元の表示") {
  return { innerHTML: html, className: "original", style: { cssText: "color: blue" }, title: "original", childNodes: [],
    classList: { remove() {}, add() {} }, replaceChildren(...children) { this.childNodes = children; } };
}
function setup(id = "ageha", lovers = ["tsumugi"], court = false) {
  const dom = Object.fromEntries(["name", "text", "inner", "next", "box", "portraits", "choices"].map(key => [key, node()]));
  const portrait = node("現在の相手"); dom.portraits.childNodes = [portrait];
  const line = court ? { id: "bond_q1_" + id, romance_char: id, choices: [{ text: "恋愛", romance: 1 }, { text: "友情", romance: 0 }] }
    : dialogues[`confession_${id}`].lines.find(line => line.type === "choice");
  const owner = { lovers: lovers.slice(), flags: { _minto_name_known: true }, romanceChoices: {} };
  const rest = [{ speaker: "hajime", text: "続き" }];
  const r = { owner, id: court ? "bond_question" : `confession_${id}`, currentId: court ? "bond_question" : `confession_${id}`,
    waitingChoice: true, choiceLine: line, queue: rest, slots: { [id]: 0 }, visited: [] };
  const seen = [], applied = [];
  const ctx = { ...model, running: r, state: owner, dom, DB: { dialogues }, log: [],
    SE: { select() {} }, setAuto() {}, setSkip() {}, layoutPortraits() {}, refreshPortraits() {}, stripTags: text => text,
    hooks: { onChoice(...args) { applied.push(args); if (court) owner.romanceChoices[line.id] = { char: id, value: args[4].romance }; } },
    jumpTo(next) { r.visited.push(next); if (next.endsWith("_accept")) owner.lovers.push(id); return true; },
    insertBranch() {}, warnVn() {}, finish(cancelled) { ctx.cancelled = cancelled; ctx.running = null; },
    showChoices(choice) { r.waitingChoice = true; r.choiceLine = choice; },
    next() {
      if (r.hesitation && !r.hesitation.model.current(ctx.state)) return ctx.finish(true);
      const item = r.queue.shift();
      if (!item) return;
      if (item.type === "romance_hesitation") return ctx.resumeRomanceHesitation(item.action);
      if (item.type === "romance_memory") { dom.portraits.replaceChildren(); r.slots = {}; return ctx.next(); }
      if (item.type === "choice") return ctx.showChoices(item);
      seen.push(item);
      dom.text.innerHTML = item.text;
      if (item.portrait) { dom.portraits.replaceChildren(node(item.portrait)); r.slots = { [item.portrait]: 0 }; }
    },
  };
  vm.createContext(ctx); vm.runInContext(engine.slice(start, end), ctx);
  const readToChoice = () => { while (ctx.running && !r.waitingChoice && r.hesitation && r.queue.length) ctx.next(); };
  const choose = index => ctx.pickChoice(r.choiceLine, r.choiceLine.choices[index]);
  return { ctx, r, owner, rest, line, dom, portrait, seen, applied, choose, readToChoice };
}
let count = 0;
function check(name, run) { run(); console.log(`ok ${++count} - ${name}`); }
check("正式8人: 二段確認と全員への謝罪を読み終えるまで遷移しない", () => {
  for (const id of ids) {
    const s = setup(id, ids.filter(other => other !== id));
    const original = JSON.stringify(s.owner);
    s.choose(0); s.readToChoice();
    assert.equal(s.r.hesitation.model.stage, "remember");
    assert.equal(s.applied.length, 0); assert.equal(JSON.stringify(s.owner), original);
    assert.equal(s.seen.filter(line => line.portrait).length, 7);
    s.choose(1); s.readToChoice();
    assert.equal(s.r.hesitation.model.stage, "decide");
    assert.equal(JSON.stringify(s.owner), original);
    s.choose(1);
    assert.equal(s.applied.length, 0); assert.equal(JSON.stringify(s.owner), original);
    s.readToChoice();
    assert.equal(s.applied.length, 1); assert.deepEqual(s.r.visited, [`confession_${id}_accept`]);
    const apologies = s.seen.filter(line => line.text.includes("ごめん") || (line.text.endsWith("……）") && !line.text.includes("まだ")));
    const text = apologies.map(line => line.text).join("");
    for (const lover of ids.filter(other => other !== id)) assert(text.includes(model.loverCallName(lover, s.owner)));
    assert.equal(s.dom.portraits.childNodes[0], s.portrait);
  }
});
check("両段階の取消: 元の選択・表示・立ち絵・残り行を戻す。拒否は確定しない", () => {
  for (const stage of [1, 2]) {
    const s = setup(); const before = JSON.stringify(s.owner);
    s.choose(0); s.readToChoice();
    if (stage === 2) { s.choose(1); s.readToChoice(); }
    s.choose(0);
    assert.equal(s.r.choiceLine, s.line); assert.equal(s.r.queue, s.rest);
    assert.equal(s.dom.text.innerHTML, "元の表示"); assert.equal(s.dom.portraits.childNodes[0], s.portrait);
    assert.equal(JSON.stringify(s.owner), before); assert.equal(s.applied.length, 0);
    s.choose(1); assert.equal(s.applied.length, 1); assert(s.r.visited[0].endsWith("_reject"));
  }
});
check("♥質問: 元回答へ一度だけ適用し、謝罪・友情確定・恋人成立を混ぜない", () => {
  const s = setup("noor", ["ageha"], true);
  s.choose(0); s.readToChoice(); s.choose(1); s.readToChoice(); s.choose(1);
  assert.equal(s.applied.length, 1); assert.equal(s.owner.romanceChoices.bond_q1_noor.value, 1);
  assert.deepEqual(s.owner.lovers, ["ageha"]); assert.equal(s.seen.some(line => line.text.includes("ごめん")), false);
});
check("LOAD・恋人変更・古い二度押しで確認を流用しない", () => {
  for (const duringApology of [false, true]) {
    const s = setup(); s.choose(0); s.readToChoice();
    if (duringApology) { s.choose(1); s.readToChoice(); s.choose(1); }
    s.ctx.state = { ...s.owner };
    if (duringApology) s.ctx.next(); else s.choose(1);
    assert.equal(s.applied.length, 0); assert.deepEqual(s.owner.lovers, ["tsumugi"]);
  }
  const s = setup(); s.choose(0); s.readToChoice();
  const staleLine = s.r.choiceLine, staleChoice = staleLine.choices[1];
  s.choose(1); s.readToChoice(); s.ctx.pickChoice(staleLine, staleChoice);
  assert.equal(s.r.hesitation.model.stage, "decide"); assert.equal(s.applied.length, 0);
  s.owner.lovers.push("noor"); s.choose(1); assert.equal(s.ctx.cancelled, true); assert.equal(s.applied.length, 0);
});
check("独身・同一恋人・拒否・友情は従来の選択だけを適用", () => {
  for (const lovers of [[], ["ageha"]]) { const s = setup("ageha", lovers); s.choose(0); assert.equal(s.applied.length, 1); assert.equal(s.r.hesitation, undefined); }
  const s = setup(); s.choose(1); assert.equal(s.applied.length, 1); assert.equal(s.r.hesitation, undefined);
  const q = setup("noor", ["ageha"], true); q.choose(1); assert.equal(q.applied.length, 1); assert.equal(q.r.hesitation, undefined);
});
check("夜の告白の旧警告の罪悪感+1は承認の読了後だけ、一度だけ", () => {
  const s = setup(); s.r.romanceWarningGuilt = true; s.owner.guilt = 4;
  s.choose(0); s.readToChoice(); s.choose(1); s.readToChoice(); s.choose(1);
  assert.equal(s.owner.guilt, 4); s.readToChoice(); assert.equal(s.owner.guilt, 5);
  assert.equal(s.applied.length, 1);
  const cancelled = setup(); cancelled.r.romanceWarningGuilt = true; cancelled.owner.guilt = 4;
  cancelled.choose(0); cancelled.readToChoice(); cancelled.choose(0); assert.equal(cancelled.owner.guilt, 4);
});
console.log(`${count} groups passed (real engine controller, simulated DOM; browser/media QA still required)`);
