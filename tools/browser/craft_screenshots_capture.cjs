// 本番の制作モジュールを開き、通常の操作と実描画から画面資料を保存する。
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const out = path.resolve(__dirname, '../../asset_sources/craft-screen-captures/20261009');
const errors = [], shots = [];
const steps = [['concept','方針'],['mix','配合'],['pack','詰め'],['holes','穴あけ'],['heat','炭焼き'],['place','炭配置'],['steam','蒸らし'],['pull','吸い出し'],['care','熱管理'],['trial','審査']];
fs.mkdirSync(out, { recursive:true });

async function scene(browser, step, mode='tournament') {
  const page = await browser.newPage({viewport:{width:1280,height:720}});
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base); await page.waitForSelector('[data-test="title-new"]');
  await page.evaluate(async ({step,mode,steps}) => {
    const core=await import('./js/core/state.js'); core.newGame();
    core.state.stamina=80; core.state.weatherSeed=4;
    ['nagumo','maezono','dr_kemuri'].forEach(core.markMet);
    const session=await import('./js/craft/session.js');
    const selections=await import('./js/craft/steps.js');
    const cs=session.newSession(mode);
    cs.concepts=['aroma','relax']; cs.mix={double_apple:9,mint:3};
    cs.mixInfo=selections.evaluateMix(cs); cs.pack='normal'; cs.place='triangle';
    cs.steamSeconds=step==='timer'?null:320;
    // 工程単体の撮影開始条件。以後の針・温度・採点は本番のロジックで動く。
    if (['pull','care'].includes(step)) cs.steam={temp:.54,hits:0,concentration:1,score:100,min:320/60};
    if (step==='care') cs.pull={temp:.54,score:100,pulls:2,inZone:true};
    const bench=session.openBench(cs,{steps});
    while(!bench.root.isConnected) await new Promise(requestAnimationFrame);
    const choose={concept:'stepConcept',mix:'stepMix',pack:'stepPack',place:'stepPlace',timer:'stepSteamTime'};
    window.captureSession=cs;
    window.captureRun=choose[step] ? selections[choose[step]](cs)
      : (await import(`./js/craft/${step}.js`))[{holes:'runHoles',heat:'runHeat',steam:'runSteamDodge',pull:'runPull',care:'runCare',trial:'runTrial'}[step]](cs);
  },{step,mode,steps});
  await page.waitForSelector('.scene-curtain',{state:'hidden',timeout:20000});
  return page;
}
async function shot(page, file, title, details) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => [...document.querySelectorAll('.bench img')].every(i => i.complete && (i.hidden || i.naturalWidth)));
  await page.waitForSelector('.scene-curtain',{state:'hidden',timeout:20000});
  await page.waitForTimeout(200);
  await page.screenshot({path:path.join(out,file)});
  const ui=await page.evaluate(() => ({step:document.querySelector('.bench-panel').dataset.step,mode:document.querySelector('.bench').dataset.mode,comment:document.querySelector('[data-test="craft-feedback"]')?.textContent,footer:document.querySelectorAll('.bench-ticker').length,transitionOverlays:document.querySelectorAll('.scene-curtain').length}));
  if(ui.footer) throw new Error('旧フッターが残っている');
  if(ui.transitionOverlays) throw new Error('場面切り替えの演出が終わっていない');
  shots.push({file,title,details,...ui,width:1280,height:720});
  console.log(`Saved ${file}: ${title}`);
}
async function pointer(page, selector) {
  await page.locator(selector).evaluate(n=>n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true})));
}
async function pullTwice(page) {
  for(let i=0;i<2;i++) {
    await page.waitForFunction(()=>!document.querySelector('[data-test="pull-stop"]').disabled && Math.abs(parseFloat(document.querySelector('.pg-needle').dataset.pos)-50)<1.5);
    await pointer(page,'[data-test="pull-stop"]');
    await page.waitForFunction(()=>!document.querySelector('.pull-play').dataset.draw && Math.abs(parseFloat(document.querySelector('.pg-needle').dataset.pos)-50)>6);
  }
  await page.waitForTimeout(1200);
}
const escape = s => s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function gallery(browser) {
  const tiles=shots.map(s=>`<a class="tile" href="${s.file}"><img src="${s.file}" alt="${escape(s.title)}"><strong>${escape(s.title)}</strong><small>${escape(s.details)}</small></a>`).join('');
  fs.writeFileSync(path.join(out,'gallery.html'),`<!doctype html><html lang="ja"><meta charset="utf-8"><title>シーシャ制作画面のスクリーンショット</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#141119;color:#eee;font-family:system-ui,sans-serif}h1{font-size:26px;margin:0 0 8px}p{color:#c3bcc9;margin:0 0 24px}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}.tile{display:block;background:#211b29;border:1px solid #ffffff20;border-radius:10px;overflow:hidden;color:inherit;text-decoration:none}.tile img{width:100%;display:block}.tile strong,.tile small{display:block;padding:10px 12px}.tile small{padding-top:0;color:#c3bcc9}@media(max-width:800px){main{grid-template-columns:1fr}}</style><h1>シーシャ制作画面</h1><p>最新版mainの実画面。画像をクリックすると1280×720の原寸PNGを開きます。</p><main>${tiles}</main></html>`);
  const page=await browser.newPage({viewport:{width:1328,height:1400},deviceScaleFactor:1});
  await page.goto(new URL('../asset_sources/craft-screen-captures/20261009/gallery.html',base).href);
  await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
  // 一覧もHTMLに表示したスクショをそのまま撮影。元PNGには文字を重ねない。
  for(const [file,indices] of [['overview-gauges.png',[1,5,6,10,11,13]],['overview-details.png',[3,8,9,7,14,15]]]) {
    await page.evaluate(({indices,file})=>{
      document.querySelectorAll('.tile').forEach((n,i)=>n.style.display=indices.includes(i)?'block':'none');
      document.querySelector('h1').textContent=file==='overview-gauges.png'?'シーシャ制作：ゲージとミニゲーム':'シーシャ制作：設定・結果・審査';
    },{indices,file});
    await page.screenshot({path:path.join(out,file),fullPage:true});
  }
  await page.close();
}
async function main() {
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE_PATH||'/usr/bin/chromium'});
  try {
    let page=await scene(browser,'concept');
    await page.click('[data-test="concept-aroma"]'); await page.click('[data-test="concept-relax"]');
    await shot(page,'01-concept.png','01 コンセプト選択','香り重視・リラックスの2つを選んだ画面'); await page.close();
    page=await scene(browser,'mix');
    for(const [id,n] of [['double_apple',9],['mint',3]]) for(let i=0;i<n;i++) await page.click(`[data-test="mix-plus-${id}"]`);
    await shot(page,'02-mix.png','02 フレーバー配合','グラム数・ボウル内の配合表示・課題フレーバー'); await page.close();
    page=await scene(browser,'pack'); await shot(page,'03-pack.png','03 パッキング','ふんわり・ノーマル・かための選択'); await page.close();
    page=await scene(browser,'holes');
    await shot(page,'04-holes-template-outer24.png','04 外周24穴のテンプレート','穴の配置プレビューと熱への説明');
    await page.click('[data-test="hole-template-outer12-middle12"]');
    await shot(page,'05-holes-template-outer12-middle12.png','05 外周12＋中周12穴のテンプレート','2周の配置プレビューと熱への説明');
    await page.click('[data-test="hole-start"]');
    await page.waitForFunction(()=>!!document.querySelector('.hr-time-bar b')?.style.width);
    await page.click('[data-test="hole-punch"]'); await page.waitForTimeout(1200);
    await shot(page,'06-holes-game.png','06 穴あけゲーム','円周を動く光・穴の目印・残り時間・穴数'); await page.close();
    page=await scene(browser,'heat');
    await page.waitForFunction(()=>document.querySelector('[data-test="coal-0"]')?.dataset.phase==='just',null,{timeout:18000});
    await pointer(page,'[data-test="coal-0"]'); await page.waitForTimeout(1200);
    await shot(page,'07-heat-game.png','07 炭焼き中','炭の焼け方と、取り出した炭の秒数誤差');
    await pointer(page,'[data-test="coal-1"]'); await pointer(page,'[data-test="coal-2"]');
    await page.waitForSelector('.result-card.show');
    await shot(page,'08-heat-result.png','08 炭焼き結果','3個それぞれの評価・誤差と全体のタイミング精度'); await page.close();
    page=await scene(browser,'place'); await shot(page,'09-coal-place.png','09 炭の配置','トライアングル・炭4個の選択'); await page.close();
    page=await scene(browser,'timer');
    for(let i=0;i<5;i++) await page.click('[data-test="timer-minute-up"]');
    for(let i=0;i<2;i++) await page.click('[data-test="timer-second-up"]');
    await shot(page,'10-steam-timer.png','10 蒸らし時間設定','キッチンタイマーを5分20秒に設定'); await page.close();
    page=await scene(browser,'steam');
    await page.waitForSelector('[data-test="timer-stop"]:not([disabled])'); await page.waitForTimeout(4300);
    await shot(page,'11-steam-game.png','11 蒸らし・雑念弾幕','温度計・タイマー・心拍線・移動パッド・リフレッシュ'); await page.close();
    page=await scene(browser,'pull');
    await page.waitForSelector('[data-test="pull-stop"]:not([disabled])'); await pullTwice(page);
    await shot(page,'12-pull-game.png','12 吸い出し','温度計・最適温・上げ吸い／キープ／下げ吸いのゲージ');
    await page.click('[data-test="pull-serve"]'); await page.waitForSelector('.result-card.show');
    await shot(page,'13-pull-result.png','13 吸い出し結果','提供後の工程評価とコメント'); await page.close();
    page=await scene(browser,'care'); await page.click('[data-test="care-rotate"]');
    await page.waitForFunction(()=>document.querySelector('.care-round')?.textContent.startsWith('2'));
    await page.waitForTimeout(900);
    await shot(page,'14-heat-care.png','14 提供後の熱管理','熱の履歴グラフと炭を外す／回す／寄せる／見守る'); await page.close();
    page=await scene(browser,'trial');
    await shot(page,'15-flavor-trial.png','15 審査・FLAVOR TRIAL','納得ゲージ・審査員の問い・アピールポイント'); await page.close();
    page=await scene(browser,'pull','drill');
    await page.waitForSelector('[data-test="pull-stop"]:not([disabled])'); await pullTwice(page);
    await shot(page,'16-practice-pull.png','16 自主練の吸い出し','同じゲージに、左下ははじめの心の声'); await page.close();
    if(errors.length) throw new Error(errors.join('\n'));
    await gallery(browser);
    fs.writeFileSync(path.join(out,'capture-validation.json'),JSON.stringify({base,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),shots,browserErrors:errors,gameSourcesModified:false,notes:'工程ごとの開始状態を撮影用セッションに用意。本番モジュールを通常の操作で描画し、画面・ゲージ・誤差・採点の文字は差し替えていない。'},null,2)+'\n');
    console.log('Saved sixteen original screenshots, two overview boards and a clickable gallery');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
