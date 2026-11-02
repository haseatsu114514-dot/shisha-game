// LIME返信の好感度を少量にする仕様の固定テスト（実処理・データ検査）。
// node --experimental-vm-modules --test remake/test/lime_affinity_scale.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const phone = await fs.readFile(new URL('../js/daily/phone.js', import.meta.url), 'utf8');

test('盤なしでは従来の整数丸め・LIME倍率・端数・占い消費を実処理で保つ', async () => {
  const storage = new Map();
  globalThis.localStorage = { getItem:k=>storage.get(k)??null, setItem:(k,v)=>storage.set(k,String(v)), removeItem:k=>storage.delete(k) };
  globalThis.document ||= { addEventListener() {} }; globalThis.window ||= {};
  const stateApi = await import('../js/core/state.js');
  const statApi = await import('../js/core/stats.js');
  const growthApi = await import('../js/core/growth.js');
  growthApi.setGrowthPreview(false);
  assert.equal(statApi.LIME_AFFINITY_SCALE,.25); assert.equal(statApi.AFFINITY_PACE,.85);
  for (const raw of [0,10,11,50,99,100]) for (const source of ['lime','ordinary']) for (const fortune of [false,true]) {
    const s = stateApi.newGame(); s.stats.charm=raw;
    if (fortune) s.fortune={char:'adam'};
    const tier=(Math.max(1,Math.min(10,Math.ceil(raw/10)))-1)/9;
    let expected=0;
    for (let i=0;i<24;i++) {
      const points=1+i%3, multiplier=(1+.2*tier)*(fortune&&i===0?1.5:1);
      expected+=Math.round(points*multiplier)*.85*(source==='lime'?.25:1);
      statApi.gainAffinity('adam',points,source==='lime'?{source:'lime',onGain(){}}:{});
      const actual=(s.affinity.adam||0)+(s.affinityCarry.adam||0);
      assert(Math.abs(actual-expected)<1e-9,`${raw}/${source}/${fortune}/${i}: ${actual} vs ${expected}`);
      assert.equal(s.fortune,undefined,'占いは最初の獲得時だけ消費する');
    }
    assert.equal(s.growth,undefined,'盤なしでは旧成長の保存形を変えない');
  }
});

test('返信が複数ある雑談LIMEは好感度が全選択肢同値になっていない (#1903)', async () => {
  const lime = JSON.parse(await fs.readFile(new URL('../../data/lime_messages.json', import.meta.url), 'utf8'));
  const lover = JSON.parse(await fs.readFile(new URL('../data/lover.json', import.meta.url), 'utf8'));
  const friends = JSON.parse(await fs.readFile(new URL('../data/friends.json', import.meta.url), 'utf8'));
  const groups = [];
  // #1903 で差を付けた lime_messages の chat 9件
  for (const id of ['lime_naru_day6', 'lime_minto_day5', 'lime_adam_day5', 'lime_after_outing_naru',
    'lime_after_outing_adam', 'lime_tsumugi_day8', 'lime_naru_day10', 'lime_minto_day12', 'lime_ch2_ageha_after_visit']) {
    const m = lime.messages.find((x) => x.id === id);
    assert.ok(m, `${id} が存在する`);
    groups.push([id, m.replies]);
  }
  for (const sec of ['privateAccount', 'morning', 'anniversary', 'gameday']) {
    for (const [char, node] of Object.entries(lover[sec] || {})) {
      for (const [i, e] of (Array.isArray(node) ? node : [node]).entries()) groups.push([`lover:${sec}/${char}[${i}]`, e.r]);
    }
  }
  for (const [char, node] of Object.entries(friends.friends)) {
    node.chats.forEach((e, i) => groups.push([`friends:${char}[${i}]`, e.r]));
  }
  for (const [label, replies] of groups) {
    if (!Array.isArray(replies) || replies.length < 2) continue; // 返信が1つだけのものは差を付けようがない
    const affs = replies.map((r) => r.affinity);
    assert.ok(affs.every((a) => Number.isInteger(a) && a >= 0 && a <= 2), `${label}: affinity は 0〜2`);
    assert.ok(new Set(affs).size > 1, `${label}: 全選択肢同値 (${affs}) になっていない`);
  }
});

test('LIME返信の呼び出しだけが source: "lime" を付ける', () => {
  assert.match(phone, /gainAffinity\(m\.sender, points \* \(isLover\(m\.sender\) \? 3 : 1\), \{\s*source: "lime",/);
  assert.match(phone, /gainAffinity\(m\.sender, 1, \{ source: "lime" \}\)/);
  // 返信なしメッセージ（readReward）は 2。恋人の読むだけの連絡は私的な絆として 3（LM01）。source は付けない
  assert.match(phone, /bond\.private = lover;\s*try \{\s*gainAffinity\(m\.sender, lover \? 3 : 2\);/);
});
