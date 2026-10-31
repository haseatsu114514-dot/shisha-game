// 初回の実配合→感想、説明中の時計、敗北回数と今回だけの補助を実UIで確認。
import assert from "node:assert/strict";
import fs from "node:fs";
import { suite, assertFits } from "./support.mjs";
if (process.env.SHOTS) fs.mkdirSync(process.env.SHOTS, { recursive: true });

async function init(page) {
  await page.evaluate(async () => {
    const core = await import("./js/core/state.js"); core.newGame();
    core.config.bgmVolume = core.config.seVolume = 0;
    window.T = { core, session: await import("./js/craft/session.js"),
      heat: await import("./js/craft/heat.js"), holes: await import("./js/craft/holes.js"),
      steam: await import("./js/craft/steam.js"), pull: await import("./js/craft/pull.js"),
      first: await import("./js/chapters/first-brew.js"), chapter: await import("./js/chapters/ch1.js"),
      assist: await import("./js/chapters/retry-assist.js"), vn: await import("./js/vn/engine.js"),
      practice: await import("./js/craft/practice.js") };
    T.chapter.setupHooks(); T.vn.vnTest.turbo = true;
    T.open = async (mode = "tutorial") => {
      window.cs = T.session.newSession(mode);
      T.session.openBench(cs, { steps: T.practice.CRAFT_STEPS });
      await T.session.waitBenchReady(cs);
    };
  });
}
const guide = page => page.locator(".bench-guide summary");
const shot = async (page, name) => { if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/${name}.png` }); };

// 長い支給葉リストはスクロールして操作する。全ボタンの到達性を個別に検査する。
async function assertFirstMixControlsReachable(page) {
  const buttons = page.locator('.mix-list .fr-btn');
  assert.equal(await buttons.count(), 6, '3種類それぞれの増減ボタンがある');
  const list = await page.locator('.mix-list').evaluate(n => ({
    overflow: getComputedStyle(n).overflowY, horizontalFits: n.scrollWidth <= n.clientWidth + 1,
  }));
  assert.equal(list.overflow, 'auto'); assert(list.horizontalFits, '支給葉リストに横方向のはみ出しがない');
  const confirm = page.locator('[data-test="mix-ok"]');
  const assertConfirmReachable = async () => {
    await assertFits(page, '[data-test="mix-ok"]');
    assert(await confirm.isEnabled(), '合計12gの配合を確定できる');
    assert(await confirm.evaluate(n => {
      const b = n.getBoundingClientRect();
      const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      return hit === n || n.contains(hit);
    }), '葉をスクロールしても配合の確定ボタンへ到達できる');
  };
  const amounts = page.locator('.fr-g, .fr-ratio');
  const beforeNavigation = await amounts.allTextContents();
  await assertConfirmReachable();
  for (let i = 0; i < await buttons.count(); i++) {
    const button = buttons.nth(i);
    await button.scrollIntoViewIfNeeded();
    const test = await button.getAttribute('data-test');
    await assertFits(page, '[data-test="' + test + '"]');
    const reachable = await button.evaluate(n => {
      const b = n.getBoundingClientRect(), list = n.closest('.mix-list').getBoundingClientRect();
      const hit = document.elementFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2);
      return { inList: b.left >= list.left - 1 && b.top >= list.top - 1
        && b.right <= list.right + 1 && b.bottom <= list.bottom + 1,
        hit: hit === n || n.contains(hit) };
    });
    assert(reachable.inList && reachable.hit, '支給葉のボタンへ到達できる: ' + test + ' ' + JSON.stringify(reachable));
    await assertConfirmReachable();
  }
  assert.deepEqual(await amounts.allTextContents(), beforeNavigation, 'スクロールで配合を変えない');
}

await suite("first-brew", async check => {
  await check("craft-focused-buttons", async page => {
    await page.evaluate(async () => {
      const { keys } = await import("./js/craft/common.js");
      window.craftKeys = { pull: 0, serve: 0, next: 0, finish: 0 };
      const area = document.createElement("div");
      area.innerHTML = '<div class="pull-btns"><button id="key-pull">吸う</button><button id="key-serve">提供</button></div><div class="hr-row"><button id="key-next">次のリング</button><button id="key-finish">完了</button></div>';
      document.body.append(area);
      for (const [id, action] of [["key-pull", "pull"], ["key-serve", "serve"], ["key-next", "next"], ["key-finish", "finish"]]) {
        document.getElementById(id).addEventListener("click", () => window.craftKeys[action]++);
      }
      window.removeCraftKeys = keys({ Enter: () => window.craftKeys.finish++, " ": () => window.craftKeys.pull++ });
    });
    await page.locator("#key-pull").focus();
    await page.keyboard.press("Enter");
    await page.locator("#key-next").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await page.locator("#key-serve").focus();
    await page.keyboard.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.craftKeys), { pull: 1, serve: 1, next: 2, finish: 0 });
    await page.locator("#key-serve").evaluate(button => button.blur());
    await page.keyboard.press("Enter");
    assert.equal(await page.evaluate(() => window.craftKeys.finish), 1, "Unfocused Enter still uses the game shortcut");
    await page.evaluate(() => window.removeCraftKeys());
  });
  for (const touch of [false, true]) await check(`heat-help-${touch ? "touch" : "pc"}`, async page => {
    await init(page);
    await page.evaluate(async () => { await T.open(); window.running = T.heat.runHeat(cs); });
    await page.locator('[data-test="coal-0"]').waitFor();
    await page.waitForTimeout(3500); // 実際の開始カウントを終えてから説明を読む。
    await guide(page).click(); await page.waitForTimeout(100);
    const before = await page.locator('[data-test="coal-0"]').getAttribute("data-phase");
    await page.waitForTimeout(16000); // 修正前はこの間に3個とも焼きすぎで自動終了した。
    assert.equal(await page.evaluate(() => cs.heat), null);
    assert.equal(await page.locator('[data-test="coal-0"]').getAttribute("data-phase"), before);
    assert.equal(await page.locator(".bench-panel").evaluate(n => n.inert), true);
    await shot(page, `help-paused-${touch ? "touch" : "pc"}`);
    await guide(page).click();
    await page.waitForFunction(() => window.cs.heat !== null, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => cs.heat.over), 3);
    await page.locator('[data-test="step-next"]').waitFor();
    assert.match((await page.locator('[data-test="craft-feedback"]').innerText()).replace(/\n/g, ""), /全面が赤くなったら、待たずに取り出そう/);
    assert.doesNotMatch(await page.locator('[data-test="craft-feedback"]').innerText(), /焦らず待つ/);
    if (!touch) {
      await page.locator('[data-test="step-next"]').click();
      await page.evaluate(async () => { await running; await T.open(); window.running = T.heat.runHeat(cs); });
      await page.locator('[data-test="coal-0"]').waitFor();
      await page.waitForTimeout(3300);
      for (let i = 0; i < 3; i++) await page.locator(`[data-test="coal-${i}"]`).dispatchEvent("pointerdown");
      await page.locator('[data-test="step-next"]').waitFor();
      assert.equal(await page.evaluate(() => cs.heat.early), 3);
      assert.match(await page.locator('[data-test="craft-feedback"]').innerText(), /早く/);
    }
  }, touch ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});

  await check("holes-and-steam-help", async page => {
    await init(page);
    await page.evaluate(async () => { await T.open(); window.running = T.holes.runHoles(cs); });
    await page.locator('.bench-demo-skip').click();
    await page.locator('.bench-demo-sheet').waitFor({ state: 'detached' });
    await page.locator('[data-test="hole-start"]').click();
    await page.waitForTimeout(3500); await guide(page).click(); await page.waitForTimeout(100);
    const hole = await page.locator(".foil-target-plane > .foil-cursor").getAttribute("style");
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press("Space"); await page.waitForTimeout(1500);
    assert.equal(await page.locator(".foil-target-plane > .foil-cursor").getAttribute("style"), hole);
    assert.equal(await page.locator(".foil-holes .foil-hole").count(), 0);
    // 別の実セッション。弾幕・残り時間・温度も一緒に停止する。
    await page.evaluate(async () => {
      await T.open(); cs.mix = { lemon: 9, mint: 3 }; cs.steamSeconds = 300;
      window.running = T.steam.runSteamDodge(cs);
    });
    await page.locator('[data-test="dodge"]').waitFor();
    await page.waitForFunction(() => document.querySelector('.bench-guide')?.open
      && document.querySelector('.bench-panel')?.inert);
    const sample = () => page.evaluate(() => ({
      time: document.querySelector('[data-test="steam-clock"]').textContent,
      temp: document.querySelector('[data-test="steam-temperature"]').getAttribute("aria-valuenow"),
      heart: document.querySelector(".dodge-heart").style.transform,
    }));
    const startup = await sample(); await page.keyboard.down("ArrowRight"); await page.waitForTimeout(1500);
    assert.deepEqual(await sample(), startup, 'automatic startup explanation holds clock, temperature and input');
    await page.keyboard.up("ArrowRight");
    assert.equal(await page.locator('.countdown').count(), 0, 'countdown waits for startup dismissal');
    await guide(page).click();
    await page.locator('.countdown').waitFor();
    await page.waitForFunction(() => document.querySelector('.countdown')?.textContent === 'GO!');
    await page.locator('.countdown').waitFor({ state: 'detached' });
    await page.waitForFunction(() => !document.querySelector('[data-test="dodge-precision"]').disabled);
    assert(await guide(page).evaluate(n => n === document.activeElement), 'closed guide summary retains keyboard focus');
    const started = await sample();
    await page.waitForFunction(before => document.querySelector('[data-test="steam-clock"]').textContent !== before.time, started);
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction(heart => document.querySelector('.dodge-heart').style.transform !== heart, started.heart);
    await page.keyboard.up("ArrowRight");
    const stopped = (await sample()).heart;
    await page.waitForTimeout(250);
    assert.equal((await sample()).heart, stopped, 'keyup stops movement while summary remains focused');
    await guide(page).click();
    await page.waitForFunction(() => document.querySelector('.bench-guide')?.open
      && document.querySelector('.bench-panel')?.inert);
    const before = await sample(); await page.keyboard.down("ArrowRight"); await page.waitForTimeout(1500);
    assert.deepEqual(await sample(), before);
    await page.keyboard.up("ArrowRight");
    await guide(page).click(); await page.keyboard.down("ArrowRight"); await page.waitForTimeout(600);
    assert.notDeepEqual(await sample(), before);
    await page.waitForFunction(heart => document.querySelector('.dodge-heart').style.transform !== heart, before.heart);
    await page.keyboard.up("ArrowRight");
  });

  await check("care-help-and-draw", async page => {
    await init(page);
    await page.evaluate(async () => {
      await T.open(); cs.mix = { mint: 12 }; cs.pull = { temp: .54 }; cs.careRound = 1;
      window.running = T.pull.runCare(cs, { round: 1 });
    });
    await page.locator('[data-test="care-coal-0"]').click();
    // Wait for the actual countdown completion; CI frame scheduling can take
    // longer than its nominal duration. Opening help earlier pauses startup.
    await page.waitForFunction(() => !document.querySelector('[data-test="pull-stop"]').disabled);
    await guide(page).click(); await page.waitForTimeout(100);
    const sample = () => page.locator('[data-test="pull-temperature"]').getAttribute("aria-valuenow");
    const before = await sample(); await page.waitForTimeout(1600);
    assert.equal(await sample(), before);
    await guide(page).click();
    await page.waitForFunction(value => document.querySelector('[data-test="pull-temperature"]').getAttribute('aria-valuenow') !== value, before);
    assert.notEqual(await sample(), before);
    await page.locator('[data-test="pull-stop"]').click();
    await guide(page).click(); await page.waitForTimeout(100);
    const drawing = await sample(); await page.waitForTimeout(1800);
    assert.equal(await sample(), drawing);
    await guide(page).click();
  });

  for (const [flavor, mint, expected] of [["lemon", 0, "レモン"], ["orange", 3, "オレンジ"], ["mint", 0, "ミント"]]) {
    await check(`first-customer-${flavor}`, async page => {
      await init(page);
      await page.evaluate(async () => {
        window.progress = T.core.state.flags._ch1_opening = { introDone: true, departureDone: true, offerDone: true, tutorialChoice: "skip" };
        window.trace = []; T.vn.hooks.onLine = (id, line) => trace.push({ id, text: line.text });
        await T.first.firstBrewOrder(progress);
        window.serving = T.first.serveFirstBrew(progress);
      });
      await page.locator('[data-test="mix-ok"]').waitFor();
      assert.deepEqual(await page.locator(".flavor-row").evaluateAll(nodes => nodes.map(n => n.dataset.flavor)), ["lemon", "orange", "mint"]);
      for (let i = 0; i < 12 - mint; i++) await page.locator(`[data-test="mix-plus-${flavor}"]`).click();
      for (let i = 0; i < mint; i++) await page.locator('[data-test="mix-plus-mint"]').click();
      if (flavor === "orange") await assertFirstMixControlsReachable(page);
      else await assertFits(page, '[data-test="mix-ok"], .fr-btn');
      assert.equal(await page.locator(".bench-mode small").evaluate(n => n.getClientRects().length), 1, "注文の表示を1行に収める");
      await shot(page, `first-mix-${flavor}`);
      const stock = await page.evaluate(() => JSON.stringify(T.core.state.flavorStock));
      await page.locator('[data-test="mix-ok"]').click();
      assert.equal(await page.evaluate(() => serving), true);
      const actual = await page.evaluate(() => ({ brew: progress.firstBrew, trace, stock: JSON.stringify(T.core.state.flavorStock),
        saved: JSON.parse(localStorage.getItem(T.core.SAVE_KEY)).flags._ch1_opening.firstBrew }));
      assert.equal(actual.brew.mix[flavor], 12 - mint);
      assert.deepEqual(actual.saved, actual.brew);
      assert.equal(actual.stock, stock, "店の支給葉は手持ちを消費しない");
      assert(actual.trace.some(l => /サッパリ/.test(l.text)), "注文が先に提示される");
      assert(actual.trace.some(l => l.id === "ch1_tutorial_oneesan" && l.text.includes(expected)), "実配合への感想がある");
    }, flavor === "orange" ? { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true } : {});
  }

  await check("loss-boundary-save-and-assist", async page => {
    await init(page);
    assert.deepEqual(await page.evaluate(() => {
      const t = T.core.state.tournament, offered = [];
      for (let i = 1; i <= 3; i++) {
        t.attempts = i; T.assist.recordTournamentLoss(t); T.assist.recordTournamentLoss(t);
        offered.push(T.assist.offersRetryAssist(t));
      }
      T.core.save(); T.core.load();
      return { offered, losses: T.core.state.tournament.losses };
    }), { offered: [false, false, true], losses: 3 });
    await page.evaluate(() => { window.choice = T.assist.chooseRetryAssist(T.core.state.tournament); });
    await page.locator('[data-test="retry-assist-yes"]').click();
    assert.equal(await page.evaluate(() => choice), true);
    assert.equal(await page.evaluate(() => T.core.state.tournament.retryAssist), true);
    await page.evaluate(() => { const t = T.core.state.tournament; t.attempts++; T.assist.recordTournamentLoss(t); });
    assert.equal(await page.evaluate(() => T.core.state.tournament.retryAssist), false, "一度の挑戦後には補助を解除");
    await page.evaluate(() => { window.choice = T.assist.chooseRetryAssist(T.core.state.tournament); });
    await page.locator('[data-test="retry-assist-no"]').click();
    assert.equal(await page.evaluate(() => choice), false);
    const windows = await page.evaluate(async () => {
      const { skill } = await import("./js/craft/common.js"); const cs = T.session.newSession("tournament");
      const ordinary = { slow: skill.slow(cs), window: skill.window(cs) }; cs.retryAssist = true;
      return { ordinary, easier: { slow: skill.slow(cs), window: skill.window(cs) }, stats: T.core.state.stats };
    });
    assert(windows.easier.slow > windows.ordinary.slow && windows.easier.window > windows.ordinary.window);
  });

  await check("third-recorded-loss-continue-retry", async page => {
    await init(page);
    // 外部BGMの通信はテストしない。小さな有効WAVを返し、実際のCONTINUEを動かす。
    const wav = Buffer.alloc(16044);
    wav.write("RIFF"); wav.writeUInt32LE(16036, 4); wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28); wav.writeUInt16LE(2, 32);
    wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(16000, 40);
    await page.route("**/assets/audio/bgm/bgm_continue_urgent.mp3", route => route.fulfill({ status: 200, contentType: "audio/wav", body: wav }));
    await page.evaluate(async () => {
      const s = T.core.state;
      Object.assign(s, { phase: "tournament", day: 14 });
      Object.assign(s.tournament, { attempts: 3, losses: 2, lastLossAttempt: 2 });
      // devGameOver is a read-only preview; record the third loss through the
      // production helper before exercising the real CONTINUE/retry controls.
      T.assist.recordTournamentLoss(s.tournament);
      const { TSUMUGI_STORY } = await import("./js/chapters/tsumugi-story.js");
      for (const step of TSUMUGI_STORY) s.flags[step.flag] = true;
      for (const id of ["sumi", "pakki", "nagumo", "maezono", "dr_kemuri", "naru", "adam", "minto"]) {
        (await import("./js/vn/intro.js")).markIntroSeen(id);
      }
      await T.chapter.devGameOver("burnt", 0, 0);
    });
    await page.locator('[data-test="retry"]').click();
    await page.locator('[data-test="retry-assist-yes"]').waitFor({ timeout: 15000 });
    assert.equal(await page.evaluate(() => T.core.state.tournament.losses), 3);
    await shot(page, "continue-assist-question");
    await page.locator('[data-test="retry-assist-yes"]').click();
    await page.locator('.bench[data-mode="tournament"]').waitFor({ timeout: 45000 });
    assert.match(await page.locator(".bench-mode").innerText(), /今回のみ操作補助/);
    assert.equal(await page.evaluate(() => T.core.state.tournament.retryAssist), true);
    await shot(page, "assisted-tournament");
  });
});
