// 縦画面の試作: ミニゲームの縦用ページ（remake/previews/portrait-stage/frame/）。
// 本編のゲームを layout: "portrait" で動かした時に、絵・HUD・押す所が縦の画面に収まり、タッチで動くこと。既定（横）には印が付かないこと。
// DJ は本体のページ（remake/previews/dj/）が ?layout=portrait で縦になり、次に触る側の皿へ寄ること。
import assert from "node:assert/strict";
import { baseURL, suite } from "./support.mjs";
import { startTrpgStory, turnToTrpgBook } from "./trpg_start.mjs";

const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SHORT = { viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true };
const frame = name => `${baseURL}previews/portrait-stage/frame/${name}`;
/** 見えていて、画面の内側にあり、押す所は実寸 44px 以上。 */
async function boxesInside(page, selectors, { tap = 0 } = {}) {
  const view = page.viewportSize();
  for (const selector of selectors) {
    const box = await page.locator(selector).first().boundingBox();
    assert(box, `${selector} is laid out`);
    assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= view.width + 1 && box.y + box.height <= view.height + 1, `${selector} stays inside the portrait screen: ${JSON.stringify(box)}`);
    if (tap) assert(box.width >= tap && box.height >= tap, `${selector} is at least ${tap}px: ${JSON.stringify(box)}`);
  }
}
/** 指で押し続ける（本物のタッチ。離すまでの間に probe を読む）。 */
async function hold(page, selector, ms, probe) {
  const box = await page.locator(selector).boundingBox();
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 1 }] });
  await page.waitForTimeout(ms);
  const value = await page.evaluate(probe);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  return value;
}

await suite("portrait-games", async check => {
  for (const [suffix, options] of [["phone", PHONE], ["short", SHORT]]) {
    await check(`desert-ride-portrait-layout-${suffix}`, async page => {
      const root = page.locator('[data-test="desert-ride"]');
      assert.equal(await root.getAttribute("data-layout"), "portrait");
      assert.equal(await page.evaluate(() => document.documentElement.dataset.rotateGuard ?? null), null, "no rotate guard in the portrait frame");
      await boxesInside(page, ['[data-test="desert-start"]', '[data-test="desert-practice"]', '[data-test="desert-leave"]', '[data-test="desert-help"]', '[data-test="desert-tier"]', '[data-test="desert-tier-naru"]'], { tap: 44 });
      // 段は本編と同じ解放（DSR107）: 最初は初級だけ。なるは4枚目の札で、開くまでは「？？？」
      assert.deepEqual(await page.evaluate(() => window.__desertRide.tiers), ["easy"]);
      assert.equal(await page.locator('[data-test="desert-tier-naru"]').isDisabled(), true);
      assert.equal((await page.locator('[data-test="desert-tier-naru"]').innerText()).trim(), "？？？");
      await page.evaluate(() => window.__desertRide.start("run", "noor"));
      await page.waitForFunction(() => window.__desertRide.mode === "run" && window.__desertRide.game, null, { timeout: 30000 });
      await page.evaluate(() => window.__desertRide.skipCountdown());
      // 絵は横長のまま、左右を切って置く（画面より広い）。押す所は絵の下の板に並ぶ
      const view = page.viewportSize(), canvas = await page.locator(".dr-canvas").boundingBox();
      assert(canvas.width > view.width * 1.5 && canvas.x < 0, `the 16:9 picture is cropped at both sides: ${JSON.stringify(canvas)}`);
      assert(Math.abs(canvas.x + canvas.width / 2 - view.width / 2) < 2, "the picture is centered");
      await boxesInside(page, ['[data-test="desert-left"]', '[data-test="desert-right"]', '[data-test="desert-jump"]', '[data-test="desert-boost"]', '[data-test="desert-quit"]'], { tap: 44 });
      await boxesInside(page, [".dr-progress", ".dr-clock", ".dr-score", '[data-test="desert-speedo"]', '[data-test="desert-gauge"]']);
      const left = await page.locator('[data-test="desert-left"]').boundingBox(), jump = await page.locator('[data-test="desert-jump"]').boundingBox();
      assert(left.y + left.height / 2 > canvas.y + canvas.height - 1, "steer buttons sit on the deck below the picture");
      assert(left.x + left.width <= jump.x, "steer on the left thumb, jump on the right thumb");
      for (const hidden of [".dr-hud-left > small", ".dr-clock > small", ".dr-speedo-read > small", '[data-test="desert-course"]']) {
        assert.equal(await page.locator(hidden).first().isVisible(), false, `${hidden} is not shown in portrait`);
      }
      // 指で左を押し続けると左へ、ジャンプで宙へ
      const x0 = await page.evaluate(() => window.__desertRide.game.x);
      const x1 = await hold(page, '[data-test="desert-left"]', 500, () => window.__desertRide.game.x);
      assert(x1 < x0 - 0.05, `holding left steers left: ${x0} -> ${x1}`);
      const air = await hold(page, '[data-test="desert-jump"]', 150, () => window.__desertRide.game.air);
      assert(air > 0, "tapping jump lifts off");
      // 結果: 6つの記録だけ出し、ボタンが画面に収まる
      await page.evaluate(() => { const r = window.__desertRide; r.autoplay("expert"); r.setSpeedUp(16); });
      await page.locator('[data-test="desert-result"]').waitFor({ timeout: 60000 });
      await page.evaluate(() => window.__desertRide?.setSpeedUp(1));
      await boxesInside(page, ['[data-test="desert-retry"]', '[data-test="desert-choose-tier"]', '[data-test="desert-result"] [data-test="desert-leave"]'], { tap: 44 });
      await boxesInside(page, ['[data-test="desert-rank"]', '[data-test="desert-total"]', '[data-test="desert-time"]', '[data-test="desert-tricks"]', '[data-test="desert-boosts"]']);
      assert.equal(await page.locator('[data-test="desert-result"] .dr-row:visible').count(), 6, "six stat cells in portrait");
    }, { ...options, pageEntry: frame("desert.html?course=ridge"), pageReadySelector: '[data-test="desert-start"]' });

    await check(`camel-race-portrait-layout-${suffix}`, async page => {
      assert.equal(await page.locator('[data-test="camel-game"]').getAttribute("data-layout"), "portrait");
      await boxesInside(page, ['[data-test="camel-cup"][data-cup="practice"]', '[data-test="camel-cup"][data-cup="rookie"]', '[data-test="camel-cup"][data-cup="standard"]', '[data-test="camel-cup"][data-cup="expert"]'], { tap: 44 });
      await page.locator('[data-test="camel-cup"][data-cup="practice"]').tap();
      await page.waitForFunction(() => window.__camelRace?.fx.phase === "race", null, { timeout: 30000 });
      await boxesInside(page, ['[data-test="camel-voice"]', '[data-test="camel-signal"]', '[data-test="camel-pause"]', '[data-test="camel-close"]'], { tap: 44 });
      await boxesInside(page, [".camel-progress", ".camel-clock", ".camel-standings li[data-pos='1']", ".camel-standings li[data-pos='2']", ".camel-standings li[data-pos='3']", ".camel-standings li[data-pos='4']"]);
      // コースは左右を切って置く。順位は2列×2段、声は左・ムチは右で、どちらもコースの下
      const view = page.viewportSize(), canvas = await page.locator(".camel-canvas").boundingBox();
      assert(canvas.width > view.width * 1.3 && canvas.x < 0 && canvas.x + canvas.width > view.width, `the course is cropped at both sides: ${JSON.stringify(canvas)}`);
      // 順位の札は入れ替わる時にます目の間を滑るので、落ち着いた所で 2列×2段 になっていることを見る
      await page.waitForFunction(() => {
        const box = pos => document.querySelector(`.camel-standings li[data-pos='${pos}']`)?.getBoundingClientRect();
        const [first, second, third, fourth] = [1, 2, 3, 4].map(box);
        return first && second && third && fourth && Math.abs(first.top - second.top) < 2 && second.left > first.right - 2
          && third.top > first.bottom - 2 && Math.abs(third.top - fourth.top) < 2 && Math.abs(third.left - first.left) < 2;
      }, null, { timeout: 8000 });
      const voice = await page.locator('[data-test="camel-voice"]').boundingBox(), whip = await page.locator('[data-test="camel-signal"]').boundingBox();
      assert(voice.x + voice.width <= whip.x && voice.y >= canvas.y + canvas.height - 1 && whip.y >= canvas.y + canvas.height - 1, "voice (left) and whip (right) sit below the course");
      for (const hidden of [".camel-title", ".camel-clock-sub", ".camel-speed-read small", ".camel-signal-note", ".camel-rhythm small"]) {
        assert.equal(await page.locator(hidden).first().isVisible(), false, `${hidden} is not shown in portrait`);
      }
      // ムチは押している間だけ。一時停止の札はボタンが収まる
      assert.equal(await hold(page, '[data-test="camel-signal"]', 400, () => window.__camelRace.fx.whipHeld), true, "holding the whip button whips");
      assert.equal(await page.evaluate(() => window.__camelRace.fx.whipHeld), false, "releasing stops the whip");
      await page.locator('[data-test="camel-pause"]').tap();
      await page.locator('[data-test="camel-paused"]').waitFor();
      await boxesInside(page, ['[data-test="camel-resume"]', '[data-test="camel-restart"]', '[data-test="camel-pause-quit"]'], { tap: 44 });
    }, { ...options, pageEntry: frame("camel.html?skip=1"), pageReadySelector: '[data-test="camel-cups"]' });

    // ボドゲカフェ（TRPG）: 本をめくって物語を選ぶ（TRP11・縦は上下に開く本）→ 表紙 → 卓の会話まで、押す所が縦の画面に収まる（VPG17）
    await check(`trpg-portrait-layout-${suffix}`, async page => {
      const t = name => `[data-test="trpg-${name}"]`;
      assert.equal(await page.evaluate(() => document.documentElement.dataset.layout), "portrait");
      await page.waitForTimeout(1600); // 本棚の幕が上がる
      await boxesInside(page, [t("page-next"), t("campaign-help"), t("bookshelf-open"), t("campaign-close"), t("play-regular-harbor")], { tap: 44 });
      const book = await page.locator(t("book-spread")).boundingBox();
      assert(book.height > book.width * 1.3, `the book opens top to bottom: ${JSON.stringify(book)}`);
      await turnToTrpgBook(page, "trpg-play-ordinary-cup");
      await page.locator(t("play-ordinary-cup")).tap();
      // 初めての卓は店長の説明が先。表紙（物語をはじめる）が出るまで送る
      for (let i = 0; i < 80 && !await page.locator(`${t("start")}:visible`).count(); i++) {
        const next = page.locator(`${t("next")}:visible`);
        if (await next.count()) await next.first().tap().catch(() => {});
        await page.waitForTimeout(150);
      }
      await boxesInside(page, [t("start"), t("exit")], { tap: 44 });
      await startTrpgStory(page);
      await page.locator(`${t("next")}:visible`).waitFor({ timeout: 30000 });
      await boxesInside(page, [`${t("next")}:visible`, t("log"), t("sheets"), t("help"), t("exit")], { tap: 44 });
      await boxesInside(page, [t("seat-gm"), t("heading-step")]);
      const next = await page.locator(`${t("next")}:visible`).boundingBox(), seat = await page.locator(t("seat-gm")).boundingBox();
      assert(next.y > seat.y, "the next button sits below the seats, at the bottom of the screen");
    }, { ...options, pageEntry: frame("trpg.html"), pageReadySelector: '[data-test="trpg-book-spread"]' });

    // てつこといっしょ: 上にてつこ、下に道具。なでると反応が返る
    await check(`tetsuko-time-portrait-layout-${suffix}`, async page => {
      const t = name => `[data-test="tetsuko-${name}"]`;
      await boxesInside(page, [t("cat")]);
      await boxesInside(page, [t("pet"), t("play"), t("brush"), t("treat"), t("help")], { tap: 44 });
      const cat = await page.locator(t("cat")).boundingBox(), pet = await page.locator(t("pet")).boundingBox();
      assert(pet.y > cat.y + cat.height / 2, "the hand tools sit below the cat");
      const before = await page.locator(t("caption")).innerText();
      await page.locator(t("pet")).tap();
      await page.locator(t("cat")).tap();
      await page.waitForFunction(text => document.querySelector('[data-test="tetsuko-caption"]')?.innerText !== text, before, { timeout: 15000 });
      assert.equal(await page.evaluate(() => Object.keys(localStorage).filter(key => /^suien/.test(key) && !/board_tutorial|roamers|floor|step_intro/.test(key)).length), 0, "the portrait frame writes no game save");
    }, { ...options, pageEntry: frame("tetsuko.html"), pageReadySelector: '[data-test="tetsuko-time-screen"]' });

    // DJ は本体のページ（previews/dj）が ?layout=portrait の時だけ縦になる。ブースは横と同じ機材の配置のまま、次に触る側へ寄って拡大する（VPG13）
    await check(`dj-portrait-zooms-to-the-next-touch-${suffix}`, async page => {
      const focus = () => page.evaluate(() => document.getElementById("dj-stage").dataset.focus);
      /** 窓（画面）の中に、その部品がどれだけ見えているか（0〜1）。 */
      const seen = id => page.evaluate(id => {
        const r = document.getElementById(id).getBoundingClientRect(), w = Math.max(0, Math.min(r.right, innerWidth) - Math.max(r.left, 0)), h = Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0));
        return r.width && r.height ? w * h / (r.width * r.height) : 0;
      }, id);
      const settled = () => page.waitForTimeout(800); // 寄る動き
      assert.equal(await page.evaluate(() => document.documentElement.dataset.layout), "portrait");
      // ブースの並びは横のまま（左の皿｜真ん中｜右の皿が横一列で、機材の絵も同じ大きさ）
      const booth = await page.evaluate(() => { const c = document.querySelector(".console"), a = document.getElementById("deck-a"), b = document.getElementById("deck-b"), m = document.querySelector(".mixrow");
        return { w: c.offsetWidth, h: c.offsetHeight, a: a.offsetLeft, m: m.offsetLeft, b: b.offsetLeft, top: [a.offsetTop, b.offsetTop] }; });
      assert.deepEqual([booth.w, booth.h], [1256, 432], "the booth keeps its landscape size");
      assert(booth.a < booth.m && booth.m < booth.b && booth.top[0] === booth.top[1], "decks and mixer stay side by side");
      assert.equal(await focus(), "a", "before the first play: the left deck");
      await page.waitForFunction(() => document.getElementById("platter-b").getBoundingClientRect().left >= innerWidth, null, { timeout: 5000 });
      await settled();
      await boxesInside(page, ["#play-a", "#help", "#restart"], { tap: 44 });
      assert(await seen("platter-a") > 0.97, "the left platter fills the window");
      assert.equal(await page.locator(".p-coach").innerText(), await page.locator("#coaching").innerText(), "the coaching line is mirrored under the floor");
      await page.locator("#play-a").tap();
      await page.waitForFunction(() => document.getElementById("deck-a").dataset.playing === "true", null, { timeout: 30000 });
      await page.waitForFunction(() => document.getElementById("dj-stage").dataset.focus === "b", null, { timeout: 10000 });
      await settled();
      await boxesInside(page, ["#play-b"], { tap: 44 });
      assert(await seen("platter-b") > 0.97 && await seen("platter-a") < 0.05, "the window moved to the right deck");
      // 早押しは予約（0 で入る）。入ったら、つなぎの間は真ん中（案内とミキサー）へ寄る
      await page.waitForFunction(() => !document.getElementById("point-play-b").hidden, null, { timeout: 60000 });
      await page.locator("#play-b").tap();
      await page.waitForFunction(() => !document.getElementById("guide").hidden, null, { timeout: 30000 });
      assert.equal(await focus(), "wide", "while mixing: the mixer in the middle");
      await settled();
      await boxesInside(page, ["#crossfader"], { tap: 44 });
      assert(await seen("wave-a") > 0.97 && await seen("crossfader") > 0.99, "the waveforms and the crossfader are in the window");
      // ズレ直しのボタン（VPG15）: つなぎの最中にズレたら、真ん中に寄ったまま、直す向きのボタンが光り、押し続けると直る
      assert.equal(await page.evaluate(() => window.__dj.slip(0.22)), true);
      await page.waitForFunction(() => document.getElementById("beat").dataset.state === "off", null, { timeout: 8000 });
      await page.waitForTimeout(300);
      assert.equal(await focus(), "wide", "a slip keeps the window on the mixer");
      assert.equal(await page.locator("#nudge-back.go").count(), 1, "the button that fixes it glows");
      await boxesInside(page, ["#nudge-back", "#nudge-fwd"], { tap: 44 });
      const fixed = await hold(page, "#nudge-back", 2500, () => window.__dj.fx.fixes);
      assert(fixed > 0, "holding the button brings the track back in time");
    }, { ...options, pageEntry: `${baseURL}previews/dj/index.html?set=1&layout=portrait&mute=1`, pageReadySelector: "#play-a" });
  }

  await check("dj-landscape-default-is-untouched", async page => {
    assert.equal(await page.evaluate(() => document.documentElement.dataset.layout ?? null), null);
    assert.equal(await page.locator("#nudge-back").isVisible() || await page.locator("#nudge-fwd").isVisible(), false, "the nudge buttons are portrait only");
    assert.equal(await page.evaluate(() => document.getElementById("dj-stage").dataset.focus ?? null), null);
    const stage = await page.evaluate(() => document.getElementById("dj-stage").offsetWidth);
    assert(stage >= 1280, `landscape stage keeps its width: ${stage}`);
    assert.equal(await page.evaluate(() => [...document.styleSheets].some(sheet => /portrait\.css/.test(sheet.href || ""))), false, "portrait.css is not loaded");
  }, { pageEntry: `${baseURL}previews/dj/index.html?set=1&mute=1`, pageReadySelector: "#play-a" });

  // ボドゲカフェの調べる場面（VPG23）: 部屋の絵を縦で大きく見せ、左半分・右半分を「左・右」の札と横に払うので切り替える。
  // 今の側に無い印は隠れ、反対側の札にまだ調べていない数が出る。右へ移ると隠れていた印が画面の中に出て、押すと手がかりが増える
  await check("trpg-portrait-explore-pans-left-and-right", async page => {
    await page.waitForFunction(() => document.getElementById("stage")?.dataset.exploring === "true", null, { timeout: 180000 });
    await page.waitForTimeout(600);
    const view = page.viewportSize();
    const pic = await page.locator(".trpg-room > img").boundingBox();
    assert(pic.height >= view.height * .4 && pic.width > view.width * 1.6, `the room picture is tall and wider than the screen: ${JSON.stringify(pic)}`);
    const spots = () => page.evaluate(() => [...document.querySelectorAll(".trpg-room.interactive .trpg-spot")].map(n => ({ id: n.dataset.test, off: n.dataset.off === "true", checked: n.classList.contains("checked") })));
    let now = await spots();
    const leftShown = now.filter(n => !n.off), leftHidden = now.filter(n => n.off);
    assert(leftShown.length && leftHidden.length, `the left half shows some spots and hides the rest: ${JSON.stringify(now)}`);
    await boxesInside(page, leftShown.map(n => `[data-test="${n.id}"] > i`), { tap: 44 });
    await boxesInside(page, ['[data-test="trpg-pan-left"]', '[data-test="trpg-pan-right"]'], { tap: 44 });
    assert.equal(await page.locator('[data-test="trpg-pan-right"] em').innerText(), String(leftHidden.filter(n => !n.checked).length), "the right tab counts the spots waiting there");
    await page.locator('[data-test="trpg-pan-right"]').tap();
    await page.waitForFunction(() => document.getElementById("stage").dataset.pan === "right");
    await page.waitForTimeout(500);
    now = await spots();
    const target = now.find(n => !n.off && leftHidden.some(h => h.id === n.id));
    assert(target, `a spot hidden on the left shows on the right: ${JSON.stringify(now)}`);
    await boxesInside(page, [`[data-test="${target.id}"] > i`], { tap: 44 });
    const notes = page.locator('[data-test="trpg-compare-notes"]');
    const before = await notes.innerText();
    await page.locator(`[data-test="${target.id}"] > i`).tap();
    await page.waitForFunction(() => document.getElementById("stage").dataset.exploring === "false");
    for (let i = 0; i < 80; i++) {
      if (await page.evaluate(() => document.getElementById("stage").dataset.exploring === "true")) break;
      await page.evaluate(() => [...document.querySelectorAll('[data-test="trpg-next"]')].find(n => n.offsetParent && !n.disabled)?.click());
      await page.waitForTimeout(250);
    }
    assert(await page.locator(`[data-test="${target.id}"]`).evaluate(n => n.classList.contains("checked")), "the spot is now investigated");
    assert.notEqual(await notes.innerText(), before, "the memo counts the new clue");
    // 絵を右へ払うと左半分へ戻る
    const box = await page.locator(".trpg-room > img").boundingBox();
    const y = pic.y + pic.height * .5;
    await page.mouse.move(view.width * .2, y); await page.mouse.down(); await page.mouse.move(view.width * .5, y, { steps: 6 }); await page.mouse.move(view.width * .8, y, { steps: 6 }); await page.mouse.up();
    await page.waitForFunction(() => document.getElementById("stage").dataset.pan === "left");
    assert(box, "the picture is laid out");
  }, { ...PHONE, pageEntry: frame("trpg.html?jump=explore"), pageReadySelector: '[data-test="trpg-book-spread"]' });

  // てつこといっしょ: 付き合ってくれる回数を使い切ると、帰りの札（ハート → なかよし）が縦の画面に収まって出る。
  // なかよし 58 から帰ると、肉球3つの節目（60）を越えて色つきの火種のしるしが並ぶ（TKT35・TKT39）。ご機嫌ななめの日でも一日は終わる（TKT36）
  await check("tetsuko-portrait-day-ends-on-the-result-card", async page => {
    const t = name => `[data-test="tetsuko-${name}"]`;
    await page.locator(`${t("result")}[data-filled="1"]`).waitFor({ timeout: 120000 });
    await boxesInside(page, [t("result"), t("result-paws"), t("result-ember-60")]);
    assert(Number(await page.locator(t("result")).getAttribute("data-gain")) >= 2, "going home always adds to the bond");
  }, { ...PHONE, pageEntry: frame("tetsuko.html?shot=end&bond=58&mood=grumpy"), pageReadySelector: '[data-test="tetsuko-time-screen"]' });

  await check("prototype-hosts-the-game-frames", async page => {
    for (const [scene, ready] of [["desert", '[data-test="desert-start"]'], ["camel", '[data-test="camel-tutorial"]'], ["dj", "#play-a"], ["tetsuko", '[data-test="tetsuko-time-screen"]'], ["trpg", '[data-test="trpg-book-spread"]']]) {
      await page.goto(`${baseURL}previews/portrait-stage/index.html?view=play&scene=${scene}&bare`, { waitUntil: "load" });
      const host = page.locator(".phone .gm-frame");
      await host.waitFor();
      await page.frameLocator(".phone .gm-frame").locator(ready).waitFor({ timeout: 30000 });
      const phone = await page.locator(".phone").boundingBox(), box = await host.boundingBox();
      assert(Math.abs(box.width - phone.width) < 2 && Math.abs(box.height - phone.height) < 2, `${scene} fills the phone`);
    }
  }, { ...PHONE, pageEntry: `${baseURL}previews/portrait-stage/index.html?view=play&scene=desert&bare`, pageReadySelector: ".phone .gm-frame" });

  await check("landscape-default-has-no-portrait-mark", async page => {
    await page.locator('[data-test="desert-page-start"]').click();
    assert.equal(await page.locator('[data-test="desert-ride"]').getAttribute("data-layout"), null);
  }, { pageEntry: `${baseURL}desert-ride.html`, pageReadySelector: '[data-test="desert-page-start"]' });
}, { readShopGreeting: false }); // 店の挨拶を読む部品は本編のページ用（縦試作の枠のページには本編の会話が無い）
