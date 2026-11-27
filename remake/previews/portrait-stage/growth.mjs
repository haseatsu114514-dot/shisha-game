// 縦画面C案「煙の舞台」: 心得の盤（能力盤）を縦へ移した試作（要望台帳 VPM04）。
// 盤の形・マス・名前・効果・費用は本編のデータをそのまま読む（remake/js/core/growth-board-data.js・growth-board-layout.js・growth-effects.js。
// どれも状態・保存・音に触れない）。規則（道のつながり・払い方・仮置きの積み直し・近い目的地）は remake/js/core/growth-board.js の写し
// （あちらは本編の状態を読むので import しない）。文言は本編の画面 remake/js/daily/growth-board-screen.js のもの。
// 縦の並べ方（十字キーと丸ボタンは置かない）: 上＝題・レベル・手持ちの火種と盤の札3枚／真ん中＝盤（指でずらす・つまんで拡大・「全体」）／
// 下＝選んだマスの札（名前・効果・今の状態）と「灯す」「目標にする」、いちばん下に「取り消す」「決定」。マスを選んでいない時は、恩恵の合計と近い目的地。
// 状態（レベル・火種・灯したマス・出会った人・♥）はこの場面の中だけの仮の値で、本編の進行・保存には触れない。
import {
  BOARD_KEYS, BOARD_JA, BOARD_HEAD, HIDANE_NAME, HUB_AT, GRID, FEATURES, NOTABLES, PERK_TIERS, GATE_TIER, SQUARE_PERKS, REWARD_JA, perkIcon,
} from "../../js/core/growth-board-data.js";
import { HUB, LAYOUTS, NODES, NODE_BY_ID, boardNodes, isCoreStat } from "../../js/core/growth-board-layout.js";
import { perkMultiplier, boardPerks } from "../../js/core/growth-effects.js";

/* ───────── この試作の仮の状態（第1章 DAY 5・Lv2。地図の上の表示と同じ） ───────── */
// 白火は本編なら Lv2 で2つ。盤を触って確かめられるよう多めに持たせている（仮の値）
const START = Object.freeze({ chapter: 1, level: 2, xp: 0.45, hidane: { any: 6, body: 0, sense: 0, wisdom: 0 } });
// 出会っている人と♥（仮の値）。スミさんは最初から。ひよりは斧投げを明かす前、凛想はまだ会っていない扱い（札は「？」）
const MET = new Set(["sumi", "minto", "naru", "adam", "tsumugi"]);
const HEARTS = { minto: 2, naru: 1, adam: 1, tsumugi: 3 };
const WHO = { sumi: "スミさん", minto: "みんと", naru: "なる", adam: "アダム", tsumugi: "つむぎ" };
const HIDANE_KEYS = ["any", ...BOARD_KEYS];
// 盤の色（本編 daily/growth-fx.js の HIDANE_COLOR と同じ意味: 紅・蒼・翠・白金）
const COLOR = { any: "#ffe9b8", body: "#ff8a5c", sense: "#6fc3ff", wisdom: "#6fe0a0" };

/* ───────── 規則（remake/js/core/growth-board.js の写し。s＝この場面の仮の状態） ───────── */
const fmtNum = (v) => String(Math.round(v * 10) / 10);
/** 普通のマス・色の台座の恩恵（帯の倍率を掛けた文）。能力のマスでなければ null */
function perkOf(node) {
  if (node?.kind !== "stat" && !(node?.kind === "gate" && node.perk)) return null;
  const def = SQUARE_PERKS[node.board];
  const perk = (!node.peak && def.perks[node.perk]) || def.base;
  const tier = node.kind === "gate" ? GATE_TIER : PERK_TIERS[node.band] || PERK_TIERS[1];
  const notable = node.notable ? NOTABLES[node.notable] : null;
  const mult = perkMultiplier(node);
  return { ...perk, tierName: tier.name, notable, text: perk.text.replace(/\{([\d.]+)\}/g, (_, v) => fmtNum(Number(v) * mult)) };
}
const ringsOpen = (s) => Math.min(5, Math.max(1, s.chapter));
const statCount = (board, unlocked) => boardNodes(board).filter((n) => isCoreStat(n) && unlocked.has(n.id)).length;
const statTotal = (board) => boardNodes(board).filter(isCoreStat).length;
function perkTotals(board, unlocked) {
  const def = SQUARE_PERKS[board], nodes = boardNodes(board);
  const total = boardPerks(nodes.filter((n) => unlocked.has(n.id)).map((n) => n.id));
  const maximum = boardPerks(nodes.map((n) => n.id));
  return Object.entries(def.perks).map(([key, perk]) => ({ key, name: perk.name, text: perk.text.replace(/\{[\d.]+\}/, fmtNum(total[key])), sum: total[key], max: maximum[key] }));
}
const statsFilled = (board, unlocked) => boardNodes(board).every((n) => !isCoreStat(n) || n.peak || unlocked.has(n.id));
function lessonReconnected(id, unlocked) {
  const seen = new Set(), queue = [id];
  while (queue.length) {
    const next = queue.shift();
    if (next === HUB) return true;
    if (seen.has(next) || !unlocked.has(next)) continue;
    seen.add(next);
    queue.push(...(NODE_BY_ID[next]?.links || []));
  }
  return false;
}
/** 線でつながった隣が灯っている（か、紋の隣）。極みは、その盤の能力のマスを全部灯した時 */
const connected = (node, unlocked) => node.peak ? statsFilled(node.board, unlocked) : node.links.some((id) =>
  id === HUB || unlocked.has(id) && (NODE_BY_ID[id]?.kind !== "lesson" || lessonReconnected(id, unlocked)));
const hasMet = (who) => MET.has(who);
/** 授業の中身（誰の・何の授業か）が分かっているか: その人に会っていて、授業の章まで物語が進んだ時 */
function lessonKnown(node, g, s) {
  if (node.kind !== "lesson") return true;
  if (g.nodes.includes(node.id)) return true;
  if (node.revealFlag) return false; // 明かす場面（ひよりの斧投げ など）は、この試作では通っていない
  return hasMet(node.who) && node.ring <= ringsOpen(s);
}
/** 授業の錠（♥が足りない）。開いていれば null */
function lessonLock(node) {
  if (node.kind !== "lesson" || !node.need) return null;
  const heart = HEARTS[node.who] || 0;
  return heart < node.need ? { heartNow: heart } : null;
}
// 払い方: 能力のマス・スキルは白火が先。足りない分だけその盤の色（まだ越えていない台座の数ぶんは残す）。色の台座は色の火1つ
const spareColor = (hidane, ctx) => Math.max(0, BOARD_KEYS.reduce((n, b) => n + (hidane[b] || 0), 0) - (ctx.reserve || 0));
function spendableHidane(node, hidane, ctx = {}) {
  if (!node.cost) return 0;
  if (node.kind === "gate") return Math.max(...BOARD_KEYS.map((b) => hidane[b] || 0));
  return (hidane.any || 0) + Math.min(hidane[node.board] || 0, spareColor(hidane, ctx));
}
function paymentFor(node, hidane, ctx = {}) {
  if (!node.cost) return {};
  if (spendableHidane(node, hidane, ctx) < node.cost) return null;
  if (node.kind === "gate") {
    const color = [node.board, ...BOARD_KEYS.filter((b) => b !== node.board)].find((b) => (hidane[b] || 0) >= node.cost);
    return color ? { [color]: node.cost } : null;
  }
  const pay = {};
  let left = node.cost;
  const any = Math.min(left, hidane.any || 0);
  if (any) { pay.any = any; left -= any; }
  const own = Math.min(left, hidane[node.board] || 0, spareColor(hidane, ctx));
  if (own) { pay[node.board] = own; left -= own; }
  return left > 0 ? null : pay;
}
const payContext = (unlocked) => ({ reserve: NODES.filter((n) => n.kind === "gate" && !unlocked.has(n.id)).length });
const reachable = (node, unlocked, s, g) => node.ring <= ringsOpen(s) && lessonKnown(node, g, s) && !lessonLock(node) && connected(node, unlocked);
/** 仮置きを順に積み直す。払えない・つながらない・錠が閉じた仮置きは外す */
function replay(g, pendingIds, s) {
  const unlocked = new Set(g.nodes);
  const hidane = Object.fromEntries(HIDANE_KEYS.map((k) => [k, g.hidane[k] || 0]));
  const kept = [], pays = {};
  let rest = pendingIds.filter((id) => NODE_BY_ID[id] && !unlocked.has(id));
  for (let progress = true; progress && rest.length;) {
    progress = false;
    for (const id of rest) {
      const node = NODE_BY_ID[id];
      if (!reachable(node, unlocked, s, g)) continue;
      const pay = paymentFor(node, hidane, payContext(unlocked));
      if (!pay) continue;
      for (const [k, n] of Object.entries(pay)) hidane[k] -= n;
      unlocked.add(id); kept.push(id); pays[id] = pay; progress = true;
    }
    rest = rest.filter((id) => !unlocked.has(id));
  }
  return { pending: kept, unlocked, hidane, pays, ctx: payContext(unlocked) };
}
/** マスの状態: unlocked | pending | available | short | far（まだつながっていない）| locked（章で開く）| sealed（授業の錠・まだ分からない授業） */
function nodeStatus(node, g, view, s) {
  if (g.nodes.includes(node.id)) return "unlocked";
  if (view.pending.includes(node.id)) return "pending";
  if (node.ring > ringsOpen(s)) return "locked";
  if (lessonLock(node) || !lessonKnown(node, g, s)) return "sealed";
  if (!connected(node, view.unlocked)) return "far";
  return paymentFor(node, view.hidane, view.ctx) ? "available" : "short";
}
/** 紋から盤全体への一番安い道（灯した所は0、未解放はその火種） */
function pathsFrom(board, unlocked) {
  const nodes = boardNodes(board);
  const dist = { [HUB]: 0 }, prev = {}, done = new Set(), queue = [HUB];
  const linksOf = (u) => u === HUB ? nodes.filter((n) => n.links.includes(HUB)).map((n) => n.id) : NODE_BY_ID[u].links;
  while (queue.length) {
    queue.sort((a, b) => dist[a] - dist[b]);
    const u = queue.shift();
    if (done.has(u)) continue;
    done.add(u);
    for (const v of linksOf(u)) {
      if (v === HUB) continue;
      const w = unlocked.has(v) ? 0 : NODE_BY_ID[v].cost;
      if (dist[u] + w < (dist[v] ?? Infinity)) { dist[v] = dist[u] + w; prev[v] = u; queue.push(v); }
    }
  }
  return (id) => {
    const path = [];
    for (let c = id; c && c !== HUB; c = prev[c]) if (!unlocked.has(c)) path.unshift(c);
    return { cost: dist[id] ?? 0, path };
  };
}
const pathTo = (id, unlocked) => pathsFrom(NODE_BY_ID[id].board, unlocked)(id);
/** 「目標まで灯す」: 道の手前から、火種と章と錠が許すところまで仮置きに足す */
function pendingTowards(g, pending, id, s) {
  const view = replay(g, pending, s);
  const next = [...view.pending];
  for (const step of pathTo(id, view.unlocked).path) {
    const trial = replay(g, [...next, step], s);
    if (!trial.pending.includes(step)) break;
    next.push(step);
  }
  return next;
}

/* ───────── 見せ方の部品 ───────── */
const shortPerkValue = (text) => /[＋−][\d.]+(?:%|ポイント)?/.exec(text)?.[0].replace("ポイント", "pt") || "";
const fmtPerk = (text, sum) => text.replace(/[\d.]+/, fmtNum(sum));
const payText = (pay) => Object.entries(pay).map(([k, n]) => `${HIDANE_NAME[k]}${n}`).join("＋") || "火種いらず";
const whoName = (who) => WHO[who] || who;
// 盤の方眼: 1マスの間隔（rem）と、盤の縁の余白（マス）。座標は紋からのずれ（HUB_AT を足すと方眼の座標）
const CELL = 5.6, EDGE = 0.95;
const PLANE_W = (GRID.w * 2 + EDGE * 2) * CELL, PLANE_H = (GRID.h + EDGE * 2) * CELL;
const hubXY = (board) => HUB_AT[board].split(",").map(Number);
const planeXY = (board, gx, gy) => { const [hx, hy] = hubXY(board); return [(gx + hx + GRID.w + EDGE) * CELL, (gy + hy + GRID.h + EDGE) * CELL]; };
const ZOOM_MAX = 1.5;

export class GrowthScene {
  /** 場面の名札（app.mjs が読む）: 名前・光の色・1台表示のつまみの選び方・一覧（PC）に並べる場面。 */
  static META = {
    id: "growth", label: "盤", acc: "#c3b0ff",
    options: { name: "board", default: "body", values: { body: "才能盤", sense: "感覚盤", wisdom: "理論盤" } },
    gallery: {
      title: "心得の盤（能力盤）",
      note: "本編の心得の盤を縦へ。マスの並び・名前・効果・費用は本編のデータをそのまま読む。上に題・レベル・手持ちの火種と盤の札3枚、真ん中に盤（指でずらす・つまんで拡大・「全体」）、下に選んだマスの札と「灯す」「目標にする」、いちばん下に「取り消す」「決定」。十字キーと丸ボタンは置かない。レベル・火種・♥は仮の値。",
      shots: [
        { caption: "才能盤（恩恵の合計と近い目的地）", shot: "home" },
        { caption: "マスを選ぶ（効果と払う火種）", shot: "node" },
        { caption: "スキルを目標にして、道を仮置き", shot: "path" },
        { caption: "灯したあと（感覚盤・スミさんの授業）", shot: "lit", board: "sense" },
        { caption: "授業の錠（♥が要る）", shot: "sealed", board: "wisdom" },
        { caption: "全体を見る（結界の先まで）", shot: "overview", board: "wisdom" },
      ],
    },
  };

  /**
   * @param opts board＝開く盤（body / sense / wisdom）、shot＝一覧（PC）に並べる時の場面
   */
  constructor(phone, kit, { board = "body", shot = null } = {}) {
    Object.assign(this, { phone, kit, el: phone.el, shot });
    this.art = (name) => `${kit.REMAKE_IMG}ui/growth_board/${name}.webp`;
    this.s = { chapter: START.chapter };
    this.g = { level: START.level, nodes: [], hidane: { ...START.hidane }, target: null };
    Object.assign(this, { board: BOARD_KEYS.includes(board) ? board : "body", selected: null, pending: [], overview: false, cam: null, pointers: new Map(), fresh: new Set() });
    this.reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!phone.fixed) phone.extOpts.shot = null; // 途中の場面から開くのは一度だけ
    if (shot) this.pose(shot);
  }

  /** 一覧（PC）に並べる時の場面を作る。 */
  pose(shot) {
    const { g, s } = this, id = (board, cell) => NODES.find((n) => n.board === board && n.cell === cell)?.id;
    if (shot === "node") this.selected = id("body", "1,0");
    else if (shot === "path") { this.selected = this.g.target = "K03"; this.pending = pendingTowards(g, [], "K03", s); }
    else if (shot === "lit") {
      for (const cell of ["-1,0", "0,-1", "0,-2"]) g.nodes.push(id("sense", cell));
      g.nodes.push("M-S1"); g.hidane.any -= 3;
      this.selected = "M-S1";
    } else if (shot === "sealed") this.selected = "M-W3";
    else if (shot === "overview") this.overview = true;
  }

  view() { const v = replay(this.g, this.pending, this.s); this.pending = v.pending; return v; }
  status(node, v) { return nodeStatus(node, this.g, v, this.s); }

  /* ── 骨組み ── */

  html() {
    const { kit } = this, { icon } = kit;
    return `
      <img class="amb" src="${kit.REMAKE_IMG}backgrounds/bg_kannon_day.webp" alt="">
      <div class="gb-top">
        <div class="gb-head"><h2>心得の盤</h2>
          <span class="gb-lv" aria-label="レベル${this.g.level}"><small>Lv</small><b>${this.g.level}</b><i><i style="width:${START.xp * 100}%"></i></i></span>
          <span class="gb-wallet" data-slot="wallet"></span></div>
        <div class="gb-tabs" role="tablist" data-slot="tabs"></div>
      </div>
      <div class="gb-view" data-slot="view">
        <div class="gb-plane" style="width:${PLANE_W}rem;height:${PLANE_H}rem;background-image:url(${this.art("board_glass")})">
          <svg class="gb-lines" viewBox="0 0 ${PLANE_W} ${PLANE_H}" aria-hidden="true"></svg>
          <div class="gb-nodes"></div>
        </div>
        <button class="gb-zoom" data-act="gb-zoom" aria-label="全体を見る">${icon("wide")}<span>全体</span></button>
      </div>
      <div class="gb-panel">
        <div class="gb-card" data-slot="card"></div>
        <div class="gb-foot" data-slot="foot"></div>
      </div>
      <div class="gb-result" data-slot="result" hidden></div>`;
  }

  mount() {
    const q = (sel) => this.el.querySelector(sel);
    this.refs = { view: q(".gb-view"), plane: q(".gb-plane"), lines: q(".gb-lines"), nodes: q(".gb-nodes"), wallet: q('[data-slot="wallet"]'),
      tabs: q('[data-slot="tabs"]'), card: q('[data-slot="card"]'), foot: q('[data-slot="foot"]'), zoom: q(".gb-zoom"), result: q('[data-slot="result"]') };
    const view = this.refs.view;
    this.listeners = [["pointerdown", (e) => this.onDown(e)], ["pointermove", (e) => this.onMove(e)], ["pointerup", (e) => this.onUp(e)],
      ["pointercancel", (e) => this.onUp(e)], ["wheel", (e) => this.onWheel(e)]];
    for (const [type, fn] of this.listeners) view.addEventListener(type, fn, { passive: false });
    this.render();
    this.home(false);
    if (this.selected) this.focus(this.selected);
  }

  destroy() {
    this.dead = true;
    clearTimeout(this.resultTimer);
    for (const [type, fn] of this.listeners || []) this.refs.view.removeEventListener(type, fn);
  }

  /* ── 描画 ── */

  render() {
    const v = this.view();
    this.v = v;
    this.el.dataset.board = this.board;
    this.el.style.setProperty("--bc", COLOR[this.board]);
    this.renderTop(v); this.renderBoard(v); this.renderCard(v); this.renderFoot(v);
  }

  renderTop(v) {
    const { g } = this;
    // 手持ちの火種（仮置きの分を引いた残り）
    this.refs.wallet.innerHTML = HIDANE_KEYS.map((k) => `<span class="gb-fire${v.hidane[k] ? "" : " zero"}" aria-label="${HIDANE_NAME[k]} ${v.hidane[k] || 0}"><img src="${this.art(`hidane_${k}`)}" alt=""><b>${v.hidane[k] || 0}</b></span>`).join("");
    this.refs.tabs.innerHTML = BOARD_KEYS.map((k) => {
      const count = statCount(k, v.unlocked), ready = boardNodes(k).filter((n) => this.status(n, v) === "available").length;
      return `<button class="gb-tab" role="tab" data-act="gb-tab" data-board="${k}" aria-selected="${k === this.board}" style="--bc:${COLOR[k]}">
        <i>${BOARD_HEAD[k]}</i><b>${BOARD_JA[k]}盤</b><span>${count}/${statTotal(k)}</span>${g.target && NODE_BY_ID[g.target]?.board === k ? `<em class="aim" aria-label="目標がある">◎</em>` : ready ? `<em aria-label="今灯せるマスがある"></em>` : ""}</button>`;
    }).join("");
  }

  /** マスの絵: 能力＝恩恵の印、スキル＝スキルの印、授業＝その人の顔（分からない間は影）、色の台座＝その色の火、極み＝極みの印 */
  nodeIcon(node) {
    const { g, s } = this;
    if (node.kind === "lesson") return lessonKnown(node, g, s) ? this.art(`faces/new/${node.who}`) : this.art("silhouette_unknown");
    if (node.kind === "gate") return this.art(`hidane_${node.board}`);
    if (this.hiddenSkill(node)) return this.art("badge_unknown");
    if (node.kind === "skill") return this.art(`icons/skill_${node.id}`);
    return this.art(`icons/${node.peak ? "peak" : perkIcon(node.perk)}`);
  }

  /** まだ盤に現れていないスキル（開いている章の2つ先から。本編の revealOf と同じ: 次の章＝名前と効果、その先＝伏せる）。 */
  hiddenSkill(node) { return node.kind === "skill" && node.ring > ringsOpen(this.s) + 1; }

  renderBoard(v) {
    const { board, g, s } = this, nodes = boardNodes(board), layout = LAYOUTS[board];
    const open = ringsOpen(s);
    const byCell = Object.fromEntries(nodes.map((n) => [n.cell, n]));
    const stOf = Object.fromEntries(nodes.map((n) => [n.id, this.status(n, v)]));
    const lit = (id) => id === HUB || stOf[id] === "unlocked";
    const on = (id) => lit(id) || stOf[id] === "pending";
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
    this.refs.lines.innerHTML = lines.join("");
    const hub = `<span class="gb-hub" style="left:${hx}rem;top:${hy}rem" aria-hidden="true"><img src="${this.art(`hub_${board}`)}" alt=""><b>${BOARD_HEAD[board]}</b></span>`;
    this.refs.nodes.innerHTML = hub + nodes.map((node) => {
      const st = stOf[node.id], [x, y] = planeXY(board, node.gx, node.gy);
      const known = lessonKnown(node, g, s), perk = perkOf(node);
      const kind = node.peak ? "peak" : node.kind;
      // 結界の入口（開いている章のマスと線でつながる、まだ開いていないマス）にだけ錠を出す
      const entrance = st === "locked" && node.links.some((id) => id === HUB || NODE_BY_ID[id].ring <= open);
      // マスの下の短い札: 能力＝増える量、スキル＝火種の数、授業＝今の段（♥・今・相談）
      let tag = "";
      if (st !== "locked") {
        if (node.kind === "stat" || node.kind === "gate") tag = st === "unlocked" ? "" : `<span class="gb-tag">${shortPerkValue(perk.text)}</span>`;
        else if (node.kind === "skill") tag = st === "unlocked" ? "" : `<span class="gb-tag cost"><img src="${this.art("hidane_any")}" alt="">${node.cost}</span>`;
        else if (!known) tag = "";
        else if (st === "unlocked") tag = `<span class="gb-tag talk">相談</span>`;
        else if (lessonLock(node)) tag = `<span class="gb-tag heart">♥${lessonLock(node).heartNow}/${node.need}</span>`;
        else if (st === "available") tag = `<span class="gb-tag now">今</span>`;
      }
      const veiled = this.hiddenSkill(node) || (node.kind === "lesson" && !known);
      const name = node.kind === "stat" ? (perk.notable?.name || perk.name) : node.kind === "gate" ? "色の台座" : node.kind === "lesson" && !known ? "？？？の授業" : veiled ? "？？？" : node.name;
      return `<button class="gb-node k-${kind} s-${st}${node.notable ? " notable" : ""}${this.fresh.has(node.id) ? " fresh" : ""}" data-act="gb-node" data-id="${node.id}" aria-pressed="${this.selected === node.id}"
          style="left:${x}rem;top:${y}rem" aria-label="${name}（${this.statusWord(node, st)}）">
        <i class="gb-base"></i><img class="gb-ico" src="${this.nodeIcon(node)}" alt="" draggable="false">
        ${veiled ? `<b class="gb-q">?</b>` : ""}${node.feature ? `<b class="gb-star">✦</b>` : ""}
        ${st === "unlocked" ? `<em class="gb-mark">✓</em>` : st === "pending" ? `<em class="gb-mark plus">＋</em>` : ""}
        ${g.target === node.id && st !== "unlocked" ? `<em class="gb-aim">◎</em>` : ""}
        ${entrance ? `<img class="gb-lock" src="${this.art("wall_seal")}" alt="">` : ""}${tag}
      </button>`;
    }).join("");
  }

  statusWord(node, st) {
    return { unlocked: node.kind !== "lesson" ? "灯してある" : "相談できる", pending: "仮置き中", locked: "結界の先", sealed: "授業の錠",
      far: "道がまだ", short: "火種が足りない", available: "今灯せる" }[st];
  }

  /** いまの状態の一行（本編の stateText と同じ言い方）。 */
  stateText(node, st, v) {
    const { g, s } = this;
    if (st === "unlocked") return node.kind !== "lesson" ? "灯してある" : `相談できる。次に${whoName(node.who)}に会った時に話を聞こう`;
    if (st === "pending") return "仮置き中。決定するまでは「やめる」で戻せる";
    if (st === "locked") return "結界の先。物語が進むと結界が解けて道が開く";
    if (node.kind === "lesson") {
      if (!lessonKnown(node, g, s)) return "物語が進んで出会うと、誰の授業かが分かる";
      const who = whoName(node.who);
      if (st === "sealed") return `つぎ：${who}と♥${node.need}まで仲良くなる（いま♥${lessonLock(node).heartNow}）`;
      if (st === "far") return `つぎ：盤の道をここまでつなぐ（あと火種${pathTo(node.id, v.unlocked).cost}）`;
      if (st === "available") return `つぎ：「教わる」を押す（火種いらず）。そのあと${who}に会って習う`;
    }
    if (st === "far" && node.peak) return `能力のマスを全部灯すと灯せる（あと${boardNodes(node.board).filter((n) => n.kind === "stat" && !n.peak && !v.unlocked.has(n.id)).length}マス）`;
    if (st === "far") return `まだ道がつながっていない（ここまで 火種${pathTo(node.id, v.unlocked).cost}）`;
    if (st === "short" && node.kind === "gate") return "色の火（紅火・蒼火・翠火）が要る";
    if (st === "short") return `火種があと${Math.max(0, node.cost - spendableHidane(node, v.hidane, v.ctx))}つ要る。火種は貯めておける`;
    return `${payText(paymentFor(node, v.hidane, v.ctx))}で払う`;
  }

  /** 選んだマスの札。上に種類と名前、まん中に効果（2行まで）、下に今の状態と押す所。 */
  renderCard(v) {
    const { g, s, kit } = this, { esc } = kit, node = this.selected ? NODE_BY_ID[this.selected] : null;
    if (!node || node.board !== this.board) { this.refs.card.innerHTML = this.summaryHtml(v); this.refs.card.dataset.mode = "summary"; return; }
    const st = this.status(node, v), perk = perkOf(node), known = lessonKnown(node, g, s);
    let kind, name, text, sub = "";
    if (node.kind === "stat") {
      kind = node.peak ? `${BOARD_JA[node.board]}のマス（極み）` : perk.notable ? "要のマス" : `${BOARD_JA[node.board]}のマス`;
      name = node.peak ? "極み" : perk.notable ? perk.notable.name : perk.name;
      text = perk.notable ? perk.notable.text : node.feature ? `✦ 灯すと「${FEATURES[node.feature].text}」` : "";
      sub = perk.text;
    } else if (node.kind === "gate") {
      kind = `${BOARD_JA[node.board]}の色の台座`; name = perk?.name || "色の台座";
      text = `${HIDANE_NAME[node.board]}をはめると先へ進めて、この台座の能力が手に入る`; sub = perk?.text || "";
    } else if (node.kind === "skill") {
      // 章ごとの見せ方（本編の revealOf）: 開いている章＝全部、次の章＝名前と効果、その先＝伏せる
      const hidden = this.hiddenSkill(node);
      kind = "スキル"; name = hidden ? "？？？" : node.name; text = hidden ? "物語が進むと盤に現れる" : node.text; sub = hidden ? "" : `効く場面：${node.scene}・火種${node.cost}`;
    } else if (!known) {
      kind = "授業"; name = "？？？の授業"; text = "まだ出会っていない誰かが、ここで何かを教えてくれるらしい";
    } else {
      kind = `${whoName(node.who)}の授業`; name = node.name; text = `${REWARD_JA[node.reward]}：${node.text}`;
    }
    const actions = [];
    if (!g.nodes.includes(node.id) && st !== "pending" && st !== "locked" && !(node.kind === "lesson" && !known)) {
      actions.push(`<button class="gb-btn" data-act="gb-target">${g.target === node.id ? "目標をやめる" : "目標にする"}</button>`);
      if (g.target === node.id && st !== "available") actions.push(`<button class="gb-btn gold" data-act="gb-towards">目標まで灯す</button>`);
    }
    if (st === "pending") actions.push(`<button class="gb-btn" data-act="gb-undo">やめる</button>`);
    if (st === "available") actions.push(`<button class="gb-btn primary" data-act="gb-light">${node.kind === "gate" ? `はめる（${payText(paymentFor(node, v.hidane, v.ctx))}）` : node.cost ? `灯す（火種${node.cost}）` : "教わる"}</button>`);
    this.refs.card.dataset.mode = "node";
    this.refs.card.innerHTML = `
      <div class="gb-card-head k-${node.peak ? "peak" : node.kind} s-${st}">
        <span class="gb-art"><img src="${this.nodeIcon(node)}" alt="">${(node.kind === "lesson" && !known) || this.hiddenSkill(node) ? `<b>?</b>` : ""}</span>
        <div class="gb-name"><span><small>${esc(kind)}</small><em class="gb-chip s-${st}">${this.statusWord(node, st)}</em></span><b>${esc(name)}</b></div>
        <button class="gb-x" data-act="gb-close" aria-label="選ぶのをやめる">×</button>
      </div>
      ${sub ? `<p class="gb-sub" data-fit>${esc(sub)}</p>` : ""}
      ${text ? `<p class="gb-text" data-fit>${esc(text)}</p>` : ""}
      <p class="gb-state s-${st}">${esc(this.stateText(node, st, v))}</p>
      <div class="gb-actions" data-count="${actions.length}">${actions.join("")}</div>`;
    this.fitTexts();
  }

  /** マスを選んでいない時: その盤の恩恵の合計（仮置きを含む）と、近い目的地（押すとそのマスへ）。 */
  summaryHtml(v) {
    const { board, g, s, kit } = this, { esc } = kit;
    const totals = perkTotals(board, v.unlocked), base = perkTotals(board, new Set(g.nodes));
    const perks = totals.map((p, i) => `<span class="gb-perk${p.sum > base[i].sum ? " up" : ""}" aria-label="${p.name}：${p.text}">
      <img src="${this.art(`icons/${perkIcon(p.key)}`)}" alt=""><b>${shortPerkValue(p.text)}</b><small>${esc(p.name)}</small><i><i style="width:${p.max ? Math.round(p.sum / p.max * 100) : 0}%"></i></i></span>`).join("");
    // 近い目的地: まだ灯していないスキル・授業・✦・要のマスを、紋からの火種が少ない順に（結界の先と、まだ分からない授業は出さない）
    const route = pathsFrom(board, v.unlocked), goals = [];
    for (const n of boardNodes(board)) {
      if (v.unlocked.has(n.id) || n.peak || !(n.kind === "skill" || n.kind === "lesson" || n.kind === "gate" || n.feature || n.notable)) continue;
      const st = this.status(n, v);
      if (st === "locked" || (n.kind === "lesson" && !lessonKnown(n, g, s))) continue;
      goals.push({ n, st, cost: route(n.id).cost });
    }
    goals.sort((a, b) => a.cost - b.cost || a.n.ring - b.n.ring);
    const rows = goals.slice(0, 3).map(({ n, st, cost }) => {
      const name = n.kind === "gate" ? perkOf(n)?.name || "" : n.feature ? FEATURES[n.feature].name : n.notable ? NOTABLES[n.notable].name : n.name;
      const side = st === "sealed" ? `<em class="lock">♥${n.need}</em>` : cost ? `<em><img src="${this.art("hidane_any")}" alt="">${cost}</em>` : `<em class="now">今</em>`;
      return `<button class="gb-goal k-${n.kind}" data-act="gb-goal" data-id="${n.id}" aria-label="${esc(name)} 火種${cost}"><span class="gb-goal-ico"><img src="${this.nodeIcon(n)}" alt=""></span>${side}<b>${esc(name)}</b></button>`;
    }).join("");
    return `<div class="gb-sum-head"><b>${BOARD_JA[board]}盤</b><span>${statCount(board, v.unlocked)}/${statTotal(board)}</span></div>
      <div class="gb-perks">${perks}</div>
      <small class="gb-sum-label">近い目的地</small>
      <div class="gb-goals">${rows}</div>`;
  }

  renderFoot(v) {
    const n = v.pending.length;
    this.refs.foot.innerHTML = `${n ? `<button class="gb-btn" data-act="gb-reset">取り消す</button>` : ""}
      <button class="gb-btn ${n ? "primary" : "back"} big" data-act="gb-decide">${n ? `決定（${n}）` : "地図へ戻る"}</button>`;
    this.refs.zoom.setAttribute("aria-label", this.overview ? "寄る" : "全体を見る");
    this.refs.zoom.innerHTML = `${this.kit.icon(this.overview ? "near" : "wide")}<span>${this.overview ? "寄る" : "全体"}</span>`;
  }

  /** 札の文は本編の組版で折る（2行まで。収まらない時は字を一段小さく）。 */
  fitTexts() {
    const { paginateForBox, plain } = this.kit;
    for (const node of this.refs.card.querySelectorAll("[data-fit]")) {
      const text = node.dataset.full ?? node.textContent;
      node.dataset.full = text;
      node.classList.remove("gb-small", "gb-paged", "gb-fitted");
      node.textContent = text;
      if (!text || !node.clientWidth) continue;
      let pages = paginateForBox(text, node);
      if (pages.length > 1) { node.classList.add("gb-small"); pages = paginateForBox(text, node); }
      // 2行に収まらない文は2行ずつに分け、押すと続きが出る（説明は2行まで・VPL29）。続きの印のぶん幅が狭くなるので、その幅で測り直す
      if (pages.length > 1) { node.classList.add("gb-paged"); pages = paginateForBox(text, node); }
      const at = Math.min(Number(node.dataset.page) || 0, pages.length - 1);
      node.innerHTML = plain(pages[at]);
      node.classList.add("gb-fitted"); // 折る所は決めてあるので、ブラウザには折り直させない
      if (pages.length > 1) { node.dataset.act = "gb-more"; node.dataset.pages = String(pages.length); node.dataset.page = String(at); }
    }
  }

  /* ── 盤の見える位置（指でずらす・つまんで拡大・全体） ── */

  rem() { return parseFloat(getComputedStyle(document.documentElement).fontSize) || 10; }
  viewSize() { const r = this.rem(), v = this.refs.view; return [v.clientWidth / r, v.clientHeight / r]; }
  fitScale() { const [w, h] = this.viewSize(); return Math.min(w / PLANE_W, h / PLANE_H); }

  setCam(cam, animate = true) {
    const [w, h] = this.viewSize();
    if (!w || !h) return;
    const s = Math.max(this.fitScale(), Math.min(ZOOM_MAX, cam.s));
    // 盤が見える所より小さい向きは真ん中に、大きい向きは端が見える所の中へ入りすぎないように止める
    const clamp = (v, size, span) => size * s <= span ? (span - size * s) / 2 : Math.min(0, Math.max(span - size * s, v));
    this.cam = { s, x: clamp(cam.x, PLANE_W, w), y: clamp(cam.y, PLANE_H, h) };
    const plane = this.refs.plane;
    plane.classList.toggle("no-anim", !animate || this.reduce);
    plane.style.transform = `translate(${this.cam.x}rem, ${this.cam.y}rem) scale(${this.cam.s})`;
    this.el.dataset.far = String(s < 0.72); // 引いた時は、マスの下の小さい札を出さない
  }

  /** その盤の、いま開いている章のマスがちょうど入る位置（紋が下に来る）。 */
  home(animate = true) {
    const [w, h] = this.viewSize();
    if (!w || !h) return;
    if (this.overview) { const s = this.fitScale(); this.setCam({ s, x: 0, y: 0 }, animate); return; }
    const open = ringsOpen(this.s), pts = [planeXY(this.board, 0, 0), ...boardNodes(this.board).filter((n) => n.ring <= open).map((n) => planeXY(this.board, n.gx, n.gy))];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys);
    const s = Math.min(1.12, (w - 0.6) / (x1 - x0 + 5.2));
    this.setCam({ s, x: w / 2 - (x0 + x1) / 2 * s, y: h - 5.8 - y1 * s }, animate);
  }

  /** マスが見える位置へ寄る（全体を見ている時は、寄ってから真ん中へ）。 */
  focus(id) {
    const node = NODE_BY_ID[id], [w, h] = this.viewSize();
    if (!node || !w) return;
    const [x, y] = planeXY(node.board, node.gx, node.gy);
    const s = this.overview || this.cam.s < 0.8 ? 1 : this.cam.s;
    this.overview = false;
    // もう見えている所にあるマスは動かさない（押すたびに盤が動くと落ち着かない）
    const sx = x * s + this.cam.x, sy = y * s + this.cam.y, pad = 3.4;
    if (s === this.cam.s && sx > pad && sx < w - pad && sy > pad && sy < h - pad) return;
    this.setCam({ s, x: w / 2 - x * s, y: h * 0.5 - y * s });
  }

  onDown(event) {
    if (event.target.closest(".gb-zoom")) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 1) this.drag = { x: event.clientX, y: event.clientY, cam: { ...this.cam }, moved: false };
    else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cam: { ...this.cam } };
      this.drag = null; this.moved = true;
    }
  }

  onMove(event) {
    if (!this.pointers.has(event.pointerId)) return;
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const r = this.rem();
    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()], box = this.refs.view.getBoundingClientRect();
      const mx = ((a.x + b.x) / 2 - box.left) / r, my = ((a.y + b.y) / 2 - box.top) / r;
      this.zoomAt(this.pinch.cam.s * Math.hypot(a.x - b.x, a.y - b.y) / this.pinch.d, mx, my, this.pinch.cam);
      return;
    }
    const drag = this.drag;
    if (!drag) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 8) return;
    drag.moved = true; this.moved = true;
    try { this.refs.view.setPointerCapture?.(event.pointerId); } catch { /* 指が離れた後に届いた時は、つかまずに続ける */ }
    this.setCam({ s: drag.cam.s, x: drag.cam.x + dx / r, y: drag.cam.y + dy / r }, false);
  }

  onUp(event) {
    this.pointers.delete(event.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (!this.pointers.size) {
      this.drag = null;
      if (this.moved) { this.overview = this.cam.s <= this.fitScale() + 0.01; this.renderFoot(this.v); setTimeout(() => { this.moved = false; }, 0); }
    }
  }

  onWheel(event) {
    event.preventDefault();
    const r = this.rem(), box = this.refs.view.getBoundingClientRect();
    this.zoomAt(this.cam.s * (event.deltaY < 0 ? 1.12 : 0.89), (event.clientX - box.left) / r, (event.clientY - box.top) / r);
    this.overview = this.cam.s <= this.fitScale() + 0.01; this.renderFoot(this.v);
  }

  /** 見えている所の (mx, my) を動かさずに拡大・縮小する。 */
  zoomAt(scale, mx, my, from = this.cam) {
    const s = Math.max(this.fitScale(), Math.min(ZOOM_MAX, scale));
    const px = (mx - from.x) / from.s, py = (my - from.y) / from.s;
    this.setCam({ s, x: mx - px * s, y: my - py * s }, false);
  }

  /* ── 操作 ── */

  select(id, { focus = true } = {}) {
    this.selected = id;
    if (id && NODE_BY_ID[id].board !== this.board) this.board = NODE_BY_ID[id].board;
    this.render();
    if (id && focus) this.focus(id);
    if (id) this.renderFoot(this.v);
  }

  light(id) {
    const before = this.pending.length;
    this.pending = replay(this.g, [...this.pending, id], this.s).pending;
    if (this.pending.length === before) { this.nudge(this.refs.card); return; }
    this.fresh = new Set([id]);
    this.render();
    this.fresh = new Set();
  }

  towards(id) {
    const next = pendingTowards(this.g, this.pending, id, this.s);
    if (next.length === this.pending.length) { this.nudge(this.refs.card); return; }
    this.fresh = new Set(next.filter((x) => !this.pending.includes(x)));
    this.pending = next;
    this.render();
    this.fresh = new Set();
  }

  /** 仮置きを確定する: 払って灯し、何が増えたかを札で知らせる。 */
  decide() {
    const { g } = this, v = this.view();
    if (!v.pending.length) { if (!this.phone.fixed) this.phone.setScene("map"); return; }
    const before = new Set(g.nodes), committed = v.pending.map((id) => NODE_BY_ID[id]);
    for (const id of v.pending) { g.nodes.push(id); for (const [k, n] of Object.entries(v.pays[id])) g.hidane[k] -= n; }
    if (v.pending.includes(g.target)) g.target = null;
    this.pending = [];
    this.fresh = new Set(committed.map((n) => n.id));
    this.render();
    this.fresh = new Set();
    this.showResult(committed, before);
  }

  /** 決定のまとめの札: 灯した数、増えた能力（絵・名前・増えた量）、覚えたスキル・相談できる授業・要のマス（大きい順に3つまで）。 */
  showResult(committed, before) {
    const { esc } = this.kit, after = new Set([...before, ...committed.map((n) => n.id)]), rows = [];
    for (const board of BOARD_KEYS) {
      if (!committed.some((n) => n.board === board && (n.kind === "stat" || n.kind === "gate"))) continue;
      const was = perkTotals(board, before), now = perkTotals(board, after);
      for (const p of now) {
        const delta = p.sum - (was.find((x) => x.key === p.key)?.sum || 0);
        if (delta > 0.001) rows.push(`<li><img src="${this.art(`icons/${perkIcon(p.key)}`)}" alt=""><span>${esc(p.name)}</span><b>${shortPerkValue(fmtPerk(p.text, delta))}</b></li>`);
      }
    }
    const items = [];
    for (const n of committed) {
      if (n.peak) items.push([0, "COMPLETE　盤を極めた", `${BOARD_JA[n.board]}を極めた`, "盤の能力のマスを全部灯した", n]);
      else if (n.kind === "skill") items.push([1, "SKILL　スキルを覚えた", n.name, n.text, n]);
      else if (n.kind === "gate") items.push([3, "BREAK　色の台座", `${HIDANE_NAME[n.board]}がはまった`, `${perkOf(n)?.text || ""}・この先の道が開いた`, n]);
      else if (n.kind === "lesson") items.push([5, "LESSON　授業", `${whoName(n.who)}に相談できる`, `「${n.name}」。次に会った時に話を聞こう`, n]);
      if (n.feature) items.push([2, "NEW　できることが増えた", FEATURES[n.feature].name, FEATURES[n.feature].text, n]);
      else if (n.notable) items.push([4, "KEY　要のマス", NOTABLES[n.notable].name, perkOf(n)?.text || "", n]);
    }
    items.sort((a, b) => a[0] - b[0]);
    const box = this.refs.result;
    box.innerHTML = `<div class="gb-result-card" style="--bc:${COLOR[committed[0].board]}"><img class="gb-rays" src="${this.art("burst_rays")}" alt="">
      <small>LIGHT UP</small><strong>火を<b>${committed.length}</b>つ灯した</strong>
      ${rows.length ? `<ul class="gb-gains">${rows.join("")}</ul>` : ""}
      ${items.slice(0, 3).map(([, head, name, text, n]) => `<div class="gb-item"><span class="gb-goal-ico"><img src="${this.nodeIcon(n)}" alt=""></span><div><small>${head}</small><b>${esc(name)}</b><p data-fit>${esc(text)}</p></div></div>`).join("")}
      <button class="gb-btn primary" data-act="gb-result-close">盤へ戻る</button></div>`;
    box.hidden = false;
    this.fitResult();
    clearTimeout(this.resultTimer);
    if (!this.phone.fixed && !items.length) this.resultTimer = setTimeout(() => this.closeResult(), 2600);
  }

  fitResult() {
    const { paginateForBox, plain } = this.kit;
    for (const node of this.refs.result.querySelectorAll("[data-fit]")) {
      const text = node.dataset.full ?? node.textContent;
      node.dataset.full = text;
      node.textContent = text;
      if (!node.clientWidth) continue;
      const pages = paginateForBox(text, node);
      if (pages.length === 1) node.innerHTML = plain(pages[0]);
    }
  }

  closeResult() { clearTimeout(this.resultTimer); this.refs.result.hidden = true; this.refs.result.innerHTML = ""; }

  nudge(node) { node.classList.remove("gb-nudge"); void node.offsetWidth; node.classList.add("gb-nudge"); }

  onClick(event) {
    const hit = event.target.closest("[data-act]");
    if (this.moved) { this.moved = false; return true; } // 盤をずらした直後の指離しは、押したことにしない
    if (!hit || !this.el.contains(hit)) {
      // 盤の何も無い所を押したら、選ぶのをやめる
      if (event.target.closest(".gb-view") && this.selected) { this.select(null); return true; }
      return false;
    }
    const act = hit.dataset.act, id = this.selected;
    if (act === "gb-result-close") this.closeResult();
    else if (!this.refs.result.hidden) return true;
    else if (act === "gb-node") this.select(this.selected === hit.dataset.id ? null : hit.dataset.id);
    else if (act === "gb-goal") this.select(hit.dataset.id);
    else if (act === "gb-tab") { this.board = hit.dataset.board; this.selected = null; this.overview = false; this.render(); this.home(); this.phone.onExtOption?.("board", this.board); }
    else if (act === "gb-zoom") { this.overview = !this.overview; this.home(); this.renderFoot(this.v); }
    else if (act === "gb-close") this.select(null);
    else if (act === "gb-more") { hit.dataset.page = String((Number(hit.dataset.page) + 1) % Number(hit.dataset.pages)); this.fitTexts(); }
    else if (act === "gb-light") this.light(id);
    else if (act === "gb-undo") { this.pending = this.pending.filter((x) => x !== id); this.render(); }
    else if (act === "gb-target") { this.g.target = this.g.target === id ? null : id; this.render(); }
    else if (act === "gb-towards") this.towards(id);
    else if (act === "gb-reset") { this.pending = []; this.render(); }
    else if (act === "gb-decide") this.decide();
    else return false;
    return true;
  }

  /** PC のキー: 矢印で、その向きのいちばん近いマスへ。 */
  move(dir) {
    const heading = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir], nodes = boardNodes(this.board);
    const from = this.selected ? NODE_BY_ID[this.selected] : null;
    if (!from) { const first = nodes.find((n) => n.links.includes(HUB)); if (first) this.select(first.id); return; }
    let best = Infinity, to = null;
    for (const n of nodes) {
      const dx = n.gx - from.gx, dy = n.gy - from.gy, along = dx * heading[0] + dy * heading[1], across = Math.abs(dx * heading[1] - dy * heading[0]);
      if (along <= 0 || across > along * 1.6) continue;
      if (along + across * 2 < best) { best = along + across * 2; to = n; }
    }
    if (to) this.select(to.id);
  }

  /** PC の決定キー: 札のいちばん右の押す所（灯す・やめる）。何も選んでいなければ「決定／地図へ戻る」。 */
  pressA() {
    if (!this.refs.result.hidden) { this.closeResult(); return; }
    const button = [...this.refs.card.querySelectorAll(".gb-actions .gb-btn")].pop() || this.refs.foot.querySelector('[data-act="gb-decide"]');
    button?.click();
  }

  tick() {}

  relayout() {
    if (!this.refs) return;
    this.home(false);
    if (this.selected) this.focus(this.selected);
    this.fitTexts();
  }
}
