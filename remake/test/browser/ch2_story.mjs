// Production DAY4–13 calendar: real rest inputs, story checkpoints, reload and failure recovery.
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';
import { travelToCity } from './station_helpers.mjs';
const t = id => `[data-test="${id}"]`;
const map = '[data-destination-selection]:not(.done)';
const end = t('ch2-tournament-entry');
// DAY9 試煙会で一度だけ渡す苺の試供品（ch2-strawberry-trial.js の STRAWBERRY_SAMPLE、#1650）。まかないで試さなければ残る
const withStrawberrySample = stock => ({ ...stock, afsahr_strawberry: (stock.afsahr_strawberry || 0) + 12 });
// 大会の朝・夜のスマホは複数のトークが並ぶ。返信を選びながら「スマホを閉じる」まで読む（#1653 ⑦）。
async function readPhone(page) {
  for (;;) {
    await page.locator(`${t('phone-next')}, ${t('reply-0')}`).first().waitFor();
    if (await page.locator(t('reply-0')).count()) { await page.locator(t('reply-0')).first().click(); await page.locator(t('phone-next')).waitFor(); continue; }
    const last = (await page.locator(t('phone-next')).first().innerText()).includes('閉じる');
    await page.locator(t('phone-next')).first().click();
    if (last) return;
    await page.locator(t('phone-next')).first().waitFor({ state: 'detached' });
  }
}
async function seed(page, { day = 4, slot = 0, pause = '', legacyVolk = false, sick = false } = {}) {
  page.setDefaultTimeout(30000);
  await page.evaluate(async opts => {
    const core = await import('./js/core/state.js');
    const s = core.newGame();
    // 固定ストーリーの検証中は任意のシフト誘いを発生させない。
    Object.assign(s, { chapter: 2, phase: 'daily', day: 14 + opts.day, slot: opts.slot,
      money: 36000, stamina: opts.sick ? 10 : 100, weatherSeed: 7, lastBaitoDay: 28 });
    s.flags = { _ch1_cleared: true, _elapsed_calendar: true,
      _ch2_day1: { startDay: 15, stage: 'complete', titleSeen: true }, _ch2_preparation_started: true,
      _ch2_naru_warm_done: true, _ch2_city_visit_c_station: true,
      _lime_opened: true, _lime_tut: 1, _hiyori_meeting_done: true, _hiyori_message_delivered: true };
    if (opts.slot === 2) s.flags._ch2_morning_departed = s.day; // 夜の途中から再開する保存
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
  await page.locator(`${map}, ${t('ch2-morning-home')}`).first().waitFor();
  if (await page.locator(t('ch2-morning-home')).isVisible()) await page.locator(t('ch2-morning-home')).click();
  await page.waitForFunction(([day, slot]) => window.__remake.state.day === day + 14
    && window.__remake.state.slot === slot && document.querySelector('[data-destination-selection]:not(.done)')
    && !document.querySelector('#modal.show') && !document.querySelector('.map[data-revealing="true"]'), [day, slot]); // #780: 新ピンの解錠演出中は選択を受け付けない
}
async function rest(page, touch = false) {
  const before = await state(page);
  const click = sel => touch ? page.locator(sel).tap() : page.locator(sel).click();
  await page.waitForFunction(() => !document.querySelector('.map[data-revealing="true"]')); // #780: 新ピンの解錠演出中は選択を受け付けない
  await click(t('pin-rest')); await click(t('map-go'));
  await page.waitForFunction(v => window.__remake.state.day > v.day || window.__remake.state.slot > v.slot, before);
  await page.locator(`${map}, ${end}, ${t('ch2-morning-home')}`).first().waitFor();
  if (await page.locator(t('ch2-morning-home')).isVisible()) await page.locator(t('ch2-morning-home')).click();
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
  for (const touch of [false, true]) await check(`day9-yuzugaya-tasting-night-${touch ? 'touch' : 'pc'}`, async page => {
    await seed(page, { day: 9, slot: 2, pause: 'remake_ch2_ageha_tasting' });
    await page.waitForFunction(() => window.__storyTrace.includes('remake_ch2_ageha_tasting'));
    await page.locator('#vn.active .vn-box').waitFor();
    const bg = await page.locator('#bg > .bg-img').last().evaluate(async node => {
      const image = new Image();
      image.src = node.style.backgroundImage.slice(5, -2);
      await image.decode();
      return { url: image.src, width: image.naturalWidth, height: image.naturalHeight };
    });
    assert(bg.url.endsWith('/assets/backgrounds/bg_yuzugaya_c_station_night.webp'), bg.url);
    assert.equal(bg.width, 1280); assert.equal(bg.height, 720);
    await assertFits(page, '#vn.active .vn-box');
    await page.screenshot({ path: `${process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser'}/ch2-story-day9-night-${touch ? 'touch' : 'pc'}-conversation.png` });
    // 未完読の保存から実LOADし、試煙会を完了して翌朝へ。追加の費用・在庫付与はない。
    const before = await state(page);
    await reload(page); await atMap(page, 10, 0);
    const after = await state(page);
    assert(after.flags._ch2_read_remake_ch2_ageha_tasting && after.flags._ch2_night_9_done);
    for (const key of ['money', 'owned']) assert.deepEqual(after[key], before[key], key);
    assert.deepEqual(after.flavorStock, withStrawberrySample(before.flavorStock), 'flavorStock'); // 試煙会の試供品だけ増える（#1650）
    await reload(page); await atMap(page, 10, 0);
    assert(!await page.evaluate(() => __storyTrace.includes('remake_ch2_ageha_tasting')), '既読の試煙会を再生しない');
  }, { viewport: touch ? { width: 844, height: 390 } : { width: 1280, height: 720 }, isMobile: touch, hasTouch: touch, reducedMotion: 'reduce' });
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
    for (const key of ['lovers','loverSince','lastDate','affinity','keepsakes','relationshipMemories']) assert.deepEqual(s[key], before[key], key);
    assert.deepEqual(s.flavorStock, withStrawberrySample(before.flavorStock), 'flavorStock');
    assert(s.flags._ch2_taste_distant); assert(s.flags._ch2_eve_done); assert(!s.flags.ch2_taste_recovered);
    assert(s.met.ageha); assert(!s.contacts.includes('ageha')); assert(!s.visits.ageha); assert(!s.met.volk);
    const trace = await page.evaluate(() => window.__storyTrace);
    const expected = ['ch2_sofa_burn','ch2_abyss_baito','ch2_kumicho_greeting','ch2_slump_taste','ch2_lingering_smell','ch2_adam_distance',
      'remake_ch2_ageha_tasting','ch2_sumi_silence','ch2_naru_confrontation','ch2_minto_warning','ch2_naru_window','ch2_tsumugi_color',
      'remake_ch2_eve_arrival','remake_ch2_eve_rei','ch2_pre_tournament_realisation'];
    assert.deepEqual(trace.filter(id => expected.includes(id)), expected);
    const texts = await page.evaluate(() => window.__storyTexts.join('\n'));
    assert(!/ヴォルク|組長の|鉄の煙/.test(texts));
    // #929: DAY9はC.STATION柚ヶ谷店のアフサール新作試煙会。未対面の神崎・REIはそこで名乗り、面識が残る
    assert.match(texts, /アフサール新作 先行試煙会/); assert(!/店長同士の試飲会/.test(texts));
    assert(s.met.kumicho && s.met.rei); assert(s.flags._ch2_afsahr_tasting);
    assert(s.flags._ch2_scout_seen && !s.met.volk); // #929: 名乗らない偵察の男を見た記録だけ残す
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
    assert(!log.includes('炭を、落とした。')); assert(log.includes('同じ夜'));
  });
  await check('full-rest-still-reads-fixed-accident-without-payment', async page => {
    await seed(page, { sick: true }); await atMap(page, 4, 0);
    await page.locator(t('pin-rest')).tap(); await page.locator(t('map-go')).tap();
    await page.locator(t('rest-full')).waitFor(); assert.match(await page.locator('.rest-modal').textContent(), /焦げたソファ/);
    await page.locator(t('rest-full')).tap(); await atMap(page, 5, 0);
    const s = await state(page); assert(s.flags._ch2_night_4_done); assert.equal(s.money, 36000); assert(Object.values(s.stats).every(n => n === 31));
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await check('eve-checkpoint-and-venue-background-failure-retry', async page => {
    let bad = true;
    let failures = 0, retries = 0;
    await page.route('**/bg_ch2_venue_bench_night.webp', r => {
      if (!bad) { retries++; return r.continue(); }
      failures++;
      return r.fulfill({ status: 200, contentType: 'image/webp', body: 'invalid' });
    });
    await seed(page, { day: 13, slot: 2 }); await page.locator(t('ch2-main-error')).waitFor();
    assert(failures > 0, 'The eve background failure must be injected');
    let s = await state(page); assert.equal(s.day, 27); assert(s.flags._ch2_read_ch2_tsumugi_color);
    assert(!s.flags._ch2_eve_done); assert(!s.met.ageha);
    bad = false; await page.locator(t('ch2-main-retry')).click(); await page.locator(end).waitFor();
    assert(retries > 0, 'Retry must request the recovered venue background');
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
    await travelToCity(page,'widehanga');
    assert.equal(await page.locator('.spot-pin[data-test^="pin-ch2_"]').count(), 5);
    assert.deepEqual((await page.locator('.spot-pin').evaluateAll(nodes=>nodes.map(n=>n.dataset.test))).sort(),
      ['pin-ch2_ageha','pin-ch2_kumicho','pin-ch2_rei','pin-ch2_shop','pin-ch2_c_station','station-open'].sort());
    assert.equal(await page.locator(t('pin-ch2_volk')).count(), 0);
    assert.equal(await page.locator(t('pin-trpg_bar')).count(), 0, 'TRPG bar waits for REI introduction');
    const logos = await page.locator('.store-logo img').evaluateAll(async imgs => {
      await Promise.all(imgs.map(i => i.decode())); return imgs.map(i => i.naturalWidth);
    }); assert.equal(logos.length, 5); assert(logos.every(width => width > 0), "All five adopted store logos must decode");
    await reload(page); await page.locator(map).waitFor();
    const s = await state(page); assert.equal(s.visits.volk, 2); assert.equal(s.affinity.volk, 12); assert(s.met.volk);
    assert.equal(await page.locator(t('pin-ch2_volk')).count(), 0);
  });
  // #1262: 同じセーブで第2章入口(DAY2)→前夜→大会→大会後を通す。途中に実LOADを1回挟み、前提フラグは注入しない。
  await check('entrance-through-tournament-and-aftermath-same-save', async page => {
    const dt = name => `[data-test="${name}"]`, ct = name => t(`ch2-tournament-${name}`);
    const keep = ['money', 'stats', 'statXp', 'flavorStock', 'affinity', 'lovers', 'met', 'contacts', 'day', 'slot', 'chapter'];
    // reload() と違い、LOAD直後の自動再開より前に台詞トレースを入れ直し、既読場面の再生を検出できるようにする。
    const reloadTraced = async () => {
      await page.reload(); await page.locator(t('title-load')).click();
      await page.evaluate(async () => {
        const vn = await import('./js/vn/engine.js');
        window.__storyTrace = []; window.__storyTexts = [];
        vn.vnTest.turbo = true; vn.vnTest.choose = () => 0;
        vn.hooks.onLine = (id, line) => {
          if (window.__storyTrace.at(-1) !== id) window.__storyTrace.push(id);
          if (line.text) window.__storyTexts.push(line.text);
        };
      });
      await page.locator(t('slot-0')).click();
    };
    await seed(page, { day: 2 }); await atMap(page, 2, 0);
    const start = await state(page);
    let readBeforeLoad = [];
    for (let day = 2; day <= 13; day++) {
      await rest(page); await atMap(page, day, 1); await rest(page);
      if (day < 13) await atMap(page, day + 1, 0);
      if (day === 6) { // DAY7朝の保存を実LOADし、ロード前の状態が一致して既読場面を再生しないことを確かめる
        const mid = await state(page);
        readBeforeLoad = await page.evaluate(() => window.__storyTrace.slice());
        assert(readBeforeLoad.length > 0, 'DAY2–6 must have read scenes before the save/load');
        await reloadTraced(); await atMap(page, 7, 0);
        const loaded = await state(page);
        for (const key of keep) assert.deepEqual(loaded[key], mid[key], `LOAD keeps ${key}`);
        const replayed = await page.evaluate(ids => window.__storyTrace.filter(id => ids.includes(id)), readBeforeLoad);
        assert.deepEqual(replayed, [], 'LOAD must not replay completed scenes');
      }
    }
    await page.locator(end).waitFor();
    const eve = await state(page);
    assert.equal(eve.day, 28); assert.equal(eve.slot, 0); assert.equal(eve.chapter, 2);
    assert(eve.flags._ch2_eve_done && eve.flags._ch2_taste_distant && eve.met.ageha && eve.met.kumicho && eve.met.rei);
    for (const key of ['money', 'stats', 'statXp', 'lovers', 'loverSince']) assert.deepEqual(eve[key], start[key], key);
    assert.deepEqual(eve.flavorStock, withStrawberrySample(start.flavorStock), 'flavorStock');
    for (const [who, value] of Object.entries(start.affinity)) assert(eve.affinity[who] >= value, `affinity ${who}`);
    for (const who of Object.keys(start.met)) assert(eve.met[who], `met ${who}`);
    for (const who of start.contacts) assert(eve.contacts.includes(who), `contact ${who}`);
    // 大会: 入口fixtureから先は実フロー。craftTest.auto はch2_tournamentの実演手法と同じ。
    await page.evaluate(async () => { (await import('./js/craft/session.js')).craftTest.auto = 'good'; });
    await page.locator(ct('start')).click(); await readPhone(page);
    await page.locator(ct('ready')).waitFor();
    await page.locator(ct('craft-start')).click();
    for (let round = 1; round <= 3; round++) {
      await page.locator(ct('votes')).waitFor();
      assert.equal((await state(page)).flags._ch2_tournament.voted, round);
      await page.locator(ct('continue')).click();
    }
    await page.locator(ct('result')).waitFor();
    const judged = await state(page), record = judged.flags._ch2_tournament;
    assert.equal(record.history.length, 1); assert.equal(record.result.rank, 1);
    assert.equal(record.result.total, record.craft.total);
    await page.locator(ct('continue')).click(); await readPhone(page);
    await page.locator(ct('complete')).waitFor();
    const after = await state(page);
    // #1653 ⑦: 前夜の返事・なるへの連絡・大会の朝の応援・優勝後の祝福と返信が、実際のLIME履歴に順に残る
    const order = ['ch2_eve_tsumugi_alone', 'encourage_ch2_tsumugi_alone', 'ch2_tournament_sumi_morning', 'ch2_sent_naru_finished', 'ch2_congrats_tsumugi_alone', 'ch2_tournament_sumi_tokyo'];
    const at = order.map(id => after.inbox.findIndex(i => i.id === id));
    assert(at.every(i => i >= 0), `LIME history: ${order.filter((_, n) => at[n] < 0)}`);
    assert.deepEqual([...at].sort((a, b) => a - b), at, 'LIME history keeps the story order');
    assert(after.inbox.some(i => i.id === 'ch2_sent_naru_where') && !after.inbox.some(i => i.id === 'ch2_sent_naru_apology'));
    assert.deepEqual(after.inbox.find(i => i.id === 'ch2_congrats_tsumugi_alone').log.filter(l => l.me).map(l => l.text), ['……ありがとう']);
    assert(!after.inbox.some(i => ['encourage_tsumugi', 'encourage_minto', 'encourage_ch2_tsumugi_welcome'].includes(i.id)));
    assert.equal(after.phase, 'cleared'); assert.equal(after.chapter, 2); assert(after.flags._ch2_tokyo_invitation);
    assert.equal(after.flags._ch2_tournament.history.length, 1);
    // 大会の正規の効果以外で、蓄積した記録が欠落・巻き戻りしない。
    for (const key of ['stats', 'statXp', 'lovers', 'loverSince']) assert.deepEqual(after[key], eve[key], key);
    // 大会の正規の効果として、優勝賞金50,000円が一度だけ入る。
    assert.equal(after.money, eve.money + 50000, 'money は優勝賞金50,000円だけ増える');
    // 大会の制作は持ち込み在庫を消費するのが正規の効果（craft/steps.js の consumes）。
    // 記録された配合の分だけ減り、それ以外の欠落・巻き戻しがないことを確かめる。
    const usedMix = after.flags._ch2_tournament.craft.mix || {};
    for (const [id, grams] of Object.entries(eve.flavorStock)) {
      // 課題の支給葉（第2章は afsahr_strawberry、craft/steps.js の supply）は持ち込み在庫を減らさない。試煙会の試供品（#1650）もそのまま残る
      const used = id === 'afsahr_strawberry' ? 0 : (usedMix[id] || 0);
      assert.equal(after.flavorStock[id], Math.round((grams - used) * 10) / 10, `flavorStock ${id} は配合の消費分だけ減る`);
    }
    for (const [who, value] of Object.entries(eve.affinity)) assert(after.affinity[who] >= value, `affinity ${who}`);
    for (const who of Object.keys(eve.met)) assert(after.met[who], `met ${who}`);
    for (const who of eve.contacts) assert(after.contacts.includes(who), `contact ${who}`);
    for (const id of eve.keepsakes) assert(after.keepsakes.includes(id), `keepsake ${id}`);
    for (const id of eve.relationshipMemories) assert(after.relationshipMemories.includes(id), `memory ${id}`);
    // 大会後の保存をLOADしても結果は繰り返されず、同じ記録のまま。
    await reloadTraced(); await page.locator(ct('complete')).waitFor();
    const resumed = await state(page);
    assert.equal(resumed.flags._ch2_tournament.history.length, 1); assert.equal(resumed.phase, 'cleared');
    for (const key of ['money', 'stats', 'statXp', 'flavorStock', 'affinity', 'lovers', 'met', 'contacts']) assert.deepEqual(resumed[key], after[key], key);
  }, { reducedMotion: 'reduce' });
});
