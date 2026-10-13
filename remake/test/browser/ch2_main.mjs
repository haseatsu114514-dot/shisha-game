import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const evidence = fileURLToPath(new URL("../../../docs/qa/ch2-main/", import.meta.url));
fs.mkdirSync(evidence, { recursive: true });
const test = name => `[data-test="ch2-main-${name}"]`;
const preservedKeys = ["money", "stamina", "stats", "statXp", "owned", "equip", "flavors", "flavorStock", "affinity", "affinityCarry", "story", "visits", "visitedDay", "lovers", "loveLevel", "lovePts", "loveCarry", "loverSince", "lastDate", "loverEventsSeen", "relationshipMemories", "romance", "romanceChoices", "finales", "friendHangouts", "contacts", "inbox", "pendingInvite", "recipes", "keepsakes", "best", "reel", "kuji", "goods", "trpg", "notes", "usedBaito", "baitoRecent"];

async function setup(page, { knownDoctor = true, knownRei = false, legacy = false } = {}) {
  const before = await page.evaluate(async ({ knownDoctor, knownRei, legacy }) => {
    const core = await import('./js/core/state.js');
    const value = core.newGame();
    Object.assign(value, { chapter: 1, phase: 'cleared', day: 14, slot: 2, money: 45678, stamina: 67 });
    value.stats = { technique: 36, sense: 27, guts: 25, charm: 28, insight: 32 };
    value.statXp = { sense: .6 };
    value.flags._ch1_preview_seen = true;
    value.flags._minto_name_known = true;
    value.flags._minto_identity_known = true;
    value.met = { hajime: true, sumi: true, minto: true, tsumugi: true, dr_kemuri: knownDoctor, rei: knownRei };
    value.flags._intro_dr_kemuri = knownDoctor;
    value.flags._intro_rei = knownRei;
    // met is deliberately known without _met_*: name knowledge is not inferred from a spare flag.
    value.affinity = { tsumugi: 31, minto: 30 };
    value.affinityCarry = { tsumugi: .25 };
    value.flavors = ['double_apple', 'mint', 'blueberry'];
    value.flavorStock = { double_apple: 12.5, mint: 22, blueberry: 18 };
    value.lovers = ['tsumugi', 'minto']; value.contacts.push('minto');
    value.loverSince = { tsumugi: 11, minto: 13 }; value.lastDate = { tsumugi: 12 };
    value.loveLevel = { tsumugi: 2, minto: 1 }; value.lovePts = { tsumugi: 3, minto: 1 }; value.loveCarry = { tsumugi: .5 };
    value.relationshipMemories = ['tsumugi_creature'];
    value.story = { naru: 3 }; value.visits = { eden: 4 }; value.visitedDay = { eden: 13 };
    value.notes = { customer_memory: 2 }; value.usedBaito = ['regular_old']; value.recipes = { past_recipe: true };
    value.keepsakes = ['qa_keepsake']; value.goods = [{ name: 'qa_good', sell: 500 }];
    value.best = { heat: 2 }; value.reel.count = 9; value.reel.lastChapter = 1;
    value.trpg.owned = ['qa_book'];
    value.inbox = [{ id: 'qa_history', originId: 'qa_history', day: 13, read: true, done: true, replyState: 'none', log: [], msg: { sender: 'sumi', type: 'info', messages: ['previous chapter'] } }];
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    if (legacy) { const old = JSON.parse(localStorage.getItem(core.SAVE_KEY)); old.schema = 13; delete old.trpg; localStorage.setItem(core.SAVE_KEY, JSON.stringify(old)); }
    for (let i = 1; i <= 3; i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ ...value, savedAt: 1000 + i, money: 40000 + i }));
    window.__remake.vnTest.turbo = true;
    (await import('./js/chapters/ch1.js')).setupHooks();
    if (!legacy) await (await import('./js/chapters/ch1.js')).showClear();
    return structuredClone(value);
  }, { knownDoctor, knownRei, legacy });
  return { value: before, storage: await storageSnapshot(page) };
}

async function preserved(page, before, { loaded = false } = {}) {
  const value = await page.evaluate(() => structuredClone(window.__remake.state));
  for (const key of preservedKeys) {
    if (!loaded) assert.deepEqual(value[key], before.value[key], `Initial city story changed ${key}`);
  }
  const storage = await storageSnapshot(page);
  for (const key of ['suien_remake_slot1', 'suien_remake_slot2', 'suien_remake_slot3', 'suien_remake_config']) assert.equal(storage.local[key], before.storage.local[key], `Automatic progress overwrote ${key}`);
}

async function begin(page) {
  await page.locator('[data-test="end-chapter2"]').waitFor();
  await page.locator('[data-test="end-chapter2"]').click();
  await page.locator(test('map')).waitFor({ timeout: 20000 });
}
async function visit(page, id, inside = false, touch = false) {
  const pin = page.locator(test(`pin-${id}`));
  if (touch) await pin.tap(); else await pin.click();
  if (id !== 'c_station') {
    await page.locator(test('stop')).waitFor();
    await assertFits(page, `${test('inside')}, ${test('back-map')}`);
    const next = page.locator(test(inside ? 'inside' : 'back-map'));
    if (touch) await next.tap(); else await next.click();
  }
  await page.locator(test('map')).waitFor();
}
async function reloadSaved(page, slot = 0) {
  await page.reload();
  await page.locator('[data-test="title-load"]').click();
  await page.locator(`[data-test="slot-${slot}"]`).click();
}
async function screenshot(page, name) {
  await page.waitForFunction(() => !document.querySelector('#vn.active') && Number(getComputedStyle(document.getElementById('vn')).opacity) < .02);
  if (name === 'chapter1-clear.png') await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.end-title')).opacity) > .99);
  await page.screenshot({ path: path.join(evidence, name) });
}

await suite('ch2-main', async check => {
  await check('chapter-clear-to-city-preserves-progress', async page => {
    const before = await setup(page);
    await assertFits(page, '[data-test="end-chapter2"], [data-test="end-preview"], [data-test="end-title"]');
    await screenshot(page, 'chapter1-clear.png');
    await begin(page);
    const value = await page.evaluate(() => window.__remake.state);
    assert.equal(value.chapter, 2); assert.equal(value.day, 15); assert.equal(value.phase, 'daily');
    assert.equal(value.flags._ch1_cleared, true);
    assert.match(await page.locator('.ch2-kicker').textContent(), /DAY 1.*13日/);
    assert.equal(await page.locator(test('return')).isDisabled(), true);
    assert.equal(await page.locator(test('station')).isDisabled(), true);
    await assertFits(page, '.ch2-pin-title, .ch2-pin-caption, .ch2-pin-num, .ch2-map-summary, '+test('menu'));
    const overlap = await page.evaluate(() => {
      const panel = document.querySelector('.ch2-map-summary').getBoundingClientRect();
      return [...document.querySelectorAll('.ch2-pin')].map(node => {
        const r = node.getBoundingClientRect();
        return { name: node.textContent, area: Math.max(0, Math.min(r.right, panel.right) - Math.max(r.left, panel.left)) * Math.max(0, Math.min(r.bottom, panel.bottom) - Math.max(r.top, panel.top)) };
      });
    });
    for (const result of overlap) assert(result.area < 1, `Summary covers a destination: ${JSON.stringify(result)}`);
    await screenshot(page, 'city-day1.png');
    await preserved(page, before);
  });

  await check('touch-visits-rooms-and-first-day-ending', async page => {
    const before = await setup(page);
    await begin(page);
    for (const id of ['ageha', 'rei', 'c_station', 'kumicho']) await visit(page, id, id !== 'c_station', true);
    await page.locator(test('return')).tap();
    await page.locator(test('complete')).waitFor();
    const value = await page.evaluate(() => window.__remake.state);
    assert.equal(value.chapter, 2); assert.equal(value.day, 15); assert.equal(value.slot, 2);
    assert.equal(value.flags._ch2_day1.stage, 'complete');
    for (const id of ['ageha', 'rei', 'kumicho']) assert.equal(value.flags[`_ch2_city_inside_${id}`], true);
    assert.match(await page.locator(test('complete')).textContent(), /DAY13.*制作中/);
    await screenshot(page, 'touch-first-day-complete.png');
    await preserved(page, before);
    await reloadSaved(page);
    await page.locator(test('complete')).waitFor();
    assert.equal(await page.evaluate(() => window.__remake.state.day), 15, 'Loading completion advanced the date again');
    await preserved(page, before);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check('autosave-resumes-partial-city-without-replaying-opening', async page => {
    const before = await setup(page); await begin(page); await visit(page, 'rei', true);
    await reloadSaved(page); await page.locator(test('map')).waitFor();
    assert.equal(await page.locator(test('pin-rei')).getAttribute('data-read'), 'true');
    assert.equal(await page.locator(test('pin-ageha')).getAttribute('data-read'), 'false');
    assert.equal(await page.locator('#vn.active').count(), 0);
    assert.equal(await page.evaluate(() => window.__remake.state.day), 15);
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_city_inside_rei), true);
    await preserved(page, before);
  });

  await check('manual-save-caption-and-loading-earlier-city-point', async page => {
    const before = await setup(page); await begin(page); await visit(page, 'kumicho');
    // Clear only the fixture's first manual slot so the real overwrite flow is not bypassed.
    await page.evaluate(() => localStorage.removeItem('suien_remake_slot1'));
    await page.locator(test('menu')).click(); await page.locator(test('save')).click();
    await page.locator('[data-test="slot-1"]').click();
    await page.locator(test('map')).waitFor();
    await visit(page, 'c_station'); await page.locator(test('return')).click(); await page.locator(test('complete')).waitFor();
    await page.locator(test('menu')).click(); await page.locator(test('load')).click();
    assert.match(await page.locator('[data-test="slot-1"] .ss-info').textContent(), /第2章・DAY 1/);
    await page.locator('[data-test="slot-1"]').click(); await page.locator('[data-test="confirm-load"]').click();
    await page.locator(test('map')).waitFor();
    assert.equal(await page.locator(test('pin-kumicho')).getAttribute('data-read'), 'true');
    assert.equal(await page.locator(test('pin-c_station')).getAttribute('data-read'), 'false');
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_day1.stage), 'map');
    const storage = await storageSnapshot(page);
    for (const key of ['suien_remake_slot2','suien_remake_slot3','suien_remake_config']) assert.equal(storage.local[key], before.storage.local[key]);
  });

  await check('failed-data-load-keeps-chapter-one-clear-and-retries', async page => {
    const before = await setup(page);
    await page.route('**/data/dialogue/ch2_city.json', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{ invalid' }));
    await page.locator('[data-test="end-chapter2"]').click(); await page.locator(test('error')).waitFor();
    assert.equal(await page.evaluate(() => window.__remake.state.chapter), 1);
    assert.equal(await page.evaluate(() => window.__remake.state.phase), 'cleared');
    assert.equal((await storageSnapshot(page)).local.suien_remake_save, before.storage.local.suien_remake_save);
    await page.unroute('**/data/dialogue/ch2_city.json'); await page.locator(test('retry')).click();
    await page.locator(test('map')).waitFor({ timeout: 20000 });
    assert.equal(await page.evaluate(() => window.__remake.state.day), 15);
    await preserved(page, before);
  });

  await check('actual-name-knowledge-prevents-duplicate-meetings', async page => {
    await setup(page, { knownDoctor: true, knownRei: true }); await begin(page); await visit(page, 'rei');
    const text = await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().map(line => line.text).join('\n'));
    assert(!text.includes('私はチャコール博士'));
    assert(!text.includes('店長の、零。REI'));
    assert(text.includes('街を見てるのか'));
  });

  await check('unknown-doctor-introduces-himself-and-is-saved', async page => {
    const before = await setup(page, { knownDoctor: false }); await begin(page);
    const text = await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().map(line => line.text).join('\n'));
    assert(text.includes('私はチャコール博士'));
    assert.equal(await page.evaluate(() => window.__remake.state.met.dr_kemuri), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('suien_remake_save')).met.dr_kemuri), true);
    await preserved(page, before);
  });

  await check('reload-during-room-does-not-complete-unread-room', async page => {
    const before = await setup(page); await begin(page); await visit(page, 'rei');
    await page.locator(test('pin-rei')).click(); await page.locator(test('stop')).waitFor();
    await page.evaluate(() => { window.__remake.vnTest.turbo = false; });
    await page.locator(test('inside')).click(); await page.locator('#vn.active .vn-box').waitFor();
    await reloadSaved(page); await page.locator(test('map')).waitFor();
    assert.equal(await page.evaluate(() => !!window.__remake.state.flags._ch2_city_inside_rei), false);
    assert.equal(await page.locator(test('pin-rei')).getAttribute('data-read'), 'true');
    await preserved(page, before);
  });

  await check('legacy-cleared-save-can-enter-day-one', async page => {
    const before = await setup(page, { legacy: true });
    await reloadSaved(page); await page.locator('[data-test="end-chapter2"]').waitFor();
    await page.evaluate(() => { window.__remake.vnTest.turbo = true; });
    await begin(page);
    assert.equal(await page.evaluate(() => window.__remake.state.day), 15);
    await preserved(page, before, { loaded: true });
    const value = await page.evaluate(() => window.__remake.state);
    for (const key of ['money','flavorStock','lovers','loverSince','relationshipMemories']) assert.deepEqual(value[key], before.value[key]);
    assert.deepEqual(value.trpg, { ...before.value.trpg, owned: [] }, 'Old saves acquired unread TRPG records');
  });
});
