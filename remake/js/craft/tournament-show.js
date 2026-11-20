// 大会の「ショー」演出の共通部品（第1〜4章。2026-11-20 TSH）。
// 舞台の光・金の粉・紙吹雪・票のトークン・冠と月桂冠・胸から上の立ち絵・見出しの帯・票が入る進行。
// 見た目だけを扱い、票・順位・保存には触れない。数値は呼び出し側が確定させた記録を受け取って映すだけ。
// ・自動操作（craftTest.auto）と会話の早送り中は何も動かさず、最後の状態をそのまま出す（fx.js の fxMode と同じ条件）。
// ・端末の「動きを減らす」でも動かさない。設定「揺れ・閃光を減らす」では閃光と粒を省き、票の動きは残す。
import { el, rand, sleep } from "../core/util.js";
import { portraitInfo, faceIconUrl } from "../core/data.js";
import { SE } from "../core/audio.js";
import { layers, flash } from "../core/ui.js";
import { fxMode } from "./fx.js";
import { VOTE_SCALE, givenBy, judgeLeftText, JUDGE_LOOK } from "./tournament-graphics.js";

/** 演出の出し方。"off"＝自動操作・早送り／"still"＝動きを減らす／"calm"＝揺れ・閃光を減らす／"full" */
export const showMode = () => fxMode();
/** 動きを見せるか（票の動き・並べ替え・見出しの入り）。 */
export const showMoves = () => { const m = fxMode(); return m === "full" || m === "calm"; };
/** 閃光・粒・紙吹雪まで出すか。 */
export const showSparkles = () => fxMode() === "full";

const GOLD = ["#fff6dc", "#f6d68e", "#e3bd6e", "#c9973a"];
const FESTIVE = ["#f6d68e", "#ff8db4", "#5fe2cf", "#c9a7e6", "#ffffff", "#e3bd6e"];

/** host の中での座標（px）。舞台は CSS で拡大縮小されるので、見えている矩形を host の元の寸法へ戻す。 */
export function localPoint(host, node, ax = 0.5, ay = 0.5) {
  const h = host.getBoundingClientRect(), r = node.getBoundingClientRect();
  const k = h.width / (host.offsetWidth || h.width || 1) || 1;
  // host が中で送れる枠（結果のカード）なら、送った分だけ中身の座標へ直す。
  return { x: (r.left + r.width * ax - h.left) / k + (host.scrollLeft || 0), y: (r.top + r.height * ay - h.top) / k + (host.scrollTop || 0) };
}

// ---------------------------------------------------------------- 舞台の光

/**
 * 舞台の光（上から差す光の筋と、ゆっくり昇る金の粉）。host のいちばん奥に敷く。
 * @param tone "gold"（授賞式）| "cool"（結果待ちの暗い舞台）| "live"（会話の後ろ。控えめ）
 */
export function stageLights(host, { beams = 4, dust = 22, tone = "gold" } = {}) {
  const root = el(`div.ts-lights.${tone}`, { "aria-hidden": "true" });
  for (let i = 0; i < beams; i++) {
    root.append(el("i.ts-beam", { style: {
      "--x": `${beams === 1 ? 50 : 8 + (84 / (beams - 1)) * i}%`, "--d": `${rand(5.5, 9).toFixed(2)}s`,
      "--delay": `${(-rand(0, 8)).toFixed(2)}s`, "--from": `${rand(-22, -8).toFixed(1)}deg`, "--to": `${rand(8, 22).toFixed(1)}deg`,
    } }));
  }
  if (showSparkles()) {
    for (let i = 0; i < dust; i++) {
      root.append(el("i.ts-dust", { style: {
        left: `${rand(2, 98).toFixed(1)}%`, "--s": `${rand(2, 5).toFixed(1)}px`, "--d": `${rand(6, 13).toFixed(1)}s`,
        "--delay": `${(-rand(0, 13)).toFixed(1)}s`, "--sway": `${rand(-40, 40).toFixed(0)}px`,
      } }));
    }
  }
  host.prepend(root);
  return root;
}

// ---------------------------------------------------------------- 粒・紙吹雪・光

/** 一点から弾ける金の粒。x・y は host の中の px。 */
export function sparkBurst(host, x, y, { count = 14, colors = GOLD, spread = 90 } = {}) {
  if (!showSparkles() || !host?.isConnected) return;
  const root = el("i.ts-burst", { "aria-hidden": "true", style: { left: `${x}px`, top: `${y}px` } });
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + rand(-0.3, 0.3), far = rand(spread * 0.45, spread);
    root.append(el("b", { style: {
      "--dx": `${(Math.cos(angle) * far).toFixed(1)}px`, "--dy": `${(Math.sin(angle) * far).toFixed(1)}px`,
      "--s": `${rand(3, 7).toFixed(1)}px`, background: colors[i % colors.length], animationDelay: `${rand(0, 0.06).toFixed(3)}s`,
    } }));
  }
  host.append(root);
  setTimeout(() => root.remove(), 900);
}

/** 紙吹雪（短冊・丸・星・細いリボン）。host の中だけに降らせる（はみ出しはスクロールを作らない）。 */
export function showConfetti(host, { count = 110, colors = FESTIVE, ms = 4200, gold = false } = {}) {
  if (!showSparkles() || !host?.isConnected) return null;
  const sky = el("div.ts-confetti", { "aria-hidden": "true" });
  const palette = gold ? GOLD : colors;
  const shapes = ["", "", ".dot", ".star", ".ribbon"];
  for (let i = 0; i < count; i++) {
    sky.append(el(`i${shapes[i % shapes.length]}`, { style: {
      left: `${rand(-2, 100).toFixed(1)}%`, "--c": palette[i % palette.length], "--x": `${rand(-140, 140).toFixed(0)}px`,
      "--r": `${rand(-900, 900).toFixed(0)}deg`, "--d": `${rand(2.2, 3.8).toFixed(2)}s`, animationDelay: `${rand(0, 1.3).toFixed(2)}s`,
      "--w": `${rand(7, 13).toFixed(0)}px`,
    } }));
  }
  host.append(sky);
  setTimeout(() => sky.remove(), ms + 1400);
  return sky;
}

/** 金の後光（くじの演出と同じ光の絵を加算で重ねる）。 */
export const haloOf = (cls = "") => el(`i.ts-halo${cls}`, { "aria-hidden": "true" });

// ---------------------------------------------------------------- 冠と月桂冠

let crestId = 0;
const METAL = {
  gold: ["#fff6dc", "#f6d68e", "#c9973a", "#7a5413"],
  silver: ["#ffffff", "#d7dce6", "#8d95a6", "#4a5060"],
  bronze: ["#ffe2c8", "#d99a66", "#96582c", "#4e2a12"],
  plain: ["#efe4fb", "#c9a7e6", "#7d5aa6", "#3a2456"],
};
/** 順位の色（1＝金・2＝銀・3＝銅・ほか＝紫）。 */
export const metalOf = (rank) => rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "plain";

/**
 * 冠と月桂冠の紋章（SVG）。中央は空けてあり、順位などの文字は呼び出し側が重ねる。
 * @param metal "gold" | "silver" | "bronze" | "plain"
 */
export function crestSvg({ metal = "gold", crown = true, laurel = true } = {}) {
  const [hi, mid, lo, deep] = METAL[metal] || METAL.gold;
  const id = `ts-crest-${++crestId}`;
  // 葉は円弧に沿って下から上へ。左の枝を描き、右は鏡写しにする。
  const leaves = [];
  if (laurel) {
    const cx = 100, cy = 104, r = 74, n = 10;
    for (let i = 0; i < n; i++) {
      const deg = 112 + (148 / (n - 1)) * i, t = (deg * Math.PI) / 180;
      const x = cx + Math.cos(t) * r, y = cy + Math.sin(t) * r, size = 1 - i * 0.035;
      for (const tilt of [-34, 30]) {
        leaves.push(`<path d="M0 0C5 -6 15 -7 23 0C15 6 5 5 0 0Z" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(deg + 90 + tilt).toFixed(1)}) scale(${size.toFixed(2)})"/>`);
      }
    }
  }
  const branch = `<g fill="url(#${id}-m)" stroke="${deep}" stroke-width=".8" stroke-linejoin="round">${leaves.join("")}</g>`;
  const crownArt = crown ? `<g transform="translate(100 34)">
    <path d="M-34 22L-39 -9L-21 6L-11 -20L0 2L11 -20L21 6L39 -9L34 22Z" fill="url(#${id}-m)" stroke="${deep}" stroke-width="1.6" stroke-linejoin="round"/>
    <rect x="-35" y="20" width="70" height="9" rx="2.5" fill="url(#${id}-b)" stroke="${deep}" stroke-width="1.4"/>
    <g fill="${hi}" stroke="${deep}" stroke-width="1"><circle cx="-39" cy="-11" r="3.6"/><circle cx="-11" cy="-22" r="4"/><circle cx="11" cy="-22" r="4"/><circle cx="39" cy="-11" r="3.6"/><circle cx="0" cy="0" r="3.2"/></g>
    <path d="M-27 17L-30 -1L-20 8Z" fill="${hi}" opacity=".55"/>
  </g>` : "";
  return el("span.ts-crest", { "aria-hidden": "true", dataset: { metal }, html:
    `<svg viewBox="${laurel ? "0 0 200 200" : "54 6 92 62"}" focusable="false"><defs>
      <linearGradient id="${id}-m" x1="0" y1="0" x2=".7" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".45" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
      <linearGradient id="${id}-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/></linearGradient>
    </defs>${laurel ? `${branch}<g transform="translate(200 0) scale(-1 1)">${branch}</g>
      <path d="M86 181Q100 190 114 181" fill="none" stroke="url(#${id}-m)" stroke-width="5" stroke-linecap="round"/>` : ""}${crownArt}</svg>` });
}

// ---------------------------------------------------------------- 胸から上の立ち絵

/**
 * 立ち絵の胸から上を枠に収める。頭のてっぺんを枠の上から headTop の位置に、体の中心線を枠の中央に合わせる。
 * 枠の大きさ・切り抜きは CSS（.ts-bust に幅と高さ、overflow: hidden）。立ち絵が無い人は顔アイコンか頭文字。
 * @param zoom 枠の幅に対する立ち絵の幅（倍）。身長の割合で割り、頭の大きさを人物間でそろえる。
 */
export function bustOf(id, { face = "normal", cls = "", zoom = 2.3, headTop = 0.07, name = "" } = {}) {
  const root = el(`span.ts-bust${cls}`, { "aria-hidden": "true", dataset: { who: id } });
  const p = portraitInfo(id, face) || portraitInfo(id, "normal");
  if (p?.src) {
    const width = (zoom * 0.85) / (p.h || 0.85), top = Math.max(0, 1 - p.h - p.b - (p.topOverhang || 0));
    root.append(el("img", { src: p.src, alt: "", decoding: "async", draggable: "false", style: {
      width: `${(width * 100).toFixed(1)}%`, left: "50%", top: `${(headTop * 100).toFixed(1)}%`,
      transform: `translate(${(-p.ax * 100).toFixed(2)}%, ${(-top * 100).toFixed(2)}%)`,
    } }));
    return root;
  }
  const icon = faceIconUrl(id);
  root.classList.add("fallback");
  root.append(icon ? el("img.ts-bust-icon", { src: icon, alt: "", decoding: "async" }) : el("b", { text: [...(name || id)][0] || "" }));
  return root;
}

// ---------------------------------------------------------------- 見出しの帯

/**
 * 画面を横切る見出しの帯（「JUDGES' VOTE」など）。出て、止まり、抜ける。動きを見せない時は何も出さない。
 * @returns 抜け終わるまでの Promise（skip() で即座に片付ける）
 */
export function showSting(host, { eyebrow = "", title = "", sub = "", tone = "gold", ms = 1000 } = {}) {
  let done = () => {};
  const finished = new Promise((resolve) => { done = resolve; });
  if (!showMoves() || !host?.isConnected) { done(); return Object.assign(finished, { skip() {} }); }
  const node = el(`div.ts-sting.${tone}`, { "aria-hidden": "true" }, [
    el("i.ts-sting-band"),
    el("div.ts-sting-copy", [eyebrow ? el("small", { text: eyebrow }) : null, el("b", { text: title }), sub ? el("span", { text: sub }) : null]),
  ]);
  host.append(node);
  let timers = [];
  const close = () => { timers.forEach(clearTimeout); node.remove(); done(); };
  timers = [
    setTimeout(() => node.classList.add("in"), 20),
    setTimeout(() => node.classList.add("out"), ms),
    setTimeout(close, ms + 320),
  ];
  return Object.assign(finished, { skip: close });
}

// ---------------------------------------------------------------- 票のトークン

/** 票の粒が from から to へ山なりに飛ぶ。届いた時に解決する Promise（cancel() で消す）。 */
export function flyToken(host, from, to, { color = "#f6c95e", ms = 460, delay = 0, arc = 64 } = {}) {
  const a = localPoint(host, from), b = localPoint(host, to);
  const outer = el("i.ts-token", { "aria-hidden": "true", style: { left: `${a.x}px`, top: `${a.y}px`, "--c": color } }, [el("b")]);
  host.append(outer);
  const timing = { duration: ms, delay, fill: "both" };
  const x = outer.animate([{ transform: "translate(0, 0)" }, { transform: `translate(${b.x - a.x}px, 0)` }], { ...timing, easing: "linear" });
  const lift = Math.min(0, b.y - a.y) - arc;
  const y = outer.firstChild.animate([
    { transform: "translate(-50%, -50%) scale(.3)", opacity: 0, easing: "cubic-bezier(.2, .7, .4, 1)" },
    { transform: `translate(-50%, calc(-50% + ${lift}px)) scale(1.15)`, opacity: 1, offset: 0.45, easing: "cubic-bezier(.6, 0, .9, .6)" },
    { transform: `translate(-50%, calc(-50% + ${b.y - a.y}px)) scale(.85)`, opacity: 1 },
  ], timing);
  const landed = Promise.all([x.finished, y.finished]).then(() => true, () => false).finally(() => outer.remove());
  return Object.assign(landed, { cancel() { x.cancel(); y.cancel(); outer.remove(); } });
}

// ---------------------------------------------------------------- 票が入る進行

/** 票が届いた行を一瞬光らせる。行の登場アニメーション（CSS）を上書きしないよう、Web Animations で重ねる。 */
function hitFlash(row) {
  row.animate([{ filter: "brightness(1.75) saturate(1.25)", transform: "scale(1.014)" }, { filter: "none", transform: "none" }],
    { duration: 460, easing: "ease-out" });
}

/** 票の粒を続けて飛ばす間隔（ms）。 */
const STEP = 90;

const setNumber = (node, value) => {
  if (!node) return;
  if (node.firstChild?.nodeType === 3) node.firstChild.nodeValue = String(value);
  else node.prepend(document.createTextNode(String(value)));
};

/**
 * 票が入る瞬間を見せる。板は「入れた後」の値で組んでおき、ここで一度「入れる前」へ戻してから、審査員ごとに票を飛ばす。
 * 途中で skip() を呼ぶ（板をタップする）と、その場で最後の状態にそろえて終わる。動きを見せない時は何もせず即座に終わる。
 *
 * @param o.host        票の粒を重ねる要素（板）。position が static 以外であること
 * @param o.judges      審査員 id の並び（投票する順）
 * @param o.contestants 出場者 id の並び
 * @param o.before      入れる前の票 { judge: { contestant: 点 } }
 * @param o.after       入れた後の票（同じ形）
 * @param o.base        全員に付く基礎票 { contestant: 点 }（無ければ 0）
 * @param o.rankBefore  入れる前の並び [{ id, rank }]（上から）
 * @param o.rankAfter   入れた後の並び [{ id, rank }]（上から。板の DOM の順と同じ）
 * @param o.rowOf       (id) => 行の要素
 * @param o.pointsOf    (row) => 合計点の要素（最初の文字が数字）
 * @param o.medalOf     (row) => 順位の札
 * @param o.chipOf      (judge) => 審査員の札（.judge-chip）
 * @param o.held        保留中として見せる審査員 id（札の文字は変えない）
 * @param o.medalText   (rank) => 札の文字
 * @param o.me          主人公の id（順位が上がった時に強調する）
 * @param o.onJudge     (judge, chip) => void 審査員の番が来た時（見る所の文字を出すなど）
 * @param o.lead        最初の票までの待ち（ms）。見出しの帯を先に見せる時は長くする
 * @returns { done: Promise<void>, skip(): void, moved: boolean }
 */
export function voteCeremony(o) {
  const { host, judges, contestants, before, after, base = {}, rankBefore, rankAfter, rowOf, pointsOf, medalOf, chipOf,
    held = [], medalText = String, me = "hajime", onJudge = null, lead = 520 } = o;
  const gifts = judges.map((judge) => ({ judge, to: contestants
    .map((id) => ({ id, points: (after[judge]?.[id] || 0) - (before[judge]?.[id] || 0) })).filter((g) => g.points > 0) }))
    .filter((step) => step.to.length);
  const total = (table, id) => (base[id] || 0) + judges.reduce((sum, j) => sum + (table[j]?.[id] || 0), 0);
  if (!showMoves() || !gifts.length || !host?.isConnected) {
    if (host) host.dataset.ceremony = "done";
    return { done: Promise.resolve(), skip() {}, moved: false };
  }

  const rows = new Map(contestants.map((id) => [id, rowOf(id)]));
  const segOf = (id, judge) => rows.get(id)?.querySelector(`.vote-stack [data-judge="${judge}"]`);
  const live = structuredClone(before); // いま板に見えている票
  for (const judge of judges) { live[judge] ||= {}; for (const id of contestants) live[judge][id] ||= 0; }
  const flights = new Set();
  let skipped = false, fireSkip = () => {};
  const skipSignal = new Promise((resolve) => { fireSkip = resolve; });
  const wait = (ms) => skipped ? Promise.resolve() : Promise.race([sleep(ms), skipSignal]);

  const paintChip = (judge, table) => {
    const chip = chipOf(judge);
    if (!chip) return;
    const used = givenBy(table, judge);
    chip.dataset.spent = String(used);
    chip.querySelectorAll(".judge-pips b").forEach((pip, k) => pip.classList.toggle("on", k < used));
    const left = chip.querySelector(".judge-left");
    if (left) left.textContent = judgeLeftText(used, held.includes(judge));
  };
  const paintRow = (id, table) => {
    const row = rows.get(id);
    if (!row) return;
    for (const judge of judges) {
      const seg = segOf(id, judge);
      if (seg) seg.style.width = `${((table[judge]?.[id] || 0) / VOTE_SCALE) * 100}%`;
    }
    setNumber(pointsOf(row), total(table, id));
  };
  const paintOrder = (order) => order.forEach(({ id, rank }, index) => {
    const row = rows.get(id);
    if (!row) return;
    row.style.order = String(index);
    row.dataset.rank = String(rank);
    const medal = medalOf(row);
    if (medal) medal.textContent = medalText(rank);
  });

  // 入れる前の状態へ戻す（最初の描画の前に呼ぶこと）。
  host.dataset.ceremony = "running";
  host.classList.add("ts-voting");
  for (const judge of judges) paintChip(judge, before);
  for (const id of contestants) paintRow(id, before);
  paintOrder(rankBefore);
  host.querySelectorAll(".ts-vote-late").forEach((node) => node.classList.add("ts-wait"));

  const finish = () => {
    for (const flight of flights) flight.cancel();
    flights.clear();
    host.querySelectorAll(".ts-token, .ts-plus").forEach((node) => node.remove());
    for (const judge of judges) { paintChip(judge, after); chipOf(judge)?.classList.remove("ts-casting"); }
    for (const id of contestants) paintRow(id, after);
    paintOrder(rankAfter);
    host.querySelectorAll(".ts-wait").forEach((node) => node.classList.remove("ts-wait"));
    host.classList.remove("ts-voting");
    host.dataset.ceremony = "done";
  };

  const run = async () => {
    await wait(lead); // 板が出そろう（見出しの帯が抜ける）のを待つ
    for (const step of gifts) {
      if (!host.isConnected) skipped = true; // 画面が替わったら、残りは見せずに終える
      if (skipped) break;
      const chip = chipOf(step.judge), color = JUDGE_LOOK[step.judge]?.color || "#f6c95e";
      chip?.classList.add("ts-casting");
      onJudge?.(step.judge, chip);
      SE.card?.();
      await wait(220);
      let index = 0;
      const landings = [];
      for (const gift of step.to) {
        const row = rows.get(gift.id), seg = segOf(gift.id, step.judge);
        if (!row || !chip) continue;
        for (let n = 0; n < gift.points; n++) {
          const from = chip.querySelector(".judge-pips") || chip, target = seg?.parentElement || row;
          const flight = flyToken(host, from, target, { color, delay: index * STEP });
          flights.add(flight);
          landings.push(flight.then((landed) => {
            flights.delete(flight);
            if (!landed || skipped) return;
            live[step.judge][gift.id] += 1;
            paintRow(gift.id, live);
            paintChip(step.judge, live);
            hitFlash(row);
            SE.money?.();
            const at = localPoint(host, pointsOf(row) || row);
            sparkBurst(host, at.x, at.y, { count: 8, colors: [color, "#fff6dc", "#f6d68e"], spread: 46 });
          }));
          index += 1;
        }
        const stack = seg?.parentElement;
        if (!skipped && showMoves() && stack) {
          // 加点の札は、その審査員の色の帯が伸びきる先端に付ける（帯の終わりと点数の間に浮かせない）。
          const reach = judges.slice(0, judges.indexOf(step.judge) + 1)
            .reduce((sum, judge) => sum + (judge === step.judge ? (live[judge]?.[gift.id] || 0) + gift.points : live[judge]?.[gift.id] || 0), 0);
          const a = localPoint(host, stack, 0, 0.5), b = localPoint(host, stack, 1, 0.5);
          const x = a.x + (b.x - a.x) * Math.min(1, reach / VOTE_SCALE);
          const plus = el("b.ts-plus", { text: `+${gift.points}`, style: { left: `${x}px`, top: `${a.y}px`, "--c": color, animationDelay: `${index * STEP + 220}ms` } });
          host.append(plus);
          setTimeout(() => plus.remove(), index * STEP + 1500);
        }
      }
      await Promise.race([Promise.all(landings), skipSignal]);
      if (skipped) break;
      await wait(180);
      chip?.classList.remove("ts-casting");
    }
    if (!skipped) {
      // 並べ替え。行が実際に動いて入れ替わる。
      const tops = new Map([...rows].map(([id, row]) => [id, row.getBoundingClientRect().top]));
      const k = host.getBoundingClientRect().width / (host.offsetWidth || 1) || 1;
      paintOrder(rankAfter);
      let swapped = false;
      for (const [id, row] of rows) {
        const dy = (tops.get(id) - row.getBoundingClientRect().top) / k;
        if (Math.abs(dy) < 1) continue;
        swapped = true;
        row.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 620, easing: "cubic-bezier(.2, .8, .2, 1)" });
      }
      const was = rankBefore.find((r) => r.id === me)?.rank, now = rankAfter.find((r) => r.id === me)?.rank;
      if (swapped) { SE.whoosh?.(); await wait(640); }
      if (!skipped && was && now && now < was) {
        const row = rows.get(me), at = row ? localPoint(host, row, 0.5, 0.5) : null;
        if (at) {
          const up = el("b.ts-rankup", { text: now === 1 ? "首位に立った！" : "RANK UP", style: { left: `${at.x}px`, top: `${at.y}px` } });
          host.append(up);
          setTimeout(() => up.remove(), 1500);
          sparkBurst(host, at.x, at.y, { count: 18, spread: 130 });
          SE.perfect?.();
          await wait(700);
        }
      }
    }
    finish();
  };
  const done = run().catch((error) => { finish(); throw error; });
  return { done, moved: true, skip() { if (skipped) return; skipped = true; fireSkip(); } };
}

/**
 * 第2〜4章の持ち点の板（.ch2-contest-rival の行と .judge-chip の札）に、票が入る進行を付ける（TSH05）。
 * 板は「入れた後」の値で組んでおく。今回の配分が分からない旧保存や、動きを見せない時は何もしない。
 * 進行の間は buttons を押せなくし、板を押す（Enter・Space）と早送りする。出そろうまで late の要素は隠す。
 *
 * @param o.root        板と札を含む要素（票の粒を重ねる。position は static 以外）
 * @param o.judges      審査員 id の並び（投票する順）
 * @param o.contestants 出場者 id の並び
 * @param o.votes       入れた後の票 { judge: { contestant: 点 } }
 * @param o.before      入れる前の票。省くと votes から last（今回の配分）を引く
 * @param o.last        今回の配分 { judge: { points: { contestant: 点 } } }
 * @param o.base        全員に付く基礎票
 * @param o.rows        入れた後の並び [{ id, rank }]（板の行の順と同じ）
 * @param o.quality     同点の時に並びを決める出来栄え { contestant: 値 }
 * @param o.buttons     進行の間は押せなくするボタン
 * @param o.late        票が出そろうまで隠す要素
 * @param o.sting       最初に出す見出しの帯 { eyebrow, title, sub }。無ければ出さない
 * @returns { moved: boolean, done: Promise<void> } moved＝進行を見せたか
 */
export function contestCeremony(o) {
  const { root, judges, contestants, votes, last = null, base = {}, rows, quality = {}, buttons = [], late = [], sting = null, me = "hajime" } = o;
  const before = o.before || (last ? Object.fromEntries(judges.map((judge) => [judge, Object.fromEntries(contestants.map((id) =>
    [id, (votes[judge]?.[id] || 0) - (last[judge]?.points?.[id] || 0)]))])) : null);
  if (!before || !root?.isConnected || !showMoves()) return { moved: false, done: Promise.resolve() };
  const total = (id) => (base[id] || 0) + judges.reduce((sum, judge) => sum + (before[judge]?.[id] || 0), 0);
  const rankBefore = [...contestants].sort((a, b) => total(b) - total(a) || (quality[b] || 0) - (quality[a] || 0) || a.localeCompare(b))
    .map((id, index) => ({ id, rank: index + 1 }));
  for (const node of late) node?.classList.add("ts-vote-late");
  const locked = buttons.filter((button) => button && !button.disabled);
  const ceremony = voteCeremony({
    host: root, judges, contestants, before, after: votes, base, rankBefore, rankAfter: rows.map(({ id, rank }) => ({ id, rank })), me,
    rowOf: (id) => root.querySelector(`.ch2-contest-rival[data-contestant="${id}"]`), pointsOf: (row) => row.querySelector("strong"),
    medalOf: (row) => row.querySelector(".rank-medal"), chipOf: (judge) => root.querySelector(`.judge-chip[data-judge="${judge}"]`),
    lead: sting ? 950 : 500,
  });
  if (!ceremony.moved) return { moved: false, done: Promise.resolve() };
  for (const button of locked) button.disabled = true;
  if (sting) { SE.whoosh?.(); showSting(document.getElementById("fx"), { ...sting, ms: 700 }); }
  const skip = (event) => {
    if (event.type === "keydown" && event.key !== "Enter" && event.key !== " ") return;
    if (root.dataset.ceremony !== "running") return;
    // 同じ Enter が、開いたばかりのボタンまで押さないように止める。
    if (event.type === "keydown") { event.preventDefault(); event.stopPropagation(); }
    ceremony.skip();
  };
  root.addEventListener("click", skip);
  window.addEventListener("keydown", skip, true);
  const done = ceremony.done.finally(() => {
    root.removeEventListener("click", skip);
    window.removeEventListener("keydown", skip, true);
    for (const button of locked) button.disabled = false;
    if (root.isConnected) locked.find((button) => button.classList.contains("primary"))?.focus({ preventScroll: true });
  });
  return { moved: true, done };
}

// ---------------------------------------------------------------- 会話の中継の枠・合間のアイキャッチ

let liveNow = null, liveTimer = 0;

/** 掛け合いの場面名 → 帯に出す場面（第2〜4章。第1章は ROUND の名前で呼び出し側が渡す）。 */
const LIVE_PHASE = Object.freeze({
  prestart: "まもなく開始", interlude_pull: "制作 終了", serve: "提供", interlude1: "提供 終了", interlude2: "調整1回目 終了",
  interlude3: "全工程 終了", tasting: "最終審査", preresult: "まもなく結果発表",
});
/**
 * 第2〜4章の掛け合いに付ける帯の中身。順位は確定済みの並びを映すだけ（票が出る前は札を出さない）。
 * @param title 大会の名前
 * @param event 掛け合いの場面名（tournament-story-data.js）
 * @param rows  いまの並び [{ id, rank, points }]
 * @param nameOf (id) => 表示名（顔アイコンの無い人の頭文字に使う）
 */
export function liveOf(title, event, rows = [], nameOf = (id) => id) {
  return { event: title, phase: LIVE_PHASE[event] || "制作中",
    standings: rows.map((row) => ({ ...row, me: row.id === "hajime", face: faceIconUrl(row.id), name: nameOf(row.id) })) };
}

/**
 * 大会の会場での会話に付ける中継の枠（LIVE の帯・いまの順位・舞台の光）。
 * 会話レイヤー（#vn）の中に置き、光は立ち絵の後ろ、帯は立ち絵の手前に出す。会話が続く間は同じ枠を使い回す。
 * @param o.event     大会の名前（帯の見出し）
 * @param o.phase     いまの場面（「ROUND 1 終了」など）。空なら出さない
 * @param o.standings いまの順位 [{ id, rank, points, me, face }]。空なら順位の札を出さない
 * @returns 片付ける関数。続けて次の会場の会話が始まれば（同じ流れの中で liveFrame が呼ばれれば）枠はそのまま使い、
 *          そうでなければ直後に消す（大会の外の会話へ持ち越さない）
 */
export function liveFrame(host, { event = "", phase = "", standings = [] } = {}) {
  if (!host) return () => {};
  clearTimeout(liveTimer);
  if (!liveNow || !liveNow.back.isConnected || liveNow.host !== host) {
    liveNow?.back.remove(); liveNow?.front.remove();
    const back = el("div.ts-live.ts-live-back", { "aria-hidden": "true" });
    stageLights(back, { beams: 3, dust: 12, tone: "live" });
    const front = el("div.ts-live.ts-live-front", { "aria-hidden": "true" });
    host.prepend(back);
    host.append(front);
    liveNow = { host, back, front };
  }
  liveNow.front.replaceChildren(
    el("div.ts-live-bug", [el("i.tournament-live", { text: "LIVE" }), el("b", { text: event }), phase ? el("span", { text: phase }) : null]),
    ...(standings.length ? [el("div.ts-live-rank", standings.map((row) => el(`span.ts-live-chip${row.me ? ".me" : ""}`, { dataset: { rank: String(row.rank) } }, [
      el("b", { text: String(row.rank) }),
      row.face ? el("img", { src: row.face, alt: "", decoding: "async" }) : el("em", { text: [...(row.name || "")][0] || "" }),
      el("i", { text: `${row.points}pt` }),
    ])))] : []),
  );
  const mine = liveNow;
  return () => {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { if (liveNow === mine) { mine.back.remove(); mine.front.remove(); liveNow = null; } }, 0);
  };
}

/**
 * 合間のアイキャッチ（全画面の見出し）。幕が閉じ、紋章と見出しが出て、開く。押すとすぐ開く。動きを見せない時は出さない。
 * @param o.title  大きな見出し（「INTERVAL」など）
 * @param o.sub    その下の一行（「ROUND 1 → ROUND 2」など）
 * @param o.note   いちばん下の一行（「現在 2位」など）。空なら出さない
 */
export async function eyecatch(host, { title = "", sub = "", note = "", ms = 1250 } = {}) {
  if (!showMoves() || !host?.isConnected) return;
  const node = el("div.ts-eyecatch", { role: "presentation" }, [
    el("i.ts-eyecatch-l"), el("i.ts-eyecatch-r"),
    haloOf(".ts-eyecatch-halo"),
    el("div.ts-eyecatch-copy", [crestSvg({ metal: "gold", laurel: false }), el("b", { text: title }), sub ? el("span.ts-eyecatch-sub", { text: sub }) : null, note ? el("small", { text: note }) : null]),
  ]);
  host.append(node);
  SE.whoosh?.();
  await sleep(30);
  node.classList.add("in");
  await holdOrTap(node, ms);
  node.classList.add("out");
  await sleep(320);
  node.remove();
}

// ---------------------------------------------------------------- 結果の大見出し・結果の種類・合間のアイキャッチの中身

/**
 * 結果の大見出し。1位は「CHAMPION」（冠と月桂冠・後光・紙吹雪・はじめの立ち絵）、それ以外は順位だけを静かに出す。
 * 動きを見せない時（自動操作・動きを減らす）は何も出さない。押す（Enter・Space）と閉じる。
 * @param o.event 大会名（見出しの上の小さな帯）
 * @param o.face  はじめの表情（第2章の優勝は、味のしない舌を抱えたまま笑わない）
 * @param o.host  重ねる所（第4章の結果はモーダルの上に出すので #modal）
 */
export async function resultSplash(rank, { event = "SMOKE CROWN CUP", face = null, host = layers.fx } = {}) {
  if (!showMoves() || !host) return;
  const win = rank === 1, metal = metalOf(rank);
  // 優勝は冠と月桂冠に「1 ST」。届かなかった時は月桂冠だけを順位の後ろに薄く敷く。
  const crest = crestSvg({ metal, crown: win });
  if (win) crest.append(el("b", { text: "1" }), el("small", { text: "ST" }));
  const node = el(`div.ts-splash${win ? ".win" : ""}`, { dataset: { test: "result-splash", rank, metal }, tabindex: "-1", role: "status",
    "aria-label": win ? "優勝" : `${rank}位` }, [
    win ? haloOf() : null,
    el("i.ts-splash-floor", { "aria-hidden": "true" }),
    bustOf("hajime", { cls: ".ts-splash-bust", face: face || (win ? "smile" : "serious"), zoom: 1.5, headTop: 0.06, name: "はじめ" }),
    el("div.ts-splash-copy", [
      crest,
      el("small.ts-splash-eyebrow", { text: `${event} ／ FINAL RESULT` }),
      el("h2", { text: win ? "CHAMPION" : `${rank}位` }),
      el("p", { text: win ? "逢縁 はじめ" : "この一台の記録を、次の挑戦へ。" }),
    ]),
    el("span.ts-splash-tap", { text: "タップで順位表へ" }),
  ]);
  stageLights(node, { beams: win ? 5 : 2, dust: win ? 30 : 8, tone: win ? "gold" : "cool" });
  const previous = document.activeElement;
  host.append(node);
  await sleep(30);
  node.classList.add("show");
  node.focus({ preventScroll: true });
  if (win) { SE.fanfare?.(); SE.crowd?.(2.6); showConfetti(node, { count: 150, ms: 5200 }); flash("gold"); }
  else SE.stamp?.();
  await holdOrTap(node, win ? 3600 : 2200);
  node.classList.add("out");
  await sleep(380);
  node.remove();
  if (previous?.isConnected && document.activeElement === document.body) previous.focus({ preventScroll: true });
}

/** 10カウントの終わり方（第2〜4章）。1位＝プチュン、2・3位＝プチュ…→パリン、4位＝パリン。 */
export const countdownKind = (rank) => rank === 1 ? "win" : rank <= 3 ? "close" : "lose";

/** 合間の掛け合い → アイキャッチの見出し（第2〜4章。第1章は ROUND の名前で ch1.js が組む）。 */
const INTERVAL_CARD = Object.freeze({
  interlude_pull: ["INTERVAL", "制作 → 吸い出し・提供"],
  interlude1: ["INTERVAL", "提供 → 調整1回目"],
  interlude2: ["INTERVAL", "調整1回目 → 調整2回目"],
  interlude3: ["FINAL JUDGING", "全工程 終了"],
});
/**
 * 合間の掛け合いの前に出すアイキャッチの中身。合間ではない掛け合いは null（何も出さない）。
 * @param rows いまの並び [{ id, rank, points }]（票が出る前は空）
 */
export function intervalCard(event, rows = []) {
  const card = INTERVAL_CARD[event];
  if (!card) return null;
  const me = rows.find((row) => row.id === "hajime");
  return { title: card[0], sub: card[1], note: me ? `はじめ 現在${me.rank}位 ・ ${me.points}pt` : "" };
}

// ---------------------------------------------------------------- 待ち（タップで早送り）

/** ms 待つ。途中で node を押す（Enter・Space を含む）と、すぐに次へ進む。 */
export function holdOrTap(node, ms) {
  return new Promise((resolve) => {
    let timer = 0;
    const finish = () => {
      clearTimeout(timer);
      node.removeEventListener("pointerdown", finish);
      node.removeEventListener("keydown", onKey);
      resolve();
    };
    // Enter・Space は、後ろの画面（モーダルの「Enter で決定」など）へ渡さない。
    const onKey = (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); finish(); } };
    node.addEventListener("pointerdown", finish);
    node.addEventListener("keydown", onKey);
    timer = setTimeout(finish, ms);
  });
}
