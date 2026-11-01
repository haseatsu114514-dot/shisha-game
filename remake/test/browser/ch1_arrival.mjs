import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    window.A = {
      core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), chapter: await import("./js/chapters/ch1.js"),
      arrival: await import("./js/chapters/ch1-arrival.js"),
      intro: await import("./js/vn/intro.js"),
    };
    A.chapter.setupHooks(); A.vn.vnTest.turbo = true;
    A.trace = [];
    A.vn.hooks.onLine = (id, line) => A.trace.push({ id, text: line.text, key: line._seenKey });
    A.room = A.data.DB.dialogues.ch1_tournament_arrival.lines.find(l => l.text?.startsWith("出場者控室に入る。" )).text;
  });
}

await suite("ch1-arrival", async check => {
  const combinations = [[], ["minto"], ["rin"], ["tsumugi"],
    ["minto", "rin"], ["minto", "tsumugi"], ["rin", "tsumugi"], ["minto", "rin", "tsumugi"]];
  for (const lovers of combinations) await check(lovers.join("-") || "no-lover", async page => {
    await setup(page);
    const result = await page.evaluate(async lovers => {
      const s = A.core.newGame(); Object.assign(s, { phase: "tournament", day: 14, lovers, guilt: 3 });
      const before = JSON.stringify({ lovers: s.lovers, stats: s.stats, money: s.money, affinity: s.affinity });
      await A.arrival.playTournamentArrival();
      const first = A.trace.slice();
      await A.arrival.playTournamentArrival(); // another attempt
      A.core.saveToSlot("suien_remake_slot1"); A.core.newGame(); A.core.loadFromSlot("suien_remake_slot1");
      const after = A.trace.length;
      await A.arrival.playTournamentArrival();
      const loaded = A.core.state;
      return { first, trace: A.trace, afterLoad: A.trace.slice(after), room: A.room, before,
        after: JSON.stringify({ lovers: loaded.lovers, stats: loaded.stats, money: loaded.money, affinity: loaded.affinity }),
        guilt: loaded.guilt, flag: !!loaded.flags._shuraba_ch1 };
    }, lovers);
    const expected = lovers.length >= 2 ? `remake_shuraba_${lovers.length === 3 ? "all" : lovers.slice().sort().join("_")}` : null;
    const shuraba = result.first.filter(l => l.id.startsWith("remake_shuraba_"));
    assert.deepEqual([...new Set(shuraba.map(l => l.id))], expected ? [expected] : []);
    const roomAt = result.first.findIndex(l => l.text === result.room);
    assert(roomAt > 0);
    if (expected) {
      const start = result.first.findIndex(l => l.id === expected);
      const end = result.first.findLastIndex(l => l.id === expected);
      assert(start > 0 && end < roomAt, "entire conflict follows arrival and precedes room entry");
    }
    assert.equal(result.trace.filter(l => l.id.startsWith("remake_shuraba_")).length, shuraba.length, "retry and SAVE/LOAD never replay conflict");
    assert.equal(result.afterLoad.filter(l => l.text === result.room).length, 1);
    assert.equal(result.guilt, expected ? 4 : 3);
    assert.equal(result.flag, !!expected);
    assert.equal(result.after, result.before, "relationship, stats, affinity and money are unchanged");
    const arrivalLines = result.first.filter(l => l.id === "ch1_tournament_arrival");
    assert.equal(new Set(arrivalLines.map(l => l.key)).size, arrivalLines.length, "split parts never reuse a line key");
  });

  for (const alreadySeen of [false, true]) await check(`legacy-save-${alreadySeen ? "seen" : "unseen"}`, async page => {
    await setup(page);
    const result = await page.evaluate(async alreadySeen => {
      const s = A.core.newGame(); Object.assign(s, { schema: 7, phase: "tournament", day: 14, lovers: ["rin", "tsumugi"], guilt: 6 });
      if (alreadySeen) s.flags._shuraba_ch1 = true;
      A.core.save(); A.core.newGame(); A.core.load();
      await A.arrival.playTournamentArrival();
      A.core.save(); A.core.newGame(); A.core.load();
      await A.arrival.playTournamentArrival();
      return { scenes: [...new Set(A.trace.filter(l => l.id.startsWith("remake_shuraba_")).map(l => l.id))],
        guilt: A.core.state.guilt, flag: A.core.state.flags._shuraba_ch1, schema: A.core.state.schema, currentSchema: A.core.SCHEMA };
    }, alreadySeen);
    assert.deepEqual(result.scenes, alreadySeen ? [] : ["remake_shuraba_rin_tsumugi"]);
    assert.equal(result.guilt, alreadySeen ? 6 : 7);
    assert.equal(result.flag, true); assert.equal(result.schema, result.currentSchema);
  });

  await check("original-line-keys-and-branch-keys", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      const s = A.core.newGame(); s.phase = "tournament"; s.flags._ev_first_practice = true;
      await A.arrival.playTournamentArrival();
      const split = A.trace.slice(); A.trace.length = 0;
      await A.vn.play("ch1_tournament_arrival");
      return { split, unsplit: A.trace };
    });
    assert.deepEqual(result.split, result.unsplit, "original scene text, order, main keys and conditional branch keys remain identical");
  });
  await check("legacy-seen-only-skip-crosses-room-boundary", async page => {
    await setup(page);
    await page.evaluate(() => {
      const s = A.core.newGame(); s.phase = "tournament";
      s.lovers = ["minto", "rin"]; s.flags._shuraba_ch1 = true;
      const id = "ch1_tournament_arrival", dlg = A.data.DB.dialogues[id];
      A.oldKeys = [
        ...dlg.lines.map((_, i) => JSON.stringify([id, "main", i])),
        ...Object.entries(dlg.branches).flatMap(([branch, lines]) => lines.map((_, i) => JSON.stringify([id, branch, i]))),
      ];
      localStorage.setItem("suien_remake_seen_dialogue_lines", JSON.stringify(A.oldKeys));
      A.core.config.textSpeed = 4; A.core.config.skipSeenOnly = true;
      A.vn.vnTest.turbo = false;
      for (const char of ["naru", "adam", "minto"]) A.intro.markIntroSeen(char);
      A.done = false;
      A.run = A.arrival.playTournamentArrival().then(() => { A.done = true; });
    });
    await page.locator('#vn.active [data-test="vn-skip"]').click();
    await page.waitForFunction(() => A.done, null, { timeout: 20000 });
    const result = await page.evaluate(() => ({ trace: A.trace, keys: A.oldKeys, room: A.room }));
    assert(result.trace.every(l => result.keys.includes(l.key)), "old seen keys cover every displayed line");
    assert.equal(result.trace.filter(l => l.text === result.room).length, 1);
    assert.equal(result.trace.at(-1).id, "ch1_tournament_arrival");
    assert(!result.trace.some(l => l.id.startsWith("remake_shuraba_")));
  });
});
