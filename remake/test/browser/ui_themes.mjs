import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot, assertFits } from "./support.mjs";

const themes = ["smoke", "smoke-purple", "cut-paper", "amber", "tissue", "classic"];
await suite("ui-themes-preview", async check => {
  for (const viewport of [{ width:1280, height:768 }, { width:844, height:438 }]) {
    await check(`${viewport.width}`, async page => {
      await page.locator(".vn-next.show").waitFor();
      const saved = await storageSnapshot(page);
      const layouts = [], colors = [], frames = [];
      await page.click("#preview-kit");
      for (const id of themes) {
        await page.selectOption("#preview-theme", id);
        await page.waitForTimeout(200); // 既存ボタンの色のtransitionを待つ。
        assert.equal(await page.locator("html").getAttribute("data-ui-theme"), id);
        await assertFits(page,".vn-text, .vn-controls, .ui-sample-panel, .ui-sample-actions .btn");
        const painted = await page.evaluate(() => {
          const box = document.querySelector(".vn-box"), text = document.querySelector(".vn-text"), ctl = document.querySelector(".vn-controls");
          const rect = el => { const r=el.getBoundingClientRect(); return [r.x,r.y,r.width,r.height]; };
          const card=document.querySelector(".ui-sample-panel"), style=getComputedStyle(card);
          return { layout:[...rect(text),...rect(box),...rect(ctl)], color:style.backgroundColor,
            frame:getComputedStyle(box,"::before").backgroundImage,
            heights:[...document.querySelectorAll(".vn-ctl")].map(b=>parseFloat(getComputedStyle(b).minHeight)) };
        });
        assert(painted.heights.every(h=>h>=44));
        layouts.push(painted.layout); colors.push(painted.color); frames.push(painted.frame);
        await page.selectOption("#preview-scene","narration");
        await page.locator(".vn-box.narration").waitFor();
        assert.equal(await page.locator(".vn-name").evaluate(el=>getComputedStyle(el).display),"none");
        await page.selectOption("#preview-scene","hiyori");
        await page.locator(".vn-next.show").waitFor();
      }
      assert.equal(new Set(colors).size,6,"every theme must actually repaint common panels");
      assert.equal(new Set(frames).size,6,"each selected frame/colorway loads its corresponding artwork");
      for(const layout of layouts) assert.deepEqual(layout,layouts[0],"skins preserve dialogue/controls geometry");
      assert.deepEqual(await storageSnapshot(page),saved,"preview never persists preferences or games");
      await page.click("#preview-kit");
      await page.selectOption("#preview-scene","choices");
      await page.locator(".vn-next.show").waitFor();
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.locator('[data-test="choice-0"]').click();
      await page.locator(".vn-next.show").waitFor();
      await page.locator(".vn-text").click();
      await page.waitForFunction(()=>document.querySelector("#preview-status").textContent.includes("会話終了"));
    },{viewport});
  }
},{entry:new URL("conversation-preview.html",baseURL).href,readySelector:".vn-box"});

await suite("ui-themes-config",async check=>{
  await check("persist-and-revert",async page=>{
    const key="suien_remake_save";
    await page.evaluate(async()=>{
      const core=await import("./js/core/state.js");
      localStorage.setItem(core.SAVE_KEY,JSON.stringify(core.newState()));
    });
    const saved=await page.evaluate(key=>localStorage.getItem(key),key);
    await page.locator('[data-test="title-config"]').click();
    for(const id of [...themes,"smoke-purple"]){
      await page.selectOption('[data-test="ui-theme-select"]',id);
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),id);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("suien_remake_config")).uiTheme),id);
    }
    assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved,"theme selection must not rewrite a game save");
    await page.reload();
    await page.locator('[data-test="title-config"]').waitFor();
    assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"smoke-purple");
    await page.evaluate(()=>localStorage.setItem("suien_remake_config",JSON.stringify({uiTheme:"unknown-old-skin"})));
    await page.reload();
    await page.locator('[data-test="title-config"]').waitFor();
    assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"smoke","unknown skin safely uses the default");
  });
});
