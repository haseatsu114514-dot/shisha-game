// #2717 てつこといっしょの専用テーマ「茶トラと段ボール」。実UIで次を確かめる:
// - 入った瞬間に箱が開く演出が出て、その間も手元の道具・帰るを押せる（演出・外枠・題の札が触れたタップを奪わない）
// - 演出は終わると外れる。日常の HUD（紙×ラベンダー）は画面の間だけ隠れ、帰ると戻る
// - 部品にラベンダー・旧い紙の色が残っていない
// - 動きを減らす設定では演出を出さず、題の札はすぐ見える
// - ミニゲーム共通の方針（オーナー・2026-11-06）: 基本画面に常に見える文字は題・反応の帯・道具の名前だけ。
//   今日の様子は入った時だけ。操作と遊び方は「？」を開いた時だけ見え、画面の道具がすべて載っている
// 遊び・確定（回復12・来訪1回）は ch3_tokyo_daily.mjs と tetsuko_time.mjs が見る。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const dt = name => `[data-test="${name}"]`;
const LAVENDER = ["rgb(105, 73, 126)", "rgb(247, 243, 237)", "rgb(185, 163, 201)"];

async function seed(page) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch3-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, day: 28, slot: 0, phase: "cleared", money: 30000, stamina: 100, weatherSeed: 5, contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch2_read_ch2_tournament_ageha_heart: true,
      _ch2_preparation_started: true, _lime_opened: true, _lime_tut: 1,
      _ch2_tournament: { stage: "complete", attempts: 1, history: [{ rank: 1, total: 88 }] } };
    for (const who of ["hajime", "sumi", "pakki", "maezono", "dr_kemuri", "sui"]) value.flags[`_intro_${who}`] = true;
    if (!progress.advanceToChapterThree(value)) throw new Error("Chapter boundary failed");
    value.day += 3;
    if (!progress.departChapterThree(value)) throw new Error("Departure failed");
    value.flags._ch3_intro.titleSeen = true;
    // 懐いた後（段階会話を挟まずに画面へ）。
    value.flags._ch3_outings = { tetsuko: 5 };
    const fortune = await import("./js/daily/fortune-schedule.js");
    const plan = fortune.fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: plan.map(() => null), used: plan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
    core.saveConfig();
    Object.assign(core.state, value);
    core.save();
  });
  await page.reload();
  await page.locator(dt("title-load")).click();
  await page.evaluate(async () => {
    const vn = await import("./js/vn/engine.js");
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
  });
  await page.locator(dt("slot-0")).click();
  await page.locator(dt("rule-sheet")).waitFor({ timeout: 60000 });
  await page.locator(dt("rule-sheet-close")).click();
  await page.waitForFunction(() => document.querySelector('.map:not(.done) [data-test="pin-ch3_tokyo_mukai"]') && !document.querySelector("#modal.show"),
    null, { timeout: 60000 });
}

// mukai の手伝いの帰りに裏口へ。画面が付いたら、演出の間に道具の真ん中を押すと何に当たるかを記録しておく。
// 画面の外の物（閉じかけの選択肢・日当の札など）は数えない。画面がまだ見えない間は次のコマで測り直す。
async function openTetsuko(page) {
  await page.evaluate(() => {
    window.__tetsukoTheme = null;
    const names = ["tetsuko-pet", "tetsuko-time-back", "tetsuko-book", "tetsuko-help"];
    const measure = (host, first, frames = 0) => {
      const top = names.map(name => {
        const node = host.querySelector(`[data-test="${name}"]`);
        const r = node.getBoundingClientRect();
        const inScreen = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2).filter(hit => host.contains(hit));
        return [name, inScreen.length ? node.contains(inScreen[0]) : null];
      });
      const ready = top.every(([, hit]) => hit !== null);
      if (!ready && host.dataset.intro === "1" && frames < 60) { requestAnimationFrame(() => measure(host, first, frames + 1)); return; }
      window.__tetsukoTheme = { ...first, introWhileMeasured: host.dataset.intro || "", hits: Object.fromEntries(top) };
    };
    const probe = new MutationObserver(() => {
      const host = document.querySelector('[data-test="tetsuko-time-screen"]');
      if (!host) return;
      probe.disconnect();
      measure(host, { intro: host.dataset.intro || "", hasIntro: !!host.querySelector('[data-test="tetsuko-intro"]') });
    });
    probe.observe(document.body, { childList: true, subtree: true });
  });
  await page.locator(dt("pin-ch3_tokyo_mukai")).click();
  await page.locator(dt("map-go")).click();
  const help = page.locator("#modal.show button", { hasText: "シフトに入る" });
  await help.waitFor();
  await help.click();
  await page.locator(dt("mukai-order-0")).waitFor({ timeout: 60000 });
  await page.locator(dt("mukai-order-0")).click();
  await page.locator(dt("tokyo-tetsuko-game")).click({ timeout: 60000 });
  const screen = page.locator(dt("tetsuko-time-screen"));
  await screen.waitFor({ timeout: 60000 });
  await page.waitForFunction(() => window.__tetsukoTheme);
  return screen;
}

const hudVisibility = page => page.evaluate(() => getComputedStyle(document.querySelector(".hud")).visibility);
// 基本画面で手元の道具が出ている時の道具の名前（「？」は記号だけ）。止めるは振っている間だけ出る。
const CONTROLS = ["？", "もようがえ", "てつこ手帳", "写真", "帰る", "なでる", "あそぶ", "ブラシ", "おやつ", "そっと見守る"];
// 画面の中で見えている文字（題の札・反応の帯・演出は除く）。読み上げ専用の文字・透明の文字は数えない。
function visibleTexts() {
  const host = document.querySelector('[data-test="tetsuko-time-screen"]');
  const skip = node => node.closest(".tt-logo, .tt-caption, .tt-intro, .tt-memo-title");
  const seen = node => {
    for (let at = node; at && at !== host.parentElement; at = at.parentElement) {
      const css = getComputedStyle(at);
      if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0) return false;
    }
    const r = node.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  const out = [];
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const value = text.textContent.trim();
    if (value && !skip(text.parentElement) && seen(text.parentElement)) out.push(value);
  }
  return out;
}

await suite("tetsuko-theme", async check => {
  await check("tetsuko-theme-opens-like-a-new-game-and-never-blocks-taps", async page => {
    await seed(page);
    assert.equal(await hudVisibility(page), "visible", "The daily HUD is on the map");
    const screen = await openTetsuko(page);
    const probe = await page.evaluate(() => window.__tetsukoTheme);
    assert.equal(probe.hasIntro, true, "The box-opening intro starts with the screen");
    assert.equal(probe.intro, "1");
    assert.equal(probe.introWhileMeasured, "1", "The taps were measured while the intro was still on screen");
    assert.deepEqual(probe.hits, { "tetsuko-pet": true, "tetsuko-time-back": true, "tetsuko-book": true, "tetsuko-help": true },
      "The intro, the frame and the title plate never take a tap");
    assert.equal(await hudVisibility(page), "hidden", "The daily HUD is hidden while playing with her");
    // 演出は終わると外れる。
    await page.locator(dt("tetsuko-intro")).waitFor({ state: "detached", timeout: 5000 });
    assert.equal(await screen.getAttribute("data-intro"), "");
    const look = await page.evaluate(() => {
      const css = selector => getComputedStyle(document.querySelector(selector));
      const parts = [".tt-logo", ".tt-tool", ".tt-act-token", ".tt-caption", ".tt-memo", ".tt-act-label"];
      return {
        logo: document.querySelector(".tetsuko-time > .tt-logo")?.textContent || "",
        logoOpacity: css(".tetsuko-time > .tt-logo").opacity,
        frame: !!document.querySelector(".tetsuko-time .tt-frame svg"),
        colors: parts.flatMap(part => [css(part).backgroundColor, css(part).borderTopColor, css(part).color]),
      };
    });
    assert.match(look.logo, /てつこといっしょ/);
    assert.match(look.logo, /TETSUKO TIME/);
    assert.equal(look.logoOpacity, "1");
    assert.equal(look.frame, true, "The cardboard frame surrounds the screen");
    for (const color of LAVENDER) assert(!look.colors.includes(color), `No daily lavender paper left (${color})`);
    // 基本画面: 今日の様子は少しで消え、常に見える文字は道具の名前だけ（題の札・反応の帯は別に数える）。
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-time-screen"]')?.dataset.memo === "off", null, { timeout: 15000 });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".tt-memo")).opacity === "0", null, { timeout: 5000 });
    const shown = await page.evaluate(visibleTexts);
    assert.deepEqual(shown.sort(), [...CONTROLS].sort(), "Only the names of the controls stay on the base screen");
    // 「？」: 開くと遊び方が出て、画面の道具がすべて載っている。開いている間は下の帯と道具が隠れる。Esc で閉じる。
    await page.locator(dt("tetsuko-help")).click();
    const panel = page.locator(dt("tetsuko-help-panel"));
    await panel.waitFor();
    const help = await page.evaluate(() => ({
      names: [...document.querySelectorAll(".tt-help-name")].map(node => node.textContent),
      texts: [...document.querySelectorAll(".tt-help-text")].map(node => node.textContent),
      mood: document.querySelector('[data-test="tetsuko-help-mood"]')?.textContent || "",
      dock: getComputedStyle(document.querySelector(".tt-dock")).visibility,
    }));
    for (const name of CONTROLS.filter(name => name !== "？")) assert(help.names.includes(name), `The help explains ${name}`);
    for (const text of help.texts) {
      assert.match(text, /。$/, `Help lines end with 。 (${text})`);
      assert(!text.includes("\n") && text.length <= 30, `Help lines stay short (${text})`);
    }
    assert.match(help.mood, /今日は/, "Today's mood can be read again in the help");
    assert.equal(help.dock, "hidden", "The tools step aside while reading");
    await page.keyboard.press("Escape");
    await panel.waitFor({ state: "hidden" });
    // 遊べることは変わらない。帰ると HUD が戻る。
    await page.locator(dt("tetsuko-pet")).click();
    await page.locator(dt("tetsuko-time-back")).click();
    await page.waitForFunction(() => window.__remake.state.flags._ch3_outings?.tetsuko === 6, null, { timeout: 30000 });
    await page.waitForFunction(() => document.querySelector('.map:not(.done) [data-test="pin-ch3_tokyo_mukai"]'), null, { timeout: 60000 });
    assert.equal(await page.locator(dt("tetsuko-time-screen")).count(), 0);
    assert.equal(await hudVisibility(page), "visible", "The daily HUD comes back after returning");
  });

  await check("tetsuko-theme-reduced-motion-skips-the-intro", async page => {
    await seed(page);
    const screen = await openTetsuko(page);
    const probe = await page.evaluate(() => window.__tetsukoTheme);
    assert.equal(probe.hasIntro, false, "No box-opening motion when motion is reduced");
    assert.equal(await screen.getAttribute("data-intro"), "");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".tetsuko-time > .tt-logo")).opacity), "1", "The title plate is there at once");
    assert.equal(await hudVisibility(page), "hidden");
    await page.locator(dt("tetsuko-time-back")).click();
    await page.waitForFunction(() => !document.querySelector('[data-test="tetsuko-time-screen"]'), null, { timeout: 30000 });
  }, { reducedMotion: "reduce" });
});
