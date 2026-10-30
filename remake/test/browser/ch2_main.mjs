import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { suite, assertFits, storageSnapshot } from "./support.mjs";

const evidence = process.env.COMPARISON_DIR || fileURLToPath(new URL("../../../docs/qa/ch2-main/", import.meta.url));
fs.mkdirSync(evidence, { recursive: true });
const test = name => `[data-test="ch2-main-${name}"]`;
const preservedKeys = ["money", "stamina", "stats", "statXp", "owned", "equip", "flavors", "flavorStock", "affinity", "affinityCarry", "story", "visits", "visitedDay", "lovers", "loveLevel", "lovePts", "loveCarry", "loverSince", "lastDate", "loverEventsSeen", "relationshipMemories", "romance", "romanceChoices", "finales", "friendHangouts", "contacts", "inbox", "pendingInvite", "recipes", "keepsakes", "best", "reel", "kuji", "goods", "trpg", "usedBaito", "baitoRecent"];

async function setup(page, { knownDoctor = true, knownRei = false, legacy = false, knownTrpg = true } = {}) {
  const before = await page.evaluate(async ({ knownDoctor, knownRei, legacy, knownTrpg }) => {
    const core = await import('./js/core/state.js');
    const value = core.newGame();
    Object.assign(value, { chapter: 1, phase: 'cleared', day: 14, slot: 2, money: 45678, stamina: 67 });
    value.stats = { technique: 36, sense: 27, guts: 25, charm: 28, insight: 32 };
    value.statXp = { sense: .6 };
    // 現行の第1章クリア済みfixtureはDAY7に受け取った台を持つ。
    // 旧セーブからの付与はlegacyケースとhome_shisha.mjsで別に検証する。
    value.owned.push('home_rig_set');
    value.flags._ev_midcheck = true;
    value.flags._ch1_preview_seen = true;
    value.flags._minto_name_known = true;
    value.flags._minto_identity_known = true;
    // 第1章クリア済み。朝の通常地図へ進んでも初回LIME案内を再開しない。
    value.flags._lime_tut = 1;
    value.flags._lime_opened = true;
    value.met = { hajime: true, sumi: true, minto: true, tsumugi: true, dr_kemuri: knownDoctor, rei: knownRei };
    value.flags._intro_dr_kemuri = knownDoctor;
    value.flags._intro_rei = knownRei;
    // met is deliberately known without _met_*: name knowledge is not inferred from a spare flag.
    value.affinity = { tsumugi: 31, minto: 30 };
    value.affinityCarry = { tsumugi: .25 };
    value.flavors = ['double_apple', 'mint', 'blueberry'];
    value.flavorStock = { double_apple: 12.5, mint: 22, blueberry: 18 };
    // story.naru=3は2本目の交換シーンも読了済み。朝のhasContactによる旧保存補完前から整合させる。
    value.lovers = ['tsumugi', 'minto']; value.contacts.push('minto', 'naru');
    value.loverSince = { tsumugi: 11, minto: 13 }; value.lastDate = { tsumugi: 12 };
    value.loveLevel = { tsumugi: 2, minto: 1 }; value.lovePts = { tsumugi: 3, minto: 1 }; value.loveCarry = { tsumugi: .5 };
    value.relationshipMemories = ['tsumugi_creature'];
    value.story = { naru: 3 }; value.visits = { eden: 4 }; value.visitedDay = { eden: 13 };
    value.usedBaito = ['regular_old']; value.recipes = { past_recipe: true };
    value.keepsakes = ['qa_keepsake']; value.goods = [{ name: 'qa_good', sell: 500 }];
    value.best = { heat: 2 }; value.reel.count = 9; value.reel.lastChapter = 1;
    value.trpg.owned = knownTrpg ? ['qa_book'] : [];
    value.inbox = [{ id: 'qa_history', originId: 'qa_history', day: 13, read: true, done: true, replyState: 'none', log: [], msg: { sender: 'sumi', type: 'info', messages: ['previous chapter'] } }];
    Object.assign(core.config, { textSpeed: 4, bgmVolume: 0, seVolume: 0, voiceBlip: false }); core.saveConfig();
    core.save();
    if (legacy) {
      const old = JSON.parse(localStorage.getItem(core.SAVE_KEY));
      old.schema = 13; delete old.trpg;
      old.owned = old.owned.filter(id => id !== 'home_rig_set');
      localStorage.setItem(core.SAVE_KEY, JSON.stringify(old));
    }
    for (let i = 1; i <= 3; i++) localStorage.setItem(`suien_remake_slot${i}`, JSON.stringify({ ...value, savedAt: 1000 + i, money: 40000 + i }));
    window.__remake.vnTest.turbo = true;
    (await import('./js/chapters/ch1.js')).setupHooks();
    if (!legacy) await (await import('./js/chapters/ch1.js')).showClear();
    return structuredClone(value);
  }, { knownDoctor, knownRei, legacy, knownTrpg });
  return { value: before, storage: await storageSnapshot(page) };
}

async function preserved(page, before, { loaded = false } = {}) {
  const value = await page.evaluate(() => structuredClone(window.__remake.state));
  for (const key of preservedKeys) {
    if (value.day > 15 && key === 'stamina') {
      assert.equal(value.stamina, Math.min(await page.evaluate(async () => (await import('./js/core/stats.js')).maxStamina()), before.value.stamina + 14));
      continue;
    }
    if (value.day > 15 && key === 'inbox') {
      for (const item of before.value.inbox) assert.deepEqual(value.inbox.find(row => row.id === item.id), item);
      assert.equal(new Set(value.inbox.map(item => item.id)).size, value.inbox.length);
      continue;
    }
    if (!loaded) {
      const expected = key === 'keepsakes' && value.flags._ageha_first_purikura
        ? [...new Set([...before.value[key], 'ageha_first_purikura'])] : before.value[key];
      assert.deepEqual(value[key], expected, `Initial city story changed ${key}`);
    }
  }
  const storage = await storageSnapshot(page);
  for (const key of ['suien_remake_slot1', 'suien_remake_slot2', 'suien_remake_slot3', 'suien_remake_config']) assert.equal(storage.local[key], before.storage.local[key], `Automatic progress overwrote ${key}`);
}

async function begin(page) {
  await page.locator('[data-test="end-chapter2"]').waitFor();
  await page.locator('[data-test="end-chapter2"]').click();
  await page.locator(test('map')).waitFor({ timeout: 20000 });
}
async function watchMusic(page) {
  await page.evaluate(async () => {
    const audio = await import('./js/core/audio.js');
    const vn = await import('./js/vn/engine.js');
    const previous = vn.hooks.onLine;
    window.__ch2SceneMusic = [];
    vn.hooks.onLine = (id, line) => {
      previous?.(id, line);
      if (window.__ch2SceneMusic.at(-1)?.id !== id) window.__ch2SceneMusic.push({ id, key: audio.currentBgm() });
    };
  });
}
const musicOf = page => page.evaluate(async () => (await import('./js/core/audio.js')).currentBgm());
async function visit(page, id, inside = false, touch = false) {
  const pin = page.locator(test(`pin-${id}`));
  if (touch) await pin.tap(); else await pin.click();
  if (touch) await page.locator(test("go")).tap(); else await page.locator(test("go")).click();
  if (id === 'c_station') {
    await page.locator('[data-test="rule-sheet"]').waitFor();
    assert.match(await page.locator('[data-test="rule-sheet"]').innerText(), /ストロベリー/);
    if (touch) await page.locator('[data-test="rule-sheet-close"]').tap(); else await page.locator('[data-test="rule-sheet-close"]').click();
    await page.locator(test('map')).waitFor();
    return;
  }
  // 配達（J05: そのまま店内→地図）は再描画された地図でピンが訪問済みになる。通常訪問は店頭カードが出る。
  // turbo で一気に進んでも取りこぼさないよう、開始時と区別できる安定状態を待つ。
  await page.waitForFunction(sel => {
    if (document.querySelector('[data-test="ch2-main-stop"]')) return true;
    const pin = document.querySelector(sel);
    return !!pin && pin.getAttribute('data-read') === 'true';
  }, test(`pin-${id}`));
  if (await page.locator(test('stop')).count()) {
    await assertFits(page, `${test('inside')}, ${test('back-map')}`);
    const next = page.locator(test(inside ? 'inside' : 'back-map'));
    if (touch) await next.tap(); else await next.click();
    await page.locator(test('map')).waitFor();
  }
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
  await check('specified-dialogue-music-restores-the-scene-track', async page => {
    await page.mouse.click(1, 1); // 実操作で既存AudioContextを解放する。
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); core.newGame();
      const audio = await import('./js/core/audio.js');
      const vn = await import('./js/vn/engine.js');
      await (await import('./js/chapters/ch2-city-data.js')).loadPreparationDialogues();
      audio.playBgm('tonari'); vn.vnTest.turbo = true;
      window.__specifiedMusic = [];
      vn.hooks.onLine = id => { if (id === 'ch2_slump_taste') window.__specifiedMusic.push(audio.currentBgm()); };
      await vn.play('ch2_slump_taste');
    });
    const music = await page.evaluate(() => window.__specifiedMusic);
    assert(music.length > 0);
    assert(music.every(key => key === 'bgm_taste_distant'), 'Existing dialogue-specific music must remain in effect');
    assert.equal(await musicOf(page), 'tonari', 'Dialogue completion returns to its existing scene track');
  });
  await check('chapter-clear-to-city-preserves-progress', async page => {
    const before = await setup(page);
    await watchMusic(page);
    await assertFits(page, '[data-test="end-chapter2"], [data-test="end-preview"], [data-test="end-title"]');
    await screenshot(page, 'chapter1-clear.png');
    await begin(page);
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee', 'Chapter 2 city must replace tournament aftermath music');
    const music = await page.evaluate(() => window.__ch2SceneMusic);
    assert.equal(music.find(row => row.id === 'remake_ch2_departure')?.key, 'tonari');
    assert.equal(music.find(row => row.id === 'ch2_city_arrival')?.key, 'kansetsu_shomei_to_black_coffee');
    const value = await page.evaluate(() => window.__remake.state);
    assert.equal(value.chapter, 2); assert.equal(value.day, 15); assert.equal(value.phase, 'daily');
    assert.equal(value.flags._ch1_cleared, true);
    assert.match(await page.locator('.dc-day').textContent(), /^1\/14$/);
    assert.match(await page.locator('.dc-meta').textContent(), /あと13日/);
    await page.locator(test('station')).click();
    assert.equal(await page.locator(test('go')).count(), 0, 'Return remains unavailable before deliveries and venue');
    assert.match(await page.locator('.map-info .mi-desc').innerText(), /県大会ホールの入口と搬入場所も確認しよう。/);
    assert.doesNotMatch(await page.locator('.ch2-route-note').innerText(), /県大会ホールの入口と搬入場所も確認しよう。/);
    assert.equal(await page.locator('.map-info .mi-no').count(), 0, 'Station guidance appears once');
    assert.doesNotMatch(await page.locator('.map-info').innerText(), /null|undefined/);
    await assertFits(page, '.spot-pin .sub-label, .ch2-route-note, .map-info, '+test('menu'));
    const overlap = await page.evaluate(() => {
      const panel = document.querySelector('.ch2-route-note').getBoundingClientRect();
      return [...document.querySelectorAll('.spot-pin')].map(node => {
        const r = node.getBoundingClientRect();
        return { name: node.textContent, area: Math.max(0, Math.min(r.right, panel.right) - Math.max(r.left, panel.left)) * Math.max(0, Math.min(r.bottom, panel.bottom) - Math.max(r.top, panel.top)) };
      });
    });
    for (const result of overlap) assert(result.area < 1, `Summary covers a destination: ${JSON.stringify(result)}`);
    await screenshot(page, 'city-day1.png');
    await preserved(page, before);
  });

  await check('touch-visits-rooms-and-first-day-ending', async page => {
    const before = await setup(page, { knownTrpg: false });
    await watchMusic(page);
    await begin(page);
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee');
    for (const id of ['ch2_aquarium', 'ch2_sento', 'trpg_bar']) assert.equal(await page.locator(test(`pin-${id}`)).count(), 0, 'A meeting is not a spot introduction');
    for (const id of ['ageha', 'rei', 'c_station', 'kumicho']) await visit(page, id, id !== 'c_station', true);
    for (const id of ['ageha', 'rei', 'kumicho']) {
      const music = await page.evaluate(() => window.__ch2SceneMusic);
      assert.equal(music.find(row => row.id === `ch2_city_${id}_inside`)?.key, 'kansetsu_shomei_to_black_coffee');
    }
    for (const id of ['ch2_aquarium', 'ch2_sento', 'trpg_bar']) assert.equal(await page.locator(test(`pin-${id}`)).count(), 1);
    await screenshot(page, 'city-discovered-spots.png');
    await page.locator(test('station')).tap();
    assert.match(await page.locator('.map-info .mi-desc').innerText(), /三軒への配達と会場の確認を終えた。/);
    assert.doesNotMatch(await page.locator('.ch2-route-note').innerText(), /三軒への配達と会場の確認を終えた。/);
    await page.locator(test('go')).tap();
    await page.locator('[data-test="ch2-morning-home"]').waitFor();
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee');
    const value = await page.evaluate(() => window.__remake.state);
    assert.equal(value.chapter, 2); assert.equal(value.day, 16); assert.equal(value.slot, 0);
    assert.equal(value.flags._ch2_day1.stage, 'complete');
    assert.deepEqual(value.flags._ch2_deliveries.done, { ageha: true, rei: true, kumicho: true });
    assert.equal(value.flags._ch2_deliveries.reported, true);
    assert.equal(value.keepsakes.filter(id => id === 'ageha_first_purikura').length, 1);
    for (const id of ['ageha', 'rei', 'kumicho']) assert.equal(value.flags[`_ch2_city_inside_${id}`], true);
    assert.equal(await page.locator(test('next-day')).count(), 0);
    await screenshot(page, 'touch-first-day-complete.png');
    await preserved(page, before);
    await reloadSaved(page);
    await page.locator('[data-test="ch2-morning-home"]').waitFor();
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee', 'LOAD after sleep restores morning music');
    assert.equal(await page.evaluate(() => window.__remake.state.day), 16, 'Loading completion advanced the date again');
    await preserved(page, before);
  }, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });

  await check('autosave-resumes-partial-city-without-replaying-opening', async page => {
    const before = await setup(page); await begin(page); await visit(page, 'rei', true);
    await reloadSaved(page); await page.locator(test('map')).waitFor();
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee', 'LOAD in the city must replace title music');
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
    await visit(page, 'c_station');
    await page.locator(test('station')).click();
    assert.match(await page.locator('.map-info .mi-desc').innerText(), /残りの包みを届けてから、スミさんへ報告しよう。/);
    assert.doesNotMatch(await page.locator('.ch2-route-note').innerText(), /残りの包みを届けてから、スミさんへ報告しよう。/);
    assert.equal(await page.locator(test('go')).count(), 0);
    await visit(page, 'ageha'); await visit(page, 'rei'); await page.locator(test('station')).click(); await page.locator(test('go')).click(); await page.locator('[data-test="ch2-morning-home"]').waitFor();
    await page.locator('[data-test="ch2-morning-home"]').click();
    await page.locator('[data-destination-selection]:not(.done)').waitFor();
    await page.locator('[data-test="hud-menu"]').click(); await page.locator('[data-test="menu-load"]').click();
    assert.match(await page.locator('[data-test="slot-1"] .ss-info').textContent(), /第2章\s*DAY 1(?!\d)/);
    await page.locator('[data-test="slot-1"]').click(); await page.locator('[data-test="confirm-load"]').click();
    await page.locator(test('map')).waitFor();
    assert.equal(await musicOf(page), 'kansetsu_shomei_to_black_coffee', 'MENU LOAD restores the city track');
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

  await check('missing-doctor-met-flag-still-remembers-chapter-one-judge', async page => {
    const before = await setup(page, { knownDoctor: false }); await begin(page);
    const text = await page.evaluate(async () => (await import('./js/vn/engine.js')).backlog().map(line => line.text).join('\n'));
    assert(text.includes('地元大会以来だね'));
    assert(text.includes('審査のあとも'));
    assert(!text.includes('私はチャコール博士'));
    assert(!text.includes('どうして俺の名前を'));
    assert.equal(await page.evaluate(() => window.__remake.state.met.dr_kemuri), true);
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('suien_remake_save')).met.dr_kemuri), true);
    await preserved(page, before);
  });

  await check('reload-during-delivery-room-does-not-complete-unread-room', async page => {
    const before = await setup(page); await begin(page);
    // J05の配達導線はそのまま店内へ入る。店内に入った瞬間に送りを止め、未読のままリロードする。
    await page.evaluate(async () => {
      const vn = await import('./js/vn/engine.js');
      const prev = vn.hooks.onEnter;
      vn.hooks.onEnter = (id, target) => { prev?.(id, target); if (id === 'ch2_city_rei_inside') window.__remake.vnTest.turbo = false; };
    });
    await page.locator(test('pin-rei')).click(); await page.locator(test('go')).click();
    // 挨拶→配達の受け渡しを turbo で抜け、店内会話に入って止まるのを待つ（店頭カードは挟まない）。
    await page.waitForFunction(() => window.__ch2Main?.scene === 'ch2_city_rei_inside');
    await page.locator('#vn.active .vn-box').waitFor();
    assert.equal(await page.locator(test('stop')).count(), 0, '配達は店頭カードを挟まず店内へ入る');
    // 店内に入る前に配達の受け渡しは確定済み。中断で面識・配達完了は巻き戻らない。
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_deliveries.done.rei), true);
    assert.equal(await page.evaluate(() => window.__remake.state.met.rei), true);
    await reloadSaved(page); await page.locator(test('map')).waitFor();
    assert.equal(await page.evaluate(() => !!window.__remake.state.flags._ch2_city_inside_rei), false, '未読の店内は完了扱いにしない');
    assert.equal(await page.evaluate(() => window.__remake.state.flags._ch2_deliveries.done.rei), true);
    assert.equal(await page.evaluate(() => window.__remake.state.met.rei), true, '完読した顔合わせの面識は残る');
    assert.equal(await page.locator(test('pin-rei')).getAttribute('data-read'), 'true');
    assert.equal(await page.locator(test('pin-rei')).locator('.pin-status').textContent(), 'お届け済み');
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
    for (const key of ['money','stamina','stats','statXp','owned','equip','flavors','flavorStock','lovers','loverSince','relationshipMemories']) assert.deepEqual(value[key], before.value[key]);
    assert.equal(value.owned.filter(id => id === 'home_rig_set').length, 1, 'Legacy migration grants exactly one tabletop rig');
    assert.deepEqual(value.trpg, { ...before.value.trpg, owned: [] }, 'Old saves acquired unread TRPG records');
  });
  await check('city-shop-purchases-and-discovery-boundary', async page => {
    await setup(page, { knownTrpg: false }); await begin(page);
    const initial = await page.evaluate(() => structuredClone(__remake.state));
    assert.equal(await page.evaluate(async () => (await import('./js/daily/trpg.js')).trpgSpot()), null);
    assert.equal(await page.evaluate(async () => (await (await import('./js/daily/trpg.js')).openTrpgBar()).completed), false);
    await page.locator(test('pin-ch2_shop')).click(); await page.locator(test('go')).click();
    await page.locator('[data-test="buy-strawberry"]').waitFor();
    assert.match(await page.locator('.shop-head').textContent(), /Dr.fookah 柚ヶ谷店/);
    assert.equal(await page.locator('[data-test="shop-upstairs"]').count(), 0, 'Rin is not teleported to the branch');
    await page.locator('[data-test="buy-strawberry"]').click();
    assert.equal(await page.evaluate(() => __remake.state.money), initial.money, 'Selecting is not purchasing');
    await page.locator('[data-test="shop-checkout"]').click();
    const after = await page.evaluate(() => structuredClone(__remake.state));
    assert.equal(after.money, initial.money - 1550); assert.equal(after.flavorStock.strawberry, 50);
    assert.equal(after.day, initial.day); assert.equal(after.slot, initial.slot);
    await page.locator('[data-test="shop-leave"]').click(); await page.locator(test('map')).waitFor();
    await page.locator(test('pin-ch2_c_station')).click(); await page.locator(test('go')).click();
    await page.locator(test('map')).waitFor();
    await page.waitForFunction(() => __remake.state.flags._ch2_looked_ch2_c_station);
    const branch = await page.evaluate(() => structuredClone(__remake.state));
    assert(branch.flags._ch2_looked_ch2_c_station);
    assert.equal(branch.flags._ch2_city_visit_c_station, undefined, 'The branch is distinct from checking the tournament hall');
    assert.equal(branch.money, after.money); assert.equal(branch.slot, after.slot);
    await visit(page, 'rei');
    assert.equal(await page.locator(test('pin-trpg_bar')).count(), 1);
    await page.reload(); await page.locator('[data-test="title-load"]').click(); await page.locator('[data-test="slot-0"]').click();
    await page.locator(test('map')).waitFor();
    assert.equal(await page.locator(test('pin-trpg_bar')).count(), 1, 'Actual discovery survives reload');
    assert.equal(await page.evaluate(() => __remake.state.flavorStock.strawberry), 50);
  });

  await check('purikura-actual-known-guest-solo-and-skip', async page => {
    await page.evaluate(async () => {
      const core = await import('./js/core/state.js'); const v = core.newGame();
      Object.assign(v, { chapter: 2, phase: 'daily', day: 16, slot: 0, money: 12345, stamina: 80 });
      v.met = { hajime: true, ageha: true, kumicho: true };
      Object.assign(v.flags, { _ch2_day1: { startDay: 15 }, _ageha_first_purikura: true });
      __remake.vnTest.turbo = true;
      await (await import('./js/chapters/ch2-city-data.js')).loadChapterTwoDialogues();
      const vn = await import('./js/vn/engine.js'); window.__photoTrace = [];
      vn.hooks.onLine = (id, line) => window.__photoTrace.push({ id, text: line.text });
      window.__offerPhoto = async () => {
        const { offerAgehaPurikura } = await import('./js/chapters/ch2-purikura.js');
        const { ROOMS } = await import('./js/chapters/ch2-city-data.js');
        window.__photoDone = false;
        await offerAgehaPurikura(ROOMS.ageha); window.__photoDone = true;
      };
      void window.__offerPhoto();
    });
    await page.locator('[data-test="purikura-guest"]').click();
    assert.equal(await page.locator('[data-test^="purikura-with-"]').count(), 1);
    await page.locator('[data-test="purikura-with-kumicho"]').click();
    await page.locator('[data-test="purikura-receive"]').click();
    await page.waitForFunction(() => window.__photoDone);
    let v = await page.evaluate(() => structuredClone(__remake.state));
    assert(v.flags._ryuji_melty_greeting); assert(v.keepsakes.includes('ryuji_purikura'));
    assert.deepEqual(v.flags._ageha_purikura_history[0].people, ['hajime', 'kumicho']);
    assert.equal(v.money, 12345 - 400); assert.equal(v.stamina, 80); assert.equal(v.slot, 0);
    const trace = await page.evaluate(() => window.__photoTrace);
    assert(trace.some(row => row.id === 'remake_ch2_ryuji_melty_greeting'));
    assert(trace.some(row => row.text?.includes('左右の高さ')));
    await page.evaluate(() => { __remake.state.slot = 1; void window.__offerPhoto(); });
    await page.locator('[data-test="purikura-solo"]').waitFor();
    assert.equal(await page.locator('[data-test="purikura-guest"]').count(), 0, 'A past visitor is not a current guest');
    await page.locator('[data-test="purikura-solo"]').click();
    await page.locator('[data-test="purikura-receive"]').click();
    await page.waitForFunction(() => window.__photoDone);
    assert(await page.evaluate(() => __photoTrace.some(row => row.text?.includes('うちですらやったことないのに'))));
    assert.equal(await page.evaluate(() => __remake.state.money), 12345 - 800, 'Each completed repeat photo costs 400 yen');
    await page.evaluate(() => { __remake.state.slot = 2; void window.__offerPhoto(); });
    await page.locator('[data-test="purikura-skip"]').click();
    await page.waitForFunction(() => window.__photoDone);
    v = await page.evaluate(() => structuredClone(__remake.state));
    assert.equal(v.money, 12345 - 800, 'Declining does not charge for a photo');
    assert.equal(v.flags._ageha_purikura_history.length, 2, 'Declining does not create a photo');
    assert.equal(v.keepsakes.filter(id => id === 'ryuji_purikura').length, 1);
    await page.evaluate(async () => {
      const { purikuraGuests } = await import('./js/chapters/ch2-purikura.js');
      __remake.state.slot = 0; __remake.state.met.kumicho = false;
      window.__unknownPhotoGuests = purikuraGuests({ id: 'ch2_ageha', kind: 'rival', charId: 'ageha' });
    });
    assert.deepEqual(await page.evaluate(() => __unknownPhotoGuests), [], 'Unacquainted guests are excluded');
  });

  await check('ds-small-city-map-and-stop-controls', async page => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.locator('[data-test="title-layout-settings"]').tap();
    await page.locator('[data-test="title-layout-ds"]').tap();
    await setup(page, { knownTrpg: false });
    await begin(page);
    await page.setViewportSize({ width: 320, height: 568 });
    for (const id of ['ageha', 'kumicho', 'rei']) {
      await page.locator(test(`pin-${id}`)).scrollIntoViewIfNeeded();
      await assertFits(page, test(`pin-${id}`));
    }
    await page.locator(test('pin-rei')).tap();
    await page.locator(test('go')).scrollIntoViewIfNeeded();
    await assertFits(page, '[data-test="ch2-main-go"]');
    await page.locator(test('go')).tap();
    // J05: 配達は店頭カードを挟まず、そのまま店内→地図へ戻る（訪問済みで戻るのを待つ）。
    await page.waitForFunction(() => document.querySelector('[data-test="ch2-main-pin-rei"]')?.getAttribute('data-read') === 'true');
    // 配達後の再訪では従来の店頭カードが出る。小画面でも操作が収まる。
    await page.locator(test('pin-rei')).tap();
    await page.locator(test('go')).tap();
    await page.locator(test('stop')).waitFor();
    await page.locator(test('back-map')).scrollIntoViewIfNeeded();
    await assertFits(page, '[data-test="ch2-main-back-map"]');
    await page.locator(test('back-map')).tap();
    await page.locator(test('map')).waitFor();
    await page.screenshot({ path: path.join(evidence, 'ds-small-city-map.png') });
  }, { viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });

});
