// 一台勝負 第0.3版の規則案を、ゲーム内の規則（remake/js/minigames/ichidai-rules.js）とCPU（ichidai-ai.js）で比べる。
// node docs/design/card_game/sim_v03.mjs [--games 120] [--only A,G]   … 規則の案を比べる
// node docs/design/card_game/sim_v03.mjs --cards [--games 300]           … いまの規則で、カードごとの使われ方
// node docs/design/card_game/sim_v03.mjs --coals [--games 240]           … いまの規則で、審査の時点の炭の数・熱・帯（第0.4版の確かめ）
// 比べるのは「一口のカードをいつ使うか」「チャージ・灰にするを1ターンに何回まで許すか」「印象の付け方」「一票の点」。
// 結果の読み方と決めたことは v0.3_design.md。
import { createGame, act, heatOf } from "../../../remake/js/minigames/ichidai-rules.js";
import { FLAVOR } from "../../../remake/js/minigames/ichidai-data.js";
import { aiAct } from "../../../remake/js/minigames/ichidai-ai.js";
import { CARD, TOURNAMENTS, KITS } from "../../../remake/js/minigames/ichidai-data.js";

const arg = (name, def) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? Number(process.argv[i + 1]) : def; };
const GAMES = arg("games", 120);
// 第0.2版の受け方（めくったあとに一口のカード）と、印象の付け方（ジャスト2・適温1・ズレ0・外れ−1・焦げ−2）
const V02 = { cardsPerRound: 1, chargePerTurn: 1, ashPerTurn: 1, reactAfterReveal: true, vote: 2, impress: { just: 2, band: 1, off: 0, cold: -1, scorch: -2 } };
const FLAT = { just: 1, band: 1, off: -1, cold: -2, scorch: -3 };
const VARIANTS = [
  { name: "A めくったあとに一口のカード（チャージ1・灰1）", rules: V02 },
  { name: "B A＋チャージ何回でも", rules: { ...V02, chargePerTurn: Infinity } },
  { name: "C B＋灰も何回でも", rules: { ...V02, chargePerTurn: Infinity, ashPerTurn: Infinity } },
  { name: "D （参考）A＋カード2枚", rules: { ...V02, cardsPerRound: 2 } },
  { name: "E 一口のカードは自分のターンに仕込む（チャージ1・灰1）", rules: { ...V02, reactAfterReveal: false } },
  { name: "F E＋チャージ何回でも", rules: { ...V02, reactAfterReveal: false, chargePerTurn: Infinity } },
  { name: "G 採用: F＋印象はジャストも適温も同じ", rules: { ...V02, reactAfterReveal: false, chargePerTurn: Infinity, impress: FLAT } },
  { name: "H G＋一票3点", rules: { ...V02, reactAfterReveal: false, chargePerTurn: Infinity, impress: FLAT, vote: 3 } },
  { name: "I G＋毎ターン引くのは1枚", rules: { ...V02, reactAfterReveal: false, chargePerTurn: Infinity, impress: FLAT, draw: 1 } },
];
const ONLY = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1].split(",") : null;

function play(cfg) {
  const G = createGame(cfg); let steps = 0;
  while (!G.over) {
    const r = act(G, aiAct(G, G.wait.player));
    if (!r.ok) throw new Error(`CPUの入力が通らない: ${r.reason}`);
    if (++steps > 6000) throw new Error("終わらない");
  }
  return G;
}
function run(v) {
  const z = { just: 0, band: 0, off: 0, cold: 0, scorch: 0 }, plays = { turn: 0, puff: 0 }, needHi = {}, cool = { used: 0, hit: 0 };
  let rounds = 0, slotUsed = 0, skillWins = 0, skillGames = 0, firstVotes = 0, votes = 0, impFlip = 0, cardVote = 0, score = 0, heatSum = 0, heatN = 0;
  const kitW = {}, kitN = {};
  for (let g = 0; g < GAMES; g++) {
    const tour = TOURNAMENTS[1 + (g % (TOURNAMENTS.length - 1))].id, ka = KITS[g % KITS.length].id, kb = KITS[(g + 1 + (g >> 2) % (KITS.length - 1)) % KITS.length].id;
    // 同じ強さどうし（帯・カードの使い方・一式の釣り合いを見る）
    const G = play({ seed: 1000 + g, tournament: tour, rules: v.rules, players: [{ name: "A", kit: ka, ai: true, level: 2 }, { name: "B", kit: kb, ai: true, level: 2 }] });
    for (const ev of G.events) {
      if (ev.t === "play") {
        const c = CARD[ev.id]; (c.when === "puff" ? plays.puff++ : plays.turn++);
        if ((c.need || 0) >= 5) needHi[c.name] = (needHi[c.name] || 0) + 1;
        if (ev.id === "heat_out") cool.used++;
      }
      if (ev.t === "score") {
        rounds++;
        for (const r of ev.res) { z[r.zone]++; if (r.parts.some((x) => x.label === "旨みを引き出す")) cool.hit++; }
        if (ev.voter != null) { votes++; if (ev.voter === G.order?.[0]) firstVotes++; if (RANKD(ev.res, ev.voter)) impFlip++; if (ev.res[ev.voter].imp - (ev.res[ev.voter].bonus || 0) <= ev.res[1 - ev.voter].imp) cardVote++; }
      }
    }
    for (const p of G.P) { score += p.score; kitN[p.kit] = (kitN[p.kit] || 0) + 1; if (G.result.winner === p.index) kitW[p.kit] = (kitW[p.kit] || 0) + 1; }
    slotUsed += G.events.filter((e) => e.t === "play").length;
    // 腕の差: つよい 対 やさしい
    const H = play({ seed: 5000 + g, tournament: tour, rules: v.rules, players: [{ name: "強", kit: ka, ai: true, level: 2 }, { name: "易", kit: kb, ai: true, level: 0 }] });
    skillGames++; if (H.result.winner === 0) skillWins++;
    for (const p of G.P) { heatSum += heatOf(p); heatN++; }
  }
  const puffs = Object.values(z).reduce((a, b) => a + b, 0), pc = (n, d) => `${Math.round((100 * n) / Math.max(1, d))}%`;
  return {
    name: v.name,
    帯: `ジャスト${pc(z.just, puffs)}・適温${pc(z.band, puffs)}・ズレ${pc(z.off, puffs)}・外れ${pc(z.cold, puffs)}・焦げ${pc(z.scorch, puffs)}`,
    カードを使えたラウンド: pc(slotUsed, rounds * 2),
    使い方: `手番${plays.turn}・一口${plays.puff}`,
    必要火力5以上の使用: Object.entries(needHi).map(([k, n]) => `${k}${n}`).join("・") || "なし",
    熱を逃がす吸い: `使用${cool.used}・適温以上に入れた${cool.hit}`,
    一票の割合: pc(votes, rounds), 帯は負けたのに印象で勝った一票: pc(impFlip, votes), カードの印象で取った一票: pc(cardVote, votes),
    つよいの勝率: pc(skillWins, skillGames), 平均点: (score / (GAMES * 2)).toFixed(1),
    一式の勝率: KITS.map((k) => `${k.id}:${pc(kitW[k.id] || 0, kitN[k.id] || 1)}`).join(" "),
  };
}
/** 一票を取った側の帯が、相手より悪かったか（印象＝味値・カードで逆転した） */
function RANKD(res, voter) {
  const R = { just: 4, band: 3, off: 2, cold: 1, scorch: 0 };
  return R[res[voter].zone] < R[res[1 - voter].zone];
}

/** カードごとの使われ方（--cards）: 提供の自分のターンの手札にあった回数・使った回数・使ったときの熱（追加コストを払ったあと） */
function cardStats(games) {
  const st = {}, S = (id) => (st[id] ||= { held: 0, played: 0, heatSum: 0 });
  for (let g = 0; g < games; g++) {
    const tour = TOURNAMENTS[1 + (g % (TOURNAMENTS.length - 1))].id, ka = KITS[g % KITS.length].id, kb = KITS[(g + 1 + (g >> 2) % (KITS.length - 1)) % KITS.length].id;
    const G = createGame({ seed: 1000 + g, tournament: tour, players: [{ name: "A", kit: ka, ai: true, level: 2 }, { name: "B", kit: kb, ai: true, level: 2 }] });
    let last = null;
    while (!G.over) {
      const w = G.wait;
      if (w.type === "main" && G.phase === "serve" && `${G.round}:${w.player}` !== last) {
        last = `${G.round}:${w.player}`;
        for (const id of new Set(G.P[w.player].hand)) if (CARD[id].type !== "coal") S(id).held++;
      }
      const before = G.events.length, r = act(G, aiAct(G, w.player));
      if (!r.ok) throw new Error(r.reason);
      for (const ev of G.events.slice(before)) if (ev.t === "play") { S(ev.id).played++; S(ev.id).heatSum += heatOf(G.P[ev.p]); }
    }
  }
  console.log("カード\t必要火力\t手札にあったターン\t使った\t使用率\t使ったときの熱");
  for (const [id, s] of Object.entries(st).sort((a, b) => (CARD[a[0]].need || 0) - (CARD[b[0]].need || 0))) {
    console.log([CARD[id].name, CARD[id].need || 0, s.held, s.played, s.held ? `${Math.round((100 * s.played) / s.held)}%` : "-", s.played ? (s.heatSum / s.played).toFixed(1) : "-"].join("\t"));
  }
}
/** 炭の数（--coals）: 審査カードをめくった時点の火力ゾーンを数える。炭の数・うち種火・熱、葉の温度帯ごとの炭の数、提供の1ターンの手数 */
function coalStats(games) {
  const hist = { n: {}, ember: {}, heat: {}, first: {} }, byTemp = {}, z = { just: 0, band: 0, off: 0, cold: 0, scorch: 0 };
  let snaps = 0, firsts = 0, turns = 0; const moves = { charge: 0, puton: 0, ash: 0 };
  const inc = (o, k) => { o[k] = (o[k] || 0) + 1; };
  for (let g = 0; g < games; g++) {
    const tour = TOURNAMENTS[1 + (g % (TOURNAMENTS.length - 1))].id, ka = KITS[g % KITS.length].id, kb = KITS[(g + 1 + (g >> 2) % (KITS.length - 1)) % KITS.length].id;
    const G = createGame({ seed: 1000 + g, tournament: tour, players: [{ name: "A", kit: ka, ai: true, level: 2 }, { name: "B", kit: kb, ai: true, level: 2 }] });
    let reveals = 0;
    while (!G.over) {
      const w = G.wait, a = aiAct(G, w.player), before = G.events.length;
      if (G.phase === "serve" && w.type === "main") { if (a.type in moves) moves[a.type]++; if (a.type === "end") turns++; }
      const r = act(G, a); if (!r.ok) throw new Error(r.reason);
      for (const ev of G.events.slice(before)) {
        if (ev.t === "score") for (const x of ev.res) z[x.zone]++;
        if (ev.t !== "reveal") continue;
        reveals++;
        for (const p of G.P) {
          const n = p.zone.length; inc(hist.n, n); inc(hist.ember, p.zone.filter((c) => !c.up).length); inc(hist.heat, heatOf(p)); snaps++;
          if (reveals === 1) { inc(hist.first, n); firsts++; }
          const f = FLAVOR[p.main]; if (f) { const k = f.hi <= 5 ? "低温の葉" : f.lo >= 6 ? "高温の葉" : "中温の葉"; inc((byTemp[k] ||= { total: 0 }), n); byTemp[k].total++; }
        }
      }
    }
  }
  const row = (o, d) => Object.keys(o).filter((k) => k !== "total").map(Number).sort((a, b) => a - b).map((k) => `${k}:${Math.round((100 * o[k]) / d)}%`).join(" ");
  const puffs = Object.values(z).reduce((a, b) => a + b, 0);
  console.log(`審査の時点の炭の数   ${row(hist.n, snaps)}`);
  console.log(`  うち種火           ${row(hist.ember, snaps)}`);
  console.log(`最初の審査の炭の数   ${row(hist.first, firsts)}`);
  for (const [k, o] of Object.entries(byTemp)) console.log(`  ${k}の炭の数     ${row(o, o.total)}`);
  console.log(`審査の時点の熱       ${row(hist.heat, snaps)}`);
  console.log(`帯                   ${Object.entries(z).map(([k, n]) => `${k}:${Math.round((100 * n) / puffs)}%`).join(" ")}`);
  console.log(`提供の1ターンあたり  のせる${(moves.puton / turns).toFixed(2)}・チャージ${(moves.charge / turns).toFixed(2)}・灰にする${(moves.ash / turns).toFixed(2)}`);
}
if (process.argv.includes("--cards")) { cardStats(GAMES); process.exit(0); }
if (process.argv.includes("--coals")) { coalStats(GAMES); process.exit(0); }

for (const v of VARIANTS.filter((x) => !ONLY || ONLY.includes(x.name[0]))) {
  const r = run(v);
  console.log(`\n■ ${r.name}`);
  for (const [k, val] of Object.entries(r)) if (k !== "name") console.log(`  ${k}: ${val}`);
}
