import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkRecords, changedRecords, dialogueRecords } from "../../../tools/check_changed_dialogue_layout.mjs";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const records = JSON.parse(fs.readFileSync(path.join(root, "remake/test/natural_wrap_cases.json"), "utf8"));
const old = dialogueRecords([{dialogue_id:"stable",lines:[{text:"そのまま"},{text:"前の台詞",inner:"元の本心"}]}]);
const current = dialogueRecords([{dialogue_id:"stable",lines:[{text:"そのまま"},{text:"次の台詞",inner:"元の本心"}]}]);
assert.deepEqual(changedRecords(old,current).map(r=>r.path), ["/0/lines/1"]);
assert.deepEqual(changedRecords(current,current), []);
const innerOnly = structuredClone(current); innerOnly[1].inner = "変更した本心";
assert.equal(changedRecords(current,innerOnly).length,1);
const report = await checkRecords(records, {
  output: process.env.ARTIFACT_DIR || path.join(root,"work/natural-wrap"),
  executablePath:process.env.CHROME_EXECUTABLE_PATH, playwrightModule:process.env.PLAYWRIGHT_MODULE,
});
assert.deepEqual(report.errors,[]);
assert.equal(report.results.length,16);
for (const result of report.results) {
  assert(result.fontReady);
  assert(result.viewportFits, JSON.stringify(result));
  assert.deepEqual(result.screenshotSize, result.viewport);
  assert(Math.abs(result.stage.width - 1280 * result.scale) < 0.01);
  assert(Math.abs(result.stage.height - 720 * result.scale) < 0.01);
  if (result.mode === "mobile") { assert.equal(result.width,998); assert.equal(result.scale,390/720); }
  assert(result.pages.every(p=>p.fits), JSON.stringify(result));
  if (result.key.includes(":age-check:") && ["normal","mobile"].includes(result.mode)) {
    assert.deepEqual(result.pages.map(p=>p.text), ["それと、すみません。研修中の身なので、\n念のため年齢確認をさせてください"]);
    assert.deepEqual(result.diagnostics,[]);
  }
  if (result.mode === "inner" || result.key.includes(":inner:")) assert(result.pages.every(p=>!p.text.includes("\n")));
  if (result.key.includes(":manual-tags:") && result.mode !== "inner") assert(result.pages.map(p=>p.text.replace(/\[\/?[a-z]+\]/g, "")).join("\n").includes("\n\n"));
}
console.log(`natural_wrap browser OK: ${report.results.length} record/mode renders`);
