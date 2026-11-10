// カード効果を使わないときの点の伸びを数える（第0.1版の数値の確認用）。
// 使い方: node economy_sim.mjs
// 前提: 準備8ターン（詰める=3枚/ターン、蒸らす=1枚引いて炭3枚まで）、提供は毎ターン熱-1・1枚引く、
//       調整は葉-2・1枚引く・炭3枚まで安全。ミックスと相性は最後まで続くものとして数える。
import { createRequire } from 'node:module';
const { FLAVORS } = createRequire(import.meta.url)('./cards.js');

const zone = (f, h) => (h >= f.s ? 'scorch' : f.j.includes(h) ? 'just' : h >= f.lo && h <= f.hi ? 'band' : h === f.lo - 1 || h === f.hi + 1 ? 'off' : 'cold');
const pts = (f, h, bonus) => { const z = zone(f, h); return z === 'just' ? f.t + 2 + bonus : z === 'band' ? f.t + bonus : z === 'off' ? 1 : 0; };
const session = (f, h0, bonus) => ([1, 2, 3].some((k) => zone(f, h0 - k) === 'scorch') ? -99 : [1, 2, 3].reduce((a, k) => a + pts(f, h0 - k, bonus), 0));
const bestStart = (f, bonus) => [...Array(11).keys()].reduce((b, h) => (session(f, h, bonus) > session(f, b, bonus) ? h : b), 0);

function game(f, grams, sessions) {
  const bonus = f.id === 'spring_water' ? 0 : 1 + (f.pair === 'none' ? 0 : 1); // ミックス+相性
  const h0 = bestStart(f, bonus);
  let hand = 5, heat = 3, leaves = grams, total = 0;
  for (let t = Math.ceil(grams / 3); t < 8; t++) { hand++; const add = Math.max(0, Math.min(3, h0 - heat, hand)); heat += add; hand -= add; }
  for (let s = 0; s < sessions; s++) {
    for (let k = 0; k < 3; k++) {
      heat = Math.max(0, heat - 1); hand++;
      const z = zone(f, heat);
      total += pts(f, heat, bonus) + (leaves >= 10 && (z === 'just' || z === 'band') ? 1 : 0);
    }
    if (s < sessions - 1) {
      leaves -= 2; hand++;
      const need = h0 - heat;
      if (need > 3) leaves--; // 急加熱を受け入れて戻す
      const add = Math.max(0, Math.min(need, hand)); heat += add; hand -= add;
    }
  }
  return { total, hand };
}

console.log('1セッションの基礎点（ミックス+相性、濃厚なし）と立ち上げの熱');
for (const f of FLAVORS) {
  const bonus = f.id === 'spring_water' ? 0 : 1 + (f.pair === 'none' ? 0 : 1);
  const h0 = bestStart(f, bonus);
  console.log(`  ${f.n.padEnd(11, '　')} ${String(session(f, h0, bonus)).padStart(2)}点  熱${h0}`);
}
console.log('\nグラム数ごとの合計点／終了時に残る手札（カードに使える枚数のめやす）');
for (const id of ['lemon', 'rose', 'vanilla', 'double_apple', 'coffee']) {
  const f = FLAVORS.find((x) => x.id === id);
  for (const n of [3, 4, 6]) {
    console.log(`  ${f.n} ${n}セッション: ` + [8, 12, 15, 18, 20].map((g) => { const r = game(f, g, n); return `${g}g ${r.total}点/手札${r.hand}`; }).join('  '));
  }
}
