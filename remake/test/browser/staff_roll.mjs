// スタッフロールの検証（#517）。第5章の完了カード（章末レーダー）→スタッフロール→タイトル、
// 初回は飛ばせない・一度見た端末では2回目から飛ばせる、動きを減らす設定でも最後まで進む、
// PC・スマホ横で文字が画面の外へはみ出さない、を実UIと実saveで確かめる。
// 初回を流し終えたら真エンドとして周回（NEXT CYCLE）が開く（#1228）。勝敗は問わず、流す前は開かない。
// 恋人が2人以上なら、スタッフロールの後に修羅場→一人ずつの話し直しを読んでからタイトルへ（IR32）。途中のLOAD・旧保存も確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null"));
const cycleMeta = page => page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_cycle") || "null"));
const arm = (page, turbo = true) => page.evaluate(async turbo => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = turbo; vn.vnTest.choose = () => 0;
}, turbo);

/**
 * フィナーレを読み終えた（cleared）第5章の保存を作る。seen は端末で一度最後まで見たか。won は9000との勝敗。
 * lovers は恋人（会っていて連絡先もある）、flags は足す保存フラグ、post はスタッフロールの後の並び（postEnding）。
 */
async function seed(page, { seen = false, done = false, won = true, lovers = [], flags = {}, post } = {}) {
  await page.evaluate(async ({ seen, done, won, lovers, flags, post }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    const match = won ? ["ch5_second_cup_result", "ch5_second_cup_result_afterglow"] : ["ch5_second_cup_defeat"];
    const read = Object.fromEntries(["ch5_bridge_after_return", "ch5_opening", "ch5_unrecorded_day", "ch5_schedule_contact",
      "ch5_match_day_arrival", "ch5_copy_first_cup", "ch5_relationship_before_second_cup", ...match,
      "ch5_doctor_after_match", "ch5_return_to_tonari",
      "ending_start", "ending_normal", "ending_daily_smoke"].map(id => [id, true]));
    Object.assign(value, { chapter: 5, day: 60, slot: 1, phase: "cleared", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [...lovers], contacts: ["sumi", ...lovers] });
    for (const id of lovers) value.met[id] = true;
    value.stats = { technique: 72, sense: 66, guts: 61, charm: 70, insight: 64 };
    value.statsAtChapterStart = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
      _ch4_preview_seen: true, _ch4_cleared: true, _ch5_match_scheduled: true, _ch5_match_started: true, _ch5_cleared: true,
      ...(done ? { _ch5_staff_roll_done: true } : {}),
      _ch5: { startDay: 52, stage: 2, part: "cleared", titleSeen: true, read, scheduleDecision: "decide",
        aftermath: 2, finale: 3, finaleScenes: ["ending_start", "ending_normal", "ending_daily_smoke"], won,
        secondCup: null, ...(post ? { postEnding: post } : {}) }, ...flags };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false, staffRollSeen: seen });
    core.saveConfig(); core.save();
  }, { seen, done, won, lovers, flags, post });
}

async function openSlot(page, turbo = true) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page, turbo);
  await page.locator(dt("slot-0")).click();
}
async function loadSlot(page, turbo = true) {
  await openSlot(page, turbo);
  await page.locator(dt("ch5-complete")).waitFor({ timeout: 60000 });
}
const scene = id => `${dt("ch5-scene")}[data-scene="${id}"]`;
const talk = id => `shuraba_talk_${id}`;
// 会話を開いたところ（自動送りを止めて）でロードし、読みかけの場面を確定しないことを確かめる。
async function loadMidRead(page) {
  await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = false; });
  await page.locator(dt("ch5-continue")).click();
  await page.locator("#vn.active").waitFor();
  await openSlot(page);
}

await suite("staff-roll", async check => {
  await check("first-roll-follows-the-chapter-end-radar-and-returns-to-title", async page => {
    await seed(page);
    await loadSlot(page);
    // 第五章・完: 章の伸びのレーダー。初回はスタッフロールへ進む前にタイトルへ抜けられない。
    await page.locator(`${dt("ch5-growth")} svg.radar`).waitFor();
    assert.equal(await page.locator(dt("ch5-complete-title")).count(), 0, "No way to skip the first roll via the title");
    assert.equal(await cycleMeta(page), null, "The next cycle stays locked until the first roll ends");
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll")).waitFor();
    const shown = await page.evaluate(() => ({
      skippable: document.querySelector('[data-test="staff-roll"]')?.dataset.skippable,
      skip: document.querySelectorAll('[data-test="staff-roll-skip"]').length,
    }));
    assert.deepEqual(shown, { skippable: "no", skip: 0 });
    // 流し終えたらタイトルへ戻る。保存と端末の両方に「見た」が残り、真エンドとして次の周回が開く。
    await page.locator(dt("title-new")).waitFor({ timeout: 30000 });
    await page.locator(dt("title-next-cycle")).waitFor();
    const saved = await get(page);
    assert.equal(saved.flags._ch5_staff_roll_done, true);
    assert.equal(saved.flags._ch5.part, "cleared");
    const config = await page.evaluate(async () => (await import("./js/core/state.js")).config);
    assert.equal(config.staffRollSeen, true);
    const cycle = await cycleMeta(page);
    assert.equal(cycle.unlocked, true);
    assert.deepEqual(cycle.trueEnds.map(end => end.cycleId), [saved.cycleId]);
    assert.equal(cycle.carryPackage.fromCycleId, saved.cycleId);
    assert.equal(cycle.carryPackage.fromCycle, 1);
    // 見終えた保存を開くと、完了カードから見直せる（いつでも飛ばせて、カードへ戻る）。
    await loadSlot(page, false);
    await page.locator(dt("ch5-complete-title")).waitFor();
    const note = await page.locator(`${dt("ch5-complete")} .ch2-contest-note`).textContent();
    assert(note.includes("タイトルの NEXT CYCLE から、2周目をはじめられます。"), note);
    assert.equal((await cycleMeta(page)).trueEnds.length, 1, "Reopening the same run does not add a true end");
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll-skip")).click();
    await page.locator(dt("ch5-complete")).waitFor({ timeout: 10000 });
  });

  await check("a-lost-match-also-opens-the-next-cycle-after-the-first-roll", async page => {
    await seed(page, { won: false });
    await loadSlot(page);
    const note = await page.locator(`${dt("ch5-complete")} .ch2-contest-note`).textContent();
    assert(!note.includes("NEXT CYCLE"), note);
    assert.equal(await cycleMeta(page), null);
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("title-next-cycle")).waitFor({ timeout: 30000 });
    const saved = await get(page);
    assert.equal(saved.flags._ch5.won, false);
    assert.deepEqual((await cycleMeta(page)).trueEnds.map(end => end.cycleId), [saved.cycleId]);
  });

  await check("a-save-that-finished-the-roll-earlier-opens-the-next-cycle-from-the-end-card", async page => {
    // スタッフロールまで見終えた後に、この接続より前の版で止まっていた保存（メタ層が無い）。
    await seed(page, { done: true, seen: true });
    assert.equal(await cycleMeta(page), null);
    await loadSlot(page, false);
    const note = await page.locator(`${dt("ch5-complete")} .ch2-contest-note`).textContent();
    assert(note.includes("タイトルの NEXT CYCLE から、2周目をはじめられます。"), note);
    const saved = await get(page);
    const cycle = await cycleMeta(page);
    assert.equal(cycle.unlocked, true);
    assert.deepEqual(cycle.trueEnds.map(end => end.cycleId), [saved.cycleId]);
    // タイトルから2周目を始めると、オートセーブが新しい周回の第1章になる（恋人は引き継がない）。
    await page.locator(dt("ch5-complete-title")).click();
    await page.locator(dt("title-next-cycle")).click();
    await page.locator(dt("cycle-start")).click();
    await page.locator(dt("cycle-overwrite")).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null")?.cycle === 2);
    const next = await get(page);
    assert.equal(next.chapter, 1);
    assert.deepEqual(next.lovers, []);
    assert.notEqual(next.cycleId, saved.cycleId);
    assert.equal((await cycleMeta(page)).highestCycleStarted, 2);
  });

  // IR32: 恋人が2人。初回のスタッフロールの後はタイトルでなく修羅場（開始→二人の反応→謝罪→話し直しの決意）を続けて読み、
  // 話し直しは一人ずつカードから。読みかけでLOADしても同じ場面から。全員と話し直したらタイトルへ。以後は完了カード。
  await check("two-lovers-read-the-shuraba-and-talks-after-the-first-roll-then-title", async page => {
    const lovers = ["minto", "tsumugi"];
    await seed(page, { lovers });
    await loadSlot(page);
    const start = await get(page);
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll")).waitFor();
    await page.locator(scene("shuraba_open")).waitFor({ timeout: 30000 });
    let saved = await get(page);
    assert.equal(saved.flags._ch5_staff_roll_done, true);
    assert.deepEqual(saved.flags._ch5.postEnding, { step: 0, unresolved: lovers, scenes: ["shuraba_open", "shuraba_minto",
      "shuraba_tsumugi", "shuraba_accountability", "ending_relationship_pending", talk("minto"), talk("tsumugi")] });
    assert.equal((await cycleMeta(page)).unlocked, true, "The true end is the roll; the talks come after it");
    assert.match(await page.locator(dt("ch5-scene")).innerText(), /後日のtonari/);
    await loadMidRead(page);
    await page.locator(scene("shuraba_open")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch5.postEnding.step, 0, "A read cut off by LOAD commits nothing");
    // 修羅場は続けて読み、1人目の話し直しのカードで止まる。
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene(talk("minto"))).waitFor({ timeout: 60000 });
    saved = await get(page);
    assert.equal(saved.flags._ch5.postEnding.step, 5);
    assert.equal(saved.flags._story_shuraba_unresolved, true, "The apology leaves it unresolved");
    assert.deepEqual(saved.flags._ch5.postEnding.unresolved, lovers);
    const card = await page.locator(dt("ch5-scene")).innerText();
    assert(card.includes("話し直し") && card.includes("1人目／2人"), card);
    // 話し直しの途中でLOAD → 同じ人から。
    await loadMidRead(page);
    await page.locator(scene(talk("minto"))).waitFor({ timeout: 60000 });
    assert.deepEqual((await get(page)).flags._ch5.postEnding.unresolved, lovers, "A cut-off talk resolves nobody");
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene(talk("tsumugi"))).waitFor({ timeout: 60000 });
    assert.match(await page.locator(dt("ch5-scene")).innerText(), /2人目／2人/);
    assert.deepEqual((await get(page)).flags._ch5.postEnding.unresolved, ["tsumugi"]);
    await page.locator(dt("ch5-continue")).click();
    await page.locator(dt("title-new")).waitFor({ timeout: 30000 });
    saved = await get(page);
    assert.equal(saved.flags._ch5.postEnding.step, 7);
    assert.deepEqual(saved.flags._ch5.postEnding.unresolved, []);
    assert.equal(saved.flags._story_shuraba_unresolved, undefined, "Released after both talks");
    assert.deepEqual(saved.lovers, lovers, "Nobody is dumped or forgiven by the talk");
    for (const key of ["money", "stats", "day", "slot", "stamina", "phase"]) assert.deepEqual(saved[key], start[key], key);
    assert.deepEqual(saved.flags._ch5.finaleScenes, start.flags._ch5.finaleScenes, "The finale is not rewritten");
    await page.locator(dt("title-next-cycle")).waitFor();
    // 読み終えた保存は完了カードから。修羅場は繰り返さない。
    await loadSlot(page);
    await page.locator(dt("ch5-complete-title")).waitFor();
  });

  // この接続より前にスタッフロールまで見終えた3人の恋人の保存は、開くと修羅場から。修羅場の途中の保存は続きから。
  // 打ち上げで修羅場が済んでいれば、二度起こさず話し直しの決意から。
  await check("old-and-mid-conflict-saves-resume-the-post-ending-at-the-right-scene", async page => {
    const lovers = ["rio", "ageha", "hiyori"];
    await seed(page, { done: true, seen: true, lovers });
    await openSlot(page);
    await page.locator(scene("shuraba_open")).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch5.postEnding.scenes.length, 9);
    const scenes = ["shuraba_open", "shuraba_rio", "shuraba_ageha", "shuraba_hiyori", "shuraba_accountability",
      "ending_relationship_pending", ...lovers.map(talk)];
    await seed(page, { done: true, seen: true, lovers, post: { scenes, step: 2, unresolved: lovers } });
    await openSlot(page);
    await page.locator(scene("shuraba_ageha")).waitFor({ timeout: 60000 });
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene(talk("rio"))).waitFor({ timeout: 60000 });
    assert.match(await page.locator(dt("ch5-scene")).innerText(), /1人目／3人/);
    const read = (await get(page)).flags._ch5.read;
    for (const id of scenes.slice(2, 6)) assert.equal(read[id], true, id);
    assert.equal(read.shuraba_rio, undefined, "Scenes read before the save are not replayed");
    await seed(page, { done: true, seen: true, lovers: ["tsumugi", "mashiro"],
      flags: { _ch5_after_party: true, _story_shuraba_unresolved: true } });
    await openSlot(page);
    await page.locator(scene("ending_relationship_pending")).waitFor({ timeout: 60000 });
    await page.locator(dt("ch5-continue")).click();
    await page.locator(scene(talk("tsumugi"))).waitFor({ timeout: 60000 });
    assert.equal((await get(page)).flags._ch5.read.shuraba_open, undefined, "The party already had the conflict");
  });

  await check("first-roll-ignores-keys-and-clicks-until-it-ends", async page => {
    await seed(page);
    const started = await page.evaluate(async () => {
      const { playStaffRoll } = await import("./js/scenes/staff-roll.js");
      window.rollDone = playStaffRoll({ durationMs: 5000 });
      return true;
    });
    assert(started);
    await page.locator(dt("staff-roll")).waitFor();
    // 名前はすべて「あつき」。あつきの役職に「作曲」は無く、他の作者の曲は「使用楽曲」の欄に作者と配布元つきで並ぶ。
    const text = await page.locator(dt("staff-roll")).textContent();
    assert(text.includes("水煙前線 -EN:CODE-") && text.includes("Thank you for playing"), text);
    const roles = await page.locator(".staff-roll-credit .staff-roll-role").allTextContents();
    assert(roles.length >= 6 && !roles.some(role => role.includes("作曲")), `No 作曲 role for あつき: ${roles}`);
    assert.deepEqual(await page.locator(".staff-roll-credit .staff-roll-name").allTextContents(), roles.map(() => "あつき"));
    assert.equal(await page.locator(".staff-roll-music .staff-roll-role").textContent(), "使用楽曲");
    assert.deepEqual(await page.locator(".staff-roll-source").allTextContents(), ["音楽：魔王魂", "音楽：甘茶の音楽工房"]);
    assert.deepEqual(await page.locator(".staff-roll-song-credit").allTextContents(),
      ["作曲 秋山裕和（H/MIX GALLERY）", "作曲 shimtone（OpenTracks）", "作曲 Napi（M-ART）",
        "作曲 魔王魂（魔王魂）", "作曲 魔王魂（魔王魂）", "作曲 魔王魂（魔王魂）", "作曲 魔王魂（魔王魂）", "作曲 甘茶（甘茶の音楽工房）"]);
    assert.equal(await page.locator(".staff-roll-sound").textContent(), "効果音：ポケットサウンド – https://pocket-se.info/");
    assert(!text.includes("間接照明とブラックコーヒー"), "A song without a recorded source is not credited yet");
    for (const key of ["Escape", "Enter", " "]) await page.keyboard.press(key);
    await page.locator(dt("staff-roll")).click({ position: { x: 640, y: 360 } });
    await page.waitForTimeout(1500);
    assert.equal(await page.locator(`${dt("staff-roll")}.ending`).count(), 0, "Still rolling after keys and clicks");
    assert.deepEqual(await page.evaluate(() => window.rollDone), { skipped: false });
  });

  await check("a-device-that-saw-the-roll-can-skip-it-on-a-new-playthrough", async page => {
    await seed(page, { seen: true });
    await loadSlot(page, false);
    await page.locator(dt("ch5-complete-credits")).click();
    assert.equal(await page.locator(dt("staff-roll")).getAttribute("data-skippable"), "yes");
    await page.keyboard.press("Escape");
    await page.locator(dt("title-new")).waitFor({ timeout: 30000 });
    assert.equal((await get(page)).flags._ch5_staff_roll_done, true, "A skipped roll still counts as watched");
  });

  await check("reduced-motion-shows-pages-and-reaches-the-end", async page => {
    await seed(page);
    const result = await page.evaluate(async () => {
      const { playStaffRoll } = await import("./js/scenes/staff-roll.js");
      const done = playStaffRoll({ durationMs: 1200 });
      await new Promise(requestAnimationFrame);
      const mode = document.querySelector('[data-test="staff-roll"]').dataset.mode;
      return { mode, ...(await done) };
    });
    assert.deepEqual(result, { mode: "pages", skipped: false });
    assert.equal(await page.locator(".staff-roll-closing.on").count(), 1, "The last page stays on the closing line");
  }, { reducedMotion: "reduce" });

  for (const [label, viewport] of [["pc", { width: 1280, height: 720 }], ["phone-landscape", { width: 844, height: 390 }]]) {
    await check(`credits-fit-the-stage-${label}`, async page => {
      await seed(page);
      const layout = await page.evaluate(async () => {
        const { playStaffRoll } = await import("./js/scenes/staff-roll.js");
        void playStaffRoll({ durationMs: 60000 });
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        const host = document.querySelector('[data-test="staff-roll"]');
        const rect = host.getBoundingClientRect();
        const items = [...host.querySelectorAll("h1, p")];
        return {
          overflow: host.scrollWidth > host.clientWidth + 1,
          outside: items.filter(node => {
            const r = node.getBoundingClientRect();
            return r.left < rect.left - 1 || r.right > rect.right + 1;
          }).map(node => node.textContent),
          smallest: Math.min(...items.map(node => parseFloat(getComputedStyle(node).fontSize))),
          width: host.offsetWidth, height: host.offsetHeight,
        };
      });
      assert.equal(layout.overflow, false);
      assert.deepEqual(layout.outside, []);
      assert(layout.smallest >= 24, `Credits stay large on the 1280x720 stage: ${layout.smallest}px`);
      assert.deepEqual([layout.width, layout.height], [1280, 720]);
    }, { viewport, ...(label === "pc" ? {} : { hasTouch: true, isMobile: true }) });
  }
});
