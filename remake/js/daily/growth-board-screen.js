// 心得の盤の画面（SPEC 6.2、デザイン asset_sources/ui/growth-board-20261030/README.md）。
// 画像が届くまでは図形だけで描く試作: 輪・扇・線は SVG、ノードは HTML のボタン（キーボード・タッチで押せる）。
import { el, sleep } from "../core/util.js";
import { layers, modal, gainCard } from "../core/ui.js";
import { SE } from "../core/audio.js";
import { emit } from "../core/bus.js";
import { state, STAT_KEYS, STAT_JA } from "../core/state.js";
import { ensureGrowth, gaugeInfo, HIDANE_KEYS } from "../core/growth.js";
import {
  SECTORS, STAT_HEAD, STAT_NODES, SKILLS, NODES, NODE_BY_ID, STEP_TEXT, STAT_WHERE, QUALITY_STEPS, RING_MAX_STEP,
  ringsOpen, stepOf, replay, nodeStatus, commitPending, ringFill, rankOfStep, nodeLabel,
} from "../core/growth-board.js";

// ---------------------------------------------------------------- 配置（盤の領域 880×536、中心 440,268）

const W = 880, H = 536, CX = 440, CY = 268;
const HUB_R = 32;
const RING_EDGES = [HUB_R + 6, 144, 192, 216, 240, 266]; // 第N輪は RING_EDGES[N-1]〜RING_EDGES[N]
const SKILL_SPOT = { 1: [110, 30], 2: [170, -26], 3: [204, 22], 4: [232, -20] }; // 輪 -> [半径, 扇の中心線からの角度]
const SKILL_GLYPH = { K01: "段", K02: "香", K03: "寝", K04: "交", K05: "空", K06: "波", K07: "読", K08: "結", K09: "舌", K10: "目", K11: "火", K12: "胆", K13: "援", K14: "炭" };
const deg = (d) => d * Math.PI / 180;
const sectorAngle = (stat) => -90 + 72 * SECTORS.indexOf(stat);
const polar = (r, a) => ({ x: CX + r * Math.cos(deg(a)), y: CY + r * Math.sin(deg(a)) });

export function nodePosition(node) {
  if (node.kind === "stat") {
    const a = sectorAngle(node.stat), r = 60 + (node.step - 2) * 24;
    const side = node.step % 2 === 0 ? 1 : -1; // 中心線の左右に少しずらし、隣の段と重ねない
    const p = polar(r, a);
    return { x: p.x + side * 15 * Math.cos(deg(a + 90)), y: p.y + side * 15 * Math.sin(deg(a + 90)) };
  }
  const [r, offset] = SKILL_SPOT[node.ring];
  if (node.colors.length === 2) {
    // 2色のスキルは扇の境目（2.3）
    const [a1, a2] = node.colors.map(sectorAngle);
    const mid = Math.abs(a1 - a2) > 180 ? (a1 + a2 + 360) / 2 : (a1 + a2) / 2;
    return polar(r, mid);
  }
  return polar(r, sectorAngle(node.colors[0]) + offset);
}

// ---------------------------------------------------------------- 画面

const SVG = "http://www.w3.org/2000/svg";
const svg = (tag, attrs = {}, children = []) => {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  for (const c of children) if (c) n.append(c);
  return n;
};
const annulus = (r1, r2) => `M ${CX + r2} ${CY} a ${r2} ${r2} 0 1 0 ${-2 * r2} 0 a ${r2} ${r2} 0 1 0 ${2 * r2} 0 Z `
  + `M ${CX + r1} ${CY} a ${r1} ${r1} 0 1 1 ${-2 * r1} 0 a ${r1} ${r1} 0 1 1 ${2 * r1} 0 Z`;
const hidaneDot = (kind, count) => el(`span.gb-hidane.k-${kind}`, { title: kind === "any" ? "万能の火種" : `${STAT_HEAD[kind]}の火種` }, [
  el("i", { "aria-hidden": "true" }), el("b", { text: `${kind === "any" ? "" : STAT_HEAD[kind]}${count}` }),
]);
const payText = (pay) => Object.entries(pay).map(([k, n]) => `${k === "any" ? "万能" : STAT_HEAD[k]}の火種${n}`).join("＋");

let current = null;

/** 盤を開き、閉じるまで待つ。戻り値=確定したノード */
export function openBoard() {
  if (current) return current.done;
  const g = ensureGrowth();
  let pending = [];
  let selected = null;
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });

  const header = el("div.gb-header");
  const boardSvg = svg("svg", { viewBox: `0 0 ${W} ${H}`, class: "gb-svg", "aria-hidden": "true" });
  const nodeLayer = el("div.gb-nodes");
  const side = el("div.gb-side");
  const footer = el("div.gb-footer");
  const root = el("div.gboard", { role: "dialog", "aria-label": "心得の盤", dataset: { test: "growth-board" } }, [
    header,
    el("div.gb-main", [el("div.gb-board", [boardSvg, nodeLayer]), side]),
    footer,
  ]);

  const view = () => replay(g, pending);
  const status = (node, v) => nodeStatus(node, g, v);

  function renderHeader(v) {
    const info = gaugeInfo(g);
    const kinds = HIDANE_KEYS.filter((k) => v.hidane[k] > 0);
    const open = ringsOpen();
    const rings = [];
    for (let ring = 1; ring <= 5; ring++) {
      const fill = ringFill(g, ring);
      if (ring <= open) rings.push(el("span.gb-ring", { text: `第${ring}輪 ${fill.got}/${fill.total}` }));
      else { rings.push(el("span.gb-ring.locked", { text: `第${ring}輪は第${ring}章から` })); break; }
    }
    header.replaceChildren(
      el("h2.gb-title", { text: "心得の盤" }),
      el("div.gb-level", [
        el("b", { text: `Lv.${info.level}` }),
        el("i.gb-gauge", [el("b", { style: { width: `${Math.round(info.now * 100)}%` } })]),
        el("small", { text: info.max ? "MAX" : info.pending ? "今夜 Lv UP" : `あと${info.left}` }),
      ]),
      el("div.gb-wallet", { dataset: { test: "board-wallet" } }, kinds.length ? kinds.map((k) => hidaneDot(k, v.hidane[k])) : [el("span.gb-empty", { text: "火種 0" })]),
      el("div.gb-rings", rings),
      el("button.gb-icon", { text: "？", title: "見方", "aria-label": "盤の見方", dataset: { test: "board-help" }, onclick: help }),
      el("button.gb-icon", { text: "×", title: "閉じる", "aria-label": "閉じる", dataset: { test: "board-close" }, onclick: close }),
    );
  }

  function renderBoard(v) {
    const open = ringsOpen();
    const parts = [
      svg("defs", {}, [svg("radialGradient", { id: "gb-ember", cx: "50%", cy: "62%", r: "60%" }, [
        svg("stop", { offset: "0%", "stop-color": "#fff1b8" }), svg("stop", { offset: "45%", "stop-color": "#ffb43c" }),
        svg("stop", { offset: "100%", "stop-color": "#e86a12", "stop-opacity": "0" }),
      ])]),
    ];
    for (let ring = 1; ring <= 5; ring++) {
      parts.push(svg("path", { d: annulus(RING_EDGES[ring - 1], RING_EDGES[ring]), class: `gb-band${ring > open ? " locked" : ""}${ring % 2 ? "" : " alt"}`, "fill-rule": "evenodd" }));
    }
    // 扇ごとに能力色をうっすら敷く（どの色の扇かを盤だけで分かるように）
    for (const stat of SECTORS) {
      const a = sectorAngle(stat), r1 = RING_EDGES[0], r2 = RING_EDGES[5];
      const p = (r, d) => polar(r, a + d);
      const [o1, o2, i2, i1] = [p(r2, -36), p(r2, 36), p(r1, 36), p(r1, -36)];
      parts.push(svg("path", { class: "gb-wedge", style: `--c: var(--stat-${stat})`,
        d: `M ${i1.x} ${i1.y} L ${o1.x} ${o1.y} A ${r2} ${r2} 0 0 1 ${o2.x} ${o2.y} L ${i2.x} ${i2.y} A ${r1} ${r1} 0 0 0 ${i1.x} ${i1.y} Z` }));
    }
    for (const r of RING_EDGES.slice(1)) parts.push(svg("circle", { cx: CX, cy: CY, r, class: "gb-ring-line" }));
    for (let i = 0; i < 5; i++) {
      const a = -54 + 72 * i, p1 = polar(RING_EDGES[0], a), p2 = polar(RING_EDGES[5], a);
      parts.push(svg("line", { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, class: "gb-divider" }));
    }
    // 中央から各色の段を結ぶ線だけを引く（スキルには引かない。2.3）
    for (const stat of SECTORS) {
      let prev = { x: CX, y: CY };
      for (const node of STAT_NODES.filter((n) => n.stat === stat)) {
        const p = nodePosition(node), lit = v.unlocked.has(node.id);
        parts.push(svg("line", { x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, class: `gb-spine${lit ? " lit" : ""}`, style: `--c: var(--stat-${stat})` }));
        prev = p;
      }
    }
    for (let ring = open + 1; ring <= 5; ring++) {
      const p = polar((RING_EDGES[ring - 1] + RING_EDGES[ring]) / 2, -126);
      parts.push(svg("text", { x: p.x, y: p.y + 4, class: "gb-lock-label" }, [document.createTextNode(`第${ring}章`)]));
    }
    parts.push(svg("circle", { cx: CX, cy: CY, r: HUB_R, class: "gb-hub" }));
    parts.push(svg("circle", { cx: CX, cy: CY + 2, r: HUB_R * 0.62, fill: "url(#gb-ember)" }));
    parts.push(svg("circle", { cx: CX, cy: CY + 3, r: 7, class: "gb-hub-coal" }));
    boardSvg.replaceChildren(...parts);

    nodeLayer.replaceChildren(...NODES.map((node) => {
      const p = nodePosition(node), st = status(node, v);
      const quality = node.kind === "stat" && QUALITY_STEPS[node.stat]?.[node.step];
      const label = `${nodeLabel(node)}（${statusWord(node, st, v)}）`;
      const b = el(`button.gb-node.${node.kind}.s-${st}${node.ring === 4 && node.kind === "skill" ? ".big" : ""}${selected === node.id ? ".selected" : ""}`, {
        style: { left: `${p.x}px`, top: `${p.y}px`, "--c": `var(--stat-${node.colors[0]})`, "--c2": `var(--stat-${node.colors[1] || node.colors[0]})` },
        title: nodeLabel(node), "aria-label": label, dataset: { test: `board-node-${node.id}`, status: st },
        onclick: () => select(node.id, true),
      }, [
        el("span.gb-face", { "aria-hidden": "true" }, [el("span.gb-glyph", { text: node.kind === "skill" ? SKILL_GLYPH[node.id] : STAT_HEAD[node.stat] })]),
        quality ? el("em.gb-quality", { text: "✦", "aria-hidden": "true" }) : null,
        node.kind === "skill" && ["available", "short"].includes(st)
          ? el("span.gb-cost", { "aria-hidden": "true" }, Array.from({ length: node.cost }, () => el("i"))) : null,
        st === "locked" ? el("span.gb-lock", { text: "鍵", "aria-hidden": "true" }) : null,
      ]);
      return b;
    }));
  }

  function renderSide(v) {
    const open = ringsOpen();
    side.replaceChildren(el("h3.gb-side-title", { text: "能力" }), ...STAT_KEYS.map((stat) => {
      const fixed = stepOf(stat, new Set(g.nodes)), now = stepOf(stat, v.unlocked), cap = RING_MAX_STEP[open];
      const next = now + 1;
      const quality = Object.entries(QUALITY_STEPS[stat] || {}).find(([s]) => Number(s) > now);
      let note;
      if (now >= 10) note = "極めた";
      else if (next > cap) note = `次の段は第${open + 1}章で開く`;
      else note = `次の段: 火種1${quality ? `　✦${quality[0]}段で「${quality[1]}」` : ""}`;
      const row = el(`button.gb-stat.st-${stat}`, {
        dataset: { test: `board-stat-${stat}` }, "aria-label": `${STAT_JA[stat]} ${now}段。${note}`,
        onclick: () => { const n = STAT_NODES.find((x) => x.stat === stat && x.step === Math.min(10, next)); if (n) select(n.id, true); },
      }, [
        el("span.gb-badge", { text: STAT_HEAD[stat], "aria-hidden": "true" }),
        el("span.gb-stat-body", [
          el("span.gb-stat-head", [el("b", { text: STAT_JA[stat] }), el("span", { text: `${now}段・${rankOfStep(stat, now)}` })]),
          el("span.gb-pips", { "aria-hidden": "true" }, Array.from({ length: 10 }, (_, i) => {
            const step = i + 1;
            const cls = step <= fixed ? "on" : step <= now ? "pend" : step > cap ? "cap" : "off";
            return el(`i.${cls}${QUALITY_STEPS[stat]?.[step] ? ".q" : ""}`);
          })),
          el("small.gb-stat-note", { text: note }),
        ]),
      ]);
      return row;
    }));
  }

  function statusWord(node, st, v) {
    if (st === "unlocked") return "灯してある";
    if (st === "pending") return "仮置き中";
    if (st === "locked") return `第${node.ring}章で開く`;
    if (st === "waiting") return `先に${STAT_JA[node.stat]} ${node.step - 1}段`;
    if (st === "short") return `火種が${node.cost}つ要る`;
    return `今灯せる・${payText(replayPay(node, v))}`;
  }
  const replayPay = (node, v) => replay({ ...g, hidane: v.hidane, nodes: [...v.unlocked] }, [node.id]).pays[node.id] || {};

  function renderFooter(v) {
    const node = selected ? NODE_BY_ID[selected] : null;
    const decide = el("button.btn.primary.gb-decide", {
      text: pending.length ? "決定して閉じる" : "閉じる", dataset: { test: "board-decide" }, onclick: () => (pending.length ? finish(true) : close()),
    });
    if (!node) {
      footer.replaceChildren(el("div.gb-preview", [
        el("p.gb-hint", { text: "光っているノードは今灯せる。押すと、ここに何が変わるかが出る" }),
        el("p.gb-legend", [legend("available", "今灯せる"), legend("short", "火種が足りない"), legend("waiting", "段の順待ち"), legend("locked", "章で開く"), el("span", { text: "✦ できることが増える段" })]),
      ]), el("div.gb-actions", [decide]));
      return;
    }
    const st = status(node, v);
    const lines = [];
    if (node.kind === "stat") {
      lines.push(el("p.gb-p-title", [el("span.gb-badge.small", { text: STAT_HEAD[node.stat], style: { "--c": `var(--stat-${node.stat})` } }), el("b", { text: `${STAT_JA[node.stat]} ${node.step - 1}段 → ${node.step}段` })]));
      lines.push(el("p", { text: `・${STEP_TEXT[node.stat][node.step - 1]}（${STAT_WHERE[node.stat]}）` }));
      const rankBefore = rankOfStep(node.stat, node.step - 1), rankAfter = rankOfStep(node.stat, node.step);
      if (rankBefore !== rankAfter) lines.push(el("p", { text: `・ランク名が「${rankAfter}」に` }));
      const q = QUALITY_STEPS[node.stat]?.[node.step];
      if (q) lines.push(el("p.gb-p-quality", { text: `✦ ${q}` }));
    } else {
      lines.push(el("p.gb-p-title", [el("span.gb-badge.small.skill", { text: SKILL_GLYPH[node.id], style: { "--c": `var(--stat-${node.colors[0]})` } }), el("b", { text: `スキル「${node.name}」` }),
        el("small", { text: `　${node.colors.map((c) => STAT_HEAD[c]).join("×")}・第${node.ring}輪・効く場面：${node.scene}` })]));
      lines.push(el("p", { text: `・${node.text}` }));
    }
    lines.push(el(`p.gb-p-state.s-${st}`, { text: statusText(node, st, v) }));
    const actions = [];
    if (st === "available") actions.push(el("button.btn.gb-light", { text: `灯す（火種${node.cost}）`, dataset: { test: "board-light" }, onclick: () => light(node.id) }));
    if (st === "pending") actions.push(el("button.btn.gb-undo", { text: "やめる", dataset: { test: "board-undo" }, onclick: () => unlight(node.id) }));
    actions.push(decide);
    footer.replaceChildren(el("div.gb-preview", { dataset: { test: "board-preview" } }, lines), el("div.gb-actions", actions));
  }

  function statusText(node, st, v) {
    if (st === "unlocked") return "灯してある";
    if (st === "pending") return "仮置き中。決定するまでは「やめる」で戻せる";
    if (st === "locked") return `第${node.ring}章で開く`;
    if (st === "waiting") return `先に「${STAT_JA[node.stat]} ${node.step - 1}段」を灯す（段は下から順に上がる）`;
    if (st === "short") {
      const have = HIDANE_KEYS.reduce((n, k) => n + (k === "any" || node.colors.includes(k) ? v.hidane[k] : 0), 0);
      const info = gaugeInfo(g);
      return `火種があと${node.cost - have}つ要る（次のLvまで EXP ${info.left}）。火種は貯めておける`;
    }
    return `${payText(replayPay(node, v))}で払う`;
  }

  function legend(st, text) { return el("span.gb-legend-item", [el(`i.s-${st}`), el("span", { text })]); }

  function render() {
    const v = view();
    pending = v.pending;
    renderHeader(v); renderBoard(v); renderSide(v); renderFooter(v);
  }
  function select(id, sound) {
    selected = id;
    if (sound) SE.click?.();
    render();
    nodeLayer.querySelector(`[data-test="board-node-${id}"]`)?.focus({ preventScroll: true });
  }
  function light(id) {
    pending = [...pending, id];
    SE.select?.();
    render();
    const n = nodeLayer.querySelector(`[data-test="board-node-${id}"]`);
    n?.classList.add("lit-now");
    n?.focus({ preventScroll: true });
  }
  function unlight(id) {
    // 同じ色の上の段の仮置きも外れる（段の順を崩さない）
    const node = NODE_BY_ID[id];
    pending = pending.filter((p) => p !== id && !(node.kind === "stat" && NODE_BY_ID[p].kind === "stat" && NODE_BY_ID[p].stat === node.stat && NODE_BY_ID[p].step > node.step));
    SE.cancel?.();
    render();
  }
  async function help() {
    await modal({
      title: "心得の盤の見方", className: "gboard-help",
      body: el("div", [
        el("p", { text: "レベルが上がるともらえる「火種」で、ノードに火を灯す。灯す条件は3つだけ：その輪が開いている（章で開く）、火種が足りる、能力は下の段から順に。" }),
        el("p", { text: "丸いノードは能力を1段上げる（火種1）。六角形はスキル（火種2〜4）。線でつながっていなくても取れる。" }),
        el("p", { text: "色のついた火種は、その色の能力と、その色のスキルにだけ使える。払うときは先に使われる。" }),
        el("p", { text: "選んだノードは「仮置き」になり、「決定して閉じる」で確定する。決定するまでは戻せる。" }),
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
    if (owner === state) {
      emit("hud");
      // 灯した能力ごとに STEP UP、スキルは SKILL（6.3）
      const lifted = new Map();
      for (const node of committed) if (node.kind === "stat") lifted.set(node.stat, Math.max(lifted.get(node.stat) || 0, node.step));
      for (const [stat, step] of lifted) gainCard({ kind: "stat", stat, top: "STEP UP", main: STAT_JA[stat], evolution: `${step}段`, fx: STEP_TEXT[stat][step - 1] });
      for (const node of committed) if (node.kind === "skill") gainCard({ kind: "info", badge: SKILL_GLYPH[node.id], top: "SKILL", main: node.name, sub: node.text });
    }
    resolveDone(committed);
  }
  function onKey(e) {
    if (e.key !== "Escape" || document.querySelector("#modal.show")) return;
    e.preventDefault();
    close();
  }

  current = { done };
  layers.fx.append(root);
  document.addEventListener("keydown", onKey, true);
  render();
  requestAnimationFrame(() => root.classList.add("show"));
  return done;
}
