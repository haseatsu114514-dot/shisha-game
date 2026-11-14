// 紫の車内へ短くフェードし、乗車中だけゆっくり流す。背景の交換は不透明な車内の下で行う。
import { SE } from "../core/audio.js";
import { state } from "../core/state.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { sleep, nextFrame } from "../core/util.js";
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
const ready = (url) => { const img = new Image(); img.src = url; return img.decode().then(() => img, () => null); };

/* ---- 焼き込み（#3653） ----------------------------------------------------
 * SVGフィルターとマスクは、揺れで毎フレーム再計算されて実プレイで重かった。
 * 同じ計算結果を canvas へ一度だけ焼いて画像として置くと、合成だけで済む。
 * 焼いた絵は色の組み合わせごとにキャッシュして使い回す。 */
const bakeCache = new Map();
const hexRgb = (c) => [0, 1, 2].map((i) => parseInt(c.slice(1 + i * 2, 3 + i * 2), 16));
function bakeCanvas(key, w, h, paint) {
  if (!bakeCache.has(key)) {
    bakeCache.set(key, (async () => {
      const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
      paint(cv.getContext("2d"), w, h);
      const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
      return blob ? URL.createObjectURL(blob) : cv.toDataURL();
    })());
  }
  return bakeCache.get(key);
}

/** 旧 tint フィルター（feComponentTransfer の table: 暗→ink、中→tone、明→light）と等価な階調を焼く */
function tintUrl(img, ink, tone, light, scale) {
  const stops = [ink, tone, light].map(hexRgb);
  const lut = [0, 1, 2].map((ch) => {
    const t = new Uint8Array(256);
    for (let v = 0; v < 256; v++) t[v] = v < 128 ? stops[0][ch] + (stops[1][ch] - stops[0][ch]) * (v / 127.5) : stops[1][ch] + (stops[2][ch] - stops[1][ch]) * ((v - 127.5) / 127.5);
    return t;
  });
  return bakeCanvas(`tint|${img.src}|${ink}|${tone}|${light}|${scale}`, Math.round(img.naturalWidth * scale), Math.round(img.naturalHeight * scale), (ctx, w, h) => {
    ctx.drawImage(img, 0, 0, w, h);
    const im = ctx.getImageData(0, 0, w, h), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[0][d[i]]; d[i + 1] = lut[1][d[i + 1]]; d[i + 2] = lut[2][d[i + 2]]; }
    ctx.putImageData(im, 0, 0);
  });
}

/** 旧 guest フィルター（feFlood を SourceAlpha で抜く）と等価な単色シルエットを焼く */
function silhouetteUrl(img, color) {
  return bakeCanvas(`sil|${img.src}|${color}`, img.naturalWidth, img.naturalHeight, (ctx, w, h) => {
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = "source-in";
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
  });
}

/** 1回の乗車で使う焼き絵（手前列・奥列の階調と、仮装客の影）をそろえる */
async function bakeFor(P, passengers, available, images) {
  const front = new Map(), back = new Map();
  await Promise.all([...available].map(async (url) => {
    if (!CROWD.includes(url) || !images.has(url)) return;
    const img = images.get(url);
    front.set(url, await tintUrl(img, P.ink, P.front, P.rim, 0.75));
    back.set(url, await tintUrl(img, P.bg, P.back, P.mid, 0.67));
  }));
  let guest = null;
  if (passengers.cameo && images.has(passengerUrl(passengers.cameo))) {
    guest = await silhouetteUrl(images.get(passengerUrl(passengers.cameo)), P.back);
  }
  return { front, back, guest };
}

/** 乗客の絵を横に並べた1列。baked: 焼き絵（元のURL→焼きURL）。scale: 大きさ、order: 使う絵と左右反転、x0: 左端 */
function crowdRow(baked, scale, order, x0, available, overlap = 30) {
  const w = CW * scale, h = CH * scale;
  const panels = order.map(([i, flip], n) => {
    if (!available.has(CROWD[i])) return null;
    const x = x0 + n * (w - overlap);
    const img = svg("image", { href: baked.get(CROWD[i]) ?? CROWD[i], x: 0, y: 0, width: w, height: h, preserveAspectRatio: "none" });
    if (flip) img.setAttribute("transform", `translate(${w} 0) scale(-1 1)`);
    const bob = svg("g", {}, [img]);
    return { g: svg("g", { transform: `translate(${x.toFixed(1)} ${TOP})` }, [bob]), bob };
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

/** 車内の絵（横幅 SPAN）。揺れの更新に使う部品も返す。look.glow: 窓の光の濃さ、baked: bakeFor の焼き絵 */
function carriage(P, id, passengers, available, look = {}, baked = { front: new Map(), back: new Map(), guest: null }) {
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
    ...["L", "R"].map((side) => svg("linearGradient", { id: `${id}-edge${side}`, x1: side === "L" ? 0 : 1, y1: 0, x2: side === "L" ? 1 : 0, y2: 0 }, [
      svg("stop", { offset: 0, "stop-color": P.bg, "stop-opacity": 1 }),
      svg("stop", { offset: 0.45, "stop-color": P.bg, "stop-opacity": 0.85 }),
      svg("stop", { offset: 1, "stop-color": P.bg, "stop-opacity": 0 }),
    ])),
  ]));
  body.push(svg("polygon", { points: edge, fill: P.bg, class: "train-car" }));
  for (const w of wins) { w.setAttribute("fill", P.win); w.setAttribute("stroke", P.ink); w.setAttribute("stroke-width", 8); body.push(w); }
  const lights = svg("g", { "clip-path": `url(#${id}-win)` }, [0, 1, 2, 3, 4, 5].map((i) => svg("polygon", {
    points: `${i * 820},120 ${i * 820 + 160},120 ${i * 820 + 100},370 ${i * 820 - 60},370`, fill: P.glow, opacity: look.glow ?? 0.22,
  })));
  body.push(lights);
  // 天井の板（作り直しの型だけ。a は車内の暗がりのまま）
  if (P.ceil) body.push(svg("rect", { x: 0, y: -60, width: SPAN, height: RAIL_Y + 50, fill: P.ceil }), svg("rect", { x: 0, y: RAIL_Y - 14, width: SPAN, height: 4, fill: P.ink, opacity: 0.35 }));
  // 網棚の棒と、空いている吊り革（奥の人の後ろで揺れる）
  body.push(svg("rect", { x: 0, y: RAIL_Y - 10, width: SPAN, height: 12, fill: P.rail, stroke: P.ink, "stroke-width": 3 }));
  const straps = [];
  for (let x = 90; x < SPAN; x += 150) straps.push(strap(P, x));
  for (const st of straps) body.push(st.g);
  // 奥の列（小さく暗く）→ 手前の列。絵の組み合わせと反転を変えて、同じ人が並ばないようにする
  const back = crowdRow(baked.back, front * 0.78, [[1, true], [2, false], [0, true], [1, false]], -260, available);
  const near = crowdRow(baked.front, front, [[0, false], [1, false], [2, false]], 0, available);
  const panels = [...back, ...near];
  body.push(...back.map((p) => p.g));
  if (passengers.halloween) body.push(...costumePassengers(P));
  if (passengers.cameo) {
    const portrait = PRIVATE_PASSENGERS[passengers.cameo];
    const [left, top, width, height] = portrait.bounds;
    const scale = 740 / height;
    // 群衆と同じ頭の高さ・同じ揺れ。顔を描かず、髪型や持ち物の輪郭でさりげなく見せる。
    const guest = svg("g", { class: "train-guest" }, [svg("image", {
      href: baked.guest ?? passengerUrl(passengers.cameo), x: 1660 - (left + width / 2) * scale, y: 145 - top * scale,
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
  const { decoded, images } = await decodeAll(urls);
  if (state !== owner) return; // 素材待ち中にLOADした旧セーブの演出を始めない。
  const available = new Set(decoded); // 遅れて読めた絵が乗車中に急に現れないよう、ここで確定する。
  if (passengers.cameo && !available.has(passengerUrl(passengers.cameo))) passengers.cameo = null;
  const baked = await bakeFor(P, passengers, available, images);
  await stagePlay("train", async (node) => {
    node.style.opacity = "0";
    const car = carriage(P, `mo-train-${++serial}`, passengers, available, {}, baked);
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
      // move は描画が遅いと時間切れで先に進むので、覆い切ってから場面を替える（CI で 0.986 のまま mid に入っていた）
      node.getAnimations().forEach((animation) => animation.finish());
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

// ---------------------------------------------------------------- c: 作り直し（TMG54・見本 remake/previews/motion-direction/ の「電車」）
// 紫1色の面へフェードで入って抜けるのをやめる。車両が右から滑り込んで画面を覆い、乗っている間はゆっくり流れ、
// 着いたら左へ走り去って行き先の絵が出る。人混みの絵は活かし、昼は窓からの日差し、夜は車内灯の色で塗る。

/** 時間帯ごとの色（キーは MONO_TRAIN と同じ。light は日差し・車内灯の色） */
const TONE = {
  day: { ceil: "#b8bdc4", bg: "#3f444d", win: "#dcefff", glow: "#ffffff", back: "#767b84", mid: "#b2b3b2", front: "#8f9095", hair: "#262a33", ink: "#262a35", rim: "#fff4e2", rail: "#b9bcc0", light: "#ffe0a6" },
  night: { ceil: "#262e3c", bg: "#141a25", win: "#0f192e", glow: "#ffc77e", back: "#38435a", mid: "#6a7991", front: "#6b7a92", hair: "#121722", ink: "#0a0d14", rim: "#eef4ff", rail: "#8f99a8", light: "#e6efff" },
};
const C_IN = 460, C_RIDE = 900, C_OUT = 560; // 滑り込む・乗っている（最短）・走り去る
const X0 = W + 80; // 右の画面外（先頭の切り口が見えない）
const X1 = -SLANT - 330; // 滑り込み終えた位置（左上の角まで覆う）
const DRIFT = 1000, VD = 0.62; // 乗っている間の流れ（最初 VD px/ms で、DRIFT 進んだ所で止まる。最後尾の切り口を画面に入れない）
const XEND = -SPAN - 160; // 左の画面外（最後尾の切り口と影まで抜ける）
const BEAM = 760; // 日差しの帯の間隔

/** 3次エルミート補間（滑り込みの終わりの速さを、乗っている間の流れの速さにそろえる） */
function hermite(u, p0, p1, m0, m1) {
  const u2 = u * u, u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1;
}

/** 昼の日差しの1周期タイル（#3653）: 帯のグラデーション×縦フェード×斜めのずれは画素ごとに
 * 決まるので、旧マスク＋グラデーションと等価な不透明度を canvas へ焼く。
 * α = 帯の濃さ（位相は下へ行くほど左へずらす）× 縦フェード。帯は y<100 には無い（旧 flow の範囲）。 */
const SUN_TILE_H = H + 140; // 旧マスクの縦幅（y: -60 〜 H+80）
function sunTileUrl(light) {
  const [r, g, b] = hexRgb(light);
  return bakeCanvas(`sun|${light}`, BEAM, SUN_TILE_H, (ctx, w, h) => {
    const im = ctx.createImageData(w, h), d = im.data;
    const prof = (o) => (o < 0.1 || o > 0.44 ? 0 : o < 0.27 ? 0.42 * ((o - 0.1) / 0.17) : 0.42 * (1 - (o - 0.27) / 0.17));
    for (let j = 0; j < h; j++) {
      const y = j - 60;
      const fy = j / h;
      const fade = fy <= 0.16 ? 1 : fy >= 0.95 ? 0 : 1 - (fy - 0.16) / 0.79;
      if (!fade || y < 100) continue;
      for (let x = 0; x < w; x++) {
        const o = ((((x + (180 / 690) * y) % BEAM) + BEAM) % BEAM) / BEAM;
        const a = prof(o) * fade;
        if (!a) continue;
        const i = (j * w + x) * 4;
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(im, 0, 0);
  });
}

/** 昼: 窓から差す斜めの日差し。焼いたタイルを pattern で繰り返して外の景色の速さで流す
 * （旧実装の全面マスク＋screen は毎フレーム再計算されて重かった・#3653） */
function daylight(P, id, sunUrl) {
  const defs = svg("defs", {}, [
    svg("pattern", { id: `${id}-sunpat`, patternUnits: "userSpaceOnUse", x: 0, y: -60, width: BEAM, height: SUN_TILE_H }, [
      svg("image", { href: sunUrl, x: 0, y: -60, width: BEAM, height: SUN_TILE_H }),
    ]),
  ]);
  const flow = svg("rect", { x: -BEAM, y: -60, width: SPAN + BEAM * 2, height: SUN_TILE_H, fill: `url(#${id}-sunpat)` });
  return { g: svg("g", { "clip-path": `url(#${id}-car)` }, [defs, svg("g", { style: "mix-blend-mode: screen" }, [flow])]), flow };
}

/** 夜: 天井の車内灯の帯と、その下へ落ちる白い光（流れない） */
function cabinLight(P, id) {
  const grad = svg("linearGradient", { id: `${id}-lamp`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
    svg("stop", { offset: 0, "stop-color": P.light, "stop-opacity": 0.3 }),
    svg("stop", { offset: 1, "stop-color": P.light, "stop-opacity": 0 }),
  ]);
  return { g: svg("g", { "clip-path": `url(#${id}-car)` }, [
    svg("defs", {}, [grad]),
    svg("rect", { x: 0, y: -60, width: SPAN, height: 460, fill: `url(#${id}-lamp)`, style: "mix-blend-mode: screen" }),
    svg("rect", { x: 0, y: 10, width: SPAN, height: 13, rx: 6, fill: P.light, opacity: 0.92 }),
  ]), flow: null };
}

/** 車両の前後の切り口の外に落ちる影（前の場面・行き先の絵の上に車両の厚みを出す） */
function edgeShadows(id) {
  const shade = (side) => svg("linearGradient", { id: `${id}-shade${side}`, x1: side === "L" ? 1 : 0, y1: 0, x2: side === "L" ? 0 : 1, y2: 0 }, [
    svg("stop", { offset: 0, "stop-color": "#000", "stop-opacity": 0.38 }),
    svg("stop", { offset: 1, "stop-color": "#000", "stop-opacity": 0 }),
  ]);
  return [
    svg("defs", {}, [shade("L"), shade("R")]),
    svg("polygon", { points: `${SLANT - 150},-60 ${SLANT},-60 0,${H + 80} -150,${H + 80}`, fill: `url(#${id}-shadeL)` }),
    svg("polygon", { points: `${SPAN},-60 ${SPAN + 150},-60 ${SPAN - SLANT + 150},${H + 80} ${SPAN - SLANT},${H + 80}`, fill: `url(#${id}-shadeR)` }),
  ];
}

/** 素材を最大800msだけ待って読み、読めた絵（URL→Image）を返す */
async function decodeAll(urls) {
  const decoded = new Set(), images = new Map();
  let timeout;
  try {
    await Promise.race([
      Promise.all(urls.map(async (url) => { const img = await ready(url); if (img) { decoded.add(url); images.set(url, img); } })),
      new Promise((r) => { timeout = setTimeout(r, 800); }),
    ]);
  } finally { clearTimeout(timeout); }
  return { decoded, images };
}

/** 乗客の絵を読んでから乗客を決める。素材待ちの間にLOADされたら null（旧セーブの演出を始めない） */
async function prepare(opts) {
  const owner = state;
  const passengers = trainPassengers(state, opts);
  const urls = [...CROWD, ...(passengers.cameo ? [passengerUrl(passengers.cameo)] : [])];
  const { decoded, images } = await decodeAll(urls);
  if (state !== owner) return null;
  const available = new Set(decoded); // 遅れて読めた絵が乗車中に急に現れないよう、ここで確定する。
  if (passengers.cameo && !available.has(passengerUrl(passengers.cameo))) passengers.cameo = null;
  return { passengers, available, images };
}

/** opts.tone: "day" | "night"（省略で今の時間帯）。halloween/cameo は a と同じ */
export async function c(mid, opts = {}) {
  const prep = await prepare(opts);
  if (!prep) return;
  const tone = opts.tone === "day" || opts.tone === "night" ? opts.tone : state?.slot ? "night" : "day";
  const P = TONE[tone];
  const baked = await bakeFor(P, prep.passengers, prep.available, prep.images);
  const sun = tone === "day" ? await sunTileUrl(P.light) : null;
  await stagePlay("train", async (node) => {
    node.dataset.tone = tone;
    const id = `mo-train-${++serial}`;
    const car = carriage(P, id, prep.passengers, prep.available, { glow: tone === "day" ? 0.5 : 0.42 }, baked);
    const light = tone === "day" ? daylight(P, id, sun) : cabinLight(P, id);
    const pan = svg("g", {}, [...edgeShadows(id), car.g, light.g]);
    const rock = svg("g", {}, [pan]);
    const art = stageSvg([rock]);
    art.setAttribute("preserveAspectRatio", "xMidYMid slice");
    node.append(art);
    // 位置は時刻から決める（描画が遅れても、覆い終える時刻と走り去る時刻はずれない）
    const t0 = performance.now();
    let phase = "in", tRide = 0, tOut = 0, pE = 0, vE = 0, acc = 0;
    const xAt = (now) => {
      if (phase === "in") return hermite(Math.min(1, (now - t0) / C_IN), X0, X1, -(X0 - X1) * 2.6, -VD * C_IN);
      if (phase === "ride") return X1 - DRIFT * (1 - Math.exp(-((now - tRide) * VD) / DRIFT));
      const s = Math.min(C_OUT, now - tOut);
      return pE + vE * s - 0.5 * acc * s * s;
    };
    const render = (now = performance.now()) => {
      const t = (now - t0) / 1000;
      const sway = 0.16 * Math.sin((t / 1.2) * Math.PI * 2);
      rock.setAttribute("transform", `translate(0 ${jolt(t).toFixed(2)}) rotate(${sway.toFixed(3)} ${W / 2} ${H + 220})`);
      pan.setAttribute("transform", `translate(${xAt(now).toFixed(1)} 0)`);
      for (const [i, st] of car.straps.entries()) {
        const angle = -sway * 4 + 2.5 * Math.sin((t / 1.2) * Math.PI * 2 - 1.1 + i * 0.35);
        st.g.setAttribute("transform", `rotate(${angle.toFixed(2)} ${st.x} ${RAIL_Y})`);
      }
      for (const p of car.people) p.bob.setAttribute("transform", `translate(0 ${(p.amp * 0.5 * Math.sin(t * 7.5 + p.phase) + jolt(t - 0.04) * 0.4).toFixed(2)})`);
      car.lights.setAttribute("transform", `translate(${(-((t * 1100) % 820)).toFixed(1)} 0)`);
      light.flow?.setAttribute("transform", `translate(${(-((t * 520) % BEAM)).toFixed(1)} 0)`);
    };
    let frameId = 0;
    const frame = () => { render(); frameId = requestAnimationFrame(frame); };
    frame();
    try {
      SE.train?.((C_IN + C_RIDE + C_OUT) / 1000);
      await sleep(C_IN);
      // 覆い終えた位置を描いてから場面を替える（描画が遅れて切り口の外が見えたまま mid に入らない）
      phase = "ride"; tRide = performance.now(); render(tRide);
      node.dataset.covered = "1";
      await nextFrame();
      try {
        await Promise.all([sleep(C_RIDE), Promise.resolve().then(() => mid?.())]);
      } finally {
        // 今の位置と速さから、C_OUT で画面の外まで加速して走り去る
        const now = performance.now();
        pE = xAt(now);
        vE = -VD * Math.exp(-((now - tRide) * VD) / DRIFT);
        acc = (2 * (pE + vE * C_OUT - XEND)) / (C_OUT * C_OUT);
        phase = "out"; tOut = now;
        delete node.dataset.covered;
        await sleep(C_OUT + 40);
      }
    } finally {
      cancelAnimationFrame(frameId);
    }
  }, { cover: true });
}

