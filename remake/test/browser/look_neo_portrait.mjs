// 新版の縦持ち（LK11・2026-11-11 オーナー決定）: 縦長の画面では DS風の外枠を使い、上画面は新版と同じ高解像度の絵、
// 下画面と本体のボタンはドット調のまま。横長の画面は今の新版のまま。未対応の場面では小さい横長の画面を出さず回転案内を出す。
// 自動操作のブラウザの既定は旧版なので ?look=neo を付けて確かめる。
// 第2〜5章（2026-11-11 オーナー「新版を広げる」）: 各章の会話・地図（第2章の初日の配達と店頭、日常の朝の行き先と駅、
// 第3章の東京・場面カード、第4章のドバイ、第5章の地元）も外枠に写る。
// 全画面 MENU・LIME（初回の案内も）・小窓（設定・セーブ／ロード・セーブの引っ越し・規則の紙）・会話の LOG・店・
// 夜のレベルアップ・章のクリアはシート（retro/sheet.js）で外枠の中に写り、回転案内を出さない。
// 写せない画面（心得の盤など）は回転案内へ落ちる。
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
/** 回転案内の印（html[data-rotate-guard]）が一度でも付いたかを記録する。 */
const watchGuard = (page) => page.evaluate(() => {
  window.__guardLog = [];
  new MutationObserver(() => {
    if (document.documentElement.dataset.rotateGuard) window.__guardLog.push(document.querySelector(".retro-shell")?.dataset.scene || "");
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-rotate-guard"] });
});
const guardLog = (page) => page.evaluate(() => window.__guardLog.slice());

async function playScene(page, id, { chapter = 1, bg = "res://assets/backgrounds/bg_tonari_inside_night.png", file = "" } = {}) {
  await page.evaluate(async ([id, chapter, bg, file]) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter, day: 6, slot: 1 });
    for (const c of ["sumi", "tsumugi", "naru", "minto", "adam", "rio"]) s.met[c] = true;
    // 第2章以降の台本は各章が後から読み込む（起動時は第1章の分だけ）ので、file の台本をここで読む
    const { DB } = await import("./js/core/data.js");
    if (file && !DB.dialogues[id]) {
      const data = await (await fetch(`../data/dialogue/${file}.json`)).json();
      for (const dialogue of data.dialogues) DB.dialogues[dialogue.dialogue_id] ||= dialogue;
    }
    const { play } = await import("./js/vn/engine.js");
    (await import("./js/core/ui.js")).clearScreen();
    window.sceneRun = play(id, bg ? { bg } : {}).catch((error) => { window.sceneError = String(error.stack || error); });
  }, [id, chapter, bg, file]);
  await page.locator("#vn.active .vn-text").waitFor({ state: "attached", timeout: 20000 });
}

/** 第1章 DAY5 の昼の地図を、本物の日常ループ（runDaily）で出す。 */
async function setupDaily(page, { lime = false, coach = false } = {}) {
  await page.evaluate(async ([lime, coach]) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    Object.assign(s.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    if (lime) {
      // LIME の確認用: スミさんの未読の雑談（返信の選択肢つき）と、みんとの既読の履歴
      if (!s.contacts.includes("sumi")) s.contacts.push("sumi");
      s.inbox.push({ id: "look_lime_read", originId: "look_lime_read", day: 4, chapter: 1, read: true, done: true, log: [{ text: "こちらこそ", me: true }],
        msg: { id: "look_lime_read", sender: "minto", type: "chat", messages: ["きのうはありがと！"] } });
      s.inbox.push({ id: "look_lime_fixture", originId: "look_lime_fixture", day: 5, chapter: 1, read: false, done: false, replyState: "waiting", log: [],
        msg: { id: "look_lime_fixture", sender: "sumi", type: "chat", messages: ["今日は雨だな。", "店は昼から開けるから、手が空いたら顔を出してくれ。"],
          replies: [{ text: "了解です。昼に行きます", response: "助かる。", affinity: 0 }, { text: "今日は少し遅れます", response: "無理はするな。", affinity: 0 }] } });
    }
    if (coach) delete s.flags._lime_tut; // LIME の初回の案内（地図の上の吹き出し）を出す
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.dailyRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.dailyError = String(error.stack || error); });
  }, [lime, coach]);
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

const arm = (page) => page.evaluate(async () => {
  const vn = await import("./js/vn/engine.js");
  vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
});
/** 外枠の下（回転案内の下）にある現行のボタンを押す。外枠が上に重なるので DOM の click で押す。 */
const clickDom = (page, id) => page.evaluate((id) => document.querySelector(`[data-test="${id}"]`).click(), id);
/** タイトルの「つづきから」で 1 番の枠を読み込む（保存は各章の seed が作る）。 */
async function loadSlot(page) {
  await page.reload();
  await page.locator(shellFor("title")).waitFor({ timeout: 30000 });
  await page.locator("#boot").waitFor({ state: "detached" });
  await arm(page);
  await page.locator(t("retro-title-load")).tap();
  await page.locator(t("slot-0")).waitFor({ state: "attached" });
  await clickDom(page, "slot-0");
}

/** 地図: 外枠の一覧が現行のピンと同じ行き先・同じ並びで、上の帯に日付とお金。上画面は高解像度の絵。 */
async function assertMapMirrors(page, label, { picture = true } = {}) {
  await page.locator(shellFor("map")).waitFor({ timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'), null, { timeout: 15000 });
  const ids = () => page.evaluate(() => ({
    pins: [...document.querySelectorAll("#screen > :not(.done) .map-pins > .spot-pin")].filter((pin) => pin.style.visibility !== "hidden").map((pin) => pin.dataset.spot),
    rows: [...document.querySelectorAll(".retro-list > .retro-row:not(.retro-row-action)")].map((row) => row.dataset.spot),
  }));
  await page.waitForFunction(() => {
    const pins = [...document.querySelectorAll("#screen > :not(.done) .map-pins > .spot-pin")].filter((pin) => pin.style.visibility !== "hidden").map((pin) => pin.dataset.spot);
    const rows = [...document.querySelectorAll(".retro-list > .retro-row:not(.retro-row-action)")].map((row) => row.dataset.spot);
    return pins.length > 0 && pins.join() === rows.join();
  }, null, { timeout: 10000 }).catch(async () => assert.fail(`${label}: one row per pin ${JSON.stringify(await ids())}`));
  const view = await page.evaluate(() => ({
    names: [...document.querySelectorAll(".retro-list > .retro-row:not(.retro-row-action) .retro-row-name")].map((node) => node.textContent.trim()),
    head: document.querySelector(".retro-maphead").textContent, money: window.__remake.state.money,
  }));
  assert(view.names.every(Boolean), `${label}: every row has a name ${JSON.stringify(view.names)}`);
  assert(/DAY/.test(view.head) && view.head.includes(`¥${view.money.toLocaleString("ja-JP")}`), `${label}: the header band shows the day and money: ${view.head}`);
  await assertShellFits(page, label);
  if (picture) await assertHdTop(page, label);
  assert.equal((await rootState(page)).hint, "none", `${label}: no rotate hint over the map`);
  return (await ids()).pins;
}

/** 第1章をクリアした直後から、第2章の初日（配達の地図）へ。 */
async function seedChapterTwoFirstDay(page) {
  await arm(page);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 1, phase: "cleared", day: 14, slot: 2, money: 45678, stamina: 67 });
    value.owned.push("home_rig_set");
    Object.assign(value.flags, { _ev_midcheck: true, _ch1_preview_seen: true, _minto_name_known: true, _minto_identity_known: true,
      _lime_tut: 1, _lime_opened: true, _intro_dr_kemuri: true });
    value.met = { hajime: true, sumi: true, minto: true, tsumugi: true, dr_kemuri: true };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    (await import("./js/chapters/ch1.js")).setupHooks();
    await (await import("./js/chapters/ch1.js")).showClear();
  });
  // 第1章のクリアの画面（成長のグラフ・次の章へ）も縦長のシートで写り、写しのボタンから第2章へ進む
  await page.locator('.retro-sheet[data-kind="end"] svg').waitFor({ timeout: 20000 });
  await page.locator(t("sheet-end-chapter2")).tap();
}

/** 第2章の DAY2（配達を終えた後の日常）の朝から。 */
async function seedChapterTwoDaily(page) {
  await arm(page);
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: "daily", day: 15, slot: 2, money: 36000, stamina: 100, weatherSeed: 7, lastBaitoDay: 15 });
    value.flags = { _rei_trpg_introduced: true, _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: "complete", titleSeen: true },
      _ch2_city_visit_c_station: true, _lime_tut: 1, _lime_opened: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    value.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    value.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true, ageha: true, kumicho: true, rei: true, volk: true };
    value.contacts = ["sumi", "naru"];
    for (const id of ["ageha", "kumicho", "rei"]) value.flags[`_intro_${id}`] = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    (await import("./js/chapters/ch1.js")).setupHooks();
    void (await import("./js/chapters/ch2.js")).resumeChapterTwo();
  });
}

/** 第3章: 第2章をクリアして東京へ出発した朝の保存（ch3_tokyo_daily.mjs と同じ）。cards は旧い行程（場面カード）の自由時間の前。 */
async function seedChapterThree(page, { cards = false } = {}) {
  await page.evaluate(async (cards) => {
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
    if (cards) Object.assign(value.flags._ch3_intro, { routeVersion: 2, prologueStep: 4 });
    const plan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 3 });
    value.flags._fortune_wander = { chapter: 3, shown: plan.map(() => null), used: plan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    Object.assign(core.state, value); core.save();
    if (cards) core.requestResumeOnBoot();
  }, cards);
}

/** 第4章: ドバイに着いた朝の保存（ch4_dubai_daily.mjs と同じ。到着と宿の場面は読んだ後）。 */
async function seedChapterFour(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const progress = await import("./js/chapters/ch4-progress.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
      _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri"]) value.flags[`_intro_${who}`] = true;
    Object.assign(value.met, { naru: true });
    if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
    value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
    value.flags._ch4.titleSeen = true;
    for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
    value.day += 3;
    if (!progress.departChapterFour(value)) throw new Error("Departure failed");
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    Object.assign(core.state, value); core.save();
  });
}

/** 第5章: 地元の自由行動の日の保存。 */
async function seedChapterFive(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const value = core.newGame();
    Object.assign(value, { chapter: 5, day: 51, slot: 0, phase: "daily", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
    value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch4_cleared: true,
      _ch2_preparation_started: true, _ch2_region: "home", _lime_opened: true, _lime_tut: 1,
      _ch5: { startDay: 51, stage: 2, part: "free", titleSeen: true, read: { ch5_bridge_after_return: true, ch5_opening: true }, scheduleDecision: null,
        aftermath: 0, finale: 0, finaleScenes: null, won: null, secondCup: null },
      _ch5_match_scheduled: false, _ch5_match_started: false, _ch5_after_party: true, _ch5_region_started: true };
    value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
    const plan = (await import("./js/daily/fortune-schedule.js")).fortunePlan({ seed: value.seed, chapter: 5 });
    value.flags._fortune_wander = { chapter: 5, shown: plan.map(() => null), used: plan.map(() => true) };
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig(); core.save();
  });
}

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

  await check("portrait-growth-board-shows-rotate-hint", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await page.locator(t("retro-key-menu")).tap();
    await page.locator(t("sheet-menu-board")).tap();
    await page.locator(t("board-close")).waitFor({ state: "attached", timeout: 15000 });
    // 心得の盤（動かして見る盤・未対応の場面）は小さい横長の画面を出さず、少し待ってから回転案内を出す
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true", null, { timeout: 5000 });
    const open = await rootState(page);
    assert.equal(open.hint, "grid");
    assert.equal(open.shell.hidden, true);
    assert.equal(open.hold, "");
    assert(open.replaced && open.hintText.includes(HINT_TEXT) && open.hintText.includes("端末を横にしてください"), `the hint text is replaced: ${open.hintText}`);
    assert(!open.hintText.includes("お楽しみください"), "the original hint line is hidden");
    assert.equal(await page.locator(t("retro-note")).isVisible(), false, "no extra note on top of the rotate hint");
    // 閉じると外枠へ戻り、案内が消える
    await clickDom(page, "board-close");
    await page.locator(shellFor("map")).waitFor();
    await page.waitForFunction(() => !document.documentElement.dataset.rotateGuard);
    const closed = await rootState(page);
    assert.equal(closed.hint, "none");
    assert.equal(closed.hold, "hold");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-shop-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await watchGuard(page);
    await page.locator(t("retro-row-shop")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await page.locator(t("retro-go")).tap();
    // 入口（1F・2F）→ 1階の売り場。店は縦長のシートで、本体のボタンは売り場のタブ
    await page.locator(t("sheet-shop-enter")).tap({ timeout: 15000 });
    await page.locator('.retro-sheet[data-kind="shop"] [data-test="sheet-shop-checkout"]').waitFor({ timeout: 15000 });
    const keys = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .shop-tabs > .shop-tab")].map((n) => [`shop-${n.dataset.tab}`, String(n.classList.contains("on"))]),
      shell: [...document.querySelectorAll(".retro-key")].map((n) => [n.dataset.key, n.getAttribute("aria-pressed")]),
    }));
    assert.deepEqual(keys.shell, keys.classic);
    const rows = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .shop-body .shop-product")].map((n) => n.dataset.test),
      sheet: [...document.querySelectorAll(".retro-sheet .s-shop-product")].map((n) => n.dataset.test.replace(/^sheet-/, "")),
      art: [...document.querySelectorAll(".retro-sheet .s-shop-product .rs-crop > img")].filter((n) => n.getAttribute("src")).length,
    }));
    assert(rows.classic.length >= 5);
    assert.deepEqual(rows.sheet, rows.classic);
    assert(rows.art >= 5, "the product pictures are mirrored");
    // 商品の詳しい小窓（絵・特徴の帯）も縦長のシートで開いて戻る
    await page.locator(t("sheet-detail-mint")).tap();
    await page.locator(t("sheet-shop-detail-close")).tap();
    // ミントを1箱 → 購入: 元の売り場と同じく所持金が減り、在庫が増える
    const before = await page.evaluate(() => ({ money: window.__remake.state.money, mint: window.__remake.state.flavorStock?.mint || 0 }));
    await page.locator(t("sheet-buy-mint")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="quantity-mint"]').textContent === "1"
      && !document.querySelector('[data-test="sheet-shop-checkout"]').disabled);
    await page.locator(t("sheet-shop-checkout")).tap();
    await page.waitForFunction((money) => window.__remake.state.money < money, before.money);
    const after = await page.evaluate(() => ({ money: window.__remake.state.money, mint: window.__remake.state.flavorStock?.mint || 0 }));
    assert.equal(after.mint, before.mint + 50);
    assert(before.money - after.money > 0 && before.money - after.money <= 3000, `paid one box: ${before.money} → ${after.money}`);
    // 機材の売り場へ（本体のボタン）→ 店を出る
    await page.locator(t("retro-key-shop-equip")).tap();
    await page.waitForFunction(() => document.querySelector("#screen .shop-tab.on")?.dataset.tab === "equip"
      && document.querySelector('[data-test="retro-key-shop-equip"]').getAttribute("aria-pressed") === "true");
    await page.locator(t("sheet-shop-leave")).tap();
    await page.locator(shellFor("map")).waitFor();
    assert.deepEqual(await guardLog(page), [], "no rotate hint in the shop");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-first-errand-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    // 初回の買い出し（レモン・1箱は店の経費）: 案内の順（＋ → 購入 → 店を出る）が写しの金色の枠でも示される
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); core.newGame();
      window.errandLeft = false;
      void (await import("./js/daily/shop.js")).openShop({ errand: "lemon", expense: true, expenseFlag: "_errand_lemon_expensed" }).then(() => { window.errandLeft = true; });
    });
    await page.locator('.retro-sheet[data-kind="shop"] [data-test="sheet-buy-lemon"]').waitFor({ timeout: 15000 });
    await watchGuard(page);
    const target = () => page.evaluate(() => [...document.querySelectorAll('.retro-sheet [data-errand-target="true"]')].map((n) => n.dataset.test));
    await page.waitForFunction(() => document.querySelector('.retro-sheet [data-errand-target="true"]')?.dataset.test === "sheet-buy-lemon");
    await page.locator(t("sheet-buy-lemon")).tap();
    await page.waitForFunction(() => document.querySelector('.retro-sheet [data-errand-target="true"]')?.dataset.test === "sheet-shop-checkout");
    await page.locator(t("sheet-shop-checkout")).tap();
    await page.waitForFunction(() => window.__remake.state.flavorStock?.lemon === 50);
    await page.waitForFunction(() => document.querySelector('.retro-sheet [data-errand-target="true"]')?.dataset.test === "sheet-shop-leave");
    assert.deepEqual(await target(), ["sheet-shop-leave"]);
    assert.deepEqual(await page.evaluate(() => ({ money: window.__remake.state.money, paid: window.__remake.state.flags._errand_lemon_expensed })), { money: 30000, paid: true });
    await page.locator(t("sheet-shop-leave")).tap();
    await page.waitForFunction(() => window.errandLeft);
    assert.deepEqual(await guardLog(page), [], "no rotate hint during the first errand");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-menu-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await watchGuard(page);
    await page.locator(t("retro-key-menu")).tap();
    await page.locator('.retro-sheet[data-kind="menu"]').waitFor();
    // 上画面: ステータスのタブははじめの立ち絵（高解像度）。下画面: 今のタブの中身。本体のボタン: 4つのタブと「閉じる」
    await assertShellFits(page, "menu sheet");
    await assertHdTop(page, "menu sheet");
    const keys = await page.evaluate(() => [...document.querySelectorAll(".retro-key")].map((n) => [n.dataset.key, n.getAttribute("aria-pressed")]));
    assert.deepEqual(keys, [["tab-status", "true"], ["tab-people", "false"], ["tab-items", "false"], ["tab-system", "false"], ["close", null]]);
    assert.equal(await page.locator(".retro-caption").textContent(), "はじめ");
    for (const tab of ["people", "items", "system", "status", "people"]) {
      await page.locator(t(`retro-key-tab-${tab}`)).tap();
      await page.waitForFunction((tab) => document.querySelector(".dmenu").dataset.tab === tab
        && document.querySelector(`[data-test="retro-key-tab-${tab}"]`).getAttribute("aria-pressed") === "true"
        && document.querySelector(".retro-status").textContent.includes(document.querySelector(`.dm-tab[data-tab="${tab}"] .dm-label`).textContent), tab);
      // 写しの中身と元の中身が同じ（ボタン・行の data-test の並び）
      const same = await page.evaluate(() => {
        const tests = (root, prefix = "") => [...root.querySelectorAll("[data-test]")].filter((n) => n.getClientRects().length)
          .map((n) => n.dataset.test.slice(prefix.length)).filter((id) => id.startsWith("menu-") || id.startsWith("recipe-") || id.startsWith("keepsake-"));
        return { classic: tests(document.querySelector(".dmenu .dm-panel")), sheet: tests(document.querySelector(".retro-sheet .rs-body"), "sheet-").filter((id) => id !== "menu-summary" && !id.startsWith("menu-condition")) };
      });
      assert.deepEqual(same.sheet, same.classic, `the ${tab} tab is mirrored`);
    }
    // 人間関係の行を開く（元の行が開き、上画面はその相手）→ もう一度押して閉じる
    await page.locator(t("sheet-menu-person-minto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="menu-person-minto"]').getAttribute("aria-expanded") === "true"
      && document.querySelector('[data-test="sheet-menu-person-minto"]').getAttribute("aria-expanded") === "true");
    await page.locator(t("sheet-menu-person-detail-minto")).waitFor();
    await page.waitForFunction(() => document.querySelector(".retro-caption").textContent === document.querySelector('[data-test="menu-person-minto"] .dm-name').textContent);
    await page.locator(t("sheet-menu-person-minto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="menu-person-minto"]').getAttribute("aria-expanded") === "false");
    await page.locator(t("sheet-menu-person-detail-minto")).waitFor({ state: "detached" }); // 閉じた詳しい欄は写さない
    await page.locator(t("retro-key-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    assert.equal(await page.locator(".dmenu").count(), 0);
    assert.deepEqual(await guardLog(page), [], "no rotate hint while the MENU is open");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-lime-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await watchGuard(page);
    await setupDaily(page, { lime: true, coach: true });
    // 初めての LIME は地図の上の案内（吹き出し）から: 下画面の吹き出しと本体の「LIMEを開く」
    await page.locator('.retro-sheet[data-kind="coach"] [data-test="sheet-coach-lime-bubble"]').waitFor({ timeout: 15000 });
    await page.locator(t("retro-key-lime")).tap();
    // LIME は上下の画面をつないだ縦長のシート: トーク一覧 → 相手 → 返信の選択肢 → 一覧 → 閉じる
    await page.locator('.retro-sheet[data-kind="lime"][data-tall="true"]').waitFor();
    const list = await page.evaluate(() => ({
      classic: [...document.querySelectorAll(".lime-chat .lime-chat-row")].map((n) => [n.dataset.test, n.classList.contains("unread")]),
      sheet: [...document.querySelectorAll(".retro-sheet .s-lime-chat-row")].map((n) => [n.dataset.test.replace(/^sheet-/, ""), n.classList.contains("s-unread")]),
    }));
    assert.deepEqual(list.sheet, list.classic);
    assert(list.sheet.some(([id, unread]) => id === "lime-chat-sumi" && unread), "the unread chat is marked");
    // LIME は実物のメッセージアプリをまねた色の役割（LK20）: ドット調のまま、緑の見出しに白いトーク一覧。
    const tone = (selector) => page.evaluate((selector) => getComputedStyle(document.querySelector(selector)).backgroundColor, selector);
    assert.equal(await tone('.retro-sheet[data-kind="lime"] .rs-head'), "rgb(31, 166, 74)", "LIME の見出しは緑");
    assert.equal(await tone(".retro-sheet .s-lime-chat-row"), "rgb(255, 255, 255)", "トーク一覧の行は白");
    await page.locator(t("sheet-lime-chat-sumi")).tap();
    await page.locator(t("sheet-reply-0")).waitFor({ timeout: 10000 });
    const thread = await page.evaluate(() => ({
      classic: [...document.querySelectorAll(".lime-chat .lime-bubble")].map((n) => n.textContent),
      sheet: [...document.querySelectorAll(".retro-sheet .s-lime-bubble")].map((n) => n.textContent),
      replies: [...document.querySelectorAll(".retro-sheet .s-lime-reply")].map((n) => n.textContent),
    }));
    assert.deepEqual(thread.sheet, thread.classic);
    assert.deepEqual(thread.replies, ["了解です。昼に行きます", "今日は少し遅れます"]);
    await page.locator(t("sheet-reply-0")).tap();
    await page.locator(t("sheet-phone-next")).waitFor({ timeout: 10000 });
    const answered = await page.evaluate(() => ({
      item: window.__remake.state.inbox.find((i) => i.id === "look_lime_fixture"),
      sheet: [...document.querySelectorAll(".retro-sheet .s-lime-row.s-me .s-lime-bubble")].map((n) => n.textContent),
    }));
    assert.equal(answered.item.read, true);
    assert.deepEqual(answered.sheet, ["了解です。昼に行きます"]);
    assert.equal(await tone(".retro-sheet .s-lime-row.s-me .s-lime-bubble"), "rgb(143, 226, 106)", "自分の吹き出しは緑");
    assert.equal(await tone(".retro-sheet .s-lime-row:not(.s-me) .s-lime-bubble"), "rgb(255, 255, 255)", "相手の吹き出しは白");
    await page.locator(t("retro-key-back")).tap();
    await page.locator(t("sheet-phone-close")).waitFor();
    await page.locator(t("retro-key-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    assert.equal(await page.locator(".phone-overlay").count(), 0);
    assert.deepEqual(await guardLog(page), [], "no rotate hint while LIME is open");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-config-slots-and-rules-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await setupDaily(page);
    await page.locator(shellFor("map")).waitFor();
    await watchGuard(page);
    const system = async () => {
      await page.locator(t("retro-key-menu")).tap();
      await page.locator('.retro-sheet[data-kind="menu"]').waitFor();
      await page.locator(t("retro-key-tab-system")).tap();
      await page.locator(t("sheet-menu-config")).waitFor();
    };
    // 設定: 文字の速さの段を写しで押すと、元の段ボタンが押されて保存される
    await system();
    await page.locator(t("sheet-menu-config")).tap();
    await page.locator('.retro-sheet[data-kind="modal"]').waitFor();
    const before = await page.evaluate(async () => (await import("./js/core/state.js")).config.textSpeed);
    const next = before === 2 ? "3" : "2";
    await page.locator(`${t("sheet-cfg-text-speed")} button[value="${next}"]`).tap();
    await page.waitForFunction((next) => document.querySelector(`[data-test="cfg-text-speed"] button[value="${next}"]`).getAttribute("aria-checked") === "true"
      && document.querySelector(`[data-test="sheet-cfg-text-speed"] button[value="${next}"]`).getAttribute("aria-checked") === "true", next);
    const saved = await page.evaluate(async () => ({
      config: (await import("./js/core/state.js")).config.textSpeed,
      stored: JSON.parse(localStorage.getItem("suien_remake_config") || "{}").textSpeed,
    }));
    assert.deepEqual(saved, { config: Number(next), stored: Number(next) });
    // チェックボックスも写しから切り替わり、保存される
    const shake = await page.evaluate(async () => (await import("./js/core/state.js")).config.reduceShake === true);
    await page.locator(t("sheet-cfg-reduce-shake")).tap();
    await page.waitForFunction((shake) => JSON.parse(localStorage.getItem("suien_remake_config") || "{}").reduceShake === !shake, shake);
    await page.waitForFunction((on) => document.querySelector('[data-test="sheet-cfg-reduce-shake"]').getAttribute("aria-checked") === on, String(!shake));
    await page.locator(t("sheet-cfg-reduce-shake")).tap();
    await page.waitForFunction((shake) => JSON.parse(localStorage.getItem("suien_remake_config") || "{}").reduceShake === shake, shake);
    await page.locator(t("sheet-cfg-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    // セーブ／ロードの枠: 元の枠と同じ並びで出て、やめると地図へ（保存はしない）
    await system();
    await page.locator(t("sheet-menu-load")).tap();
    await page.locator(t("sheet-slot-cancel")).waitFor();
    const slots = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#modal .save-slot")].map((n) => [n.dataset.test, n.disabled]),
      sheet: [...document.querySelectorAll(".retro-sheet .s-save-slot")].map((n) => [n.dataset.test.replace(/^sheet-/, ""), n.disabled]),
    }));
    assert(slots.classic.length >= 2);
    assert.deepEqual(slots.sheet, slots.classic);
    await page.locator(t("sheet-slot-cancel")).tap();
    await page.locator(shellFor("map")).waitFor();
    // 大会の規則（読み物の小窓）も縦長のシートで読める
    await system();
    await page.locator(t("sheet-menu-rules")).tap();
    await page.locator(t("sheet-rule-sheet")).waitFor();
    const rules = await page.evaluate(() => ({
      classic: [...document.querySelectorAll('#modal [data-test="rule-sheet"] h3')].map((n) => n.textContent),
      sheet: [...document.querySelectorAll('.retro-sheet [data-test="sheet-rule-sheet"] .rs-h3')].map((n) => n.textContent),
    }));
    assert(rules.classic.length >= 3);
    assert.deepEqual(rules.sheet, rules.classic);
    await page.locator(t("sheet-rule-sheet-close")).tap();
    await page.locator(shellFor("map")).waitFor();
    assert.deepEqual(await guardLog(page), [], "no rotate hint while the settings and slots are open");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-save-transfer-and-levelup-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await page.evaluate(async () => { const core = await import("./js/core/state.js"); const s = core.newGame(); s.money = 12345; core.save(); });
    await watchGuard(page);
    // セーブの引っ越し: 書き出した文字列（読むだけの欄）と、読み込みの入力欄（打つと元の欄へ入る）
    await page.locator(t("retro-title-config")).tap();
    await page.locator(t("sheet-save-export")).tap();
    await page.locator(t("sheet-export-text")).waitFor();
    const exported = await page.evaluate(() => ({
      classic: document.querySelector('#modal [data-test="export-text"]').value,
      sheet: document.querySelector('[data-test="sheet-export-text"]').value,
      readOnly: document.querySelector('[data-test="sheet-export-text"]').readOnly,
    }));
    assert(exported.classic.startsWith("SUIEN-SAVE"));
    assert.equal(exported.sheet, exported.classic);
    assert.equal(exported.readOnly, true);
    await page.locator(t("sheet-export-close")).tap();
    await page.locator(t("sheet-save-import")).tap();
    await page.locator(t("sheet-import-text")).fill(exported.classic);
    await page.waitForFunction((text) => document.querySelector('#modal [data-test="import-text"]').value === text, exported.classic);
    await page.locator(t("sheet-import-go")).tap();
    await page.locator(t("sheet-import-abort")).tap(); // 確認まで進めて、上書きはしない
    await page.locator(t("sheet-cfg-close")).tap();
    await page.locator(shellFor("title")).waitFor();
    assert.equal(await page.evaluate(() => window.__remake.state.money), 12345);
    // 夜のレベルアップ（演出の層の画面）も縦長のシートで写り、写しの OK で閉じる
    await page.evaluate(async () => {
      const g = await import("./js/core/growth.js"); g.gainExp(g.totalExpFor(3));
      window.night = null; void (await import("./js/daily/levelup.js")).presentNightGrowth().then((r) => { window.night = r; });
    });
    await page.locator('.retro-sheet[data-kind="levelup"] [data-test="sheet-levelup-ok"]').waitFor();
    // 数字は元の演出どおり Lv.1 から上がっていく
    assert.match(await page.locator(".retro-sheet .rs-head").textContent(), /^Lv\.[123]$/);
    await page.waitForFunction(() => document.querySelector(".levelup")?.classList.contains("lu-settled-state") || window.night, null, { timeout: 10000 });
    await page.waitForFunction(() => window.night || document.querySelector(".retro-sheet .rs-head")?.textContent === "Lv.3");
    // 検査の共通の仕組み（growth_ack.mjs）が先に元の OK を押すこともある
    if (!(await page.evaluate(() => window.night))) await page.locator(t("sheet-levelup-ok")).tap({ timeout: 3000 }).catch(() => {});
    await page.waitForFunction(() => window.night?.to === 3);
    await page.locator(shellFor("title")).waitFor();
    assert.deepEqual(await guardLog(page), [], "no rotate hint while the save transfer and level-up are open");
  }, { ...TALL, pageEntry: entry });

  await check("portrait-log-in-sheet", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await playScene(page, "ch1_minto_second");
    await page.locator(shellFor("vn")).waitFor();
    for (let i = 0; i < 3; i++) {
      await typed(page);
      const now = await vnText(page);
      await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
      await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text, now);
    }
    await typed(page);
    await watchGuard(page);
    const line = await vnText(page);
    await page.locator(t("retro-key-vn-log")).tap();
    await page.locator('.retro-sheet[data-kind="log"]').waitFor();
    const log = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#vn .vn-log .log-row")].map((n) => n.textContent),
      sheet: [...document.querySelectorAll(".retro-sheet .s-log-row")].map((n) => n.textContent),
    }));
    assert(log.classic.length >= 3);
    assert.deepEqual(log.sheet, log.classic);
    // LOG を開いている間、会話は進まない（下のタップも会話へ届かない）
    await page.locator(".retro-sheet .rs-body").tap({ position: { x: 40, y: 40 } });
    await page.waitForTimeout(800);
    assert.equal(await vnText(page), line);
    await page.locator(t("retro-key-close")).tap();
    await page.locator(shellFor("vn")).waitFor();
    assert.equal(await vnText(page), line);
    // 会話中の設定もシートで開いて閉じる
    await page.locator(t("retro-key-vn-config")).tap();
    await page.locator(t("sheet-cfg-close")).waitFor();
    await page.locator(t("sheet-cfg-close")).tap();
    await page.locator(shellFor("vn")).waitFor();
    assert.equal(await vnText(page), line);
    assert.deepEqual(await guardLog(page), [], "no rotate hint while the log and settings are open");
    assert.equal(await page.evaluate(() => window.sceneError || ""), "");
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
    // 会話の LOG はシートで開き、マウスでも閉じられる
    await typed(page);
    await page.locator(t("retro-key-vn-log")).click();
    await page.locator('.retro-sheet[data-kind="log"]').waitFor();
    await page.locator(t("retro-key-close")).click();
    await page.locator(shellFor("vn")).waitFor();
    // タッチでない縦長の窓では回転案内が出ないので、未対応の場面（心得の盤）は小さい画面＋一言（DS風と同じ）
    await page.evaluate(async () => { window.boardRun = (await import("./js/core/growth.js")).openGrowthBoard(); });
    await page.locator(t("board-close")).waitFor({ timeout: 10000 });
    await page.waitForFunction(() => document.querySelector(".retro-shell").hidden, null, { timeout: 5000 });
    await page.locator(t("retro-note")).waitFor();
    const state = await rootState(page);
    assert.equal(state.hint, "none");
    assert.equal(state.guard, "");
    assert.equal(state.viewportOpacity, "1");
    await page.locator(t("board-close")).click();
    await page.locator(shellFor("vn")).waitFor();
  }, { ...DESK_TALL, pageEntry: entry });

  await check("chapters-two-to-five-conversations-use-the-shell", async (page) => {
    // 各章の保存の章で会話を出す（その章の場所の絵）。新版はどの章でも縦持ちの外枠（DS風は第1章だけ）
    for (const [chapter, file, id, bg] of [
      [2, "ch2_city", "ch2_city_ageha", "res://assets/backgrounds/bg_c_station_lobby.png"],
      [3, "ch3_main", "ch3_opening", "res://assets/backgrounds/bg_mukai_shop.png"],
      [4, "ch4_spots", "ch4_dubai_souq", "res://assets/backgrounds/bg_dubai_souq_day.png"],
      [5, "ch5_tokyo", "ch5_tokyo_park_day", "res://assets/backgrounds/bg_home_day.png"],
    ]) {
      const label = `chapter ${chapter} conversation`;
      if (chapter > 2) await page.reload();
      await page.locator(shellFor("title")).waitFor({ timeout: 30000 });
      await playScene(page, id, { chapter, bg, file });
      await page.locator(shellFor("vn")).waitFor();
      const state = await rootState(page);
      assert.equal(await page.evaluate(() => window.__remake.state.chapter), chapter);
      assert.equal(state.look, "neo", `${label}: stays on the new look`);
      assert.equal(state.paint, "hd", `${label}: the high-resolution shell`);
      assert.equal(state.guard, "", `${label}: no rotate hint`);
      await assertShellFits(page, label);
      await assertHdTop(page, label);
      await typed(page);
      const text = await page.evaluate(() => ({ classic: document.querySelector("#vn .vn-text").textContent, retro: document.querySelector(".retro-vn-text").textContent }));
      assert(text.classic.length > 0);
      assert.equal(text.retro, text.classic, `${label}: the same line`);
      await page.locator(t("retro-bottom")).tap({ position: { x: 60, y: 60 } });
      await page.waitForFunction((text) => document.querySelector("#vn .vn-text").textContent !== text || document.querySelector("#vn .vn-choices.show") || !document.body.classList.contains("in-vn"), text.classic);
      assert.equal(await page.evaluate(() => window.sceneError || ""), "");
    }
  }, { ...TALL, pageEntry: entry });

  await check("chapter-two-first-day-map-delivery-and-store-card", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterTwoFirstDay(page);
    await assertMapMirrors(page, "chapter 2 first day map");
    // 配達先を選んで「行く」→ 配達の会話（幕も外枠のまま）→ 地図へ戻る
    await page.locator(t("retro-row-ageha")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await watchShell(page);
    await page.locator(t("retro-go")).tap();
    // 会話は速送り（vnTest.turbo）で進む。下画面は押さない（押した位置の行・ボタンを選んでしまうため）
    await page.waitForFunction(() => window.__remake.state.flags._ch2_deliveries?.done?.ageha, null, { timeout: 30000 });
    await assertMapMirrors(page, "chapter 2 map after the delivery");
    const log = await shellLog(page);
    assert(log.includes("vn") && !log.includes("off"), `the delivery conversation stays inside the shell: ${log}`);
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_deliveries?.done?.ageha), true, "the delivery is done");
    // 届けた店へもう一度: 店頭のカード（ボタンだけの画面）を下画面の選択肢に写す
    await page.locator(t("retro-row-ageha")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await page.locator(t("retro-go")).tap();
    await page.locator(".retro-submenu[data-kind=\"stop\"]").waitFor({ timeout: 30000 });
    const card = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .ch2-stop .ch2-actions button")].map((n) => [n.dataset.test, n.textContent.trim()]),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => [n.dataset.test.replace(/^retro-/, ""), n.textContent.trim()]),
      title: document.querySelector(".retro-status").textContent, h1: document.querySelector("#screen .ch2-stop h1").textContent,
    }));
    assert(card.classic.length >= 2);
    assert.deepEqual(card.retro, card.classic);
    assert(card.title.includes(card.h1), `the store name is the title: ${card.title}`);
    await page.locator(t("retro-ch2-main-back-map")).tap();
    await assertMapMirrors(page, "chapter 2 map after the store card");
  }, { ...TALL, pageEntry: entry });

  await check("chapter-two-daily-morning-dialog-and-station", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterTwoDaily(page);
    // 朝の行き先の小窓（文と選択肢だけ）は下画面の選択肢に写す
    await page.locator(".retro-submenu[data-kind=\"dialog\"]").waitFor({ timeout: 30000 });
    const dialog = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#modal.show .modal-actions > button")].map((n) => n.textContent.trim()),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => n.textContent.trim()),
      title: document.querySelector(".retro-status").textContent, h3: document.querySelector("#modal.show h3").textContent,
      caption: document.querySelector(".retro-caption").textContent, body: document.querySelector("#modal.show .modal-body").textContent.replace(/\s+/g, " ").trim(),
    }));
    assert.deepEqual(dialog.retro, dialog.classic);
    assert(dialog.title.includes(dialog.h3));
    assert.equal(dialog.caption, dialog.body);
    assert.equal((await rootState(page)).hint, "none");
    await page.locator(t("retro-ch2-morning-home")).tap();
    const home = await assertMapMirrors(page, "chapter 2 home map");
    assert(home.includes("station"), "the station is one of the rows");
    // 駅: 行き先 → 乗車の確認 → 柚ヶ谷の地図（案内の箱のボタンを一覧の先頭に写す）
    await watchShell(page);
    await page.locator(t("retro-row-station")).tap();
    await page.locator(t("retro-action-station-destination-widehanga")).tap();
    await page.locator(t("retro-action-station-confirm")).tap();
    await page.waitForFunction(() => document.querySelector('#screen > :not(.done).map[data-station-arrived="widehanga"]'), null, { timeout: 30000 });
    const city = await assertMapMirrors(page, "chapter 2 widehanga map");
    assert.notDeepEqual(city, home);
    assert.equal(await page.evaluate(() => window.__remake.state.money), 35800);
    const log = await shellLog(page);
    assert(!log.includes("off"), `the train ride stays inside the shell: ${log}`);
  }, { ...TALL, pageEntry: entry });

  await check("chapter-three-rule-sheet-and-tokyo-map", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterThree(page);
    await loadSlot(page);
    // 規則の紙（読み物の小窓）は縦長のシートで読み、写しの「閉じる」で閉じる
    await page.locator(t("rule-sheet")).waitFor({ state: "attached", timeout: 60000 });
    await page.locator(t("sheet-rule-sheet")).waitFor();
    assert.equal((await rootState(page)).guard, "");
    await page.locator(t("sheet-rule-sheet-close")).tap();
    await page.waitForFunction(() => document.querySelector('.map:not(.done) [data-test="pin-ch3_tokyo_mukai"]'), null, { timeout: 60000 });
    await assertMapMirrors(page, "chapter 3 tokyo map");
    assert.equal((await rootState(page)).guard, "");
  }, { ...TALL, pageEntry: entry });

  await check("chapter-three-itinerary-card-and-tokyo-dialog", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterThree(page, { cards: true });
    await page.reload();
    // 場面カード: 見出し・つぎの場所・ボタン（行程の「東京の地図」を含む）を写す
    await page.locator(".retro-submenu[data-kind=\"card\"]").waitFor({ timeout: 40000 });
    const card = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .ch3-wayfinding .ch3-wayfinding-map, #screen main.ch2-contest > .ch2-contest-actions button")]
        .filter((n) => n.getClientRects().length).map((n) => n.dataset.test),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => n.dataset.test.replace(/^retro-/, "")),
      title: document.querySelector(".retro-status").textContent, h1: document.querySelector("#screen .ch2-contest-header h1").textContent,
    }));
    assert(card.classic.length >= 2);
    assert.deepEqual(card.retro, card.classic);
    assert(card.title.includes(card.h1));
    await assertHdTop(page, "chapter 3 card");
    // 東京の地図（最前面の <dialog>）は自分で出る。外枠を引っ込め、回転案内も出さない
    await page.locator(t("retro-ch3-map-open")).tap();
    await page.waitForFunction(() => document.querySelector("dialog[open]") && document.querySelector(".retro-shell").hidden);
    await page.waitForTimeout(800);
    const open = await rootState(page);
    assert.equal(open.hint, "none", "no rotate hint over the Tokyo dialog");
    assert.equal(open.guard, "");
    assert.equal(open.hold, "hold");
    await page.keyboard.press("Escape");
    await page.locator(".retro-submenu[data-kind=\"card\"]").waitFor();
    assert.equal(await page.locator(shellFor("menu")).count(), 1);
  }, { ...TALL, pageEntry: entry });

  await check("chapter-four-dubai-map", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterFour(page);
    await loadSlot(page);
    await page.waitForFunction(() => document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]'), null, { timeout: 60000 });
    await assertMapMirrors(page, "chapter 4 dubai map");
    await page.locator(t("retro-row-ch4_dubai_souq")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="retro-go"]').getAttribute("aria-disabled") === "false");
    await watchShell(page);
    await page.locator(t("retro-go")).tap();
    // スークの会話（速送り）の後、屋台の小窓（文と選択肢だけ）も下画面の選択肢に写す
    await page.locator(".retro-submenu[data-kind=\"dialog\"]").waitFor({ timeout: 30000 });
    const log = await shellLog(page);
    assert(log.includes("vn") && !log.includes("off"), `the trip to the souq stays inside the shell: ${log}`);
    const stall = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#modal.show .modal-actions > button")].map((n) => n.textContent.trim()),
      retro: [...document.querySelectorAll(".retro-menu-list > .retro-option")].map((n) => n.textContent.trim()),
    }));
    assert(stall.classic.length >= 2);
    assert.deepEqual(stall.retro, stall.classic);
    await page.locator(".retro-menu-list > .retro-option").last().tap();
    // 夜の地図の絵（bg_dubai_map_dusk）も写っていること（CI は remake/img の LFS を取得する）
    await assertMapMirrors(page, "chapter 4 map after the souq");
  }, { ...TALL, pageEntry: entry });

  await check("chapter-five-home-map", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    await seedChapterFive(page);
    await loadSlot(page);
    const pins = await assertMapMirrors(page, "chapter 5 home map");
    assert(pins.includes("ch5_to_tokyo"), `the trip to Tokyo is a row: ${pins}`);
  }, { ...TALL, pageEntry: entry });

  await check("chapter-two-look-switching-restores-everything", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    const setLook = (id) => page.evaluate(async (id) => (await import("./js/core/look.js")).setLook(id), id);
    await playScene(page, "ch2_city_ageha", { chapter: 2, bg: "res://assets/backgrounds/bg_c_station_lobby.png", file: "ch2_city" });
    await page.locator(shellFor("vn")).waitFor();
    assert.deepEqual(await residue(page), { shells: 1, notes: 1, hints: 1, attrs: ["retro", "retroShell", "retroHint", "retroPaint"], paint: "hd" });
    // 第2章の DS風は旧版で表示（DS風は第1章だけ）: 外枠も案内の差し替えも残らず、回転案内は元の文
    await setLook("retro");
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell"));
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    assert.deepEqual(await residue(page), { shells: 0, notes: 0, hints: 0, attrs: [], paint: "" });
    let state = await rootState(page);
    assert.equal(state.hint, "grid");
    assert.equal(state.replaced, false);
    assert(state.hintText.includes("横向きでお楽しみください"), `the original hint text is back: ${state.hintText}`);
    assert.equal(state.viewportOpacity, "1");
    // 新版へ戻すと、同じ会話のまま外枠へ戻る
    await setLook("neo");
    await page.locator(shellFor("vn")).waitFor();
    await page.waitForFunction(() => !document.documentElement.dataset.rotateGuard);
    assert.deepEqual(await residue(page), { shells: 1, notes: 1, hints: 1, attrs: ["retro", "retroShell", "retroHint", "retroPaint"], paint: "hd" });
    assert.equal((await rootState(page)).hint, "none");
    await assertHdTop(page, "back to the new look in chapter 2");
    // 旧版: 何も残らない
    await setLook("classic");
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell"));
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    assert.deepEqual(await residue(page), { shells: 0, notes: 0, hints: 0, attrs: [], paint: "" });
    state = await rootState(page);
    assert(state.hintText.includes("横向きでお楽しみください"));
    assert.equal(state.viewportOpacity, "1");
    assert.equal(await page.evaluate(() => window.sceneError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("switching-to-classic-from-the-sheet-leaves-no-trace", async (page) => {
    await page.locator(shellFor("title")).waitFor();
    // 設定をシートで開き、写しの「旧版」を押す → 外枠・シート・写しの部品が残らず、現行の設定の小窓がそのまま開いている
    await page.locator(t("retro-title-config")).tap();
    await page.locator('.retro-sheet[data-kind="modal"]').waitFor();
    await page.locator(`${t("sheet-cfg-look")} button[value="classic"]`).tap();
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic" && !document.querySelector(".retro-shell"));
    assert.deepEqual(await residue(page), { shells: 0, notes: 0, hints: 0, attrs: [], paint: "" });
    assert.equal(await page.evaluate(() => document.querySelectorAll(".retro-sheet, [class*='rs-'], [data-test^='sheet-']").length), 0);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config") || "{}").look), "classic");
    assert.equal(await page.locator(`${t("cfg-look")} button[value="classic"]`).getAttribute("aria-checked"), "true");
    await page.waitForFunction(() => document.documentElement.dataset.rotateGuard === "true");
    // 新版へ戻すと、開いたままの設定が再びシートに写る
    await page.locator(`${t("cfg-look")} button[value="neo"]`).evaluate((node) => node.click());
    await page.locator('.retro-sheet[data-kind="modal"]').waitFor();
    await page.waitForFunction(() => !document.documentElement.dataset.rotateGuard);
    await page.locator(t("sheet-cfg-close")).tap();
    await page.locator(shellFor("title")).waitFor();
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
