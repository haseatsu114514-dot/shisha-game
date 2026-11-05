import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, storageSnapshot, assertFits } from "./support.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const selector = '[data-test="cfg-portrait-style"]';
const portraits = ".vn-portraits img";
const savedWithoutConfig = async page => {
  const snapshot = await storageSnapshot(page);
  delete snapshot.local.suien_remake_config;
  return snapshot;
};
const snapshot = page => page.evaluate(async () => {
  const { state } = await import("./js/core/state.js");
  return {
    state: JSON.stringify(state),
    text: document.querySelector(".vn-text").innerHTML,
    name: document.querySelector(".vn-name").textContent,
    images: [...document.querySelectorAll(".vn-portraits img")].map(image => ({
      speaker: image.dataset.speaker, face: image.dataset.face, slot: image.dataset.slot,
      pos: image.dataset.pos, active: image.classList.contains("active"),
    })),
  };
});
async function decoded(page) {
  await page.waitForFunction(() => [...document.querySelectorAll(".vn-portraits img")]
    .every(image => image.complete && image.naturalWidth > 0));
}
async function startScene(page, privateOutfit = false) {
  await page.evaluate(async privateOutfit => {
    const core = await import("./js/core/state.js");
    const { play, clearLog } = await import("./js/vn/engine.js");
    const { markIntroSeen } = await import("./js/vn/intro.js");
    window.portraitSceneAbort?.abort();
    clearLog();
    if (!core.state) {
      const state = core.newGame();
      Object.assign(state, { day: 8, slot: 1, money: 24680, stamina: 63, affinity: { tsumugi: 42 } });
      core.save();
      core.saveToSlot(core.SAVE_SLOTS[1].key);
    }
    for (const id of ["tsumugi", "minto", "sumi"]) markIntroSeen(id);
    core.config.textSpeed = 4;
    window.portraitSceneAbort = new AbortController();
    window.portraitSceneDone = false;
    const people = privateOutfit ? ["oneesan", "tsumugi"] : ["tsumugi", "minto"];
    void play({ dialogue_id: "portrait-style-browser-fixture", lines: [
      { speaker: people[0], face: "smile", text: "一人目の台詞です" },
      { speaker: people[1], face: privateOutfit ? "serious" : "sad", text: "二人目の台詞です" },
      { speaker: people[0], face: "serious", text: "未制作の表情です" },
      { speaker: "sumi", face: "normal", text: "新絵のない人物です" },
    ] }, { signal: window.portraitSceneAbort.signal }).then(() => { window.portraitSceneDone = true; });
  }, privateOutfit);
  await page.locator(".vn-next.show").waitFor();
  // Respect the engine's input guard at scene entry.
  await page.waitForTimeout(350);
  await page.locator(".vn-text").click();
  await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "二人目の台詞です");
  await decoded(page);
  assert.equal(await page.locator(portraits).count(), 2);
}

await suite("portrait-style", async check => {
  for (const touch of [false, true]) {
    const label = touch ? "landscape-touch" : "desktop";
    const options = { viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, hasTouch: touch };
    const activate = async locator => touch ? locator.tap() : locator.click();
    const settings = async page => {
      await activate(page.locator('[data-test="vn-config"]'));
      await page.locator(selector).waitFor();
      await page.locator(selector).scrollIntoViewIfNeeded();
      await assertFits(page, selector);
    };
    const close = async page => {
      await activate(page.locator('[data-test="cfg-close"]'));
      await page.locator("#modal.show").waitFor({ state: "hidden" });
    };
    const change = async (page, value) => {
      if (touch) await page.locator(selector).tap();
      else await page.locator(selector).focus();
      await page.locator(selector).selectOption(value);
      if (touch) await page.keyboard.press("Escape");
      await decoded(page);
    };
    await check(`${label}-registered-and-persistence`, async page => {
      assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.portraitStyle), "classic");
      const manifest = await page.evaluate(async () => (await import("./js/core/data.js")).DB.manifest.portraitVariants?.new || {});
      assert.deepEqual(manifest.tsumugi.faces, [
        'baito_bow','baito_evil','baito_normal','baito_sad','baito_serious','baito_smile','baito_surprise',
        'bow','evil','normal','sad','serious','smile','surprise',
      ]);
      await startScene(page);
      const before = await snapshot(page), saved = await savedWithoutConfig(page);
      const srcs = await page.locator(portraits).evaluateAll(images => images.map(image => image.src));
      await settings(page);
      await page.screenshot({ path: path.resolve(root, process.env.ARTIFACT_DIR || ".codex/artifacts/remake-browser", `portrait-style-${label}-settings.png`) });
      for (const value of ["new", "classic", "nanami", "new", "classic", "new"]) {
        await change(page, value);
        assert.deepEqual(await snapshot(page), before, "Settings do not advance dialogue, reorder people or mutate game state");
        const actual = await page.locator(portraits).evaluateAll(images => images.map(image => image.src));
        if(value === "classic") assert.deepEqual(actual, srcs);
        else if(value === "new") {
          assert.match(actual[0], /character_variants\/new\/tsumugi\/chr_tsumugi_smile/);
          assert.match(actual[1], /character_variants\/new\/minto\/chr_minto_normal/, "Missing new Minto sad retains the same-style normal");
        } else {
          assert.equal(actual[0], srcs[0], "Unregistered Nanami Tsumugi retains classic smile");
          assert.match(actual[1], /character_variants\/nanami\/minto\/chr_minto_sad/);
        }
        assert.equal(await page.evaluate(async () => (await import("./js/core/data.js")).portraitInfo('tsumugi','smile').scale), value === 'new' ? .9 : .88);
        assert.equal(await page.evaluate(() => JSON.parse(localStorage.suien_remake_config).portraitStyle), value);
        assert.deepEqual(await savedWithoutConfig(page), saved, "Autosave, manual slots, seen lines and other storage stay unchanged");
      }
      await close(page);
      assert.deepEqual(await snapshot(page), before);
      await settings(page);
      assert.equal(await page.locator(selector).inputValue(), "new");
      await close(page);
      await activate(page.locator('[data-test="vn-log"]'));
      assert.equal(await page.locator(".log-row").count(), 2, "Switching never duplicates log entries");
      await activate(page.locator(".vn-log button"));
      await page.reload({ waitUntil: "load" });
      await page.locator('[data-test="title-new"]').waitFor();
      assert.equal(await page.evaluate(async () => (await import("./js/core/state.js")).config.portraitStyle), "new");
      assert.deepEqual(await savedWithoutConfig(page), saved, "Reload preserves every game save byte");
      await startScene(page, true);
      await settings(page);
      const privateBefore = await snapshot(page);
      await change(page, "classic");
      await change(page, "new");
      assert.deepEqual(await snapshot(page), privateBefore);
      assert.match(await page.locator('img[data-speaker="oneesan"]').getAttribute("src"), /chr_minto_ura_smile/);
      await close(page);
    }, options);

    await check(`${label}-temporary-partial-variant`, async page => {
      // Browser-only fixture: existing normal bytes stand in for a visibly different smile.
      // No production image/manifest file is created or registered.
      await page.route("**/assets/sprites/character_variants/new/*/*.png", route => route.fulfill({
        path: path.join(root, "remake/img/sprites/characters/tsumugi/chr_tsumugi_normal.webp"), contentType: "image/webp",
      }));
      await page.evaluate(async () => {
        const { DB } = await import("./js/core/data.js");
        DB.manifest.portraitVariants = { new: {
          tsumugi: { faces: ["normal", "smile"], h: .88, b: .01, ax: .52, aspect: .75 },
          minto: { faces: ["normal", "smile"], h: .9, b: .02, ax: .5, aspect: .75 },
        } };
      });
      await startScene(page);
      const before = await snapshot(page), saved = await savedWithoutConfig(page);
      const original = await page.locator(portraits).evaluateAll(images => images.map(image => ({ src: image.src, style: image.style.cssText })));
      // On the second line tsumugi is silent, so this catches stale companion images.
      await settings(page);
      for (const value of ["new", "classic", "new"]) {
        await change(page, value);
        assert.deepEqual(await snapshot(page), before);
        const images = await page.locator(portraits).evaluateAll(images => images.map(image => ({ src: image.src, style: image.style.cssText })));
        if (value === "new") {
          assert.match(images[0].src, /character_variants\/new\/tsumugi\/chr_tsumugi_smile/);
          assert.notEqual(images[0].style, original[0].style, "New artwork uses its own framing measurements");
        } else assert.deepEqual(images[0], original[0]);
        if(value === "new") assert.match(images[1].src, /character_variants\/new\/minto\/chr_minto_normal/);
        else assert.deepEqual(images[1], original[1]);
        assert.deepEqual(await savedWithoutConfig(page), saved);
      }
      await close(page);
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "未制作の表情です");
      await decoded(page);
      assert.match(await page.locator('img[data-speaker="tsumugi"]').getAttribute("src"), /character_variants\/new\/tsumugi\/chr_tsumugi_normal/);
      const missingBefore = await snapshot(page);
      await settings(page);
      await change(page, "classic"); await change(page, "new");
      assert.deepEqual(await snapshot(page), missingBefore);
      await close(page);
      await page.locator(".vn-text").click();
      await page.waitForFunction(() => document.querySelector(".vn-text").textContent === "新絵のない人物です");
      await decoded(page);
      const noFamily = await snapshot(page);
      await settings(page); await change(page, "classic"); await change(page, "new");
      assert.deepEqual(await snapshot(page), noFamily);
      assert.match(await page.locator('img[data-speaker="sumi"]').getAttribute("src"), /sprites\/characters\/sumi\/chr_sumi_normal/);
      await close(page);
      await startScene(page, true);
      assert.match(await page.locator('img[data-speaker="oneesan"]').getAttribute("src"), /chr_minto_ura_smile/);
      await settings(page);
      await change(page, "classic"); await change(page, "new");
      assert.match(await page.locator('img[data-speaker="oneesan"]').getAttribute("src"), /chr_minto_ura_smile/);
      await close(page);
    }, options);
  }
}, { initScript: () => {
  // Deliberately old settings, without portraitStyle. Seed only on first load.
  if (!localStorage.getItem("suien_remake_config")) localStorage.setItem("suien_remake_config", JSON.stringify({ mute: true, textSpeed: 4, reduceShake: true, introArtStyle: "classic" }));
} });
