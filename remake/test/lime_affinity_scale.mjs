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

test('LIME返信の呼び出しだけが source: "lime" を付ける', () => {
  assert.match(phone, /gainAffinity\(m\.sender, points \* \(isLover\(m\.sender\) \? 3 : 1\), \{\s*source: "lime",/);
  assert.match(phone, /gainAffinity\(m\.sender, 1, \{ source: "lime" \}\)/);
  // 返信なしメッセージ（readReward）は従来どおり
  assert.match(phone, /gainAffinity\(m\.sender, 2\);/);
});
