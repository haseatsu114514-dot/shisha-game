// 紫の車内へ短くフェードし、乗車中だけゆっくり流す。背景の交換は不透明な車内の下で行う。
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MONO } from "../core/mg-kit.js";
import { stagePlay, backdrop } from "./stage.js";
import { PRIVATE_PASSENGERS, trainPassengers } from "./train-passengers.js";

/** 色: bg 車内の暗がり・win 窓・glow 窓の光・back/mid/front 奥から手前の人・hair 髪・ink 輪郭・rim 縁の光 */
const MONO_TRAIN = { bg: MONO.deep, win: "#3a2a6e", glow: MONO.light, back: "#3e2d78", mid: MONO.main, front: MONO.mid, hair: "#1e1544", ink: "#0b0718", rim: MONO.white, rail: "#5a4597" };

const SPAN = 3000; // 切り口を画面外に保つ車内の横幅
const SLANT = 150; // 先頭と最後尾の斜めの切り口
const RAIL_Y = 46, STRAP_Y = 128; // 吊り革の棒と輪の位置
const FADE_IN = 220, RIDE = 1000, FADE_OUT = 280;
const TOTAL = FADE_IN + RIDE + FADE_OUT; // 通常1.5秒。到着画像が遅い間は不透明な車内で待つ。
const FEATHER = 380; // 先頭・最後尾を暗がりへ溶かす幅

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
const ready = (url) => { const img = new Image(); img.src = url; return img.decode().then(() => true, () => false); };

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
function crowdRow(filter, scale, order, x0, available, overlap = 30) {
  const w = CW * scale, h = CH * scale;
  const panels = order.map(([i, flip], n) => {
    if (!available.has(CROWD[i])) return null;
    const x = x0 + n * (w - overlap);
    const img = svg("image", { href: CROWD[i], x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none" });
    if (flip) img.setAttribute("transform", `translate(${w} 0) scale(-1 1)`);
    const bob = svg("g", {}, [img]);
    return { g: svg("g", { transform: `translate(${x.toFixed(1)} ${TOP})`, filter: `url(#${filter})` }, [bob]), bob };
  });
  return panels.filter(Boolean);
}

const passengerUrl = (id) => new URL(`../../img/sprites/characters/${id}/chr_${id}_${PRIVATE_PASSENGERS[id].face}.webp`, import.meta.url).href;

/** 期間中だけ、普通の乗客の後ろに魔女帽子と角の仮装客が混ざる。紫の人影に統一する。 */
function costumePassengers(P) {
  return [0, 1].map(i => {
    const head = svg("path", { d: "M -33 206 Q -38 164 -8 158 Q 34 152 34 193 Q 34 220 17 233 L 19 248 Q 73 264 81 343 L 101 720 H -90 L -71 330 Q -67 263 -20 249 L -19 230 Q -34 220 -33 206 Z", fill: P.mid });
    const hat = i === 0
      ? svg("path", { d: "M -73 169 Q -38 159 -29 156 L -4 79 Q 12 111 26 153 Q 56 156 75 170 Q 15 191 -73 169 Z", fill: P.mid })
      : svg("path", { d: "M -29 175 Q -58 142 -44 126 Q -37 148 -13 160 L 16 159 Q 41 147 46 126 Q 58 147 31 178 Z", fill: P.mid });
    return svg("g", { class: "train-costume", transform: `translate(${i ? 1790 : 940} 0)` }, [head, hat]);
  });
}

/** 車内の絵（横幅 SPAN）。揺れの更新に使う部品も返す */
function carriage(P, id, passengers, available) {
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
    ...["L", "R"].map((side) => svg("linearGradient", { id: `${id}-edge${side}`, x1: side === "L" ? 0 : 1, y1: 0, x2: side === "L" ? 1 : 0, y2: 0 }, [
      svg("stop", { offset: 0, "stop-color": P.bg, "stop-opacity": 1 }),
      svg("stop", { offset: 0.45, "stop-color": P.bg, "stop-opacity": 0.85 }),
      svg("stop", { offset: 1, "stop-color": P.bg, "stop-opacity": 0 }),
    ])),
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
  const back = crowdRow(`${id}-back`, front * 0.78, [[1, true], [2, false], [0, true], [1, false]], -260, available);
  const near = crowdRow(`${id}-front`, front, [[0, false], [1, false], [2, false]], 0, available);
  const panels = [...back, ...near];
  body.push(...back.map((p) => p.g));
  if (passengers.halloween) body.push(...costumePassengers(P));
  if (passengers.cameo) {
    const portrait = PRIVATE_PASSENGERS[passengers.cameo];
    const [left, top, width, height] = portrait.bounds;
    const scale = 740 / height;
    const silhouette = svg("filter", { id: `${id}-guest`, "color-interpolation-filters": "sRGB" }, [
      svg("feFlood", { "flood-color": P.back }),
      svg("feComposite", { in2: "SourceAlpha", operator: "in" }),
    ]);
    body.push(svg("defs", {}, [silhouette]));
    // 群衆と同じ頭の高さ・同じ揺れ。顔を描かず、髪型や持ち物の輪郭でさりげなく見せる。
    const guest = svg("g", { filter: `url(#${id}-guest)`, class: "train-guest" }, [svg("image", {
      href: passengerUrl(passengers.cameo), x: 1660 - (left + width / 2) * scale, y: 145 - top * scale,
      width: 896 * scale, height: 1200 * scale,
    })]);
    body.push(guest);
    panels.push({ bob: guest });
  }
  body.push(...near.map((p) => p.g));
  // 足元へ向かって暗く
  body.push(svg("rect", { x: 0, y: 0, width: SPAN, height: H + 80, fill: `url(#${id}-fade)` }));
  // 先頭と最後尾: 人の切れ目を見せないよう暗がりへ溶かし、斜めの切り口に光の線を2本
  body.push(svg("rect", { x: -40, y: -60, width: FEATHER + 40, height: H + 140, fill: `url(#${id}-edgeL)` }));
  body.push(svg("rect", { x: SPAN - FEATHER, y: -60, width: FEATHER + 40, height: H + 140, fill: `url(#${id}-edgeR)` }));
  for (const [x0, w, o] of [[0, 7, 0.75], [26, 3, 0.4]]) {
    body.push(svg("line", { x1: SLANT + x0, y1: -60, x2: x0, y2: H + 80, stroke: P.rim, "stroke-width": w, opacity: o }));
    body.push(svg("line", { x1: SPAN - x0, y1: -60, x2: SPAN - SLANT - x0, y2: H + 80, stroke: P.rim, "stroke-width": w, opacity: o }));
  }
  const people = panels.map((p, i) => ({ bob: p.bob, phase: i * 1.7, amp: 2 + (i % 3) }));
  return { g: svg("g", { "clip-path": `url(#${id}-car)` }, body), straps, people, lights };
}

let serial = 0;
/** ガタン（継ぎ目）の小さな縦の跳ね: t 秒のあと短く沈んで戻る */
const JOLTS = [0.15, 0.27, 1.05, 1.17];
const jolt = (t) => JOLTS.reduce((y, j) => (t > j && t < j + 0.3 ? y + 2 * Math.sin(((t - j) / 0.3) * Math.PI) * (1 - (t - j) / 0.3) : y), 0);

/** tone を渡す旧呼出も紫に統一。halloween/cameo は演出確認にも使える。 */
export async function a(mid, opts = {}) {
  const owner = state;
  const P = MONO_TRAIN;
  const passengers = trainPassengers(state, opts);
  const urls = [...CROWD, ...(passengers.cameo ? [passengerUrl(passengers.cameo)] : [])];
  const decoded = new Set();
  let timeout;
  try {
    await Promise.race([
      Promise.all(urls.map(async url => { if (await ready(url)) decoded.add(url); })),
      new Promise(r => { timeout = setTimeout(r, 800); }),
    ]);
  } finally { clearTimeout(timeout); }
  if (state !== owner) return; // 素材待ち中にLOADした旧セーブの演出を始めない。
  const available = new Set(decoded); // 遅れて読めた絵が乗車中に急に現れないよう、ここで確定する。
  if (passengers.cameo && !available.has(passengerUrl(passengers.cameo))) passengers.cameo = null;
  await stagePlay("train", async (node) => {
    node.style.opacity = "0";
    const car = carriage(P, `mo-train-${++serial}`, passengers, available);
    const pan = svg("g", {}, [car.g]);
    const rock = svg("g", {}, [pan]);
    const art = stageSvg([rock]);
    art.setAttribute("preserveAspectRatio", "xMidYMid slice");
    node.append(backdrop(P.bg), art);
    const t0 = performance.now();
    let frameId = 0;
    const frame = () => {
      const elapsed = performance.now() - t0, t = elapsed / 1000;
      const sway = 0.16 * Math.sin((t / 1.2) * Math.PI * 2);
      rock.setAttribute("transform", `translate(0 ${jolt(t).toFixed(2)}) rotate(${sway.toFixed(3)} ${W / 2} ${H + 220})`);
      // 切り口は画面外のまま。車内の緩い横流れだけを見せる。
      pan.setAttribute("transform", `translate(${(-540 - 260 * Math.min(1, elapsed / TOTAL)).toFixed(1)} 0)`);
      for (const [i, st] of car.straps.entries()) {
        const angle = -sway * 4 + 2.5 * Math.sin((t / 1.2) * Math.PI * 2 - 1.1 + i * 0.35);
        st.g.setAttribute("transform", `rotate(${angle.toFixed(2)} ${st.x} ${RAIL_Y})`);
      }
      for (const p of car.people) p.bob.setAttribute("transform", `translate(0 ${(p.amp * 0.5 * Math.sin(t * 7.5 + p.phase) + jolt(t - 0.04) * 0.4).toFixed(2)})`);
      car.lights.setAttribute("transform", `translate(${(-((t * 1100) % 820)).toFixed(1)} 0)`);
      frameId = requestAnimationFrame(frame);
    };
    frame();
    try {
      SE.train?.(TOTAL / 1000);
      await move(node, [{ opacity: 0 }, { opacity: 1 }], FADE_IN, { easing: "ease-out" });
      // mid は完全に覆ってから一度だけ。遅延・失敗時も幕と入力抑止はstagePlayが片付ける。
      try {
        await Promise.all([new Promise(r => setTimeout(r, RIDE)), Promise.resolve().then(() => mid?.())]);
      } finally {
        await move(node, [{ opacity: 1 }, { opacity: 0 }], FADE_OUT, { easing: "ease-in-out" });
      }
    } finally {
      cancelAnimationFrame(frameId);
    }
  }, { cover: true });
}

export const b = a;
