// #788: 斧投げBARとひよりの斧投げで、開始時に斧投げ曲、終了・中断で元の曲へ戻る。再入場で二重に鳴らさない。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";
const t = id => `[data-test="${id}"]`;
const bgm = page => page.evaluate(() => A.audio.currentBgm());

async function setup(page) {
  await page.mouse.click(4, 4); // 実ブラウザの自動再生制限を、プレイヤーの操作と同じく解除する
  await page.evaluate(async () => {
    window.A = { core: await import("./js/core/state.js"), audio: await import("./js/core/audio.js"),
      bar: await import("./js/daily/axe-bar.js"), daily: await import("./js/daily/hiyori.js") };
    A.audio.unlockAudio();
    await new Promise(r => setTimeout(r, 100));
    A.core.config.bgmVolume = 0;
  });
}
async function waitBgm(page, key) {
  await page.waitForFunction(key => A.audio.currentBgm() === key, key);
}

await suite("axe-bgm-788", async check => {
  await check("axe-bar-enter-reenter-leave-and-abort", async page => {
    await setup(page);
    await page.evaluate(() => {
      const s = A.core.newGame(); Object.assign(s, { phase: "daily", day: 5, slot: 1, money: 12000, stamina: 80 });
      s.flags._axe_bar_rumor_done = true; s.flags._axe_bar_sighting_done = true; s.flags._axe_bar_sighting_day = 3;
      A.audio.playBgm("kansetsu_shomei_to_black_coffee");
    });
    await waitBgm(page, "kansetsu_shomei_to_black_coffee");
    await page.evaluate(() => { A.flow = A.bar.visitAxeBar(); });
    await page.locator(t("axe-bar-back")).waitFor();
    assert.equal(await bgm(page), "bgm_axe");
    assert.equal(await page.evaluate(() => A.bar.visitAxeBar()), false, "re-entry while open is refused");
    assert.equal(await bgm(page), "bgm_axe");
    await page.locator(t("axe-bar-back")).click();
    assert.equal(await page.evaluate(() => A.flow), false);
    assert.equal(await bgm(page), "kansetsu_shomei_to_black_coffee");
    // 中断（外部signal）でも元の曲へ戻る。
    await page.evaluate(() => { A.abort = new AbortController(); A.flow = A.bar.visitAxeBar({ signal: A.abort.signal }); });
    await page.locator(t("axe-bar-back")).waitFor();
    assert.equal(await bgm(page), "bgm_axe");
    assert.equal(await page.evaluate(async () => { A.abort.abort(); return A.flow; }), false);
    assert.equal(await bgm(page), "kansetsu_shomei_to_black_coffee");
  });

  const hiyoriState = () => page => page.evaluate(async () => {
    (await import("./js/chapters/ch1.js")).setupHooks();
    const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true;
    const s = A.core.newGame(); Object.assign(s, { phase: "daily", day: 10, slot: 1, money: 90000, stamina: 80 });
    s.met.hiyori = true; s.contacts.push("hiyori"); s.affinity.hiyori = 51; s.flags._intro_hiyori = true;
    for (const f of ["_hiyori_cracks_done", "_hiyori_tonari_return_done", "_hiyori_tonari_followup_done", "_hiyori_tonari_afterwork_done",
      "_errand_scout_done", "_delivery_adam_done", "_delivery_minto_done", "_lime_tut", "_morning_10"]) s.flags[f] = true;
    A.core.config.textSpeed = 4;
    A.audio.playBgm("tonari");
  });
  const phase = (page, value) => page.waitForFunction(v => document.querySelector('[data-test="axe-game"]')?.dataset.phase === v, value);

  await check("hiyori-axe-play-reentry-and-finish", async page => {
    await setup(page); await hiyoriState()(page);
    await waitBgm(page, "tonari");
    await page.evaluate(() => { A.run = A.daily.playHiyoriEvent("axe_reveal"); });
    await phase(page, "choice");
    assert.equal(await bgm(page), "bgm_axe");
    assert.equal(await page.evaluate(() => A.daily.playHiyoriEvent("axe_reveal")), false, "second start must not overlap");
    assert.equal(await bgm(page), "bgm_axe");
    for (let n = 0; n < 3; n++) for (const p of ["choice", "horizontal", "vertical", "power", "result"]) {
      await phase(page, p); await page.locator('[data-test="axe-action"]:not([disabled])').click();
    }
    await phase(page, "summary"); await page.locator('[data-test="axe-action"]:not([disabled])').click();
    assert.equal(await page.evaluate(() => A.run), true);
    assert.equal(await bgm(page), "tonari");
  });

  await check("hiyori-axe-abort-restores", async page => {
    await setup(page); await hiyoriState()(page);
    await waitBgm(page, "tonari");
    await page.evaluate(() => { A.abort = new AbortController(); A.run = A.daily.playHiyoriEvent("axe_reveal", { signal: A.abort.signal }); });
    await phase(page, "choice");
    assert.equal(await bgm(page), "bgm_axe");
    assert.equal(await page.evaluate(async () => { A.abort.abort(); return A.run; }), false);
    assert.equal(await bgm(page), "tonari");
  });
});
