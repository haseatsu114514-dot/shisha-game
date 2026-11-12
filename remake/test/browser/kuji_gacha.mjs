// シーシャくじのガチャ風の演出（2026-11-11 オーナー要望）。本編のショップから引いて、
// ガラガラ → 賞の札／連続の結果、SKIP、S賞の見せ場、ラストワン賞の続き、スマホ横持ち、動きを減らす設定を確かめる。
// 抽選・お金・保存の中身は kuji_purchase.mjs と shop_ui.mjs が見る。ここは見せ方だけ。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

async function setup(page, values = {}) {
  await page.evaluate(async values => {
    window.G = { core: await import("./js/core/state.js"), shop: await import("./js/daily/shop.js"), ui: await import("./js/core/ui.js"),
      data: await import("./js/core/data.js"), hud: await import("./js/daily/hud.js") };
    const s = G.core.newGame();
    Object.assign(s, { phase: "daily", chapter: 3, day: 5, slot: 0, money: 500000, stamina: 100 }, values);
    s.flags._kuji_seen = true;
    G.ui.clearScreen(); G.hud.initHud({}); G.hud.showHud();
    await G.ui.setBg(G.data.bgUrl("bg_osu_map_day"), { instant: true });
    // くじは店ごとに1種類（KJ11）。上級機材くじ（g5000）は第3章の東京店に置いてある
    G.shop.openShop({ branch: "tokyo" });
  }, values);
  await page.locator('.shop-tabs').waitFor();
  await page.locator('[data-tab="kuji"]').click();
  await page.locator('[data-test="kuji-g5000"]').waitFor();
}
// 箱の先頭に、指定の景品（data/kuji.json の prizes の番号）を順に並べる。配列は同じものを使う（買うボタンは箱と並びが同じかを見ている）
const stack = (page, grade, front, drawn = 0) => page.evaluate(([grade, front, drawn]) => {
  const box = G.core.state.kuji[grade], pool = box.order.slice(drawn), head = [];
  for (const i of front) { const at = pool.indexOf(i); if (at < 0) throw new Error(`prize ${i} is not left in ${grade}`); head.push(...pool.splice(at, 1)); }
  box.order.splice(drawn, box.order.length - drawn, ...head, ...pool);
  box.drawn = drawn;
}, [grade, front, drawn]);
const tap = (page, test) => page.locator(`[data-test="${test}"]`).click();
const gone = (page, test) => page.locator(`[data-test="${test}"]`).waitFor({ state: "detached" });
const saved = page => page.evaluate(() => JSON.parse(localStorage.getItem(G.core.SAVE_KEY)));
// 上級機材くじ（g5000）の景品の番号: 0＝S賞 くるみ材と真鍮の台、1〜3＝A賞、4＝B賞 東京の葉 3種セット、5〜8＝C賞
const S = 0, A = 2, B = 4, C = 5;

await suite("kuji-gacha", async check => {
  await check("single-full-motion", async page => {
    await setup(page);
    await stack(page, "g5000", [C]);
    await tap(page, "kuji-g5000");
    // 回っているあいだ: 舞台と粒子の層と SKIP があり、札はまだ無い
    await page.locator('.mo-garagara[data-mode="single"]').waitFor();
    await page.locator(".mo-garagara canvas.kj-fx").waitFor();
    // 舞台は今いる店の背景を写したもの。道具は1つずつ別の部品で、描いた絵（#3228・remake/img/ui/kuji/）を使う
    assert.equal(await page.locator(".mo-garagara .kj-bg .kj-bg-img").count(), 1, "後ろにその店の背景");
    for (const part of ["drum", "frame", "base", "handle", "tray", "counter", "sign", "bell"]) {
      assert((await page.locator(`.mo-garagara .kj-part[data-part="${part}"]`).count()) >= 1, `部品 ${part}`);
    }
    // 絵が読み込めて、下絵に戻っていない（読み込めなかった部品は data-art="sketch" になる）
    await page.waitForFunction(() => [...document.querySelectorAll(".mo-garagara .kj-part img")].every((img) => img.complete), null, { timeout: 8000 });
    const art = await page.locator(".mo-garagara .kj-part").evaluateAll((parts) => parts.map((n) => ({ part: n.dataset.part, art: n.dataset.art,
      loaded: !!n.querySelector("img")?.naturalWidth })));
    for (const part of ["drum", "frame", "base", "handle", "tray", "counter", "sign", "bell"]) {
      const found = art.filter((x) => x.part === part);
      assert(found.length && found.every((x) => x.art === "painted" && x.loaded), `描いた絵の ${part}: ${JSON.stringify(found)}`);
    }
    // 脚の足先は、手前の2本も奥の2本も土台の天板に載っている（2026-11-11 オーナー「台と足の位置がズレてる」: 奥の足先が板の外に浮いていた）。
    // 絵の中の位置: 脚の足先は左右 8.2%〜91.7%・下端 99.1%、土台の天板は上から 72.8%（奥の辺は左右 7.5% ずつ内側）
    const rig = await page.evaluate(() => Object.fromEntries([["base", ".kj-base"], ["near", ".kj-frame:not(.kj-frame-far)"], ["far", ".kj-frame-far"]]
      .map(([key, sel]) => { const r = document.querySelector(`.mo-garagara ${sel}`).getBoundingClientRect(); return [key, { x: r.x, y: r.y, w: r.width, h: r.height }]; })));
    const face = rig.base.h * 0.728;
    for (const [name, leg] of [["手前の脚", rig.near], ["奥の脚", rig.far]]) {
      const foot = leg.y + leg.h * 0.991, depth = (foot - rig.base.y) / face; // 0＝天板の奥の辺、1＝手前の辺
      assert(depth > 0.1 && depth < 0.9, `${name}の足先が天板の上（奥0〜手前1 の ${depth.toFixed(2)}）`);
      const inset = rig.base.w * 0.075 * (1 - depth); // その奥行きでの天板の左右の端
      assert(leg.x + leg.w * 0.082 > rig.base.x + inset + 4, `${name}の左の足先が天板の内側`);
      assert(leg.x + leg.w * 0.917 < rig.base.x + rig.base.w - inset - 4, `${name}の右の足先が天板の内側`);
    }
    // 抽選器は店のくじごとの見た目（GCH16）。東京店の上級機材くじ＝マホガニーと真鍮（brass）。黒板にはそのくじの名前
    assert.equal(await page.locator(".mo-garagara").getAttribute("data-look"), "brass");
    assert.match(await page.locator('.mo-garagara .kj-part[data-part="drum"] img').getAttribute("src"), /garagara-drum-brass\.webp$/);
    assert.equal(await page.locator(".mo-garagara .kj-sign-title").innerText(), "上級機材くじ");
    // 後ろの光の層と、回転でぶれた胴の絵がある（GCH17）
    assert.equal(await page.locator(".mo-garagara canvas.kj-light").count(), 1, "後ろの光の層");
    assert.equal(await page.locator('.mo-garagara .kj-part[data-part="drum-blur"]').count(), 1, "回転のぶれ");
    assert.equal(await page.locator(".kuji-card.reveal").count(), 0, "札はガラガラのあとに開く");
    assert((await page.locator('[data-test="kuji-skip"]').boundingBox()).height >= 40);
    await page.locator(".kuji-card.reveal.rank-C").waitFor({ timeout: 9000 });
    assert.match(await page.locator(".kuji-card.reveal").innerText(), /C賞[\s\S]*AF ライム（お試し10g）/);
    assert.equal(await page.locator(".kuji-card.reveal .kj-banner").count(), 0, "大当たりの帯はS賞だけ");
    assert((await page.locator(".kuji-card.reveal .kj-art").locator("img, .kj-gift").count()) >= 1, "景品の絵（無ければ包み）が載る");
    // 札の地は描いた絵（C賞は白い箔の札）
    assert.match(await page.locator(".kuji-card.reveal").evaluate((n) => getComputedStyle(n).backgroundImage), /img\/ui\/kuji\/card-c\.webp/);
    await page.locator(".mo-garagara").waitFor({ state: "detached" });
    assert.equal(await page.locator('[data-test="kuji-reveal"]').getAttribute("data-rank"), "C");
    await tap(page, "kuji-reveal");
    await gone(page, "kuji-reveal");
    const save = await saved(page);
    assert.equal(save.kuji.g5000.drawn, 1); assert.equal(save.money, 497000); // 東京店は1回3,000円（KJ15）
  });
  await check("single-skip-top-prize", async page => {
    await setup(page);
    await stack(page, "g5000", [S]);
    await tap(page, "kuji-g5000");
    await tap(page, "kuji-skip");
    // SKIP を押した同じタップで札まで閉じない
    await page.locator(".kuji-card.reveal.rank-S").waitFor({ timeout: 1500 });
    await page.locator(".mo-garagara").waitFor({ state: "detached" });
    await page.waitForTimeout(250);
    assert.equal(await page.locator('[data-test="kuji-reveal"]').count(), 1);
    const card = page.locator(".kuji-card.reveal");
    assert.match(await card.innerText(), /S賞[\s\S]*くるみ材と真鍮の台/);
    assert.equal(await card.locator(".kj-banner").innerText(), "大当たり");
    assert.equal(await card.locator(".kuji-dupe").count(), 0);
    assert.equal(await page.locator(".kuji-overlay canvas.kj-fx-card").count(), 1, "札の光の粒");
    await tap(page, "kuji-close");
    await gone(page, "kuji-reveal");
    assert((await saved(page)).owned.includes("stand_walnut"));
  });
  await check("last-one-follows", async page => {
    await setup(page);
    // 上級機材くじ（40枚）の最後の1枚: 札を閉じると、もう一度回ってラストワン賞
    await page.evaluate(() => { const box = G.core.state.kuji.g5000; box.drawn = box.order.length - 1; });
    await page.locator('[data-tab="sell"]').click(); await page.locator('[data-tab="kuji"]').click();
    await tap(page, "kuji-g5000");
    await tap(page, "kuji-skip");
    await page.locator(".kuji-card.reveal").waitFor();
    assert.equal(await page.locator(".kuji-card.reveal.rank-LAST").count(), 0);
    await tap(page, "kuji-reveal");
    await page.locator('.mo-garagara[data-mode="single"]').waitFor();
    await tap(page, "kuji-skip");
    await page.locator(".kuji-card.reveal.rank-LAST").waitFor();
    assert.match(await page.locator(".kuji-card.reveal.rank-LAST").innerText(), /ラストワン賞[\s\S]*大会公式モデルの台/);
    assert.equal(await page.locator(".kuji-card").count(), 1, "前の札は片付いている");
    await tap(page, "kuji-reveal");
    await gone(page, "kuji-reveal");
    assert((await saved(page)).owned.includes("home_rig_pro"));
  });
  // GCH16: 抽選器は店のくじごとに素材が変わる（上の店ほど豪華）。開発用のプレビュー（景品は渡さない）で5種類を順に見る
  await check("machine-look-per-kuji", async page => {
    await setup(page);
    const LOOKS = [["g1000", "walnut", "シーシャくじ"], ["g3000", "steel", "機材くじ"], ["g5000", "brass", "上級機材くじ"], ["g10000", "marble", "特注台くじ"], ["g20000", "lacquer", "限定台くじ"]];
    for (const [grade, look, title] of LOOKS) {
      await page.evaluate(async spec => { (await import("./js/daily/kuji.js")).previewReveal(spec); }, `C@${grade}`);
      const stage = page.locator(`.mo-garagara[data-look="${look}"]`);
      await stage.waitFor();
      assert.equal(await stage.locator(".kj-sign-title").innerText(), title, `${grade} の黒板`);
      await page.waitForFunction(() => [...document.querySelectorAll(".mo-garagara .kj-part img, .mo-garagara .kj-gem")].every((img) => img.complete), null, { timeout: 8000 });
      const parts = await stage.locator(".kj-part").evaluateAll((nodes) => nodes.map((n) => ({ part: n.dataset.part, art: n.dataset.art,
        src: n.querySelector("img")?.getAttribute("src") || "", loaded: !!n.querySelector("img")?.naturalWidth })));
      for (const part of ["drum", "drum-blur", "frame", "base", "handle", "tray"]) {
        const found = parts.filter((x) => x.part === part);
        assert(found.length && found.every((x) => x.art === "painted" && x.loaded), `${look} の ${part} が絵で出る: ${JSON.stringify(found)}`);
        // 本店（walnut）は元の絵、ほかは色替えした絵（garagara-<部品>-<見た目>.webp）
        const want = look === "walnut" ? new RegExp(`garagara-${part}\\.webp$`) : new RegExp(`garagara-${part}-${look}\\.webp$`);
        assert(found.every((x) => want.test(x.src)), `${look} の ${part} の絵: ${found.map((x) => x.src)}`);
      }
      // 軸の宝石は上の2つ（ドバイ店・限定台くじ）だけ
      const gems = await stage.locator(".kj-gem").evaluateAll((nodes) => nodes.map((n) => n.naturalWidth > 0));
      assert.deepEqual(gems, ["marble", "lacquer"].includes(look) ? [true] : [], `${look} の宝石`);
      await tap(page, "kuji-skip");
      await page.locator(".kuji-card.reveal.rank-C").waitFor();
      await page.locator(".mo-garagara").waitFor({ state: "detached" });
      await page.waitForTimeout(250);
      await tap(page, "kuji-reveal");
      await gone(page, "kuji-reveal");
    }
  });
  // GCH17: 玉が出る前の予告。蓋の光が、賞が上がるたびに一段ずつ色を上げる（A賞は 白 → 青 → 赤 で止まり、金までは上がらない）
  await check("tease-steps-up-to-the-rank", async page => {
    await setup(page);
    const colors = await page.evaluate(async () => {
      (await import("./js/daily/kuji.js")).previewReveal("A@g5000");
      const seen = [];
      await new Promise((done) => {
        const watch = () => {
          const stage = document.querySelector(".mo-garagara"), glow = stage?.querySelector(".kj-exit-glow");
          if (glow && Number(glow.style.opacity) > 0.05) { const c = glow.style.getPropertyValue("--kj-halo"); if (seen.at(-1) !== c) seen.push(c); }
          if (!stage && seen.length) done(); else requestAnimationFrame(watch);
        };
        requestAnimationFrame(watch);
      });
      return seen;
    });
    assert.deepEqual(colors, ["#ffffff", "#4f9bff", "#ff5a4e"], "A賞の予告は 白 → 青 → 赤");
    await page.locator(".kuji-card.reveal.rank-A").waitFor();
    await tap(page, "kuji-reveal");
    await gone(page, "kuji-reveal");
  });
  await check("ten-pull-showcase-and-grid", async page => {
    await setup(page, { owned: ["lotos_plus"] });
    await stack(page, "g5000", [B, S, A, C, C, B, 6, 6, 7, 8]); // A＝ロートスプラスHMD（持っているので中古買い取り）
    await tap(page, "kuji-g5000-10");
    await page.locator('.mo-garagara[data-mode="multi"]').waitFor();
    assert.equal(await page.locator(".kuji-multi-panel.kj-wait").count(), 1, "結果はガラガラのあと");
    await tap(page, "kuji-skip");
    await page.locator(".kuji-multi-panel.kj-in").waitFor();
    assert.equal(await page.locator(".kuji-short").count(), 10);
    assert((await page.locator(".kuji-short.kuji-facedown").count()) >= 8, "玉の載った伏せた札から始まる");
    // 2枚目がS賞: 1枚ずつ大きく見せ、タップで一覧へ戻る
    const show = page.locator('[data-test="kuji-showcase"]');
    await show.waitFor({ timeout: 6000 });
    assert.match(await show.locator(".kuji-card.reveal.rank-S").innerText(), /大当たり[\s\S]*S賞[\s\S]*くるみ材と真鍮の台/);
    assert.equal(await page.locator(".kuji-short.rank-S.kuji-facedown").count(), 1, "見せ場のあいだ、一覧のS賞はまだ伏せている");
    await show.click({ position: { x: 24, y: 24 } });
    await show.waitFor({ state: "detached" });
    await page.locator(".kuji-multi-panel.kj-complete").waitFor({ timeout: 9000 });
    assert.equal(await page.locator(".kuji-short.kuji-facedown").count(), 0);
    assert.equal(await page.locator('[data-test="kuji-flip-all"]').count(), 0);
    assert.deepEqual(await page.locator(".kuji-short .kuji-rank").allTextContents(), ["B賞", "S賞", "A賞", "C賞", "C賞", "B賞", "C賞", "C賞", "C賞", "C賞"]);
    assert.match(await page.locator(".kuji-short.rank-A .kuji-dupe").innerText(), /同\s*7,000円/);
    assert.equal(await page.locator(".kuji-short .kj-art").locator("img, .kj-gift").count() >= 10, true);
    // 10枚がスクロールなしで一度に見える
    const fits = await page.locator(".kuji-multi-panel").evaluate(panel => panel.scrollHeight <= panel.clientHeight + 1 && panel.scrollWidth <= panel.clientWidth + 1);
    assert(fits, "10枚の結果がパネルに収まる");
    await page.locator(".kuji-multi-panel .kj-done").click();
    await gone(page, "kuji-multi-reveal");
    const save = await saved(page);
    assert.equal(save.kuji.g5000.drawn, 10); assert.equal(save.money, 500000 - 30000 + 7000);
  });
  await check("ten-pull-flip-all", async page => {
    await setup(page);
    await stack(page, "g5000", [S, B, C, C, B, 6, 6, 7, 8, B]);
    await tap(page, "kuji-g5000-10");
    await tap(page, "kuji-skip");
    // 結果のボタンは、くじの木と真鍮の見た目（共通の紙とラベンダーのボタンのままにしない。LK22）
    const ink = (selector) => page.locator(selector).evaluate((node) => getComputedStyle(node).color);
    assert.equal(await ink('[data-test="kuji-flip-all"]'), "rgb(246, 239, 224)", "すべてめくるは木の面に生成りの文字");
    assert.equal(await ink(".kuji-multi-panel .kj-done"), "rgb(47, 28, 17)", "結果を閉じるは真鍮の面に濃い茶の文字");
    await tap(page, "kuji-flip-all");
    await page.locator(".kuji-multi-panel.kj-complete").waitFor();
    assert.equal(await page.locator(".kuji-short.kuji-facedown").count(), 0);
    assert.equal(await page.locator('[data-test="kuji-showcase"]').count(), 0, "すべてめくるはS賞の見せ場も飛ばす");
    await page.locator(".kuji-multi-panel .kj-done").click();
    await gone(page, "kuji-multi-reveal");
  });
  await check("touch-sizes", async page => {
    await setup(page);
    const k = await page.locator("#stage").evaluate(stage => stage.getBoundingClientRect().width / stage.offsetWidth);
    const real = async (selector, read) => (await page.locator(selector).first().evaluate(read)) * k;
    // 連続（ラストワン賞込みで11枚）: SKIP と札の文字とボタンが実寸で小さすぎない
    await page.evaluate(() => { const box = G.core.state.kuji.g5000; box.drawn = box.order.length - 10; });
    await page.locator('[data-tab="sell"]').click(); await page.locator('[data-tab="kuji"]').click();
    const ten = page.locator('[data-test="kuji-g5000-10"]');
    await ten.scrollIntoViewIfNeeded(); await ten.click();
    assert((await page.locator('[data-test="kuji-skip"]').boundingBox()).height >= 39.5, "SKIP は実寸40px以上");
    await tap(page, "kuji-skip");
    await tap(page, "kuji-flip-all");
    await page.locator(".kuji-multi-panel.kj-complete").waitFor();
    assert.equal(await page.locator(".kuji-short").count(), 11);
    assert((await real(".kuji-short .kuji-name", node => parseFloat(getComputedStyle(node).fontSize))) >= 11.9, "札の景品名は実寸12px以上");
    assert((await real(".kuji-short.rank-LAST .kuji-rank", node => parseFloat(getComputedStyle(node).fontSize))) >= 11.9);
    assert((await page.locator(".kj-done").boundingBox()).height >= 39.5);
    const sideways = await page.locator(".kuji-multi-panel").evaluate(panel => panel.scrollWidth <= panel.clientWidth + 1);
    assert(sideways, "横にはみ出さない");
    await page.locator(".kj-done").scrollIntoViewIfNeeded(); await page.locator(".kj-done").click();
    await gone(page, "kuji-multi-reveal");
    // 1回引き: 札が画面に収まり、説明はスマホでは出さない（#2729）。東京店のくじは1種類なので、引き切った箱を引く前へ戻して使う
    await stack(page, "g5000", [S]);
    await page.evaluate(() => { G.core.state.kuji.g5000.emptyDay = null; });
    await page.locator('[data-tab="sell"]').click(); await page.locator('[data-tab="kuji"]').click();
    const one = page.locator('[data-test="kuji-g5000"]');
    await one.scrollIntoViewIfNeeded(); await one.click();
    await tap(page, "kuji-skip");
    const card = page.locator(".kuji-card.reveal");
    await card.waitFor();
    await page.waitForTimeout(900); // 札が開き切るまで
    const box = await card.boundingBox(), view = page.viewportSize();
    assert(box.x >= 0 && box.y >= 0 && box.x + box.width <= view.width && box.y + box.height <= view.height, `札が画面に収まる ${JSON.stringify(box)}`);
    assert(await card.locator(".kuji-desc").isHidden());
    assert((await real(".kuji-card.reveal .kuji-name", node => parseFloat(getComputedStyle(node).fontSize))) >= 13.9);
    assert((await page.locator('[data-test="kuji-close"]').boundingBox()).width >= 39.5);
    await tap(page, "kuji-close");
    await gone(page, "kuji-reveal");
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  await check("reduced-motion", async page => {
    await setup(page);
    await stack(page, "g5000", [S, B, C, C, B, 6, 6, 7, 8, B]);
    await tap(page, "kuji-g5000");
    // 止まった抽選器を短く見せてから札。粒子と SKIP は出さない
    await page.locator(".mo-garagara").waitFor();
    assert.equal(await page.locator("canvas.kj-fx").count(), 0);
    assert.equal(await page.locator('[data-test="kuji-skip"]').count(), 0);
    await page.locator(".kuji-card.reveal.rank-S").waitFor();
    assert.equal(await page.locator("canvas.kj-fx").count(), 0);
    await tap(page, "kuji-reveal");
    await gone(page, "kuji-reveal");
    await tap(page, "kuji-g5000-5");
    await page.locator(".kuji-multi-panel.kj-in").waitFor();
    await page.locator(".kuji-multi-panel.kj-complete").waitFor();
    assert.equal(await page.locator(".kuji-short").count(), 5);
    await page.locator(".kuji-multi-panel .kj-done").click();
    await gone(page, "kuji-multi-reveal");
  }, { reducedMotion: "reduce" });
});
