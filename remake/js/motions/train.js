// 電車に乗るトランジション（Issue #891）。満員電車の車内を、吊り革と乗客の単色シルエットで描いた横長の絵が
// ガタンゴトンと揺れながら右から左へ通り過ぎる。覆っている間に mid() で次の背景へ替える。
// 色は昼が青緑、夜がセピア（?mopal=free）。紫1色（既定）は紫の濃淡で同じ絵を描く。
// SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { SE } from "../core/audio.js";
import { timeOfDay } from "../core/state.js";
import { W, H, svg, stageSvg } from "../core/transition-kit.js";
import { pick, MONO } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

/** 色: bg 車内の暗がり・win 窓・glow 窓の光・back/mid/front 奥から手前の人・hair 髪・ink 輪郭・rim 縁の光 */
const DAY = { bg: "#0d1517", win: "#3d5250", glow: "#bfe0d6", back: "#4c625e", mid: "#748c86", front: "#a3bab2", hair: "#24302f", ink: "#081012", rim: "#e4f4ee", rail: "#5d726e" };
const NIGHT = { bg: "#150f0a", win: "#4d3e30", glow: "#ecd2a8", back: "#5e4b3a", mid: "#8a735c", front: "#bca487", hair: "#2a1f17", ink: "#110b07", rim: "#f6e6c8", rail: "#6f5d4b" };
const MONO_TRAIN = { bg: MONO.deep, win: "#3a2a6e", glow: MONO.light, back: "#3e2d78", mid: MONO.main, front: MONO.mid, hair: "#1e1544", ink: "#0b0718", rim: MONO.white, rail: "#5a4597" };

const SPAN = 3600; // 車内の絵の横幅
const SLANT = 150; // 先頭と最後尾の斜めの切り口
const RAIL_Y = 46, STRAP_Y = 128; // 吊り革の棒と輪の位置
const HALF = 1350; // 入ってくる半分・出ていく半分の長さ（ms）

/** 毎回同じ並びになる乱数 */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 吊り革1本（上端 (x, RAIL_Y) を軸に揺らす） */
function strap(P, x) {
  const g = svg("g", {}, [
    svg("rect", { x: x - 6, y: RAIL_Y, width: 12, height: STRAP_Y - RAIL_Y, rx: 3, fill: P.rail, stroke: P.ink, "stroke-width": 3 }),
    svg("path", { d: `M ${x} ${STRAP_Y - 4} L ${x - 22} ${STRAP_Y + 40} Q ${x} ${STRAP_Y + 50} ${x + 22} ${STRAP_Y + 40} Z`, fill: "none", stroke: P.ink, "stroke-width": 12, "stroke-linejoin": "round" }),
    svg("path", { d: `M ${x} ${STRAP_Y - 4} L ${x - 22} ${STRAP_Y + 40} Q ${x} ${STRAP_Y + 50} ${x + 22} ${STRAP_Y + 40} Z`, fill: "none", stroke: P.rail, "stroke-width": 6, "stroke-linejoin": "round" }),
  ]);
  return { g, x };
}

/** 色を明るく（k>0）・暗く（k<0）する */
function shift(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.round(k > 0 ? v + (255 - v) * k : v * (1 + k));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}

/** 太い線に輪郭をつけた腕（下に濃い太線、上に体の色の細い線） */
const limb = (P, d, color, w = 24) => [
  svg("path", { d, fill: "none", stroke: P.ink, "stroke-width": w + 8, "stroke-linecap": "round", "stroke-linejoin": "round" }),
  svg("path", { d, fill: "none", stroke: color, "stroke-width": w, "stroke-linecap": "round", "stroke-linejoin": "round" }),
];

/**
 * 乗客1人。首の付け根が (0,0)、下は画面の外まで。背中向き／横向き（うつむいてスマホ）、吊り革をつかむ腕、肩かけかばん、
 * 髪（短い・長い・帽子）。tone: 体の色。reach: つかむ吊り革までの相対位置 [dx, dy]（なければ腕は下ろす）
 */
function person(P, rnd, tone, reach) {
  const s = 46 + rnd() * 20; // 肩幅の半分
  const hr = 31 + rnd() * 6; // 頭の大きさ
  const side = !reach && rnd() < 0.4; // 横向き（スマホを見る）
  const hair = ["short", "short", "long", "cap"][Math.floor(rnd() * 4)];
  const bag = rnd() < 0.3;
  const skin = shift(tone, 0.12), dark = shift(tone, -0.28);
  const outline = { stroke: P.ink, "stroke-width": 4, "stroke-linejoin": "round" };
  const parts = [];
  // 脚（裾の下）
  parts.push(
    svg("rect", { x: -s * 0.58, y: 440, width: s * 0.5, height: 400, fill: P.hair, ...outline }),
    svg("rect", { x: s * 0.08, y: 440, width: s * 0.5, height: 400, fill: P.hair, ...outline }),
  );
  // つかむ腕（肩→ひじ→吊り革の輪）。体より先に描いて、肩の付け根を体で隠す
  if (reach) {
    const [hx, hy] = reach;
    const dir = Math.sign(hx || 1), sx = dir * s * 0.7;
    const ex = sx + (hx - sx) * 0.55 + dir * 22, ey = hy * 0.42;
    parts.push(...limb(P, `M ${sx} 26 L ${ex} ${ey} L ${hx} ${hy + 18}`, tone, 26));
    parts.push(svg("ellipse", { cx: hx, cy: hy + 8, rx: 13, ry: 17, fill: skin, ...outline }));
  }
  // コート（なで肩から腰へ少しすぼまり、裾へ広がる）
  parts.push(svg("path", {
    d: `M ${-s * 0.42} -6 C ${-s * 0.8} -4 ${-s} 6 ${-s * 1.02} 36 L ${-s * 0.96} 200 Q ${-s * 0.84} 262 ${-s * 0.92} 330 L ${-s * 0.98} 460
        L ${s * 0.98} 460 L ${s * 0.92} 330 Q ${s * 0.84} 262 ${s * 0.96} 200 L ${s * 1.02} 36 C ${s} 6 ${s * 0.8} -4 ${s * 0.42} -6 Z`,
    fill: tone, ...outline,
  }));
  // 背中の縫い目と、窓側からの縁の光
  parts.push(svg("path", { d: `M 0 30 L 0 440`, stroke: dark, "stroke-width": 3, opacity: 0.6 }));
  parts.push(svg("path", { d: `M ${-s * 0.5} -2 C ${-s * 0.82} 0 ${-s * 0.97} 10 ${-s * 0.97} 40 L ${-s * 0.92} 200`, fill: "none", stroke: P.rim, "stroke-width": 5, opacity: 0.4, "stroke-linecap": "round" }));
  // 下ろした腕。横向きの人は片手を胸の前へ曲げてスマホを持つ
  const free = reach ? [-Math.sign(reach[0] || 1)] : [-1, 1];
  for (const d of free) {
    const bent = side && d === 1;
    const path = bent
      ? `M ${s * 0.86} 34 Q ${s * 1.04} 120 ${s * 0.92} 190 L ${s * 0.25} 150`
      : `M ${d * s * 0.86} 34 Q ${d * (s + 10)} 140 ${d * (s + 2)} 270`;
    parts.push(...limb(P, path, shift(tone, -0.06), 24));
    const [hx, hy] = bent ? [s * 0.22, 148] : [d * (s + 2), 280];
    parts.push(svg("ellipse", { cx: hx, cy: hy, rx: 11, ry: 14, fill: skin, ...outline }));
    if (bent) parts.push(svg("rect", { x: s * 0.08, y: 112, width: 22, height: 34, rx: 4, fill: P.glow, opacity: 0.8, ...outline }));
  }
  // 肩かけかばん
  if (bag) {
    parts.push(svg("path", { d: `M ${s * 0.36} -4 L ${-s * 0.8} 230`, stroke: P.ink, "stroke-width": 7, fill: "none" }));
    parts.push(svg("rect", { x: -s - 40, y: 214, width: 76, height: 62, rx: 10, fill: dark, ...outline }));
  }
  // 首と頭（横向きはうつむいて少し前へ）
  const fx = side ? 12 : 0, fy = side ? -hr - 6 : -hr - 14;
  parts.push(svg("rect", { x: -12, y: -28, width: 24, height: 28, fill: skin, ...outline }));
  if (side) {
    parts.push(svg("ellipse", { cx: fx, cy: fy, rx: hr * 0.94, ry: hr, fill: skin, ...outline }));
    // 後ろ半分の髪
    parts.push(svg("path", { d: `M ${fx - hr * 0.96} ${fy + hr * 0.3} C ${fx - hr * 1.05} ${fy - hr * 1.1} ${fx + hr * 0.6} ${fy - hr * 1.25} ${fx + hr * 0.7} ${fy - hr * 0.55} Q ${fx} ${fy - hr * 0.4} ${fx - hr * 0.1} ${fy + hr * 0.5} Z`, fill: P.hair, ...outline }));
  } else {
    parts.push(svg("ellipse", { cx: -hr * 0.96, cy: fy + 6, rx: 6, ry: 10, fill: skin, ...outline }));
    parts.push(svg("ellipse", { cx: hr * 0.96, cy: fy + 6, rx: 6, ry: 10, fill: skin, ...outline }));
    parts.push(svg("ellipse", { cx: 0, cy: fy, rx: hr, ry: hr * 1.05, fill: P.hair, ...outline }));
  }
  if (hair === "long") parts.push(svg("path", { d: `M ${fx - hr * 0.92} ${fy} Q ${fx - hr * 1.02} ${hr + 30} ${fx - hr * 0.5} ${hr + 38} L ${fx + hr * 0.5} ${hr + 38} Q ${fx + hr * 1.02} ${hr + 30} ${fx + hr * 0.92} ${fy} Z`, fill: P.hair, ...outline }));
  if (hair === "cap") parts.push(svg("path", { d: `M ${fx - hr * 1.02} ${fy - 2} Q ${fx - hr} ${fy - hr * 1.25} ${fx} ${fy - hr * 1.2} Q ${fx + hr} ${fy - hr * 1.25} ${fx + hr * 1.02} ${fy - 2} Z`, fill: dark, ...outline }));
  const flip = reach || rnd() < 0.5 ? 1 : -1; // つかむ人は吊り革の位置に合わせて反転しない
  const bob = svg("g", {}, [svg("g", { transform: `scale(${flip} 1)` }, parts)]);
  return { bob, phase: rnd() * Math.PI * 2, amp: 1.5 + rnd() * 2, flip };
}

/** 車内の絵（横幅 SPAN）。揺れの更新に使う部品も返す */
function carriage(P, id) {
  const rnd = seeded(891);
  const body = [];
  // 車内の地と、斜めの切り口
  body.push(svg("polygon", { points: `${SLANT},-60 ${SPAN},-60 ${SPAN - SLANT},${H + 80} 0,${H + 80}`, fill: P.bg }));
  // 窓（向こうの景色の光が流れる）
  const wins = [];
  for (let x = 120; x < SPAN - 380; x += 540) wins.push(svg("rect", { x, y: 150, width: 400, height: 230, rx: 26 }));
  body.push(svg("defs", {}, [
    svg("clipPath", { id: `${id}-win` }, wins.map((w) => w.cloneNode())),
    svg("linearGradient", { id: `${id}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svg("stop", { offset: 0.55, "stop-color": P.bg, "stop-opacity": 0 }),
      svg("stop", { offset: 1, "stop-color": P.bg, "stop-opacity": 0.85 }),
    ]),
  ]));
  for (const w of wins) { w.setAttribute("fill", P.win); w.setAttribute("stroke", P.ink); w.setAttribute("stroke-width", 8); body.push(w); }
  const lights = svg("g", { "clip-path": `url(#${id}-win)` }, [0, 1, 2, 3, 4].map((i) => svg("polygon", {
    points: `${i * 820},150 ${i * 820 + 160},150 ${i * 820 + 100},380 ${i * 820 - 60},380`, fill: P.glow, opacity: 0.22,
  })));
  body.push(lights);
  // 網棚の棒と吊り革
  body.push(svg("rect", { x: SLANT - 20, y: RAIL_Y - 10, width: SPAN - SLANT, height: 12, fill: P.rail, stroke: P.ink, "stroke-width": 3 }));
  const straps = [];
  for (let x = 220; x < SPAN - 120; x += 118) straps.push(strap(P, x));
  // 乗客: 奥の列（小さく暗く）→ 手前の列（大きく明るい）。手前は何人かが吊り革をつかむ
  const people = [];
  const row = (y0, scale, tone, gap, reachChance) => {
    for (let x = 160 + rnd() * gap * 0.6; x < SPAN - 160; x += gap * (0.72 + rnd() * 0.55)) {
      const y = y0 + (rnd() - 0.5) * 40;
      const k = scale * (0.92 + rnd() * 0.16);
      let reach = null;
      if (rnd() < reachChance) {
        const near = straps.reduce((a, b) => (Math.abs(b.x - x) < Math.abs(a.x - x) ? b : a));
        if (Math.abs(near.x - x) < 80 && !near.held) {
          near.held = true;
          reach = [(near.x - x) / k, (STRAP_Y + 38 - y) / k];
        }
      }
      const p = person(P, rnd, shift(tone, (rnd() - 0.5) * 0.16), reach);
      people.push(p);
      body.push(svg("g", { transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${k.toFixed(3)})` }, [p.bob]));
    }
  };
  // 奥から手前へ4列。吊り革は奥の2列のあとに描き、手前の人の腕が上にかかる
  row(282, 0.62, P.back, 112, 0.1);
  row(318, 0.74, shift(P.back, 0.08), 140, 0.15);
  for (const st of straps) body.push(st.g);
  row(372, 0.9, P.mid, 185, 0.35);
  row(440, 1.08, P.front, 245, 0.5);
  // 足元へ向かって暗く
  body.push(svg("rect", { x: 0, y: 0, width: SPAN, height: H + 80, fill: `url(#${id}-fade)` }));
  return { g: svg("g", {}, body), straps, people, lights };
}

let serial = 0;
/** 入りは加速、出は減速（つなぎ目で速さがそろう） */
const easeIn = (p) => 0.5 * p + 0.5 * p * p;
const easeOut = (p) => 1.5 * p - 0.5 * p * p;
function tween(ms, f) {
  return new Promise((done) => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / ms);
      f(p);
      if (p < 1) requestAnimationFrame(tick);
      else done();
    };
    requestAnimationFrame(tick);
  });
}

/** ガタン（継ぎ目）の小さな縦の跳ね: t 秒のあと短く沈んで戻る */
const JOLTS = [0.15, 0.27, 1.05, 1.17, 1.95, 2.07];
const jolt = (t) => JOLTS.reduce((y, j) => (t > j && t < j + 0.3 ? y + 5 * Math.sin(((t - j) / 0.3) * Math.PI) * (1 - (t - j) / 0.3) : y), 0);

/** tone: "day" | "night"（省略時は今の時間帯） */
export async function a(mid, { tone } = {}) {
  const P = pick((tone || timeOfDay()) === "night" ? NIGHT : DAY, MONO_TRAIN);
  await stagePlay("train", async (node) => {
    const car = carriage(P, `mo-train-${++serial}`);
    const pan = svg("g", {}, [car.g]);
    const rock = svg("g", {}, [pan]);
    node.append(stageSvg([rock]));
    const start = W + 20, end = -SPAN - 20, center = (W - SPAN) / 2;
    let x = start;
    const t0 = performance.now();
    // 毎フレーム: 車体の揺れ・吊り革の振れ・人の小さな上下・窓の光の流れ
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      const sway = 0.5 * Math.sin((t / 1.2) * Math.PI * 2);
      rock.setAttribute("transform", `translate(0 ${jolt(t).toFixed(2)}) rotate(${sway.toFixed(3)} ${W / 2} ${H + 220})`);
      pan.setAttribute("transform", `translate(${x.toFixed(1)} 0)`);
      for (const [i, st] of car.straps.entries()) {
        const a = st.held ? -sway : -sway * 4 + 5 * Math.sin((t / 1.2) * Math.PI * 2 - 1.1 + i * 0.35) + 4 * Math.sin(t * 9 + i) * Math.max(0, 0.6 - t);
        st.g.setAttribute("transform", `rotate(${a.toFixed(2)} ${st.x} ${RAIL_Y})`);
      }
      for (const p of car.people) p.bob.setAttribute("transform", `translate(0 ${(p.amp * Math.sin(t * 7.5 + p.phase) + jolt(t - 0.04) * 0.6).toFixed(2)})`);
      car.lights.setAttribute("transform", `translate(${(-((t * 1900) % 820)).toFixed(1)} 0)`);
      if (!done) requestAnimationFrame(frame);
    };
    let done = false;
    requestAnimationFrame(frame);
    SE.train?.(HALF * 2 / 1000);
    try {
      // 1. 右から車内が入ってきて、画面を覆う
      await tween(HALF, (p) => { x = start + (center - start) * easeIn(p); });
      // 2. 覆っている間に次の背景へ（ふつうは一瞬）
      await mid?.();
      // 3. そのまま左へ通り過ぎ、新しい場面が見える
      await tween(HALF, (p) => { x = center + (end - center) * easeOut(p); });
    } finally {
      done = true;
    }
  }, { cover: true });
}

export const b = a;
