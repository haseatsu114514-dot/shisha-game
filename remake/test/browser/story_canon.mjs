// 監査修正の会話を実際のVNで読み、選択・分岐・保存と旧セーブの扱いを確かめる。
import assert from 'node:assert/strict';
import {suite} from './support.mjs';

await suite('story-canon', async check => {
  await check('audience-and-naru-choices-persist-without-stat-rewards', async page => {
    const result = await page.evaluate(async () => {
      const core = await import('./js/core/state.js');
      const {DB} = await import('./js/core/data.js');
      const vn = await import('./js/vn/engine.js');
      (await import('./js/chapters/ch1.js')).setupHooks();
      for (const name of ['ch2_main', 'ch2_isolation', 'ch2_tournament', 'ch2_city']) {
        const data = await (await fetch(`../data/dialogue/${name}.json`)).json();
        for (const scene of data.dialogues) DB.dialogues[scene.dialogue_id] = scene;
      }
      const output = [];
      for (const choice of [0, 1]) {
        const state = core.newGame();
        Object.assign(state, {chapter: 2, day: 27, slot: 2});
        state.met = {hajime: true, sumi: true, naru: true, ageha: true, tsumugi: true};
        for (const id of Object.keys(state.met)) state.flags[`_intro_${id}`] = true;
        const before = structuredClone({stats: state.stats, money: state.money, lovers: state.lovers});
        vn.vnTest.turbo = true;
        vn.vnTest.choose = () => choice;
        await vn.play('ch2_naru_confrontation');
        await vn.play('ch2_pre_tournament_realisation');
        core.save();
        core.load();
        const lines = [];
        vn.hooks.onLine = (_id, line) => { if (line.text) lines.push(line.text); };
        await vn.play('ch2_tournament_tasteless');
        output.push({choice, flags: structuredClone(core.state.flags), before,
          after: structuredClone({stats: core.state.stats, money: core.state.money, lovers: core.state.lovers}), lines});
      }
      const state = core.newGame(); // 選択の印を持たない旧セーブ相当
      state.chapter = 2;
      const neutral = [];
      vn.hooks.onLine = (_id, line) => { if (line.text) neutral.push(line.text); };
      await vn.play('ch2_tournament_tasteless');
      // 第1章で審査員を見ているが任意の会話は未読、という再会。
      const reunion = [];
      vn.hooks.onLine = (_id, line) => { if (line.text) reunion.push(line.text); };
      await vn.play('ch2_city_arrival');
      return {output, neutral, reunion};
    });
    for (const row of result.output) assert.deepEqual(row.after, row.before);
    const [alone, welcome] = result.output;
    assert(alone.flags._ch2_no_audience && alone.flags._ch2_naru_listened);
    assert(!alone.flags._ch2_audience_welcome && !alone.flags._ch2_naru_hurt);
    assert.match(alone.lines.join('\n'), /来ないでほしいと送った/);
    assert(welcome.flags._ch2_audience_welcome && welcome.flags._ch2_naru_hurt);
    assert(!welcome.flags._ch2_no_audience && !welcome.flags._ch2_naru_listened);
    assert.match(welcome.lines.join('\n'), /つむぎが手を振って/);
    assert(!/空いた応援席|つむぎが手を振って/.test(result.neutral.join('\n')));
    for (const lines of [alone.lines, welcome.lines, result.neutral]) assert.match(lines.join('\n'), /おめでとう/);
    assert.match(result.reunion.join('\n'), /審査/);
    assert(!/どうして.*名前|私はチャコール博士/.test(result.reunion.join('\n')));
  }, {reducedMotion: 'reduce'});
});
