// No installs or media needed. PLAYWRIGHT_MODULE may point to an existing cache.
// フォーム部品の実寸 16px 以上とダブルタップ保険の検査（#2852）。
// These are Chromium checks, not evidence of iOS Safari gesture recognition.
import assert from "node:assert/strict";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const missing = new Set();
const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const file = resolve(root, `.${pathname}`);
  const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
  if (!file.startsWith(root + sep) || !types[extname(file)]) { res.writeHead(404).end(); return; }
  try { const body = await readFile(file); res.writeHead(200, { "Content-Type": types[extname(file)] }).end(body); }
  catch { missing.add(pathname); res.writeHead(404).end(); }
});
await new Promise(r => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}) });
  for (const size of [{ width: 844, height: 390 }, { width: 844, height: 340 }]) {
    const context = await browser.newContext({ viewport: size, isMobile: true, hasTouch: true });
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      return url.origin === origin && /\.(html|js|css|json)$/.test(url.pathname) ? route.continue() : route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(`${origin}/remake/index.html?titleLayout=normal`);
    await page.waitForFunction(() => document.body.dataset.screen === "title" && !document.querySelector("#boot:not(.done)"));
    await page.waitForTimeout(800);
    // (1) フォーム部品の実寸: 設定画面の select / text input を stage 倍率込みで測る（#2852）
    await page.locator('[data-test="title-config"]').click();
    const forms = await page.evaluate(() => {
      const k = Number(document.querySelector("#stage").style.getPropertyValue("--k"));
      const extra = document.createElement("input"); extra.type = "text"; extra.className = "probe"; document.querySelector("#stage").append(extra);
      return [...document.querySelectorAll("select"), extra].map(el => ({ tag: el.tagName, real: parseFloat(getComputedStyle(el).fontSize) * k }));
    });
    assert(forms.length >= 2, "config has a select to measure");
    for (const f of forms) assert(f.real >= 15.99, `${f.tag} real font ${f.real.toFixed(2)}px >= 16px at ${size.width}x${size.height}`);
    // (2) JS 保険: iOS の WebKit だけに入る。Chromium（Android 相当）では入らず、本物の click をそのまま通す。
    //     判定そのものは force で同じモジュールを入れて確かめる: 300ms 以内・30px 以内の 2 回目 touchend は
    //     preventDefault、離れた/遅い/1 回目は通す
    const scope = await page.evaluate(async () => {
      const m = await import("/remake/js/core/double-tap-guard.js");
      return { installed: Boolean(window.__suienDoubleTapGuard), needs: m.needsDoubleTapGuard(window),
        iosLike: m.needsDoubleTapGuard({ ongesturestart: null, navigator: { maxTouchPoints: 5 } }),
        macSafari: m.needsDoubleTapGuard({ ongesturestart: null, navigator: { maxTouchPoints: 0 } }),
        forced: m.installDoubleTapGuard(document, { force: true }) };
    });
    assert.deepEqual(scope, { installed: false, needs: false, iosLike: true, macSafari: false, forced: true }, "guard scope: " + JSON.stringify(scope));
    const out = await page.evaluate(async () => {
      const el = document.createElement("div");
      el.style.cssText = "position:fixed;left:0;top:0;width:200px;height:200px;z-index:99999";
      document.body.append(el);
      let clicks = 0; el.addEventListener("click", () => clicks++);
      const fire = (x, y) => {
        const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y });
        const e = new TouchEvent("touchend", { bubbles: true, cancelable: true, changedTouches: [t], touches: [] });
        el.dispatchEvent(e); return e.defaultPrevented;
      };
      const wait = ms => new Promise(r => setTimeout(r, ms));
      const r = {};
      r.first = fire(50, 50);
      await wait(100); r.second = fire(60, 55);          // 近接・速い → 止める
      await wait(100); r.third = fire(60, 55);           // 直前が止めた2回目なので 1 回目扱い
      await wait(100); r.far = fire(150, 150);           // 30px 超 → 通す
      await wait(400); r.slow = fire(150, 150);          // 300ms 超 → 通す
      r.clicks = clicks; el.remove(); return r;
    });
    assert.deepEqual([out.first, out.second, out.third, out.far, out.slow], [false, true, false, false, false], JSON.stringify(out));
    assert.equal(out.clicks, 1, "the prevented second tap re-dispatches one click: " + JSON.stringify(out));
    // (3) body 直下の要素にも touch-action: manipulation が効く
    const bodyTouch = await page.evaluate(() => [...document.body.children].filter(el => el.matches("#rotate-hint")).map(el => getComputedStyle(el).touchAction + "|" + getComputedStyle(document.body).touchAction));
    assert(bodyTouch.every(v => v.includes("manipulation")), "body-level elements covered: " + bodyTouch);
    // (4) viewport meta はピンチ拡大を奪わない
    assert.doesNotMatch(await page.evaluate(() => document.querySelector('meta[name="viewport"]').content), /maximum-scale|user-scalable/);
    assert.deepEqual(errors, [], "no runtime errors");
    console.log(`${size.width}x${size.height} OK`, JSON.stringify({ forms, out, bodyTouch }));
    await context.close();
  }
} finally { await browser?.close(); await new Promise(r => server.close(r)); }
