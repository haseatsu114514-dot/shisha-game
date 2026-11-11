// ドバイ14日ルートの固定夜→実会話→共通の熱管理→世界大会の記憶。
// 日常の育成や既存の任意試作は回さず、章定義が返す実際の夜予定を実ブラウザで実行する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const observed = page => page.evaluate(async () => ({ ...structuredClone(window.__staffObserved),
  warnings: (await import("./js/vn/engine.js")).getVnWarnings() }));
const resources = page => page.evaluate(() => {
  const s = window.__remake.state, match = s.flags._ch4.match;
  return structuredClone({ ...Object.fromEntries([
    "chapter", "day", "slot", "phase", "money", "stamina", "stats", "statXp", "growth", "affinity", "affinityCarry",
    "flavorStock", "flavorMastery", "staffPractice", "owned", "equip", "visits", "visitedDay", "lovers", "recipes", "tournament",
  ].map(key => [key, s[key]])), worldVotes: match ? { votes: match.votes, baseVotes: match.baseVotes, voted: match.voted,
    result: match.result, history: match.history } : null });
});

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, phase: "cleared", day: 45, slot: 1, money: 0, stamina: 100, weatherSeed: 5 });
    Object.assign(value.flags, { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
      _ch3_tournament_won: true, _ch3_japan_first_representative: true, _ch4_strategy: "tea" });
    value.met.naru = true;
    value.affinity.naru = core.FIRST_HEART_POINTS;
    for (const id of ["hajime", "naru", "sumi"]) value.flags[`_intro_${id}`] = true;
    if (!progress.advanceToChapterFour(value)) throw new Error("Chapter 4 boundary failed");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES)
      if (!progress.completeChapterFourScene(value, id)) throw new Error(`Preparation fixture: ${id}`);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("Dubai departure failed");
    for (const id of ["ch4_opening", "ch4_arrival_inn"])
      if (!progress.completeChapterFourScene(value, id)) throw new Error(`Arrival fixture: ${id}`);
    // 既存の出会いは訪問済み。DAY9の再実行でFESTA等の別の期限救済を混ぜない。
    Object.assign(value.flags._ch4.read, { ch4_festa: true, ch4_dubai_souq: true,
      ch4_stranger_first: true, ch4_stranger_second: true });
    value.flags._ch4.firstDay = 1;
    value.day = value.flags._ch4.startDay + 2;
    value.flags._ch4.day = 3;
    value.slot = 2;
    value.phase = "daily";
    value.flags._ch2_region = "dubai";
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    if (!core.save() || !core.load()) throw new Error("Dubai fixture SAVE/LOAD failed");
  });
  assert.equal((await get(page)).flags._ch4.routeVersion, 2, "legacy five-day cards must not be used");
}

async function observe(page, { role, order, pauseAt = null }) {
  await page.evaluate(async options => {
    const vn = await import("./js/vn/engine.js");
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/craft/session.js")).craftTest.auto = null;
    const log = window.__staffObserved = { entries: [], lines: [], choices: [], paused: null };
    const enter = vn.hooks.onEnter, line = vn.hooks.onLine, choice = vn.hooks.onChoice;
    vn.hooks.onEnter = (id, source) => {
      enter?.(id, source);
      if (!id.startsWith("ch4_staff_")) return;
      log.entries.push(id);
      if (id === options.pauseAt) { vn.vnTest.turbo = false; log.paused = id; }
    };
    vn.hooks.onLine = (id, row) => {
      line?.(id, row);
      if (id.startsWith("ch4_staff_") && row.text) log.lines.push({ id, speaker: row.speaker, text: row.text });
    };
    vn.hooks.onChoice = (...args) => {
      choice?.(...args);
      if (args[0].startsWith("ch4_staff_")) log.choices.push({ scene: args[0], id: args[1], selected: args[2] });
    };
    vn.vnTest.turbo = true;
    vn.vnTest.choose = id => id === "ch4_staff_preparation" ? options.role : options.order;
  }, { role, order, pauseAt });
}

async function setDay(page, day) {
  await page.evaluate(async day => {
    const core = await import("./js/core/state.js"), s = core.state;
    s.day = s.flags._ch4.startDay + day - 1;
    s.flags._ch4.day = day;
    s.flags._ch4.part = day === 14 ? "tournament" : "free";
    s.phase = day === 14 ? "tournament" : "daily";
    s.slot = 2;
    core.save();
  }, day);
}

// 必須夜の取得もrunNightPlanも本番のもの。controllerを直接呼んで配線抜けを隠さない。
async function startNight(page, expected) {
  await page.evaluate(async expected => {
    const { state } = await import("./js/core/state.js");
    const { chapterFourDubaiDefinition } = await import("./js/chapters/ch4-dubai-daily.js");
    const { runNightPlan } = await import("./js/daily/night-events.js");
    const events = chapterFourDubaiDefinition({}).nightEvents, event = events[state.day];
    if (expected ? event?.id !== `dubai-staff:${expected}` || event.schedule !== "fixed" : !!event)
      throw new Error(`Expected staff night ${expected}, got ${event?.id || "none"}`);
    const run = window.__staffRun = { done: false };
    void runNightPlan(events).then(count => { run.count = count; run.done = true; }, error => {
      run.error = `${error.name}: ${error.message}`; run.done = true;
    });
  }, expected);
}

async function finishNight(page, count = 1) {
  await page.waitForFunction(() => window.__staffRun?.done, null, { timeout: 120000 });
  const run = await page.evaluate(() => window.__staffRun);
  assert.equal(run.error, undefined, run.error);
  assert.equal(run.count, count);
}

async function reloadSaved(page, options) {
  await page.reload();
  await page.locator(dt("title-new")).waitFor({ timeout: 30000 });
  await page.locator("#boot").waitFor({ state: "detached" });
  assert.equal(await page.evaluate(async () => !!(await import("./js/core/state.js")).load()), true);
  await observe(page, options);
}

const text = (log, id) => log.lines.filter(line => line.id === id).map(line => line.text).join("\n");

await suite("ch4-staff-work", async check => {
  for (const spec of [
    { role: 0, order: 0, preparation: "tools", question: "sweetness", result: "good", coals: 3, place: "inner", reloadAt: "notebook" },
    { role: 1, order: 1, preparation: "seats", question: "strength", result: "rough", coals: 0, place: null, reloadAt: "care" },
  ]) await check(`${spec.preparation}-${spec.result}-real-care-and-saved-callback`, async page => {
    await seed(page);
    await observe(page, { ...spec, pauseAt: spec.reloadAt === "notebook" ? "ch4_staff_notebook" : null });
    const chunks = [];
    let before = await resources(page);
    await startNight(page, "notice");
    await finishNight(page);
    assert.equal((await get(page)).flags._ch4.read.ch4_staff_notice, true);
    assert.deepEqual(await resources(page), before, "DAY3 notice spends no time or resources");

    await setDay(page, 4);
    before = await resources(page);
    await startNight(page, "preparation");
    if (spec.reloadAt === "notebook") {
      await page.waitForFunction(() => window.__staffObserved.paused === "ch4_staff_notebook");
      await page.locator(".vn-text").filter({ hasText: "借りた道具を抱え直す前に" }).waitFor();
      const pending = await get(page);
      assert.deepEqual(pending.flags._ch4.staffWork.preparation,
        { choice: "tools", introRead: true, workDone: true });
      assert.equal(pending.flags._ch4.read.ch4_staff_notebook, undefined);
      assert.equal(pending.flags._night_event_day, `4:${pending.flags._ch4.startDay + 2}`,
        "an unfinished notebook must not finish DAY4's night");
      assert.deepEqual(await resources(page), before);
      chunks.push(await observed(page));
      // 保存済みの作業は繰り返さない。もし再選択が出れば、反対の回答になる設定で再開する。
      await reloadSaved(page, { role: 1, order: spec.order });
      assert.deepEqual((await get(page)).flags._ch4.staffWork.preparation, pending.flags._ch4.staffWork.preparation);
      await startNight(page, "preparation");
    }
    await finishNight(page);
    let state = await get(page);
    assert.deepEqual(state.flags._ch4.staffWork.preparation,
      { choice: spec.preparation, introRead: true, workDone: true, read: true });
    assert.deepEqual(await resources(page), before, "DAY4 has no fee, extra action, growth or relationship reward");
    await startNight(page, null);
    await finishNight(page, 0);

    await setDay(page, 9);
    before = await resources(page);
    await startNight(page, "service");
    await page.locator(dt("care-coals")).waitFor({ timeout: 120000 });
    state = await get(page);
    assert.deepEqual(state.flags._ch4.staffWork.service, { choice: spec.question, introRead: true });
    assert.equal(await page.locator(".bench").getAttribute("data-mode"), "tutorial");
    assert.match(await page.locator(".bench-title").textContent(), /調整 1回目/);
    assert.equal(await page.locator(".bench-phase").count(), 1, "only the shared adjustment step is offered");
    assert.equal(await page.locator(".bench-phase.now").getAttribute("data-step"), "care");
    assert.deepEqual(await resources(page), before, "preparing the supplied rig spends nothing");
    if (spec.reloadAt === "care") {
      chunks.push(await observed(page));
      await reloadSaved(page, { role: spec.role, order: 0 });
      assert.deepEqual((await get(page)).flags._ch4.staffWork.service, { choice: "strength", introRead: true });
      await startNight(page, "service");
      await page.locator(dt("care-coals")).waitFor({ timeout: 120000 });
      assert(!(await observed(page)).entries.includes("ch4_staff_order"), "LOAD resumes care without asking the order twice");
    }
    // 炭は実UIで選び、その後の吸いだけ既存の腕前フックで操作する。runCare/採点/結果は差し替えない。
    if (spec.place) await page.locator(dt(`care-place-${spec.place}`)).click();
    await page.evaluate(async auto => { (await import("./js/craft/session.js")).craftTest.auto = auto; },
      spec.result === "good" ? "good" : "bad");
    await page.locator(dt(`care-coal-${spec.coals}`)).click();
    await finishNight(page);
    state = await get(page);
    const service = state.flags._ch4.staffWork.service;
    assert.equal(service.choice, spec.question);
    assert.equal(service.result, spec.result, "feedback must follow the shared care score");
    assert.equal(service.careDone, true);
    assert.equal(service.read, true);
    assert.equal(service.adjustment.coals, spec.coals);
    assert.equal(service.adjustment.place, spec.place);
    assert.deepEqual(await resources(page), before, "the supplied adjustment has no fees, time, stock or rewards");
    assert.equal(state.flags._ch4_rehearsal, undefined, "mandatory service must not invent an optional rehearsal");
    await startNight(page, null);
    await finishNight(page, 0);

    // 実際の世界大会runnerを、仕込みが確定した次の工程から再開する。記憶の読了直後で止め、余計な制作はしない。
    await setDay(page, 14);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const { newSession, craftTest } = await import("./js/craft/session.js");
      const { startChapterFourCraft } = await import("./js/chapters/ch4-tournament-state.js");
      craftTest.auto = null;
      core.state.flags._ch4.read.ch4_tournament_start = true;
      const match = startChapterFourCraft(core.state, newSession("tournament"));
      if (!match) throw new Error("Tournament checkpoint fixture failed");
      match.step = 1;
      core.save();
    });
    before = await resources(page);
    const echoStop = await page.evaluate(async () => {
      const { state } = await import("./js/core/state.js");
      const { runChapterFourCraft } = await import("./js/chapters/ch4-tournament.js");
      try {
        await runChapterFourCraft({ isCurrent: () => !state.flags._ch4.read.ch4_staff_match_echo,
          menuButton: () => { throw new Error("Advanced past the staff memory checkpoint"); } });
        return "unexpected completion";
      } catch (error) { return error.name; }
    });
    assert.equal(echoStop, "AbortError");
    assert.equal((await get(page)).flags._ch4.read.ch4_staff_match_echo, true);
    assert.deepEqual(await resources(page), before, "the tournament memory cannot change resources or votes");
    chunks.push(await observed(page));
    const log = { entries: chunks.flatMap(chunk => chunk.entries), lines: chunks.flatMap(chunk => chunk.lines),
      choices: chunks.flatMap(chunk => chunk.choices) };
    assert.equal(log.choices.filter(choice => choice.id === "ch4_staff_prep_choice").length, 1);
    assert.equal(log.choices.find(choice => choice.id === "ch4_staff_prep_choice").selected, spec.preparation);
    assert.equal(log.choices.filter(choice => choice.id === "ch4_staff_order_choice").length, 1);
    assert.equal(log.choices.find(choice => choice.id === "ch4_staff_order_choice").selected, spec.question);
    for (const id of ["ch4_staff_notice", "ch4_staff_preparation", "ch4_staff_prepared", "ch4_staff_order", "ch4_staff_returned", "ch4_staff_match_echo"])
      assert.equal(log.entries.filter(entry => entry === id).length, 1, `${id} must play once`);
    assert.match(text(log, "ch4_staff_prepared"), spec.role ? /座っている人を立たせずに通れます/ : /札も合っています/);
    const callback = text(log, "ch4_staff_order");
    assert.match(callback, /あの棚/);
    assert.match(callback, spec.role ? /椅子をずらした角の席/ : /番号を揃えてくれた組/);
    assert.doesNotMatch(callback, spec.role ? /番号を揃えてくれた組/ : /椅子をずらした角の席/);
    assert(log.lines.some(line => line.id === "ch4_staff_order" && line.speaker === "shop_clerk"
      && /椅子をずらした|番号を揃えて/.test(line.text)), "the returning staff member must remember the actual work");
    const feedback = text(log, "ch4_staff_returned"), echo = text(log, "ch4_staff_match_echo");
    assert.match(feedback, spec.result === "good" ? /今は、香りが分かります/ : /まだ少し吸いづらい/);
    assert.doesNotMatch(feedback, spec.result === "good" ? /まだ少し吸いづらい|作り直す間/ : /今は、香りが分かります|作り直す間/);
    assert.match(echo, spec.order ? /先に吸い心地の強さを聞いた/ : /先に甘さの好みを聞いた/);
    assert.match(echo, spec.coals ? /炭を3個、内寄りに替えた/ : /炭を替えずに整えようとした/);
    assert.match(echo, spec.result === "good" ? /戻してからの返事まで/ : /一度戻しても、整いきらなかった/);
    assert.doesNotMatch(echo, /リハーサルでも通した|作り直しを頼んだ/);
    assert.deepEqual(chunks.flatMap(chunk => chunk.warnings), [], "all real VN branches must resolve, including before LOAD");
  }, { reducedMotion: "reduce" });
});
