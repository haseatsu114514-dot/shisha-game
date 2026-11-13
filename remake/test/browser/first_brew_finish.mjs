// 提供時の実会話・保存互換。温度の良否は吸い出し結果を入力する。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

await suite("first-brew-finish", async check => {
  await check("temperature-reaction-and-legacy-save", async page => {
    const result = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const first = await import("./js/chapters/first-brew.js");
      const vn = await import("./js/vn/engine.js");
      const { DB } = await import("./js/core/data.js");
      (await import("./js/chapters/ch1.js")).setupHooks();
      vn.vnTest.turbo = true;
      const original = JSON.stringify(DB.dialogues.ch1_tutorial_oneesan), rows = [];
      for (const finish of ["balanced", "cool", "hot", "legacy", "assisted", "unfinished", "failed"]) {
        const s = core.newGame();
        const progress = s.flags._ch1_opening = {};
        const cs = { mix: { lemon: 9, mint: 3 }, pullDone: finish !== "unfinished",
          failed: finish === "failed", pull: { temp: .5,
            inZone: finish === "balanced", under: finish === "cool", over: finish === "hot" } };
        first.rememberFirstBrew(progress, cs, finish !== "assisted");
        if (finish === "legacy") delete progress.firstBrew.finish;
        core.save(); core.newGame(); core.load();
        const saved = core.state.flags._ch1_opening;
        const before = JSON.stringify({ stats: core.state.stats, stock: core.state.flavorStock, money: core.state.money });
        const lines = [];
        vn.hooks.onLine = (_id, line) => { if (line.text) lines.push(line.text); };
        const ok = await first.serveFirstBrew(saved);
        rows.push({ finish, ok, brew: saved.firstBrew, lines, before,
          after: JSON.stringify({ stats: core.state.stats, stock: core.state.flavorStock, money: core.state.money }) });
      }
      return { rows, unchanged: original === JSON.stringify(DB.dialogues.ch1_tutorial_oneesan) };
    });
    assert(result.unchanged, "元の台本を上書きしない");
    for (const row of result.rows) {
      assert(row.ok);
      assert.equal(row.after, row.before);
      const text = row.lines.join("\n");
      assert.match(text, /レモン.*ミント/);
      assert.match(text, /いいシーシャ屋さん/);
      if (["balanced", "cool", "hot"].includes(row.finish)) {
        assert.equal(row.brew.finish, row.finish);
        assert.match(text, { balanced: /熱もちょうどよく/, cool: /少し薄い/, hot: /少し熱い/ }[row.finish]);
        assert.doesNotMatch(text, /つい、もう一口/);
      } else {
        assert.equal(row.brew.finish ?? null, null);
        assert.match(text, /つい、もう一口/);
        assert.doesNotMatch(text, /少し薄い|少し熱い|熱もちょうどよく/);
      }
    }
  }, { reducedMotion: "reduce" });
});
