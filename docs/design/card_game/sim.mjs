// 一台勝負 第0.2版のルールを動かし、決まった手筋で打つコンピュータどうしを対戦させて数値を確かめる。
// 使い方: node sim.mjs                 … 下の実験をすべて回して結果を表示
//         node sim.mjs --games 400     … 1実験あたりの対戦数（既定 600）
//         node sim.mjs --only decks    … 実験を選ぶ（decks,coals,rules,flavors,settings をカンマ区切り）
// 注意: コンピュータの手筋は単純（審査カードの残りを数えて期待値で熱を決め、1ターン先までしか読まない）。
//       人の対戦の代わりにはならない。見ているのは「熱を保てるか」「カードを何枚使えるか」
//       「炭カードは何枚が得か」「葉ごとの点の開き」「先手と後手の差」などの大きな釣り合い。
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('./cards.js');
const F = Object.fromEntries(C.FLAVORS.map((f) => [f.id, f]));
const S = Object.fromEntries(C.SUPPORT.map((s) => [s.n, s]));
const J = Object.fromEntries(C.JUDGES.map((j) => [j.id, j]));
const PLAIN = { ...C.PUFF.normal };

// ルールのつまみ（第0.2版の値）
// cool: 自分のターンのはじめに冷める段階の数。'zone' にすると熱の高さで変わる（熱 z2 未満=1 / z2〜z3-1=2 / z3 以上=3。比較用）
// reveal: 'after' = 審査カードは2人のターンのあとにめくる / 'before' = ラウンドのはじめにめくる
export const RULES = { draw: 2, steamDraw: 1, cool: 2, z2: 4, z3: 8, firstPackCut: 2, reveal: 'after', prepTurns: 6, packN: 4, slots: 4, vote: 2, wear: 2,
  startDraw: 7, startEmbers: 3, handMax: 7, heatMax: 10, pile: 12 };

const mkRng = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const shuffle = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const expand = (list) => list.flatMap(([n, c]) => Array(c).fill(n));
const isCoal = (n) => S[n].type === '炭';
const RANK = { just: 4, band: 3, off: 2, cold: 1, scorch: 0 };
export const coolSteps = (R, h) => (R.cool === 'zone' ? (h >= R.z3 ? 3 : h >= R.z2 ? 2 : 1) : R.cool);
// キューブ炭【火持ち】: 表向きのキューブ炭があるあいだ、冷める段階が1つ減る（1より少なくはならない）
const stepsFor = (R, p, h = heatOf(p)) => Math.max(1, coolSteps(R, h) - (p.zone.some((c) => c.up && S[c.n].heat === 2) ? 1 : 0));

// ───────── 状態 ─────────
function newPlayer(cfg, rnd, R) {
  const p = { cfg, deck: shuffle(expand(cfg.deck), rnd), hand: [], ash: [], zone: [], stove: [], bowl: {}, got: {}, main: null, tools: [], person: null, wind: 0,
    score: 0, votes: 0, just: 0, scorch: 0, sess: [], lastPuff: 0, steamed: false, mana: 0, pend: 0, sessMod: 0, noCool: false, keepLeaves: false,
    usedSilicone: false, usedLotus: false, peek: null, st: { played: 0, charged: 0, coalOn: 0, turns: 0, zones: {}, handSum: 0, react: 0 } };
  p.slots = R.slots; // 炭焼き場はだれでも4つ（カードでは増えない）
  draw(p, R.startDraw, rnd);
  for (let i = 0; i < R.startEmbers; i++) p.zone.push({ n: takeWorst(p, true), up: false }); // 最初の種火は値打ちの低いカードから
  return p;
}
function draw(p, n, rnd) {
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) p.deck = shuffle(p.ash.splice(0), rnd);
    if (p.deck.length) p.hand.push(p.deck.pop());
  }
}
const heatOf = (p) => p.zone.reduce((a, c) => a + (c.up ? S[c.n].heat : 1), 0);
const leaves = (p) => Object.values(p.bowl).reduce((a, b) => a + b, 0);
function fixMain(p) {
  const ids = Object.keys(p.bowl).filter((k) => p.bowl[k] > 0);
  if (!ids.length) { p.main = null; return; }
  if (p.bowl.death_by_ice > 0) { p.main = 'death_by_ice'; return; }
  const cand = ids.filter((k) => k !== 'spring_water' || ids.length === 1);
  const top = Math.max(...cand.map((k) => p.bowl[k]));
  if (!p.main || !(p.bowl[p.main] > 0) || p.bowl[p.main] < top || (p.main === 'spring_water' && ids.length > 1)) p.main = cand.find((k) => p.bowl[k] === top);
}
const sides = (p) => Object.keys(p.bowl).filter((k) => k !== p.main && p.bowl[k] >= 2);
const has = (p, n) => p.tools.includes(n) || p.person === n;
const cnt = (p, n) => p.hand.filter((x) => x === n).length;

// カードの手元での値打ち（低いものから種火にする）
const VAL = { '買い占め': 0.3, '詰め直し': 0.3, 'アンコール': 1.2, '後の先': 0.8, '外寄せ': 0.9, 'トングさばき': 0.9, '火おこし': 1.0, '葉をほぐす': 1.0 };
function cardVal(p, n, serving) {
  if (isCoal(n)) return 2.2;
  if ((S[n].type === '器具' && p.tools.includes(n)) || (S[n].type === '人物' && p.person)) return 0.2;
  if (serving && S[n].when === '準備') return 0;
  return VAL[n] ?? 1.6;
}
function takeWorst(p, setup) {
  let bi = 0, bv = 1e9;
  p.hand.forEach((n, i) => { const v = cardVal(p, n, !setup); if (v < bv) { bv = v; bi = i; } });
  return p.hand.splice(bi, 1)[0];
}
const worstVal = (p) => (p.hand.length ? Math.min(...p.hand.map((n) => cardVal(p, n, true))) : 99);

// ───────── 採点 ─────────
// 判定熱 h での一口。q=審査カード fl={ blow, lastOfSession }。返り値 { pts, zone, rich, … }
function puffAt(p, h, q, fl = {}) {
  const f = F[p.main]; if (!f) return { pts: 0, zone: 'cold' };
  const sd = sides(p), tot = leaves(p), kinds = Object.keys(p.bowl).filter((k) => p.bowl[k] > 0).length;
  const sLine = f.s + (sd.includes('mint') ? 1 : 0);
  let z = h >= sLine ? 'scorch' : f.j.includes(h) ? 'just' : h >= f.lo && h <= f.hi ? 'band' : h === f.lo - 1 ? 'offLo' : h === f.hi + 1 ? 'offHi' : 'cold';
  let usedLotus = false, usedSil = false, saved = false;
  if (z === 'scorch' && fl.blow) { z = 'off'; saved = true; }
  if (z === 'scorch' && p.cfg.bowl === 'シリコンボウル' && !p.usedSilicone) { z = 'off'; usedSil = true; saved = true; }
  if (z === 'offLo' && (sd.includes('peach') || (p.person === 'つむぎ' && f.k === 'floral'))) z = 'band';
  if (z === 'offHi' && (sd.includes('cool_mint') || has(p, 'アイスホース'))) z = 'band';
  if ((z === 'offLo' || z === 'offHi') && p.cfg.hmd === 'ロートスHMD' && !p.usedLotus) { z = 'band'; usedLotus = true; }
  if (z === 'offLo' || z === 'offHi') z = 'off';
  const ng = f.id === 'vanilla' ? sd.includes('mint') : f.id === 'mint' && sd.includes('vanilla');
  const mix = sd.length && !ng ? 1 : 0;
  const pair = mix && (sd.some((k) => F[k].k === f.pair) || sd.includes('spring_water')) ? 1 : 0;
  const rich = (p.cfg.bowl === '素焼きハガル' && kinds > 1) ? 0 : tot >= (sd.includes('black_tea') ? 8 : 10) ? 1 : 0;
  let bonus = mix + pair + rich;
  if (kinds === 1 && p.cfg.bowl === '素焼きハガル') bonus++;
  if (kinds === 1 && p.person === 'アダム') bonus++;
  if (sd.length >= 2 && p.person === 'ましろ') bonus++;
  if (fl.lastOfSession && p.bowl.jasmine >= 2) bonus++;
  let pts = 0;
  if (z === 'just') pts = f.t + 2 + bonus + (q.just || 0) + (p.person === 'なる' && f.k === 'sweet' ? 1 : 0);
  else if (z === 'band') pts = f.t + bonus + (q.band || 0);
  else if (z === 'off') pts = saved ? 1 : (q.offZero ? 0 : 1) + (has(p, 'ディフューザー') ? mix + pair : 0);
  return { pts, zone: z, rich, usedLotus, usedSil, saved };
}
// 蓄えた熱 → 判定熱
const judged = (p, heat, q) => heat + q.dh + (p.cfg.hmd === 'アマバースト' ? 1 : 0) + p.sessMod + ((p.bowl.lavender >= 2) ? 0 : p.pend);
// 一口の技まで含めた、審査カード q に対するいちばん良い受け方。mana=残っている火力
function bestReaction(p, heat, q, mana, fl) {
  let best = null;
  const nIn = cnt(p, '熱を入れる吸い'), nOut = cnt(p, '熱を逃がす吸い'), nBlow = cnt(p, 'ブロー');
  for (const tk of [0, 1, -1, 2, -2]) {
    if (tk > nIn || -tk > nOut || Math.abs(tk) > mana) continue;
    for (const blow of [0, 1]) {
      if (blow && (!nBlow || Math.abs(tk) + 1 > mana)) continue;
      const r = puffAt(p, judged(p, heat, q) + tk, q, { ...fl, blow });
      if (blow && !r.saved) continue;
      const v = r.pts - 1.2 * (Math.abs(tk) + blow) - (r.zone === 'scorch' ? 4 : 0) - (r.usedSil ? 2.5 : 0) - (r.usedLotus ? 0.8 : 0);
      if (!best || v > best.v + 1e-9) best = { v, tk, blow, r };
    }
  }
  return best;
}
// 残りの審査カード rem にわたる期待値（めくる前に熱を決めるため）。同じ吸い方はまとめて数える
const grouped = new WeakMap();
function groupOf(rem) {
  let g = grouped.get(rem);
  if (!g) { const m = new Map(); for (const q of rem) { const e = m.get(q.style); if (e) e.w++; else m.set(q.style, { q, w: 1 }); } g = [...m.values()]; grouped.set(rem, g); }
  return g;
}
function expected(p, heat, rem, mana, fl) {
  let sum = 0; for (const { q, w } of groupOf(rem)) sum += w * bestReaction(p, heat, q, mana, fl).v;
  return sum / rem.length;
}
// いちばん期待値の高い「蓄えた熱」
function bestHeat(p, rem) {
  let best = 0, bv = -1e9;
  for (let h = 0; h <= 10; h++) { const v = expected(p, h, rem, Math.min(h, 2), {}) + (h <= 7 ? 0.01 * h : 0); if (v > bv) { bv = v; best = h; } }
  return best;
}

// ───────── 炭の動き ─────────
function stoveAdvance(p, rnd) {
  let fired = false;
  for (const c of p.stove) { if (c.stage < 2) { c.stage++; if (c.stage === 2) fired = true; } }
  if (fired && has(p, 'キッチンタイマー')) draw(p, 1, rnd);
  if (has(p, 'チャコスタ') && p.stove.length >= 3) draw(p, 1, rnd);
}
function placeCoals(p) {
  for (let i = p.hand.length - 1; i >= 0 && p.stove.length < p.slots; i--) {
    const n = p.hand[i]; if (!isCoal(n)) continue;
    p.hand.splice(i, 1);
    p.stove.push({ n, stage: Math.min(2, 2 - S[n].ig + (p.person === 'スミさん' ? 1 : 0)) });
  }
}
function putOn(p, idx, rnd) {
  const c = p.stove.splice(idx, 1)[0]; p.zone.push({ n: c.n, up: true }); p.st.coalOn++;
  if (c.n === '高密度フラット炭') draw(p, 1, rnd);
}
// 冷める: steps 段階ぶん弱める。tgt より熱いあいだは熱が下がる受け方、そうでなければ熱が下がらない受け方を選ぶ
// 表向きのキューブ炭は【火持ち】を保つため、ほかに弱める炭がないときだけ裏返す
function cool(p, steps, tgt) {
  if (p.noCool) { p.noCool = false; return; }
  for (let k = 0; k < steps && p.zone.length; k++) {
    const iEmber = p.zone.findIndex((c) => !c.up), iFlat = p.zone.findIndex((c) => c.up && S[c.n].heat === 1), iCube = p.zone.findIndex((c) => c.up && S[c.n].heat === 2);
    if (heatOf(p) <= tgt) {
      if (p.wind > 0) { if (--p.wind === 0) { p.tools.splice(p.tools.indexOf('風防'), 1); p.ash.push('風防'); } continue; }
      if (iFlat >= 0) { p.zone[iFlat].up = false; continue; }
    }
    if (iEmber >= 0) p.ash.push(p.zone.splice(iEmber, 1)[0].n);
    else if (iFlat >= 0) p.zone[iFlat].up = false;
    else p.zone[iCube].up = false;
  }
}
function weakenByOpp(p) { // すきま風: 受ける側が選ぶ
  if (has(p, '風防') || p.bowl.lavender >= 2 || !p.zone.length) return;
  const iFlat = p.zone.findIndex((c) => c.up && S[c.n].heat === 1);
  if (iFlat >= 0) { p.zone[iFlat].up = false; return; }
  const iEmber = p.zone.findIndex((c) => !c.up);
  if (iEmber >= 0) p.ash.push(p.zone.splice(iEmber, 1)[0].n); else p.zone.find((c) => c.up).up = false;
}
function useCard(p, n) { p.hand.splice(p.hand.indexOf(n), 1); p.ash.push(n); p.st.played++; if (typeof S[n].cost === 'number') p.mana -= S[n].cost; }
function playPermanents(p, roundsLeft, keep = 0) {
  for (const n of [...p.hand]) {
    const s = S[n];
    if (s.type === '人物' && !p.person && p.mana - keep >= s.cost && roundsLeft >= 2) { p.hand.splice(p.hand.indexOf(n), 1); p.person = n; p.mana -= s.cost; p.st.played++; }
    else if (s.type === '器具' && !p.tools.includes(n) && p.tools.length < 3 && p.mana - keep >= s.cost && roundsLeft >= 2) {
      p.hand.splice(p.hand.indexOf(n), 1); p.tools.push(n); p.mana -= s.cost; p.st.played++;
      if (n === '風防') p.wind = 2;
    }
  }
}

// ───────── 準備フェイズの手筋 ─────────
function prepTurn(G, p, t) {
  const { R, rnd } = G;
  stoveAdvance(p, rnd); p.mana = heatOf(p);
  const plan = p.cfg.plan, cap = C.BOWLS.find((b) => b.n === p.cfg.bowl).cap;
  const want = Math.min(cap, plan.reduce((a, [, c]) => a + c, 0)), per = R.packN + (p.cfg.bowl === '80beatハガル' ? 1 : 0);
  const stock = (id) => G.supply[id] ?? R.pile;
  let packed = 0;
  if (!p.steamed && leaves(p) < want) {
    // 狙いの葉が場に残っていなければ、同じ系統の別の葉で埋める
    let room = Math.min(per - (G.firstPack === p && !p.packedOnce ? R.firstPackCut : 0), cap - leaves(p)); const kinds = []; p.packedOnce = true; // 先手の最初の「詰める」は2枚少ない
    for (const [id, c] of plan) {
      let need = c - (p.got[id] || 0);
      const alts = C.FLAVORS.filter((x) => x.k === F[id].k && x.id !== id && x.id !== 'death_by_ice' && x.id !== 'spring_water').map((x) => x.id);
      for (const cand of [id, ...alts]) {
        if (need <= 0 || room <= 0) break;
        if (kinds.length >= 2 && !kinds.includes(cand)) continue;
        const take = Math.min(need, room, stock(cand)); if (take <= 0) continue;
        p.bowl[cand] = (p.bowl[cand] || 0) + take; G.supply[cand] = stock(cand) - take;
        room -= take; need -= take; packed += take; p.got[id] = (p.got[id] || 0) + take;
        if (!kinds.includes(cand)) kinds.push(cand);
      }
    }
    fixMain(p);
  }
  if (!packed) {
    p.steamed = true; draw(p, R.steamDraw, rnd);
    const want1 = bestHeat(p, G.pile);
    const target = Math.min(R.heatMax, want1 + (p.cfg.hmd === 'ビッグタヌキッシュリッド' ? 0 : stepsFor(R, p, want1 + 1)));
    placeCoals(p);
    const turnsLeft = R.prepTurns - t - 1;
    for (let i = p.stove.length - 1; i >= 0; i--) { const c = p.stove[i]; if (c.stage === 2 && heatOf(p) + S[c.n].heat <= target) putOn(p, i, rnd); }
    placeCoals(p);
    const coming = p.stove.reduce((a, c) => a + (2 - c.stage <= turnsLeft ? S[c.n].heat : 0), 0);
    if (heatOf(p) < target && heatOf(p) + coming + turnsLeft < target && p.hand.length) { p.zone.push({ n: takeWorst(p), up: false }); p.st.charged++; }
    p.mana = heatOf(p); playPermanents(p, 9);
  }
  while (p.hand.length > R.handMax) p.ash.push(takeWorst(p));
}

// ───────── 提供フェイズ: 自分のターン ─────────
// rem = まだめくられていない審査カード（順は分からない）。known = このラウンドの審査カードが見えているとき、そのカード
function serveTurn(G, p, o, ctx) {
  const { R, rnd } = G, { lastOfSession, lastRound, second } = ctx;
  p.st.turns++;
  stoveAdvance(p, rnd);
  let rem = ctx.known ? [ctx.known] : ctx.rem;
  if (p.peek) { rem = [p.peek]; }
  const tgt = bestHeat(p, rem);
  if (ctx.sessFirstTurn && p.cfg.hmd === 'ビッグタヌキッシュリッド') p.noCool = false; else cool(p, stepsFor(R, p), tgt);
  draw(p, R.draw, rnd);
  placeCoals(p);
  if (!ctx.known && !p.peek && cnt(p, '吸い方を読む')) { useCard(p, '吸い方を読む'); p.peek = G.pile[0]; rem = [p.peek]; }
  const h0 = heatOf(p); p.mana = h0;
  const reactCards = cnt(p, '熱を入れる吸い') + cnt(p, '熱を逃がす吸い') + cnt(p, 'ブロー');
  const keep = Math.min(2, reactCards);
  playPermanents(p, ctx.roundsLeft, keep);
  const spent = h0 - p.mana;

  // 蓄えた熱の変化 d を総当たり。審査カードが見えていなければ、残りのカードにわたる期待値で比べる
  const ready = p.stove.filter((c) => c.stage === 2);
  const rF = ready.filter((c) => S[c.n].heat === 1).length, rC = ready.length - rF;
  const upF = p.zone.filter((c) => c.up && S[c.n].heat === 1).length, embers = p.zone.filter((c) => !c.up).length;
  const nextRem = ctx.remAfter && ctx.remAfter.length ? ctx.remAfter : null; // 次のラウンドに残る審査カード
  let best = null;
  for (let d = -3; d <= 4; d++) {
    const act = { onF: 0, onC: 0, charge: 0, oi: 0, ash: 0 }; let cost = 0, r = d;
    if (d > 0) {
      act.onF = Math.min(rF, r); r -= act.onF; cost += 0.05 * act.onF;
      while (r >= 2 && act.onC < rC) { act.onC++; r -= 2; cost += 0.05; }
      if (r >= 1 && cnt(p, '追い炭')) { act.oi = 1; r--; cost += 0.9; }
      if (r >= 1 && p.hand.length - act.oi > 0) { act.charge = 1; r--; cost += Math.max(0.6, worstVal(p)); }
      if (r === 1 && act.onC < rC && embers > 0) { act.onC++; act.ash = 1; r = 0; cost += 1.0; }
      if (r !== 0) continue;
    } else if (d < 0) { act.ash = Math.min(embers, -d); if (act.ash !== -d) continue; cost += 1.0 * act.ash; }
    const h1 = h0 + d; if (h1 < 0 || h1 > R.heatMax) continue;
    let v = expected(p, h1, rem, Math.max(0, h1 - spent), { lastOfSession }) - cost;
    if (!lastRound && nextRem) { // 次の自分のターンに、狙いの熱へ届くか
      const want = bestHeat({ ...p, pend: 0 }, nextRem), cs = Math.max(1, coolSteps(R, h1) - (act.onC || p.zone.some((c) => c.up && S[c.n].heat === 2) ? 1 : 0));
      const loss = Math.max(0, cs - (upF + act.onF + p.wind));
      const up = p.stove.filter((c) => c.stage >= 1).reduce((a, c) => a + S[c.n].heat, 0) - act.onF - 2 * act.onC + (p.hand.length - act.charge - act.oi > 0 ? 1 : 0);
      v -= 1.4 * Math.max(0, want - (h1 - loss + Math.max(0, up))) + 0.5 * Math.max(0, h1 - cs - 2 - want);
    }
    if (!best || v > best.v + 1e-9) best = { v, act, h1 };
  }
  const a = best.act;
  for (let k = 0; k < a.onF; k++) putOn(p, p.stove.findIndex((c) => c.stage === 2 && S[c.n].heat === 1), rnd);
  for (let k = 0; k < a.onC; k++) putOn(p, p.stove.findIndex((c) => c.stage === 2 && S[c.n].heat === 2), rnd);
  if (a.oi) { useCard(p, '追い炭'); draw(p, 1, rnd); p.zone.push({ n: p.hand.pop(), up: false }); }
  if (a.charge) { p.zone.push({ n: takeWorst(p), up: false }); p.st.charged++; }
  for (let k = 0; k < a.ash; k++) p.ash.push(p.zone.splice(p.zone.findIndex((c) => !c.up), 1)[0].n);
  if (a.ash && p.cfg.hmd === 'タヌキッシュリッド') draw(p, 1, rnd); // 【素直】灰にしたら1枚引く（1ターンに1回）
  p.mana = heatOf(p) - spent;

  // 次に備えるカード（一口の技に使う火力は残す）
  const spare = () => p.mana - keep, hNow = heatOf(p);
  if (!lastRound && nextRem) {
    const want = bestHeat({ ...p, pend: 0 }, nextRem), cs = stepsFor(R, p, hNow);
    const cushion = p.zone.filter((c) => c.up && S[c.n].heat === 1).length + p.wind, readyNext = p.stove.filter((c) => c.stage >= 1).reduce((x, c) => x + S[c.n].heat, 0);
    if (cnt(p, '灰落とし') && spare() >= 1 && hNow - Math.max(0, cs - cushion) + readyNext < want) { useCard(p, '灰落とし'); p.noCool = true; }
    if (cnt(p, '火おこし') && spare() >= 1 && p.stove.some((c) => c.stage < 2) && hNow - cs + readyNext < want) { useCard(p, '火おこし'); for (const c of p.stove) if (c.stage < 2) c.stage++; }
    if (cnt(p, '内寄せ') && spare() >= 2 && !lastOfSession && hNow < want - 1) { useCard(p, '内寄せ'); p.sessMod += 1; }
    if (cnt(p, '外寄せ') && spare() >= 1 && !lastOfSession && hNow - cs > want + 1) { useCard(p, '外寄せ'); p.sessMod -= 1; }
    if (cnt(p, 'トングさばき') && p.hand.length <= 3 && hNow - cs > want && p.zone.some((c) => !c.up)) { useCard(p, 'トングさばき'); p.ash.push(p.zone.splice(p.zone.findIndex((c) => !c.up), 1)[0].n); draw(p, 2, rnd); }
    if (cnt(p, '仕切り直し') && hNow - cs >= want + 2 && p.zone.filter((c) => !c.up).length >= 2 && p.hand.length <= 5) {
      useCard(p, '仕切り直し'); for (let k = 0; k < 2; k++) p.ash.push(p.zone.splice(p.zone.findIndex((c) => !c.up), 1)[0].n); p.mana = Math.min(p.mana, heatOf(p)); draw(p, 3, rnd); }
  }
  if (cnt(p, '葉をほぐす') && spare() >= 2 && !ctx.lastSession && !p.keepLeaves && lastOfSession) { useCard(p, '葉をほぐす'); p.keepLeaves = true; }
  if (cnt(p, 'ひと息') && spare() >= 1 && p.hand.length <= 5) { useCard(p, 'ひと息'); draw(p, 2, rnd); }
  // 相手を揺さぶる: 相手がもうターンを終えている（自分が後手）ときに、相手の期待値が大きく下がるなら
  const oppLoss = () => { const oh = heatOf(o), om = Math.min(Math.max(0, o.mana), 2); const base = expected(o, oh, rem, om, {}); o.pend += 1; const plus = expected(o, oh, rem, om, {}); o.pend -= 1; return base - plus; };
  if (second && !(o.bowl.lavender >= 2)) {
    if (cnt(p, '実況の煽り') && spare() >= 2 && oppLoss() >= 1.5) { useCard(p, '実況の煽り'); o.pend += 1; }
    else if (cnt(p, '会場の熱気') && spare() >= 1) { const mine = expected(p, heatOf(p), rem, p.mana, {}); p.pend += 1; const mine2 = expected(p, heatOf(p), rem, p.mana, {}); p.pend -= 1;
      if (oppLoss() - (mine - mine2) >= 1.5) { useCard(p, '会場の熱気'); o.pend += 1; p.pend += 1; } }
  }
  if (cnt(p, 'すきま風') && spare() >= 2 && o.zone.length) { useCard(p, 'すきま風'); weakenByOpp(o); }
  if (cnt(p, '後の先') && spare() >= 1 && !lastRound) { useCard(p, '後の先'); G.forceSecond = p; }
  while (p.hand.length > R.handMax) p.ash.push(takeWorst(p));
  p.st.handSum += p.hand.length;
}

// ───────── 提供フェイズ: 審査（一口） ─────────
function puffStep(G, P, order, q, ctx) {
  const res = [];
  for (const i of order) {
    const p = P[i], o = P[1 - i];
    const b = bestReaction(p, heatOf(p), q, Math.max(0, p.mana), { lastOfSession: ctx.lastOfSession });
    for (let k = 0; k < Math.abs(b.tk); k++) { useCard(p, b.tk > 0 ? '熱を入れる吸い' : '熱を逃がす吸い'); p.st.react++; }
    if (b.blow) { useCard(p, 'ブロー'); p.st.react++; }
    const r = b.r; let pts = r.pts; const good = r.zone === 'just' || r.zone === 'band';
    if (r.zone === 'just' && cnt(p, '渾身の一口') && p.mana >= 3) { useCard(p, '渾身の一口'); pts += 3; }
    if (good && r.rich && cnt(p, '見せ煙') && p.mana >= 2) { useCard(p, '見せ煙'); pts += 2; }
    let duel = false;
    // 勝負の一服: 相手の（いま見えている）帯より良いときだけ
    const oppRank = res[1 - i] ? res[1 - i].rank : RANK[puffAt(o, judged(o, heatOf(o), q), q).zone];
    if (cnt(p, '勝負の一服') && p.mana >= 2 && RANK[r.zone] > oppRank) { useCard(p, '勝負の一服'); duel = true; }
    if (cnt(p, 'アンコール') && p.mana >= 4 && ctx.lastSession && (ctx.lastRound || pts >= 9)) { useCard(p, 'アンコール'); pts *= 2; }
    if (r.usedSil) p.usedSilicone = true;
    if (r.usedLotus) p.usedLotus = true;
    if (r.zone === 'just') p.just++;
    if (r.zone === 'scorch') { p.scorch++; if (!(p.person === 'みんと' && Object.keys(p.bowl).some((k) => F[k].k === 'cool' && p.bowl[k] >= 2))) { p.bowl[p.main]--; fixMain(p); } }
    p.st.zones[r.zone] = (p.st.zones[r.zone] || 0) + 1;
    p.score += pts; p.lastPuff = pts; p.pend = 0; p.peek = null;
    res[i] = { pts, duel, rank: RANK[r.zone] };
  }
  return res;
}

function wearLeaves(p, n) {
  for (let i = 0; i < n; i++) {
    if (!leaves(p)) return;
    const sd = Object.keys(p.bowl).filter((k) => k !== p.main && p.bowl[k] > 0), maxSide = Math.max(0, ...sd.map((k) => p.bowl[k]));
    if (p.bowl[p.main] - 1 >= maxSide && p.bowl[p.main] > 1) p.bowl[p.main]--;
    else { const k = sd.sort((a, b) => p.bowl[b] - p.bowl[a]).find((x) => p.bowl[x] > 2) || p.main; p.bowl[k]--; }
    fixMain(p);
  }
}

// ───────── 1ゲーム ─────────
export function playGame(cfgA, cfgB, tour, seed, rules = {}) {
  const R = { ...RULES, ...rules }, rnd = mkRng(seed);
  // 審査カードの山: 審査員3人 × 各4枚。練習試合は「ふつうに吸う」だけ
  const mk = () => shuffle(tour.judges.length ? tour.judges.flatMap((id) => J[id].puffs.flatMap((q) => Array(q.c).fill({ ...q, id }))) : Array(12).fill(PLAIN), rnd);
  const G = { R, rnd, pile: mk(), supply: {}, forceSecond: null };
  const P = [newPlayer(cfgA, rnd, R), newPlayer(cfgB, rnd, R)];
  if (tour.task) for (const p of P) { p.bowl[tour.task] = 3; p.got[tour.task] = 3; fixMain(p); }
  let lead = 0; G.firstPack = P[0];
  for (let t = 0; t < R.prepTurns; t++) for (const i of [lead, 1 - lead]) prepTurn(G, P[i], t);
  const rounds = tour.s * 3; let firstWins = 0, decided = 0;
  for (let r = 0; r < rounds; r++) {
    if (!G.pile.length) G.pile = mk();
    const q = G.pile[0];
    const base = { lastOfSession: r % 3 === 2, lastRound: r === rounds - 1, lastSession: r >= rounds - 3, sessFirstTurn: r % 3 === 0, roundsLeft: rounds - r,
      rem: G.pile, remAfter: G.pile.slice(1), known: R.reveal === 'before' ? q : null };
    const order = [lead, 1 - lead];
    serveTurn(G, P[order[0]], P[order[1]], { ...base, second: false });
    serveTurn(G, P[order[1]], P[order[0]], { ...base, second: true });
    const res = puffStep(G, P, order, q, base);
    G.pile.shift();
    const d = res[0].rank - res[1].rank; // 一票: 帯の良い方（ジャスト＞適温＞ズレ＞外れ＞焦げ）
    if (d !== 0) {
      const w = d > 0 ? 0 : 1; P[w].votes++; P[w].score += R.vote + (res[w].duel ? 3 : 0);
      if (P[w].person === 'パッキー') draw(P[w], 1, rnd);
      decided++; if (w === order[0]) firstWins++;
    }
    lead = 1 - lead; // 先手は毎ラウンド交代
    if (G.forceSecond) { lead = 1 - P.indexOf(G.forceSecond); G.forceSecond = null; }
    if (r === 2) for (const p of P) p.s1 = p.score; // 上園の決め手: 第1セッションが終わった時点の点
    if (r % 3 === 2) for (const p of P) {
      if (r !== rounds - 1) wearLeaves(p, p.keepLeaves ? 0 : (p.cfg.bowl === '雲窯ファンネルハガル' ? 1 : R.wear));
      p.keepLeaves = false; p.sessMod = 0; p.usedLotus = false;
    }
  }
  // 審査員の決め手
  const give = (key, n, tie) => { const a = key(P[0]), b = key(P[1]); if (a > b) P[0].score += n; else if (b > a) P[1].score += n; else { P[0].score += tie; P[1].score += tie; } };
  for (const id of tour.judges) {
    if (id === 'kamizono') give((p) => p.s1, 4, 2);
    if (id === 'hakase') { give((p) => -p.scorch, 4, 2); for (const p of P) if (!p.scorch) p.score += 2; }
    if (id === 'sensu') give((p) => p.lastPuff, 5, 2);
    if (id === 'emir') give((p) => leaves(p), 4, 2);
    if (id === 'taiyo') give((p) => p.just, 4, 2);
  }
  return { P, firstWins, decided, rounds };
}

// ───────── 実験 ─────────
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('--games', 600), ONLY = arg('--only', '');
const T = Object.fromEntries(C.TOURNAMENTS.map((t) => [t.n, t]));
export const A = { deck: C.DECK_A, plan: [['lemon', 8], ['mint', 4]], bowl: '雲窯ファンネルハガル', hmd: 'ロートスHMD' };
export const B = { deck: C.DECK_B, plan: [['double_apple', 12]], bowl: '素焼きハガル', hmd: 'アマバースト' };
const pct = (x) => (100 * x).toFixed(0) + '%';
const f1 = (x) => x.toFixed(1);

export function match(a, b, tour, rules, n = GAMES) {
  const acc = { w: [0, 0, 0], sc: [0, 0], vt: [0, 0], fw: 0, dec: 0, st: [{}, {}], lv: [0, 0], seat: [0, 0] };
  for (let g = 0; g < n; g++) {
    const sw = g % 2 === 1; // 席を入れ替えて先手後手をならす
    const { P, firstWins, decided } = playGame(sw ? b : a, sw ? a : b, tour, 1000 + g * 7919, rules);
    const pa = sw ? P[1] : P[0], pb = sw ? P[0] : P[1];
    acc.w[pa.score > pb.score ? 0 : pa.score < pb.score ? 1 : 2]++;
    if (P[0].score !== P[1].score) acc.seat[P[0].score > P[1].score ? 0 : 1]++;
    [pa, pb].forEach((p, i) => { acc.sc[i] += p.score; acc.vt[i] += p.votes; acc.lv[i] += leaves(p);
      const s = acc.st[i]; for (const k of ['played', 'charged', 'coalOn', 'turns', 'handSum', 'react']) s[k] = (s[k] || 0) + p.st[k];
      for (const z in p.st.zones) s['z_' + z] = (s['z_' + z] || 0) + p.st.zones[z]; });
    acc.fw += firstWins; acc.dec += decided;
  }
  const side = (i) => { const s = acc.st[i], t = s.turns; return { 点: f1(acc.sc[i] / n), 票: f1(acc.vt[i] / n), ジャスト: pct((s.z_just || 0) / t), 適温: pct((s.z_band || 0) / t), ズレ外れ: pct(((s.z_off || 0) + (s.z_cold || 0)) / t), 焦げ: pct((s.z_scorch || 0) / t),
    '使用/T': (s.played / t).toFixed(2), 'うち一口': (s.react / t).toFixed(2), 'チャージ/T': (s.charged / t).toFixed(2), '炭のせ/T': (s.coalOn / t).toFixed(2), 手札: f1(s.handSum / t), 残り葉: f1(acc.lv[i] / n) }; };
  return { 勝率: pct(acc.w[0] / n) + ' / ' + pct(acc.w[1] / n), a: side(0), b: side(1), 先手が票: pct(acc.fw / Math.max(1, acc.dec)), 最初の先手の勝率: pct(acc.seat[0] / Math.max(1, acc.seat[0] + acc.seat[1])) };
}
const show = (title, r) => { console.log('\n■ ' + title + '　勝率 ' + r.勝率 + '　票のうち先手が取った割合 ' + r.先手が票 + '　最初の先手の勝率 ' + r.最初の先手の勝率); console.table({ 左: r.a, 右: r.b }); };
// デッキAの炭を n 枚にし、増減ぶんは技で埋める
export function deckWithCoals(nCoal, flatShare = 0.7) {
  const filler = ['熱を入れる吸い', '熱を逃がす吸い', '灰落とし', 'ひと息', '追い炭', 'ブロー', '渾身の一口', '勝負の一服', '吸い方を読む', '実況の煽り', '風防', '火おこし', '見せ煙', '内寄せ', 'トングさばき', 'すきま風'];
  const m = new Map(C.DECK_A.filter(([k]) => !isCoal(k)));
  const total = () => [...m.values()].reduce((a, b) => a + b, 0);
  for (let i = 0; total() < 40 - nCoal && i < 200; i++) { const k = filler[i % filler.length]; if ((m.get(k) || 0) < 3) m.set(k, (m.get(k) || 0) + 1); }
  const keys = [...m.keys()].reverse();
  for (let i = 0; total() > 40 - nCoal && i < 400; i++) { const k = keys[i % keys.length]; if (m.get(k) > 0) m.set(k, m.get(k) - 1); }
  const nF = Math.round(nCoal * flatShare);
  return [['フラット炭', nF], ['キューブ炭', nCoal - nF], ...[...m].filter(([, c]) => c > 0)];
}
export const pairFor = (f) => (f.pair === 'none' ? null : C.FLAVORS.find((x) => x.k === f.pair && x.id !== f.id && !(f.id === 'vanilla' && x.id === 'mint') && x.id !== 'death_by_ice' && x.id !== 'spring_water'));
const want = (k) => !ONLY || ONLY.split(',').includes(k);
const MIXES = [['レモン＋ミント（中温・どこでもジャスト）', A.plan], ['ローズ＋ピーチ（低温・すぐ上が焦げ）', [['rose', 8], ['peach', 4]]], ['ブルーベリー＋ミント（中温）', [['blueberry', 8], ['mint', 4]]], ['コーヒー＋バニラ（高温）', [['coffee', 8], ['vanilla', 4]]]];

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`対戦数: 各 ${GAMES}（席は交互に入れ替え）`);
  for (const [nm, d] of [['A', C.DECK_A], ['B', C.DECK_B]]) {
    const n = d.reduce((a, [, c]) => a + c, 0), bad = d.filter(([k, c]) => !S[k] || (!['フラット炭', 'キューブ炭'].includes(k) && c > (S[k].type === '人物' ? 1 : 3)));
    console.log(`デッキ${nm}: ${n}枚 炭${d.filter(([k]) => isCoal(k)).reduce((a, [, c]) => a + c, 0)}枚 ${n === 40 && !bad.length ? 'OK' : 'NG ' + JSON.stringify(bad)}`);
  }
  if (want('decks')) {
    show('デッキA どうし（SMOKE CROWN CUP）', match(A, A, T['SMOKE CROWN CUP']));
    show('デッキB どうし（HAZE: OPEN CLOUD）', match(B, B, T['HAZE: OPEN CLOUD']));
    show('デッキA（左）対 デッキB（右）（練習試合）', match(A, B, T['練習試合']));
    show('デッキA（左）対 デッキB（右）（HAZE: OPEN CLOUD）', match(A, B, T['HAZE: OPEN CLOUD']));
    show('デッキA（左）対 デッキB（右）（HAZE: GRAND SMOKE・4セッション）', match(A, B, T['HAZE: GRAND SMOKE']));
  }
  if (want('coals')) {
    for (const [label, plan] of MIXES) {
      console.log(`\n■ 炭カードの枚数（${label}。炭以外はデッキAの中身を増減。相手は同じ葉で炭10枚・HAZE: OPEN CLOUD）`);
      const rows = {}, base = { ...A, plan };
      for (const nCoal of [0, 4, 8, 12, 16, 20]) {
        const r = match({ ...base, deck: deckWithCoals(nCoal) }, { ...base, deck: deckWithCoals(10) }, T['HAZE: OPEN CLOUD']);
        rows['炭' + nCoal + '枚'] = { 勝率: r.勝率, 点: r.a.点, ジャスト: r.a.ジャスト, 適温: r.a.適温, ズレ外れ: r.a.ズレ外れ, 焦げ: r.a.焦げ, '使用/T': r.a['使用/T'], 'チャージ/T': r.a['チャージ/T'], 手札: r.a.手札 };
      }
      console.table(rows);
    }
    console.log('\n■ フラットとキューブの割合（炭12枚。相手はフラット8：キューブ4の同じ葉）');
    const rows = {};
    for (const [label, plan] of MIXES) for (const share of [1, 0.5, 0]) {
      const base = { ...A, plan }, r = match({ ...base, deck: deckWithCoals(12, share) }, { ...base, deck: deckWithCoals(12, 0.67) }, T['HAZE: OPEN CLOUD']);
      rows[`${label.split('（')[0]} フラット${Math.round(12 * share)}：キューブ${12 - Math.round(12 * share)}`] = { 勝率: r.勝率, 点: r.a.点, ジャスト: r.a.ジャスト };
    }
    console.table(rows);
  }
  if (want('rules')) {
    console.log('\n■ ルールを変えたら（同じ葉どうし・炭10枚・HAZE: OPEN CLOUD）');
    const dr = {};
    for (const [nm, rules] of [['第0.2版', {}], ['審査カードを先にめくる', { reveal: 'before' }], ['毎ターン1枚だけ引く', { draw: 1 }], ['冷めるのは1段階', { cool: 1 }], ['熱が高いほど多く冷める', { cool: 'zone' }]]) {
      for (const [label, plan] of MIXES) { const base = { ...A, plan, deck: deckWithCoals(10) }, r = match(base, base, T['HAZE: OPEN CLOUD'], rules);
        dr[`${nm}｜${label.split('＋')[0]}`] = { 点: r.a.点, 票: r.a.票, ジャスト: r.a.ジャスト, 適温: r.a.適温, ズレ外れ: r.a.ズレ外れ, 焦げ: r.a.焦げ, '使用/T': r.a['使用/T'], 'チャージ/T': r.a['チャージ/T'], 手札: r.a.手札 }; }
    }
    console.table(dr);
  }
  if (want('flavors')) {
    for (const tn of ['HAZE: OPEN CLOUD', 'HAZE: GRAND SMOKE']) {
      console.log(`\n■ 主役の葉ごとの点（主役8＋相性の合う脇役4。雲窯ファンネルハガル＋ロートスHMD。炭の枚数は 6/10/14/18 のうち点が高いもの。相手は レモン＋ミント・炭10。${tn}）`);
      const fr = {}, ref = { ...A, deck: deckWithCoals(10) };
      for (const f of C.FLAVORS) {
        if (f.id === 'spring_water') continue;
        const side = pairFor(f), plan = side ? [[f.id, 8], [side.id, 4]] : [[f.id, 12]];
        let best = null;
        for (const nc of [6, 10, 14, 18]) { const r = match({ ...A, plan, deck: deckWithCoals(nc) }, ref, T[tn], {}, Math.min(GAMES, 300)); if (!best || +r.a.点 > +best.r.a.点) best = { nc, r }; }
        const a = best.r.a;
        fr[`${f.n}（味${f.t}・${f.lo}〜${f.hi}）`] = { 脇役: side ? side.n : '（単品）', 炭: best.nc, 点: a.点, 票: a.票, 相手の票: best.r.b.票, ジャスト: a.ジャスト, 適温: a.適温, ズレ外れ: a.ズレ外れ, 焦げ: a.焦げ, '使用/T': a['使用/T'] };
      }
      console.table(fr);
    }
  }
  if (want('settings')) {
    console.log('\n■ セッティング（デッキA・レモン8＋ミント4。相手は雲窯ファンネルハガル＋ロートスHMD・SMOKE CROWN CUP）');
    const sr = {};
    for (const h of C.HMDS) { const r = match({ ...A, hmd: h.n }, A, T['SMOKE CROWN CUP']); sr[h.n] = { 勝率: r.勝率, 点: r.a.点 }; }
    for (const b of C.BOWLS) { const r = match({ ...A, bowl: b.n, plan: b.cap >= 16 ? [['lemon', 10], ['mint', 6]] : A.plan }, A, T['SMOKE CROWN CUP']); sr[b.n] = { 勝率: r.勝率, 点: r.a.点 }; }
    console.table(sr);
  }
}
