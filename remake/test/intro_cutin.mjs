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
    ["hiyori", "samechan", "saku", "steve", "master_hookah", "sheikh", "maezono", "oneesan", "ageha", "unknown"].map((id) => [id, T.introFlavor(id)]),
  ));
  assert.deepEqual(flavorCases.hiyori, { main: "マンゴー", small: "ハバネロ" });
  for (const id of ["oneesan", "unknown"]) {
    assert.equal(flavorCases[id], null, `${id}: 未確定・正体を伏せる好みを表示しない`);
  }
  assert.deepEqual([flavorCases.saku, flavorCases.steve, flavorCases.master_hookah, flavorCases.sheikh, flavorCases.maezono],
    [{ main: "アールグレイ" }, { main: "マウンテンミスト" }, { main: "ライチ" }, { main: "グレープ" }, { main: "レモン" }],
    "正本で決まっている好みを表示する");
  assert.deepEqual(flavorCases.samechan, { main: "スプリングウォーター" });
  const brandNames = await page.evaluate((ids) => ids.flatMap((id) => {
    const f = T.introFlavor(id);
    const text = f ? `${f.main}${f.small || ""}` : "";
    return /アフサール|ドバジ|ナイトサイド|\bAF\b|\bNS\b/.test(text) ? [`${id}: ${text}`] : [];
  }), ids);
  assert.deepEqual(brandNames, [], "カットインの好きなフレーバーにメーカー名を付けない");
  assert.equal(await page.evaluate(() => T.introFlavor("__proto__")), null, "未登録の特殊IDを表示しない");
  // 2026-11-02 オーナー指定: 人物絵の寄り・引きの違いを配置で吸収し、全員ほぼ同じ頭の大きさで出す（パッキーは全身）
  const unscaled = await page.evaluate(async (ids) => {
    const g = await import("./js/vn/intro-graphic.js");
    return ids.filter((id) => id !== "pakki" && g.graphicIntro(id, "graphic") && !g.hasScaledFrame(id));
  }, ids);
  assert.deepEqual(unscaled, [], "頭の大きさをそろえる配置が無い（heads.json を測って tools/intro_graphic_frames.py を実行）");
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

  // 1a) 名前の書き方: 「漢字《よみ》」でふりがな、「｜」で範囲を明示、半角空白は苗字と名前のあいだの小さな空き
  const split = await page.evaluate(async () => {
    const { nameParts, plainName } = await import("./js/vn/intro-art.js");
    const cases = ["綾取《あやとり》 陣《じん》", "神崎《かんざき》 竜二《りゅうじ》（組長《くみちょう》）", "｜†玖羅雨℃†《くらうど》", "占《うらな》いオババ", "あげは"];
    return cases.map((text) => ({ parts: nameParts(text), plain: plainName(text) }));
  });
  assert.deepEqual(split, [
    { parts: [{ text: "綾取", ruby: "あやとり" }, { gap: true }, { text: "陣", ruby: "じん" }], plain: "綾取陣" },
    { parts: [{ text: "神崎", ruby: "かんざき" }, { gap: true }, { text: "竜二", ruby: "りゅうじ" }, { text: "（" }, { text: "組長", ruby: "くみちょう" }, { text: "）" }], plain: "神崎竜二（組長）" },
    { parts: [{ text: "†玖羅雨℃†", ruby: "くらうど" }], plain: "†玖羅雨℃†" },
    { parts: [{ text: "占", ruby: "うらな" }, { text: "いオババ" }], plain: "占いオババ" },
    { parts: [{ text: "あげは" }], plain: "あげは" },
  ], "名前の書き方の読み取り");
  // ふりがなは全員共通（2026-11-06）: 名前に漢字がある人は、全ての漢字にふりがなを付ける
  const unruby = await page.evaluate(async (ids) => {
    const { nameParts } = await import("./js/vn/intro-art.js");
    return ids.flatMap((id) => nameParts(T.intro.introName(id).source).filter((part) => !part.ruby && /\p{Script=Han}/u.test(part.text || "")).map((part) => `${id}: ${part.text}`));
  }, ids);
  assert.deepEqual(unruby, [], "ふりがなの無い漢字がある");

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
  const graphicSalaryman = await artFor("salaryman", "graphic");
  assert.match(graphicSalaryman.portrait, /character_intros\/graphic\/salaryman\.webp$/);
  assert.match(graphicSalaryman.background, /graphic\/bg_salaryman\.webp$/);
  const graphicMaki = await artFor("maki", "graphic");
  assert.match(graphicMaki.portrait, /character_intros\/graphic\/maki\.webp$/, "既定は新しい絵柄の人物");
  assert.match(graphicMaki.background, /character_intros\/graphic\/bg_maki\.webp$/, "描き直した背景を使う");
  const graphicRio = await artFor("rio", "graphic");
  assert.match(graphicRio.portrait, /graphic\/rio\.webp$/);
  assert.match(graphicRio.background, /graphic\/bg_rio\.webp$/, "全員の背景を新しい絵柄に描き直した（2026-10-31）");
  const classicMaki = await artFor("maki", "classic");
  assert.match(classicMaki.portrait, /sprites\/characters\/maki\//, "classic で旧の立ち絵に戻る");
  assert.doesNotMatch(classicMaki.background, /graphic\//, "classic で旧の背景に戻る");
  // SHISHA-9000 はどちらの設定でも正式normalを使い、旧専用人物絵を再表示しない。
  for (const style of ["graphic", "classic"]) {
    const robot = await artFor("shisha_9000", style);
    assert.match(robot.portrait, /sprites\/characters\/shisha_9000\/chr_shisha_9000_normal\.webp(?:\?.*)?$/, `${style}: 正式normalの二眼を維持する`);
    assert.doesNotMatch(robot.portrait, /character_intros\/graphic\//, `${style}: 旧専用人物絵を使わない`);
  }
  await page.evaluate(() => { T.core.config.introArtStyle = "graphic"; });

  // 2) 名前の出し方（NAMES-1106「カットインの名前表示ルール」2026-11-06）
  //    本名タイプはフルネーム（あだ名がある人は「本名（あだ名）」）、通り名タイプは通り名。外国人は本名タイプで短縮あり
  const rule = await page.evaluate(() => Object.fromEntries(Object.keys(T.DB.characters).filter((id) => T.DB.characters[id].intro_cutin)
    .map((id) => [id, T.intro.introName(id).main])));
  assert.deepEqual(rule, {
    hajime: "逢縁はじめ", sumi: "炭吉丈一郎", naru: "鳴切亮太（なる）", adam: "アダム", minto: "みんと", shisha_9000: "SHISHA-9000",
    saku: "綾取陣", steve: "スティーブ・A・アッシュ", volk: "ヴォルク・イヴァノフ", rei: "†玖羅雨℃†", master_hookah: "王煙楼",
    tsumugi: "猫洞つむぎ", rio: "円頓寺凛想", ageha: "あげは", kumicho: "神崎竜二（組長）", dr_kemuri: "チャコール博士", pakki: "パッキー",
    sui: "千須豪", emil: "エミル・ユルマズ", sheikh: "シェイク・ナジュム", da_silva: "ダ・シルヴァ・太陽", mashiro: "黒葉ましろ",
    uranaishi: "占いオババ", mukai_master: "向井然", maezono: "上園文太郎", oneesan: "お姉さん", hiyori: "泡沫ひより",
    maki: "斧崎マキ", sai: "六角サイ", salaryman: "鉄仮面さん", yoru: "針間ヨル", noor: "ヌール・サーリム", samechan: "サメちゃん",
  });
  // 肩書きは別欄: スミは「はじめの師匠」、王煙楼は「マスターフーカー」。名前にはふりがなだけを付ける
  const titled = await page.evaluate(() => ["sumi", "master_hookah"].map((id) => [T.DB.characters[id].intro_cutin.title, T.intro.introName(id).source]));
  assert.deepEqual(titled, [["はじめの師匠", "炭吉《すみよし》 丈一郎《じょういちろう》"], ["マスターフーカー", "王煙楼《ワン・イェンロウ》"]]);
  // みんとは段階型: 本名を本人から聞いた後（_minto_name_known）は木成頼栞
  const staged = await page.evaluate(() => {
    const before = [T.intro.introName("minto").main, T.intro.introName("oneesan").main];
    T.core.state.flags._minto_name_known = true;
    const after = [T.intro.introName("minto").main, T.intro.introName("oneesan").main];
    delete T.core.state.flags._minto_name_known;
    return { before, after };
  });
  assert.deepEqual(staged, { before: ["みんと", "お姉さん"], after: ["木成頼栞", "木成頼栞"] });
  // 画面では漢字の上に小さいふりがな（本文は名前だけ・読みは data-ruby）
  const ruby = await page.evaluate(async () => {
    T.core.state.flags._intro_kumicho = false;
    const p = T.intro.playIntro("kumicho");
    await new Promise((r) => setTimeout(r, 900));
    const name = document.querySelector(".cutin .ci-name"), ribbon = document.querySelector(".cutin .ci-ribbon")?.getBoundingClientRect();
    const out = {
      text: name.textContent, label: name.getAttribute("aria-label"),
      ruby: [...name.querySelectorAll(".ci-ruby")].map((n) => [n.textContent, n.dataset.ruby, getComputedStyle(n, "::before").content]),
      small: [...name.querySelectorAll(".ci-ruby")].every((n) => parseFloat(getComputedStyle(n, "::before").fontSize) < parseFloat(getComputedStyle(n).fontSize) / 3),
    };
    await p;
    return out;
  });
  assert.deepEqual(ruby, { text: "神崎竜二（組長）", label: "神崎竜二（組長）", small: true,
    ruby: [["神崎", "かんざき", '"かんざき"'], ["竜二", "りゅうじ", '"りゅうじ"'], ["組長", "くみちょう", '"くみちょう"']] });
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
  assert(!/栞|木成頼/.test(hidden.minto), `みんとのカットインに本名が出ている: ${hidden.minto}`);
  assert(!/田中|健太/.test(hidden.rei), `†玖羅雨℃†のカットインに本名が出ている: ${hidden.rei}`);
  assert(hidden.rei.includes("†玖羅雨℃†"), "活動名を紹介に出す");

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

  assert.deepEqual(errors, []);
  console.log(`OK intro_cutin: ${ids.length}人のカットインが画面内に収まり、名乗った直後に一度だけ出る`);
} finally {
  await browser.close();
}
