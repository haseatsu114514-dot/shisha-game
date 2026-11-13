// カードゲーム「一台勝負」のCPU（第0.8版）。規則（ichidai-rules.js）の act に渡す入力を、1つずつ返す。
// 第0.8版: 熱は、ターンの終わりに火力（炭の火の合計）へ1だけ近づく。だから、この一口の熱は「いまの熱から−1・そのまま・+1」の
// どれかで、炭の手は「ターンの終わりの火力を、熱より上・同じ・下のどれにするか」を決める手になる。いまの手（外す0〜1・足す0〜1）を
// 総当たりして、この一口の期待点と、次の自分のターンに行ける熱（冷めたあとの炭と、焼ける炭・種火で作れる火力）で選ぶ。
// 相手の手札と山札の順は見ない。見るのは自分の手札・場に出ているもの・めくられた審査カードだけ。
// level: 0=やさしい（めくられた吸い方に合わせない・一口のために取っておかない・揺さぶらない）
//        1=ふつう（めくられた吸い方に熱を合わせる。次のラウンドの先読みと、相手を揺さぶるカードは使わない）
//        2=つよい（次のラウンドを残りの審査カードから読んで炭を仕込み、相手を揺さぶる）
//
// 第0.3版の考え方: カードは1ラウンドに1枚。提供の自分のターンに、手番のカードを使う値打ちと、一口のカードを仕込む値打ち
// （審査カードは見ずに、残りの吸い方の期待値）を比べて良いほうを使う。熱の狙いは「その熱で使える一口のカード（必要火力）」まで
// 含めた期待点で決める。rules.reactAfterReveal のときは、めくったあとに一口のカードを選ぶ（取っておく値打ちと比べる）。
import { CARD, FLAVOR, FLAVORS, BOWL, JUDGE, PUFFS } from "./ichidai-data.js";
import { heatOf, fireOf, settledHeat, embersOf, coalHeat, coalMaxOf, leavesOf, coolStepsOf, judgedHeat, scorePuff, unseenPuffs,
  canPlay, canPlace, canAsh, canPack, packLimit, roundsOf, isLastSession, isLastOfSession, puffPreview, rivalsOf, votePtsOf, voteScore } from "./ichidai-rules.js";

const cnt = (p, id) => p.hand.filter((x) => x === id).length;
const idx = (p, id) => p.hand.indexOf(id);
const isCoal = (id) => CARD[id].type === "coal";
const slotFree = (G, p) => (p.cardsUsed || 0) < G.R.cardsPerRound;
const REACT = ["heat_in", "heat_out", "blow", "all_in", "show_smoke", "duel", "encore"];
const IMP_W = 0.45; // 先読みでの印象1点の値打ち（一票に届く見込み）。一票が2点のときの値
/** 印象1点の値打ち。第0.6版の先行分では一票の点が立場で変わる（負けていれば3点・ふつうは2点）ので、それに比例させる */
const impW = (G, p) => (G.R.useVote ? (IMP_W * votePtsOf(G, p)) / 2 : 0); // 一票が無い対戦（入門）では、印象に値打ちは無い
const CARDV = 0.6; // 手札1枚の値打ち（点。チャージすれば火1の炭になる）

// ───────── 熱の見込み（第0.8版） ─────────
// 一口を受ける熱の見込み { need, at }。need＝カードを使うときの熱（「熱N以上で使える」を見る）。
// at(paid)＝熱を paid 落として使ったあと、審査のときの熱
/** いまの熱 heat・ターンの終わりの火力 fire: 落とした熱は、蒸らしで火力へ寄って戻る */
const lagged = (G, heat, fire) => ({ need: heat, at: (paid = 0) => settledHeat(G, Math.max(0, heat - paid), fire) });
/** 熱 h を保てているとき（火力も h。落としたぶんは蒸らしで戻る）。狙いの熱を決めるのに使う */
const steady = (h) => ({ need: h, at: () => h });
/** 熱がもう動かないとき（審査カードをめくったあとに使う規則）: 落としたぶんだけ下がる */
const direct = (h) => ({ need: h, at: (paid = 0) => Math.max(0, h - paid) });
const ctxNow = (G, p) => lagged(G, heatOf(p), fireOf(p));

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
function reactionValue(G, p, cx, q, id, opp) {
  const tk = id === "heat_in" ? 1 : id === "heat_out" ? -2 : 0, blow = id === "blow";
  const paid = id ? CARD[id].pay?.fire || 0 : 0; // 使うために落とす熱
  const s = scorePuff(p, judgedHeat(p, q, tk, cx.at(paid)), q, { blow, lastOfSession: isLastOfSession(G) });
  const good = s.zone === "just" || s.zone === "band";
  let pts = s.pts + (id === "heat_out" && good ? 1 : 0) + (id === "all_in" && s.zone === "just" ? 3 : 0);
  if (id === "encore") pts *= 2;
  const imp = voteScore(G, p, s, pts, (id === "show_smoke" ? 4 : 0) + (id === "all_in" && s.zone === "just" ? 2 : 0) + (id === "heat_in" && good ? 1 : 0) + (p.sessImp || 0));
  const vote = opp == null ? impW(G, p) * Math.max(-3, imp) + (id === "duel" && G.R.useVote ? 0.8 : 0) : (G.R.useVote && imp > opp ? votePtsOf(G, p) + (id === "duel" ? 3 : 0) : 0);
  // 焦げの重さ: 0点になるうえ、主役の葉を失う（1枚ぶんを2点と見る。失う枚数は規則の scorchLoss）
  const v = pts + vote - (s.zone === "scorch" ? 2 + 2 * G.R.scorchLoss : 0) - (s.usedSilicone ? 2.5 : 0) - (s.usedLotus ? 0.8 : 0)
    - (id ? 0.5 : 0) - (id === "show_smoke" ? 0.6 : 0) - (blow && !s.saved ? 1 : 0) - 0.35 * paid;
  return { v, id, s, pts, imp };
}
/** 熱の見込み cx で審査カード q を受けるときの、いちばん良い受け方。slot=カードの1枚がまだ使えるか */
function bestReaction(G, p, cx, q, { slot = true, opp = null } = {}) {
  let best = reactionValue(G, p, cx, q, null, opp);
  if (!slot) return best;
  for (const id of REACT) {
    if (!cnt(p, id) || (CARD[id].need || 0) > cx.need) continue;
    if (id === "encore" && !isLastSession(G)) continue;
    const r = reactionValue(G, p, cx, q, id, opp);
    if (r.v > best.v + 1e-9) best = r;
  }
  return best;
}
/** その熱で審査の前に仕込める一口のカード（審査を見ずに1枚決める規則のとき）。いちばん良いもの { v, id } */
function bestCommit(G, p, cx, guess) {
  let best = { v: -Infinity, id: null };
  for (const id of [null, ...REACT]) {
    if (id && (!cnt(p, id) || (CARD[id].need || 0) > cx.need)) continue;
    if (id === "encore" && !isLastSession(G)) continue;
    let sum = 0, w = 0;
    for (const g of guess) { sum += g.w * reactionValue(G, p, cx, g.q, id, null).v; w += g.w; }
    if (sum / w > best.v + 1e-9) best = { v: sum / w, id };
  }
  return best;
}
function expected(G, p, cx, guess, slot) {
  if (slot && p.level >= 1 && !G.R.reactAfterReveal) return bestCommit(G, p, cx, guess).v;
  let sum = 0, w = 0;
  for (const g of guess) { sum += g.w * bestReaction(G, p, cx, g.q, { slot: slot && p.level >= 1 }).v; w += g.w; }
  return sum / w;
}
/** 保ちたい熱（その熱を保てているときの期待点がいちばん高い熱） */
function bestHeat(G, p, guess = puffGuess(G, p), slot = true) {
  let best = 0, bv = -Infinity;
  for (let h = 0; h <= G.R.heatMax; h++) { const v = expected(G, p, steady(h), guess, slot) + (h <= 7 ? 0.01 * h : 0); if (v > bv) { bv = v; best = h; } }
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
  return { type: "embers", picks: order.slice(0, embersOf(G, p)).map((x) => x.i) };
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

// 冷める: 炭の火を1下げる。熱も火力も狙いより高くなければ、まず風防で受ける。下げるのは火の小さい炭から
// （種火や弱った炭は先に灰にして枠を空け、火の大きい炭を残す。同じ炭は1ターンに1段階まで）
function cool(G, p) {
  const tgt = bestHeat(G, p);
  if (heatOf(p) <= tgt && fireOf(p) <= tgt + 1 && p.wind > 0) return { type: "cool", wind: true };
  const i = weakestCoal(p, (c) => !c.cooled);
  return i >= 0 ? { type: "cool", zone: i } : { type: "cool", wind: true };
}

// 準備（第0.8版）: 毎ターン、予定の葉を詰めながら炭にも触れる
function prep(G, p, w) {
  const want = leafWant(G, p, G.R.prepTurns - w.n);
  if (canPack(G, p).ok && leavesOf(p) < want) {
    if (cnt(p, "buyout") && canPlay(G, p, "buyout").ok && leavesOf(p) + packLimit(G, p) < want) return { type: "play", hand: idx(p, "buyout") };
    const picks = packPicks(G, p, want);
    if (Object.keys(picks).length) return { type: "pack", picks };
  }
  const a = coalMove(G, p, { prep: true, turnsLeft: G.R.prepTurns - w.n });
  if (a) return a;
  const perm = permanent(G, p);
  if (perm && perm.v >= 0.8) return perm.act;
  return { type: "end" };
}
/** 詰めたい葉の枚数。葉は一口ごとに減るので、残りの準備ターンで入るだけ詰める（一式の配合の比のまま増やす） */
function leafWant(G, p, turnsLeft) {
  const cap = BOWL[p.bowlId].cap, planN = p.plan.reduce((a, [, n]) => a + n, 0) || 12;
  if (!(G.R.puffWear > 0)) return Math.min(cap, planN);
  const perTurn = G.R.packN + (p.bowlId === "beat80" ? 1 : 0);
  return Math.min(cap, leavesOf(p) + (p.turn.packed ? 0 : packLimit(G, p)) + turnsLeft * perTurn);
}
/** 一式の配合を、詰めたい枚数 want に合わせて増やしたもの（比はそのまま。端数は主役へ） */
function scaledPlan(G, p, want) {
  const plan = p.plan.length ? p.plan : [[G.market[0], 8]], planN = plan.reduce((a, [, n]) => a + n, 0);
  if (want <= planN) return plan;
  const out = plan.map(([id, n]) => [id, Math.floor((n * want) / planN)]);
  out[0][1] += want - out.reduce((a, [, n]) => a + n, 0);
  return out;
}
function packPicks(G, p, want) {
  let room = Math.min(packLimit(G, p), want - leavesOf(p)); const picks = {}, kinds = [];
  // 予定の葉。場に足りなければ、同じ系統のほかの葉で埋める
  const got = (id) => (p.bowl[id] || 0) + (picks[id] || 0);
  for (const [id, n] of scaledPlan(G, p, want)) {
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

const NEXT_W = 0.9; // 次の自分のターンの一口の重み
/**
 * 炭まわりの次の一手（置く・のせる・チャージ・外す）。無ければ null。
 * 第0.8版: 熱は、ターンの終わりに火力へ1近づく。いまの手（外す0〜1・足す0〜1）を総当たりして、
 *   ・この一口: ターンの終わりの火力で寄ったあとの熱で受ける期待点
 *   ・次の自分のターン: 冷めたあとの炭に、焼ける炭・種火を足し引きして作れる火力から、行ける熱（−1・そのまま・+1）のうち一番良いもの
 * で選び、1手ずつ進める。準備のあいだは審査が無いので、最初の一口までに狙いの熱へ届くか（届かないぶん・行き過ぎたぶん）で選ぶ
 */
function coalMove(G, p, { prep = false, turnsLeft = 0 } = {}) {
  // 1. 炭カードは、枠があれば置く
  const ci = p.hand.findIndex((id) => isCoal(id) && canPlace(G, p, id).ok);
  if (ci >= 0) return { type: "place", hand: ci };
  if (p.turn.ai?.heatDone) return null;
  const h0 = heatOf(p), cmax = coalMaxOf(p);
  const ready = p.stove.map((c, i) => ({ f: CARD[c.id].heat, i })).filter((x) => p.stove[x.i].stage === 2);
  const later = p.stove.filter((c) => c.stage === 1).map((c) => CARD[c.id].heat); // 次の自分のターンに焼ける炭
  // 炭を足す手（のせる・チャージ）の残り。合わせて1ターンに1つ（coalAdds）
  const addsLeft = Math.max(0, G.R.coalAdds - (p.turn.adds || 0));
  const canAshNow = canAsh(G, p).ok;
  const drawable = G.R.chargeDraw <= 0 || p.deck.length + p.ash.length > 0;
  const chargeNow = addsLeft > 0 && (p.turn.charges || 0) < G.R.chargePerTurn && p.hand.length > 0 && drawable;
  const guess = prep ? null : puffGuess(G, p), slot = slotFree(G, p);
  const lastRound = !prep && G.round === roundsOf(G) - 1;
  const gNext = nextGuess(G, p), want = bestHeat(G, p, gNext);
  const nextPrep = prep && turnsLeft > 0; // 次の自分のターンも準備（冷めない・審査が無い）
  // 準備: 最初の一口までに狙いの熱へ届くか。rem＝そのあと最初の審査までに残る自分のターンの数
  const potential = (h, rem) => -1.4 * Math.max(0, Math.abs(want - h) - rem) - 0.3 * Math.max(0, h - want);
  // 外す候補: しない／火の小さい炭から、火の違うものを1つずつ
  const ashOpts = [-1];
  if (canAshNow) { const seen = new Set(); p.zone.map((c, i) => ({ f: coalHeat(c), i, up: c.up })).sort((a, b) => a.f - b.f || a.up - b.up).forEach((x) => { if (!seen.has(x.f)) { seen.add(x.f); ashOpts.push(x.i); } }); }
  // 足す候補: しない／焼けた炭（火の違うものを1つずつ）／種火
  const addOpts = [null];
  if (addsLeft > 0) { const seen = new Set(); for (const x of ready) if (!seen.has(x.f)) { seen.add(x.f); addOpts.push({ f: x.f, i: x.i }); } }
  if (chargeNow) addOpts.push({ f: 1, charge: true });
  let best = null;
  for (const ai of ashOpts) {
    const base = p.zone.map((c) => coalHeat(c)); let ashCost = 0;
    if (ai >= 0) { ashCost = 0.25 + 0.3 * base[ai]; base.splice(ai, 1); }
    for (const add of addOpts) {
      if (add && base.length >= cmax) continue;
      const now = add ? [...base, add.f] : base, f1 = now.reduce((a, b) => a + b, 0), h1 = settledHeat(G, h0, f1);
      // 足す値段: 種火は手札1枚ぶんだが、置いたら1枚引ける（チャージ＆ドロー）ので、ほぼただ
      let v = -ashCost - (add ? (add.charge ? (G.R.chargeDraw > 0 ? 0.05 : 0.6) : 0.05) : 0);
      if (prep) v += potential(h1, turnsLeft + 1);
      else v += expected(G, p, lagged(G, h0, f1), guess, slot);
      if (!lastRound) {
        // 次の自分のターン: 冷めて（火の小さい炭から）、外す0〜1・足す0〜1で作れる火力
        const solo = p.hmd === "one_coal" && now.length === 1; // C1: 炭が1つだけなら冷めない
        const skipBig = p.hmd === "big_tanukish" && (prep ? !nextPrep : (G.round + 1) % 3 === 0);
        const steps = nextPrep || solo || skipBig ? 0 : Math.max(0, Math.min(G.R.cool, now.length) - p.wind);
        const after = [...now].sort((a, b) => a - b);
        for (let k = 0; k < steps && k < after.length; k++) after[k]--;
        const left = after.filter((f) => f > 0), sumLeft = left.reduce((a, b) => a + b, 0);
        const stock = new Set([...ready.filter((x) => !add || add.charge || x.i !== add.i).map((x) => x.f), ...later]);
        if (drawable && G.R.chargePerTurn > 0) stock.add(1); // 種火（次のターンも1枚は引く）
        let bestN = -Infinity;
        for (const out of [null, ...new Set(left)]) for (const inn of [0, ...stock]) {
          if (left.length - (out != null ? 1 : 0) + (inn ? 1 : 0) > cmax) continue;
          const f2 = sumLeft - (out ?? 0) + inn, h2 = settledHeat(G, h1, f2);
          // そのまた次のターンに、何もしなければ行く熱（火力が離れすぎていると、熱が流されていく）
          const h3 = settledHeat(G, h2, Math.max(0, f2 - 1));
          const val = (nextPrep ? potential(h2, turnsLeft) : expected(G, p, steady(h2), gNext, true))
            - 0.3 * Math.abs(h3 - want) - (out != null ? 0.2 : 0) - (inn ? 0.05 : 0);
          if (val > bestN) bestN = val;
        }
        v += NEXT_W * bestN;
      }
      if (!best || v > best.v + 1e-9) best = { v, ai, add };
    }
  }
  if (!best || (best.ai < 0 && !best.add)) { (p.turn.ai ||= {}).heatDone = true; return null; }
  if (best.ai >= 0) return { type: "ash", zone: best.ai };
  if (!best.add.charge) return { type: "puton", stove: best.add.i };
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
  const sessLeft = 3 - (G.round % 3); // このセッションに残っている一口（この一口も入れて）
  const ok = (id) => cnt(p, id) && canPlay(G, p, id).ok;
  const cands = [];
  const add = (id, v, target = null) => { if (ok(id) && v > 0) cands.push({ v, act: target == null ? { type: "play", hand: idx(p, id) } : { type: "play", hand: idx(p, id), target } }); };
  const perm = permanent(G, p); if (perm) cands.push(perm);
  const cx = ctxNow(G, p), fNow = fireOf(p), hasReact = REACT.some((id) => cnt(p, id));
  const guess0 = puffGuess(G, p);
  // 吸い方を読む: 第0.5版は次のラウンドの分を見る（先読みするのは、つよいCPUだけ）
  if (!p.peek && G.pile.length) add("read", G.R.revealFirst ? (p.level >= 2 ? 0.8 : 0.25) : p.level >= 1 ? (hasReact ? 1.1 : 0.6) : 0.3);
  if (!lastRound) {
    const want = bestHeat(G, p, nextGuess(G, p)), cs = coolStepsOf(p);
    const loss = Math.max(0, cs - p.wind);
    // 灰落とし: 次のターンに冷めて足りなくなる火力を、炭を足さずに済む
    if (!p.noCool) add("ash_tap", CARDV * Math.min(loss, Math.max(0, Math.max(want, cx.at(0)) - (fNow - loss))) + 0.2);
    const notReady = p.stove.filter((c) => c.stage < 2).length;
    if (notReady) add("fan", 0.5 * notReady);
    // 寄せ: このセッションの残りの一口すべての判定熱を動かす。次の一口からは熱を合わせ直せるので、
    // 「合わせ直したあとの一番良い期待点」の差で測る（外寄せなら、判定熱を保ったまま熱を上げて必要な熱に届く）
    const bestE = (pp) => { let b = -Infinity; for (let h = 0; h <= G.R.heatMax; h++) b = Math.max(b, expected(G, pp, steady(h), guess0, true)); return b; };
    // 内寄せ: このセッションの残りの一口すべての印象+1（一票に届く見込み）
    if (sessLeft >= 2 || !lastOfSession) add("inner", impW(G, p) * 1.6 * sessLeft);
    for (const [id, d] of [["outer", -1]]) {
      if (sessLeft <= 1 || !cnt(p, id)) continue;
      const view = { ...p, sessMod: p.sessMod + d };
      add(id, (expected(G, view, cx, guess0, false) - expected(G, p, cx, guess0, false)) + (bestE(view) - bestE(p)) * (sessLeft - 1));
    }
  }
  // 葉をほぐす: このセッションの残りの一口で、葉が減らない（1枚ぶんを0.55点と見る）。セッションの終わりに減る規則なら、その直前に使う
  if (!p.keepLeaves && G.R.puffWear > 0 && !(p.bowlId === "funnel" && sessLeft === 3)) add("loosen", 0.55 * G.R.puffWear * Math.min(sessLeft, roundsOf(G) - 1 - G.round));
  else if (!p.keepLeaves && G.R.wear > 0 && !isLastSession(G) && lastOfSession) add("loosen", 1.6);
  if (p.hand.length <= 2) add("breath", 0.9);
  if (p.level >= (G.R.revealFirst ? 2 : 1)) { // 相手を揺さぶるカード（第0.5版では、つよいCPUだけ）
    const guess = puffGuess(G, p), calmOf = (x) => x.bowl.lavender >= 2;
    const oppLoss = (x) => {
      const view = { ...x, hand: [] }; // 相手の手札は見ない
      const base = expected(G, view, steady(heatOf(x)), guess, false); view.pend = x.pend + 1; return base - expected(G, view, steady(heatOf(x)), guess, false);
    };
    // 煽り: もう手番を終えた相手（熱を合わせ直せない）のうち、いちばん手ごわい人をねらう
    const hyped = rivals.filter((x) => moved(x) && !calmOf(x)).reduce((a, b) => (!a || b.score > a.score ? b : a), null);
    if (hyped) add("hype", oppLoss(hyped), rivals.length > 1 ? hyped.index : null);
    if (ok("venue_heat")) {
      const hit = rivals.filter((x) => moved(x) && !calmOf(x));
      if (hit.length) { const me2 = { ...p, pend: p.pend + 1 }; add("venue_heat", hit.reduce((a, x) => a + oppLoss(x), 0) / Math.sqrt(hit.length) - (expected(G, p, cx, guess, false) - expected(G, me2, cx, guess, false))); }
    }
    // すきま風: 炭があり、守られていない相手のうち、いちばん手ごわい人
    const drafty = rivals.filter((x) => x.zone.length && !x.tools.includes("windguard") && !calmOf(x)).reduce((a, b) => (!a || b.score > a.score ? b : a), null);
    if (drafty) add("draft", 0.9, rivals.length > 1 ? drafty.index : null);
    if (!lastRound && p.level >= 2) add("go_second", 0.5);
  }
  cands.sort((a, b) => b.v - a.v);
  return cands[0] || null;
}

/** 枠を返すカードのうち、使って得なもの（引く値打ち＋熱が下がる・火力が上がる値打ち）。無ければ null */
function freeCard(G, p) {
  const h = heatOf(p), f = fireOf(p), guess = puffGuess(G, p);
  const drawV = (n) => CARDV * Math.max(0, Math.min(n, G.R.handMax + 1 - p.hand.length));
  // 熱を落としたあと・火力を足したあとに、この一口で一番良く受けられるか（枠は残っている）
  const at = (hh, ff) => expected(G, p, lagged(G, Math.max(0, hh), ff), guess, true);
  let best = null;
  for (const [id, n] of [["breath", 1], ["tongs", 2], ["reset", 3], ["add_coal", 0]]) {
    if (!cnt(p, id) || !canPlay(G, p, id).ok) continue;
    const ash = CARD[id].pay?.fire || 0, up = id === "add_coal" ? Math.min(2, coalMaxOf(p) - p.zone.length) : 0;
    const v = drawV(n) + at(h - ash, f + up) - at(h, f) + (id === "add_coal" ? up * CARDV * 0.5 : ash ? 0 : 0.05);
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
      const guess = puffGuess(G, p), cx = ctxNow(G, p), c = bestCommit(G, p, cx, guess);
      const gain = c.id ? c.v - expected(G, p, cx, guess, false) : 0;
      if (c.id && gain > (t ? t.v : 0) && canPlay(G, p, c.id).ok) return { type: "play", hand: idx(p, c.id) };
      if (t && t.v > 0) { if (p.turn.ai) p.turn.ai.heatDone = false; return t.act; }
      return { type: "end" };
    }
    if (t) {
      const guess = puffGuess(G, p), cx = direct(heatOf(p));
      const hold = p.level >= 1 ? expected(G, p, cx, guess, true) - expected(G, p, cx, guess, false) : 0;
      if (t.v > hold) { if (p.turn.ai) p.turn.ai.heatDone = false; return t.act; }
    }
  }
  return { type: "end" };
}

// 審査: めくられたカードを見て、いちばん良い一口を1枚だけ使う（使わなくてもよい）
function react(G, p) {
  if (!slotFree(G, p)) return { type: "pass" };
  const opp = p.level >= 1 ? Math.max(...rivalsOf(G, p).map((o) => puffPreview(G, o).imp)) : null; // 相手のうち、いちばん高い印象
  const b = bestReaction(G, p, direct(heatOf(p)), G.judge, { slot: true, opp });
  if (b.id && cnt(p, b.id) && canPlay(G, p, b.id).ok) return { type: "play", hand: idx(p, b.id) };
  return { type: "pass" };
}
