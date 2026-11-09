// Isolated newState fixture, then real LOAD/map/home/grams/packing UI; not NEW GAME coverage.
// 旧 ds_packing.mjs。DS風の廃止（横画面一本化・2026-11-10）で DS の端末を外し、PC・スマホ横・縦持ち（回転ガード）の詰め方の配置を検査する。
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { confirmAppearanceSetup, prepareAppearanceCatalog } from "./appearance_setup.mjs";
import { confirmWaterSetup } from "./water_setup.mjs";
import { rotateThroughGuard } from "./rotate_guard.mjs";
prepareAppearanceCatalog();
const { chromium } = createRequire(import.meta.url)("playwright");
const base = process.env.BASE_URL || "http://127.0.0.1:8123/remake/";
const dir = process.env.ARTIFACT_DIR || ".codex/artifacts/packing-layout";
fs.mkdirSync(dir, { recursive: true });
const hash = text => createHash("sha256").update(text).digest("hex");
const write = (name, value) => fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + "\n");
const report = { sourceSHA: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  workingTree: execFileSync("git", ["status", "--short"], { encoding:"utf8" }).trim(),
  fixture: "isolated newState daily DAY6; subsequent progression uses real UI, no auto craft/turbo",
  base, cases: [] };
const b = (p, id) => p.locator(`[data-test="${id}"]`);
async function hit(p, id, touch) {
  const n = b(p, id); await n.scrollIntoViewIfNeeded();
  if (touch) await n.tap(); else await n.click();
}
async function ready(p) {
  await b(p, "title-new").waitFor({ timeout: 40000 });
  await p.locator("#boot").waitFor({ state: "detached", timeout: 40000 });
}
async function map(p, touch) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (await p.evaluate(() => document.body.dataset.screen === "map" && !document.body.classList.contains("vn-open"))) return;
    const choices = p.locator(".vn-choices.show button:not(:disabled)");
    try {
      if (await choices.count()) { if (touch) await choices.first().tap({ timeout: 600 }); else await choices.first().click({ timeout: 600 }); }
      else if (await p.evaluate(() => {
        const vn = document.querySelector("#vn.active");
        return vn && Number(getComputedStyle(vn).opacity) >= .99 && !!vn.querySelector(".vn-text")?.textContent;
      })) {
        if (touch) await p.locator("#vn.active .vn-box").tap({ timeout: 600 }); else await p.keyboard.press("Enter");
      }
    } catch (e) { if (e.name !== "TimeoutError") throw e; }
    await p.waitForTimeout(100);
  }
  assert.fail("LOAD did not reach map through real dialogue input");
}
async function geometry(p) {
  return p.evaluate(() => {
    const rect = n => { const r = n.getBoundingClientRect(); return { x:r.x, y:r.y, w:r.width, h:r.height, right:r.right, bottom:r.bottom }; };
    const pane = document.querySelector(".bench-right");
    const selectors = [".bench-head", ".bench-hint", ".bench-panel", ".pack-aroma", ".pack-vessel", ".pack-vessel-art", ".pack-vessel-art .art", ".pack-caption", ".pack-caption p", ".pack-choice", ".pack-choice b", ".pack-choice small", ".pack-footer small", ".pack-confirm"];
    return { windowX:scrollX, viewportWidth:innerWidth, pane:{ ...rect(pane), clientWidth:pane.clientWidth, scrollWidth:pane.scrollWidth, scrollLeft:pane.scrollLeft, scrollTop:pane.scrollTop, clientHeight:pane.clientHeight, scrollHeight:pane.scrollHeight },
      nodes:selectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(n => n.getClientRects().length).map(n => {
        const range = document.createRange(); range.selectNodeContents(n);
        return { selector, test:n.dataset.test, ...rect(n), text:n.textContent,
          textRects:[...range.getClientRects()].map(r => ({x:r.x,right:r.right})) };
      })) };
  });
}
function horizontal(g) {
  assert.equal(g.windowX, 0);
  assert(g.pane.x >= -1 && g.pane.right <= g.viewportWidth + 1,"control panel outside viewport");
  assert(g.pane.scrollWidth <= g.pane.clientWidth + 1, `packing scrolls horizontally: ${JSON.stringify(g.pane)}`);
  assert.equal(g.pane.scrollLeft, 0);
  for (const n of g.nodes) {
    assert(n.w > 0 && n.x >= g.pane.x - 1 && n.right <= g.pane.right + 1, `${n.selector} outside horizontal panel: ${JSON.stringify(n)}`);
    for (const r of n.textRects) assert(r.x >= g.pane.x - 1 && r.right <= g.pane.right + 1, `${n.selector} text clipped`);
  }
}
const devices = [
  { name:"pc", viewport:{width:1280,height:720}, touch:false },
  { name:"touch-landscape", viewport:{width:844,height:390}, touch:true },
  { name:"touch-small-landscape", viewport:{width:568,height:320}, touch:true },
  // #2789: スマホの縦持ちは回転ガードで止める（#2794）。作業台の水量と詰め方の工程で縦（390×844）へ回し、
  // ガードが入力を止めることを確かめ、横（844×390）へ戻して同じ工程から続ける。配置の検査は横で行う。
  { name:"touch-portrait-rotate", viewport:{width:844,height:390}, portrait:{width:390,height:844}, touch:true },
];
const benchState = p => p.evaluate(() => ({
  step: document.querySelector(".bench")?.dataset.step || null,
  water: document.querySelector('[data-test="water-meter"]')?.getAttribute("aria-valuenow") ?? null,
  pressed: [...document.querySelectorAll(".pack-choice")].map(n => n.getAttribute("aria-pressed")),
  pack: document.querySelector('[data-test="pack-vessel"]')?.dataset.pack ?? null,
  controls: ["water-confirm", "mix-ok", "pack-confirm", "hole-start"].filter(id => document.querySelector(`[data-test="${id}"]`)),
}));
async function guarded(p, device, step, ids) {
  if (!device.portrait) return;
  await rotateThroughGuard(p, { portrait:device.portrait, landscape:device.viewport, label:`${device.name}/${step}`,
    targets:ids.map(id => b(p, id)), state:() => benchState(p), touch:device.touch });
}
let browser;
try {
  browser = await chromium.launch({ headless:true, chromiumSandbox:true,
    ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath:process.env.CHROME_EXECUTABLE_PATH } : {}) });
  for (const device of devices) {
    const result = { ...device, status:"failed", inputs:[], resources:[], snapshots:[] };
    report.cases.push(result);
    const context = await browser.newContext({ viewport:device.viewport, ...(device.touch ? { isMobile:true, hasTouch:true } : {}) });
    const p = await context.newPage(); p.setDefaultTimeout(25000);
    const errors = [], pending = [];
    p.on("pageerror", e => errors.push(e.message));
    p.on("response", response => {
      if (/\.(js|css|json)(\?|$)/.test(response.url())) pending.push(response.body().then(body => result.resources.push({ url:response.url(), status:response.status(), sha256:hash(body),
        gitBlobSHA1:createHash("sha1").update(`blob ${body.length}\0`).update(body).digest("hex") })).catch(e => errors.push(e.message)));
    });
    await p.addInitScript(() => {
      try { localStorage.setItem("suien_step_intro", "off"); } catch {} // 選ぶ工程の初回説明（#3028）は配置検査の対象外（step_intro.mjs が検査）
      window.__packingInputs = [];
      for (const type of ["click", "pointerdown", "keydown"]) document.addEventListener(type, e => {
        window.__packingInputs.push({type, test:e.target.closest?.("[data-test]")?.dataset.test || null, key:e.key, pointerType:e.pointerType});
      }, true);
    });
    const snap = async label => {
      const g = await geometry(p); result.snapshots.push({label, geometry:g});
      await p.screenshot({path:path.join(dir, `${device.name}-${label}.png`)});
      write(`${device.name}-${label}.json`, g); return g;
    };
    try {
      await p.goto(base); await ready(p);
      result.fixture = await p.evaluate(async () => {
        const core = await import("./js/core/state.js"), s = core.newState();
        Object.assign(s, {phase:"daily",day:6,slot:0,money:45678,stamina:90,weatherSeed:4});
        Object.assign(s.flags, {_morning_6:true,_lime_tut:1,_lime_opened:true,_qa_ds678:"isolated"});
        s.owned.push("home_rig_set");
        // アルミを使うHMDで作り、穴あけ工程の盤面スケーリングを検査する（ロートスは穴あけを飛ばす/#1107）。
        s.owned = s.owned.filter(id => id !== "lotos_hagal"); s.owned.push("tanukish_lid"); s.equip.hms = "tanukish_lid";
        s.flavorStock = {double_apple:20,mint:10};
        // 心得の盤（通常プレイの既定・#2166）ではデンスパックはスキル K18 で覚える。3種類の詰め方を全部押すため覚えた状態にする
        // （覚える前に押せないことは growth_levelup.mjs の dense-pack-new-and-legacy が確かめる）
        const growth = await import("./js/core/growth.js");
        if (growth.growthEnabled()) { s.growth = growth.newGrowth(); s.growth.nodes.push("K18"); }
        localStorage.setItem(core.SAVE_KEY,JSON.stringify(s)); localStorage.setItem("suien_remake_slot1",JSON.stringify(s));
        return s;
      });
      write(`${device.name}-fixture.json`, result.fixture);
      await p.reload(); await ready(p);
      assert.equal(await p.locator('[data-test^="title-layout-"]').count(), 0, "no display switch (DS mode removed)");
      await hit(p,"title-load",device.touch); await hit(p,"slot-1",device.touch); await map(p,device.touch);
      // 作業台の表示検査は店の制作本体を直接呼ぶ（自宅練習は廃止）。
      await p.evaluate(() => { import("./js/craft/practice.js").then(m => m.runFullPractice()); });
      await confirmAppearanceSetup(p, { touch: device.touch });
      await guarded(p, device, "water", ["water-pour", "water-confirm"]);
      await confirmWaterSetup(p, { touch: device.touch });
      await b(p,"mix-ok").waitFor();
      assert.equal(await p.locator("body.game-ds").count(), 0);
      for (let n=0;n<10;n++) await hit(p,"mix-plus-double_apple",device.touch);
      for (let n=0;n<2;n++) await hit(p,"mix-plus-lemon",device.touch);
      await hit(p,"mix-ok",device.touch); await b(p,"pack-confirm").waitFor();
      for (const selector of [".pack-aroma", ".pack-vessel", ".pack-caption", ".pack-confirm"]) {
        assert(await p.locator(selector).isVisible(), `${selector} must be displayed`);
      }
      assert.equal(await p.locator(".pack-choice:visible").count(), 3);
      await guarded(p, device, "packing", ["opt-fluffy", "opt-firm", "pack-confirm"]);
      const initial = await snap("initial"); horizontal(initial);
      // Every option must receive actual input and update vessel, caption and pressed state.
      for (const [value,label] of [["fluffy","ふんわり"],["firm","デンスパック"],["normal","ノーマル"]]) {
        await hit(p,`opt-${value}`,device.touch);
        assert.equal(await b(p,`opt-${value}`).getAttribute("aria-pressed"),"true");
        assert.equal(await p.locator('.pack-choice[aria-pressed="true"]').count(),1);
        assert.equal(await b(p,"pack-vessel").getAttribute("data-pack"),value);
        assert.equal(await p.locator(".pack-caption b").textContent(),label);
        assert((await b(p,"pack-vessel").getAttribute("aria-label")).includes(label));
        horizontal(await snap(value));
      }
      // Vertical scrolling is intentional: each item must be reachable in its scroll panel.
      for (const selector of [".bench-hint", ".pack-aroma", ".pack-vessel", ".pack-caption", ".pack-choice", ".pack-confirm"]) {
        for (const n of await p.locator(selector).all()) {
          // The redundant header hint is intentionally display:none in packing.
          if (selector === ".bench-hint" && !await n.isVisible()) continue;
          assert(await n.isVisible(), `${selector} must be displayed`);
          await n.scrollIntoViewIfNeeded();
          const reachable = await n.evaluate(n => {
            const r=n.getBoundingClientRect(), pane=n.closest(".bench-right").getBoundingClientRect();
            return Math.min(r.bottom,pane.bottom,innerHeight)-Math.max(r.top,pane.top,0)>0;
          });
          assert(reachable, `${selector} cannot be reached vertically`);
        }
      }
      await b(p,"pack-confirm").scrollIntoViewIfNeeded(); horizontal(await snap("confirm-reached"));
      const selected = await p.locator('.pack-choice[aria-pressed="true"]').getAttribute("data-test");
      assert.equal(selected,"opt-normal");
      await hit(p,"pack-confirm",device.touch); await b(p,"hole-start").waitFor();
      assert.equal(await p.locator(".bench").getAttribute("data-step"),"holes");
      // 座標で操作する工程の盤面は形を保ったまま（760px基準に対するアルミの比）。
      const stage = await p.evaluate(() => ({ panel: document.querySelector(".bench-panel").getBoundingClientRect().width,
        foil: document.querySelector('[data-test="hole-preview"]').getBoundingClientRect().width }));
      assert(stage.panel > 0 && stage.foil > 0 && stage.foil <= stage.panel + 1, `foil surface outside its stage: ${JSON.stringify(stage)}`);
      assert.deepEqual(errors,[]); result.status="passed";
    } catch (e) {
      result.error=e.stack; console.error(`FAIL ${device.name}: ${e.stack}`);
      await p.screenshot({path:path.join(dir,`${device.name}-failed.png`)}).catch(()=>{});
    } finally {
      result.inputs=await p.evaluate(()=>window.__packingInputs).catch(()=>[]);
      await Promise.all(pending);
      result.errors = errors;
      if (errors.length) { result.status="failed"; result.error ||= `Runtime/resource errors: ${errors.join("; ")}`; }
      await context.close(); write("results.json",report);
    }
    console.log(`${result.status.toUpperCase()}: ${device.name}`);
  }
} catch(e) { report.launchError=e.stack; console.error(e.stack); }
finally { await browser?.close(); write("results.json",report); }
if (report.launchError || report.cases.length!==devices.length || report.cases.some(r=>r.status!=="passed")) process.exitCode=1;

