// カードゲーム「一台勝負」のCPU。規則（ichidai-rules.js）の act に渡す入力を、1つずつ返す。
// 相手の手札と山札の順は見ない。見るのは自分の手札・場に出ているもの・めくられた審査カードだけ。
// level: 0=やさしい（審査カードを数えない・構えない・揺さぶらない） 1=ふつう 2=つよい（残りの審査カードを数えて期待値で決める）
import { CARD, FLAVOR, FLAVORS, BOWL, JUDGE, PUFFS } from "./ichidai-data.js";
import { RULES, RANK, heatOf, coalHeat, leavesOf, firepower, sidesOf, slotsOf, coolStepsOf, judgedHeat, scorePuff, unseenPuffs,
  canPlay, canCharge, canPlace, canPutOn, canPack, canSteam, packLimit, roundsOf, isLastSession, isLastOfSession, puffPreview } from "./ichidai-rules.js";

const cnt = (p, id) => p.hand.filter((x) => x === id).length;
const idx = (p, id) => p.hand.indexOf(id);
const isCoal = (id) => CARD[id].type === "coal";

// 手元での値打ち（低いものから種火にする・捨てる）
const VALUE = { buyout: 0.3, repack: 0, encore: 1.2, go_second: 0.8, outer: 0.9, tongs: 0.9, fan: 1.0, loosen: 1.0 };
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
/** 審査カード q に対する、技まで含めたいちばん良い受け方 */
function bestReaction(G, p, heat, q, mana) {
  let best = null;
  const nIn = cnt(p, "heat_in"), nOut = cnt(p, "heat_out"), nBlow = cnt(p, "blow");
  for (const tk of [0, 1, -1, 2, -2]) {
    if (tk > nIn || -tk > nOut || Math.abs(tk) > mana) continue;
    for (const blow of [false, true]) {
      if (blow && (!nBlow || Math.abs(tk) + 1 > mana)) continue;
      const s = scorePuff(p, judgedHeat(p, q, tk, heat), q, { blow, lastOfSession: isLastOfSession(G) });
      if (blow && !s.saved) continue;
      const v = s.pts - 1.2 * (Math.abs(tk) + (blow ? 1 : 0)) - (s.zone === "scorch" ? 4 : 0) - (s.usedSilicone ? 2.5 : 0) - (s.usedLotus ? 0.8 : 0);
      if (!best || v > best.v + 1e-9) best = { v, tk, blow, s };
    }
  }
  return best;
}
function expected(G, p, heat, mana, guess = puffGuess(G, p)) {
  let sum = 0, w = 0;
  for (const g of guess) { sum += g.w * bestReaction(G, p, heat, g.q, p.level <= 0 ? 0 : mana).v; w += g.w; }
  return sum / w;
}
function bestHeat(G, p, guess = puffGuess(G, p)) {
  let best = 0, bv = -Infinity;
  for (let h = 0; h <= RULES.heatMax; h++) { const v = expected(G, p, h, Math.min(h, 2), guess) + (h <= 7 ? 0.01 * h : 0); if (v > bv) { bv = v; best = h; } }
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
  return { type: "embers", picks: order.slice(0, RULES.startEmbers).map((x) => x.i) };
}
function discard(G, p) {
  const need = p.hand.length - RULES.handMax;
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
    const a = coalMove(G, p, { prep: true, turnsLeft: RULES.prepTurns - w.n });
    if (a) return a;
  }
  const perm = permanent(G, p, 0);
  if (perm) return perm;
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
  if (prep) {
    // 準備: 提供の最初のターンに冷めるぶんを見込んで、狙いより少し上まで
    const want1 = bestHeat(G, p), target = Math.min(RULES.heatMax, want1 + (p.hmd === "big_tanukish" ? 0 : coolStepsOf(p)));
    const on = ready.find((x) => h0 + CARD[x.c.id].heat <= target);
    if (on) return { type: "puton", stove: on.i };
    const coming = p.stove.reduce((a, c) => a + (2 - c.stage <= turnsLeft ? CARD[c.id].heat : 0), 0);
    if (h0 < target && h0 + coming + turnsLeft < target && canCharge(G, p).ok) return { type: "charge", hand: worstIndex(G, p) };
    return null;
  }
  // 提供: 蓄えた熱の変化 d を総当たりし、期待値がいちばん高いところへ1手ずつ寄せる
  if (p.turn.ai?.heatDone) return null;
  const guess = puffGuess(G, p), spent = p.spent;
  const rF = ready.filter((x) => CARD[x.c.id].heat === 1), rC = ready.filter((x) => CARD[x.c.id].heat === 2);
  const upF = p.zone.filter((c) => c.up && CARD[c.id].heat === 1).length, embersN = p.zone.filter((c) => !c.up).length;
  const lastRound = G.round === roundsOf(G) - 1;
  const canChg = canCharge(G, p).ok, hasAdd = cnt(p, "add_coal") && canPlay(G, p, "add_coal").ok;
  const keep = reserve(p);
  let best = null;
  for (let d = -3; d <= 4; d++) {
    const step = { onF: 0, onC: 0, charge: 0, add: 0, ash: 0 }; let cost = 0, r = d;
    if (d > 0) {
      step.onF = Math.min(rF.length, r); r -= step.onF; cost += 0.05 * step.onF;
      while (r >= 2 && step.onC < rC.length) { step.onC++; r -= 2; cost += 0.05; }
      if (r >= 1 && hasAdd) { step.add = 1; r--; cost += 0.9; }
      if (r >= 1 && canChg && p.hand.length - step.add > 0) { step.charge = 1; r--; cost += Math.max(0.6, cardValue(G, p, p.hand[worstIndex(G, p)])); }
      if (r !== 0) continue;
    } else if (d < 0) { step.ash = -d; if (step.ash > embersN) continue; cost += 1.0 * step.ash; }
    const h1 = h0 + d; if (h1 < 0 || h1 > RULES.heatMax) continue;
    let v = expected(G, p, h1, Math.max(0, h1 - spent), guess) - cost;
    if (!lastRound) { // 次の自分のターンに、狙いの熱へ届くか
      const want = bestHeat(G, p, p.level >= 1 ? puffGuess(G, { ...p, peek: null }) : normalGuess);
      const cube = step.onC || p.zone.some((c) => c.up && CARD[c.id].heat === 2);
      const cs = Math.max(1, RULES.cool - (cube ? 1 : 0)), loss = Math.max(0, cs - (upF + step.onF + p.wind));
      const up = p.stove.filter((c) => c.stage >= 1).reduce((a, c) => a + CARD[c.id].heat, 0) - step.onF - 2 * step.onC + (p.hand.length - step.charge - step.add > 0 ? 1 : 0);
      v -= 1.4 * Math.max(0, want - (h1 - loss + Math.max(0, up))) + 0.5 * Math.max(0, h1 - cs - 2 - want);
    }
    if (!best || v > best.v + 1e-9) best = { v, d, step };
  }
  const s = best?.step;
  if (!s || best.d === 0) { (p.turn.ai ||= {}).heatDone = true; return null; }
  if (s.onF) return { type: "puton", stove: rF[0].i };
  if (s.onC) return { type: "puton", stove: rC[0].i };
  if (s.add) return { type: "play", hand: idx(p, "add_coal") };
  if (s.charge) return { type: "charge", hand: worstIndex(G, p) };
  if (s.ash) return { type: "ash", zone: p.zone.findIndex((c) => !c.up) };
  return null;
}
/** 一口の技のために残す火力 */
function reserve(p) {
  if (p.level <= 0) return 0;
  const n = cnt(p, "heat_in") + cnt(p, "heat_out") + cnt(p, "blow");
  return Math.min(p.level >= 2 ? 2 : 1, n);
}
/** 器具・人物を出す */
function permanent(G, p, keep) {
  if (G.phase === "serve" && roundsOf(G) - G.round < 2) return null;
  for (let i = 0; i < p.hand.length; i++) {
    const id = p.hand[i], c = CARD[id];
    if (c.type !== "tool" && c.type !== "person") continue;
    if (c.type === "person" && p.person) continue;
    if (c.type === "tool" && p.tools.length >= RULES.toolMax) continue;
    if (firepower(p) - keep < c.cost || !canPlay(G, p, id).ok) continue;
    return { type: "play", hand: i };
  }
  return null;
}

function main(G, p) {
  const o = G.P[1 - p.index], keep = reserve(p), second = G.order[1] === p.index;
  const lastRound = G.round === roundsOf(G) - 1, lastOfSession = isLastOfSession(G);
  const ok = (id) => cnt(p, id) && canPlay(G, p, id).ok;
  const spare = () => firepower(p) - keep;
  const use = (id) => ({ type: "play", hand: idx(p, id) });
  // やさしい: ときどきチャージを忘れる（その回は炭の手をとばす）
  const sloppy = p.level <= 0 && ((G.seed >>> 3) + G.round * 7 + p.hand.length) % 10 < 3;

  const place = p.hand.findIndex((id) => isCoal(id) && canPlace(G, p, id).ok);
  if (place >= 0) return { type: "place", hand: place };
  if (p.level >= 1 && ok("read") && !p.peek) return use("read");
  const perm = permanent(G, p, keep); if (perm) return perm;
  if (!sloppy) { const cm = coalMove(G, p); if (cm) return cm; }

  // 次に備える
  const hNow = heatOf(p);
  if (!lastRound) {
    const want = bestHeat(G, p, p.level >= 1 ? puffGuess(G, { ...p, peek: null }) : normalGuess), cs = coolStepsOf(p);
    const cushion = p.zone.filter((c) => c.up && CARD[c.id].heat === 1).length + p.wind;
    const readyNext = p.stove.filter((c) => c.stage >= 1).reduce((a, c) => a + CARD[c.id].heat, 0);
    if (ok("ash_tap") && spare() >= 1 && !p.noCool && hNow - Math.max(0, cs - cushion) + readyNext < want) return use("ash_tap");
    if (ok("fan") && spare() >= 1 && hNow - cs + readyNext < want) return use("fan");
    if (ok("inner") && spare() >= 2 && !lastOfSession && hNow < want - 1) return use("inner");
    if (ok("outer") && spare() >= 1 && !lastOfSession && hNow - cs > want + 1) return use("outer");
    if (ok("tongs") && p.hand.length <= 3 && hNow - cs > want) return use("tongs");
    if (ok("reset") && hNow - cs >= want + 2 && p.zone.filter((c) => !c.up).length >= 2 && p.hand.length <= 5) return use("reset");
  }
  if (ok("loosen") && spare() >= 2 && !isLastSession(G) && !p.keepLeaves && lastOfSession) return use("loosen");
  if (ok("breath") && spare() >= 1 && p.hand.length <= 5) return use("breath");

  // 相手を揺さぶる（ふつう以上）。相手がもうターンを終えている＝自分が後手のときに、相手の見込みが大きく下がるなら
  if (p.level >= 1) {
    const guess = puffGuess(G, p);
    const oppLoss = () => {
      const oh = heatOf(o), om = Math.min(firepower(o), 2), view = { ...o, hand: [] }; // 相手の手札は見ない
      const base = expected(G, view, oh, om, guess); view.pend = o.pend + 1; return base - expected(G, view, oh, om, guess);
    };
    const calm = o.bowl.lavender >= 2;
    if (second && !calm) {
      if (ok("hype") && spare() >= 2 && oppLoss() >= 1.5) return use("hype");
      if (ok("venue_heat") && spare() >= 1) {
        const mine = expected(G, p, hNow, firepower(p), guess), me2 = { ...p, pend: p.pend + 1 };
        if (oppLoss() - (mine - expected(G, me2, hNow, firepower(p), guess)) >= 1.5) return use("venue_heat");
      }
    }
    if (ok("draft") && spare() >= 2 && o.zone.length && !o.tools.includes("windguard") && !calm) return use("draft");
    if (ok("go_second") && spare() >= 1 && !lastRound && p.level >= 2) return use("go_second");
  }
  return { type: "end" };
}

// 審査: めくられたカードを見て、吸いの技と点を伸ばすカードを使う
function react(G, p) {
  const q = G.judge, o = G.P[1 - p.index], pf = p.puff;
  const use = (id) => ({ type: "play", hand: idx(p, id) });
  const ok = (id) => cnt(p, id) && canPlay(G, p, id).ok;
  if (!pf.ai) {
    // 技を足す前の熱で、いちばん良い受け方を一度だけ決める
    const b = bestReaction(G, p, heatOf(p), q, firepower(p));
    pf.ai = { tk: b.tk, blow: b.blow };
  }
  if (pf.ai.tk > 0 && ok("heat_in")) { pf.ai.tk--; return use("heat_in"); }
  if (pf.ai.tk < 0 && ok("heat_out")) { pf.ai.tk++; return use("heat_out"); }
  if (pf.ai.blow && ok("blow")) { pf.ai.blow = false; return use("blow"); }
  const now = puffPreview(G, p), good = now.zone === "just" || now.zone === "band";
  if (now.zone === "just" && ok("all_in")) return use("all_in");
  if (good && now.rich && ok("show_smoke")) return use("show_smoke");
  const oppZone = o.puff?.done || G.order[0] === o.index ? puffPreview(G, o).zone : puffPreview(G, o).zone;
  if (ok("duel") && RANK[now.zone] > RANK[oppZone] && (G.order[1] === p.index || p.level < 2)) return use("duel");
  if (ok("encore") && (G.round === roundsOf(G) - 1 || now.pts >= 9)) return use("encore");
  return { type: "pass" };
}
