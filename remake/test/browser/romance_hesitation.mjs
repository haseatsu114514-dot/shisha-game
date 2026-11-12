import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const ids = ["minto", "tsumugi", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor"];
async function prepare(page, id = "ageha", many = false, start = true) {
  await page.evaluate(async ({ id, many, ids, start }) => {
    window.H = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), romance: await import("./js/daily/romance.js") };
    const stages = await import("./js/core/affinity-stages.js");
    const intro = await import("./js/vn/intro.js");
    (await import("./js/chapters/ch1.js")).setupHooks();
    const s = H.core.newGame(); Object.assign(s, { phase: "daily", chapter: 2, day: 10, slot: 1 });
    s.lovers = many ? ids.filter(other => other !== id) : [id === "tsumugi" ? "rio" : "tsumugi"];
    s.flags._minto_name_known = true;
    for (const char of [...ids, "hajime"]) { s.met[char] = true; intro.markIntroSeen(char); }
    s.finales[id] = { route: "romance", chapter: 2, day: 9 };
    for (const n of [1, 2]) s.romanceChoices[`bond_q${n}_${id}`] = { char: id, value: 1, day: 9 };
    s.flags[stages.questionDoneKey(id)] = true;
    if (id === "hiyori") {
      const route = H.data.DB.hiyori.route;
      for (const event of route.events || []) if (event.flag) s.flags[event.flag] = true;
      s.flags[route.question.flag] = true; s.flags[route.finale.flag] = true;
      for (const key of [route.question.choice, route.finale.question]) s.romanceChoices[key] = { char: id, value: 1, day: 9 };
    }
    H.core.config.textSpeed = 4; H.core.config.reduceMotion = true;
    H.vn.vnTest.turbo = false; H.vn.vnTest.choose = null;
    H.enter = []; H.choices = [];
    const enter = H.vn.hooks.onEnter, choice = H.vn.hooks.onChoice;
    H.vn.hooks.onEnter = (key, dlg) => { H.enter.push(key); enter?.(key, dlg); };
    H.vn.hooks.onChoice = (...args) => { H.choices.push(args[4].text); choice?.(...args); };
    const scene = H.data.DB.dialogues[`confession_${id}`];
    H.choice = scene.lines.find(line => line.type === "choice");
    H.before = JSON.stringify(s); H.confirmationSnapshotTaken = false; H.pictures = [];
    H.core.saveToSlot("suien_remake_slot1");
    H.done = !start; if (start) H.run = H.vn.play(`confession_${id}`).then(result => { H.done = true; H.result = result; });
  }, { id, many, ids, start });
}

async function readToChoice(page) {
  for (let n = 0; n < 100; n++) {
    await page.waitForFunction(() => H.done || document.querySelector("#vn.active .vn-choices.show") || document.querySelector("#vn.active .vn-next.show"));
    if (await page.evaluate(() => H.done || !!document.querySelector("#vn.active .vn-choices.show"))) return;
    await page.evaluate(() => {
      for (const img of document.querySelectorAll("#vn .vn-portraits img")) {
        if (img.complete && img.naturalWidth > 0) H.pictures.push(img.dataset.speaker);
      }
    });
    await page.locator("#vn.active .vn-box").click();
    await page.waitForTimeout(100);
  }
  throw Error("VN did not reach a choice or finish");
}
const choose = async (page, index) => {
  await page.evaluate(() => { if (!H.confirmationSnapshotTaken) { H.before = JSON.stringify(H.core.state); H.confirmationSnapshotTaken = true; } });
  await page.locator(`#vn.active .vn-choice:nth-child(${index + 1})`).click();
  await readToChoice(page);
};

await suite("romance-hesitation", async check => {
  for (const id of ids) await check(`${id}-real-accept-transition-and-seven-memories`, async page => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepare(page, id, true); await readToChoice(page); await choose(page, 0);
    assert.match(await page.locator(".vn-choice").first().innerText(), /言葉を飲み込む/);
    await assertFits(page, ".vn-choice");
    assert(await page.evaluate(() => H.before === JSON.stringify(H.core.state)));
    const pictured = await page.evaluate(() => [...new Set(H.pictures)]);
    for (const partner of ids.filter(other => other !== id)) assert(pictured.includes(partner), `missing real portrait: ${partner}`);
    await choose(page, 1);
    assert.match(await page.locator(".vn-choice").last().innerText(), /付き合うと伝える/);
    assert(await page.evaluate(() => H.before === JSON.stringify(H.core.state)));
    await choose(page, 1);
    await page.waitForFunction(id => H.enter.includes(`confession_${id}_accept`), id);
    const result = await page.evaluate(id => ({ lovers: H.core.state.lovers, choices: H.choices,
      text: H.vn.backlog().map(line => line.text).join(""), id }), id);
    assert(result.lovers.includes(id), `${id}: production romance hook must establish relationship`);
    assert.equal(result.choices.length, 1);
    assert(result.text.includes("ごめん"));
  });

  for (const stage of [1, 2]) await check(`touch-cancel-stage-${stage}-and-original-portrait`, async page => {
    await prepare(page); await readToChoice(page);
    const beforeText = await page.locator("#vn .vn-text").innerText();
    await choose(page, 0);
    if (stage === 2) await choose(page, 1);
    await choose(page, 0);
    assert.equal(await page.locator("#vn .vn-text").innerText(), beforeText);
    const result = await page.evaluate(() => ({ before: H.before === JSON.stringify(H.core.state), choices: H.choices.length,
      portraits: [...document.querySelectorAll("#vn .vn-portraits img")].map(img => ({ id: img.dataset.speaker, loaded: img.complete && img.naturalWidth > 0 })) }));
    assert(result.before); assert.equal(result.choices, 0); assert.deepEqual(result.portraits, [{ id: "ageha", loaded: true }]);
    await assertFits(page, ".vn-choice");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check("save-load-during-confirmation-never-accepts-stale-choice", async page => {
    await prepare(page); await readToChoice(page); await choose(page, 0);
    await page.evaluate(() => { H.core.newGame(); H.core.loadFromSlot("suien_remake_slot1"); });
    await page.locator("#vn.active .vn-choice").last().click();
    const result = await page.evaluate(() => ({ lovers: H.core.state.lovers, choices: H.choices.length, enter: H.enter }));
    assert.deepEqual(result.lovers, ["tsumugi"]); assert.equal(result.choices, 0);
    assert(!result.enter.includes("confession_ageha_accept"));
  });
  await check("settings-style-cancel-restores-current-style-and-bgm", async page => {
    await prepare(page); await readToChoice(page);
    const bgm = await page.evaluate(async () => (await import("./js/core/audio.js")).currentBgm());
    await choose(page, 0);
    await page.locator('[data-test="vn-config"]').click();
    await page.locator('[data-test="cfg-portrait-style"] button[value="classic"]').click();
    await page.locator('[data-test="cfg-close"]').click();
    await choose(page, 0);
    await page.waitForFunction(() => [...document.querySelectorAll("#vn .vn-portraits img")].every(img => img.complete && img.naturalWidth > 0));
    const restored = await page.evaluate(async () => ({
      bgm: (await import("./js/core/audio.js")).currentBgm(),
      portraits: [...document.querySelectorAll("#vn .vn-portraits img")].map(img => ({
        src: img.src, expected: H.data.portraitInfo(img.dataset.speaker, img.dataset.face).src,
      })),
      unchanged: H.before === JSON.stringify(H.core.state),
    }));
    assert.equal(restored.bgm, bgm); assert(restored.unchanged);
    assert(restored.portraits.length > 0);
    for (const portrait of restored.portraits) {
      assert.equal(portrait.src, portrait.expected); assert(portrait.src.includes("/characters/"));
    }
  });

  await check("normal-motion-skip-cannot-answer-either-confirmation", async page => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await prepare(page); await page.evaluate(() => { H.core.config.reduceShake = false; H.core.config.skipSeenOnly = false; });
    await readToChoice(page); await choose(page, 0);
    const first = await page.locator(".vn-choice").allTextContents();
    await page.locator('[data-test="vn-skip"]').click();
    assert.deepEqual(await page.locator(".vn-choice").allTextContents(), first);
    assert(await page.evaluate(() => H.before === JSON.stringify(H.core.state)));
    await choose(page, 1);
    const second = await page.locator(".vn-choice").allTextContents();
    await page.locator('[data-test="vn-skip"]').click();
    assert.deepEqual(await page.locator(".vn-choice").allTextContents(), second);
    await choose(page, 0);
    assert(await page.evaluate(() => H.before === JSON.stringify(H.core.state)));
  });

  await check("actual-night-caller-charges-old-warning-guilt-once-after-apology", async page => {
    await prepare(page, "rio", false, false);
    await page.evaluate(() => {
      H.core.state.slot = 2; H.core.state.flags._confession_due = "rio";
      H.guiltBefore = H.core.state.guilt || 0; H.done = false;
      H.run = H.romance.maybeConfession(async () => {}).then(result => { H.done = true; H.result = result; });
    });
    await readToChoice(page); await choose(page, 0); await choose(page, 1);
    assert.equal(await page.evaluate(() => H.core.state.guilt || 0), await page.evaluate(() => H.guiltBefore));
    await choose(page, 1);
    const result = await page.evaluate(() => ({ guilt: H.core.state.guilt, before: H.guiltBefore, lovers: H.core.state.lovers, flag: H.core.state.flags._cheat_go }));
    assert.equal(result.guilt, result.before + 3); assert(result.lovers.includes("rio")); assert.equal(result.flag, undefined);
  });

  await check("actual-heart-question-writes-production-answer-only-after-confirmations", async page => {
    await prepare(page, "rio", false, false);
    await page.evaluate(() => {
      const found = Object.values(H.data.DB.dialogues).flatMap(scene => [...(scene.lines || []), ...Object.values(scene.branches || {}).flat()]
        .filter(line => line.type === "choice" && line.romance_char === "rio" && line.id && line.choices.some(choice => choice.romance > 0))
        .map(line => ({ scene, line })))[0];
      if (!found) throw Error("Rio production heart question missing");
      H.questionKey = found.line.id; delete H.core.state.romanceChoices[H.questionKey];
      H.questionValue = found.line.choices.find(choice => choice.romance > 0).romance;
      H.questionIndex = found.line.choices.findIndex(choice => choice.romance > 0);
      H.done = false; H.run = H.vn.play({ ...found.scene, lines: [found.line] }).then(result => { H.done = true; H.result = result; });
    });
    await readToChoice(page); await choose(page, await page.evaluate(() => H.questionIndex)); await choose(page, 1);
    assert.equal(await page.evaluate(() => H.core.state.romanceChoices[H.questionKey]), undefined);
    await choose(page, 1);
    const result = await page.evaluate(() => ({ answer: H.core.state.romanceChoices[H.questionKey], expected: H.questionValue, lovers: H.core.state.lovers, friend: H.core.state.flags._friend_rio, choices: H.choices.length }));
    assert.equal(result.answer.char, "rio"); assert.equal(result.answer.value, result.expected);
    assert.deepEqual(result.lovers, ["tsumugi"]); assert(!result.friend); assert.equal(result.choices, 1);
  });

});
