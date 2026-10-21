// Production DAY4–13 calendar: real rest inputs, story checkpoints, reload and failure recovery.
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
const t = id => `[data-test="${id}"]`;
const map = '[data-destination-selection]:not(.done)';
const end = t('ch2-tournament-entry');
async function seed(page, { day = 4, slot = 0, pause = '', legacyVolk = false, sick = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async opts => {
    const core = await import('./js/core/state.js');
    const s = core.newGame();
    Object.assign(s, { chapter: 2, phase: 'daily', day: 14 + opts.day, slot: opts.slot,
      money: 36000, stamina: opts.sick ? 10 : 100, weatherSeed: 7 });
    s.flags = { _ch1_cleared: true, _elapsed_calendar: true,
      _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true }, _ch2_preparation_started: true,
      _ch2_naru_warm_done: true, _ch2_city_visit_c_station: true,
      _lime_opened: true, _lime_tut: 1, _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    if (opts.day <= 3) delete s.flags._ch2_naru_warm_done;
    s.owned.push('home_rig_set'); // 第1章DAY7で受け取り済みの現行保存
    s.met = { hajime: true, sumi: true, naru: true, adam: true, minto: true, tsumugi: true };
    for (const id of Object.keys(s.met)) s.flags[`_intro_${id}`] = true;
    s.contacts = opts.day <= 3 ? ['sumi'] : []; s.stats = { technique: 31, sense: 31, guts: 31, charm: 31, insight: 31 };
    s.relationshipMemories = ['tsumugi_creature']; s.keepsakes = ['qa_old_keepsake'];
    s.flavorStock = { mint: 21.5 }; s.affinity = { tsumugi: 15, minto: 20, naru: 30, adam: 25 };
    s.lovers = ['minto']; s.loverSince = { minto: 10 }; s.lastDate = { minto: 16 };
    if (opts.legacyVolk) {
      s.met.volk = true; s.affinity.volk = 12; s.flags._ch2_city_visit_volk = true;
      s.flags._ch2_city_inside_volk = true; s.flags._ch2_talks = { volk: 2 }; s.visits.volk = 2;
    }
    // Later isolated fixtures explicitly describe prior completed nights; the end-to-end case starts at DAY4.
    if (opts.day > 4) s.flags._ch2_read_ch2_sofa_burn = true;
    if (opts.day > 5) s.flags._ch2_taste_distant = true;
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    window.__storyTrace = []; window.__storyTexts = []; window.__pauseStory = opts.pause;
    const vn = await import('./js/vn/engine.js');
    (await import('./js/chapters/ch1.js')).setupHooks();
    vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
    vn.hooks.onLine = (id, line) => {
      if (window.__storyTrace.at(-1) !== id) window.__storyTrace.push(id);
      if (line.text) window.__storyTexts.push(line.text);
      if (id === window.__pauseStory) { window.__pauseStory = ''; vn.vnTest.turbo = false; }
    };
    void (await import('./js/chapters/ch2.js')).resumeChapterTwo();
  }, { day, slot, pause, legacyVolk, sick });
}
async function state(page) { return page.evaluate(() => structuredClone(window.__remake.state)); }
async function atMap(page, day, slot) {
  await page.waitForFunction(([day, slot]) => window.__remake.state.day === day + 14
    && window.__remake.state.slot === slot && document.querySelector('[data-destination-selection]:not(.done)')
    && !document.querySelector('#modal.show'), [day, slot]);
}
async function rest(page, touch = false) {
  await page.locator(`${map}:not([data-revealing="true"])`).waitFor(); // #796: 新ピンの解錠演出中は選択を受け付けない
  const before = await state(page);
  const click = sel => touch ? page.locator(sel).tap() : page.locator(sel).click();
  await click(t('pin-rest')); await click(t('map-go'));
  await page.waitForFunction(v => window.__remake.state.day > v.day || window.__remake.state.slot > v.slot, before);
  await page.locator(`${map}, ${end}`).first().waitFor();
}
async function reload(page) {
  await page.reload(); await page.locator(t('title-load')).click();
  await page.evaluate(() => {
    window.__storyTrace = []; window.__storyTexts = [];
    window.__remake.vnTest.turbo = true;
    window.__remake.vnTest.choose = () => 0;
  });
  await page.locator(t('slot-0')).click();
}
await suite('ch2-story', async check => {
  await check('day2-free-night-then-day3-naru-and-ageha-once', async page => {
    await seed(page, { day: 2 }); await atMap(page, 2, 0);
    const before = await state(page);
    await rest(page); await atMap(page, 2, 1); await rest(page); await atMap(page, 3, 0);
    assert(!await page.evaluate(() => __storyTrace.includes('remake_ch2_ageha_scout')), 'DAY2 must remain a free night');
    await rest(page); await atMap(page, 3, 1); await rest(page); await atMap(page, 4, 0);
    const after = await state(page);
    assert(after.flags._ch2_read_ch2_naru_warm && after.flags._ch2_read_remake_ch2_ageha_scout);
    assert(after.contacts.includes('ageha'));
    const scenes = await page.evaluate(() => __storyTrace.filter(id => ['ch2_naru_warm', 'remake_ch2_ageha_scout'].includes(id)));
    assert.deepEqual(scenes, ['ch2_naru_warm', 'remake_ch2_ageha_scout']);
    for (const key of ['money', 'stats', 'statXp', 'owned', 'equip', 'flavorStock']) assert.deepEqual(after[key], before[key], key);
    await reload(page); await atMap(page, 4, 0);
    const loaded = await state(page);
    for (const key of ['money', 'stats', 'statXp', 'owned', 'equip', 'flavorStock', 'contacts']) assert.deepEqual(loaded[key], after[key], key);
    assert(!await page.evaluate(() => __storyTrace.some(id => ['ch2_naru_warm', 'remake_ch2_ageha_scout'].includes(id))), 'LOAD must not replay completed DAY3 scenes');
  }, { reducedMotion: 'reduce' });
  await check('day4-through-eve-actual-calendar-and-preserved-relationships', async page => {
    await seed(page); await atMap(page, 4, 0);
    const before = await state(page);
    for (let day = 4; day <= 13; day++) {
      await rest(page); await atMap(page, day, 1); await rest(page);
      if (day < 13) await atMap(page, day + 1, 0);
    }
    await page.locator(end).waitFor(); const s = await state(page);
    assert.equal(s.day, 28); assert.equal(s.slot, 0); assert.equal(s.chapter, 2);
    assert.equal(s.money, before.money); assert.deepEqual(s.stats, before.stats); assert.equal(s.reel.count, before.reel.count);
    for (const key of ['lovers','loverSince','lastDate','affinity','flavorStock','keepsakes','relationshipMemories']) assert.deepEqual(s[key], before[key], key);
    assert(s.flags._ch2_taste_distant); assert(s.flags._ch2_eve_done); assert(!s.flags.ch2_taste_recovered);
    assert(s.met.ageha); assert(!s.contacts.includes('ageha')); assert(!s.visits.ageha); assert(!s.met.volk);
    const trace = await page.evaluate(() => window.__storyTrace);
    const expected = ['ch2_sofa_burn','ch2_abyss_baito','ch2_slump_taste','ch2_lingering_smell','ch2_adam_distance',
      'ch2_sumi_silence','ch2_naru_confrontation','ch2_minto_warning','ch2_tsumugi_color','remake_ch2_eve_arrival','ch2_pre_tournament_realisation'];
    assert.deepEqual(trace.filter(id => expected.includes(id)), expected);
    const texts = await page.evaluate(() => window.__storyTexts.join('\n'));
    assert(!/ヴォルク|組長の|鉄の煙/.test(texts));
    assert(!trace.includes('ch2_empty_victory')); assert(!trace.includes('ch2_rivals_first_sight'));
    await assertFits(page, '.ch2-contest .btn');
    await reload(page); await page.locator(end).waitFor();
    const loaded = await state(page); assert.equal(loaded.day, 28); assert.deepEqual(loaded.stats, s.stats); assert.equal(loaded.money, s.money);
  }, { reducedMotion: 'reduce' });
  await check('accident-checkpoint-reloads-after-burn-before-aftermath', async page => {
    await seed(page, { day: 4, slot: 2, pause: 'ch2_abyss_baito' });
    await page.waitForFunction(() => window.__storyTrace.includes('ch2_abyss_baito'));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('suien_remake_save')));
    assert(saved.flags._ch2_read_ch2_sofa_burn); assert(!saved.flags._ch2_read_ch2_abyss_baito); assert(!saved.flags._ch2_night_4_done);
    await reload(page); await atMap(page, 5, 0);
    const s = await state(page); assert(s.flags._ch2_read_ch2_abyss_baito); assert(s.flags._ch2_night_4_done); assert.equal(s.money, 36000);
    const log = await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().map(l => l.text).join('\n'));
    assert(!log.includes('──炭を、落とした。')); assert(log.includes('同じ夜'));
  });
  await check('full-rest-still-reads-fixed-accident-without-payment', async page => {
    await seed(page, { sick: true }); await atMap(page, 4, 0);
    await page.locator(t('pin-rest')).tap(); await page.locator(t('map-go')).tap();
    await page.locator(t('rest-full')).waitFor(); assert.match(await page.locator('.rest-modal').textContent(), /焦げたソファ/);
    await page.locator(t('rest-full')).tap(); await atMap(page, 5, 0);
    const s = await state(page); assert(s.flags._ch2_night_4_done); assert.equal(s.money, 36000); assert(Object.values(s.stats).every(n => n === 31));
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await check('eve-checkpoint-and-night-map-failure-retry', async page => {
    let bad = true;
    await page.route('**/bg_widehanga_map_night.webp', r => bad ? r.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid' }) : r.continue());
    await seed(page, { day: 13, slot: 2 }); await page.locator(t('ch2-main-error')).waitFor();
    let s = await state(page); assert.equal(s.day, 27); assert(s.flags._ch2_read_ch2_tsumugi_color);
    assert(!s.flags._ch2_eve_done); assert(!s.met.ageha);
    bad = false; await page.locator(t('ch2-main-retry')).click(); await page.locator(end).waitFor();
    s = await state(page); assert.equal(s.day, 28); assert(s.flags._ch2_eve_done); assert(s.met.ageha);
    const trace = await page.evaluate(() => window.__storyTrace);
    assert.equal(trace.filter(id => id === 'ch2_tsumugi_color').length, 1);
    assert.equal(s.money, 36000); assert(Object.values(s.stats).every(n => n === 31));
  });
  await check('missing-late-dialogue-retries-without-changing-save', async page => {
    let bad = true;
    await page.route('**/ch2_main.json', async r => {
      if (!bad) return r.continue();
      const response = await r.fetch(); const body = await response.json();
      body.dialogues = body.dialogues.filter(d => d.dialogue_id !== 'ch2_sumi_silence');
      await r.fulfill({ response, json: body });
    });
    await seed(page); await page.locator(t('ch2-main-error')).waitFor();
    const before = await state(page); assert.equal(before.day, 18); assert.equal(before.slot, 0); assert(!before.flags._ch2_night_4_done);
    bad = false; await page.locator(t('ch2-main-retry')).click(); await atMap(page, 4, 0);
    const s = await state(page); assert.equal(s.money, before.money); assert.deepEqual(s.stats, before.stats);
  });
  await check('legacy-volk-records-kept-without-chapter2-entrance', async page => {
    await seed(page, { legacyVolk: true }); await atMap(page, 4, 0);
    await page.locator(t('map-region-widehanga')).click();
    assert.equal(await page.locator('.spot-pin[data-test^="pin-ch2_"]').count(), 3);
    assert.deepEqual((await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>n.dataset.test))).sort(),
      ['pin-ch2_ageha','pin-ch2_kumicho','pin-ch2_rei','pin-trpg_bar'].sort());
    assert.equal(await page.locator(t('pin-ch2_volk')).count(), 0);
    const logos = await page.locator('.store-logo img').evaluateAll(async imgs => {
      await Promise.all(imgs.map(i => i.decode())); return imgs.map(i => i.naturalWidth);
    }); assert.deepEqual(logos, [768,768,768]);
    await reload(page); await page.locator(map).waitFor();
    const s = await state(page); assert.equal(s.visits.volk, 2); assert.equal(s.affinity.volk, 12); assert(s.met.volk);
    assert.equal(await page.locator(t('pin-ch2_volk')).count(), 0);
  });
});
