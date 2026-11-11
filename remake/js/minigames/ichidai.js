// カードゲーム「一台勝負」の画面。規則は ichidai-rules.js、CPUは ichidai-ai.js、カードは ichidai-data.js。
// 本編の #stage（1280×720）か、試遊ページの host に重ねて開く。本編の保存・進行・体力にはここでは触らない
// （結果を返すだけ。記録は呼び出し側が確定する）。
//
// 画面の作り: 上＝相手の帯／中央＝審査の山・案内・点／下＝自分の一台（熱の柱・ボウル・炭ゾーン・炭焼き場）と手札。
// 操作はタップだけ（カードや炭を選ぶ → 出てくるボタンを押す）。遊び方は「？」から開く。
// カードの絵は remake/img/ui/ichidai/ に置いたものを ichidai-art.js の一覧から読む。無いカードは色と1文字で描く。
import { el } from "../core/util.js";
import { SE, unlockAudio } from "../core/audio.js";
import { faceIconUrl } from "../core/data.js";
import { KINDS, FLAVOR, CARD, BOWL, HMD, JUDGE, PUFFS, TOURNAMENTS, TOURNAMENT, KITS, KIT, TYPE_LABEL, WHEN_LABEL } from "./ichidai-data.js";
import { RULES, RANK, ZONE_LABEL, createGame, act, heatOf, coalHeat, leavesOf, firepower, sidesOf, slotsOf, coolStepsOf, roundsOf, sessionOf,
  judgedHeat, rawZone, scorchLineOf, scorePuff, puffPreview, unseenPuffs, packLimit,
  canPlay, canCharge, canPlace, canPutOn, canAsh, canPack, canSteam } from "./ichidai-rules.js";
import { aiAct } from "./ichidai-ai.js";
import { artUrl } from "./ichidai-art.js";
import { HELP_PAGES } from "./ichidai-help.js";

export const ICHIDAI_TITLE = "一台勝負";
export const LEVELS = Object.freeze([{ id: 0, name: "やさしい" }, { id: 1, name: "ふつう" }, { id: 2, name: "つよい" }]);
const active = new WeakMap();
const sfx = (name) => { try { SE[name]?.(); } catch { /* 音は無くても遊べる */ } };
const sleep = (ms, signal) => new Promise((resolve) => { const t = setTimeout(resolve, ms); signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true }); });
const ME = 0, CPU = 1;
const dhText = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "±0");

// ───────── 小さな部品 ─────────
function strip(flavorId, { now = null, judged = null, line = null } = {}) {
  const f = FLAVOR[flavorId];
  return el("div.ichi-strip", { "aria-hidden": "true" }, Array.from({ length: 11 }, (_, h) => {
    const z = rawZone(f, h, line ?? f.s);
    return el(`i.z-${z === "offLo" || z === "offHi" ? "off" : z}`, { text: z === "just" ? "★" : String(h), dataset: { now: h === now ? "1" : null, judged: h === judged ? "1" : null } });
  }));
}
const kindBadge = (kind) => el(`span.ichi-kind.k-${kind}`, { text: KINDS[kind].k, title: KINDS[kind].name });
function artBox(kind, id, glyph) {
  const url = artUrl(kind, id);
  return el(`div.ichi-art.a-${kind}`, { dataset: { id } }, url ? el("img", { src: url, alt: "", draggable: "false" }) : el("span.ichi-glyph", { text: glyph }));
}
/** 手札・詳細に出すデッキのカード */
function cardFace(id, { small = false } = {}) {
  const c = CARD[id], coal = c.type === "coal";
  const cost = coal ? null : el(`span.ichi-cost${c.burn ? ".is-burn" : ""}`, { text: String(c.burn ?? c.cost), title: c.burn ? `燃焼${c.burn}` : `火力${c.cost}` });
  return el(`div.ichi-card.t-${c.type}${c.when === "puff" ? ".w-puff" : ""}${small ? ".is-small" : ""}`, { dataset: { card: id } }, [
    el("div.ichi-card-top", [cost, el("b.ichi-card-name", { text: c.name })]),
    artBox("card", id, coal ? "炭" : TYPE_LABEL[c.type].slice(0, 1)),
    coal ? el("div.ichi-coal-stats", [el("span", [el("small", { text: "着火" }), el("b", { text: String(c.ig) })]), el("span.is-heat", [el("small", { text: "熱" }), el("b", { text: String(c.heat) })])])
      : el("div.ichi-card-tags", [el("span.ichi-tag", { text: TYPE_LABEL[c.type] }), el(`span.ichi-tag.w-${c.when}`, { text: WHEN_LABEL[c.when] })]),
    el("p.ichi-card-text", { text: c.tx }),
  ]);
}
function coalTile(c, { tapped = false } = {}) {
  if (!c.up) return el(`i.ichi-coal.is-ember${tapped ? ".is-tapped" : ""}`, { title: "種火（熱1）" });
  const cube = CARD[c.id].heat === 2;
  return el(`i.ichi-coal.is-up${cube ? ".is-cube" : ".is-flat"}${tapped ? ".is-tapped" : ""}`, { title: `${CARD[c.id].name}（熱${CARD[c.id].heat}）` }, [
    artUrl("card", c.id) ? el("img", { src: artUrl("card", c.id), alt: "" }) : el("span", { text: cube ? "角" : "平" }), el("b", { text: String(CARD[c.id].heat) })]);
}
function face(id, name) {
  const url = id ? faceIconUrl(id) : null;
  return url ? el("img.ichi-face", { src: url, alt: "", onerror: (e) => { e.currentTarget.replaceWith(el("span.ichi-face.is-blank", { text: name.slice(0, 1) })); } })
    : el("span.ichi-face.is-blank", { text: name.slice(0, 1) });
}

/**
 * @param host 重ねる要素（既定: #stage）
 * @param config 対戦の設定 { kit, opponentKit, tournament, level }。省くと設定の画面から始まる
 * @param opponent 相手の見せ方 { id（顔アイコンのキャラID）, name }
 * @param tutorial はじめに遊び方を開くか
 * @param pilot テスト・デモ用: "cpu" にすると自分の席もCPUが打つ
 * @param speed CPUの手と演出の早回し
 * 戻り値: { completed, cancelled, games:[{ winner（0=自分/1=相手/null=引き分け）, scores, votes, tournament, kit, level }], last }
 */
export function runIchidai({ host = document.getElementById("stage"), signal = null, seed = null, config = null, opponent = null,
  tutorial = false, pilot = null, speed = 1, allowRetry = true } = {}) {
  if (!host?.isConnected) return Promise.reject(new Error("Connected game host required"));
  if (active.has(host)) return active.get(host);
  const games = [];
  const summary = (completed) => ({ completed, cancelled: !completed, games: games.map((g) => ({ ...g })), last: games.length ? { ...games.at(-1) } : null });
  if (signal?.aborted) return Promise.resolve(summary(false));
  let finish;
  const promise = new Promise((resolve) => { finish = resolve; });
  active.set(host, promise);

  const previousFocus = document.activeElement;
  const ctrl = new AbortController();
  const dead = () => ctrl.signal.aborted;
  let G = null, cfg = config ? { ...config } : null;
  let pending = null;            // 人の入力を待つ Promise の resolve
  const ui = { sel: null, picks: new Set(), counts: {}, note: "", toast: "", fast: false, sheet: null, peek: null, lastLog: 0 };
  const foe = { id: opponent?.id || null, name: opponent?.name || "相手" };

  const root = el("section.ichi-game", { role: "dialog", "aria-modal": "true", "aria-label": ICHIDAI_TITLE, tabindex: "-1", dataset: { test: "ichi-game", phase: "setup" } });
  const table = el("div.ichi-table");
  const sheet = el("div.ichi-sheet", { hidden: true });
  const live = el("p.ichi-live", { role: "status", "aria-live": "polite" });
  const fastBtn = el("button.ichi-fast", { type: "button", text: "▶▶ 早送り", hidden: true, "aria-pressed": "false", dataset: { test: "ichi-fast" },
    onclick: () => { ui.fast = !ui.fast; fastBtn.setAttribute("aria-pressed", String(ui.fast)); sfx("click"); } });
  const head = el("div.ichi-head-buttons", [fastBtn,
    el("button.ichi-round-btn", { type: "button", "aria-label": "遊び方", dataset: { test: "ichi-help" }, onclick: () => { sfx("select"); openHelp(); } }, el("span", { text: "？" })),
    el("button.ichi-round-btn", { type: "button", "aria-label": "やめる", dataset: { test: "ichi-close" }, onclick: () => { sfx("cancel"); askQuit(); } }, el("span", { text: "✕" })),
  ]);
  root.append(table, head, sheet, live);
  host.append(root);
  const arm = () => unlockAudio();
  root.addEventListener("pointerdown", arm); root.addEventListener("keydown", arm);
  const tableArt = artUrl("table", "counter");
  if (tableArt) root.style.setProperty("--ichi-table-art", `url("${tableArt}")`);

  function close(completed) {
    if (dead()) return;
    ctrl.abort(); pending?.(null);
    root.remove(); active.delete(host);
    if (window.__ichidai === hook) delete window.__ichidai;
    try { previousFocus?.focus?.({ preventScroll: true }); } catch { /* 元の要素が無ければそのまま */ }
    finish(summary(completed));
  }
  signal?.addEventListener("abort", () => close(false), { once: true });
  window.addEventListener("pagehide", () => close(false), { once: true, signal: ctrl.signal });
  root.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); if (!sheet.hidden && ui.sheet === "help") closeSheet(); else askQuit(); } });

  const submit = (action) => { const r = pending; pending = null; r?.(action); };
  // テスト・デモ用の入口: 自分の席もCPUに打たせて早回しする（ほかのミニゲームの window.__desertRide と同じ使い方）
  const hook = { autoplay: (fast = 12) => { pilot = "cpu"; speed = fast; if (pending && G && !G.over) submit(aiAct(G, G.wait.player)); else if (ui.sheet === "score") sheet.querySelector('[data-test="ichi-next"]')?.click(); },
    get game() { return G; } };
  window.__ichidai = hook;
  const human = (i) => i === ME && pilot !== "cpu";
  const say = (text) => { ui.toast = text; live.textContent = text; };

  // ───────── 設定の画面 ─────────
  function showSetup() {
    root.dataset.phase = "setup";
    const pick = { kit: cfg?.kit || "a", tournament: cfg?.tournament || "practice", level: cfg?.level ?? 1 };
    const draw = () => {
      const kits = KITS.map((k) => el(`button.ichi-pick.ichi-kit${pick.kit === k.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-kit-${k.id}` }, "aria-pressed": String(pick.kit === k.id),
        onclick: () => { pick.kit = k.id; sfx("select"); draw(); } }, [
        el("b", { text: k.name }),
        el("span.ichi-kit-leaf", k.plan.map(([id, n]) => el("span", [kindBadge(FLAVOR[id].kind), `${FLAVOR[id].name} ${n}`]))),
        el("small", { text: `${BOWL[k.bowl].name} ＋ ${HMD[k.hmd].name}` }),
        el("span.ichi-kit-blurb", { text: k.blurb }),
      ]));
      const tours = TOURNAMENTS.map((t) => el(`button.ichi-pick.ichi-tour${pick.tournament === t.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-tour-${t.id}` }, "aria-pressed": String(pick.tournament === t.id),
        onclick: () => { pick.tournament = t.id; sfx("select"); draw(); } }, [el("b", { text: t.name }), el("small", { text: `${t.sessions * 3}ラウンド` }), el("span", { text: t.blurb })]));
      const levels = LEVELS.map((l) => el(`button.ichi-pick.ichi-level${pick.level === l.id ? ".is-on" : ""}`, { type: "button", dataset: { test: `ichi-level-${l.id}` }, "aria-pressed": String(pick.level === l.id),
        onclick: () => { pick.level = l.id; sfx("select"); draw(); } }, [el("b", { text: l.name })]));
      table.replaceChildren(el("div.ichi-setup", [
        el("header.ichi-setup-head", [el("h1", { text: ICHIDAI_TITLE }), el("p", { text: "葉を詰め、炭で熱を保ち、審査員の一口を競う" })]),
        el("section", [el("h2", { text: "自分の一式" }), el("div.ichi-picks.is-kits", kits)]),
        el("section", [el("h2", { text: "大会" }), el("div.ichi-picks.is-tours", tours)]),
        el("section.ichi-setup-foot", [el("h2", { text: `${foe.name}の強さ` }), el("div.ichi-picks.is-levels", levels),
          el("button.btn.primary.ichi-start", { type: "button", text: "対戦をはじめる", dataset: { test: "ichi-start" }, onclick: () => { sfx("select"); cfg = { ...pick }; startGame(); } })]),
      ]));
    };
    draw();
    root.focus({ preventScroll: true });
  }
  // ───────── 対戦 ─────────
  async function startGame() {
    const others = KITS.map((k) => k.id).filter((id) => id !== cfg.kit);
    const s = (seed ?? (Date.now() ^ (Math.random() * 0xffffffff))) >>> 0;
    const foeKit = cfg.opponentKit || others[s % others.length];
    G = createGame({ seed: s + games.length * 7919, tournament: cfg.tournament, market: cfg.market,
      players: [{ name: "はじめ", kit: cfg.kit, level: 2 }, { name: foe.name, kit: foeKit, ai: true, level: cfg.level }] });
    Object.assign(ui, { sel: null, picks: new Set(), counts: {}, note: "", toast: "", sheet: null, peek: null, lastLog: 0 });
    closeSheet(); root.dataset.phase = "play";
    if (tutorial && !games.length) { openHelp(); }
    await loop();
  }
  async function loop() {
    const mine = G;
    while (!dead() && G === mine) {
      render();
      if (G.over) { await showEnd(); return; }
      const w = G.wait;
      let action;
      if (human(w.player)) { action = await new Promise((resolve) => { pending = resolve; }); if (!action) return; }
      else { await sleep(cpuDelay(w), ctrl.signal); if (dead() || G !== mine) return; action = aiAct(G, w.player); }
      const before = G.log.length, r = act(G, action);
      if (!r.ok) { if (human(w.player)) { say(r.reason); sfx("cancel"); } else { console.error("ichidai: CPUの入力が通らない", action, r.reason); close(false); return; } continue; }
      ui.sel = null; ui.picks = new Set(); ui.counts = {}; ui.toast = "";
      if (!human(w.player) && G.log.length > before) ui.note = G.log.at(-1).text;
      await playEvents();
    }
  }
  const cpuDelay = (w) => (ui.fast || pilot === "cpu" ? 40 : w.type === "embers" || w.type === "wear" || w.type === "discard" ? 260 : 620) / speed;

  async function playEvents() {
    const evs = G.events.splice(0);
    for (const ev of evs) {
      if (dead()) return;
      if (ev.t === "reveal") { sfx("card"); render(); await showReveal(ev.puff); }
      else if (ev.t === "score") { render(); await showScore(ev); }
      else if (ev.t === "peek" && human(ev.p)) { ui.peek = ev.puff; sfx("card"); }
      else if (ev.t === "play" && !human(ev.p)) { sfx("card"); }
      else if (ev.t === "charge" || ev.t === "puton") sfx("click");
    }
  }

  // ───────── 描画 ─────────
  function render() {
    if (!G || dead()) return;
    const w = G.wait, me = G.P[ME], op = G.P[CPU], myTurn = !!w && human(w.player);
    root.dataset.phase = G.over ? "end" : G.phase;
    root.dataset.wait = w ? w.type : "";
    root.dataset.turn = w ? (w.player === ME ? "me" : "foe") : "";
    fastBtn.hidden = G.over || pilot === "cpu"; fastBtn.setAttribute("aria-pressed", String(ui.fast));
    table.replaceChildren(...[foeStrip(op), centerRow(me, op, w), prepMarket(me, w, myTurn), myRow(me, w, myTurn), handRow(me, w, myTurn)].filter(Boolean));
  }

  // 相手の帯
  function foeStrip(op) {
    const tapped = Math.min(op.spent, op.zone.length);
    return el("div.ichi-foe", { dataset: { test: "ichi-foe" } }, [
      el("div.ichi-who", [face(foe.id, op.name), el("div", [el("b", { text: op.name }), el("small", { text: KIT[op.kit]?.name || "" })])]),
      el("div.ichi-foe-bowl", bowlSummary(op, { compact: true })),
      el("div.ichi-foe-coals", [el("small", { text: `熱 ${heatOf(op)}` }), el("div.ichi-coals.is-small", op.zone.map((c, i) => coalTile(c, { tapped: i < tapped })))]),
      el("div.ichi-foe-stove", [el("small", { text: "炭焼き場" }), el("div.ichi-coals.is-small", stoveTiles(op, false))]),
      el("div.ichi-foe-side", [
        el("span.ichi-chip", { text: `手札 ${op.hand.length}` }),
        ...op.tools.map((id) => el("span.ichi-chip.is-tool", { text: CARD[id].name + (id === "windguard" ? `（${op.wind}）` : ""), title: CARD[id].tx })),
        op.person ? el("span.ichi-chip.is-person", { text: CARD[op.person].name, title: CARD[op.person].tx }) : null,
        op.pend ? el("span.ichi-chip.is-warn", { text: `次の一口 ${dhText(op.pend)}` }) : null,
      ]),
    ]);
  }
  function bowlSummary(p, { compact = false } = {}) {
    if (!p.main) return [el("span.ichi-empty", { text: leavesOf(p) ? "" : "ボウルは空" })];
    const f = FLAVOR[p.main], sd = sidesOf(p), h = heatOf(p);
    const leaves = Object.entries(p.bowl).sort((a, b) => (a[0] === p.main ? -1 : b[0] === p.main ? 1 : b[1] - a[1]));
    return [
      el("div.ichi-bowl-head", [kindBadge(f.kind), el("b", { text: f.name }), el("span.ichi-taste", { title: "味値" }, [el("small", { text: "味" }), String(f.t)]),
        el("span.ichi-grams", { text: `${leavesOf(p)}g`, title: `容量 ${BOWL[p.bowlId].cap}g` })]),
      strip(p.main, { now: G.phase === "serve" ? h : null, line: scorchLineOf(p) }),
      compact ? null : el("div.ichi-leaves", leaves.map(([id, n]) => el(`span.ichi-leaf.k-${FLAVOR[id].kind}${id === p.main ? ".is-main" : sd.includes(id) ? ".is-side" : ""}`, { text: `${FLAVOR[id].name} ×${n}` }))),
      compact && leaves.length > 1 ? el("small.ichi-foe-mix", { text: leaves.slice(1).map(([id, n]) => `${FLAVOR[id].name}×${n}`).join("・") }) : null,
    ];
  }
  function stoveTiles(p, mine) {
    const slots = slotsOf(p), out = [];
    p.stove.forEach((c, i) => {
      const ready = c.stage === 2, cube = CARD[c.id].heat === 2;
      const can = mine && G.wait && human(G.wait.player) && canPutOn(G, p, i).ok;
      out.push(el(`button.ichi-coal.is-stove${cube ? ".is-cube" : ".is-flat"}${ready ? ".is-ready" : c.stage === 0 ? ".is-side" : ""}${can ? ".can" : ""}`,
        { type: "button", disabled: !can, title: `${CARD[c.id].name}：${ready ? "焼けた" : `あと${2 - c.stage}ターン`}`, dataset: { test: mine ? `ichi-stove-${i}` : null },
          onclick: () => { if (can) { sfx("click"); submit({ type: "puton", stove: i }); } } },
        [el("span", { text: cube ? "角" : "平" }), el("small", { text: ready ? "焼けた" : `あと${2 - c.stage}` })]));
    });
    for (let i = p.stove.length; i < slots; i++) out.push(el("i.ichi-coal.is-slot"));
    return out;
  }

  // 中央: 審査の山・案内・点
  function centerRow(me, op, w) {
    const rounds = roundsOf(G), unseen = G.tour.judges.length ? unseenPuffs(G) : [];
    const tally = new Map();
    for (const q of unseen) tally.set(q.id, (tally.get(q.id) || 0) + 1);
    const pile = G.phase !== "serve" ? null : G.tour.judges.length
      ? el("div.ichi-pile", { dataset: { test: "ichi-pile" } }, [el("small", { text: `審査カード 残り${G.pile.length}枚` }),
          el("div.ichi-pile-list", [...tally].map(([id, n]) => el(`span.ichi-puff-chip${PUFFS[id].dh > 0 ? ".is-up" : PUFFS[id].dh < 0 ? ".is-down" : ""}`, { title: PUFFS[id].tx }, [el("b", { text: dhText(PUFFS[id].dh) }), `${PUFFS[id].style}×${n}`])))])
      : el("div.ichi-pile", [el("small", { text: "練習試合" }), el("div.ichi-pile-list", el("span.ichi-puff-chip", [el("b", { text: "±0" }), "毎回ふつうに吸う"]))]);
    const phaseName = G.phase === "embers" ? "最初の火" : G.phase === "prep" ? `準備 ${w ? w.n ?? "" : ""}/${RULES.prepTurns}` : `ラウンド ${Math.min(G.round + 1, rounds)}/${rounds}`;
    const peek = ui.peek && G.phase === "serve" && !G.judge ? el("div.ichi-peek", { dataset: { test: "ichi-peek" } }, [el("small", { text: "読んだ：次の審査" }), el("b", { text: `${ui.peek.style} ${dhText(ui.peek.dh)}` })]) : null;
    return el("div.ichi-center", [
      el("div.ichi-clock", [el("b", { text: phaseName, dataset: { test: "ichi-phase" } }),
        G.phase === "serve" ? el("small", { text: `セッション ${sessionOf(G) + 1}/${G.tour.sessions}・${G.order?.[0] === ME ? "あなたが先手" : `${op.name}が先手`}` }) : el("small", { text: G.tour.name }), pile, peek]),
      el("div.ichi-guide", { dataset: { test: "ichi-guide" } }, guide(me, op, w)),
      el("div.ichi-scores", [scoreBox(me, "あなた", "me"), scoreBox(op, op.name, "foe")]),
    ]);
  }
  const scoreBox = (p, label, cls) => el(`div.ichi-score.is-${cls}`, { dataset: { test: `ichi-score-${cls}` } }, [el("small", { text: label }), el("b", { text: String(p.score) }), el("span", { text: `票 ${p.votes}` })]);

  /** いま何をすればよいか（短い一文）と、できることのボタン */
  function guide(me, op, w) {
    const lines = [], buttons = [];
    const btn = (text, action, { primary = false, test = null, disabled = false, title = null } = {}) =>
      buttons.push(el(`button.btn${primary ? ".primary" : ""}.small`, { type: "button", text, disabled, title, dataset: { test }, onclick: () => { sfx("select"); typeof action === "function" ? action() : submit(action); } }));
    if (!w) return [];
    if (!human(w.player)) {
      lines.push(el("b", { text: `${op.name}の番` })); if (ui.note) lines.push(el("span", { text: ui.note }));
    } else if (w.type === "embers") {
      lines.push(el("b", { text: "最初の火" }), el("span", { text: `手札から${RULES.startEmbers}枚選んで種火にする（${ui.picks.size}/${RULES.startEmbers}）` }));
      btn("種火にする", { type: "embers", picks: [...ui.picks] }, { primary: true, test: "ichi-embers", disabled: ui.picks.size !== RULES.startEmbers });
    } else if (w.type === "prep") {
      const mode = me.turn.mode, total = Object.values(ui.counts).reduce((a, b) => a + b, 0);
      if (!mode) {
        const cp = canPack(G, me), cs = canSteam(G, me);
        lines.push(el("b", { text: "準備：詰めるか、蒸らすか" }), el("span", { text: cp.ok ? `葉を選ぶ（${total}/${packLimit(G, me)}枚・2種類まで）` : cp.reason }));
        btn(`詰める${total ? `（${total}枚）` : ""}`, { type: "pack", picks: { ...ui.counts } }, { primary: true, test: "ichi-pack", disabled: !cp.ok || !total });
        btn("蒸らす", { type: "steam" }, { test: "ichi-steam", disabled: !cs.ok, title: cs.ok ? "1枚引いて、炭に触れる" : cs.reason });
        if (!cp.ok && !cs.ok) btn("ターンを終える", { type: "end" }, { test: "ichi-end" });
      } else {
        lines.push(el("b", { text: mode === "steam" ? "蒸らす：炭を置く・のせる・チャージ" : "詰めた" }), el("span", { text: mode === "steam" ? `熱${heatOf(me)}。終わったらターンを終える` : "カードを使うか、ターンを終える" }));
        btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
      }
    } else if (w.type === "cool") {
      lines.push(el("b", { text: `冷める：弱める炭を選ぶ（あと${w.left}）` }), el("span", { text: "炭カードは裏返る・種火は灰になる" }));
      if (me.wind > 0) btn(`風防で受ける（残り${me.wind}）`, { type: "cool", wind: true }, { test: "ichi-wind" });
    } else if (w.type === "main") {
      lines.push(el("b", { text: "あなたのターン" }), el("span", { text: `熱${heatOf(me)}・火力${firepower(me)}。整えたらターンを終える` }), outlook(me));
      btn("ターンを終える", { type: "end" }, { primary: true, test: "ichi-end" });
    } else if (w.type === "discard") {
      const need = me.hand.length - RULES.handMax;
      lines.push(el("b", { text: "手札は7枚まで" }), el("span", { text: `灰にする${need}枚を選ぶ（${ui.picks.size}/${need}）` }));
      btn("灰にする", { type: "discard", picks: [...ui.picks] }, { primary: true, test: "ichi-discard", disabled: ui.picks.size !== need });
    } else if (w.type === "react") {
      const pv = puffPreview(G, me);
      lines.push(el("b", { text: "審査：一口の技を使える" }), el("span.ichi-preview", { dataset: { test: "ichi-preview", zone: pv.zone } }, [`判定熱 ${pv.h} → `, el(`i.z-${pv.zone}`, { text: ZONE_LABEL[pv.zone] }), ` ${pv.pts}点`]));
      btn("このまま受ける", { type: "pass" }, { primary: true, test: "ichi-pass" });
    } else if (w.type === "wear") {
      const total = Object.values(ui.counts).reduce((a, b) => a + b, 0);
      lines.push(el("b", { text: "セッションの区切り" }), el("span", { text: `減らす葉を${w.n}枚選ぶ（${total}/${w.n}）` }));
      btn("減らす", { type: "wear", picks: { ...ui.counts } }, { primary: true, test: "ichi-wear", disabled: total !== w.n });
    } else if (w.type === "weaken") {
      lines.push(el("b", { text: "すきま風" }), el("span", { text: "弱める炭を1つ選ぶ" }));
    }
    if (ui.toast) lines.push(el("em.ichi-toast", { text: ui.toast, dataset: { test: "ichi-toast" } }));
    return [el("div.ichi-guide-text", lines), el("div.ichi-guide-buttons", buttons)];
  }

  /** いまの熱のまま審査を受けたら、吸い方ごとにどの帯になるか（読んだカードがあればそれだけ） */
  function outlook(me) {
    if (!me.main) return null;
    const seen = new Map();
    for (const q of (ui.peek ? [ui.peek] : unseenPuffs(G))) if (!seen.has(q.id)) seen.set(q.id, q);
    const chips = [...seen.values()].sort((a, b) => a.dh - b.dh).map((q) => {
      const h = judgedHeat(me, q), s = scorePuff(me, h, q, {});
      return el(`i.ichi-outlook-chip.z-${s.zone}`, { title: `${q.style}：判定熱${h}・${ZONE_LABEL[s.zone]}・${s.pts}点` }, [el("b", { text: q.style.replace("に吸う", "").replace("吸う", "") }), `${ZONE_LABEL[s.zone]}${s.pts}`]);
    });
    return el("span.ichi-outlook", { dataset: { test: "ichi-outlook" } }, [el("small", { text: "このままなら" }), ...chips]);
  }

  // 自分の一台
  function myRow(me, w, myTurn) {
    const h = heatOf(me), f = me.main ? FLAVOR[me.main] : null;
    const judged = G.judge && me.puff ? judgedHeat(me, G.judge, me.puff.tk) : null;
    // セッティングやカードでいつも足される分（アマバースト・寄せ・煽り）を入れた、ふつうに吸われたときの判定熱
    const base = judgedHeat(me, PUFFS.normal);
    const line = scorchLineOf(me);
    const pillar = el("div.ichi-pillar", { dataset: { test: "ichi-pillar", heat: String(h) }, "aria-label": `熱 ${h}` }, [
      el("div.ichi-pillar-cells", Array.from({ length: 11 }, (_, k) => {
        const v = 10 - k, z = f ? rawZone(f, v, line) : "cold";
        return el(`i.z-${z === "offLo" || z === "offHi" ? "off" : z}${v === h ? ".is-now" : ""}${v === base && base !== h && judged === null ? ".is-base" : ""}${v === judged ? ".is-judged" : ""}`, { text: f && z === "just" ? "★" : String(v) });
      })),
      el("div.ichi-pillar-read", [el("small", { text: "熱" }), el("b", { text: String(h) }), base !== h ? el("small.ichi-pillar-base", { text: `判定 ${base}` }) : null, el("small", { text: `火力 ${firepower(me)}` })]),
    ]);
    const picking = myTurn && w.type === "wear";
    const bowl = el("div.ichi-bowl", { dataset: { test: "ichi-bowl" } }, me.main ? [
      ...bowlSummary(me).slice(0, 2),
      el("div.ichi-leaves", Object.entries(me.bowl).sort((a, b) => (a[0] === me.main ? -1 : b[0] === me.main ? 1 : b[1] - a[1])).map(([id, n]) => {
        const cut = ui.counts[id] || 0, sd = sidesOf(me).includes(id);
        return el(`button.ichi-leaf.k-${FLAVOR[id].kind}${id === me.main ? ".is-main" : sd ? ".is-side" : ""}${picking ? ".can" : ""}`, { type: "button", disabled: !picking, dataset: { test: `ichi-leaf-${id}` },
          title: FLAVOR[id].ab || FLAVOR[id].name,
          onclick: () => { const total = Object.values(ui.counts).reduce((a, b) => a + b, 0); ui.counts[id] = total >= w.n || cut >= n ? 0 : cut + 1; sfx("click"); render(); } },
          [`${FLAVOR[id].name} ×${n - cut}`, cut ? el("b", { text: `−${cut}` }) : null, id === me.main ? el("small", { text: "主役" }) : sd ? el("small", { text: "脇役" }) : null]);
      })),
      el("div.ichi-bowl-foot", [el("span", { text: `${BOWL[me.bowlId].name}・${HMD[me.hmd].name}`, title: `${BOWL[me.bowlId].ab}\n${HMD[me.hmd].ab}` }),
        me.pend ? el("span.ichi-chip.is-warn", { text: `次の一口 ${dhText(me.pend)}` }) : null, me.sessMod ? el("span.ichi-chip", { text: `寄せ ${dhText(me.sessMod)}` }) : null]),
    ] : [el("span.ichi-empty", { text: "場から葉を取って詰める" }), el("div.ichi-bowl-foot", el("span", { text: `${BOWL[me.bowlId].name}（容量${BOWL[me.bowlId].cap}g）・${HMD[me.hmd].name}`, title: `${BOWL[me.bowlId].ab}\n${HMD[me.hmd].ab}` }))]);

    const coolPick = myTurn && (w.type === "cool" || w.type === "weaken"), ashPick = myTurn && w.type === "main";
    const tapped = Math.min(me.spent, me.zone.length);
    const zone = el("div.ichi-zone", { dataset: { test: "ichi-zone" } }, [
      el("small", { text: "炭ゾーン" }),
      el("div.ichi-coals", [
        ...me.zone.map((c, i) => {
          const node = coalTile(c, { tapped: i < tapped });
          const btn = el(`button.ichi-coal-btn${coolPick ? ".can" : ""}${ui.sel?.type === "zone" && ui.sel.i === i ? ".is-sel" : ""}`, { type: "button", disabled: !(coolPick || ashPick), dataset: { test: `ichi-coal-${i}`, up: c.up ? "1" : "0" },
            onclick: () => {
              if (coolPick) { sfx("click"); submit({ type: w.type, zone: i }); }
              else if (ashPick) { ui.sel = ui.sel?.type === "zone" && ui.sel.i === i ? null : { type: "zone", i }; sfx("click"); render(); }
            } }, node);
          return btn;
        }),
        ...Array.from({ length: Math.max(0, RULES.heatMax - me.zone.length) }, () => el("i.ichi-coal.is-slot")),
      ]),
    ]);
    const stove = el("div.ichi-stove", { dataset: { test: "ichi-stove" } }, [el("small", { text: "炭焼き場" }), el("div.ichi-coals", stoveTiles(me, true))]);
    const side = el("div.ichi-side", [
      ...me.tools.map((id) => el("span.ichi-chip.is-tool", { text: CARD[id].name + (id === "windguard" ? `（${me.wind}）` : ""), title: CARD[id].tx })),
      me.person ? el("span.ichi-chip.is-person", { text: CARD[me.person].name, title: CARD[me.person].tx }) : null,
      el("span.ichi-chip", { text: `山札 ${me.deck.length}` }),
    ]);
    return el("div.ichi-mine", [pillar, bowl, el("div.ichi-fire", [zone, el("div.ichi-fire-row", [stove, side])])]);
  }
  // 準備: フレーバー場
  function prepMarket(me, w, myTurn) {
    if (G.phase !== "prep" && G.phase !== "embers") return null;
    const canPick = myTurn && w.type === "prep" && !me.turn.mode && canPack(G, me).ok;
    const total = Object.values(ui.counts).reduce((a, b) => a + b, 0), kinds = Object.keys(ui.counts).filter((k) => ui.counts[k] > 0);
    return el("div.ichi-market", { dataset: { test: "ichi-market" } }, G.market.map((id) => {
      const f = FLAVOR[id], left = G.supply[id] - (ui.counts[id] || 0), n = ui.counts[id] || 0;
      const can = canPick && left > 0 && total < packLimit(G, me) && (n > 0 || kinds.length < 2);
      return el(`div.ichi-pile-card.k-${f.kind}${n ? ".is-on" : ""}`, { dataset: { test: `ichi-market-${id}` } }, [
        el("button.ichi-pile-main", { type: "button", disabled: !can, title: f.ab || f.name,
          onclick: () => { ui.counts[id] = n + 1; sfx("click"); render(); } }, [
          el("span.ichi-pile-top", [kindBadge(f.kind), el("b", { text: f.name }), el("span.ichi-taste", [el("small", { text: "味" }), String(f.t)])]),
          artBox("flavor", id, KINDS[f.kind].k), strip(id),
          el("span.ichi-pile-foot", [el("small", { text: `適温${f.lo}〜${f.hi}` }), el("small", { text: `残${left}` }), f.pair !== "none" ? kindBadge(f.pair) : null]),
        ]),
        n ? el("button.ichi-pile-minus", { type: "button", "aria-label": `${f.name}を1枚戻す`, text: `${n}枚 −`, onclick: () => { ui.counts[id] = n - 1; sfx("click"); render(); } }) : null,
      ]);
    }));
  }

  // 手札
  function handRow(me, w, myTurn) {
    const multi = myTurn && (w.type === "embers" || w.type === "discard");
    const sel = ui.sel?.type === "hand" ? ui.sel.i : -1;
    const n = me.hand.length, overlap = n > 7 ? Math.ceil((n * 126 - 880) / (n - 1)) : 0;
    const cards = me.hand.map((id, i) => {
      const c = CARD[id], coal = c.type === "coal";
      const usable = myTurn && (coal ? canPlace(G, me, id).ok : canPlay(G, me, id).ok);
      const on = multi ? ui.picks.has(i) : sel === i;
      return el(`button.ichi-hand-card${on ? ".is-sel" : ""}${usable ? ".can" : ""}`, { type: "button", disabled: !myTurn, style: { marginLeft: i && overlap ? `-${overlap}px` : null }, dataset: { test: `ichi-hand-${i}`, card: id },
        onclick: () => {
          if (multi) { ui.picks.has(i) ? ui.picks.delete(i) : ui.picks.add(i); }
          else ui.sel = sel === i ? null : { type: "hand", i };
          sfx("click"); render();
        } }, cardFace(id));
    });
    return el("div.ichi-hand-row", [el("div.ichi-hand", { dataset: { test: "ichi-hand" } }, cards), detail(me, w, myTurn)]);
  }
  /** 選んだカード・炭の詳しい文と、できること */
  function detail(me, w, myTurn) {
    if (!ui.sel || !myTurn) return null;
    const buttons = [];
    const btn = (text, action, ok, { primary = false, test = null } = {}) => buttons.push(el(`button.btn.small${primary ? ".primary" : ""}`, { type: "button", text, disabled: !ok.ok, title: ok.ok ? null : ok.reason, dataset: { test },
      onclick: () => { sfx("select"); submit(action); } }));
    if (ui.sel.type === "zone") {
      const c = me.zone[ui.sel.i]; if (!c) return null;
      btn("灰にする（熱を下げる）", { type: "ash", zone: ui.sel.i }, canAsh(G, me), { test: "ichi-do-ash" });
      return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [el("div.ichi-detail-text", [el("b", { text: c.up ? CARD[c.id].name : "種火" }), el("p", { text: c.up ? CARD[c.id].tx : "裏向きの炭。熱1。冷めるときに選ぶと灰になる。" })]), el("div.ichi-detail-buttons", buttons)]);
    }
    const i = ui.sel.i, id = me.hand[i]; if (!id) return null;
    const c = CARD[id], coal = c.type === "coal";
    const reasons = [];
    if (coal) { const r = canPlace(G, me, id); btn("炭焼き場に置く", { type: "place", hand: i }, r, { primary: true, test: "ichi-do-place" }); if (!r.ok) reasons.push(r.reason); }
    else { const r = canPlay(G, me, id); btn(c.burn ? `使う（燃焼${c.burn}）` : `使う（火力${c.cost}）`, { type: "play", hand: i }, r, { primary: true, test: "ichi-do-play" }); if (!r.ok) reasons.push(r.reason); }
    if (w.type === "main" || w.type === "prep") btn("チャージ（熱+1）", { type: "charge", hand: i }, canCharge(G, me), { test: "ichi-do-charge" });
    return el("div.ichi-detail", { dataset: { test: "ichi-detail" } }, [
      el("div.ichi-detail-text", [el("b", { text: c.name }), el("small", { text: coal ? `炭・着火${c.ig}ターン・熱${c.heat}` : `${TYPE_LABEL[c.type]}・${WHEN_LABEL[c.when]}・${c.burn ? `燃焼${c.burn}` : `火力${c.cost}`}` }), el("p", { text: c.tx }),
        reasons.length ? el("em", { text: reasons[0] }) : null]),
      el("div.ichi-detail-buttons", buttons),
    ]);
  }

  // ───────── 重ねる札（審査・結果・遊び方・やめる） ─────────
  function openSheet(kind, node) { ui.sheet = kind; sheet.replaceChildren(node); sheet.hidden = false; sheet.dataset.kind = kind; }
  function closeSheet() { ui.sheet = null; sheet.hidden = true; sheet.replaceChildren(); }
  const wait = (ms) => sleep(ms / (ui.fast || pilot === "cpu" ? 12 : speed), ctrl.signal);
  function puffCard(q) {
    return el(`div.ichi-puff-card${q.dh > 0 ? ".is-up" : q.dh < 0 ? ".is-down" : ""}`, { dataset: { test: "ichi-puff-card" } }, [
      el("small", { text: q.judge ? JUDGE[q.judge].name : "練習" }), el("b", { text: q.style }), el("strong", { text: dhText(q.dh) }), el("p", { text: q.tx })]);
  }
  async function showReveal(q) {
    openSheet("reveal", el("div.ichi-reveal", [el("small", { text: "審査" }), puffCard(q)]));
    await wait(1100);
    if (ui.sheet === "reveal") closeSheet();
  }
  function showScore(ev) {
    const row = (i, label) => {
      const r = ev.res[i];
      return el(`div.ichi-result-row.z-${r.zone}`, { dataset: { test: `ichi-result-${i === ME ? "me" : "foe"}`, zone: r.zone } }, [
        el("b", { text: label }), el("span.ichi-result-heat", { text: `判定熱 ${r.h}` }), el(`i.ichi-zone-chip.z-${r.zone}`, { text: ZONE_LABEL[r.zone] }),
        el("span.ichi-result-parts", { text: r.parts.length ? r.parts.map((x) => `${x.label}${x.n >= 0 ? "+" : ""}${x.n}`).join("　") : "加点なし" }),
        el("strong", { text: `${r.pts}点` }), r.vote ? el("em", { text: `一票 +${r.vote}` }) : null, r.lost ? el("small", { text: `${FLAVOR[r.lost].name}を1枚失う` }) : null]);
    };
    const mine = ev.res[ME];
    sfx(mine.zone === "just" ? "perfect" : mine.zone === "band" ? "good" : "miss");
    return new Promise((resolve) => {
      const done = () => { if (ui.sheet === "score") closeSheet(); resolve(); };
      openSheet("score", el("div.ichi-result", { dataset: { test: "ichi-result" } }, [
        el("header", [el("small", { text: `ラウンド ${ev.round + 1}` }), puffCard(ev.puff)]),
        row(ME, "あなた"), row(CPU, G.P[CPU].name),
        el("p.ichi-result-vote", { text: ev.voter == null ? "帯が同じなので、票は入らない" : `${ev.voter === ME ? "あなた" : G.P[CPU].name}に一票` }),
        el("button.btn.primary", { type: "button", text: "次へ", dataset: { test: "ichi-next" }, onclick: () => { sfx("select"); done(); } }),
      ]));
      sheet.querySelector("button")?.focus({ preventScroll: true });
      if (pilot === "cpu") wait(600).then(done);
    });
  }
  function showEnd() {
    const res = G.result, me = G.P[ME], op = G.P[CPU];
    const game = { winner: res.winner, scores: res.scores.slice(), votes: res.votes.slice(), tournament: G.tour.id, kit: me.kit, level: cfg.level, rounds: roundsOf(G) };
    games.push(game);
    sfx(res.winner === ME ? "fanfare" : "cancel");
    return new Promise((resolve) => {
      const bonus = res.bonus.filter((b) => b.pts[0] || b.pts[1]).map((b) => el("li", [el("span", { text: `${JUDGE[b.judge].name}${b.note ? `（${b.note}）` : "の決め手"}` }), el("b", { text: `${b.pts[0] ? `+${b.pts[0]}` : "—"}` }), el("b", { text: `${b.pts[1] ? `+${b.pts[1]}` : "—"}` })]));
      openSheet("end", el("div.ichi-end", { dataset: { test: "ichi-end-sheet", winner: res.winner === ME ? "me" : res.winner === CPU ? "foe" : "draw" } }, [
        el("h2", { text: res.winner === ME ? "勝ち" : res.winner === CPU ? "負け" : "引き分け" }),
        el("div.ichi-end-scores", [el("div", [el("small", { text: "あなた" }), el("b", { text: String(me.score) }), el("span", { text: `票 ${me.votes}・ジャスト ${me.justCount}・焦げ ${me.scorchCount}` })]),
          el("div", [el("small", { text: op.name }), el("b", { text: String(op.score) }), el("span", { text: `票 ${op.votes}・ジャスト ${op.justCount}・焦げ ${op.scorchCount}` })])]),
        bonus.length ? el("ul.ichi-end-bonus", bonus) : null,
        el("div.ichi-end-buttons", [
          allowRetry ? el("button.btn", { type: "button", text: "もう一度", dataset: { test: "ichi-again" }, onclick: () => { sfx("select"); closeSheet(); resolve(); showSetup(); } }) : null,
          el("button.btn.primary", { type: "button", text: "おわる", dataset: { test: "ichi-finish" }, onclick: () => { sfx("select"); resolve(); close(true); } }),
        ]),
      ]));
      sheet.querySelector(".btn.primary")?.focus({ preventScroll: true });
    });
  }
  function openHelp(page = 0) {
    const back = ui.sheet;
    const draw = () => {
      const p = HELP_PAGES[page];
      openSheet("help", el("div.ichi-help", { dataset: { test: "ichi-help-sheet" } }, [
        el("header", [el("small", { text: `遊び方 ${page + 1}/${HELP_PAGES.length}` }), el("h2", { text: p.title })]),
        el("ul", p.lines.map((t) => el("li", { text: t }))),
        el("div.ichi-help-buttons", [
          el("button.btn.small", { type: "button", text: "前へ", disabled: page === 0, onclick: () => { page--; sfx("click"); draw(); } }),
          el("button.btn.small", { type: "button", text: "次へ", disabled: page === HELP_PAGES.length - 1, dataset: { test: "ichi-help-next" }, onclick: () => { page++; sfx("click"); draw(); } }),
          el("button.btn.small.primary", { type: "button", text: "とじる", dataset: { test: "ichi-help-close" }, onclick: () => { sfx("select"); closeSheet(); if (back === "quit") askQuit(); } }),
        ]),
      ]));
    };
    if (back && back !== "help" && back !== "quit") return; // 審査・結果の札の上には重ねない
    draw();
  }
  function askQuit() {
    if (ui.sheet && ui.sheet !== "help") return;
    if (!G || G.over) { close(games.length > 0); return; }
    openSheet("quit", el("div.ichi-quit", { dataset: { test: "ichi-quit-sheet" } }, [
      el("h2", { text: "対戦をやめる？" }), el("p", { text: "この対戦は記録されない" }),
      el("div.ichi-end-buttons", [
        el("button.btn", { type: "button", text: "つづける", dataset: { test: "ichi-quit-no" }, onclick: () => { sfx("select"); closeSheet(); } }),
        el("button.btn.primary", { type: "button", text: "やめる", dataset: { test: "ichi-quit-yes" }, onclick: () => { sfx("cancel"); close(games.length > 0); } }),
      ]),
    ]));
  }

  if (cfg) startGame(); else showSetup();
  return promise;
}
