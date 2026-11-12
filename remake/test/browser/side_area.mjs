// 左右の余白の活用（YHK）: 煙と縁・縦書きの帯・親指ボタン。
// 画面方針（#3035）のとおりステージは固定 1280×720 のまま。余白の幅で出す物が段になり、主流のスマホ（19:9〜20:9）では
// 余白のボタンがステージの中のボタンの代わりになる。余白の無い画面・狭い画面・マウスの PC・DS風では今までどおり。
// 自動操作のブラウザは既定で親指ボタンを出さない（既存の検査がステージの中のボタンを押すため）。ここでは
// localStorage の suien_side_pad を "on" にして明示する。既定そのものは 2 つ目のスイートで確かめる。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const t = (id) => `[data-test="${id}"]`;
const PHONE = { viewport: { width: 852, height: 393 }, isMobile: true, hasTouch: true }; // iPhone 相当（19.5:9）
const padOn = () => { try { localStorage.setItem("suien_side_pad", "on"); } catch { /* noop */ } };

const mode = (page) => page.evaluate(() => ({ side: document.documentElement.dataset.side, pad: document.documentElement.dataset.sidePad }));
const live = (page, id) => page.locator(`${t(`side-${id}`)}[data-live="true"]`);
const idle = (page, id) => page.locator(`${t(`side-${id}`)}[data-live="false"]`);

/** 余白の部品の置き場所: ステージの外・画面の中・ボタンは切り欠きの帯（縦の 3〜7 割）を避ける・押す所は実寸 44px 以上 */
async function geometry(page) {
  return page.evaluate(() => {
    const box = (n) => { const r = n.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height }; };
    const stage = box(document.getElementById("stage"));
    const k = stage.height / 720;
    const buttons = [...document.querySelectorAll('.side-btn[data-live="true"]')].map((n) => ({ id: n.dataset.pad, side: n.closest(".side").dataset.side, ...box(n) }));
    const strip = document.querySelector(".side-strip");
    const shown = !strip.hidden && getComputedStyle(strip).display !== "none";
    const part = (n) => shown && n ? { text: n.textContent, font: parseFloat(getComputedStyle(n).fontSize) * k, ...box(n) } : null;
    return { stage, k, vw: innerWidth, vh: innerHeight, buttons, strip: part(strip), chapter: part(strip.querySelector("small")), city: part(strip.querySelector("b")), when: part(strip.querySelector("span")) };
  });
}
function assertPlacement(g, label) {
  const bandTop = g.stage.top + g.stage.height * 0.3, bandBottom = g.stage.top + g.stage.height * 0.7;
  for (const b of g.buttons) {
    const where = `${label} ${b.id} ${JSON.stringify(b)}`;
    assert(b.left >= -0.5 && b.right <= g.vw + 0.5 && b.top >= -0.5 && b.bottom <= g.vh + 0.5, `画面からはみ出している: ${where}`);
    assert(b.side === "l" ? b.right <= g.stage.left + 0.5 : b.left >= g.stage.right - 0.5, `ステージに掛かっている: ${where}`);
    assert(b.width >= 44 && b.height >= 44, `押す所が実寸 44px 未満: ${where}`);
    assert(b.bottom <= bandTop + 0.5 || b.top >= bandBottom - 0.5, `切り欠きの帯（縦の 3〜7 割）に掛かっている: ${where}`);
  }
  // 帯はステージの端から 50px 以内の1列（切り欠きより内側）で、下の角のボタンより上で終わる
  if (g.strip) {
    assert(g.strip.right <= g.stage.left + 0.5 && g.strip.left >= g.stage.left - 50 * g.k - 0.5 && g.strip.left >= -0.5, `${label}: 帯の置き場所 ${JSON.stringify(g.strip)}`);
    assert(g.strip.top >= g.stage.top && g.strip.bottom <= bandBottom, `${label}: 帯が下へ伸びすぎ ${JSON.stringify(g.strip)}`);
  }
}

/** 第1章 DAY5 の昼の地図（本物の日常ループ）。 */
async function toMap(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    const s = core.newGame();
    Object.assign(s, { phase: "daily", chapter: 1, day: 5, slot: 0, money: 42000, stamina: 80, weatherSeed: 1234 });
    Object.assign(s.flags, { _morning_5: true, _errand_scout_done: true, _delivery_adam_done: true, _delivery_minto_done: true,
      _lime_tut: 1, _lime_opened: true, _intro_minto: true, known_name_minto: true });
    for (const id of ["minto", "naru", "adam", "tsumugi", "rio"]) s.met[id] = true;
    s.contacts.push("minto", "naru", "tsumugi");
    core.save(); core.load();
    (await import("./js/chapters/ch1.js")).setupHooks();
    (await import("./js/core/ui.js")).clearScreen();
    window.sideRun = (await import("./js/daily/calendar.js")).runDaily({ untilDay: 14, nightEvents: {} })
      .catch((error) => { window.sideError = String(error.stack || error); });
  });
  await page.locator("#screen .map:not(.done)").waitFor({ timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]'));
}

/** 第1章 DAY5 の夜の会話（つむぎの2本目の冒頭。地の文から始まる）。 */
async function toTalk(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js");
    core.newGame();
    Object.assign(core.state, { phase: "daily", chapter: 1, day: 5, slot: 1 });
    core.config.textSpeed = 4;
    for (const id of ["sumi", "tsumugi"]) core.state.met[id] = true;
    (await import("./js/core/ui.js")).clearScreen();
    void (await import("./js/vn/engine.js")).play("ch1_tsumugi_second", { bg: "res://assets/backgrounds/bg_tonari_inside_night.png" });
  });
  await page.locator(".vn-next.show").waitFor();
  await page.waitForTimeout(400); // 会話を開いた直後の誤送り防止（0.32 秒）が明けるまで
}
const vnText = (page) => page.locator("#vn .vn-text").evaluate((n) => n.textContent);

await suite("side-area", async check => {
  await check("title-shows-smoke-only", async page => {
    assert.deepEqual(await mode(page), { side: "wide", pad: "on" });
    const state = await page.evaluate(() => ({
      layers: [...document.querySelectorAll(".side")].map((n) => { const r = n.getBoundingClientRect(); return { side: n.dataset.side, display: getComputedStyle(n).display, left: r.left, right: r.right, width: r.width }; }),
      stage: (() => { const r = document.getElementById("stage").getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width, height: r.height }; })(),
      strip: document.querySelector(".side-strip").hidden,
      liveButtons: document.querySelectorAll('.side-btn[data-live="true"]').length,
      smoke: getComputedStyle(document.querySelector(".side-smoke")).animationName,
      backdrop: getComputedStyle(document.getElementById("backdrop")).filter,
    }));
    // ステージは固定のまま（#3035）。余白の層は左右の余白ちょうどに重なる
    assert(Math.abs(state.stage.height - 393) < 1 && Math.abs(state.stage.width - 393 * 16 / 9) < 1, JSON.stringify(state.stage));
    const [l, r] = state.layers;
    assert.equal(l.display, "block");
    assert(Math.abs(l.left) < 0.5 && Math.abs(l.right - state.stage.left) < 0.5, JSON.stringify(l));
    assert(Math.abs(r.left - state.stage.right) < 0.5 && Math.abs(r.right - 852) < 0.5, JSON.stringify(r));
    // タイトルでは帯もボタンも出さない。ぼかしと煙だけ
    assert.equal(state.strip, true);
    assert.equal(state.liveButtons, 0);
    assert.equal(state.smoke, "side-drift");
    assert.match(state.backdrop, /blur\(/);
  }, PHONE);

  await check("conversation-pads", async page => {
    await toTalk(page);
    await live(page, "next").waitFor();
    const g = await geometry(page);
    assert.deepEqual(g.buttons.map((b) => b.id).sort(), ["auto", "config", "glossary", "log", "next", "skip"]);
    assertPlacement(g, "会話");
    // 帯: 章・街・日付と時間帯。字は実寸 11.5px 以上、日付は 12.5px 以上
    assert.equal(g.chapter.text, "第一章");
    assert.equal(g.city.text, "橙須");
    assert.equal(g.when.text, "五日目・夜");
    assert(g.chapter.font >= 11.4 && g.when.font >= 12.4 && g.city.font >= 18, JSON.stringify([g.chapter.font, g.when.font, g.city.font]));
    // ステージの中: 用語・設定も含めて余白へ出した5つは隠れる
    const inStage = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("#vn .vn-ctl")].map((n) => [n.dataset.test, getComputedStyle(n).visibility !== "hidden" && getComputedStyle(n).display !== "none" && n.getClientRects().length > 0])));
    assert.deepEqual(inStage, { "vn-auto": false, "vn-skip": false, "vn-log": false, "vn-glossary": false, "vn-config": false });

    // 用語も右上から開閉でき、開いている間は送りを止める。
    await page.locator(t("side-glossary")).tap();
    await page.locator(".glossary-modal").waitFor();
    await idle(page, "next").waitFor({ state: "attached" });
    await page.keyboard.press("Escape");
    await live(page, "next").waitFor();

    // 次へ: 押すたびに会話が進む
    const first = await vnText(page);
    await page.locator(t("side-next")).tap();
    await page.waitForFunction((before) => document.querySelector("#vn .vn-text").textContent !== before, first);
    // AUTO: 元のボタンと同じ状態になる。もう一度押すと切れる
    await page.locator(t("side-auto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed") === "true");
    await page.locator(`${t("side-auto")}[aria-pressed="true"]`).waitFor();
    await page.locator(t("side-auto")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-auto"]').getAttribute("aria-pressed") === "false");
    await page.locator(`${t("side-auto")}[aria-pressed="false"]`).waitFor();
    // SKIP も同じ（入れたら面を押して止める＝次へで止まる）
    await page.locator(t("side-skip")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-skip"]').getAttribute("aria-pressed") === "true");
    await page.locator(t("side-skip")).tap();
    await page.waitForFunction(() => document.querySelector('[data-test="vn-skip"]').getAttribute("aria-pressed") === "false");

    // LOG: 開いている間は余白のボタンを下げ、押しても会話は進まない
    await page.locator(".vn-next.show").waitFor();
    await page.locator(t("side-log")).tap();
    await page.locator("#vn .vn-log.show").waitFor();
    await idle(page, "next").waitFor({ state: "attached" });
    await idle(page, "auto").waitFor({ state: "attached" });
    const held = await vnText(page);
    await page.evaluate(() => { for (const id of ["next", "auto", "skip"]) document.querySelector(`[data-test="side-${id}"]`).click(); });
    await page.waitForTimeout(250);
    assert.equal(await vnText(page), held);
    assert.equal(await page.locator(t("vn-auto")).getAttribute("aria-pressed"), "false");
    await page.keyboard.press("Escape");
    await page.locator("#vn .vn-log.show").waitFor({ state: "detached" }).catch(() => page.waitForFunction(() => !document.querySelector("#vn .vn-log.show")));
    await live(page, "next").waitFor();

    // 設定（右上の札）を開いている間も、余白のボタンは効かない
    await page.locator(t("side-config")).tap();
    await page.locator(".cfg-modal").waitFor();
    await idle(page, "next").waitFor({ state: "attached" });
    const behind = await vnText(page);
    await page.evaluate(() => document.querySelector('[data-test="side-next"]').click());
    await page.waitForTimeout(200);
    assert.equal(await vnText(page), behind);
  }, PHONE);

  await check("map-pads", async page => {
    await toMap(page);
    await live(page, "menu").waitFor();
    await live(page, "lime").waitFor();
    assert.equal(await page.evaluate(() => window.sideError || null), null);
    const g = await geometry(page);
    assert.deepEqual(g.buttons.map((b) => b.id).sort(), ["lime", "menu"]);
    assertPlacement(g, "地図");
    assert.equal(g.when.text, "五日目・昼");
    // ステージの中の LIME・MENU は見えない（場所は残す）
    const hidden = await page.evaluate(() => [".hud-lime", ".hud-menu"].map((sel) => { const n = document.querySelector(`#hud ${sel}`); return [getComputedStyle(n).visibility, n.getBoundingClientRect().width > 0]; }));
    assert.deepEqual(hidden, [["hidden", true], ["hidden", true]]);
    // 未読の数は余白の LIME に写る
    await page.evaluate(async () => (await import("./js/daily/hud.js")).setPhoneBadge(3));
    await page.waitForFunction(() => document.querySelector('[data-test="side-lime"] .side-badge').textContent === "3" && !document.querySelector('[data-test="side-lime"] .side-badge').hidden);

    // MENU: 余白から開く。開いている間は余白のボタンを下げ、押しても LIME は開かない
    await page.locator(t("side-menu")).tap();
    await page.locator("#modal .dmenu").waitFor();
    await idle(page, "menu").waitFor({ state: "attached" });
    await idle(page, "lime").waitFor({ state: "attached" });
    await page.evaluate(() => document.querySelector('[data-test="side-lime"]').click());
    await page.waitForTimeout(250);
    assert.equal(await page.locator(".phone-overlay").count(), 0);
    await page.locator(t("menu-close")).click();
    await page.locator("#modal .dmenu").waitFor({ state: "detached" });
    await live(page, "menu").waitFor();

    // LIME: 余白から開く。開いている間は MENU が開かない
    await page.locator(t("side-lime")).tap();
    await page.locator(".phone-overlay").waitFor();
    await idle(page, "lime").waitFor({ state: "attached" });
    await page.evaluate(() => document.querySelector('[data-test="side-menu"]').click());
    await page.waitForTimeout(250);
    assert.equal(await page.locator("#modal .dmenu").count(), 0);
    await page.locator(t("phone-close")).first().click();
    await page.locator(".phone-overlay").waitFor({ state: "detached" });
    await live(page, "lime").waitFor();
  }, PHONE);

  // 主流の Android（20:9）と、少し広い 21:9。置き場所の決まりが同じように守られる
  for (const [label, width, height] of [["android-20x9", 915, 412], ["wide-21x9", 960, 411]]) {
    await check(label, async page => {
      assert.deepEqual(await mode(page), { side: "wide", pad: "on" });
      await toTalk(page);
      await live(page, "next").waitFor();
      assertPlacement(await geometry(page), `${label} 会話`);
      await page.locator(t("side-next")).tap();
    }, { viewport: { width, height }, isMobile: true, hasTouch: true });
  }

  await check("narrow-gutter-keeps-stage-buttons", async page => {
    // 18:9（余白はステージ上 80px）: 煙と縁、縦書きの帯だけ。ボタンはステージの中のまま
    assert.deepEqual(await mode(page), { side: "mid", pad: "off" });
    await toMap(page);
    await page.locator(`${t("side-strip")}:not([hidden])`).waitFor({ state: "attached" });
    const g = await geometry(page);
    assert.equal(g.buttons.length, 0);
    assert.equal(g.city.text, "橙須");
    assert.equal(g.when.text, "五日目・昼");
    assertPlacement(g, "18:9");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#hud .hud-menu")).visibility), "visible");
    await page.locator(t("hud-menu")).tap();
    await page.locator("#modal .dmenu").waitFor();
  }, { viewport: { width: 786, height: 393 }, isMobile: true, hasTouch: true });

  await check("desktop-16x9-unchanged", async page => {
    assert.deepEqual(await mode(page), { side: "off", pad: "off" });
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll(".side")].map((n) => getComputedStyle(n).display)), ["none", "none"]);
  });

  await check("ultrawide-mouse-has-no-pads", async page => {
    // 横長の PC: 煙と縁・帯は出すが、マウスでは余白のボタンに替えない
    assert.deepEqual(await mode(page), { side: "wide", pad: "off" });
    await toMap(page);
    await page.locator(`${t("side-strip")}:not([hidden])`).waitFor({ state: "attached" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#hud .hud-menu")).visibility), "visible");
    assert.equal(await page.locator('.side-btn[data-live="true"]').count(), 0);
  }, { viewport: { width: 2560, height: 1080 } });

  await check("tablet-top-bottom-margins-unchanged", async page => {
    assert.deepEqual(await mode(page), { side: "off", pad: "off" });
  }, { viewport: { width: 1024, height: 768 }, isMobile: true, hasTouch: true });

  await check("setting-switches-back-to-blur-only", async page => {
    await page.locator(t("title-config")).click();
    await page.locator(".cfg-modal").waitFor();
    await page.locator(`${t("cfg-side-area")} button[value="plain"]`).click();
    assert.deepEqual(await mode(page), { side: "off", pad: "off" });
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config") || "{}").sideArea), "plain");
    await page.locator(`${t("cfg-side-area")} button[value="full"]`).click();
    assert.deepEqual(await mode(page), { side: "wide", pad: "on" });
  }, PHONE);

  await check("retro-look-keeps-plain-margins", async page => {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "retro");
    assert.deepEqual(await mode(page), { side: "off", pad: "off" });
  }, { ...PHONE, pageEntry: `${baseURL}?look=retro` });

  await check("neo-look-pads", async page => {
    // プレイヤーの既定の様式（新版）でも同じ
    assert.equal(await page.evaluate(() => document.documentElement.dataset.look), "neo");
    await toTalk(page);
    await live(page, "next").waitFor();
    assertPlacement(await geometry(page), "新版 会話");
    const first = await vnText(page);
    await page.locator(t("side-next")).tap();
    await page.waitForFunction((before) => document.querySelector("#vn .vn-text").textContent !== before, first);
    await page.locator(t("side-log")).tap();
    await page.locator("#vn .vn-log.show").waitFor();
    await idle(page, "next").waitFor({ state: "attached" });
  }, { ...PHONE, pageEntry: `${baseURL}?look=neo` });
}, { initScript: padOn });

// 自動操作のブラウザの既定: 親指ボタンは出さず、ステージの中のボタンのまま（既存の検査の前提）。煙と縁・帯は出る。
await suite("side-area-default", async check => {
  await check("automation-keeps-stage-buttons", async page => {
    assert.deepEqual(await mode(page), { side: "wide", pad: "off" });
    await toMap(page);
    await page.locator(`${t("side-strip")}:not([hidden])`).waitFor({ state: "attached" });
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector("#hud .hud-menu")).visibility), "visible");
    assert.equal(await page.locator('.side-btn[data-live="true"]').count(), 0);
    await page.locator(t("hud-menu")).tap();
    await page.locator("#modal .dmenu").waitFor();
  }, PHONE);
});
