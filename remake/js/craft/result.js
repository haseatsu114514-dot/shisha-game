// 大会の発表まわり: 中間発表／RESULT 10 COUNT（プチュン=1位確定・パリン=敗北）／
// 南雲の持ち点一括投入カットイン／最終順位表。master_spec 第2部 §4〜5・story ch1【転】
import { el, sleep, clamp, rand } from "../core/util.js";
import { faceIconUrl, displayName } from "../core/data.js";
import { layers, showScreen, flash, shake } from "../core/ui.js";
import { state } from "../core/state.js";
import { SE, stopBgm } from "../core/audio.js";
import { autoSkill } from "./common.js";
import { mixColor } from "./art.js";
import { NAGUMO_BAR } from "./score.js";

export const CONTESTANTS = ["naru", "adam", "minto", "hajime"];
const RIVAL_COLOR = { naru: "#f0d8a0", adam: "#c9463a", minto: "#7fe0c2" };
const JUDGES = [
  { id: "maezono", label: "前園" },
  { id: "dr_kemuri", label: "チャコール博士" },
  { id: "nagumo", label: "南雲" },
];

/** 総合スコア → 結末。1位は南雲票（基準超え）だけが生む（ch1の正史） */
export function outcomeOf(total) {
  if (total >= NAGUMO_BAR) return { rank: 1, kind: total >= 90 ? "premium" : "win" };
  if (total >= NAGUMO_BAR - 12) return { rank: 3, kind: "close" };
  return { rank: 4, kind: total < 38 ? "disaster" : "lose" };
}

/** 審査員の持ち点（各10点）の最終配分。はじめへの点は「ほとんどない」まま、南雲の10点だけが動く */
export function pointTable(rank) {
  if (rank === 1) return { maezono: { naru: 5, adam: 2, minto: 2, hajime: 1 }, dr_kemuri: { adam: 5, minto: 3, naru: 2 }, nagumo: { hajime: 10 } };
  if (rank === 3) return { maezono: { naru: 4, adam: 3, hajime: 2, minto: 1 }, dr_kemuri: { adam: 5, minto: 2, hajime: 2, naru: 1 }, nagumo: { naru: 10 } };
  return { maezono: { naru: 5, adam: 3, minto: 2 }, dr_kemuri: { adam: 5, minto: 4, naru: 1 }, nagumo: { naru: 10 } };
}
const totals = (table, upto = JUDGES.length) => {
  const t = Object.fromEntries(CONTESTANTS.map((c) => [c, 0]));
  JUDGES.slice(0, upto).forEach((j) => { for (const [c, v] of Object.entries(table[j.id] || {})) t[c] += v; });
  return t;
};

const nameOf = (id) => (id === "hajime" ? "はじめ" : displayName(id, state));
const faceOf = (id, cls = "") => {
  const u = faceIconUrl(id);
  return u ? el(`img${cls}`, { src: u, alt: "" }) : el(`span${cls}.ph`, { text: nameOf(id)[0] });
};

// ---------------------------------------------------------------- 中間発表

/**
 * 暫定順位（R1・R2の後）。南雲票が入るまでは、演出上はじめは最大2位止まり。
 * @param round 1 | 2
 * @param mine  ここまでのはじめの出来（0〜100）
 */
export async function showStandings(round, mine) {
  const base = { naru: 82, adam: 74, minto: 67 };
  const rows = Object.entries(base).map(([id, v]) => ({ id, v: v + rand(-2, 2) }));
  rows.push({ id: "hajime", v: Math.min(mine * 0.9, 80) });
  rows.sort((a, b) => b.v - a.v);
  const feed = round === 1
    ? ["前園、なるに3点投入！", "南雲審査員長 ── まだ動かず"]
    : ["チャコール博士、アダムに4点投入！", "南雲審査員長 ── 10点まるまる温存"];
  const board = el("div.standings", [
    el("div.sd-title", { text: `ROUND ${round} 暫定順位` }),
    el("div.sd-rows", rows.map((r, i) => el(`div.sd-row${r.id === "hajime" ? ".me" : ""}`, { style: { "--i": String(i) } }, [
      el("span.sd-rank", { text: `${i + 1}` }),
      faceOf(r.id, ".sd-face"),
      el("span.sd-name", { text: nameOf(r.id) }),
      el("i.sd-bar", [el("b", { style: { width: `${clamp(r.v, 5, 100)}%` } })]),
    ]))),
    el("div.sd-feed", feed.map((t) => el("div", { text: `▶ ${t}` }))),
  ]);
  const dim = el("div.fx-dim");
  layers.fx.append(dim, board);
  SE.crowd(1.6);
  await sleep(40);
  dim.classList.add("show");
  board.classList.add("show");
  await sleep(autoSkill() ? 300 : 3600);
  board.classList.add("out");
  dim.classList.remove("show");
  await sleep(400);
  board.remove();
  dim.remove();
}

// ---------------------------------------------------------------- RESULT 10 COUNT

/**
 * 10→0 のカウントと、順位に応じた終わり方。
 * kind: premium（残り2〜3でフライングプチュン）/ win（0でプチュン）/ close（プチュ…→パリン）/ lose（即パリン）/ disaster（ヒビ→バキン）
 * カウント中の画面はクリックを吸わない（自動で進む）
 */
export async function resultCountdown(cs, kind) {
  stopBgm(0.4);
  const fast = !!autoSkill();
  const tick = fast ? 60 : 620;
  const num = el("div.rc-num");
  const cuts = el("div.rc-cuts");
  const pray = el("div.rc-pray", CONTESTANTS.map((id) => el(`div.rc-card${id === "hajime" ? ".me" : ""}`, [
    faceOf(id, ".rc-face"),
    el("i.rc-shisha", { style: { background: id === "hajime" ? mixColor(cs.mix) : RIVAL_COLOR[id] } }),
    el("span", { text: nameOf(id) }),
  ])));
  const screen = el("div.count-screen", { dataset: { test: "result-count" } }, [el("div.rc-title", { text: "RESULT" }), cuts, num, pray, el("div.rc-crt")]);
  showScreen("count", screen);
  const cutWords = [
    "アルミ穴あけ", cs.heat?.flash ? "炭のピカン" : "炭の赤熱", cs.heat?.just ? "ジャスト炭" : "炭の熱", "立ちのぼる煙",
    "ミントの香り", "審査員の目元", "会場のざわめき", "スミさんの背中", "tonariのカウンター",
  ];
  SE.drumroll(fast ? 0.5 : 5.5);
  for (let n = 10; n >= 0; n--) {
    num.textContent = String(n);
    num.classList.remove("pop");
    void num.offsetWidth;
    num.classList.add("pop");
    SE.count();
    if (n <= 4) SE.heartbeat();
    if (n > 0 && n <= 9) {
      const c = el("div.rc-cut", { text: cutWords[(10 - n) % cutWords.length], style: { left: `${rand(8, 70)}%`, top: `${rand(12, 70)}%`, "--r": `${rand(-8, 8)}deg` } });
      cuts.append(c);
      setTimeout(() => c.remove(), 900);
    }
    if (kind === "premium" && n === 3) { await puchun(screen, true); return; }
    if (n === 1 && kind === "close") {
      screen.classList.add("almost");
      SE.puchun();
      await sleep(tick);
      await parin(screen, false);
      return;
    }
    await sleep(tick);
  }
  if (kind === "win") await puchun(screen, false);
  else if (kind === "disaster") await parin(screen, true);
  else await parin(screen, false);
}

async function puchun(screen, flying) {
  screen.classList.add("puchun");
  if (flying) screen.classList.add("flying");
  SE.puchun();
  await sleep(700);
  screen.classList.add("smoke-white");
  flash("white", 500);
  await sleep(900);
}

async function parin(screen, disaster) {
  if (disaster) {
    screen.classList.add("crack");
    SE.crack();
    await sleep(500);
    SE.crack();
    shake(document.getElementById("stage"), 500);
    await sleep(350);
  }
  screen.classList.add("parin");
  SE.parin();
  flash("red", 300);
  await sleep(300);
  screen.classList.add("smoke-black");
  if (disaster) screen.append(el("div.rc-over", { text: "OVER HEAT" }));
  await sleep(1300);
}

// ---------------------------------------------------------------- 南雲カットイン（持ち点の一括投入）

export async function nagumoCutin(rank) {
  const table = pointTable(rank);
  const before = totals(table, 2);
  const after = totals(table, 3);
  const maxV = 13;
  const bars = el("div.nc-bars", CONTESTANTS.map((id) => el(`div.nc-row${id === "hajime" ? ".me" : ""}`, { dataset: { id } }, [
    faceOf(id, ".nc-face"), el("span.nc-name", { text: nameOf(id) }),
    el("i.nc-bar", [el("b", { style: { width: `${(before[id] / maxV) * 100}%` } })]),
    el("span.nc-pt", { text: `${before[id]}` }),
  ])));
  const cut = el("div.nc-cut", [faceOf("nagumo", ".nc-cut-face"), el("div", [el("small", { text: "審査員長" }), el("b", { text: "南雲修二" }), el("div.nc-cut-pt", { text: "持ち点 10 ── 一括投入" })])]);
  const ov = el("div.nagumo-cut", [el("div.nc-title", { text: "持ち点 投入状況" }), bars, cut]);
  layers.fx.append(ov);
  const fast = !!autoSkill();
  await sleep(40);
  ov.classList.add("show");
  SE.crowd(2);
  await sleep(fast ? 100 : 1600);
  cut.classList.add("show");
  SE.just();
  flash("gold");
  await sleep(fast ? 100 : 1400);
  for (const row of bars.children) {
    const id = row.dataset.id;
    row.querySelector("b").style.width = `${(after[id] / maxV) * 100}%`;
    row.querySelector(".nc-pt").textContent = `${after[id]}`;
  }
  SE.fanfare();
  // 並べ替え（順位の入れ替わりを見せる）
  const order = CONTESTANTS.slice().sort((a, b) => after[b] - after[a]);
  order.forEach((id, i) => { bars.querySelector(`[data-id="${id}"]`).style.order = String(i); });
  await sleep(fast ? 100 : 2200);
  if (rank === 1) confetti(ov);
  await sleep(fast ? 100 : 1600);
  ov.classList.add("out");
  await sleep(400);
  ov.remove();
}

function confetti(host) {
  const colors = ["#ffc24a", "#38f0ff", "#ff3fa4", "#a6ff5c", "#ffffff"];
  for (let i = 0; i < 70; i++) {
    const c = el("i.confetti", { style: { left: `${rand(0, 100)}%`, background: colors[i % colors.length], animationDelay: `${rand(0, 0.6)}s`, "--x": `${rand(-120, 120)}px`, "--r": `${rand(-720, 720)}deg` } });
    host.append(c);
    setTimeout(() => c.remove(), 3200);
  }
}

// ---------------------------------------------------------------- 最終順位表

export function resultTable(cs, rank) {
  return new Promise((resolve) => {
    const t = totals(pointTable(rank));
    const order = CONTESTANTS.slice().sort((a, b) => t[b] - t[a]);
    const P = cs.parts || {};
    const rows = order.map((id, i) => el(`div.rt-row${id === "hajime" ? ".me" : ""}`, { style: { "--i": String(3 - i) } }, [
      el("span.rt-rank", { text: `${i + 1}位` }), faceOf(id, ".rt-face"), el("span.rt-name", { text: nameOf(id) }),
      el("i.rt-bar", [el("b", { style: { width: `${(t[id] / 20) * 100}%` } })]), el("span.rt-pt", { text: `${t[id]} pt` }),
    ]));
    const grade = (s) => (s >= 90 ? "S" : s >= 80 ? "A" : s >= 65 ? "B" : s >= 50 ? "C" : "D");
    const detail = el("div.rt-detail", [
      el("h4", { text: "あなたの一台" }),
      ...[["穴あけ", P.holes], ["炭焼き", P.heat], ["完成品", P.shisha], ["FLAVOR TRIAL", P.trial]].map(([k, v]) =>
        el("div.rt-part", [el("span", { text: k }), el(`b.g-${grade(v || 0)}`, { text: grade(v || 0) })])),
      el("div.rt-part.total", [el("span", { text: "総合" }), el(`b.g-${cs.rank}`, { text: cs.rank })]),
      cs.feel ? el("div.rt-part.feel", [el("span", { text: "観客の体感スコア" }), el("b", { text: `${cs.feel} P` })]) : null,
      cs.bonusNotes?.length ? el("small", { text: `効いたもの: ${cs.bonusNotes.join("・")}` }) : null,
      el("small.rt-bar-note", { text: rank === 1 ? "技術点も個性点も、4人の中では下位だった。" : "南雲審査員長の持ち点は、動かなかった。" }),
    ]);
    const btn = el("button.btn.primary", { dataset: { test: "result-next" }, onclick: () => { SE.select(); resolve(); } }, [
      el("span.btn-label", { text: rank === 1 ? "──表彰のあとへ" : "……結果を受け止める" }),
    ]);
    showScreen("result", el("div.result-table", [el("div.rt-title", { text: "SMOKE CROWN CUP ── FINAL RESULT" }), el("div.rt-rows", rows), detail, btn]));
    if (rank === 1) SE.fanfare();
    if (autoSkill()) setTimeout(() => btn.click(), 150);
  });
}
