// 章の要所の一度きりのモーショングラフィックス（#2688 A3・A5・A6・A8）。顔は描かない。
// 回想（A3）と混ざる煙（A8）は作り直した（TMG60）: 紫の図形をやめ、場面の絵と煙の絵（smoke/）で作る。
// どれも見せるだけで、保存・進行・票には触れない。動きを減らす設定・テストの高速送りでは何もしない（mid() だけ行う）。
import { el, sleep, nextFrame } from "../core/util.js";
import { W, H, COLOR, EASE, svg, stageSvg, move, reducedMotion } from "../core/transition-kit.js";
import { holdCover, bgSnapshot, smokeArt, smokeOut } from "../core/transitions.js";

const fx = () => document.getElementById("fx");
const skip = () => reducedMotion() || !!(window.__remake?.vnTest?.turbo || window.__remake?.craftTest?.auto);
const layer = (cls, data) => el(`div.mo-moment.${cls}`, { "aria-hidden": "true", dataset: { moment: data } });

/** 覆う型の共通部分: 入力を止め、片付けを必ず行う */
async function covering(node, body) {
  const host = fx();
  if (!host) return body(null);
  const unhold = holdCover();
  host.append(node);
  try { return await body(node); } finally { node.remove(); unhold(); }
}

// ---------------------------------------------------------------- A3 回想 → 現在（第3章の公園の回想。作り直し TMG60）

/** 煙のにじみの境目について昇る煙（smokeCurtain の haze と同じ動き） */
function hazeRise(node, ms) {
  const haze = el("i.mo-haze", { style: { backgroundImage: `url("${smokeArt().haze}")` } });
  node.append(haze);
  haze.animate([{ top: "125%", opacity: 0 }, { top: "23%", opacity: 0.6, offset: 0.5 }, { top: "-75%", opacity: 0 }], { duration: ms, easing: "cubic-bezier(.45,0,.55,1)", fill: "forwards" });
}

/**
 * 回想（セピアのCG。読み終えると画面は暗い）から現在へ。暗いまま裏で現在の場面へ替え、その場面が回想と同じセピアで浮かび、
 * 煙のにじみで下から本当の色が戻る（約2.3秒。見本1の仕組み）。紫の葉の形の面はやめた。
 * mid() は暗い間に背景を替える。名前は呼び出し元に合わせて leafWave のまま。
 */
export async function leafWave(mid) {
  if (skip() || !fx()) { await mid?.(); return; }
  const node = layer("mo-recall", "recall");
  await covering(node, async () => {
    const veil = el("div.mo-recall-veil");
    node.append(veil);
    await move(veil, [{ opacity: 0 }, { opacity: 1 }], 360, { easing: "ease" });
    await mid?.();
    await nextFrame(); await nextFrame();
    const now = bgSnapshot();
    if (!now) { await move(veil, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: "ease" }); return; }
    // 1. 現在の場面が、回想と同じセピア（#vn.sepia と同じ色）で浮かぶ
    now.className = "mo-recall-past";
    const base = now.style.filter && now.style.filter !== "none" ? `${now.style.filter} ` : "";
    now.style.filter = `${base}sepia(.75) contrast(.95) brightness(.92)`;
    node.append(now);
    await move(now, [{ opacity: 0 }, { opacity: 1 }], 520, { easing: "ease-out" });
    veil.remove();
    await sleep(180);
    // 2. 煙のにじみで下から本当の色が戻る
    hazeRise(node, 1350);
    await smokeOut(now, 1350);
  });
}

// ---------------------------------------------------------------- A5 龍の煙（第4章の前夜祭）

/** 煙のリボンがS字に二度うねって輪になり、金の縁で一瞬止まってから散る（約1.8秒）。鱗や顔は描かない */
export async function dragonSmoke() {
  if (skip() || !fx()) return;
  const node = layer("mo-dragon", "dragon");
  const d = "M 120 600 C 300 380, 480 640, 640 420 S 980 200, 1080 360 C 1180 520, 920 600, 840 470 C 780 370, 900 300, 980 340";
  const blur = svg("path", { d, fill: "none", stroke: "#f4eefc", "stroke-width": 44, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, filter: "url(#mo-dragon-blur)", opacity: 0.75 });
  const core = svg("path", { d, fill: "none", stroke: "#ffffff", "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, opacity: 0.9 });
  const gold = svg("path", { d, fill: "none", stroke: "#f6dcaf", "stroke-width": 3, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, opacity: 0 });
  const art = stageSvg([
    svg("defs", {}, [svg("filter", { id: "mo-dragon-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" }, [svg("feGaussianBlur", { stdDeviation: 10 })])]),
    blur, core, gold,
  ]);
  node.append(el("div.mo-dragon-dim"), art);
  await covering(node, async () => {
    const draw = [{ strokeDashoffset: 2600 }, { strokeDashoffset: 0 }];
    move(blur, draw, 1000, { easing: EASE.inOut });
    await move(core, draw, 1000, { easing: EASE.inOut });
    gold.style.strokeDashoffset = "0";
    await move(gold, [{ opacity: 0 }, { opacity: 1 }, { opacity: 0 }], 420);
    await Promise.all([blur, core].map((p) => move(p, [{ opacity: Number(p.getAttribute("opacity")), strokeWidth: p === blur ? 44 : 8 }, { opacity: 0, strokeWidth: p === blur ? 110 : 2 }], 520, { easing: "ease-out" })));
  });
}

// ---------------------------------------------------------------- A6 走査（第1章の優勝の夜の「???」・第5章の挑戦状と9000）

/** 横線のノイズとずれが短く走り、見出し from が to に置き換わる（約0.6秒）。from を空にすると to だけが乱れて出る */
export async function scanGlitch({ from = "", to = "???" } = {}) {
  if (skip() || !fx()) return;
  const node = layer("mo-scan", "scan");
  const slices = [];
  for (let i = 0; i < 9; i++) {
    const top = (i * 11 + 3) % 92, height = 2 + (i * 7) % 8;
    const slice = el("i.mo-scan-slice", { style: { top: `${top}%`, height: `${height}%` } });
    slices.push(slice);
  }
  const bar = el("i.mo-scan-bar");
  const label = el("div.mo-scan-label", { text: from || to });
  node.append(...slices, el("div.mo-scan-lines"), bar, label);
  await covering(node, async () => {
    slices.forEach((s, i) => move(s, [{ transform: "translateX(0)" }, { transform: `translateX(${(i % 2 ? 1 : -1) * (3 + i % 4)}%)` }, { transform: "translateX(0)" }], 360, { easing: "steps(4)" }));
    move(bar, [{ top: "-10%" }, { top: "100%" }], 380, { easing: "linear" });
    move(label, [{ transform: "translate(-50%, -50%)", filter: "none" }, { transform: "translate(-51.5%, -50%)", filter: "drop-shadow(4px 0 0 #f06aae) drop-shadow(-4px 0 0 #9fd8ff)" }, { transform: "translate(-50%, -50%)", filter: "none" }], 360, { easing: "steps(4)" });
    await sleep(190);
    label.textContent = to;
    await sleep(380);
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 220);
  });
}

// ---------------------------------------------------------------- A8 混ざる煙（第5章のフィナーレ → スタッフロール。作り直し TMG60）

/**
 * 出会った人の色をした煙（煙の絵を色で塗ったもの）が下から立ちのぼり、真ん中へ寄りながら重なって色が混ざり、
 * 混ざった白い煙が上へ抜ける（約3秒。細い線の図形はやめた）。暗い面のまま終わる（スタッフロールへ渡す）。
 */
export async function mixedSmoke(colors = []) {
  if (skip() || !fx()) return;
  const list = (colors.length ? colors : [COLOR.lav, COLOR.pink, "#f6dcaf", "#9fb8ff"]).slice(0, 8);
  const node = layer("mo-mixed", "finale");
  // 煙の絵は横長の帯で、左右の端が切れている。縦に立てるので、帯の両端を溶かすグラデーションを重ねる
  const haze = `url("${smokeArt().haze}"), linear-gradient(to right, transparent, #000 28%, #000 72%, transparent)`;
  const n = list.length;
  const plume = (color, cls = "") => el(`i.mo-mixed-plume${cls}`, { style: { backgroundColor: color, maskImage: haze, webkitMaskImage: haze, maskComposite: "intersect", webkitMaskComposite: "source-in" } });
  const plumes = list.map((c, i) => ({ el: plume(c), x0: 200 + (880 / Math.max(1, n - 1)) * (n === 1 ? 0.5 : i), i }));
  const one = plume("#f7f2ff", ".one");
  const dark = el("div.mo-mixed-dark");
  node.append(dark, ...plumes.map((p) => p.el), one);
  await covering(node, async () => {
    await move(dark, [{ opacity: 0 }, { opacity: 1 }], 500, { easing: "ease-in" });
    // 1. それぞれの色の煙が下から昇り、真ん中へ寄って重なる（重なった所は色が足されて明るく混ざる）
    const RISE = 1900;
    const runs = plumes.map(({ el: p, x0, i }) => {
      const x1 = 640 + (x0 - 640) * 0.12, tilt = (x0 < 640 ? 1 : -1) * 8;
      return move(p, [
        { opacity: 0, transform: `translate(${x0 - 640}px, 300px) rotate(-90deg) scale(.55, .7)` },
        { opacity: 0.95, offset: 0.35, transform: `translate(${(x0 + (x1 - x0) * 0.35) - 640}px, 120px) rotate(${-90 + tilt * 0.5}deg) scale(.8, .9)` },
        { opacity: 0.8, transform: `translate(${x1 - 640}px, -140px) rotate(${-90 + tilt}deg) scale(1.25, 1.2)` },
      ], RISE, { easing: "cubic-bezier(.3,.1,.3,1)", delay: i * 80 });
    });
    // 2. 混ざった白い煙が真ん中から上へ抜ける
    const merged = move(one, [
      { opacity: 0, transform: "translate(0, 60px) rotate(-90deg) scale(.7, .9)" },
      { opacity: 0.9, offset: 0.45, transform: "translate(0, -60px) rotate(-90deg) scale(1.1, 1.2)" },
      { opacity: 0, transform: "translate(0, -380px) rotate(-90deg) scale(1.6, 1.5)" },
    ], 1500, { easing: "ease-out", delay: RISE - 700 });
    await Promise.all(runs);
    plumes.forEach(({ el: p }) => move(p, [{ opacity: 0.8 }, { opacity: 0 }], 600, { easing: "ease-in" }));
    await merged;
  });
}
