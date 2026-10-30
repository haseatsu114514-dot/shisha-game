// 制作UI・実際のタイマー操作・温度の引継ぎ・集中による吸い出し難易度。
// NODE_PATH=... CHROME_EXECUTABLE_PATH=... node remake/test/craft_focus.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { installLoadingComicReader } from './browser/loading_reader.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROME_EXECUTABLE_PATH ? { executablePath: process.env.CHROME_EXECUTABLE_PATH } : {}),
});
const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const shots = process.env.SHOTS;
if (shots) fs.mkdirSync(shots, { recursive: true });
const errors = [];
const open = async (viewport, mobile = false) => {
  const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await installLoadingComicReader(page);
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame();
    const session = await import('./js/craft/session.js');
    const steps = await import('./js/craft/steps.js');
    const heat = await import('./js/craft/heat.js');
    const steam = await import('./js/craft/steam.js');
    const pull = await import('./js/craft/pull.js');
    window.T = { core, session, steps, heat, steam, pull };
    // 現行の場面転換は幕が覆ってから画面を差し替える。前の作業台を読まない。
    T.openBench = async (cs, options) => {
      const bench = session.openBench(cs, options);
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      // 本番と同じく、ロード画面（漫画）が閉じてから次の作業台・工程へ進む。閉じる前に開くと二重のロード画面になる。
      await bench.ready;
      return bench;
    };
    window.steps = [['mix','MIX'], ['heat','HEAT'], ['steam','STEAM'], ['pull','PULL']];
  });
  return page;
};
const loaded = page => page.waitForFunction(() => [...document.querySelectorAll('.audience-face img, .worker-actor')].every(i => i.complete && i.naturalWidth));
const capture = async (page, name) => { if (shots) { await page.waitForTimeout(220); await page.screenshot({ path: `${shots}/${name}.png` }); } };
try {
  const page = await open({ width: 1280, height: 720 });
  await page.evaluate(async () => {
    window.cs = T.session.newSession('tutorial'); await T.openBench(cs, { steps });
    window.timerRun = T.steps.stepSteamTime(cs);
  });
  await page.waitForSelector('[data-test="kitchen-timer"]'); await loaded(page);
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '00:00');
  assert(await page.locator('[data-test="timer-start"]').isDisabled());
  assert.deepEqual(await page.locator('.timer-button').allTextContents(), ['分', '秒', 'スタート＆ストップ', 'リセット']);
  for (let i = 0; i < 5; i++) await page.locator('[data-test="timer-minute-up"]').click();
  for (let i = 0; i < 2; i++) await page.locator('[data-test="timer-second-up"]').click();
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '05:20');
  assert.equal(await page.locator('.timer-display svg g').count(), 4);
  assert(await page.locator('.timer-display .segment.on').count() > 15);
  await capture(page, 'timer-tutorial-desktop');
  // 現行の秒ボタンは10秒加算し、60秒に達すると分へ繰り上げる（上限10分）。
  for (let i = 0; i < 4; i++) await page.locator('[data-test="timer-second-up"]').click();
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '06:00');
  await page.locator('[data-test="timer-reset"]').click();
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '00:00');
  assert(await page.locator('[data-test="timer-start"]').isDisabled());
  for (let i = 0; i < 5; i++) await page.locator('[data-test="timer-minute-up"]').click();
  await page.locator('[data-test="timer-second-up"]').click();
  await page.locator('[data-test="timer-start"]').focus(); await page.keyboard.press('Enter');
  await page.evaluate(() => window.timerRun);
  assert.equal(await page.evaluate(() => cs.steamSeconds), 310);
  console.log('[craft focus] PASS: physical buttons, seven-segment digits, real press counts, second carry, reset, zero guard and keyboard start at 5:10');

  // 表情は実際の炭焼き結果へ反応し、名前や審査点を勝手に開放しない。
  await page.evaluate(() => { __remake.craftTest.auto = 'good'; window.heatRun = T.heat.runHeat(cs); });
  await page.waitForSelector('.bench[data-step="heat"] .heat');
  assert(!(await page.locator('[data-test="craft-rating"]').isVisible()),'Rating appeared during active charcoal work');
  assert.match(await page.locator('[data-test="craft-feedback"]').textContent(), /全面.*タップ/,'Tutorial Sumi did not explain the game controls');
  await page.waitForFunction(() => cs.heat?.score > 0);
  await page.evaluate(() => { __remake.craftTest.auto = null; });
  await page.waitForSelector('.result-card.show');
  assert.equal(await page.locator('.audience-person[data-person="sumi"]').getAttribute('data-mood'), 'nod');
  assert.match(await page.locator('.audience-face img').getAttribute('src'), /smile/);
  assert.equal(await page.locator('[data-test="craft-rating"]').textContent(), '◎');
  assert.match(await page.locator('[data-test="craft-feedback"]').textContent(), /いい火/);
  assert.equal(await page.locator('.rc-grade').count(), 0);
  assert(!(await page.locator('.rc-lines').isVisible()));
  await loaded(page);
  await capture(page, 'sumi-heat-desktop');
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.heatRun);
  await page.evaluate(async () => {
    window.cs = T.session.newSession('tournament'); await T.openBench(cs, { steps });
    T.session.stepPanel('heat', '炭焼き', 'テスト');
  });
  assert.deepEqual(await page.locator('.audience-person figcaption').allTextContents(), ['？？？']);
  const mc = await page.evaluate(() => {
    const text = __remake.DB.broadcast.mc.coalfire;
    T.session.tickerSay(`パッキー「${text}」`);
    return text;
  });
  assert.equal(await page.locator('.bench-ticker').count(), 0);
  assert.equal(await page.locator('.bench-audience').getAttribute('data-speaker'), 'pakki');
  assert.equal(await page.locator('.audience-person figcaption').textContent(), 'パッキー');
  assert.equal(await page.locator('[data-test="craft-feedback"]').getAttribute('data-raw'), mc);
  assert.equal((await page.locator('[data-test="craft-feedback"]').textContent()).replace(/\s/g, ''), mc.replace(/\s/g, ''));
  assert(!(await page.locator('[data-test="craft-rating"]').isVisible()));
  await loaded(page); await capture(page, 'pakki-heat-desktop');
  await page.evaluate(() => T.session.reactAudience(cs,'good',{force:true}));
  assert.equal(await page.locator('.bench-audience').getAttribute('data-speaker'), 'dr_kemuri');
  assert.equal(await page.locator('.audience-person figcaption').textContent(), '？？？');
  assert.equal(await page.evaluate(() => Object.keys(T.core.state.met).length), 0);
  await page.evaluate(async () => {
    ['nagumo','maezono','dr_kemuri'].forEach(T.core.markMet);
    window.cs = T.session.newSession('tournament'); await T.openBench(cs, { steps });
    __remake.craftTest.auto = 'good';
    window.heatRun = T.heat.runHeat(cs);
  });
  await page.waitForFunction(() => cs.heat?.score > 0);
  await page.evaluate(() => { __remake.craftTest.auto = null; });
  await page.waitForSelector('.result-card.show'); await loaded(page);
  const moods = await page.locator('.audience-person').evaluateAll(ns => ns.map(n => [n.dataset.person, n.dataset.mood]));
  assert.deepEqual(moods, [['dr_kemuri','nod']]);
  assert.equal(await page.locator('[data-test="craft-rating"]').textContent(), '◎');
  await capture(page, 'judges-heat-desktop');
  const voices=[];
  for (const [score,mark,tone] of [[95,'◎','bright'],[72,'○','warm'],[35,'△','quiet']]) {
    await page.evaluate(score => { cs.heat.score=score; T.session.presentBenchResult(document.querySelector('.bench-panel'),'炭焼き 結果'); }, score);
    assert.equal(await page.locator('[data-test="craft-rating"]').textContent(),mark);
    assert.equal(await page.locator('.bench-audience').getAttribute('data-tone'),tone);
    voices.push(await page.locator('[data-test="craft-feedback"]').textContent());
  }
  assert.equal(new Set(voices).size,3);
  await page.locator('[data-test="step-details"]').click(); assert(await page.locator('.rc-lines').isVisible());
  await page.locator('[data-test="step-details"]').click();
  await page.locator('[data-test="step-next"]').click(); await page.evaluate(() => window.heatRun);
  for (const judge of ['nagumo','maezono','dr_kemuri']) {
    await page.evaluate(judge => T.session.reactAudience(cs,'just',{judge,force:true}),judge);
    assert.equal(await page.locator('.audience-person').count(),1);
    assert.equal(await page.locator('.audience-person').getAttribute('data-person'),judge);
  }
  await page.evaluate(() => T.session.reactAudience(cs,'just',{judge:'nagumo',force:true}));
  assert.match(await page.locator('[data-person="nagumo"] img').getAttribute('src'), /thinking/);
  // 同じスミさんでも、システム説明はチュートリアル限定。成績記号はまだ出さない。
  const modes=[];
  for (const mode of ['tutorial','rehearsal']) {
    modes.push(await page.evaluate(async mode => {
      window.cs=T.session.newSession(mode); await T.openBench(cs);
      T.session.stepPanel('pull','吸い出し','吸い方の説明');
      const first=document.querySelector('[data-test="craft-feedback"]').textContent;
      T.session.reactAudience(cs,'bad',{force:true});
      return {first,live:document.querySelector('[data-test="craft-feedback"]').textContent,rating:document.querySelector('[data-test="craft-rating"]').hidden};
    },mode));
  }
  assert.match(modes[0].first,/針を止め/); assert.match(modes[0].live,/キープ左/);
  assert(!/針|ゲージ|ボタン|キープ左/.test(modes[1].first+modes[1].live));
  assert(modes.every(m=>m.rating));
  console.log('[craft focus] PASS: one current speaker, real Sumi/judge success feedback, distinct ◎/○/△ scores and lines, optional result detail, hidden undiscovered names and reserved Nagumo');

  // 自主練4工程は、途中の感触も3段階の結果もはじめ本人の内心。
  for (const step of ['holes','heat','steam','pull']) {
    const voice = await page.evaluate(async step => {
      window.cs=T.session.newSession('drill'); await T.openBench(cs);
      T.session.stepPanel(step,step,'説明');
      const note=()=>document.querySelector('[data-test="craft-feedback"]').textContent;
      const initial=note(), live=[];
      for(const kind of ['good','bad']) {T.session.reactAudience(cs,kind,{force:true});live.push(note());}
      const results=[];
      for(const score of [95,72,35]) {
        cs[step]={score}; T.session.presentBenchResult(document.querySelector('.bench-panel'),'結果');
        results.push({text:note(),mark:document.querySelector('[data-test="craft-rating"]').textContent});
      }
      T.session.tickerSay('パッキー「自主練には出ない」');
      return {initial,live,results,speaker:document.querySelector('.bench-audience').dataset.speaker,voice:document.querySelector('.bench-audience').dataset.voice};
    }, step);
    assert.equal(voice.speaker,'hajime'); assert.equal(voice.voice,'inner');
    assert(voice.initial && voice.live.every(Boolean));
    assert.equal(new Set(voice.live).size,2); assert.equal(new Set(voice.results.map(r=>r.text)).size,3);
    assert.deepEqual(voice.results.map(r=>r.mark),['◎','○','△']);
    assert(!/スミ|針|ゲージ|ボタン|ミニゲーム|スコア/.test([voice.initial,...voice.live,...voice.results.map(r=>r.text)].join('')));
    await loaded(page); await capture(page,`inner-${step}-desktop`);
  }
  console.log('[craft focus] PASS: Pakki shares the left comment card, real MC text and avatar, next judge attribution, no name unlock, no footer, and Hajime inner voice across four practice stages and all result grades');

  for (const [stamina, health] of [[80,'green'],[40,'yellow'],[20,'red']]) {
    await page.evaluate(async stamina => {
      T.core.state.stamina = stamina; window.cs = T.session.newSession('drill'); await T.openBench(cs);
      T.session.stepPanel('pack','パッキング','詰め方の説明');
    }, stamina);
    assert.equal(await page.evaluate(()=>cs.condition.health), health);
    assert.equal(await page.locator('.bench-condition').count(), 0, 'mockup removes the face badge while retaining actual condition');
  }

  // 同じ温度から、集中できた場合とミスが多い場合の実際の針移動と成功帯を比較する。
  const focus = [];
  for (const score of [100,0]) {
    await page.evaluate(async score => {
      __remake.craftTest.auto = null; T.core.state.stamina = 80;
      window.cs = T.session.newSession('drill'); cs.steam = { score, temp: .31, seconds: 310 }; cs.holes = { total: 24, minimumComplete: true };
      await T.openBench(cs); window.pullRun = T.pull.runPull(cs);
    }, score);
    const temp = Number(await page.locator('[data-test="pull-temperature"]').getAttribute('aria-valuenow'));
    assert.equal(temp, .31);
    const width = Number(await page.locator('.z-up .pg-just').getAttribute('data-span'));
    await page.waitForFunction(() => parseFloat(document.querySelector('.pg-needle').dataset.pos) > 0);
    const speed = await page.evaluate(async () => {
      const needle = document.querySelector('.pg-needle');
      // 重い描画でフレームが落ちると、ゲームの保護用dt上限と実時計の差で速度が逆転して見える。
      // 実際の針の更新を、両条件とも同じ16ms×10フレームで測る。
      const nativeRaf = requestAnimationFrame.bind(window);
      const descriptor = Object.getOwnPropertyDescriptor(performance, 'now');
      let clock = performance.now(), lastNative;
      Object.defineProperty(performance, 'now', { configurable: true, value: () => clock });
      window.requestAnimationFrame = fn => nativeRaf(now => {
        if (now !== lastNative) { clock += 16; lastNative = now; }
        fn(clock);
      });
      try {
        // すでに予約された元のRAFも、新しい時計へ切り替わるまで待つ。
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame);
        const began = await new Promise(requestAnimationFrame), x = parseFloat(needle.dataset.pos);
        let ended;
        for (let i = 0; i < 10; i++) ended = await new Promise(requestAnimationFrame);
        return (parseFloat(needle.dataset.pos) - x) / (ended - began);
      } finally {
        window.requestAnimationFrame = nativeRaf;
        if (descriptor) Object.defineProperty(performance, 'now', descriptor);
        else delete performance.now;
      }
    });
    focus.push({ width, speed });
    await page.evaluate(() => { __remake.craftTest.auto = 'good'; });
    for (let i = 0; i < 2; i++) {
      await page.locator('[data-test="pull-stop"]').click();
      await page.locator('.pull-play[data-draw]').waitFor({ state: 'hidden' });
    }
    await page.locator('[data-test="pull-serve"]').click(); await page.evaluate(() => window.pullRun);
  }
  assert(focus[0].width > focus[1].width * 1.35, JSON.stringify(focus));
  assert(focus[0].speed < focus[1].speed * .85, JSON.stringify(focus));
  console.log('[craft focus] PASS: equal carried-over temperature, calmer steam widens the real success band and slows the actual moving needle');

  // 同じ吸い方・回数で、提供温度だけを変える。広くした虹色と最適温の判定を一致させる。
  const temperatures=[];
  for (const temp of [.54,.45]) {
    await page.evaluate(async temp => {
      __remake.craftTest.auto=null; window.cs=T.session.newSession('tournament');
      cs.steam={score:100,temp,seconds:480}; cs.holes={total:24,minimumComplete:true};
      await T.openBench(cs); window.pullRun=T.pull.runPull(cs);
    },temp);
    const band=await page.locator('.thermo-optimal').evaluate(n=>n.getBoundingClientRect().height);
    const safe=await page.locator('.thermo-zone').evaluate(n=>n.getBoundingClientRect().height);
    assert(band > safe * .39 && band < safe * .45,'Optimal temperature band must cover the expanded aim zone');
    assert(!(await page.locator('[data-test="craft-rating"]').isVisible()));
    await page.waitForFunction(()=>parseFloat(document.querySelector('.pg-needle').dataset.pos)>0);
    // 本物の針が中央へ来た瞬間に、通常の吸う操作を2回行う。温度や結果は書き換えない。
    await page.evaluate(async()=>{
      const needle=document.querySelector('.pg-needle'), button=document.querySelector('[data-test="pull-stop"]');
      for(let i=0;i<2;i++) {
        while (button.disabled) await new Promise(requestAnimationFrame);
        await new Promise(resolve=>{
          const tick=()=>{
            if(Math.abs(parseFloat(needle.dataset.pos)-50)<1) {button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));resolve();}
            else requestAnimationFrame(tick);
          }; tick();
        });
        if(i===0) await new Promise(resolve=>{
          const leave=()=>Math.abs(parseFloat(needle.dataset.pos)-50)>5?resolve():requestAnimationFrame(leave);leave();
        });
      }
      while (document.querySelector('.pull-play').dataset.draw) await new Promise(requestAnimationFrame);
    });
    await page.locator('[data-test="pull-serve"]').click();
    await page.waitForSelector('.result-card.show');
    temperatures.push(await page.evaluate(()=>({...cs.pull,mark:document.querySelector('[data-test="craft-rating"]').textContent})));
    await loaded(page); await capture(page,temp===.54?'pull-optimal-desktop':'pull-ideal-desktop');
    await page.locator('[data-test="step-next"]').click(); await page.evaluate(()=>window.pullRun);
  }
  assert(temperatures[0].optimal);assert.equal(temperatures[0].mark,'◎');
  assert(!temperatures[1].optimal);assert.equal(temperatures[1].mark,'○');
  assert(temperatures[0].score>temperatures[1].score,JSON.stringify(temperatures));
  const scoring=await page.evaluate(async()=>{
    const {pullResult,OPTIMAL}=await import('./js/craft/conditions.js');
    return {atCenter:pullResult(.54,2,0).score,atOptimalEdge:pullResult(OPTIMAL[0],2,0).score,atIdealEdge:pullResult(.43,2,3).score,cold:pullResult(.4,2,3).score,
      same:pullResult(.51,2,0).score===pullResult(.51,2,3).score,over:pullResult(.54,5,3).score};
  });
  assert(scoring.atCenter>scoring.atOptimalEdge&&scoring.atOptimalEdge>scoring.atIdealEdge&&scoring.atIdealEdge>scoring.cold);
  assert(scoring.same);assert(scoring.over<scoring.atCenter);
  console.log('[craft focus] PASS: expanded optimal band, real keep controls retain temperature, final ◎ versus ○ follows offered temperature, timing stamps add no score, and tutorial-only Sumi system explanations');

  for (const [name, viewport, mobile] of [
    ['desktop',{width:1280,height:720},false], ['mobile',{width:844,height:390},true], ['portrait',{width:591,height:1280},false],
  ]) {
    const p = await open(viewport, mobile);
    await p.evaluate(async () => {
      T.core.state.stamina = 80; ['nagumo','maezono','dr_kemuri'].forEach(T.core.markMet);
      window.cs = T.session.newSession('tournament'); await T.openBench(cs,{steps}); window.timerRun = T.steps.stepSteamTime(cs);
    });
    await loaded(p);
    for (let i=0;i<8;i++) await p.locator('[data-test="timer-minute-up"]').click();
    await capture(p, `timer-${name}`);
    await p.locator('[data-test="timer-start"]').click(); await p.evaluate(() => window.timerRun);
    await p.evaluate(() => { window.steamRun = T.steam.runSteamDodge(cs); });
    await p.waitForSelector('.dodge');
    const geometry = await p.evaluate(() => {
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const box=rect('.dodge'), pad=rect('.dodge-pad'), scene=rect('.bench'), worker=rect('.bench-worker'), panel=rect('.bench-right'), gallery=rect('.bench-audience'), thermo=rect('.steam-temperature');
      return { padBelow:pad.top>box.bottom, padClear:pad.bottom<scene.bottom-2, separated:worker.right<panel.left, galleryClear:gallery.bottom<scene.bottom, thermometerClear:thermo.right<box.left, fieldClear:box.right<=panel.right, video:document.querySelectorAll('.bench video').length, ticker:document.querySelectorAll('.bench-ticker').length };
    });
    assert.deepEqual(geometry, { padBelow:true,padClear:true,separated:true,galleryClear:true,thermometerClear:true,fieldClear:true,video:0,ticker:0 }, `${name}: ${JSON.stringify(geometry)}`);
    await p.waitForFunction(() => !document.querySelector('[data-test="dodge-refresh"]').disabled);
    const initial = Number(await p.locator('[data-test="steam-temperature"]').getAttribute('aria-valuenow'));
    const calmTrace = await p.locator('.dodge-beat-line').evaluate(n => ({ height:n.getBBox().height, color:getComputedStyle(n).stroke }));
    // #394 keeps the attack explanation in a closed help control outside the dodge field.
    assert(await p.locator('.bench-guide').isVisible(), 'Steam help control disappeared');
    assert.equal(await p.locator('.bench-guide').getAttribute('open'), null, 'Steam help opened during play');
    assert.equal(await p.locator('.dodge-refresh').getAttribute('data-remaining'), '1');
    assert.equal(await p.locator('.bench-title').textContent(), '蒸らし');
    await p.waitForTimeout(1000);
    const samples=[];
    for (let i=0;i<6;i++) { await p.waitForTimeout(450); samples.push(Number(await p.locator('[data-test="steam-temperature"]').getAttribute('aria-valuenow'))); }
    assert(samples.at(-1)>initial, `${name}: temperature failed to rise`);
    assert(samples.every((v,i)=>i===0||v>=samples[i-1]), `${name}: a hit lowered the temperature`);
    await capture(p, `steam-${name}`);
    await p.waitForFunction(() => document.querySelector('[data-test="mental-trace"]').dataset.level === 'shaken',null,{timeout:8000});
    const shaken = await p.locator('.dodge-beat-line').evaluate(n => ({ height:n.getBBox().height, color:getComputedStyle(n).stroke }));
    assert(shaken.height > calmTrace.height * 2, `${name}: heartbeat did not visibly break`);
    assert.notEqual(shaken.color,calmTrace.color);
    assert.equal(await p.locator('.bench-worker').getAttribute('data-mental'),'shaken');
    assert.match(await p.locator('.worker-actor').getAttribute('src'), /surprise/);
    await capture(p, `mental-${name}`);
    // 無敵を付けないので操作前後の別フレームでは被弾し得る。同じ入力イベント内で比較する。
    const refreshed=await p.evaluate(()=>{
      const trace=document.querySelector('[data-test="mental-trace"]'),heat=document.querySelector('[data-test="steam-temperature"]');
      const before={level:trace.dataset.level,misses:trace.dataset.hits,heat:heat.getAttribute('aria-valuenow')};
      document.querySelector('.dodge-refresh').click();
      return {before,after:{level:trace.dataset.level,misses:trace.dataset.hits,heat:heat.getAttribute('aria-valuenow')}};
    });
    assert.deepEqual(refreshed.after,refreshed.before,'Base refresh must not heal or rewind hits/temperature');
    assert(!(await p.locator('[data-test="craft-rating"]').isVisible()),'A hit/refresh showed a mid-game rating');
    assert(!/針|ゲージ|ボタン|ミニゲーム|スコア/.test(await p.locator('[data-test="craft-feedback"]').textContent()));
    await p.waitForSelector('.result-card.show',{timeout:20000});
    assert((await p.evaluate(()=>cs.steam.hits))>0, `${name}: no collision was exercised`);
    await p.locator('[data-test="step-next"]').click(); await p.evaluate(()=>window.steamRun);
    const continuity=await p.evaluate(()=>({end:cs.steam.temp,next:T.pull.startTemp(cs),seconds:cs.steam.seconds}));
    assert.equal(continuity.next,continuity.end); assert.equal(continuity.seconds,480);
    await p.close();
    console.log(`[craft focus] PASS: ${name} timer, rising temperature despite hits, same temperature carry, visible heartbeat/face jolt, base refresh without mental healing, natural live commentary and clear layout`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
