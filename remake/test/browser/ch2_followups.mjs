// Real map/paidAction/calendar/save path, plus interruption before normal VN termination.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits } from "./support.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const evidence = path.resolve(root, process.env.ARTIFACT_DIR || ".codex/artifacts/ch2-followups");
fs.mkdirSync(evidence, { recursive: true });
const map = '[data-destination-selection]:not(.done)';
const t = name => `[data-test="${name}"]`;
const data = JSON.parse(fs.readFileSync(path.join(root, "data/dialogue/ch2_preparation.json")));
const followups = Object.fromEntries(data.dialogues.filter(d => d.dialogue_id.endsWith("_followup")).map(d => [d.dialogue_id, d]));
const current = page => page.evaluate(() => structuredClone(window.__remake.state));
async function setup(page, id, stop = null) {
  await page.evaluate(async ({ id, stop }) => {
    const core = await import("./js/core/state.js");
    const v = core.newGame();
    Object.assign(v, { chapter: 2, phase: "daily", day: 16, slot: 0, money: 36000, stamina: 100, weatherSeed: 7 });
    v.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    v.flags = { _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
      _ch2_preparation_started: true, _ch2_region: "widehanga", _morning_16: true,
      _ch2_talks: { [id]: 9 }, _lime_tut: 1, _lime_opened: true,
      _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    for (const who of ["ageha", "kumicho", "rei"]) { v.met[who] = true; v.flags[`_intro_${who}`] = true; }
    v.visits[id] = 97; v.contacts = ["sumi", "ageha"]; v.flags._lime_contact_ageha = true;
    v.lovers = ["minto"]; v.loverSince = { minto: 10 }; v.relationshipMemories = ["qa_old_memory"];
    v.keepsakes = ["qa_old_keepsake"]; v.flavorStock = { mint: 21.5, double_apple: 6 };
    core.save();
    window.__remake.vnTest.turbo = true;
    (await import("./js/chapters/ch1.js")).setupHooks();
    window.__followupTrace = []; window.__followupCount = 0; window.__followupStopped = false;
    const vn = await import("./js/vn/engine.js");
    vn.hooks.onLine = (scene, line) => {
      window.__followupTrace.push({ scene, speaker: line.speaker, face: line.face, text: line.text });
      if (scene !== `remake_ch2_${id}_followup`) return;
      window.__followupCount++;
      if (window.__followupCount === stop) { window.__remake.vnTest.turbo = false; window.__followupStopped = true; }
    };
    void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
  }, { id, stop });
  await page.locator(map).waitFor();
}
async function go(page, id, touch) {
  if (touch) await page.locator(t(`pin-ch2_${id}`)).tap(); else await page.locator(t(`pin-ch2_${id}`)).click();
  if (touch) await page.locator(t("map-go")).tap(); else await page.locator(t("map-go")).click();
}
async function reload(page) {
  await page.reload(); await page.locator(t("title-load")).click(); await page.locator(t("slot-0")).click();
  await page.locator(map).waitFor();
  await page.evaluate(() => { window.__remake.vnTest.turbo = true; });
}
function unchangedRecords(before, after) {
  for (const key of ["lovers", "loverSince", "relationshipMemories", "keepsakes", "flavorStock", "contacts", "equipment"]) {
    assert.deepEqual(after[key], before[key], key);
  }
}
await suite("ch2-followups", async check => {
  for (const id of ["ageha", "kumicho", "rei"]) {
    await check(`${id}-legacy-save-completion-and-reload`, async page => {
      await setup(page, id); const before = await current(page);
      await go(page, id, id === "rei");
      await page.waitForFunction(() => window.__remake.state.slot === 1); await page.locator(map).waitFor();
      const after = await current(page);
      assert.equal(after.money, before.money - 3000); assert.equal(after.flags._ch2_talks[id], 10);
      assert.equal(after.visits[id], 98); assert.equal(after.flags._ch2_followup_done[id], true);
      assert.equal(after.visitedDay[`ch2_${id}`], 16); assert(after.stamina < before.stamina);
      assert.equal(Object.values(after.stats).reduce((a,b) => a+b,0),156, "One normal growth candidate, no dialogue bonus");
      unchangedRecords(before,after);
      const trace = await page.evaluate(() => window.__followupTrace);
      assert.deepEqual(trace.filter(l => l.scene === `remake_ch2_${id}_followup`).map(({ speaker, face, text }) => ({ speaker, face, text })), followups[`remake_ch2_${id}_followup`].lines);
      await page.locator(t(`pin-ch2_${id}`)).click(); assert.equal(await page.locator(t("map-go")).count(),0);
      await reload(page); const saved = await current(page);
      for (const key of ["money","stats","slot","visitedDay","visits","flags","reel"]) assert.deepEqual(saved[key], after[key], key);
    }, id === "rei" ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});
    for (const stop of [{ ageha: 6, kumicho: 5, rei: 7 }[id], followups[`remake_ch2_${id}_followup`].lines.length]) {
      await check(`${id}-interrupt-at-line-${stop}`, async page => {
        await setup(page,id,stop); const before = await current(page);
        await go(page,id); await page.waitForFunction(() => window.__followupStopped);
        await page.locator("#vn.active .vn-text").waitFor();
        assert.equal((await current(page)).flags._ch2_followup_done?.[id],undefined);
        assert.equal((await current(page)).money,before.money,"No charge before normal termination");
        await page.locator("#vn.active .vn-next.show").waitFor();
        await assertFits(page,".vn-box");
        await page.screenshot({path:path.join(evidence,`${id}-line-${stop}-current-art.png`)});
        await reload(page); const after = await current(page);
        for (const key of ["money","stamina","stats","slot","visitedDay","visits"]) assert.deepEqual(after[key],before[key],key);
        assert.equal(after.flags._ch2_followup_done?.[id],undefined); unchangedRecords(before,after);
        await go(page,id); await page.waitForFunction(() => window.__remake.state.slot === 1);
        assert.equal((await current(page)).flags._ch2_followup_done[id],true);
      });
    }
  }
});
