// Production equipment and scripts, with explicit prerequisite fixtures.
// Natural New Game reachability is covered separately by hiyori_axe_natural.mjs.
import assert from 'node:assert/strict';
import { suite, assertFits } from './support.mjs';

const gift = 'suyaki_hiyori';
async function setup(page, answer = 0) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(async answer => {
    window.H = {
      core: await import('./js/core/state.js'), data: await import('./js/core/data.js'),
      vn: await import('./js/vn/engine.js'), daily: await import('./js/daily/hiyori.js'),
      route: await import('./js/core/hiyori-route.js'), bonds: await import('./js/daily/bonds.js'),
      score: await import('./js/craft/score.js'), art: await import('./js/craft/art.js'),
      session: await import('./js/craft/session.js'), steps: await import('./js/craft/steps.js'),
      shop: await import('./js/daily/shop.js'), status: await import('./js/daily/status.js'),
      motions: await import('./js/motions/gift.js'), ui: await import('./js/core/ui.js'),
    };
    (await import('./js/chapters/ch1.js')).setupHooks();
    const s = H.core.newGame();
    Object.assign(s, { phase: 'daily', day: 11, slot: 1, money: 90000, stamina: 80 });
    s.met.hiyori = true; s.contacts.push('hiyori'); s.affinity.hiyori = 66;
    for (const f of ['_intro_hiyori', '_hiyori_meeting_done', '_hiyori_sumi_message_done',
      '_hiyori_message_delivered', '_hiyori_cracks_done', '_hiyori_tonari_return_done',
      '_hiyori_tonari_followup_done', '_hiyori_tonari_afterwork_done', '_hiyori_real_self_known']) s.flags[f] = true;
    H.core.config.textSpeed = 4; H.vn.vnTest.turbo = true; H.vn.vnTest.choose = () => answer;
    H.snapshot = () => {
      const s = H.core.state;
      return structuredClone({ money: s.money, stamina: s.stamina, slot: s.slot, owned: s.owned,
        equip: s.equip, flavorStock: s.flavorStock, finales: s.finales, choices: s.romanceChoices,
        lovers: s.lovers, contacts: s.contacts, inbox: s.inbox, pendingInvite: s.pendingInvite,
        affinity: s.affinity, flags: s.flags });
    };
  }, answer);
}
const work = page => page.evaluate(() => H.daily.playHiyoriEvent('work_talk'));
await suite('hiyori-hagal', async allCheck => {
  // Focused reruns are optional; CI executes every assertion by default.
  const check = (label, body, options) => !process.env.CASE_FILTER || label.includes(process.env.CASE_FILTER)
    ? allCheck(label, body, options) : Promise.resolve();
  await check('production-equipment-and-unread-gates', async page => {
    await setup(page);
    const r = await page.evaluate(() => {
      const s = H.core.state, gear = H.data.DB.equipById.suyaki_hiyori;
      const nativeGift = H.data.DB.hiyori.route.finale.gift;
      const cases = [];
      for (const kind of ['unread', 'only-owned', 'unanswered', 'missing-gear']) {
        const flags = { ...s.flags }, choices = structuredClone(s.romanceChoices), owned = [...s.owned];
        if (kind === 'only-owned') s.owned.push(gear.id);
        if (kind === 'unanswered' || kind === 'missing-gear') {
          s.flags._hiyori_work_talk_done = true; s.flags._hiyori_bond_question_done = true;
        }
        if (kind === 'missing-gear') {
          s.romanceChoices.bond_q1_hiyori = { char: 'hiyori', value: 0, day: s.day };
          delete H.data.DB.equipById[gear.id];
        }
        const before = JSON.stringify(s);
        cases.push(!H.bonds.finaleDue('hiyori') && before === JSON.stringify(s));
        H.data.DB.equipById[gear.id] = gear; s.flags = flags; s.romanceChoices = choices; s.owned = owned;
      }
      return { nativeGift, cases, gear, forSale: H.shop.forSale(gear) };
    });
    assert.equal(r.nativeGift, gift); assert(r.cases.every(Boolean));
    assert.equal(r.gear.capacity, 20); assert(!r.forSale && r.gear.unsellable);
    assert.deepEqual({ flavor: r.gear.gift.flavor, min: r.gear.gift.min_grams,
      aroma: r.gear.gift.aroma, bonus: r.gear.gift.bonus }, { flavor: 'peach', min: 3, aroma: 4, bonus: 1 });
  });
  for (const [q1, q2, route] of [[0, 0, 'friend'], [1, 0, 'friend'], [1, 1, 'romance']]) {
    await check(`real-gift-${q1}-${q2}-${route}-save-and-no-replay`, async page => {
      await setup(page, q1); assert(await work(page));
      const r = await page.evaluate(async ({ q2 }) => {
        const s = H.core.state;
        // A current-schema appointment, including its real source message.
        // Incomplete legacy fixtures acquire originId/replyState on LOAD;
        // that migration must not be confused with a gift changing LIME.
        s.pendingInvite = { sender: 'rin', day: 12, slot: 1, event: 'date_rin', originId: 'keep', afterClose: false };
        s.inbox = [{ id: 'keep', originId: 'keep', day: 11, chapter: 1, read: true, done: true,
          replyState: 'replied', result: 'accepted',
          msg: { sender: 'rin', type: 'invitation', accept_event: 'date_rin' }, log: ['keep'] }];
        const payment = { money: s.money, stamina: s.stamina, slot: s.slot, stock: structuredClone(s.flavorStock) };
        const lime = JSON.stringify({ inbox: s.inbox, pending: s.pendingInvite });
        H.vn.vnTest.choose = () => q2;
        const done = await H.bonds.playFinale('hiyori'), before = H.snapshot();
        const replay = await H.bonds.playFinale('hiyori'), duplicate = H.bonds.grantGift('suyaki_hiyori');
        const stable = JSON.stringify(before) === JSON.stringify(H.snapshot());
        H.core.saveToSlot('suien_remake_slot1'); H.core.newGame(); H.core.loadFromSlot('suien_remake_slot1');
        return { done, before, after: H.snapshot(), replay, duplicate, stable, payment,
          limeStable: JSON.stringify({ inbox: H.core.state.inbox, pending: H.core.state.pendingInvite }) === lime };
      }, { q2 });
      assert(r.done && !r.replay && !r.duplicate && r.stable && r.limeStable, JSON.stringify(r));
      assert.equal(r.before.finales.hiyori.route, route); assert(r.before.flags._hiyori_bond_finale_done);
      assert.equal(r.before.owned.filter(id => id === gift).length, 1);
      assert.equal(r.before.choices.bond_q1_hiyori.value, q1);
      if (q1 === 0) assert.equal(r.before.choices.bond_q2_hiyori, undefined);
      else assert.equal(r.before.choices.bond_q2_hiyori.value, q2);
      assert.deepEqual(r.after, r.before);
      assert.deepEqual({ money: r.after.money, stamina: r.after.stamina, slot: r.after.slot, stock: r.after.flavorStock }, r.payment);
    });
  }
  await check('old-owned-gift-does-not-infer-unread-or-duplicate', async page => {
    await setup(page, 0);
    assert(!await page.evaluate(async () => {
      H.core.state.owned.push('suyaki_hiyori'); return H.bonds.playFinale('hiyori');
    }));
    assert(await work(page));
    const r = await page.evaluate(async () => {
      const done = await H.bonds.playFinale('hiyori');
      return { done, count: H.core.state.owned.filter(id => id === 'suyaki_hiyori').length, route: H.core.state.finales.hiyori.route };
    });
    assert(r.done); assert.equal(r.count, 1); assert.equal(r.route, 'friend');
  });
  await check('effect-requires-ownership-equipment-and-three-grams', async page => {
    await setup(page);
    const r = await page.evaluate(() => {
      const s = H.core.state, effect = mix => H.score.giftBowlEffect({ equip: { bowl: 'suyaki_hiyori' }, mix });
      const unowned = effect({ peach: 20 }); s.owned.push('suyaki_hiyori');
      return { unowned, low: effect({ peach: 2.99 }), other: effect({ mint: 20 }), positive: effect({ peach: 3 }),
        normal: H.score.giftBowlEffect({ equip: { bowl: 'silicone_bowl' }, mix: { peach: 20 } }),
        samechan: H.data.DB.equipById.suyaki_samechan.gift };
    });
    assert.equal(r.unowned, null); assert.equal(r.low, null); assert.equal(r.other, null); assert.equal(r.normal, null);
    assert.equal(r.positive.aroma, 4); assert.equal(r.positive.bonus, 1);
    assert.equal(r.samechan.flavor, undefined, 'Do not alter another character’s uninfused gift');
  });
  await check('interrupted-q2-zero-resumes-once-with-real-gift', async page => {
    await setup(page, 1); assert(await work(page));
    await page.evaluate(() => {
      H.vn.vnTest.choose = () => 0;
      H.vn.hooks.onLine = (id, line) => {
        if (id === 'hiyori_bond_finale' && line.speaker === 'hiyori' && H.core.state.romanceChoices.bond_q2_hiyori) H.vn.vnTest.turbo = false;
      };
      H.running = H.daily.meetHiyoriAtTonari();
    });
    await page.waitForFunction(() => H.core.state.romanceChoices.bond_q2_hiyori && document.querySelector('#vn.active .vn-next.show'));
    const before = await page.evaluate(() => {
      const s = H.core.state, count = s.owned.filter(id => id === 'suyaki_hiyori').length;
      H.core.saveToSlot('suien_remake_slot1'); H.core.newGame(); H.core.loadFromSlot('suien_remake_slot1');
      return { count, seen: !!s.finales.hiyori };
    });
    assert.equal(before.count, 0); assert(!before.seen); assert(!await page.evaluate(() => H.running));
    const after = await page.evaluate(async () => {
      H.vn.hooks.onLine = null; H.vn.vnTest.turbo = true;
      H.vn.vnTest.choose = () => { throw Error('A saved answer must not be asked again'); };
      const done = await H.daily.meetHiyoriAtTonari();
      return { done, count: H.core.state.owned.filter(id => id === 'suyaki_hiyori').length,
        answer: H.core.state.romanceChoices.bond_q2_hiyori.value, route: H.core.state.finales.hiyori.route };
    });
    assert(after.done); assert.equal(after.count, 1); assert.equal(after.answer, 0); assert.equal(after.route, 'friend');
  });
  for (const [device, touch, options] of [['pc', false, {}], ['touch', true,
    { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${device}-receive-select-pack-and-save`, async page => {
      await setup(page, 1); assert(await work(page));
      const press = selector => touch ? page.locator(selector).tap() : page.locator(selector).click();
      await page.evaluate(() => { H.vn.vnTest.turbo = false; H.running = H.daily.meetHiyoriAtTonari(); });
      await page.locator('#vn.active').waitFor(); await press('[data-test="vn-skip"]');
      const answer = touch ? 1 : 0;
      await page.locator(`[data-test="choice-${answer}"]`).waitFor();
      await assertFits(page, '.vn-choices,.vn-choice'); await press(`[data-test="choice-${answer}"]`);
      assert(await page.evaluate(() => H.running));
      const received = await page.evaluate(() => ({ answer: H.core.state.romanceChoices.bond_q2_hiyori.value,
        route: H.core.state.finales.hiyori.route, count: H.core.state.owned.filter(id => id === 'suyaki_hiyori').length }));
      assert.deepEqual(received, { answer, route: touch ? 'romance' : 'friend', count: 1 });
      await page.evaluate(async () => {
        // This is an explicit equipment UI fixture, not natural inventory acquisition.
        H.shop.addFlavorStock('peach', 50); H.shop.addFlavorStock('mint', 50);
        H.cs = H.session.newSession('drill'); await H.session.openBench(H.cs).ready;
        H.running = H.steps.stepSetup(H.cs);
      });
      const choose = page.locator('[data-test="opt-suyaki_hiyori"]');
      await choose.waitFor(); await (touch ? choose.tap() : choose.click());
      await page.evaluate(() => H.running);
      assert.equal(await page.evaluate(() => H.core.state.equip.bowl), gift);
      await page.evaluate(() => { H.running = H.steps.stepMix(H.cs); });
      await page.locator('[data-test="mix-plus-peach"]').waitFor();
      for (let n = 0; n < 3; n++) await press('[data-test="mix-plus-peach"]');
      for (let n = 0; n < 17; n++) await press('[data-test="mix-plus-mint"]');
      await press('[data-test="mix-plus-mint"]');
      assert.deepEqual(await page.evaluate(() => H.cs.mix), { peach: 3, mint: 17 }, 'The 21st gram must be refused');
      assert.match(await page.locator('.mix-amount .lcd').innerText(), /20\.0 g \/ 20 g/);
      await assertFits(page, '.mix-vessel,.mix-footer');
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser'}/hiyori-hagal-${device}-mix.png` });
      await press('[data-test="mix-ok"]'); await page.evaluate(() => H.running);
      await page.evaluate(() => { H.running = H.steps.stepPack(H.cs); });
      await page.locator('[data-test="pack-confirm"]').waitFor();
      const url = await page.locator('.pack-vessel-art > .art').evaluate(n => n.style.backgroundImage);
      assert.match(url, /bowl_empty_hiyori\.webp/);
      await assertFits(page, '.pack-vessel-art,.pack-choice,.pack-footer');
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser'}/hiyori-hagal-${device}-pack.png` });
      await (touch ? page.locator('[data-test="pack-confirm"]').tap() : page.locator('[data-test="pack-confirm"]').click());
      await page.evaluate(() => H.running);
      const saved = await page.evaluate(() => {
        H.core.saveToSlot('suien_remake_slot1'); H.core.newGame(); H.core.loadFromSlot('suien_remake_slot1');
        return { bowl: H.core.state.equip.bowl, count: H.core.state.owned.filter(id => id === 'suyaki_hiyori').length };
      });
      assert.equal(saved.bowl, gift); assert.equal(saved.count, 1);
    }, { ...options, recordVideo: { dir: process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser' } });
    for (const variant of ['a', 'b']) await check(`${device}-gift-${variant}-art-and-bounds`, async page => {
      await setup(page); await page.emulateMedia({ reducedMotion: 'no-preference' });
      await page.evaluate(variant => {
        // Hold the completed title entrance for visual QA. A fixed wall-clock delay
        // can otherwise capture the exit on a busy runner, hiding the bowl.
        H.nativeAnimate = Element.prototype.animate;
        Element.prototype.animate = function(frames, options) {
          const animation = H.nativeAnimate.call(this, frames, options);
          if (this.matches('.mo-gift-title .mg-char:last-child') && frames.at(-1)?.opacity === 1) {
            Object.defineProperty(animation, 'finished', { value: animation.finished.then(() =>
              new Promise(resolve => { H.releasePresentation = resolve; })) });
          }
          return animation;
        };
        H.running = H.motions[variant](H.data.DB.equipById.suyaki_hiyori);
      }, variant);
      await page.waitForFunction(() => H.releasePresentation);
      const bowl = page.locator('.mo-gift-bowl'); await bowl.waitFor();
      assert.match(await bowl.evaluate(n => n.style.backgroundImage), /bowl_empty_hiyori\.webp/);
      assert.equal(await page.locator('.mo-gift-hero').evaluate(n => Number(getComputedStyle(n).opacity)), 1);
      await assertFits(page, '.mo-gift-bowl,.mo-gift-name');
      const separation = await page.evaluate(() => {
        const bowl = document.querySelector('.mo-gift-bowl').getBoundingClientRect();
        const name = document.querySelector('.mo-gift-name').getBoundingClientRect();
        return bowl.bottom <= name.top || name.bottom <= bowl.top;
      });
      assert(separation, 'The gift name must not overlap the bowl');
      await page.screenshot({ path: `${process.env.ARTIFACT_DIR || '.codex/artifacts/remake-browser'}/hiyori-hagal-${device}-gift-${variant}-visible.png` });
      await page.evaluate(() => { Element.prototype.animate = H.nativeAnimate; H.releasePresentation(); });
      await page.evaluate(() => H.running);
    }, options);
  }
});
