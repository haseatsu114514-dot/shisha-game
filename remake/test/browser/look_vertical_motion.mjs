// 縦持ちが基本（VPO01）と、モーショングラフィックスの縦の舞台（VPO02〜）。2026-11-28 オーナー「モーショングラフィックスも縦画面に最適化して
// あと基本は縦画面で遊ぶ仕様にしていって　今開くと横向きにしろとか出るけど」。
// 確かめること:
//   起動: 縦画面を縦持ちで開くと、起動画面からタイトルまで回転案内（「スマホは横向きで…」）が一度も出ない。ホーム画面版の向きは固定しない（manifest）。
//         旧版を選んだ端末を縦に持った時だけ、今までどおり回転案内が出る。
//   演出: 縦持ちの縦画面では、演出は本編の見えない画面（#fx）ではなく、画面いっぱいの縦の舞台（#vt-motion・論理の幅 720）に出る。
//         縦の構図を持つ演出（LIME の連絡先交換・タロット）は縦の舞台の大きさで組まれ、画面の中に収まる。縦の構図がまだ無い演出は、
//         横長（1280×720）のまま縦の舞台の真ん中に幅いっぱいで出る（.vt-mo-wide）。演出の間は回転案内を出さず、終われば舞台は空になる。
//   横持ち: 縦画面を選んでいても横持ちなら、演出は今までどおり #fx（1280×720）に出る。
// 自動操作のブラウザの既定は旧版なので ?look=vertical を付けて選ぶ。
import assert from "node:assert/strict";
import { suite, baseURL } from "./support.mjs";

const withLook = (look) => `${baseURL}${baseURL.includes("?") ? "&" : "?"}look=${look}`;
const TALL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const WIDE = { viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true };
const waitScene = (page, name, timeout = 20000) => page.waitForFunction((name) => window.__verticalLook?.scene?.() === name, name, { timeout });
const hintShown = (page) => page.evaluate(() => getComputedStyle(document.getElementById("rotate-hint")).display !== "none");

// 読み込みの最初から、回転案内が見えた瞬間を記録する（起動画面の間に一瞬でも出たら分かるように）
function watchHint() {
  window.__hintSeen = [];
  const tick = () => {
    const hint = document.getElementById("rotate-hint");
    if (hint && getComputedStyle(hint).display !== "none") window.__hintSeen.push(document.body?.dataset.screen || "?");
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/** 縦の舞台に今ある演出の見え方。 */
const stageView = (page) => page.evaluate(() => {
  const layer = document.getElementById("vt-motion");
  const rect = (node) => { const r = node?.getBoundingClientRect(); return r ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null; };
  return {
    layer: rect(layer), layerH: Number(layer?.dataset.h || 0), visibility: layer && getComputedStyle(layer).visibility,
    kids: layer ? [...layer.children].map((node) => node.className) : [],
    fx: [...document.querySelectorAll("#fx > .mo")].map((node) => node.className),
    w: innerWidth, h: innerHeight,
  };
});

await suite("look-vertical-motion", async (check) => {
  await check("opening-in-portrait-shows-no-landscape-guard", async (page) => {
    await waitScene(page, "title");
    assert.deepEqual(await page.evaluate(() => window.__hintSeen), [], "縦画面を縦持ちで開いた時、起動画面からタイトルまで回転案内が出ない");
    assert.equal(await hintShown(page), false);
    const manifest = await page.evaluate(() => fetch("manifest.webmanifest").then((r) => r.json()));
    assert.equal(manifest.orientation, "any", "ホーム画面版の向きは横に固定しない");
  }, { ...TALL, pageEntry: withLook("vertical") });

  await check("classic-look-in-portrait-keeps-the-guard", async (page) => {
    // 旧版（横画面だけの前の仕様）を選んだ端末を縦に持った時は、今までどおり回転案内で覆う
    await page.waitForFunction(() => document.documentElement.dataset.look === "classic");
    assert.equal(await hintShown(page), true, "旧版の縦持ちは回転案内");
    assert.match(await page.locator("#rotate-hint").innerText(), /スマホは横向きでお楽しみください/);
  }, { ...TALL, pageEntry: withLook("classic") });

  await check("motions-play-on-the-portrait-stage", async (page) => {
    await waitScene(page, "title");
    // 演出の間に、回転案内が演出の上に出た瞬間を数える（演出の下が場面の切り替えの途中でも、外枠は引っ込めない）
    await page.evaluate(() => {
      window.__hintOverMotion = [];
      const tick = () => {
        const layer = document.getElementById("vt-motion"), hint = document.getElementById("rotate-hint");
        if (layer?.childElementCount && getComputedStyle(hint).display !== "none") window.__hintOverMotion.push([...layer.children].map((n) => n.className).join(" "));
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    // 縦の構図を持つ演出: LIME の連絡先交換。縦の舞台いっぱいの層に入り、スマホは画面の幅の8割ほどで真ん中に出る
    await page.evaluate(() => { window.__lime = window.__remake.dev.motion("lime"); });
    await page.locator("#vt-motion > .mo-lime.mo-portrait").waitFor({ state: "attached" });
    await page.waitForTimeout(900); // スマホが下から上がりきるまで
    let view = await stageView(page);
    assert.deepEqual(view.fx, [], "演出は本編の見えない画面（#fx）には置かない");
    assert(Math.abs(view.layer.left) <= 1 && Math.abs(view.layer.top) <= 1 && Math.abs(view.layer.right - view.w) <= 1 && Math.abs(view.layer.bottom - view.h) <= 1,
      `縦の舞台が画面いっぱいを覆う ${JSON.stringify(view)}`);
    assert.equal(view.layerH, Math.max(1100, Math.round((720 * view.h) / view.w)), "縦の舞台の高さは画面の縦横比から");
    const phone = await page.locator("#vt-motion .mo-lime-phone").boundingBox();
    assert(phone.width >= view.w * 0.75 && phone.x >= -1 && phone.x + phone.width <= view.w + 1 && Math.abs(phone.x + phone.width / 2 - view.w / 2) <= view.w * 0.05,
      `LIME のスマホが縦の画面の幅いっぱい近くで真ん中に出る ${JSON.stringify(phone)}`);
    assert(phone.y >= -1 && phone.y + phone.height <= view.h + 1, `LIME のスマホが画面の高さに収まる ${JSON.stringify(phone)}`);
    assert.equal(await hintShown(page), false, "演出の間は回転案内を出さない");
    await page.evaluate(() => window.__lime);
    view = await stageView(page);
    assert.deepEqual([view.kids, view.visibility], [[], "hidden"], "演出が終われば縦の舞台は空で、触れられる外枠へ戻る");

    // タロット: 3枚を配ってめくる。めくった札と帯が画面の中に出る
    await page.evaluate(() => { window.__tarot = (async () => {
      const core = await import("./js/core/state.js");
      core.newGame();
      return (await import("./js/core/scene-motions.js")).tarotFlip("tsumugi");
    })(); });
    await page.locator("#vt-motion > .mo-tarot.mo-portrait").waitFor({ state: "attached" });
    await page.waitForTimeout(3300); // めくり終えて帯が出るまで
    const picked = await page.locator("#vt-motion .mo-tc-card:has(.mo-tc-face.front)").boundingBox(); // めくる札（表の面を持つ1枚）
    const band = await page.locator("#vt-motion .mo-tc-band").boundingBox();
    view = await stageView(page);
    assert(picked.x >= -1 && picked.x + picked.width <= view.w + 1 && picked.y >= -1 && picked.y + picked.height <= view.h + 1 && picked.width >= view.w * 0.45,
      `めくった札が縦の画面の中に大きく出る ${JSON.stringify(picked)}`);
    assert(band.y >= picked.y + picked.height - 1 && band.y + band.height <= view.h + 1, `札の名前の帯は札の下で画面の中 ${JSON.stringify({ band, picked })}`);
    await page.evaluate(() => window.__tarot);

    // 縦の構図がまだ無い演出は、横長のまま縦の舞台の真ん中に幅いっぱいで出る。縦の構図で置いた演出の舞台は 720×H
    const frames = await page.evaluate(async () => {
      const { stagePlay } = await import("./js/motions/stage.js");
      const { frameOf } = await import("./js/core/motion-frame.js");
      const seen = {};
      await stagePlay("probe-wide", async (node) => {
        const box = node.closest(".vt-mo-wide-box")?.getBoundingClientRect();
        seen.wide = { frame: frameOf(node), box: box && { x: box.x, width: box.width, height: box.height, center: box.top + box.height / 2 } };
      });
      await stagePlay("probe-tall", async (node) => {
        seen.tall = { frame: frameOf(node), inLayer: node.parentElement?.id === "vt-motion" };
      }, { portrait: true });
      return seen;
    });
    view = await stageView(page);
    assert.deepEqual([frames.wide.frame.W, frames.wide.frame.H, frames.wide.frame.portrait], [1280, 720, false], "縦の構図が無い演出は横の舞台の大きさのまま");
    assert(frames.wide.box && Math.abs(frames.wide.box.width - view.w) <= 1 && Math.abs(frames.wide.box.height - (view.w * 720) / 1280) <= 1
      && Math.abs(frames.wide.box.center - view.h / 2) <= 2, `横長の演出は幅いっぱい・縦の真ん中 ${JSON.stringify(frames.wide.box)}`);
    assert.deepEqual([frames.tall.frame.W, frames.tall.frame.H, frames.tall.frame.portrait, frames.tall.inLayer], [720, view.layerH, true, true], "縦の構図で置く演出の舞台は 720×H");
    assert.deepEqual(await page.evaluate(() => window.__hintOverMotion.slice(0, 3)), [], "演出の間は、回転案内を演出の上に出さない");
  }, { ...TALL, pageEntry: withLook("vertical") });

  await check("kuji-and-dawn-on-the-portrait-stage", async (page) => {
    // VPO17: シーシャくじは縦の舞台で引ける（今までは回転案内）。抽選器のまわりを幅いっぱいに写し、賞の札は画面の中に開き、タップで閉じる
    await waitScene(page, "title");
    await page.evaluate(() => { window.__kuji = window.__remake.dev.motion("garagara-C"); });
    await page.locator("#vt-motion > .kuji-overlay.vt-kj").waitFor({ state: "attached" });
    await page.locator("#vt-motion .vt-kj-stage .mo-garagara").waitFor({ state: "attached" });
    const stage = await page.locator("#vt-motion .vt-kj-stage").boundingBox();
    const w = await page.evaluate(() => innerWidth), h = await page.evaluate(() => innerHeight);
    assert(Math.abs(stage.x + (340 / 700) * w) <= 2 && stage.width >= w * 1.8, `抽選器のまわり（舞台の x 340〜1040）が画面の幅いっぱい ${JSON.stringify(stage)}`);
    assert.equal(await hintShown(page), false, "くじの間は回転案内を出さない");
    await page.locator("#vt-motion .kuji-card.reveal").waitFor({ timeout: 20000 });
    await page.waitForTimeout(900);
    const card = await page.locator("#vt-motion .kuji-card.reveal").boundingBox();
    assert(card.x >= -1 && card.x + card.width <= w + 1 && card.y >= -1 && card.y + card.height <= h + 1 && card.width >= w * 0.85,
      `賞の札が縦の画面の中に幅いっぱい近くで開く ${JSON.stringify(card)}`);
    await page.locator("#vt-motion .kuji-overlay").click();
    await page.evaluate(() => window.__kuji);
    assert.equal(await page.locator("#vt-motion > *").count(), 0, "札を閉じると縦の舞台は空");

    // VPO18: 夜明けの日付の札は、縦の舞台いっぱいの部屋の絵の上に、画面の下の方に出る
    await page.evaluate(() => { window.__dawn = window.__remake.dev.motion("dawn-sun"); });
    await page.locator("#vt-motion > .tr-dawn.mo-portrait .tr-dawn-card").waitFor({ timeout: 15000 });
    await page.waitForTimeout(700);
    const dawn = await page.locator("#vt-motion .tr-dawn-card").boundingBox();
    assert(dawn.x >= 0 && dawn.x + dawn.width <= w + 1 && dawn.y >= h * 0.5 && dawn.y + dawn.height <= h, `日付の題字が画面の下の方に収まる ${JSON.stringify(dawn)}`);
    assert.equal(await hintShown(page), false);
    await page.evaluate(() => window.__dawn);
  }, { ...TALL, pageEntry: withLook("vertical") });

  await check("landscape-keeps-motions-on-the-stage", async (page) => {
    const placed = await page.evaluate(async () => {
      const { stagePlay } = await import("./js/motions/stage.js");
      const { frameOf } = await import("./js/core/motion-frame.js");
      let seen = null;
      await stagePlay("probe-land", async (node) => { seen = { frame: frameOf(node), parent: node.parentElement?.id }; }, { portrait: true });
      return { ...seen, layer: !!document.getElementById("vt-motion") };
    });
    assert.deepEqual([placed.frame.W, placed.frame.H, placed.frame.portrait, placed.parent, placed.layer], [1280, 720, false, "fx", false],
      "横持ちでは縦画面を選んでいても演出は今までどおり本編のステージ（#fx）");
  }, { ...WIDE, pageEntry: withLook("vertical") });
}, { initScript: watchHint });
