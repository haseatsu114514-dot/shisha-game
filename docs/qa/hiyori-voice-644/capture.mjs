// #644 ひよりの台詞改稿の表示確認。本番VNで各場面を1ページずつ送り、
// 吹き出し・心の声がはみ出さないかをPC／タッチで検査し、代表場面を撮影する。
// 使い方: python3 remake/tools/serve_preview.py --port 8123 & node docs/qa/hiyori-voice-644/capture.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const { chromium } = createRequire(import.meta.url)("playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.env.OUT_DIR || here;
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";

const SCENES = [
  "hiyori_meeting", "hiyori_sumi_message", "hiyori_shop_message", "hiyori_cracks", "hiyori_tonari_followup",
  "hiyori_shop_repeat_0", "hiyori_shop_repeat_3", "hiyori_axe_reveal", "hiyori_axe_reveal_close",
  "hiyori_work_talk", "confession_hiyori_accept",
];
// 撮影する台詞（部分一致）。心の声の行は、心の声が出た状態も撮る。
const SHOTS = {
  hiyori_meeting: ["名字が朝霧"],
  hiyori_cracks: ["手首まで心細くて"],
  hiyori_shop_repeat_3: ["朝露と紅茶", "固形物の味", "だから儚いって", "か細い音", "最後のささやき"],
  hiyori_axe_reveal_close: ["よっしゃあああ", "だから儚いんだってば", "煙ごと吸われて", "木霊の声"],
};
const DEVICES = [["pc", {}], ["touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]];

const browser = await chromium.launch({ headless: true });
const report = { base, devices: {} };
try {
  for (const [device, options] of DEVICES) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...options });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    page.setDefaultTimeout(15000);
    await page.goto(base, { waitUntil: "load" });
    await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
    await page.locator("#boot").waitFor({ state: "detached" });
    await page.evaluate(async () => {
      window.Q = { core: await import("./js/core/state.js"), vn: await import("./js/vn/engine.js"),
        ch1: await import("./js/chapters/ch1.js") };
      Q.ch1.setupHooks();
      const s = Q.core.newGame();
      Object.assign(s, { phase: "daily", day: 12, slot: 1 });
      Q.core.save();
    });
    const rows = [];
    for (const scene of SCENES) {
      await page.evaluate(id => { Q.done = false; Q.vn.vnTest.turbo = false; Q.p = Q.vn.play(id).then(() => { Q.done = true; }); }, scene);
      const taken = new Set();
      let pages = 0;
      for (let i = 0; i < 400; i++) {
        const ready = await page.waitForFunction(() => Q.done || document.querySelector("#vn.active .vn-next.show")
          || document.querySelector(".vn-choices.show"), null, { timeout: 5000 }).then(() => true).catch(() => false);
        if (await page.evaluate(() => Q.done)) break;
        if (!ready) { await page.locator("#stage").click({ position: { x: 20, y: 20 } }).catch(() => {}); continue; }
        if (await page.locator(".vn-choices.show").count()) { await page.locator(".vn-choice").first().click(); continue; }
        await page.waitForTimeout(120);
        const state = await page.evaluate(() => {
          const text = document.querySelector(".vn-text");
          const inner = document.querySelector(".vn-inner");
          const stage = document.getElementById("stage").getBoundingClientRect();
          const box = document.querySelector(".vn-box").getBoundingClientRect();
          const over = n => n && n.scrollHeight > n.clientHeight + 1;
          return { text: text?.innerText || "", inner: inner && !inner.hidden ? inner.innerText : "",
            textOverflow: over(text), innerOverflow: inner && !inner.hidden ? over(inner) : false,
            boxInside: box.left >= stage.left - 1 && box.right <= stage.right + 1 && box.bottom <= stage.bottom + 1 };
        });
        pages++;
        assert(!state.textOverflow && !state.innerOverflow && state.boxInside,
          `${device} ${scene}: overflow at「${state.text}」${state.inner}`);
        for (const key of SHOTS[scene] || []) {
          const tag = `${key}${state.inner ? "+inner" : ""}`;
          if (state.text.replace(/\s/g, "").includes(key) && !taken.has(tag)) {
            taken.add(tag);
            const file = `${device}-${scene}-${[...taken].length}.png`;
            await page.screenshot({ path: path.join(out, file) });
            rows.push({ scene, file, text: state.text.replace(/\n/g, ""), inner: state.inner });
          }
        }
        await page.locator(".vn-box").click();
      }
      assert(await page.evaluate(() => Q.done), `${device} ${scene}: did not finish`);
      rows.push({ scene, pages, finished: true });
    }
    // AUTO と SKIP で、心の声のある見せ場が最後まで送れることを確かめる。
    for (const [mode, scene] of [["vn-auto", "hiyori_shop_repeat_3"], ["vn-skip", "hiyori_axe_reveal_close"]]) {
      await page.evaluate(id => { Q.done = false; Q.p = Q.vn.play(id).then(() => { Q.done = true; }); }, scene);
      await page.locator("#vn.active").waitFor();
      await page.locator(`[data-test="${mode}"]`).click();
      await page.waitForFunction(() => Q.done, null, { timeout: 90000 });
      await page.evaluate(() => { document.body.classList.remove("vn-skip"); });
      rows.push({ scene, mode, finished: true });
    }
    assert.deepEqual(errors, [], `${device}: browser errors`);
    report.devices[device] = rows;
    await context.close();
    console.log(`[hiyori-voice-644] PASS: ${device}`);
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, "verification.json"), JSON.stringify(report, null, 2) + "\n");
}
