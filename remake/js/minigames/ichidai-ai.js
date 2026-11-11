// カードゲーム「一台勝負」のCPU（第0.3版）。規則（ichidai-rules.js）の act に渡す入力を、1つずつ返す。
// 相手の手札と山札の順は見ない。見るのは自分の手札・場に出ているもの・めくられた審査カードだけ。
// level: 0=やさしい（審査カードを数えない・一口のために取っておかない・揺さぶらない） 1=ふつう 2=つよい（残りの審査カードを数えて期待値で決める）
//
// 第0.3版の考え方: カードは1ラウンドに1枚。提供の自分のターンに、手番のカードを使う値打ちと、一口のカードを仕込む値打ち
// （審査カードは見ずに、残りの吸い方の期待値）を比べて良いほうを使う。熱の狙いは「その熱で使える一口のカード（必要火力）」まで
// 含めた期待点で決める。rules.reactAfterReveal のときは、めくったあとに一口のカードを選ぶ（取っておく値打ちと比べる）。
import { CARD, FLAVOR, FLAVORS, BOWL, JUDGE, PUFFS } from "./ichidai-data.js";
import { RANK, heatOf, leavesOf, coolStepsOf, judgedHeat, scorePuff, impressionOf, unseenPuffs,
  canPlay, canCharge, canPlace, canAsh, canPack, canSteam, packLimit, roundsOf, isLastSession, isLastOfSession, puffPreview } from "./ichidai-rules.js";

const cnt = (p, id) => p.hand.filter((x) => x === id).length;
const idx = (p, id) => p.hand.indexOf(id);
const isCoal = (id) => CARD[id].type === "coal";
const slotFree = (G, p) => (p.cardsUsed || 0) < G.R.cardsPerRound;
const REACT = ["heat_in", "heat_out", "blow", "all_in", "show_smoke", "duel", "encore"];
const IMP_W = 0.45; // 先読みでの印象1点の値打ち（一票に届く見込み）
const CARDV = 0.6; // 手札1枚の値打ち（点。チャージすれば熱1になる）

// 手元での値打ち（低いものから種火にする・捨てる）
const VALUE = { buyout: 0.3, repack: 0, encore: 1.2, go_second: 0.8, outer: 1.0, tongs: 0.9, fan: 1.0, loosen: 1.0, breath: 0.8, add_coal: 0.9 };
function cardValue(G, p, id) {
  const c = CARD[id];
  if (c.type === "coal") return 2.2;
  if ((c.type === "tool" && p.tools.includes(id)) || (c.type === "person" && p.person)) return 0.2;
  if (G.phase !== "prep" && c.when === "prep") return 0;
  return VALUE[id] ?? 1.6;
}
function worstIndex(G, p) {
  let bi = 0, bv = Infinity;
  p.hand.forEach((id, i) => { const v = cardValue(G, p, id); if (v < bv) { bv = v; bi = i; } });
  return bi;
}

// ───────── 審査カードの読み ─────────
/** CPUが想定する審査カードの候補（重みつき）。自分で見たカードがあればそれだけ */
function puffGuess(G, p) {
  if (G.judge && G.wait?.type === "react") return [{ q: G.judge, w: 1 }];
  if (p.peek) return [{ q: p.peek, w: 1 }];
  if (p.level <= 0 || !G.tour.judges.length) return [{ q: PUFFS.normal, w: 1 }];
  // ふつう: 大会に入っている12枚の割合で考える（数えない）。つよい: 残りを数える
  const pool = p.level >= 2 ? unseenPuffs(G) : G.tour.judges.flatMap((jid) => JUDGE[jid].puffs.flatMap(([pid, n]) => Array(n).fill(PUFFS[pid])));
  const m = new Map();
  for (const q of pool) { const e = m.get(q.id); if (e) e.w++; else m.set(q.id, { q, w: 1 }); }
  return [...m.values()];
}
/**
 * 一口を1枚（または使わない）で受けたときの値打ち。opp=相手の印象（分かっていれば。分からなければ印象の見込みで数える）
 * 返り値 { v, id, s, pts, imp }
 */
function reactionValue(G, p, heat, q, id, opp) {
  const tk = id === "heat_in" ? 1 : id === "heat_out" ? -2 : 0, blow = id === "blow";
  const paid = id ? CARD[id].pay?.ash || 0 : 0; // 追加コストで灰にする炭（熱が下がってから審査される）
  const s = scorePuff(p, judgedHeat(p, q, tk, Math.max(0, heat - paid)), q, { blow, lastOfSession: isLastOfSession(G) });
  const good = s.zone === "just" || s.zone === "band";
  let pts = s.pts + (id === "heat_out" && good ? 1 : 0) + (id === "all_in" && s.zone === "just" ? 3 : 0);
  if (id === "encore") pts *= 2;
  const imp = impressionOf(p, s, (id === "show_smoke" ? 4 : 0) + (id === "all_in" && s.zone === "just" ? 2 : 0) + (id === "heat_in" && good ? 1 : 0) + (p.sessImp || 0), G.R.impress);
  const vote = opp == null ? IMP_W * imp + (id === "duel" ? 0.8 : 0) : (imp > opp ? G.R.vote + (id === "duel" ? 3 : 0) : 0);
  const v = pts + vote - (s.zone === "scorch" ? 4 : 0) - (s.usedSilicone ? 2.5 : 0) - (s.usedLotus ? 0.8 : 0)
    - (id ? 0.5 : 0) - (id === "show_smoke" ? 0.6 : 0) - (blow && !s.saved ? 1 : 0) - 0.35 * paid;
  return { v, id, s, pts, imp };
}
/** その熱 heat で審査カード q を受けるときの、いちばん良い受け方。slot=カードの1枚がまだ使えるか */
function bestReaction(G, p, heat, q, { slot = true, opp = null } = {}) {
  let best = reactionValue(G, p, heat, q, null, opp);
  if (!slot) return best;
  for (const id of REACT) {
    if (!cnt(p, id) || (CARD[id].need || 0) > heat) continue;
    if (id === "encore" && !isLastSession(G)) continue;
    const r = reactionValue(G, p, heat, q, id, opp);
    if (r.v > best.v + 1e-9) best = r;
  }
  return best;
}
/** その熱で審査の前に仕込める一口のカード（審査を見ずに1枚決める規則のとき）。いちばん良いもの { v, id } */
function bestCommit(G, p, heat, guess) {
  let best = { v: -Infinity, id: null };
  for (const id of [null, ...REACT]) {
    if (id && (!cnt(p, id) || (CARD[id].need || 0) > heat)) continue;
    if (id === "encore" && !isLastSession(G)) continue;
    let sum = 0, w = 0;
    for (const g of guess) { sum += g.w * reactionValue(G, p, heat, g.q, id, null).v; w += g.w; }
    if (sum / w > best.v + 1e-9) best = { v: sum / w, id };
  }
  return best;
}
function expected(G, p, heat, guess, slot) {
  if (slot && p.level >= 1 && !G.R.reactAfterReveal) return bestCommit(G, p, heat, guess).v;
  let sum = 0, w = 0;
  for (const g of guess) { sum += g.w * bestReaction(G, p, heat, g.q, { slot: slot && p.level >= 1 }).v; w += g.w; }
  return sum / w;
}
function bestHeat(G, p, guess = puffGuess(G, p), slot = true) {
  let best = 0, bv = -Infinity;
  for (let h = 0; h <= G.R.heatMax; h++) { const v = expected(G, p, h, guess, slot) + (h <= 7 ? 0.01 * h : 0); if (v > bv) { bv = v; best = h; } }
  return best;
}
const normalGuess = [{ q: PUFFS.normal, w: 1 }];

// ───────── 入力ごと ─────────
export function aiAct(G, playerIndex) {
  const w = G.wait, p = G.P[playerIndex];
  if (!w || w.player !== playerIndex) return null;
  const fn = { embers, prep, cool, main, discard, react, wear, weaken }[w.type];
  return { player: playerIndex, ...fn(G, p, w) };
}

function embers(G, p) {
  const order = p.hand.map((id, i) => ({ i, v: cardValue(G, p, id) })).sort((a, b) => a.v - b.v);
  return { type: "embers", picks: order.slice(0, G.R.startEmbers).map((x) => x.i) };
}
function discard(G, p) {
  const need = p.hand.length - G.R.handMax;
  const order = p.hand.map((id, i) => ({ i, v: cardValue(G, p, id) })).sort((a, b) => a.v - b.v);
  return { type: "discard", picks: order.slice(0, need).map((x) => x.i) };
}
function wear(G, p, w) {
  const bowl = { ...p.bowl }, picks = {};
  for (let k = 0; k < w.n; k++) {
    const sd = Object.keys(bowl).filter((id) => id !== p.main && bowl[id] > 0), maxSide = Math.max(0, ...sd.map((id) => bowl[id]));
    let id = p.main;
    if (!(bowl[p.main] - 1 >= maxSide && bowl[p.main] > 1)) id = sd.sort((a, b) => bowl[b] - bowl[a]).find((x) => bowl[x] > 2) || (bowl[p.main] > 0 ? p.main : sd[0]);
    bowl[id]--; picks[id] = (picks[id] || 0) + 1;
  }
  return { type: "wear", picks };
}
function weaken(G, p) {
  let i = p.zone.findIndex((c) => c.up && CARD[c.id].heat === 1);
  if (i < 0) i = p.zone.findIndex((c) => !c.up);
  if (i < 0) i = 0;
  return { type: "weaken", zone: i };
}

// 冷める: 狙いより熱ければ熱が下がる受け方、そうでなければ下がらない受け方
function cool(G, p) {
  const tgt = bestHeat(G, p);
  const iEmber = p.zone.findIndex((c) => !c.up), iFlat = p.zone.findIndex((c) => c.up && CARD[c.id].heat === 1), iCube = p.zone.findIndex((c) => c.up && CARD[c.id].heat === 2);
  if (heatOf(p) <= tgt) {
    if (p.wind > 0) return { type: "cool", wind: true };
    if (iFlat >= 0) return { type: "cool", zone: iFlat };
  }
  if (iEmber >= 0) return { type: "cool", zone: iEmber };
  if (iFlat >= 0) return { type: "cool", zone: iFlat };
  if (iCube >= 0) return { type: "cool", zone: iCube };
  return { type: "cool", wind: true };
}

// 準備: 予定の葉を詰め、詰め終えたら蒸らして炭を育てる
function prep(G, p, w) {
  const cap = BOWL[p.bowlId].cap, want = Math.min(cap, p.plan.reduce((a, [, n]) => a + n, 0) || 12);
  if (!p.turn.mode) {
    if (cnt(p, "buyout") && canPlay(G, p, "buyout").ok && leavesOf(p) + packLimit(G, p) < want) return { type: "play", hand: idx(p, "buyout") };
    if (leavesOf(p) < want && canPack(G, p).ok) {
      const picks = packPicks(G, p, want);
      if (Object.keys(picks).length) return { type: "pack", picks };
    }
    if (canSteam(G, p).ok) return { type: "steam" };
    if (canPack(G, p).ok) { const picks = packPicks(G, p, cap); if (Object.keys(picks).length) return { type: "pack", picks }; }
    return { type: "end" };
  }
  if (p.turn.mode === "steam") {
    const a = coalMove(G, p, { prep: true, turnsLeft: G.R.prepTurns - w.n });
    if (a) return a;
  }
  const perm = permanent(G, p);
  if (perm && perm.v >= 0.8) return perm.act;
  return { type: "end" };
}
function packPicks(G, p, want) {
  let room = Math.min(packLimit(G, p), want - leavesOf(p)); const picks = {}, kinds = [];
  // 予定の葉。場に足りなければ、同じ系統のほかの葉で埋める
  const got = (id) => (p.bowl[id] || 0) + (picks[id] || 0);
  for (const [id, n] of (p.plan.length ? p.plan : [[G.market[0], 8]])) {
    let need = n - got(id);
    const alts = FLAVORS.filter((f) => f.kind === FLAVOR[id]?.kind && f.id !== id && f.id !== "death_by_ice" && f.id !== "spring_water").map((f) => f.id);
    for (const cand of [id, ...alts, ...G.market]) {
      if (need <= 0 || room <= 0) break;
      if (!G.market.includes(cand) || (kinds.length >= 2 && !kinds.includes(cand))) continue;
      const take = Math.min(need, room, (G.supply[cand] || 0) - (picks[cand] || 0)); if (take <= 0) continue;
      picks[cand] = (picks[cand] || 0) + take; room -= take; need -= take;
      if (!kinds.includes(cand)) kinds.push(cand);
    }
  }
  return picks;
}

/** 炭まわりの次の一手（置く・のせる・チャージ・灰にする）。無ければ null */
function coalMove(G, p, { prep = false, turnsLeft = 0 } = {}) {
  // 1. 炭カードは、枠があれば置く
  const ci = p.hand.findIndex((id) => isCoal(id) && canPlace(G, p, id).ok);
  if (ci >= 0) return { type: "place", hand: ci };
  const h0 = heatOf(p), ready = p.stove.map((c, i) => ({ c, i })).filter((x) => x.c.stage === 2);
  const chargesLeft = Math.max(0, G.R.chargePerTurn - (p.turn.charges || 0));
  if (prep) {
    // 準備: 提供の最初のターンに冷めるぶんを見込んで、狙いより少し上まで
    const want1 = bestHeat(G, p), target = Math.min(G.R.heatMax, want1 + (p.hmd === "big_tanukish" ? 0 : coolStepsOf(p)));
    const on = ready.find((x) => h0 + CARD[x.c.id].heat <= target);
    if (on) return { type: "puton", stove: on.i };
    const coming = p.stove.reduce((a, c) => a + (2 - c.stage <= turnsLeft ? CARD[c.id].heat : 0), 0);
    if (h0 < target && h0 + coming + turnsLeft < target && canCharge(G, p).ok) return { type: "charge", hand: worstIndex(G, p) };
    return null;
  }
  // 提供: 蓄えた熱の変化 d を総当たりし、期待値がいちばん高いところへ1手ずつ寄せる
  if (p.turn.ai?.heatDone) return null;
  const guess = puffGuess(G, p), slot = slotFree(G, p);
  const rF = ready.filter((x) => CARD[x.c.id].heat === 1), rC = ready.filter((x) => CARD[x.c.id].heat === 2);
  const upF = p.zone.filter((c) => c.up && CARD[c.id].heat === 1).length;
  const lastRound = G.round === roundsOf(G) - 1;
  const ashLeft = canAsh(G, p).ok ? Math.max(0, G.R.ashPerTurn - (p.turn.ashes || 0)) : 0;
  let best = null;
  for (let d = -3; d <= 5; d++) {
    const step = { onF: 0, onC: 0, charge: 0, ash: 0 }; let cost = 0, r = d;
    if (d > 0) {
      step.onF = Math.min(rF.length, r); r -= step.onF; cost += 0.05 * step.onF;
      while (r >= 2 && step.onC < rC.length) { step.onC++; r -= 2; cost += 0.05; }
      while (r >= 1 && step.charge < Math.min(chargesLeft, p.hand.length)) { step.charge++; r--; cost += 0.6 + 0.3 * step.charge; }
      if (r !== 0) continue;
    } else if (d < 0) { step.ash = -d; if (step.ash > Math.min(ashLeft, p.zone.length)) continue; cost += 0.9 * step.ash; }
    const h1 = h0 + d; if (h1 < 0 || h1 > G.R.heatMax) continue;
    let v = expected(G, p, h1, guess, slot) - cost;
    if (!lastRound) { // 次の自分のターンに、狙いの熱へ届くか
      const want = bestHeat(G, p, p.level >= 1 ? puffGuess(G, { ...p, peek: null }) : normalGuess);
      const cube = step.onC || p.zone.some((c) => c.up && CARD[c.id].heat === 2);
      const cs = Math.max(1, G.R.cool - (cube ? 1 : 0)), loss = Math.max(0, cs - (upF + step.onF + p.wind));
      const up = p.stove.filter((c) => c.stage >= 1).reduce((a, c) => a + CARD[c.id].heat, 0) - step.onF - 2 * step.onC + Math.min(G.R.chargePerTurn, p.hand.length);
      v -= 1.4 * Math.max(0, want - (h1 - loss + Math.max(0, up))) + 0.5 * Math.max(0, h1 - cs - 2 - want);
    }
    if (!best || v > best.v + 1e-9) best = { v, d, step };
  }
  const s = best?.step;
  if (!s || best.d === 0) { (p.turn.ai ||= {}).heatDone = true; return null; }
  if (s.onF) return { type: "puton", stove: rF[0].i };
  if (s.onC) return { type: "puton", stove: rC[0].i };
  // 追い炭（山札から種火2枚・枠を返す）が使えるなら、手札を2枚チャージするかわりにそれを使う
  if (s.charge >= 2 && cnt(p, "add_coal") && canPlay(G, p, "add_coal").ok) { (p.turn.ai ||= {}).heatDone = false; return { type: "play", hand: idx(p, "add_coal") }; }
  if (s.charge) return { type: "charge", hand: worstIndex(G, p) };
  if (s.ash) { const i = p.zone.findIndex((c) => !c.up); return { type: "ash", zone: i >= 0 ? i : 0 }; }
  return null;
}
/** 器具・人物を出す手と、その値打ち（残りのラウンドが多いほど高い） */
function permanent(G, p) {
  const left = G.phase === "serve" ? roundsOf(G) - G.round : roundsOf(G) + 1;
  if (left < 2) return null;
  const scale = Math.min(1, left / 6);
  const f = FLAVOR[p.main];
  const W = { windguard: 1.5, chacosta: 1.0, timer: 1.0, ice_hose: f && f.hi >= 6 ? 1.8 : 1.0, diffuser: 1.2 };
  let best = null;
  for (let i = 0; i < p.hand.length; i++) {
    const id = p.hand[i], c = CARD[id];
    if (c.type !== "tool" && c.type !== "person") continue;
    if (c.type === "person" && p.person) continue;
    if (c.type === "tool" && (p.tools.length >= G.R.toolMax || p.tools.includes(id))) continue;
    if (!canPlay(G, p, id).ok) continue;
    const v = (c.type === "person" ? 2.2 : W[id] ?? 1.0) * scale;
    if (!best || v > best.v) best = { v, act: { type: "play", hand: i } };
  }
  return best;
}
/** 自分のターンに使うカードの候補と値打ち（いちばん良いもの）。無ければ null */
function turnCard(G, p) {
  const o = G.P[1 - p.index], second = G.order[1] === p.index;
  const lastRound = G.round === roundsOf(G) - 1, lastOfSession = isLastOfSession(G);
  const ok = (id) => cnt(p, id) && canPlay(G, p, id).ok;
  const cands = [];
  const add = (id, v) => { if (ok(id) && v > 0) cands.push({ v, act: { type: "play", hand: idx(p, id) } }); };
  const perm = permanent(G, p); if (perm) cands.push(perm);
  const hNow = heatOf(p), hasReact = REACT.some((id) => cnt(p, id));
  const guess0 = puffGuess(G, p);
  // 熱を d 動かしたとき、この一口の期待点がどれだけ変わるか（カードの1枚はもう使う前提）
  const heatDelta = (d) => expected(G, p, Math.max(0, Math.min(G.R.heatMax, hNow + d)), guess0, false) - expected(G, p, hNow, guess0, false);
  // 引いた札の値打ち（手札が7枚を超えるぶんは捨てる）
  const drawV = (n) => CARDV * Math.max(0, Math.min(n, G.R.handMax - (p.hand.length - 1)));
  if (!p.peek && G.pile.length) add("read", p.level >= 1 ? (hasReact ? 1.1 : 0.6) : 0.3);
  if (!lastRound) {
    const want = bestHeat(G, p, p.level >= 1 ? puffGuess(G, { ...p, peek: null }) : normalGuess), cs = coolStepsOf(p);
    const cushion = p.zone.filter((c) => c.up && CARD[c.id].heat === 1).length + p.wind;
    const loss = Math.max(0, cs - cushion);
    // 灰落とし: 次のターンに冷めて足りなくなる熱を、チャージせずに済む
    if (!p.noCool) add("ash_tap", CARDV * Math.min(loss, Math.max(0, want - (hNow - loss))) + 0.2);
    const notReady = p.stove.filter((c) => c.stage < 2).length;
    if (notReady) add("fan", 0.5 * notReady);
    // 寄せ: このセッションの残りの一口すべての判定熱を動かす。次の一口からは熱を合わせ直せるので、
    // 「合わせ直したあとの一番良い期待点」の差で測る（外寄せなら、判定熱を保ったまま熱を上げて必要火力に届く）
    const sessLeft = 3 - (G.round % 3);
    const bestE = (pp) => { let b = -Infinity; for (let h = 0; h <= G.R.heatMax; h++) b = Math.max(b, expected(G, pp, h, guess0, true)); return b; };
    // 内寄せ: このセッションの残りの一口すべての印象+1（一票に届く見込み）
    if (sessLeft >= 2 || !lastOfSession) add("inner", IMP_W * 1.6 * sessLeft);
    for (const [id, d] of [["outer", -1]]) {
      if (sessLeft <= 1 || !cnt(p, id)) continue;
      const view = { ...p, sessMod: p.sessMod + d };
      add(id, (expected(G, view, hNow, guess0, false) - expected(G, p, hNow, guess0, false)) + (bestE(view) - bestE(p)) * (sessLeft - 1));
    }
  }
  if (!isLastSession(G) && !p.keepLeaves && lastOfSession) add("loosen", 1.6);
  if (p.hand.length <= 2) add("breath", 0.9);
  if (p.level >= 1) {
    const guess = puffGuess(G, p), calm = o.bowl.lavender >= 2;
    const oppLoss = () => {
      const view = { ...o, hand: [] }; // 相手の手札は見ない
      const base = expected(G, view, heatOf(o), guess, false); view.pend = o.pend + 1; return base - expected(G, view, heatOf(o), guess, false);
    };
    if (second && !calm) {
      add("hype", oppLoss());
      if (ok("venue_heat")) { const me2 = { ...p, pend: p.pend + 1 }; add("venue_heat", oppLoss() - (expected(G, p, hNow, guess, false) - expected(G, me2, hNow, guess, false))); }
    }
    if (o.zone.length && !o.tools.includes("windguard") && !calm) add("draft", 0.9);
    if (!lastRound && p.level >= 2) add("go_second", 0.5);
  }
  cands.sort((a, b) => b.v - a.v);
  return cands[0] || null;
}

/** 枠を返すカードのうち、使って得なもの（引く値打ち＋熱が下がる値打ち）。無ければ null */
function freeCard(G, p) {
  const h = heatOf(p), guess = puffGuess(G, p);
  const drawV = (n) => CARDV * Math.max(0, Math.min(n, G.R.handMax + 1 - p.hand.length));
  // 熱が下がる値打ち: 下げたあとに、この一口で一番良く受けられるか（枠は残っている）
  const at = (hh) => expected(G, p, Math.max(0, hh), guess, true);
  let best = null;
  for (const [id, n] of [["breath", 1], ["tongs", 2], ["reset", 3], ["add_coal", 0]]) {
    if (!cnt(p, id) || !canPlay(G, p, id).ok) continue;
    const ash = CARD[id].pay?.ash || 0, up = id === "add_coal" ? 2 : 0;
    const v = drawV(n) + at(Math.min(G.R.heatMax, h - ash + up)) - at(h) + (id === "add_coal" ? 2 * CARDV * 0.5 : ash ? 0 : 0.05);
    if (v > 0.05 && (!best || v > best.v)) best = { v, act: { type: "play", hand: idx(p, id) } };
  }
  return best?.act || null;
}
function main(G, p) {
  // やさしい: ときどきチャージを忘れる（その回は炭の手をとばす）
  const sloppy = p.level <= 0 && ((G.seed >>> 3) + G.round * 7 + p.hand.length) % 10 < 3;
  const place = p.hand.findIndex((id) => isCoal(id) && canPlace(G, p, id).ok);
  if (place >= 0) return { type: "place", hand: place };
  if (!sloppy) { const cm = coalMove(G, p); if (cm) return cm; }
  // 枠を返すカード（ひと息・トングさばき・仕切り直し）は、引く値打ちと熱の動きで得なら先に使う
  if (slotFree(G, p) && G.phase === "serve") { const f = freeCard(G, p); if (f) { if (p.turn.ai) p.turn.ai.heatDone = false; return f; } }
  if (slotFree(G, p)) {
    // カードの1枚: 自分のターンに使うか、審査の一口のために取っておくか
    const t = turnCard(G, p);
    if (!G.R.reactAfterReveal && G.phase === "serve" && p.level >= 1) {
      // 一口のカードはこのターンに仕込む。手番のカードと比べて良いほうを使う
      const guess = puffGuess(G, p), h = heatOf(p), c = bestCommit(G, p, h, guess);
      const gain = c.id ? c.v - expected(G, p, h, guess, false) : 0;
      if (c.id && gain > (t ? t.v : 0) && canPlay(G, p, c.id).ok) return { type: "play", hand: idx(p, c.id) };
      if (t && t.v > 0) { if (p.turn.ai) p.turn.ai.heatDone = false; return t.act; }
      return { type: "end" };
    }
    if (t) {
      const guess = puffGuess(G, p), h = heatOf(p);
      const hold = p.level >= 1 ? expected(G, p, h, guess, true) - expected(G, p, h, guess, false) : 0;
      if (t.v > hold) { if (p.turn.ai) p.turn.ai.heatDone = false; return t.act; }
    }
  }
  return { type: "end" };
}

// 審査: めくられたカードを見て、いちばん良い一口を1枚だけ使う（使わなくてもよい）
function react(G, p) {
  if (!slotFree(G, p)) return { type: "pass" };
  const o = G.P[1 - p.index];
  const opp = p.level >= 1 ? puffPreview(G, o).imp : null;
  const b = bestReaction(G, p, heatOf(p), G.judge, { slot: true, opp });
  if (b.id && cnt(p, b.id) && canPlay(G, p, b.id).ok) return { type: "play", hand: idx(p, b.id) };
  return { type: "pass" };
}
