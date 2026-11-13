import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { REHEARSAL_FLAG, REHEARSAL_IDS, rehearsalDue, rehearsalResult } from "../js/chapters/ch4-rehearsal.js";
import { INN_TRIAL_FLAG } from "../js/chapters/ch4-inn-trial.js";

const value = { chapter: 4, phase: "daily", day: 49, flags: { _ch4: { part: "free", startDay: 49 } } };
for (const day of [1, 3, 8, 11, 13, 14]) {
  value.day = 48 + day;
  assert.equal(rehearsalDue(value), false, `DAY${day} cannot start`);
}
value.day = 60;
assert.equal(rehearsalDue(value), true, "DAY12 can start");
value.flags[INN_TRIAL_FLAG] = { result: "good", feedbackRead: true };
assert.equal(rehearsalDue(value), true, "The inn trial does not consume rehearsal");
value.flags[REHEARSAL_FLAG] = { result: "rough", feedbackRead: false };
value.day = 61;
assert.equal(rehearsalDue(value), true, "Unfinished feedback resumes after DAY12");
value.flags[REHEARSAL_FLAG].feedbackRead = true;
assert.equal(rehearsalDue(value), false, "Completed rehearsal is one-shot");
value.flags[REHEARSAL_FLAG].feedbackRead = false;
value.flags._ch4.part = "eve";
assert.equal(rehearsalDue(value), false, "The eve is not a free inn visit");
value.flags._ch4.part = "free";
delete value.flags[REHEARSAL_FLAG];
delete value.flags[INN_TRIAL_FLAG];
assert.equal(rehearsalDue(value), false, "Missed rehearsal does not block DAY13");

const cs = score => ({ holes: { score }, heat: { score }, careHistory: [{ score }, { score }] });
const quality = amount => () => ({ craftQuality: amount });
assert.equal(rehearsalResult(cs(85), quality(85)), "great");
assert.equal(rehearsalResult(cs(84), quality(89)), "great", "Five scores are averaged");
assert.equal(rehearsalResult(cs(84), quality(88)), "good");
assert.equal(rehearsalResult(cs(68), quality(68)), "good");
assert.equal(rehearsalResult(cs(67), quality(67)), "rough");
assert.equal(rehearsalResult({ failed: true }, () => { throw new Error("Burnt cup must not be scored"); }), "burnt");

const dialogue = JSON.parse(readFileSync(new URL("../../data/dialogue/ch4_dubai_daily.json", import.meta.url)));
const ids = new Set(dialogue.dialogues.map(row => row.dialogue_id));
for (const id of REHEARSAL_IDS) assert(ids.has(id), `Missing rehearsal dialogue: ${id}`);
console.log("ch4 rehearsal: DAY12, grades, one-shot, feedback resume and independent flags PASS");
