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
