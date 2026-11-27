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

/**
 * 土台の配置（VPN09・VPN16）: 下画面の高さと十字キー・丸ボタンの大きさと位置は、試作の会話画面と同じ（幅 39 に対して下画面 30.2・
 * 補助ボタンの段の下 8.2 から十字キー 20.4・丸ボタン 14.6。背の低い画面は試作と同じ段階で縮む）。
 * 十字キーと丸ボタンは場面が替わっても同じ位置（指を置いたまま遊べる）。最初に測った位置を覚え、以後の場面で同じ位置か確かめる。
 */
async function assertPadHome(page, label, home = null) {
  const box = await page.evaluate(() => {
    const r = (selector) => { const b = document.querySelector(selector).getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map((v) => Math.round(v)); };
    const shell = document.querySelector(".vt-shell").getBoundingClientRect(), ctrl = document.querySelector(".vt-ctrl").getBoundingClientRect();
    const u = shell.width / 39, tall = shell.height / u;
    const size = tall > 80 ? [30.2, 8.2, 20.4, 14.6] : tall > 71 ? [27.2, 7.4, 18.2, 13.2] : [23.6, 6.5, 15.4, 11.2];
    return { u, size, ctrlH: ctrl.height, ctrlBottom: shell.bottom - ctrl.bottom, padTop: document.querySelector(".vt-dpad").getBoundingClientRect().top - ctrl.top,
      panel: getComputedStyle(document.querySelector(".vt-ctrl")).backgroundImage, dpad: r(".vt-dpad"), a: r(".vt-a"),
      aShown: getComputedStyle(document.querySelector(".vt-a")).display !== "none", dpadShown: getComputedStyle(document.querySelector(".vt-dpad")).display !== "none" };
  });
  const [ctrlH, padTop, ring, a] = box.size.map((n) => n * box.u);
  assert(Math.abs(box.ctrlH - ctrlH) <= 2 && Math.abs(box.ctrlBottom) <= 1, `${label}: the lower screen is as tall as the prototype's ${JSON.stringify(box)}`);
  assert(Math.abs(box.padTop - padTop) <= 2 && Math.abs(box.dpad[2] - ring) <= 2 && Math.abs(box.a[2] - a) <= 2, `${label}: the pad sits right under the chips like the prototype ${JSON.stringify(box)}`);
  assert.equal(box.panel, "none", `${label}: no board under the pad (the scene shows through like the prototype)`);
  assert(box.aShown && box.dpadShown, `${label}: the pad and the round button stay on screen`);
  if (home) {
    assert.deepEqual(box.dpad, home.dpad, `${label}: the pad stays where the thumb rests`);
    assert.deepEqual(box.a, home.a, `${label}: the round button stays where the thumb rests`);
  }
  return box;
}

/** 第1章 DAY5 の昼の地図を、本物の日常ループ（runDaily）で出す。 */
async function setupDaily(page, { slot = 0, talk = false } = {}) {
  await arm(page);
  await page.evaluate(async ({ slot, talk }) => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    Object.assign(s.affinity, { minto: 40, sumi: 22, naru: 12, tsumugi: 66 });
    // LIME の一覧とトークを見る検査用に、読み終えたトークを1件だけ置く（印や通知は増えない）
    if (talk) s.inbox.push({ id: "vt-talk", originId: "vt-talk", day: 4, chapter: 1, read: true, done: true, log: [{ text: "こちらこそ", me: true }],
      msg: { id: "vt-talk", sender: "minto", type: "chat", messages: ["きのうはありがと！"] } });
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.dailyRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.dailyError = String(error.stack || error); });
  }, { slot, talk });
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
    // タイトルは試作どおり（VPM01・VPM07）: キービジュアルとロゴ、5行のメニュー。十字キーと丸ボタンは置かない
    assert.equal(await page.evaluate(() => document.querySelector(".vt-shell").dataset.layout), "full");
    assert.equal(await page.locator(".vt-tt-item").count(), 5);
    assert.equal(await page.evaluate(() => document.querySelector(".vt-ctrl").getClientRects().length), 0, "no pad on the title");
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
    await assertPadHome(page, "conversation");
  }, { ...TALL, pageEntry: entry });

  await check("map-shop-and-choice", async (page) => {
    await setupDaily(page);
    await assertFits(page, "map");
    const pins = await page.evaluate(() => ({
      live: [...document.querySelectorAll("#screen > .map:not(.done) .map-pins > .spot-pin")].filter((pin) => pin.style.visibility !== "hidden").map((pin) => pin.dataset.spot).sort(),
      mine: [...document.querySelectorAll(".vt-pin")].map((pin) => pin.dataset.spot).sort(),
    }));
    assert.deepEqual(pins.mine, pins.live, "one pin per destination");
    const home = await assertPadHome(page, "map");
    // 看板（VPN10）: 元の地図と同じ店のロゴ・施設の絵を、地図の中に小さく出す
    const signs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".vt-pin")].map((pin) => {
      const art = pin.querySelector(".vt-pin-art > *"), live = document.querySelector(`#screen > .map:not(.done) .spot-pin[data-spot="${pin.dataset.spot}"] .ico > :is(.store-logo, .facility-icon)`);
      const box = pin.querySelector(".vt-pin-art")?.getBoundingClientRect();
      return [pin.dataset.spot, { mine: art?.dataset.storeLogo || art?.dataset.facility || "", live: live?.dataset.storeLogo || live?.dataset.facility || "", w: Math.round(box?.width || 0) }];
    })));
    for (const [id, sign] of Object.entries(signs)) assert.equal(sign.mine, sign.live, `${id}: the pin shows the same logo or facility art as the map ${JSON.stringify(sign)}`);
    for (const id of ["tonari", "minto", "naru", "shop"]) assert(signs[id]?.mine && signs[id].w >= 30 && signs[id].w <= 110, `${id}: a small store logo on the map ${JSON.stringify(signs[id])}`);
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
    // 上＝全体を見る→もう一度で寄る
    await pad(page, "up");
    await page.waitForFunction(() => document.querySelector(".vt-map").classList.contains("overview"));
    await pad(page, "up");
    await page.waitForFunction(() => !document.querySelector(".vt-map").classList.contains("overview"));
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
    await assertPadHome(page, "conversation in the shop", home);
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
    await assertPadHome(page, "choice", home);
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
    await setupDaily(page, { talk: true });
    const home = await assertPadHome(page, "map");
    // 最初の行き先は tonari（「！」の店）。決定 → 行動選び
    await page.waitForFunction(() => document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot === "tonari");
    await pressA(page);
    await waitScene(page, "menu");
    await assertPadHome(page, "tonari menu", home);
    const options = await page.locator(".vt-choice b").allTextContents();
    assert(options.some((text) => text.includes("一服")), `the tonari actions are listed ${JSON.stringify(options)}`);
    assert.match(await page.locator(".vt-where b").textContent(), /tonari/);
    await page.locator(t("vt-chip-back")).tap();
    await waitScene(page, "map");
    // LIME → 試作どおり（VPM07・VPM10）画面いっぱいのアプリ。十字キーと丸ボタンは置かず、LINE寄りの白い一覧と緑の「スマホを閉じる」
    await page.locator(t("vt-chip-lime")).tap();
    await waitScene(page, "sheet");
    const lime = await page.evaluate(() => {
      const shell = document.querySelector(".vt-shell");
      const host = document.querySelector(".vt-sheet-host").getBoundingClientRect(), frame = shell.getBoundingClientRect();
      const row = document.querySelector(".vt-sheet-host .s-lime-chat-row"), close = document.querySelector(".vt-sheet-host .s-lime-reply.s-ghost");
      return { sheet: shell.dataset.sheet, layout: shell.dataset.layout, pad: [".vt-dpad", ".vt-a", ".vt-chips"].map((sel) => document.querySelector(sel).getClientRects().length),
        fill: [host.top - frame.top, frame.bottom - host.bottom], row: row && getComputedStyle(row).backgroundColor, close: close && getComputedStyle(close).backgroundColor };
    });
    assert.equal(lime.sheet, "lime");
    assert.equal(lime.layout, "full", "LIME hides the pad");
    assert.deepEqual(lime.pad, [0, 0, 0], "no pad or chips on LIME");
    assert(lime.fill.every((gap) => Math.abs(gap) <= 1), `LIME fills the frame ${JSON.stringify(lime.fill)}`);
    assert.equal(lime.row, "rgb(255, 255, 255)", "talk list rows are white");
    assert.equal(lime.close, "rgb(6, 199, 85)", "close button is LIME green");
    // 一覧の行 → トーク（青みの背景）→ 戻る → スマホを閉じる で地図へ
    await page.locator(".vt-sheet-host .s-lime-chat-row").first().tap();
    await page.waitForFunction(() => document.querySelector(".vt-sheet-host .s-lime-bubble"));
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".vt-sheet-host .rs-body")).backgroundColor), "rgb(140, 171, 216)");
    await page.locator(".vt-sheet-host .s-lime-back").tap();
    await page.waitForFunction(() => document.querySelector(".vt-sheet-host .s-lime-chat-row"));
    await page.locator(".vt-sheet-host .s-lime-reply.s-ghost").tap();
    await waitScene(page, "map");
    assert.equal(await page.evaluate(() => document.querySelector(".vt-shell").dataset.layout), "", "the pad comes back on the map");
    // MENU → タブが補助ボタンの段に並び、押すと本編のタブが切り替わる
    await page.locator(t("vt-chip-menu")).tap();
    await waitScene(page, "sheet");
    await page.locator(t("vt-chip-tab-people")).tap();
    await page.waitForFunction(() => document.querySelector('#modal .dm-tab[data-tab="people"]')?.getAttribute("aria-selected") === "true");
    // 補助ボタンの段は、本編の変化を次の描画で写し直す（looks/vertical.js の MutationObserver → requestAnimationFrame）。
    // 本編のタブが切り替わった直後はまだ写し直す前のことがある（CI で2回続けて false を読んだ）ので、写し終えるのを待ってから確かめる
    await page.waitForFunction(() => document.querySelector('[data-test="vt-chip-tab-people"]')?.getAttribute("aria-pressed") === "true", null, { timeout: 5000 }).catch(() => {});
    assert.equal(await page.locator(t("vt-chip-tab-people")).getAttribute("aria-pressed"), "true", "the MENU tab chip follows the selected tab");
    await assertFits(page, "menu");
    await assertPadHome(page, "menu sheet", home);
    await pressA(page);
    await waitScene(page, "map");
    // 前の場面転換（tonari から地図へ戻る）から6秒以上たってから別の店へ入っても、転換の間は外枠のまま（回転案内へ落ちない）。
    // 覆いを待つ時間を、覆いに入るたびに数え直していなかった時は、ここで回転案内が一瞬出ていた
    await page.waitForTimeout(6500);
    await pad(page, "down");
    await page.locator(t("vt-row-minto")).tap();
    await page.waitForFunction(() => document.querySelector('.vt-pin[aria-current="true"]')?.dataset.spot === "minto");
    await page.evaluate(() => {
      window.__hintSeen = false;
      window.__hintWatch = setInterval(() => { if (getComputedStyle(document.getElementById("rotate-hint")).display !== "none") window.__hintSeen = true; }, 40);
    });
    await pressA(page);
    await waitScene(page, "vn", 30000);
    assert.equal(await page.evaluate(() => { clearInterval(window.__hintWatch); return window.__hintSeen; }), false, "no rotate hint while entering the shop");
  }, { ...TALL, pageEntry: entry });

  await check("growth-board-with-pad", async (page) => {
    await setupDaily(page);
    const home = await assertPadHome(page, "map");
    await page.evaluate(async () => {
      const growth = await import("./js/core/growth.js");
      const { state } = await import("./js/core/state.js");
      growth.ensureGrowth(state);
      state.growth.hidane.any = 3;
      state.flags._kannon_growth_intro_done = true;
      window.boardRun = growth.openGrowthBoard({ place: "kannon" });
    });
    await waitScene(page, "board");
    // 試作と同じ縦の盤（VPN14）: 上の題・3枚の盤の札・盤・選んでいるマスの札。本編の盤は演出の層に見えないまま開いていて、状態はそこから読む
    await page.locator(".vb .vb-node").first().waitFor({ state: "attached" });
    assert.equal(await page.locator("#fx > .gboard").count(), 1, "the game's board stays open behind the shell");
    assert.equal(await page.locator(".vb-tab").count(), 3);
    await assertFits(page, "board");
    await assertPadHome(page, "board", home);
    const nodes = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__remake?.state?.growth?.nodes || [])));
    const litBefore = await nodes();
    const cursor = () => page.evaluate(() => document.querySelector('.vb-node[aria-pressed="true"]')?.dataset.id || "");
    // 盤の札の数と火種は本編の盤と同じ
    const wallet = await page.evaluate(() => document.querySelector('[data-test="vt-board-wallet"]').textContent.replace(/\s+/g, ""));
    assert.match(wallet, /^3/, `the wallet shows the white fire ${wallet}`);
    // 丸ボタン: カーソルのマス（紋のすぐ上・今灯せる）を灯す（仮置き）。本編の盤にも仮置きが入る
    await page.waitForFunction(() => /灯す|はめる|教わる/.test(document.querySelector('[data-test="vt-a"]')?.textContent || ""));
    const first = await cursor();
    await pressA(page);
    await page.waitForFunction((id) => document.querySelector(`#fx .gb-node[data-test="board-node-${id}"]`)?.dataset.status === "pending", first);
    await page.locator(`.vb-node.s-pending[data-id="${first}"]`).waitFor({ state: "attached" });
    await page.locator(t("vt-board-decide")).waitFor();
    // 十字キーで隣のマスへ（カーソルが動き、本編の盤でも同じマスを選ぶ）
    for (const dir of ["up", "left", "right", "down"]) {
      await pad(page, dir);
      await page.waitForTimeout(250);
      if ((await cursor()) !== first) break;
    }
    const moved = await cursor();
    assert.notEqual(moved, first, "the pad moves to a neighbouring square");
    assert.equal(await page.evaluate(() => document.querySelector("#fx .gb-node.selected")?.dataset.test || ""), `board-node-${moved}`, "the game's board selects the same square");
    // 盤の札を替える（本編の盤の札も替わる）
    await page.locator(t("vt-board-tab-sense")).tap();
    await page.waitForFunction(() => document.querySelector('#fx [data-test="board-tab-sense"]')?.getAttribute("aria-selected") === "true");
    await page.locator(t("vt-board-tab-body")).tap();
    await page.waitForFunction(() => document.querySelector('#fx [data-test="board-tab-body"]')?.getAttribute("aria-selected") === "true");
    // 決定 → 盤が閉じて地図へ。灯したマスが保存されている
    await page.locator(t("vt-board-decide")).tap();
    await page.waitForFunction(() => !document.querySelector(".gboard"), null, { timeout: 15000 });
    await waitScene(page, "map");
    const litAfter = await nodes();
    assert.equal(litAfter.length, litBefore.length + 1, `one square was lit ${JSON.stringify([litBefore, litAfter])}`);
    assert(litAfter.includes(first), "the square lit with the round button is saved");
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
    await assertPadHome(page, "short map");
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
