// 第2〜4章の山場の演出（#3965・motions/moments.js の tasteFade／stageHush／shadowUnveil）を、通常速度の本番UIで確かめる。
// 出る位置・後片付け・進行と保存を変えないこと・再開では出ないこと・動きを減らす設定では出ないことを見る。
// SHOTS=/tmp/moments node remake/test/browser/chapter_moments.mjs で途中の画面を残せる。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite } from "./support.mjs";

const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const moment = name => `.mo-moment[data-moment="${name}"]`;
const text = page => page.evaluate(() => document.querySelector("#vn .vn-text")?.textContent || "");
const snap = (page, name) => shots ? page.screenshot({ path: `${shots}/${name}-${page.viewportSize().width}.png` }) : null;
const quiet = page => page.evaluate(async () => {
  const core = await import("./js/core/state.js");
  Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
});

/** 会話を通常速度で送り、演出が始まるか stop の文が出るまで進める */
async function advanceTo(page, name, stop = null) {
  // 第4章の大会当日は、名乗りの前に控室と抽選の客の場面がある（VOL21 第2弾。演出の前に台詞が25行）。送りの上限はその分を見込む
  for (let n = 0; n < 160; n++) {
    if (await page.locator(moment(name)).count()) return true;
    if (stop && (await text(page)).includes(stop)) return false;
    await page.keyboard.press("Enter");
    await page.waitForTimeout(110);
  }
  throw new Error(`${name}: the scene never reached the moment`);
}

async function playDialogueMoment(page, name) {
  await quiet(page);
  void page.evaluate(n => { void window.__remake.dev.motion(n); }, name);
  await page.locator("#vn.active .vn-text").waitFor();
}

async function seedNationalResult(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    const { CH3_INTRO_SCENES } = await import("./js/chapters/ch3-progress.js");
    Object.assign(value, { chapter: 3, day: 42, slot: 0, phase: "tournament", stamina: 100,
      money: 35000, flavorStock: { double_apple: 100, mint: 100, chocolate: 100 }, weatherSeed: 5 });
    value.flags = { _elapsed_calendar: true, _ch2_cleared: true,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] },
      _ch3_intro: { startDay: 29, stage: CH3_INTRO_SCENES.length, titleSeen: true, routeVersion: 2 } };
    value.tournament.lastRank = 1; value.tournament.lastTotal = 88;
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["hajime", "pakki", "ayatori", "steve", "volk", "dr_charcoal", "sensu"]) value.met[who] = true;
    for (const who of Object.keys(value.met)) value.flags[`_intro_${who}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig(); core.save();
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    (await import("./js/craft/session.js")).craftTest.auto = "good";
    void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
  });
  const t = name => `[data-test="ch3-tournament-${name}"]`;
  await page.locator(t("entry")).waitFor();
  await page.locator(t("start")).click();
  await page.locator(t("ready")).waitFor();
  await page.locator(t("craft-start")).click();
  for (let round = 0; round < 3; round++) {
    await page.locator(t("votes")).waitFor();
    await page.locator(t("continue")).click();
  }
  await page.locator(t("result")).waitFor();
  return t;
}

/** 結果が確定した保存を、発表前の掛け合いの手前（試喫を終えた所）へ戻し、通常速度で入り直す */
async function reenterBeforeResult(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = core.state.flags._ch3_tournament;
    progress.stage = "tasting";
    progress.craft.tournamentStory.seen = progress.craft.tournamentStory.seen.filter(event => event !== "preresult");
    core.save();
    (await import("./js/vn/engine.js")).vnTest.turbo = false;
    (await import("./js/craft/session.js")).craftTest.auto = null;
    void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament();
  });
}

await suite("chapter-moments", async check => {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 844, height: 390 }]) {
    const size = `${viewport.width}x${viewport.height}`;

    await check(`ch2-taste-fades-before-the-line-that-notices-${size}`, async page => {
      await playDialogueMoment(page, "taste");
      assert.equal(await advanceTo(page, "taste", "一口吸う"), true, "The moment plays before the noticing line");
      assert((await text(page)).includes("いつもどおりのはずだった"), "The previous line stays while the smoke rises");
      await page.waitForTimeout(1500);
      await snap(page, "taste-sweet");
      await page.keyboard.press("Enter");
      assert.equal(await page.locator(moment("taste")).count(), 1, "Input is held during the moment");
      assert((await text(page)).includes("いつもどおりのはずだった"), "Enter does not advance under the moment");
      await page.waitForTimeout(900);
      await snap(page, "taste-drained");
      await page.locator(moment("taste")).waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelector("#vn .vn-text")?.textContent.includes("一口吸う"));
      assert.equal(await page.locator("#fx .mo-moment").count(), 0, "No layer is left behind");
      // 演出のあとも会話がふつうに送れる。1回ずつ送り、次の行（洗ったホース）に着くこと。
      // 1回目の Enter は文字送りの完了になることがあり、遅い環境では行の準備中（ready 前）の Enter は受け付けない。
      // 1回の Enter で2行は進まないので、着いた所で止めれば行を飛ばしていないことも確かめられる。
      let reached = false;
      for (let n = 0; n < 4 && !reached; n++) {
        await page.keyboard.press("Enter");
        reached = await page.waitForFunction(() => document.querySelector("#vn .vn-text")?.textContent.includes("洗ったホース"),
          null, { timeout: 1500 }).then(() => true, () => false);
      }
      assert(reached, "The conversation continues to the next line after the moment");
    }, { viewport });

    await check(`ch4-shadow-unveils-before-the-name-${size}`, async page => {
      await playDialogueMoment(page, "unveil");
      assert.equal(await advanceTo(page, "unveil", "そして現王者"), true, "The moment plays before the host names him");
      const before = await page.evaluate(() => ({ ...window.__remake.state.flags }));
      assert.equal(before._met_sheikh, undefined, "He is not named or met before the moment ends");
      await page.waitForTimeout(1400);
      await snap(page, "unveil-shadow");
      const during = await page.evaluate(() => ({
        figure: document.querySelector(".mo-unveil-figure")?.getAttribute("src") || "",
        box: Number(getComputedStyle(document.querySelector("#vn .vn-box")).opacity),
        portraits: Number(getComputedStyle(document.querySelector("#vn .vn-portraits")).opacity),
      }));
      assert.match(during.figure, /sheikh/, "The figure is his existing portrait, not a new picture");
      assert.equal(during.box, 0, "The dialogue window steps back during the moment");
      assert.equal(during.portraits, 0, "The host's portrait steps back during the moment");
      await page.waitForTimeout(1500);
      await snap(page, "unveil-revealed");
      await page.locator(moment("unveil")).waitFor({ state: "detached" });
      await page.waitForFunction(() => document.querySelector("#vn .vn-text")?.textContent.includes("そして現王者"));
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({
        box: Number(getComputedStyle(document.querySelector("#vn .vn-box")).opacity),
        portraits: Number(getComputedStyle(document.querySelector("#vn .vn-portraits")).opacity),
        layers: document.querySelectorAll("#fx .mo-moment").length,
      }));
      assert.deepEqual(after, { box: 1, portraits: 1, layers: 0 }, "The dialogue comes back with the next line");
      await snap(page, "unveil-after");
    }, { viewport });

    await check(`ch3-light-narrows-once-before-the-result-${size}`, async page => {
      const t = await seedNationalResult(page);
      const settled = await page.evaluate(() => structuredClone(window.__remake.state.flags._ch3_tournament.result));
      await reenterBeforeResult(page);
      assert.equal(await advanceTo(page, "hush"), true, "The light narrows after the pre-result talk");
      assert.equal(await page.evaluate(() => window.__remake.state.flags._ch3_tournament.stage), "result",
        "The result checkpoint is saved before the moment");
      assert.equal(await page.locator(t("result")).count(), 0, "The result waits for the dark");
      await page.waitForTimeout(700);
      await snap(page, "hush-narrowed");
      await page.locator(t("result")).waitFor({ state: "attached" });
      await page.locator(moment("hush")).waitFor({ state: "detached" });
      await page.locator(t("result")).waitFor();
      await snap(page, "hush-result");
      assert.deepEqual(await page.evaluate(() => window.__remake.state.flags._ch3_tournament.result), settled,
        "The moment does not change the ranking or the points");
      // 結果の保存地点から入り直した時は、光を絞らずに結果を出す
      await page.evaluate(async () => { void (await import("./js/chapters/ch3-tournament.js")).runChapterThreeTournament(); });
      let seen = 0;
      for (let n = 0; n < 12; n++) { seen += await page.locator(moment("hush")).count(); await page.waitForTimeout(80); }
      await page.locator(t("result")).waitFor();
      assert.equal(seen, 0, "Resuming at the result does not replay the moment");
    }, { viewport });
  }

  await check("reduced-motion-reads-straight-through", async page => {
    await playDialogueMoment(page, "taste");
    assert.equal(await advanceTo(page, "taste", "一口吸う"), false, "Reduced motion goes straight to the next line");
    assert.equal(await page.locator("#fx .mo-moment").count(), 0);
  }, { reducedMotion: "reduce" });
});
