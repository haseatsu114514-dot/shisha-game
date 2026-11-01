// 初登場カットイン（vn/intro.js）: 全キャラの見た目が画面に収まるか、名乗った直後に一度だけ出るかを確かめる。
// サーバーを8123で起動後: node remake/test/intro_cutin.mjs   （SHOTS=<フォルダ> で各キャラの画像を保存）
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:8123/remake/");
  await page.waitForSelector('[data-test="title-new"]');
  const ids = await page.evaluate(async () => {
    const core = await import("./js/core/state.js"), { DB } = await import("./js/core/data.js");
    const intro = await import("./js/vn/intro.js"), vn = await import("./js/vn/engine.js");
    core.newGame();
    const { introFlavor } = await import("./js/vn/intro-flavors.js");
    window.T = { core, DB, intro, introFlavor, vn };
    return Object.keys(DB.characters).filter((id) => DB.characters[id].intro_cutin);
  });
  assert(ids.length >= 20, `カットインのデータが少ない（${ids.length}人）`);
  const flavorCases = await page.evaluate(() => Object.fromEntries(
    ["hiyori", "samechan", "kuze", "steve", "master_hookah", "sheikh", "maezono", "oneesan", "ageha", "unknown"].map((id) => [id, T.introFlavor(id)]),
  ));
  assert.deepEqual(flavorCases.hiyori, { main: "マンゴー", small: "ハバネロ" });
  for (const id of ["oneesan", "unknown"]) {
    assert.equal(flavorCases[id], null, `${id}: 未確定・正体を伏せる好みを表示しない`);
  }
  assert.deepEqual([flavorCases.kuze, flavorCases.steve, flavorCases.master_hookah, flavorCases.sheikh, flavorCases.maezono],
    [{ main: "アールグレイ" }, { main: "マウンテンミスト" }, { main: "ライチ" }, { main: "グレープ" }, { main: "ミント／ダブルアップル" }],
    "正本で決まっている好みを表示する");
  assert.deepEqual(flavorCases.samechan, { main: "スプリングウォーター" });
  const brandNames = await page.evaluate((ids) => ids.flatMap((id) => {
    const f = T.introFlavor(id);
    const text = f ? `${f.main}${f.small || ""}` : "";
    return /アフサール|ドバジ|ナイトサイド|\bAF\b|\bNS\b/.test(text) ? [`${id}: ${text}`] : [];
  }), ids);
  assert.deepEqual(brandNames, [], "カットインの好きなフレーバーにメーカー名を付けない");
  assert.equal(await page.evaluate(() => T.introFlavor("__proto__")), null, "未登録の特殊IDを表示しない");
  assert.deepEqual(flavorCases.ageha, { main: "ホワイトグミベア／レッドグミベア" });
  assert.equal(await page.evaluate(() => T.introFlavor("ageha", "unknown")), null, "正体不明版で好みを表示しない");

  // 1) 全員: 二つ名・名前・一言が画面（1280×720）の中に収まり、文字が空でない
  for (const id of ids) {
    await page.evaluate((id) => { T.core.state.met[id] = true; T.done = T.intro.playIntro(id); }, id);
    await page.waitForSelector(`.cutin.in[data-char="${id}"]`);
    await page.waitForTimeout(1900); // 一言とフレーバーが出そろうまで（静の型が最も遅い）
    const box = await page.evaluate(() => {
      const stage = document.querySelector("#stage").getBoundingClientRect();
      const k = stage.width / 1280;
      const r = (sel) => {
        const n = document.querySelector(`.cutin ${sel}`);
        if (!n) return null;
        const b = n.getBoundingClientRect();
        return { text: n.textContent, left: (b.left - stage.left) / k, right: (b.right - stage.left) / k, top: (b.top - stage.top) / k, bottom: (b.bottom - stage.top) / k };
      };
      return { title: r(".ci-title"), name: r(".ci-name"), line: r(".ci-line"), flavor: r(".ci-flavor"), portrait: !!document.querySelector(".cutin img.ci-portrait") };
    });
    for (const key of ["title", "name", "line"]) {
      const b = box[key];
      assert(b && b.text.trim(), `${id}: ${key} が空`);
      assert(b.left >= 0 && b.right <= 1280 && b.top >= 0 && b.bottom <= 720, `${id}: ${key}「${b.text}」が画面からはみ出す ${JSON.stringify(b)}`);
    }
    const expectedFlavor = await page.evaluate((id) => T.introFlavor(id), id);
    assert.equal(!!box.flavor, !!expectedFlavor, `${id}: フレーバー札の有無`);
    if (box.flavor) {
      assert.equal(box.flavor.text, `好きなフレーバー${expectedFlavor.main}${expectedFlavor.small || ""}`);
      assert(box.flavor.left >= 0 && box.flavor.right <= 1280 && box.flavor.top >= 0 && box.flavor.bottom <= 720,
        `${id}: フレーバー札が画面からはみ出す ${JSON.stringify(box.flavor)}`);
      assert(box.line.bottom < box.flavor.top, `${id}: フレーバーは一言の下に重ならず置く`);
    }
    assert(box.name.right <= 1280 - 40, `${id}: 名前「${box.name.text}」が右端に詰まりすぎ`);
    assert.equal(await page.locator('.cutin .ci-full').count(), 0, `${id}: 括弧付きの本名が表示されている`);
    if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/cutin_${id}.png` });
    await page.locator(".cutin").click();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".cutin:not(.out)").count(), 1, `${id}: クリック/Enterで演出を飛ばせてしまう`);
    await page.evaluate(() => T.done);
    assert.equal(await page.locator(".cutin").count(), 0, `${id}: 自動で閉じない`);
  }

  // 1a) 苗字と名前のあいだの小さな空き（正本の名前に空白がある人だけ）
  const split = await page.evaluate(async () => {
    const { nameParts } = await import("./js/vn/intro-art.js");
    return { kuze: nameParts("kuze", "久世朔"), maki: nameParts("maki", "斧崎マキ"), naru: nameParts("naru", "なる"), hiyori: nameParts("hiyori", "ひより") };
  });
  assert.deepEqual(split, { kuze: ["久世", "朔"], maki: ["斧崎", "マキ"], naru: null, hiyori: null }, "苗字と名前の区切り");

  // 1b) 絵柄の切り替え: 既定は新しいグラフィック絵柄、設定 classic で旧の立ち絵へ戻る（2026-10-31）
  const artFor = async (id, style) => {
    const src = await page.evaluate(([id, style]) => {
      T.core.config.introArtStyle = style;
      T.core.state.flags[`_intro_${id}`] = false;
      T.done = T.intro.playIntro(id);
    }, [id, style]).then(() => page.waitForSelector(`.cutin.in[data-char="${id}"] img.ci-portrait`))
      .then(() => page.evaluate(() => ({ portrait: document.querySelector(".cutin img.ci-portrait").getAttribute("src"),
        background: document.querySelector(".cutin img.ci-art-background").getAttribute("src") })));
    await page.waitForTimeout(400);
    await page.evaluate(() => T.done);
    return src;
  };
  const graphicMaki = await artFor("maki", "graphic");
  assert.match(graphicMaki.portrait, /character_intros\/graphic\/maki\.webp$/, "既定は新しい絵柄の人物");
  assert.match(graphicMaki.background, /character_intros\/graphic\/bg_maki\.webp$/, "描き直した背景を使う");
  const graphicRin = await artFor("rin", "graphic");
  assert.match(graphicRin.portrait, /graphic\/rin\.webp$/);
  assert.match(graphicRin.background, /graphic\/bg_rin\.webp$/, "全員の背景を新しい絵柄に描き直した（2026-10-31）");
  const classicMaki = await artFor("maki", "classic");
  assert.match(classicMaki.portrait, /sprites\/characters\/maki\//, "classic で旧の立ち絵に戻る");
  assert.doesNotMatch(classicMaki.background, /graphic\//, "classic で旧の背景に戻る");
  await page.evaluate(() => { T.core.config.introArtStyle = "graphic"; });

  // 2) 名前の出し方: 全員で呼び名のみ、本名の括弧を廃止。物語の名乗りは残す
  const rule = await page.evaluate(() => Object.fromEntries(["naru", "sumi", "tsumugi", "nagumo", "minto"].map((id) => [id, T.intro.introName(id)])));
  assert.deepEqual(rule.naru, { main: "なる", full: "" });
  assert.deepEqual(rule.sumi, { main: "スミさん", full: "" });
  assert.deepEqual(rule.tsumugi, { main: "つむぎ", full: "" }, "フルネームの無いキャラに（）が付く");
  assert.equal(rule.nagumo.full, "", "呼び名とフルネームが同じなら（）を付けない");
  assert.deepEqual(rule.minto, { main: "みんと", full: "" });
  const hidden = await page.evaluate(async () => {
    const out = {};
    for (const id of ["minto", "rei"]) {
      T.core.state.met[id] = true;
      const p = T.intro.playIntro(id);
      await new Promise((r) => setTimeout(r, 400));
      out[id] = document.querySelector(".cutin").textContent;
      document.querySelector(".cutin").dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await new Promise((r) => setTimeout(r, 200));
      document.querySelector(".cutin")?.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
      await p;
    }
    return out;
  });
  assert(!/栞|緑川/.test(hidden.minto), `みんとのカットインに本名が出ている: ${hidden.minto}`);
  assert(!/田中|健太/.test(hidden.rei), `零-REI-のカットインに本名が出ている: ${hidden.rei}`);

  // 3) 会話の中: 「？？？」の間は出ず、名乗り（_met_）の直後の台詞の前に一度だけ出る
  await page.evaluate(() => {
    T.core.newGame();
    T.seen = [];
    new MutationObserver((rs) => rs.forEach((r) => r.addedNodes.forEach((n) => n.classList?.contains("cutin") && T.seen.push(n.dataset.char))))
      .observe(document.querySelector("#fx"), { childList: true });
    T.talk = T.vn.play({ dialogue_id: "__intro_test", lines: [
      { speaker: "naru", face: "normal", text: "お、あんたが4人目？ 俺はなる" },
      { type: "set_flag", flag: "_met_naru" },
      { speaker: "hajime", face: "normal", text: "よろしくお願いします" },
      { speaker: "naru", face: "smile", text: "おう" },
    ] });
  });
  const advance = async () => { await page.waitForTimeout(450); await page.mouse.click(640, 600); };
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("俺はなる"));
  assert.deepEqual(await page.evaluate(() => T.seen), [], "名乗る前にカットインが出た");
  await advance(); await advance();
  await page.waitForSelector('.cutin[data-char="naru"]');
  assert.equal(await page.evaluate(() => T.core.state.flags._intro_naru), true);
  await page.waitForTimeout(600);
  await page.locator(".cutin").click();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Control");
  assert.equal(await page.locator('.cutin[data-char="naru"]:not(.out)').count(), 1, "登場中の操作で閉じた");
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("よろしく"));
  await advance(); await advance();
  await page.waitForFunction(() => document.querySelector(".vn-text")?.textContent.includes("おう"));
  await advance(); await advance();
  await page.evaluate(() => T.talk);
  assert.deepEqual(await page.evaluate(() => T.seen), ["naru"], "カットインが一度だけになっていない");

  // CIG07 pilot: no new art; lifecycle, accessibility, timing and DS coordinates.
  await page.evaluate(async () => {
    const { portraitInfo } = await import("./js/core/data.js");
    T.pilotEvents = [];
    T.pilotObserver = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node.nodeType !== 1) return;
      for (const candidate of [node, ...node.querySelectorAll('.ci-silhouette,.ci-wipe')])
        if (candidate.matches('.ci-silhouette,.ci-wipe')) T.pilotEvents.push(candidate.className);
    })));
    T.pilotObserver.observe(document.querySelector('#fx'), { childList: true, subtree: true });
    T.seedPortrait = async () => {
      const box = document.createElement('div'); box.className = 'vn-portraits'; box.id = 'pilot-source';
      const image = new Image(); image.src = portraitInfo('naru', 'normal').src;
      image.className = 'portrait active'; image.dataset.speaker = 'naru';
      image.style.cssText = 'height:650px;bottom:0;left:30%;--ax:-50%';
      await image.decode(); box.append(image); document.querySelector('#stage').append(box);
    };
    await T.seedPortrait();
  });
  const cleanPilot = async () => assert.equal(await page.locator('.ci-transition,.ci-silhouette,.ci-wipe,.cutin,.intro-fit-surface').count(), 0, '中断・終了後に影/色面/カットインが残る');
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      T.core.config.reduceShake = false; T.core.config.introArtStyle = 'graphic'; T.pilotEvents.length = 0;
      T.started = performance.now(); T.done = T.intro.playIntro('naru');
    });
    await page.locator('.ci-silhouette').waitFor({ state: 'attached' });
    assert(await page.evaluate(() => {
      const source = document.querySelector('#pilot-source img').getBoundingClientRect();
      const shadow = document.querySelector('.ci-silhouette').getBoundingClientRect();
      return ['left','top','width','height'].every(key => Math.abs(source[key] - shadow[key]) < 1);
    }), 'PC/スマホ縦: 影が立ち絵と同じ座標');
    await page.keyboard.press('Enter'); await page.keyboard.press('Control');
    await page.locator('.ci-transition').dispatchEvent('pointerup');
    await page.locator('.cutin.in').waitFor();
    await page.waitForTimeout(650);
    assert.equal(await page.locator('.ci-transition,.ci-wipe,.ci-silhouette').count(), 0, '入場完了後に影と色面を残さない');
    const animationProperties = await page.evaluate(() => document.querySelector('.cutin').getAnimations({ subtree: true }).flatMap(a =>
      a.effect.getKeyframes().flatMap(frame => Object.keys(frame).filter(key => !['offset','computedOffset','easing','composite'].includes(key)))));
    assert(animationProperties.every(key => ['opacity','transform','clipPath'].includes(key)), `許可以外のアニメーション: ${animationProperties}`);
    await page.evaluate(() => T.done);
    assert(await page.evaluate(() => performance.now() - T.started >= 4380), '入場480 + hold3600 + 退場300msを操作で短縮しない');
    await cleanPilot();
  }
  for (const mode of ['classic', 'setting', 'system']) {
    await page.emulateMedia({ reducedMotion: mode === 'system' ? 'reduce' : 'no-preference' });
    await page.evaluate(mode => {
      T.core.config.introArtStyle = mode === 'classic' ? 'classic' : 'graphic';
      T.core.config.reduceShake = mode === 'setting'; T.pilotEvents.length = 0;
      T.done = T.intro.playIntro('naru');
    }, mode);
    await page.locator('.cutin.in').waitFor();
    if (mode !== 'classic') assert(await page.evaluate(() => document.querySelector('.cutin').getAnimations({ subtree: true }).every(a =>
      a.effect.getKeyframes().every(frame => !('transform' in frame) && !('clipPath' in frame)))), '軽減時はフェードのみ');
    await page.evaluate(() => T.done);
    assert.deepEqual(await page.evaluate(() => T.pilotEvents), [], `${mode}: 影と色面を作らない`);
    await cleanPilot();
  }
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 720 });
  for (const phase of ['shadow', 'wipe', 'hold', 'exit', 'load', 'error']) {
    await page.evaluate(phase => {
      T.core.config.introArtStyle = 'graphic'; T.core.config.reduceShake = false;
      T.abort = new AbortController(); T.failure = '';
      T.done = T.intro.playIntro('naru', { signal: T.abort.signal, onAppear: phase === 'error' ? () => { throw new Error('pilot injected error'); } : null })
        .catch(error => { T.failure = error.message; });
    }, phase);
    if (phase === 'error') { await page.evaluate(() => T.done); assert.equal(await page.evaluate(() => T.failure), 'pilot injected error'); }
    else {
      await page.locator('.ci-transition').waitFor({ state: 'attached' });
      if (phase === 'wipe') await page.waitForTimeout(180);
      if (['hold','exit','load'].includes(phase)) {
        await page.locator('.ci-transition').waitFor({ state: 'detached' });
        if (phase === 'exit') await page.locator('.ci-transition').waitFor({ state: 'attached' });
      }
      await page.evaluate(phase => { if (phase === 'load') { T.core.save(); T.core.load(); } else T.abort.abort(); }, phase);
      await page.evaluate(() => T.done);
    }
    await cleanPilot();
  }
  // No portrait: wipe only. A non-pilot graphic character keeps its current presentation.
  await page.evaluate(() => { document.querySelector('#pilot-source').remove(); T.pilotEvents.length = 0; T.done = T.intro.playIntro('naru'); });
  await page.locator('.ci-wipe').waitFor({ state: 'attached' });
  assert.equal(await page.locator('.ci-silhouette').count(), 0);
  await page.evaluate(() => T.done); await cleanPilot();
  await page.evaluate(() => { T.pilotEvents.length = 0; T.done = T.intro.playIntro('sumi'); });
  await page.evaluate(() => T.done);
  assert.deepEqual(await page.evaluate(() => T.pilotEvents), [], '4人以外へ広げない');
  // Real VN interruption in stacked DS mode: the overlay follows the upper-screen portrait.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    localStorage.setItem('suien_title_layout', 'ds'); dispatchEvent(new Event('display-layout-change'));
    T.core.newGame(); T.core.markMet('naru'); T.vnAbort = new AbortController();
    T.talk = T.vn.play({ dialogue_id: '__pilot_ds_abort', lines: [
      { speaker: 'naru', face: 'normal', text: 'なるの登場確認' },
      { speaker: 'hajime', text: 'よろしくお願いします' },
    ] }, { signal: T.vnAbort.signal });
  });
  await page.locator('body.game-ds #vn.active').waitFor();
  await page.waitForFunction(() => document.querySelector('.vn-text')?.textContent.includes('なるの登場確認'));
  await page.waitForTimeout(350); await page.keyboard.press('Enter');
  await page.waitForTimeout(350); await page.keyboard.press('Enter');
  await page.locator('.ci-silhouette').waitFor({ state: 'attached' });
  assert(await page.evaluate(() => {
    const a = document.querySelector('#vn .portrait[data-speaker="naru"]').getBoundingClientRect();
    const b = document.querySelector('.ci-silhouette').getBoundingClientRect();
    return ['left','top','width','height'].every(key => Math.abs(a[key] - b[key]) < 1);
  }), '実VNのDS上画面で影の位置を合わせる');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/pilot-ds-shadow.png` });
  await page.evaluate(() => T.vnAbort.abort()); await page.evaluate(() => T.talk);
  await page.locator('.ci-transition').waitFor({ state: 'detached' }); await cleanPilot();
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => T.pilotObserver.disconnect());

  assert.deepEqual(errors, []);
  console.log(`OK intro_cutin: ${ids.length}人のカットインが画面内に収まり、名乗った直後に一度だけ出る`);
} finally {
  await browser.close();
}
