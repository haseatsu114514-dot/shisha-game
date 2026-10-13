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
    assert(r.lines.some(t => t.includes("濁ってた")));
    assert(!r.lines.some(t => t.includes("忘れちゃいけない") || t.includes("意味をまだ半分も")));
  });
});
