// A7 第5章 二本勝負の挙手「席の灯り」（#2688・#2735）。客席の席ごとの小さな灯りが一つずつ点き、
// はじめの卓（左・琥珀）と 9000 の卓（右・ラベンダー）のどちらへ寄るかで色と傾きが分かれる。二本目は一本目の灯りの上に輪で重なる。
// 数字は出さない（正本「採点UIは出さない」）。同じ条件でも席ごとに票が割れる、を見せる。約2.5秒。
// 席の並びは票の数だけから決める（保存・結果には触れない）。動きを減らす設定では、点き終えた客席の薄いフェードだけ。
import { sleep } from "../core/util.js";
import { SE } from "../core/audio.js";
import { W, H, svg, stageSvg, move, COLOR } from "../core/transition-kit.js";
import { MG_EASE as E, MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

const SIDE = { hajime: { color: "#ffb35c", lean: -1 }, machine: { color: COLOR.lav, lean: 1 } };
const COLS = 10;
const TABLE_Y = 150;

/** 決まった並びの乱数（同じ票なら毎回同じ席が同じ色） */
function seeded(seed) {
  let s = seed % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

/** 票の数だけの "hajime"/"machine" を、席の順にまぜて並べる */
function spread(votes, rand) {
  const list = [...Array(votes.hajime || 0).fill("hajime"), ...Array(votes.machine || 0).fill("machine")];
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list;
}

/** 客席の位置（手前ほど広い扇形の段） */
function seatAt(i, n) {
  const rows = Math.ceil(n / COLS);
  const row = Math.floor(i / COLS), col = i % COLS;
  const inRow = Math.min(COLS, n - row * COLS);
  const depth = rows > 1 ? row / (rows - 1) : 1;
  const span = 620 + depth * 380;
  const x = W / 2 - span / 2 + (inRow > 1 ? (col / (inRow - 1)) * span : span / 2);
  const y = 330 + row * 86 + Math.abs(x - W / 2) * 0.05;
  return { x, y, r: 10 + depth * 6 };
}

export async function play({ tally = null, pace = 1, still = false } = {}) {
  const first = tally?.first, second = tally?.second;
  if (!first || !second) return;
  await stagePlay("seat-lights", async (node) => {
    const t = (ms) => Math.round(ms * pace);
    const rand = seeded((first.hajime * 97 + first.machine) * 131 + second.hajime * 7 + second.machine);
    const n = Math.max(first.hajime + first.machine, second.hajime + second.machine);
    const one = spread(first, rand), two = spread(second, rand);
    const veil = svg("rect", { x: 0, y: 0, width: W, height: H, fill: COLOR.ink, opacity: 0 });
    // 奥の二つの卓（形だけの淡い光。人物は描かない）
    const tables = ["hajime", "machine"].map((side) => svg("ellipse", {
      cx: W / 2 + SIDE[side].lean * 300, cy: TABLE_Y, rx: 150, ry: 26, fill: "none", stroke: SIDE[side].color, "stroke-width": 4, opacity: 0,
    }));
    const seats = Array.from({ length: n }, (_, i) => seatAt(i, n));
    const base = seats.map((s) => svg("circle", { cx: s.x, cy: s.y, r: s.r * 0.55, fill: MONO.main, opacity: 0 }));
    const light = (side, s, ring) => svg("circle", ring
      ? { cx: s.x + SIDE[side].lean * s.r * 0.9, cy: s.y - s.r * 0.4, r: s.r * 1.55, fill: "none", stroke: SIDE[side].color, "stroke-width": 3.5, opacity: 0, class: "tr-scale" }
      : { cx: s.x + SIDE[side].lean * s.r * 0.6, cy: s.y - s.r * 0.2, r: s.r, fill: SIDE[side].color, opacity: 0, class: "tr-scale" });
    const lightsOne = one.map((side, i) => light(side, seats[i], false));
    const lightsTwo = two.map((side, i) => light(side, seats[i], true));
    const art = svg("g", {}, [...tables, ...base, ...lightsOne, ...lightsTwo]);
    node.append(stageSvg([veil, art]));
    if (still) {
      [...tables, ...base, ...lightsOne, ...lightsTwo].forEach((c) => c.setAttribute("opacity", c.getAttribute("fill") === "none" ? 0.8 : 0.9));
      move(veil, [{ opacity: 0 }, { opacity: 0.7, offset: 0.3 }, { opacity: 0 }], 1200, { easing: "linear" });
      await move(art, [{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], 1200, { easing: "linear" });
      return;
    }
    // 1. 客席が暗くなり、奥の二つの卓と空の席が見える
    move(veil, [{ opacity: 0 }, { opacity: 0.78 }], t(240), { easing: "linear" });
    tables.forEach((c) => move(c, [{ opacity: 0 }, { opacity: 0.7 }], t(240), { easing: "linear" }));
    base.forEach((c) => move(c, [{ opacity: 0 }, { opacity: 0.45 }], t(240), { easing: "linear" }));
    await sleep(t(200));
    // 2. 一本目: 席ごとに灯りが点く（卓の方へ少し寄る）
    const step = Math.max(10, Math.round(680 / n));
    const pop = (c, i, from) => move(c, [{ opacity: 0, transform: `scale(${from})` }, { opacity: 1, transform: "scale(1)" }], t(220), { easing: E.back, delay: t(i * step) });
    lightsOne.forEach((c, i) => pop(c, i, 0.2));
    SE.click?.();
    await sleep(t(n * step + 260));
    // 3. 二本目: 同じ席の上に、二本目の灯りが輪で重なる
    lightsTwo.forEach((c, i) => pop(c, i, 1.6));
    SE.click?.();
    await sleep(t(n * step + 380));
    // 4. 客席ごと静かに消える
    await move(node, [{ opacity: 1 }, { opacity: 0 }], t(300), { easing: "linear" });
  });
}
