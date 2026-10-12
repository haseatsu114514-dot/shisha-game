// #457 / old #339: real VN/conditions/saves. Chapter-2 reachability and date copy are separate work.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, restore = false) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async restore => {
    window.K = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      story: await import("./js/daily/kafuka-bonds.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), data: await import("./js/core/data.js"),
      romance: await import("./js/daily/romance.js"),
    };
    if (restore) K.core.load();
    else {
      const s = K.core.newGame();
      Object.assign(s, { chapter: 2, phase: "daily", day: 3, slot: 2 });
      s.lovers = ["kafuka"]; s.loveLevel.kafuka = 1; s.lovePts.kafuka = 9; s.loverSince.kafuka = 16;
      s.flags._intro_kafuka = s.flags._kafuka_nickname_known = true; s.met.kafuka = true;
    }
    K.ch1.setupHooks(); K.vn.vnTest.turbo = true; K.vn.vnTest.choose = () => 0;
    K.snap = () => structuredClone(K.core.state);
    K.events = [];
    const original = K.vn.hooks.onEnter;
    K.vn.hooks.onEnter = (id, scene) => { K.events.push(id); original?.(id, scene); };
  }, restore);
}

await suite("kafuka-milestones", async check => {
  for (const [mode, opts] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    const options = { ...opts, reducedMotion: "reduce" };
    await check(`${mode}-live-private-growth-in-order`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state, records = [];
        for (let level = 1; level <= 5; level++) {
          // The same live private-affinity function used by LIME/dates; no public shop growth.
          K.stats.bond.private = true;
          while (s.loveLevel.kafuka < level) K.stats.gainAffinity("kafuka", 2);
          K.stats.bond.private = false;
          const before = K.snap(); const due = K.story.kafukaMilestoneDue();
          const played = await K.story.playKafukaMilestone();
          records.push({ before, after: K.snap(), due, played, log: K.vn.backlog().map(x => x.text).join(" ") });
          K.vn.backlog().length = 0;
          const noNext = await K.story.playKafukaMilestone();
          records.at(-1).noNext = noNext;
        }
        const before = K.snap(), again = await K.story.playKafukaMilestone();
        return { records, before, again, after: K.snap(), events: K.events, privateAfter: K.stats.bond.private };
      });
      for (let i = 0; i < 5; i++) {
        const x = r.records[i], level = i + 1;
        assert(x.played); assert.equal(x.due, `lover_kafuka_lv${level}`);
        assert.equal(x.after.lovePts.kafuka - x.before.lovePts.kafuka, 3);
        assert.equal(x.after.loverEventsSeen.filter(id => id === x.due).length, 1);
        assert(x.after.flags[`_${x.due}_reward_done`]);
        assert.deepEqual(x.after.stats, x.before.stats); assert.equal(x.after.loverSince.kafuka, 16);
        assert(!x.noNext);
        assert.equal(!!x.after.flags._kafuka_swimming_known, level >= 3);
        assert.equal(!!x.after.flags._kafuka_name_known, level >= 4);
        if (level < 3) assert(!/泳|波多野|なぎさ/.test(x.log));
        if (level === 3) assert(x.log.includes("泳ぐのは") && !/波多野|なぎさ/.test(x.log));
        if (level === 4) assert(x.log.includes("波多野なぎさ") && x.log.includes("サメちゃんで十分"));
        if (level === 5) assert(x.log.includes("声を借りず") && x.log.includes("好きじゃ"));
      }
      assert.deepEqual(r.events.filter(id => /^lover_kafuka_lv/.test(id)), [1, 2, 3, 4, 5].map(n => `lover_kafuka_lv${n}`));
      assert(!r.again && !r.privateAfter); assert.deepEqual(r.after, r.before);
    }, options);

    await check(`${mode}-legacy-high-level-catches-up-without-inferring-secrets`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const saved = K.snap(); saved.schema = 5; saved.loveLevel.kafuka = 5; saved.lovePts.kafuka = 72;
        saved.loveCarry.kafuka = 0.5; saved.lovers.push("minto"); saved.loveLevel.minto = 3;
        saved.lovePts.minto = 38; saved.loverSince.minto = 9; saved.loveCarry.minto = 0.5;
        saved.loverEventsSeen = ["lover_minto_lv2"]; saved.guilt = 3;
        saved.inbox = [{ id: "preserved", msg: { sender: "minto", type: "chat", messages: ["hi"] }, read: true, done: true }];
        localStorage.setItem(K.core.SAVE_KEY, JSON.stringify(saved)); K.core.load();
        const before = K.snap(), snapshots = [];
        for (let n = 1; n <= 5; n++) { await K.story.playKafukaMilestone(); snapshots.push(K.snap()); K.core.load(); }
        return { before, snapshots, events: K.events, after: K.snap() };
      });
      assert.equal(r.before.loveLevel.kafuka, 5); assert(!r.before.flags._kafuka_name_known && !r.before.flags._kafuka_swimming_known);
      for (let i = 0; i < 5; i++) {
        assert.equal(r.snapshots[i].loverEventsSeen.filter(id => id.startsWith("lover_kafuka_")).length, i + 1);
        assert.equal(!!r.snapshots[i].flags._kafuka_name_known, i >= 3);
      }
      assert.deepEqual(r.events.filter(id => /^lover_kafuka_lv/.test(id)), [1, 2, 3, 4, 5].map(n => `lover_kafuka_lv${n}`));
      assert.equal(r.after.lovePts.kafuka, 87); assert.equal(r.after.loveLevel.kafuka, 5); assert.equal(r.after.loveCarry.kafuka, 0.5);
      assert.equal(r.after.lovePts.minto, 38); assert.equal(r.after.loveCarry.minto, 0.5); assert.equal(r.after.loverSince.minto, 9);
      assert(r.after.loverEventsSeen.includes("lover_minto_lv2")); assert.equal(r.after.guilt, 3);
      assert.deepEqual(r.after.inbox, r.before.inbox); assert.deepEqual(r.after.lovers, ["kafuka", "minto"]);
    }, options);

    await check(`${mode}-known-name-and-earned-reward-are-not-repeated`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state; s.loveLevel.kafuka = 4; s.lovePts.kafuka = 52;
        s.loverEventsSeen = [1, 2, 3].map(n => `lover_kafuka_lv${n}`);
        s.flags._kafuka_name_known = s.flags._kafuka_swimming_known = true;
        s.flags._lover_kafuka_lv4_reward_done = true;
        const played = await K.story.playKafukaMilestone();
        return { played, s: K.snap(), log: K.vn.backlog().map(x => x.text).join(" "), events: K.events };
      });
      assert(r.played); assert.equal(r.s.lovePts.kafuka, 52); assert(r.s.loverEventsSeen.includes("lover_kafuka_lv4"));
      assert(r.log.includes("なぎささん")); assert(!r.log.includes("本当のお名前") && !r.log.includes("知ってどうする"));
      assert(!r.events.includes("kafuka_future_private_name"));
    }, options);

    await check(`${mode}-friend-chapter-missing-fragment-and-level-boundaries`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state, checks = [];
        for (const kind of ["friend", "chapter1", "low-level", "missing-scene", "missing-fragment"]) {
          s.lovers = ["kafuka"]; s.chapter = 2; s.loveLevel.kafuka = 3;
          s.loverEventsSeen = ["lover_kafuka_lv1", "lover_kafuka_lv2"];
          if (kind === "friend") { s.lovers = []; s.flags._friend_kafuka = true; }
          if (kind === "chapter1") s.chapter = 1;
          if (kind === "low-level") s.loveLevel.kafuka = 2;
          const id = kind === "missing-scene" ? "lover_kafuka_lv3" : "kafuka_future_private_swimming";
          const scene = K.data.DB.dialogues[id];
          if (kind.startsWith("missing")) delete K.data.DB.dialogues[id];
          const before = K.snap(), played = await K.story.playKafukaMilestone();
          checks.push({ kind, before, played, after: K.snap() }); K.data.DB.dialogues[id] = scene;
        }
        return checks;
      });
      for (const x of r) { assert(!x.played, x.kind); assert.deepEqual(x.after, x.before, x.kind); }
    }, options);

    await check(`${mode}-interrupted-name-read-preserves-actual-knowledge`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = K.core.state; s.loveLevel.kafuka = 4; s.lovePts.kafuka = 50;
        s.loverEventsSeen = [1, 2, 3].map(n => `lover_kafuka_lv${n}`);
        s.flags._kafuka_swimming_known = true; K.core.save(); K.vn.vnTest.turbo = false;
        K.running = K.story.playKafukaMilestone();
      });
      const press = () => opts.hasTouch ? page.locator(".vn-box").tap() : page.locator(".vn-box").click();
      await page.waitForFunction(() => K.vn.isPlaying());
      assert.equal(await page.evaluate(() => K.story.playKafukaMilestone()), false);
      for (let n = 0; n < 80 && !await page.evaluate(() => K.core.state.flags._kafuka_name_known); n++) {
        await press(); await page.waitForTimeout(100);
      }
      const interrupted = await page.evaluate(() => { K.core.save(); return K.snap(); });
      assert(interrupted.flags._kafuka_name_known);
      assert(!interrupted.loverEventsSeen.includes("lover_kafuka_lv4")); assert.equal(interrupted.lovePts.kafuka, 50);
      await page.reload({ waitUntil: "load" });
      await page.locator('[data-test="title-new"]').waitFor(); await page.locator("#boot").waitFor({ state: "detached" });
      await setup(page, true);
      const r = await page.evaluate(async () => {
        await K.story.playKafukaMilestone(); const after = K.snap(); K.core.load();
        return { after, loaded: K.snap(), log: K.vn.backlog().map(x => x.text).join(" "), privateAfter: K.stats.bond.private };
      });
      assert.equal(r.after.lovePts.kafuka, 53); assert.equal(r.loaded.lovePts.kafuka, 53);
      assert.equal(r.after.loverEventsSeen.filter(id => id === "lover_kafuka_lv4").length, 1);
      assert(!r.log.includes("本当のお名前") && !r.privateAfter); assert(r.loaded.flags._kafuka_name_known);
    }, options);

    await check(`${mode}-date-caller-catches-up-without-duplicating-an-old-date`, async page => {
      await setup(page);
      const r = await page.evaluate(async () => {
        const s = K.core.state; s.loveLevel.kafuka = 5; s.lovePts.kafuka = 70;
        // This Issue provides the condition/caller; #340 supplies the character's date copy.
        K.data.DB.lover.dates.kafuka = { arrive: { face: "normal", text: "fixture" }, mid: { face: "normal", text: "fixture" },
          choiceQ: "fixture", optA: { text: "a", line: "fixture", stat: "sense" },
          optB: { text: "b", line: "fixture", stat: "insight" }, close: { face: "smile", text: "fixture" } };
        await K.stats.paidAction(() => K.romance.playDate("kafuka"));
        const first = K.snap(); await K.story.playKafukaMilestone();
        return { first, after: K.snap(), events: K.events, privateAfter: K.stats.bond.private };
      });
      assert(r.first.loverEventsSeen.includes("lover_kafuka_lv1"));
      assert(!r.first.loverEventsSeen.includes("lover_kafuka_lv5"));
      assert.equal(r.events.filter(id => id === "remake_date_kafuka").length, 1);
      assert(r.after.loverEventsSeen.includes("lover_kafuka_lv2")); assert(!r.privateAfter);
    }, options);
  }
});
