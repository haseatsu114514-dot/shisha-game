// スタッフロールの検証（#517）。第5章の完了カード（章末レーダー）→スタッフロール→タイトル、
// 初回は飛ばせない・一度見た端末では2回目から飛ばせる、動きを減らす設定でも最後まで進む、
// PC・スマホ横で文字が画面の外へはみ出さない、を実UIと実saveで確かめる。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_save") || "null"));
const arm = (page, turbo = true) => page.evaluate(async turbo => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = turbo; vn.vnTest.choose = () => 0;
}, turbo);

/** フィナーレを読み終えた（cleared）第5章の保存を作る。seen は端末で一度最後まで見たか。 */
async function seed(page, { seen = false, done = false } = {}) {
  await page.evaluate(async ({ seen, done }) => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    const read = Object.fromEntries(["ch5_bridge_after_return", "ch5_opening", "ch5_unrecorded_day", "ch5_schedule_contact",
      "ch5_match_day_arrival", "ch5_copy_first_cup", "ch5_relationship_before_second_cup", "ch5_second_cup_result",
      "ch5_second_cup_result_afterglow", "ch5_doctor_after_match", "ch5_return_to_tonari",
      "ending_start", "ending_normal", "ending_daily_smoke"].map(id => [id, true]));
    Object.assign(value, { chapter: 5, day: 60, slot: 1, phase: "cleared", money: 50000, stamina: 100,
      weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.stats = { technique: 72, sense: 66, guts: 61, charm: 70, insight: 64 };
    value.statsAtChapterStart = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true,
      _ch4_preview_seen: true, _ch4_cleared: true, _ch5_match_scheduled: true, _ch5_match_started: true, _ch5_cleared: true,
      ...(done ? { _ch5_staff_roll_done: true } : {}),
      _ch5: { startDay: 52, stage: 2, part: "cleared", titleSeen: true, read, scheduleDecision: "decide",
        aftermath: 2, finale: 3, finaleScenes: ["ending_start", "ending_normal", "ending_daily_smoke"], won: true,
        secondCup: null } };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false, staffRollSeen: seen });
    core.saveConfig(); core.save();
  }, { seen, done });
}

async function loadSlot(page, turbo = true) {
  await page.reload();
  await page.locator(dt("title-load")).click();
  await arm(page, turbo);
  await page.locator(dt("slot-0")).click();
  await page.locator(dt("ch5-complete")).waitFor({ timeout: 60000 });
}

await suite("staff-roll", async check => {
  await check("first-roll-follows-the-chapter-end-radar-and-returns-to-title", async page => {
    await seed(page);
    await loadSlot(page);
    // 第五章・完: 章の伸びのレーダー。初回はスタッフロールへ進む前にタイトルへ抜けられない。
    await page.locator(`${dt("ch5-growth")} svg.radar`).waitFor();
    assert.equal(await page.locator(dt("ch5-complete-title")).count(), 0, "No way to skip the first roll via the title");
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll")).waitFor();
    const shown = await page.evaluate(() => ({
      skippable: document.querySelector('[data-test="staff-roll"]')?.dataset.skippable,
      skip: document.querySelectorAll('[data-test="staff-roll-skip"]').length,
    }));
    assert.deepEqual(shown, { skippable: "no", skip: 0 });
    // 流し終えたらタイトルへ戻る。保存と端末の両方に「見た」が残る。
    await page.locator(dt("title-new")).waitFor({ timeout: 30000 });
    const saved = await get(page);
    assert.equal(saved.flags._ch5_staff_roll_done, true);
    assert.equal(saved.flags._ch5.part, "cleared");
    const config = await page.evaluate(async () => (await import("./js/core/state.js")).config);
    assert.equal(config.staffRollSeen, true);
    // 見終えた保存を開くと、完了カードから見直せる（いつでも飛ばせて、カードへ戻る）。
    await loadSlot(page, false);
    await page.locator(dt("ch5-complete-title")).waitFor();
    await page.locator(dt("ch5-complete-credits")).click();
    await page.locator(dt("staff-roll-skip")).click();
    await page.locator(dt("ch5-complete")).waitFor({ timeout: 10000 });
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
    assert.deepEqual(await page.locator(".staff-roll-song-credit").allTextContents(),
      ["作曲 秋山裕和（H/MIX GALLERY）", "作曲 shimtone（OpenTracks）", "作曲 Napi（M-ART）"]);
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
