import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("ch2-choice-echoes", async check => {
  await check("real-choices-rest-and-night-resume", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const vn = await import("./js/vn/engine.js");
      const { DB } = await import("./js/core/data.js");
      const { restAtHome } = await import("./js/daily/spots.js");
      const { loadPreparationDialogues } = await import("./js/chapters/ch2-city-data.js");
      const { chapterTwoNights } = await import("./js/chapters/ch2-story.js");
      (await import("./js/chapters/ch1.js")).setupHooks();
      await loadPreparationDialogues();
      vn.vnTest.turbo = true;
      const rows = [];
      for (const kind of ["half-listen", "day-hurt", "unrecorded", "old-completed"]) {
        const s = core.newGame();
        Object.assign(s, { chapter: 2, day: 27, slot: 2 });
        s.flags._ch2_taste_distant = true;
        for (const id of ["hajime", "sumi", "naru", "tsumugi", "ageha"]) {
          s.met[id] = true; s.flags[`_intro_${id}`] = true;
        }
        vn.vnTest.choose = () => kind === "half-listen" ? 0 : 1;
        if (kind !== "unrecorded") {
          await restAtHome({ stamina: 30 }, { fullDay: kind === "day-hurt" });
          await vn.play("ch2_naru_confrontation");
        }
        // Resume at the arrival checkpoint, not by jumping directly into the added scene.
        s.flags._ch2_read_ch2_tsumugi_color = true;
        s.flags._ch2_read_remake_ch2_eve_arrival = true;
        if (kind === "old-completed") s.flags._ch2_read_ch2_pre_tournament_realisation = true;
        core.save(); core.newGame(); core.load();
        const resources = () => structuredClone({ stats: core.state.stats, money: core.state.money,
          stamina: core.state.stamina, lovers: core.state.lovers });
        const before = resources(), lines = [], entries = [];
        vn.hooks.onLine = (id, line) => { if (id === "remake_ch2_eve_choices" && line.text) lines.push(line.text); };
        vn.hooks.onEnter = id => entries.push(id);
        await chapterTwoNights(15)[27].run();
        core.save(); core.newGame(); core.load();
        await chapterTwoNights(15)[27].run();
        rows.push({ kind, lines, entries, flags: structuredClone(core.state.flags), before, after: resources() });
      }
      // A chapter-one rest and a rest interrupted by loading another owner cannot invent a chapter-two memory.
      vn.hooks.onLine = null;
      core.newGame(); await restAtHome({ stamina: 10 });
      const chapterOne = !!core.state.flags._ch2_rest_taken;
      const interrupted = core.newGame(); interrupted.chapter = 2;
      vn.hooks.onLine = () => { const s = core.newGame(); s.chapter = 2; vn.hooks.onLine = null; };
      await restAtHome({ stamina: 10 });
      const interruptedMarked = !!interrupted.flags._ch2_rest_taken || !!core.state.flags._ch2_rest_taken;
      const scene = DB.dialogues.remake_rest;
      delete DB.dialogues.remake_rest;
      await restAtHome({ stamina: 10 });
      const missingMarked = !!core.state.flags._ch2_rest_taken;
      DB.dialogues.remake_rest = scene;
      return { rows, chapterOne, interruptedMarked, missingMarked };
    });
    assert(!result.chapterOne && !result.interruptedMarked && !result.missingMarked);
    for (const row of result.rows) {
      assert.deepEqual(row.after, row.before, "振り返りで能力・所持金・体力・関係値を増やさない");
      assert(row.flags._ch2_taste_distant, "休息や会話で味覚の不調を消さない");
      const text = row.lines.join("\n");
      if (row.kind === "half-listen" || row.kind === "day-hurt") {
        assert(row.flags._ch2_rest_taken);
        assert.match(text, /休んだ時間/);
        assert.equal(row.entries.filter(id => id === "remake_ch2_eve_choices").length, 1, "再開で繰り返さない");
        if (row.kind === "half-listen") {
          assert.match(text, /約束をした/); assert.doesNotMatch(text, /謝ったまま/);
          assert(row.flags._ch2_no_audience);
        } else {
          assert.match(text, /謝ったまま/); assert.doesNotMatch(text, /約束をした/);
          assert(row.flags._ch2_audience_welcome);
        }
      } else {
        assert.deepEqual(row.lines, []);
        assert(!row.entries.includes("remake_ch2_eve_choices"), "旧セーブに未記録の行動や読了後の振り返りを足さない");
      }
    }
  }, { reducedMotion: "reduce" });
});
