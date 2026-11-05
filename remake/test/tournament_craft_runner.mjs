import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../js/chapters/tournament-craft-runner.js", import.meta.url), "utf8");
const calls = [];
const context = vm.createContext({});
const runner = new vm.SourceTextModule(source, { context });
await runner.link(spec => {
  const values = spec.endsWith("/state.js") ? { save: () => calls.push("save") }
    : spec.endsWith("/growth.js") ? { awardTournamentExp: rank => calls.push(`exp:${rank}`) }
      : spec.endsWith("/score.js") ? { computeShisha: () => { calls.push("aroma"); return { aroma: 7 }; } }
        : { clearComments: () => calls.push("comments") };
  return new vm.SyntheticModule(Object.keys(values), function () {
    for (const [name, value] of Object.entries(values)) this.setExport(name, value);
  }, { context });
});
await runner.evaluate();
const { advanceTournamentCraft } = runner.namespace;
const state = {};
const milestones = new Map([[9, 1], [10, 2]]);
const progress = { step: 8, stage: "craft" };
const craft = {};
const finishStep = () => { calls.push("finish"); progress.step++; };
assert.equal(advanceTournamentCraft({ state, progress, craft, finishStep, milestones,
  onMilestone: round => { calls.push(`vote:${round}`); progress.stage = "votes"; } }), true);
assert.deepEqual(calls, ["aroma", "finish", "comments", "vote:1", "save"]);
assert.equal(craft.tournamentStory.servedAroma, 7);
assert.equal(progress.stage, "votes");

calls.length = 0;
progress.step = 9;
progress.stage = "craft";
assert.equal(advanceTournamentCraft({ state, progress, craft, finishStep, milestones,
  onMilestone: round => calls.push(`vote:${round}`) }), true);
assert.deepEqual(calls, ["finish", "comments", "vote:2", "save"]);

calls.length = 0;
progress.step = 8;
craft.failed = "heat";
assert.equal(advanceTournamentCraft({ state, progress, craft, finishStep, milestones,
  onMilestone: () => assert.fail("failed craft cannot vote") }), false);
assert.deepEqual(calls, ["finish", "exp:4", "save"]);
console.log("tournament craft runner: aroma, commit, milestone, failure order PASS");

// 章別の投票境界は SAVE に残る stage と対応する。台詞読了前の票は投入しない。
for (const [chapter, expected] of [
  [2, [[8, 0], [9, 1], [10, 2], [11, 3]]],
  [3, [[8, 0, "milestone"], [9, 1, "national_craft"], [10, 2, "national_adjustment"], [11, 3, "milestone"]]],
]) {
  const chapterSource = fs.readFileSync(new URL(`../js/chapters/ch${chapter}-tournament.js`, import.meta.url), "utf8");
  const votes = [];
  const chapterContext = vm.createContext({});
  const module = new vm.SourceTextModule(chapterSource + "\nexport { VOTE_BOUNDARIES };" + (chapter === 3 ? "export { voteAfterDialogue };" : ""), { context: chapterContext });
  await module.link(spec => {
    const names = spec === "../craft/broadcast.js" ? ["block", "clearComments"]
      : [...chapterSource.matchAll(/import\s*\{([^}]+)\}\s*from\s*"([^"]+)"/g)]
        .filter(match => match[2] === spec).flatMap(match => match[1].split(",").map(name => name.trim()));
    const values = {
      state: {}, createChapterActions: () => ({ button() {}, perform() {} }),
      castVotes: (_progress, round, quality) => { votes.push([round, quality]); return true; },
      computeShisha: () => ({ craftQuality: 80 }), difficultyForRun: () => 0, difficultyEvidence: () => ({}),
    };
    return new vm.SyntheticModule(names, function () {
      for (const name of names) this.setExport(name, values[name] ?? (() => {}));
    }, { context: chapterContext });
  });
  await module.evaluate();
  const boundaries = [...module.namespace.VOTE_BOUNDARIES].map(([step, value]) => chapter === 2
    ? [step, value] : [step, value.round, value.after]);
  assert.deepEqual(JSON.parse(JSON.stringify(boundaries)), expected);
  assert.deepEqual(votes, [], `chapter ${chapter}: declaring milestones must not cast votes`);
  if (chapter === 3) {
    const progress = { craft: { holes: { score: 80 }, heat: { score: 80 }, careHistory: [{ score: 80 }] } };
    module.namespace.voteAfterDialogue(progress, "national_craft");
    module.namespace.voteAfterDialogue(progress, "national_adjustment");
    assert.deepEqual(votes, [[1, 80], [2, 80]]);
  }
}
console.log("chapter 2/3 vote boundaries: four rounds and dialogue checkpoints PASS");
