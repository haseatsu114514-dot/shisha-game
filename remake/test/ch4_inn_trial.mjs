import assert from "node:assert/strict";
import { INN_TRIAL_IDS, INN_TRIAL_FLAG, innTrialDue, innTrialResult } from "../js/chapters/ch4-inn-trial.js";
import { readFileSync } from "node:fs";

const value = { chapter: 4, phase: "daily", day: 49, flags: { _ch4: { part: "free", startDay: 49 } } };
for (const day of [1, 2, 9, 12]) {
  value.day = 48 + day;
  assert.equal(innTrialDue(value), false, `DAY${day} has no trial`);
}
for (const day of [3, 4, 8]) {
  value.day = 48 + day;
  assert.equal(innTrialDue(value), true, `DAY${day} can make the trial`);
}
value.flags[INN_TRIAL_FLAG] = { result: "rough", feedbackRead: false, day: 3 };
value.day = 60;
assert.equal(innTrialDue(value), true, "An interrupted feedback resumes after the date window");
value.flags[INN_TRIAL_FLAG].feedbackRead = true;
assert.equal(innTrialDue(value), false, "The finished cup cannot be repeated");
value.flags._ch4.part = "eve";
value.flags[INN_TRIAL_FLAG].feedbackRead = false;
assert.equal(innTrialDue(value), false, "The trial does not intrude on the eve");

assert.equal(innTrialResult({ failed: true }), "failed");
assert.equal(innTrialResult({ holes: { score: 68 }, heat: { score: 68 } }, 68), "good");
assert.equal(innTrialResult({ holes: { score: 67 }, heat: { score: 68 } }, 68), "rough");
const ids = new Set(JSON.parse(readFileSync(new URL("../../data/dialogue/ch4_dubai_daily.json", import.meta.url))).dialogues.map(row => row.dialogue_id));
for (const id of INN_TRIAL_IDS) assert(ids.has(id), `Missing trial dialogue: ${id}`);
console.log("ch4 inn trial: DAY3-8, interrupted feedback, one-shot and three grades PASS");
