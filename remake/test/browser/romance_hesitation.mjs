import assert from "node:assert/strict";
import { suite, assertFits } from "./support.mjs";

const ids = ["minto", "tsumugi", "rio", "ageha", "mashiro", "samechan", "hiyori", "noor"];
async function prepare(page, id = "ageha", many = false) {
  await page.evaluate(async ({ id, many, ids }) => {
    window.H = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
      data: await import("./js/core/data.js"), romance: await import("./js/daily/romance.js") };
    const stages = await import("./js/core/affinity-stages.js");
    const intro = await import("./js/vn/intro.js");
    (await import("./js/chapters/ch1.js")).setupHooks();
    const s = H.core.newGame(); Object.assign(s, { phase: "daily", chapter: 2, day: 10, slot: 1 });
    s.lovers = many ? ids.filter(other => other !== id) : [id === "tsumugi" ? "rio" : "tsumugi"];
    s.flags._minto_name_known = true;
    for (const char of [...ids, "rin", "hajime"]) { s.met[char] = true; intro.markIntroSeen(char); }
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
    H.before = JSON.stringify(s); H.pictures = [];
    H.core.saveToSlot("suien_remake_slot1");
    H.done = false; H.run = H.vn.play(`confession_${id}`).then(result => { H.done = true; H.result = result; });
  }, { id, many, ids });
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
    for (const partner of ids.filter(other => other !== id)) assert(pictured.includes(partner === "rio" ? "rin" : partner), `missing real portrait: ${partner}`);
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
});
