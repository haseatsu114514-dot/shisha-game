// 制作UI・実際のタイマー操作・温度の引継ぎ・集中による吸い出し難易度。
// NODE_PATH=... CHROME_EXECUTABLE_PATH=... node remake/test/craft_focus.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
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
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async () => {
    const core = await import('./js/core/state.js'); core.newGame();
    const session = await import('./js/craft/session.js');
    const steps = await import('./js/craft/steps.js');
    const heat = await import('./js/craft/heat.js');
    const steam = await import('./js/craft/steam.js');
    const pull = await import('./js/craft/pull.js');
    window.T = { core, session, steps, heat, steam, pull };
    window.steps = [['mix','MIX'], ['heat','HEAT'], ['steam','STEAM'], ['pull','PULL']];
  });
  return page;
};
const loaded = page => page.waitForFunction(() => [...document.querySelectorAll('.audience-face img, .worker-actor')].every(i => i.complete && i.naturalWidth));
const capture = async (page, name) => { if (shots) { await page.waitForTimeout(220); await page.screenshot({ path: `${shots}/${name}.png` }); } };
try {
  const page = await open({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.cs = T.session.newSession('tutorial'); T.session.openBench(cs, { steps });
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
  // 秒ボタンは実物の設定同様、50秒の次で秒欄だけを00に戻す。
  for (let i = 0; i < 4; i++) await page.locator('[data-test="timer-second-up"]').click();
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '05:00');
  await page.locator('[data-test="timer-reset"]').click();
  assert.equal(await page.locator('[data-test="timer-display"]').textContent(), '00:00');
  assert(await page.locator('[data-test="timer-start"]').isDisabled());
  for (let i = 0; i < 5; i++) await page.locator('[data-test="timer-minute-up"]').click();
  await page.locator('[data-test="timer-second-up"]').click();
  await page.locator('[data-test="timer-start"]').focus(); await page.keyboard.press('Enter');
  await page.evaluate(() => window.timerRun);
  assert.equal(await page.evaluate(() => cs.steamSeconds), 310);
  console.log('[craft focus] PASS: physical buttons, seven-segment digits, real press counts, second wrap, reset, zero guard and keyboard start at 5:10');

  // 表情は実際の炭焼き結果へ反応し、名前や審査点を勝手に開放しない。
  await page.evaluate(() => { __remake.craftTest.auto = 'good'; window.heatRun = T.heat.runHeat(cs); });
  assert(!(await page.locator('[data-test="craft-rating"]').isVisible()),'Rating appeared during active charcoal work');
  assert.match(await page.locator('[data-test="craft-feedback"]').textContent(), /光ったら押せ/,'Tutorial Sumi did not explain the game controls');
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
  await page.evaluate(() => {
    window.cs = T.session.newSession('tournament'); T.session.openBench(cs, { steps });
    T.session.stepPanel('heat', '炭焼き', 'テスト');
  });
  assert.deepEqual(await page.locator('.audience-person figcaption').allTextContents(), ['？？？']);
  assert.equal(await page.evaluate(() => Object.keys(T.core.state.met).length), 0);
  await page.evaluate(() => {
    ['nagumo','maezono','dr_kemuri'].forEach(T.core.markMet);
    window.cs = T.session.newSession('tournament'); T.session.openBench(cs, { steps });
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
    modes.push(await page.evaluate(mode => {
      window.cs=T.session.newSession(mode); T.session.openBench(cs);
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

  for (const [stamina, health] of [[80,'green'],[40,'yellow'],[20,'red']]) {
    await page.evaluate(stamina => {
      T.core.state.stamina = stamina; window.cs = T.session.newSession('drill'); T.session.openBench(cs);
      T.session.stepPanel('pack','パッキング','詰め方の説明');
    }, stamina);
    assert.equal(await page.locator('.bench-condition').getAttribute('data-health'), health);
    assert.equal(await page.locator('.bench-condition svg').count(), 1);
    assert(!(await page.locator('.bench-condition-tip').isVisible()));
    await page.locator('.bench-condition summary').click();
    assert(await page.locator('.bench-condition-tip').isVisible());
  }

  // 同じ温度から、集中できた場合とミスが多い場合の実際の針移動と成功帯を比較する。
  const focus = [];
  for (const score of [100,0]) {
    await page.evaluate(score => {
      __remake.craftTest.auto = null; T.core.state.stamina = 80;
      window.cs = T.session.newSession('drill'); cs.steam = { score, temp: .31, seconds: 310 }; cs.holes = { total: 24, minimumComplete: true };
      T.session.openBench(cs); window.pullRun = T.pull.runPull(cs);
    }, score);
    const temp = Number(await page.locator('[data-test="pull-temperature"]').getAttribute('aria-valuenow'));
    assert.equal(temp, .31);
    const width = await page.locator('.z-up .pg-just').evaluate(n => n.getBoundingClientRect().width);
    await page.waitForFunction(() => document.querySelector('.pg-needle').style.left !== '');
    const speed = await page.evaluate(async () => {
      const needle = document.querySelector('.pg-needle');
      const x = parseFloat(needle.style.left); await new Promise(r => setTimeout(r,120));
      return parseFloat(needle.style.left) - x;
    });
    focus.push({ width, speed });
    await page.evaluate(() => { __remake.craftTest.auto = 'good'; });
    await page.locator('[data-test="pull-stop"]').click(); await page.locator('[data-test="pull-stop"]').click();
    await page.locator('[data-test="pull-serve"]').click(); await page.evaluate(() => window.pullRun);
  }
  assert(focus[0].width > focus[1].width * 1.35, JSON.stringify(focus));
  assert(focus[0].speed < focus[1].speed * .85, JSON.stringify(focus));
  console.log('[craft focus] PASS: equal carried-over temperature, calmer steam widens the real success band and slows the actual moving needle');

  // 同じ吸い方・回数で、提供温度だけを変える。細い最適温が最高評価となる。
  const temperatures=[];
  for (const temp of [.54,.49]) {
    await page.evaluate(temp => {
      __remake.craftTest.auto=null; window.cs=T.session.newSession('tournament');
      cs.steam={score:100,temp,seconds:480}; cs.holes={total:24,minimumComplete:true};
      T.session.openBench(cs); window.pullRun=T.pull.runPull(cs);
    },temp);
    const band=await page.locator('.thermo-optimal').evaluate(n=>n.getBoundingClientRect().height);
    const safe=await page.locator('.thermo-zone').evaluate(n=>n.getBoundingClientRect().height);
    assert(band < safe * .12,'Optimal temperature band is not sufficiently strict');
    assert(!(await page.locator('[data-test="craft-rating"]').isVisible()));
    await page.waitForFunction(()=>parseFloat(document.querySelector('.pg-needle').style.left)>0);
    // 本物の針が中央へ来た瞬間に、通常の吸う操作を2回行う。温度や結果は書き換えない。
    await page.evaluate(async()=>{
      const needle=document.querySelector('.pg-needle'), button=document.querySelector('[data-test="pull-stop"]');
      for(let i=0;i<2;i++) {
        await new Promise(resolve=>{
          const tick=()=>{
            if(Math.abs(parseFloat(needle.style.left)-50)<1) {button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));resolve();}
            else requestAnimationFrame(tick);
          }; tick();
        });
        if(i===0) await new Promise(resolve=>{
          const leave=()=>Math.abs(parseFloat(needle.style.left)-50)>5?resolve():requestAnimationFrame(leave);leave();
        });
      }
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
    const {pullResult}=await import('./js/craft/conditions.js');
    return {atCenter:pullResult(.54,2,0).score,atOptimalEdge:pullResult(.532,2,0).score,atIdealEdge:pullResult(.46,2,3).score,cold:pullResult(.4,2,3).score,
      same:pullResult(.51,2,0).score===pullResult(.51,2,3).score,over:pullResult(.54,5,3).score};
  });
  assert(scoring.atCenter>scoring.atOptimalEdge&&scoring.atOptimalEdge>scoring.atIdealEdge&&scoring.atIdealEdge>scoring.cold);
  assert(scoring.same);assert(scoring.over<scoring.atCenter);
  console.log('[craft focus] PASS: strict central optimal band, real keep controls retain temperature, final ◎ versus ○ follows offered temperature, timing stamps add no score, and tutorial-only Sumi system explanations');

  for (const [name, viewport, mobile] of [
    ['desktop',{width:1280,height:720},false], ['mobile',{width:844,height:390},true], ['portrait',{width:591,height:1280},false],
  ]) {
    const p = await open(viewport, mobile);
    await p.evaluate(() => {
      T.core.state.stamina = 80; ['nagumo','maezono','dr_kemuri'].forEach(T.core.markMet);
      window.cs = T.session.newSession('tournament'); T.session.openBench(cs,{steps}); window.timerRun = T.steps.stepSteamTime(cs);
    });
    await loaded(p);
    for (let i=0;i<8;i++) await p.locator('[data-test="timer-minute-up"]').click();
    await capture(p, `timer-${name}`);
    await p.locator('[data-test="timer-start"]').click(); await p.evaluate(() => window.timerRun);
    await p.evaluate(() => { window.steamRun = T.steam.runSteamDodge(cs); });
    const geometry = await p.evaluate(() => {
      const rect=s=>document.querySelector(s).getBoundingClientRect();
      const box=rect('.dodge'), pad=rect('.dodge-pad'), ticker=rect('.bench-ticker'), worker=rect('.bench-worker'), panel=rect('.bench-right'), gallery=rect('.bench-audience'), thermo=rect('.steam-temperature');
      return { padBelow:pad.top>box.bottom, padClear:pad.bottom<ticker.top-2, separated:worker.right<panel.left, galleryClear:gallery.bottom<ticker.top, thermometerClear:thermo.right<box.left, fieldClear:box.right<=panel.right, video:document.querySelectorAll('.bench video').length };
    });
    assert.deepEqual(geometry, { padBelow:true,padClear:true,separated:true,galleryClear:true,thermometerClear:true,fieldClear:true,video:0 }, `${name}: ${JSON.stringify(geometry)}`);
    await p.waitForFunction(() => !document.querySelector('[data-test="timer-stop"]').disabled);
    const initial = Number(await p.locator('[data-test="steam-temperature"]').getAttribute('aria-valuenow'));
    const calmTrace = await p.locator('.dodge-beat-line').evaluate(n => ({ height:n.getBBox().height, color:getComputedStyle(n).stroke }));
    // 説明ボタンのSpaceでリフレッシュを消費しない。
    await p.locator('.bench-guide summary').focus(); await p.keyboard.press('Space');
    assert(await p.locator('.bench-guide').evaluate(n => n.open));
    assert.match(await p.locator('.dodge-refresh').textContent(), /×2/);
    await p.locator('.bench-guide summary').click();
    await p.waitForTimeout(1000);
    await p.locator('[data-test="timer-stop"]').click();
    const paused=await p.evaluate(()=>({clock:document.querySelector('[data-test="steam-clock"]').textContent,temp:document.querySelector('[data-test="steam-temperature"]').getAttribute('aria-valuenow'),bullet:document.querySelector('.dodge-object, .dodge-word')?.style.transform}));
    await p.waitForTimeout(350);
    assert.deepEqual(await p.evaluate(()=>({clock:document.querySelector('[data-test="steam-clock"]').textContent,temp:document.querySelector('[data-test="steam-temperature"]').getAttribute('aria-valuenow'),bullet:document.querySelector('.dodge-object, .dodge-word')?.style.transform})), paused);
    assert(await p.locator('.dodge-refresh').isDisabled());
    await capture(p, `steam-paused-${name}`);
    await p.locator('[data-test="timer-stop"]').click();
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
      const trace=document.querySelector('[data-test="mental-trace"]'),hits=document.querySelector('.dodge-hits'),heat=document.querySelector('[data-test="steam-temperature"]');
      const before={level:trace.dataset.level,misses:hits.textContent,heat:heat.getAttribute('aria-valuenow')};
      document.querySelector('.dodge-refresh').click();
      return {before,after:{level:trace.dataset.level,misses:hits.textContent,heat:heat.getAttribute('aria-valuenow')}};
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
    console.log(`[craft focus] PASS: ${name} timer, pause/resume, rising temperature despite hits, same temperature carry, visible heartbeat/face jolt, base refresh without mental healing, natural live commentary and clear layout`);
  }
  assert.deepEqual(errors,[]);
} finally { await browser.close(); }
