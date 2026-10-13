// 関係の選択を実際に押し、回答・次の導線・保存データの不変性をPC／タッチで確かめる。
import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

async function setup(page) {
  await page.evaluate(async () => {
    window.R = {
      core: await import("./js/core/state.js"), stats: await import("./js/core/stats.js"),
      bonds: await import("./js/daily/bonds.js"), status: await import("./js/daily/status.js"),
      view: await import("./js/daily/relationship-status.js"), vn: await import("./js/vn/engine.js"),
      ch1: await import("./js/chapters/ch1.js"), data: await import("./js/core/data.js"),
    };
    R.ch1.setupHooks();
    R.fresh = () => {
      const s = R.core.newGame();
      Object.assign(s, { phase: "daily", day: 12, slot: 1 });
      s.flags._tsumugi_contest_submitted = true;
      return s;
    };
  });
}

async function status(page) {
  await page.evaluate(() => {
    R.beforeState = JSON.stringify(R.core.state);
    R.beforeSave = localStorage.getItem(R.core.SAVE_KEY);
    R.status.openStatus();
  });
  await page.locator('[data-tab="people"]').click();
}

async function closeStatus(page) {
  await page.locator('[data-test="status-close"]').click();
  const preserved = await page.evaluate(() => ({
    state: JSON.stringify(R.core.state) === R.beforeState,
    save: localStorage.getItem(R.core.SAVE_KEY) === R.beforeSave,
  }));
  assert(preserved.state && preserved.save, "Reading relationship guidance changed the save");
}

async function choicesFit(page) {
  await assertFits(page, ".vn-choices, .vn-choice, .vn-choice-route, .vn-choice-text");
  const rows = await page.locator(".route-choice").evaluateAll(buttons => buttons.map(b => {
    const badge = b.querySelector(".vn-choice-route").getBoundingClientRect();
    const text = b.querySelector(".vn-choice-text");
    const range = document.createRange(); range.selectNodeContents(text);
    return { separate: badge.right < text.getBoundingClientRect().left,
      fits: range.getBoundingClientRect().width <= text.getBoundingClientRect().width + 1,
      label: b.getAttribute("aria-label") };
  }));
  assert.equal(rows.length, 2);
  assert(rows.every(r => r.separate && r.fits && /^(恋愛|友情)：/.test(r.label)), JSON.stringify(rows));
}

await suite("relationship-ui", async check => {
  for (const [device, options] of [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    const press = async (page, selector) => device === "touch" ? page.locator(selector).tap() : page.locator(selector).click();

    await check(`${device}-actual-questions-and-status`, async page => {
      await setup(page);
      for (const id of ["tsumugi", "minto", "rin"]) for (const route of ["romance", "friend"]) {
        await page.evaluate(id => {
          const s = R.fresh(); s.met[id] = true; s.flags[`_intro_${id}`] = true;
          s.affinity[id] = 33; s.story[id] = id === "tsumugi" ? 4 : id === "rin" ? 3 : 6;
          if (id === "minto") Object.assign(s.flags, { _minto_identity_revealed: true, _minto_name_known: true, _minto_private_done: true });
          R.vn.vnTest.turbo = false;
          R.pending = R.bonds.playQuestionVisit(id);
        }, id);
        await page.locator("#vn.active").waitFor();
        await press(page, '[data-test="vn-skip"]');
        await page.locator(".route-choice").first().waitFor();
        assert.deepEqual(await page.locator(".vn-choice-route").allTextContents(), ["恋愛", "友情"]);
        await choicesFit(page);
        await press(page, `.vn-choice[data-route="${route}"]`);
        await page.evaluate(() => R.pending);
        const answer = await page.evaluate(id => ({
          saved: R.core.state.romanceChoices[R.stats.AFFINITY_GATE_CHOICES[id]],
          locked: R.stats.affinityGateWaiting(id), lover: R.core.state.lovers.includes(id),
          due: R.core.state.flags._confession_due ?? null,
        }), id);
        assert.equal(answer.saved.char, id); assert.equal(answer.saved.value, route === "romance" ? 1 : 0);
        assert(!answer.locked && !answer.lover); assert.equal(answer.due, null);
        await status(page);
        const row = page.locator(`[data-person="${id}"]`);
        assert.equal(await row.locator(".pp-relation").textContent(), route === "romance" ? "恋愛ルート" : "友人ルート");
        assert((await row.locator(".pp-next").textContent()).includes("♥5"));
        await assertFits(page, ".pp-guide, .pp-row, .pp-heading, .pp-next");
        await closeStatus(page);
      }
      // 最終画像は、数値を満たしただけでは告白にならない♥3の待機導線。
      await page.evaluate(() => {
        const s = R.fresh(); s.met.rin = true; s.affinity.rin = 33; s.story.rin = 3; R.core.save();
      });
      await status(page);
      assert.match(await page.locator('[data-person="rin"] .pp-next').textContent(), /Dr\.fookahの2階/);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${device}-legacy-and-progress-guidance`, async page => {
      await setup(page);
      for (const [name, fixture, label, hint] of [
        ["low-heart", { points: 20 }, "交流中", /♥3/],
        ["unanswered-old-heart5", { points: 66, hiddenRomance: 9 }, "関係を考える会話待ち", /恋愛・友情/],
        ["real-romance", { points: 33, answer: 1 }, "恋愛ルート", /♥5/],
        ["real-friend", { points: 33, answer: 0 }, "友人ルート", /友情でも/],
        ["ready-finale", { points: 66, answer: 1 }, "恋愛ルート", /Dr\.fookahの2階/],
        ["old-friend-flag", { points: 66, friendFlag: true }, "友人ルート", /♥5/],
        ["unanswered-old-finale", { points: 66, finale: "romance" }, "交流の節目", /見届けた/],
        ["legacy-final-answer", { points: 66, finalAnswer: 1, finale: "romance" }, "告白を選べる", /帰り道/],
        ["held-confession", { points: 66, answer: 1, finalAnswer: 1, finale: "romance", wait: true }, "告白を選べる", /後日の夜/],
      ]) {
        await page.evaluate(f => {
          const s = R.fresh(); s.met.rin = true; s.affinity.rin = f.points; s.story.rin = 3;
          if (f.answer !== undefined) s.romanceChoices.bond_q1_rin = { char: "rin", value: f.answer, day: 7 };
          if (f.finalAnswer !== undefined) s.romanceChoices.bond_q2_rin = { char: "rin", value: f.finalAnswer, day: 8 };
          if (f.finale) s.finales.rin = { route: f.finale, chapter: 1, day: 8 };
          if (f.friendFlag) s.flags._friend_rin = true;
          if (f.wait) s.flags._confession_wait = 14;
          if (f.hiddenRomance) s.romance.rin = f.hiddenRomance;
          R.core.save(); R.core.load();
        }, fixture);
        await status(page);
        const row = page.locator('[data-person="rin"]');
        assert.equal(await row.locator(".pp-relation").textContent(), label, name);
        assert.match(await row.locator(".pp-next").textContent(), hint, name);
        assert(!await row.evaluate(n => n.classList.contains("lover")), name);
        await assertFits(page, ".pp-row, .pp-heading, .pp-next");
        await closeStatus(page);
      }
      const summaries = await page.evaluate(() => {
        let s = R.fresh(); s.affinity.tsumugi = 66; s.day = 8; delete s.flags._tsumugi_contest_submitted;
        s.romanceChoices.bond_q1_tsumugi = { char: "tsumugi", value: 1, day: 7 };
        const tsumugi = R.view.relationshipStatus("tsumugi");
        s = R.fresh(); s.affinity.minto = 66; s.romanceChoices.bond_q1_minto = { char: "minto", value: 1, day: 7 };
        const minto = R.view.relationshipStatus("minto");
        s = R.fresh(); s.affinity.hiyori = 33;
        const hiyori = R.view.relationshipStatus("hiyori");
        s.flags._hiyori_tonari_return_done = true;
        s.romanceChoices.bond_q1_hiyori = { char: "hiyori", value: 1, day: 7 };
        const unfinished = R.view.relationshipStatus("hiyori");
        return { tsumugi, minto, hiyori, unfinished };
      });
      assert.match(summaries.tsumugi.hint, /応募/);
      assert.match(summaries.minto.hint, /LIMEの私的な約束/);
      assert.equal(summaries.hiyori.label, "スミさんとの再会待ち");
      assert(!summaries.unfinished.hint.includes("告白"), "Unfinished hiyori finale was advertised");

      await page.evaluate(() => {
        const s = R.fresh();
        for (const id of ["sumi", "tsumugi", "naru", "adam", "minto", "rin", "hiyori", "samechan", "ageha"]) {
          s.met[id] = true; s.affinity[id] = 66;
        }
        s.flags._samechan_nickname_known = true;
        s.flags._hiyori_tonari_return_done = true;
        s.finales.sumi = { route: "friend", day: 7, chapter: 1 };
        s.lovers = ["tsumugi", "rin"];
        s.finales.rin = { route: "friend", day: 7, chapter: 1 }; s.flags._friend_rin = true;
        s.loveLevel = { tsumugi: 2, rin: 4 }; s.lovePts = { tsumugi: 20, rin: 48 }; R.core.save();
      });
      await status(page);
      assert.equal(await page.locator(".pp-row.lover").count(), 2);
      assert.deepEqual(await page.locator(".pp-row.lover .pp-relation").allTextContents(), ["恋人", "恋人"]);
      assert.equal(await page.locator('[data-person="sumi"] .pp-relation').textContent(), "友達");
      assert.equal(await page.locator('[data-person="samechan"]').count(), 1);
      assert.match(await page.locator('[data-person="samechan"] .pp-next').textContent(), /第2章/);
      assert.equal(await page.locator('.pp-row.lover [aria-label="恋人（♥5）"]').count(), 2);
      assert(!/Lv[.0-9]|lovePts|BOND/.test(await page.locator(".st-people").textContent()));
      await closeStatus(page);
      await page.evaluate(() => { R.fresh(); });
      await status(page);
      assert.equal(await page.locator('[data-person="samechan"]').count(), 0);
      assert.equal(await page.locator('[data-person="ageha"]').count(), 0);
      await closeStatus(page);
      await page.evaluate(() => {
        const s = R.fresh(); s.met.rin = true; s.affinity.rin = 66; s.story.rin = 3;
        s.romanceChoices.bond_q1_rin = { char: "rin", value: 1, day: 7 };
        s.romanceChoices.bond_q2_rin = { char: "rin", value: 1, day: 8 };
        s.finales.rin = { route: "romance", chapter: 1, day: 8 }; R.core.save();
      });
      await status(page);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${device}-final-choices-and-ordinary-dialogue`, async page => {
      await setup(page);
      for (const id of ["tsumugi", "minto", "rin", "samechan"]) {
        await page.evaluate(id => {
          R.fresh(); R.vn.vnTest.turbo = false;
          const scene = R.data.DB.dialogues[R.bonds.BOND_FINALES[id].dialogue];
          const rows = [...scene.lines, ...Object.values(scene.branches || {}).flat()];
          const line = rows.find(l => l.id === R.bonds.BOND_FINALES[id].question);
          R.pending = R.vn.play({ dialogue_id: "relationship_ui_final_question", lines: [line] });
        }, id);
        await page.locator(".route-choice").first().waitFor();
        await choicesFit(page);
        await press(page, '.vn-choice[data-route="friend"]');
        await page.evaluate(() => R.pending);
      }
      await page.evaluate(() => {
        R.pending = R.vn.play({ dialogue_id: "relationship_ui_ordinary_choice", lines: [
          { type: "choice", choices: [{ text: "もう少し話す", romance: 1 }, { text: "また今度", romance: 0 }] },
        ] });
      });
      await page.locator(".vn-choice").first().waitFor();
      assert.equal(await page.locator(".vn-choice-route").count(), 0, "Ordinary dialogue got a relationship label");
      await assertFits(page, ".vn-choices, .vn-choice");
      await press(page, '[data-test="choice-0"]');
      await page.evaluate(() => R.pending);
      await page.evaluate(() => {
        const scene = R.data.DB.dialogues.ch1_tsumugi_bond_question;
        R.pending = R.vn.play({ dialogue_id: "relationship_ui_preview", lines: [scene.lines.find(l => l.type === "choice")] });
      });
      await page.locator(".route-choice").first().waitFor();
      await choicesFit(page);
      await page.evaluate(() => Promise.all([...document.querySelectorAll(".vn-choice")]
        .flatMap(n => n.getAnimations().map(a => a.finished.catch(() => {})))));
    }, { ...options, reducedMotion: "reduce" });
  }
});
