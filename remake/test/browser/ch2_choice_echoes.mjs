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
          // 休みの店の前のLIME（ch2_naru_window）を読んでいない進行は、送っていない返事を待たない（#2720）
          assert.match(text, /俺から連絡する/); assert.doesNotMatch(text, /今どこにいますか|返事/);
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

  await check("mandatory-work-choices-and-interrupted-save", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const vn = await import("./js/vn/engine.js");
      const { chapterTwoNights } = await import("./js/chapters/ch2-story.js");
      const { loadPreparationDialogues } = await import("./js/chapters/ch2-city-data.js");
      (await import("./js/chapters/ch1.js")).setupHooks();
      await loadPreparationDialogues(); vn.vnTest.turbo = true;
      const resources = () => structuredClone({ stats: core.state.stats, money: core.state.money,
        stamina: core.state.stamina, affinity: core.state.affinity, inventory: core.state.inventory,
        lovers: core.state.lovers, tasteDistant: core.state.flags._ch2_taste_distant });
      const abs = day => 15 + day - 1;
      const fresh = (flags = {}) => {
        const s = core.newGame();
        Object.assign(s, { chapter: 2, phase: "daily", day: abs(3), slot: 2, money: 0, stamina: 0 });
        Object.assign(s.flags, { _ch2_day1: { startDay: 15 }, _ch2_taste_distant: true,
          _ch2_read_ch2_sofa_burn: true, _ch2_read_remake_ch2_ageha_scout: true,
          _ch2_read_remake_ch2_ageha_slump: true, ...flags });
        for (const id of ["hajime", "sumi", "naru", "salaryman"]) {
          s.met[id] = true; s.flags[`_intro_${id}`] = true;
        }
        return s;
      };
      const reload = () => { core.save(); core.newGame(); core.load(); };
      const run = async day => {
        core.state.day = abs(day);
        await chapterTwoNights(15)[abs(day)].run();
      };
      const rows = [];
      for (const index of [0, 1]) {
        fresh();
        const before = resources(), lines = [], entered = [], choices = [];
        vn.hooks.onEnter = id => entered.push(id);
        vn.vnTest.choose = (id, texts) => {
          choices.push(id);
          return id === "ch2_naru_confrontation" ? 1 - index : index;
        };
        // Save after the actual question choice but before the cup finishes. A role
        // choice is likewise retained without treating its unfinished work as read.
        const abortAtChoice = async (id, flag) => {
          const controller = new AbortController();
          let aborted = false;
          vn.hooks.onLine = (scene, line) => {
            if (scene === id && core.state.flags[flag] && !aborted) {
              aborted = true;
              setTimeout(() => { core.save(); controller.abort(); }, 0);
            }
          };
          const played = await vn.play(id, { signal: controller.signal });
          const pending = structuredClone(core.state.flags);
          core.newGame(); core.load();
          return { cancelled: !!played.cancelled, pending };
        };
        const warmFlag = index ? "_ch2_naru_warm_customers" : "_ch2_naru_warm_flavor";
        const warmPending = await abortAtChoice("ch2_naru_warm", warmFlag);
        vn.hooks.onLine = (id, line) => { if (line.text) lines.push([id, line.text]); };
        // If the replay offered the question again this would pick the other answer.
        vn.vnTest.choose = id => { choices.push(id); return 1 - index; };
        await run(3); reload(); await run(3);
        const warmDone = structuredClone(core.state.flags);

        core.state.day = abs(6);
        vn.vnTest.choose = id => { choices.push(id); return index; };
        const roleFlag = index ? "_ch2_coal_role_plate" : "_ch2_coal_role_coals";
        const rolePending = await abortAtChoice("ch2_coal_together", roleFlag);
        vn.hooks.onLine = (id, line) => { if (line.text) lines.push([id, line.text]); };
        vn.vnTest.choose = id => { choices.push(id); return 1 - index; };
        await run(6); reload(); await run(6);
        await run(10); await run(11);
        rows.push({ index, before, after: resources(), lines, entered, choices,
          warmPending, warmDone, rolePending, flags: structuredClone(core.state.flags) });
      }
      // A legacy completion record alone cannot invent which question/role happened.
      fresh({ _ch2_read_ch2_naru_warm: true, _ch2_naru_warm_done: true,
        _ch2_read_ch2_coal_together: true, _ch2_night_6_done: true });
      const legacyLines = [], legacyEntries = [];
      vn.hooks.onLine = (id, line) => { if (line.text) legacyLines.push([id, line.text]); };
      vn.hooks.onEnter = id => legacyEntries.push(id);
      const nightEvents = await import("./js/daily/night-events.js");
      for (const day of [3, 6]) {
        core.state.day = abs(day);
        const events = chapterTwoNights(15);
        await nightEvents.runNightPlan(events, async () => {});
      }
      await run(10); await run(11);
      vn.hooks.onLine = null;
      return { rows, legacyLines, legacyEntries, warnings: vn.getVnWarnings() };
    });
    assert.deepEqual(result.warnings, [], "all new choice/condition branches resolve in the real VN");
    for (const row of result.rows) {
      assert.deepEqual(row.after, row.before, "mandatory work gives no costs, rewards, relationships or taste cure");
      assert(row.warmPending.cancelled && row.rolePending.cancelled);
      assert(!row.warmPending.pending._ch2_read_ch2_naru_warm && !row.warmPending.pending._ch2_naru_warm_done);
      assert(!row.rolePending.pending._ch2_read_ch2_coal_together && !row.rolePending.pending._ch2_night_6_done);
      assert(row.warmDone._ch2_read_ch2_naru_warm && row.warmDone._ch2_naru_warm_done);
      assert.equal(!!row.warmDone._ch2_naru_warm_flavor, row.index === 0);
      assert.equal(!!row.warmDone._ch2_naru_warm_customers, row.index === 1);
      assert(row.flags._ch2_read_ch2_coal_together && row.flags._ch2_read_ch2_lingering_smell && row.flags._ch2_night_6_done);
      assert.equal(!!row.flags._ch2_coal_role_coals, row.index === 0);
      assert.equal(!!row.flags._ch2_coal_role_plate, row.index === 1);
      assert.equal(row.choices.filter(id => id === "ch2_naru_warm").length, 1, "the interrupted question is not chosen again");
      assert.equal(row.choices.filter(id => id === "ch2_coal_together").length, 1, "the interrupted role is not chosen again");
      assert.equal(row.entered.filter(id => id === "ch2_naru_warm").length, 2, "only the interrupted cup is replayed, not the completed one");
      assert.equal(row.entered.filter(id => id === "ch2_coal_together").length, 2);
      const warm = row.lines.filter(([id]) => id === "ch2_naru_confrontation").map(([, text]) => text).join("\n");
      const work = row.lines.filter(([id]) => id === "ch2_sumi_silence").map(([, text]) => text).join("\n");
      assert.match(warm, row.index ? /祝いの夜に聞いた注文/ : /最後まで軽く吸えるバニラ/);
      assert.doesNotMatch(warm, row.index ? /最後まで軽く吸えるバニラ/ : /祝いの夜に聞いた注文/);
      assert.match(work, row.index ? /俺は金属の皿を構える/ : /俺が炭を確認し/);
      assert.doesNotMatch(work, row.index ? /俺が炭を確認し/ : /俺は金属の皿を構える/);
      assert.equal(!!row.flags._ch2_naru_hurt, row.index === 0, "DAY11 response remains separate from the DAY3 question");
      assert.equal(!!row.flags._ch2_naru_listened, row.index === 1);
    }
    const legacy = result.legacyLines.map(([, text]) => text).join("\n");
    assert.doesNotMatch(legacy, /祝いの夜に聞いた注文|最後まで軽く吸えるバニラ|俺は金属の皿を構える|俺が炭を確認し/);
    assert(!result.legacyEntries.some(id => ["ch2_naru_warm", "ch2_coal_together", "ch2_lingering_smell"].includes(id)),
      "completed legacy nights are not reopened to insert the strengthened scenes");
  }, { reducedMotion: "reduce" });
});
