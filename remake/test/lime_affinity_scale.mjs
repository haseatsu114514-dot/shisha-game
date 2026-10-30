// LIME返信の好感度を少量にする仕様の固定テスト（静的検査）。
// node --experimental-vm-modules --test remake/test/lime_affinity_scale.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';

const stats = await fs.readFile(new URL('../js/core/stats.js', import.meta.url), 'utf8');
const phone = await fs.readFile(new URL('../js/daily/phone.js', import.meta.url), 'utf8');

test('LIME倍率は整数丸めの後・端数繰り越しの前に掛かる', () => {
  assert.match(stats, /export const LIME_AFFINITY_SCALE = 0\.25;/);
  assert.match(stats, /Math\.round\(pts \* mult\) \* AFFINITY_PACE \* scale \+ \(state\.affinityCarry\[id\] \|\| 0\)/);
  assert.match(stats, /opts\.source === "lime" \? LIME_AFFINITY_SCALE : 1/);
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
  // 返信なしメッセージ（readReward）は従来どおり
  assert.match(phone, /gainAffinity\(m\.sender, 2\);/);
});
