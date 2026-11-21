// スマホ横持ちの桜井版の作業台（PHN・css/craft-phone.css）を、工程ごとに実画面で確かめる。
// 文字と押す所が、ステージの外へ出ない／入れ物に切られない／実寸 11.4px・44px を割らない／別の部品に覆われない。
// 見た目の良し悪しそのものは判定しない（撮影して目で見る）。ここは「重なり・はみ出し・切れ」の再発を止める。
import assert from 'node:assert/strict';
import { suite } from './support.mjs';
import { audit } from './craft_phone_audit.mjs';

// iPhone 横（844×390）・Safari のバーで低くなった時（844×340）・小さい端末（740×320）。
// 育成済み: 能力が育つと出る効果の印（技・感・察）と、心得で増える部品（単体で勝負・香りの記憶・ズボー・味の名前を伏せる）がある状態。
// はじめの状態だけで確かめると、遊び込んだセーブでだけ崩れる（穴あけの右の列・吸い出しの下の列が崩れていた）。
const CASES = [[844, 390, false], [844, 390, true], [844, 340, true], [740, 320, true]];
const t = id => `[data-test="${id}"]`;


await suite('craft-phone-layout', async check => {
  for (const [width, height] of [[844, 390], [844, 340], [740, 320]]) {
    await check(`holes-feedback-${width}x${height}`, async page => {
      await page.evaluate(async () => {
        const { newGame } = await import('./js/core/state.js');
        const { newSession, openBench } = await import('./js/craft/session.js');
        const { runHoles } = await import('./js/craft/holes.js');
        newGame();
        const cs = newSession('rehearsal');
        cs.foilOptIn = true;
        const bench = openBench(cs, { steps: [['holes', 'FOIL']] });
        await bench.ready;
        runHoles(cs).catch(() => {});
      });
      assert.equal(await page.locator('.bench').getAttribute('data-craft-version'), 'sakurai');
      await page.locator(t('hole-start')).tap();
      const punch = page.locator(`${t('hole-punch')}:not([disabled])`);
      await punch.waitFor({ timeout: 15000 });
      await page.waitForFunction(() => !document.querySelector('.countdown'), null, { timeout: 15000 });
      await punch.tap();
      const verdict = page.locator(`${t('hole-feedback')} > .stamp`);
      assert.equal(await verdict.textContent(), '浅い穴。大きく減点');
      await page.waitForTimeout(200); // 判定が表示枠の中央に出そろうまで。
      const visible = await verdict.evaluate(node => {
        const frame = node.parentElement.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(node);
        const ink = range.getBoundingClientRect();
        return { left: ink.left - frame.left, right: frame.right - ink.right,
          top: ink.top - frame.top, bottom: frame.bottom - ink.bottom };
      });
      assert(Object.values(visible).every(gap => gap >= -1),
        `穴あけの判定文が表示枠に収まる: ${JSON.stringify(visible)}`);
    }, { viewport: { width, height }, isMobile: true, hasTouch: true });
  }

  for (const [width, height, grown] of CASES) await check(`${width}x${height}${grown ? '-grown' : ''}`, async page => {
    const settle = (ms = 450) => page.waitForTimeout(ms); // 工程の入りの動き（0.22秒）が済むまで
    const clean = async label => { await settle(); assert.deepEqual(await page.evaluate(audit), [], `${label} (${width}x${height}${grown ? '・育成済み' : ''})`); };
    /** 工程を始める（終わりを待たない）。次の工程へ移って捨てた分の中断は無視する。 */
    const start = source => page.evaluate(`(async () => { const p = (${source})(); p?.catch?.(() => {}); })()`);
    await page.evaluate(async grown => {
      const core = await import('./js/core/state.js'); core.newGame();
      const { state } = core;
      if (grown) {
        const { NODE_BY_ID } = await import('./js/core/growth-board-layout.js');
        for (const key of Object.keys(state.stats)) state.stats[key] = 92;
        const nodes = Object.keys(NODE_BY_ID);
        Object.assign(state.growth ||= {}, { nodes, learned: nodes.filter(id => id.startsWith('M-')), memory: { ...(state.growth.memory || {}), lastMix: { lemon: 7, mint: 5 } } });
        state.recipes = { ...(state.recipes || {}), ice_lemonade: { day: 1 }, sumi_basic: { day: 1 } };
      }
      Object.assign(state.flags, { _coal_cube_learned: true, _coal_four_unlocked: true,
        seenStepIntro: { setup: true, water: true, mix: true, pack: true, place: true, timer: true, steam: true } });
      for (const id of ['hagal_80beat', 'tanukish_lid', 'cube_charcoal']) if (!state.owned.includes(id)) state.owned.push(id);
      state.flavorStock = { double_apple: 50, mint: 50, blueberry: 50, lemon: 50 };
      state.flavors = ['double_apple', 'mint', 'blueberry', 'lemon'];
      const [S, steps, water, holes, heat, steam, pull, common, practice] = await Promise.all(['session', 'steps', 'water-view', 'holes', 'heat', 'steam', 'pull', 'common', 'practice']
        .map(name => import(`./js/craft/${name}.js`)));
      window.QA = { S, steps, water, holes, heat, steam, pull, common };
      QA.cs = S.newSession('rehearsal'); QA.cs.foilOptIn = true;
      const bench = S.openBench(QA.cs, { steps: practice.CRAFT_STEPS });
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      await bench.ready;
    }, grown);
    assert.equal(await page.locator('.bench').getAttribute('data-craft-version'), 'sakurai');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.density), 'phone');

    // 機材（器 → HMD → アルミ）: 絵つきの札。上に一式の名前と「性能を見比べる」
    await start('() => QA.steps.stepSetup(QA.cs)');
    await page.locator(t('setup-compare')).waitFor();
    assert(await page.locator('.opt-grid .opt .opt-art').first().isVisible(), '機材の札に商品の絵が出る');
    await clean('機材: 器');
    await page.locator(t('setup-compare')).tap(); await page.locator(t('setup-compare-close')).waitFor();
    await clean('機材: 見比べ'); await page.locator(t('setup-compare-close')).tap();
    await page.locator(t('opt-hagal_80beat')).tap(); await page.locator(t('opt-lotos_hagal')).waitFor();
    await clean('機材: HMD');
    await page.locator(t('opt-lotos_hagal')).tap(); await page.locator(t('opt-true')).waitFor();
    await clean('機材: アルミ'); await page.locator(t('opt-true')).tap();
    await page.locator(t('opt-cube_charcoal')).waitFor();
    await clean('機材: 炭'); await page.locator(t('opt-flat_charcoal')).tap();

    // 水入れ
    await start('() => QA.water.stepWater(QA.cs)');
    await page.locator(t('water-confirm')).waitFor();
    await clean('水入れ');
    await page.locator('.bench-guide > summary').tap(); await page.locator(t('bench-guide-close')).waitFor();
    await clean('水入れ: 説明'); await page.locator(t('bench-guide-close')).tap();
    await page.locator(t('water-confirm')).tap();

    // 配合: 葉の行は1行ぶんの高さ。左の列（器・予想・持ち）が下の列に食い込まない
    await start('() => QA.steps.stepMix(QA.cs)');
    await page.locator(t('mix-ok')).waitFor();
    assert(await page.locator(t('mix-water-level')).isVisible(), '水位の確認を配合の中で読める');
    assert.equal(await page.locator('#toasts .water-level').isVisible(), false, '水位の知らせが工程レールを覆わない');
    await clean('配合: 空');
    if (grown) { // 一覧の頭は1行。記憶を開いても葉の行を押し下げない
      const firstRow = () => page.locator('.flavor-row').first().boundingBox();
      const before = await firstRow();
      await page.locator('.mix-recall > summary').tap(); await page.locator(t('mix-recall-last')).waitFor();
      await clean('配合: 香りの記憶');
      const [recall, choices] = await Promise.all([page.locator(t('mix-recall-last')).boundingBox(), page.locator('.mix-recall > .chips').boundingBox()]);
      assert(recall.x >= choices.x && recall.x + recall.width <= choices.x + choices.width + 0.5, '前回の配合の札が横送りせずに収まる');
      assert(Math.abs((await firstRow()).y - before.y) < 1, '香りの記憶を開いても、葉の行は動かない');
      await page.locator('.mix-recall > summary').tap();
    }
    for (const [id, grams] of [['lemon', 3], ['mint', 2]]) for (let i = 0; i < grams; i++) await page.locator(t(`mix-plus-${id}`)).tap();
    // レシピ名（「📖 氷レモネード」）が出ても、下の「フレーバーの持ち」の炎を押し出して切らない
    assert.match(await page.locator('.recipe-line').textContent(), /氷レモネード/);
    await clean('配合: レシピ名');
    for (let i = 0; i < 7; i++) await page.locator(t('mix-plus-double_apple')).tap();
    await clean('配合: 12g');
    const side = await page.evaluate(() => {
      const box = s => document.querySelector(s).getBoundingClientRect();
      const leaves = box('.mix-life-preview .leaf-icon'), footer = box('.mix-footer'), list = box('.mix-list');
      return { leavesBottom: leaves.bottom, footerTop: footer.top, rows: [...document.querySelectorAll('.flavor-row')].filter(r => r.getBoundingClientRect().bottom <= list.bottom + 1).length };
    });
    assert(side.leavesBottom <= side.footerTop + 1, `フレーバーの持ちの葉が下の列に重ならない: ${JSON.stringify(side)}`);
    // 育成済みは一覧の頭に1行（単体で勝負・香りの記憶）が入るので、いちばん小さい画面では2行と3行目の上半分まで
    assert(side.rows >= (grown ? 2 : 3), `葉の行が${grown ? 2 : 3}つ以上、送らずに見える: ${JSON.stringify(side)}`);
    await page.locator('.mix-taste').tap(); await page.locator(t('mix-forecast-close')).waitFor();
    await clean('配合: 予想の詳細'); await page.locator(t('mix-forecast-close')).tap();
    await page.locator(t('flavor-info-mint')).tap(); await page.locator(t('flavor-info-close')).waitFor();
    assert.match(await page.locator(t('flavor-info-mastery')).textContent(), /熟練度/);
    await clean('配合: 葉の特徴'); await page.locator(t('flavor-info-close')).tap();
    await page.locator(t('mix-ok')).tap();

    // 詰め方
    await start('() => QA.steps.stepPack(QA.cs)');
    await page.locator(t('pack-confirm')).waitFor();
    await clean('詰め方'); await page.locator(t('pack-confirm')).tap();

    // 穴あけ: 配置選び → 刺している間（押せる方のボタンだけが出る）
    await start('() => QA.holes.runHoles(QA.cs)');
    await page.locator(t('hole-start')).waitFor();
    const foil = await page.evaluate(() => { const f = document.querySelector('[data-test="hole-preview"]').getBoundingClientRect(), p = document.querySelector('.bench-panel').getBoundingClientRect(); return { left: f.left - p.left, right: p.right - f.right }; });
    assert(foil.left >= -1, `アルミの配置図が舞台の左へ欠けない: ${JSON.stringify(foil)}`);
    await clean('穴あけ: 配置');
    await page.locator(t('hole-start')).tap();
    await page.locator(`${t('hole-punch')}:not([disabled])`).waitFor({ timeout: 15000 });
    await page.waitForFunction(() => !document.querySelector('.countdown'), null, { timeout: 15000 });
    await clean('穴あけ: 刺す');
    if (grown) {
      const side = await page.evaluate(() => {
        const box = s => document.querySelector(s)?.getBoundingClientRect(), punch = box('[data-test="hole-punch"]'), hint = box('[data-test="hole-depth-hint"]'), badge = box('.hr-side > .effect-badge');
        return { punchHeight: punch.height, hintWidth: hint.width, sideWidth: box('.hr-side').width, badge: badge && [badge.width, badge.height] };
      });
      assert(side.badge && Math.min(...side.badge) >= 14, `能力の効果の札が読める大きさで出る: ${JSON.stringify(side)}`);
      assert(side.punchHeight >= 44 && side.hintWidth > side.sideWidth * .7, `効果の印が右の列の部品を押しつぶさない: ${JSON.stringify(side)}`);
    }

    // 炭の配置・炭焼き
    await start('() => QA.steps.stepPlace(QA.cs)');
    await page.locator(t('opt-triangle')).waitFor();
    await clean('炭の配置'); await page.locator(t('opt-triangle')).tap();
    await settle(300);
    const combo = page.locator(t('opt-same'));
    if (await combo.count()) { await clean('炭の組み合わせ'); await combo.tap(); }
    await start('() => QA.heat.runHeat(QA.cs)');
    await page.locator(t('coal-0')).waitFor();
    assert(await page.locator('.heat-collected-label').isVisible(), '炭壺の数字に何を数えるかが付いている');
    await clean('炭焼き');

    // 蒸らし時間・雑念よけ
    await start('() => QA.steps.stepSteamTime(QA.cs)');
    await page.locator(t('timer-start')).waitFor();
    for (let i = 0; i < 5; i++) await page.locator(t('timer-minute-up')).tap();
    await clean('蒸らし時間');
    await start('() => { Object.assign(QA.cs, { steamSeconds: 300, steamMin: 5 }); return QA.steam.runSteamDodge(QA.cs); }');
    await page.locator(t('dodge-pad')).waitFor();
    await clean('雑念よけ');
    const [clock, dodge] = await Promise.all([page.locator(t('steam-clock')).boundingBox(), page.locator(t('dodge')).boundingBox()]);
    assert(clock.x + clock.width <= dodge.x, '残り時間は弾幕と重ならない');

    // 吸い出し: 下の列（葉の持ち・回数／提供／吸う）が重ならない
    await start('() => { QA.cs.steam = { temp: .5, hits: 0, score: 100, seconds: 300, min: 5 }; return QA.pull.runPull(QA.cs); }');
    await page.locator(`${t('pull-stop')}:not([disabled])`).waitFor({ timeout: 15000 });
    await clean('吸い出し');
    const row = await page.evaluate(() => ['.pull-summary', '[data-test="pull-serve"]', '[data-test="pull-stop"]'].map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.right]; }));
    assert(row[0][1] <= row[1][0] + 1 && row[1][1] <= row[2][0] + 1, `吸い出しの下の列が横に重ならない: ${JSON.stringify(row)}`);
    if (grown) { // 心得で増えるボタンは上の段（ズボーは「吸う」の上、伏せるは「提供する」の上）。状態の札はつぶれない
      const tier = await page.evaluate(() => Object.fromEntries(['.pull-summary', '[data-test="pull-serve"]', '[data-test="pull-stop"]', '[data-test="pull-deep"]', '[data-test="pull-blind"]', '.pull-dial']
        .map(s => { const r = document.querySelector(s).getBoundingClientRect(); return [s, { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width }]; })));
      assert(tier['[data-test="pull-deep"]'].bottom <= tier['[data-test="pull-stop"]'].top + 1 && tier['[data-test="pull-blind"]'].bottom <= tier['[data-test="pull-serve"]'].top + 1, `追加のボタンは上の段: ${JSON.stringify(tier)}`);
      assert(tier['.pull-summary'].width >= tier['[data-test="pull-stop"]'].width, `状態の札がつぶれない: ${JSON.stringify(tier)}`);
      assert(tier['.pull-dial'].bottom <= tier['[data-test="pull-deep"]'].top + 1, `ダイヤルが追加のボタンに被らない: ${JSON.stringify(tier)}`);
    }
    const serve = page.locator(t('pull-serve')), serveStatus = page.locator(t('pull-serve-status')), pullCount = page.locator('.pull-count-num');
    assert(await serve.isDisabled());
    assert.equal(await serveStatus.textContent(), 'あと2口');
    // キープの中央に針が来た時に通常の入力を通し、途中で焦げない条件で2口の表示を検査。
    for (let count = 0; count < 2; count++) {
      await page.waitForFunction(() => {
        const button = document.querySelector('[data-test="pull-stop"]');
        const pos = Number(document.querySelector('.pg-needle').dataset.pos);
        if (button.disabled || pos < 48 || pos > 52) return false;
        button.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
        return true;
      });
      assert.equal(await pullCount.textContent(), `${count}/5`, '吸引中の一口はまだ数えない');
      assert.equal(await serveStatus.textContent(), '吸引中');
      assert(await serve.isDisabled());
      await page.waitForFunction(() => !document.querySelector('.pull-play').dataset.draw);
      assert.equal(await pullCount.textContent(), `${count + 1}/5`);
    }
    assert(await serve.isEnabled());
    assert.equal(await serveStatus.isVisible(), false);

    // 結果カード: 長い講評は一言の札の中で数行ずつ送る（札が熱の柱の裏へ伸びない）。「詳しく見る」を開いても「次へ」が動かない
    await page.evaluate(() => {
      QA.card = QA.common.resultCard(document.querySelector('.bench-panel'), { title: '吸い出し 結果',
        advice: '早い炭と遅い炭がある。黒い面が消えて全面が赤くなった炭から取り出そう',
        summary: ['工程点：68点 ／ 取り頃：0/3個', '奥 MISS：2.56秒早い（焼けムラ）', '手前左 GOOD：1.17秒早い（焼け上がり前）'],
        lines: ['一行目', '二行目', '三行目', '四行目', '五行目', '六行目', '七行目', '八行目'] });
    });
    await page.locator(t('step-next')).waitFor();
    await clean('結果カード');
    const note = page.locator('.audience-note');
    assert.match(await note.textContent(), /早い炭と遅い炭がある。黒い面が消えて全面が赤くなった炭から取り出そう/, '送っていても全文を持つ');
    assert(Number(await note.getAttribute('data-pages')) >= 2, '長い講評は数行ずつ送る');
    const nextBefore = await page.locator(t('step-next')).boundingBox();
    await page.locator(t('step-details')).tap();
    await clean('結果カード: 詳しく');
    const nextAfter = await page.locator(t('step-next')).boundingBox();
    assert(Math.abs(nextBefore.x - nextAfter.x) < 1 && Math.abs(nextBefore.y - nextAfter.y) < 1, `「次へ」は開いても動かない: ${JSON.stringify({ nextBefore, nextAfter })}`);
    await page.locator(t('step-next')).tap(); await page.evaluate(() => QA.card);

    // 調整: 炭の交換を選ぶ（下に隠した吸い出しの盤が出てこない）
    await start('() => { Object.assign(QA.cs, { pull: { score: 80, temp: .5, pulls: 3 }, pullDone: true }); return QA.pull.runCare(QA.cs, { round: 1 }); }');
    await page.locator(t('care-coal-1')).waitFor();
    assert.equal(await page.locator('.pull-play').isVisible(), false, '炭を選ぶ間、吸い出しの盤は隠れている');
    await clean('調整: 炭の交換');
  }, { viewport: { width, height }, isMobile: true, hasTouch: true });
});
