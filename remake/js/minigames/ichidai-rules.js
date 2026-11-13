// カードゲーム「一台勝負」の規則（第0.7版）。DOM・保存・音に触れない純粋な状態機械。
// 第0.7版（2026-11-13 オーナー「ゲーム全体をもう少しシンプルにしたい。カードやデッキによって難しい戦略も取れるに寄せたい。
// ただしシーシャ作り体験は守りつつ」）: 基本の決まりを減らし、深さはカードとデッキ（一式）へ寄せる。
//   ・炭は、1ターンに1つ足せて（焼けた炭をのせる か チャージ＆ドロー）、1つ外せる。炭カードを炭焼き場に置くのは何枚でも。
//     第0.6版までは「チャージ1回・のせるは何回でも・外す1回」。回数の決まりを「足す1・外す1・カード1」にそろえた。
//   ・準備: 「先手の最初の詰めるは2枚まで」と「1ターンに2種類まで」をやめ、場の山を1種16枚にした（同じ一式どうしでも取り合いで決まらない）。
//   ・言葉: 「火力」は「熱」に、炭を「灰にする」は「外す」に、「1ラウンドに1枚」は「自分のターンに1枚」にそろえた（数は同じ）。
//   ・一票の比べ方（印象）は変えていない（点で比べる・味値で比べる案は、一式の釣り合いが崩れた）。
//   計りと理由は docs/design/card_game/v0.3_design.md の「9. 第0.7版」。
// 第0.6版の先行分（2026-11-13 オーナー。改変案「ICHIDAI-REDESIGN」のパターン1。先行逃げ切りを和らげる）:
//   ・一票の点は立場で変わる。審査の前の合計点で負けている人が取れば3点（勝っている人・並んでいる人は今までどおり2点。1-B）。
//     改変案は「勝っている人は1点」だったが、CPU同士で計ると腕の差が縮みすぎたので、オーナーが3点／2点を選んだ（ICG59）。
//   ・上園の決め手は「伸びしろ」: 最後のセッションの点が、第1セッションの点よりいちばん伸びた人に+4（1-D。第1セッション首位への加点をやめる）。
//   ・パッキー【実況】は、相手が一票を取るたびに1枚引く（自分が取ったときではない）。
//   計りと理由は docs/design/card_game/v0.3_design.md の「8. 第0.6版（先行分）」。
// 第0.5版（2026-11-11 オーナー「初心者でも遊べるか・上級者でも深さがあるか・シーシャ作りの再現度」の見立てを受けて「それら全てお願い」）:
//   ・冷めるのは1ターンに炭1つ・火1だけ（第0.4版は2つ）。炭を替える忙しさを実際のシーシャに寄せ、炭を保てない人が0点になるのを和らげる。
//   ・審査カードは、ラウンドのはじめにめくる（全員が見てから、その吸い方に熱を合わせる）。運だった「吸い方」を、合わせる腕の勝負にする。
//     「吸い方を読む」は、次のラウンドの審査カードを自分だけ先に見るカードになる（山のいちばん上＝次のラウンドの分）。
//   ・ダブルアップルのジャストは熱7の1つだけ（どこでもジャストだと、温度を合わせる勝負が無くなる）。
//   計りと理由は docs/design/card_game/v0.3_design.md の「7. 第0.5版」。
// 第0.4版（2026-11-11 オーナー指示）: 火力ゾーン＝HMDの上の炭。炭そのものに「火」がある（新品のフラット炭は2・キューブ炭は3・
// 手札を裏向きで置いた種火は1）。熱（10段階）＝置いてある炭の火の合計で、炭の数ではない。炭の火は下がるだけ（回復しない。
// 冷めにくくはできる）。上げたければ新しい炭に入れ替える。炭は4つまで（5つ目は置けない）。冷めるときは、炭を2つ選んで
// 火を1ずつ下げる（同じ炭は1ターンに1段階まで。炭が1つなら1段階だけ）。火が0になった炭は灰になる。
// 第0.3版（2026-11-11 オーナー指示）: カードは火力を払わず「火力がN以上なら使える」（必要火力）。カードは1ラウンドに1枚
// （準備は1ターンに1枚）。一口のカードは提供の自分のターンに、そのラウンドの一口へ仕込む。チャージと、炭を置く・のせるは
// 何回でも（カードの1枚に数えない）。灰にするのは1ターンに1回。一票は「印象」（味値＋帯＋濃厚＋カード）の高い方に入る。
// 設計の理由と比べた結果は docs/design/card_game/v0.3_design.md。
// 使い方: const G = createGame(cfg); → G.wait が「だれの、どの入力を待っているか」。act(G, action) で進める。
// 画面（ichidai.js）もCPU（ichidai-ai.js）もテストも、この act だけで対戦を進める。
// 規則の文は docs/design/card_game/ichidai_shobu_rulebook_v0.7.pdf。
// 人数は2〜4人（2026-11-11 オーナー「1:1もあるし1:1:1:1の4人のやつとかもある」「5もいる」）。席は index の順に時計回りで、
// 先手から順に1人ずつ手番を回す。一票は印象がいちばん高い1人に入る（いちばん上が並んだら入らない）。相手を1人ねらうカード
// （実況の煽り・すきま風）は、action.target で相手を選ぶ（選ばなければ、点がいちばん高い相手）。
import { FLAVOR, FLAVORS, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENT, KIT, FIRST_MARKET, expandDeck } from "./ichidai-data.js";

export const RULES = Object.freeze({
  startDraw: 7, startEmbers: 3, startEmbersMin: 1, startEmbersMax: 4, coalMax: 4, prepTurns: 6, packN: 4, packKinds: 4, firstPackCut: 0, steamDraw: 2, steamLeaves: 8,
  // ドロー（2026-11-11 オーナー「チャージ＆ドローに加えて普通のドローもしたい。チャージ＆ドローはドローだけは無理だけど、
  // チャージしないなら普通に1ドロー」「ターン1。バディファイトと同じ。引かないと置けない」）: 自分のターンに1枚引く（普通のドロー）。
  // チャージは「チャージ＆ドロー」で、手札を1枚裏向きで置いて1枚引く。1ターンに1回。置かずに引くことも、引かずに置くこともできない。
  // 引く枚数が減るぶん、準備の「蒸らす」で引くのを2枚にして手札の量を保つ（steamDraw。計算は docs/design/card_game/v0.3_design.md）
  draw: 1, chargeDraw: 1, cool: 1, slots: 4, heatMax: 10, handMax: 7, pile: 16, wear: 2, rich: 10, toolMax: 3,
  // 一票の点（第0.6版の先行分・1-B）: 審査の前の合計点で、負けている人が取れば voteBehind・勝っている人が取れば voteAhead・
  // 並んでいれば vote。3人・4人では「自分以外でいちばん点の高い人」と比べる（その人より低ければ負けている）
  vote: 2, voteBehind: 3, voteAhead: 2,
  // カードは、熱が「必要な熱」以上なら使える（払わない）。使えるのは自分のターンに1枚（cardsPerRound。1人のターンは1ラウンドに1回）。
  // 炭を外すのは1ターンに1つ（ashPerTurn）。決めた理由は docs/design/card_game/v0.3_design.md
  cardsPerRound: 1, chargePerTurn: 1, ashPerTurn: 1,
  // 炭を足す手（焼けた炭をのせる・チャージ＆ドロー）を、合わせて1ターンに何回まで許すか（第0.7版で 1）。
  // 外すのは ashPerTurn。つまり「炭は1ターンに、1つ足せて、1つ外せる」。カードの効果（追い炭）は数えない
  coalAdds: 1,
  // 入門の一局のための切り替え（ichidai-data.js の INTRO.rules）。ふだんはどれも既定のまま
  //   useVote=一票を入れるか／useBonus=審査員の決め手を入れるか／prepack=一台を一式の配合で詰めてから始める（準備は蒸らすターンだけ）／
  //   autoEmbers=最初の種火を山札の上から自動で置く数（0なら、手札から自分で選ぶ）
  useVote: true, useBonus: true, prepack: false, autoEmbers: 0,
  // 一口のカード: false＝提供の自分のターンに仕込む（第0.3版）。true＝審査カードをめくったあとに使う（第0.2版の受け方）
  reactAfterReveal: false,
  // 審査カードをめくる時: true＝ラウンドのはじめ（第0.5版。全員が見てから熱を合わせる）。false＝全員のターンのあと（第0.4版まで）
  revealFirst: true,
  // 一票の比べ方（試作）: "impress"＝印象（味値＋帯の分＋濃厚＋カード）／"points"＝その一口の点＋カードの印象／
  // "taste"＝味値＋カードの印象（適温かジャストでなければ一票は取れない）
  voteBy: "impress",
  // 印象＝味値＋帯の分＋濃厚＋カード。ジャストも適温も同じにして、印象は味の強さで競う
  impress: Object.freeze({ just: 1, band: 1, off: -1, cold: -2, scorch: -3 }),
});
/** 帯の順位（高いほど良い） */
export const RANK = Object.freeze({ just: 4, band: 3, off: 2, cold: 1, scorch: 0 });
export const ZONE_LABEL = Object.freeze({ just: "ジャスト", band: "適温", off: "ズレ", cold: "外れ", scorch: "焦げ" });

// ───────── 乱数（種つき。同じ種なら同じ対戦になる） ─────────
function nextRand(G) { G.seed = (Math.imul(G.seed, 1664525) + 1013904223) >>> 0; return G.seed / 4294967296; }
function shuffle(G, a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(nextRand(G) * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ───────── 読み取り ─────────
export const heatOf = (p) => p.zone.reduce((a, c) => a + coalHeat(c), 0);
/** 炭1つの火（＝その炭が出している熱）。表向きの炭カードは新品の火から下がっていく。裏向き（種火）は1 */
export const coalHeat = (c) => c.f ?? (c.up ? CARD[c.id].heat : 1);
/** 火力ゾーンに置く炭をつくる。up＝表向きの炭カード（新品の火）／裏向き＝種火（火1） */
const newCoal = (id, up) => ({ id, up, f: up ? CARD[id].heat : 1 });
/** 炭の枠が空いているか（HMDに載る炭は4つまで） */
/** 置ける炭の数。ふつうは4つ。C1（炭1個で回す低温用のHMD）は2つ */
export const coalMaxOf = (p) => (p.hmd === "one_coal" ? 2 : RULES.coalMax);
export const coalRoom = (p) => Math.max(0, coalMaxOf(p) - p.zone.length);
export const leavesOf = (p) => Object.values(p.bowl).reduce((a, b) => a + b, 0);
/** 火力＝熱（第0.3版はカードで火力を払わないので、使った分は無い） */
export const firepower = (p) => heatOf(p);
export const sidesOf = (p) => Object.keys(p.bowl).filter((k) => k !== p.main && p.bowl[k] >= 2);
export const hasTool = (p, id) => p.tools.includes(id) || p.person === id;
/** 炭焼き場の枠。だれでも4つで、カードでは増えない（2026-11-11 オーナー指示） */
export const slotsOf = () => RULES.slots;
/** このターンの冷める段階。炭を1つ選んで火を1下げる（第0.5版。RULES.cool を増やすと、その数だけ別の炭を1ずつ下げる） */
export const coolStepsOf = (p) => Math.min(RULES.cool, Math.max(1, p.zone.length));
export const roundsOf = (G) => G.tour.sessions * 3;
export const sessionOf = (G) => Math.floor(G.round / 3);
export const isLastSession = (G) => G.round >= roundsOf(G) - 3;
export const isLastOfSession = (G) => G.round % 3 === 2;
/**
 * p が一票を取ったときの点（勝負の一服の+3は別）。審査の前の合計点で比べる: 相手のいちばん高い点より低ければ voteBehind（3）、
 * 高ければ voteAhead（2）、同じなら vote（2）。審査が終わるまで点は動かないので、ターンのあいだずっと同じ値になる
 */
export function votePtsOf(G, p) {
  const top = Math.max(...G.P.filter((o) => o.index !== p.index).map((o) => o.score)); // p は写し（CPUの見込み）でもよい
  return p.score < top ? G.R.voteBehind : p.score > top ? G.R.voteAhead : G.R.vote;
}
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
/** 一口の印象。s=scorePuff の結果、extra=カードの印象。葉が無ければ0 */
export function impressionOf(p, s, extra = 0, table = RULES.impress) {
  const f = FLAVOR[p.main];
  if (!f || !leavesOf(p)) return 0;
  return f.t + table[s.zone] + (s.rich ? 1 : 0) + extra;
}
/** 一票を比べる数。s=scorePuff の結果、pts=その一口の点（カードの加点も入れた合計）、extra=カードの印象 */
export function voteScore(G, p, s, pts, extra = 0) {
  if (!FLAVOR[p.main] || !leavesOf(p)) return 0;
  if (G.R.voteBy === "points") return pts + extra;
  if (G.R.voteBy === "taste") return s.zone === "just" || s.zone === "band" ? FLAVOR[p.main].t + extra : NO_VOTE;
  return impressionOf(p, s, extra, G.R.impress);
}
const NO_VOTE = -99;
export function scorePuff(p, h, q, fl = {}) {
  const f = FLAVOR[p.main];
  if (!f || !leavesOf(p)) return { zone: "cold", pts: 0, parts: [{ label: "燃え尽き", n: 0 }], rich: false };
  const sd = sidesOf(p), tot = leavesOf(p), kinds = Object.keys(p.bowl).filter((k) => p.bowl[k] > 0).length;
  let z = rawZone(f, h, scorchLineOf(p));
  let usedLotus = false, usedSilicone = false, saved = false;
  if (z === "scorch" && fl.blow) { z = "band"; saved = true; } // ブロー: 焦げライン以上なら適温として採点
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
    if (kinds === 1 && f.id === "double_apple") add("原点", 1); // ダブルアップル【原点】: 単品なら毎口+1
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
    score: 0, votes: 0, justCount: 0, scorchCount: 0, sessPts: [], sessStart: 0, lastPuff: 0,
    cardsUsed: 0, pend: 0, sessMod: 0, sessImp: 0, noCool: false, keepLeaves: false, usedSilicone: false, usedLotus: false, peek: null,
    steamed: false, packedOnce: false, turn: null, puff: null,
  };
  drawCards(G, p, G.R.startDraw);
  return p;
}
/**
 * cfg = { seed, tournament, market?, first?(0|1), players:[{ name, kit | (cards,bowl,hmd,plan), ai?, level? }, …] }
 */
export function createGame(cfg) {
  const tour = TOURNAMENT[cfg.tournament] || TOURNAMENT.practice;
  const G = { seed: (cfg.seed ?? 1) >>> 0 || 1, tour, cfg, R: Object.freeze({ ...RULES, ...(cfg.rules || {}) }), phase: "embers", round: 0, prepTurn: 0, lead: 0, active: 0,
    pile: [], shown: [], judge: null, supply: {}, market: [], P: [], wait: null, stack: [], log: [], events: [], over: false, result: null,
    forceSecond: null, serveStep: 0 };
  const market = (cfg.market && cfg.market.length ? cfg.market : FIRST_MARKET).slice(0, 10);
  // 場に必ず入れる葉: 課題の葉と、一式のおすすめの配合の葉（基本の一式の葉は「はじめての場」に無いことがある）。
  // 場のうしろから、必ず入れる葉でないものと入れ替える
  const must = [...new Set([tour.task, ...cfg.players.flatMap((pc) => (pc.plan || KIT[pc.kit]?.plan || []).map(([id]) => id))].filter((id) => id && FLAVOR[id]))];
  for (const id of must) {
    if (market.includes(id)) continue;
    let at = market.length - 1; while (at >= 0 && must.includes(market[at])) at--;
    if (at >= 0) market[at] = id;
  }
  G.market = market;
  // 場の葉の山は、2人で1種12枚。3人・4人では1人6枚ぶんずつ増やす（取り合いの厳しさを2人のときと同じにする）
  for (const id of market) G.supply[id] = pileOf(G, cfg.players.length);
  G.pile = buildPile(G);
  G.P = cfg.players.map((pc, i) => newPlayer(G, i, pc));
  const n = G.P.length;
  G.lead = Number.isInteger(cfg.first) && cfg.first >= 0 && cfg.first < n ? cfg.first : Math.floor(nextRand(G) * n);
  if (tour.task) for (const p of G.P) { p.bowl[tour.task] = 3; fixMain(p); }
  say(G, `${tour.name}。先手は${G.P[G.lead].name}。`);
  if (G.R.prepack) for (const p of G.P) { // 入門: 一式の配合で詰めてある（場からは取らない）。準備は蒸らすターンだけ
    for (const [id, k] of p.plan) { const take = Math.min(k, BOWL[p.bowlId].cap - leavesOf(p)); if (take > 0) p.bowl[id] = (p.bowl[id] || 0) + take; }
    fixMain(p); p.steamed = true; p.packedOnce = true;
  }
  if (G.R.autoEmbers > 0) { // 入門: 最初の種火は、山札の上から置いてある（手札は減らない）
    for (const p of G.P) for (let k = Math.min(G.R.autoEmbers, coalMaxOf(p)); k > 0 && p.deck.length; k--) p.zone.push(newCoal(p.deck.pop(), false));
    G.phase = "prep"; G.prepTurn = 0; G.prepFirst = G.lead;
    say(G, "準備フェイズ。炭を焼いて、熱を上げる。");
    startPrepTurn(G);
    return G;
  }
  G.wait = { type: "embers", player: G.lead };
  return G;
}
/** 場の葉の山1つの枚数（2人で12枚。3人なら18枚、4人なら24枚） */
export const pileOf = (G, n = G.P.length) => Math.max(G.R.pile, Math.round(G.R.pile / 2) * n);
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
/** 炭を1つ、1段階弱める（火を1下げる。0になったら灰） */
function weaken(G, p, zi, why = "cool") {
  const c = p.zone[zi];
  c.f = coalHeat(c) - 1;
  // zi＝その炭の位置（この出来事の直前の並びで）、up＝炭カードか種火か、why＝冷めた（cool）／すきま風（draft）
  if (c.f > 0) emit(G, { t: "flip", p: p.index, id: c.id, f: c.f, zi, up: c.up, why });
  else { p.zone.splice(zi, 1); p.ash.push(c.id); emit(G, { t: "ash", p: p.index, zi, up: c.up, id: c.id, why }); }
}
/** 火力を n 落とす（カードを発動するために落とす分）。火力がちょうど n 下がる:
 *  火のいちばん小さい炭（同じなら種火）から、火を1ずつ下げる。0になった炭は灰になる */
function dropFire(G, p, n) {
  for (let k = 0; k < n && p.zone.length; k++) {
    let i = 0;
    p.zone.forEach((c, j) => { const a = coalHeat(c), b = coalHeat(p.zone[i]); if (a < b || (a === b && !c.up && p.zone[i].up)) i = j; });
    const c = p.zone[i];
    c.f = coalHeat(c) - 1;
    if (c.f <= 0) { p.ash.push(p.zone.splice(i, 1)[0].id); emit(G, { t: "ash", p: p.index, zi: i, up: c.up, id: c.id, why: "pay" }); }
    else emit(G, { t: "flip", p: p.index, id: c.id, f: c.f, zi: i, up: c.up, why: "pay" });
  }
}
function stoveAdvance(G, p) {
  let fired = false;
  for (const c of p.stove) if (c.stage < 2) { c.stage++; if (c.stage === 2) fired = true; }
  if (fired) { emit(G, { t: "fired", p: p.index }); if (hasTool(p, "timer")) { drawCards(G, p, 1); say(G, "キッチンタイマー：炭が焼けたので1枚引く。", p.index); } }
  if (hasTool(p, "chacosta") && p.stove.length >= 3) { drawCards(G, p, 1); say(G, "チャコスタ：炭焼き場に炭が3つあるので1枚引く。", p.index); }
}
/** 相手たち（自分の次の席から、手番の回る順に） */
export const rivalsOf = (G, p) => Array.from({ length: G.P.length - 1 }, (_, k) => G.P[(p.index + 1 + k) % G.P.length]);
/** 相手を1人ねらうカードか（実況の煽り・すきま風） */
export const isTargeted = (id) => id === "hype" || id === "draft";
/** そのカードでねらえる相手（席の番号）。すきま風は、炭のある相手だけ */
export function targetsOf(G, p, id) {
  if (!isTargeted(id)) return [];
  return rivalsOf(G, p).filter((o) => id !== "draft" || o.zone.length).map((o) => o.index);
}
/** ねらう相手を決める。t＝選んだ席（無ければ、ねらえる相手のうち点がいちばん高い人。同じなら手番の近い順）。ねらえなければ null */
export function targetOf(G, p, id, t = null) {
  const list = targetsOf(G, p, id);
  if (t != null) return list.includes(t) ? G.P[t] : null;
  return list.length ? list.map((i) => G.P[i]).reduce((a, b) => (b.score > a.score ? b : a)) : null;
}
const fail = (reason) => ({ ok: false, reason });
const OK = Object.freeze({ ok: true });

// ───────── できること（画面のボタンとCPUの手えらびに使う） ─────────
/** いまの G.wait で、その手札を「使う」ことができるか。できないときは理由つき */
export function canPlay(G, p, id, target = null) {
  const c = CARD[id], w = G.wait;
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (c.type === "coal") return fail("炭カードは炭焼き場に置く");
  if (id === "repack") return fail("このカードはまだ使えない");
  const inPrep = w.type === "prep", inMain = w.type === "main", inReact = w.type === "react";
  if (c.when === "puff") {
    if (G.R.reactAfterReveal ? !inReact : !(inMain && G.phase === "serve")) return fail(G.R.reactAfterReveal ? "審査カードをめくったあとに使う" : "提供の自分のターンに、この一口に仕込む");
  }
  else if (c.when === "prep") { if (!inPrep) return fail("準備フェイズに使う"); }
  else if (c.when === "turn") { if (!inMain) return fail("提供フェイズの自分のターンに使う"); }
  else if (!(inPrep || inMain)) return fail("自分のターンに使う");
  if ((p.cardsUsed || 0) >= G.R.cardsPerRound) return fail("カードはこのターンもう使った");
  if (heatOf(p) < (c.need || 0)) return fail(`熱${c.need}以上で使える`);
  if (c.pay?.fire && heatOf(p) < c.pay.fire) return fail(`落とす熱が${c.pay.fire}要る`);
  if (c.pay?.leaf && (!p.main || p.bowl[p.main] < c.pay.leaf)) return fail("減らす葉がない");
  if (c.type === "tool" && p.tools.includes(id)) return fail("同じ器具はもう出ている");
  if (id === "add_coal" && !coalRoom(p)) return fail(`炭は${coalMaxOf(p)}つまで`);
  if (id === "add_coal" && heatOf(p) >= RULES.heatMax) return fail("熱は10まで");
  if (id === "fan" && !p.stove.some((x) => x.stage < 2)) return fail("火おこし中の炭がない");
  if (id === "encore" && !isLastSession(G)) return fail("最終セッションだけ");
  if (id === "buyout" && (p.steamed || p.turn?.mode)) return fail("詰める前に使う");
  if (id === "draft" && !targetsOf(G, p, id).length) return fail("相手に炭がない");
  if (isTargeted(id) && target != null && !targetOf(G, p, id, target)) return fail("その相手には使えない");
  if (id === "read" && (!G.pile.length || p.peek)) return fail(G.pile.length ? "もう見ている" : G.R.revealFirst ? "次の審査カードがない" : "審査カードがない");
  if (id === "read" && G.R.revealFirst && G.round >= roundsOf(G) - 1) return fail("次のラウンドがない");
  if (id === "go_second" && G.round >= roundsOf(G) - 1) return fail("次のラウンドがない");
  if ((id === "inner" || id === "outer" || id === "loosen") && false) return OK;
  return OK;
}
const ADD_LIMIT = (G) => (G.R.coalAdds === 1 ? "炭を足すのは1ターンに1つ" : `炭を足すのは1ターンに${G.R.coalAdds}つまで`);
export function canCharge(G, p) {
  const w = G.wait;
  if (!w || w.player !== p.index) return fail("いまは自分の番ではない");
  if (w.type === "prep") { if (p.turn.mode !== "steam") return fail("蒸らすターンだけ"); }
  else if (w.type !== "main") return fail("自分のターンに行う");
  if ((p.turn.adds || 0) >= G.R.coalAdds) return fail(ADD_LIMIT(G));
  if ((p.turn.charges || 0) >= G.R.chargePerTurn) return fail(G.R.chargePerTurn === 1 ? "チャージ＆ドローは1ターンに1回" : `チャージは1ターンに${G.R.chargePerTurn}回まで`);
  // 置いたら必ず1枚引く（引かずに置くことはできない）。引く札がどこにも無ければ置けない
  if (G.R.chargeDraw > 0 && !p.deck.length && !p.ash.length) return fail("引く札が無いので置けない");
  if (!coalRoom(p)) return fail(`炭は${coalMaxOf(p)}つまで`);
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
  if ((p.turn.adds || 0) >= G.R.coalAdds) return fail(ADD_LIMIT(G));
  if (!coalRoom(p)) return fail(`炭は${coalMaxOf(p)}つまで`);
  if (heatOf(p) + CARD[c.id].heat > RULES.heatMax) return fail("熱は10まで");
  return OK;
}
export function canAsh(G, p) {
  const w = G.wait;
  // 立ち上げ（準備の蒸らすターン）でも、種火を外して焼けた炭と入れ替えられる
  if (!w || w.player !== p.index || !(w.type === "main" || (w.type === "prep" && p.turn.mode === "steam"))) return fail("蒸らすターンか、提供の自分のターンに行う");
  if ((p.turn.ashes || 0) >= G.R.ashPerTurn) return fail(G.R.ashPerTurn === 1 ? "炭を外すのは1ターンに1つ" : `炭を外すのは1ターンに${G.R.ashPerTurn}つまで`);
  if (!p.zone.length) return fail("炭がない");
  return OK;
}
/** 準備の「詰める」で、このターンに取れる枚数 */
export function packLimit(G, p) {
  let n = G.R.packN + (p.bowlId === "beat80" ? 1 : 0) + (p.turn?.buyout ? 2 : 0);
  if (!p.packedOnce && p.index === G.prepFirst) n -= G.R.firstPackCut;
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
    if (picks.length < RULES.startEmbersMin || picks.length > Math.min(RULES.startEmbersMax, coalMaxOf(p)) || picks.some((i) => !(i >= 0 && i < p.hand.length))) return fail(`立ち上げの炭にする${RULES.startEmbersMin}〜${RULES.startEmbersMax}枚を選ぶ`);
    for (const i of picks.sort((x, y) => y - x)) p.zone.push(newCoal(p.hand.splice(i, 1)[0], false));
    emit(G, { t: "embers", p: p.index });
    const o = G.P[(p.index + 1) % G.P.length]; // 先手から席の順に選ぶ。ひと回りしたら準備へ
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
    if (picks.length > G.R.packKinds) return fail(`1ターンに取れるのは${G.R.packKinds}種類まで`);
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
    drawCards(G, p, G.R.steamDraw);
    say(G, `蒸らす：${G.R.steamDraw}枚引く。`, p.index);
  },

  charge(G, p, a) {
    const c = canCharge(G, p); if (!c.ok) return c;
    if (!(a.hand >= 0 && a.hand < p.hand.length)) return fail("手札を選ぶ");
    p.zone.push(newCoal(p.hand.splice(a.hand, 1)[0], false)); p.turn.charges = (p.turn.charges || 0) + 1; p.turn.adds = (p.turn.adds || 0) + 1; p.turn.charged = true;
    const cd = G.R.chargeDraw > 0; // チャージ＆ドロー: 置いたら1枚引く
    say(G, `${cd ? "チャージ＆ドロー" : "チャージ"}：種火を1枚${cd ? "置いて、1枚引く" : ""}（熱${heatOf(p)}）`, p.index); emit(G, { t: "charge", p: p.index });
    if (cd) drawCards(G, p, G.R.chargeDraw);
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
    p.zone.push(newCoal(coal.id, true)); p.turn.adds = (p.turn.adds || 0) + 1;
    say(G, `${CARD[coal.id].name}をのせる（熱${heatOf(p)}）`, p.index); emit(G, { t: "puton", p: p.index, id: coal.id });
    if (coal.id === "dense_flat") drawCards(G, p, 1);
  },
  ash(G, p, a) {
    const c = canAsh(G, p); if (!c.ok) return c;
    const coal = p.zone[a.zone]; if (!coal) return fail("炭を選ぶ");
    p.zone.splice(a.zone, 1); p.ash.push(coal.id); p.turn.ashes = (p.turn.ashes || 0) + 1;
    say(G, `炭を1つ外す（熱${heatOf(p)}）`, p.index); emit(G, { t: "ash", p: p.index, zi: a.zone, up: coal.up, id: coal.id, why: "self" });
    if (p.hmd === "tanukish" && !p.turn.ashDraw) { p.turn.ashDraw = true; drawCards(G, p, 1); say(G, "タヌキッシュリッド：炭を外したので1枚引く。", p.index); }
  },

  play(G, p, a, w) {
    const id = p.hand[a.hand]; if (!id) return fail("手札を選ぶ");
    const c = canPlay(G, p, id, a.target ?? null); if (!c.ok) return c;
    const card = CARD[id];
    p.hand.splice(a.hand, 1);
    p.cardsUsed = (p.cardsUsed || 0) + 1;
    emit(G, { t: "play", p: p.index, id });
    say(G, `${card.name}を使う。`, p.index);
    if (card.type === "tool") {
      if (p.tools.length >= RULES.toolMax) { const out = p.tools.shift(); p.ash.push(out); if (out === "windguard") p.wind = 0; say(G, `器具は${RULES.toolMax}つまで。いちばん古い${CARD[out].name}を灰にした。`, p.index); emit(G, { t: "drop", p: p.index, id: out }); }
      p.tools.push(id); if (id === "windguard") p.wind = 2;
      return;
    }
    if (card.type === "person") { if (p.person) { say(G, `人物は1人まで。${CARD[p.person].name}と入れ替えた。`, p.index); emit(G, { t: "drop", p: p.index, id: p.person }); p.ash.push(p.person); } p.person = id; return; }
    p.ash.push(id);
    if (card.extra) p.cardsUsed = Math.max(0, p.cardsUsed - card.extra); // 枠を返す（もう1枚使える）
    payCost(G, p, card);
    if (card.when === "puff") (p.puff.cards ||= []).push(id); // この一口に仕込んだカード（画面で審査まで見せる）
    return EFFECTS[id] ? EFFECTS[id](G, p, w, a) : undefined;
  },

  cool(G, p, a, w) {
    if (w.type !== "cool") return fail("いまは冷めるところではない");
    if (a.wind) {
      if (p.wind <= 0) return fail("風防がない");
      if (--p.wind === 0) { p.tools.splice(p.tools.indexOf("windguard"), 1); p.ash.push("windguard"); }
      w.winds = (w.winds || 0) + 1;
      emit(G, { t: "wind", p: p.index });
    } else {
      const c = p.zone[a.zone];
      if (!c) return fail("弱める炭を選ぶ");
      if (c.cooled) return fail("同じ炭は1ターンに1段階まで");
      c.cooled = true;
      const n = p.zone.length;
      weaken(G, p, a.zone);
      if (p.zone.length < n) w.burnt = (w.burnt || 0) + 1;
    }
    w.left--;
    if (w.left > 0 && (p.zone.some((c) => !c.cooled) || p.wind > 0)) return;
    // どう冷めたかを記録に残す（画面の案内に出す）
    const h1 = heatOf(p);
    say(G, `冷めた：熱${w.h0 ?? h1}→${h1}${w.burnt ? `（炭${w.burnt}つが灰になった）` : ""}${w.winds ? `（風防で${w.winds}回受けた）` : ""}`, p.index);
    emit(G, { t: "cooled", p: p.index, from: w.h0 ?? h1, to: h1, burnt: w.burnt || 0 });
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

  // 審査で一口のカードを使う時間（rules.reactAfterReveal のときだけ。第0.3版は自分のターンに仕込む）。play で使い、pass でそのまま受ける
  pass(G, p, a, w) {
    if (w.type !== "react") return fail("いまは審査ではない");
    p.puff.done = true;
    const next = G.order.find((i) => !G.P[i].puff.done); // 先手から順に受ける
    if (next != null) { G.wait = { type: "react", player: next }; return; }
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
    weaken(G, p, a.zone, "draft");
    say(G, `すきま風：炭の火が1下がった（熱${heatOf(p)}）`, p.index);
    G.wait = G.stack.pop();
  },
};

/** 発動するために落とす（火力を落とす＝火力ゾーンの札が減って熱が下がる／主役の葉を減らす） */
function payCost(G, p, card) {
  if (card.pay?.fire) { dropFire(G, p, card.pay.fire); say(G, `熱を${card.pay.fire}落として使う（熱${heatOf(p)}）`, p.index); }
  if (card.pay?.leaf) {
    for (let k = 0; k < card.pay.leaf && p.main && p.bowl[p.main] > 0; k++) { p.bowl[p.main]--; fixMain(p); }
    emit(G, { t: "wear", p: p.index, n: card.pay.leaf });
  }
}
// カードごとの効果（使い切りのもの。発動のために落とす分は payCost で先に落とす）
const EFFECTS = {
  heat_in(G, p) { p.puff.tk += 1; p.puff.warm = (p.puff.warm || 0) + 1; },
  heat_out(G, p) { p.puff.tk -= 2; p.puff.cool++; },
  blow(G, p) { p.puff.blow = true; },
  show_smoke(G, p) { p.puff.impress += 4; },
  all_in(G, p) { p.puff.allIn++; },
  duel(G, p) { p.puff.duel++; },
  encore(G, p) { p.puff.encore++; },
  read(G, p) { p.peek = G.pile[0]; emit(G, { t: "peek", p: p.index, puff: p.peek }); },
  ash_tap(G, p) { p.noCool = true; },
  add_coal(G, p) {
    for (let k = 0; k < 2 && coalRoom(p) && heatOf(p) < G.R.heatMax; k++) {
      if (!p.deck.length && p.ash.length) p.deck = shuffle(G, p.ash.splice(0));
      if (p.deck.length) p.zone.push(newCoal(p.deck.pop(), false));
    }
  },
  tongs(G, p) { drawCards(G, p, 2); },
  fan(G, p) { for (const c of p.stove) if (c.stage < 2) c.stage++; },
  inner(G, p) { p.sessImp = (p.sessImp || 0) + 1; },
  outer(G, p) { p.sessMod -= 1; },
  loosen(G, p) { p.keepLeaves = true; },
  breath(G, p) { drawCards(G, p, 1); },
  reset(G, p) { drawCards(G, p, 3); },
  buyout(G, p) { p.turn.buyout = true; },
  hype(G, p, w, a) {
    const o = targetOf(G, p, "hype", a?.target ?? null);
    if (G.P.length > 2) say(G, `${o.name}をねらう。`, p.index);
    if (o.bowl.lavender >= 2) say(G, "ラベンダーの【鎮静】で効かない。", o.index); else o.pend += 1;
    emit(G, { t: "target", p: p.index, to: o.index, id: "hype" });
  },
  venue_heat(G, p) { for (const x of G.P) if (!(x.bowl.lavender >= 2)) x.pend += 1; },
  go_second(G, p) { G.forceSecond = p.index; },
  draft(G, p, w, a) {
    const o = targetOf(G, p, "draft", a?.target ?? null);
    if (!o) return;
    if (G.P.length > 2) say(G, `${o.name}をねらう。`, p.index);
    emit(G, { t: "target", p: p.index, to: o.index, id: "draft" });
    if (hasTool(o, "windguard") || o.bowl.lavender >= 2) { say(G, "相手の炭は守られている。", o.index); return; }
    if (!o.zone.length) return;
    G.stack.push(w); G.wait = { type: "weaken", player: o.index, by: p.index };
  },
};

function startPrepTurn(G) {
  const n = G.P.length, p = G.P[(G.prepFirst + G.prepTurn) % n]; // 先手から席の順に1人ずつ
  G.active = p.index; p.cardsUsed = 0; p.turn = { mode: null, charged: false, charges: 0, buyout: false };
  stoveAdvance(G, p);
  if (G.R.prepack && p.steamed) { p.turn.mode = "steam"; drawCards(G, p, G.R.steamDraw); say(G, `蒸らす：${G.R.steamDraw}枚引く。`, p.index); } // 入門: 詰めてあるので、蒸らすターンから
  G.wait = { type: "prep", player: p.index, n: Math.floor(G.prepTurn / n) + 1 };
}
function endTurn(G, p, kind) {
  p.turn = null;
  if (kind === "prep") {
    G.prepTurn++;
    if (G.prepTurn < G.R.prepTurns * G.P.length) { startPrepTurn(G); return; }
    for (const x of G.P) fixMain(x);
    G.phase = "serve"; G.round = 0; G.serveStep = 0;
    say(G, "提供フェイズ。");
    startRound(G); return;
  }
  G.serveStep++;
  if (G.serveStep < G.P.length) { startServeTurn(G); return; }
  startJudge(G);
}
function startRound(G) {
  G.order = G.P.map((_, k) => (G.lead + k) % G.P.length); G.serveStep = 0; G.judge = null; // 先手から席の順
  for (const p of G.P) { p.puff = newPuff(); p.cardsUsed = 0; p.peek = null; }
  emit(G, { t: "round", round: G.round });
  if (G.R.revealFirst) drawJudge(G); // このラウンドの吸い方を、先に全員が見る
  startServeTurn(G);
}
/** 審査カードを1枚めくる（練習試合は「ふつうに吸う」） */
function drawJudge(G) {
  const q = G.pile.length ? G.pile.shift() : { ...PUFFS.normal, judge: null };
  G.judge = q; if (q.judge) G.shown.push(q);
  emit(G, { t: "reveal", puff: q, round: G.round });
  say(G, `審査：${q.judge ? JUDGE[q.judge].name + "「" + q.style + "」" : q.style}。${q.tx}`);
}
function startServeTurn(G) {
  const p = G.P[G.order[G.serveStep]];
  G.active = p.index; p.turn = { mode: "serve", charged: false, charges: 0, ashes: 0 };
  stoveAdvance(G, p);
  const skipBig = p.hmd === "big_tanukish" && G.round % 3 === 0, solo = p.hmd === "one_coal" && p.zone.length === 1;
  if (p.noCool || skipBig || solo || !p.zone.length) {
    if (p.noCool && p.zone.length) say(G, "灰落とし：このターンは冷めない。", p.index);
    else if (solo) say(G, "C1：炭が1つだけなので冷めない。", p.index);
    else if (skipBig && p.zone.length) say(G, "ビッグタヌキッシュリッド：セッション最初のターンは冷めない。", p.index);
    p.noCool = false; afterCool(G, p); return;
  }
  G.wait = { type: "cool", player: p.index, left: coolStepsOf(p), steps: coolStepsOf(p), h0: heatOf(p) };
}
function afterCool(G, p) {
  for (const c of p.zone) delete c.cooled;
  drawCards(G, p, G.R.draw);
  G.wait = { type: "main", player: p.index };
}

/** その一口にかけた技（審査の前に仕込んだものも、めくったあとに足したものも、ここに貯める） */
const newPuff = () => ({ tk: 0, blow: false, cool: 0, impress: 0, allIn: 0, duel: 0, encore: 0, done: false, cards: [] });
function startJudge(G) {
  if (!G.R.revealFirst) drawJudge(G);
  for (const p of G.P) { p.puff ||= newPuff(); p.puff.done = false; }
  if (!G.R.reactAfterReveal) { resolveJudge(G); return; }
  G.wait = { type: "react", player: G.order[0] };
}
/** いまの一口の見込み（審査カードが出たあと。技をかけたぶんまで） */
export function puffPreview(G, p, extra = {}) {
  const q = G.judge, pf = p.puff || { tk: 0, blow: false, cool: 0, impress: 0, allIn: 0 };
  const h = judgedHeat(p, q, pf.tk + (extra.tk || 0));
  const s = scorePuff(p, h, q, { blow: pf.blow || extra.blow, lastOfSession: isLastOfSession(G) });
  const good = s.zone === "just" || s.zone === "band";
  const pts = s.pts + (good ? (pf.cool || 0) : 0) + (s.zone === "just" ? 3 * (pf.allIn || 0) : 0);
  const imp = voteScore(G, p, s, pts, (pf.impress || 0) + (s.zone === "just" ? 2 * (pf.allIn || 0) : 0) + (good ? pf.warm || 0 : 0) + (p.sessImp || 0));
  return { h, ...s, pts, imp };
}
function resolveJudge(G) {
  const q = G.judge, res = [];
  for (const i of G.order) {
    const p = G.P[i], pf = p.puff, h = judgedHeat(p, q, pf.tk);
    const s = scorePuff(p, h, q, { blow: pf.blow, lastOfSession: isLastOfSession(G) });
    const parts = s.parts.slice();
    const good = s.zone === "just" || s.zone === "band";
    if (good && pf.cool) parts.push({ label: "旨みを引き出す", n: pf.cool });
    if (s.zone === "just" && pf.allIn) parts.push({ label: "渾身の一口", n: 3 * pf.allIn });
    let pts = parts.reduce((a, x) => a + x.n, 0);
    if (pf.encore) { parts.push({ label: "アンコール", n: pts * pf.encore }); pts += pts * pf.encore; }
    if (s.usedSilicone) { p.usedSilicone = true; say(G, "シリコンボウル：焦げを取り消した。", i); }
    if (s.usedLotus) { p.usedLotus = true; say(G, "ロートスHMD：ズレを適温として採点。", i); }
    if (s.zone === "just") p.justCount++;
    const bonus = pf.impress + (s.zone === "just" ? 2 * pf.allIn : 0) + (good ? pf.warm || 0 : 0) + (p.sessImp || 0);
    const imp = voteScore(G, p, s, pts, bonus); // 焦げで葉が減る前に数える
    let lost = null;
    if (s.zone === "scorch") {
      p.scorchCount++;
      const safe = p.person === "minto" && Object.keys(p.bowl).some((k) => FLAVOR[k].kind === "cool" && p.bowl[k] >= 2);
      if (!safe && p.main) { lost = p.main; p.bowl[p.main]--; fixMain(p); }
    }
    res[i] = { h, zone: s.zone, pts, parts, lost, rank: RANK[s.zone], duel: pf.duel, imp, bonus };
  }
  // 一票: 印象がいちばん高い1人（いちばん上が並んだら入らない）
  const top = Math.max(...res.map((r) => r.imp)); let voter = null;
  if (G.R.useVote && top > NO_VOTE && res.filter((r) => r.imp === top).length === 1) {
    voter = res.findIndex((r) => r.imp === top); const w = G.P[voter];
    w.votes++; res[voter].vote = votePtsOf(G, w) + 3 * res[voter].duel; // 点を足す前（審査の前の合計点）で比べる
    // パッキー【実況】: 相手が一票を取るたび、1枚引く（第0.6版の先行分。追う側の手を増やす）
    for (const o of G.P) if (o !== w && o.person === "packy") { drawCards(G, o, 1); say(G, "パッキー：相手の一票を実況して、1枚引いた。", o.index); }
  }
  for (const p of G.P) {
    const i = p.index, r = res[i];
    p.score += r.pts + (r.vote || 0); p.lastPuff = r.pts; p.pend = 0; if (!G.R.revealFirst) p.peek = null;
    say(G, `判定熱${r.h}・${ZONE_LABEL[r.zone]} → ${r.pts}点${r.vote ? `＋一票${r.vote}点` : ""}${r.lost ? `（${FLAVOR[r.lost].name}を1枚失う）` : ""}`, i);
  }
  for (const p of G.P) p.puff.scored = true;
  G.lastResult = { round: G.round, puff: q, res, voter };
  emit(G, { t: "score", round: G.round, res, voter, puff: q });
  // 次のラウンドの先手: 毎ラウンド、次の席へ回る。「後の先」があれば、使った人がいちばん後になる
  G.lead = (G.lead + 1) % G.P.length;
  if (G.forceSecond != null) { G.lead = (G.forceSecond + 1) % G.P.length; G.forceSecond = null; }
  const endOfSession = isLastOfSession(G), last = G.round === roundsOf(G) - 1;
  if (endOfSession) {
    // セッションごとの点（一口＋一票）。上園の決め手（伸びしろ）で、最後のセッションと第1セッションを比べる
    for (const p of G.P) { p.sessPts.push(p.score - p.sessStart); p.sessStart = p.score; }
    for (const p of G.P) { p.sessMod = 0; p.sessImp = 0; p.usedLotus = false; }
    if (!last) { G.wearQueue = [...G.order]; nextWear(G); return; }
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
/** 伸びしろ（上園の決め手）: 最後のセッションの点 − 第1セッションの点 */
export const growthOf = (p) => (p.sessPts.length ? p.sessPts[p.sessPts.length - 1] - p.sessPts[0] : 0);
function finish(G) {
  const bonus = [];
  // 審査員のボーナス: いちばんの1人に n 点。いちばんが並んだら、並んだ人に tie 点ずつ
  const give = (jid, key, n, tie) => {
    const ks = G.P.map(key), top = Math.max(...ks), solo = ks.filter((k) => k === top).length === 1;
    const got = ks.map((k) => (k === top ? (solo ? n : tie) : 0));
    bonus.push({ judge: jid, pts: got }); G.P.forEach((p, i) => { p.score += got[i]; });
  };
  for (const jid of G.R.useBonus ? G.tour.judges : []) {
    if (jid === "kamizono") give(jid, growthOf, 4, 2);
    if (jid === "hakase") { give(jid, (p) => -p.scorchCount, 4, 2); const extra = G.P.map((p) => (p.scorchCount ? 0 : 2)); bonus.push({ judge: jid, pts: extra, note: "焦げ0回" }); G.P.forEach((p, i) => { p.score += extra[i]; }); }
    if (jid === "sensu") give(jid, (p) => p.lastPuff, 5, 2);
    if (jid === "emir") give(jid, (p) => leavesOf(p), 4, 2);
    if (jid === "taiyo") give(jid, (p) => p.justCount, 4, 2);
  }
  // 順位: 点 → 残った葉 → 手札の枚数。上の2人がどれも同じなら引き分け（勝者なし）
  const cmp = (a, b) => b.score - a.score || leavesOf(b) - leavesOf(a) || b.hand.length - a.hand.length;
  const ranks = G.P.slice().sort((a, b) => cmp(a, b) || a.index - b.index).map((p) => p.index);
  const winner = cmp(G.P[ranks[0]], G.P[ranks[1]]) === 0 ? null : ranks[0];
  G.over = true; G.phase = "end"; G.wait = null;
  G.result = { winner, scores: G.P.map((p) => p.score), votes: G.P.map((p) => p.votes), bonus, ranks };
  emit(G, { t: "end", result: G.result });
  say(G, winner === null ? "引き分け。" : `${G.P[winner].name}の勝ち（${G.result.scores.join(" 対 ")}）。`);
}

/** その場に出ていない葉を足して10種の場を作る（指定の葉は必ず入れる） */
export function randomMarket(seed, must = []) {
  const G = { seed: (seed >>> 0) || 1 };
  const rest = shuffle(G, FLAVORS.map((f) => f.id).filter((id) => !must.includes(id)));
  return [...must, ...rest].slice(0, 10);
}
