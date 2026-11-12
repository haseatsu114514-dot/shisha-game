// カードゲーム「一台勝負」のCPU（第0.5版）。規則（ichidai-rules.js）の act に渡す入力を、1つずつ返す。
// 相手の手札と山札の順は見ない。見るのは自分の手札・場に出ているもの・めくられた審査カードだけ。
// level: 0=やさしい（めくられた吸い方に合わせない・一口のために取っておかない・揺さぶらない）
//        1=ふつう（めくられた吸い方に熱を合わせる。次のラウンドの先読みと、相手を揺さぶるカードは使わない）
//        2=つよい（次のラウンドを残りの審査カードから読んで炭を仕込み、相手を揺さぶる）
//
// 第0.3版の考え方: カードは1ラウンドに1枚。提供の自分のターンに、手番のカードを使う値打ちと、一口のカードを仕込む値打ち
// （審査カードは見ずに、残りの吸い方の期待値）を比べて良いほうを使う。熱の狙いは「その熱で使える一口のカード（必要火力）」まで
// 含めた期待点で決める。rules.reactAfterReveal のときは、めくったあとに一口のカードを選ぶ（取っておく値打ちと比べる）。
import { CARD, FLAVOR, FLAVORS, BOWL, JUDGE, PUFFS } from "./ichidai-data.js";
import { RANK, heatOf, coalHeat, coalRoom, coalMaxOf, leavesOf, coolStepsOf, judgedHeat, scorePuff, impressionOf, unseenPuffs,
  canPlay, canCharge, canPlace, canAsh, canPack, canSteam, packLimit, roundsOf, isLastSession, isLastOfSession, puffPreview, rivalsOf } from "./ichidai-rules.js";

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
  // 第0.5版: このラウンドの審査カードは、もうめくられている（全員が見ている）。やさしいCPUは、めくられた吸い方に合わせない
  if (G.R.revealFirst && G.phase === "serve" && G.judge && !p.puff?.scored && p.level >= 1) return [{ q: G.judge, w: 1 }];
  if (p.peek) return [{ q: p.peek, w: 1 }];
  return pileGuess(G, p);
}
/** 次のラウンドの吸い方の見込み。「吸い方を読む」で見ていればそれ。見ていなければ残りの山から */
function nextGuess(G, p) {
  if (!G.R.revealFirst) return p.level >= 1 ? puffGuess(G, { ...p, peek: null }) : normalGuess;
  if (p.level < 2) return normalGuess; // ふつう・やさしいは、次のラウンドを先読みしない
  if (p.peek) return [{ q: p.peek, w: 1 }];
  return pileGuess(G, p);
}
function pileGuess(G, p) {
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
  const paid = id ? CARD[id].pay?.fire || 0 : 0; // 発動のために落とす火力（熱が下がってから審査される）
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
  return { type: "embers", picks: order.slice(0, Math.min(G.R.startEmbers, coalMaxOf(p))).map((x) => x.i) };
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
/** 火のいちばん小さい炭（同じなら種火）の位置。only＝選べる炭だけに絞る条件。無ければ -1 */
function weakestCoal(p, only = () => true) {
  let bi = -1;
  p.zone.forEach((c, i) => {
    if (!only(c)) return;
    const b = bi < 0 ? null : p.zone[bi];
    if (!b || coalHeat(c) < coalHeat(b) || (coalHeat(c) === coalHeat(b) && !c.up && b.up)) bi = i;
  });
  return bi;
}
function weaken(G, p) {
  return { type: "weaken", zone: Math.max(0, weakestCoal(p)) };
}

// 冷める: 炭の火を1下げる。狙いより熱くなければ、まず風防で受ける。下げるのは火の小さい炭から
// （種火や弱った炭は先に灰にして枠を空け、火の大きい炭を残す。同じ炭は1ターンに1段階まで）
function cool(G, p) {
  const tgt = bestHeat(G, p);
  if (heatOf(p) <= tgt && p.wind > 0) return { type: "cool", wind: true };
  const i = weakestCoal(p, (c) => !c.cooled);
  return i >= 0 ? { type: "cool", zone: i } : { type: "cool", wind: true };
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

/**
 * 炭まわりの次の一手（置く・のせる・チャージ・灰にする）。無ければ null。
 * 第0.4版: 炭は4つまでで、熱＝炭の火の合計。火は下がるだけなので、熱を上げるには空いた枠に新しい炭（焼けた炭＝火2か3、
 * 種火＝火1）を足す。枠が無ければ、弱った炭を1つ灰にして入れ替える。いまの手（灰にする0〜1・のせる炭の組・チャージの数）を
 * 総当たりして、この一口の期待点と、次の自分のターンに狙いの熱へ届くかで選び、1手ずつ進める
 */
function coalMove(G, p, { prep = false, turnsLeft = 0 } = {}) {
  // 1. 炭カードは、枠があれば置く
  const ci = p.hand.findIndex((id) => isCoal(id) && canPlace(G, p, id).ok);
  if (ci >= 0) return { type: "place", hand: ci };
  if (p.turn.ai?.heatDone) return null;
  const h0 = heatOf(p), ready = p.stove.map((c, i) => ({ f: CARD[c.id].heat, i })).filter((x) => p.stove[x.i].stage === 2);
  const later = p.stove.filter((c) => c.stage === 1).map((c) => CARD[c.id].heat); // 次の自分のターンに焼ける炭
  const cmax = coalMaxOf(p), chargesLeft = Math.max(0, Math.min(3, G.R.chargePerTurn - (p.turn.charges || 0)));
  const canAshNow = canAsh(G, p).ok, canChargeNow = canCharge(G, p).ok || (!coalRoom(p) && p.hand.length > 0 && canAshNow && chargesLeft > 0);
  const guess = prep ? null : puffGuess(G, p), slot = slotFree(G, p);
  const lastRound = !prep && G.round === roundsOf(G) - 1;
  const want = bestHeat(G, p, prep ? undefined : nextGuess(G, p));
  // 灰にする候補: しない／火の小さい炭から、火の違うものを1つずつ
  const ashOpts = [-1];
  if (canAshNow) { const seen = new Set(); p.zone.map((c, i) => ({ f: coalHeat(c), i, up: c.up })).sort((a, b) => a.f - b.f || a.up - b.up).forEach((x) => { if (!seen.has(x.f)) { seen.add(x.f); ashOpts.push(x.i); } }); }
  let best = null;
  for (const ai of ashOpts) {
    const fires = p.zone.map((c) => coalHeat(c)); let ashCost = 0;
    if (ai >= 0) { ashCost = 0.25 + 0.3 * fires[ai]; fires.splice(ai, 1); }
    for (let mask = 0; mask < (1 << ready.length); mask++) {
      const on = ready.filter((_, k) => mask & (1 << k));
      if (fires.length + on.length > cmax) continue;
      const room = cmax - fires.length - on.length;
      for (let ch = 0; ch <= Math.min(canChargeNow ? room : 0, p.hand.length, chargesLeft); ch++) {
        const now = [...fires, ...on.map((x) => x.f), ...Array(ch).fill(1)], h1 = now.reduce((a, b) => a + b, 0);
        if (h1 > G.R.heatMax) continue;
        // チャージの値段: 手札1枚ぶん。そのターン最初のチャージは1枚引ける（チャージ＆ドロー）ので、ほぼただ
        const cdFree = ch > 0 && G.R.chargeDraw > 0 ? 0.55 : 0;
        let v = -ashCost - 0.05 * on.length - ch * 0.6 - 0.15 * ch * (ch - 1) + cdFree;
        if (!prep) v += expected(G, p, h1, guess, slot);
        if (!lastRound) {
          // 次の自分のターン: 冷めて（火の小さい炭から、規則の段階ぶん）、空いた枠に残りの炭と種火を足す。狙いに届くか・熱すぎないか
          const skipCool = prep && p.hmd === "big_tanukish";
          const solo = p.hmd === "one_coal" && now.length === 1; // ワンコールリッド: 炭が1つだけなら冷めない
          const steps = skipCool || solo ? 0 : Math.max(0, Math.min(G.R.cool, now.length) - p.wind);
          const after = [...now].sort((a, b) => a - b); let lost = 0;
          for (let k = 0; k < steps && k < after.length; k++) { after[k]--; lost++; }
          const left = after.filter((f) => f > 0), hNext = h1 - lost;
          const stock = [...ready.filter((x) => !on.includes(x)).map((x) => x.f), ...later].sort((a, b) => b - a);
          let roomNext = cmax - left.length, reach = hNext;
          for (const f of stock) if (roomNext > 0) { reach += f; roomNext--; }
          reach += Math.min(roomNext, Math.max(0, p.hand.length - ch), G.R.chargePerTurn) * 0.8;
          const big = left.length ? Math.max(...left) : 0;
          v -= 1.4 * Math.max(0, want - reach) + 0.5 * Math.max(0, hNext - big - want);
          if (prep) v -= 0.35 * Math.abs(hNext - want) + (turnsLeft > 0 ? 0.3 * ch : 0); // 準備: 提供の最初のターンにちょうど合う熱へ。種火は急がない
        }
        if (!best || v > best.v + 1e-9) best = { v, ai, on, ch };
      }
    }
  }
  if (!best || (best.ai < 0 && !best.on.length && !best.ch)) { (p.turn.ai ||= {}).heatDone = true; return null; }
  if (best.ai >= 0) return { type: "ash", zone: best.ai };
  if (best.on.length) return { type: "puton", stove: best.on[0].i };
  // 追い炭（山札から種火2枚・枠を返す）が使えるなら、手札を2枚チャージするかわりにそれを使う
  if (best.ch >= 2 && cnt(p, "add_coal") && canPlay(G, p, "add_coal").ok) return { type: "play", hand: idx(p, "add_coal") };
  return { type: "charge", hand: worstIndex(G, p) };
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
  // 相手が3人までいる。見るのは「いちばん手ごわい相手」（点がいちばん高い人）。2人対戦なら、ただ1人の相手
  const rivals = rivalsOf(G, p), o = rivals.reduce((a, b) => (b.score > a.score ? b : a));
  const turnOf = (x) => G.order.indexOf(x.index), moved = (x) => turnOf(x) < turnOf(p); // このラウンド、もう手番を終えた相手
  const lastRound = G.round === roundsOf(G) - 1, lastOfSession = isLastOfSession(G);
  const ok = (id) => cnt(p, id) && canPlay(G, p, id).ok;
  const cands = [];
  const add = (id, v, target = null) => { if (ok(id) && v > 0) cands.push({ v, act: target == null ? { type: "play", hand: idx(p, id) } : { type: "play", hand: idx(p, id), target } }); };
  const perm = permanent(G, p); if (perm) cands.push(perm);
  const hNow = heatOf(p), hasReact = REACT.some((id) => cnt(p, id));
  const guess0 = puffGuess(G, p);
  // 熱を d 動かしたとき、この一口の期待点がどれだけ変わるか（カードの1枚はもう使う前提）
  const heatDelta = (d) => expected(G, p, Math.max(0, Math.min(G.R.heatMax, hNow + d)), guess0, false) - expected(G, p, hNow, guess0, false);
  // 引いた札の値打ち（手札が7枚を超えるぶんは捨てる）
  const drawV = (n) => CARDV * Math.max(0, Math.min(n, G.R.handMax - (p.hand.length - 1)));
  // 吸い方を読む: 第0.5版は次のラウンドの分を見る（先読みするのは、つよいCPUだけ）
  if (!p.peek && G.pile.length) add("read", G.R.revealFirst ? (p.level >= 2 ? 0.8 : 0.25) : p.level >= 1 ? (hasReact ? 1.1 : 0.6) : 0.3);
  if (!lastRound) {
    const want = bestHeat(G, p, nextGuess(G, p)), cs = coolStepsOf(p);
    const loss = Math.max(0, cs - p.wind);
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
  if (p.level >= (G.R.revealFirst ? 2 : 1)) { // 相手を揺さぶるカード（第0.5版では、つよいCPUだけ）
    const guess = puffGuess(G, p), calmOf = (x) => x.bowl.lavender >= 2;
    const oppLoss = (x) => {
      const view = { ...x, hand: [] }; // 相手の手札は見ない
      const base = expected(G, view, heatOf(x), guess, false); view.pend = x.pend + 1; return base - expected(G, view, heatOf(x), guess, false);
    };
    // 煽り: もう手番を終えた相手（熱を合わせ直せない）のうち、いちばん手ごわい人をねらう
    const hyped = rivals.filter((x) => moved(x) && !calmOf(x)).reduce((a, b) => (!a || b.score > a.score ? b : a), null);
    if (hyped) add("hype", oppLoss(hyped), rivals.length > 1 ? hyped.index : null);
    if (ok("venue_heat")) {
      const hit = rivals.filter((x) => moved(x) && !calmOf(x));
      if (hit.length) { const me2 = { ...p, pend: p.pend + 1 }; add("venue_heat", hit.reduce((a, x) => a + oppLoss(x), 0) / Math.sqrt(hit.length) - (expected(G, p, hNow, guess, false) - expected(G, me2, hNow, guess, false))); }
    }
    // すきま風: 炭があり、守られていない相手のうち、いちばん手ごわい人
    const drafty = rivals.filter((x) => x.zone.length && !x.tools.includes("windguard") && !calmOf(x)).reduce((a, b) => (!a || b.score > a.score ? b : a), null);
    if (drafty) add("draft", 0.9, rivals.length > 1 ? drafty.index : null);
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
    const ash = CARD[id].pay?.fire || 0, up = id === "add_coal" ? 2 : 0;
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
  const opp = p.level >= 1 ? Math.max(...rivalsOf(G, p).map((o) => puffPreview(G, o).imp)) : null; // 相手のうち、いちばん高い印象
  const b = bestReaction(G, p, heatOf(p), G.judge, { slot: true, opp });
  if (b.id && cnt(p, b.id) && canPlay(G, p, b.id).ok) return { type: "play", hand: idx(p, b.id) };
  return { type: "pass" };
}
