// #321: 本番の行動・固定夜・旧セーブで、遭遇条件、移動、給与と行動枠を確認する。
import assert from 'node:assert/strict';
import { suite } from './support.mjs';

const touch = { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };
async function setup(page, day = 4, slot = 1) {
  page.setDefaultTimeout(60000);
  await page.evaluate(async ({ day, slot }) => {
    window.C = { core: await import('./js/core/state.js'), stats: await import('./js/core/stats.js'),
      data: await import('./js/core/data.js'), vn: await import('./js/vn/engine.js'),
      ch1: await import('./js/chapters/ch1.js'), story: await import('./js/chapters/tsumugi-story.js'),
      tonari: await import('./js/daily/tonari.js'), craft: await import('./js/craft/session.js') };
    C.ch1.setupHooks(); C.vn.vnTest.turbo = true; C.craft.craftTest.auto = 'good';
    C.data.DB.baito = []; // 接客の抽選報酬を除き、実際の基本給・シフト・遭遇を比較。
    C.fresh = (day, slot) => {
      const s = C.core.newGame();
      Object.assign(s, { phase: 'daily', day, slot, money: 30000, stamina: 100, weatherSeed: 4 });
      Object.assign(s.flags, { _lime_tut: 1, _delivery_minto_done: true, _delivery_adam_done: true,
        _errand_scout_done: true, _hiyori_meeting_done: true, _hiyori_message_delivered: true });
      s.flags[`_morning_${day}`] = s.flags[`_morning_${day + 1}`] = true;
      s.met.naru = s.met.adam = s.met.minto = true;
      s.flags._spot_guide_naru = s.flags._spot_guide_adam = s.flags._spot_guide_minto = true;
      s.flavors.push('blueberry'); s.flavorStock.blueberry = 50;
      return s;
    };
    C.fresh(day, slot); await C.story.playTsumugiStory(day - 1);
    C.trace = []; C.lines = []; C.beats = [];
    C.bg = () => {
      const n = document.querySelector('#bg > .bg-img:last-child');
      return n?.dataset.sceneBg || n?.style.backgroundImage || '';
    };
    C.vn.hooks.onLine = (id, line) => {
      if (C.trace.at(-1) !== id) C.trace.push(id);
      C.lines.push({ id, text: line.text, bg: C.bg(), slot: C.core.state.slot, money: C.core.state.money });
    };
    new MutationObserver(records => {
      for (const r of records) for (const n of r.addedNodes) {
        if (n.classList?.contains('beat')) C.beats.push(n.textContent);
      }
    }).observe(document.getElementById('fx'), { childList: true, subtree: true });
    C.afterTimer = setInterval(() => {
      document.querySelector('[data-test="shift-order-0"]')?.click();
      document.querySelector('[data-test="after-none"]')?.click();
      document.querySelector('[data-test="reel-intro"]')?.click();
      document.querySelector('[data-test="drill-heat"]')?.click();
    }, 20);
    C.start = () => C.ch1.resumeGame().catch(e => { window.calendarError = e.stack; });
  }, { day, slot });
}
async function nextMorning(page, day) {
  await page.waitForFunction(day => C.core.state.day === day + 1
    && (day === 13 || document.querySelector('.map:not(.done)')), day, { timeout: 60000 });
  const r = await page.evaluate(() => ({ trace: C.trace, lines: C.lines, beats: C.beats,
    flags: C.core.state.flags, money: C.core.state.money, day: C.core.state.day,
    slot: C.core.state.slot, error: window.calendarError }));
  assert.equal(r.error, undefined);
  return r;
}
await suite('action-context', async check => {
  const selected = process.env.TEST_CASES?.split(',');
  const run = (label, body, options = {}) => !selected || selected.includes(label)
    ? check(label, body, { reducedMotion: 'reduce', ...options }) : Promise.resolve();
  for (const [platform, options] of [['pc', {}], ['touch', touch]]) {
    await run(`${platform}-shifts-and-old-saves`, async page => {
      await setup(page);
      const rows = await page.evaluate(async () => {
        const rows = [];
        for (const [day, slot, chapter, called] of [[3, 0, 1, false], [4, 0, 1, false],
          [4, 1, 1, true], [11, 1, 1, false], [4, 1, 2, false]]) {
          const s = C.fresh(day, slot); s.chapter = chapter;
          C.trace = []; C.lines = [];
          await C.stats.paidAction(() => C.tonari.doBaito({ called }));
          const first = { trace: [...C.trace], lines: [...C.lines], money: s.money,
            stamina: s.stamina, stats: { ...s.stats }, slot: s.slot, done: !!s.flags._ev_ageha_cameo,
            nameKnown: !!s.flags.known_name_ageha, met: !!s.met.ageha, bg: C.bg() };
          C.core.saveToSlot('suien_remake_slot1'); C.core.loadFromSlot('suien_remake_slot1');
          C.trace = []; await C.stats.paidAction(() => C.tonari.doBaito({ called }));
          const replayed = C.trace.includes('ch1_ageha_encounter');
          const old = C.fresh(day, slot); old.chapter = chapter; old.flags._ev_ageha_cameo = true;
          C.core.save(); C.core.load(); C.trace = [];
          await C.stats.paidAction(() => C.tonari.doBaito({ called }));
          rows.push({ day, slot, chapter, called, first, replayed, oldReplayed: C.trace.includes('ch1_ageha_encounter'),
            old: { money: C.core.state.money, stamina: C.core.state.stamina, stats: C.core.state.stats } });
        }
        return rows;
      });
      for (const r of rows) {
        const seen = r.chapter === 1 && r.day >= 4;
        assert.equal(r.first.done, seen); assert.equal(r.first.trace.includes('ch1_ageha_encounter'), seen);
        assert(!r.replayed && !r.oldReplayed); assert(!r.first.met && !r.first.nameKnown);
        assert.equal(r.first.money, r.old.money); assert.equal(r.first.stamina, r.old.stamina);
        assert.equal(r.first.slot, r.slot); assert.deepEqual(r.first.stats, r.old.stats);
        assert(r.first.money >= 38000); assert.match(r.first.bg, /bg_tonari_inside/);
        if (seen) {
          assert(r.first.trace.indexOf('remake_baito_end') < r.first.trace.indexOf('ch1_ageha_encounter'));
          const lines = r.first.lines.filter(l => l.id === 'ch1_ageha_encounter');
          assert(lines.every(l => /bg_street/.test(l.bg) && l.slot === r.slot));
          assert(lines.every(l => !/夕暮れ|夕陽/.test(l.text)));
          assert.match(lines[0].text, /シフトを上がったあと/);
          assert(lines.some(l => /荷物をスミさんに渡した/.test(l.text)));
        }
      }
      assert.equal(rows[2].first.money - rows[1].first.money, 5000, 'LIME shift bonus changed');
    }, options);
  }
  // 買い物は従来どおり無料の時間枠。その後の休息を含め、DAY4/5の夜へ進む。
  for (const day of [4, 5]) for (const [index, action] of ['rest', 'shopping', 'visit', 'baito'].entries()) {
    const options = (day + index) % 2 ? touch : {};
    await run(`day${day}-${action}`, async page => {
      await setup(page, day);
      await page.evaluate(({ day, action }) => {
        if (action === 'baito' && day === 4) C.core.state.pendingInvite = {
          sender: 'sumi', event: '__sumi_baito__', day, slot: 1 };
        C.core.save(); C.core.load(); C.start();
      }, { day, action });
      if (!(action === 'baito' && day === 4)) {
        const spot = { rest: 'rest', shopping: 'shop', visit: 'c_station', baito: 'tonari' }[action];
        await page.locator(`.map:not(.done) [data-spot="${spot}"]`).click();
        await page.locator('[data-test="map-go"]').click();
        if (action === 'baito') await page.locator('[data-test="tonari-baito"]').click();
        if (action === 'shopping') {
          await page.locator('[data-test="shop-enter"]').click();
          await page.locator('[data-test="buy-blueberry"]').click();
          await page.locator('[data-test="shop-checkout"]').click();
          await page.locator('[data-test="shop-leave"]').click();
          await page.locator('.map:not(.done) [data-spot="rest"]').waitFor();
          const shop = await page.evaluate(() => ({ slot: C.core.state.slot, money: C.core.state.money,
            stock: C.core.state.flavorStock.blueberry, done: !!C.core.state.flags._ev_ageha_cameo }));
          assert.equal(shop.slot, 1); assert(shop.money < 30000 && shop.stock > 50); assert(!shop.done);
          await page.locator('.map:not(.done) [data-spot="rest"]').click();
          await page.locator('[data-test="map-go"]').click();
        }
      }
      const r = await nextMorning(page, day);
      assert.equal(r.slot, 0); assert.equal(!!r.flags._ev_ageha_cameo, action === 'baito');
      assert.equal(r.trace.includes('ch1_ageha_encounter'), action === 'baito');
      assert.equal(r.trace.includes('ch1_day5_sumi_story'), day === 5);
      assert.equal(r.trace.filter(id => /^remake_homecoming_/.test(id)).length,
        day === 5 || !['rest', 'shopping'].includes(action) ? 1 : 0);
      if (day === 5) assert(r.beats.some(t => /スミさんの話を聞きに.*tonariへ/.test(t)));
      if (action === 'rest') assert.equal(r.money, 30000);
      if (action === 'visit') assert.equal(r.lines.find(l => l.id === 'ch1_c_station_visit').money, 27500);
      if (action === 'baito') assert(r.money >= (day === 4 ? 43000 : 38000));
    }, options);
  }
  for (const [index, branch] of ['practice', 'drill', 'talk_sumi', 'sleep_early'].entries()) {
    await run(`eve-${branch}`, async page => {
      await setup(page, 13, 2);
      await page.evaluate(async index => {
        await C.story.playTsumugiStory(13);
        Object.assign(C.core.state.flags, { _ev_rehearsal: true, _home_tonight: true });
        C.vn.vnTest.choose = () => index; C.trace = []; C.lines = []; C.start();
      }, index);
      const r = await nextMorning(page, 13);
      assert.equal(r.flags._last_night, branch);
      assert.equal(r.trace.filter(id => id === 'ch1_day7_last_night').length, 1);
      assert.equal(r.trace.filter(id => /^remake_homecoming_/.test(id)).length, branch === 'sleep_early' ? 0 : 1);
      const menu = r.lines.filter(l => l.id === 'ch1_day7_last_night');
      assert.match(menu[0].text, /閉店後のtonari/);
      assert(menu.every(l => /bg_tonari_inside(?:_overcast)?_night/.test(l.bg)), JSON.stringify(menu));
      const ending = r.lines.filter(l => l.id === `ch1_day7_last_night_${branch}`);
      assert(ending.length > 0, '選んだ過ごし方の会話を落とさない');
      if (branch === 'sleep_early') assert(ending.some(l => /bg_home(?:_overcast)?_night/.test(l.bg)), JSON.stringify(ending));
      else assert(ending.every(l => /bg_tonari_inside(?:_overcast)?_night/.test(l.bg)), JSON.stringify(ending));
      assert(!r.lines.some(l => /もう一度.*tonari/.test(l.text)), '前夜の二重往復を作らない');
      if (branch === 'drill') assert.equal(await page.evaluate(() => C.core.state.best.heat), 2);
    }, index % 2 ? touch : {});
  }
});
