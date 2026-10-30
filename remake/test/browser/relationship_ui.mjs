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

async function choicesFit(page, expected) {
  await page.mouse.move(0, 0);
  await page.evaluate(() => Promise.all([...document.querySelectorAll(".vn-choice")]
    .flatMap(n => n.getAnimations().map(a => a.finished.catch(() => {})))));
  await assertFits(page, ".vn-choices, .vn-choice");
  assert.deepEqual(await page.locator(".vn-choice").allTextContents(), expected, "Only the actual replies should be shown");
  const rows = await page.locator(".vn-choice").evaluateAll(buttons => buttons.map(b => ({
    label: b.getAttribute("aria-label"), route: b.dataset.route ?? null,
    className: b.className, color: getComputedStyle(b).color,
    background: getComputedStyle(b).backgroundColor,
  })));
  assert.equal(rows.length, 2);
  assert(rows.every(r => r.label === null && r.route === null && r.className === "vn-choice"), JSON.stringify(rows));
  assert.equal(rows[0].color, rows[1].color, "Choice color revealed the route");
  assert.equal(rows[0].background, rows[1].background, "Choice background revealed the route");
  assert.equal(await page.locator(".vn-choice-route").count(), 0);
}

const questions = {
  tsumugi: ["絵がなくても、つむぎちゃんに会いたいよ", "描けない日も、ここでゆっくりしていって"],
  rin: ["用事がなくても、凛さんに会いに来ます", "次の試香も、俺に手伝わせてください"],
  minto: ["栞さんと２人だと、ちょっと緊張する", "また話そう。愚痴でも聞くよ"], // #1730 で栞へはタメ口に統一
};
const reactions = {
  tsumugi: [/絵じゃなくて、私に/, /この席は、描かなくても/],
  rin: [/今日は、何を話してもレポートにしない/, /向こうの机まで届かない感想/],
  minto: [/私も。お店の外だと、ちょっと緊張する/, /お店の話、気楽にできる人/],
};

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
          R.logStart = R.vn.backlog().length;
          R.pending = R.bonds.playQuestionVisit(id);
        }, id);
        await page.locator("#vn.active").waitFor();
        await press(page, '[data-test="vn-skip"]');
        await page.locator(".vn-choice").first().waitFor();
        await choicesFit(page, questions[id].map(text => `「${text}」`));
        await press(page, `[data-test="choice-${route === "romance" ? 0 : 1}"]`);
        await page.evaluate(() => R.pending);
        const answer = await page.evaluate(id => ({
          saved: R.core.state.romanceChoices[R.stats.AFFINITY_GATE_CHOICES[id]],
          locked: R.stats.affinityGateWaiting(id), lover: R.core.state.lovers.includes(id),
          due: R.core.state.flags._confession_due ?? null,
          reaction: R.vn.backlog().slice(R.logStart).map(l => l.text).join("\n"),
        }), id);
        assert.equal(answer.saved.char, id); assert.equal(answer.saved.value, route === "romance" ? 1 : 0);
        assert(!answer.locked && !answer.lover); assert.equal(answer.due, null);
        assert.match(answer.reaction, reactions[id][route === "romance" ? 0 : 1], "The selected reply did not lead to its reaction");
        await status(page);
        const row = page.locator(`[data-person="${id}"]`);
        assert.equal(await row.locator(".pp-relation").textContent(), route === "romance" ? "恋愛ルート" : "友人ルート");
        // ♥5までの反復説明は各人の行から外し、全体ガイドに一度だけまとめる（#1044 A09）
        assert.equal(await row.locator(".pp-next").count(), 0, "mid-tier row should not repeat the ♥ explanation");
        const guide = await page.locator(".pp-guide").textContent();
        assert(guide.includes("♥3") && guide.includes("♥5"), "the ♥3/♥5 stage explanation belongs in the shared guide");
        await assertFits(page, ".pp-guide, .pp-row, .pp-heading, .pp-next, .pp-memory");
        await closeStatus(page);
      }
      // 最終画像は、数値を満たしただけでは告白にならない♥3の待機導線。
      await page.evaluate(() => {
        const s = R.fresh(); s.met.rin = true; s.affinity.rin = 33; s.story.rin = 3; R.core.save();
      });
      await status(page);
      assert.match(await page.locator('[data-person="rin"] .pp-next').textContent(), /Dr\.fookahの2階/);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${device}-hiyori-and-samechan-questions`, async page => {
      await setup(page);
      for (const [id, scene, replies, romanceIndex, responses] of [
        ["hiyori", "hiyori_bond_question", ["また斧投げしましょう。次は負けませんよ", "ひよりさんに会えるなら、二人でどこでも"], 1,
          [/斧投げのあと、お腹すくから/, /二人で……。そっか/]],
        ["samechan", "samechan_shop_bond_question", ["サメちゃんに会いたいから、来ます", "またサメ映画の話、聞かせてください"], 0,
          [/とっておきの一本/, /わ、わしにか/]],
      ]) for (const value of [0, 1]) {
        await page.evaluate(({ id, scene }) => {
          const s = R.fresh(); s.met[id] = true; s.affinity[id] = 33;
          if (id === "samechan") { s.chapter = 2; s.flags._samechan_nickname_known = true; }
          R.vn.vnTest.turbo = false; R.logStart = R.vn.backlog().length;
          R.pending = R.vn.play(scene);
        }, { id, scene });
        await page.locator("#vn.active").waitFor();
        await press(page, '[data-test="vn-skip"]');
        await page.locator(".vn-choice").first().waitFor();
        await choicesFit(page, replies);
        await press(page, `[data-test="choice-${value ? romanceIndex : 1 - romanceIndex}"]`);
        await page.evaluate(() => R.pending);
        const result = await page.evaluate(id => ({
          answer: R.core.state.romanceChoices[`bond_q1_${id}`],
          lover: R.core.state.lovers.includes(id), due: R.core.state.flags._confession_due ?? null,
          reaction: R.vn.backlog().slice(R.logStart).map(l => l.text).join("\n"),
        }), id);
        assert.equal(result.answer.char, id); assert.equal(result.answer.value, value);
        assert(!result.lover); assert.equal(result.due, null);
        assert.match(result.reaction, responses[value]);
      }
    }, { ...options, reducedMotion: "reduce" });

    await check(`${device}-legacy-and-progress-guidance`, async page => {
      await setup(page);
      // hint が null のものは、反復する♥説明を全体ガイドへ集約したため各人の行に導線文を出さない（#1044 A09）
      for (const [name, fixture, label, hint] of [
        ["low-heart", { points: 20 }, "交流中", null],
        ["unanswered-old-heart5", { points: 66, hiddenRomance: 9 }, "関係を考える会話待ち", /恋愛・友情/],
        ["real-romance", { points: 33, answer: 1 }, "恋愛ルート", null],
        ["real-friend", { points: 33, answer: 0 }, "友人ルート", null],
        ["ready-finale", { points: 66, answer: 1 }, "恋愛ルート", /Dr\.fookahの2階/],
        ["old-friend-flag", { points: 66, friendFlag: true }, "友人ルート", /特別なイベント/],
        ["unanswered-old-finale", { points: 66, finale: "romance" }, "交流の節目", /見届けた/],
        ["legacy-final-answer", { points: 66, finalAnswer: 1, finale: "romance" }, "告白を選べる", /帰り道/],
        ["held-confession", { points: 66, answer: 1, finalAnswer: 1, finale: "romance", wait: true }, "告白を選べる", /後日の夜/],
      ]) {
        await page.evaluate(f => {
          const s = R.fresh(); s.met.rin = true; s.affinity.rin = f.points; s.story.rin = 4; // 固有会話4本を読了（#1696で4本目を追加）
          if (f.points === 66 && f.answer !== undefined && f.finalAnswer === undefined && !f.finale) s.flags._rin_affinity_question_done = true;
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
        if (hint) assert.match(await row.locator(".pp-next").textContent(), hint, name);
        else assert.equal(await row.locator(".pp-next").count(), 0, name);
        assert(!await row.evaluate(n => n.classList.contains("lover")), name);
        await assertFits(page, ".pp-row, .pp-heading, .pp-next, .pp-memory");
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
        s.affinity.hiyori = 66; s.met.hiyori = true;
        for (const id of R.data.DB.hiyori.route.storyEvents) {
          s.flags[R.data.DB.hiyori.route.events.find(e => e.id === id).flag] = true;
        }
        s.flags._hiyori_bond_question_done = true;
        const ready = R.view.relationshipStatus("hiyori");
        return { tsumugi, minto, hiyori, unfinished, ready };
      });
      assert.match(summaries.tsumugi.hint, /応募/);
      assert.match(summaries.minto.hint, /LIMEの私的な約束/);
      assert.equal(summaries.hiyori.label, "スミさんとの再会待ち");
      assert(!summaries.unfinished.hint.includes("告白"), "Unfinished hiyori finale was advertised");
      assert.match(summaries.unfinished.hint, /斧投げや仕事/);
      assert.match(summaries.ready.hint, /tonari.*特別なイベント/, "The registered gift must have reachable guidance");

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

    // #1044 A09: 反復する♥3/♥5説明は全体ガイドに集約し、各人の行は直近の思い出を前面に出す
    await check(`${device}-recent-memories-foregrounded`, async page => {
      await setup(page);
      await page.evaluate(() => {
        const s = R.fresh();
        s.met.naru = true; s.met.hiyori = true;
        s.affinity.naru = 20; s.affinity.hiyori = 20;
        s.relationshipMemories = ["naru_hands", "naru_inherit"]; // 直近に積んだ naru_inherit を出す
        R.core.save();
      });
      await status(page);
      const naru = page.locator('[data-person="naru"]');
      assert.equal(await naru.locator(".pp-memory").count(), 1, "直近の思い出を前面に出す");
      const echo = await page.evaluate(() => R.data.DB.relationshipMemories.naru_inherit.echo);
      assert.equal(await naru.locator(".pp-memory").textContent(), echo, "最新の思い出を表示する");
      assert.equal(await naru.locator(".pp-next").count(), 0, "♥の反復説明は行から外す");
      // 思い出のない人は中立の短い表示（思い出の行は出さない）
      assert.equal(await page.locator('[data-person="hiyori"] .pp-memory').count(), 0);
      await assertFits(page, ".pp-guide, .pp-row, .pp-heading, .pp-memory, .pp-next");
      await closeStatus(page);
    }, { ...options, reducedMotion: "reduce" });

    await check(`${device}-final-choices-and-ordinary-dialogue`, async page => {
      await setup(page);
      for (const id of ["tsumugi", "minto", "rin", "samechan", "hiyori"]) {
        const replies = await page.evaluate(id => {
          R.fresh(); R.vn.vnTest.turbo = false;
          const scene = R.data.DB.dialogues[R.bonds.BOND_FINALES[id].dialogue];
          const rows = [...scene.lines, ...Object.values(scene.branches || {}).flat()];
          const line = rows.find(l => l.id === R.bonds.BOND_FINALES[id].question);
          R.pending = R.vn.play({ dialogue_id: "relationship_ui_final_question", lines: [line] });
          return line.choices.map(c => c.text);
        }, id);
        await page.locator(".vn-choice").first().waitFor();
        await choicesFit(page, replies);
        const friendIndex = await page.evaluate(id => {
          const scene = R.data.DB.dialogues[R.bonds.BOND_FINALES[id].dialogue];
          return [...scene.lines, ...Object.values(scene.branches || {}).flat()]
            .find(l => l.id === R.bonds.BOND_FINALES[id].question).choices.findIndex(c => c.romance === 0);
        }, id);
        await press(page, `[data-test="choice-${friendIndex}"]`);
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
      // 正式な♥3会話の導入・立ち絵を経て、最後のスクリーンショットを残す。
      await page.evaluate(() => { R.fresh(); R.pending = R.vn.play("ch1_minto_bond_question"); });
      await page.locator("#vn.active").waitFor();
      await press(page, '[data-test="vn-skip"]');
      await page.locator(".vn-choice").first().waitFor();
      await choicesFit(page, questions.minto.map(text => `「${text}」`));
      await page.evaluate(() => Promise.all([...document.querySelectorAll(".vn-choice")]
        .flatMap(n => n.getAnimations().map(a => a.finished.catch(() => {})))));
    }, { ...options, reducedMotion: "reduce" });
  }
});
