// 縦画面「煙の舞台」: 心得の盤。見た目は試作の縦の盤（remake/previews/portrait-stage/growth.mjs・growth.css・VPM04・VPM15）と同じ:
//   上＝地図へ戻る・題・レベル・手持ちの火種と、盤の札3枚／真ん中＝盤（大きく見せて一画面に全部は出さない。選んでいるマスにカーソル、
//   十字キーで隣のマスへ動くと盤がついてくる。指でずらす・つまんで拡大・「全体」「まとめ」）／その下＝選んでいるマスの札。
//   十字キーと丸ボタンは、外枠の下画面（どの場面でも同じ位置・VPN09）。丸ボタン＝選んでいるマスでできること（灯す・決定・目標）。
// 盤の中身（灯したマス・仮置き・火種・払い方・章で開く所・授業の錠）は本編の盤の画面（daily/growth-board-screen.js）が持っている。
// ここは本編の盤の「読み取りと操作の口」（boardControl）から状態を読んで描き、押した・灯した・決定したは本編の盤の関数へ渡す
// （払い方・仮置き・決定・保存・音・はじめての案内・決定の知らせは本編のまま）。本編の盤は演出の層に見えないまま開いている。
// 盤の上に出る確かめ（決定しますか？）・見方の小窓は、シートの写し（looks/neo/portrait-shell/sheet.js）で重ねる。はじめての案内は吹き出しで写す。
import { el } from "../../core/util.js";
import { state } from "../../core/state.js";
import {
  BOARD_KEYS, BOARD_JA, BOARD_HEAD, HIDANE_NAME, HUB_AT, GRID, FEATURES, NOTABLES, REWARD_JA, perkIcon,
  HUB, LAYOUTS, NODE_BY_ID, boardNodes, perkOf, statCount, statTotal, perkTotals, lessonKnown, lessonLock, boardRoutes, pendingTowards,
} from "../../core/growth-board.js";
import { HIDANE_KEYS, gaugeInfo } from "../../core/growth.js";
import { displayName } from "../../core/data.js";
import { paginateForBox } from "../../vn/layout.js";
import { createSheetScene as createRetroSheet } from "../neo/portrait-shell/sheet.js";
import { escapeHtml as esc, textOf, liveBackground, cssUrl } from "./frame.js";

const IMG = new URL("../../../img/", import.meta.url).href;
const art = (name) => `${IMG}ui/growth_board/${name}.webp`;
// 盤の色（本編 daily/growth-fx.js の HIDANE_COLOR と同じ意味: 紅・蒼・翠・白金）
const COLOR = { any: "#ffe9b8", body: "#ff8a5c", sense: "#6fc3ff", wisdom: "#6fe0a0" };
// 盤の方眼: 1マスの間隔（単位 u＝スマホの幅 39 の 1）と、盤の縁の余白（マス）。座標は紋からのずれ（HUB_AT を足すと方眼の座標）
const CELL = 5.6, EDGE = 0.95;
const PLANE_W = (GRID.w * 2 + EDGE * 2) * CELL, PLANE_H = (GRID.h + EDGE * 2) * CELL;
const hubXY = (board) => HUB_AT[board].split(",").map(Number);
const planeXY = (board, gx, gy) => { const [hx, hy] = hubXY(board); return [(gx + hx + GRID.w + EDGE) * CELL, (gy + hy + GRID.h + EDGE) * CELL]; };
// 盤の見える大きさ: ふだんは NEAR（横に5マスほど）。指でつまむと ZOOM_MAX まで寄れる
const NEAR = 1.36, ZOOM_MAX = 1.9;
const HEADING = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
/** その盤で、はじめにカーソルを置くマス: 紋のすぐ上（無ければ紋の隣）。 */
const startNode = (board) => { const sides = boardNodes(board).filter((n) => n.links.includes(HUB)); return (sides.find((n) => n.gx === 0 && n.gy === -1) || sides[0])?.id || null; };
/** 十字キーの行き先: その向きの斜め45度までの中で、いちばん近いマス（真っ直ぐと、線でつながった隣を先に）。 */
function stepFrom(from, dir) {
  if (!from) return null;
  const [hx, hy] = HEADING[dir];
  let best = Infinity, to = null;
  for (const n of boardNodes(from.board)) {
    const dx = n.gx - from.gx, dy = n.gy - from.gy, along = dx * hx + dy * hy, across = Math.abs(dx * hy - dy * hx);
    if (along <= 0 || across > along) continue;
    const score = along + across * 1.5 - (from.links.includes(n.id) ? 0.4 : 0);
    if (score < best) { best = score; to = n; }
  }
  return to;
}
const fmtNum = (v) => String(Math.round(v * 10) / 10);
const shortPerkValue = (text) => /[＋−][\d.]+(?:%|ポイント)?/.exec(text || "")?.[0].replace("ポイント", "pt") || "";
const fmtPerk = (text, sum) => text.replace(/[\d.]+/, fmtNum(sum));
const whoName = (who) => (who === "sumi" ? "スミさん" : displayName(who, state));
const CHEVRON = '<svg class="vt-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5"/></svg>';
const STATUS_WORD = { unlocked: "灯してある", pending: "仮置き中", locked: "結界の先", sealed: "授業の錠", far: "道がまだ", short: "火種が足りない", available: "今灯せる" };

let screenModule = null;
const loadScreen = () => screenModule ? Promise.resolve(screenModule)
  : import("../../daily/growth-board-screen.js").then((module) => { screenModule = module; return module; });

/** 本編の盤が開いているか。 */
export const boardOpen = () => !!document.querySelector("#fx > .gboard");

export function createBoardScene(frame) {
  // 骨組み（試作の growth.mjs の html と同じ並び。押す所は data-act）
  const root = el("div.vb", { dataset: { test: "vt-board" } });
  root.innerHTML = `
    <div class="vb-top">
      <div class="vb-head">
        <button class="vb-back" type="button" data-act="leave" aria-label="閉じる" data-test="vt-board-close">${CHEVRON}<span>地図</span></button>
        <h2>心得の盤</h2>
        <span class="vb-lv" data-slot="lv"></span>
        <span class="vb-wallet" data-slot="wallet" data-test="vt-board-wallet"></span></div>
      <div class="vb-tabs" role="tablist" data-slot="tabs"></div>
    </div>
    <div class="vb-view" data-slot="view">
      <div class="vb-plane" style="background-image:url(${art("board_glass")})">
        <svg class="vb-lines" aria-hidden="true"></svg>
        <div class="vb-nodes"></div>
      </div>
      <div class="vb-pend" data-slot="pend" hidden></div>
      <div class="vb-tut" data-slot="tut" hidden></div>
    </div>
    <div class="vb-card" data-slot="card" data-test="vt-board-card"></div>
    <div class="vb-sheet" data-slot="sheet" hidden></div>
    <div class="vb-result" data-slot="result" hidden></div>`;
  const q = (selector) => root.querySelector(selector);
  const refs = { view: q('[data-slot="view"]'), plane: q(".vb-plane"), lines: q(".vb-lines"), nodes: q(".vb-nodes"), wallet: q('[data-slot="wallet"]'),
    lv: q('[data-slot="lv"]'), tabs: q('[data-slot="tabs"]'), card: q('[data-slot="card"]'), pend: q('[data-slot="pend"]'), tut: q('[data-slot="tut"]'),
    sheet: q('[data-slot="sheet"]'), result: q('[data-slot="result"]') };
  // 盤の上の小窓（確かめ・見方）の写し
  const modalHost = el("div.retro-shell.vt-sheet-host.vt-board-modal", { hidden: true, dataset: { paint: "hd", scene: "sheet" } });
  const modalTop = el("div.vt-sheet-top"), modalBottom = el("div.vt-sheet-bottom");
  modalHost.append(modalTop, modalBottom);
  let modalKeys = [];
  const modal = createRetroSheet({ top: modalTop, bottom: modalBottom, setStatus() {}, setKeys(items) { modalKeys = items; }, setCaption() {} }, { paintCover: () => false });
  modalBottom.append(modal.pane);
  let modalOn = false;

  let ctl = null, peek = null, v = null, board = "body", cursor = null, cam = null, overview = false, sheet = false, sig = "", lastBoard = null;
  let drag = null, pinch = null, moved = false;
  const pointers = new Map();
  const u = () => (frame.root.clientWidth || 390) / 39; // 1単位の px
  const statusOf = (node) => (node && ctl ? ctl.statusOf(node.id) : null);

  /* ── 見せ方の部品 ── */
  const revealOf = (node) => (ctl ? ctl.revealOf(node.id) : "open");
  const hiddenSkill = (node) => node.kind === "skill" && revealOf(node) === "hidden";
  function nodeIcon(node) {
    if (node.kind === "lesson") return lessonKnown(node, peek?.g) ? art(`faces/new/${node.who}`) : art("silhouette_unknown");
    if (node.kind === "gate") return art(`hidane_${node.board}`);
    if (hiddenSkill(node)) return art("badge_unknown");
    if (node.kind === "skill") return art(`icons/skill_${node.id}`);
    return art(`icons/${node.peak ? "peak" : perkIcon(node.perk)}`);
  }

  /* ── 描画 ── */
  function render() {
    root.dataset.board = board;
    root.style.setProperty("--bc", COLOR[board]);
    renderTop(); renderBoard(); renderCard(); renderPend();
    if (sheet) renderSheet();
    refs.sheet.hidden = !sheet;
  }

  function renderTop() {
    const info = gaugeInfo(peek.g);
    refs.lv.innerHTML = `<small>Lv</small><b>${info?.level ?? 1}</b>`;
    refs.lv.setAttribute("aria-label", `レベル${info?.level ?? 1}`);
    // 手持ちの火種（仮置きの分を引いた残り）
    refs.wallet.innerHTML = HIDANE_KEYS.map((k) => `<span class="vb-fire${v.hidane[k] ? "" : " zero"}" aria-label="${HIDANE_NAME[k]} ${v.hidane[k] || 0}"><img src="${art(`hidane_${k}`)}" alt=""><b>${v.hidane[k] || 0}</b></span>`).join("");
    refs.tabs.innerHTML = BOARD_KEYS.map((k) => {
      const count = statCount(k, v.unlocked), ready = peek.canLight ? boardNodes(k).filter((n) => statusOf(n) === "available").length : 0;
      return `<button type="button" class="vb-tab" role="tab" data-act="tab" data-board="${k}" aria-selected="${k === board}" style="--bc:${COLOR[k]}" data-test="vt-board-tab-${k}">
        <i>${BOARD_HEAD[k]}</i><b>${BOARD_JA[k]}盤</b><span>${count}/${statTotal(k)}</span>${peek.target && NODE_BY_ID[peek.target]?.board === k ? `<em class="aim" aria-label="目標がある">◎</em>` : ready ? `<em aria-label="今灯せるマスがある"></em>` : ""}</button>`;
    }).join("");
  }

  function renderBoard() {
    const nodes = boardNodes(board), layout = LAYOUTS[board], k = u();
    const byCell = Object.fromEntries(nodes.map((n) => [n.cell, n]));
    const stOf = Object.fromEntries(nodes.map((n) => [n.id, statusOf(n)]));
    const lit = (id) => id === HUB || stOf[id] === "unlocked";
    const on = (id) => lit(id) || stOf[id] === "pending";
    refs.plane.style.width = `${(PLANE_W * k).toFixed(1)}px`; refs.plane.style.height = `${(PLANE_H * k).toFixed(1)}px`;
    refs.lines.setAttribute("viewBox", `0 0 ${PLANE_W} ${PLANE_H}`);
    // 線: 紋から隣へ、マスからマスへ。灯した道は盤の色、仮置きの道は金の点線
    const [hx, hy] = planeXY(board, 0, 0);
    const seg = (a, b, x1, y1, x2, y2) => `<line x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" class="${lit(a) && lit(b) ? "lit" : on(a) && on(b) ? "pending" : ""}${[a, b].some((id) => id !== HUB && stOf[id] === "locked") ? " locked" : ""}"/>`;
    const lines = [];
    for (const n of nodes) if (n.links.includes(HUB)) { const [x, y] = planeXY(board, n.gx, n.gy); lines.push(seg(HUB, n.id, hx, hy, x, y)); }
    for (const [a, b] of layout.edges) {
      const na = byCell[a], nb = byCell[b];
      if (!na || !nb) continue;
      const [x1, y1] = planeXY(board, na.gx, na.gy), [x2, y2] = planeXY(board, nb.gx, nb.gy);
      lines.push(seg(na.id, nb.id, x1, y1, x2, y2));
    }
    refs.lines.innerHTML = lines.join("");
    const px = (n) => `${(n * k).toFixed(1)}px`;
    const hub = `<span class="vb-hub" style="left:${px(hx)};top:${px(hy)}" aria-hidden="true"><img src="${art(`hub_${board}`)}" alt=""><b>${BOARD_HEAD[board]}</b></span>`;
    refs.nodes.innerHTML = hub + nodes.map((node) => {
      const st = stOf[node.id], [x, y] = planeXY(board, node.gx, node.gy);
      const known = lessonKnown(node, peek.g), perk = perkOf(node);
      const kind = node.peak ? "peak" : node.kind;
      // 結界の入口（開いている章のマスと線でつながる、まだ開いていないマス）にだけ錠を出す
      const entrance = st === "locked" && node.links.some((id) => id === HUB || statusOf(NODE_BY_ID[id]) !== "locked");
      // マスの下の短い札: 能力＝増える量、スキル＝火種の数、授業＝今の段（♥・今・相談）
      let tag = "";
      if (st !== "locked") {
        const lock = lessonLock(node, v.unlocked);
        if (node.kind === "stat" || node.kind === "gate") tag = st === "unlocked" ? "" : `<span class="vb-tag">${shortPerkValue(perk?.text)}</span>`;
        else if (node.kind === "skill") tag = st === "unlocked" || hiddenSkill(node) ? "" : `<span class="vb-tag cost"><img src="${art("hidane_any")}" alt="">${node.cost}</span>`;
        else if (!known) tag = "";
        else if (st === "unlocked") tag = `<span class="vb-tag talk">相談</span>`;
        else if (lock) tag = `<span class="vb-tag heart">♥${lock.heartNow}/${node.need}</span>`;
        else if (st === "available") tag = `<span class="vb-tag now">今</span>`;
      }
      const veiled = hiddenSkill(node) || (node.kind === "lesson" && !known);
      return `<button type="button" class="vb-node k-${kind} s-${st}${node.notable ? " notable" : ""}" data-act="node" data-id="${node.id}" aria-pressed="${cursor === node.id}"
          style="left:${px(x)};top:${px(y)}" aria-label="${esc(ctl?.nodeTitle(node.id) || node.id)}（${STATUS_WORD[st] || ""}）" data-test="vt-board-node-${node.id}">
        <i class="vb-base"></i><img class="vb-ico" src="${nodeIcon(node)}" alt="" draggable="false">
        ${veiled ? `<b class="vb-q">?</b>` : ""}${node.feature ? `<b class="vb-star">✦</b>` : ""}
        ${st === "unlocked" ? `<em class="vb-mark">✓</em>` : st === "pending" ? `<em class="vb-mark plus">＋</em>` : ""}
        ${peek.target === node.id && st !== "unlocked" ? `<em class="vb-aim">◎</em>` : ""}
        ${entrance ? `<img class="vb-lock" src="${art("wall_seal")}" alt="">` : ""}${tag}
      </button>`;
    }).join("");
  }

  /** そのマスを目標にできるか（まだ灯していない・仮置きでない・結界の内・誰の授業か分かっている）。 */
  const canTarget = (node, st) => !peek.g.nodes.includes(node.id) && st !== "pending" && st !== "locked" && !(node.kind === "lesson" && !lessonKnown(node, peek.g));

  /** 丸ボタンの働き（選んでいるマスでできる、いちばん主なこと）。 */
  function primary() {
    const node = NODE_BY_ID[cursor];
    if (!node || !peek) return { text: "", label: "マスを選ぶ", run: null };
    const st = statusOf(node), id = node.id;
    if (st === "available" && peek.canLight) {
      const text = node.kind === "gate" ? "はめる" : node.cost ? "灯す" : "教わる";
      return { text, label: `${text}（仮置き）`, run: () => { if (peek.selected !== id) ctl.tap(id); ctl.light(id); } };
    }
    if (peek.pending.length || peek.rebuilding) return { text: "決定", label: `決定（${peek.pending.length}つ灯す）`, run: () => decide() };
    if (canTarget(node, st)) {
      if (peek.target !== id) return { text: "目標", label: "目標にする", run: () => ctl.toggleTarget(id) };
      if (peek.canLight && pendingTowards(peek.g, peek.pending, id).length > peek.pending.length) return { text: "灯す", label: "目標まで灯す（仮置き）", run: () => ctl.towards(id) };
      return { text: "解除", label: "目標をやめる", run: () => ctl.toggleTarget(id) };
    }
    return { text: st === "unlocked" ? "済" : "", label: STATUS_WORD[st] || "", run: null };
  }

  /** 選んでいるマスの札。左に絵と小さな押す所（目標・やめる）、右に名前・今の状態・効果の一行・説明。 */
  function renderCard() {
    const node = NODE_BY_ID[cursor];
    if (!node) { refs.card.innerHTML = ""; return; }
    const st = statusOf(node), perk = perkOf(node), known = lessonKnown(node, peek.g);
    let kind = "", name, text, sub = "";
    if (node.kind === "stat") {
      kind = node.peak ? "極み" : perk?.notable ? "要のマス" : "";
      name = node.peak ? `${BOARD_JA[node.board]}の極み` : perk?.notable ? perk.notable.name : perk?.name;
      sub = perk?.text || "";
      const total = perkTotals(node.board, v.unlocked).find((p) => p.key === node.perk);
      text = perk?.notable ? perk.notable.text : node.feature ? `✦ 灯すと「${FEATURES[node.feature].text}」` : total && !node.peak ? `この盤の合計：${shortPerkValue(total.text) || total.text}` : "";
    } else if (node.kind === "gate") {
      kind = "色の台座"; name = perk?.name || "色の台座";
      text = `${HIDANE_NAME[node.board]}をはめると先へ進めて、この台座の能力が手に入る`; sub = perk?.text || "";
    } else if (node.kind === "skill") {
      const hidden = hiddenSkill(node);
      kind = "スキル"; name = hidden ? "？？？" : node.name; text = hidden ? "物語が進むと盤に現れる" : node.text; sub = hidden ? "" : `効く場面：${node.scene}・火種${node.cost}`;
    } else if (!known) {
      kind = "授業"; name = "？？？の授業"; text = "まだ出会っていない誰かが、ここで何かを教えてくれるらしい";
    } else {
      kind = `${whoName(node.who)}の授業`; name = node.name; text = `${REWARD_JA[node.reward] || ""}：${node.text}`;
    }
    const side = st === "pending" ? `<button type="button" class="vb-side" data-act="undo" data-test="vt-board-undo">やめる</button>`
      : canTarget(node, st) ? `<button type="button" class="vb-side aim" data-act="target" aria-pressed="${peek.target === node.id}" aria-label="${peek.target === node.id ? "目標をやめる" : "目標にする"}" data-test="vt-board-target"><i>◎</i>目標</button>` : "";
    refs.card.innerHTML = `
      <div class="vb-card-side k-${node.peak ? "peak" : node.kind} s-${st}">
        <span class="vb-art"><img src="${nodeIcon(node)}" alt="">${(node.kind === "lesson" && !known) || hiddenSkill(node) ? "<b>?</b>" : ""}</span>
        ${side}
      </div>
      <div class="vb-card-main">
        <div class="vb-name">${kind ? `<small>${esc(kind)}</small>` : ""}<b>${esc(name || "")}</b></div>
        <p class="vb-state s-${st}">${esc(ctl.stateText(node.id))}</p>
        ${sub ? `<p class="vb-sub" data-fit>${esc(sub)}</p>` : ""}
        ${text ? `<p class="vb-text" data-fit>${esc(text)}</p>` : ""}
      </div>`;
    fitTexts();
  }

  /** 札の文は本編の組版で折る（効果と説明は、それぞれ2行まで・合わせて3行まで。収まらない時は字を一段小さく、それでも余る文は押すと続き）。 */
  function fitTexts() {
    const card = refs.card;
    for (const [sel, steps] of [[".vb-name b", ["fit1", "fit2"]], [".vb-state", ["fit1"]]]) {
      const node = card.querySelector(sel);
      if (!node) continue;
      node.classList.remove("fit1", "fit2");
      for (const step of steps) { if (node.scrollWidth <= node.clientWidth + 1) break; node.classList.remove("fit1"); node.classList.add(step); }
    }
    let left = 3;
    for (const node of card.querySelectorAll("[data-fit]")) {
      const text = node.dataset.full ?? node.textContent, lines = Math.max(1, Math.min(2, left));
      node.dataset.full = text;
      node.classList.remove("vb-small", "vb-paged", "vb-fitted");
      node.textContent = text;
      if (!text || !node.clientWidth) continue;
      let pages = paginateForBox(text, node, undefined, lines);
      const oneLine = node.classList.contains("vb-sub") && pages.length === 1 && pages[0].includes("\n");
      if (pages.length > 1 || oneLine) {
        node.classList.add("vb-small");
        const smaller = paginateForBox(text, node, undefined, lines);
        if (oneLine && smaller[0].includes("\n")) node.classList.remove("vb-small"); else pages = smaller;
      }
      if (pages.length > 1) { node.classList.add("vb-paged"); pages = paginateForBox(text, node, undefined, lines); }
      const at = Math.min(Number(node.dataset.page) || 0, pages.length - 1);
      node.innerHTML = esc(pages[at]).split("\n").join("<br>");
      left -= pages[at].split("\n").length;
      node.classList.add("vb-fitted");
      if (pages.length > 1) { node.dataset.act = "more"; node.dataset.pages = String(pages.length); node.dataset.page = String(at); }
    }
  }

  /** 仮置きがある間に、盤の下に浮かぶ「取り消す・決定」。 */
  function renderPend() {
    const n = peek.pending.length, key = `${n}|${peek.rebuilding}`;
    refs.pend.hidden = !n && !peek.rebuilding;
    if (refs.pend.dataset.key === key) return;
    refs.pend.dataset.key = key;
    refs.pend.innerHTML = n || peek.rebuilding ? `<button type="button" class="vb-pill" data-act="reset" data-test="vt-board-reset">取り消す</button><button type="button" class="vb-pill gold" data-act="decide" data-test="vt-board-decide">決定（${n}）</button>` : "";
  }

  /** 盤のまとめの札: その盤の恩恵の合計（仮置きを含む）と、近い目的地（押すとそのマスへ）。 */
  function renderSheet() {
    const totals = perkTotals(board, v.unlocked), base = perkTotals(board, new Set(peek.g.nodes));
    const perks = totals.map((p, i) => `<span class="vb-perk${p.sum > base[i].sum ? " up" : ""}" aria-label="${esc(p.name)}：${esc(p.text)}">
      <img src="${art(`icons/${perkIcon(p.key)}`)}" alt=""><b>${shortPerkValue(p.text)}</b><small>${esc(p.name)}</small><i><i style="width:${p.max ? Math.round(p.sum / p.max * 100) : 0}%"></i></i></span>`).join("");
    const route = boardRoutes(board, v.unlocked), goals = [];
    for (const n of boardNodes(board)) {
      if (v.unlocked.has(n.id) || n.peak || !(n.kind === "skill" || n.kind === "lesson" || n.kind === "gate" || n.feature || n.notable)) continue;
      const st = statusOf(n);
      if (st === "locked" || (n.kind === "lesson" && !lessonKnown(n, peek.g)) || hiddenSkill(n)) continue;
      goals.push({ n, st, cost: route(n.id).cost });
    }
    goals.sort((a, b) => a.cost - b.cost || a.n.ring - b.n.ring);
    const rows = goals.slice(0, 3).map(({ n, st, cost }) => {
      const name = n.kind === "gate" ? perkOf(n)?.name || "" : n.feature ? FEATURES[n.feature].name : n.notable ? NOTABLES[n.notable].name : n.name;
      const side = st === "sealed" ? `<em class="lock">♥${n.need}</em>` : cost ? `<em><img src="${art("hidane_any")}" alt="">${cost}</em>` : `<em class="now">今</em>`;
      return `<button type="button" class="vb-goal k-${n.kind}" data-act="goal" data-id="${n.id}" aria-label="${esc(name)} 火種${cost}"><span class="vb-goal-ico"><img src="${nodeIcon(n)}" alt=""></span><b>${esc(name)}</b>${side}</button>`;
    }).join("");
    refs.sheet.innerHTML = `<div class="vb-sheet-card" style="--bc:${COLOR[board]}"><div class="vb-sum-head"><b>${BOARD_JA[board]}盤</b><span>${statCount(board, v.unlocked)}/${statTotal(board)}</span></div>
      <div class="vb-perks">${perks}</div><small class="vb-sum-label">近い目的地（押すと、そのマスへ）</small><div class="vb-goals">${rows}</div>
      <button type="button" class="vb-btn" data-act="sheet-close">盤へ戻る</button></div>`;
  }

  /** 決定: 本編の盤で決定する（保存と知らせは本編）。盤が閉じるまでの間、灯した数と増えた能力の札を出す。 */
  function decide() {
    const committed = peek.pending.map((id) => NODE_BY_ID[id]).filter(Boolean);
    const before = new Set(peek.g.nodes), after = new Set([...before, ...committed.map((n) => n.id)]);
    if (committed.length) {
      const rows = [];
      for (const b of BOARD_KEYS) {
        if (!committed.some((n) => n.board === b && (n.kind === "stat" || n.kind === "gate"))) continue;
        const was = perkTotals(b, before), now = perkTotals(b, after);
        for (const p of now) {
          const delta = p.sum - (was.find((x) => x.key === p.key)?.sum || 0);
          if (delta > 0.001) rows.push(`<li><img src="${art(`icons/${perkIcon(p.key)}`)}" alt=""><span>${esc(p.name)}</span><b>${shortPerkValue(fmtPerk(p.text, delta))}</b></li>`);
        }
      }
      refs.result.innerHTML = `<div class="vb-result-card" style="--bc:${COLOR[committed[0].board]}"><img class="vb-rays" src="${art("burst_rays")}" alt="">
        <small>LIGHT UP</small><strong>火を<b>${committed.length}</b>つ灯した</strong>${rows.length ? `<ul class="vb-gains">${rows.join("")}</ul>` : ""}</div>`;
      refs.result.hidden = false;
    }
    ctl.decide();
  }

  /* ── 盤の見える位置（カーソルを追う・指でずらす・つまんで拡大・全体） ── */
  function viewSize() {
    const k = u(), view = refs.view, pend = refs.pend;
    const pad = pend.hidden ? 0 : view.clientHeight - pend.offsetTop + 0.5 * k;
    return [view.clientWidth / k, (view.clientHeight - pad) / k];
  }
  const fitScale = () => { const [w, h] = viewSize(); return Math.min(w / PLANE_W, h / PLANE_H); };
  function setCam(next, animate = true) {
    const [w, h] = viewSize();
    if (!w || !h) return;
    const s = Math.max(fitScale(), Math.min(ZOOM_MAX, next.s));
    const clamp = (val, size, span) => size * s <= span ? (span - size * s) / 2 : Math.min(0, Math.max(span - size * s, val));
    cam = { s, x: clamp(next.x, PLANE_W, w), y: clamp(next.y, PLANE_H, h) };
    const k = u();
    refs.plane.classList.toggle("no-anim", !animate);
    refs.plane.style.transform = `translate(${(cam.x * k).toFixed(1)}px, ${(cam.y * k).toFixed(1)}px) scale(${cam.s.toFixed(3)})`;
    root.dataset.far = String(s < 0.72); // 引いた時は、マスの下の小さい札を出さない
  }
  function focus(id, animate = true) {
    const node = NODE_BY_ID[id], [w, h] = viewSize();
    if (!node || !w) return;
    const [x, y] = planeXY(node.board, node.gx, node.gy);
    const s = overview || !cam || cam.s < 1 ? NEAR : cam.s;
    overview = false;
    setCam({ s, x: w / 2 - x * s, y: h / 2 - y * s }, animate);
  }
  function home(animate = true) {
    if (overview) { setCam({ s: fitScale(), x: 0, y: 0 }, animate); return; }
    focus(cursor, animate);
  }
  function zoomAt(scale, mx, my, from = cam) {
    if (!from) return;
    const s = Math.max(fitScale(), Math.min(ZOOM_MAX, scale));
    const px = (mx - from.x) / from.s, py = (my - from.y) / from.s;
    setCam({ s, x: mx - px * s, y: my - py * s }, false);
  }
  const syncOverview = () => { overview = !!cam && cam.s <= fitScale() + 0.01; padState(); };

  refs.view.addEventListener("pointerdown", (event) => {
    if (event.target.closest(".vb-pend, .vb-tut")) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) drag = { x: event.clientX, y: event.clientY, cam: { ...cam }, moved: false };
    else if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cam: { ...cam } }; drag = null; moved = true; }
  });
  refs.view.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId) || !cam) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const k = u();
    if (pinch && pointers.size >= 2) {
      const [a, b] = [...pointers.values()], box = refs.view.getBoundingClientRect();
      zoomAt(pinch.cam.s * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d, ((a.x + b.x) / 2 - box.left) / k, ((a.y + b.y) / 2 - box.top) / k, pinch.cam);
      return;
    }
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true; moved = true;
    try { refs.view.setPointerCapture?.(event.pointerId); } catch { /* 指が離れた後に届いた時は、つかまずに続ける */ }
    setCam({ s: drag.cam.s, x: drag.cam.x + dx / k, y: drag.cam.y + dy / k }, false);
  });
  const up = (event) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) { drag = null; if (moved) { syncOverview(); setTimeout(() => { moved = false; }, 0); } }
  };
  refs.view.addEventListener("pointerup", up);
  refs.view.addEventListener("pointercancel", up);
  refs.view.addEventListener("wheel", (event) => {
    if (!cam) return;
    event.preventDefault();
    const k = u(), box = refs.view.getBoundingClientRect();
    zoomAt(cam.s * (event.deltaY < 0 ? 1.12 : 0.89), (event.clientX - box.left) / k, (event.clientY - box.top) / k);
    syncOverview();
  }, { passive: false });

  /** カーソルをそのマスへ（本編の盤でも選ぶ。盤が違えば盤も替わる）。 */
  function select(id) {
    if (!NODE_BY_ID[id] || !ctl) return;
    cursor = id;
    ctl.tap(id);
    pull();
    sig = "";
    render();
    focus(id);
    padState();
  }

  root.addEventListener("click", (event) => {
    if (moved) { moved = false; return; }
    const hit = event.target.closest("[data-act]");
    if (!hit) {
      if (event.target === refs.sheet) { sheet = false; refs.sheet.hidden = true; padState(); }
      return;
    }
    event.stopPropagation();
    if (!ctl) return;
    const act = hit.dataset.act, id = cursor;
    if (act === "sheet-close") { sheet = false; refs.sheet.hidden = true; padState(); return; }
    if (act === "goal") { sheet = false; refs.sheet.hidden = true; select(hit.dataset.id); return; }
    if (sheet) return;
    if (act === "node") {
      // マスを押すとカーソルが移る。カーソルのあるマスをもう一度押した時は、灯せるなら灯す（本編の盤と同じ）
      if (hit.dataset.id !== id || overview) { select(hit.dataset.id); return; }
      ctl.tap(id);
    }
    else if (act === "tab") { ctl.setBoard(hit.dataset.board); cursor = null; overview = false; }
    else if (act === "more") { hit.dataset.page = String((Number(hit.dataset.page) + 1) % Number(hit.dataset.pages)); fitTexts(); return; }
    else if (act === "undo") ctl.unlight(id);
    else if (act === "target") ctl.toggleTarget(id);
    else if (act === "reset") ctl.reset();
    else if (act === "decide") decide();
    else if (act === "leave") ctl.close();
    refresh();
  });

  /** 本編の盤の今の状態を読む。 */
  function pull() {
    ctl = screenModule?.boardControl?.() || null;
    if (!ctl) return false;
    peek = ctl.peek();
    v = peek.view;
    board = peek.board;
    if (peek.selected && NODE_BY_ID[peek.selected]?.board === board) cursor = peek.selected;
    if (!cursor || NODE_BY_ID[cursor]?.board !== board) cursor = startNode(board);
    return true;
  }
  /** 本編の盤を動かした後に、読み直して描き直す。 */
  function refresh() {
    if (!pull()) return;
    const boardChanged = board !== lastBoard;
    sig = ""; lastBoard = board;
    render();
    if (boardChanged || !cam) home(); else if (cursor) focus(cursor);
    renderTutorial();
    padState();
  }

  /** 十字キー・丸ボタン・補助ボタン（外枠の下画面）。 */
  function padState() {
    if (!peek) return;
    const next = tutorialButton(true), skip = tutorialButton(false);
    if (next) {
      frame.setChips(skip ? [{ id: "tutorial-skip", icon: "close", label: "説明を閉じる" }] : []);
      frame.setPad({ dirs: [], a: { face: "next", label: textOf(next) } });
      return;
    }
    const node = NODE_BY_ID[cursor];
    frame.setChips([
      skip ? { id: "tutorial-skip", icon: "close", label: "説明を閉じる" } : { id: "help", icon: "help", label: "見方" },
      { id: "sum", icon: "list", label: "まとめ", on: sheet },
      { id: "zoom", icon: overview ? "near" : "wide", label: overview ? "寄る" : "全体", on: overview },
      { id: "close", icon: "close", label: "閉じる" },
    ]);
    if (sheet || !refs.result.hidden) { frame.setPad({ dirs: [], a: { face: "next", label: "盤へ戻る", disabled: !refs.result.hidden } }); return; }
    if (overview) { frame.setPad({ dirs: ["up", "down", "left", "right"], a: { face: "ok", text: "寄る", label: "寄る" } }); return; }
    const p = primary();
    frame.setPad({
      dirs: Object.keys(HEADING).filter((dir) => node && stepFrom(node, dir)),
      a: p.text ? { face: "ok", text: p.text, label: p.label, disabled: !p.run, hot: !!p.run && /灯す|はめる|教わる/.test(p.text) } : { face: "ok", label: p.label, disabled: true },
    });
  }

  /* はじめての盤の案内（本編の growth-board-tutorial.js の吹き出し）を、盤の上の吹き出しとして写す */
  const tutorial = () => document.querySelector("#fx > .gboard .gb-tutorial-bubble");
  const tutorialButton = (primaryButton) => [...(tutorial()?.querySelectorAll("button") || [])].find((button) => button.classList.contains("primary") === primaryButton);
  function renderTutorial() {
    const bubble = tutorial();
    refs.tut.hidden = !bubble;
    if (!bubble) { refs.tut.dataset.sig = ""; return; }
    const title = textOf(bubble.querySelector("h3")), lines = [...bubble.querySelectorAll("p")].map(textOf).filter(Boolean);
    const count = textOf(bubble.querySelector(".gb-tutorial-count")), wait = textOf(bubble.querySelector(".gb-tutorial-wait"));
    const next = JSON.stringify([title, lines, count, wait]);
    if (refs.tut.dataset.sig === next) return;
    refs.tut.dataset.sig = next;
    refs.tut.innerHTML = `<b>${esc(title)}</b>${lines.map((line) => `<p>${esc(line)}</p>`).join("")}<small>${esc([count, wait].filter(Boolean).join("　"))}</small>`;
  }

  function sync(stateInfo) {
    if (!screenModule) { loadScreen().then(() => { if (frame.root.dataset.scene === "board") sync(stateInfo); }); return; }
    // 盤の上の小窓（確かめ・見方）
    const dialog = document.querySelector("#modal.show");
    if (!!dialog !== modalOn) {
      modalOn = !!dialog;
      modalHost.hidden = !modalOn;
      if (modalOn) { modal.pane.hidden = false; modal.enter(); } else { modal.leave(); modal.pane.hidden = true; modalKeys = []; }
    }
    if (modalOn) {
      modal.sync(stateInfo);
      frame.setChips(modalKeys.filter((key) => key.id !== "close").map((key) => ({ id: `m:${key.id}`, icon: "dots", label: key.label })));
      const close = modalKeys.find((key) => key.id === "close");
      frame.setPad({ dirs: ["up", "down"], a: close ? { face: "close" } : null });
      return;
    }
    if (!pull()) return;
    const bg = liveBackground();
    frame.setAmbient(bg ? cssUrl(getComputedStyle(bg).backgroundImage) : "");
    frame.setAccent("#c3b0ff");
    frame.setHud("none");
    const next = JSON.stringify([board, cursor, peek.pending, peek.target, peek.g.nodes.length, v.hidane, peek.canLight, peek.rebuilding, u().toFixed(2)]);
    if (next !== sig) {
      const boardChanged = board !== lastBoard;
      sig = next; lastBoard = board;
      render();
      if (!cam || boardChanged) { overview = false; requestAnimationFrame(() => home(false)); }
    }
    renderTutorial();
    padState();
  }

  return {
    name: "board",
    enter() {
      frame.picture.dataset.kind = "board";
      frame.over.append(root, modalHost);
      frame.over.hidden = false;
      modalOn = false; modalHost.hidden = true;
      sig = ""; cam = null; overview = false; sheet = false; lastBoard = null; cursor = null;
      refs.result.hidden = true; refs.sheet.hidden = true;
      loadScreen();
    },
    leave() { if (modalOn) { modal.leave(); modalOn = false; } ctl = null; peek = null; },
    sync,
    relayout() { if (peek) { sig = ""; render(); home(false); } },
    dir(dir) {
      if (modalOn) {
        const body = modalHost.querySelector(".rs-body");
        body?.scrollBy({ top: (dir === "up" ? -1 : 1) * body.clientHeight * 0.6, behavior: "smooth" });
        return;
      }
      if (!peek || sheet || !refs.result.hidden || tutorialButton(true)) return;
      if (overview) { overview = false; home(); padState(); return; }
      const to = stepFrom(NODE_BY_ID[cursor], dir);
      if (to) select(to.id);
    },
    a() {
      if (modalOn) { modalKeys.find((key) => key.id === "close")?.run?.(); return; }
      const next = tutorialButton(true);
      if (next) { next.click(); return; }
      if (!peek) return;
      if (sheet) { sheet = false; refs.sheet.hidden = true; padState(); return; }
      if (overview) { overview = false; home(); padState(); return; }
      const p = primary();
      if (p.run) { p.run(); refresh(); }
      else { refs.card.classList.remove("vb-nudge"); void refs.card.offsetWidth; refs.card.classList.add("vb-nudge"); }
    },
    chip(id) {
      if (id.startsWith("m:")) { modalKeys.find((key) => key.id === id.slice(2))?.run?.(); return; }
      if (!ctl) return;
      if (id === "tutorial-skip") tutorialButton(false)?.click();
      else if (id === "help") ctl.help();
      else if (id === "close") ctl.close();
      else if (id === "sum") { sheet = !sheet; if (sheet) renderSheet(); refs.sheet.hidden = !sheet; }
      else if (id === "zoom") { overview = !overview; home(); }
      padState();
    },
    tap() {},
  };
}
