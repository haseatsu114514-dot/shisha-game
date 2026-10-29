import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { suite, assertFits } from './support.mjs';
import { travelToCity, stationFares, recordReturnFare } from './station_helpers.mjs';
const evidence = (process.env.COMPARISON_DIR || fileURLToPath(new URL('../../../docs/qa/ch2-daily/', import.meta.url))).replace(/\/?$/, '/');
fs.mkdirSync(evidence, { recursive: true });
const t = name => `[data-test="${name}"]`;
const map = '[data-destination-selection]:not(.done)';
async function setup(page, { money = 36000, unknown = false, reel = false, guest = null, stamina = 100, weatherSeed = 7 } = {}) {
  page.setDefaultTimeout(30000);
  const seeded = await page.evaluate(async ({ money, unknown, reel, guest, stamina, weatherSeed }) => {
    const core = await import('./js/core/state.js');
    const value = core.newGame();
    Object.assign(value, { chapter: 2, phase: 'daily', day: 15, slot: 2, money, stamina, weatherSeed });
    value.flags = { _rei_trpg_introduced: true, _ch1_cleared: true, _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true },
      _ch2_city_visit_c_station: true, _lime_tut: 1, _lime_opened: true,
      _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    value.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    value.flavorStock = { mint: 21.5, double_apple: 6 }; value.keepsakes = ['qa_old_keepsake'];
    value.relationshipMemories = ['qa_old_memory']; value.loverSince = { minto: 10 }; value.lastDate = { minto: 13 };
    value.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true,
      ageha: !unknown, kumicho: !unknown, rei: !unknown, volk: !unknown };
    value.contacts = ['sumi', 'naru'];
    value.reel.installed = reel;
    if (reel) Object.assign(value.reel, { introDone: true, settingGuideDone: true });
    for (const id of ['ageha', 'kumicho', 'rei']) value.flags[`_intro_${id}`] = !unknown;
    if (guest) {
      const { trainPassengers } = await import('./js/motions/train-passengers.js');
      for (let weatherSeed = 0; weatherSeed < 10000; weatherSeed++) {
        if (trainPassengers({ ...value, day: 16, slot: 0, weatherSeed }, { from: 'widehanga', to: 'home' }).cameo === guest) {
          value.weatherSeed = weatherSeed; break;
        }
      }
    }
    core.save();
    for (let i=1;i<=3;i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ ...value, money: 1000+i }));
    window.__remake.vnTest.turbo = true;
    (await import('./js/chapters/ch1.js')).setupHooks();
    window.__dailyTrace = [];
    const vn = await import('./js/vn/engine.js');
    vn.hooks.onLine = (id,line) => {
      if(window.__dailyTrace.at(-1)!==id) window.__dailyTrace.push(id);
    };
    const before = structuredClone(value);
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
    return before;
  }, { money, unknown, reel, guest, stamina, weatherSeed });
  await page.locator(`${t('ch2-morning-home')}, ${t('ch2-main-error')}`).first().waitFor();
  return seeded;
}
async function begin(page) { await page.locator(t('ch2-morning-home')).click(); await page.locator(map).waitFor(); }
async function value(page) { return page.evaluate(() => structuredClone(window.__remake.state)); }
async function settled(page) { await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]')); } // #780: 新ピンの解錠演出中は選択を受け付けない
async function wide(page, touch = false) {
  await travelToCity(page, 'widehanga', { touch });
}
async function go(page, id, touch = false) {
  await settled(page);
  const pin = page.locator(t(`pin-${id}`));
  if(touch) await pin.tap(); else await pin.click();
  await settled(page);
  const button=page.locator(t('map-go'));
  if(touch) await button.tap(); else await button.click();
}
async function act(page,id,{touch=false}={}) {
  const before = await value(page);
  await go(page,id,touch);
  if (id === 'ch2_ageha' && before.flags._ageha_first_purikura) {
    await page.locator(t('purikura-skip')).click();
  }
  await page.waitForFunction(old => window.__remake.state.day > old.day || window.__remake.state.slot > old.slot,
    { day: before.day, slot: before.slot });
  if (before.slot === 1) await page.waitForFunction(day => __remake.state.day > day, before.day);
  const after = await value(page);
  if (after.day > before.day) {
    await page.locator(t('ch2-morning-home')).click();
    recordReturnFare(page, before, await value(page));
  }
  await page.locator(`${map}, ${t('ch2-tournament-entry')}`).first().waitFor();
}
async function reloadSave(page, slot = 0) {
  await page.reload(); await page.locator(t('title-load')).click(); await page.locator(t(`slot-${slot}`)).click();
  await page.locator(`${map}, ${t('ch2-tournament-entry')}`).first().waitFor();
  await page.evaluate(() => { window.__remake.vnTest.turbo = true; });
}
async function capture(page,file) { await page.waitForTimeout(700); await page.screenshot({path:evidence+file}); }

await suite('ch2-daily',async check=>{
  // #1045 B02: DAY8の柚ヶ谷。実際のスポットと地図を使い、画像失敗でも入店できる。
  for (const failImage of [false, true]) await check(`boardgame-preview-${failImage ? 'failed' : 'normal'}`, async page => {
    let imageRequests = 0;
    await page.route('**/assets/backgrounds/bg_yuzugaya_trpg.webp', route => {
      imageRequests++;
      // 意図した通信失敗だけをsupport.mjsのリソース監視から除外する。
      return failImage ? route.abort('aborted') : route.continue();
    });
    const spot = await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const ui = await import('./js/core/ui.js');
      const hud = await import('./js/daily/hud.js');
      const map = await import('./js/daily/map.js');
      const trpg = await import('./js/daily/trpg.js');
      const { MAP } = await import('./js/chapters/ch2-city-data.js');
      const s = core.newGame();
      Object.assign(s, { chapter: 2, phase: 'daily', day: 22, slot: 0, money: 30000 });
      Object.assign(s.flags, { _rei_trpg_introduced: true, _intro_sai: true,
        _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true } });
      hud.initHud({}); hud.showHud(true); await ui.warmUiArt();
      const destination = trpg.trpgSpot();
      window.__b02 = { selected: null, before: JSON.stringify(s) };
      window.__b02.flow = map.chooseSpot({ regionId: 'widehanga', regions: [
        { id: 'widehanga', label: '柚ヶ谷', background: MAP.day, spots: [destination] },
      ] }).then(id => {
        window.__b02.selected = id;
        if (id === 'trpg_bar') return trpg.openTrpgBar();
      });
      return destination;
    });
    await page.locator(t('pin-trpg_bar')).click();
    const preview = page.locator('.map-info .mi-preview');
    await page.waitForFunction(() => {
      const node = document.querySelector('.map-info .mi-preview');
      return node && !node.classList.contains('loading');
    });
    assert(imageRequests > 0, 'プレビュー画像の実リクエストがない');
    assert(await preview.isVisible());
    assert.doesNotMatch(await page.locator('.map-info').innerText(), /画像を表示できませんでした|読込失敗|読み込みに失敗/);
    if (failImage) {
      assert.equal(await preview.innerText(), `${spot.label} — ${spot.area}`);
      assert.match(await preview.getAttribute('aria-label'), /詳細と入店条件/);
      assert.equal(await preview.evaluate(node => getComputedStyle(node).backgroundImage), 'none');
    } else {
      assert.equal(await preview.innerText(), '');
      assert.match(await preview.evaluate(node => getComputedStyle(node).backgroundImage), /bg_yuzugaya_trpg\.webp/);
      assert(await page.evaluate(async url => {
        const image = new Image(); image.src = url;
        await image.decode(); return image.naturalWidth > 0;
      }, spot.previewUrl));
    }
    assert.equal(await page.locator('.map-info .mi-desc').innerText(), spot.desc);
    assert.match(await page.locator('.map-info .mi-tags').innerText(), /入店・部活設立は無料/);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__remake.state)), await page.evaluate(() => __b02.before));
    const enter = page.locator(t('map-go'));
    assert(await enter.isVisible() && await enter.isEnabled());
    await page.screenshot({ path: evidence + `boardgame-preview-${failImage ? 'failed' : 'normal'}.png` });
    await enter.click();
    await page.locator(t('trpg-campaign-close')).waitFor();
    assert.equal(await page.evaluate(() => __b02.selected), 'trpg_bar');
    await page.locator(t('trpg-campaign-close')).click();
    await page.evaluate(() => __b02.flow);
  });
  await check('city-guest-paid-visit-and-reload',async page=>{
    await setup(page,{guest:'ageha'}); await begin(page); await settled(page);
    const guestNames=await page.locator(t('pin-minto')).locator('.pin-person').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('title')));
    assert(guestNames.some(name=>name?.includes('アゲハ')||name?.includes('あげは')), `Missing guest marker: ${guestNames}`);
    const before=await value(page);
    // 通常の初回訪問には有料チェキの選択もある。今回は見送り、基本の一服だけを比較する。
    await page.evaluate(()=>{ window.__remake.vnTest.choose=(_id,choices)=>Math.max(0,choices.indexOf('今日は見送る')); });
    await act(page,'minto');
    const after=await value(page);
    assert((await page.evaluate(()=>window.__dailyTrace)).includes('ch2_city_guest_ageha_first'));
    assert.equal(after.flags._city_guest_seen_ageha,true); assert.equal(after.flags._city_guest_day,'2:16');
    assert.equal(after.money,before.money-3000); assert.equal(after.slot,before.slot+1);
    assert.equal(after.affinity.ageha,before.affinity.ageha);
    await reloadSave(page);
    const loaded=await value(page); assert.equal(loaded.flags._city_guest_seen_ageha,true);
    assert.equal(loaded.flags._city_guest_day,'2:16'); assert.equal(loaded.money,after.money);
  });
  for (const weatherSeed of [0, 4]) await check(`first-night-auto-sleep-once-weather-${weatherSeed}`, async page => {
    const seeded = await setup(page, { stamina: 60, weatherSeed });
    assert.equal(await page.locator(t('ch2-main-next-day')).count(), 0);
    const before = await value(page);
    const preserved = ['trpg', 'contacts', 'met', 'story', 'visits', 'affinity', 'loverSince', 'lastDate', 'relationshipMemories', 'flavorStock'];
    for (const key of preserved) assert.deepEqual(before[key], seeded[key], `Initial sleep changed ${key}`);
    assert.equal(before.day, 16); assert.equal(before.slot, 0); assert.equal(before.stamina, 74);
    assert.equal(before.money, 36000); assert.equal(before.flags._ch2_region, 'home');
    const trace = await page.evaluate(() => window.__dailyTrace);
    assert.equal(trace.filter(id => id === 'remake_homecoming_0').length, 1);
    assert(!trace.includes('__ch2_return_train'), 'Initial delivery route already returned to tonari');
    assert(before.flags._morning_16);
    assert.equal(new Set(before.inbox.map(item => item.id)).size, before.inbox.length);
    assert.equal(await page.evaluate(async () => (await import('./js/daily/weather.js')).isRainy()), weatherSeed === 4);
    assert.match(await page.locator('#bg > .bg-img').last().getAttribute('style'), /bg_home/);
    assert.equal(await page.evaluate(async () => (await import('./js/core/audio.js')).currentBgm()), 'kansetsu_shomei_to_black_coffee');
    await begin(page);
    await page.locator(t('hud-menu')).click(); await page.locator(t('menu-save')).click();
    await page.locator(t('slot-1')).click(); await page.locator(t('confirm-overwrite')).click();
    await page.locator('#modal.show').waitFor({ state: 'hidden' });
    await page.locator(t('hud-menu')).click(); await page.locator(t('menu-load')).click();
    await page.locator(t('slot-1')).click(); await page.locator(t('confirm-load')).click();
    await page.locator(map).waitFor();
    const after = await value(page);
    for (const key of ['day', 'slot', 'stamina', 'money', 'inbox', 'weatherSeed', ...preserved]) assert.deepEqual(after[key], before[key], key);
    assert.equal(after.flags._ch2_region, 'home');
  }, { reducedMotion: 'reduce' });
  await check('next-day-region-switch-and-autosave',async page=>{
    await setup(page,{reel:true}); await begin(page);
    let v=await value(page); assert.equal(v.day,16); assert.equal(v.slot,0); assert.equal(v.stamina,110);
    assert.match(await page.locator('.dc-day').textContent(),/^2\/14$/); assert.match(await page.locator('.dc-row').allTextContents().then(a=>a.join(' ')),/あと12日/);
    await capture(page,'day2-home.png'); await wide(page);
    await assertFits(page,'.spot-pin');
    const overlaps=await page.evaluate(()=>{
      const station=document.querySelector('[data-test="station-open"]').getBoundingClientRect();
      return [...document.querySelectorAll('.spot-pin:not([data-test="station-open"]), .hud-card, .hud-stamina, .hud-level, .hud-lime, .hud-menu, .reel-widget')].map(n=>{
        const r=n.getBoundingClientRect();return {name:n.className,area:Math.max(0,Math.min(station.right,r.right)-Math.max(station.left,r.left))*Math.max(0,Math.min(station.bottom,r.bottom)-Math.max(station.top,r.top))};
      });
    });
    for(const overlap of overlaps)assert(overlap.area<1,`Station covers another control: ${JSON.stringify(overlap)}`);
    // 既存3店舗と用品店、紹介済みTRPGバー。
    assert.equal(await page.locator('.spot-pin[data-test^="pin-ch2_"]').count(),5);
    assert.deepEqual((await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>n.dataset.test))).sort(),
      ['pin-ch2_ageha','pin-ch2_kumicho','pin-ch2_rei','pin-ch2_shop','pin-ch2_c_station','pin-trpg_bar','station-open'].sort());
    await settled(page);await page.locator(t('pin-ch2_rei')).click();
    await page.locator('.mi-preview:not(.loading)').waitFor();
    const preview=await page.locator('.mi-preview').evaluate(async node=>{
      const src=node.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1];
      const image=new Image();image.src=src;await image.decode();return {src,width:image.naturalWidth,height:image.naturalHeight};
    });
    assert.match(preview.src,/bg_ch2_rei_entry.webp/);assert.equal(preview.width,1280);assert.equal(preview.height,720);
    await capture(page,'day2-widehanga.png');
    v=await value(page);assert.equal(v.money,36000-stationFares(page));assert.equal(v.slot,0);assert(Object.values(v.stats).every(n=>n===31));
    await page.locator(t('hud-menu')).click();await page.locator(t('menu-save')).click();
    await page.locator(t('slot-0')).waitFor();
    assert.match(await page.locator(t('slot-0')).textContent(),/第2章\s*DAY 2(?!\d)/);
    assert(!/初日終了/.test(await page.locator(t('slot-0')).textContent()),'DAY2 saves must not keep the DAY1-complete caption');
    await page.locator(t('slot-1')).click();await page.locator(t('confirm-overwrite')).click();
    await page.locator('#modal.show').waitFor({state:'hidden'});
    await reloadSave(page,1);v=await value(page);assert.equal(v.day,16);assert.equal(v.slot,0);assert.equal(v.flags._ch2_region,'widehanga');
    assert.deepEqual(v.flavorStock,{mint:21.5,double_apple:6});assert.deepEqual(v.relationshipMemories,['qa_old_memory']);assert.deepEqual(v.loverSince,{minto:10});
    const slots=await page.evaluate(()=>[1,2,3].map(i=>JSON.parse(localStorage.getItem(`suien_remake_slot${i}`)).money));assert.deepEqual(slots,[36000-stationFares(page),1002,1003]);
  });
  await check('paid-city-talk-repeat-and-contact',async page=>{
    await setup(page);await begin(page);await wide(page);await act(page,'ch2_ageha');
    let v=await value(page);assert.equal(v.money,33000-stationFares(page));assert.equal(v.slot,1);assert.equal(v.stamina,95);
    assert.equal(v.flags._ch2_talks.ageha,1);assert.equal(v.visits.ageha,1);assert(v.contacts.includes('ageha'));
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),157); // 2 normal points, not old 4-point amounts
    await settled(page);await page.locator(t('pin-ch2_ageha')).click();assert.match(await page.locator('.mi-no').textContent(),/今日はもう行った/);
    assert.equal(await page.locator(t('map-go')).count(),0);
    await travelToCity(page,'home');await act(page,'rest');
    v=await value(page);assert.equal(v.day,17);assert.equal(v.slot,0);
    assert.equal(v.inbox.filter(i=>i.id==='lime_ch2_ageha_after_visit').length,1);
    await wide(page);await act(page,'ch2_ageha');v=await value(page);assert.equal(v.money,30000-stationFares(page));assert.equal(v.flags._ch2_talks.ageha,2);
    assert((await page.evaluate(()=>window.__dailyTrace)).includes('remake_ch2_ageha_followup'));
    assert.equal(v.flags._ch2_followup_done.ageha,true);
    await reloadSave(page);v=await value(page);assert.equal(v.day,17);assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.ageha,2);
    await page.evaluate(async()=>{
      window.__dailyTrace=[];
      (await import('./js/vn/engine.js')).hooks.onLine=(id)=>{
        if(window.__dailyTrace.at(-1)!==id)window.__dailyTrace.push(id);
      };
    });
    await travelToCity(page,'home');await act(page,'rest');
    await wide(page);await act(page,'ch2_ageha');v=await value(page);
    assert.equal(v.money,27000-stationFares(page));assert.equal(v.flags._ch2_talks.ageha,3);
    // 続編のあとは、あげはの店に通う回を順に読む（#626）。全部読んだら従来の repeat に戻る
    assert((await page.evaluate(()=>window.__dailyTrace)).includes('remake_ch2_ageha_repeat'));assert(!v.flags._ch2_read_remake_ch2_ageha_gyaru);
  });
  await check('installed-reel-preserves-draw-on-reload',async page=>{
    await setup(page,{reel:true});await begin(page);await wide(page);await act(page,'ch2_rei');
    let v=await value(page);assert(v.reel.count>0);assert.equal(v.reel.lastChapter,2);assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.rei,1);
    const drawn=structuredClone(v); // リプレイで複数回転する場合も、確定した抽選と報酬をそのまま保存する。
    await reloadSave(page);v=await value(page);assert.equal(v.reel.count,drawn.reel.count,'Loading must not reroll the same visit');
    assert.equal(v.money,drawn.money);assert.deepEqual(v.stats,drawn.stats);
    assert.equal(v.slot,1);assert.equal(v.flags._ch2_talks.rei,1);
  });
  await check('touch-three-owners-and-fixed-day3-night',async page=>{
    await setup(page,{unknown:true});await begin(page);await wide(page,true);
    for(const id of ['ageha','kumicho','rei']) {
      if ((await value(page)).flags._ch2_region === 'home') await wide(page, true);
      await act(page,`ch2_${id}`,{touch:true});
    }
    await travelToCity(page,'home',{touch:true}); await act(page,'rest',{touch:true});
    let v=await value(page);assert.equal(v.day,18);assert.equal(v.slot,0);assert.equal(v.money,27000-stationFares(page));
    assert(v.flags._ch2_naru_warm_done);for(const id of ['ageha','kumicho','rei'])assert.equal(v.flags._ch2_talks[id],1);
    const trace=await page.evaluate(()=>window.__dailyTrace);assert.equal(trace.filter(id=>id==='ch2_naru_warm').length,1);
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),161,'Fixed Naru night must not award growth');
    await capture(page,'touch-day4-home.png');await reloadSave(page);v=await value(page);assert.equal(v.day,18);assert.equal(v.money,27000-stationFares(page));
    assert.equal(await page.locator(t('ch2-main-next-day')).count(),0);
  },{viewport:{width:844,height:390},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await check('preparation-json-failure-keeps-day1-and-retries',async page=>{
    let bad=true;await page.route('**/ch2_preparation.json',r=>bad?r.fulfill({status:200,body:'bad json'}):r.continue());
    await setup(page);await page.locator(t('ch2-main-error')).waitFor();
    let v=await value(page);assert.equal(v.day,15);assert.equal(v.slot,2);assert(!v.flags._ch2_preparation_started);
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('suien_remake_save')));assert.equal(saved.day,15);
    bad=false;await page.locator(t('ch2-main-retry')).click();await page.locator(t('ch2-morning-home')).click();await page.locator(map).waitFor();v=await value(page);assert.equal(v.day,16);assert.equal(v.money,36000);
  });
  await check('reload-unread-paid-room-keeps-last-action-point',async page=>{
    await setup(page);await begin(page);await wide(page);
    await page.evaluate(()=>{window.__remake.vnTest.turbo=false;});await go(page,'ch2_kumicho');await page.locator('#vn.active .vn-box').waitFor();
    assert.equal((await value(page)).money,36000-stationFares(page), 'Unread conversations do not charge');
    await reloadSave(page);const v=await value(page);assert.equal(v.day,16);assert.equal(v.slot,0);assert.equal(v.money,36000-stationFares(page));assert.equal(v.flags._ch2_talks?.kumicho,undefined);
    assert.equal(Object.values(v.stats).reduce((a,b)=>a+b,0),155);
    await act(page,'ch2_kumicho');assert.equal((await value(page)).money,33000-stationFares(page));
  });
  await check('unaffordable-city-visit-spends-nothing',async page=>{
    await setup(page,{money:2000});await begin(page);await wide(page);await settled(page);await page.locator(t('pin-ch2_rei')).click();
    assert.match(await page.locator('.mi-no').textContent(),/お金が足りない/);assert.equal(await page.locator(t('map-go')).count(),0);
    const v=await value(page);assert.equal(v.money,2000-stationFares(page));assert.equal(v.slot,0);assert(Object.values(v.stats).every(n=>n===31));
  });
  await check('room-image-failure-preserves-cost-and-action',async page=>{
    let bad=true;await page.route('**/bg_ch2_rei_entry.webp',r=>bad?r.fulfill({status:200,contentType:'image/webp',body:'bad image'}):r.continue());
    await setup(page);await begin(page);await wide(page);await go(page,'ch2_rei');
    await page.locator(map).waitFor();let v=await value(page);assert.equal(v.money,36000-stationFares(page));assert.equal(v.slot,0);assert.equal(v.flags._ch2_talks?.rei,undefined);
    bad=false;await act(page,'ch2_rei');v=await value(page);assert.equal(v.money,33000-stationFares(page));assert.equal(v.slot,1);
  });
  for (const [id, flag, cost, recovery] of [
    ['ch2_aquarium', '_ageha_aquarium_introduced', 1800, 0],
    ['ch2_sento', '_kumicho_sento_introduced', 800, 25],
  ]) await check(`${id}-completion-cost-and-no-stat-reward`, async page => {
    await setup(page);
    await page.evaluate(flag => { __remake.state.flags[flag] = true; }, flag);
    await begin(page); await wide(page);
    const before = await value(page);
    await act(page, id);
    const after = await value(page);
    assert.equal(after.money, before.money - cost);
    assert.equal(after.slot, 1); assert.equal(after.day, before.day);
    assert.deepEqual(after.stats, before.stats);
    assert.equal(after.stamina, Math.min(await page.evaluate(async () => (await import('./js/core/stats.js')).maxStamina()), before.stamina + recovery));
    assert(after.flags[`_ch2_visited_${id}`]);
    await reloadSave(page);
    assert((await value(page)).flags[`_ch2_visited_${id}`]);
  });

  await check('morning-city-choice-and-reserved-return-money', async page => {
    await setup(page, { money: 1950 });
    await page.evaluate(() => { __remake.state.flags._kumicho_sento_introduced = true; });
    await page.locator(t('ch2-morning-city')).waitFor();
    await capture(page, 'morning-city-choice.png');
    assert.equal((await value(page)).flags._ch2_region, 'home');
    await page.locator(t('ch2-morning-city')).click();
    await page.locator('.map[data-region="widehanga"]').waitFor();
    let v = await value(page); assert.equal(v.money, 1750); assert.equal(v.slot, 0);
    await go(page, 'ch2_shop'); await page.locator(t('buy-strawberry')).click();
    await page.locator(t('shop-checkout')).click();
    assert.equal((await value(page)).money, 200);
    await page.locator(t('buy-strawberry')).click();
    assert(await page.locator(t('shop-checkout')).isDisabled(), 'The reserved return fare cannot be spent');
    await page.locator(t('shop-leave')).click(); await page.locator(t('shop-discard-leave')).click(); await page.locator(map).waitFor();
    await settled(page); await page.locator(t('pin-ch2_sento')).click();
    assert.equal(await page.locator(t('map-go')).count(), 0, 'Paid outings cannot use the return fare');
    await reloadSave(page); assert.equal((await value(page)).money, 200);
    assert.equal((await value(page)).flags._ch2_region, 'widehanga');
  });
  await check('city-night-buys-one-return-ticket-and-wakes-at-home', async page => {
    await setup(page, { money: 5000 });
    await page.evaluate(() => Object.assign(__remake.state.flags, { _ageha_aquarium_introduced: true, _kumicho_sento_introduced: true }));
    await page.locator(t('ch2-morning-city')).click();
    await page.locator('.map[data-region="widehanga"]').waitFor();
    await act(page, 'ch2_aquarium');
    await go(page, 'ch2_sento');
    await page.locator(t('ch2-morning-home')).waitFor();
    const v = await value(page);
    assert.equal(v.day, 17); assert.equal(v.slot, 0); assert.equal(v.flags._ch2_region, 'home');
    assert.equal(v.money, 2000, '5000 - outbound 200 - aquarium 1800 - sento 800 - return 200');
    assert.equal((await page.evaluate(() => window.__dailyTrace)).filter(id => id === '__ch2_return_train').length, 1);
    assert(await page.evaluate(() => [...document.querySelectorAll('#bg > div.show')].some(n => n.style.backgroundImage.includes('bg_home'))));
    await page.locator(t('ch2-morning-home')).click(); await page.locator('.map[data-region="home"]').waitFor();
    await reloadSave(page); assert.equal((await value(page)).money, 2000, 'Reload does not buy a second return ticket');
  });
  await check('chapter-two-home-city-shishark-is-visitable', async page => {
    await setup(page); await begin(page);
    await page.locator(t('pin-shishark')).waitFor();
    const before = await value(page);
    await act(page, 'shishark');
    const after = await value(page);
    assert.equal(after.money, before.money - 3000); assert.equal(after.slot, 1);
    assert(after.met.samechan); assert.equal(after.story.samechan, 1);
    assert((await page.evaluate(() => window.__dailyTrace)).includes('samechan_shop_first'));
  });

});
