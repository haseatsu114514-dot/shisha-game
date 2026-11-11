// 新版の縦持ち（LK11・2026-11-11 オーナー決定）: 縦長の画面では DS風の外枠を使い、上画面は新版と同じ高解像度の絵、
// 下画面と本体のボタンはドット調のまま。横長の画面は今の新版のまま。未対応の場面では小さい横長の画面を出さず回転案内を出す。
// 自動操作のブラウザの既定は旧版なので ?look=neo を付けて確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const entry = `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=neo`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true };
const WIDE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const DESK_TALL = { viewport: { width: 500, height: 900 }, deviceScaleFactor: 1 };
const shellFor = (scene) => `.retro-shell:not([hidden])[data-scene="${scene}"]`;
const HINT_TEXT = "この画面は横向きで表示します";

const rootState = (page) => page.evaluate(() => {
  const root = document.documentElement, shell = document.querySelector(".retro-shell"), hint = document.getElementById("rotate-hint");
  return {
    look: root.dataset.look, paint: root.dataset.retroPaint || "", engaged: root.dataset.retro || "", shellOn: root.dataset.retroShell || "",
    hold: root.dataset.retroHint || "", guard: root.dataset.rotateGuard || "",
    shell: shell ? { hidden: shell.hidden, scene: shell.dataset.scene, paint: shell.dataset.paint } : null,
    hint: getComputedStyle(hint).display, hintText: hint.innerText.replace(/\s+/g, " ").trim(),
    replaced: !!hint.querySelector(".retro-hint"),
    viewportOpacity: getComputedStyle(document.getElementById("viewport")).opacity,
  };
});

/** 上画面の canvas: 裏画面の大きさ・CSS の大きさ・色の種類（高解像度なら多い）。 */
const topScreen = (page) => page.evaluate(() => {
  const canvas = document.querySelector(".retro-canvas");
  const box = canvas.getBoundingClientRect();
  const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
  const px = new Uint32Array(data.buffer), colors = new Set();
  let bright = 0;
  for (let i = 0; i < px.length; i += 3) {
    colors.add(px[i]);
    if ((px[i] & 255) + ((px[i] >> 8) & 255) + ((px[i] >> 16) & 255) > 150) bright++;
  }
  return {
    backing: [canvas.width, canvas.height], device: [box.width * devicePixelRatio, box.height * devicePixelRatio],
    colors: colors.size, bright: bright / (px.length / 3), zoom: canvas.dataset.zoom || "",
    rendering: getComputedStyle(canvas).imageRendering, pixel: document.querySelector(".retro-shell").dataset.pixel,
  };
});

/** 上画面が高解像度の絵で描かれていること（裏画面＝CSS の大きさ × devicePixelRatio、色の種類が多い）。 */
async function assertHdTop(page, label) {
  await page.waitForFunction(() => {
    const canvas = document.querySelector(".retro-canvas");
    if (!canvas) return false;
    const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
    let bright = 0;
    for (let i = 0; i < data.length; i += 4 * 61) if (data[i] + data[i + 1] + data[i + 2] > 150) bright++;
    return bright > data.length / 4 / 61 * 0.1;
  }, null, { timeout: 15000 });
  const top = await topScreen(page);
  assert.equal(top.pixel, "hd", `${label}: the shell uses the high-resolution paint`);
  assert(Math.abs(top.backing[0] - top.device[0]) <= 2 && Math.abs(top.backing[1] - top.device[1]) <= 2,
    `${label}: the canvas backing should match CSS size × devicePixelRatio ${JSON.stringify(top)}`);
  assert(top.colors >= 2000, `${label}: the upper screen should be a full-colour picture, got ${top.colors} colours`);
  assert.notEqual(top.rendering, "pixelated", `${label}: no pixelated scaling for the high-resolution picture`);
  return top;
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

/** 外枠の出入りを記録する（"off"＝外枠を引っ込めた）。 */
const watchShell = (page) => page.evaluate(() => {
  const shell = document.querySelector(".retro-shell");
  window.__shellLog = [];
  new MutationObserver(() => {
    const now = shell.hidden ? "off" : shell.dataset.scene;
    if (window.__shellLog.at(-1) !== now) window.__shellLog.push(now);
  }).observe(shell, { attributes: true, attributeFilter: ["hidden", "data-scene"] });
});
const shellLog = (page) => page.evaluate(() => window.__shellLog.slice());

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
/** 現行の画面にも、外枠にも、足した物が残っていないこと（旧版・DS風へ切り替えた後）。 */
const residue = (page) => page.evaluate(() => {
  const root = document.documentElement;
  return {
    shells: document.querySelectorAll(".retro-shell").length, notes: document.querySelectorAll(".retro-note").length,
    hints: document.querySelectorAll(".retro-hint").length,
    attrs: ["retro", "retroShell", "retroHint", "retroPaint"].filter((name) => name in root.dataset),
    paint: document.querySelector(".retro-shell")?.dataset.paint || "",
  };
});

await suite("look_neo_portrait", async (check) => {
  await check("portrait-title", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    const state = await rootState(page);
    assert.equal(state.look, "neo");
    assert.equal(state.paint, "hd");
    assert.deepEqual(state.shell, { hidden: false, scene: "title", paint: "hd" });
    assert.equal(state.hint, "none", "no rotate hint while the shell is shown");
    assert.equal(state.guard, "");
    assert.equal(state.viewportOpacity, "0");
    await assertShellFits(page, "portrait title");
    await assertHdTop(page, "title");
    // 下画面はドット調のまま
    const font = await page.locator(".retro-title .retro-menu b").first().evaluate((node) => getComputedStyle(node).fontFamily);
    assert(/Suien Dot/.test(font), `the lower screen keeps the dot font, got ${font}`);
    const menus = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .title-menu > .title-item")].map((n) => [n.dataset.test, n.disabled]),
      retro: [...document.querySelectorAll(".retro-title > .retro-menu")].map((n) => [n.dataset.test.replace(/^retro-/, ""), n.disabled]),
    }));
    assert.deepEqual(menus.retro, menus.classic);
    await page.locator(t("retro-title-new")).tap();
    await page.waitForFunction(() => document.body.dataset.screen !== "title" && document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    assert.equal((await rootState(page)).guard, "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-conversation", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    await assertShellFits(page, "portrait conversation");
    await typed(page);
    // 一人の場面は人物へ寄る（1.35 倍）。寄った絵も高解像度
    await page.waitForFunction(() => document.querySelector(".retro-canvas").dataset.zoom === "1.35");
    await assertHdTop(page, "conversation");
    const first = await page.evaluate(() => ({
      classic: document.querySelector("#vn .vn-text").textContent, retro: document.querySelector(".retro-vn-text").textContent,
      name: document.querySelector("#vn .vn-name.show")?.textContent || "", retroName: document.querySelector(".retro-vn-name:not([hidden])")?.textContent || "",
      font: getComputedStyle(document.querySelector(".retro-vn-text")).fontFamily,
    }));
    assert(first.classic.length > 0);
    assert.equal(first.retro, first.classic);
    assert.equal(first.retroName, first.name);
    assert(/Suien Dot/.test(first.font));
    // 下画面のタップで現行のページが進む
    const before = await vnText(page);
    await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, before);
    // 選択肢まで送り、押すと現行が進む
    for (let i = 0; i < 40 && !(await page.locator("#vn .vn-choices.show .vn-choice").count()); i++) {
      await typed(page);
      if (await page.locator("#vn .vn-choices.show .vn-choice").count()) break;
      const now = await vnText(page);
      await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
      await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text || document.querySelector("#vn .vn-choices.show"), now);
    }
    await page.locator(".retro-vn-choices:not([hidden]) .retro-choice").first().waitFor();
    const choices = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#vn .vn-choices.show > .vn-choice")].map((n) => n.textContent),
      retro: [...document.querySelectorAll(".retro-vn-choices > .retro-choice")].map((n) => n.textContent),
      text: document.querySelector("#vn .vn-text").textContent,
    }));
    assert(choices.classic.length >= 2);
    assert.deepEqual(choices.retro, choices.classic);
    await page.locator(t("retro-choice-0")).tap();
    await page.waitForFunction((text) => !document.querySelector("#vn .vn-choices.show") && document.querySelector("#vn .vn-text").textContent !== text, choices.text);
    assert.equal(await page.evaluate(() => window.sceneError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-map-and-transition", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await assertShellFits(page, "portrait map");
    await assertHdTop(page, "map");
    const lists = await page.evaluate(() => ({
      pins: [...document.querySelectorAll("#screen .map-pins > .spot-pin")].map((pin) => [pin.dataset.spot, pin.querySelector(".sub-label").textContent]),
      rows: [...document.querySelectorAll(".retro-list > .retro-row")].map((row) => [row.dataset.spot, row.querySelector(".retro-row-name").textContent]),
      face: (() => { const c = document.querySelector(".retro-face canvas"); return c ? [c.width, Math.round(c.getBoundingClientRect().width * devicePixelRatio)] : null; })(),
    }));
    assert.deepEqual(lists.rows, lists.pins, "one row per pin");
    assert(lists.face && Math.abs(lists.face[0] - lists.face[1]) <= 2, `face icons are drawn at device resolution ${JSON.stringify(lists.face)}`);
    await page.locator(t("retro-row-minto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="pin-minto"]').classList.contains("sel")
      && document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await watchShell(page);
    await page.locator(t("retro-go")).tap();
    await page.waitForFunction(() => window.__remake.state.money === 39000, null, { timeout: 15000 });
    await page.waitForFunction(() => document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    // 場面転換（移動の幕・店のロゴ）の間も外枠のまま。回転案内も出ない
    const log = await shellLog(page);
    assert(log.includes("cover"), `the transition is shown inside the shell: ${log}`);
    assert(!log.includes("off"), `the shell must stay up through the transition: ${log}`);
    assert.equal((await rootState(page)).guard, "");
    await typed(page);
    const arrived = await vnText(page);
    assert.equal(await page.locator(".retro-vn-text").textContent(), arrived);
    await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, arrived);
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-tonari-menu", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-row-tonari")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await page.locator(t("retro-go")).tap();
    await page.locator(shellFor("menu")).waitFor({ timeout: 15000 });
    await assertHdTop(page, "tonari menu");
    const menu = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .sub-menu .big-choice")].map((n) => [n.dataset.test, n.querySelector("b").textContent]),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => [n.dataset.test.replace(/^retro-/, ""), n.querySelector("b").textContent]),
    }));
    assert(menu.classic.length >= 2);
    assert.deepEqual(menu.retro, menu.classic);
    await page.locator(t("retro-tonari-customer")).tap();
    await page.waitForFunction(() => document.body.classList.contains("in-vn"), null, { timeout: 20000 });
    await page.locator(shellFor("vn")).waitFor();
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-menu-shows-rotate-hint", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-key-menu")).tap();
    await page.locator(t("menu")).waitFor();
    // 小さい横長の画面は出さず、少し待ってから回転案内を出す（制作の時計と音は案内の印で止まる）
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true", null, { timeout: 5000 });
    const open = await rootState(page);
    assert.equal(open.hint, "grid");
    assert.equal(open.shell.hidden, true);
    assert.equal(open.hold, "");
    assert(open.replaced && open.hintText.includes(HINT_TEXT) && open.hintText.includes("端末を横にしてください"), `the hint text is replaced: ${open.hintText}`);
    assert(!open.hintText.includes("お楽しみください"), "the original hint line is hidden");
    assert.equal(await page.locator(t("retro-note")).isVisible(), false, "no extra note on top of the rotate hint");
    // 閉じると外枠へ戻り、案内が消える
    await page.locator(t("menu-close")).evaluate((node) => node.click());
    await page.locator(shellFor("map")).waitFor();
    await page.waitForFunction(() => !document.documentElement.dataset.rotateGuard);
    const closed = await rootState(page);
    assert.equal(closed.hint, "none");
    assert.equal(closed.hold, "hold");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("landscape-and-desktop-stay-neo", async (page) => {
    for (const viewport of [WIDE.viewport, { width: 1280, height: 720 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(500);
      const state = await rootState(page);
      assert.equal(state.look, "neo");
      assert.equal(state.shellOn, "", `no shell at ${viewport.width}x${viewport.height}`);
      assert(!state.shell || state.shell.hidden, `no visible shell at ${viewport.width}x${viewport.height}`);
      assert.equal(state.viewportOpacity, "1");
      assert.equal(state.hint, "none");
    }
    // 縦へ回すと外枠が出て、横へ戻すと引っ込む
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(shellFor("title")).waitFor({ timeout: 10000 });
    await page.setViewportSize(WIDE.viewport);
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden && !document.documentElement.dataset.retroShell);
    assert.equal((await rootState(page)).viewportOpacity, "1");
  }, { ...WIDE, pageEntry: entry });

  await check("desktop-portrait-window-shows-shell", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    await assertShellFits(page, "desktop portrait window");
    await assertHdTop(page, "desktop portrait window");
    await typed(page);
    const before = await vnText(page);
    await page.locator(t("retro-bottom")).click({ position: { x: 60, y: 60 } });
    await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, before);
    // タッチでない縦長の窓では回転案内が出ないので、未対応の場面は小さい画面＋一言（DS風と同じ）
    await typed(page);
    await page.locator(t("retro-key-vn-log")).click();
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden, null, { timeout: 5000 });
    await page.locator(t("retro-note")).waitFor();
    const state = await rootState(page);
    assert.equal(state.hint, "none");
    assert.equal(state.guard, "");
    assert.equal(state.viewportOpacity, "1");
    await page.keyboard.press("Escape");
    await page.locator(shellFor("vn")).waitFor();
  }, { ...DESK_TALL, pageEntry: entry });

  await check("chapter-two-keeps-the-original-rotate-hint", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second", { chapter: 2 });
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell"));
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    const state = await rootState(page);
    assert.equal(state.hint, "grid");
    assert.equal(state.replaced, false);
    assert(state.hintText.includes("横向きでお楽しみください"), `the original hint text is back: ${state.hintText}`);
    assert.deepEqual((await residue(page)).attrs, []);
  }, { ...TALL, pageEntry: entry });

  await check("switching-looks-leaves-no-trace", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    const setLook = (id) => page.evaluate(async (id) => (await import("./js/core/look.js")).setLook(id), id);
    assert.deepEqual(await residue(page), { shells: 1, notes: 1, hints: 1, attrs: ["retro", "retroShell", "retroHint", "retroPaint"], paint: "hd" });
    // 新版 → DS風: ドット絵の外枠に入れ替わり、新版の案内の文は残らない
    await setLook("retro");
    await page.locator(".retro-shell:not([hidden])[data-paint=\"dot\"]").waitFor();
    const retro = await residue(page);
    assert.deepEqual([retro.shells, retro.notes, retro.hints, retro.paint], [1, 1, 0, "dot"]);
    assert(!retro.attrs.includes("retroHint"));
    assert.equal(await page.evaluate(() => document.documentElement.dataset.retroPaint), "dot");
    // DS風 → 新版: 高解像度の外枠が1つだけ
    await setLook("neo");
    await page.locator(".retro-shell:not([hidden])[data-paint=\"hd\"]").waitFor();
    const neo = await residue(page);
    assert.deepEqual([neo.shells, neo.notes, neo.hints, neo.paint], [1, 1, 1, "hd"]);
    // 新版 → 旧版: 何も残らず、回転案内は元の文
    await setLook("classic");
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic");
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    assert.deepEqual(await residue(page), { shells: 0, notes: 0, hints: 0, attrs: [], paint: "" });
    const state = await rootState(page);
    assert(state.hintText.includes("横向きでお楽しみください"));
    assert.equal(state.viewportOpacity, "1");
  }, { ...TALL, pageEntry: entry });
});
