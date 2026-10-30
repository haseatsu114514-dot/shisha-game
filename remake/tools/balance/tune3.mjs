// 3能力（才能・感覚・理論）の釣り合いを、配合・熟練度・器具をばらした条件と「会心」込みで測る（Issue #1773）。
// 元: docs/stat-design/levelup-ux/balance/tune3.mjs（REPORT 18・19章）と remake/tools/balance/measure.mjs。
// ゲーム本体のファイルは変えない。係数の差し替えは Node のローダーでメモリ上だけ行う。
//
// 使い方（リポジトリのルートから）:
//   node remake/tools/balance/tune3.mjs                    # 既定のセル（基準・各能力3段/5段・会心）を表で出す
//   node remake/tools/balance/tune3.mjs --fixed            # ばらつき無し（measure.mjs と同じ固定条件）
//   node remake/tools/balance/tune3.mjs --sweep            # 各能力をマス0〜12（1〜5段）で1マスずつ
//   node remake/tools/balance/tune3.mjs --masu 12,0,0      # 才・感・理をマス（0〜27）で直接指定した1セル
//   node remake/tools/balance/tune3.mjs --dan 5,1,1        # 才・感・理を段（1〜10）で直接指定した1セル
//   node remake/tools/balance/tune3.mjs --dan 1,5,1 --skill kaishin   # 感覚5段＋会心の一服
//   --n 2000（各セルの試行数。seed 1〜n）・--json（JSONで出す）・--opscale 0.8（中操作の誤差幅を倍率で変える）
//   --only 才能（既定セルを基準＋名前に含むものに絞る）・--breakdown（基準セルの配合・器具・熟練度ごとの勝率）
//
// 連続効果の割合 t は「灯した能力のマス ÷ 27」（ADDENDUM-BOARD-LAYOUT 22章）。段 n はマス 3(n−1) と同じ（3段＝6マス・5段＝12マス）。
//
// 係数（環境変数。既定は 2026-10-30 の採用値。結果ファイル results/2026-10-30-3stats.md）:
//   W   感覚: ジャスト帯 1+W·t（今のゲームは sense に 0.45）。感覚は蒸らしの当たり判定（今の guts）も t で効く
//   TS  理論: ゲージ 1+TS·t（今のゲームは technique に 0.18）。理論は蒸らしの弾の間隔（今の insight）も t で効く
//   K   理論: 炭・温度の読み違い（操作誤差の幅）が最大 K だけ減る（clarity のモデル）
//   G   理論: 熟練度の経験値 ×(1+G·t)（同じ練習量でも熟練度が早く伸びる）
//   L   理論: 吸いすぎでの葉の傷み ×(1−L·t)（flavor-life.js の LEAF_DAMAGE.perOverPull に掛ける）
//   SA  才能: 「審査員の第一印象」総合への加点（10段での点）。SP は効き方の曲がり（加点 = SA·t^SP）
//   SM  才能: 完成品・調整1/2回目の点に掛ける倍率（10段で 1+SM）。SA と併用可
//   KAI 会心の一服: 会心1回あたり、その工程の点への上振れ（点）
//   KZ  会心の一服: ジャスト帯（吸い出しは最適帯）の中心から半幅の KZ 倍以内で会心
import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const env = (k, d) => (process.env[k] === undefined || process.env[k] === '' ? d : Number(process.env[k]));
export const COEF = {
  W: env('W', 0.35), TS: env('TS', 0.30), K: env('K', 0.15), G: env('G', 0.15), L: env('L', 0.15),
  SA: env('SA', 0.9), SP: env('SP', 1), SM: env('SM', 0), KAI: env('KAI', 3), KZ: env('KZ', 0.15),
};

// tier01 はグローバルの t をそのまま返す（段ではなくマス÷27の連続値）。ジャスト帯・ゲージの係数は呼ぶたびに読む。
registerHooks({ load(url, context, nextLoad) {
  const loaded = nextLoad(url, context);
  if (url.endsWith('/craft/common.js')) {
    const src = String(loaded.source);
    const a = '1 + 0.18 * tier01("technique")', b = '1 + 0.45 * tier01("sense")';
    assert.equal(src.split(a).length, 2, 'common.js technique coefficient changed');
    assert.equal(src.split(b).length, 2, 'common.js sense coefficient changed');
    return { ...loaded, source: src.replace(a, '1 + globalThis.__COEF.TS * tier01("technique")').replace(b, '1 + globalThis.__COEF.W * tier01("sense")') };
  }
  if (url.endsWith('/craft/score.js')) {
    // 才能の「審査員の第一印象」は bonusOf と同じく、丸める前の総合に足す（ゲームに入れるときの形）。
    const src = String(loaded.source), old = '.reduce((s, [k, w]) => s + parts[k] * (w / wsum), 0) + bonus, 0, 100);';
    assert.equal(src.split(old).length, 2, 'score.js finalize changed');
    return { ...loaded, source: src.replace(old, '.reduce((s, [k, w]) => s + parts[k] * (w / wsum), 0) + bonus + (globalThis.__FIRST || 0), 0, 100);') };
  }
  if (url.endsWith('/core/stats.js')) {
    const src = String(loaded.source), old = 'return (star(key) - 1) / 4;';
    assert.equal(src.split(old).length, 2, 'tier01 source changed');
    return { ...loaded, source: src.replace(old, 'return globalThis.__T?.[key] ?? 0;') };
  }
  return loaded;
}});
globalThis.__COEF = COEF;
globalThis.__T = {};

globalThis.document = { addEventListener() {} };
globalThis.window = {};
Math.random = () => { throw Error('unseeded random draw'); };
const root = new URL('.', import.meta.url);
const dataRoot = new URL('../../../data/', import.meta.url);
const plan = JSON.parse(fs.readFileSync(new URL('plan.json', root)));
const [{ DB }, stateModule, score, steps, thermal, conditions, heat, common, statsModule, holes, heart, condition, mastery, leaf, result] = await Promise.all([
  '../../js/core/data.js', '../../js/core/state.js', '../../js/craft/score.js', '../../js/craft/steps.js',
  '../../js/craft/temperature-model.js', '../../js/craft/conditions.js', '../../js/craft/heat_logic.js',
  '../../js/craft/common.js', '../../js/core/stats.js', '../../js/craft/holes_logic.js',
  '../../js/craft/steam-heart.js', '../../js/core/condition.js', '../../js/core/flavor-mastery.js',
  '../../js/craft/flavor-life.js', '../../js/craft/result.js',
].map(p => import(p)));
for (const name of ['flavors', 'equipment', 'recipes', 'ng_mixes']) {
  const data = JSON.parse(fs.readFileSync(new URL(`${name}.json`, dataRoot)));
  DB[name === 'ng_mixes' ? 'ngMixes' : name] = data[name];
}
DB.flavorById = Object.fromEntries(DB.flavors.map(x => [x.id, x]));
DB.equipById = Object.fromEntries(DB.equipment.map(x => [x.id, x]));
assert.equal(score.NAGUMO_BAR, 90.8);

const sha = x => crypto.createHash('sha256').update(typeof x === 'string' || Buffer.isBuffer(x) ? x : JSON.stringify(x)).digest('hex');
function fnv(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
function mulberry32(a) { return () => { let t = a += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const normal = rng => Math.sqrt(-2 * Math.log(Math.max(rng(), Number.MIN_VALUE))) * Math.cos(2 * Math.PI * rng());
const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// ---- ばらつき（seed ごとに決まる。能力の違うセルでも同じ seed なら同じ配合・器具・熟練度＝対応のある比較）
// 第1章の大会で使える（chapter_min 1・課題レモン2g以上・12g）レモン系の配合。
export const MIXES = [
  { lemon: 10, mint: 2 },   // measure.mjs の固定配合
  { lemon: 9, mint: 3 },
  { lemon: 8, mint: 4 },    // なるの黄金比 7:3 寄り（レシピ「氷レモネード」）
  { lemon: 12 },            // レモン単体
  { lemon: 8, orange: 4 },  // レシピ外の柑橘
  { lemon: 8, frozen_citrus: 4 },
];
export const BOWLS = ['silicone_bowl', 'hagal_80beat', 'suyaki_hagal'];
// HMD は lotos_hagal だけ（ほかの HMD はアルミの穴あけ工程が要り、このモデルは穴あけを持たない）。
export const HMS = ['lotos_hagal'];
export const CHARCOALS = ['flat_charcoal', 'cube_charcoal']; // キューブはスミさんの特訓（_coal_cube_learned）後を想定
// 熟練度 Lv1〜3 の経験値の幅（flavor-mastery.js の MASTERY_THRESHOLDS）。Lv を等確率で選び、幅の中で一様に置く。
const LV_XP = { 1: [0, 6], 2: [6, 18], 3: [18, 36] };

export function variationOf(seed, fixed) {
  if (fixed) return { mix: { lemon: 10, mint: 2 }, equip: { bowl: 'silicone_bowl', hms: 'lotos_hagal', charcoal: 'flat_charcoal' }, xp: null };
  const rng = mulberry32((fnv('ch1-vary-v1') ^ seed) >>> 0);
  const mix = pick(rng, MIXES);
  const equip = { bowl: pick(rng, BOWLS), hms: pick(rng, HMS), charcoal: pick(rng, CHARCOALS) };
  const xp = {};
  for (const id of Object.keys(mix)) {
    const lv = id === 'lemon' ? 1 + Math.floor(rng() * 3) : 1 + Math.floor(rng() * 2); // 課題のレモンは Lv1〜3、脇役は Lv1〜2
    const [lo, hi] = LV_XP[lv];
    xp[id] = lo + (hi - lo) * rng();
  }
  return { mix, equip, xp };
}

// ---- 能力: t は 0〜1（マス÷27）。才＝charm 枠（大会の採点にはゲーム内の効き目なし。下の才能モデルだけ）、感＝sense・guts、理＝technique・insight
export const tOfDan = dan => clamp((dan - 1) / 9, 0, 1);
export const tOfMasu = masu => clamp(masu / 27, 0, 1);
function setTiers({ sai, kan, ri }) {
  globalThis.__T = { technique: ri, insight: ri, sense: kan, guts: kan, charm: sai };
}

function setup(v, ab) {
  const state = stateModule.setState({ cycle: 1, chapter: 1, day: 14, stats: { technique: 10, sense: 10, guts: 10, charm: 10, insight: 10 },
    flags: { _last_night: 'sleep_early' }, owned: [v.equip.bowl, v.equip.hms, v.equip.charcoal], goods: [], stamina: 100, flavorMastery: {}, rehearsal: null });
  if (v.xp) {
    // 理論は同じ練習量でも経験値が ×(1+G·t)。上限60（Lv5）。
    for (const [id, x] of Object.entries(v.xp)) state.flavorMastery[mastery.flavorFamily(id, DB.flavorById)] = Math.min(60, x * (1 + COEF.G * ab.ri));
  } else {
    mastery.gainFlavorExperience(state, { lemon: 1 }, 12, DB.flavorById);
    mastery.gainFlavorExperience(state, { lemon: 10, mint: 2 }, 2, DB.flavorById);
    assert.equal(mastery.masteryLevel(state, 'lemon', DB.flavorById), 2);
  }
  return { mode: 'tournament', chapter: 1, condition: condition.STAMINA_CONDITIONS.green,
    equip: { ...v.equip }, mix: { ...v.mix }, pack: 'normal', place: 'triangle', foilOptIn: false,
    steamSeconds: 360, environment: { rainy: false, ambientC: 23, humidityPercent: 50 },
    steamVariation: { offset: 0, transfer: 1 }, masteryAtStart: { ...state.flavorMastery },
    careHistory: [], strain: 0, retryAssist: false };
}
function heatResult(timings, bonus) {
  const picks = timings.map(t => t.phase);
  const avg = k => picks.reduce((sum, p) => sum + heat.HEAT_GRADES[p][k], 0) / picks.length;
  const accuracy = heat.summarizeCoalTimings(timings).accuracy;
  return { score: accuracy + bonus, picks, just: picks.filter(p => p === 'just').length,
    heatPower: clamp(50 + avg('hp'), 0, 100), heatStability: clamp(50 + avg('hs'), 0, 100),
    burnRisk: clamp(30 + avg('br'), 0, 100), aromaRetention: clamp(55 + avg('ar'), 0, 100) };
}

/** 1台。opts: { fixed, skills:Set, ops } */
export function runOne(ab, seed, opts = {}) {
  const { fixed = false, skills = new Set(), ops = plan.operations.mid } = opts;
  setTiers(ab);
  const v = variationOf(seed, fixed);
  const cs = setup(v, ab);
  const kaishinOn = skills.has('kaishin');
  const cfg = { ...ops, coalSigma: ops.coalSigma * (1 - COEF.K * ab.ri), temperatureSigma: ops.temperatureSigma * (1 - COEF.K * ab.ri) };
  const rng = mulberry32((fnv('u5-process-v1') ^ seed) >>> 0); // measure.mjs と同じ操作の乱数列
  const slow = common.skill.slow(cs), window = common.skill.window(cs);
  cs.mixInfo = steps.evaluateMix(cs);
  assert(cs.mixInfo.regOk && cs.mixInfo.total === 12 && !holes.usesFoil(cs), 'mix not legal: ' + JSON.stringify(cs.mix));
  leaf.ensureFlavorLife(cs);
  cs.holes = holes.skippedFoilResult();
  const justSeconds = heat.coalJustSeconds(window, false, []);
  let kaishin = 0, coalKai = 0;
  const timings = Array.from({ length: 3 }, () => {
    const tj = 4.2 + 3.2 * rng();
    const error = cfg.coalBias + cfg.coalSigma * normal(rng);
    const t = heat.evaluateCoalTiming(tj + justSeconds / 2 + error, tj, justSeconds);
    if (kaishinOn && t.phase === 'just' && Math.abs(error) <= COEF.KZ * justSeconds / 2) coalKai++;
    return t;
  });
  kaishin += coalKai;
  // 会心は炭1個ごとに KAI 点。炭焼きの工程点は3個の平均なので KAI·会心数/3 だけ上振れ（100を超えうる）。
  cs.heat = heatResult(timings, coalKai * COEF.KAI / 3);
  const radius = heart.heartHitRadius(statsModule.tier01('guts'), cs.condition.focus);
  const spawn = 0.46 * (1 + 0.25 * statsModule.tier01('insight')) * cs.condition.focus;
  let hits = 0;
  for (let i = 0; i < 6; i++) {
    const present = rng() < .46 / spawn;
    const distance = clamp(cfg.nearMissMean + cfg.nearMissSigma * normal(rng), 0, 12);
    if (present && heart.heartTouchesBullet({ x: distance, y: -1, w: 1, h: 2 }, 0, 0, radius)) hits++;
  }
  cs.steam = { seconds: 360, min: 6, hits, score: clamp(100 - hits * 14, 0, 100), temp: conditions.temperatureAfterSteam(cs, 360, cs.steamVariation) };
  let overPulls = 0;
  const finishThermal = round => {
    let bands = thermal.temperatureBands(cs);
    const residual = cfg.temperatureSigma * normal(rng);
    const focus = round === 0 ? conditions.pullFocusFromSteam(cs).slow : 1;
    let err = residual / (slow * focus);
    let pulls = round === 0 ? 3 : 1;
    const safe = (round === 0 ? 3 : 2) + thermal.makerMixProfile(cs).safePullsBonus;
    if (!fixed) {
      // 葉のモデル: 適温帯（緑）を外したら、吸い足して誤差を半分に戻す（最大2回）。安全回数を超えた分は葉が傷み、帯が細くなる。
      while (Math.abs(err) > (bands.ideal[1] - bands.ideal[0]) / 2 && pulls < 5 && pulls - (round === 0 ? 3 : 1) < 2) {
        pulls++; err *= 0.5;
        if (pulls > safe) {
          overPulls++;
          leaf.applyLeafDamage(cs.leaf, leaf.leafDamagePerPull(cs) * (1 - COEF.L * ab.ri));
          bands = thermal.temperatureBands(cs);
        }
      }
    }
    const temp = bands.center + err;
    const r = { round, temp, pulls, ...conditions.pullResult(temp, pulls, 0, bands, safe) };
    if (kaishinOn && pulls <= safe && Math.abs(err) <= COEF.KZ * (bands.optimal[1] - bands.optimal[0]) / 2) { r.score += COEF.KAI; kaishin++; }
    return r;
  };
  cs.pull = finishThermal(0);
  cs.careHistory = [finishThermal(1), finishThermal(2)];
  // 才能: 完成品・調整の点に小さな倍率（SM）＋総合への第一印象の加点（SA·t^SP）
  cs.stats = score.computeShisha(cs);
  const sm = 1 + COEF.SM * ab.sai;
  if (sm !== 1) {
    cs.stats.craftQuality = Math.min(100, cs.stats.craftQuality * sm);
    for (const c of cs.careHistory) c.score = Math.min(100 + COEF.KAI, c.score * sm);
  }
  globalThis.__FIRST = ab.sai > 0 ? COEF.SA * ab.sai ** COEF.SP : 0;
  score.finalize(cs);
  globalThis.__FIRST = 0;
  const total = cs.total;
  const outcome = result.outcomeOf(total);
  assert.equal(cs.foilSkipped, true);
  return { seed, total, rank: outcome.rank, mix: Object.entries(cs.mix).map(([k, g]) => k + g).join('+'),
    equip: Object.values(cs.equip).join('/'), lemonLv: mastery.masteryLevel({ flavorMastery: cs.masteryAtStart }, 'lemon', DB.flavorById),
    heatPhases: timings.map(t => t.phase), steamHits: hits, overPulls, kaishin };
}

export function runCell(ab, n, opts) {
  const rows = Array.from({ length: n }, (_, i) => runOne(ab, i + 1, opts));
  const again = Array.from({ length: n }, (_, i) => runOne(ab, i + 1, opts));
  assert.equal(sha(rows), sha(again), 'not reproducible');
  const wins = rows.filter(x => x.rank === 1).length;
  const mean = rows.reduce((s, x) => s + x.total, 0) / n;
  const sd = Math.sqrt(rows.reduce((s, x) => s + (x.total - mean) ** 2, 0) / n);
  return { n, wins, rate: wins / n, meanTotal: mean, sdTotal: sd,
    kaishinPerRun: rows.reduce((s, x) => s + x.kaishin, 0) / n, overPullsPerRun: rows.reduce((s, x) => s + x.overPulls, 0) / n,
    sha256: sha(rows), rows };
}

// ---- 実行
const argv = process.argv.slice(2);
const arg = k => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined; };
const n = Number(arg('--n') || 2000);
const fixed = argv.includes('--fixed');
const asJson = argv.includes('--json');
const opscale = Number(arg('--opscale') || 1); // 中操作の誤差の幅（炭・温度）を何倍にするか（基準の勝率を動かして差の安定を見る）
const ops = { ...plan.operations.mid, coalSigma: plan.operations.mid.coalSigma * opscale, temperatureSigma: plan.operations.mid.temperatureSigma * opscale };
const only = arg('--only'); // 既定セルのうち id に含む文字で絞る（例: --only 才能）
const skillArg = new Set((arg('--skill') || '').split(',').filter(Boolean));
const ab3 = (s, k, r, f) => ({ sai: f(s), kan: f(k), ri: f(r) });
let cells;
if (arg('--masu')) { const [s, k, r] = arg('--masu').split(',').map(Number); cells = [{ id: `masu ${s}/${k}/${r}`, ab: ab3(s, k, r, tOfMasu), skills: skillArg }]; }
else if (arg('--dan')) { const [s, k, r] = arg('--dan').split(',').map(Number); cells = [{ id: `dan ${s}/${k}/${r}`, ab: ab3(s, k, r, tOfDan), skills: skillArg }]; }
else if (argv.includes('--sweep')) {
  cells = [];
  for (const [name, idx] of [['才能', 0], ['感覚', 1], ['理論', 2]]) for (let m = 0; m <= 12; m += 2) {
    const v = [0, 0, 0]; v[idx] = m; cells.push({ id: `${name} マス${m}`, ab: ab3(...v, tOfMasu), skills: new Set() });
  }
} else {
  const D = (s, k, r) => ab3(s, k, r, tOfDan);
  cells = [
    { id: '基準（全能力1段）', ab: D(1, 1, 1), skills: new Set() },
    { id: '才能3段', ab: D(3, 1, 1), skills: new Set() }, { id: '感覚3段', ab: D(1, 3, 1), skills: new Set() }, { id: '理論3段', ab: D(1, 1, 3), skills: new Set() },
    { id: '才能5段', ab: D(5, 1, 1), skills: new Set() }, { id: '感覚5段', ab: D(1, 5, 1), skills: new Set() }, { id: '理論5段', ab: D(1, 1, 5), skills: new Set() },
    { id: '会心の一服（感覚1段）', ab: D(1, 1, 1), skills: new Set(['kaishin']) },
    { id: '会心の一服（感覚3段）', ab: D(1, 3, 1), skills: new Set(['kaishin']) },
    { id: '会心の一服（感覚5段）', ab: D(1, 5, 1), skills: new Set(['kaishin']) },
  ];
}
if (only) cells = [cells[0], ...cells.slice(1).filter(c => c.id.includes(only))];
const out = [];
let base = null;
for (const c of cells) {
  const r = runCell(c.ab, n, { fixed, skills: c.skills, ops });
  if (!base) {
    base = r;
    if (argv.includes('--breakdown')) {
      // 基準セルのばらつきの内訳（配合・炭・ボウル・レモン熟練度ごとの勝率）
      for (const key of ['mix', 'equip', 'lemonLv']) {
        const g = {};
        for (const x of r.rows) { (g[x[key]] ||= [0, 0])[0] += x.rank === 1; g[x[key]][1]++; }
        console.log(key, Object.entries(g).map(([k, [w, m]]) => `${k}: ${(w / m * 100).toFixed(1)}%（${m}台）`).join(' / '));
      }
    }
  }
  // 対応のある差（同じ seed）: 勝ち負けが入れ替わった数から差の標準誤差を出す
  let up = 0, down = 0;
  r.rows.forEach((x, i) => { const b = base.rows[i].rank === 1, w = x.rank === 1; if (w && !b) up++; if (b && !w) down++; });
  const diff = (r.wins - base.wins) / n * 100;
  const se = Math.sqrt(up + down - (up - down) ** 2 / n) / n * 100;
  out.push({ id: c.id, sai: c.ab.sai, kan: c.ab.kan, ri: c.ab.ri, skills: [...c.skills], n, wins: r.wins, rate: +(r.rate * 100).toFixed(1),
    diff: +diff.toFixed(1), diffSE: +se.toFixed(2), meanTotal: +r.meanTotal.toFixed(2), sdTotal: +r.sdTotal.toFixed(2),
    kaishinPerRun: +r.kaishinPerRun.toFixed(3), overPullsPerRun: +r.overPullsPerRun.toFixed(3), sha256: r.sha256 });
}
const header = { tool: 'tune3.mjs', fixed, n, opscale, coef: COEF, planSha256: sha(fs.readFileSync(new URL('plan.json', root))), toolSha256: sha(fs.readFileSync(new URL(import.meta.url))) };
if (asJson) console.log(JSON.stringify({ ...header, cells: out }, null, 1));
else {
  console.log(`# ${fixed ? '固定条件' : 'ばらつきあり'} n=${n} 操作の幅×${opscale} 係数 ${JSON.stringify(COEF)}`);
  console.log('| 条件 | 才t/感t/理t | 勝率 | 基準との差（±標準誤差） | 総合の平均（標準偏差） | 会心/台 | 葉の傷み回数/台 |');
  console.log('|---|---|---:|---:|---:|---:|---:|');
  for (const r of out) console.log(`| ${r.id} | ${[r.sai, r.kan, r.ri].map(x => x.toFixed(3)).join('/')} | ${r.rate.toFixed(1)}% | ${r.diff >= 0 ? '+' : ''}${r.diff.toFixed(1)}（±${r.diffSE.toFixed(1)}） | ${r.meanTotal.toFixed(2)}（${r.sdTotal.toFixed(2)}） | ${r.kaishinPerRun.toFixed(2)} | ${r.overPullsPerRun.toFixed(3)} |`);
}
