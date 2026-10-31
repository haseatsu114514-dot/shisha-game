import assert from "node:assert/strict";
import { suite, baseURL, storageSnapshot, assertFits } from "./support.mjs";

async function commandGeometry(page) {
  return page.evaluate(()=>{
    const stage=document.querySelector("#stage").getBoundingClientRect(), scale=stage.width/1280;
    const controls=document.querySelector(".vn-controls"), buttons=[...controls.querySelectorAll(".vn-ctl")];
    const labels=buttons.map(button=>{const r=document.createRange();r.selectNodeContents(button);return r.getBoundingClientRect();});
    return [controls.getBoundingClientRect(),...buttons.map(b=>b.getBoundingClientRect()),...labels]
      .flatMap(r=>[(r.left-stage.left)/scale,(r.top-stage.top)/scale,r.width/scale,r.height/scale]);
  });
}
function fixedCommands(actual,expected,state) {
  assert.equal(actual.length,expected.length);
  assert(actual.every((value,i)=>Math.abs(value-expected[i])<.1),`command cells and labels must not move for ${state}`);
}

// 操作札に設けた小さな隙間の下が、透明な余白ではなく原画の上辺かを確認する。
async function paintedAttachment(page) {
  return page.evaluate(async()=>{
    const box=document.querySelector('.vn-box'), r=box.getBoundingClientRect(), scale=document.querySelector("#stage").getBoundingClientRect().width/1280;
    const style=getComputedStyle(box,'::before');
    const src=/url\(["']?([^"')]+)["']?\)/.exec(style.backgroundImage)[1];
    const img=new Image();img.src=src;await img.decode();
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(parseFloat(style.width));canvas.height=Math.ceil(parseFloat(style.height));
    const context=canvas.getContext('2d');context.drawImage(img,0,0,canvas.width,canvas.height);
    return ['.vn-name','.vn-controls'].map(selector=>{
      const tab=document.querySelector(selector).getBoundingClientRect();
      const gap=selector==='.vn-name'?4:12;
      const y=Math.round((tab.bottom-r.top)/scale-parseFloat(style.top)+gap);
      const start=Math.ceil((tab.left-r.left)/scale-parseFloat(style.left)+20);
      const end=Math.floor((tab.right-r.left)/scale-parseFloat(style.left)-20);
      let painted=0,total=0;
      for(let x=start;x<end;x+=8){total++;if(y>=0&&y<canvas.height&&context.getImageData(x,y,1,1).data[3]>=128)painted++;}
      return painted/total;
    });
  });
}

const themes = ["smoke", "smoke-purple", "cut-paper", "amber", "tissue", "classic", "paper"];
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
        const fixedHeader=await commandGeometry(page);
        layouts.push(painted.layout); colors.push(painted.color); frames.push(painted.frame);
        await page.selectOption("#preview-scene","twolines");
        await page.locator(".vn-next.show").waitFor();
        fixedCommands(await commandGeometry(page),fixedHeader,id+" two lines");
        const attached=await paintedAttachment(page);
        assert(attached.every(coverage=>coverage>=.75),`the painted surface must begin within 4px below names and 12px below controls: ${id} ${attached}`);
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
          const scale = document.querySelector("#stage").getBoundingClientRect().width / 1280;
          const overlaps = (a,b) => a.right>b.left && a.left<b.right && a.bottom>b.top && a.top<b.bottom;
          return { count:tops.length, contained:rows.every(r=>r.bottom<=text.bottom+1 && r.left>=text.left-1 && r.right<=text.right+1),
            footerClear:next.bottom<=box.bottom-15*scale,
            nameCentered:Math.abs((nameGlyph.left+nameGlyph.right)/2-(name.left+name.right)/2)<=2*scale,
            nameOnEdge:name.top<box.top-12*scale && name.bottom>=box.top+8*scale && name.bottom<=text.top-12*scale,
            clear:!overlaps(next,controls) && !overlaps(name,controls) && rows.every(r=>!overlaps(r,next) && !overlaps(r,name)),
            headerAttached:controls.top<box.top-12*scale && controls.bottom>=box.top-3*scale && controls.bottom<=text.top-12*scale && controls.left>box.left+box.width/2,
            rightGap:(controls.right-box.right)/scale,
            sceneOpen:box.height/scale<=192 && (box.top-document.querySelector("#stage").getBoundingClientRect().top)/scale>=500,
            headerOffset:((name.top+name.height/2)-(controls.top+controls.height/2))/scale,
            typeRatios:[parseFloat(getComputedStyle(nameEl).fontSize)/parseFloat(getComputedStyle(el).fontSize),parseFloat(getComputedStyle(document.querySelector(".vn-ctl")).fontSize)/parseFloat(getComputedStyle(el).fontSize)],
            margins:[(text.left-box.left)/scale,(box.right-text.right)/scale],
            overlap:rows.some(r=>r.right>controls.left && r.left<controls.right && r.bottom>controls.top && r.top<controls.bottom) };
        });
        assert.equal(twoLines.count,2,"two full lines render in every theme");
        assert(twoLines.nameCentered,"speaker text is centered in its own tab");
        assert(twoLines.nameOnEdge,"name tab protrudes above and overlaps the body edge");
        assert(twoLines.sceneOpen,"dialogue leaves the central scene open above the lower quarter");
        assert(twoLines.contained,"both lines fit inside the text area");
        assert(!twoLines.overlap,"controls do not cover either text line");
        assert(twoLines.clear,"name, next indicator, toolbar and actual text glyphs remain separate");
        assert(twoLines.footerClear,"next indicator leaves a clear margin above the visible paper/footer edge, including its 2px bob");
        assert(twoLines.headerAttached,"toolbar shares the frame header on the right and clears the body text");
        // 紙とラベンダーは、操作札を名前札と同じ高さに置き、右端を紙の窓（本文の箱より8px外）の端にそろえる（DUI18）。
        if(id==="paper"){
          assert(Math.abs(twoLines.headerOffset)<=.5,"paper controls sit level with the name tab");
          assert(Math.abs(twoLines.rightGap-8)<=.5,`paper controls end at the window edge: ${twoLines.rightGap}`);
        }else{
          assert(Math.abs(twoLines.headerOffset-(id.startsWith("smoke")?8:16))<=.5,"controls leave the intended space above the main window");
          assert(twoLines.rightGap<=-32,"toolbar stays inside the frame header");
        }
        assert(twoLines.typeRatios[0]>=.7 && twoLines.typeRatios[0]<=.9,"name text stays subordinate to the dialogue");
        assert(twoLines.typeRatios[1]>=.45 && twoLines.typeRatios[1]<=.65,"command text is a quieter third level");
        assert(twoLines.margins[0]>=95.9 && twoLines.margins[1]>=95.9,"reserve space for visible folds and smoke, beyond glyph bounds");
        await page.selectOption("#preview-scene","narration");
        await page.locator(".vn-box.narration").waitFor();
        assert.equal(await page.locator(".vn-name").evaluate(el=>getComputedStyle(el).display),"none");
        fixedCommands(await commandGeometry(page),fixedHeader,id+" narration");
        if(id==="cut-paper") assert((await page.locator(".vn-box").evaluate(el=>getComputedStyle(el,"::before").backgroundImage)).includes("vn-calm/paper.webp"),"speech and narration share one unlabelled soft panel");
        await page.locator(".vn-next.show").waitFor();
        await page.waitForTimeout(350);
        await page.locator(".vn-text").click();
        await page.locator(".vn-box.thought").waitFor();
        await page.locator(".vn-next.show").waitFor();
        fixedCommands(await commandGeometry(page),fixedHeader,id+" thought");
        await page.selectOption("#preview-scene","hiyori");
        await page.locator(".vn-next.show").waitFor();
        await page.locator('[data-test="vn-auto"]').click();
        fixedCommands(await commandGeometry(page),fixedHeader,id+" AUTO on (including label centering)");
        await page.locator('[data-test="vn-auto"]').click();
        fixedCommands(await commandGeometry(page),fixedHeader,id+" AUTO off");
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
        fixedCommands(await commandGeometry(page),fixedHeader,id+" inner voice");
      }
      assert.equal(new Set(colors).size,themes.length,"every theme must actually repaint common panels");
      assert.equal(new Set(frames).size,themes.length,"each selected frame/colorway loads its corresponding artwork");
      for(let i=0;i<layouts.length;i++) assert.deepEqual(layouts[i].slice(4,8),layouts[i<2?0:2].slice(4,8),"smoke variants share the wider body; optical text offsets do not change the body geometry");
      assert.deepEqual(await storageSnapshot(page),saved,"preview never persists preferences or games");
      await page.selectOption("#preview-theme","smoke");
      await page.locator(".vn-next.show").waitFor();
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
      const choiceHeader=await commandGeometry(page);
      await page.selectOption("#preview-scene","choices");
      await page.locator(".vn-next.show").waitFor();
      await page.waitForTimeout(350);
      await page.locator(".vn-text").click();
      await page.locator('[data-test="choice-0"]').waitFor();
      fixedCommands(await commandGeometry(page),choiceHeader,"choices");
      assert(await page.locator(".vn-choices").evaluate(el => el.getBoundingClientRect().bottom <= document.querySelector(".vn-controls").getBoundingClientRect().top - 4),"choices leave a gap above toolbar");
      await page.locator('[data-test="choice-0"]').click();
      await page.locator(".vn-next.show").waitFor();
      await page.locator(".vn-text").click();
      await page.waitForFunction(()=>document.querySelector("#preview-status").textContent.includes("会話終了"));
    },{viewport});
  }
  await check("font-and-background-preview",async page=>{
    await page.locator('.vn-next.show').waitFor();
    const saved=await storageSnapshot(page);
    let release, requested;
    const gate=new Promise(resolve=>{release=resolve;});
    const started=new Promise(resolve=>{requested=resolve;});
    // 会話用の明朝は会話開始前に先読みされる（vn-fonts.js）。読み込みを止めた状態で開き直し、
    // 先読みが届く前にテーマを切り替えても仮の書体で本文を出さないことを確かめる。
    await page.route('**/ZenOldMincho-Blue-Regular.woff2',async route=>{requested();await gate;await route.continue();});
    try {
      await page.reload({waitUntil:"load"});
      await page.locator('#preview-theme:enabled').waitFor();
      await Promise.race([started,new Promise((_,reject)=>setTimeout(()=>reject(new Error("Reading font was not preloaded")),3000))]);
      await page.selectOption('#preview-theme','cut-paper');
      assert.equal(await page.locator('.vn-text').textContent(),'','do not paginate or reveal dialogue in a temporary fallback font');
      assert.equal(await page.locator('.vn-next.show').count(),0,'a loading scene must not retain the old next indicator');
    } finally { release(); }
    await page.locator('.vn-next.show').waitFor();
    assert(await page.evaluate(()=>document.fonts.check('400 28px "Suien Blue Mincho"','今日はここで')));
    for(const [background,asset] of [['tonari','bg_tonari_inside_day'],['street','bg_street_night'],['eden','bg_eden_shop']]) {
      await page.selectOption('#preview-background',background);
      await page.locator('.vn-next.show').waitFor();
      assert(await page.locator('#bg .bg-img.show').evaluate((node,id)=>getComputedStyle(node).backgroundImage.includes(id),asset));
      await assertFits(page,'.vn-box,.vn-controls');
    }
    assert.deepEqual(await storageSnapshot(page),saved,'font and background previews do not modify saves/config');
  });
},{entry:new URL("conversation-preview.html?theme=smoke",baseURL).href,readySelector:".vn-box"});

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
    assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"paper","unknown skin safely uses the default");
  });
  for (const [label, options, touch] of [
    ["ingame-config-pc", { viewport: { width: 1280, height: 720 } }, false],
    ["ingame-config-touch", { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }, true],
  ]) {
    await check(label, async page => {
      const press = async sel => {
        const loc = page.locator(sel);
        if (touch) await loc.tap(); else await loc.click();
      };
      await page.evaluate(async () => {
        const core = await import("./js/core/state.js");
        const s = core.newGame();
        Object.assign(s, { chapter: 1, phase: "daily", day: 6, slot: 0, money: 34567, stamina: 88, seed: 1234, weatherSeed: 4 });
        Object.assign(s.met, { sumi: true, tsumugi: true });
        Object.assign(s.flags, {
          _morning_6: true, _errand_scout_done: true,
          _delivery_adam_done: true, _delivery_minto_done: true, _delivery_report_done: true,
          _c_station_registered: true, _lime_tut: 1, _lime_opened: true,
          _intro_hajime: true, _intro_sumi: true,
          _ev_first_practice: true, _ev_midcheck: true, _ev_salaryman: true,
          _ev_day5: true, _ev_meet_rivals: true, _qa_marker: "keep-progress",
        });
        Object.assign(core.config, { textSpeed: 2, voiceBlip: true, uiTheme: "classic" });
        core.saveConfig();
        core.save();
        (await import("./js/scenes/title.js")).showTitle();
      });
      await press('[data-test="title-load"]');
      await press('[data-test="slot-0"]');
      if (await page.locator('[data-test="confirm-load"]').count()) await press('[data-test="confirm-load"]');
      // DAY6の再開時に固定会話が先に入ることがある。読み飛ばしてから地図のMENUを試す。
      await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = true; });
      for (let i = 0; i < 60 && !(await page.locator("#screen .map:not(.done)").isVisible()); i++) {
        const choice = page.locator("#vn.active .vn-choices button").first();
        if (await choice.isVisible().catch(() => false)) await choice.click(); else await page.waitForTimeout(500);
      }
      await page.locator("#screen .map:not(.done)").waitFor({ timeout: 30000 });
      await page.evaluate(async () => { (await import("./js/vn/engine.js")).vnTest.turbo = false; });
      const savedBefore = await page.evaluate(() => localStorage.getItem("suien_remake_save"));
      await press('[data-test="hud-menu"]');
      await assertFits(page, '.menu-modal .modal-actions .btn');
      await press('[data-test="menu-config"]');
      await page.locator("#modal.show .cfg").waitFor();
      await page.selectOption('[data-test="cfg-text-speed"]', "1");
      await press('[data-test="cfg-voice-blip"]');
      await page.selectOption('[data-test="ui-theme-select"]', "amber");
      const menuCfg = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config")));
      assert.equal(menuCfg.textSpeed, 1);
      assert.equal(menuCfg.voiceBlip, false);
      assert.equal(menuCfg.uiTheme, "amber");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"), "amber");
      assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), savedBefore, "MENU config must not overwrite save");
      await press('[data-test="cfg-close"]');
      await page.locator("#modal.show").waitFor({ state: "hidden" });

      await page.evaluate(async () => {
        const { play, vnTest, backlog } = await import("./js/vn/engine.js");
        vnTest.turbo = false;
        backlog().length = 0;
        window.__cfgVnDone = false;
        window.__cfgVnPromise = play({
          dialogue_id: "qa_ingame_config_vn",
          lines: [
            { speaker: "sumi", face: "normal", text: "会話の途中でも、読みやすさの設定を開いて文字の速さを変えられるよ。" },
            { speaker: "sumi", face: "smile", text: "次の行もそのまま続けて読める。" },
            { type: "set_flag", flag: "_qa_ingame_cfg_done", value: true },
          ],
        }, { bg: "res://assets/backgrounds/bg_tonari_inside.png" }).then(() => { window.__cfgVnDone = true; });
      });
      await page.locator("#vn.active .vn-box").waitFor();
      await page.waitForFunction(() => (document.querySelector(".vn-text")?.textContent?.length || 0) > 0);
      await assertFits(page, ".vn-controls, .vn-controls .vn-ctl");
      await press('[data-test="vn-auto"]');
      assert.equal(await page.locator('[data-test="vn-auto"]').getAttribute("aria-pressed"), "true");
      await press('[data-test="vn-config"]');
      await page.locator("#modal.show .cfg").waitFor();
      await page.waitForTimeout(250);
      assert.equal(await page.evaluate(() => window.__cfgVnDone), false, "AUTO must pause while config modal is open");
      await page.selectOption('[data-test="cfg-text-speed"]', "4");
      await page.selectOption('[data-test="ui-theme-select"]', "smoke");
      await page.locator(".vn-next.show").waitFor();
      const vnCfg = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_remake_config")));
      assert.equal(vnCfg.textSpeed, 4);
      assert.equal(vnCfg.uiTheme, "smoke");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"), "smoke");
      await press('[data-test="cfg-close"]');
      await page.locator("#modal.show").waitFor({ state: "hidden" });
      assert.equal(await page.locator('[data-test="vn-auto"]').getAttribute("aria-pressed"), "true", "AUTO state is preserved across config modal");
      await press('[data-test="vn-auto"]');
      assert.equal(await page.locator('[data-test="vn-auto"]').getAttribute("aria-pressed"), "false");
      await page.waitForTimeout(350);
      // #1846: フォーカス中のAUTOボタンではEnterがボタン操作になる。会話送りの前にフォーカスを外す。
      if (!touch) await page.locator('[data-test="vn-auto"]').evaluate(button => button.blur());
      if (touch) await page.locator(".vn-box").tap(); else await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent?.includes("次の行もそのまま続けて読める。"));
      await page.locator(".vn-next.show").waitFor();
      if (touch) await page.locator(".vn-box").tap(); else await page.keyboard.press("Enter");
      await page.waitForFunction(() => window.__cfgVnDone);
      const afterVn = await page.evaluate(async () => {
        const { state } = await import("./js/core/state.js");
        const { backlog } = await import("./js/vn/engine.js");
        return { flag: state.flags._qa_ingame_cfg_done, marker: state.flags._qa_marker, logCount: backlog().length };
      });
      assert.deepEqual(afterVn, { flag: true, marker: "keep-progress", logCount: 2 });
    }, options);
  }
});


await suite("blue-window-character-preview",async check=>{
  for(const viewport of [{width:1280,height:768},{width:844,height:438}]) {
    await check(String(viewport.width),async page=>{
      await page.locator(".vn-next.show").waitFor();
      const saved=await storageSnapshot(page);
      const fixedHeader=await commandGeometry(page);
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"heisei-blue");
      for(const [id,name] of [["minto","みんと"],["ageha","あげは"],["tsumugi","つむぎ"],["hiyori","ひより"]]) {
        await page.selectOption("#preview-character",id);
        await page.locator(".vn-next.show").waitFor();
        await page.evaluate(()=>document.fonts.ready);
        assert.equal(await page.locator(".vn-name").textContent(),name);
        fixedCommands(await commandGeometry(page),fixedHeader,"blue character "+id);
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
      await page.locator('[data-test="vn-auto"]').click();
      fixedCommands(await commandGeometry(page),fixedHeader,"blue AUTO on");
      await page.locator('[data-test="vn-auto"]').click();
      fixedCommands(await commandGeometry(page),fixedHeader,"blue AUTO off");
      assert.deepEqual(await storageSnapshot(page),saved,"character comparison never writes saves/config");
      await page.selectOption("#preview-theme","smoke");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"smoke");
      await page.selectOption("#preview-theme","heisei-blue");
      assert.equal(await page.locator("html").getAttribute("data-ui-theme"),"heisei-blue","blue theme is selectable from the dropdown after leaving it");
      assert.deepEqual(await storageSnapshot(page),saved);
    },{viewport});
  }
},{entry:new URL("conversation-preview.html?theme=heisei-blue&character=minto",baseURL).href,readySelector:".vn-box"});
