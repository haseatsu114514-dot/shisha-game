// 様式「縦画面」（煙の舞台・C案。js/looks/vertical.js・要望台帳 VPN）: 縦持ちで、本編の第1章を縦の外枠に写して遊ぶ。
// 確かめること: タイトル→会話（本編の会話の箱が縦のテロップと同じ比の幅になり、2行ずつ送れる）、返事の中継、
// 地図（左右で隣の店・一覧・決定で店に入る）、tonari の行動選び、LIME・MENU のシート、心得の盤（縦の外枠へ移して十字キーと丸ボタンで灯す・決定）、
// 登場カットインの縦のポスター、まだ縦にしていない場面（シーシャ作り）は回転案内、横持ちと第2章は旧版、様式を替えると何も残らない。
// 自動操作のブラウザの既定は旧版なので ?look=vertical を付けて選ぶ。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { arm } from "./look_chapter_seeds.mjs";

const t = (id) => `[data-test="${id}"]`;
const entry = `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=vertical`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const SHORT = { viewport: { width: 390, height: 664 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const WIDE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const scene = (page) => page.evaluate(() => window.__verticalLook?.scene?.() || "");
const waitScene = (page, name, timeout = 20000) => page.waitForFunction((name) => window.__verticalLook?.scene?.() === name, name, { timeout });

/** 十字キーは扇の形のボタン。押す向きの扇の中を押す。 */
async function pad(page, dir) {
  const box = await page.locator(t("vt-dpad")).boundingBox();
  const at = { up: [0.5, 0.14], down: [0.5, 0.86], left: [0.14, 0.5], right: [0.86, 0.5] }[dir];
  await page.touchscreen.tap(box.x + box.width * at[0], box.y + box.height * at[1]);
}
const pressA = (page) => page.locator(t("vt-a")).tap();

/** 外枠が画面に収まり、横に送れないこと。 */
async function assertFits(page, label) {
  const view = await page.evaluate(() => {
    const boxes = [".vt-shell", ".vt-dpad", ".vt-a", ".vt-chips"].map((selector) => {
      const node = document.querySelector(selector);
      if (!node || node.hidden) return null;
      const r = node.getBoundingClientRect();
      return { selector, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    }).filter(Boolean);
    return { boxes, w: innerWidth, h: innerHeight, scroll: document.documentElement.scrollWidth };
  });
  for (const box of view.boxes) {
    assert(box.left >= -0.5 && box.top >= -0.5 && box.right <= view.w + 0.5 && box.bottom <= view.h + 0.5, `${label}: ${box.selector} leaves the screen ${JSON.stringify(box)}`);
  }
  assert(view.scroll <= view.w + 1, `${label}: the page scrolls sideways`);
}

/** 第1章 DAY5 の昼の地図を、本物の日常ループ（runDaily）で出す。 */
async function setupDaily(page, { slot = 0 } = {}) {
  await arm(page);
  await page.evaluate(async (slot) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    Object.assign(s.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.dailyRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.dailyError = String(error.stack || error); });
  }, slot);
  await page.locator("#screen .map:not(.done)").waitFor({ state: "attached", timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
  await waitScene(page, "map");
}

/** 会話の速送りを切って、1行ずつ自分で送る（本文の写しを確かめるため）。 */
const manual = (page) => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = false; vn.vnTest.choose = null;
  const core = await import("./js/core/state.js");
  Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
});
const typed = (page) => page.waitForFunction(() => document.querySelector("#vn .vn-next")?.classList.contains("show") || document.querySelector("#vn .vn-choices.show"));

await suite("look_vertical", async (check) => {
  await check("title-and-conversation-in-two-line-pages", async (page) => {
    await waitScene(page, "title");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "vertical");
    await assertFits(page, "title");
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("viewport")).opacity), "0", "the landscape stage is hidden behind the shell");
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById("rotate-hint")).display), "none", "no rotate hint over the title");
    await manual(page);
    // 本編の会話を縦の外枠で読む（本筋の冒頭の地の文）
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 3, slot: 0 });
      (await import("./js/chapters/ch1.js")).setupHooks();
      (await import("./js/core/ui.js")).clearScreen();
      const { play } = await import("./js/vn/engine.js");
      window.sceneRun = play("ch1_naru_first", { bg: "res://assets/backgrounds/kemurikusa.png" });
    });
    await waitScene(page, "vn");
    await typed(page);
    // 本編の会話の箱は、縦のテロップと同じ比の幅（字 32px・幅 548px）になり、1ページは2行まで
    const box = await page.evaluate(() => {
      const text = document.querySelector("#vn .vn-text");
      return { width: text.clientWidth, size: getComputedStyle(text).fontSize, lines: text.innerHTML.split(/<br\s*\/?>/i).length };
    });
    assert.equal(box.width, 548);
    assert.equal(box.size, "32px");
    assert(box.lines <= 2, `the engine paginates for the telop: ${JSON.stringify(box)}`);
    await page.waitForFunction(() => document.querySelector('[data-test="vt-text"]').textContent === document.querySelector("#vn .vn-text").textContent
      && document.querySelector("#vn .vn-text").textContent.length > 0, null, { timeout: 5000 }).catch(() => assert.fail("the telop mirrors the engine's page"));
    const first = await page.locator(t("vt-text")).textContent();
    const telop = await page.evaluate(() => {
      const node = document.querySelector('[data-test="vt-text"]');
      const lineHeight = parseFloat(getComputedStyle(node).lineHeight);
      return { lines: Math.round(node.getBoundingClientRect().height / lineHeight), overflow: node.scrollWidth > node.clientWidth + 2 };
    });
    assert(telop.lines <= 2 && !telop.overflow, `the telop shows two lines at most ${JSON.stringify(telop)}`);
    assert.match(await page.locator(".vt-where b").textContent(), /KEMURIKUSA/, "the place name shows the shop");
    await pressA(page);
    await page.waitForFunction((first) => document.querySelector('[data-test="vt-text"]').textContent !== first, first);
    // 補助ボタンの LOG → シート、丸ボタンで閉じる
    await page.locator(t("vt-chip-vn-log")).tap();
    await waitScene(page, "sheet");
    assert.equal(await page.evaluate(() => document.querySelector(".vt-shell").dataset.sheet), "log");
    await pressA(page);
    await waitScene(page, "vn");
    await assertFits(page, "conversation");
  }, { ...TALL, pageEntry: entry });

  await check("map-shop-and-choice", async (page) => {
    await setupDaily(page);
    await assertFits(page, "map");
    const pins = await page.evaluate(() => ({
      live: [...document.querySelectorAll("#screen > .map:not(.done) .map-pins > .spot-pin")].filter((pin) => pin.style.visibility !== "hidden").map((pin) => pin.dataset.spot).sort(),
      mine: [...document.querySelectorAll(".vt-pin")].map((pin) => pin.dataset.spot).sort(),
    }));
    assert.deepEqual(pins.mine, pins.live, "one pin per destination");
    // 上の表示: 章・日付・お金
    const hud = await page.locator(t("vt-hud")).textContent();
    assert(hud.includes("第1章") && hud.includes("DAY 5") && hud.includes("42,000"), `the header shows the chapter, day and money: ${hud}`);
    // 左右キーで、地図の左から右の順に隣の店へ（本編のピンも同じ店を選ぶ）
    const order = await page.evaluate(() => [...document.querySelectorAll(".vt-pin")].map((pin) => [pin.dataset.spot, parseFloat(pin.style.left)]).sort((a, b) => a[1] - b[1]).map(([id]) => id));
    const selected = () => page.evaluate(() => ({ mine: document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot, live: document.querySelector("#screen > .map:not(.done) .spot-pin.sel")?.dataset.spot }));
    const before = await selected();
    await pad(page, "right");
    await page.waitForFunction((was) => document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot !== was, before.mine);
    const after = await selected();
    assert.equal(after.mine, order[(order.indexOf(before.mine) + 1) % order.length]);
    assert.equal(after.live, after.mine, "the landscape map selects the same pin");
    // 下＝一覧 → PEPPERMINT を選んで決定
    await pad(page, "down");
    await page.locator(t("vt-row-minto")).tap();
    await page.waitForFunction(() => document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot === "minto");
    assert.match(await page.locator(t("vt-dest")).textContent(), /みんと/);
    await manual(page);
    await pressA(page);
    await waitScene(page, "vn", 30000);
    await page.locator(".vt-actor").first().waitFor({ state: "attached", timeout: 20000 });
    assert.match(await page.locator(".vt-where b").textContent(), /PEPPERMINT/);
    // 返事まで送る → 十字キーの下で次の札へ、決定で本編の選択肢を押す
    for (let i = 0; i < 30 && !(await page.locator(".vt-choice").count()); i++) {
      await typed(page);
      if (await page.locator(".vt-choice").count()) break;
      await pressA(page);
      await page.waitForTimeout(150);
    }
    const choices = await page.locator(".vt-choice").allTextContents();
    assert(choices.length >= 2, `the reply cards mirror the engine's choices ${JSON.stringify(choices)}`);
    await assertFits(page, "choice");
    await pad(page, "down");
    assert.equal(await page.locator('.vt-choice[aria-current="true"]').getAttribute("data-index"), "1");
    // 本編の2番目の選択肢が押されること（決定は本編のボタンへの click として中継する）
    await page.evaluate(() => {
      window.__picked = -1;
      document.querySelectorAll("#vn .vn-choices.show > .vn-choice").forEach((button, index) => button.addEventListener("click", () => { window.__picked = index; }, { once: true }));
    });
    await pressA(page);
    await page.waitForFunction(() => !document.querySelector("#vn .vn-choices.show"));
    assert.equal(await page.evaluate(() => window.__picked), 1, "the chosen reply is relayed to the engine");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("tonari-menu-lime-and-menu-sheets", async (page) => {
    await setupDaily(page);
    // 最初の行き先は tonari（「！」の店）。決定 → 行動選び
    await page.waitForFunction(() => document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot === "tonari");
    await pressA(page);
    await waitScene(page, "menu");
    const options = await page.locator(".vt-choice b").allTextContents();
    assert(options.some((text) => text.includes("一服")), `the tonari actions are listed ${JSON.stringify(options)}`);
    assert.match(await page.locator(".vt-where b").textContent(), /tonari/);
    await page.locator(t("vt-chip-back")).tap();
    await waitScene(page, "map");
    // LIME → シート、丸ボタン（閉じる）
    await page.locator(t("vt-chip-lime")).tap();
    await waitScene(page, "sheet");
    assert.equal(await page.evaluate(() => document.querySelector(".vt-shell").dataset.sheet), "lime");
    await pressA(page);
    await waitScene(page, "map");
    // MENU → タブが補助ボタンの段に並び、押すと本編のタブが切り替わる
    await page.locator(t("vt-chip-menu")).tap();
    await waitScene(page, "sheet");
    await page.locator(t("vt-chip-tab-people")).tap();
    await page.waitForFunction(() => document.querySelector('#modal .dm-tab[data-tab="people"]')?.getAttribute("aria-selected") === "true");
    assert.equal(await page.locator(t("vt-chip-tab-people")).getAttribute("aria-pressed"), "true");
    await assertFits(page, "menu");
    await pressA(page);
    await waitScene(page, "map");
  }, { ...TALL, pageEntry: entry });

  await check("growth-board-with-pad", async (page) => {
    await setupDaily(page);
    await page.evaluate(async () => {
      const growth = await import("./js/core/growth.js");
      const { state } = await import("./js/core/state.js");
      growth.ensureGrowth(state);
      state.growth.hidane.any = 3;
      state.flags._kannon_growth_intro_done = true;
      window.boardRun = growth.openGrowthBoard({ place: "kannon" });
    });
    await waitScene(page, "board");
    // 本編の盤の要素が、縦の外枠の中へ移っている（本編の盤の規則のまま）
    await page.locator(".vt-board-frame > .gboard").waitFor({ state: "attached" });
    assert.equal(await page.locator("#fx > .gboard").count(), 0);
    await assertFits(page, "board");
    const nodes = () => page.evaluate(() => (window.__remake?.state || null) && JSON.parse(JSON.stringify((window.__remake.state.growth?.nodes) || [])));
    const litBefore = (await nodes()) || [];
    // 丸ボタン: 今灯せるマスを選ぶ → もう一度で灯す（仮置き）
    await pressA(page);
    await page.locator(".gb-node.selected").waitFor({ state: "attached" });
    await page.waitForFunction(() => document.querySelector('[data-test="vt-a"]')?.textContent.includes("灯す") || document.querySelector('[data-test="vt-a"]')?.textContent.includes("はめる"));
    await pressA(page);
    await page.locator('.gb-node[data-status="pending"]').waitFor({ state: "attached" });
    // 十字キーで隣のマスへ（選んでいるマスが変わる）
    const from = await page.evaluate(() => document.querySelector(".gb-node.selected")?.dataset.test || "");
    for (const dir of ["up", "left", "right", "down"]) {
      await pad(page, dir);
      await page.waitForTimeout(250);
      if (await page.evaluate((from) => (document.querySelector(".gb-node.selected")?.dataset.test || "") !== from, from)) break;
    }
    assert.notEqual(await page.evaluate(() => document.querySelector(".gb-node.selected")?.dataset.test || ""), from, "the pad moves to a neighbouring square");
    // 決定 → 盤が閉じて地図へ。灯したマスが保存されている
    await page.locator(t("vt-chip-decide")).tap();
    await page.waitForFunction(() => !document.querySelector(".gboard"), null, { timeout: 15000 });
    await waitScene(page, "map");
    const litAfter = (await nodes()) || [];
    assert.equal(litAfter.length, litBefore.length + 1, `one square was lit ${JSON.stringify([litBefore, litAfter])}`);
  }, { ...TALL, pageEntry: entry });

  await check("intro-cutin-poster", async (page) => {
    await waitScene(page, "title");
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 1 });
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
      (await import("./js/chapters/ch1.js")).setupHooks();
      (await import("./js/core/ui.js")).clearScreen();
      const { play } = await import("./js/vn/engine.js");
      window.sceneRun = play("ch1_naru_first", { bg: "res://assets/backgrounds/kemurikusa.png" });
    });
    await waitScene(page, "vn");
    // なるの名乗りまで送ると、登場カットインが縦のポスター（案A）で出る
    for (let i = 0; i < 60 && !(await page.locator(".vt-cv:not([hidden])").count()); i++) {
      if (await scene(page) === "vn") await pressA(page).catch(() => {});
      await page.waitForTimeout(200);
    }
    await page.locator(".vt-cv:not([hidden]) .vt-cv-name").waitFor();
    const poster = await page.evaluate(() => ({
      name: document.querySelector(".vt-cv .vt-cv-name").textContent, tag: document.querySelector(".vt-cv .vt-cv-tag")?.textContent || "",
      quote: document.querySelector(".vt-cv .vt-cv-quote")?.textContent || "", live: document.querySelector("#fx .cutin .ci-line")?.textContent || "",
    }));
    assert.match(poster.name, /鳴切/);
    assert.equal(poster.quote, poster.live, "the line is read from the engine's cut-in");
    assert(poster.tag.length > 0);
    await waitScene(page, "vn", 15000);
  }, { ...TALL, pageEntry: entry });

  await check("unsupported-scenes-show-the-rotate-hint", async (page) => {
    await waitScene(page, "title");
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 2, slot: 0 });
      (await import("./js/core/ui.js")).clearScreen();
      const { newSession, openBench } = await import("./js/craft/session.js");
      const { stepMix } = await import("./js/craft/steps.js");
      const cs = newSession("tutorial"); openBench(cs, {}); window.mixRun = stepMix(cs);
    });
    await page.waitForFunction(() => getComputedStyle(document.getElementById("rotate-hint")).display !== "none", null, { timeout: 10000 });
    assert.equal(await scene(page), "");
    const hint = await page.evaluate(() => document.getElementById("rotate-hint").innerText.replace(/\s+/g, " "));
    assert(hint.includes("この場面は横向きで遊びます"), hint);
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
  }, { ...TALL, pageEntry: entry });

  await check("short-screen-fits", async (page) => {
    await setupDaily(page);
    await assertFits(page, "short map");
  }, { ...SHORT, pageEntry: entry });

  await check("landscape-and-chapter-two-use-the-current-screen", async (page) => {
    // 横持ち: 外枠を出さず、本編の画面のまま
    await page.locator(t("title-new")).waitFor();
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({ shell: !!document.querySelector(".vt-shell"), vt: document.documentElement.dataset.vt || "", opacity: getComputedStyle(document.getElementById("viewport")).opacity }));
    assert.deepEqual(state, { shell: false, vt: "", opacity: "1" });
  }, { ...WIDE, pageEntry: entry });

  await check("chapter-two-and-switching-looks-leave-no-trace", async (page) => {
    await waitScene(page, "title");
    // 第2章は旧版（縦画面は第1章から作っている）
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 2, day: 15, slot: 0 });
      document.body.dataset.screen = "none";
      (await import("./js/core/look.js")).refreshLook();
    });
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic");
    await page.waitForFunction(() => !document.querySelector(".vt-shell") && !document.documentElement.dataset.vt);
    const residue = await page.evaluate(() => ({
      shells: document.querySelectorAll(".vt-shell, .vt-sheet-host").length, hints: document.querySelectorAll(".vt-hint").length,
      attrs: ["vt", "vtShell", "vtHint"].filter((name) => name in document.documentElement.dataset),
      textWidth: document.querySelector("#vn .vn-text") ? document.querySelector("#vn .vn-text").style.width : "",
    }));
    assert.deepEqual(residue, { shells: 0, hints: 0, attrs: [], textWidth: "" });
    assert((await page.evaluate(() => document.getElementById("rotate-hint").innerText)).includes("横向きでお楽しみください"));
  }, { ...TALL, pageEntry: entry });
}, { acknowledgeGrowth: false }); // 盤を自分で操作する（成長のお知らせを自動で閉じる仕組みは、開いた盤をすぐ閉じてしまう）
