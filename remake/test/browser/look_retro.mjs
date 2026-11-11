// 見た目の様式「DS風」（LK03・js/looks/retro.js）: 現行の画面を動かしたまま、上下2画面（256×192）の外枠へ写す。
// 縦持ちのタッチ端末と PC で、タイトル・会話と選択肢・日常の地図に外枠が出ること、操作が現行へ中継されること、
// 未対応の場面（MENU）では外枠が引っ込むこと、現行へ戻す・横持ち・第2章では現行のままであることを確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const entry = `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=retro`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const WIDE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const shellFor = (scene) => `.retro-shell:not([hidden])[data-scene="${scene}"]`;

const rootState = (page) => page.evaluate(() => {
  const root = document.documentElement, shell = document.querySelector(".retro-shell"), note = document.querySelector(".retro-note");
  return {
    look: root.dataset.look, engaged: root.dataset.retro || "", shellOn: root.dataset.retroShell || "", guard: root.dataset.rotateGuard || "",
    shell: shell ? { hidden: shell.hidden, scene: shell.dataset.scene } : null,
    note: note && !note.hidden ? note.textContent : "",
    hint: getComputedStyle(document.getElementById("rotate-hint")).display,
    viewportOpacity: getComputedStyle(document.getElementById("viewport")).opacity,
  };
});

/** 上画面の canvas が 256×192 で、絵が写っている（真っ黒・単色でない）こと。 */
async function assertTopScreenPainted(page, label) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".retro-canvas");
    if (!canvas) return false;
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0;
    for (let i = 0; i < data.length; i += 4 * 97) if (data[i] + data[i + 1] + data[i + 2] > 120) bright++;
    return bright > 40;
  }, null, { timeout: 15000 });
  const result = await page.evaluate(() => {
    const canvas = document.querySelector(".retro-canvas");
    const ctx = canvas.getContext("2d");
    const points = [[40, 40], [128, 60], [216, 40], [64, 120], [128, 150], [200, 130], [128, 96]];
    const colors = points.map(([x, y]) => [...ctx.getImageData(x, y, 1, 1).data].join(","));
    const box = canvas.getBoundingClientRect();
    return { width: canvas.width, height: canvas.height, colors, ratio: box.width / box.height, rendering: getComputedStyle(canvas).imageRendering };
  });
  assert.deepEqual([result.width, result.height], [256, 192], `${label}: top screen is not 256x192`);
  assert(Math.abs(result.ratio - 4 / 3) < 0.01, `${label}: top screen is not 4:3 (${result.ratio})`);
  assert.equal(result.rendering, "pixelated", `${label}: top screen is not pixelated`);
  assert(new Set(result.colors).size >= 4, `${label}: top screen looks blank ${JSON.stringify(result.colors)}`);
  assert(result.colors.some((color) => color !== "0,0,0,255" && color !== "11,8,18,255"), `${label}: top screen is black`);
}

/** 2つの画面と本体のボタンが、画面の中に収まっていること。 */
async function assertShellFits(page, label) {
  const boxes = await page.evaluate(() => [".retro-top", ".retro-bottom", ".retro-keys"].map((selector) => {
    const r = document.querySelector(selector).getBoundingClientRect();
    return { selector, left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }).concat({ selector: "view", width: innerWidth, height: innerHeight, scroll: document.documentElement.scrollWidth }));
  const view = boxes.pop();
  for (const box of boxes) {
    assert(box.left >= -0.5 && box.top >= -0.5 && box.right <= view.width + 0.5 && box.bottom <= view.height + 0.5, `${label}: ${box.selector} leaves the viewport ${JSON.stringify(box)}`);
  }
  for (const box of boxes.slice(0, 2)) assert(Math.abs(box.width / box.height - 4 / 3) < 0.01, `${label}: ${box.selector} is not 4:3`);
  assert(view.scroll <= view.width + 1, `${label}: the page scrolls sideways`);
}

/** 第1章の会話を、本編の再生口（vn/engine.js の play）で始める。 */
async function playScene(page, id, { chapter = 1, bg = "res://assets/backgrounds/bg_tonari_inside_night.png" } = {}) {
  await page.evaluate(async ([id, chapter, bg]) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter, day: 6, slot: 1 });
    for (const c of ["sumi", "tsumugi", "naru", "minto", "adam", "rio"]) s.met[c] = true;
    const { play } = await import("./js/vn/engine.js");
    (await import("./js/core/ui.js")).clearScreen();
    window.sceneRun = play(id, { bg }).catch((error) => { window.sceneError = String(error.stack || error); });
  }, [id, chapter, bg]);
  await page.locator("#vn.active .vn-text").waitFor({ state: "attached", timeout: 20000 });
}

/** 第1章 DAY5 の昼の地図を、本物の日常ループ（runDaily）で出す。 */
async function setupDaily(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    Object.assign(s.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.dailyRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.dailyError = String(error.stack || error); });
  });
  await page.locator("#screen .map:not(.done)").waitFor({ state: "attached", timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
}

const vnText = (page) => page.evaluate(() => document.querySelector("#vn .vn-text").textContent);
const typed = (page) => page.waitForFunction(() => document.querySelector("#vn .vn-next")?.classList.contains("show") || document.querySelector("#vn .vn-choices.show"));

await suite("look_retro", async (check) => {
  await check("portrait-title", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    const state = await rootState(page);
    assert.equal(state.look, "retro");
    assert.equal(state.engaged, "on");
    assert.equal(state.shellOn, "on");
    assert.equal(state.hint, "none", "the rotate hint must stay hidden while the DS shell is available");
    assert.equal(state.guard, "", "the rotate guard must not pause the game under the DS shell");
    assert.equal(state.viewportOpacity, "0", "the classic stage stays laid out but invisible");
    assert.equal(state.note, "");
    await assertShellFits(page, "portrait title");
    await assertTopScreenPainted(page, "title");
    const menus = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .title-menu > .title-item")].map((n) => [n.dataset.test, n.disabled, n.querySelector(".ti-en").textContent]),
      retro: [...document.querySelectorAll(".retro-title > .retro-menu")].map((n) => [n.dataset.test.replace(/^retro-/, ""), n.disabled, n.querySelector("b").textContent]),
    }));
    assert.deepEqual(menus.retro, menus.classic, "the lower screen mirrors the title menu, including disabled items");
    assert(menus.retro.some(([test, disabled]) => test === "title-load" && disabled), "LOAD is disabled without a save");
    // NEW GAME の中継: 現行のタイトルが閉じて、冒頭の会話が始まる
    await page.locator(t("retro-title-new")).tap();
    await page.waitForFunction(() => document.body.dataset.screen !== "title" && document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => window.__remake.state.chapter), 1);
    await page.locator(shellFor("vn")).waitFor();
    assert.equal((await rootState(page)).guard, "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-conversation", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    await assertShellFits(page, "portrait conversation");
    await assertTopScreenPainted(page, "conversation");
    await typed(page);
    const first = await page.evaluate(() => ({
      classic: document.querySelector("#vn .vn-text").textContent, retro: document.querySelector(".retro-vn-text").textContent,
      name: document.querySelector("#vn .vn-name.show")?.textContent || "", retroName: document.querySelector(".retro-vn-name:not([hidden])")?.textContent || "",
      fits: (() => { const w = document.querySelector(".retro-vn-win"); return w.scrollHeight <= w.clientHeight + 1 && w.scrollWidth <= w.clientWidth + 1; })(),
      font: getComputedStyle(document.querySelector(".retro-vn-text")).fontFamily,
    }));
    assert(first.classic.length > 0);
    assert.equal(first.retro, first.classic, "the lower screen shows the same words as the classic dialogue box");
    assert.equal(first.retroName, first.name);
    assert(first.name.length > 0, "the speaker name plate is shown");
    assert(first.fits, "the dialogue text fits the lower-screen window");
    assert(/Suien Dot/.test(first.font), `dot font expected, got ${first.font}`);
    // 本体のボタン: AUTO の点灯が現行と一致する
    await page.locator(t("retro-key-vn-auto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed") === "true"
      && document.querySelector('[data-test="retro-key-vn-auto"]').getAttribute("aria-pressed") === "true");
    await page.locator(t("retro-key-vn-auto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed") === "false"
      && document.querySelector('[data-test="retro-key-vn-auto"]').getAttribute("aria-pressed") === "false");
    // 下画面のタップで、現行のページが進む
    await typed(page);
    const before = await vnText(page);
    await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, before);
    // 上画面のタップでも進む
    await typed(page);
    const second = await vnText(page);
    await page.locator(t("retro-top")).tap({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, second);
    // 選択肢まで送る
    for (let i = 0; i < 40 && !(await page.locator("#vn .vn-choices.show .vn-choice").count()); i++) {
      await typed(page);
      if (await page.locator("#vn .vn-choices.show .vn-choice").count()) break;
      const now = await vnText(page);
      await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
      await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text || document.querySelector("#vn .vn-choices.show"), now);
    }
    await page.locator(".retro-vn-choices:not([hidden]) .retro-choice").first().waitFor();
    const choices = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#vn .vn-choices.show > .vn-choice")].map((n) => [n.textContent, n.getAttribute("aria-disabled")]),
      retro: [...document.querySelectorAll(".retro-vn-choices > .retro-choice")].map((n) => [n.textContent, n.getAttribute("aria-disabled")]),
      text: document.querySelector("#vn .vn-text").textContent, retroText: document.querySelector(".retro-vn-text").textContent,
      inside: [...document.querySelectorAll(".retro-vn-choices > .retro-choice")].every((n) => {
        const r = n.getBoundingClientRect(), s = document.querySelector(".retro-bottom").getBoundingClientRect();
        return r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom;
      }),
    }));
    assert(choices.classic.length >= 2);
    assert.deepEqual(choices.retro, choices.classic, "the lower screen lists the same choices");
    assert.equal(choices.retroText, choices.text);
    assert(choices.inside, "choices stay inside the lower screen");
    await page.locator(t("retro-choice-0")).tap();
    await page.waitForFunction((text) => !document.querySelector("#vn .vn-choices.show") && document.querySelector("#vn .vn-text").textContent !== text, choices.text);
    await page.waitForFunction(() => document.querySelector(".retro-vn-choices").hidden);
    assert.equal(await page.evaluate(() => window.sceneError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-map", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await assertShellFits(page, "portrait map");
    await assertTopScreenPainted(page, "map");
    const lists = await page.evaluate(() => ({
      pins: [...document.querySelectorAll("#screen .map-pins > .spot-pin")].map((pin) => [pin.dataset.spot, pin.querySelector(".sub-label").textContent, pin.classList.contains("off")]),
      rows: [...document.querySelectorAll(".retro-list > .retro-row")].map((row) => [row.dataset.spot, row.querySelector(".retro-row-name").textContent, row.dataset.off === "true"]),
      markers: document.querySelectorAll(".retro-markers > .retro-marker").length,
      head: document.querySelector(".retro-maphead").textContent,
      status: document.querySelector(".retro-status").textContent,
      go: document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled"),
    }));
    assert(lists.pins.length >= 5);
    assert.deepEqual(lists.rows, lists.pins, "one row per pin, with the same name and closed state");
    assert.equal(lists.markers, lists.pins.length, "one marker per pin on the upper screen");
    assert.match(lists.head, /DAY 5\/14/);
    assert.match(lists.head, /¥42,000/);
    assert.match(lists.status, /行動 あと2回/);
    assert.equal(lists.go, "true", "nothing is selected yet");
    // 行を選ぶ＝現行のピンを選ぶ
    await page.locator(t("retro-row-minto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="pin-minto"]').classList.contains("sel")
      && document.querySelector('[data-test="retro-row-minto"]').getAttribute("aria-pressed") === "true"
      && document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    assert.equal(await page.locator(t("retro-go")).textContent(), "PEPPERMINT へ行く");
    assert.equal(await page.locator('.retro-marker[data-sel="true"]').count(), 1);
    assert.equal(await page.locator(".retro-maplabel").textContent(), "PEPPERMINT");
    assert.equal(await page.evaluate(() => window.__remake.state.money), 42000, "selecting does not travel");
    // 「行く」＝選択中のピンをもう一度押した結果（移動して利用料を払う）
    await page.locator(t("retro-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .map:not(.done)") && window.__remake.state.money === 39000, null, { timeout: 15000 });
    await page.waitForFunction(() => document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-menu-falls-back", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-key-menu")).tap();
    await page.locator(t("menu")).waitFor();
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden);
    const open = await rootState(page);
    assert.equal(open.shellOn, "", "the DS shell steps aside for MENU");
    assert.equal(open.viewportOpacity, "1", "the classic screen is visible while the shell is away");
    assert.equal(open.hint, "none", "no rotate hint while the DS look is available");
    assert.equal(open.guard, "");
    await page.locator(t("retro-note")).waitFor();
    assert.match(await page.locator(t("retro-note")).textContent(), /横向き/);
    // 現行の MENU がそのまま押せる
    assert(await page.locator(t("menu-close")).evaluate((node) => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return node === top || node.contains(top);
    }), "the classic MENU close button is reachable");
    await page.locator(t("menu-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    const closed = await rootState(page);
    assert.equal(closed.shellOn, "on");
    assert.equal(closed.note, "");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-back-to-classic", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    // 設定から現行へ戻す（設定は未対応の場面なので、現行の画面で開く）
    await page.locator(t("retro-title-config")).tap();
    await page.locator(t("cfg-look")).waitFor();
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden);
    await page.locator(`${t("cfg-look")} button[value="classic"]`).tap();
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell, .retro-note"));
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    const classic = await rootState(page);
    assert.equal(classic.engaged, "");
    assert.equal(classic.shellOn, "");
    assert.equal(classic.hint, "grid", "the classic rotate hint is back on a portrait touch device");
    assert.equal(classic.viewportOpacity, "1");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config") || "{}").look), "classic");
    // もう一度 DS風へ（回転案内が全面を覆っているので、設定の段ボタンを直接押す）
    await page.locator(`${t("cfg-look")} button[value="retro"]`).evaluate((node) => node.click());
    await page.waitForFunction(() => document.documentElement.dataset.retro === "on" && !document.documentElement.dataset.rotateGuard);
    assert.equal((await rootState(page)).hint, "none");
    await page.locator(t("cfg-close")).tap();
    await page.locator(shellFor("title")).waitFor();
  }, { ...TALL, pageEntry: entry });

  await check("landscape-touch-stays-classic", async (page) => {
    await page.waitForFunction(() => document.documentElement.dataset.look === "retro" && !!document.querySelector(".retro-shell"));
    await page.waitForTimeout(600);
    const state = await rootState(page);
    assert.equal(state.engaged, "", "a landscape touch device keeps the classic screen");
    assert.equal(state.shellOn, "");
    assert.deepEqual(state.shell, { hidden: true, scene: "" });
    assert.equal(state.viewportOpacity, "1");
    assert.equal(state.note, "");
    assert.equal(state.hint, "none");
    assert(await page.locator(t("title-new")).evaluate((node) => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return node === top || node.contains(top);
    }), "the classic title menu is reachable");
    // 縦へ回すと外枠が出て、横へ戻すと現行に戻る
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(shellFor("title")).waitFor();
    assert.equal((await rootState(page)).guard, "");
    await assertShellFits(page, "rotated to portrait");
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden && !document.documentElement.dataset.retro);
    assert.equal((await rootState(page)).viewportOpacity, "1");
  }, { ...WIDE, pageEntry: entry });

  await check("desktop-shows-shell", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await assertShellFits(page, "desktop title");
    await assertTopScreenPainted(page, "desktop title");
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    await assertShellFits(page, "desktop conversation");
    await assertTopScreenPainted(page, "desktop conversation");
    await typed(page);
    const before = await vnText(page);
    assert.equal(await page.locator(".retro-vn-text").textContent(), before);
    await page.locator(t("retro-bottom")).click({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, before);
    // LOG は未対応の場面: 現行の画面で開き、閉じると外枠が戻る
    await typed(page);
    await page.locator(t("retro-key-vn-log")).click();
    await page.waitForFunction(() => document.querySelector("#vn .vn-log.show") && document.querySelector(".retro-shell").hidden);
    assert.equal((await rootState(page)).note, "", "no rotate advice on a landscape desktop window");
    await page.keyboard.press("Escape");
    await page.locator(shellFor("vn")).waitFor();
  }, { pageEntry: entry });

  await check("chapter-two-stays-classic", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second", { chapter: 2 });
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell, .retro-note"));
    const state = await rootState(page);
    assert.equal(state.engaged, "");
    assert.equal(state.shellOn, "");
    assert.equal(state.viewportOpacity, "1");
    assert.equal(await page.evaluate(() => document.documentElement.dataset.lookChoice), "retro", "the choice is kept for chapter 1");
    // 第1章へ戻ると、また外枠が出る
    await page.evaluate(() => { window.__remake.state.chapter = 1; });
    await page.locator(shellFor("vn")).waitFor();
  }, { pageEntry: entry });

  await check("old-two-screen-layout-keeps-classic", async (page) => {
    // 古い2画面表示（表示設定の「DS風」）が有効な端末では外枠を出さず、通常版へ戻す案内だけを出す。
    // 古い2画面表示そのものが無くなった後は、この確認は不要になる。
    if (!(await page.evaluate(() => !!document.querySelector('#screen .title[data-layout="ds"]')))) return;
    await page.locator(t("retro-note")).waitFor();
    const state = await rootState(page);
    assert.equal(state.shellOn, "");
    assert.equal(state.engaged, "");
    assert.match(state.note, /通常版/);
    assert.equal(state.viewportOpacity, "1");
  }, { pageEntry: entry, storageState: { cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: "suien_title_layout", value: "ds" }] }] } });
});
