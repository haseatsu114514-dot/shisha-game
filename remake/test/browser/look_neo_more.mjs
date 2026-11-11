// 新版（neo）で、紙とラベンダーのまま残っていた画面（LK17）。look_neo.mjs が長いので、続きをここに分けた。
// 心得の盤（css/look-neo-board.css）:
//   1. css/look-neo-board.css の全規則が :root[data-look="neo"] の中にある（旧版の見た目に触れない）。
//   2. 見出し・盤の札・右の説明・下の帯・丸い札・ボタンが暗い面と明るい文字になり、紙の絵（ui/paper）を使わない。
//      並び・寸法・文は旧版と同じ（面の色と線だけを替えた）。押せる大きさは旧版以上。1280×720 と横持ちスマホの両方。
//   3. マスを選ぶ→灯す→決定、見方の窓、はじめての案内が、新版でもそのまま使える。
//   4. 盤の面の中（マス・道・紋）の描き方は旧版と同じ。
//   5. 配色テーマ7種のどれでも同じ見た目。旧版へ戻すと、計算済みスタイルが最初から旧版の時と一致する。
// そのほか（css/look-neo.css の 20〜24）:
//   6. 大会の会話の間の MENU・店の人の一言（斧投げBar・クラブSEAM）・章のクリア・リザルト・古い STATUS の窓のタブが、暗い面の上で読める文字になり、
//      紙の絵を使わない。ボタンは押せる。テーマ7種で同じ見た目、旧版へ戻すと元どおり。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, baseURL } from "./support.mjs";

const NEO = `${baseURL}?look=neo`;
const CLASSIC = `${baseURL}?look=classic`;
const THEMES = ["paper", "smoke", "smoke-purple", "cut-paper", "amber", "tissue", "classic"];
const PHONE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const t = (id) => `[data-test="${id}"]`;

// 1. 新版のスタイルシートは、様式が neo の時にしか効かない書き方だけを許す（look_neo.mjs の 6. と同じ決まり）。
{
  const css = fs.readFileSync(new URL("../../css/look-neo-board.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  let count = 0;
  for (const match of css.matchAll(/([^{}]+)\{[^{}]*\}/g)) {
    const prelude = match[1].trim();
    assert(!prelude.startsWith("@"), `想定外の @ 規則: ${prelude}`);
    let depth = 0, start = 0;
    const parts = [];
    for (let i = 0; i < prelude.length; i++) {
      if (prelude[i] === "(") depth++;
      else if (prelude[i] === ")") depth--;
      else if (prelude[i] === "," && depth === 0) { parts.push(prelude.slice(start, i)); start = i + 1; }
    }
    parts.push(prelude.slice(start));
    for (const selector of parts.map((part) => part.trim()).filter(Boolean)) {
      count++;
      assert(selector.startsWith(':root[data-look="neo"] body:not(.game-ds) #stage #fx .gboard'), `盤の中だけに効く書き方で始まらない規則: ${selector}`);
    }
  }
  assert(count > 40, "look-neo-board.css の規則を読めている");
  assert(!/!important/.test(css), "look-neo-board.css は !important に頼らない");
}

const press = (page, locator) => (page.__touch ? locator.tap() : locator.click());
const setLook = (page, look) => page.evaluate(async (look) => (await import("./js/core/look.js")).setLook(look), look);

/** 火種を持った状態で、灯せる盤（静かな場所での内省）を開く。はじめての案内は既定で切ってある（support.mjs）。 */
async function openBoard(page, { hidane = { any: 3, body: 2, sense: 1, wisdom: 0 }, place = "home", tutorial = false } = {}) {
  await page.evaluate(async ({ hidane, place, tutorial }) => {
    // はじめての案内は検査の共通の準備（support.mjs）が切っている。案内を見る検査だけ、開く前に戻す。
    if (tutorial) localStorage.removeItem("suien_board_tutorial");
    const core = await import("./js/core/state.js"), growth = await import("./js/core/growth.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", day: 3, slot: 1, stamina: 90 });
    Object.assign(core.config, { bgmVolume: 0, seVolume: 0 });
    Object.assign(growth.ensureGrowth().hidane, hidane);
    (await import("./js/core/look.js")).refreshLook();
    window.lookBoard = { core, growth, done: null };
    window.lookBoard.done = (await import("./js/daily/growth-board-screen.js")).openBoard({ place });
  }, { hidane, place, tutorial });
  await page.locator(`${t("growth-board")}.show`).waitFor();
  // 盤の絵（.has-art）が読めてから測る（絵が無い環境でも進めるよう、上限つきで待つ）。
  await page.waitForFunction(() => document.querySelector(".gboard.has-art"), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
}

/** 盤の部品を、ステージ上の px と色で測る。 */
const measure = (page) => page.evaluate(() => {
  const stageEl = document.getElementById("stage"), stage = stageEl.getBoundingClientRect(), k = stage.width / stageEl.offsetWidth;
  const rgb = (value) => { const n = (value.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
    return /^color\(srgb/.test(value) ? [...n.slice(0, 3).map((v) => Math.round(v * 255)), ...n.slice(3)] : n; };
  const part = (selector) => {
    const node = document.querySelector(selector);
    if (!node) return null;
    const r = node.getBoundingClientRect(), cs = getComputedStyle(node);
    return { left: (r.left - stage.left) / k, top: (r.top - stage.top) / k, width: r.width / k, height: r.height / k, real: r.height,
      fill: rgb(cs.backgroundColor), face: cs.backgroundImage, frame: cs.borderImageSource, ink: rgb(cs.color), text: node.textContent.replace(/\s+/g, "") };
  };
  const selectors = { root: ".gboard", header: ".gb-header", title: ".gb-title", level: ".gb-level", gauge: ".gb-gauge", place: ".gb-place",
    help: '[data-test="board-help"]', close: '[data-test="board-close"]', tabOn: ".gb-tab.on", tabOff: ".gb-tab:not(.on)", tabHead: ".gb-tab.on .gb-tab-head",
    viewport: '[data-test="board-viewport"]', zoom: '[data-test="board-zoom-in"]', side: ".gb-side", sideTitle: ".gb-p-title", placeChip: ".gb-place-chip", goalName: ".gb-goal-name", goalFire: ".gb-goal-fire b", barSum: ".gb-bar-sum",
    footer: ".gb-footer", wallet: ".gb-wallet", hidane: ".gb-hidane", decide: '[data-test="board-decide"]',
    light: ".gb-light", aim: ".gb-aim", barName: ".gb-bar-name", barLine: ".gb-bar-line" };
  return { look: document.documentElement.dataset.look, art: document.querySelector(".gboard").classList.contains("has-art"),
    ...Object.fromEntries(Object.entries(selectors).map(([key, selector]) => [key, part(selector)])) };
});

const lum = (c) => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const darkFace = (p) => !/ui\/paper/.test(p.face + p.frame) && ((p.fill[3] ?? 1) < .05 ? /rgba?\((\d+), (\d+), (\d+)/.test(p.face) : lum(p.fill) < .3);
const brightInk = (p) => lum(p.ink) > .6;
// 凡例と右の説明の一文は「？」の見方へ移した（SBD117）。代わりに、上の短い札・近い目的地の名前と火種の数・横棒の数字を見る。
const GEOMETRY = ["header", "title", "level", "gauge", "placeChip", "help", "close", "tabOn", "tabOff", "viewport", "zoom", "side", "sideTitle", "goalName", "footer", "wallet", "decide"];

async function boardLook(page, { phone }) {
  await openBoard(page);
  const neo = await measure(page);
  assert.equal(neo.look, "neo");
  // 2. 暗い面と明るい文字。紙の絵を使わない。
  for (const key of ["root", "header", "tabOn", "tabOff", "side", "footer", "wallet", "help", "close", "zoom"]) {
    assert(darkFace(neo[key]), `${key} は暗い面で、紙の絵を使わない ${JSON.stringify(neo[key])}`);
  }
  for (const key of ["title", "level", "place", "tabOn", "sideTitle", "goalName", "goalFire", "barSum", "hidane", "barName", "help", "close"]) {
    assert(brightInk(neo[key]), `${key} の文字は暗い面の上で読める明るさ ${JSON.stringify(neo[key].ink)}`);
  }
  assert(lum(neo.barLine.fill) < .5 || neo.barLine.fill[3] < .3, "能力の線の溝は暗い");
  assert(neo.header.face.includes("227, 189, 110") && neo.sideTitle.face.includes("227, 189, 110") && neo.footer.face.includes("227, 189, 110"), "見出し・説明の見出し・下の帯に金の罫線");
  assert(neo.decide.face.includes("linear-gradient") && !/ui\/paper/.test(neo.decide.face) && lum(neo.decide.ink) < .3, `主のボタンは金の札 ${JSON.stringify(neo.decide)}`);
  if (neo.art) assert(neo.root.face.includes("screen_backdrop"), "背景は夜の店の灯りの絵");
  // 並び・寸法・文は旧版と同じ。
  await setLook(page, "classic");
  await page.waitForTimeout(400);
  const classic = await measure(page);
  assert.equal(classic.look, "classic");
  assert(lum(classic.root.fill) > .7 || /ui\/paper/.test(classic.side.frame), "比べる相手は紙の盤（旧版）");
  for (const key of GEOMETRY) {
    for (const side of ["left", "top", "width", "height"]) {
      // 右の説明の見出しだけ、下に金の罫線を引く分（8px）高い。その下に並ぶ近い目的地は、同じ分だけ下がる。ボタンは縁が 2px→1px に細くなる分（上下・左右で 2px）まで。
      const rule = (key === "sideTitle" && side === "height") || (key === "goalName" && side === "top") ? 8 : 0;
      const slack = key === "decide" ? 2 : 1;
      assert(Math.abs(neo[key][side] - rule - classic[key][side]) <= slack, `${key} の ${side} は旧版と同じ: 新版 ${neo[key][side]} 旧版 ${classic[key][side]}`);
    }
    assert.equal(neo[key].text, classic[key].text, `${key} の文は旧版と同じ`);
  }
  await setLook(page, "neo");
  await page.waitForTimeout(400);
  // 押せる大きさ: ステージ上で 44px 以上。画面上の実寸は旧版と同じ（横持ちスマホではステージごと縮む）。
  for (const key of ["help", "close", "decide"]) {
    assert(neo[key].height >= 44 - .5 && neo[key].real >= classic[key].real - (key === "decide" ? 2 : .5) && (phone || neo[key].real >= 44 - .5), `${key} の押せる大きさ ${JSON.stringify(neo[key])}`);
  }

  // 3. マスを選ぶ → 灯す → 決定。
  const before = await page.evaluate(() => ({ any: window.lookBoard.core.state.growth.hidane.any, nodes: window.lookBoard.core.state.growth.nodes.length }));
  await press(page, page.locator(".gb-node.s-available").first());
  await page.locator(".gb-light").waitFor();
  const picked = await measure(page);
  assert(picked.light.face.includes("linear-gradient") && lum(picked.light.ink) < .3, "灯すは金の札");
  assert(darkFace(picked.aim) && brightInk(picked.aim), `目標にするは夜紫の札 ${JSON.stringify(picked.aim)}`);
  assert(picked.light.height >= 44 - .5 && picked.aim.height >= 44 - .5, "右の説明のボタンの押せる大きさ");
  assert(await page.locator(".gb-side").evaluate((node) => node.scrollHeight <= node.clientHeight + 1), "マスの説明とボタンが、右の説明の面に送らずに収まる");
  await press(page, page.locator(".gb-light"));
  await page.locator(".gb-node.s-pending").waitFor();
  assert.match(await page.locator(t("board-decide")).textContent(), /決定（1）/);
  await press(page, page.locator(t("board-decide")));
  await page.locator(t("growth-board")).waitFor({ state: "detached" });
  const after = await page.evaluate(() => ({ any: window.lookBoard.core.state.growth.hidane.any, nodes: window.lookBoard.core.state.growth.nodes.length }));
  assert.equal(after.nodes, before.nodes + 1, "決定でマスが1つ灯る");
  assert.equal(after.any, before.any - 1, "白火が1つ減る");

  // 見方の窓（モーダル）も夜紫の面。閉じられる。
  await openBoard(page, { hidane: { any: 0, body: 0, sense: 0, wisdom: 0 } });
  await press(page, page.locator(t("board-help")));
  const help = await page.locator("#modal .modal-box.gboard-help").evaluate((node) => {
    const cs = getComputedStyle(node);
    return { face: cs.backgroundImage, frame: cs.borderImageSource, ink: (cs.color.match(/[\d.]+/g) || []).map(Number) };
  });
  assert(help.face.includes("rgba(36, 22, 55") && !/ui\/paper/.test(help.frame) && lum(help.ink) > .6, `見方の窓は夜紫の面 ${JSON.stringify(help)}`);
  await press(page, page.locator('#modal .modal-box.gboard-help [data-test="board-help-close"]'));
  await page.locator("#modal .modal-box.gboard-help").waitFor({ state: "detached" });
  await press(page, page.locator(t("board-close")));
  await page.locator(t("growth-board")).waitFor({ state: "detached" });
}

/** すべての計算済みスタイルを写し取る（旧版との一致・テーマの一致を比べる）。 */
const stylesOf = (page, targets, { variables = true } = {}) => page.evaluate(({ targets, variables }) => {
  // 明滅（今灯せるマス）などの動きは、同じ瞬間（始まり）に止めてから写す。切り替えの途中の変化は終わらせる。
  for (const animation of document.getAnimations()) {
    if (animation instanceof CSSTransition) animation.finish();
    else { animation.pause(); animation.currentTime = 0; }
  }
  const snapshot = {};
  for (const [selector, pseudos] of targets) {
    const node = document.querySelector(selector);
    if (!node) { snapshot[selector] = null; continue; }
    for (const pseudo of pseudos) {
      const style = getComputedStyle(node, pseudo || null);
      const values = {};
      for (const property of style) if (variables || !property.startsWith("--")) values[property] = style.getPropertyValue(property);
      snapshot[selector + pseudo] = values;
    }
  }
  return snapshot;
}, { targets, variables });
const ALL = ["", "::before", "::after"];
// 新版で面を替える部品。
const CHROME = [[".gboard", [""]], [".gb-header", [""]], [".gb-title", [""]], [".gb-level", [""]], [".gb-gauge", [""]], [".gb-gauge b", [""]], [".gb-place", [""]],
  ['[data-test="board-help"]', [""]], ['[data-test="board-zoom-in"]', [""]], [".gb-tab.on", [""]], [".gb-tab:not(.on)", [""]], [".gb-tab.on .gb-tab-head", [""]], [".gb-tab:not(.on) .gb-tab-head", [""]],
  [".gb-tab-line", [""]], ['[data-test="board-viewport"]', [""]], [".gb-side", ALL], [".gb-p-title", [""]], [".gb-place-chip", [""]], [".gb-goal", [""]], [".gb-goal-name", [""]], [".gb-goal-fire b", [""]], [".gb-bar-name", [""]], [".gb-bar-line", [""]], [".gb-bar-line b", [""]],
  [".gb-bar-sum", [""]], [".gb-footer", [""]], [".gb-wallet", [""]], [".gb-hidane", [""]], [".gb-hidane b", [""]], [".gb-hidane i", [""]],
  ['[data-test="board-decide"]', [""]]];
// 盤の面の中（新版でも旧版と同じ描き方のまま）。
const INSIDE = [[".gb-node.s-available .gb-face", ALL], [".gb-node.s-available .gb-glyph", [""]], [".gb-node.gate .gb-face", ALL], [".gb-node.skill .gb-face", ALL], [".gb-node.lesson .gb-face", ALL],
  [".gb-path", [""]], [".gb-hub", [""]], [".gb-hub-text", [""]], [".gb-cost", [""]]];

// ---------------------------------------------------------------- 6. そのほかの画面
/** 文字の色と、その下にある面の色（透明なら親をたどる）を読む。面が絵（グラデーション）の時は最初の色を面の色とみなす。 */
const inkOn = (page, selector) => page.locator(selector).first().evaluate((node) => {
  const nums = (value) => { const n = (value.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
    return /^color\(srgb/.test(value) ? [...n.slice(0, 3).map((v) => Math.round(v * 255)), ...n.slice(3)] : n; };
  const ink = nums(getComputedStyle(node).color);
  let face = null, art = "";
  for (let up = node; up && !face; up = up.parentElement) {
    const cs = getComputedStyle(up);
    art += cs.backgroundImage + cs.borderImageSource;
    const gradient = /gradient\(.*?(rgba?\([^)]+\))/.exec(cs.backgroundImage);
    const fill = nums(cs.backgroundColor);
    if (gradient) face = nums(gradient[1]);
    else if ((fill[3] ?? 1) > .3) face = fill;
  }
  const stageEl = document.getElementById("stage"), stage = stageEl.getBoundingClientRect(), r = node.getBoundingClientRect();
  return { ink, face: face || [0, 0, 0], art, text: node.textContent.replace(/\s+/g, ""), height: r.height / (stage.width / stageEl.offsetWidth),
    inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 };
});
/** 暗い面の上の明るい文字（または金の札の上の濃い文字）で、紙の絵を使っていない。 */
function assertReadable(part, label, { gold = false } = {}) {
  assert(!/ui\/paper/.test(part.art), `${label}: 紙の絵を使わない`);
  if (gold) assert(lum(part.face) > .55 && lum(part.ink) < .3, `${label}: 金の札に濃い文字 ${JSON.stringify(part)}`);
  else assert(lum(part.face) < .32 && lum(part.ink) > .58, `${label}: 暗い面に明るい文字 ${JSON.stringify(part)}`);
}

/** 第1章の日常の状態を作る（店の人と会っていて、会話は早送り）。 */
const seedDaily = (page, extra = {}) => page.evaluate(async (extra) => {
  const core = await import("./js/core/state.js");
  const s = core.newGame();
  Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 1, money: 42000, stamina: 80 }, extra);
  for (const id of ["sumi", "maki", "hiyori", "minto"]) { s.met[id] = true; s.flags[`_intro_${id}`] = true; }
  Object.assign(s.flags, { _axe_bar_rumor_done: true, _hiyori_meeting_done: true, _axe_bar_sighting_done: true, _axe_bar_sighting_day: 3 });
  s.keepsakes = ["minto_first_cheki"];
  Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0 });
  (await import("./js/vn/engine.js")).vnTest.turbo = true;
  (await import("./js/core/look.js")).refreshLook();
  (await import("./js/core/ui.js")).clearScreen();
  window.lookMore = { core };
}, extra);
/** 会話を送って、目当ての部品が出るまで進める。 */
async function readUntil(page, selector) {
  for (let i = 0; i < 120 && !(await page.locator(selector).count()); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(120); }
  await page.locator(selector).waitFor();
  await page.waitForTimeout(500);
}
const openAxeBar = async (page) => {
  await seedDaily(page);
  await page.evaluate(async () => { window.lookMore.left = false; void (await import("./js/daily/axe-bar.js")).visitAxeBar().then(() => { window.lookMore.left = true; }); });
  await readUntil(page, t("axe-bar-menu"));
};
const openDjClub = async (page) => {
  await seedDaily(page, { chapter: 3 });
  await page.evaluate(async () => { window.lookMore.left = false; void (await import("./js/daily/dj-club.js")).visitDjClub().then(() => { window.lookMore.left = true; }); });
  await readUntil(page, t("dj-club-menu"));
};
const openClear = async (page) => {
  await seedDaily(page, { phase: "cleared" });
  await page.evaluate(async () => { void (await import("./js/chapters/ch1.js")).showClear(); });
  await page.locator("#screen .end-screen.clear .end-actions .btn").first().waitFor();
  await page.waitForTimeout(1800);
};
const openResult = async (page) => {
  await seedDaily(page);
  await page.evaluate(async () => {
    const { state } = window.lookMore.core;
    Object.assign(state, { cycle: 2, playMsFull: false, playMs: 123 * 3600000 + 4 * 60000, money: 1234567, lovers: ["minto", "tsumugi"] });
    void (await import("./js/scenes/result.js")).playResult(state, { match: { won: false, tally: { hajime: 14, machine: 16 } } });
  });
  await page.locator(t("result")).waitFor();
  await page.waitForTimeout(1000);
};
const openStatus = async (page) => {
  await seedDaily(page);
  await page.evaluate(async () => { (await import("./js/daily/status.js")).openStatus(); });
  await page.locator("#modal .st-tab").first().waitFor();
  await page.waitForTimeout(400);
};

/** 大会の会話の間の MENU（第2・3章）。大会の進行は ch2_tournament.mjs などが見るので、ここでは同じ部品だけを HUD に置いて見た目を確かめる。 */
const openTournamentMenu = async (page) => {
  await seedDaily(page);
  await page.evaluate(() => {
    const hud = document.getElementById("hud"), wrap = document.createElement("div"), button = document.createElement("button");
    wrap.className = "ch2-tournament-vn-menu";
    button.className = "btn ch2-tournament-menu"; button.type = "button"; button.textContent = "MENU";
    button.addEventListener("click", () => { window.lookMore.menuPressed = true; });
    wrap.append(button); hud.replaceChildren(wrap); hud.classList.add("show");
  });
  await page.waitForTimeout(300);
};

async function leftovers(page) {
  // 大会の会話の間の MENU: 白い紙の札ではなく夜紫の札。押せる。
  await openTournamentMenu(page);
  const menu = await inkOn(page, "#hud .ch2-tournament-vn-menu .btn");
  assertReadable(menu, "大会の MENU");
  assert(menu.height >= 44 - .5 && menu.inside, `大会の MENU の押せる大きさ ${JSON.stringify(menu)}`);
  await press(page, page.locator("#hud .ch2-tournament-vn-menu .btn"));
  assert.equal(await page.evaluate(() => window.lookMore.menuPressed), true, "大会の MENU を押せる");
  await page.evaluate(() => { const hud = document.getElementById("hud"); hud.replaceChildren(); hud.classList.remove("show"); });

  // 斧投げBar: 店の人の一言は夜紫の札。選んでいる部門は金の札。
  await openAxeBar(page);
  assertReadable(await inkOn(page, ".axe-bar-menu .venue-host-copy p"), "斧投げBarの店の人の一言");
  assertReadable(await inkOn(page, ".axe-bar-menu .venue-host-copy strong"), "斧投げBarの店の人の名前");
  assertReadable(await inkOn(page, ".axe-bar-menu .axe-bar-division-label"), "部門の見出し");
  assertReadable(await inkOn(page, ".axe-bar-menu .axe-bar-division-note"), "部門の説明");
  assertReadable(await inkOn(page, ".axe-bar-menu .axe-bar-lesson"), "教わるの札");
  assertReadable(await inkOn(page, '.axe-bar-menu .axe-bar-divisions .btn[aria-pressed="true"]'), "選んでいる部門", { gold: true });
  assertReadable(await inkOn(page, '.axe-bar-menu .axe-bar-divisions .btn[aria-pressed="false"]'), "選んでいない部門");
  const other = page.locator('.axe-bar-menu .axe-bar-divisions .btn[aria-pressed="false"]').first();
  const label = await other.textContent();
  await press(page, other);
  assert.equal(await page.locator('.axe-bar-menu .axe-bar-divisions .btn[aria-pressed="true"]').textContent(), label, "部門を選び直せる");
  await press(page, page.locator(t("axe-bar-back")));
  await page.waitForFunction(() => window.lookMore.left, null, { timeout: 15000 });

  // クラブSEAM: 同じ札。
  await openDjClub(page);
  assertReadable(await inkOn(page, ".dj-club-menu .venue-host-copy p"), "クラブSEAMの店の人の一言");
  assertReadable(await inkOn(page, ".dj-club-menu .venue-host-copy strong"), "クラブSEAMの店の人の名前");
  await press(page, page.locator(t("dj-club-back")));
  await page.waitForFunction(() => window.lookMore.left, null, { timeout: 15000 });

  // 章のクリア: 次の章へは金の札、タイトルへは夜紫の札。
  await openClear(page);
  const next = await inkOn(page, "#screen .end-screen.clear .end-actions .btn.primary"), home = await inkOn(page, '#screen .end-screen.clear [data-test="end-title"]');
  assertReadable(next, "次の章へ", { gold: true });
  assertReadable(home, "タイトルへ");
  assert(next.height >= 44 - .5 && home.height >= 44 - .5 && next.inside && home.inside, "章のクリアのボタンの押せる大きさ");

  // リザルト: 夜紫の面。数字と見出しが読める。
  await openResult(page);
  const panel = await page.locator(".result-panel").evaluate((node) => {
    const cs = getComputedStyle(node), stage = document.getElementById("stage").getBoundingClientRect(), r = node.getBoundingClientRect();
    return { face: cs.backgroundImage, frame: cs.borderImageSource, inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
  });
  assert(panel.face.includes("rgba(36, 22, 55") && !/ui\/paper/.test(panel.frame) && panel.inside, `リザルトは夜紫の面でステージの中 ${JSON.stringify(panel)}`);
  for (const selector of [".result-title", ".result-label", ".result-hero-value", ".result-value"]) assertReadable(await inkOn(page, `.result-panel ${selector}`), `リザルトの ${selector}`);
  assertReadable(await inkOn(page, ".result-panel .result-next"), "リザルトのボタン", { gold: true });

  // 古い STATUS の窓のタブ: 選んでいないタブも読める。選んだタブは金。
  await openStatus(page);
  assertReadable(await inkOn(page, "#modal .st-tab:not(.on)"), "選んでいないタブ");
  assertReadable(await inkOn(page, "#modal .st-tab.on"), "選んでいるタブ", { gold: true });
  await press(page, page.locator("#modal .st-tab").last());
  await page.locator("#modal .keepsake-card").waitFor();
  assertReadable(await inkOn(page, "#modal .st-tab.on"), "選び直したタブ", { gold: true });
  assertReadable(await inkOn(page, "#modal .keepsake-card span"), "思い出の品の札");
}

const AXE_PARTS = [[".axe-bar-menu .venue-host", [""]], [".axe-bar-menu .venue-host-copy small", [""]], [".axe-bar-menu .venue-host-copy strong", [""]], [".axe-bar-menu .venue-host-copy p", [""]],
  [".axe-bar-menu .axe-bar-lesson", [""]], [".axe-bar-menu .axe-bar-division-label", [""]], [".axe-bar-menu .axe-bar-division-note", [""]],
  ['.axe-bar-menu .axe-bar-divisions .btn[aria-pressed="true"]', [""]], [".axe-bar-menu .axe-bar-records", [""]]];
const CLEAR_PARTS = [["#screen .end-screen.clear .end-actions .btn.primary", [""]], ['#screen .end-screen.clear [data-test="end-title"]', [""]]];
const RESULT_PARTS = [[".result-panel", ALL], [".result-title", [""]], [".result-label", [""]], [".result-hero-value", [""]], [".result-value", [""]], [".result-grid", [""]], [".result-next", [""]]];
const STATUS_PARTS = [["#modal .st-tab.on", [""]], ["#modal .st-tab:not(.on)", [""]]];
const LEFTOVERS = [[openTournamentMenu, [["#hud .ch2-tournament-vn-menu .btn", [""]]], "#hud .ch2-tournament-vn-menu .btn"], [openAxeBar, AXE_PARTS, ".axe-bar-menu .venue-host"], [openClear, CLEAR_PARTS, '#screen .end-screen.clear [data-test="end-title"]'],
  [openResult, RESULT_PARTS, ".result-panel"], [openStatus, STATUS_PARTS, "#modal .st-tab:not(.on)"]];

await suite("look-neo-more", async (check) => {
  await check("board-desktop", (page) => boardLook(page, { phone: false }), { pageEntry: NEO });
  await check("board-phone", async (page) => {
    page.__touch = true;
    await page.waitForFunction(() => document.documentElement.dataset.density === "phone");
    await boardLook(page, { phone: true });
  }, { pageEntry: NEO, ...PHONE });

  await check("board-tutorial", async (page) => {
    // はじめての案内: 吹き出しは夜紫の面。光っているマスを押して灯すところまで進める。
    await openBoard(page, { hidane: { any: 0, body: 0, sense: 0, wisdom: 0 }, tutorial: true });
    const bubble = page.locator(".gb-tutorial-bubble");
    await bubble.waitFor();
    const look = await bubble.evaluate((node) => {
      const cs = getComputedStyle(node), stage = document.getElementById("stage").getBoundingClientRect(), r = node.getBoundingClientRect();
      return { face: cs.backgroundImage, fill: cs.backgroundColor, ink: (cs.color.match(/[\d.]+/g) || []).map(Number),
        inside: r.left >= stage.left - 1 && r.right <= stage.right + 1 && r.top >= stage.top - 1 && r.bottom <= stage.bottom + 1 };
    });
    assert(look.face.includes("rgba(36, 22, 55") && lum(look.ink) > .6 && look.inside, `案内の吹き出しは夜紫の面でステージの中 ${JSON.stringify(look)}`);
    for (let n = 0; n < 3; n++) await page.locator(t("board-tutorial-next")).click();
    await page.locator(".gb-node.s-available").first().click();
    await page.locator(".gb-light").click();
    await page.locator(".gb-node.s-pending").waitFor();
  }, { pageEntry: NEO });

  await check("board-same-in-every-ui-theme", async (page) => {
    await openBoard(page);
    await page.locator(".gb-node.s-available").first().click();
    await page.locator(".gb-light").waitFor();
    const parts = [...CHROME.filter(([selector]) => !/gb-bar|gb-goal/.test(selector)), [".gb-light", [""]], [".gb-aim", [""]], [".gb-p-state", [""]], ...INSIDE];
    const read = async (theme) => {
      await page.evaluate((theme) => { document.documentElement.dataset.uiTheme = theme; document.activeElement?.blur(); }, theme);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      // 見た目を決める値だけを比べる（配色テーマの変数そのものは、盤の外の画面で使うので変わってよい）。
      return stylesOf(page, parts, { variables: false });
    };
    const paper = await read("paper");
    for (const [selector] of parts) assert(paper[selector] !== null, `比べる部品がある: ${selector}`);
    for (const theme of THEMES.slice(1)) {
      const themed = await read(theme);
      for (const key of Object.keys(paper)) assert.deepEqual(themed[key], paper[key], `${theme}: ${key} が紙とラベンダーの時と同じ`);
    }
  }, { pageEntry: NEO });

  await check("board-restore-classic", async (page) => {
    // 最初から旧版で盤を開いて基準を取り、新版→旧版と往復しても計算済みスタイルが戻ること。盤の面の中は新版でも同じ。
    await openBoard(page);
    await page.mouse.move(2, 2);
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
    const before = await stylesOf(page, [...CHROME, ...INSIDE]);
    for (const [selector] of [...CHROME, ...INSIDE]) assert(before[selector] !== null, `基準の部品がある: ${selector}`);
    await setLook(page, "neo");
    await page.waitForTimeout(500);
    const neo = await stylesOf(page, [...CHROME, ...INSIDE]);
    for (const key of [".gboard", ".gb-header", ".gb-side", ".gb-footer", ".gb-tab:not(.on)", '[data-test="board-decide"]']) assert.notDeepEqual(neo[key], before[key], `新版では ${key} が変わる`);
    // 盤の面の中は、変数（新版の色の定義が継がれる）を除いた計算済みの値が旧版と同じ。
    const plain = (styles) => Object.fromEntries(Object.entries(styles).filter(([property]) => !property.startsWith("--")));
    for (const [selector, pseudos] of INSIDE) for (const pseudo of pseudos) assert.deepEqual(plain(neo[selector + pseudo]), plain(before[selector + pseudo]), `盤の面の中（${selector}${pseudo}）は新版でも同じ描き方`);
    await setLook(page, "classic");
    await page.waitForTimeout(500);
    const after = await stylesOf(page, [...CHROME, ...INSIDE]);
    for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${key} の計算済みスタイルが最初から旧版の時と一致する`);
  }, { pageEntry: CLASSIC });

  await check("leftovers-desktop", (page) => leftovers(page), { pageEntry: NEO });
  await check("leftovers-phone", async (page) => {
    page.__touch = true;
    await page.waitForFunction(() => document.documentElement.dataset.density === "phone");
    await leftovers(page);
  }, { pageEntry: NEO, ...PHONE });

  await check("leftovers-same-in-every-ui-theme", async (page) => {
    for (const [open, parts] of LEFTOVERS) {
      await open(page);
      const read = async (theme) => {
        await page.evaluate((theme) => { document.documentElement.dataset.uiTheme = theme; document.activeElement?.blur(); }, theme);
        await page.mouse.move(2, 2);
        await page.waitForTimeout(300);
        return stylesOf(page, parts, { variables: false });
      };
      const paper = await read("paper");
      for (const [selector] of parts) assert(paper[selector] !== null, `比べる部品がある: ${selector}`);
      for (const theme of THEMES.slice(1)) {
        const themed = await read(theme);
        for (const key of Object.keys(paper)) assert.deepEqual(themed[key], paper[key], `${theme}: ${key} が紙とラベンダーの時と同じ`);
      }
      await page.evaluate(() => { document.documentElement.dataset.uiTheme = "paper"; });
    }
  }, { pageEntry: NEO });

  await check("leftovers-restore-classic", async (page) => {
    // 最初から旧版で開いて基準を取り、新版→旧版と往復しても計算済みスタイルが戻ること。
    for (const [open, parts, changed] of LEFTOVERS) {
      await open(page);
      await page.mouse.move(2, 2);
      await page.waitForTimeout(300);
      assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "classic");
      const before = await stylesOf(page, parts);
      for (const [selector] of parts) assert(before[selector] !== null, `基準の部品がある: ${selector}`);
      await setLook(page, "neo");
      await page.waitForTimeout(500);
      assert.notDeepEqual((await stylesOf(page, parts))[changed], before[changed], `新版では ${changed} が変わる`);
      await setLook(page, "classic");
      await page.waitForTimeout(500);
      const after = await stylesOf(page, parts);
      for (const key of Object.keys(before)) assert.deepEqual(after[key], before[key], `${key} の計算済みスタイルが最初から旧版の時と一致する`);
    }
  }, { pageEntry: CLASSIC });
// 検査の共通の仕掛け（growth_ack.mjs）は灯せる盤の「閉じる」をすぐ押すので、ここでは切って自分で操作する。
}, { acknowledgeGrowth: false });
