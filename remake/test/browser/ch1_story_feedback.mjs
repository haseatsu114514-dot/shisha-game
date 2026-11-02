import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    window.F = { core: await import("./js/core/state.js"), chapter: await import("./js/chapters/ch1.js"),
      vn: await import("./js/vn/engine.js"), story: await import("./js/chapters/tsumugi-story.js"),
      intro: await import("./js/vn/intro.js") };
    F.chapter.setupHooks(); F.vn.vnTest.turbo = true;
    F.fresh = () => {
      F.core.newGame(); F.core.state.phase = "daily"; F.core.state.day = 11;
      for (const id of ["tsumugi", "adam", "sumi", "naru", "nagumo", "minto", "dr_kemuri"]) F.intro.markIntroSeen(id);
      F.vn.backlog().length = 0;
    };
    F.lines = () => F.vn.backlog().map(line => line.text);
  });
}
await suite("ch1-story-feedback", async check => {
  for (const [id, remote, name] of [["interval_day1_naru_lime", "naru", "なる"], ["interval_day2_adam_lime", "adam", "アダム"]]) {
    await check(`contact-channel-${remote}-1180`, async page => {
      await setup(page);
      await page.evaluate(async ({ id, remote }) => {
        F.fresh(); F.core.state.met[remote] = true; F.core.config.textSpeed = 4; F.vn.vnTest.turbo = false;
        (await import("./js/core/ui.js")).clearScreen();
        window.remoteSceneDone = false;
        void F.vn.play(id).then(() => { remoteSceneDone = true; });
      }, { id, remote });
      // 最初の通常入力ロック（320ms）だけを待ち、その後は描画された読了合図で送る。
      await page.waitForTimeout(340);
      let remoteFrames = 0;
      for (let n = 0; n < 40; n++) {
        await page.waitForFunction(() => remoteSceneDone || document.querySelector(".vn-next.show"));
        if (await page.evaluate(() => remoteSceneDone)) break;
        const tag = page.locator(".vn-name.show");
        if (await tag.count()) {
          const label = await tag.textContent();
          assert(label.endsWith("（LIME）"), label);
          if (label === `${name}（LIME）`) remoteFrames++;
        }
        assert.equal(await page.locator(`.portrait[data-speaker="${remote}"]`).count(), 0, "remote contact never stands in the room");
        await page.keyboard.press("Space");
      }
      assert.equal(await page.evaluate(() => remoteSceneDone), true);
      assert(remoteFrames >= 4, "channel stays visible through every remote message");
      const log = await page.evaluate(() => F.vn.backlog());
      assert.equal(log.filter(line => line.name === `${name}（LIME）`).length, 4);
    }, { viewport: { width: 1180, height: 740 }, reducedMotion: "reduce" });
  }
  await check("known-art-uses-real-seen-flag-and-keeps-memory", async page => {
    await setup(page);
    const result = await page.evaluate(async () => {
      F.fresh(); F.vn.vnTest.choose = () => 0;
      await F.vn.play("ch1_tsumugi_fifth");
      const fresh = F.lines();
      F.fresh(); await F.story.playTsumugiStory(11);
      const seen = !!F.core.state.flags._tsumugi_contest_art_seen;
      F.core.save(); F.core.load(); F.vn.backlog().length = 0;
      await F.vn.play("ch1_tsumugi_fifth");
      return { fresh, known: F.lines(), seen, memories: F.core.state.relationshipMemories, artSeen: F.core.state.flags._tsumugi_contest_art_seen };
    });
    assert(result.seen && result.artSeen);
    assert(result.fresh.some(text => text.includes("画面の亀裂")));
    assert(!result.known.some(text => text.includes("画面の亀裂")));
    assert(result.known.some(text => text.includes("持っていてほしくて")));
    assert(result.known.some(text => text.includes("タブレットは、まだ使います")));
    assert(result.known.length <= result.fresh.length - 10);
    assert(result.memories.includes("tsumugi_change"));
  });
  for (const choice of [0, 1]) await check(`adam-opinion-${choice}`, async page => {
    await setup(page);
    const r = await page.evaluate(async choice => {
      F.fresh(); const s = F.core.state;
      const before = JSON.stringify([s.stats, s.statXp, s.affinity, s.owned, s.flavorStock]);
      F.vn.vnTest.choose = () => choice; await F.vn.play("ch1_adam_fifth");
      return { lines: F.lines(), unchanged: before === JSON.stringify([s.stats, s.statXp, s.affinity, s.owned, s.flavorStock]) };
    }, choice);
    assert(r.unchanged); assert(r.lines.some(t => t.includes("一台が決まらん")));
    assert(r.lines.some(t => t.includes(choice === 0 ? "戻して確かめよう" : "濃さも残したい")));
    assert(!r.lines.some(t => t.includes("全方向を素直に受け入れる")));
  });
  await check("praise-choice-records-real-route", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const out = {};
      for (const [key, idx] of [["talent", 0], ["report", 1]]) {
        F.fresh(); F.intro.markIntroSeen("oneesan");
        F.vn.vnTest.choose = () => idx;
        await F.vn.play("ch1_tutorial_oneesan");
        out[key] = { talent: !!F.core.state.flags._op_praise_talent, report: !!F.core.state.flags._op_praise_report };
      }
      return out;
    });
    assert(r.talent.talent && !r.talent.report);
    assert(r.report.report && !r.report.talent);
  });
  await check("growth-echo-only-after-talent-route", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      const play = async flag => {
        F.fresh(); await F.story.playTsumugiStory(11);
        if (flag) F.core.state.flags[flag] = true;
        F.vn.backlog().length = 0;
        F.vn.vnTest.choose = id => id === "ch1_tournament_after" ? 1 : 0;
        await F.vn.play("ch1_tournament_after");
        return F.lines();
      };
      return { talent: await play("_op_praise_talent"), report: await play("_op_praise_report"), none: await play(null) };
    });
    const ECHO = "……そこを見たか", SAW = "二回吸ったの、見てました";
    // 才能ルートを実際に選んだ時だけ、スミの一言が「次は顔を見ろ」から「そこを見たか」へ変わる
    assert(r.talent.some(t => t.includes(ECHO)) && r.talent.some(t => t.includes(SAW)));
    // 報酬ルート・記録なし（旧セーブ）では反応を捏造しない
    assert(!r.report.some(t => t.includes(ECHO)) && !r.report.some(t => t.includes(SAW)));
    assert(!r.none.some(t => t.includes(ECHO)) && !r.none.some(t => t.includes(SAW)));
    // 現行の祝いの流れは、才能ルートでも保たれる
    assert(r.talent.some(t => t.includes("グラスが鳴った")) && r.talent.some(t => t.includes("浮かれて見えました")));
    assert(r.none.some(t => t.includes("グラスが鳴った")));
  });
  await check("celebration-preserves-interview-and-tsumugi-action", async page => {
    await setup(page);
    const r = await page.evaluate(async () => {
      F.fresh(); await F.story.playTsumugiStory(11); F.vn.backlog().length = 0;
      F.vn.vnTest.choose = id => id === "ch1_tournament_after" ? 1 : 0;
      await F.vn.play("ch1_tournament_after");
      return { lines: F.lines(), flags: F.core.state.flags };
    });
    assert(r.flags.interview_honest);
    assert(r.lines.some(t => t.includes("グラスが鳴った")));
    assert(r.lines.some(t => t.includes("そこまで見ていなかった")));
    assert(r.lines.some(t => t.includes("浮かれて見えました")));
    assert(!r.lines.some(t => t.includes("忘れちゃいけない") || t.includes("意味をまだ半分も")));
  });
});
