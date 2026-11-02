// Isolated saves, then the normal title LOAD UI. No tournament or player save is replayed.
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const contexts = [
  [0, "bg_c_station_lobby", false],
  [1, "bg_c_station_lobby", true],
  [2, "bg_tonari_inside_night", false],
  [5, "bg_tonari_inside_night", true],
  [6, "bg_home_day", false],
  [8, "kemurikusa", false],
  [10, "bg_tonari_inside_night", false],
];

await suite("ch1-victory-resume-2190", async check => {
  for (const [step, background, phone] of contexts) {
    await check(`load-step-${step}`, async page => {
      const before = await page.evaluate(async step => {
        const core = await import("./js/core/state.js");
        const intro = await import("./js/vn/intro.js");
        const s = core.newGame();
        Object.assign(s, { phase: "tournament", day: 14, slot: 0, money: 75813,
          flavorStock: { lemon: 24, mint: 18 } });
        s.tournament.victory = { step, revealed: true, paid: true };
        for (const id of ["sumi", "tsumugi", "naru", "adam", "nagumo", "dr_kemuri", "pakki"]) intro.markIntroSeen(id);
        core.config.textSpeed = 4; core.saveConfig(); core.save();
        return JSON.stringify([s.day, s.slot, s.money, s.flavorStock, s.affinity]);
      }, step);
      await page.reload();
      await page.locator('[data-test="title-load"]').click();
      await page.locator('[data-test="slot-0"]').click();
      await page.locator(phone ? ".phone-overlay.show" : "#vn.active").waitFor();
      await page.waitForFunction(expected => [...document.querySelectorAll("#bg > .bg-img.show")]
        .some(n => `${n.dataset.sceneBg || ""} ${n.style.backgroundImage}`.includes(expected)), background);
      assert.equal(await page.locator("#screen .title").count(), 0, "LOAD title is removed before the resumed scene/phone");
      assert.doesNotMatch(await page.locator("#stage").ariaSnapshot(), /NEW GAME|GALLERY|CONFIG|LOAD/,
        "Title actions must also be absent from the accessibility tree");
      assert.equal(await page.evaluate(async () => {
        const { state: s } = await import("./js/core/state.js");
        return JSON.stringify([s.day, s.slot, s.money, s.flavorStock, s.affinity]);
      }), before, "Restoring a scene does not alter saved resources or the calendar");
    }, { viewport: { width: 1180, height: 757 } });
  }

  await check("sentence-pages", async page => {
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const ui = await import("./js/core/ui.js");
      const vn = await import("./js/vn/engine.js");
      core.newGame(); ui.clearScreen(); core.config.textSpeed = 4;
      void vn.play({ dialogue_id: "sentence_page_fixture", lines: [{ speaker: "", text: "文章の表示幅を確かめる。" }] });
    });
    await page.locator("#vn.active .vn-text").waitFor();
    const rows = await page.evaluate(async () => {
      const { DB } = await import("./js/core/data.js");
      const { paginateForBox } = await import("./js/vn/layout.js");
      return [
        ["ch1_tournament_judging", "チャコール博士の評価も、"],
        ["interval_day2_adam_lime", "アダムからはそれきりで、"],
      ].map(([id, prefix]) => {
        const lines = DB.dialogues[id].lines;
        const at = lines.findIndex(l => l.text?.startsWith(prefix));
        return lines.slice(at, at + 2).map(l => ({ text: l.text,
          pages: paginateForBox(l.text, document.querySelector(".vn-text")) }));
      });
    });
    for (const row of rows.flat()) {
      assert.equal(row.pages.length, 1, `Sentence stays on one page: ${row.text}`);
      assert.equal(row.pages[0].replaceAll("\n", ""), row.text);
    }
  }, { viewport: { width: 1180, height: 757 } });
});
