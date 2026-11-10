// #2717 てつこといっしょの専用テーマ「茶トラと段ボール」。実UIで次を確かめる:
// - 入った瞬間に箱が開く演出が出て、その間も手元の道具・帰るを押せる（演出・外枠・題の札が触れたタップを奪わない）
// - 演出は終わると外れる。日常の HUD（紙×ラベンダー）は画面の間だけ隠れ、帰ると戻る
// - 部品にラベンダー・旧い紙の色が残っていない
// - 動きを減らす設定では演出を出さず、題の札はすぐ見える
// - ミニゲーム共通の方針（オーナー・2026-11-06）: 基本画面に常に見える文字は題・反応の帯・道具の名前だけ。
//   今日の様子は入った時だけ。操作と遊び方は「？」を開いた時だけ見え、画面の道具がすべて載っている
// - スマホ横持ち（#2842）: 844×340 で、基本画面・「？」・手帳・もようがえの文字が実寸 11px 以上、押せる所が実寸 38px 以上、
//   隣り合う道具の間が 12px（ステージ上）以上
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

// 画面（と開いているパネル）の見えている文字の実寸と、押せる部品の実寸。読み上げ専用（1px に切り抜いた物）と演出・題の札は数えない。
function phoneSizes() {
  const host = document.querySelector('[data-test="tetsuko-time-screen"]');
  const k = Number(getComputedStyle(document.getElementById("stage")).getPropertyValue("--k")) || 1;
  const seen = node => {
    for (let at = node; at && at !== host.parentElement; at = at.parentElement) {
      const css = getComputedStyle(at);
      if (css.display === "none" || css.visibility === "hidden" || Number(css.opacity) === 0) return false;
    }
    const r = node.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  };
  const texts = [];
  const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const node = text.parentElement;
    if (!text.textContent.trim() || node.closest(".tt-logo, .tt-intro, [aria-hidden='true']") || !seen(node)) continue;
    texts.push({ text: text.textContent.trim().slice(0, 12), px: parseFloat(getComputedStyle(node).fontSize) * k });
  }
  const taps = [...host.querySelectorAll("button")].filter(node => seen(node) && !node.matches(".tt-cat, .tt-slot-hit"))
    .map(node => { const r = node.getBoundingClientRect(); return { name: node.dataset.test || node.textContent.trim(), w: r.width, h: r.height }; });
  const gapOf = selector => { const css = getComputedStyle(host.querySelector(selector)); return parseFloat(css.columnGap || css.gap); };
  return { k, texts, taps, gaps: { tools: gapOf(".tt-tools"), dock: gapOf(".tt-dock") } };
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

  await check("tetsuko-theme-phone-landscape-keeps-readable-text-and-tappable-parts", async page => {
    await seed(page);
    await openTetsuko(page);
    const expectSizes = async where => {
      const got = await page.evaluate(phoneSizes);
      assert(got.k < .5, `The stage is shrunk like a phone held sideways (${got.k})`);
      assert(got.texts.length > 0, `${where}: some text is visible`);
      for (const text of got.texts) assert(text.px >= 11, `${where}: "${text.text}" is at least 11px on the phone (${text.px.toFixed(1)})`);
      assert(got.taps.length > 0, `${where}: some buttons are visible`);
      for (const tap of got.taps) assert(tap.w >= 38 && tap.h >= 38, `${where}: ${tap.name} is at least 38px on the phone (${tap.w.toFixed(1)}×${tap.h.toFixed(1)})`);
      assert(got.gaps.tools >= 12 && got.gaps.dock >= 12, `${where}: neighbouring tools keep 12px apart`);
    };
    await expectSizes("base");
    for (const [button, panel] of [["tetsuko-help", "tetsuko-help-panel"], ["tetsuko-book", "tetsuko-book-panel"], ["tetsuko-decor", "tetsuko-decor-panel"]]) {
      await page.locator(dt(button)).click();
      await page.locator(dt(panel)).waitFor();
      await expectSizes(panel);
      await page.locator(`${dt(panel)} ${dt("tetsuko-panel-close")}`).click();
      await page.locator(dt(panel)).waitFor({ state: "hidden" });
    }
    await page.locator(dt("tetsuko-time-back")).click();
    await page.waitForFunction(() => !document.querySelector('[data-test="tetsuko-time-screen"]'), null, { timeout: 30000 });
  }, { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" });

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
  for (const phone of [false, true]) await check(`tetsuko-discover-choose-place-photograph-${phone ? "phone" : "desktop"}`, async page => {
    await seed(page);
    await openTetsuko(page);
    const get = id => page.locator(dt(`tetsuko-${id}`));
    // 一つの短い遊び: 振る→狙う→前足→写真。連打の点数にはしない。
    await get("play").click();
    await get("play").click();
    await get("play").click();
    assert.match(await get("trail").textContent(), /写真/);
    assert(await get("photo").evaluate(node => node.classList.contains("ready")));
    await get("photo").click();
    assert(!await get("photo").evaluate(node => node.classList.contains("ready")));
    // 手帳から次の遊びを選び、小物を置いた結果を見届ける。
    await get("book").click();
    await get("book-box_peek").click();
    await get("seek").click();
    assert.match(await get("trail").textContent(), /箱/);
    await get("decor").click();
    await get("item-box").click();
    await get("slot-floor").click();
    const before = await get("cat").getAttribute("data-inside");
    await page.waitForTimeout(4500);
    assert.equal(await get("cat").getAttribute("data-inside"), before, "猫は配置中に勝手に箱へ入らない");
    await get("panel-close").click();
    await page.waitForFunction(() => document.querySelector('[data-test="tetsuko-cat"]')?.dataset.inside === "box", null, { timeout: 14000 });
    assert.match(await get("caption").textContent(), /顔だけ/);
    await get("photo").click();
    // 説明中・手帳中の遅延した捕獲や自律行動が、写真や状態をすり替えない。
    await get("help").click();
    const caption = await get("caption").textContent();
    await page.waitForTimeout(4200);
    assert.equal(await get("caption").textContent(), caption);
    await page.keyboard.press("Escape");
    // 反応の帯と猫が画面内。横持ちの表示下限は既存の phoneSizes でも確認する。
    const bounds = await get("trail").boundingBox();
    const viewport = page.viewportSize();
    assert(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width + 1 && bounds.y + bounds.height <= viewport.height + 1);
    if (phone) {
      const sizes = await page.evaluate(phoneSizes);
      for (const text of sizes.texts) assert(text.px >= 11, `${text.text}: ${text.px}px`);
    }
    await get("time-back").click();
    await page.waitForFunction(() => !document.querySelector('[data-test="tetsuko-time-screen"]'), null, { timeout: 30000 });
    const record = await page.evaluate(() => window.__remake.state.flags._tetsuko_time);
    assert(record.found.includes("first_paw") && record.found.includes("box_peek"));
    assert(record.album.some(entry => entry.moment === "first_paw"));
    assert(record.album.some(entry => entry.moment === "box_peek"));
    assert.equal(record.props.floor, "box");
  }, phone ? { viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true, reducedMotion: "reduce" } : {});

});

