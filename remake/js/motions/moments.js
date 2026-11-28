// 章の要所の一度きりのモーショングラフィックス（#2688 A3・A5・A6・A8、#3965 の第2〜4章の山場）。
// 回想（A3）と混ざる煙（A8）は作り直した（TMG60）: 紫の図形をやめ、場面の絵と煙の絵（smoke/）で作る。
// どれも見せるだけで、保存・進行・票には触れない。動きを減らす設定・テストの高速送りでは何もしない（mid() だけ行う）。
import { el, sleep, nextFrame } from "../core/util.js";
import { W, H, COLOR, EASE, svg, stageSvg, move, reducedMotion } from "../core/transition-kit.js";
import { holdCover, bgSnapshot, smokeArt, smokeOut } from "../core/transitions.js";
import { duckBgm } from "../core/audio.js";
import { mountMotion, frameOf } from "../core/motion-frame.js";

const fx = () => document.getElementById("fx");
const skip = () => reducedMotion() || !!(window.__remake?.vnTest?.turbo || window.__remake?.craftTest?.auto);
const layer = (cls, data) => el(`div.mo-moment.${cls}`, { "aria-hidden": "true", dataset: { moment: data } });

/**
 * 覆う型の共通部分: 入力を止め、片付けを必ず行う。
 * 縦画面を縦持ちで使っている間は縦の舞台（core/motion-frame.js・VPO13）に置く。portrait: false の演出（立ち絵の位置を横の舞台で決めるもの）は、
 * 横の舞台のまま縦の舞台の真ん中に収める。
 */
async function covering(node, body, { portrait = true } = {}) {
  const host = fx();
  if (!host) return body(null);
  const unhold = holdCover();
  const mounted = mountMotion(node, { portrait, host });
  try { return await body(node); } finally { mounted.remove(); unhold(); }
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

const DRAGON_CG = new URL("../../img/cgs/cg_ch4_dragon_smoke.webp", import.meta.url).href;

/** 龍の煙の一枚絵（TMG53・#3413）を読み込む。失敗しても演出は止めない */
function loadDragonCg() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = DRAGON_CG;
  });
}

/**
 * 龍の煙の一枚絵を全画面で見せ、ゆっくり寄りながら煙を重ねて散らす（約3.4秒・TMG53 #3413）。
 * 以前の白い線1本の描画は廃止し、絵そのものが場面を見せる。絵が読めない時は線の演出へ戻す。
 */
export async function dragonSmoke() {
  if (skip() || !fx()) return;
  const cg = await loadDragonCg();
  const node = layer("mo-dragon", "dragon");
  if (!cg) {
    const d = "M 120 600 C 300 380, 480 640, 640 420 S 980 200, 1080 360 C 1180 520, 920 600, 840 470 C 780 370, 900 300, 980 340";
    const blur = svg("path", { d, fill: "none", stroke: "#f4eefc", "stroke-width": 44, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, filter: "url(#mo-dragon-blur)", opacity: 0.75 });
    const core = svg("path", { d, fill: "none", stroke: "#ffffff", "stroke-width": 8, "stroke-linecap": "round", "stroke-dasharray": 2600, "stroke-dashoffset": 2600, opacity: 0.9 });
    const art = stageSvg([
      svg("defs", {}, [svg("filter", { id: "mo-dragon-blur", x: "-20%", y: "-20%", width: "140%", height: "140%" }, [svg("feGaussianBlur", { stdDeviation: 10 })])]),
      blur, core,
    ]);
    node.append(el("div.mo-dragon-dim"), art);
    await covering(node, async () => {
      const draw = [{ strokeDashoffset: 2600 }, { strokeDashoffset: 0 }];
      move(blur, draw, 1000, { easing: EASE.inOut });
      await move(core, draw, 1000, { easing: EASE.inOut });
      await Promise.all([blur, core].map((p) => move(p, [{ opacity: Number(p.getAttribute("opacity")), strokeWidth: p === blur ? 44 : 8 }, { opacity: 0, strokeWidth: p === blur ? 110 : 2 }], 520, { easing: "ease-out" })));
    });
    return;
  }
  cg.className = "mo-dragon-cg";
  cg.alt = "";
  node.append(cg, el("div.mo-dragon-dim"));
  await covering(node, async () => {
    move(cg, [{ opacity: 0, transform: "scale(1)" }, { opacity: 1, transform: "scale(1.015)", offset: 0.18 }, { opacity: 1, transform: "scale(1.07)" }], 2600, { easing: "ease-out", fill: "forwards" });
    await sleep(500);
    hazeRise(node, 2100);
    await sleep(1600);
    await move(cg, [{ opacity: 1 }, { opacity: 0 }], 800, { easing: "ease-in" });
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
    // 縦の舞台では、横に並ぶ煙の間を画面の幅に合わせて詰める（立ちのぼる高さは同じ・VPO13）
    const k = frameOf(node).portrait ? 720 / W : 1;
    const runs = plumes.map(({ el: p, x0, i }) => {
      const x1 = 640 + (x0 - 640) * 0.12, tilt = (x0 < 640 ? 1 : -1) * 8;
      return move(p, [
        { opacity: 0, transform: `translate(${(x0 - 640) * k}px, 300px) rotate(-90deg) scale(.55, .7)` },
        { opacity: 0.95, offset: 0.35, transform: `translate(${((x0 + (x1 - x0) * 0.35) - 640) * k}px, 120px) rotate(${-90 + tilt * 0.5}deg) scale(.8, .9)` },
        { opacity: 0.8, transform: `translate(${(x1 - 640) * k}px, -140px) rotate(${-90 + tilt}deg) scale(1.25, 1.2)` },
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

// ---------------------------------------------------------------- 第2章 味が遠のく（ch2_slump_taste・#3965）

/**
 * 一口ぶんの煙が甘さの色をまとって立ちのぼり、途中で色と輪郭だけが抜ける。煙の濃さは残る（約3秒）。
 * 続く行「煙はちゃんと濃い。なのに、甘さがどこにも来ない。」の直前に置く。背景は覆わず、赤い閃光や失敗の合図は出さない。
 */
export async function tasteFade() {
  if (skip() || !fx()) return;
  const node = layer("mo-taste", "taste");
  // 煙の絵は横長の帯で、左右の端が切れている。帯の両端を溶かすグラデーションを重ねる（mixedSmoke と同じ）
  const haze = `url("${smokeArt().haze}"), linear-gradient(to right, transparent, #000 26%, #000 74%, transparent)`;
  const mask = { maskImage: haze, webkitMaskImage: haze, maskComposite: "intersect", webkitMaskComposite: "source-in" };
  const plains = [], sweets = [];
  const wisp = (cls) => {
    const plain = el("i.mo-taste-plain", { style: mask }), sweet = el("i.mo-taste-sweet", { style: mask });
    plains.push(plain); sweets.push(sweet);
    return el(`div.mo-taste-wisp${cls}`, [plain, sweet]);
  };
  const dim = el("div.mo-taste-dim");
  const puff = el("div.mo-taste-puff", [wisp(".w1"), wisp(".w2"), wisp(".w3")]);
  node.append(dim, puff);
  await covering(node, async () => {
    move(dim, [{ opacity: 0 }, { opacity: 1 }], 500, { easing: "ease-out" });
    // 1. 甘さの色をまとった煙が、下から立ちのぼる
    await move(puff, [
      { opacity: 0, transform: "translateY(170px) scale(.78)" },
      { opacity: 1, transform: "translateY(0) scale(1)" },
    ], 1100, { easing: EASE.out });
    await sleep(240);
    // 2. 色と輪郭だけが抜ける（煙そのものは残る）
    move(puff, [{ transform: "translateY(0) scale(1)" }, { transform: "translateY(-16px) scale(1.05)" }], 2000, { easing: "ease-out" });
    plains.forEach((p) => move(p, [{ filter: "blur(0px)" }, { filter: "blur(7px)" }], 780, { easing: EASE.inOut }));
    await Promise.all(sweets.map((p) => move(p, [{ opacity: 1, filter: "blur(0px)" }, { opacity: 0, filter: "blur(7px)" }], 780, { easing: EASE.inOut })));
    // 3. 一拍。色のない煙だけが残る
    await sleep(640);
    await move(node, [{ opacity: 1 }, { opacity: 0 }], 520, { easing: "ease-in" });
  });
}

// ---------------------------------------------------------------- 第3章 結果発表の前の静けさ（全国大会・#3965）

/** 光を絞る暗い面。--mo-hole（光の輪の大きさ）を動かす。x・y は光の中心（舞台の幅・高さに対する割合） */
function lightIris(x = 0.5, y = 0.4) {
  return el("div.mo-iris", { style: { "--mo-x": String(x), "--mo-y": `${y * 100}%` } });
}
const iris = (hole, dark) => ({ "--mo-hole": `${hole}%`, opacity: dark });

/**
 * 会場の光が外側から絞られて舞台の一点に残り、一拍の静けさのあと暗くなる。その間に mid() が結果の画面を出し、光が開く（約2.3秒）。
 * 順位や点はここでは出さない（結果の画面に任せる）。曲は絞っている間だけ下げ、開く時に戻す。
 */
export async function stageHush(mid) {
  if (skip() || !fx()) { await mid?.(); return; }
  const node = layer("mo-hush", "hush");
  const dark = lightIris(0.5, 0.36);
  node.append(dark);
  try {
    await covering(node, async () => {
      duckBgm(0.35, 500);
      await move(dark, [iris(150, 0), iris(26, 1)], 900, { easing: EASE.inOut });
      await sleep(480);
      await move(dark, [iris(26, 1), iris(0, 1)], 260, { easing: "ease-in" });
      await mid?.();
      await nextFrame(); await nextFrame();
      duckBgm(1, 500);
      await move(dark, [iris(0, 1), iris(170, 0)], 620, { easing: "ease-out" });
    });
  } finally { duckBgm(1, 300); }
}

// ---------------------------------------------------------------- 第4章 四つ目の台に立つ男（ch4_tournament_start・#3965）

/** 演出の間だけ、会話の立ち絵と窓を引っ込める。戻り値で戻す（次の行と一緒に現れる） */
function hideDialogue(ms = 360) {
  const parts = [...document.querySelectorAll("#vn .vn-portraits, #vn .vn-box")];
  const fades = parts.map((part) => part.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: "ease", fill: "forwards" }));
  return () => {
    fades.forEach((fade) => fade.cancel());
    parts.forEach((part) => part.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease" }));
  };
}

/**
 * 歓声が止んだ会場で、光が四つ目の台へ絞られ、そこに立つ男の影が煙のにじみでほどけて本人の姿になる（約3.6秒）。
 * figure は会話と同じ枠取りを済ませた立ち絵（engine.js が作って渡す）。名前はこのあとの司会の台詞が呼ぶので、ここでは出さない。
 * スチル（#3957 の cg_ch4_sheikh_reveal）を入れる時は、この演出の figure をその絵に替えて一体にする。別の静止画を重ねない。
 */
export async function shadowUnveil(figure) {
  if (skip() || !fx() || !figure) return;
  const node = layer("mo-unveil", "unveil");
  const dark = lightIris(0.69, 0.4);
  figure.classList.add("mo-unveil-figure");
  const shadow = figure.cloneNode(false);
  shadow.classList.add("shadow");
  const stand = el("div.mo-unveil-stand", [figure, shadow]);
  node.append(dark, stand);
  let showDialogue = () => {};
  try {
    await covering(node, async () => {
      if (figure.decode) await Promise.race([figure.decode().catch(() => {}), sleep(1500)]);
      duckBgm(0.35, 400);
      // 1. 司会の立ち絵と会話の窓が引き、光が四つ目の台へ絞られて、影が立つ
      showDialogue = hideDialogue();
      move(dark, [iris(150, 0), iris(58, 1)], 800, { easing: EASE.inOut });
      await sleep(350);
      await move(stand, [{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "translateY(0)" }], 700, { easing: EASE.out });
      await sleep(420);
      // 2. 影が下から煙のにじみでほどけ、本人の姿になる
      figure.style.opacity = "1";
      hazeRise(node, 1500);
      move(dark, [iris(58, 1), iris(76, 0.9)], 1300, { easing: "ease-out" });
      await smokeOut(shadow, 1300);
      shadow.remove();
      await sleep(650);
      duckBgm(1, 500);
      await move(node, [{ opacity: 1 }, { opacity: 0 }], 480, { easing: "ease-in" });
    }, { portrait: false }); // 立ち絵の大きさと足元は会話の枠取り（横の舞台）のまま。縦の舞台では横長のまま真ん中に収める
  } finally { showDialogue(); duckBgm(1, 300); }
}
