// カードゲーム「一台勝負」の規則（第0.2版）。DOM・保存・音に触れない純粋な状態機械。
// 使い方: const G = createGame(cfg); → G.wait が「だれの、どの入力を待っているか」。act(G, action) で進める。
// 画面（ichidai.js）もCPU（ichidai-ai.js）もテストも、この act だけで対戦を進める。
// 規則の文は docs/design/card_game/ichidai_shobu_rulebook_v0.2.pdf。
import { FLAVOR, FLAVORS, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENT, KIT, FIRST_MARKET, expandDeck } from "./ichidai-data.js";

export const RULES = Object.freeze({
  startDraw: 7, startEmbers: 3, prepTurns: 6, packN: 4, firstPackCut: 2, steamDraw: 1, steamLeaves: 8,
  draw: 2, cool: 2, slots: 4, heatMax: 10, handMax: 7, pile: 12, vote: 2, wear: 2, rich: 10, toolMax: 3,
});
export const RANK = Object.freeze({ just: 4, band: 3, off: 2, cold: 1, scorch: 0 });
export const ZONE_LABEL = Object.freeze({ just: "ジャスト", band: "適温", off: "ズレ", cold: "外れ", scorch: "焦げ" });

// ───────── 乱数（種つき。同じ種なら同じ対戦になる） ─────────
function nextRand(G) { G.seed = (Math.imul(G.seed, 1664525) + 1013904223) >>> 0; return G.seed / 4294967296; }
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(nextRand(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ───────── 読み取り ─────────
export const heatOf = (p) => p.zone.reduce((a, c) => a + coalHeat(c), 0);
export const coalHeat = (c) => (c.up ? CARD[c.id].heat : 1);
export const leavesOf = (p) => Object.values(p.bowl).reduce((a, b) => a + b, 0);
export const firepower = (p) => Math.max(0, heatOf(p) - p.spent);
export const sidesOf = (p) => Object.keys(p.bowl).filter((k) => k !== p.main && p.bowl[k] >= 2);
export const hasTool = (p, id) => p.tools.includes(id) || p.person === id;
/** 炭焼き場の枠。だれでも4つで、カードでは増えない（2026-11-11 オーナー指示） */
export const slotsOf = () => RULES.slots;
const hasUpCube = (p) => p.zone.some((c) => c.up && CARD[c.id].heat === 2);
/** このターンの冷める段階（キューブ炭【火持ち】で1つ減る） */
export const coolStepsOf = (p) => Math.max(1, RULES.cool - (hasUpCube(p) ? 1 : 0));
export const roundsOf = (G) => G.tour.sessions * 3;
export const sessionOf = (G) => Math.floor(G.round / 3);
export const isLastSession = (G) => G.round >= roundsOf(G) - 3;
export const isLastOfSession = (G) => G.round % 3 === 2;
/** まだめくられていない審査カード（順は分からない）。練習試合は「ふつうに吸う」だけ */
export const unseenPuffs = (G) => (G.pile.length ? G.pile : [PUFFS.normal]);

function fixMain(p) {
  const ids = Object.keys(p.bowl).filter((k) => p.bowl[k] > 0);
  for (const k of Object.keys(p.bowl)) if (!(p.bowl[k] > 0)) delete p.bowl[k];
  if (!ids.length) { p.main = null; return; }
  if (p.bowl.death_by_ice > 0) { p.main = "death_by_ice"; return; }
  const cand = ids.filter((k) => k !== "spring_water" || ids.length === 1);
  const top = Math.max(...cand.map((k) => p.bowl[k]));
  if (!p.main || !(p.bowl[p.main] > 0) || p.bowl[p.main] < top || (p.main === "spring_water" && ids.length > 1)) p.main = cand.find((k) => p.bowl[k] === top);
}

// ───────── 採点 ─────────
/** 蓄えた熱 → 判定熱。q=審査カード tk=吸いの技の合計（+1/−1） */
export function judgedHeat(p, q, tk = 0, heat = heatOf(p)) {
  const calm = p.bowl.lavender >= 2;
  return heat + q.dh + (p.hmd === "amaburst" ? 1 : 0) + p.sessMod + (calm ? 0 : p.pend) + tk;
}
/** 主役の帯のどこか（効果をかける前の、カードに印刷された帯） */
export function rawZone(f, h, scorchLine = f.s) {
  if (h >= scorchLine) return "scorch";
  if (f.j.includes(h)) return "just";
  if (h >= f.lo && h <= f.hi) return "band";
  if (h === f.lo - 1) return "offLo";
  if (h === f.hi + 1) return "offHi";
  return "cold";
}
export const scorchLineOf = (p) => { const f = FLAVOR[p.main]; return f ? f.s + (sidesOf(p).includes("mint") ? 1 : 0) : 99; };
/**
 * 判定熱 h での一口を採点する（状態は変えない）。fl={ blow, lastOfSession }
 * 返り値 { zone, pts, parts:[{label, n}], rich, usedLotus, usedSilicone, saved }
 */
export function scorePuff(p, h, q, fl = {}) {
  const f = FLAVOR[p.main];
  if (!f || !leavesOf(p)) return { zone: "cold", pts: 0, parts: [{ label: "燃え尽き", n: 0 }], rich: false };
  const sd = sidesOf(p), tot = leavesOf(p), kinds = Object.keys(p.bowl).filter((k) => p.bowl[k] > 0).length;
  let z = rawZone(f, h, scorchLineOf(p));
  let usedLotus = false, usedSilicone = false, saved = false;
  if (z === "scorch" && fl.blow) { z = "off"; saved = true; }
  if (z === "scorch" && p.bowlId === "silicone" && !p.usedSilicone) { z = "off"; usedSilicone = true; saved = true; }
  if (z === "offLo" && (sd.includes("peach") || (p.person === "tsumugi" && f.kind === "floral"))) z = "band";
  if (z === "offHi" && (sd.includes("cool_mint") || hasTool(p, "ice_hose"))) z = "band";
  if ((z === "offLo" || z === "offHi") && p.hmd === "lotus" && !p.usedLotus) { z = "band"; usedLotus = true; }
  if (z === "offLo" || z === "offHi") z = "off";
  const ng = f.id === "vanilla" ? sd.includes("mint") : f.id === "mint" && sd.includes("vanilla");
  const mix = sd.length && !ng ? 1 : 0;
  const pair = mix && (sd.some((k) => FLAVOR[k].kind === f.pair) || sd.includes("spring_water")) ? 1 : 0;
  const rich = (p.bowlId === "clay" && kinds > 1) ? false : tot >= (sd.includes("black_tea") ? 8 : RULES.rich);
  const parts = [];
  const add = (label, n) => { if (n) parts.push({ label, n }); };
  if (z === "just" || z === "band") {
    add("味値", f.t);
    if (z === "just") add("ジャスト", 2);
    add("ミックス", mix); add("相性", pair); add("濃厚", rich ? 1 : 0);
    if (kinds === 1 && p.bowlId === "clay") add("素焼きハガル", 1);
    if (kinds === 1 && p.person === "adam") add("アダム", 1);
    if (sd.length >= 2 && p.person === "mashiro") add("ましろ", 1);
    if (fl.lastOfSession && p.bowl.jasmine >= 2) add("ジャスミン", 1);
    if (z === "just") { add(q.style, q.just || 0); if (p.person === "naru" && f.kind === "sweet") add("なる", 1); }
    else add(q.style, q.band || 0);
  } else if (z === "off") {
    add("ズレ", saved ? 1 : (q.offZero ? 0 : 1));
    if (!saved && hasTool(p, "diffuser")) { add("ミックス", mix); add("相性", pair); }
  }
  return { zone: z, pts: parts.reduce((a, x) => a + x.n, 0), parts, rich, usedLotus, usedSilicone, saved };
}

// ───────── 対戦のはじまり ─────────
function newPlayer(G, i, pc) {
  const kit = pc.kit ? KIT[pc.kit] : null;
  const p = {
    index: i, name: pc.name || (i === 0 ? "あなた" : "相手"), ai: pc.ai || null, level: pc.level ?? 1, kit: kit ? kit.id : null,
    bowlId: pc.bowl || kit.bowl, hmd: pc.hmd || kit.hmd, plan: pc.plan || (kit ? kit.plan : []),
    deck: shuffle(G, expandDeck(pc.cards || kit.cards)), hand: [], ash: [], zone: [], stove: [],
    bowl: {}, main: null, tools: [], person: null, wind: 0,
    score: 0, votes: 0, justCount: 0, scorchCount: 0, s1: null, lastPuff: 0,
    spent: 0, pend: 0, sessMod: 0, noCool: false, keepLeaves: false, usedSilicone: false, usedLotus: false, peek: null,
    steamed: false, packedOnce: false, turn: null, puff: null,
  };
  drawCards(G, p, RULES.startDraw);
  return p;
}
/**
 * cfg = { seed, tournament, market?, first?(0|1), players:[{ name, kit | (cards,bowl,hmd,plan), ai?, level? }, …] }
 */
export function createGame(cfg) {
  const tour = TOURNAMENT[cfg.tournament] || TOURNAMENT.practice;
  const G = { seed: (cfg.seed ?? 1) >>> 0 || 1, tour, cfg, phase: "embers", round: 0, prepTurn: 0, lead: 0, active: 0,
    pile: [], shown: [], judge: null, supply: {}, market: [], P: [], wait: null, stack: [], log: [], events: [], over: false, result: null,
    forceSecond: null, serveStep: 0 };
  const market = (cfg.market && cfg.market.length ? cfg.market : FIRST_MARKET).slice(0, 10);
  if (tour.task && !market.includes(tour.task)) market[market.length - 1] = tour.task;
  G.market = market;
  for (const id of market) G.supply[id] = RULES.pile;
  G.pile = buildPile(G);
  G.P = cfg.players.map((pc, i) => newPlayer(G, i, pc));
  G.lead = cfg.first === 0 || cfg.first === 1 ? cfg.first : (nextRand(G) < 0.5 ? 0 : 1);
  if (tour.task) for (const p of G.P) { p.bowl[tour.task] = 3; fixMain(p); }
  say(G, `${tour.name}。先手は${G.P[G.lead].name}。`);
  G.wait = { type: "embers", player: G.lead };
  return G;
}
function buildPile(G) {
  if (!G.tour.judges.length) return [];
  const pile = G.tour.judges.flatMap((jid) => JUDGE[jid].puffs.flatMap(([pid, n]) => Array.from({ length: n }, () => ({ ...PUFFS[pid], judge: jid }))));
  return shuffle(G, pile);
}

// ───────── 小さな部品 ─────────
function say(G, text, who = null) { G.log.push({ text, who, round: G.round, phase: G.phase }); }
function emit(G, ev) { G.events.push(ev); }
function drawCards(G, p, n) {
  let got = 0;
  for (let i = 0; i < n; i++) {
    if (!p.deck.length) { if (!p.ash.length) break; p.deck = shuffle(G, p.ash.splice(0)); }
    p.hand.push(p.deck.pop()); got++;
  }
  if (got) emit(G, { t: "draw", p: p.index, n: got });
  return got;
}
function discard(p, handIdx) { p.ash.push(p.hand.splice(handIdx, 1)[0]); }
/** 炭を1つ、1段階弱める。横向き（使った火力）の炭から先に消えたものとして扱う */
function weaken(G, p, zi) {
  const c = p.zone[zi];
  if (c.up) { const before = coalHeat(c); c.up = false; p.spent = Math.max(0, p.spent - (before - 1)); emit(G, { t: "flip", p: p.index, id: c.id }); }
  else { p.zone.splice(zi, 1); p.ash.push(c.id); p.spent = Math.max(0, p.spent - 1); emit(G, { t: "ash", p: p.index }); }
}
function burn(G, p, n) { // 燃焼: 種火 → フラット → キューブ の順に灰にする
  for (let k = 0; k < n; k++) {
    let i = p.zone.findIndex((c) => !c.up);
    if (i < 0) i = p.zone.findIndex((c) => CARD[c.id].heat === 1);
    if (i < 0) i = 0;
    const c = p.zone.splice(i, 1)[0]; p.spent = Math.max(0, p.spent - coalHeat(c)); p.ash.push(c.id);
  }
}
function stoveAdvance(G, p) {
  let fired = false;
  for (const c of p.stove) if (c.stage < 2) { c.stage++; if (c.stage === 2) fired = true; }
  if (fired) { emit(G, { t: "fired", p: p.index }); if (hasTool(p, "timer")) { drawCards(G, p, 1); say(G, "キッチンタイマー：炭が焼けたので1枚引く。", p.index); } }
  if (hasTool(p, "chacosta") && p.stove.length >= 3) { drawCards(G, p, 1); say(G, "チャコスタ：炭焼き場に炭が3つあるので1枚引く。", p.index); }
}
const other = (G, p) => G.P[1 - p.index];
const fail = (reason) => ({ ok: false, reason });
const OK = Object.freeze({ ok: true });

// ───────── できること（画面のボタンとCPUの手えらびに使う） ─────────
/** いまの G.wait で、その手札を「使う」ことができるか。できないときは理由つき */
export function canPlay(G, p, id) {
  const c = CARD[id], w = G.wait;
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (c.type === "coal") return fail("炭カードは炭焼き場に置く");
  if (id === "repack") return fail("このカードはまだ使えない");
  const inPrep = w.type === "prep", inMain = w.type === "main", inReact = w.type === "react";
  if (c.when === "puff") { if (!inReact) return fail("審査カードをめくったあとに使う"); }
  else if (c.when === "prep") { if (!inPrep) return fail("準備フェイズに使う"); }
  else if (c.when === "turn") { if (!inMain) return fail("提供フェイズの自分のターンに使う"); }
  else if (!(inPrep || inMain)) return fail("自分のターンに使う");
  if (c.burn) { if (p.zone.length < c.burn) return fail(`炭が${c.burn}枚要る`); }
  else if (firepower(p) < (c.cost || 0)) return fail(`火力が足りない（${c.cost}必要）`);
  if (c.type === "tool" && p.tools.includes(id)) return fail("同じ器具はもう出ている");
  if (id === "add_coal" && heatOf(p) >= RULES.heatMax) return fail("熱は10まで");
  if (id === "tongs" && !p.zone.some((x) => !x.up)) return fail("種火がない");
  if (id === "fan" && !p.stove.some((x) => x.stage < 2)) return fail("火おこし中の炭がない");
  if (id === "encore" && !isLastSession(G)) return fail("最終セッションだけ");
  if (id === "buyout" && (p.steamed || p.turn?.mode)) return fail("詰める前に使う");
  if (id === "draft" && !other(G, p).zone.length) return fail("相手に炭がない");
  if (id === "read" && (!G.pile.length || p.peek)) return fail(G.pile.length ? "もう見ている" : "審査カードがない");
  if (id === "go_second" && G.round >= roundsOf(G) - 1) return fail("次のラウンドがない");
  if ((id === "inner" || id === "outer" || id === "loosen") && false) return OK;
  return OK;
}
export function canCharge(G, p) {
  const w = G.wait;
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (w.type === "prep") { if (p.turn.mode !== "steam") return fail("蒸らすターンだけ"); }
  else if (w.type !== "main") return fail("自分のターンに行う");
  if (p.turn.charged) return fail("チャージは1ターンに1回");
  if (heatOf(p) >= RULES.heatMax) return fail("熱は10まで");
  if (!p.hand.length) return fail("手札がない");
  return OK;
}
export function canPlace(G, p, id) {
  const w = G.wait;
  if (CARD[id].type !== "coal") return fail("炭カードではない");
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (w.type === "prep") { if (p.turn.mode !== "steam") return fail("蒸らすターンだけ"); }
  else if (w.type !== "main") return fail("自分のターンに行う");
  if (p.stove.length >= slotsOf(p)) return fail("炭焼き場がいっぱい");
  return OK;
}
export function canPutOn(G, p, si) {
  const w = G.wait, c = p.stove[si];
  if (!c) return fail("炭がない");
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (w.type === "prep") { if (p.turn.mode !== "steam") return fail("蒸らすターンだけ"); }
  else if (w.type !== "main") return fail("自分のターンに行う");
  if (c.stage < 2) return fail("まだ焼けていない");
  if (heatOf(p) + CARD[c.id].heat > RULES.heatMax) return fail("熱は10まで");
  return OK;
}
export function canAsh(G, p) {
  const w = G.wait;
  if (!w || w.player !== p.index || w.type !== "main") return fail("提供フェイズの自分のターンに行う");
  if (!p.zone.length) return fail("炭がない");
  return OK;
}
/** 準備の「詰める」で、このターンに取れる枚数 */
export function packLimit(G, p) {
  let n = RULES.packN + (p.bowlId === "beat80" ? 1 : 0) + (p.turn?.buyout ? 2 : 0);
  if (!p.packedOnce && p.index === G.prepFirst) n -= RULES.firstPackCut;
  return Math.max(0, Math.min(n, BOWL[p.bowlId].cap - leavesOf(p)));
}
export function canPack(G, p) {
  const w = G.wait;
  if (!w || w.type !== "prep" || w.player !== p.index) return fail("準備フェイズの自分のターンに行う");
  if (p.turn.mode) return fail("このターンはもう選んだ");
  if (p.steamed) return fail("蒸らしたあとは詰められない");
  if (packLimit(G, p) <= 0) return fail("ボウルがいっぱい");
  if (!G.market.some((id) => G.supply[id] > 0)) return fail("場に葉がない");
  return OK;
}
export function canSteam(G, p) {
  const w = G.wait;
  if (!w || w.type !== "prep" || w.player !== p.index) return fail("準備フェイズの自分のターンに行う");
  if (p.turn.mode) return fail("このターンはもう選んだ");
  if (leavesOf(p) < RULES.steamLeaves && canPack(G, p).ok) return fail(`葉が${RULES.steamLeaves}枚以上要る`);
  return OK;
}

// ───────── 進行 ─────────
/**
 * 入力を1つ受けて進める。返り値 { ok } か { ok:false, reason }。
 * action.type: embers / pack / steam / charge / place / puton / ash / play / end / discard / cool / react / pass / wear / weaken
 */
export function act(G, a) {
  if (G.over) return fail("対戦は終わっている");
  const w = G.wait, p = G.P[w.player];
  if (a.player != null && a.player !== w.player) return fail("いまは相手の番");
  const r = HANDLERS[a.type] ? HANDLERS[a.type](G, p, a, w) : fail(`知らない入力: ${a.type}`);
  return r || OK;
}

const HANDLERS = {
  // 最初の火: 手札7枚から3枚を種火にする
  embers(G, p, a, w) {
    if (w.type !== "embers") return fail("いまは選べない");
    const picks = [...new Set(a.picks || [])];
    if (picks.length !== RULES.startEmbers || picks.some((i) => !(i >= 0 && i < p.hand.length))) return fail(`種火にする${RULES.startEmbers}枚を選ぶ`);
    for (const i of picks.sort((x, y) => y - x)) p.zone.push({ id: p.hand.splice(i, 1)[0], up: false });
    emit(G, { t: "embers", p: p.index });
    const o = other(G, p);
    if (!o.zone.length) { G.wait = { type: "embers", player: o.index }; return; }
    G.phase = "prep"; G.prepTurn = 0; G.prepFirst = G.lead;
    say(G, "準備フェイズ。葉を詰めて、蒸らす。");
    startPrepTurn(G);
  },

  pack(G, p, a, w) {
    const c = canPack(G, p); if (!c.ok) return c;
    const picks = Object.entries(a.picks || {}).filter(([, n]) => n > 0);
    const total = picks.reduce((s, [, n]) => s + n, 0);
    if (!total) return fail("葉を選ぶ");
    if (picks.length > 2) return fail("1ターンに取れるのは2種類まで");
    if (total > packLimit(G, p)) return fail(`このターンは${packLimit(G, p)}枚まで`);
    for (const [id, n] of picks) if (!G.market.includes(id) || (G.supply[id] || 0) < n) return fail("場に足りない葉がある");
    for (const [id, n] of picks) { p.bowl[id] = (p.bowl[id] || 0) + n; G.supply[id] -= n; }
    fixMain(p); p.turn.mode = "pack"; p.packedOnce = true;
    say(G, `詰める：${picks.map(([id, n]) => `${FLAVOR[id].name}${n}`).join("・")}（計${leavesOf(p)}g）`, p.index);
    emit(G, { t: "pack", p: p.index });
  },
  steam(G, p) {
    const c = canSteam(G, p); if (!c.ok) return c;
    p.turn.mode = "steam"; p.steamed = true; p.packedOnce = true;
    drawCards(G, p, RULES.steamDraw);
    say(G, "蒸らす：1枚引く。", p.index);
  },

  charge(G, p, a) {
    const c = canCharge(G, p); if (!c.ok) return c;
    if (!(a.hand >= 0 && a.hand < p.hand.length)) return fail("手札を選ぶ");
    p.zone.push({ id: p.hand.splice(a.hand, 1)[0], up: false }); p.turn.charged = true;
    say(G, `チャージ：種火を1枚（熱${heatOf(p)}）`, p.index); emit(G, { t: "charge", p: p.index });
  },
  place(G, p, a) {
    const id = p.hand[a.hand]; if (!id) return fail("手札を選ぶ");
    const c = canPlace(G, p, id); if (!c.ok) return c;
    p.hand.splice(a.hand, 1);
    const early = p.person === "sumi" ? 1 : 0;
    p.stove.push({ id, stage: Math.min(2, 2 - CARD[id].ig + early) });
    say(G, `${CARD[id].name}を炭焼き場に置く。`, p.index); emit(G, { t: "place", p: p.index, id });
  },
  puton(G, p, a) {
    const c = canPutOn(G, p, a.stove); if (!c.ok) return c;
    const coal = p.stove.splice(a.stove, 1)[0];
    p.zone.push({ id: coal.id, up: true });
    say(G, `${CARD[coal.id].name}をのせる（熱${heatOf(p)}）`, p.index); emit(G, { t: "puton", p: p.index, id: coal.id });
    if (coal.id === "dense_flat") drawCards(G, p, 1);
  },
  ash(G, p, a) {
    const c = canAsh(G, p); if (!c.ok) return c;
    const coal = p.zone[a.zone]; if (!coal) return fail("炭を選ぶ");
    p.zone.splice(a.zone, 1); p.ash.push(coal.id); p.spent = Math.max(0, p.spent - coalHeat(coal));
    say(G, `炭を1枚灰にする（熱${heatOf(p)}）`, p.index); emit(G, { t: "ash", p: p.index });
    if (p.hmd === "tanukish" && !p.turn.ashDraw) { p.turn.ashDraw = true; drawCards(G, p, 1); say(G, "タヌキッシュリッド：炭を落としたので1枚引く。", p.index); }
  },

  play(G, p, a, w) {
    const id = p.hand[a.hand]; if (!id) return fail("手札を選ぶ");
    const c = canPlay(G, p, id); if (!c.ok) return c;
    const card = CARD[id];
    p.hand.splice(a.hand, 1);
    if (card.burn) burn(G, p, card.burn); else p.spent += card.cost || 0;
    emit(G, { t: "play", p: p.index, id });
    say(G, `${card.name}を使う。`, p.index);
    if (card.type === "tool") {
      if (p.tools.length >= RULES.toolMax) { const out = p.tools.shift(); p.ash.push(out); if (out === "windguard") p.wind = 0; }
      p.tools.push(id); if (id === "windguard") p.wind = 2;
      return;
    }
    if (card.type === "person") { if (p.person) p.ash.push(p.person); p.person = id; return; }
    p.ash.push(id);
    return EFFECTS[id] ? EFFECTS[id](G, p, w) : undefined;
  },

  cool(G, p, a, w) {
    if (w.type !== "cool") return fail("いまは冷めるところではない");
    if (a.wind) {
      if (p.wind <= 0) return fail("風防がない");
      if (--p.wind === 0) { p.tools.splice(p.tools.indexOf("windguard"), 1); p.ash.push("windguard"); }
      emit(G, { t: "wind", p: p.index });
    } else {
      if (!p.zone[a.zone]) return fail("弱める炭を選ぶ");
      weaken(G, p, a.zone);
    }
    w.left--;
    if (w.left > 0 && (p.zone.length || p.wind > 0)) return;
    afterCool(G, p);
  },

  end(G, p, a, w) {
    if (w.type !== "prep" && w.type !== "main") return fail("いまはターンを終えられない");
    if (w.type === "prep" && !p.turn.mode && (canPack(G, p).ok || canSteam(G, p).ok)) return fail("「詰める」か「蒸らす」を選ぶ");
    if (p.hand.length > RULES.handMax) { G.wait = { type: "discard", player: p.index, back: w.type }; return; }
    endTurn(G, p, w.type);
  },
  discard(G, p, a, w) {
    if (w.type !== "discard") return fail("いまは捨てるところではない");
    const need = p.hand.length - RULES.handMax, picks = [...new Set(a.picks || [])];
    if (picks.length !== need || picks.some((i) => !(i >= 0 && i < p.hand.length))) return fail(`${need}枚選んで灰にする`);
    for (const i of picks.sort((x, y) => y - x)) discard(p, i);
    endTurn(G, p, w.back);
  },

  // 審査: 一口の技。play で使い、pass でそのまま受ける
  pass(G, p, a, w) {
    if (w.type !== "react") return fail("いまは審査ではない");
    const o = other(G, p);
    if (!o.puff.done && w.player === G.order[0]) { p.puff.done = true; G.wait = { type: "react", player: o.index }; return; }
    p.puff.done = true;
    resolveJudge(G);
  },
  react(G, p, a, w) { return HANDLERS.play(G, p, a, w); },

  wear(G, p, a, w) {
    if (w.type !== "wear") return fail("いまは葉を減らすところではない");
    const picks = Object.entries(a.picks || {}).filter(([, n]) => n > 0);
    const total = picks.reduce((s, [, n]) => s + n, 0);
    if (total !== w.n) return fail(`葉を${w.n}枚選ぶ`);
    for (const [id, n] of picks) if ((p.bowl[id] || 0) < n) return fail("その葉は足りない");
    for (const [id, n] of picks) p.bowl[id] -= n;
    fixMain(p); emit(G, { t: "wear", p: p.index, n: total });
    say(G, `葉が${total}枚減る（残り${leavesOf(p)}g）`, p.index);
    nextWear(G);
  },

  // すきま風を受けた側が、弱める炭を選ぶ
  weaken(G, p, a, w) {
    if (w.type !== "weaken") return fail("いまは選べない");
    if (!p.zone[a.zone]) return fail("弱める炭を選ぶ");
    weaken(G, p, a.zone);
    G.wait = G.stack.pop();
  },
};

// カードごとの効果（使い切りのもの）。火力はもう払ってある
const EFFECTS = {
  heat_in(G, p) { p.puff.tk += 1; },
  heat_out(G, p) { p.puff.tk -= 1; },
  blow(G, p) { p.puff.blow = true; },
  show_smoke(G, p) { p.puff.show++; },
  all_in(G, p) { p.puff.allIn++; },
  duel(G, p) { p.puff.duel++; },
  encore(G, p) { p.puff.encore++; },
  read(G, p) { p.peek = G.pile[0]; emit(G, { t: "peek", p: p.index, puff: p.peek }); },
  ash_tap(G, p) { p.noCool = true; },
  add_coal(G, p) { if (!p.deck.length && p.ash.length) p.deck = shuffle(G, p.ash.splice(0)); if (p.deck.length) p.zone.push({ id: p.deck.pop(), up: false }); },
  tongs(G, p) { const i = p.zone.findIndex((c) => !c.up); p.ash.push(p.zone.splice(i, 1)[0].id); p.spent = Math.max(0, p.spent - 1); drawCards(G, p, 2); },
  fan(G, p) { for (const c of p.stove) if (c.stage < 2) c.stage++; },
  inner(G, p) { p.sessMod += 1; },
  outer(G, p) { p.sessMod -= 1; },
  loosen(G, p) { p.keepLeaves = true; },
  breath(G, p) { drawCards(G, p, 2); },
  reset(G, p) { drawCards(G, p, 3); },
  buyout(G, p) { p.turn.buyout = true; },
  hype(G, p) { const o = other(G, p); if (o.bowl.lavender >= 2) say(G, "ラベンダーの【鎮静】で効かない。", o.index); else o.pend += 1; },
  venue_heat(G, p) { for (const x of G.P) if (!(x.bowl.lavender >= 2)) x.pend += 1; },
  go_second(G, p) { G.forceSecond = p.index; },
  draft(G, p, w) {
    const o = other(G, p);
    if (hasTool(o, "windguard") || o.bowl.lavender >= 2) { say(G, "相手の炭は守られている。", o.index); return; }
    if (!o.zone.length) return;
    G.stack.push(w); G.wait = { type: "weaken", player: o.index, by: p.index };
  },
};

function startPrepTurn(G) {
  const order = [G.prepFirst, 1 - G.prepFirst], p = G.P[order[G.prepTurn % 2]];
  G.active = p.index; p.spent = 0; p.turn = { mode: null, charged: false, buyout: false };
  stoveAdvance(G, p);
  G.wait = { type: "prep", player: p.index, n: Math.floor(G.prepTurn / 2) + 1 };
}
function endTurn(G, p, kind) {
  p.turn = null;
  if (kind === "prep") {
    G.prepTurn++;
    if (G.prepTurn < RULES.prepTurns * 2) { startPrepTurn(G); return; }
    for (const x of G.P) fixMain(x);
    G.phase = "serve"; G.round = 0; G.serveStep = 0;
    say(G, "提供フェイズ。");
    startRound(G); return;
  }
  G.serveStep++;
  if (G.serveStep < 2) { startServeTurn(G); return; }
  startJudge(G);
}
function startRound(G) {
  G.order = [G.lead, 1 - G.lead]; G.serveStep = 0; G.judge = null;
  for (const p of G.P) p.puff = null;
  emit(G, { t: "round", round: G.round });
  startServeTurn(G);
}
function startServeTurn(G) {
  const p = G.P[G.order[G.serveStep]];
  G.active = p.index; p.spent = 0; p.turn = { mode: "serve", charged: false };
  stoveAdvance(G, p);
  const skipBig = p.hmd === "big_tanukish" && G.round % 3 === 0;
  if (p.noCool || skipBig || !p.zone.length) {
    if (p.noCool && p.zone.length) say(G, "灰落とし：このターンは冷めない。", p.index);
    else if (skipBig && p.zone.length) say(G, "ビッグタヌキッシュリッド：セッション最初のターンは冷めない。", p.index);
    p.noCool = false; afterCool(G, p); return;
  }
  G.wait = { type: "cool", player: p.index, left: coolStepsOf(p), steps: coolStepsOf(p) };
}
function afterCool(G, p) {
  drawCards(G, p, RULES.draw);
  G.wait = { type: "main", player: p.index };
}

function startJudge(G) {
  const q = G.pile.length ? G.pile.shift() : { ...PUFFS.normal, judge: null };
  G.judge = q; if (q.judge) G.shown.push(q);
  for (const p of G.P) { p.puff = { tk: 0, blow: false, show: 0, allIn: 0, duel: 0, encore: 0, done: false }; }
  emit(G, { t: "reveal", puff: q });
  say(G, `審査：${q.judge ? JUDGE[q.judge].name + "「" + q.style + "」" : q.style}。${q.tx}`);
  G.wait = { type: "react", player: G.order[0] };
}
/** いまの一口の見込み（審査カードが出たあと。技をかけたぶんまで） */
export function puffPreview(G, p, extra = {}) {
  const q = G.judge, pf = p.puff || { tk: 0, blow: false };
  const h = judgedHeat(p, q, pf.tk + (extra.tk || 0));
  return { h, ...scorePuff(p, h, q, { blow: pf.blow || extra.blow, lastOfSession: isLastOfSession(G) }) };
}
function resolveJudge(G) {
  const q = G.judge, res = [];
  for (const i of G.order) {
    const p = G.P[i], pf = p.puff, h = judgedHeat(p, q, pf.tk);
    const s = scorePuff(p, h, q, { blow: pf.blow, lastOfSession: isLastOfSession(G) });
    const parts = s.parts.slice();
    if (s.zone === "just" && pf.allIn) parts.push({ label: "渾身の一口", n: 3 * pf.allIn });
    if ((s.zone === "just" || s.zone === "band") && s.rich && pf.show) parts.push({ label: "見せ煙", n: 2 * pf.show });
    let pts = parts.reduce((a, x) => a + x.n, 0);
    if (pf.encore) { parts.push({ label: "アンコール", n: pts * pf.encore }); pts += pts * pf.encore; }
    if (s.usedSilicone) { p.usedSilicone = true; say(G, "シリコンボウル：焦げを取り消した。", i); }
    if (s.usedLotus) { p.usedLotus = true; say(G, "ロートスHMD：ズレを適温として採点。", i); }
    if (s.zone === "just") p.justCount++;
    let lost = null;
    if (s.zone === "scorch") {
      p.scorchCount++;
      const safe = p.person === "minto" && Object.keys(p.bowl).some((k) => FLAVOR[k].kind === "cool" && p.bowl[k] >= 2);
      if (!safe && p.main) { lost = p.main; p.bowl[p.main]--; fixMain(p); }
    }
    res[i] = { h, zone: s.zone, pts, parts, lost, rank: RANK[s.zone], duel: pf.duel };
  }
  // 一票: 帯の良い方
  const d = res[0].rank - res[1].rank; let voter = null;
  if (d !== 0) {
    voter = d > 0 ? 0 : 1; const w = G.P[voter];
    w.votes++; res[voter].vote = RULES.vote + 3 * res[voter].duel;
    if (w.person === "packy") { drawCards(G, w, 1); }
  }
  for (const i of [0, 1]) {
    const p = G.P[i], r = res[i];
    p.score += r.pts + (r.vote || 0); p.lastPuff = r.pts; p.pend = 0; p.peek = null;
    say(G, `判定熱${r.h}・${ZONE_LABEL[r.zone]} → ${r.pts}点${r.vote ? `＋一票${r.vote}点` : ""}${r.lost ? `（${FLAVOR[r.lost].name}を1枚失う）` : ""}`, i);
  }
  G.lastResult = { round: G.round, puff: q, res, voter };
  emit(G, { t: "score", round: G.round, res, voter, puff: q });
  // 次のラウンドの先手: 毎ラウンド交代。「後の先」があればそれに従う
  G.lead = 1 - G.lead;
  if (G.forceSecond != null) { G.lead = 1 - G.forceSecond; G.forceSecond = null; }
  const endOfSession = isLastOfSession(G), last = G.round === roundsOf(G) - 1;
  if (G.round === 2) for (const p of G.P) p.s1 = p.score;
  if (endOfSession) {
    for (const p of G.P) { p.sessMod = 0; p.usedLotus = false; }
    if (!last) { G.wearQueue = [G.order[0], G.order[1]]; nextWear(G); return; }
  }
  if (last) { finish(G); return; }
  G.round++; startRound(G);
}
function nextWear(G) {
  while (G.wearQueue.length) {
    const p = G.P[G.wearQueue.shift()];
    const n = Math.min(leavesOf(p), p.keepLeaves ? 0 : (p.bowlId === "funnel" ? 1 : RULES.wear));
    if (p.keepLeaves) say(G, "葉をほぐす：このセッションは葉が減らない。", p.index);
    p.keepLeaves = false;
    if (n > 0) { G.wait = { type: "wear", player: p.index, n }; return; }
  }
  G.round++; say(G, `セッション${sessionOf(G) + 1}。`); startRound(G);
}
function finish(G) {
  const bonus = [];
  const give = (jid, key, n, tie) => {
    const a = key(G.P[0]), b = key(G.P[1]);
    const got = a > b ? [n, 0] : b > a ? [0, n] : [tie, tie];
    bonus.push({ judge: jid, pts: got }); G.P[0].score += got[0]; G.P[1].score += got[1];
  };
  for (const jid of G.tour.judges) {
    if (jid === "kamizono") give(jid, (p) => p.s1 ?? 0, 4, 2);
    if (jid === "hakase") { give(jid, (p) => -p.scorchCount, 4, 2); const extra = G.P.map((p) => (p.scorchCount ? 0 : 2)); bonus.push({ judge: jid, pts: extra, note: "焦げ0回" }); G.P[0].score += extra[0]; G.P[1].score += extra[1]; }
    if (jid === "sensu") give(jid, (p) => p.lastPuff, 5, 2);
    if (jid === "emir") give(jid, (p) => leavesOf(p), 4, 2);
    if (jid === "taiyo") give(jid, (p) => p.justCount, 4, 2);
  }
  const [a, b] = G.P;
  let winner = a.score > b.score ? 0 : b.score > a.score ? 1 : null;
  if (winner === null) { const la = leavesOf(a), lb = leavesOf(b); winner = la > lb ? 0 : lb > la ? 1 : a.hand.length > b.hand.length ? 0 : b.hand.length > a.hand.length ? 1 : null; }
  G.over = true; G.phase = "end"; G.wait = null;
  G.result = { winner, scores: [a.score, b.score], votes: [a.votes, b.votes], bonus };
  emit(G, { t: "end", result: G.result });
  say(G, winner === null ? "引き分け。" : `${G.P[winner].name}の勝ち（${a.score} 対 ${b.score}）。`);
}

/** その場に出ていない葉を足して10種の場を作る（指定の葉は必ず入れる） */
export function randomMarket(seed, must = []) {
  const G = { seed: (seed >>> 0) || 1 };
  const rest = shuffle(G, FLAVORS.map((f) => f.id).filter((id) => !must.includes(id)));
  return [...must, ...rest].slice(0, 10);
}
