// CONTINUE の見た目の候補 A 熾火（ember）・C 漫画の大ゴマ（manga）（CV58・#2524）。
// 本編のプレビュー（continue-preview.html）で、2択・台詞・「進む」が実寸44px以上で画面内に収まり、
// 再挑戦と時間切れが最後まで進み、飾りが当たることを PC とスマホ横持ちで確かめる。
// 本編の切り替え（?continueLook=…・端末に覚える・既定は neon）も確かめる。
// サーバーを8123で起動後: node remake/test/continue_looks.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = (process.env.BASE_URL || "http://127.0.0.1:8123/remake/").replace(/\/?$/, "/");
const LOOKS = ["ember", "manga"];
// 操作欄を隠すと、プレビューは上下22pxの余白で 1280×720 を収める（スマホ横は本編より小さく映る＝厳しめ）。
const VIEWPORTS = [{ width: 1280, height: 764 }, { width: 844, height: 390 }];
const errors = [];

async function open(viewport, layout, { character = "0", loss = 2 } = {}) {
  const page = await browser.newPage({ viewport });
  page.on("pageerror", error => errors.push(`${layout} ${viewport.width}: ${error.message}`));
  await page.goto(`${base}continue-preview.html?layout=${layout}`);
  await page.waitForFunction(() => !document.getElementById("preview-play").disabled);
  await page.evaluate(({ character, loss }) => {
    document.getElementById("preview-tools").style.display = "none";
    document.getElementById("character").value = character;
    document.getElementById("loss").value = String(loss);
    document.getElementById("preview-se").checked = false;
    document.getElementById("preview-bgm").checked = false;
    dispatchEvent(new Event("resize"));
  }, { character, loss });
  await page.clock.install();
  await page.evaluate(() => document.getElementById("preview-play").click());
  await page.clock.runFor(1200);
  return page;
}
// 画面内の実寸（CSS px）。見えない要素は null。
const box = (page, selector) => page.evaluate(sel => {
  const node = document.querySelector(sel);
  if (!node || !node.checkVisibility({ visibilityProperty: true })) return null;
  const r = node.getBoundingClientRect(), s = document.querySelector(".gameover").getBoundingClientRect();
  if (!r.width || !r.height) return null;
  return { w: r.width, h: r.height, left: r.left - s.left, top: r.top - s.top, right: s.right - r.right, bottom: s.bottom - r.bottom };
}, `.gameover ${selector}`);
function assertTouch(rect, label) {
  assert.ok(rect, `${label}: 見えている`);
  assert.ok(rect.w >= 44 && rect.h >= 44, `${label}: 実寸44px以上（${rect.w.toFixed(1)}×${rect.h.toFixed(1)}）`);
  for (const side of ["left", "top", "right", "bottom"]) assert.ok(rect[side] >= -0.5, `${label}: 画面内（${side} ${rect[side].toFixed(1)}）`);
}

try {
  for (const layout of LOOKS) for (const viewport of VIEWPORTS) {
    const tag = `${layout} ${viewport.width}x${viewport.height}`;
    const page = await open(viewport, layout, { character: layout === "manga" ? "lover:rio" : "0" });
    const shape = await page.evaluate(() => {
      const root = document.querySelector(".gameover");
      return { layout: root.dataset.layout, atmosphere: !!root.querySelector(".go-atmosphere"),
        sparks: root.querySelectorAll(".go-ember-sparks i").length, light: !!root.querySelector(".go-look-light"),
        frames: root.querySelectorAll(".go-manga-frames polygon").length, name: root.querySelector(".go-look-name")?.textContent || null,
        decorHidden: [...root.querySelectorAll(".go-look-back, .go-look-fore")].every(n => n.getAttribute("aria-hidden") === "true") };
    });
    assert.equal(shape.layout, layout, `${tag}: 配置が当たる`);
    assert.equal(shape.atmosphere, false, `${tag}: neon の煙と光は作らない`);
    assert.ok(shape.decorHidden, `${tag}: 飾りは読み上げない`);
    if (layout === "ember") { assert.equal(shape.sparks, 30, `${tag}: 火の粉`); assert.ok(shape.light, `${tag}: 人物を照らす光`); }
    if (layout === "manga") { assert.equal(shape.frames, 4, `${tag}: コマ枠4つ`); assert.equal(shape.name, "凛想", `${tag}: 吹き出しの名札は話者`); }

    const retry = await box(page, '[data-test="retry"]'), quit = await box(page, '[data-test="game-over-title"]');
    assertTouch(retry, `${tag} 再挑戦`); assertTouch(quit, `${tag} 諦める`);
    assertTouch(await box(page, ".go-dialogue"), `${tag} 台詞`);
    assert.ok(retry.left + retry.w <= quit.left + 0.5 || retry.top + retry.h <= quit.top + 0.5, `${tag}: 2択が重ならない`);
    const count = await box(page, ".go-count");
    assert.ok(count && count.left >= 0 && count.right >= 0 && count.top >= 0, `${tag}: 残り秒数が画面内`);

    await page.click('.gameover [data-test="retry"]');
    assert.equal(await page.getAttribute(".gameover", "data-choice"), "retry", `${tag}: 選択が届く`);
    await page.clock.runFor(300); // 選んだ枠を180ms残してから「進む」に替わる
    assertTouch(await box(page, ".go-proceed"), `${tag} 進む`);
    if (layout === "manga") {
      assertTouch(await box(page, ".go-retry"), `${tag} 選んだコマが残る`);
      assert.equal(await box(page, ".go-quit"), null, `${tag}: 選ばなかったコマは消える`);
    }
    await page.clock.runFor(6000); // 反応の台詞を読み終えると本編の処理が自動で抜ける
    assert.match(await page.textContent("#preview-error"), /戻る反応のプレビュー完了/, `${tag}: 再挑戦の流れが最後まで進む`);
    await page.close();
  }

  // 時間切れ（2敗目）: GAME OVER が大きく見え、2択と時計は消える
  for (const layout of LOOKS) {
    const page = await open(VIEWPORTS[0], layout);
    await page.clock.runFor(21000);
    assert.equal(await page.getAttribute(".gameover", "data-timed-out"), "true", `${layout}: 20秒で時間切れ`);
    assert.equal(await box(page, '[data-test="retry"]'), null, `${layout}: 時間切れ後は2択を出さない`);
    assert.equal(await box(page, ".go-count"), null, `${layout}: 時間切れ後は時計を出さない`);
    const over = await box(page, ".go-title-art");
    assert.ok(over && over.w > 600 && over.h > 150, `${layout}: GAME OVER が大きく見える`);
    await page.close();
  }

  // 本編の切り替え: 既定は neon。?continueLook= で端末に覚え、neon で戻す。知らない値は無視する。
  {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    page.on("pageerror", error => errors.push(`switch: ${error.message}`));
    await page.goto(`${base}continue-preview.html`);
    await page.waitForFunction(() => !document.getElementById("preview-play").disabled);
    const seen = await page.evaluate(async () => {
      localStorage.removeItem("suien_continue_look");
      const { continueLayoutSetting } = await import("./js/chapters/continue-looks.js");
      const { buildGameOver } = await import("./js/chapters/gameover.js");
      const at = query => { history.replaceState(null, "", `?${query}`); return continueLayoutSetting(); };
      const built = () => { const root = buildGameOver({ variant: 0, soundEffects: false }); const value = root.dataset.layout; root.cleanupContinue?.(); return value; };
      const result = { fresh: at(""), freshBuilt: built() };
      result.manga = at("continueLook=manga"); result.remembered = at(""); result.mangaBuilt = built();
      result.unknown = at("continueLook=sign"); result.ember = at("continueLook=ember");
      result.back = at("continueLook=neon"); result.backBuilt = built();
      localStorage.removeItem("suien_continue_look");
      return result;
    });
    assert.deepEqual(seen, { fresh: "neon", freshBuilt: "neon", manga: "manga", remembered: "manga", mangaBuilt: "manga",
      unknown: "manga", ember: "ember", back: "neon", backBuilt: "neon" }, "本編の切り替え");
    await page.close();
  }
  assert.deepEqual(errors, [], "ページエラーなし");
  console.log("continue_looks: ok（A 熾火・C 漫画 × PC/スマホ横、再挑戦・時間切れ・本編の切り替え）");
} finally {
  await browser.close();
}
