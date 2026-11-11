// #2020 H: 穴あけの「外周24穴」を、スミさんの授業「四つ置き・混ぜ置き」（M-W2）で解放する。
// 教わる前は選べず、相談の場面を読んで習得すると次の一台から選べる。習得済みの旧セーブ・周回でも開いたまま。
// node remake/test/outer24_lesson.mjs
import assert from "node:assert/strict";
import fs from "node:fs";

globalThis.document ||= { addEventListener() {}, querySelector() { return null; } };
globalThis.window ||= {};
const store = new Map();
globalThis.localStorage ||= { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

const core = await import("../js/core/state.js");
const growth = await import("../js/core/growth.js");
const { LESSONS } = await import("../js/core/growth-board-data.js");
const { HOLE_TEMPLATES, availableHoleTemplates, DEFAULT_HOLE_TEMPLATE } = await import("../js/craft/holes_templates.js");
const { classifyFlag, flagVerdict } = await import("../js/core/carry.js");

const FLAG = "_hole_outer24_unlocked";
const ids = flags => availableHoleTemplates(flags).map(template => template.id);

// 1. 誰から何を学ぶか: 外周24穴を開くのはスミさんの M-W2 だけ（条件なし・第2章から・理論盤のスキル）
const outer = HOLE_TEMPLATES.find(template => template.id === "outer24");
assert.equal(outer?.unlockFlag, FLAG, "外周24穴は解放フラグ付きのテンプレート");
const teachers = LESSONS.filter(lesson => (lesson.unlocks || []).includes(FLAG));
assert.deepEqual(teachers.map(lesson => lesson.id), ["M-W2"], "外周24穴を開く授業は一つだけ");
const lesson = teachers[0];
assert.deepEqual([lesson.who, lesson.need, lesson.ring, lesson.board, lesson.reward, lesson.scene],
  ["sumi", 0, 2, "wisdom", "skill", "lesson_sumi_four"]);
assert.deepEqual(lesson.unlocks.slice(0, 2), ["_coal_four_unlocked", "_coal_mix_unlocked"], "既存の炭の解放はそのまま");
assert.match(lesson.text, /「外周24穴」/, "盤とTRAININGのカードで、次の制作で選べるものが分かる");

// 2. 教わる場面: 最後に外周の配置を短く教わる（台詞の規範: 48字以内・改行なし・話者付きの末尾に「。」なし）
const scenes = JSON.parse(fs.readFileSync(new URL("../../data/dialogue/growth_lessons.json", import.meta.url), "utf8")).dialogues;
const scene = scenes.find(row => row.dialogue_id === "lesson_sumi_four");
const at = scene.lines.findIndex(line => line.text === "炭を縁に回すなら、穴も外周に寄せる手がある");
assert(at > 0, "四つ置きの後に、穴の配置の話が続く");
const added = scene.lines.slice(at);
assert(added.length >= 3 && added.length <= 6, "教わる場面は数行");
assert(added.some(line => /二十四/.test(line.text)), "外周に二十四の穴");
for (const line of added) {
  assert(!line.text.includes("\n"), "手動改行なし");
  assert([...line.text].length <= 48, `48字以内: ${line.text}`);
  if (line.speaker) assert(!line.text.endsWith("。"), `台詞の末尾に「。」なし: ${line.text}`);
}

// 3. 教わる前は選べない → 盤で灯しただけでも選べない → 相談を終えると次の一台から選べる
core.newGame();
growth.setGrowthPreview(true);
assert.deepEqual(ids(core.state.flags), [DEFAULT_HOLE_TEMPLATE], "新しいゲームでは「外周12穴＋中周12穴」だけ");
growth.ensureGrowth().nodes.push("M-W2");
assert.equal(core.state.flags[FLAG], undefined, "灯しただけでは開かない（スミさんに相談して習得する）");
assert.deepEqual(growth.readyLessons("sumi").map(entry => entry.id), ["M-W2"], "シフト上がりにスミさんへ相談できる");
assert.equal(growth.learnLesson("M-W2"), true);
assert.equal(core.state.flags[FLAG], true);
assert.equal(core.state.flags._coal_four_unlocked, true);
assert.deepEqual(ids(core.state.flags), ["outer24", "outer12-middle12"], "習得後は外周24穴を選べる");
assert.equal(growth.learnLesson("M-W2"), false, "二重に習得しない");
// 一台の開始時に、その時点の解放でテンプレートを確定する（craft/session.js の newSession）
const session = fs.readFileSync(new URL("../js/craft/session.js", import.meta.url), "utf8");
assert.match(session, /availableHoleTemplateIds:\s*availableHoleTemplates\(state\.flags\)/);

// 4. SAVE/LOAD で開いたまま
core.save();
core.setState(core.load());
growth.ensureGrowth();
assert.equal(core.state.flags[FLAG], true, "LOAD後も外周24穴を選べる");

// 5. この変更より前に M-W2 を習得していた旧セーブは、読み込み時にフラグが立つ（もう一度相談しなくてよい）
{
  core.newGame();
  const g = growth.ensureGrowth();
  g.nodes.push("M-W2");
  g.learned.push("M-W2");
  core.state.flags._coal_four_unlocked = true;
  core.state.flags._coal_mix_unlocked = true;
  delete core.state.flags[FLAG];
  growth.ensureGrowth();
  assert.equal(core.state.flags[FLAG], true, "習得済みの旧セーブ");
}
// 習得していないセーブには立てない
{
  core.newGame();
  const g = growth.ensureGrowth();
  g.nodes.push("M-W2");
  growth.ensureGrowth();
  assert.equal(core.state.flags[FLAG], undefined, "灯しただけの旧セーブ");
  assert.deepEqual(ids(core.state.flags), [DEFAULT_HOLE_TEMPLATE]);
}

// 6. 周回: 恒久解放として持ち越す（盤の習得も持ち越すので食い違わない）
assert.equal(classifyFlag(FLAG), "unlock");
assert.equal(flagVerdict(FLAG), "carry");

console.log("outer24 lesson: M-W2 teaches the outer 24-hole layout, unlock after consult, save/load, legacy saves PASS");
