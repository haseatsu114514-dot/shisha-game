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
        await page.selectOption("#preview-scene","hiyori");
        await page.locator(".vn-next.show").waitFor();
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
        await page.selectOption("#preview-scene","twolines");
        await page.locator(".vn-next.show").waitFor();
        const twoLines = await page.locator(".vn-text").evaluate(el => {
          const range = document.createRange(); range.selectNodeContents(el);
          const rows = [...range.getClientRects()].filter(r=>r.width>0);
          const tops = [...new Set(rows.map(r=>Math.round(r.top)))];
          const controls = document.querySelector(".vn-controls").getBoundingClientRect();
          const text = el.getBoundingClientRect();
          const box = el.closest(".vn-box").getBoundingClientRect();
          const next = document.querySelector(".vn-next").getBoundingClientRect();
          const nameEl = document.querySelector(".vn-name");
          const name = nameEl.getBoundingClientRect();
          const nameRange = document.createRange(); nameRange.selectNodeContents(nameEl);
          const nameGlyph = nameRange.getBoundingClientRect();
          const scale = box.width / 1216;
          const overlaps = (a,b) => a.right>b.left && a.left<b.right && a.bottom>b.top && a.top<b.bottom;
          return { count:tops.length, contained:rows.every(r=>r.bottom<=text.bottom+1 && r.left>=text.left-1 && r.right<=text.right+1),
            footerClear:next.bottom<=box.bottom-39*scale,
            nameAligned:Math.abs(nameGlyph.left-text.left)<=.5,
            nameInFrame:name.top>=box.top-4*scale && name.bottom<=text.top-2*scale,
            clear:!overlaps(next,controls) && !overlaps(name,controls) && rows.every(r=>!overlaps(r,next) && !overlaps(r,name)),
            toolbarAbove:controls.bottom<=box.top-10*scale && controls.left>box.left+box.width/2,
            margins:[(text.left-box.left)/scale,(box.right-text.right)/scale],
            overlap:rows.some(r=>r.right>controls.left && r.left<controls.right && r.bottom>controls.top && r.top<controls.bottom) };
        });
        assert.equal(twoLines.count,2,"two full lines render in every theme");
        if(id==="smoke" || id==="smoke-purple") {
          assert(twoLines.nameAligned,"smoke name glyphs align with the main text left edge");
          assert(twoLines.nameInFrame,"smoke name stays connected to the upper text panel instead of floating outside it");
        }
        assert(twoLines.contained,"both lines fit inside the text area");
        assert(!twoLines.overlap,"controls do not cover either text line");
        assert(twoLines.clear,"name, next indicator, toolbar and actual text glyphs remain separate");
        assert(twoLines.footerClear,"next indicator leaves a clear margin above the visible paper/footer edge, including its 4px bob");
        assert(twoLines.toolbarAbove,"all toolbars stay above the frame on the right");
        assert(twoLines.margins[0]>=99.9 && twoLines.margins[1]>=83.9,"reserve space for visible folds and smoke, beyond glyph bounds");
        await page.selectOption("#preview-scene","narration");
        await page.locator(".vn-box.narration").waitFor();
        assert.equal(await page.locator(".vn-name").evaluate(el=>getComputedStyle(el).display),"none");
        await page.selectOption("#preview-scene","hiyori");
        await page.locator(".vn-next.show").waitFor();
        await page.waitForTimeout(350);
        await page.locator(".vn-text").click();
        await page.locator(".vn-box.has-inner .vn-inner:not([hidden])").waitFor();
        await page.locator(".vn-next.show").waitFor();
        const innerFits = await page.evaluate(() => {
          const glyphs = selector => {
            const range=document.createRange(); range.selectNodeContents(document.querySelector(selector));
            return [...range.getClientRects()].filter(r=>r.width>0);
          };
          const rows = [...glyphs(".vn-text"),...glyphs(".vn-inner")];
          const box = document.querySelector(".vn-box").getBoundingClientRect();
          const next = document.querySelector(".vn-next").getBoundingClientRect();
          const controls = document.querySelector(".vn-controls").getBoundingClientRect();
          const overlaps=(a,b)=>a.right>b.left && a.left<b.right && a.bottom>b.top && a.top<b.bottom;
          return rows.every(r=>r.bottom<box.bottom-12 && r.left>=box.left && r.right<=box.right && !overlaps(r,next) && !overlaps(r,controls));
        });
        assert(innerFits,"main and inner voice glyphs stay inside the frame and clear of controls/next");
      }
      assert.equal(new Set(colors).size,6,"every theme must actually repaint common panels");
      assert.equal(new Set(frames).size,6,"each selected frame/colorway loads its corresponding artwork");
      for(const layout of layouts) assert.deepEqual(layout,layouts[0],"skins share text, frame and upper-right toolbar geometry");
      assert.deepEqual(await storageSnapshot(page),saved,"preview never persists preferences or games");
      await page.selectOption("#preview-theme","smoke");
      const paddedNameFits = await page.evaluate(async () => {
        const name=document.querySelector(".vn-name");
        const original=name.textContent, originalFont=name.style.fontSize;
        name.textContent="SHISHA-9000";
        name.style.fontSize='var(--vn-name-fit-size,48px)';
        const {createNameFit}=await import("./js/vn/name-fit.js");
        const fit=createNameFit(name); fit.fit();
        const range=document.createRange(); range.selectNodeContents(name);
        const text=range.getBoundingClientRect(), box=name.getBoundingClientRect(), style=getComputedStyle(name);
        const scale=box.width/name.offsetWidth;
        const fits=text.left>=box.left+parseFloat(style.paddingLeft)*scale-.5 && text.right<=box.right-parseFloat(style.paddingRight)*scale+.5;
        fit.dispose(); name.textContent=original; name.style.fontSize=originalFont;
        return fits;
      });
      assert(paddedNameFits,"long names respect the padding inside a nameplate");
      await page.click("#preview-light");
      assert.equal(await page.locator(".vn-light-overlay").evaluate(el=>getComputedStyle(el).display),"block");
      assert.equal(await page.locator(".vn-light-overlay").evaluate(el=>getComputedStyle(el).pointerEvents),"none");
      await page.emulateMedia({reducedMotion:"reduce"});
      assert.equal(await page.locator(".vn-light-overlay").evaluate(el=>getComputedStyle(el).display),"none");
      await page.emulateMedia({reducedMotion:"no-preference"});
      await page.click("#preview-light");
      assert.deepEqual(await storageSnapshot(page),saved,"light prototype does not persist settings");
      await page.click("#preview-kit");
      await page.selectOption("#preview-scene","choices");
      await page.locator(".vn-next.show").waitFor();
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.locator('[data-test="choice-0"]').waitFor();
      assert(await page.locator(".vn-choices").evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector(".vn-controls").getBoundingClientRect().top - 4),"choices leave a gap above toolbar");
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


await suite("blue-window-character-preview",async check=>{
  for(const viewport of [{width:1280,height:768},{width:844,height:438}]) {
    await check(String(viewport.width),async page=>{
      await page.locator(".vn-next.show").waitFor();
      const saved=await storageSnapshot(page);
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"heisei-blue");
      for(const [id,name] of [["minto","みんと"],["ageha","あげは"],["tsumugi","つむぎ"],["hiyori","ひより"]]) {
        await page.selectOption("#preview-character",id);
        await page.locator(".vn-next.show").waitFor();
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator(".vn-name").textContent(),name);
        const rendered=await page.evaluate(()=>{
          const text=document.querySelector(".vn-text"),name=document.querySelector(".vn-name"),sprite=document.querySelector("img.portrait");
          const rect=sel=>document.querySelector(sel).getBoundingClientRect();
          const range=document.createRange();range.selectNodeContents(text);
          const rows=[...range.getClientRects()].filter(r=>r.width>0);
          const ctl=rect(".vn-controls"),next=rect(".vn-next"),label=name.getBoundingClientRect();
          const overlap=(a,b)=>a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;
          return {lines:new Set(rows.map(r=>Math.round(r.top))).size,
            clear:rows.every(r=>!overlap(r,ctl)&&!overlap(r,next)&&!overlap(r,label)),
            portrait:sprite.complete&&sprite.naturalWidth>0?new URL(sprite.src).pathname:null,
            font:getComputedStyle(text).fontFamily};
        });
        assert.equal(rendered.lines,2);
        assert(rendered.clear,"blue preview text is clear of name, controls and next indicator");
        assert(rendered.portrait?.includes("/"+id+"/"),"use the official character sprite");
        assert(rendered.font.includes("Suien Blue Mincho"));
      }
      assert.deepEqual(await storageSnapshot(page),saved,"character comparison never writes saves/config");
      await page.selectOption("#preview-theme","smoke");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"smoke");
      await page.selectOption("#preview-theme","heisei-blue");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"heisei-blue","blue theme is selectable from the dropdown after leaving it");
      assert.deepEqual(await storageSnapshot(page),saved);
    },{viewport});
  }
},{entry:new URL("conversation-preview.html?theme=heisei-blue&character=minto",baseURL).href,readySelector:".vn-box"});
