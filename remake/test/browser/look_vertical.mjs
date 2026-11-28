// 様式「縦画面」（煙の舞台・C案。js/looks/vertical.js・要望台帳 VPN）: 縦持ちで、本編を縦の外枠に写して遊ぶ（第1章から作り、VPN17 で全章へ）。
// 確かめること: タイトル→会話（本編の会話の箱が縦のテロップと同じ比の幅になり、2行ずつ送れる）、返事の中継、
// 地図（左右で隣の店・一覧・決定で店に入る）、tonari の行動選び、LIME・MENU のシート、心得の盤（縦の外枠へ移して十字キーと丸ボタンで灯す・決定）、
// 登場カットインの縦のポスター、シーシャ作りの詰め方・蒸らし時間は縦の作る場面（外枠の札・ボタンを本編へ中継して工程が進む・VPN30。
// 本編の操作の説明はスミさんの説明のスポットライトで、段ごとに指す所を明るく抜く・VPN32）、
// 水入れ・穴あけ・炭焼きも縦の作る場面（外枠の長押しを本編のボタンへ pointerdown／pointerup で中継し、炭は押した瞬間に本編の炭を取る。
// 工程の結果の札も外枠で閉じる・VPN31。初回の説明のスポットライトは工程の部品を順に指す・VPN32）、
// まだ縦にしていない場面（シーシャ作りのほかの工程）は回転案内、横持ちは旧版、様式を替えると何も残らない、
// 第2〜5章の日常（朝の小窓・地図・駅から隣町・場面カード・東京の地図の小窓・第5章の地図）も縦の外枠のまま。
// 自動操作のブラウザの既定は旧版なので ?look=vertical を付けて選ぶ。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";
import { arm, seedChapterTwoDaily, seedChapterThree, seedChapterFive } from "./look_chapter_seeds.mjs";

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

/**
 * 作る場面のスミさんの説明のスポットライト（VPN32）の段: 画面全体を暗い幕で覆い、抜いた所が指す要素（target のセレクタに合う全部）を囲み、
 * 吹き出しが抜いた所と重ならず、一言が2行までで、段の点が段の数だけあること。live を渡すと、一言が本編の説明の文にあるかも見る。
 * 段が替わると抜く所が滑らかに動くので、指す要素を囲むまで待ってから測る。
 */
async function expectSpot(page, { index, count, target, say, live = "", last = false }) {
  const label = `spotlight ${index}/${count} (${target})`;
  await page.waitForFunction(({ index, target }) => {
    const root = document.querySelector('[data-test="vt-craft-tut"]');
    if (!root || root.hidden || root.dataset.index !== String(index)) return false;
    const shell = root.getBoundingClientRect(), holeNode = document.querySelector('[data-test="vt-craft-tut-hole"]'), hole = holeNode.getBoundingClientRect();
    const aims = [...document.querySelectorAll(target)].map((node) => node.getBoundingClientRect()).filter((r) => r.width && r.height);
    if (!aims.length) return false;
    // 抜く所が動き終わっている（置いた位置に着いている）
    const at = ["left", "top", "width", "height"].map((k) => parseFloat(holeNode.style[k]));
    if (Math.abs(hole.left - shell.left - at[0]) > 1 || Math.abs(hole.top - shell.top - at[1]) > 1 || Math.abs(hole.width - at[2]) > 1 || Math.abs(hole.height - at[3]) > 1) return false;
    // 指す要素（画面の外にはみ出す分は除く）を、抜いた所が囲む
    const aim = { left: Math.max(shell.left, Math.min(...aims.map((r) => r.left))), top: Math.max(shell.top, Math.min(...aims.map((r) => r.top))),
      right: Math.min(shell.right, Math.max(...aims.map((r) => r.right))), bottom: Math.min(shell.bottom, Math.max(...aims.map((r) => r.bottom))) };
    return hole.left <= aim.left + 1 && hole.top <= aim.top + 1 && hole.right >= aim.right - 1 && hole.bottom >= aim.bottom - 1;
  }, { index, target }, { timeout: 5000 }).catch(() => { throw new Error(`${label}: the lit hole does not reach what the line points at`); });
  const spot = await page.evaluate(() => {
    const box = (node) => { const r = node.getBoundingClientRect(); return { left: r.left, top: r.top, right: r.right, bottom: r.bottom }; };
    const root = document.querySelector('[data-test="vt-craft-tut"]'), hole = document.querySelector('[data-test="vt-craft-tut-hole"]');
    const text = document.querySelector(".vtc-tut-text");
    const dots = [...document.querySelectorAll('[data-test="vt-craft-tut-dots"] i')];
    return {
      shell: box(document.querySelector('[data-test="vt-craft"]')), cover: box(root), hole: box(hole), coach: box(document.querySelector('[data-test="vt-craft-tut-coach"]')),
      shade: getComputedStyle(hole).boxShadow, say: text.textContent, lines: Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)),
      dots: dots.length, on: dots.findIndex((dot) => dot.classList.contains("on")) + 1,
      go: !document.querySelector('[data-test="vt-craft-tut-go"]').hidden, next: !document.querySelector('[data-test="vt-craft-tut-next"]').hidden,
      face: document.querySelector('[data-test="vt-craft-tut-coach"] img').getAttribute("src"), telop: getComputedStyle(document.querySelector(".vtc-telop")).visibility,
      paused: document.querySelector("#screen .bench .bench-guide").open,
    };
  });
  assert.equal(spot.say, say, label);
  assert(spot.lines <= 2, `${label}: the line fits in two lines ${JSON.stringify(spot)}`);
  if (live) assert(live.includes(say), `${label}: the line comes from the bench's explanation ${JSON.stringify(live)}`);
  assert(["left", "top", "right", "bottom"].every((k) => Math.abs(spot.cover[k] - spot.shell[k]) <= 1), `${label}: the dark cover spans the whole scene`);
  assert(/rgba\(11, 8, 18, 0\.[6-9]/.test(spot.shade), `${label}: everything but the hole is darkened ${spot.shade}`);
  const apart = spot.coach.bottom <= spot.hole.top + 1 || spot.coach.top >= spot.hole.bottom - 1;
  assert(apart, `${label}: Sumi's bubble stays off the lit hole ${JSON.stringify({ hole: spot.hole, coach: spot.coach })}`);
  assert(spot.face.endsWith("face_sumi.webp"), spot.face);
  assert.equal(spot.telop, "hidden", `${label}: the usual line under the picture steps aside (no second face)`);
  assert.deepEqual([spot.dots, spot.on], [count, index], `${label}: one dot per step, the current one lit`);
  assert.deepEqual([spot.go, spot.next], [last, !last], `${label}: only the last step has "やってみる"`);
  assert(spot.paused, `${label}: the bench's explanation stays open (its clock waits)`);
}
/** スポットライトの次の段へ（画面のどこを押しても進む。ここでは上の端の、暗い所を押す）。 */
const nextSpot = (page) => page.locator(t("vt-craft-tut")).tap({ position: { x: 24, y: 24 } });
/** スポットライトを今の段から最後の段まで送り、「やってみる」で本編の説明を閉じる（本編の説明が閉じるまで待つ）。 */
async function finishSpots(page) {
  await page.locator(t("vt-craft-tut")).waitFor();
  const [now, count] = await page.evaluate(() => ["index", "count"].map((key) => Number(document.querySelector('[data-test="vt-craft-tut"]').dataset[key])));
  for (let i = now; i < count; i++) {
    await nextSpot(page);
    await page.waitForFunction((n) => document.querySelector('[data-test="vt-craft-tut"]').dataset.index === String(n), i + 1);
  }
  await page.locator(t("vt-craft-tut-go")).tap();
  await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
}

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
  await check("tournament-live-frame-survives-rotation", async (page) => {
    await page.evaluate(() => { void window.__remake.dev.show("interval"); });
    await waitScene(page, "tournament");
    await page.locator(".ts-eyecatch.in").tap();
    const live = page.locator(".vt-pic > .ts-live-front");
    await live.waitFor();
    assert.equal(await live.locator(".ts-live-chip").count(), 4);
    await live.evaluate(node => { window.liveBug = node; });
    await page.setViewportSize(WIDE.viewport);
    await page.waitForFunction(() => document.querySelector("#vn > .ts-live-front") === window.liveBug);
    await page.setViewportSize(TALL.viewport);
    await live.waitFor();
    assert(await live.evaluate(node => node === window.liveBug));
    await pressA(page);
    assert.equal(await page.locator("#rotate-hint").isVisible(), false);
  }, { ...TALL, pageEntry: entry });

  await check("tournament-interim-vote-on-short-screen", async (page) => {
    await page.evaluate(() => { window.voteRead = window.__remake.dev.show("vote-2"); });
    await waitScene(page, "tournament");
    const next = page.locator(t("standings-next"));
    assert(await next.isDisabled());
    await page.locator(".standings .sd-row").first().tap();
    await next.and(page.locator(":enabled")).waitFor();
    assert.equal(await page.locator(".sd-row").count(), 4);
    const board = page.locator(".standings");
    assert(await board.evaluate(node => node.scrollWidth <= node.clientWidth + 1));
    const rect = await board.boundingBox();
    assert(rect.x >= 0 && rect.x + rect.width <= SHORT.viewport.width + 1);
    assert(rect.y >= 0 && rect.y + rect.height <= SHORT.viewport.height + 1);
    await next.tap();
    await page.evaluate(() => window.voteRead);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-vt-tournament"));
  }, { ...SHORT, pageEntry: entry });

  await check("tournament-result-restores-rows-and-progress-on-rotation", async (page) => {
    await page.evaluate(() => { window.resultRead = window.__remake.dev.show("champion"); });
    await waitScene(page, "tournamentResult");
    const splash = page.locator(".ts-splash.win");
    assert.match(await splash.locator(".ts-crest img").getAttribute("src"), /champion-seal/);
    await splash.tap();
    await page.locator(".result-table.ts-revealed").waitFor();
    await page.locator(".vote-breakdown").tap();
    const dialog = page.locator("dialog.review[open]");
    assert.equal(await dialog.locator(".rt-votes").count(), 4);
    await dialog.locator(".rt-votes").first().evaluate(node => { window.firstVotes = node; });
    await page.setViewportSize(WIDE.viewport);
    await page.waitForFunction(() => !document.documentElement.hasAttribute("data-vt-result"));
    assert.equal(await page.locator(".rt-name .rt-votes").count(), 4);
    assert(await page.locator(".rt-name .rt-votes").first().evaluate(node => node === window.firstVotes));
    assert.equal(await page.locator("dialog.review").count(), 0);
    await page.setViewportSize(SHORT.viewport);
    await waitScene(page, "tournamentResult");
    await page.locator(".review-more").tap();
    await dialog.locator(".rt-judge-comment").waitFor();
    await dialog.getByRole("button", { name: "閉じる" }).tap();
    await page.locator(t("result-next")).tap();
    await page.evaluate(() => window.resultRead);
    assert.equal(await page.locator(".result-table:not(.done)").count(), 0);
  }, { ...SHORT, pageEntry: entry });

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

  await check("chapter-title-call-square-art", async (page) => {
    // VPN27・VPN28: 章タイトル（タイトルコール）は画面いっぱいの3段。上にゲームタイトルのロゴ、縦の真ん中に縦画面用の文字の無い正方形の絵を幅いっぱいに、
    // 下に章の情報（CHAPTER n・章名を本編の明朝で・英題。「〇〇編」は出さない・VPN23）。十字キーと丸ボタンは隠し、本編の覆いの文字は二重に出さない
    await waitScene(page, "title");
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 2, day: 15 });
      document.body.dataset.screen = "none"; (await import("./js/core/ui.js")).clearScreen();
      const { chapterTitleEntry } = await import("./js/core/chapter-title-art.js");
      const entry = chapterTitleEntry(2);
      window.titleRun = (await import("./js/core/ui.js")).chapterTitle({ no: entry.no, name: entry.name, read: entry.read, sub: entry.sub });
    });
    await page.locator('.vt-ct:not([hidden]) img.vt-ct-art').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1800);
    const call = await page.evaluate(() => {
      const root = document.querySelector(".vt-ct"), shell = document.querySelector(".vt-shell").getBoundingClientRect(), box = root.getBoundingClientRect();
      const a = document.querySelector(".vt-a").getBoundingClientRect();
      const onA = document.elementFromPoint(a.left + a.width / 2, a.top + a.height / 2);
      const rect = (q) => root.querySelector(q).getBoundingClientRect();
      const logo = rect(".vt-ct-logo"), pic = rect(".vt-ct-pic"), art = rect(".vt-ct-art"), copy = rect(".vt-ct-name");
      return { scene: window.__verticalLook.scene(), cover: document.querySelector(".vt-shell").dataset.cover,
        en: root.querySelector(".vt-ct-en").textContent, name: root.querySelector(".vt-ct-name").textContent, read: root.querySelector(".vt-ct-read").textContent,
        sub: root.querySelector(".vt-ct-sub")?.textContent || "", art: root.querySelector("img.vt-ct-art").getAttribute("src"),
        logo: root.querySelector(".vt-ct-logo").getAttribute("src"), text: [...root.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""),
        full: Math.abs(box.top - shell.top) <= 1 && Math.abs(box.bottom - shell.bottom) <= 1, padCovered: !onA?.closest(".vt-a"),
        lines: document.querySelector(".vt-cover-lines").hidden, nameFont: getComputedStyle(root.querySelector(".vt-ct-name")).fontFamily,
        // 絵は幅いっぱいの正方形（切らない）で、縦の真ん中。ロゴは絵の上、章名は絵の下
        shape: root.dataset.shape,
        artWhole: Math.abs(art.width - shell.width) <= 1 && Math.abs(art.height - shell.width) <= 1.5 && Math.abs(pic.height - art.height) <= 1,
        centered: Math.abs((pic.top + pic.bottom) / 2 - (shell.top + shell.bottom) / 2) <= 2,
        order: logo.bottom <= pic.top && copy.top >= pic.bottom };
    });
    assert.equal(call.scene, "cover");
    assert.equal(call.cover, "title");
    assert.deepEqual([call.en, call.name, call.read, call.sub], ["CHAPTER 2", "才能の壁", "Hollow Crown", ""], "no 「〇〇編」 line (VPN23)");
    assert.match(call.art, /ch2-title-square\.webp/, "the square art made for the vertical screen (VPN28)");
    assert.equal(call.shape, "square");
    assert.match(call.logo, /ui_title_logo_rich\.webp/, "the game title is the title screen's logo");
    assert.equal(call.text, "", "no stray text (such as \"null\") in the call");
    assert(call.full, "the title call covers the whole frame");
    assert(call.padCovered, "the pad is hidden under the title call");
    assert.equal(call.lines, true, "the chapter name is not repeated as plain text lines");
    assert.match(call.nameFont, /Suien Name/, "the chapter name uses the game's Mincho");
    assert(call.artWhole, "the square art is shown whole at full width");
    assert(call.centered, "the art sits in the vertical middle");
    assert(call.order, "logo above the art, chapter info below it");
    await page.evaluate(() => window.titleRun);
    await page.waitForFunction(() => document.querySelector(".vt-ct")?.hidden !== false || !document.querySelector(".chapter-title-shield"));
  }, { ...TALL, pageEntry: entry });

  await check("chapter-one-title-call-square-art", async (page) => {
    // VPN28: 第1章の専用の演出（ch1-title-motion）の間も同じ3段。絵は縦画面用の文字の無い正方形の絵（白地のドット絵）。白地なので後ろのぼかした絵は敷かない
    await waitScene(page, "title");
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js"); const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 1 });
      document.body.dataset.screen = "none"; (await import("./js/core/ui.js")).clearScreen();
      window.titleRun = (await import("./js/chapters/ch1-title-motion.js")).playCh1Title();
    });
    await page.locator('.vt-ct:not([hidden])[data-chapter="1"] img.vt-ct-art').waitFor({ timeout: 20000 });
    await page.waitForTimeout(1800);
    const call = await page.evaluate(() => {
      const root = document.querySelector(".vt-ct"), shell = document.querySelector(".vt-shell").getBoundingClientRect();
      const pic = root.querySelector(".vt-ct-pic").getBoundingClientRect(), art = root.querySelector(".vt-ct-art").getBoundingClientRect();
      return { cover: document.querySelector(".vt-shell").dataset.cover, en: root.querySelector(".vt-ct-en").textContent, name: root.querySelector(".vt-ct-name").textContent,
        read: root.querySelector(".vt-ct-read").textContent, art: root.querySelector(".vt-ct-art").getAttribute("src"), shape: root.dataset.shape, tone: root.dataset.tone,
        amb: !!root.querySelector(".vt-ct-amb"), text: [...root.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).map((n) => n.textContent).join(""),
        square: Math.abs(pic.width - pic.height) <= 1 && Math.abs(art.height - pic.height) <= 1, wide: Math.abs(art.width - shell.width) <= 1,
        centered: Math.abs((pic.top + pic.bottom) / 2 - (shell.top + shell.bottom) / 2) <= 2 };
    });
    assert.equal(call.cover, "title");
    assert.deepEqual([call.en, call.name, call.read], ["CHAPTER 1", "煙がつなぐ街", "Smoke & Ties"]);
    assert.match(call.art, /ch1-title-square\.webp/, "the square art made for the vertical screen (VPN28)");
    assert.equal(call.text, "", "no stray text (such as \"null\") in the call");
    assert.deepEqual([call.shape, call.tone, call.amb], ["square", "light", false], "no blurred copy of the white art behind");
    assert(call.square && call.wide && call.centered, `the square art fills the width in the vertical middle ${JSON.stringify(call)}`);
    await page.evaluate(() => window.titleRun);
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

  await check("craft-pack-and-steam-timer-in-the-shell", async (page) => {
    // シーシャ作りの詰め方と蒸らし時間は、縦の作る場面で遊ぶ（VPN30）。本編の作業台・工程の関数は裏でそのまま動き、
    // 外枠の札・ボタンを押すと本編の要素へ中継する（自動の craftTest は使わない）。工程の初回の「操作の説明」と「？」は、
    // スミさんの説明のスポットライトで見せる（VPN32。段ごとに一言が指す所を明るく抜き、最後の「やってみる」で本編の説明を閉じる）
    await waitScene(page, "title");
    await page.evaluate(async () => {
      try { localStorage.removeItem("suien_step_intro"); } catch {}
      const core = await import("./js/core/state.js");
      const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 2, slot: 0 });
      (await import("./js/core/ui.js")).clearScreen();
      const { newSession, openBench } = await import("./js/craft/session.js");
      const { stepPack } = await import("./js/craft/steps.js");
      const cs = newSession("tutorial"); window.vtCraft = cs; openBench(cs, {});
      window.packRun = stepPack(cs).then(() => { window.packDone = true; }, (error) => { window.vtCraftError = String(error.stack || error); });
    });
    await waitScene(page, "craft");
    const shell = await page.evaluate(() => ({
      layout: document.querySelector(".vt-shell").dataset.layout, hint: getComputedStyle(document.getElementById("rotate-hint")).display,
      guard: document.documentElement.dataset.rotateGuard || "", hud: document.querySelector(".vt-hud").childElementCount,
    }));
    assert.deepEqual(shell, { layout: "full", hint: "none", guard: "", hud: 0 }, "the craft scene fills the shell, without the rotate hint or the date and money");
    // 初回の「操作の説明」: 本編の説明の文を段に分け、器の絵→3枚の札→決定を順に明るく抜く（本編は札を出す前なので、外枠は決める前の札を見せる）
    await page.locator(t("vt-craft-tut")).waitFor();
    const live = await page.evaluate(() => document.querySelector("#screen .bench .bench-guide-tip > p").textContent);
    await expectSpot(page, { index: 1, count: 3, target: t("vt-pack-bowl"), say: "ハガルは葉を入れる器、ボウルとも呼ぶ", live });
    await nextSpot(page);
    await expectSpot(page, { index: 2, count: 3, target: ".vtc-card", say: "詰め方で空気の通り道を作れ", live });
    await nextSpot(page);
    await expectSpot(page, { index: 3, count: 3, target: t("vt-pack-ok"), say: "見比べて決めろ。迷ったらノーマルだ", last: true });
    // 最後の段は「やってみる」で閉じる（ほかを押しても段のまま。本編の説明も開いたまま）
    await nextSpot(page);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => [document.querySelector('[data-test="vt-craft-tut"]').dataset.index, document.querySelector("#screen .bench .bench-guide").open]), ["3", true]);
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    // 本編が札を出し、外枠の札がその写しになるまで待つ（説明の間の決める前の札は、本編の札が出ると作り直す）
    await page.waitForFunction(() => document.querySelector('#screen [data-test="opt-normal"]') && document.querySelector('[data-test="vt-pack-card-normal"]')
      && window.__verticalLook?.scene?.() === "craft" && document.querySelector('[data-test="vt-pack-info"] span')?.textContent);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    // 工程の並び（本編の工程。今の工程が光る）・器の絵・3枚の札
    const view = await page.evaluate(() => ({
      now: document.querySelector('[data-test="vt-craft-steps"] li.now')?.dataset.step,
      steps: document.querySelectorAll('[data-test="vt-craft-steps"] li').length, live: document.querySelectorAll("#screen .bench .bench-progress .bench-phase").length,
      cards: [...document.querySelectorAll(".vtc-card")].map((card) => card.dataset.value), bowl: document.querySelector('[data-test="vt-pack-bowl"]').getAttribute("src"),
      pressed: document.querySelector('.vtc-card[aria-pressed="true"]')?.dataset.value,
    }));
    assert.equal(view.now, "pack");
    assert.equal(view.steps, view.live, "one circle per step of the bench");
    assert.deepEqual(view.cards, ["fluffy", "normal", "firm"]);
    assert.equal(view.pressed, "normal");
    assert(view.bowl.endsWith("img/ui/vertical-craft/ui-bowl-normal.webp"), view.bowl);
    // 札を押すと本編の選択肢が替わり、器の絵と説明も替わる
    await page.locator(t("vt-pack-card-fluffy")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="opt-fluffy"]').getAttribute("aria-pressed") === "true");
    await page.waitForFunction(() => document.querySelector('[data-test="vt-pack-card-fluffy"]').getAttribute("aria-pressed") === "true"
      && document.querySelector('[data-test="vt-pack-bowl"]').getAttribute("src").endsWith("ui-bowl-airy.webp"));
    const info = await page.evaluate(() => ({ shell: document.querySelector('[data-test="vt-pack-info"] b').textContent, live: document.querySelector("#screen .pack-caption b").textContent }));
    assert.deepEqual(info, { shell: "ふんわり", live: "ふんわり" });
    // 「？」で本編の説明を開くと、同じスポットライトで見せる。画面の大きさが変わると抜く所と吹き出しを置き直す。「やってみる」で本編の説明を閉じる
    await page.locator(t("vt-craft-help")).tap();
    await page.waitForFunction(() => document.querySelector("#screen .bench .bench-guide").open);
    await expectSpot(page, { index: 1, count: 3, target: t("vt-pack-bowl"), say: "ハガルは葉を入れる器、ボウルとも呼ぶ" });
    await page.setViewportSize(SHORT.viewport);
    await expectSpot(page, { index: 1, count: 3, target: t("vt-pack-bowl"), say: "ハガルは葉を入れる器、ボウルとも呼ぶ" });
    await page.setViewportSize(TALL.viewport);
    await nextSpot(page);
    await expectSpot(page, { index: 2, count: 3, target: ".vtc-card", say: "詰め方で空気の通り道を作れ" });
    await nextSpot(page);
    await expectSpot(page, { index: 3, count: 3, target: t("vt-pack-ok"), say: "見比べて決めろ。迷ったらノーマルだ", last: true });
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    // 決定で本編の詰め方が決まり、工程が終わる
    await page.locator(t("vt-pack-ok")).tap();
    await page.waitForFunction(() => window.packDone === true || window.vtCraftError);
    assert.equal(await page.evaluate(() => window.vtCraftError || window.vtCraft.pack), "fluffy");

    // 蒸らし時間: 外枠の早見・分・秒・リセットで時間を決め、スタートで本編の工程が進む
    await page.evaluate(async () => {
      const { runSteamTimer } = await import("./js/craft/timer.js");
      window.timerRun = runSteamTimer(window.vtCraft).then(() => { window.timerDone = true; }, (error) => { window.vtCraftError = String(error.stack || error); });
    });
    // 初回の説明: タイマーの絵と液晶→分・秒→早見→（温度計はまだ無いので）液晶→スタートを順に明るく抜く
    await page.locator(t("vt-craft-tut")).waitFor();
    const timerLive = await page.evaluate(() => document.querySelector("#screen .bench .bench-guide-tip > p").textContent);
    const timerSpots = (thermo) => [
      { target: ".vtc-ktimer", say: "葉全体に熱をなじませる工程だ", live: timerLive },
      { target: ".vtc-t-min, .vtc-t-sec", say: "分は1分、秒は10秒ずつ", live: timerLive },
      { target: ".vtc-presets", say: "3分・5分・8分は押せば一発だ。迷ったら5分" },
      { target: thermo ? t("vt-craft-thermo") : t("vt-timer-lcd"), say: "熱の目安を見て、3〜10分の範囲で時間を決めろ", live: timerLive },
      { target: t("vt-timer-start"), say: "時間を決めたら、スタートだ", last: true },
    ];
    for (const [i, spot] of timerSpots(false).entries()) {
      if (i) await nextSpot(page);
      await expectSpot(page, { index: i + 1, count: 5, ...spot });
    }
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open && document.querySelector('#screen [data-test="timer-start"]'));
    await page.locator(t("vt-timer-start")).waitFor();
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    const clock = () => page.evaluate(() => ({
      live: document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent,
      shell: document.querySelector('[data-test="vt-timer-lcd"]').getAttribute("aria-label"),
      start: document.querySelector('[data-test="vt-timer-start"]').disabled, liveStart: document.querySelector('#screen [data-test="timer-start"]').disabled,
    }));
    // 工程の並びは本編の工程の札を定期の写しで読むので、本編が「蒸らし」を今の工程にして写るまで待つ（遅い環境では説明を閉じた直後はまだ前の写し）
    await page.waitForFunction(() => document.querySelector('[data-test="vt-craft-steps"] li.now')?.dataset.step === "steam", null, { timeout: 5000 });
    assert.deepEqual(await clock(), { live: "00:00", shell: "蒸らし時間 0分0秒", start: true, liveStart: true }, "start waits for a time");
    await page.locator(t("vt-timer-preset-5")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent === "05:00");
    await page.waitForFunction(() => document.querySelector('[data-test="vt-timer-preset-5"]').getAttribute("aria-pressed") === "true");
    await page.locator(t("vt-timer-min")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent === "06:00");
    await page.locator(t("vt-timer-sec")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent === "06:10");
    // 絵の物理ボタンも同じ（リセット）
    await page.locator(t("vt-timer-key-reset")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent === "00:00");
    await page.locator(t("vt-timer-preset-3")).tap();
    await page.locator(t("vt-timer-key-sec")).tap();
    await page.waitForFunction(() => document.querySelector('#screen [data-test="timer-display"] .clock-value').textContent === "03:10");
    await page.waitForFunction(() => document.querySelector('[data-test="vt-timer-lcd"]').getAttribute("aria-label") === "蒸らし時間 3分10秒");
    assert.deepEqual(await clock(), { live: "03:10", shell: "蒸らし時間 3分10秒", start: false, liveStart: false });
    // 温度計は本編の蒸らし後の目安（幅）を写す
    const thermo = await page.evaluate(() => ({ mode: document.querySelector('[data-test="vt-craft-thermo"]').dataset.mode,
      shown: !document.querySelector('[data-test="vt-craft-thermo"]').hidden, range: !document.querySelector(".vtc-th-range").hidden }));
    assert.deepEqual(thermo, { mode: "forecast", shown: true, range: true });
    // 「？」: 温度計が出た後は、温度計の目安の段で温度計を明るく抜く。「やってみる」で本編の説明を閉じ、決めた時間はそのまま
    await page.locator(t("vt-craft-help")).tap();
    await page.waitForFunction(() => document.querySelector("#screen .bench .bench-guide").open);
    for (const [i, spot] of timerSpots(true).entries()) {
      if (i) await nextSpot(page);
      await expectSpot(page, { index: i + 1, count: 5, ...spot });
    }
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    assert.deepEqual(await clock(), { live: "03:10", shell: "蒸らし時間 3分10秒", start: false, liveStart: false });
    await page.locator(t("vt-timer-start")).tap();
    await page.waitForFunction(() => window.timerDone === true || window.vtCraftError);
    assert.deepEqual(await page.evaluate(() => window.vtCraftError || { seconds: window.vtCraft.steamSeconds, min: window.vtCraft.steamMin }), { seconds: 190, min: 190 / 60 });
  }, { ...TALL, pageEntry: entry });

  /** 作業台を開いて、本編の工程の関数を走らせる（自動の craftTest は使わない）。終わると window.vtStepDone、失敗は window.vtCraftError。 */
  const runCraftStep = (page, { module, fn, mode = "tutorial", setup = null }) => page.evaluate(async ({ module, fn, mode, setup }) => {
    try { localStorage.removeItem("suien_step_intro"); } catch {}
    const core = await import("./js/core/state.js");
    const s = core.newGame(); Object.assign(s, { phase: "daily", chapter: 1, day: 2, slot: 0 });
    (await import("./js/core/ui.js")).clearScreen();
    const { newSession, openBench } = await import("./js/craft/session.js");
    const cs = newSession(mode); window.vtCraft = cs;
    if (setup) Object.assign(cs, setup);
    openBench(cs, {});
    window.vtStepDone = false;
    (await import(module))[fn](cs).then(() => { window.vtStepDone = true; }, (error) => { window.vtCraftError = String(error.stack || error); });
  }, { module, fn, mode, setup });
  /** 外枠のボタンを長押しする（pointerdown → 待つ → pointerup）。during は押している間に確かめる関数。 */
  async function holdShell(page, id, ms, during = null) {
    const box = await page.locator(t(id)).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    try {
      if (during) await during();
      await page.waitForTimeout(ms);
    } finally { await page.mouse.up(); }
  }
  /** 作る場面のまま（外枠の全画面・回転案内なし）。 */
  async function assertCraftShell(page, label) {
    const shell = await page.evaluate(() => ({
      scene: window.__verticalLook?.scene?.(), layout: document.querySelector(".vt-shell").dataset.layout,
      hint: getComputedStyle(document.getElementById("rotate-hint")).display, guard: document.documentElement.dataset.rotateGuard || "",
    }));
    assert.deepEqual(shell, { scene: "craft", layout: "full", hint: "none", guard: "" }, `${label}: the craft scene fills the shell, without the rotate hint`);
  }

  await check("craft-water-in-the-shell", async (page) => {
    // 水入れ（VPN31）: 縦の作る場面の流し台とボトル。外枠の「注ぐ」「こぼす」の長押しを本編のボタンへ pointerdown／pointerup で中継し、
    // 本編の水量（毎フレーム読む）がボトルの水面になる。「決定」で本編の水入れが終わり、水量が cs.water に入る
    await waitScene(page, "title");
    await runCraftStep(page, { module: "./js/craft/water-view.js", fn: "stepWater" });
    await waitScene(page, "craft");
    await assertCraftShell(page, "water intro");
    // チュートリアルの初回の説明（部品の前）も、水入れの画面のまま、スミさんの説明のスポットライトで見せる（VPN32）:
    // 本編の説明の文を段に分け、ボトル→目安の線→注ぐ・こぼす→決定を順に明るく抜く（本編は部品を出す前なので、外枠はボタンを押せる形で見せる）
    await page.locator(t("vt-craft-tut")).waitFor();
    assert.equal(await page.evaluate(() => document.querySelector(".vtc").dataset.step), "water");
    const waterLive = await page.evaluate(() => document.querySelector("#screen .bench .bench-guide-tip > p").textContent);
    const waterSpots = [
      { target: ".vtc-bottle", say: "煙は水をくぐって冷える", live: waterLive },
      { target: ".vtc-w-band, .vtc-w-mark", say: "量で吸い心地が変わるから、まずは目安に合わせろ", live: waterLive },
      { target: `${t("vt-water-drain")}, ${t("vt-water-pour")}`, say: "注ぐときは長押し。こぼして戻してもいい" },
      { target: t("vt-water-ok"), say: "線のあいだに収めたら、決定だ", last: true },
    ];
    const waterButtons = () => page.evaluate(() => ["drain", "pour", "ok"].map((key) => document.querySelector(`[data-test="vt-water-${key}"]`).disabled));
    for (const [i, spot] of waterSpots.entries()) {
      if (i) await nextSpot(page);
      await expectSpot(page, { index: i + 1, count: waterSpots.length, ...spot });
    }
    assert.deepEqual(await waterButtons(), [false, false, false], "the buttons the lines point at look pressable during the explanation");
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    // 説明を閉じると本編が水入れの部品を出し、外枠のボタンが押せるようになる
    await page.locator(`#screen ${t("water-pour")}`).waitFor();
    await page.locator(`${t("vt-water-pour")}:not([disabled])`).waitFor();
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    // 「？」も同じ段（本編は作業台を止めている。外枠のボタンは押せる形のまま）。「やってみる」で閉じると、本編のボタンが生きる
    await page.locator(t("vt-craft-help")).tap();
    await page.waitForFunction(() => document.querySelector("#screen .bench .bench-guide").open);
    await expectSpot(page, { index: 1, count: waterSpots.length, ...waterSpots[0] });
    assert.deepEqual(await waterButtons(), [false, false, false]);
    await finishSpots(page);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    await page.waitForFunction(() => !document.querySelector('#screen [data-test="water-step"]').closest("[inert]"));
    const level = () => page.evaluate(() => Number(document.querySelector('#screen [data-test="water-meter"]').getAttribute("aria-valuenow")));
    const first = await page.evaluate(() => ({
      now: document.querySelector('[data-test="vt-craft-steps"] li.now')?.dataset.step, zone: document.querySelector('[data-test="vt-water-pic"]').dataset.zone,
      sink: document.querySelector(".vtc-sink").getAttribute("src"), glass: document.querySelector(".vtc-glass").getAttribute("src"),
      buttons: ["drain", "pour", "ok"].map((key) => !!document.querySelector(`[data-test="vt-water-${key}"]`)),
    }));
    assert.equal(first.now, "pack", "water is part of the packing step");
    assert.equal(first.zone, "empty", "the bottle starts empty like the game");
    assert(first.sink.endsWith("img/ui/vertical-craft/ui-sink-faucet.webp") && first.glass.endsWith("img/ui/vertical-craft/ui-bottle-open.webp"), JSON.stringify(first));
    assert.deepEqual(first.buttons, [true, true, true]);
    assert.equal(await level(), 0);
    // 「注ぐ」の長押し: 押している間だけ本編が注ぎ、離すと止まる
    await holdShell(page, "vt-water-pour", 2700, async () => {
      await page.waitForFunction(() => document.querySelector('#screen [data-test="water-step"]').dataset.flow === "pour"
        && document.querySelector('[data-test="vt-water-pour"]').classList.contains("pressing"));
    });
    await page.waitForFunction(() => document.querySelector('#screen [data-test="water-step"]').dataset.flow === "stopped");
    const poured = await level();
    assert(poured > 40 && poured < 60, `poured into the band: ${poured}`);
    await page.waitForTimeout(300);
    assert.equal(await level(), poured, "the water stops when the button is let go");
    await page.waitForFunction(() => document.querySelector('[data-test="vt-water-pic"]').dataset.zone
      === document.querySelector('#screen [data-test="water-status"]').dataset.band);
    // 「こぼす」の長押し: 本編の水量が減る
    await holdShell(page, "vt-water-drain", 500, async () => {
      await page.waitForFunction(() => document.querySelector('#screen [data-test="water-step"]').dataset.flow === "drain");
    });
    await page.waitForFunction(() => document.querySelector('#screen [data-test="water-step"]').dataset.flow === "stopped");
    const drained = await level();
    assert(drained < poured && drained > poured - 5, `drained a little: ${poured} → ${drained}`);
    await assertCraftShell(page, "water");
    // 「決定」で本編の水入れが終わり、確定した水量が cs.water に入る
    await page.locator(t("vt-water-ok")).tap();
    await page.waitForFunction(() => window.vtStepDone === true || window.vtCraftError);
    const water = await page.evaluate(() => window.vtCraftError || window.vtCraft.water);
    assert.equal(typeof water, "number", String(water));
    assert(Math.abs(water * 100 - drained) < 0.01, `cs.water is the game's level: ${water} / ${drained}`);
  }, { ...TALL, pageEntry: entry });

  await check("craft-holes-in-the-shell", async (page) => {
    // 穴あけ（VPN31）: 縦の作る場面のアルミと「刺す」。配置の札と決定、「刺す」の長押し（本編の「穴を開ける」へ押し始めと離すを中継。
    // 押す長さの判定・穴の位置・テンプレート・制限時間は本編のまま）、桜井版の「次のリングへ」「結果へ」、結果の札まで外枠で進める
    await waitScene(page, "title");
    await runCraftStep(page, { module: "./js/craft/holes.js", fn: "runHoles" });
    await waitScene(page, "craft");
    await assertCraftShell(page, "holes intro");
    // チュートリアルの初回の説明（配置の札の前）も、穴あけの画面のまま、スミさんの説明のスポットライトで見せる（VPN32）:
    // 本編の説明の文を段に分け、アルミ→刺す→（刺す）→開けた穴の数を順に明るく抜く（本編は配置の札の前なので、外枠は穴あけの形と既定の配置の数の点を見せる）
    await page.locator(t("vt-craft-tut")).waitFor();
    assert.equal(await page.evaluate(() => document.querySelector(".vtc").dataset.step), "holes");
    const holesLive = await page.evaluate(() => document.querySelector("#screen .bench .bench-guide-tip > p").textContent);
    const holesSpots = [
      { target: t("vt-holes-foil"), say: "アルミは葉を覆うふた、穴は空気と熱の入口だ", live: holesLive },
      { target: t("vt-holes-poke"), say: "目印に針を合わせて、同じ加減で刺せ", live: holesLive },
      { target: t("vt-holes-poke"), say: "押しすぎると穴が大きくなる", live: holesLive },
      { target: `${t("vt-holes-pips")}, .vtc-hole-count`, say: "周りの点が開けた穴だ。金ならちょうどいい", last: true },
    ];
    for (const [i, spot] of holesSpots.entries()) {
      if (i) await nextSpot(page);
      await expectSpot(page, { index: i + 1, count: holesSpots.length, ...spot });
    }
    const preview = await page.evaluate(() => ({ pips: document.querySelectorAll(".vtc-pip").length, made: document.querySelectorAll(".vtc-pip.done, .vtc-pip.good").length,
      count: document.querySelector(".vtc-hole-count").textContent, poke: document.querySelector('[data-test="vt-holes-poke"]').disabled }));
    assert.deepEqual(preview, { pips: 24, made: 0, count: "0/24", poke: false }, "before the game's foil, the points of the default layout and a pressable 刺す are shown");
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    // 配置選び: 本編の札を写し、決定で本編の「穴あけを始める」へ
    await page.locator(`${t("vt-holes-start")}:not([disabled])`).waitFor();
    const choose = await page.evaluate(() => ({
      shell: [...document.querySelectorAll(".vtc-ht-card")].map((card) => [card.dataset.live, card.getAttribute("aria-pressed")]),
      live: [...document.querySelectorAll("#screen .ht-option")].map((node) => [node.dataset.test, node.getAttribute("aria-pressed")]),
      planned: document.querySelectorAll(".vtc-foil-marks .vtc-todo").length, liveDots: document.querySelectorAll("#screen .ht-preview .foil-marker.planned").length,
      coach: document.querySelector(".vtc-say-text").textContent, now: document.querySelector('[data-test="vt-craft-steps"] li.now')?.dataset.step,
    }));
    assert(choose.shell.length > 0, JSON.stringify(choose));
    assert.deepEqual(choose.shell, choose.live, "the template cards are the game's");
    assert(choose.planned > 0 && choose.planned === choose.liveDots, `the planned marks are drawn on the foil ${JSON.stringify(choose)}`);
    assert.equal(choose.now, "pack");
    assert.equal(choose.coach, "配置を選んで、始めろ");
    await page.locator(t("vt-holes-start")).tap();
    // 始まりの 3・2・1 も外枠の絵の上に出る。数え終わるまで「刺す」は本編が受けない
    await page.locator(`#screen ${t("hole-punch")}`).waitFor();
    await page.locator(`${t("vt-craft-count")}:not([hidden])`).waitFor();
    await page.waitForFunction(() => !document.querySelector("#fx > .countdown"));
    await page.locator(`${t("vt-holes-poke")}:not([disabled])`).waitFor();
    await assertCraftShell(page, "holes");
    // 穴あけの間の「？」も同じ段（本編は作業台を止めている。指す「刺す」は押せる形のまま）。「やってみる」で閉じると穴あけに戻る
    await page.locator(t("vt-craft-help")).tap();
    await page.waitForFunction(() => document.querySelector("#screen .bench .bench-guide").open);
    await expectSpot(page, { index: 1, count: holesSpots.length, ...holesSpots[0] });
    await nextSpot(page);
    await expectSpot(page, { index: 2, count: holesSpots.length, ...holesSpots[1] });
    assert.equal(await page.evaluate(() => document.querySelector('[data-test="vt-holes-poke"]').disabled), false);
    await finishSpots(page);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    await page.locator(`${t("vt-holes-poke")}:not([disabled])`).waitFor();
    // 本編の時計は説明を閉じた toggle の届きで再開する（その前の押しは本編が受けない）。再開してから刺す
    await page.waitForFunction(() => {
      const bench = document.querySelector("#screen .bench");
      return bench?.dataset.helpPaused !== "true" && !bench?.querySelector(".bench-panel")?.inert;
    });
    let pressed = null;
    for (let i = 0; i < 60; i++) {
      const view = await page.evaluate(() => {
        const pill = document.querySelector('[data-test="vt-holes-next"]');
        return { result: !document.querySelector('[data-test="vt-craft-result"]').hidden, pill: pill.hidden ? "" : pill.textContent,
          live: document.querySelectorAll('#screen [data-test="foil"] .foil-holes > .foil-hole').length };
      });
      if (view.result) break;
      if (view.pill) {
        // 桜井版: リングが埋まると「次のリングへ」、全部開けると「結果へ」（本編で押せる時だけ右上に出る）
        await page.locator(t("vt-holes-next")).tap();
        if (view.pill === "結果へ") break;
        await page.waitForFunction(() => document.querySelector('[data-test="vt-holes-next"]').hidden);
        continue;
      }
      // 「刺す」を約0.2秒押す（本編の小穴の長さ）。押している間は本編の針も押されている
      await holdShell(page, "vt-holes-poke", 200, async () => {
        pressed ??= await page.evaluate(() => {
          const cursor = document.querySelector('#screen [data-test="hole-needle"]');
          return { live: cursor.classList.contains("pressing"), shell: document.querySelector('[data-test="vt-holes-poke"]').classList.contains("pressing") };
        });
      });
      // 穴が増えたら、外枠が本編に追いつくまで待つ（外枠の写しは本編が変わった次のフレーム。「刺す」の離しはフレームの中で本編へ送るので、
      // 本編の穴の数だけを見て次へ進むと、まだ出ていない「次のリングへ」「結果へ」を見落として、刺せない「刺す」を押してしまう）
      await page.waitForFunction((before) => {
        const made = document.querySelectorAll('#screen [data-test="foil"] .foil-holes > .foil-hole').length;
        return made > before && document.querySelector('[data-test="vt-holes-pips"]').getAttribute("aria-label")?.startsWith(`開けた穴 ${made}/`);
      }, view.live);
    }
    assert.deepEqual(pressed, { live: true, shell: true }, "holding the shell's button holds the game's punch");
    // 結果の札: 本編の結果の札を写し、「確認して次の工程へ」で本編の工程が終わる。開けた穴は絵に残る
    await page.locator(`${t("vt-craft-result")}:not([hidden])`).waitFor();
    const result = await page.evaluate(() => ({
      title: document.querySelector(".vtc-result-title").textContent, live: document.querySelector("#screen .result-card .rc-title").textContent,
      next: document.querySelector('[data-test="vt-craft-result-next"]').textContent, drawn: document.querySelectorAll(".vtc-foil-marks .vtc-hole").length,
      pips: document.querySelectorAll(".vtc-pip.done, .vtc-pip.good").length,
    }));
    assert.equal(result.title, result.live);
    assert.equal(result.next, "確認して次の工程へ");
    assert.equal(result.drawn, 24, "the holes stay on the foil during the result");
    assert.equal(result.pips, 24, "one lit pip per hole");
    await assertCraftShell(page, "holes result");
    await page.locator(t("vt-craft-result-next")).tap();
    await page.waitForFunction(() => window.vtStepDone === true || window.vtCraftError);
    const res = await page.evaluate(() => window.vtCraftError || { total: window.vtCraft.holes.total, score: typeof window.vtCraft.holes.score, template: window.vtCraft.holes.templateId });
    assert.deepEqual(res, { total: 24, score: "number", template: "outer12-middle12" });
  }, { ...TALL, pageEntry: entry });

  await check("craft-heat-in-the-shell", async (page) => {
    // 炭焼き（VPN31）: 縦の作る場面の寄りのコンロと炭、上に炭壺を持つはじめ。炭の焼け具合（本編の炭の --red）と取り頃の光（.pikan）を写し、
    // 外枠の炭を押すと本編のその炭を取る（焼ける速さ・取り頃・採点は本編のまま）。取った炭は炭壺へ入り、結果の札まで外枠で進める
    await waitScene(page, "title");
    await runCraftStep(page, { module: "./js/craft/heat.js", fn: "runHeat" });
    await waitScene(page, "craft");
    await assertCraftShell(page, "heat intro");
    // チュートリアルの初回の説明（炭の前）も、炭焼きの画面のまま、スミさんの説明のスポットライトで見せる（VPN32）:
    // 本編の説明の文を段に分け、炭壺を持つはじめの絵→コンロの炭ひとつ→炭全部を順に明るく抜く（本編は炭を出す前なので、外枠はまだ焼いていない炭を見せる）
    await page.locator(t("vt-craft-tut")).waitFor();
    assert.equal(await page.evaluate(() => document.querySelector(".vtc").dataset.step), "heat");
    const heatLive = await page.evaluate(() => document.querySelector("#screen .bench .bench-guide-tip > p").textContent);
    const heatSpots = [
      { target: ".vtc-coal-hero", say: "炭の全面に火を入れる工程だ", live: heatLive },
      { target: t("vt-heat-coal-0"), say: "黒い面が消えて全面が赤くなったら取り出す合図", live: heatLive },
      { target: ".vtc-coal", say: "炭を押せば取れる。三つとも焼くぞ", last: true },
    ];
    for (const [i, spot] of heatSpots.entries()) {
      if (i) await nextSpot(page);
      await expectSpot(page, { index: i + 1, count: heatSpots.length, ...spot });
    }
    assert.equal(await page.evaluate(() => document.querySelectorAll(".vtc-coal").length), 3, "unburnt coals sit on the stove before the game's coals");
    await page.locator(t("vt-craft-tut-go")).tap();
    await page.waitForFunction(() => !document.querySelector("#screen .bench .bench-guide").open);
    await page.locator(t("vt-craft-tut")).waitFor({ state: "hidden" });
    await page.locator(t("vt-heat-coal-0")).waitFor();
    // 説明の間は外枠がまだ焼いていない炭を置いている。本編が炭を出し、外枠がそれを写すまで待つ
    await page.waitForFunction(() => {
      const live = document.querySelectorAll("#screen .heat .stove .coal").length;
      return live > 0 && document.querySelectorAll(".vtc-coal").length === live;
    });
    const first = await page.evaluate(() => ({
      shell: document.querySelectorAll(".vtc-coal").length, live: document.querySelectorAll("#screen .heat .stove .coal").length,
      stove: document.querySelector(".vtc-stove > img").getAttribute("src"), hero: document.querySelector(".vtc-coal-hero > img").getAttribute("src"),
      now: document.querySelector('[data-test="vt-craft-steps"] li.now')?.dataset.step, coach: document.querySelector(".vtc-say-text").textContent,
    }));
    assert(first.shell > 0 && first.shell === first.live, `one coal per coal of the game ${JSON.stringify(first)}`);
    assert(first.stove.endsWith("img/ui/vertical-craft/ui-stove-zoom.webp") && first.hero.endsWith("img/ui/vertical-craft/craft-coal-hajime.webp"), JSON.stringify(first));
    assert.equal(first.now, "heat");
    assert.equal(first.coach, "全面が赤くなったら取れ");
    // 数え終わるとコンロが点き、炭が焼けていく（外枠の炭の焼け具合は本編の炭と同じ）
    await page.waitForFunction(() => document.querySelector("#screen .heat")?.getAttribute("aria-busy") === "false", null, { timeout: 15000 });
    await page.waitForFunction(() => document.querySelector(".vtc-stove").classList.contains("on"));
    await page.waitForTimeout(500);
    const burn = await page.evaluate(() => [...document.querySelectorAll("#screen .heat .stove .coal")].map((live, i) => [
      Number(live.style.getPropertyValue("--red")), Number(document.querySelector(`[data-test="vt-heat-coal-${i}"]`).style.getPropertyValue("--red"))]));
    for (const [live, shell] of burn) assert(live > 0 && Math.abs(live - shell) < 0.08, `the shell's coal burns like the game's ${JSON.stringify(burn)}`);
    await assertCraftShell(page, "heat");
    // 本編の取り頃の光が出た炭を、外枠の炭で取る
    for (let n = 0; n < first.live; n++) {
      const idx = await page.waitForFunction(() => {
        const i = [...document.querySelectorAll("#screen .heat .stove .coal")].findIndex((live) => live.classList.contains("pikan") && !live.classList.contains("picked"));
        return i >= 0 && document.querySelector(`[data-test="vt-heat-coal-${i}"]`).classList.contains("pikan") ? String(i) : null; // 0 番も返す（数の 0 は「まだ」扱い）
      }, null, { timeout: 20000 }).then((handle) => handle.jsonValue());
      await page.locator(t(`vt-heat-coal-${idx}`)).tap();
      await page.waitForFunction((i) => document.querySelector(`#screen [data-test="coal-${i}"]`).classList.contains("picked"), idx);
    }
    // 取った炭は炭壺の中へ、判定の札は左上へ。結果の札を写し、外枠で閉じると本編の工程が終わる
    await page.locator(`${t("vt-craft-result")}:not([hidden])`).waitFor();
    const result = await page.evaluate(() => ({
      slots: document.querySelectorAll(".vtc-slot").length, judges: document.querySelectorAll(".vtc-coal-judges .vtc-jtag").length,
      title: document.querySelector(".vtc-result-title").textContent, live: document.querySelector("#screen .result-card .rc-title").textContent,
      lines: document.querySelectorAll(".vtc-result-lines p").length,
    }));
    assert.deepEqual([result.slots, result.judges], [first.live, first.live], JSON.stringify(result));
    assert.equal(result.title, result.live);
    assert(result.lines >= 1, "the result's summary is shown");
    await page.locator(t("vt-craft-result-next")).tap();
    await page.waitForFunction(() => window.vtStepDone === true || window.vtCraftError);
    const heat = await page.evaluate(() => window.vtCraftError || { picks: window.vtCraft.heat.picks, score: typeof window.vtCraft.heat.score });
    assert.equal(heat.picks?.length, first.live, JSON.stringify(heat));
    assert(heat.picks.every((pick) => ["just", "hot"].includes(pick)), `taken in the ready window ${JSON.stringify(heat)}`);
    assert.equal(heat.score, "number");
  }, { ...TALL, pageEntry: entry });

  await check("short-screen-fits", async (page) => {
    await setupDaily(page);
    await assertFits(page, "short map");
    await assertPadHome(page, "short map");
  }, { ...SHORT, pageEntry: entry });

  await check("landscape-uses-the-current-screen", async (page) => {
    // 横持ち: 外枠を出さず、本編の画面のまま
    await page.locator(t("title-new")).waitFor();
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => ({ shell: !!document.querySelector(".vt-shell"), vt: document.documentElement.dataset.vt || "", opacity: getComputedStyle(document.getElementById("viewport")).opacity }));
    assert.deepEqual(state, { shell: false, vt: "", opacity: "1" });
  }, { ...WIDE, pageEntry: entry });

  await check("switching-looks-leaves-no-trace", async (page) => {
    await waitScene(page, "title");
    // 設定で旧版へ替えると、縦の外枠・回転案内の文・本編の会話の箱の幅の上書きが残らない
    await page.evaluate(async () => {
      document.body.dataset.screen = "none";
      (await import("./js/core/look.js")).setLook("classic");
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

  /** 縦の外枠が回転案内へ落ちなかったか（場面転換の間も）を見張る。 */
  const watchHint = (page) => page.evaluate(() => {
    window.__hintSeen = false;
    clearInterval(window.__hintWatch);
    window.__hintWatch = setInterval(() => { if (getComputedStyle(document.getElementById("rotate-hint")).display !== "none") window.__hintSeen = true; }, 40);
  });
  const hintSeen = (page) => page.evaluate(() => { clearInterval(window.__hintWatch); return window.__hintSeen; });

  await check("chapter-two-morning-map-and-station-in-the-shell", async (page) => {
    // VPN17: 第2章以降の日常パートも縦の外枠のまま（旧版の画面にも回転案内にもならない）
    await waitScene(page, "title");
    await watchHint(page);
    await seedChapterTwoDaily(page);
    // 朝の行き先の小窓（文と選択肢だけ）は、その場の背景の上の問いと返事の札
    await waitScene(page, "menu", 40000);
    const dialog = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#modal.show .modal-actions > button")].map((n) => n.textContent.trim()),
      vertical: [...document.querySelectorAll(".vt-choice b")].map((n) => n.textContent.trim()),
    }));
    assert(dialog.classic.length >= 2, JSON.stringify(dialog));
    assert.deepEqual(dialog.vertical.map((text) => text.replace(/\s+/g, "")), dialog.classic.map((text) => text.replace(/\s+/g, "")));
    await assertPadHome(page, "chapter 2 morning");
    await pressA(page); // 地元・橙須で過ごす
    await waitScene(page, "map", 30000);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "vertical");
    assert.match(await page.locator(".vt-hud").textContent(), /第2章/);
    await assertPadHome(page, "chapter 2 map");
    // 駅: 一覧から選び、行き先（案内の箱のボタン）を十字キーと決定で選ぶ → 乗車の確認 → 隣町の地図
    await pad(page, "down");
    await page.locator(t("vt-row-station")).tap();
    await page.locator('.vt-map-actions:not([hidden]) .vt-choice[aria-current="true"]').waitFor();
    const first = await page.locator(".vt-map-actions .vt-choice").first().textContent();
    assert.match(first, /柚ヶ谷/, "the first destination is picked for the round button");
    await pressA(page);
    await page.waitForFunction(() => /移動する/.test(document.querySelector('.vt-map-actions:not([hidden]) .vt-choice[aria-current="true"]')?.textContent || ""));
    await pressA(page);
    await page.waitForFunction(() => document.querySelector('#screen > :not(.done).map[data-station-arrived="widehanga"]'), null, { timeout: 30000 });
    await waitScene(page, "map", 30000);
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.__remake.state.money), 35800);
    assert.equal(await page.locator(".vt-map-actions:not([hidden]) .vt-choice").count(), 0, "the ride's confirm buttons do not stay on the next map");
    const pins = await page.evaluate(() => ({ vertical: [...document.querySelectorAll(".vt-pin")].length, live: [...document.querySelectorAll("#screen > :not(.done).map .map-pins > .spot-pin")].filter((n) => !n.hidden).length }));
    assert(pins.vertical > 0 && pins.vertical === pins.live, `the town's pins are shown ${JSON.stringify(pins)}`);
    assert.equal(await hintSeen(page), false, "no rotate hint through the morning, the map and the ride");
    assert.equal(await page.evaluate(() => window.dailyError || ""), "");
  }, { ...TALL, pageEntry: entry });

  await check("chapter-three-card-and-tokyo-dialog", async (page) => {
    await waitScene(page, "title");
    await seedChapterThree(page, { cards: true });
    await page.reload();
    // 場面カード（ボタンだけの画面）は、背景の上の問いと返事の札
    await waitScene(page, "menu", 40000);
    const card = await page.evaluate(() => ({
      classic: [...document.querySelectorAll("#screen .ch3-wayfinding .ch3-wayfinding-map, #screen main.ch2-contest > .ch2-contest-actions button")]
        .filter((n) => n.getClientRects().length).map((n) => n.textContent.trim().replace(/\s+/g, "")),
      vertical: [...document.querySelectorAll(".vt-choice b")].map((n) => n.textContent.trim().replace(/\s+/g, "")),
    }));
    assert(card.classic.length >= 2, JSON.stringify(card));
    assert.deepEqual(card.vertical, card.classic);
    await assertPadHome(page, "chapter 3 card");
    // 東京の地図（最前面の <dialog>）は自分の作りで縦に並ぶ。外枠を引っ込め、回転案内は出さない
    await watchHint(page);
    await pressA(page);
    await page.waitForFunction(() => document.querySelector("dialog[open]") && document.querySelector(".vt-shell").hidden);
    await page.waitForTimeout(900);
    assert.equal(await hintSeen(page), false, "no rotate hint under the Tokyo dialog");
    await page.keyboard.press("Escape");
    await waitScene(page, "menu");
  }, { ...TALL, pageEntry: entry });

  await check("chapter-five-home-map", async (page) => {
    await waitScene(page, "title");
    await seedChapterFive(page);
    await page.reload();
    await waitScene(page, "title", 30000);
    await page.locator("#boot").waitFor({ state: "detached" });
    await arm(page);
    await page.locator(t("vt-title-load")).tap();
    await page.locator(t("slot-0")).waitFor({ state: "attached" });
    await page.evaluate(() => document.querySelector('[data-test="slot-0"]').click());
    await waitScene(page, "map", 40000);
    await page.waitForTimeout(800);
    assert.match(await page.locator(".vt-hud").textContent(), /第5章/);
    const spots = await page.evaluate(() => [...document.querySelectorAll(".vt-pin")].map((n) => n.dataset.spot));
    assert(spots.includes("ch5_to_tokyo"), `the trip to Tokyo is a pin: ${spots}`);
    await assertPadHome(page, "chapter 5 map");
  }, { ...TALL, pageEntry: entry });
}, { acknowledgeGrowth: false }); // 盤を自分で操作する（成長のお知らせを自動で閉じる仕組みは、開いた盤をすぐ閉じてしまう）
