// #452 B: actual draft answers, neutral legacy saves, and production VN inputs.
import assert from "node:assert/strict";
import fs from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { suite, assertFits } from "./support.mjs";

const baseline = JSON.parse(fs.readFileSync(new URL("../../../docs/qa/issue452-tsumugi/baseline-scenes.json", import.meta.url)));
const WIP = "ch1_tsumugi_work_in_progress", ART = "ch1_tsumugi_sketch";
const KEYS = ["_tsumugi_contest_draft_window", "_tsumugi_contest_draft_hands"];
const RESPONSES = [
  "……ほどけていく煙と猫、残しました。好きって言ってくれたので",
  "……色のなかった右側、描き込みました。好きって言ってくれたので",
];
// DAY3の選択肢。baseline は v2（店内の下描き）当時の台本、current は v3（抽象スケッチ）。
const DRAFT_LABELS = { baseline: ["窓辺の煙と猫", "カウンターの手元"], current: ["ほどけていく煙と猫", "まだ色のない右側"] };
const NEUTRAL = "つむぎの指が、窓辺の猫のそばで止まった。";
const artifacts = process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser";

async function prepare(page) {
  await page.evaluate(async () => {
    window.T = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), chapter: await import("./js/chapters/ch1.js"),
      story: await import("./js/chapters/tsumugi-story.js"), saves: await import("./js/scenes/saves.js"),
      stats: await import("./js/core/stats.js"), bonds: await import("./js/daily/bonds.js") };
    T.chapter.setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    T.fresh = ({ route = "unanswered", known = false } = {}) => {
      const s = T.core.newGame(); Object.assign(s, { day: 11, slot: 2, phase: "daily", seed: 452, weatherSeed: 452 });
      s.met.tsumugi = s.met.sumi = true;
      Object.assign(s.flags, { _intro_tsumugi: true, _intro_sumi: true, _met_tsumugi: true,
        _tsumugi_contest_research: true, _lime_contact_tsumugi: true });
      s.contacts.push("tsumugi");
      if (known) s.flags._tsumugi_contest_art_seen = true;
      if (route !== "unanswered") {
        s.romanceChoices.bond_q1_tsumugi = { char: "tsumugi", value: route === "friend" ? 0 : 1, day: 7 };
        s.romance.tsumugi = route === "friend" ? 0 : 1;
      }
      T.vn.backlog().length = 0;
      return s;
    };
    T.lines = () => T.vn.backlog().map(l => l.text);
    T.game = () => { const s = structuredClone(T.core.state); delete s.savedAt; return s; };
  });
}

function assertResponse(lines, answer) {
  assert.equal(lines.includes(NEUTRAL), answer === null);
  RESPONSES.forEach((text, i) => assert.equal(lines.includes(text), answer === i));
  assert.equal(lines.filter(text => text === "「応募完了」。短い文字を、２人で確かめた。").length, 1);
}

function stateDifferences(expected, actual, path = "") {
  if (isDeepStrictEqual(expected, actual)) return [];
  if (expected && actual && typeof expected === "object" && typeof actual === "object"
    && Array.isArray(expected) === Array.isArray(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
    const differences = [...keys].flatMap(key => {
      const childPath = path ? `${path}.${key}` : key;
      if (!Object.hasOwn(expected, key) || !Object.hasOwn(actual, key)) {
        return [{ key: childPath, expected: expected[key], actual: actual[key] }];
      }
      return stateDifferences(expected[key], actual[key], childPath);
    });
    return differences.length ? differences : [{ key: path || "<root>", expected, actual }];
  }
  return [{ key: path || "<root>", expected, actual }];
}

async function input(locator, touch) { if (touch) await locator.tap(); else await locator.click(); }

// Instant text is a player setting. Keep production transitions and input guards.
async function start(page, scene) {
  await page.evaluate(scene => {
    T.vn.backlog().length = 0; T.vn.vnTest.turbo = false; T.core.config.textSpeed = 4;
    window.finished = false; T.vn.play(scene).then(() => { window.finished = true; });
  }, scene);
  await page.waitForFunction(() => T.vn.backlog().length > 0);
  await page.waitForTimeout(350);
}

async function finishByInput(page, { touch, answer = 0, snapshot = false, labels = DRAFT_LABELS.current } = {}) {
  let clicks = 0, choices = 0;
  for (let i = 0; i < 150; i++) {
    if (await page.evaluate(() => window.finished)) return { clicks, choices, lines: await page.evaluate(() => T.lines()) };
    const buttons = page.locator(".vn-choices button");
    if (await buttons.count()) {
      assert.deepEqual(await buttons.allTextContents(), labels);
      await assertFits(page, ".vn-choices button");
      await input(buttons.nth(answer), touch); choices++;
      continue;
    }
    await page.waitForFunction(() => window.finished || document.querySelector(".vn-next.show")
      || document.querySelector(".vn-choices button"));
    if (await page.evaluate(() => window.finished)) continue;
    if (await buttons.count()) continue;
    const before = await page.evaluate(() => ({ n: T.vn.backlog().length, text: document.querySelector(".vn-text").textContent }));
    if (snapshot && await page.evaluate(response => T.lines().some(t => response.includes(t)), [...RESPONSES, NEUTRAL])) {
      await assertFits(page, ".vn-box, .vn-text");
      assert(await page.locator(".vn-cg.show").evaluate(async node => {
        const image = new Image(); image.src = node.style.backgroundImage.slice(5, -2);
        await image.decode();
        return node.dataset.cg === "cg_ch1_tsumugi_heart_art" && image.naturalWidth > 0;
      }));
      await page.screenshot({ path: `${artifacts}/${touch ? "touch" : "pc"}-tsumugi-answer-${answer}.png` });
      snapshot = false;
    }
    await input(page.locator(".vn-box"), touch); clicks++;
    await page.waitForFunction(before => window.finished || T.vn.backlog().length > before.n
      || document.querySelector(".vn-text").textContent !== before.text || document.querySelector(".vn-choices button"), before);
  }
  throw Error("VN did not finish");
}

await suite("tsumugi-draft-response", async check => {
  await check("answers-neutral-routes-known-art-and-idempotence", async page => {
    await prepare(page);
    const rows = await page.evaluate(async ({ baseline, WIP, ART, KEYS }) => {
      const out = [];
      T.vn.vnTest.turbo = true;
      for (const answer of [null, 0, 1]) for (const route of ["unanswered", "friend", "romance"])
        for (const known of [false, true]) {
          const s = T.fresh({ route, known });
          if (answer !== null) {
            T.vn.vnTest.choose = () => answer; await T.vn.play(WIP);
            T.core.save(); T.core.newGame(); T.core.load();
          } else {
            // A legacy save may have read the draft, max affection and visits, but no saved answer.
            s.flags._tsumugi_contest_progress = true; s.story.tsumugi = 5; s.visits.tsumugi = 20; s.affinity.tsumugi = 66;
            s.relationshipMemories.push("tsumugi_progress");
            const old = structuredClone(s); old.schema = 13;
            localStorage.setItem("suien_remake_slot1", JSON.stringify(old)); T.core.loadFromSlot("suien_remake_slot1");
          }
          const initial = structuredClone(T.core.state);
          T.vn.backlog().length = 0; await T.vn.play(baseline.scenes[ART]); const before = T.game();
          T.core.setState(structuredClone(initial)); T.vn.backlog().length = 0;
          await T.story.playTsumugiStory(11);
          const current = T.game(), lines = T.lines();
          // The story wrapper guarantees only the initial ♥1 (the day-1
          // introduction); story completion and personal affinity are separate,
          // so the day-11 sketch grants no level. Mirror that guarantee (♥1).
          // It also stamps the day the story was read (_tsumugi_story_day), which the
          // raw baseline scene cannot produce; mirror the stamp the same way.
          T.core.setState(before); T.stats.ensureAffinityLevel("tsumugi", 1);
          if (current.flags._tsumugi_story_day === undefined) delete T.core.state.flags._tsumugi_story_day;
          else T.core.state.flags._tsumugi_story_day = current.flags._tsumugi_story_day;
          const expected = T.game();
          T.core.setState(current); T.vn.backlog().length = 0; await T.story.playTsumugiStory(11);
          const repeated = T.game();
          out.push({ answer, route, known, before: expected, current, repeated, lines,
            reread: T.lines(), keys: KEYS.map(k => current.flags[k] ?? null) });
        }
      return out;
    }, { baseline, WIP, ART, KEYS });
    const differences = [];
    for (const r of rows) {
      const row = `${r.answer}/${r.route}/${r.known}`;
      for (const difference of stateDifferences(r.before, r.current)) {
        differences.push(`${row} ${difference.key}: expected ${JSON.stringify(difference.expected)}, actual ${JSON.stringify(difference.actual)}`);
      }
      assert.deepEqual(r.repeated, r.current, "Repeat story duplicated an effect");
      assert.deepEqual(r.reread, []);
      assert.deepEqual(r.keys, r.answer === null ? [null, null] : [r.answer === 0, r.answer === 1]);
      assertResponse(r.lines, r.answer);
      assert.equal(r.lines.includes("お守りに送ってくれた絵だ。いよいよ、応募するんだね"), r.known);
      assert(r.current.flags._tsumugi_contest_submitted && r.current.flags._tsumugi_contest_art_seen);
      assert.equal(r.current.relationshipMemories.filter(m => m === "tsumugi_submission").length, 1);
    }
    assert.equal(differences.length, 0, `State effect changed:\n${differences.join("\n")}`);
    console.log(`Compared ${rows.length} paths: full game state, CG, routes, submission and rewards unchanged`);
  });

  for (const [label, options, touch] of [
    ["pc", {}, false],
    ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) for (const answer of [null, 0, 1]) {
    await check(`${label}-${answer ?? "legacy"}-save-load-clicks-skip`, async page => {
      await prepare(page);
      // Read the identical route on baseline/current with native click/tap, counting pages and choices.
      const counts = {};
      for (const version of ["baseline", "current"]) {
        await page.evaluate(() => { T.fresh(); localStorage.removeItem("suien_remake_slot1"); });
        let draft = { clicks: 0, choices: 0 };
        if (answer !== null) {
          await start(page, version === "baseline" ? baseline.scenes[WIP] : WIP);
          draft = await finishByInput(page, { touch, answer, labels: DRAFT_LABELS[version] });
        } else await page.evaluate(() => {
          T.core.state.flags._tsumugi_contest_progress = true;
          T.core.state.story.tsumugi = 5; T.core.state.affinity.tsumugi = 66;
        });
        if (version === "current") {
          await page.evaluate(() => { window.saved = T.saves.saveFlow(); });
          await input(page.locator('[data-test="slot-1"]'), touch);
          assert(await page.evaluate(() => window.saved));
          await page.reload(); await page.locator('[data-test="title-new"]').waitFor(); await prepare(page);
          await page.evaluate(() => { window.loaded = T.saves.loadFlow(); });
          await input(page.locator('[data-test="slot-1"]'), touch);
          await page.evaluate(async () => { T.core.loadFromSlot(await window.loaded); });
          assert.deepEqual(await page.evaluate(keys => keys.map(k => T.core.state.flags[k] ?? null), KEYS),
            answer === null ? [null, null] : [answer === 0, answer === 1]);
        }
        await start(page, version === "baseline" ? baseline.scenes[ART] : ART);
        const art = await finishByInput(page, { touch, answer, snapshot: version === "current", labels: DRAFT_LABELS[version] });
        assert.equal(art.choices, 0, "A new choice was added to the completed-art scene");
        if (version === "current") assertResponse(art.lines, answer);
        counts[version] = { draftClicks: draft.clicks, choices: draft.choices, artClicks: art.clicks };
      }
      assert.deepEqual(counts.current, counts.baseline, "Dialogue click count changed");
      console.log(`${label}/${answer ?? "legacy"} clicks: ${JSON.stringify(counts)}`);

      // Production SKIP stops at the existing two choices; it never supplies an answer.
      await page.evaluate(() => { T.fresh(); });
      if (answer !== null) {
        await start(page, WIP);
        await input(page.locator('[data-test="vn-skip"]'), touch);
        await page.locator('.vn-choices button').first().waitFor();
        await page.waitForTimeout(250);
        assert.deepEqual(await page.evaluate(keys => keys.map(k => T.core.state.flags[k] ?? null), KEYS), [null, null]);
        await input(page.locator('.vn-choices button').nth(answer), touch);
        await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      } else await page.evaluate(() => { T.core.state.flags._tsumugi_contest_progress = true; });
      await start(page, ART);
      await input(page.locator('[data-test="vn-skip"]'), touch);
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
      assertResponse(await page.evaluate(() => T.lines()), answer);
      assert.equal(await page.locator('.vn-cg.show').count(), 0, "CG did not close");
    }, options);
  }

  await check("answer-saved-at-click-and-replaced-on-real-reselection", async page => {
    await prepare(page);
    for (const answer of [0, 1]) {
      if (answer === 0) await page.evaluate(() => { T.fresh(); });
      await start(page, WIP);
      await input(page.locator('[data-test="vn-skip"]'), false);
      await page.locator('.vn-choices button').first().waitFor();
      await input(page.locator('.vn-choices button').nth(answer), false);
      const immediate = await page.evaluate(keys => {
        const s = T.core.peekSave();
        return { keys: keys.map(k => s.flags[k]), progress: !!s.flags._tsumugi_contest_progress };
      }, KEYS);
      assert.deepEqual(immediate.keys, [answer === 0, answer === 1]);
      // The answer save must not prematurely grant the scene's completion or memory.
      if (answer === 0) assert.equal(immediate.progress, false);
      await page.waitForFunction(() => window.finished, null, { timeout: 20000 });
    }
  });
});
