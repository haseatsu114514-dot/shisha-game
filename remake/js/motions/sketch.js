// DAY12夜のつむぎのスケッチ（ch1.js の sketchScene）。覆っている間に mid() で背景を替える。bgUrl は線画の元の絵。
// a／b の2パターン（?movar=b）。配色は紫1色／場面ごとの色（?mopal=free・core/mg-kit.js の pick）。SKIPと動きを減らす設定は core/scene-motions.js で省く。
import { el, sleep } from "../core/util.js";
import { W, H, svg, stageSvg, move } from "../core/transition-kit.js";
import { MG_EASE as E, pick } from "../core/mg-kit.js";
import { stagePlay } from "./stage.js";

// ---------------------------------------------------------------- a: スケッチ: 紙が置かれ、鉛筆が店を線画で描き、真ん中から色が広がる

const SKETCH = { bg: "#f6f1e7", deep: "#3a3a44", main: "#f2b544", mid: "#e7dfcf", light: "#ffffff" };

let sketchFilterSerial = 0;
/** 背景の絵から輪郭を取り出し、線の色 ink で紙に描いたような線画にするSVGフィルタ */
function sketchFilter(ink) {
  const id = `mo-sketch-${++sketchFilterSerial}`;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(ink.slice(i, i + 2), 16) / 255);
  const defs = stageSvg([svg("defs", {}, [svg("filter", { id, "color-interpolation-filters": "sRGB" }, [
    svg("feColorMatrix", { type: "saturate", values: "0" }),
    svg("feConvolveMatrix", { order: "3", kernelMatrix: "-1 -1 -1 -1 8 -1 -1 -1 -1", preserveAlpha: "true" }),
    svg("feComponentTransfer", {}, ["R", "G", "B"].map((c) => svg(`feFunc${c}`, { type: "linear", slope: "-3.2", intercept: "1" }))),
    svg("feColorMatrix", { type: "matrix", values: `${1 - r} 0 0 0 ${r}  ${1 - g} 0 0 0 ${g}  ${1 - b} 0 0 0 ${b}  0 0 0 1 0` }),
  ])])]);
  defs.classList.add("mo-defs");
  return { defs, id };
}

/** mid() で背景を差し替える。bgUrl はその背景の絵（線画の元） */
export async function a(mid, bgUrl) {
  const P = pick(SKETCH, { bg: "#efe9fb", deep: "#3d2a78", main: "#8f74d1", mid: "#ddd3f3" });
  const img = new Image();
  img.src = bgUrl;
  await img.decode().catch(() => {});
  await stagePlay("sketch", async (node) => {
    const sheet = el("div.mo-sheet");
    const paper = el("div.mo-paper", { style: { backgroundColor: P.bg, "--grid": P.mid } });
    const { defs, id } = sketchFilter(P.deep);
    const lines = el("img.mo-sketch-lines", { src: bgUrl, alt: "", style: { filter: `url(#${id})` } });
    const pencil = el("div.mo-pencil", { style: { "--p": P.main } }, [el("i.mo-pencil-tip"), el("i.mo-pencil-body"), el("i.mo-pencil-end")]);
    const doodles = stageSvg();
    sheet.append(paper, lines);
    node.append(defs, sheet, doodles, pencil);
    lines.style.clipPath = "inset(0 100% 0 0)";
    // 1. 紙が少し傾いて滑り込み、置かれる
    await move(sheet, [{ transform: "translateY(105%) rotate(5deg)" }, { transform: "translateY(0) rotate(0deg)" }], 520, { easing: E.out });
    if (mid) await mid();
    // 2. 鉛筆が左から右へ、上下に走りながら線を描いていく
    const draw = 1300;
    const t0 = performance.now();
    await new Promise((resolve) => {
      const tick = (now) => {
        const k = Math.min(1, (now - t0) / draw);
        const e = 1 - (1 - k) ** 2;
        lines.style.clipPath = `inset(0 ${100 - e * 100}% 0 0)`;
        pencil.style.transform = `translate(${e * W}px, ${H / 2 + Math.sin(k * Math.PI * 9) * 230}px) rotate(-30deg)`;
        if (k < 1) requestAnimationFrame(tick); else resolve();
      };
      requestAnimationFrame(tick);
    });
    move(pencil, [{ opacity: 1, transform: pencil.style.transform }, { opacity: 0, transform: `translate(${W + 60}px, ${H / 2 - 120}px) rotate(-50deg)` }], 260, { easing: E.in });
    // 3. 四隅に小さな落書きの星が描かれる
    [[90, 90], [W - 90, 110], [110, H - 100]].forEach(([x, y], i) => {
      const star = svg("path", { d: `M ${x} ${y - 22} L ${x + 6} ${y - 6} L ${x + 22} ${y} L ${x + 6} ${y + 6} L ${x} ${y + 22} L ${x - 6} ${y + 6} L ${x - 22} ${y} L ${x - 6} ${y - 6} Z`, fill: "none", stroke: P.main, "stroke-width": 4, "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": 1, "stroke-dashoffset": 1 });
      doodles.append(star);
      move(star, [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], 360, { easing: E.out, delay: i * 90 });
    });
    await sleep(520);
    // 4. 真ん中から色が広がる（紙と線画に穴が開いていく）
    move(doodles, [{ opacity: 1 }, { opacity: 0 }], 300);
    await move(sheet, [{ "--mo-hole": "0%", opacity: 1 }, { "--mo-hole": "80%", opacity: 1, offset: 0.85 }, { "--mo-hole": "120%", opacity: 0 }], 900, { easing: E.in });
  }, { cover: true });
}

// ---------------------------------------------------------------- b: （CI109 で作る別パターン。できるまでは a と同じ）

export async function b(mid, bgUrl) {
  return a(mid, bgUrl);
}
