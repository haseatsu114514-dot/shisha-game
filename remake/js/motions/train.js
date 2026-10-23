// 電車に乗るトランジション（Issue #891）。満員電車の車内（吊り革・窓はコード、乗客は生成画像に色を付けたもの）の横長の絵が
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

const SPAN = 4180; // 車内の絵の横幅（手前の乗客の絵4枚ぶん）
const SLANT = 150; // 先頭と最後尾の斜めの切り口
const RAIL_Y = 46, STRAP_Y = 128; // 吊り革の棒と輪の位置
const HALF = 1350; // 入ってくる半分・出ていく半分の長さ（ms）

/** 吊り革1本（上端 (x, RAIL_Y) を軸に揺らす） */
function strap(P, x) {
  const g = svg("g", {}, [
    svg("rect", { x: x - 6, y: RAIL_Y, width: 12, height: STRAP_Y - RAIL_Y, rx: 3, fill: P.rail, stroke: P.ink, "stroke-width": 3 }),
    svg("path", { d: `M ${x} ${STRAP_Y - 4} L ${x - 22} ${STRAP_Y + 40} Q ${x} ${STRAP_Y + 50} ${x + 22} ${STRAP_Y + 40} Z`, fill: "none", stroke: P.ink, "stroke-width": 12, "stroke-linejoin": "round" }),
    svg("path", { d: `M ${x} ${STRAP_Y - 4} L ${x - 22} ${STRAP_Y + 40} Q ${x} ${STRAP_Y + 50} ${x + 22} ${STRAP_Y + 40} Z`, fill: "none", stroke: P.rail, "stroke-width": 6, "stroke-linejoin": "round" }),
  ]);
  return { g, x };
}

/** 乗客の絵（オーナーがGPTで生成した灰色の3枚を透過にしたもの・asset_sources/transitions/train-crowd-20261023/） */
const CROWD = ["a", "b", "c"].map((k) => new URL(`../../img/ui/transitions/train/crowd_${k}.webp`, import.meta.url).href);
const CW = 1536, CH = 1024; // 乗客の絵の大きさ
const TOP = RAIL_Y + 2; // 絵の上端（吊り革の帯が棒から下がって見える位置）

/** 絵を先に読んでおく（途中で人が遅れて出ないように）。読めなくても先へ進む */
const ready = (url) => { const img = new Image(); img.src = url; return img.decode().catch(() => {}); };

/** 灰色の絵に色を付けるフィルター（暗い所→ink、中間→tone、明るい所→light） */
function tint(id, ink, tone, light) {
  const ch = (i) => [ink, tone, light].map((c) => (parseInt(c.slice(1 + i * 2, 3 + i * 2), 16) / 255).toFixed(3)).join(" ");
  return svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
    svg("feComponentTransfer", {}, [
      svg("feFuncR", { type: "table", tableValues: ch(0) }),
      svg("feFuncG", { type: "table", tableValues: ch(1) }),
      svg("feFuncB", { type: "table", tableValues: ch(2) }),
    ]),
  ]);
}

/** 乗客の絵を横に並べた1列。scale: 大きさ、order: 使う絵と左右反転、x0: 左端 */
function crowdRow(filter, scale, order, x0, overlap = 30) {
  const w = CW * scale, h = CH * scale;
  const panels = order.map(([i, flip], n) => {
    const x = x0 + n * (w - overlap);
    const img = svg("image", { href: CROWD[i], x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none" });
    if (flip) img.setAttribute("transform", `translate(${w} 0) scale(-1 1)`);
    const bob = svg("g", {}, [img]);
    return { g: svg("g", { transform: `translate(${x.toFixed(1)} ${TOP})`, filter: `url(#${filter})` }, [bob]), bob };
  });
  return panels;
}

/** 車内の絵（横幅 SPAN）。揺れの更新に使う部品も返す */
function carriage(P, id) {
  const body = [];
  const front = (H + 40 - TOP) / CH; // 手前の列: 絵の下端が画面の下より少し下
  const edge = `${SLANT},-60 ${SPAN},-60 ${SPAN - SLANT},${H + 80} 0,${H + 80}`;
  // 窓（向こうの景色の光が流れる）
  const wins = [];
  for (let x = 120; x < SPAN - 380; x += 540) wins.push(svg("rect", { x, y: 120, width: 400, height: 250, rx: 26 }));
  body.push(svg("defs", {}, [
    svg("clipPath", { id: `${id}-car` }, [svg("polygon", { points: edge })]),
    svg("clipPath", { id: `${id}-win` }, wins.map((w) => w.cloneNode())),
    svg("linearGradient", { id: `${id}-fade`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
      svg("stop", { offset: 0.6, "stop-color": P.bg, "stop-opacity": 0 }),
      svg("stop", { offset: 1, "stop-color": P.bg, "stop-opacity": 0.7 }),
    ]),
    tint(`${id}-front`, P.ink, P.front, P.rim),
    tint(`${id}-back`, P.bg, P.back, P.mid), // 奥は暗がりに沈める
  ]));
  body.push(svg("polygon", { points: edge, fill: P.bg }));
  for (const w of wins) { w.setAttribute("fill", P.win); w.setAttribute("stroke", P.ink); w.setAttribute("stroke-width", 8); body.push(w); }
  const lights = svg("g", { "clip-path": `url(#${id}-win)` }, [0, 1, 2, 3, 4, 5].map((i) => svg("polygon", {
    points: `${i * 820},120 ${i * 820 + 160},120 ${i * 820 + 100},370 ${i * 820 - 60},370`, fill: P.glow, opacity: 0.22,
  })));
  body.push(lights);
  // 網棚の棒と、空いている吊り革（奥の人の後ろで揺れる）
  body.push(svg("rect", { x: 0, y: RAIL_Y - 10, width: SPAN, height: 12, fill: P.rail, stroke: P.ink, "stroke-width": 3 }));
  const straps = [];
  for (let x = 90; x < SPAN; x += 150) straps.push(strap(P, x));
  for (const st of straps) body.push(st.g);
  // 奥の列（小さく暗く）→ 手前の列。絵の組み合わせと反転を変えて、同じ人が並ばないようにする
  const back = crowdRow(`${id}-back`, front * 0.78, [[1, true], [2, false], [0, true], [1, false], [2, true], [0, false]], -260);
  const near = crowdRow(`${id}-front`, front, [[0, false], [1, false], [2, false], [0, true]], 0);
  const panels = [...back, ...near];
  body.push(...panels.map((p) => p.g));
  // 足元へ向かって暗く
  body.push(svg("rect", { x: 0, y: 0, width: SPAN, height: H + 80, fill: `url(#${id}-fade)` }));
  const people = panels.map((p, i) => ({ bob: p.bob, phase: i * 1.7, amp: 2 + (i % 3) }));
  return { g: svg("g", { "clip-path": `url(#${id}-car)` }, body), straps, people, lights };
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
  await Promise.race([Promise.all(CROWD.map(ready)), new Promise((r) => setTimeout(r, 3000))]);
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
        const a = -sway * 4 + 5 * Math.sin((t / 1.2) * Math.PI * 2 - 1.1 + i * 0.35) + 4 * Math.sin(t * 9 + i) * Math.max(0, 0.6 - t);
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
