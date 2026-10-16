// 章タイトルの動き。どの章も、採用した一枚絵とまったく同じ構図で止まる（最後に元の絵へ差し替える）。
// 第一章: 題字と6人を透過レイヤーに分けた（assets/ui/chapters/ch1_layers）。白いもやが上へ晴れていく中、
//   構図ぜんたいがふわりと浮かび、6人も題字もぼけから少しずつ重なって合う（横移動はしない）。
// 第二・四・五章: 一枚絵は切らない。ぼけた下地から右（人物）→左（題字）へピントが送られ、
//   ゆっくりした寄りが収まり、最後に題字の形にだけ光が一筋走る。
// 第三章など絵の無い章: 文字の行を順に浮かべる（CSSのみ）。
import { el, sleep } from "../core/util.js";
import { reducedMotion } from "../core/transition-kit.js";

const img = (file) => new URL(`../../img/ui/chapters/${file}.webp`, import.meta.url).href;

// 区間ごとの緩急（長い移動に強い曲線を掛けない）
const SOFT = "cubic-bezier(.22,.61,.36,1)";
const SINE = "cubic-bezier(.37,0,.63,1)";

// ---------------------------------------------------------------- 第一章（レイヤー）

// 位置は ch1-title.webp の座標そのまま（assets/ui/chapters/ch1_layers/layers.json）
const CH1_TITLE = [
  { id: "title-logo", x: 537, y: 24, at: 700 },
  { id: "title-rule", x: 566, y: 52, at: 900, rule: true },
  { id: "title-chapter", x: 568, y: 86, at: 1100 },
  { id: "title-subtitle", x: 561, y: 230, at: 2700 },
];
const CH1_GLYPHS = [[403, 129], [500, 142], [565, 159], [650, 140], [730, 151], [794, 128]];
const GLYPH_AT = 1500, GLYPH_GAP = 120;
// 浮かぶ順。右端のはじめから左へ、前の人が見えきる前に次が重なって浮かぶ（集まってくる感じだけ残す）
const CH1_PEOPLE = [
  { id: "hajime", x: 1061, y: 287, sx: 1067 },
  { id: "sumi", x: 845, y: 262, sx: 850 },
  { id: "tsumugi", x: 663, y: 330, sx: 666 },
  { id: "adam", x: 440, y: 285, sx: 446 },
  { id: "naru", x: 216, y: 279, sx: 221 },
  { id: "minto", x: 43, y: 319, sx: 43 },
].map((p, i) => ({ ...p, at: 250 + i * 240, ms: 1900 }));
const CH1_SHADOW_Y = 618;
const CH1_TOTAL = 5800; // 退場の前まで（全員がそろった絵を約2秒見せる）
const ch1Urls = () => [
  ...CH1_TITLE.map((t) => img(`ch1/${t.id}`)),
  ...CH1_GLYPHS.map((_, i) => img(`ch1/title-name${i}`)),
  ...CH1_PEOPLE.flatMap((p) => [img(`ch1/${p.id}`), img(`ch1/${p.id}-shadow`)]),
];

const layerImg = (cls, id, x, y) => el(`img.${cls}`, { src: img(`ch1/${id}`), alt: "", draggable: "false", style: { left: `${x}px`, top: `${y}px` } });

function mountCh1(card, full) {
  const stage = el("div.ct-stage.ct-pixel");
  const scene = el("div.ct-scene");
  const title = [];
  for (const t of CH1_TITLE) title.push({ node: layerImg("ct-layer", t.id, t.x, t.y), ...t });
  CH1_GLYPHS.forEach(([x, y], i) => title.push({ node: layerImg("ct-layer", `title-name${i}`, x, y), at: GLYPH_AT + i * GLYPH_GAP, glyph: true }));
  const people = CH1_PEOPLE.map((p) => ({
    ...p,
    body: layerImg("ct-body", p.id, p.x, p.y),
    shadow: layerImg("ct-shadow", `${p.id}-shadow`, p.sx, CH1_SHADOW_Y),
  }));
  // 白い紙にかかった薄いもや。全体を覆ったまま、上へほどけて晴れていく
  const haze = el("div.ct-haze");
  scene.append(...people.flatMap((p) => [p.shadow, p.body]), ...title.map((t) => t.node));
  stage.append(scene, haze);
  full.classList.add("ct-final");
  card.classList.add("ct-layered", "ct-ch1");
  card.append(stage);
  for (const n of [...title.map((t) => t.node), ...people.flatMap((p) => [p.body, p.shadow])]) n.style.opacity = "0";

  return async () => {
    // 構図ぜんたいが、わずかに下からふわりと上がって収まる（1区間・弱い減速）
    scene.animate([{ transform: "translateY(10px)", easing: "cubic-bezier(.33,.0,.2,1)" }, { transform: "translateY(0px)" }], { duration: 3600, fill: "both" });
    haze.animate([
      { opacity: 1, transform: "translateY(0px)", easing: SINE },
      { opacity: 0.55, transform: "translateY(-50px)", offset: 0.45, easing: SINE },
      { opacity: 0, transform: "translateY(-110px)" },
    ], { duration: 3400, fill: "both" });
    for (const p of people) {
      const opt = { delay: p.at, duration: p.ms, fill: "both" };
      p.body.style.opacity = "";
      p.shadow.style.opacity = "";
      // ぼけた淡い姿が、少し沈んだ所から浮き上がりつつピントが合う
      p.body.animate([
        { opacity: 0, transform: "translateY(14px)", filter: "blur(7px)", easing: SINE },
        { opacity: 0.75, transform: "translateY(5px)", filter: "blur(2.5px)", offset: 0.45, easing: SOFT },
        { opacity: 1, transform: "translateY(0px)", filter: "blur(0px)" },
      ], opt);
      // 足元の影は少し遅れて、横に締まりながら濃くなる
      p.shadow.animate([
        { opacity: 0, transform: "scaleX(.8)", filter: "blur(4px)", easing: SINE },
        { opacity: 0.6, transform: "scaleX(.93)", filter: "blur(1.5px)", offset: 0.5, easing: SOFT },
        { opacity: 1, transform: "scaleX(1)", filter: "blur(0px)" },
      ], { ...opt, delay: p.at + 200 });
    }
    for (const t of title) {
      const opt = { delay: t.at, fill: "both" };
      t.node.style.opacity = "";
      if (t.rule) {
        // 細い罫は中央から左右へ、淡く引かれる
        t.node.animate([
          { transform: "scaleX(0)", opacity: 0, easing: SINE },
          { transform: "scaleX(.6)", opacity: 0.7, offset: 0.5, easing: SOFT },
          { transform: "scaleX(1)", opacity: 1 },
        ], { ...opt, duration: 1100 });
      } else {
        // 題字は人物と同じく、ぼけからわずかに浮き上がって合う
        const dy = t.glyph ? 12 : 8;
        t.node.animate([
          { transform: `translateY(${dy}px)`, opacity: 0, filter: `blur(${t.glyph ? 6 : 4}px)`, easing: SINE },
          { transform: `translateY(${dy * 0.35}px)`, opacity: 0.75, filter: "blur(1.5px)", offset: 0.45, easing: SOFT },
          { transform: "translateY(0px)", opacity: 1, filter: "blur(0px)" },
        ], { ...opt, duration: t.glyph ? 1300 : 1100 });
      }
    }
    const done = Math.max(...people.map((p) => p.at + 200 + p.ms), GLYPH_AT + GLYPH_GAP * 5 + 1300, CH1_TITLE.at(-1).at + 1100, 3600) + 120;
    await sleep(done);
    // 組み上がった構図を、元の一枚絵そのものに差し替える（レイヤーの継ぎ目を残さない）
    full.classList.add("ct-shown");
    requestAnimationFrame(() => requestAnimationFrame(() => stage.remove()));
    await sleep(Math.max(0, CH1_TOTAL - done));
  };
}

// ---------------------------------------------------------------- 第二・四・五章（一枚絵）

// glint は題字だけを白く抜いたマスク（assets/ui/chapters/chN-title-glint.png）の位置。origin は寄りの中心
const PAINTED = {
// tint は光のにじみ、core は帯の芯の色（暗い題字の第四章は白ではなく夕日の金）
  // eyes は瞳の中心（x, y）・半径 r・ハイライトまでのずれ（hx, hy）・星の長さ s（ch2-title.webp を解析した座標）
  第二章: { key: "ch2", glint: { x: 50, y: 170, w: 425, h: 130 }, origin: "66% 42%", tint: "255,150,205", core: "255,255,255", glow: 0.85,
    eyes: [{ x: 883, y: 158, r: 14, hx: -4, hy: -10, s: 58 }, { x: 809, y: 213, r: 13, hx: -1, hy: -8, s: 50 }] },
  第四章: { key: "ch4", glint: { x: 50, y: 215, w: 465, h: 145 }, origin: "64% 40%", tint: "255,196,120", core: "255,226,160", glow: 0.7 },
  第五章: { key: "ch5", glint: { x: 45, y: 178, w: 437, h: 312 }, origin: "70% 44%", tint: "190,160,255", core: "255,255,255", glow: 0.9 },
};
const PAINT_TOTAL = 4400;
const SWAP_AT = 3800; // 採用画像へ溶かし始める時刻（寄りはここでほぼ収まっている）
const EYE_AT = 1950; // 瞳が光り始める時刻（ピント送りが瞳を過ぎて落ち着いた後）

function mountPainted(card, full, spec) {
  const src = full.getAttribute("src");
  const plate = el("img.ct-plate", { src, alt: "", draggable: "false" });
  const sharp = el("img.ct-sharp", { src, alt: "", draggable: "false" });
  const sweep = el("div.ct-sweep");
  const g = spec.glint;
  const band = el("i");
  const glint = el("div.ct-glint-wrap", {
    style: { left: `${g.x}px`, top: `${g.y}px`, width: `${g.w}px`, height: `${g.h}px`, "--ct-mask": `url("${img(`${spec.key}-title-glint`)}")` },
  }, [el("div.ct-glint", [band])]);
  // 瞳の光は寄りの器の中に置くので、寄りの拡大と一緒に動いて瞳からずれない
  const eyes = (spec.eyes || []).map((e) => {
    const parts = { glow: el("i.ct-eye-glow"), iris: el("i.ct-eye-iris"), star: el("i.ct-eye-star", [el("b"), el("b"), el("b")]) };
    const node = el("div.ct-eye", { style: { left: `${e.x}px`, top: `${e.y}px`, "--ct-r": `${e.r}px`, "--ct-hx": `${e.hx}px`, "--ct-hy": `${e.hy}px`, "--ct-s": `${e.s}px` } }, Object.values(parts));
    return { ...parts, node };
  });
  const layers = [plate, sharp, sweep, glint];
  if (eyes.length) layers.push(el("div.ct-eyes", eyes.map((e) => e.node)));
  const cam = el("div.ct-cam", { style: { transformOrigin: spec.origin, "--ct-tint": spec.tint, "--ct-core": spec.core } }, layers);
  full.classList.add("ct-final");
  card.classList.add("ct-layered", "ct-painted");
  card.append(cam);

  return async () => {
    // ゆっくりした寄りが収まる（全体を通して1区間）
    cam.animate([{ transform: "scale(1.075)", easing: "cubic-bezier(.3,.1,.25,1)" }, { transform: "scale(1)" }], { duration: 4000, fill: "both" });
    // ピント送り: 右の人物から左の題字へ。境目に淡い光が付いて行く
    cam.animate([{ "--ct-wipe": "122%", easing: "cubic-bezier(.42,0,.25,1)" }, { "--ct-wipe": "-22%" }], { duration: 2000, delay: 200, fill: "both" });
    plate.animate([{ filter: "blur(16px) brightness(.38) saturate(.85)", easing: SOFT }, { filter: "blur(14px) brightness(.62) saturate(.9)" }], { duration: 900, fill: "both" });
    sweep.animate([{ opacity: 0, easing: SOFT }, { opacity: 1, offset: 0.25, easing: SINE }, { opacity: 1, offset: 0.7, easing: SINE }, { opacity: 0 }], { duration: 2000, delay: 200, fill: "both" });
    // 題字の形にだけ光が一筋走る
    band.animate([{ transform: "translateX(-60%)", easing: "cubic-bezier(.55,.1,.35,1)" }, { transform: `translateX(${g.w + 40}px)` }], { duration: 1050, delay: 2200, fill: "both" });
    glint.animate([{ opacity: 0, easing: SOFT }, { opacity: spec.glow, offset: 0.2, easing: SINE }, { opacity: spec.glow, offset: 0.75, easing: SINE }, { opacity: 0 }], { duration: 1050, delay: 2200, fill: "both" });
    // 瞳がきらめく: ピントが合いきった直後、題字に光が走るのと同じ頃。ふくらんで落ち着き、淡い余韻が残る
    eyes.forEach((e, i) => {
      const at = EYE_AT + i * 70;
      const glowFrames = (peak, rest) => [
        { opacity: 0, transform: "scale(.7)", easing: SOFT },
        { opacity: peak, transform: "scale(1)", offset: 0.28, easing: SINE },
        { opacity: rest, transform: "scale(.96)", offset: 0.62, easing: SINE },
        { opacity: rest * 0.8, transform: "scale(.95)" },
      ];
      e.glow.animate(glowFrames(0.75, 0.3), { delay: at, duration: SWAP_AT - at, fill: "both" });
      e.iris.animate(glowFrames(0.9, 0.4), { delay: at + 60, duration: SWAP_AT - at - 60, fill: "both" });
      e.star.animate([
        { opacity: 0, transform: "rotate(-30deg) scale(.15)", easing: "cubic-bezier(.2,.7,.3,1)" },
        { opacity: 1, transform: "rotate(-14deg) scale(1)", offset: 0.3, easing: SINE },
        { opacity: 0.55, transform: "rotate(-8deg) scale(.72)", offset: 0.6, easing: SINE },
        { opacity: 0, transform: "rotate(-4deg) scale(.5)" },
      ], { delay: at + 120, duration: 1250, fill: "both" });
    });
    await sleep(SWAP_AT);
    // 寄りの合成層は採用画像よりわずかに柔らかいので、切り替えは一瞬で替えず重ねて溶かす
    full.classList.add("ct-shown");
    setTimeout(() => cam.remove(), 700);
    await sleep(PAINT_TOTAL - SWAP_AT);
  };
}

// ---------------------------------------------------------------- 入口

/** 本編の一枚絵のほかに読み込む絵（動き軽減では使わない） */
export function chapterArtUrls(no) {
  if (reducedMotion()) return [];
  if (no === "第一章") return ch1Urls();
  const spec = PAINTED[no];
  return spec ? [img(`${spec.key}-title-glint`)] : [];
}

/**
 * 章タイトルのカードに動きを組み込む。戻り値の play() は退場（フェードアウト）を始めてよい時刻まで待つ。
 * full は採用画像の img.cc-art（最後にこれへ差し替える）。絵が無い章は full を省く。
 */
export function mountChapterTitle(card, { no, full = null } = {}) {
  if (reducedMotion()) return null;
  if (!full) {
    card.classList.add("ct-text");
    return () => sleep(3600);
  }
  if (no === "第一章") return mountCh1(card, full);
  const spec = PAINTED[no];
  return spec ? mountPainted(card, full, spec) : null;
}
