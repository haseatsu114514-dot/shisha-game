// DESERT RIDE（第4章ドバイ・サンドボード）: 単体ページ（PCの鍵盤・スマホのタッチ・動き軽減）と、
// 第4章の本編接続（デスクで3日話す→砂丘へ→練習→本番→記録→夕日→同じ日は二度行けない→SAVE/LOAD→中断）。
import assert from "node:assert/strict";
import { suite } from "./support.mjs";

const t = name => `[data-test="${name}"]`;
const get = page => page.evaluate(() => structuredClone(window.__remake.state));
const ride = (page, code) => page.evaluate(code);
const game = page => page.evaluate(() => { const g = window.__desertRide?.game; return g ? { z: g.z, x: g.x, air: g.air, airKind: g.airKind, t: g.t, score: g.score, falls: g.falls, finished: g.finished, hops: g.stats.hops, bigJumps: g.stats.bigJumps } : null; });
const phase = (page, value) => page.waitForFunction(value => document.querySelector('[data-test="desert-ride"]')?.dataset.phase === value, value, { timeout: 90000 });
const autoplayToResult = async (page, skill = "expert") => {
  await phase(page, "run"); // 初回/相手変更の画像準備が終わってから自動操縦を設定する。
  await page.evaluate(skill => { window.__desertRide.autoplay(skill); window.__desertRide.setSpeedUp(8); }, skill);
  await phase(page, "result");
};
const resultText = async page => (await page.locator(t("desert-result")).innerText()).replace(/\s+/g, " ");


// 速度メーター（2026-11-11 作り直し）: 左の針の文字盤と右の数字は重ならない。目盛り・弧・針は文字盤の絵と同じ中心。
// 弧の長さは描く弧と同じ。表示は現実寄りの km/h（出だし約30）。行（メーター・ゲージ・時計）は分かれたまま。
const assertSpeedo = async page => {
  const boxes = await page.locator(t("desert-speedo")).evaluate(node => {
    const rect = selector => node.querySelector(selector).getBoundingClientRect().toJSON();
    const path = node.querySelector(".dr-speedo-fill");
    return {
      box: node.getBoundingClientRect().toJSON(), dial: rect(".dr-speedo-dial"), gauge: rect(".dr-speedo-gauge"), read: rect(".dr-speedo-read"), kmh: rect(".dr-kmh"),
      length: path.getTotalLength(), dash: Number(path.getAttribute("stroke-dasharray")),
    };
  });
  const mid = r => [r.left + r.width / 2, r.top + r.height / 2];
  assert(boxes.read.left >= boxes.dial.right && boxes.kmh.left >= boxes.dial.right, "the number sits beside the dial, never over the needle or arc");
  assert(boxes.kmh.right <= boxes.box.right + 0.5 && boxes.kmh.top >= boxes.box.top - 0.5 && boxes.kmh.bottom <= boxes.box.bottom + 0.5, "the number stays inside the speedometer row");
  assert(mid(boxes.gauge).every((v, i) => Math.abs(v - mid(boxes.dial)[i]) < 1), "ticks, arc and needle share the dial art's centre");
  assert(Math.abs(boxes.length - boxes.dash) < 0.2, "full gauge uses the actual arc length");
  const rows = await page.evaluate(() => {
    const rect = selector => document.querySelector(selector).getBoundingClientRect();
    return { dial: rect(".dr-speedo"), bar: rect(".dr-boost-meter"), clock: rect(".dr-clock"), panel: rect(".dr-hud-right"), quit: rect(".dr-quit") };
  });
  assert(rows.dial.bottom <= rows.bar.top && rows.bar.bottom <= rows.clock.top, "dial, boost bar and clock have separate rows");
  assert(rows.clock.bottom <= rows.panel.bottom && rows.panel.bottom <= rows.quit.top, "clock and quit stay outside each other's bounds");
  const flameLoads = await page.evaluate(() => performance.getEntriesByType("resource").filter(entry => /boost-(aura|burst|spark)\.webp/.test(entry.name)).length);
  assert.equal(flameLoads, 0, "boost does not load the screen-obscuring flame effects");
};

await suite("desert-ride", async check => {
  await check("practice-captions-fit-between-hud-and-idle-finish-is-neutral", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-tutorial")).click();
    await phase(page, "practice");
    // 長いキーボード・タッチ用の案内も、左右の HUD と重ならず帯の中で折り返す。
    for (const text of ["← → で左右に動こう","岩に当たると転ぶ。先を見て、早めによけよう","起伏の手前で Space ── 大きく跳べる","着地の直前、輪がボタンに重なったら Space ── 着地が決まる","惜しい。次の起伏で、もう一度跳んでみよう","次は、跳んだら空中で ← か → を押し続けて回ろう","離すと回り切る。着地より前に離そう","回った！ 回るほど点が大きい","回りかけで着地すると転ぶ。もう少し早く離そう","溜まったゲージで↓（BOOST）を押すと超加速 ── 岩も砕ける","そのまま、岩へ突っ込め！","いい感じ。あとは、滑るだけ","「左へ」「右へ」で動こう","起伏の手前で「ジャンプ」── 大きく跳べる","空中ではジャンプが「LAND」に変わる。輪が重なったら押そう","次は、跳んだら空中で「左へ」か「右へ」を押し続けて回ろう","溜まったゲージで「BOOST」を押すと超加速 ── 岩も砕ける",
      // 2026-11-13: 立て直しの段（練習の最後の岩の壁）
      "最後に、立て直し。岩の壁にわざと当たって、すぐ ↓（BOOST）","当たった！ すぐ ↓（BOOST）で立て直せ","立て直した！ 転倒は帳消しで、そのまま加速","惜しい。当たった直後に押すと、立て直せる",
      "砕いた！ ブーストが無い時に当たったら、直後に ↓（BOOST）で立て直せる","うまくよけた。当たってしまった時は、直後に ↓（BOOST）で立て直せる",
      "最後に、立て直し。岩の壁にわざと当たって、すぐ「BOOST」","当たった！ すぐ「BOOST」で立て直せ",
      "砕いた！ ブーストが無い時に当たったら、直後に「BOOST」で立て直せる","うまくよけた。当たってしまった時は、直後に「BOOST」で立て直せる"]) {
      const fits = await page.locator(t("desert-caption")).evaluate((node, text) => {
        node.textContent = text;
        const box = node.getBoundingClientRect();
        const left = document.querySelector(".dr-hud-left").getBoundingClientRect();
        const right = document.querySelector(".dr-hud-right").getBoundingClientRect();
        return box.left >= left.right && box.right <= right.left
          && node.scrollWidth <= node.clientWidth && node.scrollHeight <= node.clientHeight;
      }, text);
      assert(fits, `caption stays between the HUD panels: ${text}`);
    }
    // 何も操作せず終わっても習得・成功とは断定しない。再練習と本番の両方を選べる。
    await page.evaluate(() => window.__desertRide.setSpeedUp(8));
    await phase(page, "practiced");
    const end = await page.locator(t("desert-practiced")).innerText();
    assert.match(end, /もう一度練習するか、本番へ進もう/);
    assert.doesNotMatch(end, /体が動きを覚えた|上手！/);
    assert(await page.locator(t("desert-start")).isVisible());
    await page.locator(t("desert-practice")).click();
    await phase(page, "practice");
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    await page.locator(t("desert-leave")).click();
  });

  // 始める前のロード（2026-11-11 オーナー「加速すると処理重い。ゲーム開始前に漫画付きロードとか挟んでもいい」）:
  // 絵の読み込みが遅いと、作業台と同じ漫画つきのロード画面が出て、読み終えて進むと（テストは自動で読む）絵がそろった状態で走り出す。
  await check("slow-art-waits-behind-the-comic-loading-screen", async page => {
    await page.addInitScript(() => {
      window.__comicTitles = [];
      new MutationObserver(() => {
        for (const node of document.querySelectorAll(".loading-comic-title")) if (!window.__comicTitles.includes(node.textContent)) window.__comicTitles.push(node.textContent);
      }).observe(document, { childList: true, subtree: true });
    });
    await page.route(url => /\/img\/ui\/desert_ride\/.+\.webp/.test(url.href), async route => { await new Promise(resolve => setTimeout(resolve, 1500)); await route.continue(); });
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href, { waitUntil: "domcontentloaded" });
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    assert.equal((await page.evaluate(() => window.__comicTitles)).length, 1, "one comic was shown while the art loaded");
    assert.equal(await page.locator(".loading-gate").count(), 0, "the loading screen is gone");
    const missing = await page.evaluate(async () => {
      const { DESERT_ART } = await import("./js/minigames/desert-ride-art.js");
      const loaded = performance.getEntriesByType("resource").map(entry => entry.name);
      return Object.entries(DESERT_ART).filter(([key, def]) => def.file && !key.startsWith("naruRider") && !loaded.some(name => name.includes(def.file))).map(([, def]) => def.file);
    });
    assert.deepEqual(missing, [], "all common and selected rival art finished loading before the run");
    // 2回目からは読み終わっているので、ロード画面を出さずにすぐ始まる。
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    assert.equal((await page.evaluate(() => window.__comicTitles)).length, 1, "no second loading screen once the art is ready");
  });

  await check("standalone-page-keyboard-run-result-best-and-quit", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-menu")).waitFor();
    assert.match(await page.locator(t("desert-menu")).innerText(), /DESERT RIDE/);
    assert.equal(await page.locator(t("desert-best")).count(), 0, "no best yet");
    // 遊び方は常時出さず、「？」を開いた時だけ（#2838）
    assert.equal(await page.locator(t("desert-help-panel")).isVisible(), false, "the how-to is hidden until ? is pressed");
    await page.locator(t("desert-help")).click();
    assert.match(await page.locator(t("desert-help-panel")).innerText(), /Space で大ジャンプ/);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(t("desert-help-panel")).isVisible(), false, "Escape closes the how-to");
    assert.equal(await page.locator(t("desert-start")).isVisible(), true);
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    // 本番はスタートの合図（3・2・1・GO）から。合図の間は進まず、ヌールが左に並んでいる
    assert(await page.evaluate(() => window.__desertRide.countdown > 0), "the run starts with a countdown");
    await assertSpeedo(page);
    assert.equal(await page.locator(t("desert-kmh")).innerText(), "30", "the start reads about 30 km/h during the countdown");
    assert.equal(await page.locator(t("desert-race-gap")).innerText(), "VS ヌール");
    assert(await page.evaluate(() => window.__desertRide.rival.finishTime > 45), "Noor races the same course");
    // PC: → を押し続けると慣性で右へ、Space はホップ（起伏が無い所）
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(() => window.__desertRide.game.x > 0.3);
    await page.keyboard.up("ArrowRight");
    let g = await game(page);
    assert(g.x > 0.3 && g.hops === 0);
    await page.keyboard.press("Space");
    g = await game(page);
    assert(g.hops === 1 || g.bigJumps === 1, "Space jumps");
    assert(await page.locator(t("desert-left")).isVisible() && await page.locator(t("desert-jump")).isVisible(), "touch buttons are shown on PC too");
    // Codex の採用画像（遠景の空・陸、主人公・ヌール・なるの背面、岩、旗、ゴール、砂煙）を読み込んで描いている
    const loaded = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name).filter(name => name.includes("/img/ui/desert_ride/")).map(name => name.split("/").pop()).sort());
    assert.deepEqual(loaded, ["backdrop_day_land.webp", "backdrop_day_sky.webp", "backdrop_dusk_land.webp", "backdrop_dusk_sky.webp", "flag_pole.webp", "goal_banner.webp",
      "rider_brace.webp", "rider_fall.webp", "rider_jump.webp", "rider_lean_left.webp", "rider_lean_right.webp",
      "rider_noor_brace.webp", "rider_noor_fall.webp", "rider_noor_jump.webp", "rider_noor_lean_left.webp", "rider_noor_lean_right.webp", "rider_noor_ride.webp",
      "rider_ride.webp", "rock_large.webp", "rock_small.webp", "sand_puff.webp"]);
    // 空中トリックとブーストを使う理想の滑り: S、ヌールに勝つ。360 以上を決めるとカットインが走る
    await page.evaluate(() => {
      window.__cutins = [];
      const node = document.querySelector('[data-test="desert-cutin"]');
      new MutationObserver(() => { if (node.classList.contains("show")) window.__cutins.push(node.dataset.degrees); }).observe(node, { attributes: true, attributeFilter: ["class"] });
    });
    // 速度は現実寄りの表示: ブーストでも100未満（上手な人で約64・ギネス記録 82 km/h）
    await page.evaluate(() => {
      window.__kmh = [];
      const node = document.querySelector('[data-test="desert-kmh"]');
      new MutationObserver(() => window.__kmh.push(Number(node.textContent))).observe(node, { childList: true, characterData: true, subtree: true });
    });
    await autoplayToResult(page, "expert");
    const shownKmh = await page.evaluate(() => Math.max(...window.__kmh));
    assert(shownKmh >= 85 && shownKmh <= 95, `boost tops out near 91 km/h on the meter (${shownKmh})`);
    const cutins = await page.evaluate(() => window.__cutins);
    assert(cutins.length >= 5 && cutins.includes("720"), `a cut-in for each big trick (${cutins.join(", ")})`);
    assert.equal(await page.locator(".dr-cutin-rider").count() <= 1, true);
    const text = await resultText(page);
    assert.match(text, /RESULT/); assert.match(text, /転倒 0 回/); assert.match(text, /自己ベスト更新/);
    // 2026-11-13 にコースを組み替えた（最初の起伏・連続起伏3つ）ので、コースAの大ジャンプは 7 → 10 回
    assert.match(text, /大ジャンプ 10 回/);
    assert.match(text, /トリック 10 回（最高 720）/);
    // 勝った時の加点は、結果のカードにも出る。S なので「次の評価まで」は出ない
    assert.equal(await page.locator(t("desert-race-points")).innerText(), "+600点");
    assert.equal(await page.locator(t("desert-next-rank")).count(), 0, "nothing above S to aim for"); assert.match(text, /ブースト [2-9] 回/);
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-won"), "true");
    assert.match(await page.locator(t("desert-race")).innerText(), /ヌールに勝った！/);
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "S", "the ideal run is S on the fixed course");
    const total = Number((await page.locator(t("desert-total")).innerText()).replace(/[^\d]/g, ""));
    assert(total >= 16000, `S needs 16000+ (${total})`);
    assert.match(await page.locator(t("desert-time")).innerText(), /(4[5-9]|5\d)\.\d 秒/, "a run takes about a minute");
    // もう一度 → 途中でやめる（Escape）: 記録は残らず、メニューへ
    await page.locator(t("desert-retry")).click();
    await phase(page, "run");
    await page.waitForFunction(() => window.__desertRide.game.z > 60);
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    assert.match(await page.locator(t("desert-menu")).innerText(), /途中でやめた/);
    assert.match(await page.locator(t("desert-best")).innerText(), new RegExp(`自己ベスト ${total.toLocaleString("ja-JP")}点 ／ S`));
    assert.equal(await page.evaluate(() => window.__desertRide.results.length), 1, "the abandoned run is not a result");
    await page.locator(t("desert-leave")).click();
    await page.locator(t("desert-page-best")).waitFor();
    assert.equal(await page.locator(t("desert-ride")).count(), 0, "the game cleans itself up");
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")).rank), "S");
    // ヌールに勝ったので、単体ページでもなる（裏の相手）と勝負できる
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")).beatNoor), true);
    await page.locator(t("desert-page-naru")).waitFor();
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start-naru")).click();
    await phase(page, "run");
    assert.equal(await page.evaluate(() => window.__desertRide.raceWith), "naru");
    assert.equal(await page.locator(t("desert-race-gap")).innerText(), "VS なる");
    await autoplayToResult(page, "perfect");
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-who"), "naru");
    assert.equal(await page.locator(t("desert-race")).getAttribute("data-won"), "false", "clean landings without spins lose to Naru");
    await page.locator(t("desert-leave")).click();
    await page.locator(t("desert-page-best")).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem("suien_remake_save")), null, "the page never touches the real save");
  });

  // 2026-11-13 手応えレビューの反映: 止め（ヒットストップ）・立て直しの合図・押した瞬間の傾き・潰し伸ばし・ゴールの余韻・短い再スタート・次の目標。
  // 長さは __desertRide.feel（実行中に書き換えられる）で延ばして、コマの速さに左右されずに確かめる。
  await check("feel-hit-stop-recover-cue-lean-squash-goal-afterglow-short-retry-and-next-goal", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    assert.equal(await ride(page, () => window.__desertRide.fx.countdownTotal), 2.4, "the first race with Noor has the full 3-2-1-GO");
    // 押した最初のコマで姿勢が傾く（横の速さが付くのを待たない）。離せば戻る
    const lean = await ride(page, () => {
      const d = window.__desertRide; d.skipCountdown(); d.pause(true); d.advance(0.2);
      const pose = (left, right) => { d.setInput(left, right); d.redraw(); return [d.fx.pose, Math.abs(d.game.vx) < 0.05]; };
      return { idle: pose(false, false), right: pose(false, true), left: pose(true, false), back: pose(false, false) };
    });
    assert.deepEqual(lean, { idle: ["rider", true], right: ["riderRight", true], left: ["riderLeft", true], back: ["rider", true] }, "the pose leans on the first frame of a press");
    // 岩に当たった瞬間: 規則の時計が止まる（揺れ・閃光は動く）。立て直せる間は BOOST が緑に光り、押せば止めの中からでも立て直せる
    const beforeHit = await ride(page, () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopFall = 30; // 止めを長くして、止めの間の様子を見る（実行中に変えられる）
      const rock = g.course.features.find(f => f.kind === "rock" && !g.passed.has(f));
      while (g.z < rock.z - 3) d.advance(1 / 60);
      g.x = rock.x; g.vx = 0; g.gauge = 0.6;
      d.pause(false);
      return { glow: getComputedStyle(document.querySelector('[data-test="desert-boost"]')).filter };
    });
    await page.waitForFunction(() => window.__desertRide.game.falls === 1 && window.__desertRide.fx.hitStop > 0);
    const stopped = await ride(page, () => ({ t: window.__desertRide.game.t, z: window.__desertRide.game.z, fx: window.__desertRide.fx }));
    assert(stopped.fx.shake.ax > 0 && stopped.fx.shake.ay > 0 && stopped.fx.shake.life >= 0.3, "a fall shakes both ways, long");
    await page.waitForFunction(() => window.__desertRide.fx.shake.t === 0, null, { timeout: 5000 }); // 揺れは止めの間も実時間で収まる
    const later = await ride(page, () => ({ t: window.__desertRide.game.t, z: window.__desertRide.game.z, hitStop: window.__desertRide.fx.hitStop, recover: document.querySelector('[data-test="desert-ride"]').dataset.recover,
      glow: getComputedStyle(document.querySelector('[data-test="desert-boost"]')).filter }));
    assert.equal(later.t, stopped.t, "the rules clock is frozen during the hit stop"); assert.equal(later.z, stopped.z);
    assert(later.hitStop > 20, "the stop itself runs on real time");
    assert.equal(later.recover, "ready");
    assert.notEqual(later.glow, beforeHit.glow, "the BOOST button itself lights up while a recovery is possible");
    assert.match(later.glow, /drop-shadow/);
    await page.keyboard.press("ArrowDown");
    const recovered = await ride(page, () => ({ falls: window.__desertRide.game.falls, recoveries: window.__desertRide.game.stats.recoveries, hitStop: window.__desertRide.fx.hitStop, feel: window.__desertRide.feel.stopRecover }));
    assert.equal(recovered.falls, 0); assert.equal(recovered.recoveries, 1);
    assert(recovered.hitStop <= recovered.feel + 1e-9, "recovering drops the rest of the fall's stop");
    await page.waitForFunction(t0 => window.__desertRide.game.t > t0 + 0.2, stopped.t); // また走り出す
    // ブーストで岩を砕く: 止めの間だけ岩が白く残り、砕くたびにブーストの残りが減る
    const smash = await ride(page, async () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopFall = 0.12; d.feel.stopSmash = 30;
      d.pause(true);
      const rock = g.course.features.find(f => f.kind === "rock" && !g.passed.has(f) && f.z > g.z + 20);
      while (g.z < rock.z - 3) d.advance(1 / 60, {});
      g.x = rock.x; g.vx = 0; g.boostT = 2; g.fallT = 0;
      d.pause(false);
      await new Promise(resolve => { const timer = setInterval(() => { if (g.stats.smashed > 0 && d.fx.hitStop > 0) { clearInterval(timer); resolve(); } }, 4); });
      const during = { flash: d.fx.smashFlash, boostT: g.boostT };
      d.endHitStop(); d.feel.stopSmash = 0.05;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return { during, after: d.fx.smashFlash };
    });
    assert.equal(smash.during.flash, 1, "the smashed rock stays, white, for the stop"); assert.equal(smash.after, 0, "and bursts into chips when the stop ends");
    assert(smash.during.boostT < 2 - 0.3 && smash.during.boostT > 1.5, `smashing costs boost time (${smash.during.boostT})`);
    // 大ジャンプ: 跳んだ瞬間は縦に伸び、頂点は滞空の後ろ寄り（落ちる方が速い）、完璧な着地は横に潰れて金の輪
    const jump = await ride(page, async () => {
      const d = window.__desertRide, g = d.game;
      d.feel.stopPerfect = 30;
      g.boostT = 0; g.speed = 30; d.autoplay("perfect");
      const perfectBefore = g.stats.perfect; let stretch = null, half = null, late = null;
      await new Promise(resolve => { const timer = setInterval(() => {
        if (g.air > 0 && g.airKind === "big") {
          const progress = 1 - g.air / g.airTotal, fx = d.fx;
          if (progress < 0.04 && !stretch) stretch = fx.squash;
          if (Math.abs(progress - 0.5) < 0.03) half = fx.shownHeight / g.airPeak;
          if (Math.abs(progress - d.feel.jumpApex) < 0.03) late = fx.shownHeight / g.airPeak;
        }
        if (g.stats.perfect > perfectBefore && d.fx.hitStop > 0) { clearInterval(timer); resolve(); }
      }, 2); });
      const landed = { squash: d.fx.squash, rings: d.fx.rings, lastLand: d.fx.lastLand, apex: d.feel.jumpApex };
      d.endHitStop(); d.feel.stopPerfect = 0.06;
      return { stretch, half, late, landed };
    });
    assert(jump.stretch && jump.stretch[0] < 1 && jump.stretch[1] > 1, `take-off stretches tall (${jump.stretch})`);
    assert(jump.landed.apex > 0.5 && jump.half < jump.late && jump.late > 0.99, `the apex comes late, so the fall is faster than the rise (${jump.half} at half, ${jump.late} at the apex)`);
    assert(jump.landed.squash[0] > 1.1 && jump.landed.squash[1] < 0.9, `a perfect landing squashes wide (${jump.landed.squash})`);
    assert.equal(jump.landed.lastLand, "perfect"); assert(jump.landed.rings.includes("perfect"), "the landing ring carries the grade (gold for perfect)");
    // ゴール: 結果はその場で確定するが、カードはすぐ重ねない。幕の先へ滑り抜ける余韻（GOAL!・紙吹雪）を、ジャンプで飛ばせる
    await ride(page, () => { const d = window.__desertRide; d.feel.goalAfter = 600; d.autoplay("expert"); d.setSpeedUp(8); });
    await page.waitForFunction(() => window.__desertRide.fx.goal !== null, null, { timeout: 90000 });
    await ride(page, () => window.__desertRide.setSpeedUp(1));
    const goal = await ride(page, () => { const d = window.__desertRide; return { results: d.results.length, phase: document.querySelector('[data-test="desert-ride"]').dataset.phase, card: document.querySelectorAll('[data-test="desert-result"]').length,
      pop: document.querySelector(".dr-start-pop").textContent, confetti: d.fx.confetti, won: d.game.race.won, clock: document.querySelector(".dr-time").textContent, finish: d.game.finishTime }; });
    assert.deepEqual({ results: goal.results, phase: goal.phase, card: goal.card, pop: goal.pop }, { results: 1, phase: "run", card: 0, pop: "GOAL!" }, "the result is recorded at the line, the card waits");
    assert(goal.confetti > 0, "confetti from the goal poles");
    await page.waitForFunction(() => window.__desertRide.fx.goal > 0.4 && window.__desertRide.game.z > window.__desertRide.game.course.length + 4);
    assert.equal(await page.locator(".dr-time").innerText(), goal.finish.toFixed(1), "the clock shows the finish time while the rider glides on");
    await page.keyboard.press("Space"); // 余韻は飛ばせる
    await phase(page, "result");
    assert.equal(await ride(page, () => window.__desertRide.results.length), 1, "skipping does not record twice");
    assert.equal(await page.locator(t("desert-race-points")).count(), goal.won ? 1 : 0);
    // もう一度: 同じ相手との2本目は、合図が短い（3・2・1・GO を 1.2 秒で）
    await ride(page, () => { window.__desertRide.feel.goalAfter = 1; });
    await page.locator(t("desert-retry")).click();
    await phase(page, "run");
    const retry = await ride(page, () => ({ total: window.__desertRide.fx.countdownTotal, countdown: window.__desertRide.countdown }));
    assert.equal(retry.total, 1.2); assert(retry.countdown > 0 && retry.countdown <= 1.2);
    await page.waitForFunction(() => window.__desertRide.countdown === 0, null, { timeout: 5000 });
    // 着地が遅い滑り（B）: 次の評価までの点と、今回いちばん伸びる所（回転）のひとことが出る
    await autoplayToResult(page, "good");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "B");
    const total = Number((await page.locator(t("desert-total")).locator("strong").innerText()).replace(/[^\d]/g, ""));
    assert.equal(await page.locator(t("desert-next-rank")).innerText(), `次の評価 A まで あと ${(6000 - total).toLocaleString("ja-JP")}点`);
    assert.match(await page.locator(t("desert-tip")).innerText(), /空中で ← か → を押し続けると回転/);
    assert.equal(await ride(page, () => window.__desertRide.results.length), 2);
    // 結果のカードは舞台の中に収まる（行が増えても、上が切れない）
    const card = await page.locator(t("desert-result")).evaluate(node => ({ scroll: node.scrollHeight, client: node.clientHeight }));
    assert(card.scroll <= card.client, `the result card fits without scrolling (${card.scroll} / ${card.client})`);
  });

  // 動き軽減: 止め・揺れ・閃光・潰し伸ばし・紙吹雪・落下の速い軌道は使わない（余韻とひとことは出る）
  await check("feel-reduced-motion-has-no-hit-stop-shake-flash-squash-or-confetti", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-reduce")).check();
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await ride(page, () => {
      const d = window.__desertRide, g = d.game; d.skipCountdown(); d.pause(true);
      const rock = g.course.features.find(f => f.kind === "rock");
      while (g.z < rock.z - 3) d.advance(1 / 60);
      g.x = rock.x; g.vx = 0; d.pause(false);
    });
    await page.waitForFunction(() => window.__desertRide.game.falls === 1);
    const fall = await ride(page, () => window.__desertRide.fx);
    assert.deepEqual({ hitStop: fall.hitStop, shake: fall.shake.t, flash: fall.flash.t, dark: fall.flashDark, squash: fall.squash }, { hitStop: 0, shake: 0, flash: 0, dark: 0, squash: [1, 1] });
    await ride(page, () => { const d = window.__desertRide; d.autoplay("perfect"); d.setSpeedUp(8); });
    await page.waitForFunction(() => window.__desertRide.fx.goal !== null, null, { timeout: 90000 });
    const goal = await ride(page, () => window.__desertRide.fx);
    assert.deepEqual({ confetti: goal.confetti, hitStop: goal.hitStop, flash: goal.flash.t }, { confetti: 0, hitStop: 0, flash: 0 });
    await phase(page, "result");
  });

  await check("phone-touch-buttons-reduced-motion-and-tutorial", async page => {
    // タッチ端末でもブースト中の曲の速さは変えない。
    await page.addInitScript(() => {
      window.__rateWrites = [];
      const rate = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "playbackRate");
      Object.defineProperty(HTMLMediaElement.prototype, "playbackRate", { configurable: true, get() { return rate.get.call(this); },
        set(value) { window.__rateWrites.push(value); rate.set.call(this, value); } });
    });
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-reduce")).check();
    await page.locator(t("desert-page-tutorial")).tap();
    await phase(page, "practice");
    assert.equal(await page.locator(t("desert-ride")).getAttribute("data-reduced-motion"), "true");
    await assertSpeedo(page);
    // 動き軽減では放電の稲妻を出さない（満タンの光だけ）
    const calm = await page.evaluate(async () => {
      const r = window.__desertRide; r.game.gauge = 1; await new Promise(resolve => setTimeout(resolve, 90)); r.redraw();
      const lit = [...document.querySelectorAll(".dr-zap path.core")].filter(path => path.getAttribute("d")).length;
      const shown = [...document.querySelectorAll(".dr-zap")].some(node => getComputedStyle(node).display !== "none");
      r.game.gauge = 0; r.redraw();
      return { lit, shown, charge: document.querySelector('[data-test="desert-ride"]').dataset.charge };
    });
    assert.equal(calm.lit + Number(calm.shown), 0, "reduced motion: no flickering bolts");
    // タッチ端末ではキーの名前を出さず、画面のボタンの名前で言う（#2838）
    assert.equal(await page.locator(t("desert-caption")).innerText(), "「左へ」「右へ」で動こう");
    // ボタンは下辺の左右に分かれ、真ん中の視界を隠さない
    const stage = await page.locator("#stage").boundingBox();
    const left = await page.locator(t("desert-left")).boundingBox(), right = await page.locator(t("desert-right")).boundingBox(), jump = await page.locator(t("desert-jump")).boundingBox();
    const boostButton = await page.locator(t("desert-boost")).boundingBox();
    for (const box of [left, right, jump, boostButton]) {
      assert(box.width >= 100 * (stage.width / 1280) && box.height >= 80 * (stage.height / 720), "buttons are big enough for a thumb");
      assert(box.y > stage.y + stage.height * 0.7, "buttons sit at the bottom");
    }
    assert(right.x + right.width < stage.x + stage.width * 0.35 && jump.x > stage.x + stage.width * 0.7, "the middle of the view stays clear");
    // やめるは ✕ の丸ボタン。指で押せる大きさ（実寸 38px 以上）で、HUD・下辺のボタンと重ならない（#2838）
    const quitBox = await page.locator(t("desert-quit")).boundingBox(), hudRight = await page.locator(".dr-hud-right").boundingBox();
    assert.equal(await page.locator(t("desert-quit")).innerText(), "✕");
    assert(quitBox.width >= 38 && quitBox.height >= 38, `quit is big enough (${quitBox.width}x${quitBox.height})`);
    assert(quitBox.y >= hudRight.y + hudRight.height && quitBox.y + quitBox.height <= jump.y, "quit sits between the HUD and the touch buttons");
    await page.waitForFunction(() => [...document.querySelectorAll(".dr-touch")].every(button => button.classList.contains("art-ready")));
    // 2026-11-11 オーナー「スティックはいらない。左右ボタンを大きく。ジャンプとブーストも大きく」
    assert.equal(await page.locator(".dr-stick").count(), 0, "no stick: left/right are buttons only");
    const k = stage.width / 1280, size = box => Math.min(box.width, box.height) / k;
    assert(size(left) >= 160 && size(right) >= 160, `left/right are big (${size(left)}, ${size(right)})`);
    // 同日「ブーストとジャンプボタンサイズ統一したい」: どちらも 176
    assert(size(jump) >= 170 && Math.abs(size(jump) - size(boostButton)) < 1, `jump and boost are big and the same size (${size(jump)}, ${size(boostButton)})`);
    assert(right.x + right.width <= stage.x + stage.width * 0.3 && boostButton.x >= stage.x + stage.width * 0.7, "the big buttons keep the middle 40% of the view clear");
    // 右を押している間だけ右へ。離すと入力が消える
    const press = async (box, hold) => {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(hold);
      await page.mouse.up();
    };
    await press(right, 700);
    let g = await game(page);
    assert(g.x > 0.2, `held right moves right (${g.x})`);
    const inputs = await page.evaluate(() => { const b = document.querySelector('[data-test="desert-right"]'); return b.classList.contains("on"); });
    assert.equal(inputs, false, "released button is off");
    await press(jump, 60);
    g = await game(page);
    assert(g.hops + g.bigJumps >= 1, "the jump button jumps");
    // BOOST ボタン: ゲージが空の間は効かず、ストックがあれば部分ゲージでも超加速
    await press(boostButton, 60);
    assert.equal(await page.evaluate(() => window.__desertRide.game.stats.boosts), 0, "an empty gauge does not boost");
    await page.evaluate(async () => { const { chargeBoost } = await import("./js/minigames/desert-ride-model.js"); chargeBoost(window.__desertRide.game, 0.4); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]').dataset.gauge === "full");
    await press(boostButton, 60);
    assert.equal(await page.evaluate(() => window.__desertRide.game.stats.boosts), 1, "the BOOST button spends a partial gauge");
    assert.equal(await page.evaluate(() => window.__desertRide.game.gauge), 0, "the BOOST button consumes the stocked gauge");
    assert(await page.evaluate(() => window.__desertRide.game.boostT > 0), "the partial gauge gives boost time");
    await page.waitForTimeout(200);
    assert.deepEqual(await page.evaluate(() => window.__rateWrites.filter(value => value !== 1)), [], "touch boost keeps the music at its normal tempo");
    // 練習は説明つきで（回転・ブーストまで）、終わると本番へ進むカード
    await page.evaluate(() => {
      window.__captions = [];
      new MutationObserver(() => { const text = document.querySelector('[data-test="desert-caption"]').textContent; if (text && !window.__captions.includes(text)) window.__captions.push(text); })
        .observe(document.querySelector('[data-test="desert-caption"]'), { childList: true, characterData: true, subtree: true });
      window.__desertRide.autoplay("expert"); window.__desertRide.setSpeedUp(4);
    });
    await phase(page, "practiced");
    const captions = await page.evaluate(() => window.__captions);
    assert(captions.some(text => /空中で「左へ」か「右へ」を押し続けて回ろう/.test(text)), `the lesson teaches the spin (${captions.join(" / ")})`);
    assert(captions.some(text => /溜まったゲージで「BOOST」を押すと超加速/.test(text)), `the lesson explains stocked boost (${captions.join(" / ")})`);
    assert.match(await page.locator(t("desert-practiced")).innerText(), /練習おわり/);
    await page.locator(t("desert-start")).tap();
    await phase(page, "run");
    await autoplayToResult(page, "none");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "C", "dodging without any jump is a C");
    assert.match(await resultText(page), /大ジャンプ 0 回/);
    await page.locator(t("desert-leave")).tap();
    await page.locator(t("desert-page-best")).waitFor();
  }, { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });

  // 2026-11-11: カーブの案内とカービング、ブースト中の曲の速さ、裏の相手（なる）の名乗り
  // 2026-11-11 オーナー「ジャンプ中にタイミングよく押すと着地が決まる仕様が気づきづらい」「ブーストは溜まるとどんどん放電みたいな演出」
  await check("landing-cue-on-the-jump-button-and-boost-discharge-grows-with-the-gauge", async page => {
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await ride(page, () => { const r = window.__desertRide; r.skipCountdown(); r.pause(true); });
    const cue = () => page.evaluate(() => {
      const r = window.__desertRide; r.redraw();
      const button = document.querySelector('[data-test="desert-jump"]'), tag = button.querySelector(".dr-land-tag"), ring = button.querySelector(".dr-land-ring");
      return { state: button.dataset.land, ring: Number(button.style.getPropertyValue("--land")), tag: tag.textContent, shown: getComputedStyle(tag).opacity === "1" && getComputedStyle(ring).opacity === "1", air: r.game.air };
    });
    // 平地のホップは着地の採点が無いので、合図を出さない
    await ride(page, () => { const r = window.__desertRide; r.advance(1, {}); r.press(); r.advance(0.05, {}); });
    let c = await cue();
    assert(c.air > 0 && c.state === "" && !c.shown, "a hop shows no landing cue");
    // 大ジャンプ: 輪が外から縮み「重なったら押す」→ 完璧の窓で輪がボタンに重なり「今！」→ 押すと「構えた！」
    await ride(page, async () => {
      const r = window.__desertRide;
      const { nextBumpDistance } = await import("./js/minigames/desert-ride-model.js");
      while (r.game.air > 0) r.advance(1 / 60, {});
      while (nextBumpDistance(r.game) > r.game.speed * 0.1) r.advance(1 / 60, {});
      r.press(); r.advance(0.1, {});
    });
    c = await cue();
    assert.equal(c.state, "wait"); assert.equal(c.tag, "重なったら押す"); assert(c.shown, "the ring and the tag show in the air");
    assert(c.ring > 0.5 && c.ring <= 1, `the ring starts wide (${c.ring})`);
    await ride(page, () => { const r = window.__desertRide; while (r.game.air > 0.45) r.advance(1 / 60, {}); });
    const soon = await cue();
    assert.equal(soon.state, "soon"); assert(soon.ring < c.ring, "the ring closes in");
    await ride(page, () => { const r = window.__desertRide; while (r.game.air > 0.25) r.advance(1 / 60, {}); });
    c = await cue();
    assert.equal(c.state, "now"); assert.equal(c.tag, "今！"); assert.equal(c.ring, 0, "the ring sits on the button in the perfect window");
    await ride(page, () => window.__desertRide.press());
    c = await cue();
    assert.equal(c.state, "set"); assert.equal(c.tag, "構えた！");
    await ride(page, () => { const r = window.__desertRide; while (r.game.air > 0) r.advance(1 / 60, {}); });
    c = await cue();
    assert(c.state === "" && !c.shown, "the cue leaves on landing");
    assert(await ride(page, () => window.__desertRide.game.stats.perfect >= 1), "pressing on the cue lands perfectly");
    // 放電: 溜まるほど BOOST ボタンとゲージの稲妻が増え、満タンで最大。ブースト中は止まる
    const zaps = level => page.evaluate(async level => {
      const r = window.__desertRide; r.game.gauge = level;
      await new Promise(resolve => setTimeout(resolve, 90)); r.redraw();
      const lit = selector => [...document.querySelectorAll(`${selector} path.core`)].filter(path => path.getAttribute("d")).length;
      return { charge: document.querySelector('[data-test="desert-ride"]').dataset.charge, button: lit(".dr-zap-button"), gauge: lit(".dr-zap-gauge") };
    }, level);
    assert.deepEqual(await zaps(0), { charge: "", button: 0, gauge: 0 }, "no discharge with an empty gauge");
    let most = { button: 0, gauge: 0 };
    for (let i = 0; i < 4; i++) { const z = await zaps(0.3); assert.equal(z.charge, "low"); most = { button: Math.max(most.button, z.button), gauge: Math.max(most.gauge, z.gauge) }; }
    assert(most.button <= 3 && most.gauge <= 3, `a little charge, a little discharge (${JSON.stringify(most)})`);
    const full = await zaps(1);
    assert.equal(full.charge, "max");
    assert(full.button >= 5 && full.gauge >= 5, `a full gauge discharges hard (${JSON.stringify(full)})`);
    assert(full.button > most.button, "more bolts as the gauge fills");
    await ride(page, () => { const r = window.__desertRide; r.game.fallT = 0; r.boost(); });
    await page.waitForTimeout(90);
    const during = await page.evaluate(() => { window.__desertRide.redraw(); return { charge: document.querySelector('[data-test="desert-ride"]').dataset.charge, lit: [...document.querySelectorAll(".dr-zap path.core")].filter(path => path.getAttribute("d")).length }; });
    assert.deepEqual(during, { charge: "", lit: 0 }, "the charge is spent by the boost");
    // 光は絵の形に沿う drop-shadow だけ。箱の形の光（box-shadow）は付けない（同日「うっすら水色の四角が見える」）
    await page.waitForFunction(() => document.querySelector('[data-test="desert-boost"]').classList.contains("art-ready"));
    assert.equal(await page.locator(t("desert-boost")).evaluate(node => getComputedStyle(node).boxShadow), "none", "no square glow while boosting");
    // 効果音（2026-11-11 オーナー「ビリビリなる効果音」→「わかりやすい雷みたいなビリビリ」「ブースト時も効果音、早そうな」）:
    // 溜まっている間は「ビリッ」が1発ずつ鳴り、鳴った瞬間にボタンとゲージが光る。ブースト中は鳴らず、風切りに替わる。
    // 音を出せない環境でも、鳴らすつもりの音（「ビリッ」の数・ループの音量）で確かめる
    await page.evaluate(() => {
      window.__bursts = 0;
      const root = document.querySelector('[data-test="desert-ride"]');
      new MutationObserver(() => { if (root.dataset.zap === "burst") window.__bursts += 1; }).observe(root, { attributes: true, attributeFilter: ["data-zap"] });
    });
    const zapsBefore = await page.evaluate(() => window.__desertRide.soundLevels().zaps);
    await ride(page, () => { const r = window.__desertRide; r.game.boostT = 0; r.game.fallT = 0; r.game.gauge = 1; r.pause(false); });
    await page.waitForFunction(before => window.__desertRide.soundLevels().zaps >= before + 3 && window.__bursts >= 2, zapsBefore, { timeout: 5000 });
    assert.equal(await page.evaluate(() => window.__desertRide.soundLevels().boostLoop), 0, "no wind rush before the boost");
    await ride(page, () => { const r = window.__desertRide; r.game.fallT = 0; r.boost(); });
    await page.waitForFunction(() => window.__desertRide.soundLevels().boostLoop > 0);
    const zapsDuring = await page.evaluate(() => window.__desertRide.soundLevels().zaps);
    await page.waitForTimeout(700);
    assert.equal(await page.evaluate(() => window.__desertRide.soundLevels().zaps), zapsDuring, "the zaps stop while boosting");
  });

  await check("curve-tip-carving-boost-tempo-and-the-hidden-boss-banner", async page => {
    await page.evaluate(() => localStorage.setItem("suien_desert_ride_preview", JSON.stringify({ score: 1, rank: "C", rulesVersion: 2, beatNoor: true })));
    await page.goto(new URL("desert-ride.html?course=left-bowl", page.url()).href);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-menu")).waitFor();
    await page.locator(t("desert-help")).click();
    assert.match(await page.locator(t("desert-help-panel")).innerText(), /カーブでは外へ流される。曲がる向きへ切り込むと踏ん張れて、ブーストも貯まる/);
    await page.locator(t("desert-help-close")).click();
    // 裏の相手: スタートの合図の間だけ、人物と数字に重ならない画面の下に名乗りが出る
    await page.locator(t("desert-start-naru")).click();
    await phase(page, "run");
    assert.equal((await page.locator(t("desert-versus")).innerText()).replace(/\s+/g, " "), "裏ボス VS なる");
    await page.waitForFunction(() => {
      const node = document.querySelector('[data-test="desert-versus"]');
      return window.__desertRide.countdown > 0 && node.classList.contains("show") && Number(getComputedStyle(node).opacity) > 0;
    });
    const banner = await page.evaluate(() => {
      const node = document.querySelector('[data-test="desert-versus"]'), root = document.querySelector('[data-test="desert-ride"]').getBoundingClientRect(), box = node.getBoundingClientRect();
      return { shown: node.classList.contains("show") && getComputedStyle(node).opacity !== "0", top: (box.top - root.top) / root.height, counting: window.__desertRide.countdown > 0 };
    });
    assert(banner.counting && banner.shown, "the boss banner shows during the countdown");
    assert(banner.top > 0.7, `the banner sits below the riders (${banner.top})`);
    await page.waitForFunction(() => window.__desertRide.countdown <= 0);
    assert.equal(await page.locator(t("desert-versus")).evaluate(node => node.classList.contains("show")), false, "the banner leaves at GO");
    assert(await ride(page, () => window.__desertRide.rival.samples.some(s => s.boostT > 0) && window.__desertRide.rival.samples.some(s => Math.abs(s.rot) > 0.25)), "Naru's boosts and spins are in the playback");
    // なるの滑る絵（#3222）を読みに行っている（読めない時は図形で描く）
    assert(await page.evaluate(() => performance.getEntriesByType("resource").some(entry => /\/rider_naru_ride\.webp$/.test(entry.name))), "Naru's rider art is requested");
    // 最初のカーブ: 一度だけ案内が出る。曲がる向きへ切り込むとカービング（ゲージが貯まり、印が出る）
    assert.equal(await page.locator(t("desert-caption")).innerText(), "", "no caption on the straight");
    await ride(page, () => { const r = window.__desertRide; while (r.game.z < 340) r.advance(1 / 60, {}); r.game.x = 0; r.game.vx = 0; });
    await page.waitForFunction(() => /カーブ！/.test(document.querySelector('[data-test="desert-caption"]').textContent));
    assert.equal(await page.locator(t("desert-caption")).getAttribute("data-kind"), "tip");
    const tip = await page.evaluate(() => {
      const rect = selector => document.querySelector(selector).getBoundingClientRect();
      return { tip: rect('[data-test="desert-caption"]'), course: rect('[data-test="desert-course"]'), left: rect(".dr-hud-left"), right: rect(".dr-hud-right") };
    });
    assert(tip.tip.top >= tip.course.bottom && tip.tip.left >= tip.left.right && tip.tip.right <= tip.right.left, "the tip clears the course name and both HUD panels");
    await ride(page, () => window.__desertRide.setInput(true, false)); // 左カーブへ左へ切り込む
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]').dataset.carve === "on");
    await page.waitForFunction(() => { const g = window.__desertRide.game; if (Math.abs(g.x) > 0.6) { g.x = 0; g.vx = 0; } return g.stats.carves >= 1; });
    const carved = await ride(page, () => { const g = window.__desertRide.game; window.__desertRide.setInput(false, false); return { gauge: g.gauge, event: g.events.some(e => e.kind === "carve" && e.points > 0), falls: g.falls }; });
    assert(carved.event && carved.gauge > 0.05, `carving charges the gauge (${carved.gauge})`);
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]').dataset.carve === "");
    // ブースト中・終了後・メニューへ戻った後も曲は通常の速さ
    const audioUrl = new URL("js/core/audio.js", page.url()).href;
    await page.evaluate(async url => { window.__audio = await import(url); }, audioUrl);
    assert.equal(await page.evaluate(() => window.__audio.bgmPlaybackRate()), 1, "normal tempo outside a boost");
    await ride(page, () => { const r = window.__desertRide; r.game.x = 0; r.game.vx = 0; r.game.fallT = 0; r.game.gauge = 1; r.boost(); });
    await page.waitForFunction(() => document.querySelector('[data-test="desert-ride"]').dataset.boost === "on");
    assert.equal(await page.evaluate(() => window.__audio.bgmPlaybackRate()), 1, "boost keeps the music at its normal tempo");
    await ride(page, () => { window.__desertRide.game.boostT = 0.02; });
    await page.waitForFunction(() => window.__desertRide.game.boostT === 0);
    assert.equal(await page.evaluate(() => window.__audio.bgmPlaybackRate()), 1, "boost end keeps normal tempo");
    await ride(page, () => { const r = window.__desertRide; r.game.fallT = 0; r.game.gauge = 1; r.boost(); });
    await page.waitForFunction(() => window.__desertRide.game.boostT > 0);
    assert.equal(await page.evaluate(() => window.__audio.bgmPlaybackRate()), 1, "a second boost also keeps normal tempo");
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    assert.equal(await page.evaluate(() => window.__audio.bgmPlaybackRate()), 1, "quitting mid-boost restores the tempo");
    // 次の滑走では、一度切り込めたので案内は出ない
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    assert.equal(await page.locator(t("desert-versus")).evaluate(node => node.classList.contains("show")), false, "no boss banner against Noor");
    await ride(page, () => window.__desertRide.skipCountdown());
    await ride(page, () => { const r = window.__desertRide; while (r.game.z < 420) r.advance(1 / 60, {}); r.game.x = 0; r.game.vx = 0; });
    await page.waitForFunction(() => window.__desertRide.game.z > 470);
    assert.equal(await page.locator(t("desert-caption")).innerText(), "", "the curve tip is shown once");
    await page.keyboard.press("Escape");
    await phase(page, "menu");
    await page.locator(t("desert-leave")).click();
    await page.locator(t("desert-page-start")).waitFor();
  });
  await check("chapter-four-desk-talks-outing-record-sunset-day-use-save-load-and-interrupt", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 4, day: 46, slot: 0, phase: "daily", money: 50000, stamina: 100, lovers: [], contacts: ["sumi"] });
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _overseas_companion: { decided: true, companion: null, supports: [] }, _ch4_sheikh_revealed: false, _ch4_strategy: "sakura",
        _ch4: { startDay: 46, day: 1, stage: 4, part: "free", titleSeen: true, resolution: 0, attempts: 0, firstDay: null,
          read: { ch4_sumi_training: true, ch4_strategy: true, ch4_opening: true, ch4_arrival_inn: true } } };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    await arm();
    const before = await get(page);
    const freeDay = day => page.locator(t("ch4-free")).getByRole("heading", { name: new RegExp(`^DAY ${day}・`) }).waitFor();
    const talksDone = n => page.waitForFunction(n => window.__remake.state.flags._ch4_desert?.talks === n, n);
    // DAY1: デスクをのぞく → 名乗り → 登場カットイン。同じ日は二度話せない。
    assert.match(await page.locator(t("ch4-go-tour_desk")).innerText(), /カフェ/);
    assert.equal(await page.locator(t("ch4-go-dunes")).count(), 0, "the dunes wait for the invitation");
    await page.locator(t("ch4-go-tour_desk")).click();
    await talksDone(1);
    await freeDay(1);
    let value = await get(page);
    // 立ち絵があるので、登場カットインは会話エンジンが名乗りの直後に出す（このテストは早送りなので既読の印だけが付く）
    assert.equal(value.met.noor, true); assert.equal(value.flags._intro_noor, true, "the guide's intro cut-in is marked as seen");
    assert(await page.locator(t("ch4-go-tour_desk")).isDisabled(), "one talk per day");
    assert.equal(value.flags._ch4.day, 1, "talking does not advance the day");
    // DAY2・DAY3: 続きの会話 → 誘い → 砂丘が地図に出る
    await page.locator(t("ch4-go-inn")).click(); await freeDay(2);
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(2); await freeDay(2);
    await page.locator(t("ch4-go-inn")).click(); await freeDay(3);
    // 旧カードの地図（5日）は以前と同じ3回目で誘う（店の3つ目は飛ばして、段階は全部読んだ扱い）
    await page.locator(t("ch4-go-tour_desk")).click(); await talksDone(4);
    await page.locator(".toast", { hasText: "ヌールと砂丘へ" }).waitFor();
    await freeDay(3);
    value = await get(page);
    assert(value.affinity.noor > 0, "talking at the café raises Noor's affinity");
    assert.equal(await page.locator(t("ch4-go-tour_desk")).count(), 0, "the desk gives way to the dunes");
    assert.match(await page.locator(t("ch4-go-dunes")).innerText(), /ヌールと砂丘へ/);
    assert.match(await page.locator(t("ch4-free")).innerText(), /昼の行動を1つ使う/);
    // 砂丘へ: 到着の場面 → 外出を確定 → 練習 → 本番 → 記録
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "practice");
    assert.match(await page.locator("#bg .bg-img").last().evaluate(node => node.style.backgroundImage), /bg_dubai_dunes_day/, "the arrival scene uses the adopted dunes background");
    value = await get(page);
    assert.equal(value.slot, 1, "the trip spends the daytime action (shared with the camel race)");
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 1, lastOutingDay: 3 }, "the outing is spent when the trip starts");
    assert.equal(value.money, before.money, "the first trip is free");
    assert.equal(value.desert, undefined);
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
    assert.match(await page.locator(t("desert-practiced")).innerText(), /ヌール「もう一度練習してもいいし、本番へ進んでもいいよ」/);
    await page.locator(t("desert-start")).click();
    // 1本目は着地が遅い滑り: B。ヌールと同じ滑りなので競走は負け
    await autoplayToResult(page, "good");
    await page.locator(".toast", { hasText: "ヌール「" }).waitFor();
    await page.locator(".toast", { hasText: "初めての完走" }).waitFor();
    value = await get(page);
    assert.equal(value.desert.runs, 1); assert.equal(value.desert.best.rank, "B"); assert.equal(value.desert.bestRank, "B");
    assert.equal(value.desert.wins, 0); assert.equal(value.desert.best.race.won, false);
    assert.deepEqual(value.desert.firstClear, { chapter: 4, day: 48 }); assert.equal(value.desert.rewarded, true);
    assert.deepEqual(value.stats, before.stats, "no direct stat gain"); assert.equal(value.money, before.money);
    assert.equal(JSON.parse(await page.evaluate(() => localStorage.getItem("suien_remake_save"))).desert.bestRank, "B", "recorded to the autosave");
    // 同じ外出の中の再挑戦: 行動は増えず、記録だけ増える。自己ベストは点数で更新。回ってブーストすればヌールに勝つ（勝ちのひとこと）
    await page.locator(t("desert-retry")).click();
    await autoplayToResult(page, "expert");
    await page.locator(".toast", { hasText: "ヌール「悔しいけど、今日は私の負け。次は負けないからね」" }).waitFor();
    value = await get(page);
    assert.equal(value.desert.runs, 2); assert.equal(value.desert.bestRank, "S"); assert.equal(value.flags._ch4_desert.outings, 1);
    assert.equal(value.desert.wins, 1);
    assert.match(await resultText(page), /自己ベスト更新/);
    // 初めて勝った日は、夕日の前に旗の下で短く話す
    await page.evaluate(async () => {
      const { hooks } = await import("./js/vn/engine.js");
      window.__played = [];
      const previous = hooks.onEnter;
      hooks.onEnter = (id, dlg) => { window.__played.push(id); return previous?.(id, dlg); };
    });
    // 砂丘を下りる → （初勝利の会話）→ 夕日の場面（大会前の分岐）→ 地図。今日はもう行けない。
    await page.locator(t("desert-leave")).click();
    await freeDay(3);
    const played = await page.evaluate(() => window.__played);
    assert(played.indexOf("ch4_desert_race_first_win") >= 0 && played.indexOf("ch4_desert_race_first_win") < played.indexOf("ch4_desert_sunset_first"),
      `the first win talk comes before the sunset (${played.join(", ")})`);
    assert(await page.locator(t("ch4-go-dunes")).isDisabled(), "no second trip on the same day");
    assert.match(await page.locator(t("ch4-free")).innerText(), /今日はもう砂丘へ行った/);
    value = await get(page);
    assert.equal(value.flags._ch4.day, 3); assert.equal(value.day, 48, "the trip itself does not advance the calendar");
    // SAVE → LOAD: 記録と行動の消費が残る
    await page.locator(t("ch4-menu")).click(); await page.locator(t("ch4-save")).click(); await page.locator(t("slot-1")).click();
    await page.reload();
    await page.locator(t("title-load")).click();
    await arm();
    await page.locator(t("slot-1")).click();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.desert.bestRank, "S"); assert.equal(value.desert.runs, 2);
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 1, lastOutingDay: 3 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled());
    // 翌日はまた行ける。2回目の外出は短い到着 → 練習なしで本番。途中で中断（再読込）しても外出の消費だけ残り、記録は増えない。
    await page.locator(t("ch4-go-inn")).click(); await freeDay(4);
    assert(!(await page.locator(t("ch4-go-dunes")).isDisabled()));
    assert.match(await page.locator(t("ch4-free")).innerText(), /自己ベスト/);
    assert.match(await page.locator(t("ch4-free")).innerText(), /6,000円/, "the second trip shows the tour fee");
    const moneyBefore = (await get(page)).money;
    await page.locator(t("ch4-go-dunes")).click();
    await phase(page, "menu");
    // ヌールに勝った後の外出: なるが砂丘に来て、勝負の相手に加わる（来た場面は一度だけ）
    assert.equal(await page.locator(t("desert-start-naru")).count(), 1, "after beating Noor, Naru waits at the dunes");
    value = await get(page);
    assert.equal(value.desert.naruMet, true);
    await page.locator(t("desert-start")).click();
    await phase(page, "run");
    await page.waitForFunction(() => window.__desertRide.game.z > 40);
    value = await get(page);
    assert.equal(value.flags._ch4_desert.outings, 2);
    assert.equal(value.money, moneyBefore - 6000, "from the second trip, the tour fee is paid when the trip starts");
    await page.evaluate(async () => { (await import("./js/core/state.js")).requestResumeOnBoot(); });
    await page.reload();
    await page.locator(t("ch4-free")).waitFor({ timeout: 60000 });
    value = await get(page);
    assert.equal(value.desert.runs, 2, "an interrupted run leaves no record");
    assert.deepEqual(value.flags._ch4_desert, { v: 2, talks: 4, chats: 0, lastTalkDay: 3, outings: 2, lastOutingDay: 4 });
    assert(await page.locator(t("ch4-go-dunes")).isDisabled(), "the interrupted trip still used the day");
    assert.equal(await page.locator(t("desert-ride")).count(), 0);
  });

  // 14日のドバイ（版2・日常ループ）でも同じ寄り道: 地図のデスク→誘い→砂丘（昼の行動を使う・体力と能力は変えない）→夜の地図。
  await check("chapter-four-daily-route-desk-and-dunes-on-the-dubai-map", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri", "noor"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, noor: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("Departure failed");
      value.flags._ch4_desert = { v: 2, talks: 3, chats: 0, lastTalkDay: null, outings: 0, lastOutingDay: null }; // カフェで3つ話した後
      value.affinity = { ...(value.affinity || {}), noor: 33 }; // ♥3
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); Object.assign(core.state, value); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await arm();
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) {
      await page.locator(`[data-test="ch4-scene"][data-scene="${id}"]`).waitFor({ timeout: 60000 });
      await page.locator(t("ch4-continue")).click();
    }
    const dubaiMap = slot => page.waitForFunction(slot => window.__remake.state.slot === slot
      && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show"), slot, { timeout: 60000 });
    // 新しく現れた行き先は地図の登場演出の間は選べないので、ここへ行くボタンが出るまで選び直す
    const go = async pin => {
      for (let i = 0; i < 40 && !(await page.locator(t("map-go")).isVisible().catch(() => false)); i++) {
        await page.locator(t(`pin-${pin}`)).click();
        await page.waitForTimeout(250);
      }
      await page.locator(t("map-go")).click();
    };
    await dubaiMap(0);
    let value = await get(page);
    assert.equal(value.flags._ch4.routeVersion, 2);
    assert.equal(await page.locator(t("pin-ch4_dubai_tour_desk")).count(), 1, "the café is on the Dubai map");
    assert.equal(await page.locator(t("pin-ch4_dubai_dunes")).count(), 0, "the dunes appear after the invitation");
    // ♥3 でカフェに寄ると誘い。一台頼む来店なので 3,000円と行動を1つ使い、好感度も上がる。カフェは地図に残り、砂丘が加わる
    const cafeBefore = await get(page);
    await go("ch4_dubai_tour_desk");
    await page.waitForFunction(() => window.__remake.state.flags._ch4_desert.talks === 4);
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.money, cafeBefore.money - 3000, "a shisha at the café costs 3,000円");
    assert(value.affinity.noor > cafeBefore.affinity.noor, "talking at the café raises Noor's affinity");
    assert(value.flags._noor_story_seat_edge && value.flags._noor_story_second_cup && value.flags._noor_story_map_corner,
      "three unread Noor café stories are read and saved after the staged talk");
    assert.equal(value.flags._noor_story_water_glass, undefined, "the remaining stories wait for another visit");
    await page.locator(t("pin-ch4_dubai_dunes")).waitFor();
    assert.equal(await page.locator(t("pin-ch4_dubai_tour_desk")).count(), 1, "the café stays on the map");
    // 砂丘は昼だけ。宿で夜を越して翌日の昼に出かける
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const before = await get(page);
    await go("ch4_dubai_dunes");
    await phase(page, "practice");
    value = await get(page);
    assert.equal(value.slot, 1, "the trip spends the daytime action once");
    assert.equal(value.flags._ch4_desert.outings, 1);
    await page.evaluate(() => { window.__desertRide.autoplay("perfect"); window.__desertRide.setSpeedUp(8); });
    await phase(page, "practiced");
    await page.locator(t("desert-start")).click();
    await autoplayToResult(page, "perfect");
    await page.evaluate(() => {
      window.__bgs = [];
      new MutationObserver(() => { for (const node of document.querySelectorAll("#bg .bg-img")) if (!window.__bgs.includes(node.style.backgroundImage)) window.__bgs.push(node.style.backgroundImage); })
        .observe(document.getElementById("bg"), { childList: true, subtree: true, attributes: true });
    });
    await page.locator(t("desert-leave")).click();
    // 夕日の会話のあと、夜の地図へ（日常ループが追加で行動を進めない）
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.day, before.day); assert.equal(value.slot, 1);
    assert.equal(value.desert.bestRank, "A", "clean landings without spins are an A"); assert.equal(value.desert.rewarded, true);
    assert.equal(value.desert.wins, 1, "clean landings and the boost beat Noor");
    assert.equal(value.stamina, before.stamina, "the trip uses no stamina");
    assert.deepEqual(value.stats, before.stats, "no direct stat gain");
    assert.match(await page.locator(t("pin-ch4_dubai_dunes")).getAttribute("class"), /\boff\b/, "no second trip tonight (the pin stays, disabled)");
    assert(await page.locator(".hud").isVisible(), "the daily HUD comes back");
    assert((await page.evaluate(() => window.__bgs)).some(url => /bg_dubai_dunes_dusk/.test(url)), "the sunset talk uses the adopted dusk background");
  });
  await check("legacy-preview-best-is-separate-from-the-new-landing-rules", async page => {
    await page.evaluate(() => localStorage.setItem("suien_desert_ride_preview", JSON.stringify({ score: 99999, rank: "S", beatNoor: true })));
    await page.goto(new URL("desert-ride.html?course=ridge", page.url()).href);
    assert.match(await page.locator(t("desert-page-legacy-best")).innerText(), /旧ルール.*99,999/);
    assert.equal(await page.locator(t("desert-page-best")).count(), 0);
    await page.locator(t("desert-page-start")).click();
    await page.locator(t("desert-menu")).waitFor();
    assert.match(await page.locator(t("desert-legacy-best")).innerText(), /99,999/);
    assert.equal(await page.locator(t("desert-best")).count(), 0, "the old score is not the target for the new rules");
    await page.locator(t("desert-start")).click();
    await autoplayToResult(page, "perfect");
    assert.equal(await page.locator(t("desert-result")).getAttribute("data-rank"), "A");
    assert.match(await page.locator(t("desert-best")).innerText(), /自己ベスト更新/);
    await page.locator(t("desert-leave")).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("suien_desert_ride_preview")));
    assert.equal(saved.rulesVersion, 2); assert(saved.score < 99999);
    assert.deepEqual(saved.legacyBest, { score: 99999, rank: "S" });
    assert.equal(saved.beatNoor, true);
    await page.reload();
    assert.match(await page.locator(t("desert-page-legacy-best")).innerText(), /99,999/);
    assert.match(await page.locator(t("desert-page-best")).innerText(), /自己ベスト.*A/);
  });

  await check("legacy-main-records-survive-real-auto-and-slot-save-load", async page => {
    const got = await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-desert-progress.js");
      const value = core.newGame();
      const old = { finished: true, score: 30000, rank: "S", time: 48, maxCombo: 20, falls: 0 };
      value.desert = { runs: 7, best: old, bestRank: "S", rewarded: true, wins: 2, naruMet: true, naruWins: 1, firstClear: { chapter: 4, day: 46 } };
      const saved = progress.recordDesertResult(value, { ...old, score: 3500, rank: "B", rulesVersion: 2 });
      core.save();
      const auto = structuredClone(core.load().desert);
      const slotSaved = core.saveToSlot("suien_remake_slot1");
      core.state.desert = null;
      const loaded = core.loadFromSlot("suien_remake_slot1");
      return { newBest: saved.newBest, auto, slotSaved, slot: structuredClone(loaded?.desert), unlocked: progress.desertRivals(loaded) };
    });
    assert.equal(got.newBest, true); assert.equal(got.slotSaved, true);
    assert.equal(got.auto.best.score, 3500); assert.equal(got.auto.best.rulesVersion, 2);
    assert.equal(got.auto.legacyBest.score, 30000); assert.equal(got.auto.bestRank, "S");
    assert.equal(got.auto.runs, 8); assert.equal(got.auto.rewarded, true);
    assert.equal(got.auto.wins, 2); assert.equal(got.auto.naruWins, 1); assert.equal(got.auto.naruMet, true);
    assert.deepEqual(got.slot, got.auto);
    assert.deepEqual(got.unlocked, ["noor", "naru"]);
  });

  // DSR20: 段階の会話と♥3の問いを読んだ♥5の来店で、締めくくり（専用ハガル・最後の問い）。恋愛を選ぶと次の砂丘はツアー代なしで、
  // 滑ったあと夕日の砂丘でヌールから告白され、付き合う。
  await check("chapter-four-daily-noor-finale-then-sunset-confession", async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async () => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "nagumo", "dr_kemuri", "noor"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, noor: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("Departure failed");
      // カフェの段階を全部読み、♥3の問いに恋愛寄りで答え、砂丘へも一度行った♥5
      value.flags._ch4_desert = { v: 2, talks: 6, chats: 0, lastTalkDay: null, outings: 1, lastOutingDay: null };
      value.flags._noor_affinity_question_done = true;
      value.romanceChoices = { bond_q1_noor: { char: "noor", value: 1, day: value.day } };
      value.affinity = { ...(value.affinity || {}), noor: 66 };
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); Object.assign(core.state, value); core.save(); core.requestResumeOnBoot();
    });
    const arm = () => page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.reload();
    await arm();
    for (const id of ["ch4_opening", "ch4_arrival_inn"]) {
      await page.locator(`[data-test="ch4-scene"][data-scene="${id}"]`).waitFor({ timeout: 60000 });
      await page.locator(t("ch4-continue")).click();
    }
    const dubaiMap = slot => page.waitForFunction(slot => window.__remake.state.slot === slot
      && document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show"), slot, { timeout: 60000 });
    const go = async pin => {
      for (let i = 0; i < 40 && !(await page.locator(t("map-go")).isVisible().catch(() => false)); i++) {
        await page.locator(t(`pin-${pin}`)).click();
        await page.waitForTimeout(250);
      }
      await page.locator(t("map-go")).click();
    };
    await dubaiMap(0);
    // ♥5の来店: 締めくくり。最後の問いで「二人で」（choose=0）→ 専用ハガル、恋愛ルート。一台の代金と行動を1つ使う
    const cafeBefore = await get(page);
    await go("ch4_dubai_tour_desk");
    await page.waitForFunction(() => window.__remake.state.finales?.noor);
    await page.locator(".toast", { hasText: "次の砂丘で、ヌールが待っている" }).waitFor();
    await dubaiMap(1);
    let value = await get(page);
    assert.equal(value.finales.noor.route, "romance");
    assert.equal(value.romanceChoices.bond_q2_noor.value, 1);
    assert(value.owned.includes("suyaki_noor"), "Noor's double apple hagal");
    assert.equal(value.money, cafeBefore.money - 3000);
    assert.equal(value.flags._confession_due, undefined, "no night-walk reservation");
    // 翌日の昼、約束の砂丘（ツアー代なし）。滑らずに下りても、夕日の場面で告白され、付き合う（choose=0）
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const before = await get(page);
    await page.evaluate(() => {
      window.__bgs = [];
      new MutationObserver(() => { for (const node of document.querySelectorAll("#bg .bg-img")) if (!window.__bgs.includes(node.style.backgroundImage)) window.__bgs.push(node.style.backgroundImage); })
        .observe(document.getElementById("bg"), { childList: true, subtree: true, attributes: true });
    });
    await go("ch4_dubai_dunes");
    await phase(page, "menu");
    assert.equal(await page.locator(t("desert-start-naru")).count(), 0, "a day for the two of them");
    await page.locator(t("desert-leave")).click();
    await page.waitForFunction(() => (window.__remake.state.lovers || []).includes("noor"));
    await dubaiMap(1);
    value = await get(page);
    assert.equal(value.money, before.money, "Noor's invitation: no tour fee");
    assert.deepEqual(value.lovers, ["noor"]);
    assert.equal(value.loveLevel.noor, 1);
    assert(value.loverEventsSeen.includes("lover_noor_lv1"), "the first dunes milestone follows the accepted confession");
    assert(value.flags._lime_contact_noor && value.contacts.includes("noor"), "they exchange LIME when they start dating");
    assert.equal(value.flags._noor_confession_other_lover, undefined, "the temporary flag is cleared");
    assert((await page.evaluate(() => window.__bgs)).some(url => /bg_dubai_dunes_dusk/.test(url)), "the confession is on the sunset dunes");
    // 告白は一度だけ。次の砂丘は相場のツアー代
    await go("ch4_dubai_inn");
    await dubaiMap(0);
    const price = await page.evaluate(async () => {
      const desert = await import("./js/chapters/ch4-desert-progress.js");
      return desert.desertOutingStatus(window.__remake.state, 99).price;
    });
    assert.equal(price, 6000);
  });

  // ドバイの日常の保存を LOAD した直後（カフェ・オアシスにも砂丘にもまだ行っていない地図）から、MENU の人間関係がヌールの♥5の締めくくり・
  // 告白を正しく案内する（締めくくり・告白の台詞は ch4_desert.json にあるので、日常へ戻る時に読んでおく。ch4-dubai-daily.js）。
  for (const [variant, expected] of [
    ["finale", { label: "恋愛ルート", next: "次にカフェ・オアシスで会うと、特別なイベントへ。" }],
    ["confession", { label: "告白を選べる", next: "次の砂丘（ツアー代なし）で、滑ったあとの夕日の時間へ。" }],
  ]) await check(`chapter-four-load-shows-noor-${variant}-menu-hint-before-any-action`, async page => {
    page.setDefaultTimeout(30000);
    await page.evaluate(async variant => {
      const core = await import("./js/core/state.js");
      const progress = await import("./js/chapters/ch4-progress.js");
      const value = core.newGame();
      Object.assign(value, { chapter: 3, day: 45, slot: 1, phase: "cleared", money: 50000, stamina: 100, weatherSeed: 5, lovers: [], contacts: ["sumi"] });
      value.flags = { _elapsed_calendar: true, _ch1_cleared: true, _ch2_cleared: true, _ch3_cleared: true, _ch3_preview_seen: true,
        _friend_ageha: true, _ch3_tournament_won: true, _lime_opened: true, _lime_tut: 1 };
      value.stats = { technique: 60, sense: 60, guts: 60, charm: 60, insight: 60 };
      for (const who of ["naru", "da_silva", "hajime", "sumi", "pakki", "sui", "dr_kemuri", "noor"]) value.flags[`_intro_${who}`] = true;
      Object.assign(value.met, { naru: true, noor: true, da_silva: true });
      if (!progress.advanceToChapterFour(value)) throw new Error("Chapter boundary failed");
      value.flags._overseas_companion = { decided: true, companion: null, supports: [] };
      value.flags._ch4.titleSeen = true;
      for (const id of progress.CH4_PREP_SCENES) if (!progress.completeChapterFourScene(value, id)) throw new Error(id);
      value.day += 3;
      if (!progress.departChapterFour(value)) throw new Error("Departure failed");
      // 到着の場面と最初の出会いまでを済ませたドバイ7日目の昼。カフェの段階を全部読み、♥3の問いに恋愛寄りで答えた♥5
      const p = value.flags._ch4;
      for (const id of ["ch4_opening", "ch4_arrival_inn"]) progress.completeChapterFourScene(value, id);
      for (const id of ["ch4_festa", "ch4_dubai_souq", "ch4_stranger_first", "ch4_stranger_second", "ch4_dubai_cafe", "ch4_inn_tool_care"]) p.read[id] = true;
      p.firstDay = 1; p.secondDay = 3;
      value.day = p.startDay + 6; value.slot = 0; p.day = 7;
      value.flags._ch4_desert = { v: 2, talks: 6, chats: 1, lastTalkDay: 5, outings: 1, lastOutingDay: 4 };
      value.flags._noor_affinity_question_done = true;
      value.romanceChoices = { bond_q1_noor: { char: "noor", value: 1, day: 3 } };
      value.affinity = { ...(value.affinity || {}), noor: 66 };
      if (variant === "confession") { // 締めくくりで「二人で」と答え、約束の砂丘を待っている
        value.romanceChoices.bond_q2_noor = { char: "noor", value: 1, day: 6 };
        value.finales = { noor: { day: 6, chapter: 4, route: "romance" } };
      }
      Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false });
      core.saveConfig(); Object.assign(core.state, value); core.save();
    }, variant);
    const before = await get(page);
    await page.reload();
    await page.locator(t("title-load")).click();
    await page.evaluate(async () => { const vn = await import("./js/vn/engine.js"); vn.vnTest.turbo = true; vn.vnTest.choose = () => 0; });
    await page.locator(t("slot-0")).click();
    await page.waitForFunction(() => document.querySelector('.map:not(.done) [data-test="pin-ch4_dubai_inn"]') && !document.querySelector("#modal.show")
      && !document.querySelector(".map[data-revealing]"), null, { timeout: 60000 });
    await page.evaluate(async () => { void (await import("./js/daily/status.js")).openStatus(); });
    await page.locator('[data-tab="people"]').click();
    const row = await page.evaluate(() => {
      const el = document.querySelector('.pp-row[data-person="noor"]');
      return el && { label: el.querySelector(".pp-relation")?.textContent || "", next: el.querySelector(".pp-next")?.textContent || "" };
    });
    await page.locator('[data-test="status-close"]').click();
    assert.deepEqual(row, expected, "Noor's next step is announced right after LOAD");
    const value = await get(page);
    assert.deepEqual([value.day, value.slot, value.flags._ch4.day, value.finales, value.affinity.noor, value.flags._ch4_desert, value.lovers],
      [before.day, 0, 7, before.finales, 66, before.flags._ch4_desert, []], "nothing was done yet");
  });
});


