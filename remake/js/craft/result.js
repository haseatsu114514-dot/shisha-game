import { improvementOf, goodPointOf } from "./advice.js";
import { actualExpressionCard } from "./flavor-guide.js";
// 大会の発表まわり: 中間発表／RESULT 10 COUNT（プチュン=1位確定・パリン=敗北）／
// 南雲の持ち点一括投入カットイン／最終順位表。master_spec 第2部 §4〜5・story ch1【転】
import { el, sleep, rand } from "../core/util.js";
import { DB, faceIconUrl, displayName, portraitInfo } from "../core/data.js";
import { layers, showScreen, flash, shake, retireScreen } from "../core/ui.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { SE, stopBgm } from "../core/audio.js";
import { autoSkill } from "./common.js";
import { mixColor } from "./art.js";
import { NAGUMO_BAR } from "./score.js";
import { evaluationOf, judgeComment } from "./feedback.js";
import { craftRecognition } from "./recognition.js";
import { VOTE_SCALE, voteStack as stackOf, judgePanel as panelOf, judgeLegend as legendOf, countUp } from "./tournament-graphics.js";

export const CONTESTANTS = ["naru", "adam", "minto", "hajime"];
const RIVAL_COLOR = { naru: "#f0d8a0", adam: "#c9463a", minto: "#7fe0c2" };
const JUDGES = [
  { id: "maezono" },
  { id: "dr_kemuri", label: "チャコール博士" },
  { id: "nagumo", label: "南雲" },
];

/** 総合スコア → 結末。1位は南雲票（基準超え）だけが生む（ch1の正史） */
export function outcomeOf(total) {
  if (total >= NAGUMO_BAR) return { rank: 1, kind: total >= 90 ? "premium" : "win" };
  if (total >= NAGUMO_BAR - 12) return { rank: 3, kind: "close" };
  return { rank: 4, kind: total < 38 ? "disaster" : "lose" };
}

/** 審査員の持ち点（各10点）の最終配分。はじめは上園・博士からも点が入り上位で競り、南雲の10点は「最後の一票」として締める（#1282 逆転優勝の廃止、オーナー決定 2026-10-28） */
export function pointTable(rank) {
  if (rank === 1) return { maezono: { hajime: 4, naru: 2, adam: 2, minto: 2 }, dr_kemuri: { hajime: 3, adam: 3, naru: 3, minto: 1 }, nagumo: { hajime: 10 } };
  if (rank === 3) return { maezono: { naru: 4, adam: 3, hajime: 2, minto: 1 }, dr_kemuri: { adam: 5, minto: 2, hajime: 2, naru: 1 }, nagumo: { naru: 10 } };
  return { maezono: { naru: 4, adam: 3, minto: 1, hajime: 2 }, dr_kemuri: { adam: 5, minto: 3, naru: 1, hajime: 1 }, nagumo: { naru: 10 } };
}
/** 中間票は、どの最終結果にも残る確定分だけ。未投入票は最終審査まで保留する。 */
export function interimPointTable(round) {
  return round === 1
    ? { maezono: { naru: 2, adam: 1, minto: 1, hajime: 1 }, dr_kemuri: {}, nagumo: {} }
    : round === 2
      ? { maezono: { naru: 2, adam: 2, minto: 1, hajime: 2 }, dr_kemuri: { adam: 3, minto: 1, naru: 1, hajime: 1 }, nagumo: {} }
      : { maezono: { naru: 2, adam: 2, minto: 1, hajime: 2 }, dr_kemuri: { adam: 3, minto: 1, naru: 1, hajime: 1 }, nagumo: {} };
}

const totals = (table, upto = JUDGES.length) => {
  const t = Object.fromEntries(CONTESTANTS.map((c) => [c, 0]));
  JUDGES.slice(0, upto).forEach((j) => { for (const [c, v] of Object.entries(table[j.id] || {})) t[c] += v; });
  return t;
};

const nameOf = (id) => (id === "hajime" ? "はじめ" : displayName(id, state));
const faceOf = (id, cls = "") => {
  const portrait = portraitInfo(id, "normal");
  const u = faceIconUrl(id) || portrait?.src;
  const fallback = el("span.face-fallback", { text: nameOf(id)[0], "aria-hidden": "true" });
  const root = el(`span.tournament-face${cls}`, [fallback]);
  if (u) {
    const img = el("img", { src: u, alt: "", decoding: "async" });
    img.addEventListener("load", () => root.classList.add("loaded"), { once: true });
    root.append(img);
    if (img.complete && img.naturalWidth) root.classList.add("loaded");
  }
  return root;
};
const ordered = (values) => CONTESTANTS.slice().sort((a, b) => values[b] - values[a]);
const rankOf = (id, values) => 1 + CONTESTANTS.filter(other => values[other] > values[id]).length;
const header = (eyebrow, title, sub, live = false) => el("header.tournament-heading", [
  el("span.tournament-eyebrow", [live ? el("i.tournament-live", { text: "LIVE" }) : null, eyebrow]),
  el("h1", { text: title }), el("p", { text: sub }),
]);

// ---------------------------------------------------------------- 中継グラフィックの部品
const JUDGE_IDS = JUDGES.map((j) => j.id);
const judgeName = (id) => JUDGES.find((j) => j.id === id)?.label || displayName(id, state);
const voteStack = (table, id, cls, upto) => stackOf(table, id, cls, JUDGE_IDS, upto);
const judgePanel = (table, held) => panelOf(table, JUDGE_IDS, { held, name: judgeName, face: (j) => faceOf(j, ".judge-face") });
const judgeLegend = () => legendOf(JUDGE_IDS);

// ---------------------------------------------------------------- 中間発表

/**
 * 暫定順位（R1〜R3の後）。確定分のみで集計する。はじめは序盤から上位で競っている。
 * @param round 1 | 2 | 3
 * @param mine  ここまでのはじめの出来（0〜100）
 */
export async function showStandings(round, mine, cs = null) {
  const owner = state;
  // 実際に投入された持ち点だけを順位にする。制作の出来と投票を混ぜない。
  const table = interimPointTable(round);
  const values = totals(table);
  const feed = round === 1
    ? [`${displayName("maezono", state)}、なるに2点・はじめに1点投入！`, "南雲審査員長、まだ動かず"]
    : round === 2
      ? ["チャコール博士、アダムに3点投入！", "南雲審査員長、10点まるまる温存"]
      : [`${displayName("maezono", state)}・チャコール博士は、残りの配点を見極めている`, "南雲審査員長、依然10点を温存"];
  const review = evaluationOf(mine);
  const recognition = craftRecognition(cs, { careRounds: Math.max(0, round - 2) });
  const next = el("button.btn.primary", { type: "button", dataset: { test: "standings-next" },
    style: { pointerEvents: "auto", marginLeft: "auto", minWidth: "96px", flexShrink: "0", alignItems: "center", justifyContent: "center" },
  }, [el("span.btn-label", { text: "次へ" })]);
  next.disabled = true;
  const board = el("div.standings.tournament-board", { dataset: { test: "standings", round }, role: "status" }, [
    header(`SMOKE CROWN CUP ／ ROUND ${round}`, "中間投票", "審査員3人の持ち点（各10点）。南雲審査員長は、まだ1点も入れていない。", true),
    el("div.sd-main", [
      el("div.sd-board", [
        judgeLegend(),
        el("div.sd-rows", ordered(values).map((id, i) => el(`div.sd-row${id === "hajime" ? ".me" : ""}`, { style: { "--i": String(i) }, dataset: { id, rank: String(rankOf(id, values)) } }, [
          el("span.sd-rank.rank-medal", { text: String(rankOf(id, values)) }),
          faceOf(id, ".sd-face"),
          el("span.sd-name", { text: nameOf(id) }),
          voteStack(table, id, "sd-bar"),
          el("b.sd-points", [String(values[id]), el("small", { text: "pt" })]),
        ]))),
      ]),
      judgePanel(table, ["nagumo"]),
    ]),
    el("div.sd-status", [el("span", { text: "ここまでの制作" }), el(`b.craft-evaluation.${review.tone}`, { text: review.mark }), el("span", { text: round === 3 ? "次は2回目の調整" : round === 2 ? "次は1回目の調整" : "次は吸い出し・提供" })]),
    recognition?.summary ? el("p.sd-recognition", { text: recognition.summary, dataset: { test: "standings-recognition" } }) : null,
    el("div.sd-feed", [el("b.sd-feed-tag", { text: "速報" }), el("div.sd-feed-lines", feed.map((t) => el("div", { text: t }))), next]),
  ]);
  const dim = el("div.fx-dim");
  layers.fx.append(dim, board);
  SE.crowd(1.6);
  // 速報は読了操作を待つ。会話のAUTO/SKIPとは独立し、自動送りは開発用の自動操作だけ。
  await new Promise((resolve, reject) => {
    const previousFocus = document.activeElement;
    let settled = false, closing = false, returnFocus = false, autoTimer, exitTimer;
    const current = () => state === owner && board.isConnected && dim.isConnected;
    const finish = (cancelled) => {
      if (settled) return;
      settled = true;
      const hadFocus = document.activeElement === next;
      next.disabled = true;
      clearTimeout(entranceTimer); clearTimeout(autoTimer); clearTimeout(exitTimer);
      next.removeEventListener("click", advance);
      observer.disconnect(); removeState();
      window.removeEventListener("pagehide", cancel);
      const restoreFocus = state === owner && previousFocus?.isConnected
        && (hadFocus || (returnFocus && document.activeElement === document.body));
      board.remove(); dim.remove();
      if (restoreFocus) previousFocus.focus({ preventScroll: true });
      if (cancelled) reject(new DOMException("Standings interrupted", "AbortError"));
      else resolve();
    };
    const cancel = () => finish(true);
    const advance = () => {
      if (next.disabled || closing) return;
      if (!current()) { cancel(); return; }
      closing = true;
      returnFocus = document.activeElement === next;
      next.disabled = true;
      SE.select();
      board.classList.add("out"); dim.classList.remove("show");
      exitTimer = setTimeout(() => finish(!current()), 400);
    };
    const observer = new MutationObserver(() => { if (!current()) cancel(); });
    observer.observe(document.body, { childList: true, subtree: true });
    const removeState = on("hud", () => { if (state !== owner) cancel(); });
    window.addEventListener("pagehide", cancel);
    next.addEventListener("click", advance);
    const entranceTimer = setTimeout(() => {
      if (!current()) { cancel(); return; }
      dim.classList.add("show"); board.classList.add("show");
      next.disabled = false;
      next.focus({ preventScroll: true });
      if (autoSkill()) autoTimer = setTimeout(() => next.click(), 300);
    }, 40);
  });
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
  const ring = el("div.rc-ring", { "aria-hidden": "true", html: '<svg viewBox="0 0 240 240"><circle class="rc-ring-track" cx="120" cy="120" r="110"/><circle class="rc-ring-progress" cx="120" cy="120" r="110"/></svg>' });
  const cuts = el("div.rc-cuts");
  const pray = el("div.rc-pray", CONTESTANTS.map((id) => el(`div.rc-card${id === "hajime" ? ".me" : ""}`, [
    faceOf(id, ".rc-face"),
    el("i.rc-shisha", { style: { background: id === "hajime" ? mixColor(cs.mix) : RIVAL_COLOR[id] } }),
    el("span", { text: nameOf(id) }),
  ])));
  const screen = el("div.count-screen", { dataset: { test: "result-count" } }, [header("SMOKE CROWN CUP / FINAL JUDGING", "結果発表", "最後の10点が、動く。"), cuts, ring, num, pray, el("div.rc-crt")]);
  showScreen("count", screen);
  const mainLeaf = Object.entries(cs.mix || {}).filter(([, g]) => Number.isFinite(g) && g > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
  const leafName = DB.flavorById?.[mainLeaf]?.short_name || DB.flavorById?.[mainLeaf]?.name || "葉";
  const cutWords = [
    "アルミ穴あけ", cs.heat?.flash ? "全面が赤い炭" : "炭の赤熱", cs.heat?.just ? "ジャスト炭" : "炭の熱", "立ちのぼる煙",
    `${leafName}の香り`, "審査員の目元", "会場のざわめき", "スミさんの背中", "tonariのカウンター",
  ];
  SE.drumroll(fast ? 0.5 : 5.5);
  for (let n = 10; n >= 0; n--) {
    num.textContent = String(n);
    ring.style.setProperty("--count", String(n / 10));
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
  const rows = CONTESTANTS.slice().sort((a, b) => before[b] - before[a]).map((id) => el(`div.nc-row${id === "hajime" ? ".me" : ""}`, { dataset: { id } }, [
    el("span.nc-rank.rank-medal", { text: String(rankOf(id, before)) }),
    faceOf(id, ".nc-face"), el("span.nc-name", { text: nameOf(id) }),
    voteStack(table, id, "nc-bar", 2),
    el("span.nc-pt", { text: `${before[id]}` }),
  ]));
  const bars = el("div.nc-bars", rows);
  const art = portraitInfo("nagumo", "serious")?.src;
  const cut = el("div.nc-cut", [
    el("span.nc-cut-art", art ? [el("img", { src: art, alt: "", decoding: "async" })] : [faceOf("nagumo", ".nc-cut-face")]),
    el("div.nc-cut-text", [el("small", { text: "審査員長" }), el("b", { text: "南雲修二" }),
      el("div.nc-cut-pt", [el("strong", { text: "10" }), el("span", { text: "持ち点10、一括投入" })])]),
  ]);
  const ov = el("div.nagumo-cut", [el("i.nc-rays", { "aria-hidden": "true" }),
    header("SMOKE CROWN CUP ／ FINAL VOTE", "南雲の10点", "もう一口、吸いたい一台へ。", true), bars, cut]);
  layers.fx.append(ov);
  const fast = !!autoSkill();
  await sleep(40);
  ov.classList.add("show");
  SE.crowd(2);
  await sleep(fast ? 100 : 1600);
  cut.classList.add("show");
  ov.classList.add("cutting");
  SE.just();
  flash("gold");
  await sleep(fast ? 100 : 1400);
  ov.classList.remove("cutting");
  // 南雲の色の帯だけが伸び、点数が数え上がる。
  for (const row of rows) {
    const id = row.dataset.id;
    const seg = row.querySelector('.nc-bar [data-judge="nagumo"]');
    seg.style.width = `${(table.nagumo[id] || 0) / VOTE_SCALE * 100}%`;
    if (table.nagumo[id]) row.classList.add("hit");
    countUp(row.querySelector(".nc-pt"), before[row.dataset.id], after[id], 900);
  }
  SE.fanfare();
  await sleep(fast ? 50 : 950);
  // 並べ替え（入れ替わりを、行が実際に動いて見せる）
  const top = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
  const order = CONTESTANTS.slice().sort((a, b) => after[b] - after[a]);
  order.forEach((id, i) => {
    const row = bars.querySelector(`[data-id="${id}"]`);
    row.style.order = String(i);
    row.querySelector(".nc-rank").textContent = String(rankOf(id, after));
    row.classList.toggle("lead", rankOf(id, after) === 1);
  });
  for (const row of rows) {
    const dy = top.get(row) - row.getBoundingClientRect().top;
    if (!dy || fast) continue;
    row.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  if (order[0] === "hajime") {
    // 南雲票の前から首位なら「確定」、追い抜いた時だけ「逆転」（#1282: 1位は票前から首位）
    ov.append(el("div.nc-stamp", { text: rankOf("hajime", before) === 1 ? "確定！" : "逆転！" }));
    SE.stamp();
  }
  await sleep(fast ? 100 : 1500);
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
    const order = ordered(t);
    const P = cs.parts || {};
    const table = pointTable(rank);
    const rows = order.map((id, i) => el(`div.rt-row${id === "hajime" ? ".me" : ""}`, { style: { "--i": String(3 - i) }, dataset: { id, rank: String(rankOf(id, t)) } }, [
      el("span.rt-rank.rank-medal", { text: `${rankOf(id, t)}位` }), faceOf(id, ".rt-face"),
      el("span.rt-name", [nameOf(id), el("small.rt-votes", { text: `上園 ${table.maezono[id] || 0} · 博士 ${table.dr_kemuri[id] || 0} · 南雲 ${table.nagumo[id] || 0}` })]),
      voteStack(table, id, "rt-bar"), el("span.rt-pt", { text: `${t[id]} pt` }),
    ]));
    const evaluation = (score) => {
      const review = evaluationOf(score || 0);
      return el(`b.craft-evaluation.${review.tone}`, { text: review.mark, "aria-label": review.label });
    };
    const detail = el("div.rt-detail", [
      el("h4", { text: "あなたの一台" }),
      Number.isFinite(cs.pull?.temp) && !cs.pull.failed ? actualExpressionCard(cs, cs.pull.temp) : null,
      ...[["穴あけ", P.holes], ["炭焼き", P.heat], ["完成品", P.shisha], ["調整1回目", P.care1], ["調整2回目", P.care2]]
        .filter(([k]) => !(k === "穴あけ" && cs.foilSkipped)).map(([k, v]) =>
        el("div.rt-part", [el("span", { text: k }), evaluation(v), el("small", { text: evaluationOf(v || 0).label })])),
      el("div.rt-part.total", [el("span", { text: "総合" }), evaluation(cs.total)]),
      el("small.rt-judge-comment", { text: `上園「${judgeComment(cs)}」` }),
      cs.bonusNotes?.length ? el("small", { text: `効いたもの: ${cs.bonusNotes.join("・")}` }) : null,
      goodPointOf(cs) ? el("small.rt-good-point", { text: goodPointOf(cs), dataset: { test: "result-good-point" } }) : null,
      el("small.rt-next-tip", { text: improvementOf(cs) }),
    ]);
    const btn = el("button.btn.primary", { dataset: { test: "result-next" }, onclick: () => { SE.select(); retireScreen(); resolve(); } }, [
      el("span.btn-label", { text: rank === 1 ? "表彰のあとへ" : "……結果を受け止める" }),
    ]);
    const screen = el("div.result-table", { dataset: { test: "tournament-result", rank } }, [
      el("i.rt-rays", { "aria-hidden": "true" }),
      el("div.rt-hero", [
        el("span.rt-emblem", { "aria-hidden": "true", dataset: { rank } }, [el("b", { text: rank === 1 ? "1" : String(rank) }), el("small", { text: rank === 1 ? "ST" : "TH" })]),
        header("SMOKE CROWN CUP ／ FINAL RESULT", rank === 1 ? "CHAMPION" : `${rank}位`, rank === 1 ? "蒸野 はじめ · 次の舞台へ" : "この一台の記録を、次の挑戦へ。"),
      ]),
      el("div.rt-layout", [el("section.rt-ranking", [el("div.rt-ranking-head", [el("h2", { text: "最終順位 · 審査員の持ち点" }), judgeLegend()]), el("div.rt-rows", rows)]), detail]), btn,
    ]);
    showScreen("result", screen);
    if (rank === 1) {
      SE.fanfare();
      // 紙吹雪は画面の枠の中だけで降らせる（下へ抜けた分でスクロールを作らない）。
      const sky = el("div.rt-confetti", { "aria-hidden": "true" });
      screen.append(sky);
      confetti(sky);
    }
    if (autoSkill()) setTimeout(() => btn.click(), 150);
  });
}

