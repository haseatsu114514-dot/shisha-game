// The owner confirms Sumi is already the player's boss and LIME contact at the start.
import assert from 'node:assert/strict';
import { suite } from './support.mjs';

await suite('sumi-contact', async check => {
  for (const [label, options] of [['pc', {}], ['touch', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true }]]) {
    await check(`${label}-new-game-and-saves`, async page => {
      const result = await page.evaluate(async () => {
        const core = await import('./js/core/state.js');
        const phone = await import('./js/daily/phone.js');
        const initial = core.newGame();
        const defaults = { contacts: initial.contacts.slice(), story: { ...initial.story }, flags: { ...initial.flags } };
        const saved = [];
        for (const schema of [5, core.SCHEMA]) {
          for (const contacts of [[], ['hiyori', 'minto'], ['hiyori', 'sumi', 'minto']]) {
            const raw = { ...core.newState(), schema, chapter: 1, phase: 'daily', day: 9, slot: 0,
              contacts, money: 30000, lastBaitoDay: 9, affinity: { hiyori: 33, minto: 20 },
              story: { sumi: 0 }, met: { hiyori: true, sumi: true },
              flags: { _intro_hiyori: true, _lime_contact_hiyori: true,
                _hiyori_meeting_done: true, _hiyori_sumi_message_done: true,
                _hiyori_message_delivered: true, _hiyori_cracks_done: true, _hiyori_affinity_waiting_pts: 9 } };
            const source = JSON.stringify(raw);
            localStorage.setItem(core.SAVE_KEY, source);
            localStorage.setItem('suien_remake_slot1', source);
            core.load();
            const auto = { contacts: core.state.contacts.slice(), points: { ...core.state.affinity }, flags: { ...core.state.flags } };
            const rawPreserved = localStorage.getItem(core.SAVE_KEY) === source;
            core.loadFromSlot('suien_remake_slot1');
            core.save(); core.load();
            const s = core.state;
            saved.push({ schema, original: contacts.slice(), auto, rawPreserved,
              manual: { contacts: s.contacts.slice(), points: { ...s.affinity }, flags: { ...s.flags } },
              count: s.contacts.filter(id => id === 'sumi').length,
              story: s.story.sumi, known: !!s.flags._hiyori_real_self_known,
              invite: phone.morningMessages().some(m => m.accept_event === 'hiyori_tonari_return') });
          }
        }
        return { defaults, saved };
      });
      assert.deepEqual(result.defaults, { contacts: ['sumi'], story: {}, flags: {} });
      for (const row of result.saved) {
        const expected = row.original.includes('sumi') ? row.original : [...row.original, 'sumi'];
        assert.deepEqual(row.auto.contacts, expected); assert.deepEqual(row.manual.contacts, expected);
        assert.deepEqual(row.auto.points, { hiyori: 33, minto: 20 });
        assert.deepEqual(row.manual.points, row.auto.points); assert.deepEqual(row.manual.flags, row.auto.flags);
        assert.equal(row.count, 1); assert.equal(row.story, 0); assert(!row.known);
        assert(row.invite && row.rawPreserved, `No reunion invite for ${JSON.stringify(row)}`);
      }
    }, options);
  }
});
