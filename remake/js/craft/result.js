import { resultSaveButton } from "./result-save.js";
import { improvementOf, goodPointOf } from "./advice.js";
import { actualExpressionCard } from "./flavor-guide.js";
// 大会の発表まわり: 中間発表／RESULT 10 COUNT（プチュン=1位確定・パリン=敗北）／
// 千須の持ち点一括投入カットイン／最終順位表。master_spec 第2部 §4〜5・story ch1【転】
import { el, sleep, rand } from "../core/util.js";
import { DB, faceIconUrl, displayName, portraitInfo } from "../core/data.js";
import { layers, showScreen, flash, shake, retireScreen } from "../core/ui.js";
import { state } from "../core/state.js";
import { on } from "../core/bus.js";
import { SE, stopBgm } from "../core/audio.js";
import { autoSkill, craftRankThresholds } from "./common.js";
import { renewalCraft } from "../core/craft-version.js";
import { craftRankProgress } from "./rank-hud.js";
import { mixColor } from "./art.js";
import { SUI_BAR } from "./score.js";
import { castCh1Votes, isSakuraiVotes, SAKURAI, sakuraiFocusOf, ch1RoundPoints } from "./ch1-votes.js";
import { evaluationOf, judgeComment, judgeDeductionReason } from "./feedback.js";
import { craftRecognition } from "./recognition.js";
import { VOTE_SCALE, voteStack as stackOf, judgePanel as panelOf, judgeLegend as legendOf, countUp, JUDGE_LOOK } from "./tournament-graphics.js";
import { stageLights, voteCeremony, showSting, showConfetti, sparkBurst, haloOf, crestSvg, metalOf, bustOf, flyToken,
  localPoint, holdOrTap, showMoves } from "./tournament-show.js";

export const CONTESTANTS = ["naru", "adam", "minto", "hajime"];
const RIVAL_COLOR = { naru: "#f0d8a0", adam: "#c9463a", minto: "#7fe0c2" };
const JUDGES = [
  { id: "maezono" },
  { id: "dr_kemuri", label: "チャコール博士" },
  { id: "sui", label: "千須" },
];

/** 総合スコア → 結末。1位は千須票（基準超え）だけが生む（ch1の正史） */
export function outcomeOf(total) {
  if (total >= SUI_BAR) return { rank: 1, kind: total >= 90 ? "premium" : "win" };
  if (total >= SUI_BAR - 12) return { rank: 3, kind: "close" };
  return { rank: 4, kind: total < 38 ? "disaster" : "lose" };
}

/** 審査員の持ち点（各10点）の最終配分。はじめは上園・博士からも点が入り上位で競り、千須の10点は「最後の一票」として締める（#1282 逆転優勝の廃止、オーナー決定 2026-10-28） */
export function pointTable(rank) {
  if (rank === 1) return { maezono: { hajime: 4, naru: 2, adam: 2, minto: 2 }, dr_kemuri: { hajime: 3, adam: 3, naru: 3, minto: 1 }, sui: { hajime: 10 } };
  if (rank === 3) return { maezono: { naru: 4, adam: 3, hajime: 2, minto: 1 }, dr_kemuri: { adam: 5, minto: 2, hajime: 2, naru: 1 }, sui: { naru: 10 } };
  return { maezono: { naru: 4, adam: 3, minto: 1, hajime: 2 }, dr_kemuri: { adam: 5, minto: 3, naru: 1, hajime: 1 }, sui: { naru: 10 } };
}
/** 中間票は、どの最終結果にも残る確定分だけ。未投入票は最終審査まで保留する。 */
export function interimPointTable(round) {
  return round === 1
    ? { maezono: { naru: 2, adam: 1, minto: 1, hajime: 1 }, dr_kemuri: {}, sui: {} }
    : round === 2
      ? { maezono: { naru: 2, adam: 2, minto: 1, hajime: 2 }, dr_kemuri: { adam: 3, minto: 1, naru: 1, hajime: 1 }, sui: {} }
      : { maezono: { naru: 2, adam: 2, minto: 1, hajime: 2 }, dr_kemuri: { adam: 3, minto: 1, naru: 1, hajime: 1 }, sui: {} };
}

const totals = (table, upto = JUDGES.length, baseVotes = null) => {
  const t = Object.fromEntries(CONTESTANTS.map((c) => [c, baseVotes?.[c] || 0]));
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

/** 会話の中継の枠に出す、いまの順位（確定済みの票を読むだけ。票の無い旧試合は空）。 */
export function ch1LiveStandings(attempt) {
  const p = attempt?.rulesVersion >= 2 ? attempt.voteAttempt : null;
  if (!p?.votes || !p.voted) return [];
  const values = totals(p.votes, JUDGES.length, p.baseVotes);
  return ordered(values).map((id) => ({ id, rank: rankOf(id, values), points: values[id], me: id === "hajime", face: faceIconUrl(id) }));
}

// ---------------------------------------------------------------- 中継グラフィックの部品
const JUDGE_IDS = JUDGES.map((j) => j.id);
const judgeName = (id) => JUDGES.find((j) => j.id === id)?.label || displayName(id, state);
const voteStack = (table, id, cls, upto) => stackOf(table, id, cls, JUDGE_IDS, upto);
const judgePanel = (table, held, extra = null) => panelOf(table, JUDGE_IDS, { held, name: judgeName, face: (j) => faceOf(j, ".judge-face"), extra });
const judgeLegend = () => legendOf(JUDGE_IDS);

// ---------------------------------------------------------------- 中間発表

/**
 * 暫定順位（R1〜R3の後）。確定分のみで集計する。はじめは序盤から上位で競っている。
 * @param round 1 | 2 | 3
 * @param mine  ここまでのはじめの出来（0〜100）
 */
export async function showStandings(round, mine, cs = null, attempt = null) {
  const owner = state;
  // 票が入る演出の出発点（この回の票を入れる前）。この回の票がすでに確定していれば、前後は同じになる。
  const beforeTable = attempt?.rulesVersion >= 2 ? structuredClone(attempt.voteAttempt?.votes || {}) : round > 1 ? interimPointTable(round - 1) : {};
  // 審査員の投入票と、新規試合だけにある基礎票を集計する。
  if (attempt?.rulesVersion >= 2) castCh1Votes(attempt, round - 1, cs);
  const table = attempt?.rulesVersion >= 2 ? attempt.voteAttempt.votes : interimPointTable(round);
  const values = totals(table, JUDGES.length, attempt?.voteAttempt?.baseVotes);
  const valuesBefore = totals(beforeTable, JUDGES.length, attempt?.voteAttempt?.baseVotes);
  const feed = attempt?.rulesVersion >= 2 ? ["3人の審査員が、ここまでの工程に投票", `千須審査員長も${round}回目の配点を投入`] : round === 1
    ? [`${displayName("maezono", state)}、なるに2点・はじめに1点投入！`, "千須審査員長、まだ動かず"]
    : round === 2
      ? ["チャコール博士、アダムに3点投入！", "千須審査員長、10点まるまる温存"]
      : [`${displayName("maezono", state)}・チャコール博士は、残りの配点を見極めている`, "千須審査員長、依然10点を温存"];
  const sakurai = attempt?.voteAttempt && isSakuraiVotes(attempt.voteAttempt) ? sakuraiBoard(attempt.voteAttempt, round - 1) : null;
  const review = evaluationOf(mine);
  const recognition = craftRecognition(cs, { careRounds: Math.max(0, round - 2) });
  const next = el("button.btn.primary", { type: "button", dataset: { test: "standings-next" },
    style: { pointerEvents: "auto", marginLeft: "auto", minWidth: "96px", flexShrink: "0", alignItems: "center", justifyContent: "center" },
  }, [el("span.btn-label", { text: "次へ" })]);
  next.disabled = true;
  const board = el("div.standings.tournament-board", { dataset: { test: "standings", round }, role: "status" }, [
    el("i.ts-board-glow", { "aria-hidden": "true" }), el("b.ts-round-mark", { "aria-hidden": "true" }, [el("small", { text: "ROUND" }), String(round)]),
    header(`SMOKE CROWN CUP ／ ROUND ${round}`, "中間投票", sakurai ? sakurai.sub : attempt?.voteAttempt?.baseVotes
      ? "審査員3人が各10点を工程ごとに配分 · 全員に基礎票1点"
      : attempt?.rulesVersion >= 2 ? "審査員3人が各10点を工程ごとに配分。千須は最後の1点を調整後に投じる。"
        : "審査員3人の持ち点（各10点）。千須審査員長は、まだ1点も入れていない。", true),
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
      judgePanel(table, attempt?.rulesVersion >= 2 ? [] : ["sui"], sakurai?.extra),
    ]),
    el("div.sd-status.ts-vote-late", [el("span", { text: "ここまでの制作" }), el(`b.craft-evaluation.${review.tone}`, { text: review.mark }), el("span", { text: round === 3 ? "次は2回目の調整" : round === 2 ? "次は1回目の調整" : "次は吸い出し・提供" })]),
    recognition?.summary ? el("p.sd-recognition.ts-vote-late", { text: recognition.summary, dataset: { test: "standings-recognition" } }) : null,
    el("div.sd-feed", [el("b.sd-feed-tag", { text: "速報" }), el("div.sd-feed-lines.ts-vote-late", (sakurai ? sakurai.feed : feed).map((t) => el("div", { text: t }))), next]),
  ]);
  const dim = el("div.fx-dim.ts-show-dim");
  stageLights(dim, { beams: 5, dust: 26 });
  layers.fx.append(dim, board);
  // 票が入る瞬間（TSH02）。板は入れた後の値で組んであり、ここで入れる前へ戻してから審査員ごとに票を飛ばす。板を押すと早送り。
  const ranked = (v) => ordered(v).map((id) => ({ id, rank: rankOf(id, v) }));
  const ceremony = voteCeremony({
    host: board, judges: JUDGE_IDS, contestants: CONTESTANTS, before: beforeTable, after: table,
    base: attempt?.voteAttempt?.baseVotes || {}, rankBefore: ranked(valuesBefore), rankAfter: ranked(values),
    rowOf: (id) => board.querySelector(`.sd-row[data-id="${id}"]`), pointsOf: (row) => row.querySelector(".sd-points"),
    medalOf: (row) => row.querySelector(".sd-rank"), chipOf: (judge) => board.querySelector(`.judge-chip[data-judge="${judge}"]`),
    held: attempt?.rulesVersion >= 2 ? [] : ["sui"],
    onJudge: (judge, chip) => chip?.querySelectorAll(".ts-wait").forEach((node) => node.classList.remove("ts-wait")),
    lead: 1000,
  });
  if (ceremony.moved) { SE.whoosh(); showSting(layers.fx, { eyebrow: `ROUND ${round}`, title: "JUDGES' VOTE", sub: "審査員の票が入ります", ms: 720 }); }
  else SE.crowd(1.6);
  const skipCeremony = (event) => {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    if (board.dataset.ceremony !== "running") return;
    if (event.type === "keydown") { event.preventDefault(); event.stopPropagation(); }
    ceremony.skip();
  };
  // click で受ける（pointerdown で早送りすると、続く mousedown の既定動作で「次へ」のフォーカスが外れる）。
  board.addEventListener("click", skipCeremony);
  window.addEventListener("keydown", skipCeremony, true);
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
      ceremony.skip();
      window.removeEventListener("keydown", skipCeremony, true);
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
    let entered = () => {};
    const shown = new Promise((ready) => { entered = ready; });
    const entranceTimer = setTimeout(() => {
      if (!current()) { cancel(); return; }
      dim.classList.add("show"); board.classList.add("show");
      entered();
    }, 40);
    // 「次へ」は板が出て、票が出そろってから押せる（早送りした時はその場で）。
    Promise.all([ceremony.done, shown]).then(() => {
      if (settled) return;
      if (!current()) { cancel(); return; }
      window.removeEventListener("keydown", skipCeremony, true);
      if (ceremony.moved) {
        SE.crowd(1.6);
        const lead = board.querySelector('.sd-row[data-rank="1"]');
        if (lead) { const at = localPoint(board, lead, 0.08, 0.5); sparkBurst(board, at.x, at.y, { count: 12, spread: 70 }); }
      }
      next.disabled = false;
      next.focus({ preventScroll: true });
      if (autoSkill()) autoTimer = setTimeout(() => next.click(), 300);
    }, () => { if (!settled) cancel(); });
  });
}

/**
 * 桜井式（SKR04）の途中経過: その回だけで決まったこと・審査員ごとの見る所と入れ先・はじめの評価・次の回の見どころ。
 * @param index 0〜2（投票した回。0＝準備）
 */
function sakuraiBoard(p, index) {
  const info = SAKURAI.rounds[index], next = SAKURAI.rounds[index + 1];
  const points = ch1RoundPoints("maezono", index);
  const views = p.views?.[index] || {}, picks = p.picks?.[index] || {};
  // 速報の行は凡例と同じ短い呼び名（上園・博士・千須）にそろえる。
  const short = (id) => JUDGE_LOOK[id]?.short || judgeName(id);
  const mine = JUDGES.map(({ id }) => `${short(id)} ${Number(views[id]?.hajime ?? 0).toFixed(1)}`).join(" ／ ");
  const nextNote = index === 0 ? `次は提供の一台。${Object.entries(SAKURAI.focus).map(([id, f]) => `${short(id)}は${f.label}`).join("・")}を見る`
    : index === 1 ? "次は1回目の調整。温度計の攻めの帯で整え終えると、審査が伸びる"
      : "次は2回目の調整。なるは崩れず、最後はみんとが攻めてくる";
  return {
    sub: `この回は${info.parts}だけで決まる · ${points === 2 ? "1位も2位も1票" : "1位に2票・2位に1票"} · 全員に基礎票1点`,
    feed: [`はじめの評価（この回）: ${mine}${p.attacks?.[index] ? `（攻めの帯 +${SAKURAI.attackBonus}）` : ""}`, next ? nextNote : ""].filter(Boolean),
    extra: (judge) => {
      const pick = picks[judge];
      return [
        el("small.judge-focus", { text: `見る所：${sakuraiFocusOf(judge, index)}`, dataset: { test: "judge-focus", judge } }),
        pick ? el("small.judge-pick.ts-vote-late", { text: `→ ${nameOf(pick.first)}${pick.points[pick.first]}・${nameOf(pick.second)}1`, dataset: { test: "judge-pick", judge } }) : null,
      ].filter(Boolean);
    },
  };
}

// ---------------------------------------------------------------- RESULT 10 COUNT

/**
 * 10→0 のカウントと、順位に応じた終わり方。
 * kind: premium（残り2〜3でフライングプチュン）/ win（0でプチュン）/ close（プチュ…→パリン）/ lose（即パリン）/ disaster（ヒビ→バキン）
 * カウント中の画面はクリックを吸わない（自動で進む）
 */
export async function resultCountdown(cs, kind, attempt = null) {
  stopBgm(0.4);
  const fast = !!autoSkill();
  const tick = fast ? 60 : 620;
  const num = el("div.rc-num");
  const ring = el("div.rc-ring", { "aria-hidden": "true", html: '<svg viewBox="0 0 240 240"><circle class="rc-ring-track" cx="120" cy="120" r="110"/><circle class="rc-ring-progress" cx="120" cy="120" r="110"/></svg>' });
  const cuts = el("div.rc-cuts");
  // 出場者4人を、カウントの左右に2人ずつ立たせる（TSH03）。数字が進むたびに光が1人ずつ巡る。
  const cards = CONTESTANTS.map((id) => el(`div.rc-card${id === "hajime" ? ".me" : ""}`, { dataset: { id } }, [
    bustOf(id, { cls: ".rc-bust", face: "serious", name: nameOf(id) }),
    el("i.rc-shisha", { style: { background: id === "hajime" ? mixColor(cs.mix) : RIVAL_COLOR[id] } }),
    el("span", { text: nameOf(id) }),
  ]));
  const pray = el("div.rc-pray", cards);
  const screen = el("div.count-screen.ts-count", { dataset: { test: "result-count" } }, [header("SMOKE CROWN CUP / FINAL JUDGING", "結果発表", attempt?.rulesVersion >= 2 ? "最後の調整と、残る1点の行方。" : "最後の10点が、動く。"), cuts, el("i.rc-pulse", { "aria-hidden": "true" }), ring, num, pray, el("i.rc-heart", { "aria-hidden": "true" }), el("div.rc-crt")]);
  stageLights(screen, { beams: 4, dust: 18, tone: "cool" });
  showScreen("count", screen);
  // 光の巡り: はじめで終わる順（残り1〜0は全員を照らす）。
  const spotOrder = [0, 2, 1, 3];
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
    screen.dataset.count = String(n);
    cards.forEach((card, k) => card.classList.toggle("spot", n <= 1 || spotOrder[(10 - n) % 4] === k));
    SE.count();
    if (n <= 4) SE.heartbeat();
    if (n > 0 && n <= 9) {
      // 出現位置は見出し帯（上部34px〜約125px＝約17%）を避ける。12%からだと見出しに重なる（#3558 項目6）
      // 出す場所は、見出し（上部〜約20%）・出場者のカード（約31〜77%）・中央の輪を避けた2本の帯だけ（TSH09）。
      // 上の帯＝見出しの右・カードの上、下の帯＝カードの下の床。交互に使う。
      const above = n % 2 === 0;
      const c = el("div.rc-cut", { text: cutWords[(10 - n) % cutWords.length], style: above
        ? { left: `${rand(50, 72)}%`, top: `${rand(21, 23)}%`, "--r": `${rand(-4, 4)}deg` }
        : { left: `${rand(6, 70)}%`, top: `${rand(81, 85)}%`, "--r": `${rand(-6, 6)}deg` } });
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

// ---------------------------------------------------------------- 千須カットイン（持ち点の一括投入）

export async function suiCutin(rank, attempt = null) {
  const modern = attempt?.rulesVersion >= 2;
  const table = modern ? attempt.voteAttempt.votes : pointTable(rank);
  const base = modern ? attempt.voteAttempt.baseVotes : null;
  // 新規試合は、最後の回（2回目の調整）の票がまだ画面に出ていない。3人の票 → 千須の最後の1点、の順に見せる（TSH03）。
  const last = modern ? attempt.voteAttempt.finalVotes : null;
  const opening = last ? Object.fromEntries(JUDGE_IDS.map((j) => [j, Object.fromEntries(CONTESTANTS.map((id) => [id, (table[j]?.[id] || 0) - (last[j]?.[id] || 0)]))])) : null;
  const beforeTable = modern ? attempt.voteAttempt.beforeLast : table;
  const before = modern ? totals(beforeTable, JUDGES.length, base) : totals(table, 2);
  const after = totals(table, JUDGES.length, base);
  const openingTotals = opening ? totals(opening, JUDGES.length, base) : before;
  const rows = CONTESTANTS.slice().sort((a, b) => before[b] - before[a]).map((id) => el(`div.nc-row${id === "hajime" ? ".me" : ""}`, { dataset: { id } }, [
    el("span.nc-rank.rank-medal", { text: String(rankOf(id, before)) }),
    faceOf(id, ".nc-face"), el("span.nc-name", { text: nameOf(id) }),
    voteStack(beforeTable, id, "nc-bar", modern ? 3 : 2),
    el("span.nc-pt", { text: `${before[id]}` }),
  ]));
  const bars = el("div.nc-bars", rows);
  const art = portraitInfo("sui", "serious")?.src;
  const cut = el("div.nc-cut", [
    el("span.nc-cut-art", art ? [el("img", { src: art, alt: "", decoding: "async" })] : [faceOf("sui", ".nc-cut-face")]),
    el("div.nc-cut-text", [el("small", { text: "審査員長" }), el("b", { text: "千須豪" }),
      el("div.nc-cut-pt", [el("strong", { text: modern ? "1" : "10" }), el("span", { text: modern ? "もう一口に、残る1点" : "持ち点10、一括投入" })])]),
  ]);
  const ov = el("div.sui-cut.ts-final", { dataset: { test: "final-vote" } }, [el("i.nc-rays", { "aria-hidden": "true" }),
    header("SMOKE CROWN CUP ／ FINAL VOTE", modern ? "千須の最後の1点" : "千須の10点", "もう一口、吸いたい一台へ。", true), bars, cut]);
  stageLights(ov, { beams: 3, dust: 20 });
  layers.fx.append(ov);
  // 押すと、残りの間を詰めて先へ進む（自動で進む画面だが、待たされないように）。
  let hurry = !!autoSkill(), ceremony = null;
  const hurryUp = () => { hurry = true; ceremony?.skip(); };
  ov.addEventListener("pointerdown", hurryUp);
  const pause = (ms) => sleep(hurry ? Math.min(ms, 90) : ms);
  const ranked = (v) => CONTESTANTS.slice().sort((a, b) => v[b] - v[a]).map((id) => ({ id, rank: rankOf(id, v) }));
  const rowOf = (id) => bars.querySelector(`[data-id="${id}"]`);
  // 3人の最後の回の票（千須の最後の1点は残す）。この画面には審査員の札が無いので、右に3人の札を出して、そこから票を飛ばす。
  const callers = el("div.nc-callers", { "aria-hidden": "true" }, JUDGE_IDS.map((judge) => el("span.judge-chip.nc-caller", { dataset: { judge }, style: { "--c": JUDGE_LOOK[judge]?.color || "#f6c95e" } }, [
    faceOf(judge, ".judge-face"), el("b", { text: JUDGE_LOOK[judge]?.short || judgeName(judge) }), el("i.judge-pips")])));
  if (opening && showMoves()) ov.append(callers);
  ceremony = opening ? voteCeremony({
    host: ov, judges: JUDGE_IDS, contestants: CONTESTANTS, before: opening, after: beforeTable, base: base || {},
    rankBefore: ranked(openingTotals), rankAfter: ranked(before),
    rowOf, pointsOf: (row) => row.querySelector(".nc-pt"), medalOf: (row) => row.querySelector(".nc-rank"),
    chipOf: (judge) => callers.querySelector(`[data-judge="${judge}"]`), lead: 900,
  }) : null;
  if (!ceremony?.moved) callers.remove();
  await sleep(40);
  ov.classList.add("show");
  SE.crowd(2);
  if (ceremony?.moved) {
    showSting(ov, { eyebrow: "FINAL ROUND", title: "LAST VOTE", sub: "最後の票が入ります", ms: 700 });
    await ceremony.done;
    callers.classList.add("out");
    await pause(500);
  } else await pause(1600);
  cut.classList.add("show");
  ov.classList.add("cutting");
  SE.just();
  flash("gold");
  await pause(1400);
  ov.classList.remove("cutting");
  // 千須の色の帯だけが伸び、点数が数え上がる。票の粒は名前の札から飛ぶ。
  const from = cut.querySelector(".nc-cut-pt strong") || cut;
  for (const row of rows) {
    const id = row.dataset.id, gained = (table.sui[id] || 0) - (modern ? beforeTable.sui[id] || 0 : 0);
    const seg = row.querySelector('.nc-bar [data-judge="sui"]');
    const land = () => {
      seg.style.width = `${(table.sui[id] || 0) / VOTE_SCALE * 100}%`;
      if (table.sui[id]) row.classList.add("hit");
      countUp(row.querySelector(".nc-pt"), before[id], after[id], hurry ? 0 : 900);
      if (gained > 0) { const at = localPoint(ov, row.querySelector(".nc-pt")); sparkBurst(ov, at.x, at.y, { count: 22, spread: 120 }); }
    };
    if (gained > 0 && showMoves() && !hurry) {
      for (let n = 0; n < Math.min(gained, 10); n++) flyToken(ov, from, seg.parentElement, { color: JUDGE_LOOK.sui.color, delay: n * 70, ms: 620, arc: 120 });
      setTimeout(land, 560);
    } else land();
  }
  await pause(560);
  SE.fanfare();
  await pause(950);
  // 並べ替え（入れ替わりを、行が実際に動いて見せる）
  const top = new Map(rows.map((r) => [r, r.getBoundingClientRect().top]));
  const order = CONTESTANTS.slice().sort((a, b) => after[b] - after[a]);
  order.forEach((id, i) => {
    const row = bars.querySelector(`[data-id="${id}"]`);
    row.style.order = String(i);
    row.dataset.rank = String(rankOf(id, after));
    row.querySelector(".nc-rank").textContent = String(rankOf(id, after));
    row.classList.toggle("lead", rankOf(id, after) === 1);
  });
  for (const row of rows) {
    const dy = top.get(row) - row.getBoundingClientRect().top;
    if (!dy || hurry) continue;
    row.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 700, easing: "cubic-bezier(.2,.8,.2,1)" });
  }
  if (order[0] === "hajime") {
    // 千須票の前から首位なら「確定」、追い抜いた時だけ「逆転」（#1282: 1位は票前から首位）
    ov.append(el("div.nc-stamp", { text: modern ? "集計！" : rankOf("hajime", before) === 1 ? "確定！" : "逆転！" }));
    SE.stamp();
  }
  await pause(1500);
  if (rank === 1) showConfetti(ov, { count: 120 });
  await pause(1600);
  ov.removeEventListener("pointerdown", hurryUp);
  ov.classList.add("out");
  await sleep(400);
  ov.remove();
}

// ---------------------------------------------------------------- 最終順位表

export function resultTable(cs, rank, attempt = null) {
  return new Promise((resolve) => {
    const table = attempt?.rulesVersion >= 2 ? attempt.voteAttempt.votes : pointTable(rank);
    const baseVotes = attempt?.voteAttempt?.baseVotes;
    const t = totals(table, JUDGES.length, baseVotes);
    const order = attempt?.rulesVersion >= 2 ? attempt.voteAttempt.result.rows.map(row => row.id) : ordered(t);
    const P = cs.parts || {};
    const rows = order.map((id, i) => el(`div.rt-row${id === "hajime" ? ".me" : ""}`, { style: { "--i": String(3 - i) }, dataset: { id, rank: String(attempt?.rulesVersion >= 2 ? i + 1 : rankOf(id, t)) } }, [
      el("span.rt-rank.rank-medal", { text: `${attempt?.rulesVersion >= 2 ? i + 1 : rankOf(id, t)}位` }), faceOf(id, ".rt-face"),
      el("span.rt-name", [nameOf(id), el("small.rt-votes", { text: `上園 ${table.maezono[id] || 0} · 博士 ${table.dr_kemuri[id] || 0} · 千須 ${table.sui[id] || 0}${baseVotes?.[id] ? ` · 基礎 ${baseVotes[id]}` : ""}` })]),
      voteStack(table, id, "rt-bar"), el("span.rt-pt", { text: `${t[id]} pt` }),
    ]));
    const evaluation = (score) => {
      const review = evaluationOf(score || 0);
      return el(`b.craft-evaluation.${review.tone}`, { text: review.mark, "aria-label": review.label });
    };
    const detail = el("div.rt-detail", [el("div.rt-detail-scroll", {
      tabindex: "0", role: "region", "aria-label": "あなたの一台の評価",
    }, [
      el("h4", { text: "あなたの一台" }),
      Number.isFinite(cs.pull?.temp) && !cs.pull.failed ? actualExpressionCard(cs, cs.pull.temp) : null,
      ...[["穴あけ", P.holes], ["炭焼き", P.heat], ["完成品", P.shisha], ["調整1回目", P.care1], ["調整2回目", P.care2]]
        .filter(([k]) => !(k === "穴あけ" && cs.foilSkipped)).map(([k, v]) =>
        el("div.rt-part", [el("span", { text: k }), evaluation(v), el("small", { text: evaluationOf(v || 0).label })])),
      // 完成品の中身（P7）。攻めた構成（4点置き・詰め方など）の見返り（煙・味）と代償（焦げやすさ）が読めるように
      cs.stats && renewalCraft(cs) ? el("small.rt-shisha-stats", { dataset: { test: "result-shisha-stats" }, text: `完成品の中身：煙${cs.stats.smoke}・吸い心地の軽さ${cs.stats.draw}・熱の安定${cs.stats.heatStability}・香り${cs.stats.aroma}・味の濃さ${cs.stats.taste}・持ち${cs.stats.duration}・焦げやすさ${cs.stats.burnRisk}` }) : null,
      el("div.rt-part.total", [el("span", { text: "総合" }), evaluation(cs.total), el("b", { text: craftRankProgress(cs.total, craftRankThresholds(cs)).grade, dataset: { test: "craft-final-rank" }, "aria-label": "制作ランク" })]),
      // 学びに当たる項目（次に変える一つ・今回よかったこと）は審査員の講評より先に置き、枠が収まらなくても最初から見える（#3554）。
      goodPointOf(cs) ? el("small.rt-good-point", { text: goodPointOf(cs), dataset: { test: "result-good-point" } }) : null,
      el("small.rt-next-tip", { text: improvementOf(cs) }),
      cs.bonusNotes?.length ? el("small", { text: `効いたもの: ${cs.bonusNotes.join("・")}` }) : null,
      el("small.rt-judge-comment", { text: `上園「${judgeComment(cs)}」` }),
      el("div.rt-deductions", JUDGES.map(judge => el("small.rt-judge-deduction", { text: `${judgeName(judge.id)}：${judgeDeductionReason(cs, judge.id).text}`, dataset: { judge: judge.id } }))),
      resultSaveButton(cs),
    ])]);
    const btn = el("button.btn.primary", { dataset: { test: "result-next" }, onclick: () => { SE.select(); retireScreen(); resolve(); } }, [
      el("span.btn-label", { text: rank === 1 ? "表彰のあとへ" : "……結果を受け止める" }),
    ]);
    const screen = el("div.result-table", { dataset: { test: "tournament-result", rank } }, [
      el("i.rt-rays", { "aria-hidden": "true" }),
      el("div.rt-hero", [
        el("span.rt-emblem", { "aria-hidden": "true", dataset: { rank } }, [el("b", { text: rank === 1 ? "1" : String(rank) }), el("small", { text: rank === 1 ? "ST" : "TH" })]),
        header("SMOKE CROWN CUP ／ FINAL RESULT", rank === 1 ? "CHAMPION" : `${rank}位`, rank === 1 ? "逢縁 はじめ · 次の舞台へ" : "この一台の記録を、次の挑戦へ。"),
      ]),
      el("div.rt-layout", [el("section.rt-ranking", [el("div.rt-ranking-head", [el("h2", { text: "最終順位 · 審査員の持ち点" }), judgeLegend()]), el("div.rt-rows", rows)]), detail]), btn,
    ]);
    stageLights(screen, { beams: rank === 1 ? 4 : 2, dust: rank === 1 ? 24 : 10, tone: rank === 1 ? "gold" : "cool" });
    showScreen("result", screen);
    // 順位表の前に、結果の大見出し（優勝は冠・光・紙吹雪。TSH03）。押すとすぐ順位表へ。
    resultSplash(rank).then(() => {
      if (!screen.isConnected) return;
      screen.classList.add("ts-revealed");
      if (rank === 1) {
        // 紙吹雪は画面の枠の中だけで降らせる（下へ抜けた分でスクロールを作らない）。
        const sky = el("div.rt-confetti", { "aria-hidden": "true" });
        screen.append(sky);
        showConfetti(sky, { count: 90 });
      }
    });
    if (autoSkill()) setTimeout(() => btn.click(), 150);
  });
}

/**
 * 結果の大見出し。1位は「CHAMPION」（冠と月桂冠・後光・紙吹雪・はじめの立ち絵）、それ以外は順位だけを静かに出す。
 * 動きを見せない時（自動操作・動きを減らす）は何も出さない。押すと閉じる。
 */
async function resultSplash(rank) {
  if (!showMoves()) return;
  const win = rank === 1, metal = metalOf(rank);
  // 優勝は冠と月桂冠に「1 ST」。届かなかった時は月桂冠だけを順位の後ろに薄く敷く。
  const crest = crestSvg({ metal, crown: win });
  if (win) crest.append(el("b", { text: "1" }), el("small", { text: "ST" }));
  const node = el(`div.ts-splash${win ? ".win" : ""}`, { dataset: { test: "result-splash", rank, metal }, tabindex: "-1", role: "status",
    "aria-label": win ? "優勝" : `${rank}位` }, [
    win ? haloOf() : null,
    el("i.ts-splash-floor", { "aria-hidden": "true" }),
    bustOf("hajime", { cls: ".ts-splash-bust", face: win ? "smile" : "serious", zoom: 1.5, headTop: 0.06, name: "はじめ" }),
    el("div.ts-splash-copy", [
      crest,
      el("small.ts-splash-eyebrow", { text: "SMOKE CROWN CUP ／ FINAL RESULT" }),
      el("h2", { text: win ? "CHAMPION" : `${rank}位` }),
      el("p", { text: win ? "逢縁 はじめ" : "この一台の記録を、次の挑戦へ。" }),
    ]),
    el("span.ts-splash-tap", { text: "タップで順位表へ" }),
  ]);
  stageLights(node, { beams: win ? 5 : 2, dust: win ? 30 : 8, tone: win ? "gold" : "cool" });
  layers.fx.append(node);
  await sleep(30);
  node.classList.add("show");
  node.focus({ preventScroll: true });
  if (win) { SE.fanfare(); SE.crowd(2.6); showConfetti(node, { count: 150, ms: 5200 }); flash("gold"); }
  else SE.stamp();
  await holdOrTap(node, win ? 3600 : 2200);
  node.classList.add("out");
  await sleep(380);
  node.remove();
}

