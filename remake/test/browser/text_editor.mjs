// 実エディタと実VNエンジンを同一書体・通常レイアウトで比較。ゲーム全体の起動や素材取得は不要。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { autoWrap, paginate } from "../../js/vn/text.js";
const { chromium } = createRequire(import.meta.url)("playwright");
const root = fileURLToPath(new URL("../../../", import.meta.url));
const cases = JSON.parse(fs.readFileSync(path.join(root, "remake/test/text_editor_cases.json"), "utf8"));
const editorURL = process.env.EDITOR_URL || "http://127.0.0.1:8321/";
const gameURL = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const artifacts = path.resolve(root, process.env.ARTIFACT_DIR || "work/text-editor-717");
fs.mkdirSync(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
const results = [], errors = [];
function watch(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on("request", request => assert(new URL(request.url()).hostname === "127.0.0.1", "Unexpected external request"));
}
const fixtureLines = cases.map((c, i) => ({ ...c, did: c.id, path: `0/lines/${i}` }));
async function mockEditor(page) {
  await page.route("**/api/files", route => route.fulfill({ json: ["fixture.json"] }));
  await page.route("**/api/lines?*", route => route.fulfill({ json: fixtureLines }));
}
// index.htmlと同じ全CSSの順序。boot/main.jsを起動せず、engine.playの実描画を検査。
const index = fs.readFileSync(path.join(root, "remake/index.html"), "utf8");
const styles = index.match(/<link rel="stylesheet"[^>]+>/g).join("\n");
const harness = `<!doctype html><html lang="ja"><meta charset="utf-8">${styles}<body><div id="viewport"><div id="stage">${["bg", "screen", "vn", "hud", "fx", "toasts", "banners", "wipe", "modal"].map(id => `<div id="${id}"></div>`).join("")}</div></div></body></html>`;
async function prepareGame(page) {
  await page.route(gameURL, route => route.fulfill({ contentType: "text/html", body: harness }));
  await page.goto(gameURL);
  await page.evaluate(async () => {
    const ui = await import("./js/core/ui.js"); ui.initLayers();
    const core = await import("./js/core/state.js"); core.newGame(); core.config.textSpeed = 4;
    window.engine = await import("./js/vn/engine.js");
    // 未知話者名や立ち絵・演出は対象外。本文・本心は本番関数で描画する。
    const fit = () => document.querySelector("#stage").style.setProperty("--k", Math.min(innerWidth / 1280, innerHeight / 720));
    addEventListener("resize", fit); fit();
    await Promise.all(["500", "700"].map(w => document.fonts.load(`${w} 20px "Suien Gothic"`, "水煙前線あA7")));
    await document.fonts.ready;
  });
}
async function snapshot(page) {
  return page.evaluate(() => {
    const text = document.querySelector(".vn-text"), inner = document.querySelector(".vn-inner"), box = document.querySelector(".vn-box");
    const style = getComputedStyle(text);
    const b = box.getBoundingClientRect();
    const contents = [text, ...(!inner.hidden ? [inner] : [])];
    return { text: text.innerHTML, inner: inner.hidden ? "" : inner.innerHTML,
      font: [style.fontFamily, style.fontSize, style.fontWeight, style.letterSpacing, style.lineHeight], width: text.clientWidth,
      fits: contents.every(el => {
        const r = el.getBoundingClientRect();
        return el.scrollWidth <= el.clientWidth + 1 && r.left >= b.left && r.right <= b.right + 1 && r.bottom <= b.bottom + 1;
      }) };
  });
}
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const editor = await context.newPage(); watch(editor); await mockEditor(editor); await editor.goto(editorURL);
  await editor.locator(".row").first().waitFor();
  for (const [label, viewport, size] of [["pc", { width:1280, height:720 }, "pc"], ["mobile", { width:844, height:390 }, "mobile"]]) {
    const game = await context.newPage(); watch(game); await game.setViewportSize(viewport); await prepareGame(game);
    const divisions = [];
    for (let i = 0; i < cases.length; i++) {
      const fixture = cases[i]; await editor.locator(".row").nth(i).click();
      await editor.waitForFunction(() => previewReady && previewPages.length > 0);
      await editor.locator("#preview-size").selectOption(size);
      const pages = await editor.evaluate(() => previewPages);
      const frame = editor.frames().find(f => f.url().endsWith("/preview.html"));
      await game.evaluate(line => {
        window.controller = new AbortController();
        window.played = engine.play({ dialogue_id:"editor-regression", lines:[{...line, portrait:false}, {type:"choice", choices:[{text:"終わり"}]}] }, { signal:controller.signal });
      }, fixture);
      for (let k = 0; k < pages.length; k++) {
        if (k) {
          await editor.locator("#next-page").click();
          await game.keyboard.press("Enter");
        }
        await game.locator(".vn-next.show").waitFor();
        // 同じ本文を残す本心継続でも、frameのpostMessage反映を待つ。
        await frame.waitForFunction(k => document.querySelector(".vn-box").dataset.page === String(k), k);
        const actual = await snapshot(game), preview = await snapshot(frame);
        assert.deepEqual(actual, preview, `${label}/${fixture.id}/${k}: engine vs editor`);
        assert(actual.fits, `${label}/${fixture.id}/${k}: overflow`);
        if ((fixture.id === "short-tail" || fixture.id === "inner") && k === pages.length - 1) {
          await game.screenshot({ path:path.join(artifacts, `${label}-${fixture.id}-${k + 1}-game.png`) });
          await editor.locator("#preview-host").screenshot({ path:path.join(artifacts, `${label}-${fixture.id}-${k + 1}-editor.png`) });
        }
      }
      await game.keyboard.press("Enter");
      await game.locator(".vn-choices.show").waitFor(); // 余分なページをエディタが見落としていない
      await game.evaluate(async () => { controller.abort(); await played; });
      divisions.push({ id:fixture.id, pages });
      console.log(`PASS ${label}/${fixture.id}: ${pages.length} pages`);
    }
    results.push({ label, divisions });
    await game.close();
  }
  assert.deepEqual(results[0].divisions, results[1].divisions, "PC/mobile splits differ");
  const tail = results[0].divisions.find(x => x.id === "short-tail").pages;
  assert.equal(tail.length, 2); assert(tail[1].text.endsWith("\n待った。"));
  assert(!tail.some(p => p.text === "待った。"));
  const manual = results[0].divisions.find(x => x.id === "manual").pages;
  assert(manual.map(p => p.text).join("\n").includes("\n\n"), "Manual blank line lost");
  assert.equal(results[0].divisions.find(x => x.id === "inside-word").pages[0].text, "シー\nシャを作る");
  assert(results[0].divisions.find(x => x.id === "inner").pages.every(p => !p.text.includes("\n")));
  assert(results[0].divisions.find(x => x.id === "ignored-inner").pages.every(p => !p.inner));
  // UTF-16 offsetを使ってクリック改行を入れる。保存APIには送らない。
  await editor.locator(".row").last().click();
  const original = cases.at(-1).text;
  await editor.locator(".grid .ch").filter({hasText:"シ"}).first().click();
  assert.equal(await editor.locator("#src").inputValue(), original.replace("シーシャ", "\nシーシャ"));
  await editor.locator(".grid .br").click(); assert.equal(await editor.locator("#src").inputValue(), original);
  // 旧版の2行単位の分割で末尾が孤立していたことを固定する。
  const oldRows = autoWrap(cases.find(c => c.id === "short-tail").text).split("\n");
  assert.equal(oldRows.at(-1), "待った。"); assert.equal(oldRows.length, 3);
  assert.equal(paginate(cases.find(c => c.id === "short-tail").text)[1].split("\n").at(-1), "待った。");
  // 必要時のみ修正前画面を撮る。現行サーバーはそのまま、HTMLだけmainの保存物で置換。
  if (process.env.BASELINE_EDITOR_HTML) {
    const baseline = await context.newPage(); watch(baseline); await mockEditor(baseline);
    await baseline.route(editorURL, route => route.fulfill({ contentType:"text/html", body:fs.readFileSync(process.env.BASELINE_EDITOR_HTML, "utf8") }));
    await baseline.goto(editorURL); await baseline.locator(".row").nth(2).click();
    for (const [label, viewport] of [["pc", {width:1280,height:720}], ["mobile", {width:844,height:390}]]) {
      await baseline.setViewportSize(viewport);
      await baseline.screenshot({ path:path.join(artifacts, `${label}-short-tail-before.png`), fullPage:true });
    }
    await baseline.close();
  }
  if (process.env.BASELINE_ENGINE_JS) {
    for (const [label, viewport] of [["pc", {width:1280,height:720}], ["mobile", {width:844,height:390}]]) {
      const before = await context.newPage(); watch(before); await before.setViewportSize(viewport);
      await before.route("**/js/vn/engine.js", route => route.fulfill({ contentType:"text/javascript", body:fs.readFileSync(process.env.BASELINE_ENGINE_JS, "utf8") }));
      await prepareGame(before);
      for (const id of ["short-tail", "inner"]) {
        const line = cases.find(c => c.id === id);
        const expected = results.find(r => r.label === label).divisions.find(c => c.id === id).pages;
        await before.evaluate(line => {
          window.controller = new AbortController();
          window.played = engine.play({ dialogue_id:"before", lines:[{...line, portrait:false}, {type:"choice", choices:[{text:"終わり"}]}] }, {signal:controller.signal});
        }, line);
        for (let k = 0; k < expected.length; k++) {
          if (k) await before.keyboard.press("Enter");
          await before.locator(".vn-next.show").waitFor();
          const actual = await snapshot(before);
          // afterと同じformatHtml/sliceHtmlで表示される。元エンジンの分割を保存する。
          const plain = actual.text.replaceAll("<br>", "\n").replace(/<[^>]*>/g, "");
          assert.equal(plain, expected[k].text.replace(/\[\/?[a-z]+\]/g, "").replace(/\n$/, ""), `${label}/${id}: before-engine split changed`);
        }
        await before.screenshot({ path:path.join(artifacts, `${label}-${id}-before-game.png`) });
        await before.keyboard.press("Enter"); await before.locator(".vn-choices.show").waitFor();
        await before.evaluate(async () => { controller.abort(); await played; });
      }
      await before.close();
    }
  }
  assert.deepEqual(errors, [], "Browser errors");
  await context.close();
} finally {
  fs.writeFileSync(path.join(artifacts, "results.json"), JSON.stringify({ results, errors }, null, 2) + "\n");
  await browser.close();
}
