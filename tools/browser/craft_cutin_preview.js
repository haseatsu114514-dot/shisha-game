(() => {
  const frame = document.querySelector('#game'), play = document.querySelector('#play'), hold = document.querySelector('#hold');
  const step = document.querySelector('#step'), variant = document.querySelector('#variant'), status = document.querySelector('#status');
  const mode = document.querySelector('#mode');
  const assets = new URL('../../asset_sources/craft-success-cutins/placements-v2-20261008/', location.href);
  const requested = new URL(location.href).searchParams.get('game');
  const gameUrl = new URL(requested || '../../remake/', location.href);
  if (gameUrl.origin !== location.origin) throw new Error('比較用ゲームは同じoriginのURLで開いてください');
  let instance = null, busy = false, bootId = 0;
  const notes = {
    pair: '<b>A：操作中も使える案。</b> 左の作業風景の下だけに2コマを表示。約0.74秒。ゲームは進み続けます。',
    peek: '<b>B：控えめな案。</b> 左端から顔のコマだけを少し見せる。約0.62秒。ゲームは進み続けます。',
    window: '<b>C：工程完了に向く案。</b> 左の作業風景を約0.96秒だけ漫画に切替。実況・体調表示・右の操作領域は残ります。',
    full: '<b>D：派手な大成功の案。</b> 全画面へ約1.1秒。演出中は炭・針・弾幕の時刻を止め、新しい入力も止めます。終わると続きから再開します。',
  };
  const updateNote = () => { document.querySelector('#note').innerHTML = notes[variant.value]; };
  function cutin(holdStill) {
    if (!instance || busy) return;
    instance.effect.hide();
    instance.effect.show(variant.value, { hold: holdStill });
    hold.textContent = holdStill ? '静止表示を戻す' : '静止で比較';
  }
  async function open() {
    const id = ++bootId; busy = true; instance?.effect.destroy(); instance = null; window.cutinDemo = null;
    play.disabled = hold.disabled = true; hold.textContent = '静止で比較'; status.textContent = '画面を準備しています';
    frame.src = gameUrl.href;
    await new Promise(resolve => { frame.onload = resolve; });
    if (id !== bootId) return;
    const w = frame.contentWindow;
    await new Promise(resolve => {
      const poll = () => w.document.querySelector('[data-test="title-new"]') ? resolve() : setTimeout(poll, 30);
      poll();
    });
    await new Promise((resolve, reject) => {
      const script = w.document.createElement('script'); script.src = new URL('placement.js', assets);
      script.onload = resolve; script.onerror = reject; w.document.head.append(script);
    });
    await w.CraftCutinPreview.ready;
    const clock = w.CraftCutinPreview.installClock(w);
    w.__cutinStep = step.value;
    w.__cutinMode = mode.value;
    w.__cutinModulesBase = new URL('js/', gameUrl).href;
    await w.eval(`(async () => {
      const core = await import(window.__cutinModulesBase + 'core/state.js'); core.newGame();
      const session = await import(window.__cutinModulesBase + 'craft/session.js');
      const cs = session.newSession(window.__cutinMode);
      cs.steamSeconds = 300; cs.place = 'triangle';
      if (window.__cutinStep !== 'heat') cs.heat = {heatPower:10, just:1};
      if (window.__cutinStep === 'pull') cs.steam = {temp:.55, hits:0, concentration:1};
      const bench = session.openBench(cs);
      while (!bench.root.isConnected) await new Promise(requestAnimationFrame);
      const modules = {heat:['heat','runHeat'], holes:['holes','runHoles'], steam:['steam','runSteamDodge'], pull:['pull','runPull']};
      const [file, entry] = modules[window.__cutinStep];
      const module = await import(window.__cutinModulesBase + 'craft/' + file + '.js');
      window.__cutinSession = cs; window.__cutinRun = module[entry](cs);
    })()`);
    if (id !== bootId) return;
    const host = w.document.querySelector('.bench-worker-stage');
    const effect = w.CraftCutinPreview.create(host, { onPause: () => clock.pause(), onResume: () => clock.resume() });
    instance = { window:w, clock, effect }; window.cutinDemo = instance;
    busy = false; play.disabled = hold.disabled = false;
  }
  variant.addEventListener('change', () => { instance?.effect.hide(); hold.textContent = '静止で比較'; updateNote(); });
  play.addEventListener('click', () => cutin(false));
  hold.addEventListener('click', () => {
    if (instance?.effect.active) { instance.effect.hide(); hold.textContent = '静止で比較'; }
    else cutin(true);
  });
  step.addEventListener('change', () => { open().catch(report); });
  mode.addEventListener('change', () => { open().catch(report); });
  document.querySelector('#restart').addEventListener('click', () => { open().catch(report); });
  function report(error) { status.textContent = 'プレビューを開けませんでした：' + error.message; console.error(error); }
  setInterval(() => {
    if (!instance || busy) return;
    status.textContent = instance.clock.paused ? '演出中：ゲーム時間を一時停止' : 'ゲーム時間は進行中';
    if (!instance.effect.active) hold.textContent = '静止で比較';
  }, 100);
  updateNote(); open().catch(report);
})();
