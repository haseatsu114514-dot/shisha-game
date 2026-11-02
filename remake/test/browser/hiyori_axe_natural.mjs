// Extends the Issue341 natural New Game QA through the formal axe event. Only seeds are fixed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { installLoadingComicReader } from './loading_reader.mjs';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../');
const { chromium } = createRequire(path.join(root, 'remake/test/browser/package.json'))('playwright');
const base = process.env.BASE_URL || 'http://127.0.0.1:8123/remake/';
const out = path.resolve(process.env.ARTIFACT_DIR || path.join(root, '.codex/artifacts/remake-browser/hiyori-axe-natural'));
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_EXECUTABLE_PATH ? {executablePath:process.env.CHROME_EXECUTABLE_PATH} : {}) });
const results = [];
const giftGoal = process.env.GOAL_HIYORI_GIFT === '1';
const workGoal = giftGoal || process.env.GOAL_HIYORI_WORK === '1';

async function boot(page) {
  await page.goto(base);
  await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
  await page.locator('#boot').waitFor({ state: 'detached' });
}

try {
  for (const [label, options] of [
    ['pc', { viewport: { width: 1280, height: 720 } }],
    ['mobile', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }],
  ]) {
    if (process.env.ONLY_DEVICE && process.env.ONLY_DEVICE !== label) continue;
    const context = await browser.newContext(options);
    const page = await context.newPage();
    await installLoadingComicReader(page);
    const errors = [], failedResources = [], cache = { cold: 0, warm: 0 };
    const revalidated = { cold: 0, warm: 0 };
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    let cachePhase = 'cold';
    cdp.on('Network.requestServedFromCache', () => cache[cachePhase]++);
    // Fresh CI checkouts revalidate images with HTTP 304 instead of a memory-cache event.
    cdp.on('Network.responseReceivedExtraInfo', event => {
      if (event.statusCode === 304) revalidated[cachePhase]++;
    });
    page.on('pageerror', e => errors.push(e.message));
    page.on('response', r => { if (r.status() >= 400) failedResources.push(`${r.status()} ${r.url()}`); });
    page.on('requestfailed', r => { if (!/ERR_ABORTED/.test(r.failure()?.errorText || '')) failedResources.push(`${r.failure()?.errorText} ${r.url()}`); });
    const row = { label, base, cache, revalidated, startedAt: new Date().toISOString(), status: 'running' };
    results.push(row);
    const seen = new Set(), actions = [];
    async function click(selector) {
      const loc = page.locator(selector).first();
      if (!await loc.isVisible()) return false;
      try { await (label === 'mobile' ? loc.tap({ timeout: 1500 }) : loc.click({ timeout: 1500 })); return true; }
      catch { return false; }
    }
    try {
      await boot(page);
      await page.screenshot({ path: path.join(out, `${label}-cold-title.png`) });
      cachePhase = 'warm';
      await page.reload();
      await page.locator('[data-test="title-new"]').waitFor({ timeout: 30000 });
      await page.locator('#boot').waitFor({ state: 'detached' });
      await page.screenshot({ path: path.join(out, `${label}-warm-title.png`) });
      assert(cache.warm + revalidated.warm > 0, 'Warm reload must actually reuse cached resources');
      await page.evaluate(async () => {
        const core = await import('./js/core/state.js'), vn = await import('./js/vn/engine.js');
        const spots = await import('./js/daily/spots.js'), hiyori = await import('./js/daily/hiyori.js');
        const { spotAvailability: baseAvailability } = await import('./js/daily/spot-access.js');
        const { fixedNightVisitBlock } = await import('./js/daily/night-events.js');
        const { NIGHT_EVENTS } = await import('./js/chapters/ch1.js');
        const spotAvailability = spot => baseAvailability(spot, { visitBlock: item => fixedNightVisitBlock(NIGHT_EVENTS, item) });
        const axe = await import('./js/daily/hiyori-axe.js');
        window.Q = { core, vn, spots, hiyori, axe, spotAvailability, events: [], current: null };
        core.config.textSpeed = 4;
        vn.vnTest.turbo = true;
        vn.vnTest.choose = id => id === 'remake_tutorial_offer' ? 1 : 0;
        window.__remake.craftTest.auto = 'good';
        vn.hooks.onLine = (id, line) => {
          vn.vnTest.turbo = !id.startsWith('hiyori_') && !id.startsWith('axe_bar_');
          Q.current = { id, speaker: line.speaker, face: line.face, text: line.text, inner: line.inner };
          if ((id.startsWith('hiyori_') || id.startsWith('axe_bar_')) && !Q.events.some(e => e.id === id)) {
            const s = core.state;
            Q.events.push({ id, day: s.day, slot: s.slot, money: s.money, affinity: s.affinity.hiyori || 0,
              held: s.flags._hiyori_affinity_waiting_pts || 0, flags: structuredClone(s.flags) });
          }
        };
      });
      await click('[data-test="title-new"]');
      await page.waitForFunction(() => Q.core.state);
      // Only random seeds are fixed; all progress, payments and rewards come from normal gameplay.
      await page.evaluate(() => { Q.core.state.seed = 131; Q.core.state.weatherSeed = 4; Q.core.state.reel.seed = 4321; });
      // The gift adds another real visit beyond the original axe/work scope.
      // Keep those existing modes' budget and all game-state assertions intact.
      const deadline = Date.now() + (giftGoal ? 12 : workGoal ? 10 : 8) * 60000;
      let lastKey = '', lastProgress = Date.now(), lastMapKey = '';
      while (Date.now() < deadline) {
        await page.waitForTimeout(90);
        const snap = await page.evaluate(() => {
          const s = Q.core.state;
          return { day: s.day, slot: s.slot, money: s.money, stamina: s.stamina, flags: s.flags,
            affinity: s.affinity.hiyori || 0, screen: document.body.dataset.screen,
            vn: document.querySelector('#vn')?.classList.contains('active'), current: Q.current,
            phone: !!document.querySelector('.phone-overlay'), cutin: !!document.querySelector('.cutin.in'),
            modal: document.querySelector('#modal')?.classList.contains('show'),
            map: !!document.querySelector('#screen .map:not(.done)'),
            live: !!document.querySelector('#screen > *:not(.done)') };
        });
        const key = JSON.stringify([snap.day, snap.slot, snap.screen, snap.vn, snap.phone, snap.modal, snap.current?.text, snap.flags._hiyori_tonari_afterwork_done]);
        if (key !== lastKey) { lastKey = key; lastProgress = Date.now(); }
        assert(Date.now() - lastProgress < 45000, `Stalled: ${key}`);
        if ((giftGoal ? snap.flags._hiyori_bond_finale_done
          : workGoal ? snap.flags._hiyori_work_talk_done && snap.flags._hiyori_bond_question_done
          : snap.flags._hiyori_real_self_known) && !snap.vn && snap.slot === 2 && !snap.modal && !snap.cutin) break;
        assert(snap.day < 14, 'The natural hiyori sequence must fit before the tournament');
        const axe=page.locator('[data-test="axe-game"]');
        if(await axe.count()) {
          if(!seen.has('actual-axe') && await page.locator('[data-test="axe-action"]:not([disabled])').isVisible()) {
            await page.screenshot({path:path.join(out,`${label}-actual-axe.png`)});seen.add('actual-axe');
          }
          // AXR08: when Maki is already known, her one-throw lesson comes first. Read it through like a player.
          if(await click('[data-test="axe-coach-next"]')) continue;
          const button=page.locator('[data-test="axe-action"]:not([disabled])');
          if(await button.isVisible()) { await click('[data-test="axe-action"]:not([disabled])'); }
          continue;
        }
        if (snap.cutin) {
          if (!seen.has('intro')) {
            await page.waitForTimeout(1700);
            await page.screenshot({ path: path.join(out, `${label}-intro.png`) });
            seen.add('intro');
          }
          await click('.cutin.in');
          continue;
        }
        if (snap.phone) {
          const accepting = page.locator('[data-test="reply-0"]');
          if (await accepting.isVisible()) {
            const target = (await accepting.innerText()).includes('顔を出');
            if (target) {
              await page.screenshot({ path: path.join(out, `${label}-sumi-lime.png`) });
              row.beforeReply = { day: snap.day, slot: snap.slot, money: snap.money, affinity: snap.affinity };
            }
            await click(target ? '[data-test="reply-0"]' : '[data-test="reply-1"]');
            if (target) row.afterReply = await page.evaluate(() => ({ day: Q.core.state.day, slot: Q.core.state.slot,
              money: Q.core.state.money, affinity: Q.core.state.affinity.hiyori, pending: structuredClone(Q.core.state.pendingInvite) }));
          } else if (!await click('[data-test="phone-next"]')) await click('[data-test="phone-close"]');
          continue;
        }
        if (await click('[data-test="coach-lime"]')) continue;
        if (snap.modal) {
          if (await click('[data-test="reel-intro"]') || await click('[data-test="drill-finish"]') || await click('[data-test="status-close"]')) continue;
          await click('#modal .modal-actions button');
          continue;
        }
        if (snap.vn) {
          if (snap.current?.id?.startsWith('hiyori_') || snap.current?.id?.startsWith('axe_bar_')) {
            const shot = `${snap.current.id}-${snap.current.speaker || 'narration'}-${snap.current.face || 'default'}`;
            if (!seen.has(shot) && await page.locator('.vn-next.show').isVisible()) {
              await page.waitForTimeout(350);
              await page.screenshot({ path: path.join(out, `${label}-${shot}.png`) });
              seen.add(shot);
            }
            if (!await click('.vn-choices.show button')) {
              if (await page.locator('.vn-next.show').isVisible()) { await page.waitForTimeout(40); await click('.vn-box'); }
            }
          }
          continue;
        }
        if (!snap.live) continue;
        if (snap.screen === 'shop-entry') {
          // The scheduled guest may be at the showroom, not the free shopping counter.
          if (!await click('[data-test="shop-upstairs"]:not([disabled])')) await click('[data-test="shop-enter"]');
        } else if (snap.screen === 'axe-bar') {
          // #577: 匿名目撃は無料で完読し、有料ソロを始めず地図へ戻る。
          await click('[data-test="axe-bar-back"]');
        } else if (snap.screen === 'shop') {
          await click('.shop-row.errand [data-test^="buy-"]');
          await click('[data-test="shop-checkout"]');
          await click('[data-test="shop-leave"]');
        } else if (snap.screen === 'preparation') await click('[data-test="prep-flavor-blueberry"]');
        else if (snap.screen === 'tonari') {
          // DAY3's optional review can now open the same tonari drill menu.
          if (await click('[data-test="drill-heat"]')) continue;
          if (await click('[data-test="tonari-hiyori-axe"]:not([disabled])')) continue;
          // Return -> followup -> afterwork has no night restriction. A real shift reads
          // those talks in its mandatory after-shift Sumi conversation (#1081 B05).
          // Do this before axe/work, so later free-talk money invariants stay intact.
          const catchUp = await page.evaluate(() => {
            const s = Q.core.state, f = s.flags;
            return s.visitedDay.tonari_baito !== s.day && (
              f._hiyori_tonari_return_done && !f._hiyori_tonari_afterwork_done
              || Q.axe.hiyoriAxePrereqsMet() && !Q.axe.axeThrowExposed());
          });
          const earn = catchUp || snap.money < 6000 && !snap.flags._hiyori_real_self_known;
          if (earn && await click('[data-test="tonari-baito"]')) continue;
          if (await click('[data-test="tonari-customer"]')) continue;
          // The Sumi talk already ran (mandatory, #1081 B05); just leave the shift.
          await click('[data-test="after-none"]');
        } else if (snap.map) {
          const mapKey = `${snap.day}:${snap.slot}`;
          if (lastMapKey !== mapKey) {
            lastMapKey = mapKey;
            console.log(`[hiyori-axe-natural] ${label} DAY${snap.day}/${snap.slot}: money=${snap.money}, affinity=${snap.affinity}, goal=${giftGoal ? 'gift' : workGoal ? 'work' : 'axe'}`);
            actions.push({ day: snap.day, slot: snap.slot, money: snap.money, affinity: snap.affinity,
              held: snap.flags._hiyori_affinity_waiting_pts || 0, released: snap.flags._hiyori_affinity_released_pts || 0,
              flags: Object.fromEntries(Object.entries(snap.flags).filter(([k]) => k.startsWith('_hiyori_'))) });
          }
          if (await page.locator('[data-test="map-guide"]').isVisible()) {
            await click('.spot-pin.guide'); await click('[data-test="map-go"]'); continue;
          }
          const invite = await page.evaluate(() => Q.core.state.inbox.some(i => !i.done && i.msg.accept_event === 'hiyori_tonari_return' && i.day === Q.core.state.day));
          if (invite && snap.slot === 0 && (snap.affinity >= 33 || snap.day >= 11)) {
            await click('[data-test="hud-phone"]'); await click('[data-test="lime-chat-sumi"]'); continue;
          }
          const selected = await page.evaluate(({ workGoal, giftGoal }) => {
            const s = Q.core.state, f = s.flags, sp = Q.spots;
            const tonari = sp.spotById('tonari');
            // 候補の入店可否は本番の spotAvailability で確かめる。不可なら既存の優先順位のまま次の候補へ進む。
            // 最初の不可だけ診断を console に出す（テストの失敗調査用）。
            let reported = window.__hiyoriRejectReported === true;
            const ok = id => {
              const x = sp.spotById(id);
              const r = x ? Q.spotAvailability(x) : { ok: false, why: 'missing spot' };
              if (!r.ok && !reported) {
                reported = window.__hiyoriRejectReported = true;
                console.log('hiyori-candidate-rejected ' + JSON.stringify({ candidate: id, why: r.why, day: s.day, slot: s.slot,
                  stamina: s.stamina,                   visitedDay: s.visitedDay, invitationStamp: f._invitation_visit_tonari ?? null,
                  flags: { return: !!f._hiyori_tonari_return_done, followup: !!f._hiyori_tonari_followup_done, afterwork: !!f._hiyori_tonari_afterwork_done } }));
              }
              return r.ok;
            };
            if (s.stamina < 35) return 'rest';
            // 新規の噂→実来店で目撃→翌日以降の初対面を、既存の実UIだけで通る。
            if (!f._axe_bar_rumor_done && !sp.isClosed(tonari) && ok('tonari')) return 'tonari';
            if (!f._axe_bar_sighting_done) return s.slot === 1 && ok('axe_bar') ? 'axe_bar' : 'rest';
            // Once the paid axe outing is finished, wait for the free night talks.
            // A daytime detour would change the fee invariant for work/gift.
            if (f._hiyori_real_self_known && workGoal) return s.slot === 1 && ok('tonari') ? 'tonari' : 'rest';
            // Earn through the actual shift UI before either a paid visit or axe event.
            // A disabled axe button must never send us back into a used customer seat.
            if (s.money < 6000 && s.visitedDay.tonari_baito !== s.day && ok('tonari')) return 'tonari';
            // If prerequisites became ready after today's shift, wait for tomorrow's Sumi talk.
            if (Q.axe.hiyoriAxePrereqsMet() && !Q.axe.axeThrowExposed()
              && s.visitedDay.tonari_baito === s.day) return 'rest';
            const needsTonari = f._hiyori_meeting_done && !f._hiyori_sumi_message_done
              || f._hiyori_tonari_return_done && !f._hiyori_tonari_afterwork_done
              || Q.axe.hiyoriAxePrereqsMet() && !Q.axe.axeThrowExposed()
                && s.visitedDay.tonari_baito !== s.day;
            if (needsTonari && !sp.isClosed(tonari) && s.visitedDay.tonari_customer !== s.day && ok('tonari')) return 'tonari';
            if (f._hiyori_tonari_afterwork_done && s.slot === 1 && !sp.isClosed(tonari)
              && (!workGoal || !f._hiyori_bond_question_done || giftGoal && !f._hiyori_bond_finale_done) && ok('tonari')) return 'tonari';
            const location = Q.hiyori.hiyoriShopLocation();
            const spot = location && sp.spotById(location);
            if (spot && !sp.visitedToday(spot.id) && s.money >= (spot.cost || 0) && ok(spot.id)) return spot.id;
            ok('rest');
            return 'rest';
          }, { workGoal, giftGoal });
          await click(`[data-test="pin-${selected}"]`); await click('[data-test="map-go"]');
        }
      }
      const final = await page.evaluate(() => ({ state: structuredClone(Q.core.state), events: Q.events }));
      row.actions = actions; row.events = final.events; row.final = final.state;
      assert(Date.now() < deadline, `Natural walkthrough exceeded its existing deadline: ${JSON.stringify({ day: final.state.day, slot: final.state.slot, money: final.state.money, events: final.events.map(e => e.id), requiredFlags: Object.fromEntries(Object.entries(final.state.flags).filter(([key]) => key.startsWith("_hiyori_"))) })}`);
      const required = ['axe_bar_rumor','axe_bar_sighting','hiyori_meeting','hiyori_sumi_message','hiyori_shop_message','hiyori_cracks','hiyori_tonari_return','hiyori_tonari_followup','hiyori_tonari_afterwork','hiyori_axe_reveal','hiyori_axe_reveal_close'];
      if(workGoal) required.push('hiyori_work_talk','hiyori_bond_question');
      if(giftGoal) required.push('hiyori_bond_finale');
      let previous = -1;
      for (const id of required) { const at = final.events.findIndex(e => e.id === id); assert(at > previous, `Missing/out-of-order ${id}`); previous = at; }
      assert(final.events.find(e => e.id === 'hiyori_meeting').day > final.events.find(e => e.id === 'axe_bar_sighting').day,
        '正式初対面は実目撃の翌日以降');
      assert(final.state.flags._hiyori_tonari_afterwork_done);
      assert(final.state.flags._hiyori_real_self_known);
      assert.equal(!!final.state.flags._hiyori_work_talk_done,workGoal);
      if(workGoal){
        assert(final.state.flags._hiyori_bond_question_done);
        assert.equal(final.state.romanceChoices.bond_q1_hiyori.value,0);
        if (giftGoal) {
          assert(final.state.flags._hiyori_bond_finale_done);
          assert.equal(final.state.finales.hiyori.route, 'friend');
          assert.equal(final.state.owned.filter(id => id === 'suyaki_hiyori').length, 1);
          assert.equal(final.state.romanceChoices.bond_q2_hiyori, undefined);
        } else assert(!final.state.flags._hiyori_bond_finale_done&&!final.state.finales.hiyori);
      }
      assert.equal(final.state.slot,2);
      const opening=final.events.find(e=>e.id==='hiyori_axe_reveal');
      const closing=final.events.find(e=>e.id==='hiyori_axe_reveal_close');
      assert.equal(opening.money,closing.money,'Payment must wait for closing VN');
      if(!workGoal) assert.equal(final.state.money,opening.money-3000);
      else {
        const work=final.events.find(e=>e.id==='hiyori_work_talk'),q=final.events.find(e=>e.id==='hiyori_bond_question');
        assert.equal(work.money,q.money);
        assert.equal(final.state.money,work.money,'Work dialogue must not add a separate fee');
      }
      assert(!closing.flags._hiyori_real_self_known);
      assert(!final.state.flags._confession_due);
      assert.deepEqual({ day: row.afterReply.day, slot: row.afterReply.slot, money: row.afterReply.money, affinity: row.afterReply.affinity }, row.beforeReply);
      assert(actions.some(a => a.affinity > 33 && a.held === 0), 'Natural paid visits can grow above heart3 without waiting for route completion');
      const stageReleased = final.state.flags._hiyori_affinity_stage_released_pts || 0;
      assert.equal(stageReleased,0);assert.equal(final.state.flags._hiyori_affinity_waiting_pts || 0,0);
      assert.equal(final.state.flags._hiyori_affinity_released_pts || 0, 0);
      assert(seen.has('intro'));
      assert.deepEqual(errors, []); assert.deepEqual(failedResources, []);
      await page.screenshot({ path: path.join(out, `${label}-complete-map.png`) });
      row.status = 'passed';
      console.log(`[hiyori-axe-natural] PASS ${label}: DAY${final.state.day}, affinity ${final.state.affinity.hiyori}, rescue ${final.state.flags._hiyori_affinity_released_pts}`);
    } catch (e) {
      row.status = 'failed'; row.error = e.stack; row.errors = errors; row.failedResources = failedResources; row.actions = actions;
      row.diagnostic = await page.evaluate(() => window.Q ? { state: Q.core.state, events: Q.events, current: Q.current } : null).catch(() => null);
      await page.screenshot({ path: path.join(out, `${label}-failed.png`) });
      console.error(e.stack);
    } finally { row.elapsedMs = Date.now() - Date.parse(row.startedAt); await context.close(); }
    // Preserve each completed device result if a later device is interrupted.
    fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, giftGoal, workGoal, results }, null, 2)+'\n');
  }
} finally {
  await browser.close();
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ base, giftGoal, workGoal, results }, null, 2)+'\n');
}
assert(results.length > 0, 'No device was selected');
assert.equal(results.filter(r => r.status !== 'passed').length, 0, 'Public walkthrough failures');
