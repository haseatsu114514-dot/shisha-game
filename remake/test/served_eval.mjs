import assert from 'node:assert/strict';
import { DB } from '../js/core/data.js';
import { temperatureBands } from '../js/craft/temperature-model.js';
import { servedTasteLine, servedStateLine, servedEvaluationLines } from '../js/craft/served-eval.js';

// 課題のレモン必須に合わせた最小カタログ（同系統合算の確認用に mint へ family を付ける）。
DB.flavorById = {
  lemon: { short_name: 'AF レモン', heat_tolerance: 1 },
  mint: { short_name: 'AF ミント', family: 'mint', heat_tolerance: 1 },
  cool_mint: { short_name: 'AF クールミント', family: 'mint', heat_tolerance: 1 },
  vanilla: { short_name: 'AF バニラ', heat_tolerance: 1 },
};

// --- 味の特徴：代表3配合が互いに違う言い方になり、どれも一律に個性を否定しない ---
const lemonSingle = servedTasteLine({ mix: { lemon: 12 } });
const lemonMint = servedTasteLine({ mix: { lemon: 8, mint: 4 } });
const vanillaLemon = servedTasteLine({ mix: { vanilla: 8, lemon: 4 } });
assert.match(lemonSingle, /レモンの香りが、まっすぐ立つ/);
assert.match(lemonMint, /レモンに、ミントが重なる/);
assert.match(vanillaLemon, /バニラに、レモンが重なる/);
assert.equal(new Set([lemonSingle, lemonMint, vanillaLemon]).size, 3, '代表3配合は別の一言になる');
for (const line of [lemonSingle, lemonMint, vanillaLemon]) assert(!/個性も薄い|華やかさはない/.test(line));
// メーカー表記は散文に出さない。
for (const line of [lemonSingle, lemonMint, vanillaLemon]) assert(!/AF |ドバジ /.test(line));

// 少量の葉を主役にしない（レモン11g＋バニラ1g はレモン単独扱い）。
assert.match(servedTasteLine({ mix: { lemon: 11, vanilla: 1 } }), /レモンの香りが、まっすぐ立つ/);
// 銘柄違いの同系統は合算して主役になる（ミント計5g＞レモン4g）。
assert.match(servedTasteLine({ mix: { lemon: 4, mint: 3, cool_mint: 2 } }), /ミントに、レモンが重なる/);
// 配合不明・空は中立文（品質を捏造しない）。
assert.match(servedTasteLine({ mix: {} }), /一口ずつ確かめる/);
assert.match(servedTasteLine({}), /一口ずつ確かめる/);

// --- 提供時の状態：良好帯／高い／低い／履歴不足 ---
const cs = { mix: { lemon: 12 } };
const bands = temperatureBands(cs);
assert.match(servedStateLine({ ...cs, pull: { temp: bands.center } }), /熱は落ち着いている/);
assert.match(servedStateLine({ ...cs, pull: { temp: bands.ideal[1] + 0.05 } }), /熱が前へ出る/);
assert.match(servedStateLine({ ...cs, pull: { temp: bands.ideal[0] - 0.05 } }), /香りはまだ遠い/);
// 温度未記録（旧セーブ・履歴不足）は中立文。
assert.match(servedStateLine({ ...cs, pull: {} }), /ここから、同じ一台を整えていく/);
assert.match(servedStateLine({ ...cs }), /ここから、同じ一台を整えていく/);
// 良好帯の状態文は、高い／低いと取り違えない。
assert.notEqual(servedStateLine({ ...cs, pull: { temp: bands.center } }),
  servedStateLine({ ...cs, pull: { temp: bands.ideal[1] + 0.05 } }));

// --- 差し込む行は地の文2行、計算・副作用なし ---
const input = { mix: { lemon: 8, mint: 4 }, pull: { temp: bands.center } };
const snapshot = JSON.stringify(input);
const lines = servedEvaluationLines(input);
assert.equal(lines.length, 2);
for (const l of lines) { assert.equal(l.speaker, ''); assert.equal(l.face, ''); assert(l.text.length); }
assert.equal(JSON.stringify(input), snapshot, '評価の生成でセッションを変えない');

console.log('PASS: served taste/state lines for representatives, high/low/good temps, neutral old-save');
