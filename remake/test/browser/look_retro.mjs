// 見た目の様式「DS風」（LK03・js/looks/retro.js）: 現行の画面を動かしたまま、上下2画面（256×192）の外枠へ写す。
// 縦持ちのタッチ端末と PC で、タイトル・会話と選択肢・日常の地図に外枠が出ること、操作が現行へ中継されること、
// 全画面 MENU・設定はシート（retro/sheet.js）で外枠の中に写り、未対応の場面（心得の盤）では外枠が引っ込むこと、
// 現行へ戻す・横持ち・第2章では現行のままであることを確かめる。
// 上画面はドット絵の処方（色数を絞る・一人の場面は人物へ寄る・1ドット＝整数画素）で、場面転換・登場カットイン・
// tonari の行動選びの間も外枠のまま続くこと（現行の画面へ行き来しないこと）も確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const entry = `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=retro`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const TALL3 = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
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

/** 上画面の canvas の画素（256×192 のドットへ直した色の一覧・色の種類・寄りの倍率）。 */
const topScreen = (page) => page.evaluate(() => {
  const canvas = document.querySelector(".retro-canvas");
  const scale = Number(canvas.dataset.scale) || 1;
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const px = new Uint32Array(data.buffer);
  const colors = new Set(), dots = [];
  let uniform = true, bright = 0;
  for (let y = 0; y < 192; y++) for (let x = 0; x < 256; x++) {
    const color = px[y * scale * canvas.width + x * scale];
    colors.add(color); dots.push(color);
    if ((color & 255) + ((color >> 8) & 255) + ((color >> 16) & 255) > 120) bright++;
    // 1ドットの中の画素がすべて同じ色か（補間なしで拡大できているか）。端の画素だけ見る
    if (scale > 1 && px[(y * scale + scale - 1) * canvas.width + x * scale + scale - 1] !== color) uniform = false;
  }
  const box = canvas.getBoundingClientRect();
  return {
    backing: [canvas.width, canvas.height], scale, colors: colors.size, bright, uniform, zoom: Number(canvas.dataset.zoom) || 0,
    sample: [[40, 40], [128, 60], [216, 40], [64, 120], [128, 150], [200, 130], [128, 96]].map(([x, y]) => dots[y * 256 + x]),
    ratio: box.width / box.height, device: [box.width * devicePixelRatio, box.left * devicePixelRatio, box.top * devicePixelRatio],
    rendering: getComputedStyle(canvas).imageRendering, pixel: document.querySelector(".retro-shell").dataset.pixel,
  };
});

/** 上画面が 256×192 のドット（裏画面はその整数倍）で、絵が写っている（真っ黒・単色でない）こと。 */
async function assertTopScreenPainted(page, label) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".retro-canvas");
    if (!canvas) return false;
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0;
    for (let i = 0; i < data.length; i += 4 * 97) if (data[i] + data[i + 1] + data[i + 2] > 120) bright++;
    return bright > canvas.width * canvas.height / 97 * 0.08;
  }, null, { timeout: 15000 });
  const result = await topScreen(page);
  assert.deepEqual(result.backing, [256 * result.scale, 192 * result.scale], `${label}: top screen is not a multiple of 256x192`);
  assert(Math.abs(result.ratio - 4 / 3) < 0.01, `${label}: top screen is not 4:3 (${result.ratio})`);
  assert.equal(result.rendering, "pixelated", `${label}: top screen is not pixelated`);
  assert(result.uniform, `${label}: dots are not enlarged without smoothing`);
  assert(new Set(result.sample).size >= 4, `${label}: top screen looks blank ${JSON.stringify(result.sample)}`);
  return result;
}

/** 外枠の出入りを記録する（"off"＝現行の画面へ引っ込んだ）。 */
const watchShell = (page) => page.evaluate(() => {
  const shell = document.querySelector(".retro-shell");
  window.__shellLog = [];
  new MutationObserver(() => {
    const now = shell.hidden ? "off" : shell.dataset.scene;
    if (window.__shellLog.at(-1) !== now) window.__shellLog.push(now);
  }).observe(shell, { attributes: true, attributeFilter: ["hidden", "data-scene"] });
});
const shellLog = (page) => page.evaluate(() => window.__shellLog.slice());

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
    window.sceneRun = play(id, bg ? { bg } : {}).catch((error) => { window.sceneError = String(error.stack || error); });
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
    // ドット絵の処方: 一人の場面は人物へ寄り（1.35 倍）、色数は背景 64 色＋立ち絵 48 色＋店の台の範囲に収まる
    await page.waitForFunction(() => document.querySelector(".retro-canvas").dataset.zoom === "1.35");
    const dots = await topScreen(page);
    assert(dots.colors <= 150 && dots.colors >= 24, `conversation: the upper screen should use a reduced palette, got ${dots.colors} colours`);
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
    // 地図の色数も絞られている（64 色）
    const mapDots = await topScreen(page);
    assert(mapDots.colors <= 80 && mapDots.colors >= 16, `map: reduced palette expected, got ${mapDots.colors} colours`);
    // 「行く」＝選択中のピンをもう一度押した結果（移動して利用料を払う）
    await watchShell(page);
    await page.locator(t("retro-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .map:not(.done)") && window.__remake.state.money === 39000, null, { timeout: 15000 });
    await page.waitForFunction(() => document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    // 場面転換（移動の幕・店のロゴ）の間も外枠のまま（覆い）で、終われば会話が続く
    const log = await shellLog(page);
    assert(log.includes("cover"), `the move transition should be shown inside the shell: ${log}`);
    assert(!log.includes("off"), `the shell must not fall back to the classic screen during the transition: ${log}`);
    assert.equal(log.at(-1), "vn");
    await typed(page);
    const arrived = await vnText(page);
    assert.equal(await page.locator(".retro-vn-text").textContent(), arrived);
    await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, arrived);
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-menu-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-key-menu")).tap();
    // 全画面 MENU は外枠のシートへ写す（上画面はタブに合った絵、下画面は今のタブの中身、本体のボタンはタブと「閉じる」）
    await page.locator(shellFor("sheet")).waitFor();
    await page.locator('.retro-sheet[data-kind="menu"]').waitFor();
    const open = await rootState(page);
    assert.equal(open.shellOn, "on");
    assert.equal(open.viewportOpacity, "0");
    assert.equal(open.note, "");
    await assertShellFits(page, "menu sheet");
    await assertTopScreenPainted(page, "menu sheet");
    await page.locator(t("retro-key-tab-people")).tap();
    await page.waitForFunction(() => document.querySelector(".dmenu").dataset.tab === "people"
      && document.querySelector('[data-test="retro-key-tab-people"]').getAttribute("aria-pressed") === "true");
    const rows = await page.evaluate(() => ({
      classic: [...document.querySelectorAll(".dmenu .dm-person")].map((n) => n.dataset.test),
      sheet: [...document.querySelectorAll(".retro-sheet .s-dm-person")].map((n) => n.dataset.test.replace(/^sheet-/, "")),
      font: getComputedStyle(document.querySelector(".retro-sheet .s-dm-person")).fontFamily,
    }));
    assert(rows.classic.length >= 2);
    assert.deepEqual(rows.sheet, rows.classic);
    assert(/Suien Dot/.test(rows.font));
    await page.locator(t("retro-key-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    assert.equal(await page.locator(".dmenu").count(), 0);
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-growth-board-falls-back", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-key-menu")).tap();
    await page.locator(t("sheet-menu-board")).tap();
    // 心得の盤（動かして見る盤・未対応の場面）では外枠を引っ込め、現行の画面を小さく見せて一言を添える
    await page.locator(t("board-close")).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden);
    const open = await rootState(page);
    assert.equal(open.shellOn, "", "the DS shell steps aside for the growth board");
    assert.equal(open.viewportOpacity, "1", "the classic screen is visible while the shell is away");
    assert.equal(open.hint, "none", "no rotate hint while the DS look is available");
    assert.equal(open.guard, "");
    await page.locator(t("retro-note")).waitFor();
    assert.match(await page.locator(t("retro-note")).textContent(), /横向き/);
    // 現行の盤の「閉じる」がそのまま押せる
    assert(await page.locator(t("board-close")).evaluate((node) => {
      const r = node.getBoundingClientRect();
      const top = document.elementFromPoint((r.left + r.right) / 2, (r.top + r.bottom) / 2);
      return node === top || node.contains(top);
    }), "the classic board close button is reachable");
    await page.locator(t("board-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    const closed = await rootState(page);
    assert.equal(closed.shellOn, "on");
    assert.equal(closed.note, "");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-back-to-classic", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    // 設定は外枠のシートで開き、写しの段ボタンから現行へ戻す（押すと元の段ボタンへ中継される）
    await page.locator(t("retro-title-config")).tap();
    await page.locator('.retro-sheet[data-kind="modal"]').waitFor();
    await page.locator(`${t("sheet-cfg-look")} button[value="classic"]`).tap();
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell, .retro-note, .retro-sheet"));
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
    await page.locator('.retro-sheet[data-kind="modal"]').waitFor();
    await page.locator(t("sheet-cfg-close")).tap();
    await page.locator(shellFor("title")).waitFor();
  }, { ...TALL, pageEntry: entry });

  await check("portrait-dpr3-integer-pixels", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    const dots = await assertTopScreenPainted(page, "dpr3 conversation");
    // 1ドット＝実機の画素の整数倍。裏画面と CSS の大きさが 1:1 で、位置も画素の境目に合っている
    assert.equal(dots.pixel, "integer");
    assert(dots.scale >= 3, `one dot should span several device pixels, got ${dots.scale}`);
    assert(Math.abs(dots.device[0] - dots.backing[0]) < 0.5, `canvas is not 1:1 with device pixels ${JSON.stringify(dots)}`);
    for (const edge of dots.device.slice(1)) assert(Math.abs(edge - Math.round(edge)) < 0.1, `canvas is off the device pixel grid ${JSON.stringify(dots.device)}`);
    const dpx = await page.evaluate(() => parseFloat(document.querySelector(".retro-shell").style.getPropertyValue("--dpx")) * devicePixelRatio);
    assert(Math.abs(dpx - dots.scale) < 0.01, `the lower screen uses the same dot size (${dpx} vs ${dots.scale})`);
    await assertShellFits(page, "dpr3 conversation");
  }, { ...TALL3, pageEntry: entry });

  await check("portrait-intro-cutin-in-shell", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_tsumugi_first", { bg: null });
    await page.locator(shellFor("vn")).waitFor();
    await watchShell(page);
    // スミさんの登場カットインまで送る
    for (let i = 0; i < 40 && !(await page.locator("#fx .cutin").count()); i++) {
      await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } }).catch(() => {});
      await page.waitForTimeout(250);
    }
    await page.locator("#fx .cutin .ci-name").waitFor({ state: "attached" });
    await page.locator(".retro-profile:not([hidden]) .retro-profile-name").waitFor();
    const card = await page.evaluate(() => ({
      scene: document.querySelector(".retro-shell").dataset.scene, hidden: document.querySelector(".retro-shell").hidden,
      classic: { name: document.querySelector("#fx .cutin .ci-name").getAttribute("aria-label"), title: document.querySelector("#fx .cutin .ci-title").textContent, line: document.querySelector("#fx .cutin .ci-line").textContent },
      retro: { name: document.querySelector(".retro-profile-name").textContent, title: document.querySelector(".retro-profile-title")?.textContent || "", line: document.querySelector(".retro-profile-line")?.textContent || "" },
      flavor: document.querySelector(".retro-profile-flavor")?.textContent || "",
    }));
    assert.equal(card.scene, "cover");
    assert.equal(card.hidden, false);
    assert.deepEqual(card.retro, card.classic, "the lower screen shows the cut-in's name, title and line");
    assert(card.flavor.includes("好きなフレーバー"), "the favourite flavour is listed");
    await assertTopScreenPainted(page, "intro cut-in"); // 上画面にカットインの絵
    // カットインが終わると、外枠のまま会話へ戻る
    await page.locator("#fx .cutin").waitFor({ state: "detached", timeout: 15000 });
    await page.locator(shellFor("vn")).waitFor();
    const log = await shellLog(page);
    assert(!log.includes("off"), `the shell must stay up through the cut-in: ${log}`);
    assert.equal(await page.evaluate(() => window.sceneError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-tonari-menu-in-shell", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await watchShell(page);
    await page.locator(t("retro-row-tonari")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await page.locator(t("retro-go")).tap();
    await page.locator(shellFor("menu")).waitFor({ timeout: 15000 });
    await assertShellFits(page, "tonari menu");
    await assertTopScreenPainted(page, "tonari menu");
    const menu = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .sub-menu .big-choice")].map((n) => [n.dataset.test, n.disabled, n.querySelector("b").textContent, n.querySelector("small").textContent]),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => [n.dataset.test.replace(/^retro-/, ""), n.disabled, n.querySelector("b").textContent, n.querySelector("small").textContent]),
      status: document.querySelector(".retro-status-l").textContent, caption: document.querySelector(".retro-caption").textContent,
      lead: document.querySelector("#screen .sub-menu .sub-lead").textContent,
      keys: [...document.querySelectorAll(".retro-keys .retro-key")].map((n) => n.dataset.key),
    }));
    assert(menu.classic.length >= 2);
    assert.deepEqual(menu.retro, menu.classic, "the lower screen lists the same actions");
    assert.equal(menu.status, "tonari");
    assert.equal(menu.caption, menu.lead);
    assert(menu.keys.includes("back"), "a hardware key goes back to the map");
    // 「もどる」で地図へ、もう一度入って「お客さんとして一服」を選ぶと会話が始まる
    await page.locator(t("retro-key-back")).tap();
    await page.locator(shellFor("map")).waitFor({ timeout: 15000 });
    await page.locator(t("retro-row-tonari")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await page.locator(t("retro-go")).tap();
    await page.locator(shellFor("menu")).waitFor({ timeout: 15000 });
    await page.locator(t("retro-tonari-customer")).tap();
    await page.waitForFunction(() => document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    const log = await shellLog(page);
    assert(!log.includes("off"), `the shell must stay up from the map through the tonari menu: ${log}`);
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
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
    // LOG は外枠のシート（上下の画面をつないだ縦長の1枚）で開き、本体の「閉じる」で会話へ戻る
    await typed(page);
    await page.locator(t("retro-key-vn-log")).click();
    await page.waitForFunction(() => document.querySelector("#vn .vn-log.show") && document.querySelector('.retro-sheet[data-kind="log"]'));
    const log = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#vn .vn-log .log-row")].map((n) => n.textContent),
      sheet: [...document.querySelectorAll(".retro-sheet .s-log-row")].map((n) => n.textContent),
    }));
    assert(log.classic.length >= 2);
    assert.deepEqual(log.sheet, log.classic);
    assert.equal((await rootState(page)).note, "", "no rotate advice on a landscape desktop window");
    await page.locator(t("retro-key-close")).click();
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
});
