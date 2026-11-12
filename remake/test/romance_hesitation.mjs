// 準備中の迷いモデル。node remake/test/romance_hesitation.mjs
// 会話エンジンへの接続・実画像での表示確認は別途必要。
import assert from "node:assert/strict";
import fs from "node:fs";
const source = fs.readFileSync(new URL("../js/core/romance-hesitation.js", import.meta.url), "utf8");
const { romanceIntent, otherLovers, loverCallName, apologyLines, createRomanceHesitation } =
  await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
const dialogues = Object.fromEntries(JSON.parse(fs.readFileSync(new URL("../../data/dialogue/confession.json", import.meta.url))).dialogues.map(d => [d.dialogue_id, d]));
const ids = ["minto", "tsumugi", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor"];
const base = (lovers = []) => ({ lovers, flags: { _minto_name_known: true }, romanceChoices: {} });
let count = 0;
function check(name, run) { run(); count++; console.log(`ok ${count} - ${name}`); }
check("8人の正式告白と拒否を文言でなく構造から区別", () => {
  for (const id of ids) {
    const scene = dialogues[`confession_${id}`];
    const line = scene.lines.find(l => l.type === "choice");
    const yes = line.choices.find(c => c.next_id === `confession_${id}_accept`);
    const no = line.choices.find(c => c !== yes);
    assert.deepEqual(romanceIntent(base(), scene.dialogue_id, line, yes, dialogues), { target: id, kind: "commit" });
    assert.equal(romanceIntent(base(), scene.dialogue_id, line, no, dialogues), null);
    assert.equal(romanceIntent(base(), "unrelated", line, yes, dialogues), null);
    assert.equal(romanceIntent(base(), scene.dialogue_id, line, yes, {}), null);
    assert.equal(romanceIntent(base(), scene.dialogue_id, line, { ...yes }, dialogues), null);
  }
});
check("♥質問は正の実数・未回答だけ。単語や好感度では推測しない", () => {
  const line = { id: "bond_q1_noor", romance_char: "noor", choices: [] };
  for (const value of [1, 2]) {
    const c = { romance: value, text: "友達" }; line.choices = [c];
    assert.deepEqual(romanceIntent(base(), "question", line, c), { target: "noor", kind: "court", choiceId: line.id });
    assert.equal(romanceIntent({ ...base(), romanceChoices: { [line.id]: { char: "noor", value: 1 } } }, "question", line, c), null);
  }
  for (const value of [0, -1, NaN, Infinity, "1", undefined]) {
    const c = { romance: value, text: "好き。付き合う" }; line.choices = [c];
    assert.equal(romanceIntent(base(), "question", line, c), null);
  }
});
check("独身・同じ恋人の再読では迷いなし。重複は人数にしない", () => {
  assert.equal(createRomanceHesitation(base(), { target: "noor", kind: "commit" }), null);
  assert.equal(createRomanceHesitation(base(["noor", "minto"]), { target: "noor", kind: "commit" }), null);
  assert.deepEqual(otherLovers(base(["minto", "minto", null, "", 42, "tsumugi"]), "noor"), ["minto", "tsumugi"]);
  assert.equal(createRomanceHesitation(base(["minto"]), { target: "unknown", kind: "commit" }), null);
});
check("呼称・名乗りの境界・凛想の立ち絵ID", () => {
  assert.equal(loverCallName("minto", base()), "栞さん");
  assert.equal(loverCallName("minto", { flags: {} }), "みんとさん");
  assert.deepEqual(ids.map(id => loverCallName(id, base())), ["栞さん", "つむぎちゃん", "凛想さん", "あげはさん", "ましろちゃん", "サメちゃん", "ひよりさん", "ヌールさん"]);
  const p = createRomanceHesitation(base(["rio", "unknown"]), { target: "noor", kind: "commit" });
  assert.equal(p.view().memories[0].portrait.id, "rin");
  assert.equal(p.view().memories[1].portrait, null);
  assert.equal(p.view().memories[1].name, "あの人");
});
check("両段階で戻れる。拒否・恋人成立・好感度・罪悪感・記録を一切変更しない", () => {
  for (const second of [false, true]) {
    const s = base(["minto"]), before = JSON.stringify(s);
    const p = createRomanceHesitation(s, { target: "noor", kind: "commit" });
    if (second) assert.equal(p.choose("continue", s).status, "pending");
    assert.equal(p.choose("cancel", s).status, "cancelled");
    assert.equal(p.choose("continue", s).status, "closed");
    assert.equal(JSON.stringify(s), before);
  }
});
check("2回の意思選択後のみ交際時に全員へ謝る。再クリックで適用を重ねない", () => {
  const s = base(["hiyori", "minto", "ageha", "tsumugi", "mashiro"]), before = JSON.stringify(s);
  const p = createRomanceHesitation(s, { target: "noor", kind: "commit" });
  assert.equal(p.choose("invalid", s).status, "ignored");
  assert.equal(p.choose("continue", s).status, "pending");
  const result = p.choose("continue", s);
  assert.equal(result.status, "accepted");
  assert.deepEqual(result.apology.map(l => l.text), ["（ひよりさん、栞さん、あげはさん、つむぎちゃん、ましろちゃん……ごめん）"]);
  assert.equal(p.choose("continue", s).status, "closed");
  assert.equal(JSON.stringify(s), before);
  const court = createRomanceHesitation(s, { target: "noor", kind: "court", choiceId: "bond_q1_noor" });
  court.choose("continue", s);
  assert.deepEqual(court.choose("continue", s).apology, []);
});
check("ロード・関係変化・途中での記録変更で古い確認を無効化", () => {
  for (const change of [
    s => structuredClone(s),
    s => { s.lovers.push("tsumugi"); return s; },
    s => { s.lovers.push("noor"); return s; },
    s => { s.flags._friend_noor = true; return s; },
    s => { s.flags._minto_name_known = false; return s; },
    s => { s.romanceChoices.bond_q1_noor = { char: "noor", value: 0 }; return s; },
  ]) {
    const s = base(["minto"]);
    const p = createRomanceHesitation(s, { target: "noor", kind: "court", choiceId: "bond_q1_noor" });
    p.choose("continue", s);
    assert.equal(p.choose("continue", change(s)).status, "stale");
    assert.equal(p.choose("continue", s).status, "closed");
  }
});
check("1〜8人の全員を順序どおりに保持し、画像なしでも文章は欠けない", () => {
  for (let n = 1; n <= ids.length; n++) {
    const names = ids.slice(0, n).map(id => loverCallName(id, base()));
    const lines = apologyLines(names);
    const text = lines.map(l => l.text).join("");
    assert.equal((text.match(/ごめん/g) || []).length, 1);
    let at = -1;
    for (const name of names) { const next = text.indexOf(name); assert.ok(next > at); at = next; }
    for (const l of lines) {
      assert.ok([...l.text].length <= 48, l.text);
      assert.equal(l.speaker, "hajime"); assert.equal(l.portrait, false);
      assert.ok(l.text.startsWith("（") && l.text.endsWith("）"));
      assert.ok(!l.text.includes("\n"));
    }
  }
});
console.log(`${count} groups passed (model only; VN integration and browser coverage pending)`);
