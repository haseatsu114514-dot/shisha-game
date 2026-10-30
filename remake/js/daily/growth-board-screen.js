// 心得の盤の画面（SPEC 第2版 6.2、ADDENDUM-BOARD-LAYOUT）。画像が届くまでは図形だけで描く試作（#1772 のデザインで差し替え）。
// 盤は能力ごとに3枚（上の札で入れ替え）。道は SVG、マスは HTML のボタン（キーボード・タッチで押せる）。
// 参拝の場所で内省した時（place あり）だけ灯せる。メニュー・寝る前から開いた時は見るだけで、目標は決められる（2.8）。
import { el, sleep } from "../core/util.js";
import { layers, modal, gainCard } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { emit } from "../core/bus.js";
import { state } from "../core/state.js";
import { displayName, faceIconUrl } from "../core/data.js";
import { affinityLevel } from "../core/stats.js";
import { ensureGrowth, gaugeInfo, HIDANE_KEYS, lessonLearned } from "../core/growth.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_HEAD, BOARD_WHERE, REWARD_JA, FEATURES,
  HUB, NODES, NODE_BY_ID, boardNodes, ringsOpen, statCount, replay, nodeStatus, commitPending,
  pathTo, pendingTowards, lessonLock, hasMet, availableCount, paymentFor,
  STAT_SQUARES, GRID, lessonShown, perkOf, HIDANE_NAME, perkTotals, featuresOf, statsFilled,
} from "../core/growth-board.js";

// ---------------------------------------------------------------- 配置（盤の領域 760×488。紋は下の端 380,452。横13×縦9 の方眼で上へ育つ。SBD62）

const W = 760, H = 488, CX = 380, CY = 452, CELL = 52;
const at = (gx, gy) => ({ x: CX + gx * CELL, y: CY + gy * CELL });
const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, children = []) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
  for (const c of children) n.append(c);
  return n;
};
const payText = (pay) => Object.entries(pay).map(([k, n]) => `${HIDANE_NAME[k]}${n}`).join("＋") || "火種いらず";
export const PLACE_JA = { kannon: "観音堂", tokyo_shrine: "路地裏の神社", dubai_mosque: "モスクの回廊", inn_window: "宿の窓辺" };

let current = null;

/** 盤を開き、閉じるまで待つ。戻り値=確定したマス */
export function openBoard({ place = null } = {}) {
  if (current) return current.done;
  const g = ensureGrowth();
  const canLight = !!place;
  let pending = [];
  let board = boardOfTarget() || BOARD_KEYS[0];
  let selected = null;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const header = el("div.gb-header");
  const tabs = el("div.gb-tabs", { role: "tablist" });
  const boardSvg = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "gb-svg", "aria-hidden": "true" });
  const nodeLayer = el("div.gb-nodes");
  const side = el("div.gb-side", { dataset: { test: "board-preview" }, "aria-live": "polite" });
  const footer = el("div.gb-footer");
  const root = el(`div.gboard${canLight ? ".can-light" : ".view-only"}`, { role: "dialog", "aria-label": "心得の盤", dataset: { test: "growth-board", mode: canLight ? "light" : "view" } }, [
    header,
    el("div.gb-main", [el("div.gb-left", [tabs, el("div.gb-board", [boardSvg, nodeLayer])]), side]),
    footer,
  ]);

  function boardOfTarget() { return g.target ? NODE_BY_ID[g.target]?.board : null; }
  const view = () => replay(g, pending);
  const status = (node, v) => nodeStatus(node, g, v);

  function renderHeader() {
    const info = gaugeInfo(g);
    header.replaceChildren(
      el("h2.gb-title", { text: "心得の盤" }),
      el("div.gb-level", [
        el("b", { text: `Lv.${info.level}` }),
        el("i.gb-gauge", [el("b", { style: { width: `${Math.round(info.now * 100)}%` } })]),
        el("small", { text: info.max ? "MAX" : info.pending ? "今夜 Lv UP" : `あと${info.left}` }),
      ]),
      el("p.gb-place", { dataset: { test: "board-place" }, text: canLight ? `${PLACE_JA[place] || "静かな場所"}で内省している（時間は進まない）` : "見るだけ。灯すのは観音堂などで内省した時" }),
      el("button.gb-icon", { text: "？", title: "見方", "aria-label": "盤の見方", dataset: { test: "board-help" }, onclick: help }),
      el("button.gb-icon", { text: "×", title: "閉じる", "aria-label": "閉じる", dataset: { test: "board-close" }, onclick: close }),
    );
  }

  function renderTabs(v) {
    tabs.replaceChildren(...BOARD_KEYS.map((k) => {
      const count = statCount(k, v.unlocked);
      const ready = canLight ? availableCount(k, g, v) : 0;
      return el(`button.gb-tab.b-${k}${k === board ? ".on" : ""}`, {
        role: "tab", "aria-selected": String(k === board), dataset: { test: `board-tab-${k}` },
        "aria-label": `${BOARD_JA[k]}盤 ${count}/${STAT_SQUARES[k]}${ready ? `、今取れるマス ${ready}` : ""}`,
        onclick: () => { board = k; selected = null; SE.click?.(); render(); },
      }, [
        el("span.gb-tab-head", { text: BOARD_HEAD[k], "aria-hidden": "true" }),
        el("span.gb-tab-body", [
          el("b", { text: `${BOARD_JA[k]}盤` }), el("span.gb-tab-count", { text: ` ${count}/${STAT_SQUARES[k]}` }),
          el("i.gb-tab-line", [el("b", { style: { width: `${Math.round(count / STAT_SQUARES[k] * 100)}%` } })]),
        ]),
        ready ? el("em.gb-tab-ready", { text: String(ready), "aria-hidden": "true" }) : null,
        g.target && NODE_BY_ID[g.target]?.board === k ? el("em.gb-tab-target", { text: "◎", "aria-hidden": "true" }) : null,
      ]);
    }));
  }

  function renderBoard(v) {
    // まだ会っていない人の授業と小道は盤に出さない（会った時に現れる）
    const nodes = boardNodes(board).filter((n) => lessonShown(n, g));
    const open = ringsOpen();
    const lit = (id) => id === HUB || v.unlocked.has(id);
    const goal = g.target && NODE_BY_ID[g.target]?.board === board ? new Set(pathTo(g.target, v.unlocked).path) : new Set();
    const parts = [svg("defs", {}, [svg("radialGradient", { id: "gb-ember", cx: "50%", cy: "62%", r: "60%" }, [
      svg("stop", { offset: "0%", "stop-color": "#fff1b8" }), svg("stop", { offset: "45%", "stop-color": "#ffb43c" }),
      svg("stop", { offset: "100%", "stop-color": "#e86a12", "stop-opacity": "0" }),
    ])])];
    // 方眼のうすい点（横13×縦9。紋の行から上）
    for (let gx = -GRID.w; gx <= GRID.w; gx++) for (let gy = -GRID.h; gy <= 0; gy++) { const p = at(gx, gy); parts.push(svg("circle", { cx: p.x, cy: p.y, r: 1.5, class: "gb-dot" })); }
    // 道（使うマスどうしだけ。紋の隣は紋とつなぐ）
    const drawn = new Set();
    for (const n of nodes) {
      for (const id of n.links) {
        if (id !== HUB && !lessonShown(NODE_BY_ID[id], g)) continue;
        const key = [n.id, id].sort().join("|");
        if (drawn.has(key)) continue;
        drawn.add(key);
        const a = at(n.gx, n.gy), b = id === HUB ? { x: CX, y: CY } : at(NODE_BY_ID[id].gx, NODE_BY_ID[id].gy);
        const on = lit(n.id) && lit(id), aim = (goal.has(n.id) || lit(n.id)) && (id === HUB || goal.has(id) || lit(id)) && (goal.has(n.id) || goal.has(id));
        const closedA = n.ring > open, closedB = id !== HUB && NODE_BY_ID[id].ring > open;
        parts.push(svg("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: `gb-path${on ? " lit" : ""}${aim && !on ? " aim" : ""}${closedA || closedB ? " sealed" : ""}` }));
        // 開いている所と、まだ開いていない所の境に封（章の数は出さない。SBD42）
        if (closedA !== closedB) {
          const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, horiz = a.y === b.y;
          parts.push(svg("line", { x1: horiz ? mx : mx - 11, y1: horiz ? my - 11 : my, x2: horiz ? mx : mx + 11, y2: horiz ? my + 11 : my, class: "gb-seal" }));
        }
      }
    }
    parts.push(svg("circle", { cx: CX, cy: CY, r: 30, class: "gb-hub" }));
    parts.push(svg("circle", { cx: CX, cy: CY + 2, r: 19, fill: "url(#gb-ember)" }));
    const hubText = svg("text", { x: CX, y: CY + 8, class: "gb-hub-text" });
    hubText.textContent = BOARD_HEAD[board];
    parts.push(hubText);
    boardSvg.replaceChildren(...parts);

    nodeLayer.replaceChildren(...nodes.map((node) => {
      const p = at(node.gx, node.gy), st = status(node, v);
      const shown = revealOf(node);
      const glyph = st === "locked" && node.kind !== "stat" ? "" : node.kind === "stat" ? (node.peak ? "極" : perkOf(node)?.glyph || "") : node.kind === "gate" ? "関" : node.kind === "lesson" ? (hasMet(node.who) || g.nodes.includes(node.id) ? whoName(node.who).slice(0, 1) : "？") : shown === "hidden" ? "？" : node.glyph;
      const qStep = node.feature && !g.nodes.includes(node.id) && st !== "hidden";
      return el(`button.gb-node.${node.kind}.s-${st}${fresh.has(node.id) ? ".just-opened" : ""}${node.peak ? ".peak" : ""}${node.sig ? ".sig" : ""}${selected === node.id ? ".selected" : ""}${g.target === node.id ? ".target" : ""}${goal.has(node.id) ? ".on-path" : ""}`, {
        style: { left: `${p.x}px`, top: `${p.y}px` },
        title: nodeTitle(node, shown), "aria-label": `${nodeTitle(node, shown)}（${statusWord(node, st)}）`,
        dataset: { test: `board-node-${node.id}`, status: st },
        onclick: () => select(node.id, true),
      }, [
        el("span.gb-face", { "aria-hidden": "true" }, [el("span.gb-glyph", { text: glyph }), lessonFace(node, st)]),
        qStep ? el("em.gb-quality", { text: "✦", "aria-hidden": "true" }) : null,
        node.kind === "skill" && ["available", "short", "far"].includes(st)
          ? el("span.gb-cost", { "aria-hidden": "true", text: String(node.cost) }) : null,
        st === "locked" ? el("span.gb-lock", { text: "封", "aria-hidden": "true" }) : null,
      ]);
    }));
  }

  /**
   * 授業はその人の顔アイコン（2026-10-30 オーナー「授業はキャラの顔アイコンに」SBD64）。顔の無い人・読み込めない時は名前の1文字。
   * 会っていない人の授業は盤に出ないので、出ている授業はどれも顔を見せてよい。
   */
  function lessonFace(node, st) {
    if (node.kind !== "lesson" || st === "hidden") return null;
    const url = faceIconUrl(node.who, state);
    if (!url) return null;
    const img = el("img.gb-face-icon", { src: url, alt: "", draggable: "false", loading: "lazy" });
    img.addEventListener("error", () => img.remove());
    return img;
  }

  /** 章ごとの見せ方（2.5）: open=全部 / next=名前と効果（絵は影絵）/ hidden=？？？ */
  function revealOf(node) {
    if (node.kind !== "skill") return "open";
    const open = ringsOpen();
    return node.ring <= open ? "open" : node.ring === open + 1 ? "next" : "hidden";
  }
  function nodeTitle(node, shown = revealOf(node)) {
    if (node.kind === "stat") return node.peak ? `${BOARD_JA[node.board]}のマス（極み）` : `${BOARD_JA[node.board]}のマス・${perkOf(node)?.name || ""}`;
    if (node.kind === "gate") return `${BOARD_JA[node.board]}の関門`;
    if (node.kind === "lesson") return hasMet(node.who) || g.nodes.includes(node.id) ? `${whoName(node.who)}の授業「${node.name}」` : "？？？の授業";
    return shown === "hidden" ? "？？？（物語が進むと盤に現れる）" : `スキル「${node.name}」`;
  }
  function whoName(who) { return who === "sumi" ? "スミさん" : displayName(who, state); }

  function statusWord(node, st) {
    return {
      unlocked: "灯してある", pending: "仮置き中", locked: "まだ開いていない", sealed: "授業の錠",
      far: "まだ道がつながっていない", short: "火種が足りない", available: canLight ? "今灯せる" : "灯せる（内省の時に）",
    }[st];
  }

  function renderSide(v) {
    const node = selected ? NODE_BY_ID[selected] : null;
    if (!node || node.board !== board) { side.replaceChildren(...boardSummary(v)); return; }
    const st = status(node, v), shown = revealOf(node);
    const lines = [];
    const art = el(`div.gb-art.k-${node.kind}${shown !== "open" || st === "sealed" ? ".shadow" : ""}`, { "aria-hidden": "true" }, [
      el("span", { text: node.kind === "stat" ? BOARD_HEAD[node.board] : node.kind === "gate" ? "関" : node.kind === "lesson" ? "授" : shown === "hidden" ? "？" : node.glyph }),
      node.kind === "lesson" ? lessonFace(node, st) : null,
    ]);
    lines.push(art, el("h3.gb-p-title", { text: nodeTitle(node, shown) }));
    if (node.kind === "stat") {
      const perk = perkOf(node);
      lines.push(el("p", { dataset: { test: "board-perk" }, text: `このマスで：${perk.text}（${perk.tierName}）` }));
      if (node.feature) lines.push(el("p.gb-p-quality", { dataset: { test: "board-feature" }, text: `✦ 灯すと「${FEATURES[node.feature].text}」` }));
      if (node.peak) lines.push(el("p.gb-p-next", { text: statsFilled(node.board, v.unlocked) ? "盤の能力のマスを全部灯した。極みを灯せる" : "この盤の能力のマスを全部灯すと灯せる（盤を埋めたご褒美）" }));
      lines.push(el("p.gb-p-sub", { text: `効く場面：${BOARD_WHERE[node.board]}` }));
    } else if (node.kind === "gate") {
      lines.push(el("p", { text: "この先の道を開く関門。色の火（紅火・蒼火・翠火）1つで越える。先には強いスキルや授業がある" }));
      lines.push(el("p.gb-p-sub", { text: `${HIDANE_NAME[node.board]}を先に使う。無ければほかの色の火でも越えられる。白火では越えられない` }));
    } else if (node.kind === "skill") {
      if (shown === "hidden") lines.push(el("p", { text: "物語が進むと盤に現れる" }));
      else lines.push(el("p", { text: node.text }), el("p.gb-p-sub", { text: `効く場面：${node.scene}・火種${node.cost}${shown === "next" ? "・まだ開いていない" : ""}` }));
    } else {
      const lock = lessonLock(node, v.unlocked);
      const met = hasMet(node.who) || g.nodes.includes(node.id);
      if (!met) lines.push(el("p", { text: "まだ会っていない誰かが、教えてくれるらしい" }));
      else {
        lines.push(el("p.gb-p-reward", { text: `${REWARD_JA[node.reward]}：${node.text}` }));
        if (st === "sealed") lines.push(el("p.gb-p-sub", { text: node.hint }));
      }
      if (lock) {
        const conds = [];
        if (node.need) conds.push(met ? `${whoName(node.who)} ♥${Math.min(5, affinityLevel(node.who))}/${node.need}` : `？？？ ♥?/${node.need}`);
        lines.push(el("p.gb-p-lock", { dataset: { test: "board-lesson-lock" }, text: `錠：${conds.join("・")}` }));
      } else if (st !== "unlocked") lines.push(el("p.gb-p-sub", { text: "火種いらず。道が届けば灯せる" }));
    }
    lines.push(el(`p.gb-p-state.s-${st}`, { text: stateText(node, st, v) }));
    const actions = [];
    if (canLight && st === "available") actions.push(el("button.btn.primary.gb-light", { text: node.kind === "gate" ? "越える（色の火種1）" : node.cost ? `灯す（火種${node.cost}）` : "教わる", dataset: { test: "board-light" }, onclick: () => light(node.id) }));
    if (st === "pending") actions.push(el("button.btn.gb-undo", { text: "やめる", dataset: { test: "board-undo" }, onclick: () => unlight(node.id) }));
    if (!g.nodes.includes(node.id) && st !== "pending") {
      actions.push(el("button.btn.gb-aim", { text: g.target === node.id ? "目標をやめる" : "目標にする", dataset: { test: "board-target" }, onclick: () => toggleTarget(node.id) }));
      if (canLight && g.target === node.id && st !== "available") actions.push(el("button.btn.gb-aim", { text: "目標まで灯す", dataset: { test: "board-towards" }, onclick: () => towards(node.id) }));
    }
    side.replaceChildren(...lines, el("div.gb-side-actions", actions));
  }

  /** 何も選んでいない時（SBD63「段の概念は無くす。盤の伸びをグラフに」）: 恩恵ごとの合計の横棒と、✦のできること */
  function boardSummary(v) {
    const count = statCount(board, v.unlocked);
    const bars = perkTotals(board, v.unlocked).map((p) => el("div.gb-bar", { dataset: { test: `board-bar-${p.key}` } }, [
      el("span.gb-bar-name", { text: p.name }),
      el("i.gb-bar-line", { "aria-hidden": "true" }, [el("b", { style: { width: `${p.max ? Math.round((p.sum / p.max) * 100) : 0}%` } })]),
      el("span.gb-bar-sum", { text: p.text }),
    ]));
    const feats = featuresOf(board, v.unlocked);
    const out = [
      el("h3.gb-p-title", { text: `${BOARD_JA[board]}盤 ${count}/${STAT_SQUARES[board]}` }),
      el("div.gb-bars", { dataset: { test: "board-bars" } }, bars),
      feats.length ? el("p.gb-p-quality", { text: feats.map((f) => `${f.on ? "✦" : "・"}${f.name}`).join("　") }) : null,
      el("p.gb-p-sub", { text: `効く場面：${BOARD_WHERE[board]}` }),
    ];
    if (g.target) {
      const t = NODE_BY_ID[g.target], route = pathTo(g.target, v.unlocked);
      out.push(el("p.gb-p-target", { dataset: { test: "board-target-line" }, text: `目標：${nodeTitle(t)}まで 火種${route.cost}` }));
    }
    out.push(el("p.gb-hint", { text: canLight ? "光っているマスが今灯せる。紋から道をたどって、欲しいスキルや授業の方へ" : "マスを押すと何が変わるかが出る。欲しいマスは「目標にする」で印をつけておける" }));
    return out.filter(Boolean);
  }

  function stateText(node, st, v) {
    if (st === "unlocked") {
      if (node.kind !== "lesson") return "灯してある";
      const who = node.who === "sumi" ? "スミさん" : displayName(node.who, state);
      if (lessonLearned(node.id)) return "習得済み";
      return `相談できる。次に${who}に会った時に話を聞こう`;
    }
    if (st === "pending") return "仮置き中。決定するまでは「やめる」で戻せる";
    if (st === "locked") return "まだ開いていない。物語が進むと封が解ける";
    if (st === "sealed") return "錠が開くと、道が届けば灯せる";
    if (st === "far" && node.peak) {
      const left = boardNodes(node.board).filter((n) => n.kind === "stat" && !n.peak && !v.unlocked.has(n.id)).length;
      return `能力のマスを全部灯すと灯せる（あと${left}マス）`;
    }
    if (st === "far") {
      const route = pathTo(node.id, v.unlocked);
      return `まだ道がつながっていない（ここまで 火種${route.cost}）`;
    }
    if (st === "short" && node.kind === "gate") return "色の火（紅火・蒼火・翠火）が要る。節目のレベル・大会・♥5の人・遊びのご褒美でもらえる";
    if (st === "short") {
      const have = (v.hidane.any || 0) + (v.hidane[node.board] || 0);
      return `火種があと${node.cost - have}つ要る。火種は貯めておける`;
    }
    if (!canLight) return `灯せる（${payText(paymentFor(node, v.hidane, v.ctx))}）。観音堂などで内省すると灯せる`;
    return `${payText(paymentFor(node, v.hidane, v.ctx))}で払う`;
  }

  function renderFooter(v) {
    const wallet = el("div.gb-wallet", { dataset: { test: "board-wallet" } }, HIDANE_KEYS.map((k) => el(`span.gb-hidane.k-${k}${v.hidane[k] ? "" : ".zero"}`, {
      title: k === "any" ? "白火（関門のほか、どのマスにも）" : `${HIDANE_NAME[k]}（${BOARD_JA[k]}盤のマスと、関門）`,
    }, [el("i", { "aria-hidden": "true" }), el("span", { text: HIDANE_NAME[k] }), el("b", { text: String(v.hidane[k] || 0) })])));
    const actions = [];
    if (canLight && pending.length) actions.push(el("button.btn.gb-reset", { text: "取り消す", dataset: { test: "board-reset" }, onclick: () => { pending = []; SE.cancel?.(); render(); } }));
    actions.push(el("button.btn.primary.gb-decide", {
      text: pending.length ? `決定（${pending.length}）` : "閉じる", dataset: { test: "board-decide" }, onclick: () => (pending.length ? finish(true) : close()),
    }));
    footer.replaceChildren(wallet, el("p.gb-legend", [
      legend("available", "今灯せる"), legend("far", "道がまだ"), el("span", { text: "◆ 関門（色の火）" }), legend("sealed", "授業の錠"), legend("locked", "まだ開いていない"), el("span", { text: "✦ できることが増える" }),
    ]), el("div.gb-actions", actions));
  }
  function legend(st, text) { return el("span.gb-legend-item", [el(`i.s-${st}`), el("span", { text })]); }

  function render() {
    const v = view();
    pending = v.pending;
    renderHeader(); renderTabs(v); renderBoard(v); renderSide(v); renderFooter(v);
  }
  function select(id, sound) {
    selected = id;
    if (sound) SE.click?.();
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.focus({ preventScroll: true });
  }
  function light(id) {
    if (!canLight) return;
    pending = [...pending, id];
    SE.select?.();
    // 仮置きで隣へ自動で進む（6.2 スマホ横の基本操作）: 今取れる隣が1つだけならそれを選ぶ
    const v = view();
    const nexts = NODE_BY_ID[id].links.filter((n) => n !== HUB && status(NODE_BY_ID[n], v) === "available");
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.classList.add("lit-now");
    if (nexts.length === 1) select(nexts[0], false);
  }
  function unlight(id) {
    pending = pending.filter((p) => p !== id); // つながらなくなった先の仮置きは replay で外れる
    SE.cancel?.();
    render();
  }
  function toggleTarget(id) {
    g.target = g.target === id ? null : id;
    SE.select?.();
    emit("hud");
    render();
  }
  function towards(id) {
    pending = pendingTowards(g, pending, id);
    SE.select?.();
    render();
  }
  async function help() {
    await modal({
      title: "心得の盤の見方", className: "gboard-help",
      body: el("div", [
        el("p", { text: "盤は能力ごとに3枚（才能・感覚・理論）。下の紋から左・右・上へ道がのびていて、線でつながった隣のマスだけ灯せる。どの道から進んでもいい。" }),
        el("p", { text: "丸いマスは能力（火種1）。灯すたびに少し伸びる。紋から遠いマスほど恩恵が大きい（近く×1・中ほど×2・関門の先×3）。✦のマスは灯すと、できることが1つ増える。六角形はスキル（火種4〜8）。いちばん上の極みは、その盤の能力のマスを全部灯すと灯せる。" }),
        el("p", { text: "ひし形は関門。色の火（紅火・蒼火・翠火）1つで越えると、その先の道が開く。関門の先には強いスキルと授業がある。白火では越えられない。" }),
        el("p", { text: "金の札は授業（火種いらず）。教えてくれる人に出会うと盤に現れる。灯したら、次にその人に会った時に相談して習う（LIME では習えない）。" }),
        el("p", { text: "白火はどのマスにも使える。色の火はその色の盤のマスと関門に使える。払うときは白火が先。" }),
        el("p", { text: "火種を灯せるのは、観音堂などの静かな場所で内省した時だけ（時間は進まない）。メニューからは見るだけで、欲しいマスを目標にしておける。" }),
      ]),
      options: [{ label: "閉じる", value: true, primary: true }],
    });
  }
  async function close() {
    if (pending.length) {
      const choice = await modal({
        title: "決定しますか？", body: `仮置き ${pending.length}つ`,
        options: [{ label: "決定して閉じる", value: "yes", primary: true, test: "board-confirm-yes" }, { label: "仮置きをやめて閉じる", value: "no", test: "board-confirm-no" }, { label: "戻る", value: null }],
      });
      if (!choice) return;
      return finish(choice === "yes");
    }
    return finish(false);
  }
  async function finish(commit) {
    const owner = state;
    const committed = commit ? commitPending(pending) : [];
    document.removeEventListener("keydown", onKey, true);
    root.classList.remove("show");
    await sleep(200);
    root.remove();
    current = null;
    if (owner === state && committed.length) {
      emit("hud");
      const squares = committed.filter((n) => n.kind === "stat").length;
      if (squares) gainCard({ kind: "info", badge: "火", top: "LIGHT", main: `能力の火を${squares}つ灯した` });
      const gates = committed.filter((n) => n.kind === "gate").length;
      if (gates) gainCard({ kind: "info", badge: "関", top: "BREAK", main: `関門を${gates}つ越えた`, sub: "この先の道が開いた" });
      for (const node of committed) if (node.feature) gainCard({ kind: "info", badge: "✦", top: "NEW", main: FEATURES[node.feature].name, sub: FEATURES[node.feature].text });
      for (const node of committed) if (node.peak) gainCard({ kind: "info", badge: "極", top: "COMPLETE", main: `${BOARD_JA[node.board]}を極めた`, sub: "盤の能力のマスを全部灯した" });
      for (const node of committed) if (node.kind === "skill") gainCard({ kind: "info", badge: node.glyph, top: "SKILL", main: node.name, sub: node.text });
      // 授業: 今のゲームの場面がある授業はその場面を見せる（読み終えたら習得。場面が無い授業はカードで）
      for (const node of committed) if (node.kind === "lesson") await presentLesson(node);
    }
    resolveDone(committed);
  }
  function onKey(e) {
    if (e.key !== "Escape" || document.querySelector("#modal.show")) return;
    e.preventDefault();
    close();
  }

  // 章が進んで初めて盤を開いた: 新しく開いた範囲のマスを光らせ、封が解けたことを知らせる（SBD42）
  const fresh = new Set();
  if (ringsOpen() > g.seenRing) {
    for (const n of NODES) if (n.ring > g.seenRing && n.ring <= ringsOpen()) fresh.add(n.id);
    const firstFresh = NODES.find((n) => fresh.has(n.id));
    if (firstFresh) board = firstFresh.board;
    g.seenRing = ringsOpen();
    const banner = el("div.gb-opened", { role: "status", dataset: { test: "board-opened" } }, [
      el("b", { text: "封が解けた" }), el("span", { text: "心得の盤に、新しい道が開いた" }),
    ]);
    root.append(banner);
    setTimeout(() => banner.remove(), 3200);
    setTimeout(() => { fresh.clear(); if (current) render(); }, 3200);
  }
  current = { done };
  layers.fx.append(root);
  document.addEventListener("keydown", onKey, true);
  if (g.target) selected = g.target;
  render();
  requestAnimationFrame(() => root.classList.add("show"));
  return done;
}

/** 授業を灯した時の場面（2.6）。場面のある授業（スミさんの今の特訓・授業）はそれを流す */
/** 授業を灯した時（2.6・SBD50）: 「相談できる」になる。次にその人に会った時に、はじめが相談して話を聞いて習得する */
async function presentLesson(node) {
  if (!state) return;
  const who = node.who === "sumi" ? "スミさん" : displayName(node.who, state);
  gainCard({ kind: "info", badge: "授", top: "LESSON", main: `${who}に相談できる`, sub: `「${node.name}」。次に${who}に会った時に話を聞こう` });
}

